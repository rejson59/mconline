/**
 * BlockCraft 2.30 – płynni gracze w multiplayerze.
 *
 * Do 2.29 awatar zdalnego gracza gonił ostatnią odebraną pozycję
 * (`position.lerp(target, dt * 10)`). Przy 4 pakietach na sekundę (serwer
 * publiczny) wyglądało to tak: awatar w pół klatki „przeskakiwał” do nowej
 * pozycji, a potem stał nieruchomo przez ~0,2 s – dokładnie to zacinanie,
 * które widać w grze.
 *
 * Tutaj pakiet nie jest celem, a punktem na osi czasu. Trzymamy kilka
 * ostatnich migawek i rysujemy gracza z opóźnieniem (120–320 ms) w środku
 * przedziału między dwiema z nich. Ruch jest wtedy ciągły jak w Minecrafcie,
 * a opóźnienie jest mniejsze niż jedno mrugnięcie oka.
 */

export interface RemoteState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface RemoteSample extends RemoteState {
  /** Prędkość pozioma wyliczona z odcinka (bloki/s) – dla animacji nóg. */
  speed: number;
}

/** Opóźnienie bufora: 10 Hz w pokoju, 4 Hz na serwerze publicznym. */
export const REMOTE_DELAY_LOCAL = 0.12;
/**
 * Serwer publiczny wysyła 4 pozycje na sekundę (250 ms), więc bufor musi
 * pomieścić cały odstęp plus zapas na jitter transmisji – stąd 320 ms.
 */
export const REMOTE_DELAY_PUBLIC = 0.32;
/** Po tym czasie bez nowych pakietów przestajemy zgadywać ruch. */
export const REMOTE_EXTRAPOLATE_MAX = 0.25;
/** Skok dłuższy niż tyle bloków to teleportacja, a nie chód. */
export const REMOTE_SNAP_DIST = 12;
/** Maksymalna prędkość ekstrapolacji (bloki/s) – nikt nie biega szybciej. */
export const REMOTE_MAX_SPEED = 6;

interface Snap {
  at: number;
  s: RemoteState;
}

/** Najkrótsza droga kątowa (yaw potrafi przeskoczyć z +π na −π). */
export function wrapAngle(a: number): number {
  let out = a;
  while (out > Math.PI) out -= Math.PI * 2;
  while (out < -Math.PI) out += Math.PI * 2;
  return out;
}

export function lerpAngle(a: number, b: number, t: number): number {
  return a + wrapAngle(b - a) * t;
}

function num(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback;
}

/** Oś czasu jednego zdalnego gracza. */
export class RemoteTrack {
  private snaps: Snap[] = [];

  get size(): number {
    return this.snaps.length;
  }

  get last(): RemoteState | null {
    return this.snaps.length ? this.snaps[this.snaps.length - 1].s : null;
  }

  clear(): void {
    this.snaps.length = 0;
  }

  /**
   * Dorzuca migawkę odebraną teraz (`now` w ms). Duży skok (teleportacja,
   * wejście do świata, zmiana wymiaru) czyści historię, żeby awatar nie
   * przeleciał przez pół mapy.
   */
  push(now: number, raw: RemoteState): void {
    const s: RemoteState = {
      x: num(raw.x, 0),
      y: num(raw.y, 0),
      z: num(raw.z, 0),
      yaw: num(raw.yaw, 0),
      pitch: num(raw.pitch, 0),
    };
    const prev = this.snaps[this.snaps.length - 1];
    if (prev && Math.hypot(s.x - prev.s.x, s.y - prev.s.y, s.z - prev.s.z) > REMOTE_SNAP_DIST) {
      this.snaps.length = 0;
    }
    this.snaps.push({ at: now, s });
    // Trzy sekundy historii (4 Hz × 3 s = 12) w zupełności wystarczają.
    if (this.snaps.length > 12) this.snaps.splice(0, this.snaps.length - 12);
  }

  /**
   * Stan do narysowania w tej klatce. `delay` w sekundach – im rzadsze
   * pakiety, tym większy bufor (patrz REMOTE_DELAY_*).
   */
  sample(now: number, delay: number): RemoteSample | null {
    const n = this.snaps.length;
    if (!n) return null;
    const t = now - Math.max(0, delay) * 1000;
    const first = this.snaps[0].s;
    // Rysujemy „z przyszłości” względem pierwszej migawki (świeża sesja).
    if (t <= this.snaps[0].at) return { ...first, speed: 0 };

    // Indeks ostatniej migawki nie późniejszej niż `t`.
    let i = -1;
    while (i + 1 < n && this.snaps[i + 1].at <= t) i++;
    // Starszych migawek już nie potrzebujemy; zostawiamy jedną zapasową.
    if (i > 1) {
      this.snaps.splice(0, i - 1);
      i = 1;
    }

    if (i < 0) return { ...first, speed: 0 };
    const a = this.snaps[i];
    const b = i + 1 < this.snaps.length ? this.snaps[i + 1] : null;

    if (b) {
      const span = Math.max(1, b.at - a.at);
      const k = Math.min(1, Math.max(0, (t - a.at) / span));
      const dx = b.s.x - a.s.x;
      const dz = b.s.z - a.s.z;
      return {
        x: a.s.x + dx * k,
        y: a.s.y + (b.s.y - a.s.y) * k,
        z: a.s.z + dz * k,
        yaw: lerpAngle(a.s.yaw, b.s.yaw, k),
        pitch: a.s.pitch + (b.s.pitch - a.s.pitch) * k,
        speed: Math.hypot(dx, dz) / (span / 1000),
      };
    }

    // Brak przyszłej migawki: krótka ekstrapolacja z dwóch ostatnich
    // pakietów (maks. 0,25 s), żeby gracz nie zamarł między aktualizacjami,
    // ale też nie „jechał” po rozłączeniu.
    const older = i > 0 ? this.snaps[i - 1] : null;
    if (!older) return { ...a.s, speed: 0 };
    const ahead = Math.min(REMOTE_EXTRAPOLATE_MAX, (t - a.at) / 1000);
    if (ahead <= 0) return { ...a.s, speed: 0 };
    const dtSeg = Math.max(1, a.at - older.at) / 1000;
    let vx = (a.s.x - older.s.x) / dtSeg;
    let vz = (a.s.z - older.s.z) / dtSeg;
    const sp = Math.hypot(vx, vz);
    if (sp > REMOTE_MAX_SPEED) {
      vx = (vx / sp) * REMOTE_MAX_SPEED;
      vz = (vz / sp) * REMOTE_MAX_SPEED;
    }
    return {
      x: a.s.x + vx * ahead,
      y: a.s.y,
      z: a.s.z + vz * ahead,
      yaw: a.s.yaw,
      pitch: a.s.pitch,
      speed: Math.min(sp, REMOTE_MAX_SPEED),
    };
  }
}
