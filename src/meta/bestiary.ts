// 요괴 도감 숙련(熟練) — 처치수 누적으로 요괴를 '복속(服屬)'해 간다. 수집(도감 별 채우기)
// + 육성(숙련한 요괴 처치 시 정기 보너스)을 하나로 묶은 경량 성장 트랙. 죄·판결과 무관한
// 순수 수집/성장 재미. (Port of Godot Meta/Bestiary.)

import type { MetaState } from "../core/types";

/** 별 1/2/3 임계(누적 처치수). */
export const BESTIARY_THRESHOLDS = [8, 25, 60];

/** 숙련 등급 0..3(★). */
export function bestiaryTier(kills: number): number {
  return BESTIARY_THRESHOLDS.filter((t) => kills >= t).length;
}

/** 복속(mastered) = 최고 등급 도달. */
export function bestiaryMastered(kills: number): boolean {
  return kills >= BESTIARY_THRESHOLDS[BESTIARY_THRESHOLDS.length - 1];
}

/** 숙련한 요괴를 벨 때 얹히는 정기(精氣) 보너스 = 등급(육성 보상). */
export function bestiaryJeonggiBonus(kills: number): number {
  return bestiaryTier(kills);
}

/** ★ 문자열(도감 표시용). */
export function bestiaryStars(kills: number): string {
  const t = bestiaryTier(kills);
  return "★".repeat(t) + "☆".repeat(BESTIARY_THRESHOLDS.length - t);
}

/**
 * Record a kill of `enemyId` on the meta. Returns the pre-kill count (used for
 * the jeonggi bonus this kill grants) and whether it just crossed a ★ tier.
 */
export function recordKill(meta: MetaState, enemyId: string): { prev: number; tierUp: boolean } {
  const prev = meta.enemyKills[enemyId] ?? 0;
  meta.enemyKills[enemyId] = prev + 1;
  return { prev, tierUp: bestiaryTier(prev + 1) > bestiaryTier(prev) };
}
