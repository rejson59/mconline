/**
 * 2.12: skórki graczy.
 *
 * Każda skórka to mała paleta kolorów dla awatara z bloków (głowa, włosy,
 * koszulka, rękawy, spodnie, buty i oczy). Zestaw jest celowo „minecraftowy”:
 * kilka klasycznych postaci plus kolory, które dobrze widać w terenie.
 *
 * Wybór zapisujemy w `localStorage`, a nie w ustawieniach graficznych, żeby
 * skórka była wspólna dla wszystkich światów i nie mieszała się z presetami
 * wydajności. W sesji sieciowej identyfikator skórki leci w wiadomości `pos`
 * (i w `hello`), więc pozostali widzą ten sam wygląd.
 */

export interface Skin {
  id: string;
  name: string;
  /** Krótki opis do podpisu pod kafelkiem. */
  desc: string;
  /** Głowa / twarz. */
  skin: number;
  /** Włosy albo hełm (cienka warstwa na głowie). */
  hair: number;
  /** Koszulka (tułów). */
  shirt: number;
  /** Rękawy (ręce) – zwykle odcień koszulki. */
  sleeve: number;
  /** Spodnie (nogi). */
  pants: number;
  /** Buty (dolna część nóg). */
  shoes: number;
  /** Kolor oczu; brak = oczy w kolorze włosów. */
  eye?: number;
}

export const SKINS: Skin[] = [
  {
    id: 'steve',
    name: 'Steve',
    desc: 'klasyk: turkusowa koszulka, niebieskie spodnie',
    skin: 0xc68642,
    hair: 0x3b2a1a,
    shirt: 0x00a8a8,
    sleeve: 0x009090,
    pants: 0x3b4bb8,
    shoes: 0x2b2b2b,
    eye: 0x2b2b2b,
  },
  {
    id: 'alex',
    name: 'Alex',
    desc: 'zielona koszulka, rude włosy',
    skin: 0xe0ac69,
    hair: 0xb5541c,
    shirt: 0x6f9b45,
    sleeve: 0x5c8438,
    pants: 0x6b4a2b,
    shoes: 0x3b2a1a,
    eye: 0x3a6f2a,
  },
  {
    id: 'creeper',
    name: 'Creeper',
    desc: 'zielony jak creeper, czarne oczy',
    skin: 0x6fbf5b,
    hair: 0x4f9c3d,
    shirt: 0x5bb04a,
    sleeve: 0x4a983c,
    pants: 0x3f7f33,
    shoes: 0x2d5c24,
    eye: 0x101010,
  },
  {
    id: 'enderman',
    name: 'Enderman',
    desc: 'czarny jak noc, fioletowe oczy',
    skin: 0x1b1b22,
    hair: 0x0d0d12,
    shirt: 0x262631,
    sleeve: 0x1f1f29,
    pants: 0x15151c,
    shoes: 0x0b0b10,
    eye: 0xb45cff,
  },
  {
    id: 'knight',
    name: 'Rycerz',
    desc: 'stalowa zbroja i czerwony pas',
    skin: 0xb9b9c2,
    hair: 0x8a8a96,
    shirt: 0x8f8f9c,
    sleeve: 0x7c7c88,
    pants: 0x5a5a66,
    shoes: 0x3a3a44,
    eye: 0xd23c3c,
  },
  {
    id: 'ninja',
    name: 'Ninja',
    desc: 'czarny strój i czerwona przepaska',
    skin: 0xd8a878,
    hair: 0x1a1a1a,
    shirt: 0x24242c,
    sleeve: 0x1c1c23,
    pants: 0x15151b,
    shoes: 0x0d0d11,
    eye: 0xe03a3a,
  },
  {
    id: 'gold',
    name: 'Złoty rycerz',
    desc: 'złota zbroja, lśni w słońcu',
    skin: 0xf0d060,
    hair: 0xd4af37,
    shirt: 0xe8c34a,
    sleeve: 0xd0ab38,
    pants: 0x8a6a1f,
    shoes: 0x5c4712,
    eye: 0x3a2f0a,
  },
  {
    id: 'explorer',
    name: 'Odkrywca',
    desc: 'brązowy płaszcz i kapelusz',
    skin: 0xd9a066,
    hair: 0x6b4a2b,
    shirt: 0x8a6a45,
    sleeve: 0x75583a,
    pants: 0x4a5a3a,
    shoes: 0x2f2a22,
    eye: 0x3a2a1a,
  },
];

export const DEFAULT_SKIN_ID = 'steve';
export const SKIN_KEY = 'blockcraft-skin';

/** Skórka po identyfikatorze; nieznany/brak = domyślna (nigdy nie rzuca). */
export function skinById(id?: string | null): Skin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

export function loadSkinId(): string {
  try {
    const saved = localStorage.getItem(SKIN_KEY);
    return skinById(saved).id;
  } catch {
    return DEFAULT_SKIN_ID;
  }
}

export function saveSkinId(id: string): string {
  const clean = skinById(id).id;
  try {
    localStorage.setItem(SKIN_KEY, clean);
  } catch {
    /* prywatny tryb przeglądarki – skórka zostanie tylko do końca sesji */
  }
  return clean;
}

/** Kolejna skórka na liście (podgląd / losowanie). */
export function nextSkinId(current: string, step = 1): string {
  const i = Math.max(0, SKINS.findIndex((s) => s.id === current));
  return SKINS[(i + step + SKINS.length) % SKINS.length].id;
}

/**
 * Kolory zapasowe dla graczy ze starszych wersji, które nie wysyłają skórki
 * (starsza wersja gry). Odcień liczymy z `hue`, żeby awatar nadal był
 * rozpoznawalny w tłumie.
 */
export function fallbackSkin(hue: number): Skin {
  const h = ((hue % 360) + 360) % 360;
  const hsl = (l: number) => {
    // HSL → RGB bez zależności od Three.js (skórki są też używane w testach).
    const s = 0.55;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const to = (v: number) => Math.round((v + m) * 255);
    return (to(r) << 16) | (to(g) << 8) | to(b);
  };
  return {
    id: `hue-${h}`,
    name: 'Gracz',
    desc: '',
    skin: 0xd9a066,
    hair: 0x3b2a1a,
    shirt: hsl(0.42),
    sleeve: hsl(0.36),
    pants: hsl(0.28),
    shoes: hsl(0.2),
    eye: 0x2b2b2b,
  };
}
