#!/usr/bin/env node
/**
 * 2.17: kompilator grafiki z paczki tekstur w stylu Minecrafta.
 *
 * Gra rysuje świat z jednego atlasu 256×256 (16 × 16 kafelków po 16 px), a
 * ekwipunek z osobnego atlasu ikon. Ten skrypt czyta paczkę tekstur (domyślnie
 * `26.2.x-Template.zip` z katalogu repozytorium), bierze z niej pliki PNG,
 * przycina animacje do pierwszej klatki, zabarwia tekstury, które w Minecrafcie
 * są barwione biomem (trawa, liście – kolory bierzemy z `colormap` paczki),
 * pakuje wszystko do dwóch atlasów i zapisuje moduł TS z gotowymi danymi
 * w base64. Dzięki temu gra nie zależy od sieci, a build zostaje jednym plikiem.
 *
 * Użycie:
 *   node scripts/compile-vanilla-art.mjs                 # zip z repo
 *   node scripts/compile-vanilla-art.mjs --pack <katalog> # rozpakowana paczka
 *   node scripts/compile-vanilla-art.mjs --zip <plik.zip>
 *
 * Wyjście: src/game/art/vanillaArt.generated.ts + podglądy w .art-preview/
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ZIP_FILE = path.resolve(arg('zip', path.join(ROOT, '26.2.x-Template.zip')));
const PACK_DIR = args.includes('--pack') ? path.resolve(arg('pack', '')) : null;
const OUT = path.join(ROOT, 'src', 'game', 'art', 'vanillaArt.generated.ts');
const PREVIEW_DIR = path.join(ROOT, '.art-preview');

// ---------------------------------------------------------------------------
// czytanie paczki: katalog albo ZIP (bez zewnętrznych narzędzi)
// ---------------------------------------------------------------------------
function readZip(file) {
  const buf = fs.readFileSync(file);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('to nie ZIP: ' + file);
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('uszkodzony ZIP');
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const local = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    // Rozmiary bierzemy z katalogu centralnego – część archiwów zapisuje
    // w nagłówku lokalnym same zera (strumieniowanie).
    entries.set(name, { local, method, compSize });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return { buf, entries };
}

const zip = PACK_DIR ? null : (fs.existsSync(ZIP_FILE) ? readZip(ZIP_FILE) : null);
if (!zip && !PACK_DIR) {
  console.error(`Nie znaleziono paczki: ${ZIP_FILE}\nPodaj --zip <plik> albo --pack <katalog>.`);
  process.exit(1);
}
if (PACK_DIR && !fs.existsSync(path.join(PACK_DIR, 'assets'))) {
  console.error(`Katalog ${PACK_DIR} nie wygląda na paczkę tekstur (brak assets/).`);
  process.exit(1);
}

/** Ścieżka wewnątrz paczki → bajty PNG (albo null). */
function readPackFile(rel) {
  if (zip) {
    const entry = zip.entries.get(rel) ?? zip.entries.get(rel.replace(/\//g, '\\'));
    if (!entry) return null;
    const buf = zip.buf;
    const off = entry.local;
    if (buf.readUInt32LE(off) !== 0x04034b50) throw new Error('uszkodzony wpis ZIP: ' + rel);
    const nameLen = buf.readUInt16LE(off + 26);
    const extraLen = buf.readUInt16LE(off + 28);
    const start = off + 30 + nameLen + extraLen;
    const data = buf.subarray(start, start + entry.compSize);
    if (entry.method === 0) return data;
    if (entry.method === 8) return zlib.inflateRawSync(data);
    throw new Error('nieobsługiwana kompresja ' + entry.method + ': ' + rel);
  }
  const file = path.join(PACK_DIR, rel);
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}

// ---------------------------------------------------------------------------
// dekoder PNG (8-bit, typy 0/2/3/4/6, bez przeplotu)
// ---------------------------------------------------------------------------
function decodePNGBytes(buf, name = '?') {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('to nie PNG: ' + name);
  let off = 8, w = 0, h = 0, bitDepth = 8, colorType = 6, interlace = 0;
  let pal = null, trns = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'PLTE') pal = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (interlace !== 0) throw new Error('przeplot nieobsługiwany: ' + name);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error('typ koloru ' + colorType + ': ' + name);
  const bits = channels * bitDepth;
  const stride = Math.ceil((w * bits) / 8);
  const bpp = Math.max(1, Math.ceil(bits / 8));
  const out = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v = (v + a) & 255;
      else if (filter === 2) v = (v + b) & 255;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      cur[x] = v;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  const sample = (x, y) => {
    if (bitDepth === 8) return out[y * stride + x];
    const perByte = 8 / bitDepth;
    const byte = out[y * stride + Math.floor(x / perByte)];
    return (byte >> (8 - bitDepth * ((x % perByte) + 1))) & ((1 << bitDepth) - 1);
  };
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const x = i % w, y = Math.floor(i / w);
    let r, g, b, a = 255;
    if (colorType === 3) {
      const p = sample(x, y);
      r = pal[p * 3]; g = pal[p * 3 + 1]; b = pal[p * 3 + 2];
      a = trns && p < trns.length ? trns[p] : 255;
    } else if (colorType === 0) {
      r = g = b = sample(x, y);
      if (trns) a = sample(x, y) === trns.readUInt16BE(0) ? 0 : 255;
    } else if (colorType === 4) {
      r = g = b = out[i * 2]; a = out[i * 2 + 1];
    } else if (colorType === 2) {
      r = out[i * 3]; g = out[i * 3 + 1]; b = out[i * 3 + 2];
    } else {
      r = out[i * 4]; g = out[i * 4 + 1]; b = out[i * 4 + 2]; a = out[i * 4 + 3];
    }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a;
  }
  return { w, h, data: rgba };
}

// ---------------------------------------------------------------------------
// koder PNG (tylko do podglądów)
// ---------------------------------------------------------------------------
function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  }
  const table = new Int32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
  });
  const crc32 = (b) => {
    let c = 0xffffffff;
    for (const v of b) c = table[(c ^ v) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// narzędzia obrazu
// ---------------------------------------------------------------------------
const TILE = 16;

/** Wycina prostokąt [x, y, w, h] i wpasowuje go w kafelek 16×16. */
function cropToTile(img, [cx, cy, cw, ch], mask, fit) {
  const out = new Uint8Array(TILE * TILE * 4);
  const scale = fit ? undefined : Math.min(TILE / cw, TILE / ch);
  const dw = fit ? fit[0] : Math.max(1, Math.round(cw * scale));
  const dh = fit ? fit[1] : Math.max(1, Math.round(ch * scale));
  const ox = Math.floor((TILE - dw) / 2), oy = Math.floor((TILE - dh) / 2);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      // 2.23: tarcza w Minecrafcie jest prostokątną płytą, a jej kształt
      // (zaokrąglony dół) nadaje tekstura. Gdy źródło jest w pełni kryjące,
      // wycinamy sylwetkę, żeby ikona nie wyglądała jak deska.
      if (mask === 'shield' && !insideShield(x + 0.5, y + 0.5, dw, dh)) continue;
      const sx = Math.min(img.w - 1, cx + Math.floor((x * cw) / dw));
      const sy = Math.min(img.h - 1, cy + Math.floor((y * ch) / dh));
      const s = (sy * img.w + sx) * 4;
      const d = ((oy + y) * TILE + ox + x) * 4;
      out[d] = img.data[s]; out[d + 1] = img.data[s + 1];
      out[d + 2] = img.data[s + 2]; out[d + 3] = img.data[s + 3];
    }
  }
  return out;
}

/** Sylwetka tarczy: prostokąt z zaokrąglonymi górnymi rogami i ostrzem u dołu. */
function insideShield(x, y, w, h) {
  const nx = (x / w) * 2 - 1; // -1..1
  const ny = y / h; // 0..1
  if (ny > 0.8) {
    const t = (ny - 0.8) / 0.2;
    return Math.abs(nx) <= 1 - t * 0.72;
  }
  if (ny < 0.06) return Math.abs(nx) <= 0.86;
  return Math.abs(nx) <= 1;
}

/** Wycina 16×16 (pierwsza klatka animacji – górny wiersz atlasu pionowego). */
function tile16(img) {
  const out = new Uint8Array(TILE * TILE * 4);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const s = ((y % img.h) * img.w + (x % img.w)) * 4;
      const d = (y * TILE + x) * 4;
      out[d] = img.data[s]; out[d + 1] = img.data[s + 1];
      out[d + 2] = img.data[s + 2]; out[d + 3] = img.data[s + 3];
    }
  }
  return out;
}

/**
 * Barwienie jak w Minecrafcie: `kolor_piksela * kolor_biomu / 255`.
 * Działa na teksturach szarych (trawa, liście), zachowując rysunek i kontrast.
 */
/** Czy kafelek jest (prawie) szary – tylko takie barwi wanilia. */
function isGrayTile(tile, threshold = 0.8) {
  let opaque = 0, gray = 0;
  for (let i = 0; i < TILE * TILE; i++) {
    if (tile[i * 4 + 3] < 24) continue;
    opaque++;
    const r = tile[i * 4], g = tile[i * 4 + 1], b = tile[i * 4 + 2];
    if (Math.abs(r - g) <= 10 && Math.abs(g - b) <= 10 && Math.abs(r - b) <= 10) gray++;
  }
  return opaque === 0 || gray / opaque >= threshold;
}

function tintTile(tile, color) {
  const out = new Uint8Array(tile);
  for (let i = 0; i < TILE * TILE; i++) {
    for (let c = 0; c < 3; c++) {
      out[i * 4 + c] = Math.min(255, Math.round((tile[i * 4 + c] * color[c]) / 255));
    }
  }
  return out;
}

/** Nakłada warstwę płynu (potion_overlay) zabarwioną kolorem mikstury. */
function overlayTile(base, overlay, color) {
  const out = new Uint8Array(base);
  for (let i = 0; i < TILE * TILE; i++) {
    const a = overlay[i * 4 + 3] / 255;
    if (a <= 0) continue;
    for (let c = 0; c < 3; c++) {
      const liquid = (overlay[i * 4 + c] * color[c]) / 255;
      out[i * 4 + c] = Math.round(base[i * 4 + c] * (1 - a) + liquid * a);
    }
    out[i * 4 + 3] = Math.max(base[i * 4 + 3], Math.round(overlay[i * 4 + 3]));
  }
  return out;
}

const cache = new Map();
function loadTex(rel) {
  if (cache.has(rel)) return cache.get(rel);
  const bytes = readPackFile(rel);
  const img = bytes ? decodePNGBytes(bytes, rel) : null;
  cache.set(rel, img);
  return img;
}

/** Kolor biomu z colormapy paczki („plains” leży w środku mapy). */
function colormapColor(name) {
  const img = loadTex(`assets/minecraft/textures/colormap/${name}.png`);
  if (!img) return null;
  const x = Math.floor(img.w / 2);
  const y = Math.floor(img.h / 2);
  const i = (y * img.w + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

const GRASS_TINT = colormapColor('grass') ?? [124, 189, 107];
const FOLIAGE_TINT = colormapColor('foliage') ?? [91, 171, 70];
// 2.20: woda w paczce jest szara (kanał barwny dodaje gra). Bez tego morze
// wyglądało jak biała mgła – barwimy je waniliowym błękitem oceanu.
const WATER_TINT = colormapColor('water') ?? [63, 118, 228];

/** Rozjaśnia kafelek (mnoży RGB, alfa bez zmian). */
function brightenTile(tile, gain) {
  if (!gain || gain === 1) return tile;
  const out = new Uint8Array(tile);
  for (let i = 0; i < TILE * TILE; i++) {
    for (let c = 0; c < 3; c++) {
      out[i * 4 + c] = Math.min(255, Math.round(tile[i * 4 + c] * gain));
    }
  }
  return out;
}

/**
 * 2.20: „czarne tło na przezroczyste”.
 *
 * Niektóre sprite'y w paczce (słońce, księżyc) są zapisane jako PNG bez kanału
 * alfa – tło jest po prostu czarne. W grze wychodził z tego czarny kwadrat
 * wokół tarczy. Kluczujemy więc czerń na alfę 0, zostawiając jaśniejsze
 * piksele (tarcza i poświata) bez zmian.
 */
function keyBlackSprite(data, w, h, limit = 18) {
  const out = new Uint8Array(data);
  for (let i = 0; i < w * h; i++) {
    const r = out[i * 4], g = out[i * 4 + 1], b = out[i * 4 + 2];
    const lum = Math.max(r, g, b);
    if (lum <= limit) out[i * 4 + 3] = 0;
  }
  return out;
}

/** Źródło kafelka: ścieżka albo { file, tint, overlay, color, gain }. */
function renderTile(spec) {
  if (!spec) return null;
  const s = typeof spec === 'string' ? { file: spec } : spec;
  const img = loadTex(s.file);
  if (!img) return { missing: s.file };
  // 2.23: `crop` wycina fragment tekstury (np. przednią ścianę tarczy) i
  // wpasowuje go w kafelek 16×16 z zachowaniem proporcji.
  let tile = s.crop ? cropToTile(img, s.crop, s.mask, s.fit) : tile16(img);
  if (s.overlay) {
    const ov = loadTex(s.overlay.file);
    if (ov) tile = overlayTile(tile, tile16(ov), s.overlay.color);
  }
  // 2.23: barwimy tylko tekstury szare. Część plików paczki (np. trzcina
  // cukrowa) jest już kolorowa – wanilia ich nie barwi, a my nakładaliśmy na
  // nie zieleń biomu i kolory wychodziły ciemniejsze niż w paczce.
  if (s.tint && isGrayTile(tile)) tile = tintTile(tile, s.tint);
  if (s.gain) tile = brightenTile(tile, s.gain);
  return { tile };
}

// ---------------------------------------------------------------------------
// kafelki bloków (nazwy T z src/game/blocks.ts → pliki paczki 26.2)
// ---------------------------------------------------------------------------
const B = 'assets/minecraft/textures/block/';
const I_ = 'assets/minecraft/textures/item/';
const E = 'assets/minecraft/textures/entity/';

const BLOCK_TILES = {
  grass_top: { file: B + 'grass_block_top.png', tint: GRASS_TINT },
  grass_side: B + 'grass_block_side.png',
  dirt: B + 'dirt.png',
  stone: B + 'stone.png',
  cobble: B + 'cobblestone.png',
  log_side: B + 'oak_log.png',
  log_top: B + 'oak_log_top.png',
  leaves: { file: B + 'oak_leaves.png', tint: FOLIAGE_TINT },
  planks: B + 'oak_planks.png',
  sand: B + 'sand.png',
  water: { file: B + 'water_still.png', tint: WATER_TINT, gain: 1.35 },
  glass: B + 'glass.png',
  bedrock: B + 'bedrock.png',
  gravel: B + 'gravel.png',
  coal_ore: B + 'coal_ore.png',
  iron_ore: B + 'iron_ore.png',
  gold_ore: B + 'gold_ore.png',
  diamond_ore: B + 'diamond_ore.png',
  brick: B + 'bricks.png',
  snow: B + 'snow.png',
  snow_side: B + 'grass_block_snow.png',
  cactus_side: B + 'cactus_side.png',
  cactus_top: B + 'cactus_top.png',
  birch_side: B + 'birch_log.png',
  birch_top: B + 'birch_log_top.png',
  birch_leaves: { file: B + 'birch_leaves.png', tint: FOLIAGE_TINT },
  tnt_side: B + 'tnt_side.png',
  tnt_top: B + 'tnt_top.png',
  tnt_bottom: B + 'tnt_bottom.png',
  glowstone: B + 'glowstone.png',
  bookshelf: B + 'bookshelf.png',
  wool_white: B + 'white_wool.png',
  wool_red: B + 'red_wool.png',
  crafting_top: B + 'crafting_table_top.png',
  crafting_side: B + 'crafting_table_side.png',
  furnace_front: B + 'furnace_front.png',
  furnace_side: B + 'furnace_side.png',
  obsidian: B + 'obsidian.png',
  stone_bricks: B + 'stone_bricks.png',
  ice: B + 'ice.png',
  tallgrass: { file: B + 'short_grass.png', tint: GRASS_TINT },
  flower_red: B + 'poppy.png',
  flower_yellow: B + 'dandelion.png',
  wool_blue: B + 'blue_wool.png',
  wool_green: B + 'green_wool.png',
  wool_yellow: B + 'yellow_wool.png',
  wool_black: B + 'black_wool.png',
  wool_orange: B + 'orange_wool.png',
  wool_magenta: B + 'magenta_wool.png',
  wool_light_blue: B + 'light_blue_wool.png',
  wool_lime: B + 'lime_wool.png',
  wool_pink: B + 'pink_wool.png',
  wool_gray: B + 'gray_wool.png',
  wool_light_gray: B + 'light_gray_wool.png',
  wool_cyan: B + 'cyan_wool.png',
  wool_purple: B + 'purple_wool.png',
  wool_brown: B + 'brown_wool.png',
  lava: B + 'lava_still.png',
  sandstone_side: B + 'sandstone.png',
  sandstone_top: B + 'sandstone_top.png',
  pumpkin_side: B + 'pumpkin_side.png',
  pumpkin_top: B + 'pumpkin_top.png',
  pumpkin_face: B + 'carved_pumpkin.png',
  mossy: B + 'mossy_cobblestone.png',
  clay: B + 'clay.png',
  torch: B + 'torch.png',
  sapling: B + 'oak_sapling.png',
  birch_sapling: B + 'birch_sapling.png',
  farmland: B + 'farmland.png',
  // 2.26: grządka nawodniona (`moisture=7`) ma w paczce własną teksturę.
  farmland_moist: B + 'farmland_moist.png',
  wheat0: B + 'wheat_stage0.png',
  wheat1: B + 'wheat_stage2.png',
  wheat2: B + 'wheat_stage4.png',
  wheat3: B + 'wheat_stage7.png',
  bed_top: B + 'red_bed_head_up.png',
  bed_side: B + 'bed_down.png',
  furnace_lit: B + 'furnace_front_on.png',
  chest_top: B + 'oak_planks.png',
  chest_side: B + 'oak_planks.png',
  chest_front: B + 'oak_planks.png',
  door: B + 'oak_door_bottom.png',
  door_top: B + 'oak_door_top.png',
  ladder: B + 'ladder.png',
  fence: B + 'oak_planks.png',
  trapdoor: B + 'oak_trapdoor.png',
  campfire: B + 'campfire_log_lit.png',
  campfire_side: B + 'campfire_log.png',
  iron_block: B + 'iron_block.png',
  gold_block: B + 'gold_block.png',
  diamond_block: B + 'diamond_block.png',
  lapis_ore: B + 'lapis_ore.png',
  lapis_block: B + 'lapis_block.png',
  enchant_top: B + 'enchanting_table_top.png',
  enchant_side: B + 'enchanting_table_side.png',
  enchant_bottom: B + 'enchanting_table_bottom.png',
  // 2.23: trzcina cukrowa w wanilii NIE jest barwiona biomem – plik w paczce
  // jest już zielony. Wcześniej nakładaliśmy na niego `GRASS_TINT` i w grze
  // była ciemniejsza niż w paczce.
  sugarcane: B + 'sugar_cane.png',
  path_top: B + 'dirt_path_top.png',
  path_side: B + 'dirt_path_side.png',
  hay_top: B + 'hay_block_top.png',
  hay_side: B + 'hay_block_side.png',
  // 2.20: `block/lantern.png` to atlas UV modelu (korpus + ramki), a nie
  // obrazek latarni – na sześcianie dawał czarną kostkę z żółtym środkiem.
  // Bierzemy ikonę z `item/`, która jest normalnym sprite'em.
  lantern: I_ + 'lantern.png',
  emerald_ore: B + 'emerald_ore.png',
  emerald_block: B + 'emerald_block.png',
  // 2.20: to samo co latarnia – ikona przedmiotu zamiast UV modelu.
  bell: I_ + 'bell.png',
  // 2.21: tekstury prawdziwych modeli (latarnia i dzwon przestały być
  // billboardami) – korpus latarni oraz złoty korpus dzwonu z tekstury encji.
  lantern_block: B + 'lantern.png',
  bell_body: E + 'bell/bell_body.png',
  redstone_ore: B + 'redstone_ore.png',
  redstone_block: B + 'redstone_block.png',
  redstone_torch: B + 'redstone_torch.png',
  redstone_torch_off: B + 'redstone_torch_off.png',
  redstone_lamp: B + 'redstone_lamp.png',
  redstone_lamp_on: B + 'redstone_lamp_on.png',
  lever: B + 'lever.png',
  piston_side: B + 'piston_side.png',
  piston_top: B + 'piston_top.png',
  piston_bottom: B + 'piston_bottom.png',
  sticky_piston_side: B + 'piston_side.png',
  slime: B + 'slime_block.png',
  observer_top: B + 'observer_top.png',
  observer_side: B + 'observer_side.png',
  observer_bottom: B + 'observer_back.png',
  dispenser_front: B + 'dispenser_front.png',
  dispenser_side: B + 'furnace_side.png',
  note_block: B + 'note_block.png',
  netherrack: B + 'netherrack.png',
  soul_sand: B + 'soul_sand.png',
  nether_bricks: B + 'nether_bricks.png',
  quartz_ore: B + 'nether_quartz_ore.png',
  quartz_block: B + 'quartz_block_side.png',
  quartz_pillar: B + 'quartz_pillar_side.png',
  quartz_chiseled: B + 'chiseled_quartz_block.png',
  magma: B + 'magma.png',
  end_stone: B + 'end_stone.png',
  end_bricks: B + 'end_stone_bricks.png',
  purpur_block: B + 'purpur_block.png',
  purpur_pillar: B + 'purpur_pillar_side.png',
  nether_portal: B + 'nether_portal.png',
  oak_stairs: B + 'oak_planks.png',
  cobble_stairs: B + 'cobblestone.png',
  concrete_white: B + 'white_concrete.png',
  concrete_red: B + 'red_concrete.png',
  concrete_blue: B + 'blue_concrete.png',
  concrete_green: B + 'green_concrete.png',
  concrete_yellow: B + 'yellow_concrete.png',
  concrete_black: B + 'black_concrete.png',
  terracotta: B + 'terracotta.png',
  rail: B + 'rail.png',
  powered_rail: B + 'powered_rail.png',
  detector_rail: B + 'detector_rail.png',
  anvil: B + 'anvil.png',
  brewing_top: B + 'brewing_stand.png',
  brewing_side: B + 'brewing_stand_base.png',
  shroomlight: B + 'shroomlight.png',
  basalt_top: B + 'basalt_top.png',
  basalt_side: B + 'basalt_side.png',
  blackstone: B + 'blackstone.png',
  soul_soil: B + 'soul_soil.png',
  crying_obsidian: B + 'crying_obsidian.png',
  target_top: B + 'target_top.png',
  target_side: B + 'target_side.png',
  honey_block: B + 'honey_block_side.png',
  honeycomb_block: B + 'honeycomb_block.png',
  mud: B + 'mud.png',
  acacia_side: B + 'acacia_log.png',
  acacia_top: B + 'acacia_log_top.png',
  jungle_leaves: { file: B + 'jungle_leaves.png', tint: FOLIAGE_TINT },
  lily_pad: { file: B + 'lily_pad.png', tint: GRASS_TINT },
  acacia_leaves: { file: B + 'acacia_leaves.png', tint: FOLIAGE_TINT },
};

// ---------------------------------------------------------------------------
// ikony przedmiotów (nazwy I z src/game/items.ts → pliki paczki 26.2)
// ---------------------------------------------------------------------------
const potion = (color) => ({ file: I_ + 'potion.png', overlay: I_ + 'potion_overlay.png', color });

const ITEM_ICONS = {
  stick: I_ + 'stick.png',
  coal: I_ + 'coal.png',
  iron: I_ + 'iron_ingot.png',
  gold: I_ + 'gold_ingot.png',
  diamond: I_ + 'diamond.png',
  gunpowder: I_ + 'gunpowder.png',
  seeds: I_ + 'wheat_seeds.png',
  wheat: I_ + 'wheat.png',
  apple: I_ + 'apple.png',
  bread: I_ + 'bread.png',
  raw_pork: I_ + 'porkchop.png',
  cooked_pork: I_ + 'cooked_porkchop.png',
  raw_beef: I_ + 'beef.png',
  cooked_beef: I_ + 'cooked_beef.png',
  raw_chicken: I_ + 'chicken.png',
  cooked_chicken: I_ + 'cooked_chicken.png',
  bucket: I_ + 'bucket.png',
  water_bucket: I_ + 'water_bucket.png',
  lava_bucket: I_ + 'lava_bucket.png',
  wood_pick: I_ + 'wooden_pickaxe.png',
  stone_pick: I_ + 'stone_pickaxe.png',
  iron_pick: I_ + 'iron_pickaxe.png',
  diamond_pick: I_ + 'diamond_pickaxe.png',
  wood_axe: I_ + 'wooden_axe.png',
  stone_axe: I_ + 'stone_axe.png',
  iron_axe: I_ + 'iron_axe.png',
  diamond_axe: I_ + 'diamond_axe.png',
  wood_shovel: I_ + 'wooden_shovel.png',
  stone_shovel: I_ + 'stone_shovel.png',
  iron_shovel: I_ + 'iron_shovel.png',
  diamond_shovel: I_ + 'diamond_shovel.png',
  wood_sword: I_ + 'wooden_sword.png',
  stone_sword: I_ + 'stone_sword.png',
  iron_sword: I_ + 'iron_sword.png',
  diamond_sword: I_ + 'diamond_sword.png',
  wood_hoe: I_ + 'wooden_hoe.png',
  stone_hoe: I_ + 'stone_hoe.png',
  iron_hoe: I_ + 'iron_hoe.png',
  diamond_hoe: I_ + 'diamond_hoe.png',
  flint: I_ + 'flint.png',
  shears: I_ + 'shears.png',
  flint_steel: I_ + 'flint_and_steel.png',
  compass: I_ + 'compass_00.png',
  clock: I_ + 'clock_00.png',
  string: I_ + 'string.png',
  bone: I_ + 'bone.png',
  feather: I_ + 'feather.png',
  arrow: I_ + 'arrow.png',
  bow: I_ + 'bow.png',
  lapis: I_ + 'lapis_lazuli.png',
  paper: I_ + 'paper.png',
  book: I_ + 'book.png',
  emerald: I_ + 'emerald.png',
  leather: I_ + 'leather.png',
  leather_helmet: I_ + 'leather_helmet.png',
  leather_chest: I_ + 'leather_chestplate.png',
  leather_legs: I_ + 'leather_leggings.png',
  leather_boots: I_ + 'leather_boots.png',
  iron_helmet: I_ + 'iron_helmet.png',
  iron_chest: I_ + 'iron_chestplate.png',
  iron_legs: I_ + 'iron_leggings.png',
  iron_boots: I_ + 'iron_boots.png',
  gold_helmet: I_ + 'golden_helmet.png',
  gold_chest: I_ + 'golden_chestplate.png',
  gold_legs: I_ + 'golden_leggings.png',
  gold_boots: I_ + 'golden_boots.png',
  diamond_helmet: I_ + 'diamond_helmet.png',
  diamond_chest: I_ + 'diamond_chestplate.png',
  diamond_legs: I_ + 'diamond_leggings.png',
  diamond_boots: I_ + 'diamond_boots.png',
  redstone: I_ + 'redstone.png',
  quartz: I_ + 'quartz.png',
  slime_ball: I_ + 'slime_ball.png',
  nether_brick_item: I_ + 'nether_brick.png',
  ender_pearl: I_ + 'ender_pearl.png',
  blaze_rod: I_ + 'blaze_rod.png',
  ghast_tear: I_ + 'ghast_tear.png',
  magma_cream: I_ + 'magma_cream.png',
  honeycomb: I_ + 'honeycomb.png',
  nether_wart: I_ + 'nether_wart.png',
  glowstone_dust: I_ + 'glowstone_dust.png',
  fishing_rod: I_ + 'fishing_rod.png',
  raw_fish: I_ + 'cod.png',
  cooked_fish: I_ + 'cooked_cod.png',
  raw_salmon: I_ + 'salmon.png',
  cooked_salmon: I_ + 'cooked_salmon.png',
  spyglass: I_ + 'spyglass.png',
  totem: I_ + 'totem_of_undying.png',
  sugar: I_ + 'sugar.png',
  bottle: I_ + 'glass_bottle.png',
  honey_bottle: I_ + 'honey_bottle.png',
  water_bottle: I_ + 'potion.png',
  // 2.23: w paczce nie ma `item/shield.png` – tarcza jest modelem 3D.
  // Bierzemy przednią ścianę tekstury tarczy (12×22 px) i wpasowujemy w ikonę.
  shield: { file: E + 'shield/shield_base_nopattern.png', crop: [1, 1, 12, 22], mask: 'shield', fit: [10, 16] },
  potion_awkward: potion([118, 142, 214]),
  potion_heal: potion([248, 36, 35]),
  potion_fire: potion([255, 153, 0]),
  potion_speed: potion([124, 175, 198]),
  potion_night: potion([31, 31, 161]),
  potion_strength: potion([147, 36, 35]),
  potion_regen: potion([205, 92, 171]),
};

// ---------------------------------------------------------------------------
// skórki graczy i palety mobów (entity/)
// ---------------------------------------------------------------------------
/** 2.19: wszystkie 9 domyślnych skórek Minecrafta – klasyczne i smukłe. */
const PLAYER_SKINS = {
  steve: { file: E + 'player/wide/steve.png', slim: false },
  alex: { file: E + 'player/slim/alex.png', slim: true },
  ari: { file: E + 'player/wide/ari.png', slim: false },
  efe: { file: E + 'player/slim/efe.png', slim: true },
  kai: { file: E + 'player/wide/kai.png', slim: false },
  makena: { file: E + 'player/wide/makena.png', slim: false },
  noor: { file: E + 'player/wide/noor.png', slim: false },
  sunny: { file: E + 'player/wide/sunny.png', slim: false },
  zuri: { file: E + 'player/wide/zuri.png', slim: false },
};

/** Tekstury mobów – z nich bierzemy paletę kolorów (kolory jak w paczce). */
const MOB_TEXTURES = {
  cow: E + 'cow/cow_temperate.png',
  pig: E + 'pig/pig_temperate.png',
  sheep: E + 'sheep/sheep.png',
  chicken: E + 'chicken/chicken_temperate.png',
  zombie: E + 'zombie/zombie.png',
  creeper: E + 'creeper/creeper.png',
  spider: E + 'spider/spider.png',
  skeleton: E + 'skeleton/skeleton.png',
  wolf: E + 'wolf/wolf.png',
  villager: E + 'villager/villager.png',
  golem: E + 'iron_golem/iron_golem.png',
  enderman: E + 'enderman/enderman.png',
  slime: E + 'slime/slime.png',
  ghast: E + 'ghast/ghast.png',
};

/**
 * Najczęstsze kolory tekstury (bez przezroczystych pikseli), zgrubione do
 * palety 4 bitów na kanał, żeby nie było setek odcieni antyaliasingu.
 */
function dominantColors(img, limit = 14) {
  const counts = new Map();
  for (let i = 0; i < img.w * img.h; i++) {
    if (img.data[i * 4 + 3] < 96) continue;
    const r = img.data[i * 4] & 0xf0, g = img.data[i * 4 + 1] & 0xf0, b = img.data[i * 4 + 2] & 0xf0;
    const key = (r << 16) | (g << 8) | b;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

const mobPalettes = {};
const missingMobs = [];
for (const [type, file] of Object.entries(MOB_TEXTURES)) {
  const img = loadTex(file);
  if (!img) {
    missingMobs.push(type);
    continue;
  }
  mobPalettes[type] = dominantColors(img, 14);
}

/**
 * Prostokąt twarzy w skórce: przód głowy plus warstwa czapki (2.19).
 * Kolejność: baza (8,8) i nakładka (40,8), obie 8×8.
 */
const FACE_RECTS = [
  [8, 8], [40, 8],
];

/** Kopiuje piksel z jednego obrazka na drugi (z mieszaniem alfa). */
function paste(dst, dw, dh, src, sx, sy, sw, sh, dx, dy) {
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < sw; x++) {
      const sx2 = sx + x, sy2 = sy + y, dx2 = dx + x, dy2 = dy + y;
      if (sx2 < 0 || sy2 < 0 || sx2 >= src.w || sy2 >= src.h || dx2 < 0 || dy2 < 0 || dx2 >= dw || dy2 >= dh) continue;
      const s = (sy2 * src.w + sx2) * 4, d = (dy2 * dw + dx2) * 4;
      const a = src.data[s + 3] / 255;
      if (a <= 0) continue;
      for (let c = 0; c < 3; c++) dst[d + c] = Math.round(src.data[s + c] * a + dst[d + c] * (1 - a));
      dst[d + 3] = Math.max(dst[d + 3], Math.round(a * 255));
    }
}

/**
 * Skórki graczy: PNG 64×64, twarz 8×8 (głowa + czapka) i portret 16×32
 * (przód postaci z warstwami ubrań) – podglądy w menu wyglądają jak w grze.
 */
const playerSkins = {};
const playerSlim = {};
const playerFaces = {};
const playerPortraits = {};
const PLAYER_LAYOUT = (slim) => ({
  head: [8, 8, 8],
  body: [20, 20, 8, 12],
  rightArm: [slim ? 43 : 44, 20, slim ? 3 : 4, 12],
  leftArm: [slim ? 35 : 36, 52, slim ? 3 : 4, 12],
  rightLeg: [4, 20, 4, 12],
  leftLeg: [20, 52, 4, 12],
  hat: [40, 8, 8, 8],
  jacket: [20, 36, 8, 12],
  rightSleeve: [slim ? 43 : 44, 36, slim ? 3 : 4, 12],
  leftSleeve: [slim ? 35 : 36, 52 + 0, slim ? 3 : 4, 12],
  rightPant: [4, 36, 4, 12],
  leftPant: [4, 52, 4, 12],
});
for (const [id, def] of Object.entries(PLAYER_SKINS)) {
  const img = loadTex(def.file);
  if (!img) continue;
  playerSkins[id] = { png: encodePNG(img.w, img.h, img.data).toString('base64'), w: img.w, h: img.h };
  playerSlim[id] = !!def.slim;

  // Twarz: głowa + czapka (nakładka z alfa).
  const face = new Uint8Array(8 * 8 * 4);
  paste(face, 8, 8, img, FACE_RECTS[0][0], FACE_RECTS[0][1], 8, 8, 0, 0);
  paste(face, 8, 8, img, FACE_RECTS[1][0], FACE_RECTS[1][1], 8, 8, 0, 0);
  playerFaces[id] = encodePNG(8, 8, face).toString('base64');

  // Portret 16×32: głowa, tułów, ręce i nogi z warstwami ubrań.
  const L = PLAYER_LAYOUT(def.slim);
  const p = new Uint8Array(16 * 32 * 4);
  paste(p, 16, 32, img, L.head[0], L.head[1], 8, 8, 4, 0);
  paste(p, 16, 32, img, L.hat[0], L.hat[1], 8, 8, 4, 0);
  paste(p, 16, 32, img, L.body[0], L.body[1], 8, 12, 4, 8);
  paste(p, 16, 32, img, L.jacket[0], L.jacket[1], 8, 12, 4, 8);
  paste(p, 16, 32, img, L.rightArm[0], L.rightArm[1], L.rightArm[2], 12, 0, 8);
  paste(p, 16, 32, img, L.leftArm[0], L.leftArm[1], L.leftArm[2], 12, 16 - L.leftArm[2], 8);
  paste(p, 16, 32, img, L.rightSleeve[0], L.rightSleeve[1], L.rightSleeve[2], 12, 0, 8);
  paste(p, 16, 32, img, L.leftSleeve[0], L.leftSleeve[1], L.leftSleeve[2], 12, 16 - L.leftSleeve[2], 8);
  // Spodnie i buty to ta sama warstwa co nogi – rysujemy je dwa razy dla porządku.
  paste(p, 16, 32, img, L.rightLeg[0], L.rightLeg[1], 4, 12, 4, 20);
  paste(p, 16, 32, img, L.leftLeg[0], L.leftLeg[1], 4, 12, 8, 20);
  paste(p, 16, 32, img, L.rightPant[0], L.rightPant[1], 4, 12, 4, 20);
  paste(p, 16, 32, img, L.leftPant[0], L.leftPant[1], 4, 12, 8, 20);
  playerPortraits[id] = encodePNG(16, 32, p).toString('base64');
}

// ---------------------------------------------------------------------------
// skórki mobów 1:1 – baza + warstwy (oczy, zawód mieszkańca, owcza wełna)
// ---------------------------------------------------------------------------

/** Nakłada kolejne warstwy (z alfa) na pierwszą teksturę. */
function composeLayers(files) {
  const imgs = files.map((f) => loadTex(f)).filter(Boolean);
  if (!imgs.length) return null;
  const w = Math.max(...imgs.map((i) => i.w));
  const h = Math.max(...imgs.map((i) => i.h));
  const data = new Uint8Array(w * h * 4);
  for (const img of imgs) {
    for (let y = 0; y < img.h; y++) {
      for (let x = 0; x < img.w; x++) {
        const s = (y * img.w + x) * 4;
        const d = (y * w + x) * 4;
        const a = img.data[s + 3] / 255;
        if (a <= 0) continue;
        for (let c = 0; c < 3; c++) data[d + c] = Math.round(img.data[s + c] * a + data[d + c] * (1 - a));
        data[d + 3] = Math.max(data[d + 3], Math.round(a * 255));
      }
    }
  }
  return { w, h, data };
}

// Zawody w grze (kolejność z `PROFESSIONS` w src/game/trading.ts) → tekstury.
const VILLAGER_PROFESSIONS = ['farmer', 'toolsmith', 'librarian', 'shepherd', 'mason'];
const MOB_SKIN_FILES = {
  pig: [E + 'pig/pig_temperate.png'],
  cow: [E + 'cow/cow_temperate.png'],
  sheep: [E + 'sheep/sheep.png'],
  sheep_wool: [E + 'sheep/sheep_wool.png'],
  chicken: [E + 'chicken/chicken_temperate.png'],
  // 2.23: warianty biomowe z 1.21.5+ (w 26.2 nadal aktualne) – krowa, świnia
  // i kura mają po trzy tekstury: umiarkowaną, ciepłą i zimną.
  cow_warm: [E + 'cow/cow_warm.png'],
  cow_cold: [E + 'cow/cow_cold.png'],
  pig_warm: [E + 'pig/pig_warm.png'],
  pig_cold: [E + 'pig/pig_cold.png'],
  chicken_warm: [E + 'chicken/chicken_warm.png'],
  chicken_cold: [E + 'chicken/chicken_cold.png'],
  creeper: [E + 'creeper/creeper.png'],
  zombie: [E + 'zombie/zombie.png'],
  skeleton: [E + 'skeleton/skeleton.png'],
  spider: [E + 'spider/spider.png', E + 'spider/spider_eyes.png'],
  wolf: [E + 'wolf/wolf.png'],
  golem: [E + 'iron_golem/iron_golem.png'],
  enderman: [E + 'enderman/enderman.png', E + 'enderman/enderman_eyes.png'],
  slime: [E + 'slime/slime.png'],
  ghast: [E + 'ghast/ghast.png'],
  ...Object.fromEntries(
    VILLAGER_PROFESSIONS.map((p, i) => [
      `villager${i}`,
      [E + 'villager/villager.png', E + 'villager/type/plains.png', E + `villager/profession/${p}.png`],
    ])
  ),
};
const mobSkins = {};
const missingSkins = [];
for (const [type, files] of Object.entries(MOB_SKIN_FILES)) {
  const img = composeLayers(files);
  if (!img) {
    missingSkins.push(type);
    continue;
  }
  mobSkins[type] = { png: encodePNG(img.w, img.h, img.data).toString('base64'), w: img.w, h: img.h };
}

// ---------------------------------------------------------------------------
// grafika interfejsu (serca, głód, hotbar, sloty, przyciski, niebo)
// ---------------------------------------------------------------------------
const GUI_FILES = {
  hotbar: 'gui/sprites/hud/hotbar.png',
  hotbar_selection: 'gui/sprites/hud/hotbar_selection.png',
  crosshair: 'gui/sprites/hud/crosshair.png',
  heart_full: 'gui/sprites/hud/heart/full.png',
  heart_half: 'gui/sprites/hud/heart/half.png',
  heart_container: 'gui/sprites/hud/heart/container.png',
  heart_poisoned: 'gui/sprites/hud/heart/poisoned_full.png',
  food_full: 'gui/sprites/hud/food_full.png',
  food_half: 'gui/sprites/hud/food_half.png',
  food_empty: 'gui/sprites/hud/food_empty.png',
  armor_full: 'gui/sprites/hud/armor_full.png',
  armor_half: 'gui/sprites/hud/armor_half.png',
  armor_empty: 'gui/sprites/hud/armor_empty.png',
  air: 'gui/sprites/hud/air.png',
  air_empty: 'gui/sprites/hud/air_empty.png',
  exp_background: 'gui/sprites/hud/experience_bar_background.png',
  exp_progress: 'gui/sprites/hud/experience_bar_progress.png',
  slot: 'gui/sprites/container/slot.png',
  button: 'gui/sprites/widget/button.png',
  button_highlighted: 'gui/sprites/widget/button_highlighted.png',
  button_disabled: 'gui/sprites/widget/button_disabled.png',
  // 2.27: okno handlu z mieszkańcem (`MerchantScreen`) – panel i wszystkie
  // jego widżety prosto z paczki 26.2.
  villager_gui: 'gui/container/villager.png',
  merchant_scroller: 'gui/sprites/container/villager/scroller.png',
  merchant_scroller_disabled: 'gui/sprites/container/villager/scroller_disabled.png',
  merchant_xp_bg: 'gui/sprites/container/villager/experience_bar_background.png',
  merchant_xp_current: 'gui/sprites/container/villager/experience_bar_current.png',
  merchant_out_of_stock: 'gui/sprites/container/villager/out_of_stock.png',
  merchant_arrow: 'gui/sprites/container/villager/trade_arrow.png',
  merchant_arrow_out: 'gui/sprites/container/villager/trade_arrow_out_of_stock.png',
  // 2.28: pozostałe okna 1:1 – kowadło, stół zaklęć, statyw alchemiczny, piec.
  anvil_gui: 'gui/container/anvil.png',
  anvil_error: 'gui/sprites/container/anvil/error.png',
  anvil_text_field: 'gui/sprites/container/anvil/text_field.png',
  anvil_text_field_disabled: 'gui/sprites/container/anvil/text_field_disabled.png',
  enchanting_gui: 'gui/container/enchanting_table.png',
  enchant_slot: 'gui/sprites/container/enchanting_table/enchantment_slot.png',
  enchant_slot_disabled: 'gui/sprites/container/enchanting_table/enchantment_slot_disabled.png',
  enchant_slot_highlighted: 'gui/sprites/container/enchanting_table/enchantment_slot_highlighted.png',
  enchant_level_1: 'gui/sprites/container/enchanting_table/level_1.png',
  enchant_level_1_disabled: 'gui/sprites/container/enchanting_table/level_1_disabled.png',
  enchant_level_2: 'gui/sprites/container/enchanting_table/level_2.png',
  enchant_level_2_disabled: 'gui/sprites/container/enchanting_table/level_2_disabled.png',
  enchant_level_3: 'gui/sprites/container/enchanting_table/level_3.png',
  enchant_level_3_disabled: 'gui/sprites/container/enchanting_table/level_3_disabled.png',
  brewing_gui: 'gui/container/brewing_stand.png',
  brewing_bubbles: 'gui/sprites/container/brewing_stand/bubbles.png',
  brewing_progress: 'gui/sprites/container/brewing_stand/brew_progress.png',
  brewing_fuel: 'gui/sprites/container/brewing_stand/fuel_length.png',
  furnace_gui: 'gui/container/furnace.png',
  furnace_lit: 'gui/sprites/container/furnace/lit_progress.png',
  furnace_burn: 'gui/sprites/container/furnace/burn_progress.png',
  sun: 'environment/celestial/sun.png',
  clouds: 'environment/clouds.png',
  rain: 'environment/rain.png',
  snow: 'environment/snow.png',
  particle_generic: 'particle/generic_0.png',
  particle_explosion: 'particle/explosion_0.png',
  particle_flame: 'particle/flame.png',
  particle_smoke: 'particle/big_smoke_0.png',
  particle_crit: 'particle/critical_hit.png',
  ...Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [`destroy_${i}`, `block/destroy_stage_${i}.png`])
  ),
};
/** Panele okien: faktyczny rozmiar panelu w lewym górnym rogu tekstury. */
const GUI_CROP = {
  villager_gui: [276, 166],
  anvil_gui: [176, 166],
  enchanting_gui: [176, 166],
  brewing_gui: [176, 166],
  furnace_gui: [176, 166],
};
const G = 'assets/minecraft/textures/';
const guiSprites = {};
const missingGui = [];
for (const [name, file] of Object.entries(GUI_FILES)) {
  const img = loadTex(G + file);
  if (!img) {
    missingGui.push(name);
    continue;
  }
  if (name === 'rain' || name === 'snow') {
    // Arkusz 64×256: cztery klatki 64×64 jedna pod drugą – bierzemy pierwszą.
    const w = img.w, h = Math.min(64, img.h);
    const out = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const s = (y * img.w + x) * 4;
      const d = (y * w + x) * 4;
      out[d] = img.data[s]; out[d + 1] = img.data[s + 1];
      out[d + 2] = img.data[s + 2]; out[d + 3] = img.data[s + 3];
    }
    guiSprites[name] = encodePNG(w, h, out).toString('base64');
    continue;
  }
  if (GUI_CROP[name]) {
    // 2.27/2.28: panele z paczki mają 256×256 (albo 512×256) z czarnym
    // marginesem – przycinamy do samego panelu, żeby w CSS obrazek
    // rozciągał się dokładnie na jego powierzchnię.
    const [cw, ch] = GUI_CROP[name];
    const out = new Uint8Array(cw * ch * 4);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const s = (y * img.w + x) * 4;
      const d = (y * cw + x) * 4;
      out[d] = img.data[s]; out[d + 1] = img.data[s + 1];
      out[d + 2] = img.data[s + 2]; out[d + 3] = img.data[s + 3];
    }
    guiSprites[name] = encodePNG(cw, ch, out).toString('base64');
    continue;
  }
  if (name === 'sun') {
    // 2.20: `sun.png` nie ma kanału alfa – tło jest czarne i w grze rysowało
    // się jako czarny kwadrat wokół tarczy. Kluczujemy czerń na przezroczystość.
    const out = keyBlackSprite(img.data, img.w, img.h);
    guiSprites[name] = encodePNG(img.w, img.h, out).toString('base64');
    continue;
  }
  if (name === 'clouds') {
    // `clouds.png` w paczce to maska 1-bitowa (czarne/tło i białe kłęby).
    // Do gry potrzebujemy białych chmur z przezroczystym tłem.
    const out = new Uint8Array(img.data);
    for (let i = 0; i < img.w * img.h; i++) {
      const on = out[i * 4] > 0 || out[i * 4 + 1] > 0 || out[i * 4 + 2] > 0;
      out[i * 4] = 255; out[i * 4 + 1] = 255; out[i * 4 + 2] = 255;
      out[i * 4 + 3] = on ? 255 : 0;
    }
    guiSprites[name] = encodePNG(img.w, img.h, out).toString('base64');
    continue;
  }
  guiSprites[name] = encodePNG(img.w, img.h, img.data).toString('base64');
}

// księżyc: paczka trzyma fazy w katalogu `environment/celestial/moon/`.
const moonImg = loadTex(G + 'environment/celestial/moon/full_moon.png');
if (moonImg) {
  const out = keyBlackSprite(moonImg.data, moonImg.w, moonImg.h);
  guiSprites.moon = encodePNG(moonImg.w, moonImg.h, out).toString('base64');
}
else missingGui.push('moon');

// ---------------------------------------------------------------------------
// identyfikatory z kodu gry (T i I)
// ---------------------------------------------------------------------------
function readIds(file, startMarker, endMarker, pattern) {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'game', file), 'utf8');
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, start);
  const body = src.slice(start, end);
  const map = {};
  for (const m of body.matchAll(pattern)) map[m[1]] = Number(m[2]);
  return map;
}
const T_IDS = readIds('blocks.ts', 'export const T = {', '} as const;', /([a-z0-9_]+):\s*(\d+)/g);
const I_IDS = readIds('items.ts', 'export const I = {', '} as const;', /([A-Z][A-Z0-9_]*):\s*(\d+)/g);

// ---------------------------------------------------------------------------
// atlas 256×256
// ---------------------------------------------------------------------------
const TILES = 16;
const ATLAS = TILE * TILES;

function stamp(atlas, index, tile) {
  const ox = (index % TILES) * TILE;
  const oy = Math.floor(index / TILES) * TILE;
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const s = (y * TILE + x) * 4;
      const d = ((oy + y) * ATLAS + ox + x) * 4;
      atlas[d] = tile[s]; atlas[d + 1] = tile[s + 1];
      atlas[d + 2] = tile[s + 2]; atlas[d + 3] = tile[s + 3];
    }
  }
}

const blockAtlas = new Uint8Array(ATLAS * ATLAS * 4);
const officialTiles = [];
const missingBlocks = [];
for (const [name, spec] of Object.entries(BLOCK_TILES)) {
  const index = T_IDS[name];
  if (index === undefined) {
    missingBlocks.push(`${name} (brak w T)`);
    continue;
  }
  const res = renderTile(spec);
  if (!res || res.missing) {
    missingBlocks.push(`${name} → ${res?.missing ?? '?'}`);
    continue;
  }
  stamp(blockAtlas, index, res.tile);
  officialTiles.push(index);
}
officialTiles.sort((a, b) => a - b);

const CHEST_TILES = chestTiles();
if (CHEST_TILES) {
  for (const [name, tile] of Object.entries({ chest_front: CHEST_TILES.front, chest_side: CHEST_TILES.side, chest_top: CHEST_TILES.top })) {
    const index = T_IDS[name];
    if (index === undefined) {
      missingBlocks.push(`${name} (brak w T)`);
      continue;
    }
    stamp(blockAtlas, index, tile);
    if (!officialTiles.includes(index)) officialTiles.push(index);
  }
  officialTiles.sort((a, b) => a - b);
} else {
  missingBlocks.push('chest (brak tekstury encji)');
}

// ---------------------------------------------------------------------------
// 2.21: skrzynia – trzy kafelki z prawdziwej tekstury encji (64×64).
//
// W paczce skrzynia nie jest blokiem z modelem JSON, tylko encją: tekstura
// `entity/chest/normal.png` ma rozłożone UV korpusu (0,19) i wieka (0,0).
// Składamy z niej widok przód/bok/góra w kafelki 16×16, a siatka bierze
// odpowiednie wycinki dla korpusu (10/16) i wieka (4/16).
// ---------------------------------------------------------------------------
function subImage(img, x, y, w, h) {
  const out = new Uint8Array(w * h * 4);
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < w; xx++) {
      const s = ((y + yy) * img.w + x + xx) * 4;
      const d = (yy * w + xx) * 4;
      for (let c = 0; c < 4; c++) out[d + c] = img.data[s + c];
    }
  return { w, h, data: out };
}

function blitScaled(dst, dstW, src, dx, dy, dw, dh) {
  for (let y = 0; y < dh; y++)
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(src.w - 1, Math.floor((x * src.w) / dw));
      const sy = Math.min(src.h - 1, Math.floor((y * src.h) / dh));
      const s = (sy * src.w + sx) * 4;
      const d = ((dy + y) * dstW + dx + x) * 4;
      for (let c = 0; c < 4; c++) dst[d + c] = src.data[s + c];
    }
}

function chestTiles() {
  const img = loadTex(E + 'chest/normal.png');
  if (!img) return null;
  const bodyFront = subImage(img, 14, 33, 14, 10);
  const lidFront = subImage(img, 14, 14, 14, 5);
  const bodySide = subImage(img, 0, 33, 14, 10);
  const lidSide = subImage(img, 0, 14, 14, 5);
  // UV encji: (28,0) to ZEWNĘTRZNA góra wieka, (14,0) to jej spód (ciemne
  // wnętrze). Wcześniej braliśmy wnętrze i skrzynia miała czarny „otwór”.
  const lidTop = subImage(img, 28, 0, 14, 14);
  const latch = subImage(img, 1, 1, 2, 4);
  const front = new Uint8Array(TILE * TILE * 4);
  const side = new Uint8Array(TILE * TILE * 4);
  const top = new Uint8Array(TILE * TILE * 4);
  blitScaled(front, TILE, bodyFront, 0, 5, 16, 11);
  blitScaled(front, TILE, lidFront, 0, 0, 16, 5);
  blitScaled(side, TILE, bodySide, 0, 5, 16, 11);
  blitScaled(side, TILE, lidSide, 0, 0, 16, 5);
  blitScaled(top, TILE, lidTop, 0, 0, 16, 16);
  // klamra na przodzie, na styku wieka i korpusu
  blitScaled(front, TILE, latch, 7, 3, 2, 3);
  return { front, side, top };
}

const itemAtlas = new Uint8Array(ATLAS * ATLAS * 4);
const itemTiles = {};
const missingItems = [];
let nextItemTile = 0;
for (const [name, spec] of Object.entries(ITEM_ICONS)) {
  const id = I_IDS[name.toUpperCase()];
  if (id === undefined) {
    missingItems.push(`${name} (brak w I)`);
    continue;
  }
  const s = typeof spec === 'string' ? { file: spec } : spec;
  // 2.23: ikony też mogą korzystać z `crop` i `mask` (tarcza jest wycinkiem
  // tekstury encji), więc przekazujemy cały opis zamiast tylko nazwy pliku.
  const res = renderTile({
    ...s,
    overlay: s.overlay ? { file: s.overlay, color: s.color ?? [255, 255, 255] } : undefined,
  });
  if (!res || res.missing) {
    missingItems.push(`${name} → ${res?.missing ?? '?'}`);
    continue;
  }
  if (nextItemTile >= TILES * TILES) throw new Error('za dużo ikon na jeden atlas');
  stamp(itemAtlas, nextItemTile, res.tile);
  itemTiles[id] = nextItemTile;
  nextItemTile++;
}

// ---------------------------------------------------------------------------
// podglądy
// ---------------------------------------------------------------------------
function preview(atlas, file) {
  const S = 4;
  const W = ATLAS * S, H = ATLAS * S;
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const s = (Math.floor(y / S) * ATLAS + Math.floor(x / S)) * 4;
      const d = (y * W + x) * 4;
      const a = atlas[s + 3] / 255;
      out[d] = atlas[s] * a + 30 * (1 - a);
      out[d + 1] = atlas[s + 1] * a + 32 * (1 - a);
      out[d + 2] = atlas[s + 2] * a + 38 * (1 - a);
      out[d + 3] = 255;
      if (x % (TILE * S) === 0 || y % (TILE * S) === 0) {
        out[d] = 200; out[d + 1] = 60; out[d + 2] = 60;
      }
    }
  }
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });
  fs.writeFileSync(path.join(PREVIEW_DIR, file), encodePNG(W, H, out));
}

// ---------------------------------------------------------------------------
// zapis modułu TS
// ---------------------------------------------------------------------------
const png64 = (atlas) => encodePNG(ATLAS, ATLAS, atlas).toString('base64');

const code = `/**
 * 2.17: grafika bloków i przedmiotów z paczki tekstur „26.2.x Template”.
 *
 * PLIK GENEROWANY – nie edytuj ręcznie. Skrypt: scripts/compile-vanilla-art.mjs
 * Źródło: ${zip ? path.basename(ZIP_FILE) : PACK_DIR}.
 * Tekstury trawy i liści są barwione kolorami z colormapy paczki
 * (grass ${GRASS_TINT.join(',')}, foliage ${FOLIAGE_TINT.join(',')}),
 * a animacje (woda, lawa, magma, portal) mają pierwszą klatkę.
 *
 * Oba atlasy to 256×256 px (16 × 16 kafelków po 16 px) w base64, żeby build
 * pozostał jednym plikiem HTML i działał offline.
 */

/** Atlas bloków: kafelek N leży w wierszu N/16, kolumnie N%16. */
export const BLOCK_ATLAS_PNG = 'data:image/png;base64,${png64(blockAtlas)}';

/** Kafelki, które naprawdę pochodzą z paczki (reszta to tekstury gry). */
export const OFFICIAL_TILES: readonly number[] = [${officialTiles.join(', ')}];

/** Atlas ikon przedmiotów – 16 × 16 kafelków. */
export const ITEM_ATLAS_PNG = 'data:image/png;base64,${png64(itemAtlas)}';

/** Identyfikator przedmiotu → indeks kafelka w atlasie ikon. */
export const ITEM_TILE: Readonly<Record<number, number>> = {${Object.entries(itemTiles)
  .map(([id, tile]) => `${id}: ${tile}`)
  .join(', ')}};

/** Skórki graczy wprost z paczki (64×64, układ waniliowy) jako PNG base64. */
export const PLAYER_SKIN_PNG: Readonly<Record<string, string>> = {${Object.entries(playerSkins)
  .map(([id, s2]) => `\n  ${id}: 'data:image/png;base64,${s2.png}',`)
  .join('')}
};

/** Smukłe skórki (Alex, Efe) – ręce mają 3 piksele szerokości. */
export const PLAYER_SKIN_SLIM: Readonly<Record<string, boolean>> = {${Object.entries(playerSlim)
  .map(([id, slim]) => `${id}: ${slim},`)
  .join(' ')}
};

/** Twarz 8×8 (głowa + czapka) do listy graczy i podglądów. */
export const PLAYER_FACE_PNG: Readonly<Record<string, string>> = {${Object.entries(playerFaces)
  .map(([id, png]) => `\n  ${id}: 'data:image/png;base64,${png}',`)
  .join('')}
};

/** Portret 16×32 – cała postać z ubraniem, do wyboru skórki. */
export const PLAYER_PORTRAIT_PNG: Readonly<Record<string, string>> = {${Object.entries(playerPortraits)
  .map(([id, png]) => `\n  ${id}: 'data:image/png;base64,${png}',`)
  .join('')}
};

/** Skórki mobów 1:1 (64×64 / 128×128 …) z paczki, gotowe do oklejenia modeli. */
export const MOB_SKINS: Readonly<Record<string, { readonly png: string; readonly w: number; readonly h: number }>> = {
${Object.entries(mobSkins)
  .map(([type, s2]) => `  ${type}: { w: ${s2.w}, h: ${s2.h}, png: 'data:image/png;base64,${s2.png}' },`)
  .join('\n')}
};

/** Grafika interfejsu i nieba z paczki (serca, hotbar, sloty, słońce…). */
export const GUI_SPRITES: Readonly<Record<string, string>> = {
${Object.entries(guiSprites)
  .map(([name, png]) => `  ${name}: 'data:image/png;base64,${png}',`)
  .join('\n')}
};

/** Palety mobów wyliczone z prawdziwych tekstur encji (najczęstsze kolory). */
export const MOB_PALETTES: Readonly<Record<string, readonly number[]>> = {${Object.entries(mobPalettes)
  .map(([type, cols]) => `\n  ${type}: [${cols.map((c) => '0x' + c.toString(16).padStart(6, '0')).join(', ')}],`)
  .join('')}
};

export const ART_CREDIT = 'Tekstury: paczka 26.2.x Template (Texture-Packs.com)';
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, code);
preview(blockAtlas, 'blocks.png');
preview(itemAtlas, 'items.png');

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} kB`;
console.log(`zapisano ${path.relative(ROOT, OUT)} (${kb(code)})`);
console.log(`kafelki bloków z paczki: ${officialTiles.length}/${Object.keys(T_IDS).length}`);
console.log(`ikony przedmiotów z paczki: ${nextItemTile}/${Object.keys(ITEM_IDS()).length}`);
console.log(`podglądy: .art-preview/blocks.png, .art-preview/items.png`);
console.log(`skórki graczy: ${Object.keys(playerSkins).length}, palety mobów: ${Object.keys(mobPalettes).length}`);
console.log(`skórki mobów 1:1: ${Object.keys(mobSkins).length}, grafika GUI: ${Object.keys(guiSprites).length}`);
if (missingSkins.length) console.log('brakujące skórki mobów:', missingSkins.join(', '));
if (missingGui.length) console.log('brakująca grafika GUI:', missingGui.join(', '));
if (missingMobs.length) console.log('brakujące moby:', missingMobs.join(', '));
if (missingBlocks.length) console.log('brakujące kafelki:', missingBlocks.join(', '));
if (missingItems.length) console.log('brakujące ikony:', missingItems.join(', '));

function ITEM_IDS() {
  return I_IDS;
}
