import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { JavaMainMenu } from '../src/components/JavaMenus';
import { panoramaFaces } from '../src/components/JavaPanorama';
import { PANORAMA_SCENES, PANORAMA_STORAGE_KEY, DEFAULT_PANORAMA, parsePanoramaPreferences, resolvePanoramaScene, panoramaPose, panoramaSize, loadPanoramaPreferences, savePanoramaPreferences, nextPanoramaScene, lastPanoramaScene, rememberPanoramaScene, PANORAMA_LAST_SCENE_KEY, startPanoramaCycle, PANORAMA_CYCLE_MS } from '../src/utils/menuPanorama';
let checks = 0;
function eq(name: string, actual: unknown, expected: unknown) { assert.deepStrictEqual(actual, expected, name); checks++; }
for (const raw of [null, '', '{', 'null', 'false', '5', '"nether"', '[]', '{}', '{"scene":"bad","motion":0}']) {
  eq('invalid preference defaults: ' + raw, parsePanoramaPreferences(raw), DEFAULT_PANORAMA);
}
for (const scene of ['trails', 'caves', 'nether', 'random', 'automatic'] as const) for (const motion of [true, false]) {
  eq('round trip settings', parsePanoramaPreferences(JSON.stringify({ scene, motion })), { scene, motion });
}
for (const scene of PANORAMA_SCENES) eq('explicit scene', resolvePanoramaScene(scene.id, .9), scene.id);
for (const [n, expected] of [[0,'trails'],[.32,'trails'],[1/3,'caves'],[.66,'caves'],[2/3,'nether'],[.99,'nether'],[1,'nether'],[-1,'trails'],[NaN,'trails']] as const) eq('random boundary', resolvePanoramaScene('random', n), expected);
for (const t of [0, 1, 10, 90, 180, 86400, -1, NaN, Infinity]) {
  const pose = panoramaPose(t);
  eq('constant pitch', pose.pitch, 10);
  eq('bounded yaw', Number.isFinite(pose.yaw) && pose.yaw <= 0 && pose.yaw > -360, true);
}
eq('visible movement in one second', panoramaPose(1).yaw, -2);
eq('full turn wraps', Math.abs(panoramaPose(180).yaw), 0);
for (const [w,h] of [[1920,1080],[390,844],[3840,2160],[100,100],[0,0],[NaN,Infinity],[1,3000],[10000,1]]) {
  const [x,y] = panoramaSize(w,h);
  eq('bounded dimensions', x >= 1 && y >= 1 && x <= 1280 && y <= 720, true);
  eq('integer dimensions', Number.isInteger(x) && Number.isInteger(y), true);
}
const old = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const store = new Map<string,string>();
try {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) } });
  eq('empty storage defaults', loadPanoramaPreferences(), DEFAULT_PANORAMA);
  savePanoramaPreferences({scene:'nether',motion:false});
  eq('persisted choice', loadPanoramaPreferences(), {scene:'nether',motion:false});
  eq('isolated key only', [...store.keys()], [PANORAMA_STORAGE_KEY]);
  Object.defineProperty(globalThis, 'localStorage', { configurable:true, get() { throw Error('blocked'); } });
  eq('blocked storage still opens menu', loadPanoramaPreferences(), DEFAULT_PANORAMA);
  savePanoramaPreferences({scene:'caves',motion:true}); checks++;
} finally {
  if (old) Object.defineProperty(globalThis, 'localStorage', old);
  else Reflect.deleteProperty(globalThis, 'localStorage');
}
// Regression: automatic/random choices must never immediately repeat the prior scene.
for (const previous of PANORAMA_SCENES) {
  eq('next is different', nextPanoramaScene(previous.id) !== previous.id, true);
  eq('three steps form a full cycle', nextPanoramaScene(nextPanoramaScene(nextPanoramaScene(previous.id))), previous.id);
  for (const choice of ['random','automatic'] as const) for (const draw of [0,.2,.5,.99,1,-1,NaN,Infinity]) {
    eq('no immediate repeat', resolvePanoramaScene(choice, draw, previous.id) !== previous.id, true);
  }
}
const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
try {
  const values = new Map<string,string>();
  Object.defineProperty(globalThis, 'localStorage', {configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)}});
  rememberPanoramaScene('caves');
  eq('last scene is stored separately', values.get(PANORAMA_LAST_SCENE_KEY), 'caves');
  eq('last scene survives reading', lastPanoramaScene(), 'caves');
  eq('remembering last scene does not pin the selection', values.has(PANORAMA_STORAGE_KEY), false);
  Object.defineProperty(globalThis, 'localStorage', {configurable:true,get(){throw Error('blocked');}});
  rememberPanoramaScene('nether');
  eq('blocked storage retains session last scene', lastPanoramaScene(), 'nether');
} finally {
  if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else Reflect.deleteProperty(globalThis, 'localStorage');
}
{
  let visible=true, reduced=false, sequence=0, changes=0, unsubscribed=0;
  let notify=()=>{};
  const timers=new Map<number,()=>void>();
  const delays:number[]=[];
  const dispose=startPanoramaCycle(()=>changes++, {
    visible:()=>visible,reduced:()=>reduced,
    setTimer:(callback,ms)=>{delays.push(ms);timers.set(++sequence,callback);return sequence;},
    clearTimer:id=>{timers.delete(id);},subscribe:callback=>{notify=callback;return()=>{unsubscribed++;};},
  });
  const fire=()=>{const [id,callback]=[...timers][0];timers.delete(id);callback();};
  eq('automatic cycle has exactly one timer',timers.size,1);
  eq('real user interval is 45 seconds',delays[0],45000);
  eq('shared interval constant',PANORAMA_CYCLE_MS,45000);
  fire(); eq('timer changes scenery',changes,1); eq('cycle rearms once',timers.size,1);
  visible=false;notify();eq('hidden document cancels timer',timers.size,0);
  visible=true;notify();eq('visible document rearms',timers.size,1);eq('no catch up on visibility return',changes,1);
  reduced=true;notify();eq('reduced motion cancels timer',timers.size,0);
  reduced=false;notify();eq('motion return rearms',timers.size,1);
  visible=false;fire();eq('late timer cannot switch hidden scene',changes,1);eq('late hidden timer stays stopped',timers.size,0);
  visible=true;notify();fire();eq('normal cycling resumes',changes,2);
  const pending=[...timers.values()][0];dispose();
  eq('unmount clears pending timer',timers.size,0);eq('unmount removes subscriptions',unsubscribed,1);
  pending();notify();eq('stale callbacks cannot switch scenes',changes,2);eq('stale callbacks cannot rearm',timers.size,0);
}
const manifest = JSON.parse(fs.readFileSync('docs/menu-panoramas-manifest.json','utf8'));
eq('twelve optional faces', manifest.files.length, 12);
for (const scene of PANORAMA_SCENES) {
  const faces = panoramaFaces(scene.id);
  eq('six independent faces', new Set(faces).size, 6);
  for (let i=0;i<6;i++) {
    eq('self contained data URL', faces[i].startsWith('data:image/'), true);
    if (scene.id === 'trails') continue;
    const file = manifest.files.find((f: {scene:string;path:string}) => f.scene === scene.id && f.path.endsWith(`panorama_${i}.png`));
    const bytes = Buffer.from(faces[i].split(',')[1],'base64');
    eq('WebP container', bytes.subarray(0,4).toString(), 'RIFF');
    eq('WebP type', bytes.subarray(8,12).toString(), 'WEBP');
    eq('embedded byte count', bytes.length, file.outputBytes);
    eq('embedded SHA256', createHash('sha256').update(bytes).digest('hex'), file.outputSha256);
    eq('pinned upstream commit', /^[a-f0-9]{40}$/.test(file.commit), true);
  }
}
const noop = () => {};
const html = renderToStaticMarkup(<JavaMainMenu saves={[]} onPlay={noop} onNew={noop} onDelete={noop} />);
for (const text of ['Następne tło','Automatycznie · co 45 sekund','Tło menu','Sceneria','Obracaj panoramę','Losowa przy otwarciu menu','Tryb jednoosobowy','Tryb wieloosobowy','dodatek przeglądarkowy']) eq('menu exposes ' + text, html.includes(text), true);
eq('background excluded from accessibility tree', html.includes('aria-hidden="true"'), true);
console.log(`${checks} panorama/preference/native-menu checks passed`);
