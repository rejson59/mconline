import { PRESETS, recommendPreset, type DeviceProfile, type PresetName } from './performance';

export type QualityMode = 'auto' | PresetName;
export type TouchMode = 'tap' | 'buttons';
/** 2.5: wyraźny podział wersji PC i dotykowej (patrz utils/input.ts). */
export type ControlMode = 'auto' | 'desktop' | 'touch';

export interface Settings {
  renderDistance: number;
  sensitivity: number;
  fov: number;
  volume: number;
  minimap: boolean;

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
}

export const SETTINGS_KEY = 'blockcraft-settings';

export const DEFAULT_SETTINGS: Settings = {
  renderDistance: 6,
  sensitivity: 1,
  fov: 72,
  volume: 0.5,
  minimap: true,

  controlMode: 'auto',

  quality: 'auto',
  pixelRatio: 1.35,
  particles: 0.8,
  clouds: true,
  dynamicResolution: true,
  fpsCap: 0,
  viewBobbing: true,
  showFps: false,

  touchMode: 'tap',
  joystickFixed: true,
  haptics: true,
  autoJump: true,
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
  return applyPreset(s, recommendPreset(profile), true);
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
  const fps = stored.fpsCap === 0 || stored.fpsCap === 30 || stored.fpsCap === 60 ? stored.fpsCap : DEFAULT_SETTINGS.fpsCap;
  const bool = (key: keyof Settings) => typeof stored[key] === 'boolean' ? stored[key] as boolean : DEFAULT_SETTINGS[key] as boolean;

  return {
    ...DEFAULT_SETTINGS,
    renderDistance: Math.round(boundedNumber(stored.renderDistance, DEFAULT_SETTINGS.renderDistance, 2, 14)),
    sensitivity: boundedNumber(stored.sensitivity, DEFAULT_SETTINGS.sensitivity, 0.2, 3),
    fov: Math.round(boundedNumber(stored.fov, DEFAULT_SETTINGS.fov, 50, 110)),
    volume: boundedNumber(stored.volume, DEFAULT_SETTINGS.volume, 0, 1),
    minimap: bool('minimap'),
    controlMode,
    quality,
    pixelRatio: boundedNumber(stored.pixelRatio, DEFAULT_SETTINGS.pixelRatio, 0.75, 2),
    particles: boundedNumber(stored.particles, DEFAULT_SETTINGS.particles, 0, 1),
    clouds: bool('clouds'),
    dynamicResolution: bool('dynamicResolution'),
    fpsCap: fps,
    viewBobbing: bool('viewBobbing'),
    showFps: bool('showFps'),
    touchMode,
    joystickFixed: bool('joystickFixed'),
    haptics: bool('haptics'),
    autoJump: bool('autoJump'),
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
  } catch {
    /* storage full or blocked */
  }
}
