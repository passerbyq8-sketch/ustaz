// guards/full-answer-reject-lift-guard.cjs -- ج١ (order C, FULL_ANSWER_V1): when the turn has no time left
// for the reject door's rewrite, the rejected sentence goes WHOLE — its credit is not taken out of it with
// its claim left standing — and the rest of the answer goes out as it is.
//
// THE GAP (report B §6.1 row 1; measured again on d886a78 in program-2026-09-24/10-order-c/c1/measure): the
// door refused for time (`write_continue:no_time_for:reject_retry` → `reject_retry:budget_spent:no_time`)
// never ran, and the reader got the reviewer's cut as it stood: «ذكر ابن باز أن» taken out and «الجمع للمسافر
// جائز عند الحاجة.» left as the answer's own words, under «لم يكتملْ» (187 characters).
//
// THE OWNER'S RULE (lib/takhrij-lock.js, and the order's ج١ by name): «الجملةُ التي يُحكَمُ عليها تذهبُ كاملةً،
// ولا يُنتزَعُ منها لفظٌ فتبقى واقفة». What stands in its place is the sentence door's own (D13,
// lib/ruling-review.js): one «ولم أقفْ على نصٍّ …» of that claim's kind, said once per kind. The rest of the
// answer is not withheld, and «لم يكتملْ» is not added for this lift alone.
//
// WHAT THIS PINS (every turn is the real runFreeBrainTurn with a scripted provider on a virtual clock, the
// way guards/full-answer-doors-guard.cjs drives it):
//   L1  the witness refused for time: no reject call; the credit and its claim are both gone;
//   L2  ...the D13 line stands exactly where the sentence stood, and the rest is byte for byte the answer;
//   L3  ...and the reader is not told it stopped short: no marker, no `reject_unrepaired`, the lift named;
//   L4  two rejected credits of one kind: both sentences go whole, the line is said once;
//   L5  a line the answer already carries is not said again;
//   L6  the line is the one for the credit the reviewer rejected — a credit to a named sayer — never one
//       about a majority or a madhhab the same sentence mentions, which the reviewer did not judge;
//   L7  (scope) the door that had time and whose capped rewrite could not be continued keeps §٣-ج: the
//       prefix before the first rejected sentence, told «لم يكتملْ» — ج١ is the no-time exit only;
//   L8  (scope) a door with time adopts its clean rewrite exactly as before — nothing is lifted;
//   L9  the switch off: nothing is lifted and nothing is continued;
//   L10 an earlier verse sentence that ends in the same words as the reviewer's cut is not touched: the
//       sentence is found as whole lines, never as a substring (the order-C review's witness);
//   L11 ...nor an earlier card that ends in them;
//   L12 another shortfall on the same turn still tells the reader: the lift does not silence it.
// Red on the tree before this item (d886a78): `node guards/full-answer-reject-lift-guard.cjs --root <tree>`.
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

// ── THE TEXTS: the reject door's own fixture (reject-door-guard, full-answer-doors-guard) ──────────
const NL = '\n';
const R = {
  head: 'الصلاة ركن من أركان الإسلام.',
  claim: 'الجمع للمسافر جائز عند الحاجة.',
  clean: 'الجمع للمسافر جائز عند الحاجة عند جمهور أهل العلم.',
  s3: 'والأفضلُ للمسافرِ أن يصلّيَ كلَّ صلاةٍ في وقتِها إن لم تلحقْه مشقّة، فإن شقَّ عليه ذلك جمعَ بين الظهرِ والعصرِ في وقتِ إحداهما.',
  s4: 'ويقصرُ الرباعيّةَ ما دامَ مسافرًا.',
  claim2: 'القصر للمسافر سنة مؤكدة.',
};
R.named = 'ذكر ابن باز أن ' + R.claim;
R.named2 = 'وذكر ابن عثيمين أن ' + R.claim2;
// The sentence door's line for an unsupported credit to a named scholar (lib/ruling-review.js, D13).
const SCHOLAR_LINE = 'ولم أقفْ على نصٍّ يُسنِدُ هذا القولَ إلى قائلِه.';
const REJECT = {
  q: 'ما حكم الجمع للمسافر؟',
  draftCut: [R.head, R.named, R.s3.slice(0, 90)].join(NL), cont: R.s3,
  rewriteCut: [R.head, R.clean, R.s3.slice(0, 80)].join(NL), rewriteRest: R.s3,
};
const TWO = {
  q: 'ما حكم الجمع والقصر للمسافر؟',
  draftCut: [R.head, R.named, R.named2, R.s3.slice(0, 90)].join(NL), cont: R.s3,
  rewriteCut: [R.head, R.clean, R.s3.slice(0, 80)].join(NL), rewriteRest: R.s3,
};
const ALREADY = {
  q: 'ما حكم الجمع للمسافر؟',
  draftCut: [R.head, R.named, SCHOLAR_LINE, R.s3.slice(0, 90)].join(NL), cont: R.s3,
  rewriteCut: [R.head, R.clean, R.s3.slice(0, 80)].join(NL), rewriteRest: R.s3,
};

async function main() {
  console.log('full-answer-reject-lift guard — root ' + REPO);
  let LOOP = null, INS = null, RR = null;
  try {
    LOOP = await esm('lib/free-brain/loop.js');
    INS = await esm('lib/free-brain/instructions.js');
    RR = await esm('lib/ruling-review.js');
  } catch (e) { ok('L0  the modules load', false, e.message); }
  if (!LOOP || !INS || !RR) { console.log(`\n=== full-answer-reject-lift: ${checks - failures}/${checks} PASS ===`); process.exit(1); }
  ok('L0  the scholar line is the sentence door\'s own (D13)',
    RR.notFoundSentence({ kinds: ['scholar'], madhhabs: [], book: '' }) === SCHOLAR_LINE);
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
      const content = r.empty ? [] : [{ type: 'text', text: r.text }];
      const out = r.stop === 'max_tokens' ? body.max_tokens : 2000;
      offset += r.ms;
      calls.push({ kind, stop: r.stop });
      const payload = { id: 'msg_rl', type: 'message', role: 'assistant', model: body.model, content, stop_reason: r.stop, usage: { input_tokens: 1000, output_tokens: out } };
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
  const brief = (r) => JSON.stringify({ kinds: r.kinds, truncated: r.out.truncated, degraded: deg(r), text: text(r), threw: r.out.threw });
  // The draft caps and is continued to its end; the door's rewrite (when it is called) caps, and each of
  // its continuations answers in turn. The timings are the production witnesses (B1-MEASURE.md §0).
  const script = (fx, { doorConts = [['rest', 'end_turn']], retry = 'cut', times = {} } = {}) => {
    const t = { draft: 60894, cont: 29700, door: 60894, doorCont: 19800, ...times };
    return (kind, n) => {
      if (kind === 'tool') return { text: fx.draftCut, stop: 'max_tokens', ms: t.draft };
      if (kind === 'write-continue') return { text: fx.cont, stop: 'end_turn', ms: t.cont };
      if (kind === 'reject-retry') {
        return retry === 'whole' ? { text: [R.head, R.clean, R.s3].join(NL), stop: 'end_turn', ms: t.door }
          : { text: fx.rewriteCut, stop: 'max_tokens', ms: t.door };
      }
      if (/-continue$/u.test(kind)) {
        const [what, stop] = doorConts[Math.min(n, doorConts.length) - 1];
        return { text: what === 'rest' ? fx.rewriteRest : what, stop, ms: t.doorCont };
      }
      return { text: [R.head, R.s3].join(NL), stop: 'end_turn', ms: 3000 };
    };
  };
  // «No time for the door»: the zakat witness — the draft caps at 157.6 s, its continuation ends at
  // 208.4 s, and a whole rewrite would need 105.8 s of the 71.6 s left.
  const NOTIME = { pre: 53748, times: { draft: 103852, cont: 50700 } };

  // ── L1–L3 the witness ──────────────────────────────────────────────────────────────────────────
  const l1 = await drive({ fixture: REJECT, pre: NOTIME.pre, script: script(REJECT, { times: NOTIME.times }) });
  ok('L1  refused for time: no reject call, and neither the credit nor its claim reaches the reader',
    has(l1, /^write_continue:no_time_for:reject_retry:\d+:-?\d+$/u) && has(l1, /^reject_retry:budget_spent:no_time$/u)
    && !l1.kinds.some((k) => k.startsWith('reject-')) && !text(l1).includes('ابن باز') && !text(l1).includes(R.claim.slice(0, -1)),
    brief(l1));
  ok('L2  ...the D13 line stands where the sentence stood, and the rest of the answer is there byte for byte',
    text(l1) === [R.head, SCHOLAR_LINE, R.s3].join(NL), brief(l1));
  ok('L3  ...and the lift alone does not tell the reader it stopped short: no marker, no reject_unrepaired, the lift named',
    l1.out.truncated === false && !has(l1, /reject_unrepaired/u) && has(l1, /^reject_lifted:1:1:0$/u), brief(l1));

  // ── L4 two credits of one kind: both go whole, the line is said once ─────────────────────────────
  const l4 = await drive({ fixture: TWO, pre: NOTIME.pre, script: script(TWO, { times: NOTIME.times }) });
  ok('L4  two rejected credits of one kind: both sentences go whole, and the line is said once',
    text(l4) === [R.head, SCHOLAR_LINE, R.s3].join(NL) && !text(l4).includes('ابن عثيمين')
    && !text(l4).includes('سنة مؤكدة') && l4.out.truncated === false && has(l4, /^reject_lifted:2:1:0$/u),
    brief(l4));

  // ── L5 the line is not said twice ───────────────────────────────────────────────────────────────
  const l5 = await drive({ fixture: ALREADY, pre: NOTIME.pre, script: script(ALREADY, { times: NOTIME.times }) });
  ok('L5  a line the answer already carries is not said again: the sentence goes, the line stands once',
    text(l5) === [R.head, SCHOLAR_LINE, R.s3].join(NL) && has(l5, /^reject_lifted:1:0:0$/u), brief(l5));

  // ── L6 the line is the rejected credit's, not the sentence's other holders' ─────────────────────
  // «ذكر ابن عثيمين أن الجمهور …»: the reviewer rejects the credit to the man; the sentence door would read
  // a majority in the same words, and a majority line here would say a text is missing that nobody judged.
  // (The reviewer's own khilaf notice, which «الجمهور» lit, stays below the answer: it is not this item's.)
  const MAJ = 'ذكر ابن عثيمين أن الجمهور على جواز الجمع للمسافر.';
  const SHAF = 'ذكر الشافعي أن ' + R.claim;
  const majority = { ...REJECT, draftCut: [R.head, MAJ, R.s3.slice(0, 90)].join(NL) };
  const shafii = { ...REJECT, draftCut: [R.head, SHAF, R.s3.slice(0, 90)].join(NL) };
  const l6 = await drive({ fixture: majority, pre: NOTIME.pre, script: script(majority, { times: NOTIME.times }) });
  const l6s = await drive({ fixture: shafii, pre: NOTIME.pre, script: script(shafii, { times: NOTIME.times }) });
  ok('L6  a rejected credit gets the sayer’s line whatever else its sentence names (a majority, a madhhab)',
    has(l6, /^reject_lifted:1:1:0$/u) && text(l6).startsWith([R.head, SCHOLAR_LINE, R.s3].join(NL)) && !text(l6).includes('الجمهور')
    && !text(l6).includes(RR.notFoundSentence({ kinds: ['majority'], madhhabs: [], book: '' }))
    && has(l6s, /^reject_lifted:1:1:0$/u) && text(l6s) === [R.head, SCHOLAR_LINE, R.s3].join(NL),
    brief(l6) + ' || ' + brief(l6s));

  // ── L7 scope: time for the door, none to continue its capped rewrite — §٣-ج stands ──────────────
  // The capped-notime clock of B1-MEASURE.md T3: the door starts at 215.2 s and fits; its rewrite caps at
  // 276.0 s and 4.0 s are left, so it is not continued and not adopted over the whole answer.
  const l7 = await drive({ fixture: REJECT, pre: 124206, script: script(REJECT, { times: { draft: 60894, cont: 29900, door: 60894 } }) });
  ok('L7  (scope) a door that ran and whose capped rewrite was refused keeps §٣-ج: the prefix, told «لم يكتملْ»',
    l7.kinds.includes('reject-retry:max_tokens') && has(l7, /^reject_retry:rewrite_cut_over_whole$/u)
    && text(l7).trim() === R.head && l7.out.truncated === true && !has(l7, /reject_lift/u),
    brief(l7));

  // ── L8 scope: time for the door, a clean rewrite — adopted as before ────────────────────────────
  const l8 = await drive({ fixture: REJECT, script: script(REJECT, { retry: 'whole' }) });
  ok('L8  (scope) a door with time adopts its clean rewrite exactly as before; nothing is lifted',
    has(l8, /^reject_retry:clean$/u) && !has(l8, /reject_lift/u) && l8.out.truncated === false
    && text(l8).includes('جمهور أهل العلم') && !text(l8).includes(SCHOLAR_LINE),
    brief(l8));

  // ── L9 the switch off ───────────────────────────────────────────────────────────────────────────
  // Nothing is continued with the switch off and no clock is asked, so the door runs on the same clock.
  const l9 = await drive({ fixture: REJECT, flag: false, pre: NOTIME.pre, script: script(REJECT, { times: NOTIME.times }) });
  ok('L9  the switch off: nothing is lifted and nothing is continued',
    !has(l9, /reject_lift/u) && !has(l9, /continue/u) && !text(l9).includes(SCHOLAR_LINE),
    brief(l9));

  // ── L10/L11 a sentence is found as whole lines ─────────────────────────────────────────────────
  // The reviewer leaves a sentence that quotes a verse, and a card, unannotated; when either ENDS in the very
  // words of the reviewer's cut, a substring search lands inside it (the order-C review, drive-quran.cjs).
  const VERSE = 'قال الله تعالى: ﴿يريد الله بكم اليسر ولا يريد بكم العسر﴾ فالجمع للمسافر جائز عند الحاجة.';
  const CARD = '<hadith source="مسلم">«جمع رسول الله ﷺ بين الظهر والعصر» فالجمع للمسافر جائز عند الحاجة.</hadith>';
  const verse = { ...REJECT, draftCut: [VERSE, R.named, R.s3.slice(0, 90)].join(NL) };
  const card = { ...REJECT, draftCut: [CARD, R.named, R.s3.slice(0, 90)].join(NL) };
  const l10 = await drive({ fixture: verse, pre: NOTIME.pre, script: script(verse, { times: NOTIME.times }) });
  ok('L10 an earlier verse sentence ending in the same words is untouched; the rejected sentence is the one lifted',
    has(l10, /^reject_lifted:1:1:0$/u) && text(l10).startsWith(VERSE + NL + SCHOLAR_LINE + NL)
    && text(l10).split(NL).filter((line) => line.trim() === R.claim).length === 0 && l10.out.truncated === false,
    brief(l10));
  const l11 = await drive({ fixture: card, pre: NOTIME.pre, script: script(card, { times: NOTIME.times }) });
  ok('L11 ...and so is an earlier card ending in them',
    has(l11, /^reject_lifted:1:1:0$/u) && text(l11).includes('فالجمع للمسافر جائز عند الحاجة.</hadith>')
    && text(l11).includes(SCHOLAR_LINE) && !text(l11).includes('وولم') && !text(l11).includes('فولم')
    && text(l11).split(NL).filter((line) => line.trim() === R.claim).length === 0,
    brief(l11));

  // ── L12 another shortfall still tells the reader ────────────────────────────────────────────────
  // The reader asked for a list and got none: the empty door, refused for time as well, keeps its shortfall.
  const listAsk = { ...REJECT, q: 'اذكر لي شروط الجمع للمسافر' };
  const l12 = await drive({ fixture: listAsk, pre: NOTIME.pre, script: script(listAsk, { times: NOTIME.times }) });
  ok('L12 another shortfall on the same turn still tells the reader; the lift is done all the same',
    has(l12, /^reject_lifted:1:1:0$/u) && has(l12, /^delivery_short:answer_without_substance:no_enumeration$/u)
    && !has(l12, /reject_unrepaired/u) && l12.out.truncated === true && text(l12).includes(SCHOLAR_LINE),
    brief(l12));

  console.log(`\n=== full-answer-reject-lift: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
