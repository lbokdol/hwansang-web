// 업(業) accounting + 환생록 강화 구매.

import type { MetaState, UpgradeNode } from "../core/types";
import { getUpgrade } from "./upgrades";

export interface RunOutcome {
  hellIndex: number; // descent index reached (0-based) — depth, not which hell
  hellName: string; // actual hell reached (랜덤 순서 대응 표시용)
  floorIndex: number; // deepest floor within that hell (0-based)
  totalFloorsDescended: number; // absolute depth across all hells
  bossesKilled: number;
  enemiesKilled: number;
  cleared: boolean;
  /** 공과록(업적) 판정용 런 통계. */
  damageTaken: number;
  talismansUsed: number;
  revivesUsed: number;
  /** 업경대/공덕록: 이 런에 소요된 턴 수. */
  turns: number;
  /** 윤회겁: 이 런의 겁(劫). */
  cycle: number;
  /** 서원(誓願): 파계 없이 지킨 계율 ids (업 배율 보너스). */
  vowsKept: string[];
}

/**
 * 업 = (도달 최대 층 × 5) + (격파한 왕 × 30) + (처치 수 × 1), × (1 + 업의이자).
 * (강화_상세 §1.) karmaMultiplier already encodes (1 + 이자).
 */
export function karmaForRun(outcome: RunOutcome, karmaMultiplier: number): number {
  const depthScore = outcome.totalFloorsDescended * 5;
  const bossScore = outcome.bossesKilled * 30;
  const killScore = outcome.enemiesKilled * 1;
  const raw = depthScore + bossScore + killScore;
  return Math.max(0, Math.round(raw * karmaMultiplier));
}

export function ownedLevel(meta: MetaState, nodeId: string): number {
  return meta.upgrades[nodeId] ?? 0;
}

export function nextCost(meta: MetaState, node: UpgradeNode): number | null {
  const lvl = ownedLevel(meta, node.id);
  if (lvl >= node.maxLevel) return null;
  return node.cost(lvl);
}

export function canBuy(meta: MetaState, node: UpgradeNode): boolean {
  const cost = nextCost(meta, node);
  return cost !== null && meta.karma >= cost;
}

/** Purchase one level of an upgrade. Mutates meta; returns success. */
export function buyUpgrade(meta: MetaState, nodeId: string): boolean {
  const node = getUpgrade(nodeId);
  if (!node) return false;
  const cost = nextCost(meta, node);
  if (cost === null || meta.karma < cost) return false;
  meta.karma -= cost;
  meta.upgrades[nodeId] = ownedLevel(meta, nodeId) + 1;
  return true;
}

/** Award karma earned in a run (adds to both spendable + lifetime). */
export function awardKarma(meta: MetaState, amount: number): void {
  meta.karma += amount;
  meta.totalKarma += amount;
}
