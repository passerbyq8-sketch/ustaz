// Local saved-data proof. No service, model or production endpoint is called.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { classifyReligiousRuntime } from '../../lib/stored-deen.js';
import { planAsk } from '../../lib/ask-plan.js';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const scratch = path.join(repo, 'node_modules/.cache/qaf-gap');
const session = process.argv[2];
const phase = process.argv[3] || '1a';
if (!session) throw new Error('Usage: node tools/qaf-gap/item-1-proof.mjs <saved-live-session>');
globalThis.fetch = () => { throw new Error('NETWORK_FORBIDDEN'); };
const digest = (data) => createHash('sha256').update(data).digest('hex');
const load = (file) => import(pathToFileURL(file).href);

// Instrument only proof copies: collect the exact units the real hold branch saw.
function instrument(root) {
  const from = path.join(root, 'lib/bw2-units.js');
  const source = fs.readFileSync(from, 'utf8');
  const anchor = '  const hold = (reason, unit) => {';
  if (source.split(anchor).length !== 2) throw new Error('Hold seam changed');
  const file = path.join(root, 'lib/bw2-units.qaf-proof.js');
  fs.writeFileSync(file, source.replace(anchor, anchor + '\n    globalThis.__qafGapHeld.push({ reason, text: unit?.body || "" });'), 'utf8');
  return file;
}
fs.mkdirSync(path.join(scratch, 'current'), { recursive: true });
fs.cpSync(path.join(repo, 'lib'), path.join(scratch, 'current/lib'), { recursive: true });
fs.copyFileSync(path.join(repo, 'package.json'), path.join(scratch, 'current/package.json'));
const baselineRoot = path.join(scratch, phase === '2' ? 'item-1b-baseline' : phase === '1b' ? 'item-1a-baseline' : 'baseline');
const currentRoot = path.join(scratch, 'current');
// The BW2 import graph also reaches the unchanged API search adapters.
for (const root of [baselineRoot, currentRoot]) fs.cpSync(path.join(repo, 'api'), path.join(root, 'api'), { recursive: true });
const before = await load(instrument(baselineRoot));
const after = await load(instrument(currentRoot));
const oldReview = await load(path.join(baselineRoot, 'lib/output-reviewer.js'));
const newReview = await load(path.join(repo, 'lib/output-reviewer.js'));

async function replay(module, text, question = '', runtimeOverride = '') {
  const held = [];
  globalThis.__qafGapHeld = held;
  const deltas = [];
  const runtime = runtimeOverride || classifyReligiousRuntime(question, planAsk([{ role: 'user', content: question }], { policyEnabled: true }), 'religious');
  const holdUncitedRulings = phase === '2' && (runtime === 'STORED_FIQH' || (module === after && runtime === 'HADITH'));
  const r = module.createBw2Releaser({ question, holdUncitedRulings, emit: (delta) => { deltas.push(delta); return true; } });
  for (const chunk of text.match(/[\s\S]{1,17}/gu) || []) r.push(chunk);
  const out = await r.end();
  if (deltas.join('') !== out.text) throw new Error('Wire differs from summary');
  return { held: out.held, released: out.released, holds: out.holds, text: out.text, heldUnits: [...held] };
}
const questionMap = new Map();
const sourceDir = 'C:/Users/passe/projects/ustaz-archive/_archive/2026-08/sessions';
const batteryFile = path.join(sourceDir, 'EZIK-BATTERY-ANSWERS-2026-08-17.txt');
const battery = fs.readFileSync(batteryFile, 'utf8').replace(/\r\n?/gu, '\n');
for (const match of battery.matchAll(/^={5,}\n(Q\d+)\n={5,}\n([\s\S]*?)(?=^---)/gmu)) {
  questionMap.set(match[1], match[2].trim());
}
const corpusBytes = fs.readFileSync(path.join(scratch, 'corpus.json'));
const corpus = JSON.parse(corpusBytes);
if (corpus.length !== 160) throw new Error('Expected 160 saved answers');
const regression = [];
let heldBefore = 0, heldAfter = 0, releasedBefore = 0, releasedAfter = 0;
for (const record of corpus) {
  // Repair asks the same numbered questions; the archived battery supplies their wording.
  const question = questionMap.get(record.qid) || '';
  const a = await replay(before, record.text, question);
  const b = await replay(after, record.text, question);
  heldBefore += a.held; heldAfter += b.held;
  releasedBefore += a.released; releasedAfter += b.released;
  if (a.text !== b.text || JSON.stringify(a.holds) !== JSON.stringify(b.holds)) {
    const oldUnits = new Set(a.heldUnits.map((unit) => unit.reason + '\0' + unit.text));
    regression.push({ id: record.id, question, before: a, after: b,
      addedHolds: b.heldUnits.filter((unit) => !oldUnits.has(unit.reason + '\0' + unit.text)) });
  }
}

const saved = [];
const inputs = [];
for (const group of ['a', 'b', 'c']) {
  const file = path.join(session, 'har', group + '-ezik.har');
  const bytes = fs.readFileSync(file);
  inputs.push({ file, sha256: digest(bytes) });
  const entries = JSON.parse(bytes).log.entries.filter((entry) => new URL(entry.request.url).pathname === '/api/ask');
  let n = 0;
  for (const entry of entries) {
    const id = group + (++n);
    const request = JSON.parse(entry.request.postData.text);
    const question = request.messages.at(-1).content;
    const events = entry.response.content.text.split(/\r?\n/gu).filter((line) => line.startsWith('data: '))
      .flatMap((line) => { try { return [JSON.parse(line.slice(6))]; } catch { return []; } });
    const text = events.filter((event) => event.type === 'content_block_delta').map((event) => event.delta?.text || '').join('');
    const markdownFile = path.join(session, 'answers', id + '-ezik.md');
    const md = fs.readFileSync(markdownFile, 'utf8');
    inputs.push({ file: markdownFile, sha256: digest(md) });
    const printed = md.split(/\r?\n---\r?\n/gu)[1]?.trim() || '';
    const retrieved = JSON.parse(fs.readFileSync(path.join(session, 'retrieval', id + '-ezik.json'), 'utf8'));
    const evidence = retrieved.cards.map((card) => ({ ...card, id: card.id, title: card.title, snippet: card.text || '', scholar: card.author, publisher: card.author }));
    const opts = { question, evidence, domain: 'fiqh', mode: request.mode };
    const a = oldReview.reviewAnswer({ ...opts, text });
    const b = newReview.reviewAnswer({ ...opts, text });
    const printedReview = newReview.reviewAnswer({ ...opts, text: printed });
    const savedRuntime = group === 'b' ? 'HADITH' : 'STORED_FIQH';
    const wireBefore = await replay(before, text, question, savedRuntime);
    const wireAfter = await replay(after, text, question, savedRuntime);
    saved.push({ id, question, text, before: a.verdict.selfContradiction, after: b.verdict.selfContradiction,
      gradeBefore: a.verdict.gradeConsistency || { detected: false }, gradeAfter: b.verdict.gradeConsistency,
      integrity: b.verdict.sentenceIntegrity, printed: { contradiction: printedReview.verdict.selfContradiction, integrity: printedReview.verdict.sentenceIntegrity },
      wireReplay: { before: wireBefore, after: wireAfter },
      limitation: 'Published wire has already stripped [[n]] and omitted the pinned table; unit replay is not a reconstruction of the original writer stream.' });
  }
}
const requiredContradictions = [];
const requiredIntegrity = ['b1', 'c2', 'a3', 'c3'];
const contradictionsCaught = requiredContradictions.filter((id) => saved.find((record) => record.id === id).after.detected);
const integrityCaught = requiredIntegrity.filter((id) => saved.find((record) => record.id === id).integrity.detected);
const result = { baseline: '5244c86dbedc65558320ffc8df7246ee5faa924a', inputs, corpus: { count: corpus.length, sha256: digest(corpusBytes),
  questionCount: questionMap.size, heldBefore, heldAfter, releasedBefore, releasedAfter, changes: regression }, saved,
  acceptance: { requiredContradictions, contradictionsCaught, requiredIntegrity, integrityCaught,
    passed: phase === '2' ? regression.every((record) => record.addedHolds.every((u) => ['uncited_ruling', 'dependent_on_held', 'dependent_opening'].includes(u.reason)))
      : phase === '1b' ? saved.find((record) => record.id === 'b3').gradeAfter.detected
      && !saved.find((record) => record.id === 'b1').gradeAfter.detected
      && !saved.find((record) => record.id === 'b2').gradeAfter.detected && regression.length === 0
      : !saved.find((record) => record.id === 'a2').after.detected && integrityCaught.length === 4
      && regression.every((record) => /:Q(?:17|20)\//u.test(record.id))
      && regression.some((record) => record.id.includes(':Q17/'))
      && regression.some((record) => record.id.includes(':Q20/')) } };
const output = path.join(scratch, phase === '2' ? 'item-2-proof.json' : phase === '1b' ? 'item-1b-proof.json' : 'item-1-proof.json');
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output, corpus: { count: corpus.length, heldBefore, heldAfter, releasedBefore, releasedAfter, changedAnswers: regression.length },
  saved: saved.map((record) => ({ id: record.id, contradiction: record.after, integrity: record.integrity })), acceptance: result.acceptance }, null, 2));
process.exitCode = result.acceptance.passed ? 0 : 1;
