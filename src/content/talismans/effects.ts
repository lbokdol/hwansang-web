// Shared helpers for talisman effects, so each 부적 def stays a few lines.

import { add, chebyshev, eq, type Pos } from "../../core/grid";
import type { DamageKind, GameContext } from "../../core/types";
import type { Enemy } from "../../entities/enemy";

/** Attack-talisman damage = round(player ATK × mult). Always ignores DEF. */
export function atkScaled(ctx: GameContext, mult: number): number {
  return Math.max(1, Math.round(ctx.playerAtk() * mult));
}

/** Tiles in a straight line from the player along `dir`, up to `len`. */
export function lineFromPlayer(
  ctx: GameContext,
  dir: Pos,
  len: number,
  stopAtWall = true,
): Pos[] {
  return ctx.raycastTiles(ctx.player.pos, dir, len, { stopAtWall });
}

/** Enemies standing on any of the given tiles. */
export function enemiesOnTiles(ctx: GameContext, tiles: Pos[]): Enemy[] {
  const out: Enemy[] = [];
  for (const t of tiles) {
    const e = ctx.enemyAt(t);
    if (e) out.push(e);
  }
  return out;
}

/** Enemies within Chebyshev radius `r` of a center (8-dir blast). */
export function enemiesAround(ctx: GameContext, center: Pos, r: number): Enemy[] {
  return ctx.allEnemies().filter((e) => chebyshev(e.pos, center) <= r && !eq(e.pos, center));
}

export function damageTiles(
  ctx: GameContext,
  tiles: Pos[],
  amount: number,
  kind: DamageKind,
): number {
  let total = 0;
  for (const e of enemiesOnTiles(ctx, tiles)) {
    total += ctx.dealDamage(e, amount, { source: ctx.player, kind });
  }
  return total;
}

export { add };
