// 환생록 영구 강화 12종 — 강화_상세 §3 정확 효과·비용. apply(level, loadout)는
// 보유 레벨의 누적 효과를 적용한다.

import type { UpgradeNode } from "../core/types";

const NEW_BOND_ORDER = [
  "thunder_talisman", // 뇌전
  "bind_talisman", // 봉박
  "barrier_talisman", // 결계
  "requiem_talisman", // 진혼
  "guardian_talisman", // 호신
];

/** Cost array lookup; arr[ownedLevel] = cost to buy the next rank. */
const cost = (arr: number[]) => (owned: number) => arr[owned] ?? Infinity;

export const UPGRADES: UpgradeNode[] = [
  {
    id: "hardened_soul",
    name: "굳은 혼백",
    desc: "최대 HP +8",
    maxLevel: 5,
    cost: cost([15, 25, 40, 60, 85]),
    apply: (lvl, lo) => {
      lo.maxHp += 8 * lvl;
    },
  },
  {
    id: "fierce_strike",
    name: "매서운 일격",
    desc: "공격력 +1",
    maxLevel: 5,
    cost: cost([25, 40, 60, 85, 120]),
    apply: (lvl, lo) => {
      lo.atk += lvl;
    },
  },
  {
    id: "thick_karma",
    name: "단단한 업장",
    desc: "방어 +1",
    maxLevel: 3,
    cost: cost([35, 70, 120]),
    apply: (lvl, lo) => {
      lo.def += lvl;
    },
  },
  {
    id: "talisman_mastery",
    name: "부적 숙련",
    desc: "시작 시 무작위 부적 +1",
    maxLevel: 3,
    cost: cost([20, 45, 80]),
    apply: (lvl, lo) => {
      lo.randomTalismans += lvl;
    },
  },
  {
    id: "soul_granary",
    name: "영혼의 곳간",
    desc: "인벤토리 +1칸",
    maxLevel: 3,
    cost: cost([15, 30, 55]),
    apply: (lvl, lo) => {
      lo.inventorySize += lvl;
    },
  },
  {
    id: "underworld_grace",
    name: "명부의 가호",
    desc: "R1 부활(50%) · R2 부활(75%)+1턴 무적",
    maxLevel: 2,
    cost: cost([60, 110]),
    apply: (lvl, lo) => {
      lo.autoRevives = 1;
      if (lvl >= 2) {
        lo.reviveHpFraction = 0.75;
        lo.reviveInvuln = 1;
      } else {
        lo.reviveHpFraction = 0.5;
      }
    },
  },
  {
    id: "dead_intuition",
    name: "망자의 직감",
    desc: "R1 위험 타일 표시 · R2 적 위치 표시",
    maxLevel: 2,
    cost: cost([20, 40]),
    apply: (lvl, lo) => {
      lo.revealHazards = true;
      if (lvl >= 2) lo.revealEnemies = true;
    },
  },
  {
    id: "soothing",
    name: "위령",
    desc: "계단 하강 시 최대 HP +10% 회복",
    maxLevel: 3,
    cost: cost([20, 40, 70]),
    apply: (lvl, lo) => {
      lo.healOnDescendFraction += 0.1 * lvl;
    },
  },
  {
    id: "karma_interest",
    name: "업의 이자",
    desc: "획득 업 +10%",
    maxLevel: 5,
    cost: cost([30, 45, 65, 90, 120]),
    apply: (lvl, lo) => {
      lo.karmaMultiplier += 0.1 * lvl;
    },
  },
  {
    id: "new_bond",
    name: "새로운 인연",
    desc: "부적 해금(뇌전→봉박→결계→진혼→호신)",
    maxLevel: 5,
    cost: cost([25, 35, 50, 70, 95]),
    apply: (lvl, lo) => {
      for (let i = 0; i < lvl && i < NEW_BOND_ORDER.length; i++) {
        lo.unlockedTalismanPool.push(NEW_BOND_ORDER[i]);
      }
    },
  },
  {
    id: "weapon_lore",
    name: "무기 전수",
    desc: "무기 드롭 해금 (석장·도깨비방망이·환도)",
    maxLevel: 1,
    cost: cost([50]),
    apply: (_lvl, lo) => {
      lo.weaponDrops = true;
    },
  },
  {
    id: "resolve_of_samsara",
    name: "윤회의 결의",
    desc: "R1 시작 3턴 무적 · R2 +시작 호신",
    maxLevel: 2,
    cost: cost([30, 60]),
    apply: (lvl, lo) => {
      lo.startInvulnTurns = 3;
      if (lvl >= 2) lo.startEmpower = true;
    },
  },
];

const MAP = new Map(UPGRADES.map((u) => [u.id, u]));

export function getUpgrade(id: string): UpgradeNode | undefined {
  return MAP.get(id);
}
