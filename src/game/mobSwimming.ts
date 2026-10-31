import type { World } from './world';
import type { Body } from './physics';
import { bodyFits } from './physics';
import { B, collisionBoxesAt, isDoor, isFence } from './blocks';
import { CS } from './constants';
import { submerged } from './water';

export interface Shore { x: number; y: number; z: number }
/** Bounded search, called at most twice a second per swimming ground mob.
 * Only real, dry landing surfaces with room for this mob's whole body count.
 * No terrain generation, teleportation or climbing tall walls. */
export function findShore(world: World, body: Body): Shore | null {
  let best: Shore | null = null, bestDistance = Infinity;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    for (let distance = 1; distance <= 6; distance++) {
      const x = Math.floor(body.pos.x + dx * distance), z = Math.floor(body.pos.z + dz * distance);
      if (!world.hasChunk(Math.floor(x / CS), Math.floor(z / CS))) break;
      for (let y = Math.floor(body.pos.y) - 1; y <= Math.floor(body.pos.y) + 1; y++) {
        const id = world.peekBlock(x, y, z);
        if (isFence(id) || isDoor(id) || id === B.GLASS_PANE) continue;
        const boxes = collisionBoxesAt(world, x, y, z);
        if (!boxes) continue;
        let top = -Infinity;
        for (let i = 0; i < boxes.length; i += 6) top = Math.max(top, y + boxes[i + 4]);
        if (top > body.pos.y + 1.3 || top < body.pos.y - 0.6 || submerged(world, x + 0.5, top + 0.1, z + 0.5) ||
            !bodyFits(world, x + 0.5, top + 0.01, z + 0.5, body.w, body.h)) continue;
        // A dry ledge behind a taller wall is not a reachable shore.
        let clear = true;
        const steps = Math.ceil(Math.hypot(x + 0.5 - body.pos.x, z + 0.5 - body.pos.z) * 2);
        for (let step = 1; step < steps; step++) {
          const t = step / steps;
          if (!bodyFits(world, body.pos.x + (x + 0.5 - body.pos.x) * t, top + 0.01, body.pos.z + (z + 0.5 - body.pos.z) * t, body.w, body.h)) { clear = false; break; }
        }
        const d = Math.hypot(x + 0.5 - body.pos.x, z + 0.5 - body.pos.z);
        if (clear && d < bestDistance) { best = { x: x + 0.5, y: top, z: z + 0.5 }; bestDistance = d; }
      }
    }
  }
  return best;
}
