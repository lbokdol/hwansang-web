// 초강대왕(初江大王) — 화탕지옥. 공간 봉쇄: 불바다가 누적돼 바닥이 좁아진다.
// 위협은 보스가 아니라 바닥. 보스패턴_상세 §3.

import type { BossDef } from "../../core/types";
import {
  type BossPattern,
  areaAt,
  beginPhaseTransition,
  convertTiles,
  crossAt,
  lineThrough,
  ringAt,
  runBoss,
  strikePlayer,
  summonAround,
} from "./patterns";

const LAVA = "hwatang_lava";

// --- P1 ---
const boilingBurst: BossPattern = {
  name: "열탕 분출",
  color: "#ff7a3c",
  build: (_self, ctx) => areaAt(ctx.player.pos, 1, ctx), // 플레이어 위치 3×3 장판
  execute: (self, ctx, cells) => {
    strikePlayer(self, ctx, cells, 12, "fire", { kind: "burn", turns: 3, power: 2 });
    convertTiles(ctx, cells, LAVA); // 불바다 누적
  },
};

const flameLine: BossPattern = {
  name: "화염 직선",
  color: "#ff9a4a",
  build: (_self, ctx) => lineThrough(ctx.player.pos, ctx.rng.chance(0.5) ? "h" : "v", 6, ctx),
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 12, "fire", { kind: "burn", turns: 3, power: 2 }),
};

const mothSummon: BossPattern = {
  name: "불나방 소환",
  color: "#ffb24a",
  build: (self, ctx) => ringAt(self.pos, 1, ctx).filter((c) => !ctx.isBlocked(c)).slice(0, 2),
  execute: (self, ctx) => summonAround(self, ctx, "hwatang_bulnabang", 2, "#ffb24a"),
};

// --- P2 ---
const fireRipple: BossPattern = {
  name: "불의 파문",
  color: "#ff7a3c",
  build: (self, ctx) => {
    const r = ((self.state.ripple ?? 0) % 2) + 2; // 반경 2 → 3 교대
    self.state.ripple = (self.state.ripple ?? 0) + 1;
    return ringAt(self.pos, r, ctx);
  },
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 12, "fire", { kind: "burn", turns: 3, power: 2 }),
};

const flameCross: BossPattern = {
  name: "화염 십자",
  color: "#ff5a3c",
  build: (self, ctx) => crossAt(self.pos, 4, ctx),
  execute: (self, ctx, cells) => strikePlayer(self, ctx, cells, 12, "fire", { kind: "burn", turns: 3, power: 2 }),
};

export const chogang: BossDef = {
  id: "chogang",
  name: "초강대왕",
  nameHanja: "初江大王",
  glyph: "초",
  color: "#ff7a3c",
  hp: 85,
  atk: 10,
  def: 3,
  jeonggi: 20,
  phase2At: 0.5,
  act: (self, ctx) => runBoss(self, ctx, [boilingBurst, flameLine, mothSummon], [fireRipple, flameCross, mothSummon]),
  onPhaseChange: (self, ctx) => {
    beginPhaseTransition(self, ctx, "강이 끓어오른다! 외곽이 불바다로 가라앉는다. (2페이즈)");
    self.stats.atk += 2;
    // 아레나 영구 축소: 보스 외곽 링을 불바다로.
    convertTiles(ctx, ringAt(self.pos, 5, ctx), LAVA);
  },
};
