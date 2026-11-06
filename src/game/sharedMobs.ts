import type { MobType, MobVariant } from './mobs';
import type { VillagerState } from './trading';
import type { StateResult, StateTransaction } from './sharedState';
export interface MobSnapshot {
  id: string;
  type: MobType;
  variant: MobVariant;
  pos: number[];
  vel: number[];
  home: number[];
  state: Record<string, number | boolean | string>;
  trade: VillagerState | null;
}
export interface MobRegion {
  d: 'o' | 'n';
  x: number;
  z: number;
  revision: number;
  epoch: number;
  owner: string;
  mobs: MobSnapshot[];
}
export interface MobUpdate extends MobRegion {
  drops: unknown[];
  hits: MobHit[];
  edits: unknown[];
}
export interface MobHit {
  uid: string;
  target: string;
  mob: string;
  damage: number;
  shoot?: boolean;
  at?: number;
  explosion?: boolean;
}
export interface MobExchange {
  regions: MobRegion[];
  hits: MobHit[];
  edits: { x: number; y: number; z: number; id: number; d: 'o' | 'n' }[];
}
export interface MobTransaction extends Omit<StateTransaction, 'slots'> {
  kind: 'mobs';
  edits?: unknown[];
  mobs: MobSnapshot[];
  slots?: never;
}
export interface MobResult extends Omit<StateResult, 'chest'> {
  region: MobRegion;
  edits?: MobExchange['edits'];
}
export const MOB_REGION_SIZE = 128;
export function mobRegionKey(d: string, x: number, z: number) {
  return `${d}:${x}:${z}`;
}
