'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),parser=require('@babel/parser');
const source=fs.readFileSync(path.join(__dirname,'../app.jsx'),'utf8'),ast=parser.parse(source,{sourceType:'script',plugins:['jsx']});
const fn=name=>{const n=ast.program.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n,name);return source.slice(n.start,n.end);};
const core=fn('createEzikNativeLocationAdapter'),flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();},clean=x=>JSON.parse(JSON.stringify(x));
function fixture(code=core){let now=Date.parse('2026-11-05T02:00:00Z'),seq=0;const timers=new Map(),sent=[],events=new Map(),devents=new Map(),results=[],store=new Map();
 const emit=(name,detail)=>{for(const f of [...events.get(name)||[]])f({detail});};
 const add=(m,k,f)=>{if(!m.has(k))m.set(k,new Set());m.get(k).add(f);},remove=(m,k,f)=>m.get(k)?.delete(f);
 const doc={visibilityState:'visible',addEventListener:(k,f)=>add(devents,k,f),removeEventListener:(k,f)=>remove(devents,k,f)};
 const win={document:doc,CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts.detail;}},addEventListener:(k,f)=>add(events,k,f),removeEventListener:(k,f)=>remove(events,k,f),dispatchEvent:e=>emit(e.type,e.detail),ReactNativeWebView:{postMessage:t=>sent.push(JSON.parse(t))}};
 class Clock extends Date{static now(){return now;}}
 const scope={window:win,document:doc,Date:Clock,Math,Map,Promise,Number,Intl,CustomEvent:win.CustomEvent,
 setTimeout:(f,ms)=>{const id=++seq;timers.set(id,{f,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),
 ezikShellBridge:()=>win.ReactNativeWebView,ezikLocationChoiceVersion:0,SHELL_LOC_TIMEOUT_MS:10000,SHELL_LOC_RESULT:'ezik:location:result',SHELL_LOC_REQUEST:'ezik:location:request',
 PRAYER_ZONE_FMT:{},PRAYER_DEFAULT_ZONE:{tz:'Asia/Kuwait'},QIBLA_LOC_KEY:'position',PRAYER_PLACE_KEY:'place',QIBLA_DEFAULT_LAT:29.37,QIBLA_DEFAULT_LNG:47.98,
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},ezikWidgetDataChanged:()=>{},results};
 const helpers=['prayerNativeMetadata','prayerNativeFix','prayerLocate','shellLocResultCoords','prayerZoneFmt','prayerZoneWall','prayerZoneOffset','prayerZoneOf','readQiblaLoc','readPrayerPlaceFor','writeQiblaLoc','writePrayerPlace','clearQiblaLoc','ezikLocationChoiceChanged'].map(fn).join('\n');
 const context=vm.createContext(scope);vm.runInContext(code+'\n'+helpers,context);const adapter=vm.runInContext('createEzikNativeLocationAdapter(window)',context);scope.ezikNativeLocation=adapter;
 const answer=(req,d)=>emit('ezik:location:result',{type:'ezik:location:result',v:'2',id:req.id,op:req.op,ok:true,error:null,...d});
 const cap=async()=>{answer(sent[0],{capabilities:{coarse:true,precise:false,fresh:true,metadata:true,settings:true,headingReference:true}});await adapter.ready;};
 const advance=async ms=>{now+=ms;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.f();}await flush();};
 const fix=(fields={})=>({type:'ezik:location:result',lat:29.37,lon:47.98,precision:'coarse',coordinateResolutionDegrees:0.01,source:'fresh',timestamp:now,ageMs:0,accuracyMeters:1500,permission:{state:'granted',canAskAgain:true,accuracy:'reduced'},city:'Kuwait',district:'Jahra',region:null,countryCode:'KW',timezone:null,timezoneSource:null,localitySource:'native-geocoder',...fields});
 return {adapter,context,scope,sent,results,store,timers,events,win,doc,emit,answer,cap,advance,fix,read:s=>vm.runInContext(s,context),hidden:()=>{doc.visibilityState='hidden';for(const f of devents.get('visibilitychange')||[])f();}};
}
async function verify(code){let checks=0;
 const sorani=JSON.parse(fs.readFileSync(path.join(__dirname,'../lang/ku.json'),'utf8'))['place.deviceZone'].replace('{tz}','');assert(/[\u0600-\u06ff]/.test(sorani));assert(!/[A-Za-z]/.test(sorani));
 {const f=fixture(code);assert.deepEqual(f.sent.map(x=>x.type),['ezik:location']);const stop=f.read("prayerLocate({},r=>results.push(r))");await f.advance(1001);assert.equal(f.sent[1].type,'ezik:location:request','old-shell boot behavior remains');f.emit('ezik:location:result',{type:'ezik:location:result',ok:true,lat:29.2,lon:48.1});assert.equal(f.results[0].source,'shell');stop();f.adapter.dispose();checks++;}
 {const f=fixture(code);await f.cap();f.read("prayerLocate({},r=>results.push(r))");await flush();assert.equal(f.sent[1].op,'status');assert(!f.sent.some(r=>r.op==='get'));f.answer(f.sent[1],{permission:{state:'undetermined',canAskAgain:true}});assert.equal(f.results[0].ok,false);f.adapter.dispose();checks++;}
 {const f=fixture(code);await f.cap();const stop=f.read("prayerLocate({userInitiated:true,fresh:true},r=>results.push(r))");await flush();const req=f.sent[1];assert.equal(req.precision,'coarse');assert.equal(req.fresh,true);assert.equal(req.metadata,true);assert.equal(req.userInitiated,true);
  f.answer({...req,id:'unknown'},f.fix());assert.equal(f.results.length,0,'unknown id ignored');f.answer({...req,op:'status'},f.fix());assert.equal(f.results.length,0);f.answer(req,f.fix());assert.equal(f.results.length,1);assert.equal(f.results[0].meta.district,'Jahra');assert.equal(f.results[0].meta.timezone,null);assert.equal(f.results[0].permission.accuracy,'reduced');stop();f.adapter.dispose();checks++;}
 for(const action of ['manual','stop','background','newer']){const f=fixture(code);await f.cap();const stop=f.read("prayerLocate({userInitiated:true},r=>results.push(r))");await flush();const req=f.sent[1];
  if(action==='manual')f.read("writePrayerPlace({n:'Berlin',a:'',cc:'DE',tz:'Europe/Berlin',lat:52.52,lng:13.41})");
  if(action==='stop')stop();if(action==='background')f.hidden();if(action==='newer'){f.read("prayerLocate({userInitiated:true,fresh:true},r=>results.push(r))");await flush();}
  f.answer(req,f.fix());assert(!f.results.some(r=>r.ok));if(action==='manual'){assert.equal(f.results[0].error,'cancelled');assert.equal(f.read('readQiblaLoc().by'),'place');}
  f.adapter.dispose();checks++;}
 {const f=fixture(code);await f.cap();const denied={state:'denied',canAskAgain:false,accuracy:'reduced'};f.adapter.request('status',{},r=>f.results.push(r));f.answer(f.sent[1],{permission:denied});const before=f.sent.length;f.adapter.request('open-settings',{userInitiated:false},r=>f.results.push(r));assert.equal(f.sent.length,before);f.adapter.request('open-settings',{userInitiated:true},r=>f.results.push(r));const request=f.sent.at(-1);f.answer(request,{status:'settings-opened',permission:denied});f.answer({...request,op:'status'},{reason:'settings-return',permission:{state:'granted',canAskAgain:true}});assert.equal(f.adapter.getPermission().state,'granted');assert(!f.sent.some(x=>x.op==='get'));f.adapter.dispose();checks++;}
 for(const changed of [{lat:91},{lon:181},{timestamp:0},{timestamp:Date.parse('2026-11-05T03:00:00Z')},{ageMs:120001},{precision:'precise'},{accuracyMeters:-1}]){const f=fixture(code);f.scope.sample={ok:true,...f.fix(changed)};assert.equal(f.read('prayerNativeFix(sample).ok'),false);f.adapter.dispose();checks++;}
 {const f=fixture(code);f.scope.sample={ok:true,...f.fix({lat:52.52,lon:13.41,timezone:'Europe/Berlin',timezoneSource:'native-geocoder'})};const fix=f.read('prayerNativeFix(sample)');f.scope.fixtureFix=fix;f.read('writeQiblaLoc(fixtureFix.lat,fixtureFix.lng,fixtureFix.meta)');assert.deepEqual(clean(f.read('readQiblaLoc().meta')),clean(fix.meta));assert.equal(f.read('prayerZoneOf(readQiblaLoc()).tz'),'Europe/Berlin');assert.equal(f.read("prayerZoneOffset('Europe/Berlin',2026,7,1)"),120);assert.equal(f.read("prayerZoneOffset('Europe/Berlin',2026,11,1)"),60);f.scope.sample.timezoneSource='device';assert.equal(f.read('prayerNativeFix(sample).meta.timezone'),null);f.scope.sample.timezone='Wrong/Zone';f.scope.sample.timezoneSource='native-geocoder';assert.equal(f.read('prayerNativeFix(sample).meta.timezone'),null);f.adapter.dispose();checks++;}
 return checks;
}
const mutant=core.replace('const p = pending.get(d.id);','const p = pending.values().next().value;');assert.notEqual(mutant,core);
(async()=>{if(process.argv.includes('--mutant')){await verify(mutant);return;}const n=await verify(core);await assert.rejects(()=>verify(mutant),assert.AssertionError);
 assert(source.includes('prayerLocateAndApply({ fresh: true, force: true, userInitiated: true }'));assert(source.includes('prayerLocateAndApply({ force: true, userInitiated: true, slowMs:'));assert.equal((source.match(/<EzikLocationSettings \/>/g)||[]).length,2);assert.equal((source.match(/<EzikLocationZoneNote loc=\{loc\} \/>/g)||[]).length,2);assert(source.includes("data-ezik-zone-source=\"device\""));
 console.log('PASS S4 location: '+n+' real-adapter/producer/store cases; safe probe/status, old shell, explicit coarse/fresh, ID/op, cancellation/manual/newer/background, settings-return, metadata and DST.');
})().catch(e=>{console.error(e);process.exitCode=1;});
