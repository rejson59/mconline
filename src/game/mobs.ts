import * as THREE from 'three';
import { CS, type World, type Biome } from './world';
import { stepBody, type Body } from './physics';
import { boundedPathStep } from './pathfinding';
import { IS_SOLID, IS_OPAQUE, RENDER, B, isDoor } from './blocks';
import { isFood } from './items';
import { PROFESSIONS, createVillagerState, professionFor, type VillagerState } from './trading';

export type MobType = 'echolurker' | 'sandstalker' | 'merchant' | 'pack_animal' | 'guard' | 'bear' | 'turtle' | 'lizard' | 'bat' | 'frog' | 'midge' | 'fox' | 'rabbit' | 'pig' | 'zombie' | 'sheep' | 'cow' | 'chicken' | 'creeper' | 'spider' | 'skeleton' | 'wolf' | 'villager' | 'golem' | 'enderman' | 'slime' | 'ghast';

/** Transient sound positions. The listener never receives the player's current
 * position as a pursuit goal: only footsteps, mining and item impacts count. */
export interface CaveNoise {
  id: number; x: number; y: number; z: number; radius: number; ttl: number;
  source: 'player' | 'decoy';
}

/** A fox may target only abandoned, ordinary food stacks, not equipment or potions. */
export interface FoxFood { id: number; count: number; age: number; pos: THREE.Vector3 }

/** Rabbits prefer meadows; foxes range from taiga into older forests. */
export function pickPassiveMob(roll: number, biome: Biome): MobType {
  if ((biome === 'Kwiecista łąka' && roll < 0.42) || (biome === 'Równiny' && roll < 0.025)) return 'rabbit';
  if ((biome === 'Tajga' && roll < 0.3) ||
      (biome === 'Kwiecista łąka' && roll >= 0.42 && roll < 0.54) ||
      (biome === 'Las' && roll >= 0.1 && roll < 0.18)) return 'fox';
  return roll < 0.1 ? 'wolf' : roll < 0.4 ? 'cow' : roll < 0.65 ? 'chicken' : roll < 0.88 ? 'pig' : 'sheep';
}

/** Checks only already-loaded cells around solid shore ground. No chunk
 * generation, so a pond crossing a chunk border remains safe to query. */
export function shoreWaterNearby(world: Pick<World, 'peekBlock'>, x: number, y: number, z: number): boolean {
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
    if (world.peekBlock(x + dx, y - 1, z + dz) === B.WATER ||
        world.peekBlock(x + dx, y, z + dz) === B.WATER) return true;
  }
  return false;
}

/** Eggs and turtles require actual sand within three cells of water, not
 * merely a beach biome. The animal may be on adjacent wet sand or water. */
export function turtleSpawnAllowed(world: Pick<World, 'peekBlock'>, x: number, y: number, z: number): boolean {
  return world.peekBlock(x, y - 1, z) === B.SAND && world.peekBlock(x, y, z) === B.AIR &&
    world.peekBlock(x, y + 1, z) === B.AIR && shoreWaterNearby(world, x, y, z);
}

export function findTurtleNest(world: Pick<World, 'peekBlock' | 'hasChunk'>, x: number, y: number, z: number): { x: number; y: number; z: number } | null {
  for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const xx = x + dx, zz = z + dz;
    if (!world.hasChunk(Math.floor(xx / CS), Math.floor(zz / CS))) continue;
    if (turtleSpawnAllowed(world, xx, y, zz)) return { x: xx, y, z: zz };
  }
  return null;
}

/** Caravan cargo is chosen from existing, usable trade inventories. Append no
 * new profession indices: old villager saves retain their job and prices. */
export function merchantProfession(biome: Biome): number {
  if (biome === 'Pustynia' || biome === 'Sawanna' || biome === 'Pustkowie') return 5; // maps and compass
  if (biome === 'Bagno' || biome === 'Ocean' || biome === 'Plaża') return 6; // fish and bait
  if (biome === 'Tajga' || biome === 'Tundra' || biome === 'Las' || biome === 'Brzozowy las') return 7; // plants
  return 4; // general building supplies
}

export type VillagerActivity = 'rest' | 'work' | 'meet';
/** World day runs from dawn (0) through noon (.25) to dusk (.5). */
export function villagerActivity(phase: number): VillagerActivity {
  const time = ((phase % 1) + 1) % 1;
  if (time < 0.015 || time >= 0.62) return 'rest';
  if (time < 0.17 || time >= 0.46) return 'meet';
  return 'work';
}

/** Accept only a straight, loaded, level and open walking route. Villagers
 * never try to cross walls just to reach a workstation or meeting. */
export function villagerWalkable(world: Pick<World, 'peekBlock' | 'hasChunk'>, x: number, y: number, z: number, tx: number, tz: number): boolean {
  const steps = Math.ceil(Math.hypot(tx - x, tz - z) * 3);
  for (let i = 1; i <= steps; i++) {
    const px = Math.floor(x + (tx - x) * i / steps), pz = Math.floor(z + (tz - z) * i / steps);
    if (!world.hasChunk(Math.floor(px / CS), Math.floor(pz / CS)) ||
      IS_SOLID[world.peekBlock(px, y, pz)] || IS_SOLID[world.peekBlock(px, y + 1, pz)] ||
      !IS_SOLID[world.peekBlock(px, y - 1, pz)] || world.peekBlock(px, y - 1, pz) === B.MAGMA) return false;
  }
  return true;
}

/** Workstation scanning is bounded and only happens when schedule changes or
 * every few seconds; old village profession indices remain unchanged. */
export function villagerWorkSpot(world: Pick<World, 'peekBlock' | 'hasChunk'>, x: number, y: number, z: number, profession: number): { x: number; z: number } | null {
  const job = PROFESSIONS[profession]?.id;
  const work: number[] = job === 'rolnik' || job === 'ogrodnik' ? [B.FARMLAND, B.CROP0, B.CROP1, B.CROP2, B.CROP3]
    : job === 'kowal' ? [B.FURNACE, B.ANVIL]
    : job === 'bibliotekarz' || job === 'kartograf' ? [B.BOOKSHELF]
    : job === 'rybak' ? [B.WATER]
    : job === 'pasterz' ? [B.HAY] : [B.CRAFTING];
  let best = 121;
  let found: { x: number; z: number } | null = null;
  for (let dx = -10; dx <= 10; dx++) for (let dz = -10; dz <= 10; dz++) {
    const d2 = dx * dx + dz * dz;
    if (d2 >= best || d2 > 100) continue;
    const wx = x + dx, wz = z + dz;
    if (!world.hasChunk(Math.floor(wx / CS), Math.floor(wz / CS))) continue;
    if (![y - 1, y].some((yy) => work.includes(world.peekBlock(wx, yy, wz)))) continue;
    for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const tx = wx + sx, tz = wz + sz;
      if (!villagerWalkable(world, x + 0.5, y, z + 0.5, tx + 0.5, tz + 0.5)) continue;
      const dist = (tx - x) ** 2 + (tz - z) ** 2;
      if (dist < best) { best = dist; found = { x: tx + 0.5, z: tz + 0.5 }; }
    }
  }
  return found;
}

/** Surface bats leave their daytime resting place only after dusk. */
export function batSpawnAllowed(top: number, biome: Biome, daylight: number): boolean {
  return daylight < 0.45 && (biome === 'Las' || biome === 'Brzozowy las' || biome === 'Tajga' || biome === 'Bagno') &&
    (top === B.GRASS || top === B.PODZOL || top === B.MUD);
}

/** Bounded local search; only already loaded, dry cells with a two-block-high
 * covered space and solid floor count as shelter. No distant pathfinding. */
export function findNearbyShelter(world: Pick<World, 'peekBlock' | 'hasChunk'>, x: number, y: number, z: number): { x: number; z: number } | null {
  let best = 49;
  let result: { x: number; z: number } | null = null;
  for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) {
    const d2 = dx * dx + dz * dz;
    if (d2 > 36 || d2 >= best) continue;
    const xx = x + dx, zz = z + dz;
    if (!world.hasChunk(Math.floor(xx / CS), Math.floor(zz / CS))) continue;
    const floor = world.peekBlock(xx, y - 1, zz);
    const feet = world.peekBlock(xx, y, zz);
    const head = world.peekBlock(xx, y + 1, zz);
    const roof = world.peekBlock(xx, y + 2, zz);
    if (!IS_SOLID[floor] || floor === B.MAGMA || floor === B.CAMPFIRE ||
      (feet !== B.AIR && RENDER[feet] !== 1) || head !== B.AIR || !IS_SOLID[roof] || roof === B.CACTUS) continue;
    // Do not choose the inside of a sealed building: direct movement cannot
    // walk through walls, and endlessly pressing against them is misleading.
    const steps = Math.ceil(Math.sqrt(d2) * 2);
    let reachable = true;
    for (let step = 1; step <= steps; step++) {
      const px = Math.floor(x + dx * step / Math.max(1, steps));
      const pz = Math.floor(z + dz * step / Math.max(1, steps));
      if (IS_SOLID[world.peekBlock(px, y, pz)] || IS_SOLID[world.peekBlock(px, y + 1, pz)]) { reachable = false; break; }
    }
    if (!reachable) continue;
    best = d2;
    result = { x: xx + 0.5, z: zz + 0.5 };
  }
  return result;
}

/** Nearby open flames are avoided, but never queried outside loaded chunks. */
export function nearestFire(world: Pick<World, 'peekBlock' | 'hasChunk'>, x: number, y: number, z: number): { x: number; z: number; safe: number } | null {
  let best = 16;
  let result: { x: number; z: number; safe: number } | null = null;
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
    const xx = x + dx, zz = z + dz;
    if (!world.hasChunk(Math.floor(xx / CS), Math.floor(zz / CS))) continue;
    for (const yy of [y - 1, y, y + 1]) {
      const id = world.peekBlock(xx, yy, zz);
      const safe = id === B.CAMPFIRE ? 3.2 : id === B.TORCH ? 2 : 0;
      if (!safe) continue;
      const d2 = dx * dx + dz * dz;
      if (d2 < best) { best = d2; result = { x: xx + 0.5, z: zz + 0.5, safe }; }
    }
  }
  return result;
}

/** A cheap local step away from fire. Do not walk into walls, lava, or cliffs
 * just because the direct outward vector points there. */
export function fireEscapeHeading(world: Pick<World, 'peekBlock'>, x: number, y: number, z: number, fireX: number, fireZ: number): number | null {
  const oldDist = Math.hypot(x - fireX, z - fireZ);
  let best = oldDist + 0.08;
  let heading: number | null = null;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const nx = x + Math.sin(a) * 1.1, nz = z + Math.cos(a) * 1.1;
    const xx = Math.floor(nx), zz = Math.floor(nz);
    const ground = world.peekBlock(xx, y - 1, zz);
    const feet = world.peekBlock(xx, y, zz);
    const head = world.peekBlock(xx, y + 1, zz);
    if (!IS_SOLID[ground] || ground === B.CAMPFIRE || ground === B.MAGMA ||
      ground === B.LAVA || feet === B.WATER || feet === B.LAVA || IS_SOLID[feet] || IS_SOLID[head]) continue;
    const d = Math.hypot(nx - fireX, nz - fireZ);
    if (d > best) { best = d; heading = a; }
  }
  return heading;
}

export function isHostileMob(type: MobType): boolean {
  return type === 'echolurker' || type === 'sandstalker' || type === 'zombie' || type === 'creeper' || type === 'spider' || type === 'skeleton' || type === 'enderman' || type === 'slime' || type === 'ghast';
}

/** Mieszkańcy i golemy nie znikają tak szybko, gdy gracz odejdzie od osady. */
export function isVillageMob(type: MobType): boolean {
  return type === 'villager' || type === 'golem' || type === 'guard';
}

function box(w: number, h: number, d: number, color: number, mats: Map<number, THREE.Material>) {
  let m = mats.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    mats.set(color, m);
  }
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  return mesh;
}

const sharedMats = new Map<number, THREE.Material>();

export class Mob {
  type: MobType;
  group = new THREE.Group();
  body: Body;
  yaw = Math.random() * Math.PI * 2;
  health: number;
  maxHealth: number;
  hurtTime = 0;
  dead = false;
  deathTime = 0;
  aiTimer = 0;
  walking = false;
  walkPhase = 0;
  attackCooldown = 0;
  soundTimer = 3 + Math.random() * 10;
  /** Creeper fuse. -1 = idle, otherwise seconds left. */
  fuse = -1;
  exploded = false;
  looted = false;
  sheared = false;
  /** Tamed wolves follow the player and fight hostiles for them. */
  tamed = false;
  /** Grabież (Looting): extra drops rolled when this mob's loot is collected. */
  bonusLoot = 0;
  /** A purely visual munching cue, not a held inventory item. */
  foxSnack = 0;
  private tongueTime = 0;
  private tongueMesh: THREE.Mesh | null = null;
  private lizardSkin: THREE.MeshLambertMaterial | null = null;
  private lizardFace: THREE.MeshLambertMaterial | null = null;
  private camouflageGround = -1;
  isCub = false;
  merchantRegion = '';
  private strikeWindup = 0;
  private strikeWarning: THREE.Mesh | null = null;
  private heardId = 0;
  private heardGoal: { x: number; y: number; z: number; source: CaveNoise['source'] } | null = null;
  private heardTime = 0;
  private sandBody: THREE.Group | null = null;
  private sandMound: THREE.Mesh | null = null;
  private sandWarning: THREE.Mesh | null = null;
  private sandBuried = true;
  private sandTelegraph = 0;
  private sandActive = 0;
  private bearWarning: THREE.Mesh | null = null;
  private bearWindup = 0;
  private bearCooldown = 0;
  private bearAlert = 0;
  private blockedTime = 0;
  private routeTimer = 0;
  private routeGoal: { x: number; z: number } | null = null;
  private routeStep: { x: number; z: number } | null = null;
  private routeBlocked = false;
  private activityTimer = 0;
  private activityGoal: { x: number; z: number } | null = null;
  private activityKind: VillagerActivity | null = null;
  private eggTimer = 10 + Math.random() * 10;
  private fireTimer = 0;
  private nearbyFlame: { x: number; z: number; safe: number } | null = null;
  private shelterTimer = 0;
  private shelterGoal: { x: number; z: number } | null = null;
  /** True while a spider crawls up a wall (drives the leg animation). */
  climbing = false;
  /** 1.6: zawód mieszkańca (indeks w PROFESSIONS) i jego stan handlu. */
  profession = 0;
  trade: VillagerState | null = null;
  /** 1.6: dom mieszkańca / posterunek golema – wracają w jego okolice. */
  home = new THREE.Vector3();
  /** 1.6: golem pamięta, że gracz skrzywdził mieszkańca (sekundy gniewu). */
  provoked = 0;
  /** 1.6: mieszkaniec ucieka przez kilka sekund po otrzymaniu ciosu. */
  panic = 0;
  private woolMesh: THREE.Mesh | null = null;
  legs: THREE.Object3D[] = [];
  arms: THREE.Object3D[] = [];
  head!: THREE.Object3D;
  meshes: THREE.Mesh[] = [];

  constructor(type: MobType, x: number, y: number, z: number, profession = 0) {
    this.type = type;
    this.home.set(x, y, z);
    const w =
      type === 'zombie' || type === 'creeper' || type === 'villager' || type === 'merchant' || type === 'guard' ? 0.6
        : type === 'pack_animal' ? 0.9
        : type === 'echolurker' ? 0.72
        : type === 'sandstalker' ? 0.7
        : type === 'bear' ? 1.15
        : type === 'turtle' ? 0.78
        : type === 'lizard' ? 0.36
        : type === 'bat' ? 0.36
        : type === 'frog' ? 0.48
        : type === 'midge' ? 0.2
        : type === 'fox' ? 0.55
        : type === 'rabbit' ? 0.38
        : type === 'chicken' ? 0.45
          : type === 'cow' ? 1.1
            : type === 'golem' ? 1.0
              : type === 'wolf' ? 0.6
                : type === 'enderman' ? 0.6
                  : type === 'slime' ? 0.9
                    : type === 'ghast' ? 2.0 : 0.9;
    const h =
      type === 'zombie' || type === 'villager' || type === 'merchant' || type === 'guard' ? 1.9
        : type === 'creeper' ? 1.7
          : type === 'golem' ? 2.2
            : type === 'enderman' ? 2.9
              : type === 'slime' ? 0.9
                : type === 'ghast' ? 2.0
                  : type === 'pack_animal' ? 1.35
                  : type === 'echolurker' ? 1.65
                  : type === 'sandstalker' ? 1.15
                  : type === 'bear' ? 1.4
                  : type === 'turtle' ? 0.6
                  : type === 'lizard' ? 0.35
                  : type === 'bat' ? 0.4
                  : type === 'frog' ? 0.47 : type === 'midge' ? 0.26
                  : type === 'fox' ? 0.72 : type === 'rabbit' ? 0.65 : type === 'cow' ? 1.4 : type === 'chicken' ? 0.7 : type === 'sheep' ? 1.2 : type === 'wolf' ? 0.9 : 0.9;
    this.body = { pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), w, h, onGround: false, hitWall: false };
    this.maxHealth = this.health =
      type === 'zombie' ? 20
        : type === 'creeper' ? 16
          : type === 'cow' ? 10
            : type === 'echolurker' ? 18
            : type === 'sandstalker' ? 14
            : type === 'bear' ? 26
            : type === 'turtle' ? 10
            : type === 'lizard' ? 4
            : type === 'bat' ? 4
            : type === 'frog' ? 5
            : type === 'midge' ? 1
            : type === 'fox' ? 9
            : type === 'rabbit' ? 4
            : type === 'chicken' ? 4
              : type === 'sheep' ? 8
                : type === 'skeleton' ? 20
                  : type === 'spider' ? 16
                    : type === 'golem' ? 100
                      : type === 'villager' || type === 'guard' || type === 'merchant' ? 20
                      : type === 'pack_animal' ? 16
                        : type === 'wolf' ? 8
                          : type === 'enderman' ? 40
                            : type === 'slime' ? 12
                              : type === 'ghast' ? 10 : 10;
    this.profession = type === 'villager' ? professionFor(profession) : type === 'merchant' ? Math.max(0, Math.min(PROFESSIONS.length - 1, Math.floor(profession))) : 0;
    if (type === 'villager' || type === 'merchant') this.trade = createVillagerState(this.profession, 0);
    this.build();
  }

  /** Spawned family member shares bear AI but flees and never attacks. */
  makeCub(): void {
    if (this.type !== 'bear' || this.isCub) return;
    this.isCub = true;
    this.group.scale.setScalar(0.6);
    this.body.w *= 0.6;
    this.body.h *= 0.6;
    this.maxHealth = this.health = 8;
  }

  /** Marks a wild wolf as tamed (friendly coat, full health). */
  tame(): boolean {
    if (this.type !== 'wolf' || this.tamed || this.dead) return false;
    this.tamed = true;
    this.health = this.maxHealth;
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = mesh.material as THREE.MeshLambertMaterial;
      const hex = m.color.getHex();
      if (hex === 0x7a8089) m.color.setHex(0xa05a48); // coat turns rust-red
      else if (hex === 0x5d626b) m.color.setHex(0x7a4238);
    });
    return true;
  }

  private addLeg(x: number, y: number, z: number, w: number, h: number, d: number, color: number, arr: THREE.Object3D[]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    const m = box(w, h, d, color, sharedMats);
    m.position.y = -h / 2;
    pivot.add(m);
    this.meshes.push(m);
    this.group.add(pivot);
    arr.push(pivot);
    return pivot;
  }

  private build() {
    const g = this.group;
    if (this.type === 'pig' || this.type === 'sheep' || this.type === 'cow') {
      const isSheep = this.type === 'sheep';
      const isCow = this.type === 'cow';
      const bodyColor = isCow ? 0x6b4423 : isSheep ? 0xeeeeee : 0xf0a0a0;
      const skin = isCow ? 0x8a5a32 : isSheep ? 0xd8c8b0 : 0xf0a0a0;
      const legH = isCow ? 0.62 : isSheep ? 0.5 : 0.35;
      const body = box(isCow ? 0.9 : isSheep ? 0.75 : 0.62, isCow ? 0.75 : isSheep ? 0.62 : 0.55, isCow ? 1.35 : 1.0, bodyColor, sharedMats);
      body.position.set(0, legH + (isCow ? 0.36 : 0.28), 0);
      g.add(body);
      this.meshes.push(body);
      if (isSheep) this.woolMesh = body;
      if (isCow) {
        const spot = box(0.28, 0.22, 0.32, 0xf2f2f2, sharedMats);
        spot.position.set(0.22, legH + 0.55, -0.15);
        g.add(spot);
        this.meshes.push(spot);
      }
      const head = new THREE.Group();
      head.position.set(0, legH + (isCow ? 0.7 : 0.45), isCow ? 0.72 : 0.55);
      const hm = box(isCow ? 0.55 : 0.5, isCow ? 0.55 : 0.5, isCow ? 0.5 : 0.45, skin, sharedMats);
      head.add(hm);
      this.meshes.push(hm);
      if (!isSheep) {
        const snout = box(isCow ? 0.32 : 0.28, isCow ? 0.2 : 0.18, 0.1, isCow ? 0xd9a0a0 : 0xe07f86, sharedMats);
        snout.position.set(0, isCow ? -0.12 : -0.08, 0.28);
        head.add(snout);
        this.meshes.push(snout);
      }
      if (isCow) {
        const hornL = box(0.08, 0.16, 0.08, 0xeee8dc, sharedMats);
        hornL.position.set(-0.18, 0.32, 0.05);
        const hornR = hornL.clone();
        hornR.position.x = 0.18;
        head.add(hornL, hornR);
        this.meshes.push(hornL, hornR);
      }
      const eyeL = box(0.08, 0.08, 0.02, 0x111111, sharedMats);
      eyeL.position.set(-0.14, 0.08, 0.23);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.14;
      head.add(eyeL, eyeR);
      g.add(head);
      this.head = head;
      const lc = isCow ? 0x6b4423 : isSheep ? 0xd8c8b0 : 0xf0a0a0;
      const lw = isCow ? 0.26 : 0.22;
      const fz = isCow ? 0.46 : 0.32;
      const bz = isCow ? -0.46 : -0.32;
      const lx = isCow ? 0.24 : 0.18;
      this.addLeg(-lx, legH, fz, lw, legH, lw, lc, this.legs);
      this.addLeg(lx, legH, fz, lw, legH, lw, lc, this.legs);
      this.addLeg(-lx, legH, bz, lw, legH, lw, lc, this.legs);
      this.addLeg(lx, legH, bz, lw, legH, lw, lc, this.legs);
    } else if (this.type === 'echolurker') {
      // Pale antennae and a sealed face make the creature legible even at
      // low texture resolution; there are deliberately no glowing eyes.
      const hide = 0x293b42, crest = 0x9aceb5, seam = 0x627f79;
      for (const sx of [-0.21, 0.21]) this.addLeg(sx, 0.38, 0, 0.2, 0.76, 0.24, hide, this.legs);
      const torso = box(0.69, 0.86, 0.46, hide, sharedMats);
      torso.position.y = 1.03; g.add(torso); this.meshes.push(torso);
      const head = new THREE.Group(); head.position.set(0, 1.55, 0);
      const skull = box(0.58, 0.42, 0.5, hide, sharedMats);
      const blindfold = box(0.59, 0.13, 0.06, seam, sharedMats);
      blindfold.position.set(0, 0.06, 0.27);
      head.add(skull, blindfold); this.meshes.push(skull, blindfold);
      for (const side of [-1, 1]) {
        const ear = box(0.13, 0.33, 0.16, crest, sharedMats);
        ear.position.set(side * 0.36, 0.13, -0.04);
        head.add(ear); this.meshes.push(ear);
        this.addLeg(side * 0.43, 1.02, 0.08, 0.17, 0.62, 0.19, hide, this.arms);
      }
      g.add(head); this.head = head;
    } else if (this.type === 'sandstalker') {
      const ochre = 0x8f6440, dark = 0x433624;
      const mound = box(0.83, 0.1, 0.83, 0xc39d69, sharedMats);
      mound.position.y = 0.06;
      g.add(mound); this.meshes.push(mound); this.sandMound = mound;
      const warning = box(0.62, 0.2, 0.14, 0xff8f32, sharedMats);
      warning.position.set(0, 0.28, 0);
      warning.visible = false;
      g.add(warning); this.meshes.push(warning); this.sandWarning = warning;
      const risen = new THREE.Group();
      const torso = box(0.63, 0.76, 0.5, ochre, sharedMats);
      torso.position.set(0, 0.75, 0);
      const face = box(0.54, 0.28, 0.4, dark, sharedMats);
      face.position.set(0, 1.2, 0.09);
      risen.add(torso, face); this.meshes.push(torso, face);
      for (const side of [-1, 1]) {
        const eye = box(0.09, 0.07, 0.03, 0xf0de9d, sharedMats);
        eye.position.set(side * 0.16, 1.24, 0.31);
        const claw = box(0.18, 0.45, 0.2, dark, sharedMats);
        claw.position.set(side * 0.43, 0.78, 0.12);
        risen.add(eye, claw); this.meshes.push(eye, claw);
        this.addLeg(side * 0.2, 0.25, 0, 0.19, 0.48, 0.18, ochre, this.legs);
      }
      // Legs are children of the main group, hidden separately while buried.
      for (const leg of this.legs) { g.remove(leg); risen.add(leg); }
      risen.visible = false;
      g.add(risen); this.sandBody = risen;
    } else if (this.type === 'bear') {
      const fur = 0x684735, muzzle = 0xb99877, dark = 0x34271f;
      const torso = box(1.02, 0.92, 1.28, fur, sharedMats);
      torso.position.set(0, 0.78, -0.1);
      const snout = box(0.62, 0.45, 0.53, muzzle, sharedMats);
      snout.position.set(0, 1.04, 0.75);
      const nose = box(0.23, 0.15, 0.12, dark, sharedMats);
      nose.position.set(0, 1.02, 1.04);
      g.add(torso, snout, nose);
      this.meshes.push(torso, snout, nose);
      for (const side of [-1, 1]) {
        const ear = box(0.23, 0.24, 0.17, fur, sharedMats);
        ear.position.set(side * 0.37, 1.39, 0.44);
        const eye = box(0.09, 0.1, 0.035, dark, sharedMats);
        eye.position.set(side * 0.24, 1.24, 1.02);
        g.add(ear, eye); this.meshes.push(ear, eye);
      }
      for (const side of [-1, 1]) for (const z of [-0.56, 0.48]) {
        this.addLeg(side * 0.37, 0.34, z, 0.29, 0.64, 0.33, fur, this.legs);
      }
      // Visible red warning strip rises over the head throughout the windup.
      const warning = box(0.65, 0.09, 0.13, 0xf07d36, sharedMats);
      warning.position.set(0, 1.66, 0.5);
      warning.visible = false;
      g.add(warning); this.meshes.push(warning);
      this.bearWarning = warning;
    } else if (this.type === 'turtle') {
      const green = 0x638a66, shell = 0x416850, light = 0x86a771;
      const body = box(0.62, 0.22, 0.78, green, sharedMats);
      body.position.set(0, 0.22, 0);
      const rim = box(0.83, 0.12, 0.92, 0x344e39, sharedMats);
      rim.position.set(0, 0.36, -0.02);
      const carapace = box(0.7, 0.19, 0.79, shell, sharedMats);
      carapace.position.set(0, 0.48, -0.02);
      g.add(body, rim, carapace);
      this.meshes.push(body, rim, carapace);
      for (const x of [-0.19, 0.19]) for (const z of [-0.23, 0.22]) {
        const scute = box(0.22, 0.02, 0.21, light, sharedMats);
        scute.position.set(x, 0.584, z);
        g.add(scute); this.meshes.push(scute);
      }
      const head = new THREE.Group();
      head.position.set(0, 0.25, 0.47);
      const face = box(0.32, 0.26, 0.34, green, sharedMats);
      head.add(face); this.meshes.push(face);
      for (const side of [-1, 1]) {
        const eye = box(0.053, 0.06, 0.035, 0x19291b, sharedMats);
        eye.position.set(side * 0.116, 0.05, 0.18);
        head.add(eye); this.meshes.push(eye);
      }
      g.add(head); this.head = head;
      for (const side of [-1, 1]) for (const z of [-0.29, 0.28]) {
        this.addLeg(side * 0.34, 0.12, z, 0.23, 0.12, 0.19, green, this.legs);
      }
    } else if (this.type === 'lizard') {
      // Bright eyes and a pale stripe stay legible through color changes.
      // build() clones each material per mob after assembling the model.
      const body = box(0.32, 0.2, 0.48, 0x4a8255, sharedMats);
      body.position.set(0, 0.21, -0.07);
      const tail = box(0.11, 0.11, 0.4, 0x324c3b, sharedMats);
      tail.position.set(0, 0.19, -0.48);
      const stripe = box(0.09, 0.023, 0.43, 0xd9d69b, sharedMats);
      stripe.position.set(0, 0.325, -0.07);
      g.add(body, tail, stripe);
      this.meshes.push(body, tail, stripe);
      const head = new THREE.Group();
      head.position.set(0, 0.24, 0.25);
      const face = box(0.27, 0.18, 0.23, 0x4a8255, sharedMats);
      head.add(face);
      this.meshes.push(face);
      for (const side of [-1, 1]) {
        const eye = box(0.045, 0.04, 0.025, 0xf5db8a, sharedMats);
        eye.position.set(side * 0.087, 0.06, 0.13);
        head.add(eye);
        this.meshes.push(eye);
      }
      g.add(head);
      this.head = head;
      for (const side of [-1, 1]) for (const z of [-0.17, 0.2]) {
        this.addLeg(side * 0.15, 0.13, z, 0.08, 0.13, 0.09, 0x335543, this.legs);
      }
    } else if (this.type === 'bat') {
      const brown = 0x534741, wingColor = 0x867272;
      const body = box(0.24, 0.29, 0.24, brown, sharedMats);
      const head = new THREE.Group();
      head.position.set(0, 0.13, 0.15);
      const face = box(0.2, 0.16, 0.15, brown, sharedMats);
      head.add(face);
      this.meshes.push(body, face);
      for (const side of [-1, 1]) {
        const ear = box(0.055, 0.11, 0.055, wingColor, sharedMats);
        ear.position.set(side * 0.07, 0.14, 0);
        const eye = box(0.035, 0.04, 0.021, 0xf4b078, sharedMats);
        eye.position.set(side * 0.055, 0.01, 0.087);
        head.add(ear, eye);
        this.meshes.push(ear, eye);
      }
      g.add(body, head);
      this.head = head;
      for (const side of [-1, 1]) {
        const wing = new THREE.Group();
        wing.position.set(side * 0.12, 0.04, 0);
        const membrane = box(0.4, 0.02, 0.26, wingColor, sharedMats);
        membrane.position.x = side * 0.18;
        wing.add(membrane);
        g.add(wing);
        this.meshes.push(membrane);
        this.arms.push(wing);
      }
    } else if (this.type === 'frog') {
      const green = 0x4d9b40, dark = 0x28643d, cream = 0xd6de8e;
      const body = box(0.45, 0.29, 0.48, green, sharedMats);
      body.position.set(0, 0.22, -0.05);
      const throat = box(0.32, 0.17, 0.25, cream, sharedMats);
      throat.position.set(0, 0.17, 0.26);
      g.add(body, throat);
      this.meshes.push(body, throat);
      const head = new THREE.Group();
      head.position.set(0, 0.29, 0.24);
      const face = box(0.4, 0.24, 0.29, green, sharedMats);
      head.add(face);
      this.meshes.push(face);
      for (const side of [-1, 1]) {
        const eye = box(0.14, 0.18, 0.15, green, sharedMats);
        eye.position.set(side * 0.14, 0.16, 0.03);
        const pupil = box(0.064, 0.065, 0.025, 0x101b12, sharedMats);
        pupil.position.set(side * 0.14, 0.19, 0.118);
        head.add(eye, pupil);
        this.meshes.push(eye, pupil);
      }
      const tongue = box(0.065, 0.04, 0.6, 0xed797c, sharedMats);
      tongue.position.set(0, -0.085, 0.4);
      tongue.visible = false;
      head.add(tongue);
      this.meshes.push(tongue);
      this.tongueMesh = tongue;
      g.add(head);
      this.head = head;
      for (const side of [-1, 1]) {
        this.addLeg(side * 0.19, 0.14, -0.16, 0.16, 0.18, 0.21, dark, this.legs);
        this.addLeg(side * 0.18, 0.1, 0.21, 0.1, 0.13, 0.17, green, this.legs);
      }
    } else if (this.type === 'midge') {
      // Simple two-wing insect: a lightweight prey object, no item or XP farm.
      const thorax = box(0.1, 0.11, 0.14, 0x525038, sharedMats);
      const head = new THREE.Group();
      head.position.set(0, 0.05, 0.13);
      const face = box(0.08, 0.08, 0.08, 0xe6c869, sharedMats);
      head.add(face);
      g.add(thorax, head);
      this.meshes.push(thorax, face);
      this.head = head;
      for (const side of [-1, 1]) {
        const wing = this.addLeg(side * 0.04, 0.08, 0, 0.22, 0.02, 0.14, 0xddeaf1, this.arms);
        wing.rotation.z = side * -0.3;
      }
    } else if (this.type === 'fox') {
      // Narrow red-orange body, dark paws, white chest and broad light-tipped
      // tail stay legible in the low-detail render preset.
      const fur = 0xbd572c, dark = 0x342621, pale = 0xf4e7d0;
      const torso = box(0.49, 0.37, 0.77, fur, sharedMats);
      torso.position.set(0, 0.38, -0.07);
      const chest = box(0.36, 0.28, 0.23, pale, sharedMats);
      chest.position.set(0, 0.29, 0.31);
      const tail = box(0.32, 0.29, 0.56, fur, sharedMats);
      tail.position.set(0, 0.41, -0.64);
      tail.rotation.x = -0.22;
      const tip = box(0.33, 0.26, 0.17, pale, sharedMats);
      tip.position.set(0, 0.46, -0.92);
      g.add(torso, chest, tail, tip);
      this.meshes.push(torso, chest, tail, tip);
      const head = new THREE.Group();
      head.position.set(0, 0.53, 0.37);
      const face = box(0.4, 0.31, 0.32, fur, sharedMats);
      head.add(face);
      this.meshes.push(face);
      const muzzle = box(0.26, 0.13, 0.22, pale, sharedMats);
      muzzle.position.set(0, -0.1, 0.25);
      const nose = box(0.09, 0.08, 0.06, dark, sharedMats);
      nose.position.set(0, -0.1, 0.38);
      head.add(muzzle, nose);
      this.meshes.push(muzzle, nose);
      for (const side of [-1, 1]) {
        const ear = box(0.12, 0.2, 0.1, dark, sharedMats);
        ear.position.set(side * 0.14, 0.24, -0.05);
        const eye = box(0.07, 0.055, 0.025, 0x161412, sharedMats);
        eye.position.set(side * 0.12, 0.035, 0.175);
        head.add(ear, eye);
        this.meshes.push(ear, eye);
      }
      g.add(head);
      this.head = head;
      for (const z of [-0.32, 0.27]) for (const side of [-1, 1]) {
        this.addLeg(side * 0.18, 0.23, z, 0.12, 0.23, 0.14, dark, this.legs);
      }
    } else if (this.type === 'rabbit') {
      // Small silhouette, large upright ears, bright tail; two hind-leg pivots
      // double as a readable hopping animation on low graphics presets.
      const fur = 0xb4a28a, pale = 0xeadcc5, inner = 0xd58c8a;
      const torso = box(0.38, 0.32, 0.56, fur, sharedMats);
      torso.position.set(0, 0.27, 0);
      const tail = box(0.18, 0.18, 0.18, pale, sharedMats);
      tail.position.set(0, 0.31, -0.36);
      g.add(torso, tail);
      this.meshes.push(torso, tail);
      const head = new THREE.Group();
      head.position.set(0, 0.45, 0.28);
      const face = box(0.32, 0.27, 0.28, fur, sharedMats);
      head.add(face);
      this.meshes.push(face);
      for (const side of [-1, 1]) {
        const ear = box(0.12, 0.38, 0.1, fur, sharedMats);
        ear.position.set(side * 0.105, 0.32, -0.02);
        const lining = box(0.065, 0.28, 0.025, inner, sharedMats);
        lining.position.set(side * 0.105, 0.32, 0.042);
        const eye = box(0.055, 0.055, 0.025, 0x211b19, sharedMats);
        eye.position.set(side * 0.11, 0.02, 0.15);
        head.add(ear, lining, eye);
        this.meshes.push(ear, lining, eye);
      }
      g.add(head);
      this.head = head;
      for (const side of [-1, 1]) {
        this.addLeg(side * 0.13, 0.14, -0.16, 0.16, 0.22, 0.24, fur, this.legs);
        this.addLeg(side * 0.12, 0.12, 0.22, 0.09, 0.18, 0.12, pale, this.legs);
      }
    } else if (this.type === 'chicken') {
      const body = box(0.36, 0.32, 0.48, 0xf4f4f4, sharedMats);
      body.position.set(0, 0.42, 0);
      g.add(body);
      this.meshes.push(body);
      const head = new THREE.Group();
      head.position.set(0, 0.62, 0.28);
      const hm = box(0.22, 0.22, 0.22, 0xf4f4f4, sharedMats);
      head.add(hm);
      this.meshes.push(hm);
      const beak = box(0.1, 0.08, 0.1, 0xf0b429, sharedMats);
      beak.position.set(0, -0.02, 0.14);
      const comb = box(0.06, 0.1, 0.08, 0xd02020, sharedMats);
      comb.position.set(0, 0.14, 0);
      const eyeL = box(0.05, 0.05, 0.02, 0x111111, sharedMats);
      eyeL.position.set(-0.07, 0.02, 0.11);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.07;
      head.add(beak, comb, eyeL, eyeR);
      this.meshes.push(beak, comb, eyeL, eyeR);
      g.add(head);
      this.head = head;
      this.addLeg(-0.08, 0.28, 0.02, 0.06, 0.28, 0.06, 0xf0b429, this.legs);
      this.addLeg(0.08, 0.28, 0.02, 0.06, 0.28, 0.06, 0xf0b429, this.legs);
      const wingL = this.addLeg(-0.2, 0.48, 0, 0.06, 0.22, 0.28, 0xe8e8e8, this.arms);
      const wingR = this.addLeg(0.2, 0.48, 0, 0.06, 0.22, 0.28, 0xe8e8e8, this.arms);
      wingL.rotation.z = 0.35;
      wingR.rotation.z = -0.35;
    } else if (this.type === 'creeper') {
      this.addLeg(-0.16, 0.4, 0.12, 0.18, 0.4, 0.18, 0x1d6b1d, this.legs);
      this.addLeg(0.16, 0.4, 0.12, 0.18, 0.4, 0.18, 0x1d6b1d, this.legs);
      this.addLeg(-0.16, 0.4, -0.12, 0.18, 0.4, 0.18, 0x165816, this.legs);
      this.addLeg(0.16, 0.4, -0.12, 0.18, 0.4, 0.18, 0x165816, this.legs);
      const torso = box(0.5, 0.85, 0.32, 0x3aaa32, sharedMats);
      torso.position.y = 0.85;
      g.add(torso);
      this.meshes.push(torso);
      const head = new THREE.Group();
      head.position.y = 1.5;
      const hm = box(0.5, 0.5, 0.5, 0x46c23c, sharedMats);
      head.add(hm);
      this.meshes.push(hm);
      const eyeL = box(0.1, 0.08, 0.02, 0x111111, sharedMats);
      eyeL.position.set(-0.1, 0.06, 0.26);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.1;
      const mouth = box(0.16, 0.08, 0.02, 0x111111, sharedMats);
      mouth.position.set(0, -0.1, 0.26);
      head.add(eyeL, eyeR, mouth);
      this.meshes.push(eyeL, eyeR, mouth);
      g.add(head);
      this.head = head;
    } else if (this.type === 'zombie') {
      this.addLeg(-0.13, 0.75, 0, 0.25, 0.75, 0.25, 0x3b3f8f, this.legs);
      this.addLeg(0.13, 0.75, 0, 0.25, 0.75, 0.25, 0x3b3f8f, this.legs);
      const torso = box(0.52, 0.72, 0.28, 0x2aa3a3, sharedMats);
      torso.position.y = 1.11;
      g.add(torso);
      this.meshes.push(torso);
      const head = new THREE.Group();
      head.position.y = 1.47 + 0.25;
      const hm = box(0.5, 0.5, 0.5, 0x5d8a44, sharedMats);
      head.add(hm);
      this.meshes.push(hm);
      const eyeL = box(0.1, 0.06, 0.02, 0x111111, sharedMats);
      eyeL.position.set(-0.12, 0.02, 0.26);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.12;
      head.add(eyeL, eyeR);
      g.add(head);
      this.head = head;
      const a1 = this.addLeg(-0.38, 1.42, 0, 0.24, 0.72, 0.24, 0x5d8a44, this.arms);
      const a2 = this.addLeg(0.38, 1.42, 0, 0.24, 0.72, 0.24, 0x5d8a44, this.arms);
      a1.rotation.x = -Math.PI / 2;
      a2.rotation.x = -Math.PI / 2;
    } else if (this.type === 'spider') {
      const shell = 0x2e1f16;
      const dark = 0x3d2a1e;
      const body = box(0.72, 0.42, 0.92, shell, sharedMats);
      body.position.set(0, 0.52, -0.05);
      g.add(body);
      this.meshes.push(body);
      const rear = box(0.5, 0.36, 0.34, dark, sharedMats);
      rear.position.set(0, 0.5, -0.58);
      g.add(rear);
      this.meshes.push(rear);
      const head = new THREE.Group();
      head.position.set(0, 0.52, 0.5);
      const hm = box(0.44, 0.34, 0.34, dark, sharedMats);
      head.add(hm);
      this.meshes.push(hm);
      for (const sx of [-0.12, 0.12]) {
        for (const sy of [0.1, -0.06]) {
          const eye = box(0.07, 0.06, 0.03, 0xd02020, sharedMats);
          eye.position.set(sx, sy, 0.18);
          head.add(eye);
          this.meshes.push(eye);
        }
      }
      g.add(head);
      this.head = head;
      // eight legs, two per corner, splayed outwards
      const legSpots: [number, number, number][] = [
        [-0.34, 0.22, 0.16], [-0.34, 0.22, -0.16], [-0.34, 0.22, -0.44], [-0.34, 0.22, -0.68],
        [0.34, 0.22, 0.16], [0.34, 0.22, -0.16], [0.34, 0.22, -0.44], [0.34, 0.22, -0.68],
      ];
      for (const [lx, ly, lz] of legSpots) {
        const pivot = new THREE.Group();
        pivot.position.set(lx, ly, lz);
        const m = box(0.07, 0.46, 0.07, 0x241a12, sharedMats);
        m.position.set(lx > 0 ? 0.04 : -0.04, -0.23, 0);
        m.rotation.z = lx > 0 ? 0.5 : -0.5;
        pivot.add(m);
        this.meshes.push(m);
        g.add(pivot);
        this.legs.push(pivot);
      }
    } else if (this.type === 'skeleton') {
      const bone = 0xe6e2d4;
      const boneDark = 0xc9c4b2;
      this.addLeg(-0.12, 0.72, 0, 0.2, 0.72, 0.2, boneDark, this.legs);
      this.addLeg(0.12, 0.72, 0, 0.2, 0.72, 0.2, boneDark, this.legs);
      const torso = box(0.44, 0.7, 0.24, bone, sharedMats);
      torso.position.y = 1.07;
      g.add(torso);
      this.meshes.push(torso);
      // ribs
      for (const ry of [0.86, 0.98, 1.1, 1.22]) {
        const rib = box(0.46, 0.04, 0.26, boneDark, sharedMats);
        rib.position.y = ry;
        g.add(rib);
        this.meshes.push(rib);
      }
      const head = new THREE.Group();
      head.position.y = 1.58;
      const hm = box(0.42, 0.42, 0.42, bone, sharedMats);
      head.add(hm);
      this.meshes.push(hm);
      const jaw = box(0.34, 0.08, 0.36, boneDark, sharedMats);
      jaw.position.y = -0.18;
      head.add(jaw);
      this.meshes.push(jaw);
      for (const sx of [-0.1, 0.1]) {
        const eye = box(0.09, 0.07, 0.03, 0x101010, sharedMats);
        eye.position.set(sx, 0.04, 0.22);
        head.add(eye);
        this.meshes.push(eye);
      }
      g.add(head);
      this.head = head;
      const a1 = this.addLeg(-0.3, 1.36, 0.1, 0.16, 0.68, 0.16, bone, this.arms);
      const a2 = this.addLeg(0.3, 1.36, 0.1, 0.16, 0.68, 0.16, bone, this.arms);
      a1.rotation.x = -1.15;
      a2.rotation.x = -1.15;
      // bow held in front
      const bow1 = box(0.05, 0.62, 0.05, 0x7a5230, sharedMats);
      bow1.position.set(0.34, 1.0, 0.3);
      bow1.rotation.z = 0.35;
      const bow2 = box(0.05, 0.62, 0.05, 0x7a5230, sharedMats);
      bow2.position.set(0.5, 1.0, 0.3);
      bow2.rotation.z = -0.35;
      const string = box(0.03, 0.6, 0.03, 0xdedad2, sharedMats);
      string.position.set(0.42, 1.0, 0.3);
      g.add(bow1, bow2, string);
      this.meshes.push(bow1, bow2, string);
    } else if (this.type === 'wolf') {
      const fur = 0x7a8089;
      const furDk = 0x5d626b;
      const light = 0xd8dade;
      const legH = 0.42;
      const body = box(0.55, 0.48, 1.05, fur, sharedMats);
      body.position.set(0, legH + 0.24, 0);
      g.add(body);
      this.meshes.push(body);
      const chest = box(0.5, 0.34, 0.4, light, sharedMats);
      chest.position.set(0, legH + 0.2, 0.42);
      g.add(chest);
      this.meshes.push(chest);
      const tail = box(0.14, 0.14, 0.42, furDk, sharedMats);
      tail.position.set(0, legH + 0.34, -0.62);
      tail.rotation.x = 0.5;
      g.add(tail);
      this.meshes.push(tail);
      const head = new THREE.Group();
      head.position.set(0, legH + 0.52, 0.66);
      const hm = box(0.4, 0.38, 0.4, fur, sharedMats);
      head.add(hm);
      this.meshes.push(hm);
      const muzzle = box(0.2, 0.18, 0.22, light, sharedMats);
      muzzle.position.set(0, -0.06, 0.28);
      head.add(muzzle);
      this.meshes.push(muzzle);
      const nose = box(0.1, 0.1, 0.06, 0x1a1a1a, sharedMats);
      nose.position.set(0, -0.04, 0.4);
      head.add(nose);
      this.meshes.push(nose);
      const earL = box(0.12, 0.16, 0.08, furDk, sharedMats);
      earL.position.set(-0.12, 0.24, -0.05);
      const earR = earL.clone();
      earR.position.x = 0.12;
      head.add(earL, earR);
      this.meshes.push(earL, earR);
      const eyeL = box(0.07, 0.07, 0.02, 0x111111, sharedMats);
      eyeL.position.set(-0.11, 0.06, 0.21);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.11;
      head.add(eyeL, eyeR);
      this.meshes.push(eyeL, eyeR);
      g.add(head);
      this.head = head;
      this.addLeg(-0.16, legH, 0.32, 0.16, legH, 0.16, furDk, this.legs);
      this.addLeg(0.16, legH, 0.32, 0.16, legH, 0.16, furDk, this.legs);
      this.addLeg(-0.16, legH, -0.32, 0.16, legH, 0.16, fur, this.legs);
      this.addLeg(0.16, legH, -0.32, 0.16, legH, 0.16, fur, this.legs);
    } else if (this.type === 'villager') {
      // Mieszkaniec: długa szata w kolorze zawodu, duży nos, złożone ręce.
      const robe = parseInt(PROFESSIONS[this.profession]?.color.slice(1) ?? '4f8a3a', 16);
      const skin = 0xa8785a;
      const skinDk = 0x8a5f45;
      const legH = 0.45;
      const body = box(0.62, 0.92, 0.36, robe, sharedMats);
      body.position.set(0, legH + 0.46, 0);
      g.add(body);
      this.meshes.push(body);
      const apron = box(0.3, 0.62, 0.04, 0xf0e6d2, sharedMats);
      apron.position.set(0, legH + 0.42, 0.19);
      g.add(apron);
      this.meshes.push(apron);
      const head = new THREE.Group();
      head.position.set(0, legH + 1.2, 0);
      const hm = box(0.5, 0.52, 0.5, skin, sharedMats);
      head.add(hm);
      this.meshes.push(hm);
      const nose = box(0.13, 0.2, 0.16, skinDk, sharedMats);
      nose.position.set(0, -0.06, 0.3);
      head.add(nose);
      this.meshes.push(nose);
      const brow = box(0.52, 0.12, 0.52, 0x3a2a1a, sharedMats);
      brow.position.set(0, 0.24, 0);
      head.add(brow);
      this.meshes.push(brow);
      const eyeL = box(0.1, 0.08, 0.02, 0xffffff, sharedMats);
      eyeL.position.set(-0.13, 0.04, 0.26);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.13;
      head.add(eyeL, eyeR);
      this.meshes.push(eyeL, eyeR);
      g.add(head);
      this.head = head;
      // New trades are identifiable even without opening the panel. Kept to
      // two simple boxes per villager so low-graphics mode has no extra atlas.
      const job = PROFESSIONS[this.profession]?.id;
      if (job === 'kartograf' || job === 'rybak' || job === 'ogrodnik') {
        const hatColor = job === 'kartograf' ? 0xe6e0c8 : job === 'rybak' ? 0x194662 : 0xd8ba66;
        const brim = box(0.66, 0.07, 0.66, hatColor, sharedMats);
        brim.position.set(0, 0.31, 0);
        const crown = box(0.42, 0.17, 0.42, hatColor, sharedMats);
        crown.position.set(0, 0.42, 0);
        head.add(brim, crown);
        this.meshes.push(brim, crown);
      }
      // ręce złożone z przodu, jak na bazarze
      const armL = box(0.14, 0.16, 0.44, robe, sharedMats);
      armL.position.set(-0.34, legH + 0.86, 0.18);
      const armR = armL.clone();
      armR.position.x = 0.34;
      const handL = box(0.14, 0.14, 0.14, skin, sharedMats);
      handL.position.set(-0.2, legH + 0.86, 0.34);
      const handR = handL.clone();
      handR.position.x = 0.2;
      g.add(armL, armR, handL, handR);
      this.meshes.push(armL, armR, handL, handR);
      this.arms.push(armL, armR);
      this.addLeg(-0.16, legH + 0.05, 0, 0.2, legH + 0.1, 0.22, 0x3d3d46, this.legs);
      this.addLeg(0.16, legH + 0.05, 0, 0.2, legH + 0.1, 0.22, 0x3d3d46, this.legs);
    } else if (this.type === 'merchant') {
      const coat = 0x85624c, skin = 0xb98c68;
      this.addLeg(-0.16, 0.5, 0, 0.2, 0.94, 0.22, 0x3d3d42, this.legs);
      this.addLeg(0.16, 0.5, 0, 0.2, 0.94, 0.22, 0x3d3d42, this.legs);
      const body = box(0.66, 0.92, 0.4, coat, sharedMats);
      body.position.set(0, 0.96, 0);
      const satchel = box(0.4, 0.34, 0.18, 0x5e3f2f, sharedMats);
      satchel.position.set(0.33, 0.85, 0.22);
      g.add(body, satchel); this.meshes.push(body, satchel);
      const head = new THREE.Group(); head.position.set(0, 1.65, 0);
      const face = box(0.46, 0.45, 0.45, skin, sharedMats);
      const brim = box(0.66, 0.07, 0.66, 0x3b5548, sharedMats);
      brim.position.y = 0.28;
      const hat = box(0.4, 0.22, 0.4, 0x3b5548, sharedMats);
      hat.position.y = 0.4;
      head.add(face, brim, hat); this.meshes.push(face, brim, hat);
      for (const side of [-1, 1]) {
        const eye = box(0.07, 0.06, 0.025, 0x283a34, sharedMats);
        eye.position.set(side * 0.12, 0.07, 0.24);
        head.add(eye); this.meshes.push(eye);
      }
      g.add(head); this.head = head;
      this.addLeg(-0.45, 1.15, 0, 0.16, 0.68, 0.18, coat, this.arms);
      this.addLeg(0.45, 1.15, 0, 0.16, 0.68, 0.18, coat, this.arms);
    } else if (this.type === 'pack_animal') {
      const brown = 0x795b40, pack = 0xa67d4f;
      const body = box(0.73, 0.74, 1.1, brown, sharedMats);
      body.position.set(0, 0.88, 0);
      const neck = box(0.3, 0.66, 0.34, brown, sharedMats);
      neck.position.set(0, 1.18, 0.53);
      const head = box(0.35, 0.33, 0.48, brown, sharedMats);
      head.position.set(0, 1.4, 0.72);
      g.add(body, neck, head); this.meshes.push(body, neck, head);
      for (const side of [-1, 1]) {
        const crate = box(0.3, 0.52, 0.73, pack, sharedMats);
        crate.position.set(side * 0.51, 0.91, -0.04);
        const strap = box(0.33, 0.06, 0.76, 0x493b31, sharedMats);
        strap.position.set(side * 0.51, 1.16, -0.04);
        const eye = box(0.06, 0.065, 0.03, 0x18191a, sharedMats);
        eye.position.set(side * 0.15, 1.46, 0.96);
        g.add(crate, strap, eye); this.meshes.push(crate, strap, eye);
        for (const z of [-0.38, 0.43]) this.addLeg(side * 0.27, 0.33, z, 0.2, 0.65, 0.2, brown, this.legs);
      }
    } else if (this.type === 'guard') {
      const armor = 0x486679, steel = 0x9aaab2, skin = 0xa77b61;
      for (const sx of [-0.16, 0.16]) this.addLeg(sx, 0.5, 0, 0.23, 0.9, 0.25, 0x374758, this.legs);
      const torso = box(0.72, 0.78, 0.42, armor, sharedMats);
      torso.position.set(0, 1.12, 0);
      const breastplate = box(0.46, 0.57, 0.06, steel, sharedMats);
      breastplate.position.set(0, 1.12, 0.24);
      g.add(torso, breastplate); this.meshes.push(torso, breastplate);
      const head = new THREE.Group();
      head.position.set(0, 1.65, 0);
      const face = box(0.42, 0.37, 0.42, skin, sharedMats);
      const helmet = box(0.53, 0.17, 0.53, steel, sharedMats);
      helmet.position.y = 0.23;
      head.add(face, helmet); this.meshes.push(face, helmet);
      for (const side of [-1, 1]) {
        const eye = box(0.07, 0.06, 0.025, 0x1b282f, sharedMats);
        eye.position.set(side * 0.105, 0.06, 0.23);
        head.add(eye); this.meshes.push(eye);
      }
      g.add(head); this.head = head;
      this.addLeg(-0.47, 1.17, 0, 0.18, 0.68, 0.2, armor, this.arms);
      this.addLeg(0.47, 1.17, 0, 0.18, 0.68, 0.2, armor, this.arms);
      const shield = box(0.12, 0.7, 0.45, steel, sharedMats);
      shield.position.set(-0.58, 0.95, 0.29);
      const sword = box(0.07, 0.74, 0.08, steel, sharedMats);
      sword.position.set(0.58, 0.96, 0.4);
      g.add(shield, sword); this.meshes.push(shield, sword);
    } else if (this.type === 'golem') {
      // Żelazny golem: masywny tors, długie ręce, mosiężne oczy i pnącza.
      const iron = 0xc9c9cd;
      const ironDk = 0x9d9da3;
      const legH = 0.9;
      const torso = box(0.95, 0.9, 0.62, iron, sharedMats);
      torso.position.set(0, legH + 0.45, 0);
      g.add(torso);
      this.meshes.push(torso);
      const vine = box(0.98, 0.24, 0.66, 0x4a7a3a, sharedMats);
      vine.position.set(0, legH + 0.62, 0);
      g.add(vine);
      this.meshes.push(vine);
      const head = new THREE.Group();
      head.position.set(0, legH + 1.12, 0);
      const hm = box(0.6, 0.55, 0.6, iron, sharedMats);
      head.add(hm);
      this.meshes.push(hm);
      const jaw = box(0.32, 0.16, 0.18, ironDk, sharedMats);
      jaw.position.set(0, -0.18, 0.3);
      head.add(jaw);
      this.meshes.push(jaw);
      const eyeL = box(0.12, 0.08, 0.03, 0x7a3a20, sharedMats);
      eyeL.position.set(-0.15, 0.04, 0.3);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.15;
      head.add(eyeL, eyeR);
      this.meshes.push(eyeL, eyeR);
      g.add(head);
      this.head = head;
      this.addLeg(-0.26, legH, 0, 0.3, legH, 0.34, ironDk, this.legs);
      this.addLeg(0.26, legH, 0, 0.3, legH, 0.34, ironDk, this.legs);
      // opuszczone, długie ramiona
      const armL = new THREE.Group();
      armL.position.set(-0.62, legH + 0.82, 0);
      const am = box(0.28, 1.1, 0.3, iron, sharedMats);
      am.position.y = -0.55;
      armL.add(am);
      this.meshes.push(am);
      const armR = armL.clone();
      armR.position.x = 0.62;
      g.add(armL, armR);
      this.arms.push(armL, armR);
    } else if (this.type === 'enderman') {
      const black = 0x111111;
      const eye = 0xaa00ff;
      this.addLeg(-0.14, 1.4, 0, 0.18, 1.4, 0.18, black, this.legs);
      this.addLeg(0.14, 1.4, 0, 0.18, 1.4, 0.18, black, this.legs);
      const torso = box(0.5, 0.9, 0.28, black, sharedMats);
      torso.position.y = 1.85;
      g.add(torso);
      this.meshes.push(torso);
      const head = new THREE.Group();
      head.position.y = 2.5;
      const hm = box(0.5, 0.5, 0.5, black, sharedMats);
      head.add(hm);
      this.meshes.push(hm);
      const eL = box(0.1, 0.08, 0.02, eye, sharedMats);
      eL.position.set(-0.12, 0.04, 0.26);
      const eR = eL.clone();
      eR.position.x = 0.12;
      head.add(eL, eR);
      this.meshes.push(eL, eR);
      g.add(head);
      this.head = head;
      const a1 = this.addLeg(-0.38, 2.2, 0, 0.14, 1.1, 0.14, black, this.arms);
      const a2 = this.addLeg(0.38, 2.2, 0, 0.14, 1.1, 0.14, black, this.arms);
      a1.rotation.x = -0.2;
      a2.rotation.x = -0.2;
    } else if (this.type === 'slime') {
      const green = 0x5ad65a;
      const body = box(0.9, 0.9, 0.9, green, sharedMats);
      body.position.y = 0.5;
      // transparent look via opacity handled in material clone later
      g.add(body);
      this.meshes.push(body);
      this.head = body as any;
      // eyes
      const eyeL = box(0.12, 0.12, 0.02, 0x111111, sharedMats);
      eyeL.position.set(-0.18, 0.6, 0.46);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.18;
      g.add(eyeL, eyeR);
      this.meshes.push(eyeL, eyeR);
    } else if (this.type === 'ghast') {
      const white = 0xf0f0f0;
      const body = box(2.0, 2.0, 2.0, white, sharedMats);
      body.position.y = 3;
      g.add(body);
      this.meshes.push(body);
      this.head = body as any;
      // tentacles
      for (let i = 0; i < 6; i++) {
        const tx = (i - 2.5) * 0.35;
        const tent = box(0.2, 0.9, 0.2, white, sharedMats);
        tent.position.set(tx, 1.8, 0);
        g.add(tent);
        this.meshes.push(tent);
        this.legs.push(tent as any);
      }
      const eyeL = box(0.2, 0.2, 0.05, 0x111111, sharedMats);
      eyeL.position.set(-0.4, 3.2, 1.02);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.4;
      g.add(eyeL, eyeR);
      this.meshes.push(eyeL, eyeR);
    }
    if (this.type === 'echolurker' || this.type === 'zombie' || this.type === 'spider' ||
        this.type === 'enderman' || this.type === 'slime' ||
        this.type === 'skeleton' || this.type === 'ghast') {
      // Bright, world-space warning above the silhouette: no particles, shader
      // or high-resolution texture required on low graphics / small displays.
      const warning = box(0.68, 0.12, 0.14, 0xffa33b, sharedMats);
      warning.position.set(0, this.body.h + 0.22, 0);
      warning.visible = false;
      g.add(warning); this.meshes.push(warning);
      this.strikeWarning = warning;
    }
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        // clone material per mob so we can tint on hurt
        const mesh = o as THREE.Mesh;
        mesh.material = (mesh.material as THREE.MeshLambertMaterial).clone();
      }
    });
    if (this.type === 'lizard') {
      this.lizardSkin = this.meshes[0].material as THREE.MeshLambertMaterial;
      this.lizardFace = this.meshes[3].material as THREE.MeshLambertMaterial;
    }
  }

  setTint(red: boolean) {
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) (mesh.material as THREE.MeshLambertMaterial).emissive.setHex(red ? 0x770000 : 0x000000);
    });
  }

  setFlash(on: boolean) {
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) (mesh.material as THREE.MeshLambertMaterial).emissive.setHex(on ? 0xaaaaaa : 0x000000);
    });
  }

  private cancelStrike(): void {
    if (this.strikeWindup > 0) this.attackCooldown = Math.max(this.attackCooldown, 0.35);
    this.strikeWindup = 0;
    if (this.strikeWarning) this.strikeWarning.visible = false;
  }

  /** A melee cue must finish before damage is dealt. Leaving reach, turning
   * peaceful or striking the creature interrupts it instead of a phantom hit. */
  private telegraphStrike(dt: number, inReach: boolean, damage: number, cooldown: number | (() => number),
    onAttack: (dmg: number, mob: Mob) => void): boolean {
    if (!inReach) { this.cancelStrike(); return false; }
    if (this.strikeWindup > 0) {
      this.strikeWindup -= dt;
      if (this.strikeWindup <= 0) {
        this.strikeWindup = 0;
        if (this.strikeWarning) this.strikeWarning.visible = false;
        this.attackCooldown = typeof cooldown === 'function' ? cooldown() : cooldown;
        onAttack(damage, this);
        if (this.type === 'enderman' && Math.random() < 0.3) {
          this.body.pos.x += (Math.random() - 0.5) * 8;
          this.body.pos.z += (Math.random() - 0.5) * 8;
        }
        if (this.type === 'slime') this.body.vel.y = 6;
      }
      return true;
    }
    if (this.attackCooldown > 0) return false;
    this.strikeWindup = 0.55;
    if (this.strikeWarning) this.strikeWarning.visible = true;
    this.soundTimer = Math.min(this.soundTimer, 0.1);
    return true;
  }

  damage(amount: number, fromX: number, fromZ: number) {
    if (this.dead || this.hurtTime > 0) return false;
    this.health -= amount;
    this.cancelStrike();
    this.hurtTime = 0.5;
    const dx = this.body.pos.x - fromX, dz = this.body.pos.z - fromZ;
    const l = Math.hypot(dx, dz) || 1;
    this.body.vel.x = (dx / l) * 7;
    this.body.vel.z = (dz / l) * 7;
    this.body.vel.y = 6;
    this.setTint(true);
    if (this.health <= 0) {
      this.dead = true;
      this.deathTime = 0;
      this.fuse = -1;
    }
    if (this.type !== 'zombie' && !this.tamed) {
      // panic
      this.aiTimer = 3;
      this.walking = true;
      this.yaw = Math.atan2(dx, dz);
      if (this.type === 'villager') this.panic = 4;
    }
    return true;
  }

  /**
   * Tamed wolf AI: follow the player, stand by when close, and attack the
   * nearest hostile mob on the player's behalf.
   */
  /** Najbliższy wrogi mob w zasięgu (wspólne dla mieszkańców i golemów). */
  private nearestHostile(allies: Mob[], maxDist: number, from: THREE.Vector3 = this.body.pos): Mob | null {
    let best: Mob | null = null;
    let bestD = maxDist;
    for (const o of allies) {
      if (o === this || o.dead || !isHostileMob(o.type)) continue;
      const d = o.body.pos.distanceTo(from);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  /**
   * Mieszkaniec: krąży wokół domu, a gdy w pobliżu pojawi się potwór – ucieka
   * i woła (dźwięk odtwarza silnik przez soundTimer).
   */
  private updateVillager(dt: number, world: World, player: THREE.Vector3, allies: Mob[], dayPhase: number): void {
    const b = this.body;
    // Świeżo uderzony mieszkaniec po prostu zwiewa (yaw ustawia damage()).
    if (this.panic > 0) {
      this.panic -= dt;
      this.yaw += (Math.random() - 0.5) * 0.25;
      this.walking = true;
      this.moveAndAnimate(dt, world, player, 3.2);
      return;
    }
    const threat = this.nearestHostile(allies, 9);
    if (threat) {
      const dx = b.pos.x - threat.body.pos.x;
      const dz = b.pos.z - threat.body.pos.z;
      this.yaw = Math.atan2(dx, dz);
      this.walking = true;
      this.soundTimer = Math.min(this.soundTimer, 0.2);
      this.moveAndAnimate(dt, world, player, 3.2);
      return;
    }
    if (this.hurtTime <= 0 && this.health < this.maxHealth) this.health = Math.min(this.maxHealth, this.health + dt * 0.35);
    const activity = villagerActivity(dayPhase);
    this.activityTimer -= dt;
    if (activity !== this.activityKind || this.activityTimer <= 0) {
      this.activityKind = activity;
      this.activityTimer = 4 + Math.random() * 2;
      this.activityGoal = null;
      if (activity === 'work') this.activityGoal = villagerWorkSpot(world, Math.floor(b.pos.x), Math.floor(b.pos.y), Math.floor(b.pos.z), this.profession);
      if (activity === 'meet') {
        const other = allies.find((o) => o !== this && o.type === 'villager' && !o.dead &&
          Math.abs(o.body.pos.y - b.pos.y) < 1.5 && o.body.pos.distanceTo(b.pos) < 10 &&
          villagerWalkable(world, b.pos.x, Math.floor(b.pos.y), b.pos.z, o.body.pos.x, o.body.pos.z));
        if (other) this.activityGoal = { x: other.body.pos.x, z: other.body.pos.z };
      }
      if (activity === 'rest' && villagerWalkable(world, b.pos.x, Math.floor(b.pos.y), b.pos.z, this.home.x, this.home.z)) {
        this.activityGoal = { x: this.home.x, z: this.home.z };
      }
    }
    if (this.activityGoal) {
      const dx = this.activityGoal.x - b.pos.x, dz = this.activityGoal.z - b.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 12 || !villagerWalkable(world, b.pos.x, Math.floor(b.pos.y), b.pos.z, this.activityGoal.x, this.activityGoal.z)) {
        this.activityGoal = null;
      } else {
        this.yaw = Math.atan2(dx, dz);
        this.walking = dist > (activity === 'meet' ? 2.1 : 0.9);
        this.moveAndAnimate(dt, world, player, this.walking ? (activity === 'rest' ? 1.2 : 1.35) : 0);
        return;
      }
    }
    if (activity === 'rest') {
      this.walking = false;
      this.moveAndAnimate(dt, world, player, 0);
      return;
    }
    this.aiTimer -= dt;
    const dx = this.home.x - b.pos.x;
    const dz = this.home.z - b.pos.z;
    const dist = Math.hypot(dx, dz);
    if (this.aiTimer <= 0) {
      this.aiTimer = 1.6 + Math.random() * 4;
      if (dist > 14 || Math.random() < 0.3) this.yaw = Math.atan2(dx, dz) + (Math.random() - 0.5) * 0.9;
      else this.yaw = Math.random() * Math.PI * 2;
      this.walking = Math.random() < 0.7;
    }
    this.moveAndAnimate(dt, world, player, this.walking ? 1.35 : 0);
  }

  /** Follows existing village roads without forcing chunk generation. */
  private updateMerchant(dt: number, world: World, player: THREE.Vector3): void {
    const b = this.body;
    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.aiTimer = 2 + Math.random() * 2;
      const y = Math.floor(b.pos.y) - 1;
      // Merchants follow existing trails, not arbitrary desert or ungenerated
      // chunks. The bounded 5x5 search stays cheap on mobile devices.
      let best: { x: number; z: number } | null = null;
      let distance = -1;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        const x = Math.floor(b.pos.x) + dx, z = Math.floor(b.pos.z) + dz;
        if (!world.hasChunk(Math.floor(x / CS), Math.floor(z / CS)) ||
          world.peekBlock(x, y, z) !== B.PATH || IS_SOLID[world.peekBlock(x, y + 1, z)] ||
          IS_SOLID[world.peekBlock(x, y + 2, z)] ||
          !villagerWalkable(world, b.pos.x, y + 1, b.pos.z, x + 0.5, z + 0.5)) continue;
        const d = Math.hypot(dx, dz);
        if (d > distance && d <= 2.7 && d > 0.8 && Math.random() > 0.25) { distance = d; best = { x: x + 0.5, z: z + 0.5 }; }
      }
      this.activityGoal = best && b.pos.distanceTo(this.home) < 18 ? best
        : b.pos.distanceTo(this.home) > 4 ? { x: this.home.x, z: this.home.z } : null;
    }
    if (this.activityGoal) {
      const dx = this.activityGoal.x - b.pos.x, dz = this.activityGoal.z - b.pos.z;
      this.yaw = Math.atan2(dx, dz);
      this.walking = Math.hypot(dx, dz) > 0.55;
      if (!this.walking) this.aiTimer = 0;
    } else this.walking = false;
    if (b.pos.distanceTo(player) < 2.2) this.walking = false;
    this.moveAndAnimate(dt, world, player, this.walking ? 1.15 : 0);
  }

  private updatePackAnimal(dt: number, world: World, player: THREE.Vector3, allies: Mob[]): void {
    const b = this.body;
    const merchant = allies.find((m) => m.type === 'merchant' && !m.dead && m.body.pos.distanceTo(b.pos) < 22);
    if (merchant) {
      const dx = merchant.body.pos.x - b.pos.x, dz = merchant.body.pos.z - b.pos.z;
      this.yaw = Math.atan2(dx, dz);
      this.walking = Math.hypot(dx, dz) > 2.1;
    } else {
      this.walking = false;
    }
    this.moveToward(dt, world, player, this.walking ? 1.55 : 0, merchant?.body.pos.x ?? b.pos.x, merchant?.body.pos.z ?? b.pos.z);
  }

  /** Armed human guard prioritises monsters near residents. */
  private updateGuard(dt: number, world: World, player: THREE.Vector3, allies: Mob[],
    onAttack: (dmg: number, mob: Mob) => void, peaceful: boolean): void {
    const b = this.body;
    this.provoked = Math.max(0, this.provoked - dt);
    const playerDist = b.pos.distanceTo(player);
    if (!peaceful && this.provoked > 0 && playerDist < 16) {
      this.yaw = Math.atan2(player.x - b.pos.x, player.z - b.pos.z);
      this.walking = playerDist > 1.8;
      if (!this.walking && this.attackCooldown <= 0) {
        this.attackCooldown = 1.5;
        onAttack(4, this);
      }
      this.moveToward(dt, world, player, this.walking ? 2.65 : 0, player.x, player.z);
      return;
    }
    let threat: Mob | null = null;
    let best = 18;
    for (const o of allies) {
      if (o.dead || !isHostileMob(o.type)) continue;
      const distance = o.body.pos.distanceTo(b.pos);
      if (distance >= best) continue;
      if (distance >= 12 && !allies.some((v) => v.type === 'villager' && !v.dead &&
        v.body.pos.distanceTo(b.pos) < 18 && v.body.pos.distanceTo(o.body.pos) < 7)) continue;
      best = distance; threat = o;
    }
    if (threat && !peaceful) {
      const dx = threat.body.pos.x - b.pos.x, dz = threat.body.pos.z - b.pos.z;
      const dist = Math.hypot(dx, dz);
      this.yaw = Math.atan2(dx, dz);
      this.walking = dist > 1.35;
      if (!this.walking && this.attackCooldown <= 0) {
        this.attackCooldown = 1.25;
        if (threat.damage(5, b.pos.x, b.pos.z)) {
          threat.body.vel.x *= 1.25;
          threat.body.vel.z *= 1.25;
        }
      }
      this.moveToward(dt, world, player, this.walking ? 2.55 : 0, threat.body.pos.x, threat.body.pos.z);
      return;
    }
    this.aiTimer -= dt;
    const hx = this.home.x - b.pos.x, hz = this.home.z - b.pos.z;
    if (this.aiTimer <= 0) {
      this.aiTimer = 2 + Math.random() * 3;
      this.yaw = Math.hypot(hx, hz) > 13 ? Math.atan2(hx, hz) : Math.random() * Math.PI * 2;
      this.walking = Math.hypot(hx, hz) > 13 || Math.random() < 0.65;
    }
    this.moveAndAnimate(dt, world, player, this.walking ? 1.35 : 0);
  }

  /** Pursues the *last heard position*, not the player's live coordinates.
   * Thrown items override old footsteps, but ordinary loot makes no sound. */
  private updateEcholurker(dt: number, world: World, player: THREE.Vector3,
    onAttack: (dmg: number, mob: Mob) => void, peaceful: boolean, noises: readonly CaveNoise[]): void {
    if (peaceful) { this.heardGoal = null; this.heardTime = 0; }
    else {
      // Only loaded cave sounds at roughly the same height can be heard.
      // Newest reachable cue wins; the list is capped by the engine.
      for (const noise of noises) {
        if (noise.id <= this.heardId || noise.ttl <= 0 ||
          Math.abs(noise.y - this.body.pos.y) > 5 ||
          Math.hypot(noise.x - this.body.pos.x, noise.z - this.body.pos.z) > noise.radius) continue;
        this.heardId = noise.id;
        this.heardGoal = { x: noise.x, y: noise.y, z: noise.z, source: noise.source };
        this.heardTime = 4;
        this.soundTimer = Math.min(this.soundTimer, 0.15);
      }
      this.heardTime = Math.max(0, this.heardTime - dt);
    }
    const goal = this.heardTime > 0 ? this.heardGoal : null;
    if (!goal) {
      this.cancelStrike();
      this.walking = false;
      this.moveAndAnimate(dt, world, player, 0);
      return;
    }
    const dx = goal.x - this.body.pos.x, dz = goal.z - this.body.pos.z;
    const distance = Math.hypot(dx, dz);
    this.yaw = Math.atan2(dx, dz);
    this.walking = distance > 0.6;
    // A decoy draws it to the impact, never licenses a player attack.
    // A quiet player who moves away from the heard spot remains safe.
    const threatening = goal.source === 'player' && !peaceful && distance < 1.75 &&
      Math.hypot(player.x - this.body.pos.x, player.z - this.body.pos.z) < 1.65 &&
      Math.abs(player.y - this.body.pos.y) < 2;
    if (this.telegraphStrike(dt, threatening, 4, 1.6, onAttack)) this.walking = false;
    this.moveToward(dt, world, player, this.walking ? 2.05 : 0, goal.x, goal.z);
    if (distance < 0.6 && goal.source === 'decoy') this.heardTime = Math.min(this.heardTime, 0.7);
  }

  /** Iron golem keeps its older independent patrol and heavy defence. */
  private updateGolem(dt: number, world: World, player: THREE.Vector3, allies: Mob[], onAttack: (dmg: number, mob: Mob) => void): void {
    const b = this.body;
    if (this.provoked > 0) this.provoked = Math.max(0, this.provoked - dt);

    const playerDist = Math.hypot(player.x - b.pos.x, player.z - b.pos.z);
    if (this.provoked > 0 && playerDist < 20) {
      this.yaw = Math.atan2(player.x - b.pos.x, player.z - b.pos.z);
      this.walking = playerDist > 1.9;
      if (playerDist < 2.4 && this.attackCooldown <= 0) {
        this.attackCooldown = 1.5;
        onAttack(6, this);
      }
      this.moveToward(dt, world, player, this.walking ? 3.3 : 0, player.x, player.z);
      return;
    }

    const target = this.nearestHostile(allies, 22);
    if (target) {
      const dx = target.body.pos.x - b.pos.x;
      const dz = target.body.pos.z - b.pos.z;
      const d = Math.hypot(dx, dz);
      this.yaw = Math.atan2(dx, dz);
      const stop = target.body.w / 2 + 0.9;
      this.walking = d > stop;
      if (d <= stop + 0.7 && this.attackCooldown <= 0) {
        this.attackCooldown = 1.35;
        if (target.damage(7, b.pos.x, b.pos.z)) {
          // ciężki cios odrzuca cel
          target.body.vel.x *= 1.7;
          target.body.vel.z *= 1.7;
          target.body.vel.y = Math.max(target.body.vel.y, 6);
        }
      }
      this.moveToward(dt, world, player, this.walking ? 3.3 : 0, target.body.pos.x, target.body.pos.z);
      return;
    }

    this.aiTimer -= dt;
    const hx = this.home.x - b.pos.x;
    const hz = this.home.z - b.pos.z;
    if (this.aiTimer <= 0) {
      this.aiTimer = 2 + Math.random() * 5;
      if (Math.hypot(hx, hz) > 18 || Math.random() < 0.4) this.yaw = Math.atan2(hx, hz) + (Math.random() - 0.5) * 1.2;
      else this.yaw = Math.random() * Math.PI * 2;
      this.walking = Math.random() < 0.55;
    }
    this.moveAndAnimate(dt, world, player, this.walking ? 1.6 : 0);
    if (this.hurtTime <= 0 && this.health < this.maxHealth) this.health = Math.min(this.maxHealth, this.health + dt * 0.2);
  }

  private updateTamed(dt: number, world: World, player: THREE.Vector3, allies: Mob[], onBite: (mob: Mob) => void): void {
    const b = this.body;
    // pick a target: hostile, within 16 of the wolf, within 24 of the player
    let target: Mob | null = null;
    let best = 16;
    for (const o of allies) {
      if (o === this || o.dead || !isHostileMob(o.type)) continue;
      if (o.body.pos.distanceTo(player) > 24) continue;
      const d = o.body.pos.distanceTo(b.pos);
      if (d < best) { best = d; target = o; }
    }
    if (target) {
      const dx = target.body.pos.x - b.pos.x, dz = target.body.pos.z - b.pos.z;
      this.yaw = Math.atan2(dx, dz);
      const stop = target.body.w / 2 + 0.7;
      if (best <= stop) {
        this.walking = false;
        if (this.attackCooldown <= 0) {
          this.attackCooldown = 1.1;
          onBite(target);
        }
      } else {
        this.walking = true;
      }
    } else {
      // Loyal pet: stay at the player's feet; only a short, occasional stroll
      // when right next to them.
      const dx = player.x - b.pos.x, dz = player.z - b.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 1.6) {
        this.yaw = Math.atan2(dx, dz);
        this.walking = true;
      } else {
        this.walking = false; // sit at the player's feet
        this.aiTimer -= dt;
        if (this.aiTimer <= 0) {
          this.aiTimer = 2 + Math.random() * 4;
          this.walking = Math.random() < 0.3;
          this.yaw = Math.random() * Math.PI * 2;
        }
      }
      if (this.hurtTime <= 0) this.health = Math.min(this.maxHealth, this.health + dt * 0.5);
    }
    this.moveToward(dt, world, player, this.walking ? 4.6 : 0, target?.body.pos.x ?? player.x, target?.body.pos.z ?? player.z);
  }

  /** Removes a sheep's wool once. Returns false if it was already sheared or isn't a sheep. */
  shear(): boolean {
    if (this.type !== 'sheep' || this.dead || this.sheared) return false;
    this.sheared = true;
    if (this.woolMesh) this.woolMesh.material = new THREE.MeshLambertMaterial({ color: 0xd8c8b0 });
    return true;
  }

  /** Swap an opaque, per-animal skin tone when the ground changes. The dorsal
   * stripe and pale eyes remain high contrast on both colors. */
  private updateLizard(dt: number, world: World, player: THREE.Vector3): void {
    const b = this.body;
    const ground = b.onGround ? world.peekBlock(Math.floor(b.pos.x), Math.floor(b.pos.y - 0.25), Math.floor(b.pos.z)) : this.camouflageGround;
    if (ground !== this.camouflageGround) {
      this.camouflageGround = ground;
      const color = ground === B.MUD || ground === B.DIRT ? 0x907a5b : 0x4a8255;
      this.lizardSkin?.color.setHex(color);
      this.lizardFace?.color.setHex(color);
    }
    const dx = b.pos.x - player.x, dz = b.pos.z - player.z;
    const threatened = Math.hypot(dx, dz) < 5 && Math.abs(b.pos.y - player.y) < 3;
    this.aiTimer -= dt;
    if (threatened) {
      this.yaw = Math.atan2(dx, dz);
      this.walking = true;
    } else if (this.aiTimer <= 0) {
      this.aiTimer = 2 + Math.random() * 3;
      const hx = this.home.x - b.pos.x, hz = this.home.z - b.pos.z;
      this.yaw = Math.hypot(hx, hz) > 7 ? Math.atan2(hx, hz) : Math.random() * Math.PI * 2;
      this.walking = Math.random() < 0.45;
    }
    this.moveAndAnimate(dt, world, player, this.walking ? threatened ? 2.7 : 0.9 : 0);
  }

  /** Nocturnal flight stays within a short loaded neighborhood. During the
   * day bats descend onto solid ground and fold their wings to rest. */
  private updateBat(dt: number, world: World, daylight: number): void {
    const b = this.body;
    const awake = daylight < 0.5;
    this.aiTimer -= dt;
    this.walkPhase += dt * (awake ? 4.5 : 0.8);
    if (awake) {
      if (this.aiTimer <= 0) {
        this.aiTimer = 1 + Math.random() * 1.5;
        const dx = this.home.x - b.pos.x, dz = this.home.z - b.pos.z;
        this.yaw = Math.hypot(dx, dz) > 6 ? Math.atan2(dx, dz) : Math.random() * Math.PI * 2;
      }
      const nx = b.pos.x + Math.sin(this.yaw) * dt * 1.5;
      const nz = b.pos.z + Math.cos(this.yaw) * dt * 1.5;
      const goalY = this.home.y + Math.sin(this.walkPhase) * 0.7;
      const ny = b.pos.y + (goalY - b.pos.y) * Math.min(1, dt * 4);
      if (world.peekBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz)) === B.AIR) b.pos.set(nx, ny, nz);
      else { this.yaw += Math.PI / 2; this.aiTimer = 0.3; }
    } else {
      const nearGround = this.home.y - 1.55;
      const targetY = world.peekBlock(Math.floor(this.home.x), Math.floor(nearGround), Math.floor(this.home.z)) === B.AIR
        ? nearGround : this.home.y; // player-built blocks must not swallow resting bats
      const dx = this.home.x - b.pos.x, dz = this.home.z - b.pos.z;
      b.pos.x += dx * Math.min(1, dt * 2);
      b.pos.z += dz * Math.min(1, dt * 2);
      b.pos.y += (targetY - b.pos.y) * Math.min(1, dt * 2);
    }
    for (let i = 0; i < this.arms.length; i++) {
      this.arms[i].rotation.z = (i ? -1 : 1) * (awake ? 0.15 + Math.sin(this.walkPhase * 8) * 0.65 : 1.25);
    }
    this.group.position.copy(b.pos);
    this.group.rotation.y = this.yaw;
  }

  /** Lightweight pond insect: short wandering flights around its spawn point;
   * movement checks only the current block, never generates a distant chunk. */
  private updateMidge(dt: number, world: World): void {
    this.aiTimer -= dt;
    const b = this.body;
    if (this.aiTimer <= 0) {
      this.aiTimer = 0.8 + Math.random() * 1.4;
      const dx = this.home.x - b.pos.x, dz = this.home.z - b.pos.z;
      this.yaw = Math.hypot(dx, dz) > 3 ? Math.atan2(dx, dz) : Math.random() * Math.PI * 2;
    }
    const nx = b.pos.x + Math.sin(this.yaw) * dt * 0.9;
    const nz = b.pos.z + Math.cos(this.yaw) * dt * 0.9;
    const ny = this.home.y + Math.sin(this.walkPhase * 1.6) * 0.23;
    if (world.peekBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz)) === B.AIR) b.pos.set(nx, ny, nz);
    else this.yaw += Math.PI / 2;
    this.walkPhase += dt * 7;
    for (let i = 0; i < this.arms.length; i++) this.arms[i].rotation.z = (i ? 1 : -1) * (0.3 + Math.sin(this.walkPhase * 5) * 0.45);
    this.group.position.copy(b.pos);
    this.group.rotation.y = this.yaw;
  }

  /** Jump toward small pond insects and show a brief tongue lunge. */
  private updateFrog(dt: number, world: World, player: THREE.Vector3, allies: Mob[], raining: boolean): void {
    const b = this.body;
    this.tongueTime = Math.max(0, this.tongueTime - dt);
    if (this.tongueMesh) this.tongueMesh.visible = this.tongueTime > 0;
    let prey: Mob | null = null;
    let distance = 7;
    for (const other of allies) {
      if (other.type !== 'midge' || other.dead) continue;
      const d = b.pos.distanceTo(other.body.pos);
      if (d < distance) { prey = other; distance = d; }
    }
    this.aiTimer -= dt;
    if (prey) {
      this.yaw = Math.atan2(prey.body.pos.x - b.pos.x, prey.body.pos.z - b.pos.z);
      this.walking = distance > 0.6;
      if (distance < 1.25 && this.attackCooldown <= 0) {
        this.attackCooldown = 1.5;
        this.tongueTime = 0.28;
        if (this.tongueMesh) this.tongueMesh.visible = true;
        this.soundTimer = 0.1;
        prey.damage(2, b.pos.x, b.pos.z);
      }
    } else if (this.aiTimer <= 0) {
      this.aiTimer = raining ? 0.7 : 2 + Math.random() * 3;
      this.yaw = Math.random() * Math.PI * 2;
      this.walking = raining || Math.random() < 0.6;
      if (raining) this.soundTimer = Math.min(this.soundTimer, 3);
    }
    if (b.onGround && this.walking && this.attackCooldown <= 0) {
      b.vel.y = 5.6;
      this.attackCooldown = 0.9;
    }
    this.moveAndAnimate(dt, world, player, this.walking ? prey ? 1.7 : 0.9 : 0);
  }

  /** Hunt only small wild animals, or steal one unit from a dropped food
   * stack. Threats always take precedence; foxes do not attack the player. */
  private updateFox(dt: number, world: World, player: THREE.Vector3, allies: Mob[],
    food: readonly FoxFood[], onSnatch: (target: FoxFood) => boolean): void {
    const b = this.body;
    this.foxSnack = Math.max(0, this.foxSnack - dt);
    this.head.rotation.x = this.foxSnack > 0 ? 0.14 + Math.sin(this.foxSnack * 18) * 0.1 : 0;
    this.aiTimer -= dt;
    let threatX = 0, threatZ = 0;
    const pd = Math.hypot(b.pos.x - player.x, b.pos.z - player.z);
    if (pd < 6 && Math.abs(b.pos.y - player.y) < 3) {
      threatX += (b.pos.x - player.x) / Math.max(pd, 0.1);
      threatZ += (b.pos.z - player.z) / Math.max(pd, 0.1);
    }
    for (const other of allies) {
      if (other.dead || other === this || (other.type !== 'wolf' && other.type !== 'golem')) continue;
      const d = b.pos.distanceTo(other.body.pos);
      if (d < 8) {
        threatX += (b.pos.x - other.body.pos.x) / Math.max(d, 0.1);
        threatZ += (b.pos.z - other.body.pos.z) / Math.max(d, 0.1);
      }
    }
    if (threatX !== 0 || threatZ !== 0 || this.hurtTime > 0) {
      if (threatX === 0 && threatZ === 0) {
        threatX = b.pos.x - player.x;
        threatZ = b.pos.z - player.z;
      }
      this.yaw = Math.atan2(threatX, threatZ);
      this.walking = true;
      if (b.onGround && this.attackCooldown <= 0) {
        b.vel.y = 5.5;
        this.attackCooldown = 0.55;
      }
      this.moveAndAnimate(dt, world, player, 4.1);
      return;
    }

    let prey: Mob | null = null;
    let preyDist = 12;
    for (const other of allies) {
      if (other.dead || (other.type !== 'rabbit' && other.type !== 'chicken')) continue;
      const d = b.pos.distanceTo(other.body.pos);
      if (d < preyDist) { prey = other; preyDist = d; }
    }
    if (prey) {
      this.yaw = Math.atan2(prey.body.pos.x - b.pos.x, prey.body.pos.z - b.pos.z);
      this.walking = preyDist > 0.75;
      if (preyDist < 1.1 && this.attackCooldown <= 0) {
        this.attackCooldown = 1.2;
        prey.damage(2, b.pos.x, b.pos.z);
        this.foxSnack = 0.35;
      }
      if (b.onGround && this.walking && this.attackCooldown <= 0) {
        b.vel.y = 4.5;
        this.attackCooldown = 0.6;
      }
      this.moveToward(dt, world, player, this.walking ? 3.2 : 0, prey.body.pos.x, prey.body.pos.z);
      return;
    }

    let snack: FoxFood | null = null;
    let foodDist = 9;
    for (const d of food) {
      if (d.age < 0.75 || d.count <= 0 || !isFood(d.id)) continue;
      const dist = b.pos.distanceTo(d.pos);
      if (dist < foodDist) { snack = d; foodDist = dist; }
    }
    if (snack) {
      this.yaw = Math.atan2(snack.pos.x - b.pos.x, snack.pos.z - b.pos.z);
      this.walking = foodDist > 0.8;
      if (foodDist < 1.15 && this.attackCooldown <= 0 && onSnatch(snack)) {
        this.attackCooldown = 5; // even large stacks cannot be eaten instantly
        this.foxSnack = 1.5;
        this.soundTimer = 0.1;
      }
      this.moveToward(dt, world, player, this.walking ? 2.7 : 0, snack.pos.x, snack.pos.z);
      return;
    }

    if (this.aiTimer <= 0) {
      this.aiTimer = 2 + Math.random() * 4;
      const homeDist = Math.hypot(this.home.x - b.pos.x, this.home.z - b.pos.z);
      this.yaw = homeDist > 18 ? Math.atan2(this.home.x - b.pos.x, this.home.z - b.pos.z) : Math.random() * Math.PI * 2;
      this.walking = homeDist > 18 || Math.random() < 0.55;
    }
    this.moveAndAnimate(dt, world, player, this.walking ? 1.2 : 0);
  }

  /** The orange crest is visible and audible BEFORE the ambusher can deal
   * damage. Running away during the warning cancels the emergence entirely. */
  private updateSandstalker(dt: number, world: World, player: THREE.Vector3,
    onAttack: (dmg: number, mob: Mob) => void, peaceful: boolean): void {
    const b = this.body;
    const dx = player.x - b.pos.x, dz = player.z - b.pos.z;
    const distance = Math.hypot(dx, dz);
    const close = Math.abs(player.y - b.pos.y) < 3;
    if (this.sandBuried) {
      if (peaceful || !close || distance > 10) {
        this.sandTelegraph = 0;
        this.sandWarning!.visible = false;
      } else if (distance < 8 || this.hurtTime > 0 || this.sandTelegraph > 0) {
        if (this.sandTelegraph <= 0) {
          this.sandTelegraph = 1.25;
          this.sandWarning!.visible = true;
          this.soundTimer = 0.1;
        } else {
          this.sandTelegraph -= dt;
          if (this.sandTelegraph <= 0) {
            this.sandBuried = false;
            this.sandBody!.visible = true;
            this.sandMound!.visible = false;
            this.sandWarning!.visible = false;
            this.sandActive = 8;
            b.vel.y = 5.5;
            this.attackCooldown = Math.max(this.attackCooldown, 0.6);
          }
        }
      }
      this.walking = false;
      this.moveAndAnimate(dt, world, player, 0);
      return;
    }
    this.sandActive -= dt;
    const onSand = world.peekBlock(Math.floor(b.pos.x), Math.floor(b.pos.y) - 1, Math.floor(b.pos.z)) === B.SAND;
    if ((peaceful || distance > 14 || this.sandActive <= 0) && b.onGround && onSand) {
      this.sandBuried = true;
      this.sandBody!.visible = false;
      this.sandMound!.visible = true;
      this.sandWarning!.visible = false;
      this.walking = false;
      this.moveAndAnimate(dt, world, player, 0);
      return;
    }
    this.yaw = Math.atan2(dx, dz);
    this.walking = !peaceful && close && distance > 1.3 && distance < 14;
    if (!peaceful && distance < 1.7 && Math.abs(player.y - b.pos.y) < 2 && this.attackCooldown <= 0) {
      onAttack(3, this);
      this.attackCooldown = 1.4;
    }
    this.moveToward(dt, world, player, this.walking ? 2 : 0, player.x, player.z);
  }

  private updateBear(dt: number, world: World, player: THREE.Vector3, allies: Mob[], food: readonly FoxFood[],
    onAttack: (dmg: number, mob: Mob) => void, peaceful: boolean): void {
    const b = this.body;
    const dx = player.x - b.pos.x, dz = player.z - b.pos.z;
    const dist = Math.hypot(dx, dz);
    if (this.isCub) {
      const parent = allies.find((o) => o !== this && o.type === 'bear' && !o.isCub && !o.dead && o.body.pos.distanceTo(b.pos) < 13);
      if (dist < 5 && Math.abs(player.y - b.pos.y) < 3) {
        this.yaw = Math.atan2(-dx, -dz);
        this.walking = true;
      } else if (parent && parent.body.pos.distanceTo(b.pos) > 2.5) {
        this.yaw = Math.atan2(parent.body.pos.x - b.pos.x, parent.body.pos.z - b.pos.z);
        this.walking = true;
      } else this.walking = false;
      this.moveAndAnimate(dt, world, player, this.walking ? 1.55 : 0);
      return;
    }
    const cubThreat = allies.some((o) => o.type === 'bear' && o.isCub && !o.dead &&
      o.body.pos.distanceTo(b.pos) < 9 && o.body.pos.distanceTo(player) < 6);
    const storesThreat = food.some((drop) => drop.age > 0.75 && isFood(drop.id) &&
      drop.pos.distanceTo(b.pos) < 4 && drop.pos.distanceTo(player) < 4);
    if (!peaceful && Math.abs(player.y - b.pos.y) < 3 && dist < 10 && (cubThreat || storesThreat || this.hurtTime > 0)) {
      this.bearAlert = 6;
    } else this.bearAlert = Math.max(0, this.bearAlert - dt);
    this.bearCooldown -= dt;
    if (peaceful || dist > 12) { this.bearAlert = 0; this.bearWindup = 0; }
    if (this.bearWindup > 0) {
      this.bearWindup -= dt;
      this.bearWarning!.visible = this.bearWindup > 0;
      this.walking = false;
      this.yaw = Math.atan2(dx, dz);
      this.moveAndAnimate(dt, world, player, 0);
      if (this.bearWindup <= 0) {
        this.bearWarning!.visible = false;
        this.bearCooldown = 2.3;
        if (!peaceful && dist < 2.5 && Math.abs(player.y - b.pos.y) < 2) onAttack(5, this);
      }
      return;
    }
    this.bearWarning!.visible = false;
    if (this.bearAlert > 0 && !peaceful && dist < 10) {
      this.yaw = Math.atan2(dx, dz);
      this.walking = dist > 2.1;
      if (!this.walking && this.bearCooldown <= 0) {
        this.bearWindup = 0.9;
        this.bearWarning!.visible = true;
        this.soundTimer = Math.min(this.soundTimer, 0.1);
      }
      this.moveToward(dt, world, player, this.walking ? 2.2 : 0, player.x, player.z);
      return;
    }
    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.aiTimer = 2.5 + Math.random() * 4;
      const hx = this.home.x - b.pos.x, hz = this.home.z - b.pos.z;
      this.yaw = Math.hypot(hx, hz) > 9 ? Math.atan2(hx, hz) : Math.random() * Math.PI * 2;
      this.walking = Math.hypot(hx, hz) > 9 || Math.random() < 0.4;
    }
    this.moveAndAnimate(dt, world, player, this.walking ? 0.88 : 0);
  }

  private updateTurtle(dt: number, world: World, player: THREE.Vector3): void {
    const b = this.body;
    this.eggTimer -= dt;
    if (this.eggTimer <= 0) {
      const nest = b.onGround && b.pos.distanceTo(player) > 1.2
        ? findTurtleNest(world, Math.floor(b.pos.x), Math.floor(b.pos.y), Math.floor(b.pos.z)) : null;
      if (nest) {
        world.setBlock(nest.x, nest.y, nest.z, B.TURTLE_EGG0);
        this.eggTimer = 42 + Math.random() * 18;
        this.walking = false;
        this.aiTimer = 2;
        this.soundTimer = 0.15;
      } else this.eggTimer = 3; // retry while near shore; never lay on dirt
    }
    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.aiTimer = 2 + Math.random() * 3;
      this.yaw = Math.random() * Math.PI * 2;
      this.walking = Math.random() < 0.55;
    }
    this.moveAndAnimate(dt, world, player, this.walking ? 0.65 : 0);
  }

  update(
    dt: number,
    world: World,
    player: THREE.Vector3,
    onAttack: (dmg: number, mob: Mob) => void,
    onShoot: (mob: Mob) => void,
    peaceful: boolean,
    allies: Mob[] = [],
    onBite: (mob: Mob) => void = () => {},
    aggressionSpeed = 1,
    food: readonly FoxFood[] = [],
    onSnatch: (target: FoxFood) => boolean = () => false,
    daylight = 1,
    raining = false,
    dayPhase = 0.25,
    noises: readonly CaveNoise[] = []
  ) {
    const b = this.body;
    if (this.hurtTime > 0) {
      this.hurtTime -= dt;
      if (this.hurtTime <= 0 && !this.dead) this.setTint(false);
    }
    if (this.dead) {
      this.deathTime += dt;
      this.group.rotation.z = Math.min(Math.PI / 2, this.deathTime * 6);
      return;
    }
    this.attackCooldown -= dt;
    this.soundTimer -= dt;

    if ((this.type === 'pig' || this.type === 'cow' || this.type === 'sheep' || this.type === 'chicken' ||
      this.type === 'rabbit' || this.type === 'fox' || this.type === 'frog' || this.type === 'lizard' || this.type === 'turtle') && this.hurtTime <= 0) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.nearbyFlame = nearestFire(world, Math.floor(b.pos.x), Math.floor(b.pos.y), Math.floor(b.pos.z));
        this.fireTimer = this.nearbyFlame ? 0.22 : 0.8;
      }
      const flame = this.nearbyFlame;
      if (flame && Math.hypot(b.pos.x - flame.x, b.pos.z - flame.z) < flame.safe &&
        b.pos.distanceTo(player) > 4) {
        const heading = fireEscapeHeading(world, b.pos.x, Math.floor(b.pos.y), b.pos.z, flame.x, flame.z);
        if (heading != null) {
          this.yaw = heading;
          this.walking = true;
          this.moveAndAnimate(dt, world, player, 2.1);
        } else {
          this.walking = false;
          this.moveAndAnimate(dt, world, player, 0);
        }
        return;
      }
    }

    if (this.tamed) {
      this.updateTamed(dt, world, player, allies, onBite);
      return;
    }
    if (this.type === 'villager') {
      this.updateVillager(dt, world, player, allies, dayPhase);
      return;
    }
    if (this.type === 'merchant') {
      this.updateMerchant(dt, world, player);
      return;
    }
    if (this.type === 'pack_animal') {
      this.updatePackAnimal(dt, world, player, allies);
      return;
    }
    if (this.type === 'guard') {
      this.updateGuard(dt, world, player, allies, onAttack, peaceful);
      return;
    }
    if (this.type === 'golem') {
      this.updateGolem(dt, world, player, allies, onAttack);
      return;
    }
    if (this.type === 'echolurker') {
      this.updateEcholurker(dt, world, player, onAttack, peaceful, noises);
      return;
    }
    if (this.type === 'sandstalker') {
      this.updateSandstalker(dt, world, player, onAttack, peaceful);
      return;
    }
    if (this.type === 'bear') {
      this.updateBear(dt, world, player, allies, food, onAttack, peaceful);
      return;
    }
    if (this.type === 'turtle') {
      this.updateTurtle(dt, world, player);
      return;
    }
    if (this.type === 'lizard') {
      this.updateLizard(dt, world, player);
      return;
    }
    if (this.type === 'bat') {
      this.updateBat(dt, world, daylight);
      return;
    }
    if (this.type === 'midge') {
      this.updateMidge(dt, world);
      return;
    }
    if (this.type === 'frog') {
      this.updateFrog(dt, world, player, allies, raining);
      return;
    }
    if (this.type === 'fox') {
      this.updateFox(dt, world, player, allies, food, onSnatch);
      return;
    }
    if (this.type === 'rabbit') {
      const dx = b.pos.x - player.x, dz = b.pos.z - player.z;
      const threatened = Math.hypot(dx, dz) < 7 && Math.abs(b.pos.y - player.y) < 3;
      this.aiTimer -= dt;
      if (threatened) {
        this.yaw = Math.atan2(dx, dz);
        this.walking = true;
        this.soundTimer = Math.min(this.soundTimer, 2);
      } else if (this.aiTimer <= 0) {
        this.aiTimer = 1.5 + Math.random() * 3;
        this.walking = Math.random() < 0.55;
        this.yaw = Math.random() * Math.PI * 2;
      }
      if (this.walking && b.onGround && this.attackCooldown <= 0) {
        b.vel.y = threatened ? 7.2 : 5.3;
        this.attackCooldown = threatened ? 0.45 : 0.85;
      }
      this.moveAndAnimate(dt, world, player, this.walking ? (threatened ? 4.2 : 1.3) : 0);
      return;
    }


    // Livestock look for cover while it rains. They keep their current goal
    // for a few seconds, so they do not rescan 13x13 cells on every frame.
    if (this.type === 'pig' || this.type === 'cow' || this.type === 'sheep' || this.type === 'chicken') {
      if (!raining) {
        if (this.shelterGoal) this.aiTimer = 0; // normal wandering resumes
        this.shelterGoal = null;
        this.shelterTimer = 0;
      } else if (this.hurtTime <= 0 && this.body.pos.distanceTo(player) > 5) {
        this.shelterTimer -= dt;
        if (this.shelterTimer <= 0) {
          this.shelterTimer = 2.5;
          this.shelterGoal = findNearbyShelter(world, Math.floor(b.pos.x), Math.floor(b.pos.y), Math.floor(b.pos.z));
        }
        if (this.shelterGoal) {
          const dx = this.shelterGoal.x - b.pos.x, dz = this.shelterGoal.z - b.pos.z;
          this.yaw = Math.atan2(dx, dz);
          this.walking = Math.hypot(dx, dz) > 0.5;
          this.moveAndAnimate(dt, world, player, this.walking ? 1.9 : 0);
          return;
        }
      }
    }

    let speed = this.type === 'zombie' ? 2.3 : this.type === 'creeper' ? 2.05 : this.type === 'spider' ? 2.7 : this.type === 'skeleton' ? 2.0 : this.type === 'chicken' ? 1.35 : this.type === 'wolf' ? 1.6 : this.type === 'enderman' ? 3.2 : this.type === 'slime' ? 2.0 : this.type === 'ghast' ? 1.5 : 1.2;
    const dx = player.x - b.pos.x, dz = player.z - b.pos.z;
    const dist = Math.hypot(dx, dz);
    const hostile = this.type === 'zombie' || this.type === 'creeper' || this.type === 'spider' || this.type === 'skeleton' || this.type === 'enderman' || this.type === 'slime' || this.type === 'ghast';

    if (hostile && !peaceful) speed *= aggressionSpeed;
    if (peaceful && this.fuse > 0) {
      this.fuse = -1;
      this.setFlash(false);
      this.group.scale.setScalar(1);
    }

    if (this.fuse > 0) {
      this.fuse -= dt;
      this.walking = false;
      this.setFlash(Math.floor(this.fuse * 8) % 2 === 0);
      this.group.scale.setScalar(1 + Math.sin(this.fuse * 18) * 0.05);
      if (this.fuse <= 0 && !this.dead) {
        this.exploded = true;
        this.dead = true;
        this.deathTime = 0;
        this.group.scale.setScalar(1);
      }
    } else if (hostile && dist < (this.type === 'creeper' ? 14 : this.type === 'skeleton' ? 18 : this.type === 'ghast' ? 32 : 24) && Math.abs(player.y - b.pos.y) < (this.type === 'ghast' ? 24 : 8) && !peaceful) {
      this.yaw = Math.atan2(dx, dz);
      if (this.type === 'skeleton' || this.type === 'ghast') {
        // ranged: keep its distance and shoot when it has a clear line
        const tooClose = dist < (this.type === 'ghast' ? 10 : 5.5);
        this.walking = dist > (this.type === 'ghast' ? 18 : 12) || tooClose;
        if (tooClose) this.yaw = Math.atan2(-dx, -dz);
        const canShoot = dist < (this.type === 'ghast' ? 28 : 16) &&
          (this.strikeWindup > 0 || this.attackCooldown <= 0) &&
          this.hasLineOfSight(world, player.x, player.y + 0.9, player.z);
        if (this.telegraphStrike(dt, canShoot, 0,
          () => this.type === 'ghast' ? 3 + Math.random() * 1.5 : 2 + Math.random() * 1.2,
          (_damage, mob) => onShoot(mob))) this.walking = false;
      } else {
        this.walking = this.type === 'creeper' ? dist > 2.1 : dist > 0.9;
        if (this.type === 'spider' || this.type === 'zombie' || this.type === 'enderman' || this.type === 'slime') {
          const inReach = dist < (this.type === 'spider' ? 1.5 : 1.6) &&
            Math.abs(player.y - b.pos.y) < (this.type === 'spider' ? 1.4 : 2.2);
          const strikeDamage = this.type === 'enderman' ? 6 : this.type === 'slime' ? 2 : 3;
          if (this.telegraphStrike(dt, inReach, strikeDamage, this.type === 'enderman' ? 0.8 : 1, onAttack))
            this.walking = false;
        }
        if (this.type === 'creeper' && dist < 2.15 && Math.abs(player.y - b.pos.y) < 2) {
          this.fuse = 1.35;
          this.walking = false;
        }
      }
    } else {
      this.cancelStrike();
      if (this.type === 'creeper') this.group.scale.setScalar(1);
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) {
        this.aiTimer = 2 + Math.random() * 5;
        this.walking = Math.random() < 0.6;
        this.yaw = Math.random() * Math.PI * 2;
      }
      if (this.hurtTime > 0 || (this.aiTimer > 0 && this.health < this.maxHealth && !hostile)) speed *= 1.8;
      // slime hopping
      if (this.type === 'slime' && this.body.onGround && this.walking) {
        this.body.vel.y = 5 + Math.random() * 2;
      }
      // ghast floating
      if (this.type === 'ghast') {
        this.body.vel.y += (Math.sin(performance.now() * 0.001 + this.home.x) * 0.5 - this.body.vel.y) * dt * 2;
      }
    }

    const pace = this.walking && this.hurtTime < 0.3 ? speed : 0;
    // Only ground chasers need a route; spider climbing and floating ghasts
    // keep their own three-dimensional locomotion.
    const followsPlayer = !peaceful && this.fuse <= 0 && Math.abs(player.y - b.pos.y) < 8 &&
      dist < (this.type === 'skeleton' ? 18 : 24) &&
      (this.type === 'zombie' || this.type === 'creeper' || this.type === 'enderman' ||
        (this.type === 'skeleton' && dist > 5.5));
    if (followsPlayer) this.moveToward(dt, world, player, pace, player.x, player.z);
    else this.moveAndAnimate(dt, world, player, pace);
  }

  /** Limited route search only for actors pursuing a concrete target. Reuse
   * the first waypoint until reached; never run A* on every render frame. */
  private moveToward(dt: number, world: World, player: THREE.Vector3, speed: number, tx: number, tz: number): void {
    const b = this.body;
    if (speed > 0 && b.onGround && Math.hypot(tx - b.pos.x, tz - b.pos.z) > 1.1) {
      this.routeTimer -= dt;
      const arrived = this.routeStep && Math.hypot(this.routeStep.x - b.pos.x, this.routeStep.z - b.pos.z) < 0.38;
      const changed = !this.routeGoal || Math.hypot(tx - this.routeGoal.x, tz - this.routeGoal.z) > 1.7;
      if (this.routeTimer <= 0 || arrived || changed) {
        this.routeGoal = { x: tx, z: tz };
        this.routeTimer = 0.6;
        this.routeBlocked = false;
        this.routeStep = null;
        const y = Math.floor(b.pos.y);
        if (!villagerWalkable(world, b.pos.x, y, b.pos.z, tx, tz)) {
          // Keep the original step-up physics on uneven terrain; bounded
          // level-ground search is for walls, not a replacement for jumping.
          const fx = Math.floor(b.pos.x + Math.sin(this.yaw) * 0.85);
          const fz = Math.floor(b.pos.z + Math.cos(this.yaw) * 0.85);
          const ledge = IS_SOLID[world.peekBlock(fx, y, fz)] &&
            !IS_SOLID[world.peekBlock(fx, y + 1, fz)] && !IS_SOLID[world.peekBlock(fx, y + 2, fz)];
          if (!ledge) {
            this.routeStep = boundedPathStep(world, b.pos.x, y, b.pos.z, tx, tz);
            this.routeBlocked = this.routeStep === null;
          }
        }
      }
      if (this.routeStep) this.yaw = Math.atan2(this.routeStep.x - b.pos.x, this.routeStep.z - b.pos.z);
      if (this.routeBlocked) { this.walking = false; speed = 0; }
    } else {
      this.routeTimer = 0;
      this.routeStep = null;
      this.routeBlocked = false;
    }
    this.moveAndAnimate(dt, world, player, speed);
  }

  /**
   * Shared movement + physics (gravity, water, collisions, wall hops) and
   * walking animation. `speed` > 0 steers the body toward `this.yaw` at that
   * rate; 0 applies ground friction instead.
   */
  private moveAndAnimate(dt: number, world: World, player: THREE.Vector3, speed = 0): void {
    const b = this.body;
    if (speed > 0) {
      const tx = Math.sin(this.yaw) * speed, tz = Math.cos(this.yaw) * speed;
      b.vel.x += (tx - b.vel.x) * Math.min(1, dt * 10);
      b.vel.z += (tz - b.vel.z) * Math.min(1, dt * 10);
    } else if (b.onGround) {
      b.vel.x *= Math.max(0, 1 - dt * 10);
      b.vel.z *= Math.max(0, 1 - dt * 10);
    }
    const inWater = RENDER[world.peekBlock(Math.floor(b.pos.x), Math.floor(b.pos.y + 0.4), Math.floor(b.pos.z))] === 2;
    if (inWater) {
      b.vel.y = Math.min(b.vel.y + 20 * dt, 2.5);
    } else {
      b.vel.y -= 28 * dt;
      if (b.vel.y < -40) b.vel.y = -40;
    }
    const wasWall = b.hitWall;
    stepBody(world, b, dt);
    if (this.type === 'spider' && !inWater && (b.hitWall || wasWall) && this.walking) {
      // Spiders climb: a low ledge is a hop, a real wall is crawled up while the
      // player is above it (the body stays flush against the face, so rising is
      // free) – `climbing` keeps the crawl going between frames.
      const fx = Math.floor(b.pos.x + Math.sin(this.yaw) * 0.7), fz = Math.floor(b.pos.z + Math.cos(this.yaw) * 0.7);
      const hy = Math.floor(b.pos.y);
      const at = (dy: number) => IS_SOLID[world.peekBlock(fx, hy + dy, fz)];
      const wallFace = at(0); // the wall keeps going as long as its face is solid
      if (wallFace && player.y > b.pos.y + 1.2 && (b.onGround || this.climbing)) {
        b.vel.y = 3.6;
        this.climbing = true;
      } else if (b.onGround && at(1) && !at(2)) {
        b.vel.y = 6.5; // a single ledge is just a hop
        this.climbing = false;
      } else if (!wallFace) {
        this.climbing = false;
      }
    }
    // A climbing spider keeps its heading: it must not turn away mid-wall.
    if ((b.hitWall || wasWall) && b.onGround && this.walking && !(this.type === 'spider' && this.climbing)) {
      // Replan around a newly placed block instead of pushing against it.
      // Random wanderers abandon a stubborn two-block wall; one-block steps
      // still use the pre-existing hop below.
      const fx = Math.floor(b.pos.x + Math.sin(this.yaw) * 0.8), fz = Math.floor(b.pos.z + Math.cos(this.yaw) * 0.8);
      const hy = Math.floor(b.pos.y);
      const tallWall = IS_SOLID[world.peekBlock(fx, hy, fz)] && IS_SOLID[world.peekBlock(fx, hy + 1, fz)];
      if (this.routeStep && tallWall) {
        this.routeTimer = 0;
        this.routeStep = null;
        this.walking = false;
        b.vel.x = b.vel.z = 0;
      } else if (tallWall && (this.blockedTime += dt) > 0.5) {
        this.walking = false;
        this.aiTimer = 0;
        this.blockedTime = 0;
        b.vel.x = b.vel.z = 0;
      } else {
      // jump over obstacle if space above — but not onto a fence or a closed door
      const fx = Math.floor(b.pos.x + Math.sin(this.yaw) * 0.8), fz = Math.floor(b.pos.z + Math.cos(this.yaw) * 0.8);
      const hy = Math.floor(b.pos.y);
      const front = world.peekBlock(fx, hy, fz);
      if (front === B.FENCE || isDoor(front)) this.yaw += Math.PI * (0.45 + Math.random() * 0.3);
      else if (!IS_SOLID[world.peekBlock(fx, hy + 1, fz)] && !IS_SOLID[world.peekBlock(fx, hy + 2, fz)]) b.vel.y = 8.2;
      else if (this.type !== 'zombie') this.yaw += Math.PI / 2;
      }
    } else this.blockedTime = 0;
    // avoid walking into water / cliffs (passive mobs)
    if (this.type !== 'zombie' && this.type !== 'creeper' && this.type !== 'skeleton' && this.walking && b.onGround) {
      const fx = Math.floor(b.pos.x + Math.sin(this.yaw) * 0.9), fz = Math.floor(b.pos.z + Math.cos(this.yaw) * 0.9);
      const fy = Math.floor(b.pos.y);
      const below = world.peekBlock(fx, fy - 1, fz);
      const below2 = world.peekBlock(fx, fy - 2, fz);
      if ((below === B.WATER && this.type !== 'frog') || below === B.LAVA || (below !== B.WATER && !IS_SOLID[below] && !IS_SOLID[below2])) this.yaw += Math.PI * (0.5 + Math.random());
    }

    // animation (spiders scuttle faster, and fastest while climbing)
    const hs = Math.hypot(b.vel.x, b.vel.z);
    const gait = this.type === 'spider' ? (this.climbing ? 6.5 : 4.4) : 3.2;
    this.walkPhase += hs * dt * gait;
    const swing = Math.sin(this.walkPhase) * Math.min(1, hs / 1.5) * 0.7;
    if (this.legs.length === 4) {
      this.legs[0].rotation.x = swing;
      this.legs[3].rotation.x = swing;
      this.legs[1].rotation.x = -swing;
      this.legs[2].rotation.x = -swing;
    } else if (this.legs.length === 8) {
      for (let i = 0; i < 8; i++) {
        this.legs[i].rotation.x = Math.sin(this.walkPhase + (i % 2 ? Math.PI : 0) + Math.floor(i / 4) * 0.6) * swing;
      }
    } else if (this.legs.length === 2) {
      this.legs[0].rotation.x = swing;
      this.legs[1].rotation.x = -swing;
      if (this.type === 'chicken' && this.arms.length) {
        const flap = Math.sin(this.walkPhase * 2) * 0.45;
        this.arms[0].rotation.z = 0.4 + flap;
        this.arms[1].rotation.z = -0.4 - flap;
      } else if (this.type === 'skeleton' && this.arms.length) {
        this.arms[0].rotation.x = -1.15 + Math.sin(this.walkPhase * 0.5) * 0.05;
        this.arms[1].rotation.x = -1.15 - Math.sin(this.walkPhase * 0.5) * 0.05;
      } else if (this.arms.length) {
        this.arms[0].rotation.x = -Math.PI / 2 + Math.sin(this.walkPhase * 0.5) * 0.08;
        this.arms[1].rotation.x = -Math.PI / 2 - Math.sin(this.walkPhase * 0.5) * 0.08;
      }
    }
    if (this.strikeWindup > 0) {
      // Raised arms/forelegs or a compressed body show the windup as motion,
      // alongside the static cue. All use the existing low-poly geometry.
      if (this.type === 'spider' && this.legs.length >= 8) {
        this.legs[0].rotation.x = this.legs[4].rotation.x = -0.95;
      } else if (this.arms.length >= 2) {
        this.arms[0].rotation.x = this.arms[1].rotation.x = -2.35;
      }
    }
    if (this.type === 'slime' || this.type === 'ghast') {
      const windup = this.strikeWindup > 0 ? Math.min(1, this.strikeWindup / 0.55) : 0;
      if (this.type === 'slime') this.group.scale.set(1 + 0.1 * windup, 1 - 0.13 * windup, 1 + 0.1 * windup);
      else this.group.scale.setScalar(1 + 0.08 * windup);
    }
    this.group.position.copy(b.pos);
    // smooth rotation
    let diff = this.yaw - this.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.group.rotation.y += diff * Math.min(1, dt * 8);
  }

  /** Cheap visibility test used by the skeleton before it shoots. */
  hasLineOfSight(world: World, tx: number, ty: number, tz: number): boolean {
    const sx = this.body.pos.x, sy = this.body.pos.y + this.body.h * 0.85, sz = this.body.pos.z;
    const dx = tx - sx, dy = ty - sy, dz = tz - sz;
    const d = Math.hypot(dx, dy, dz);
    const steps = Math.max(1, Math.ceil(d * 2));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (IS_OPAQUE[world.peekBlock(Math.floor(sx + dx * t), Math.floor(sy + dy * t), Math.floor(sz + dz * t))]) return false;
    }
    return true;
  }

  // Ray-AABB intersection distance
  rayHit(o: THREE.Vector3, d: THREE.Vector3, maxDist: number): number | null {
    const b = this.body;
    const hw = b.w / 2 + 0.1;
    const min = [b.pos.x - hw, b.pos.y, b.pos.z - hw];
    const max = [b.pos.x + hw, b.pos.y + (this.type === 'sandstalker' && this.sandBuried ? 0.22 : b.h), b.pos.z + hw];
    const oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
    let tmin = 0, tmax = maxDist;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(dd[i]) < 1e-8) {
        if (oo[i] < min[i] || oo[i] > max[i]) return null;
      } else {
        let t1 = (min[i] - oo[i]) / dd[i], t2 = (max[i] - oo[i]) / dd[i];
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return null;
      }
    }
    return tmin;
  }

  dispose() {
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    });
  }
}
