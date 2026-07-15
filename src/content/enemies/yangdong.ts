// 양동지옥(烊銅地獄) 적 6종 — 변형/전이 테마 (깊은 court, 변성대왕).
// Port of Godot Content/EnemyContent.Yangdong().

import { DIRS8, add, chebyshev, eq } from "../../core/grid";
import type { EnemyDef } from "../../core/types";
import {
  ambushStrike,
  chasePlayer,
  isAdjacent,
  meleeAttack,
  scaleMirrorChase,
  stepToward,
} from "../../entities/ai";

// 용재귀 — 잡몹/페이스 + 분열귀 산출물.
const yongjae: EnemyDef = {
  id: "yangdong_yongjae",
  name: "용재귀",
  glyph: "용",
  color: "#c98a3a",
  hp: 8,
  atk: 4,
  def: 1,
  jeonggi: 3,
  speed: 100,
  role: "잡몹",
  hell: "yangdong",
  act: chasePlayer,
};

// 변태귀 — 시간적 약점이동: 연질(Def0)↔경화(Def4)를 주기 토글. 연질창에 버스트.
const byeontae: EnemyDef = {
  id: "yangdong_byeontae",
  name: "변태귀",
  glyph: "변",
  color: "#8fb0a4",
  hp: 16,
  atk: 5,
  def: 0,
  jeonggi: 5,
  speed: 100,
  role: "가변방패",
  hell: "yangdong",
  act(self, ctx) {
    const len = 2;
    const t = self.state.hardT ?? 0;
    self.state.hardT = t + 1;
    const phase = t % (len * 2);
    self.stats.def = phase < len ? 0 : 4; // 연질 len턴 ↔ 경화 len턴
    if (phase === len - 1 || phase === len * 2 - 1) ctx.fx.flashCells([self.pos], "#b9d6c0"); // 전환 1턴 전 예고
    chasePlayer(self, ctx);
  },
};

// 의태귀 — 위장 매복(貪): 전리품처럼 있다 인접 시 변신·매복일격 + 부적 흘림.
const uitae: EnemyDef = {
  id: "yangdong_uitae",
  name: "의태귀",
  glyph: "의",
  color: "#a8b89a",
  hp: 10,
  atk: 6,
  def: 0,
  jeonggi: 4,
  speed: 100,
  role: "貪매복",
  hell: "yangdong",
  act(self, ctx) {
    if (ambushStrike(self, ctx, "#e8a24a")) return;
    chasePlayer(self, ctx);
  },
};

// 분열귀 — 죽으면 용재귀 2로 '변성'(필드캡6, 산출물은 분열 없음=무한증식 차단).
const bunyeol: EnemyDef = {
  id: "yangdong_bunyeol",
  name: "분열귀",
  glyph: "분",
  color: "#c98a3a",
  hp: 12,
  atk: 4,
  def: 1,
  jeonggi: 5,
  speed: 100,
  role: "분열",
  hell: "yangdong",
  act: chasePlayer,
  onDeath(self, ctx) {
    const field = ctx.allEnemies().filter((e) => !e.isBoss).length;
    const n = Math.min(2, Math.max(0, 6 - field));
    const spots = DIRS8.map((d) => add(self.pos, d)).filter(
      (c) => !ctx.isWall(c) && !ctx.isBlocked(c) && !eq(c, ctx.player.pos),
    );
    for (let i = 0; i < n && i < spots.length; i++) ctx.spawnEnemy("yangdong_yongjae", spots[i]);
    if (n > 0 && spots.length > 0) ctx.fx.flashCells(spots.slice(0, n), "#e8a24a");
  },
};

// 전이귀 — 플레이어와 자리교환(2단 텔레그래프+cd): 안전지대에서 떼어내 위치압박.
const jeoni: EnemyDef = {
  id: "yangdong_jeoni",
  name: "전이귀",
  glyph: "전",
  color: "#9aa8c4",
  hp: 8,
  atk: 3,
  def: 0,
  jeonggi: 5,
  speed: 100,
  role: "교란",
  hell: "yangdong",
  act(self, ctx) {
    const p = ctx.player;
    const cd = self.state.swapCd ?? 0;
    if (cd > 0) self.state.swapCd = cd - 1;
    if (isAdjacent(self.pos, p.pos)) {
      meleeAttack(self, p, ctx);
      return;
    }
    if ((self.state.swapTel ?? 0) === 1) {
      self.state.swapTel = 0;
      const sold = { ...self.pos };
      const pold = { ...p.pos };
      self.pos = pold; // 적은 해저드 무시(직접 대입)
      ctx.moveActor(p, sold); // 플레이어는 해저드 연쇄
      self.state.swapCd = 4;
      ctx.fx.floatText(self.pos, "전이", "#9aa8c4");
      return;
    }
    if ((self.state.swapCd ?? 0) <= 0 && chebyshev(self.pos, p.pos) <= 4) {
      self.state.swapTel = 1;
      ctx.fx.flashCells([self.pos, p.pos], "#9aa8c4"); // 예고
      return;
    }
    stepToward(self, p.pos, ctx);
  },
};

// 모방귀 — 스케일 미러: Atk을 플레이어 위력에 맞춰 올린다(강화의존 처벌, 캡으로 폭주차단).
const mobang: EnemyDef = {
  id: "yangdong_mobang",
  name: "모방귀",
  glyph: "모",
  color: "#b9d6c0",
  hp: 10,
  atk: 3,
  def: 1,
  jeonggi: 5,
  speed: 100,
  role: "모방",
  hell: "yangdong",
  act(self, ctx) {
    scaleMirrorChase(self, ctx);
  },
};

export const yangdongEnemies: EnemyDef[] = [yongjae, byeontae, uitae, bunyeol, jeoni, mobang];
