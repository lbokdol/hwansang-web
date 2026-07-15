// 환생록 persistence. The meta state never resets on death (설계서 7.1) — it
// lives in localStorage and survives across runs and browser sessions.

import type { MetaState } from "../core/types";

const STORAGE_KEY = "hwansang.save.v1";
export const SAVE_VERSION = 1;

export function defaultMeta(): MetaState {
  return {
    version: SAVE_VERSION,
    karma: 0,
    totalKarma: 0,
    upgrades: {},
    bossesDefeated: [],
    selectedSoul: "wanderer",
    unlockedSouls: ["wanderer"],
    codex: { enemies: [], bosses: [], talismans: [], hells: [] },
    achievementsUnlocked: [],
    records: { deepestStage: 0, mostKills: 0, bestNoHitDepth: 0, fastestClearTurns: 0 },
    equippedTitle: null,
    bestGongdeok: 0,
    bestGongdeokBySoul: {},
    gongdeokTierClaimed: 0,
    activeCurses: [],
    maxCycleCleared: 0,
    deepestHell: 0,
    deepestFloor: 0,
    runs: 0,
    cleared: false,
  };
}

function migrate(raw: Partial<MetaState>): MetaState {
  const base = defaultMeta();
  return {
    ...base,
    ...raw,
    upgrades: { ...base.upgrades, ...(raw.upgrades ?? {}) },
    bossesDefeated: raw.bossesDefeated ?? base.bossesDefeated,
    unlockedSouls: raw.unlockedSouls ?? base.unlockedSouls,
    selectedSoul: raw.selectedSoul ?? base.selectedSoul,
    codex: { ...base.codex, ...(raw.codex ?? {}) },
    achievementsUnlocked: raw.achievementsUnlocked ?? base.achievementsUnlocked,
    records: { ...base.records, ...(raw.records ?? {}) },
    equippedTitle: raw.equippedTitle ?? base.equippedTitle,
    bestGongdeok: raw.bestGongdeok ?? base.bestGongdeok,
    bestGongdeokBySoul: { ...base.bestGongdeokBySoul, ...(raw.bestGongdeokBySoul ?? {}) },
    gongdeokTierClaimed: raw.gongdeokTierClaimed ?? base.gongdeokTierClaimed,
    activeCurses: raw.activeCurses ?? base.activeCurses,
    maxCycleCleared: raw.maxCycleCleared ?? base.maxCycleCleared,
    version: SAVE_VERSION,
  };
}

export function loadMeta(): MetaState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultMeta();
    const parsed = JSON.parse(raw) as Partial<MetaState>;
    return migrate(parsed);
  } catch {
    return defaultMeta();
  }
}

export function saveMeta(meta: MetaState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // Storage may be unavailable (private mode); fail silently — the run still works.
  }
}

export function resetMeta(): MetaState {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return defaultMeta();
}
