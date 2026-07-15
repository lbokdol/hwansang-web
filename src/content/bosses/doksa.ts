// 오관대왕(五官大王) — 독사지옥. 독무·중독을 주는 4번째 십대왕 (보스패턴 프레임워크 §2).

import { DIRS8, add, type Pos } from "../../core/grid";
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

const summonCells = (self: Enemy, ctx: GameContext, n: number): Pos[] =>
  DIRS8.map((d) => add(self.pos, d))
    .filter((c) => !ctx.isWall(c) && !ctx.isBlocked(c))
    .slice(0, n);

const venomCross: BossPattern = {
  name: "독무 분사",
  color: "#9be36b",
  build: (self, ctx) => crossAt(self.pos, 3, ctx),
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 7, "physical", { kind: "poison", turns: 4, power: 3 });
    convertTiles(ctx, cells, "doksa_poison");
  },
};

const summonSnakes: BossPattern = {
  name: "독사 소환",
  color: "#8fd46b",
  build: (self, ctx) => summonCells(self, ctx, self.phase === 2 ? 3 : 2),
  execute: (self, ctx) => summonAround(self, ctx, "doksa_dokssa", self.phase === 2 ? 3 : 2, "#8fd46b"),
};

const venomGrid: BossPattern = {
  name: "맹독 격자",
  color: "#6bbf4a",
  build: (_self, ctx) => lineThrough(ctx.player.pos, ctx.rng.chance(0.5) ? "h" : "v", 5, ctx),
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 5, "physical", { kind: "poison", turns: 3, power: 2 });
    convertTiles(ctx, cells, "doksa_poison");
  },
};

const venomBurst: BossPattern = {
  name: "독연 폭발",
  color: "#9be36b",
  build: (_self, ctx) => areaAt(ctx.player.pos, 1, ctx),
  execute: (self, ctx, cells) =>
    strikePlayer(self, ctx, cells, 8, "physical", { kind: "poison", turns: 4, power: 3 }),
};

export const ogwan: BossDef = {
  id: "ogwan",
  name: "오관대왕",
  nameHanja: "五官大王",
  glyph: "오",
  color: "#9be36b",
  hp: 88,
  atk: 10,
  def: 3,
  jeonggi: 26,
  phase2At: 0.5,
  act: (self, ctx) =>
    runBoss(
      self,
      ctx,
      [venomCross, summonSnakes, venomGrid],
      [venomBurst, summonSnakes, venomCross, venomGrid],
    ),
  onPhaseChange: (self, ctx) => {
    beginPhaseTransition(self, ctx, "독전이 깨진다! 오관대왕의 독이 짙어진다. (2페이즈)");
    self.stats.atk += 2;
  },
};
