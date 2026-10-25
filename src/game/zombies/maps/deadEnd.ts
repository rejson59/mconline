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
  // 3.7 FIX 1:1 wiki – windows per Hypixel fandom/Namu: Alley 4, Office 3, Gallery 3, Hotel 6, Apartments 4, Power 3, Roof 4, Garden 3 = 30
  rooms: [
    { id: 'alley', name: 'Alley – Spawn', x1: -14, z1: -10, x2: 14, z2: 10, y: 64, height: 7, windows: 4 },
    { id: 'office', name: 'Office', x1: 16, z1: -12, x2: 32, z2: 12, y: 64, height: 6, windows: 3 },
    { id: 'gallery', name: 'Gallery', x1: 34, z1: -12, x2: 50, z2: 12, y: 64, height: 8, windows: 3 },
    { id: 'hotel', name: 'Hotel', x1: -14, z1: 14, x2: 14, z2: 32, y: 64, height: 7, windows: 6 },
    { id: 'apartments', name: 'Apartments', x1: -14, z1: 34, x2: 14, z2: 54, y: 66, height: 7, windows: 4 },
    { id: 'powerstation', name: 'Power Station', x1: 28, z1: 14, x2: 50, z2: 32, y: 64, height: 8, windows: 3 },
    { id: 'rooftop', name: 'Rooftop', x1: 28, z1: 34, x2: 52, z2: 52, y: 74, height: 6, windows: 4 },
    { id: 'garden', name: 'Garden – Ultimate', x1: -14, z1: 56, x2: 14, z2: 70, y: 64, height: 6, windows: 3 },
  ],
  doors: [
    { id: 'alley-office', from: 'alley', to: 'office', cost: 500, x: 15, y: 64, z: 0, dir: 'z', locked: true },
    { id: 'office-gallery', from: 'office', to: 'gallery', cost: 750, x: 33, y: 64, z: 0, dir: 'z', locked: true },
    { id: 'alley-hotel', from: 'alley', to: 'hotel', cost: 750, x: 0, y: 64, z: 12, dir: 'x', locked: true },
    { id: 'hotel-apartments', from: 'hotel', to: 'apartments', cost: 750, x: 0, y: 65, z: 33, dir: 'x', locked: true },
    { id: 'apartments-powerstation', from: 'apartments', to: 'powerstation', cost: 1000, x: 21, y: 66, z: 42, dir: 'z', locked: true },
    { id: 'powerstation-rooftop', from: 'powerstation', to: 'rooftop', cost: 1250, x: 39, y: 67, z: 33, dir: 'x', locked: true },
    { id: 'hotel-garden', from: 'hotel', to: 'garden', cost: 750, x: 0, y: 64, z: 55, dir: 'x', locked: true },
    { id: 'gallery-powerstation', from: 'gallery', to: 'powerstation', cost: 1000, x: 42, y: 64, z: 13, dir: 'x', locked: true },
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
