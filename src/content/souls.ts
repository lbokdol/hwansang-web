// 시작 화신(영혼) — 반복보상 §3.2. 시작 플레이 방식을 바꾼다. 해금은 도장(왕 격파)·클리어로.

import type { SoulDef } from "../core/types";

const wanderer: SoulDef = {
  id: "wanderer",
  name: "떠돌이혼",
  nameHanja: "魂",
  desc: "표준 — 균형 잡힌 시작 (HP 30 / ATK 5 / DEF 1).",
  unlockHint: "기본 제공",
  isUnlocked: () => true,
  apply: () => {},
};

const warrior: SoulDef = {
  id: "warrior",
  name: "무사혼",
  nameHanja: "武士魂",
  desc: "최대 HP +10, ATK +1, 부적 슬롯 −1, 시작 석장. 평타가 가끔 추가타.",
  unlockHint: "진광대왕 격파 시 해금",
  isUnlocked: (meta) => meta.bossesDefeated.includes("jingwang"),
  apply: (lo) => {
    lo.maxHp += 10;
    lo.atk += 1;
    lo.inventorySize = Math.max(2, lo.inventorySize - 1);
    lo.bonusAttackChance += 0.25;
    lo.startWeapon = "seokjang";
  },
};

const shaman: SoulDef = {
  id: "shaman",
  name: "무당혼",
  nameHanja: "巫堂魂",
  desc: "최대 HP −6, 인벤토리 +1, 시작 부적 +2 — 부적 중심.",
  unlockHint: "초강대왕 격파 시 해금",
  isUnlocked: (meta) => meta.bossesDefeated.includes("chogang"),
  apply: (lo) => {
    lo.maxHp -= 6;
    lo.inventorySize += 1;
    lo.randomTalismans += 2;
  },
};

const child: SoulDef = {
  id: "child",
  name: "동자혼",
  nameHanja: "童子魂",
  desc: "HP −8, ATK −1, 획득 업 +30%, 위기 1회 회피, 시작 부적 +1.",
  unlockHint: "송제대왕 격파 시 해금",
  isUnlocked: (meta) => meta.bossesDefeated.includes("songje"),
  apply: (lo) => {
    lo.maxHp -= 8;
    lo.atk = Math.max(1, lo.atk - 1);
    lo.karmaMultiplier += 0.3;
    lo.autoRevives = Math.max(lo.autoRevives, 1);
    lo.reviveHpFraction = Math.max(lo.reviveHpFraction, 0.3);
    lo.randomTalismans += 1;
  },
};

const vengeful: SoulDef = {
  id: "vengeful",
  name: "원귀혼",
  nameHanja: "怨鬼魂",
  desc: "최대 HP −10, ATK +3, 추가타 확률 +15% — 고위험 고화력.",
  unlockHint: "환생(클리어) 달성 시 해금",
  isUnlocked: (meta) => meta.cleared,
  apply: (lo) => {
    lo.maxHp -= 10;
    lo.atk += 3;
    lo.bonusAttackChance += 0.15;
  },
};

export const SOULS: SoulDef[] = [wanderer, warrior, shaman, child, vengeful];

export function getSoul(id: string): SoulDef {
  return SOULS.find((s) => s.id === id) ?? wanderer;
}
