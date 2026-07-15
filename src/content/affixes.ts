// 흉물(凶物) 어픽스 — 정예로 승격한 적에 붙는 시그니처. 신규 메커니즘을 만들지 않고
// 십대왕(깊은 court) 해저드 관용구를 적 규모로 '재캐스팅'한다: 업경(거울반사)·균형(피해상한)은
// 보스가 쓰던 Enemy.state 필드를 그대로 seed해 dealDamage의 기존 훅을 재사용한다.
// Mark(한자)+Tint가 시각 표식(언어 무관). (Port of Godot Content/Affixes.)

import type { Enemy } from "../entities/enemy";

export interface AffixDef {
  id: string;
  /** 정예 표식으로 적 머리 위에 그릴 한자(언어 무관). */
  mark: string;
  /** 스프라이트 틴트 + 마크 색. */
  tint: string;
  weight: number;
  /** 승격 시 1회: 스탯 조정 / 보스 state 필드 seed. */
  onSpawn?(e: Enemy): void;
}

export const AFFIXES: AffixDef[] = [
  // 업경(鏡): 플레이어 직격 일부를 되비춘다 — 거울왕 state.mirror 재사용(dealDamage 반사 훅).
  {
    id: "mirror",
    mark: "경",
    tint: "#c4b9e0",
    weight: 2,
    onSpawn: (e) => {
      e.state.mirror = 9999;
      e.state.mirrorFrac = 350;
      e.state.mirrorCap = 6;
    },
  },
  // 균형(均): 한 방에 받는 피해를 상한(evenCap>0 = 항상 격파가능) — 평등대왕 均衡場 재사용.
  {
    id: "equalize",
    mark: "균",
    tint: "#c23a3a",
    weight: 2,
    onSpawn: (e) => {
      e.state.equalize = 9999;
      e.state.evenCap = Math.max(2, Math.floor(e.stats.maxHp / 6));
    },
  },
  // 질풍(風): 근접 피격 시 플레이어를 1칸 밀친다 — dealDamage에서 affix 검사(도시대왕 변위 관용구).
  { id: "gust", mark: "풍", tint: "#cbb98a", weight: 2 },
  // 흉포(凶暴): 기교 없는 완력 — 추가 HP·ATK(순수 스탯 정예).
  {
    id: "brutal",
    mark: "흉",
    tint: "#e0783c",
    weight: 2,
    onSpawn: (e) => {
      e.stats.maxHp += Math.max(6, Math.floor(e.stats.maxHp * 0.4));
      e.stats.hp = e.stats.maxHp;
      e.stats.atk += 3;
    },
  },
];

const MAP = new Map<string, AffixDef>(AFFIXES.map((a) => [a.id, a]));

export function getAffix(id: string): AffixDef | undefined {
  return MAP.get(id);
}

/** 승격 시그니처 추첨용 가중치 엔트리. */
export const AFFIX_ENTRIES: ReadonlyArray<{ value: string; weight: number }> = AFFIXES.map((a) => ({
  value: a.id,
  weight: a.weight,
}));
