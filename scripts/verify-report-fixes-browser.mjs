/** Production WebGL + emulated touch regressions; no real user accounts.
 * npm install --prefix .cache/browser-tools puppeteer-core @sparticuz/chromium
 * The received multiplayer packets are synthetic; this is NOT a live-account test.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { brotliDecompressSync } from "node:zlib";
import { execFileSync } from "node:child_process";
const root = fileURLToPath(new URL("../", import.meta.url));
const tools = path.resolve(
  process.env.BROWSER_TOOLS ?? path.join(root, ".cache/browser-tools"),
);
const resolve = createRequire(path.join(tools, "package.json")).resolve;
const { default: puppeteer } = await import(
  pathToFileURL(resolve("puppeteer-core")).href
);
const { default: chromium } = await import(
  pathToFileURL(resolve("@sparticuz/chromium")).href
);
const libs = path.join(tools, "al2023");
if (!fs.existsSync(libs)) {
  fs.mkdirSync(libs, { recursive: true });
  const tar = path.join(tools, "al2023.tar");
  fs.writeFileSync(
    tar,
    brotliDecompressSync(
      fs.readFileSync(
        path.join(tools, "node_modules/@sparticuz/chromium/bin/al2023.tar.br"),
      ),
    ),
  );
  execFileSync("tar", ["xf", tar, "-C", libs]);
  fs.unlinkSync(tar);
}
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { build } from 'esbuild';
const out = path.join(root, '.cache/verification4283'); fs.mkdirSync(out, { recursive: true });
await build({ stdin: { contents: "export { B } from './src/game/blocks'; export { I } from './src/game/items';", resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile: path.join(out, 'enums.mjs') });
const { B, I } = await import(pathToFileURL(path.join(out, 'enums.mjs')).href);
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args.filter(a => a !== '--single-process'), headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: [path.join(libs, 'lib'), process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') } });
const click = (p, text) => p.evaluate(text => {
  const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text);
  if (!b) throw Error('Missing button: ' + text); b.click();
}, text);
const reports = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.createBrowserContext(), p = await context.newPage(), errors = [];
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.setViewport(mobile ? { width: 844, height: 390, isMobile: true, hasTouch: true } : { width: 960, height: 600 });
    await p.evaluateOnNewDocument(mobile => {
      localStorage.setItem('blockcraft-settings', JSON.stringify({ quality: 'potato', controlMode: mobile ? 'touch' : 'desktop', renderDistance: 2, volume: 0, lod: false, autoQuality: false, fpsCap: 30, fpsCapUserSet: true }));
      localStorage.setItem('blockcraft-saves-v2', JSON.stringify([{ id: 'report4283', name: 'Regression audit', seed: 4283, mode: 'creative', worldType: 'flat', mods: {}, pos: [4.5,65,8.5], yaw: 0, pitch: 0, inv: Array(36).fill(null), time: .75, health: 20, day: 1, updated: 1 }]));
    }, mobile);
    await p.goto(pathToFileURL(path.join(root, 'dist/index.html')).href, { waitUntil: 'domcontentloaded' });
    await click(p, 'Tryb jednoosobowy');
    await p.evaluate(() => document.querySelector('[role="option"]').click());
    await click(p, 'Graj w wybranym świecie');
    await p.waitForFunction(() => window.minecraft?.game?.loadingProgress >= .999, { timeout: 90000 });
    await p.evaluate(() => { cancelAnimationFrame(window.minecraft.game.raf); });
    await p.waitForFunction(() => !window.minecraft.game.meshWorker?.busy, { timeout: 15000 });
    const gameplay = await p.evaluate(({ B, I }) => {
      const g = window.minecraft.game;
      const check = (label, condition) => { if (!condition) throw Error(label); };
      g.mode = 'survival'; g.inventory.slots.fill(null); g.inventory.offhand = null; g.inventory.cursor = null;
      g.selected = 0; g.hunger = 20; g.eatCooldown = 0; g.inventory.slots[0] = { id: I.HONEY_BOTTLE, count: 1 };
      g.tryEat(g.inventory.slots[0]);
      check('honey must return a bottle at full hunger', g.inventory.slots[0]?.id === I.BOTTLE);
      g.inventory.slots[0] = { id: B.GRAVEL, count: 3 }; g.dropItem(true);
      const discarded = g.drops.at(-1); discarded.age = .75;
      discarded.pos.copy(g.body.pos); discarded.pos.y += .9; discarded.vel.set(0,0,0);
      g.updateDrops(0);
      check('discard grace must block pickup and attraction', g.inventory.countOf(B.GRAVEL) === 0 && discarded.vel.length() === 0 && discarded.pickupDelay === 2);
      for (let y = 90; y < 105; y++) g.world.setBlock(9, y, 9, B.AIR);
      g.world.setBlock(9, 90, 9, B.STONE); g.world.setBlock(9, 100, 9, B.GRAVEL);
      g.fallColumn(9,100,9,true); g.updateFalling(.1);
      g.world.setBlock(9,91,9,B.TORCH);
      const before = g.drops.filter(d => d.id === B.GRAVEL).reduce((n,d) => n+d.count, 0);
      g.updateFalling(1);
      check('late torch must survive falling gravel', g.world.getBlock(9,91,9) === B.TORCH && g.falling.length === 0);
      check('late torch must produce gravel exactly once', g.drops.filter(d => d.id === B.GRAVEL).reduce((n,d) => n+d.count, 0) === before + 1);
      g.inventory.slots.fill(null); g.inventory.offhand = null;
      for (let x=2; x<=7; x++) for (let y=71; y<=76; y++) g.world.setBlock(x,y,4,B.STONE);
      check('test wall rebuilt', g.buildChunk(0,0));
      g.body.pos.set(4.5,71.4,10); g.camera.position.set(4.5,73,10); g.camera.lookAt(4.5,73,4);
      g.uDay.value = .01; g.brightness.value = 0;
      g.net = { id: 'audit-viewer', public: false, role: 'client', tick() {}, sendPos() {} };
      const message = { t:'pos', from:'audit-sender', to:'*', d:'o', x:6.5,y:71.5,z:6, yaw:0,pitch:0,held:0,offhand:0,alive:true,name:'Audit sender',hue:.5 };
      const read = () => {
        g.tickNet(0); g.updateHeldLight(); g.renderer.render(g.scene,g.camera);
        const gl = g.renderer.getContext(), pixels = new Uint8Array(4);
        gl.readPixels(Math.floor(gl.drawingBufferWidth/2),Math.floor(gl.drawingBufferHeight/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        check('WebGL error', gl.getError() === gl.NO_ERROR);
        return { rgb: [...pixels].slice(0,3), light: g.remoteLights.map(v => v.w) };
      };
      g.onNetMessage(message); const dark = read();
      g.onNetMessage({ ...message, held:B.TORCH }); const lit = read();
      check('received main-hand torch must brighten actual terrain pixels', lit.rgb.reduce((a,b)=>a+b,0) > dark.rgb.reduce((a,b)=>a+b,0) + 20);
      g.onNetMessage({ ...message, offhand:B.TORCH }); const offhand = read();
      check('received offhand torch must brighten terrain', offhand.rgb.reduce((a,b)=>a+b,0) > dark.rgb.reduce((a,b)=>a+b,0) + 20);
      g.onNetMessage({ ...message, held:B.TORCH, d:'n' }); const otherDimension = read();
      check('other dimension must not leak light', otherDimension.light.every(v => v === 0));
      g.onNetMessage({ ...message, held:B.TORCH, alive:false }); const dead = read();
      check('dead player must not emit held light', dead.light.every(v => v === 0));
      g.dropRemote('audit-sender'); g.updateHeldLight(); g.net = null;
      return { honeyBottle: true, discardGrace: true, lateTorch: true, dark, lit, offhand, otherDimension, dead };
    }, { B, I });
    let touch = null;
    if (mobile) {
      await p.evaluate(() => window.minecraft.game.setUI('playing'));
      await p.waitForSelector('.game-gesture-surface');
      const surface = await p.$eval('.game-gesture-surface', e => {
        const s=getComputedStyle(e); return { select:s.userSelect, webkit:s.webkitUserSelect, action:s.touchAction };
      });
      assert.equal(surface.select, 'none'); assert.equal(surface.webkit, 'none'); assert.equal(surface.action, 'none');
      await p.evaluate(() => { window.unpreventedMenus=0; document.addEventListener('contextmenu', e => { if (!e.defaultPrevented) window.unpreventedMenus++; }); });
      await p.touchscreen.touchStart(195, 280); await delay(1000); await p.touchscreen.touchEnd();
      touch=await p.evaluate(() => ({ selection: getSelection()?.toString(), menus: window.unpreventedMenus }));
      assert.equal(touch.selection, ''); assert.equal(touch.menus, 0);
    }
    const editable = await p.evaluate(() => {
      const e=document.createElement('input'); e.value='miód i skrzynia'; document.querySelector('#root').append(e);
      const style=getComputedStyle(e); e.focus(); e.select();
      const result={ select:style.userSelect, webkit:style.webkitUserSelect, text:e.value.slice(e.selectionStart,e.selectionEnd) }; e.remove(); return result;
    });
    assert.equal(editable.select, 'text'); assert.equal(editable.webkit, 'text'); assert.equal(editable.text, 'miód i skrzynia');
    assert.deepEqual(errors, []);
    reports.push({ device: mobile?'mobile-emulated':'desktop', gameplay, touch, editable, errors });
    await p.screenshot({ path: path.join(out, mobile?'mobile.png':'desktop.png') });
    console.log('PASS', JSON.stringify(reports.at(-1))); await context.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(out,'report.json'), JSON.stringify({ version:JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version, environment:'Chromium/SwiftShader; mobile viewport and touch emulated; synthetic received peer packets; no live account sessions', reports },null,2)+'\n');
