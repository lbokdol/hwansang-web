// 평등대왕(平等大王) — 흑승지옥. 均衡場(피해상한) + 불균형(HP 극단) 처벌.
// Port of Godot BossContent.Pyeongdeung().

import { DIRS8, add, type Pos } from "../../core/grid";
import type { BossDef, GameContext } from "../../core/types";
import type { Enemy } from "../../entities/enemy";
import {
  type BossPattern,
  areaAt,
  beginPhaseTransition,
  convertTiles,
  crossAt,
  equalizeField,
  lineThrough,
  ringAt,
  runBoss,
  strikePlayer,
  summonAround,
} from "./patterns";

const INK = "heukseung_ink";

const summonCells = (self: Enemy, ctx: GameContext, n: number): Pos[] =>
  DIRS8.map((d) => add(self.pos, d))
    .filter((c) => !ctx.isWall(c) && !ctx.isBlocked(c))
    .slice(0, n);

// 저울판결: 플레이어가 균형(HP 절반)에서 벗어난 만큼 추가 피해. |HpFraction-0.5|≤0.5 → +50% 상한.
const imbalanceBonus = (ctx: GameContext, base: number): number =>
  Math.floor(base * Math.abs(ctx.player.hpFraction - 0.5));

// P1
const equalize: BossPattern = {
  name: "균형장",
  color: "#7fa39a",
  build: (self, ctx) => ringAt(self.pos, 1, ctx),
  execute: (self, ctx) => equalizeField(self, ctx, 2, 18),
};
const inkVerdict: BossPattern = {
  name: "먹줄 단죄",
  color: "#c23a3a",
  build: (_self, ctx) => lineThrough(ctx.player.pos, ctx.rng.chance(0.5) ? "h" : "v", 7, ctx),
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 12, "terrain");
    convertTiles(ctx, cells, INK);
  },
};
const scaleStrike: BossPattern = {
  name: "저울침",
  color: "#7fa39a",
  build: (_self, ctx) => areaAt(ctx.player.pos, 1, ctx),
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 12, "physical"),
};
const summonSeung: BossPattern = {
  name: "흑승 소환",
  color: "#8a8f96",
  build: (self, ctx) => summonCells(self, ctx, 2),
  execute: (self, ctx) => summonAround(self, ctx, "heukseung_seolryeong", 2, "#8a8f96"),
};

// P2
const equalizeHard: BossPattern = {
  name: "균형장(조임)",
  color: "#7fa39a",
  build: (self, ctx) => ringAt(self.pos, 1, ctx),
  execute: (self, ctx) => equalizeField(self, ctx, 2, 13),
};
const crossRope: BossPattern = {
  name: "십자 먹줄",
  color: "#c23a3a",
  build: (self, ctx) => crossAt(self.pos, 4, ctx),
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 11, "terrain");
    convertTiles(ctx, cells, INK);
  },
};
const scaleJudgment: BossPattern = {
  name: "저울판결",
  color: "#7fa39a",
  build: (_self, ctx) => areaAt(ctx.player.pos, 1, ctx),
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 12 + imbalanceBonus(ctx, 12), "physical"),
};

export const pyeongdeung: BossDef = {
  id: "pyeongdeung",
  name: "평등대왕",
  nameHanja: "平等大王",
  glyph: "평",
  color: "#7fa39a",
  hp: 104,
  atk: 12,
  def: 5,
  jeonggi: 38,
  phase2At: 0.5,
  act: (self, ctx) =>
    runBoss(
      self,
      ctx,
      [equalize, inkVerdict, scaleStrike, summonSeung],
      [equalizeHard, crossRope, scaleJudgment, summonSeung],
    ),
  onPhaseChange: (self, ctx) => {
    beginPhaseTransition(self, ctx, "업경대가 깨진다! 평등대왕의 저울이 곤두선다. (2페이즈)");
    self.stats.atk += 2;
    convertTiles(ctx, crossAt(self.pos, 4, ctx), INK); // 중앙 먹줄 십자
  },
};
