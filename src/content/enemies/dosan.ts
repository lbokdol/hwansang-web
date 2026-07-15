// 도산지옥(刀山地獄) 적 4종 — 전투_상세 §6.1 정확 스탯.

import type { EnemyDef } from "../../core/types";
import {
  chasePlayer,
  fleeFromPlayer,
  isAdjacent,
  meleeAttack,
  rangedAttackPlayer,
  stepToward,
} from "../../entities/ai";

const mangryeong: EnemyDef = {
  id: "dosan_mangryeong",
  name: "망령",
  glyph: "망",
  color: "#b6c2d9",
  hp: 6,
  atk: 3,
  def: 0,
  jeonggi: 2,
  speed: 100,
  role: "잡몹",
  hell: "dosan",
  act: chasePlayer,
};

const dongsari: EnemyDef = {
  id: "dosan_dongsari",
  name: "동살이",
  glyph: "동",
  color: "#9a8e6b",
  hp: 8,
  atk: 4,
  def: 3, // 갑옷: 약공격을 1까지 깎음 (관통의 가치)
  jeonggi: 3,
  speed: 100,
  role: "갑옷잡몹",
  hell: "dosan",
  act: chasePlayer,
};

const gasikkamagwi: EnemyDef = {
  id: "dosan_gasikkamagwi",
  name: "가시까마귀",
  glyph: "가",
  color: "#7d8aa0",
  hp: 4,
  atk: 4,
  def: 0,
  jeonggi: 3,
  speed: 200, // 빠름: 플레이어 1행동당 2번
  role: "돌격형",
  hell: "dosan",
  act: chasePlayer,
};

const okjol: EnemyDef = {
  id: "dosan_okjol",
  name: "옥졸",
  glyph: "옥",
  color: "#c2b280",
  hp: 14,
  atk: 6,
  def: 2,
  jeonggi: 5,
  speed: 50, // 느림: 2턴에 1번 (카이팅 대상)
  role: "방패형",
  hell: "dosan",
  act(self, ctx) {
    // Slow shielder: bump hard if adjacent, otherwise lumber toward the player.
    if (isAdjacent(self.pos, ctx.player.pos)) meleeAttack(self, ctx.player, ctx);
    else stepToward(self, ctx.player.pos, ctx);
  },
};

// --- v1.1 심화 ---

const geomgwi: EnemyDef = {
  id: "dosan_geomgwi",
  name: "검귀",
  glyph: "검",
  color: "#cdd6e6",
  hp: 6,
  atk: 4,
  def: 0,
  jeonggi: 4,
  speed: 200, // 빠른 출혈 돌격
  role: "출혈돌격",
  hell: "dosan",
  act(self, ctx) {
    const p = ctx.player;
    if (isAdjacent(self.pos, p.pos)) {
      const dmg = meleeAttack(self, p, ctx);
      if (dmg > 0 && p.alive) ctx.applyStatus(p, "bleed", 4, 2, self);
    } else stepToward(self, p.pos, ctx);
  },
};

const bidogwi: EnemyDef = {
  id: "dosan_bidogwi",
  name: "비도귀",
  glyph: "비",
  color: "#aebacc",
  hp: 6,
  atk: 4,
  def: 0,
  jeonggi: 4,
  speed: 100,
  role: "원거리",
  hell: "dosan",
  act(self, ctx) {
    const p = ctx.player;
    if (isAdjacent(self.pos, p.pos)) {
      fleeFromPlayer(self, ctx); // kiter: back off when cornered
      return;
    }
    if (rangedAttackPlayer(self, ctx, 4, 4, "physical")) {
      ctx.fx.floatText(self.pos, "비도", "#cdd6e6");
      return;
    }
    stepToward(self, p.pos, ctx);
  },
};

export const dosanEnemies: EnemyDef[] = [mangryeong, dongsari, gasikkamagwi, okjol, geomgwi, bidogwi];
