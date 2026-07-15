// UI chrome — turns the text-only menus into framed 불화(佛畵) panels, matching the
// Godot client's look. Draws the ported UI sprites (frame / button plate / plaque /
// divider / icons / bar / slot) when present, with crisp procedural fallbacks so a
// scene still reads as designed even if an asset is missing. (Port of Godot Ui.cs.)

import type { Renderer } from "../render/renderer";
import { uiSprite } from "../render/sprites";

export const GOLD = "#e0c36b";
export const GOLD_HI = "#ffe9a8";
export const INK = "#0a0810";
export const PANEL_FILL = "#0d0b14";
export const PARCHMENT = "#cdbfa6";
export const MUTED = "#6b6478";

// 9-slice tuning (fractions/margins carried over from the Godot cut textures).
const FRAME_MARGIN_FRAC = 0.16;
const FRAME_DST_MARGIN = 30;
const BTN_MARGIN_FRAC = 0.24;
const BTN_DST_MARGIN = 16;
const BAR_SRC_MX_FRAC = 0.11;
const BAR_DST_MX = 14;
const BAR_END_INSET = 11;
const BAR_RIM_INSET = 4;

/** #rrggbb + alpha → rgba() string. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Full-screen scene backdrop: cover art + scrim + vignette, or a flat fallback. */
export function backdrop(r: Renderer, bg: HTMLImageElement | null, fallback = "#0b0a10", scrim = 0.42): void {
  r.clear(fallback);
  if (bg) {
    r.cover(bg);
    if (scrim > 0) r.rect(0, 0, r.width, r.height, `rgba(8,6,12,${scrim})`);
  }
  r.vignette(0.5);
}

/** A framed parchment panel to hold a block of text/list. */
export function panel(r: Renderer, x: number, y: number, w: number, h: number, fillAlpha = 0.84): void {
  r.rect(x, y, w, h, alpha(PANEL_FILL, fillAlpha));
  const fr = uiSprite("frame");
  if (fr) {
    r.strokeRect(x + 1, y + 1, w - 2, h - 2, INK, 2);
    const srcM = Math.min(fr.naturalWidth, fr.naturalHeight) * FRAME_MARGIN_FRAC;
    r.panel9(fr, x, y, w, h, srcM, FRAME_DST_MARGIN);
  } else {
    r.strokeRect(x, y, w, h, INK, 3);
    r.strokeRect(x + 4, y + 4, w - 8, h - 8, GOLD, 1);
  }
}

/** Title plaque (현판) behind a heading; returns its height so text can sit on it. */
export function titlePlate(r: Renderer, cx: number, cy: number, targetW: number): number {
  const plate = uiSprite("title_plate");
  if (plate) {
    const aspect = plate.naturalHeight / plate.naturalWidth;
    const w = Math.min(targetW, (targetW * 0.5) / aspect);
    const h = w * aspect;
    r.image(plate, cx - w / 2, cy - h / 2, w, h);
    return h;
  }
  const w = targetW;
  const h = targetW * 0.34;
  r.rect(cx - w / 2, cy - h / 2, w, h, alpha("#160e14", 0.9));
  r.strokeRect(cx - w / 2, cy - h / 2, w, h, INK, 3);
  r.strokeRect(cx - w / 2 + 5, cy - h / 2 + 5, w - 10, h - 10, GOLD, 1);
  return h;
}

/** Horizontal section divider — ink-brush ornament, or a thin gold rule. */
export function divider(r: Renderer, cx: number, y: number, w: number): void {
  const div = uiSprite("divider");
  if (div) {
    let dh = 40;
    let dw = (dh * div.naturalWidth) / div.naturalHeight;
    if (dw > w) {
      dw = w;
      dh = (dw * div.naturalHeight) / div.naturalWidth;
    }
    r.image(div, cx - dw / 2, y - dh / 2, dw, dh);
  } else {
    r.rect(cx - w / 2, y, w, 1, alpha(GOLD, 0.5));
  }
}

/** True if the named UI icon exists (so callers can reserve gutter space). */
export function hasIcon(key: string): boolean {
  return uiSprite(key) != null;
}

/** Draw a UI icon centered at (cx,cy), aspect-fit into size×size. */
export function icon(r: Renderer, key: string, cx: number, cy: number, size: number): void {
  const ic = uiSprite(key);
  if (ic) r.imageFit(ic, cx, cy, size);
}

/** 불화 button face: lacquer plate + label, brightening on hover, dim when disabled. */
export function buttonFace(
  r: Renderer,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  hover: boolean,
  enabled: boolean,
  accent = GOLD,
  size = 18,
): void {
  const tex = (hover ? uiSprite("btn_hover") : null) ?? uiSprite("btn");
  if (tex) {
    const srcM = Math.min(tex.naturalWidth, tex.naturalHeight) * BTN_MARGIN_FRAC;
    r.panel9(tex, x, y, w, h, srcM, BTN_DST_MARGIN, enabled ? 1 : 0.5, true);
  } else {
    const fill = !enabled ? alpha("#0b0a12", 0.66) : hover ? alpha("#251d34", 0.96) : alpha(PANEL_FILL, 0.88);
    r.rect(x, y, w, h, fill);
    r.strokeRect(x + 1, y + 1, w - 2, h - 2, INK, 2);
    const border = !enabled ? MUTED : hover ? GOLD_HI : accent;
    r.strokeRect(x + 3, y + 3, w - 6, h - 6, border, hover ? 2 : 1);
  }
  const col = !enabled ? "#5a5466" : hover ? GOLD_HI : "#ecdfc2";
  r.text(label, x + w / 2, y + h / 2 + size * 0.35, { color: col, size, align: "center", bold: true });
}

/** Gauge trough (dark bed); returns the inner rect fills go into. */
export function barTrough(r: Renderer, x: number, y: number, w: number, h: number): { x: number; y: number; w: number; h: number } {
  const skinned = uiSprite("bar") != null;
  const ix = skinned ? BAR_END_INSET : 1;
  const iy = skinned ? BAR_RIM_INSET : 1;
  const inner = { x: x + ix, y: y + iy, w: w - 2 * ix, h: h - 2 * iy };
  r.rect(inner.x, inner.y, inner.w, inner.h, alpha("#120f1a", 0.96));
  return inner;
}

/** 불화 stat gauge (HP/정기): trough + fill + gloss + framed ends. */
export function bar(r: Renderer, x: number, y: number, w: number, h: number, frac: number, fill: string): void {
  const inner = barTrough(r, x, y, w, h);
  const v = Math.max(0, Math.min(1, frac));
  if (v > 0) {
    const fw = inner.w * v;
    r.rect(inner.x, inner.y, fw, inner.h, fill);
    r.rect(inner.x, inner.y, fw, Math.max(1, inner.h * 0.4), "rgba(255,255,255,0.13)");
  }
  const fr = uiSprite("bar");
  if (fr) {
    r.slice3H(fr, x, y, w, h, fr.naturalWidth * BAR_SRC_MX_FRAC, BAR_DST_MX);
  } else {
    r.strokeRect(x, y, w, h, INK, 2);
    r.strokeRect(x, y, w, h, "#7a6a2e", 1);
  }
}

/** Talisman/item slot frame (sel = selected highlight). */
export function slot(r: Renderer, x: number, y: number, s: number, sel: boolean): void {
  const tex = (sel ? uiSprite("slot_sel") : null) ?? uiSprite("slot");
  if (tex) {
    r.image(tex, x, y, s, s);
    if (sel && !uiSprite("slot_sel")) r.strokeRect(x + 1, y + 1, s - 2, s - 2, GOLD_HI, 2);
  } else {
    r.rect(x, y, s, s, "#15121d");
    r.strokeRect(x, y, s, s, sel ? GOLD_HI : "#3a3550", sel ? 2 : 1);
  }
}

/** Greedy word/char wrap that respects spaces (en) and no-space (ko/zh) alike. */
export function wrap(r: Renderer, s: string, size: number, maxW: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const ch of s) {
    if (ch === "\n") {
      lines.push(cur);
      cur = "";
      continue;
    }
    const trial = cur + ch;
    if (cur.length > 0 && r.measure(trial, size) > maxW) {
      const sp = cur.lastIndexOf(" ");
      if (sp > 0 && sp > cur.length - 16) {
        lines.push(cur.slice(0, sp));
        cur = cur.slice(sp + 1) + ch;
      } else {
        lines.push(cur);
        cur = ch;
      }
    } else {
      cur = trial;
    }
  }
  if (cur.length > 0) lines.push(cur);
  return lines;
}
