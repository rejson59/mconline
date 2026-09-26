import * as THREE from 'three';
import type { World } from './world';
import { stepBody, type Body } from './physics';
import { IS_SOLID, IS_OPAQUE, RENDER, B, isDoor } from './blocks';

export type MobType = 'pig' | 'zombie' | 'sheep' | 'cow' | 'chicken' | 'creeper' | 'spider' | 'skeleton' | 'wolf';

export function isHostileMob(type: MobType): boolean {
  return type === 'zombie' || type === 'creeper' || type === 'spider' || type === 'skeleton';
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
  /** True while a spider crawls up a wall (drives the leg animation). */
  climbing = false;
  private woolMesh: THREE.Mesh | null = null;
  legs: THREE.Object3D[] = [];
  arms: THREE.Object3D[] = [];
  head!: THREE.Object3D;
  meshes: THREE.Mesh[] = [];

  constructor(type: MobType, x: number, y: number, z: number) {
    this.type = type;
    const w = type === 'zombie' || type === 'creeper' ? 0.6 : type === 'chicken' ? 0.45 : type === 'cow' ? 1.1 : type === 'wolf' ? 0.6 : 0.9;
    const h = type === 'zombie' ? 1.9 : type === 'creeper' ? 1.7 : type === 'cow' ? 1.4 : type === 'chicken' ? 0.7 : type === 'sheep' ? 1.2 : type === 'wolf' ? 0.9 : 0.9;
    this.body = { pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), w, h, onGround: false, hitWall: false };
    this.maxHealth = this.health = type === 'zombie' ? 20 : type === 'creeper' ? 16 : type === 'cow' ? 10 : type === 'chicken' ? 4 : type === 'sheep' ? 8 : type === 'skeleton' ? 20 : type === 'spider' ? 16 : type === 'wolf' ? 8 : 10;
    this.build();
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
    }
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        // clone material per mob so we can tint on hurt
        const mesh = o as THREE.Mesh;
        mesh.material = (mesh.material as THREE.MeshLambertMaterial).clone();
      }
    });
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

  damage(amount: number, fromX: number, fromZ: number) {
    if (this.dead || this.hurtTime > 0) return false;
    this.health -= amount;
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
    }
    return true;
  }

  /**
   * Tamed wolf AI: follow the player, stand by when close, and attack the
   * nearest hostile mob on the player's behalf.
   */
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
    this.moveAndAnimate(dt, world, player, this.walking ? 4.6 : 0);
  }

  /** Removes a sheep's wool once. Returns false if it was already sheared or isn't a sheep. */
  shear(): boolean {
    if (this.type !== 'sheep' || this.dead || this.sheared) return false;
    this.sheared = true;
    if (this.woolMesh) this.woolMesh.material = new THREE.MeshLambertMaterial({ color: 0xd8c8b0 });
    return true;
  }

  update(
    dt: number,
    world: World,
    player: THREE.Vector3,
    onAttack: (dmg: number, mob: Mob) => void,
    onShoot: (mob: Mob) => void,
    peaceful: boolean,
    allies: Mob[] = [],
    onBite: (mob: Mob) => void = () => {}
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

    if (this.tamed) {
      this.updateTamed(dt, world, player, allies, onBite);
      return;
    }

    let speed = this.type === 'zombie' ? 2.3 : this.type === 'creeper' ? 2.05 : this.type === 'spider' ? 2.7 : this.type === 'skeleton' ? 2.0 : this.type === 'chicken' ? 1.35 : this.type === 'wolf' ? 1.6 : 1.2;
    const dx = player.x - b.pos.x, dz = player.z - b.pos.z;
    const dist = Math.hypot(dx, dz);
    const hostile = this.type === 'zombie' || this.type === 'creeper' || this.type === 'spider' || this.type === 'skeleton';

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
    } else if (hostile && dist < (this.type === 'creeper' ? 14 : this.type === 'skeleton' ? 18 : 24) && Math.abs(player.y - b.pos.y) < 8 && !peaceful) {
      this.yaw = Math.atan2(dx, dz);
      if (this.type === 'skeleton') {
        // ranged: keep its distance and shoot when it has a clear line
        const tooClose = dist < 5.5;
        this.walking = dist > 12 || tooClose;
        if (tooClose) this.yaw = Math.atan2(-dx, -dz);
        if (dist < 16 && this.attackCooldown <= 0 && this.hasLineOfSight(world, player.x, player.y + 0.9, player.z)) {
          this.attackCooldown = 2 + Math.random() * 1.2;
          onShoot(this);
        }
      } else {
        this.walking = this.type === 'creeper' ? dist > 2.1 : dist > 0.9;
        if (this.type === 'spider' && dist < 1.5 && Math.abs(player.y - b.pos.y) < 1.4 && this.attackCooldown <= 0) {
          this.attackCooldown = 1;
          onAttack(3, this);
        }
        if (this.type === 'zombie' && dist < 1.4 && Math.abs(player.y - b.pos.y) < 1.8 && this.attackCooldown <= 0) {
          this.attackCooldown = 1;
          onAttack(3, this);
        }
        if (this.type === 'creeper' && dist < 2.15 && Math.abs(player.y - b.pos.y) < 2) {
          this.fuse = 1.35;
          this.walking = false;
        }
      }
    } else {
      if (this.type === 'creeper') this.group.scale.setScalar(1);
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) {
        this.aiTimer = 2 + Math.random() * 5;
        this.walking = Math.random() < 0.6;
        this.yaw = Math.random() * Math.PI * 2;
      }
      if (this.hurtTime > 0 || (this.aiTimer > 0 && this.health < this.maxHealth && !hostile)) speed *= 1.8;
    }

    this.moveAndAnimate(dt, world, player, this.walking && this.hurtTime < 0.3 ? speed : 0);
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
      // jump over obstacle if space above — but not onto a fence or a closed door
      const fx = Math.floor(b.pos.x + Math.sin(this.yaw) * 0.8), fz = Math.floor(b.pos.z + Math.cos(this.yaw) * 0.8);
      const hy = Math.floor(b.pos.y);
      const front = world.peekBlock(fx, hy, fz);
      if (front === B.FENCE || isDoor(front)) this.yaw += Math.PI * (0.45 + Math.random() * 0.3);
      else if (!IS_SOLID[world.peekBlock(fx, hy + 1, fz)] && !IS_SOLID[world.peekBlock(fx, hy + 2, fz)]) b.vel.y = 8.2;
      else if (this.type !== 'zombie') this.yaw += Math.PI / 2;
    }
    // avoid walking into water / cliffs (passive mobs)
    if (this.type !== 'zombie' && this.type !== 'creeper' && this.type !== 'skeleton' && this.walking && b.onGround) {
      const fx = Math.floor(b.pos.x + Math.sin(this.yaw) * 0.9), fz = Math.floor(b.pos.z + Math.cos(this.yaw) * 0.9);
      const fy = Math.floor(b.pos.y);
      const below = world.peekBlock(fx, fy - 1, fz);
      const below2 = world.peekBlock(fx, fy - 2, fz);
      if (below === B.WATER || below === B.LAVA || (!IS_SOLID[below] && !IS_SOLID[below2])) this.yaw += Math.PI * (0.5 + Math.random());
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
    const max = [b.pos.x + hw, b.pos.y + b.h, b.pos.z + hw];
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
