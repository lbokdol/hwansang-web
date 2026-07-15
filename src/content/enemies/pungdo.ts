// 풍도지옥(風途地獄) 적 6종 — 바람/밀림 테마 (깊은 court, 도시대왕).
// Port of Godot Content/EnemyContent.Pungdo().

import { add, chebyshev, eq } from "../../core/grid";
import type { EnemyDef } from "../../core/types";
import {
  ambushStrike,
  chasePlayer,
  dominantStep,
  fleeFromPlayer,
  isAdjacent,
  meleeAttack,
  meleeStatusChase,
  rangedGale,
  recoilKnockback,
  stepToward,
} from "../../entities/ai";

// 풍령 — 잡몹/페이스 + 보스 풍령소환 산출물.
const pungnyeong: EnemyDef = {
  id: "pungdo_pungnyeong",
  name: "풍령",
  glyph: "풍",
  color: "#b6b29a",
  hp: 12,
  atk: 5,
  def: 1,
  jeonggi: 3,
  speed: 100,
  role: "잡몹",
  hell: "pungdo",
  act: chasePlayer,
};

// 질풍 — Spd200 돌격 + 출혈. 빠른 압박으로 플레이어가 바람길을 가로지르게 강제.
const jilpung: EnemyDef = {
  id: "pungdo_jilpung",
  name: "질풍",
  glyph: "질",
  color: "#cfc79c",
  hp: 8,
  atk: 5,
  def: 0,
  jeonggi: 4,
  speed: 200,
  role: "돌격형",
  hell: "pungdo",
  act(self, ctx) {
    meleeStatusChase(self, ctx, "bleed", 2, 2);
  },
};

// 돌풍 — 嗔 넉백: 직전 피격 후 인접이면 플레이어를 밀쳐냄(밀린 곳이 기류면 다음 흐름이 더 실어나름).
const dolpung: EnemyDef = {
  id: "pungdo_dolpung",
  name: "돌풍",
  glyph: "돌",
  color: "#c2b58f",
  hp: 14,
  atk: 4,
  def: 2,
  jeonggi: 5,
  speed: 100,
  role: "嗔넉백",
  hell: "pungdo",
  act(self, ctx) {
    recoilKnockback(self, ctx, "#c2b58f");
  },
};

// 매복귀 — 貪 위장 매복: 전리품처럼 있다 인접 시 변신·일격 + 부적 흘림.
const maebok: EnemyDef = {
  id: "pungdo_maebok",
  name: "매복귀",
  glyph: "매",
  color: "#a89e84",
  hp: 10,
  atk: 6,
  def: 0,
  jeonggi: 4,
  speed: 100,
  role: "貪매복",
  hell: "pungdo",
  act(self, ctx) {
    if (ambushStrike(self, ctx, "#a89e84")) return;
    chasePlayer(self, ctx);
  },
};

// 풍술사 — 癡 원거리 + 역풍: 조준선상이면 소량 피해 + 플레이어를 시전자 반대쪽으로 1칸 밀어(이동 오독 유도).
const pungsul: EnemyDef = {
  id: "pungdo_pungsul",
  name: "풍술사",
  glyph: "술",
  color: "#c9b98a",
  hp: 7,
  atk: 3,
  def: 0,
  jeonggi: 4,
  speed: 100,
  role: "癡원거리",
  hell: "pungdo",
  act(self, ctx) {
    const p = ctx.player;
    if (isAdjacent(self.pos, p.pos)) {
      fleeFromPlayer(self, ctx);
      return;
    }
    if (rangedGale(self, ctx, "역풍", "#c9b98a")) return;
    stepToward(self, p.pos, ctx);
  },
};

// 회오리 — 嗔 재배치(王 시그니처 잡몹 프리뷰): 1턴 예고 후 우세축으로 최대 2칸 견인(cd4). 스턴 아님.
const hoeori: EnemyDef = {
  id: "pungdo_hoeori",
  name: "회오리",
  glyph: "회",
  color: "#b9ad86",
  hp: 10,
  atk: 4,
  def: 1,
  jeonggi: 5,
  speed: 100,
  role: "嗔재배치",
  hell: "pungdo",
  act(self, ctx) {
    const p = ctx.player;
    if ((self.state.reelCd ?? 0) > 0) self.state.reelCd = (self.state.reelCd ?? 0) - 1;
    if (isAdjacent(self.pos, p.pos)) {
      meleeAttack(self, p, ctx);
      return;
    }
    if ((self.state.reelTel ?? 0) === 1) {
      self.state.reelTel = 0;
      self.state.reelCd = 4;
      for (let i = 0; i < 2; i++) {
        // 우세축 견인 (HookPull 관용구 인라인)
        const step = dominantStep(p.pos, self.pos);
        if (!step.x && !step.y) break;
        const to = add(p.pos, step);
        if (ctx.isWall(to) || eq(to, self.pos) || ctx.actorAt(to)) break;
        if (!ctx.moveActor(p, to) || !p.alive) break;
      }
      ctx.fx.floatText(self.pos, "회오리", "#b9ad86");
      return;
    }
    if ((self.state.reelCd ?? 0) <= 0 && chebyshev(self.pos, p.pos) <= 4) {
      self.state.reelTel = 1;
      ctx.fx.flashCells([self.pos, p.pos], "#b9ad86"); // 예고
      return;
    }
    stepToward(self, p.pos, ctx);
  },
};

export const pungdoEnemies: EnemyDef[] = [pungnyeong, jilpung, dolpung, maebok, pungsul, hoeori];
