import type { TalismanDef } from "../../core/types";
import { baseTalismans, baseDropPool } from "./base";
import { advancedTalismans } from "./advanced";
import { extraTalismans } from "./extra";

const ALL: TalismanDef[] = [...baseTalismans, ...advancedTalismans, ...extraTalismans];
const MAP = new Map<string, TalismanDef>(ALL.map((t) => [t.id, t]));

export function getTalisman(id: string): TalismanDef {
  const t = MAP.get(id);
  if (!t) throw new Error(`unknown talisman: ${id}`);
  return t;
}

export function hasTalisman(id: string): boolean {
  return MAP.has(id);
}

export function allTalismanIds(): string[] {
  return [...MAP.keys()];
}

/** Weighted drop entries for a pool of ids (부적_상세 §2 가중치). */
export function dropEntries(ids: string[]): { value: string; weight: number }[] {
  return ids.filter(hasTalisman).map((id) => ({ value: id, weight: getTalisman(id).weight }));
}

export { baseDropPool };
