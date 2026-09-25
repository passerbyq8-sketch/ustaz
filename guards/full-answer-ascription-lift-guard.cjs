// guards/full-answer-ascription-lift-guard.cjs -- ج٢ (order C, FULL_ANSWER_V1): what the ascription door judged
// ascribed to the Prophet ﷺ and not his never reaches the reader as his. When the door had no time for its
// rewrite, or its rewrite was refused, or the sentence could not be split (`tail_after_span`), the sentence is
// lifted WHOLE by the rule of ج١, and D13's line for a source that says otherwise stands in its place.
//
// THE GAP (report B §6.1 row 2; measured again on c685ab9 in program-2026-09-24/10-order-c/c2/C2-MEASURE.md):
// «وكان ينام نصف الليل، ويقوم ثلثه، وينام سدسه، وهذا من كمال هديه.» went out as it stood under the Prophet's ﷺ
// frame, beside the matn that names داود عليه السلام — complete and unmarked (`ascription:kept_uncorrected`).
//
// WHAT THIS PINS (the real runFreeBrainTurn, a scripted provider, a virtual clock — the harness of
// guards/full-answer-doors-guard.cjs):
//   N1  no time for the door, the sentence cannot be split: it is gone, the line stands where it stood, and
//       the frame, the matn and the last sentence are there byte for byte;
//   N2  ...and the reader is not told it stopped short: no marker, the lift named;
//   N3  the rewrite refused (capped, no time to continue it): the same lift;
//   N4  time for the door, the rewrite still carries the theft: the same lift (the sentence cannot be split);
//   N5  (scope) a sentence the correction can rewrite is still corrected in place, and nothing is lifted;
//   N6  two findings: the one that can be corrected is corrected, the one that cannot is lifted;
//   N7  the line is not said twice when the answer already carries it;
//   N8  the switch off: the description goes out as it stood, exactly as before (`kept_uncorrected`);
//   N9  a sentence that ends at its line break keeps the break; N10 a list item keeps its marker;
//   N11 the unit is the whole sentence, frame and all, across a colon; N12 one matn feeding two sentences
//       leaves neither (the order-C review's four witnesses).
// The line is D13's for a source that says otherwise — the matn's own words and the man it names — never
// «لم أقفْ…», which would deny a wording the card beneath carries.
// Red on the tree before this item (c685ab9): `node guards/full-answer-ascription-lift-guard.cjs --root <tree>`.
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

// ── THE TEXTS: prophet-ascription-wiring ROUND_4, as full-answer-doors-guard.cjs carries it ────────────
const NL = '\n';
const A = {
  frame: 'هدي النبي صلى الله عليه وسلم في ليله هدي معتدل، لا إفراط فيه ولا تفريط.',
  // A tail that opens with no verb the correction can give the frame back to: `tail_after_span`.
  witness: 'وكان ينام نصف الليل، ويقوم ثلثه، وينام سدسه، وهذا من كمال هديه.',
  // The same theft with no tail: the correction rewrites it to the matn's man.
  plain: 'وكان ينام نصف الليل، ويقوم ثلثه، وينام سدسه.',
  corrected: 'وكان داود عليه السلام ينام نصف الليل، ويقوم ثلثه، وينام سدسه.',
  block: '<hadith narrator="عبد الله بن عمرو رضي الله عنهما" ruling="متفق عليه">أحب الصلاة إلى الله صلاة داود عليه السلام، كان ينام نصف الليل، ويقوم ثلثه، وينام سدسه</hadith>',
  last: 'وفي هذا تعليم للأمة أن تأخذ من ليلها بنصيب.',
};
const fixture = (sentence, extra = []) => ({
  q: 'ما هدي النبي صلى الله عليه وسلم في يومه وليلته؟',
  draftCut: [A.frame, sentence, ...extra, A.block, A.last.slice(0, 30)].join(NL), cont: A.last,
  whole: [A.frame, sentence, ...extra, A.block, A.last].join(NL),
  rewriteCut: [A.frame, A.corrected, A.block, A.last.slice(0, 22)].join(NL), rewriteRest: A.last,
});

async function main() {
  console.log('full-answer-ascription-lift guard — root ' + REPO);
  let LOOP = null, INS = null, RR = null;
  try {
    LOOP = await esm('lib/free-brain/loop.js');
    INS = await esm('lib/free-brain/instructions.js');
    RR = await esm('lib/ruling-review.js');
  } catch (e) { ok('N0  the modules load', false, e.message); }
  if (!LOOP || !INS || !RR) { console.log(`\n=== full-answer-ascription-lift: ${checks - failures}/${checks} PASS ===`); process.exit(1); }
  // D13's line for a source that says otherwise («والذي في <المصدر>: «…»»): the matn's own words for the run
  // the prose took, and the man the matn names. Not «لم أقفْ…» — the card beneath carries the wording.
  const LINE = 'والذي في الحديث عن داود عليه السلام: «ينام نصف الليل، ويقوم ثلثه، وينام سدسه».';
  const ASC = await esm('lib/prophet-ascription.js');
  const OR = await esm('lib/output-reviewer.js');
  const ascOpts = { frame: OR.prophetFrame, namesTheProphet: OR.frameNamesProphet };
  ok('N0  the sentence door\'s «not found» line is not the one used here (it would deny the card beneath)',
    typeof RR.PROPHET_NOT_FOUND === 'string' && !LINE.includes('لم أقف') && typeof ASC.locateStolenAscriptions === 'function');
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
  const drive = async ({ fx, script, pre = 5000, flag = true }) => {
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
      const content = [{ type: 'text', text: r.text }];
      const out = r.stop === 'max_tokens' ? body.max_tokens : 2000;
      offset += r.ms;
      calls.push({ kind, stop: r.stop });
      const payload = { id: 'msg_al', type: 'message', role: 'assistant', model: body.model, content, stop_reason: r.stop, usage: { input_tokens: 1000, output_tokens: out } };
      return { ok: true, status: 200, url: u, headers: hdrs, json: async () => payload, text: async () => JSON.stringify(payload) };
    };
    const turnStart = Date.now();
    let out = null;
    try {
      out = await quiet(() => LOOP.runFreeBrainTurn({
        messages: [{ role: 'user', content: fx.q }],
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
  const brief = (r) => JSON.stringify({ kinds: r.kinds, truncated: r.out.truncated, degraded: deg(r), text: text(r), threw: r.out.threw });
  // The draft caps and is continued to its end; the door's rewrite caps (or, `retry: 'whole'`, comes back
  // whole with the theft still in it); each continuation of the rewrite ends it.
  const script = (fx, { retry = 'cut', times = {} } = {}) => {
    const t = { draft: 60894, cont: 29700, door: 60894, doorCont: 19800, ...times };
    return (kind) => {
      if (kind === 'tool') return { text: fx.draftCut, stop: 'max_tokens', ms: t.draft };
      if (kind === 'write-continue') return { text: fx.cont, stop: 'end_turn', ms: t.cont };
      if (kind === 'ascription-retry') {
        return retry === 'whole' ? { text: fx.whole, stop: 'end_turn', ms: t.door } : { text: fx.rewriteCut, stop: 'max_tokens', ms: t.door };
      }
      if (/-continue$/u.test(kind)) return { text: fx.rewriteRest, stop: 'end_turn', ms: t.doorCont };
      return { text: fx.whole, stop: 'end_turn', ms: 3000 };
    };
  };
  // The clocks of B1-MEASURE.md T2/T3: «no time for the door» (the zakat witness) and «the door fits, its
  // rewrite caps, and no continuation fits after it».
  const NOTIME = { pre: 53748, times: { draft: 103852, cont: 50700 } };
  const CAPPED_NOTIME = { pre: 124206, times: { draft: 60894, cont: 29900, door: 60894 } };
  const lifted = () => [A.frame, LINE, A.block, A.last].join(NL);
  // The prose the reader reads as the answer's own: no card, and not the D13 line's quotation of the card.
  const prose = (r) => text(r).replace(/<hadith[\s\S]*?<\/hadith>/gu, ' ').split(NL).filter((l) => !l.includes('والذي في الحديث عن')).join(NL);
  // And the rule itself, asked of what goes out: nothing it would catch is left.
  const clean = (r) => ASC.locateStolenAscriptions(text(r), ascOpts).length === 0;

  // ── N1/N2 no time for the door, the sentence cannot be split ──────────────────────────────────────
  const W = fixture(A.witness);
  const n1 = await drive({ fx: W, pre: NOTIME.pre, script: script(W, { times: NOTIME.times }) });
  ok('N1  no time for the door, the sentence cannot be split: it is gone, the line stands where it stood, the rest byte for byte',
    has(n1, /^write_continue:no_time_for:ascription_retry:\d+:-?\d+$/u) && !n1.kinds.some((k) => k.startsWith('ascription-'))
    && text(n1) === lifted() && clean(n1) && !prose(n1).includes('ينام نصف الليل'),
    brief(n1));
  ok('N2  ...and the reader is not told it stopped short: no marker, the lift named',
    n1.out.truncated === false && has(n1, /^ascription_lifted:1:0:1$/u) && has(n1, /^ascription:lifted$/u)
    && !has(n1, /^ascription:kept_uncorrected$/u) && !has(n1, /^delivery_short:/u),
    brief(n1));

  // ── N3 the rewrite refused ───────────────────────────────────────────────────────────────────────
  const n3 = await drive({ fx: W, pre: CAPPED_NOTIME.pre, script: script(W, { times: CAPPED_NOTIME.times }) });
  ok('N3  the rewrite refused (capped, no time to continue it): the sentence is lifted the same way',
    n3.kinds.includes('ascription-retry:max_tokens') && has(n3, /^ascription_retry:rewrite_cut_over_whole$/u)
    && text(n3) === lifted() && clean(n3) && has(n3, /^ascription:lifted$/u) && n3.out.truncated === false,
    brief(n3));

  // ── N4 time for the door, the rewrite still carries the theft ────────────────────────────────────
  const n4 = await drive({ fx: W, script: script(W, { retry: 'whole' }) });
  ok('N4  time for the door, its rewrite still carries the theft, and the sentence cannot be split: lifted',
    has(n4, /^ascription_retry:still_caught:1$/u) && text(n4) === lifted() && clean(n4) && has(n4, /^ascription:lifted$/u)
    && n4.out.truncated === false,
    brief(n4));

  // ── N5 scope: a sentence the correction can rewrite ──────────────────────────────────────────────
  const P = fixture(A.plain);
  const n5 = await drive({ fx: P, pre: NOTIME.pre, script: script(P, { times: NOTIME.times }) });
  ok('N5  (scope) a sentence the correction can rewrite is corrected in place, and nothing is lifted',
    has(n5, /^ascription:corrected$/u) && !has(n5, /ascription_lifted/u) && text(n5).includes(A.corrected)
    && !text(n5).includes(LINE),
    brief(n5));

  // ── N6 two findings, one of each ────────────────────────────────────────────────────────────────
  const FAST = 'وكان يصوم يوما ويفطر يوما، ولا يفر إذا لاقى.';
  const FAST_FIXED = 'وكان داود عليه السلام يصوم يوما ويفطر يوما، ولا يفر إذا لاقى.';
  const FAST_BLOCK = '<hadith narrator="عبد الله بن عمرو رضي الله عنهما" ruling="متفق عليه">أحب الصيام إلى الله صيام داود عليه السلام، كان يصوم يوما ويفطر يوما، ولا يفر إذا لاقى</hadith>';
  // The one that cannot be split comes first: corrected first, the other would read under داود and hide it.
  const TWO = fixture(A.witness, [FAST, FAST_BLOCK]);
  const n6 = await drive({ fx: TWO, pre: NOTIME.pre, script: script(TWO, { times: NOTIME.times }) });
  ok('N6  two findings: the one that can be corrected is corrected, the one that cannot is lifted',
    has(n6, /^ascription_lifted:1:1:1$/u) && text(n6).includes(FAST_FIXED) && text(n6).includes(LINE)
    && !prose(n6).includes('ينام نصف الليل') && text(n6).includes(FAST_BLOCK) && text(n6).includes(A.block),
    brief(n6));

  // ── N7 the line is not said twice ───────────────────────────────────────────────────────────────
  const AGAIN = fixture(A.witness, [LINE]);
  const n7 = await drive({ fx: AGAIN, pre: NOTIME.pre, script: script(AGAIN, { times: NOTIME.times }) });
  ok('N7  a line the answer already carries is not said again: the sentence goes, the line stands once',
    text(n7).split(LINE).length === 2 && !prose(n7).includes('ينام نصف الليل') && has(n7, /^ascription_lifted:1:0:0$/u),
    brief(n7));

  // ── N9–N12 the order-C review's witnesses ──────────────────────────────────────────────────────
  const bare = A.witness.replace(/\.$/u, '');
  // N9 the sentence ends at its line break, with no full stop: the break stays, the next paragraph keeps its line.
  const NEXT = 'وأما نهاره فكان يعمل ويذكر الله.';
  const PARA = { ...W, draftCut: [A.frame + ' ' + bare, NEXT, A.block, A.last.slice(0, 30)].join(NL),
    whole: [A.frame + ' ' + bare, NEXT, A.block, A.last].join(NL) };
  const n9 = await drive({ fx: PARA, pre: NOTIME.pre, script: script(PARA, { times: NOTIME.times }) });
  ok('N9  a sentence that ends at its line break: the break stays, and the next paragraph keeps its own line',
    // (the reviewer puts each judged sentence on its own line, so the frame and the lifted sentence part)
    text(n9).split(NL).indexOf(LINE) > 0 && text(n9).split(NL)[text(n9).split(NL).indexOf(LINE) + 1] === NEXT
    && !text(n9).includes(LINE + 'وأما') && clean(n9) && has(n9, /^ascription:lifted$/u),
    brief(n9));
  // N10 a list item: its marker stays with its line, and the next item keeps its own.
  const LIST = { ...W, draftCut: ['هدي النبي صلى الله عليه وسلم في ليله:', '- ' + bare, '- ويختم ليله بالوتر', A.block, A.last.slice(0, 30)].join(NL),
    whole: ['هدي النبي صلى الله عليه وسلم في ليله:', '- ' + bare, '- ويختم ليله بالوتر', A.block, A.last].join(NL) };
  const n10 = await drive({ fx: LIST, pre: NOTIME.pre, script: script(LIST, { times: NOTIME.times }) });
  ok('N10 a list item: the marker stays with its line, and the next item keeps its own',
    text(n10).split(NL)[1] === '- ' + LINE && text(n10).split(NL)[2] === '- ويختم ليله بالوتر' && clean(n10),
    brief(n10));
  // N11 the frame and the description in one sentence across a colon: the whole sentence goes, frame and all.
  const COLON = 'وكان النبي صلى الله عليه وسلم يقول: «كان ينام نصف الليل، ويقوم ثلثه، وينام سدسه»، وهذا من كمال هديه.';
  const C3 = { ...W, draftCut: [A.frame, COLON, A.block, A.last.slice(0, 30)].join(NL), whole: [A.frame, COLON, A.block, A.last].join(NL) };
  const n11 = await drive({ fx: C3, pre: NOTIME.pre, script: script(C3, { times: NOTIME.times }) });
  ok('N11 a colon inside the sentence: the whole sentence goes, the Prophet\'s ﷺ frame with it, the line in its place',
    has(n11, /^ascription:lifted$/u) && !text(n11).includes('يقول:') && text(n11).includes('والذي في الحديث عن داود عليه السلام: «')
    && text(n11).startsWith(A.frame + NL + 'والذي في الحديث') && clean(n11),
    brief(n11));
  // N12 one matn feeds two sentences: the detector names one run per matn, so the second is caught only once the
  // first has gone — and it goes too. Neither reaches the reader as his.
  const SUMMARY = 'وخلاصة ذلك أن النبي صلى الله عليه وسلم كان ينام نصف الليل ويقوم ثلثه وينام سدسه، وهذا أعدل القيام.';
  const R1 = { ...W, draftCut: [A.frame, A.witness, A.block, SUMMARY, A.last.slice(0, 30)].join(NL), whole: [A.frame, A.witness, A.block, SUMMARY, A.last].join(NL) };
  const n12 = await drive({ fx: R1, pre: NOTIME.pre, script: script(R1, { times: NOTIME.times }) });
  ok('N12 one matn, two sentences: both go, and nothing the rule would catch is left',
    has(n12, /^ascription:lifted$/u) && !text(n12).includes('وخلاصة ذلك أن النبي') && !prose(n12).includes('ينام نصف الليل')
    && clean(n12) && text(n12).includes(A.block),
    brief(n12));

  // ── N8 the switch off ───────────────────────────────────────────────────────────────────────────
  const n8 = await drive({ fx: W, flag: false, script: script(W, { retry: 'whole' }) });
  ok('N8  the switch off: the description goes out as it stood, exactly as before',
    has(n8, /^ascription:kept_uncorrected$/u) && !has(n8, /ascription_lifted/u) && text(n8).includes(A.witness)
    && !text(n8).includes(LINE),
    brief(n8));

  console.log(`\n=== full-answer-ascription-lift: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
