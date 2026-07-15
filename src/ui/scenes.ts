import type { Game, Scene } from "../game/game";
import { Renderer } from "../render/renderer";
import { Run, type PlayerAction } from "../game/run";
import { drawHud } from "./hud";
import { add, dirFromKey, manhattan, type Pos } from "../core/grid";
import { buildLoadout } from "../meta/loadout";
import { UPGRADES } from "../meta/upgrades";
import { awardKarma, buyUpgrade, canBuy, karmaForRun, nextCost, ownedLevel, type RunOutcome } from "../meta/karma";
import { ACHIEVEMENTS, evaluateAchievements, type AchievementDef } from "../meta/achievements";
import { updateRecords, TITLES, titleRank, getTitle } from "../meta/titles";
import { recordGongdeok, GONGDEOK_TIERS } from "../meta/score";
import { CURSES, cycleOf, TRUE_END_CYCLE } from "../content/curses";

interface EndInfo {
  gd: number;
  isPB: boolean;
  rankUps: { name: string; rank: number }[];
  cycle: number;
  trueEnding: boolean;
}
import { getTalisman, allTalismanIds } from "../content/talismans";
import { HELLS } from "../content/hells";
import { SOULS, getSoul } from "../content/souls";
import { allEnemyIds, getEnemy } from "../content/enemies";
import { getBoss } from "../content/bosses";
import { hubBackground } from "../render/sprites";
import { sfx } from "../audio/sfx";
import type { Enemy } from "../entities/enemy";
import type { MetaState } from "../core/types";

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
  constructor(private game: Game) {}

  enter(): void {
    sfx.music("bgm_myeongbu");
  }

  render(r: Renderer): void {
    r.clear("#0a0912");
    const bg = hubBackground();
    if (bg) {
      r.imageCover(bg, 0, 0, r.width, r.height);
      r.rect(0, 0, r.width, r.height, "rgba(8,6,14,0.74)"); // darken for legibility
    }
    const meta = this.game.meta;
    r.text("명부", 40, 50, { color: "#f4ead2", size: 28, bold: true });
    r.text(`업 ${meta.karma}`, r.width - 40, 50, { color: GOLD, size: 24, align: "right", bold: true });
    const hubCycle = cycleOf(meta.activeCurses);
    if (hubCycle > 0) r.text(`윤회 ${hubCycle}겁`, r.width - 40, 68, { color: "#e0698a", size: 14, align: "right", bold: true });

    // 화신 + 도장 + 칭호 row(s) — stacks vertically on narrow screens.
    const narrow = r.narrow;
    const soul = getSoul(meta.selectedSoul);
    const unlocked = SOULS.filter((s) => s.isUnlocked(meta));
    r.text(`화신: ${soul.name}`, 40, 78, { color: "#bda6ff", size: 15, bold: true });
    r.text(`(C 변경 · ${unlocked.length}/${SOULS.length} 해금)`, 195, 78, { color: DIM, size: 12 });
    const kings = [
      { id: "jingwang", n: "진광" },
      { id: "chogang", n: "초강" },
      { id: "songje", n: "송제" },
      { id: "ogwan", n: "오관" },
    ];
    const drawKings = (kx0: number, ky: number) => {
      r.text("도장:", kx0 - 6, ky, { color: DIM, size: 13, align: "right" });
      let kx = kx0 + 4;
      for (const k of kings) {
        const got = meta.bossesDefeated.includes(k.id);
        r.text(`${got ? "●" : "○"}${k.n}`, kx, ky, { color: got ? GOLD : "#5a5468", size: 13 });
        kx += 56;
      }
    };
    const eqTitle = meta.equippedTitle ? getTitle(meta.equippedTitle) : undefined;
    const titleText = eqTitle
      ? `칭호 ▸ ${eqTitle.name} ${titleRank(eqTitle, meta.records)}품`
      : "칭호 ▸ 없음 (업경대 D)";
    let top: number;
    if (narrow) {
      drawKings(82, 100);
      r.text(titleText, 40, 122, { color: eqTitle ? "#bda6ff" : "#6a6480", size: 12 });
      r.text(soul.desc, 40, 142, { color: DIM, size: 11 });
      top = 168;
    } else {
      drawKings(r.width - 312, 78);
      r.text(soul.desc, 40, 98, { color: DIM, size: 12 });
      r.text(titleText, r.width - 320, 98, { color: eqTitle ? "#bda6ff" : "#6a6480", size: 12 });
      const locked = SOULS.filter((s) => !s.isUnlocked(meta));
      if (locked.length > 0) {
        r.text("잠긴 화신 ▸ " + locked.map((s) => `${s.name}: ${s.unlockHint}`).join("  ·  "), 40, 114, {
          color: "#6a6480",
          size: 11,
        });
      }
      top = 134;
    }

    const lineH = narrow ? 30 : 27;
    for (let i = 0; i < UPGRADES.length; i++) {
      const node = UPGRADES[i];
      const lvl = ownedLevel(meta, node.id);
      const cost = nextCost(meta, node);
      const y = top + i * lineH;
      const selected = i === this.sel;
      if (selected) r.rect(28, y - 15, r.width - 56, lineH - 3, "#191428");
      const affordable = canBuy(meta, node);
      const costText = cost === null ? "MAX" : narrow ? `${cost}업` : `${cost} 업`;
      const costColor = cost === null ? "#5fae7a" : affordable ? GOLD : "#7a4a4a";
      r.text(`${node.name}`, 44, y + 3, { color: selected ? GOLD : "#e3d8bf", size: 15, bold: selected });
      if (narrow) {
        r.text(`Lv ${lvl}/${node.maxLevel}`, r.width - 14, y + 3, { color: DIM, size: 12, align: "right" });
        r.text(costText, r.width - 86, y + 3, { color: costColor, size: 13, align: "right" });
      } else {
        r.text(`Lv ${lvl}/${node.maxLevel}`, 220, y + 3, { color: DIM, size: 12 });
        r.text(node.desc, 300, y + 3, { color: "#9a93a8", size: 12 });
        r.text(costText, r.width - 44, y + 3, { color: costColor, size: 13, align: "right" });
      }
    }

    // 명부 NPC (저승사자) — run-count gated dialogue hook (반복보상 §5).
    r.text(npcLine(meta), r.width / 2, r.contentBottom - 50, { color: "#9a93c0", size: 13, align: "center" });
    const cycleHint = meta.cleared ? " · R 윤회" : "";
    const footer = narrow
      ? `↑↓ Enter강화 · C화신 · D도감${cycleHint} · S출발`
      : `↑↓ 선택 · Enter 강화 · C 화신 · D 도감${cycleHint} · S 환생(출발) · Esc 타이틀`;
    r.text(footer, r.width / 2, r.contentBottom - 26, {
      color: INK,
      size: 13,
      align: "center",
    });
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
        this.cycleSoul();
        sfx.uiClick();
        break;
      case "D":
      case "d":
        this.game.setScene(new CodexScene(this.game));
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
        this.startRun();
        break;
      case "Escape":
        this.game.setScene(new TitleScene(this.game));
        break;
    }
  }

  touchBar() {
    const bar = [
      { label: "화신 C", key: "C" },
      { label: "도감 D", key: "D" },
    ];
    if (this.game.meta.cleared) bar.push({ label: "윤회 R", key: "R" });
    bar.push({ label: "출발 S", key: "S" });
    return bar;
  }

  private cycleSoul(): void {
    const meta = this.game.meta;
    const unlocked = SOULS.filter((s) => s.isUnlocked(meta));
    const cur = unlocked.findIndex((s) => s.id === meta.selectedSoul);
    meta.selectedSoul = unlocked[(cur + 1) % unlocked.length].id;
    this.game.persist();
  }

  private startRun(): void {
    const loadout = buildLoadout(this.game.meta);
    const run = new Run(this.game.meta, loadout);
    this.game.setScene(new RunScene(this.game, run));
  }
}

function npcLine(meta: MetaState): string {
  if (meta.cleared) return "저승사자: 모든 왕을 넘어선 자여… 그대는 무엇을 위해 다시 돌아오는가?";
  if (meta.bossesDefeated.includes("songje")) return "저승사자: 송제의 한기마저 견뎌냈는가. 환생의 문이 머지않았다.";
  if (meta.bossesDefeated.includes("jingwang")) return "저승사자: 진광대왕을 넘었다니… 그대의 혼이 점점 또렷해지는군.";
  if (meta.runs >= 1) return "저승사자: 죽음은 그대를 단련할 뿐. 업을 쌓아 다시 내려가라.";
  return "저승사자: 또 왔는가, 망자여. 십대왕을 넘지 못하면 이 곳을 벗어날 수 없으리.";
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
    return [{ label: "전환 Tab", key: "Tab" }];
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

  constructor(private game: Game, private run: Run) {}

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
  }

  handleKey(e: KeyboardEvent): void {
    if (this.ended) return;
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
    for (let i = 0; i < this.run.player.inventorySize; i++) bar.push({ label: `부적${i + 1}`, key: `${i + 1}` });
    return bar;
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
    // 윤회겁 보너스: 겁이 높을수록 업이 더 쌓인다.
    const earned = Math.round(karmaForRun(outcome, this.run.loadout.karmaMultiplier) * (1 + 0.05 * outcome.cycle));
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
    const bonus = ach.bonusKarma + gong.tierKarma;
    if (bonus > 0) awardKarma(meta, bonus);
    const endInfo: EndInfo = {
      gd: gong.gd,
      isPB: gong.isPB,
      rankUps: rankUps.map((r) => ({ name: r.def.name, rank: r.rank })),
      cycle: outcome.cycle,
      trueEnding,
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
  r.text("Enter — 명부로 돌아간다", cx, Math.max(y + 18, cy + 130), { color: INK, size: 16, align: "center" });
}

export class DeathScene implements Scene {
  constructor(
    private game: Game,
    private earned: number,
    private outcome: RunOutcome,
    private newly: AchievementDef[] = [],
    private end: EndInfo = { gd: 0, isPB: false, rankUps: [], cycle: 0, trueEnding: false },
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
    private end: EndInfo = { gd: 0, isPB: false, rankUps: [], cycle: 0, trueEnding: false },
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
