import * as THREE from "three";
import type { World } from "./world";
import { CS } from "./constants";
import { bodyFits, stepBody, type Body } from "./physics";
import { collisionBoxesAt } from "./blocks";

/** Never treat not-yet-loaded terrain as air or generate chunks for an entity. */
export function mobAreaLoaded(world: World, b: Body): boolean {
  for (
    let x = Math.floor((b.pos.x - b.w / 2) / CS);
    x <= Math.floor((b.pos.x + b.w / 2) / CS);
    x++
  )
    for (
      let z = Math.floor((b.pos.z - b.w / 2) / CS);
      z <= Math.floor((b.pos.z + b.w / 2) / CS);
      z++
    )
      if (!world.hasChunk(x, z)) return false;
  return true;
}
export function mobFits(world: World, b: Body): boolean {
  return (
    mobAreaLoaded(world, b) &&
    bodyFits(world, b.pos.x, b.pos.y, b.pos.z, b.w, b.h)
  );
}

const blockedRecovery = new WeakMap<
  Body,
  { x: number; y: number; z: number; until: number }
>();

/** Recover an already embedded body, not normal movement. Bounded, nearest
 * collision-face exit; no destructive edits, chunk generation or map-wide scan. */
export function recoverMob(world: World, b: Body): boolean {
  if (!mobAreaLoaded(world, b)) return false;
  if (bodyFits(world, b.pos.x, b.pos.y, b.pos.z, b.w, b.h)) return true;
  const blocked = blockedRecovery.get(b),
    now = performance.now();
  if (
    blocked &&
    now < blocked.until &&
    b.pos.x === blocked.x &&
    b.pos.y === blocked.y &&
    b.pos.z === blocked.z
  )
    return false;
  const origin = b.pos.clone(),
    candidates: THREE.Vector3[] = [],
    gap = 0.002;
  for (
    let x = Math.floor(origin.x - b.w / 2);
    x <= Math.floor(origin.x + b.w / 2);
    x++
  )
    for (let y = Math.floor(origin.y) - 1; y <= Math.floor(origin.y + b.h); y++)
      for (
        let z = Math.floor(origin.z - b.w / 2);
        z <= Math.floor(origin.z + b.w / 2);
        z++
      ) {
        const boxes = collisionBoxesAt(world, x, y, z);
        if (!boxes) continue;
        for (let i = 0; i < boxes.length; i += 6) {
          if (
            origin.x + b.w / 2 <= x + boxes[i] ||
            origin.x - b.w / 2 >= x + boxes[i + 3] ||
            origin.y + b.h <= y + boxes[i + 1] ||
            origin.y >= y + boxes[i + 4] ||
            origin.z + b.w / 2 <= z + boxes[i + 2] ||
            origin.z - b.w / 2 >= z + boxes[i + 5]
          )
            continue;
          candidates.push(
            origin.clone().setX(x + boxes[i] - b.w / 2 - gap),
            origin.clone().setX(x + boxes[i + 3] + b.w / 2 + gap),
            origin.clone().setY(y + boxes[i + 1] - b.h - gap),
            origin.clone().setY(y + boxes[i + 4] + gap),
            origin.clone().setZ(z + boxes[i + 2] - b.w / 2 - gap),
            origin.clone().setZ(z + boxes[i + 5] + b.w / 2 + gap),
          );
        }
      }
  const unique = [
    ...new Map(
      candidates.map((point) => [point.toArray().join(","), point]),
    ).values(),
  ];
  unique.sort(
    (a, c) => a.distanceToSquared(origin) - c.distanceToSquared(origin),
  );
  for (const point of unique) {
    if (point.distanceToSquared(origin) > 4) continue;
    b.pos.copy(point);
    if (mobFits(world, b)) {
      b.vel.set(0, 0, 0);
      b.hitWall = true;
      return true;
    }
  }
  b.pos.copy(origin);
  blockedRecovery.set(b, {
    x: origin.x,
    y: origin.y,
    z: origin.z,
    until: now + 250,
  });
  return false;
}

/** Presentation only: never writes the authoritative body, snapshots or timers.
 * Unlike an exponential lerp this traverses the entire exchange interval; a
 * 350 ms packet stream does not become a sequence of sprints and stops. */
export class MobMotion {
  private target = new THREE.Vector3(NaN, NaN, NaN);
  private from = new THREE.Vector3();
  private elapsed = 0;
  private duration = 0.35;
  private phase = 0;
  private scratch: Body = {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    w: 1,
    h: 1,
    onGround: false,
    hitWall: false,
  };

  present(
    world: World,
    body: Body,
    group: THREE.Group,
    yaw: number,
    dt: number,
    interval = 0.35,
  ): number {
    dt = Math.max(0, Math.min(0.1, dt));
    if (!this.target.equals(body.pos)) {
      this.from.copy(group.position);
      this.target.copy(body.pos);
      const observed = this.elapsed;
      this.duration = Math.max(
        1 / 60,
        Math.min(
          0.6,
          observed >= interval && observed <= 0.8 ? observed : interval,
        ),
      );
      this.elapsed = 0;
    }
    this.elapsed += dt;
    const b = this.scratch;
    b.w = body.w;
    b.h = body.h;
    // Do not drag a teleport (or a newly visible entity) across intervening walls.
    if (group.position.distanceToSquared(this.target) > 64) {
      if (!mobFits(world, body)) {
        group.visible = false;
        return 0;
      }
      group.position.copy(this.target);
      this.from.copy(this.target);
    }
    b.pos.copy(group.position);
    b.vel.set(0, 0, 0);
    if (!recoverMob(world, b)) {
      group.visible = false;
      return 0;
    }
    const oldX = b.pos.x,
      oldZ = b.pos.z;
    const t = Math.min(1, this.elapsed / this.duration);
    b.vel.copy(this.from).lerp(this.target, t).sub(b.pos);
    // Sweep the actual shapes. Linear interpolation around a corner must not
    // cut through its wall even if both network endpoints are individually safe.
    b.onGround = false;
    b.hitWall = false;
    stepBody(world, b, 1);
    if (!mobFits(world, b)) {
      group.visible = false;
      return 0;
    }
    group.position.copy(b.pos);
    const deltaYaw = Math.atan2(
      Math.sin(yaw - group.rotation.y),
      Math.cos(yaw - group.rotation.y),
    );
    group.rotation.y += deltaYaw * (1 - Math.exp(-10 * dt));
    const distance = Math.hypot(b.pos.x - oldX, b.pos.z - oldZ);
    this.phase += distance * 3.2;
    // Stop the feet when the actual model stops, including stalls and walls.
    return (
      Math.sin(this.phase) * Math.min(0.7, dt > 0 ? (distance / dt) * 0.35 : 0)
    );
  }
}

/** Nearby crowd queries, not all-pairs scans for every physics substep. */
export function mobNeighbours<T extends { body: Body; dead: boolean }>(
  mobs: T[],
): (mob: T) => T[] {
  const cells = new Map<string, T[]>(),
    size = 4;
  let reach = 1;
  for (const m of mobs) {
    if (m.dead) continue;
    reach = Math.max(reach, Math.ceil(m.body.w / size));
    const key = `${Math.floor(m.body.pos.x / size)},${Math.floor(m.body.pos.z / size)}`;
    const list = cells.get(key);
    if (list) list.push(m);
    else cells.set(key, [m]);
  }
  return (m) => {
    const result: T[] = [],
      x = Math.floor(m.body.pos.x / size),
      z = Math.floor(m.body.pos.z / size);
    for (let dx = -reach; dx <= reach; dx++)
      for (let dz = -reach; dz <= reach; dz++) {
        const cell = cells.get(`${x + dx},${z + dz}`);
        if (cell) result.push(...cell);
      }
    return result;
  };
}
