'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict'), crypto = require('crypto');
const root = path.resolve(__dirname, '..'), app = fs.readFileSync(path.join(root, 'app.jsx'), 'utf8');
const start = app.indexOf('function createEzikAuthProofClient(env) {'), end = app.indexOf('// OFF keeps both legacy bridge messages', start);
assert(start > 0 && end > start);
const source = app.slice(start, end);
const fixtures = new Set();
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(test) { for (let i = 0; i < 100; i++) { if (test()) return; await tick(); } assert.fail('fixture did not settle'); }
function storage() { const data = new Map(); return { data, get length() { return data.size; }, key: i => [...data.keys()][i] ?? null,
  getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,String(v)), removeItem: k => data.delete(k) }; }
function fixture(raw = source, options = {}) {
  const handlers = new Map(), calls = [], messages = [], writes = [], store = options.store || storage(), navigations = [];
  let closed = 0;
  let held = { session: 'original', provider: 'apple' }, policy = 1, seq = 0;
  const opaque = () => crypto.createHash('sha256').update(String(++seq)).digest('base64url');
  const popup = { sessionStorage: storage(), closed: false, close() { this.closed = true; }, location: { replace: url => navigations.push(url) } };
  const win = { location: { href: options.href || 'https://lifecycle.fixture.invalid/', assign: url => navigations.push(url) }, sessionStorage: store,
    opener: options.opener || null, close: () => closed++, open: () => popup,
    btoa: s => Buffer.from(s,'binary').toString('base64'),
    addEventListener(name,fn,opts) { if (!handlers.has(name)) handlers.set(name,new Map()); handlers.get(name).set(fn,opts); },
    removeEventListener(name,fn) { handlers.get(name)?.delete(fn); },
    dispatchEvent(event) { for (const [fn,opts] of [...(handlers.get(event.type)||[])]) { if (opts?.once) handlers.get(event.type).delete(fn); fn(event); } },
    history: { replaceState(a,b,url) { win.location.href = new URL(url,win.location.href).href; } } };
  const response = (url,body) => ({ url,status:200,redirected:false,headers:{get:()=> 'application/json'},json:async()=>body });
  const context = { window:win, crypto:crypto.webcrypto, URL,URLSearchParams,Uint8Array,TextEncoder,AbortController,Promise,Set,Map,Date,Error,
    setTimeout,clearTimeout,CustomEvent:class {constructor(type,init={}){this.type=type;Object.assign(this,init);}},
    readAuthSession:()=>held,getDeviceId:()=> 'device',capHeaders:()=>({'x-murabbi-device':'device'}),
    writeAuthSession:s=>{held=s;writes.push(s);},clearAuthSession:()=>{held=null;},EZIK_NATIVE_AUTH_SUBS:new Set(),
    ezikAuthProofLegacy:async()=>({ok:true}),ezikAuthBridge:()=>options.web ? null : ({postMessage(raw){const m=JSON.parse(raw);messages.push(m);
      if(m.op==='capabilities')queueMicrotask(()=>win.dispatchEvent({type:'ezik:auth:proof:result',detail:{type:'ezik:auth:proof:result',v:'1',id:m.id,op:m.op,proofVersion:1,ok:true,redirect:true,nativeApple:true}}));}}),
    fetch:async(url,init)=>{calls.push({url,init});if(url.endsWith('/api/auth-capabilities'))return response(url,{ok:true,proofVersion:policy});
      if(url.endsWith('/api/auth-challenge'))return response(url,{ok:true,proofVersion:1,challenge:opaque(),proof:opaque(),nonce:opaque(),expiresAt:Date.now()+600000});
      if(url.endsWith('/api/auth-native') || url.endsWith('/api/auth-exchange'))return response(url,{ok:true,session:'fresh-session',provider:'apple'});
      throw Error('unexpected endpoint');} };
  vm.createContext(context); vm.runInContext(raw,context);
  const result = { win,store,calls,messages,writes,popup,navigations,closed:()=>closed,get:()=>context.ezikAuthProofClient(),held:()=>held,setPolicy:p=>policy=p,
    emit:(type,extra={})=>win.dispatchEvent({type,...extra}),
    reply:m=>win.dispatchEvent({type:'ezik:auth:proof:result',detail:{type:'ezik:auth:proof:result',v:'1',id:m.id,op:m.op,proofVersion:1,ok:true,provider:'apple',challenge:m.challenge,identityToken:'fixture',rawNonce:m.nonce}}) };
  fixtures.add(result); return result;
}
async function popupRouting(raw) {
  for (const openerKind of ['unrelated', 'same-origin']) {
    const relayed = [], opener = { postMessage: (...args) => relayed.push(args), origin: openerKind === 'unrelated' ? 'https://foreign.invalid' : 'https://lifecycle.fixture.invalid' };
    const x=fixture(raw,{web:true}); assert.equal((await x.get().signin('apple',{mode:'tab'})).navigating,true);
    const row=JSON.parse([...x.store.data.values()][0]);
    // Even a leftover reservation cannot outrank this document's valid tab row.
    x.store.setItem('ezik_auth_proof_popup_v1',row.cs);
    const y=fixture(raw,{web:true,store:x.store,opener,href:'https://lifecycle.fixture.invalid/?ticket=t&state='+row.cs});
    assert.equal((await y.get().resume()).result?.ok,true,openerKind+' opener must not steal a same-tab completion');
    assert.equal(y.writes.length,1); assert.equal(relayed.length,0); assert.equal(y.closed(),0);
    y.get().dispose(); x.get().dispose();
    const legacy=fixture(raw,{web:true,opener,href:'https://lifecycle.fixture.invalid/?ticket=legacy&state=legacy-state'});
    const out=await legacy.get().resume(); assert.equal(out.handled,false); assert(out.url.includes('ticket=legacy'));
    assert.equal(legacy.closed(),0); assert.equal(relayed.length,0); assert.equal(legacy.win.location.href,'https://lifecycle.fixture.invalid/');
    legacy.get().dispose();
  }
  const parent=fixture(raw,{web:true}), pending=parent.get().signin('apple');
  await until(()=>parent.navigations.length);
  const cs=new URL(parent.navigations[0]).searchParams.get('cs');
  assert.equal(parent.popup.sessionStorage.getItem('ezik_auth_proof_popup_v1'),cs,'actual popup must be reserved');
  const opener={postMessage:(data,origin)=>parent.emit('message',{data,origin,source:parent.popup})};
  const receiver=fixture(raw,{web:true,store:parent.popup.sessionStorage,opener,href:'https://lifecycle.fixture.invalid/?ticket=popup&state='+cs});
  assert.equal((await receiver.get().resume()).handled,true); assert.equal(receiver.closed(),1);
  assert.equal((await pending).ok,true); assert.equal(parent.writes.length,1); assert.equal(receiver.calls.length,0);
  assert.equal(receiver.store.getItem('ezik_auth_proof_popup_v1'),null);
  parent.get().dispose(); receiver.get().dispose();
}
async function restoredDocument(raw) {
  const x=fixture(raw), first=x.get(), pending=first.signin('apple');
  await until(()=>x.messages.some(m=>m.op==='apple-assertion'));
  const old=x.messages.at(-1); x.emit('pagehide',{persisted:true}); x.emit('pageshow',{persisted:true});
  const fresh=x.get(); assert.notEqual(fresh,first,'restored document must own a fresh controller');
  x.reply(old); await pending; await tick();
  assert.equal(x.writes.length,0,'stale native result must not write a session');
  assert.equal(x.calls.filter(c=>c.url.endsWith('/api/auth-native')).length,0);
  const next=fresh.signin('apple'); await until(()=>x.messages.filter(m=>m.op==='apple-assertion').length===2);
  x.reply(x.messages.at(-1)); assert.equal((await next).ok,true); assert.equal(x.writes.length,1);
  fresh.dispose();
}
async function restoreStorage(raw) {
  const x=fixture(raw), first=x.get();
  await first.discover();
  x.store.setItem('ezik_auth_proof_v1:stale','malformed');
  x.emit('pagehide',{persisted:true}); x.emit('pageshow',{persisted:true});
  await until(()=>x.store.length===0); assert.equal(x.held().session,'original');
  x.get().dispose();
  const y=fixture(raw); await y.get().discover();
  y.emit('pagehide',{persisted:true}); y.emit('pageshow',{persisted:true}); await tick();
  y.setPolicy(0); assert.equal((await y.get().signin('apple')).code,'auth-policy-changed','restoration cannot erase the ON observation');
  y.get().dispose();
}
async function main() {
  const checked = async (test, raw) => { try { await test(raw); } finally { for (const x of fixtures) x.get().dispose(); fixtures.clear(); } };
  await checked(restoredDocument,source); console.log('PASS restored document creates fresh controller, discards old delivery and signs in again');
  await checked(restoreStorage,source); console.log('PASS remaining tab state is removed safely and ON observation survives');
  await checked(popupRouting,source); console.log('PASS unrelated and same-origin openers, same-tab precedence, legacy callbacks and real popup receiver');
  for(const [name,from,to,test] of [
    ['retain disposed singleton','EZIK_AUTH_PROOF_CLIENT = null; // The restored document gets a new owner.','void 0;',restoredDocument],
    ['skip restored tab recovery','restored.resume().finally','Promise.resolve().finally',restoreStorage],
    ['forget observed policy','observedOn: EZIK_AUTH_PROOF_OBSERVED_ON','observedOn: false',restoreStorage],
    ['treat any opener as popup','!keys.length && url && win.opener && secret(popupState)', 'url && win.opener',popupRouting],
    ['omit popup reservation',"flow.popup.sessionStorage.setItem('ezik_auth_proof_popup_v1', flow.cs);",'void 0;',popupRouting],
  ]) { assert(source.includes(from),name+' applies'); await assert.rejects(()=>checked(test,source.replace(from,to)),name+' killed'); console.log('MUTANT KILLED '+name); }
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={source,fixture,restoredDocument,restoreStorage};
