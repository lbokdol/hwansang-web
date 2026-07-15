// 염라대왕(閻羅大王) — 발설지옥. 거울왕: 위치 미러링 + 반사장 + 거울분신.
// Port of Godot BossContent.Yeomra().

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
  mirrorAcross,
  raiseMirror,
  ringAt,
  runBoss,
  strikePlayer,
  summonAround,
} from "./patterns";

const ECHO = "balseol_echo";

const summonCells = (self: Enemy, ctx: GameContext, n: number): Pos[] =>
  DIRS8.map((d) => add(self.pos, d))
    .filter((c) => !ctx.isWall(c) && !ctx.isBlocked(c))
    .slice(0, n);

// P1 — 위치 미러링 + 반사장 점화 + 거울분신
const eomgyeongGaze: BossPattern = {
  name: "업경조",
  color: "#c4b9e0",
  build: (self, ctx) => [
    ...areaAt(ctx.player.pos, 1, ctx),
    ...areaAt(mirrorAcross(self.pos, ctx.player.pos), 1, ctx),
  ],
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 11, "physical"),
};
const mirrorRaise: BossPattern = {
  name: "경면입",
  color: "#c4b9e0",
  build: (self, ctx) => ringAt(self.pos, 1, ctx),
  execute: (self, ctx) => raiseMirror(self, ctx, 2, 3, 500),
};
const summonBunsin: BossPattern = {
  name: "거울분신",
  color: "#c4b9e0",
  build: (self, ctx) => summonCells(self, ctx, 2),
  execute: (self, ctx) => summonAround(self, ctx, "balseol_geoulbunsin", 2, "#c4b9e0"),
};
const tongueLine: BossPattern = {
  name: "설인선",
  color: "#d98aa0",
  build: (_self, ctx) => lineThrough(ctx.player.pos, ctx.rng.chance(0.5) ? "h" : "v", 5, ctx),
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 6, "physical");
    convertTiles(ctx, cells, ECHO);
  },
};

// P2 — 미러링 격화 + 강한 반사장
const twinMirrorCross: BossPattern = {
  name: "양경십자",
  color: "#c4b9e0",
  build: (self, ctx) => [
    ...crossAt(self.pos, 4, ctx),
    ...crossAt(mirrorAcross(self.pos, ctx.player.pos), 2, ctx),
  ],
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 13, "physical"),
};
const mirrorField: BossPattern = {
  name: "경면상시",
  color: "#c4b9e0",
  build: (self, ctx) => ringAt(self.pos, 1, ctx),
  execute: (self, ctx) => raiseMirror(self, ctx, 2, 5, 500),
};
const yukdoMirror: BossPattern = {
  name: "육도경",
  color: "#c4b9e0",
  build: (self, ctx) => [
    ...areaAt(ctx.player.pos, 1, ctx),
    ...areaAt(mirrorAcross(self.pos, ctx.player.pos), 1, ctx),
  ],
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 12, "physical"),
};
const retraceThorns: BossPattern = {
  name: "설옥가시",
  color: "#d98aa0",
  build: (_self, ctx) => lineThrough(ctx.player.pos, ctx.rng.chance(0.5) ? "h" : "v", 6, ctx),
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 7, "physical");
    convertTiles(ctx, cells, ECHO);
  },
};

export const yeomra: BossDef = {
  id: "yeomra",
  name: "염라대왕",
  nameHanja: "閻羅大王",
  glyph: "염",
  color: "#c4b9e0",
  hp: 96,
  atk: 11,
  def: 4,
  jeonggi: 30,
  phase2At: 0.5,
  act: (self, ctx) =>
    runBoss(
      self,
      ctx,
      [eomgyeongGaze, mirrorRaise, summonBunsin, tongueLine],
      [twinMirrorCross, mirrorField, yukdoMirror, retraceThorns],
    ),
  onPhaseChange: (self, ctx) => {
    beginPhaseTransition(self, ctx, "업경대가 깨진다! 염라대왕의 거울이 곤두선다. (2페이즈)");
    self.stats.atk += 2;
    convertTiles(ctx, lineThrough(self.pos, "v", 8, ctx), ECHO); // 아레나 거울봉합선
  },
};
