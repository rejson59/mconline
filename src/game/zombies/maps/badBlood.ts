import type { ZombiesMapLayout } from '../types';
import { ZOMBIES_MAPS } from '../types';

const meta = ZOMBIES_MAPS.badblood;

export const badBloodLayout: ZombiesMapLayout = {
  meta,
  rooms: [
    { id: 'courtyard', name: 'Courtyard – Spawn', x1: -12, z1: -12, x2: 12, z2: 12, y: 64, height: 8, windows: 4 },
    { id: 'mansion', name: 'Mansion', x1: -14, z1: 14, x2: 14, z2: 30, y: 64, height: 8, windows: 4 },
    { id: 'library', name: 'Library', x1: 16, z1: 14, x2: 32, z2: 30, y: 64, height: 7, windows: 6 },
    { id: 'dungeon', name: 'Dungeon', x1: 16, z1: -8, x2: 32, z2: 8, y: 60, height: 6, windows: 5 },
    { id: 'crypt', name: 'Crypt', x1: -2, z1: -20, x2: 12, z2: -6, y: 60, height: 6, windows: 3 },
    { id: 'balcony', name: 'Balcony', x1: -20, z1: 14, x2: -6, z2: 26, y: 68, height: 6, windows: 3 },
    { id: 'greathall', name: 'Great Hall – Power', x1: -14, z1: 32, x2: 14, z2: 46, y: 64, height: 9, windows: 4 },
    { id: 'graveyard', name: 'Graveyard – Ultimate', x1: -22, z1: 32, x2: -6, z2: 48, y: 64, height: 6, windows: 3 },
  ],
  doors: [
    { id: 'courtyard-mansion', from: 'courtyard', to: 'mansion', cost: 500, x: 0, y: 64, z: 13, dir: 'x', locked: true },
    { id: 'mansion-library', from: 'mansion', to: 'library', cost: 750, x: 15, y: 64, z: 22, dir: 'z', locked: true },
    { id: 'mansion-dungeon', from: 'mansion', to: 'dungeon', cost: 750, x: 15, y: 62, z: 0, dir: 'z', locked: true },
    { id: 'dungeon-crypt', from: 'dungeon', to: 'crypt', cost: 750, x: 8, y: 60, z: -7, dir: 'x', locked: true },
    { id: 'mansion-balcony', from: 'mansion', to: 'balcony', cost: 1000, x: -5, y: 66, z: 20, dir: 'z', locked: true },
    { id: 'library-greathall', from: 'library', to: 'greathall', cost: 1250, x: 10, y: 64, z: 31, dir: 'x', locked: true },
    { id: 'mansion-greathall', from: 'mansion', to: 'greathall', cost: 1000, x: 0, y: 64, z: 31, dir: 'x', locked: true },
    { id: 'greathall-graveyard', from: 'greathall', to: 'graveyard', cost: 750, x: -5, y: 64, z: 31, dir: 'z', locked: true },
  ],
  shops: [
    { id: 's-fastRevive', roomId: 'courtyard', kind: 'perk', perkId: 'fastRevive', price: 500, x: -10, y: 64, z: 0, facing: 'east' },
    { id: 's-shotgun', roomId: 'library', kind: 'weapon_wall', weaponId: 'shotgun', price: 500, x: 30, y: 64, z: 20, facing: 'west' },
    { id: 's-extraWeapon', roomId: 'library', kind: 'perk', perkId: 'extraWeapon', price: 1500, x: 18, y: 64, z: 28, facing: 'north' },
    { id: 's-rifle', roomId: 'crypt', kind: 'weapon_wall', weaponId: 'rifle', price: 500, x: 10, y: 60, z: -10, facing: 'west' },
    { id: 's-sniper', roomId: 'dungeon', kind: 'weapon_wall', weaponId: 'sniper', price: 700, x: 30, y: 60, z: 0, facing: 'west' },
    { id: 's-extraHealth', roomId: 'dungeon', kind: 'perk', perkId: 'extraHealth', price: 1000, x: 20, y: 60, z: 6, facing: 'south' },
    { id: 's-frozen', roomId: 'balcony', kind: 'perk', perkId: 'frozenBullets', price: 1000, x: -12, y: 68, z: 22, facing: 'east' },
    { id: 's-speed', roomId: 'balcony', kind: 'perk', perkId: 'speed', price: 500, x: -18, y: 68, z: 20, facing: 'east' },
    { id: 's-quickFire', roomId: 'greathall', kind: 'perk', perkId: 'quickFire', price: 1000, x: 0, y: 64, z: 44, facing: 'north' },
    { id: 's-team', roomId: 'greathall', kind: 'team', price: 1000, x: 12, y: 64, z: 40, facing: 'west' },
    { id: 's-ultimate', roomId: 'graveyard', kind: 'ultimate', price: 1500, x: -14, y: 64, z: 46, facing: 'north' },
  ],
  spawnPoints: [
    { x: 0, y: 65, z: 0 },
    { x: -6, y: 65, z: 6 },
    { x: 6, y: 65, z: -6 },
    { x: 0, y: 65, z: -8 },
  ],
  windowPositions: [
    { x: -12, y: 65, z: 0, roomId: 'courtyard' },
    { x: 12, y: 65, z: 0, roomId: 'courtyard' },
    { x: 0, y: 65, z: -12, roomId: 'courtyard' },
    { x: 0, y: 65, z: 12, roomId: 'courtyard' },
  ],
};
