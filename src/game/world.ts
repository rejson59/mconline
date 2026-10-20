import * as THREE from 'three';
import { SimplexNoise } from './noise';
import { B, EMIT, IS_LEAFY, IS_OPAQUE, IS_SOLID, LAYER, OCCLUDES, RENDER, isDoorOpen, ladderFacing, tileFor, isSlabTop, stairsFacing } from './blocks';
import { tileUV } from './textures';
import { CH, CS, FLAT_H, SEA } from './constants';
import {
  applyVillages,
  nearestVillage,
  villageAt,
  villagesOverlapping,
  type Village,
  type VillageContext,
} from './village';

// Metryki świata mieszkają w constants.ts (generator wsi też ich potrzebuje),
// ale stare importy z world.ts nadal działają.
export { CH, CS, FLAT_H, SEA };

export type Biome = 'Równiny' | 'Las' | 'Pustynia' | 'Tundra' | 'Góry' | 'Plaża' | 'Ocean' | 'Brzozowy las' | 'Bagno' | 'Sawanna' | 'Dżungla' | 'Nether';

export interface SurfaceInfo {
  h: number;
  biome: Biome;
  temp: number;
  forest: number;
}

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
  data = new Uint16Array(CS * CS * CH);
  heightMap = new Uint16Array(CS * CS);
  meshes: THREE.Mesh[] = [];
  built = false;
  maxY = 0;
  /** Nether chunks measure height as the walkable FLOOR, never the roof. */
  nether = false;
  /**
   * 2.8 „Płynny świat”: indeks bloków emitujących światło (pochodnie, lawa,
   * jasnogłaz…). Meshing wcześniej skanował 9 × 32 768 bloków sąsiadów przy
   * KAŻDYM chunku; teraz czyta tylko faktyczne źródła światła.
   */
  emitters: number[] = [];
  /** Zmienia się przy każdej modyfikacji terenu (cache minimapy). */
  revision = 0;
  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
  }
  /** Przebudowuje indeks świateł po wygenerowaniu albo zmianie bloku. */
  refreshEmitters() {
    const out: number[] = [];
    const d = this.data;
    for (let i = 0; i < d.length; i++) if (EMIT[d[i]]) out.push(i);
    this.emitters = out;
  }
  recomputeHeight(x: number, z: number) {
    if (this.nether) {
      // Highest walkable floor: a solid block with two air blocks over it.
      // The roof and every hanging stalactite are skipped, so spawns, the
      // minimap and mob AI always see the actual ground under the player.
      for (let y = CH - 3; y >= 0; y--) {
        const i = idx(x, y, z);
        if (IS_OPAQUE[this.data[i]] && this.data[i + CS * CS] === 0 && this.data[i + 2 * CS * CS] === 0) {
          this.heightMap[z * CS + x] = y;
          return;
        }
      }
      this.heightMap[z * CS + x] = 0;
      return;
    }
    // 2.8.1: korona drzewa nie jest gruntem – wysokość kolumny ma wskazywać
    // ziemię (spawn, deszcz, minimapa), a nie czubek liści.
    for (let y = CH - 1; y >= 0; y--) {
      const id = this.data[idx(x, y, z)];
      if (IS_OPAQUE[id] && !IS_LEAFY[id]) {
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

// Shared BFS scratch for buildMesh (single-threaded, never nested).
let lightScratch: Uint8Array | null = null;
// 2.8.1: bufor światła nieba – jedna kolumna na x/z z jednym blokiem zapasu.
const SKY_PAD = 1;
const SKY_W = CS + SKY_PAD * 2;
const LEAF_SHADE = 0.9; // ile światła przechodzi przez jeden blok liści
const MIN_SKY = 0.16; // pod gęstą koroną zostaje resztka światła
const MIN_CAVE_SKY = 0.04; // pod pełnym blokiem zostaje tylko mrok jaskini
let skyScratch: Float32Array | null = null;
const qx: number[] = [];
const qy: number[] = [];
const qz: number[] = [];

/**
 * 2.8: typowane bufory zamiast tablic `number[]`. Każdy `push` na zwykłej
 * tablicy alokował pamięć i produkował śmieci; przy tysiącach ścian na chunk
 * miało to bezpośredni wpływ na płynność. Bufory rosną geometrycznie, a do
 * geometrii trafia dokładny wycinek.
 */
class MeshBuffer {
  pos: Float32Array;
  uv: Float32Array;
  col: Float32Array;
  block: Float32Array;
  wave: Float32Array;
  ind: Uint32Array;
  count = 0;
  icount = 0;

  constructor(capacity = 2048) {
    this.pos = new Float32Array(capacity * 3);
    this.uv = new Float32Array(capacity * 2);
    this.col = new Float32Array(capacity * 3);
    this.block = new Float32Array(capacity);
    this.wave = new Float32Array(capacity);
    this.ind = new Uint32Array(capacity * 1.5);
  }

  private growVertices(need: number) {
    let cap = this.pos.length / 3;
    if (cap >= need) return;
    while (cap < need) cap *= 2;
    const copy = <T extends Float32Array>(src: T, itemSize: number): T => {
      const next = new Float32Array(cap * itemSize) as T;
      next.set(src);
      return next;
    };
    this.pos = copy(this.pos, 3);
    this.uv = copy(this.uv, 2);
    this.col = copy(this.col, 3);
    this.block = copy(this.block, 1);
    this.wave = copy(this.wave, 1);
  }

  private growIndices(need: number) {
    let cap = this.ind.length;
    if (cap >= need) return;
    while (cap < need) cap *= 2;
    const next = new Uint32Array(cap);
    next.set(this.ind);
    this.ind = next;
  }

  vertex(px: number, py: number, pz: number, u: number, v: number, r: number, g: number, b: number, blk: number, wave = 0) {
    this.growVertices(this.count + 1);
    const i = this.count++;
    const i3 = i * 3;
    const i2 = i * 2;
    this.pos[i3] = px; this.pos[i3 + 1] = py; this.pos[i3 + 2] = pz;
    this.uv[i2] = u; this.uv[i2 + 1] = v;
    this.col[i3] = r; this.col[i3 + 1] = g; this.col[i3 + 2] = b;
    this.block[i] = blk;
    this.wave[i] = wave;
  }

  /** Zapisuje indeksy czworokąta (kolejność zależna od kierunku AO). */
  quad(base: number, flipped = false) {
    const need = this.icount + 6;
    this.growIndices(need);
    const ind = this.ind;
    let o = this.icount;
    if (flipped) {
      ind[o++] = base; ind[o++] = base + 1; ind[o++] = base + 3;
      ind[o++] = base; ind[o++] = base + 3; ind[o++] = base + 2;
    } else {
      ind[o++] = base; ind[o++] = base + 1; ind[o++] = base + 2;
      ind[o++] = base + 2; ind[o++] = base + 1; ind[o++] = base + 3;
    }
    this.icount = o;
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    if (this.count === 0) return g;
    const vertices = this.count;
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.slice(0, vertices * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv.slice(0, vertices * 2), 2));
    g.setAttribute('color', new THREE.BufferAttribute(this.col.slice(0, vertices * 3), 3));
    g.setAttribute('aBlock', new THREE.BufferAttribute(this.block.slice(0, vertices), 1));
    g.setAttribute('aWave', new THREE.BufferAttribute(this.wave.slice(0, vertices), 1));
    const indices = this.ind.subarray(0, this.icount);
    g.setIndex(vertices > 65535
      ? new THREE.BufferAttribute(indices.slice(), 1)
      : new THREE.BufferAttribute(Uint16Array.from(indices), 1));
    g.computeBoundingSphere();
    return g;
  }
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
    const skyB = F.shade * sky;
    const br = skyB * skyB;
    const bb = F.shade * blk;
    const bl = bb * bb;
    for (let k = 0; k < 4; k++) {
      const cr = F.c[k];
      const uv = tileUV(tile, cr[3], cr[4]);
      buf.vertex(ox + map(cr[0], x0, x1), oy + map(cr[1], y0, y1), oz + map(cr[2], z0, z1), uv[0], uv[1], br, br, br, bl);
    }
    buf.quad(base);
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
  /**
   * Nether worlds are a completely separate dimension: own terrain, own chunk
   * map, own player modifications. Nothing is ever stamped onto the overworld,
   * so the two maps can never bleed into each other.
   */
  readonly isNether: boolean;
  chunks = new Map<string, Chunk>();
  mods = new Map<string, Map<number, number>>();
  dirty = new Set<string>();
  private n1: SimplexNoise;
  private n2: SimplexNoise;
  private n3: SimplexNoise;
  private nCave: SimplexNoise;
  private nCave2: SimplexNoise;
  private nTemp: SimplexNoise;
  private vctx: VillageContext | null = null;

  constructor(seed: number, flat = false, nether = false) {
    this.seed = seed;
    this.flat = flat && !nether;
    this.isNether = nether;
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
  /**
   * 2.8: współrzędne próbek wysokości w obrębie jednego chunku są liczone
   * wielokrotnie (trzcina, drzewa, wioski). Cache na czas generowania oszczędza
   * dziesiątki tysięcy wywołań szumu, nie zmieniając ani jednego bloku.
   */
  private genSurface: Map<number, SurfaceInfo> | null = null;

  surface(x: number, z: number): SurfaceInfo {
    const cache = this.genSurface;
    if (cache) {
      // Klucz numeryczny obejmuje cały typowy zasięg świata (±32 768 kratek).
      const key = (x + 32768) * 65536 + (z + 32768);
      const hit = cache.get(key);
      if (hit) return hit;
      const info = this.computeSurface(x, z);
      cache.set(key, info);
      return info;
    }
    return this.computeSurface(x, z);
  }

  private computeSurface(x: number, z: number): SurfaceInfo {
    if (this.isNether) return { h: this.netherFloorH(x, z), biome: 'Nether', temp: 0, forest: 0 };
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
    // Climate bands add three distinct warm/wet regions without changing
    // existing seed terrain or the save format. The low-frequency fields make
    // biome borders broad enough to read during exploration.
    else if (temp > 0.12 && forest < -0.12) biome = 'Sawanna';
    else if (temp > 0.12 && forest > 0.42) biome = 'Dżungla';
    else if (temp > -0.08 && temp < 0.12 && forest > 0.18 && forest < 0.42) biome = 'Bagno';
    else if (forest > 0.15) biome = forest > 0.35 ? 'Brzozowy las' : 'Las';
    else biome = 'Równiny';
    // Marshes sit close to sea level, so shallow pools naturally appear in
    // their low spots and the existing water table creates a wetland feel.
    if (biome === 'Bagno') h = Math.min(h, SEA + 2);
    return { h, biome, temp, forest };
  }

  /**
   * 2.8: jednowpisowy cache ostatnio użytego chunku. `peekBlock` jest wołany
   * tysiące razy na sekundę (fizyka, AI mobów, cząstki) i za każdym razem
   * składał nowy klucz tekstowy „cx,cz”. Teraz najczęstszy przypadek – ten sam
   * chunk co przed chwilą – to jedno porównanie liczb.
   */
  private lastCx = 0x7fffffff;
  private lastCz = 0x7fffffff;
  private lastChunk: Chunk | null = null;

  private chunkFast(cx: number, cz: number): Chunk | null {
    if (cx === this.lastCx && cz === this.lastCz) return this.lastChunk;
    const c = this.chunks.get(World.key(cx, cz)) ?? null;
    if (c) {
      this.lastCx = cx;
      this.lastCz = cz;
      this.lastChunk = c;
    }
    return c;
  }

  /** Usuwa chunk z pamięci (także z cache) – używane przy zwalnianiu zasięgu. */
  releaseChunk(cx: number, cz: number): Chunk | null {
    const c = this.chunks.get(World.key(cx, cz)) ?? null;
    if (!c) return null;
    this.chunks.delete(World.key(cx, cz));
    if (this.lastChunk === c) {
      this.lastChunk = null;
      this.lastCx = 0x7fffffff;
      this.lastCz = 0x7fffffff;
    }
    return c;
  }

  getChunk(cx: number, cz: number): Chunk {
    const k = World.key(cx, cz);
    let c = this.chunks.get(k);
    if (!c) {
      c = new Chunk(cx, cz);
      c.nether = this.isNether;
      this.generate(c);
      this.chunks.set(k, c);
      this.lastCx = cx;
      this.lastCz = cz;
      this.lastChunk = c;
      // 2.8: nowy chunk zmienia widoczne krawędzie sąsiadów. Bez oznaczenia
      // ich jako brudne po powrocie w odwiedzony rejon zostawały dziury w
      // ścianach (siatka sąsiada była liczona, gdy ten chunk nie istniał).
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dz === 0) continue;
          const key = World.key(cx + dx, cz + dz);
          const neighbor = this.chunks.get(key);
          if (neighbor && neighbor.built) this.dirty.add(key);
        }
    }
    return c;
  }

  hasChunk(cx: number, cz: number) {
    return this.chunks.has(World.key(cx, cz));
  }

  private generate(c: Chunk) {
    // 2.8: cache powierzchni żyje tylko podczas generowania jednego chunku.
    const previous = this.genSurface;
    this.genSurface = new Map();
    try {
      this.generateInner(c);
    } finally {
      this.genSurface = previous;
    }
    c.refreshEmitters();
    c.revision++;
  }

  private generateInner(c: Chunk) {
    if (this.isNether) { this.generateNether(c); return; }
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
            id = sandy ? (biome === 'Ocean' && y < SEA - 6 ? B.GRAVEL : B.SAND) : biome === 'Bagno' && y >= h - 3 ? B.MUD : B.DIRT;
            if (biome === 'Góry' && h > 100) id = B.STONE;
          } else if (y === h) {
            if (biome === 'Ocean') id = hash(wx, 7, wz, s) < 0.2 ? B.CLAY : h < SEA - 8 ? B.GRAVEL : B.SAND;
            else if (sandy) id = B.SAND;
            else if (biome === 'Tundra') id = B.SNOW;
            else if (biome === 'Bagno') id = B.MUD;
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
            const cl2 = hash(wx >> 1, y >> 1, wz >> 1, s + 23);
            const cl3 = hash(wx >> 1, y >> 1, wz >> 1, s + 41);
            const cl4 = hash(wx >> 1, y >> 1, wz >> 1, s + 59);
            if (y < 16 && cl < 0.012 && r < 0.6) id = B.DIAMOND_ORE;
            else if (y > 6 && y < 40 && cl3 > (biome === 'Góry' ? 0.986 : 0.9965) && r < 0.6) id = B.EMERALD_ORE;
            else if (y < 16 && cl4 > 0.04 && cl4 < 0.07 && r < 0.55) id = B.REDSTONE_ORE;
            else if (y < 32 && cl > 0.985 && r < 0.6) id = B.GOLD_ORE;
            else if (y < 64 && cl > 0.02 && cl < 0.045 && r < 0.6) id = B.IRON_ORE;
            else if (y < 44 && y > 8 && cl2 < 0.016 && r < 0.55) id = B.LAPIS_ORE;
            else if (y < 110 && cl > 0.5 && cl < 0.56 && r < 0.65) id = B.COAL_ORE;
            else if (hash(wx >> 2, y >> 2, wz >> 2, s + 5) < 0.02) id = B.GRAVEL;
          }
          d[idx(x, y, z)] = id;
        }

      }

    // Wioski: wyrównują teren i stawiają budynki, zanim pojawią się dekoracje.
    const village = applyVillages(d, c.cx, c.cz, this.villageContext());
    const vmask = village.mask;
    if (village.top > maxY) maxY = village.top;

    // Surface decoration (pomija kolumny zajęte przez wioskę)
    for (let z = 0; z < CS; z++)
      for (let x = 0; x < CS; x++) {
        if (vmask[z * CS + x]) continue;
        const wx = ox + x, wz = oz + z;
        const info = surf[z * CS + x];
        const h = info.h;
        const biome = info.biome;
        const top = d[idx(x, h, z)];
        if (biome === 'Bagno' && h < SEA && SEA + 1 < CH && d[idx(x, SEA, z)] === B.WATER && hash(wx, 2, wz, s + 154) < 0.12) {
          d[idx(x, SEA + 1, z)] = B.LILY_PAD;
        }
        if (top === B.GRASS && h + 1 < CH) {
          const r = hash(wx, 3, wz, s + 9);
          const grassChance = biome === 'Równiny' ? 0.22 : biome === 'Dżungla' ? 0.32 : biome === 'Bagno' ? 0.28 : biome === 'Sawanna' ? 0.04 : 0.1;
          if (r < grassChance) d[idx(x, h + 1, z)] = B.TALLGRASS;
          else if (r < grassChance + (biome === 'Dżungla' ? 0.035 : 0.012)) d[idx(x, h + 1, z)] = B.FLOWER_RED;
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
        // Sugar cane: grass/sand right next to water, up to 3 blocks tall.
        if ((top === B.GRASS || top === B.SAND || top === B.DIRT) && h + 3 < CH) {
          let nearWater = false;
          // the stalk itself must stand on dry ground: a shore one block above sea level
          if (h >= SEA && h <= SEA + 2) {
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
              if (this.surface(wx + dx, wz + dz).h < SEA) { nearWater = true; break; }
            }
          }
          if (nearWater && hash(wx, 6, wz, s + 31) < 0.28) {
            const hh = 1 + Math.floor(hash(wx, 7, wz, s + 32) * 3);
            for (let i = 1; i <= hh; i++) d[idx(x, h + i, z)] = B.SUGARCANE;
          }
        }
      }

    // Trees (can cross chunk boundaries)
    for (let tz = oz - 3; tz < oz + CS + 3; tz++)
      for (let tx = ox - 3; tx < ox + CS + 3; tx++) {
        const r = hash(tx, 1, tz, s + 3);
        if (r > 0.04) continue;
        const inside = tx >= ox && tx < ox + CS && tz >= oz && tz < oz + CS;
        if (inside && vmask[(tz - oz) * CS + (tx - ox)]) continue;
        const info = inside ? surf[(tz - oz) * CS + (tx - ox)] : this.surface(tx, tz);
        let chance = 0;
        if (info.biome === 'Las') chance = 0.035;
        else if (info.biome === 'Brzozowy las') chance = 0.03;
        else if (info.biome === 'Dżungla') chance = 0.045;
        else if (info.biome === 'Bagno') chance = 0.025;
        else if (info.biome === 'Sawanna') chance = 0.008;
        else if (info.biome === 'Równiny') chance = 0.003;
        else if (info.biome === 'Tundra') chance = 0.006;
        else if (info.biome === 'Góry' && info.h < 98) chance = 0.008;
        if (r > chance) continue;
        if (info.h <= SEA) continue;
        const birch = info.biome === 'Brzozowy las' ? hash(tx, 2, tz, s) < 0.8 : hash(tx, 2, tz, s) < 0.15;
        const kind = info.biome === 'Dżungla' ? 'jungle' : info.biome === 'Sawanna' ? 'acacia' : undefined;
        const top = this.growTree(c, tx, tz, info.h + 1, birch, vmask, kind);
        if (top > maxY) maxY = top;
      }

    // Buried chests in caves. Does not change terrain height, only fills an existing air pocket.
    for (let n = 0; n < 3; n++) {
      if (hash(ox + n, 80, oz, s) > 0.42) continue;
      const lx = 1 + Math.floor(hash(ox, 81 + n, oz, s) * 14);
      const lz = 1 + Math.floor(hash(ox, 91 + n, oz, s) * 14);
      if (vmask[lz * CS + lx]) continue;
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

    c.maxY = Math.min(CH - 1, maxY);
    this.applyMods(c);
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) c.recomputeHeight(x, z);
    // Wyrównany grunt wioski wygrywa z „najwyższym blokiem”: dach domu ani
    // tafla wody w studni nie mogą udawać poziomu terenu, bo po nim stawiamy
    // mieszkańców i moby.
    for (let i = 0; i < vmask.length; i++) if (vmask[i]) c.heightMap[i] = village.ground[i];
  }

  /**
   * Places an oak or birch trunk with its canopy, clipping to this chunk only.
   * Returns the highest y the tree reaches (for maxY bookkeeping).
   */
  private growTree(c: Chunk, tx: number, tz: number, base: number, birch: boolean, skip?: Uint8Array, kind?: 'jungle' | 'acacia'): number {
    const d = c.data;
    const ox = c.cx * CS, oz = c.cz * CS;
    const s = this.seed;
    const logId = kind === 'acacia' ? B.ACACIA_LOG : birch ? B.BIRCH_LOG : B.LOG;
    const leafId = kind === 'jungle' ? B.JUNGLE_LEAVES : kind === 'acacia' ? B.ACACIA_LEAVES : birch ? B.BIRCH_LEAVES : B.LEAVES;
    const th = kind === 'acacia' ? 5 + Math.floor(hash(tx, 6, tz, s) * 2) : kind === 'jungle' ? 7 + Math.floor(hash(tx, 6, tz, s) * 4) : 4 + Math.floor(hash(tx, 6, tz, s) * 3);
    const topY = base + th;
    if (topY + 1 >= CH) return base;
    const put = (x: number, y: number, z: number, id: number, force: boolean) => {
      const lx = x - ox, lz = z - oz;
      if (lx < 0 || lx >= CS || lz < 0 || lz >= CS || y < 0 || y >= CH) return;
      if (skip && skip[lz * CS + lx]) return;
      const i = idx(lx, y, lz);
      const cur = d[i];
      if (force || cur === B.AIR || cur === B.TALLGRASS || cur === B.FLOWER_RED || cur === B.FLOWER_YELLOW) d[i] = id;
    };
    for (let ly = topY - (kind === 'jungle' ? 4 : 3); ly <= topY; ly++) {
      const rad = kind === 'acacia' ? (ly >= topY - 1 ? 3 : ly >= topY - 3 ? 2 : 1) : kind === 'jungle' ? (ly >= topY - 2 ? 2 : 3) : ly >= topY - 1 ? 1 : 2;
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
    if (kind === 'acacia') {
      const side = hash(tx, 8, tz, s) < 0.5 ? 1 : -1;
      for (let n = 1; n <= 2; n++) put(tx + side * n, topY - 2 + n, tz, logId, true);
      for (let n = 1; n <= 2; n++) put(tx - side * n, topY - 1, tz, logId, true);
    }
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
            const cl2 = hash(wx >> 1, y >> 1, wz >> 1, s + 23);
            const cl3 = hash(wx >> 1, y >> 1, wz >> 1, s + 41);
              const cl4 = hash(wx >> 1, y >> 1, wz >> 1, s + 59);
            if (y < 16 && cl < 0.012 && r < 0.6) id = B.DIAMOND_ORE;
            else if (y > 6 && y < 40 && cl3 > 0.9965 && r < 0.6) id = B.EMERALD_ORE;
            else if (y < 16 && cl4 > 0.04 && cl4 < 0.07 && r < 0.55) id = B.REDSTONE_ORE;
            else if (y < 32 && cl > 0.985 && r < 0.6) id = B.GOLD_ORE;
            else if (cl > 0.02 && cl < 0.045 && r < 0.6) id = B.IRON_ORE;
            else if (y < 44 && y > 8 && cl2 < 0.016 && r < 0.55) id = B.LAPIS_ORE;
            else if (cl > 0.5 && cl < 0.56 && r < 0.65) id = B.COAL_ORE;
          } else if (y < FLAT_H) id = B.DIRT;
          else id = B.GRASS;
          d[idx(x, y, z)] = id;
        }
      }

    // Wioski także na płaskim świecie – tam zawsze jest równina.
    const village = applyVillages(d, c.cx, c.cz, this.villageContext());
    const vmask = village.mask;
    let maxY = Math.max(FLAT_H + 8, village.top);

    for (let z = 0; z < CS; z++)
      for (let x = 0; x < CS; x++) {
        if (vmask[z * CS + x]) continue;
        const wx = ox + x, wz = oz + z;
        const r = hash(wx, 3, wz, s + 9);
        if (r < 0.18) d[idx(x, FLAT_H + 1, z)] = B.TALLGRASS;
        if (r > 0.9975 && x > 0 && x < 15 && z > 0 && z < 15) {
          const hh = 1 + Math.floor(hash(wx, 7, wz, s + 32) * 3);
          for (let i = 1; i <= hh; i++) d[idx(x, FLAT_H + i, z)] = B.SUGARCANE;
        }
        else if (r < 0.022) d[idx(x, FLAT_H + 1, z)] = B.FLOWER_RED;
        else if (r < 0.034) d[idx(x, FLAT_H + 1, z)] = B.FLOWER_YELLOW;
        else if (r > 0.9995) d[idx(x, FLAT_H + 1, z)] = B.PUMPKIN;
      }

    // sparse trees so wood is still obtainable
    for (let tz = oz - 2; tz < oz + CS + 2; tz++)
      for (let tx = ox - 2; tx < ox + CS + 2; tx++) {
        if (hash(tx, 1, tz, s + 3) > 0.006) continue;
        const inside = tx >= ox && tx < ox + CS && tz >= oz && tz < oz + CS;
        if (inside && vmask[(tz - oz) * CS + (tx - ox)]) continue;
        const top = this.growTree(c, tx, tz, FLAT_H + 1, hash(tx, 2, tz, s) < 0.3, vmask);
        if (top > maxY) maxY = top;
      }

    c.maxY = Math.min(CH - 1, maxY);
    this.applyMods(c);
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) c.recomputeHeight(x, z);
    // Wyrównany grunt wioski wygrywa z „najwyższym blokiem”: dach domu ani
    // tafla wody w studni nie mogą udawać poziomu terenu, bo po nim stawiamy
    // mieszkańców i moby.
    for (let i = 0; i < vmask.length; i++) if (vmask[i]) c.heightMap[i] = village.ground[i];
  }

  /** Replays the player's block changes onto a freshly generated chunk. */
  private applyMods(c: Chunk) {
    const m = this.mods.get(World.key(c.cx, c.cz));
    if (!m) return;
    const d = c.data;
    for (const [i, id] of m) {
      d[i] = id;
      const y = Math.floor(i / (CS * CS));
      if (y + 2 > c.maxY) c.maxY = Math.min(CH - 1, y + 2);
    }
  }

  // ---------- Wioski (1.6) ----------

  /** Deterministyczny kontekst generatora wsi (ten sam dla całego świata). */
  villageContext(): VillageContext {
    if (!this.vctx) {
      this.vctx = { seed: this.seed, flat: this.flat, sea: SEA, surface: (x, z) => this.surface(x, z) };
    }
    return this.vctx;
  }

  /** Wioska, na której terenie stoi punkt (albo null). */
  villageAt(x: number, z: number): Village | null {
    if (this.isNether) return null; // osady nie istnieją w Netherze
    return villageAt(x, z, this.villageContext());
  }

  /** Wszystkie wioski, których obszar obejmuje prostokąt. */
  villagesIn(x0: number, z0: number, x1: number, z1: number): Village[] {
    if (this.isNether) return [];
    return villagesOverlapping(x0, z0, x1, z1, this.villageContext());
  }

  /** Najbliższa wioska – używane przez komendę /village i spawn mieszkańców. */
  nearestVillage(x: number, z: number, cells = 3) {
    if (this.isNether) return null;
    return nearestVillage(x, z, this.villageContext(), cells);
  }

  // ---------- Nether (osobny wymiar, wersja 1.7+) ----------

  /** Wysokość podłogi Netheru – falujące pagórki ok. 16–72. */
  private netherFloorH(gx: number, gz: number): number {
    const n = this.n1.fbm2D(gx / 90, gz / 90, 3);
    const m = this.n2.fbm2D(gx / 300, gz / 300, 2);
    return Math.max(18, Math.min(74, Math.floor(46 + n * 13 + m * 15)));
  }

  /** Dolna krawędź skalnego stropu – zostawia ~30 bloków otwartej przestrzeni. */
  private netherCeilH(gx: number, gz: number): number {
    const n = this.n3.fbm2D(gx / 70, gz / 70, 3);
    return Math.floor(102 + n * 9);
  }

  /**
   * Pełny generator Netheru – wywoływany przy tworzeniu chunka, deterministycznie
   * (tylko hash + szumy, zero Math.random). Osobna mapa = zero nakładania się
   * światów; teren nigdy nie „nadpisuje" nadświatu.
   */
  private generateNether(c: Chunk) {
    const d = c.data;
    const ox = c.cx * CS, oz = c.cz * CS;
    const s = this.seed;
    let maxY = 0;

    for (let z = 0; z < CS; z++) {
      for (let x = 0; x < CS; x++) {
        const gx = ox + x, gz = oz + z;
        const fh = this.netherFloorH(gx, gz);
        const ch = this.netherCeilH(gx, gz);
        if (ch + 10 > maxY) maxY = ch + 10;
        for (let y = 0; y < CH; y++) {
          let id: number = B.AIR;
          if (y === 0) id = B.BEDROCK;
          else if (y <= 4) id = B.LAVA;                    // morze lawy na dnie
          else if (y <= fh) {
            id = B.NETHERRACK;
            // jaskinie – tylko dobrze pod powierzchnią, żeby podłoga była płaska
            if (y > 10 && y < fh - 5) {
              const a = this.nCave.noise3D(gx / 42, y / 24, gz / 42);
              const b = this.nCave2.noise3D(gx / 40, y / 22, gz / 40);
              if (a * a + b * b < 0.010) id = y <= 13 ? B.LAVA : B.AIR;
            }
            // rudy: kwarc i głęboka magma
            if (id === B.NETHERRACK && y < fh - 6 && y < 64) {
              const r = hash(gx, y, gz, s + 99);
              if (r < 0.014) id = B.QUARTZ_ORE;
              else if (y < 20 && r > 0.02 && r < 0.028) id = B.MAGMA;
            }
          } else if (y < ch) {
            id = B.AIR;                                    // olbrzymia jaskinia
          } else {
            id = B.NETHERRACK;
            // kieszenie w pierwszych blokach stropu
            if (y < ch + 8 && this.nCave.noise3D(gx / 34, y / 16, gz / 34) > 0.45) id = B.AIR;
            else if (y >= 122) id = y >= 126 || hash(gx, y, gz, s + 17) < 0.35 ? B.BEDROCK : B.NETHERRACK;
          }
          d[idx(x, y, z)] = id;
        }

        // plamy na powierzchni: piasek dusz, gleba, czernit, magma
        if (d[idx(x, fh, z)] === B.NETHERRACK) {
          const r = hash(gx, 0, gz, s + 31);
          if (r < 0.05) d[idx(x, fh, z)] = B.SOUL_SAND;
          else if (r < 0.075) d[idx(x, fh, z)] = B.SOUL_SOIL;
          else if (r < 0.095) d[idx(x, fh, z)] = B.BLACKSTONE;
          else if (r < 0.105) d[idx(x, fh, z)] = B.MAGMA;
        }

        // jasnogłazy zwisające pod stropem
        let prevAir = false;
        for (let y = fh + 1; y < CH; y++) {
          const i = idx(x, y, z);
          const id = d[i];
          if (id === B.AIR) { prevAir = true; continue; }
          if (prevAir && id === B.NETHERRACK && y > fh + 8 && hash(gx, y, gz, s + 55) < 0.07) {
            d[i] = B.GLOWSTONE;
            const depth = 1 + Math.floor(hash(gx, y - 1, gz, s + 56) * 3);
            for (let k = 1; k <= depth && y - k > fh + 6; k++) {
              if (d[idx(x, y - k, z)] !== B.AIR) break;
              d[idx(x, y - k, z)] = B.GLOWSTONE;
            }
          }
          prevAir = false;
        }
      }
    }

    // bazaltowe filary od podłogi do stropu
    if (hash(ox, oz, 3, s + 101) < 0.10) {
      const px = 2 + Math.floor(hash(ox, 4, oz, s + 102) * (CS - 4));
      const pz = 2 + Math.floor(hash(ox, 5, oz, s + 103) * (CS - 4));
      const fh = this.netherFloorH(ox + px, oz + pz);
      const ch = this.netherCeilH(ox + px, oz + pz);
      for (let y = fh + 1; y < ch; y++) d[idx(px, y, pz)] = B.BASALT;
    }

    c.maxY = Math.min(CH - 1, maxY);
    this.applyMods(c);
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
    const c = this.chunkFast(cx, cz);
    if (!c) return B.STONE;
    return c.data[idx(x - cx * CS, y, z - cz * CS)];
  }

  heightAt(x: number, z: number): number {
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const c = this.chunkFast(cx, cz) ?? this.getChunk(cx, cz);
    return c.heightMap[(z - cz * CS) * CS + (x - cx * CS)];
  }

  setBlock(x: number, y: number, z: number, id: number) {
    if (y < 0 || y >= CH) return;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const c = this.getChunk(cx, cz);
    const lx = x - cx * CS, lz = z - cz * CS;
    const i = idx(lx, y, lz);
    const previous = c.data[i];
    if (previous === id) return;
    c.data[i] = id;
    if (y + 2 > c.maxY) c.maxY = Math.min(CH - 1, y + 2);
    c.recomputeHeight(lx, lz);
    // 2.8: utrzymuje indeks świateł w zgodzie z terenem (bez pełnego skanu
    // przy stawianiu zwykłego bloku).
    if (EMIT[previous] || EMIT[id]) c.refreshEmitters();
    c.revision++;
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
    // Block light (torches, lava, lit furnaces) spread a few blocks across chunk borders.
    // The BFS scratch is module-level: buildMesh never runs re-entrantly, so a
    // rebuild only fills the buffer instead of allocating 128 KB every time.
    const PAD = 8;
    const LW = CS + PAD * 2;
    const need = LW * LW * CH;
    if (!lightScratch || lightScratch.length < need) lightScratch = new Uint8Array(need);
    else lightScratch.fill(0);
    const Lmap = lightScratch;
    const lat = (x: number, y: number, z: number) => (y * LW + (z + PAD)) * LW + (x + PAD);
    qx.length = 0;
    qy.length = 0;
    qz.length = 0;
    const seed = (x: number, y: number, z: number, lv: number) => {
      if (y < 0 || y >= CH || x < -PAD || x >= CS + PAD || z < -PAD || z >= CS + PAD) return;
      const i = lat(x, y, z);
      if (Lmap[i] >= lv) return;
      Lmap[i] = lv;
      qx.push(x); qy.push(y); qz.push(z);
    };
    // 2.8: tylko faktyczne źródła światła (indeks emitters), a nie 295 tys.
    // bloków sąsiadów skanowanych przy każdym przebudowaniu siatki.
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const chunk = neigh[(dz + 1) * 3 + (dx + 1)];
        const ox = dx * CS;
        const oz = dz * CS;
        const sources = chunk.emitters;
        for (let s = 0; s < sources.length; s++) {
          const li = sources[s];
          const y = Math.floor(li / (CS * CS));
          const rem = li - y * CS * CS;
          const z = Math.floor(rem / CS);
          const x = rem - z * CS;
          const wx = ox + x, wz = oz + z;
          if (wx < -PAD || wx >= CS + PAD || wz < -PAD || wz >= CS + PAD) continue;
          const e = EMIT[chunk.data[li]];
          if (e) seed(wx, y, wz, e);
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
    // 2.8.1: światło nieba liczone kolumnowo, z góry na dół. Liście tłumią je
    // stopniowo, więc pod koroną jest miękkie, zielone półcienie zamiast
    // czarnego pnia; pełny blok odcina światło całkowicie (jaskinie).
    const skyNeed = SKY_W * SKY_W * CH;
    if (!skyScratch || skyScratch.length < skyNeed) skyScratch = new Float32Array(skyNeed);
    else skyScratch.fill(0, 0, skyNeed);
    const skyMap = skyScratch;
    const skyIndex = (x: number, y: number, z: number) => (y * SKY_W + (z + SKY_PAD)) * SKY_W + (x + SKY_PAD);
    if (c.nether) {
      // 2.8.1: w Netherze nie ma nieba – otwarta jaskinia między podłogą
      // a stropem liczy się jako „na zewnątrz”, inaczej strop gasi cały wymiar.
      const floorLocal = (x: number, z: number): number => {
        const ncx = x < 0 ? 0 : x >= CS ? 2 : 1;
        const ncz = z < 0 ? 0 : z >= CS ? 2 : 1;
        const n = neigh[ncz * 3 + ncx];
        return n.heightMap[(z - (ncz - 1) * CS) * CS + (x - (ncx - 1) * CS)];
      };
      for (let z = -SKY_PAD; z < CS + SKY_PAD; z++) {
        for (let x = -SKY_PAD; x < CS + SKY_PAD; x++) {
          const fh = floorLocal(x, z);
          for (let y = 0; y < CH; y++) {
            skyMap[skyIndex(x, y, z)] = y >= fh ? 1 : Math.max(MIN_CAVE_SKY, Math.pow(0.72, fh - y));
          }
        }
      }
    } else {
      for (let z = -SKY_PAD; z < CS + SKY_PAD; z++) {
        for (let x = -SKY_PAD; x < CS + SKY_PAD; x++) {
          let sky = 1;
          for (let y = CH - 1; y >= 0; y--) {
            skyMap[skyIndex(x, y, z)] = sky;
            const id = get(x, y, z);
            if (IS_OPAQUE[id]) {
              if (IS_LEAFY[id]) {
                sky *= LEAF_SHADE;
                if (sky < MIN_SKY) sky = MIN_SKY;
              } else {
                // Poniżej pełnego bloku nie ma bezpośredniego nieba. Bufor
                // zostaje wyzerowany (szybkie `fill` na starcie), a `skyLight`
                // zamienia zero na nikłą poświatę jaskiń – bez zapisywania
                // setek komórek na kolumnę.
                break;
              }
            }
          }
        }
      }
    }
    const skyLight = (x: number, y: number, z: number): number => {
      if (y < 0) return 0;
      if (y >= CH) return 1;
      const v = skyMap[skyIndex(x, y, z)];
      return v > 0 ? v : MIN_CAVE_SKY;
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
            const uvs = [[0, 0], [1, 0], [0, 1], [1, 1]];
            for (const q of quads) {
              const n = buf.count;
              for (let k = 0; k < 4; k++) {
                const uv = tileUV(t, uvs[k][0], uvs[k][1]);
                buf.vertex(wx + q[k][0], y + q[k][1] * 0.95, wz + q[k][2], uv[0], uv[1], skyB, skyB, skyB, blkB);
              }
              buf.quad(n);
            }
            continue;
          }
          if (rt === 3) {
            // slab
            const top = isSlabTop(id);
            const y0 = top ? 0.5 : 0;
            const y1 = top ? 1 : 0.5;
            const sky = skyLight(x, y, z);
            const blk = Math.max(blockLight(x, y, z), EMIT[id] / 15);
            addBox(buf, ox + x, y, oz + z, 0, y0, 0, 1, y1, 1, tileFor(id, 0), sky, blk);
            continue;
          }
          if (rt === 4) {
            // stairs – bottom slab + top quarter
            const facing = stairsFacing(id);
            const sky = skyLight(x, y, z);
            const blk = Math.max(blockLight(x, y, z), EMIT[id] / 15);
            // bottom half
            addBox(buf, ox + x, y, oz + z, 0, 0, 0, 1, 0.5, 1, tileFor(id, 0), sky, blk);
            // top quarter depending on facing
            let x0 = 0, x1 = 1, z0 = 0, z1 = 1;
            if (facing === 0) z0 = 0; // north: top occupies north half (z 0-0.5)
            if (facing === 0) { z0 = 0; z1 = 0.5; }
            else if (facing === 2) { z0 = 0.5; z1 = 1; }
            else if (facing === 1) { x0 = 0.5; x1 = 1; }
            else if (facing === 3) { x0 = 0; x1 = 0.5; }
            addBox(buf, ox + x, y, oz + z, x0, 0.5, z0, x1, 1, z1, tileFor(id, 0), sky, blk);
            continue;
          }
          if (rt === 5) {
            // portal – thin, wobble
            const sky = skyLight(x, y, z);
            const blk = Math.max(blockLight(x, y, z), EMIT[id] / 15);
            // check orientation by neighbors: if obsidian on X sides, portal plane is Z, else X
            const obsX = IS_OPAQUE[get(x - 1, y, z)] || IS_OPAQUE[get(x + 1, y, z)];
            const obsZ = IS_OPAQUE[get(x, y, z - 1)] || IS_OPAQUE[get(x, y, z + 1)];
            if (obsX && !obsZ) {
              addBox(buf, ox + x, y, oz + z, 0.35, 0, 0, 0.65, 1, 1, tileFor(id, 0), sky, blk);
            } else {
              addBox(buf, ox + x, y, oz + z, 0, 0, 0.35, 1, 1, 0.65, tileFor(id, 0), sky, blk);
            }
            continue;
          }
          if (rt === 6) {
            // rail – flat on ground
            const sky = skyLight(x, y, z);
            const blk = Math.max(blockLight(x, y, z), EMIT[id] / 15);
            addBox(buf, ox + x, y, oz + z, 0, 0, 0, 1, 0.1, 1, tileFor(id, 0), sky, blk);
            continue;
          }
          const isLiquid = rt === 2;
          const liquidTopLow = isLiquid && get(x, y + 1, z) !== id;
          for (let f = 0; f < 6; f++) {
            const F = FACES[f];
            const nx = x + F.dir[0], ny = y + F.dir[1], nz = z + F.dir[2];
            const nb = get(nx, ny, nz);
            if (IS_OPAQUE[nb]) continue;
            if (nb === id && id !== B.LEAVES && id !== B.BIRCH_LEAVES && id !== B.ACACIA_LEAVES && id !== B.JUNGLE_LEAVES) continue;
            if (isLiquid && (RENDER[nb] === 2)) continue;
            const t = tileFor(id, f);
            const sky = skyLight(nx, ny, nz);
            const blk = Math.max(blockLight(nx, ny, nz), EMIT[id] / 15);
            // 2.8: fala wody – tylko górna tafla porusza się w shaderze.
            const wave = isLiquid && F.dir[1] === 1 ? 1 : 0;
            const base = buf.count;
            let ao0 = 3, ao1 = 3, ao2 = 3, ao3 = 3;
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
                // 2.8.1: liście nie są pełnym okluderem – inaczej pień w koronie
                // dostawał AO=0 i zlewał się w czarną plamę.
                const a = OCCLUDES[get(nx + s1x, ny + s1y, nz + s1z)];
                const b = OCCLUDES[get(nx + s2x, ny + s2y, nz + s2z)];
                const cc = OCCLUDES[get(nx + s1x + s2x, ny + s1y + s2y, nz + s1z + s2z)];
                ao = a && b ? 0 : 3 - (a + b + cc);
              }
              if (k === 0) ao0 = ao; else if (k === 1) ao1 = ao; else if (k === 2) ao2 = ao; else ao3 = ao;
              let vy = y + py;
              if (liquidTopLow && py === 1) vy -= 0.12;
              if (id === B.CACTUS) {
                if (f === 0) px = 0.0625; else if (f === 1) px = 0.9375;
                if (f === 4) pz = 0.0625; else if (f === 5) pz = 0.9375;
              }
              const uv = tileUV(t, cr[3], cr[4]);
              const shadeAo = F.shade * AO_CURVE[ao];
              const skyB = shadeAo * sky;
              const br = skyB * skyB;
              const bb = shadeAo * blk;
              buf.vertex(ox + x + px, vy, oz + z + pz, uv[0], uv[1], br, br, br, bb * bb, wave);
            }
            buf.quad(base, ao0 + ao3 > ao1 + ao2);
          }
        }

    return bufs.map((b) => b.geometry());
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
