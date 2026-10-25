/**
 * Builds a Zombies arena into the existing World via setBlock
 * 3.1 – tematyczne pokoje 1:1 Dead End inspirowane Hypixel: Alley/Office/Gallery/Hotel/Apartments/Power/Rooftop/Garden
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
    world.setBlock(x, y + height, z, B.STONE_BRICKS);
  }
}

type RoomTheme = { wall: number; floor: number; ceil: number; accent?: number };

function themeFor(roomId: string): RoomTheme {
  switch (roomId) {
    case 'alley': return { wall: B.STONE_BRICKS, floor: B.COBBLE, ceil: B.STONE, accent: B.FENCE };
    case 'office': return { wall: B.PLANKS, floor: B.PLANKS, ceil: B.STONE, accent: B.BOOKSHELF };
    case 'gallery': return { wall: B.QUARTZ_BLOCK, floor: B.STONE, ceil: B.QUARTZ_BLOCK, accent: B.WOOL_WHITE };
    case 'hotel': return { wall: B.BRICK, floor: B.WOOL_RED, ceil: B.PLANKS, accent: B.WOOL_WHITE };
    case 'apartments': return { wall: B.SANDSTONE, floor: B.PLANKS, ceil: B.STONE, accent: B.WOOL_GRAY };
    case 'powerstation': return { wall: B.STONE, floor: B.STONE_BRICKS, ceil: B.IRON_BLOCK, accent: B.REDSTONE_BLOCK };
    case 'rooftop': return { wall: B.STONE, floor: B.STONE, ceil: B.AIR, accent: B.FENCE };
    case 'garden': return { wall: B.LEAVES, floor: B.GRASS, ceil: B.AIR, accent: B.LEAVES };
    // Bad Blood – gothic mansion
    case 'courtyard': return { wall: B.STONE_BRICKS, floor: B.COBBLE, ceil: B.STONE_BRICKS, accent: B.FENCE };
    case 'mansion': return { wall: B.BRICK, floor: B.PLANKS, ceil: B.PLANKS, accent: B.BOOKSHELF };
    case 'library': return { wall: B.BOOKSHELF, floor: B.PLANKS, ceil: B.STONE, accent: B.BOOKSHELF };
    case 'dungeon': return { wall: B.COBBLE, floor: B.STONE, ceil: B.COBBLE, accent: B.FENCE };
    case 'crypt': return { wall: B.STONE_BRICKS, floor: B.MOSSY, ceil: B.STONE, accent: B.COBBLE };
    case 'balcony': return { wall: B.STONE, floor: B.PLANKS, ceil: B.AIR, accent: B.FENCE };
    case 'greathall': return { wall: B.STONE_BRICKS, floor: B.PLANKS, ceil: B.STONE_BRICKS, accent: B.GLOWSTONE };
    case 'graveyard': return { wall: B.COBBLE, floor: B.DIRT, ceil: B.AIR, accent: B.WOOL_BLACK };
    // Alien Arcadium – neon arcade
    case 'spawn': return { wall: B.STONE_BRICKS, floor: B.STONE, ceil: B.STONE, accent: B.GLOWSTONE };
    case 'arcade': return { wall: B.QUARTZ_BLOCK, floor: B.WOOL_BLUE, ceil: B.GLOWSTONE, accent: B.WOOL_GREEN };
    case 'roller': return { wall: B.IRON_BLOCK, floor: B.PLANKS, ceil: B.BRICK, accent: B.GOLD_BLOCK };
    case 'power': return { wall: B.IRON_BLOCK, floor: B.STONE_BRICKS, ceil: B.REDSTONE_BLOCK, accent: B.REDSTONE_BLOCK };
    case 'kitchen': return { wall: B.BRICK, floor: B.PLANKS, ceil: B.STONE, accent: B.FURNACE };
    case 'gardenAA': return { wall: B.LEAVES, floor: B.GRASS, ceil: B.AIR, accent: B.LEAVES };
    case 'rooftopAA': return { wall: B.STONE, floor: B.STONE, ceil: B.AIR, accent: B.FENCE };
    // Prison
    case 'cells': return { wall: B.IRON_BLOCK, floor: B.STONE, ceil: B.STONE, accent: B.FENCE };
    case 'cafeteria': return { wall: B.BRICK, floor: B.PLANKS, ceil: B.STONE, accent: B.FURNACE };
    case 'yard': return { wall: B.COBBLE, floor: B.GRASS, ceil: B.AIR, accent: B.FENCE };
    case 'alleyPrison': return { wall: B.STONE_BRICKS, floor: B.COBBLE, ceil: B.STONE, accent: B.COBBLE };
    case 'roofPrison': return { wall: B.STONE, floor: B.STONE, ceil: B.AIR, accent: B.FENCE };
    case 'powerPrison': return { wall: B.IRON_BLOCK, floor: B.IRON_BLOCK, ceil: B.REDSTONE_BLOCK, accent: B.REDSTONE_BLOCK };
    default: return { wall: B.STONE_BRICKS, floor: B.PLANKS, ceil: B.STONE_BRICKS };
  }
}

function decorateRoom(world: World, r: { id: string; x1: number; z1: number; x2: number; z2: number; y: number; height: number }) {
  const cx = Math.floor((r.x1 + r.x2) / 2);
  const cz = Math.floor((r.z1 + r.z2) / 2);
  const th = themeFor(r.id);
  // central light
  if (r.id !== 'rooftop' && r.id !== 'garden') world.setBlock(cx, r.y + Math.min(3, r.height - 1), cz, B.GLOWSTONE);
  // corners torches
  world.setBlock(r.x1 + 1, r.y + 2, r.z1 + 1, B.TORCH);
  world.setBlock(r.x2 - 1, r.y + 2, r.z2 - 1, B.TORCH);

  if (r.id === 'office') {
    // desks + bookshelves along walls
    fill(world, r.x1 + 1, r.y + 1, r.z1 + 1, r.x1 + 3, r.y + 1, r.z1 + 2, B.CRAFTING);
    // fill bookshelves on north wall interior
    for (let x = r.x1 + 2; x <= r.x2 - 2; x++) { if ((x & 1) === 0) { world.setBlock(x, r.y + 1, r.z1 + 1, B.BOOKSHELF); world.setBlock(x, r.y + 2, r.z1 + 1, B.BOOKSHELF); } }
  } else if (r.id === 'gallery') {
    // paintings = colored wool
    for (let z = r.z1 + 2; z <= r.z2 - 2; z += 3) { world.setBlock(r.x1 + 1, r.y + 2, z, B.WOOL_YELLOW); world.setBlock(r.x2 - 1, r.y + 2, z, B.WOOL_LIGHT_BLUE); }
    world.setBlock(cx, r.y + 1, cz, B.CHEST);
  } else if (r.id === 'hotel') {
    // beds (use BED id)
    world.setBlock(r.x1 + 2, r.y + 1, r.z1 + 3, B.BED);
    world.setBlock(r.x1 + 2, r.y + 1, r.z1 + 4, B.BED);
    world.setBlock(r.x2 - 2, r.y + 1, r.z2 - 3, B.BED);
    world.setBlock(r.x2 - 2, r.y + 1, r.z2 - 4, B.BED);
    fill(world, cx - 1, r.y + 1, cz, cx + 1, r.y + 1, cz, B.WOOL_RED);
  } else if (r.id === 'apartments') {
    fill(world, r.x1 + 1, r.y + 1, r.z1 + 1, r.x1 + 4, r.y + 1, r.z1 + 1, B.FURNACE);
    world.setBlock(r.x1 + 2, r.y + 1, r.z2 - 2, B.CHEST);
  } else if (r.id === 'powerstation') {
    fill(world, cx - 1, r.y + 1, cz - 1, cx + 1, r.y + 2, cz + 1, B.IRON_BLOCK);
    world.setBlock(cx, r.y + 3, cz, B.REDSTONE_BLOCK);
    world.setBlock(r.x1 + 2, r.y + 1, r.z1 + 2, B.CRAFTING);
  } else if (r.id === 'rooftop') {
    fill(world, r.x1, r.y + r.height, r.z1, r.x2, r.y + r.height, r.z2, B.AIR);
    for (let x = r.x1; x <= r.x2; x++) { world.setBlock(x, r.y + 2, r.z1, th.accent ?? B.STONE); world.setBlock(x, r.y + 2, r.z2, th.accent ?? B.STONE); }
    for (let z = r.z1; z <= r.z2; z++) { world.setBlock(r.x1, r.y + 2, z, th.accent ?? B.STONE); world.setBlock(r.x2, r.y + 2, z, th.accent ?? B.STONE); }
    fill(world, cx - 1, r.y + 1, cz - 1, cx + 1, r.y + 1, cz + 1, B.GRASS);
    world.setBlock(cx, r.y + 2, cz, B.SAPLING);
  } else if (r.id === 'garden') {
    fill(world, r.x1, r.y + r.height, r.z1, r.x2, r.y + r.height, r.z2, B.AIR);
    fill(world, r.x1 + 1, r.y + 1, r.z1 + 1, r.x2 - 1, r.y + 1, r.z2 - 1, B.GRASS);
    world.setBlock(r.x1 + 2, r.y + 1, r.z1 + 2, B.LOG); world.setBlock(r.x1 + 2, r.y + 2, r.z1 + 2, B.LEAVES); world.setBlock(r.x1 + 2, r.y + 3, r.z1 + 2, B.LEAVES);
    world.setBlock(r.x2 - 2, r.y + 1, r.z2 - 2, B.LOG); world.setBlock(r.x2 - 2, r.y + 2, r.z2 - 2, B.LEAVES); world.setBlock(r.x2 - 2, r.y + 3, r.z2 - 2, B.LEAVES);
    world.setBlock(cx + 2, r.y + 1, cz + 1, B.FLOWER_RED); world.setBlock(cx - 1, r.y + 1, cz - 2, B.FLOWER_YELLOW);
  }
  // --- Bad Blood themes
  else if (r.id === 'courtyard') {
    // fountain
    fill(world, cx - 1, r.y + 1, cz - 1, cx + 1, r.y + 1, cz + 1, B.WATER);
    world.setBlock(cx, r.y + 1, cz, B.GLOWSTONE); world.setBlock(cx, r.y + 2, cz, B.FENCE);
    // hedge corners
    for (let dx = -2; dx <= 2; dx++) { world.setBlock(r.x1 + 2, r.y + 1, r.z1 + 4 + dx, B.LEAVES); world.setBlock(r.x2 - 2, r.y + 1, r.z2 - 4 - dx, B.LEAVES); }
  } else if (r.id === 'mansion') {
    // fireplace + stairs
    fill(world, cx - 2, r.y + 1, r.z1 + 2, cx + 2, r.y + 3, r.z1 + 2, B.BRICK);
    world.setBlock(cx, r.y + 2, r.z1 + 3, B.LAVA); world.setBlock(cx, r.y + 1, cz, B.WOOL_RED);
    world.setBlock(r.x1 + 2, r.y + 1, r.z1 + 6, B.CHEST);
  } else if (r.id === 'library') {
    for (let x = r.x1 + 1; x <= r.x2 - 1; x++) for (let dy = 1; dy < 3; dy++) world.setBlock(x, r.y + dy, r.z1 + 1, B.BOOKSHELF);
    for (let z = r.z1 + 2; z <= r.z2 - 2; z++) if ((z & 1) === 0) world.setBlock(r.x1 + 1, r.y + 1, z, B.BOOKSHELF);
    world.setBlock(cx, r.y + 1, cz, B.ENCHANT);
  } else if (r.id === 'dungeon') {
    for (let x = r.x1 + 2; x <= r.x2 - 2; x += 3) { fill(world, x, r.y + 1, r.z1 + 1, x, r.y + 3, r.z1 + 1, B.FENCE); world.setBlock(x, r.y + 1, r.z1 + 2, B.IRON_BLOCK); }
    fill(world, r.x1 + 1, r.y + 1, r.z2 - 2, r.x2 - 1, r.y + 1, r.z2 - 2, B.WATER);
  } else if (r.id === 'crypt') {
    fill(world, cx - 1, r.y + 1, cz - 2, cx + 1, r.y + 2, cz + 2, B.COBBLE);
    world.setBlock(cx, r.y + 2, cz, B.CHEST); world.setBlock(r.x1 + 2, r.y + 1, r.z1 + 2, B.GLOWSTONE);
  } else if (r.id === 'balcony') {
    fill(world, r.x1, r.y + r.height, r.z1, r.x2, r.y + r.height, r.z2, B.AIR);
    for (let x = r.x1; x <= r.x2; x++) world.setBlock(x, r.y + 1, r.z2, B.FENCE);
  } else if (r.id === 'greathall') {
    fill(world, cx - 3, r.y + 1, cz, cx + 3, r.y + 1, cz, B.WOOL_RED);
    world.setBlock(cx, r.y + 4, cz, B.GLOWSTONE); world.setBlock(r.x1 + 3, r.y + 1, r.z1 + 3, B.CHEST);
  } else if (r.id === 'graveyard') {
    fill(world, r.x1, r.y + r.height, r.z1, r.x2, r.y + r.height, r.z2, B.AIR);
    for (let i = 0; i < 5; i++) { const x = r.x1 + 2 + i * 3; const z = r.z1 + 2 + (i & 1); world.setBlock(x, r.y + 1, z, B.COBBLE); world.setBlock(x, r.y + 2, z, B.STONE); }
    fill(world, r.x1 + 1, r.y + 1, r.z1 + 1, r.x2 - 1, r.y + 1, r.z2 - 1, B.GRASS);
  } else if (r.id === 'arcade') {
    for (let x = r.x1 + 2; x <= r.x2 - 2; x += 4) world.setBlock(x, r.y + 1, r.z1 + 2, B.NOTE_BLOCK);
    world.setBlock(r.x1 + 2, r.y + 1, r.z2 - 2, B.CHEST); world.setBlock(r.x2 - 2, r.y + 1, r.z2 - 2, B.CRAFTING);
  } else if (r.id === 'roller') {
    // coaster track mock
    fill(world, r.x1 + 1, r.y + 2, r.z1 + 3, r.x2 - 1, r.y + 2, r.z2 - 3, B.IRON_BLOCK);
    fill(world, cx, r.y + 1, r.z1 + 3, cx, r.y + 1, r.z2 - 3, B.GOLD_BLOCK);
  } else if (r.id === 'kitchen') {
    fill(world, r.x1 + 1, r.y + 1, r.z1 + 1, r.x2 - 1, r.y + 1, r.z1 + 1, B.FURNACE);
    world.setBlock(r.x1 + 3, r.y + 1, cz, B.WATER);
  } else if (r.id === 'cells' || r.id === 'power' || r.id === 'powerPrison') {
    fill(world, cx - 1, r.y + 1, cx - 1, cx + 1, r.y + 3, cz + 1, B.IRON_BLOCK);
    world.setBlock(cx, r.y + 2, cz, B.REDSTONE_BLOCK);
  } else if (r.id === 'yard') {
    fill(world, r.x1, r.y + r.height, r.z1, r.x2, r.y + r.height, r.z2, B.AIR);
    fill(world, r.x1 + 2, r.y + 1, r.z1 + 2, r.x2 - 2, r.y + 1, r.z2 - 2, B.GRASS);
    for (let x = r.x1 + 2; x <= r.x2 - 2; x += 5) world.setBlock(x, r.y + 1, cz, B.FENCE);
  }

  if (r.id === 'office' || r.id === 'gallery') {
    fill(world, cx - 2, r.y + 1, cz - 1, cx + 2, r.y + 1, cz + 1, B.WOOL_WHITE);
  }
}

export function buildZombiesWorld(world: World, layout: ZombiesMapLayout) {
  // clear large area first (80x80 around)
  fill(world, -48, 58, -48, 60, 82, 72, B.AIR);
  // Ground bedrock at y=60 with dirt/grass top
  fill(world, -48, 60, -48, 60, 60, 72, B.BEDROCK);
  fill(world, -48, 61, -48, 60, 63, 72, B.DIRT);
  fill(world, -48, 64, -48, 60, 64, 72, B.GRASS);

  // Build each room: hollow out, floor, ceiling, walls with theme
  for (const r of layout.rooms) {
    const x1 = Math.min(r.x1, r.x2) - 1;
    const x2 = Math.max(r.x1, r.x2) + 1;
    const z1 = Math.min(r.z1, r.z2) - 1;
    const z2 = Math.max(r.z1, r.z2) + 1;
    const th = themeFor(r.id);
    clearRoomInterior(world, r.y, r.height, r.x1, r.z1, r.x2, r.z2);
    // override floor/ceil per theme
    for (let x = r.x1; x <= r.x2; x++) for (let z = r.z1; z <= r.z2; z++) {
      world.setBlock(x, r.y, z, th.floor);
      if (r.id === 'rooftop' || r.id === 'garden') world.setBlock(x, r.y + r.height, z, B.AIR);
      else world.setBlock(x, r.y + r.height, z, th.ceil);
    }
    // walls (outer shell)
    for (let x = x1; x <= x2; x++) for (let dy = 1; dy < r.height; dy++) {
      const y = r.y + dy;
      if (world.getBlock(x, y, z1) === B.AIR) world.setBlock(x, y, z1, th.wall);
      if (world.getBlock(x, y, z2) === B.AIR) world.setBlock(x, y, z2, th.wall);
    }
    for (let z = z1; z <= z2; z++) for (let dy = 1; dy < r.height; dy++) {
      const y = r.y + dy;
      if (world.getBlock(x1, y, z) === B.AIR) world.setBlock(x1, y, z, th.wall);
      if (world.getBlock(x2, y, z) === B.AIR) world.setBlock(x2, y, z, th.wall);
    }
    decorateRoom(world, r as never);
  }

  // Punch door holes (will be blocked by iron door visual if locked)
  for (const d of layout.doors) {
    for (let dy = 1; dy <= 3; dy++) for (let w = -1; w <= 1; w++) {
      const x = d.dir === 'z' ? d.x + w : d.x;
      const z = d.dir === 'x' ? d.z + w : d.z;
      const y = d.y + dy;
      if (d.locked) world.setBlock(x, y, z, B.IRON_BLOCK);
      else world.setBlock(x, y, z, B.AIR);
    }
    // price pedestal – chest + anvil as door sign
    world.setBlock(d.x, d.y + 1, d.z - (d.dir === 'x' ? 1 : 0), B.CHEST);
    world.setBlock(d.x, d.y + 2, d.z - (d.dir === 'x' ? 1 : 0), B.ANVIL);
  }

  // Windows: glass panes + barricade planks + fences
  for (const w of layout.windowPositions) {
    for (let dy = 1; dy <= 2; dy++) world.setBlock(w.x, w.y + dy, w.z, B.GLASS);
    world.setBlock(w.x + (w.x < 0 ? 1 : -1), w.y + 1, w.z, B.PLANKS);
    // side fences for depth
    world.setBlock(w.x, w.y + 1, w.z + 1, B.FENCE);
    world.setBlock(w.x, w.y + 1, w.z - 1, B.FENCE);
  }

  // Shops: distinct blocks as markers (raycasted)
  for (const s of layout.shops) {
    let block: number = B.CRAFTING;
    if (s.kind === 'weapon_wall') block = B.CRAFTING;
    else if (s.kind === 'perk') block = B.ENCHANT;
    else if (s.kind === 'ultimate') block = B.ANVIL;
    else if (s.kind === 'mystery') block = B.CHEST;
    else if (s.kind === 'armor') block = B.IRON_BLOCK;
    else if (s.kind === 'team') block = B.NOTE_BLOCK;
    world.setBlock(s.x, s.y + 1, s.z, block);
    // sign above + item frame hint
    world.setBlock(s.x, s.y + 2, s.z, B.GLASS);
    if (s.kind === 'perk') world.setBlock(s.x, s.y + 1, s.z + 1, B.TORCH);
  }

  // Power switch: lever at power room centre wall
  if (layout.meta.powerRoomId) {
    const pr = layout.rooms.find(r => r.id === layout.meta.powerRoomId);
    if (pr) {
      const cx = Math.floor((pr.x1 + pr.x2) / 2);
      const cz = Math.floor((pr.z1 + pr.z2) / 2);
      world.setBlock(cx, pr.y + 2, cz - 1, B.LEVER);
      world.setBlock(cx, pr.y + 1, cz - 1, B.REDSTONE_BLOCK);
      // cable line
      fill(world, cx - 2, pr.y + 3, cz, cx + 2, pr.y + 3, cz, B.REDSTONE_BLOCK);
    }
  }

  // spawn loot chest
  const spawn = layout.spawnPoints[0];
  if (spawn) world.setBlock(spawn.x, spawn.y, spawn.z, B.LOOT_CHEST);
  // extra chests in Garden/Rooftop
  if (layout.rooms.find(r => r.id === 'garden')) {
    const g = layout.rooms.find(r => r.id === 'garden')!;
    world.setBlock(Math.floor((g.x1 + g.x2) / 2), g.y + 1, g.z2 - 2, B.CHEST);
  }
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
