/**
 * Zombies Engine Logic – pure state (no THREE) so it's testable
 * Handles rounds, economy, doors, perks, mystery chest, weapon upgrades
 */
import type { ZombiesMapId, ZombiesGameState, ZombiesMapLayout } from './types';
import { WEAPONS } from './weapons';
import { PERKS } from './perks';
import { buildRounds, goldOnKill, goldOnHit, goldOnWindowRepair, goldOnWindowBonus } from './roundConfig';

export interface ZombiesOpts {
  mapId: ZombiesMapId;
  players?: string[]; // player ids
}

export function createInitialZombiesState(opts: ZombiesOpts, layout: ZombiesMapLayout): ZombiesGameState {
  const players = new Map<string, import('./types').PlayerZombiesState>();
  const ids = opts.players?.length ? opts.players : ['local'];
  for (const id of ids) {
    players.set(id, {
      gold: 500,
      downs: 0,
      isDowned: false,
      downTimeLeft: 0,
      perks: [],
      weapons: [{ weaponId: 'pistol', ultimate: false, ammoReserve: WEAPONS.pistol.ammoReserve, clip: WEAPONS.pistol.clipSize }],
      currentWeapon: 0,
      kills: 0,
      revives: 0,
    });
  }
  // random mystery start in non-spawn room
  const eligible = layout.rooms.filter(r => r.id !== layout.meta.spawnRoomId).map(r => r.id);
  const mystery = eligible[Math.floor(Math.random() * eligible.length)] ?? layout.rooms[0].id;
  return {
    mapId: opts.mapId,
    round: 1,
    waveInRound: 0,
    zombiesAlive: 0,
    zombiesToSpawn: 0,
    powerOn: false,
    doorsUnlocked: new Set<string>(),
    mysteryLocation: mystery,
    gameOver: false,
    victory: false,
    time: 0,
    players,
  };
}

export function startRound(state: ZombiesGameState): ZombiesGameState {
  const rounds = buildRounds(30, state.mapId);
  const def = rounds[state.round - 1];
  state.zombiesToSpawn = def.zombieCount;
  state.zombiesAlive = 0;
  state.waveInRound = 0;
  return state;
}

export function onZombieKilled(state: ZombiesGameState, playerId: string, _isCrit: boolean, _weaponId: string): void {
  const p = state.players.get(playerId);
  if (!p) return;
  // gold per hit already added on damage; kill bonus
  p.gold += goldOnKill(state.round);
  p.kills += 1;
  // Double gold powerup would double here
}

export function onZombieHit(state: ZombiesGameState, playerId: string, isCrit: boolean, weaponId: string): number {
  const p = state.players.get(playerId);
  if (!p) return 0;
  const w = WEAPONS[weaponId] ?? WEAPONS.pistol;
  const g = goldOnHit(isCrit, isCrit ? w.goldPerCrit : w.goldPerHit);
  p.gold += g;
  return g;
}

export function canBuyDoor(state: ZombiesGameState, playerId: string, cost: number): boolean {
  const p = state.players.get(playerId);
  return !!p && p.gold >= cost && !p.isDowned;
}

export function buyDoor(state: ZombiesGameState, playerId: string, doorId: string, cost: number): boolean {
  const p = state.players.get(playerId);
  if (!p || p.gold < cost) return false;
  p.gold -= cost;
  state.doorsUnlocked.add(doorId);
  return true;
}

export function canBuyPerk(state: ZombiesGameState, playerId: string, perkId: string): boolean {
  const p = state.players.get(playerId);
  const def = PERKS[perkId];
  if (!p || !def) return false;
  if (def.requiresPower && !state.powerOn) return false;
  if (p.isDowned) return false;
  if (p.perks.some(x => x.id === perkId)) {
    const cur = p.perks.find(x => x.id === perkId)!;
    if (def.maxLevel && (cur.level ?? 1) >= def.maxLevel) return false;
  }
  return p.gold >= def.price;
}

export function buyPerk(state: ZombiesGameState, playerId: string, perkId: string): boolean {
  const p = state.players.get(playerId);
  const def = PERKS[perkId];
  if (!p || !def || p.gold < def.price) return false;
  if (def.requiresPower && !state.powerOn) return false;
  const existing = p.perks.find(x => x.id === perkId);
  if (existing && def.maxLevel) {
    if ((existing.level ?? 1) >= def.maxLevel) return false;
    existing.level = (existing.level ?? 1) + 1;
  } else if (!existing) {
    p.perks.push({ id: perkId, active: true, level: 1 });
  } else return false;
  p.gold -= def.price;
  return true;
}

export function canBuyWeapon(state: ZombiesGameState, playerId: string, weaponId: string): boolean {
  const p = state.players.get(playerId);
  const w = WEAPONS[weaponId];
  if (!p || !w) return false;
  if (p.weapons.some(x => x.weaponId === weaponId)) return false; // already have
  const hasExtra = p.perks.some(x => x.id === 'extraWeapon');
  const limit = hasExtra ? 3 : 2;
  if (p.weapons.length >= limit) return false;
  return p.gold >= 500;
}

export function buyWeapon(state: ZombiesGameState, playerId: string, weaponId: string, price: number): boolean {
  const p = state.players.get(playerId);
  const w = WEAPONS[weaponId];
  if (!p || !w || p.gold < price) return false;
  const hasExtra = p.perks.some(x => x.id === 'extraWeapon');
  const limit = hasExtra ? 3 : 2;
  if (p.weapons.length >= limit) return false;
  p.gold -= price;
  p.weapons.push({ weaponId, ultimate: false, ammoReserve: w.ammoReserve, clip: w.clipSize });
  // auto-switch to new weapon
  p.currentWeapon = p.weapons.length - 1;
  return true;
}

export function rollMysteryChest(state: ZombiesGameState, playerId: string): string | null {
  const p = state.players.get(playerId);
  if (!p || p.gold < 1000) return null;
  p.gold -= 1000;
  const pool = ['elderGun', 'zombieZapper', 'goldDigger', 'puncher', 'blowDart', 'shotgun', 'sniper'];
  const pick = pool[Math.floor(Math.random() * pool.length)];
  // replace or add
  const w = WEAPONS[pick];
  if (!w) return null;
  // move mystery location
  return pick;
}

export function upgradeWeapon(state: ZombiesGameState, playerId: string, weaponIdx: number): boolean {
  const p = state.players.get(playerId);
  if (!p) return false;
  const inst = p.weapons[weaponIdx];
  if (!inst || inst.ultimate) return false;
  const w = WEAPONS[inst.weaponId];
  if (!w?.ultimateId) return false;
  if (p.gold < 1500) return false;
  p.gold -= 1500;
  const ult = WEAPONS[w.ultimateId];
  if (!ult) return false;
  inst.weaponId = ult.id;
  inst.ultimate = true;
  inst.ammoReserve = ult.ammoReserve;
  inst.clip = ult.clipSize;
  return true;
}

export function ammoSupply(state: ZombiesGameState, buyerId: string): boolean {
  const p = state.players.get(buyerId);
  if (!p || p.gold < 1000) return false;
  p.gold -= 1000;
  for (const [, pl] of state.players) {
    for (const w of pl.weapons) {
      const def = WEAPONS[w.weaponId];
      if (def) { w.ammoReserve = def.ammoReserve; w.clip = def.clipSize; }
    }
  }
  return true;
}

export function onWindowRepair(state: ZombiesGameState, playerId: string, fullyRepaired: boolean): number {
  const p = state.players.get(playerId);
  if (!p) return 0;
  const g = fullyRepaired ? goldOnWindowBonus() : goldOnWindowRepair();
  p.gold += g;
  return g;
}

export function setPower(state: ZombiesGameState, on: boolean) {
  state.powerOn = on;
}

export function nextRound(state: ZombiesGameState) {
  if (state.round >= 30) {
    state.victory = true;
    state.gameOver = true;
    return;
  }
  state.round += 1;
  startRound(state);
}

export function onPlayerDown(state: ZombiesGameState, playerId: string) {
  const p = state.players.get(playerId);
  if (!p) return;
  (p as unknown as { isDowned: boolean; downTimeLeft: number; downs: number; perks: unknown[] }).isDowned = true;
  p.downTimeLeft = 12; // seconds to revive, hypixel ~20? we use 12 for solo
  p.downs += 1;
  // lose perks except ultimate weapons keep
  // Hypixel: perks lost on death, ultimates kept
  p.perks = [];
}

export function onPlayerRevive(state: ZombiesGameState, targetId: string, reviverId: string, _fast: boolean) {
  const t = state.players.get(targetId);
  const r = state.players.get(reviverId);
  if (!t || !r || !t.isDowned) return false;
  t.isDowned = false;
  t.downTimeLeft = 0;
  r.revives += 1;
  // revived with half health handled by engine
  return true;
}

export function getAlivePlayers(state: ZombiesGameState): string[] {
  return [...state.players.entries()].filter(([, p]) => !p.isDowned).map(([id]) => id);
}

export function isGameOver(state: ZombiesGameState): boolean {
  // all downed
  for (const [, p] of state.players) if (!p.isDowned) return false;
  return true;
}
