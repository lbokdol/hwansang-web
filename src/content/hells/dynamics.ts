// 심층 지옥 동적 해저드(onFloorTick). 정적 산포 위에 매 턴 살아 움직이는 위험을 얹는다.
// 상태는 Level별 WeakMap에 둔다 — Level은 층마다 새로 생성되므로 자동 리셋. (Port of Godot 틱들.)

import { DIRS4, type Pos } from "../../core/grid";
import { T_FLOOR } from "../../map/tiles";
import type { GameContext } from "../../core/types";
import type { Level } from "../../map/level";

const key = (p: Pos): string => `${p.x},${p.y}`;

function lineCells(lvl: Level, horizontal: boolean, idx: number): Pos[] {
  const out: Pos[] = [];
  if (horizontal) {
    for (let x = 0; x < lvl.width; x++) {
      const p = { x, y: idx };
      if (!lvl.isWall(p)) out.push(p);
    }
  } else {
    for (let y = 0; y < lvl.height; y++) {
      const p = { x: idx, y };
      if (!lvl.isWall(p)) out.push(p);
    }
  }
  return out;
}

// ── 발설지옥 되울림: 지나온 자취가 잠시 뒤 가시밭으로 솟았다 사라진다("퇴로가 너를 문다"). ──
interface EchoState {
  last: Pos | null;
  pending: Map<string, { cell: Pos; t: number }>;
  active: Map<string, { cell: Pos; t: number }>;
}
const echoTable = new WeakMap<Level, EchoState>();
const ECHO_DELAY = 3;
const ECHO_FADE = 4;

export function echoTick(ctx: GameContext): void {
  if (ctx.level.isBossFloor) return;
  let st = echoTable.get(ctx.level);
  if (!st) {
    st = { last: null, pending: new Map(), active: new Map() };
    echoTable.set(ctx.level, st);
  }
  const pp = ctx.player.pos;
  for (const [k, e] of [...st.pending]) {
    e.t--;
    if (e.t === 1) ctx.fx.flashCells([e.cell], "#d98aa0"); // 1턴 예고
    else if (e.t <= 0) {
      st.pending.delete(k);
      if (ctx.level.tileIdAt(e.cell) === T_FLOOR) {
        ctx.level.setTile(e.cell, "balseol_echo");
        st.active.set(k, { cell: e.cell, t: ECHO_FADE });
      }
    }
  }
  for (const [k, e] of [...st.active]) {
    e.t--;
    if (e.t <= 0) {
      st.active.delete(k);
      if (ctx.level.tileIdAt(e.cell) === "balseol_echo") ctx.level.setTile(e.cell, T_FLOOR);
    }
  }
  const last = st.last;
  if (
    last &&
    (last.x !== pp.x || last.y !== pp.y) &&
    ctx.level.tileIdAt(last) === T_FLOOR &&
    !st.pending.has(key(last)) &&
    !st.active.has(key(last))
  ) {
    st.pending.set(key(last), { cell: { ...last }, t: ECHO_DELAY });
  }
  st.last = { ...pp };
}

// ── 쓸어가는 선(거해 톱날 / 흑승 먹줄): 한 행/열이 방을 가로지르며 반사해 오간다. ──
interface SweepState {
  horizontal: boolean;
  idx: number;
  dir: number;
  prev: Pos[];
  phase: number;
}
function makeSweep(tiles: string[], damage: number, color: string): (ctx: GameContext) => void {
  const table = new WeakMap<Level, SweepState>();
  return (ctx: GameContext): void => {
    if (ctx.level.isBossFloor) return;
    let st = table.get(ctx.level);
    if (!st) {
      const horizontal = ctx.rng.chance(0.5);
      const span = horizontal ? ctx.level.height : ctx.level.width;
      const idx = ctx.rng.chance(0.5) ? 1 : span - 2;
      st = { horizontal, idx, dir: idx === 1 ? 1 : -1, prev: [], phase: 0 };
      table.set(ctx.level, st);
    }
    // 1) 이전 선 복원.
    for (const c of st.prev) if (ctx.level.tileIdAt(c) === tiles[st.phase % tiles.length]) ctx.level.setTile(c, T_FLOOR);
    st.prev = [];
    // 2) 인덱스 전진 + 경계 반사(궤도 순환이면 tile도 회전).
    const span = st.horizontal ? ctx.level.height : ctx.level.width;
    let ni = st.idx + st.dir;
    if (ni < 1 || ni >= span - 1) {
      st.dir = -st.dir;
      st.phase++;
      ni = st.idx + st.dir;
    }
    st.idx = Math.max(1, Math.min(span - 2, ni));
    const tileId = tiles[st.phase % tiles.length];
    // 3) 선 위험화 + 정지 액터 쓸림 피해.
    const cells = lineCells(ctx.level, st.horizontal, st.idx);
    const hit = new Set<number>();
    for (const c of cells) {
      if (ctx.level.tileIdAt(c) === T_FLOOR) {
        ctx.level.setTile(c, tileId);
        st.prev.push(c);
      }
    }
    for (const c of cells) {
      const a = ctx.actorAt(c);
      if (a && !hit.has(a.id)) {
        hit.add(a.id);
        ctx.dealDamage(a, damage, { kind: "terrain" });
      }
    }
    if (cells.length > 0) ctx.fx.flashCells(cells, color);
  };
}

export const sawTick = makeSweep(["geohae_saw"], 4, "#d65a5a");
export const ropeTick = makeSweep(["heukseung_ink"], 5, "#c23a3a");
// 육도 회전: 역대 5해저드를 한 번에 하나씩 순환하며 쓸어감.
export const rotorTick = makeSweep(
  ["balseol_echo", "yangdong_molten", "geohae_saw", "heukseung_ink", "pungdo_squall"],
  4,
  "#e8c15a",
);

// ── 풍도 바람: 주기적으로 방위가 회전하는 돌풍이 플레이어를 1칸 떠민다. ──
interface WindState {
  tick: number;
  dir: number;
}
const windTable = new WeakMap<Level, WindState>();
const WIND_PERIOD = 3;

export function windTick(ctx: GameContext): void {
  if (ctx.level.isBossFloor) return;
  let st = windTable.get(ctx.level);
  if (!st) {
    st = { tick: 0, dir: 0 };
    windTable.set(ctx.level, st);
  }
  st.tick++;
  if (st.tick % WIND_PERIOD !== 0) return;
  const dir = DIRS4[st.dir % 4];
  st.dir = (st.dir + 1) % 4;
  const p = ctx.player;
  const to = { x: p.pos.x + dir.x, y: p.pos.y + dir.y };
  if (!ctx.isWall(to) && !ctx.actorAt(to)) {
    ctx.moveActor(p, to); // moveActor가 해저드 진입을 연쇄 처리(바람에 밀려 풍식 위로).
    ctx.fx.floatText(p.pos, "바람", "#cbb98a");
  }
}

// ── 양동 호흡: 바닥이 band별로 안전↔용해를 주기적으로 호흡한다(같은 칸이 시간축으로 위험). ──
interface BreatheState {
  tick: number;
}
const breatheTable = new WeakMap<Level, BreatheState>();
const NBANDS = 4; // 한 번에 1/4 밴드만 용해(과도한 커버리지 완화)
const BLOCK = 4;
const BREATHE_SLOT = 3;
const bandOf = (p: Pos): number => ((Math.floor(p.x / BLOCK) + Math.floor(p.y / BLOCK)) % NBANDS + NBANDS) % NBANDS;

export function breatheTick(ctx: GameContext): void {
  if (ctx.level.isBossFloor) return;
  let st = breatheTable.get(ctx.level);
  if (!st) {
    st = { tick: 0 };
    breatheTable.set(ctx.level, st);
  }
  st.tick++;
  if (st.tick % BREATHE_SLOT !== 0) return;
  const meltBand = Math.floor(st.tick / BREATHE_SLOT) % NBANDS;
  const lvl = ctx.level;
  // 이전 용해 복원 → 이번 band의 바닥을 용해.
  for (let y = 0; y < lvl.height; y++) {
    for (let x = 0; x < lvl.width; x++) {
      const p = { x, y };
      if (lvl.tileIdAt(p) === "yangdong_molten") lvl.setTile(p, T_FLOOR);
    }
  }
  const melted: Pos[] = [];
  for (let y = 0; y < lvl.height; y++) {
    for (let x = 0; x < lvl.width; x++) {
      const p = { x, y };
      if (lvl.tileIdAt(p) === T_FLOOR && bandOf(p) === meltBand) {
        lvl.setTile(p, "yangdong_molten");
        melted.push(p);
      }
    }
  }
  if (melted.length > 0) ctx.fx.flashCells(melted, "#e8a24a");
}
