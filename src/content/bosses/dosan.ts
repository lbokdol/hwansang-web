// 진광대왕(秦廣大王) — 도산지옥. 핵심 루프(예고 회피 + 잡몹)를 가르치는 첫 보스.
// 보스패턴_상세 §2.

import { DIRS8, add, type Pos } from "../../core/grid";
import type { BossDef, GameContext } from "../../core/types";
import type { Enemy } from "../../entities/enemy";
import {
  type BossPattern,
  beginPhaseTransition,
  convertTiles,
  crossAt,
  lineThrough,
  runBoss,
  strikePlayer,
  summonAround,
} from "./patterns";

const summonCells = (self: Enemy, ctx: GameContext, n: number): Pos[] =>
  DIRS8.map((d) => add(self.pos, d))
    .filter((c) => !ctx.isWall(c) && !ctx.isBlocked(c))
    .slice(0, n);

const upgyeongCross: BossPattern = {
  name: "업경 십자",
  color: "#ff5a5a",
  build: (self, ctx) => crossAt(self.pos, 3, ctx),
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 9, "physical"),
};

const summonMangryeong: BossPattern = {
  name: "망령 소환",
  color: "#b6c2d9",
  build: (self, ctx) => summonCells(self, ctx, self.phase === 2 ? 3 : 2),
  execute: (self, ctx) => summonAround(self, ctx, "dosan_mangryeong", self.phase === 2 ? 3 : 2, "#b6c2d9"),
};

const awakenBlades: BossPattern = {
  name: "칼날 일깨움",
  color: "#d7dde8",
  build: (_self, ctx) => lineThrough(ctx.player.pos, ctx.rng.chance(0.5) ? "h" : "v", 5, ctx),
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 3, "physical");
    convertTiles(ctx, cells, "dosan_blade");
  },
};

const doubleCross: BossPattern = {
  name: "양면 십자",
  color: "#ff5a5a",
  build: (self, ctx) => {
    const a = crossAt(self.pos, 3, ctx);
    const mid: Pos = {
      x: Math.round((self.pos.x + ctx.player.pos.x) / 2),
      y: Math.round((self.pos.y + ctx.player.pos.y) / 2),
    };
    return [...a, ...crossAt(mid, 2, ctx)];
  },
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 9, "physical"),
};

export const jingwang: BossDef = {
  id: "jingwang",
  name: "진광대왕",
  nameHanja: "秦廣大王",
  glyph: "진",
  color: "#ffcf5a",
  hp: 80,
  atk: 10,
  def: 2,
  jeonggi: 20,
  phase2At: 0.5,
  act: (self, ctx) =>
    runBoss(
      self,
      ctx,
      [upgyeongCross, summonMangryeong, awakenBlades],
      [doubleCross, summonMangryeong, awakenBlades, awakenBlades],
    ),
  onPhaseChange: (self, ctx) => {
    beginPhaseTransition(self, ctx, "업경대가 깨진다! 진광대왕이 분노한다. (2페이즈)");
    self.stats.atk += 2;
  },
};
