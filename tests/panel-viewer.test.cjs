'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {harness}=require('./security-auth-harness.cjs');
async function fixture(){const h=await harness(),account=await h.load('lib/auth/account.js');const input={provider:'google',sub:'panel-viewer',email:'viewer@synthetic.invalid',emailVerified:true};const a=await account.upsertAccount(input),session=await account.mintSession(a.key);return{h,account,input,key:a.key,session:session.session};}
test('34.6 capability is independent, revocable and bound to account generation',async()=>{
 const f=await fixture(),p=await f.h.load('lib/panel-access.js'),owner={role:'owner',accountKey:'synthetic-owner'};
 assert.equal((await p.resolvePanelViewer({body:{session:f.session}})).state,'denied');
 assert.equal((await p.setPanelViewer(f.key,true,owner)).ok,true);
 assert.equal((await p.resolvePanelViewer({body:{session:f.session}})).state,'live');
 assert.equal((await (await f.h.load('lib/articles/roles.js')).roleFor(f.key)).role,'none');
 assert.equal((await p.setPanelViewer(f.key,false,owner)).ok,true);
 assert.equal((await p.resolvePanelViewer({body:{session:f.session}})).state,'denied');
 await p.setPanelViewer(f.key,true,owner);await f.account.deleteAccount(f.key,f.session);await f.account.upsertAccount(f.input);const fresh=await f.account.mintSession(f.key);
 assert.equal((await p.resolvePanelViewer({body:{session:fresh.session}})).state,'denied');
 assert.equal((await p.setPanelViewer(f.key,true,{role:'editor'})).ok,false);
});
test('34.6 projection spread mutation leaks a private canary and is detected',()=>{
 const source=fs.readFileSync('lib/panel-access.js','utf8').split('const count=')[1];
 const code=('const count='+source).replace('export function','function').replace('return {ok:true,kind,read:', 'return {...raw,ok:true,kind,read:');
 const fn=vm.runInNewContext(code+';projectViewer');assert(JSON.stringify(fn('usage-chat',{fp:'PRIVATE'})).includes('PRIVATE'));
});
test('34.6 grant route requires owner; self reports only caller capability',async()=>{
 const f=await fixture();
 assert.equal((await f.h.post('api/panel-access.js',{session:f.session,action:'grant',accountKey:f.key})).statusCode,401);
 f.h.env.EZIK_OWNER_ACCOUNTS=f.account.emailDigest(f.input.email);
 assert.equal((await f.h.post('api/panel-access.js',{session:f.session,action:'grant',accountKey:f.key})).statusCode,200);
 delete f.h.env.EZIK_OWNER_ACCOUNTS;
 const self=await f.h.post('api/panel-access.js',{session:f.session,action:'self'});assert.equal(self.body.role,'viewer');assert.deepEqual(Object.keys(self.body).sort(),['ok','role']);
 f.h.faults.down=true;assert.equal((await f.h.post('api/panel-access.js',{session:f.session,action:'self'})).statusCode,503);
});
test('34.6 inbox refuses viewer private actions and emits a closed aggregate projection',async()=>{
 const f=await fixture(),p=await f.h.load('lib/panel-access.js');await p.setPanelViewer(f.key,true,{role:'owner',accountKey:'synthetic-owner'});
 for(const action of ['read','reply','delete'])for(const kind of ['feedback','reports','answers','overview','usage'])assert.equal((await f.h.post('api/inbox.js',{session:f.session,action,kind})).statusCode,401);
 for(const kind of ['feedback','reports','answers','overview'])assert.equal((await f.h.post('api/inbox.js',{session:f.session,action:'list',kind})).statusCode,401);
 const projected=p.projectViewer('usage-chat',{read:25,noFind:5,noSource:8,faults:3,firstMs:10,slowMs:30,fp:'PRIVATE',items:[{text:'PRIVATE'}],unread:99,top:[{k:'PRIVATE'}]});
 assert(!JSON.stringify(projected).includes('PRIVATE'));assert(!('unread'in projected));assert.equal(projected.read,25);assert.deepEqual(Array.from(projected.top),[]);
 for(const kind of ['usage','usage-chat'])assert.equal((await f.h.post('api/inbox.js',{session:f.session,action:'list',kind})).statusCode,200);
 const out=await f.h.post('api/panel-access.js',{session:f.session,action:'grant',accountKey:f.key});assert.equal(out.statusCode,401);
 await p.setPanelViewer(f.key,false,{role:'owner',accountKey:'synthetic-owner'});
 assert.equal((await f.h.post('api/inbox.js',{session:f.session,action:'list',kind:'usage'})).statusCode,401);
});
