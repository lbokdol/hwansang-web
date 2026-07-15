// 변성대왕(變成大王) — 양동지옥. 三相(熔/凝/沸) 형상교체 보스.
// Port of Godot BossContent.Byeonseong().

import { DIRS8, add, type Pos } from "../../core/grid";
import { T_FLOOR } from "../../map/tiles";
import type { BossDef, GameContext, StatusKind } from "../../core/types";
import type { Enemy } from "../../entities/enemy";
import {
  type BossForm,
  type BossPattern,
  areaAt,
  beginPhaseTransition,
  convertTiles,
  crossAt,
  lineThrough,
  ringAt,
  runBossForms,
  strikePlayer,
  summonAround,
} from "./patterns";

const MOLTEN = "yangdong_molten";
const BURN32 = { kind: "burn" as StatusKind, turns: 3, power: 2 };

const summonCells = (self: Enemy, ctx: GameContext, n: number): Pos[] =>
  DIRS8.map((d) => add(self.pos, d))
    .filter((c) => !ctx.isWall(c) && !ctx.isBlocked(c))
    .slice(0, n);

/** 凝 형상: 녹은 쇳물을 전부 굳혀 안전 바닥으로 — 압박 해소. */
function solidifyMolten(ctx: GameContext): void {
  const lvl = ctx.level;
  for (let y = 0; y < lvl.height; y++) {
    for (let x = 0; x < lvl.width; x++) {
      const p = { x, y };
      if (lvl.tileIdAt(p) === MOLTEN) lvl.setTile(p, T_FLOOR);
    }
  }
}

// ── 熔(Molten) 공격형 — AtkMod+1/DefMod-2 (저Def 버스트창=약점) ──
const moltenBurst: BossPattern = {
  name: "용출",
  color: "#c98a3a",
  build: (_self, ctx) => areaAt(ctx.player.pos, 1, ctx),
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 14, "fire", BURN32);
    convertTiles(ctx, cells, MOLTEN);
  },
};
const moltenCleave: BossPattern = {
  name: "용단",
  color: "#e8a24a",
  build: (self, ctx) => crossAt(self.pos, 4, ctx),
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 13, "fire"),
};
const moltenLash: BossPattern = {
  name: "쇳물 채찍",
  color: "#e8a24a",
  build: (_self, ctx) => lineThrough(ctx.player.pos, ctx.rng.chance(0.5) ? "h" : "v", 6, ctx),
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 12, "fire", BURN32),
};

// ── 凝(Congealed) 거북형 — AtkMod-1/DefMod+3 (정면딜 비효율 + 압박해소) ──
const congealHarden: BossPattern = {
  name: "응결",
  color: "#8fb0a4",
  build: (self, ctx) => ringAt(self.pos, 1, ctx),
  execute: (self, ctx) => {
    solidifyMolten(ctx);
    summonAround(self, ctx, "yangdong_byeontae", 1, "#8fb0a4");
  },
};
const congealSlam: BossPattern = {
  name: "응괴 강타",
  color: "#8fb0a4",
  build: (self, ctx) => areaAt(self.pos, 1, ctx),
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 10, "physical"),
};
const congealMold: BossPattern = {
  name: "주형",
  color: "#8fb0a4",
  build: (self, ctx) => summonCells(self, ctx, 2),
  execute: (self, ctx) => summonAround(self, ctx, "yangdong_yongjae", 2, "#c98a3a"),
};

// ── 沸(Boiling) 바닥조종형 — ±0 ──
const boilUp: BossPattern = {
  name: "비등",
  color: "#d6663a",
  build: (_self, ctx) => ringAt(ctx.player.pos, 2, ctx),
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 12, "fire");
    convertTiles(ctx, cells, MOLTEN);
  },
};
const boilSurface: BossPattern = {
  name: "비말",
  color: "#d6663a",
  build: (_self, ctx) => areaAt(ctx.player.pos, 1, ctx),
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 12, "fire", BURN32);
    convertTiles(ctx, cells, MOLTEN);
  },
};
const boilSteam: BossPattern = {
  name: "증기 파문",
  color: "#d6663a",
  build: (self, ctx) => {
    const r = ((self.state.ripple ?? 0) % 2) + 2; // 반경 2↔3 교대
    self.state.ripple = (self.state.ripple ?? 0) + 1;
    return ringAt(self.pos, r, ctx);
  },
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 12, "fire"),
};

const forms: BossForm[] = [
  {
    glyph: "용",
    color: "#c98a3a",
    atkMod: 1,
    defMod: -2,
    p1: [moltenBurst, moltenCleave, moltenLash],
    p2: [moltenBurst, moltenCleave, moltenLash, moltenBurst],
  },
  {
    glyph: "응",
    color: "#8fb0a4",
    atkMod: -1,
    defMod: 3,
    p1: [congealHarden, congealSlam, congealMold],
    p2: [congealHarden, congealSlam, congealMold],
  },
  {
    glyph: "비",
    color: "#d6663a",
    atkMod: 0,
    defMod: 0,
    p1: [boilUp, boilSurface, boilSteam],
    p2: [boilUp, boilSurface, boilSteam, boilUp],
  },
];

export const byeonseong: BossDef = {
  id: "byeonseong",
  name: "변성대왕",
  nameHanja: "變成大王",
  glyph: "변",
  color: "#c98a3a",
  hp: 104,
  atk: 11,
  def: 4,
  jeonggi: 34,
  phase2At: 0.5,
  act: (self, ctx) => runBossForms(self, ctx, forms, "변성대왕의 형상이 뒤바뀐다"),
  onPhaseChange: (self, ctx) => {
    beginPhaseTransition(self, ctx, "업경대가 깨진다! 변성대왕의 변전이 가속한다. (2페이즈)");
    self.stats.atk += 2;
    self.state.formLen = 3; // 형상 수명 단축 (가속)
    convertTiles(ctx, lineThrough(self.pos, "v", 8, ctx), MOLTEN); // 중앙 용해 띠
  },
};
