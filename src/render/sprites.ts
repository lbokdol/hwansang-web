// Sprite registry — loads the generated PNGs and maps game ids → images.
// Rendering falls back to glyphs until sprites finish loading (and for any id
// without a sprite).

// Vite bundles + hashes every sprite; eager URL glob gives id → asset URL.
const urls = import.meta.glob("../sprites/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const urlByKey: Record<string, string> = {};
for (const [path, url] of Object.entries(urls)) {
  const m = path.match(/([a-z0-9_]+)\.png$/);
  if (m) urlByKey[m[1]] = url; // e.g. "hs_okjol" -> url
}

const images: Record<string, HTMLImageElement> = {};

export function loadSprites(): void {
  for (const [key, url] of Object.entries(urlByKey)) {
    const img = new Image();
    img.src = url;
    images[key] = img;
  }
}

function ready(key: string | undefined): HTMLImageElement | null {
  if (!key) return null;
  const img = images[key];
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

// --- game-id → sprite-key maps ---------------------------------------------

const ENEMY_SPRITE: Record<string, string> = {
  dosan_mangryeong: "hs_mangryeong",
  dosan_dongsari: "hs_dongsari",
  dosan_gasikkamagwi: "hs_gasikkamagwi",
  dosan_okjol: "hs_okjol",
  hwatang_hwaryeong: "hs_hwaryeong",
  hwatang_hwagwi: "hs_hwagwi",
  hwatang_bulnabang: "hs_bulnabang",
  hwatang_kkeulhokjol: "hs_kkeulhokjol",
  hanbing_hanseol: "hs_hanseol",
  hanbing_eoreumjogak: "hs_eoreumjogak",
  hanbing_binggwi: "hs_binggwi",
  hanbing_seolin: "hs_seolin",
  jingwang: "hs_jingwang",
  chogang: "hs_chogang",
  songje: "hs_songje",
  // v1.1 — 기존 지옥 심화
  dosan_geomgwi: "hs_geomgwi",
  dosan_bidogwi: "hs_bidogwi",
  hwatang_hwayeomsulsa: "hs_hwayeomsulsa",
  hwatang_yongamgeobuk: "hs_yongamgeobuk",
  hanbing_binggungsu: "hs_binggungsu",
  hanbing_hanseolrang: "hs_hanseolrang",
  // v1.1 — 독사지옥 + 오관대왕
  doksa_dokssa: "hs_dokssa",
  doksa_dongmugwi: "hs_dongmugwi",
  doksa_geochi: "hs_geochi",
  doksa_maghoksu: "hs_maghoksu",
  ogwan: "hs_ogwan",
};

export function playerSprite(): HTMLImageElement | null {
  return ready("hs_player");
}

export function enemySprite(defId: string): HTMLImageElement | null {
  // Shallow hells map to bare sprite names via ENEMY_SPRITE; deep-hell enemies
  // and the 5–10대왕 use their full id as the sprite key (hs_<id>).
  return ready(ENEMY_SPRITE[defId] ?? `hs_${defId}`);
}

// Per-actor draw "presence" (≈ √area in tile units; see drawActorSprite).
// Area-based so wide action poses keep a consistent size as tall figures.
// Big shield-types render larger.
const ACTOR_SCALE: Record<string, number> = {
  dosan_okjol: 2.4,
  doksa_maghoksu: 2.4,
  hwatang_yongamgeobuk: 2.4,
};

export function actorScale(defId: string, isBoss: boolean): number {
  return ACTOR_SCALE[defId] ?? (isBoss ? 2.6 : 2.1);
}

/** Tile sprite. floor/wall are per-hell; stairs is an object drawn over floor. */
export function tileSprite(tileId: string, hellId: string): HTMLImageElement | null {
  if (tileId === "floor") return ready(`hs_${hellId}_floor`);
  if (tileId === "wall") return ready(`hs_${hellId}_wall`);
  if (tileId === "stairs_down") return ready("hs_stairs");
  if (tileId === "dosan_blade") return ready("hs_blade_tile");
  if (tileId === "hwatang_lava") return ready("hs_lava_tile");
  if (tileId === "hanbing_ice") return ready("hs_ice_tile");
  if (tileId === "doksa_poison") return ready("hs_poison_tile");
  return null;
}

export function floorSprite(hellId: string): HTMLImageElement | null {
  return ready(`hs_${hellId}_floor`);
}

export function talismanSprite(id: string): HTMLImageElement | null {
  return ready(`hs_${id}`);
}

export function weaponSprite(id: string): HTMLImageElement | null {
  return ready(`hs_weapon_${id}`);
}

export function statusSprite(kind: string): HTMLImageElement | null {
  return ready(`hs_st_${kind}`);
}

export function altarSprite(): HTMLImageElement | null {
  return ready("hs_altar");
}

export function hubBackground(): HTMLImageElement | null {
  return ready("hs_myeongbu_bg");
}
