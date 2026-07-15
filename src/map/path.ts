import { Path } from "rot-js";
import type { Pos } from "../core/grid";
import type { Level } from "./level";

/**
 * Next step from `from` toward `to` (4-dir Dijkstra), routing around walls.
 * `isBlocked` marks transiently-occupied cells (other actors); the target and
 * origin are always treated as passable so paths can terminate on the player.
 */
export function bestStepToward(
  from: Pos,
  to: Pos,
  level: Level,
  isBlocked?: (p: Pos) => boolean,
): Pos | null {
  const passable = (x: number, y: number): boolean => {
    if (!level.inBounds(x, y)) return false;
    if (x === to.x && y === to.y) return true;
    if (x === from.x && y === from.y) return true;
    if (level.isWall({ x, y })) return false;
    if (isBlocked && isBlocked({ x, y })) return false;
    return true;
  };

  const dijkstra = new Path.Dijkstra(to.x, to.y, passable, { topology: 4 });
  const route: Pos[] = [];
  dijkstra.compute(from.x, from.y, (x, y) => {
    route.push({ x, y });
  });
  // route[0] is `from`; route[1] is the next step.
  return route.length >= 2 ? route[1] : null;
}

/** Path length (steps) from `from` to `to`, or Infinity if unreachable. */
export function pathDistance(from: Pos, to: Pos, level: Level): number {
  const passable = (x: number, y: number): boolean => {
    if (!level.inBounds(x, y)) return false;
    if (x === to.x && y === to.y) return true;
    if (x === from.x && y === from.y) return true;
    return !level.isWall({ x, y });
  };
  const dijkstra = new Path.Dijkstra(to.x, to.y, passable, { topology: 4 });
  let len = -1;
  dijkstra.compute(from.x, from.y, () => {
    len++;
  });
  return len < 0 ? Infinity : len;
}
