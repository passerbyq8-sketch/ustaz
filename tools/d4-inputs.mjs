import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { selectPinnedText } from '../lib/before-writing.js';

const session = process.argv[2] || 'C:/Users/passe/projects/ustaz-archive/sessions/program-2026-09-24';
const root = path.resolve(import.meta.dirname, '..');
const E = path.join(session, '18-accept-battery');
const hash = data => createHash('sha256').update(data).digest('hex').toUpperCase();
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const diag = fs.readFileSync(path.join(E, 'EZIK-ACCEPT-DIAG-2026-09-26.md'));
const seal = /ACCEPT_DIAG_DONE ([A-F0-9]{64}) (\d+)\n$/.exec(diag.toString());
const body = diag.subarray(0, diag.length - Buffer.byteLength(seal?.[0] || ''));
if (!seal || hash(body) !== seal[1] || body.length !== +seal[2] || +seal[2] !== 144034
  || seal[1] !== 'AB87CAFA6AAE3D7D8075FCEF86524B0976E569A9D670D6A005EFD2DFBC1B69C7') throw Error('D4_STOP: diagnosis seal');
const manifest = [...body.toString().matchAll(/\| \[(Q\d+)\]\((traces-accept\/Q\d+\.json)\) \| [^|]+ \| [^|]+ \| (\d+) \| ([A-F0-9]{64}) \|/g)];
if (manifest.length !== 12) throw Error('D4_STOP: trace count');
const corpus = JSON.parse(gunzipSync(fs.readFileSync(path.join(root, 'lib/data/fiqh-search.json.gz'))));
const articlePages = read(path.join(root, 'guards/fixtures/fix-d2-articles.json')).pages;
const old = read(path.join(session, '16-fix-d3c/measured-inputs.json'));
const atoms = old.rows.flatMap(row => row.hits.filter(h => h.fullText));
const oldMaterials = old.rows.flatMap(row => row.materials);
const plain = text => String(text || '').replace(/\s+/gu, ' ').trim();
const norm = text => plain(text).replace(/[\u0640\u064B-\u065F\u0670]/gu, '').replace(/[أإآٱ]/gu, 'ا');
function articleFor(term, volume) {
  const atoms = new Map();
  for (const page of articlePages) for (const atom of page.payload?.atoms || []) {
    if (+atom.volume === +volume && atom.heading_path?.some(h => norm(h) === norm(term))) atoms.set(atom.atom_id, atom);
  }
  const sections = [];
  for (const atom of atoms.values()) {
    const heading = atom.heading_path.slice(2).join(' — ') || term;
    if (sections.at(-1)?.heading === heading) sections.at(-1).text += '\n' + atom.text;
    else sections.push({ heading, text: atom.text });
  }
  return { text: [...atoms.values()].map(a => a.text).join('\n'), sections };
}
const rows = [];
for (const m of manifest) {
  const raw = fs.readFileSync(path.join(E, m[2]));
  if (raw.length !== +m[3] || hash(raw) !== m[4]) throw Error('D4_STOP: ' + m[1] + ' hash');
  const trace = JSON.parse(raw);
  const get = stage => trace.records.find(r => r.stage === stage)?.data;
  const loop = get('loop-out'), route = get('route'), delivered = get('delivered').readerText;
  const cards = [...delivered.matchAll(/<book\b([^>]*)>([^<]*)<\/book>/gu)].map(c => ({
    title: c[2], atom: /\batom="([^"]*)"/u.exec(c[1])?.[1] || '',
    locator: /\bref="([^"]*)"/u.exec(c[1])?.[1] || '',
    text: Buffer.from(/\bmatn="([^"]*)"/u.exec(c[1])?.[1] || '', 'base64').toString('utf8'),
  }));
  const prompts = trace.records.filter(r => r.stage === 'fetch' && r.data.req?.kind === 'provider').map(r => r.data.req.lastText || '');
  const materials = loop.evidence.map(e => {
    const candidates = [];
    const local = corpus.find(c => c.id === e.id);
    if (local) {
      const a = articleFor(local.term, e.volume);
      if (a.text.length === e.chars) candidates.push({ text: a.text,
        writerText: selectPinnedText({ title: e.title, fullText: a.text, articleSections: a.sections }, route.question), origin: 'recorded D2 article pages (exact character count)' });
      candidates.push({ text: local.search, origin: 'local encyclopedia corpus' });
    }
    for (const oldRow of oldMaterials.filter(r => r.id && r.id === e.id)) candidates.push({ text: oldRow.fullText || oldRow.text, writerText: oldRow.writerText, origin: 'D3C recorded material, same ID' });
    for (const card of cards.filter(c => c.atom === String(e.id).replace(/^lib:/u, '')
      || c.title === e.book && c.locator === e.locator || e.kind === 'encyclopedia' && c.title.endsWith('ج' + e.volume))) {
      candidates.push({ text: card.text, origin: 'recorded delivered card' });
    }
    for (const prompt of prompts) {
      const re = new RegExp('\\[\\[' + e.ref + '\\]\\][^\\n]*\\n(?:النص: )?([\\s\\S]*?)(?=\\n\\n(?:───|\\[\\[|قواعد)|$)');
      const match = re.exec(prompt);
      if (match) candidates.push({ text: match[1].trimEnd(), origin: 'recorded provider prompt (may be capped)' });
      const row = new RegExp('(?:^|\\n)ROW_' + e.ref + '[^\\n]*\\n([\\s\\S]*?)(?=\\nROW_\\d|\\n\\nالجمل|$)').exec(prompt);
      if (row) candidates.push({ text: row[1].trimEnd(), origin: 'recorded sentence-review prompt (may be capped)' });
    }
    candidates.sort((a, b) => (b.text.length === e.chars) - (a.text.length === e.chars) || b.text.length - a.text.length);
    const material = candidates[0] || { text: '', origin: 'unavailable; never invented' };
    return { ...e, text: material.text, fullText: material.text, writerText: material.writerText || material.text,
      origin: material.origin, availableChars: material.text.length,
      recordId: e.id, bookTitle: e.book, subjectId: e.subject, part: e.volume,
      publisher: e.kind === 'encyclopedia' ? 'الموسوعة الفقهية الكويتية' : '',
      locatorSpan: { volume: e.volume, pageStart: e.page, pageEnd: e.pageEnd } };
  });
  const hits = trace.records.filter(r => r.stage === 'fetch' && r.data.req?.url?.includes('lib.ezik.app'))
    .flatMap(r => (r.data.res?.hits || []).map(h => {
      const recovered = atoms.find(a => a.book === h.book && a.fullText.length === h.chars && plain(a.fullText).startsWith(plain(h.head)));
      const material = materials.find(e => e.id === 'lib:' + h.id && e.fullText.length === h.chars && plain(e.fullText).startsWith(plain(h.head)));
      return { ...h, seq: r.seq, query: r.data.req.body?.q, fullText: recovered?.fullText || material?.fullText || '' };
    }));
  const writer = trace.records.find(r => r.stage === 'call' && r.data.text === get('draft').draft)
    || trace.records.findLast(r => r.stage === 'call' && r.seq < trace.records.find(r => r.stage === 'draft').seq);
  rows.push({ id: m[1], traceBytes: raw.length, traceSha256: hash(raw), question: route.question,
    mode: get('tier').readerMode, route, draft: get('draft').draft,
    maxTokens: get('free-brain').maxTokens,
    writer: { ms: writer.data.ms, outTokens: writer.data.outTokens, stop: writer.data.stop,
      elapsed: trace.timers.find(r => r.seq === writer.seq)?.t || writer.data.ms },
    calls: trace.records.filter(r => r.stage === 'call' && ['cite-retry', 'empty-retry'].includes(r.data.phase)).map(r => ({ phase: r.data.phase, text: r.data.text, stop: r.data.stop, ms: r.data.ms, outTokens: r.data.outTokens })),
    materials, hits, recordedLoop: loop.text, recordedTruncated: loop.truncated,
    recordedFinalizer: get('finalizer'), recordedDelivered: delivered });
}
const liveReport = fs.readFileSync(path.join(E, 'EZIK-ACCEPT-LIVE-VS-PREVIEW-2026-09-26.md'));
const live = [21, 30].map(q => {
  const section = new RegExp('### ' + q + ' [^\\n]*الحيّ[^\\n]*\\n([\\s\\S]*?)(?=\\n###|$)').exec(liveReport.toString())?.[1];
  const renderedText = /```[^\n]*\n([\s\S]*?)```/.exec(section || '')?.[1];
  if (!renderedText) throw Error('Missing recorded live Q' + q);
  // UI annotations are not answer prose: lesson numbers must not certify enumeration.
  const text = renderedText.split('\n').filter(line => !/^\[(?:بطاقة|بطاقات|أزرار|اقتراحات|دروس ذات صلة|شريط)\]/u.test(line)).join('\n').trim();
  return { id: 'live-Q' + q, question: rows.find(r => r.id === 'Q' + q).question, text, renderedText };
});
const output = { base: 'f412ecc3ac82bd61ab50dd2c03a5b5222bc21872', diagnosisSeal: seal[0].trim(),
  method: 'Saved writer drafts, recorded source bytes only. BEFORE_WRITING_V1 door skipped. Missing material is explicitly identified; no invented source or network call.',
  liveReportSha256: hash(liveReport), live, rows };
fs.writeFileSync(path.join(root, 'guards/fixtures/d4-recorded.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ diagnosisVerified: true, tracesVerified: rows.length, live: live.map(r => r.id),
  coverage: rows.map(r => ({ id: r.id, materials: r.materials.map(m => ({ ref: m.ref, recorded: m.chars, recovered: m.availableChars, origin: m.origin })), hits: r.hits.length, fullHits: r.hits.filter(h => h.fullText).length })) }, null, 2));
