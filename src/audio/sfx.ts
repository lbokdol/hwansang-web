// Audio engine — plays the delivered OGG assets: one-shot SFX (preloaded) +
// looping BGM with crossfade. Created lazily on the first user gesture
// (autoplay policy). Safely no-ops under Node (headless sim): no AudioContext,
// and the import.meta.glob call is guarded for non-Vite bundlers.

let fileUrl: Record<string, string> = {};
try {
  // Vite replaces this at build time with a { path: url } map; in esbuild/Node
  // import.meta.glob is undefined → throws → caught (audio simply unavailable).
  const urls = import.meta.glob("./*.ogg", { eager: true, query: "?url", import: "default" }) as Record<
    string,
    string
  >;
  for (const [path, url] of Object.entries(urls)) {
    const m = path.match(/([a-z0-9_]+)\.ogg$/);
    if (m) fileUrl[m[1]] = url;
  }
} catch {
  fileUrl = {};
}

// talisman id → element sound
const TAL: Record<string, string> = {
  fire_talisman: "sfx_tal_fire",
  thunder_talisman: "sfx_tal_thunder",
  heal_talisman: "sfx_tal_heal",
  barrier_talisman: "sfx_tal_shield",
  teleport_talisman: "sfx_tal_teleport",
  bind_talisman: "sfx_tal_bind",
  requiem_talisman: "sfx_tal_sleep",
  exorcism_talisman: "sfx_tal_exorcism",
  farsight_talisman: "sfx_tal_farsight",
  guardian_talisman: "sfx_tal_guardian",
};

class AudioEngine {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private buffers: Record<string, AudioBuffer> = {};
  private bgmName: string | null = null;
  private bgmCur: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  /** Bumped on every music() request; a swap only starts a source if it's still the latest.
   * Prevents overlapping BGM when several tracks are requested during uncached loads. */
  private bgmGen = 0;
  private preloaded = false;

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!this.ctx) {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.85;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.4;
      this.musicBus.connect(this.master);
    }
    return this.ctx;
  }

  /** Call on first user gesture: unlocks audio, preloads SFX, starts pending BGM. */
  resume(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    if (!this.preloaded) {
      this.preloaded = true;
      for (const name of Object.keys(fileUrl)) if (name.startsWith("sfx_")) void this.load(name);
    }
    if (this.bgmName && !this.bgmCur) void this.swapBgm(this.bgmName, ++this.bgmGen);
  }

  private async load(name: string): Promise<AudioBuffer | null> {
    const have = this.buffers[name];
    if (have) return have;
    const url = fileUrl[name];
    const ctx = this.ensure();
    if (!url || !ctx) return null;
    try {
      const data = await fetch(url).then((r) => r.arrayBuffer());
      const buf = await ctx.decodeAudioData(data);
      this.buffers[name] = buf;
      return buf;
    } catch {
      return null;
    }
  }

  private oneshot(name: string, vol = 1): void {
    const ctx = this.ensure();
    if (!ctx || !this.enabled || !this.sfxBus) return;
    const buf = this.buffers[name];
    if (!buf) {
      void this.load(name); // not decoded yet — will be ready next time
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(this.sfxBus);
    src.start();
  }

  // --- BGM (crossfade, loop) -------------------------------------------------
  music(name: string | null): void {
    if (name === this.bgmName) return;
    this.bgmName = name;
    if (!this.ensure()) return; // before first gesture; resume() will start it
    void this.swapBgm(name, ++this.bgmGen);
  }

  /** Fade out + stop the currently-playing BGM (if any). */
  private stopCurrent(fadeTime = 1.2): void {
    const cur = this.bgmCur;
    this.bgmCur = null;
    if (!cur || !this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      cur.gain.gain.cancelScheduledValues(now);
      cur.gain.gain.setValueAtTime(Math.max(0.0001, cur.gain.gain.value), now);
      cur.gain.gain.linearRampToValueAtTime(0.0001, now + fadeTime);
      cur.src.stop(now + fadeTime + 0.1);
    } catch {
      /* already stopped */
    }
  }

  private async swapBgm(name: string | null, gen: number): Promise<void> {
    const ctx = this.ensure();
    if (!ctx || !this.musicBus) return;
    // Decode first (may await on the initial, uncached load), THEN check we're
    // still the latest request. Superseded swaps abort before starting anything,
    // so exactly one source is ever playing.
    let buf: AudioBuffer | null = null;
    if (name) {
      buf = await this.load(name);
      if (gen !== this.bgmGen) return; // a newer music() call won
    }
    this.stopCurrent(); // crossfade out whatever is playing now
    if (!name || !buf || !this.musicBus) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    src.connect(g);
    g.connect(this.musicBus);
    const t = ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(1, t + 1.2);
    src.start();
    this.bgmCur = { src, gain: g };
  }

  // --- event methods (call sites in run.ts / scenes.ts / patterns.ts) --------
  enemyHit(): void {
    this.oneshot("sfx_bump_hit");
  }
  playerHit(): void {
    this.oneshot("sfx_player_hit");
  }
  enemyDie(): void {
    this.oneshot("sfx_enemy_die", 0.8);
  }
  pickup(): void {
    this.oneshot("sfx_pickup");
  }
  talisman(id?: string): void {
    this.oneshot(id && TAL[id] ? TAL[id] : "sfx_tal_fire");
  }
  descend(): void {
    this.oneshot("sfx_descend");
  }
  levelUp(): void {
    this.oneshot("sfx_levelup");
  }
  revive(): void {
    this.oneshot("sfx_revive");
  }
  death(): void {
    this.oneshot("sfx_death");
  }
  bossAppear(): void {
    this.oneshot("sfx_boss_appear");
  }
  bossTelegraph(): void {
    this.oneshot("sfx_boss_telegraph", 0.7);
  }
  bossPhase(): void {
    this.oneshot("sfx_boss_phase");
  }
  bossDown(): void {
    this.oneshot("sfx_boss_down");
  }
  karmaGain(): void {
    this.oneshot("sfx_karma_gain");
  }
  upgradeBuy(): void {
    this.oneshot("sfx_upgrade_buy");
  }
  uiClick(): void {
    this.oneshot("sfx_ui_click", 0.6);
  }
  move(): void {
    this.oneshot("sfx_move", 0.35);
  }
  bladeStep(): void {
    this.oneshot("sfx_blade_step", 0.8);
  }
  lavaStep(): void {
    this.oneshot("sfx_lava_step", 0.8);
  }
  iceSlide(): void {
    this.oneshot("sfx_ice_slide", 0.7);
  }
}

export const sfx = new AudioEngine();
