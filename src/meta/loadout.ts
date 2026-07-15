import type { MetaState, RunLoadout } from "../core/types";
import { UPGRADES } from "./upgrades";
import { getSoul } from "../content/souls";
import { getTitle, titleRank } from "./titles";
import { getCurse } from "../content/curses";

/** Baseline run parameters before any 환생록 강화 is applied. */
export function baseLoadout(): RunLoadout {
  return {
    maxHp: 30, // 전투_상세 §3.2 시작값
    atk: 5,
    def: 1,
    damageReduction: 0,
    inventorySize: 4,
    startingTalismans: [],
    randomTalismans: 0,
    autoRevives: 0,
    reviveHpFraction: 0.5,
    reviveInvuln: 0,
    revealHazards: false,
    revealEnemies: false,
    healOnDescendFraction: 0,
    karmaMultiplier: 1,
    startInvulnTurns: 0,
    startEmpower: false,
    weaponDrops: false,
    startWeapon: "yeomju",
    bonusAttackChance: 0,
    unlockedTalismanPool: [],
  };
}

/** Build the loadout for a new run from owned upgrades + 화신 + 도장 보너스. */
export function buildLoadout(meta: MetaState): RunLoadout {
  const lo = baseLoadout();
  for (const node of UPGRADES) {
    const lvl = meta.upgrades[node.id] ?? 0;
    if (lvl > 0) node.apply(lvl, lo);
  }
  // 시작 화신.
  getSoul(meta.selectedSoul).apply(lo);
  // 도장 보너스: 격파한 왕마다 영구 최대 HP +3 (소소 보너스, 반복보상 §3.3).
  lo.maxHp += 3 * meta.bossesDefeated.length;
  // 업경대: 착용 칭호 1개의 미량 패시브 (랭크는 개인최고 기록의 함수).
  if (meta.equippedTitle) {
    const t = getTitle(meta.equippedTitle);
    if (t) {
      const rank = titleRank(t, meta.records);
      if (rank > 0) t.apply(rank, lo);
    }
  }
  // 윤회겁: 드래프트한 악연의 시작 페널티.
  for (const id of meta.activeCurses) {
    getCurse(id)?.apply?.(lo);
  }
  return lo;
}
