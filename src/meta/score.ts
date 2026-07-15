// 공덕록(功德錄) — karma와 직교하는 실력 점수. 깊이·클리어·속도·무피격·무부활을
// 강가중해, "더 잘한 한 판"만이 개인최고를 민다. karmaForRun은 절대 건드리지 않는다.

import type { MetaState } from "../core/types";
import type { RunOutcome } from "./karma";

export function gongdeokForRun(o: RunOutcome): number {
  let s = o.totalFloorsDescended * 100 + o.enemiesKilled * 5;
  if (o.cleared) {
    s += 2000;
    if (o.turns > 0) s += Math.min(8000, Math.round(240000 / o.turns)); // 빠를수록 ↑ (캡)
  }
  if (o.damageTaken === 0) s = Math.round(s * 1.5); // 무피격
  if (o.revivesUsed === 0) s = Math.round(s * 1.15); // 무부활
  if (o.talismansUsed === 0) s = Math.round(s * 1.1); // 맨몸
  if (o.cycle > 0) s = Math.round(s * (1 + 0.15 * o.cycle)); // 윤회겁 — 등반할수록 ↑
  return Math.max(0, s);
}

export interface GongdeokTier {
  score: number;
  karma: number;
  name: string;
}

/** 누적 최고 공덕이 천장을 처음 넘을 때 1회성 영구 보상(업). */
export const GONGDEOK_TIERS: GongdeokTier[] = [
  { score: 1000, karma: 50, name: "공덕 천" },
  { score: 2500, karma: 100, name: "공덕 이천오백" },
  { score: 5000, karma: 200, name: "공덕 오천" },
  { score: 10000, karma: 400, name: "공덕 만" },
];

/** Record a run's 공덕: update PB (+per-soul), claim any newly-reached tiers. */
export function recordGongdeok(
  meta: MetaState,
  o: RunOutcome,
  soulId: string,
): { gd: number; isPB: boolean; tierKarma: number } {
  const gd = gongdeokForRun(o);
  const isPB = gd > meta.bestGongdeok;
  meta.bestGongdeok = Math.max(meta.bestGongdeok, gd);
  meta.bestGongdeokBySoul[soulId] = Math.max(meta.bestGongdeokBySoul[soulId] ?? 0, gd);
  let tierKarma = 0;
  while (
    meta.gongdeokTierClaimed < GONGDEOK_TIERS.length &&
    meta.bestGongdeok >= GONGDEOK_TIERS[meta.gongdeokTierClaimed].score
  ) {
    tierKarma += GONGDEOK_TIERS[meta.gongdeokTierClaimed].karma;
    meta.gongdeokTierClaimed++;
  }
  return { gd, isPB, tierKarma };
}
