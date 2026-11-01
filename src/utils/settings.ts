import { DEFAULT_SOUND_LEVELS, SOUND_CATEGORIES, type SoundLevels } from './soundSettings';
import { PRESETS, recommendPreset, type DeviceProfile, type PresetName } from './performance';

export const FPS_LIMITS = [0, 30, 60, 90, 120, 144, 165, 240] as const;
export type QualityMode = 'auto' | PresetName;
export type TouchMode = 'tap' | 'buttons';
/** 2.5: wyraźny podział wersji PC i dotykowej (patrz utils/input.ts). */
export type ControlMode = 'auto' | 'desktop' | 'touch';

export interface Settings {
  /** 0 = Auto; Java-style integer logical GUI scale. */
  guiScale: number;
  renderDistance: number;
  sensitivity: number;
  fov: number;
  volume: number;
  soundVolumes: SoundLevels;
  invertMouse: boolean;
  brightness: number;
  fovEffects: number;
  damageTilt: number;
  minimap: boolean;
  entityDistance: number;
  chatVisible: boolean;
  chatOpacity: number;
  chatBackground: number;
  chatScale: number;
  chatWidth: number;
  chatLines: number;
  /** Distinguish a deliberate FPS choice from a device preset default. */
  fpsCapUserSet: boolean;

  // ——— 2.5: wersja komputerowa albo dotykowa ———
  /** auto = wg głównego wskaźnika urządzenia; można też wymusić PC lub dotyk. */
  controlMode: ControlMode;

  // ——— 2.0: grafika ———
  /** Auto = dobrane do urządzenia przy każdym starcie. */
  quality: QualityMode;
  /** Górny limit rozdzielczości (devicePixelRatio). */
  pixelRatio: number;
  /** Mnożnik cząsteczek/deszczu 0–1. */
  particles: number;
  clouds: boolean;
  /** Silnik obniża rozdzielczość, gdy FPS spada, i podnosi, gdy jest zapas. */
  dynamicResolution: boolean;
  /** 0 = bez limitu; 30 oszczędza baterię na telefonach. */
  fpsCap: number;
  /** 2.28: tani teren za horyzontem (odpowiednik Distant Horizons). */
  lod: boolean;
  /** 2.28: automat jakości – sam zmniejsza budżet, gdy klatki są za długie. */
  autoQuality: boolean;
  viewBobbing: boolean;
  showFps: boolean;

  // ——— 2.0: sterowanie dotykowe ———
  /** tap = tapnij, aby postawić / przytrzymaj, aby kopać (jak MCPE); buttons = przyciski ⛏/▣. */
  touchMode: TouchMode;
  /** Stały drążek w lewym dolnym rogu zamiast pojawiającego się pod palcem. */
  joystickFixed: boolean;
  /** Wibracje przy kopaniu, obrażeniach i kliknięciach (jeśli telefon umie). */
  haptics: boolean;
  /** Automatyczne wskakiwanie na 1-blokowe przeszkody podczas marszu. */
  autoJump: boolean;
  /** 2.14: automatyczne bicie wrogich mobów w zasięgu ręki. */
  autoAttack: boolean;
  /** 2.12: rozmiar przycisków dotykowych (0.85 = małe, 1 = średnie, 1.15 = duże). */
  touchScale: number;
}

export const SETTINGS_KEY = 'blockcraft-settings';

export const DEFAULT_SETTINGS: Settings = {
  guiScale: 2,
  renderDistance: 6,
  sensitivity: 1,
  fov: 72,
  volume: 0.5,
  soundVolumes: { ...DEFAULT_SOUND_LEVELS },
  invertMouse: false,
  brightness: 0.5,
  fovEffects: 1,
  damageTilt: 1,
  minimap: false,
  entityDistance: 1,
  chatVisible: true,
  chatOpacity: 1,
  chatBackground: .45,
  chatScale: 1,
  chatWidth: 1,
  chatLines: 10,
  fpsCapUserSet: false,

  controlMode: 'auto',

  quality: 'auto',
  pixelRatio: 1.35,
  particles: 0.8,
  clouds: true,
  dynamicResolution: true,
  fpsCap: 0,
  lod: true,
  autoQuality: true,
  viewBobbing: true,
  showFps: false,

  touchMode: 'tap',
  joystickFixed: true,
  haptics: true,
  autoJump: true,
  autoAttack: false,
  touchScale: 1,
};

/**
 * Kopiuje wartości graficzne z presetu do ustawień, zachowując preferencje
 * gracza (FOV, czułość, dźwięk, sterowanie dotykowe…).
 * `keepAuto` zostawia tryb „Auto” – używane przy starcie gry, aby gra
 * dopasowała grafikę do urządzenia bez zmieniania wyboru użytkownika.
 */
export function applyPreset(s: Settings, name: PresetName, keepAuto = false): Settings {
  const p = PRESETS[name];
  return {
    ...s,
    quality: keepAuto ? s.quality : name,
    renderDistance: p.renderDistance,
    pixelRatio: p.pixelRatio,
    particles: p.particles,
    clouds: p.clouds,
    dynamicResolution: p.dynamicResolution,
    fpsCap: p.fpsCap,
  };
}

/**
 * Ustawienia efektywne: w trybie „Auto” wartości graficzne pochodzą z presetu
 * zarekomendowanego dla danego urządzenia (ale wybór „Auto” zostaje zapisany).
 */
export function effectiveSettings(s: Settings, profile: DeviceProfile): Settings {
  if (s.quality !== 'auto') return s;
  const preset = applyPreset(s, recommendPreset(profile), true);
  return s.fpsCapUserSet ? { ...preset, fpsCap: s.fpsCap } : preset;
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * Merges older saves with defaults and rejects stale/corrupted values from
 * localStorage. A single bad preference must never poison the renderer or
 * strand a player with an unusable control mode.
 */
export function normalizeSettings(value: unknown): Settings {
  const stored = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<Record<keyof Settings, unknown>>
    : {};
  const quality = oneOf(stored.quality, ['auto', 'low', 'medium', 'high'] as const, DEFAULT_SETTINGS.quality);
  const controlMode = oneOf(stored.controlMode, ['auto', 'desktop', 'touch'] as const, DEFAULT_SETTINGS.controlMode);
  const touchMode = oneOf(stored.touchMode, ['tap', 'buttons'] as const, DEFAULT_SETTINGS.touchMode);
  const fps = FPS_LIMITS.includes(stored.fpsCap as typeof FPS_LIMITS[number]) ? stored.fpsCap : DEFAULT_SETTINGS.fpsCap;
  const bool = (key: keyof Settings) => typeof stored[key] === 'boolean' ? stored[key] as boolean : DEFAULT_SETTINGS[key] as boolean;

  const soundVolumes = { ...DEFAULT_SOUND_LEVELS };
  const savedVolumes = stored.soundVolumes && typeof stored.soundVolumes === 'object' ? stored.soundVolumes as Partial<SoundLevels> : {};
  for (const category of SOUND_CATEGORIES) soundVolumes[category] = boundedNumber(savedVolumes[category], 1, 0, 1);

  return {
    ...DEFAULT_SETTINGS,
    soundVolumes,
    invertMouse: bool('invertMouse'),
    brightness: boundedNumber(stored.brightness, DEFAULT_SETTINGS.brightness, 0, 1),
    fovEffects: boundedNumber(stored.fovEffects, 1, 0, 1),
    damageTilt: boundedNumber(stored.damageTilt, 1, 0, 1),
    guiScale: Math.round(boundedNumber(stored.guiScale, DEFAULT_SETTINGS.guiScale, 0, 4)),
    renderDistance: Math.round(boundedNumber(stored.renderDistance, DEFAULT_SETTINGS.renderDistance, 2, 14)),
    sensitivity: boundedNumber(stored.sensitivity, DEFAULT_SETTINGS.sensitivity, 0.2, 3),
    fov: Math.round(boundedNumber(stored.fov, DEFAULT_SETTINGS.fov, 50, 110)),
    volume: boundedNumber(stored.volume, DEFAULT_SETTINGS.volume, 0, 1),
    minimap: bool('minimap'),
    entityDistance: boundedNumber(stored.entityDistance, 1, .5, 1.5),
    chatVisible: bool('chatVisible'),
    chatOpacity: boundedNumber(stored.chatOpacity, 1, 0, 1),
    chatBackground: boundedNumber(stored.chatBackground, .45, 0, 1),
    chatScale: boundedNumber(stored.chatScale, 1, .5, 1),
    chatWidth: boundedNumber(stored.chatWidth, 1, .3, 1),
    chatLines: Math.round(boundedNumber(stored.chatLines, 10, 1, 10)),
    fpsCapUserSet: typeof stored.fpsCapUserSet === 'boolean' ? stored.fpsCapUserSet : fps === 30 || fps === 60,
    controlMode,
    quality,
    pixelRatio: boundedNumber(stored.pixelRatio, DEFAULT_SETTINGS.pixelRatio, 0.75, 2),
    particles: boundedNumber(stored.particles, DEFAULT_SETTINGS.particles, 0, 1),
    clouds: bool('clouds'),
    dynamicResolution: bool('dynamicResolution'),
    fpsCap: fps as number,
    lod: bool('lod'),
    autoQuality: bool('autoQuality'),
    viewBobbing: bool('viewBobbing'),
    showFps: bool('showFps'),
    touchMode,
    joystickFixed: bool('joystickFixed'),
    haptics: bool('haptics'),
    autoJump: bool('autoJump'),
    autoAttack: bool('autoAttack'),
    touchScale: boundedNumber(stored.touchScale, DEFAULT_SETTINGS.touchScale, 0.8, 1.25),
  };
}

export function loadSettings(): Settings {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '');
    return normalizeSettings(stored);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('gui-scale'));
  } catch {
    /* storage full or blocked */
  }
}
