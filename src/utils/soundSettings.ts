/** Java sound-source categories. UI clicks follow master, as in Java. */
export const SOUND_CATEGORIES = ['music','records','weather','blocks','hostile','neutral','players','ambient'] as const;
export type SoundCategory = typeof SOUND_CATEGORIES[number];
export type SoundLevels = Record<SoundCategory, number>;
export const DEFAULT_SOUND_LEVELS: SoundLevels = { music: 1, records: 1, weather: 1, blocks: 1, hostile: 1, neutral: 1, players: 1, ambient: 1 };
