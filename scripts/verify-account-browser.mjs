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
const out=path.join(root,'.cache/verification427');fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args.filter(arg=>arg!=='--single-process'),headless:true,protocolTimeout:45000,env:{...process.env,LD_LIBRARY_PATH:[path.join(libs,'lib'),process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')}});
const html=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
const provider=fs.readFileSync(path.join(root,'.harness/fixtures/rejson-account/rejson-account.js'),'utf8');
const tokenA='a'.repeat(48),tokenB='b'.repeat(48); // Synthetic test values, never real sessions.
const shared='rejson_community_session_v1';
const reports=[];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const click=(page,text)=>page.evaluate(text=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);if(!b)throw Error('Missing '+text);b.click();},text);
const dialog=page=>page.waitForSelector('[role="dialog"][aria-labelledby="community-title"]');
const loginFixture=`<!doctype html><meta charset="utf-8"><title>Synthetic account return fixture</title><button id="confirm">Potwierdź testowe konto</button><script>
 document.getElementById('confirm').onclick=()=>{
   localStorage.setItem('${shared}',JSON.stringify({token:'${tokenA}',username:'NieufnaNazwaZPamieci'}));
   window.dispatchEvent(new Event('rj:session-change'));
   const saved=JSON.parse(sessionStorage.getItem('rejson_account_return_v1')||'null');
   sessionStorage.removeItem('rejson_account_return_v1');
   location.assign(saved&&saved.path.startsWith('/mconline/')?saved.path:'/mconline/');
 };
</script>`;
try{
  for(const device of (process.env.BROWSER_CASES??'desktop,mobile').split(',')){
    const context=await browser.createBrowserContext(),p=await context.newPage(),errors=[];
    let offline=false,hold=false,release=()=>{},whoami=0,helperLoads=0,loginVisits=0;
    let heldStarted=()=>{};let held=new Promise(resolve=>{heldStarted=resolve;});
    const attempted=[];
    p.on('pageerror',e=>errors.push(e.message));
    // 503 is intentionally exercised; don't mistake its expected console entry for an app exception.
    p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('503'))errors.push(m.text());});
    await p.setViewport(device==='mobile'?{width:390,height:844,isMobile:true,hasTouch:true}:{width:960,height:600});
    await p.setRequestInterception(true);
    p.on('request',async req=>{
      try{
        const url=new URL(req.url());attempted.push(url.protocol==='https:'||url.protocol==='http:'?url.origin+url.pathname:url.protocol);
        assert.ok(!req.url().includes(tokenA)&&!req.url().includes(tokenB),'No session in URL');
        if(url.origin==='https://rejson59.github.io'&&url.pathname==='/js/rejson-account.js'){
          helperLoads++;await req.respond({status:200,contentType:'text/javascript',body:provider});return;
        }
        if(url.origin==='https://rejson59.github.io'&&url.pathname==='/logowanie'){
          loginVisits++;await req.respond({status:200,contentType:'text/html',body:loginFixture});return;
        }
        if(url.origin==='https://rejson59.github.io'&&url.pathname==='/mconline/'){
          await req.respond({status:200,contentType:'text/html',body:html});return;
        }
        if(url.pathname==='/rest/v1/rpc/community_whoami'){
          whoami++;const params=JSON.parse(req.postData()||'{}');
          if(hold&&params.p_token===tokenA){hold=false;heldStarted();await new Promise(resolve=>{release=resolve;});}
          await req.respond({status:offline?503:200,contentType:'application/json',body:JSON.stringify(offline?{message:'Test offline'}:{username:params.p_token===tokenA?'TestoweKontoA':params.p_token===tokenB?'TestoweKontoB':null})});return;
        }
        if(url.protocol==='data:'||url.protocol==='blob:'){await req.continue();return;}
        await req.respond({status:204,body:''});
      }catch{if(!req.isInterceptResolutionHandled())await req.abort();}
    });
    await p.evaluateOnNewDocument(()=>{
      if(location.pathname.startsWith('/mconline/')&&!sessionStorage.getItem('account427-world-fixture')){
        localStorage.setItem('blockcraft-saves-v2','[{"id":"untouched-local-world","seed":42}]');
        localStorage.setItem('blockcraft-profile-v1','p1234567890123456789');
        sessionStorage.setItem('account427-world-fixture','1');
      }
    });
    await p.goto('https://rejson59.github.io/mconline/?v=4.27.0',{waitUntil:'networkidle0'});
    assert.equal(await p.evaluate(()=>navigator.serviceWorker.controller),null,'direct first visit has no SW');
    await click(p,'Konto rejson59.github.io...');await dialog(p);
    await p.waitForFunction(()=>document.querySelector('[role="dialog"]')?.textContent.includes('Brak potwierdzonej sesji'));
    assert.equal(await p.$$eval('[role="dialog"] input,[role="dialog"] form',a=>a.length),0,'no legacy credentials');
    await Promise.all([p.waitForNavigation({waitUntil:'networkidle0'}),click(p,'Zaloguj się przez rejson59.github.io')]);
    assert.equal(new URL(p.url()).pathname,'/logowanie');
    assert.match(await p.evaluate(()=>sessionStorage.getItem('mconline-account-pending-v1')),/^\d+$/);
    await Promise.all([p.waitForNavigation({waitUntil:'networkidle0'}),p.click('#confirm')]);
    await dialog(p);await p.waitForFunction(()=>document.querySelector('[role="dialog"] strong')?.textContent==='TestoweKontoA');
    assert.ok(!(await p.$eval('[role="dialog"]',e=>e.textContent)).includes('NieufnaNazwaZPamieci'));
    assert.equal(await p.evaluate(()=>sessionStorage.getItem('mconline-account-pending-v1')),null);
    await p.screenshot({path:path.join(out,`${device}-confirmed.png`)});
    const original=await p.evaluate(key=>localStorage.getItem(key),shared);
    await click(p,'Rozłącz ten projekt');
    assert.equal(await p.evaluate(key=>localStorage.getItem(key),shared),original,'project disconnect preserves shared login');
    await p.click('[aria-label="Zamknij konto"]');await click(p,'Konto rejson59.github.io...');await dialog(p);
    await p.waitForFunction(()=>document.querySelector('[role="dialog"]')?.textContent.includes('Projekt jest rozłączony'));
    await click(p,'Zaloguj się przez rejson59.github.io');
    await p.waitForFunction(()=>document.querySelector('[role="dialog"] strong')?.textContent==='TestoweKontoA');
    assert.equal(loginVisits,1,'existing verified session does not navigate to login');
    offline=true;await p.evaluate(()=>window.dispatchEvent(new Event('rj:session-change')));
    await p.waitForFunction(()=>document.querySelector('[role="dialog"]')?.textContent.includes('Nie można potwierdzić konta'));
    assert.equal(await p.$$eval('[role="dialog"] strong',a=>a.length),0,'offline state hides stale account');
    await p.screenshot({path:path.join(out,`${device}-offline.png`)});
    offline=false;await click(p,'Spróbuj ponownie');
    await p.waitForFunction(()=>document.querySelector('[role="dialog"] strong')?.textContent==='TestoweKontoA');
    // Hold the old account's real whoami response, switch account and then release it.
    hold=true;held=new Promise(resolve=>{heldStarted=resolve;});
    await p.evaluate(()=>window.dispatchEvent(new Event('rj:session-change')));await held;
    await p.evaluate(({key,token})=>{localStorage.setItem(key,JSON.stringify({token,username:'ForgedB'}));window.dispatchEvent(new StorageEvent('storage',{key}));},{key:shared,token:tokenB});
    await p.waitForFunction(()=>document.querySelector('[role="dialog"] strong')?.textContent==='TestoweKontoB');
    release();await wait(100);
    assert.equal(await p.$eval('[role="dialog"] strong',e=>e.textContent),'TestoweKontoB','late old identity ignored');
    await p.evaluate(key=>{localStorage.removeItem(key);window.dispatchEvent(new Event('rj:session-change'));},shared);
    await p.waitForFunction(()=>document.querySelector('[role="dialog"]')?.textContent.includes('Brak potwierdzonej sesji'));
    assert.equal(new URL(p.url()).pathname,'/mconline/','shared logout never redirects in a loop');
    await p.evaluate(({key,token})=>{localStorage.setItem(key,JSON.stringify({token,username:'ForgedA'}));window.dispatchEvent(new Event('rj:session-change'));},{key:shared,token:tokenA});
    await p.waitForFunction(()=>document.querySelector('[role="dialog"] strong')?.textContent==='TestoweKontoA');
    await Promise.all([p.waitForNavigation({waitUntil:'networkidle0'}),click(p,'Zarządzaj kontem na stronie')]);
    await Promise.all([p.waitForNavigation({waitUntil:'networkidle0'}),p.click('#confirm')]);
    await dialog(p);await p.waitForFunction(()=>document.querySelector('[role="dialog"] strong')?.textContent==='TestoweKontoA');
    const data=await p.evaluate(()=>({world:localStorage.getItem('blockcraft-saves-v2'),profile:localStorage.getItem('blockcraft-profile-v1'),keys:Array.from({length:sessionStorage.length},(_,i)=>sessionStorage.key(i))}));
    assert.equal(data.world,'[{"id":"untouched-local-world","seed":42}]');assert.equal(data.profile,'p1234567890123456789');
    const onlyPermitted=attempted.every(url=>url==='https://rejson59.github.io/mconline/'||url==='https://rejson59.github.io/js/rejson-account.js'||url==='https://rejson59.github.io/logowanie'||url.endsWith('/rest/v1/rpc/community_whoami')||url==='https://rejson59.github.io/favicon.ico'||url.startsWith('data:')||url.startsWith('blob:'));
    assert.equal(onlyPermitted,true,'unexpected HTTP route: '+attempted.filter(url=>url.startsWith('http')&&!url.includes('/mconline/')&&!url.includes('/js/rejson-account.js')&&!url.includes('/logowanie')&&!url.endsWith('/rest/v1/rpc/community_whoami')&&!url.endsWith('/favicon.ico')).join(', '));
    assert.equal(errors.length,0,JSON.stringify(errors));
    reports.push({device,environment:'production HTML and pinned real provider, mocked login page/whoami, synthetic accounts only',helperLoads,whoamiRequests:whoami,loginVisits,roundTrip:true,noServiceWorker:true,noCredentialForms:true,verifiedName:true,projectDisconnectPreservesSharedSession:true,sharedLogout:true,accountSwitch:true,lateResponseIgnored:true,offlineRetry:true,worldsAndProfileUntouched:true,secretsInUrls:false,errors});
    console.log('PASS account',JSON.stringify(reports[reports.length-1]));await context.close();
  }
  for(const device of ['preview','file','other-origin']){
    const context=await browser.createBrowserContext(),p=await context.newPage(),errors=[];let helperCalls=0;
    p.on('pageerror',e=>errors.push(e.message));
    p.on('request',req=>{if(req.url().includes('/js/rejson-account.js'))helperCalls++;});
    if(device==='other-origin'){
      await p.setRequestInterception(true);p.on('request',req=>req.respond({status:200,contentType:'text/html',body:html}));
    }
    await p.goto(device==='file'?pathToFileURL(path.join(root,'dist/index.html')).href:device==='other-origin'?'https://other.example/mconline/':(process.env.BROWSER_URL??'http://127.0.0.1:4173/'),{waitUntil:'networkidle0'});
    await click(p,'Konto rejson59.github.io...');await dialog(p);
    await p.waitForFunction(()=>document.querySelector('[role="dialog"]')?.textContent.includes('Wspólne logowanie działa wyłącznie'));
    assert.equal(helperCalls,0);assert.equal(await p.$$eval('[role="dialog"] input,[role="dialog"] form',a=>a.length),0);assert.equal(errors.length,0);
    reports.push({device,sameOriginRestriction:true,helperRequests:helperCalls,noCredentialForms:true,errors});console.log('PASS account origin',device);await context.close();
  }
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({version:JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,reports},null,2)+'\n');
}finally{const timer=setTimeout(()=>browser.process()?.kill('SIGKILL'),5000);try{await browser.close();}finally{clearTimeout(timer);}}
