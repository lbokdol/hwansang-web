// 화탕지옥(火湯地獄) 적 4종 — 전투_상세 §6.2. 불/화상 테마.

import { DIRS4, add, type Pos } from "../../core/grid";
import {
  chasePlayer,
  clearLineToPlayer,
  fleeFromPlayer,
  isAdjacent,
  meleeAttack,
  stepToward,
} from "../../entities/ai";
import type { EnemyDef } from "../../core/types";

const hwaryeong: EnemyDef = {
  id: "hwatang_hwaryeong",
  name: "화염망령",
  glyph: "화",
  color: "#ff8a4a",
  hp: 8,
  atk: 4,
  def: 0,
  jeonggi: 2,
  speed: 100,
  role: "잡몹",
  hell: "hwatang",
  act(self, ctx) {
    // 타격 시 화상(1턴)
    if (isAdjacent(self.pos, ctx.player.pos)) {
      meleeAttack(self, ctx.player, ctx);
      ctx.applyStatus(ctx.player, "burn", 2, 2, self);
    } else {
      stepToward(self, ctx.player.pos, ctx);
    }
  },
};

const hwagwi: EnemyDef = {
  id: "hwatang_hwagwi",
  name: "화귀",
  glyph: "화",
  color: "#e8552a",
  hp: 10,
  atk: 5,
  def: 1,
  jeonggi: 5,
  speed: 100,
  role: "특수형",
  hell: "hwatang",
  act: chasePlayer,
  // 사망 시 인접 칸에 불바다 생성
  onDeath(self, ctx) {
    const cells: Pos[] = [self.pos, ...DIRS4.map((d) => add(self.pos, d))];
    for (const c of cells) {
      if (ctx.level.tileIdAt(c) === "floor") ctx.level.setTile(c, "hwatang_lava");
    }
    ctx.fx.flashCells(cells, "#ff7a3c");
  },
};

const bulnabang: EnemyDef = {
  id: "hwatang_bulnabang",
  name: "불나방",
  glyph: "불",
  color: "#ffb24a",
  hp: 5,
  atk: 3,
  def: 0,
  jeonggi: 3,
  speed: 200, // 빠름·자폭
  role: "돌격형",
  hell: "hwatang",
  act(self, ctx) {
    // 자폭: 인접하면 폭발(피해 + 화상) 후 사망
    if (isAdjacent(self.pos, ctx.player.pos)) {
      ctx.fx.flashCells([ctx.player.pos, self.pos], "#ff7a3c");
      ctx.fx.shake(4);
      ctx.dealDamage(ctx.player, self.stats.atk + 2, { source: self, kind: "fire" });
      ctx.applyStatus(ctx.player, "burn", 3, 2, self);
      ctx.killActor(self);
      return;
    }
    stepToward(self, ctx.player.pos, ctx);
  },
};

const kkeulhokjol: EnemyDef = {
  id: "hwatang_kkeulhokjol",
  name: "끓는옥졸",
  glyph: "끓",
  color: "#d4612b",
  hp: 22,
  atk: 8,
  def: 2,
  jeonggi: 5,
  speed: 50, // 느림 방패형
  role: "방패형",
  hell: "hwatang",
  act(self, ctx) {
    // 인접 시 화상 부여
    if (isAdjacent(self.pos, ctx.player.pos)) {
      meleeAttack(self, ctx.player, ctx);
      ctx.applyStatus(ctx.player, "burn", 3, 2, self);
    } else {
      stepToward(self, ctx.player.pos, ctx);
    }
  },
};

// --- v1.1 심화 ---

const hwayeomsulsa: EnemyDef = {
  id: "hwatang_hwayeomsulsa",
  name: "화염술사",
  glyph: "화",
  color: "#ff9a3c",
  hp: 7,
  atk: 3,
  def: 0,
  jeonggi: 4,
  speed: 100,
  role: "원거리화염",
  hell: "hwatang",
  act(self, ctx) {
    const p = ctx.player;
    if (isAdjacent(self.pos, p.pos)) {
      fleeFromPlayer(self, ctx);
      return;
    }
    const dir = clearLineToPlayer(self, ctx, 5);
    if (dir) {
      ctx.dealDamage(p, 4, { source: self, kind: "fire" });
      if (p.alive) ctx.applyStatus(p, "burn", 3, 2, self);
      ctx.fx.floatText(self.pos, "화염", "#ff9a3c");
      return;
    }
    stepToward(self, p.pos, ctx);
  },
};

const yongamgeobuk: EnemyDef = {
  id: "hwatang_yongamgeobuk",
  name: "용암거북",
  glyph: "용",
  color: "#c0502a",
  hp: 24,
  atk: 7,
  def: 3,
  jeonggi: 6,
  speed: 50, // 느린 화염 탱커
  role: "화염방패",
  hell: "hwatang",
  act(self, ctx) {
    if (isAdjacent(self.pos, ctx.player.pos)) {
      meleeAttack(self, ctx.player, ctx);
      ctx.applyStatus(ctx.player, "burn", 3, 2, self);
    } else stepToward(self, ctx.player.pos, ctx);
  },
};

export const hwatangEnemies: EnemyDef[] = [
  hwaryeong,
  hwagwi,
  bulnabang,
  kkeulhokjol,
  hwayeomsulsa,
  yongamgeobuk,
];
