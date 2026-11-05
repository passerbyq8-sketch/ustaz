'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'app.jsx'),'utf8');
const core=source.slice(source.indexOf("const DIMA_KEY ="),source.indexOf('function dimaPrayerAt('));
const calendar=source.slice(source.indexOf('const HIJRI_CALENDAR ='),source.indexOf('function writeHijriOffset('));
const data=JSON.parse(fs.readFileSync(path.join(root,'dima/dima-v1.json'),'utf8')),manifest=JSON.parse(fs.readFileSync(path.join(root,'dima/pack-manifest-v1.json'),'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(code=core){const disk=new Map();let failWrite=false,failRead=false;const scope={Date,Intl,Math,Number,JSON,Map,Set,Promise,
 localStorage:{getItem:k=>{if(failRead)throw Error('denied');return disk.get(k)||null;},setItem:(k,v)=>{if(failWrite)throw Error('quota');disk.set(k,v);}},
 readQiblaLoc:()=>({}),prayerZoneOf:()=>({tz:'America/New_York'}),prayerTodayParts:(now,p)=>{const a=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:p.tz,year:'numeric',month:'numeric',day:'numeric'}).formatToParts(now).map(x=>[x.type,Number(x.value)]));return{y:a.year,m:a.month,d:a.day};},
 window:{dispatchEvent:()=>{}},CustomEvent:class{},data:clone(data)};
 const context=vm.createContext(scope);vm.runInContext(code+'\n'+calendar,context);const read=s=>vm.runInContext(s,context);read('__dimaData = data;');
 return {scope,disk,read,context,failWrite:v=>failWrite=v,failRead:v=>failRead=v};}
async function verify(code){let n=0;const f=fixture(code);const get=async p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
 const real90=await f.read('dimaBuildCatalog')(data,manifest,get);assert.equal(real90.regular.length,90);n++;
 f.scope.real90=real90;f.scope.date=new Date(2026,0,5,12);f.read('hijriForCivilDay = () => ({y:1448,m:2,d:20,by:"fixture",offset:0});');
 for(const index of [61,90,91]){f.scope.state={startDate:f.read('dimaDateKey(dimaDateAdd(date, 1 - '+index+'))'),log:{},presented:{}};const r=f.read('dimaResolveForDate(state,date,real90)');assert.equal(r.index,index);assert.equal(r.dayId,'dima.regular.'+String((index-1)%90+1).padStart(3,'0'));assert.equal(r.repeat,index>90);n++;}
 // Retain the 60-day fixture to exercise partial availability and later arrival.
 const manifest60=clone(manifest);manifest60.regular=manifest60.regular.slice(0,2);
 const cat=await f.read('dimaBuildCatalog')(data,manifest60,get);assert.equal(cat.regular.length,60);assert.equal(Object.keys(cat.seasonal).length,3);n++;
 f.scope.cat=cat;f.scope.state={startDate:'2026-01-01',log:{},notify:{on:false,slot:'duha'},notifySeen:true,presented:{}};
 // Stable ordinary fixtures isolate calendar selection, not the resolver implementation.
 f.read('hijriForCivilDay = () => ({y:1448,m:2,d:20,by:"fixture",offset:0});');
 for(const index of [29,30,31,60,61]){const date=new Date(2026,0,index,12);if(date.getDay()===5)date.setDate(date.getDate()+1);
   f.scope.date=date;f.scope.state.startDate=f.read('dimaDateKey(dimaDateAdd(date, 1 - '+index+'))');
   const r=f.read('dimaResolveForDate(state,date,cat)');assert.equal(r.index,index);assert.equal(r.dayId,'dima.regular.'+String((index-1)%60+1).padStart(3,'0'));assert.equal(r.repeat,index>60);assert.equal(r.snapshot.lisan.id,cat.regular[(index-1)%60].lisanRef);n++;}
 const offline=await f.read('dimaBuildCatalog')(data,manifest,async()=>{throw Error('offline');});assert.equal(offline.regular.length,30);assert.equal(Object.keys(offline.seasonal).length,0);n++;
 f.scope.offline=offline;f.scope.date=new Date(2026,0,5,12);f.scope.state.startDate='2025-12-06';
 const thirty=f.read('dimaResolveForDate(state,date,offline)');assert.equal(thirty.index,31);assert.equal(thirty.dayId,'dima.regular.001');assert(thirty.repeat);assert(thirty.snapshot.notification.text);n++;
 // A future contiguous pack is consumed without a hard-coded filename.
 const third=await get('/dima/pack-regular-002.json');third.id='dima-regular-003';third.startDay=61;third.days=third.days.map(d=>JSON.parse(JSON.stringify(d).replace(/dima\.regular\.(\d{3})/g,(_,i)=>'dima.regular.'+String(+i+30).padStart(3,'0'))));third.days.forEach(d=>d.position+=30);
 const future=clone(manifest60);future.regular.push({id:third.id,version:1,path:'/dima/pack-regular-003.json',firstDay:61,lastDay:90});
 const cat90=await f.read('dimaBuildCatalog')(data,future,p=>p.endsWith('003.json')?third:get(p));assert.equal(cat90.regular.length,90);n++;
 const bad=clone(third);bad.days[0].qalb.note='';const truncated=await f.read('dimaBuildCatalog')(data,future,p=>p.endsWith('003.json')?bad:get(p));assert.equal(truncated.regular.length,60);n++;
 f.scope.state.startDate='2025-11-06';const original=f.read('dimaResolveForDate(state,date,cat)');assert(original.repeat);f.scope.original=original;
 const frozen=f.read('dimaFreezePresented(state,original)');f.scope.state=frozen;f.scope.cat90=cat90;assert.deepEqual(clone(f.read('dimaResolveForDate(state,date,cat90)')),clone(original));n++;
 // Completion/undo and a changed calendar cannot reselect a presented day.
 f.scope.state.log[original.civilDate]={l:1,q:1,j:1,taps:7,laterAt:12345,opaque:{v:7}};f.read('hijriForCivilDay = () => ({y:1448,m:9,d:1,by:"fixture",offset:2});');
 assert.equal(f.read('dimaResolveForDate(state,date,cat90).dayId'),original.dayId);f.scope.state.log[original.civilDate].l=0;assert.equal(f.read('dimaResolveForDate(state,date,cat90).dayId'),original.dayId);assert.equal(f.read('dimaLogFor(state,original.civilDate).opaque.v'),7);n++;
 for(const [month,day,season]of[[9,29,'ramadan'],[9,30,'ramadan'],[10,1,null],[12,9,'dhul-hijjah'],[12,10,'dhul-hijjah'],[12,11,null],[12,13,'white-days'],[9,13,'ramadan'],[2,14,'white-days']]){
  f.scope.h={y:1448,m:month,d:day,by:'fixture',offset:0};f.read('hijriForCivilDay = () => h;');f.scope.date=new Date(2026,10,6,12);f.scope.state={...clone(frozen),presented:{}};
  const r=f.read('dimaResolveForDate(state,date,cat)');assert.equal(r.season,season);if(!season)assert.equal(r.packId,'dima-friday-001');if(season)assert.equal(r.snapshot.lisan.id,cat.seasonal[season].days[day-cat.seasonal[season].firstDay].lisanRef);n++;}
 f.scope.h={y:1448,m:9,d:14,by:'fixture',offset:0};f.scope.missing={...cat,seasonal:{'white-days':cat.seasonal['white-days']}};assert.equal(f.read('dimaResolveForDate(state,date,missing).season'),'white-days');n++;
 f.scope.r=f.read('dimaResolveForDate(state,date,cat)');f.scope.state.presented['2025-01-01']={...clone(f.scope.r),civilDate:'2025-01-01'};assert.equal(f.read('dimaResolveForDate(state,date,cat).repeat'),true);n++;
 // Migration cannot alter the old start date, opaque log fields or explicit reminder opt-out.
 for(const fail of [false,true]){const m=fixture(code),old={startDate:'2024-01-01',log:{'2026-11-04':{l:1,q:0,j:1,taps:7,laterAt:123456,unknown:{a:[1,2]}},'2026-11-06':{l:1}},notify:{on:false,slot:'isha'},notifySeen:true};m.disk.set('ezik_dima_v1',JSON.stringify(old));m.failWrite(fail);
  const migrated=m.read('dimaReadStore()');assert.equal(migrated.schema,2);assert.equal(migrated.startDate,old.startDate);assert.deepEqual(clone(migrated.log),old.log);assert.deepEqual(clone(migrated.notify),old.notify);assert(migrated.notifySeen);assert.equal(migrated.presented['2026-11-04'].dayId,'dima.regular.030');assert.equal(migrated.presented['2026-11-06'].dayId,'dima.friday.01');assert.equal(migrated.presented['2026-11-04'].snapshot.lisan.id,'l06');assert.equal(m.disk.get('ezik_dima_v1'),JSON.stringify(old));
  m.scope.next={...clone(migrated),notify:{on:false,slot:'duha'}};m.read('dimaWriteStore(next)');assert.equal(m.read('dimaReadStore().notify.slot'),'duha');if(fail)assert.equal(m.read('__dimaStoreError'),'storage');else assert.equal(JSON.parse(m.disk.get('ezik_dima_v1')).notify.slot,'duha');n++;}
 const corrupt=fixture(code);corrupt.disk.set('ezik_dima_v2','{broken');corrupt.disk.set('ezik_dima_v1',JSON.stringify({startDate:'2026-10-01',log:{},notify:{on:false,slot:'asr'},notifySeen:true}));assert.equal(corrupt.read('dimaReadStore().startDate'),'2026-10-01');assert.equal(corrupt.read('__dimaStoreError'),'corrupt');n++;
 const delayed=fixture(code);delayed.disk.set('ezik_dima_v1',JSON.stringify({startDate:'2026-01-01',log:{'2026-11-04':{l:1}},notify:{on:false,slot:'asr'},notifySeen:true}));delayed.read('__dimaData = null;');delayed.read('dimaReadStore()');assert(!delayed.disk.has('ezik_dima_v2'));delayed.read('__dimaData = data;');assert.equal(delayed.read('dimaReadStore().presented["2026-11-04"].dayId'),'dima.regular.030');n++;
 const dates=fixture(code);for(const off of [-2,0,2]){dates.disk.set('ezik_hijri_offset_v1',String(off));const h=dates.read('hijriForCivilDay(2026,3,18,readHijriOffset())');assert.equal(h.offset,off);assert.equal(h.by,'islamic-umalqura');n++;}
 dates.scope.Intl={};assert.equal(dates.read('hijriForCivilDay(2026,3,18,0).by'),'tabular-civil-IIa');n++;
 assert.equal(dates.read('dimaIndexForDate("2026-03-07",new Date(2026,2,9,12))'),3);assert.equal(dates.read('dimaIndexForDate("2026-10-31",new Date(2026,10,2,12))'),3);assert.equal(dates.read('dimaDateKey(dimaCivilDate(new Date("2026-11-05T02:00:00Z")))'),'2026-11-04');assert.equal(dates.read('dimaValidDayKey("2026-02-30")'),false);n++;
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'dima/dima-v1.json'))).digest('hex'),'09554894aeef74616a9e030f74f4542b83dc4a1aadf6220d427167c064dae15c');return n;
}
const mutant=core.replace('if (dimaPresentationValid(frozen, key)) return frozen;','if (false) return frozen;');assert.notEqual(mutant,core);
(async()=>{if(process.argv.includes('--mutant')){await verify(mutant);return;}const n=await verify(core);await assert.rejects(()=>verify(mutant),assert.AssertionError);console.log('PASS B10 resolver: '+n+' cases; 30/60/90 days, seasons, Friday, frozen snapshots, v1/v2 migration, offline/storage faults, UTC civil progress, prayer timezone and shared Hijri calendar.');})().catch(e=>{console.error(e);process.exitCode=1;});
