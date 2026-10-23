import * as THREE from 'three';
import type { World } from './world';
import { collisionBoxes } from './blocks';

const EPS = 0.001;
/**
 * Waniliowa wysokość kroku (0,6 bloku) – na tyle wspinamy się bez skoku.
 * 2.30: dokładnie tyle, ile `Entity#maxUpStep` w grze. Wcześniej było 0,55,
 * więc nie dało się wejść na łóżko (9/16 = 0,5625) bez podskoku.
 */
export const STEP_HEIGHT = 0.6;

export interface Body {
  pos: THREE.Vector3; // feet center
  vel: THREE.Vector3;
  w: number; // width
  h: number; // height
  onGround: boolean;
  hitWall: boolean;
}

/**
 * Czy bryła gracza nachodzi na którąś z brył kolizji bloku?
 * 2.21: płyty, schody, płoty i włazy mają własne pudełka – wcześniej każde
 * `IS_SOLID` blokowało cały sześcian.
 */
function hitsBlock(
  world: World,
  x: number,
  y: number,
  z: number,
  px: number, py: number, pz: number,
  hw: number, h: number
): boolean {
  const boxes = collisionBoxes(world.peekBlock(x, y, z));
  if (!boxes) return false;
  for (let i = 0; i < boxes.length; i += 6) {
    if (
      px + hw > x + boxes[i] &&
      px - hw < x + boxes[i + 3] &&
      py + h > y + boxes[i + 1] &&
      py < y + boxes[i + 4] &&
      pz + hw > z + boxes[i + 2] &&
      pz - hw < z + boxes[i + 5]
    ) return true;
  }
  return false;
}

function collidesAt(world: World, px: number, py: number, pz: number, w: number, h: number): boolean {
  const hw = w / 2;
  const x0 = Math.floor(px - hw + EPS), x1 = Math.floor(px + hw - EPS);
  // 2.21: płot ma 1,5 bloku – sięgamy jedną warstwę wyżej niż stopy.
  const y0 = Math.floor(py + EPS), y1 = Math.floor(py + h - EPS);
  const z0 = Math.floor(pz - hw + EPS), z1 = Math.floor(pz + hw - EPS);
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++) if (hitsBlock(world, x, y, z, px, py, pz, hw, h)) return true;
  return false;
}

export function aabbIntersectsBlock(px: number, py: number, pz: number, w: number, h: number, bx: number, by: number, bz: number) {
  const hw = w / 2;
  return px + hw > bx && px - hw < bx + 1 && py + h > by && py < by + 1 && pz + hw > bz && pz - hw < bz + 1;
}

/**
 * 2.30: najwyższa powierzchnia kolizji pod stopami, ale nie wyżej niż `py`.
 *
 * To naprawia trzęsienie na ścieżce. Wcześniej zejście w dół kończyło się
 * `Math.floor(ny) + 1` – czyli stopami na górnej krawędzi CAŁEJ kratki.
 * Ścieżka i grządka mają 15/16, więc stojąca na nich postać była co klatkę
 * podnoszona o 1/16 bloku i z powrotem opadała (grawitacja) – kamera
 * i modele drgały. Teraz bryła ląduje dokładnie na te 15/16.
 */
function supportTop(world: World, px: number, py: number, pz: number, w: number): number {
  const hw = w / 2;
  const x0 = Math.floor(px - hw + EPS), x1 = Math.floor(px + hw - EPS);
  const z0 = Math.floor(pz - hw + EPS), z1 = Math.floor(pz + hw - EPS);
  const yTop = Math.floor(py + 0.02);
  let best = -Infinity;
  for (let y = yTop; y >= yTop - 2; y--)
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const boxes = collisionBoxes(world.peekBlock(x, y, z));
        if (!boxes) continue;
        for (let i = 0; i < boxes.length; i += 6) {
          if (px + hw <= x + boxes[i] || px - hw >= x + boxes[i + 3]) continue;
          if (pz + hw <= z + boxes[i + 2] || pz - hw >= z + boxes[i + 5]) continue;
          const top = y + boxes[i + 4];
          if (top <= py + 0.02 && top > best) best = top;
        }
      }
  return best;
}

/** 2.30: najniższy spód kolizji nad głową (`Infinity`, gdy nic nie blokuje). */
function ceilingBottom(world: World, px: number, py: number, pz: number, w: number, h: number): number {
  const hw = w / 2;
  const x0 = Math.floor(px - hw + EPS), x1 = Math.floor(px + hw - EPS);
  const z0 = Math.floor(pz - hw + EPS), z1 = Math.floor(pz + hw - EPS);
  const y0 = Math.floor(py + EPS), y1 = Math.floor(py + h + 0.02);
  let best = Infinity;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const boxes = collisionBoxes(world.peekBlock(x, y, z));
        if (!boxes) continue;
        for (let i = 0; i < boxes.length; i += 6) {
          if (px + hw <= x + boxes[i] || px - hw >= x + boxes[i + 3]) continue;
          if (pz + hw <= z + boxes[i + 2] || pz - hw >= z + boxes[i + 5]) continue;
          const bottom = y + boxes[i + 1];
          if (bottom >= py + EPS && bottom < best) best = bottom;
        }
      }
  return best;
}

/** Krok w górę: stopy lądują na rzeczywistej powierzchni, a nie 0,6 nad nią. */
function stepUpTop(world: World, b: Body, nx: number, nz: number): number {
  return supportTop(world, nx, b.pos.y + STEP_HEIGHT, nz, b.w);
}

/** 2.31: najwyższa powierzchnia kolizji nad stopami, do wysokości `maxY`. */
export function surfaceTopBetween(
  world: World,
  px: number,
  py: number,
  pz: number,
  w: number,
  maxY: number,
): number {
  const hw = w / 2;
  const x0 = Math.floor(px - hw + EPS), x1 = Math.floor(px + hw - EPS);
  const z0 = Math.floor(pz - hw + EPS), z1 = Math.floor(pz + hw - EPS);
  const y0 = Math.floor(py + 0.001), y1 = Math.floor(maxY);
  let best = -Infinity;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const boxes = collisionBoxes(world.peekBlock(x, y, z));
        if (!boxes) continue;
        for (let i = 0; i < boxes.length; i += 6) {
          if (px + hw <= x + boxes[i] || px - hw >= x + boxes[i + 3]) continue;
          if (pz + hw <= z + boxes[i + 2] || pz - hw >= z + boxes[i + 5]) continue;
          const top = y + boxes[i + 4];
          if (top > py + 0.001 && top <= maxY + 0.001 && top > best) best = top;
        }
      }
  return best;
}

/**
 * 2.31: czy przed stopami naprawdę stoi przeszkoda wyższa niż krok?
 *
 * To naprawia podskakiwanie na ścieżce. Stara sonda brała klocek na
 * `floor(p.y + 0.05)` – dopóki staliśmy na pełnym bloku (stopy na 65,0),
 * wypadał on NAD stopami. Od 2.30 stopy stoją na 15/16 ścieżki (64,9375),
 * więc `floor` trafiał w sam blok ścieżki pod nogami i gracz „widział”
 * przeszkodę w każdej klatce – auto-skok włączał się bez przerwy.
 *
 * Teraz liczy się wyłącznie powierzchnia WYŻSZA od stóp. Płyty, ścieżki
 * i schody (do 0,6) obsługuje step-up, więc auto-skok włącza się tylko
 * przy prawdziwym bloku – dokładnie jak waniliowe `AutoJump`.
 */
export function autoJumpAhead(
  world: World,
  body: Body,
  dx: number,
  dz: number,
): boolean {
  const len = Math.hypot(dx, dz);
  if (len < 1e-4) return false;
  const probeX = body.pos.x + (dx / len) * (body.w / 2 + 0.32);
  const probeZ = body.pos.z + (dz / len) * (body.w / 2 + 0.32);
  const top = surfaceTopBetween(world, probeX, body.pos.y, probeZ, body.w * 0.9, body.pos.y + 1.25);
  if (!Number.isFinite(top)) return false;
  // Tylko klocek WYŻSZY niż krok (step-up sam sobie radzi z półblokami).
  if (top <= body.pos.y + STEP_HEIGHT + 0.02) return false;
  // Musi być miejsce na całe ciało nad nową powierzchnią.
  return !collidesAt(world, probeX, top + 0.02, probeZ, body.w, body.h);
}


/**
 * 2.3: odbicie od bloku szlamu. Zwraca nową prędkość pionową albo null,
 * gdy odbicia nie było. Odrębna funkcja, bo warunek „byłem w powietrzu”
 * łatwo było napisać tak, że nigdy nie zachodził.
 */
export function slimeBounce(wasGround: boolean, onGround: boolean, velY: number): number | null {
  if (!onGround) return null;
  if (wasGround && velY >= -2) return null;
  return Math.max(6, -velY * 0.8);
}

function moveAxis(world: World, b: Body, axis: 0 | 1 | 2, d: number): boolean {
  if (d === 0) return false;
  const p = b.pos;
  const hw = b.w / 2;
  if (axis === 1) {
    const ny = p.y + d;
    if (!collidesAt(world, p.x, ny, p.z, b.w, b.h)) { p.y = ny; return false; }
    // 2.30: lądujemy na rzeczywistej powierzchni bryły, którą mamy pod
    // stopami (płyta 1/2, ścieżka 15/16, łóżko 9/16…), a nie na suficie
    // całej kratki – właśnie to powodowało drganie na ścieżce.
    if (d < 0) {
      const top = supportTop(world, p.x, p.y, p.z, b.w);
      p.y = Number.isFinite(top) ? top : Math.floor(ny) + 1 + EPS * 0.5;
    } else {
      const bottom = ceilingBottom(world, p.x, ny, p.z, b.w, b.h);
      p.y = Number.isFinite(bottom) ? bottom - b.h - EPS * 0.5 : Math.floor(ny + b.h) - b.h - EPS * 0.5;
    }
    // safety: if still colliding, just don't move
    if (collidesAt(world, p.x, p.y, p.z, b.w, b.h)) p.y = ny - d;
    return true;
  }
  if (axis === 0) {
    const nx = p.x + d;
    if (!collidesAt(world, nx, p.y, p.z, b.w, b.h)) { p.x = nx; return false; }
    // 2.21: automatyczny krok na płytę/schodzenie (0,6) – jak w wanilii.
    // 2.30: po wejściu stopy stają DOKŁADNIE na powierzchni przeszkody;
    // wcześniej dodawaliśmy całe 0,55 i postać spadała pół bloku.
    if (b.onGround && !collidesAt(world, nx, p.y + STEP_HEIGHT, p.z, b.w, b.h)) {
      const top = stepUpTop(world, b, nx, p.z);
      if (Number.isFinite(top)) {
        p.y = Math.max(p.y, top);
        p.x = nx;
        return false;
      }
    }
    if (d > 0) p.x = Math.floor(nx + hw) - hw - EPS * 0.5;
    else p.x = Math.floor(nx - hw) + 1 + hw + EPS * 0.5;
    if (collidesAt(world, p.x, p.y, p.z, b.w, b.h)) p.x = nx - d;
    return true;
  }
  const nz = p.z + d;
  if (!collidesAt(world, p.x, p.y, nz, b.w, b.h)) { p.z = nz; return false; }
  if (b.onGround && !collidesAt(world, p.x, p.y + STEP_HEIGHT, nz, b.w, b.h)) {
    const top = stepUpTop(world, b, p.x, nz);
    if (Number.isFinite(top)) {
      p.y = Math.max(p.y, top);
      p.z = nz;
      return false;
    }
  }
  if (d > 0) p.z = Math.floor(nz + hw) - hw - EPS * 0.5;
  else p.z = Math.floor(nz - hw) + 1 + hw + EPS * 0.5;
  if (collidesAt(world, p.x, p.y, p.z, b.w, b.h)) p.z = nz - d;
  return true;
}

function hasGroundBelow(world: World, px: number, py: number, pz: number, w: number) {
  const hw = w / 2;
  const x0 = Math.floor(px - hw + EPS), x1 = Math.floor(px + hw - EPS);
  const z0 = Math.floor(pz - hw + EPS), z1 = Math.floor(pz + hw - EPS);
  // 2.21: podparciem może być też górna ściana płyty/włazu (nie tylko pełny
  // blok), dlatego sprawdzamy kilka warstw pod stopami i porównujemy wysokość.
  for (let y = Math.floor(py - 1); y <= Math.floor(py); y++)
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const boxes = collisionBoxes(world.peekBlock(x, y, z));
        if (!boxes) continue;
        for (let i = 0; i < boxes.length; i += 6) {
          const top = y + boxes[i + 4];
          if (top > py - 0.12 && top <= py + 0.02 &&
              px + hw > x + boxes[i] && px - hw < x + boxes[i + 3] &&
              pz + hw > z + boxes[i + 2] && pz - hw < z + boxes[i + 5]) return true;
        }
      }
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
    // 2.21: „stoję na ziemi” liczone też w środku kroku – inaczej step-up
    // nigdy się nie włączał, bo na starcie każdej klatki `onGround` jest
    // zerowane i wraca dopiero po ruchu.
    if (!b.onGround && b.vel.y <= 0 && hasGroundBelow(world, b.pos.x, b.pos.y + 0.04, b.pos.z, b.w)) b.onGround = true;
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
