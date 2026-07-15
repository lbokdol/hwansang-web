import type { BossDef } from "../../core/types";
import { jingwang } from "./dosan";
import { chogang } from "./hwatang";
import { songje } from "./hanbing";
import { ogwan } from "./doksa";
import { yeomra } from "./balseol";
import { byeonseong } from "./yangdong";
import { taesan } from "./geohae";
import { pyeongdeung } from "./heukseung";
import { dosi } from "./pungdo";
import { jeonryun } from "./yukdo";

const ALL: BossDef[] = [jingwang, chogang, songje, ogwan, yeomra, byeonseong, taesan, pyeongdeung, dosi, jeonryun];
const MAP = new Map<string, BossDef>(ALL.map((b) => [b.id, b]));

export function getBoss(id: string): BossDef {
  const b = MAP.get(id);
  if (!b) throw new Error(`unknown boss: ${id}`);
  return b;
}

export function hasBoss(id: string): boolean {
  return MAP.has(id);
}
