import * as THREE from 'three';
import type { World } from './world';
import { stepBody, type Body } from './physics';
import { IS_SOLID, RENDER, B } from './blocks';

export type MobType = 'pig' | 'zombie' | 'sheep';

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
  legs: THREE.Object3D[] = [];
  arms: THREE.Object3D[] = [];
  head!: THREE.Object3D;
  meshes: THREE.Mesh[] = [];

  constructor(type: MobType, x: number, y: number, z: number) {
    this.type = type;
    const w = type === 'zombie' ? 0.6 : 0.9;
    const h = type === 'zombie' ? 1.9 : type === 'sheep' ? 1.2 : 0.9;
    this.body = { pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), w, h, onGround: false, hitWall: false };
    this.maxHealth = this.health = type === 'zombie' ? 20 : type === 'sheep' ? 8 : 10;
    this.build();
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
    if (this.type === 'pig' || this.type === 'sheep') {
      const isSheep = this.type === 'sheep';
      const bodyColor = isSheep ? 0xeeeeee : 0xf0a0a0;
      const skin = isSheep ? 0xd8c8b0 : 0xf0a0a0;
      const legH = isSheep ? 0.5 : 0.35;
      const body = box(isSheep ? 0.75 : 0.62, isSheep ? 0.62 : 0.55, 1.0, bodyColor, sharedMats);
      body.position.set(0, legH + 0.28, 0);
      g.add(body);
      this.meshes.push(body);
      const head = new THREE.Group();
      head.position.set(0, legH + 0.45, 0.55);
      const hm = box(0.5, 0.5, 0.45, skin, sharedMats);
      head.add(hm);
      this.meshes.push(hm);
      if (!isSheep) {
        const snout = box(0.28, 0.18, 0.08, 0xe07f86, sharedMats);
        snout.position.set(0, -0.08, 0.26);
        head.add(snout);
        this.meshes.push(snout);
      }
      const eyeL = box(0.08, 0.08, 0.02, 0x111111, sharedMats);
      eyeL.position.set(-0.14, 0.08, 0.23);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.14;
      head.add(eyeL, eyeR);
      g.add(head);
      this.head = head;
      const lc = isSheep ? 0xd8c8b0 : 0xf0a0a0;
      this.addLeg(-0.18, legH, 0.32, 0.22, legH, 0.22, lc, this.legs);
      this.addLeg(0.18, legH, 0.32, 0.22, legH, 0.22, lc, this.legs);
      this.addLeg(-0.18, legH, -0.32, 0.22, legH, 0.22, lc, this.legs);
      this.addLeg(0.18, legH, -0.32, 0.22, legH, 0.22, lc, this.legs);
    } else {
      // zombie
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
    }
    if (this.type !== 'zombie') {
      // panic
      this.aiTimer = 3;
      this.walking = true;
      this.yaw = Math.atan2(dx, dz);
    }
    return true;
  }

  update(dt: number, world: World, player: THREE.Vector3, onAttack: (dmg: number, mob: Mob) => void, peaceful: boolean) {
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

    const inWater = RENDER[world.peekBlock(Math.floor(b.pos.x), Math.floor(b.pos.y + 0.4), Math.floor(b.pos.z))] === 2;
    let speed = this.type === 'zombie' ? 2.3 : 1.2;
    const dx = player.x - b.pos.x, dz = player.z - b.pos.z;
    const dist = Math.hypot(dx, dz);

    if (this.type === 'zombie' && dist < 24 && Math.abs(player.y - b.pos.y) < 8 && !peaceful) {
      this.yaw = Math.atan2(dx, dz);
      this.walking = dist > 0.9;
      if (dist < 1.4 && Math.abs(player.y - b.pos.y) < 1.8 && this.attackCooldown <= 0) {
        this.attackCooldown = 1;
        onAttack(3, this);
      }
    } else {
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) {
        this.aiTimer = 2 + Math.random() * 5;
        this.walking = Math.random() < 0.6;
        this.yaw = Math.random() * Math.PI * 2;
      }
      if (this.hurtTime > 0 || this.aiTimer > 0 && this.health < this.maxHealth && this.type !== 'zombie') speed *= 1.8;
    }

    if (this.walking && this.hurtTime < 0.3) {
      const tx = Math.sin(this.yaw) * speed, tz = Math.cos(this.yaw) * speed;
      b.vel.x += (tx - b.vel.x) * Math.min(1, dt * 10);
      b.vel.z += (tz - b.vel.z) * Math.min(1, dt * 10);
    } else if (b.onGround) {
      b.vel.x *= Math.max(0, 1 - dt * 10);
      b.vel.z *= Math.max(0, 1 - dt * 10);
    }

    if (inWater) {
      b.vel.y = Math.min(b.vel.y + 20 * dt, 2.5);
    } else {
      b.vel.y -= 28 * dt;
      if (b.vel.y < -40) b.vel.y = -40;
    }
    const wasWall = b.hitWall;
    stepBody(world, b, dt);
    if ((b.hitWall || wasWall) && b.onGround && this.walking) {
      // jump over obstacle if space above
      const fx = Math.floor(b.pos.x + Math.sin(this.yaw) * 0.8), fz = Math.floor(b.pos.z + Math.cos(this.yaw) * 0.8);
      const hy = Math.floor(b.pos.y);
      if (!IS_SOLID[world.peekBlock(fx, hy + 1, fz)] && !IS_SOLID[world.peekBlock(fx, hy + 2, fz)]) b.vel.y = 8.2;
      else if (this.type !== 'zombie') this.yaw += Math.PI / 2;
    }
    // avoid walking into water / cliffs (passive mobs)
    if (this.type !== 'zombie' && this.walking && b.onGround) {
      const fx = Math.floor(b.pos.x + Math.sin(this.yaw) * 0.9), fz = Math.floor(b.pos.z + Math.cos(this.yaw) * 0.9);
      const fy = Math.floor(b.pos.y);
      const below = world.peekBlock(fx, fy - 1, fz);
      const below2 = world.peekBlock(fx, fy - 2, fz);
      if (below === B.WATER || below === B.LAVA || (!IS_SOLID[below] && !IS_SOLID[below2])) this.yaw += Math.PI * (0.5 + Math.random());
    }

    // animation
    const hs = Math.hypot(b.vel.x, b.vel.z);
    this.walkPhase += hs * dt * 3.2;
    const swing = Math.sin(this.walkPhase) * Math.min(1, hs / 1.5) * 0.7;
    if (this.legs.length === 4) {
      this.legs[0].rotation.x = swing;
      this.legs[3].rotation.x = swing;
      this.legs[1].rotation.x = -swing;
      this.legs[2].rotation.x = -swing;
    } else if (this.legs.length === 2) {
      this.legs[0].rotation.x = swing;
      this.legs[1].rotation.x = -swing;
      if (this.arms.length) {
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
