// 육도지옥(六道 / 五道轉輪) 적 6종 — 윤회/바퀴 테마 (피날레, 전륜대왕).
// Port of Godot Content/EnemyContent.Yukdo().

import { DIRS4, add } from "../../core/grid";
import type { EnemyDef } from "../../core/types";
import {
  ambushStrike,
  chasePlayer,
  fleeFromPlayer,
  isAdjacent,
  meleeAttack,
  meleeStatusChase,
  rangedGale,
  recoilKnockback,
  stepToward,
} from "../../entities/ai";

// 윤혼 — 잡몹/페이스 + 보스 소환 산출물(피날레 잡몹 HP 사다리 상단).
const yunhon: EnemyDef = {
  id: "yukdo_yunhon",
  name: "윤혼",
  glyph: "혼",
  color: "#b9a86a",
  hp: 13,
  atk: 5,
  def: 1,
  jeonggi: 3,
  speed: 100,
  role: "잡몹",
  hell: "yukdo",
  act: chasePlayer,
};

// 돌라 — Spd200 돌격 + 출혈.
const dolla: EnemyDef = {
  id: "yukdo_dolla",
  name: "돌라",
  glyph: "돌",
  color: "#d8c88a",
  hp: 9,
  atk: 6,
  def: 0,
  jeonggi: 4,
  speed: 200,
  role: "돌격형",
  hell: "yukdo",
  act(self, ctx) {
    meleeStatusChase(self, ctx, "bleed", 2, 2);
  },
};

// 아영 — 貪 위장 매복.
const agnyeong: EnemyDef = {
  id: "yukdo_agnyeong",
  name: "아영",
  glyph: "아",
  color: "#a89a6a",
  hp: 11,
  atk: 6,
  def: 0,
  jeonggi: 4,
  speed: 100,
  role: "貪매복",
  hell: "yukdo",
  act(self, ctx) {
    if (ambushStrike(self, ctx, "#a89a6a")) return;
    chasePlayer(self, ctx);
  },
};

// 치혼 — 癡 원거리 + 밀치기.
const chihon: EnemyDef = {
  id: "yukdo_chihon",
  name: "치혼",
  glyph: "치",
  color: "#c2b884",
  hp: 8,
  atk: 4,
  def: 0,
  jeonggi: 4,
  speed: 100,
  role: "癡원거리",
  hell: "yukdo",
  act(self, ctx) {
    const p = ctx.player;
    if (isAdjacent(self.pos, p.pos)) {
      fleeFromPlayer(self, ctx);
      return;
    }
    if (rangedGale(self, ctx, "밀침", "#c2b884")) return;
    stepToward(self, p.pos, ctx);
  },
};

// 진괴 — 嗔 넉백(직전 피격 후 인접이면 밀쳐냄).
const jingwe: EnemyDef = {
  id: "yukdo_jingwe",
  name: "진괴",
  glyph: "진",
  color: "#c0a860",
  hp: 15,
  atk: 4,
  def: 2,
  jeonggi: 5,
  speed: 100,
  role: "嗔넉백",
  hell: "yukdo",
  act(self, ctx) {
    recoilKnockback(self, ctx, "#c0a860");
  },
};

// 윤괴 — 嗔 회전 재배치(王 시그니처 잡몹 프리뷰): 인접 시 바퀴처럼 회전하는 방위로 밀쳐냄(spoke 순환), 못 밀면 타격.
const yungwe: EnemyDef = {
  id: "yukdo_yungwe",
  name: "윤괴",
  glyph: "윤",
  color: "#c9a84a",
  hp: 11,
  atk: 4,
  def: 1,
  jeonggi: 5,
  speed: 100,
  role: "嗔회전",
  hell: "yukdo",
  act(self, ctx) {
    const p = ctx.player;
    const spoke = self.state.spoke ?? 0;
    self.state.spoke = (spoke + 1) % 4;
    if (isAdjacent(self.pos, p.pos)) {
      const dir = DIRS4[spoke % 4];
      const to = add(p.pos, dir);
      if (!ctx.isWall(to) && !ctx.actorAt(to)) {
        ctx.moveActor(p, to);
        ctx.fx.floatText(self.pos, "윤회", "#c9a84a");
        return;
      }
      meleeAttack(self, p, ctx);
      return;
    }
    chasePlayer(self, ctx);
  },
};

export const yukdoEnemies: EnemyDef[] = [yunhon, dolla, agnyeong, chihon, jingwe, yungwe];
