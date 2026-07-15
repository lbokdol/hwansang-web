import { FOV } from "rot-js";
import { posKey, type Pos } from "../core/grid";
import type { Level } from "./level";

/** Recompute the level's visible set from `origin` (and accumulate explored). */
export function computeFov(level: Level, origin: Pos, radius: number): void {
  level.visible.clear();
  const fov = new FOV.PreciseShadowcasting((x, y) => {
    if (!level.inBounds(x, y)) return false;
    return !level.blocksSight({ x, y });
  });
  fov.compute(origin.x, origin.y, radius, (x, y, _r, visibility) => {
    if (visibility <= 0) return;
    const k = posKey({ x, y });
    level.visible.add(k);
    level.explored.add(k);
  });
  // The origin tile is always visible.
  const ok = posKey(origin);
  level.visible.add(ok);
  level.explored.add(ok);
}
