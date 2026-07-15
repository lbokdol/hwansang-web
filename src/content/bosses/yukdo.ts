// 전륜대왕(五道轉輪大王) — 육도지옥 피날레. 5輻(鏡염/熔변/鋸태/繩평/風도) 형상 순환:
// 역대 5왕 시그니처를 바퀴처럼 되돌려 재조합 (신규 코어 0). Port of BossContent.Jeonryun().

import { DIRS8, add, type Pos } from "../../core/grid";
import type { BossDef, GameContext, StatusKind } from "../../core/types";
import type { Enemy } from "../../entities/enemy";
import {
  type BossForm,
  type BossPattern,
  areaAt,
  beginPhaseTransition,
  convertTiles,
  crossAt,
  domStep,
  equalizeField,
  gustDrive,
  hookPull,
  lineThrough,
  mirrorAcross,
  raiseMirror,
  relocate,
  ringAt,
  runBossForms,
  strikePlayer,
  summonAround,
} from "./patterns";

const BURN32 = { kind: "burn" as StatusKind, turns: 3, power: 2 };

const summonCells = (self: Enemy, ctx: GameContext, n: number): Pos[] =>
  DIRS8.map((d) => add(self.pos, d))
    .filter((c) => !ctx.isWall(c) && !ctx.isBlocked(c))
    .slice(0, n);

const horizAxis = (self: Enemy, ctx: GameContext): "h" | "v" =>
  Math.abs(ctx.player.pos.x - self.pos.x) >= Math.abs(ctx.player.pos.y - self.pos.y) ? "h" : "v";

function anchor(self: Enemy, ctx: GameContext): Pos {
  const center = { x: Math.floor(ctx.level.width / 2), y: Math.floor(ctx.level.height / 2) };
  let step = domStep(self.pos, center);
  if (!step.x && !step.y) step = { x: 0, y: 1 };
  return { x: self.pos.x + step.x * 5, y: self.pos.y + step.y * 5 };
}

// 형상 공용 필러 (무시그니처 자유타 = 격파창) + 소환
const wheelCrush: BossPattern = {
  name: "윤쇄",
  color: "#e6d9a8",
  build: (_self, ctx) => areaAt(ctx.player.pos, 1, ctx),
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 12, "physical"),
};
const wheelSummon: BossPattern = {
  name: "윤혼 소환",
  color: "#b9a86a",
  build: (self, ctx) => summonCells(self, ctx, 2),
  execute: (self, ctx) => summonAround(self, ctx, "yukdo_yunhon", 2, "#b9a86a"),
};

// ① 鏡(염) — 거울 반사장
const wheelMirror: BossPattern = {
  name: "경면",
  color: "#c4b9e0",
  build: (self, ctx) => ringAt(self.pos, 1, ctx),
  execute: (self, ctx) => raiseMirror(self, ctx, 2, 4, 500),
};
const wheelGaze: BossPattern = {
  name: "업경조",
  color: "#c4b9e0",
  build: (self, ctx) => [
    ...areaAt(ctx.player.pos, 1, ctx),
    ...areaAt(mirrorAcross(self.pos, ctx.player.pos), 1, ctx),
  ],
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 11, "physical"),
};
const wheelEcho: BossPattern = {
  name: "되울림",
  color: "#d98aa0",
  build: (_self, ctx) => lineThrough(ctx.player.pos, ctx.rng.chance(0.5) ? "h" : "v", 5, ctx),
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 10, "terrain");
    convertTiles(ctx, cells, "balseol_echo");
  },
};

// ② 熔(변)
const wheelMolten: BossPattern = {
  name: "용출",
  color: "#c98a3a",
  build: (_self, ctx) => areaAt(ctx.player.pos, 1, ctx),
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 13, "fire", BURN32);
    convertTiles(ctx, cells, "yangdong_molten");
  },
};
const wheelCleave: BossPattern = {
  name: "용단",
  color: "#e8a24a",
  build: (self, ctx) => crossAt(self.pos, 4, ctx),
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 12, "fire"),
};

// ③ 鋸(태) — 견인
const wheelHook: BossPattern = {
  name: "거해구",
  color: "#aeb6be",
  build: (self, ctx) => crossAt(self.pos, 3, ctx),
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 10, "terrain");
    hookPull(self, ctx, 2);
    convertTiles(ctx, cells, "geohae_saw");
  },
};

// ④ 繩(평) — 균형장
const wheelEqualize: BossPattern = {
  name: "균형장",
  color: "#7fa39a",
  build: (self, ctx) => ringAt(self.pos, 1, ctx),
  execute: (self, ctx) => equalizeField(self, ctx, 2, 14),
};
const wheelInk: BossPattern = {
  name: "먹줄",
  color: "#c23a3a",
  build: (_self, ctx) => lineThrough(ctx.player.pos, ctx.rng.chance(0.5) ? "h" : "v", 6, ctx),
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 11, "terrain");
    convertTiles(ctx, cells, "heukseung_ink");
  },
};

// ⑤ 風(도) — 구동 + 재배치
const wheelGust: BossPattern = {
  name: "진풍",
  color: "#c9b98a",
  build: (self, ctx) => lineThrough(self.pos, horizAxis(self, ctx), 6, ctx),
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 9, "terrain");
    gustDrive(self, ctx, domStep(self.pos, ctx.player.pos), 2);
  },
};
const wheelRelocate: BossPattern = {
  name: "재배치",
  color: "#c9b98a",
  build: (self, ctx) => areaAt(anchor(self, ctx), 1, ctx),
  execute: (self, ctx) => relocate(self, ctx, anchor(self, ctx)),
};
const wheelStorm: BossPattern = {
  name: "폭풍압",
  color: "#c9b98a",
  build: (_self, ctx) => areaAt(ctx.player.pos, 1, ctx),
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 13, "physical"),
};

// 5輻: 역대 왕 얼굴이 바퀴처럼 되돌아옴. mirror=①·equalize=④·relocate=⑤ 각기 다른 form → 동시 불가.
const forms: BossForm[] = [
  { glyph: "경", color: "#c4b9e0", atkMod: 0, defMod: 0, p1: [wheelMirror, wheelGaze, wheelEcho], p2: [wheelMirror, wheelGaze, wheelEcho] },
  { glyph: "용", color: "#c98a3a", atkMod: 2, defMod: -2, p1: [wheelMolten, wheelCleave, wheelCrush], p2: [wheelMolten, wheelCleave, wheelCrush] },
  { glyph: "거", color: "#aeb6be", atkMod: 1, defMod: 0, p1: [wheelHook, wheelCrush, wheelSummon], p2: [wheelHook, wheelCrush, wheelSummon] },
  { glyph: "승", color: "#7fa39a", atkMod: 0, defMod: 1, p1: [wheelEqualize, wheelInk, wheelCrush], p2: [wheelEqualize, wheelInk, wheelCrush] },
  { glyph: "풍", color: "#c9b98a", atkMod: 0, defMod: 0, p1: [wheelGust, wheelStorm, wheelCrush], p2: [wheelRelocate, wheelGust, wheelStorm] },
];

export const jeonryun: BossDef = {
  id: "jeonryun",
  name: "전륜대왕",
  nameHanja: "五道轉輪大王",
  glyph: "전",
  color: "#e6d9a8",
  hp: 104,
  atk: 12,
  def: 4,
  jeonggi: 50,
  phase2At: 0.5,
  act: (self, ctx) => runBossForms(self, ctx, forms, "오도전륜이 다음 바퀴로 돌아간다"),
  onPhaseChange: (self, ctx) => {
    beginPhaseTransition(self, ctx, "업경대가 깨진다! 전륜의 바퀴가 가속한다. (2페이즈)");
    self.stats.atk += 2;
    self.state.formLen = 3; // 바퀴 가속
    self.state.mirror = 0;
    self.state.equalize = 0;
    convertTiles(ctx, crossAt(self.pos, 4, ctx), "balseol_echo"); // 처음으로 되돌아옴 모티프
  },
};
