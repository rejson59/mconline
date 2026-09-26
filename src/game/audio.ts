// Procedural sound effects generated with the Web Audio API.
// Every entry point is fail-safe: if the browser has no (or a blocked)
// AudioContext the game keeps running silently instead of throwing.
type Kind = 'stone' | 'wood' | 'grass' | 'sand' | 'glass' | 'cloth';

let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
let master: GainNode | null = null;
let broken = false; // audio unavailable -> stay silent
export let volume = 0.5;

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
      m.connect(c.destination);
      const buf = c.createBuffer(1, Math.max(1, c.sampleRate), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      master = m;
      noiseBuf = buf;
      ctx = c;
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

const KIND_FREQ: Record<Kind, [number, number]> = {
  stone: [900, 1.2],
  wood: [500, 3],
  grass: [2500, 0.7],
  sand: [3500, 0.5],
  glass: [4000, 4],
  cloth: [1200, 0.6],
};

function noiseBurst(freq: number, q: number, dur: number, gain: number) {
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
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

export function playBreak(kind: Kind) {
  const [f, q] = KIND_FREQ[kind];
  noiseBurst(f, q, 0.25, 0.9);
  if (kind === 'glass') {
    for (let i = 0; i < 3; i++) setTimeout(() => noiseBurst(5000 + Math.random() * 2000, 8, 0.15, 0.4), i * 40);
  }
}
export function playPlace(kind: Kind) {
  const [f, q] = KIND_FREQ[kind];
  noiseBurst(f * 0.8, q, 0.15, 0.7);
}
export function playDig(kind: Kind) {
  const [f, q] = KIND_FREQ[kind];
  noiseBurst(f, q, 0.08, 0.35);
}
export function playStep(kind: Kind) {
  const [f, q] = KIND_FREQ[kind];
  noiseBurst(f * 0.9, q, 0.09, 0.22);
}
export function playSplash() {
  noiseBurst(1500, 0.5, 0.4, 0.5);
}
export function playHurt() {
  const c = ensure();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'square';
  const t = c.currentTime;
  o.frequency.setValueAtTime(320, t);
  o.frequency.exponentialRampToValueAtTime(140, t + 0.18);
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.22);
}
export function playMob(type: 'pig' | 'zombie' | 'sheep' | 'cow' | 'chicken' | 'creeper' | 'spider' | 'skeleton' | 'wolf') {
  const c = ensure();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  const t = c.currentTime;
  if (type === 'pig') {
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(260, t);
    o.frequency.linearRampToValueAtTime(180, t + 0.25);
  } else if (type === 'sheep') {
    o.type = 'triangle';
    o.frequency.setValueAtTime(420, t);
    for (let i = 0; i < 6; i++) o.frequency.setValueAtTime(i % 2 ? 400 : 440, t + i * 0.05);
  } else if (type === 'cow') {
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(140, t);
    o.frequency.linearRampToValueAtTime(90, t + 0.45);
  } else if (type === 'chicken') {
    o.type = 'square';
    o.frequency.setValueAtTime(880, t);
    o.frequency.setValueAtTime(640, t + 0.08);
    o.frequency.setValueAtTime(980, t + 0.14);
  } else if (type === 'creeper') {
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.linearRampToValueAtTime(40, t + 0.35);
  } else if (type === 'spider') {
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(700, t);
    for (let i = 0; i < 8; i++) o.frequency.setValueAtTime(600 + Math.random() * 300, t + i * 0.04);
  } else if (type === 'skeleton') {
    o.type = 'square';
    o.frequency.setValueAtTime(900, t);
    for (let i = 0; i < 6; i++) o.frequency.setValueAtTime(i % 2 ? 700 : 1100, t + i * 0.03);
  } else if (type === 'wolf') {
    // wolf: a low growl that rises into a short yip
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t);
    o.frequency.linearRampToValueAtTime(170, t + 0.28);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.42);
  } else {
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t);
    o.frequency.linearRampToValueAtTime(80, t + 0.6);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.08, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  o.connect(f).connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.65);
}
export function playExplosion() {
  const c = ensure();
  if (!c || !master || !noiseBuf) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.3;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 600;
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(1.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + 1.7);
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
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.1);
}
export function playEat() {
  noiseBurst(900, 2.2, 0.12, 0.35);
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
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.16);
}

/** Bow release and arrow impact. */
export function playBow() {
  const c = ensure();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  const t = c.currentTime;
  o.type = 'triangle';
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(620, t + 0.09);
  g.gain.setValueAtTime(0.1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  o.connect(g).connect(master);
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
  src.connect(f).connect(g).connect(master);
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
    o.connect(g).connect(master);
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
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.3);
  src.stop(t + 0.18);
  const o = c.createOscillator();
  const og = c.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(220, t);
  og.gain.setValueAtTime(0.05, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  o.connect(og).connect(master);
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
  src.connect(f).connect(g).connect(master);
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
    o.connect(g).connect(master);
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
  o.connect(g).connect(master);
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
    d.connect(dg).connect(master);
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
    o.connect(g).connect(master);
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
  src.connect(f).connect(g).connect(master);
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
    src.connect(f).connect(g).connect(master);
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

export function unlockAudio() {
  ensure();
}
