// Transient visual effects, decoupled from turn logic. Gameplay mutates state
// synchronously and pushes FX here; the rAF render loop decays + draws them.

import type { Pos } from "../core/grid";

export interface FloatingText {
  pos: Pos;
  text: string;
  color: string;
  age: number;
  ttl: number;
}

export interface CellFlash {
  cells: Pos[];
  color: string;
  age: number;
  ttl: number;
}

export class FxSystem {
  private shakeTime = 0;
  private shakeDuration = 0;
  private shakeMag = 0;
  floats: FloatingText[] = [];
  flashes: CellFlash[] = [];

  /** Screen shake (손맛 연출 — 설계서 M8). */
  shake(mag = 4, time = 0.22): void {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeDuration = Math.max(this.shakeDuration, time);
    this.shakeTime = Math.max(this.shakeTime, time);
  }

  floatText(pos: Pos, text: string, color = "#ffffff", ttl = 0.7): void {
    this.floats.push({ pos: { ...pos }, text, color, age: 0, ttl });
  }

  flashCells(cells: Pos[], color: string, ttl = 0.3): void {
    if (cells.length === 0) return;
    this.flashes.push({ cells: cells.map((c) => ({ ...c })), color, age: 0, ttl });
  }

  update(dt: number): void {
    if (this.shakeTime > 0) this.shakeTime = Math.max(0, this.shakeTime - dt);
    for (const f of this.floats) f.age += dt;
    for (const f of this.flashes) f.age += dt;
    this.floats = this.floats.filter((f) => f.age < f.ttl);
    this.flashes = this.flashes.filter((f) => f.age < f.ttl);
  }

  get shakeOffset(): Pos {
    if (this.shakeTime <= 0 || this.shakeDuration <= 0) return { x: 0, y: 0 };
    const t = this.shakeTime / this.shakeDuration;
    const m = this.shakeMag * t;
    // Deterministic-ish jitter based on remaining time (no Math.random needed).
    const a = this.shakeTime * 53.0;
    return { x: Math.cos(a) * m, y: Math.sin(a * 1.7) * m };
  }

  clear(): void {
    this.floats = [];
    this.flashes = [];
    this.shakeTime = 0;
  }
}
