// 독사지옥 — 독무 늪 타일 = 밟으면 중독, 신규 4번째 지옥.

import type { HellDef, TileDef } from "../../core/types";

const POISON_TILE: TileDef = {
  id: "doksa_poison",
  name: "독무",
  glyph: "독",
  fg: "#9be36b",
  bg: "#0e1a0e",
  walkable: true,
  opaque: false,
  hazard: {
    damage: 1,
    damageKind: "poison",
    status: { kind: "poison", turns: 3, power: 2 },
    trigger: "enter",
  },
};

export const doksaHell: HellDef = {
  id: "doksa",
  name: "독사지옥",
  nameHanja: "毒蛇地獄",
  order: 4,
  floors: 3,
  palette: {
    wallFg: "#4a5a44",
    wallBg: "#18221a",
    floorFg: "#2e4030",
    floorBg: "#0c140d",
    ambient: "#08100a",
    accent: "#9be36b",
  },
  tiles: [POISON_TILE],
  monsterTable: [
    { value: "doksa_dokssa", weight: 5 },
    { value: "doksa_dongmugwi", weight: 2 },
    { value: "doksa_geochi", weight: 2 },
    { value: "doksa_maghoksu", weight: 1 },
  ],
  bossId: "ogwan",
  intro: "독사지옥 — 독무 자욱한 늪. 독사가 발목을 노리고, 한 걸음마다 독이 스민다.",
  paintHazards(level, ctx) {
    const floors = [...level.floorCells()];
    ctx.rng.shuffle(floors);
    const density = 0.06 + 0.02 * ctx.depth;
    const n = Math.floor(floors.length * density);
    for (let i = 0; i < n; i++) level.setTile(floors[i], POISON_TILE.id);
  },
};
