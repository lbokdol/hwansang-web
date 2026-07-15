// 거해지옥(鋸解地獄) — 깊은 court 7왕 태산대왕. 톱날(saw).
// 동적 이동 톱날(SawTick)은 정적 산포로 단순화 이식.

import type { HellDef, TileDef } from "../../core/types";

const SAW_TILE: TileDef = {
  id: "geohae_saw",
  name: "톱날",
  glyph: "╳",
  fg: "#d65a5a",
  bg: "#141416",
  walkable: true,
  opaque: false,
  hazard: { damage: 4, damageKind: "physical", status: { kind: "bleed", turns: 2, power: 2 }, trigger: "enter" },
};

export const geohaeHell: HellDef = {
  id: "geohae",
  name: "거해지옥",
  nameHanja: "鋸解地獄",
  order: 7,
  floors: 3,
  palette: {
    wallFg: "#5a5e64",
    wallBg: "#1a1c20",
    floorFg: "#3a3e44",
    floorBg: "#0e0f12",
    ambient: "#070809",
    accent: "#c0c6cc",
  },
  tiles: [SAW_TILE],
  monsterTable: [
    { value: "geohae_georyeong", weight: 4 },
    { value: "geohae_yangdan", weight: 2 },
    { value: "geohae_galgori", weight: 2 },
    { value: "geohae_bandong", weight: 2 },
    { value: "geohae_mihok", weight: 2 },
    { value: "geohae_geoak", weight: 1 },
  ],
  bossId: "taesan",
  intro: "거해지옥 — 톱으로 몸을 켜는 옥. 궤도를 따라 톱날이 오간다.",
  paintHazards(level, ctx) {
    const floors = [...level.floorCells()];
    ctx.rng.shuffle(floors);
    const n = Math.floor(floors.length * (0.04 + 0.015 * ctx.depth));
    for (let i = 0; i < n; i++) level.setTile(floors[i], SAW_TILE.id);
  },
};
