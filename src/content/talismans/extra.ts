// v1.2 신규 부적 6종 — 서로 다른 전술 패턴(타일AoE·직선·흡혈·집결·넉백·지대).

import { chebyshev, type Pos } from "../../core/grid";
import type { GameContext, TalismanDef } from "../../core/types";
import type { Enemy } from "../../entities/enemy";
import { atkScaled, enemiesAround, enemiesOnTiles, lineFromPlayer } from "./effects";

function squareArea(c: Pos, r: number): Pos[] {
  const out: Pos[] = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) out.push({ x: c.x + dx, y: c.y + dy });
  return out;
}

/** Step an enemy one tile toward the player (dominant axis first). */
function stepToPlayer(ctx: GameContext, e: Enemy): void {
  const dx = ctx.player.pos.x - e.pos.x;
  const dy = ctx.player.pos.y - e.pos.y;
  if (Math.abs(dx) + Math.abs(dy) <= 1) return; // already adjacent
  const cands: Pos[] =
    Math.abs(dx) >= Math.abs(dy)
      ? [{ x: Math.sign(dx), y: 0 }, { x: 0, y: Math.sign(dy) }]
      : [{ x: 0, y: Math.sign(dy) }, { x: Math.sign(dx), y: 0 }];
  for (const d of cands) {
    if (d.x === 0 && d.y === 0) continue;
    const n = { x: e.pos.x + d.x, y: e.pos.y + d.y };
    if (!ctx.isWall(n) && !ctx.actorAt(n)) {
      ctx.moveActor(e, n);
      return;
    }
  }
}

/** Push an enemy up to `dist` tiles away from the player; blocked → impact damage. */
function pushFromPlayer(ctx: GameContext, e: Enemy, dist: number): void {
  const dir = { x: Math.sign(e.pos.x - ctx.player.pos.x), y: Math.sign(e.pos.y - ctx.player.pos.y) };
  if (dir.x === 0 && dir.y === 0) return;
  for (let s = 0; s < dist; s++) {
    const n = { x: e.pos.x + dir.x, y: e.pos.y + dir.y };
    if (ctx.isWall(n) || ctx.actorAt(n)) {
      ctx.dealDamage(e, 2, { source: ctx.player, kind: "physical" });
      return;
    }
    ctx.moveActor(e, n);
    if (!e.alive) return;
  }
}

export const nakroeTalisman: TalismanDef = {
  id: "nakroe_talisman",
  name: "낙뢰부",
  nameHanja: "落雷符",
  glyph: "낙",
  color: "#9bd1ff",
  desc: "지정 칸 3×3에 벼락 (ATK×1.2, DEF무시)",
  targeting: "tile",
  range: 5,
  weight: 8,
  use(ctx, target) {
    if (!target.tile) return { consumed: false };
    if (chebyshev(target.tile, ctx.player.pos) > (this.range ?? 5)) return { consumed: false, message: "너무 멀다." };
    const cells = squareArea(target.tile, 1);
    ctx.fx.flashCells(cells, "#9bd1ff");
    const dmg = atkScaled(ctx, 1.2);
    let hit = 0;
    for (const e of enemiesOnTiles(ctx, cells))
      hit += ctx.dealDamage(e, dmg, { source: ctx.player, kind: "lightning", ignoreDef: true });
    ctx.fx.shake(3);
    return { consumed: true, message: hit > 0 ? "낙뢰가 내리꽂힌다." : "빈 자리에 벼락이 떨어진다." };
  },
};

export const hwaryongTalisman: TalismanDef = {
  id: "hwaryong_talisman",
  name: "화룡부",
  nameHanja: "火龍符",
  glyph: "화",
  color: "#ff7a3c",
  desc: "직선 5칸 화룡 — 관통 + 화상",
  targeting: "direction",
  range: 5,
  weight: 8,
  use(ctx, target) {
    if (!target.dir) return { consumed: false };
    const tiles = lineFromPlayer(ctx, target.dir, this.range ?? 5);
    ctx.fx.flashCells(tiles, "#ff7a3c");
    const dmg = atkScaled(ctx, 0.8);
    let hit = 0;
    for (const e of enemiesOnTiles(ctx, tiles)) {
      hit += ctx.dealDamage(e, dmg, { source: ctx.player, kind: "fire" });
      if (e.alive) ctx.applyStatus(e, "burn", 3, 2, ctx.player);
    }
    return { consumed: true, message: hit > 0 ? "화룡이 일직선으로 내달린다." : "불길이 허공을 가른다." };
  },
};

export const heupjeongTalisman: TalismanDef = {
  id: "heupjeong_talisman",
  name: "흡정부",
  nameHanja: "吸精符",
  glyph: "흡",
  color: "#b06bff",
  desc: "반경 3칸 최근접 적 흡혼 — 가한 피해의 절반 회복",
  targeting: "none",
  weight: 7,
  use(ctx) {
    const foes = enemiesAround(ctx, ctx.player.pos, 3).sort(
      (a, b) => chebyshev(a.pos, ctx.player.pos) - chebyshev(b.pos, ctx.player.pos),
    );
    if (foes.length === 0) return { consumed: false, message: "빨아들일 혼이 없다." };
    const dealt = ctx.dealDamage(foes[0], atkScaled(ctx, 1.5), {
      source: ctx.player,
      kind: "physical",
      ignoreDef: true,
    });
    const healed = Math.ceil(dealt / 2);
    ctx.heal(ctx.player, healed);
    ctx.fx.flashCells([foes[0].pos, ctx.player.pos], "#b06bff");
    return { consumed: true, message: `정기를 흡수했다. (+${healed})` };
  },
};

export const inryeokTalisman: TalismanDef = {
  id: "inryeok_talisman",
  name: "인력부",
  nameHanja: "引力符",
  glyph: "인",
  color: "#8c9bb0",
  desc: "보이는 적을 2칸 끌어당긴다 (한데 모으기)",
  targeting: "none",
  weight: 5,
  use(ctx) {
    const foes = ctx.allEnemies().filter((e) => !e.isBoss && ctx.level.isVisible(e.pos));
    if (foes.length === 0) return { consumed: false, message: "끌어당길 적이 없다." };
    for (const e of foes) {
      stepToPlayer(ctx, e);
      if (e.alive) stepToPlayer(ctx, e);
    }
    ctx.fx.flashCells(
      foes.map((e) => e.pos),
      "#8c9bb0",
    );
    return { consumed: true, message: "사기가 빨려든다." };
  },
};

export const jingakTalisman: TalismanDef = {
  id: "jingak_talisman",
  name: "진각부",
  nameHanja: "震脚符",
  glyph: "진",
  color: "#d4a24a",
  desc: "인접한 적을 2칸 넉백 + 피해 (위기 탈출)",
  targeting: "none",
  weight: 6,
  use(ctx) {
    const adj = ctx.allEnemies().filter((e) => !e.isBoss && chebyshev(e.pos, ctx.player.pos) === 1);
    if (adj.length === 0) return { consumed: false, message: "밀쳐낼 적이 없다." };
    const dmg = atkScaled(ctx, 0.6);
    for (const e of adj) {
      ctx.dealDamage(e, dmg, { source: ctx.player, kind: "physical" });
      if (e.alive) pushFromPlayer(ctx, e, 2);
    }
    ctx.fx.shake(5);
    return { consumed: true, message: "진각에 사기가 튕겨난다." };
  },
};

export const yeokbyeongTalisman: TalismanDef = {
  id: "yeokbyeong_talisman",
  name: "역병부",
  nameHanja: "疫病符",
  glyph: "역",
  color: "#9be36b",
  desc: "지정 칸 3×3에 독무 — 중독 4턴 + 독 지대 생성",
  targeting: "tile",
  range: 5,
  weight: 6,
  use(ctx, target) {
    if (!target.tile) return { consumed: false };
    if (chebyshev(target.tile, ctx.player.pos) > (this.range ?? 5)) return { consumed: false, message: "너무 멀다." };
    const cells = squareArea(target.tile, 1);
    ctx.fx.flashCells(cells, "#9be36b");
    for (const c of cells) if (ctx.level.tileIdAt(c) === "floor") ctx.level.setTile(c, "doksa_poison");
    for (const e of enemiesOnTiles(ctx, cells)) ctx.applyStatus(e, "poison", 4, 2, ctx.player);
    return { consumed: true, message: "독무가 자욱하게 퍼진다." };
  },
};

export const extraTalismans: TalismanDef[] = [
  nakroeTalisman,
  hwaryongTalisman,
  heupjeongTalisman,
  inryeokTalisman,
  jingakTalisman,
  yeokbyeongTalisman,
];
