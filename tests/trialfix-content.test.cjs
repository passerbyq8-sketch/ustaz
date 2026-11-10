const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),test=require('node:test');
const root=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const baseline=read('tests/trialfix-content-baseline.json'),hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
test('trialfix-d1 hadith 31 exact asserted correction, four languages, untouched other hadith and biographies',()=>{
 const data=read('arbaeen.json'),text=data.hadith[30].text;
 assert.equal(text,baseline.baseText.replace(baseline.old,baseline.new));assert(text.startsWith(baseline.start));
 assert.equal(hash(data.hadith.filter(h=>h.n!==31)),baseline.otherHadith);
 assert.equal(hash(read('arbaeen-sharh.json').items),baseline.explanations,'includes hadith 30/32 and editorial notes 30/40');
 for(const code of ['am','en','fa','om']){
  const item=read('lang/content/'+code+'/sections/arbaeen.json').items.find(x=>x.id==='31'&&x.kind==='hadith');
  assert(item.ar.startsWith(baseline.start));assert(!item.ar.includes(baseline.old));
  if(code==='en')assert(item.tr.includes("Sahl ibn Sa'd"));
  if(code==='om')assert(item.tr.includes('Sahl bin Sa\u2019d'));
  if(code==='am')assert(item.tr.includes('\u1230\u1205\u120d \u12a2\u1265\u1295 \u1230\u12d5\u12f5'));
  if(code==='fa')assert(item.tr.includes(baseline.new.normalize('NFD').replace(/[\u064b-\u065f]/g,'')));
 }
 const builder=fs.readFileSync(path.join(root,'tools/arbaeen-sharh-build.cjs'),'utf8');
 assert(builder.includes("hadith: 31, field: 'matn', paragraph: 0"));
});
