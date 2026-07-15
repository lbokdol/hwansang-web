import { RNG } from "rot-js";

export interface WeightedEntry<T> {
  value: T;
  weight: number;
}

/**
 * Thin ergonomic wrapper around rot-js' RNG. A single instance is seeded per
 * run so dungeon layout + drops are reproducible from a seed.
 */
export class Rng {
  private rot: typeof RNG;

  constructor() {
    this.rot = RNG;
  }

  seed(seed: number): this {
    this.rot.setSeed(seed);
    return this;
  }

  getSeed(): number {
    return this.rot.getSeed();
  }

  /** Float in [0, 1). */
  float(): number {
    return this.rot.getUniform();
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return this.rot.getUniformInt(min, max);
  }

  /** True with probability p (0..1). */
  chance(p: number): boolean {
    return this.rot.getUniform() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.rot.getUniformInt(0, arr.length - 1)];
  }

  shuffle<T>(arr: T[]): T[] {
    // Fisher–Yates using the seeded RNG.
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.rot.getUniformInt(0, i);
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  /** Weighted pick. Returns null only if the table is empty. */
  weighted<T>(entries: ReadonlyArray<WeightedEntry<T>>): T | null {
    if (entries.length === 0) return null;
    let total = 0;
    for (const e of entries) total += Math.max(0, e.weight);
    if (total <= 0) return entries[0].value;
    let roll = this.rot.getUniform() * total;
    for (const e of entries) {
      roll -= Math.max(0, e.weight);
      if (roll < 0) return e.value;
    }
    return entries[entries.length - 1].value;
  }
}

/** Global RNG instance shared by gameplay systems. */
export const rng = new Rng();
