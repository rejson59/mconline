/**
 * Round scaling 1:1 Hypixel
 * Health/speed/armor scaling, variant rotation, boss rounds
 */
import type { RoundDef, ZombieVariant } from './types';

function roundZombieCount(round: number): number {
  // Hypixel scaling: r1 ~8, r10 ~24, r20 ~40, r30 ~60+ split waves
  if (round <= 5) return 8 + round * 2;
  if (round <= 10) return 18 + (round - 5) * 3;
  if (round <= 20) return 33 + (round - 10) * 2;
  return 53 + (round - 20) * 3;
}

function roundHealth(round: number): number {
  // Base 20, scales to ~80 at r30
  return Math.floor(20 + round * 2.2 + Math.pow(round, 1.35) * 0.3);
}

function roundSpeed(round: number): number {
  return Math.min(3.4, 1.9 + round * 0.05);
}

export function isBossRound(round: number): boolean {
  return round === 10 || round === 15 || round === 20 || round === 25 || round === 30;
}

export function bossForRound(round: number, map: string): RoundDef['boss'] | undefined {
  if (round === 10) {
    return map === 'deadend'
      ? { type: 'boss', health: 300, name: 'Inferno – Płonący Boss' }
      : map === 'badblood'
        ? { type: 'boss', health: 350, name: 'Król Slime – Król Bagien' }
        : { type: 'boss', health: 320, name: 'UFO – Mega Boss' };
  }
  if (round === 20) {
    return map === 'badblood'
      ? { type: 'boss', health: 600, name: 'Wither – Władca Kości' }
      : { type: 'boss', health: 500, name: 'Herobrine? – Cień' };
  }
  if (round === 30) {
    return map === 'deadend'
      ? { type: 'boss', health: 900, name: 'Giant – Tytan Dead End' }
      : map === 'badblood'
        ? { type: 'boss', health: 1000, name: 'Herobrine – Ostateczny' }
        : { type: 'boss', health: 1100, name: 'Warden – Strażnik Więzienia' };
  }
  return undefined;
}

export function variantsForRound(round: number, map: string): ZombieVariant[] {
  const v: ZombieVariant[] = ['normal'];
  if (round >= 2) v.push('pigZombie');
  if (map === 'badblood' && round >= 5) v.push('wolf');
  else if (map === 'deadend' && round >= 4) v.push('wolf');
  if (round >= 5) v.push('lilBombie');
  if (round >= 7) v.push('empowered');
  if (map === 'badblood' && round >= 6) v.push('caveSpider');
  if (round >= 12) v.push('witherSkeleton');
  if (round >= 14) v.push('blaze');
  return v;
}

export function buildRounds(maxRounds = 30, map = 'deadend'): RoundDef[] {
  const out: RoundDef[] = [];
  for (let r = 1; r <= maxRounds; r++) {
    out.push({
      round: r,
      zombieCount: roundZombieCount(r),
      zombieHealth: roundHealth(r),
      zombieSpeed: roundSpeed(r),
      variants: variantsForRound(r, map),
      boss: bossForRound(r, map),
      isBossRound: isBossRound(r),
    });
  }
  return out;
}

export const ROUND_GOLD_REWARD: Record<number, number> = {
  5: 100, 10: 200, 15: 300, 20: 400, 30: 1000,
};

export function goldOnHit(isCrit: boolean, weaponGold: number): number {
  return isCrit ? weaponGold + 5 : weaponGold;
}

export function goldOnKill(round: number): number {
  return 20 + Math.floor(round * 1.5);
}

export function goldOnWindowRepair(): number {
  return 30; // +10 bonus if fully repaired
}

export function goldOnWindowBonus(): number {
  return 50;
}
