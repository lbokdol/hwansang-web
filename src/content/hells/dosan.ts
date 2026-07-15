// 도산지옥 — 칼날 타일 = 지형 피해, 좁은 통로 (설계서 4.1).

import type { HellDef, TileDef } from "../../core/types";

const BLADE_TILE: TileDef = {
  id: "dosan_blade",
  name: "칼날",
  glyph: "ᛁ",
  fg: "#d7dde8",
  bg: "#14121c",
  walkable: true,
  opaque: false,
  hazard: { damage: 3, damageKind: "terrain", trigger: "enter" },
};

export const dosanHell: HellDef = {
  id: "dosan",
  name: "도산지옥",
  nameHanja: "刀山地獄",
  order: 1,
  floors: 3,
  palette: {
    wallFg: "#5a5366",
    wallBg: "#211d2b",
    floorFg: "#37324a",
    floorBg: "#100d18",
    ambient: "#0b0a10",
    accent: "#e0c36b",
  },
  tiles: [BLADE_TILE],
  monsterTable: [
    { value: "dosan_mangryeong", weight: 5 },
    { value: "dosan_dongsari", weight: 2 },
    { value: "dosan_gasikkamagwi", weight: 2 },
    { value: "dosan_okjol", weight: 1 },
    { value: "dosan_geomgwi", weight: 2 },
    { value: "dosan_bidogwi", weight: 2 },
  ],
  bossId: "jingwang",
  intro: "도산지옥 — 칼날의 산. 통로마다 칼이 솟아 발을 노린다.",
  paintHazards(level, ctx) {
    const floors = [...level.floorCells()];
    ctx.rng.shuffle(floors);
    const density = 0.05 + 0.02 * ctx.depth;
    const n = Math.floor(floors.length * density);
    for (let i = 0; i < n; i++) level.setTile(floors[i], BLADE_TILE.id);
  },
};
