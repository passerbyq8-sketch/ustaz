import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { turn } from './turn-harness.mjs';

globalThis.fetch = () => { throw new Error('NETWORK_FORBIDDEN'); };
const saved = JSON.parse(fs.readFileSync('node_modules/.cache/qaf-gap/item-1a-proof.json', 'utf8')).saved;
const baseline = await import(pathToFileURL(path.resolve('node_modules/.cache/qaf-gap/item-4-baseline/lib/before-writing-v2.js')).href);
const session = process.argv[2];
if (!session) throw new Error('Pass the saved live-session path');
const results = [];
for (const record of saved) {
  const cards = JSON.parse(fs.readFileSync(path.join(session, 'retrieval', record.id + '-ezik.json'), 'utf8')).cards;
  // These are the archived card passages, not a claimed reconstruction of the missing pinned table.
  const rows = cards.map((card) => ({ kind: card.kind === 'book' ? 'lib_book' : card.kind === 'lesson' ? 'lesson' : 'fatwa',
    title: card.title, bookTitle: card.kind === 'book' ? card.title : '', publisher: card.author,
    url: card.url || '', recordId: card.id, text: card.text || '' }));
  const opts = { question: record.question, text: record.text, rows,
    extra: { runtime: record.id.startsWith('b') ? 'HADITH' : 'STORED_FIQH' } };
  const before = await turn({ ...opts, run: baseline.runBw2Turn });
  const after = await turn(opts);
  const off = await turn({ ...opts, env: { BW2_DIRECT_EXIT: 'off' } });
  const wire = (r) => JSON.stringify(r.events.map(({ at, ...e }) => e));
  const same = before.sent === after.sent && before.sent === off.sent && wire(before) === wire(after) && wire(before) === wire(off);
  results.push({ id: record.id, same, writerCalls: [before.calls.writer.length, after.calls.writer.length, off.calls.writer.length],
    bytes: Buffer.byteLength(after.sent), sha256: createHash('sha256').update(wire(after)).digest('hex') });
}
const proof = { passed: results.every((r) => r.same), limitation: 'Saved writer text and archived card passages with deterministic model stubs; original pinned writer table/citations were not saved.', results };
fs.writeFileSync('node_modules/.cache/qaf-gap/item-5-proof.json', JSON.stringify(proof, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(proof, null, 2));
process.exitCode = proof.passed ? 0 : 1;
