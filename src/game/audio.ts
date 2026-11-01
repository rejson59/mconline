// Original Java 1.20.4 effects, embedded offline. Audio is NOT covered by MIT.
// See public/Minecraft-NOTICE.txt and scripts/compile-java-sounds.py.
import { JAVA_SOUND_EVENTS as BASE_EVENTS, JAVA_SOUND_FILES as BASE_FILES } from './art/javaSounds.generated';
import { RESCUE_SOUND_EVENTS, RESCUE_SOUND_FILES } from './art/javaRescue.generated';
const JAVA_SOUND_EVENTS = { ...BASE_EVENTS, ...RESCUE_SOUND_EVENTS };
const JAVA_SOUND_FILES = { ...BASE_FILES, ...RESCUE_SOUND_FILES };
import { B, BLOCKS } from './blocks';
import { SOUND_CATEGORIES, DEFAULT_SOUND_LEVELS, type SoundCategory, type SoundLevels } from '../utils/soundSettings';
export type { SoundCategory, SoundLevels } from '../utils/soundSettings';
type Kind = 'stone' | 'wood' | 'grass' | 'sand' | 'glass' | 'cloth' | 'slime' | 'metal';
export type MobVoiceKey = 'pig' | 'sheep' | 'cow' | 'chicken' | 'creeper' | 'spider' | 'skeleton' | 'zombie' | 'wolf' | 'villager' | 'golem' | 'enderman' | 'slime' | 'ghast';
export interface Listener { x: number; y: number; z: number; yaw: number }
export interface Placed { gain: number; pan: number; dull: number }
let listener: Listener = { x: 0, y: 0, z: 0, yaw: 0 };
export function setListener(x: number, y: number, z: number, yaw: number) { listener = { x, y, z, yaw }; }
export function placeAt(x: number, y: number, z: number, distance = 16): Placed | null {
  const dx = x - listener.x, dy = y - listener.y, dz = z - listener.z;
  const d = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(d) || distance <= 0 || d >= distance) return null;
  const flat = Math.hypot(dx, dz) || 1;
  const pan = Math.max(-1, Math.min(1, ((dx * Math.cos(listener.yaw) - dz * Math.sin(listener.yaw)) / flat) * Math.min(1, flat / 2)));
  return { gain: Math.max(0, 1 - d / distance), pan, dull: Math.min(1, d / distance) };
}

let ctx: AudioContext | null = null, master: GainNode | null = null;
let broken = false;
export let volume = .5;
let levels = { ...DEFAULT_SOUND_LEVELS };
const buses = new Map<SoundCategory, GainNode>();
const decoded = new Map<string, Promise<AudioBuffer | null>>();
const active = new Set<AudioBufferSourceNode>();
const musicNodes = new Set<OscillatorNode>();
let worldEpoch = 0;
const unit = (v: number, fallback = 1) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
function ensure(): AudioContext | null {
  if (broken) return null;
  try {
    if (!ctx) {
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const AC = w.AudioContext || w.webkitAudioContext;
      if (!AC) { broken = true; return null; }
      const c = new AC();
      const m = c.createGain(); m.gain.value = volume;
      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -3; limiter.knee.value = 3; limiter.ratio.value = 16;
      limiter.attack.value = .004; limiter.release.value = .2;
      m.connect(limiter).connect(c.destination);
      for (const category of SOUND_CATEGORIES) {
        const bus = c.createGain(); bus.gain.value = levels[category]; bus.connect(m); buses.set(category, bus);
      }
      ctx = c; master = m;
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    return ctx;
  } catch { broken = true; return null; }
}
export function setVolume(v: number) { volume = unit(v, .5); if (master) master.gain.value = volume; }
export function setSoundLevels(value: SoundLevels) {
  levels = { ...DEFAULT_SOUND_LEVELS };
  for (const category of SOUND_CATEGORIES) {
    levels[category] = unit(value[category]);
    const bus = buses.get(category); if (bus) bus.gain.value = levels[category];
  }
}
function decode(name: string): Promise<AudioBuffer | null> {
  const cached = decoded.get(name); if (cached) return cached;
  const c = ensure(); if (!c || !JAVA_SOUND_FILES[name]) return Promise.resolve(null);
  // Lazy shared decode: concurrent footsteps don't allocate/decode the same OGG twice.
  const pending = Promise.resolve().then(() => {
    const raw = atob(JAVA_SOUND_FILES[name]);
    const bytes = Uint8Array.from(raw, ch => ch.charCodeAt(0));
    return c.decodeAudioData(bytes.buffer);
  }).catch(() => null); // unsupported codec/blocked audio must never break gameplay
  decoded.set(name, pending); return pending;
}
type Position = { x: number; y: number; z: number; distance?: number };
function position(x?: number, y?: number, z?: number): Position | undefined {
  return x === undefined || y === undefined || z === undefined ? undefined : { x, y, z };
}
function select(event: string) {
  const variants = JAVA_SOUND_EVENTS[event]; if (!variants?.length) return null;
  let roll = Math.random() * variants.reduce((sum, v) => sum + (v.weight ?? 1), 0);
  return variants.find(v => (roll -= v.weight ?? 1) < 0) ?? variants[variants.length - 1];
}
/** Returns a stop handle even while decoding; used for rain cancellation and teardown. */
function sample(event: string, category: SoundCategory | null, gain = 1, pitch = 1, pos?: Position, loop = false): () => void {
  const variant = select(event); if (!variant) return () => {};
  const c = ensure();
  if (!c || (!loop && (volume <= 0 || (category && levels[category] <= 0)))) return () => {};
  const epoch = worldEpoch;
  let cancelled = false, source: AudioBufferSourceNode | null = null;
  const queued = performance.now();
  void decode(variant.name).then(buffer => {
    if (cancelled || (category !== null && epoch !== worldEpoch) || !buffer || (!loop && performance.now() - queued > 500)) return;
    // Don't queue a burst of old one-shots behind the browser's autoplay gate.
    if (!loop && c.state !== 'running') return;
    const where = pos ? placeAt(pos.x, pos.y, pos.z, pos.distance ?? 16) : undefined;
    if (where === null) return;
    const dest = category ? buses.get(category) : master;
    if (!dest) return;
    const src = c.createBufferSource(), g = c.createGain();
    source = src; src.buffer = buffer; src.loop = loop;
    src.playbackRate.value = pitch * (variant.pitch ?? 1);
    g.gain.value = gain * (variant.volume ?? 1) * (where?.gain ?? 1);
    src.connect(g);
    const pan = where ? c.createStereoPanner() : null;
    if (pan) { pan.pan.value = where!.pan; g.connect(pan).connect(dest); } else g.connect(dest);
    src.onended = () => { active.delete(src); src.disconnect(); g.disconnect(); pan?.disconnect(); };
    // Bound simultaneous short effects; never evict the persistent rain loop.
    if (!loop) {
      if (active.size >= 64) { const first = active.values().next().value; first?.stop(); if (first) active.delete(first); }
      active.add(src);
    }
    src.start();
  }).catch(() => {});
  return () => { cancelled = true; try { source?.stop(); } catch { /* already ended */ } };
}
const material = (kind: Kind) => kind === 'cloth' ? 'wool' : kind === 'slime' ? 'slime_block' : kind;
export function playBreak(kind: Kind, x?: number, y?: number, z?: number) { sample(`block.${material(kind)}.break`, 'blocks', 1, .9 + Math.random() * .2, position(x,y,z)); }
export function playPlace(kind: Kind, x?: number, y?: number, z?: number) { sample(`block.${material(kind)}.place`, 'blocks', 1, .8, position(x,y,z)); }
export function playDig(kind: Kind, x?: number, y?: number, z?: number) { sample(`block.${material(kind)}.hit`, 'blocks', .25, .5, position(x,y,z)); }
export function playStep(kind: Kind) { sample(`block.${material(kind)}.step`, 'players', .15); }
export function playChest(open: boolean, x?: number, y?: number, z?: number) { sample(`block.chest.${open ? 'open' : 'close'}`, 'blocks', .5, 1, position(x,y,z)); }
export function playDoor(open: boolean) { sample(`block.wooden_door.${open ? 'open' : 'close'}`, 'blocks'); }
// Java has no bed-enter effect, ambient songbirds or periodic wind gust recordings.
export function playBed() {}
export function playWind() {}
export function playBird() {}
export function playSplash() { sample('entity.generic.splash', 'players', .7); }
export function playHurt() { sample('entity.player.hurt', 'players'); }
const hostile = new Set<MobVoiceKey>(['creeper','spider','skeleton','zombie','enderman','slime','ghast']);
const mobName = (type: MobVoiceKey) => type === 'golem' ? 'iron_golem' : type;
export function playMob(type: MobVoiceKey, kind: 'idle' | 'hurt' | 'death' = 'idle', x?: number, y?: number, z?: number) {
  // Creepers are silent at rest: never replace missing ambient events with invented voices.
  sample(`entity.${mobName(type)}.${kind === 'idle' ? 'ambient' : kind}`, hostile.has(type) ? 'hostile' : 'neutral', 1, .94 + Math.random() * .12, position(x,y,z));
}
export function playMobStep(type: MobVoiceKey, x?: number, y?: number, z?: number, ground: Kind = 'stone') {
  if (type === 'ghast') return;
  const own = `entity.${mobName(type)}.step`;
  const event = JAVA_SOUND_EVENTS[own] ? own : type === 'slime' ? 'entity.slime.jump' : `block.${material(ground)}.step`;
  sample(event, hostile.has(type) ? 'hostile' : 'neutral', .15, 1, position(x,y,z));
}
export function playBell() { sample('block.bell.use', 'blocks'); }
export function playExplosion() { sample('entity.generic.explode', 'blocks'); }
export function playFuse() { sample('entity.tnt.primed', 'blocks'); }
export function playPop() { sample('entity.item.pickup', 'players', .2); }
export function playEat() { sample('entity.generic.eat', 'players', .5); }
export function playDrink() { sample('entity.generic.drink', 'players', .5); }
export function playBow() { sample('entity.arrow.shoot', 'players'); }
export function playArrowHit() { sample('entity.arrow.hit', 'players'); }
export function playLevelUp() { sample('entity.player.levelup', 'players', .75); }
export function playTotem() { sample('item.totem.use', 'players'); }
export function playEnchant() { sample('block.enchantment_table.use', 'blocks'); }
export function playShield() { sample('item.shield.block', 'players'); }
export function playCave() { sample('ambient.cave', 'ambient', .7); }
export function playThunder() { sample('entity.lightning_bolt.thunder', 'weather', .7); }
export function playPortal() { sample('block.portal.ambient', 'blocks', .5); }
export function playSlime() { sample('entity.slime.jump', 'hostile', .5); }
export function playClick() { sample('ui.button.click', null, .25); }
let stopRain: (() => void) | null = null;
export function setRain(on: boolean) {
  if (on && !stopRain) stopRain = sample('weather.rain', 'weather', .35, 1, undefined, true);
  else if (!on && stopRain) { stopRain(); stopRain = null; }
}
/** Clear asynchronous/looped world sounds when leaving a game. */
export function stopWorldAudio() {
  worldEpoch++;
  setRain(false);
  for (const node of musicNodes) { try { node.stop(); } catch { /* ended */ } }
  musicNodes.clear();
  for (const source of active) { try { source.stop(); } catch { /* ended */ } }
  active.clear();
}
export function noteInstrument(belowId: number): string {
  if (belowId === B.GOLD_BLOCK) return 'bell';
  if (belowId === B.CLAY) return 'flute';
  if (belowId === B.IRON_BLOCK) return 'iron_xylophone';
  if (belowId === B.SOUL_SAND) return 'cow_bell';
  if (belowId === B.PUMPKIN) return 'didgeridoo';
  if (belowId === B.EMERALD_BLOCK) return 'bit';
  if (belowId === B.HAY) return 'banjo';
  if (belowId === B.GLOWSTONE) return 'pling';
  if (belowId === B.AIR) return 'harp';
  const sound = BLOCKS[belowId]?.sound;
  return sound === 'wood' ? 'bass' : sound === 'sand' ? 'snare' : sound === 'glass' ? 'hat' : sound === 'cloth' ? 'guitar' : sound === 'stone' ? 'basedrum' : 'harp';
}
export function playNote(pitch: number, belowId: number) {
  sample(`block.note_block.${noteInstrument(belowId)}`, 'records', 1, Math.pow(2, (Math.max(0, Math.min(24, pitch)) - 12) / 12));
}
/** Custom procedural interlude, NOT Minecraft's licensed soundtrack. */
export function playMusic() {
  const c = ensure(), bus = buses.get('music'); if (!c || !bus || !levels.music || !volume) return;
  for (const [i, f] of [220, 329.63, 392].entries()) {
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * .7;
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.035, t + 1);
    g.gain.exponentialRampToValueAtTime(.0001, t + 4);
    o.connect(g).connect(bus); o.onended = () => { musicNodes.delete(o); o.disconnect(); g.disconnect(); };
    musicNodes.add(o);
    o.start(t); o.stop(t + 4.1);
  }
}
export function unlockAudio() {
  if (!ensure()) return;
  // Warm common effects during the user's gesture, without playing them.
  for (const event of ['ui.button.click','block.stone.break','block.stone.step','block.grass.step','entity.player.hurt']) {
    const name = JAVA_SOUND_EVENTS[event]?.[0]?.name; if (name) void decode(name);
  }
}
