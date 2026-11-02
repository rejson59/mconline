export const PANORAMA_SCENES = [
  { id: 'trails', label: 'Wiśniowy gaj · Java 1.20' },
  { id: 'caves', label: 'Góry · Java 1.18' },
  { id: 'nether', label: 'Nether · Java 1.16' },
] as const;
export type PanoramaScene = typeof PANORAMA_SCENES[number]['id'];
export type PanoramaChoice = PanoramaScene | 'random' | 'automatic';
export interface PanoramaPreferences { scene: PanoramaChoice; motion: boolean }
export const PANORAMA_STORAGE_KEY = 'minecraft-menu-panorama-v1';
export const DEFAULT_PANORAMA: PanoramaPreferences = { scene: 'automatic', motion: true };
export function parsePanoramaPreferences(raw: string | null): PanoramaPreferences {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object') return { ...DEFAULT_PANORAMA };
    const v = value as Record<string, unknown>;
    const scene = v.scene === 'automatic' || v.scene === 'random' || PANORAMA_SCENES.some(s => s.id === v.scene) ? v.scene as PanoramaChoice : 'automatic';
    return { scene, motion: typeof v.motion === 'boolean' ? v.motion : true };
  } catch { return { ...DEFAULT_PANORAMA }; }
}
export function loadPanoramaPreferences(): PanoramaPreferences {
  try { return parsePanoramaPreferences(localStorage.getItem(PANORAMA_STORAGE_KEY)); }
  catch { return { ...DEFAULT_PANORAMA }; }
}
export function savePanoramaPreferences(value: PanoramaPreferences): void {
  try { localStorage.setItem(PANORAMA_STORAGE_KEY, JSON.stringify(value)); } catch { /* private mode/quota: session choice still works */ }
}
export function resolvePanoramaScene(choice: PanoramaChoice, random = Math.random(), previous?: PanoramaScene): PanoramaScene {
  if (choice !== 'random' && choice !== 'automatic') return choice;
  const pool = PANORAMA_SCENES.filter(scene => scene.id !== previous);
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor((Number.isFinite(random) ? random : 0) * pool.length)));
  return pool[index].id;
}
export function nextPanoramaScene(current: PanoramaScene): PanoramaScene {
  return PANORAMA_SCENES[(PANORAMA_SCENES.findIndex(scene => scene.id === current) + 1) % PANORAMA_SCENES.length].id;
}
export const PANORAMA_LAST_SCENE_KEY = 'minecraft-menu-panorama-last-v1';
let sessionLastScene: PanoramaScene | undefined;
export function lastPanoramaScene(): PanoramaScene | undefined {
  try {
    const value = localStorage.getItem(PANORAMA_LAST_SCENE_KEY);
    return PANORAMA_SCENES.find(scene => scene.id === value)?.id ?? sessionLastScene;
  } catch { return sessionLastScene; }
}
export function rememberPanoramaScene(scene: PanoramaScene): void {
  sessionLastScene = scene;
  try { localStorage.setItem(PANORAMA_LAST_SCENE_KEY, scene); } catch { /* memory fallback */ }
}
export const PANORAMA_CYCLE_MS = 45_000;
export interface PanoramaCycleEnvironment {
  visible: () => boolean;
  reduced: () => boolean;
  setTimer: (callback: () => void, ms: number) => number;
  clearTimer: (timer: number) => void;
  subscribe: (callback: () => void) => () => void;
}
/** No catching up after a hidden tab or reduced-motion period; wait a full interval. */
export function startPanoramaCycle(next: () => void, env: PanoramaCycleEnvironment): () => void {
  let disposed = false, timer: number | undefined;
  const clear = () => { if (timer !== undefined) env.clearTimer(timer); timer = undefined; };
  const arm = () => {
    clear();
    if (disposed || !env.visible() || env.reduced()) return;
    timer = env.setTimer(() => {
      timer = undefined;
      if (disposed) return;
      if (env.visible() && !env.reduced()) next();
      arm();
    }, PANORAMA_CYCLE_MS);
  };
  const unsubscribe = env.subscribe(arm);
  arm();
  return () => { disposed = true; clear(); unsubscribe(); };
}
/** Degrees, local elapsed time rather than the page's absolute performance clock.
 * Two degrees/second is an explicit browser implementation, not a JVM timing claim. */
export function panoramaPose(seconds: number): { pitch: number; yaw: number } {
  const t = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return { pitch: 10, yaw: -(t * 2 % 360) };
}
/** Bound mobile/4K work and preserve aspect ratio; no devicePixelRatio multiplier. */
export function panoramaSize(width: number, height: number): [number, number] {
  const w = Number.isFinite(width) ? Math.max(1, width) : 1;
  const h = Number.isFinite(height) ? Math.max(1, height) : 1;
  const ratio = Math.min(.75, 1280 / w, 720 / h);
  return [Math.max(1, Math.round(w * ratio)), Math.max(1, Math.round(h * ratio))];
}
