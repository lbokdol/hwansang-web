import { Map as RotMap } from "rot-js";
import { Level, type AltarKind } from "./level";
import { T_FLOOR, T_STAIRS, T_WALL } from "./tiles";
import { manhattan, type Pos } from "../core/grid";
import { pathDistance } from "./path";
import type { Rng } from "../core/rng";
import type { HellDef } from "../core/types";
import { Enemy } from "../entities/enemy";
import { getEnemy } from "../content/enemies";
import { getBoss } from "../content/bosses";
import { AFFIX_ENTRIES, getAffix } from "../content/affixes";
import { dropEntries } from "../content/talismans";
import { weaponDropPool } from "../content/weapons";

export interface GenerateParams {
  hell: HellDef;
  depth: number;
  /** 절대 강하 단계(0..29) — 랜덤 지옥 순서 대응: 난이도는 지옥이 아니라 깊이로 결정. */
  stage: number;
  rng: Rng;
  /** Talisman ids eligible to drop on the floor. */
  dropPool: string[];
  /** 무기 전수 해금 시 무기 드롭 활성. */
  weaponDrops?: boolean;
  /** 윤회겁 배율 — 적·보스 스탯에 stageScale과 함께 곱(기본 1). */
  cycleMul?: number;
  /** 六道 지옥도(嗔) 표식 = 해저드 밀도 배수(기본 1). */
  markDensityMul?: number;
}

export interface GeneratedFloor {
  level: Level;
  start: Pos;
}

// Map size / enemy count, indexed by absolute descent stage 0..29 (10 hells × 3).
// 단계별 난이도: bigger maps + more enemies the deeper you go, regardless of hell.
// prettier-ignore
const MAP_W = [36, 38, 38, 40, 40, 42, 42, 44, 44, 46, 46, 48, 48, 49, 49, 50, 50, 51, 51, 52, 52, 53, 53, 54, 54, 55, 55, 56, 56, 56];
// prettier-ignore
const MAP_H = [28, 30, 30, 32, 32, 34, 34, 36, 36, 38, 38, 40, 40, 41, 41, 42, 42, 43, 43, 44, 44, 45, 45, 46, 46, 47, 47, 48, 48, 48];
// prettier-ignore
const ENEMY_COUNT = [5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 12, 13, 13, 13, 14, 14, 14, 14, 14];

function clampStage(stage: number): number {
  return Math.max(0, Math.min(stage, MAP_W.length - 1));
}

/**
 * 단계별 적·보스 스탯 배율 — 깊이로 난이도가 오른다 (지옥 종류 무관).
 * 얕은 옥(0..11): 0.9→1.56. 깊은 옥(12..29)은 완만히 이어져 ~2.01까지.
 */
export function stageScale(stage: number): number {
  const s = clampStage(stage);
  return s <= 11 ? 0.9 + 0.06 * s : 1.56 + 0.025 * (s - 11);
}

export function generateFloor(p: GenerateParams): GeneratedFloor {
  const af = clampStage(p.stage);
  const width = MAP_W[af];
  const height = MAP_H[af];

  // Validate-or-regenerate: ensure the stairs/boss are reachable (no softlock).
  let best: { level: Level; start: Pos } | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = carve(p, width, height);
    const target = candidate.level.stairs ?? candidate.bossPos;
    if (target && Number.isFinite(pathDistance(candidate.start, target, candidate.level))) {
      best = { level: candidate.level, start: candidate.start };
      break;
    }
    best = { level: candidate.level, start: candidate.start }; // keep last as fallback
  }
  const { level, start } = best!;

  spawnMonsters(level, start, p, af);
  placeDrops(level, start, p);
  placeWeapon(level, start, p);
  placeAltars(level, start, p, af);
  return { level, start };
}

interface Carved {
  level: Level;
  start: Pos;
  bossPos: Pos | null;
}

function carve(p: GenerateParams, width: number, height: number): Carved {
  const level = new Level(width, height, p.hell, p.depth);
  const digger = new RotMap.Digger(width, height, {
    roomWidth: [4, 8],
    roomHeight: [3, 6],
    dugPercentage: 0.28,
  });
  digger.create((x, y, value) => {
    level.setTile({ x, y }, value === 1 ? T_WALL : T_FLOOR);
  });

  const rooms = digger.getRooms();
  if (rooms.length === 0) {
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) level.setTile({ x, y }, T_FLOOR);
  }
  const centers: Pos[] = rooms.map((r) => {
    const c = r.getCenter();
    return { x: c[0], y: c[1] };
  });
  const start: Pos = centers[0] ?? firstFloor(level);
  const farRoom: Pos = centers.length > 1 ? centers[centers.length - 1] : pickFar(level, start, p.rng);

  // 루프 추가: a few extra connections so the map has cycles (kiting routes).
  addLoops(level, p.rng, 3 + Math.floor(width / 16));

  // Hell hazards, then keep the spawn safe.
  p.hell.paintHazards(level, { level, rng: p.rng, depth: p.depth });
  // 六道 지옥도(嗔) 표식: 그 지옥의 주 해저드를 추가 산포해 더 짙게 만든다.
  const mul = p.markDensityMul ?? 1;
  if (mul > 1 && p.hell.tiles.length > 0) {
    const hz = p.hell.tiles[0].id;
    const extra = [...level.floorCells()];
    p.rng.shuffle(extra);
    const n = Math.floor(extra.length * 0.04 * (mul - 1));
    for (let i = 0; i < n; i++) level.setTile(extra[i], hz);
  }
  level.setTile(start, T_FLOOR);

  let bossPos: Pos | null = null;
  if (level.isBossFloor) {
    level.setTile(farRoom, T_FLOOR);
    const boss = Enemy.fromBoss(getBoss(p.hell.bossId), { ...farRoom }, stageScale(p.stage) * (p.cycleMul ?? 1));
    level.actors.push(boss);
    level.bossSpawned = true;
    level.stairs = null;
    bossPos = { ...farRoom };
  } else {
    level.setTile(farRoom, T_STAIRS);
    level.stairs = { ...farRoom };
  }
  return { level, start, bossPos };
}

/** Carve a few 1-thick walls that separate two floors, creating loops. */
function addLoops(level: Level, rng: Rng, count: number): void {
  const candidates: Pos[] = [];
  for (let y = 1; y < level.height - 1; y++) {
    for (let x = 1; x < level.width - 1; x++) {
      if (level.tileIdAt({ x, y }) !== T_WALL) continue;
      const horiz = level.tileIdAt({ x: x - 1, y }) === T_FLOOR && level.tileIdAt({ x: x + 1, y }) === T_FLOOR;
      const vert = level.tileIdAt({ x, y: y - 1 }) === T_FLOOR && level.tileIdAt({ x, y: y + 1 }) === T_FLOOR;
      if (horiz || vert) candidates.push({ x, y });
    }
  }
  rng.shuffle(candidates);
  for (let i = 0; i < count && i < candidates.length; i++) level.setTile(candidates[i], T_FLOOR);
}

function spawnMonsters(level: Level, start: Pos, p: GenerateParams, af: number): void {
  // 보스 아레나: the boss faces the player alone (+ its own telegraphed summons).
  if (level.isBossFloor) return;
  if (p.hell.monsterTable.length === 0) return;
  const count = ENEMY_COUNT[af];

  const cells = plainFloorCells(level).filter(
    (c) => manhattan(c, start) >= 6 && !occupied(level, c) && !isStairs(level, c),
  );
  p.rng.shuffle(cells);
  const scale = stageScale(af) * (p.cycleMul ?? 1);
  for (let i = 0; i < count && cells.length > 0; i++) {
    const cell = cells.pop()!;
    const id = p.rng.weighted(p.hell.monsterTable as { value: string; weight: number }[]);
    if (!id) break;
    const e = Enemy.fromDef(getEnemy(id), { ...cell }, scale);
    maybePromote(e, af, p.cycleMul ?? 1, p.rng);
    level.actors.push(e);
  }
}

/**
 * 흉물(凶物) 승격: 얕은 1~2지옥(stage<6)은 제외, 이후 깊이·겁(劫)에 비례해 확률↑.
 * 승격 시 정예 스탯 버프 + 시그니처 어픽스 1개 + 정기(보상) 증가. (Port of MapGen.MaybePromote.)
 */
function maybePromote(e: Enemy, stage: number, cycleMul: number, rng: Rng): void {
  if (stage < 6) return; // 온보딩 보호: 얕은 1~2지옥엔 정예 없음
  const chance = Math.min(0.45, 0.05 + 0.012 * (stage - 6) + 0.5 * (cycleMul - 1));
  if (!rng.chance(chance)) return;
  // 정예 기본 버프(눈에 띄게 위협적) + 정기(업·공덕 보상) 상향.
  e.stats.maxHp = Math.max(1, Math.round(e.stats.maxHp * 1.6));
  e.stats.hp = e.stats.maxHp;
  e.stats.atk += 2;
  e.jeonggi *= 3;
  // 시그니처 어픽스 1개(가중 추첨) — evenCap 등이 버프된 MaxHp 기준으로 seed되도록 이 뒤에.
  const affixId = rng.weighted(AFFIX_ENTRIES as { value: string; weight: number }[]);
  const affix = affixId ? getAffix(affixId) : undefined;
  if (affix) {
    e.affixes.push(affix.id);
    affix.onSpawn?.(e);
  }
}

function placeDrops(level: Level, start: Pos, p: GenerateParams): void {
  if (p.dropPool.length === 0) return;
  const entries = dropEntries(p.dropPool); // weighted by 부적 가중치
  if (entries.length === 0) return;
  // 보물방 보장: 층당 부적 ≥1 (레벨디자인 §5).
  const dropCount = p.rng.int(1, 2);
  const cells = plainFloorCells(level).filter(
    (c) => manhattan(c, start) >= 3 && !occupied(level, c) && !isStairs(level, c) && !level.dropAt(c),
  );
  p.rng.shuffle(cells);
  for (let i = 0; i < dropCount && cells.length > 0; i++) {
    const cell = cells.pop()!;
    const id = p.rng.weighted(entries) ?? entries[0].value;
    level.drops.push({ pos: { ...cell }, talismanId: id });
  }
}

/** 무기 드롭(무기 전수 해금 시) — 가끔 한 자루. */
function placeWeapon(level: Level, start: Pos, p: GenerateParams): void {
  if (!p.weaponDrops || level.isBossFloor || weaponDropPool.length === 0) return;
  if (!p.rng.chance(0.4)) return;
  const cells = plainFloorCells(level).filter(
    (c) => manhattan(c, start) >= 5 && !occupied(level, c) && !isStairs(level, c) && !level.dropAt(c),
  );
  if (cells.length === 0) return;
  p.rng.shuffle(cells);
  level.weaponDrops.push({ pos: { ...cells[0] }, weaponId: p.rng.pick(weaponDropPool) });
}

/** 제단방: heal / HP / ATK altars — the sustain backbone (레벨디자인 §3, §5). */
function placeAltars(level: Level, start: Pos, p: GenerateParams, af: number): void {
  const cells = plainFloorCells(level).filter(
    (c) =>
      manhattan(c, start) >= 4 &&
      !occupied(level, c) &&
      !isStairs(level, c) &&
      !level.dropAt(c) &&
      !level.weaponDropAt(c),
  );
  p.rng.shuffle(cells);

  // Boss floor: guaranteed heal altar near start (준비방 제단).
  if (level.isBossFloor) {
    const near = plainFloorCells(level)
      .filter(
        (c) => manhattan(c, start) >= 2 && manhattan(c, start) <= 5 && !occupied(level, c) && !level.weaponDropAt(c),
      )
      .sort((a, b) => manhattan(a, start) - manhattan(b, start));
    if (near.length) level.altars.push({ pos: { ...near[0] }, kind: "heal" });
    return;
  }

  // ~1 altar per 1–2 floors.
  if (cells.length === 0 || !p.rng.chance(0.6)) return;
  const kind = p.rng.weighted([
    { value: "heal", weight: 3 },
    { value: "hp", weight: 1 },
    { value: "atk", weight: 1 },
  ]) as AltarKind | null;
  level.altars.push({ pos: { ...cells.pop()! }, kind: kind ?? "heal" });
  void af;
}

// --- helpers ---------------------------------------------------------------

function plainFloorCells(level: Level): Pos[] {
  const out: Pos[] = [];
  for (const c of level.floorCells()) out.push(c);
  return out;
}

function occupied(level: Level, c: Pos): boolean {
  return level.actors.some((a) => a.pos.x === c.x && a.pos.y === c.y);
}

function isStairs(level: Level, c: Pos): boolean {
  return level.tileIdAt(c) === T_STAIRS;
}

function firstFloor(level: Level): Pos {
  for (const c of level.floorCells()) return c;
  return { x: 1, y: 1 };
}

function pickFar(level: Level, from: Pos, _rng: Rng): Pos {
  const cells = plainFloorCells(level);
  let best = from;
  let bestD = -1;
  for (const c of cells) {
    const d = manhattan(c, from);
    if (d > bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
