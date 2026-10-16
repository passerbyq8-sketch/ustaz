// guards/brain-line-o1-guard.cjs -- ITEM O1 (91) -- 2026-10-15 brain-line
//
// ONE RECORD FOR EVERY ANSWER. Measured on 7ba44481 (side-brain-line-2026-10-15/items/91.md): what an answer did lived
// only in scattered stdout lines, and nothing joined them to one answer or kept them past the platform's log retention.
//
// What this guard holds (the order, O1; the owner's decision b):
//   (1) a fake record from EVERY path of the closed list has the whole schema, and no field can carry text: Arabic,
//       a sentence or the question itself never reaches the stored JSON;
//   (2) `fp` is 16 hex digits of a keyed HMAC of the normalised question, and is absent without ANSWER_LOG_KEY;
//   (3) the record and its day index go to the app's own store (lib/ledger/redis.js, a test client here): 30 days, the
//       index trimmed to the newest 3000;
//   (4) api/ask.js opens the record above the language gate, taps the reader's stream, notes each path, and writes it
//       once in a `finally`; and guards/telemetry-text-guard.cjs, which sweeps the note() calls, is green.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
let failures = 0;
let checks = 0;
function ok(name, cond, detail) {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}

// A test Upstash client: the five calls lib/ledger/redis.js makes, on a Map.
function fakeUpstash() {
  const kv = new Map();
  const ttl = new Map();
  return {
    kv, ttl,
    async get(k) { return kv.has(k) ? kv.get(k) : null; },
    async set(k, v, opts) { kv.set(k, v); if (opts && opts.ex) ttl.set(k, opts.ex); return 'OK'; },
    async lpush(k, v) { const l = kv.get(k) || []; l.unshift(v); kv.set(k, l); return l.length; },
    async ltrim(k, a, b) { const l = kv.get(k) || []; kv.set(k, l.slice(a, b + 1)); return 'OK'; },
    async lrange(k, a, b) { return (kv.get(k) || []).slice(a, b + 1); },
    async expire(k, sec) { ttl.set(k, sec); return 1; },
  };
}
function fakeRes() {
  const out = [];
  return { out, write(c) { out.push(String(c)); return true; }, end(c) { if (c) out.push(String(c)); this.ended = true; } };
}
const frame = (e) => 'data: ' + JSON.stringify(e) + '\n\n';
const QUESTION = 'ما حكمُ الفطرِ في رمضانَ لمريضِ السكّري؟';

(async () => {
  const AL = await esm('lib/answer-log.js');
  const REDIS = await esm('lib/ledger/redis.js');
  const FIELDS = AL.ANSWER_LOG_FIELDS || [];
  console.log('-- 1. a record from every path: the whole schema, no text');
  ok('the closed path list is the order\'s ten', JSON.stringify(AL.ANSWER_LOG_PATHS) === JSON.stringify(['bw2', 'free-brain', 'legacy-gen', 'legacy-deen', 'stored', 'hybrid', 'ledger', 'world', 'closed', 'canned']));
  for (const p of AL.ANSWER_LOG_PATHS || []) {
    let t = 1000;
    const log = AL.createAnswerLog({ question: QUESTION, lang: 'ar', translated: false, key: 'k-test', now: () => t, trace: 'trace' + p.replace(/-/g, '') });
    const res = log.tap(fakeRes());
    log.note({ route: 'DEEN', runtime: 'STORED_FIQH', path: p, depth: 'normal', hits: { fatwa: 3, library: [1, 2], 'نص': 9 }, held: { unsupportedMatn: 2 }, cited: 2, flags: ['live_offer', 'جملة عربية', QUESTION] });
    res.write(frame({ type: 'ezik_status', stage: 'retrieve' }));
    t = 1800; res.write(frame({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'الجوابُ هنا. ' } }));
    t = 4300; res.write(frame({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'وتمامُه.' } }));
    res.write(frame({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 41 } }));
    res.end();
    const rec = log.record();
    const json = JSON.stringify(rec);
    const keys = Object.keys(rec).sort();
    ok(p + ': the whole schema (every field, fp included with a key)', JSON.stringify(keys) === JSON.stringify([...FIELDS].sort()), keys.join(','));
    ok(p + ': no Arabic and no question in the stored JSON', !/[؀-ۿ]/.test(json), json);
    ok(p + ': path, measures and stop as given', rec.path === p && rec.out_chars === 'الجوابُ هنا. وتمامُه.'.length && rec.first_byte_ms === 800
      && rec.max_gap_ms === 2500 && rec.status_events === 1 && rec.stop_reason === 'end_turn' && rec.out_tokens === 41
      && rec.hits.fatwa === 3 && rec.hits.library === 2 && rec.held.unsupportedMatn === 2 && rec.flags.join() === 'live_offer', json);
  }
  const bare = AL.createAnswerLog({ question: QUESTION, key: 'k', now: () => 5 });
  bare.note({ route: 'GEN' });
  ok('a record no site claimed falls to the legacy path of its route', bare.record().path === 'legacy-gen');

  console.log('-- 2. fp');
  const a = AL.createAnswerLog({ question: QUESTION, key: 'k-test' }).record();
  const b = AL.createAnswerLog({ question: 'ما حكم الفطر في رمضان لمريض السكري؟', key: 'k-test' }).record();
  const c = AL.createAnswerLog({ question: QUESTION, key: 'other-key' }).record();
  const none = AL.createAnswerLog({ question: QUESTION, key: '' }).record();
  ok('fp is 16 hex digits', /^[0-9a-f]{16}$/.test(a.fp || ''), String(a.fp));
  ok('...of the normalised question (the same without its tashkeel)', a.fp === b.fp);
  ok('...under the key (another key, another fp)', a.fp !== c.fp);
  ok('without the key the field is absent', !('fp' in none));
  ok('the question enters only as its length and words', a.q_chars === QUESTION.length && a.q_words === 7);

  console.log('-- 3. the store');
  const fake = fakeUpstash();
  REDIS.__setRedisForTest(fake);
  try {
    let wrote = 0;
    for (let i = 0; i < 3005; i += 1) {
      const log = AL.createAnswerLog({ question: 'q' + i, key: '', now: () => Date.UTC(2026, 9, 15, 12), trace: 'tr' + String(i).padStart(5, '0') });
      log.note({ path: i % 2 ? 'bw2' : 'free-brain' });
      if (await log.flush()) wrote += 1;
    }
    ok('every record written', wrote === 3005, String(wrote));
    const idx = fake.kv.get('al:v1:d:20261015') || [];
    ok('the day index is trimmed to the newest 3000', idx.length === 3000 && idx[0] === 'tr03004' && idx[2999] === 'tr00005', idx.length + ' ' + idx[0] + ' ' + idx[2999]);
    ok('record and index live 30 days', fake.ttl.get('al:v1:tr03004') === 30 * 86400 && fake.ttl.get('al:v1:d:20261015') === 30 * 86400);
    const read = await AL.readAnswerLog({ day: '20261015', path: 'bw2', limit: 5 });
    ok('a day read back, filtered by path, newest first', read.length === 5 && read.every((r) => r.path === 'bw2') && read[0].trace === 'tr03003', JSON.stringify(read.map((r) => r.trace)));
    const once = AL.createAnswerLog({ question: 'x', key: '', trace: 'onlyonce' });
    await once.flush(); await once.flush();
    ok('a record is written once', (fake.kv.get('al:v1:d:' + once.record().day) || []).filter((x) => x === 'onlyonce').length === 1);
    REDIS.__setRedisForTest(null);
    ok('no store: nothing fails, nothing is written', (await AL.createAnswerLog({ question: 'x', key: '' }).flush()) === false);
  } finally { REDIS.__resetRedis(); }

  console.log('-- 4. the wiring');
  const ask = fs.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
  ok('opened as the handler\'s first act, inside the gate the exported handler is',
    /export default async function handler\(req, res\) \{\n  return languageGate\(req, res, async function handler\(req, res\) \{\n(?: {2}\/\/.*\n)+ {2}return withAnswerLog\(req, res, async \(\) => \{\n/.test(ask));
  ok('...closed around the whole handler, with the gate\'s own language decision', /\n {2}\}, decideLanguage\);\n {2}\}\);\n\}\n$/.test(ask));
  {
    // withAnswerLog itself: opened, tapped, written once after run() -- also when run() throws.
    const fake = fakeUpstash();
    REDIS.__setRedisForTest(fake);
    try {
      const req = { method: 'POST', body: { messages: [{ role: 'user', content: QUESTION }] } };
      const res = fakeRes();
      let threw = false;
      try {
        await AL.withAnswerLog(req, res, async () => {
          req.__answerLog.note({ path: 'closed' });
          res.write(frame({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'نص' } }));
          throw new Error('x');
        }, () => ({ lang: 'ur', translate: true }));
      } catch { threw = true; }
      const stored = [...fake.kv.entries()].filter(([k]) => /^al:v1:[0-9a-f]{16}$/.test(k)).map(([, v]) => JSON.parse(v));
      ok('withAnswerLog writes one record even when the handler throws, with the gate\'s language',
        threw && stored.length === 1 && stored[0].path === 'closed' && stored[0].lang === 'ur' && stored[0].translated === true && stored[0].out_chars === 2,
        JSON.stringify(stored));
    } finally { REDIS.__resetRedis(); }
  }
  for (const [p, re] of [['canned', /answerLog\.note\(\{ path: 'canned'/], ['closed', /answerLog\.note\(\{ path: 'closed' \}\)/], ['bw2', /path: 'bw2',/],
    ['free-brain', /path: 'free-brain', hits: hitsFromSpend\(out\.spend\)/], ['stored/hybrid', /path: toLedger \? 'hybrid' : 'stored',/],
    ['world', /answerLog\.note\(\{ path: 'world'/], ['ledger', /answerLog\.note\(\{ path: 'ledger' \}\);\n      await runLedgerTurn/]]) {
    ok('the ' + p + ' path notes itself', re.test(ask));
  }
  ok('the route and the depth are noted', /answerLog\.note\(\{ route: effectiveRoute, runtime: currentRuntime \}\)/.test(ask) && /answerLog\.note\(\{ depth: instructionDepth \|\| 'normal' \}\)/.test(ask));
  ok('the sentence stream\'s counters reach the record', /held: out\.streamCounts \|\| \{\}/.test(ask)
    && /streamCounts: streamResult && streamResult\.counts/.test(fs.readFileSync(path.join(REPO, 'lib/free-brain/loop.js'), 'utf8')));
  const tg = spawnSync(process.execPath, [path.join(REPO, 'guards/telemetry-text-guard.cjs')], { encoding: 'utf8' });
  ok('guards/telemetry-text-guard.cjs is green, with the log\'s sink swept (section F)', tg.status === 0 && /F: every note\(\) field is a reviewed log field/.test(tg.stdout), (tg.stdout || '').slice(-300));
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-o1: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
