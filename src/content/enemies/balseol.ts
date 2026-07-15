// 발설지옥(拔舌地獄) 적 6종 — 거울/되울림/三毒 유혹 (깊은 court, 염라대왕).
// Port of Godot Content/EnemyContent.Balseol().

import { DIRS4, add, chebyshev } from "../../core/grid";
import { hasStatus } from "../../core/status";
import { T_FLOOR } from "../../map/tiles";
import type { EnemyDef } from "../../core/types";
import {
  chasePlayer,
  fleeFromPlayer,
  isAdjacent,
  isIncapacitated,
  meleeAttack,
  rangedPull,
  stepToward,
} from "../../entities/ai";

// 결계잡령 — 嗔 유혹: 무력화(빙결·봉박·수면)로 결계 갱신을 끊어야 죽일 창이 열린다.
const gyeollyeong: EnemyDef = {
  id: "balseol_gyeollyeong",
  name: "결계잡령",
  glyph: "결",
  color: "#b9a8d8",
  hp: 10,
  atk: 5,
  def: 1,
  jeonggi: 5,
  speed: 100,
  role: "진결계",
  hell: "balseol",
  act(self, ctx) {
    if (!isIncapacitated(self) && !hasStatus(self, "shield")) ctx.applyStatus(self, "shield", 2, 4);
    chasePlayer(self, ctx);
  },
};

// 재물귀 — 貪 시험: 부적을 흘려 욕심을 부추기며 달아난다. 주우면 貪.
const jaemulgwi: EnemyDef = {
  id: "balseol_jaemulgwi",
  name: "재물귀",
  glyph: "재",
  color: "#d8c27a",
  hp: 6,
  atk: 2,
  def: 0,
  jeonggi: 5,
  speed: 200,
  role: "탐미끼",
  hell: "balseol",
  act(self, ctx) {
    const cd = self.state.scatterCd ?? 0;
    if (cd > 0) self.state.scatterCd = cd - 1;
    if (chebyshev(self.pos, ctx.player.pos) <= 3 && (self.state.scatterCd ?? 0) <= 0) {
      const spot = DIRS4.map((d) => add(self.pos, d)).find(
        (c) => ctx.level.tileIdAt(c) === T_FLOOR && !ctx.isBlocked(c) && !ctx.level.dropAt(c),
      );
      if (spot) {
        ctx.level.drops.push({ pos: spot, talismanId: "heal_talisman" });
        ctx.fx.floatText(self.pos, "재물", "#ffd86b");
        self.state.scatterCd = 3;
      }
    }
    fleeFromPlayer(self, ctx);
  },
};

// 거울분신 — 癡/되울림: 플레이어 직전 이동을 복제. (거울왕 소환이 재사용하는 동일 def)
const geoulbunsin: EnemyDef = {
  id: "balseol_geoulbunsin",
  name: "거울분신",
  glyph: "분",
  color: "#c4b9e0",
  hp: 8,
  atk: 4,
  def: 0,
  jeonggi: 4,
  speed: 100,
  role: "치거울",
  hell: "balseol",
  act(self, ctx) {
    if (isAdjacent(self.pos, ctx.player.pos)) {
      meleeAttack(self, ctx.player, ctx);
      return;
    }
    const facing = ctx.player.facing ?? { x: 0, y: 0 };
    const np = add(self.pos, facing); // 직전 이동 복제
    if ((facing.x || facing.y) && !ctx.isWall(np) && !ctx.isBlocked(np)) ctx.moveActor(self, np);
    else chasePlayer(self, ctx);
  },
};

// 외침꾼 — 嗔/군집각성: 휴면 잡몹을 깨우고 달아난다. 우선 침묵 유도.
const oechimkkun: EnemyDef = {
  id: "balseol_oechimkkun",
  name: "외침꾼",
  glyph: "외",
  color: "#d98aa0",
  hp: 12,
  atk: 3,
  def: 1,
  jeonggi: 6,
  speed: 100,
  role: "진각성",
  hell: "balseol",
  act(self, ctx) {
    const cd = self.state.shoutCd ?? 0;
    if (cd > 0) self.state.shoutCd = cd - 1;
    if (isAdjacent(self.pos, ctx.player.pos)) {
      meleeAttack(self, ctx.player, ctx);
      return;
    }
    if ((self.state.shoutCd ?? 0) <= 0) {
      const woke = ctx.allEnemies().filter((e) => e !== self && !e.awake && chebyshev(e.pos, self.pos) <= 4);
      if (woke.length > 0) {
        for (const e of woke) e.awake = true;
        ctx.fx.floatText(self.pos, "외침!", "#d98aa0");
        self.state.shoutCd = 4;
        return;
      }
    }
    fleeFromPlayer(self, ctx);
  },
};

// 혀채귀 — 되울림/嗔: 직선 정렬 시 플레이어를 제 쪽으로 당긴다("퇴로가 너를 문다").
const hyeochae: EnemyDef = {
  id: "balseol_hyeochae",
  name: "혀채귀",
  glyph: "혀",
  color: "#d98aa0",
  hp: 7,
  atk: 3,
  def: 0,
  jeonggi: 4,
  speed: 100,
  role: "되울림",
  hell: "balseol",
  act(self, ctx) {
    const p = ctx.player;
    if (isAdjacent(self.pos, p.pos)) {
      fleeFromPlayer(self, ctx); // 사거리 유지
      return;
    }
    if (rangedPull(self, ctx, self.pos, self.stats.atk - 2, "혀", "#d98aa0")) return;
    stepToward(self, p.pos, ctx);
  },
};

// 업경파편 — 嗔/지연반사: 직전에 맞았고 인접이면 일부를 되돌린다(무지성 난타 처벌, 1턴 공정).
const eopgyeongPyeon: EnemyDef = {
  id: "balseol_eopgyeong_pyeon",
  name: "업경파편",
  glyph: "편",
  color: "#c4b9e0",
  hp: 14,
  atk: 4,
  def: 2,
  jeonggi: 5,
  speed: 100,
  role: "진반사",
  hell: "balseol",
  act(self, ctx) {
    if (self.flashTurns > 0 && isAdjacent(self.pos, ctx.player.pos)) {
      ctx.dealDamage(ctx.player, self.stats.atk, { source: self, kind: "pure" });
      ctx.fx.floatText(self.pos, "반사", "#c4b9e0");
    }
    chasePlayer(self, ctx);
  },
};

export const balseolEnemies: EnemyDef[] = [
  gyeollyeong,
  jaemulgwi,
  geoulbunsin,
  oechimkkun,
  hyeochae,
  eopgyeongPyeon,
];
