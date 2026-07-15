// 송제대왕(宋帝大王) — 한빙지옥의 왕, v1 최종 보스. 모든 시스템의 종합 시험:
// 미끄러지는 얼음 위에서 예고를 피해야 한다. 보스패턴_상세 §4.

import { add, eq, type Pos } from "../../core/grid";
import type { BossDef, GameContext } from "../../core/types";
import type { Enemy } from "../../entities/enemy";
import {
  type BossPattern,
  areaAt,
  beginPhaseTransition,
  convertTiles,
  crossAt,
  lineThrough,
  runBoss,
  strikePlayer,
  summonAround,
} from "./patterns";

const ICE = "hanbing_ice";
const FREEZE = { kind: "freeze" as const, turns: 1, power: 1 };

// --- P1 ---
const coldCross: BossPattern = {
  name: "한기 십자",
  color: "#7fd0ff",
  build: (self, ctx) => crossAt(self.pos, 3, ctx),
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 15, "ice", FREEZE),
};

const iceWall: BossPattern = {
  name: "빙벽 소환",
  color: "#bfe9ff",
  build: (self, ctx) => {
    // 빙벽: 보스와 플레이어 사이에 얼음 줄.
    const axis: "h" | "v" = Math.abs(ctx.player.pos.x - self.pos.x) >= Math.abs(ctx.player.pos.y - self.pos.y) ? "v" : "h";
    return lineThrough(self.pos, axis, 2, ctx);
  },
  execute: (self, ctx, cells) => {
    convertTiles(ctx, cells, ICE); // 임시 얼음벽(미끄러짐)
    summonAround(self, ctx, "hanbing_binggwi", 1, "#bfe9ff");
  },
};

const freezeField: BossPattern = {
  name: "결빙 장판",
  color: "#9fd6ff",
  build: (_self, ctx) => areaAt(ctx.player.pos, 1, ctx),
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 15, "ice", FREEZE);
    convertTiles(ctx, cells, ICE);
  },
};

// --- P2 ---
const blizzardDash: BossPattern = {
  name: "눈보라 돌진",
  color: "#7fd0ff",
  build: (self, ctx) => {
    const axis: "h" | "v" = Math.abs(ctx.player.pos.x - self.pos.x) >= Math.abs(ctx.player.pos.y - self.pos.y) ? "h" : "v";
    self.state.dashH = axis === "h" ? 1 : 0;
    return lineThrough(self.pos, axis, 6, ctx);
  },
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 15, "ice", FREEZE);
    convertTiles(ctx, cells, ICE); // 얼음 자국
    dashBoss(self, ctx); // 보스 관통 이동
  },
};

const doubleColdCross: BossPattern = {
  name: "양면 한기 십자 + 소환",
  color: "#7fd0ff",
  build: (self, ctx) => {
    const a = crossAt(self.pos, 3, ctx);
    const mid: Pos = {
      x: Math.round((self.pos.x + ctx.player.pos.x) / 2),
      y: Math.round((self.pos.y + ctx.player.pos.y) / 2),
    };
    return [...a, ...crossAt(mid, 2, ctx)];
  },
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 15, "ice", FREEZE);
    summonAround(self, ctx, "hanbing_binggwi", 1, "#bfe9ff");
  },
};

/** Boss charges several tiles toward the player along the dash axis. */
function dashBoss(self: Enemy, ctx: GameContext): void {
  const horiz = self.state.dashH === 1;
  const dir: Pos = horiz
    ? { x: Math.sign(ctx.player.pos.x - self.pos.x) || 1, y: 0 }
    : { x: 0, y: Math.sign(ctx.player.pos.y - self.pos.y) || 1 };
  for (let i = 0; i < 4; i++) {
    const next = add(self.pos, dir);
    if (ctx.isWall(next) || ctx.actorAt(next) || eq(next, ctx.player.pos)) break;
    self.pos = next;
  }
}

export const songje: BossDef = {
  id: "songje",
  name: "송제대왕",
  nameHanja: "宋帝大王",
  glyph: "송",
  color: "#7fd0ff",
  // 단계별 난이도: 보스 기본치를 정규화(70~160→80~92). 난이도는 강하 단계가 스케일.
  hp: 92,
  atk: 11,
  def: 4,
  jeonggi: 20,
  phase2At: 0.5,
  act: (self, ctx) =>
    runBoss(
      self,
      ctx,
      [coldCross, iceWall, freezeField],
      [blizzardDash, doubleColdCross, coldCross, freezeField],
    ),
  onPhaseChange: (self, ctx) => {
    beginPhaseTransition(self, ctx, "엄동이 내린다! 얼음이 번져온다. (2페이즈)");
    self.stats.atk += 2;
    // 얼음 확대: 보스 주변 장판을 얼음으로.
    convertTiles(ctx, areaAt(self.pos, 3, ctx), ICE);
  },
};
