export * from './types';
export * from './weapons';
export * from './perks';
export * from './roundConfig';
export * from './engine';
export * from './worldBuilder';
export { deadEndLayout } from './maps/deadEnd';
export { badBloodLayout } from './maps/badBlood';
export { alienArcadiumLayout } from './maps/alienArcadium';
export { prisonLayout } from './maps/prison';

import { deadEndLayout } from './maps/deadEnd';
import { badBloodLayout } from './maps/badBlood';
import { alienArcadiumLayout } from './maps/alienArcadium';
import { prisonLayout } from './maps/prison';
import type { ZombiesMapId, ZombiesMapLayout } from './types';

export function getMapLayout(id: ZombiesMapId): ZombiesMapLayout {
  switch (id) {
    case 'deadend': return deadEndLayout;
    case 'badblood': return badBloodLayout;
    case 'alienarcadium': return alienArcadiumLayout;
    case 'prison': return prisonLayout;
    default: return deadEndLayout;
  }
}
