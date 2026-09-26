'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/d4-recorded.json'), 'utf8'));
const changed = ['lib/free-brain/loop.js', 'lib/takhrij.js', 'lib/takhrij-lock.js',
  'lib/finalize-reader-text.js', 'lib/reader-card-material.js', 'api/ask.js'];
const env = { BEFORE_WRITING_V1: 'off', FULL_ANSWER_V1: 'on', TAKHRIJ_V1: 'on', STREAM_V1: 'off' };
let blocked = 0;
const deny = () => { blocked++; throw Error('D4 offline: network forbidden'); };
for (const mod of ['node:http', 'node:https']) {
  const m = require(mod); m.request = deny; m.get = deny;
}
const net = require('node:net'); net.connect = deny; net.createConnection = deny; net.Socket.prototype.connect = deny;
require('node:tls').connect = deny;
globalThis.fetch = deny;

async function load(label = 'after') {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'd4-' + label + '-'));
  fs.writeFileSync(path.join(temp, 'package.json'), '{"type":"module"}\n');
  for (const rel of changed) {
    let source = label === 'before'
      ? cp.execFileSync('git', ['show', data.base + ':' + rel], { cwd: root, encoding: 'utf8', maxBuffer: 10_000_000 })
      : fs.readFileSync(path.join(root, rel), 'utf8');
    if (rel === 'lib/free-brain/loop.js') {
      const anchor = 'const table = createEvidenceTable();';
      if (source.split(anchor).length !== 2) throw Error('D4 seed seam moved');
      // The only replay instrumentation: restore the recorded retrieval snapshot before the
      // recorded writer draft. No reviewer, repair, retry, or truncation decision is patched.
      source = source.replace(anchor, anchor + '\n  for (const row of globalThis.__d4Materials || []) table.rows.push({ ...row });');
    }
    source = source.replace(/((?:from\s+|import\s*\(?\s*)['"])(\.\.?\/[^'"]+)(['"])/g, (_, lead, spec, tail) => {
      const full = path.resolve(root, path.dirname(rel), spec);
      const relative = path.relative(root, full).replaceAll('\\', '/');
      return lead + pathToFileURL(changed.includes(relative) ? path.join(temp, relative) : full).href + tail;
    });
    const dest = path.join(temp, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, source);
  }
  const [loop, tk, lock, finalizer, cards, ask] = await Promise.all(changed.map(rel => import(pathToFileURL(path.join(temp, rel)))));
  const instructions = await import(pathToFileURL(path.join(root, 'lib/free-brain/instructions.js')));
  return { loop, tk, lock, finalizer, cards, ask, instructions, label, temp };
}

const lookupFor = row => async (matns, options = {}) => matns.map(matn => {
  const hits = row.hits.filter(h => h.fullText && (!options.bookIds?.length || options.bookIds.includes(h.book)));
  return { matn, atoms: hits.map(h => h.fullText), subjectIds: hits.map(h => h.book) };
});

async function replay(mod, row) {
  const { loop, tk, lock, finalizer, ask, cards } = mod;
  globalThis.__d4Materials = row.materials;
  let served = 0;
  const completions = [{ phase: 'write', text: row.draft, ...row.writer }, ...row.calls];
  const replayedCalls = [], unavailableCalls = [];
  const realNow = Date.now, startedAt = realNow();
  let now = startedAt;
  Date.now = () => now;
  globalThis.fetch = async (url, request) => {
    if (url !== 'offline:d4-recorded-writer') return deny();
    const body = JSON.parse(request.body);
    const last = body.messages.at(-1)?.content;
    const phase = served === 0 ? 'write'
      : typeof last === 'string' && last.startsWith(mod.instructions.CITATION_RETRY_NOTE) ? 'cite-retry'
      : last === mod.instructions.EMPTY_RETRY_NOTE ? 'empty-retry' : 'unrecorded-rewrite';
    const record = completions.find(r => r.phase === phase);
    if (!record) { unavailableCalls.push(phase); throw Error('D4: no recorded completion for ' + phase); }
    served++;
    now += record.ms || 0;
    replayedCalls.push(phase);
    return new Response(JSON.stringify({ id: 'recorded-' + served, type: 'message', role: 'assistant',
      content: [{ type: 'text', text: record.text }], stop_reason: record.stop, usage: { input_tokens: 0, output_tokens: record.outTokens || 0 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  let out;
  try {
    out = await loop.runFreeBrainTurn({ messages: [{ role: 'user', content: row.question }], system: '',
      model: 'offline-recorded', maxTokens: row.maxTokens, band: 'adult', mode: row.mode, lexicalRoute: 'DEEN',
      // Retrieval is already restored above; do not run a new retrieval policy against a saved draft.
      storedRuntime: '', beforeWriting: null, fullAnswer: { startedAt: startedAt - Math.max(0, row.writer.elapsed - row.writer.ms) }, env,
      providerUrl: 'offline:d4-recorded-writer', headers: {}, fetchImpl: deny });
  } finally { globalThis.fetch = deny; delete globalThis.__d4Materials; Date.now = realNow; }
  const pass = await tk.applyTakhrij(out.text, { env, question: row.question, lookup: lookupFor(row) });
  const prefix = pass.gradingHead + '\n\n';
  if (pass.gradingHead && pass.text.startsWith(prefix) && tk.headRestatedBy(pass.gradingHead, pass.text.slice(prefix.length))) pass.text = pass.text.slice(prefix.length);
  const proven = (pass.entries || []).flatMap(e => [
    ...(e.sealProof || []).map(book => ({ title: book, passage: book + ' ' + e.matn })),
    ...(e.proseProof || []).map(book => ({ proseProof: { book, matn: e.matn } })),
    ...(e.authenticityProof ? [{ authenticityProof: e.authenticityProof }] : []),
  ]);
  const sources = out.cited.map(r => ({ title: r.title, passage: cards.fullSourceMaterial(r) }));
  const sealed = lock.lockTakhrij(pass.text, [...sources, ...proven], { bracketAfterQuote: true });
  const options = { locations: true, question: row.question, coalesce: true };
  const readerCards = [...loop.pickReaderCards(out.cited, 3, r => ask.buildSourceTag({ url: r.url, title: r.title })),
    ...loop.pickBookCards(out.cited, 3, ask.buildBookTag, options), ...loop.pickEncyclopediaCards(out.cited, 3, ask.buildBookTag, options)];
  const final = finalizer.finalizeReaderText({ text: sealed.text, sources, takhrijProven: proven,
    readerCards, bracketAfterQuote: true, kind: 'answer' });
  return { id: row.id, question: row.question, draft: row.draft, loopText: out.text, truncated: out.truncated,
    incompleteStrip: out.truncated === true, rulingReview: out.rulingReview, replayedCalls, unavailableCalls,
    degraded: out.degraded, takhrij: pass, seal: sealed, finalizer: final, finalText: final.text,
    cards: readerCards, citedRefs: out.cited.map(r => r.ref), networkAttempts: blocked };
}

module.exports = { data, load, replay, lookupFor, env, networkAttempts: () => blocked };
