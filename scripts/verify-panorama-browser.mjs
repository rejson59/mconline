/** Production panorama motion, fallback, preferences and resource regression suite.
 * npm install --prefix .cache/browser-tools puppeteer-core @sparticuz/chromium
 * Start the production preview separately, then npm run test:browser:native.
 * Linux x64; never uses your everyday browser profile or public multiplayer.
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
import { createHash } from 'node:crypto';
const out = path.join(root,'.cache/verification425'); fs.mkdirSync(out,{recursive:true});
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args.filter(arg => arg !== '--single-process'), headless:true, protocolTimeout:20000, env:{...process.env,LD_LIBRARY_PATH:[path.join(libs,'lib'),process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')} });
const reports = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (ok, message) => assert.ok(ok, message);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const clickText = (page, text) => page.evaluate(text => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text); if(!b) throw Error('No '+text); b.click(); },text);
try {
  for (const device of (process.env.BROWSER_CASES ?? 'desktop,mobile,file,fallback').split(',')) {
    const p = await browser.newPage(), errors=[], external=[];
    const shot = (options = {}) => p.screenshot(options);
    p.on('pageerror', e=>errors.push(e.message)); p.on('console', m=>{if(m.type()==='error') errors.push(m.text());});
    p.on('request', r=>{ if(/^https?:/.test(r.url()) && !r.url().startsWith('http://127.0.0.1:4173/')) external.push(r.url()); });
    await p.setViewport(device==='mobile'?{width:390,height:844,isMobile:true,hasTouch:true}:{width:960,height:600});
    await p.evaluateOnNewDocument(fallback => {
      window.__panoramaDraws=0;
      if (fallback) {
        const get=HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext=function(type,...args){ return type.startsWith('webgl') || type==='experimental-webgl' ? null : get.call(this,type,...args); };
      } else {
        for(const name of ['drawArrays','drawElements']) {
          const draw=WebGL2RenderingContext.prototype[name];
          WebGL2RenderingContext.prototype[name]=function(...args){window.__panoramaDraws++;return draw.apply(this,args);};
        }
      }
    },device==='fallback');
    await p.goto(device==='file'?pathToFileURL(path.join(root,'dist/index.html')).href:(process.env.BROWSER_URL??'http://127.0.0.1:4173/'),{waitUntil:'networkidle0'});
    await p.bringToFront();
    await p.waitForSelector('.java-background-controls summary');
    const renderer=device==='fallback'?'fallback':'webgl';
    await p.waitForFunction(renderer=>document.querySelector('.java-panorama')?.dataset.renderer===renderer,{},renderer);
    // Hide foreground only while comparing actual background pixels. Restore for deliverable screenshots.
    const clean=await p.addStyleTag({content:'.java-title-canvas,.java-title-footer,.java-background-controls,.java-panorama-shade{visibility:hidden!important}'});
    const a=await shot(); const drawsBefore=await p.evaluate(()=>window.__panoramaDraws);
    await wait(device==='fallback'?2300:1100);
    const b=await shot(); const drawsAfter=await p.evaluate(()=>window.__panoramaDraws);
    check(hash(a)!==hash(b),'background pixels really move: '+device);
    if(device!=='fallback') check(drawsAfter>drawsBefore,'real GPU draws advance');
    await clean.dispose(); // DOM style is removed separately; handle disposal does not remove the element.
    await p.evaluate(()=>[...document.querySelectorAll('style')].find(s=>s.textContent.includes('visibility:hidden!important'))?.remove());
    if(device==='desktop') {
      await p.focus('.java-background-controls summary'); await p.keyboard.press('Enter');
      check(await p.$eval('.java-background-controls',e=>e.open),'keyboard opens background options');
      await p.keyboard.press('Escape');
      check(await p.$eval('.java-background-controls',e=>!e.open),'Escape closes background options');
      await p.setViewport({width:1920,height:1080});
      await p.waitForFunction(()=>document.querySelector('.java-panorama canvas').width===1280);
      await p.setViewport({width:960,height:600});
      await p.waitForFunction(()=>document.querySelector('.java-panorama canvas').width===720);
    }
    await p.click('.java-background-controls summary');
    await p.select('#menu-panorama-scene','nether');
    await p.waitForFunction(renderer=>document.querySelector('.java-panorama')?.dataset.scene==='nether' && document.querySelector('.java-panorama')?.dataset.renderer===renderer,{},renderer);
    await shot({path:path.join(out,`${device}-nether.png`)});
    await p.select('#menu-panorama-scene','caves');
    await p.waitForFunction(renderer=>document.querySelector('.java-panorama')?.dataset.scene==='caves' && document.querySelector('.java-panorama')?.dataset.renderer===renderer,{},renderer);
    await shot({path:path.join(out,`${device}-mountains.png`)});
    await p.evaluate(()=>window.__previousCanvas=document.querySelector('.java-panorama canvas'));
    await p.click('.java-background-motion input');
    await p.waitForFunction(()=>document.querySelector('.java-panorama')?.dataset.motion==='paused');
    await wait(100); const pausedBefore=await p.evaluate(()=>window.__panoramaDraws); await wait(500);
    check(await p.evaluate(()=>window.__panoramaDraws)===pausedBefore,'pause stops draw work');
    check(await p.evaluate(()=>window.__previousCanvas===document.querySelector('.java-panorama canvas')),'pause preserves renderer');
    const plain=await p.addStyleTag({content:'.java-title-canvas,.java-title-footer,.java-background-controls,.java-panorama-shade{visibility:hidden!important}'});
    const stillA=await shot(); await wait(400); const stillB=await shot();
    check(hash(stillA)===hash(stillB),'paused pixels remain identical');
    await p.evaluate(()=>[...document.querySelectorAll('style')].find(s=>s.textContent.includes('visibility:hidden!important'))?.remove()); await plain.dispose();
    await p.reload({waitUntil:'networkidle0'});
    await p.waitForFunction(renderer=>document.querySelector('.java-panorama')?.dataset.scene==='caves' && document.querySelector('.java-panorama')?.dataset.renderer===renderer,{},renderer);
    check(await p.evaluate(()=>document.querySelector('.java-panorama').dataset.motion==='paused'),'saved pause');
    await p.click('.java-background-controls summary');
    check(await p.$eval('#menu-panorama-scene',e=>e.value)==='caves','saved scene');
    await p.click('.java-background-motion input');
    await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
    await p.waitForFunction(()=>document.querySelector('.java-panorama')?.dataset.motion==='paused');
    await wait(100); const reducedBefore=await p.evaluate(()=>window.__panoramaDraws); await wait(400);
    check(await p.evaluate(()=>window.__panoramaDraws)===reducedBefore,'live reduced motion stops draws');
    await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
    await p.waitForFunction(()=>document.querySelector('.java-panorama')?.dataset.motion==='running');
    await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
    const hiddenBefore=await p.evaluate(()=>window.__panoramaDraws); await wait(400);
    check(await p.evaluate(()=>window.__panoramaDraws)===hiddenBefore,'hidden document stops draws');
    await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    if(device!=='fallback') {
      await p.waitForFunction(()=>window.__panoramaDraws>0);
      await p.evaluate(()=>{const c=document.querySelector('.java-panorama canvas');window.__lose=c.getContext('webgl2').getExtension('WEBGL_lose_context');window.__lose.loseContext();});
      await p.waitForFunction(()=>document.querySelector('.java-panorama')?.dataset.renderer==='fallback');
      await wait(100); await p.evaluate(()=>window.__lose.restoreContext());
      await p.waitForFunction(()=>document.querySelector('.java-panorama')?.dataset.renderer==='webgl');
      check(await p.$$eval('.java-panorama canvas',a=>a.length)===1,'one canvas after context restoration');
    }
    await p.select('#menu-panorama-scene','random');
    const random=await p.$eval('.java-panorama',e=>e.dataset.scene); check(['trails','caves','nether'].includes(random),'random resolves to a valid scene');
    await p.select('#menu-panorama-scene','trails');
    await p.waitForFunction(renderer=>document.querySelector('.java-panorama')?.dataset.scene==='trails' && document.querySelector('.java-panorama')?.dataset.renderer===renderer,{},renderer);
    await p.click('.java-background-controls summary');
    await shot({path:path.join(out,`${device}-menu.png`)});
    await clickText(p,'Tryb jednoosobowy'); await p.waitForSelector('.java-world-list');
    check(await p.$$eval('.java-panorama canvas',a=>a.length)===0,'leaving title disposes panorama canvas');
    const off=await p.evaluate(()=>window.__panoramaDraws); await wait(300);
    check(await p.evaluate(()=>window.__panoramaDraws)===off,'no draws after unmount');
    await clickText(p,'Anuluj'); await p.waitForFunction(renderer=>document.querySelector('.java-panorama')?.dataset.renderer===renderer,{},renderer);
    check(await p.$$eval('.java-panorama canvas',a=>a.length)===(device==='fallback'?0:1),'one renderer after return');
    check(external.length===0,'no third-party runtime downloads');
    check(errors.length===0,JSON.stringify(errors));
    const size=await p.evaluate(()=>{const c=document.querySelector('.java-panorama canvas');return c?{width:c.width,height:c.height}:null;});
    const report={device,renderer,movingPixels:true,pausedPixelsIdentical:true,drawsDuringMotion:drawsAfter-drawsBefore,size,preferencesReload:true,liveReducedMotion:true,simulatedVisibilityPause:true,contextRestored:device!=='fallback',cleanup:true,externalRequests:external,errors};
    reports.push(report); console.log('PASS panorama',JSON.stringify(report)); await p.close();
  }
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({version:JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,environment:'Chromium / SwiftShader, mobile viewport emulation',reports},null,2)+'\n');
} finally {
  const timer = setTimeout(() => browser.process()?.kill('SIGKILL'), 5000);
  try { await browser.close(); } finally { clearTimeout(timer); }
}
