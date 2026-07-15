import type { HellDef, TileDef } from "../../core/types";

const ICE_TILE: TileDef = {
  id: "hanbing_ice", name: "얼음", glyph: "▦", fg: "#bfe4ff", bg: "#0c1a26",
  walkable: true, opaque: false, slippery: true,
};

export const hanbingHell: HellDef = {
  id: "hanbing", name: "한빙지옥", nameHanja: "寒氷地獄", order: 3, floors: 3,
  palette: { wallFg: "#3f5e7a", wallBg: "#101a26", floorFg: "#2c4258", floorBg: "#080e16", ambient: "#05080c", accent: "#7fd0ff" },
  tiles: [ICE_TILE],
  monsterTable: [
    { value: "hanbing_hanseol", weight: 5 },
    { value: "hanbing_eoreumjogak", weight: 2 },
    { value: "hanbing_binggwi", weight: 2 },
    { value: "hanbing_seolin", weight: 1 },
    { value: "hanbing_binggungsu", weight: 2 },
    { value: "hanbing_hanseolrang", weight: 2 },
  ],
  bossId: "songje",
  intro: "한빙지옥 — 얼어붙은 황야. 발 디딘 얼음마다 미끄러져 헤어날 길이 없다.",
  paintHazards(level, ctx) {
    const floors = [...level.floorCells()];
    ctx.rng.shuffle(floors);
    const n = Math.floor(floors.length * (0.10 + 0.03 * ctx.depth));
    for (let i = 0; i < n; i++) level.setTile(floors[i], ICE_TILE.id);
  },
};
