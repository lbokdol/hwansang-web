// 화탕지옥 — 끓는 가마와 번지는 불바다 (설계서 4.2).

import type { HellDef, TileDef } from "../../core/types";
import type { Pos } from "../../core/grid";
import { pos, add, DIRS4 } from "../../core/grid";

const LAVA_TILE: TileDef = {
  id: "hwatang_lava",
  name: "불바다",
  glyph: "≈",
  fg: "#ff9a4a",
  bg: "#3a1206",
  walkable: true,
  opaque: false,
  hazard: {
    damage: 4,
    damageKind: "fire",
    status: { kind: "burn", turns: 2, power: 2 },
    trigger: "enter",
  },
};

export const hwatangHell: HellDef = {
  id: "hwatang",
  name: "화탕지옥",
  nameHanja: "火湯地獄",
  order: 2,
  floors: 3,
  palette: {
    wallFg: "#6e3b2e",
    wallBg: "#2a140e",
    floorFg: "#5a2e22",
    floorBg: "#160a08",
    ambient: "#0c0604",
    accent: "#ff7a3c",
  },
  tiles: [LAVA_TILE],
  monsterTable: [
    { value: "hwatang_hwaryeong", weight: 5 },
    { value: "hwatang_hwagwi", weight: 2 },
    { value: "hwatang_bulnabang", weight: 2 },
    { value: "hwatang_kkeulhokjol", weight: 1 },
    { value: "hwatang_hwayeomsulsa", weight: 2 },
    { value: "hwatang_yongamgeobuk", weight: 1 },
  ],
  bossId: "chogang",
  intro: "화탕지옥 — 끓는 가마의 바다. 불길이 발밑에서 번져 온다.",
  paintHazards(level, ctx) {
    const floors = [...level.floorCells()];
    ctx.rng.shuffle(floors);
    const density = 0.06 + 0.02 * ctx.depth;
    const n = Math.floor(floors.length * density);
    for (let i = 0; i < n; i++) level.setTile(floors[i], LAVA_TILE.id);
  },
  // 번지는 불바다 — occasionally creep into adjacent plain floor (capped per tick).
  onFloorTick(ctx) {
    if (!ctx.rng.chance(0.18)) return;
    const level = ctx.level;
    const lavaCells: Pos[] = [];
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        if (level.tileIdAt(pos(x, y)) === LAVA_TILE.id) lavaCells.push(pos(x, y));
      }
    }
    if (lavaCells.length === 0) return;
    ctx.rng.shuffle(lavaCells);
    const cap = 2;
    let spawned = 0;
    for (const cell of lavaCells) {
      if (spawned >= cap) break;
      const dirs = ctx.rng.shuffle([...DIRS4]);
      for (const d of dirs) {
        const np = add(cell, d);
        if (level.tileIdAt(np) === "floor") {
          level.setTile(np, LAVA_TILE.id);
          spawned++;
          break;
        }
      }
    }
  },
};
