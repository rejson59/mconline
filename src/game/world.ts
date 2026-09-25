import * as THREE from 'three';
import { SimplexNoise } from './noise';
import { B, EMIT, IS_OPAQUE, IS_SOLID, LAYER, RENDER, isDoorOpen, ladderFacing, tileFor } from './blocks';
import { tileUV } from './textures';

export const CS = 16; // chunk size
export const CH = 128; // chunk height
export const SEA = 62;
/** Surface height of a flat world. */
export const FLAT_H = 64;

export type Biome = 'Równiny' | 'Las' | 'Pustynia' | 'Tundra' | 'Góry' | 'Plaża' | 'Ocean' | 'Brzozowy las';

const idx = (x: number, y: number, z: number) => (y * CS + z) * CS + x;

function hash(x: number, y: number, z: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 144665) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

export class Chunk {
  cx: number;
  cz: number;
  data = new Uint8Array(CS * CS * CH);
  heightMap = new Uint8Array(CS * CS);
  meshes: THREE.Mesh[] = [];
  built = false;
  maxY = 0;
  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
  }
  recomputeHeight(x: number, z: number) {
    for (let y = CH - 1; y >= 0; y--) {
      if (IS_OPAQUE[this.data[idx(x, y, z)]]) {
        this.heightMap[z * CS + x] = y;
        return;
      }
    }
    this.heightMap[z * CS + x] = 0;
  }
}

// Face definitions: -x, +x, -y, +y, -z, +z
const FACES = [
  { dir: [-1, 0, 0], shade: 0.62, c: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { dir: [1, 0, 0], shade: 0.62, c: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { dir: [0, -1, 0], shade: 0.5, c: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
  { dir: [0, 1, 0], shade: 1.0, c: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
  { dir: [0, 0, -1], shade: 0.8, c: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { dir: [0, 0, 1], shade: 0.8, c: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
];
const AO_CURVE = [0.45, 0.62, 0.8, 1.0];

class MeshBuffer {
  pos: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  block: number[] = [];
  ind: number[] = [];
  count = 0;
}

/** Axis-aligned box in local 0–1 space, translated to world. Used for doors, ladders and hatches. */
function addBox(
  buf: MeshBuffer,
  ox: number,
  oy: number,
  oz: number,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  tile: number,
  sky: number,
  blk: number,
) {
  const map = (v: number, a: number, b: number) => a + v * (b - a);
  for (let f = 0; f < 6; f++) {
    const F = FACES[f];
    const base = buf.count;
    for (let k = 0; k < 4; k++) {
      const cr = F.c[k];
      buf.pos.push(ox + map(cr[0], x0, x1), oy + map(cr[1], y0, y1), oz + map(cr[2], z0, z1));
      const uv = tileUV(tile, cr[3], cr[4]);
      buf.uv.push(uv[0], uv[1]);
      const skyB = F.shade * sky;
      const br = skyB * skyB;
      buf.col.push(br, br, br);
      const bb = F.shade * blk;
      buf.block.push(bb * bb);
    }
    buf.ind.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    buf.count += 4;
  }
}

/** Local bounds of a thin panel. null = draw a normal cube. */
function panelBounds(id: number): [number, number, number, number, number, number] | null {
  const t = 0.1875;
  const face = ladderFacing(id);
  if (face === 0 || id === B.TRAP_N) return [0, 0, 0, 1, 1, t];
  if (face === 1 || id === B.TRAP_E) return [1 - t, 0, 0, 1, 1, 1];
  if (face === 2 || id === B.TRAP_S) return [0, 0, 1 - t, 1, 1, 1];
  if (face === 3 || id === B.TRAP_W) return [0, 0, 0, t, 1, 1];
  if (id === B.TRAP) return [0, 1 - t, 0, 1, 1, 1];
  if (!isDoorOpen(id)) return null;
  // Open door swings flat against the left jamb.
  if (id === B.DOOR_ON || id === B.DOOR_UON) return [0, 0, 0, t, 1, 1];
  if (id === B.DOOR_OE || id === B.DOOR_UOE) return [0, 0, 0, 1, 1, t];
  if (id === B.DOOR_OS || id === B.DOOR_UOS) return [1 - t, 0, 0, 1, 1, 1];
  if (id === B.DOOR_OW || id === B.DOOR_UOW) return [0, 0, 1 - t, 1, 1, 1];
  return null;
}

export class World {
  seed: number;
  /** Flat worlds are a single grass layer at FLAT_H – handy for building. */
  flat: boolean;
  chunks = new Map<string, Chunk>();
  mods = new Map<string, Map<number, number>>();
  dirty = new Set<string>();
  private n1: SimplexNoise;
  private n2: SimplexNoise;
  private n3: SimplexNoise;
  private nCave: SimplexNoise;
  private nCave2: SimplexNoise;
  private nTemp: SimplexNoise;

  constructor(seed: number, flat = false) {
    this.seed = seed;
    this.flat = flat;
    this.n1 = new SimplexNoise(seed);
    this.n2 = new SimplexNoise(seed + 1);
    this.n3 = new SimplexNoise(seed + 2);
    this.nCave = new SimplexNoise(seed + 3);
    this.nCave2 = new SimplexNoise(seed + 4);
    this.nTemp = new SimplexNoise(seed + 5);
  }

  static key(cx: number, cz: number) {
    return cx + ',' + cz;
  }

  // ---------- Terrain ----------
  surface(x: number, z: number): { h: number; biome: Biome; temp: number; forest: number } {
    if (this.flat) return { h: FLAT_H, biome: 'Równiny', temp: 0, forest: 0 };
    const cont = this.n1.fbm2D(x / 700, z / 700, 4);
    const hills = this.n2.fbm2D(x / 160, z / 160, 4);
    const ridge = 1 - Math.abs(this.n3.noise2D(x / 260, z / 260));
    const mf = this.n3.fbm2D(x / 900 + 50, z / 900 - 50, 3);
    const mountain = Math.max(0, Math.min(1, (mf - 0.05) * 3));
    let h = 64 + cont * 22 + hills * 9 * (0.6 + Math.max(0, cont)) + mountain * ridge * ridge * 48;
    h = Math.floor(Math.max(6, Math.min(CH - 12, h)));
    const temp = this.nTemp.fbm2D(x / 600, z / 600, 3);
    const forest = this.nTemp.fbm2D(x / 220 + 300, z / 220 - 300, 2);
    let biome: Biome;
    if (h < SEA - 3) biome = 'Ocean';
    else if (h <= SEA + 1 && temp > -0.3) biome = 'Plaża';
    else if (h > 92) biome = 'Góry';
    else if (temp > 0.3) biome = 'Pustynia';
    else if (temp < -0.32) biome = 'Tundra';
    else if (forest > 0.15) biome = forest > 0.35 ? 'Brzozowy las' : 'Las';
    else biome = 'Równiny';
    return { h, biome, temp, forest };
  }

  getChunk(cx: number, cz: number): Chunk {
    const k = World.key(cx, cz);
    let c = this.chunks.get(k);
    if (!c) {
      c = new Chunk(cx, cz);
      this.generate(c);
      this.chunks.set(k, c);
    }
    return c;
  }

  hasChunk(cx: number, cz: number) {
    return this.chunks.has(World.key(cx, cz));
  }

  private generate(c: Chunk) {
    if (this.flat) { this.generateFlat(c); return; }
    const d = c.data;
    const ox = c.cx * CS, oz = c.cz * CS;
    const s = this.seed;
    let maxY = SEA;
    const surf: { h: number; biome: Biome }[] = [];
    for (let z = 0; z < CS; z++)
      for (let x = 0; x < CS; x++) {
        const wx = ox + x, wz = oz + z;
        const info = this.surface(wx, wz);
        surf.push(info);
        const h = info.h;
        if (h + 8 > maxY) maxY = h + 8;
        const biome = info.biome;
        const sandy = biome === 'Pustynia' || biome === 'Plaża' || biome === 'Ocean';
        for (let y = 0; y <= Math.max(h, SEA); y++) {
          let id: number = B.AIR;
          if (y === 0 || (y < 4 && hash(wx, y, wz, s) < 0.5 - y * 0.12)) id = B.BEDROCK;
          else if (y < h - 3) {
            id = B.STONE;
            if (biome === 'Pustynia' && y > h - 8) id = B.SANDSTONE;
          } else if (y < h) {
            id = sandy ? (biome === 'Ocean' && y < SEA - 6 ? B.GRAVEL : B.SAND) : B.DIRT;
            if (biome === 'Góry' && h > 100) id = B.STONE;
          } else if (y === h) {
            if (biome === 'Ocean') id = hash(wx, 7, wz, s) < 0.2 ? B.CLAY : h < SEA - 8 ? B.GRAVEL : B.SAND;
            else if (sandy) id = B.SAND;
            else if (biome === 'Tundra') id = B.SNOW;
            else if (biome === 'Góry') id = h > 108 ? B.SNOW : h > 98 ? B.STONE : B.GRASS;
            else id = h < SEA ? B.DIRT : B.GRASS;
          } else if (y <= SEA) {
            id = biome === 'Tundra' && y === SEA ? B.ICE : B.WATER;
          }

          // Caves
          if (id !== B.AIR && id !== B.WATER && id !== B.BEDROCK && id !== B.ICE && y > 4) {
            const underWater = h < SEA + 2 && y > h - 4;
            if (!underWater && y < h + 1) {
              const a = this.nCave.noise3D(wx / 45, y / 28, wz / 45);
              const b2 = this.nCave2.noise3D(wx / 45, y / 28, wz / 45);
              const cheese = y < 50 ? this.nCave.noise3D(wx / 90 + 100, y / 40, wz / 90) : 0;
              if (a * a + b2 * b2 < 0.011 || cheese > 0.62) {
                id = y <= 10 ? B.LAVA : B.AIR;
              }
            }
          }

          // Ores
          if (id === B.STONE) {
            const r = hash(wx, y, wz, s + 77);
            const cl = hash(wx >> 1, y >> 1, wz >> 1, s + 11);
            if (y < 16 && cl < 0.012 && r < 0.6) id = B.DIAMOND_ORE;
            else if (y < 32 && cl > 0.985 && r < 0.6) id = B.GOLD_ORE;
            else if (y < 64 && cl > 0.02 && cl < 0.045 && r < 0.6) id = B.IRON_ORE;
            else if (y < 110 && cl > 0.5 && cl < 0.56 && r < 0.65) id = B.COAL_ORE;
            else if (hash(wx >> 2, y >> 2, wz >> 2, s + 5) < 0.02) id = B.GRAVEL;
          }
          d[idx(x, y, z)] = id;
        }

        // Surface decoration
        const top = d[idx(x, h, z)];
        if (top === B.GRASS && h + 1 < CH) {
          const r = hash(wx, 3, wz, s + 9);
          const grassChance = biome === 'Równiny' ? 0.22 : 0.1;
          if (r < grassChance) d[idx(x, h + 1, z)] = B.TALLGRASS;
          else if (r < grassChance + 0.012) d[idx(x, h + 1, z)] = B.FLOWER_RED;
          else if (r < grassChance + 0.024) d[idx(x, h + 1, z)] = B.FLOWER_YELLOW;
          else if (r > 0.9995) d[idx(x, h + 1, z)] = B.PUMPKIN;
        }
        if (top === B.SAND && biome === 'Pustynia') {
          const r = hash(wx, 4, wz, s + 19);
          if (r < 0.005 && x > 0 && x < 15 && z > 0 && z < 15) {
            const hh = 1 + Math.floor(hash(wx, 5, wz, s) * 3);
            for (let i = 1; i <= hh; i++) d[idx(x, h + i, z)] = B.CACTUS;
          }
        }
      }

    // Trees (can cross chunk boundaries)
    for (let tz = oz - 3; tz < oz + CS + 3; tz++)
      for (let tx = ox - 3; tx < ox + CS + 3; tx++) {
        const r = hash(tx, 1, tz, s + 3);
        if (r > 0.04) continue;
        const inside = tx >= ox && tx < ox + CS && tz >= oz && tz < oz + CS;
        const info = inside ? surf[(tz - oz) * CS + (tx - ox)] : this.surface(tx, tz);
        let chance = 0;
        if (info.biome === 'Las') chance = 0.035;
        else if (info.biome === 'Brzozowy las') chance = 0.03;
        else if (info.biome === 'Równiny') chance = 0.003;
        else if (info.biome === 'Tundra') chance = 0.006;
        else if (info.biome === 'Góry' && info.h < 98) chance = 0.008;
        if (r > chance) continue;
        if (info.h <= SEA) continue;
        const birch = info.biome === 'Brzozowy las' ? hash(tx, 2, tz, s) < 0.8 : hash(tx, 2, tz, s) < 0.15;
        const top = this.growTree(c, tx, tz, info.h + 1, birch);
        if (top > maxY) maxY = top;
      }

    // Buried chests in caves. Does not change terrain height, only fills an existing air pocket.
    for (let n = 0; n < 3; n++) {
      if (hash(ox + n, 80, oz, s) > 0.42) continue;
      const lx = 1 + Math.floor(hash(ox, 81 + n, oz, s) * 14);
      const lz = 1 + Math.floor(hash(ox, 91 + n, oz, s) * 14);
      const colH = surf[lz * CS + lx].h;
      for (let y = 8; y < colH - 3 && y < 52; y++) {
        if (d[idx(lx, y, lz)] !== B.AIR || d[idx(lx, y + 1, lz)] !== B.AIR) continue;
        const under = d[idx(lx, y - 1, lz)];
        if (under !== B.STONE && under !== B.COBBLE && under !== B.DIRT) continue;
        let walls = 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
          const nb = d[idx(lx + dx, y, lz + dz)];
          if (nb === B.STONE || nb === B.DIRT || nb === B.GRAVEL || nb === B.COBBLE) walls++;
        }
        if (walls < 2) continue;
        d[idx(lx, y, lz)] = B.LOOT_CHEST;
        if (y + 2 > maxY) maxY = y + 2;
        break;
      }
    }

    // Apply player modifications
    const m = this.mods.get(World.key(c.cx, c.cz));
    if (m) {
      for (const [i, id] of m) {
        d[i] = id;
        const y = Math.floor(i / (CS * CS));
        if (y + 2 > maxY) maxY = y + 2;
      }
    }
    c.maxY = Math.min(CH - 1, maxY);
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) c.recomputeHeight(x, z);
  }

  /**
   * Places an oak or birch trunk with its canopy, clipping to this chunk only.
   * Returns the highest y the tree reaches (for maxY bookkeeping).
   */
  private growTree(c: Chunk, tx: number, tz: number, base: number, birch: boolean): number {
    const d = c.data;
    const ox = c.cx * CS, oz = c.cz * CS;
    const s = this.seed;
    const logId = birch ? B.BIRCH_LOG : B.LOG;
    const leafId = birch ? B.BIRCH_LEAVES : B.LEAVES;
    const th = 4 + Math.floor(hash(tx, 6, tz, s) * 3);
    const topY = base + th;
    if (topY + 1 >= CH) return base;
    const put = (x: number, y: number, z: number, id: number, force: boolean) => {
      const lx = x - ox, lz = z - oz;
      if (lx < 0 || lx >= CS || lz < 0 || lz >= CS || y < 0 || y >= CH) return;
      const i = idx(lx, y, lz);
      const cur = d[i];
      if (force || cur === B.AIR || cur === B.TALLGRASS || cur === B.FLOWER_RED || cur === B.FLOWER_YELLOW) d[i] = id;
    };
    for (let ly = topY - 3; ly <= topY; ly++) {
      const rad = ly >= topY - 1 ? 1 : 2;
      for (let dx = -rad; dx <= rad; dx++)
        for (let dz = -rad; dz <= rad; dz++) {
          if (Math.abs(dx) === rad && Math.abs(dz) === rad && (ly === topY || hash(tx + dx, ly, tz + dz, s) < 0.5)) continue;
          put(tx + dx, ly, tz + dz, leafId, false);
        }
    }
    put(tx, topY + 1, tz, leafId, false);
    put(tx + 1, topY + 1, tz, leafId, false);
    put(tx - 1, topY + 1, tz, leafId, false);
    put(tx, topY + 1, tz + 1, leafId, false);
    put(tx, topY + 1, tz - 1, leafId, false);
    for (let y = base; y < topY; y++) put(tx, y, tz, logId, true);
    put(tx, base - 1, tz, B.DIRT, true);
    return topY + 3;
  }

  /** Superflat: one grass layer at FLAT_H, ores below, no caves and a few trees. */
  private generateFlat(c: Chunk) {
    const d = c.data;
    const ox = c.cx * CS, oz = c.cz * CS;
    const s = this.seed;
    for (let z = 0; z < CS; z++)
      for (let x = 0; x < CS; x++) {
        const wx = ox + x, wz = oz + z;
        for (let y = 0; y <= FLAT_H; y++) {
          let id: number = B.AIR;
          if (y === 0) id = B.BEDROCK;
          else if (y < FLAT_H - 3) {
            id = B.STONE;
            const r = hash(wx, y, wz, s + 77);
            const cl = hash(wx >> 1, y >> 1, wz >> 1, s + 11);
            if (y < 16 && cl < 0.012 && r < 0.6) id = B.DIAMOND_ORE;
            else if (y < 32 && cl > 0.985 && r < 0.6) id = B.GOLD_ORE;
            else if (cl > 0.02 && cl < 0.045 && r < 0.6) id = B.IRON_ORE;
            else if (cl > 0.5 && cl < 0.56 && r < 0.65) id = B.COAL_ORE;
          } else if (y < FLAT_H) id = B.DIRT;
          else id = B.GRASS;
          d[idx(x, y, z)] = id;
        }
        const r = hash(wx, 3, wz, s + 9);
        if (r < 0.18) d[idx(x, FLAT_H + 1, z)] = B.TALLGRASS;
        else if (r < 0.022) d[idx(x, FLAT_H + 1, z)] = B.FLOWER_RED;
        else if (r < 0.034) d[idx(x, FLAT_H + 1, z)] = B.FLOWER_YELLOW;
        else if (r > 0.9995) d[idx(x, FLAT_H + 1, z)] = B.PUMPKIN;
      }

    // sparse trees so wood is still obtainable
    let maxY = FLAT_H + 8;
    for (let tz = oz - 2; tz < oz + CS + 2; tz++)
      for (let tx = ox - 2; tx < ox + CS + 2; tx++) {
        if (hash(tx, 1, tz, s + 3) > 0.006) continue;
        const top = this.growTree(c, tx, tz, FLAT_H + 1, hash(tx, 2, tz, s) < 0.3);
        if (top > maxY) maxY = top;
      }

    c.maxY = Math.min(CH - 1, maxY);
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) c.recomputeHeight(x, z);
  }

  // ---------- Access ----------
  getBlock(x: number, y: number, z: number): number {
    if (y < 0) return B.BEDROCK;
    if (y >= CH) return B.AIR;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const c = this.getChunk(cx, cz);
    return c.data[idx(x - cx * CS, y, z - cz * CS)];
  }

  // Non-generating version (returns AIR if chunk missing)
  peekBlock(x: number, y: number, z: number): number {
    if (y < 0) return B.BEDROCK;
    if (y >= CH) return B.AIR;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const c = this.chunks.get(World.key(cx, cz));
    if (!c) return B.STONE;
    return c.data[idx(x - cx * CS, y, z - cz * CS)];
  }

  heightAt(x: number, z: number): number {
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const c = this.getChunk(cx, cz);
    return c.heightMap[(z - cz * CS) * CS + (x - cx * CS)];
  }

  setBlock(x: number, y: number, z: number, id: number) {
    if (y < 0 || y >= CH) return;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const c = this.getChunk(cx, cz);
    const lx = x - cx * CS, lz = z - cz * CS;
    const i = idx(lx, y, lz);
    if (c.data[i] === id) return;
    c.data[i] = id;
    if (y + 2 > c.maxY) c.maxY = Math.min(CH - 1, y + 2);
    c.recomputeHeight(lx, lz);
    const k = World.key(cx, cz);
    let m = this.mods.get(k);
    if (!m) { m = new Map(); this.mods.set(k, m); }
    m.set(i, id);
    this.dirty.add(k);
    // neighbors (for face culling / AO / light)
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue;
        const nx = Math.floor((x + dx) / CS), nz = Math.floor((z + dz) / CS);
        if (nx !== cx || nz !== cz) {
          const nk = World.key(nx, nz);
          if (this.chunks.has(nk)) this.dirty.add(nk);
        }
      }
    // light changes below: mark chunk dirty is enough (same column)
  }

  // Serialize modifications
  serializeMods(): Record<string, number[]> {
    const out: Record<string, number[]> = {};
    for (const [k, m] of this.mods) {
      const arr: number[] = [];
      for (const [i, id] of m) arr.push(i, id);
      out[k] = arr;
    }
    return out;
  }
  loadMods(data: Record<string, number[]>) {
    for (const k in data) {
      const m = new Map<number, number>();
      const arr = data[k];
      for (let i = 0; i < arr.length; i += 2) m.set(arr[i], arr[i + 1]);
      this.mods.set(k, m);
    }
  }

  // ---------- Meshing ----------
  buildMesh(c: Chunk): THREE.BufferGeometry[] {
    const bufs = [new MeshBuffer(), new MeshBuffer(), new MeshBuffer()];
    const ox = c.cx * CS, oz = c.cz * CS;
    // Ensure neighbors exist
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) this.getChunk(c.cx + dx, c.cz + dz);
    const neigh: Chunk[] = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) neigh.push(this.getChunk(c.cx + dx, c.cz + dz));

    const get = (x: number, y: number, z: number): number => {
      if (y < 0) return B.BEDROCK;
      if (y >= CH) return B.AIR;
      if (x >= 0 && x < CS && z >= 0 && z < CS) return c.data[idx(x, y, z)];
      const ncx = x < 0 ? 0 : x >= CS ? 2 : 1;
      const ncz = z < 0 ? 0 : z >= CS ? 2 : 1;
      const n = neigh[ncz * 3 + ncx];
      return n.data[idx(x - (ncx - 1) * CS, y, z - (ncz - 1) * CS)];
    };
    const heightLocal = (x: number, z: number): number => {
      const ncx = x < 0 ? 0 : x >= CS ? 2 : 1;
      const ncz = z < 0 ? 0 : z >= CS ? 2 : 1;
      const n = neigh[ncz * 3 + ncx];
      return n.heightMap[(z - (ncz - 1) * CS) * CS + (x - (ncx - 1) * CS)];
    };
    // Block light (torches, lava, lit furnaces) spread a few blocks across chunk borders.
    const PAD = 8;
    const LW = CS + PAD * 2;
    const Lmap = new Uint8Array(LW * LW * CH);
    const lat = (x: number, y: number, z: number) => (y * LW + (z + PAD)) * LW + (x + PAD);
    const qx: number[] = [];
    const qy: number[] = [];
    const qz: number[] = [];
    const seed = (x: number, y: number, z: number, lv: number) => {
      if (y < 0 || y >= CH || x < -PAD || x >= CS + PAD || z < -PAD || z >= CS + PAD) return;
      const i = lat(x, y, z);
      if (Lmap[i] >= lv) return;
      Lmap[i] = lv;
      qx.push(x); qy.push(y); qz.push(z);
    };
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const chunk = neigh[(dz + 1) * 3 + (dx + 1)];
        const ox = dx * CS;
        const oz = dz * CS;
        const xMin = Math.max(0, -PAD - ox);
        const xMax = Math.min(CS, CS + PAD - ox);
        const zMin = Math.max(0, -PAD - oz);
        const zMax = Math.min(CS, CS + PAD - oz);
        const data = chunk.data;
        for (let z = zMin; z < zMax; z++) {
          for (let x = xMin; x < xMax; x++) {
            for (let y = 0; y < CH; y++) {
              const e = EMIT[data[idx(x, y, z)]];
              if (e) seed(ox + x, y, oz + z, e);
            }
          }
        }
      }
    }
    const DIRS: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (let qi = 0; qi < qx.length; qi++) {
      const x = qx[qi], y = qy[qi], z = qz[qi];
      const lv = Lmap[lat(x, y, z)] - 1;
      if (lv <= 0) continue;
      for (let d = 0; d < 6; d++) {
        const nx = x + DIRS[d][0], ny = y + DIRS[d][1], nz = z + DIRS[d][2];
        if (ny < 0 || ny >= CH || nx < -PAD || nx >= CS + PAD || nz < -PAD || nz >= CS + PAD) continue;
        if (IS_OPAQUE[get(nx, ny, nz)]) continue;
        const i = lat(nx, ny, nz);
        if (Lmap[i] >= lv) continue;
        Lmap[i] = lv;
        qx.push(nx); qy.push(ny); qz.push(nz);
      }
    }
    const blockLight = (x: number, y: number, z: number): number => {
      if (y < 0 || y >= CH || x < -PAD || x >= CS + PAD || z < -PAD || z >= CS + PAD) return 0;
      return Lmap[lat(x, y, z)] / 15;
    };
    const skyLight = (x: number, y: number, z: number): number => {
      const h = heightLocal(x, z);
      if (y > h) return 1;
      return Math.max(0.12, 1 - (h - y + 1) * 0.11);
    };

    const maxY = Math.min(CH - 1, c.maxY);
    for (let y = 0; y <= maxY; y++)
      for (let z = 0; z < CS; z++)
        for (let x = 0; x < CS; x++) {
          const id = c.data[idx(x, y, z)];
          if (id === 0) continue;
          const panel = panelBounds(id);
          if (panel) {
            const sky = skyLight(x, y, z);
            const blk = Math.max(blockLight(x, y, z), EMIT[id] / 15);
            addBox(bufs[LAYER[id]], ox + x, y, oz + z, panel[0], panel[1], panel[2], panel[3], panel[4], panel[5], tileFor(id, 0), sky, blk);
            continue;
          }
          const layer = LAYER[id];
          const rt = RENDER[id];
          const buf = bufs[layer];
          if (rt === 1) {
            // cross plant
            const t = tileFor(id, 0);
            const sky = skyLight(x, y, z);
            const blk = Math.max(blockLight(x, y, z), EMIT[id] / 15);
            const skyB = sky * sky * 0.85;
            const blkB = blk * blk * 0.85;
            const wx = ox + x, wz = oz + z;
            const quads = [
              [[0.15, 0, 0.15], [0.85, 0, 0.85], [0.15, 1, 0.15], [0.85, 1, 0.85]],
              [[0.15, 0, 0.85], [0.85, 0, 0.15], [0.15, 1, 0.85], [0.85, 1, 0.15]],
            ];
            for (const q of quads) {
              const uvs = [[0, 0], [1, 0], [0, 1], [1, 1]];
              for (let k = 0; k < 4; k++) {
                buf.pos.push(wx + q[k][0], y + q[k][1] * 0.95, wz + q[k][2]);
                const uv = tileUV(t, uvs[k][0], uvs[k][1]);
                buf.uv.push(uv[0], uv[1]);
                buf.col.push(skyB, skyB, skyB);
                buf.block.push(blkB);
              }
              const n = buf.count;
              buf.ind.push(n, n + 1, n + 2, n + 2, n + 1, n + 3);
              buf.count += 4;
            }
            continue;
          }
          const isLiquid = rt === 2;
          const liquidTopLow = isLiquid && get(x, y + 1, z) !== id;
          for (let f = 0; f < 6; f++) {
            const F = FACES[f];
            const nx = x + F.dir[0], ny = y + F.dir[1], nz = z + F.dir[2];
            const nb = get(nx, ny, nz);
            if (IS_OPAQUE[nb]) continue;
            if (nb === id && id !== B.LEAVES && id !== B.BIRCH_LEAVES) continue;
            if (isLiquid && (RENDER[nb] === 2)) continue;
            const t = tileFor(id, f);
            const sky = skyLight(nx, ny, nz);
            const blk = Math.max(blockLight(nx, ny, nz), EMIT[id] / 15);
            const aos: number[] = [];
            const base = buf.count;
            for (let k = 0; k < 4; k++) {
              const cr = F.c[k];
              let px = cr[0], py = cr[1], pz = cr[2];
              let ao = 3;
              if (!isLiquid) {
                // compute AO
                const d = F.dir;
                let s1x = 0, s1y = 0, s1z = 0, s2x = 0, s2y = 0, s2z = 0;
                if (d[0] !== 0) { s1y = py ? 1 : -1; s2z = pz ? 1 : -1; }
                else if (d[1] !== 0) { s1x = px ? 1 : -1; s2z = pz ? 1 : -1; }
                else { s1x = px ? 1 : -1; s2y = py ? 1 : -1; }
                const a = IS_OPAQUE[get(nx + s1x, ny + s1y, nz + s1z)];
                const b = IS_OPAQUE[get(nx + s2x, ny + s2y, nz + s2z)];
                const cc = IS_OPAQUE[get(nx + s1x + s2x, ny + s1y + s2y, nz + s1z + s2z)];
                ao = a && b ? 0 : 3 - (a + b + cc);
              }
              aos.push(ao);
              let vy = y + py;
              if (liquidTopLow && py === 1) vy -= 0.12;
              if (id === B.CACTUS) {
                if (f === 0) px = 0.0625; else if (f === 1) px = 0.9375;
                if (f === 4) pz = 0.0625; else if (f === 5) pz = 0.9375;
              }
              buf.pos.push(ox + x + px, vy, oz + z + pz);
              const uv = tileUV(t, cr[3], cr[4]);
              buf.uv.push(uv[0], uv[1]);
              const shadeAo = F.shade * AO_CURVE[ao];
              const skyB = shadeAo * sky;
              const br = skyB * skyB;
              buf.col.push(br, br, br);
              const bb = shadeAo * blk;
              buf.block.push(bb * bb);
            }
            if (aos[0] + aos[3] > aos[1] + aos[2]) buf.ind.push(base, base + 1, base + 3, base, base + 3, base + 2);
            else buf.ind.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
            buf.count += 4;
          }
        }

    return bufs.map((b) => {
      const g = new THREE.BufferGeometry();
      if (b.count === 0) return g;
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      g.setAttribute('aBlock', new THREE.Float32BufferAttribute(b.block, 1));
      g.setIndex(b.count > 65000 ? new THREE.Uint32BufferAttribute(b.ind, 1) : new THREE.Uint16BufferAttribute(b.ind, 1));
      g.computeBoundingSphere();
      return g;
    });
  }

  isSolid(x: number, y: number, z: number) {
    return IS_SOLID[this.peekBlock(x, y, z)] === 1;
  }

  // Voxel raycast (DDA)
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tDeltaX = Math.abs(1 / dx), tDeltaY = Math.abs(1 / dy), tDeltaZ = Math.abs(1 / dz);
    let tMaxX = dx !== 0 ? (dx > 0 ? x + 1 - ox : ox - x) * tDeltaX : Infinity;
    let tMaxY = dy !== 0 ? (dy > 0 ? y + 1 - oy : oy - y) * tDeltaY : Infinity;
    let tMaxZ = dz !== 0 ? (dz > 0 ? z + 1 - oz : oz - z) * tDeltaZ : Infinity;
    let nx = 0, ny = 0, nz = 0;
    let t = 0;
    while (t <= maxDist) {
      const id = this.peekBlock(x, y, z);
      if (id !== 0 && RENDER[id] !== 2) return { x, y, z, nx, ny, nz, id, dist: t };
      if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0; }
      else if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0; }
      else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ; }
    }
    return null;
  }
}

/** Grows an oak or birch where a sapling stands. Returns false if the space is blocked. */
export function plantTree(world: World, x: number, y: number, z: number, birch: boolean): boolean {
  const logId = birch ? B.BIRCH_LOG : B.LOG;
  const leafId = birch ? B.BIRCH_LEAVES : B.LEAVES;
  const ground = world.getBlock(x, y - 1, z);
  if (ground !== B.DIRT && ground !== B.GRASS && ground !== B.FARMLAND) return false;
  const th = 4 + Math.floor(Math.random() * 3);
  const topY = y + th - 1;
  if (topY + 1 >= CH) return false;
  const clearish = (id: number) =>
    id === B.AIR || id === B.SAPLING || id === B.BIRCH_SAPLING || id === B.LEAVES || id === B.BIRCH_LEAVES || RENDER[id] === 1;
  for (let ly = y; ly < topY; ly++) if (!clearish(world.getBlock(x, ly, z))) return false;
  for (let ly = topY - 2; ly <= topY + 1; ly++) {
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) {
        if (dx === 0 && dz === 0) continue;
        if (!clearish(world.getBlock(x + dx, ly, z + dz))) return false;
      }
  }
  const put = (px: number, py: number, pz: number, id: number, force: boolean) => {
    if (py < 0 || py >= CH) return;
    const cur = world.getBlock(px, py, pz);
    if (force || clearish(cur)) world.setBlock(px, py, pz, id);
  };
  for (let ly = topY - 3; ly <= topY; ly++) {
    const rad = ly >= topY - 1 ? 1 : 2;
    for (let dx = -rad; dx <= rad; dx++)
      for (let dz = -rad; dz <= rad; dz++) {
        if (Math.abs(dx) === rad && Math.abs(dz) === rad && (ly === topY || Math.random() < 0.5)) continue;
        put(x + dx, ly, z + dz, leafId, false);
      }
  }
  put(x, topY + 1, z, leafId, false);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
    if (Math.random() < 0.65) put(x + dx, topY + 1, z + dz, leafId, false);
  }
  for (let ly = y; ly < topY; ly++) put(x, ly, z, logId, true);
  if (ground !== B.DIRT) put(x, y - 1, z, B.DIRT, true);
  return true;
}
