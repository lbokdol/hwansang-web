// ============================================================================
// 환생록 — shared type contract.
//
// Every content module (enemies / talismans / hells / 환생록 upgrades) is
// written against the interfaces here and the `GameContext` facade. Keeping the
// contract in one place is what lets later content be authored independently.
// ============================================================================

import type { Pos } from "./grid";
import type { Rng } from "./rng";
import type { Actor } from "../entities/actor";
import type { Enemy } from "../entities/enemy";
import type { Player } from "../entities/player";
import type { Level } from "../map/level";
import type { FxSystem } from "../render/fx";

// ---- stats & combat -------------------------------------------------------

export interface Stats {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
}

export type DamageKind =
  | "physical"
  | "fire"
  | "ice"
  | "lightning"
  | "holy"
  | "poison"
  | "terrain"
  | "pure";

export interface DamageOptions {
  source?: Actor;
  kind?: DamageKind;
  /** Bypass DEF (used by 중독/terrain/pure damage). */
  ignoreDef?: boolean;
  /** Suppress hit flash / floating number (for swarming DoT ticks). */
  noFx?: boolean;
}

// ---- status effects -------------------------------------------------------
// Unified system covering both debuffs (화상/빙결/중독/봉박/수면) and buffs
// (보호막/공방 상승/재생) so talismans and hazards share one pipeline.

export type StatusKind =
  | "burn" // 화상: fixed DoT, decays
  | "freeze" // 빙결: skip turns
  | "poison" // 중독: DoT, ignores DEF
  | "bleed" // 출혈: damage on move (확장)
  | "slow" // 둔화: speed halved
  | "shield" // 결계부: absorbs a pool of damage
  | "empower" // 호신부: ATK (power) + DEF (aux) up
  | "bound" // 봉박부: target cannot act
  | "sleep" // 진혼부: skip until damaged
  | "regen"; // 위령/회생 over-time heal

export interface StatusInstance {
  kind: StatusKind;
  /** Remaining turns. */
  turns: number;
  /** Magnitude: DoT amount, shield damage-pool, ATK delta, etc. */
  power: number;
  /** Secondary magnitude (e.g. empower's DEF delta). */
  aux?: number;
  /** Optional source for attribution. */
  source?: Actor;
}

export type Faction = "player" | "enemy";

// ---- tiles ----------------------------------------------------------------

export type TileId = string;

export interface TileHazard {
  /** Flat damage dealt when the trigger fires. */
  damage?: number;
  damageKind?: DamageKind;
  /** Status applied when the trigger fires. */
  status?: { kind: StatusKind; turns: number; power: number };
  /** `enter`: once on stepping in. `stand`: every turn the actor sits on it. */
  trigger: "enter" | "stand";
}

export interface TileDef {
  id: TileId;
  name: string;
  /** Display char drawn on the canvas tile (swappable for a sprite later). */
  glyph: string;
  fg: string;
  bg: string;
  walkable: boolean;
  /** Blocks line of sight (FOV). */
  opaque: boolean;
  /** 한빙 얼음: stepping causes a slide until a wall/obstacle. */
  slippery?: boolean;
  hazard?: TileHazard;
}

// ---- AI / enemies ---------------------------------------------------------

export interface EnemyDef {
  id: string;
  name: string;
  glyph: string;
  color: string;
  hp: number;
  atk: number;
  def: number;
  /** 정기(精氣) granted on kill (in-run XP). 업 is a flat per-kill count. */
  jeonggi: number;
  /** Action speed: 100 normal, 200 fast (2 actions/turn), 50 slow (1/2 turns). */
  speed?: number;
  /** Role label for 도감 / encounter design. */
  role?: string;
  /** Native hell (for flavor / fallback table membership). */
  hell?: string;
  /** Brain: called on the enemy's turn. Compose helpers from entities/ai.ts. */
  act(self: Enemy, ctx: GameContext): void;
  /** Optional on-death hook (explode, split, drop hazard). */
  onDeath?(self: Enemy, ctx: GameContext): void;
}

// ---- bosses ---------------------------------------------------------------

export interface BossDef {
  id: string;
  name: string;
  nameHanja: string;
  glyph: string;
  color: string;
  hp: number;
  atk: number;
  def: number;
  /** 정기 granted on kill (in-run XP). 업 is a flat +30 per king. */
  jeonggi: number;
  /** HP fraction (0..1) at which phase 2 begins (설계서 4.3). */
  phase2At: number;
  /** Brain. Should manage telegraphs via self.telegraph and self.state. */
  act(self: Enemy, ctx: GameContext): void;
  onPhaseChange?(self: Enemy, ctx: GameContext): void;
  onDeath?(self: Enemy, ctx: GameContext): void;
}

/** A telegraphed attack: cells that will be struck after `turnsUntil` turns. */
export interface TelegraphMark {
  cells: Pos[];
  turnsUntil: number;
  color: string;
}

// ---- weapons (무기) -------------------------------------------------------
// 게임설계서 §6 + 전투_상세 §5. Modifies the bump attack.

export interface WeaponDef {
  id: string;
  name: string;
  nameHanja: string;
  glyph: string;
  color: string;
  desc: string;
  /** Flat ATK added to bump attacks. */
  atkBonus: number;
  /** 1 = adjacent only; 2 = also strikes the cell beyond in the facing dir. */
  reach: number;
  /** Tiles to knock the struck enemy back (into walls/hazards for bonus). */
  knockback: number;
  /** Chance a bump attack does NOT consume the turn (extra action). */
  extraActionChance: number;
}

// ---- talismans (부적) -----------------------------------------------------

export type TargetingMode =
  | "none" // fires immediately
  | "self" // affects the player
  | "direction" // pick one of 4 directions
  | "tile" // pick a visible empty tile (축지부)
  | "enemy"; // pick a visible enemy (봉박부)

export interface TargetInfo {
  dir?: Pos;
  tile?: Pos;
  enemy?: Enemy;
}

export interface UseResult {
  /** If false, the talisman is NOT consumed (e.g., invalid target). */
  consumed: boolean;
  message?: string;
}

export interface TalismanDef {
  id: string;
  name: string;
  nameHanja: string;
  glyph: string;
  color: string;
  desc: string;
  targeting: TargetingMode;
  /** Max range for direction/tile/enemy targeting. */
  range?: number;
  /** Relative drop frequency in the drop pool (부적_상세 §2). */
  weight: number;
  use(ctx: GameContext, target: TargetInfo): UseResult;
}

// ---- hells (지옥) ----------------------------------------------------------

export interface HellPalette {
  wallFg: string;
  wallBg: string;
  floorFg: string;
  floorBg: string;
  /** Page/background tint behind the grid. */
  ambient: string;
  accent: string;
}

export interface HellDef {
  id: string;
  name: string;
  nameHanja: string;
  order: number; // 1-based
  floors: number; // 설계서: 3
  palette: HellPalette;
  /** Extra hazard tiles this hell registers (도산 칼날 / 화탕 불바다 / 한빙 얼음). */
  tiles: TileDef[];
  /** Weighted enemy id table for procedural spawns. */
  monsterTable: ReadonlyArray<{ value: string; weight: number }>;
  bossId: string;
  intro: string;
  /** Paint hazard tiles onto a freshly generated floor. */
  paintHazards(level: Level, ctx: HellPaintContext): void;
  /** Optional per-turn environmental dynamics (e.g., 번지는 불바다). */
  onFloorTick?(ctx: GameContext): void;
}

export interface HellPaintContext {
  level: Level;
  rng: Rng;
  depth: number; // floor index within the hell (0..floors-1)
}

// ---- 환생록 meta progression ----------------------------------------------

/** Starting parameters a run is built from. Upgrades mutate this. */
export interface RunLoadout {
  maxHp: number;
  atk: number;
  def: number;
  /** Flat damage reduction (kept for tuning; 단단한 업장 now grants DEF). */
  damageReduction: number;
  inventorySize: number;
  /** Talisman ids granted at run start (부적 숙련 / 화신 / 윤회의 결의 등). */
  startingTalismans: string[];
  /** Extra random talismans rolled at start (부적 숙련). */
  randomTalismans: number;
  /** 명부의 가호: auto-revives per run. */
  autoRevives: number;
  /** 명부의 가호: HP fraction restored on auto-revive (R1 0.5 / R2 0.75). */
  reviveHpFraction: number;
  /** 명부의 가호 R2: invuln turns granted on auto-revive. */
  reviveInvuln: number;
  /** 망자의 직감 R1: reveal hazard tiles each floor. */
  revealHazards: boolean;
  /** 망자의 직감 R2: reveal enemy positions at floor start. */
  revealEnemies: boolean;
  /** 위령: fraction of max HP healed on descending. */
  healOnDescendFraction: number;
  /** 업의 이자: karma gain multiplier. */
  karmaMultiplier: number;
  /** 윤회의 결의 R1: invulnerable turns at run start. */
  startInvulnTurns: number;
  /** 윤회의 결의 R2: start with 호신 (empower) effect. */
  startEmpower: boolean;
  /** 무기 전수: weapon drops enabled on floors. */
  weaponDrops: boolean;
  /** Starting weapon id (default 염주; some 화신 start with another). */
  startWeapon: string;
  /** 무사혼 passive: chance for a bump attack to strike twice. */
  bonusAttackChance: number;
  /** Talisman ids unlocked into the drop pool by 새로운 인연 (tiered). */
  unlockedTalismanPool: string[];
  /** 서원(誓願): 이번 런에 스스로 건 계율 ids (지킨 채 마치면 업 보너스). */
  activeVows: string[];
}

export interface UpgradeNode {
  id: string;
  name: string;
  desc: string;
  maxLevel: number;
  /** Karma cost to buy the NEXT level (0-based current level passed in). */
  cost(currentLevel: number): number;
  /** Fold this node's effect (at the owned level) into a fresh loadout. */
  apply(level: number, loadout: RunLoadout): void;
}

export interface Codex {
  enemies: string[];
  bosses: string[];
  talismans: string[];
  hells: string[];
}

/** 영구 개인최고 기록(업경대). 단조 갱신(높을수록/빠를수록 좋음). */
export interface RunRecords {
  deepestStage: number; // 최고 강하 단계(총 내려간 층)
  mostKills: number; // 한 런 최다 처치
  bestNoHitDepth: number; // 무피격 상태로 도달한 최고 단계
  fastestClearTurns: number; // 최단 클리어 턴(0 = 미클리어)
}

export interface MetaState {
  version: number;
  /** Spendable 업. */
  karma: number;
  /** Lifetime 업 earned (for stats / flavor). */
  totalKarma: number;
  /** nodeId -> owned level. */
  upgrades: Record<string, number>;
  /** Boss ids ever defeated = 도장 (permanent record + small bonus). */
  bossesDefeated: string[];
  /** 시작 화신: currently selected + unlocked soul ids. */
  selectedSoul: string;
  unlockedSouls: string[];
  /** 도감(명부록): first-encounter tracking. */
  codex: Codex;
  /** 요괴 도감 숙련(熟練): enemy id -> lifetime kill count (별 등급 + 정기 보너스). */
  enemyKills: Record<string, number>;
  /** 화신 숙련(化身 熟練): soul id -> lifetime XP (영구 화신 강화). */
  soulXp: Record<string, number>;
  /** 공과록(功過格): unlocked achievement ids. */
  achievementsUnlocked: string[];
  /** 업경대(業鏡臺): 영구 개인최고 기록(PB) — 칭호 랭크의 단일 소스. */
  records: RunRecords;
  /** 착용 중인 칭호(稱號) id. */
  equippedTitle: string | null;
  /** 공덕록(功德錄): karma와 직교하는 실력 점수의 개인최고. */
  bestGongdeok: number;
  bestGongdeokBySoul: Record<string, number>;
  /** 수령한 공덕 천장 티어 수. */
  gongdeokTierClaimed: number;
  /** 윤회겁(輪廻劫): 다음 런에 적용할 악연 id들(드래프트). */
  activeCurses: string[];
  /** 윤회겁: 지금까지 클리어한 최고 겁(劫). 영구 등반 기록. */
  maxCycleCleared: number;
  deepestHell: number;
  deepestFloor: number;
  runs: number;
  cleared: boolean;
}

/** 시작 화신(영혼) — changes the starting playstyle (반복보상 §3.2). */
export interface SoulDef {
  id: string;
  name: string;
  nameHanja: string;
  desc: string;
  unlockHint: string;
  /** Whether this soul is available given current meta progress. */
  isUnlocked(meta: MetaState): boolean;
  /** Fold the soul's starting modifiers into a fresh loadout. */
  apply(loadout: RunLoadout): void;
}

// ---- the context facade passed to all content -----------------------------

export interface GameContext {
  readonly level: Level;
  readonly player: Player;
  readonly rng: Rng;
  readonly fx: FxSystem;
  readonly hellIndex: number;
  readonly floorIndex: number;
  readonly turn: number;
  /** 윤회겁(輪廻劫) 단계 — 보스 패턴 등 콘텐츠가 난도 분기에 쓴다. */
  readonly cycle: number;

  log(msg: string, color?: string): void;

  // combat / status
  dealDamage(target: Actor, amount: number, opts?: DamageOptions): number;
  applyStatus(target: Actor, kind: StatusKind, turns: number, power?: number, source?: Actor, aux?: number): void;
  heal(target: Actor, amount: number): void;
  /** Player's current effective ATK (for ATK-scaling attack talismans). */
  playerAtk(): number;

  // queries
  actorAt(p: Pos): Actor | undefined;
  enemyAt(p: Pos): Enemy | undefined;
  isWall(p: Pos): boolean;
  /** Wall or occupied by a living actor. */
  isBlocked(p: Pos): boolean;
  enemiesInRadius(center: Pos, r: number): Enemy[];
  allEnemies(): Enemy[];
  /** Tiles along a direction from origin (exclusive of origin), up to len. */
  raycastTiles(origin: Pos, dir: Pos, len: number, opts?: { stopAtWall?: boolean }): Pos[];
  /** Visible, walkable, unoccupied tiles (for 축지부 teleport targets). */
  emptyTilesInSight(): Pos[];

  // mutation / flow
  moveActor(actor: Actor, to: Pos): boolean;
  spawnEnemy(defId: string, p: Pos): Enemy | null;
  killActor(actor: Actor): void;
  descend(): void;
  onBossDefeated(bossId: string): void;
}
