import type { EnemyDef } from "../../core/types";
import { dosanEnemies } from "./dosan";
import { hwatangEnemies } from "./hwatang";
import { hanbingEnemies } from "./hanbing";
import { doksaEnemies } from "./doksa";

const ALL: EnemyDef[] = [...dosanEnemies, ...hwatangEnemies, ...hanbingEnemies, ...doksaEnemies];
const MAP = new Map<string, EnemyDef>(ALL.map((e) => [e.id, e]));

export function getEnemy(id: string): EnemyDef {
  const e = MAP.get(id);
  if (!e) throw new Error(`unknown enemy: ${id}`);
  return e;
}

export function hasEnemy(id: string): boolean {
  return MAP.has(id);
}

export function allEnemyIds(): string[] {
  return [...MAP.keys()];
}
