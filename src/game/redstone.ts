import { B, isFire, isRedstoneSource } from './blocks';
import { CH } from './constants';

export type WorldLike = {
  canEdit?: (x: number, z: number) => boolean;
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

/** Compatibility helper for existing 4×5 clicked-frame callers. The item uses the exact adjacent ignition cell below. */
export function tryCreatePortal(
  world: WorldLike,
  x: number,
  y: number,
  z: number,
): boolean {
  for (const axis of ["x", "z"])
    for (let lo = -3; lo <= 0; lo++)
      for (let ly = y - 4; ly <= y; ly++) {
        if (
          tryLightPortalAt(
            world,
            x + (axis === "x" ? lo + 1 : 0),
            ly + 1,
            z + (axis === "z" ? lo + 1 : 0),
          )
        )
          return true;
      }
  return false;
}
/** Java-sized obsidian frames: 2..21 × 3..21 interior, optional corners, either axis.
 * No terrain generation; preflight EVERY interior write before activating any part.
 */
export function tryLightPortalAt(
  world: WorldLike,
  x: number,
  y: number,
  z: number,
  permit: (x: number, z: number) => boolean = () => true,
): boolean {
  const empty = (id: number) =>
    id === B.AIR || id === B.NETHER_PORTAL || isFire(id);
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    !Number.isInteger(z) ||
    y < 1 ||
    y >= CH - 1 ||
    !empty(world.peekBlock(x, y, z))
  )
    return false;
  for (const axis of ["x", "z"]) {
    const dx = axis === "x" ? 1 : 0,
      dz = axis === "z" ? 1 : 0;
    let bottom = y,
      steps = 0;
    while (
      bottom > 0 &&
      world.peekBlock(x, bottom - 1, z) !== B.OBSIDIAN &&
      steps < 21
    ) {
      if (!empty(world.peekBlock(x, bottom - 1, z))) break;
      bottom--;
      steps++;
    }
    if (bottom < 1 || world.peekBlock(x, bottom - 1, z) !== B.OBSIDIAN)
      continue;
    let left = 0;
    while (
      left < 21 &&
      empty(
        world.peekBlock(x - (left + 1) * dx, bottom, z - (left + 1) * dz),
      ) &&
      world.peekBlock(x - (left + 1) * dx, bottom - 1, z - (left + 1) * dz) ===
        B.OBSIDIAN
    )
      left++;
    const ox = x - left * dx,
      oz = z - left * dz;
    const at = (i: number, j: number) =>
      world.peekBlock(ox + i * dx, bottom + j, oz + i * dz);
    if (at(-1, 0) !== B.OBSIDIAN) continue;
    let width = 0;
    while (width <= 21 && empty(at(width, 0)) && at(width, -1) === B.OBSIDIAN)
      width++;
    if (width < 2 || width > 21 || at(width, 0) !== B.OBSIDIAN) continue;
    const cells: [number, number, number][] = [];
    let height = 0,
      missing = false,
      valid = true;
    for (let h = 0; h <= 21; h++) {
      if (bottom + h >= CH) {
        valid = false;
        break;
      }
      let roof = true;
      for (let i = 0; i < width; i++)
        if (at(i, h) !== B.OBSIDIAN) {
          roof = false;
          break;
        }
      if (roof) {
        height = h;
        break;
      }
      if (h === 21 || at(-1, h) !== B.OBSIDIAN || at(width, h) !== B.OBSIDIAN) {
        valid = false;
        break;
      }
      for (let i = 0; i < width; i++) {
        const id = at(i, h);
        if (!empty(id)) {
          valid = false;
          break;
        }
        missing ||= id !== B.NETHER_PORTAL;
        cells.push([ox + i * dx, bottom + h, oz + i * dz]);
      }
      if (!valid) break;
    }
    if (!valid || height < 3 || !missing) continue;
    if (
      cells.some(
        ([px, , pz]) =>
          !permit(px, pz) || (world.canEdit && !world.canEdit(px, pz)),
      )
    )
      continue;
    for (const [px, py, pz] of cells)
      world.setBlock(px, py, pz, B.NETHER_PORTAL);
    return cells.every(
      ([px, py, pz]) => world.peekBlock(px, py, pz) === B.NETHER_PORTAL,
    );
  }
  return false;
}
