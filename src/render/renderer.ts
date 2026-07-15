import { GlyphAtlas, TILE_FONT } from "./atlas";
import { posKey, type Pos } from "../core/grid";
import { T_FLOOR, T_STAIRS, T_WALL } from "../map/tiles";
import type { Level } from "../map/level";
import type { FxSystem } from "./fx";
import type { HellPalette } from "../core/types";
import {
  actorScale,
  altarSprite,
  enemySprite,
  floorSprite,
  playerSprite,
  talismanSprite,
  tileSprite,
  weaponSprite,
} from "./sprites";
import { getWeapon } from "../content/weapons";

export interface TextOpts {
  color?: string;
  size?: number;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  bold?: boolean;
  font?: string;
}

export const HUD_HEIGHT = 142;

/** Canvas renderer: world tiles + entities + FX, plus primitives for scenes. */
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  dpr = 1;
  width = 0;
  height = 0;
  tile = 26;
  /** Bottom px reserved for on-screen touch controls (0 on desktop). */
  uiInsetBottom = 0;
  private atlas: GlyphAtlas;
  private clock = 0;

  // Last frame's world->screen mapping (for input hit-testing if needed).
  camX = 0;
  camY = 0;
  originX = 0;
  originY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.atlas = new GlyphAtlas(this.tile, 1);
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.width = w;
    this.height = h;
  }

  tickClock(dt: number): void {
    this.clock += dt;
  }

  // --- primitives (CSS-pixel space) ----------------------------------------

  clear(color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  strokeRect(x: number, y: number, w: number, h: number, color: string, lw = 1): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lw;
    this.ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  text(s: string, x: number, y: number, o: TextOpts = {}): void {
    const size = o.size ?? 16;
    this.ctx.font = `${o.bold ? "bold " : ""}${size}px ${o.font ?? TILE_FONT}`;
    this.ctx.fillStyle = o.color ?? "#f4ead2";
    this.ctx.textAlign = o.align ?? "left";
    this.ctx.textBaseline = o.baseline ?? "alphabetic";
    this.ctx.fillText(s, x, y);
  }

  measure(s: string, size = 16, bold = false): number {
    this.ctx.font = `${bold ? "bold " : ""}${size}px ${TILE_FONT}`;
    return this.ctx.measureText(s).width;
  }

  bar(x: number, y: number, w: number, h: number, frac: number, fg: string, bg = "#1c1826"): void {
    this.rect(x, y, w, h, bg);
    this.rect(x, y, Math.max(0, Math.min(1, frac)) * w, h, fg);
    this.strokeRect(x, y, w, h, "#000");
  }

  /** Draw a sprite aspect-fit, centered at (cx, cy) within a box of side `box`. */
  imageFit(img: HTMLImageElement, cx: number, cy: number, box: number): void {
    const aspect = img.naturalHeight / img.naturalWidth;
    const w = aspect > 1 ? box / aspect : box;
    const h = aspect > 1 ? box : box * aspect;
    this.ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  }

  /** Draw a sprite to cover a rect (for backgrounds). */
  imageCover(img: HTMLImageElement, x: number, y: number, w: number, h: number): void {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    this.ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  glyph(cx: number, cy: number, ch: string, fg: string, bg?: string, size = this.tile): void {
    // One-off glyph (used by scenes / HUD icons), drawn centered at (cx,cy).
    this.ctx.font = `${Math.floor(size * 0.74)}px ${TILE_FONT}`;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    if (bg) {
      this.ctx.fillStyle = bg;
      this.ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    }
    this.ctx.fillStyle = fg;
    this.ctx.fillText(ch, cx, cy + size * 0.06);
  }

  /** Effective bottom edge for bottom-anchored UI (above the touch controls). */
  get contentBottom(): number {
    return this.height - this.uiInsetBottom;
  }

  get mapAreaHeight(): number {
    return this.contentBottom - HUD_HEIGHT;
  }

  /** Narrow viewport (phone portrait) — scenes reflow when true. */
  get narrow(): boolean {
    return this.width < 720;
  }

  // --- world rendering ------------------------------------------------------

  drawWorld(level: Level, player: Pos, fx: FxSystem): void {
    const palette = level.hell.palette;
    const areaW = this.width;
    const areaH = this.mapAreaHeight;

    // Fewer columns (bigger tiles) on narrow screens so the grid stays readable.
    const colTarget = this.narrow ? 13 : 28;
    const rowTarget = this.narrow ? 18 : 19;
    this.tile = Math.max(16, Math.min(44, Math.floor(Math.min(areaH / rowTarget, areaW / colTarget))));
    this.atlas.setMetrics(this.tile, this.dpr);
    const tile = this.tile;

    const cols = Math.floor(areaW / tile);
    const rows = Math.floor(areaH / tile);
    this.camX = clamp(player.x - Math.floor(cols / 2), 0, Math.max(0, level.width - cols));
    this.camY = clamp(player.y - Math.floor(rows / 2), 0, Math.max(0, level.height - rows));

    const shake = fx.shakeOffset;
    this.originX = Math.round((areaW - cols * tile) / 2 + shake.x);
    this.originY = Math.round((areaH - rows * tile) / 2 + shake.y);

    // ambient backdrop for the map area
    this.rect(0, 0, this.width, areaH, palette.ambient);

    const ctx = this.ctx;
    for (let sy = 0; sy < rows; sy++) {
      for (let sx = 0; sx < cols; sx++) {
        const wx = this.camX + sx;
        const wy = this.camY + sy;
        if (!level.inBounds(wx, wy)) continue;
        const p = { x: wx, y: wy };
        const k = posKey(p);
        const explored = level.explored.has(k);
        if (!explored) continue;
        const visible = level.visible.has(k);
        const px = this.originX + sx * tile;
        const py = this.originY + sy * tile;
        const id = level.tileIdAt(p);
        const spr = tileSprite(id, level.hell.id);
        if (spr) {
          if (id === T_STAIRS) {
            // Floor underneath, then the stairs object enlarged & bottom-anchored.
            const fl = floorSprite(level.hell.id);
            if (fl) ctx.drawImage(fl, px, py, tile, tile);
            this.drawActorSprite(spr, px, py, tile, false, 1.35);
          } else {
            ctx.drawImage(spr, px, py, tile, tile); // seamless full-cell tile
          }
        } else {
          const { glyph, fg, bg } = this.tileVisual(level, p, palette);
          ctx.drawImage(this.atlas.get(glyph, fg, bg), px, py, tile, tile);
        }
        if (!visible) {
          ctx.fillStyle = "rgba(6,5,10,0.58)";
          ctx.fillRect(px, py, tile, tile);
        }
      }
    }

    // altars (visible only) — bottom-anchored & enlarged to match characters
    for (const a of level.altars) {
      if (!level.visible.has(posKey(a.pos))) continue;
      const spr = altarSprite();
      if (spr) {
        const px = this.originX + (a.pos.x - this.camX) * tile;
        const py = this.originY + (a.pos.y - this.camY) * tile;
        this.drawActorSprite(spr, px, py, tile, false, 2.0);
      } else {
        const col = a.kind === "heal" ? "#7be0a0" : a.kind === "hp" ? "#e0698a" : "#ffd86b";
        this.drawCellGlyph(a.pos, "제", col, "rgba(20,30,24,0.5)");
      }
    }

    // drops (visible only) — the talisman, small & centered (a ground item)
    for (const d of level.drops) {
      if (!level.visible.has(posKey(d.pos))) continue;
      const spr = talismanSprite(d.talismanId);
      if (spr) this.drawCellSprite(d.pos, spr, 0.85);
      else this.drawCellGlyph(d.pos, "부", palette.accent, undefined);
    }

    // weapon drops (visible only)
    for (const d of level.weaponDrops) {
      if (!level.visible.has(posKey(d.pos))) continue;
      const spr = weaponSprite(d.weaponId);
      if (spr) this.drawCellSprite(d.pos, spr, 0.9);
      else {
        const w = getWeapon(d.weaponId);
        this.drawCellGlyph(d.pos, w.glyph, w.color, "rgba(20,20,30,0.45)");
      }
    }

    // telegraphs (under actors) — pulsing warning tint
    const pulse = 0.28 + 0.22 * (0.5 + 0.5 * Math.sin(this.clock * 8));
    for (const a of level.actors) {
      if (!a.alive || a.telegraph.length === 0) continue;
      for (const mark of a.telegraph) {
        for (const c of mark.cells) {
          if (!level.visible.has(posKey(c))) continue;
          this.fillCell(c, hexA(mark.color, pulse));
        }
      }
    }

    // actors (visible only) — sorted by Y so lower actors overlap upper ones'
    // tall-sprite overflow correctly.
    const actors = level.actors
      .filter((a) => a.alive && level.visible.has(posKey(a.pos)))
      .sort((a, b) => a.pos.y - b.pos.y);
    for (const a of actors) {
      const meta = a as { def?: { id: string }; isBoss?: boolean };
      const spr = a.isPlayer ? playerSprite() : enemySprite(meta.def?.id ?? "");
      const px = this.originX + (a.pos.x - this.camX) * tile;
      const py = this.originY + (a.pos.y - this.camY) * tile;
      if (spr) {
        this.drawActorSprite(spr, px, py, tile, a.flashTurns > 0, actorScale(meta.def?.id ?? "", !!meta.isBoss));
      } else {
        const flash = a.flashTurns > 0;
        this.drawCellGlyph(a.pos, a.glyph, flash ? "#fff" : a.color, flash ? "rgba(255,90,90,0.5)" : undefined);
      }
      if (a.isEnemy && a.hpFraction < 1) {
        this.bar(px + 2, py + tile - 4, tile - 4, 3, a.hpFraction, "#d6455f", "rgba(0,0,0,0.6)");
      }
    }

    // fx flashes
    for (const f of fx.flashes) {
      const alpha = (1 - f.age / f.ttl) * 0.5;
      for (const c of f.cells) {
        if (!level.visible.has(posKey(c))) continue;
        this.fillCell(c, hexA(f.color, alpha));
      }
    }

    // floating combat text
    for (const f of fx.floats) {
      const t = f.age / f.ttl;
      const px = this.originX + (f.pos.x - this.camX) * tile + tile / 2;
      const py = this.originY + (f.pos.y - this.camY) * tile - t * tile * 0.8;
      if (py < 0 || py > areaH) continue;
      this.ctx.globalAlpha = 1 - t;
      this.text(f.text, px, py, { color: f.color, size: Math.floor(tile * 0.55), align: "center", bold: true });
      this.ctx.globalAlpha = 1;
    }
  }

  /** Screen rect (CSS px) for a world cell, using the last drawWorld mapping. */
  worldToScreen(p: Pos): { x: number; y: number; size: number } {
    return {
      x: this.originX + (p.x - this.camX) * this.tile,
      y: this.originY + (p.y - this.camY) * this.tile,
      size: this.tile,
    };
  }

  private fillCell(p: Pos, color: string): void {
    const px = this.originX + (p.x - this.camX) * this.tile;
    const py = this.originY + (p.y - this.camY) * this.tile;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(px, py, this.tile, this.tile);
  }

  private drawCellGlyph(p: Pos, glyph: string, fg: string, bg?: string): void {
    const px = this.originX + (p.x - this.camX) * this.tile;
    const py = this.originY + (p.y - this.camY) * this.tile;
    this.ctx.drawImage(this.atlas.get(glyph, fg, bg), px, py, this.tile, this.tile);
  }

  /** Draw a sprite aspect-fit, centered within a cell, at scale×tile (ground items). */
  private drawCellSprite(p: Pos, img: HTMLImageElement, scale: number): void {
    const px = this.originX + (p.x - this.camX) * this.tile;
    const py = this.originY + (p.y - this.camY) * this.tile;
    const box = this.tile * scale;
    const aspect = img.naturalHeight / img.naturalWidth;
    const w = aspect > 1 ? box / aspect : box;
    const h = aspect > 1 ? box : box * aspect;
    this.ctx.drawImage(img, px + (this.tile - w) / 2, py + (this.tile - h) / 2, w, h);
  }

  // Cache of red-tinted silhouettes (constant per sprite) so the hit-flash isn't
  // recomputed every frame of the continuous rAF loop.
  private tintCache = new WeakMap<HTMLImageElement, HTMLCanvasElement>();

  private tintedSprite(img: HTMLImageElement): HTMLCanvasElement {
    const cached = this.tintCache.get(img);
    if (cached) return cached;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = "source-atop"; // tint only the sprite's pixels
    g.fillStyle = "#ff5050";
    g.fillRect(0, 0, c.width, c.height);
    this.tintCache.set(img, c);
    return c;
  }

  /**
   * Draw a character sprite with consistent visual "mass" regardless of pose:
   * area-based (geometric-mean) sizing so wide action poses aren't shrunk the
   * way width-only scaling does. `presence` ≈ √area in tile units. Feet at cell bottom.
   */
  private drawActorSprite(
    img: HTMLImageElement,
    px: number,
    py: number,
    tile: number,
    flash: boolean,
    presence = 1,
  ): void {
    // Clamp extreme aspects so very wide/tall sprites don't overflow absurdly.
    const aspect = Math.max(0.65, Math.min(img.naturalHeight / img.naturalWidth, 2.2));
    const s = Math.sqrt(aspect);
    const w = (tile * presence) / s; // wide poses get wider, but never tiny in height
    const h = tile * presence * s;
    const dx = px + (tile - w) / 2; // center horizontally (sprites overflow sideways)
    const dy = py + tile - h; // bottom-anchored (tall sprites overflow upward)
    this.ctx.drawImage(img, dx, dy, w, h);
    if (flash) {
      this.ctx.globalAlpha = 0.55;
      this.ctx.drawImage(this.tintedSprite(img), dx, dy, w, h);
      this.ctx.globalAlpha = 1;
    }
  }

  private tileVisual(level: Level, p: Pos, palette: HellPalette): { glyph: string; fg: string; bg: string } {
    const id = level.tileIdAt(p);
    const def = level.tileAt(p);
    if (id === T_WALL) return { glyph: def.glyph, fg: palette.wallFg, bg: palette.wallBg };
    if (id === T_FLOOR) return { glyph: def.glyph, fg: palette.floorFg, bg: palette.floorBg };
    return { glyph: def.glyph, fg: def.fg, bg: def.bg };
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Apply an alpha (0..1) to a #rrggbb color. */
function hexA(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
