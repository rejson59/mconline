import * as THREE from 'three';
import type { World } from './world';

const EPS = 0.001;

export interface Body {
  pos: THREE.Vector3; // feet center
  vel: THREE.Vector3;
  w: number; // width
  h: number; // height
  onGround: boolean;
  hitWall: boolean;
}

function collidesAt(world: World, px: number, py: number, pz: number, w: number, h: number): boolean {
  const hw = w / 2;
  const x0 = Math.floor(px - hw + EPS), x1 = Math.floor(px + hw - EPS);
  const y0 = Math.floor(py + EPS), y1 = Math.floor(py + h - EPS);
  const z0 = Math.floor(pz - hw + EPS), z1 = Math.floor(pz + hw - EPS);
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++) if (world.isSolid(x, y, z)) return true;
  return false;
}

export function aabbIntersectsBlock(px: number, py: number, pz: number, w: number, h: number, bx: number, by: number, bz: number) {
  const hw = w / 2;
  return px + hw > bx && px - hw < bx + 1 && py + h > by && py < by + 1 && pz + hw > bz && pz - hw < bz + 1;
}

function moveAxis(world: World, b: Body, axis: 0 | 1 | 2, d: number): boolean {
  if (d === 0) return false;
  const p = b.pos;
  const hw = b.w / 2;
  if (axis === 1) {
    const ny = p.y + d;
    if (!collidesAt(world, p.x, ny, p.z, b.w, b.h)) { p.y = ny; return false; }
    if (d < 0) p.y = Math.floor(ny) + 1 + EPS * 0.5;
    else p.y = Math.floor(ny + b.h) - b.h - EPS * 0.5;
    // safety: if still colliding, just don't move
    if (collidesAt(world, p.x, p.y, p.z, b.w, b.h)) p.y = ny - d;
    return true;
  }
  if (axis === 0) {
    const nx = p.x + d;
    if (!collidesAt(world, nx, p.y, p.z, b.w, b.h)) { p.x = nx; return false; }
    if (d > 0) p.x = Math.floor(nx + hw) - hw - EPS * 0.5;
    else p.x = Math.floor(nx - hw) + 1 + hw + EPS * 0.5;
    if (collidesAt(world, p.x, p.y, p.z, b.w, b.h)) p.x = nx - d;
    return true;
  }
  const nz = p.z + d;
  if (!collidesAt(world, p.x, p.y, nz, b.w, b.h)) { p.z = nz; return false; }
  if (d > 0) p.z = Math.floor(nz + hw) - hw - EPS * 0.5;
  else p.z = Math.floor(nz - hw) + 1 + hw + EPS * 0.5;
  if (collidesAt(world, p.x, p.y, p.z, b.w, b.h)) p.z = nz - d;
  return true;
}

function hasGroundBelow(world: World, px: number, py: number, pz: number, w: number) {
  const hw = w / 2;
  const y = Math.floor(py - 0.05);
  const x0 = Math.floor(px - hw + EPS), x1 = Math.floor(px + hw - EPS);
  const z0 = Math.floor(pz - hw + EPS), z1 = Math.floor(pz + hw - EPS);
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (world.isSolid(x, y, z)) return true;
  return false;
}

export function stepBody(world: World, b: Body, dt: number, sneak = false) {
  const maxMove = Math.max(Math.abs(b.vel.x), Math.abs(b.vel.y), Math.abs(b.vel.z)) * dt;
  const steps = Math.max(1, Math.ceil(maxMove / 0.35));
  const sdt = dt / steps;
  const wasGround = b.onGround;
  b.onGround = false;
  b.hitWall = false;
  for (let i = 0; i < steps; i++) {
    const dy = b.vel.y * sdt;
    if (moveAxis(world, b, 1, dy)) {
      if (dy < 0) b.onGround = true;
      b.vel.y = 0;
    }
    const dx = b.vel.x * sdt;
    const ox = b.pos.x;
    if (moveAxis(world, b, 0, dx)) { b.vel.x = 0; b.hitWall = true; }
    if (sneak && (wasGround || b.onGround) && !hasGroundBelow(world, b.pos.x, b.pos.y, b.pos.z, b.w)) { b.pos.x = ox; b.vel.x = 0; }
    const dz = b.vel.z * sdt;
    const oz = b.pos.z;
    if (moveAxis(world, b, 2, dz)) { b.vel.z = 0; b.hitWall = true; }
    if (sneak && (wasGround || b.onGround) && !hasGroundBelow(world, b.pos.x, b.pos.y, b.pos.z, b.w)) { b.pos.z = oz; b.vel.z = 0; }
  }
  // ground check even when standing still
  if (!b.onGround && b.vel.y <= 0 && hasGroundBelow(world, b.pos.x, b.pos.y + 0.04, b.pos.z, b.w) && b.pos.y - Math.floor(b.pos.y) < 0.01) {
    b.onGround = true;
  }
}
