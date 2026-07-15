// 무기 4종 (게임설계서 §6, 전투_상세 §5). 드롭은 「무기 전수」 강화로 해금.

import type { WeaponDef } from "../core/types";

export const WEAPONS: WeaponDef[] = [
  {
    id: "yeomju",
    name: "염주",
    nameHanja: "念珠",
    glyph: "염",
    color: "#c9b27a",
    desc: "균형 잡힌 기본 병기.",
    atkBonus: 0,
    reach: 1,
    knockback: 0,
    extraActionChance: 0,
  },
  {
    id: "seokjang",
    name: "석장",
    nameHanja: "錫杖",
    glyph: "석",
    color: "#bda06b",
    desc: "사거리 2칸 — 앞의 적까지 함께 벤다.",
    atkBonus: 0,
    reach: 2,
    knockback: 0,
    extraActionChance: 0,
  },
  {
    id: "dokkaebi",
    name: "도깨비방망이",
    nameHanja: "棒",
    glyph: "도",
    color: "#d4612b",
    desc: "고데미지 + 넉백(벽·위험타일로 밀치면 추가 피해).",
    atkBonus: 3,
    reach: 1,
    knockback: 1,
    extraActionChance: 0,
  },
  {
    id: "hwando",
    name: "환도",
    nameHanja: "環刀",
    glyph: "환",
    color: "#d7dde8",
    desc: "빠름 — 가끔 추가 행동.",
    atkBonus: 0,
    reach: 1,
    knockback: 0,
    extraActionChance: 0.25,
  },
];

const MAP = new Map(WEAPONS.map((w) => [w.id, w]));
export const DEFAULT_WEAPON = "yeomju";

export function getWeapon(id: string): WeaponDef {
  return MAP.get(id) ?? MAP.get(DEFAULT_WEAPON)!;
}

export function hasWeapon(id: string): boolean {
  return MAP.has(id);
}

/** Weapons that drop on floors (excludes the default starter). */
export const weaponDropPool: string[] = WEAPONS.filter((w) => w.id !== DEFAULT_WEAPON).map((w) => w.id);
