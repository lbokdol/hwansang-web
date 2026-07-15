// 서원(誓願) — 런 시작에 스스로 거는 자기 제약. 위반 시 즉시 파계(破戒)되는 run-wide 계율이며,
// 지킨 채 런을 마치면 업(業) 배율 보너스를 준다. 벌은 없다(보상만 소멸). (Port of Godot Content/Vows.)

export interface VowDef {
  id: string;
  name: string;
  nameHanja: string;
  desc: string;
  /** 지킨 채 런을 마치면 업 배율에 더해지는 보너스(예: 0.3 = +30%). */
  karmaBonus: number;
}

export const VOWS: VowDef[] = [
  { id: "no_kill_helpless", name: "불살생", nameHanja: "不殺生", desc: "무력화(빙결·봉박·수면)된 적을 베지 않는다.", karmaBonus: 0.3 },
  { id: "no_altar", name: "무소유", nameHanja: "無所有", desc: "제단을 취하지 않는다.", karmaBonus: 0.4 },
  { id: "no_talisman", name: "묵언", nameHanja: "默言", desc: "부적을 쓰지 않는다.", karmaBonus: 0.5 },
  { id: "no_escape", name: "정도", nameHanja: "正道", desc: "순간이동·천리안(요행)에 기대지 않는다.", karmaBonus: 0.2 },
  { id: "no_heal", name: "고행", nameHanja: "苦行", desc: "회복 제단·회생부를 쓰지 않는다.", karmaBonus: 0.4 },
];

const MAP = new Map<string, VowDef>(VOWS.map((v) => [v.id, v]));

export function getVow(id: string): VowDef | undefined {
  return MAP.get(id);
}

/** 지킨 서원들의 업 배율 보너스 합(런 종료 정산에서 karmaMultiplier에 더함). */
export function vowsKarmaBonus(vowsKept: readonly string[]): number {
  return vowsKept.reduce((sum, id) => sum + (MAP.get(id)?.karmaBonus ?? 0), 0);
}
