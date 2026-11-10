'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const BASE='93eae353c596799d82a7df576fc2632102f86198f7290c3f3c092d67a70cb8a6';
const files=['pack-regular-002.json','pack-ramadan-001.json','pack-dhul-hijjah-001.json','pack-white-days-001.json','pack-regular-003.json'];
function json(f){const b=fs.readFileSync(path.join(root,f));assert(!b.subarray(0,3).equals(Buffer.from([239,187,191])),f+' BOM');assert(!b.includes(13),f+' must be LF');return JSON.parse(b.toString('utf8'));}
const norm=s=>s.normalize('NFC').replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g,'').replace(/[\u0623\u0625\u0622\u0671]/g,'\u0627').replace(/\u0629/g,'\u0647').replace(/\u0649/g,'\u064a').replace(/[^\u0621-\u064a0-9]/g,'');
function load(){return {legacy:fs.readFileSync(path.join(root,'dima/dima-v1.json')),packs:files.map(f=>json('dima/'+f)),manifest:json('dima/pack-manifest-v1.json'),schema:json('dima/pack-schema-v1.json'),proof:json('dima/pack-source-evidence-v1.json'),quran:json('quran-uthmani.json'),quranHash:hash(fs.readFileSync(path.join(root,'quran-uthmani.json'))),activation:Object.fromEntries(['app.jsx','app.js','sw.js'].map(f=>[f,fs.readFileSync(path.join(root,f),'utf8')]))};}
// Validate the actual JSON Schema subset used by this data, without adding a dependency.
function schemaCheck(v,s,defs,at){
 if(s.$ref)return schemaCheck(v,defs[s.$ref.split('/').at(-1)],defs,at);
 if(s.const!==undefined)assert.deepEqual(v,s.const,at+' const');
 if(s.enum)assert(s.enum.includes(v),at+' enum');
 if(s.type){const ts=[s.type].flat();assert(ts.some(t=>t==='null'?v===null:t==='integer'?Number.isInteger(v):t==='array'?Array.isArray(v):t==='object'?v!==null&&typeof v==='object'&&!Array.isArray(v):typeof v===t),at+' type');}
 if(typeof v==='string'){if(s.minLength)assert(v.length>=s.minLength,at+' length');if(s.pattern)assert(new RegExp(s.pattern).test(v),at+' pattern');}
 if(typeof v==='number'){if(s.minimum!==undefined)assert(v>=s.minimum,at+' minimum');if(s.maximum!==undefined)assert(v<=s.maximum,at+' maximum');}
 if(Array.isArray(v)){if(s.minItems)assert(v.length>=s.minItems,at+' count');if(s.maxItems)assert(v.length<=s.maxItems,at+' count');if(s.items)v.forEach((x,i)=>schemaCheck(x,s.items,defs,at+'/'+i));}
 if(v&&typeof v==='object'&&!Array.isArray(v)){for(const k of s.required||[])assert(Object.hasOwn(v,k),at+' missing '+k);if(s.additionalProperties===false)for(const k of Object.keys(v))assert(Object.hasOwn(s.properties||{},k),at+' extra '+k);for(const [k,sub]of Object.entries(s.properties||{}))if(Object.hasOwn(v,k))schemaCheck(v[k],sub,defs,at+'/'+k);}
 const matches=sub=>{try{schemaCheck(v,sub,defs,at);return true;}catch{return false;}};
 if(s.oneOf)assert.equal(s.oneOf.filter(matches).length,1,at+' oneOf');
 if(s.not)assert(!matches(s.not),at+' not');
 if(s.if)schemaCheck(v,matches(s.if)?s.then||{}:s.else||{},defs,at);
 for(const sub of s.allOf||[])schemaCheck(v,sub,defs,at);
}
function validate(s){
 assert.equal(hash(s.legacy),BASE,'live dima-v1 bytes');
 const live=JSON.parse(s.legacy),ids=new Set(),proof=new Map(s.proof.entries.map(e=>[e.key,e]));
 assert.equal(proof.size,s.proof.entries.length,'duplicate evidence keys');
 const add=id=>{assert(typeof id==='string'&&id&&!ids.has(id),'duplicate/empty ID '+id);ids.add(id);};
 const text=t=>assert(typeof t==='string'&&t.trim()&&!t.includes('??')&&!t.includes('\ufffd'),'empty/invalid text');
 const specs=[['dima-regular-002','regular',31,30,null],['dima-ramadan-001','ramadan',1,30,9],['dima-dhul-hijjah-001','dhul-hijjah',1,10,12],['dima-white-days-001','white-days',13,3,null],['dima-regular-003','regular',61,30,null]];
 assert.equal(s.packs.length,specs.length,'pack count');
 for(const [i,p]of s.packs.entries()){
  schemaCheck(p,s.schema,s.schema.$defs,files[i]);
  const [pid,kind,start,count,month]=specs[i];assert.equal(p.id,pid);assert.equal(p.version,1);assert.equal(p.sourceBase.sha256,BASE);assert.equal(p.days.length,count);
  assert.equal(p.kind,kind==='regular'?'regular':'seasonal');
  if(kind!=='regular'){assert.deepEqual(p.season,{id:kind,hijriMonth:month,firstDay:start,lastDay:start+count-1,priority:i===3?200:300});}else assert.equal(p.startDay,start);
  for(const [n,d]of p.days.entries()){
   assert.equal(d.position,start+n);assert.equal(d.id,'dima.'+kind+'.'+String(start+n).padStart(kind==='regular'?3:2,'0'));add(d.id);
   assert(live.lisan.some(l=>l.id===d.lisanRef),'missing lisan');assert(proof.has(d.lisanRef),'unverified lisan');
   for(const slot of ['qalb','jawarih']){const x=d[slot];assert.equal(x.id,d.id+'.'+slot);add(x.id);assert.equal(x.noteId,x.id+'.note');add(x.noteId);assert.equal(x.actionId,x.id+'.action');add(x.actionId);for(const k of ['text','note','src','action'])text(x[k]);assert(x.text.length<=180,'guidance too long');
    const match=s.proof.entries.find(e=>e.text===x.note&&e.kind===x.kind&&e.src===x.src&&JSON.stringify(e.verified)===JSON.stringify(x.verified));assert(match,'source binding '+x.id);
    if(x.kind==='quran')assert(s.quran[x.verified.surah+':'+x.verified.ayah].includes(x.note),'mushaf bytes '+x.id);
    else {assert.equal(hash(match.evidence.text),match.evidence.atomSha256,'atom hash');assert(norm(match.evidence.text).includes(norm(x.note)),'quotation outside atom');assert.equal(x.verified.ref,x.verified.volume+'/'+x.verified.page);}
   }
   for(const k of ['teaser','notification']){assert.equal(d[k].id,d.id+'.'+k);add(d[k].id);text(d[k].text);assert(d[k].text.length<=90,k+' too long');}
  }
 }
 const m=s.manifest;assert.equal(m.schema,'ezik-dima-manifest/1');assert.equal(m.legacy.sha256,BASE);assert.equal(m.afterLast,'repeat-all-available');assert.deepEqual(m.precedence,['ramadan','dhul-hijjah','white-days','friday','regular']);
 assert.deepEqual(m.regular.map(x=>[x.id,x.firstDay,x.lastDay]),[['dima-regular-001',1,30],['dima-regular-002',31,60],['dima-regular-003',61,90]]);
 assert.equal(m.regular[1].path,'/dima/'+files[0]);
 assert.deepEqual(m.regular[2],{id:'dima-regular-003',version:1,path:'/dima/'+files[4],firstDay:61,lastDay:90});
 assert.equal(m.seasonal.length,3,'seasonal manifest count');
 m.seasonal.forEach((x,i)=>{assert.equal(x.path,'/dima/'+files[i+1]);assert.equal(x.count,s.packs[i+1].days.length);assert.equal(x.id,s.packs[i+1].season.id);assert.equal(x.packId,s.packs[i+1].id);});
 for(const group of [m.labels,m.notifications])for(const x of Object.values(group)){add(x.id);text(x.text);}
 // Batch 3 adds fresh heart/action texts. The shared lisan pool deliberately
 // repeats by contract; its known truncated l12 opening is not selected here.
 const earlier=[...live.days,...s.packs[0].days].flatMap(d=>[d.qalb,d.jawarih]);
 const guidance=new Set(earlier.map(x=>norm(x.text)));
 const earlierQuotes=earlier.flatMap(x=>[x.note,x.ayah,x.kind==='quran'?x.text:null]).filter(x=>typeof x==='string').map(norm);
 const refs=new Set(earlier.filter(x=>x.verified?.surah).map(x=>x.verified.surah+':'+x.verified.ayah));
 const newQuotes=new Set();
 for(const d of s.packs[4].days){
  assert.notEqual(d.lisanRef,'l12','batch 3 must not propagate known l12 defect');
  const l=live.lisan.find(x=>x.id===d.lisanRef),e=proof.get(d.lisanRef);
  assert.equal(e.text,l.fadl,'batch 3 lisan evidence binding');
  assert.equal(hash(e.evidence.text),e.evidence.atomSha256,'lisan atom hash');
  assert(norm(e.evidence.text).includes(norm(l.fadl)),'lisan quotation outside atom');
  for(const slot of ['qalb','jawarih']){
   const x=d[slot],g=norm(x.text),q=norm(x.note),ref=x.verified.surah+':'+x.verified.ayah;
   assert(!guidance.has(g),'batch 3 repeated guidance '+x.id);guidance.add(g);
   assert(!earlierQuotes.some(old=>old.includes(q)||q.includes(old))&&!newQuotes.has(q),'batch 3 repeated quotation '+x.id);newQuotes.add(q);
   assert.equal(x.kind,'quran','batch 3 verified Quran source');
   assert(!refs.has(ref),'batch 3 repeated verse '+ref);refs.add(ref);
   const evidence=proof.get('batch3.quran.'+ref);assert(evidence,'missing batch 3 evidence '+ref);
   assert.equal(evidence.text,x.note);assert.equal(evidence.sourceFile,'quran-uthmani.json');assert.equal(evidence.sourceSha256,s.quranHash,'batch 3 mushaf hash');
   const span=evidence.evidence,full=s.quran[ref];assert.equal(span.reference,ref);assert.equal(span.fullVerse,full,'full verse context');assert.equal(span.verseSha256,hash(full),'verse hash');
   assert(Number.isInteger(span.start)&&Number.isInteger(span.end)&&span.start>=0&&span.end>span.start&&span.end<=full.length,'excerpt bounds');
   assert.equal(full.slice(span.start,span.end),x.note,'exact excerpt span');assert(x.note.length<=220,'batch 3 quotation too long');
  }
 }
 // Active packs are discovered through the manifest and warmed for offline use.
 for(const f of ['app.jsx','app.js'])assert(s.activation[f].includes('/dima/pack-manifest-v1.json'),'active manifest '+f);
 assert(s.activation['app.jsx'].includes('await dimaBuildCatalog(data, manifest, get)'),'manifest resolver is called');
 for(const url of ['/dima/pack-manifest-v1.json',...m.regular.filter(x=>x.path).map(x=>x.path),...m.seasonal.map(x=>x.path)])assert(s.activation['sw.js'].includes("'"+url+"'"),'offline warm '+url);

 return ids.size;
}
const state=load();console.log('Dima packs PASS: 103 days; '+validate(state)+' stable IDs; local source evidence; legacy bytes unchanged; active manifest resolver and offline pack warming.');
if(process.argv.includes('--self-test')){
 const mutations=[['missing active manifest',s=>s.activation['app.jsx']=s.activation['app.jsx'].replace('/dima/pack-manifest-v1.json','/dima/missing.json')],['missing active resolver',s=>s.activation['app.jsx']=s.activation['app.jsx'].replace('await dimaBuildCatalog(data, manifest, get)','null')],['missing batch 3 offline warm',s=>s.activation['sw.js']=s.activation['sw.js'].replace("'/dima/pack-regular-003.json'", "'/dima/missing.json'")],['duplicate ID',s=>s.packs[0].days[1].id=s.packs[0].days[0].id],['missing source',s=>s.packs[0].days[0].qalb.src=''],['empty notification',s=>s.packs[0].days[0].notification.text=''],['changed quote',s=>s.packs[0].days[0].qalb.note+='!'],['changed live bytes',s=>s.legacy=Buffer.concat([s.legacy,Buffer.from(' ')])],['wrong seasonal count',s=>s.packs[1].days.pop()],['wrong schema',s=>s.packs[0].version='1']];
 mutations.push(
  ['missing batch 3',s=>s.packs.pop()],
  ['missing batch 3 manifest',s=>s.manifest.regular.pop()],
  ['batch 3 wrong manifest path',s=>s.manifest.regular[2].path='/dima/pack-regular-002.json'],
  ['batch 3 gap',s=>s.packs[4].days[0].position=62],
  ['batch 3 truncated count',s=>s.packs[4].days.pop()],
  ['batch 3 duplicate ID',s=>s.packs[4].days[1].id=s.packs[4].days[0].id],
  ['batch 3 empty notification',s=>s.packs[4].days[0].notification.text=''],
  ['batch 3 missing source',s=>s.packs[4].days[0].qalb.src=''],
  ['batch 3 altered quotation',s=>s.packs[4].days[0].qalb.note+='!'],
  ['batch 3 repeated guidance',s=>s.packs[4].days[0].qalb.text=s.packs[0].days[0].qalb.text],
  ['batch 3 repeated new guidance',s=>s.packs[4].days[1].qalb.text=s.packs[4].days[0].qalb.text],
  ['batch 3 repeated prior quote',s=>{const x=s.packs[4].days[0].qalb,old=s.packs[0].days[0].qalb;for(const k of ['note','kind','src','verified'])x[k]=old[k];}],
  ['batch 3 repeated new quote',s=>{const x=s.packs[4].days[1].qalb,old=s.packs[4].days[0].qalb;for(const k of ['note','kind','src','verified'])x[k]=old[k];}],
  ['batch 3 missing evidence',s=>s.proof.entries=s.proof.entries.filter(x=>x.key!=='batch3.quran.35:15')],
  ['batch 3 wrong mushaf hash',s=>s.proof.entries.find(x=>x.key==='batch3.quran.35:15').sourceSha256='0'.repeat(64)],
  ['batch 3 wrong verse context',s=>s.proof.entries.find(x=>x.key==='batch3.quran.35:15').evidence.fullVerse+='!'],
  ['batch 3 wrong excerpt span',s=>s.proof.entries.find(x=>x.key==='batch3.quran.35:15').evidence.start++],
  ['batch 3 known defective lisan',s=>s.packs[4].days[0].lisanRef='l12']
 );
 for(const [name,mutate]of mutations){const c=structuredClone(state);c.legacy=Buffer.from(c.legacy);mutate(c);assert.throws(()=>validate(c),'mutation must fail: '+name);console.log('REJECTED mutation: '+name);}
 console.log('Restored original inputs: '+validate(state)+' IDs PASS. No files mutated.');
}
