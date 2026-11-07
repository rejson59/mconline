/** Non-mutating public HTTP authorization checks. Run by GitHub CI (no keys or
 * real sessions in Actions secrets). SQL suites cover valid synthetic sessions
 * inside rolled-back transactions. Never prints response bodies or headers. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
// Keep the sanitized status assertion accessible through GitHub annotations when log downloads are unavailable.
process.on('uncaughtException', error => {
 const text=String(error instanceof Error?error.message:'Authorization check failed').slice(0,1600).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
 console.error(`::error title=Deployed authorization check::${text}`);process.exitCode=1;
});
const online=fs.readFileSync(new URL('../src/game/online.ts',import.meta.url),'utf8');
const fixture=fs.readFileSync(new URL('../.harness/fixtures/rejson-account/rejson-account.js',import.meta.url),'utf8');
const world='https://bewwejewgqzctnjrbclu.supabase.co',account='https://hzbqzfimtroixnldzjeq.supabase.co';
const worldKey=/SUPABASE_ANON\s*=\s*'([^']+)'/.exec(online)[1],accountKey=/var KEY = "([^"]+)"/.exec(fixture)[1];
async function call(base,path,body,extra={},method=body===undefined?'GET':'POST'){
 const key=base===account?accountKey:worldKey;
 return fetch(base+path,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...extra},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});
}
let count=0;
async function denied(name,base,path,body){const r=await call(base,path,body);assert.ok(r.status===401||r.status===403,`${name}: expected authentication/permission denial, got HTTP ${r.status}`);await r.arrayBuffer();console.log(`PASS ${name}: HTTP ${r.status}`);count++;}
await denied('anonymous game block read',world,'/rest/v1/blockcraft_blocks?select=world&limit=0');
await denied('anonymous inventory read',world,'/rest/v1/blockcraft_players?select=world&limit=0');
await denied('anonymous cloud library read',account,'/rest/v1/mconline_worlds?select=id&limit=0');
await denied('legacy plot capability route retired',world,'/rest/v1/rpc/blockcraft_plot',{p_world:'public',p_key:'0'.repeat(64),p_op:'list'});
await denied('legacy block write route retired',world,'/rest/v1/rpc/blockcraft_write_blocks',{p_world:'public',p_key:'0'.repeat(64),p_edits:[]});
await denied('private account mapping RPC',world,'/rest/v1/rpc/mconline_member',{p_account:crypto.randomUUID(),p_username:'Test',p_session:crypto.randomUUID(),p_world:'public',p_op:'touch'});
await denied('invalid general session identity',account,'/rest/v1/rpc/mconline_identity',{p_token:'not-a-real-account-session-only-ci'});
await denied('invalid cloud save session',account,'/rest/v1/rpc/mconline_worlds_op',{p_token:'not-a-real-account-session-only-ci',p_op:'list'});
await denied('gateway anonymous join',world,'/functions/v1/mconline-gateway',{op:'join'});
await denied('gateway invalid session, real cross-project check',world,'/functions/v1/mconline-gateway',{token:'not-a-real-account-session-only-ci',op:'join',world:'public',session:crypto.randomUUID()});
await denied('private resume mapping RPC',world,'/rest/v1/rpc/mconline_member_v2',{p_account:crypto.randomUUID(),p_username:'Test',p_session:crypto.randomUUID(),p_world:'public',p_op:'touch'});
await denied('gateway anonymous takeover',world,'/functions/v1/mconline-gateway',{op:'replace'});
await denied('private atomic profile RPC',world,'/rest/v1/rpc/mconline_profile',{p_account:crypto.randomUUID(),p_username:'Test',p_session:crypto.randomUUID(),p_world:'public',p_profile:{}});
const origin=await call(world,'/functions/v1/mconline-gateway',{op:'join'},{Origin:'https://rejson59.github.io.evil.invalid'});assert.equal(origin.status,403);count++;console.log('PASS gateway refuses lookalike origin');
const preflight=await call(world,'/functions/v1/mconline-gateway',undefined,{Origin:'https://rejson59.github.io','Access-Control-Request-Method':'POST'},'OPTIONS');assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'https://rejson59.github.io');count++;console.log('PASS production account origin preflight');
for(const name of ['mconline_chest','mconline_mobs','mconline_mob_action'])await denied('private shared-state RPC '+name,world,'/rest/v1/rpc/'+name,{p_account:crypto.randomUUID(),p_username:'Test',p_session:crypto.randomUUID(),p_world:'public',p_args:{}});
await denied('reference panel anonymous session',world,'/functions/v1/mconline-reference-storage',{op:'status'});
await denied('reference panel invalid session, cross-project check',world,'/functions/v1/mconline-reference-storage',{op:'probe',token:'not-a-real-account-session-only-ci'});
const refOrigin=await call(world,'/functions/v1/mconline-reference-storage',{op:'status'},{Origin:'https://rejson59.github.io.evil.invalid'});assert.equal(refOrigin.status,403);count++;console.log('PASS reference panel refuses lookalike origin');
const refOptions=await call(world,'/functions/v1/mconline-reference-storage',undefined,{Origin:'https://rejson59.github.io','Access-Control-Request-Method':'POST'},'OPTIONS');assert.equal(refOptions.status,204);assert.equal(refOptions.headers.get('access-control-allow-origin'),'https://rejson59.github.io');count++;console.log('PASS reference panel preflight');
for(const bearer of [undefined,'Bearer not-a-real-job-identity',`Bearer ${worldKey}`]){
 const reader=await fetch(world+'/functions/v1/mconline-reference-reader',{method:'POST',headers:bearer?{Authorization:bearer}:{},signal:AbortSignal.timeout(30000)});
 assert.equal(reader.status,401,'reference reader rejects missing/opaque/non-OIDC identity');await reader.arrayBuffer();count++;console.log('PASS reference reader denies non-job identity');
}
const readerBrowser=await call(world,'/functions/v1/mconline-reference-reader',undefined,{Origin:'https://rejson59.github.io'},'POST');assert.equal(readerBrowser.status,403);count++;console.log('PASS reference reader rejects browser access');
console.log(`${count} deployed HTTP authorization checks passed (no real accounts, no persistent test writes)`);
