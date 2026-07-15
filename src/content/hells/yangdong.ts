// 양동지옥(烊銅地獄) — 깊은 court 6왕 변성대왕. 녹은 쇳물(molten).
// 동적 호흡 바닥(BreatheTick)은 정적 산포로 단순화 이식.

import type { HellDef, TileDef } from "../../core/types";
import { breatheTick } from "./dynamics";

const MOLTEN_TILE: TileDef = {
  id: "yangdong_molten",
  name: "녹은 쇳물",
  glyph: "▓",
  fg: "#e8a24a",
  bg: "#1a0f08",
  walkable: true,
  opaque: false,
  // 머무는 동안 매 턴 피해(Stand) — 호흡으로 바닥이 발밑에서 녹으면 비켜서야 한다.
  hazard: { damage: 4, damageKind: "fire", trigger: "stand" },
};

export const yangdongHell: HellDef = {
  id: "yangdong",
  name: "양동지옥",
  nameHanja: "烊銅地獄",
  order: 6,
  floors: 3,
  palette: {
    wallFg: "#5a6e63",
    wallBg: "#16211c",
    floorFg: "#3a4a42",
    floorBg: "#0c140f",
    ambient: "#070c09",
    accent: "#7fae93",
  },
  tiles: [MOLTEN_TILE],
  monsterTable: [
    { value: "yangdong_yongjae", weight: 4 },
    { value: "yangdong_byeontae", weight: 2 },
    { value: "yangdong_uitae", weight: 2 },
    { value: "yangdong_bunyeol", weight: 2 },
    { value: "yangdong_jeoni", weight: 2 },
    { value: "yangdong_mobang", weight: 2 },
  ],
  bossId: "byeonseong",
  intro: "양동지옥 — 녹인 구리를 들이붓는 옥. 쇳물이 굳고 다시 끓는다.",
  paintHazards(level, ctx) {
    const floors = [...level.floorCells()];
    ctx.rng.shuffle(floors);
    const n = Math.floor(floors.length * (0.04 + 0.015 * ctx.depth));
    for (let i = 0; i < n; i++) level.setTile(floors[i], MOLTEN_TILE.id);
  },
  onFloorTick: breatheTick, // 바닥이 band별로 안전↔용해를 호흡
};
