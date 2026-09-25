// guards/full-answer-doors-guard.cjs -- ب١ (order B, FULL_ANSWER_V1): a whole-answer rewrite from any of
// the four doors (citation, reject, empty, ascription) that stops on the token cap is continued by the
// M3-A mechanism, and a rewrite its continuations could not finish is not put in place of an answer
// whose writing finished.
//
// THE GAP (D28, measured on c00e8f5 in program-2026-09-24/09-order-b/b1/measure/B1-MEASURE.md, T1):
// after a draft was continued to its end, the reject, empty and ascription doors each adopted a rewrite
// that had itself stopped on the cap, and the reader got the cut rewrite with «لم يكتملْ».
//
// WHAT THIS PINS (every turn is the real runFreeBrainTurn with a scripted provider on a virtual clock:
// each scripted call advances Date.now by its duration, so the 300 s arithmetic is exercised for real):
//   F1  citation: the capped retry is continued by ONE call (no tools, unstreamed, last turns: the
//       retry note, the retry cut to its last whole sentence, CONTINUE_NOTE) and is then adopted whole;
//   F2  reject: the capped rewrite is continued and adopted whole: no marker, the credit gone;
//   F3  empty: the capped fill is continued and adopted whole: all six steps;
//   F4  ascription: the capped rewrite is continued and adopted whole: corrected and complete;
//   F5  at most two continuations of a door's rewrite; still cut over a whole answer, it is refused:
//       the reject door withholds from the first rejected sentence, and says so;
//   F6  no time to continue the ascription rewrite: refused over the whole answer, which is corrected
//       in place and delivered complete;
//   F7  over an answer whose writing did NOT finish, a still-cut rewrite is adopted as before;
//   F8  with the switch on, no two ledger rows share an ordinal, and rows equal model calls;
//   F9  a continued rewrite counts for the doors' clock: the next door that no longer fits is refused;
//   F10 the switch off: the capped rewrite is adopted exactly as before, and nothing is continued.
// Red on the tree before this item (c00e8f5): `node guards/full-answer-doors-guard.cjs --root <tree>`.
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
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 600) : ''));
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

// ── THE TEXTS: the doors' own guard fixtures (reject-door, no-empty-answer V4, prophet-ascription-wiring
// ROUND_4) and an uncited fiqh answer over a real search_sources round on the local encyclopedia ──
const NL = '\n';
const PARA = '\n\n';
const C = {
  s1: 'الوضوءُ شرطٌ لصحّةِ الصلاةِ عند أهلِ العلم.',
  s2: 'ولا تصحُّ صلاةٌ بغيرِ طهارةٍ مع القدرةِ عليها.',
  s3: 'وإذا عجزَ المسلمُ عن الماءِ تيمّمَ بالصعيدِ الطيّبِ وصلّى، ولا إعادةَ عليه على الصحيحِ من أقوالِ أهلِ العلم.',
  s4: 'والأحوطُ أن يطلبَ الماءَ في رحلِه وما قرُبَ منه قبلَ أن يتيمّم.',
};
const cited = (s) => s.replace(/\.$/u, ' [[1]].');
const CITE = {
  q: 'هل يجب الوضوء لمن أراد الصلاة وهو عادم للماء؟ بيّن الحكم', tool: 'الوضوء',
  draftCut: [C.s1, C.s2, C.s3.slice(0, 60)].join(PARA), cont: [C.s3, C.s4].join(PARA),
  whole: [C.s1, C.s2, C.s3, C.s4].join(PARA),
  rewriteCut: [cited(C.s1), cited(C.s2), C.s3.slice(0, 45)].join(PARA), rewriteRest: [cited(C.s3), C.s4].join(PARA),
};
const R = {
  head: 'الصلاة ركن من أركان الإسلام.',
  claim: 'الجمع للمسافر جائز عند الحاجة.',
  clean: 'الجمع للمسافر جائز عند الحاجة عند جمهور أهل العلم.',
  s3: 'والأفضلُ للمسافرِ أن يصلّيَ كلَّ صلاةٍ في وقتِها إن لم تلحقْه مشقّة، فإن شقَّ عليه ذلك جمعَ بين الظهرِ والعصرِ في وقتِ إحداهما.',
  s4: 'ويقصرُ الرباعيّةَ ما دامَ مسافرًا.',
};
R.named = 'ذكر ابن باز أن ' + R.claim;
const REJECT = {
  q: 'ما حكم الجمع للمسافر؟',
  draftCut: [R.head, R.named, R.s3.slice(0, 90)].join(NL), cont: R.s3, whole: [R.head, R.named, R.s3].join(NL),
  rewriteCut: [R.head, R.clean, R.s3.slice(0, 80)].join(NL), rewriteRest: R.s3,
};
const E = {
  frame: 'هذه صفة الوضوء كما وردت في السنة، فاعمل بها مطمئنا يا مساعد.',
  s2: 'وهي صفةٌ يسيرةٌ يقدرُ عليها كلُّ مسلم.',
  steps: ['1. غسل الكفين ثلاثا.', '2. المضمضة والاستنشاق.', '3. غسل الوجه ثلاثا.', '4. غسل اليدين إلى المرفقين ثلاثا.', '5. مسح الرأس والأذنين.', '6. غسل الرجلين إلى الكعبين.'],
};
const EMPTY = {
  q: 'اذكر لي خطوات الوضوء مرقمة',
  draftCut: E.frame + ' ' + E.s2.slice(0, 30), cont: E.s2, whole: E.frame + ' ' + E.s2,
  rewriteCut: [...E.steps.slice(0, 3), E.steps[3].slice(0, 22)].join(NL), rewriteRest: E.steps.slice(3).join(NL),
};
const A = {
  frame: 'هدي النبي صلى الله عليه وسلم في ليله هدي معتدل، لا إفراط فيه ولا تفريط.',
  witness: 'وكان ينام نصف الليل، ويقوم ثلثه، وينام سدسه.',
  corrected: 'وكان داود عليه السلام ينام نصف الليل، ويقوم ثلثه، وينام سدسه.',
  block: '<hadith narrator="عبد الله بن عمرو رضي الله عنهما" ruling="متفق عليه">أحب الصلاة إلى الله صلاة داود عليه السلام، كان ينام نصف الليل، ويقوم ثلثه، وينام سدسه</hadith>',
  last: 'وفي هذا تعليم للأمة أن تأخذ من ليلها بنصيب.',
};
const ASCRIPTION = {
  q: 'ما هدي النبي صلى الله عليه وسلم في يومه وليلته؟',
  draftCut: [A.frame, A.witness, A.block, A.last.slice(0, 30)].join(NL), cont: A.last,
  whole: [A.frame, A.witness, A.block, A.last].join(NL),
  rewriteCut: [A.frame, A.corrected, A.block, A.last.slice(0, 22)].join(NL), rewriteRest: A.last,
};

async function main() {
  console.log('full-answer-doors guard — root ' + REPO);
  let LOOP = null, INS = null, ENC = null;
  try {
    LOOP = await esm('lib/free-brain/loop.js');
    INS = await esm('lib/free-brain/instructions.js');
    ENC = await esm('lib/encyclopedia.js');
  } catch (e) { ok('F0  the modules load', false, e.message); }
  if (!LOOP || !INS || !ENC) { console.log(`\n=== full-answer-doors: ${checks - failures}/${checks} PASS ===`); process.exit(1); }
  // The encyclopedia builds its index on the first search; warmed here so no turn pays for it.
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
  // Each provider call is named by its body: a tool round, the draft's continuation, a door's retry, or a
  // door's continuation (CONTINUE_NOTE under that door's note).
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

  // `script(kind, n)` returns { text | tool | empty, stop, ms } for the n-th call of that kind.
  const drive = async ({ fixture, script, pre = 5000, flag = true }) => {
    const calls = [];
    const counts = {};
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (input, init = {}) => {
      const u = String(input?.url || input);
      if (!u.startsWith('https://provider.invalid')) return fetchImpl(u);
      const body = JSON.parse(String(init.body || '{}'));
      const kind = classify(body);
      counts[kind] = (counts[kind] || 0) + 1;
      const r = kind === 'aux' ? { text: 'DEEN', stop: 'end_turn', ms: 300 } : script(kind, counts[kind]);
      const content = r.tool ? [{ type: 'tool_use', id: `toolu_fd_${calls.length + 1}`, name: 'search_sources', input: { query: r.tool } }]
        : r.empty ? [] : [{ type: 'text', text: r.text }];
      const out = r.stop === 'max_tokens' ? body.max_tokens : 2000;
      offset += r.ms;
      calls.push({ kind, stop: r.stop, body });
      const payload = { id: 'msg_fd', type: 'message', role: 'assistant', model: body.model, content, stop_reason: r.stop, usage: { input_tokens: 1000, output_tokens: out } };
      return { ok: true, status: 200, url: u, headers: hdrs, json: async () => payload, text: async () => JSON.stringify(payload) };
    };
    const turnStart = Date.now();
    let out = null;
    try {
      out = await quiet(() => LOOP.runFreeBrainTurn({
        messages: [{ role: 'user', content: fixture.q }],
        system: 'system', model: 'claude-opus-5', maxTokens: 4096, usePremium: true, effort: 'high',
        band: 'adult', mode: 'chat', lexicalRoute: 'DEEN', storedRuntime: '',
        providerUrl: 'https://provider.invalid/v1/messages', headers: {}, env: {}, fetchImpl,
        fullAnswer: flag ? { startedAt: turnStart - pre } : null,
      }));
    } catch (e) { out = { threw: String(e && e.stack || e) }; }
    finally { globalThis.fetch = realFetch; }
    return { out: out || {}, calls, kinds: calls.map((c) => `${c.kind}:${c.stop}`) };
  };
  const deg = (r) => r.out.degraded || [];
  const has = (r, re) => deg(r).some((d) => re.test(d));
  const text = (r) => String(r.out.text || '');
  const brief = (r) => JSON.stringify({ kinds: r.kinds, truncated: r.out.truncated, stop: r.out.deliveredStop,
    rc: r.out.rewriteContinuations, degraded: deg(r), text: text(r).slice(-160), threw: r.out.threw });
  // The common script: the draft round caps (or ends whole), its continuation ends, the door's retry
  // caps, and each continuation of that retry answers `doorCont` in turn.
  const doorScript = (fx, { draftWhole = false, draftConts = ['end_turn'], retryStop = 'max_tokens', doorConts = [['rest', 'end_turn']], times = {} } = {}) => {
    const t = { tool: 20254, draft: 60894, cont: 29700, door: 60894, doorCont: 19800, ...times };
    return (kind, n) => {
      if (kind === 'tool') {
        if (fx.tool && n === 1) return { tool: fx.tool, stop: 'tool_use', ms: t.tool };
        return draftWhole ? { text: fx.whole, stop: 'end_turn', ms: t.draft } : { text: fx.draftCut, stop: 'max_tokens', ms: t.draft };
      }
      if (kind === 'write-continue') {
        const stop = draftConts[Math.min(n, draftConts.length) - 1];
        return { text: stop === 'end_turn' ? fx.cont : fx.cont.replace(/\.$/u, '') + ' ثمّ إن', stop, ms: t.cont };
      }
      if (/-retry$/u.test(kind)) {
        return retryStop === 'end_turn' ? { text: fx.rewriteWhole || fx.rewriteCut, stop: 'end_turn', ms: t.door }
          : { text: fx.rewriteCut, stop: 'max_tokens', ms: t.door };
      }
      if (/-continue$/u.test(kind)) {
        const [what, stop] = doorConts[Math.min(n, doorConts.length) - 1];
        const rest = what === 'rest' ? fx.rewriteRest : what;
        return { text: rest, stop, ms: t.doorCont };
      }
      return { text: fx.whole, stop: 'end_turn', ms: t.draft };
    };
  };
  // The continuation call of a door: no tools, unstreamed, its last three turns the door's note, the
  // retry's head (assistant) and CONTINUE_NOTE.
  const contShape = (r, door, noteTest) => {
    const c = r.calls.find((x) => x.kind === `${door}-continue`);
    if (!c) return false;
    const m = c.body.messages || [];
    const [note, head, last] = m.slice(-3);
    return !('tools' in c.body) && c.body.stream === false && last && last.role === 'user' && last.content === CONT
      && head && head.role === 'assistant' && typeof head.content === 'string' && head.content.length > 0
      && note && note.role === 'user' && noteTest(textOfMsg(note));
  };

  // ── F1 citation ───────────────────────────────────────────────────────────────────────────────
  const f1 = await drive({ fixture: CITE, script: doorScript(CITE) });
  ok('F1  citation: the capped retry is continued by ONE unstreamed call without tools, then adopted whole',
    f1.kinds.filter((k) => k.startsWith('cite-continue')).length === 1
    && contShape(f1, 'cite', (u) => u === INS.CITATION_RETRY_NOTE)
    && has(f1, /^rewrite_continue:citation_retry:done:1:end_turn:\d+$/u) && has(f1, /^citation_retry:cited:\d+$/u)
    && f1.out.truncated === false && f1.out.rewriteContinuations === 1 && text(f1).includes('في رحلِه'),
    brief(f1));

  // ── F2 reject ─────────────────────────────────────────────────────────────────────────────────
  const f2 = await drive({ fixture: REJECT, script: doorScript(REJECT) });
  ok('F2  reject: the capped rewrite is continued and adopted whole: no marker, the credit gone',
    contShape(f2, 'reject', (u) => u.startsWith(INS.REJECT_RETRY_NOTE))
    && has(f2, /^rewrite_continue:reject_retry:done:1:end_turn:\d+$/u) && has(f2, /^reject_retry:clean$/u)
    && f2.out.truncated === false && text(f2).includes('في وقتِ إحداهما') && !text(f2).includes('ابن باز'),
    brief(f2));

  // ── F3 empty ──────────────────────────────────────────────────────────────────────────────────
  const f3 = await drive({ fixture: EMPTY, script: doorScript(EMPTY) });
  ok('F3  empty: the capped fill is continued and adopted whole: all six steps',
    contShape(f3, 'empty', (u) => u.startsWith(INS.EMPTY_RETRY_NOTE))
    && has(f3, /^rewrite_continue:empty_retry:done:1:end_turn:\d+$/u) && has(f3, /^empty_retry:filled$/u)
    && f3.out.truncated === false && E.steps.every((s) => text(f3).includes(s.slice(3, 15))),
    brief(f3));

  // ── F4 ascription ─────────────────────────────────────────────────────────────────────────────
  const f4 = await drive({ fixture: ASCRIPTION, script: doorScript(ASCRIPTION) });
  ok('F4  ascription: the capped rewrite is continued and adopted whole: corrected and complete',
    contShape(f4, 'ascription', (u) => u.startsWith(INS.ASCRIPTION_RETRY_NOTE))
    && has(f4, /^rewrite_continue:ascription_retry:done:1:end_turn:\d+$/u) && has(f4, /^ascription:repaired$/u)
    && f4.out.truncated === false && text(f4).includes('داود عليه السلام ينام') && text(f4).includes('من ليلها بنصيب'),
    brief(f4));

  // ── F5 at most two, and refused over a whole answer ───────────────────────────────────────────
  // The draft ends whole; the reject rewrite caps and both of its continuations cap too.
  const capTwice = [['والأفضلُ للمسافرِ أن يجمعَ عند الحاجة. ثمّ إن', 'max_tokens'], ['ويقصرُ الرباعيّةَ في سفره. وإن', 'max_tokens'], ['@@a third@@', 'end_turn']];
  const f5 = await drive({ fixture: REJECT, script: doorScript(REJECT, { draftWhole: true, doorConts: capTwice }) });
  ok('F5  at most two continuations of a door\'s rewrite; still cut over a whole answer, it is refused and the door withholds',
    f5.kinds.filter((k) => k.startsWith('reject-continue')).length === 2
    && has(f5, /^rewrite_continue:reject_retry:done:2:max_tokens:\d+$/u) && has(f5, /^reject_retry:rewrite_cut_over_whole$/u)
    && has(f5, /^reject_withheld:\d+$/u) && f5.out.truncated === true
    && text(f5).trim() === R.head && !text(f5).includes('ابن باز') && !text(f5).includes('جمهور'),
    brief(f5));

  // ── F6 no time to continue: refused, the whole answer corrected in place ──────────────────────
  // The draft caps at 186.0 s and is continued; the door starts at 215.9 s with 64.1 s left (a whole
  // rewrite at 100.9 tok/s needs 62.9 s), caps at 276.8 s, and 3.2 s are then left: no continuation.
  const f6 = await drive({ fixture: ASCRIPTION, pre: 125000, script: doorScript(ASCRIPTION) });
  ok('F6  no time to continue the ascription rewrite: refused over the whole answer, which is corrected in place',
    f6.kinds.includes('ascription-retry:max_tokens') && !f6.kinds.some((k) => k.startsWith('ascription-continue'))
    && has(f6, /^rewrite_continue:ascription_retry:no_time:\d+:-?\d+$/u) && has(f6, /^ascription_retry:rewrite_cut_over_whole$/u)
    && f6.out.truncated === false && text(f6).includes('داود عليه السلام ينام') && text(f6).includes('من ليلها بنصيب'),
    brief(f6));

  // ── F7 over an answer that did not finish, the old adoption stands ────────────────────────────
  const f7 = await drive({ fixture: REJECT, script: doorScript(REJECT, { draftConts: ['max_tokens', 'max_tokens'], doorConts: capTwice }) });
  ok('F7  over an answer whose writing did not finish, a still-cut rewrite is adopted as before',
    has(f7, /^write_continue:done:2:max_tokens:\d+$/u) && has(f7, /^rewrite_continue:reject_retry:done:2:max_tokens:\d+$/u)
    && has(f7, /^reject_retry:clean$/u) && !has(f7, /rewrite_cut_over_whole/u) && f7.out.truncated === true
    && text(f7).includes('جمهور أهل العلم'),
    brief(f7));

  // ── F8 ordinals ───────────────────────────────────────────────────────────────────────────────
  // The tools-removed write is the capped seat here: the second tool round writes nothing.
  const writeSeat = (fx) => (kind, n) => {
    if (kind === 'tool') return n === 1 ? { tool: fx.tool, stop: 'tool_use', ms: 20254 } : { empty: true, stop: 'end_turn', ms: 1500 };
    if (kind === 'write') return { text: fx.draftCut, stop: 'max_tokens', ms: 60894 };
    return doorScript(fx)(kind, n);
  };
  const f8 = await drive({ fixture: CITE, script: writeSeat(CITE) });
  const ns = (f8.out.roundLedger || []).map((row) => row.n);
  ok('F8  with the switch on, no two ledger rows share an ordinal, and the rows are the model calls',
    ns.length > 0 && new Set(ns).size === ns.length && ns.length === f8.out.modelCalls
    && (f8.out.roundLedger || []).some((row) => row.phase === 'rewrite-continue')
    && (f8.out.roundLedger || []).some((row) => row.phase === 'write-continue'),
    JSON.stringify({ ledger: (f8.out.roundLedger || []).map((row) => `${row.n}:${row.phase}`), calls: f8.out.modelCalls }));

  // ── F9 a continued rewrite counts for the doors' clock ────────────────────────────────────────
  // The draft ends whole (nothing continued); the citation retry caps and is continued, and its whole
  // text carries a credit the reviewer cuts, so the reject door wants a call at ~250 s it cannot fit.
  const CITE_NAMED = { ...CITE, rewriteRest: [cited(C.s3), 'ذكر ابن باز أن التيمم يرفع الحدث رفعا مؤقتا.', C.s4].join(PARA) };
  const f9 = await drive({ fixture: CITE_NAMED, pre: 100000, script: doorScript(CITE_NAMED, { draftWhole: true, times: { draft: 49600 } }) });
  ok('F9  a continued rewrite counts for the doors\' clock: the next door that no longer fits is refused by name',
    has(f9, /^rewrite_continue:citation_retry:done:1:end_turn:\d+$/u) && has(f9, /^citation_retry:cited:\d+$/u)
    && has(f9, /^write_continue:no_time_for:reject_retry:\d+:-?\d+$/u) && !f9.kinds.some((k) => k.startsWith('reject-retry')),
    brief(f9));

  // ── F10 the switch off ────────────────────────────────────────────────────────────────────────
  const f10 = await drive({ fixture: REJECT, flag: false, script: doorScript(REJECT, { draftWhole: true }) });
  ok('F10 the switch off: the capped rewrite is adopted exactly as before, and nothing is continued',
    f10.kinds.join(',') === 'tool:end_turn,reject-retry:max_tokens' && has(f10, /^reject_retry:clean$/u)
    && f10.out.truncated === true && !deg(f10).some((d) => /continue/u.test(d))
    && !(f10.out.roundLedger || []).some((row) => /continue/u.test(row.phase)) && (f10.out.rewriteContinuations || 0) === 0,
    brief(f10));

  console.log(`\n=== full-answer-doors: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
