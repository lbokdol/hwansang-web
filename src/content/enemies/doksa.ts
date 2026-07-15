// 독사지옥(毒蛇地獄) 적 4종 — 중독·출혈을 거는 신규 상태 중심 라인업.

import type { EnemyDef } from "../../core/types";
import { clearLineToPlayer, fleeFromPlayer, isAdjacent, meleeAttack, stepToward } from "../../entities/ai";

const dokssa: EnemyDef = {
  id: "doksa_dokssa",
  name: "독사",
  glyph: "독",
  color: "#8fd46b",
  hp: 7,
  atk: 3,
  def: 0,
  jeonggi: 3,
  speed: 100,
  role: "중독잡몹",
  hell: "doksa",
  act(self, ctx) {
    const p = ctx.player;
    if (isAdjacent(self.pos, p.pos)) {
      const dmg = meleeAttack(self, p, ctx);
      if (dmg > 0 && p.alive) ctx.applyStatus(p, "poison", 3, 2, self);
    } else stepToward(self, p.pos, ctx);
  },
};

const dongmugwi: EnemyDef = {
  id: "doksa_dongmugwi",
  name: "독무귀",
  glyph: "독",
  color: "#9be36b",
  hp: 6,
  atk: 2,
  def: 0,
  jeonggi: 4,
  speed: 100,
  role: "원거리중독",
  hell: "doksa",
  act(self, ctx) {
    const p = ctx.player;
    if (isAdjacent(self.pos, p.pos)) {
      fleeFromPlayer(self, ctx); // kiter: keep distance
      return;
    }
    const dir = clearLineToPlayer(self, ctx, 4);
    if (dir) {
      ctx.dealDamage(p, 2, { source: self, kind: "poison" });
      if (p.alive) ctx.applyStatus(p, "poison", 3, 2, self);
      ctx.fx.floatText(self.pos, "독무", "#9be36b");
      return;
    }
    stepToward(self, p.pos, ctx);
  },
};

const geochi: EnemyDef = {
  id: "doksa_geochi",
  name: "거치귀",
  glyph: "거",
  color: "#c08a6b",
  hp: 6,
  atk: 4,
  def: 0,
  jeonggi: 4,
  speed: 200, // 빠름 — 출혈을 쌓는 돌격형
  role: "출혈돌격",
  hell: "doksa",
  act(self, ctx) {
    const p = ctx.player;
    if (isAdjacent(self.pos, p.pos)) {
      const dmg = meleeAttack(self, p, ctx);
      if (dmg > 0 && p.alive) ctx.applyStatus(p, "bleed", 4, 2, self);
    } else stepToward(self, p.pos, ctx);
  },
};

const maghoksu: EnemyDef = {
  id: "doksa_maghoksu",
  name: "맹독수",
  glyph: "맹",
  color: "#6bbf4a",
  hp: 18,
  atk: 6,
  def: 2,
  jeonggi: 6,
  speed: 50, // 느린 독 탱커 (카이팅 대상)
  role: "중독방패",
  hell: "doksa",
  act(self, ctx) {
    const p = ctx.player;
    if (isAdjacent(self.pos, p.pos)) {
      const dmg = meleeAttack(self, p, ctx);
      if (dmg > 0 && p.alive) ctx.applyStatus(p, "poison", 4, 3, self);
    } else stepToward(self, p.pos, ctx);
  },
};

export const doksaEnemies: EnemyDef[] = [dokssa, dongmugwi, geochi, maghoksu];
