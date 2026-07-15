// Tile registry. Core tiles (wall/floor/stairs) live here; each hell registers
// its own hazard tiles (도산 칼날 / 화탕 불바다 / 한빙 얼음) into the same map.

import type { TileDef, TileId } from "../core/types";

export const T_WALL = "wall";
export const T_FLOOR = "floor";
export const T_STAIRS = "stairs_down";

const TILES = new Map<TileId, TileDef>();

export function registerTile(def: TileDef): void {
  TILES.set(def.id, def);
}

export function getTile(id: TileId): TileDef {
  const t = TILES.get(id);
  if (!t) throw new Error(`unknown tile id: ${id}`);
  return t;
}

export function hasTile(id: TileId): boolean {
  return TILES.has(id);
}

// --- core tiles ------------------------------------------------------------
// Wall/floor visuals are overridden per-hell by the palette at render time;
// the colors here are neutral fallbacks.

registerTile({
  id: T_WALL,
  name: "벽",
  glyph: "#",
  fg: "#4a4458",
  bg: "#1a1722",
  walkable: false,
  opaque: true,
});

registerTile({
  id: T_FLOOR,
  name: "바닥",
  glyph: "·",
  fg: "#3a3550",
  bg: "#0e0c16",
  walkable: true,
  opaque: false,
});

registerTile({
  id: T_STAIRS,
  name: "계단",
  glyph: ">",
  fg: "#ffe9a8",
  bg: "#0e0c16",
  walkable: true,
  opaque: false,
});
