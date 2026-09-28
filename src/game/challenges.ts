import { BIOME_DISCOVERY_GOALS } from './achievements';

export const CHALLENGES = {
  challenge_builder: { target: 20, rewardXp: 10, label: 'Postaw 20 bloków' },
  challenge_hunter: { target: 5, rewardXp: 10, label: 'Pokonaj 5 wrogich mobów' },
  challenge_explorer: { target: 3, rewardXp: 10, label: 'Odwiedź 3 różne biomy' },
} as const;
export type ChallengeId = keyof typeof CHALLENGES;
export type ChallengeProgress = Record<ChallengeId, number>;

/** Old worlds have no counters; previous one-time biome achievements still count. */
export function normalizeChallenges(raw: unknown, unlocked: Iterable<string> = []): ChallengeProgress {
  const done = new Set(unlocked);
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const progress = {} as ChallengeProgress;
  for (const key of Object.keys(CHALLENGES) as ChallengeId[]) {
    const target = CHALLENGES[key].target;
    const value = source[key];
    progress[key] = done.has(key) ? target : typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, Math.min(target - 1, Math.floor(value))) : 0;
  }
  progress.challenge_explorer = Math.max(progress.challenge_explorer,
    Math.min(CHALLENGES.challenge_explorer.target, Object.values(BIOME_DISCOVERY_GOALS).filter((id) => done.has(id)).length));
  return progress;
}
