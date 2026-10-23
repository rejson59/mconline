// Procedural sound effects generated with the Web Audio API.
// Every entry point is fail-safe: if the browser has no (or a blocked)
// AudioContext the game keeps running silently instead of throwing.
type Kind = 'stone' | 'wood' | 'grass' | 'sand' | 'glass' | 'cloth' | 'slime' | 'metal';

let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
let master: GainNode | null = null;
let broken = false; // audio unavailable -> stay silent
export let volume = 0.5;

/**
 * 2.29: „pokój” dla wszystkich dźwięków.
 *
 * Wanilia nagrywa efekty w małej przestrzeni (jaskinia, drewniany dom), więc
 * każdy trzask ma ogon. Do 2.28 graliśmy zupełnie na sucho i wszystko
 * brzmiało jak kliknięcie w głośniku. Impuls pogłosu generujemy proceduralnie
 * (szum z wykładniczym zanikiem, lekko przyciemniony), więc nadal nie
 * Dotykamy żadnych plików z gry.
 */
function buildRoom(c: AudioContext, dest: GainNode, out: AudioNode) {
  const len = Math.floor(c.sampleRate * 0.55);
  if (len <= 0) return;
  const ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // wczesne odbicia + gęsty ogon; filtr dolnoprzepustowy „miękczy” pogłos
      const env = Math.pow(1 - t, 2.6);
      lp += (Math.random() * 2 - 1 - lp) * 0.35;
      const early = i < c.sampleRate * 0.05 && i % Math.max(1, Math.floor(c.sampleRate * 0.011)) < 24 ? 0.6 : 0;
      d[i] = (lp * 0.7 + early) * env * 0.55;
    }
  }
  const conv = c.createConvolver();
  conv.buffer = ir;
  const g = c.createGain();
  g.gain.value = 0.2;
  // cały miks (master) idzie też przez pogłos – jeden wysył na wszystko
  dest.connect(conv);
  // 2.31: pogłos też przechodzi przez limiter, więc ogon nigdy nie klipuje.
  conv.connect(g).connect(out);
}

/** Wspólne wyjście efektów – jedno miejsce, więc nic nie gra „w próżnię”. */
function out(node: AudioNode) {
  if (master) node.connect(master);
}

// ---------------------------------------------------------------- przestrzeń
/**
 * 2.31: dźwięk w przestrzeni, jak w Minecrafcie.
 *
 * Wanilia liczy dla każdego dźwięku odległość od uszu gracza i tłumi go
 * liniowo do zera na `attenuation_distance` (zwykle 16 bloków), a kierunek
 * zamienia na panoramę stereo. Do 2.30 wszystko grało tak samo głośno
 * z lewej i prawej, więc mob 30 bloków dalej brzmiał jakby stał obok.
 */
export interface Listener {
  x: number;
  y: number;
  z: number;
  /** Obrót kamery (0 = patrzymy w −Z, jak w silniku). */
  yaw: number;
}

let listener: Listener = { x: 0, y: 0, z: 0, yaw: 0 };

/** Silnik woła to raz na klatkę (pozycja oczu i obrót kamery). */
export function setListener(x: number, y: number, z: number, yaw: number) {
  listener = { x, y, z, yaw };
}

export interface Placed {
  /** Głośność po tłumieniu odległością (0–1). */
  gain: number;
  /** −1 = lewe ucho, 0 = środek, 1 = prawe. */
  pan: number;
  /** Tłumienie wysokich tonów w oddali (jak powietrze w grze). */
  dull: number;
}

/**
 * Pozycja dźwięku względem gracza. Zwraca `null`, gdy jest poza zasięgiem
 * słyszalności – wtedy nie tworzymy w ogóle węzłów (oszczędność).
 */
export function placeAt(x: number, y: number, z: number, distance = 16): Placed | null {
  const dx = x - listener.x;
  const dy = y - listener.y;
  const dz = z - listener.z;
  const d = Math.hypot(dx, dy, dz);
  if (d >= distance) return null;
  const gain = Math.max(0, 1 - d / distance);
  // Panorama: rzut kierunku na prawo od kamery (cos/sin obrotu).
  const rightX = Math.cos(listener.yaw);
  const rightZ = -Math.sin(listener.yaw);
  const flat = Math.hypot(dx, dz) || 1;
  const pan = Math.max(-1, Math.min(1, ((dx * rightX + dz * rightZ) / flat) * Math.min(1, flat / 2)));
  return { gain: gain * gain, pan, dull: Math.min(1, d / distance) };
}

/** Wspólne wyjście z opcjonalną pozycją (głośność + panorama + filtr). */
function outAt(node: AudioNode, where?: Placed | null) {
  const c = ctx;
  if (!master || !c) return;
  if (!where) {
    node.connect(master);
    return;
  }
  if (where.gain <= 0.002) return;
  const g = c.createGain();
  g.gain.value = where.gain;
  const p = c.createStereoPanner();
  p.pan.value = where.pan;
  // W oddali wanilia gra ciszej i „ciemniej” – dodajemy łagodny dolnoprzepust.
  if (where.dull > 0.35) {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 16000 - where.dull * 11000;
    node.connect(lp).connect(g).connect(p).connect(master);
    return;
  }
  node.connect(g).connect(p).connect(master);
}

function ensure(): AudioContext | null {
  if (broken) return null;
  if (!ctx) {
    try {
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const AC = w.AudioContext || w.webkitAudioContext;
      if (!AC) throw new Error('Web Audio API unavailable');
      const c = new AC();
      const m = c.createGain();
      m.gain.value = volume;
      // 2.31: limiter jak w wanilii – przy kilkunastu mobach i rozbijanym
      // bloku naraz miks nie przesterowuje się (twarde cięcie słychać było
      // jako trzask). Próg wysoko, więc pojedyncze dźwięki są nietknięte.
      const lim = c.createDynamicsCompressor();
      lim.threshold.value = -6;
      lim.knee.value = 3;
      lim.ratio.value = 16;
      lim.attack.value = 0.004;
      lim.release.value = 0.2;
      lim.connect(c.destination);
      m.connect(lim);
      const buf = c.createBuffer(1, Math.max(1, c.sampleRate), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      master = m;
      noiseBuf = buf;
      ctx = c;
      buildRoom(c, m, lim);
    } catch (e) {
      broken = true;
      console.warn('Audio disabled:', e);
      return null;
    }
  }
  try {
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* ignore */
  }
  return ctx;
}

export function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (master) {
    try {
      master.gain.value = volume;
    } catch {
      /* ignore */
    }
  }
}

/**
 * 2.29: barwy materiałów w stylu wanilii.
 *
 * Waniliowy odgłos bloku to krótki szum z rezonansem (filtr pasmowy) plus
 * „korpus” – niskie uderzenie, które słychać pod palcami. Do 2.28 graliśmy
 * samym szumem, więc drewno i kamień brzmiały jak suchy trzask. Teraz każdy
 * materiał ma własną częstotliwość rezonansu, dobroć filtru i wysokość
 * korpusu – drewno jest ciepłe, kamień twardszy, wełna głucha.
 */
const MAT: Record<Kind, { freq: number; q: number; body: number; decay: number; grain: number }> = {
  stone: { freq: 1050, q: 1.1, body: 210, decay: 0.16, grain: 0.5 },
  wood: { freq: 640, q: 2.4, body: 165, decay: 0.18, grain: 0.45 },
  grass: { freq: 2600, q: 0.7, body: 320, decay: 0.12, grain: 0.25 },
  sand: { freq: 3300, q: 0.5, body: 420, decay: 0.11, grain: 0.2 },
  glass: { freq: 4200, q: 5, body: 900, decay: 0.13, grain: 0.6 },
  cloth: { freq: 1250, q: 0.7, body: 150, decay: 0.1, grain: 0.15 },
  slime: { freq: 700, q: 1.3, body: 95, decay: 0.2, grain: 0.15 },
  // 2.31: metale dzwonią wysoko i długo (`block.metal` w wanilii).
  metal: { freq: 1750, q: 7.5, body: 340, decay: 0.3, grain: 0.55 },
};

/** Niskie „korpus” uderzenia – to on sprawia, że blok ma masę. */
function bodyThump(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', where?: Placed | null) {
  const c = ensure();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  const t = c.currentTime;
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.55), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  outAt(g, where);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noiseBurst(freq: number, q: number, dur: number, gain: number, where?: Placed | null) {
  const c = ensure();
  if (!c || !master || !noiseBuf) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq * (0.85 + Math.random() * 0.3);
  f.Q.value = q;
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g);
  outAt(g, where);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

/** Wspólne tłumienie dla jednego zdarzenia (jedno miejsce = jedna panorama). */
function at(x?: number, y?: number, z?: number, distance = 16): Placed | null | undefined {
  if (x === undefined || y === undefined || z === undefined) return undefined;
  return placeAt(x, y, z, distance);
}

/**
 * 2.31: dźwięk bloku z pozycją – teraz słychać, skąd dochodzi.
 * Wanilia gra przy rozbiciu 4 ziarna szumu o losowej wysokości, dlatego
 * tutaj też jest ich kilka, a nie jeden „klik”.
 */
export function playBreak(kind: Kind, x?: number, y?: number, z?: number) {
  const m = MAT[kind];
  const w = at(x, y, z, 16);
  if (w === null) return;
  const grains = kind === 'grass' || kind === 'sand' ? 4 : 3;
  for (let i = 0; i < grains; i++) {
    noiseBurst(m.freq * (0.8 + Math.random() * 0.5), m.q * (0.8 + Math.random() * 0.5), m.decay * (0.9 + Math.random() * 0.7), 0.5 / grains * 2, w);
  }
  bodyThump(m.body, m.decay, 0.16 * m.grain, 'sine', w);
  if (kind === 'glass') {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => noiseBurst(4800 + Math.random() * 2400, 9, 0.16, 0.32, w), i * 38);
    }
    bodyThump(1500, 0.12, 0.05, 'triangle', w);
  }
}
export function playPlace(kind: Kind, x?: number, y?: number, z?: number) {
  const m = MAT[kind];
  const w = at(x, y, z, 16);
  if (w === null) return;
  noiseBurst(m.freq * 0.75, m.q * 1.15, m.decay * 0.85, 0.5, w);
  bodyThump(m.body, m.decay * 0.8, 0.12 * m.grain + 0.03, 'sine', w);
}
export function playDig(kind: Kind, x?: number, y?: number, z?: number) {
  const m = MAT[kind];
  const w = at(x, y, z, 16);
  if (w === null) return;
  noiseBurst(m.freq * (0.9 + Math.random() * 0.25), m.q, 0.06, 0.28, w);
  if (Math.random() < 0.5) bodyThump(m.body * 0.9, 0.07, 0.03, 'sine', w);
}
export function playStep(kind: Kind) {
  // Własny krok gracza – zawsze „przy uchu”, więc bez tłumienia.
  const m = MAT[kind];
  noiseBurst(m.freq * (0.85 + Math.random() * 0.3), m.q, 0.075, 0.16);
  bodyThump(m.body * 0.8, 0.06, 0.018);
}

/** 2.31: skrzynia – waniliowe `block.chest.open` / `block.chest.close`. */
export function playChest(open: boolean, x?: number, y?: number, z?: number) {
  const c = ensure();
  const w = at(x, y, z, 16);
  if (!c || !master || w === null) return;
  const t = c.currentTime;
  const bus = c.createGain();
  bus.gain.value = open ? 0.9 : 0.8;
  outAt(bus, w);
  // skrzypnięcie zawiasu + głuche uderzenie wieka
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(open ? 210 : 180, t);
  o.frequency.linearRampToValueAtTime(open ? 265 : 140, t + 0.18);
  g.gain.setValueAtTime(0.0001, t);
  // 2.31: skrzynia była o ~10 dB za cicha względem waniliowego `chest.open`.
  g.gain.linearRampToValueAtTime(0.09, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 900;
  bp.Q.value = 4;
  o.connect(bp).connect(g).connect(bus);
  o.start(t);
  o.stop(t + 0.24);
  grain(t + 0.02, 640, 2.2, 0.08, 0.26, bus);
  bodyThumpAt(open ? 120 : 150, 0.12, open ? 0.16 : 0.22, bus, t + 0.06);
}

/**
 * Drzwi: przy otwieraniu skrzypienie zawiasu, przy zamykaniu głuche
 * klaśnięcie. Wanilia ma osobne `wooden_door.open` i `.close` – tutaj oba
 * powstają z tego samego materiału, tylko z innym przebiegiem.
 */
export function playDoor(open: boolean) {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime;
  if (open) {
    const o = c.createOscillator();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(190, t);
    o.frequency.linearRampToValueAtTime(240, t + 0.1);
    o.frequency.linearRampToValueAtTime(150, t + 0.3);
    f.type = 'bandpass';
    f.frequency.value = 700;
    f.Q.value = 7;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    o.connect(f).connect(g);
    out(g);
    o.start(t);
    o.stop(t + 0.36);
    noiseBurst(520, 2.2, 0.1, 0.18);
    setTimeout(() => bodyThump(140, 0.12, 0.06), 250);
  } else {
    noiseBurst(480, 2.6, 0.12, 0.3);
    bodyThump(150, 0.16, 0.1);
  }
}

/** Łóżko: miękkie skrzypienie materaca po przespanej nocy. */
export function playBed() {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime;
  for (const [delay, freq] of [[0, 320], [0.16, 270]] as [number, number][]) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t + delay);
    o.frequency.linearRampToValueAtTime(freq * 0.72, t + delay + 0.3);
    g.gain.setValueAtTime(0.0001, t + delay);
    g.gain.linearRampToValueAtTime(0.045, t + delay + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.35);
    o.connect(g);
    out(g);
    o.start(t + delay);
    o.stop(t + delay + 0.38);
  }
  noiseBurst(1100, 0.8, 0.22, 0.12);
}
export function playSplash() {
  // plusk: szeroki szum + kilka bąbelków o rosnącej wysokości
  noiseBurst(1600, 0.45, 0.32, 0.5);
  noiseBurst(700, 0.9, 0.22, 0.3);
  const c = ensure();
  if (!c || !master) return;
  for (let i = 0; i < 4; i++) {
    const o = c.createOscillator();
    const g = c.createGain();
    const t = c.currentTime + 0.03 + i * 0.05 + Math.random() * 0.02;
    o.type = 'sine';
    o.frequency.setValueAtTime(420 + Math.random() * 380, t);
    o.frequency.exponentialRampToValueAtTime(900 + Math.random() * 700, t + 0.05);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(g);
    out(g);
    o.start(t);
    o.stop(t + 0.11);
  }
}
export function playHurt() {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime;
  // dwa tony: krótkie „uh” i niżej opadający jęk – waniliowy odgłos bólu jest
  // bardziej głosem niż kliknięciem, dlatego dokładamy drugą warstwę.
  for (const [dt, f0, f1, gain, dur] of [[0, 330, 170, 0.16, 0.16], [0.05, 240, 110, 0.1, 0.22]] as [number, number, number, number, number][]) {
    const o = c.createOscillator();
    const g = c.createGain();
    const f = c.createBiquadFilter();
    o.type = 'sawtooth';
    f.type = 'lowpass';
    f.frequency.value = 900;
    o.frequency.setValueAtTime(f0, t + dt);
    o.frequency.exponentialRampToValueAtTime(f1, t + dt + dur);
    g.gain.setValueAtTime(0.0001, t + dt);
    g.gain.linearRampToValueAtTime(gain, t + dt + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dt + dur);
    o.connect(f).connect(g);
    out(g);
    o.start(t + dt);
    o.stop(t + dt + dur + 0.02);
  }
  noiseBurst(1400, 1.1, 0.08, 0.12);
}
// ------------------------------------------------------------ głosy mobów
/**
 * 2.31: silnik głosów mobów.
 *
 * Waniliowe dźwięki zwierząt to nagrania: mają formanty (rezonanse gardła
 * i pyska), wibrato (beczenie owcy), szum oddechu i krótkie ziarna
 * (klikanie kości szkieletu, syk pająka). Nie wolno nam użyć plików z gry,
 * więc odtwarzamy **barwę** proceduralnie: oscylator przez bank filtrów
 * formantowych, modulacja wysokości, szum i obwiednie. Każdy mob ma trzy
 * warianty (bezczynność, trafienie, śmierć) i własny odgłos kroków.
 */
export type MobVoiceKey =
  | 'pig' | 'sheep' | 'cow' | 'chicken' | 'creeper' | 'spider' | 'skeleton'
  | 'zombie' | 'wolf' | 'villager' | 'golem' | 'enderman' | 'slime' | 'ghast';

interface VoiceSpec {
  wave: OscillatorType;
  from: number;
  to: number;
  dur: number;
  /** Formanty: [częstotliwość, dobroć, głośność]. */
  formants: [number, number, number][];
  /** Wibrato: [głębokość w półtonach, szybkość Hz]. */
  vibrato?: [number, number];
  /** Szum oddechu: [częstotliwość, Q, głośność]. */
  breath?: [number, number, number];
  /** Ziarna (kliknięcia): [ile, częstotliwość, Q, długość, odstęp]. */
  grains?: [number, number, number, number, number];
  /** Miękki atak w sekundach – wilk i ghast startują powoli. */
  attack?: number;
}

export interface MobVoice {
  idle: VoiceSpec;
  hurt: VoiceSpec;
  death: VoiceSpec;
  /** Rodzaj stąpania: miękki, twardy, kościany, metaliczny, mokry. */
  step: 'soft' | 'hard' | 'bone' | 'metal' | 'slime';
}

/**
 * Parametry dobrane do waniliowych nagrań: świnia to nosowy, szybko
 * drgający grunt, owca beczy z wibratem ok. 9 Hz, krowa ma długie,
 * niskie „muu”, szkielet klika kośćmi, a creeper syczy bez tonu.
 */
export const MOB_VOICES: Record<MobVoiceKey, MobVoice> = {
  pig: {
    idle: { wave: 'sawtooth', from: 240, to: 185, dur: 0.30, formants: [[520, 4, 0.6], [1180, 6, 0.32]], vibrato: [1.5, 26], breath: [1400, 0.9, 0.18] },
    hurt: { wave: 'sawtooth', from: 305, to: 245, dur: 0.22, formants: [[600, 4, 0.6], [1300, 6, 0.3]], vibrato: [2.2, 30], breath: [1800, 1, 0.3] },
    death: { wave: 'sawtooth', from: 260, to: 130, dur: 0.55, formants: [[520, 4, 0.55], [1150, 6, 0.28]], vibrato: [2, 22], breath: [1500, 0.9, 0.26] },
    step: 'soft',
  },
  sheep: {
    idle: { wave: 'triangle', from: 445, to: 362, dur: 0.62, formants: [[760, 5, 0.62], [1900, 7, 0.3]], vibrato: [2.6, 9], breath: [2400, 0.8, 0.12] },
    hurt: { wave: 'triangle', from: 520, to: 430, dur: 0.34, formants: [[820, 5, 0.62], [2000, 7, 0.3]], vibrato: [3, 11], breath: [2600, 0.8, 0.18] },
    death: { wave: 'triangle', from: 470, to: 232, dur: 0.8, formants: [[760, 5, 0.6], [1900, 7, 0.28]], vibrato: [3.4, 8], breath: [2300, 0.8, 0.2] },
    step: 'soft',
  },
  cow: {
    idle: { wave: 'sawtooth', from: 156, to: 118, dur: 0.95, formants: [[390, 5, 0.66], [880, 7, 0.32]], vibrato: [0.7, 5], breath: [650, 0.6, 0.16], attack: 0.07 },
    hurt: { wave: 'sawtooth', from: 190, to: 148, dur: 0.5, formants: [[430, 5, 0.66], [950, 7, 0.3]], vibrato: [1.1, 7], breath: [800, 0.7, 0.2] },
    death: { wave: 'sawtooth', from: 168, to: 84, dur: 1.1, formants: [[380, 5, 0.6], [860, 7, 0.28]], vibrato: [0.9, 4], breath: [620, 0.6, 0.22] },
    step: 'soft',
  },
  chicken: {
    idle: { wave: 'square', from: 1120, to: 880, dur: 0.13, formants: [[2300, 6, 0.4], [3400, 8, 0.25]], grains: [2, 2600, 3, 0.03, 0.07] },
    hurt: { wave: 'square', from: 1320, to: 1000, dur: 0.1, formants: [[2500, 6, 0.42], [3600, 8, 0.24]], grains: [3, 2900, 3, 0.025, 0.05] },
    death: { wave: 'square', from: 1150, to: 600, dur: 0.3, formants: [[2200, 6, 0.4], [3300, 8, 0.22]], grains: [4, 2000, 3, 0.04, 0.05] },
    step: 'soft',
  },
  zombie: {
    idle: { wave: 'sawtooth', from: 118, to: 96, dur: 0.8, formants: [[430, 6, 0.6], [1020, 8, 0.26]], vibrato: [0.8, 4], breath: [900, 0.7, 0.22], attack: 0.09 },
    hurt: { wave: 'sawtooth', from: 152, to: 118, dur: 0.4, formants: [[470, 6, 0.6], [1080, 8, 0.26]], vibrato: [1.2, 6], breath: [1100, 0.8, 0.3] },
    death: { wave: 'sawtooth', from: 122, to: 68, dur: 1.0, formants: [[420, 6, 0.55], [980, 8, 0.24]], vibrato: [1, 4], breath: [860, 0.7, 0.28] },
    step: 'hard',
  },
  skeleton: {
    idle: { wave: 'triangle', from: 300, to: 240, dur: 0.2, formants: [[1800, 6, 0.22]], grains: [6, 2400, 4, 0.028, 0.085] },
    hurt: { wave: 'triangle', from: 345, to: 275, dur: 0.2, formants: [[2000, 6, 0.28]], grains: [4, 2600, 5, 0.022, 0.055] },
    death: { wave: 'triangle', from: 265, to: 150, dur: 0.6, formants: [[1700, 6, 0.2]], grains: [9, 2000, 3, 0.05, 0.11] },
    step: 'bone',
  },
  creeper: {
    idle: { wave: 'sine', from: 72, to: 60, dur: 0.55, formants: [], breath: [3200, 0.7, 0.4] },
    hurt: { wave: 'sine', from: 180, to: 140, dur: 0.3, formants: [], breath: [2600, 0.8, 0.5] },
    death: { wave: 'sine', from: 122, to: 58, dur: 0.85, formants: [], breath: [3000, 0.6, 0.55] },
    step: 'soft',
  },
  spider: {
    idle: { wave: 'sawtooth', from: 640, to: 520, dur: 0.22, formants: [[1400, 7, 0.34]], grains: [5, 3400, 6, 0.02, 0.06], breath: [2600, 1.2, 0.2] },
    hurt: { wave: 'sawtooth', from: 700, to: 600, dur: 0.18, formants: [[1500, 7, 0.36]], grains: [4, 3800, 8, 0.02, 0.05], breath: [2800, 1.2, 0.26] },
    death: { wave: 'sawtooth', from: 600, to: 300, dur: 0.5, formants: [[1300, 7, 0.34]], grains: [8, 3200, 6, 0.03, 0.07], breath: [2400, 1.2, 0.22] },
    step: 'hard',
  },
  wolf: {
    idle: { wave: 'sawtooth', from: 148, to: 212, dur: 0.34, formants: [[620, 6, 0.5], [1450, 8, 0.22]], breath: [1700, 1, 0.16] },
    hurt: { wave: 'sawtooth', from: 320, to: 180, dur: 0.22, formants: [[720, 6, 0.5], [1600, 8, 0.22]], vibrato: [2, 14], breath: [1900, 1, 0.2] },
    death: { wave: 'sawtooth', from: 300, to: 150, dur: 0.7, formants: [[650, 6, 0.48], [1500, 8, 0.2]], vibrato: [1.6, 9], breath: [1700, 1, 0.22] },
    step: 'soft',
  },
  villager: {
    idle: { wave: 'triangle', from: 320, to: 268, dur: 0.42, formants: [[520, 7, 0.68], [1180, 9, 0.36]], vibrato: [0.6, 6], breath: [1200, 1, 0.08] },
    hurt: { wave: 'triangle', from: 382, to: 302, dur: 0.25, formants: [[560, 7, 0.68], [1240, 9, 0.36]], vibrato: [1, 8], breath: [1400, 1, 0.12] },
    death: { wave: 'triangle', from: 340, to: 190, dur: 0.7, formants: [[520, 7, 0.62], [1150, 9, 0.34]], vibrato: [0.9, 5], breath: [1200, 1, 0.14] },
    step: 'soft',
  },
  golem: {
    idle: { wave: 'square', from: 88, to: 64, dur: 0.8, formants: [[250, 4, 0.55], [720, 9, 0.32]], breath: [600, 3, 0.32], attack: 0.06 },
    hurt: { wave: 'square', from: 122, to: 92, dur: 0.35, formants: [[300, 4, 0.55], [820, 9, 0.32]], breath: [900, 2, 0.4] },
    death: { wave: 'square', from: 92, to: 45, dur: 1.2, formants: [[240, 4, 0.5], [700, 9, 0.3]], breath: [500, 2, 0.34] },
    step: 'metal',
  },
  enderman: {
    idle: { wave: 'sine', from: 340, to: 200, dur: 0.75, formants: [[900, 9, 0.56], [2100, 11, 0.34]], breath: [1600, 1, 0.22], attack: 0.16 },
    hurt: { wave: 'sine', from: 420, to: 300, dur: 0.28, formants: [[980, 9, 0.56], [2200, 11, 0.34]], breath: [1900, 1, 0.26] },
    death: { wave: 'sine', from: 380, to: 140, dur: 1.0, formants: [[880, 9, 0.54], [2000, 11, 0.32]], breath: [1500, 1, 0.24] },
    step: 'hard',
  },
  slime: {
    idle: { wave: 'sine', from: 210, to: 130, dur: 0.28, formants: [], breath: [600, 1.2, 0.14] },
    hurt: { wave: 'sine', from: 262, to: 172, dur: 0.2, formants: [], breath: [700, 1.2, 0.14] },
    death: { wave: 'sine', from: 200, to: 90, dur: 0.4, formants: [], breath: [520, 1.1, 0.16] },
    step: 'slime',
  },
  ghast: {
    idle: { wave: 'sine', from: 880, to: 720, dur: 1.2, formants: [[1500, 10, 0.32]], vibrato: [3, 5], breath: [2800, 1, 0.2], attack: 0.2 },
    hurt: { wave: 'sine', from: 980, to: 820, dur: 0.5, formants: [[1600, 10, 0.32]], vibrato: [3.4, 6], breath: [3000, 1, 0.24] },
    death: { wave: 'sine', from: 900, to: 380, dur: 1.6, formants: [[1500, 10, 0.3]], vibrato: [2.6, 4], breath: [2700, 1, 0.22] },
    step: 'soft',
  },
};

/** Szum z obwiednią i filtrem – jedno ziarno (klik, syk, stuk). */
function grain(at: number, freq: number, q: number, dur: number, gain: number, dest: AudioNode) {
  const c = ensure();
  if (!c || !noiseBuf) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.85 + Math.random() * 0.35;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq * (0.9 + Math.random() * 0.2);
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0005, at + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(at, Math.random() * Math.max(0, 1 - dur - 0.05));
  src.stop(at + dur + 0.02);
}

/**
 * Renderuje jeden głos: nośnik przez formanty + szum oddechu + ziarna.
 * `pitch` skaluje wysokość (każdy osobnik brzmi trochę inaczej, ±6%).
 */
function renderVoice(spec: VoiceSpec, where: Placed | null | undefined, pitch = 1) {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime + 0.005;
  const bus = c.createGain();
  // Formanty pasmowe zabierają większość energii, więc głos dostaje własne
  // wyrównanie – inaczej mob sprzed nosa był ledwie słyszalny.
  bus.gain.value = 1.7;
  outAt(bus, where);
  const f0 = spec.from * pitch;
  const f1 = spec.to * pitch;
  const dur = Math.max(0.05, spec.dur);

  // --- nośnik („struny głosowe”)
  const o = c.createOscillator();
  o.type = spec.wave;
  o.frequency.setValueAtTime(f0, t);
  if (Math.abs(f1 - f0) > 1) o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  if (spec.vibrato) {
    const [depth, rate] = spec.vibrato;
    const lfo = c.createOscillator();
    const amp = c.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = rate;
    amp.gain.value = depth * 100; // półtony → centy
    lfo.connect(amp).connect(o.detune);
    lfo.start(t);
    lfo.stop(t + dur + 0.1);
  }
  const env = c.createGain();
  const attack = Math.min(dur * 0.9, spec.attack ?? 0.02);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(0.62, t + Math.max(0.008, attack));
  env.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(env);

  if (spec.formants.length === 0) {
    env.connect(bus);
  } else {
    // formanty równolegle – to one nadają „zwierzęcy” barwę
    for (const [freq, q, gain] of spec.formants) {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = Math.min(12000, freq * pitch);
      bp.Q.value = q;
      const g = c.createGain();
      g.gain.value = gain;
      env.connect(bp).connect(g).connect(bus);
    }
  }
  o.start(t);
  o.stop(t + dur + 0.05);

  // --- szum oddechu / syk
  if (spec.breath) {
    const [freq, q, gain] = spec.breath;
    grain(t, freq, q, dur * 0.95, gain * 0.5, bus);
  }
  // --- ziarna (klikanie kości, chityna, chrząkanie)
  if (spec.grains) {
    const [count, freq, q, gDur, spread] = spec.grains;
    for (let i = 0; i < count; i++) grain(t + i * spread, freq, q, gDur, 0.3, bus);
  }
}

/**
 * Dźwięk moba. `kind`: bezczynność, trafienie albo śmierć. `x/y/z` to
 * pozycja w świecie (dźwięk jest wtedy tłumiony odległością i panoramowany,
 * jak w grze).
 */
export function playMob(
  type: MobVoiceKey,
  kind: 'idle' | 'hurt' | 'death' = 'idle',
  x?: number,
  y?: number,
  z?: number,
) {
  const voice = MOB_VOICES[type] ?? MOB_VOICES.pig;
  const spec = voice[kind];
  const where = x === undefined || y === undefined || z === undefined ? null : placeAt(x, y, z, kind === 'death' ? 24 : 20);
  if (where === null && x !== undefined) return; // poza zasięgiem
  // Wanilia losuje wysokość dla każdego osobnika i każdego dźwięku (±6%).
  const pitch = 0.94 + Math.random() * 0.12;
  renderVoice(spec, where, pitch);
}

/** Krok moba – inny dla miękkich łap, kości, metalu i szlamu. */
export function playMobStep(
  type: MobVoiceKey,
  x?: number,
  y?: number,
  z?: number,
) {
  const where = x === undefined || y === undefined || z === undefined ? null : placeAt(x, y, z, 12);
  if (where === null && x !== undefined) return;
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime;
  const bus = c.createGain();
  bus.gain.value = 1;
  outAt(bus, where);
  const kind = (MOB_VOICES[type] ?? MOB_VOICES.pig).step;
  // Waniliowy krok moba to krótki, tępy szum (~0,15 s) z miękkim brzuchem.
  // Wcześniej był dwa razy za krótki i o ~12 dB za cichy – ginął w tle.
  if (kind === 'bone') {
    grain(t, 2100, 4, 0.12, 0.42, bus);
    grain(t + 0.05, 3000, 5, 0.09, 0.28, bus);
    bodyThumpAt(150, 0.1, 0.12, bus, t);
  } else if (kind === 'metal') {
    grain(t, 950, 7, 0.17, 0.4, bus);
    bodyThumpAt(120, 0.14, 0.16, bus, t);
  } else if (kind === 'slime') {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(175, t);
    o.frequency.exponentialRampToValueAtTime(88, t + 0.14);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + 0.19);
    grain(t, 620, 1.2, 0.1, 0.12, bus);
  } else if (kind === 'hard') {
    grain(t, 420, 1.3, 0.14, 0.36, bus);
    bodyThumpAt(95, 0.12, 0.18, bus, t);
  } else {
    grain(t, 560, 1.1, 0.13, 0.3, bus);
    bodyThumpAt(135, 0.1, 0.12, bus, t);
  }
}

/** Niskie uderzenie wpięte w konkretny węzeł (dla kroków i głosów). */
function bodyThumpAt(freq: number, dur: number, gain: number, dest: AudioNode, at: number, type: OscillatorType = 'sine') {
  const c = ensure();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  o.frequency.exponentialRampToValueAtTime(Math.max(35, freq * 0.6), at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.001, at + dur);
  o.connect(g).connect(dest);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** Dzwon wioski: dwa szybkie, metaliczne uderzenia. */
export function playBell() {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime;
  for (const [delay, freq] of [[0, 1180], [0.18, 880]] as [number, number][]) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t + delay);
    o.frequency.exponentialRampToValueAtTime(freq * 0.82, t + delay + 0.6);
    g.gain.setValueAtTime(0.0001, t + delay);
    g.gain.linearRampToValueAtTime(0.12, t + delay + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.9);
    o.connect(g);
    out(g);
    o.start(t + delay);
    o.stop(t + delay + 1);
  }
}

export function playExplosion() {
  const c = ensure();
  if (!c || !master || !noiseBuf) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.3;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 600;
  f.frequency.exponentialRampToValueAtTime(120, t + 1.2);
  const g = c.createGain();
  g.gain.setValueAtTime(1.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
  src.connect(f).connect(g);
  out(g);
  src.start(t);
  src.stop(t + 1.7);
  // niski „bum” pod szumem – bez niego wybuch brzmi jak zdmuchnięcie
  bodyThump(70, 0.9, 0.5, 'sine');
  // gruz spadający chwilę po wybuchu
  noiseBurst(2600, 0.7, 0.5, 0.16);
  setTimeout(() => noiseBurst(1800, 0.9, 0.35, 0.1), 220);
}
export function playFuse() {
  noiseBurst(6000, 0.8, 0.6, 0.25);
}
export function playPop() {
  const c = ensure();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  const t = c.currentTime;
  o.frequency.setValueAtTime(600 + Math.random() * 400, t);
  o.frequency.exponentialRampToValueAtTime(1400, t + 0.06);
  g.gain.setValueAtTime(0.08, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  o.connect(g);
  out(g);
  o.start(t);
  o.stop(t + 0.1);
}
export function playEat() {
  // chrupnięcie: trzy krótkie szumy o nierównej sile, jak w wanilii
  noiseBurst(900, 2.2, 0.09, 0.32);
  setTimeout(() => noiseBurst(780, 2.6, 0.07, 0.2), 70);
  setTimeout(() => noiseBurst(1000, 2.0, 0.06, 0.14), 135);
  const c = ensure();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  const t = c.currentTime;
  o.type = 'triangle';
  o.frequency.setValueAtTime(420, t);
  o.frequency.exponentialRampToValueAtTime(180, t + 0.12);
  g.gain.setValueAtTime(0.08, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  o.connect(g);
  out(g);
  o.start(t);
  o.stop(t + 0.16);
}

/** 2.4: potion glug – two liquid blips rising in pitch. */
export function playDrink() {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime;
  [0, 0.11].forEach((off, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(260 + i * 120, t + off);
    o.frequency.exponentialRampToValueAtTime(140 + i * 60, t + off + 0.09);
    g.gain.setValueAtTime(0.09, t + off);
    g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.1);
    o.connect(g).connect(master!);
    o.start(t + off);
    o.stop(t + off + 0.12);
  });
}

/** Bow release and arrow impact. */
export function playBow() {
  const c = ensure();
  if (!c || !master) return;
  // cięciwa: krótki świst szumu razem z tonem
  noiseBurst(2400, 1.6, 0.09, 0.16);
  const o = c.createOscillator();
  const g = c.createGain();
  const t = c.currentTime;
  o.type = 'triangle';
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(620, t + 0.09);
  g.gain.setValueAtTime(0.1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  o.connect(g);
  out(g);
  o.start(t);
  o.stop(t + 0.16);
}

export function playArrowHit() {
  const c = ensure();
  if (!c || !master || !noiseBuf) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 1.6;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2200;
  f.Q.value = 1.4;
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.connect(f).connect(g);
  out(g);
  src.start(t, Math.random() * 0.4);
  src.stop(t + 0.16);
}

/** Level-up chime: two quick rising notes with a soft tail. */
export function playLevelUp() {
  const c = ensure();
  if (!c || !master) return;
  const t0 = c.currentTime;
  for (const [i, f] of [523.25, 783.99].entries()) {
    const o = c.createOscillator();
    const g = c.createGain();
    const t = t0 + i * 0.11;
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g);
    out(g);
    o.start(t);
    o.stop(t + 0.55);
  }
}

/** Enchanting table: a shimmering, rising chime. */
export function playEnchant() {
  const c = ensure();
  if (!c || !master) return;
  const t0 = c.currentTime;
  const notes = [659.25, 830.61, 987.77, 1318.51];
  notes.forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    const t = t0 + i * 0.07;
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g).connect(master!);
    o.start(t);
    o.stop(t + 0.75);
  });
}

/** Shield parry: a dull metallic clank. */
export function playShield() {
  const c = ensure();
  if (!c || !master || !noiseBuf) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 2.4;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1400;
  f.Q.value = 6;
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  src.connect(f).connect(g);
  out(g);
  src.start(t, Math.random() * 0.3);
  src.stop(t + 0.18);
  const o = c.createOscillator();
  const og = c.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(220, t);
  og.gain.setValueAtTime(0.05, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  o.connect(og);
  out(og);
  o.start(t);
  o.stop(t + 0.1);
}

/** A short wind gust – filtered noise that slowly opens up. */
export function playWind() {
  const c = ensure();
  if (!c || !master || !noiseBuf) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 320;
  f.Q.value = 0.8;
  const g = c.createGain();
  const t = c.currentTime;
  const len = 2.5 + Math.random() * 2;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + len * 0.45);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  f.frequency.linearRampToValueAtTime(520 + Math.random() * 300, t + len);
  src.connect(f).connect(g);
  out(g);
  src.start(t);
  src.stop(t + len + 0.05);
}

/** A few bird chirps – daytime ambience on the surface. */
export function playBird() {
  const c = ensure();
  if (!c || !master) return;
  const notes = 2 + Math.floor(Math.random() * 3);
  const base = 1900 + Math.random() * 1400;
  for (let i = 0; i < notes; i++) {
    const o = c.createOscillator();
    const g = c.createGain();
    const t = c.currentTime + i * (0.09 + Math.random() * 0.13);
    o.type = 'sine';
    o.frequency.setValueAtTime(base * (1 + Math.random() * 0.25), t);
    o.frequency.exponentialRampToValueAtTime(base * (0.7 + Math.random() * 0.3), t + 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    o.connect(g);
    out(g);
    o.start(t);
    o.stop(t + 0.13);
  }
}

/** Low cave drone plus a water drop – tells the player they are underground. */
export function playCave() {
  const c = ensure();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  const t = c.currentTime;
  o.type = 'sine';
  o.frequency.setValueAtTime(55 + Math.random() * 45, t);
  o.frequency.linearRampToValueAtTime(48 + Math.random() * 30, t + 3);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06, t + 0.9);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
  o.connect(g);
  out(g);
  o.start(t);
  o.stop(t + 3.3);
  if (Math.random() < 0.6) {
    const d = c.createOscillator();
    const dg = c.createGain();
    const dt = t + 0.6 + Math.random() * 1.6;
    d.type = 'sine';
    d.frequency.setValueAtTime(900 + Math.random() * 700, dt);
    d.frequency.exponentialRampToValueAtTime(400, dt + 0.09);
    dg.gain.setValueAtTime(0.0001, dt);
    dg.gain.exponentialRampToValueAtTime(0.05, dt + 0.008);
    dg.gain.exponentialRampToValueAtTime(0.0001, dt + 0.14);
    d.connect(dg);
    out(dg);
    d.start(dt);
    d.stop(dt + 0.16);
  }
}

/**
 * Ambient music: a slow, quiet pentatonic phrase. Minecraft-like games use it to
 * fill the silence while exploring; kept sparse and soft so it never fights the
 * sound effects.
 */
export function playMusic() {
  const c = ensure();
  if (!c || !master) return;
  // A minor pentatonic, two octaves – any order sounds calm.
  const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25];
  const notes = 3 + Math.floor(Math.random() * 3);
  const base = Math.floor(Math.random() * (scale.length - 4));
  for (let i = 0; i < notes; i++) {
    const o = c.createOscillator();
    const g = c.createGain();
    const t = c.currentTime + i * (0.55 + Math.random() * 0.4);
    const f = scale[base + Math.floor(Math.random() * 4)] * (Math.random() < 0.3 ? 2 : 1);
    o.type = Math.random() < 0.5 ? 'sine' : 'triangle';
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 1.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
    o.connect(g);
    out(g);
    o.start(t);
    o.stop(t + 4.4);
  }
}

export function playThunder() {
  const c = ensure();
  if (!c || !master || !noiseBuf) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.22;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 240;
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(0.7, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
  src.connect(f).connect(g);
  out(g);
  src.start(t);
  src.stop(t + 1.5);
}

let rainSrc: AudioBufferSourceNode | null = null;

export function setRain(on: boolean) {
  const c = ensure();
  if (!c || !master || !noiseBuf) return;
  if (on) {
    if (rainSrc) return;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.55;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 0.4;
    const g = c.createGain();
    g.gain.value = 0.16;
    src.connect(f).connect(g);
    out(g);
    src.start();
    rainSrc = src;
  } else if (rainSrc) {
    try {
      rainSrc.stop();
    } catch {
      /* already stopped */
    }
    rainSrc.disconnect();
    rainSrc = null;
  }
}

export function playNote(pitch: number, _belowId: number) {
  const c = ensure();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  const t = c.currentTime;
  // different instruments based on block below (future: use _belowId)
  const freq = 220 * Math.pow(2, (pitch % 24) / 12);
  o.type = 'square';
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
  o.connect(g);
  out(g);
  o.start(t);
  o.stop(t + 0.9);
}

export function playPortal() {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime;
  for (let i = 0; i < 3; i++) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(200 + i * 100, t + i * 0.1);
    o.frequency.exponentialRampToValueAtTime(80, t + i * 0.1 + 1.2);
    g.gain.setValueAtTime(0.08, t + i * 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 1.5);
    o.connect(g);
    out(g);
    o.start(t + i * 0.1);
    o.stop(t + i * 0.1 + 1.6);
  }
}

export function playSlime() {
  const c = ensure();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  const t = c.currentTime;
  o.type = 'sine';
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(90, t + 0.3);
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  o.connect(g);
  out(g);
  o.start(t);
  o.stop(t + 0.4);
}

export function unlockAudio() {
  ensure();
}
