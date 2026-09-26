import { B, isRedstoneSource } from './blocks';

export type WorldLike = {
  getBlock(x: number, y: number, z: number): number;
  setBlock(x: number, y: number, z: number, id: number): void;
  peekBlock(x: number, y: number, z: number): number;
};

const DIRS: [number, number, number][] = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

function isPowered(world: WorldLike, x: number, y: number, z: number): boolean {
  for (const [dx, dy, dz] of DIRS) {
    const nid = world.getBlock(x + dx, y + dy, z + dz);
    if (isRedstoneSource(nid)) return true;
    // redstone block powers adjacent
    if (nid === B.REDSTONE_BLOCK) return true;
    // powered rail etc not yet
  }
  return false;
}

export function tickRedstone(world: WorldLike, changed: Set<string>) {
  // For each changed block, check neighbors for lamp/piston/torch updates
  const toCheck = new Set<string>();
  for (const key of changed) {
    const [x, y, z] = key.split(',').map(Number);
    for (const [dx, dy, dz] of DIRS) {
      toCheck.add(`${x + dx},${y + dy},${z + dz}`);
    }
    toCheck.add(key);
  }
  for (const key of toCheck) {
    const [x, y, z] = key.split(',').map(Number);
    const id = world.getBlock(x, y, z);
    if (id === B.REDSTONE_LAMP) {
      if (isPowered(world, x, y, z)) {
        world.setBlock(x, y, z, B.REDSTONE_LAMP_ON);
      }
    } else if (id === B.REDSTONE_LAMP_ON) {
      if (!isPowered(world, x, y, z)) {
        world.setBlock(x, y, z, B.REDSTONE_LAMP);
      }
    } else if (id === B.REDSTONE_TORCH) {
      // torch turns off if block it is attached to is powered (simplified: if block below is powered)
      const below = world.getBlock(x, y - 1, z);
      if (isPowered(world, x, y - 1, z) || isRedstoneSource(below) || below === B.REDSTONE_BLOCK) {
        world.setBlock(x, y, z, B.REDSTONE_TORCH_OFF);
      }
    } else if (id === B.REDSTONE_TORCH_OFF) {
      const below = world.getBlock(x, y - 1, z);
      if (!isPowered(world, x, y - 1, z) && !isRedstoneSource(below) && below !== B.REDSTONE_BLOCK) {
        world.setBlock(x, y, z, B.REDSTONE_TORCH);
      }
    } else if (id === B.PISTON || id === B.STICKY_PISTON) {
      if (isPowered(world, x, y, z)) {
        // extend if air in front (assume north for now, but we can use facing later)
        // For simplicity, push block in +Z direction
        // We will handle directional pistons via block metadata in future; for now extend forward
        // Check if already extended
        const front = world.getBlock(x, y, z + 1);
        const head = world.getBlock(x, y, z + 1);
        if (head !== B.PISTON_HEAD && front === B.AIR) {
          // we need to know piston facing – we store facing via separate logic? For now assume facing +Z
          // Actually we will handle piston facing in engine placement
        }
      }
    }
  }
}

export function toggleLever(world: WorldLike, x: number, y: number, z: number): boolean {
  const id = world.getBlock(x, y, z);
  if (id === B.LEVER) {
    world.setBlock(x, y, z, B.LEVER_ON);
    return true;
  } else if (id === B.LEVER_ON) {
    world.setBlock(x, y, z, B.LEVER);
    return true;
  }
  return false;
}

export function pressButton(world: WorldLike, x: number, y: number, z: number): boolean {
  const id = world.getBlock(x, y, z);
  if (id === B.BUTTON) {
    world.setBlock(x, y, z, B.BUTTON_ON);
    return true;
  }
  return false;
}

export function tryCreatePortal(world: WorldLike, x: number, y: number, z: number): boolean {
  // Try to detect obsidian frame around (x,y,z) and fill with portal
  // Simplified: check 4x5 frame in X or Z plane
  // We will search for obsidian rectangle 4 wide, 5 tall with air inside
  // x,y,z is where player used flint&steel (should be inside frame or on obsidian)
  for (const axis of ['x', 'z'] as const) {
    // find bottom
    let by = y;
    while (by > 0 && world.getBlock(x, by - 1, z) !== B.OBSIDIAN) {
      const b = world.getBlock(x, by - 1, z);
      if (b !== B.AIR) break;
      by--;
    }
    // find left/right extents at bottom
    let minX = x, maxX = x, minZ = z, maxZ = z;
    if (axis === 'x') {
      while (world.getBlock(minX - 1, by, z) === B.OBSIDIAN || world.getBlock(minX - 1, by, z) === B.AIR) {
        if (world.getBlock(minX - 1, by, z) === B.OBSIDIAN) { minX--; break; }
        minX--;
        if (minX < x - 5) break;
      }
      while (world.getBlock(maxX + 1, by, z) === B.OBSIDIAN || world.getBlock(maxX + 1, by, z) === B.AIR) {
        if (world.getBlock(maxX + 1, by, z) === B.OBSIDIAN) { maxX++; break; }
        maxX++;
        if (maxX > x + 5) break;
      }
      // now try to find frame: width 4, height 5
      for (let lx = minX - 2; lx <= maxX + 2; lx++) {
        for (let ly = by; ly <= by + 4; ly++) {
          // check if 4x5 obsidian frame exists with lx,ly as bottom-left
          let ok = true;
          for (let fx = 0; fx < 4; fx++) {
            if (world.getBlock(lx + fx, ly, z) !== B.OBSIDIAN) ok = false;
            if (world.getBlock(lx + fx, ly + 4, z) !== B.OBSIDIAN) ok = false;
          }
          for (let fy = 0; fy < 5; fy++) {
            if (world.getBlock(lx, ly + fy, z) !== B.OBSIDIAN) ok = false;
            if (world.getBlock(lx + 3, ly + fy, z) !== B.OBSIDIAN) ok = false;
          }
          if (!ok) continue;
          // check inside is air
          let insideOk = true;
          for (let ix = 1; ix < 3; ix++) for (let iy = 1; iy < 4; iy++) {
            const bid = world.getBlock(lx + ix, ly + iy, z);
            if (bid !== B.AIR && bid !== B.NETHER_PORTAL) insideOk = false;
          }
          if (!insideOk) continue;
          // fill portal
          for (let ix = 1; ix < 3; ix++) for (let iy = 1; iy < 4; iy++) {
            world.setBlock(lx + ix, ly + iy, z, B.NETHER_PORTAL);
          }
          return true;
        }
      }
    } else {
      while (world.getBlock(x, by, minZ - 1) === B.OBSIDIAN || world.getBlock(x, by, minZ - 1) === B.AIR) {
        if (world.getBlock(x, by, minZ - 1) === B.OBSIDIAN) { minZ--; break; }
        minZ--;
        if (minZ < z - 5) break;
      }
      while (world.getBlock(x, by, maxZ + 1) === B.OBSIDIAN || world.getBlock(x, by, maxZ + 1) === B.AIR) {
        if (world.getBlock(x, by, maxZ + 1) === B.OBSIDIAN) { maxZ++; break; }
        maxZ++;
        if (maxZ > z + 5) break;
      }
      for (let lz = minZ - 2; lz <= maxZ + 2; lz++) {
        for (let ly = by; ly <= by + 4; ly++) {
          let ok = true;
          for (let fz = 0; fz < 4; fz++) {
            if (world.getBlock(x, ly, lz + fz) !== B.OBSIDIAN) ok = false;
            if (world.getBlock(x, ly + 4, lz + fz) !== B.OBSIDIAN) ok = false;
          }
          for (let fy = 0; fy < 5; fy++) {
            if (world.getBlock(x, ly + fy, lz) !== B.OBSIDIAN) ok = false;
            if (world.getBlock(x, ly + fy, lz + 3) !== B.OBSIDIAN) ok = false;
          }
          if (!ok) continue;
          let insideOk = true;
          for (let iz = 1; iz < 3; iz++) for (let iy = 1; iy < 4; iy++) {
            const bid = world.getBlock(x, ly + iy, lz + iz);
            if (bid !== B.AIR && bid !== B.NETHER_PORTAL) insideOk = false;
          }
          if (!insideOk) continue;
          for (let iz = 1; iz < 3; iz++) for (let iy = 1; iy < 4; iy++) {
            world.setBlock(x, ly + iy, lz + iz, B.NETHER_PORTAL);
          }
          return true;
        }
      }
    }
  }
  return false;
}
