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
    case 'alley': return { wall: B.STONE_BRICKS, floor: B.COBBLE, ceil: B.AIR, accent: B.FENCE };
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

function placeLamp(world: World, x: number, y: number, z: number) {
  // simple street lamp: fence pole + lantern
  fill(world, x, y + 1, z, x, y + 4, z, B.FENCE);
  world.setBlock(x, y + 5, z, B.LANTERN);
  world.setBlock(x, y + 4, z, B.GLOWSTONE);
}
function placeCar(world: World, x: number, y: number, z: number, color: number, dir: 'x' | 'z') {
  // 4x2 car body + windshield
  const c = color;
  if (dir === 'x') {
    fill(world, x - 2, y + 1, z - 1, x + 2, y + 1, z + 1, c);
    fill(world, x - 2, y + 2, z - 1, x + 2, y + 2, z + 1, B.WOOL_BLACK);
    world.setBlock(x - 1, y + 2, z, B.GLASS);
    world.setBlock(x + 1, y + 2, z, B.GLASS);
    world.setBlock(x - 2, y + 1, z, B.WOOL_LIGHT_GRAY);
    world.setBlock(x + 2, y + 1, z, B.WOOL_LIGHT_GRAY);
  } else {
    fill(world, x - 1, y + 1, z - 2, x + 1, y + 1, z + 2, c);
    fill(world, x - 1, y + 2, z - 2, x + 1, y + 2, z + 2, B.WOOL_BLACK);
    world.setBlock(x, y + 2, z - 1, B.GLASS);
    world.setBlock(x, y + 2, z + 1, B.GLASS);
    world.setBlock(x, y + 1, z - 2, B.WOOL_LIGHT_GRAY);
    world.setBlock(x, y + 1, z + 2, B.WOOL_LIGHT_GRAY);
  }
}

function decorateRoom(world: World, r: { id: string; x1: number; z1: number; x2: number; z2: number; y: number; height: number }) {
  const cx = Math.floor((r.x1 + r.x2) / 2);
  const cz = Math.floor((r.z1 + r.z2) / 2);
  void themeFor(r.id);
  // central light
  if (r.id !== 'rooftop' && r.id !== 'garden' && r.id !== 'alley' && r.id !== 'yard') world.setBlock(cx, r.y + Math.min(3, r.height - 1), cz, B.GLOWSTONE);
  // corners torches
  world.setBlock(r.x1 + 1, r.y + 2, r.z1 + 1, B.TORCH);
  world.setBlock(r.x2 - 1, r.y + 2, r.z2 - 1, B.TORCH);

  if (r.id === 'alley') {
    // === ALLEY as outdoor street – Hypixel spawn street ===
    // street asphalt already via floor override outside; here add sidewalks, facades, props
    // sidewalks (raise 1 block along north/south edges inside room)
    for (let x = r.x1; x <= r.x2; x++) {
      world.setBlock(x, r.y + 1, r.z1 + 1, B.STONE_BRICKS);
      world.setBlock(x, r.y + 1, r.z2 - 1, B.STONE_BRICKS);
    }
    // street lamps corners
    placeLamp(world, r.x1 + 2, r.y, r.z1 + 4);
    placeLamp(world, r.x2 - 2, r.y, r.z1 + 4);
    placeLamp(world, r.x1 + 2, r.y, r.z2 - 4);
    placeLamp(world, r.x2 - 2, r.y, r.z2 - 4);
    // 2 parked cars on street center
    placeCar(world, cx - 6, r.y, cz, B.WOOL_RED, 'x');
    placeCar(world, cx + 6, r.y, cz, B.WOOL_BLUE, 'x');
    // dumpsters
    fill(world, r.x1 + 1, r.y + 1, r.z1 + 5, r.x1 + 2, r.y + 2, r.z1 + 6, B.IRON_BLOCK);
    fill(world, r.x2 - 2, r.y + 1, r.z2 - 6, r.x2 - 1, r.y + 2, r.z2 - 5, B.IRON_BLOCK);
    // graffiti walls – colored wool splashes on outer walls
    world.setBlock(r.x1, r.y + 2, r.z1 + 3, B.WOOL_RED);
    world.setBlock(r.x1, r.y + 3, r.z1 + 4, B.WOOL_YELLOW);
    world.setBlock(r.x2, r.y + 2, r.z2 - 3, B.WOOL_BLUE);
    world.setBlock(r.x2, r.y + 3, r.z2 - 4, B.WOOL_GREEN);
    // building facades: awnings + shop fronts
    for (let x = r.x1 + 4; x <= r.x2 - 4; x += 5) {
      world.setBlock(x, r.y + 3, r.z1, B.WOOL_ORANGE); // awning north
      world.setBlock(x, r.y + 3, r.z2, B.WOOL_CYAN); // awning south
      world.setBlock(x, r.y + 2, r.z1, B.GLASS); // shop window
      world.setBlock(x, r.y + 2, r.z2, B.GLASS);
    }
    // truck in alley center-back (Hypixel truck easter egg)
    fill(world, cx - 2, r.y + 1, r.z1 + 2, cx + 2, r.y + 2, r.z1 + 4, B.WOOL_BROWN);
    world.setBlock(cx, r.y + 2, r.z1 + 3, B.GLASS);
    // scattered leaves trash
    world.setBlock(cx + 3, r.y + 1, cz + 1, B.LEAVES);
    world.setBlock(cx - 2, r.y + 1, cz - 2, B.LEAVES);
  } else if (r.id === 'office') {
    // === OFFICE – cubicles, desks with computers, filing cabinets ===
    // cubicle walls (half-height)
    for (let z = r.z1 + 4; z <= r.z2 - 4; z += 4) {
      for (let x = r.x1 + 2; x <= r.x2 - 2; x += 6) {
        fill(world, x, r.y + 1, z, x, r.y + 2, z + 1, B.PLANKS);
        // desk + computer
        world.setBlock(x + 1, r.y + 1, z, B.CRAFTING);
        world.setBlock(x + 1, r.y + 2, z, B.GLASS); // monitor
        world.setBlock(x + 2, r.y + 1, z, B.WOOL_GRAY); // chair
      }
    }
    // filing cabinets along north wall
    for (let x = r.x1 + 3; x <= r.x2 - 3; x += 2) world.setBlock(x, r.y + 1, r.z1 + 1, B.IRON_BLOCK);
    // water cooler + plant
    world.setBlock(r.x1 + 2, r.y + 1, r.z2 - 2, B.WATER);
    world.setBlock(r.x1 + 2, r.y + 2, r.z2 - 2, B.LEAVES);
    // conference table center
    fill(world, cx - 3, r.y + 1, cz - 1, cx + 3, r.y + 1, cz + 1, B.PLANKS);
    for (let x = cx - 2; x <= cx + 2; x += 2) world.setBlock(x, r.y + 1, cz - 2, B.WOOL_GRAY);
    for (let x = cx - 2; x <= cx + 2; x += 2) world.setBlock(x, r.y + 1, cz + 2, B.WOOL_GRAY);
  } else if (r.id === 'gallery') {
    // === GALLERY – art museum with paintings, benches, reception ===
    // white marble walls already; add art frames (wool with fence frames)
    const arts = [B.WOOL_RED, B.WOOL_BLUE, B.WOOL_YELLOW, B.WOOL_GREEN, B.WOOL_PURPLE, B.WOOL_ORANGE];
    let ai = 0;
    for (let z = r.z1 + 2; z <= r.z2 - 2; z += 4) {
      world.setBlock(r.x1 + 1, r.y + 2, z, arts[ai % arts.length]);
      world.setBlock(r.x1 + 1, r.y + 3, z, B.FENCE); // frame
      world.setBlock(r.x2 - 1, r.y + 2, z, arts[(ai + 2) % arts.length]);
      world.setBlock(r.x2 - 1, r.y + 3, z, B.FENCE);
      ai++;
    }
    // benches in center
    fill(world, cx - 2, r.y + 1, cz - 3, cx + 2, r.y + 1, cz - 3, B.PLANKS);
    fill(world, cx - 2, r.y + 1, cz + 3, cx + 2, r.y + 1, cz + 3, B.PLANKS);
    // reception desk north
    fill(world, r.x1 + 3, r.y + 1, r.z1 + 3, r.x1 + 7, r.y + 1, r.z1 + 5, B.BOOKSHELF);
    world.setBlock(r.x1 + 5, r.y + 2, r.z1 + 4, B.CHEST);
    // skylight glass ceiling (instead of quartz)
    for (let x = cx - 2; x <= cx + 2; x++) for (let z = cz - 2; z <= cz + 2; z++) world.setBlock(x, r.y + r.height, z, B.GLASS);
  } else if (r.id === 'hotel') {
    // === HOTEL – 2-story lobby, reception, hallway with rooms ===
    // reception desk
    fill(world, r.x1 + 3, r.y + 1, r.z1 + 3, r.x1 + 8, r.y + 2, r.z1 + 4, B.PLANKS);
    world.setBlock(r.x1 + 5, r.y + 2, r.z1 + 3, B.BOOKSHELF);
    // lobby couches
    fill(world, cx - 3, r.y + 1, cz, cx - 1, r.y + 1, cz, B.WOOL_RED);
    fill(world, cx + 1, r.y + 1, cz, cx + 3, r.y + 1, cz, B.WOOL_RED);
    world.setBlock(cx - 2, r.y + 1, cz + 1, B.WOOL_WHITE);
    world.setBlock(cx + 2, r.y + 1, cz + 1, B.WOOL_WHITE);
    // staircase to 2nd floor (south side) – steps as stairs via slabs
    for (let i = 0; i < 4; i++) {
      world.setBlock(r.x2 - 3 - i, r.y + 1 + i, r.z2 - 3, B.PLANKS);
      world.setBlock(r.x2 - 3 - i, r.y + 2 + i, r.z2 - 2, B.FENCE); // railing
    }
    // second floor hallway balcony (around upper edge)
    for (let x = r.x1 + 2; x <= r.x2 - 2; x++) world.setBlock(x, r.y + 4, r.z1 + 6, B.FENCE);
    // 4 hotel rooms with doors (beds inside)
    const rooms = [{ x: r.x1 + 2, z: r.z1 + 8 }, { x: r.x2 - 6, z: r.z1 + 8 }, { x: r.x1 + 2, z: r.z2 - 8 }, { x: r.x2 - 6, z: r.z2 - 8 }];
    for (const rm of rooms) {
      fill(world, rm.x, r.y + 1, rm.z, rm.x + 3, r.y + 3, rm.z + 4, B.WOOL_WHITE); // temporary walls then carve
      fill(world, rm.x + 1, r.y + 1, rm.z + 1, rm.x + 2, r.y + 3, rm.z + 3, B.AIR);
      // beds
      world.setBlock(rm.x + 1, r.y + 1, rm.z + 1, B.BED);
      world.setBlock(rm.x + 1, r.y + 1, rm.z + 2, B.BED_HEAD_N);
      world.setBlock(rm.x + 1, r.y + 1, rm.z + 3, B.WOOL_WHITE); // pillow
      // nightstand
      world.setBlock(rm.x + 2, r.y + 1, rm.z + 1, B.CRAFTING);
      world.setBlock(rm.x + 2, r.y + 2, rm.z + 1, B.LANTERN);
    }
    // hallway carpet
    fill(world, r.x1 + 6, r.y + 1, r.z1 + 6, r.x2 - 6, r.y + 1, r.z2 - 6, B.WOOL_RED);
    // paintings in hallway
    world.setBlock(r.x1 + 1, r.y + 2, cz, B.WOOL_YELLOW);
    world.setBlock(r.x2 - 1, r.y + 2, cz, B.WOOL_YELLOW);
  } else if (r.id === 'apartments') {
    // === APARTMENTS – lived-in: kitchen, living room, bedroom ===
    // kitchen corner
    fill(world, r.x1 + 1, r.y + 1, r.z1 + 1, r.x1 + 5, r.y + 1, r.z1 + 3, B.FURNACE);
    fill(world, r.x1 + 1, r.y + 2, r.z1 + 1, r.x1 + 5, r.y + 2, r.z1 + 1, B.BOOKSHELF); // cabinets
    world.setBlock(r.x1 + 3, r.y + 1, r.z1 + 2, B.WATER); // sink
    // dining table
    fill(world, cx - 2, r.y + 1, r.z1 + 6, cx + 2, r.y + 1, r.z1 + 8, B.PLANKS);
    world.setBlock(cx - 1, r.y + 1, r.z1 + 5, B.WOOL_BROWN);
    world.setBlock(cx + 1, r.y + 1, r.z1 + 5, B.WOOL_BROWN);
    world.setBlock(cx - 1, r.y + 1, r.z1 + 9, B.WOOL_BROWN);
    world.setBlock(cx + 1, r.y + 1, r.z1 + 9, B.WOOL_BROWN);
    // living room couch + TV
    fill(world, r.x1 + 2, r.y + 1, cz, r.x1 + 6, r.y + 1, cz, B.WOOL_BLUE);
    world.setBlock(r.x2 - 2, r.y + 2, cz, B.WOOL_BLACK); // TV
    world.setBlock(r.x2 - 2, r.y + 1, cz, B.CRAFTING); // stand
    // bedroom with bunk beds
    fill(world, r.x1 + 2, r.y + 1, r.z2 - 5, r.x1 + 6, r.y + 1, r.z2 - 3, B.WOOL_GREEN);
    world.setBlock(r.x1 + 3, r.y + 2, r.z2 - 4, B.BED);
    world.setBlock(r.x1 + 5, r.y + 2, r.z2 - 4, B.BED);
    // balcony with view to Power Station
    for (let x = r.x1 + 2; x <= r.x2 - 2; x++) world.setBlock(x, r.y + 1, r.z2 - 1, B.FENCE);
    // sniper nest sandbags
    fill(world, r.x2 - 3, r.y + 1, r.z2 - 4, r.x2 - 1, r.y + 1, r.z2 - 2, B.SANDSTONE);
  } else if (r.id === 'powerstation') {
    // === POWER STATION – industrial turbines, pipes, control room ===
    // 2 turbines
    fill(world, cx - 4, r.y + 1, cz - 2, cx - 2, r.y + 4, cz + 2, B.IRON_BLOCK);
    fill(world, cx + 2, r.y + 1, cz - 2, cx + 4, r.y + 4, cz + 2, B.IRON_BLOCK);
    world.setBlock(cx - 3, r.y + 5, cz, B.REDSTONE_BLOCK);
    world.setBlock(cx + 3, r.y + 5, cz, B.REDSTONE_BLOCK);
    // overhead pipes
    for (let x = r.x1 + 2; x <= r.x2 - 2; x++) { world.setBlock(x, r.y + 5, cz, B.IRON_BLOCK); if (x % 3 === 0) world.setBlock(x, r.y + 4, cz, B.FENCE); }
    // control panels
    fill(world, r.x1 + 2, r.y + 1, r.z1 + 2, r.x1 + 6, r.y + 2, r.z1 + 2, B.IRON_BLOCK);
    world.setBlock(r.x1 + 3, r.y + 2, r.z1 + 2, B.LANTERN);
    world.setBlock(r.x1 + 5, r.y + 2, r.z1 + 2, B.LEVER);
    // glass partition to Gallery stairs (GSTEP)
    for (let x = r.x1; x <= r.x2; x++) { if (x !== 42) world.setBlock(x, r.y + 1, r.z1, B.GLASS); }
    // coolant water pit
    fill(world, r.x2 - 5, r.y, r.z2 - 5, r.x2 - 2, r.y, r.z2 - 2, B.WATER);
    world.setBlock(r.x2 - 3, r.y + 1, r.z2 - 3, B.LANTERN);
  } else if (r.id === 'rooftop') {
    // === ROOFTOP – helipad H, antennas, bunker ===
    fill(world, r.x1, r.y + r.height, r.z1, r.x2, r.y + r.height, r.z2, B.AIR);
    // helipad circle
    fill(world, cx - 4, r.y + 1, cz - 4, cx + 4, r.y + 1, cz + 4, B.WOOL_WHITE);
    fill(world, cx - 1, r.y + 1, cz - 4, cx + 1, r.y + 1, cz + 4, B.WOOL_RED); // H vertical
    fill(world, cx - 4, r.y + 1, cz, cx + 4, r.y + 1, cz, B.WOOL_RED); // H horizontal
    // parapet walls
    for (let x = r.x1; x <= r.x2; x++) { world.setBlock(x, r.y + 2, r.z1, B.STONE_BRICKS); world.setBlock(x, r.y + 2, r.z2, B.STONE_BRICKS); }
    for (let z = r.z1; z <= r.z2; z++) { world.setBlock(r.x1, r.y + 2, z, B.STONE_BRICKS); world.setBlock(r.x2, r.y + 2, z, B.STONE_BRICKS); }
    // antenna tower
    for (let y = r.y + 1; y <= r.y + 6; y++) world.setBlock(r.x2 - 2, y, r.z2 - 2, B.FENCE);
    world.setBlock(r.x2 - 2, r.y + 7, r.z2 - 2, B.GLOWSTONE);
    world.setBlock(r.x2 - 2, r.y + 8, r.z2 - 2, B.LANTERN);
    // AC units
    fill(world, r.x1 + 2, r.y + 1, r.z1 + 2, r.x1 + 4, r.y + 2, r.z1 + 4, B.IRON_BLOCK);
    world.setBlock(r.x1 + 3, r.y + 3, r.z1 + 3, B.FENCE);
    // bunker for Team Machine
    fill(world, cx - 2, r.y + 1, r.z2 - 6, cx + 2, r.y + 3, r.z2 - 4, B.IRON_BLOCK);
    fill(world, cx - 1, r.y + 1, r.z2 - 5, cx + 1, r.y + 2, r.z2 - 5, B.AIR);
    // stair access from Power Station
    for (let i = 0; i < 3; i++) { world.setBlock(r.x1 + 2 + i, r.y + 1 + i, r.z1 + 2, B.STONE); world.setBlock(r.x1 + 2 + i, r.y + 2 + i, r.z1 + 1, B.FENCE); }
  } else if (r.id === 'garden') {
    // === GARDEN – hedge maze, fountain, greenhouse ===
    fill(world, r.x1, r.y + r.height, r.z1, r.x2, r.y + r.height, r.z2, B.AIR);
    // hedge maze walls 2 high
    for (let x = r.x1 + 2; x <= r.x2 - 2; x++) { if (x % 4 === 0) fill(world, x, r.y + 1, r.z1 + 2, x, r.y + 2, r.z2 - 2, B.LEAVES); }
    for (let z = r.z1 + 2; z <= r.z2 - 2; z++) { if (z % 5 === 0) fill(world, r.x1 + 2, r.y + 1, z, r.x2 - 2, r.y + 2, z, B.LEAVES); }
    // clear paths (carve)
    fill(world, cx - 1, r.y + 1, r.z1 + 2, cx + 1, r.y + 1, r.z2 - 2, B.GRASS);
    fill(world, r.x1 + 2, r.y + 1, cz - 1, r.x2 - 2, r.y + 1, cz + 1, B.GRASS);
    // central fountain
    fill(world, cx - 2, r.y, cz - 2, cx + 2, r.y, cz + 2, B.WATER);
    fill(world, cx - 3, r.y + 1, cz - 3, cx + 3, r.y + 1, cz - 3, B.STONE_BRICKS);
    fill(world, cx - 3, r.y + 1, cz + 3, cx + 3, r.y + 1, cz + 3, B.STONE_BRICKS);
    fill(world, cx - 3, r.y + 1, cz - 3, cx - 3, r.y + 1, cz + 3, B.STONE_BRICKS);
    fill(world, cx + 3, r.y + 1, cz - 3, cx + 3, r.y + 1, cz + 3, B.STONE_BRICKS);
    world.setBlock(cx, r.y + 1, cz, B.COBBLE);
    world.setBlock(cx, r.y + 2, cz, B.WATER);
    // flower beds
    for (let x = r.x1 + 3; x <= r.x2 - 3; x += 3) { world.setBlock(x, r.y + 1, r.z1 + 3, B.FLOWER_RED); world.setBlock(x, r.y + 1, r.z2 - 3, B.FLOWER_YELLOW); }
    // greenhouse for Ultimate (glass walls)
    fill(world, r.x1 + 8, r.y + 1, r.z2 - 8, r.x2 - 8, r.y + 4, r.z2 - 8, B.GLASS);
    fill(world, r.x1 + 8, r.y + 1, r.z2 - 8, r.x1 + 8, r.y + 4, r.z2 - 4, B.GLASS);
    fill(world, r.x2 - 8, r.y + 1, r.z2 - 8, r.x2 - 8, r.y + 4, r.z2 - 4, B.GLASS);
    // 2 trees
    world.setBlock(r.x1 + 3, r.y + 1, r.z1 + 3, B.LOG); world.setBlock(r.x1 + 3, r.y + 2, r.z1 + 3, B.LEAVES); world.setBlock(r.x1 + 3, r.y + 3, r.z1 + 3, B.LEAVES); world.setBlock(r.x1 + 2, r.y + 2, r.z1 + 3, B.LEAVES); world.setBlock(r.x1 + 4, r.y + 2, r.z1 + 3, B.LEAVES);
    world.setBlock(r.x2 - 3, r.y + 1, r.z2 - 3, B.LOG); world.setBlock(r.x2 - 3, r.y + 2, r.z2 - 3, B.LEAVES); world.setBlock(r.x2 - 3, r.y + 3, r.z2 - 3, B.LEAVES);
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
  } else if (r.id === 'courtyard') {
    fill(world, cx - 1, r.y + 1, cz - 1, cx + 1, r.y + 1, cz + 1, B.WATER);
    world.setBlock(cx, r.y + 1, cz, B.GLOWSTONE); world.setBlock(cx, r.y + 2, cz, B.FENCE);
    for (let dx = -2; dx <= 2; dx++) { world.setBlock(r.x1 + 2, r.y + 1, r.z1 + 4 + dx, B.LEAVES); world.setBlock(r.x2 - 2, r.y + 1, r.z2 - 4 - dx, B.LEAVES); }
  } else if (r.id === 'mansion') {
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
  // 3.5 – SERIO 1:1: autouzupełnianie okien do r.windows (wiki Hypixel) + korytarze
  // Uzupełnij brakujące windowPositions w locie (nie modyfikuj oryginału na stałe, ale klonuj)
  for (const r of layout.rooms) {
    const counted = layout.windowPositions.filter(w => w.roomId === r.id).length;
    const missing = Math.max(0, r.windows - counted);
    for (let i = 0; i < missing; i++) {
      const side = i % 4;
      let x: number, z: number;
      const spanX = r.x2 - r.x1;
      const spanZ = r.z2 - r.z1;
      if (side === 0) { x = r.x1 - 1; z = r.z1 + 2 + (i * 3) % Math.max(1, spanZ - 4); }
      else if (side === 1) { x = r.x2 + 1; z = r.z1 + 2 + (i * 3) % Math.max(1, spanZ - 4); }
      else if (side === 2) { z = r.z1 - 1; x = r.x1 + 2 + (i * 3) % Math.max(1, spanX - 4); }
      else { z = r.z2 + 1; x = r.x1 + 2 + (i * 3) % Math.max(1, spanX - 4); }
      layout.windowPositions.push({ x, y: r.y + 1, z, roomId: r.id });
    }
  }
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
      if (r.id === 'rooftop' || r.id === 'garden' || r.id === 'alley') world.setBlock(x, r.y + r.height, z, B.AIR);
      else world.setBlock(x, r.y + r.height, z, th.ceil);
    }
    // Alley street asphalt pattern (Hypixel street)
    if (r.id === 'alley') {
      for (let x = r.x1; x <= r.x2; x++) for (let z = r.z1 + 4; z <= r.z2 - 4; z++) world.setBlock(x, r.y, z, B.WOOL_BLACK);
      const mz = Math.floor((r.z1 + r.z2) / 2);
      for (let x = r.x1; x <= r.x2; x++) {
        world.setBlock(x, r.y, mz, B.WOOL_YELLOW);
        if (x % 4 === 0) world.setBlock(x, r.y, mz, B.WOOL_WHITE);
      }
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

  // Punch door holes (will be blocked by iron door visual if locked) + 1:1 korytarze jak Hypixel
  for (const d of layout.doors) {
    for (let dy = 1; dy <= 3; dy++) for (let w = -1; w <= 1; w++) {
      const x = d.dir === 'z' ? d.x + w : d.x;
      const z = d.dir === 'x' ? d.z + w : d.z;
      const y = d.y + dy;
      if (d.locked) world.setBlock(x, y, z, B.IRON_BLOCK);
      else world.setBlock(x, y, z, B.AIR);
    }
    // korytarz 3×3 jak na Hypixel – podłoga i sufit łączące pokoje
    const corridorLen = 3;
    for (let k = 1; k <= corridorLen; k++) {
      const cx = d.dir === 'x' ? d.x + (d.z < 0 ? -k : k) : d.x; // simplify
      const cz = d.dir === 'z' ? d.z + (d.x < 0 ? -k : k) : d.z;
      // podłoga korytarza
      for (let w = -1; w <= 1; w++) {
        const fx = d.dir === 'z' ? d.x + w : cx + w;
        const fz = d.dir === 'z' ? cz + w : d.z + w;
        if (world.getBlock(fx, d.y, fz) === B.GRASS) world.setBlock(fx, d.y, fz, B.PLANKS);
      }
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
