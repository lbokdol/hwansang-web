// Boss telegraph-pattern framework (보스패턴_상세). Each boss has a rotation of
// patterns per phase; every turn the boss resolves the pending telegraph and
// immediately telegraphs the next — always exactly 1 turn of warning (§1.1).
// `ensureDodgeable` mechanically guarantees §5: a telegraph never covers every
// escape tile (carves one open if it would).

import { DIRS4, DIRS8, add, eq, type Pos } from "../../core/grid";
import type { GameContext, StatusKind } from "../../core/types";
import type { Enemy } from "../../entities/enemy";
import { sfx } from "../../audio/sfx";

export interface BossPattern {
  name: string;
  color: string;
  build(self: Enemy, ctx: GameContext): Pos[];
  execute(self: Enemy, ctx: GameContext, cells: Pos[]): void;
}

const pending = new WeakMap<Enemy, { pattern: BossPattern; cells: Pos[] }>();

// ---- shape builders -------------------------------------------------------

export function crossAt(c: Pos, reach: number, ctx: GameContext): Pos[] {
  const out: Pos[] = [{ ...c }];
  for (const d of DIRS4) {
    for (let i = 1; i <= reach; i++) {
      const t = { x: c.x + d.x * i, y: c.y + d.y * i };
      if (ctx.isWall(t)) break;
      out.push(t);
    }
  }
  return out;
}

export function lineThrough(c: Pos, axis: "h" | "v", reach: number, ctx: GameContext): Pos[] {
  const out: Pos[] = [{ ...c }];
  const dirs = axis === "h" ? [DIRS4[2], DIRS4[3]] : [DIRS4[0], DIRS4[1]];
  for (const d of dirs) {
    for (let i = 1; i <= reach; i++) {
      const t = { x: c.x + d.x * i, y: c.y + d.y * i };
      if (ctx.isWall(t)) break;
      out.push(t);
    }
  }
  return out;
}

export function areaAt(c: Pos, half: number, ctx: GameContext): Pos[] {
  const out: Pos[] = [];
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const t = { x: c.x + dx, y: c.y + dy };
      if (!ctx.isWall(t)) out.push(t);
    }
  }
  return out;
}

export function ringAt(c: Pos, radius: number, ctx: GameContext): Pos[] {
  const out: Pos[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
      const t = { x: c.x + dx, y: c.y + dy };
      if (!ctx.isWall(t)) out.push(t);
    }
  }
  return out;
}

// ---- execute helpers ------------------------------------------------------

export function strikePlayer(
  self: Enemy,
  ctx: GameContext,
  cells: Pos[],
  dmg: number,
  kind: "physical" | "fire" | "ice",
  status?: { kind: StatusKind; turns: number; power: number },
): void {
  if (cells.some((c) => eq(c, ctx.player.pos))) {
    ctx.fx.shake(6);
    ctx.dealDamage(ctx.player, dmg, { source: self, kind });
    if (status) ctx.applyStatus(ctx.player, status.kind, status.turns, status.power, self);
  }
}

export function summonAround(self: Enemy, ctx: GameContext, defId: string, count: number, color: string): void {
  const onField = ctx.allEnemies().filter((e) => !e.isBoss).length;
  const room = Math.max(0, 3 - onField); // field cap 3 (§1.4)
  const n = Math.min(count, room);
  if (n <= 0) return;
  const spots = DIRS8.map((d) => add(self.pos, d)).filter(
    (c) => !ctx.isWall(c) && !ctx.isBlocked(c) && !eq(c, ctx.player.pos),
  );
  ctx.fx.flashCells(spots.slice(0, n), color);
  for (let i = 0; i < n && spots.length > 0; i++) {
    const s = spots.shift();
    if (s) ctx.spawnEnemy(defId, s);
  }
}

export function convertTiles(ctx: GameContext, cells: Pos[], tileId: string): void {
  for (const c of cells) if (ctx.level.tileIdAt(c) === "floor") ctx.level.setTile(c, tileId);
}

// ---- fairness net + driver ------------------------------------------------

/** Guarantee at least one reachable escape from the player's tile (§5). */
function ensureDodgeable(cells: Pos[], ctx: GameContext): Pos[] {
  const p = ctx.player.pos;
  const covered = (c: Pos) => cells.some((x) => eq(x, c));
  const neighbors = DIRS4.map((d) => add(p, d)).filter((n) => !ctx.isWall(n) && !ctx.actorAt(n));
  if (!covered(p)) return cells; // standing still is safe
  if (neighbors.some((n) => !covered(n))) return cells; // a step is safe
  if (neighbors.length === 0) return cells; // walled in — nothing we can do
  const escape = neighbors[0];
  return cells.filter((c) => !eq(c, escape));
}

/** Trigger the phase-2 transition: brief invuln + arena change, cancel telegraph. */
export function beginPhaseTransition(self: Enemy, ctx: GameContext, msg: string): void {
  self.state.invuln = 1;
  self.telegraph = [];
  pending.delete(self);
  ctx.fx.shake(10);
  sfx.bossPhase();
  ctx.log(msg, self.color);
}

export function runBoss(self: Enemy, ctx: GameContext, p1: BossPattern[], p2: BossPattern[]): void {
  // Transition turn: invulnerable, no attack (전환 무피해, §5).
  if ((self.state.invuln ?? 0) > 0) {
    self.state.invuln -= 1;
    return;
  }
  // Resolve the pending telegraph.
  const pend = pending.get(self);
  if (pend) {
    ctx.fx.flashCells(pend.cells, pend.pattern.color);
    pend.pattern.execute(self, ctx, pend.cells);
    pending.delete(self);
    self.telegraph = [];
    if (!self.alive) return;
  }
  // Telegraph the next pattern (same turn — continuous cycle).
  // 윤회겁 6+: 보스가 1페이즈부터 강화 패턴(p2)을 쓴다 (난도 등반).
  const usePhase2 = (self.phase === 2 || ctx.cycle >= 6) && p2.length > 0;
  const list = usePhase2 ? p2 : p1;
  const rot = (self.state.rot ?? -1) + 1;
  self.state.rot = rot;
  const pat = list[rot % list.length];
  const cells = ensureDodgeable(pat.build(self, ctx), ctx);
  self.telegraph = [{ cells, turnsUntil: 1, color: pat.color }];
  pending.set(self, { pattern: pat, cells });
  sfx.bossTelegraph();
  ctx.log(`${self.name} — ${pat.name}`, pat.color);
}
