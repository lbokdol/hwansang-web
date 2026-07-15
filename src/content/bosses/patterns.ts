// Boss telegraph-pattern framework (보스패턴_상세). Each boss has a rotation of
// patterns per phase; every turn the boss resolves the pending telegraph and
// immediately telegraphs the next — always exactly 1 turn of warning (§1.1).
// `ensureDodgeable` mechanically guarantees §5: a telegraph never covers every
// escape tile (carves one open if it would).

import { DIRS4, DIRS8, add, eq, manhattan, type Pos } from "../../core/grid";
import { T_STAIRS } from "../../map/tiles";
import type { DamageKind, GameContext, StatusKind } from "../../core/types";
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
  kind: DamageKind,
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

/**
 * Turn telegraph cells into hazard tiles — but only every other cell, so a
 * boss leaves at most half its telegraph as lingering traps (the strike damage
 * still lands on every cell via strikePlayer). Matches Godot's balance pass.
 */
export function convertTiles(ctx: GameContext, cells: Pos[], tileId: string): void {
  for (let i = 0; i < cells.length; i++) {
    if ((i & 1) === 0 && ctx.level.tileIdAt(cells[i]) === "floor") ctx.level.setTile(cells[i], tileId);
  }
}

// ---- deep-court (5–10대왕) primitives --------------------------------------

/** 거울왕 위치 미러링: point-reflect the player across the boss (거울상). */
export function mirrorAcross(boss: Pos, player: Pos): Pos {
  return { x: 2 * boss.x - player.x, y: 2 * boss.y - player.y };
}

/** Unit step on the dominant axis from `from` toward `to` (4-dir). */
export function domStep(from: Pos, to: Pos): Pos {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
}

/**
 * 거울 반사장 (염라대왕): light a mirror field for `turns` boss-turns. The reflect
 * itself is enforced in Run.dealDamage (frac ‰ of the player's hit, capped),
 * and decayed 1/turn by runBoss so a no-mirror burst window is guaranteed.
 */
export function raiseMirror(self: Enemy, ctx: GameContext, turns: number, cap: number, frac: number): void {
  self.state.mirror = turns;
  self.state.mirrorCap = cap;
  self.state.mirrorFrac = frac;
  ctx.fx.flashCells(ringAt(self.pos, 1, ctx), "#c4b9e0");
  ctx.log("경면이 곤두선다 — 반사장", "#c4b9e0");
}

/**
 * 均衡場 (평등대왕): for `turns` boss-turns, cap the player's single hit on the
 * boss at `cap` (excess vanishes). Enforced in Run.dealDamage, decayed 1/turn.
 */
export function equalizeField(self: Enemy, ctx: GameContext, turns: number, cap: number): void {
  self.state.equalize = turns;
  self.state.evenCap = cap;
  ctx.fx.flashCells(ringAt(self.pos, 1, ctx), "#7fa39a");
  ctx.log("저울이 기운다 — 균형장", "#7fa39a");
}

/** 견인 (태산대왕): drag the player up to `maxCells` tiles toward the boss along the dominant axis. */
export function hookPull(self: Enemy, ctx: GameContext, maxCells: number): void {
  const p = ctx.player;
  for (let i = 0; i < maxCells; i++) {
    const step = domStep(p.pos, self.pos);
    if (!step.x && !step.y) break;
    const to = add(p.pos, step);
    const occ = ctx.actorAt(to);
    if (ctx.isWall(to) || eq(to, self.pos) || (occ && occ !== p)) break;
    if (!ctx.moveActor(p, to) || !p.alive) break;
  }
}

/** 구동 (도시대왕): shove the player `maxCells` tiles along a fixed `dir` (HookPull's mirror). */
export function gustDrive(self: Enemy, ctx: GameContext, dir: Pos, maxCells: number): void {
  const p = ctx.player;
  if (!dir.x && !dir.y) return;
  if (manhattan(self.pos, p.pos) <= 1) return; // 점착 무구동
  for (let i = 0; i < maxCells; i++) {
    const to = add(p.pos, dir);
    const occ = ctx.actorAt(to);
    if (ctx.isWall(to) || eq(to, self.pos) || (occ && occ !== p)) break;
    if (!ctx.moveActor(p, to) || !p.alive) break;
  }
}

/** BFS to the nearest open, non-stairs floor from `anchor` (deterministic landing). */
function nearestOpenFloor(ctx: GameContext, anchor: Pos): Pos | null {
  const seen = new Set<string>([`${anchor.x},${anchor.y}`]);
  const q: Pos[] = [anchor];
  while (q.length > 0) {
    const c = q.shift() as Pos;
    const occ = ctx.actorAt(c);
    if (
      ctx.level.inBounds(c.x, c.y) &&
      !ctx.isWall(c) &&
      (!occ || occ === ctx.player) &&
      ctx.level.tileIdAt(c) !== T_STAIRS
    ) {
      return c;
    }
    for (const d of DIRS4) {
      const n = add(c, d);
      const k = `${n.x},${n.y}`;
      if (ctx.level.inBounds(n.x, n.y) && !seen.has(k)) {
        seen.add(k);
        q.push(n);
      }
    }
  }
  return null;
}

/** 재배치 (도시대왕): teleport the player to a deterministic safe anchor ("늘 같은 자리"). */
export function relocate(_self: Enemy, ctx: GameContext, anchor: Pos): void {
  const dest = nearestOpenFloor(ctx, anchor);
  if (dest && !eq(dest, ctx.player.pos)) ctx.moveActor(ctx.player, dest);
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

/** Resolve the pending telegraph (execute its effect). Returns false if the boss died. */
function resolvePending(self: Enemy, ctx: GameContext): boolean {
  const pend = pending.get(self);
  if (pend) {
    ctx.fx.flashCells(pend.cells, pend.pattern.color);
    pend.pattern.execute(self, ctx, pend.cells);
    pending.delete(self);
    self.telegraph = [];
  }
  return self.alive;
}

/** Telegraph the next pattern from `list` (exactly 1 turn of warning). */
function telegraphNext(self: Enemy, ctx: GameContext, list: BossPattern[]): void {
  const rot = (self.state.rot ?? -1) + 1;
  self.state.rot = rot;
  const pat = list[rot % list.length];
  const cells = ensureDodgeable(pat.build(self, ctx), ctx);
  self.telegraph = [{ cells, turnsUntil: 1, color: pat.color }];
  pending.set(self, { pattern: pat, cells });
  sfx.bossTelegraph();
  ctx.log(`${self.name} — ${pat.name}`, pat.color);
}

/**
 * 거울(반사)·균형장(피해상한) 타이밍필드 감쇠 — 회전당 1씩 줄어 무반사·무캡 자유타
 * 창을 보장. runBoss/runBossForms 공용 (형상-순환 보스가 폼을 넘어 필드를 유지하지 않도록).
 */
function decayTimingFields(self: Enemy): void {
  if ((self.state.mirror ?? 0) > 0) self.state.mirror -= 1;
  if ((self.state.equalize ?? 0) > 0) self.state.equalize -= 1;
}

export function runBoss(self: Enemy, ctx: GameContext, p1: BossPattern[], p2: BossPattern[]): void {
  // Transition turn: invulnerable, no attack (전환 무피해, §5).
  if ((self.state.invuln ?? 0) > 0) {
    self.state.invuln -= 1;
    return;
  }
  decayTimingFields(self);
  if (!resolvePending(self, ctx)) return;
  // 윤회겁 6+: 보스가 1페이즈부터 강화 패턴(p2)을 쓴다 (난도 등반).
  const usePhase2 = (self.phase === 2 || ctx.cycle >= 6) && p2.length > 0;
  telegraphNext(self, ctx, usePhase2 ? p2 : p1);
}

// ---- 형상교체 보스 (변성대왕 / 전륜대왕) ----------------------------------

/** One shape of a form-shifting boss — glyph, colour, stat mods, and pattern rotations. */
export interface BossForm {
  glyph: string;
  color: string;
  atkMod: number;
  defMod: number;
  p1: BossPattern[];
  p2: BossPattern[];
}

function beginFormShift(self: Enemy, ctx: GameContext, forms: BossForm[], shiftMsg: string): void {
  self.stats.atk -= self.state.formAtkMod ?? 0; // undo the outgoing form's mods
  self.stats.def -= self.state.formDefMod ?? 0;
  const next = ((self.state.form ?? 0) + 1) % forms.length;
  const f = forms[next];
  self.stats.atk += f.atkMod;
  self.stats.def += f.defMod;
  self.state.formAtkMod = f.atkMod;
  self.state.formDefMod = f.defMod;
  self.state.form = next;
  self.state.formAge = 0;
  self.state.mirror = 0; // 형상 경계에서 타이밍필드 이월 금지 (형상 격리)
  self.state.equalize = 0;
  self.glyph = f.glyph;
  self.color = f.color;
  self.telegraph = [];
  pending.delete(self);
  self.state.shiftPause = 1; // 그 턴 무행동·피격가능 (무적 아님 — 진짜 가격창)
  sfx.bossPhase();
  ctx.log(shiftMsg, f.color);
}

/**
 * A boss whose form time-cycles (on reaching `formLen` turns), swapping glyph,
 * colour, stats, and pattern rotation wholesale. The shift is a 1-turn no-action
 * (not invuln) — a real punish window. (변성대왕 / 전륜대왕)
 */
export function runBossForms(
  self: Enemy,
  ctx: GameContext,
  forms: BossForm[],
  shiftMsg = "형상이 뒤바뀐다",
): void {
  if ((self.state.invuln ?? 0) > 0) {
    self.state.invuln -= 1;
    return;
  }
  if ((self.state.formInit ?? 0) === 0) {
    const f0 = forms[0];
    self.stats.atk += f0.atkMod;
    self.stats.def += f0.defMod;
    self.state.formAtkMod = f0.atkMod;
    self.state.formDefMod = f0.defMod;
    self.glyph = f0.glyph;
    self.color = f0.color;
    self.state.formInit = 1;
  }
  if ((self.state.shiftPause ?? 0) > 0) {
    self.state.shiftPause -= 1;
    return; // 무행동·피격가능
  }
  decayTimingFields(self);
  if (!resolvePending(self, ctx)) return;

  const age = (self.state.formAge ?? 0) + 1;
  const len = self.state.formLen ?? 4;
  if (age >= len) {
    beginFormShift(self, ctx, forms, shiftMsg);
    return; // 형상교체 → 다음 턴 가격창
  }
  self.state.formAge = age;

  const f = forms[(self.state.form ?? 0) % forms.length];
  const usePhase2 = (self.phase === 2 || ctx.cycle >= 6) && f.p2.length > 0;
  telegraphNext(self, ctx, usePhase2 ? f.p2 : f.p1);
}
