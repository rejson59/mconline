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

export function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '');
    return { ...DEFAULT_SETTINGS, ...s };
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
