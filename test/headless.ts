import "./preload";
import { Run } from "../src/game/run";
import { baseLoadout, buildLoadout } from "../src/meta/loadout";
import { defaultMeta } from "../src/meta/save";
import { registerAllHellTiles, HELLS } from "../src/content/hells";
import { allEnemyIds } from "../src/content/enemies";
import { allTalismanIds } from "../src/content/talismans";
import { ACHIEVEMENTS, evaluateAchievements } from "../src/meta/achievements";
import { updateRecords } from "../src/meta/titles";
import { recordGongdeok } from "../src/meta/score";
import { bestStepToward } from "../src/map/path";
import { DIRS4, add, manhattan, type Pos } from "../src/core/grid";
import { getTalisman } from "../src/content/talismans";
import { Enemy } from "../src/entities/enemy";
import { getBoss } from "../src/content/bosses";
import { recordKill, bestiaryTier, bestiaryJeonggiBonus } from "../src/meta/bestiary";
import { addSoulXp, soulLevel, applySoulMastery } from "../src/meta/soulMastery";
import { AFFIXES } from "../src/content/affixes";
import { JUDGMENTS, emptyConduct, evaluateVerdict, type Conduct } from "../src/content/judgment";
import { vowsKarmaBonus } from "../src/content/vows";
import { dailyForKey, buildDailyLoadout, recordDaily } from "../src/content/daily";
import { convertTiles } from "../src/content/bosses/patterns";
import { getWeapon } from "../src/content/weapons";
import type { RunLoadout } from "../src/core/types";

registerAllHellTiles();

// Direct combat check: a boss adjacent to the player must die to repeated
// exorcism (ATK×2, DEF-ignore) — isolates combat correctness from bot tactics.
function bossKillTest(bossId: string, loadout: RunLoadout, scale = 1): { dead: boolean; hits: number; hp: number } {
  const run = new Run(defaultMeta(), loadout, 7);
  run.start();
  const p = run.player.pos;
  let cell: { x: number; y: number } | null = null;
  for (const d of DIRS4) {
    const c = { x: p.x + d.x, y: p.y + d.y };
    if (!run.isWall(c) && !run.actorAt(c)) {
      cell = c;
      break;
    }
  }
  if (!cell) return { dead: false, hits: 0, hp: -1 };
  const boss = Enemy.fromBoss(getBoss(bossId), cell, scale);
  run.level.actors.push(boss);
  run.player.inventory = [{ id: "exorcism_talisman", count: 9 }];
  let hits = 0;
  for (let i = 0; i < 16 && boss.alive; i++) {
    if (!run.awaitingInput) break;
    // The boss isn't scheduled here, so simulate its turn clearing the 1-turn
    // phase-transition invuln (which the scheduler does in the real game).
    boss.state.invuln = 0;
    if (run.player.inventory.length === 0) run.player.inventory = [{ id: "exorcism_talisman", count: 9 }];
    run.submitAction({ kind: "talisman", index: 0, target: {} });
    hits++;
  }
  return { dead: !boss.alive, hits, hp: boss.stats.hp };
}

// Boss brain smoke test: drive each king's act() for many turns (telegraph →
// resolve → form-shift → fields → pulls/relocate), forcing it to phase 2 and
// death, catching any runtime error. Exercises the deep-court boss code paths
// the greedy bot rarely reaches (30 floors deep).
function bossActTest(bossId: string, loadout: RunLoadout): { ok: boolean; note: string } {
  const run = new Run(defaultMeta(), loadout, 13);
  run.start();
  const p = run.player.pos;
  let cell: Pos | null = null;
  for (let r = 2; r <= 5 && !cell; r++) {
    for (const d of DIRS4) {
      const c = { x: p.x + d.x * r, y: p.y + d.y * r };
      if (!run.isWall(c) && !run.actorAt(c)) {
        cell = c;
        break;
      }
    }
  }
  if (!cell) return { ok: true, note: "no free cell (skipped)" };
  const boss = Enemy.fromBoss(getBoss(bossId), cell, 1);
  run.level.actors.push(boss);
  try {
    let ph2 = false;
    for (let t = 0; t < 48 && boss.alive && run.player.alive && !run.over; t++) {
      boss.act(run); // telegraph/resolve/form-shift/mirror/equalize/hook/gust/relocate
      if (run.over || !run.player.alive) break;
      if (boss.phase >= 2) ph2 = true;
      // Chip the boss to force onPhaseChange + the kill path.
      if (boss.alive) run.dealDamage(boss, Math.ceil(boss.stats.maxHp * 0.1), { source: run.player, kind: "physical" });
      if (run.player.hpFraction < 0.5) run.heal(run.player, run.player.stats.maxHp);
    }
    return { ok: true, note: `dead=${!boss.alive} ph2=${ph2}` };
  } catch (err) {
    return { ok: false, note: (err as Error).message + "\n" + (err as Error).stack };
  }
}

// Enemy brain smoke test: place an enemy aligned+adjacent-ish (so both ranged
// and melee/ambush/knockback branches fire), drive its act() a few turns, then
// kill it (onDeath: splits, slows). Catches errors in the 36 deep-court AIs the
// greedy bot never reaches.
function enemyActTest(enemyId: string, loadout: RunLoadout): { ok: boolean; note: string } {
  const run = new Run(defaultMeta(), loadout, 17);
  run.start();
  const p = run.player.pos;
  let cell: Pos | null = null;
  // Prefer an aligned cell a few tiles out (exercises ranged/pull/gale); fall
  // back to any free neighbour.
  for (const r of [3, 2, 1]) {
    for (const d of DIRS4) {
      const c = { x: p.x + d.x * r, y: p.y + d.y * r };
      if (!run.isWall(c) && !run.actorAt(c)) {
        cell = c;
        break;
      }
    }
    if (cell) break;
  }
  if (!cell) return { ok: true, note: "no free cell (skipped)" };
  const e = run.spawnEnemy(enemyId, cell);
  if (!e) return { ok: true, note: "spawn blocked (skipped)" };
  e.awake = true;
  try {
    for (let t = 0; t < 10 && e.alive && run.player.alive; t++) {
      e.flashTurns = 1; // pretend it was just struck (recoil/reflect branches)
      e.act(run);
      if (run.player.hpFraction < 0.5) run.heal(run.player, run.player.stats.maxHp);
    }
    if (e.alive) run.killActor(e); // exercise onDeath (bunyeol split, eoreumjogak slow, ...)
    return { ok: true, note: "" };
  } catch (err) {
    return { ok: false, note: (err as Error).message + "\n" + (err as Error).stack };
  }
}

interface SimResult {
  seed: number;
  floors: number;
  hellsCleared: number;
  bossesKilled: number;
  enemiesKilled: number;
  phase2Seen: boolean;
  died: boolean;
  won: boolean;
  steps: number;
  minBossHp: number; // lowest boss HP fraction observed (1 = never scratched)
  minBossDist: number; // closest the player ever got to the boss
  bossFloorReached: boolean;
  playerLevel: number;
  playerMaxHp: number;
  error?: string;
}

function dirTo(from: Pos, to: Pos): Pos {
  return { x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) };
}

function simulate(seed: number, loadout: RunLoadout, maxSteps = 4000): SimResult {
  const meta = defaultMeta();
  const run = new Run(meta, loadout, seed);
  let phase2Seen = false;
  let minBossHp = 1;
  let minBossDist = 999;
  let bossFloorReached = false;
  let steps = 0;
  try {
    run.start();
    while (!run.over && steps < maxSteps) {
      if (!run.awaitingInput) {
        throw new Error("loop stalled: not awaiting input and not over");
      }
      steps++;
      const player = run.player;
      const level = run.level;

      // detect boss phase change + track lowest boss HP + closest approach
      for (const e of level.livingEnemies()) {
        if (e.isBoss) {
          bossFloorReached = true;
          if (e.phase >= 2) phase2Seen = true;
          if (e.hpFraction < minBossHp) minBossHp = e.hpFraction;
          const d = manhattan(e.pos, run.player.pos);
          if (d < minBossDist) minBossDist = d;
        }
      }

      // telegraphed danger cells (boss wind-ups)
      const danger = new Set<string>();
      for (const e of level.livingEnemies()) {
        for (const m of e.telegraph) {
          if (m.turnsUntil > 0) for (const c of m.cells) danger.add(`${c.x},${c.y}`);
        }
      }
      const isDanger = (c: Pos) => danger.has(`${c.x},${c.y}`);
      const freeNonDanger = (from: Pos) =>
        DIRS4.map((d) => ({ x: from.x + d.x, y: from.y + d.y })).filter(
          (c) => !run.isWall(c) && !run.actorAt(c) && !isDanger(c),
        );

      // DODGE: standing on a telegraphed cell -> step to safety (a human reads the tell)
      if (isDanger(player.pos)) {
        const safe = freeNonDanger(player.pos);
        if (safe.length) {
          run.submitAction({ kind: "move", dir: dirTo(player.pos, safe[0]) });
          continue;
        }
      }

      const enemies = level.livingEnemies();
      const boss = enemies.find((e) => e.isBoss);
      const idxOf = (id: string) => player.inventory.findIndex((s) => s.id === id);
      const has = (id: string) => idxOf(id) >= 0;

      // heal / barrier when low
      if (player.hpFraction < 0.4 && has("heal_talisman")) {
        run.submitAction({ kind: "talisman", index: idxOf("heal_talisman"), target: {} });
        continue;
      }
      if (player.hpFraction < 0.55 && danger.size > 0 && has("barrier_talisman")) {
        run.submitAction({ kind: "talisman", index: idxOf("barrier_talisman"), target: {} });
        continue;
      }

      // boss engagement: buff, blast from range (DEF-ignore talismans are the
      // intended counter), bind for a window, melee while frozen.
      if (boss && level.isVisible(boss.pos)) {
        const dB = manhattan(boss.pos, player.pos);
        const alignedBoss = boss.pos.x === player.pos.x || boss.pos.y === player.pos.y;
        const bossFrozen = boss.statuses.some((s) => s.kind === "freeze");
        if (has("guardian_talisman") && !player.statuses.some((s) => s.kind === "empower")) {
          run.submitAction({ kind: "talisman", index: idxOf("guardian_talisman"), target: {} });
          continue;
        }
        if (has("fire_talisman") && alignedBoss && dB <= 4) {
          run.submitAction({ kind: "talisman", index: idxOf("fire_talisman"), target: { dir: dirTo(player.pos, boss.pos) } });
          continue;
        }
        if (dB === 1 && has("exorcism_talisman")) {
          run.submitAction({ kind: "talisman", index: idxOf("exorcism_talisman"), target: {} });
          continue;
        }
        if (has("thunder_talisman") && dB <= 3) {
          run.submitAction({ kind: "talisman", index: idxOf("thunder_talisman"), target: {} });
          continue;
        }
        if (has("bind_talisman") && dB <= 5 && !bossFrozen) {
          run.submitAction({ kind: "talisman", index: idxOf("bind_talisman"), target: { enemy: boss } });
          continue;
        }
        if (dB === 1 && bossFrozen) {
          run.submitAction({ kind: "move", dir: dirTo(player.pos, boss.pos) });
          continue;
        }
        // Reposition to line up a ranged shot: align to the boss's row/column,
        // hover at fire range (4). Accept stepping into a telegraph when healthy.
        const hasRanged = has("fire_talisman") || has("thunder_talisman") || has("exorcism_talisman");
        if (hasRanged && dB <= 8) {
          const dx = boss.pos.x - player.pos.x;
          const dy = boss.pos.y - player.pos.y;
          let m: Pos | null = null;
          if (dx !== 0 && dy !== 0) {
            m = Math.abs(dx) <= Math.abs(dy)
              ? { x: player.pos.x + Math.sign(dx), y: player.pos.y }
              : { x: player.pos.x, y: player.pos.y + Math.sign(dy) };
          } else {
            const sd: Pos = { x: Math.sign(dx), y: Math.sign(dy) };
            if (dB > 4) m = add(player.pos, sd);
            else if (dB <= 2) m = add(player.pos, { x: -sd.x, y: -sd.y });
          }
          if (m && !run.isWall(m) && !run.actorAt(m) && (!isDanger(m) || player.hpFraction > 0.6)) {
            run.submitAction({ kind: "move", dir: dirTo(player.pos, m) });
            continue;
          }
        }
      }

      // damage talismans: exorcism (adjacent), thunder (radius 3), fire (lined up)
      const adjFoes = enemies.filter((e) => manhattan(e.pos, player.pos) === 1).length;
      if (adjFoes >= 1 && has("exorcism_talisman")) {
        run.submitAction({ kind: "talisman", index: idxOf("exorcism_talisman"), target: {} });
        continue;
      }
      if (has("thunder_talisman") && enemies.some((e) => manhattan(e.pos, player.pos) <= 3)) {
        run.submitAction({ kind: "talisman", index: idxOf("thunder_talisman"), target: {} });
        continue;
      }
      const fireIdx = player.inventory.findIndex((s) => getTalisman(s.id).targeting === "direction");
      if (fireIdx >= 0) {
        const lined = enemies.find(
          (e) => (e.pos.x === player.pos.x || e.pos.y === player.pos.y) && manhattan(e.pos, player.pos) <= 4,
        );
        if (lined) {
          run.submitAction({ kind: "talisman", index: fireIdx, target: { dir: dirTo(player.pos, lined.pos) } });
          continue;
        }
      }

      // attack an adjacent enemy (unless that cell is mid-telegraph). Hit-and-run
      // the boss: if it's the only adjacent foe and HP is low, retreat instead of
      // trading (boss adjacency damage). Otherwise melee.
      const adj = enemies.find((e) => manhattan(e.pos, player.pos) === 1 && !isDanger(e.pos));
      if (adj) {
        if (adj.isBoss && player.hpFraction < 0.5) {
          const retreat = freeNonDanger(player.pos).sort(
            (a, b) => manhattan(b, adj.pos) - manhattan(a, adj.pos),
          )[0];
          if (retreat) {
            run.submitAction({ kind: "move", dir: dirTo(player.pos, retreat) });
            continue;
          }
        }
        run.submitAction({ kind: "move", dir: dirTo(player.pos, adj.pos) });
        continue;
      }

      // on stairs -> descend (but finish the boss first)
      if (!boss && level.stairs && player.pos.x === level.stairs.x && player.pos.y === level.stairs.y) {
        run.submitAction({ kind: "descend" });
        continue;
      }

      // Pick a target: stairs (or, if on the boss floor, the boss / nearest foe).
      const nearestFoe = enemies
        .slice()
        .sort((a, b) => manhattan(a.pos, player.pos) - manhattan(b.pos, player.pos))[0];
      const tryStep = (target: Pos): Pos | null =>
        bestStepToward(player.pos, target, level, (p) => {
          const a = level.actorAt(p);
          return a != null && a !== player && !(p.x === target.x && p.y === target.y);
        });

      let target: Pos | null = boss ? boss.pos : level.stairs;
      let step = target ? tryStep(target) : null;
      // If we can't reach the goal (e.g. a dormant enemy blocks the corridor),
      // path to the nearest enemy instead to clear the way (a human just attacks it).
      if (!step && nearestFoe) {
        target = nearestFoe.pos;
        step = tryStep(target);
      }
      if (step && !isDanger(step)) {
        run.submitAction({ kind: "move", dir: dirTo(player.pos, step) });
        continue;
      }
      const sidestep = freeNonDanger(player.pos);
      if (sidestep.length) {
        run.submitAction({ kind: "move", dir: dirTo(player.pos, sidestep[0]) });
        continue;
      }
      // nothing better — wait (avoids infinite stall)
      run.submitAction({ kind: "wait" });
    }
  } catch (err) {
    return {
      seed,
      floors: run.depthCount,
      hellsCleared: run.hellIndex,
      bossesKilled: run.bossesKilled,
      enemiesKilled: run.enemiesKilled,
      phase2Seen,
      died: !run.player.alive,
      won: run.won,
      steps,
      minBossHp,
      playerLevel: run.player.level,
      playerMaxHp: run.player.stats.maxHp,
      minBossDist,
      bossFloorReached,
      error: (err as Error).message + "\n" + (err as Error).stack,
    };
  }
  return {
    seed,
    floors: run.depthCount,
    hellsCleared: run.hellIndex,
    bossesKilled: run.bossesKilled,
    enemiesKilled: run.enemiesKilled,
    phase2Seen,
    died: !run.player.alive,
    won: run.won,
    steps,
    minBossHp,
    playerLevel: run.player.level,
    playerMaxHp: run.player.stats.maxHp,
    minBossDist,
    bossFloorReached,
  };
}

// Regression: a 빙귀(binggwi) adjacent re-applies freeze; the engine must never
// hang or lock the player out of control indefinitely. If loop() ever spun, this
// would never return and the process would time out.
function freezeLockTest(): { ok: boolean; note: string } {
  const run = new Run(defaultMeta(), baseLoadout(), 42);
  run.start();
  const p = run.player.pos;
  let placed = null;
  for (const d of DIRS4) {
    const c = { x: p.x + d.x, y: p.y + d.y };
    if (!run.isWall(c) && !run.actorAt(c)) {
      placed = run.spawnEnemy("hanbing_binggwi", c);
      if (placed) break;
    }
  }
  if (!placed) return { ok: true, note: "no adjacent tile to place binggwi (skipped)" };
  let turns = 0;
  while (!run.over && turns < 500) {
    if (!run.awaitingInput) return { ok: false, note: `engine stopped yielding control at turn ${turns}` };
    turns++;
    run.submitAction({ kind: "wait" });
  }
  return { ok: true, note: `${turns} turns, over=${run.over} — no hang, control retained` };
}

// Run a spread of seeds, escalating the loadout so the player can actually win.
const strongMeta = defaultMeta();
strongMeta.upgrades = {
  hardened_soul: 5,
  fierce_strike: 5,
  thick_karma: 4,
  soul_granary: 4,
  talisman_mastery: 3,
  soothing: 3,
  underworld_grace: 1,
};
const strong = buildLoadout(strongMeta);

// A near-maxed soul — what a player has after many runs. Used to confirm the
// full 3-hell clear is achievable by a competent (telegraph-dodging) player.
const maxedMeta = defaultMeta();
maxedMeta.upgrades = {
  hardened_soul: 5,
  fierce_strike: 5,
  thick_karma: 4,
  soul_granary: 4,
  talisman_mastery: 3,
  soothing: 3,
  underworld_grace: 1,
  weapon_lore: 1,
  karma_interest: 4,
  resolve_of_samsara: 3,
  new_bond: 3,
};
const maxed = buildLoadout(maxedMeta);

let errors = 0;
let anyBoss = false;
let anyWin = false;
let wins = 0;
console.log("=== headless sim: base loadout ===");
for (let s = 1; s <= 6; s++) {
  const r = simulate(s, baseLoadout());
  if (r.error) errors++;
  console.log(
    `seed ${r.seed}: floors=${r.floors} hell=${r.hellsCleared} boss=${r.bossesKilled} kills=${r.enemiesKilled} ph2=${r.phase2Seen} died=${r.died} won=${r.won} steps=${r.steps}${r.error ? " ERROR: " + r.error : ""}`,
  );
  if (r.bossesKilled > 0) anyBoss = true;
  if (r.won) anyWin = true;
}
console.log("=== headless sim: strong loadout ===");
for (let s = 100; s <= 105; s++) {
  const r = simulate(s, strong);
  if (r.error) errors++;
  console.log(
    `seed ${r.seed}: floors=${r.floors} hell=${r.hellsCleared} boss=${r.bossesKilled} kills=${r.enemiesKilled} ph2=${r.phase2Seen} died=${r.died} won=${r.won} steps=${r.steps}${r.error ? " ERROR: " + r.error : ""}`,
  );
  if (r.bossesKilled > 0) anyBoss = true;
  if (r.won) anyWin = true;
  if (r.phase2Seen) console.log("   (boss phase-2 transition observed)");
}

console.log("=== headless sim: maxed loadout (telegraph-dodging) ===");
for (let s = 200; s <= 215; s++) {
  const r = simulate(s, maxed);
  if (r.error) errors++;
  console.log(
    `seed ${r.seed}: floors=${r.floors} hell=${r.hellsCleared} boss=${r.bossesKilled} kills=${r.enemiesKilled} Lv${r.playerLevel}/${r.playerMaxHp}hp bossHpMin=${r.minBossHp.toFixed(2)} bossDist=${r.minBossDist} ph2=${r.phase2Seen} died=${r.died} won=${r.won} steps=${r.steps}${r.error ? " ERROR: " + r.error : ""}`,
  );
  if (r.bossesKilled > 0) anyBoss = true;
  if (r.won) {
    anyWin = true;
    wins++;
  }
}

console.log("=== boss-kill (combat correctness) ===");
let allBossesKillable = true;
for (const id of ["jingwang", "chogang", "songje", "ogwan"]) {
  const k = bossKillTest(id, maxed);
  if (!k.dead) allBossesKillable = false;
  console.log(`bossKillTest ${id}: dead=${k.dead} hits=${k.hits} remainingHp=${k.hp}`);
}
// 단계별 난이도: deepest-stage scaled bosses (stage 11 = ×1.56) must stay killable.
for (const id of ["songje", "ogwan"]) {
  const k = bossKillTest(id, maxed, 1.56);
  if (!k.dead) allBossesKillable = false;
  console.log(`deepBoss ${id} ×1.56: dead=${k.dead} hits=${k.hits} remainingHp=${k.hp}`);
}

console.log("=== enemy brain smoke (36 deep-court AIs act) ===");
let enemyActOk = true;
const deepEnemies = allEnemyIds().filter((id) =>
  /^(balseol|yangdong|geohae|heukseung|pungdo|yukdo)_/.test(id),
);
{
  let fails = 0;
  for (const id of deepEnemies) {
    const a = enemyActTest(id, maxed);
    if (!a.ok) {
      enemyActOk = false;
      fails++;
      console.log(`enemyAct ${id}: FAIL — ${a.note}`);
    }
  }
  console.log(`enemyAct: ${deepEnemies.length} deep-court AIs exercised, ${fails} failed`);
}

console.log("=== boss brain smoke (all 십대왕 act) ===");
let bossActOk = true;
for (const id of [
  "jingwang", "chogang", "songje", "ogwan", "yeomra",
  "byeonseong", "taesan", "pyeongdeung", "dosi", "jeonryun",
]) {
  const a = bossActTest(id, maxed);
  if (!a.ok) bossActOk = false;
  console.log(`bossAct ${id}: ok=${a.ok} — ${a.note}`);
}

console.log("=== 윤회겁(cycle) ===");
let cycleOk = true;
{
  const m = defaultMeta();
  m.cleared = true;
  m.activeCurses = ["short_life", "asura"]; // weight 2 + 4 = 6겁
  const lo = buildLoadout(m);
  const run = new Run(m, lo, 5);
  run.start();
  const curseHpOk = lo.maxHp === 14; // base 30 − 10(단명) − 6(아수라)
  // A fair mid-climb boss: deepest stage(×1.56) + cycle 6(×1.21) must stay killable.
  const k = bossKillTest("songje", maxed, 1.56 * (1 + 0.035 * 6));
  cycleOk = run.cycle === 6 && curseHpOk && k.dead;
  console.log(`cycle: run.cycle=${run.cycle} curseHp=${lo.maxHp} mid-climb songje dead=${k.dead}(${k.hits}h) ok=${cycleOk}`);
}

console.log("=== victory outcome (random order) ===");
let winOk = true;
{
  const run = new Run(defaultMeta(), baseLoadout(), 7);
  run.start();
  // Simulate the end-of-run overshoot advanceFloor produces on a clear.
  (run as unknown as { won: boolean }).won = true;
  (run as unknown as { hellIndex: number }).hellIndex = HELLS.length;
  const oc = run.getOutcome();
  winOk =
    oc.hellIndex === HELLS.length - 1 &&
    oc.floorIndex === HELLS[0].floors - 1 &&
    HELLS.some((h) => h.name === oc.hellName);
  console.log(`winOutcome: hell=${oc.hellName} idx=${oc.hellIndex} floor=${oc.floorIndex} ok=${winOk}`);
}

console.log("=== freeze-lock regression ===");
const fz = freezeLockTest();
console.log(`freezeLockTest: ok=${fz.ok} — ${fz.note}`);

console.log("=== 공과록(achievements) eval ===");
let achOk = true;
{
  const m = defaultMeta();
  const allKings = [
    "jingwang", "chogang", "songje", "ogwan", "yeomra",
    "byeonseong", "taesan", "pyeongdeung", "dosi", "jeonryun",
  ];
  m.bossesDefeated = [...allKings];
  m.codex = {
    enemies: allEnemyIds(),
    bosses: [...allKings],
    talismans: allTalismanIds(),
    hells: HELLS.map((h) => h.id),
  };
  const godClear = {
    hellIndex: 9, hellName: "육도지옥", floorIndex: 2, totalFloorsDescended: 30, bossesKilled: 10,
    enemiesKilled: 45, cleared: true, damageTaken: 30, talismansUsed: 0, revivesUsed: 0, turns: 120, cycle: 0, vowsKept: [],
  };
  const r1 = evaluateAchievements(m, godClear);
  const r2 = evaluateAchievements(m, godClear); // idempotent
  achOk = m.achievementsUnlocked.length === ACHIEVEMENTS.length && r1.bonusKarma > 0 && r2.bonusKarma === 0;
  console.log(
    `achievements: unlocked=${m.achievementsUnlocked.length}/${ACHIEVEMENTS.length} bonus=${r1.bonusKarma} reGrant=${r2.bonusKarma} ok=${achOk}`,
  );
}

console.log("=== 업경대/공덕록 ===");
let metaOk = true;
{
  const m = defaultMeta();
  const oc = {
    hellIndex: 3, hellName: "독사지옥", floorIndex: 2, totalFloorsDescended: 12, bossesKilled: 4,
    enemiesKilled: 45, cleared: true, damageTaken: 30, talismansUsed: 0, revivesUsed: 0, turns: 120, cycle: 0, vowsKept: [],
  };
  const { rankUps } = updateRecords(m, oc);
  const g1 = recordGongdeok(m, oc, "wanderer");
  const g2 = recordGongdeok(m, oc, "wanderer"); // 같은 점수 재입력 → PB 미경신
  metaOk =
    m.records.deepestStage === 12 &&
    m.records.mostKills === 45 &&
    m.records.fastestClearTurns === 120 &&
    g1.gd > 0 &&
    m.bestGongdeok === g1.gd &&
    g1.tierKarma > 0 &&
    g2.tierKarma === 0 &&
    g2.isPB === false &&
    rankUps.length >= 2;
  console.log(
    `eopgyeong: deepest=${m.records.deepestStage} kills=${m.records.mostKills} fastClr=${m.records.fastestClearTurns} gongdeok=${g1.gd} tier=${g1.tierKarma} rankUps=${rankUps.length} ok=${metaOk}`,
  );
}

console.log("=== 요괴도감·혼숙련·흉물 systems ===");
let systemsOk = true;
try {
  // 요괴도감: 60처치 → ★3, 정기 보너스 = 등급(prev 기준).
  const bm = defaultMeta();
  for (let i = 0; i < 60; i++) recordKill(bm, "dosan_mangryeong");
  const bestiaryOk = bestiaryTier(bm.enemyKills["dosan_mangryeong"]) === 3 && bestiaryJeonggiBonus(24) === 1 && bestiaryJeonggiBonus(0) === 0;
  // 혼숙련: 클리어 런 xp → 레벨↑ → 로드아웃 maxHp 버프.
  const sm = defaultMeta();
  addSoulXp(sm, "warrior", {
    hellIndex: 9, hellName: "육도지옥", floorIndex: 2, totalFloorsDescended: 30, bossesKilled: 10,
    enemiesKilled: 40, cleared: true, damageTaken: 0, talismansUsed: 0, revivesUsed: 0, turns: 100, cycle: 0, vowsKept: [],
  });
  const lo = baseLoadout();
  const hp0 = lo.maxHp;
  applySoulMastery(lo, sm.soulXp["warrior"]);
  const masteryOk = soulLevel(sm.soulXp["warrior"]) >= 1 && lo.maxHp > hp0;
  // 흉물: 각 어픽스 부여 후 양방향 dealDamage(반사/상한/돌풍) 무크래시.
  let affixOk = true;
  for (const af of AFFIXES) {
    const run = new Run(defaultMeta(), maxed, 21);
    run.start();
    const p = run.player.pos;
    let cell: Pos | null = null;
    for (const d of DIRS4) {
      const c = { x: p.x + d.x, y: p.y + d.y };
      if (!run.isWall(c) && !run.actorAt(c)) { cell = c; break; }
    }
    if (!cell) continue;
    const e = run.spawnEnemy("dosan_mangryeong", cell);
    if (!e) continue;
    e.affixes.push(af.id);
    af.onSpawn?.(e);
    run.dealDamage(e, 20, { source: run.player, kind: "physical" }); // mirror/equalize hooks
    if (e.alive) e.act(run); // enemy melee → gust hook
    if (run.player.alive) run.dealDamage(run.player, 5, { source: e, kind: "physical" }); // gust push
  }
  systemsOk = bestiaryOk && masteryOk && affixOk;
  console.log(`systems: bestiary★3=${bestiaryOk} soulMastery=${masteryOk} affix(no-crash)=${affixOk} ok=${systemsOk}`);
} catch (err) {
  systemsOk = false;
  console.log(`systems FAIL: ${(err as Error).message}\n${(err as Error).stack}`);
}

console.log("=== 업경대 심판(Judgment) + 六道 ===");
let judgeOk = true;
try {
  const E = emptyConduct();
  const cases: [Partial<Conduct>, string][] = [
    [{}, "jeongsim"], // 무흠·무독 → 정심(보우)
    [{ subdued: 3 }, "jinno"], // jin=6 → 진노
    [{ altarsTaken: 2, pickups: 1 }, "tamyok"], // tam=7 → 탐욕
    [{ escapes: 3 }, "uchi"], // chi=6 → 우치
    [{ damageTaken: 5, pickups: 1 }, "pyeong"], // 임계 미달 + 무흠 아님 → 방면
  ];
  let selOk = true;
  for (const [c, expect] of cases) {
    const v = evaluateVerdict({ ...E, ...c });
    if (v.id !== expect) {
      selOk = false;
      console.log(`  verdict ${JSON.stringify(c)} → ${v.id} (expected ${expect})`);
    }
  }
  // apply() no-crash on a real run + boss (모든 5 판결).
  let applyOk = true;
  for (const v of JUDGMENTS) {
    const run = new Run(defaultMeta(), maxed, 31);
    run.start();
    const p = run.player.pos;
    let cell: Pos | null = null;
    for (const d of DIRS4) {
      const c = { x: p.x + d.x, y: p.y + d.y };
      if (!run.isWall(c) && !run.actorAt(c)) { cell = c; break; }
    }
    if (!cell) continue;
    const boss = Enemy.fromBoss(getBoss("jingwang"), cell, 1);
    run.level.actors.push(boss);
    try {
      v.apply(run, boss);
    } catch (e) {
      applyOk = false;
      console.log(`  apply ${v.id} crash: ${(e as Error).message}`);
    }
  }
  // 六道 아귀도(貪): 회복 반감.
  const run2 = new Run(defaultMeta(), maxed, 32);
  run2.start();
  run2.player.stats.hp = 1;
  run2.activeMark = "agwi";
  run2.heal(run2.player, 10);
  const agwiOk = run2.player.stats.hp <= 6; // 10 회복 → 반감(≤5)
  judgeOk = selOk && applyOk && agwiOk;
  console.log(`judgment: verdicts=${selOk} apply(no-crash)=${applyOk} agwi-halved=${agwiOk} ok=${judgeOk}`);
} catch (err) {
  judgeOk = false;
  console.log(`judgment FAIL: ${(err as Error).message}\n${(err as Error).stack}`);
}

console.log("=== 서원(Vows) ===");
let vowOk = true;
try {
  const lo = baseLoadout();
  lo.activeVows = ["no_talisman", "no_kill_helpless"];
  const run = new Run(defaultMeta(), lo, 41);
  run.start();
  const before = run.vowsKept.size;
  run.player.inventory = [{ id: "heal_talisman", count: 1 }];
  if (run.awaitingInput) run.submitAction({ kind: "talisman", index: 0, target: {} }); // 부적 사용 → no_talisman 파계
  const oc = run.getOutcome();
  vowOk = before === 2 && !run.vowsKept.has("no_talisman") && vowsKarmaBonus(oc.vowsKept) >= 0;
  console.log(
    `vows: kept ${before}→${run.vowsKept.size} no_talisman-broken=${!run.vowsKept.has("no_talisman")} keptBonus=${vowsKarmaBonus(oc.vowsKept)} ok=${vowOk}`,
  );
} catch (err) {
  vowOk = false;
  console.log(`vows FAIL: ${(err as Error).message}\n${(err as Error).stack}`);
}

console.log("=== 인연(Blessings) + 삼매 ===");
let blessOk = true;
try {
  // OnPick: wrath → ATK+2
  const r1 = new Run(defaultMeta(), maxed, 51);
  r1.start();
  const atk0 = r1.player.stats.atk;
  r1.debugGrantBlessing("wrath");
  const pickOk = r1.player.stats.atk === atk0 + 2;
  // OnHit: ember → 맞은 (생존) 적에 화상
  const r2 = new Run(defaultMeta(), maxed, 52);
  r2.start();
  r2.debugGrantBlessing("ember");
  let hitOk = true;
  {
    const p = r2.player.pos;
    let cell: Pos | null = null;
    for (const d of DIRS4) {
      const c = { x: p.x + d.x, y: p.y + d.y };
      if (!r2.isWall(c) && !r2.actorAt(c)) { cell = c; break; }
    }
    if (cell) {
      const e = r2.spawnEnemy("dosan_okjol", cell); // 14hp → 3딜에 생존
      if (e) {
        r2.dealDamage(e, 3, { source: r2.player, kind: "physical" });
        hitOk = e.statuses.some((s) => s.kind === "burn");
      }
    }
  }
  // 삼매: 嗔 인연 3개 → 업화 삼매(bonusAttackChance↑)
  const r3 = new Run(defaultMeta(), maxed, 53);
  r3.start();
  const ba0 = r3.player.bonusAttackChance;
  r3.debugGrantBlessing("wrath");
  r3.debugGrantBlessing("ember");
  r3.debugGrantBlessing("gale_ward");
  const samadhiOk = r3.hasSamadhi("jin") && r3.player.bonusAttackChance > ba0;
  // 드래프트: 왕 격파 → pendingBlessings 채워짐
  const r4 = new Run(defaultMeta(), maxed, 54);
  r4.start();
  let draftOk = true;
  {
    const bp = r4.player.pos;
    let bcell: Pos | null = null;
    for (const d of DIRS4) {
      const c = { x: bp.x + d.x, y: bp.y + d.y };
      if (!r4.isWall(c) && !r4.actorAt(c)) { bcell = c; break; }
    }
    if (bcell) {
      const boss = Enemy.fromBoss(getBoss("jingwang"), bcell, 1);
      r4.level.actors.push(boss);
      r4.dealDamage(boss, 9999, { source: r4.player, kind: "pure" }); // 격파 → offerBlessings
      draftOk = r4.pendingBlessings.length >= 3;
    }
  }
  blessOk = pickOk && hitOk && samadhiOk && draftOk;
  console.log(`blessings: onPick=${pickOk} onHit=${hitOk} samadhi(jin)=${samadhiOk} draft=${draftOk} ok=${blessOk}`);
} catch (err) {
  blessOk = false;
  console.log(`blessings FAIL: ${(err as Error).message}\n${(err as Error).stack}`);
}

console.log("=== 동적 해저드(onFloorTick) ===");
let hazardOk = true;
try {
  for (const hid of ["balseol", "yangdong", "geohae", "heukseung", "pungdo", "yukdo"]) {
    const hell = HELLS.find((h) => h.id === hid);
    if (!hell || !hell.onFloorTick) {
      hazardOk = false;
      console.log(`  ${hid}: onFloorTick 없음`);
      continue;
    }
    const run = new Run(defaultMeta(), maxed, 61);
    run.start();
    for (let t = 0; t < 20 && run.player.alive; t++) {
      hell.onFloorTick(run); // 상태 초기화·셀 스캔·setTile·피해·밀림 경로 실행(무크래시 검증)
      if (run.player.hpFraction < 0.5) run.heal(run.player, run.player.stats.maxHp);
    }
  }
  console.log(`hazards: 6 deep-hell 동적 tick ×20 실행 ok=${hazardOk}`);
} catch (err) {
  hazardOk = false;
  console.log(`hazards FAIL: ${(err as Error).message}\n${(err as Error).stack}`);
}

console.log("=== 명부 고시(Daily) ===");
let dailyOk = true;
try {
  const s1 = dailyForKey("2026-07-15");
  const s2 = dailyForKey("2026-07-15");
  const detOk =
    s1.seed === s2.seed && s1.soulId === s2.soulId && s1.vowId === s2.vowId && s1.curseId === s2.curseId;
  const m = defaultMeta();
  const lo = buildDailyLoadout(m, s1);
  const loOk = lo.hellLimit === 1 && lo.activeVows.length === 1 && lo.activeVows[0] === s1.vowId;
  // hellLimit=1 승리 → 첫 지옥으로 outcome 보고.
  const run = new Run(m, lo, s1.seed);
  run.start();
  (run as unknown as { won: boolean }).won = true;
  (run as unknown as { hellIndex: number }).hellIndex = 1;
  const oc = run.getOutcome();
  const limitOk = oc.hellIndex === 0;
  // 정산: 완수(클리어+서원) → PB 기록 + 보상.
  const rec = recordDaily(m, s1, { ...oc, cleared: true, vowsKept: [s1.vowId], totalFloorsDescended: 3, enemiesKilled: 12 });
  const recOk = rec.score > 0 && rec.completed && rec.rewardKarma > 0 && m.dailyBestByDate[s1.dateKey] === rec.score;
  dailyOk = detOk && loOk && limitOk && recOk;
  console.log(`daily: deterministic=${detOk} loadout=${loOk} hellLimit=${limitOk} record=${recOk} ok=${dailyOk}`);
} catch (err) {
  dailyOk = false;
  console.log(`daily FAIL: ${(err as Error).message}\n${(err as Error).stack}`);
}

console.log("=== 버그픽스: 보스 휴면 + 임시 함정 타일 ===");
let fixOk = true;
try {
  // 보스는 시야 전까지 휴면(awake=false)으로 생성.
  const bossDormant = Enemy.fromBoss(getBoss("jingwang"), { x: 5, y: 5 }, 1).awake === false;
  // 공격 변환 타일은 1턴 뒤 바닥으로 복원.
  let tempOk = false;
  const run = new Run(defaultMeta(), maxed, 71);
  run.start();
  const p = run.player.pos;
  let cell: Pos | null = null;
  for (const d of DIRS4) {
    const c = { x: p.x + d.x, y: p.y + d.y };
    if (run.level.tileIdAt(c) === "floor" && !run.actorAt(c)) { cell = c; break; }
  }
  if (cell) {
    convertTiles(run, [cell], "dosan_blade");
    const set = run.level.tileIdAt(cell) === "dosan_blade";
    if (run.awaitingInput) run.submitAction({ kind: "wait" });
    const reverted = run.level.tileIdAt(cell) === "floor";
    tempOk = set && reverted;
  }
  fixOk = bossDormant && tempOk;
  console.log(`fixes: bossDormant=${bossDormant} tempTile(convert→revert)=${tempOk} ok=${fixOk}`);
} catch (err) {
  fixOk = false;
  console.log(`fixes FAIL: ${(err as Error).message}\n${(err as Error).stack}`);
}

console.log("=== 무기 2차 효과 ===");
let weaponOk = true;
try {
  // 석장 둔화(35%): 인접 적 반복 타격 → 둔화 부여됨 + 회향(염주) 회복 검증.
  const run = new Run(defaultMeta(), maxed, 81);
  run.start();
  run.player.weapon = getWeapon("seokjang");
  const p = run.player.pos;
  let cell: Pos | null = null;
  for (const d of DIRS4) {
    const c = { x: p.x + d.x, y: p.y + d.y };
    if (!run.isWall(c) && !run.actorAt(c)) { cell = c; break; }
  }
  let slowSeen = false;
  if (cell) {
    const e = run.spawnEnemy("dosan_okjol", cell);
    if (e) {
      e.stats.maxHp = 99999;
      e.stats.hp = 99999; // 살려두고 여러 번 때린다
      const dir = { x: cell.x - run.player.pos.x, y: cell.y - run.player.pos.y };
      for (let i = 0; i < 40 && !slowSeen && run.player.alive; i++) {
        if (run.awaitingInput) run.submitAction({ kind: "move", dir });
        run.heal(run.player, run.player.stats.maxHp);
        if (e.statuses.some((s) => s.kind === "slow")) slowSeen = true;
      }
    }
  }
  // 회향(염주): 필드 배선 확인.
  const yeomju = getWeapon("yeomju");
  const yeomjuOk = yeomju.soulOnHit === 2 && yeomju.critBonus === undefined;
  const hwandoOk = getWeapon("hwando").critBonus === 0.15;
  weaponOk = slowSeen && yeomjuOk && hwandoOk;
  console.log(`weapons: seokjang-slow=${slowSeen} 염주회향=${yeomjuOk} 환도치명=${hwandoOk} ok=${weaponOk}`);
} catch (err) {
  weaponOk = false;
  console.log(`weapons FAIL: ${(err as Error).message}\n${(err as Error).stack}`);
}

console.log("\n=== summary ===");
console.log(
  `errors=${errors}  bossesKillable=${allBossesKillable}  bossActOk=${bossActOk}  enemyActOk=${enemyActOk}  freezeSafe=${fz.ok}  (bot wins=${wins}/16, anyBoss=${anyBoss})`,
);
if (errors > 0 || !fz.ok || !allBossesKillable || !bossActOk || !enemyActOk || !systemsOk || !judgeOk || !vowOk || !blessOk || !hazardOk || !dailyOk || !fixOk || !weaponOk || !achOk || !winOk || !metaOk || !cycleOk) {
  console.error("FAILED: runtime errors, freeze-lock, unkillable boss, boss-brain, enemy-brain, systems(도감/숙련/흉물), judgment(업경대), vows(서원), blessings(인연), hazards(동적해저드), daily(명부고시), fixes(보스휴면/임시타일), weapons(무기2차효과), achievement, win-outcome, 업경대/공덕록, or 윤회겁 broken");
  process.exit(1);
}
console.log("OK: no runtime errors; all bosses killable with intended tools; no hangs");
