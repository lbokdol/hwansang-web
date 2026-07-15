// 흑승지옥(黑繩地獄) 적 6종 — 측량/평준/저울 테마 (깊은 court, 평등대왕).
// Port of Godot Content/EnemyContent.Heukseung().

import { add } from "../../core/grid";
import { T_FLOOR } from "../../map/tiles";
import type { EnemyDef } from "../../core/types";
import {
  ambushStrike,
  chasePlayer,
  clearLineToPlayer,
  fleeFromPlayer,
  isAdjacent,
  meleeStatusChase,
  recoilKnockback,
  scaleMirrorChase,
  stepToward,
} from "../../entities/ai";

// 승령 — 잡몹/페이스 + 보스 흑승소환 산출물.
const seolryeong: EnemyDef = {
  id: "heukseung_seolryeong",
  name: "승령",
  glyph: "승",
  color: "#8a8f96",
  hp: 11,
  atk: 5,
  def: 1,
  jeonggi: 3,
  speed: 100,
  role: "잡몹",
  hell: "heukseung",
  act: chasePlayer,
};

// 열단 — Speed200 돌격 + 출혈. 빠른 압박으로 먹줄 가로지르게 강제.
const yeoldan: EnemyDef = {
  id: "heukseung_yeoldan",
  name: "열단",
  glyph: "단",
  color: "#b0b4bc",
  hp: 8,
  atk: 5,
  def: 0,
  jeonggi: 4,
  speed: 200,
  role: "돌격형",
  hell: "heukseung",
  act(self, ctx) {
    meleeStatusChase(self, ctx, "bleed", 2, 2);
  },
};

// 각자 — 癡: 원거리 소량 + 정렬된 Floor 한 칸을 먹자국으로(쓸기 모티프 예고, 회피 오독 유도).
const gakja: EnemyDef = {
  id: "heukseung_gakja",
  name: "각자",
  glyph: "각",
  color: "#7fa39a",
  hp: 7,
  atk: 3,
  def: 0,
  jeonggi: 4,
  speed: 100,
  role: "癡원거리",
  hell: "heukseung",
  act(self, ctx) {
    const p = ctx.player;
    if (isAdjacent(self.pos, p.pos)) {
      fleeFromPlayer(self, ctx);
      return;
    }
    const dir = clearLineToPlayer(self, ctx, 5);
    if (dir) {
      ctx.dealDamage(p, Math.max(1, self.stats.atk - 1), { source: self, kind: "terrain" });
      const mark = add(p.pos, dir);
      if (ctx.level.tileIdAt(mark) === T_FLOOR) ctx.level.setTile(mark, "heukseung_ink");
      ctx.fx.floatText(self.pos, "먹줄", "#7fa39a");
      return;
    }
    stepToward(self, p.pos, ctx);
  },
};

// 평준 — 嗔 넉백: 직전 피격 후 인접이면 플레이어를 밀쳐냄(밀린 곳이 활성 먹줄이면 절단).
const pyeongjun: EnemyDef = {
  id: "heukseung_pyeongjun",
  name: "평준",
  glyph: "준",
  color: "#9aa39a",
  hp: 14,
  atk: 4,
  def: 2,
  jeonggi: 5,
  speed: 100,
  role: "嗔넉백",
  hell: "heukseung",
  act(self, ctx) {
    recoilKnockback(self, ctx, "#9aa39a");
  },
};

// 경귀 — 貪 위장 매복: 전리품처럼 있다 인접 시 변신·일격 + 부적 흘림.
const gyeonggwi: EnemyDef = {
  id: "heukseung_gyeonggwi",
  name: "경귀",
  glyph: "경",
  color: "#a09a8a",
  hp: 10,
  atk: 6,
  def: 0,
  jeonggi: 4,
  speed: 100,
  role: "貪매복",
  hell: "heukseung",
  act(self, ctx) {
    if (ambushStrike(self, ctx, "#a09a8a")) return;
    chasePlayer(self, ctx);
  },
};

// 균형 — 貪 스케일미러(均衡場 잡몹판): Atk을 플레이어 위력에 맞춰(강화의존 처벌, 캡으로 폭주차단).
const gyunhyeong: EnemyDef = {
  id: "heukseung_gyunhyeong",
  name: "균형",
  glyph: "균",
  color: "#7fa39a",
  hp: 10,
  atk: 3,
  def: 1,
  jeonggi: 5,
  speed: 100,
  role: "貪모방",
  hell: "heukseung",
  act(self, ctx) {
    scaleMirrorChase(self, ctx);
  },
};

export const heukseungEnemies: EnemyDef[] = [
  seolryeong,
  yeoldan,
  gakja,
  pyeongjun,
  gyeonggwi,
  gyunhyeong,
];
