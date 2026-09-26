/**
 * BlockCraft 2.0 – automat ustawień graficznych.
 *
 * Moduł poznaje urządzenie (procesor, pamięć, GPU, gęstość pikseli), dobiera
 * jeden z trzech profili jakości i – w trybie „Auto” – sam ustawia zasięg
 * renderowania, rozdzielczość, cząsteczki, chmury i limit FPS tak, żeby gra
 * płynnie działała nawet na słabych telefonach. Wszystkie funkcje są czyste
 * (bez dostępu do DOM poza `detectDeviceProfile`), więc da się je testować
 * w Node bez przeglądarki.
 */

export type DeviceTier = 'low' | 'mid' | 'high';
export type PresetName = 'low' | 'medium' | 'high';

export interface DeviceProfile {
  /** Telefon albo tablet (ekran dotykowy + kompaktowy UA). */
  mobile: boolean;
  /** Segment wydajności oszacowany z CPU/GPU/RAM. */
  tier: DeviceTier;
  /** Liczba rdzeni logicznych (0, gdy przeglądarka nie podaje). */
  cores: number;
  /** Pamięć urządzenia w GB (0, gdy przeglądarka nie podaje). */
  memoryGB: number;
  /** Nazwa GPU z WEBGL_debug_renderer_info (skrócona, '' gdy brak). */
  gpu: string;
  /** devicePixelRatio ograniczony do 3. */
  dpr: number;
  /** Krótszy bok ekranu w pikselach CSS. */
  minScreen: number;
}

/** Konkretny zestaw ustawień graficznych do skopiowania do Settings. */
export interface Preset {
  label: string;
  /** Render distance w chunkach. */
  renderDistance: number;
  /** Górny limit devicePixelRatio (mniejsza wartość = ostrzejsza, ale cięższa). */
  pixelRatio: number;
  /** Mnożnik ilości cząsteczek i deszczu 0–1. */
  particles: number;
  clouds: boolean;
  /** Dynamiczna rozdzielczość: silnik sam obniża skalę, gdy spada FPS. */
  dynamicResolution: boolean;
  /** 0 = bez limitu, inaczej twardy limit klatek (oszczędza baterię). */
  fpsCap: number;
  /** Budżet czasu (ms) na buildowanie chunków w klatce. */
  chunkBudgetMs: number;
  /** Maks. liczba chunków budowanych na klatkę. */
  chunksPerFrame: number;
  /** Ile chunków poza zasięgiem trzymać w pamięci. */
  unloadMargin: number;
}

export const PRESETS: Record<PresetName, Preset> = {
  low: {
    label: 'Niskie',
    renderDistance: 4,
    pixelRatio: 1,
    particles: 0.35,
    clouds: false,
    dynamicResolution: true,
    fpsCap: 30,
    chunkBudgetMs: 6,
    chunksPerFrame: 2,
    unloadMargin: 1,
  },
  medium: {
    label: 'Średnie',
    renderDistance: 6,
    pixelRatio: 1.35,
    particles: 0.7,
    clouds: true,
    dynamicResolution: true,
    fpsCap: 0,
    chunkBudgetMs: 9,
    chunksPerFrame: 3,
    unloadMargin: 2,
  },
  high: {
    label: 'Wysokie',
    renderDistance: 8,
    pixelRatio: 2,
    particles: 1,
    clouds: true,
    dynamicResolution: false,
    fpsCap: 0,
    chunkBudgetMs: 12,
    chunksPerFrame: 3,
    unloadMargin: 2,
  },
};

/** Wzorce GPU, które zaniżają/ podbijają ocenę segmentu. */
const WEAK_GPU = /(mali-g[0-5]\d|mali-\d{2}|adreno (5|6)[0-9]{2}[^0-9]|powervr|vivante|broadcom|videocore|swiftshader|llvmpipe|softpipe|software|angler|inteliHD Graphics (2|3|4)\d{2}[^0-9])/i;
const STRONG_GPU = /(rtx|gtx\s*1|radeon rx|arc\s*[aA]\d|apple\s*(m[1-9]|gpu)|apple a1[3-9]|adreno 7[0-9]{2}|mali-g7\d|immortalis)/i;

/** Wyciąga nazwę GPU z kontekstu WebGL (bez szkoda gdy brak WebGL). */
function detectGPU(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return '';
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const raw = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER) || '');
    return raw.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  } catch {
    return '';
  }
}

/** Poznaje urządzenie. W środowisku bez DOM (testy) zwraca bezpieczny profil. */
export function detectDeviceProfile(): DeviceProfile {
  const noDOM = typeof window === 'undefined' || typeof document === 'undefined';
  if (noDOM) return { mobile: false, tier: 'high', cores: 8, memoryGB: 8, gpu: '', dpr: 1, minScreen: 900 };

  const nav = navigator as Navigator & { deviceMemory?: number; msMaxTouchPoints?: number };
  const cores = Math.max(0, nav.hardwareConcurrency || 0);
  const memoryGB = Math.max(0, nav.deviceMemory || 0);
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const touch = 'ontouchstart' in window || (nav.maxTouchPoints ?? nav.msMaxTouchPoints ?? 0) > 0;
  const ua = navigator.userAgent || '';
  const mobileUA = /android|iphone|ipad|ipod|mobile|silk|kindle/i.test(ua);
  // iPadOS 13+ zgłasza się jako desktop Safari – ratuje nas ekran dotykowy.
  const minScreen = Math.min(window.innerWidth || 900, window.innerHeight || 900);
  const mobile = (touch && minScreen < 900) || mobileUA;

  let score = 0;
  if (mobile) score += 2;

  if (memoryGB > 0) {
    if (memoryGB <= 2) score += 3;
    else if (memoryGB <= 4) score += 1;
    else if (memoryGB >= 8) score -= 1;
  }
  if (cores > 0) {
    if (cores <= 4) score += 2;
    else if (cores <= 6) score += 1;
    else if (cores >= 8) score -= 1;
  }

  const gpu = detectGPU();
  if (gpu) {
    if (WEAK_GPU.test(gpu)) score += 3;
    else if (STRONG_GPU.test(gpu)) score -= 3;
  } else if (mobile) {
    score += 1; // nieznane GPU w telefonie – rozsądnie założyć słabszy sprzęt
  }
  if (dpr >= 2.5 && mobile) score += 1; // ostre ekrany = więcej pikseli do przepchnięcia

  // Desktop nigdy nie schodzi poniżej „średniego”.
  let tier: DeviceTier;
  if (!mobile) tier = score >= 6 ? 'mid' : 'high';
  else tier = score >= 4 ? 'low' : score >= 1 ? 'mid' : 'high';

  return { mobile, tier, cores, memoryGB, gpu, dpr, minScreen };
}

/** Rekomendowany preset dla urządzenia (tryb „Auto”). */
export function recommendPreset(p: DeviceProfile): PresetName {
  if (p.tier === 'low') return 'low';
  if (p.tier === 'mid') return 'medium';
  return 'high';
}

export function presetFor(name: PresetName): Preset {
  return PRESETS[name];
}

/** Skrót do profilu urządzenia + rekomendacji w jednej linii. */
export function autoPreset(): { profile: DeviceProfile; preset: PresetName } {
  const profile = detectDeviceProfile();
  return { profile, preset: recommendPreset(profile) };
}

/** Czytelny opis urządzenia do ekranu opcji. */
export function describeProfile(p: DeviceProfile): string {
  const tierName = p.tier === 'low' ? 'słabszy' : p.tier === 'mid' ? 'średni' : 'wydajny';
  const kind = p.mobile ? 'urządzenie mobilne' : 'komputer';
  const bits: string[] = [`${kind} (${tierName} segment)`];
  if (p.cores) bits.push(`${p.cores} rdzeni`);
  if (p.memoryGB) bits.push(`~${p.memoryGB} GB RAM`);
  if (p.gpu) bits.push(p.gpu);
  return bits.join(' · ');
}
