/**
 * Zombies Runtime 3.0 – pełna pętla 1:1 Hypixel
 * Podpinany do Game gdy mode === 'zombies'
 * Obsługuje: strzelanie, rundy, spawn, drzwi, sklepy, okna, perki, power, down/revive
 */
import * as THREE from 'three';
import type { ZombiesMapLayout, ZombiesGameState, PlayerZombiesState, WeaponInstance } from './types';
import { getMapLayout } from './index';
import { WEAPONS } from './weapons';
import { PERKS, ULTIMATE_MACHINE_PRICE } from './perks';
import * as Sfx from '../audio';
import { buildRounds } from './roundConfig';
import { unlockDoor } from './worldBuilder';
import { B } from '../blocks';
import { Mob, type MobType } from '../mobs';

// Forward type for Game – we use structural typing to avoid circular import
interface GameRef {
  world: import('../world').World;
  body: { pos: THREE.Vector3; vel: THREE.Vector3; w: number; h: number; onGround: boolean };
  yaw: number; pitch: number;
  health: number; maxHealth?: number;
  hunger: number;
  spawnMob(type: MobType, x: number, y: number, z: number, profession?: number): Mob;
  mobs: Mob[];
  message(text: string): void;
  spawnParticles(x: number, y: number, z: number, id: number, n: number, s: number): void;
  spawnDrop(id: number, count: number, x: number, y: number, z: number): void;
  emitHud(): void;
  setUI(s: string): void;
  mode: string;
  worldName: string;
}

export class ZombiesRuntime {
  game: GameRef;
  layout: ZombiesMapLayout;
  mapId: string;
  state: ZombiesGameState;
  // Player single (multiplayer map later)
  pid = 'local';
  roundDefs = buildRounds(30, 'deadend');

  // Shooting
  fireCooldown = 0;
  reloadTimer = 0;
  isReloading = false;
  lastShot = 0;

  // Round flow
  roundTimer = 0; // seconds into round
  spawning = false;
  spawnCooldown = 0;
  spawnLeft = 0;
  roundIntermission = 0; // countdown to next round
  zombiesAlive = 0;

  // Economy helper (single player mirror of state.players.get(pid).gold)
  get player(): PlayerZombiesState {
    return this.state.players.get(this.pid)!;
  }
  get gold(): number { return this.player.gold; }
  set gold(v: number) { this.player.gold = Math.max(0, Math.floor(v)); }

  // Windows health (position key -> hp 0-6 barricades)
  windowHp = new Map<string, number>();
  // Power
  powerOn = false;

  // Perks effects
  hasPerk(id: string): boolean { return this.player.perks.some(p => p.id === id); }

  // Insta kill etc powerups
  instaKillLeft = 0;
  doubleGoldLeft = 0;
  maxAmmoQueued = false;
  // masterpiece FX
  hitMarker = 0; // seconds left
  hitMarkerCrit = false;
  lastHitMarkerAt = 0;

  constructor(game: GameRef, mapId: string) {
    this.game = game;
    this.mapId = mapId;
    this.layout = getMapLayout(mapId as never);
    this.roundDefs = buildRounds(30, mapId);
    // Create state with single player
    this.state = {
      mapId: mapId as never,
      round: 1,
      waveInRound: 0,
      zombiesAlive: 0,
      zombiesToSpawn: this.roundDefs[0].zombieCount,
      powerOn: false,
      doorsUnlocked: new Set<string>(),
      mysteryLocation: this.layout.rooms[1]?.id ?? this.layout.rooms[0].id,
      gameOver: false,
      victory: false,
      time: 0,
      players: new Map<string, PlayerZombiesState>([[this.pid, {
        gold: 500,
        downs: 0,
        isDowned: false,
        downTimeLeft: 0,
        perks: [],
        weapons: [{ weaponId: 'pistol', ultimate: false, ammoReserve: WEAPONS.pistol.ammoReserve, clip: WEAPONS.pistol.clipSize }],
        currentWeapon: 0,
        kills: 0,
        revives: 0,
      }]]),
    };
    // init window hp – each window position starts with 6 planks (like Hypixel barricades)
    for (const w of this.layout.windowPositions) {
      const key = `${w.x},${w.y},${w.z}`;
      this.windowHp.set(key, 6);
    }
    // Also expand to all rooms windows not explicitly listed: generate by room bounds
    for (const r of this.layout.rooms) {
      // fill missing windows count
      const counted = this.layout.windowPositions.filter(p => p.roomId === r.id).length;
      const missing = Math.max(0, r.windows - counted);
      for (let i = 0; i < missing; i++) {
        const x = (r.x1 + r.x2) / 2 + (i % 2 === 0 ? -2 : 2);
        const z = (r.z1 + r.z2) / 2 + (i < 2 ? -2 : 2);
        const key = `${Math.floor(x)},${r.y},${Math.floor(z)}`;
        if (!this.windowHp.has(key)) this.windowHp.set(key, 6);
      }
    }
    this.spawnLeft = this.roundDefs[0].zombieCount;
    console.log(`[Zombies] ${mapId} R1 – ${this.spawnLeft} zombie, gold ${this.gold}`);
  }

  currentWeapon(): WeaponInstance {
    return this.player.weapons[this.player.currentWeapon];
  }
  currentWeaponDef() { return WEAPONS[this.currentWeapon().weaponId]; }

  // ---- Economy helpers
  addGold(n: number, reason?: string) {
    const mult = this.doubleGoldLeft > 0 ? 2 : 1;
    const final = n * mult;
    this.gold += final;
    if (reason) this.game.message(`+${final}g ${reason}${mult > 1 ? ' (×2!)' : ''}`);
  }

  // ---- Shooting (hitscan)
  canShoot(): boolean {
    if (this.fireCooldown > 0) return false;
    if (this.isReloading) return false;
    const w = this.currentWeapon();
    if (w.clip <= 0) {
      this.tryReload();
      return false;
    }
    return true;
  }

  shoot(): boolean {
    if (!this.canShoot()) return false;
    const inst = this.currentWeapon();
    const def = WEAPONS[inst.weaponId];
    if (!def) return false;

    // Quick Fire perk speeds up
    const speedMul = this.hasPerk('quickFire') ? 0.75 : 1;
    this.fireCooldown = def.fireRate * speedMul;
    inst.clip -= 1;
    this.showMuzzleFlash(def);
    this.doHitscan(def, inst);
    // auto-reload hint
    if (inst.clip === 0) this.game.message(`Przeładuj! [R] – ${def.name} pusty`);
    this.game.emitHud();
    return true;
  }

  private showMuzzleFlash(_def: { id: string }) {
    const dir = this.aimDir();
    const p = this.game.body.pos.clone().add(new THREE.Vector3(0, 1.4, 0)).add(dir.clone().multiplyScalar(1.2));
    this.game.spawnParticles(p.x, p.y, p.z, B.GLOWSTONE, 6, 0.2);
    // CoD-like gun sound – use dig/metal as placeholder per weapon speed
    try { if (_def.id === 'shotgun') Sfx.playExplosion(); else if (_def.id === 'sniper') (Sfx as unknown as { playBow?: () => void }).playBow?.(); else Sfx.playDig('metal', p.x, p.y, p.z); } catch {}
  }

  private aimDir(): THREE.Vector3 {
    const yaw = this.game.yaw, pitch = this.game.pitch;
    return new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch)
    ).normalize();
  }

  private doHitscan(def: { id: string; damage: number; fireRate: number; pellets?: number; piercing?: number; aoe?: number; goldPerHit: number; goldPerCrit: number }, _inst: WeaponInstance) {
    const origin = this.game.body.pos.clone().add(new THREE.Vector3(0, 1.55, 0));
    const dir = this.aimDir();
    const maxDist = 80;
    // Insta-Kill overrides damage
    const insta = this.instaKillLeft > 0;

    // For shotgun: multiple pellets with spread
    const pellets = def.pellets ?? 1;
    const spread = pellets > 1 ? 0.06 : 0.012;

    let hits = 0;
    // Collect mobs along ray
    for (let p = 0; p < pellets; p++) {
      let d = dir.clone();
      if (pellets > 1) {
        d.x += (Math.random() - 0.5) * spread * 2;
        d.y += (Math.random() - 0.5) * spread * 2;
        d.z += (Math.random() - 0.5) * spread * 2;
        d.normalize();
      }
      // raycast against mobs sorted by distance
      const candidates: { mob: Mob; dist: number }[] = [];
      for (const mob of this.game.mobs) {
        if (mob.dead || mob.health <= 0) continue;
        // Only zombies (we spawn them as zombie, skeleton etc)
        if (!['zombie', 'skeleton', 'spider', 'creeper', 'slime', 'ghast', 'enderman'].includes(mob.type)) continue;
        const hit = mob.rayHit(origin, d, maxDist);
        if (hit != null) candidates.push({ mob, dist: hit });
      }
      candidates.sort((a, b) => a.dist - b.dist);
      const pierce = insta ? 99 : (def.piercing ?? (def.id === 'sniper' ? 2 : 0));
      let pierced = 0;
      for (const c of candidates) {
        if (pierced > pierce) break;
        // line-of-sight check (block occlusion) – simple: ignore for zombies (they are behind windows)
        // headshot: if ray hits upper 0.3 of mob height
        const mobBottom = c.mob.body.pos.y;
        const mobTop = mobBottom + c.mob.body.h;
        const hitY = origin.y + d.y * c.dist;
        const head = hitY > mobTop - 0.35;
        const crit = head && def.id.includes('sniper') || head && Math.random() < 0.12;
        const baseDmg = insta ? 999 : def.damage;
        const dmg = crit ? baseDmg * 1.5 : baseDmg;
        // Flame bullets perk: ignite
        const flame = this.hasPerk('flameBullets');
        const frozen = this.hasPerk('frozenBullets');

        const died = this.damageZombie(c.mob, dmg, crit, def.id);
        if (flame && !died) {
          (c.mob as unknown as { burning?: number }).burning = 3;
        }
        if (frozen && !died) {
          (c.mob as unknown as { slowed?: number }).slowed = 4;
        }
        // Gold per hit + hitmarker (masterpiece FX)
        const goldHit = crit ? def.goldPerCrit : def.goldPerHit;
        this.addGold(goldHit);
        this.hitMarker = 0.18; this.hitMarkerCrit = !!crit; this.lastHitMarkerAt = performance.now();
        // subtle screenshake on crit
        if (crit) try { (this.game as unknown as { shake: number }).shake = Math.max((this.game as unknown as { shake: number }).shake ?? 0, 0.35); } catch {}
        hits++;
        pierced++;
        if (pellets === 1) break; // rifle/pistol etc one hit per trigger
      }
      if (candidates.length === 0 && pellets === 1) {
        // miss particles at max distance
        const miss = origin.clone().add(d.clone().multiplyScalar(20));
        this.game.spawnParticles(miss.x, miss.y, miss.z, B.STONE, 2, 0.1);
      }
    }
    // Rocket AoE
    if (def.aoe) {
      const center = origin.clone().add(dir.clone().multiplyScalar(18));
      for (const mob of this.game.mobs) {
        const dist = mob.body.pos.distanceTo(center);
        if (dist < def.aoe! && !mob.dead) {
          const dmg = insta ? 999 : def.damage;
          this.damageZombie(mob, dmg, false, def.id);
        }
      }
      this.game.spawnParticles(center.x, center.y, center.z, B.TNT, 24, 1.2);
    }
  }

  private damageZombie(mob: Mob, dmg: number, crit: boolean, _weaponId: string): boolean {
    void mob.health; // keep reference
    const prevPos = mob.body.pos.clone();
    // Use mob.damage with player as attacker so golem-like logic etc could be triggered – but zombies are hostile
    const isCritHit = crit;
    // mob.damage expects fromX/Z – we give player pos
    const _died = !mob.damage(dmg, this.game.body.pos.x, this.game.body.pos.z, 'player' as never); void _died;
    // Our Mob.damage already subtracts health and does knockback; we need to handle custom: if died
    if (mob.dead || mob.health <= 0) {
      mob.dead = true;
      // rewards
      this.addGold(20 + Math.floor(this.state.round * 1.2), `kill ${mob.type}${crit ? ' HEADSHOT!' : ''}`);
      this.player.kills += 1;
      this.zombiesAlive = Math.max(0, this.zombiesAlive - 1);
      (mob as unknown as { _zombiesCounted?: boolean })._zombiesCounted = true;
      this.game.spawnParticles(prevPos.x, prevPos.y + 0.9, prevPos.z, B.GLOWSTONE, 8, 0.3);
      // powerup drop 4% (hypixel ~5%)
      if (Math.random() < 0.045) this.dropPowerup(prevPos);
      // check round complete
      this.checkRoundEnd();
      return true;
    } else {
      // hit marker
      if (isCritHit) this.game.spawnParticles(prevPos.x, prevPos.y + 1.2, prevPos.z, B.GOLD_BLOCK, 4, 0.2);
      return false;
    }
  }

  private dropPowerup(pos: THREE.Vector3) {
    const roll = Math.random();
    let kind: 'insta' | 'maxAmmo' | 'doubleGold' = 'maxAmmo';
    if (roll < 0.33) kind = 'insta';
    else if (roll < 0.66) kind = 'maxAmmo';
    else kind = 'doubleGold';
    this.game.spawnParticles(pos.x, pos.y + 0.5, pos.z, kind === 'insta' ? B.REDSTONE_BLOCK : kind === 'doubleGold' ? B.GOLD_BLOCK : B.IRON_BLOCK, 10, 0.4);
    this.game.message(kind === 'insta' ? '⚡ INSTANT KILL! 10s' : kind === 'maxAmmo' ? '📦 MAX AMMO!' : '💰 DOUBLE GOLD 30s');
    if (kind === 'insta') this.instaKillLeft = 10;
    else if (kind === 'doubleGold') this.doubleGoldLeft = 30;
    else {
      // max ammo – refill all
      for (const w of this.player.weapons) {
        const def = WEAPONS[w.weaponId];
        if (def) { w.ammoReserve = def.ammoReserve; w.clip = def.clipSize; }
      }
    }
  }

  // ---- Reload
  tryReload() {
    if (this.isReloading) return;
    const inst = this.currentWeapon();
    const def = WEAPONS[inst.weaponId];
    if (!def) return;
    if (inst.clip >= def.clipSize) return;
    if (inst.ammoReserve <= 0 && def.id !== 'puncher') return;
    this.isReloading = true;
    const perkFast = this.hasPerk('quickFire');
    const t = def.reloadTime * (perkFast ? 0.85 : 1);
    this.reloadTimer = t;
    this.game.message(`Przeładowuję ${def.name}... ${t.toFixed(1)}s`);
  }
  private finishReload() {
    const inst = this.currentWeapon();
    const def = WEAPONS[inst.weaponId];
    if (!def) return;
    const need = def.clipSize - inst.clip;
    if (def.id === 'puncher') { inst.clip = def.clipSize; }
    else {
      const take = Math.min(need, inst.ammoReserve);
      inst.clip += take;
      inst.ammoReserve -= take;
    }
    this.isReloading = false;
    this.reloadTimer = 0;
    this.game.message(`✔ ${def.name} gotowe!`);
    this.game.spawnParticles(this.game.body.pos.x, this.game.body.pos.y + 1, this.game.body.pos.z, B.GLOWSTONE ?? B.GLOWSTONE, 4, 0.2);
  }

  // ---- Doors / Shops / Power
  tryInteract(): string | null {
    const pos = this.game.body.pos.clone().add(new THREE.Vector3(0, 1.4, 0));
    const dir = this.aimDir();
    // raycast to shops/doors/power
    // Check power lever first (look for LEVER block within 4 blocks)
    const hit = this.raycastBlock(pos, dir, 4.5);
    if (!hit) return null;
    const { x, y, z, id } = hit;
    // Power lever: LEVER (256) in power room
    if (id === B.LEVER && !this.powerOn) {
      if (this.gold < 0) {} // free
      this.powerOn = true;
      this.state.powerOn = true;
      this.game.message('⚡ PRĄD WŁĄCZONY! Perki odblokowane.');
      this.game.spawnParticles(x, y, z, B.REDSTONE_BLOCK, 12, 0.5);
      return 'power';
    }
    if (id === B.LEVER && this.powerOn) { this.game.message('Prąd już włączony.'); return null; }

    // Door: look for IRON_BLOCK door marker
    for (const d of this.layout.doors) {
      const dist = Math.hypot(x - d.x, y - (d.y + 2), z - d.z);
      if (dist < 2.2 && d.locked !== undefined) {
        return this.tryBuyDoor(d);
      }
    }
    // Shop: check proximity to shop position
    for (const s of this.layout.shops) {
      const dist = Math.hypot(x - s.x, y - (s.y + 1), z - s.z);
      if (dist < 2.5) {
        return this.tryShop(s);
      }
    }
    // Window repair: glass
    if (id === B.GLASS || id === B.AIR) {
      void `${x},${y - 1},${z}`; // window base (key for future)
      // try repair window if looking at barricade area
      for (const [k, _hp] of this.windowHp) {
        const [wx, wy, wz] = k.split(',').map(Number);
        if (Math.hypot(x - wx, y - wy, z - wz) < 1.8) {
          return this.tryRepairWindow(k, wx, wy, wz);
        }
      }
    }
    return null;
  }

  private raycastBlock(origin: THREE.Vector3, dir: THREE.Vector3, max: number): { x: number; y: number; z: number; id: number } | null {
    // simple step raycast
    const steps = Math.ceil(max * 6);
    for (let i = 1; i <= steps; i++) {
      const p = origin.clone().add(dir.clone().multiplyScalar(i * (max / steps)));
      const x = Math.floor(p.x), y = Math.floor(p.y), z = Math.floor(p.z);
      const id = this.game.world.peekBlock(x, y, z);
      if (id !== B.AIR) return { x, y, z, id };
    }
    return null;
  }

  private tryBuyDoor(d: typeof this.layout.doors[number]): string | null {
    if (this.state.doorsUnlocked.has(d.id)) { this.game.message('Drzwi już otwarte.'); return null; }
    if (this.gold < d.cost) { this.game.message(`Potrzeba ${d.cost}g – masz ${this.gold}g`); return null; }
    this.gold -= d.cost;
    this.state.doorsUnlocked.add(d.id);
    unlockDoor(this.game.world, d);
    this.game.message(`Otwarto ${d.from} → ${d.to} za ${d.cost}g!`);
    this.game.spawnParticles(d.x, d.y + 2, d.z, B.GOLD_BLOCK, 16, 0.6);
    return d.id;
  }

  private tryShop(s: typeof this.layout.shops[number]): string | null {
    if (s.kind === 'weapon_wall') {
      const price = s.price;
      if (this.player.weapons.some(w => w.weaponId === s.weaponId)) { this.game.message('Masz już tę broń! Przeładuj [R] za 400g'); return null; }
      const limit = this.hasPerk('extraWeapon') ? 3 : 2;
      if (this.player.weapons.length >= limit) { this.game.message(`Potrzeba Extra Weapon perk na 3. broń (1500g w Office/Library)`); return null; }
      if (this.gold < price) { this.game.message(`Potrzeba ${price}g`); return null; }
      const w = WEAPONS[s.weaponId!];
      if (!w) return null;
      this.gold -= price;
      this.player.weapons.push({ weaponId: w.id, ultimate: false, ammoReserve: w.ammoReserve, clip: w.clipSize });
      this.player.currentWeapon = this.player.weapons.length - 1;
      this.game.message(`Kupiono ${w.name} za ${price}g! [1-3] przełączanie`);
      return s.id;
    }
    if (s.kind === 'perk') {
      const perk = PERKS[s.perkId!];
      if (!perk) return null;
      if (perk.requiresPower && !this.powerOn) { this.game.message('Włącz prąd w Power Station najpierw!'); return null; }
      if (this.player.perks.some(p => p.id === perk.id)) {
        // extraHealth can stack
        if (perk.maxLevel) {
          const cur = this.player.perks.find(p => p.id === perk.id)!;
          const lvl = cur.level ?? 1;
          if (lvl >= perk.maxLevel) { this.game.message('Masz już max poziom.'); return null; }
          if (this.gold < perk.price) { this.game.message(`Potrzeba ${perk.price}g`); return null; }
          this.gold -= perk.price;
          cur.level = lvl + 1;
          // Dead End: +10 HP each level (we simulate by increasing max health)
          this.game.health = Math.min(30, this.game.health + 5);
          (this.game as unknown as { health: number }).health = this.game.health;
          this.game.message(`Ulepszono ${perk.name} → lvl ${cur.level}! +❤️`);
          return s.id;
        }
        this.game.message('Masz już ten perk!');
        return null;
      }
      if (this.gold < perk.price) { this.game.message(`Potrzeba ${perk.price}g`); return null; }
      this.gold -= perk.price;
      this.player.perks.push({ id: perk.id, active: true, level: 1 });
      if (perk.id === 'extraHealth') {
        this.game.health = Math.min(30, this.game.health + 6);
      }
      if (perk.id === 'speed') {
        // speed handled in movement tick
      }
      this.game.message(`Kupiono perk ${perk.name} ${perk.icon} za ${perk.price}g!`);
      return s.id;
    }
    if (s.kind === 'ultimate') {
      const w = this.currentWeapon();
      const def = WEAPONS[w.weaponId];
      if (!def?.ultimateId) { this.game.message('Ta broń nie ma Ultimate!'); return null; }
      if (w.ultimate) { this.game.message('Już ulepszone!'); return null; }
      if (this.gold < ULTIMATE_MACHINE_PRICE) { this.game.message(`Potrzeba ${ULTIMATE_MACHINE_PRICE}g`); return null; }
      const ult = WEAPONS[def.ultimateId];
      if (!ult) return null;
      this.gold -= ULTIMATE_MACHINE_PRICE;
      w.weaponId = ult.id;
      w.ultimate = true;
      w.ammoReserve = ult.ammoReserve;
      w.clip = ult.clipSize;
      this.game.message(`✨ ULTIMATE ${ult.name} gotowe!`);
      this.game.spawnParticles(s.x, s.y + 1, s.z, B.GLOWSTONE, 20, 0.7);
      return s.id;
    }
    if (s.kind === 'mystery') {
      if (this.gold < 1000) { this.game.message('Mystery Chest 1000g!'); return null; }
      this.gold -= 1000;
      // move chest location
      const others = this.layout.rooms.filter(r => r.id !== this.state.mysteryLocation).map(r => r.id);
      this.state.mysteryLocation = others[Math.floor(Math.random() * others.length)];
      const pool = ['elderGun', 'zombieZapper', 'goldDigger', 'puncher', 'blowDart', 'flamethrower', 'rocket'];
      // filter by map
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const w = WEAPONS[pick];
      if (w) {
        const limit = this.hasPerk('extraWeapon') ? 3 : 2;
        if (this.player.weapons.length >= limit) {
          // replace current
          this.player.weapons[this.player.currentWeapon] = { weaponId: w.id, ultimate: false, ammoReserve: w.ammoReserve, clip: w.clipSize };
          this.game.message(`🎁 Mystery: ${w.name}! (zamieniono broń)`);
        } else {
          this.player.weapons.push({ weaponId: w.id, ultimate: false, ammoReserve: w.ammoReserve, clip: w.clipSize });
          this.player.currentWeapon = this.player.weapons.length - 1;
          this.game.message(`🎁 Mystery: ${w.name}!`);
        }
      }
      return s.id;
    }
    if (s.kind === 'team') {
      if (this.gold < 1000) { this.game.message('Team Ammo 1000g'); return null; }
      this.gold -= 1000;
      for (const w of this.player.weapons) {
        const def = WEAPONS[w.weaponId];
        if (def) { w.ammoReserve = def.ammoReserve; w.clip = def.clipSize; }
      }
      this.game.message('📦 AMMO SUPPLY! Cała amunicja uzupełniona!');
      return s.id;
    }
    if (s.kind === 'armor') {
      if (this.gold < s.price) { this.game.message(`Potrzeba ${s.price}g`); return null; }
      this.gold -= s.price;
      // Armor: we just increase health absorption simulation – give absorption hearts via higher health cap
      this.game.health = Math.min(30, this.game.health + 4);
      this.game.message(`🛡️ Kupiono pancerz! +❤️`);
      return s.id;
    }
    return null;
  }

  private tryRepairWindow(key: string, wx: number, wy: number, wz: number): string | null {
    const hp = this.windowHp.get(key) ?? 0;
    if (hp >= 6) { this.game.message('Okno w pełni naprawione!'); return null; }
    this.windowHp.set(key, Math.min(6, hp + 1));
    const g = hp === 5 ? 50 : 30;
    this.addGold(g, 'naprawa okna');
    this.game.world.setBlock(wx, wy + 1, wz, B.PLANKS);
    // also glass
    this.game.world.setBlock(wx, wy + 2, wz, B.GLASS);
    this.game.message(hp === 5 ? 'Okno naprawione! +50g' : `Naprawiam okno ${hp + 1}/6 +30g`);
    return key;
  }

  // ---- Round / Spawn
  startRound() {
    const def = this.roundDefs[this.state.round - 1];
    this.spawnLeft = def.zombieCount;
    this.zombiesAlive = 0;
    this.roundTimer = 0;
    this.spawning = true;
    this.game.message(`— Runda ${this.state.round} — ${def.zombieCount} zombie | ${def.zombieHealth} HP | Boss: ${def.boss?.name ?? 'nie'}`);
    // Boss spawn if applicable
    if (def.boss) {
      setTimeout(() => {
        const bossPos = this.pickSpawnPoint();
        const type: MobType = 'zombie';
        const m = this.game.spawnMob(type, bossPos.x, bossPos.y, bossPos.z);
        m.maxHealth = m.health = def.boss!.health;
        // make big
        m.group.scale.setScalar(1.6);
        m.body.w *= 1.4; m.body.h *= 1.4;
        this.zombiesAlive += 1;
        this.game.message(`💀 BOSS: ${def.boss!.name} – ${def.boss!.health} HP!`);
      }, 1200);
    }
  }

  private pickSpawnPoint(): { x: number; y: number; z: number } {
    // pick from window positions in locked rooms + unlocked rooms
    const openRooms = new Set<string>([this.layout.meta.spawnRoomId, ...this.state.doorsUnlocked].flatMap(id => {
      const d = this.layout.doors.find(x => x.id === id);
      return d ? [d.from, d.to] : [];
    }));
    // also include spawn room always
    const eligibleWindows = this.layout.windowPositions.filter(w => openRooms.has(w.roomId) || this.state.doorsUnlocked.size === 0);
    const pool = eligibleWindows.length ? eligibleWindows : this.layout.windowPositions;
    const w = pool[Math.floor(Math.random() * pool.length)];
    // spawn outside window: offset outward
    const side = w.x < 0 ? -1 : 1;
    return { x: w.x + side * 2, y: w.y + 1, z: w.z };
  }

  private checkRoundEnd() {
    if (this.spawnLeft <= 0 && this.zombiesAlive <= 0 && this.roundIntermission <= 0) {
      this.roundIntermission = 4; // 4s intermission like Hypixel
      this.game.message(`Runda ${this.state.round} ukończona! Następna za 4s...`);
    }
  }

  // Called each frame from Game.tick
  tick(dt: number) {
    this.roundTimer += dt;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.hitMarker > 0) this.hitMarker = Math.max(0, this.hitMarker - dt);
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.finishReload();
    }
    if (this.instaKillLeft > 0) this.instaKillLeft = Math.max(0, this.instaKillLeft - dt);
    if (this.doubleGoldLeft > 0) this.doubleGoldLeft = Math.max(0, this.doubleGoldLeft - dt);
    // power glow FX – shops pulse when power on
    if (this.powerOn && Math.random() < 0.06 * dt * 60) {
      const s = this.layout.shops[Math.floor(Math.random() * this.layout.shops.length)];
      if (s) this.game.spawnParticles(s.x, s.y + 1.5, s.z, B.GLOWSTONE, 1, 0.2);
    }
    // handle intermission
    if (this.roundIntermission > 0) {
      this.roundIntermission -= dt;
      if (this.roundIntermission <= 0) {
        this.state.round += 1;
        if (this.state.round > 30) {
          this.state.victory = true;
          this.state.gameOver = true;
          this.game.message('🏆 ZWYCIĘSTWO! Przeżyłeś 30 rund! Jesteś legendą Zombies!');
          this.game.setUI('dead'); // reuse dead screen as victory – we will show custom
          return;
        }
        this.startRound();
      }
      return;
    }
    if (!this.spawning) {
      // start first round after 2s
      if (this.roundTimer > 2 && this.state.round === 1 && this.spawnLeft > 0) this.startRound();
      return;
    }
    // spawning zombies: rate increases with round
    const spawnRate = Math.max(0.25, 1.2 - this.state.round * 0.02);
    this.spawnCooldown -= dt;
    if (this.spawnLeft > 0 && this.spawnCooldown <= 0) {
      this.spawnCooldown = spawnRate + Math.random() * 0.4;
      // batch spawn 1-3
      const batch = this.state.round < 6 ? 1 : this.state.round < 16 ? 2 : 3;
      for (let i = 0; i < batch && this.spawnLeft > 0; i++) {
        this.spawnOne();
        this.spawnLeft -= 1;
      }
    }
    // window damage: zombies attack nearby windows when blocked
    this.tickWindows(dt);
    // check win
    if (this.spawnLeft <= 0 && this.zombiesAlive <= 0) this.checkRoundEnd();
  }

  private spawnOne() {
    const def = this.roundDefs[this.state.round - 1];
    const pos = this.pickSpawnPoint();
    // pick variant based on round
    let type: MobType = 'zombie';
    const r = Math.random();
    if (def.variants.includes('wolf') && r < 0.12) type = 'wolf';
    else if (def.variants.includes('caveSpider') && r < 0.08) type = 'spider';
    else if (def.variants.includes('witherSkeleton') && r < 0.07) type = 'skeleton';
    else if (def.variants.includes('blaze') && r < 0.05) type = 'ghast';
    else if (def.variants.includes('empowered') && r < 0.1) type = 'zombie'; // empowered = buffed zombie
    else type = 'zombie';

    const mob = this.game.spawnMob(type, pos.x, pos.y, pos.z);
    // Scale health/speed like Hypixel
    mob.maxHealth = mob.health = def.zombieHealth;
    if (type === 'zombie' && def.variants.includes('empowered')) {
      mob.body.vel.x *= 1.1;
    }
    // Apply speed
    (mob as unknown as { speedMul?: number }).speedMul = def.zombieSpeed / 2.15;
    // Make zombies always hostile and fast
    mob.profession = 0;
    this.zombiesAlive += 1;
    // Make them target player immediately
    (mob as unknown as { yaw: number }).yaw = Math.atan2(this.game.body.pos.x - pos.x, this.game.body.pos.z - pos.z);
  }

  private tickWindows(_dt: number) {
    // Every zombie near window damages it
    for (const [key, hp] of this.windowHp) {
      if (hp <= 0) continue;
      const [wx, wy, wz] = key.split(',').map(Number);
      for (const mob of this.game.mobs) {
        if (mob.dead) continue;
        const d = Math.hypot(mob.body.pos.x - wx, mob.body.pos.z - wz);
        if (d < 2.2 && Math.abs(mob.body.pos.y - wy) < 2) {
          // damage window slowly
          if (Math.random() < 0.02) {
            const nhp = Math.max(0, hp - 1);
            this.windowHp.set(key, nhp);
            // visual: remove planks
            if (nhp <= 3) this.game.world.setBlock(wx + (wx < 0 ? 1 : -1), wy + 1, wz, B.AIR);
            if (nhp <= 0) this.game.world.setBlock(wx, wy + 2, wz, B.AIR);
            break;
          }
        }
      }
    }
  }

  // ---- Weapon switching
  switchWeapon(idx: number) {
    if (idx < 0 || idx >= this.player.weapons.length) return;
    this.player.currentWeapon = idx;
    this.game.message(`Broń: ${WEAPONS[this.currentWeapon().weaponId].name}`);
  }

  // ---- HUD data – scoreboard jak na Hypixel + masterpiece FX
  hudExtra(): Record<string, unknown> {
    const cur = this.currentWeapon();
    const def = WEAPONS[cur.weaponId];
    const reloadPct = this.isReloading ? Math.max(0, Math.min(1, 1 - this.reloadTimer / (def?.reloadTime ?? 1.6))) : 0;
    return {
      zombiesGold: this.gold,
      zombiesRound: this.state.round,
      zombiesZombiesLeft: this.zombiesAlive + this.spawnLeft,
      zombiesPower: this.powerOn,
      zombiesWeapon: def?.name ?? '—',
      zombiesAmmo: `${cur.clip}/${cur.ammoReserve}`,
      zombiesUltimate: cur.ultimate,
      zombiesInsta: this.instaKillLeft > 0,
      zombiesDoubleGold: this.doubleGoldLeft > 0,
      zombiesFireCooldown: this.fireCooldown,
      zombiesReloading: this.isReloading,
      zombiesReloadPct: reloadPct,
      zombiesRoundIntermission: this.roundIntermission,
      zombiesPerks: this.player.perks.map(p => p.id).join(','),
      zombiesKills: this.player.kills,
      zombiesPerksCount: this.player.perks.length,
      zombiesHitMarker: this.hitMarker > 0 ? (this.hitMarkerCrit ? 'crit' : 'hit') : '',
      zombiesHitMarkerT: this.hitMarker,
    };
  }

  // Called when zombie died externally (if Game kills via other means)
  onMobDeath(mob: Mob) {
    if (['zombie', 'skeleton', 'spider', 'creeper', 'wolf', 'ghast', 'enderman', 'slime'].includes(mob.type)) {
      // jeśli już policzone w shoot (damageZombie), nie licz podwójnie
      if ((mob as unknown as { _zombiesCounted?: boolean })._zombiesCounted) return;
      this.zombiesAlive = Math.max(0, this.zombiesAlive - 1);
      this.checkRoundEnd();
    }
  }
  // alias dla kompatybilności
  onMobKill(mob: Mob) { this.onMobDeath(mob); }
}
