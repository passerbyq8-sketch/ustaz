// guards/full-answer-door-clock-guard.cjs -- ج٣ (order C, FULL_ANSWER_V1): every whole-answer rewrite door asks
// the function's clock before it starts, on every turn — the turn whose draft finished without a continuation
// included — so no door starts that cannot finish before the hard limit. Then ج١, ج٢ and the no-time roads
// already in the tree decide what the reader gets.
//
// THE GAP (report B §6.1 row 3; B1-MEASURE.md Missing 2; measured again on f03a93e in
// program-2026-09-24/10-order-c/c3/C3-MEASURE.md): on a turn whose draft ended whole, the doors' clock was
// never asked (`rewriteOutOfTime` returned at once when nothing had been continued). The witness: the draft
// ends whole at 249.6 s, the reject, empty and ascription doors each start a rewrite at 249.7 s with 30.3 s
// left, and the call ends at 310.6 s — past the 300 s kill, so the reader would get nothing.
//
// WHAT THIS PINS (the real runFreeBrainTurn, a scripted provider, a virtual clock; every call's end is
// recorded on the turn's own clock):
//   K1  the witness, reject: no door call; refused by name; the rejected sentence lifted whole (ج١); no call
//       ends past the hard limit;
//   K2  ascription, a sentence the correction can rewrite: no call; corrected in place;
//   K3  ascription, one it cannot: no call; lifted whole (ج٢);
//   K4  empty: no call; the hollow answer told «لم يكتملْ» (the no-time road already written);
//   K5  citation: no call; the answer as it stands, uncited, with no marker;
//   K6  (scope) a whole draft with time: the door runs and its clean rewrite is adopted;
//   K7  the clock plans with the draft's own writing speed, not the slowest fallback: a fast draft at 80 s
//       leaves time for its door;
//   K8  the switch off: the late door runs as before, and no clock is asked;
//   K9  a short hollow draft keeps its door: the speed is read net of the time to first token, and held
//       between the slowest planning speed and the fastest measured one;
//   K10 a 1000-token draft ending at 180 s keeps its door; K11 a before-writing turn's doors after the ruling
//       review are not charged the review's reserve; K12 the tools-removed write's own speed plans the door;
//   K13 a capped draft whose continuation did not fit is a turn nothing was continued on: its door is asked.
//   (K9-K13 answer the order-C review of this item.)
// Red on the tree before this item (f03a93e): `node guards/full-answer-door-clock-guard.cjs --root <tree>`.
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
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 700) : ''));
  return false;
}
async function quiet(fn) {
  const saved = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  console.log = () => {}; console.warn = () => {}; console.error = () => {}; console.info = () => {};
  try { return await fn(); } finally { Object.assign(console, saved); }
}

// ── THE VIRTUAL CLOCK ────────────────────────────────────────────────────────────────────────────
const realNow = Date.now.bind(Date);
let offset = 0;
Date.now = () => realNow() + offset;

// ── THE TEXTS: the doors' own fixtures, as guards/full-answer-doors-guard.cjs carries them ─────────
const NL = '\n';
const PARA = '\n\n';
const R = {
  head: 'الصلاة ركن من أركان الإسلام.',
  claim: 'الجمع للمسافر جائز عند الحاجة.',
  clean: 'الجمع للمسافر جائز عند الحاجة عند جمهور أهل العلم.',
  s3: 'والأفضلُ للمسافرِ أن يصلّيَ كلَّ صلاةٍ في وقتِها إن لم تلحقْه مشقّة، فإن شقَّ عليه ذلك جمعَ بين الظهرِ والعصرِ في وقتِ إحداهما.',
};
const SAYER_LINE = 'ولم أقفْ على نصٍّ يُسنِدُ هذا القولَ إلى قائلِه.';
const REJECT = { q: 'ما حكم الجمع للمسافر؟', whole: [R.head, 'ذكر ابن باز أن ' + R.claim, R.s3].join(NL), rewrite: [R.head, R.clean, R.s3].join(NL) };
const E = {
  frame: 'هذه صفة الوضوء كما وردت في السنة، فاعمل بها مطمئنا يا مساعد.',
  s2: 'وهي صفةٌ يسيرةٌ يقدرُ عليها كلُّ مسلم.',
  steps: ['1. غسل الكفين ثلاثا.', '2. المضمضة والاستنشاق.', '3. غسل الوجه ثلاثا.', '4. غسل اليدين إلى المرفقين ثلاثا.', '5. مسح الرأس والأذنين.', '6. غسل الرجلين إلى الكعبين.'],
};
const EMPTY = { q: 'اذكر لي خطوات الوضوء مرقمة', whole: E.frame + ' ' + E.s2, rewrite: E.steps.join(NL) };
const A = {
  frame: 'هدي النبي صلى الله عليه وسلم في ليله هدي معتدل، لا إفراط فيه ولا تفريط.',
  plain: 'وكان ينام نصف الليل، ويقوم ثلثه، وينام سدسه.',
  tail: 'وكان ينام نصف الليل، ويقوم ثلثه، وينام سدسه، وهذا من كمال هديه.',
  corrected: 'وكان داود عليه السلام ينام نصف الليل، ويقوم ثلثه، وينام سدسه.',
  block: '<hadith narrator="عبد الله بن عمرو رضي الله عنهما" ruling="متفق عليه">أحب الصلاة إلى الله صلاة داود عليه السلام، كان ينام نصف الليل، ويقوم ثلثه، وينام سدسه</hadith>',
  last: 'وفي هذا تعليم للأمة أن تأخذ من ليلها بنصيب.',
};
const ASC = (sentence) => ({ q: 'ما هدي النبي صلى الله عليه وسلم في يومه وليلته؟', whole: [A.frame, sentence, A.block, A.last].join(NL), rewrite: [A.frame, A.corrected, A.block, A.last].join(NL) });
const ASC_LINE = 'والذي في الحديث عن داود عليه السلام: «ينام نصف الليل، ويقوم ثلثه، وينام سدسه».';
const C = {
  s1: 'الوضوءُ شرطٌ لصحّةِ الصلاةِ عند أهلِ العلم.',
  s2: 'ولا تصحُّ صلاةٌ بغيرِ طهارةٍ مع القدرةِ عليها.',
  s3: 'وإذا عجزَ المسلمُ عن الماءِ تيمّمَ بالصعيدِ الطيّبِ وصلّى، ولا إعادةَ عليه على الصحيحِ من أقوالِ أهلِ العلم.',
  s4: 'والأحوطُ أن يطلبَ الماءَ في رحلِه وما قرُبَ منه قبلَ أن يتيمّم.',
};
const cited = (s) => s.replace(/\.$/u, ' [[1]].');
const CITE = { q: 'هل يجب الوضوء لمن أراد الصلاة وهو عادم للماء؟ بيّن الحكم', tool: 'الوضوء',
  whole: [C.s1, C.s2, C.s3, C.s4].join(PARA), rewrite: [cited(C.s1), cited(C.s2), cited(C.s3), C.s4].join(PARA) };

// The late-whole witness (B1-MEASURE.md Missing 2): everything before the loop took 200 s; the draft is
// written whole in 49.6 s (2000 tokens) and ends at 249.6 s; a door's rewrite would take 60.9 s more.
const LATE = { pre: 200000, draft: 49600, door: 60894 };
const HARD_MS = 285000;

async function main() {
  console.log('full-answer-door-clock guard — root ' + REPO);
  let LOOP = null, INS = null, ENC = null;
  try {
    LOOP = await esm('lib/free-brain/loop.js');
    INS = await esm('lib/free-brain/instructions.js');
    ENC = await esm('lib/encyclopedia.js');
  } catch (e) { ok('K0  the modules load', false, e.message); }
  if (!LOOP || !INS || !ENC) { console.log(`\n=== full-answer-door-clock: ${checks - failures}/${checks} PASS ===`); process.exit(1); }
  await quiet(() => ENC.searchStoredCorpus('الوضوء', { limit: 1 }));
  const CONT = INS.CONTINUE_NOTE || '@@no-continue-note@@';
  const NOTES = [
    ['cite', (u) => u === INS.CITATION_RETRY_NOTE],
    ['reject', (u) => u.startsWith(INS.REJECT_RETRY_NOTE)],
    ['empty', (u) => u.startsWith(INS.EMPTY_RETRY_NOTE)],
    ['ascription', (u) => u.startsWith(INS.ASCRIPTION_RETRY_NOTE)],
  ];
  const textOfMsg = (m) => (!m ? '' : typeof m.content === 'string' ? m.content
    : (m.content || []).filter((b) => b && b.type === 'text').map((b) => b.text).join('\n'));
  const classify = (body) => {
    const msgs = body.messages || [];
    const u = textOfMsg(msgs[msgs.length - 1]);
    if (Array.isArray(body.tools) && body.tools.length) return 'tool';
    let above = '';
    for (let i = msgs.length - 2; i >= 0 && !above; i -= 1) {
      if (msgs[i].role !== 'user') continue;
      const hit = NOTES.find(([, t]) => t(textOfMsg(msgs[i])));
      if (hit) above = hit[0];
    }
    if (u === CONT) return above ? `${above}-continue` : 'write-continue';
    const own = NOTES.find(([, t]) => t(u));
    if (own) return `${own[0]}-retry`;
    if ((body.max_tokens || 0) <= 2000) return 'aux';
    return 'write';
  };
  const hdrs = { get: (k) => (String(k).toLowerCase() === 'content-type' ? 'application/json' : null) };
  const fetchImpl = async (url) => ({ ok: false, status: 503, url: String(url), headers: hdrs, text: async () => '', json: async () => ({}) });
  // `times.draft` and `outTokens` set the draft call's speed; a door's rewrite answers whole in `times.door`.
  const drive = async ({ fx, pre, times, outTokens = 2000, flag = true, script = null, extra = {} }) => {
    const calls = [];
    const counts = {};
    const realFetch = globalThis.fetch;
    const turnStart = Date.now();
    const startedAt = turnStart - pre;
    globalThis.fetch = async (input, init = {}) => {
      const u = String(input?.url || input);
      if (!u.startsWith('https://provider.invalid')) return fetchImpl(u);
      const body = JSON.parse(String(init.body || '{}'));
      const kind = classify(body);
      counts[kind] = (counts[kind] || 0) + 1;
      let r = kind !== 'aux' && script ? script(kind, counts[kind]) : null;
      if (r) { /* the row's own script */ } else if (kind === 'aux') r = { text: 'DEEN', stop: 'end_turn', ms: 300 };
      else if (kind === 'tool' && fx.tool && counts.tool === 1) r = { tool: fx.tool, stop: 'tool_use', ms: 20254 };
      else if (kind === 'tool' || kind === 'write') r = { text: fx.whole, stop: 'end_turn', ms: times.draft, out: outTokens };
      else if (/-retry$/u.test(kind)) r = { text: fx.rewrite, stop: 'end_turn', ms: times.door, out: 2000 };
      else r = { text: fx.whole, stop: 'end_turn', ms: 3000, out: 500 };
      const content = r.tool ? [{ type: 'tool_use', id: `toolu_dc_${calls.length + 1}`, name: 'search_sources', input: { query: r.tool } }]
        : r.empty ? [] : [{ type: 'text', text: r.text }];
      const startMs = Date.now() - startedAt;
      offset += r.ms;
      calls.push({ kind, stop: r.stop, startMs, endMs: Date.now() - startedAt });
      const payload = { id: 'msg_dc', type: 'message', role: 'assistant', model: body.model, content, stop_reason: r.stop, usage: { input_tokens: 1000, output_tokens: r.out || 100 } };
      return { ok: true, status: 200, url: u, headers: hdrs, json: async () => payload, text: async () => JSON.stringify(payload) };
    };
    let out = null;
    try {
      out = await quiet(() => LOOP.runFreeBrainTurn({
        messages: [{ role: 'user', content: fx.q }],
        system: 'system', model: 'claude-opus-5', maxTokens: 4096, usePremium: true, effort: 'high',
        band: 'adult', mode: 'chat', lexicalRoute: 'DEEN', storedRuntime: '',
        providerUrl: 'https://provider.invalid/v1/messages', headers: {}, env: {}, fetchImpl,
        fullAnswer: flag ? { startedAt } : null,
        ...extra,
      }));
    } catch (e) { out = { threw: String(e && e.stack || e) }; }
    finally { globalThis.fetch = realFetch; }
    return { out: out || {}, calls, kinds: calls.map((c) => `${c.kind}:${c.stop}@${(c.startMs / 1000).toFixed(1)}-${(c.endMs / 1000).toFixed(1)}`) };
  };
  const deg = (r) => r.out.degraded || [];
  const has = (r, re) => deg(r).some((d) => re.test(d));
  const text = (r) => String(r.out.text || '');
  const brief = (r) => JSON.stringify({ kinds: r.kinds, truncated: r.out.truncated, degraded: deg(r), text: text(r).slice(0, 400), threw: r.out.threw });
  const noDoorCall = (r, door) => !r.calls.some((c) => c.kind.startsWith(door + '-'));
  const inTime = (r) => r.calls.every((c) => c.endMs <= HARD_MS);

  // ── K1 the witness, reject ──────────────────────────────────────────────────────────────────────
  const k1 = await drive({ fx: REJECT, pre: LATE.pre, times: LATE });
  ok('K1  reject, draft ended whole at 249.6 s: no door call, refused by name, the sentence lifted whole (ج١), no call past the limit',
    noDoorCall(k1, 'reject') && has(k1, /^write_continue:no_time_for:reject_retry:\d+:-?\d+$/u) && has(k1, /^reject_lifted:1:1:0$/u)
    && text(k1) === [R.head, SAYER_LINE, R.s3].join(NL) && k1.out.truncated === false && inTime(k1),
    brief(k1));

  // ── K2/K3 ascription ────────────────────────────────────────────────────────────────────────────
  const k2 = await drive({ fx: ASC(A.plain), pre: LATE.pre, times: LATE });
  ok('K2  ascription, a sentence the correction can rewrite: no door call, corrected in place',
    noDoorCall(k2, 'ascription') && has(k2, /^write_continue:no_time_for:ascription_retry:\d+:-?\d+$/u)
    && has(k2, /^ascription:corrected$/u) && text(k2).includes(A.corrected) && inTime(k2),
    brief(k2));
  const k3 = await drive({ fx: ASC(A.tail), pre: LATE.pre, times: LATE });
  ok('K3  ascription, one it cannot: no door call, lifted whole (ج٢)',
    noDoorCall(k3, 'ascription') && has(k3, /^ascription:lifted$/u) && text(k3).includes(ASC_LINE)
    && !text(k3).includes(A.tail) && inTime(k3),
    brief(k3));

  // ── K4 empty ────────────────────────────────────────────────────────────────────────────────────
  const k4 = await drive({ fx: EMPTY, pre: LATE.pre, times: LATE });
  ok('K4  empty: no door call, and the hollow answer is told «لم يكتملْ» (the no-time road already written)',
    noDoorCall(k4, 'empty') && has(k4, /^write_continue:no_time_for:empty_retry:\d+:-?\d+$/u)
    && has(k4, /^delivery_short:answer_without_substance:no_enumeration$/u) && k4.out.truncated === true && inTime(k4),
    brief(k4));

  // ── K5 citation ─────────────────────────────────────────────────────────────────────────────────
  const k5 = await drive({ fx: CITE, pre: LATE.pre - 20254, times: LATE });
  ok('K5  citation: no retry call, and the answer goes out as it stands, uncited, with no marker',
    noDoorCall(k5, 'cite') && has(k5, /^write_continue:no_time_for:citation_retry:\d+:-?\d+$/u)
    && text(k5).includes('في رحلِه') && k5.out.truncated === false && inTime(k5),
    brief(k5));

  // ── K6 scope: a whole draft with time ──────────────────────────────────────────────────────────
  const k6 = await drive({ fx: REJECT, pre: 5000, times: LATE });
  ok('K6  (scope) a whole draft with time: the door runs and its clean rewrite is adopted, as before',
    k6.calls.some((c) => c.kind === 'reject-retry') && has(k6, /^reject_retry:clean$/u) && !has(k6, /no_time_for/u)
    && text(k6).includes('جمهور أهل العلم'),
    brief(k6));

  // ── K7 the draft's own speed ────────────────────────────────────────────────────────────────────
  // 2000 tokens in 20 s (100 tok/s), ending at 80 s: a whole rewrite needs 2 + 61.4 s of the 200 s left. At
  // the slowest fallback (30 tok/s) it would need 206.8 s and be refused.
  const k7 = await drive({ fx: REJECT, pre: 60000, times: { draft: 20000, door: 30000 } });
  ok('K7  the clock plans with the draft\'s own writing speed: a fast draft at 80 s leaves time for its door',
    k7.calls.some((c) => c.kind === 'reject-retry') && has(k7, /^reject_retry:clean$/u) && !has(k7, /no_time_for/u),
    brief(k7));

  // ── K9–K13 the order-C review's witnesses ──────────────────────────────────────────────────────
  // K9 a short hollow draft (72 tokens in 2.255 s) at 92 s: its speed is its latency, not its writer. Net of the
  // time to first token and held at the fastest witness, the empty door still fits (a rewrite needs 62.9 s of
  // the 187.7 s left); counted with the latency twice it planned at 19-32 tok/s and was refused.
  const k9 = await drive({ fx: EMPTY, pre: 90000, times: { draft: 2255, door: 20000 }, outTokens: 72 });
  ok('K9  a short hollow draft at 92 s keeps its door: its speed is read net of the time to first token',
    k9.calls.some((c) => c.kind === 'empty-retry') && has(k9, /^empty_retry:filled$/u) && !has(k9, /no_time_for/u),
    brief(k9));
  // K10 a 1000-token draft written in 16.9 s, ending at 180 s: net 67 tok/s, a whole rewrite needs 93.6 s of 100.
  const k10 = await drive({ fx: REJECT, pre: 163100, times: { draft: 16900, door: 17000 }, outTokens: 1000 });
  ok('K10 a 1000-token draft ending at 180 s keeps its door (93.6 s needed of 100 left)',
    k10.calls.some((c) => c.kind === 'reject-retry') && has(k10, /^reject_retry:clean$/u) && !has(k10, /no_time_for/u) && inTime(k10),
    brief(k10));
  // K11 a before-writing fiqh turn: the ruling review has already run when the empty door asks, so the door is
  // not charged its 20 s reserve. The write ends at 185 s at 71 tok/s: a rewrite needs 88 s — 95 s are left
  // without the reserve and 75 s with it.
  const BW = { ...EMPTY, q: 'اذكر لي شروط الجمع للمسافر', whole: [R.head, R.s3].join(NL) };
  const k11 = await drive({ fx: BW, pre: 155000, times: { draft: 30000, door: 20000 }, outTokens: 2000,
    extra: { storedRuntime: 'STORED_FIQH', beforeWriting: { libFlagValue: 'off', libToken: '' } } });
  ok('K11 a before-writing turn: a door after the ruling review is not charged the review\'s reserve',
    k11.calls.some((c) => c.kind === 'empty-retry') && !has(k11, /no_time_for:empty_retry/u),
    brief(k11));
  // K12 the tools-removed write is the call that wrote the draft (the tool rounds wrote nothing): its speed,
  // not the empty round's, plans the door. 2000 tokens in 60 s (34.5 tok/s net) ending at 150 s: a rewrite
  // needs 180 s of 130 — refused by name.
  const seat1 = (kind, n) => {
    if (kind === 'tool') return n === 1 ? { tool: 'الجمع', stop: 'tool_use', ms: 20254 } : { empty: true, stop: 'end_turn', ms: 1500, out: 100 };
    if (kind === 'write') return { text: REJECT.whole, stop: 'end_turn', ms: 60000, out: 2000 };
    return null;
  };
  const k12 = await drive({ fx: REJECT, pre: 68246, times: LATE, script: seat1 });
  ok('K12 the tools-removed write\'s own speed plans the door: a slow write at 150 s refuses it by name',
    k12.calls.some((c) => c.kind === 'write') && noDoorCall(k12, 'reject') && has(k12, /^write_continue:no_time_for:reject_retry:\d+:-?\d+$/u)
    && has(k12, /^reject_lifted:1:1:0$/u),
    brief(k12));
  // K13 a draft that CAPPED at 275 s and whose continuation did not fit (a turn with nothing continued on it):
  // the door is asked all the same, and refused.
  const capped = (kind) => (kind === 'tool' ? { text: REJECT.whole, stop: 'max_tokens', ms: 60894, out: 6144 } : null);
  const k13 = await drive({ fx: REJECT, pre: 214106, times: LATE, script: capped });
  ok('K13 a capped draft whose continuation did not fit: the door is asked, refused by name, and never called',
    has(k13, /^write_continue:no_time:\d+:-?\d+$/u) && has(k13, /^write_continue:no_time_for:reject_retry:\d+:-?\d+$/u)
    && noDoorCall(k13, 'reject') && inTime(k13),
    brief(k13));

  // ── K8 the switch off ───────────────────────────────────────────────────────────────────────────
  const k8 = await drive({ fx: REJECT, pre: LATE.pre, times: LATE, flag: false });
  ok('K8  the switch off: the late door runs as before, and no clock is asked',
    k8.calls.some((c) => c.kind === 'reject-retry') && !has(k8, /no_time/u) && !has(k8, /reject_lift/u),
    brief(k8));

  console.log(`\n=== full-answer-door-clock: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
