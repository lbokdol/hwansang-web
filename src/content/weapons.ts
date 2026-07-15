// 무기 4종 (게임설계서 §6, 전투_상세 §5). 드롭은 「무기 전수」 강화로 해금.

import type { WeaponDef } from "../core/types";

export const WEAPONS: WeaponDef[] = [
  {
    id: "yeomju",
    name: "염주",
    nameHanja: "念珠",
    glyph: "염",
    color: "#c9b27a",
    desc: "회향(回向) — 타격 시 가끔 혼백이 조금 차오른다.",
    atkBonus: 0,
    reach: 1,
    knockback: 0,
    extraActionChance: 0,
    soulOnHit: 2,
    soulOnHitChance: 0.3,
  },
  {
    id: "seokjang",
    name: "석장",
    nameHanja: "錫杖",
    glyph: "석",
    color: "#bda06b",
    desc: "사거리 2칸 관통 + 쓸어치기로 가끔 둔화.",
    atkBonus: 0,
    reach: 2,
    knockback: 0,
    extraActionChance: 0,
    onHit: { kind: "slow", turns: 2, power: 1 },
    onHitChance: 0.35,
  },
  {
    id: "dokkaebi",
    name: "도깨비방망이",
    nameHanja: "棒",
    glyph: "도",
    color: "#d4612b",
    desc: "고데미지 + 넉백 + 둔기 상처로 가끔 출혈.",
    atkBonus: 3,
    reach: 1,
    knockback: 1,
    extraActionChance: 0,
    onHit: { kind: "bleed", turns: 3, power: 2 },
    onHitChance: 0.3,
  },
  {
    id: "hwando",
    name: "환도",
    nameHanja: "環刀",
    glyph: "환",
    color: "#d7dde8",
    desc: "빠름 — 가끔 추가 행동 + 급소를 노려 치명타 확률↑.",
    atkBonus: 0,
    reach: 1,
    knockback: 0,
    extraActionChance: 0.25,
    critBonus: 0.15,
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
