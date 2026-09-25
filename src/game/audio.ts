let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
let master: GainNode | null = null;
export let volume = 0.5;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setVolume(v: number) {
  volume = v;
  if (master) master.gain.value = v;
}

type Kind = 'stone' | 'wood' | 'grass' | 'sand' | 'glass' | 'cloth';

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
  src.connect(f).connect(g).connect(master!);
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
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'square';
  const t = c.currentTime;
  o.frequency.setValueAtTime(320, t);
  o.frequency.exponentialRampToValueAtTime(140, t + 0.18);
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + 0.22);
}
export function playMob(type: 'pig' | 'zombie' | 'sheep') {
  const c = ensure();
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
  o.connect(f).connect(g).connect(master!);
  o.start(t);
  o.stop(t + 0.65);
}
export function playExplosion() {
  const c = ensure();
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
  src.connect(f).connect(g).connect(master!);
  src.start(t);
  src.stop(t + 1.7);
}
export function playFuse() {
  noiseBurst(6000, 0.8, 0.6, 0.25);
}
export function playPop() {
  const c = ensure();
  const o = c.createOscillator();
  const g = c.createGain();
  const t = c.currentTime;
  o.frequency.setValueAtTime(600 + Math.random() * 400, t);
  o.frequency.exponentialRampToValueAtTime(1400, t + 0.06);
  g.gain.setValueAtTime(0.08, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + 0.1);
}
export function unlockAudio() {
  ensure();
}
