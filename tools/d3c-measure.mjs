import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const session = 'C:/Users/passe/projects/ustaz-archive/sessions/program-2026-09-24';
const E = path.join(session, '14-tool-test');
const P = path.join(session, '16-fix-d3c');
const tk = await import(pathToFileURL(path.join(root, 'lib/takhrij.js')));
globalThis.fetch = async () => { throw new Error('D3C offline: network forbidden'); };
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const archive = path.resolve(session, '../..');
const saved = [];
function walk(value, file) {
  if (!value || typeof value !== 'object') return;
  if (typeof value.atomText === 'string') saved.push({ text: value.atomText, book: value.id, file });
  if (typeof value.text === 'string' && (value.atom_id || value.subject_id || value.book_id)) saved.push({ text:value.text, book:value.subject_id || value.book_id, id:value.atom_id, file });
  for (const item of Object.values(value)) if (item && typeof item === 'object') walk(item, file);
}
const dirs = [path.join(session,'09-order-b/b2'),path.join(session,'10-order-c/c4/measure'),path.join(archive,'probes/ez111-harness/complete'),path.join(archive,'probes/ez111-harness/close')];
function filesIn(dir) {
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e => e.isDirectory() ? filesIn(path.join(dir,e.name)) : [path.join(dir,e.name)]);
}
for (const dir of dirs) for (const file of filesIn(dir)) {
  if (!file.endsWith('.json') || !/sample|atoms|offline|jibril/.test(path.basename(file))) continue;
  try { walk(read(file), file); } catch {}
}
const plain = s => String(s || '').replace(/\s+/gu,' ').trim();
const recover = hit => saved.find(a => a.book === hit.book && a.text.length === hit.chars && plain(a.text).startsWith(plain(hit.head)))
  || saved.find(a => a.book === hit.book && plain(a.text).startsWith(plain(hit.head)));
const corpus = readGzip(path.join(root,'lib/data/fiqh-search.json.gz'));
function readGzip(p) {return JSON.parse(gunzipSync(fs.readFileSync(p)));}
const rows=[];
for (const dir of ['traces','traces-hadith','traces-compare']) for (const name of fs.readdirSync(path.join(E,dir))) {
  if (!name.endsWith('.json')) continue;
  const t=read(path.join(E,dir,name)); if (!Array.isArray(t.records)) continue;
  const get=s=>t.records.find(r=>r.stage===s)?.data;
  const loop=get('loop-out'); if (!loop) continue;
  const hits=t.records.filter(r=>r.stage==='fetch' && r.data.req?.url?.includes('lib.ezik.app')).flatMap(r=>(r.data.res?.hits || []).map(h=>({...h, seq:r.seq, query:r.data.req?.body?.q || ''})));
  const targets=tk.findTargets(loop.text || '').targets;
  const recovered=hits.map(h=>{const a=recover(h);return {...h, fullText:a?.text || '', origin:a?.file || ''};});
  const delivered=get('delivered')?.readerText || '';
  const cardBodies=[...delivered.matchAll(/<book\b([^>]*)>([^<]*)<\/book>/gu)].map(m=>({title:m[2],
    atom:/\batom="([^"]*)"/u.exec(m[1])?.[1] || '',
    locator:/\bref="([^"]*)"/u.exec(m[1])?.[1] || '',
    text:Buffer.from(/\bmatn="([^"]*)"/u.exec(m[1])?.[1] || '', 'base64').toString('utf8')}));
  const writerPrompts=t.records.filter(r=>r.stage==='fetch' && r.data.req?.kind==='provider').map(r=>r.data.req.lastText || '');
  const materials=(loop.evidence || []).map(m=>{
    const local=corpus.find(c=>c.id===m.id);
    const sourceHit=recovered.find(h=>m.id===`lib:${h.id}` || m.id===h.id);
    let text=local?.search || sourceHit?.fullText || '';
    let origin=local?'local corpus':sourceHit?.origin || '';
    const card=cardBodies.find(c=>c.title===m.book && (c.locator===m.locator || c.atom===String(m.id).replace(/^lib:/u,'')));
    if(!text && card?.text) {text=card.text;origin='recorded delivered card';}
    for(const prompt of writerPrompts) {
      const re=new RegExp('\\[\\['+m.ref+'\\]\\][^\\n]*\\n(?:النص: )?([\\s\\S]*?)(?=\\n\\n───|\\n\\nقواعد|$)');
      const match=re.exec(prompt);
      if(match && (!text || match[1].length === m.chars)) {text=match[1].trimEnd();origin='recorded writer prompt';}
    }
    return {...m, text, origin, availableChars:text.length};
  });
  rows.push({file:dir+'/'+name,question:get('route')?.question || '',draft:get('draft')?.draft || '',text:loop.text,delivered,cited:loop.cited,materials,
    verdict:loop.verdict,finalizer:get('finalizer'),writerCited:get('writer-cited'),hits:recovered,
    targets:targets.map(target=>({target,matchCount:recovered.filter(h=>h.fullText&&tk.atomCarriesMatnHeadTail(tk.narrationOf(h.fullText),target.matn)).length,
      speechCount:recovered.filter(h=>h.fullText&&tk.atomProvesPropheticSpeech(h.fullText,target.matn)).length,
      grade:tk.statedGradeNear(loop.text,target), lead:loop.text.slice(Math.max(0,target.start-160),target.start)}))});
}
fs.writeFileSync(path.join(P,'measured-inputs.json'),JSON.stringify({savedAtoms:saved.length,corpusKeys:Object.keys(corpus[0]),rows},null,2)+'\n');
const atomTexts=[];
const packed=rows.map(({file,question,draft,text,cited,materials,hits,targets})=>({file,question,draft,text,cited,materials,
  hits:hits.map(h=>{
    let atom=-1;
    if(h.fullText) {atom=atomTexts.indexOf(h.fullText);if(atom<0) {atom=atomTexts.length;atomTexts.push(h.fullText);}}
    return {id:h.id,book:h.book,atom,chars:h.chars};
  }),targets:targets.map(({target})=>({target}))}));
fs.writeFileSync(path.join(root,'guards/fixtures/d3c-recorded.json'),JSON.stringify({method:'Recorded drafts and helper replay; missing source bytes remain identified. No invented lookup atom.',atomTexts,rows:packed},null,2)+'\n');
console.log(JSON.stringify({savedAtoms:saved.length,traces:rows.length,corpusKeys:Object.keys(corpus[0]),hadith:rows.filter(r=>r.file.startsWith('traces-hadith')).map(r=>({file:r.file,hits:r.hits.length,recovered:r.hits.filter(h=>h.fullText).length,targets:r.targets.map(t=>({matn:t.target.matn,matched:t.matchCount,speech:t.speechCount,lead:t.lead}))}))},null,2));
