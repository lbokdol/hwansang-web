// Grid primitives. v1 is strictly 4-directional (설계서 3.1).

export interface Pos {
  x: number;
  y: number;
}

export function pos(x: number, y: number): Pos {
  return { x, y };
}

export function eq(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y;
}

export function add(a: Pos, b: Pos): Pos {
  return { x: a.x + b.x, y: a.y + b.y };
}

/** String key for Set/Map usage. */
export function key(x: number, y: number): string {
  return x + "," + y;
}

export function posKey(p: Pos): string {
  return p.x + "," + p.y;
}

/** Manhattan distance (matches 4-dir movement cost). */
export function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Chebyshev distance (used for "radius" / blast effects). */
export function chebyshev(a: Pos, b: Pos): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export type Dir4 = "up" | "down" | "left" | "right";

export const DIR_VECTORS: Record<Dir4, Pos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const DIRS4: ReadonlyArray<Pos> = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

/** 8-neighborhood — used for blast/adjacency talismans (벽사부 등), not movement. */
export const DIRS8: ReadonlyArray<Pos> = [
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
];

export function dirFromKey(k: string): Pos | null {
  switch (k) {
    case "ArrowUp":
    case "w":
    case "k":
      return DIR_VECTORS.up;
    case "ArrowDown":
    case "s":
    case "j":
      return DIR_VECTORS.down;
    case "ArrowLeft":
    case "a":
    case "h":
      return DIR_VECTORS.left;
    case "ArrowRight":
    case "d":
    case "l":
      return DIR_VECTORS.right;
    default:
      return null;
  }
}
