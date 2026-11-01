/** Shared Java chest boxes/UVs for world, held items, drops and icons. */
export interface ChestBox {
  /** Pudełko w pikselach modelu (0–16) – tak jak w JSON-ie encji. */
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
  /** Początek UV w teksturze 64×64. */
  u: number;
  v: number;
}

export const CHEST_BODY: ChestBox = {
  x0: 1,
  y0: 0,
  z0: 1,
  x1: 15,
  y1: 10,
  z1: 15,
  u: 0,
  v: 19,
};
export const CHEST_LID: ChestBox = {
  x0: 1,
  y0: 9,
  z0: 1,
  x1: 15,
  y1: 14,
  z1: 15,
  u: 0,
  v: 0,
};
export const CHEST_LOCK: ChestBox = {
  x0: 7,
  y0: 7,
  z0: 15,
  x1: 9,
  y1: 11,
  z1: 16,
  u: 0,
  v: 0,
};
// 2.32: w podwójnej skrzyni zamek jest dzielony na dwie połówki – każda
// przy swoim brzegu styku, więc razem dają jedną klamrę na środku, jak w grze.
export const CHEST_LOCK_LEFT: ChestBox = {
  x0: 15,
  y0: 7,
  z0: 15,
  x1: 16,
  y1: 11,
  z1: 16,
  u: 0,
  v: 0,
};
export const CHEST_LOCK_RIGHT: ChestBox = {
  x0: 0,
  y0: 7,
  z0: 15,
  x1: 1,
  y1: 11,
  z1: 16,
  u: 0,
  v: 0,
};

/**
 * 2.32: lewa i prawa połowa podwójnej skrzyni.
 *
 * W wanilii `ChestModel` dla `doubleLeft` przesuwa początek na x = 0 i zwęża
 * pudełko do 15 px, a dla `doubleRight` zaczyna na x = 1 i kończy na 16.
 * Ścianki stykowe dwóch połówek leżą dokładnie w tej samej płaszczyźnie, ale
 * mają przeciwne normalne, więc z zewnątrz nigdy nie widać żadnej z nich –
 * dlatego podwójna skrzynia wygląda jak jedna bryła bez szwu.
 */
export function chestBoxFor(
  region: 'chest' | 'chest_left' | 'chest_right',
  box: ChestBox
): ChestBox {
  if (region === 'chest') return box;
  // `chest_left` to połówka bliżej −x (dla przodu na +z) i rysuje się od
  // 1 do 16, a `chest_right` od 0 do 15. Dzięki temu bryła jest ciągła bez
  // szczeliny, a ciemne obramowanie z `normal_left/right.png` wypada tylko
  // na zewnętrznych krawędziach – dokładnie jak w Minecrafcie.
  // 2.32: połówki zachodzą na siebie o 1 px przy styku, więc podwójna
  // skrzynia jest jedną bryłą bez szczeliny: lewa zajmuje 1–16 px swojej
  // kratki, prawa 0–15 px. Razem dają 30 px szerokości – tyle, ile ma
  // waniliowa podwójna skrzynia. Ciemne obramowanie z `normal_left.png`
  // wypada na zewnętrznej krawędzi lewej połówki, a z `normal_right.png` na
  // zewnętrznej krawędzi prawej – na styku zostaje czyste drewno.
  return region === 'chest_left'
    ? { ...box, x0: 1, x1: 16 }
    : { ...box, x0: 0, x1: 15 };
}

/**
 * 2.32: która ścianka połówki jest schowana w styku.
 *
 * `chest_left` sięga krawędzi kratki od strony sąsiada (x = +16 px), więc
 * jego ściana +x jest w środku podwójnej skrzyni; `chest_right` ma taką
 * samą ścianę −x. Dla obrotu o 90° te osie zamieniają się miejscami.
 */
export function chestSeamSkip(
  region: 'chest' | 'chest_left' | 'chest_right',
  _yaw?: number
): number {
  // 1 = pomiń +x, −1 = pomiń −x (w układzie modelu).
  return region === 'chest_left' ? 1 : -1;
}

/** Zamek dla danej połówki – pojedyncza skrzynia ma jeden, szeroki. */
export function chestLockFor(
  region: 'chest' | 'chest_left' | 'chest_right'
): ChestBox {
  if (region === 'chest_left') return CHEST_LOCK_LEFT;
  if (region === 'chest_right') return CHEST_LOCK_RIGHT;
  return CHEST_LOCK;
}

/** Prostokąt UV jednej ściany pudełka w pikselach tekstury encji. */
export function chestFaceRect(
  box: ChestBox,
  f: number
): [number, number, number, number] {
  const w = box.x1 - box.x0,
    h = box.y1 - box.y0,
    d = box.z1 - box.z0;
  const { u, v } = box;
  // 0 −x, 1 +x, 2 −y (spód), 3 +y (góra), 4 −z, 5 +z.
  // W waniliowym `ModelPart.Cube` górna ściana bierze (u+d, v), a dolna
  // (u+d+w, v). W `normal.png` to drugie jest jasną deską (zewnętrzna góra
  // wieka), a pierwsze ciemnym wnętrzem – dlatego góra czyta się poprawnie
  // tylko przy tej kolejności. Wnętrze korpusu (28,19) jest czarne, więc po
  // otwarciu wieka widać dokładnie taką ciemność jak w grze.
  switch (f) {
    case 0:
      return [u + d + w, v + d, d, h];
    case 1:
      return [u, v + d, d, h];
    // 2.32: w `normal.png` zewnętrzna góra wieka leży pod (28,0), a ciemne
    // wnętrze pod (14,0) – dlatego +y bierze prawe pudełko, a −y lewe.
    case 2:
      return [u + d, v, w, d];
    case 3:
      return [u + d + w, v, w, d];
    case 4:
      return [u + d + w + d, v + d, w, h];
    default:
      return [u + d, v + d, w, h];
  }
}

/** Java's cubic lid easing; openness itself advances at a fixed tick rate. */
export function chestLidAngle(openness: number): number {
  const closed = 1 - Math.max(0, Math.min(1, openness));
  return (-(1 - closed * closed * closed) * Math.PI) / 2;
}
