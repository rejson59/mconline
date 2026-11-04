/** Production account navigation/verification regression with the pinned real provider.
 * npm install --prefix .cache/browser-tools puppeteer-core @sparticuz/chromium
 * Start the production preview separately, then npm run test:browser:account.
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
const out=path.join(root,'.cache/verification-cloud428');fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args.filter(arg=>arg!=='--single-process'),headless:true,protocolTimeout:45000,env:{...process.env,LD_LIBRARY_PATH:[path.join(libs,'lib'),process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')}});
const html=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
const provider=fs.readFileSync(path.join(root,'.harness/fixtures/rejson-account/rejson-account.js'),'utf8');
const tokenA='a'.repeat(48),tokenB='b'.repeat(48); // Synthetic test values, never real sessions.
const shared='rejson_community_session_v1';
const ids={ [tokenA]:'11111111-1111-4111-8111-111111111111',[tokenB]:'22222222-2222-4222-8222-222222222222' };
const stores=new Map(), errors=[], reports=[];let revision=0;
const click=(p,text)=>p.evaluate(text=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);if(!b)throw Error('Missing '+text);b.click();},text);
const saved=p=>p.waitForFunction(()=>Object.keys(localStorage).some(key=>key.startsWith('mconline-worlds-20261105:')&&key.endsWith(':sync')&&JSON.parse(localStorage.getItem(key)).dirty.length===0&&Object.keys(JSON.parse(localStorage.getItem(key)).revisions).length>0));
const ready=p=>p.waitForFunction(()=>document.querySelector('[aria-label="Zapis i konto"]')?.textContent.match(/światy w chmurze|Zapisano na koncie/));
async function device(mobile=false,recovery=null){
 const context=await browser.createBrowserContext(),p=await context.newPage();
 await p.setViewport(mobile?{width:844,height:390,isMobile:true,hasTouch:true}:{width:960,height:600});
 p.on('pageerror',e=>errors.push(e.message)); p.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,500));});
 await p.setRequestInterception(true);
 p.on('request',async req=>{try{
  const url=new URL(req.url()); assert.ok(!req.url().includes(tokenA)&&!req.url().includes(tokenB));
  if(url.protocol==='data:'||url.protocol==='blob:')return req.continue();
  if(url.pathname==='/mconline/')return req.respond({status:200,contentType:'text/html',body:html});
  if(url.pathname==='/js/rejson-account.js')return req.respond({status:200,contentType:'text/javascript',body:provider});
  const b=JSON.parse(req.postData()||'{}'),owner=ids[b.p_token],identity={id:owner,username:owner===ids[tokenA]?'Alice':'Bob'};
  if(url.pathname.endsWith('/community_whoami'))return req.respond({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:JSON.stringify({username:owner?identity.username:null})});
  if(url.pathname.endsWith('/mconline_identity'))return req.respond({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:JSON.stringify(identity)});
  if(url.pathname.endsWith('/mconline_worlds_op')){
   let response, status=200;
   if(!stores.has(owner))stores.set(owner,new Map()); const worlds=stores.get(owner),old=worlds.get(b.p_id);
   if(b.p_op==='list')response={identity,worlds:[...worlds.values()]};
   else if((old?.revision??0)!==b.p_expected){status=409;response={code:'40001'};}
   else if(b.p_op==='delete'){worlds.delete(b.p_id);response={revision:0};}
   else{const row={id:b.p_id,revision:++revision,data:b.p_data};worlds.set(b.p_id,row);response={revision:row.revision};}
   return req.respond({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:JSON.stringify(response)});
  }
  return req.respond({status:204,body:''});
 }catch{if(!req.isInterceptResolutionHandled())await req.abort();}});
 await p.evaluateOnNewDocument(({shared,tokenA})=>{
  localStorage.setItem(shared,JSON.stringify({token:tokenA,username:'NotTrusted'}));
  localStorage.setItem('blockcraft-saves-v2','[{"id":"old-device-world","seed":42,"name":"Do not erase"}]');
  localStorage.setItem('blockcraft-settings',JSON.stringify({quality:'potato',renderDistance:2,volume:0,fpsCap:30,fpsCapUserSet:true,autoQuality:false,lod:false,controlMode:'desktop'}));
  localStorage.setItem('blockcraft-portrait-ok','1');
 },{shared,tokenA});
 if(recovery)await p.evaluateOnNewDocument(recovery=>{localStorage.setItem(recovery.key,recovery.worlds);localStorage.setItem(recovery.key+':sync',recovery.journal);},recovery);
 await p.goto('https://rejson59.github.io/mconline/',{waitUntil:'networkidle0'});if(!recovery)await ready(p).catch(async error=>{console.log('STATE',await p.evaluate(()=>document.body.innerText),errors);throw error;});
 return {context,p};
}
try{
 const one=await device();
 await click(one.p,'Tryb jednoosobowy');
 assert.equal(await one.p.$$eval('[role="option"]',a=>a.length),0,'fresh cloud library, no automatic local migration');
 await click(one.p,'Stwórz nowy świat'); await click(one.p,'Stwórz nowy świat');
 await one.p.waitForFunction(()=>window.minecraft?.game?.homeWorld,{timeout:45000});
 await one.p.evaluate(()=>{const g=window.minecraft.game;g.mode='creative';g.health=13;g.homeWorld.setBlock(5,110,5,1);g.inventory.slots[0]={id:1,count:12};g.save();});
 await saved(one.p);
 const snapshot=[...stores.get(ids[tokenA]).values()][0];
 assert.ok(snapshot?.data.mods);assert.equal(snapshot.data.health,13);assert.equal(snapshot.data.inv[0].count,12);
 await one.p.evaluate(()=>{
   const original=Storage.prototype.setItem;window.restoreStorage=()=>{Storage.prototype.setItem=original;};
   Storage.prototype.setItem=function(key,value){if(key.startsWith('mconline-worlds-20261105:'))throw new DOMException('Synthetic full storage','QuotaExceededError');return original.call(this,key,value);};
   window.minecraft.game.save();
 });
 await one.p.waitForFunction(()=>document.querySelector('[aria-label="Zapis i konto"]')?.textContent.includes('Nie udało się zapisać aktualnego postępu'));
 await one.p.evaluate(()=>{window.restoreStorage();window.minecraft.game.save();});await saved(one.p);
 const recovery=await one.p.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('mconline-worlds-20261105:')&&!k.endsWith(':sync'));return {key,worlds:localStorage.getItem(key),journal:localStorage.getItem(key+':sync')};});
 await one.context.close();
 const two=await device(true);await click(two.p,'Tryb jednoosobowy');
 assert.equal(await two.p.$$eval('[role="option"]',a=>a.length),1,'second isolated browser downloads account world');
 await two.p.click('[role="option"]'); await click(two.p,'Graj w wybranym świecie');
 await two.p.waitForFunction(()=>window.minecraft?.game?.homeWorld,{timeout:45000});
 const loaded=await two.p.evaluate(()=>{const g=window.minecraft.game;return {id:g.worldId,block:g.homeWorld.getBlock(5,110,5),count:g.inventory.slots[0]?.count};});
 assert.equal(loaded.id,snapshot.id);assert.equal(loaded.block,1);assert.equal(loaded.count,12);
 await two.p.evaluate(()=>{const g=window.minecraft.game;g.health=8;g.save();});await saved(two.p);
 await two.p.evaluate(({shared,tokenB})=>{localStorage.setItem(shared,JSON.stringify({token:tokenB,username:'forged'}));window.dispatchEvent(new Event('rj:session-change'));},{shared,tokenB});
 await ready(two.p);await two.p.waitForFunction(()=>!window.minecraft?.game);
 await click(two.p,'Tryb jednoosobowy');assert.equal(await two.p.$$eval('[role="option"]',a=>a.length),0,'account switch clears running game and old library');
 assert.equal(await two.p.evaluate(()=>JSON.parse(localStorage.getItem('blockcraft-saves-v2'))[0].name),'Do not erase');
 await two.context.close();
 const worlds=JSON.parse(recovery.worlds),journal=JSON.parse(recovery.journal);worlds[0].health=19;journal.dirty=[worlds[0].id];recovery.worlds=JSON.stringify(worlds);recovery.journal=JSON.stringify(journal);
 const back=await device(false,recovery);
 await back.p.waitForFunction(()=>document.querySelector('[aria-label="Zapis i konto"]')?.textContent.includes('Konflikt'));
 assert.equal(stores.get(ids[tokenA]).get(snapshot.id).data.health,8,'offline stale device did not overwrite');
 assert.equal(await back.p.evaluate(key=>JSON.parse(localStorage.getItem(key))[0].health,recovery.key),19,'offline recovery not discarded');
 await back.p.screenshot({path:path.join(out,'desktop-conflict.png')});
 // The intentional CAS 409 is expected; no JavaScript failures are allowed.
 const unexpected=errors.filter(e=>!e.includes('409'));
 assert.equal(unexpected.length,0,JSON.stringify(unexpected));
 reports.push({productionHTML:true,realPinnedProvider:true,mockedRPC:true,isolatedDevices:2,fullGameSnapshotUploaded:true,blocksAndInventoryRestored:true,offlineConflictProtected:true,storageFailureVisible:true,accountSwitchStopsGame:true,localDeviceWorldPreserved:true,errors:unexpected});
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(reports,null,2));console.log('PASS browser cloud',JSON.stringify(reports[0]));
 await back.context.close();
}finally{const timer=setTimeout(()=>browser.process()?.kill('SIGKILL'),5000);try{await browser.close();}finally{clearTimeout(timer);}}
