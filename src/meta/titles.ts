// 업경대(業鏡臺) — 칭호(稱號) 레지스트리 + 영구 기록 갱신.
// 칭호 랭크는 개인최고 기록(MetaState.records)의 함수 — 신기록을 실제로 넘을 때만 오르는
// 단조 천장(파밍 면역). 착용 1개만 buildLoadout에서 미량 패시브로 적용.

import type { MetaState, RunLoadout, RunRecords } from "../core/types";
import type { RunOutcome } from "./karma";

export interface TitleDef {
  id: string;
  name: string;
  nameHanja: string;
  desc: string;
  /** 이 칭호가 추종하는 기록 값. */
  track(r: RunRecords): number;
  /** 랭크 경계. lowerBetter면 값 ≤ 경계, 아니면 값 ≥ 경계. */
  thresholds: number[];
  lowerBetter?: boolean;
  /** 착용 시 미량 패시브(rank 1..thresholds.length). */
  apply(rank: number, lo: RunLoadout): void;
}

export const TITLES: TitleDef[] = [
  {
    id: "ascendant",
    name: "등천자",
    nameHanja: "登天者",
    desc: "최고 깊이 기록 — 랭크당 최대 혼백 +5",
    track: (r) => r.deepestStage,
    thresholds: [3, 6, 9, 12],
    apply: (rank, lo) => {
      lo.maxHp += 5 * rank;
    },
  },
  {
    id: "slayer",
    name: "도륙왕",
    nameHanja: "屠戮王",
    desc: "한 런 최다 처치 기록 — 랭크당 공격력 +1",
    track: (r) => r.mostKills,
    thresholds: [30, 60, 100, 150],
    apply: (rank, lo) => {
      lo.atk += rank;
    },
  },
  {
    id: "unbroken",
    name: "불괴신",
    nameHanja: "不壞身",
    desc: "무피격 최고 깊이 기록 — 랭크당 방어력 +1",
    track: (r) => r.bestNoHitDepth,
    thresholds: [3, 6, 9, 12],
    apply: (rank, lo) => {
      lo.def += rank;
    },
  },
  {
    id: "swift",
    name: "신행자",
    nameHanja: "神行者",
    desc: "최단 클리어 턴 기록 — 시작 무적 + 업 이자",
    track: (r) => r.fastestClearTurns,
    lowerBetter: true,
    thresholds: [400, 300, 220, 150],
    apply: (rank, lo) => {
      lo.startInvulnTurns += Math.min(rank, 2);
      lo.karmaMultiplier += 0.05 * rank;
    },
  },
];

const MAP = new Map(TITLES.map((t) => [t.id, t]));
export function getTitle(id: string): TitleDef | undefined {
  return MAP.get(id);
}

export function titleRank(def: TitleDef, r: RunRecords): number {
  const v = def.track(r);
  if (def.lowerBetter) return v <= 0 ? 0 : def.thresholds.filter((t) => v <= t).length;
  return def.thresholds.filter((t) => v >= t).length;
}

/** Fold the run's stats into permanent records; return any titles that ranked up. */
export function updateRecords(meta: MetaState, o: RunOutcome): { rankUps: { def: TitleDef; rank: number }[] } {
  const before = TITLES.map((t) => titleRank(t, meta.records));
  const r = meta.records;
  r.deepestStage = Math.max(r.deepestStage, o.totalFloorsDescended);
  r.mostKills = Math.max(r.mostKills, o.enemiesKilled);
  if (o.damageTaken === 0) r.bestNoHitDepth = Math.max(r.bestNoHitDepth, o.totalFloorsDescended);
  if (o.cleared && o.turns > 0) {
    r.fastestClearTurns = r.fastestClearTurns === 0 ? o.turns : Math.min(r.fastestClearTurns, o.turns);
  }
  const after = TITLES.map((t) => titleRank(t, meta.records));
  const rankUps: { def: TitleDef; rank: number }[] = [];
  TITLES.forEach((t, i) => {
    if (after[i] > before[i]) rankUps.push({ def: t, rank: after[i] });
  });
  return { rankUps };
}
