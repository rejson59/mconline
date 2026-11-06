import assert from 'node:assert/strict';
import { ProfileCheckpoint } from '../src/game/profileCheckpoint';
import { sanitizeProfile, profileRow, PROFILE_KEY } from '../src/game/profile';
import { foodClockDelta } from '../src/game/hunger';
let count=0;
const test=(name:string,fn:()=>void)=>{fn();count++;console.log('✓ '+name);};
const pid='p'+'a'.repeat(19),values=new Map<string,string>();
const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
const make=(n:number)=>sanitizeProfile({pid,x:3,y:70,z:5,inv:[{id:1,count:n}],armor:[],updated:n,health:12,hunger:20})!;
const remote={...profileRow(make(1),'public'),updated_at:'2026-11-06T10:00:00.000001+00:00',save_id:'initial'};
test('ordinary remote read cannot silently replace an unacknowledged inventory',()=>{
 const c=new ProfileCheckpoint('public',pid,storage);c.load(remote);c.stage(make(2));
 assert.equal(new ProfileCheckpoint('public',pid,storage).load(remote)!.inv[0]!.count,2);
});
test('recovered writes compare the exact server version, not browser clocks',()=>{
 const c=new ProfileCheckpoint('public',pid,storage);const p=c.load(remote)!;const r=c.row(p);
 assert.equal(r.mconline_base,remote.updated_at);assert.equal(r.mconline_guard,true);assert.equal(r.pid,pid);
});
test('lost response to an older in-flight write still preserves the newer queued inventory',()=>{
 const c=new ProfileCheckpoint('public',pid,storage);c.load(remote);c.stage(make(3));const r=c.row(make(3));c.stage(make(4));
 const committed={...profileRow(make(3),'public'),updated_at:'2026-11-06T10:00:00.000002+00:00',save_id:r.mconline_save};
 assert.equal(new ProfileCheckpoint('public',pid,storage).load(committed)!.inv[0]!.count,4);
});
test('a truly changed remote inventory is never overwritten by stale local recovery',()=>{
 const before=[...values];const changed={...remote,updated_at:'2099-01-01T00:00:00Z',save_id:'other-device'};
 assert.throws(()=>new ProfileCheckpoint('public',pid,storage).load(changed),/Obie wersje zachowane/);assert.deepEqual([...values],before);
});
values.clear();
test('acknowledging a write does not clear a newer queued snapshot',()=>{
 const c=new ProfileCheckpoint('public',pid,storage);c.load(remote);c.stage(make(5));c.row(make(5));c.stage(make(6));
 const ack={...remote,updated_at:'2026-11-06T10:00:01+00:00'};c.acknowledge(ack,make(5));
 assert.equal(new ProfileCheckpoint('public',pid,storage).load(ack)!.inv[0]!.count,6);
});
test('a successful final acknowledgement clears only its own pending journal',()=>{
 const c=new ProfileCheckpoint('public',pid,storage);const p=c.load({...remote,updated_at:'2026-11-06T10:00:01+00:00'})!;const row=c.row(p);
 const ack={...row,updated_at:'2026-11-06T10:00:02+00:00',save_id:row.mconline_save};c.acknowledge(ack,p);
 assert.equal(values.has(`${PROFILE_KEY}:public:${pid}:pending`),false);
 assert.equal(new ProfileCheckpoint('public',pid,storage).load(ack)!.inv[0]!.count,6);
});
test('world and owner journals cannot leak into one another',()=>{
 const c=new ProfileCheckpoint('public',pid,storage);c.load(remote);c.stage(make(8));
 assert.equal(new ProfileCheckpoint('city',pid,storage).load(null),null);
 assert.equal(new ProfileCheckpoint('public','p'+'b'.repeat(19),storage).load(null),null);
});
test('corrupt inventory JSON fails closed rather than producing an empty inventory',()=>{
 for(const inv of ['{bad','null','{}',null])assert.equal(sanitizeProfile({...remote,inv}),null);
 assert.equal(sanitizeProfile({...remote,armor:'bad'}),null);
 assert.ok(sanitizeProfile({...remote,inv:'[]',armor:'[]'}));
});
test('quota failure is reported and cloud version checks remain available',()=>{
 const c=new ProfileCheckpoint('public',pid,{...storage,getItem:()=>null,setItem(){throw Error('quota');}});c.load(remote);
 assert.equal(c.stage(make(9)),false);assert.equal(c.row(make(9)).mconline_base,remote.updated_at);
});
test('invalid pending journal is preserved, not silently replaced',()=>{
 const key=`${PROFILE_KEY}:public:${pid}:pending`;values.set(key,'{bad');
 assert.throws(()=>new ProfileCheckpoint('public',pid,storage));assert.equal(values.get(key),'{bad');
});
test('visible regeneration clock is independent of the 100ms physics cap',()=>{
 for(const fps of [2,5,10,20,30,60,144]){let seconds=0;for(let i=0;i<fps*4;i++)seconds+=foodClockDelta(1000/fps);assert.ok(Math.abs(seconds-4)<1e-8);}
});
test('hidden tabs and invalid/stalled frames cannot bank unlimited healing',()=>{
 assert.equal(foodClockDelta(60000,true),0);assert.equal(foodClockDelta(60000),1);assert.equal(foodClockDelta(NaN),0);assert.equal(foodClockDelta(-1),0);
});
console.log(`${count} inventory checkpoint/food clock checks passed`);
