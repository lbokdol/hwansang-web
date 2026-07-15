// Reusable AI building blocks. Enemy/boss `act` functions compose these so that
// fan-out content stays small and consistent.

import { DIRS4, add, chebyshev, eq, manhattan, type Pos } from "../core/grid";
import { rollDamage } from "../core/combat";
import { effectiveAtk, effectiveDef, hasStatus } from "../core/status";
import { bestStepToward } from "../map/path";
import { T_FLOOR, getTile } from "../map/tiles";
import type { Actor } from "./actor";
import type { Enemy } from "./enemy";
import type { DamageKind, GameContext, StatusKind } from "../core/types";

export function isAdjacent(a: Pos, b: Pos): boolean {
  return manhattan(a, b) === 1;
}

/** Melee strike using the standard ATK-DEF formula. Returns damage dealt. */
export function meleeAttack(attacker: Actor, target: Actor, ctx: GameContext): number {
  const dmg = rollDamage(effectiveAtk(attacker), effectiveDef(target));
  return ctx.dealDamage(target, dmg, { source: attacker, kind: "physical" });
}

/** Try to move one step toward `target`, routing around walls/actors. */
export function stepToward(self: Enemy, target: Pos, ctx: GameContext): boolean {
  const step = bestStepToward(self.pos, target, ctx.level, (p) => {
    const a = ctx.actorAt(p);
    return a != null && a !== self && !(p.x === target.x && p.y === target.y);
  });
  if (!step || eq(step, self.pos)) return false;
  if (ctx.isBlocked(step)) return false;
  return ctx.moveActor(self, step);
}

/** Default monster brain: bump the player if adjacent, otherwise approach. */
export function chasePlayer(self: Enemy, ctx: GameContext): void {
  const p = ctx.player;
  if (!p.alive) return;
  if (isAdjacent(self.pos, p.pos)) {
    meleeAttack(self, p, ctx);
  } else {
    stepToward(self, p.pos, ctx);
  }
}

/** Step to the free neighbour that maximizes distance from the player. */
export function fleeFromPlayer(self: Enemy, ctx: GameContext): boolean {
  const p = ctx.player;
  let best: Pos | null = null;
  let bestDist = manhattan(self.pos, p.pos);
  for (const d of DIRS4) {
    const n = add(self.pos, d);
    if (ctx.isWall(n) || ctx.isBlocked(n)) continue;
    const dist = manhattan(n, p.pos);
    if (dist > bestDist) {
      bestDist = dist;
      best = n;
    }
  }
  if (best) return ctx.moveActor(self, best);
  return false;
}

/** Random walk to a free neighbour. */
export function wander(self: Enemy, ctx: GameContext): boolean {
  const opts = DIRS4.map((d) => add(self.pos, d)).filter((n) => !ctx.isWall(n) && !ctx.isBlocked(n));
  if (opts.length === 0) return false;
  return ctx.moveActor(self, ctx.rng.pick(opts));
}

/**
 * If the player is on the same row/column within `range` and the line is clear
 * (no walls / other enemies between), returns the unit direction. Else null.
 */
export function clearLineToPlayer(self: Enemy, ctx: GameContext, range: number): Pos | null {
  const p = ctx.player;
  const dx = p.pos.x - self.pos.x;
  const dy = p.pos.y - self.pos.y;
  if (dx !== 0 && dy !== 0) return null;
  const dist = Math.abs(dx) + Math.abs(dy);
  if (dist === 0 || dist > range) return null;
  const dir: Pos = { x: Math.sign(dx), y: Math.sign(dy) };
  let cur = add(self.pos, dir);
  while (!eq(cur, p.pos)) {
    if (ctx.isWall(cur)) return null;
    const a = ctx.actorAt(cur);
    if (a && a !== p) return null;
    cur = add(cur, dir);
  }
  return dir;
}

/** Fire a straight-line ranged attack at the player if a clear line exists. */
export function rangedAttackPlayer(
  self: Enemy,
  ctx: GameContext,
  range: number,
  damage: number,
  kind: DamageKind = "physical",
): boolean {
  const dir = clearLineToPlayer(self, ctx, range);
  if (!dir) return false;
  ctx.dealDamage(ctx.player, damage, { source: self, kind });
  return true;
}

/** Convenience: is this actor unable to act this turn? */
export function isIncapacitated(a: Actor): boolean {
  return hasStatus(a, "freeze") || hasStatus(a, "bound") || hasStatus(a, "sleep");
}

// ============================================================================
// Deep-court (5–10지옥) shared idioms. The deep hells reuse a small set of
// behaviours (bleed-melee, 貪 disguise-ambush, 嗔 knockback, scale-mirror,
// ranged push/pull) so their 36 enemies stay data-thin like the shallow ones.
// ============================================================================

/** Unit step on the dominant axis from `from` toward `to` (4-dir). Zero if same cell. */
export function dominantStep(from: Pos, to: Pos): Pos {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return { x: 0, y: 0 };
  return Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
}

/** Melee that applies a status on a landed hit; approaches otherwise. */
export function meleeStatusChase(
  self: Enemy,
  ctx: GameContext,
  kind: StatusKind,
  turns: number,
  power: number,
): void {
  const p = ctx.player;
  if (isAdjacent(self.pos, p.pos)) {
    const dmg = meleeAttack(self, p, ctx);
    if (dmg > 0 && p.alive) ctx.applyStatus(p, kind, turns, power, self);
  } else {
    stepToward(self, p.pos, ctx);
  }
}

/** Drop a lure talisman on a free orthogonal neighbour (貪 economy hook). */
export function scatterBait(self: Enemy, ctx: GameContext, talismanId = "heal_talisman"): void {
  const spot = DIRS4.map((d) => add(self.pos, d)).find(
    (c) => ctx.level.tileIdAt(c) === T_FLOOR && !ctx.isBlocked(c) && !ctx.level.dropAt(c),
  );
  if (spot) ctx.level.drops.push({ pos: spot, talismanId });
}

/**
 * 貪 disguise-ambush: sits inert like loot until the player is adjacent, then
 * reveals with a bonus strike and scatters bait. Returns true while still
 * disguised (caller should stop), false once revealed (caller should chase).
 */
export function ambushStrike(self: Enemy, ctx: GameContext, color: string): boolean {
  if ((self.state.revealed ?? 0) !== 0) return false;
  const p = ctx.player;
  if (chebyshev(self.pos, p.pos) <= 1) {
    self.state.revealed = 1;
    ctx.fx.flashCells([self.pos], color);
    ctx.fx.shake(5);
    ctx.dealDamage(p, self.stats.atk + 2, { source: self, kind: "physical" });
    if (self.alive && p.alive) scatterBait(self, ctx);
  }
  return true; // disguised → hold position this turn
}

/**
 * 嗔 recoil: if struck last turn and adjacent, shove the player one tile away
 * (into whatever hazard lies behind them), then chase.
 */
export function recoilKnockback(self: Enemy, ctx: GameContext, color: string): void {
  const p = ctx.player;
  if (self.flashTurns > 0 && isAdjacent(self.pos, p.pos)) {
    const step = dominantStep(self.pos, p.pos); // away from self
    const to = add(p.pos, step);
    if ((step.x || step.y) && !ctx.isWall(to) && !ctx.actorAt(to)) {
      ctx.moveActor(p, to);
      ctx.fx.floatText(self.pos, "밀침", color);
    }
  }
  chasePlayer(self, ctx);
}

/** 貪 scale-mirror: matches ATK to the player's power (capped), then chases. */
export function scaleMirrorChase(self: Enemy, ctx: GameContext, lo = 3, hi = 9): void {
  self.stats.atk = Math.max(lo, Math.min(hi, ctx.playerAtk() - 1));
  chasePlayer(self, ctx);
}

/**
 * 癡 ranged gust: a clear line-shot that also shoves the player one tile further
 * along the shot direction (movement misdirection). Returns whether it fired.
 */
export function rangedGale(self: Enemy, ctx: GameContext, label: string, color: string): boolean {
  const p = ctx.player;
  const dir = clearLineToPlayer(self, ctx, 5);
  if (!dir) return false;
  ctx.dealDamage(p, Math.max(1, self.stats.atk - 1), { source: self, kind: "terrain" });
  const to = add(p.pos, dir); // self→player dir → pushed further away
  if (p.alive && !ctx.isWall(to) && !ctx.actorAt(to)) {
    ctx.moveActor(p, to);
    ctx.fx.floatText(self.pos, label, color);
  }
  return true;
}

/**
 * 嗔 ranged pull: a clear line-shot that drags the player one tile toward
 * `target` (self, or the nearest hazard). Returns whether it fired.
 */
export function rangedPull(
  self: Enemy,
  ctx: GameContext,
  target: Pos,
  damage: number,
  label: string,
  color: string,
): boolean {
  const p = ctx.player;
  const dir = clearLineToPlayer(self, ctx, 5);
  if (!dir) return false;
  ctx.dealDamage(p, Math.max(1, damage), { source: self, kind: "physical" });
  if (p.alive) {
    const step = dominantStep(p.pos, target);
    const to = add(p.pos, step);
    if ((step.x || step.y) && !ctx.isWall(to) && !ctx.actorAt(to)) ctx.moveActor(p, to);
  }
  ctx.fx.floatText(self.pos, label, color);
  return true;
}

/** Nearest tile carrying a hazard (used to drag the player toward danger). */
export function nearestHazardCell(ctx: GameContext, from: Pos): Pos | null {
  let best: Pos | null = null;
  let bestD = Infinity;
  const lvl = ctx.level;
  for (let y = 0; y < lvl.height; y++) {
    for (let x = 0; x < lvl.width; x++) {
      const p = { x, y };
      if (!getTile(lvl.tileIdAt(p)).hazard) continue;
      const d = manhattan(p, from);
      if (d > 0 && d < bestD) {
        bestD = d;
        best = p;
      }
    }
  }
  return best;
}
