/**
 * BlockCraft Zombies 1:1 – Hypixel Zombies type definitions
 * Supports 4 maps: Dead End, Bad Blood, Alien Arcadium, Prison
 * Solo + Co-op up to 4 players, rounds 1-30, doors, perks, mystery chest
 */

export type ZombiesMapId = 'deadend' | 'badblood' | 'alienarcadium' | 'prison';

export interface ZombiesMapMeta {
  id: ZombiesMapId;
  name: string;
  subtitle: string;
  maxRounds: number;
  spawnRoomId: string;
  powerRoomId: string | null;
  description: string;
}

export const ZOMBIES_MAPS: Record<ZombiesMapId, ZombiesMapMeta> = {
  deadend: {
    id: 'deadend',
    name: 'Dead End',
    subtitle: 'Klasyk – biurowiec, kino, apartamenty',
    maxRounds: 30,
    spawnRoomId: 'alley',
    powerRoomId: 'powerstation',
    description: 'Najłatwiejsza mapa. Idealna na start – 11 pokoi, Garden z Ultimate Machine.',
  },
  badblood: {
    id: 'badblood',
    name: 'Bad Blood',
    subtitle: 'Pałac wampirów – wilki nocą',
    maxRounds: 30,
    spawnRoomId: 'courtyard',
    powerRoomId: 'greatHall',
    description: 'Mroczny klimat. Wilki zamiast zombie w nocy, Crypt z Rifle.',
  },
  alienarcadium: {
    id: 'alienarcadium',
    name: 'Alien Arcadium',
    subtitle: 'Park rozrywki z kosmitami',
    maxRounds: 30,
    spawnRoomId: 'spawn',
    powerRoomId: 'power',
    description: 'Największa mapa. Teleporty, Rainbow Rifle, Double Barrel.',
  },
  prison: {
    id: 'prison',
    name: 'Prison',
    subtitle: 'Więzienie – najtrudniejsza',
    maxRounds: 30,
    spawnRoomId: 'cells',
    powerRoomId: 'power',
    description: 'Zimny prysznic. Wąskie korytarze, Riot Shield, ciasne okna.',
  },
};

export interface RoomDef {
  id: string;
  name: string;
  // axis-aligned bounds inclusive
  x1: number; z1: number;
  x2: number; z2: number;
  y: number; // floor level
  height: number;
  windows: number; // number of repairable windows
}

export interface DoorDef {
  id: string;
  from: string;
  to: string;
  cost: number;
  // position of trigger (center)
  x: number; y: number; z: number;
  dir: 'x' | 'z';
  locked: boolean;
}

export interface ShopDef {
  id: string;
  roomId: string;
  kind: 'weapon_wall' | 'armor' | 'perk' | 'mystery' | 'ultimate' | 'team';
  weaponId?: string;
  perkId?: string;
  price: number;
  x: number; y: number; z: number;
  // wall orientation
  facing: 'north' | 'south' | 'east' | 'west';
}

export interface ZombiesMapLayout {
  meta: ZombiesMapMeta;
  rooms: RoomDef[];
  doors: DoorDef[];
  shops: ShopDef[];
  spawnPoints: { x: number; y: number; z: number }[];
  windowPositions: { x: number; y: number; z: number; roomId: string }[];
}

export type ZombieVariant =
  | 'normal'
  | 'pigZombie'
  | 'wolf'
  | 'lilBombie'
  | 'caveSpider'
  | 'empowered'
  | 'witherSkeleton'
  | 'blaze'
  | 'herobrine'
  | 'boss';

export interface RoundDef {
  round: number;
  zombieCount: number;
  zombieHealth: number;
  zombieSpeed: number;
  variants: ZombieVariant[];
  boss?: { type: ZombieVariant; health: number; name: string };
  isBossRound: boolean;
}

export interface PerkState {
  id: string;
  active: boolean;
  level?: number; // e.g. Extra Health 1-3
}

export interface WeaponInstance {
  weaponId: string;
  ultimate: boolean;
  level?: number; // Gold Digger I-V
  ammoReserve: number;
  clip: number;
}

export interface PlayerZombiesState {
  gold: number;
  downs: number;
  isDowned: boolean;
  downTimeLeft: number; // seconds until death
  perks: PerkState[];
  weapons: WeaponInstance[]; // max 2, 3 with Extra Weapon
  currentWeapon: number;
  kills: number;
  revives: number;
}

export interface ZombiesGameState {
  mapId: ZombiesMapId;
  round: number;
  waveInRound: number;
  zombiesAlive: number;
  zombiesToSpawn: number;
  powerOn: boolean;
  doorsUnlocked: Set<string>;
  mysteryLocation: string; // roomId where chest is
  gameOver: boolean;
  victory: boolean;
  time: number; // seconds elapsed
  players: Map<string, PlayerZombiesState>;
}
