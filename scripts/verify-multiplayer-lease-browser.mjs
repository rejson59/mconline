/** Production HTML + real engine/provider/Web Locks; synthetic gateway only.
 * npm install --prefix .cache/browser-tools puppeteer-core @sparticuz/chromium
 * npm run test:browser:lease (Linux x64; no preview or real user accounts needed).
 * SQL authorization/transaction tests run separately, with rollback.
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
const out=path.join(root,'.cache/verification-lease4282');fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args.filter(arg=>arg!=='--single-process'),headless:true,protocolTimeout:45000,env:{...process.env,LD_LIBRARY_PATH:[path.join(libs,'lib'),process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')}});
const html=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
const provider=fs.readFileSync(path.join(root,'.harness/fixtures/rejson-account/rejson-account.js'),'utf8');
const tokenA='a'.repeat(48); // Synthetic test values, never real sessions.
const shared='rejson_community_session_v1';
// Production HTML and real provider; synthetic HTTP arbiter. Actual SQL is tested
// separately in supabase/tests/multiplayer_resume.sql, with full rollback.
const owner='11111111-1111-4111-8111-111111111111',pid='p'+'a'.repeat(19);
let active={session:'00000000-0000-4000-8000-000000000001',resume:null,world:'public'};
let joins=0,replacements=0,ignoreLeave=true,blockedSession=null,databaseRow=null,version=0,checkpointLeaves=0;const errors=[];
const click=(p,text)=>p.evaluate(text=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);if(!b)throw Error('Missing '+text);b.click();},text);
async function page(context,copy=null){
 const p=await context.newPage();await p.setViewport({width:1536,height:730});
 p.on('pageerror',e=>errors.push(e.message));p.on('dialog',dialog=>dialog.type()==='alert'?dialog.accept():dialog.dismiss());
 await p.setRequestInterception(true);
 p.on('request',async req=>{try{
  const url=new URL(req.url());assert.ok(!req.url().includes(tokenA));
  const reply=(data,status=200)=>req.respond({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:JSON.stringify(data)});
  if(url.protocol==='data:'||url.protocol==='blob:')return req.continue();
  if(url.pathname==='/mconline/')return req.respond({status:200,contentType:'text/html',body:html});
  if(url.pathname==='/js/rejson-account.js')return req.respond({status:200,contentType:'text/javascript',body:provider});
  if(req.method()==='OPTIONS')return req.respond({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'}});
  const b=JSON.parse(req.postData()||'{}');
  if(url.pathname.endsWith('community_whoami'))return reply({username:'Synthetic'});
  if(url.pathname.endsWith('mconline_identity'))return reply({id:owner,username:'Synthetic'});
  if(url.pathname.endsWith('mconline_worlds_op'))return reply({identity:{id:owner,username:'Synthetic'},worlds:[]});
  if(url.pathname.endsWith('/mconline-gateway')){
   if(b.op==='join'||b.op==='replace'){
    joins++;
    if(b.op==='join'&&active&&active.session!==b.session&&(!b.args?.resume||b.args.resume!==active.resume))return reply({error:'Serwer pamięta wcześniejsze połączenie konta.',code:'ACCOUNT_IN_USE'},409);
    if(b.op==='replace')replacements++;
    active={session:b.session,resume:b.args?.resume??null,world:b.world};return reply({data:{pid,username:'Synthetic',cursor:0}});
   }
   if(b.op==='leave'&&b.args?.profile)checkpointLeaves++;
   if(b.op==='leave'&&ignoreLeave)return reply({error:'Synthetic dropped teardown'},503);
   if(!active||b.session!==active.session||b.world!==active.world)return reply({error:'Sesja gry wygasła.'},409);
   if(b.op==='profile'||b.op==='leave'&&b.args?.profile){
    if(b.op==='profile'&&b.session===blockedSession)return reply({error:'Synthetic lost profile upload'},503);
    const row=b.op==='profile'?b.args:b.args.profile;
    if(row.mconline_guard&&row.mconline_base!==(databaseRow?.updated_at??null))return reply({error:'Profile conflict',code:'PROFILE_CONFLICT'},409);
    databaseRow={...row,pid,world:b.world,name:'Synthetic',updated_at:new Date(1800000000000+(++version)).toISOString(),save_id:row.mconline_save};
    if(b.op==='leave')active=null;
    return reply({data:[databaseRow]});
   }
   if(b.op==='leave'){active=null;return reply({data:null});}
   if(b.op==='read')return reply({data:b.args.table==='blockcraft_players'&&databaseRow?[databaseRow]:[]});
   if(b.op==='poll')return reply({data:{cursor:0,messages:[],presence:{[pid]:[{id:pid,name:'Synthetic',hue:30,skin:''}]}}});
   if(b.op==='rpc')return reply({data:b.args.name.includes('plot')?{owner:'b'.repeat(64),plots:[]}:[]});
  }
  return req.respond({status:204,body:''});
 }catch{if(!req.isInterceptResolutionHandled())await req.abort();}});
 await p.evaluateOnNewDocument(({shared,tokenA,copy})=>{
  localStorage.setItem(shared,JSON.stringify({token:tokenA,username:'Synthetic'}));
  localStorage.setItem('blockcraft-settings',JSON.stringify({quality:'potato',renderDistance:2,volume:0,fpsCap:30,fpsCapUserSet:true,autoQuality:false,lod:false,controlMode:'desktop'}));
  if(copy)sessionStorage.setItem(copy.key,copy.value);
 },{shared,tokenA,copy});
 await p.goto('https://rejson59.github.io/mconline/',{waitUntil:'domcontentloaded',timeout:60000});
 await p.waitForFunction(()=>document.querySelector('[aria-label="Zapis i konto"]')?.textContent.includes('światy w chmurze')).catch(async e=>{console.log('READY FAILURE',await p.evaluate(()=>document.body.innerText),errors);throw e;});
 return p;
}
try{
 const ctx=await browser.createBrowserContext(),p=await page(ctx);
 await click(p,'Tryb wieloosobowy');await click(p,'Dołącz do serwera');
 await p.waitForFunction(()=>document.body.innerText.includes('Odzyskaj połączenie'));
 assert.equal(replacements,0,'no automatic takeover of unknown earlier connection');
 // Explicit confirmation is required; dismissing must not send replace.
 await click(p,'Odzyskaj połączenie');assert.equal(replacements,0);
 p.removeAllListeners('dialog');p.on('dialog',d=>d.accept());
 await click(p,'Odzyskaj połączenie');
 await p.waitForFunction(()=>window.minecraft?.game?.net?.status==='connected',{timeout:60000});
 assert.equal(replacements,1);assert.ok(active.resume);const first=active.session;
 await p.waitForFunction(()=>!Object.keys(localStorage).some(k=>k.endsWith(':pending')));
 // Actual rendering at 2 FPS: food must advance by visible elapsed time, not
 // the two 50ms physics substeps. Old code did not heal after two such frames.
 const frame=await p.evaluate(()=>{const g=window.minecraft.game;g.fpsCap=2;g.health=10;g.hunger=20;g.saturation=6;g.exhaustion=0;g.foodRegenAcc=0;g.flying=true;g.body.pos.y=160;g.ui='inventory';g.lastTime=performance.now();return g.frameNo;});
 await p.waitForFunction(frame=>window.minecraft.game.frameNo>=frame+2,{timeout:20000},frame);
 assert.ok(await p.evaluate(()=>window.minecraft.game.health>=11.6),'native food regeneration at 2 FPS');
 blockedSession=first;
 await p.evaluate(()=>{const g=window.minecraft.game;g.fpsCap=30;g.health=20;g.body.pos.y=g.homeWorld.heightAt(Math.floor(g.body.pos.x),Math.floor(g.body.pos.z))+1;g.body.vel.set(0,0,0);g.fallStart=g.body.pos.y;g.body.onGround=true;g.flying=false;g.inventory.slots[0]={id:1,count:17};g.inventory.offhand={id:1,count:3};g.inventory.cursor={id:3,count:4};g.inventory.grid[0]={id:5,count:2};g.emitHud();});
 const expected=await p.evaluate(()=>{const g=window.minecraft.game;return [g.inventory.slots[0],g.inventory.offhand,g.inventory.cursor,g.inventory.grid[0]];});
 // Drop leave like a process/network failure. Real Web Lock + sessionStorage
 // must recover automatically with a NEW nonce, without another confirmation.
 await p.reload({waitUntil:'domcontentloaded',timeout:60000});
 await p.waitForFunction(()=>document.querySelector('[aria-label="Zapis i konto"]')?.textContent.includes('światy w chmurze')).catch(async e=>{console.log('READY FAILURE',await p.evaluate(()=>document.body.innerText),errors);throw e;});
 await click(p,'Tryb wieloosobowy');await click(p,'Dołącz do serwera');
 await p.waitForFunction(()=>window.minecraft?.game?.net?.status==='connected',{timeout:60000});
 assert.notEqual(active.session,first);assert.equal(replacements,1,'reload did not need another takeover');
 assert.deepEqual(await p.evaluate(()=>{const g=window.minecraft.game;return [g.inventory.slots[0],g.inventory.offhand,g.inventory.cursor,g.inventory.grid[0]];}),expected,'unacknowledged inventory restored after reload');
 await p.waitForFunction(()=>!Object.keys(localStorage).some(k=>k.endsWith(':pending')));
 assert.equal(JSON.parse(databaseRow.inv)[0].count,17,'recovered inventory genuinely reuploaded');
 assert.ok(checkpointLeaves>0,'pagehide included a final profile checkpoint');
 // Keep the real network poller/Web Lock alive, but stop headless 3D rendering
 // while opening extra tabs so software WebGL cannot starve their startup.
 await p.evaluate(()=>cancelAnimationFrame(window.minecraft.game.raf));
 const copy=await p.evaluate(()=>{const key=Object.keys(sessionStorage).find(k=>k.startsWith('mconline-mp-resume-v1:'));return {key,value:sessionStorage.getItem(key)};});
 const prior=joins,duplicate=await page(ctx,copy);
 await click(duplicate,'Tryb wieloosobowy');await click(duplicate,'Dołącz do serwera');
 await duplicate.waitForFunction(()=>document.body.innerText.includes('innej karcie tej przeglądarki'));
 assert.equal(joins,prior,'cloned resume key cannot bypass real Web Lock');
 const other=await browser.createBrowserContext(),p2=await page(other);
 await click(p2,'Tryb wieloosobowy');await click(p2,'Dołącz do serwera');
 await p2.waitForFunction(()=>document.body.innerText.includes('Odzyskaj połączenie'));
 assert.equal(replacements,1,'a genuinely different browser cannot auto-take over');
 await p2.screenshot({path:path.join(out,'recoverable-conflict.png')});
 p2.removeAllListeners('dialog');p2.on('dialog',d=>d.accept());await click(p2,'Odzyskaj połączenie');
 await p2.waitForFunction(()=>window.minecraft?.game?.net?.status==='connected',{timeout:60000});
 assert.deepEqual(await p2.evaluate(()=>{const g=window.minecraft.game;cancelAnimationFrame(g.raf);return [g.inventory.slots[0],g.inventory.offhand,g.inventory.cursor,g.inventory.grid[0]];}),expected,'second device restores committed inventory including cursor, grid and offhand');
 // Successful final checkpoint survives even when normal profile uploads fail
 // and the leaving document cannot acknowledge the checkpoint response.
 blockedSession=active.session;ignoreLeave=false;
 await p2.evaluate(()=>{const g=window.minecraft.game;g.inventory.slots[0].count=19;g.emitHud();});
 await p2.reload({waitUntil:'domcontentloaded',timeout:60000});
 await p2.waitForFunction(()=>document.querySelector('[aria-label="Zapis i konto"]')?.textContent.includes('światy w chmurze'));
 assert.equal(JSON.parse(databaseRow.inv)[0].count,19,'atomic final checkpoint actually saved last-frame inventory');
 assert.equal(active,null,'final checkpoint also released the connection');
 await click(p2,'Tryb wieloosobowy');await click(p2,'Dołącz do serwera');
 await p2.waitForFunction(()=>window.minecraft?.game?.net?.status==='connected',{timeout:60000});
 assert.equal(await p2.evaluate(()=>{const g=window.minecraft.game;cancelAnimationFrame(g.raf);return g.inventory.slots[0]?.count;}),19,'lost checkpoint acknowledgement resumes using committed save_id');
 assert.equal(errors.length,0,JSON.stringify(errors));
 const report={productionHTML:true,realProvider:true,mockedGateway:true,realWebLocks:true,renderPausedForConcurrentTabs:true,legacyOrphanRecoveredByConfirmedAction:true,confirmationCancelSendsNothing:true,reloadAfterDroppedLeave:true,freshGeneration:true,duplicatedTabBlocked:true,otherDeviceNotAutomaticallyReplaced:true,realEngineAt2FPSRegenerates:true,unacknowledgedInventoryRecovered:true,recoveredInventoryUploaded:true,secondDeviceInventoryRestored:true,finalCheckpointPayload:true,successfulFinalCheckpoint:true,uncertainCheckpointAckRecovered:true,errors};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('PASS multiplayer lease browser',JSON.stringify(report));
 ignoreLeave=false;await other.close();await duplicate.close();await ctx.close();
}finally{const timer=setTimeout(()=>browser.process()?.kill('SIGKILL'),5000);try{await browser.close();}finally{clearTimeout(timer);}}
