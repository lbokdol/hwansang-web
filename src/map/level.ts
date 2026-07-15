import { getTile, T_FLOOR, T_WALL } from "./tiles";
import { posKey, type Pos } from "../core/grid";
import type { HellDef, TileDef, TileId } from "../core/types";
import type { Actor } from "../entities/actor";
import type { Enemy } from "../entities/enemy";

export interface ItemDrop {
  pos: Pos;
  talismanId: string;
}

export interface WeaponDrop {
  pos: Pos;
  weaponId: string;
}

export type AltarKind = "heal" | "hp" | "atk";

export interface Altar {
  pos: Pos;
  kind: AltarKind;
}

/** One dungeon floor: tile grid + occupants + FOV memory. */
export class Level {
  readonly width: number;
  readonly height: number;
  readonly hell: HellDef;
  /** Floor index within the hell, 0-based. */
  readonly depth: number;
  readonly isBossFloor: boolean;

  tiles: TileId[];
  actors: Actor[] = [];
  drops: ItemDrop[] = [];
  weaponDrops: WeaponDrop[] = [];
  altars: Altar[] = [];
  /** 공격으로 변환된 임시 함정 타일 — 남은 턴이 0이 되면 바닥으로 되돌아간다. */
  tempTiles: { x: number; y: number; id: TileId; turnsLeft: number }[] = [];

  visible = new Set<string>();
  explored = new Set<string>();

  stairs: Pos | null = null;
  bossSpawned = false;

  constructor(width: number, height: number, hell: HellDef, depth: number) {
    this.width = width;
    this.height = height;
    this.hell = hell;
    this.depth = depth;
    this.isBossFloor = depth === hell.floors - 1;
    this.tiles = new Array(width * height).fill(T_WALL);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  private idx(x: number, y: number): number {
    return y * this.width + x;
  }

  tileIdAt(p: Pos): TileId {
    if (!this.inBounds(p.x, p.y)) return T_WALL;
    return this.tiles[this.idx(p.x, p.y)];
  }

  tileAt(p: Pos): TileDef {
    return getTile(this.tileIdAt(p));
  }

  setTile(p: Pos, id: TileId): void {
    if (this.inBounds(p.x, p.y)) this.tiles[this.idx(p.x, p.y)] = id;
  }

  isFloorLike(p: Pos): boolean {
    return this.tileAt(p).walkable;
  }

  isWall(p: Pos): boolean {
    return !this.tileAt(p).walkable;
  }

  blocksSight(p: Pos): boolean {
    return this.tileAt(p).opaque;
  }

  /** Living actor on a tile, if any. */
  actorAt(p: Pos): Actor | undefined {
    return this.actors.find((a) => a.alive && a.pos.x === p.x && a.pos.y === p.y);
  }

  livingEnemies(): Enemy[] {
    return this.actors.filter((a) => a.alive && a.isEnemy) as Enemy[];
  }

  dropAt(p: Pos): ItemDrop | undefined {
    return this.drops.find((d) => d.pos.x === p.x && d.pos.y === p.y);
  }

  removeDrop(drop: ItemDrop): void {
    this.drops = this.drops.filter((d) => d !== drop);
  }

  weaponDropAt(p: Pos): WeaponDrop | undefined {
    return this.weaponDrops.find((d) => d.pos.x === p.x && d.pos.y === p.y);
  }

  removeWeaponDrop(drop: WeaponDrop): void {
    this.weaponDrops = this.weaponDrops.filter((d) => d !== drop);
  }

  altarAt(p: Pos): Altar | undefined {
    return this.altars.find((a) => a.pos.x === p.x && a.pos.y === p.y);
  }

  removeAltar(altar: Altar): void {
    this.altars = this.altars.filter((a) => a !== altar);
  }

  removeActor(actor: Actor): void {
    this.actors = this.actors.filter((a) => a !== actor);
  }

  isVisible(p: Pos): boolean {
    return this.visible.has(posKey(p));
  }

  isExplored(p: Pos): boolean {
    return this.explored.has(posKey(p));
  }

  /** All walkable floor cells (used as a fallback for placement). */
  *floorCells(): Generator<Pos> {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.tiles[this.idx(x, y)] === T_FLOOR) yield { x, y };
      }
    }
  }
}
