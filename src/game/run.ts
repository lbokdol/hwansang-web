import { Scheduler } from "rot-js";
import { add, chebyshev, manhattan, type Pos } from "../core/grid";
import { Rng } from "../core/rng";
import {
  absorbWithShield,
  applyStatus as applyStatusRaw,
  processTurnEnd,
  processTurnStart,
  removeStatus,
} from "../core/status";
import type {
  DamageOptions,
  GameContext,
  MetaState,
  RunLoadout,
  StatusKind,
  TargetInfo,
} from "../core/types";
import { FxSystem } from "../render/fx";
import { Player } from "../entities/player";
import { Enemy } from "../entities/enemy";
import type { Actor } from "../entities/actor";
import { Level } from "../map/level";
import { computeFov } from "../map/fov";
import { generateFloor, stageScale } from "../map/generate";
import { T_FLOOR, T_STAIRS, getTile } from "../map/tiles";
import { HELLS, hellByIndex } from "../content/hells";
import { getEnemy } from "../content/enemies";
import { getTalisman, hasTalisman, baseDropPool, dropEntries } from "../content/talismans";
import { getWeapon } from "../content/weapons";
import { cycleOf, cycleScale } from "../content/curses";
import { MessageLog } from "../ui/log";
import { sfx } from "../audio/sfx";
import { bestiaryJeonggiBonus, bestiaryStars, recordKill } from "../meta/bestiary";
import {
  chi,
  emptyConduct,
  evaluateVerdict,
  jin,
  tam,
  type Conduct,
  type VerdictDef,
} from "../content/judgment";
import { getVow } from "../content/vows";
import { drawBlessings, getBlessing, type BlessingDef, type BlessingTag } from "../content/blessings";
import type { RunOutcome } from "../meta/karma";

const FOV_RADIUS = 8;

/** 六道(육도) 표식 — 직전 깊은 court 판결이 새겨 다음 지옥에 적용된다. */
export type RealmMark = "none" | "in" | "cheon" | "jiok" | "agwi" | "chuksaeng";

const REALM_LABEL: Record<RealmMark, string> = {
  none: "",
  in: "인도 — 호신",
  cheon: "천도 — 큰 호신",
  jiok: "지옥도 — 해저드가 짙다",
  agwi: "아귀도 — 회복 반감",
  chuksaeng: "축생도 — 시야가 흐리다",
};

export type PlayerAction =
  | { kind: "move"; dir: Pos }
  | { kind: "wait" }
  | { kind: "descend" }
  | { kind: "talisman"; index: number; target: TargetInfo };

export class Run implements GameContext {
  readonly meta: MetaState;
  readonly loadout: RunLoadout;
  readonly rng = new Rng();
  readonly fx = new FxSystem();
  readonly messages = new MessageLog();

  player: Player;
  level!: Level;
  hellIndex = 0;
  floorIndex = 0;
  turn = 0;
  depthCount = 0; // total floors entered this run
  /** Randomized hell order this run (랜덤 시작) — descent index → HELLS index. */
  hellOrder: number[] = [];
  /** 윤회겁(輪廻劫) 단계 — 활성 악연 weight 합. GameContext.cycle. */
  cycle = 0;

  // ---- 업경대 심판(業鏡臺) + 六道 -------------------------------------------
  /** 이번 지옥에서의 태도(왕이 저울질할 三毒). 지옥 진입마다 리셋. */
  private conduct: Conduct = emptyConduct();
  private cumJin = 0;
  private cumTam = 0;
  private cumChi = 0;
  private clarityStreak = 0;
  /** 이번 지옥에 작용 중인 표식(직전 깊은 court가 새긴 것). */
  activeMark: RealmMark = "none";
  private pendingMark: RealmMark = "none";
  /** 六道 전륜 집계(통과한 깊은 court별 표식). */
  markTally: Record<string, number> = {};
  private judgedHellIndex = -1;
  /** 표현층이 렌더할 최근 판결(court당 1회). */
  lastVerdict: VerdictDef | null = null;

  /** 서원(誓願): 아직 파계하지 않은 계율 ids. */
  readonly vowsKept = new Set<string>();

  // ---- 인연(因緣) + 삼매(三昧) ----------------------------------------------
  /** 왕에게 빌린 지속 축복(누적, 같은 id 중복=중첩). */
  private readonly blessings: BlessingDef[] = [];
  /** 보유 축복별 중첩 수(HUD/삼매 표시용). */
  readonly blessingLevels: Record<string, number> = {};
  private readonly samadhi = new Set<BlessingTag>();
  /** 왕 격파 직후 제시되는 후보 id(비면 선택 대기 없음). 표현층이 오버레이로 렌더·선택. */
  readonly pendingBlessings: string[] = [];

  enemiesKilled = 0;
  bossesKilled = 0;
  // 공과록(업적) 판정용 런 통계.
  damageTaken = 0;
  talismansUsed = 0;
  revivesUsed = 0;

  awaitingInput = false;
  over = false;
  won = false;
  private consecutivePlayerSkips = 0;

  // Speed scheduler: fast enemies (200) act twice per player turn, slow (50) half.
  private scheduler = new Scheduler.Speed<Actor>();
  private readonly dropPool: string[];

  /** Called when the run ends (death or victory). */
  onEnd?: (won: boolean) => void;

  constructor(meta: MetaState, loadout: RunLoadout, seed?: number) {
    this.meta = meta;
    this.loadout = loadout;
    for (const v of loadout.activeVows) this.vowsKept.add(v);
    this.rng.seed(seed ?? Math.floor(Math.random() * 2 ** 31));

    // 지옥 순서(2단 셔플): 얕은 옥 4(order≤4) 셔플 → 깊은 옥 5(order 5–9) 셔플 →
    // 오도전륜(order 10)은 항상 최후 고정. 시작 지옥은 무작위, 피날레는 늘 전륜대왕.
    const idxs = [...Array(HELLS.length).keys()];
    const shallow = idxs.filter((i) => HELLS[i].order <= 4);
    const deep = idxs.filter((i) => HELLS[i].order >= 5 && HELLS[i].order < 10);
    const finale = idxs.filter((i) => HELLS[i].order >= 10);
    this.hellOrder = [...this.rng.shuffle(shallow), ...this.rng.shuffle(deep), ...finale];
    // 윤회겁: 드래프트한 악연의 weight 합 = 이번 런의 겁.
    this.cycle = cycleOf(meta.activeCurses);

    this.dropPool = [...baseDropPool, ...loadout.unlockedTalismanPool].filter(hasTalisman);

    this.player = new Player({ x: 1, y: 1 }, loadout);
    this.grantStartingTalismans();
    // 윤회의 결의 R2: start with 호신 effect.
    if (loadout.startEmpower) applyStatusRaw(this.player, "empower", 5, 3, undefined, 2);
    this.buildFloor(true);
  }

  // ---- GameContext readonly views ------------------------------------------

  get hell() {
    return hellByIndex(this.hellOrder[this.hellIndex] ?? this.hellIndex);
  }

  /** Absolute descent stage (0..29): difficulty scales with this, not the hell. */
  get stage(): number {
    return this.hellIndex * 3 + this.floorIndex;
  }

  /** 축생도(癡) 표식 = 판단 흐림 → 시야 8→5. 그 외 8. */
  private get fovRadius(): number {
    return this.activeMark === "chuksaeng" ? 5 : FOV_RADIUS;
  }

  private grantStartingTalismans(): void {
    for (const id of this.loadout.startingTalismans) {
      if (hasTalisman(id)) this.player.addTalisman(id);
    }
    const entries = dropEntries(this.dropPool);
    for (let i = 0; i < this.loadout.randomTalismans && entries.length > 0; i++) {
      const id = this.rng.weighted(entries);
      if (id) this.player.addTalisman(id);
    }
  }

  /** Weighted drop-table entries for this run's unlocked pool. */
  weightedDropEntries(): { value: string; weight: number }[] {
    return dropEntries(this.dropPool);
  }

  // ---- floor lifecycle -----------------------------------------------------

  private buildFloor(first = false): void {
    this.pendingBlessings.length = 0; // 안전망: 미선택 인연은 하강 시 소멸(UI는 선택 전 하강을 막음)
    const hell = this.hell;
    if (this.floorIndex === 0) {
      // 새 지옥: 왕이 저울질할 태도(Conduct)를 리셋 + 직전 깊은 court가 새긴 六道 표식을 적용(소비).
      this.conduct = emptyConduct();
      this.activeMark = this.pendingMark;
      this.pendingMark = "none";
      this.applyRealmEntryBoon();
    }
    this.discover("hells", hell.id);
    const { level, start } = generateFloor({
      hell,
      depth: this.floorIndex,
      stage: this.stage,
      rng: this.rng,
      dropPool: this.dropPool,
      weaponDrops: this.loadout.weaponDrops,
      cycleMul: cycleScale(this.cycle),
      markDensityMul: this.activeMark === "jiok" ? 1.5 : 1, // 지옥도(嗔) = 해저드 더 짙게
    });
    this.level = level;
    this.player.pos = { ...start };
    level.actors.push(this.player);
    this.depthCount++;

    this.scheduler.clear();
    this.scheduler.add(this.player, true);
    for (const e of level.livingEnemies()) this.scheduler.add(e, true);
    if (level.isBossFloor) sfx.bossAppear();

    // 축생도(癡) 표식 = 판단 흐림 → 로드아웃의 사전 정찰 이점을 무효화.
    const revealBlocked = this.activeMark === "chuksaeng";
    if (this.loadout.revealHazards && !revealBlocked) {
      // 망자의 직감 R1: mark every hazard/stair tile as explored from the start.
      for (let y = 0; y < level.height; y++) {
        for (let x = 0; x < level.width; x++) {
          const def = getTile(level.tileIdAt({ x, y }));
          if (def.hazard || def.id === T_STAIRS) level.explored.add(`${x},${y}`);
        }
      }
    }
    if (this.loadout.revealEnemies && !revealBlocked) {
      // 망자의 직감 R2: reveal enemy positions at floor start.
      for (const e of level.livingEnemies()) level.explored.add(`${e.pos.x},${e.pos.y}`);
    }

    computeFov(level, this.player.pos, this.fovRadius);

    if (first || this.floorIndex === 0) this.messages.push(hell.intro, hell.palette.accent);
    this.messages.push(
      `${hell.name} ${this.floorIndex + 1}층` + (level.isBossFloor ? " — 왕의 자리" : ""),
      "#cdbfa6",
    );
    if (this.loadout.startInvulnTurns > 0 && this.depthCount === 1) {
      this.messages.push(`윤회의 결의: ${this.loadout.startInvulnTurns}턴간 무적`, "#ffd86b");
    }
    if (this.floorIndex === 0 && this.activeMark !== "none") {
      this.messages.push(`육도 표식: ${REALM_LABEL[this.activeMark]}`, "#b08cff");
    }
    // 보스층: 업경대 심판을 여기서 평가·적용 (헤드리스 포함 court당 1회).
    this.judgeCourt();
  }

  // ---- 업경대 심판(業鏡臺) -------------------------------------------------

  /** 보스층 도달 시 court당 1회: 태도(Conduct)를 저울질해 왕의 판결을 내리고 적용한다. */
  private judgeCourt(): void {
    if (!this.level.isBossFloor || this.judgedHellIndex === this.hellIndex) return;
    this.judgedHellIndex = this.hellIndex;
    const boss = this.level.livingEnemies().find((e) => e.isBoss);
    if (!boss) return;
    const c = this.conduct;
    const v = evaluateVerdict(c);
    this.lastVerdict = v;
    this.recordJudgment(c, v);
    v.apply(this, boss);
    this.messages.push(`업경대 심판 — ${v.name}: ${v.flavor}`, v.isBoon ? "#ffe9a8" : "#ff8a5a");
    this.fx.shake(6);
  }

  /** 판결 → 三毒 누적 + 다음 지옥에 새길 六道 표식(pending). */
  private recordJudgment(c: Conduct, v: VerdictDef): void {
    this.cumJin += jin(c);
    this.cumTam += tam(c);
    this.cumChi += chi(c);
    if (v.id === "jeongsim") this.clarityStreak++;
    else this.clarityStreak = 0;
    this.pendingMark =
      v.id === "jinno"
        ? "jiok"
        : v.id === "tamyok"
          ? "agwi"
          : v.id === "uchi"
            ? "chuksaeng"
            : v.id === "jeongsim"
              ? this.clarityStreak >= 2
                ? "cheon"
                : "in"
              : "none";
  }

  /** 六道 진입 보우: 인도(人)·천도(天) 표식은 지옥 진입 시 호신을 준다. */
  private applyRealmEntryBoon(): void {
    if (this.activeMark === "in") applyStatusRaw(this.player, "empower", 4, 1, undefined, 1);
    else if (this.activeMark === "cheon") {
      applyStatusRaw(this.player, "empower", 8, 2, undefined, 1);
      this.heal(this.player, Math.ceil(this.player.stats.maxHp * 0.25));
    }
  }

  /** 서원 파계: 계율을 어긴 순간 1회 표시하고 보상을 소멸시킨다. */
  private breakVow(id: string): void {
    if (!this.vowsKept.has(id)) return;
    this.vowsKept.delete(id);
    const v = getVow(id);
    if (v) this.messages.push(`서원 파계 — ${v.name}`, "#c05a6b");
  }

  // ---- 인연(因緣) + 삼매(三昧) ----------------------------------------------

  /** 같은 三毒/淸 인연 수(3이면 삼매 완성). */
  blessingTagCount(tag: BlessingTag): number {
    return this.blessings.filter((b) => b.tag === tag).length;
  }
  hasSamadhi(tag: BlessingTag): boolean {
    return this.samadhi.has(tag);
  }
  /** 개안한 삼매 색들(결과화면 표시용). */
  get samadhiTags(): BlessingTag[] {
    return [...this.samadhi];
  }

  /** 왕 격파 시 1-of-N(8겁+ 4) 인연을 제시(피날레 왕 제외 — 쓸 다음 지옥이 없음). */
  private offerBlessings(): void {
    if (this.hellIndex >= HELLS.length - 1) return; // 전륜(피날레) 이후엔 무의미
    this.pendingBlessings.length = 0;
    this.pendingBlessings.push(...drawBlessings(this.rng, this.cycle >= 8 ? 4 : 3));
  }

  /** 표현층이 오버레이에서 호출: 후보 중 하나를 선택해 보유. */
  chooseBlessing(index: number): void {
    if (index < 0 || index >= this.pendingBlessings.length) return;
    const def = getBlessing(this.pendingBlessings[index]);
    this.pendingBlessings.length = 0;
    if (def) this.grantBlessing(def);
  }

  /** QA only: grant a blessing by id (bypasses the draft). */
  debugGrantBlessing(id: string): void {
    const def = getBlessing(id);
    if (def) this.grantBlessing(def);
  }

  private grantBlessing(def: BlessingDef): void {
    this.blessings.push(def);
    this.blessingLevels[def.id] = (this.blessingLevels[def.id] ?? 0) + 1;
    def.onPick?.(this);
    this.messages.push(`인연을 맺다 — ${def.name}`, "#c5a6ff");
    if (this.blessingTagCount(def.tag) >= 3 && !this.samadhi.has(def.tag)) {
      this.samadhi.add(def.tag);
      this.awakenSamadhi(def.tag);
    }
  }

  private awakenSamadhi(tag: BlessingTag): void {
    const p = this.player;
    switch (tag) {
      case "cheong": // 정심: 청정 방어
        p.stats.maxHp += 8;
        p.stats.hp += 8;
        p.damageReduction += 1;
        this.messages.push("삼매 개안 — 정심: 청정한 방벽.", "#7be0a0");
        break;
      case "jin": // 업화: 공세
        p.stats.atk += 2;
        p.bonusAttackChance += 0.2;
        this.messages.push("삼매 개안 — 업화: 불타는 연격.", "#ff8a5a");
        break;
      case "tam": {
        // 보장: 손패
        p.inventorySize += 1;
        for (let i = 0; i < 2; i++) {
          const id = this.rng.weighted(this.weightedDropEntries());
          if (!(id && p.addTalisman(id))) this.heal(p, 6);
        }
        this.messages.push("삼매 개안 — 보장: 손패가 넉넉하다.", "#ffd86b");
        break;
      }
      case "chi": // 통찰: 회심
        p.critChance += 0.22;
        this.messages.push("삼매 개안 — 통찰: 치명의 눈.", "#c5a6ff");
        break;
    }
    this.fx.shake(6);
  }

  /** Begin the run's turn cycle (call once after construction). */
  start(): void {
    this.loop();
  }

  // ---- turn loop -----------------------------------------------------------

  private loop(): void {
    if (this.over) return;
    for (;;) {
      const actor = this.scheduler.next();
      if (!actor) return;
      if (!actor.alive) {
        this.scheduler.remove(actor);
        continue;
      }
      if (actor === this.player) {
        const { skipTurn } = processTurnStart(this.player, this);
        if (skipTurn) {
          this.consecutivePlayerSkips++;
          // Safety net: never lock the player out indefinitely (chained CC
          // would otherwise spin this synchronous loop forever).
          if (this.consecutivePlayerSkips >= 8) {
            removeStatus(this.player, "freeze");
            removeStatus(this.player, "bound");
            removeStatus(this.player, "sleep");
            this.messages.push("의지를 끌어모아 속박을 떨쳐낸다!", "#ffd86b");
            this.consecutivePlayerSkips = 0;
            this.awaitingInput = true;
            return;
          }
          this.endActorTurn(this.player);
          if (this.over) return;
          continue;
        }
        this.consecutivePlayerSkips = 0;
        this.awaitingInput = true;
        return;
      }
      this.takeEnemyTurn(actor as Enemy);
      if (this.over) return;
    }
  }

  private takeEnemyTurn(enemy: Enemy): void {
    // FOV-gated activation: dormant until first seen, or adjacent to the player
    // (레벨디자인 §4.2). Bosses spawn awake.
    if (!enemy.awake) {
      if (this.level.isVisible(enemy.pos) || manhattan(enemy.pos, this.player.pos) <= 1) {
        enemy.awake = true;
        this.discover(enemy.isBoss ? "bosses" : "enemies", enemy.def.id);
      } else {
        this.endActorTurn(enemy);
        return;
      }
    }
    const { skipTurn } = processTurnStart(enemy, this);
    if (!skipTurn) enemy.act(this);
    if (enemy.flashTurns > 0) enemy.flashTurns--;
    this.endActorTurn(enemy);
  }

  private endActorTurn(actor: Actor): void {
    if (!actor.alive) return;
    this.applyStandHazard(actor);
    if (!actor.alive) return;
    processTurnEnd(actor, this);
  }

  /** External entry: the player committed an action. */
  submitAction(action: PlayerAction): void {
    if (!this.awaitingInput || this.over) return;
    const consumed = this.applyPlayerAction(action);
    if (!consumed) return; // invalid move — keep waiting

    this.awaitingInput = false;
    if (this.player.flashTurns > 0) this.player.flashTurns--;
    // Recompute FOV from the player's final position (covers move, ice-slide,
    // and teleport alike).
    computeFov(this.level, this.player.pos, this.fovRadius);
    // 보스 인접 접촉: ending a turn next to a boss takes its ATK (보스패턴 §1.2).
    this.applyBossAdjacency();
    this.endActorTurn(this.player);
    this.turn++;
    if (this.over) return;

    this.decayTempTiles(); // 공격으로 변한 함정 타일을 1턴 뒤 바닥으로 되돌린다
    this.hell.onFloorTick?.(this);
    this.loop();
    // Tick start-of-run invulnerability down AFTER this round's enemy phase, so
    // "N턴 무적" protects exactly N rounds (윤회의 결의).
    if (this.player.invulnTurns > 0) this.player.invulnTurns--;
  }

  private applyPlayerAction(action: PlayerAction): boolean {
    switch (action.kind) {
      case "wait":
        return true;
      case "move":
        return this.playerMove(action.dir);
      case "descend":
        return this.playerDescend();
      case "talisman":
        return this.useTalisman(action.index, action.target);
    }
  }

  private playerMove(dir: Pos): boolean {
    this.player.facing = dir;
    const dest = add(this.player.pos, dir);
    const target = this.level.actorAt(dest);
    if (target && target.isEnemy) {
      return this.playerAttack(target as Enemy, dest, dir);
    }
    if (this.level.isWall(dest) || target) return false;
    sfx.move();
    this.moveActor(this.player, dest);
    this.pickupAt(this.player.pos);
    this.pickupWeaponAt(this.player.pos);
    this.applyAltarAt(this.player.pos);
    return true;
  }

  /** Weapon-aware bump attack (설계서 3.2 + 무기 §6). Returns whether a turn is consumed. */
  private playerAttack(target: Enemy, dest: Pos, dir: Pos): boolean {
    const w = this.player.weapon;
    let dmg = Math.max(1, this.effAtk(this.player) + w.atkBonus - this.effDef(target));
    // 통찰(癡) 삼매: 치명타 — 평타 2배.
    if (this.player.critChance > 0 && this.rng.chance(this.player.critChance)) {
      dmg *= 2;
      this.fx.floatText(target.pos, "치명!", "#ff5a5a");
    }
    this.dealDamage(target, dmg, { source: this.player, kind: "physical" });
    // 무사혼 패시브: 가끔 추가타
    if (target.alive && this.player.bonusAttackChance > 0 && this.rng.chance(this.player.bonusAttackChance)) {
      this.dealDamage(target, dmg, { source: this.player, kind: "physical" });
      this.fx.floatText(target.pos, "연타!", "#ffd86b");
    }
    // 석장: 사거리 2 — 앞의 적까지 (대상별 방어력으로 재계산)
    if (w.reach >= 2) {
      const beyond = this.enemyAt(add(dest, dir));
      if (beyond) {
        const dmg2 = Math.max(1, this.effAtk(this.player) + w.atkBonus - this.effDef(beyond));
        this.dealDamage(beyond, dmg2, { source: this.player, kind: "physical" });
      }
    }
    // 도깨비방망이: 넉백
    if (w.knockback > 0 && target.alive) this.knockback(target, dir, w.knockback);
    // 환도: 가끔 추가 행동 (턴 미소모)
    if (w.extraActionChance > 0 && this.rng.chance(w.extraActionChance)) {
      this.fx.floatText(this.player.pos, "추가행동!", "#ffd86b");
      return false;
    }
    return true;
  }

  /** Push an enemy `dist` tiles; blocked → impact damage, into hazards → hazard. */
  private knockback(e: Actor, dir: Pos, dist: number): void {
    for (let i = 0; i < dist; i++) {
      const next = add(e.pos, dir);
      if (this.level.isWall(next) || this.level.actorAt(next)) {
        this.dealDamage(e, 2, { source: this.player, kind: "physical" });
        this.fx.floatText(e.pos, "쾅!", "#ffd0a0");
        return;
      }
      e.pos = { ...next };
      this.applyEnterHazard(e);
      if (!e.alive) return;
    }
  }

  private pickupWeaponAt(p: Pos): void {
    const drop = this.level.weaponDropAt(p);
    if (!drop) return;
    const w = getWeapon(drop.weaponId);
    this.player.weapon = w;
    this.messages.push(`${w.name}을(를) 장착했다.`, w.color);
    sfx.pickup();
    this.level.removeWeaponDrop(drop);
  }

  private applyAltarAt(p: Pos): void {
    const altar = this.level.altarAt(p);
    if (!altar) return;
    if (altar.kind === "heal") {
      this.heal(this.player, Math.ceil(this.player.stats.maxHp * 0.5));
      this.messages.push("회복 제단: 혼백이 차오른다.", "#7be0a0");
    } else if (altar.kind === "hp") {
      this.player.stats.maxHp += 8;
      this.player.stats.hp += 8;
      this.fx.floatText(p, "최대 HP+8", "#c43b54", 1);
      this.messages.push("정혈 제단: 최대 HP +8.", "#c43b54");
    } else {
      this.player.stats.atk += 1;
      this.fx.floatText(p, "ATK+1", "#ffd86b", 1);
      this.messages.push("연마 제단: 공격력 +1.", "#ffd86b");
    }
    sfx.pickup();
    this.conduct.altarsTaken++; // 貪: 제단을 취함
    this.breakVow("no_altar"); // 무소유(無所有)
    if (altar.kind === "heal") this.breakVow("no_heal"); // 고행(苦行)
    this.level.removeAltar(altar);
  }

  private pickupAt(p: Pos): void {
    const drop = this.level.dropAt(p);
    if (!drop) return;
    if (this.player.addTalisman(drop.talismanId)) {
      const t = getTalisman(drop.talismanId);
      this.messages.push(`${t.name}을(를) 주웠다.`, t.color);
      this.discover("talismans", drop.talismanId);
      sfx.pickup();
      this.conduct.pickups++; // 貪: 전리품을 그러쥠
      this.level.removeDrop(drop);
    } else {
      this.messages.push("인벤토리가 가득 찼다.", "#a08");
    }
  }

  private playerDescend(): boolean {
    if (this.level.tileIdAt(this.player.pos) !== T_STAIRS) {
      this.messages.push("계단이 없다.", "#a08");
      return false;
    }
    if (this.loadout.healOnDescendFraction > 0) {
      this.heal(this.player, Math.ceil(this.player.stats.maxHp * this.loadout.healOnDescendFraction));
    }
    this.advanceFloor();
    return true;
  }

  /** Player ATK including buffs (used by ATK-scaling attack talismans). */
  playerAtk(): number {
    return this.effAtk(this.player);
  }

  private applyBossAdjacency(): void {
    if (!this.player.alive) return;
    for (const e of this.level.livingEnemies()) {
      if (e.isBoss && manhattan(e.pos, this.player.pos) === 1) {
        this.dealDamage(this.player, e.stats.atk, { source: e, kind: "physical" });
        return;
      }
    }
  }

  private advanceFloor(): void {
    this.floorIndex++;
    if (this.floorIndex >= this.hell.floors) {
      this.hellIndex++;
      this.floorIndex = 0;
      const limit = this.loadout.hellLimit;
      if (this.hellIndex >= HELLS.length || (limit != null && this.hellIndex >= limit)) {
        this.win(); // 명부 고시(1지옥) 또는 전 지옥 완주
        return;
      }
    }
    sfx.descend();
    this.buildFloor();
  }

  private useTalisman(index: number, target: TargetInfo): boolean {
    const stack = this.player.inventory[index];
    if (!stack) return false;
    const def = getTalisman(stack.id);
    const result = def.use(this, target);
    if (result.message) this.messages.push(result.message, def.color);
    if (result.consumed) {
      sfx.talisman(stack.id);
      this.talismansUsed++;
      this.conduct.talismansUsed++;
      this.breakVow("no_talisman"); // 묵언(默言)
      // 癡: 축지·천리안 등 요행/술수에 매달림.
      if (stack.id === "teleport_talisman" || stack.id === "farsight_talisman") {
        this.conduct.escapes++;
        this.breakVow("no_escape"); // 정도(正道)
      }
      if (stack.id === "heal_talisman" || stack.id === "detox_talisman") this.breakVow("no_heal"); // 고행(苦行)
      this.player.consumeTalisman(index);
      return true;
    }
    return false;
  }

  // ---- hazards -------------------------------------------------------------

  private applyEnterHazard(actor: Actor): void {
    const def = this.level.tileAt(actor.pos);
    const h = def.hazard;
    if (!h || h.trigger !== "enter") return;
    this.runHazard(actor, def.name, h.damage, h.damageKind, h.status);
    if (actor === this.player) {
      if (def.id === "dosan_blade") sfx.bladeStep();
      else if (def.id === "hwatang_lava") sfx.lavaStep();
    }
  }

  private applyStandHazard(actor: Actor): void {
    const def = this.level.tileAt(actor.pos);
    const h = def.hazard;
    if (!h || h.trigger !== "stand") return;
    this.runHazard(actor, def.name, h.damage, h.damageKind, h.status);
  }

  private runHazard(
    actor: Actor,
    name: string,
    damage: number | undefined,
    kind: DamageOptions["kind"],
    status: { kind: StatusKind; turns: number; power: number } | undefined,
  ): void {
    if (damage && damage > 0) {
      // 지형 피해는 방어(피해 감소)가 적용된다 (전투_상세 §4.1).
      this.dealDamage(actor, damage, { kind: kind ?? "terrain" });
      if (actor === this.player) this.messages.push(`${name}에 베였다! (-${damage})`, "#ff8a5a");
    }
    if (status) this.applyStatus(actor, status.kind, status.turns, status.power);
  }

  /** 임시 함정 타일(공격 변환)을 감쇠 — 남은 턴이 0이면 바닥으로 복원. */
  private decayTempTiles(): void {
    const tt = this.level.tempTiles;
    if (tt.length === 0) return;
    const keep: typeof tt = [];
    for (const t of tt) {
      t.turnsLeft--;
      if (t.turnsLeft > 0) {
        keep.push(t);
        continue;
      }
      const p = { x: t.x, y: t.y };
      // 다른 것으로 덮이지 않았을 때만(여전히 그 함정 타일일 때) 바닥으로 되돌린다.
      if (this.level.tileIdAt(p) === t.id) this.level.setTile(p, T_FLOOR);
    }
    this.level.tempTiles = keep;
  }

  // ---- GameContext implementation -----------------------------------------

  log(msg: string, color?: string): void {
    this.messages.push(msg, color);
  }

  private effAtk(a: Actor): number {
    const e = a.statuses.find((s) => s.kind === "empower");
    return a.stats.atk + (e ? e.power : 0);
  }

  private effDef(a: Actor): number {
    const e = a.statuses.find((s) => s.kind === "empower");
    return a.stats.def + (e ? (e.aux ?? 0) : 0);
  }

  // ---- combat / status (GameContext) --------------------------------------

  dealDamage(target: Actor, amount: number, opts: DamageOptions = {}): number {
    if (!target.alive) return 0;
    let dmg = Math.max(0, Math.round(amount));

    // Boss is invulnerable during its phase-2 transition (보스패턴 §5).
    if (target.isEnemy && ((target as Enemy).state.invuln ?? 0) > 0) {
      this.fx.floatText(target.pos, "무적", "#fff");
      return 0;
    }
    if (target === this.player && this.player.invulnTurns > 0) {
      this.fx.floatText(target.pos, "무적", "#ffd86b");
      return 0;
    }
    if (dmg > 0) dmg = absorbWithShield(target, dmg); // 결계 pool absorbs everything
    if (target === this.player && !opts.ignoreDef) {
      dmg = Math.max(0, dmg - this.player.damageReduction);
    }
    if (dmg > 0) removeStatus(target, "sleep");

    if (dmg <= 0) {
      if (target === this.player) this.fx.floatText(target.pos, "막음", "#c9b27a");
      return 0;
    }

    // 均衡場(평등대왕): cap the player's single hit on the boss; excess vanishes.
    if (target.isEnemy && opts.source === this.player) {
      const eb = target as Enemy;
      const cap = (eb.state.equalize ?? 0) > 0 ? (eb.state.evenCap ?? 0) : 0;
      if (cap > 0) dmg = Math.min(dmg, cap);
    }

    target.stats.hp -= dmg;
    if (target === this.player) {
      this.damageTaken += dmg;
      this.conduct.damageTaken += dmg; // 업경대: 무피격(淸) 판정용 지옥별 피해
    }
    target.flashTurns = 1;

    // 거울왕 반사장(염라대왕): reflect part of the player's direct hit. The
    // reflection's source is the boss, so it never recurses through this branch.
    if (
      target.isEnemy &&
      opts.source === this.player &&
      ((target as Enemy).state.mirror ?? 0) > 0 &&
      (opts.kind === undefined ||
        opts.kind === "physical" ||
        opts.kind === "ice" ||
        opts.kind === "fire" ||
        opts.kind === "holy" ||
        opts.kind === "lightning")
    ) {
      const mb = target as Enemy;
      const reflected = Math.min(mb.state.mirrorCap ?? 0, Math.ceil((dmg * (mb.state.mirrorFrac ?? 0)) / 1000));
      if (reflected > 0) {
        this.fx.floatText(this.player.pos, "반사", "#c4b9e0");
        this.dealDamage(this.player, reflected, { source: mb, kind: "pure" });
      }
    }

    if (!opts.noFx) {
      this.fx.floatText(target.pos, `-${dmg}`, target === this.player ? "#ff6a6a" : "#ffd0a0");
      if (target === this.player) {
        this.fx.shake(4);
        sfx.playerHit();
      } else {
        sfx.enemyHit();
      }
    }

    if (target.stats.hp > 0 && target.isEnemy && (target as Enemy).isBoss) {
      this.checkBossPhase(target as Enemy);
    }

    // 질풍(風) 흉물: 근접 피격 시 플레이어를 1칸 밀친다 (밀림 자체는 무피해). knockback의
    // 충돌 대미지는 source=player라 이 훅을 재트리거하지 않는다.
    if (
      target === this.player &&
      target.stats.hp > 0 &&
      opts.source?.isEnemy &&
      (opts.source as Enemy).affixes.includes("gust")
    ) {
      const src = opts.source;
      const dx = this.player.pos.x - src.pos.x;
      const dy = this.player.pos.y - src.pos.y;
      const dir = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
      if (dir.x || dir.y) {
        this.knockback(this.player, dir, 1);
        this.fx.floatText(this.player.pos, "돌풍", "#cbb98a");
      }
    }

    // 인연 OnHit: 플레이어 평타가 살아남은 적을 맞힘(상태부여/흡정). 상태 부여뿐이라 재귀 없음.
    if (this.blessings.length > 0 && opts.source === this.player && target.isEnemy && target.stats.hp > 0) {
      for (const b of this.blessings) b.onHit?.(this, target as Enemy, dmg);
    }
    // 인연 OnHurt: 플레이어가 피격에서 생존(반사/밀쳐냄). 반사는 source=가해자라 재트리거 없음.
    if (this.blessings.length > 0 && target === this.player && target.stats.hp > 0) {
      for (const b of this.blessings) b.onHurt?.(this, opts.source, dmg);
    }

    if (target.stats.hp <= 0) {
      if (target === this.player) this.handlePlayerDeath();
      else this.killEnemy(target as Enemy, opts.source);
    }
    return dmg;
  }

  applyStatus(
    target: Actor,
    kind: StatusKind,
    turns: number,
    power = 1,
    source?: Actor,
    aux?: number,
  ): void {
    applyStatusRaw(target, kind, turns, power, source, aux);
  }

  heal(target: Actor, amount: number): void {
    if (!target.alive || amount <= 0) return;
    // 아귀도(貪) 표식 = 굶주림: 망자의 모든 회복 반감(하한 1).
    if (target === this.player && this.activeMark === "agwi") amount = Math.max(1, Math.ceil(amount * 0.5));
    const before = target.stats.hp;
    target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + amount);
    const gained = target.stats.hp - before;
    if (gained > 0) this.fx.floatText(target.pos, `+${gained}`, "#7be0a0");
  }

  // ---- queries (GameContext) ----------------------------------------------

  actorAt(p: Pos): Actor | undefined {
    return this.level.actorAt(p);
  }

  enemyAt(p: Pos): Enemy | undefined {
    const a = this.level.actorAt(p);
    return a && a.isEnemy ? (a as Enemy) : undefined;
  }

  isWall(p: Pos): boolean {
    return this.level.isWall(p);
  }

  isBlocked(p: Pos): boolean {
    return this.level.isWall(p) || this.level.actorAt(p) !== undefined;
  }

  enemiesInRadius(center: Pos, r: number): Enemy[] {
    return this.level.livingEnemies().filter((e) => chebyshev(e.pos, center) <= r);
  }

  allEnemies(): Enemy[] {
    return this.level.livingEnemies();
  }

  raycastTiles(origin: Pos, dir: Pos, len: number, opts: { stopAtWall?: boolean } = {}): Pos[] {
    const out: Pos[] = [];
    let cur = add(origin, dir);
    for (let i = 0; i < len; i++) {
      if (!this.level.inBounds(cur.x, cur.y)) break;
      if (opts.stopAtWall && this.level.isWall(cur)) break;
      out.push({ ...cur });
      cur = add(cur, dir);
    }
    return out;
  }

  emptyTilesInSight(): Pos[] {
    const out: Pos[] = [];
    for (const k of this.level.visible) {
      const [x, y] = k.split(",").map(Number);
      const p = { x, y };
      if (!this.level.isWall(p) && !this.level.actorAt(p) && this.level.tileIdAt(p) !== T_STAIRS) {
        out.push(p);
      }
    }
    return out;
  }

  // ---- mutation / flow (GameContext) --------------------------------------

  moveActor(actor: Actor, to: Pos): boolean {
    if (this.level.isWall(to)) return false;
    const occ = this.level.actorAt(to);
    if (occ && occ !== actor) return false;
    const from = actor.pos;
    const isUnitStep = Math.abs(to.x - from.x) + Math.abs(to.y - from.y) === 1;
    actor.pos = { ...to };
    this.applyEnterHazard(actor);
    if (!actor.alive) return true;
    // 출혈(出血): damage on movement (전투_상세 §4.2).
    const bleed = actor.statuses.find((s) => s.kind === "bleed");
    if (bleed) {
      // 출혈은 방어(피해 감소)가 적용된다 (전투_상세 §4.2).
      this.dealDamage(actor, bleed.power, { kind: "physical", noFx: true });
      if (!actor.alive) return true;
    }
    // 한빙지옥 얼음: a single step onto ice slides until solid ground (설계서 3.4).
    if (isUnitStep && this.level.tileAt(actor.pos).slippery) {
      const dir = { x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) };
      this.slide(actor, dir);
    }
    return true;
  }

  private slide(actor: Actor, dir: Pos): void {
    if (actor === this.player) sfx.iceSlide();
    for (let i = 0; i < 64; i++) {
      const next = add(actor.pos, dir);
      if (this.level.isWall(next)) return;
      const occ = this.level.actorAt(next);
      if (occ && occ !== actor) return;
      actor.pos = { ...next };
      this.applyEnterHazard(actor);
      if (!actor.alive) return;
      if (!this.level.tileAt(actor.pos).slippery) return; // stopped on solid ground
    }
  }

  spawnEnemy(defId: string, p: Pos): Enemy | null {
    if (this.isBlocked(p)) return null;
    const e = Enemy.fromDef(getEnemy(defId), { ...p }, stageScale(this.stage) * cycleScale(this.cycle));
    e.awake = true; // summoned enemies join the fight immediately
    this.level.actors.push(e);
    this.scheduler.add(e, true);
    return e;
  }

  killActor(actor: Actor): void {
    if (actor === this.player) {
      this.handlePlayerDeath();
      return;
    }
    this.killEnemy(actor as Enemy);
  }

  descend(): void {
    this.advanceFloor();
  }

  onBossDefeated(_bossId: string): void {
    // hook for content; progression handled in killEnemy.
  }

  /** 도감(명부록): record a first encounter. */
  private discover(category: "enemies" | "bosses" | "talismans" | "hells", id: string): void {
    const arr = this.meta.codex[category];
    if (!arr.includes(id)) arr.push(id);
  }

  // ---- internal kill/death handling ---------------------------------------

  private killEnemy(enemy: Enemy, source?: Actor): void {
    if (!enemy.alive) return;
    // 嗔: 무력한 자(빙결·봉박·수면)를 벤 잔혹 — 업경은 몸이 아니라 방식을 읽는다.
    const wasSubdued = enemy.statuses.some((s) => s.kind === "freeze" || s.kind === "bound" || s.kind === "sleep");
    enemy.alive = false;
    this.enemiesKilled++;
    this.conduct.kills++;
    if (wasSubdued) {
      this.conduct.subdued++;
      this.breakVow("no_kill_helpless"); // 불살생(不殺生)
    }
    this.fx.floatText(enemy.pos, "✦", enemy.color);
    enemy.def.onDeath?.(enemy, this);
    this.scheduler.remove(enemy);
    this.level.removeActor(enemy);

    // 요괴 도감 숙련: 잡몹은 처치수를 누적하고, 숙련도만큼 정기(精氣) 보너스를 얹는다.
    let jeonggi = enemy.jeonggi;
    if (!enemy.isBoss) {
      const { prev, tierUp } = recordKill(this.meta, enemy.def.id);
      jeonggi += bestiaryJeonggiBonus(prev);
      if (tierUp) {
        this.messages.push(`${enemy.name} 복속 — ${bestiaryStars(prev + 1)}`, "#b08cff");
        this.fx.floatText(enemy.pos, "복속↑", "#b08cff", 1.0);
      }
    }

    // 정기(精氣) → 영급 (in-run leveling).
    const levels = this.player.gainJeonggi(jeonggi);
    if (levels > 0) this.onLevelUp(levels);

    if (enemy.isBoss) {
      this.bossesKilled++;
      // 六道: 이 court가 실제로 통과(격파)한 표식만 전륜 엔딩 집계에 든다.
      if (this.pendingMark !== "none") this.markTally[this.pendingMark] = (this.markTally[this.pendingMark] ?? 0) + 1;
      this.discover("bosses", enemy.def.id);
      if (!this.meta.bossesDefeated.includes(enemy.def.id)) {
        this.meta.bossesDefeated.push(enemy.def.id); // 도장 (first-kill record)
      }
      this.messages.push(`${enemy.name}을(를) 쓰러뜨렸다!`, "#ffd86b");
      this.fx.shake(8);
      sfx.bossDown();
      // open the way down (or to victory).
      this.level.setTile(enemy.pos, T_STAIRS);
      this.level.stairs = { ...enemy.pos };
      this.onBossDefeated(enemy.def.id);
      this.offerBlessings(); // 인연: 왕 격파 시 1-of-N 지속 축복 제시(피날레 제외)
    } else {
      sfx.enemyDie();
      this.messages.push(`${enemy.name} 처치 (정기 +${jeonggi})`, "#9aa");
    }

    // 인연 OnKill: 플레이어 처치에만 반응(흡혼·견인). victim은 이미 레벨에서 제거됨.
    if (source === this.player && this.blessings.length > 0) {
      for (const b of this.blessings) b.onKill?.(this, enemy);
    }
  }

  private onLevelUp(levels: number): void {
    this.messages.push(`영급 상승! Lv.${this.player.level} (최대 HP·공격력 증가)`, "#ffe9a8");
    this.fx.floatText(this.player.pos, "영급↑", "#ffe9a8", 1.0);
    this.fx.shake(3);
    sfx.levelUp();
    void levels;
  }

  private checkBossPhase(boss: Enemy): void {
    if (!boss.boss || boss.phase >= 2) return;
    if (boss.hpFraction <= boss.boss.phase2At) {
      boss.phase = 2;
      boss.boss.onPhaseChange?.(boss, this);
    }
  }

  private handlePlayerDeath(): void {
    if (this.player.autoRevives > 0) {
      this.player.autoRevives--;
      this.player.stats.hp = Math.max(1, Math.floor(this.player.stats.maxHp * this.player.reviveHpFraction));
      this.player.alive = true;
      this.player.statuses = [];
      // +1 compensates for the end-of-round invuln decrement that runs later in
      // this same submitAction (granted mid-round, unlike startInvulnTurns).
      if (this.player.reviveInvuln > 0) this.player.invulnTurns = this.player.reviveInvuln + 1;
      this.fx.shake(10);
      sfx.revive();
      this.revivesUsed++;
      this.messages.push("명부의 가호로 되살아난다!", "#ffd86b");
      return;
    }
    this.player.alive = false;
    this.over = true;
    sfx.death();
    this.messages.push("망자의 혼이 흩어진다…", "#ff5a5a");
    this.onEnd?.(false);
  }

  private win(): void {
    this.over = true;
    this.won = true;
    this.messages.push("모든 지옥을 통과했다. 환생의 문이 열린다…", "#ffe9a8");
    this.onEnd?.(true);
  }

  // ---- outcome -------------------------------------------------------------

  getOutcome(): RunOutcome {
    const won = this.won;
    const limit = this.loadout.hellLimit;
    const idx = won ? (limit != null ? limit - 1 : HELLS.length - 1) : this.hellIndex;
    const finalHell = hellByIndex(this.hellOrder[idx] ?? idx);
    return {
      // On victory advanceFloor overshoots (hellIndex=HELLS.length); report the
      // actually-completed final hell/floor instead of the out-of-range indices.
      hellIndex: idx,
      hellName: finalHell.name,
      floorIndex: won ? finalHell.floors - 1 : this.floorIndex,
      totalFloorsDescended: this.depthCount,
      bossesKilled: this.bossesKilled,
      enemiesKilled: this.enemiesKilled,
      cleared: this.won,
      damageTaken: this.damageTaken,
      talismansUsed: this.talismansUsed,
      revivesUsed: this.revivesUsed,
      turns: this.turn,
      cycle: this.cycle,
      vowsKept: [...this.vowsKept],
    };
  }
}
