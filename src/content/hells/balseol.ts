// 발설지옥(拔舌地獄) — 깊은 court 5왕 염라(거울왕). 되울림 가시.
// 동적 되울림(EchoTick)은 정적 산포로 단순화 이식.

import type { HellDef, TileDef } from "../../core/types";

const ECHO_TILE: TileDef = {
  id: "balseol_echo",
  name: "되울림 가시",
  glyph: "◇",
  fg: "#c4b9e0",
  bg: "#141018",
  walkable: true,
  opaque: false,
  hazard: { damage: 3, damageKind: "terrain", trigger: "enter" },
};

export const balseolHell: HellDef = {
  id: "balseol",
  name: "발설지옥",
  nameHanja: "拔舌地獄",
  order: 5,
  floors: 3,
  palette: {
    wallFg: "#4a4658",
    wallBg: "#16131f",
    floorFg: "#2e2a3c",
    floorBg: "#0c0a12",
    ambient: "#07060c",
    accent: "#c4b9e0",
  },
  tiles: [ECHO_TILE],
  monsterTable: [
    { value: "balseol_gyeollyeong", weight: 4 },
    { value: "balseol_jaemulgwi", weight: 2 },
    { value: "balseol_geoulbunsin", weight: 3 },
    { value: "balseol_oechimkkun", weight: 2 },
    { value: "balseol_hyeochae", weight: 2 },
    { value: "balseol_eopgyeong_pyeon", weight: 2 },
  ],
  bossId: "yeomra",
  intro: "발설지옥 — 거짓의 혀를 뽑는 옥. 업경이 네 모습을 비추어 되울린다.",
  paintHazards(level, ctx) {
    const floors = [...level.floorCells()];
    ctx.rng.shuffle(floors);
    const n = Math.floor(floors.length * (0.02 + 0.01 * ctx.depth));
    for (let i = 0; i < n; i++) level.setTile(floors[i], ECHO_TILE.id);
  },
};
