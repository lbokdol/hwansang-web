import type { Game, Scene } from "../game/game";
import { Renderer } from "../render/renderer";
import { Run, type PlayerAction } from "../game/run";
import { drawHud } from "./hud";
import { add, dirFromKey, manhattan, type Pos } from "../core/grid";
import { buildLoadout } from "../meta/loadout";
import { UPGRADES } from "../meta/upgrades";
import { awardKarma, buyUpgrade, canBuy, karmaForRun, nextCost, ownedLevel, type RunOutcome } from "../meta/karma";
import { ACHIEVEMENTS, evaluateAchievements, type AchievementDef } from "../meta/achievements";
import { updateRecords, TITLES, titleRank } from "../meta/titles";
import { recordGongdeok, GONGDEOK_TIERS } from "../meta/score";
import { addSoulXp } from "../meta/soulMastery";
import { CURSES, cycleOf, TRUE_END_CYCLE } from "../content/curses";
import { VOWS, vowsKarmaBonus } from "../content/vows";
import { getBlessing, type BlessingTag } from "../content/blessings";
import { buildDailyLoadout, dailyToday, recordDaily, type DailySpec } from "../content/daily";
import { getVow } from "../content/vows";
import { getCurse } from "../content/curses";
import * as ui from "./chrome";
import { UiButtons, type BarItem } from "./buttons";
import { soulLevel, soulProgress, SOUL_MASTERY_MAX_LEVEL } from "../meta/soulMastery";

const BLESS_TAG_COLOR: Record<BlessingTag, string> = {
  cheong: "#7be0a0",
  jin: "#ff8a5a",
  tam: "#ffd86b",
  chi: "#c5a6ff",
};
const BLESS_TAG_LABEL: Record<BlessingTag, string> = {
  cheong: "정심 계열",
  jin: "업화 계열",
  tam: "보장 계열",
  chi: "통찰 계열",
};

interface EndInfo {
  gd: number;
  isPB: boolean;
  rankUps: { name: string; rank: number }[];
  cycle: number;
  trueEnding: boolean;
  blessings: { name: string; level: number; tag: BlessingTag }[];
  samadhi: BlessingTag[];
  realms: { label: string; count: number }[];
  daily?: { score: number; isPB: boolean; completed: boolean; streak: number; reward: number };
}

const REALM_NAME: Record<string, string> = {
  in: "인도",
  cheon: "천도",
  jiok: "지옥도",
  agwi: "아귀도",
  chuksaeng: "축생도",
};
const SAMADHI_NAME: Record<BlessingTag, string> = {
  cheong: "정심",
  jin: "업화",
  tam: "보장",
  chi: "통찰",
};
import { getTalisman, allTalismanIds } from "../content/talismans";
import { HELLS } from "../content/hells";
import { SOULS, getSoul } from "../content/souls";
import { allEnemyIds, getEnemy } from "../content/enemies";
import { getBoss } from "../content/bosses";
import { hubBackground } from "../render/sprites";
import { sfx } from "../audio/sfx";
import type { Enemy } from "../entities/enemy";

const BG = "#0b0a10";
const INK = "#cdbfa6";
const DIM = "#6f6880";
const GOLD = "#ffd86b";

// ============================================================================
// Title
// ============================================================================
export class TitleScene implements Scene {
  constructor(private game: Game) {}

  enter(): void {
    sfx.music("bgm_title");
  }

  render(r: Renderer): void {
    r.clear(BG);
    const cx = r.width / 2;
    const cy = r.height / 2;
    r.text("환생록", cx, cy - 40, { color: "#f4ead2", size: 72, align: "center", bold: true });
    r.text("죽음과 환생의 지옥 순례", cx, cy + 24, { color: DIM, size: 15, align: "center" });
    const blink = 0.5 + 0.5 * Math.sin(Date.now() / 350);
    r.ctx.globalAlpha = 0.4 + 0.6 * blink;
    r.text("Enter — 명부로 들어선다", cx, cy + 96, { color: INK, size: 16, align: "center" });
    r.ctx.globalAlpha = 1;
    r.text("방향키 이동 · 1~9 부적 · > 또는 Enter 하강 · . 대기", cx, r.contentBottom - 40, {
      color: DIM,
      size: 12,
      align: "center",
    });
  }

  handleKey(e: KeyboardEvent): void {
    if (e.key === "Enter" || e.key === " ") this.game.setScene(new HubScene(this.game));
  }

  touchBar() {
    return [{ label: "시작", key: "Enter" }];
  }
}

// ============================================================================
// 명부 (Hub) — 환생록 강화 구매 + 출발
// ============================================================================
export class HubScene implements Scene {
  private sel = 0;
  private btn = new UiButtons();
  constructor(private game: Game) {}

  enter(): void {
    sfx.music("bgm_myeongbu");
  }

  handleClick(x: number, y: number): void {
    this.btn.click(x, y);
  }

  private buy(): void {
    if (buyUpgrade(this.game.meta, UPGRADES[this.sel].id)) {
      this.game.persist();
      sfx.upgradeBuy();
    }
  }

  render(r: Renderer): void {
    ui.backdrop(r, hubBackground(), "#0b0a10", 0.4);
    this.btn.begin(r);
    const meta = this.game.meta;
    const W = r.width;
    const H = r.contentBottom;
    const desktop = r.uiInsetBottom === 0; // mobile uses the DOM control bar for bottom actions

    // title + karma (with coin seal) + soul (with wisp) + divider
    r.text("명부", 48, 78, { color: ui.GOLD, size: 40, bold: true, shadow: true });
    const kn = `${meta.karma}`;
    r.text(kn, W - 48, 78, { color: "#ffd86b", size: 28, align: "right", bold: true, shadow: true });
    if (ui.hasIcon("ico_karma")) ui.icon(r, "ico_karma", W - 48 - r.measure(kn, 28) - 22, 66, 30);
    const hubCycle = cycleOf(meta.activeCurses);
    if (hubCycle > 0) r.text(`윤회 ${hubCycle}겁`, W - 48, 100, { color: "#e0698a", size: 15, align: "right", bold: true, shadow: true });

    const soul = getSoul(meta.selectedSoul);
    const soulLv = soulLevel(meta.soulXp[soul.id] ?? 0);
    const soulIco = ui.hasIcon("ico_soul");
    if (soulIco) ui.icon(r, "ico_soul", 60, 124, 26);
    r.text(`화신: ${soul.name}  Lv.${soulLv}`, soulIco ? 82 : 48, 130, { color: ui.PARCHMENT, size: 20, shadow: true });
    ui.divider(r, W / 2, 154, W - 96);

    // left framed panel: upgrade list (the 명부 hall stays visible at right)
    const barH = 40;
    const barY = H - barH - 14;
    const px = 36;
    const py = 168;
    const pw = W * 0.6;
    const ph = (desktop ? barY - 16 : H - 16) - py;
    ui.panel(r, px, py, pw, ph);

    const ups = UPGRADES;
    let rowH = (ph - 52) / ups.length;
    rowH = Math.min(rowH, 30);
    let y = py + 36;
    for (let i = 0; i < ups.length; i++) {
      const u = ups[i];
      const lvl = ownedLevel(meta, u.id);
      const cost = nextCost(meta, u);
      const selected = i === this.sel;
      const rx = px + 14;
      const ryy = y - rowH + 8;
      const rw = pw - 28;
      if (selected) r.rect(rx, ryy, rw, rowH, ui.alpha("#2c2540", 0.85));
      else if (this.btn.isHover(rx, ryy, rw, rowH)) r.rect(rx, ryy, rw, rowH, ui.alpha("#2c2540", 0.45));
      const idx = i;
      this.btn.hit(rx, ryy, rw, rowH, () => {
        this.sel = idx;
        this.buy();
      });
      let textX = px + 30;
      if (ui.hasIcon(`up_${u.id}`)) {
        ui.icon(r, `up_${u.id}`, px + 32, y - 7, 22);
        textX = px + 50;
      }
      const affordable = cost !== null && canBuy(meta, u);
      const color = selected ? ui.GOLD_HI : affordable ? "#d8cbb0" : "#857c92";
      r.text(`${selected ? "▸ " : "  "}${u.name}  Lv.${lvl}/${u.maxLevel}`, textX, y, { color, size: 18 });
      if (cost !== null) {
        const cn = `${cost}`;
        r.text(cn, px + pw - 30, y, { color, size: 18, align: "right" });
        if (ui.hasIcon("ico_karma")) ui.icon(r, "ico_karma", px + pw - 30 - r.measure(cn, 18) - 13, y - 7, 17);
      } else {
        r.text("MAX", px + pw - 30, y, { color, size: 18, align: "right" });
      }
      y += rowH;
    }

    // right region: selected 화신 portrait (click → 화신 변경) + selected-upgrade detail card
    const region = W - (px + pw);
    if (ui.hasIcon(`soul_${soul.id}`) && region > 130) {
      const sxc = px + pw + region / 2;
      const box = Math.min(240, region - 48);
      const syc = py + 36 + box / 2;
      ui.icon(r, `soul_${soul.id}`, sxc, syc, box);
      r.text(soul.name, sxc, syc + box * 0.5 + 26, { color: ui.GOLD_HI, size: 24, align: "center", shadow: true });
      this.btn.hit(sxc - box / 2, syc - box / 2, box, box + 40, () => this.game.setScene(new SoulSelectScene(this.game)));

      const cardX = px + pw + 24;
      const cardW = W - cardX - 36;
      const cardY = py + 36 + box + 56;
      const cardH = (desktop ? barY - 16 : H - 16) - cardY;
      if (cardW > 140 && cardH > 84) {
        ui.panel(r, cardX, cardY, cardW, cardH);
        const tx = cardX + 24;
        let ty = cardY + 34;
        const su = ups[this.sel];
        const slvl = ownedLevel(meta, su.id);
        const maxed = slvl >= su.maxLevel;
        r.text(su.name, tx, ty, { color: ui.GOLD_HI, size: 20, shadow: true });
        r.text(maxed ? `Lv.${slvl}/${su.maxLevel} · MAX` : `Lv.${slvl}/${su.maxLevel}`, cardX + cardW - 28, ty, {
          color: maxed ? "#7be0a0" : ui.PARCHMENT,
          size: 15,
          align: "right",
        });
        ty += 14;
        ui.divider(r, cardX + cardW / 2, ty, cardW - 52);
        ty += 22;
        for (const ln of ui.wrap(r, su.desc, 17, cardW - 52)) {
          r.text(ln, tx, ty, { color: ui.PARCHMENT, size: 17 });
          ty += 24;
        }
      }
    }

    // bottom action bar (desktop; on mobile the DOM control bar provides these)
    if (desktop) {
      const items: BarItem[] = [
        { label: "화신", onClick: () => this.game.setScene(new SoulSelectScene(this.game)), accent: ui.GOLD },
        { label: "도감", onClick: () => this.game.setScene(new CodexScene(this.game)), accent: ui.GOLD },
        { label: "고시", onClick: () => this.game.setScene(new DailyScene(this.game)), accent: "#7fe8c8" },
      ];
      if (meta.cleared) items.push({ label: "윤회", onClick: () => this.game.setScene(new CycleScene(this.game)), accent: "#b08cff" });
      items.push({ label: "출발", onClick: () => this.game.setScene(new VowScene(this.game)), accent: "#ffd86b" });
      items.push({ label: "타이틀", onClick: () => this.game.setScene(new TitleScene(this.game)), accent: ui.MUTED });
      this.btn.bar(r, 36, barY, W - 72, barH, 10, items);
    }
  }

  handleKey(e: KeyboardEvent): void {
    switch (e.key) {
      case "ArrowUp":
      case "w":
        this.sel = (this.sel - 1 + UPGRADES.length) % UPGRADES.length;
        sfx.uiClick();
        break;
      case "ArrowDown":
        this.sel = (this.sel + 1) % UPGRADES.length;
        sfx.uiClick();
        break;
      case "Enter":
        if (buyUpgrade(this.game.meta, UPGRADES[this.sel].id)) {
          this.game.persist();
          sfx.upgradeBuy();
        }
        break;
      case "C":
      case "c":
        sfx.uiClick();
        this.game.setScene(new SoulSelectScene(this.game));
        break;
      case "D":
      case "d":
        this.game.setScene(new CodexScene(this.game));
        break;
      case "F":
      case "f":
        this.game.setScene(new DailyScene(this.game));
        break;
      case "R":
      case "r":
        if (this.game.meta.cleared) {
          this.game.setScene(new CycleScene(this.game));
          sfx.uiClick();
        }
        break;
      case "S":
      case "s":
      case " ":
        this.game.setScene(new VowScene(this.game));
        break;
      case "Escape":
        this.game.setScene(new TitleScene(this.game));
        break;
    }
  }

  touchBar() {
    const bar = [
      { label: "▲", key: "ArrowUp" },
      { label: "▼", key: "ArrowDown" },
      { label: "강화", key: "Enter" },
      { label: "화신 C", key: "C" },
      { label: "도감 D", key: "D" },
      { label: "고시 F", key: "F" },
    ];
    if (this.game.meta.cleared) bar.push({ label: "윤회 R", key: "R" });
    bar.push({ label: "출발 S", key: "S" });
    return bar;
  }

}

// ============================================================================
// 화신 선택 — 영혼 로스터(초상 + 숙련 + 특성 + 해금 상태)
// ============================================================================
export class SoulSelectScene implements Scene {
  private sel = 0;
  private btn = new UiButtons();
  constructor(private game: Game) {
    const i = SOULS.findIndex((s) => s.id === game.meta.selectedSoul);
    if (i >= 0) this.sel = i;
  }

  handleClick(x: number, y: number): void {
    this.btn.click(x, y);
  }

  private equip(): void {
    const s = SOULS[this.sel];
    if (!s.isUnlocked(this.game.meta)) {
      sfx.uiClick();
      return;
    }
    if (s.id !== this.game.meta.selectedSoul) {
      this.game.meta.selectedSoul = s.id;
      this.game.persist();
      sfx.upgradeBuy();
    }
    this.game.setScene(new HubScene(this.game));
  }

  render(r: Renderer): void {
    ui.backdrop(r, hubBackground(), "#0b0a10", 0.46);
    this.btn.begin(r);
    const meta = this.game.meta;
    const W = r.width;
    const H = r.contentBottom;
    const desktop = r.uiInsetBottom === 0;
    r.text("화신 선택", 48, 78, { color: ui.GOLD, size: 40, bold: true, shadow: true });

    const barH = 40;
    const barY = H - barH - 14;
    const top = 104;
    const bottom = (desktop ? barY - 18 : H - 18);
    const lh = bottom - top;

    // left roster
    const lx = 36;
    const lw = Math.min(360, W * 0.42);
    ui.panel(r, lx, top, lw, lh);
    const rowH = (lh - 28) / SOULS.length;
    for (let i = 0; i < SOULS.length; i++) {
      const s = SOULS[i];
      const unlocked = s.isUnlocked(meta);
      const selected = i === this.sel;
      const current = s.id === meta.selectedSoul;
      const ry = top + 14 + i * rowH;
      const rrx = lx + 10;
      const rrw = lw - 20;
      const rrh = rowH - 6;
      if (selected) r.rect(rrx, ry, rrw, rrh, ui.alpha("#2c2540", 0.9));
      else if (this.btn.isHover(rrx, ry, rrw, rrh)) r.rect(rrx, ry, rrw, rrh, ui.alpha("#2c2540", 0.45));
      const idx = i;
      this.btn.hit(rrx, ry, rrw, rrh, () => {
        this.sel = idx;
        sfx.uiClick();
      });
      const thumb = rowH - 18;
      const tcx = lx + 26 + thumb / 2;
      const tcy = ry + (rowH - 6) / 2;
      if (ui.hasIcon(`soul_${s.id}`)) ui.icon(r, `soul_${s.id}`, tcx, tcy, thumb);
      const nx = lx + 26 + thumb + 12;
      const col = !unlocked ? "#6b6478" : selected ? ui.GOLD_HI : "#e4d8bd";
      r.text(s.name, nx, tcy - 2, { color: col, size: 20 });
      const secondary = !unlocked ? "🔒 잠김" : current ? "착용 중" : s.nameHanja;
      r.text(secondary, nx, tcy + 18, { color: current ? "#7be0a0" : unlocked ? "#9a8444" : "#7a3a4a", size: 13 });
    }

    // right detail
    const sel = SOULS[this.sel];
    const selUnlocked = sel.isUnlocked(meta);
    const selCurrent = sel.id === meta.selectedSoul;
    const dx = lx + lw + 24;
    const dw = W - dx - 36;
    if (dw > 160) {
      ui.panel(r, dx, top, dw, lh);
      const pcx = dx + dw * 0.72;
      const pcy = top + 40 + Math.min(150, lh * 0.4);
      const pbox = Math.min(300, dw * 0.5);
      if (ui.hasIcon(`soul_${sel.id}`)) ui.icon(r, `soul_${sel.id}`, pcx, pcy, pbox);
      if (!selUnlocked) r.text("🔒", pcx, pcy, { color: "#d8c46b", size: 64, align: "center", shadow: true });

      const tx = dx + 30;
      let ty = top + 50;
      const wrapW = dw * 0.5;
      r.text(sel.name, tx, ty, { color: selUnlocked ? ui.GOLD_HI : "#8a8398", size: 34, shadow: true });
      ty += 36;
      if (selUnlocked) {
        const xp = meta.soulXp[sel.id] ?? 0;
        r.text(`화신 숙련 Lv.${soulLevel(xp)}/${SOUL_MASTERY_MAX_LEVEL}`, tx, ty, { color: "#c5a6ff", size: 18, shadow: true });
        r.bar(tx, ty + 10, dw * 0.3, 5, soulProgress(xp), "#b08cff", "rgba(42,36,64,0.7)");
        ty += 32;
      }
      r.rect(tx, ty, dw * 0.42, 2, "#3a3550");
      ty += 26;
      for (const ln of ui.wrap(r, sel.desc, 18, wrapW)) {
        r.text(ln, tx, ty, { color: "#d7cbb2", size: 18, shadow: true });
        ty += 26;
      }
      ty += 12;
      if (selCurrent) {
        r.text("▸ 착용 중", tx, ty, { color: "#7be0a0", size: 20, shadow: true });
      } else if (!selUnlocked) {
        for (const ln of ui.wrap(r, "🔒 " + sel.unlockHint, 17, wrapW)) {
          r.text(ln, tx, ty, { color: "#e08a9a", size: 17, shadow: true });
          ty += 24;
        }
      }

      if (desktop) {
        const items: BarItem[] = [
          { label: "선택", onClick: () => this.equip(), enabled: selUnlocked && !selCurrent, accent: "#ffd86b" },
          { label: "뒤로", onClick: () => this.game.setScene(new HubScene(this.game)), accent: ui.MUTED },
        ];
        this.btn.bar(r, dx, barY, dw, barH, 12, items);
      }
    }
  }

  handleKey(e: KeyboardEvent): void {
    switch (e.key) {
      case "ArrowUp":
      case "ArrowLeft":
      case "w":
      case "a":
        this.sel = (this.sel - 1 + SOULS.length) % SOULS.length;
        sfx.uiClick();
        break;
      case "ArrowDown":
      case "ArrowRight":
      case "s":
      case "d":
        this.sel = (this.sel + 1) % SOULS.length;
        sfx.uiClick();
        break;
      case "Enter":
      case " ":
        this.equip();
        break;
      case "Escape":
      case "C":
      case "c":
        sfx.uiClick();
        this.game.setScene(new HubScene(this.game));
        break;
    }
  }

  touchBar() {
    return [
      { label: "▲", key: "ArrowUp" },
      { label: "▼", key: "ArrowDown" },
      { label: "선택", key: "Enter" },
      { label: "뒤로", key: "Escape" },
    ];
  }
}

// ============================================================================
// 서원(誓願) — 런 시작 전 자기 제약 선택
// ============================================================================
export class VowScene implements Scene {
  private sel = 0;
  private selected = new Set<string>();
  constructor(private game: Game) {}

  render(r: Renderer): void {
    r.clear("#0a0610");
    const narrow = r.narrow;
    r.text("서원", 40, 52, { color: "#f4ead2", size: 26, bold: true });
    r.text("이번 생을 어떤 계율로 살 것인가. 지킨 채 마치면 업이 크게 쌓인다 — 벌은 없다.", 40, 78, {
      color: DIM,
      size: 13,
    });
    const bonus = Math.round(vowsKarmaBonus([...this.selected]) * 100);
    r.text(`선택한 서원 업 보너스: +${bonus}%`, 40, 108, { color: GOLD, size: 16, bold: true });

    const listTop = narrow ? 150 : 144;
    VOWS.forEach((v, i) => {
      const on = this.selected.has(v.id);
      const y = listTop + i * (narrow ? 44 : 46);
      const seld = i === this.sel;
      r.text(`${seld ? "▶ " : "  "}${on ? "◆" : "◇"} ${v.name}`, 40, y, {
        color: on ? "#7be0a0" : seld ? "#cbbfd6" : "#6a6480",
        size: narrow ? 15 : 16,
        bold: seld,
      });
      r.text(`업 +${Math.round(v.karmaBonus * 100)}%`, r.width - (narrow ? 14 : 56), y, {
        color: on ? GOLD : "#544e66",
        size: 13,
        align: "right",
      });
      r.text(v.desc, narrow ? 56 : 300, narrow ? y + 18 : y, {
        color: on ? INK : "#544e66",
        size: narrow ? 11 : 13,
      });
    });
    r.text("↑↓ 선택 · Space 서원/해제 · Enter 시작 · Esc 명부로", r.width / 2, r.contentBottom - 32, {
      color: INK,
      size: 14,
      align: "center",
    });
  }

  handleKey(e: KeyboardEvent): void {
    if (e.key === "ArrowUp" || e.key === "w") {
      this.sel = (this.sel - 1 + VOWS.length) % VOWS.length;
      sfx.uiClick();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "s") {
      this.sel = (this.sel + 1) % VOWS.length;
      sfx.uiClick();
      return;
    }
    if (e.key === " ") {
      const id = VOWS[this.sel].id;
      if (this.selected.has(id)) this.selected.delete(id);
      else this.selected.add(id);
      sfx.upgradeBuy();
      return;
    }
    if (e.key === "Enter") {
      const loadout = buildLoadout(this.game.meta);
      loadout.activeVows = [...this.selected];
      const run = new Run(this.game.meta, loadout);
      this.game.setScene(new RunScene(this.game, run));
      return;
    }
    if (e.key === "Escape") this.game.setScene(new HubScene(this.game));
  }

  touchBar() {
    return [
      { label: "▲", key: "ArrowUp" },
      { label: "▼", key: "ArrowDown" },
      { label: "서원", key: " " },
      { label: "시작", key: "Enter" },
      { label: "취소", key: "Escape" },
    ];
  }
}

// ============================================================================
// 도감 (명부록) — first-encounter records
// ============================================================================
const BOSS_CODEX_IDS = ["jingwang", "chogang", "songje", "ogwan"];

export class CodexScene implements Scene {
  private page: 0 | 1 | 2 = 0; // 0 명부록, 1 공과록, 2 업경대
  private titleSel = 0;
  constructor(private game: Game) {}

  render(r: Renderer): void {
    r.clear("#0a0912");
    if (this.page === 0) this.renderCodex(r);
    else if (this.page === 1) this.renderAchievements(r);
    else this.renderEopgyeong(r);
    const hint =
      this.page === 2
        ? "Tab — 페이지 전환 · ↑↓ 칭호 선택 · Enter 착용/해제 · Esc 명부로"
        : "Tab — 명부록/공과록/업경대 전환 · Esc/Enter — 명부로";
    r.text(hint, r.width / 2, r.contentBottom - 32, { color: INK, size: 14, align: "center" });
  }

  private renderEopgyeong(r: Renderer): void {
    const meta = this.game.meta;
    r.text("업경대", 40, 52, { color: "#f4ead2", size: 26, bold: true });
    r.text("반복으로 새긴 한계의 기록과 칭호. 칭호 하나를 둘러 그 힘을 받는다.", 40, 78, { color: DIM, size: 13 });

    // 기록 비석
    const rec = meta.records;
    r.text("◆ 한계 기록 (비석)", 40, 120, { color: GOLD, size: 16, bold: true });
    const recLines = [
      `최고 깊이 — ${rec.deepestStage}층`,
      `무피격 최고 — ${rec.bestNoHitDepth}층`,
      `최단 클리어 — ${rec.fastestClearTurns > 0 ? rec.fastestClearTurns + "턴" : "—"}`,
      `최다 처치 — ${rec.mostKills}`,
      `최고 등반 — ${meta.maxCycleCleared}겁`,
      `최고 공덕 — ${meta.bestGongdeok}`,
    ];
    recLines.forEach((t, i) => r.text(t, 56, 150 + i * 26, { color: INK, size: 14 }));
    const nextTier = GONGDEOK_TIERS[meta.gongdeokTierClaimed];
    r.text(
      nextTier ? `다음 공덕 천장 — ${nextTier.score} (+${nextTier.karma}업)` : "공덕 천장 — 모두 달성",
      56,
      150 + recLines.length * 26,
      { color: "#9bd1ff", size: 13 },
    );

    // 칭호 목록 — wide: right column; narrow: stacked below the 비석.
    const tx = r.narrow ? 40 : 560;
    const ty0 = r.narrow ? 320 : 152;
    r.text("◆ 칭호", tx, ty0 - 32, { color: GOLD, size: 16, bold: true });
    TITLES.forEach((t, i) => {
      const rank = titleRank(t, meta.records);
      const y = ty0 + i * 56;
      const sel = i === this.titleSel;
      const equipped = meta.equippedTitle === t.id;
      const dots = "◆".repeat(rank) + "◇".repeat(t.thresholds.length - rank);
      const col = rank > 0 ? (equipped ? "#ffd86b" : "#bda6ff") : "#4a4458";
      r.text(`${sel ? "▶ " : "  "}${t.name}  ${dots}`, tx, y, { color: col, size: 16, bold: sel });
      if (equipped) r.text("[착용]", tx + (r.narrow ? 300 : 360), y, { color: "#ffd86b", size: 13, bold: true });
      r.text(t.desc, tx + 20, y + 20, { color: rank > 0 ? INK : "#544e66", size: 12 });
    });
  }

  private renderCodex(r: Renderer): void {
    const meta = this.game.meta;
    r.text("명부록", 40, 52, { color: "#f4ead2", size: 26, bold: true });
    r.text("처음 마주한 것들이 이 곳에 기록된다.", 40, 78, { color: DIM, size: 13 });

    const nameMaps = new Map<string, string>();
    for (const id of allEnemyIds()) nameMaps.set(id, getEnemy(id).name);
    for (const id of BOSS_CODEX_IDS) nameMaps.set(id, getBoss(id).name);
    for (const id of allTalismanIds()) nameMaps.set(id, getTalisman(id).name);
    for (const h of HELLS) nameMaps.set(h.id, h.name);

    const narrow = r.narrow;
    const hSize = narrow ? 13 : 16;
    const iSize = narrow ? 11 : 13;
    const rowH = narrow ? 19 : 22;
    const col = (x: number, title: string, ids: string[], known: Set<string>) => {
      r.text(`${title} (${known.size}/${ids.length})`, x, 110, { color: GOLD, size: hSize, bold: true });
      let y = 134;
      let i = 0;
      for (const id of ids) {
        const seen = known.has(id);
        const label = seen ? nameMaps.get(id) ?? id : "？？？";
        r.text(`· ${label}`, x, y, { color: seen ? INK : "#4a4458", size: iSize });
        y += rowH;
        if (++i > 24) break;
      }
    };

    const xs = narrow ? [16, 110, 200, 296] : [40, 360, 560, 880];
    col(xs[0], "적", allEnemyIds(), new Set(meta.codex.enemies));
    col(xs[1], "왕", BOSS_CODEX_IDS, new Set(meta.codex.bosses));
    col(xs[2], "부적", allTalismanIds(), new Set(meta.codex.talismans));
    col(xs[3], "지옥", HELLS.map((h) => h.id), new Set(meta.codex.hells));
  }

  private renderAchievements(r: Renderer): void {
    const meta = this.game.meta;
    const unlocked = new Set(meta.achievementsUnlocked);
    r.text("공과록", 40, 52, { color: "#f4ead2", size: 26, bold: true });
    r.text(`업의 공덕을 새긴 장부 — ${unlocked.size}/${ACHIEVEMENTS.length} 달성`, 40, 78, { color: DIM, size: 13 });

    const ncol = r.narrow ? 1 : 2;
    const colW = r.narrow ? r.width - 40 : 600;
    const rows = Math.ceil(ACHIEVEMENTS.length / ncol);
    const rowH = r.narrow ? 44 : 52;
    let i = 0;
    for (const a of ACHIEVEMENTS) {
      const done = unlocked.has(a.id);
      const x = 20 + Math.floor(i / rows) * colW;
      const y = 110 + (i % rows) * rowH;
      r.text(`${done ? "◆" : "◇"} ${a.name}`, x, y, {
        color: done ? GOLD : "#6a6480",
        size: r.narrow ? 15 : 16,
        bold: true,
      });
      r.text(`+${a.karma}업`, x + colW - 60, y, { color: done ? "#ffe9a8" : "#4a4458", size: 13, align: "right" });
      r.text(a.desc, x, y + 19, { color: done ? INK : "#544e66", size: r.narrow ? 11 : 12 });
      i++;
    }
  }

  handleKey(e: KeyboardEvent): void {
    if (e.key === "Tab") {
      this.page = ((this.page + 1) % 3) as 0 | 1 | 2;
      sfx.uiClick();
      return;
    }
    if (this.page === 2) {
      if (e.key === "ArrowUp" || e.key === "w") {
        this.titleSel = (this.titleSel - 1 + TITLES.length) % TITLES.length;
        sfx.uiClick();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "s") {
        this.titleSel = (this.titleSel + 1) % TITLES.length;
        sfx.uiClick();
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        const t = TITLES[this.titleSel];
        if (titleRank(t, this.game.meta.records) > 0) {
          this.game.meta.equippedTitle = this.game.meta.equippedTitle === t.id ? null : t.id;
          this.game.persist();
          sfx.upgradeBuy();
        }
        return; // Enter does NOT exit on the 업경대 page
      }
      if (e.key === "Escape") this.game.setScene(new HubScene(this.game));
      return;
    }
    if (e.key === "Escape" || e.key === "Enter" || e.key === "d" || e.key === "D") {
      this.game.setScene(new HubScene(this.game));
    }
  }

  touchBar() {
    return [
      { label: "▲", key: "ArrowUp" },
      { label: "▼", key: "ArrowDown" },
      { label: "전환 Tab", key: "Tab" },
      { label: "명부", key: "Escape" },
    ];
  }
}

// ============================================================================
// 윤회의 문 — 악연 드래프트
// ============================================================================
export class CycleScene implements Scene {
  private sel = 0;
  constructor(private game: Game) {}

  render(r: Renderer): void {
    r.clear("#0a0610");
    const meta = this.game.meta;
    const active = new Set(meta.activeCurses);
    const cycle = cycleOf(meta.activeCurses);
    r.text("윤회의 문", 40, 52, { color: "#f4ead2", size: 26, bold: true });
    r.text("악연을 드리울수록 겁이 오른다. 적은 강맹해지나 업·공덕이 크게 쌓인다.", 40, 78, {
      color: DIM,
      size: 13,
    });
    const narrow = r.narrow;
    r.text(`현재 겁: ${cycle}겁`, 40, 110, { color: "#e0698a", size: 18, bold: true });
    r.text(
      `최고 등반: ${meta.maxCycleCleared}겁` + (meta.maxCycleCleared >= TRUE_END_CYCLE ? "  (진환생 달성)" : ""),
      narrow ? 190 : 220,
      110,
      { color: GOLD, size: narrow ? 13 : 15 },
    );
    const rewardText = `보상: 업 +${Math.round(5 * cycle)}% · 공덕 +${Math.round(15 * cycle)}% · 적 +${Math.round(3.5 * cycle)}%`;
    if (narrow) r.text(rewardText, 40, 134, { color: "#9bd1ff", size: 12 });
    else r.text(rewardText, 560, 110, { color: "#9bd1ff", size: 13 });

    const listTop = narrow ? 162 : 148;
    CURSES.forEach((c, i) => {
      const on = active.has(c.id);
      const y = listTop + i * (narrow ? 40 : 42);
      const seld = i === this.sel;
      r.text(`${seld ? "▶ " : "  "}${on ? "◆" : "◇"} ${c.name}`, 40, y, {
        color: on ? "#e0698a" : seld ? "#cbbfd6" : "#6a6480",
        size: narrow ? 15 : 16,
        bold: seld,
      });
      r.text(`+${c.weight}겁`, r.width - (narrow ? 14 : 56), y, {
        color: on ? "#ffd86b" : "#544e66",
        size: 13,
        align: "right",
      });
      if (narrow) r.text(c.desc, 56, y + 17, { color: on ? INK : "#544e66", size: 11 });
      else r.text(c.desc, 400, y, { color: on ? INK : "#544e66", size: 13 });
    });
    r.text("↑↓ 선택 · Enter 드리우기/거두기 · Esc 명부로", r.width / 2, r.contentBottom - 32, {
      color: INK,
      size: 14,
      align: "center",
    });
  }

  handleKey(e: KeyboardEvent): void {
    if (e.key === "ArrowUp" || e.key === "w") {
      this.sel = (this.sel - 1 + CURSES.length) % CURSES.length;
      sfx.uiClick();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "s") {
      this.sel = (this.sel + 1) % CURSES.length;
      sfx.uiClick();
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      const id = CURSES[this.sel].id;
      const cur = this.game.meta.activeCurses;
      const i = cur.indexOf(id);
      if (i >= 0) cur.splice(i, 1);
      else cur.push(id);
      this.game.persist();
      sfx.upgradeBuy();
      return;
    }
    if (e.key === "Escape" || e.key === "r" || e.key === "R") {
      this.game.setScene(new HubScene(this.game));
    }
  }

  touchBar() {
    return [
      { label: "▲", key: "ArrowUp" },
      { label: "▼", key: "ArrowDown" },
      { label: "드리우기", key: "Enter" },
      { label: "명부", key: "Escape" },
    ];
  }
}

// ============================================================================
// 명부 고시(冥府告示) — 데일리
// ============================================================================
export class DailyScene implements Scene {
  private spec = dailyToday();
  constructor(private game: Game) {}

  render(r: Renderer): void {
    r.clear("#0a0610");
    const meta = this.game.meta;
    const s = this.spec;
    r.text("명부 고시", 40, 52, { color: "#f4ead2", size: 26, bold: true });
    r.text(`오늘의 시험 — ${s.dateKey}. 화신·서원·악연·지도가 고정된 1지옥 규격.`, 40, 78, { color: DIM, size: 13 });
    const soul = getSoul(s.soulId);
    const vow = getVow(s.vowId);
    const curse = getCurse(s.curseId);
    let y = 132;
    r.text(`화신 ▸ ${soul.name}`, 40, y, { color: "#cbbfd6", size: 18, bold: true });
    y += 32;
    r.text(`서원 ▸ ${vow ? vow.name : s.vowId}`, 40, y, { color: "#7be0a0", size: 17, bold: true });
    if (vow) r.text(vow.desc, 200, y, { color: INK, size: 13 });
    y += 30;
    r.text(`악연 ▸ ${curse ? curse.name : s.curseId}`, 40, y, { color: "#e0698a", size: 17, bold: true });
    if (curse) r.text(curse.desc, 200, y, { color: INK, size: 13 });
    y += 44;
    const best = meta.dailyBestByDate[s.dateKey] ?? 0;
    r.text(`오늘 최고 점수: ${best}`, 40, y, { color: "#9bd1ff", size: 16 });
    y += 26;
    r.text(`연속 완수: ${meta.dailyStreak}일`, 40, y, { color: GOLD, size: 16 });
    r.text("완수 = 클리어 + 서원 유지. Enter 시작 · Esc 명부로", r.width / 2, r.contentBottom - 32, {
      color: INK,
      size: 14,
      align: "center",
    });
  }

  handleKey(e: KeyboardEvent): void {
    if (e.key === "Enter" || e.key === " ") {
      const loadout = buildDailyLoadout(this.game.meta, this.spec);
      const run = new Run(this.game.meta, loadout, this.spec.seed);
      this.game.setScene(new RunScene(this.game, run, this.spec));
      return;
    }
    if (e.key === "Escape" || e.key === "f" || e.key === "F") this.game.setScene(new HubScene(this.game));
  }

  touchBar() {
    return [
      { label: "시작 Enter", key: "Enter" },
      { label: "명부 Esc", key: "Escape" },
    ];
  }
}

// ============================================================================
// Run — gameplay + input + targeting
// ============================================================================
type Targeting =
  | { index: number; mode: "direction" }
  | { index: number; mode: "enemy"; list: Enemy[]; idx: number }
  | { index: number; mode: "tile"; cursor: Pos };

export class RunScene implements Scene {
  private targeting: Targeting | null = null;
  private ended = false;
  private blessingSel = 0;

  constructor(private game: Game, private run: Run, private dailySpec?: DailySpec) {}

  enter(): void {
    this.run.onEnd = (won) => this.finish(won);
    this.run.start();
  }

  update(dt: number): void {
    this.run.fx.update(dt);
    if (!this.ended) {
      // BGM follows the current hell, switching to the boss theme on boss floors.
      sfx.music(this.run.level.isBossFloor ? "bgm_boss" : `bgm_${this.run.hell.id}`);
    }
  }

  render(r: Renderer): void {
    r.clear("#06050a");
    r.drawWorld(this.run.level, this.run.player.pos, this.run.fx);
    this.drawTargeting(r);
    drawHud(r, this.run, this.targeting ? this.targeting.index : -1);
    this.drawBanner(r);
    this.drawBlessingDraft(r);
  }

  handleKey(e: KeyboardEvent): void {
    if (this.ended) return;
    // 인연 드래프트 대기 중이면 선택만 받는다(하강·이동 차단).
    if (this.run.pendingBlessings.length > 0) {
      this.handleBlessingKey(e);
      return;
    }
    if (this.targeting) {
      this.handleTargetingKey(e);
      return;
    }
    const dir = dirFromKey(e.key);
    if (dir) {
      this.run.submitAction({ kind: "move", dir });
      return;
    }
    switch (e.key) {
      case ">":
      case "Enter":
        this.run.submitAction({ kind: "descend" });
        break;
      case ".":
      case " ":
      case "z":
        this.run.submitAction({ kind: "wait" });
        break;
      default:
        if (/^[1-9]$/.test(e.key)) this.selectTalisman(parseInt(e.key, 10) - 1);
    }
  }

  touchBar() {
    const bar = [
      { label: "대기", key: "." },
      { label: "하강 ▼", key: ">" },
    ];
    if (this.run.pendingBlessings.length > 0) {
      return this.run.pendingBlessings.map((id, i) => ({
        label: getBlessing(id)?.name ?? `인연${i + 1}`,
        key: `${i + 1}`,
      }));
    }
    for (let i = 0; i < this.run.player.inventorySize; i++) bar.push({ label: `부적${i + 1}`, key: `${i + 1}` });
    return bar;
  }

  // ---- 인연 드래프트 오버레이 -----------------------------------------------

  private handleBlessingKey(e: KeyboardEvent): void {
    const n = this.run.pendingBlessings.length;
    if (e.key === "ArrowLeft" || e.key === "a") {
      this.blessingSel = (this.blessingSel - 1 + n) % n;
      sfx.uiClick();
      return;
    }
    if (e.key === "ArrowRight" || e.key === "d") {
      this.blessingSel = (this.blessingSel + 1) % n;
      sfx.uiClick();
      return;
    }
    let idx = -1;
    if (/^[1-9]$/.test(e.key)) idx = parseInt(e.key, 10) - 1;
    else if (e.key === "Enter" || e.key === " ") idx = this.blessingSel;
    if (idx >= 0 && idx < n) {
      this.run.chooseBlessing(idx);
      this.blessingSel = 0;
      sfx.upgradeBuy();
    }
  }

  private drawBlessingDraft(r: Renderer): void {
    const ids = this.run.pendingBlessings;
    if (ids.length === 0) return;
    r.rect(0, 0, r.width, r.height, "rgba(6,5,12,0.84)");
    r.text("인연을 맺다", r.width / 2, 84, { color: "#c5a6ff", size: 26, bold: true, align: "center" });
    r.text("왕의 법을 하나 빌린다 — 같은 색 셋을 모으면 삼매가 열린다.", r.width / 2, 114, {
      color: DIM,
      size: 13,
      align: "center",
    });
    const cardW = Math.min(200, Math.floor((r.width - 40) / ids.length) - 20);
    const gap = 20;
    const totalW = ids.length * cardW + (ids.length - 1) * gap;
    let x = Math.round((r.width - totalW) / 2);
    const y = Math.round(r.height / 2 - 100);
    const h = 176;
    ids.forEach((id, i) => {
      const b = getBlessing(id);
      if (!b) return;
      const seld = i === this.blessingSel;
      const tc = BLESS_TAG_COLOR[b.tag];
      r.rect(x, y, cardW, h, seld ? "#241f30" : "#141120");
      r.strokeRect(x, y, cardW, h, seld ? "#c5a6ff" : "#3a3550", seld ? 2 : 1);
      r.text(`${i + 1}`, x + 12, y + 26, { color: DIM, size: 15 });
      r.text(b.name, x + cardW / 2, y + 66, { color: tc, size: 22, bold: true, align: "center" });
      r.text(BLESS_TAG_LABEL[b.tag], x + cardW / 2, y + 98, { color: tc, size: 12, align: "center" });
      r.text(b.desc, x + cardW / 2, y + h - 22, { color: INK, size: 12, align: "center" });
      x += cardW + gap;
    });
    r.text("←→ 선택 · Enter 맺기 · 숫자 즉시 선택", r.width / 2, y + h + 40, {
      color: INK,
      size: 14,
      align: "center",
    });
  }

  private selectTalisman(i: number): void {
    const stack = this.run.player.inventory[i];
    if (!stack) return;
    const def = getTalisman(stack.id);
    switch (def.targeting) {
      case "none":
      case "self":
        this.submit({ kind: "talisman", index: i, target: {} });
        break;
      case "direction":
        this.targeting = { index: i, mode: "direction" };
        break;
      case "enemy": {
        const list = this.visibleEnemies();
        if (list.length === 0) {
          this.run.log("시야 안에 대상이 없다.", "#a08");
          return;
        }
        this.targeting = { index: i, mode: "enemy", list, idx: 0 };
        break;
      }
      case "tile":
        this.targeting = { index: i, mode: "tile", cursor: { ...this.run.player.pos } };
        break;
    }
  }

  private handleTargetingKey(e: KeyboardEvent): void {
    const t = this.targeting!;
    if (e.key === "Escape") {
      this.targeting = null;
      return;
    }
    if (t.mode === "direction") {
      const dir = dirFromKey(e.key);
      if (dir) this.submit({ kind: "talisman", index: t.index, target: { dir } });
      return;
    }
    if (t.mode === "enemy") {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        t.idx = (t.idx - 1 + t.list.length) % t.list.length;
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "Tab") {
        t.idx = (t.idx + 1) % t.list.length;
      } else if (e.key === "Enter" || e.key === " ") {
        this.submit({ kind: "talisman", index: t.index, target: { enemy: t.list[t.idx] } });
      }
      return;
    }
    // tile
    const dir = dirFromKey(e.key);
    if (dir) {
      const n = add(t.cursor, dir);
      if (this.run.level.inBounds(n.x, n.y)) t.cursor = n;
    } else if (e.key === "Enter" || e.key === " ") {
      const c = t.cursor;
      if (this.run.level.isVisible(c) && !this.run.isWall(c) && !this.run.actorAt(c)) {
        this.submit({ kind: "talisman", index: t.index, target: { tile: c } });
      } else {
        this.run.log("그곳으로는 갈 수 없다.", "#a08");
      }
    }
  }

  private submit(action: PlayerAction): void {
    this.targeting = null;
    this.run.submitAction(action);
  }

  private visibleEnemies(): Enemy[] {
    const p = this.run.player.pos;
    return this.run.level
      .livingEnemies()
      .filter((e) => this.run.level.isVisible(e.pos))
      .sort((a, b) => manhattan(a.pos, p) - manhattan(b.pos, p));
  }

  private drawTargeting(r: Renderer): void {
    const t = this.targeting;
    if (!t) return;
    if (t.mode === "enemy") {
      const e = t.list[t.idx];
      const s = r.worldToScreen(e.pos);
      r.strokeRect(s.x, s.y, s.size, s.size, GOLD, 2);
    } else if (t.mode === "tile") {
      const s = r.worldToScreen(t.cursor);
      const ok = this.run.level.isVisible(t.cursor) && !this.run.isWall(t.cursor) && !this.run.actorAt(t.cursor);
      r.strokeRect(s.x, s.y, s.size, s.size, ok ? "#7be0a0" : "#c43b54", 2);
    }
  }

  private drawBanner(r: Renderer): void {
    if (!this.targeting) return;
    const stack = this.run.player.inventory[this.targeting.index];
    if (!stack) return;
    const def = getTalisman(stack.id);
    const msg =
      this.targeting.mode === "direction"
        ? `${def.name}: 방향키로 시전 (Esc 취소)`
        : this.targeting.mode === "enemy"
          ? `${def.name}: ←→ 대상 선택, Enter 시전 (Esc 취소)`
          : `${def.name}: 방향키로 위치 이동, Enter 시전 (Esc 취소)`;
    const w = r.measure(msg, 14, true) + 24;
    r.rect(r.width / 2 - w / 2, 12, w, 28, "rgba(10,8,16,0.9)");
    r.strokeRect(r.width / 2 - w / 2, 12, w, 28, def.color, 1);
    r.text(msg, r.width / 2, 31, { color: def.color, size: 14, align: "center", bold: true });
  }

  private finish(won: boolean): void {
    if (this.ended) return;
    this.ended = true;
    const meta = this.game.meta;
    const outcome = this.run.getOutcome();
    // 윤회겁 보너스(겁이 높을수록 업↑) + 서원 성취 보너스(지킨 계율의 업 배율 합).
    const vowBonus = vowsKarmaBonus(outcome.vowsKept);
    const earned = Math.round(
      karmaForRun(outcome, this.run.loadout.karmaMultiplier + vowBonus) * (1 + 0.05 * outcome.cycle),
    );
    awardKarma(meta, earned);
    sfx.karmaGain();
    meta.runs++;
    if (won) meta.cleared = true;
    // 윤회겁 등반 기록 + 진환생(진환생) 해금 판정.
    let trueEnding = false;
    if (won && outcome.cycle > meta.maxCycleCleared) {
      const prevMax = meta.maxCycleCleared;
      meta.maxCycleCleared = outcome.cycle;
      if (prevMax < TRUE_END_CYCLE && outcome.cycle >= TRUE_END_CYCLE) trueEnding = true;
    }
    if (
      outcome.hellIndex > meta.deepestHell ||
      (outcome.hellIndex === meta.deepestHell && outcome.floorIndex > meta.deepestFloor)
    ) {
      meta.deepestHell = outcome.hellIndex;
      meta.deepestFloor = outcome.floorIndex;
    }
    // 공과록 + 업경대(기록·칭호) + 공덕록(점수) 정산.
    const ach = evaluateAchievements(meta, outcome);
    const { rankUps } = updateRecords(meta, outcome);
    const gong = recordGongdeok(meta, outcome, meta.selectedSoul);
    addSoulXp(meta, meta.selectedSoul, outcome); // 화신 숙련 경험 누적

    const bonus = ach.bonusKarma + gong.tierKarma;
    if (bonus > 0) awardKarma(meta, bonus);

    // 인연·삼매·六道 집계(결과화면 표시용).
    const blessings = Object.entries(this.run.blessingLevels).map(([id, level]) => {
      const b = getBlessing(id);
      return { name: b?.name ?? id, level, tag: (b?.tag ?? "cheong") as BlessingTag };
    });
    const realms = Object.entries(this.run.markTally).map(([mark, count]) => ({
      label: REALM_NAME[mark] ?? mark,
      count,
    }));

    // 명부 고시: 데일리 결과 기록 + 보상.
    let daily: EndInfo["daily"];
    if (this.dailySpec) {
      const dr = recordDaily(meta, this.dailySpec, outcome);
      if (dr.rewardKarma > 0) awardKarma(meta, dr.rewardKarma);
      daily = {
        score: dr.score,
        isPB: dr.isPB,
        completed: dr.completed,
        streak: dr.streak,
        reward: dr.rewardKarma,
      };
    }

    const endInfo: EndInfo = {
      gd: gong.gd,
      isPB: gong.isPB,
      rankUps: rankUps.map((r) => ({ name: r.def.name, rank: r.rank })),
      cycle: outcome.cycle,
      trueEnding,
      blessings,
      samadhi: this.run.samadhiTags,
      realms,
      daily,
    };
    this.game.persist();
    this.game.setScene(
      won
        ? new ClearScene(this.game, earned, outcome, ach.newly, endInfo)
        : new DeathScene(this.game, earned, outcome, ach.newly, endInfo),
    );
  }
}

// ============================================================================
// Death / Clear
// ============================================================================
function drawOutcome(
  r: Renderer,
  title: string,
  titleColor: string,
  earned: number,
  o: RunOutcome,
  newly: AchievementDef[],
  end: EndInfo,
): void {
  const cx = r.width / 2;
  const cy = r.height / 2;
  r.text(title, cx, cy - 80, { color: titleColor, size: 48, align: "center", bold: true });
  if (end.cycle > 0) {
    r.text(`윤회 ${end.cycle}겁`, cx, cy - 44, { color: "#c43b54", size: 16, align: "center", bold: true });
  }
  r.text(`도달: ${o.hellName} ${o.floorIndex + 1}층 (${o.hellIndex + 1}번째 지옥)`, cx, cy - 16, {
    color: INK,
    size: 18,
    align: "center",
  });
  r.text(`처치 ${o.enemiesKilled} · 격파한 왕 ${o.bossesKilled}`, cx, cy + 12, { color: DIM, size: 15, align: "center" });
  r.text(`업 +${earned}`, cx, cy - 16 + 56, { color: GOLD, size: 24, align: "center", bold: true });
  r.text(`공덕 ${end.gd}${end.isPB ? "  ★신기록!" : ""}`, cx, cy + 72, {
    color: end.isPB ? "#9be36b" : "#9bd1ff",
    size: 18,
    align: "center",
    bold: end.isPB,
  });

  let y = cy + 100;
  for (const ru of end.rankUps.slice(0, 3)) {
    r.text(`칭호 승급 ▸ ${ru.name} ${ru.rank}품`, cx, y, { color: "#bda6ff", size: 14, align: "center" });
    y += 20;
  }
  if (newly.length > 0) {
    const bonus = newly.reduce((s, a) => s + a.karma, 0);
    r.text(`◆ 공과록 달성 +${bonus}업 ◆`, cx, y, { color: GOLD, size: 15, align: "center", bold: true });
    y += 24;
    for (const a of newly.slice(0, 4)) {
      r.text(`${a.name}`, cx, y, { color: "#ffe9a8", size: 13, align: "center" });
      y += 19;
    }
    if (newly.length > 4) {
      r.text(`… 외 ${newly.length - 4}건`, cx, y, { color: DIM, size: 12, align: "center" });
      y += 19;
    }
  }
  // 인연 · 삼매 · 六道 전륜
  if (end.blessings.length > 0) {
    const names = end.blessings.map((b) => (b.level > 1 ? `${b.name}×${b.level}` : b.name)).join(" · ");
    r.text(`인연: ${names}`, cx, y, { color: "#c5a6ff", size: 13, align: "center" });
    y += 19;
  }
  if (end.samadhi.length > 0) {
    r.text(`삼매 개안 ▸ ${end.samadhi.map((t) => SAMADHI_NAME[t]).join(" · ")}`, cx, y, {
      color: "#e0a6ff",
      size: 14,
      align: "center",
      bold: true,
    });
    y += 20;
  }
  if (end.realms.length > 0) {
    r.text(`육도: ${end.realms.map((rm) => `${rm.label}×${rm.count}`).join(" · ")}`, cx, y, {
      color: "#b08cff",
      size: 13,
      align: "center",
    });
    y += 19;
  }
  if (end.daily) {
    const d = end.daily;
    const line =
      `명부 고시 — 점수 ${d.score}${d.isPB ? " ★신기록" : ""}` +
      (d.completed ? ` · 완수(연속 ${d.streak})` : "") +
      (d.reward > 0 ? ` · +${d.reward}업` : "");
    r.text(line, cx, y, { color: d.completed ? "#9be36b" : "#9bd1ff", size: 14, align: "center", bold: true });
    y += 22;
  }
  r.text("Enter — 명부로 돌아간다", cx, Math.max(y + 18, cy + 130), { color: INK, size: 16, align: "center" });
}

export class DeathScene implements Scene {
  constructor(
    private game: Game,
    private earned: number,
    private outcome: RunOutcome,
    private newly: AchievementDef[] = [],
    private end: EndInfo = { gd: 0, isPB: false, rankUps: [], cycle: 0, trueEnding: false, blessings: [], samadhi: [], realms: [] },
  ) {}
  enter(): void {
    sfx.music("bgm_myeongbu");
  }
  render(r: Renderer): void {
    r.clear("#0b0709");
    drawOutcome(r, "사망", "#c43b54", this.earned, this.outcome, this.newly, this.end);
    r.text("이번엔 망했지만, 다음 생은 더 강하다.", r.width / 2, r.contentBottom - 48, {
      color: DIM,
      size: 13,
      align: "center",
    });
  }
  handleKey(e: KeyboardEvent): void {
    if (e.key === "Enter" || e.key === " ") this.game.setScene(new HubScene(this.game));
  }
  touchBar() {
    return [{ label: "명부로", key: "Enter" }];
  }
}

export class ClearScene implements Scene {
  constructor(
    private game: Game,
    private earned: number,
    private outcome: RunOutcome,
    private newly: AchievementDef[] = [],
    private end: EndInfo = { gd: 0, isPB: false, rankUps: [], cycle: 0, trueEnding: false, blessings: [], samadhi: [], realms: [] },
  ) {}
  enter(): void {
    sfx.music("bgm_clear");
  }
  render(r: Renderer): void {
    r.clear("#0a0a14");
    const titleText = this.end.trueEnding ? "진환생" : "환생";
    drawOutcome(r, titleText, "#ffe9a8", this.earned, this.outcome, this.newly, this.end);
    const flavor = this.end.trueEnding
      ? "마침내 모든 업보를 넘어섰다. 윤회의 사슬이 끊어진다 — 참된 환생(진환생)."
      : "모든 지옥을 넘어, 윤회의 문을 열었다.";
    r.text(flavor, r.width / 2, r.contentBottom - 48, { color: GOLD, size: 14, align: "center" });
  }
  handleKey(e: KeyboardEvent): void {
    if (e.key === "Enter" || e.key === " ") this.game.setScene(new HubScene(this.game));
  }
  touchBar() {
    return [{ label: "명부로", key: "Enter" }];
  }
}
