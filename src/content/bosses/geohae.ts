// 태산대왕(泰山大王) — 거해지옥. 견인(HookPull)으로 톱날 위에 끌어다 분쇄.
// Port of Godot BossContent.Taesan().

import { DIRS8, add, type Pos } from "../../core/grid";
import type { BossDef, GameContext } from "../../core/types";
import type { Enemy } from "../../entities/enemy";
import {
  type BossPattern,
  areaAt,
  beginPhaseTransition,
  convertTiles,
  crossAt,
  hookPull,
  lineThrough,
  runBoss,
  strikePlayer,
  summonAround,
} from "./patterns";

const SAW = "geohae_saw";

const summonCells = (self: Enemy, ctx: GameContext, n: number): Pos[] =>
  DIRS8.map((d) => add(self.pos, d))
    .filter((c) => !ctx.isWall(c) && !ctx.isBlocked(c))
    .slice(0, n);

// 보스→플레이어 우세축이 가로면 "h".
const horizAxis = (self: Enemy, ctx: GameContext): "h" | "v" =>
  Math.abs(ctx.player.pos.x - self.pos.x) >= Math.abs(ctx.player.pos.y - self.pos.y) ? "h" : "v";

// P1 (견인 maxCells=2)
const geohaeHook: BossPattern = {
  name: "거해구",
  color: "#d65a5a",
  build: (self, ctx) => lineThrough(self.pos, horizAxis(self, ctx), 5, ctx),
  execute: (self, ctx, cells) => {
    convertTiles(ctx, cells, SAW);
    hookPull(self, ctx, 2);
  },
};
const crushPress: BossPattern = {
  name: "분쇄압",
  color: "#c0c6cc",
  build: (_self, ctx) => areaAt(ctx.player.pos, 1, ctx),
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 12, "physical"),
};
const sawRow: BossPattern = {
  name: "톱니열",
  color: "#d65a5a",
  build: (self, ctx) => lineThrough(self.pos, horizAxis(self, ctx), 4, ctx),
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 10, "terrain");
    convertTiles(ctx, cells, SAW);
  },
};
const summonHyeongri: BossPattern = {
  name: "형리 소환",
  color: "#aeb6be",
  build: (self, ctx) => summonCells(self, ctx, 2),
  execute: (self, ctx) => summonAround(self, ctx, "geohae_georyeong", 2, "#9aa0a8"),
};

// P2 (견인 maxCells=3)
const geohaeReel: BossPattern = {
  name: "거해감김",
  color: "#d65a5a",
  build: (self, ctx) => lineThrough(self.pos, horizAxis(self, ctx), 6, ctx),
  execute: (self, ctx, cells) => {
    convertTiles(ctx, cells, SAW);
    hookPull(self, ctx, 3);
  },
};
const crushPressHard: BossPattern = {
  name: "분쇄압(강)",
  color: "#c0c6cc",
  build: (_self, ctx) => areaAt(ctx.player.pos, 1, ctx),
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 14, "physical"),
};
const twinSaw: BossPattern = {
  name: "협착",
  color: "#d65a5a",
  build: (self, ctx) => crossAt(self.pos, 4, ctx),
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 11, "terrain");
    convertTiles(ctx, cells, SAW);
  },
};

export const taesan: BossDef = {
  id: "taesan",
  name: "태산대왕",
  nameHanja: "泰山大王",
  glyph: "태",
  color: "#aeb6be",
  hp: 104,
  atk: 12,
  def: 4,
  jeonggi: 36,
  phase2At: 0.5,
  act: (self, ctx) =>
    runBoss(
      self,
      ctx,
      [geohaeHook, crushPress, sawRow, summonHyeongri],
      [geohaeReel, crushPressHard, twinSaw, summonHyeongri],
    ),
  onPhaseChange: (self, ctx) => {
    beginPhaseTransition(self, ctx, "업경대가 깨진다! 태산대왕이 톱날을 끌어올린다. (2페이즈)");
    self.stats.atk += 2;
    convertTiles(ctx, crossAt(self.pos, 4, ctx), SAW); // 중앙 톱날 십자
  },
};
