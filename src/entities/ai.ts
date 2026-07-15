// Reusable AI building blocks. Enemy/boss `act` functions compose these so that
// fan-out content stays small and consistent.

import { DIRS4, add, eq, manhattan, type Pos } from "../core/grid";
import { rollDamage } from "../core/combat";
import { effectiveAtk, effectiveDef, hasStatus } from "../core/status";
import { bestStepToward } from "../map/path";
import type { Actor } from "./actor";
import type { Enemy } from "./enemy";
import type { DamageKind, GameContext } from "../core/types";

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
