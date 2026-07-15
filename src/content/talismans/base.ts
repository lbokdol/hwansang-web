// 시작 드롭 풀 5종 (부적_상세 §5): 회생·화염·축지·천리안·벽사.
// 공격 부적은 ATK 배수 + DEF 무시 (부적_상세 §3).

import { DIRS4, add, manhattan } from "../../core/grid";
import type { TalismanDef } from "../../core/types";
import { atkScaled, lineFromPlayer } from "./effects";

export const healTalisman: TalismanDef = {
  id: "heal_talisman",
  name: "회생부",
  nameHanja: "回生符",
  glyph: "회",
  color: "#7be0a0",
  desc: "최대 HP의 50% 회복",
  targeting: "none",
  weight: 20,
  use(ctx) {
    ctx.heal(ctx.player, Math.ceil(ctx.player.stats.maxHp * 0.5));
    return { consumed: true, message: "혼백이 추슬러진다." };
  },
};

export const fireTalisman: TalismanDef = {
  id: "fire_talisman",
  name: "화염부",
  nameHanja: "火焰符",
  glyph: "화",
  color: "#ff7a3c",
  desc: "직선 4칸 화염(ATK×1.5, DEF무시) + 화상",
  targeting: "direction",
  range: 4,
  weight: 18,
  use(ctx, target) {
    if (!target.dir) return { consumed: false };
    const tiles = lineFromPlayer(ctx, target.dir, this.range ?? 4, true);
    ctx.fx.flashCells(tiles, "#ff7a3c");
    const dmg = atkScaled(ctx, 1.5);
    let hit = 0;
    for (const t of tiles) {
      const e = ctx.enemyAt(t);
      if (e) {
        hit += ctx.dealDamage(e, dmg, { source: ctx.player, kind: "fire", ignoreDef: true });
        ctx.applyStatus(e, "burn", 3, 2, ctx.player);
      }
    }
    ctx.fx.shake(3);
    return { consumed: true, message: hit > 0 ? "화염이 길을 태운다." : "화염이 허공을 가른다." };
  },
};

export const exorcismTalisman: TalismanDef = {
  id: "exorcism_talisman",
  name: "벽사부",
  nameHanja: "辟邪符",
  glyph: "벽",
  color: "#ffd86b",
  desc: "인접 4방 동시 타격(ATK×2, DEF무시)",
  targeting: "none",
  weight: 9,
  use(ctx) {
    const cells = DIRS4.map((d) => add(ctx.player.pos, d));
    ctx.fx.flashCells(cells, "#ffd86b");
    const dmg = atkScaled(ctx, 2);
    let hit = 0;
    for (const c of cells) {
      const e = ctx.enemyAt(c);
      if (e) hit += ctx.dealDamage(e, dmg, { source: ctx.player, kind: "holy", ignoreDef: true });
    }
    ctx.fx.shake(4);
    return { consumed: true, message: hit > 0 ? "벽사의 기운이 터진다." : "주변에 사기가 없다." };
  },
};

export const teleportTalisman: TalismanDef = {
  id: "teleport_talisman",
  name: "축지부",
  nameHanja: "縮地符",
  glyph: "축",
  color: "#9be3ff",
  desc: "시야 내 빈 칸으로 순간 이동(탈출)",
  targeting: "tile",
  range: 6,
  weight: 15,
  use(ctx, target) {
    const to = target.tile;
    if (!to || ctx.isWall(to) || ctx.actorAt(to) || manhattan(to, ctx.player.pos) > (this.range ?? 6)) {
      return { consumed: false, message: "갈 수 없는 곳이다." };
    }
    ctx.player.pos = { x: to.x, y: to.y };
    ctx.fx.floatText(ctx.player.pos, "축", "#9be3ff");
    return { consumed: true, message: "땅이 접히며 단숨에 내달린다." };
  },
};

export const farsightTalisman: TalismanDef = {
  id: "farsight_talisman",
  name: "천리안부",
  nameHanja: "千里眼符",
  glyph: "천",
  color: "#ffe9a8",
  desc: "층 전체 공개(계단·아이템·적)",
  targeting: "none",
  weight: 12,
  use(ctx) {
    for (let x = 0; x < ctx.level.width; x++) {
      for (let y = 0; y < ctx.level.height; y++) ctx.level.explored.add(`${x},${y}`);
    }
    for (const e of ctx.allEnemies()) ctx.level.explored.add(`${e.pos.x},${e.pos.y}`);
    return { consumed: true, message: "천리안이 층 전체를 비춘다." };
  },
};

export const baseTalismans: TalismanDef[] = [
  healTalisman,
  fireTalisman,
  exorcismTalisman,
  teleportTalisman,
  farsightTalisman,
];

/** Ids that drop without any 새로운 인연 unlock. (v1.1 해독/맹독 + v1.2 신규 6종) */
export const baseDropPool: string[] = [
  ...baseTalismans.map((t) => t.id),
  "detox_talisman",
  "venom_talisman",
  "nakroe_talisman",
  "hwaryong_talisman",
  "heupjeong_talisman",
  "inryeok_talisman",
  "jingak_talisman",
  "yeokbyeong_talisman",
];
