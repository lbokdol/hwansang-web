// 풍도지옥(風途地獄) — 깊은 court 9왕 도시대왕. 풍식(squall).
// 동적 바람길 변위(WindTick)는 정적 산포로 단순화 이식.

import type { HellDef, TileDef } from "../../core/types";

const SQUALL_TILE: TileDef = {
  id: "pungdo_squall",
  name: "풍식",
  glyph: "≈",
  fg: "#cbb98a",
  bg: "#14120e",
  walkable: true,
  opaque: false,
  hazard: { damage: 2, damageKind: "terrain", trigger: "enter" },
};

export const pungdoHell: HellDef = {
  id: "pungdo",
  name: "풍도지옥",
  nameHanja: "風途地獄",
  order: 9,
  floors: 3,
  palette: {
    wallFg: "#5c5850",
    wallBg: "#1c1a16",
    floorFg: "#3a3730",
    floorBg: "#0e0d0a",
    ambient: "#080706",
    accent: "#cbb98a",
  },
  tiles: [SQUALL_TILE],
  monsterTable: [
    { value: "pungdo_pungnyeong", weight: 4 },
    { value: "pungdo_jilpung", weight: 2 },
    { value: "pungdo_dolpung", weight: 2 },
    { value: "pungdo_maebok", weight: 2 },
    { value: "pungdo_pungsul", weight: 2 },
    { value: "pungdo_hoeori", weight: 1 },
  ],
  bossId: "dosi",
  intro: "풍도지옥 — 살을 에는 바람의 옥. 기류가 발을 붙들어 떠민다.",
  paintHazards(level, ctx) {
    const floors = [...level.floorCells()];
    ctx.rng.shuffle(floors);
    const n = Math.floor(floors.length * (0.03 + 0.012 * ctx.depth));
    for (let i = 0; i < n; i++) level.setTile(floors[i], SQUALL_TILE.id);
  },
};
