// 흑승지옥(黑繩地獄) — 깊은 court 8왕 평등대왕. 먹줄(ink).
// 동적 먹줄 쓸기(RopeTick)는 정적 산포로 단순화 이식.

import type { HellDef, TileDef } from "../../core/types";

const INK_TILE: TileDef = {
  id: "heukseung_ink",
  name: "먹줄",
  glyph: "═",
  fg: "#c23a3a",
  bg: "#111114",
  walkable: true,
  opaque: false,
  hazard: { damage: 3, damageKind: "terrain", trigger: "enter" },
};

export const heukseungHell: HellDef = {
  id: "heukseung",
  name: "흑승지옥",
  nameHanja: "黑繩地獄",
  order: 8,
  floors: 3,
  palette: {
    wallFg: "#4a4e56",
    wallBg: "#14161a",
    floorFg: "#33373e",
    floorBg: "#0d0e11",
    ambient: "#070809",
    accent: "#c23a3a",
  },
  tiles: [INK_TILE],
  monsterTable: [
    { value: "heukseung_seolryeong", weight: 4 },
    { value: "heukseung_yeoldan", weight: 2 },
    { value: "heukseung_gakja", weight: 2 },
    { value: "heukseung_pyeongjun", weight: 2 },
    { value: "heukseung_gyeonggwi", weight: 2 },
    { value: "heukseung_gyunhyeong", weight: 1 },
  ],
  bossId: "pyeongdeung",
  intro: "흑승지옥 — 먹줄로 몸을 재어 켜는 옥. 검은 줄이 방을 가로지른다.",
  paintHazards(level, ctx) {
    const floors = [...level.floorCells()];
    ctx.rng.shuffle(floors);
    const n = Math.floor(floors.length * (0.03 + 0.012 * ctx.depth));
    for (let i = 0; i < n; i++) level.setTile(floors[i], INK_TILE.id);
  },
};
