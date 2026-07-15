// Programmatic tile atlas. Each (glyph, fg, bg) is rendered once into an
// offscreen canvas tile and cached, so the main loop just blits tiles. Swapping
// in real sprite art later means replacing `get()` with an image lookup.

export const TILE_FONT = "'Malgun Gothic','Noto Sans KR','Apple SD Gothic Neo',monospace";

export class GlyphAtlas {
  private cache = new Map<string, HTMLCanvasElement>();
  private size: number;
  private dpr: number;

  constructor(size: number, dpr: number) {
    this.size = size;
    this.dpr = dpr;
  }

  setMetrics(size: number, dpr: number): void {
    if (size !== this.size || dpr !== this.dpr) {
      this.size = size;
      this.dpr = dpr;
      this.cache.clear();
    }
  }

  get(glyph: string, fg: string, bg?: string): HTMLCanvasElement {
    const key = `${glyph}|${fg}|${bg ?? ""}|${this.size}|${this.dpr}`;
    const hit = this.cache.get(key);
    if (hit) return hit;

    const px = Math.round(this.size * this.dpr);
    const c = document.createElement("canvas");
    c.width = px;
    c.height = px;
    const g = c.getContext("2d")!;
    if (bg && bg !== "transparent") {
      g.fillStyle = bg;
      g.fillRect(0, 0, px, px);
    }
    g.fillStyle = fg;
    g.font = `${Math.floor(px * 0.74)}px ${TILE_FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(glyph, px / 2, px / 2 + px * 0.06);
    this.cache.set(key, c);
    return c;
  }
}
