// 화신 숙련(化身 熟練) — 한 화신으로 오래 굴릴수록 그 화신만 영구 강해진다(메인 캐릭터 육성).
// 죄·판결과 무관한 순수 성장 축. 경험은 런 종료 시 강하 깊이 + 클리어로 쌓인다.
// (Port of Godot Meta/SoulMastery.)

import type { MetaState, RunLoadout } from "../core/types";
import type { RunOutcome } from "./karma";

/** 레벨 임계(누적 화신 경험). 최대 5레벨. */
export const SOUL_MASTERY_THRESHOLDS = [30, 80, 160, 280, 450];
export const SOUL_MASTERY_MAX_LEVEL = SOUL_MASTERY_THRESHOLDS.length;

export function soulLevel(xp: number): number {
  return SOUL_MASTERY_THRESHOLDS.filter((t) => xp >= t).length;
}

/** 런 종료 시 그 화신이 얻는 경험 = 강하 층 + (클리어 시 30). */
export function soulRunXp(o: RunOutcome): number {
  return o.totalFloorsDescended + (o.cleared ? 30 : 0);
}

/** 숙련 레벨에 따른 영구 강화(선택한 화신에만): 최대 HP +3/레벨, ATK +1 / 2레벨. */
export function applySoulMastery(lo: RunLoadout, xp: number): void {
  const lv = soulLevel(xp);
  lo.maxHp += 3 * lv;
  lo.atk += Math.floor(lv / 2);
}

/** 다음 레벨까지 진행도(0..1). 만렙이면 1. */
export function soulProgress(xp: number): number {
  const lv = soulLevel(xp);
  if (lv >= SOUL_MASTERY_MAX_LEVEL) return 1;
  const prev = lv === 0 ? 0 : SOUL_MASTERY_THRESHOLDS[lv - 1];
  const next = SOUL_MASTERY_THRESHOLDS[lv];
  return next > prev ? (xp - prev) / (next - prev) : 1;
}

/**
 * Accumulate this run's XP onto the run's soul. Returns the new level and
 * whether the soul just leveled up (for a results-screen flourish).
 */
export function addSoulXp(meta: MetaState, soulId: string, outcome: RunOutcome): { level: number; leveledUp: boolean } {
  const before = meta.soulXp[soulId] ?? 0;
  const after = before + soulRunXp(outcome);
  meta.soulXp[soulId] = after;
  return { level: soulLevel(after), leveledUp: soulLevel(after) > soulLevel(before) };
}
