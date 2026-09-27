/**
 * Shared world metrics. They live in their own module so that generators
 * (village.ts) can use them without importing world.ts – world.ts imports the
 * generators, and a cycle would break module initialisation order.
 */
export const CS = 16; // chunk size
export const CH = 192; // chunk height — v2.6 podnosi góry i głębiny
export const SEA = 62;
/** Surface height of a flat world. */
export const FLAT_H = 64;
/** Poniżej tej wysokości kamień zamienia się w łupek (deepslate) */
export const DEEPSLATE_START = 16;
/** Szczyt gór w v2.6 może sięgać znacznie wyżej */
export const MOUNTAIN_MAX = 148;
