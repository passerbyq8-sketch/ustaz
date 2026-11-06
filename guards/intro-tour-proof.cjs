'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const approved=JSON.parse(read('guards/intro-tour-approved.json'));
const keys={'tour.info':approved.info_button_label,'tour.counter':approved.counter};
for(const [k,v] of Object.entries(approved.buttons))keys['tour.'+k]=v;
for(const s of [{id:'welcome',...approved.welcome},...approved.steps,{id:'finish',...approved.finish}]){keys['tour.'+s.id+'.title']=s.title;keys['tour.'+s.id+'.text']=s.text;}
const normalize=s=>String(s).replace(/[\u064b-\u065f\u0670]/g,'').replace(/[^\u0621-\u064a]/g,'');
function verify(source,missing){
 const a=source.indexOf('const EZ_I18N = {'),b=source.indexOf('\n};',a)+3;
 const dictionaries=vm.runInNewContext(source.slice(a,b)+'\nEZ_I18N');
 for(const f of fs.readdirSync(path.join(root,'lang')).filter(f=>f.endsWith('.json')))dictionaries[f.slice(0,-5)]=JSON.parse(read('lang/'+f));
 if(missing)delete dictionaries.fr['tour.start'];
 const table=vm.runInNewContext(source.slice(source.indexOf('const EZ_LANGUAGE_TABLE = ['),source.indexOf('// E1 (item 74'))+'\nEZ_LANGUAGE_TABLE');
 for(const row of table){
  const d=dictionaries[row.code];for(const key of Object.keys(keys))assert.ok(typeof d[key]==='string'&&d[key].trim(),row.code+' '+key);
  if(row.code==='ar')for(const [key,value] of Object.entries(keys))assert.equal(d[key],value,key+' approved Arabic bytes');
  else {
   const p='lang/content/'+row.code+'/sections/dima.json';let hadith=approved.hadith_text;
   if(fs.existsSync(path.join(root,p))){const item=JSON.parse(read(p)).items.find(i=>normalize(i.ar)===normalize(approved.hadith_text)&&i.tr);if(item)hadith=item.tr;}
   assert.ok(d['tour.dima.text'].includes('\u00ab'+hadith+'\u00bb'),row.code+' hadith reused verbatim');
  }
 }
 const block=source.slice(source.indexOf('// INTRO TOUR V1 START'),source.indexOf('function useEzikIntroTour('));
 const store=new Map(),ctx=vm.createContext({window:{localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},location:{pathname:'/',search:'',hash:''},sessionStorage:{getItem:()=>null},history:{}},ezPanelAvailability:(p,k)=>p.sections?.[k]||{state:'visible'}});
 vm.runInContext(block+'\nthis.steps=EZ_TOUR_STEPS;',ctx);
 assert.deepEqual(Array.from(ctx.steps,s=>s.id),['chat','worship','mushaf','hifz','kunuz','dima','library','profile']);
 assert.equal(2+ctx.steps.length,approved.stations);
 for(const step of ctx.steps){
  const sections=Object.fromEntries(Array.from(step.sections,id=>[id,{state:'hidden'}]));
  assert.ok(!ctx.ezTourStations({sections}).some(s=>s.id===step.id),'hidden '+step.id+' removed');
  sections[step.sections[0]]={state:'locked'};
  const retained=ctx.ezTourStations({sections}).find(s=>s.id===step.id);assert.ok(retained,'locked '+step.id+' retained');assert.equal(retained.sections.length,1);
 }
 assert.equal(ctx.ezTourSeen(),false);assert.equal(ctx.ezTourCanAuto('chat',false,false,false),true);
 for(const screen of ['loading','onboarding','home','mushaf','settings'])assert.equal(ctx.ezTourCanAuto(screen,false,false,false),false);
 for(const flags of [[true,false,false],[false,true,false],[false,false,true]])assert.equal(ctx.ezTourCanAuto('chat',...flags),false);
 for(const search of ['?section=mushaf','?ezik_iap_signin=1','?shortcut=chat']){ctx.window.location.search=search;assert.equal(ctx.ezTourBootHeld(),true);}
 ctx.window.location.search='';ctx.window.sessionStorage.getItem=()=> 'saved';assert.equal(ctx.ezTourBootHeld(),true);
 ctx.window.sessionStorage.getItem=()=>null;ctx.window.location.pathname='/library.html';assert.equal(ctx.ezTourBootHeld(),true);
 ctx.ezTourMarkSeen();assert.equal(store.get('ezik.tour.v1.seen'),'1');assert.equal(ctx.ezTourCanAuto('chat',false,ctx.ezTourSeen(),false),false);
 ctx.window.localStorage={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};ctx.ezTourMarkSeen();assert.equal(ctx.ezTourSeen(),true);
 const hook=source.slice(source.indexOf('function useEzikIntroTour('),source.indexOf('// INTRO TOUR V1 END'));
 assert.ok(hook.includes('origin.current = screen')&&hook.includes('setScreen(origin.current)'),'return to origin');
 assert.ok(hook.includes('const steps = ezTourStations(policy)'),'policy recounted on transition');
 assert.ok(hook.includes("id === 'welcome' ? 'start'"));
 assert.ok(hook.includes("tour.id === 'finish' ? onClose"));assert.ok(hook.includes('onClick={onClose}'),'skip and finish share seen writer');
 assert.ok(hook.includes('auth?.busy || auth?.pending')&&hook.includes('ezikBackLayers.length > 0'),'auth and dialog suppression');
 assert.ok(!/\.click\(|window\.location\s*=|\.href\s*=/.test(hook),'never activates section');
 const rail=source.slice(source.indexOf('<div className="ezc-rail">'),source.indexOf('<div ref={messagesAreaRef}'));
 assert.deepEqual([...rail.matchAll(/data-ezik-topbar="([^"]+)"/g)].map(m=>m[1]),['menu','home','tour']);
 assert.ok(rail.includes('onClick={introTour.open}')&&rail.includes("aria-label={ezT('tour.info')}"),'manual reopening and label');
 assert.ok(hook.includes('ezNum(tour.steps.indexOf(step) + 1)')&&hook.includes('ezNum(tour.steps.length)'),'native counters');
 assert.ok(source.includes('data-ezik-tour-entry={t.k}'),'customized bottom-nav targets stay discoverable');
 // Execute the shipped hook, with deterministic React hook storage and timers.
 const hookSource=source.slice(source.indexOf('function useEzikIntroTour('),source.indexOf('function EzikIntroTour('));
 const compiled=require('@babel/core').transformSync(hookSource,{presets:[[require('@babel/preset-react'),{runtime:'classic'}]],configFile:false,babelrc:false}).code;
 function fixture({held=false,blocked=false,auth=false,seen=false}={}){
  let cursor=0,slots=[],effects=[],timers=new Map(),serial=0,screen='loading',policy={sections:{}},node;
  ctx.window.location={pathname:'/',search:held?'?shortcut=chat':'',hash:''};ctx.window.sessionStorage.getItem=()=>null;ctx.window.history={};
  store.clear();if(seen)store.set('ezik.tour.v1.seen','1');ctx.window.localStorage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
  vm.runInContext('ezTourSeenMemory=false;',ctx);
  ctx.document={activeElement:{focus(){}},querySelector:()=>blocked?{}:null};ctx.EZIK_AUTH_PROOF_CLIENT={state:()=>({busy:auth})};ctx.ezikBackLayers=[];
  ctx.React={createElement:(type,props)=>({type,props})};ctx.EzikIntroTour=function(){};
  ctx.useState=initial=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];};
  ctx.useRef=initial=>{const i=cursor++;return slots[i]||(slots[i]={current:initial});};
  ctx.useEffect=(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){old?.clean?.();slots[i]={deps};effects.push(()=>{slots[i].clean=fn();});}};
  ctx.setTimeout=fn=>{timers.set(++serial,fn);return serial;};ctx.clearTimeout=id=>timers.delete(id);
  vm.runInContext(compiled,ctx);
  const render=()=>{cursor=0;node=ctx.useEzikIntroTour(screen,s=>{screen=s;},policy);const q=effects.splice(0);q.forEach(f=>f());return node;};
  const tick=()=>{const q=[...timers.values()];timers.clear();q.forEach(f=>f());return render();};
  render();return {render,tick,screen:s=>{screen=s;return render();},policy:p=>{policy=p;return render();},get screenNow(){return screen;}};
 }
 let f=fixture();f.screen('chat');let n=f.tick();assert.equal(n.node.props.tour.id,'welcome');
 const visited=['welcome'];for(let i=0;i<9;i++){n.node.props.onMove(1);n=f.render();visited.push(n.node.props.tour.id);}
 assert.deepEqual(visited,['welcome','chat','worship','mushaf','hifz','kunuz','dima','library','profile','finish']);
 n.node.props.onClose();assert.equal(f.render().node,null);assert.equal(store.get('ezik.tour.v1.seen'),'1');assert.equal(f.tick().node,null);
 n=f.render();n.open();n=f.render();assert.equal(n.node.props.tour.id,'welcome');n.node.props.onMove(1);n=f.render();n.node.props.onMove(-1);assert.equal(f.render().node.props.tour.id,'welcome');
 f.render().node.props.onClose();assert.equal(store.get('ezik.tour.v1.seen'),'1');
 for(const options of [{held:true},{blocked:true},{auth:true},{seen:true}]){f=fixture(options);f.screen('chat');assert.equal(f.tick().node,null,'suppressed '+JSON.stringify(options));}
 f=fixture({held:true});f.screen('chat');f.tick();f.screen('home');f.screen('chat');assert.equal(f.tick().node.props.tour.id,'welcome','deferred until next start screen');
 f=fixture();f.screen('home');n=f.render();n.open();n=f.render();n.node.props.onMove(1);n=f.render();assert.equal(f.screenNow,'chat');n.node.props.onClose();assert.equal(f.screenNow,'home','manual tour restores origin');
 f=fixture();f.screen('chat');n=f.tick();n=f.policy({sections:{mushaf:{state:'hidden'}}});n.node.props.onMove(1);n=f.render();assert.equal(n.node.props.tour.steps.length,7,'live policy recount');
 return {languages:table.length,keys:Object.keys(keys).length};
}
const source=read('app.jsx');const result=verify(source);
for(const [name,mutant,missing] of [
 ['station removed',source.replace("{ id: 'mushaf', screen: 'home', sections: ['mushaf'] },",''),false],
 ['key missing',source,true],
 ['Arabic changed',source.replace(JSON.stringify(approved.info_button_label),JSON.stringify(approved.info_button_label+'!')),false],
 ['hidden retained',source.replace("ezPanelAvailability(policy, id).state !== 'hidden'",'true'),false]
]){assert.throws(()=>verify(mutant,missing),undefined,name+' must be killed');}
console.log('PASS intro tour: '+JSON.stringify(result)+'; four required mutants killed');
