import type { ZombiesMapLayout } from '../types';
import { ZOMBIES_MAPS } from '../types';
const meta = ZOMBIES_MAPS.alienarcadium;
export const alienArcadiumLayout: ZombiesMapLayout = {
  meta,
  rooms: [
    { id: 'spawn', name: 'Spawn – Entrance', x1: -10, z1: -10, x2: 10, z2: 10, y: 64, height: 7, windows: 4 },
    { id: 'arcade', name: 'Arcade Hall', x1: -12, z1: 12, x2: 12, z2: 28, y: 64, height: 7, windows: 4 },
    { id: 'roller', name: 'Roller Coaster', x1: 14, z1: 12, x2: 30, z2: 28, y: 64, height: 8, windows: 5 },
    { id: 'power', name: 'Power – UFO', x1: -12, z1: 30, x2: 12, z2: 44, y: 64, height: 8, windows: 4 },
    { id: 'kitchen', name: 'Kitchen', x1: -28, z1: 12, x2: -14, z2: 26, y: 64, height: 6, windows: 3 },
    { id: 'gardenAA', name: 'Garden AA', x1: -10, z1: 46, x2: 10, z2: 60, y: 64, height: 6, windows: 3 },
    { id: 'rooftopAA', name: 'Rooftop AA', x1: 14, z1: 30, x2: 30, z2: 44, y: 68, height: 6, windows: 4 },
  ],
  doors: [
    { id: 'spawn-arcade', from: 'spawn', to: 'arcade', cost: 500, x: 0, y: 64, z: 11, dir: 'x', locked: true },
    { id: 'arcade-roller', from: 'arcade', to: 'roller', cost: 750, x: 13, y: 64, z: 20, dir: 'z', locked: true },
    { id: 'arcade-power', from: 'arcade', to: 'power', cost: 1000, x: 0, y: 64, z: 29, dir: 'x', locked: true },
    { id: 'arcade-kitchen', from: 'arcade', to: 'kitchen', cost: 750, x: -13, y: 64, z: 20, dir: 'z', locked: true },
    { id: 'power-garden', from: 'power', to: 'gardenAA', cost: 1000, x: 0, y: 64, z: 45, dir: 'x', locked: true },
    { id: 'roller-rooftop', from: 'roller', to: 'rooftopAA', cost: 1000, x: 22, y: 64, z: 29, dir: 'x', locked: true },
  ],
  shops: [
    { id: 's-shotgunAA', roomId: 'arcade', kind: 'weapon_wall', weaponId: 'shotgun', price: 500, x: 10, y: 64, z: 22, facing: 'west' },
    { id: 's-sniperAA', roomId: 'roller', kind: 'weapon_wall', weaponId: 'sniper', price: 900, x: 28, y: 64, z: 20, facing: 'west' },
    { id: 's-rainbow', roomId: 'rooftopAA', kind: 'weapon_wall', weaponId: 'rainbowRifle', price: 800, x: 28, y: 68, z: 38, facing: 'west' },
    { id: 's-quickFireAA', roomId: 'power', kind: 'perk', perkId: 'quickFire', price: 1000, x: 10, y: 64, z: 40, facing: 'west' },
    { id: 's-extraHealthAA', roomId: 'power', kind: 'perk', perkId: 'extraHealth', price: 1000, x: -10, y: 64, z: 40, facing: 'east' },
    { id: 's-teamAA', roomId: 'power', kind: 'team', price: 1000, x: 0, y: 64, z: 42, facing: 'north' },
    { id: 's-ultimateAA', roomId: 'gardenAA', kind: 'ultimate', price: 1500, x: 0, y: 64, z: 58, facing: 'north' },
  ],
  spawnPoints: [{ x: 0, y: 65, z: 0 }, { x: 5, y: 65, z: 5 }],
  windowPositions: [{ x: -10, y: 65, z: 0, roomId: 'spawn' }],
};
