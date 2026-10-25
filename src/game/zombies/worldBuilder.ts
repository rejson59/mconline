/**
 * Builds a Zombies arena into the existing World via setBlock
 * Flat floor, walls, windows (with barricades), doors, perk machines as distinct blocks
 */
import { World } from '../world';
import { B } from '../blocks';
import type { ZombiesMapLayout } from './types';

function fill(world: World, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, id: number) {
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
  for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) {
    world.setBlock(x, y, z, id);
  }
}

function clearRoomInterior(world: World, y: number, height: number, x1: number, z1: number, x2: number, z2: number) {
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) {
    for (let y2 = y + 1; y2 <= y + height - 1; y2++) world.setBlock(x, y2, z, B.AIR);
    world.setBlock(x, y, z, B.PLANKS); // floor
    // ceiling
    world.setBlock(x, y + height, z, B.STONE_BRICKS);
  }
}

export function buildZombiesWorld(world: World, layout: ZombiesMapLayout) {
  // clear large area first (60x60 around)
  fill(world, -40, 62, -40, 50, 78, 65, B.AIR);

  // Ground bedrock at y=60
  fill(world, -40, 60, -40, 50, 60, 65, B.BEDROCK);
  fill(world, -40, 61, -40, 50, 63, 65, B.DIRT);
  fill(world, -40, 64, -40, 50, 64, 65, B.GRASS);

  // Build each room: hollow out, floor, ceiling, walls
  for (const r of layout.rooms) {
    const x1 = Math.min(r.x1, r.x2) - 1;
    const x2 = Math.max(r.x1, r.x2) + 1;
    const z1 = Math.min(r.z1, r.z2) - 1;
    const z2 = Math.max(r.z1, r.z2) + 1;
    // floor already via clearInterior
    clearRoomInterior(world, r.y, r.height, r.x1, r.z1, r.x2, r.z2);
    // walls (outer shell) – use bricks/stone
    for (let x = x1; x <= x2; x++) for (let dy = 1; dy < r.height; dy++) {
      const y = r.y + dy;
      if (world.getBlock(x, y, z1) === B.AIR) world.setBlock(x, y, z1, B.STONE_BRICKS);
      if (world.getBlock(x, y, z2) === B.AIR) world.setBlock(x, y, z2, B.STONE_BRICKS);
    }
    for (let z = z1; z <= z2; z++) for (let dy = 1; dy < r.height; dy++) {
      const y = r.y + dy;
      if (world.getBlock(x1, y, z) === B.AIR) world.setBlock(x1, y, z, B.STONE_BRICKS);
      if (world.getBlock(x2, y, z) === B.AIR) world.setBlock(x2, y, z, B.STONE_BRICKS);
    }
    // torches for light
    const cx = Math.floor((r.x1 + r.x2) / 2);
    const cz = Math.floor((r.z1 + r.z2) / 2);
    world.setBlock(cx, r.y + 3, cz, B.TORCH);
    world.setBlock(r.x1 + 2, r.y + 1, r.z1 + 2, B.TORCH);
    world.setBlock(r.x2 - 2, r.y + 1, r.z2 - 2, B.TORCH);
  }

  // Punch door holes (will be blocked by iron door visual if locked)
  for (const d of layout.doors) {
    // create opening 2x3
    for (let dy = 1; dy <= 3; dy++) for (let w = -1; w <= 1; w++) {
      const x = d.dir === 'z' ? d.x + w : d.x;
      const z = d.dir === 'x' ? d.z + w : d.z;
      const y = d.y + dy;
      if (d.locked) world.setBlock(x, y, z, B.IRON_BLOCK); // locked door visual
      else world.setBlock(x, y, z, B.AIR);
    }
    // price pedestal sign = chest below
    world.setBlock(d.x, d.y + 1, d.z - (d.dir === 'x' ? 1 : 0), B.CHEST);
  }

  // Windows: glass panes that zombies break through
  for (const w of layout.windowPositions) {
    for (let dy = 1; dy <= 2; dy++) world.setBlock(w.x, w.y + dy, w.z, B.GLASS);
    // barricade = planks in front
    world.setBlock(w.x + (w.x < 0 ? 1 : -1), w.y + 1, w.z, B.PLANKS);
  }

  // Shops: use distinct blocks as markers (will be raycasted)
  for (const s of layout.shops) {
    let block: number = B.CRAFTING;
    if (s.kind === 'weapon_wall') block = B.CRAFTING; // rifle on wall
    else if (s.kind === 'perk') block = B.ENCHANT; // perk machine
    else if (s.kind === 'ultimate') block = B.ANVIL; // ultimate
    else if (s.kind === 'mystery') block = B.CHEST; // mystery chest
    else if (s.kind === 'armor') block = B.IRON_BLOCK;
    else if (s.kind === 'team') block = B.NOTE_BLOCK;
    world.setBlock(s.x, s.y + 1, s.z, block);
    // sign above
    world.setBlock(s.x, s.y + 2, s.z, B.GLASS);
  }

  // Power switch: lever at power room
  if (layout.meta.powerRoomId) {
    const pr = layout.rooms.find(r => r.id === layout.meta.powerRoomId);
    if (pr) {
      const cx = Math.floor((pr.x1 + pr.x2) / 2);
      const cz = Math.floor((pr.z1 + pr.z2) / 2);
      world.setBlock(cx, pr.y + 2, cz - 1, B.LEVER);
      world.setBlock(cx, pr.y + 1, cz - 1, B.REDSTONE_BLOCK);
    }
  }

  // spawn chests loot
  const spawn = layout.spawnPoints[0];
  if (spawn) world.setBlock(spawn.x, spawn.y, spawn.z, B.LOOT_CHEST);

  return layout;
}

export function unlockDoor(world: World, door: { x: number; y: number; z: number; dir: 'x' | 'z' }) {
  for (let dy = 1; dy <= 3; dy++) for (let w = -1; w <= 1; w++) {
    const x = door.dir === 'z' ? door.x + w : door.x;
    const z = door.dir === 'x' ? door.z + w : door.z;
    const y = door.y + dy;
    const cur = world.getBlock(x, y, z);
    if (cur === B.IRON_BLOCK) world.setBlock(x, y, z, B.AIR);
  }
}
