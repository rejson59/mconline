import { JAVA_CHEST_TEXTURES, JAVA_RAIL_TEXTURES } from './art/javaBlocks.generated';
/**
 * 2.17: grafika z paczki „Pixel Perfection CE” wkomponowana w atlas gry.
 *
 * Gra rysuje świat z jednego atlasu 256×256 (16 × 16 kafelków po 16 px).
 * Ten moduł podmienia wybrane kafelki na prawdziwe tekstury z paczki
 * (`vanillaArt.generated.ts`), a resztę – której paczka 1.16 nie ma –
 * zostawia proceduralnym teksturom z `textures.ts`.
 *
 * Wszystko dzieje się synchronicznie: PNG w base64 dekodujemy własnym
 * dekoderem, więc działa też w testach w Node (bez canvasu i bez DOM).
 */

import {
  BLOCK_ATLAS_PNG,
  ENTITY_TEXTURES,
  ITEM_ATLAS_PNG,
  ITEM_TILE,
  OFFICIAL_TILES,
} from './art/vanillaArt.generated';
import { decodePng, type DecodedImage } from './art/miniPng';

const TILE = 16;
const ATLAS_TILES = 16;
const ATLAS_SIZE = TILE * ATLAS_TILES;

let blockImage: DecodedImage | null = null;
let itemImage: DecodedImage | null = null;
let failed = false;
const entityImages = new Map<string, DecodedImage | null>();

/**
 * 2.32: miejsce w atlasie 256×256 na całe tekstury encji.
 *
 * Kafelki 0–175 są zajęte przez bloki, więc reszta (od wiersza 11) jest wolna.
 * Skrzynia potrzebuje 64×64 px, czyli 4 × 4 kafelki – mieści się trzy razy
 * (zwykła, lewa i prawa połowa podwójnej), bez skalowania ani utraty pikseli.
 */
export const ENTITY_ATLAS = {
  chest: { x: 0, y: 176 },
  chest_left: { x: 64, y: 176 },
  chest_right: { x: 128, y: 176 },
} as const;

export type EntityAtlasKey = keyof typeof ENTITY_ATLAS;

/** Obraz tekstury encji z paczki (albo null, gdy jej nie ma). */
export function entityImage(key: EntityAtlasKey): DecodedImage | null {
  if (entityImages.has(key)) return entityImages.get(key) ?? null;
  const entry = JAVA_CHEST_TEXTURES[key] ?? ENTITY_TEXTURES[key];
  if (!entry) {
    entityImages.set(key, null);
    return null;
  }
  let img: DecodedImage | null = null;
  try {
    img = decodePng(entry.png);
  } catch (e) {
    console.warn('Nie udało się odczytać tekstury encji z paczki:', key, e);
  }
  entityImages.set(key, img);
  return img;
}

/**
 * Wkleja tekstury encji do atlasu gry. Atlas trzyma obraz „od góry”, tak jak
 * canvas, więc kopiujemy wiersz po wierszu bez odwracania – UV liczy siatka.
 */
export function applyEntityTextures(img: ImageData): number {
  let copied = 0;
  for (const key of Object.keys(ENTITY_ATLAS) as EntityAtlasKey[]) {
    const src = entityImage(key);
    if (!src) continue;
    const { x: ox, y: oy } = ENTITY_ATLAS[key];
    for (let y = 0; y < src.height; y++) {
      const sy = oy + y;
      if (sy >= ATLAS_SIZE) break;
      for (let x = 0; x < src.width; x++) {
        const sx = ox + x;
        if (sx >= ATLAS_SIZE) break;
        const s = (y * src.width + x) * 4;
        const d = (sy * ATLAS_SIZE + sx) * 4;
        img.data[d] = src.data[s];
        img.data[d + 1] = src.data[s + 1];
        img.data[d + 2] = src.data[s + 2];
        img.data[d + 3] = src.data[s + 3];
      }
    }
    copied++;
  }
  return copied;
}

function decode(data: string): DecodedImage | null {
  try {
    return decodePng(data);
  } catch (e) {
    console.warn('Nie udało się odczytać grafiki paczki – zostają tekstury proceduralne.', e);
    return null;
  }
}

/** Obraz atlasu bloków z paczki (leniwie, raz na sesję). */
export function officialBlockAtlas(): DecodedImage | null {
  if (failed) return null;
  if (!blockImage) blockImage = decode(BLOCK_ATLAS_PNG);
  if (!blockImage) failed = true;
  return blockImage;
}

/** Obraz atlasu ikon przedmiotów (leniwie, raz na sesję). */
export function officialItemAtlas(): DecodedImage | null {
  if (failed) return null;
  if (!itemImage) itemImage = decode(ITEM_ATLAS_PNG);
  if (!itemImage) failed = true;
  return itemImage;
}

/** Czy dany kafelek atlasu pochodzi z paczki (a nie z generatora gry). */
export function isOfficialTile(tile: number): boolean {
  return OFFICIAL_TILES.includes(tile);
}

/**
 * Nadpisuje kafelki oficjalną grafiką. `img` to bufor całego atlasu gry,
 * dokładnie ten, który potem trafia do `putImageData`.
 */
export function applyOfficialTiles(img: ImageData): number {
  const src = officialBlockAtlas();
  if (!src || src.width !== ATLAS_SIZE || src.height !== ATLAS_SIZE) return 0;
  let copied = 0;
  for (const tile of OFFICIAL_TILES) {
    const ox = (tile % ATLAS_TILES) * TILE;
    const oy = Math.floor(tile / ATLAS_TILES) * TILE;
    for (let y = 0; y < TILE; y++) {
      const s = ((oy + y) * ATLAS_SIZE + ox) * 4;
      const d = ((oy + y) * ATLAS_SIZE + ox) * 4;
      for (let x = 0; x < TILE * 4; x++) img.data[d + x] = src.data[s + x];
    }
    copied++;
  }
  return copied;
}

/** Ile kafelków atlasu pochodzi z paczki. */
export function officialTileCount(): number {
  return OFFICIAL_TILES.length;
}

/**
 * Ikona przedmiotu (16×16 RGBA) z paczki albo `null`, gdy przedmiot nie ma
 * odpowiednika w paczce 1.16 (tarcza, lorneta…).
 */
export function officialItemPixels(id: number): Uint8Array | null {
  const src = officialItemAtlas();
  const tile = ITEM_TILE[id];
  if (!src || tile === undefined) return null;
  const ox = (tile % ATLAS_TILES) * TILE;
  const oy = Math.floor(tile / ATLAS_TILES) * TILE;
  const out = new Uint8Array(TILE * TILE * 4);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const s = ((oy + y) * ATLAS_SIZE + ox + x) * 4;
      const d = (y * TILE + x) * 4;
      out[d] = src.data[s];
      out[d + 1] = src.data[s + 1];
      out[d + 2] = src.data[s + 2];
      out[d + 3] = src.data[s + 3];
    }
  }
  return out;
}

/** Czy przedmiot ma ikonę z paczki. */
export function hasOfficialItemIcon(id: number): boolean {
  return ITEM_TILE[id] !== undefined;
}

/** Ile przedmiotów ma oficjalną ikonę. */
export function officialItemCount(): number {
  return Object.keys(ITEM_TILE).length;
}

/** Original Java rail sprites; reserved corner tile stays outside chest regions. */
export function applyJavaRailTextures(img: ImageData, tiles: Record<string,number>): void {
  for(const [name,tile] of Object.entries(tiles)) {
    const png=JAVA_RAIL_TEXTURES[name];if(!png)continue;
    const source=decodePng(png), ox=(tile%16)*16,oz=Math.floor(tile/16)*16;
    for(let z=0;z<16;z++)for(let x=0;x<16;x++) {
      const si=(z*source.width+x)*4,di=((oz+z)*img.width+ox+x)*4;
      for(let channel=0;channel<4;channel++)img.data[di+channel]=source.data[si+channel];
    }
  }
}
