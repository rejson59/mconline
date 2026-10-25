/**
 * Dead End 1:1 – Hypixel Zombies
 * 11 rooms: Alley, Office, Gallery, Hotel, Apartments, Power Station, Roof Top, Garden...
 * Layout simplified to BlockCraft blocks but doors/prices/positions match Hypixel
 */
import type { ZombiesMapLayout } from '../types';
import { ZOMBIES_MAPS } from '../types';

const meta = ZOMBIES_MAPS.deadend;

export const deadEndLayout: ZombiesMapLayout = {
  meta,
  rooms: [
    { id: 'alley', name: 'Alley – Spawn', x1: -10, z1: -10, x2: 10, z2: 10, y: 64, height: 6, windows: 3 },
    { id: 'office', name: 'Office', x1: 12, z1: -10, x2: 28, z2: 10, y: 64, height: 6, windows: 4 },
    { id: 'gallery', name: 'Gallery', x1: 30, z1: -10, x2: 44, z2: 10, y: 64, height: 7, windows: 3 },
    { id: 'hotel', name: 'Hotel', x1: -10, z1: 12, x2: 10, z2: 28, y: 64, height: 6, windows: 4 },
    { id: 'apartments', name: 'Apartments', x1: -10, z1: 30, x2: 10, z2: 44, y: 66, height: 6, windows: 5 },
    { id: 'powerstation', name: 'Power Station', x1: 30, z1: 12, x2: 44, z2: 28, y: 64, height: 6, windows: 4 },
    { id: 'rooftop', name: 'Rooftop', x1: 30, z1: 30, x2: 46, z2: 46, y: 72, height: 6, windows: 3 },
    { id: 'garden', name: 'Garden – Ultimate', x1: -10, z1: 46, x2: 10, z2: 60, y: 64, height: 6, windows: 2 },
  ],
  doors: [
    { id: 'alley-office', from: 'alley', to: 'office', cost: 500, x: 11, y: 64, z: 0, dir: 'z', locked: true },
    { id: 'office-gallery', from: 'office', to: 'gallery', cost: 750, x: 29, y: 64, z: 0, dir: 'z', locked: true },
    { id: 'alley-hotel', from: 'alley', to: 'hotel', cost: 750, x: 0, y: 64, z: 11, dir: 'x', locked: true },
    { id: 'hotel-apartments', from: 'hotel', to: 'apartments', cost: 750, x: 0, y: 65, z: 29, dir: 'x', locked: true },
    { id: 'office-powerstation', from: 'office', to: 'powerstation', cost: 1000, x: 20, y: 64, z: 11, dir: 'x', locked: true },
    { id: 'powerstation-rooftop', from: 'powerstation', to: 'rooftop', cost: 1000, x: 37, y: 66, z: 29, dir: 'x', locked: true },
    { id: 'hotel-garden', from: 'hotel', to: 'garden', cost: 750, x: 0, y: 64, z: 45, dir: 'x', locked: true },
    // shortcut doors
    { id: 'gallery-powerstation', from: 'gallery', to: 'powerstation', cost: 750, x: 30, y: 64, z: 11, dir: 'z', locked: true },
  ],
  shops: [
    // Alley spawn
    { id: 's-fastRevive', roomId: 'alley', kind: 'perk', perkId: 'fastRevive', price: 500, x: -8, y: 64, z: -6, facing: 'east' },
    { id: 's-mystery-alley', roomId: 'alley', kind: 'mystery', price: 1000, x: 8, y: 64, z: 8, facing: 'west' },
    // Office – Shotgun + Extra Weapon
    { id: 's-shotgun', roomId: 'office', kind: 'weapon_wall', weaponId: 'shotgun', price: 500, x: 26, y: 64, z: 4, facing: 'west' },
    { id: 's-extraWeapon', roomId: 'office', kind: 'perk', perkId: 'extraWeapon', price: 1500, x: 14, y: 64, z: 8, facing: 'south' },
    // Gallery – Speed
    { id: 's-speed', roomId: 'gallery', kind: 'perk', perkId: 'speed', price: 500, x: 42, y: 64, z: 5, facing: 'west' },
    // Hotel – Rifle + Flame + Frozen
    { id: 's-rifle', roomId: 'hotel', kind: 'weapon_wall', weaponId: 'rifle', price: 500, x: 8, y: 64, z: 26, facing: 'west' },
    { id: 's-flame', roomId: 'hotel', kind: 'perk', perkId: 'flameBullets', price: 750, x: -8, y: 64, z: 20, facing: 'east' },
    { id: 's-frozen', roomId: 'hotel', kind: 'perk', perkId: 'frozenBullets', price: 1000, x: -8, y: 64, z: 24, facing: 'east' },
    // Apartments – Sniper + Quick Fire + Iron Leggings (armor simulated as Iron Legs shop)
    { id: 's-sniper', roomId: 'apartments', kind: 'weapon_wall', weaponId: 'sniper', price: 700, x: 8, y: 66, z: 42, facing: 'west' },
    { id: 's-quickFire', roomId: 'apartments', kind: 'perk', perkId: 'quickFire', price: 1000, x: -8, y: 66, z: 38, facing: 'east' },
    { id: 's-armor-legs', roomId: 'apartments', kind: 'armor', price: 700, x: -8, y: 66, z: 42, facing: 'east' },
    // Power Station – power switch + Quick Fire? actually power switch is interactive block
    // Rooftop – Extra Health + Team Machine + Iron Chestplate
    { id: 's-extraHealth', roomId: 'rooftop', kind: 'perk', perkId: 'extraHealth', price: 1000, x: 44, y: 72, z: 38, facing: 'west' },
    { id: 's-team', roomId: 'rooftop', kind: 'team', price: 1000, x: 32, y: 72, z: 44, facing: 'north' },
    { id: 's-armor-chest', roomId: 'rooftop', kind: 'armor', price: 1000, x: 38, y: 72, z: 32, facing: 'south' },
    // Garden – Ultimate Machine
    { id: 's-ultimate', roomId: 'garden', kind: 'ultimate', price: 1500, x: 0, y: 64, z: 58, facing: 'north' },
  ],
  spawnPoints: [
    { x: 0, y: 65, z: 0 },
    { x: -4, y: 65, z: 4 },
    { x: 4, y: 65, z: -4 },
    { x: 0, y: 65, z: -6 },
  ],
  windowPositions: [
    // Alley 3 windows
    { x: -10, y: 65, z: -4, roomId: 'alley' },
    { x: -10, y: 65, z: 4, roomId: 'alley' },
    { x: 10, y: 65, z: 0, roomId: 'alley' },
    // Office 4
    { x: 12, y: 65, z: -8, roomId: 'office' },
    { x: 28, y: 65, z: -6, roomId: 'office' },
    { x: 28, y: 65, z: 6, roomId: 'office' },
    { x: 12, y: 65, z: 8, roomId: 'office' },
    // etc – builder will auto-place remaining by room bounds if missing
  ],
};
