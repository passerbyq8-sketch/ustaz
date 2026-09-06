// guards/reject-door-guard.cjs — ق٥٥: THE GUARD RULES, AND IT DOES NOT EDIT.
//
// ── THE CONTRACT THIS GATE HOLDS, IN THE OWNER'S WORDS ───────────────────────
//
//   «لا يُمَدُّ مقصٌّ في نصٍّ عربيٍّ بعدَ اليوم. للحارسِ مخرَجانِ لا ثالثَ لهما: يقبلُ الجوابَ كما هو، أو
//    يرفضُه فيُعادُ توليدُه. ولا يُسلَّمُ نصٌّ قُصَّ منه شيءٌ ثمّ خِيطَ.»
//
// And, in the same breath and just as literally: «ولا يُضعَّفُ الحكمُ في الكذب» — what changed is the
// PENALTY, not the verdict. An unsupported attribution was disfigured before and is rewritten now.
//
// ── WHAT THIS GATE PROVES, AND HOW ──────────────────────────────────────────
//
// THE ONE CLAIM: an answer the reviewer cut is never delivered cut. It is proved by DRIVING the
// real `runFreeBrainTurn` against a scripted provider and reading the text the turn returns —
// never by reading the source and believing it. §D is the negative witness the order requires:
// the remedy is removed from a copy of loop.js, the same driven assertions are run against the
// twin, and each one must FAIL there. A green check that cannot go red proves nothing.
//
// THE SOURCE-SHAPE SECTION (§A) IS SMALL AND SAYS SO. Four of its checks — the block being an
// `if` and not a `while`, the absence of a `tools` key, the print sitting below the door, and the
// M17 anchor line surviving byte for byte — are properties of the TEXT of loop.js and are read as
// text. Every other claim in this file is executed.
//
// ── AND ONE CROSS-FILE WITNESS THAT DID NOT EXIST BEFORE (§A/5) ─────────────
//
// «Destructive» is defined THREE times in this tree and nothing checked that the definitions
// agree: `DESTRUCTIVE_ACTIONS` in lib/output-reviewer.js, a name-prefix regex in api/ask.js, and
// now `REJECTABLE_ACTIONS` in lib/free-brain/loop.js — the door's own trigger. The reviewer does
// not export its set and this item may not edit that file, so the copy ships with a witness: §A/5
// reads all three out of their files and fails when they are not the same three names. A fourth
// verdict added to the reviewer alone would otherwise stop opening this door in silence.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const LOOP = path.join(ROOT, 'lib', 'free-brain', 'loop.js');
const REVIEWER = path.join(ROOT, 'lib', 'output-reviewer.js');
const ASK = path.join(ROOT, 'api', 'ask.js');
const read = (file) => fs.readFileSync(file, 'utf8');

let checks = 0;
let failures = 0;
function ok(label, pass, detail) {
  checks += 1;
  if (pass) { console.log('  PASS  ' + label); return true; }
  failures += 1;
  console.log('  FAIL  ' + label);
  if (detail !== undefined) console.log('        ' + String(detail).slice(0, 600));
  return false;
}

// ── THE FIXTURES ────────────────────────────────────────────────────────────
// `NAMED` credits a scholar this turn has no page for, which is the one shape the reviewer treats
// destructively. `SOUND` names nobody. `TWO` is the pair, and it is the fixture that shows what
// «what stood before the point of rejection» means when something did stand there.
const SOUND_HEAD = 'الصلاة ركن من أركان الإسلام.';
const CLAIM = 'الجمع للمسافر جائز عند الحاجة.';
const NAMED = 'قال ابن باز إن ' + CLAIM;
const TWO = SOUND_HEAD + '\n' + NAMED;
const CLEAN_REWRITE = 'الجمع للمسافر جائز عند الحاجة عند جمهور أهل العلم.';

const fresh = (file, label) => import(pathToFileURL(file).href
  + '?' + encodeURIComponent(label) + '=' + Date.now() + '-' + Math.random());

function importsFromTree(source, originalFile) {
  return source.replace(/(['"])(\.\.?\/[^'"\r\n]+\.js)\1/gu, (_all, quote, specifier) => {
    const target = path.resolve(path.dirname(originalFile), specifier);
    return quote + pathToFileURL(target).href + quote;
  });
}

const PROVIDER = 'https://stub.invalid/v1/messages';
const textPayload = (text) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }] });
// A REAL tool round, not an injected table. `search_sources` runs `searchStoredCorpus` over the
// Kuwaiti fiqh encyclopedia in-process, so the rows are genuine — and a fiqh round with rows in
// hand is the ONE shape this loop will stream, which is what §C-E needs to exist at all.
const SEARCH = { search: 'الوضوء' };
const searchPayload = (query) => ({
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', id: 'reject-door-1', name: 'search_sources', input: { query } }],
});

/**
 * Drive the REAL turn: the real loop, the real reviewer, a scripted provider and nothing else on
 * the wire. `script` is the queue of answers, one per provider call; `THROW` makes that call fail.
 * The bodies each call was made with are captured, because «no `tools` key» is a claim about a
 * request and not about a comment.
 */
/** The same payload, spoken as the SSE frames this loop's own reader parses. */
function sseBody(payload) {
  const frames = [{ type: 'message_start', message: { content: [] } }];
  (payload.content || []).forEach((block, index) => {
    if (block.type === 'text') {
      frames.push({ type: 'content_block_start', index, content_block: { type: 'text', text: '' } });
      frames.push({ type: 'content_block_delta', index, delta: { type: 'text_delta', text: block.text } });
    } else {
      frames.push({ type: 'content_block_start', index, content_block: { ...block, input: undefined } });
      frames.push({
        type: 'content_block_delta',
        index,
        delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input || {}) },
      });
    }
    frames.push({ type: 'content_block_stop', index });
  });
  frames.push({ type: 'message_delta', delta: { stop_reason: payload.stop_reason } });
  frames.push({ type: 'message_stop' });
  const wire = frames.map((f) => 'data: ' + JSON.stringify(f) + '\n\n').join('');
  const chunk = new TextEncoder().encode(wire);
  let sent = false;
  return {
    getReader: () => ({
      read: async () => (sent ? { done: true } : ((sent = true), { done: false, value: chunk })),
    }),
  };
}

const THROW = Symbol('provider-throws');
async function drive(loopModule, script, extra = {}) {
  const realFetch = globalThis.fetch;
  const bodies = [];
  let call = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input?.url || input);
    if (!url.startsWith('https://stub.invalid/')) throw new Error('offline: ' + url);
    bodies.push(JSON.parse(String(init?.body ?? '{}')));
    const step = script[Math.min(call, script.length - 1)];
    call += 1;
    if (step === THROW) { const e = new Error('provider down'); e.status = 500; throw e; }
    // `typeof step === 'object'` and never `step.search`: on a plain string step that property
    // is String.prototype.search — a function, and truthy — so every text round would have been
    // answered with a tool call.
    const payload = (step && typeof step === 'object' && step.search)
      ? searchPayload(step.search) : textPayload(step);
    // A round the loop asked to STREAM is answered with a real SSE body, because that is the only
    // way `streamedThisTurn` can become true — and §C-E is a claim about a turn whose bytes the
    // reader has already seen.
    const requested = JSON.parse(String(init?.body ?? '{}'));
    if (requested.stream === true) {
      return { ok: true, status: 200, body: sseBody(payload), text: async () => '' };
    }
    return { ok: true, status: 200, json: async () => payload };
  };
  try {
    const out = await loopModule.runFreeBrainTurn({
      messages: [{ role: 'user', content: 'سؤال' }],
      system: 'أنت أستاذ.', model: 'stub', maxTokens: 1024,
      mode: 'عادي', lexicalRoute: 'DEEN', providerUrl: PROVIDER, headers: {},
      ...extra,
    });
    return { ...out, bodies };
  } finally {
    globalThis.fetch = realFetch;
  }
}

/** Mutate one module, import the twin, and hand it to `check`. */
async function mutate({ file, name, transform, check }) {
  const original = read(file);
  const changed = transform(original);
  if (changed === original) return { changed: false, loaded: false, result: null, error: 'seam moved' };
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-reject-door-'));
  const twin = path.join(temp, name.replace(/[^a-z0-9_-]/giu, '_') + '.mjs');
  fs.writeFileSync(twin, importsFromTree(changed, file), 'utf8');
  try {
    const twinModule = await fresh(twin, name);
    return { changed: true, loaded: true, result: await check(twinModule), error: null };
  } catch (error) {
    return { changed: true, loaded: false, result: null, error: error?.stack || String(error) };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

(async function main() {
  const loopSource = read(LOOP);
  const loop = await fresh(LOOP, 'reject-door');
  const RV = await fresh(REVIEWER, 'reject-door-reviewer');

  // ═══════════════════════════════════════════════════════════════════════════
  console.log('=== A. THE SHAPE OF THE DOOR (read as text, and named as such) ===');
  // ═══════════════════════════════════════════════════════════════════════════

  ok('A1 the ceiling is a named constant set to one',
    /^const MAX_REJECT_RETRIES = 1;$/mu.test(loopSource));

  // §٣-ب, letter for letter: «كتلةُ `if` لا `while` — نصًّا». A loop here is the one shape the
  // ceiling cannot bound from outside, because the block would re-enter after incrementing.
  const doorHead = /^ {2}(if|while) \(rejectRetries < MAX_REJECT_RETRIES$/mu.exec(loopSource);
  ok('A2 the door is an `if` block and not a loop', doorHead && doorHead[1] === 'if',
    doorHead && doorHead[0]);

  // §٤/٤ — M17 owns the CITATION block's first line by its exact shape, two leading spaces and
  // all (guards/no-empty-answer-guard.cjs). The reject door is a separate block precisely so that
  // line never has to move; if it ever does, that mutant disarms and nothing else fails.
  ok('A3 M17\'s anchor line is untouched, byte for byte and space for space',
    loopSource.includes('\n  if (citationRetries < MAX_CITATION_RETRIES\n'));
  ok('A4 ...and the reject door is its own block, not an arm of that one',
    loopSource.includes('\n  if (rejectRetries < MAX_REJECT_RETRIES\n')
    && !/citationRetries < MAX_CITATION_RETRIES[\s\S]{0,400}rejectRetries </u.test(loopSource));

  // ── A5. THE THIRD DEFINITION OF «DESTRUCTIVE», AND ITS FIRST WITNESS ──────
  const reviewerSource = read(REVIEWER);
  const askSource = read(ASK);
  const setBlock = /const DESTRUCTIVE_ACTIONS = new Set\(\[([\s\S]*?)\]\);/u.exec(reviewerSource);
  const mirrorBlock = /const REJECTABLE_ACTIONS = Object\.freeze\(\[([\s\S]*?)\]\);/u.exec(loopSource);
  const names = (block) => (block ? (block[1].match(/'([a-z-]+)'/gu) || []).map((s) => s.slice(1, -1)) : []);
  const reviewerNames = names(setBlock);
  const mirrorNames = names(mirrorBlock);
  ok('A5 the reviewer still declares exactly three destructive verdicts',
    reviewerNames.length === 3, JSON.stringify(reviewerNames));
  ok('A6 ...and the door\'s trigger list is that same list, name for name and in order',
    JSON.stringify(mirrorNames) === JSON.stringify(reviewerNames),
    JSON.stringify([mirrorNames, reviewerNames]));
  // The third definition, which was already in the tree unwitnessed. It is a name-PREFIX regex, so
  // the test is that every destructive name matches it — a fourth verdict outside those prefixes
  // would be invisible to `[free-brain/redactions]` and would report `minuteMissing` forever.
  const prefixRe = /(\/\^\(\?:[^/]+\/u)\.test\(String\(row\.action/u.exec(askSource);
  ok('A7 ...and api/ask.js\'s own prefix rule still recognises all three',
    Boolean(prefixRe) && reviewerNames.every((n) => new RegExp(prefixRe[1].slice(1, -2), 'u').test(n)),
    prefixRe && prefixRe[1]);

  // §٤/٢ — the ledger print must sit BELOW the door, or the platform log shows fewer rows than
  // the turn paid model calls for. Position is a text fact; §C7 proves the consequence.
  const printAt = loopSource.indexOf("console.log('[free-brain/round-ledger]'");
  const doorAt = loopSource.indexOf('  if (rejectRetries < MAX_REJECT_RETRIES');
  ok('A8 the round-ledger print sits below the reject door', doorAt > 0 && printAt > doorAt,
    JSON.stringify([doorAt, printAt]));

  // §٣-ب — the retry call carries no `tools` key and does not stream. §C4 proves it on the wire;
  // this reads the one line that makes it true so a reviewer can see the intent beside the fact.
  const doorBody = loopSource.slice(doorAt, printAt);
  ok('A9 the retry body is written with `stream: false` and no `tools` key',
    /stream: false,/u.test(doorBody) && !/\btools:/u.test(doorBody));
  ok('A10 the stream gate is named rather than inferred from control flow',
    /^ {2}const rejectGateOpen = !streamedThisTurn;$/mu.test(loopSource)
    && /^ {4}&& rejectGateOpen$/mu.test(loopSource));

  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n=== B. THE THREE PURE FUNCTIONS, DRIVEN ===');
  // ═══════════════════════════════════════════════════════════════════════════

  const reviewOf = (text) => RV.reviewAnswer({ text, evidence: [], domain: 'fiqh', mode: 'عادي' });
  const namedVerdict = reviewOf(NAMED);
  const soundVerdict = reviewOf(SOUND_HEAD);
  const twoVerdict = reviewOf(TWO);

  ok('B1 a cut answer counts as one rejection', loop.rejectedCount(namedVerdict.verdict) === 1,
    JSON.stringify(namedVerdict.verdict.counts));
  ok('B2 an answer that was only tagged counts as none',
    loop.rejectedCount(soundVerdict.verdict) === 0, JSON.stringify(soundVerdict.verdict.counts));
  ok('B3 ...and so does a verdict that never happened',
    loop.rejectedCount('unreviewed') === 0 && loop.rejectedCount(null) === 0);

  // «ويُذكَرُ فيها ما رُفِضَ بعينِه» — the note names the man and quotes the span, so the rewrite is
  // not asked to guess which of its own sentences the guard refused.
  const list = loop.rejectedList(namedVerdict.verdict, namedVerdict.annotations);
  ok('B4 the note names the man it credited', list.includes('ابن باز'), JSON.stringify(list));
  ok('B5 ...and quotes the span that was rejected', list.includes(CLAIM.slice(0, 12)),
    JSON.stringify(list));
  ok('B6 ...and says nothing at all when nothing was rejected',
    loop.rejectedList(soundVerdict.verdict, soundVerdict.annotations) === '');

  // §٣-ج — a PREFIX at a boundary the reviewer itself drew. Not a repair, not a suture.
  const sound = loop.textBeforeFirstRejection(twoVerdict);
  ok('B7 what stood before the rejection is returned whole and untouched', sound === SOUND_HEAD,
    JSON.stringify(sound));
  ok('B8 ...and not one character of the rejected sentence comes with it',
    !sound.includes(CLAIM) && !sound.includes('ابن باز'), JSON.stringify(sound));
  ok('B9 ...and an answer whose FIRST sentence is the rejected one yields nothing, not a guess',
    loop.textBeforeFirstRejection(namedVerdict) === '',
    JSON.stringify(loop.textBeforeFirstRejection(namedVerdict)));
  ok('B10 ...and an answer with no rejection in it is returned entire',
    loop.textBeforeFirstRejection(soundVerdict) === soundVerdict.text);

  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n=== C. THE DRIVEN TURN: A CUT ANSWER IS NEVER DELIVERED CUT ===');
  // ═══════════════════════════════════════════════════════════════════════════

  // C-A — EXIT ONE: «يقبلُ الجوابَ كما هو». Nothing was cut, so nothing happens. This is the
  // 92.6% case and it must cost exactly what it cost yesterday.
  const accepted = await drive(loop, [SOUND_HEAD]);
  ok('C1 an answer with no cut in it is delivered as it stands',
    accepted.text.includes(SOUND_HEAD) && accepted.rejectRetries === 0
    && accepted.modelCalls === 1 && accepted.rejectWithheld === false,
    JSON.stringify([accepted.text, accepted.rejectRetries, accepted.modelCalls]));
  ok('C2 ...and the door leaves no word of itself in the log of a turn it did not open',
    !(accepted.degraded || []).some((d) => /^reject_/u.test(d)),
    JSON.stringify(accepted.degraded));

  // C-B — EXIT TWO, ADOPTED: «أو يرفضُه فيُعادُ توليدُه». The rewrite comes back clean and IS the
  // answer, reviewed a second time before a byte of it is trusted.
  const rewritten = await drive(loop, [NAMED, CLEAN_REWRITE]);
  ok('C3 a cut answer is rejected, rewritten, and the rewrite is what the reader gets',
    rewritten.text.includes('جمهور أهل العلم') && rewritten.rejectRetries === 1
    && rewritten.modelCalls === 2 && rewritten.rejectWithheld === false,
    JSON.stringify([rewritten.text, rewritten.rejectRetries, rewritten.modelCalls]));
  ok('C4 ...on a call carrying no tools and no stream, so it can spend no search',
    rewritten.bodies.length === 2 && !('tools' in rewritten.bodies[1])
    && rewritten.bodies[1].stream === false,
    JSON.stringify(Object.keys(rewritten.bodies[1] || {})));
  ok('C5 ...and the rewrite is REVIEWED before it is delivered, not shipped unread',
    rewritten.verdict && rewritten.verdict.counts
    && !rewritten.verdict.counts['removed-unsupported-attribution'],
    JSON.stringify(rewritten.verdict && rewritten.verdict.counts));
  ok('C6 ...and the sutured first draft reaches the reader in no form at all',
    !rewritten.text.includes(RV.REVIEW_TAGS.ATTRIBUTION_REMOVED)
    && !rewritten.text.includes('ابن باز'), JSON.stringify(rewritten.text));
  // §٤/٢ and §٨/٨ — the printed ledger and the paid calls are the same number.
  ok('C7 ...and the round ledger carries one row per provider call, the retry included',
    (rewritten.roundLedger || []).length === rewritten.modelCalls
    && (rewritten.roundLedger || []).some((row) => row.phase === 'reject-retry'),
    JSON.stringify([(rewritten.roundLedger || []).map((r) => r.phase), rewritten.modelCalls]));
  ok('C8 ...and the cost of the door is a number in the log, not a story',
    (rewritten.degraded || []).includes('reject_retry:clean')
    && (rewritten.degraded || []).some((d) => /^reject_retry_ms:\d+$/u.test(d)),
    JSON.stringify(rewritten.degraded));

  // C-C — §٣-ج: THE SECOND ROUND IS CUT TOO. The reader gets what stood before the rejection,
  // whole, under the «لم يكتملْ» frame — and the rejected sentence in no form whatever.
  const withheld = await drive(loop, [TWO, TWO]);
  ok('C9 a second cut answer is withheld, not delivered mangled',
    withheld.text === SOUND_HEAD && withheld.rejectWithheld === true,
    JSON.stringify(withheld.text));
  ok('C10 ...and NOT ONE CHARACTER of the unsupported attribution reaches the reader',
    !withheld.text.includes('ابن باز') && !withheld.text.includes(CLAIM)
    && !withheld.text.includes(RV.REVIEW_TAGS.ATTRIBUTION_REMOVED),
    JSON.stringify(withheld.text));
  ok('C11 ...and the turn says the answer stopped short, so the client draws the «كمّل» line',
    withheld.truncated === true, JSON.stringify(withheld.truncated));
  ok('C12 ...and it is named in the log with the size of what survived',
    (withheld.degraded || []).includes('reject_retry:still_cut:1')
    && (withheld.degraded || []).includes('reject_withheld:' + SOUND_HEAD.length),
    JSON.stringify(withheld.degraded));

  // §٤/١ — AND THE PREFIX COMES OFF THE DRAFT THAT ACTUALLY EXISTS. `proposedRows` and
  // `readerText` are derived thirteen lines above the reviewer, so a rewrite adopted without
  // re-deriving them and re-reviewing carries the FIRST draft's verdict. Here the rewrite DROPS
  // the sound opening sentence and keeps only the unsupported one, so a turn reading the stale
  // verdict would hand the reader a sentence the second round never wrote.
  const staleRisk = await drive(loop, [TWO, NAMED]);
  ok('C9b the withheld prefix is taken from the round that was actually written',
    staleRisk.text === '' && !staleRisk.text.includes(SOUND_HEAD),
    JSON.stringify(staleRisk.text));

  // C-D — THE EXTRA CALL FAILED. This is where the door parts company with the citation retry
  // above it: that one delivers the first answer, because an uncited ruling is still true. Here
  // the first answer IS the forbidden shape, so a failed call cannot be a licence to ship it.
  const failed = await drive(loop, [TWO, THROW]);
  ok('C13 a retry that never arrived does not license delivering the sutured draft',
    failed.text === SOUND_HEAD && failed.rejectWithheld === true
    && !failed.text.includes('ابن باز'), JSON.stringify(failed.text));
  ok('C14 ...and the failure is named rather than folded into another counter',
    (failed.degraded || []).some((d) => /^reject_retry:error:/u.test(d)),
    JSON.stringify(failed.degraded));
  ok('C15 ...and a call that threw bought no ledger row and no model call',
    failed.modelCalls === 1 && (failed.roundLedger || []).length === 1,
    JSON.stringify([failed.modelCalls, (failed.roundLedger || []).length]));

  // C-E — §٤/٣ / P6: the one turn the door may not open. Bytes the reader has already watched
  // arrive are the reader's, and withholding them is worse than either other exit.
  //
  // AND THE LIMIT OF ق٥٥ IS HERE, STATED RATHER THAN HIDDEN: on a turn that has streamed, the
  // sutured text ships. §٤/٣ of the order chose that trade deliberately — withdrawing a sentence
  // the reader watched arrive is the worse of two bad moves — so this check asserts the CUT TEXT
  // IS DELIVERED, which is the one place in this file where that is the passing outcome.
  const streamed = await drive(loop, [SEARCH, TWO], {
    env: { STREAM_V1: 'on' }, onWriteUnit: () => true,
  });
  ok('C16 a turn that has already put bytes on the wire keeps its answer, cut and all',
    streamed.streamedThisTurn === true && streamed.rejectRetries === 0
    && streamed.rejectWithheld === false
    && streamed.text.startsWith(SOUND_HEAD)
    && streamed.text.includes(RV.REVIEW_TAGS.ATTRIBUTION_REMOVED),
    JSON.stringify([streamed.streamedThisTurn, streamed.rejectRetries, streamed.text]));
  ok('C17 ...and the suppression is recorded rather than passing in silence',
    (streamed.degraded || []).includes('reject_retry:suppressed_on_stream'),
    JSON.stringify(streamed.degraded));

  // C-F — the two exits E6/E7 have nothing to rewrite. The reviewer's last rung is an honest
  // declaration, not a cut, and withholding it would replace silence with silence.
  const nothing = await drive(loop, ['']);
  ok('C18 an answer that was never written is not «rejected»: the last rung stands',
    nothing.text === RV.REVIEW_LAST_RESORT && nothing.rejectRetries === 0
    && nothing.rejectWithheld === false, JSON.stringify(nothing.text));

  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n=== D. THE NEGATIVE WITNESS: WITH THE REMEDY REMOVED, THIS GATE GOES RED ===');
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // §٥ of the order, and it is the condition on this gate existing at all: «تحمرُّ متى نُزِعَ
  // العلاج». Each mutant below removes one half of the door from a COPY of loop.js and re-runs
  // the very assertions that passed above. Anything that survives is an assertion that was never
  // testing what its label says.

  // D1 — THE WHOLE DOOR NEUTERED. The trigger is forced to zero, which is the tree as it stood
  // before this item: the reviewer cuts, and the cut text ships.
  const neutered = await mutate({
    file: LOOP,
    name: 'reject-door-never-opens',
    transform: (src) => src.replace(
      "  const rejectedFirst = readerText.trim() === '' ? 0 : rejectedCount(reviewed.verdict);",
      '  const rejectedFirst = 0; // mutant: the door never opens and the cut text ships'),
    check: async (twin) => {
      const cut = await drive(twin, [NAMED, CLEAN_REWRITE]);
      const two = await drive(twin, [TWO, TWO]);
      return {
        c3: cut.rejectRetries === 1,
        c6: !cut.text.includes(RV.REVIEW_TAGS.ATTRIBUTION_REMOVED),
        c9: two.text === SOUND_HEAD,
        c10: !two.text.includes(CLAIM),
      };
    },
  });
  ok('D1 the «door never opens» mutant applies', neutered.changed, neutered.error);
  ok('D2 ...and its twin loads', neutered.loaded, neutered.error);
  ok('D3 RED WITHOUT THE REMEDY: C3, C6, C9 and C10 all fail on the neutered twin',
    neutered.loaded && neutered.result
    && !neutered.result.c3 && !neutered.result.c6
    && !neutered.result.c9 && !neutered.result.c10,
    JSON.stringify(neutered.result));

  // D2 — THE WITHHOLDING REMOVED, THE REWRITE KEPT. This is the half-built door: it pays for a
  // second round and then ships the sutured text anyway when that round is cut too. §٣-ج exists
  // because this is the shape a hurried implementation lands on.
  const noWithhold = await mutate({
    file: LOOP,
    name: 'second-cut-shipped-anyway',
    transform: (src) => src.replace(
      '    if (rejectedCount(reviewed.verdict) > 0) {\n      const sound = textBeforeFirstRejection(reviewed);',
      '    if (false) {\n      const sound = textBeforeFirstRejection(reviewed); // mutant: ship the second cut'),
    check: async (twin) => {
      const two = await drive(twin, [TWO, TWO]);
      return { c9: two.text === SOUND_HEAD, c10: !two.text.includes(CLAIM), c11: two.truncated === true };
    },
  });
  ok('D4 the «ship the second cut anyway» mutant applies', noWithhold.changed, noWithhold.error);
  ok('D5 ...and its twin loads', noWithhold.loaded, noWithhold.error);
  ok('D6 RED WITHOUT THE REMEDY: C9, C10 and C11 all fail when the withholding is removed',
    noWithhold.loaded && noWithhold.result
    && !noWithhold.result.c9 && !noWithhold.result.c10 && !noWithhold.result.c11,
    JSON.stringify(noWithhold.result));

  // D3 — THE SECOND REVIEW DROPPED. §٤/١: `proposedRows` and `readerText` are derived thirteen
  // lines above the reviewer, so a rewrite adopted without re-reviewing carries the FIRST draft's
  // verdict — which reads clean for the wrong reason.
  const noSecondReview = await mutate({
    file: LOOP,
    name: 'rewrite-delivered-unreviewed',
    transform: (src) => src.replace(
      '      reviewed = await reviewAnswer({\n        requestedIdentity,',
      '      const staleVerdictKept = await reviewAnswer({ // mutant: judge the rewrite, then ignore it\n        requestedIdentity,'),
    check: async (twin) => {
      const stale = await drive(twin, [TWO, NAMED]);
      return { c9b: stale.text === '', text: stale.text };
    },
  });
  ok('D7 the «rewrite delivered unreviewed» mutant applies', noSecondReview.changed, noSecondReview.error);
  ok('D8 ...and its twin loads', noSecondReview.loaded, noSecondReview.error);
  ok('D9 RED WITHOUT THE REMEDY: the stale verdict hands the reader a sentence round two never wrote',
    noSecondReview.loaded && noSecondReview.result && !noSecondReview.result.c9b,
    JSON.stringify(noSecondReview.result));

  // D4 — THE STREAM GATE REMOVED. P6 broken in the plainest way there is: text a reader has
  // already watched arrive is replaced by a second draft, or withheld outright.
  const noGate = await mutate({
    file: LOOP,
    name: 'reject-door-opens-mid-stream',
    transform: (src) => src.replace('  const rejectGateOpen = !streamedThisTurn;',
      '  const rejectGateOpen = true; // mutant: withdraw text the reader already has'),
    check: async (twin) => {
      const s = await drive(twin, [SEARCH, TWO, CLEAN_REWRITE], {
        env: { STREAM_V1: 'on' }, onWriteUnit: () => true,
      });
      return { c16: s.rejectRetries === 0 && s.text.startsWith(SOUND_HEAD) };
    },
  });
  ok('D10 the «open the door mid-stream» mutant applies', noGate.changed, noGate.error);
  ok('D11 ...and its twin loads', noGate.loaded, noGate.error);
  ok('D12 RED WITHOUT THE REMEDY: C16 fails once the stream gate is gone',
    noGate.loaded && noGate.result && !noGate.result.c16, JSON.stringify(noGate.result));

  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n=== E. THE ROSTER ===');
  // ═══════════════════════════════════════════════════════════════════════════
  const gates = JSON.parse(read(path.join(ROOT, 'gates.json')));
  ok('E1 gates.json lists this guard',
    gates.some((g) => g && g.script === 'guards/reject-door-guard.cjs'));
  ok('E2 .gitattributes pins it to LF',
    /guards\/reject-door-guard\.cjs text eol=lf/.test(read(path.join(ROOT, '.gitattributes'))));

  console.log('\n' + (failures ? 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'
    : 'OK: ' + checks + '/' + checks + ' checks passed.'));
  process.exit(failures ? 1 : 0);
}()).catch((e) => { console.error('GUARD THREW:', e); process.exit(2); });
