import type { HellDef } from "../../core/types";
import { registerTile } from "../../map/tiles";
import { dosanHell } from "./dosan";
import { hwatangHell } from "./hwatang";
import { hanbingHell } from "./hanbing";
import { doksaHell } from "./doksa";

// Ordered progression. The run + victory logic keys off HELLS.length, so the
// last hell's boss is the final boss.
export const HELLS: HellDef[] = [dosanHell, hwatangHell, hanbingHell, doksaHell];

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
