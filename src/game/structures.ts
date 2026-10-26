/** Seeded, chunk-order-independent landmarks inspired by vanilla structures.
 * Templates are deliberately local: no flattened discs or world.setBlock calls.
 */
import { B } from './blocks';
import { CH, CS } from './constants';
import { villagesOverlapping, type VillageContext } from './village';

export type StructureKind = 'desert_temple' | 'jungle_ruin' | 'swamp_hut' | 'ruined_portal';
export interface Structure {
  kind: StructureKind;
  x: number;
  y: number;
  z: number;
  rotation: number;
  seed: number;
}
export interface StructureBlock { x: number; y: number; z: number; id: number }
export const STRUCTURE_CELL = 192;
const RADIUS = 13;
function random(x: number, z: number, seed: number, salt: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 144665) ^ salt;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const cache = new WeakMap<VillageContext, Map<string, Structure | null>>();

export function structureInCell(gx: number, gz: number, ctx: VillageContext): Structure | null {
  if (ctx.flat) return null;
  let entries = cache.get(ctx);
  if (!entries) { entries = new Map(); cache.set(ctx, entries); }
  const key = `${gx},${gz}`;
  if (entries.has(key)) return entries.get(key)!;
  const make = (): Structure | null => {
    if (random(gx, gz, ctx.seed, 711) > 0.65) return null;
    const x = gx * STRUCTURE_CELL + 24 + Math.floor(random(gx, gz, ctx.seed, 712) * 144);
    const z = gz * STRUCTURE_CELL + 24 + Math.floor(random(gx, gz, ctx.seed, 713) * 144);
    const surface = ctx.surface(x, z);
    const kind: StructureKind = surface.biome === 'Pustynia' ? 'desert_temple'
      : surface.biome === 'Dżungla' ? 'jungle_ruin'
      : surface.biome === 'Bagno' ? 'swamp_hut' : 'ruined_portal';
    if (surface.biome === 'Ocean' || surface.biome === 'Plaża' || surface.biome === 'Nether') return null;
    if (surface.h < ctx.sea && kind !== 'swamp_hut') return null;
    let min = surface.h, max = surface.h;
    for (const dx of [-10, 0, 10]) for (const dz of [-10, 0, 10]) {
      const h = ctx.surface(x + dx, z + dz).h;
      min = Math.min(min, h); max = Math.max(max, h);
    }
    if (max - min > (kind === 'swamp_hut' ? 7 : 5) || max > CH - 18) return null;
    if (villagesOverlapping(x - RADIUS, z - RADIUS, x + RADIUS, z + RADIUS, ctx).length) return null;
    return { kind, x, z, y: kind === 'swamp_hut' ? Math.max(max, ctx.sea) + 2 : surface.h,
      rotation: Math.floor(random(gx, gz, ctx.seed, 714) * 4), seed: ctx.seed };
  };
  const result = make();
  if (entries.size > 512) entries.clear();
  entries.set(key, result);
  return result;
}

/** Unique final blocks in world coordinates (explicit air carves the interiors). */
export function structureBlocks(s: Structure, ctx: VillageContext): StructureBlock[] {
  const blocks = new Map<string, StructureBlock>();
  const rotate = (x: number, z: number): [number, number] => {
    switch (s.rotation) { case 1: return [-z, x]; case 2: return [-x, -z]; case 3: return [z, -x]; default: return [x, z]; }
  };
  const put = (x: number, y: number, z: number, id: number) => {
    const [rx, rz] = rotate(x, z);
    // Directional stairs and ladders rotate together with the template.
    for (const base of [B.OAK_STAIRS_N, B.COBBLE_STAIRS_N, B.SANDSTONE_STAIRS_N, B.STONE_BRICK_STAIRS_N, B.LADDER_N]) {
      if (id >= base && id < base + 4) { id = base + (id - base + s.rotation) % 4; break; }
    }
    if (id === B.LOOT_CHEST) id = [B.LOOT_CHEST, B.LOOT_CHEST_W, B.LOOT_CHEST_N, B.LOOT_CHEST_E][s.rotation];
    const wx = s.x + rx, wz = s.z + rz, wy = s.y + y;
    if (wy > 0 && wy < CH) blocks.set(`${wx},${wy},${wz}`, { x: wx, y: wy, z: wz, id });
  };
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, id: number) => {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) put(x, y, z, id);
  };
  const support = (x: number, z: number, id: number, to = -1) => {
    const [rx, rz] = rotate(x, z);
    const natural = ctx.surface(s.x + rx, s.z + rz).h - s.y;
    for (let y = natural; y <= to; y++) put(x, y, z, id);
  };
  if (s.kind === 'desert_temple') {
    // Broad sandstone pyramid, twin decorated entrance towers and a buried vault.
    for (let layer = 0; layer <= 6; layer++) {
      const r = 8 - layer;
      box(-r, layer, -r, r, layer, r, B.SANDSTONE);
    }
    box(-5, 1, -5, 5, 4, 5, B.AIR);
    for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) support(x, z, B.SANDSTONE);
    for (const tower of [-8, 8]) {
      box(tower - 2, 0, -10, tower + 2, 9, -6, B.SANDSTONE);
      box(tower - 1, 1, -9, tower + 1, 8, -7, B.AIR);
      for (let h = 2; h <= 7; h++) put(tower, h, -10, h === 4 ? B.WOOL_BLUE : B.TERRACOTTA);
      for (const dx of [-2, 2]) box(tower + dx, 10, -10, tower + dx, 10, -6, B.SANDSTONE_SLAB);
      box(tower - 2, 10, -10, tower + 2, 10, -10, B.SANDSTONE_SLAB);
      for (let x = tower - 2; x <= tower + 2; x++) for (let z = -10; z <= -6; z++) support(x, z, B.SANDSTONE);
    }
    box(-2, 1, -10, 2, 4, -5, B.SANDSTONE);
    box(-1, 1, -10, 1, 3, -4, B.AIR);
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) put(x, 0, z, Math.abs(x) + Math.abs(z) === 2 ? B.TERRACOTTA : B.SANDSTONE);
    put(0, 0, 0, B.WOOL_BLUE);
    box(-3, -7, -3, 3, -2, 3, B.SANDSTONE);
    box(-2, -6, -2, 2, -2, 2, B.AIR);
    // Side shaft with supported ladder, not an inaccessible sealed loot box.
    box(3, -6, 0, 4, 2, 1, B.AIR);
    box(5, -6, 0, 5, 2, 1, B.SANDSTONE);
    for (let y = -6; y <= 1; y++) put(4, y, 0, B.LADDER_E);
    put(2, -6, 0, B.AIR);
    for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) put(x, -6, z, B.LOOT_CHEST);
  } else if (s.kind === 'jungle_ruin') {
    const stone = (x: number, y: number, z: number) => random(s.x + x, s.z + z, s.seed, y + 81) < 0.65 ? B.MOSSY : B.COBBLE;
    for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) {
      support(x, z, B.COBBLE);
      put(x, 0, z, stone(x, 0, z));
      for (let y = 1; y <= 5; y++) {
        const edge = Math.abs(x) === 5 || Math.abs(z) === 5;
        put(x, y, z, edge && !(z === -5 && Math.abs(x) <= 1 && y <= 3) ? stone(x, y, z) : B.AIR);
      }
    }
    // Receding cornices, broken upper chamber, overgrown buttresses.
    box(-6, 5, -6, 6, 5, 6, B.COBBLE_SLAB);
    box(-4, 6, -4, 4, 6, 4, B.MOSSY);
    box(-2, 6, -2, 2, 6, 2, B.AIR);
    for (const x of [-3, 3]) for (const z of [-3, 3]) box(x, 6, z, x, 8, z, B.MOSSY);
    // Exterior stairs climb beside the temple without blocking the front door.
    for (let z = -3; z <= 3; z++) {
      const rise = z + 3;
      box(5, 0, z, 7, rise - 1, z, B.MOSSY);
      box(5, rise, z, 7, rise, z, B.COBBLE_STAIRS_S);
      for (let x = 5; x <= 7; x++) support(x, z, B.COBBLE);
    }
    put(-3, 1, 3, B.LOOT_CHEST);
    put(3, 1, 3, B.LOOT_CHEST);
    for (const x of [-5, 5]) for (let z = -3; z <= 4; z += 2) {
      put(x, 5, z, B.JUNGLE_LEAVES); put(x, 4, z, B.JUNGLE_LEAVES);
    }
  } else if (s.kind === 'swamp_hut') {
    // Narrow cabin on four log stilts, porch, railing, gable roof, workstations.
    for (const x of [-3, 3]) for (const z of [-3, 3]) { support(x, z, B.LOG, 3); }
    box(-3, 0, -5, 3, 0, 3, B.PLANKS);
    box(-2, 1, -2, 2, 4, 2, B.AIR);
    for (let y = 1; y <= 3; y++) {
      box(-3, y, -3, 3, y, -3, B.PLANKS); box(-3, y, 3, 3, y, 3, B.PLANKS);
      box(-3, y, -3, -3, y, 3, B.PLANKS); box(3, y, -3, 3, y, 3, B.PLANKS);
    }
    box(0, 1, -3, 0, 2, -3, B.AIR);
    for (const x of [-3, 3]) { put(x, 2, 0, B.AIR); put(x, 1, -4, B.FENCE); put(x, 1, -5, B.FENCE); }
    for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) {
      const rise = Math.min(x + 4, 4 - x);
      put(x, 4 + rise, z, x === 0 ? B.OAK_SLAB : x < 0 ? B.OAK_STAIRS_E : B.OAK_STAIRS_W);
      if (Math.abs(z) === 3) for (let y = 4; y < 4 + rise; y++) put(x, y, z, B.PLANKS);
    }
    put(-2, 1, 2, B.CRAFTING); put(2, 1, 2, B.BREWING); put(2, 1, 1, B.LOOT_CHEST);
    support(0, -5, B.LOG, -1);
    for (let y = -2; y <= 0; y++) put(0, y, -6, B.LADDER_S);
  } else {
    // Partial frame on a weathered, irregular patch, never an active portal.
    for (let x = -6; x <= 6; x++) for (let z = -5; z <= 5; z++) {
      if (x * x / 36 + z * z / 25 > 0.8 + random(s.x + x, s.z + z, s.seed, 61) * 0.3) continue;
      const [rx, rz] = rotate(x, z);
      const y = ctx.surface(s.x + rx, s.z + rz).h - s.y;
      put(x, y, z, random(x, z, s.seed, 62) < 0.2 ? B.MAGMA : B.NETHERRACK);
      if (random(x, z, s.seed, 63) < 0.18) put(x, y + 1, z, B.STONE_BRICK_STAIRS_N + Math.floor(random(x, z, s.seed, 64) * 4));
    }
    for (let x = -2; x <= 2; x++) { support(x, 0, B.STONE_BRICKS, 0); put(x, 1, 0, B.OBSIDIAN); }
    for (let y = 2; y <= 6; y++) put(-2, y, 0, y === 4 ? B.CRYING_OBSIDIAN : B.OBSIDIAN);
    for (let y = 2; y <= 4; y++) put(2, y, 0, B.OBSIDIAN);
    put(-1, 6, 0, B.OBSIDIAN); put(0, 6, 0, B.CRYING_OBSIDIAN);
    put(-2, 7, 0, B.GOLD_BLOCK);
    support(4, 2, B.STONE_BRICKS, 0); put(4, 1, 2, B.LOOT_CHEST);
  }
  return [...blocks.values()];
}

export function applyStructures(data: Uint16Array, cx: number, cz: number, ctx: VillageContext, mask: Uint8Array): number {
  if (ctx.flat) return 0;
  const ox = cx * CS, oz = cz * CS;
  let top = 0;
  for (let gz = Math.floor((oz - RADIUS) / STRUCTURE_CELL); gz <= Math.floor((oz + CS - 1 + RADIUS) / STRUCTURE_CELL); gz++) {
    for (let gx = Math.floor((ox - RADIUS) / STRUCTURE_CELL); gx <= Math.floor((ox + CS - 1 + RADIUS) / STRUCTURE_CELL); gx++) {
      const s = structureInCell(gx, gz, ctx);
      if (!s || Math.abs(s.x - (ox + 7.5)) > RADIUS + 8 || Math.abs(s.z - (oz + 7.5)) > RADIUS + 8) continue;
      for (const b of structureBlocks(s, ctx)) {
        const x = b.x - ox, z = b.z - oz;
        if (x < 0 || x >= CS || z < 0 || z >= CS) continue;
        data[(b.y * CS + z) * CS + x] = b.id;
        mask[z * CS + x] = 1;
        top = Math.max(top, b.y);
      }
    }
  }
  return top;
}
