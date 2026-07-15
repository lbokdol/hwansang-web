import type { HellDef } from "../../core/types";
import { registerTile } from "../../map/tiles";
import { dosanHell } from "./dosan";
import { hwatangHell } from "./hwatang";
import { hanbingHell } from "./hanbing";
import { doksaHell } from "./doksa";
import { balseolHell } from "./balseol";
import { yangdongHell } from "./yangdong";
import { geohaeHell } from "./geohae";
import { heukseungHell } from "./heukseung";
import { pungdoHell } from "./pungdo";
import { yukdoHell } from "./yukdo";

// Ordered progression (십대왕 / 十地獄). 얕은 옥 4 → 깊은 옥 5 → 오도전륜 피날레.
// The run + victory logic keys off HELLS.length, so the last hell's boss is the
// final boss; run.ts shuffles within tiers (see buildHellOrder).
export const HELLS: HellDef[] = [
  dosanHell,
  hwatangHell,
  hanbingHell,
  doksaHell,
  balseolHell,
  yangdongHell,
  geohaeHell,
  heukseungHell,
  pungdoHell,
  yukdoHell,
];

/** Register every hell's hazard tiles into the global tile registry (call once at boot). */
export function registerAllHellTiles(): void {
  for (const hell of HELLS) {
    for (const tile of hell.tiles) registerTile(tile);
  }
}

export function hellByIndex(i: number): HellDef {
  return HELLS[Math.max(0, Math.min(i, HELLS.length - 1))];
}

export const FINAL_HELL_INDEX = (): number => HELLS.length - 1;
