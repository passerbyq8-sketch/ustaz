import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const root=path.resolve(process.argv[2] || '.');
const P='C:/Users/passe/projects/ustaz-archive/sessions/program-2026-09-24/16-fix-d3c';
const label=process.argv[3] || 'before';
const BASE='5f0dbec61cd47bd66c04481c5907acd98eb8e577';
globalThis.fetch=async()=>{throw Error('D3C offline: network forbidden');};
const changed=['lib/takhrij.js','lib/takhrij-lock.js','lib/free-brain/loop.js','api/ask.js'];
if(label==='before') {
  for(const rel of changed) {
    const dest=path.join(P,'baseline',rel);fs.mkdirSync(path.dirname(dest),{recursive:true});
    const raw=execFileSync('git',['show',BASE+':'+rel],{cwd:root,encoding:'utf8',maxBuffer:20_000_000});
    const source=raw.replace(/((?:from\s+|import\s*)['"])(\.\.?\/[^'"]+)(['"])/g,(_,lead,spec,tail)=>{
      const full=path.resolve(root,path.dirname(rel),spec), other=path.relative(root,full).replaceAll('\\','/');
      return lead+pathToFileURL(changed.includes(other)?path.join(P,'baseline',other):full).href+tail;
    });
    fs.writeFileSync(dest,source);
  }
  fs.writeFileSync(path.join(P,'baseline/package.json'),'{"type":"module"}\n');
}
const mod=rel=>import(pathToFileURL(path.join(label==='before'?path.join(P,'baseline'):root,rel)));
const [tk,lock,loop,ask]=await Promise.all(changed.map(mod));
const input=JSON.parse(fs.readFileSync(path.join(P,'measured-inputs.json'),'utf8'));
const outputs=[];
const words=s=>tk.foldArabic(String(s||'').replaceAll('ﷺ','صلى الله عليه وسلم'));
for(const r of input.rows) {
  const lookup=async(matns,options={})=>matns.map(matn=>{
    const hits=r.hits.filter(h=>h.fullText&&(!options.bookIds?.length||options.bookIds.includes(h.book)));
    return {matn,atoms:hits.map(h=>h.fullText),subjectIds:hits.map(h=>h.book)};
  });
  const rows=r.materials.map(m=>({ ...m,recordId:m.id,bookTitle:m.book,subjectId:m.subject,
    locatorSpan:{volume:m.volume,pageStart:m.page,pageEnd:m.pageEnd},part:m.volume,publisher:m.kind==='encyclopedia'?'الموسوعة الفقهية الكويتية':undefined,
    fullText:m.text,writerText:m.text }));
  const cited=rows.filter(m=>r.cited.includes(m.ref));
  const options=label==='before'?{}:{locations:true,question:r.question};
  const cards=[...loop.pickReaderCards(cited,3,row=>ask.buildSourceTag({url:row.url,title:row.title})),
    ...loop.pickBookCards(cited,3,ask.buildBookTag,options),...loop.pickEncyclopediaCards(cited,3,ask.buildBookTag,options)];
  const pass=await tk.applyTakhrij(r.text,{env:{TAKHRIJ_V1:'on',FULL_ANSWER_V1:'on'},lookup,question:r.question});
  let sources=cited.map(m=>({title:m.title,passage:label==='before'?m.text.slice(0,1200):m.text}));
  for(const entry of pass.entries || []) {
    for(const book of entry.sealProof || []) sources.push({title:book,passage:book+' '+entry.matn});
    for(const book of entry.proseProof || []) sources.push({proseProof:{book,matn:entry.matn}});
    if(entry.authenticityProof) sources.push({authenticityProof:entry.authenticityProof});
  }
  const sealed=lock.lockTakhrij(pass.text,sources,{bracketAfterQuote:true});
  const cardDetails=cards.map(c=>({tag:c.tag,matn:Buffer.from(/ matn="([^"]*)"/.exec(c.tag)?.[1]||'','base64').toString('utf8')}));
  outputs.push({file:r.file,question:r.question,recordedFinal:r.delivered,recordedDraft:r.draft,input:r.text,finalText:sealed.text,
    cards:cardDetails,takhrij:pass,seal:sealed,materials:r.materials.map(m=>({ref:m.ref,chars:m.chars,available:m.availableChars,origin:m.origin})),
    lookupCoverage:{logged:r.hits.length,fullRecovered:r.hits.filter(h=>h.fullText).length},
    c2g:r.file.includes('000050')?r.hits.filter(h=>h.fullText).map(h=>({id:h.id,book:h.book,head:h.head,chars:h.chars,recoveredChars:h.fullText.length,
      fullMatch:words(h.fullText).includes(words(r.targets[0]?.target.matn)),
      askedMatch:words(h.fullText).includes(words(/«([^»]+)»/.exec(r.question)?.[1])),
      headMatch:words(h.fullText).includes(words(r.targets[0]?.target.matn).split(' ').slice(0,4).join(' ')),
      tailMatch:words(h.fullText).includes(words(r.targets[0]?.target.matn).split(' ').slice(-4).join(' '))})):undefined});
}
fs.writeFileSync(path.join(P,`replay-${label}.json`),JSON.stringify({base:BASE,label,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),outputs},null,2)+'\n');
console.log(JSON.stringify({label,turns:outputs.length,hadith:outputs.filter(r=>r.file.startsWith('traces-hadith')).map(r=>({file:r.file,matched:r.takhrij.entries.filter(e=>e.sourced).length,removed:r.seal.droppedSentences.length,head:r.takhrij.gradingHead,coverage:r.lookupCoverage})),c2g:outputs.find(r=>r.c2g)?.c2g},null,2));
