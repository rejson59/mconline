import * as THREE from "three";
import { IS_OPAQUE, IS_LEAFY, isWater } from "./blocks";
import { CH, CS } from "./constants";
import type { World, Chunk } from "./world";

export const HELD_FIELD_RADIUS = 14;
export const HELD_FIELD_SIZE = HELD_FIELD_RADIUS * 2 + 1;
export const HELD_FIELD_SOURCES = 5;
const N = HELD_FIELD_SIZE,
  PLANE = N * N,
  WIDTH = N * HELD_FIELD_SOURCES;
export interface FieldSource {
  x: number;
  y: number;
  z: number;
  strength: number;
}
interface Stamp {
  x: number;
  y: number;
  z: number;
  chunks: (Chunk | undefined)[];
  revisions: number[];
}

/** Small, reusable six-neighbour light volumes. No terrain generation and no
 * meshing dependency: both synchronous and worker-built terrain use this atlas.
 * Chunk identity AND revision invalidate fields, including unload/reload. */
export class HeldLightField {
  readonly data = new Uint8Array(WIDTH * PLANE);
  readonly texture = new THREE.DataTexture(
    this.data,
    WIDTH,
    PLANE,
    THREE.RedFormat,
  );
  private levels = new Uint8Array(N * PLANE);
  private buckets = Array.from({ length: 15 }, () => [] as number[]);
  private stamps: (Stamp | undefined)[] = [];
  builds = 0;
  constructor() {
    this.texture.magFilter = this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.unpackAlignment = 1;
    this.texture.needsUpdate = true;
  }
  update(
    world: Pick<World, "chunks">,
    sources: readonly FieldSource[],
  ): boolean {
    let changed = false;
    for (let slot = 0; slot < HELD_FIELD_SOURCES; slot++) {
      const source = sources[slot];
      if (
        !source ||
        !(source.strength > 0 && Number.isFinite(source.strength)) ||
        ![source.x, source.y, source.z].every(
          (n) =>
            Number.isSafeInteger(Math.floor(n)) &&
            Math.abs(n) < Number.MAX_SAFE_INTEGER - 32,
        )
      ) {
        if (this.stamps[slot]) {
          this.clear(slot);
          this.stamps[slot] = undefined;
          changed = true;
        }
        continue;
      }
      const x = Math.floor(source.x),
        y = Math.floor(source.y),
        z = Math.floor(source.z);
      const chunks: (Chunk | undefined)[] = [],
        revisions: number[] = [];
      for (
        let cz = Math.floor((z - 14) / CS);
        cz <= Math.floor((z + 14) / CS);
        cz++
      )
        for (
          let cx = Math.floor((x - 14) / CS);
          cx <= Math.floor((x + 14) / CS);
          cx++
        ) {
          const c = world.chunks.get(`${cx},${cz}`);
          chunks.push(c);
          revisions.push(c?.revision ?? -1);
        }
      const old = this.stamps[slot];
      if (
        old &&
        old.x === x &&
        old.y === y &&
        old.z === z &&
        chunks.length === old.chunks.length &&
        chunks.every(
          (c, i) => c === old.chunks[i] && revisions[i] === old.revisions[i],
        )
      )
        continue;
      this.stamps[slot] = { x, y, z, chunks, revisions };
      this.build(world, slot, x, y, z);
      changed = true;
    }
    if (changed) this.texture.needsUpdate = true;
    return changed;
  }
  private clear(slot: number) {
    for (let row = 0; row < PLANE; row++)
      this.data.fill(0, row * WIDTH + slot * N, row * WIDTH + (slot + 1) * N);
  }
  private build(
    world: Pick<World, "chunks">,
    slot: number,
    sx: number,
    sy: number,
    sz: number,
  ) {
    this.builds++;
    this.clear(slot);
    this.levels.fill(0);
    const get = (x: number, y: number, z: number) => {
      if (y < 0 || y >= CH) return -1;
      const cx = Math.floor(x / CS),
        cz = Math.floor(z / CS);
      const chunk = world.chunks.get(`${cx},${cz}`);
      if (!chunk) return -1;
      return chunk.data[(y * CS + z - cz * CS) * CS + x - cx * CS];
    };
    const pass = (id: number) => id >= 0 && !(IS_OPAQUE[id] && !IS_LEAFY[id]);
    if (!pass(get(sx, sy, sz))) return;
    for (const bucket of this.buckets) bucket.length = 0;
    const start = 14 * PLANE + 14 * N + 14;
    this.levels[start] = 14;
    this.buckets[14].push(start);
    for (let level = 14; level > 0; level--)
      for (const i of this.buckets[level]) {
        if (this.levels[i] !== level) continue;
        const y = Math.floor(i / PLANE),
          z = Math.floor(i / N) % N,
          x = i % N;
        this.data[(y * N + z) * WIDTH + slot * N + x] = Math.round(
          255 * Math.pow(level / 14, 1.6),
        );
        if (level <= 1) continue;
        for (let d = 0; d < 6; d++) {
          const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0);
          const ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
          const nz = z + (d === 4 ? 1 : d === 5 ? -1 : 0);
          if (nx < 0 || ny < 0 || nz < 0 || nx >= N || ny >= N || nz >= N)
            continue;
          const ni = ny * PLANE + nz * N + nx;
          // Descending buckets preserve strongest paths through water/leaves.
          const id = get(sx + nx - 14, sy + ny - 14, sz + nz - 14);
          if (!pass(id)) continue;
          const next = level - (IS_LEAFY[id] || isWater(id) ? 2 : 1);
          if (next <= this.levels[ni]) continue;
          this.levels[ni] = next;
          this.buckets[next].push(ni);
        }
      }
  }
  sample(
    slot: number,
    source: FieldSource,
    x: number,
    y: number,
    z: number,
  ): number {
    const nx = Math.floor(x) - Math.floor(source.x) + 14;
    const ny = Math.floor(y) - Math.floor(source.y) + 14;
    const nz = Math.floor(z) - Math.floor(source.z) + 14;
    if ([nx, ny, nz].some((n) => n < 0 || n >= N)) return 0;
    return this.data[(ny * N + nz) * WIDTH + slot * N + nx] / 255;
  }
  dispose() {
    this.texture.dispose();
  }
}

/** Shared by terrain's actual fragment shader; sample on the air side of a face. */
export const heldFieldGLSL = `
uniform sampler2D uHeldField;
float heldVisibility(vec3 p, vec3 source, float slot) {
  vec3 cell = floor(p) - floor(source) + vec3(14.0);
  if (any(lessThan(cell, vec3(0.0))) || any(greaterThanEqual(cell, vec3(29.0)))) return 0.0;
  vec2 uv = vec2((slot * 29.0 + cell.x + 0.5) / 145.0,
                 (cell.y * 29.0 + cell.z + 0.5) / 841.0);
  return texture2D(uHeldField, uv).r;
}
`;
