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
// ق٥٥ §١ — the owner witness, in fixture form: a QUOTED block and nothing else. The card is
// what the reader saw; the prose is what he did not.
const CARD = '<hadith narrator="مسلم" ruling="صحيح">مَنْ غَشَّنَا فَلَيْسَ مِنَّا</hadith>';
// A card with the rejected sentence behind it: the prefix is 76 bytes and zero prose.
const CARD_THEN_NAMED = CARD + '\n' + NAMED;

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
  // ق٥٧ §٤ — the module that decides what may leave early, read here so H3 measures the release
  // rule itself rather than believing a comment about it.
  const SS = await fresh(path.join(ROOT, 'lib', 'sentence-stream.js'), 'reject-door-stream');

  // ═══════════════════════════════════════════════════════════════════════════
  console.log('=== A. THE SHAPE OF THE DOOR (read as text, and named as such) ===');
  // ═══════════════════════════════════════════════════════════════════════════

  // ق٥٦ §٢ — AND THE CEILING IS NOW THE TURN'S, NOT THE DOOR'S. It was `MAX_REJECT_RETRIES`
  // until the order of ٢٠٢٦-٠٩-٠٦ §٢ replaced two independent budgets with one: «ميزانيّةُ
  // إعادةٍ واحدةٌ للدورِ كلِّه … سقفُها واحد». The name changed because the thing changed.
  ok('A1 the turn has ONE rewriting ceiling and it is a named constant set to one',
    /^const MAX_TURN_REWRITES = 1;$/mu.test(loopSource)
    && !/MAX_REJECT_RETRIES/u.test(loopSource));

  // §٣-ب, letter for letter: «كتلةُ `if` لا `while` — نصًّا». A loop here is the one shape the
  // ceiling cannot bound from outside, because the block would re-enter after incrementing.
  const doorHead = /^ {2}(if|while) \(rejectGateOpen$/mu.exec(loopSource);
  ok('A2 the door is an `if` block and not a loop', doorHead && doorHead[1] === 'if',
    doorHead && doorHead[0]);

  // §٤/٤ — M17 owns the CITATION block's first line by its exact shape, two leading spaces and
  // all (guards/no-empty-answer-guard.cjs). The reject door is a separate block precisely so that
  // line never has to move; if it ever does, that mutant disarms and nothing else fails.
  ok('A3 M17\'s anchor line is untouched, byte for byte and space for space',
    loopSource.includes('\n  if (citationRetries < MAX_CITATION_RETRIES\n'));
  ok('A4 ...and the reject door is its own block, not an arm of that one',
    loopSource.includes('\n  if (rejectGateOpen\n')
    && !/citationRetries < MAX_CITATION_RETRIES[\s\S]{0,400}rejectGateOpen/u.test(loopSource));

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
  const doorAt = loopSource.indexOf('  if (rejectGateOpen');
  ok('A8 the round-ledger print sits below the reject door', doorAt > 0 && printAt > doorAt,
    JSON.stringify([doorAt, printAt]));

  // §٣-ب — the retry call carries no `tools` key and does not stream. §C4 proves it on the wire;
  // this reads the one line that makes it true so a reviewer can see the intent beside the fact.
  const doorBody = loopSource.slice(doorAt, printAt);
  ok('A9 the retry body is written with `stream: false` and no `tools` key',
    /stream: false,/u.test(doorBody) && !/\btools:/u.test(doorBody));
  // ق٥٧ §٤ — AND THE GATE IS NARROWER THAN IT WAS. It read «did this turn stream»; it now reads
  // «was this sentence sent», and the two names it is built from are read here as text.
  ok('A10 the stream gate is named rather than inferred from control flow',
    /^ {2}const rejectGateOpen = !streamedThisTurn$/mu.test(loopSource)
    && /^ {4}\|\| \(emittedPrefix !== '' && !rejectionInsideEmitted\);$/mu.test(loopSource)
    && /^ {2}if \(rejectGateOpen$/mu.test(loopSource));
  ok('A15 the emitted bytes and the rejection boundary are both named, not inlined',
    /^ {2}const emittedPrefix = streamedThisTurn$/mu.test(loopSource)
    && /^ {2}const rejectionAt = rejectedFirst > 0 \? firstRejectionIndex\(reviewed\) : -1;$/mu
      .test(loopSource)
    && /^ {2}const rejectionInsideEmitted = streamedThisTurn$/mu.test(loopSource));
  // ق٥٧ §٤/١ — the rewrite is joined by the SAME function that pins `collected`, not by a
  // second rule that happens to agree with it today.
  ok('A16 the rewrite head is pinned with the same join `collected` is pinned with',
    /rewritten = deliverableText\(emittedPrefix !== ''[\s\S]{0,120}joinRoundTextsHeadPinned\(\[emittedPrefix,/u
      .test(loopSource));
  // ق٥٧ §٤/٢ — the predicate decides, and it decides BEFORE anything is committed.
  ok('A17 the emitted-prefix test is the condition the rewrite is adopted on',
    /^ {6}const rewriteKeepsEmitted = emittedPrefix === ''$/mu.test(loopSource)
    && /^ {6}if \(rewriteKeepsEmitted\) \{$/mu.test(loopSource)
    && loopSource.indexOf('const rewriteKeepsEmitted') < loopSource.indexOf('        reviewed = candidateReviewed;'));

  // ── A11-A14. ق٥٦ §٢ — ONE BUDGET, AND THE CITATION CEILING IS NOT IN IT ──
  //
  // The consequence is driven in §G; these four read the three text facts that make it true, so
  // a reviewer can see the intent beside the number.
  ok('A11 the budget is created once, above every door that can draw on it',
    (loopSource.match(/createRewriteBudget\(\)/gu) || []).length === 1
    && loopSource.indexOf('const rewriteBudget = createRewriteBudget();') < doorAt);
  // «واحدةٌ تكفي» is a MUTATION, so it is written last in the condition that reads it. A door
  // that asked for the call before deciding it wanted one would have spent the next door's.
  ok('A12 the door draws on the budget LAST, after it has decided it wants the call',
    /^ {2}if \(rejectGateOpen\n {4}&& rejectedFirst > 0\n {4}&& rewriteBudget\.take\('reject_retry'\)\) \{$/mu
      .test(loopSource));
  // §٢ of the order, by name: «وسقفُ إعادةِ الاستشهادِ MAX_CITATION_RETRIES لا يُمَسُّ ولا يُدمَجُ
  // في هذه الميزانيّة». Its own ceiling, its own counter, and no draw on the shared budget.
  // Bounded at the reject door's OWN banner and not at `doorAt`: the door's comment names the
  // budget in prose, and a check that reads a comment as code proves nothing.
  const citeBlock = loopSource.slice(
    loopSource.indexOf('  if (citationRetries < MAX_CITATION_RETRIES'),
    loopSource.indexOf('  // ── ق٥٥ §٣ — THE REJECT DOOR'));
  ok('A13 the citation retry keeps its own ceiling and draws nothing from the shared budget',
    /^const MAX_CITATION_RETRIES = 1;$/mu.test(loopSource)
    && citeBlock.length > 0 && !citeBlock.includes('rewriteBudget'));
  // The reasons stay distinct — what the order unified is the budget and not the naming.
  ok('A14 ...and every draw is taken under a named reason',
    !/rewriteBudget\.take\(\s*\)/u.test(loopSource)
    && loopSource.includes("rewriteBudget.take('reject_retry')"));

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

  // C-E — THE STREAMED TURN. ق٥٥ §٨/ب closed this door on every turn that had emitted a byte,
  // and said so in words: the sutured text shipped. THE ORDER OF ٢٠٢٦-٠٩-٠٦ ITEM (4) NARROWED
  // THAT GATE from «did this turn stream» to «was this sentence sent» — the whole of a streamed
  // turn is not sent, and a rejection lying after the emitted bytes has been read by nobody. What
  // is inviolable is unchanged and is asserted below: the delivered answer opens with the bytes
  // the reader already has, byte for byte.
  const streamed = await drive(loop, [SEARCH, TWO, SOUND_HEAD + '\n' + CLEAN_REWRITE], {
    env: { STREAM_V1: 'on' }, onWriteUnit: () => true,
  });
  ok('C16 a streamed turn whose rejection lies AFTER the emitted bytes is rewritten, not shipped cut',
    streamed.streamedThisTurn === true && streamed.rejectRetries === 1
    && !streamed.text.includes('ابن باز')
    && !streamed.text.includes(RV.REVIEW_TAGS.ATTRIBUTION_REMOVED),
    JSON.stringify([streamed.streamedThisTurn, streamed.rejectRetries, streamed.text]));
  ok('C17 ...and what the reader already read still opens the answer, byte for byte',
    streamed.streamedPrefix !== '' && streamed.text.startsWith(streamed.streamedPrefix)
    && streamed.streamPrefixValid === true,
    JSON.stringify([streamed.streamedPrefix, streamed.text.slice(0, 40)]));

  // C-F — the two exits E6/E7 have nothing to rewrite. The reviewer's last rung is an honest
  // declaration, not a cut, and withholding it would replace silence with silence.
  const nothing = await drive(loop, ['']);
  ok('C18 an answer that was never written is not «rejected»: the last rung stands',
    nothing.text === RV.REVIEW_LAST_RESORT && nothing.rejectRetries === 0
    && nothing.rejectWithheld === false, JSON.stringify(nothing.text));

  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n=== F. ق٥٥ §١ — WHAT «EMPTY» MEANS, MEASURED IN THE EYE OF THE READER ===');
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // THE WITNESS THIS SECTION EXISTS FOR, in the words of the owner: on a preview of this branch
  // the question «ما درجة حديث «من غشنا فليس منا»؟ ومن أخرجه؟» returned a hadith card, a
  // «فهمٌ لا فتوى» notice and a source link — and not one sentence of prose. Both of the door
  // emptiness tests were BYTE tests, so a block of quoted material passed both while answering
  // nothing. The rule in the order replaces them: «بادئةٌ لا تحملُ جملةَ نثرٍ واحدةً خارجَ كتلِ
  // البطاقاتِ والوسومِ والاقتباساتِ المهيكَلةِ هي بادئةٌ فارغة».

  ok('F1 the predicate: a card, a tag and a notice are not prose',
    loop.carriesReaderProse(CARD) === false
    && loop.carriesReaderProse(RV.REVIEW_TAGS.ATTRIBUTION_REMOVED) === false
    && loop.carriesReaderProse('') === false,
    JSON.stringify([loop.carriesReaderProse(CARD),
      loop.carriesReaderProse(RV.REVIEW_TAGS.ATTRIBUTION_REMOVED)]));
  // AND A COMPOSED BLOCK IS. `<steps>` carries what the model wrote, not what it quoted, and
  // the measurement of layer (4) counts «عنصر <steps>» as an answer unit in so many words. A
  // rule that folded it away would refuse the numbered answer that item exists to protect.
  ok('F2 ...and a sentence, and a composed <steps> block, are',
    loop.carriesReaderProse(SOUND_HEAD) === true
    && loop.carriesReaderProse('<steps><item>اغسل وجهك</item></steps>') === true,
    JSON.stringify([loop.carriesReaderProse(SOUND_HEAD),
      loop.carriesReaderProse('<steps><item>اغسل وجهك</item></steps>')]));

  // ── THE PAIR THE ORDER NAMES, DRIVEN ON THE REAL TURN ────────────────────
  // «بادئةٌ كلُّها بطاقةٌ ⟹ لا تُسلَّمُ · وبادئةٌ فيها جملةُ نثرٍ ⟹ تُسلَّمُ مع «لم يكتملْ»».
  const shell = await drive(loop, [CARD_THEN_NAMED, CARD_THEN_NAMED]);
  ok('F3 a prefix that is nothing but a card is NOT handed to the reader as an answer',
    shell.text === '', JSON.stringify(shell.text));
  // AND NO «لم يكتملْ» OVER A SHELL. `truncated` is what draws that line and the «كمّل» button
  // beside it, and offering to complete something that never began is the small lie this layer
  // exists to end. api/ask.js hands an empty turn its class (ب) apology instead.
  ok('F4 ...and the turn does not claim an answer stopped short when none started',
    shell.truncated !== true && shell.rejectWithheld === false,
    JSON.stringify([shell.truncated, shell.rejectWithheld]));
  ok('F5 ...and the size of what was dropped is a number in the log, not a silence',
    shell.degraded.some((d) => /^reject_prefix_marks_only:\d+$/u.test(d)),
    JSON.stringify(shell.degraded));
  const withProse = await drive(loop, [TWO, TWO]);
  ok('F6 a prefix that carries a sentence of prose IS delivered, and says it stopped short',
    withProse.text === SOUND_HEAD && withProse.truncated === true
    && withProse.rejectWithheld === true,
    JSON.stringify([withProse.text, withProse.truncated, withProse.rejectWithheld]));

  // ── AND THE SAME MEASURE ON THE REWRITE ITSELF ───────────────────────────
  // MEASURED, and this is the exit that actually reproduced the witness: a rewrite that answers
  // the refusal by deleting its own prose and keeping the card it quoted reviews CLEAN — there
  // is nothing left in it to reject — and shipped a shell with `truncated:false`, which is why
  // no «لم يكتملْ» line appeared at all.
  const rewriteShell = await drive(loop, [TWO, CARD]);
  ok('F7 a rewrite that kept the card and deleted its prose is not adopted',
    rewriteShell.text === SOUND_HEAD, JSON.stringify(rewriteShell.text));
  ok('F8 ...and it is named under its own outcome, not folded into «withheld»',
    rewriteShell.degraded.includes('reject_retry:rewrite_marks_only')
    && rewriteShell.degraded.some((d) => /^reject_rewrite_marks_only:\d+$/u.test(d)),
    JSON.stringify(rewriteShell.degraded));

  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n=== G. ق٥٦ §٢ — TWO DOORS IN ONE TURN BUY ONE EXTRA CALL, NOT TWO ===');
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // THE DOOR THAT COMES AFTER THIS ONE DOES NOT EXIST YET, so it is BUILT HERE, as a fixture and
  // named as one: a synthetic second door spliced into a copy of loop.js that asks for a
  // rewriting call of its own. That is the only honest way to assert a property of two doors
  // while one of them is still unwritten — and it is the shape layer (4) will land on.
  //
  // Both twins below are the SAME real loop with the SAME synthetic door. The only difference is
  // where the ceiling of the second door comes from: the shared budget, or a counter of its own.
  const LEDGER_PRINT = "  console.log('[free-brain/round-ledger]', JSON.stringify(roundLedger));";
  const DOOR_BANNER = '  // \u2500\u2500 \u0642\u0665\u0667 \u00a7\u0664 \u2014 THE DOOR ON A TURN THAT HAS ALREADY EMITTED BYTES \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500';
  const SECOND_DOOR_CALL = [
    '    await callProvider({ providerUrl, headers, signal,',
    '      body: { model, max_tokens: 64, system, messages: conversation, stream: false } });',
    '    modelCalls += 1;',
  ].join('\n');
  const sharedDoor = [
    '  // FIXTURE: a synthetic second door drawing on the budget of the turn.',
    "  if (rewriteBudget.take('empty_retry')) {",
    SECOND_DOOR_CALL,
    '  }',
    LEDGER_PRINT,
  ].join('\n');
  const splitDoor = [
    '  // FIXTURE: the same door with a budget of its OWN — the shape the order forbids.',
    '  let emptyRetries = 0;',
    '  if (emptyRetries < 1) {',
    '    emptyRetries += 1;',
    SECOND_DOOR_CALL,
    '  }',
    LEDGER_PRINT,
  ].join('\n');
  const twoDoors = async (door, name) => mutate({
    file: LOOP,
    name,
    transform: (src) => src.replace(LEDGER_PRINT, door),
    check: async (twin) => {
      const t = await drive(twin, [TWO, TWO, 'ثالث']);
      return { calls: t.modelCalls, budget: t.rewriteBudget, rejectRetries: t.rejectRetries };
    },
  });
  const shared = await twoDoors(sharedDoor, 'two-doors-one-budget');
  ok('G1 the two-door fixture applies and loads', shared.changed && shared.loaded, shared.error);
  // ONE WRITE + ONE REWRITE. The third generation the order names is the one that must not exist.
  ok('G2 two doors asking for a rewrite in one turn buy ONE extra provider call, not two',
    shared.result && shared.result.calls === 2, JSON.stringify(shared.result));
  ok('G3 ...and the budget says which door spent it, so the reasons stay distinct',
    shared.result && shared.result.budget
    && shared.result.budget.max === 1 && shared.result.budget.spent === 1
    && shared.result.budget.remaining === 0
    && JSON.stringify(shared.result.budget.reasons) === JSON.stringify(['reject_retry']),
    JSON.stringify(shared.result && shared.result.budget));
  // ── AND THE ORDER THE DOORS DRAW IN IS A DECISION, SO IT IS READABLE ────
  // MEASURED on the same fixture with the synthetic door moved ABOVE the reject door: the reject
  // door is then refused, the cut text ships, and the turn must say why. This is not a defect
  // being fixed — it is the consequence of one budget, made legible for whoever writes the second
  // door and has to choose which of the two goes first.
  const firstDoor = [
    '  // FIXTURE: a synthetic door drawing on the budget BEFORE the reject door.',
    "  if (rewriteBudget.take('empty_retry')) {",
    SECOND_DOOR_CALL,
    '  }',
    DOOR_BANNER,
  ].join('\n');
  const drawnFirst = await mutate({
    file: LOOP,
    name: 'second-door-draws-first',
    transform: (src) => src.replace(DOOR_BANNER, firstDoor),
    check: async (twin) => {
      const t = await drive(twin, [TWO, TWO, 'ثالث']);
      return {
        calls: t.modelCalls, retries: t.rejectRetries, budget: t.rewriteBudget,
        named: (t.degraded || []).some((d) => d === 'reject_retry:budget_spent:empty_retry'),
      };
    },
  });
  ok('G5 the «second door draws first» fixture applies and loads',
    drawnFirst.changed && drawnFirst.loaded, drawnFirst.error);
  ok('G6 a door refused because the budget is already spent still buys only one extra call',
    drawnFirst.result && drawnFirst.result.calls === 2 && drawnFirst.result.retries === 0
    && drawnFirst.result.budget && JSON.stringify(drawnFirst.result.budget.reasons) === JSON.stringify(['empty_retry']),
    JSON.stringify(drawnFirst.result));
  ok('G7 ...and it says so, naming the door that spent it, instead of failing in silence',
    drawnFirst.result && drawnFirst.result.named === true, JSON.stringify(drawnFirst.result));

  // A turn nobody rewrote leaves the budget where it found it — so «spent» means spent.
  const untouched = await drive(loop, [SOUND_HEAD]);
  ok('G4 a turn no door opened on leaves the budget unspent',
    untouched.rewriteBudget && untouched.rewriteBudget.spent === 0
    && untouched.rewriteBudget.remaining === 1,
    JSON.stringify(untouched.rewriteBudget));

  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n=== H. ق٥٧ §٤ — THE TURN THAT HAS ALREADY PUT BYTES ON THE WIRE ===');
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // WHAT MAY NOT BE TOUCHED IS `sent`, AND NOTHING WIDER. ق٥٥ §٨/ب closed the door on every
  // streamed turn because it read «this turn streamed» as «the reader has all of it». He has
  // the emitted prefix and no more.

  // THE SEAMS THE FIXTURES BELOW USE, WRITTEN ONCE. §D reuses two of them so that the mutant
  // twin and the fixture twin differ in exactly one rule.
  const EMITTED_LINE = [
    '  const emittedPrefix = streamedThisTurn',
    "    ? String((streamResult && streamResult.acceptedPrefix) || acceptedStreamPrefix || '') : '';",
  ].join('\n');
  const INSIDE_RULE = [
    '  const rejectionInsideEmitted = streamedThisTurn',
    '    && rejectionAt >= 0 && rejectionAt < emittedPrefix.length;',
  ].join('\n');
  // ق٥٨ §١ MOVED THIS SEAM BY ONE LINE and the constant moved with it: the head is still pinned
  // at index 0, and what changed is the TAIL — the part of it that merely restates the head is
  // not carried a second time. §J drives that; this constant only has to match the tree.
  const PINNED_JOIN = [
    "      rewritten = deliverableText(emittedPrefix !== ''",
    '        ? joinRoundTextsHeadPinned([emittedPrefix,',
    '          withoutRestatedHead(emittedPrefix, textOf(rejectPayload.content))])',
    '        : joinRoundTexts([textOf(rejectPayload.content)]));',
  ].join('\n');
  // FIXTURE, NOT MUTANT: it widens what was SENT, it does not remove a remedy. Through the real
  // unit stream the emitted prefix stops AT the sentence the reviewer will reject (H3 below
  // measures exactly that), so a provider script alone cannot produce a rejection lying inside
  // `sent`. Widening `emittedPrefix` to the whole reviewed text is the smallest honest way to
  // put the rejected sentence behind the eye of the reader.
  const widenEmitted = (src) => src.replace(EMITTED_LINE,
    "  const emittedPrefix = streamedThisTurn ? String(reviewed.text || '') : ''; // FIXTURE");
  const unpinHead = (src) => src.replace(PINNED_JOIN,
    '      rewritten = deliverableText(joinRoundTexts([textOf(rejectPayload.content)]));');

  // ── H1/H2 · A REJECTION INSIDE `sent` IS UNFIXABLE, AND THE DOOR DOES NOT TRY ──
  const allSent = await mutate({
    file: LOOP,
    name: 'fixture-everything-was-sent',
    transform: widenEmitted,
    check: async (twin) => {
      const t = await drive(twin, [SEARCH, TWO, CLEAN_REWRITE], {
        env: { STREAM_V1: 'on' }, onWriteUnit: () => true,
      });
      return {
        retries: t.rejectRetries, calls: t.modelCalls, text: t.text,
        named: (t.degraded || []).some((d) => /^reject_retry:inside_emitted_bytes:\d+\/\d+$/u.test(d)),
        budget: t.rewriteBudget,
      };
    },
  });
  ok('H1 the «everything was sent» fixture applies and loads', allSent.changed && allSent.loaded,
    allSent.error);
  // AND IT DOES NOT TRY: no second generation, no budget spent, and the sutured text ships
  // exactly as ق٥٥ §٨/ب left it. There is no frame in this protocol that withdraws a byte.
  ok('H2 a rejection lying inside the bytes already sent buys no rewrite at all',
    // TWO calls and no third: the tool round and the write this turn always pays for.
    allSent.result && allSent.result.retries === 0 && allSent.result.calls === 2
    && allSent.result.budget && allSent.result.budget.spent === 0
    && allSent.result.named,
    JSON.stringify(allSent.result));

  // ── H3 · AND THAT SHAPE DOES NOT ARISE THROUGH THE STREAM AS IT IS BUILT ──
  // MEASURED, on the reviewer unit stream itself: a sentence whose attribution the reviewer will
  // strip is never RELEASED as a unit — the release stops at it. So today the wire cannot carry
  // the sentence the door would want back. The gate is still closed, because that is a property
  // of another module which nothing here pins.
  const relStream = SS.createSentenceStream({
    evidence: [], domain: 'fiqh', mode: 'عادي', truncated: null, sources: [],
  });
  const releasedUnits = relStream.push(TWO + '\nوالله أعلم بالصواب في هذه المسألة.').join('\n');
  relStream.end();
  ok('H3 the unit stream never releases the sentence the reviewer is about to reject',
    !releasedUnits.includes('ابن باز') && !releasedUnits.includes(CLAIM),
    JSON.stringify(releasedUnits));

  // ── H4 · THE HEAD OF THE REWRITE IS PINNED EXACTLY AS `collected` IS ──────
  // The scripted rewrite below does NOT restate the emitted head. Without the pin the delivered
  // text would not begin with what the reader already read; with it, it does.
  const pinned = await drive(loop, [SEARCH, TWO, CLEAN_REWRITE], {
    env: { STREAM_V1: 'on' }, onWriteUnit: () => true,
  });
  ok('H4 a rewrite that did not restate the head still reopens with the emitted bytes',
    pinned.streamedPrefix !== '' && pinned.text.startsWith(pinned.streamedPrefix)
    && pinned.rejectRetries === 1 && pinned.streamPrefixValid === true
    && pinned.streamPrefixRepaired === false,
    JSON.stringify([pinned.streamedPrefix, pinned.text.slice(0, 60)]));
  // AND THE PRICE IS PRINTED RATHER THAN HIDDEN: the pin is the same rule `collected` uses, and
  // it carries the same cost — a rewrite that DOES restate the head puts it in twice.
  console.log('      [measure] emitted = ' + pinned.streamedPrefix.length
    + ' chars of a delivered ' + pinned.text.length
    + ' = ' + (pinned.text.length ? (pinned.streamedPrefix.length / pinned.text.length * 100).toFixed(1) : '0')
    + '% of the answer sat inside `sent`');

  // ── H5 · `streamPrefixValid` IS THE CONDITION, NOT A NOTE ────────────────
  // With the pin removed the rewrite loses the head. The rewrite is then NOT adopted: the reader
  // keeps what he read, told that it stopped short. This is the fallback the order names.
  const lostHead = await mutate({
    file: LOOP,
    name: 'rewrite-head-not-pinned',
    transform: unpinHead,
    check: async (twin) => {
      const t = await drive(twin, [SEARCH, TWO, CLEAN_REWRITE], {
        env: { STREAM_V1: 'on' }, onWriteUnit: () => true,
      });
      return {
        text: t.text, sent: t.streamedPrefix, truncated: t.truncated,
        outcome: (t.degraded || []).filter((d) => /reject_retry_prefix_lost|reject_stream_head_kept|reject_retry:stream_prefix_lost/.test(d)),
      };
    },
  });
  ok('H5 the «head not pinned» twin applies and loads', lostHead.changed && lostHead.loaded,
    lostHead.error);
  ok('H6 a rewrite that lost the emitted bytes is refused, and the reader keeps his head',
    lostHead.result && lostHead.result.text === lostHead.result.sent
    && lostHead.result.sent !== '' && lostHead.result.truncated === true,
    JSON.stringify(lostHead.result));
  ok('H7 ...and both halves of that decision are named in the log',
    lostHead.result
    && lostHead.result.outcome.some((d) => /^reject_retry_prefix_lost:\d+$/u.test(d))
    && lostHead.result.outcome.some((d) => /^reject_stream_head_kept:\d+$/u.test(d)),
    JSON.stringify(lostHead.result && lostHead.result.outcome));

  // ── H8 · THE SILENT ELSE ARM IN api/ask.js IS CLOSED FROM THIS SIDE ──────
  // WHAT IT COST WHILE IT WAS OPEN: finish() appends the remainder only when the sealed text
  // still starts with what it sent; on anything else it writes one `console.warn` and ends the
  // stream, so the reader lost EVERY byte after the head with nothing said to him. api/ask.js is
  // not this item's to edit, so the arm is closed by making its trigger unreachable: the twin
  // below removes BOTH upstream remedies at once and the last net still holds the promise.
  //
  // 🔴 AND «UNREACHABLE» IS TOO LARGE A WORD FOR WHAT THIS SECTION PROVES, WHICH IS WHY §L WAS
  // ADDED BELOW IT. What H9 shows is that the text THIS LOOP RETURNS always opens with the bytes
  // it sent — that trigger is closed. api/ask.js does not deliver that text: it delivers
  // `seal(text)`, and the seal is `lockTakhrij`, which REMOVES sentences. A removal that lands
  // inside the emitted prefix reopens the same arm from the other side, and §L drives it.
  const lastNet = await mutate({
    file: LOOP,
    name: 'pin-and-decision-both-gone',
    transform: (src) => unpinHead(src)
      .replace('      if (rewriteKeepsEmitted) {', '      if (true) { // mutant: adopt regardless'),
    check: async (twin) => {
      const t = await drive(twin, [SEARCH, TWO, CLEAN_REWRITE], {
        env: { STREAM_V1: 'on' }, onWriteUnit: () => true,
      });
      return {
        holds: t.streamedPrefix !== '' && t.text.startsWith(t.streamedPrefix),
        judged: t.streamPrefixValid, repaired: t.streamPrefixRepaired, truncated: t.truncated,
        named: (t.degraded || []).some((d) => /^stream_prefix_repaired:\d+\/\d+$/u.test(d)),
      };
    },
  });
  ok('H8 the «both remedies gone» twin applies and loads', lastNet.changed && lastNet.loaded,
    lastNet.error);
  ok('H9 the delivered text still opens with the emitted bytes, so the warn arm cannot fire',
    lastNet.result && lastNet.result.holds === true && lastNet.result.repaired === true
    && lastNet.result.truncated === true && lastNet.result.named === true,
    JSON.stringify(lastNet.result));
  // AND THE FAULT IS STILL VISIBLE. A field that reported the repair instead of the fault would
  // be a field that could never see the fault again.
  ok('H10 ...and the judgement still records that the prefix HAD been lost',
    lastNet.result && lastNet.result.judged === false, JSON.stringify(lastNet.result));

  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n=== L. WHAT IS STILL OPEN, DRIVEN RATHER THAN ASSERTED AWAY ===');
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // THE OWNER’S SECOND WITNESS WAS NOT ANY EXIT OF THIS DOOR, and this section is where that is
  // recorded instead of being left as a story in a report. «ما حكم صيام يوم عرفة لغير
  // الحاج؟» came back as a sound opening, an announcement of evidence ending in a colon, and then
  // nothing at all: no حديث, no card, and no «لم يكتملْ» line. §K closed the two exits of this
  // door that were silent. NEITHER OF THEM PRODUCED THAT ANSWER.
  //
  // WHAT PRODUCED IT, MEASURED BELOW: the loop hands api/ask.js a text that opens with the bytes
  // it streamed — ق٥٧ §٤/٣ holds, L1 — and api/ask.js then delivers `seal(text)`. The seal is
  // `lockTakhrij`, which removes an unsupported تخريج AND the now-dangling sentence that
  // announced it. Both of those lay INSIDE the emitted prefix, so the sealed text no longer
  // opens with what was sent (L2), and finish() answers that with one `console.warn` and closes
  // the stream on the head (L3). The reader keeps exactly what he had already read.
  //
  // `truncated` NEVER HAD A CHANCE AT IT, and that is the point worth writing down: the sentence
  // was not cut by the reviewer and not withheld by this door. It was removed AFTER
  // `runFreeBrainTurn` returned, in a file this item may not edit, and the «<incomplete/>» mark
  // is itself part of the tail that arm discards. NOTHING IN lib/ CAN RAISE A FLAG ABOUT IT.

  const L_S1 = 'صيام يوم عرفة لغير الحاج من أعظم أيام صيام التطوع أجرا، بل هو أفضل أيام السنة.';
  const L_S2 = 'وقد ثبت عن النبي صلى الله عليه وسلم:';
  const L_S3 = '«صيام يوم عرفة أحتسب على الله أن يكفر السنة التي قبله والسنة التي بعده» رواه مسلم.';
  const L_S4 = 'وعليه فصيامه سنة مؤكدة لغير الحاج عند جمهور أهل العلم.';
  const L_ANSWER = [L_S1, L_S2, L_S3, L_S4].join('\n');
  const TK = await fresh(path.join(ROOT, 'lib', 'takhrij-lock.js'), 'reject-door-takhrij');
  const lTurn = await drive(loop, [SEARCH, L_ANSWER], {
    env: { STREAM_V1: 'on' }, onWriteUnit: () => true,
  });
  const lSent = lTurn.streamedPrefix || '';
  const lComposed = (lTurn.text || '') + (lTurn.truncated === true ? '\n<incomplete/>' : '');
  // api/ask.js:1020 — `seal`, with the page list a turn that reached no web page actually has.
  const lSealed = TK.lockTakhrij(lComposed, []).text;

  ok('L1 the loop keeps its own promise: what it returns opens with the bytes it streamed',
    lSent !== '' && (lTurn.text || '').startsWith(lSent) && lTurn.streamPrefixValid === true,
    JSON.stringify([lSent.length, (lTurn.text || '').slice(0, 40)]));
  ok('L2 ...and api/ask.js\u2019s own seal then removes a sentence that lay INSIDE those bytes',
    lSealed !== '' && !lSealed.startsWith(lSent) && lSealed.includes(L_S1)
    && !lSealed.includes(L_S2), JSON.stringify(lSealed.slice(0, 120)));
  // THE ARM ITSELF IS READ AND NOT DRIVEN, because api/ask.js may not be edited or imported by
  // this item. The check is that the comparison is still there and still the one described; a
  // future item that answers the divergence differently changes this line and this prose with it.
  const finishArm = /if \(sealed\.startsWith\(sent\)\) \{[\s\S]{0,600}?\} else \{/u.exec(askSource);
  ok('L3 ...and api/ask.js still decides the whole tail on that one comparison',
    Boolean(finishArm), finishArm && finishArm[0].slice(0, 80));
  console.log('      [measure] the reader keeps ' + lSent.length + ' streamed chars and loses the '
    + Math.max(0, lSealed.length - lSent.length) + ' sealed chars behind them, with no «لم يكتملْ» line:');
  console.log('      [measure] READER = ' + JSON.stringify(lSent));

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
      '    } else if (rejectedCount(reviewed.verdict) > 0) {\n      const sound = textBeforeFirstRejection(reviewed);',
      '    } else if (false) {\n      const sound = textBeforeFirstRejection(reviewed); // mutant: ship the second cut'),
    check: async (twin) => {
      const two = await drive(twin, [TWO, TWO]);
      return { c9: two.text === SOUND_HEAD, c10: !two.text.includes(CLAIM), c11: two.truncated === true };
    },
  });
  ok('D4 the «ship the second cut anyway» mutant applies', noWithhold.changed, noWithhold.error);
  ok('D5 ...and its twin loads', noWithhold.loaded, noWithhold.error);
  ok('D6 RED WITHOUT THE REMEDY: C9 and C10 fail when the withholding is removed',
    noWithhold.loaded && noWithhold.result
    && !noWithhold.result.c9 && !noWithhold.result.c10,
    JSON.stringify(noWithhold.result));
  // AND C11 SURVIVES THIS MUTANT NOW, WHICH IS ق٥٨ §٢ WORKING AND NOT A HOLE. «The reader is
  // told» used to be a consequence of the withholding path; it is now a fact about the TURN —
  // the reviewer cut and no clean rewrite replaced what it cut — so removing the withholding
  // takes the prefix away and leaves the telling in place. C11 has its own mutants in §K/D.
  ok('D6b ...and the «لم يكتملْ» line survives it, because it no longer hangs on that path',
    noWithhold.loaded && noWithhold.result && noWithhold.result.c11 === true,
    JSON.stringify(noWithhold.result));

  // D3 — THE SECOND REVIEW DROPPED. §٤/١: `proposedRows` and `readerText` are derived thirteen
  // lines above the reviewer, so a rewrite adopted without re-reviewing carries the FIRST draft's
  // verdict — which reads clean for the wrong reason.
  const noSecondReview = await mutate({
    file: LOOP,
    name: 'rewrite-delivered-unreviewed',
    // ق٥٧ §٤/٢ moved the second review into a CANDIDATE that is committed only if it holds, so
    // the seam moved with it: the mutant now adopts the rewrite and keeps the first verdict,
    // which is the same defect said in the shape the code now has.
    transform: (src) => src.replace(
      '        reviewed = candidateReviewed;',
      '        // mutant: adopt the rewrite and judge it by the FIRST verdict'),
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

  // D4 — THE «ALREADY SENT» RULE REMOVED. P6 broken in the plainest way there is: the door tries
  // to withdraw a sentence the reader has already watched arrive. The twin is built on the SAME
  // widened-prefix fixture as §H so the two differ in exactly one rule.
  const noInsideRule = await mutate({
    file: LOOP,
    name: 'reject-door-withdraws-sent-bytes',
    transform: (src) => widenEmitted(src).replace(INSIDE_RULE,
      '  const rejectionInsideEmitted = false; // mutant: withdraw text the reader already has'),
    check: async (twin) => {
      const t = await drive(twin, [SEARCH, TWO, CLEAN_REWRITE], {
        env: { STREAM_V1: 'on' }, onWriteUnit: () => true,
      });
      return { h1: t.rejectRetries === 0, retries: t.rejectRetries };
    },
  });
  ok('D10 the «withdraw sent bytes» mutant applies', noInsideRule.changed, noInsideRule.error);
  ok('D11 ...and its twin loads', noInsideRule.loaded, noInsideRule.error);
  ok('D12 RED WITHOUT THE REMEDY: H1 fails — the door tries to rewrite what was already sent',
    noInsideRule.loaded && noInsideRule.result && !noInsideRule.result.h1,
    JSON.stringify(noInsideRule.result));

  // D5 — «FARIGHA» MEASURED IN BYTES AGAIN. This is the tree as this branch shipped it before
  // the order of ٢٠٢٦-٠٩-٠٦ §١, and it is the defect the owner saw: the shell is delivered, and
  // a «لم يكتملْ» line is drawn over an answer that never started.
  const bytesPrefix = await mutate({
    file: LOOP,
    name: 'prefix-emptiness-in-bytes',
    transform: (src) => src.replace('      const soundProse = carriesReaderProse(sound);',
      "      const soundProse = sound !== ''; // mutant: bytes, not prose"),
    check: async (twin) => {
      const t = await drive(twin, [CARD_THEN_NAMED, CARD_THEN_NAMED]);
      return { f3: t.text === '', f4: t.truncated !== true && t.rejectWithheld === false, text: t.text };
    },
  });
  ok('D13 the «emptiness in bytes» mutant applies', bytesPrefix.changed, bytesPrefix.error);
  ok('D14 ...and its twin loads', bytesPrefix.loaded, bytesPrefix.error);
  ok('D15 RED WITHOUT THE REMEDY: F3 and F4 both fail, and the shell reaches the reader',
    bytesPrefix.loaded && bytesPrefix.result
    && !bytesPrefix.result.f3 && !bytesPrefix.result.f4,
    JSON.stringify(bytesPrefix.result));

  // D6 — THE REWRITE ADOPTED ON BYTES. The other half of the same measure, and the exit that
  // actually reproduced the witness: a card-only rewrite reviews clean and ships.
  const bytesRewrite = await mutate({
    file: LOOP,
    name: 'rewrite-adopted-on-bytes',
    transform: (src) => src.replace('    if (carriesReaderProse(rewritten)) {',
      "    if (rewritten.trim() !== '') { // mutant: bytes, not prose"),
    check: async (twin) => {
      const t = await drive(twin, [TWO, CARD]);
      return { f7: t.text === SOUND_HEAD, text: t.text };
    },
  });
  ok('D16 the «rewrite adopted on bytes» mutant applies', bytesRewrite.changed, bytesRewrite.error);
  ok('D17 ...and its twin loads', bytesRewrite.loaded, bytesRewrite.error);
  ok('D18 RED WITHOUT THE REMEDY: F7 fails and the card-only rewrite is delivered as the answer',
    bytesRewrite.loaded && bytesRewrite.result && !bytesRewrite.result.f7,
    JSON.stringify(bytesRewrite.result));

  // D7 — THE BUDGET SPLIT PER DOOR. §٢ of the order, exactly: «ويُشحَنُ بمطفِّرٍ يفصلُ الميزانيّةَ
  // فيحمرُّ». The same synthetic second door as §G, given a counter of its own — and the third
  // generation layer (4) computed on paper appears as a third provider call.
  const split = await twoDoors(splitDoor, 'two-doors-split-budgets');
  ok('D19 the «split budgets» mutant applies and loads', split.changed && split.loaded, split.error);
  ok('D20 RED WITHOUT THE REMEDY: G2 fails — a split budget buys the third generation',
    split.result && split.result.calls === 3 && !(split.result.calls === 2),
    JSON.stringify(split.result));
  ok('D21 ...and the shared budget is the ONLY difference between the two twins',
    shared.result && split.result && shared.result.rejectRetries === split.result.rejectRetries,
    JSON.stringify([shared.result, split.result]));

  // D8 — THE LAST NET REMOVED. With the pin and the decision already gone, dropping the repair
  // is what actually reaches the reader as «the head, and then nothing, and a warning nobody
  // sees». This is the mutant for item (3), and it is measured on the same twin as H9.
  const noNet = await mutate({
    file: LOOP,
    name: 'prefix-repair-removed',
    transform: (src) => unpinHead(src)
      .replace('      if (rewriteKeepsEmitted) {', '      if (true) { // mutant: adopt regardless')
      .replace('    reviewed = { text: streamedPrefix, annotations: reviewed.annotations, verdict: reviewed.verdict };',
        '    // mutant: only a console.warn stands between the reader and a lost tail'),
    check: async (twin) => {
      const t = await drive(twin, [SEARCH, TWO, CLEAN_REWRITE], {
        env: { STREAM_V1: 'on' }, onWriteUnit: () => true,
      });
      return { holds: t.streamedPrefix !== '' && t.text.startsWith(t.streamedPrefix), text: t.text };
    },
  });
  ok('D22 the «prefix repair removed» mutant applies and loads', noNet.changed && noNet.loaded,
    noNet.error);
  ok('D23 RED WITHOUT THE REMEDY: H9 fails — the delivered text no longer opens with what was sent',
    noNet.loaded && noNet.result && noNet.result.holds === false, JSON.stringify(noNet.result));

  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n=== J. ق٥٨ §١ — THE HEAD IS PINNED ONCE, NOT PUT IN FRONT OF ITSELF ===');
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // THE WITNESS, in the owner’s words and off his own battery, not out of a fixture: he asked
  // for the ترجيح of a named shaykh, and what reached him opened with the same two sentences
  // TWICE. `joinRoundTextsHeadPinned` names that price in its own doc comment — «if the
  // finishing round restates the head, the reader now reads it twice» — and ق٥٧ §٤/١ accepted
  // it. It came due on the first real battery.
  //
  // AND THE PIN IS NOT WHAT IS REMOVED. H4 above still holds: a rewrite that did NOT restate the
  // head still reopens with the emitted bytes. What §J adds is the other half.

  const J_H1 = 'لم أجد في المصادر المتاحة فتوى منسوبة للشيخ في هذه المسألة.';
  const J_H2 = 'والذي وقفت عليه من ترجيحات أهل العلم فيها ثلاثة أقوال.';
  const J_HEAD = J_H1 + '\n' + J_H2;
  const J_FIRST = J_HEAD + '\n' + NAMED;
  const J_CLEAN = 'والأول هو الراجح عند جمهور أهل العلم.';
  const countOf = (hay, needle) => {
    let n = 0;
    let i = hay.indexOf(needle);
    while (i >= 0) { n += 1; i = hay.indexOf(needle, i + 1); }
    return n;
  };

  // ── J1-J3 · THE PREDICATE, DRIVEN ON ITS OWN ────────────────────────────
  ok('J1 a tail that restates the whole head loses exactly the restatement',
    loop.withoutRestatedHead(J_HEAD, J_HEAD + '\n' + J_CLEAN) === J_CLEAN,
    JSON.stringify(loop.withoutRestatedHead(J_HEAD, J_HEAD + '\n' + J_CLEAN)));
  ok('J2 ...and so does a tail that restates only PART of it, or restates it differently',
    loop.withoutRestatedHead(J_HEAD, J_H1 + '\n' + J_CLEAN) === J_CLEAN
    && loop.withoutRestatedHead(J_HEAD, J_H1 + '\n\n  ' + J_H2 + '\n' + J_CLEAN) === J_CLEAN
    && loop.withoutRestatedHead(J_HEAD, J_H1 + ' [1]\n' + J_H2 + ' [2]\n' + J_CLEAN).includes(J_CLEAN)
    && !loop.withoutRestatedHead(J_HEAD, J_H1 + ' [1]\n' + J_H2 + ' [2]\n' + J_CLEAN).includes(J_H2),
    JSON.stringify(loop.withoutRestatedHead(J_HEAD, J_H1 + ' [1]\n' + J_H2 + ' [2]\n' + J_CLEAN)));
  // THE SAFETY, AND IT IS THE WHOLE REASON THIS WORKS ON SENTENCES. A longest-common-prefix rule
  // would cut «الصلاة ركن من أركان الإسلام.» against «الصلاة ركن عظيم.» after «الصلاة ركن » and
  // hand the reader the fragment «عظيم.». Nothing here may ever return half a sentence.
  ok('J3 ...and a tail that merely BEGINS like the head is not touched at all',
    loop.withoutRestatedHead(SOUND_HEAD, 'الصلاة ركن عظيم.') === 'الصلاة ركن عظيم.'
    && loop.withoutRestatedHead('', J_CLEAN) === J_CLEAN
    && loop.withoutRestatedHead(J_HEAD, '') === '',
    JSON.stringify(loop.withoutRestatedHead(SOUND_HEAD, 'الصلاة ركن عظيم.')));

  // ── J4-J6 · AND ON THE REAL TURN, WHICH IS WHERE THE OWNER READ IT TWICE ──
  const restated = await drive(loop, [SEARCH, J_FIRST, J_HEAD + '\n' + J_CLEAN], {
    env: { STREAM_V1: 'on' }, onWriteUnit: () => true,
  });
  ok('J4 the emitted head really is the two sentences the rewrite will restate',
    restated.streamedPrefix === J_HEAD, JSON.stringify(restated.streamedPrefix));
  ok('J5 ...and the reader reads each of them ONCE',
    countOf(restated.text, J_H1) === 1 && countOf(restated.text, J_H2) === 1,
    JSON.stringify([countOf(restated.text, J_H1), countOf(restated.text, J_H2), restated.text]));
  // AND THE PROMISE ق٥٧ §٤/٣ BOUGHT IS NOT SOLD BACK TO PAY FOR THIS ONE.
  ok('J6 ...and what the reader already read still opens the answer, byte for byte',
    restated.text.startsWith(restated.streamedPrefix)
    && restated.streamPrefixValid === true && restated.streamPrefixRepaired === false
    && restated.rejectRetries === 1,
    JSON.stringify([restated.streamPrefixValid, restated.text.slice(0, 60)]));
  console.log('      [measure] a rewrite that restates a ' + J_HEAD.length
    + '-char head now delivers ' + restated.text.length + ' chars where it delivered '
    + (restated.text.length + J_HEAD.length + 1) + ' before');

  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n=== K. ق٥٨ §٢ — EVERY EXIT THAT HANDS THE READER LESS SAYS SO ===');
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // THE SECOND WITNESS: «رأسٌ سُلِّمَ وحدَه، والقارئُ لم يُخبَرْ». `truncated` read a chain of two
  // named booleans — `rejectWithheld` and `streamPrefixRepaired` — so an exit that set neither
  // was silent by default. TWO of the six exits at this site were exactly that.
  //
  // THE RULE IS NOW THE OTHER WAY ROUND, and §K proves it as a TABLE rather than as a list of
  // flags: for every exit, «did the reviewer cut something this turn did not get rewritten» is
  // the question, and the answer is what the reader is told. The one exception — an EMPTY
  // delivery is not an answer that stopped short — is F4 above and is named in the source.

  const K_S1 = 'صيام يوم عرفة لغير الحاج من أعظم أيام صيام التطوع أجرا.';
  const K_S2 = 'وقد ثبت عن النبي صلى الله عليه وسلم:';
  const K_WITNESS = K_S1 + '\n' + K_S2 + '\n' + NAMED;
  const K_CLEAN = 'وصيامه سنة مؤكدة عند جمهور أهل العلم.';
  const preSpend = (src) => src.replace(
    '  const rewriteBudget = createRewriteBudget();',
    '  const rewriteBudget = createRewriteBudget();\n'
    + "  rewriteBudget.take('fixture_second_door'); // FIXTURE: another door drew first");

  // K1 — THE ONE EXIT THAT MAY BE SILENT: the rewrite came back clean, so nothing is missing.
  const kClean = await drive(loop, [K_WITNESS, K_S1 + '\n' + K_S2 + '\n' + K_CLEAN]);
  ok('K1 a turn whose rejection WAS repaired says nothing about stopping short',
    kClean.truncated === false && kClean.text.includes(K_CLEAN)
    && !(kClean.degraded || []).some((d) => /^delivery_short:/u.test(d)),
    JSON.stringify([kClean.truncated, kClean.degraded]));

  // K2/K3 — the two exits that already told the reader, kept honest.
  const kCut = await drive(loop, [K_WITNESS, K_WITNESS]);
  const kThrew = await drive(loop, [K_WITNESS, THROW]);
  ok('K2 a second round that was cut too tells the reader, and names it in the log',
    kCut.truncated === true && (kCut.degraded || []).includes('delivery_short:reject_unrepaired'),
    JSON.stringify([kCut.truncated, kCut.degraded]));
  ok('K3 ...and so does a retry that never arrived',
    kThrew.truncated === true && (kThrew.degraded || []).includes('delivery_short:reject_unrepaired'),
    JSON.stringify([kThrew.truncated, kThrew.degraded]));

  // K4 — THE FIRST OF THE TWO SILENT EXITS: the door refused because the rejection lay inside
  // the bytes the reader already has. The sutured text ships — ق٥٥ §٨/ب, unchanged — and until
  // ق٥٨ §٢ it shipped with `truncated:false` and nothing said.
  const kInside = await mutate({
    file: LOOP,
    name: 'exit-rejection-inside-emitted',
    transform: widenEmitted,
    check: async (twin) => {
      const t = await drive(twin, [SEARCH, K_WITNESS, K_CLEAN], {
        env: { STREAM_V1: 'on' }, onWriteUnit: () => true,
      });
      return {
        truncated: t.truncated, retries: t.rejectRetries, withheld: t.rejectWithheld,
        repaired: t.streamPrefixRepaired,
        named: (t.degraded || []).includes('delivery_short:reject_unrepaired'),
      };
    },
  });
  ok('K4 the «rejection inside the emitted bytes» fixture applies and loads',
    kInside.changed && kInside.loaded, kInside.error);
  ok('K5 a door refused because the bytes were already sent still tells the reader',
    kInside.result && kInside.result.truncated === true && kInside.result.named === true
    // AND THE TWO OLD FLAGS ARE BOTH FALSE HERE, which is why the chain was silent.
    && kInside.result.withheld === false && kInside.result.repaired === false
    && kInside.result.retries === 0,
    JSON.stringify(kInside.result));

  // K6 — THE SECOND SILENT EXIT: the turn’s one rewriting call was spent by an earlier door.
  // This is the shape ق٥٦ §٢ logged and layer (4) will actually produce.
  const kSpent = await mutate({
    file: LOOP,
    name: 'exit-budget-already-spent',
    transform: preSpend,
    check: async (twin) => {
      const t = await drive(twin, [K_WITNESS, K_CLEAN]);
      return {
        truncated: t.truncated, retries: t.rejectRetries, withheld: t.rejectWithheld,
        named: (t.degraded || []).includes('delivery_short:reject_unrepaired'),
        budget: (t.degraded || []).some((d) => /^reject_retry:budget_spent:/u.test(d)),
      };
    },
  });
  ok('K6 the «budget already spent» fixture applies and loads', kSpent.changed && kSpent.loaded,
    kSpent.error);
  ok('K7 a door refused by the budget still tells the reader',
    kSpent.result && kSpent.result.truncated === true && kSpent.result.named === true
    && kSpent.result.withheld === false && kSpent.result.retries === 0
    && kSpent.result.budget === true,
    JSON.stringify(kSpent.result));

  // K8 — THE EXCEPTION, AND IT IS THE ONLY ONE. F3/F4 above measure the behaviour; this measures
  // that the exception was TAKEN rather than that the rule simply never fired.
  const kShell = await drive(loop, [CARD_THEN_NAMED, CARD_THEN_NAMED]);
  ok('K8 an EMPTY delivery is the one shortfall the reader is NOT told about, and the log says so',
    kShell.text === '' && kShell.truncated !== true
    && (kShell.degraded || []).includes(
      'delivery_short:reject_unrepaired:not_told_because_nothing_was_delivered'),
    JSON.stringify([kShell.text, kShell.truncated, kShell.degraded]));

  // ── K9-K11 · THE RULE IS WRITTEN IN THE CODE, NOT COUNTED IN THIS FILE ───
  //
  // §٢ of the order, letter for letter: «لا تعدُّ الأعلامَ واحدًا واحدًا في فحصٍ يمكنُ أن يُنسى،
  // بل اجعلِ الافتراضَ «يُخبَرُ القارئُ» والاستثناءَ مُسمًّى». So the three text facts that make the
  // default a default are read here — a check that enumerated exits would be the very thing the
  // order forbids.
  ok('K9 the returned flag reads the shortfall list and names no boolean of its own',
    /^ {4}truncated: readerIsToldItStoppedShort \? true : \(truncatedAfterReject \?\? truncated\),$/mu
      .test(loopSource)
    && !/truncated: \(rejectWithheld/u.test(loopSource), 'the truncated line');
  ok('K10 ...and the ONE way out of the default is assigned in exactly one place',
    (loopSource.match(/(?<!let )rejectionRepaired = /gu) || []).length === 1
    && loopSource.includes('        rejectionRepaired = rejectedSecond === 0;'),
    JSON.stringify((loopSource.match(/(?<!let )rejectionRepaired = [^;]*/gu) || [])));
  const firstLegAt = loopSource.indexOf("deliveryShortfall.push('reject_unrepaired')");
  ok('K11 ...and the default is applied BELOW the door, so an exit the door never took is covered',
    firstLegAt > doorAt && firstLegAt < printAt, JSON.stringify([doorAt, firstLegAt, printAt]));
  // AND THE SECOND LEG IS A MEASUREMENT AND NOT A THIRD FLAG. `judgedForDelivery` is taken from
  // the same `reviewed.text` the delivery is built from and folded the same way, so an ordinary
  // turn scores zero and any later shortening scores the prose the reader lost.
  ok('K12 ...and what actually goes out is measured against what the turn judged deliverable',
    /^ {2}const judgedForDelivery = foldWs\(dropOrphanRefNumbers\(String\(reviewed\.text \|\| ''\)\)\);$/mu
      .test(loopSource)
    && /^ {2}if \(foldWs\(deliveredText\)\.length < judgedForDelivery\.length\) \{$/mu.test(loopSource)
    && loopSource.indexOf('const judgedForDelivery') < loopSource.indexOf('const deliveredText ='),
    'the second leg');

  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n=== D (continued). THE NEGATIVE WITNESSES FOR J AND K ===');
  // ═══════════════════════════════════════════════════════════════════════════

  // D9 — ق٥٨ §١ REMOVED. The tail goes in whole and the head is put in front of itself: the
  // owner’s first witness, reproduced on a twin.
  const restatedTwice = await mutate({
    file: LOOP,
    name: 'restated-head-joined-twice',
    transform: (src) => src.replace('          withoutRestatedHead(emittedPrefix, textOf(rejectPayload.content))])',
      '          textOf(rejectPayload.content)]) // mutant: the head goes in front of itself'),
    check: async (twin) => {
      const t = await drive(twin, [SEARCH, J_FIRST, J_HEAD + '\n' + J_CLEAN], {
        env: { STREAM_V1: 'on' }, onWriteUnit: () => true,
      });
      return { j5: countOf(t.text, J_H1) === 1 && countOf(t.text, J_H2) === 1, text: t.text };
    },
  });
  ok('D24 the «head joined twice» mutant applies and loads',
    restatedTwice.changed && restatedTwice.loaded, restatedTwice.error);
  ok('D25 RED WITHOUT THE REMEDY: J5 fails and the reader reads the head twice',
    restatedTwice.loaded && restatedTwice.result && restatedTwice.result.j5 === false,
    JSON.stringify(restatedTwice.result));

  // D10 — ق٥٨ §٢ REMOVED: the flag put back on the chain of two booleans it used to read. This
  // is the tree as `d98f622` shipped it, and K5 and K7 are the two checks that go red on it.
  const flagChain = await mutate({
    file: LOOP,
    name: 'truncated-back-on-the-flag-chain',
    transform: (src) => preSpend(src).replace(
      '    truncated: readerIsToldItStoppedShort ? true : (truncatedAfterReject ?? truncated),',
      '    truncated: (rejectWithheld || streamPrefixRepaired) ? true : (truncatedAfterReject ?? truncated),'),
    check: async (twin) => {
      const t = await drive(twin, [K_WITNESS, K_CLEAN]);
      return { k7: t.truncated === true, truncated: t.truncated };
    },
  });
  ok('D26 the «flag chain» mutant applies and loads', flagChain.changed && flagChain.loaded,
    flagChain.error);
  ok('D27 RED WITHOUT THE REMEDY: K7 fails — a door refused by the budget goes out silent',
    flagChain.loaded && flagChain.result && flagChain.result.k7 === false,
    JSON.stringify(flagChain.result));

  // D11 — AND THE CLAIM THE ORDER ACTUALLY MAKES: «مسلكٌ جديدٌ يُضافُ إلى هذا الموضعِ ولا يُدرَجُ في
  // truncated يجبُ أن تحمرَّ به البوّابة». So a SEVENTH exit is spliced in — one that shortens the
  // delivery and names no flag at all, the way layer (4) will add one — and the same twin is run
  // twice: once against the rule as it now stands, and once with the flag back on the old chain.
  // The first must still tell the reader; the second must not. That pair is the claim.
  const NEW_EXIT = [
    '  // FIXTURE: a seventh exit, added the way a new one would be, naming no flag whatever.',
    '  if (rejectedFirst > 0 && String(reviewed.text || "").length > 40) {',
    '    reviewed = { text: String(reviewed.text).slice(0, 40), annotations: reviewed.annotations,',
    '      verdict: reviewed.verdict };',
    '  }',
  ].join('\n');
  const spliceNewExit = (src) => src.replace(
    '  const deliveredText = dropOrphanRefNumbers(reviewed.text) || reviewed.text;',
    NEW_EXIT + '\n  const deliveredText = dropOrphanRefNumbers(reviewed.text) || reviewed.text;');
  const newExitTold = await mutate({
    file: LOOP,
    name: 'a-seventh-exit-under-the-new-rule',
    transform: spliceNewExit,
    check: async (twin) => {
      const t = await drive(twin, [K_WITNESS, K_S1 + '\n' + K_S2 + '\n' + K_CLEAN]);
      return { told: t.truncated === true, len: (t.text || '').length };
    },
  });
  const newExitSilent = await mutate({
    file: LOOP,
    name: 'a-seventh-exit-under-the-old-chain',
    transform: (src) => spliceNewExit(src).replace(
      '    truncated: readerIsToldItStoppedShort ? true : (truncatedAfterReject ?? truncated),',
      '    truncated: (rejectWithheld || streamPrefixRepaired) ? true : (truncatedAfterReject ?? truncated),'),
    check: async (twin) => {
      const t = await drive(twin, [K_WITNESS, K_S1 + '\n' + K_S2 + '\n' + K_CLEAN]);
      return { told: t.truncated === true, len: (t.text || '').length };
    },
  });
  ok('D28 both «seventh exit» twins apply and load',
    newExitTold.changed && newExitTold.loaded && newExitSilent.changed && newExitSilent.loaded,
    JSON.stringify([newExitTold.error, newExitSilent.error]));
  // AND NOTE WHICH LEG CATCHES IT. This twin repairs its rejection cleanly, so the first leg is
  // silent by design — what tells the reader is the measurement of the delivery itself. That
  // is the difference between a default and a longer list.
  ok('D29 an exit nobody registered anywhere still tells the reader under the new rule',
    newExitTold.result && newExitTold.result.told === true, JSON.stringify(newExitTold.result));
  ok('D30 ...and goes out silent under the chain of flags it replaced',
    newExitSilent.result && newExitSilent.result.told === false,
    JSON.stringify(newExitSilent.result));
  // Both twins cut the SAME delivery, so the only difference between them is the rule.
  ok('D31 ...and the two twins differ in nothing but that rule',
    newExitTold.result && newExitSilent.result
    && newExitTold.result.len === newExitSilent.result.len,
    JSON.stringify([newExitTold.result, newExitSilent.result]));

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
