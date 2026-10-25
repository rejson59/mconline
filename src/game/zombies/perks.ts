/**
 * Zombies Perks / Machines 1:1 – Hypixel
 */

export interface PerkDef {
  id: string;
  name: string;
  icon: string;
  price: number;
  description: string;
  requiresPower: boolean;
  maxLevel?: number; // Extra Health stacking
  hiddenUntilPower?: boolean;
}

export const PERKS: Record<string, PerkDef> = {
  fastRevive: {
    id: 'fastRevive', name: 'Fast Revive', icon: '💞',
    price: 500, description: 'Rewiw w 0,3s zamiast 1,5s. Must-have w co-op.',
    requiresPower: false,
  },
  quickFire: {
    id: 'quickFire', name: 'Quick Fire', icon: '⚡',
    price: 1000, description: '+25% szybkostrzelności wszystkich broni.',
    requiresPower: true,
  },
  extraHealth: {
    id: 'extraHealth', name: 'Extra Health', icon: '❤️',
    price: 1000, description: '+10 HP (Dead End) / +4 HP (inne). Stackuje się 3× na BB.',
    requiresPower: true, maxLevel: 3,
  },
  extraWeapon: {
    id: 'extraWeapon', name: 'Extra Weapon', icon: '🔫🔫',
    price: 1500, description: 'Trzeci slot na broń.',
    requiresPower: true,
  },
  speed: {
    id: 'speed', name: 'Speed', icon: '🏃',
    price: 500, description: 'Speed I na stałe (do śmierci).',
    requiresPower: true,
  },
  flameBullets: {
    id: 'flameBullets', name: 'Flame Bullets', icon: '🔥',
    price: 750, description: 'Podpala zombie na 3s. Tylko Dead End.',
    requiresPower: true,
  },
  frozenBullets: {
    id: 'frozenBullets', name: 'Frozen Bullets', icon: '❄️',
    price: 1000, description: 'Spowalnia zombie o 25% na chwilę.',
    requiresPower: true,
  },
};

export const TEAM_MACHINE = {
  ammoSupply: { price: 1000, name: 'Ammo Supply', icon: '📦', desc: 'Uzupełnia amunicję wszystkim graczom.' },
  healthBoost: { price: 1500, name: 'Team Heal', icon: '💚', desc: 'Leczy drużynę.' },
};

export const ULTIMATE_MACHINE_PRICE = 1500;

export function perkSlotsFor(map: string): number {
  return map === 'prison' ? 7 : 3; // Prison ma 7 poziomów Extra Health
}
