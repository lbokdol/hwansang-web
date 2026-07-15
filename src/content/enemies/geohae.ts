// 거해지옥(鋸解地獄) 적 6종 — 절단/견인/분해 테마 (깊은 court, 태산대왕).
// Port of Godot Content/EnemyContent.Geohae().

import type { EnemyDef } from "../../core/types";
import {
  ambushStrike,
  chasePlayer,
  fleeFromPlayer,
  isAdjacent,
  meleeStatusChase,
  nearestHazardCell,
  rangedPull,
  recoilKnockback,
  stepToward,
} from "../../entities/ai";

// 거령 — 잡몹/페이스 + 보스 형리소환 산출물. 인접 출혈.
const georyeong: EnemyDef = {
  id: "geohae_georyeong",
  name: "거령",
  glyph: "령",
  color: "#9aa0a8",
  hp: 9,
  atk: 4,
  def: 1,
  jeonggi: 3,
  speed: 100,
  role: "잡몹",
  hell: "geohae",
  act(self, ctx) {
    meleeStatusChase(self, ctx, "bleed", 3, 2);
  },
};

// 양단귀 — Speed200 돌격, 인접 출혈. 빠른 압박으로 레일 가로지르게 강제.
const yangdan: EnemyDef = {
  id: "geohae_yangdan",
  name: "양단귀",
  glyph: "단",
  color: "#c0c6cc",
  hp: 7,
  atk: 5,
  def: 0,
  jeonggi: 4,
  speed: 200,
  role: "돌격형",
  hell: "geohae",
  act(self, ctx) {
    meleeStatusChase(self, ctx, "bleed", 2, 2);
  },
};

// 갈고리귀 — 嗔: 직선 정렬 시 플레이어를 가장 가까운 위험 지형 쪽으로 견인(보스 견인의 잡몹판).
const galgori: EnemyDef = {
  id: "geohae_galgori",
  name: "갈고리귀",
  glyph: "구",
  color: "#b86a6a",
  hp: 6,
  atk: 3,
  def: 0,
  jeonggi: 4,
  speed: 100,
  role: "嗔견인",
  hell: "geohae",
  act(self, ctx) {
    const p = ctx.player;
    if (isAdjacent(self.pos, p.pos)) {
      fleeFromPlayer(self, ctx);
      return;
    }
    const rail = nearestHazardCell(ctx, p.pos) ?? self.pos;
    if (rangedPull(self, ctx, rail, self.stats.atk - 1, "갈고리", "#b86a6a")) return;
    stepToward(self, p.pos, ctx);
  },
};

// 반동거치 — 嗔 넉백: 직전 피격 후 인접이면 회전 반동으로 밀쳐냄(밀린 곳이 톱날이면 분쇄).
const bandong: EnemyDef = {
  id: "geohae_bandong",
  name: "반동거치",
  glyph: "반",
  color: "#b86a6a",
  hp: 14,
  atk: 4,
  def: 2,
  jeonggi: 5,
  speed: 100,
  role: "嗔넉백",
  hell: "geohae",
  act(self, ctx) {
    recoilKnockback(self, ctx, "#b86a6a");
  },
};

// 미혹귀 — 貪 위장 매복: 전리품처럼 있다 인접 시 변신·일격 + 부적 흘림.
const mihok: EnemyDef = {
  id: "geohae_mihok",
  name: "미혹귀",
  glyph: "혹",
  color: "#a8a098",
  hp: 10,
  atk: 6,
  def: 0,
  jeonggi: 4,
  speed: 100,
  role: "貪매복",
  hell: "geohae",
  act(self, ctx) {
    if (ambushStrike(self, ctx, "#a8a098")) return;
    chasePlayer(self, ctx);
  },
};

// 거악졸 — Speed50 분해 탱커. 느린 벽으로 우회 강제 → 이동톱날·견인·넉백 그물로 몬다.
const geoak: EnemyDef = {
  id: "geohae_geoak",
  name: "거악졸",
  glyph: "악",
  color: "#6b7280",
  hp: 24,
  atk: 7,
  def: 3,
  jeonggi: 6,
  speed: 50,
  role: "방패형",
  hell: "geohae",
  act(self, ctx) {
    meleeStatusChase(self, ctx, "bleed", 4, 3);
  },
};

export const geohaeEnemies: EnemyDef[] = [georyeong, yangdan, galgori, bandong, mihok, geoak];
