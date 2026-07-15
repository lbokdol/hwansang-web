// 새로운 인연으로 해금되는 5종 (부적_상세 §5): 뇌전→봉박→결계→진혼→호신.

import { manhattan } from "../../core/grid";
import type { TalismanDef } from "../../core/types";
import { atkScaled, enemiesAround } from "./effects";

export const thunderTalisman: TalismanDef = {
  id: "thunder_talisman",
  name: "뇌전부",
  nameHanja: "雷電符",
  glyph: "뇌",
  color: "#7fd0ff",
  desc: "반경 3칸 최대 3체 연쇄 번개(ATK×1, DEF무시)",
  targeting: "none",
  weight: 10,
  use(ctx) {
    const targets = ctx
      .allEnemies()
      .filter((e) => manhattan(e.pos, ctx.player.pos) <= 3)
      .sort((a, b) => manhattan(a.pos, ctx.player.pos) - manhattan(b.pos, ctx.player.pos))
      .slice(0, 3);
    ctx.fx.flashCells(targets.map((e) => e.pos), "#7fd0ff");
    const dmg = atkScaled(ctx, 1);
    let hit = 0;
    for (const e of targets) hit += ctx.dealDamage(e, dmg, { source: ctx.player, kind: "lightning", ignoreDef: true });
    ctx.fx.shake(3);
    return { consumed: true, message: hit > 0 ? "뇌전이 적들을 꿰뚫는다." : "번개가 허공에서 흩어진다." };
  },
};

export const bindTalisman: TalismanDef = {
  id: "bind_talisman",
  name: "봉박부",
  nameHanja: "封縛符",
  glyph: "봉",
  color: "#b08cff",
  desc: "대상 적을 3턴 빙결(시야 5칸)",
  targeting: "enemy",
  range: 5,
  weight: 8,
  use(ctx, target) {
    if (!target.enemy) return { consumed: false };
    // 봉박부로 적을 묶을 땐 3턴 빙결 (전투_상세 §4.1).
    ctx.applyStatus(target.enemy, "freeze", 3, 1, ctx.player);
    ctx.fx.flashCells([target.enemy.pos], "#b08cff");
    ctx.fx.floatText(target.enemy.pos, "봉", "#b08cff");
    return { consumed: true, message: "봉박의 사슬이 적을 옭아맨다." };
  },
};

export const barrierTalisman: TalismanDef = {
  id: "barrier_talisman",
  name: "결계부",
  nameHanja: "結界符",
  glyph: "결",
  color: "#c9b27a",
  desc: "최대 HP의 40%만큼 피해 흡수 보호막",
  targeting: "none",
  weight: 7,
  use(ctx) {
    const pool = Math.ceil(ctx.player.stats.maxHp * 0.4);
    ctx.applyStatus(ctx.player, "shield", 999, pool);
    ctx.fx.floatText(ctx.player.pos, "결", "#c9b27a");
    return { consumed: true, message: `결계가 몸을 두른다. (${pool} 흡수)` };
  },
};

export const requiemTalisman: TalismanDef = {
  id: "requiem_talisman",
  name: "진혼부",
  nameHanja: "鎭魂符",
  glyph: "진",
  color: "#8c9bb0",
  desc: "반경 2칸 적 수면 4턴(피격 시 해제)",
  targeting: "none",
  weight: 6,
  use(ctx) {
    const foes = enemiesAround(ctx, ctx.player.pos, 2);
    ctx.fx.flashCells(foes.map((e) => e.pos), "#8c9bb0");
    for (const e of foes) ctx.applyStatus(e, "sleep", 4, 1, ctx.player);
    return { consumed: true, message: foes.length ? "진혼의 가락에 사기가 잠든다." : "잠재울 혼이 없다." };
  },
};

export const guardianTalisman: TalismanDef = {
  id: "guardian_talisman",
  name: "호신부",
  nameHanja: "護身符",
  glyph: "호",
  color: "#ffd86b",
  desc: "5턴간 ATK +3 / DEF +2",
  targeting: "none",
  weight: 5,
  use(ctx) {
    ctx.applyStatus(ctx.player, "empower", 5, 3, undefined, 2);
    return { consumed: true, message: "기운이 솟구친다. (공 +3 / 방 +2)" };
  },
};

// --- v1.1: 중독/출혈 대응 부적 ---

export const detoxTalisman: TalismanDef = {
  id: "detox_talisman",
  name: "해독부",
  nameHanja: "解毒符",
  glyph: "해",
  color: "#9be36b",
  desc: "중독·출혈·화상 해제 + 최대 HP 15% 회복",
  targeting: "none",
  weight: 7,
  use(ctx) {
    const before = ctx.player.statuses.length;
    ctx.player.statuses = ctx.player.statuses.filter(
      (s) => s.kind !== "poison" && s.kind !== "bleed" && s.kind !== "burn",
    );
    const cleared = before - ctx.player.statuses.length;
    ctx.heal(ctx.player, Math.ceil(ctx.player.stats.maxHp * 0.15));
    ctx.fx.floatText(ctx.player.pos, "해", "#9be36b");
    return { consumed: true, message: cleared > 0 ? "독과 상처가 씻겨 내린다." : "몸이 맑아진다." };
  },
};

export const venomTalisman: TalismanDef = {
  id: "venom_talisman",
  name: "맹독부",
  nameHanja: "猛毒符",
  glyph: "맹",
  color: "#6bbf4a",
  desc: "반경 2칸 적 중독 4턴(2/턴)",
  targeting: "none",
  weight: 6,
  use(ctx) {
    const foes = enemiesAround(ctx, ctx.player.pos, 2);
    ctx.fx.flashCells(
      foes.map((e) => e.pos),
      "#6bbf4a",
    );
    for (const e of foes) ctx.applyStatus(e, "poison", 4, 2, ctx.player);
    return { consumed: true, message: foes.length ? "맹독이 사방에 퍼진다." : "독을 머금을 적이 없다." };
  },
};

export const advancedTalismans: TalismanDef[] = [
  thunderTalisman,
  bindTalisman,
  barrierTalisman,
  requiemTalisman,
  guardianTalisman,
  detoxTalisman,
  venomTalisman,
];
