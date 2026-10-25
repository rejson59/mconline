import type { ZombiesMapLayout } from '../types';
import { ZOMBIES_MAPS } from '../types';
const meta = ZOMBIES_MAPS.prison;
export const prisonLayout: ZombiesMapLayout = {
  meta,
  rooms: [
    { id: 'cells', name: 'Cells – Spawn', x1: -10, z1: -10, x2: 10, z2: 10, y: 64, height: 6, windows: 3 },
    { id: 'cafeteria', name: 'Cafeteria', x1: -12, z1: 12, x2: 12, z2: 24, y: 64, height: 6, windows: 4 },
    { id: 'yard', name: 'Yard', x1: 14, z1: -10, x2: 30, z2: 10, y: 64, height: 7, windows: 5 },
    { id: 'power', name: 'Power – Control', x1: -12, z1: 26, x2: 12, z2: 38, y: 64, height: 7, windows: 4 },
    { id: 'alleyPrison', name: 'Alley', x1: 14, z1: 12, x2: 28, z2: 24, y: 64, height: 6, windows: 3 },
    { id: 'roofPrison', name: 'Rooftop', x1: -12, z1: 40, x2: 12, z2: 52, y: 70, height: 6, windows: 3 },
  ],
  doors: [
    { id: 'cells-cafeteria', from: 'cells', to: 'cafeteria', cost: 500, x: 0, y: 64, z: 11, dir: 'x', locked: true },
    { id: 'cells-yard', from: 'cells', to: 'yard', cost: 750, x: 11, y: 64, z: 0, dir: 'z', locked: true },
    { id: 'cafeteria-power', from: 'cafeteria', to: 'power', cost: 1000, x: 0, y: 64, z: 25, dir: 'x', locked: true },
    { id: 'yard-alley', from: 'yard', to: 'alleyPrison', cost: 750, x: 22, y: 64, z: 11, dir: 'x', locked: true },
    { id: 'power-roof', from: 'power', to: 'roofPrison', cost: 1250, x: 0, y: 66, z: 39, dir: 'x', locked: true },
  ],
  shops: [
    { id: 's-shotgunP', roomId: 'cafeteria', kind: 'weapon_wall', weaponId: 'shotgun', price: 500, x: 10, y: 64, z: 20, facing: 'west' },
    { id: 's-sniperP', roomId: 'yard', kind: 'weapon_wall', weaponId: 'sniper', price: 700, x: 28, y: 64, z: 0, facing: 'west' },
    { id: 's-doubleP', roomId: 'alleyPrison', kind: 'weapon_wall', weaponId: 'doubleBarrel', price: 800, x: 26, y: 64, z: 18, facing: 'west' },
    { id: 's-quickFireP', roomId: 'power', kind: 'perk', perkId: 'quickFire', price: 1000, x: 10, y: 64, z: 34, facing: 'west' },
    { id: 's-extraHealthP', roomId: 'power', kind: 'perk', perkId: 'extraHealth', price: 1000, x: -10, y: 64, z: 34, facing: 'east' },
    { id: 's-teamP', roomId: 'roofPrison', kind: 'team', price: 1000, x: 0, y: 70, z: 50, facing: 'north' },
    { id: 's-ultimateP', roomId: 'roofPrison', kind: 'ultimate', price: 1500, x: 10, y: 70, z: 50, facing: 'north' },
  ],
  spawnPoints: [{ x: 0, y: 65, z: 0 }],
  windowPositions: [{ x: -10, y: 65, z: 0, roomId: 'cells' }],
};
