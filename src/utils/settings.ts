export interface Settings {
  renderDistance: number;
  sensitivity: number;
  fov: number;
  volume: number;
  minimap: boolean;
}

export const SETTINGS_KEY = 'blockcraft-settings';

export const DEFAULT_SETTINGS: Settings = {
  renderDistance: 6,
  sensitivity: 1,
  fov: 72,
  volume: 0.5,
  minimap: true,
};

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
