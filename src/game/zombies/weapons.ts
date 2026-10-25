/**
 * Zombies Weapons 1:1 – Hypixel stats
 * Wall weapons + Mystery Chest + Ultimate upgrades
 * Damage in HP (1 heart = 2 HP, player has 20 HP)
 */

export interface WeaponDef {
  id: string;
  name: string;
  // display
  icon: string; // emoji / text for HUD
  itemModel: 'hoe' | 'shovel' | 'pickaxe' | 'shears' | 'flint';
  // stats
  damage: number; // per bullet/pellet
  pellets?: number; // shotgun = 10
  ammoReserve: number;
  clipSize: number;
  fireRate: number; // seconds between shots
  reloadTime: number;
  goldPerHit: number;
  goldPerCrit: number;
  piercing?: number; // how many zombies can pierce
  aoe?: number; // explosion radius
  // availability
  source: 'starter' | 'wall' | 'mystery';
  map?: string[]; // null = all
  // ultimate counterpart
  ultimateId?: string;
}

export const WEAPONS: Record<string, WeaponDef> = {
  pistol: {
    id: 'pistol', name: 'Pistol', icon: '🔫', itemModel: 'hoe',
    damage: 6, ammoReserve: 300, clipSize: 10, fireRate: 0.5, reloadTime: 1.5,
    goldPerHit: 10, goldPerCrit: 15, source: 'starter', ultimateId: 'pistol_ult',
  },
  pistol_ult: {
    id: 'pistol_ult', name: 'Ultimate Pistol', icon: '🔫✨', itemModel: 'hoe',
    damage: 6, ammoReserve: 450, clipSize: 14, fireRate: 0.4, reloadTime: 1.0,
    goldPerHit: 10, goldPerCrit: 15, source: 'mystery', piercing: 1,
  },
  rifle: {
    id: 'rifle', name: 'Rifle', icon: '🎯', itemModel: 'hoe',
    damage: 6, ammoReserve: 288, clipSize: 32, fireRate: 0.2, reloadTime: 1.5,
    goldPerHit: 7, goldPerCrit: 10, source: 'wall', ultimateId: 'rifle_ult',
  },
  rifle_ult: {
    id: 'rifle_ult', name: 'Ultimate Rifle', icon: '🎯✨', itemModel: 'hoe',
    damage: 8, ammoReserve: 320, clipSize: 35, fireRate: 0.2, reloadTime: 1.0,
    goldPerHit: 7, goldPerCrit: 10, source: 'mystery',
  },
  shotgun: {
    id: 'shotgun', name: 'Shotgun', icon: '💥', itemModel: 'hoe',
    damage: 4.5, pellets: 10, ammoReserve: 65, clipSize: 5, fireRate: 1.4, reloadTime: 1.5,
    goldPerHit: 8, goldPerCrit: 12, source: 'wall', ultimateId: 'shotgun_ult',
  },
  shotgun_ult: {
    id: 'shotgun_ult', name: 'Ultimate Shotgun', icon: '💥✨', itemModel: 'hoe',
    damage: 4.5, pellets: 10, ammoReserve: 80, clipSize: 5, fireRate: 1.0, reloadTime: 1.0,
    goldPerHit: 8, goldPerCrit: 12, source: 'mystery',
  },
  sniper: {
    id: 'sniper', name: 'Sniper', icon: '🎯🔭', itemModel: 'shovel',
    damage: 20, ammoReserve: 40, clipSize: 4, fireRate: 1.5, reloadTime: 2.0,
    goldPerHit: 30, goldPerCrit: 45, piercing: 2, source: 'wall', ultimateId: 'sniper_ult',
  },
  sniper_ult: {
    id: 'sniper_ult', name: 'Ultimate Sniper', icon: '🎯🔭✨', itemModel: 'shovel',
    damage: 30, ammoReserve: 60, clipSize: 5, fireRate: 1.5, reloadTime: 1.0,
    goldPerHit: 30, goldPerCrit: 45, piercing: 4, source: 'mystery',
  },
  rocket: {
    id: 'rocket', name: 'Rocket Launcher', icon: '🚀', itemModel: 'shovel',
    damage: 15, ammoReserve: 20, clipSize: 4, fireRate: 2.0, reloadTime: 3.0,
    goldPerHit: 20, goldPerCrit: 30, aoe: 4, source: 'mystery', ultimateId: 'rocket_ult',
  },
  rocket_ult: {
    id: 'rocket_ult', name: 'Ultimate Rocket Launcher', icon: '🚀✨', itemModel: 'shovel',
    damage: 20, ammoReserve: 32, clipSize: 4, fireRate: 1.5, reloadTime: 2.0,
    goldPerHit: 20, goldPerCrit: 30, aoe: 5, source: 'mystery',
  },
  // Mystery chest exclusives
  elderGun: {
    id: 'elderGun', name: 'Elder Gun', icon: '🔮', itemModel: 'shears',
    damage: 15, ammoReserve: 60, clipSize: 4, fireRate: 0.9, reloadTime: 2.0,
    goldPerHit: 20, goldPerCrit: 30, piercing: 99, source: 'mystery', ultimateId: 'elderGun_ult',
  },
  elderGun_ult: {
    id: 'elderGun_ult', name: 'Ultimate Elder Gun', icon: '🔮✨', itemModel: 'shears',
    damage: 20, ammoReserve: 100, clipSize: 4, fireRate: 0.8, reloadTime: 2.0,
    goldPerHit: 20, goldPerCrit: 30, piercing: 99, source: 'mystery',
  },
  zombieZapper: {
    id: 'zombieZapper', name: 'Zombie Zapper', icon: '⚡', itemModel: 'pickaxe',
    damage: 12, ammoReserve: 100, clipSize: 10, fireRate: 0.5, reloadTime: 2.0,
    goldPerHit: 15, goldPerCrit: 20, source: 'mystery', ultimateId: 'zombieZapper_ult',
  },
  zombieZapper_ult: {
    id: 'zombieZapper_ult', name: 'Ultimate Zombie Zapper', icon: '⚡✨', itemModel: 'pickaxe',
    damage: 18, ammoReserve: 120, clipSize: 10, fireRate: 0.5, reloadTime: 1.5,
    goldPerHit: 15, goldPerCrit: 20, source: 'mystery',
  },
  goldDigger: {
    id: 'goldDigger', name: 'Gold Digger', icon: '⛏️💰', itemModel: 'pickaxe',
    damage: 6, ammoReserve: 70, clipSize: 7, fireRate: 0.5, reloadTime: 1.5,
    goldPerHit: 10, goldPerCrit: 15, source: 'mystery', ultimateId: 'goldDigger_ult',
  },
  // Gold Digger has 5 ultimate levels
  goldDigger_ult: {
    id: 'goldDigger_ult', name: 'Gold Digger V', icon: '⛏️💰✨', itemModel: 'pickaxe',
    damage: 20, ammoReserve: 250, clipSize: 25, fireRate: 0.2, reloadTime: 1.0,
    goldPerHit: 10, goldPerCrit: 15, source: 'mystery',
  },
  puncher: {
    id: 'puncher', name: 'The Puncher', icon: '👊', itemModel: 'hoe',
    damage: 6, ammoReserve: 9999, clipSize: 9999, fireRate: 0.5, reloadTime: 0,
    goldPerHit: 10, goldPerCrit: 10, aoe: 3, source: 'mystery', ultimateId: 'puncher_ult',
  },
  puncher_ult: {
    id: 'puncher_ult', name: 'Upgraded Puncher', icon: '👊✨', itemModel: 'hoe',
    damage: 6, ammoReserve: 9999, clipSize: 9999, fireRate: 0.5, reloadTime: 0,
    goldPerHit: 10, goldPerCrit: 10, aoe: 5, source: 'mystery',
  },
  flamethrower: {
    id: 'flamethrower', name: 'Flamethrower', icon: '🔥', itemModel: 'hoe',
    damage: 1.5, ammoReserve: 300, clipSize: 30, fireRate: 0.1, reloadTime: 2.0,
    goldPerHit: 4, goldPerCrit: 6, source: 'mystery', ultimateId: 'flamethrower_ult',
  },
  flamethrower_ult: {
    id: 'flamethrower_ult', name: 'Ultimate Flamethrower', icon: '🔥✨', itemModel: 'hoe',
    damage: 2, ammoReserve: 500, clipSize: 50, fireRate: 0.1, reloadTime: 1.8,
    goldPerHit: 4, goldPerCrit: 6, source: 'mystery',
  },
  blowDart: {
    id: 'blowDart', name: 'Blow Dart', icon: '🎯💨', itemModel: 'shovel',
    damage: 10, ammoReserve: 100, clipSize: 10, fireRate: 0.5, reloadTime: 3.0,
    goldPerHit: 20, goldPerCrit: 30, source: 'mystery', ultimateId: 'blowDart_ult',
  },
  blowDart_ult: {
    id: 'blowDart_ult', name: 'Ultimate Blow Dart', icon: '🎯💨✨', itemModel: 'shovel',
    damage: 10, ammoReserve: 150, clipSize: 10, fireRate: 0.3, reloadTime: 1.8,
    goldPerHit: 20, goldPerCrit: 30, source: 'mystery',
  },
  // Map exclusives
  rainbowRifle: {
    id: 'rainbowRifle', name: 'Rainbow Rifle', icon: '🌈', itemModel: 'shovel',
    damage: 5, ammoReserve: 240, clipSize: 30, fireRate: 0.4, reloadTime: 1.5,
    goldPerHit: 5, goldPerCrit: 7, source: 'mystery', map: ['alienarcadium'],
    ultimateId: 'rainbowRifle_ult',
  },
  rainbowRifle_ult: {
    id: 'rainbowRifle_ult', name: 'Ultimate Rainbow Rifle', icon: '🌈✨', itemModel: 'shovel',
    damage: 7, ammoReserve: 336, clipSize: 42, fireRate: 0.3, reloadTime: 1.0,
    goldPerHit: 5, goldPerCrit: 7, source: 'mystery',
  },
  doubleBarrel: {
    id: 'doubleBarrel', name: 'Double Barrel Shotgun', icon: '💥💥', itemModel: 'flint',
    damage: 7, pellets: 9, ammoReserve: 20, clipSize: 2, fireRate: 0.3, reloadTime: 3.0,
    goldPerHit: 8, goldPerCrit: 12, source: 'mystery', map: ['alienarcadium', 'prison'],
    ultimateId: 'doubleBarrel_ult',
  },
  doubleBarrel_ult: {
    id: 'doubleBarrel_ult', name: 'Ultimate Double Barrel', icon: '💥💥✨', itemModel: 'flint',
    damage: 9, ammoReserve: 40, clipSize: 4, fireRate: 0.3, reloadTime: 2.0,
    goldPerHit: 8, goldPerCrit: 12, source: 'mystery',
  },
};

export const STARTER_WEAPONS: string[] = ['pistol'];

export const WALL_WEAPONS_BY_MAP: Record<string, string[]> = {
  deadend: ['shotgun', 'rifle', 'sniper'],
  badblood: ['shotgun', 'rifle', 'sniper'],
  alienarcadium: ['shotgun', 'sniper', 'flamethrower'],
  prison: ['shotgun', 'sniper', 'doubleBarrel'],
};

export const MYSTERY_POOL: string[] = [
  'elderGun', 'zombieZapper', 'goldDigger', 'puncher', 'blowDart',
  'rocket', 'flamethrower',
];

export const MYSTERY_POOL_ALIEN: string[] = [
  ...MYSTERY_POOL, 'rainbowRifle', 'doubleBarrel',
];

export function getWeapon(id: string): WeaponDef | undefined {
  return WEAPONS[id];
}

export function isUltimate(id: string): boolean {
  return id.endsWith('_ult');
}

export function wallWeaponPrice(id: string): number {
  const w = WEAPONS[id];
  if (!w) return 500;
  if (w.id === 'shotgun') return 500;
  if (w.id === 'rifle') return 500;
  if (w.id === 'sniper') return 700;
  return 750;
}
