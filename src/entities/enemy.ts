import { Actor } from "./actor";
import type { Pos } from "../core/grid";
import type { BossDef, EnemyDef, GameContext } from "../core/types";

/**
 * A single Enemy class drives both regular monsters and bosses. The behaviour
 * lives in the attached def's `act` function; this class only holds state.
 */
export class Enemy extends Actor {
  readonly def: EnemyDef;
  readonly boss?: BossDef;
  /** Per-actor AI scratch memory (cooldowns, target memory, charge state). */
  state: Record<string, number> = {};
  /** Boss phase (1 or 2). */
  phase = 1;
  jeonggi: number;
  /** FOV-gated activation: enemies stay inert until first seen (레벨디자인 §4.2). */
  awake = false;

  private constructor(at: Pos, def: EnemyDef, boss?: BossDef) {
    super({
      name: def.name,
      glyph: def.glyph,
      color: def.color,
      pos: at,
      faction: "enemy",
      stats: { hp: def.hp, maxHp: def.hp, atk: def.atk, def: def.def },
    });
    this.def = def;
    this.boss = boss;
    this.jeonggi = def.jeonggi;
    this.baseSpeed = def.speed ?? 100;
  }

  static fromDef(def: EnemyDef, at: Pos, scale = 1): Enemy {
    const e = new Enemy(at, def);
    if (scale !== 1) e.applyDifficultyScale(scale);
    return e;
  }

  static fromBoss(boss: BossDef, at: Pos, scale = 1): Enemy {
    // Adapt the BossDef to the EnemyDef shape so shared systems work uniformly.
    const def: EnemyDef = {
      id: boss.id,
      name: boss.name,
      glyph: boss.glyph,
      color: boss.color,
      hp: boss.hp,
      atk: boss.atk,
      def: boss.def,
      jeonggi: boss.jeonggi,
      speed: 100,
      act: boss.act,
      onDeath: boss.onDeath,
    };
    const e = new Enemy(at, def, boss);
    e.awake = true; // bosses are always active in their arena
    if (scale !== 1) e.applyDifficultyScale(scale);
    return e;
  }

  /** 단계별 난이도: scale max HP + ATK by the descent stage (랜덤 지옥 순서 대응). */
  private applyDifficultyScale(scale: number): void {
    this.stats.maxHp = Math.max(1, Math.round(this.stats.maxHp * scale));
    this.stats.hp = this.stats.maxHp;
    this.stats.atk = Math.max(1, Math.round(this.stats.atk * scale));
  }

  get isBoss(): boolean {
    return this.boss !== undefined;
  }

  override act(ctx: GameContext): void {
    this.def.act(this, ctx);
  }
}
