import assert from 'node:assert/strict';
import { connectAccountServer, type ConnectionEnvironment } from '../src/game/accountMultiplayer';
import { acquireTabLease } from '../src/game/multiplayerLease';
const owner='11111111-1111-4111-8111-111111111111';
const tick=()=>new Promise<void>(r=>setTimeout(r,0));
let checks=0;
const check=(name:string,fn:()=>void)=>{fn();checks++;console.log('✓ '+name);};
function fixture() {
 let locked=false,unlocks=0;
 const calls:{op:string;session:string;args:any;delivery:any}[]=[];
 const environment:ConnectionEnvironment={ acquire:async()=>{if(locked)throw Error('local lock');locked=true;return {resume:'a'.repeat(64),unlock(){locked=false;unlocks++;}};}};
 const authority={owner,username:'Synthetic',request:async(op:string,_world:string,session:string,args?:unknown,delivery?:unknown):Promise<any>=>{calls.push({op,session,args,delivery});if(op==='join'||op==='replace')return {pid:'p'+'a'.repeat(19),username:'Synthetic',cursor:0};return null;}};
 return {environment,authority,calls,unlocks:()=>unlocks,locked:()=>locked};
}
{
 const f=fixture(),one=await connectAccountServer(f.authority,'public',{},f.environment);
 let finish!:()=>void;
 const barrier=new Promise<void>(r=>{finish=r;});
 const released=one.release(barrier);
 const next=connectAccountServer(f.authority,'public',{},f.environment);
 await tick();check('rejoin waits for final profile writes, not a fake other-device error',()=>{assert.equal(f.calls.length,1);assert.ok(f.locked());});
 finish();await released;const two=await next;
 check('leave precedes the next join and uses a fresh fenced generation',()=>{assert.deepEqual(f.calls.map(c=>c.op),['join','leave','join']);assert.notEqual(f.calls[0].session,f.calls[2].session);assert.equal(f.calls[0].args.resume,f.calls[2].args.resume);});
 await Promise.all([two.release(),two.release()]);
 check('release is idempotent and unlocks both connections exactly once',()=>{assert.equal(f.calls.filter(c=>c.op==='leave').length,2);assert.equal(f.unlocks(),2);});
}
{
 const f=fixture();const original=f.authority.request;
 f.authority.request=async(...args)=>{await original(...args);if(args[0]==='join')throw Error('lost committed join response');return null;};
 await assert.rejects(connectAccountServer(f.authority,'public',{},f.environment),/lost committed/);
 check('ambiguous committed join is cleaned even without a successful response',()=>{assert.deepEqual(f.calls.map(c=>c.op),['join','leave']);assert.equal(f.unlocks(),1);assert.equal(f.calls[0].session,f.calls[1].session);});
}
{
 const f=fixture(),controller=new AbortController();let finish!:()=>void;
 const wait=new Promise<void>(r=>{finish=r;});const original=f.authority.request;
 f.authority.request=async(...args)=>{const result=await original(...args);if(args[0]==='join')await wait;return result;};
 const attempt=connectAccountServer(f.authority,'city',{signal:controller.signal},f.environment);
 await tick();controller.abort();finish();await assert.rejects(attempt);
 check('cancelling during join cannot leave a successful orphan behind',()=>{assert.deepEqual(f.calls.map(c=>c.op),['join','leave']);assert.equal(f.unlocks(),1);});
}
{
 const f=fixture();const controller=new AbortController();controller.abort();
 await assert.rejects(connectAccountServer(f.authority,'city',{signal:controller.signal},f.environment));
 check('already cancelled attempt neither locks nor contacts server',()=>{assert.equal(f.calls.length,0);assert.equal(f.locked(),false);});
}
{
 const f=fixture();const lifecycle=new EventTarget();f.environment.lifecycle=lifecycle as unknown as ConnectionEnvironment['lifecycle'];
 const one=await connectAccountServer(f.authority,'public',{},f.environment);
 lifecycle.dispatchEvent(new Event('pagehide'));await one.release();
 check('navigation/pagehide sends small keepalive leave and releases lock',()=>{const last=f.calls.at(-1)!;assert.equal(last.op,'leave');assert.equal(last.delivery.keepalive,true);assert.equal(last.delivery.timeout,5000);assert.equal(f.unlocks(),1);});
 let restored=false;lifecycle.addEventListener('mconline-server-disconnected',()=>{restored=true;});
 const show=new Event('pageshow');Object.defineProperty(show,'persisted',{value:true});lifecycle.dispatchEvent(show);
 check('BFCache restore does not silently keep a closed game transport',()=>assert.ok(restored));
}
{
 const f=fixture(),original=f.authority.request;
 f.authority.request=async(...args)=>{const value=await original(...args);if(args[0]==='leave')throw Error('session already gone');return value;};
 const one=await connectAccountServer(f.authority,'public',{},f.environment);await one.release();
 check('failed logout/leave still releases local lock for safe recovery',()=>assert.equal(f.unlocks(),1));
}
{
 // Exercise the real browser lease helper with cloned sessionStorage semantics.
 const values=new Map<string,string>();const locks=new Set<string>();
 const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
 const oldNav=Object.getOwnPropertyDescriptor(globalThis,'navigator'),oldStorage=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(name:string,_options:unknown,callback:(lock:unknown)=>unknown)=>{if(locks.has(name))return callback(null);locks.add(name);try{return await callback({});}finally{locks.delete(name);}}}}});
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:storage});
 try{
  const one=await acquireTabLease(owner);
  await assert.rejects(acquireTabLease(owner),e=>(e as {code:string}).code==='LOCAL_SESSION_ACTIVE');
  check('duplicated-tab resume secret is not enough to steal an active Web Lock',()=>assert.equal(values.size,1));
  one.unlock();await tick();const two=await acquireTabLease(owner);
  check('reload can resume the same tab with persistent proof after old document unlocks',()=>{assert.equal(two.resume,one.resume);assert.match(two.resume!,/^[a-f0-9]{64}$/);});two.unlock();await tick();
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});
  const fallback=await acquireTabLease(owner);
  check('without Web Locks automatic resume is disabled, not weakened to storage-only',()=>assert.equal(fallback.resume,null));
 }finally{if(oldNav)Object.defineProperty(globalThis,'navigator',oldNav);else Reflect.deleteProperty(globalThis,'navigator');if(oldStorage)Object.defineProperty(globalThis,'sessionStorage',oldStorage);else Reflect.deleteProperty(globalThis,'sessionStorage');}
}
console.log(`${checks} multiplayer lifecycle checks passed`);
