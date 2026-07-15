// 인연(因緣) — 왕을 격파할 때 그 저승의 '법(法)'을 하나 빌린다(1-of-3 지속 축복). 신규 전투
// 코드 없이 Run의 경량 이벤트 훅(OnHit/OnHurt/OnKill/OnPick)에 얹혀 빌드 척추를 만든다. 효과는
// 대부분 기존 시스템의 재조합 = 왕 시그니처의 플레이어판. 같은 색 3개 → 삼매(三昧).
// (Port of Godot Content/Blessings.)

import type { Pos } from "../core/grid";
import type { GameContext } from "../core/types";
import type { Actor } from "../entities/actor";
import type { Enemy } from "../entities/enemy";

/** 축복의 三毒/淸 색 — 같은 색을 3개 모으면 삼매(三昧) 세트. */
export type BlessingTag = "cheong" | "jin" | "tam" | "chi"; // 淸 · 嗔 · 貪 · 癡

export interface BlessingDef {
  id: string;
  name: string;
  nameHanja: string;
  desc: string;
  tag: BlessingTag;
  /** 선택 즉시 1회(스탯/부활 등). */
  onPick?(ctx: GameContext): void;
  /** 플레이어가 적에게 피해를 준 직후(생존한 적, 피해량). */
  onHit?(ctx: GameContext, enemy: Enemy, dmg: number): void;
  /** 플레이어가 피해를 받은 직후(가해자 — 해저드는 undefined, 피해량). */
  onHurt?(ctx: GameContext, src: Actor | undefined, dmg: number): void;
  /** 플레이어가 적을 처치한 직후. */
  onKill?(ctx: GameContext, enemy: Enemy): void;
}

// 우세 축(대각 아닌) 단위 방향.
function cardinal(delta: Pos): Pos {
  return Math.abs(delta.x) >= Math.abs(delta.y) ? { x: Math.sign(delta.x), y: 0 } : { x: 0, y: Math.sign(delta.y) };
}
function nudge(ctx: GameContext, a: Actor, dir: Pos): void {
  if (!dir.x && !dir.y) return;
  const to = { x: a.pos.x + dir.x, y: a.pos.y + dir.y };
  if (!ctx.isWall(to) && !ctx.actorAt(to)) ctx.moveActor(a, to);
}

export const BLESSINGS: BlessingDef[] = [
  // ── 平타 부여형(嗔/貪/癡) — 얕은 4왕의 원소 시그니처 ──
  {
    id: "ember", name: "겁화", nameHanja: "劫火", tag: "jin", desc: "평타에 화상을 입힌다.",
    onHit: (ctx, e) => ctx.applyStatus(e, "burn", 3, 2),
  },
  {
    id: "venom_fang", name: "독아", nameHanja: "毒牙", tag: "tam", desc: "평타에 중독을 입힌다.",
    onHit: (ctx, e) => ctx.applyStatus(e, "poison", 3, 2),
  },
  {
    id: "frostbite", name: "한기", nameHanja: "寒氣", tag: "chi", desc: "평타가 가끔 빙결시킨다.",
    onHit: (ctx, e) => {
      if (ctx.rng.chance(0.3)) ctx.applyStatus(e, "freeze", 1);
    },
  },
  {
    id: "leech", name: "흡정", nameHanja: "吸精", tag: "tam", desc: "평타로 혼백을 조금 흡수한다.",
    onHit: (ctx) => ctx.heal(ctx.player, 1),
  },

  // ── 피격 반응형(淸/嗔) — 염라 거울 · 도시 바람의 플레이어판 ──
  {
    id: "karma_mirror", name: "업경", nameHanja: "業鏡", tag: "cheong", desc: "피격 시 일부를 되비춘다.",
    onHurt: (ctx, src, dmg) => {
      if (src && src.isEnemy && src.alive) {
        ctx.dealDamage(src, Math.min(8, Math.ceil(dmg * 0.4)), { source: src, kind: "pure" });
      }
    },
  },
  {
    id: "gale_ward", name: "역풍", nameHanja: "逆風", tag: "jin", desc: "피격 시 가해자를 밀쳐낸다.",
    onHurt: (ctx, src) => {
      if (src) nudge(ctx, src, cardinal({ x: src.pos.x - ctx.player.pos.x, y: src.pos.y - ctx.player.pos.y }));
    },
  },

  // ── 처치 반응형(貪/癡) — 아귀 흡혼 · 태산 견인 ──
  {
    id: "soul_eater", name: "혼식", nameHanja: "魂食", tag: "tam", desc: "처치 시 혼백을 회복한다.",
    onKill: (ctx) => ctx.heal(ctx.player, 4),
  },
  {
    id: "hook_pull", name: "견혼", nameHanja: "牽魂", tag: "chi", desc: "처치 시 가까운 적을 끌어당긴다.",
    onKill: (ctx, victim) => {
      const foe = ctx
        .allEnemies()
        .filter((x) => x.alive && x !== victim)
        .sort((a, b) => manhattanTo(a.pos, ctx.player.pos) - manhattanTo(b.pos, ctx.player.pos))[0];
      if (foe) nudge(ctx, foe, cardinal({ x: ctx.player.pos.x - foe.pos.x, y: ctx.player.pos.y - foe.pos.y }));
    },
  },

  // ── 즉시 강화형(淸/嗔) — 전륜 되감기 · 근골 ──
  {
    id: "rebound", name: "환생", nameHanja: "還生", tag: "cheong", desc: "부활 1회 추가.",
    onPick: (ctx) => {
      ctx.player.autoRevives += 1;
    },
  },
  {
    id: "iron_hide", name: "철갑", nameHanja: "鐵甲", tag: "cheong", desc: "최대 혼백 +6.",
    onPick: (ctx) => {
      ctx.player.stats.maxHp += 6;
      ctx.player.stats.hp += 6;
    },
  },
  {
    id: "wrath", name: "분노", nameHanja: "忿怒", tag: "jin", desc: "공격력 +2.",
    onPick: (ctx) => {
      ctx.player.stats.atk += 2;
    },
  },
];

function manhattanTo(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

const MAP = new Map<string, BlessingDef>(BLESSINGS.map((b) => [b.id, b]));

export function getBlessing(id: string): BlessingDef | undefined {
  return MAP.get(id);
}

/** 왕 격파 시 제시할 서로 다른 N택(결정론 Rng). 기본 3, 8겁부터 4택. */
export function drawBlessings(rng: { shuffle<T>(a: T[]): T[] }, n: number): string[] {
  const pool = BLESSINGS.map((b) => b.id);
  rng.shuffle(pool);
  return pool.slice(0, Math.max(1, Math.min(n, pool.length)));
}
