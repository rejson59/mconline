/** Seeded, chunk-order-independent landmarks inspired by vanilla structures.
 * Templates are deliberately local: no flattened discs or world.setBlock calls.
 */
import { B } from './blocks';
import { CH, CS } from './constants';
import { villagesOverlapping, type VillageContext } from './village';

export type StructureKind = 'desert_temple' | 'jungle_ruin' | 'swamp_hut' | 'ruined_portal' | 'mineshaft' | 'crater';
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
export const ADVENTURE_CELL = 128;
export const ADVENTURE_RADIUS = 20;
const adventureCache = new WeakMap<VillageContext, Map<string, Structure | null>>();
const templateCache = new WeakMap<VillageContext, Map<Structure, StructureBlock[]>>();
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

/** Additional land sites, independently spaced from the biome landmarks. */
export function adventureInCell(gx: number, gz: number, ctx: VillageContext): Structure | null {
  if (ctx.flat) return null;
  let entries = adventureCache.get(ctx);
  if (!entries) { entries = new Map(); adventureCache.set(ctx, entries); }
  const key = `${gx},${gz}`;
  if (entries.has(key)) return entries.get(key)!;
  const make = (): Structure | null => {
    if (random(gx, gz, ctx.seed, 811) > 0.78) return null;
    const x = gx * ADVENTURE_CELL + 28 + Math.floor(random(gx, gz, ctx.seed, 812) * 72);
    const z = gz * ADVENTURE_CELL + 28 + Math.floor(random(gx, gz, ctx.seed, 813) * 72);
    const info = ctx.surface(x, z);
    if (['Ocean', 'Plaża', 'Nether'].includes(info.biome) || info.h <= ctx.sea + 2) return null;
    const roll = random(gx, gz, ctx.seed, 814);
    const kind: StructureKind = roll < 0.38 ? 'mineshaft' : roll < 0.64 ? 'crater' : 'ruined_portal';
    if ((kind === 'crater' && info.h < ctx.sea + 10) || (kind === 'mineshaft' && info.h < ctx.sea + 6)) return null;
    const heights: number[] = [];
    for (const dx of [-18, 0, 18]) for (const dz of [-18, 0, 18]) heights.push(ctx.surface(x + dx, z + dz).h);
    if (Math.max(...heights) - Math.min(...heights) > 6 || Math.min(...heights) <= ctx.sea + 2 || Math.max(...heights) > CH - 18) return null;
    if (villagesOverlapping(x - ADVENTURE_RADIUS, z - ADVENTURE_RADIUS, x + ADVENTURE_RADIUS, z + ADVENTURE_RADIUS, ctx).length) return null;
    // Only query the original layer here: no recursive neighbour generation.
    for (let cz = Math.floor((z - 40) / STRUCTURE_CELL); cz <= Math.floor((z + 40) / STRUCTURE_CELL); cz++) {
      for (let cx = Math.floor((x - 40) / STRUCTURE_CELL); cx <= Math.floor((x + 40) / STRUCTURE_CELL); cx++) {
        const other = structureInCell(cx, cz, ctx);
        if (other && Math.abs(other.x - x) <= RADIUS + ADVENTURE_RADIUS + 2 && Math.abs(other.z - z) <= RADIUS + ADVENTURE_RADIUS + 2) return null;
      }
    }
    const rotation = Math.floor(random(gx, gz, ctx.seed, 815) * 4);
    const entrance = [[0, -16], [16, 0], [0, 16], [-16, 0]][rotation];
    const y = kind === 'mineshaft' ? ctx.surface(x + entrance[0], z + entrance[1]).h : info.h;
    return { kind, x, y, z, rotation, seed: ctx.seed };
  };
  const result = make();
  if (entries.size > 512) entries.clear();
  entries.set(key, result);
  return result;
}

/** Bounding-box query shared by generation and contextual treasure lookup. */
export function structuresOverlapping(x0: number, z0: number, x1: number, z1: number, ctx: VillageContext): Structure[] {
  if (ctx.flat) return [];
  const out: Structure[] = [];
  for (const [cell, radius, find] of [[STRUCTURE_CELL, RADIUS, structureInCell], [ADVENTURE_CELL, ADVENTURE_RADIUS, adventureInCell]] as const) {
    for (let gz = Math.floor((z0 - radius) / cell); gz <= Math.floor((z1 + radius) / cell); gz++) {
      for (let gx = Math.floor((x0 - radius) / cell); gx <= Math.floor((x1 + radius) / cell); gx++) {
        const site = find(gx, gz, ctx);
        if (site && site.x + radius >= x0 && site.x - radius <= x1 && site.z + radius >= z0 && site.z - radius <= z1) out.push(site);
      }
    }
  }
  return out;
}

export const STRUCTURE_LABELS: Record<StructureKind, string> = {
  desert_temple: 'Pustynna świątynia', jungle_ruin: 'Ruiny w dżungli', swamp_hut: 'Chatka na bagnie',
  ruined_portal: 'Zniszczony portal', mineshaft: 'Opuszczona kopalnia', crater: 'Krater',
};
export function structureKindFromName(name: string): StructureKind | null {
  const key = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const names: Record<string, StructureKind> = {
    kopalnia: 'mineshaft', mineshaft: 'mineshaft', krater: 'crater', crater: 'crater',
    portal: 'ruined_portal', ruined_portal: 'ruined_portal', swiatynia: 'desert_temple', desert_temple: 'desert_temple',
    ruiny: 'jungle_ruin', jungle_ruin: 'jungle_ruin', chatka: 'swamp_hut', swamp_hut: 'swamp_hut',
  };
  return Object.prototype.hasOwnProperty.call(names, key) ? names[key] : null;
}
/** Bounded metadata-only search: no chunks generated and no automatic teleport. */
export function nearestStructure(x: number, z: number, ctx: VillageContext, kind: StructureKind, radius = 768): { site: Structure; dist: number } | null {
  const range = Math.max(0, Math.min(1024, radius));
  let result: { site: Structure; dist: number } | null = null;
  for (const site of structuresOverlapping(x - range, z - range, x + range, z + range, ctx)) {
    if (site.kind !== kind) continue;
    const dist = Math.hypot(site.x - x, site.z - z);
    if (dist <= range && (!result || dist < result.dist)) result = { site, dist };
  }
  return result;
}

/** Unique final blocks in world coordinates (explicit air carves the interiors). */
export function structureBlocks(s: Structure, ctx: VillageContext): StructureBlock[] {
  let templates = templateCache.get(ctx);
  if (!templates) { templates = new Map(); templateCache.set(ctx, templates); }
  const existing = templates.get(s);
  if (existing) return existing;
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
  if (s.kind === 'mineshaft') {
    // A visible surface entrance leads down a staircase to a supported gallery.
    // Build shells first, then carve BOTH passages so intersections stay open.
    box(-2, -13, -4, 2, -7, 17, B.STONE);
    box(-17, -13, 6, 17, -7, 10, B.STONE);
    box(-1, -12, -4, 1, -12, 16, B.PLANKS);
    box(-16, -12, 7, 16, -12, 9, B.PLANKS);
    box(-1, -11, -4, 1, -8, 16, B.AIR);
    box(-16, -11, 7, 16, -8, 9, B.AIR);
    for (let z = -16; z <= -4; z++) {
      const floor = -z - 16;
      box(-2, floor - 1, z, 2, floor - 1, z, B.COBBLE);
      box(-2, floor, z, -2, 2, z, B.COBBLE);
      box(2, floor, z, 2, 2, z, B.COBBLE);
      box(-1, floor + 1, z, 1, 5, z, B.AIR);
      box(-1, floor, z, 1, floor, z, B.COBBLE_STAIRS_N);
    }
    for (const x of [-2, 2]) { support(x, -16, B.LOG, 4); box(x, 1, -16, x, 4, -16, B.LOG); }
    box(-2, 5, -16, 2, 5, -16, B.PLANKS);
    put(0, 4, -16, B.LANTERN);
    for (const z of [-2, 3, 13, 16]) {
      for (const x of [-1, 1]) box(x, -11, z, x, -9, z, B.FENCE);
      box(-1, -8, z, 1, -8, z, B.PLANKS);
    }
    for (const x of [-14, -8, 8, 14]) {
      for (const z of [7, 9]) box(x, -11, z, x, -9, z, B.FENCE);
      box(x, -8, 7, x, -8, 9, B.PLANKS);
    }
    for (let z = -3; z <= 16; z++) put(0, -11, z, B.RAIL);
    for (let x = -16; x <= 16; x++) put(x, -11, 8, B.RAIL);
    put(0, -9, -2, B.LANTERN); put(0, -9, 13, B.LANTERN);
    put(-15, -11, 9, B.LOOT_CHEST); put(15, -11, 7, B.LOOT_CHEST);
    for (const x of [-17, 17]) for (let z = 7; z <= 9; z++) put(x, -10, z, z === 8 ? B.IRON_ORE : B.COAL_ORE);
    // An isolated hot seam, away from the stair route and treasure cells.
    put(2, -11, 15, B.MAGMA); put(2, -10, 15, B.GOLD_ORE);
  } else if (s.kind === 'crater') {
    // Bowl follows local terrain; a broken basalt/gravel rim replaces no village.
    const depthAt = (x: number, z: number) => Math.max(1, Math.floor((1 - x * x / 144 - z * z / 100) * 7));
    const floorAt = (x: number, z: number) => {
      const [rx, rz] = rotate(x, z);
      return ctx.surface(s.x + rx, s.z + rz).h - s.y - depthAt(x, z);
    };
    const hot = random(s.x, s.z, s.seed, 908) < 0.6;
    for (let x = -12; x <= 12; x++) for (let z = -10; z <= 10; z++) {
      const r = x * x / 144 + z * z / 100;
      if (r > 0.88 + random(s.x + x, s.z + z, s.seed, 901) * 0.15) continue;
      const floor = floorAt(x, z), natural = floor + depthAt(x, z);
      const roll = random(s.x + x, s.z + z, s.seed, 902);
      put(x, floor - 1, z, B.STONE);
      put(x, floor, z, hot && r < 0.035 ? B.LAVA : hot && r < 0.2 ? B.MAGMA : roll < 0.3 ? B.BASALT : roll < 0.55 ? B.BLACKSTONE : roll < 0.85 ? B.GRAVEL : B.COAL_ORE);
      box(x, floor + 1, z, x, natural + 3, z, B.AIR);
      if (r > 0.8 && roll < 0.65) put(x, natural, z, roll < 0.3 ? B.BASALT : B.GRAVEL);
    }
    put(-8, floorAt(-8, 0), 0, B.BASALT);
    put(-8, floorAt(-8, 0) + 1, 0, B.LOOT_CHEST);
  } else if (s.kind === 'desert_temple') {
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
  const result = [...blocks.values()];
  if (templates.size >= 32) templates.clear();
  templates.set(s, result);
  return result;
}

export function applyStructures(data: Uint16Array, cx: number, cz: number, ctx: VillageContext, mask: Uint8Array, occupied?: Uint8Array): number {
  if (ctx.flat) return 0;
  const ox = cx * CS, oz = cz * CS;
  const surfaceHeights = new Int16Array(CS * CS).fill(-1);
  let top = 0;
  for (const s of structuresOverlapping(ox, oz, ox + CS - 1, oz + CS - 1, ctx)) {
    for (const b of structureBlocks(s, ctx)) {
      const x = b.x - ox, z = b.z - oz;
      if (x < 0 || x >= CS || z < 0 || z >= CS) continue;
      data[(b.y * CS + z) * CS + x] = b.id;
      const column = z * CS + x;
      if (occupied) occupied[column] = 1;
      if (surfaceHeights[column] < 0) surfaceHeights[column] = ctx.surface(b.x, b.z).h;
      // Underground galleries must not leave a bare T-shaped clearing above them.
      if (b.y >= surfaceHeights[column] - 1) mask[column] = 1;
      top = Math.max(top, b.y);
    }
  }
  return top;
}
