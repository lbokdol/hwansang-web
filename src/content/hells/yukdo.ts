// 육도지옥(六道 / 五道轉輪) — 피날레(왕10) 전륜대왕. 윤회 톱니(wheel).
// 동적 회전 해저드(RotorTick, 역대 5해저드 순환)는 정적 산포로 단순화 이식.

import type { HellDef, TileDef } from "../../core/types";

const WHEEL_TILE: TileDef = {
  id: "yukdo_wheel",
  name: "윤회 톱니",
  glyph: "◈",
  fg: "#e8c15a",
  bg: "#16120a",
  walkable: true,
  opaque: false,
  hazard: { damage: 3, damageKind: "terrain", trigger: "enter" },
};

export const yukdoHell: HellDef = {
  id: "yukdo",
  name: "육도지옥",
  nameHanja: "五道轉輪",
  order: 10,
  floors: 3,
  palette: {
    wallFg: "#7a6a48",
    wallBg: "#241d12",
    floorFg: "#4a4030",
    floorBg: "#12100a",
    ambient: "#0a0806",
    accent: "#e8c15a",
  },
  tiles: [WHEEL_TILE],
  monsterTable: [
    { value: "yukdo_yunhon", weight: 4 },
    { value: "yukdo_dolla", weight: 2 },
    { value: "yukdo_agnyeong", weight: 2 },
    { value: "yukdo_chihon", weight: 2 },
    { value: "yukdo_jingwe", weight: 2 },
    { value: "yukdo_yungwe", weight: 1 },
  ],
  bossId: "jeonryun",
  intro: "육도 — 오도전륜의 바퀴. 여섯 갈래 윤회가 마지막으로 되돌아온다.",
  paintHazards(level, ctx) {
    const floors = [...level.floorCells()];
    ctx.rng.shuffle(floors);
    const n = Math.floor(floors.length * (0.03 + 0.012 * ctx.depth));
    for (let i = 0; i < n; i++) level.setTile(floors[i], WHEEL_TILE.id);
  },
};
