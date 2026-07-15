// Core combat math. 설계서 3.2: 데미지 = max(1, ATK - DEF), integer.

export function rollDamage(atk: number, def: number): number {
  return Math.max(1, Math.round(atk) - Math.round(def));
}
