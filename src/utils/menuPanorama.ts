export const PANORAMA_SCENES = [
  { id: 'trails', label: 'Wiśniowy gaj · Java 1.20' },
  { id: 'caves', label: 'Góry · Java 1.18' },
  { id: 'nether', label: 'Nether · Java 1.16' },
] as const;
export type PanoramaScene = typeof PANORAMA_SCENES[number]['id'];
export type PanoramaChoice = PanoramaScene | 'random';
export interface PanoramaPreferences { scene: PanoramaChoice; motion: boolean }
export const PANORAMA_STORAGE_KEY = 'minecraft-menu-panorama-v1';
export const DEFAULT_PANORAMA: PanoramaPreferences = { scene: 'trails', motion: true };
export function parsePanoramaPreferences(raw: string | null): PanoramaPreferences {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object') return { ...DEFAULT_PANORAMA };
    const v = value as Record<string, unknown>;
    const scene = v.scene === 'random' || PANORAMA_SCENES.some(s => s.id === v.scene) ? v.scene as PanoramaChoice : 'trails';
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
export function resolvePanoramaScene(choice: PanoramaChoice, random = Math.random()): PanoramaScene {
  if (choice !== 'random') return choice;
  const index = Math.min(2, Math.max(0, Math.floor((Number.isFinite(random) ? random : 0) * 3)));
  return PANORAMA_SCENES[index].id;
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
