// K01: offline validation of the new Oromo assets. Run from any directory.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const readJson=(rel)=>{
 const raw=fs.readFileSync(path.join(root,rel));
 check(!raw.subarray(0,3).equals(Buffer.from([239,187,191])),rel+': BOM');
 check(!raw.includes(13),rel+': CR line endings');
 const text=raw.toString('utf8'),obj=JSON.parse(text);
 check(text===JSON.stringify(obj,null,2)+'\n',rel+': expected two-space JSON and final LF');
 const declared=[...text.matchAll(/^  "([^"]+)":/gm)].map(m=>m[1]);
 check(new Set(declared).size===declared.length,rel+': duplicate keys');
 return obj;
};
const om=readJson('lang/om.json');
const am=JSON.parse(fs.readFileSync(path.join(root,'lang/am.json'),'utf8'));
const keys=Object.keys(am);
check(JSON.stringify(Object.keys(om))===JSON.stringify(keys),'am/om keys or order differ');
const jsx=fs.readFileSync(path.join(root,'app.jsx'),'utf8');
const a=jsx.indexOf('const EZ_I18N = ')+16;
const dict=vm.runInNewContext('('+jsx.slice(a,jsx.indexOf('\n};',a)+2)+')');
const ph=s=>(s.match(/\{[A-Za-z0-9_]+\}/g)||[]).sort();
for(const k of keys){
 check(/^[\x00-\x7f]+$/.test(k),'Non-ASCII key: '+k);
 check(typeof om[k]==='string'&&om[k].trim().length>0,'Empty translation: '+k);
 check(!/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\u1200-\u137f\uab00-\uab2f\ufb50-\ufdff\ufe70-\ufeff]/u.test(om[k]),'Arabic/Ethiopic in dictionary: '+k);
 check(JSON.stringify(ph(dict.ar[k]))===JSON.stringify(ph(om[k])),'Placeholder mismatch: '+k);
 const lead=dict.en[k].match(/^\s*/)[0],trail=dict.en[k].match(/\s*$/)[0];
 check(om[k].startsWith(lead)&&om[k].endsWith(trail),'Whitespace mismatch: '+k);
}
const q=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'lang/om/quran-om.json.gz'))));
const qa=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'lib/data/translations/quran-am.json.gz'))));
check(q.suras.length===114,'Expected 114 surahs');
check(q.suras.length===qa.suras.length,'Surah count differs from am');
let verses=0;
q.suras.forEach((s,i)=>{
 check(s.length===qa.suras[i].length,'Verse count differs in surah '+(i+1));
 for(const v of s){check(Array.isArray(v)&&v.length===2&&v.every(x=>typeof x==='string')&&v[0].trim(),'Malformed verse');verses++;}
});
check(q.meta.key==='oromo_ababor'&&q.meta.version==='1.0.3'&&q.meta.source==='QuranEnc.com','Snapshot provenance');
const m=readJson('lang/om/metadata.json');
check(m.lang==='om'&&m.nativeName==='Afaan Oromoo'&&m.dir==='ltr'&&m.hidden===true,'Language metadata');
check(m.surahNames.length===114&&m.surahNames.every(n=>/^[A-Za-z '\-’]+$/.test(n)),'Expected 114 Qubee surah names');
const enabled=JSON.parse(fs.readFileSync(path.join(root,'config/enabled-languages.json'),'utf8'));
check(!enabled.enabled.includes('om'),'Oromo must remain hidden in production');
console.log('PASS K01: '+keys.length+' dictionary keys; exact order, placeholders, script, whitespace, UTF-8/LF; '+q.suras.length+' surahs, '+verses+' verses; 114 Qubee names; hidden metadata.');
