import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { JavaMainMenu } from '../src/components/JavaMenus';
import { panoramaFaces } from '../src/components/JavaPanorama';
import { PANORAMA_SCENES, PANORAMA_STORAGE_KEY, DEFAULT_PANORAMA, parsePanoramaPreferences, resolvePanoramaScene, panoramaPose, panoramaSize, loadPanoramaPreferences, savePanoramaPreferences } from '../src/utils/menuPanorama';
let checks = 0;
function eq(name: string, actual: unknown, expected: unknown) { assert.deepStrictEqual(actual, expected, name); checks++; }
for (const raw of [null, '', '{', 'null', 'false', '5', '"nether"', '[]', '{}', '{"scene":"bad","motion":0}']) {
  eq('invalid preference defaults: ' + raw, parsePanoramaPreferences(raw), DEFAULT_PANORAMA);
}
for (const scene of ['trails', 'caves', 'nether', 'random'] as const) for (const motion of [true, false]) {
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
for (const text of ['Tło menu','Sceneria','Obracaj panoramę','Losowa przy otwarciu menu','Tryb jednoosobowy','Tryb wieloosobowy','dodatek przeglądarkowy']) eq('menu exposes ' + text, html.includes(text), true);
eq('background excluded from accessibility tree', html.includes('aria-hidden="true"'), true);
console.log(`${checks} panorama/preference/native-menu checks passed`);
