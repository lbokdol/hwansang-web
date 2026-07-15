// 명부 고시(冥府告示) — 날짜 해시로 화신·서원·악연·시드를 고정한 짧은 1지옥 시험.
// 매일 다시 켤 이유 + 같은 조건 PB 재도전. (Port of Godot Meta/DailyChallenge.)

import type { MetaState, RunLoadout } from "../core/types";
import type { RunOutcome } from "../meta/karma";
import { buildLoadout } from "../meta/loadout";
import { gongdeokForRun } from "../meta/score";
import { SOULS } from "./souls";
import { VOWS } from "./vows";

export interface DailySpec {
  dateKey: string;
  seed: number;
  soulId: string;
  vowId: string;
  curseId: string;
}
export interface DailyResult {
  score: number;
  isPB: boolean;
  completed: boolean;
  rewardKarma: number;
  streak: number;
}

// 규칙형 악연 우선 — 매일이 단순 수치 증감보다 다른 퍼즐이 되게.
const DAILY_CURSES = ["short_life", "dull_blade", "poverty", "blind", "sealed", "punishment"];

function stableHash(text: string): number {
  let hash = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash & 0x7fffffff;
}

export function dateKeyOf(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dailyForKey(dateKey: string): DailySpec {
  const seed = stableHash(dateKey);
  const u = seed >>> 0;
  const soulId = SOULS[u % SOULS.length].id;
  const vowId = VOWS[(u >>> 7) % VOWS.length].id;
  const curseId = DAILY_CURSES[(u >>> 15) % DAILY_CURSES.length];
  return { dateKey, seed, soulId, vowId, curseId };
}

/** 오늘의 시험. now 미지정 시 현재 날짜(브라우저 로컬). */
export function dailyToday(now: Date = new Date()): DailySpec {
  return dailyForKey(dateKeyOf(now));
}

/**
 * 영구 성장은 존중하되 오늘의 화신·서원·악연만 고정한 로드아웃. hellLimit=1 → 1지옥 규격.
 * (악연은 로드아웃 페널티로 반영; 적 스케일은 기본.)
 */
export function buildDailyLoadout(meta: MetaState, spec: DailySpec): RunLoadout {
  const temp: MetaState = { ...meta, selectedSoul: spec.soulId, activeCurses: [spec.curseId] };
  const lo = buildLoadout(temp);
  lo.activeVows = [spec.vowId];
  lo.hellLimit = 1;
  return lo;
}

export function recordDaily(meta: MetaState, spec: DailySpec, outcome: RunOutcome): DailyResult {
  const vowKept = outcome.vowsKept.includes(spec.vowId);
  const score = gongdeokForRun(outcome) + (vowKept ? 750 : 0) + (outcome.cleared ? 1250 : 0);
  const old = meta.dailyBestByDate[spec.dateKey] ?? 0;
  const isPB = score > old;
  if (isPB) meta.dailyBestByDate[spec.dateKey] = score;

  const completed = outcome.cleared && vowKept;
  let rewardKarma = 0;
  if (completed && !meta.dailyRewardsClaimed.includes(spec.dateKey)) {
    let streak = 1;
    if (meta.dailyLastCompletedDate === prevDateKey(spec.dateKey)) streak = meta.dailyStreak + 1;
    else if (meta.dailyLastCompletedDate === spec.dateKey) streak = Math.max(1, meta.dailyStreak);
    meta.dailyStreak = streak;
    meta.dailyLastCompletedDate = spec.dateKey;
    meta.dailyRewardsClaimed.push(spec.dateKey);
    rewardKarma = 25 + Math.min(7, streak) * 5;
  }
  return { score, isPB, completed, rewardKarma, streak: meta.dailyStreak };
}

function prevDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return dateKeyOf(dt);
}
