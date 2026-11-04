/** Offline, synthetic identities only. No real accounts, credentials or databases. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { act } from 'react';
import { JSDOM } from 'jsdom';
import { ACCOUNT_ORIGIN, ACCOUNT_PENDING_KEY, ACCOUNT_CONNECTED_KEY, ACCOUNT_DISCONNECTED_KEY, accountOriginSupported, pendingAccountReturn, shouldOpenAccountOnReturn, ProjectAccount, type RejsonAccountBridge, type AccountState } from '../src/game/communityAccount';
const cases: Array<{name:string;run:()=>void|Promise<void>}> = [];
const test=(name:string,run:()=>void|Promise<void>)=>cases.push({name,run});
const tick=()=>new Promise<void>(resolve=>setTimeout(resolve,5));
const domAt=(url=ACCOUNT_ORIGIN+'/mconline/')=>new JSDOM('<!doctype html><div id="root"></div>',{url,pretendToBeVisual:true,runScripts:'outside-only'});
function setup(getSession:RejsonAccountBridge['getSession'],url?:string) {
  const dom=domAt(url), win=dom.window as unknown as Window;
  const states:AccountState[]=[], listeners=new Set<()=>void>();let opens=0;
  const api:RejsonAccountBridge={getSession,open:()=>{opens++;},subscribe:cb=>{listeners.add(cb);return()=>{listeners.delete(cb);};}};
  win.RejsonAccount=api;
  const account=new ProjectAccount(win,state=>states.push(state));
  return {dom,win,states,listeners,api,account,opens:()=>opens,notify:()=>{for(const cb of [...listeners])cb();},close:()=>{account.dispose();dom.window.close();}};
}
test('integration document and actual provider are pinned by SHA256',()=>{
  const root='.harness/fixtures/rejson-account/';const manifest=JSON.parse(fs.readFileSync(root+'manifest.json','utf8'));
  assert.equal(manifest.commit,'0a6fd96d02dfe4b9f62e2fb62859d2134f438a20');
  for(const entry of manifest.files){const raw=fs.readFileSync(root+entry.fixture);assert.equal(raw.length,entry.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),entry.sha256);}
});
test('exact origin only, never a lookalike, alternate port, preview or file',()=>{
  assert.equal(accountOriginSupported(ACCOUNT_ORIGIN),true);
  for(const origin of ['http://rejson59.github.io','https://rejson59.github.io:444','https://rejson59.github.io.evil.example','https://preview.vercel.app','http://localhost:4173','null']) assert.equal(accountOriginSupported(origin),false);
});
test('return marker has bounded age and contains no identity',()=>{
  const dom=domAt();const s=dom.window.sessionStorage, now=Date.now();
  for(const value of ['', 'no', '-1','0',String(now+1),String(now-1800001),'{"username":"forged"}']) {s.setItem(ACCOUNT_PENDING_KEY,value);assert.equal(pendingAccountReturn(s,now),false);}
  s.setItem(ACCOUNT_PENDING_KEY,String(now));assert.equal(pendingAccountReturn(s,now),true);
  assert.equal(shouldOpenAccountOnReturn(dom.window as unknown as Window),true);dom.window.close();
});
test('only confirmed provider identity reaches project state; token is stripped',async()=>{
  const env=setup(async()=>({username:'Potwierdzone',token:'synthetic-not-a-real-session-token'}));
  try {env.account.start();await tick();assert.deepEqual(env.states[env.states.length - 1]?.identity,{username:'Potwierdzone'});assert.equal(env.states[env.states.length - 1]?.view,'connected');assert.doesNotMatch(JSON.stringify(env.states),/synthetic-not/);assert.equal(env.win.sessionStorage.getItem(ACCOUNT_CONNECTED_KEY),'1');assert.equal(env.opens(),0);}finally{env.close();}
});
test('no session does not redirect until a deliberate click, then saves only intent',async()=>{
  const env=setup(async()=>null);try{
    env.account.start();await tick();assert.equal(env.opens(),0);assert.equal(env.states[env.states.length - 1]?.view,'guest');
    await env.account.refresh(true);assert.equal(env.opens(),1);assert.equal(env.states[env.states.length - 1]?.view,'opening');
    assert.match(env.win.sessionStorage.getItem(ACCOUNT_PENDING_KEY)!,/^\d+$/);assert.equal(env.win.sessionStorage.getItem(ACCOUNT_CONNECTED_KEY),null);
  }finally{env.close();}
});
test('return without a session is not success and never redirects in a loop',async()=>{
  const env=setup(async()=>null);try{env.win.sessionStorage.setItem(ACCOUNT_PENDING_KEY,String(Date.now()));env.account.start();await tick();assert.equal(env.states[env.states.length - 1]?.view,'guest');assert.equal(env.opens(),0);assert.equal(env.win.sessionStorage.getItem(ACCOUNT_PENDING_KEY),null);}finally{env.close();}
});
test('verified return clears intent',async()=>{
  const env=setup(async()=>({username:'Powrot'}));try{env.win.sessionStorage.setItem(ACCOUNT_PENDING_KEY,String(Date.now()));env.account.start();await tick();assert.equal(env.states[env.states.length - 1]?.identity?.username,'Powrot');assert.equal(env.win.sessionStorage.getItem(ACCOUNT_PENDING_KEY),null);}finally{env.close();}
});
test('network error is retryable and does not expose provider error details',async()=>{
  let offline=true;const env=setup(async()=>{if(offline)throw Error('sensitive-debug-token');return {username:'Online'};});
  try{env.account.start();await tick();assert.equal(env.states[env.states.length - 1]?.view,'unavailable');assert.doesNotMatch(JSON.stringify(env.states),/sensitive-debug/);assert.equal(env.opens(),0);offline=false;await env.account.refresh(false);assert.equal(env.states[env.states.length - 1]?.identity?.username,'Online');}finally{env.close();}
});
test('late identity cannot replace a newer account and previous name clears immediately',async()=>{
  let resolveFirst:(value:{username:string})=>void=()=>{};let old=true;
  const env=setup(()=>old?new Promise(resolve=>{resolveFirst=resolve;}):Promise.resolve({username:'Nowe'}));
  try{env.account.start();await tick();old=false;env.notify();assert.equal(env.states[env.states.length - 1]?.identity,null);await tick();resolveFirst({username:'Stare'});await tick();assert.equal(env.states[env.states.length - 1]?.identity?.username,'Nowe');assert.ok(!env.states.some(state=>state.identity?.username==='Stare'));}finally{env.close();}
});
test('shared logout clears confirmed identity, does not open login automatically',async()=>{
  let signedIn=true;const env=setup(async()=>signedIn?{username:'Konto'}:null);
  try{env.account.start();await tick();signedIn=false;env.notify();assert.equal(env.states[env.states.length - 1]?.identity,null);await tick();assert.equal(env.states[env.states.length - 1]?.view,'guest');assert.equal(env.opens(),0);}finally{env.close();}
});
test('project disconnect preserves shared session and worlds; cannot silently reconnect',async()=>{
  const env=setup(async()=>({username:'Konto'}));try{
    env.win.localStorage.setItem('rejson_community_session_v1','shared-session-unchanged');env.win.localStorage.setItem('blockcraft-saves-v2','world-data');env.win.localStorage.setItem('blockcraft-profile-v1','profile-data');
    env.account.start();await tick();env.account.disconnect();env.notify();await tick();assert.equal(env.states[env.states.length - 1]?.view,'guest');assert.equal(env.states[env.states.length - 1]?.identity,null);
    assert.equal(env.win.localStorage.getItem('rejson_community_session_v1'),'shared-session-unchanged');assert.equal(env.win.localStorage.getItem('blockcraft-saves-v2'),'world-data');assert.equal(env.win.localStorage.getItem('blockcraft-profile-v1'),'profile-data');assert.equal(env.win.sessionStorage.getItem(ACCOUNT_DISCONNECTED_KEY),'1');
    await env.account.refresh(true);assert.equal(env.states[env.states.length - 1]?.view,'connected');
  }finally{env.close();}
});
test('disconnect invalidates an already pending response',async()=>{
  let resolve:(value:{username:string})=>void=()=>{};const env=setup(()=>new Promise(r=>{resolve=r;}));
  try{env.account.start();await tick();env.account.disconnect();resolve({username:'TooLate'});await tick();assert.equal(env.states[env.states.length - 1]?.view,'guest');assert.ok(!env.states.some(s=>s.identity?.username==='TooLate'));}finally{env.close();}
});
test('previous project disconnect is honored on reopening',async()=>{
  let calls=0;const env=setup(async()=>{calls++;return {username:'Konto'};});try{env.win.sessionStorage.setItem(ACCOUNT_DISCONNECTED_KEY,'1');env.account.start();await tick();assert.equal(calls,0);assert.equal(env.states[env.states.length - 1]?.view,'guest');}finally{env.close();}
});
test('unsupported origins never call provider even when one is injected',async()=>{
  let calls=0;const env=setup(async()=>{calls++;return {username:'WrongOrigin'};},'https://other.example/mconline/');
  try{env.account.start();await env.account.refresh(true);env.account.manage();assert.equal(calls,0);assert.equal(env.opens(),0);assert.equal(env.states[env.states.length - 1]?.view,'unsupported');}finally{env.close();}
});
test('blocked session storage cannot silently reconnect a consciously disconnected project',async()=>{
  let calls=0;const env=setup(async()=>{calls++;return {username:'Konto'};});let reopened:ProjectAccount|undefined;
  try{
    Object.defineProperty(env.win,'sessionStorage',{configurable:true,get(){throw Error('blocked');}});
    env.account.start();await tick();assert.equal(calls,1);env.account.disconnect();env.account.dispose();
    const states:AccountState[]=[];reopened=new ProjectAccount(env.win,state=>states.push(state));reopened.start();await tick();
    assert.equal(calls,1);assert.equal(states[states.length-1].view,'guest');
  }finally{reopened?.dispose();env.close();}
});
test('blocked session storage prevents redirect without a safe return marker',async()=>{
  const env=setup(async()=>null);try{Object.defineProperty(env.win,'sessionStorage',{configurable:true,get(){throw Error('blocked');}});await env.account.refresh(true);assert.equal(env.opens(),0);assert.equal(env.states[env.states.length - 1]?.view,'unavailable');}finally{env.close();}
});
test('delayed account bridge ready event is supported without a service worker',async()=>{
  const env=setup(async()=>({username:'Ready'}));try{delete env.win.RejsonAccount;env.account.start();await tick();env.win.RejsonAccount=env.api;env.win.dispatchEvent(new env.dom.window.Event('rj:account-ready'));await tick();assert.equal(env.states[env.states.length - 1]?.identity?.username,'Ready');}finally{env.close();}
});
test('script load failure gives retry and dispose cleans up subscriptions',async()=>{
  const env=setup(async()=>({username:'Ready'}));try{delete env.win.RejsonAccount;env.account.start();env.win.dispatchEvent(new env.dom.window.Event('rj:account-error'));await tick();assert.equal(env.states[env.states.length - 1]?.view,'unavailable');env.win.RejsonAccount=env.api;await env.account.refresh();assert.equal(env.listeners.size,1);env.account.dispose();assert.equal(env.listeners.size,0);}finally{env.close();}
});
test('hung provider becomes a retryable error, not a permanent loading screen',async()=>{
  const env=setup(()=>new Promise(()=>{}));const schedule=env.win.setTimeout.bind(env.win);
  env.win.setTimeout=((callback:TimerHandler,delay?:number)=>schedule(callback,delay===12000?5:delay)) as typeof env.win.setTimeout;
  try{env.account.start();await new Promise(resolve=>setTimeout(resolve,20));assert.equal(env.states[env.states.length-1]?.view,'unavailable');}finally{env.close();}
});
test('invalid provider response is not a login',async()=>{
  const env=setup(async()=>({username:''}));try{env.account.start();await tick();assert.equal(env.states[env.states.length - 1]?.view,'unavailable');assert.equal(env.states[env.states.length - 1]?.identity,null);}finally{env.close();}
});
test('manage account delegates same-tab navigation and keeps only intent',async()=>{
  const env=setup(async()=>({username:'Konto'}));try{env.account.start();await tick();env.account.manage();assert.equal(env.opens(),1);assert.match(env.win.sessionStorage.getItem(ACCOUNT_PENDING_KEY)!,/^\d+$/);}finally{env.close();}
});
test('pinned real provider verifies whoami instead of trusting stored username',async()=>{
  const dom=domAt();const w=dom.window;w.localStorage.setItem('rejson_community_session_v1',JSON.stringify({token:'synthetic-token-for-tests-only',username:'Forged'}));
  let calls=0;w.fetch=(async(url:unknown,init?:RequestInit)=>{calls++;assert.ok(String(url).endsWith('/community_whoami'));assert.equal(init?.cache,'no-store');assert.doesNotMatch(String(url),/synthetic-token/);return new Response(JSON.stringify({username:'ServerConfirmed'}),{status:200});}) as typeof fetch;
  try{w.eval(fs.readFileSync('.harness/fixtures/rejson-account/rejson-account.js','utf8'));const verified=await (w as unknown as Window).RejsonAccount!.getSession();assert.equal(verified?.username,'ServerConfirmed');assert.equal(calls,1);}finally{w.close();}
});
test('actual App uses only shared-account login and restores pending return dialog',async()=>{
  const dom=domAt(),w=dom.window,g=globalThis as unknown as Record<string,unknown>;
  const descriptors=new Map<string,PropertyDescriptor|undefined>();
  for(const key of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLCanvasElement','Element','Node','Event','MouseEvent','KeyboardEvent','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','localStorage','matchMedia']) if(key in w){descriptors.set(key,Object.getOwnPropertyDescriptor(g,key));Object.defineProperty(g,key,{value:(w as unknown as Record<string,unknown>)[key],configurable:true,writable:true});}
  g.IS_REACT_ACT_ENVIRONMENT=true;
  w.sessionStorage.setItem(ACCOUNT_PENDING_KEY,String(Date.now()));
  w.localStorage.setItem('blockcraft-saves-v2','[{"id":"world1","seed":42}]');w.localStorage.setItem('blockcraft-profile-v1','p1234567890123456789');
  let current:{username:string}|null={username:'PotwierdzoneKonto'};const callbacks=new Set<()=>void>();
  (w as unknown as Window).RejsonAccount={getSession:async()=>current,open:()=>{},subscribe:cb=>{callbacks.add(cb);return()=>{callbacks.delete(cb);};}};
  const {createRoot}=await import('react-dom/client');const App=(await import('../src/App')).default;
  const container=w.document.getElementById('root')!,root=createRoot(container);
  try{
    await act(async()=>{root.render(<App/>);await tick();});
    const dialog=container.querySelector('[role="dialog"]')!;assert.ok(dialog);assert.match(dialog.textContent!,/PotwierdzoneKonto/);assert.equal(dialog.querySelector('form'),null);assert.equal(dialog.querySelector('input'),null);assert.doesNotMatch(dialog.textContent!,/Konto społeczności/);
    current={username:'DrugieKonto'};await act(async()=>{for(const cb of callbacks)cb();await tick();});assert.match(dialog.textContent!,/DrugieKonto/);assert.doesNotMatch(dialog.textContent!,/PotwierdzoneKonto/);
    const disconnect=[...dialog.querySelectorAll('button')].find(b=>b.textContent==='Rozłącz ten projekt')!;
    await act(async()=>{disconnect.click();await tick();});assert.doesNotMatch(dialog.textContent!,/DrugieKonto/);assert.match(dialog.textContent!,/Zaloguj się przez rejson59.github.io/);
    assert.equal(w.localStorage.getItem('blockcraft-saves-v2'),'[{"id":"world1","seed":42}]');assert.equal(w.localStorage.getItem('blockcraft-profile-v1'),'p1234567890123456789');
    await act(async()=>{dialog.querySelector<HTMLButtonElement>('button[aria-label="Zamknij konto"]')!.click();});assert.equal(container.querySelector('[role="dialog"]'),null);
    assert.ok([...container.querySelectorAll('button')].some(b=>b.textContent==='Konto rejson59.github.io...'),'account reachable from title screen');
  }finally{await act(async()=>{root.unmount();});w.close();for(const[key,descriptor]of descriptors){if(descriptor)Object.defineProperty(g,key,descriptor);else Reflect.deleteProperty(g,key);}}
});
let failures=0;for(const item of cases){try{await item.run();console.log(`✓ ${item.name}`);}catch(error){failures++;console.error(`✗ ${item.name}`,error);}}
console.log(`${cases.length-failures}/${cases.length} account checks passed`);process.exit(failures?1:0);
