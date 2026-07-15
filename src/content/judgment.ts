// 업경대(業鏡臺) 심판 판결 레지스트리. 각 왕이 그 지옥에서의 '태도(三毒)'를 저울질해
// 최고 우선순위 판결을 내린다. 판결 효과는 즉시·가시적 — 왕의 초상 + 판결이 이 게임의
// 시그니처 순간이다. (Port of Godot Content/Judgment.)

import type { GameContext } from "../core/types";
import type { Enemy } from "../entities/enemy";

/** 한 지옥에서 망자가 보인 '태도' — 업경은 몸이 아니라 방식(方式)을 비춘다. */
export interface Conduct {
  kills: number;
  damageTaken: number;
  altarsTaken: number;
  pickups: number;
  talismansUsed: number;
  /** 嗔: 무력한 자(빙결·봉박·수면)를 벤 잔혹. */
  subdued: number;
  /** 癡: 축지·천리안 등 요행/술수 사용. */
  escapes: number;
  /** 三毒 제단(향후) 직접 죄 — 지금은 0. */
  sinJin: number;
  sinTam: number;
  sinChi: number;
}

export function emptyConduct(): Conduct {
  return { kills: 0, damageTaken: 0, altarsTaken: 0, pickups: 0, talismansUsed: 0, subdued: 0, escapes: 0, sinJin: 0, sinTam: 0, sinChi: 0 };
}

// ── 三毒(탐·진·치) scoring — 업경은 몸이 아니라 방식을 읽는다 ──
/** 嗔(분노): 잔혹 — 무력한 자를 벤 손. */
export function jin(c: Conduct): number {
  return c.subdued * 2 + c.sinJin;
}
/** 貪(욕심): 그러쥠 — 제단·전리품. */
export function tam(c: Conduct): number {
  return c.altarsTaken * 3 + c.pickups + c.sinTam;
}
/** 癡(미혹): 요행에 매달림 — 도피/투시 술수. */
export function chi(c: Conduct): number {
  return c.escapes * 2 + c.sinChi;
}
/** 탁(濁): 거울이 얼마나 흐린가. */
export function turbidity(c: Conduct): number {
  return jin(c) + tam(c) + chi(c);
}
/** 청(淸): 흠 없이(무피격) 지옥을 통과했는가. */
export function clear(c: Conduct): boolean {
  return c.damageTaken === 0;
}

export interface VerdictDef {
  id: string;
  name: string;
  nameHanja: string;
  /** 판결 낭독(시그니처 순간). */
  flavor: string;
  isBoon?: boolean;
  priority: number;
  qualifies(c: Conduct): boolean;
  apply(ctx: GameContext, boss: Enemy): void;
}

export const JUDGMENTS: VerdictDef[] = [
  // 정심(淨心) — 흠 없이 삼독에 물들지 않고 내려온 맑은 자에게 보우(保佑).
  {
    id: "jeongsim",
    name: "정심",
    nameHanja: "淨心",
    flavor: "업경이 맑다. 흠 없는 자에게 왕이 보우를 내린다.",
    isBoon: true,
    priority: 100,
    qualifies: (c) => clear(c) && turbidity(c) <= 2,
    apply: (ctx, _boss) => {
      ctx.heal(ctx.player, ctx.player.stats.maxHp);
      ctx.applyStatus(ctx.player, "empower", 6, 3, undefined, 2);
    },
  },
  // 진노(瞋) — 무력한 자를 벤 잔혹한 손, 그 분노를 왕이 되돌려준다(보스 격화).
  {
    id: "jinno",
    name: "진노",
    nameHanja: "瞋",
    flavor: "무력한 자를 벤 손. 왕이 그 분노를 되돌려준다.",
    priority: 60,
    qualifies: (c) => jin(c) >= 4 && jin(c) >= tam(c) && jin(c) >= chi(c),
    apply: (_ctx, boss) => {
      boss.stats.atk += 3;
      boss.stats.maxHp = Math.floor(boss.stats.maxHp * 1.2);
      boss.stats.hp = boss.stats.maxHp;
    },
  },
  // 탐욕(貪) — 재물을 그러쥔 자, 업장이 두터워진다(보스 결계 + 격화).
  {
    id: "tamyok",
    name: "탐욕",
    nameHanja: "貪",
    flavor: "재물을 그러쥔 자. 업장이 두터운 결계로 왕을 감싼다.",
    priority: 50,
    qualifies: (c) => tam(c) >= 6 && tam(c) >= jin(c) && tam(c) >= chi(c),
    apply: (ctx, boss) => {
      boss.stats.atk += 2;
      ctx.applyStatus(boss, "shield", 999, Math.floor(boss.stats.maxHp * 0.4));
    },
  },
  // 우치(癡) — 요행과 술수에 매달린 자, 심판 앞에 마음이 흐려 둔해진다(왕 호신 + 본인 둔화).
  {
    id: "uchi",
    name: "우치",
    nameHanja: "癡",
    flavor: "요행에 매달린 자. 심판 앞에 마음이 흐려 발이 둔해진다.",
    priority: 40,
    qualifies: (c) => chi(c) >= 4 && chi(c) >= jin(c) && chi(c) >= tam(c),
    apply: (ctx, boss) => {
      ctx.applyStatus(boss, "empower", 8, 2);
      ctx.applyStatus(ctx.player, "slow", 4);
    },
  },
  // 평(平) — 가벼이 방면(放免). 항상 마지막 후보(효과 없음).
  {
    id: "pyeong",
    name: "방면",
    nameHanja: "平",
    flavor: "가벼이 방면한다. 다음 지옥으로.",
    priority: 0,
    qualifies: () => true,
    apply: () => {},
  },
];

/** 태도를 저울질 → 왕의 판결(최고 우선순위 자격자). */
export function evaluateVerdict(c: Conduct): VerdictDef {
  return JUDGMENTS.filter((v) => v.qualifies(c)).sort((a, b) => b.priority - a.priority)[0];
}
