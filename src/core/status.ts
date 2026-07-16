// Status-effect engine. One pipeline for debuffs (화상/빙결/중독/봉박/수면) and
// buffs (보호막/공방상승/재생). Pure functions over an Actor; the Run wires
// these into the turn loop and into damage application.

import type { Actor } from "../entities/actor";
import type { GameContext, StatusKind, StatusInstance } from "./types";

export interface StatusMeta {
  name: string;
  glyph: string;
  color: string;
  /** True for harmful statuses (UI tinting / cleanse logic). */
  bad: boolean;
}

export const STATUS_META: Record<StatusKind, StatusMeta> = {
  burn: { name: "화상", glyph: "화", color: "#ff7a3c", bad: true },
  freeze: { name: "빙결", glyph: "빙", color: "#7fd0ff", bad: true },
  poison: { name: "중독", glyph: "중", color: "#9be36b", bad: true },
  bleed: { name: "출혈", glyph: "출", color: "#e0436b", bad: true },
  slow: { name: "둔화", glyph: "둔", color: "#9a8c6b", bad: true },
  shield: { name: "결계", glyph: "결", color: "#c9b27a", bad: false },
  empower: { name: "호신", glyph: "호", color: "#ffd86b", bad: false },
  bound: { name: "봉박", glyph: "봉", color: "#b08cff", bad: true },
  sleep: { name: "진혼", glyph: "진", color: "#8c9bb0", bad: true },
  regen: { name: "위령", glyph: "위", color: "#7be0a0", bad: false },
};

const CC_KINDS: StatusKind[] = ["freeze", "bound", "sleep"];

/** Stack/refresh a status on an actor. */
export function applyStatus(
  actor: Actor,
  kind: StatusKind,
  turns: number,
  power = 1,
  source?: Actor,
  aux?: number,
): void {
  // 경직 유예: the player shrugs off chain-CC for a couple turns after a
  // freeze/bound/sleep ends — without this, freeze-on-hit patterns re-catch
  // the immobilized player every rotation and the fight is unwinnable.
  if (actor.isPlayer && CC_KINDS.includes(kind) && actor.ccGraceTurns > 0) return;
  const existing = actor.statuses.find((s) => s.kind === kind);
  if (!existing) {
    actor.statuses.push({ kind, turns, power, source, aux });
    return;
  }
  existing.turns = Math.max(existing.turns, turns);
  if (kind === "shield") {
    existing.power += power; // shield damage-pool accumulates
  } else {
    existing.power = Math.max(existing.power, power);
  }
  if (aux !== undefined) existing.aux = Math.max(existing.aux ?? 0, aux);
  if (source) existing.source = source;
}

export function hasStatus(actor: Actor, kind: StatusKind): boolean {
  return actor.statuses.some((s) => s.kind === kind);
}

export function getStatus(actor: Actor, kind: StatusKind): StatusInstance | undefined {
  return actor.statuses.find((s) => s.kind === kind);
}

export function removeStatus(actor: Actor, kind: StatusKind): void {
  // Only reassign when the status is actually present: dealDamage calls this
  // on every hit (sleep break), and an unconditional reassign would trip
  // processTurnEnd's stale-list guard every DoT tick — freezing DoT durations
  // (permanent burn/poison) and skipping the expiry filter entirely.
  if (!actor.statuses.some((s) => s.kind === kind)) return;
  actor.statuses = actor.statuses.filter((s) => s.kind !== kind);
}

/** Effective ATK including buffs (empower.power). */
export function effectiveAtk(actor: Actor): number {
  const e = getStatus(actor, "empower");
  return actor.stats.atk + (e ? e.power : 0);
}

/** Effective DEF including buffs (empower.aux). */
export function effectiveDef(actor: Actor): number {
  const e = getStatus(actor, "empower");
  return actor.stats.def + (e ? (e.aux ?? 0) : 0);
}

/**
 * Absorb incoming damage with a shield damage-pool (결계부: 최대 HP의 40%
 * 흡수). Returns the remaining damage that should reach HP, draining the pool.
 */
export function absorbWithShield(actor: Actor, dmg: number): number {
  const shield = getStatus(actor, "shield");
  if (!shield || dmg <= 0) return dmg;
  const absorbed = Math.min(dmg, shield.power);
  shield.power -= absorbed;
  if (shield.power <= 0) removeStatus(actor, "shield");
  return dmg - absorbed;
}

/**
 * Resolve statuses at the START of an actor's turn. Returns whether the actor
 * is prevented from acting this turn (빙결/봉박/수면).
 */
export function processTurnStart(actor: Actor, ctx: GameContext): { skipTurn: boolean } {
  let skip = false;
  for (const s of actor.statuses) {
    if (s.kind === "freeze" || s.kind === "bound" || s.kind === "sleep") {
      skip = true;
    }
  }
  if (skip && actor === ctx.player) {
    const why = hasStatus(actor, "freeze") ? "빙결" : hasStatus(actor, "bound") ? "봉박" : "수면";
    ctx.log(`${why} 상태로 움직일 수 없다.`, "#7fd0ff");
  }
  return { skipTurn: skip };
}

/**
 * Resolve over-time statuses at the END of an actor's turn: DoT, regen, and
 * duration decay. Call after the actor (or, for skipped actors, in their slot).
 */
export function processTurnEnd(actor: Actor, ctx: GameContext): void {
  if (!actor.alive) return;
  const list = actor.statuses;
  for (const s of list) {
    if (s.kind === "burn") ctx.dealDamage(actor, s.power, { kind: "fire", ignoreDef: true, noFx: true });
    else if (s.kind === "poison") ctx.dealDamage(actor, s.power, { kind: "poison", ignoreDef: true, noFx: true });
    else if (s.kind === "regen") ctx.heal(actor, s.power);
    // A DoT tick may have ended the run or triggered an auto-revive that
    // replaced the statuses array — stop iterating the stale list either way.
    if (!actor.alive || actor.statuses !== list) return;
    s.turns -= 1;
  }
  // All statuses (incl. sleep) decay by duration; sleep also ends early when
  // damaged (handled in dealDamage). A non-decaying status could otherwise
  // stun-lock the player forever.
  if (actor.ccGraceTurns > 0) actor.ccGraceTurns--;
  const hadCc = actor.statuses.some((s) => CC_KINDS.includes(s.kind) && s.turns <= 0);
  actor.statuses = actor.statuses.filter((s) => s.turns > 0);
  if (hadCc && actor.isPlayer) actor.ccGraceTurns = 2;
}
