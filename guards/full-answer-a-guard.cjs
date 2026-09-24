// guards/full-answer-a-guard.cjs -- م٣-أ (FULL_ANSWER_V1): a writing call that stops on the token cap
// is continued from its last whole sentence and reaches the reader whole, with no seam and no
// «لم يكتملْ»; when the function's clock cannot hold a continuation, none is made and the numbers
// are written.
//
// THE OWNER'S ITEM (program order 2026-09-24, م٣-أ; item 32, confirmed live the same day): both long
// «طالب علم» answers were cut, one mid-sentence and one on an empty heading, and skipped whole
// parts of the question. MEASURED on the production log: the tools-removed write stopped on
// `max_tokens` at 6144 tokens (60.9 s, 103.9 s). Reproduced offline on this tree
// (program-2026-09-24/03-answer/measure/A-continue.md).
//
// WHAT THIS PINS:
//   C1  the tools-removed write capped: ONE continuation call, no `tools`, not streamed, whose last
//       two turns are the draft cut back to its last whole sentence and CONTINUE_NOTE;
//   C2  the reader gets it whole: `truncated:false`, finish state `end_turn`, no <incomplete/>, the
//       ledger row `write-continue`, and `write_continue:done:1:end_turn:<ms>` in `degraded`;
//   C3  the seam: the cut fragment is gone, the sentence the model restated is read once, and the
//       halves are joined by the model's own whitespace;
//   C4  a heading left without its body goes with the cut and comes back once, with its body;
//   C5  an unstreamed prose round that capped is continued into the SAME written part: no
//       paragraph break falls inside the sentence;
//   C6  no time on the clock: no continuation is made, the draft goes out as today (truncated,
//       fragment and all), and `write_continue:no_time:<elapsed>:<available>` is written;
//   C7  at most two continuations; a second cap is delivered as truncated, and says so;
//   C8  the clock itself, on the two measured witnesses (lib/full-answer.js);
//   C9  after a continued draft, a whole-answer rewrite that no longer fits is refused
//       (`no_time_for:citation_retry`), and with time on the clock the same turn makes it;
//   C10 the switch off: no continuation, the draft is delivered cut and marked, as before.
// Red on the tree before this item (8c8450e): `node guards/full-answer-a-guard.cjs --root <tree>`.
'use strict';
const path = require('path');
const { pathToFileURL } = require('url');

const rootArg = process.argv.indexOf('--root');
const REPO = rootArg > 0 ? path.resolve(process.argv[rootArg + 1]) : path.join(__dirname, '..');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 500) : ''));
  return false;
}
async function quiet(fn) {
  const saved = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  console.log = () => {}; console.warn = () => {}; console.error = () => {}; console.info = () => {};
  try { return await fn(); } finally { Object.assign(console, saved); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jsonResponse = (url, obj, { status = 200 } = {}) => ({
  ok: status >= 200 && status < 300, status, url: String(url),
  headers: { get: (h) => {
    const k = String(h).toLowerCase();
    if (k === 'content-type') return 'application/json';
    if (k === 'content-length') return String(Buffer.byteLength(JSON.stringify(obj), 'utf8'));
    return null;
  } },
  json: async () => obj, text: async () => JSON.stringify(obj),
});
const reply = (text, stop, out = 6000) => ({
  content: text === null ? [] : [{ type: 'text', text }], stop_reason: stop,
  usage: { input_tokens: 1, output_tokens: out },
});

// A neutral, general-domain answer: nothing in it for the reviewer to attribute or refuse.
const S1 = 'أولًا: تقعُ المدينةُ على ساحلِ البحرِ الأحمر.';
const S2 = 'ثانيًا: يعتدلُ جوُّها في الشتاء.';
const FRAG = 'ثالثًا: أنسبُ أوقاتِ الزيارةِ يختلفُ بحسب';
const S3 = 'ثالثًا: أنسبُ أوقاتِ الزيارةِ أشهرُ الشتاء.';
const S4 = 'رابعًا: يحسنُ حجزُ السكنِ قبلَ الموسم.';
const DRAFT = `${S1}\n\n${S2}\n\n${FRAG}`;
const CONT = `${S2}\n\n${S3}\n\n${S4}`;
const HEAD_ONLY = `${S1}\n\n${S2}\n\nثالثًا: أنسبُ أوقاتِ الزيارة`;
const CONT_HEADING = `ثالثًا: أنسبُ أوقاتِ الزيارةِ أشهرُ الشتاءِ كلُّها.`;
const P1 = 'للرحلةِ طريقان. الأولى عبرَ الساحل.';
const PFRAG = ' والثانيةُ أن';
const PCONT = 'والثانيةُ أنْ تسلكَ طريقَ الجبلِ المارَّ بالقرى.';

async function main() {
  console.log('full-answer-a guard — root ' + REPO);
  let LOOP = null, INS = null, FA = null, CONTRACT = null, ENC = null;
  try {
    LOOP = await esm('lib/free-brain/loop.js');
    INS = await esm('lib/free-brain/instructions.js');
    CONTRACT = await esm('lib/fatwa-contract.js');
    ENC = await esm('lib/encyclopedia.js');
  } catch (e) { ok('C0  the modules load', false, e.message); }
  try { FA = await esm('lib/full-answer.js'); } catch (e) { FA = null; }
  if (!LOOP || !INS || !CONTRACT || !ENC) { console.log(`\n=== full-answer-a: ${checks - failures}/${checks} PASS ===`); process.exit(1); }
  const NOTE = INS.CONTINUE_NOTE;
  const isCont = (body) => {
    const last = (body.messages || [])[(body.messages || []).length - 1];
    return !!NOTE && !!last && last.role === 'user' && last.content === NOTE;
  };
  const isCite = (body) => {
    const last = (body.messages || [])[(body.messages || []).length - 1];
    return !!last && last.role === 'user' && last.content === INS.CITATION_RETRY_NOTE;
  };
  await quiet(() => ENC.searchStoredCorpus('الوضوء', { limit: 1 }));
  const scholars = CONTRACT.FATWA_SCHOLARS.map((entry) => ({ id: entry.id, snapshot: { records: entry.count } }));
  const fatwaRecord = {
    id: 'g-1', uid: 'binbaz:g-1', scholar: { id: 'binbaz' }, source: { url: 'https://binbaz.org.sa/fatwas/9999/g' },
    title: 'حكم خروج الدم الكثير من البدن هل ينقض الوضوء',
    content: { type: 'question_answer', question: 'هل خروج الدم الكثير من غير السبيلين ينقض الوضوء؟',
      answer: 'خروج الدم من غير السبيلين لا ينقض الوضوء على الصحيح وإن كثر.' },
  };
  const fetchImpl = async (url) => {
    const u = String(url);
    if (u.startsWith('https://lib.ezik.app')) return jsonResponse(u, { hits: [], took_ms: 1, refused: false });
    if (u.startsWith(CONTRACT.FATWA_BASE + '/api/v1/')) {
      const p = new URL(u).pathname;
      if (p === '/api/v1/health') return jsonResponse(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, counts: { scholars: scholars.length } });
      if (p === '/api/v1/scholars') return jsonResponse(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, scholars });
      return jsonResponse(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, results: [fatwaRecord], pagination: { total: 1 } });
    }
    return jsonResponse(u, {}, { status: 503 });
  };

  // `route(body)` answers one provider call; every body is kept in order.
  const drive = async (route, extra) => {
    const provider = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (u.startsWith('https://provider.invalid')) {
        const body = JSON.parse(init.body);
        provider.push(body);
        const r = route(body, provider.length);
        if (r && r.delayMs) await sleep(r.delayMs);
        return jsonResponse(u, r.payload || r);
      }
      return jsonResponse(u, {}, { status: 503 });
    };
    let out = null;
    try {
      out = await quiet(() => LOOP.runFreeBrainTurn(Object.assign({
        messages: [{ role: 'user', content: 'ما الذي ينبغي أن أعرفه قبل زيارة المدينة؟' }],
        system: 'system', model: 'model', maxTokens: 512, effort: 'high', band: 'adult', mode: 'chat',
        lexicalRoute: 'GENERAL', storedRuntime: '',
        providerUrl: 'https://provider.invalid/v1/messages', headers: {}, env: {}, fetchImpl,
      }, extra)));
    } catch (e) { out = { threw: String(e && e.stack || e) }; }
    finally { globalThis.fetch = realFetch; }
    return { out: out || {}, provider };
  };
  const ON = (startedAt = Date.now()) => ({ fullAnswer: { startedAt } });
  // The tool round writes nothing, so the tools-removed write runs; that write caps.
  const writeCaps = (draft, cont, contStop = 'end_turn') => (body) => {
    if (isCont(body)) return reply(cont, contStop, 700);
    if (Array.isArray(body.tools)) return reply(null, 'end_turn', 1);
    return reply(draft, 'max_tokens', 6000);
  };

  // ── C1-C3 ─────────────────────────────────────────────────────────────────
  const a = await drive(writeCaps(DRAFT, CONT), ON());
  const conts = a.provider.filter(isCont);
  const c = conts[0] || { messages: [] };
  const lastTwo = c.messages.slice(-2);
  const headSent = lastTwo[0] && lastTwo[0].role === 'assistant' ? String(lastTwo[0].content) : '';
  ok('C1  the capped write is continued by ONE call: no tools, unstreamed, draft cut to its last whole sentence + CONTINUE_NOTE',
    typeof NOTE === 'string' && NOTE.length > 0 && conts.length === 1 && !('tools' in c) && c.stream === false
    && headSent === `${S1}\n\n${S2}` && lastTwo[1] && lastTwo[1].role === 'user' && lastTwo[1].content === NOTE
    && c.max_tokens > 0 && c.max_tokens <= LOOP.outputBudget(512),
    JSON.stringify({ calls: a.provider.length, conts: conts.length, head: headSent.slice(-40), threw: a.out.threw }));
  const text = String(a.out.text || '');
  ok('C2  the reader gets it whole: truncated:false, end_turn, no <incomplete/>, a write-continue row, and the numbers',
    a.out.truncated === false && a.out.deliveredStop === 'end_turn' && !text.includes('<incomplete')
    && a.out.writeContinuations === 1
    && (a.out.roundLedger || []).some((row) => row.phase === 'write-continue')
    && (a.out.degraded || []).some((d) => /^write_continue:done:1:end_turn:\d+$/u.test(d)),
    JSON.stringify({ truncated: a.out.truncated, stop: a.out.deliveredStop, n: a.out.writeContinuations, degraded: a.out.degraded, threw: a.out.threw }));
  const count = (hay, needle) => hay.split(needle).length - 1;
  // The seam is read twice: on the two functions that make it (the join itself, before the reader's
  // layout puts each sentence on its own line), and on the delivered text, whatever its layout.
  const seam = typeof LOOP.continuationHead === 'function' ? LOOP.continuationHead(DRAFT) : null;
  const rest = typeof LOOP.withoutRestatedTail === 'function' && seam ? LOOP.withoutRestatedTail(seam.head, CONT) : null;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  ok('C3  the seam: the fragment is gone, the restated sentence is read once, joined by the model\'s own whitespace',
    !!seam && seam.head === `${S1}\n\n${S2}` && seam.sep === '\n\n' && rest === `${S3}\n\n${S4}`
    && LOOP.continuationHead('بلا جملةٍ تامّة') === null
    && !text.includes('يختلفُ بحسب') && count(text, S2) === 1
    && new RegExp(`${esc(S2)}\\s+${esc(S3)}\\s+${esc(S4)}`, 'u').test(text),
    JSON.stringify({ seam, rest, text }));

  // ── C4 heading without its body ───────────────────────────────────────────
  const h = await drive(writeCaps(HEAD_ONLY, CONT_HEADING), ON());
  const hText = String(h.out.text || '');
  const hc = h.provider.filter(isCont)[0] || { messages: [] };
  const hHead = String((hc.messages.slice(-2)[0] || {}).content || '');
  ok('C4  a heading left without its body goes with the cut and comes back once, with its body',
    hHead === `${S1}\n\n${S2}` && count(hText, 'ثالثًا') === 1 && hText.includes(CONT_HEADING) && h.out.truncated === false,
    JSON.stringify({ head: hHead.slice(-30), text: hText }));

  // ── C5 unstreamed prose round ─────────────────────────────────────────────
  const p = await drive((body) => {
    if (isCont(body)) return reply(PCONT, 'end_turn', 300);
    return reply(P1 + PFRAG, 'max_tokens', 6000);
  }, ON());
  const pText = String(p.out.text || '');
  const pc = p.provider.filter(isCont)[0] || {};
  // Pushed as a part of its own, joinRoundTexts would have delivered «… والثانيةُ أن» and then, after a
  // paragraph break, the continuation: the fragment twice over and a break inside the sentence.
  const pSeam = typeof LOOP.continuationHead === 'function' ? LOOP.continuationHead(P1 + PFRAG) : null;
  ok('C5  an unstreamed prose round that capped is continued into the same part: no break inside the sentence',
    p.provider.filter(isCont).length === 1 && !('tools' in pc) && Array.isArray(p.provider[0].tools)
    && !!pSeam && pSeam.head === P1 && pSeam.sep === ' '
    && count(pText, 'والثانيةُ') === 1 && /الساحل\.\s+والثانيةُ أنْ تسلكَ/u.test(pText) && p.out.truncated === false,
    JSON.stringify({ calls: p.provider.length, pSeam, text: pText, degraded: p.out.degraded }));

  // ── C6 no time ────────────────────────────────────────────────────────────
  const late = await drive(writeCaps(DRAFT, CONT), ON(Date.now() - 284_000));
  const lText = String(late.out.text || '');
  ok('C6  no time on the clock: no continuation, the draft goes out as today, and the numbers are written',
    late.provider.filter(isCont).length === 0 && late.out.truncated === true && late.out.deliveredStop === 'max_tokens'
    && lText.includes('يختلفُ بحسب') && (late.out.degraded || []).some((d) => /^write_continue:no_time:\d+:-?\d+$/u.test(d)),
    JSON.stringify({ conts: late.provider.filter(isCont).length, truncated: late.out.truncated, degraded: late.out.degraded }));

  // ── C7 capped twice ───────────────────────────────────────────────────────
  let k = 0;
  const twice = await drive((body) => {
    if (isCont(body)) { k += 1; return reply(`${k === 1 ? S3 : S4} ولكنْ ينبغي`, 'max_tokens', 6000); }
    if (Array.isArray(body.tools)) return reply(null, 'end_turn', 1);
    return reply(DRAFT, 'max_tokens', 6000);
  }, ON());
  ok('C7  at most two continuations; a second cap is delivered as truncated and says so',
    twice.provider.filter(isCont).length === 2 && twice.out.writeContinuations === 2 && twice.out.truncated === true
    && (twice.out.degraded || []).some((d) => /^write_continue:done:2:max_tokens:\d+$/u.test(d)),
    JSON.stringify({ conts: twice.provider.filter(isCont).length, degraded: twice.out.degraded }));

  // ── C8 the clock, on the two measured witnesses ───────────────────────────
  let clockOk = false, clockDetail = 'lib/full-answer.js missing';
  if (FA) {
    const travel = FA.continuationClock({ startedAt: 0, now: 97_100, rate: 6144 / 60_894, maxTokens: 6144 });
    const zakat = FA.continuationClock({ startedAt: 0, now: 157_600, rate: 6144 / 103_852, maxTokens: 6144 });
    const tooLate = FA.continuationClock({ startedAt: 0, now: 270_000, rate: 6144 / 103_852, maxTokens: 6144 });
    const rewriteFits = FA.rewriteClock({ startedAt: 0, now: 170_000, rate: 6144 / 103_852, maxTokens: 6144 });
    const rewriteLate = FA.rewriteClock({ startedAt: 0, now: 180_000, rate: 6144 / 103_852, maxTokens: 6144 });
    clockOk = travel.ok && travel.maxTokens === 6144 && zakat.ok && zakat.maxTokens === 6144
      && !tooLate.ok && rewriteFits.ok && !rewriteLate.ok
      && FA.writingRate(0, 100) === FA.FULL_ANSWER_FALLBACK_RATE;
    clockDetail = JSON.stringify({ travel, zakat, tooLate, rewriteFits, rewriteLate });
  }
  ok('C8  the clock: both witnesses may continue at 97 s and 158 s, not at 270 s; a rewrite fits at 170 s, not at 180 s',
    clockOk, clockDetail);

  // ── C9 a whole-answer rewrite after a continued draft ─────────────────────
  // A before-writing fiqh turn: pinned rows, an uncited draft, so the citation retry is wanted.
  const BW = { beforeWriting: { libFlagValue: 'on', libToken: 'tk-guard-fa' } };
  const fiqhRoute = (body) => {
    if (body.system !== 'system') return reply('{}', 'end_turn', 5);
    if (isCont(body)) return reply('وهو قولُ أكثرِ أهلِ العلم.', 'end_turn', 50);
    if (isCite(body)) return reply('لا ينقض [[1]].', 'end_turn', 50);
    return { delayMs: 100, payload: reply('خروجُ الدمِ لا ينقضُ الوضوء. والدليلُ على ذلك أن', 'max_tokens', 50) };
  };
  const fiqhArgs = (startedAt) => Object.assign({
    messages: [{ role: 'user', content: 'تبرعت بالدم وأنا على وضوء، هل خروج الدم الكثير ينقض الوضوء؟' }],
    lexicalRoute: 'DEEN', storedRuntime: 'STORED_FIQH',
  }, BW, ON(startedAt));
  // ~9 s left after the ruling reserve: room for a continuation, none for a full rewrite at ~0.5 tok/ms.
  const tight = FA ? await drive(fiqhRoute, fiqhArgs(Date.now()
    - (FA.FULL_ANSWER_HARD_MS - FA.FULL_ANSWER_POST_MS - FA.FULL_ANSWER_RULING_RESERVE_MS - 9_000))) : { out: {}, provider: [] };
  const roomy = await drive(fiqhRoute, fiqhArgs(Date.now()));
  ok('C9  after a continued draft, a rewrite that no longer fits is refused by name; with time the same turn makes it',
    tight.provider.filter(isCont).length === 1 && tight.provider.filter(isCite).length === 0
    && (tight.out.degraded || []).some((d) => d.startsWith('write_continue:no_time_for:citation_retry:'))
    && roomy.provider.filter(isCont).length === 1 && roomy.provider.filter(isCite).length === 1,
    JSON.stringify({ tight: { conts: tight.provider.filter(isCont).length, cites: tight.provider.filter(isCite).length, degraded: tight.out.degraded },
      roomy: { conts: roomy.provider.filter(isCont).length, cites: roomy.provider.filter(isCite).length } }));

  // ── C10 the switch off ────────────────────────────────────────────────────
  const off = await drive(writeCaps(DRAFT, CONT), {});
  ok('C10 the switch off: no continuation, the draft is delivered cut and marked, as before',
    off.provider.filter((b) => (b.messages || []).some((m) => m.role === 'assistant' && typeof m.content === 'string')).length === 0
    && off.out.truncated === true && off.out.deliveredStop === 'max_tokens' && String(off.out.text || '').includes('يختلفُ بحسب')
    && !(off.out.degraded || []).some((d) => d.startsWith('write_continue')),
    JSON.stringify({ calls: off.provider.length, truncated: off.out.truncated, degraded: off.out.degraded }));

  console.log(`\n=== full-answer-a: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
