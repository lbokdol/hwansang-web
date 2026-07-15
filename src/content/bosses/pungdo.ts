// 도시대왕(都市大王) — 풍도지옥. 구동(GustDrive)으로 밀고 재배치(Relocate)로 몰아세움.
// Port of Godot BossContent.Dosi().

import { DIRS8, add, type Pos } from "../../core/grid";
import type { BossDef, GameContext } from "../../core/types";
import type { Enemy } from "../../entities/enemy";
import {
  type BossPattern,
  areaAt,
  beginPhaseTransition,
  convertTiles,
  crossAt,
  domStep,
  gustDrive,
  lineThrough,
  relocate,
  runBoss,
  strikePlayer,
  summonAround,
} from "./patterns";

const SQUALL = "pungdo_squall";

const summonCells = (self: Enemy, ctx: GameContext, n: number): Pos[] =>
  DIRS8.map((d) => add(self.pos, d))
    .filter((c) => !ctx.isWall(c) && !ctx.isBlocked(c))
    .slice(0, n);

const horizAxis = (self: Enemy, ctx: GameContext): "h" | "v" =>
  Math.abs(ctx.player.pos.x - self.pos.x) >= Math.abs(ctx.player.pos.y - self.pos.y) ? "h" : "v";

// ★유계 근접 앵커: 아레나 중심 방향으로 5칸 (매 전투 '늘 같은 자리', 대각 코너 격파불가 회피).
function anchor(self: Enemy, ctx: GameContext): Pos {
  const center = { x: Math.floor(ctx.level.width / 2), y: Math.floor(ctx.level.height / 2) };
  let step = domStep(self.pos, center);
  if (!step.x && !step.y) step = { x: 0, y: 1 };
  return { x: self.pos.x + step.x * 5, y: self.pos.y + step.y * 5 };
}

// ── P1 (구동 maxCells=2) ──
const galeGust: BossPattern = {
  name: "진풍",
  color: "#c9b98a",
  build: (self, ctx) => lineThrough(self.pos, horizAxis(self, ctx), 6, ctx),
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 9, "terrain");
    gustDrive(self, ctx, domStep(self.pos, ctx.player.pos), 2);
    convertTiles(ctx, cells, SQUALL);
  },
};
const gustPress: BossPattern = {
  name: "사면압",
  color: "#d8cfa0",
  build: (_self, ctx) => areaAt(ctx.player.pos, 1, ctx),
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 12, "physical"),
};
const summonGale: BossPattern = {
  name: "풍령 소환",
  color: "#b6b29a",
  build: (self, ctx) => summonCells(self, ctx, 2),
  execute: (self, ctx) => summonAround(self, ctx, "pungdo_pungnyeong", 2, "#b6b29a"),
};
const galeRake: BossPattern = {
  name: "삭풍참",
  color: "#c9b98a",
  build: (_self, ctx) => lineThrough(ctx.player.pos, ctx.rng.chance(0.5) ? "h" : "v", 5, ctx),
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 9, "terrain");
    convertTiles(ctx, cells, SQUALL);
  },
};

// ── P2 (재배치 도입 + 구동 maxCells=3) ──
const relocateGale: BossPattern = {
  name: "재배치",
  color: "#c9b98a",
  build: (self, ctx) => areaAt(anchor(self, ctx), 1, ctx),
  execute: (self, ctx) => relocate(self, ctx, anchor(self, ctx)),
};
const stormPress: BossPattern = {
  name: "폭풍압",
  color: "#d8cfa0",
  build: (_self, ctx) => areaAt(ctx.player.pos, 1, ctx),
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 14, "physical"),
};
const whirlShove: BossPattern = {
  name: "회풍",
  color: "#c9b98a",
  build: (self, ctx) => crossAt(self.pos, 4, ctx),
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 11, "terrain");
    gustDrive(self, ctx, domStep(self.pos, ctx.player.pos), 3);
    convertTiles(ctx, cells, SQUALL);
  },
};

export const dosi: BossDef = {
  id: "dosi",
  name: "도시대왕",
  nameHanja: "都市大王",
  glyph: "도",
  color: "#c9b98a",
  hp: 104,
  atk: 12,
  def: 5,
  jeonggi: 40,
  phase2At: 0.5,
  act: (self, ctx) =>
    runBoss(
      self,
      ctx,
      [galeGust, gustPress, summonGale, galeRake],
      [relocateGale, stormPress, whirlShove, summonGale],
    ),
  onPhaseChange: (self, ctx) => {
    beginPhaseTransition(self, ctx, "업경대가 깨진다! 도시대왕의 바람이 방향을 바꾼다. (2페이즈)");
    self.stats.atk += 2;
    convertTiles(ctx, crossAt(self.pos, 4, ctx), SQUALL); // 중앙 풍식 십자
  },
};
