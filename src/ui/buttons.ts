// Immediate-mode clickable-control registry for the canvas menu scenes. Each frame
// a scene calls begin(), draws controls via button()/bar() (paint + register) or bare
// hit() rects for custom-drawn rows, and forwards left clicks to click(). Keyboard
// shortcuts stay a fully independent path — buttons are purely additive.
// (Port of Godot UiButtons.cs.)

import type { Renderer } from "../render/renderer";
import { buttonFace, GOLD } from "./chrome";

interface Hit {
  x: number;
  y: number;
  w: number;
  h: number;
  onClick: () => void;
  enabled: boolean;
}

export interface BarItem {
  label: string;
  onClick: () => void;
  enabled?: boolean;
  accent?: string;
}

export class UiButtons {
  private hits: Hit[] = [];
  private mx = -1;
  private my = -1;

  /** Start a fresh frame: clear last frame's hit-rects and capture hover pos. */
  begin(r: Renderer): void {
    this.hits = [];
    this.mx = r.mouse.x;
    this.my = r.mouse.y;
  }

  isHover(x: number, y: number, w: number, h: number): boolean {
    return this.mx >= x && this.my >= y && this.mx < x + w && this.my < y + h;
  }

  /** Register a bare hit-rect (no drawing) — for already-drawn rows/areas. */
  hit(x: number, y: number, w: number, h: number, onClick: () => void, enabled = true): void {
    this.hits.push({ x, y, w, h, onClick, enabled });
  }

  /** Draw + register a labelled 불화 button. Returns whether it is hovered. */
  button(
    r: Renderer,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onClick: () => void,
    enabled = true,
    accent = GOLD,
    size = 18,
  ): boolean {
    const hover = enabled && this.isHover(x, y, w, h);
    buttonFace(r, x, y, w, h, label, hover, enabled, accent, size);
    this.hits.push({ x, y, w, h, onClick, enabled });
    return hover;
  }

  /** Lay out a horizontal bar of equal-width buttons across [x, x+w]. */
  bar(r: Renderer, x: number, y: number, w: number, h: number, gap: number, items: BarItem[], size = 18): void {
    const n = items.length;
    if (n === 0) return;
    const bw = (w - gap * (n - 1)) / n;
    items.forEach((it, i) =>
      this.button(r, x + i * (bw + gap), y, bw, h, it.label, it.onClick, it.enabled ?? true, it.accent ?? GOLD, size),
    );
  }

  /** Fire the first enabled control whose rect contains (x,y). */
  click(x: number, y: number): boolean {
    for (const h of this.hits) {
      if (h.enabled && x >= h.x && y >= h.y && x < h.x + h.w && y < h.y + h.h) {
        h.onClick();
        return true;
      }
    }
    return false;
  }
}
