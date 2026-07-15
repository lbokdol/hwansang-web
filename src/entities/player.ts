import { Actor } from "./actor";
import { DIR_VECTORS, type Pos } from "../core/grid";
import type { RunLoadout, WeaponDef } from "../core/types";
import { getWeapon } from "../content/weapons";

/**
 * The player avatar. Turn execution is driven directly by the Run (engine
 * lock + keyboard input), so `act()` is intentionally inert here.
 */
export interface TalismanStack {
  id: string;
  count: number;
}

export const MAX_STACK = 9;

export class Player extends Actor {
  /** Inventory slots; same talisman stacks in one slot (부적_상세 §1). */
  inventory: TalismanStack[] = [];
  inventorySize: number; // max distinct slots
  facing: Pos = DIR_VECTORS.down;
  damageReduction: number;
  autoRevives: number;
  reviveHpFraction = 0.5;
  reviveInvuln = 0;
  invulnTurns: number;
  bonusAttackChance: number;
  /** 치명타 확률(통찰 삼매) — 평타가 2배로 들어간다. */
  critChance = 0;
  weapon: WeaponDef;
  killsThisRun = 0;

  // 정기(精氣) → 영급(level). Per-run, resets each run (전투_상세 §3).
  level = 1;
  jeonggi = 0;
  /** Cumulative 정기 needed to REACH each level (index = level-1). */
  static readonly THRESHOLDS = [0, 8, 20, 36, 56, 80, 108, 140];
  static readonly MAX_LEVEL = 8;

  constructor(at: Pos, loadout: RunLoadout) {
    super({
      name: "망자",
      glyph: "@",
      color: "#f4ead2",
      pos: at,
      faction: "player",
      stats: { hp: loadout.maxHp, maxHp: loadout.maxHp, atk: loadout.atk, def: loadout.def },
    });
    this.inventorySize = loadout.inventorySize;
    this.damageReduction = loadout.damageReduction;
    this.autoRevives = loadout.autoRevives;
    this.reviveHpFraction = loadout.reviveHpFraction;
    this.reviveInvuln = loadout.reviveInvuln;
    this.invulnTurns = loadout.startInvulnTurns;
    this.bonusAttackChance = loadout.bonusAttackChance;
    this.weapon = getWeapon(loadout.startWeapon);
  }

  get inventoryFull(): boolean {
    return this.inventory.length >= this.inventorySize;
  }

  /** Total talismans held (across stacks). */
  get talismanCount(): number {
    return this.inventory.reduce((n, s) => n + s.count, 0);
  }

  /** Add one talisman; stacks onto an existing slot, else takes a new slot. */
  addTalisman(id: string): boolean {
    const stack = this.inventory.find((s) => s.id === id);
    if (stack) {
      if (stack.count >= MAX_STACK) return false;
      stack.count++;
      return true;
    }
    if (this.inventory.length >= this.inventorySize) return false;
    this.inventory.push({ id, count: 1 });
    return true;
  }

  /** Consume one talisman from slot `index`; removes the slot when emptied. */
  consumeTalisman(index: number): void {
    const stack = this.inventory[index];
    if (!stack) return;
    stack.count--;
    if (stack.count <= 0) this.inventory.splice(index, 1);
  }

  /** Award 정기; returns the number of levels gained (영급 상승: maxHP+6, ATK+1, +6 회복). */
  gainJeonggi(amount: number): number {
    this.jeonggi += amount;
    let gained = 0;
    while (this.level < Player.MAX_LEVEL && this.jeonggi >= Player.THRESHOLDS[this.level]) {
      this.level++;
      this.stats.maxHp += 6;
      this.stats.atk += 1;
      this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + 6);
      gained++;
    }
    return gained;
  }

  /** Progress (0..1) toward the next 영급, for the HUD 정기 bar. */
  get jeonggiProgress(): number {
    if (this.level >= Player.MAX_LEVEL) return 1;
    const cur = Player.THRESHOLDS[this.level - 1];
    const next = Player.THRESHOLDS[this.level];
    return next > cur ? (this.jeonggi - cur) / (next - cur) : 1;
  }

  override act(): void {
    // No-op: Run.runPlayerTurn handles input + engine lock.
  }
}
