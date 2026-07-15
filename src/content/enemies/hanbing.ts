// 한빙지옥(寒氷地獄) 적 4종 — 전투_상세 §6.3. 얼음/빙결 테마.

import { DIRS4, add, manhattan } from "../../core/grid";
import {
  chasePlayer,
  clearLineToPlayer,
  fleeFromPlayer,
  isAdjacent,
  meleeAttack,
  stepToward,
} from "../../entities/ai";
import type { EnemyDef } from "../../core/types";

const hanseolmangryeong: EnemyDef = {
  id: "hanbing_hanseol",
  name: "한설망령",
  glyph: "한",
  color: "#bcd6ec",
  hp: 12,
  atk: 5,
  def: 1,
  jeonggi: 2,
  speed: 100,
  role: "잡몹",
  hell: "hanbing",
  act: chasePlayer,
};

const eoreumjogak: EnemyDef = {
  id: "hanbing_eoreumjogak",
  name: "얼음조각",
  glyph: "얼",
  color: "#d6f0ff",
  hp: 6,
  atk: 5,
  def: 0,
  jeonggi: 3,
  speed: 200, // 빠름
  role: "돌격형",
  hell: "hanbing",
  act: chasePlayer,
  // 사망 시 둔화 안개(인접 시 속도 절반 2턴)
  onDeath(self, ctx) {
    if (manhattan(self.pos, ctx.player.pos) <= 1) {
      ctx.applyStatus(ctx.player, "slow", 2, 1, self);
      ctx.fx.floatText(ctx.player.pos, "둔화", "#9a8c6b");
    }
  },
};

const binggwi: EnemyDef = {
  id: "hanbing_binggwi",
  name: "빙귀",
  glyph: "빙",
  color: "#9fd6ff",
  hp: 14,
  atk: 6,
  def: 2,
  jeonggi: 5,
  speed: 100,
  role: "특수형",
  hell: "hanbing",
  act(self, ctx) {
    if (isAdjacent(self.pos, ctx.player.pos)) {
      meleeAttack(self, ctx.player, ctx);
      // 타격 시 빙결(1턴) — on a cooldown so it can't perma-lock.
      self.state.freezeCd = (self.state.freezeCd ?? 0) - 1;
      if ((self.state.freezeCd ?? 0) <= 0) {
        ctx.applyStatus(ctx.player, "freeze", 1, 1, self);
        self.state.freezeCd = 3;
      }
    } else {
      stepToward(self, ctx.player.pos, ctx);
    }
  },
};

const seolin: EnemyDef = {
  id: "hanbing_seolin",
  name: "설인",
  glyph: "설",
  color: "#eef7ff",
  hp: 30,
  atk: 10,
  def: 3,
  jeonggi: 5,
  speed: 50, // 느림 대형
  role: "방패형",
  hell: "hanbing",
  act(self, ctx) {
    // 주변에 얼음 타일(미끄러짐) 생성
    if (ctx.rng.chance(0.4)) {
      for (const d of DIRS4) {
        const c = add(self.pos, d);
        if (ctx.level.tileIdAt(c) === "floor" && ctx.rng.chance(0.5)) {
          ctx.level.setTile(c, "hanbing_ice");
        }
      }
    }
    if (isAdjacent(self.pos, ctx.player.pos)) meleeAttack(self, ctx.player, ctx);
    else stepToward(self, ctx.player.pos, ctx);
  },
};

// --- v1.1 심화 ---

const binggungsu: EnemyDef = {
  id: "hanbing_binggungsu",
  name: "빙궁수",
  glyph: "빙",
  color: "#a8d8ff",
  hp: 6,
  atk: 3,
  def: 0,
  jeonggi: 4,
  speed: 100,
  role: "원거리빙결",
  hell: "hanbing",
  act(self, ctx) {
    const p = ctx.player;
    if (isAdjacent(self.pos, p.pos)) {
      fleeFromPlayer(self, ctx);
      return;
    }
    const dir = clearLineToPlayer(self, ctx, 5);
    if (dir) {
      ctx.dealDamage(p, 3, { source: self, kind: "ice" });
      // 빙결 — 쿨다운으로 영구 잠금 방지 (빙귀와 동일 패턴)
      self.state.freezeCd = (self.state.freezeCd ?? 0) - 1;
      if (p.alive && (self.state.freezeCd ?? 0) <= 0) {
        ctx.applyStatus(p, "freeze", 1, 1, self);
        self.state.freezeCd = 3;
      }
      ctx.fx.floatText(self.pos, "빙시", "#a8d8ff");
      return;
    }
    stepToward(self, p.pos, ctx);
  },
};

const hanseolrang: EnemyDef = {
  id: "hanbing_hanseolrang",
  name: "한설랑",
  glyph: "한",
  color: "#cfe6ff",
  hp: 8,
  atk: 5,
  def: 0,
  jeonggi: 4,
  speed: 200, // 빠른 둔화 돌격
  role: "둔화돌격",
  hell: "hanbing",
  act(self, ctx) {
    const p = ctx.player;
    if (isAdjacent(self.pos, p.pos)) {
      const dmg = meleeAttack(self, p, ctx);
      if (dmg > 0 && p.alive) ctx.applyStatus(p, "slow", 2, 1, self);
    } else stepToward(self, p.pos, ctx);
  },
};

export const hanbingEnemies: EnemyDef[] = [
  hanseolmangryeong,
  eoreumjogak,
  binggwi,
  seolin,
  binggungsu,
  hanseolrang,
];
