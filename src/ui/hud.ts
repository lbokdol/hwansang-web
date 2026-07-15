import { Renderer, HUD_HEIGHT } from "../render/renderer";
import { STATUS_META } from "../core/status";
import { getTalisman } from "../content/talismans";
import { statusSprite, talismanSprite } from "../render/sprites";
import type { Run } from "../game/run";

const PANEL_BG = "#0d0b14";
const BORDER = "#2a2536";
const INK = "#cdbfa6";
const DIM = "#7a7388";

export function drawHud(r: Renderer, run: Run, selectedIndex = -1): void {
  const W = r.width;
  const H = r.contentBottom; // anchor above the touch controls on mobile
  const y0 = H - HUD_HEIGHT;

  r.rect(0, y0, W, HUD_HEIGHT, PANEL_BG);
  r.rect(0, y0, W, 2, BORDER);

  const p = run.player;
  const pad = 14;

  // --- stats column ---------------------------------------------------------
  let y = y0 + 24;
  r.text(`${p.name}`, pad, y, { color: "#f4ead2", size: 16, bold: true });
  r.text(`업 ${run.meta.karma}`, pad + 120, y, { color: "#ffd86b", size: 14 });
  y += 14;

  // HP bar
  r.bar(pad, y, 220, 14, p.hpFraction, "#c43b54", "#241019");
  r.text(`혼백 ${p.stats.hp}/${p.stats.maxHp}`, pad + 8, y + 12, { color: "#fff", size: 12, bold: true });
  y += 18;

  // 정기(경험치) bar + 영급
  r.bar(pad, y, 220, 8, p.jeonggiProgress, "#9bd1ff", "#141a26");
  r.text(`영급 ${p.level}`, pad + 226, y + 8, { color: "#9bd1ff", size: 12, bold: true });
  y += 18;

  // core stats + equipped weapon
  const atkStr = p.weapon.atkBonus ? `${p.stats.atk}+${p.weapon.atkBonus}` : `${p.stats.atk}`;
  r.text(`공 ${atkStr}   방 ${p.stats.def}`, pad, y, { color: INK, size: 13 });
  r.text(`무기 ${p.weapon.name}`, pad + 110, y, { color: p.weapon.color, size: 12 });
  if (p.invulnTurns > 0) r.text(`무적 ${p.invulnTurns}`, pad + 230, y, { color: "#ffd86b", size: 13 });
  y += 20;

  // statuses
  let sx = pad;
  for (const s of p.statuses) {
    const meta = STATUS_META[s.kind];
    const spr = statusSprite(s.kind);
    if (spr) r.imageFit(spr, sx + 9, y + 1, 24);
    else r.glyph(sx + 9, y + 1, meta.glyph, meta.color, "#1a1622", 18);
    const label = s.kind === "shield" ? `${s.power}` : `${s.turns}`;
    r.text(label, sx + 20, y + 6, { color: meta.color, size: 11 });
    sx += 34;
  }

  // --- location (right) -----------------------------------------------------
  const rx = W - pad;
  r.text(`${run.hell.name} ${run.floorIndex + 1}층`, rx, y0 + 24, {
    color: run.hell.palette.accent,
    size: 15,
    align: "right",
    bold: true,
  });
  r.text(`처치 ${run.enemiesKilled}   왕 ${run.bossesKilled}${run.cycle > 0 ? `   윤회 ${run.cycle}겁` : ""}`, rx, y0 + 42, {
    color: run.cycle > 0 ? "#e0698a" : DIM,
    size: 12,
    align: "right",
  });
  const onStairs = run.level.stairs && run.player.pos.x === run.level.stairs.x && run.player.pos.y === run.level.stairs.y;
  if (onStairs) r.text("▼ 계단: > 또는 Enter로 하강", rx, y0 + 60, { color: "#ffe9a8", size: 12, align: "right" });

  // --- log --- on wide screens center-right; on narrow only the latest line
  const recent = run.messages.recent(r.narrow ? 1 : 5);
  const logX = r.narrow ? pad : 260;
  const logTop = r.narrow ? y0 + 92 : y0 + 16;
  for (let i = 0; i < recent.length; i++) {
    const ln = recent[i];
    const alpha = 0.45 + 0.55 * (i / Math.max(1, recent.length - 1));
    r.ctx.globalAlpha = alpha;
    r.text(ln.text, logX, logTop + i * 16, { color: ln.color, size: r.narrow ? 11 : 12 });
    r.ctx.globalAlpha = 1;
  }

  // --- inventory bar --------------------------------------------------------
  const invY = H - 34;
  r.rect(0, invY, W, 34, "#0a0810");
  r.rect(0, invY, W, 1, BORDER);
  let ix = pad;
  const slotW = r.narrow ? Math.floor((W - pad * 2) / Math.min(p.inventorySize, 4)) - 6 : 150;
  for (let i = 0; i < p.inventorySize; i++) {
    const stack = p.inventory[i];
    const selected = i === selectedIndex;
    r.strokeRect(ix, invY + 5, slotW, 24, selected ? "#ffd86b" : "#332c44", selected ? 2 : 1);
    r.text(`${i + 1}`, ix + 6, invY + 21, { color: selected ? "#ffd86b" : DIM, size: 12, bold: true });
    if (stack) {
      const t = getTalisman(stack.id);
      const spr = talismanSprite(stack.id);
      if (spr) r.imageFit(spr, ix + 26, invY + 17, 22);
      else r.glyph(ix + 26, invY + 17, t.glyph, t.color, undefined, 18);
      if (!r.narrow) r.text(t.name, ix + 38, invY + 21, { color: INK, size: 12 });
      if (stack.count > 1) {
        r.text(`×${stack.count}`, ix + slotW - 8, invY + 21, { color: "#ffd86b", size: 12, bold: true, align: "right" });
      }
    } else {
      r.text("―", ix + 26, invY + 21, { color: "#3a3450", size: 12 });
    }
    ix += slotW + 8;
    if (ix + slotW > W - pad) break;
  }
}
