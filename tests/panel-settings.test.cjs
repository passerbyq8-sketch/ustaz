'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const P=require('../lib/panel-policy.cjs'),{runIapLua}=require('./iap-receipt-lua-fixture.cjs');
const root=path.resolve(__dirname,'..');
const locked={schema:1,revision:1,sections:{asmaa:{state:'hidden',reason:''},prayer:{state:'locked',reason:'Maintenance'}}};
function modules(mutate=s=>s){const app=fs.readFileSync(root+'/app.jsx','utf8'),source=app.slice(app.indexOf('function ezHomeModules(v) {'),app.indexOf('// ---- S101 ISTANA HOME START'));const context={ezWomenSectionHidden:()=>false,toArabicDigits:String,window:{EzikPanelPolicy:P},ezPanelAvailability:(doc,id)=>P.availability(doc,id)};for(const name of new Set(source.match(/\bEZH_\w+/g)))context[name]=name;return vm.runInNewContext(mutate(source)+';ezHomeModules',context);}
test('34.1 shipped home descriptor builder hides sections and routes locked tiles to their explanation',()=>{
 let blocked='';const rows=modules()({panel:locked,onPanelDenied:id=>{blocked=id;}});assert(!rows.some(m=>m.id==='asmaa'));const prayer=rows.find(m=>m.id==='prayer');assert.equal(prayer.panelState,'locked');prayer.onClick();assert.equal(blocked,'prayer');
});
test('34.1 removing home policy filtering is caught',()=>{
 const fn=modules(s=>s.replace(/\/\* PANEL-HOME START \*\/[\s\S]*?\/\* PANEL-HOME END \*\//,''));assert.throws(()=>assert(!fn({panel:locked}).some(m=>m.id==='asmaa')));
});
test('34.1 direct routes and restored App layers stop before their section renders',()=>{
 const app=fs.readFileSync(root+'/app.jsx','utf8'),start=app.indexOf("  const panelDestination = asmaaOpen ?"),end=app.indexOf('  if (asmaaOpen) return',start);
 assert(start>=0&&end>start);const source=app.slice(start,end);
 const build=s=>{const js=require('@babel/core').transformSync('function probe(){'+s+'return "open";}',{babelrc:false,configFile:false,sourceType:'script',presets:[[require.resolve('@babel/preset-react'),{runtime:'classic'}]]}).code;const ctx={React:{createElement:(type,props)=>({type,props})},EzPanelUnavailable:'unavailable',ezikGoBack(){},ezPanelAvailability:P.availability};vm.createContext(ctx);vm.runInContext(js,ctx);return ctx;};
 for(const [id,flag]of [['mushaf',''],['memorize',''],['adhkar',''],['arbaeen',''],['fatwa',''],['lessons',''],['asmaa','asmaaOpen'],['sunan-day','sunanOpen'],['yahimmak','yahimmakOpen'],['dima','dimaOpen']]){
  const ctx=build(source);Object.assign(ctx,{screen:flag?'home':id,asmaaOpen:false,sunanOpen:false,yahimmakOpen:false,dimaOpen:false,panel:{sections:{[id]:{state:'locked',reason:'Synthetic'}}}});if(flag)ctx[flag]=true;
  assert.equal(ctx.probe().type,'unavailable',id);ctx.panel={sections:{}};assert.equal(ctx.probe(),'open');
 }
 const mutant=build(source.replace(/if \(panelPolicy.state !== 'visible'\) return[^\n]+/,''));Object.assign(mutant,{screen:'mushaf',asmaaOpen:false,sunanOpen:false,yahimmakOpen:false,dimaOpen:false,panel:{sections:{mushaf:{state:'locked',reason:'Synthetic'}}}});assert.equal(mutant.probe(),'open');
});
test('34.1 policy rejects unknown schema, prototype keys and malformed locks',()=>{
 assert(P.validate(locked));for(const raw of [{...locked,schema:2},{...locked,revision:-1},{...locked,sections:{prayer:{state:'locked',reason:''}}},{...locked,sections:{unknown:{state:'hidden',reason:''}}},{...locked,private:'canary'},JSON.parse('{"schema":1,"revision":1,"sections":{"__proto__":{"state":"hidden","reason":""}}}')])assert.equal(P.validate(raw),null);
});
test('34.1 offline clients retain validated state and reject stale or malformed updates',async()=>{
 const values=new Map([[P.cacheKey,JSON.stringify(locked)]]),events=[];
 const window={EzikPanelPolicy:P,localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},fetch:async()=>{throw Error('offline');},CustomEvent:class{constructor(type){this.type=type;}},dispatchEvent:e=>events.push(e.type),addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(root+'/panel-client.js','utf8'),{window,Date,Promise,Error});await new Promise(r=>setImmediate(r));
 assert.equal(window.EzikPanel.read().sections.prayer.state,'locked');assert.equal(window.EzikPanel.accept({...locked,revision:0}),false);assert.equal(window.EzikPanel.accept({schema:99}),false);assert.equal(window.EzikPanel.read().revision,1);
 assert.equal(window.EzikPanel.accept({...locked,revision:2,sections:{}}),true);assert.equal(window.EzikPanel.read().revision,2);assert(events.includes(P.event));
});
test('34.1 standalone direct visits apply the cached lock and restore the page on unlock',()=>{
 const {parseHTML}=require('linkedom');
 for(const [pathname,id] of [['/library.html','library'],['/quest.html','treasure'],['/hanna-laha/','treasure']]){
  const {document}=parseHTML('<html><body><main style="display:flex"><button>content</button></main></body></html>');
  const cache={schema:1,revision:1,sections:{[id]:{state:'locked',reason:'Maintenance'}}};
  const window={document,location:{pathname},EzikPanelPolicy:P,localStorage:{getItem:()=>JSON.stringify(cache),setItem(){}},addEventListener(){},dispatchEvent(){},CustomEvent:class{}};
  vm.runInNewContext(fs.readFileSync(root+'/panel-client.js','utf8'),{window,Date,Promise,Map});
  assert.equal(document.querySelector('main').hidden,true);assert.equal(document.querySelector('main').style.display,'none');
  assert.equal(document.querySelector('[data-panel-unavailable] p').textContent,'Maintenance');
  window.EzikPanel.accept({schema:1,revision:2,sections:{}});
  assert.equal(document.querySelector('[data-panel-unavailable]'),null);assert.equal(document.querySelector('main').style.display,'flex');
 }
});
async function api(role='owner',fail=false){
 const data=new Map(),context=vm.createContext({Buffer,process:{env:{}}});
 const store={get:async k=>{if(fail)throw Error('offline');return data.get(k)??null;},eval:async(s,k,a)=>runIapLua(s,k,a,(cmd,key,value)=>{if(cmd==='GET')return data.get(key)??null;if(cmd==='SET'){data.set(key,value);return 'OK';}throw Error(cmd);})};
 const fake=o=>new vm.SyntheticModule(Object.keys(o),function(){for(const[k,v]of Object.entries(o))this.setExport(k,v);},{context});
 const lib=new vm.SourceTextModule(fs.readFileSync(root+'/lib/panel-settings.js','utf8'),{context});await lib.link(()=>fake({default:P}));
 const route=new vm.SourceTextModule(fs.readFileSync(root+'/api/panel-settings.js','utf8'),{context});await route.link(spec=>{
  if(spec.endsWith('/panel-settings.js'))return lib;
  if(spec==='@upstash/redis')return fake({Redis:class{constructor(){return store;}}});
  if(spec.endsWith('/ratelimit.js'))return fake({applyCorsOrigin(){},checkAuthLimit:async()=>({ok:true})});
  if(spec.endsWith('/attempts.js'))return fake({clientAddress:()=> 'synthetic'});
  if(spec.endsWith('/roles.js'))return fake({ROLE_OWNER:'owner',resolveActorState:async()=>({state:'live',actor:role?{role}:null})});
  throw Error(spec);
 });await route.evaluate();
 return async(method,body)=>{const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(v){this.body=JSON.parse(JSON.stringify(v));return this;},end(){return this;}};await route.namespace.default({method,body,headers:{}},res);return res;};
}
test('34.1 owner-only writes, revision conflict, public projection and store failure',async()=>{
 for(const role of [null,'reader','editor','viewer']){const call=await api(role);assert.equal((await call('POST',{action:'save',document:locked})).code,401);}
 const call=await api();assert.equal((await call('GET')).body.revision,0);
 const body={action:'save',document:{...locked,revision:0}};
 const results=await Promise.all([call('POST',body),call('POST',body)]);assert.deepEqual(results.map(r=>r.code).sort(),[200,409]);
 const publicRead=await call('GET');assert.deepEqual(publicRead.body,locked);assert(!JSON.stringify(publicRead.body).includes('session'));
 const failed=await api('owner',true);assert.equal((await failed('GET')).code,503);
});
