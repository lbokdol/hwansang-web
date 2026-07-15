import type { Pos } from "../core/grid";
import type { Faction, GameContext, Stats, StatusInstance, TelegraphMark } from "../core/types";

export interface ActorOptions {
  name: string;
  glyph: string;
  color: string;
  pos: Pos;
  stats: Stats;
  faction: Faction;
}

let NEXT_ID = 1;

/** Anything that occupies a tile and takes turns. */
export abstract class Actor {
  readonly id: number;
  name: string;
  glyph: string;
  color: string;
  pos: Pos;
  stats: Stats;
  faction: Faction;
  statuses: StatusInstance[] = [];
  alive = true;
  /** Base action speed (rot.js Speed scheduler): 100 normal, 200 fast, 50 slow. */
  baseSpeed = 100;
  /** Cells this actor will strike next turn(s); rendered as a warning overlay. */
  telegraph: TelegraphMark[] = [];
  /** True for the turn after this actor is hit (drives hit-flash FX). */
  flashTurns = 0;

  constructor(opts: ActorOptions) {
    this.id = NEXT_ID++;
    this.name = opts.name;
    this.glyph = opts.glyph;
    this.color = opts.color;
    this.pos = opts.pos;
    this.stats = opts.stats;
    this.faction = opts.faction;
  }

  get hp(): number {
    return this.stats.hp;
  }

  get isPlayer(): boolean {
    return this.faction === "player";
  }

  get isEnemy(): boolean {
    return this.faction === "enemy";
  }

  get hpFraction(): number {
    return this.stats.maxHp > 0 ? this.stats.hp / this.stats.maxHp : 0;
  }

  /** Current action speed for the scheduler (둔화 halves it). */
  getSpeed(): number {
    const slowed = this.statuses.some((s) => s.kind === "slow");
    return slowed ? Math.max(25, Math.floor(this.baseSpeed / 2)) : this.baseSpeed;
  }

  /** Called by the scheduler on this actor's turn. */
  abstract act(ctx: GameContext): void;
}
