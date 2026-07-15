// 윤회겁(輪廻劫) — 악연(惡緣) 레지스트리. 첫 클리어 후 드래프트해 겁(劫)을 올린다.
// 겁 = 드래프트한 악연의 weight 합. cycleScale로 적·보스가 강해지고, 각 악연은 시작을 약화한다.

import type { RunLoadout } from "../core/types";

export interface CurseDef {
  id: string;
  name: string;
  nameHanja: string;
  desc: string;
  /** 이 악연이 더하는 겁(劫). 높을수록 위험·보상↑. */
  weight: number;
  /** 시작 로드아웃 페널티(없으면 순수 겁=적 스케일만). */
  apply?(lo: RunLoadout): void;
}

export const CURSES: CurseDef[] = [
  {
    id: "short_life",
    name: "단명",
    nameHanja: "短命",
    desc: "최대 혼백 −10",
    weight: 2,
    apply: (lo) => {
      lo.maxHp -= 10;
    },
  },
  {
    id: "dull_blade",
    name: "둔검",
    nameHanja: "鈍劍",
    desc: "공격력 −2",
    weight: 2,
    apply: (lo) => {
      lo.atk = Math.max(1, lo.atk - 2);
    },
  },
  {
    id: "poverty",
    name: "박복",
    nameHanja: "薄福",
    desc: "부적 슬롯 −1, 시작 부적 없음",
    weight: 2,
    apply: (lo) => {
      lo.inventorySize = Math.max(2, lo.inventorySize - 1);
      lo.startingTalismans = [];
      lo.randomTalismans = 0;
    },
  },
  {
    id: "bare_fist",
    name: "공수",
    nameHanja: "空手",
    desc: "무기 봉인 (염주 고정)",
    weight: 1,
    apply: (lo) => {
      lo.startWeapon = "yeomju";
      lo.weaponDrops = false;
    },
  },
  {
    id: "sealed",
    name: "봉인",
    nameHanja: "封印",
    desc: "명부의 가호(부활) 봉인",
    weight: 2,
    apply: (lo) => {
      lo.autoRevives = 0;
    },
  },
  {
    id: "punishment",
    name: "형벌",
    nameHanja: "刑罰",
    desc: "모든 피해 +2",
    weight: 3,
    apply: (lo) => {
      lo.damageReduction -= 2;
    },
  },
  {
    id: "blind",
    name: "맹목",
    nameHanja: "盲目",
    desc: "위험·적 위치 감지 봉인",
    weight: 1,
    apply: (lo) => {
      lo.revealHazards = false;
      lo.revealEnemies = false;
    },
  },
  {
    id: "heaven_wrath",
    name: "천벌",
    nameHanja: "天罰",
    desc: "적이 한층 더 강맹해진다 (순수 겁)",
    weight: 3,
  },
  {
    id: "asura",
    name: "아수라",
    nameHanja: "阿修羅",
    desc: "혼백 −6, 공격 −1, 적 격화",
    weight: 4,
    apply: (lo) => {
      lo.maxHp -= 6;
      lo.atk = Math.max(1, lo.atk - 1);
    },
  },
];

const MAP = new Map(CURSES.map((c) => [c.id, c]));
export function getCurse(id: string): CurseDef | undefined {
  return MAP.get(id);
}

/** 겁(劫) = 활성 악연 weight 합. */
export function cycleOf(activeCurses: string[]): number {
  return activeCurses.reduce((s, id) => s + (MAP.get(id)?.weight ?? 0), 0);
}

/** 겁에 따른 적·보스 스탯 추가 배율(stageScale에 곱). 완만한 무한 등반. */
export function cycleScale(cycle: number): number {
  return 1 + 0.035 * Math.max(0, cycle);
}

/** 진환생(眞還生) 엔딩 해금 겁. */
export const TRUE_END_CYCLE = 12;
