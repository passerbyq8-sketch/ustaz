'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),z=require('zlib'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const languages=['fr','ur','id','ha','sw','zh','de','hi','ps','uz'];
const BASE='09554894aeef74616a9e030f74f4542b83dc4a1aadf6220d427167c064dae15c';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const norm=s=>s.normalize('NFC').replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u200B-\u200F\uFEFF]/g,'').replace(/\s+/g,' ').trim();
const hid=s=>'h:'+crypto.createHash('sha1').update(norm(s),'utf8').digest('hex').slice(0,12);
function read(f){const b=fs.readFileSync(path.join(root,f));assert(!b.includes(13),f+' LF');assert(!b.subarray(0,3).equals(Buffer.from([239,187,191])),f+' BOM');return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b));}
function load(){
 const snapshots=languages.map(l=>l==='de'?read('lang/content/sources/dima-quran-de-1.0.16.json'):JSON.parse(z.gunzipSync(fs.readFileSync(path.join(root,'lib/data/translations/quran-'+l+'.json.gz')))));
 return {live:fs.readFileSync(path.join(root,'dima/dima-v1.json')),inventory:read('lang/content/dima-inventory-v1.json'),baseline:read('lang/content/en/sections/dima.json'),files:languages.map(l=>read('lang/content/'+l+'/sections/dima.json')),snapshots};
}
const slots=s=>(s.match(/\{[A-Za-z][A-Za-z0-9_]*\}/g)||[]).sort();
const text=(s,at)=>assert(typeof s==='string'&&s.trim()&&!s.includes('??')&&!s.includes('\ufffd'),at+' empty/invalid text');
function validate(state){
 assert.equal(hash(state.live),BASE,'live Arabic source bytes');
 const live=JSON.parse(state.live),inv=state.inventory;
 assert.equal(inv.schema,'ezik-dima-inventory/1');assert.equal(inv.source,'dima/dima-v1.json');assert.equal(inv.sourceSha256,BASE);assert.equal(inv.count,372);assert.equal(inv.items.length,372);
 assert.equal(state.baseline.items.length,372,'established lookup inventory');
 const ids=new Set(),arabic=new Set(inv.items.map(x=>norm(x.ar)));
 for(const [i,x]of inv.items.entries()){
  assert.equal(x.index,i);text(x.ar,'Arabic '+i);assert(!ids.has(x.id),'duplicate inventory ID');ids.add(x.id);
  const b=state.baseline.items[i];assert.deepEqual([x.id,x.kind,x.ar],[b.id,b.kind,b.ar],'same established id/kind/Arabic '+i);
  if(x.id.startsWith('h:'))assert.equal(x.id,hid(x.ar),'stable content hash');
  else assert([...live.lisan,live.overrides.friday.lisan].some(l=>l.id===x.id&&l.text===x.ar),'stable dhikr ID');
 }
 // All Arabic string leaves in the live JSON, including references, UI, notifications,
 // Friday and closing, must be represented. Whitespace aliases share a normalized ID.
 function coverage(v,at){if(typeof v==='string'&&/[\u0621-\u064A]/.test(v))assert(arabic.has(norm(v)),'untranslated source '+at);if(v&&typeof v==='object')for(const [k,x]of Object.entries(v))coverage(x,at+'.'+k);}
 coverage(live,'dima');assert.equal(live.days.length,30);
 const refs=new Map();
 function references(v){if(!v||typeof v!=='object')return;if(v.verified?.surah)for(const k of ['text','note','ayah'])if(typeof v[k]==='string')refs.set(norm(v[k]),[v.verified.surah,v.verified.ayah]);Object.values(v).forEach(references);}
 references(live);
 const extras={27:[21,87],152:[7,205],215:[17,37],229:[14,7],237:[40,60]};
 for(const x of inv.items){const ref=extras[x.index]||refs.get(norm(x.ar));if(x.kind==='quran'||extras[x.index]){assert.deepEqual(x.verse,ref,'Arabic verse binding '+x.index);}else assert.equal(x.verse,undefined);}
 const mixed={28:['21:87'],221:['112:1','113:1','114:1']};
 const sleep=inv.items[221].ar.split(': ')[1].split(' \u0648\u064e');
 const quoted={28:[inv.items[28].ar.split(': ')[1].split('\u060c')[0]],221:sleep};
 assert.equal(state.files.length,languages.length);
 for(const [li,d]of state.files.entries()){
  const lang=languages[li],snapshot=state.snapshots[li];
  assert.equal(d.schema,'ezik-tr4/1');assert.equal(d.section,'dima');assert.equal(d.lang,lang);assert.equal(d.items.length,372,'item count '+lang);
  assert.equal(d.title.ar,state.baseline.title.ar);text(d.title.tr,lang+' title');assert.deepEqual(d.source_files,['dima/dima-v1.json','app.jsx']);
  const seen=new Set(),row=ref=>{const [s,a]=ref.split(':').map(Number);const r=lang==='de'?snapshot.verses[ref]:snapshot.suras[s-1][a-1];assert(r?.[0],'snapshot '+ref);return r[0]+(r[1]?'\n'+r[1]:'');};
  function source(src,vs){assert.equal(src.version,snapshot.meta.version);assert.equal(src.snapshot,snapshot.meta.fetchedAt);assert.equal(src.date,'2026-11-04');assert(src.name.includes(snapshot.meta.title)&&src.name.includes('QuranEnc.com'));assert(src.rights.includes('https://quranenc.com/en/home/api/'));assert.equal(src.url,'https://quranenc.com/en/browse/'+snapshot.meta.key+'/'+vs[0].replace(':','/'));assert.deepEqual(src.refs,vs);assert.equal(src.ref,vs[0]);}
  for(const [i,x]of d.items.entries()){
   const original=inv.items[i];assert.deepEqual(Object.keys(x).sort(),['ar','id','kind','src','tag','tr','translit']);
   assert.deepEqual([x.id,x.kind,x.ar],[original.id,original.kind,original.ar],lang+' unchanged Arabic/ID '+i);
   assert(!seen.has(x.id),lang+' duplicate ID');seen.add(x.id);text(x.tr,lang+' '+i);assert.deepEqual(slots(x.tr),slots(x.ar),lang+' placeholders '+i);
   assert(!/\{Q\d+:\d+\}/.test(x.tr),'unresolved source placeholder');
   if(['dhikr','dua'].includes(x.kind))text(x.translit,lang+' transliteration '+i);else assert.equal(x.translit,'','non-dhikr transliteration');
   if(original.verse){
    const ref=original.verse.join(':');assert.equal(x.tag,'published');source(x.src,[ref]);
    const newline=x.tr.indexOf('\n');assert(newline>0&&x.tr.slice(0,newline).endsWith('('+ref+'):'),'full context label');assert.equal(x.tr.slice(newline+1),row(ref),lang+' unaltered verse/footnotes '+ref);
   }else{
    assert.equal(x.tag,'machine');assert.deepEqual([x.src.name,x.src.url,x.src.rights,x.src.date],['machine','','','']);
    if(mixed[i]){source(x.src.publishedQuotes,mixed[i]);for(const [n,ref]of mixed[i].entries()){assert(original.ar.includes(quoted[i][n]),'Arabic quotation binding');assert(x.tr.includes(quoted[i][n]+' ['),'exact Arabic quote retained');assert(x.tr.includes('('+ref+'):\n'+row(ref)+']'),'embedded full verse and footnotes');}}
    else assert.equal(x.src.publishedQuotes,undefined);
   }
   // Source names, FC identifiers, placeholder names and verse digits are metadata;
   // Uzbek prose and transliteration must remain Cyrillic, never Latin Uzbek.
   const cleaned=x.tr.replace(/\{[^}]+\}/g,'').replace(/FC-\d+/g,'');
   const scripts={uz:/[\u0400-\u04ff]/,zh:/[\u3400-\u9fff]/,hi:/[\u0900-\u097f]/,ur:/[\u0600-\u06ff]/,ps:/[\u0600-\u06ff]/};
   assert((scripts[lang]||/[A-Za-z\u00c0-\u024f]/).test(cleaned),lang+' expected script '+i);
   if(lang==='uz'){assert(!/[A-Za-z]/.test(cleaned),'Uzbek Latin prose '+i);assert(!/[A-Za-z]/.test(x.translit),'Uzbek Latin transliteration '+i);}
  }
  assert.equal(d.items.filter(x=>x.tag==='published').length,43);assert.equal(d.items.filter(x=>x.tag==='machine').length,329);
 }
 return state.files.length*inv.count;
}
const state=load();console.log('Dima translations PASS: '+validate(state)+' items, 10 languages, 372 stable IDs each; 30 days and all live Arabic leaves covered; full published verses/footnotes unchanged.');
if(process.argv.includes('--self-test')){
 const mutations=[['missing item',s=>s.files[0].items.pop()],['duplicate ID',s=>s.files[0].items[1].id=s.files[0].items[0].id],['empty translation',s=>s.files[0].items[0].tr=''],['question-mark placeholder',s=>s.files[0].items[0].tr='??'],['changed Arabic',s=>s.files[0].items[0].ar+='!'],['corrupt published verse',s=>s.files[0].items[33].tr+='!'],['lost placeholder',s=>s.files[0].items[280].tr=s.files[0].items[280].tr.replace('{n}','1')],['missing transliteration',s=>s.files[0].items[1].translit=''],['Latin Uzbek',s=>s.files[9].items[0].tr='Ozbekcha'],['changed live source',s=>s.live=Buffer.concat([s.live,Buffer.from(' ')])]];
 for(const [name,mutate]of mutations){const c=structuredClone(state);c.live=Buffer.from(c.live);mutate(c);assert.throws(()=>validate(c),'mutation must fail: '+name);console.log('REJECTED mutation: '+name);}
 console.log('Restored original inputs: '+validate(state)+' items PASS. No files mutated.');
}
