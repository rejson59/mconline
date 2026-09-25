import { T, BLOCKS, RENDER, tileFor } from './blocks';
import { mulberry32 } from './noise';

export const TILE = 16;
export const ATLAS_TILES = 16; // tiles per row
export const ATLAS_SIZE = TILE * ATLAS_TILES;

type RGB = [number, number, number];

let img: ImageData;

function setPx(tile: number, x: number, y: number, r: number, g: number, b: number, a = 255) {
  if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
  const tx = (tile % ATLAS_TILES) * TILE + x;
  const ty = Math.floor(tile / ATLAS_TILES) * TILE + y;
  const i = (ty * ATLAS_SIZE + tx) * 4;
  img.data[i] = r;
  img.data[i + 1] = g;
  img.data[i + 2] = b;
  img.data[i + 3] = a;
}
function getPx(tile: number, x: number, y: number): [number, number, number, number] {
  const tx = (tile % ATLAS_TILES) * TILE + x;
  const ty = Math.floor(tile / ATLAS_TILES) * TILE + y;
  const i = (ty * ATLAS_SIZE + tx) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

function shade(c: RGB, f: number): RGB {
  return [c[0] * f, c[1] * f, c[2] * f];
}

function noiseFill(tile: number, base: RGB, variance: number, rand: () => number, alpha = 255) {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const f = 1 + (rand() - 0.5) * variance;
      const c = shade(base, f);
      setPx(tile, x, y, c[0], c[1], c[2], alpha);
    }
}

function copyTile(from: number, to: number) {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const p = getPx(from, x, y);
      setPx(to, x, y, p[0], p[1], p[2], p[3]);
    }
}

function voronoi(tile: number, rand: () => number, n: number, colorFn: (cell: number, edge: boolean) => RGB) {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) pts.push([rand() * 16, rand() * 16]);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      let d1 = 1e9, d2 = 1e9, c = 0;
      for (let i = 0; i < n; i++) {
        for (let ox = -16; ox <= 16; ox += 16)
          for (let oy = -16; oy <= 16; oy += 16) {
            const dx = x + 0.5 - (pts[i][0] + ox);
            const dy = y + 0.5 - (pts[i][1] + oy);
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < d1) { d2 = d1; d1 = d; c = i; }
            else if (d < d2) d2 = d;
          }
      }
      const col = colorFn(c, d2 - d1 < 1.1);
      setPx(tile, x, y, col[0], col[1], col[2]);
    }
}

function ore(tile: number, color: RGB, rand: () => number) {
  copyTile(T.stone, tile);
  const clusters = 4 + Math.floor(rand() * 2);
  for (let c = 0; c < clusters; c++) {
    const cx = 2 + Math.floor(rand() * 12);
    const cy = 2 + Math.floor(rand() * 12);
    const n = 3 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const x = cx + Math.floor(rand() * 3) - 1;
      const y = cy + Math.floor(rand() * 3) - 1;
      const f = 0.8 + rand() * 0.4;
      setPx(tile, x, y, color[0] * f, color[1] * f, color[2] * f);
    }
  }
}

function logTop(tile: number, light: RGB, dark: RGB, bark: RGB, rand: () => number) {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const dx = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      let c: RGB;
      if (dx > 6.5) c = bark;
      else c = Math.floor(dx) % 2 === 0 ? light : dark;
      c = shade(c, 0.92 + rand() * 0.16);
      setPx(tile, x, y, c[0], c[1], c[2]);
    }
}

function wool(tile: number, base: RGB, rand: () => number) {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const pattern = ((x + y) % 4 === 0 ? 0.93 : 1) * (0.94 + rand() * 0.12);
      const c = shade(base, pattern);
      setPx(tile, x, y, c[0], c[1], c[2]);
    }
}

function leaves(tile: number, base: RGB, rand: () => number) {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const r = rand();
      if (r < 0.18) { setPx(tile, x, y, 0, 0, 0, 0); continue; }
      const c = shade(base, 0.7 + rand() * 0.55);
      setPx(tile, x, y, c[0], c[1], c[2]);
    }
}

function plant(tile: number, rand: () => number, flower?: RGB) {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) setPx(tile, x, y, 0, 0, 0, 0);
  if (!flower) {
    for (let i = 0; i < 9; i++) {
      let x = 1 + Math.floor(rand() * 14);
      const h = 5 + Math.floor(rand() * 10);
      for (let j = 0; j < h; j++) {
        const c = shade([70, 150, 45], 0.7 + rand() * 0.5);
        setPx(tile, x, 15 - j, c[0], c[1], c[2]);
        if (rand() < 0.15) x += rand() < 0.5 ? -1 : 1;
      }
    }
  } else {
    for (let j = 0; j < 9; j++) setPx(tile, 7, 15 - j, 50, 130, 30);
    setPx(tile, 6, 11, 60, 150, 40); setPx(tile, 5, 10, 60, 150, 40);
    setPx(tile, 8, 12, 60, 150, 40); setPx(tile, 9, 11, 60, 150, 40);
    const pts = [[7, 3], [6, 4], [8, 4], [7, 5], [6, 5], [8, 5], [5, 4], [9, 4], [7, 4], [6, 3], [8, 3], [7, 6]];
    for (const [x, y] of pts) {
      const c = shade(flower, 0.85 + rand() * 0.3);
      setPx(tile, x, y, c[0], c[1], c[2]);
    }
    setPx(tile, 7, 4, 60, 40, 20);
  }
}

function bricksPattern(tile: number, brick: RGB, mortar: RGB, bw: number, bh: number, rand: () => number) {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const row = Math.floor(y / bh);
      const off = row % 2 === 0 ? 0 : bw / 2;
      const isMortar = y % bh === bh - 1 || (x + off) % bw === bw - 1;
      const c = shade(isMortar ? mortar : brick, 0.88 + rand() * 0.24);
      setPx(tile, x, y, c[0], c[1], c[2]);
    }
}

// average colors per block (for particles)
export const AVG_COLOR: RGB[] = [];

export interface AtlasResult {
  canvas: HTMLCanvasElement;
  icons: Record<number, string>;
  cracks: HTMLCanvasElement[];
}

export function buildAtlas(): AtlasResult {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d')!;
  img = ctx.createImageData(ATLAS_SIZE, ATLAS_SIZE);
  const R = (s: number) => mulberry32(s * 7919 + 13);

  // Dirt
  { const r = R(2); noiseFill(T.dirt, [134, 96, 67], 0.3, r);
    for (let i = 0; i < 14; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16); setPx(T.dirt, x, y, 100, 70, 48); }
    for (let i = 0; i < 6; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16); setPx(T.dirt, x, y, 160, 125, 95); } }
  // Grass top
  { const r = R(1); noiseFill(T.grass_top, [96, 160, 56], 0.35, r); }
  // Grass side
  { const r = R(3); copyTile(T.dirt, T.grass_side);
    for (let x = 0; x < 16; x++) { const h = 3 + Math.floor(r() * 3) - (r() < 0.2 ? 1 : 0) + (r() < 0.25 ? 2 : 0);
      for (let y = 0; y < h; y++) { const c = shade([96, 160, 56], 0.8 + r() * 0.35); setPx(T.grass_side, x, y, c[0], c[1], c[2]); } } }
  // Stone
  { const r = R(4); noiseFill(T.stone, [127, 127, 127], 0.18, r);
    for (let i = 0; i < 10; i++) { const x = Math.floor(r() * 15), y = Math.floor(r() * 16); setPx(T.stone, x, y, 105, 105, 105); setPx(T.stone, x + 1, y, 110, 110, 110); }
    for (let i = 0; i < 8; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16); setPx(T.stone, x, y, 145, 145, 145); } }
  // Cobble
  { const r = R(5); const shades = Array.from({ length: 12 }, () => 95 + r() * 60);
    voronoi(T.cobble, r, 9, (c, e) => { const s = e ? 60 : shades[c] * (0.92 + r() * 0.16); return [s, s, s]; }); }
  // Log side
  { const r = R(6); const cols = Array.from({ length: 16 }, () => 0.8 + r() * 0.3);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = shade([104, 82, 50], cols[x] * (0.92 + r() * 0.14) * (x % 4 === 0 ? 0.8 : 1)); setPx(T.log_side, x, y, c[0], c[1], c[2]); } }
  logTop(T.log_top, [182, 146, 92], [150, 118, 72], [104, 82, 50], R(7));
  leaves(T.leaves, [60, 128, 30], R(8));
  // Planks
  { const r = R(9); for (let y = 0; y < 16; y++) { const board = Math.floor(y / 4); const seam = (board * 7 + 3) % 16;
      for (let x = 0; x < 16; x++) { let f = 0.9 + r() * 0.15; if (y % 4 === 3) f = 0.68; if (x === seam && y % 4 !== 3) f *= 0.75;
        const c = shade([164, 132, 80], f); setPx(T.planks, x, y, c[0], c[1], c[2]); } } }
  { const r = R(10); noiseFill(T.sand, [219, 206, 160], 0.12, r); }
  // Water
  { const r = R(11); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const w = Math.sin((x + y * 0.5) * 0.8) * 0.08 + (r() - 0.5) * 0.1;
      const c = shade([48, 92, 215], 1 + w); setPx(T.water, x, y, c[0], c[1], c[2], 175); } }
  // Glass
  { const r = R(12); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const border = x === 0 || y === 0 || x === 15 || y === 15;
      if (border) setPx(T.glass, x, y, 200 + r() * 30, 225 + r() * 20, 235, 255);
      else if ((x - y === 3 || x - y === 4) && x < 9) setPx(T.glass, x, y, 255, 255, 255, 180);
      else setPx(T.glass, x, y, 0, 0, 0, 0); } }
  { const r = R(13); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const s = 30 + r() * 90; setPx(T.bedrock, x, y, s, s, s); } }
  { const r = R(14); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const t = r(); const s = 90 + r() * 70;
      if (t < 0.3) setPx(T.gravel, x, y, s * 0.9, s * 0.8, s * 0.75); else setPx(T.gravel, x, y, s, s * 0.97, s * 0.95); } }
  ore(T.coal_ore, [30, 30, 30], R(15));
  ore(T.iron_ore, [216, 175, 147], R(16));
  ore(T.gold_ore, [252, 238, 75], R(17));
  ore(T.diamond_ore, [93, 236, 245], R(18));
  bricksPattern(T.brick, [150, 72, 56], [175, 170, 160], 8, 4, R(19));
  { const r = R(20); noiseFill(T.snow, [240, 250, 252], 0.06, r); }
  { const r = R(21); copyTile(T.dirt, T.snow_side);
    for (let x = 0; x < 16; x++) { const h = 3 + Math.floor(r() * 3); for (let y = 0; y < h; y++) { const c = shade([240, 250, 252], 0.94 + r() * 0.06); setPx(T.snow_side, x, y, c[0], c[1], c[2]); } } }
  // Cactus
  { const r = R(22); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c: RGB = shade([20, 120, 35], 0.85 + r() * 0.25); if (x === 0 || x === 15) c = [10, 70, 20]; if (x % 4 === 2) c = shade(c, 0.8);
      setPx(T.cactus_side, x, y, c[0], c[1], c[2]); }
    for (let i = 0; i < 10; i++) setPx(T.cactus_side, 1 + Math.floor(r() * 14), Math.floor(r() * 16), 230, 230, 200); }
  { const r = R(23); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      const c: RGB = shade(d > 6.5 ? [10, 70, 20] : d > 4 ? [30, 140, 45] : [60, 160, 70], 0.9 + r() * 0.2); setPx(T.cactus_top, x, y, c[0], c[1], c[2]); } }
  // Birch
  { const r = R(24); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = shade([216, 215, 205], 0.92 + r() * 0.1); setPx(T.birch_side, x, y, c[0], c[1], c[2]); }
    for (let i = 0; i < 7; i++) { const y = Math.floor(r() * 16), x = Math.floor(r() * 12), l = 2 + Math.floor(r() * 4); for (let j = 0; j < l; j++) setPx(T.birch_side, x + j, y, 40, 40, 35); } }
  logTop(T.birch_top, [210, 190, 140], [185, 165, 115], [216, 215, 205], R(25));
  leaves(T.birch_leaves, [110, 150, 65], R(26));
  // TNT
  { const r = R(27); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c: RGB = shade([205, 55, 35], (x % 4 === 0 ? 0.8 : 1) * (0.9 + r() * 0.15));
      if (y >= 5 && y <= 10) c = [235, 235, 230];
      setPx(T.tnt_side, x, y, c[0], c[1], c[2]); }
    const letters = ['111', '010', '010', '010'];
    const N = ['101', '111', '111', '101'];
    const draw = (pat: string[], ox: number) => pat.forEach((row, yy) => row.split('').forEach((ch, xx) => { if (ch === '1') setPx(T.tnt_side, ox + xx, 6 + yy, 20, 20, 20); }));
    draw(letters, 2); draw(N, 7); draw(letters, 11); }
  { const r = R(28); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      const c: RGB = d < 2.5 ? [80, 80, 80] : shade([205, 55, 35], 0.9 + r() * 0.15); setPx(T.tnt_top, x, y, c[0], c[1], c[2]); }
    setPx(T.tnt_top, 7, 7, 40, 40, 40); setPx(T.tnt_top, 8, 8, 40, 40, 40); }
  { const r = R(29); noiseFill(T.tnt_bottom, [170, 45, 30], 0.2, r); }
  // Glowstone
  { const r = R(30); voronoi(T.glowstone, r, 10, (c, e) => e ? [140, 90, 40] : shade([250, 210, 110], 0.85 + ((c * 37) % 10) / 40 + r() * 0.1)); }
  // Bookshelf
  { const r = R(31); copyTile(T.planks, T.bookshelf);
    for (const row of [1, 9]) { let x = 1; while (x < 15) { const w = 1 + Math.floor(r() * 2); const col: RGB = [[140, 30, 30], [30, 60, 140], [40, 110, 40], [150, 120, 40], [90, 40, 110]][Math.floor(r() * 5)] as RGB;
        const h = 5 + Math.floor(r() * 2);
        for (let xx = x; xx < Math.min(15, x + w); xx++) for (let y = row + 6 - h; y < row + 6; y++) { const c = shade(col, 0.85 + r() * 0.2); setPx(T.bookshelf, xx, y + 1, c[0], c[1], c[2]); }
        x += w; } } }
  wool(T.wool_white, [233, 236, 236], R(32));
  wool(T.wool_red, [160, 39, 34], R(33));
  wool(T.wool_blue, [53, 57, 157], R(43));
  wool(T.wool_green, [84, 109, 27], R(44));
  wool(T.wool_yellow, [248, 197, 39], R(45));
  wool(T.wool_black, [25, 25, 30], R(46));
  // Crafting table
  { copyTile(T.planks, T.crafting_top);
    for (let i = 0; i < 16; i++) { setPx(T.crafting_top, i, 0, 90, 60, 35); setPx(T.crafting_top, i, 15, 90, 60, 35); setPx(T.crafting_top, 0, i, 90, 60, 35); setPx(T.crafting_top, 15, i, 90, 60, 35); }
    for (let i = 2; i < 14; i++) { setPx(T.crafting_top, i, 7, 110, 80, 45); setPx(T.crafting_top, 7, i, 110, 80, 45); } }
  { copyTile(T.planks, T.crafting_side);
    for (let x = 0; x < 16; x++) for (let y = 0; y < 3; y++) setPx(T.crafting_side, x, y, 100, 70, 40);
    for (let y = 5; y < 12; y++) setPx(T.crafting_side, 4, y, 120, 120, 125);
    for (let x = 3; x < 6; x++) setPx(T.crafting_side, x, 5, 150, 150, 155);
    for (let y = 6; y < 13; y++) setPx(T.crafting_side, 11, y, 90, 60, 30);
    for (let x = 9; x < 14; x++) setPx(T.crafting_side, x, 6, 140, 140, 145); }
  // Furnace
  { const r = R(36); noiseFill(T.furnace_side, [120, 120, 120], 0.15, r);
    for (let i = 0; i < 16; i++) { setPx(T.furnace_side, i, 0, 90, 90, 90); setPx(T.furnace_side, i, 15, 90, 90, 90); } }
  { copyTile(T.furnace_side, T.furnace_front);
    for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x++) setPx(T.furnace_front, x, y, 30, 25, 25);
    for (let x = 4; x < 12; x++) setPx(T.furnace_front, x, 13, 200, 90, 30);
    for (let x = 3; x < 13; x++) setPx(T.furnace_front, x, 4, 70, 70, 70); }
  { const r = R(37); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const t = r();
      const c: RGB = t < 0.15 ? [60, 40, 90] : shade([20, 16, 32], 0.7 + r() * 0.6); setPx(T.obsidian, x, y, c[0], c[1], c[2]); } }
  bricksPattern(T.stone_bricks, [125, 125, 125], [80, 80, 80], 16, 8, R(38));
  { const r = R(39); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const streak = (x + y) % 7 === 0 ? 1.15 : 1; const c = shade([150, 185, 250], streak * (0.95 + r() * 0.1)); setPx(T.ice, x, y, c[0], c[1], c[2], 200); } }
  plant(T.tallgrass, R(40));
  plant(T.flower_red, R(41), [220, 30, 30]);
  plant(T.flower_yellow, R(42), [250, 225, 40]);
  // Lava
  { const r = R(47); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const w = Math.sin(x * 0.9 + Math.cos(y * 0.7) * 2) * 0.5 + 0.5; const c: RGB = [230 + w * 25, 90 + w * 110 + r() * 20, 10 + w * 30]; setPx(T.lava, x, y, c[0], c[1], c[2], 255); } }
  // Sandstone
  { const r = R(48); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let f = 0.95 + r() * 0.08; if (y < 3) f *= 1.05; if (y === 3 || y === 11) f *= 0.85; const c = shade([216, 202, 150], f); setPx(T.sandstone_side, x, y, c[0], c[1], c[2]); } }
  { const r = R(49); noiseFill(T.sandstone_top, [222, 208, 158], 0.08, r); }
  // Pumpkin
  { const r = R(50); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const c = shade([220, 130, 25], (x % 4 === 0 ? 0.75 : 1) * (0.9 + r() * 0.15)); setPx(T.pumpkin_side, x, y, c[0], c[1], c[2]); } }
  { const r = R(51); noiseFill(T.pumpkin_top, [200, 120, 25], 0.2, r);
    for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) setPx(T.pumpkin_top, x, y, 90, 70, 30); }
  { copyTile(T.pumpkin_side, T.pumpkin_face);
    const face = [[3, 4], [4, 4], [3, 5], [4, 5], [11, 4], [12, 4], [11, 5], [12, 5], [7, 7], [8, 7]];
    for (const [x, y] of face) setPx(T.pumpkin_face, x, y, 40, 25, 5);
    for (let x = 3; x < 13; x++) setPx(T.pumpkin_face, x, 10, 40, 25, 5);
    for (let x = 4; x < 12; x++) setPx(T.pumpkin_face, x, 11, 40, 25, 5); }
  // Mossy cobble
  { const r = R(53); copyTile(T.cobble, T.mossy); for (let i = 0; i < 80; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16);
      const p = getPx(T.mossy, x, y); if (p[0] > 70) setPx(T.mossy, x, y, 70 + r() * 30, 120 + r() * 30, 50); } }
  { const r = R(54); noiseFill(T.clay, [160, 166, 180], 0.08, r); }

  // Torch, saplings, crops, farmland, bed, lit furnace – transparent where noted.
  const clear = (tile: number) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) setPx(tile, x, y, 0, 0, 0, 0); };
  clear(T.torch);
  for (let y = 7; y < 15; y++) { setPx(T.torch, 7, y, 92, 64, 36); setPx(T.torch, 8, y, 70, 48, 26); }
  for (const [x, y, c] of [[6, 3, [255, 230, 80]], [7, 2, [255, 250, 180]], [7, 3, [255, 180, 40]], [8, 3, [255, 210, 50]], [7, 4, [255, 140, 30]], [8, 4, [230, 90, 20]], [9, 4, [255, 200, 60]], [5, 4, [255, 190, 40]], [7, 5, [200, 70, 20]]] as [number, number, RGB][]) {
    setPx(T.torch, x, y, c[0], c[1], c[2]);
  }
  clear(T.sapling);
  for (let y = 8; y < 15; y++) setPx(T.sapling, 8, y, 90, 62, 34);
  for (const [x, y] of [[6, 4], [7, 4], [8, 4], [9, 4], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [7, 3], [8, 3], [8, 6], [6, 6], [9, 6]]) setPx(T.sapling, x, y, 46, 120, 36);
  clear(T.birch_sapling);
  for (let y = 8; y < 15; y++) setPx(T.birch_sapling, 8, y, 210, 208, 196);
  for (const [x, y] of [[6, 4], [7, 4], [8, 4], [9, 4], [6, 5], [7, 5], [8, 5], [9, 5], [7, 3], [8, 3], [8, 6]]) setPx(T.birch_sapling, x, y, 130, 170, 70);
  { const r = R(58); copyTile(T.dirt, T.farmland);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const wet = shade([78, 52, 28], 0.85 + r() * 0.2);
      if (y < 5 || (x + y) % 5 === 0) setPx(T.farmland, x, y, wet[0], wet[1], wet[2]);
    }
  }
  const wheat = (tile: number, h: number, gold: boolean) => {
    clear(tile);
    for (let i = 0; i < 5; i++) {
      const x = 2 + i * 3;
      for (let y = 0; y < h; y++) setPx(tile, x, 15 - y, gold ? 210 : 70, gold ? 180 : 140, gold ? 40 : 36);
      if (h > 6) { setPx(tile, x - 1, 15 - h, gold ? 230 : 80, gold ? 190 : 150, gold ? 50 : 40); setPx(tile, x + 1, 16 - h, gold ? 230 : 80, gold ? 190 : 150, gold ? 50 : 40); }
    }
  };
  wheat(T.wheat0, 4, false);
  wheat(T.wheat1, 8, false);
  wheat(T.wheat2, 12, false);
  wheat(T.wheat3, 14, true);
  { const r = R(63); wool(T.bed_top, [170, 40, 40], r);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 16; x++) setPx(T.bed_top, x, y, 236, 236, 236);
    for (let x = 0; x < 16; x++) setPx(T.bed_top, x, 5, 180, 180, 180);
  }
  { const r = R(64); copyTile(T.planks, T.bed_side);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) { const c = shade([170, 40, 40], 0.9 + r() * 0.15); setPx(T.bed_side, x, y, c[0], c[1], c[2]); }
    for (let x = 0; x < 5; x++) for (let y = 1; y < 6; y++) setPx(T.bed_side, x, y, 236, 236, 236);
  }
  { copyTile(T.furnace_front, T.furnace_lit);
    for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x++) setPx(T.furnace_lit, x, y, y > 11 ? 255 : 255, y > 11 ? 180 : 90, 20);
    setPx(T.furnace_lit, 6, 10, 255, 240, 140); setPx(T.furnace_lit, 8, 9, 255, 220, 80);
  }

  // Home update: chest, door, ladder, fence, trapdoor, campfire.
  { const r = R(66); noiseFill(T.chest_side, [122, 78, 42], 0.12, r);
    for (let x = 0; x < 16; x++) { setPx(T.chest_side, x, 0, 78, 48, 26); setPx(T.chest_side, x, 15, 70, 42, 22); }
  }
  { copyTile(T.chest_side, T.chest_top);
    for (let x = 1; x < 15; x++) setPx(T.chest_top, x, 7, 86, 54, 28);
    for (let y = 2; y < 14; y++) { setPx(T.chest_top, 1, y, 86, 54, 28); setPx(T.chest_top, 14, y, 86, 54, 28); }
  }
  { copyTile(T.chest_side, T.chest_front);
    for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) setPx(T.chest_front, x, y, 196, 164, 48);
    setPx(T.chest_front, 7, 8, 90, 60, 20);
    setPx(T.chest_front, 8, 8, 90, 60, 20);
    for (let x = 0; x < 16; x++) { setPx(T.chest_front, x, 0, 70, 42, 22); setPx(T.chest_front, x, 15, 70, 42, 22); }
  }
  { const r = R(69); noiseFill(T.door, [138, 88, 48], 0.1, r);
    for (let y = 0; y < 16; y++) { setPx(T.door, 0, y, 78, 48, 26); setPx(T.door, 15, y, 78, 48, 26); setPx(T.door, 1, y, 96, 60, 32); }
    for (let x = 0; x < 16; x++) { setPx(T.door, x, 0, 78, 48, 26); setPx(T.door, x, 15, 78, 48, 26); }
    for (let y = 6; y < 11; y++) setPx(T.door, 12, y, 210, 176, 52);
    setPx(T.door, 11, 8, 210, 176, 52);
  }
  { copyTile(T.door, T.door_top);
    for (let y = 3; y < 10; y++) for (let x = 4; x < 12; x++) setPx(T.door_top, x, y, 150, 196, 214);
    for (let y = 3; y < 10; y++) { setPx(T.door_top, 4, y, 70, 90, 100); setPx(T.door_top, 11, y, 70, 90, 100); }
    for (let x = 4; x < 12; x++) { setPx(T.door_top, x, 3, 70, 90, 100); setPx(T.door_top, x, 9, 70, 90, 100); }
  }
  clear(T.ladder);
  for (let y = 0; y < 16; y++) { setPx(T.ladder, 3, y, 120, 78, 40); setPx(T.ladder, 12, y, 96, 60, 30); }
  for (let y = 1; y < 16; y += 3) for (let x = 3; x <= 12; x++) setPx(T.ladder, x, y, 140, 92, 48);
  clear(T.fence);
  for (let y = 0; y < 16; y++) { setPx(T.fence, 2, y, 150, 98, 52); setPx(T.fence, 3, y, 120, 76, 40); setPx(T.fence, 12, y, 150, 98, 52); setPx(T.fence, 13, y, 110, 70, 36); }
  for (let x = 2; x <= 13; x++) { setPx(T.fence, x, 4, 150, 98, 52); setPx(T.fence, x, 5, 110, 70, 36); setPx(T.fence, x, 10, 150, 98, 52); setPx(T.fence, x, 11, 110, 70, 36); }
  { const r = R(73); noiseFill(T.trapdoor, [146, 96, 50], 0.1, r);
    for (let x = 0; x < 16; x++) { setPx(T.trapdoor, x, 0, 86, 54, 28); setPx(T.trapdoor, x, 15, 86, 54, 28); }
    for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) setPx(T.trapdoor, x, y, 96, 62, 32);
    for (let y = 6; y < 10; y++) setPx(T.trapdoor, 8, y, 210, 176, 52);
  }
  { const r = R(75); noiseFill(T.campfire_side, [92, 58, 32], 0.14, r);
    for (let y = 10; y < 16; y++) for (let x = 0; x < 16; x++) setPx(T.campfire_side, x, y, 48, 32, 22);
  }
  { const r = R(74); noiseFill(T.campfire, [62, 40, 24], 0.16, r);
    for (let x = 2; x < 14; x++) { setPx(T.campfire, x, 4, 110, 68, 34); setPx(T.campfire, x, 11, 90, 54, 28); }
    for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) setPx(T.campfire, x, y, y < 8 ? 255 : 220, y < 8 ? 150 : 70, 20);
    setPx(T.campfire, 7, 6, 255, 240, 140);
    setPx(T.campfire, 8, 7, 255, 220, 80);
  }

  ctx.putImageData(img, 0, 0);

  // average colors
  for (const d of BLOCKS) {
    if (!d) continue;
    const t = d.side;
    let rr = 0, gg = 0, bb = 0, n = 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const p = getPx(t, x, y); if (p[3] > 0) { rr += p[0]; gg += p[1]; bb += p[2]; n++; } }
    AVG_COLOR[d.id] = n ? [rr / n, gg / n, bb / n] : [128, 128, 128];
  }

  // Icons
  const icons: Record<number, string> = {};
  for (const d of BLOCKS) {
    if (!d || d.id === 0) continue;
    icons[d.id] = makeIcon(canvas, d.id);
  }

  // Cracks
  const cracks: HTMLCanvasElement[] = [];
  const cr = mulberry32(999);
  const crackPts: [number, number][] = [];
  for (let i = 0; i < 160; i++) crackPts.push([Math.floor(cr() * 16), Math.floor(cr() * 16)]);
  for (let s = 0; s < 10; s++) {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const cx = c.getContext('2d')!;
    cx.fillStyle = 'rgba(0,0,0,0.75)';
    // random-walk cracks from center
    const wr = mulberry32(42);
    const lines = 2 + s;
    for (let l = 0; l < lines; l++) {
      let x = 8, y = 8;
      const len = 3 + s * 1.2;
      for (let k = 0; k < len; k++) {
        cx.fillRect(x, y, 1, 1);
        x += Math.floor(wr() * 3) - 1;
        y += Math.floor(wr() * 3) - 1;
        x = Math.max(0, Math.min(15, x)); y = Math.max(0, Math.min(15, y));
      }
    }
    for (let i = 0; i < s * 6; i++) cx.fillRect(crackPts[i][0], crackPts[i][1], 1, 1);
    cracks.push(c);
  }

  return { canvas, icons, cracks };
}

function makeIcon(atlas: HTMLCanvasElement, id: number): string {
  const c = document.createElement('canvas');
  c.width = 48; c.height = 48;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const drawTile = (tile: number) => {
    const sx = (tile % ATLAS_TILES) * TILE, sy = Math.floor(tile / ATLAS_TILES) * TILE;
    ctx.drawImage(atlas, sx, sy, 16, 16, 0, 0, 16, 16);
  };
  if (RENDER[id] === 1) {
    ctx.setTransform(2.6, 0, 0, 2.6, 3, 3);
    drawTile(tileFor(id, 0));
  } else {
    // top
    ctx.setTransform(21 / 16, -11 / 16, 21 / 16, 11 / 16, 3, 13);
    drawTile(tileFor(id, 3));
    // left (front)
    ctx.setTransform(21 / 16, 11 / 16, 0, 24 / 16, 3, 13);
    drawTile(tileFor(id, 5));
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillRect(0, 0, 16, 16);
    ctx.globalCompositeOperation = 'source-over';
    // right
    ctx.setTransform(21 / 16, -11 / 16, 0, 24 / 16, 24, 24);
    drawTile(tileFor(id, 1));
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillRect(0, 0, 16, 16);
    ctx.globalCompositeOperation = 'source-over';
  }
  return c.toDataURL();
}

let cachedAtlas: AtlasResult | null = null;
export function getAtlas(): AtlasResult {
  if (!cachedAtlas) cachedAtlas = buildAtlas();
  return cachedAtlas;
}

export function tileUV(tile: number, u: number, v: number): [number, number] {
  const col = tile % ATLAS_TILES;
  const row = Math.floor(tile / ATLAS_TILES);
  const e = 0.0004;
  const U = (col + u) / ATLAS_TILES + (u === 0 ? e : -e);
  const V = 1 - (row + 1 - v) / ATLAS_TILES + (v === 0 ? e : -e);
  return [U, V];
}
