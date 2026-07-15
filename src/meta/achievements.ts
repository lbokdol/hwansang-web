// 공과록(功過格) — 업적 레지스트리. 런 종료 시 평가하고, 달성 시 업(業)을 보상한다.
// 데이터주도: UPGRADES/SOULS와 동형. 새 업적은 이 배열에 항목 추가로 확장.

import type { MetaState } from "../core/types";
import type { RunOutcome } from "./karma";
import { allEnemyIds } from "../content/enemies";
import { allTalismanIds } from "../content/talismans";
import { HELLS } from "../content/hells";

export interface AchievementContext {
  outcome: RunOutcome;
  meta: MetaState;
}

export interface AchievementDef {
  id: string;
  name: string;
  nameHanja: string;
  desc: string;
  /** 달성 시 지급되는 업(業). */
  karma: number;
  check(c: AchievementContext): boolean;
}

const BOSS_IDS = [
  "jingwang",
  "chogang",
  "songje",
  "ogwan",
  "yeomra",
  "byeonseong",
  "taesan",
  "pyeongdeung",
  "dosi",
  "jeonryun",
];

export const ACHIEVEMENTS: AchievementDef[] = [
  // --- 진행(進行) ---
  {
    id: "first_rebirth",
    name: "첫 환생",
    nameHanja: "初還生",
    desc: "모든 지옥을 넘어 윤회의 문을 연다.",
    karma: 50,
    check: (c) => c.outcome.cleared,
  },
  {
    id: "pilgrimage",
    name: "지옥 순례",
    nameHanja: "地獄巡禮",
    desc: "한 번의 환생에서 다섯 번째 지옥(깊은 옥)에 도달한다.",
    karma: 25,
    check: (c) => c.outcome.hellIndex >= 4,
  },
  {
    id: "ten_kings",
    name: "십대왕 알현",
    nameHanja: "十大王謁見",
    desc: "십대왕 열을 모두 격파한 기록을 남긴다.",
    karma: 60,
    check: (c) => BOSS_IDS.every((b) => c.meta.bossesDefeated.includes(b)),
  },
  {
    id: "abyss",
    name: "심연 답파",
    nameHanja: "深淵踏破",
    desc: "한 번의 환생에서 10층 이상 내려간다.",
    karma: 20,
    check: (c) => c.outcome.totalFloorsDescended >= 10,
  },
  // --- 숙련(熟練) ---
  {
    id: "never_retreat",
    name: "불퇴전",
    nameHanja: "不退轉",
    desc: "명부의 가호(부활) 없이 환생을 이룬다.",
    karma: 45,
    check: (c) => c.outcome.cleared && c.outcome.revivesUsed === 0,
  },
  {
    id: "bare_hands",
    name: "맨몸 처형",
    nameHanja: "無符處刑",
    desc: "부적을 한 번도 쓰지 않고 세 번째 지옥에 도달한다.",
    karma: 30,
    check: (c) => c.outcome.hellIndex >= 2 && c.outcome.talismansUsed === 0,
  },
  {
    id: "iron_wall",
    name: "철벽",
    nameHanja: "鐵壁",
    desc: "받은 피해 40 이하로 환생을 이룬다.",
    karma: 50,
    check: (c) => c.outcome.cleared && c.outcome.damageTaken <= 40,
  },
  {
    id: "slaughter",
    name: "백귀 도륙",
    nameHanja: "百鬼屠戮",
    desc: "한 번의 환생에서 적 40체 이상 처치한다.",
    karma: 25,
    check: (c) => c.outcome.enemiesKilled >= 40,
  },
  // --- 명부록(冥府錄) ---
  {
    id: "codex_yokai",
    name: "명부록·요괴편",
    nameHanja: "妖怪編",
    desc: "모든 잡귀·요괴를 명부록에 기록한다.",
    karma: 30,
    check: (c) => c.meta.codex.enemies.length >= allEnemyIds().length,
  },
  {
    id: "codex_kings",
    name: "명부록·십왕편",
    nameHanja: "十王編",
    desc: "십대왕 열을 모두 명부록에 기록한다.",
    karma: 20,
    check: (c) => c.meta.codex.bosses.length >= BOSS_IDS.length,
  },
  {
    id: "codex_talisman",
    name: "명부록·부적편",
    nameHanja: "符籍編",
    desc: "모든 부적을 명부록에 기록한다.",
    karma: 20,
    check: (c) => c.meta.codex.talismans.length >= allTalismanIds().length,
  },
  {
    id: "codex_complete",
    name: "명부록 완성",
    nameHanja: "冥府錄完成",
    desc: "적·왕·부적·지옥을 빠짐없이 기록한다.",
    karma: 60,
    check: (c) =>
      c.meta.codex.enemies.length >= allEnemyIds().length &&
      c.meta.codex.bosses.length >= BOSS_IDS.length &&
      c.meta.codex.talismans.length >= allTalismanIds().length &&
      c.meta.codex.hells.length >= HELLS.length,
  },
];

const MAP = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
export function getAchievement(id: string): AchievementDef | undefined {
  return MAP.get(id);
}

/**
 * Evaluate at run end: mark newly unlocked achievements on `meta` and return
 * them + the total bonus 업 to award (the caller awards it via awardKarma).
 */
export function evaluateAchievements(
  meta: MetaState,
  outcome: RunOutcome,
): { newly: AchievementDef[]; bonusKarma: number } {
  const c: AchievementContext = { outcome, meta };
  const newly: AchievementDef[] = [];
  let bonusKarma = 0;
  for (const a of ACHIEVEMENTS) {
    if (meta.achievementsUnlocked.includes(a.id)) continue;
    if (a.check(c)) {
      meta.achievementsUnlocked.push(a.id);
      bonusKarma += a.karma;
      newly.push(a);
    }
  }
  return { newly, bonusKarma };
}
