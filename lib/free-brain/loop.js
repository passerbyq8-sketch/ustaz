// lib/free-brain/loop.js — THE TOOL LOOP. The model reads the whole message and decides.
//
// ── WHAT A ROUND IS ──────────────────────────────────────────────────────────
// One provider call with the three tools offered and `tool_choice` left on AUTO. The model either
// calls tools — in which case every call is executed, the results are appended as tool_result
// blocks, and the loop goes round again — or it writes prose, in which case that prose is the
// answer and the loop ends. No round is forced, no tool is forced, and the number of rounds is
// the model's business up to MAX_TOOL_ROUNDS.
//
// THE SHIPPED PATH IS A TWO-ROUND PIPELINE WITH THE FIRST ROUND FORCED. `tool_choice: {type:
// 'tool', name: 'search_islamic_sources'}` on every DEEN turn, exactly one retrieval pass, then a
// second round with the tools REMOVED so it cannot search again. A first search that came back
// with the wrong wording could not be retried, because there was no third round to retry in. That
// is the defect this file exists to close, and it is why the loop is a loop.
//
// ── WHY ONLY THE TERMINAL WRITE MAY STREAM ───────────────────────────────────
// Tool rounds remain buffered because their text may become a head that `joinRoundTexts` keeps.
// P6 opens the finalized writer only for a head-free, tools-removed terminal call and only after
// the existing reviewer stream releases a stable unit. STREAM_V1 remains default-off; every other
// turn retains the buffered path measured by the earlier phases.
//
// ── THE ONE CALL TO BRANCH ب ─────────────────────────────────────────────────
// At the bottom of `runFreeBrainTurn`, once, on the finished text. §٧ requires exactly one call
// site and this is it.
//
// ── EVERY EXIT GOES THROUGH IT, NOT THE HAPPY PATH ONLY (merge §٢/٢) ────────
// The rule is structural, not a list of remembered cases: this function has ONE `return`, and
// the reviewer is above it. Everything that can stop the turn early appends to `written` (or
// appends nothing) and FALLS THROUGH to the same tail. Enumerated, because a list nobody can
// enumerate is a list nobody can check:
//
//   E1 the model wrote prose                stop !== 'tool_use', text    -> break -> tail
//   E2 the rounds ran out                   rounds === MAX_TOOL_ROUNDS   -> write -> tail
//   E3 the tool-phase clock ran out         deadline_write               -> write -> tail
//   E4 the model emitted no text block      stop !== 'tool_use', no text -> write -> tail
//   E5 a tool round's provider call threw   provider_error_tool_phase    -> write -> tail
//   E6 the final write's provider call threw  provider_error_write       -> tail with no new text
//   E7 nothing survived any of the above    `written` empty at the tail  -> reviewer's LAST_RESORT
//
// E4 IS WHY THE WRITE IS KEYED ON `finished` AND NOT ON THE TEXT. Before §٢ the write ran when
// `answer` was falsy, which was the same thing; it is not the same thing once earlier rounds can
// have filled the answer already. `finished` is set only where E1 is, and nowhere else.
//
// E5 AND E6 ARE WHY THE PROVIDER CALLS ARE WRAPPED. Before this round a throw from `callProvider`
// left `runFreeBrainTurn` entirely: no review, no evidence, no telemetry, and api/ask.js's outer
// catch wrote an SSE error frame. That is one exit that never met the checker and one reader who
// got a dead socket instead of the answer the evidence in hand already supported.
//
// E7 IS WHY `FREE_BRAIN_EMPTY` IS NOW UNREACHABLE. api/ask.js emits `out.text || FREE_BRAIN_EMPTY`.
// The reviewer's REVIEWER_INVARIANT_NON_EMPTY guarantees a non-empty string for every input
// INCLUDING the empty one — an empty proposal lands on the explicit last rung — so `out.text` is
// never falsy and the empty bubble has no exit left to come out of. The `||` stays as a belt: it
// costs nothing and it is the one thing standing between a future regression and a blank reply.

import { reviewAnswer } from './review.js';
import {
  FREE_BRAIN_TOOLS, MAX_TOOL_ROUNDS, MAX_CALLS_PER_TOOL, FREE_BRAIN_MAX_TOKENS,
  FREE_BRAIN_THINKING_DEFAULT, FREE_BRAIN_TOOL_PHASE_MS, MAX_RESULTS_PER_CALL,
  createEvidenceTable, runTool, renderEvidenceRows,
} from './tools.js';
import { lastUserText } from '../attribution.js';
import { OPEN_WEB_CAUTION, ROUND_TEXT_REMINDER, CITATION_RETRY_NOTE } from './instructions.js';
import { streamDecision } from './flag.js';
// P5 §٣. The reviewer on the sentence, so the delivery can hand the reader whole units
// instead of one buffered block. It is asked for UNITS only; the answer this turn ships is
// still composed below exactly as it was, byte for byte.
import { createSentenceStream } from '../sentence-stream.js';

// ── §٢ — HOW MANY WRITING ROUNDS A ZERO-CITATION RULING BUYS ──────────────────
// One. Written as a named constant rather than a bare `if` so the ceiling is a number a reader can
// see and a mutant can move, and so that «واحدةٌ فقط» is a property of this file rather than a fact
// about how its control flow happens to be shaped today.
const MAX_CITATION_RETRIES = 1;

// ── S1/§١ — THE STORED CORPUS IS OFFERED BEFORE THE FIRST PROVIDER CALL ──────
//
// MEASURED, and it is the whole reason this exists: of the turns this loop ran, FIFTY-FIVE never
// called a tool at all. Their `spend` is empty, so `domainOf` classified them religious from the
// lexical route alone — by the SAME deterministic key this block reads. The model was never
// offered the fatwa corpus on those turns, so «it did not cite» and «it was never shown anything»
// were the same event, and no amount of writing-round repair could tell them apart.
//
// WHAT THIS IS NOT. It is not a retrieval policy and it is not a threshold. `searchFatwas` is
// called exactly as ./tools.js calls it, and the composite admission gate inside
// lib/fatwa-service.js — the record's own title and published question, matched on canonical word
// tokens inside a proximity window — stays the sole judge of which rows exist at all. This block
// chooses WHEN to ask. It never chooses WHAT counts.
//
// WHY THE KEY IS THIS ONE. `out.domain` cannot serve: it is derived from what the turn SPENT, so
// it does not exist before the first call and is exactly the quantity a pre-call decision may not
// rest on. `storedContext.runtime` and `effectiveRoute` are computed in api/ask.js before any
// model call, from the current question alone.
const STORED_INJECTION_RUNTIMES = Object.freeze(['STORED_FIQH']);

// THE CEILING, AND IT IS THE ONE ALREADY DELIVERED. One tool call hands the model at most
// MAX_RESULTS_PER_CALL rows; an offer the model did not ask for may not hand it more than a
// request does. Written as its own name so it is a number a reader can see and a mutant can move.
export const STORED_INJECTION_MAX_ROWS = MAX_RESULTS_PER_CALL;

// CANDIDATE EVIDENCE, NOT AN ORDER TO CITE. The rows arrive unrequested, so the note says so, and
// says the model may leave them and search for itself. Anything stronger would buy citations by
// instruction, and a citation the evidence did not earn is the defect this round must not create.
const STORED_INJECTION_NOTE = 'أدلّةٌ مرشَّحةٌ من قسمِ الفتاوى، لم تطلبْها. وليست أمرًا بالاستشهاد: '
  + 'خُذْ منها ما يُجيبُ السؤالَ بعينِه، واتركْ ما لا يُجيبُه، ولكَ أن تبحثَ بنفسِك.';

/**
 * Does the deterministic key say «religious»?
 *
 * BOTH halves of it must say so. `lexicalRoute` here is api/ask.js's `effectiveRoute` and
 * `storedRuntime` is `storedContext.runtime`; a worldly turn fails both, which is what makes
 * «zero effect on the worldly» a property of this predicate rather than a hope about it.
 */
export function storedInjectionApplies(storedRuntime, lexicalRoute) {
  return lexicalRoute === 'DEEN' && STORED_INJECTION_RUNTIMES.includes(String(storedRuntime || ''));
}

/**
 * Attach the rendered rows to the reader's own turn as one extra text block.
 *
 * NOT A NEW MESSAGE. The tool loop below appends assistant/tool_result pairs onto the turn
 * structure it starts from; a second consecutive user turn would change that shape for every
 * round that follows. An extra content block changes neither the shape nor the reader's own
 * bytes, which stay first and stay verbatim.
 *
 * PURE. No caller object is mutated: api/ask.js hands `body.messages` straight in and reads that
 * array again after the turn returns.
 */
export function withCandidateEvidence(message, rendered) {
  const note = `${STORED_INJECTION_NOTE}\n\n${rendered}`;
  if (!message || typeof message !== 'object' || message.role !== 'user') return message;
  const content = typeof message.content === 'string'
    ? [{ type: 'text', text: message.content }]
    : (Array.isArray(message.content) ? [...message.content] : []);
  if (!content.length) return message;
  return { ...message, content: [...content, { type: 'text', text: note }] };
}

// The citation marker the tools hand out and the reader must never see. Tolerant of the model
// writing «[[3]]» or «[[3، 5]]» or «[[3]][[5]]», because it will do all three.
const CITE_RE = /\[\[\s*([0-9\s،,و]+?)\s*\]\]/gu;

/** Every ref the finished text actually cites, in first-appearance order. */
export function collectCited(text) {
  const out = [];
  for (const match of String(text || '').matchAll(CITE_RE)) {
    for (const piece of match[1].split(/[\s،,و]+/u)) {
      const ref = Number(piece);
      if (Number.isInteger(ref) && ref > 0 && !out.includes(ref)) out.push(ref);
    }
  }
  return out;
}

/**
 * ── §١/٢ (D): THE FOLD IS INSIDE THE LINE AND NEVER AT ITS HEAD ─────────────
 *
 * MEASURED in the same report as §١/١: `  const` reached the reader as ` const`. Three passes on
 * the delivery path collapsed every run of two or more spaces, and a run of two or more spaces at
 * the HEAD of a line is not a typographic accident — it is the indentation of a line of code, and
 * the base tree `3bb1c46` preserved it.
 *
 * ONE NAME AND ONE DEFINITION, for the three callers. A rule spelled out three times is a rule
 * that gets repaired twice, and the mutant that restores the old behaviour would have three seams
 * to move instead of one.
 */
const INNER_RUN_RE = /^([ \t]*)([^\n]*)$/gmu;
const foldInnerRun = (whole, lead, rest) => lead + rest.replace(/[ \t]{2,}/gu, ' ');

/** Remove the markers, leaving the prose the reader reads. */
export function stripCitations(text) {
  return String(text || '')
    .replace(CITE_RE, '')
    // A marker sat at the end of a sentence, so removing it leaves a space before the full stop.
    .replace(/[ \t]+([.،؟!:؛])/gu, '$1')
    .replace(INNER_RUN_RE, foldInnerRun)
    .replace(/[ \t]+\n/gu, '\n')
    .trim();
}

/**
 * ── §٣: WHICH CITATIONS ARE STILL IN THE TEXT THE READER RECEIVED ───────────
 *
 * THE DEFECT, MEASURED. `collectCited` used to run on the PROPOSAL and the card list was built
 * from its answer, while `reviewAnswer` ran afterwards on the same text and was free to replace
 * the very sentence that had cited. The card outlived its sentence. That is XI-05: a full ayah
 * card drawn under «ما حكم صيام يوم عرفة لغير الحاج؟» whose displayed text is mostly the
 * forbidden meats, under prose that never refers to a verse at all.
 *
 * WHY THE MARKERS ARE NOT SIMPLY CARRIED THROUGH THE REVIEWER, which would have been the literal
 * reading of «the citations remaining in the finally delivered text». MEASURED, not assumed: with
 * a marker inside the sentence the reviewer's verdict is byte-identical on 16 of 16 probes, but
 * `supportsSentence` feeds the sentence to `numericFacts`, and every fact in the sentence must be
 * present in the source snippet. A marker is a NUMBER. `[[3]]` therefore invents a numeric fact
 * that no snippet can carry, and a correctly attributed sentence would lose its attribution
 * because of the bracket we added to it. The reviewer is also branch ب's file this round and its
 * input shape is not ours to change. So the delivered text is measured instead of instrumented.
 *
 * HOW THE MEASUREMENT WORKS. Each citation is anchored to the TAIL of the sentence that carried
 * it — the last `ANCHOR_CHARS` characters, whitespace folded. Every non-destructive thing the
 * reviewer does to a sentence preserves that tail: it appends a tag after the full stop, it
 * appends the khilaf clause, it appends a dated source line, or it lifts an attribution frame out
 * of the FRONT. The two things that destroy a sentence — replacing an unsupported dynamic claim,
 * and the last rung — destroy the tail with it. So «is the tail still in the delivered text» is
 * the question «did the sentence survive», and it needs no knowledge of the reviewer's internals
 * and no list of its action names to stay true when branch ب adds another one.
 */
const ANCHOR_CHARS = 24;
// Below this there is not enough sentence to identify: «نعم.» would match anywhere. Too short to
// measure means KEEP — this filter may drop a card it can prove is orphaned, never one it cannot.
const ANCHOR_MIN = 8;
const foldWs = (value) => String(value ?? '').replace(/\s+/gu, ' ').trim();
const SENTENCE_END = /[.؟!…\n]/u;

/**
 * The tail of the sentence that carried `ref`, or '' when it cannot be identified.
 *
 * A marker written AFTER the full stop — which the model does, and which `instructions.js` invites
 * by saying «at the end of the sentence built on it» — belongs to the sentence BEFORE it, not to
 * the one that happens to follow.
 */
export function citationAnchor(text, ref) {
  const source = String(text ?? '');
  for (const match of source.matchAll(CITE_RE)) {
    const refs = match[1].split(/[\s،,و]+/u).map(Number);
    if (!refs.includes(ref)) continue;
    let start = match.index;
    let end = match.index + match[0].length;
    // Walk left past whitespace; if the marker trails a terminator, take the sentence it closes.
    let left = start - 1;
    while (left >= 0 && /\s/u.test(source[left])) left -= 1;
    if (left >= 0 && SENTENCE_END.test(source[left])) { end = left + 1; left -= 1; }
    else { while (end < source.length && !SENTENCE_END.test(source[end])) end += 1; if (end < source.length) end += 1; }
    while (left >= 0 && !SENTENCE_END.test(source[left])) left -= 1;
    start = left + 1;
    const sentence = foldWs(stripCitations(source.slice(start, end)));
    if (sentence.length < ANCHOR_MIN) return '';
    return sentence.length > ANCHOR_CHARS ? sentence.slice(-ANCHOR_CHARS) : sentence;
  }
  return '';
}

/**
 * ── §٣/٢: A REFERENCE NUMBER WITH NO CARD BEHIND IT DOES NOT GO OUT ─────────
 *
 * NOT THE SAME MECHANISM AS THE CARDS ABOVE, AND THAT IS THE POINT. `[[3]]` is the marker the tool
 * layer hands out and `stripCitations` removes. `[1]`, `[2][4]`, `[7]` are the model's OWN
 * invention — single brackets, a footnote to a numbered list of references this application has
 * never rendered. Nothing in the pipeline saw them, so nothing removed them: question 14 of the
 * X-ray delivered `[1] [2] [8]`, `[4]` and `[7]` in the prose with ZERO cards under it, on both
 * passes (XI-15). The reader is shown a promise of a reference and given no way to reach one.
 *
 * There is no numbered reference list to point them at — the cards are chips carrying a host and
 * a title — so the promise cannot be honoured and the number is removed instead. Only groups made
 * entirely of digits and separators are touched, in either digit set, and a fenced code block is
 * left alone: `arr[0]` in an answer about programming is not a footnote.
 */
const ORPHAN_REF_RE = /\[\s*[0-9٠-٩]+(?:\s*[,،andو-]\s*[0-9٠-٩]+)*\s*\]/gu;
export function dropOrphanRefNumbers(text) {
  return String(text ?? '')
    .split(/(```[\s\S]*?```|`[^`\n]*`)/u)
    .map((chunk, index) => (index % 2 === 1 ? chunk : chunk.replace(ORPHAN_REF_RE, '')))
    .join('')
    .replace(/[ \t]+([.،؟!:؛])/gu, '$1')
    .replace(INNER_RUN_RE, foldInnerRun)
    .replace(/[ \t]+\n/gu, '\n')
    .trim();
}

/**
 * ── P5 §٣: THE UNITS THIS ANSWER MAY BE HANDED OVER IN ──────────────────────
 *
 * WHAT THIS IS NOT. It is not a second review and it decides not one byte of what ships.
 * `deliveredText` is composed by the caller exactly as it was before this function existed;
 * everything here runs AFTER it and may only ever return PREFIXES of it. If anything at all
 * is off, it returns an empty list and the answer is delivered in one piece — which is what
 * this path does today.
 *
 * WHY THE STREAM MAY BE CONSTRUCTED HERE and not before the first character: all three of the
 * end-of-answer arguments are known by this point — `khilafSignal` and `truncatedFrom` have
 * both run — so nothing is guessed. They were also measured not to reach a released unit even
 * when they ARE guessed; see tools/stream-p1/deferred-args.cjs.
 *
 * THE ARGUMENTS ARE NORMALISED THE WAY ./review.js NORMALISES THEM, and that is not tidiness.
 * The seam turns anything that is not literally true or false into `null`. A stream built on
 * the raw values would judge the same sentences under a different reading of the same signal,
 * so its units would not be prefixes of the text the seam produced — and every one of them
 * would then be discarded by the check below, silently and for a reason nobody would find.
 *
 * AND THE PREFIX IS CHECKED, NEVER ASSUMED. `dropOrphanRefNumbers` runs on the whole text
 * after the reviewer. §٢ makes it unable to reach a released unit; this proves that claim on
 * every answer instead of trusting it once.
 */
function unitsForDelivery({
  streaming, readerText, deliveredText, domain, mode, khilaf, truncated, evidence, degraded,
}) {
  if (!streaming || !streaming.enabled) return [];
  try {
    const stream = createSentenceStream({
      evidence,
      domain: domain === 'fiqh' || domain === 'general' || domain === 'mixed' ? domain : 'general',
      mode: String(mode || ''),
      khilafFromOpinions: khilaf.khilafFromOpinions === true || khilaf.khilafFromOpinions === false
        ? khilaf.khilafFromOpinions : null,
      opinionCount: Number.isInteger(khilaf.opinionCount) && khilaf.opinionCount >= 0
        ? khilaf.opinionCount : null,
      truncated: truncated === true || truncated === false ? truncated : null,
      // The takhrij lock is applied ONCE, by the caller's seal, over the finished text. Handing
      // pages here as well would lock twice, and the second lock would be judging text the
      // first had already changed.
      sources: [],
    });
    const released = [...stream.push(readerText)];
    const closed = stream.end();
    const head = released.join('\n');
    if (closed.violations.length) {
      degraded.push(`stream_units_withheld:violations:${closed.violations.length}`);
      return [];
    }
    if (!head) return [];
    if (!deliveredText.startsWith(head)) {
      // The composition after the reviewer moved a byte the stream had released. Nothing is
      // patched and nothing is handed over early: the answer goes out whole and the fact is named.
      degraded.push('stream_units_withheld:not_a_prefix');
      return [];
    }
    return released;
  } catch (error) {
    // A stream that throws is a stream that says nothing. The answer is unaffected.
    degraded.push('stream_units_withheld:threw');
    console.warn('[free-brain/units] sentence stream threw:', String(error?.message || error));
    return [];
  }
}

function textOf(content) {
  return (Array.isArray(content) ? content : [])
    .filter((block) => block && block.type === 'text')
    .map((block) => String(block.text || ''))
    .join('');
}

/**
 * ── THE READER'S TEXT IS EVERY WORD THE MODEL WROTE, IN ORDER (§٢) ──────────
 *
 * WHAT THIS REPLACES, AND WHAT IT COST. Until this function existed the loop kept the prose of
 * the LAST call only: a round whose `stop_reason` was `tool_use` had its text blocks pushed into
 * the conversation history and read by nobody. MEASURED on the owner's twenty-question message,
 * on the preview, with the round ledger above:
 *
 *   round 1  text+6×tool_use     82 chars      round 3  text+tool_use     883 chars
 *   round 2  text+4×tool_use     81 chars      round 4  text (end_turn)  3707 chars
 *
 * 1,046 characters written and discarded, and the 3,707 that survived OPENED AT «٦.» — the model
 * had already answered one through five, in round 3, into a block this loop dropped on the floor.
 * That is the whole of the defect: not a truncation, not a token ceiling, and not the model
 * failing to answer. It answered, and the loop deleted the answer.
 *
 * THE TRAP §٢ NAMES IS HANDLED BY MEASUREMENT, NOT BY HOPE. If a later call REWRITES what an
 * earlier one already said, plain concatenation delivers it twice. So a part that another part
 * already contains — whitespace folded, because a re-indented repeat is the same text — is
 * dropped, and the longer one survives. Equal-length duplicates keep the earlier.
 */
export function joinRoundTexts(parts) {
  const kept = (Array.isArray(parts) ? parts : [])
    .map((part) => String(part ?? '').trim())
    .filter(Boolean);
  const fold = (value) => value.replace(/\s+/gu, ' ');
  return kept
    .filter((part, index) => !kept.some((other, otherIndex) => {
      if (otherIndex === index) return false;
      const wins = other.length > part.length
        || (other.length === part.length && otherIndex < index);
      return wins && fold(other).includes(fold(part));
    }))
    .join('\n\n');
}

/**
 * ── §٢ (V3): A PART THE READER ALREADY HAS IS NOT DROPPED FROM THE JOIN ─────
 *
 * `joinRoundTexts` above deletes a part that a LONGER part contains, and deletes the later of two
 * equal-length twins. Both rules are right when nothing has been delivered yet: they are what
 * stops a model that restates its draft from shipping the draft twice.
 *
 * They are wrong for exactly one part. When a round's units were accepted by the reader, its text
 * is on the reader's screen. Deleting it from the answer does not undo it — it produces a final
 * text that does NOT begin with what was sent, and the writer's only honest response to that is to
 * close the stream on the prefix and drop the rest of the answer. A rule meant to remove a
 * duplicate would then be removing the answer.
 *
 * SO ONE PART IS PINNED, AND IT IS ALWAYS INDEX 0. The head gate is what makes that true rather
 * than a hope: a round is streamed only while `written` is empty, so the streamed round's prose is
 * the first element there is. Nothing else about the join changes — the pinned part still deletes
 * later parts it contains, and the parts behind it are still weighed against each other exactly as
 * before.
 *
 * AND IT IS SCOPED TO THE STREAMED TURN. A turn that never had a unit accepted calls
 * `joinRoundTexts` and takes byte-for-byte what it takes today.
 *
 * THE PRICE IS DUPLICATED TEXT, and it is a real price: if the finishing round restates the head,
 * the reader now reads it twice. That cost is measured rather than assumed — see
 * `tools/stream-p6/head-pin-cost.cjs`.
 */
export function joinRoundTextsHeadPinned(parts) {
  const kept = (Array.isArray(parts) ? parts : [])
    .map((part) => String(part ?? '').trim())
    .filter(Boolean);
  const fold = (value) => value.replace(/\s+/gu, ' ');
  return kept
    .filter((part, index) => {
      // THE ONE DIFFERENCE FROM `joinRoundTexts`, AND IT IS THIS LINE.
      if (index === 0) return true;
      return !kept.some((other, otherIndex) => {
        if (otherIndex === index) return false;
        const wins = other.length > part.length
          || (other.length === part.length && otherIndex < index);
        return wins && fold(other).includes(fold(part));
      });
    })
    .join('\n\n');
}

/**
 * ── §٢: COLLECTED IS NOT DELIVERED ──────────────────────────────────────────
 *
 * WHAT THIS DOES NOT UNDO. `joinRoundTexts` above still keeps every word the model wrote, in
 * order, and `written.push(roundText)` above still runs before `stop_reason` is tested. The
 * lost-text repair is not reopened: the prose is still COLLECTED. What changes is that one class
 * of collected line is not DELIVERED.
 *
 * WHAT IS DROPPED, MEASURED AND NOT TASTED. Six literal lines reached readers on the twenty fiqh
 * answers of the 2026-08-17 X-ray (EZIK-XRAY-CC-REPORT-2026-08-17.md, XI-03), five of them as the
 * FIRST line of the sheet:
 *
 *   «سأبحث لك في فتاوى العلماء عن هذه المسألة تحديداً.»            answer 15/1, first line
 *   «سأبحث لك في الفتاوى المتخصصة في هذه المسألة تحديداً.»         answer 15/2, first line
 *   «سأتحقق من هذه المسألة الدقيقة.»                               answers 19/1 and 19/2, first line
 *   «هذه المسألة من دقائق أحكام الزكاة، وفيها تفصيل يستحق أن أستوثق منه لك.»   answer 18/2, first line
 *   «سأتحقق لك من المسألة في فتاوى العلماء لأزيدك اطمئنانًا بالدليل.»         answer 20/1, mid-answer
 *
 * Every one of them is the same shape: the model says what it is ABOUT TO DO with a tool. None of
 * them says anything a reader asked for. `instructions.js` already forbids writing them; a
 * prohibition the code does not enforce is a prohibition that was measured to fail.
 *
 * WHERE THE LINE IS DRAWN, AND WHY IT IS NOT «SHORT» OR «FIRST». Two properties must BOTH hold
 * before a sentence is dropped:
 *
 *   1. it announces a first-person move to a tool  (PROMISE_RE), and
 *   2. it carries no answer content at all         (ANSWER_CONTENT_RE)
 *
 * The second clause is the whole safety of this filter and it is why the fifth witness above is
 * handled by measurement rather than by length: at 71 characters it is LONGER than «الجمع للمسافر
 * جائز عند الحاجة.», which must never be dropped. A length rule would have deleted the answer and
 * kept the announcement. A sentence that both announces and answers — «سأتحقق من المدة، والجمع
 * للمسافر جائز عند الحاجة.» — is delivered WHOLE, because half a sentence is a third defect.
 *
 * DIACRITICS ARE FOLDED BEFORE MATCHING, on a copy. The model writes «سأتحقّق» and «سأتحقق» in the
 * same answer; two spellings of one word must not be two rules, and the shipped text is never the
 * folded one.
 */
// 064B..065F harakat and the extra marks · 0670 dagger alef · 0640 tatweel · 06D6..06ED the
// recitation marks. Written as ESCAPES: a combining mark pasted into a character range is
// invisible in a diff and unmatchable by an editor, which is how a fold silently stops folding.
const ARABIC_MARKS_RE = /[ً-ٰٟـۖ-ۭ]/gu;
const foldMarks = (value) => String(value ?? '').replace(ARABIC_MARKS_RE, '');

/**
 * ── §٢ (D): THE PERSON IS PART OF THE VERB, AND IT WAS THE PART THAT WAS MISSING ─
 *
 * MEASURED ON PRODUCTION, 17 August, verbatim: «فلنبحثِ المسألةَ بلفظٍ أدقّ.» It announces a move
 * to a tool in exactly the way «سأبحث» does. The list below could not see it because every entry
 * in it was spelled with the first person SINGULAR prefix أ — so «نبحث», the same verb one person
 * over, was a word the rule had never been shown.
 *
 * THAT IS THE FOURTH TIME A LIST OF SPELLINGS HAS FAILED: the narrow Arabic list, then English,
 * then another Arabic form, then Codex's إضافة form. §٢ forbids a fifth list, so the entry here is
 * a ROOT and the person is GENERATED: `[أن]` is «I» and «we», and one entry now covers both.
 *
 * THE COHORTATIVE TAKES A SMALLER SET, DELIBERATELY. «فلنبحث» is an announcement; «ولنعد إلى
 * المسألة» is a turn of phrase inside an answer, and the two have the same shape. So the لـ frame
 * is given only the verbs that ARE a move to another search — which is what §٢ names — and the
 * rest keep the frames they already had.
 */
// The roots a turn uses to say «not yet — first I go and look». Folded spelling only, and with
// the person prefix left OFF: it is supplied on the next line.
const PROMISE_ROOT = 'بحث|تحقق|تأكد|ستوثق|ستوضح|ستفسر|راجع|طلع|ستعرض|جيب|عود|كمل|واصل|تابع|ستكمل';
// First person, singular or plural. «أبحث» and «نبحث» are one entry and not two.
const PROMISE_VERB = '[أن](?:' + PROMISE_ROOT + ')';
// The subset that is a move to ANOTHER SEARCH, and the only one the cohortative frame takes.
const SEARCH_MOVE_VERB = '[أن](?:بحث|تحقق|تأكد|ستوثق|ستوضح|ستفسر|ستعرض)';
// The frames that put one of those verbs in the future, in a request for leave, or in the
// first-person-plural exhortation the production line used. A bare «أبحث» is present tense and
// can be part of an answer, so no frame means no match.
const PROMISE_RE = new RegExp(
  '(?:^|[\\s،؛:.«"(])(?:'
  + 'س' + PROMISE_VERB                                           // سأبحث · سنبحث
  + '|[فو]?ل' + SEARCH_MOVE_VERB                                 // لنبحث · فلنبحث · ولأتحقق
  // THE CONJUNCTION IS PART OF THE FRAME, and it was admitted for the لـ arm above and for no
  // other. MEASURED: «فدعني أبحثُ لك عن أقوال العلماء الموثقة» and «فدعني أبحثُ في كتبِ ابنِ
  // تيميّة» both reached the reader, because the character before «دعني» was «ف» and the frame
  // opener admits only a space or a punctuation mark there. It is the same particle in the same
  // position as the «فلنبحث» the line above was written for, so it takes the same prefix.
  + '|[فو]?(?:دعني|دعنا|دعونا|هيا|اسمح لي|امهلني|أمهلني)\\s+(?:أن\\s+)?' + PROMISE_VERB
  + '|(?:أن|بأن|لكي|كي|حتى)\\s+' + PROMISE_VERB                   // يستحق أن أستوثق
  + '|[أن](?:كمل|واصل|تابع|ستكمل)\\s+(?:ال)?بحث'                  // أكمل البحث · نواصل البحث
  + ')', 'u');
// THE RULING WORDS ARE WORDS, AND THEY WERE BEING READ AS SUBSTRINGS. MEASURED: «سأبحثُ في فتاوى
// هؤلاء العلماءِ بأسمائِهم تحديدًا» was delivered to the reader as an ANSWER, because «بأس» is the
// first three letters of «بأسمائهم». That sentence carries no ruling at all — a spelling
// collision was reading as one, and it returned `false` out of `isToolAnnouncement` before the
// promise it opens with was ever tested. «الإحرام» over «حرام» and «تصحيح» over «صحيح» are the
// same collision one word later.
//
// THE BOUND IS ASYMMETRIC BECAUSE ARABIC IS. What may precede a stem is a CLITIC — the article,
// the one-letter particles و ف ب ل ك, and the لل of لـ+الـ — and what may follow it is an
// INFLECTION and never a new stem. So «الواجبات» and «جائزًا» still count as answer content and
// the answer half of a mixed sentence is protected exactly as before, while «بأسمائهم» cannot
// count. THE TRANSMISSION MARKS STAY UNBOUND: «روى» rides inside «يروى» legitimately, and
// bounding them would cost a hadith citation its protection to fix nothing.
const RULING_WORD_STEM = 'يجوز|جائز|يحرم|حرام|محرم|واجب|يجب|تجب|فرض|مستحب|يستحب|مندوب|مكروه|مباح|سنة'
  + '|صحيح|يصح|تصح|باطل|ينقض|بأس|حرج|نصاب|ركعة|ركعات';
const CLITIC_BEFORE = '(?<![\\p{Script=Arabic}\\p{M}])(?:[وف]?(?:لل|[بكل]?ال|[بكل]))?';
const INFLECTION_AFTER = '(?:ات|ان|ين|ون|تان|تين|ها|هم|هن|نا|كم|كن|[هةيان])?'
  + '(?![\\p{Script=Arabic}\\p{M}])';
// Anything that makes the sentence an answer rather than a promise: a citation marker, any digit,
// a card the client draws, scripture between the ornate parentheses, or a ruling word. Presence of
// ANY of these keeps the sentence, whole, however it opened.
const ANSWER_CONTENT_RE = new RegExp(
  '\\[\\[|[0-9٠-٩]|﴿'
  + '|<(?:verse|surah|hadith|steps|suggestions|source|board|document|dhikr|worship)\\b'
  + '|' + CLITIC_BEFORE + '(?:' + RULING_WORD_STEM + ')' + INFLECTION_AFTER
  + '|(?:قال الله|قال تعالى|روى|عن النبي)', 'u');

// The lexical half of the observed reader-directed offer is already present in the shipped reply
// examples in system-prompt.js. The other half is structural: the block must end as a question.
// Both are folded before matching; the delivered bytes are never folded.
const READER_OFFER_RE = /(?<![\p{Script=Arabic}\p{M}])\u{62A}\u{628}\u{63A}\u{649}(?![\p{Script=Arabic}\p{M}])/u;
const READER_QUESTION_END_RE = /[?\u{61F}]\s*$/u;

// Source-resolved protection marks: CITE_RE above; CARD_TAG_NAMES and QURAN_SPAN_RE in
// output-reviewer.js; and the quote delimiters consumed by updateQuoteChar in that same file.
// A partial or closing-only mark is protected too: uncertainty means KEEP.
const CHATTY_TAIL_CITATION_RE = new RegExp(CITE_RE.source, 'u');
const CHATTY_TAIL_CARD_RE = /<\/?(?:verse|surah|hadith|steps|suggestions|source|board|document|dhikr|worship)\b/iu;
const CHATTY_TAIL_TRANSMITTED_RE = /[\u{FD3F}\u{FD3E}\u{AB}\u{BB}\u{201C}\u{201D}"]/u;
const SUBSTANTIVE_TEXT_RE = /[\p{L}\p{N}]/u;

/** TRUE when this sentence is an announcement of a move to a tool and nothing else. */
export function isToolAnnouncement(sentence) {
  const folded = foldMarks(sentence).trim();
  if (!folded) return false;
  if (ANSWER_CONTENT_RE.test(folded)) return false;
  return PROMISE_RE.test(folded);
}

/**
 * ── §٣: THE FOURTH CLASS — PROSE THAT REPORTS ON THE TOOL RUN ───────────────
 *
 * MEASURED on preview and on production, in the round that shipped the filter above:
 *
 *   «تلك النتائجُ التي وصلتني كانت بحثًا عن كلمة "تجربة"…»
 *        preview, the arithmetic and the gold answers — EZIK-FIX-A-MERGE-REPORT-2026-08-17.md:249
 *   «نتيجة البحث لم تُعطِني سعراً حقيقيّاً لجرام الذهب اليوم؛ ما ظهر مجرد معلومات عامة عن عنصر
 *    الذهب الكيميائيّ، لا سعرَ سوقٍ.»
 *        production — EZIK-FIX-A-PUBLISH-REPORT-2026-08-17.md §٤, the reviewer's own `before`
 *
 * IT IS PAST TENSE, SO `PROMISE_RE` DOES NOT MATCH IT — AND MUST NOT. That regex is a rule about a
 * promise to go and look. Widening it to the past would make «سأبحث» and «بحثتُ» one rule, and it
 * would begin eating sentences that report a FINDING. This is a separate class with its own test.
 *
 * WHERE THE LINE IS, AND IT IS NOT «MENTIONS SEARCH». A sentence telling the reader that THE
 * INFORMATION DID NOT HOLD UP is true news the reader is owed — it is the very sentence the
 * reviewer substitutes when it destroys an unsupported dynamic claim. What is dropped is the
 * DESCRIPTION OF WHAT THE TOOL DID: what it was queried with, what came back, and that what came
 * back was general or useless. Three properties must ALL hold — the same discipline as
 * `isToolAnnouncement`, and for the same reason:
 *
 *   1. the search or its results is the TOPIC of the sentence   (TOOL_TOPIC_RE), and
 *   2. the predicate REPORTS ON that run                        (TOOL_REPORT_RE), and
 *   3. it carries no answer content at all                      (ANSWER_CONTENT_RE, shared)
 *
 * THE TWO SENTENCES THAT MUST SURVIVE fail clause 1 BY CONSTRUCTION, because their topic is the
 * evidence or the writer and never the search:
 *
 *   «لم يصلني مصدرٌ مؤرّخ يمكن أن يثبت هذه المعلومة المتغيّرة في هذه الدورة.»  ← the reviewer's own line
 *   «لم أجد في بحثي عن هذه المسألة نصًّا لعالمٍ بعينِه.»                       ← disclosure to the reader
 *
 * The second one MENTIONS the search and survives anyway. That is deliberate, and it is the
 * witness that kills a mutant widening this to every mention of البحث.
 */
/**
 * ── §٢ (D): THE TOPIC IS A POSITION, NOT A PHRASE ───────────────────────────
 *
 * MEASURED ON PRODUCTION, 17 August, verbatim: «النتيجةُ التي وردتْ تتحدّث عن… ولا تُجيبُ عن
 * حالتِك بعينِها.» The list this replaces knew «النتائج التي وصلتني» and did not know «النتيجة
 * التي وردت» — the SAME noun in the singular, followed by the SAME relative clause on a verb the
 * list had not been shown. A number and a conjugation, and the class walked straight through.
 *
 * SO THE NOUN IS GENERATED AND THE TOPIC IS FOUND BY POSITION. Definiteness (`ال`), number
 * (نتيجة / نتائج) and the possessive (بحثي / بحثنا) are written once as a shape rather than
 * enumerated as spellings, and the noun only counts when it is the MUSNAD ILAYH — when the
 * sentence, or the clause after a `؛`, OPENS with it, behind nothing but a coordinating particle,
 * a sentence particle or a demonstrative.
 *
 * A PREPOSITION IN FRONT OF IT MAKES IT AN ADJUNCT, AND AN ADJUNCT IS NEVER THE TOPIC. That is
 * not a special case bolted on for one witness; it is the whole reason «لم أجد في بحثي عن هذه
 * المسألة نصًّا لعالمٍ بعينِه» survives — «بحثي» sits behind «في», so the sentence is about what
 * the writer found and not about the run.
 */
// The nouns that NAME the tool run or what it came back with, as a shape. §٢ enumerates them:
// «النتيجة/النتائج/البحث/ما وصلني/ما وجدتُ». Number, definiteness and person are generated here
// rather than listed, which is the whole difference from the four lists that failed before it.
const SEARCH_NOUN = '(?:(?:ال)?(?:نتيجة|نتيجه|نتائج|حصيلة|مخرجات|بحث|بحوث)(?:ي|نا|ه|ها)?'
  + '|ما\\s+(?:وصلني|وصل|ظهر|رجع|عاد|جاءني|جاء|ورد|وردني|وجدته|وجدت|أعاده|أعادته))';
// The search, or what it returned, IN SUBJECT POSITION. The trailing lookahead is what stops
// «بحثت» from being read as «بحث» with something stuck to the end of it.
const TOOL_TOPIC_RE = new RegExp(
  '(?:^|؛)[\\s«"(\\[]*'                                          // the sentence, or the clause, opens
  + '(?:[وف]\\s*)?'                                              // …behind a coordinating particle
  + '(?:(?:إن|أن|لكن|بل|ثم|قد)\\s+)?'                            // …or a sentence particle
  + '(?:(?:هذه|هذا|تلك|ذلك)\\s+)?'                               // …or a demonstrative
  + SEARCH_NOUN
  + '(?![ء-ي])', 'u');
// …and the predicate that makes the sentence a REPORT ON that run rather than a finding from it.
// The negated arm is written as NEGATION + PERSON + ROOT, for the same reason the topic is written
// as a position: «لم تُعطِني» and «لا تُجيبُ» and «لا يفيد» are one rule with three conjugations,
// and the production line failed on the conjugation and not on the idea.
const REPORT_ROOT = 'جيب|عط|فد|فيد|سعف|تضمن|كف|نفع|تعلق';
const TOOL_REPORT_RE = new RegExp(
  '(?:^|\\s)(?:و)?(?:لم|لا|ما)\\s+[تيأن](?:' + REPORT_ROOT + ')[ء-ي]{0,4}'
  // …and the arm that DESCRIBES what came back instead of asserting it. This one is the widest in
  // the file and it is guarded twice over: the topic must still be the run, and ANSWER_CONTENT_RE
  // still keeps any sentence carrying a ruling, a citation or a number.
  + '|[تي](?:تحدث|تكلم|تناول|دور)\\s+(?:عن|حول)'
  + '|كان(?:ت)?\\s+(?:مجرد\\s+)?بحث'                                  // كانت بحثًا عن كلمة
  + '|(?:مجرد|محض)\\s+(?:معلومات|كلام|نتائج|إشارات)'                  // ما ظهر مجرد معلومات عامة
  + '|معلومات\\s+عامة'
  + '|(?:غير|ليست|ليس)\\s+(?:مفيدة?|ذات\\s+صلة|متعلقة|كافية?)'
  + '|لا\\s+(?:علاقة\\s+لها|صلة\\s+لها)', 'u');

/**
 * §٢'s «حدٌّ لا يُخرَق»: A SENTENCE SAYING THE INFORMATION DID NOT HOLD IS TRUE NEWS, AND STAYS.
 *
 * It is a clause of its own rather than a consequence of the two tests above, and that is the
 * point of it. Both of those get widened every time a class walks through them, and a limit that
 * survives only because no widening has happened to reach it yet is not a limit. This one is
 * consulted FIRST and answers for itself.
 */
const NOT_ESTABLISHED_RE = new RegExp(
  '(?:لم|لا|ما)\\s+(?:[يت]ثبت|[يت]صح|[أن]جد|[يت]صلني|وصلني|[أن]عثر|[يت]رد)'
  + '|(?:غير|ليس|ليست)\\s+(?:ثابت|صحيح|مؤكد)', 'u');

// A deliberately WIDE pre-filter for the line-level fast path, and nothing else. A fast path that
// UNDER-admits is a filter that silently stops filtering — which is how §٣'s class would have gone
// on being delivered while every assertion about it stayed green. This one only has to be cheap;
// it never has to be right, because the decision belongs to `isToolResultReport` alone.
const TOOL_MENTION_RE = /(?:بحث|نتائج|نتيجة|مصادر)/u;

/** TRUE when this sentence reports on the tool run instead of answering from it. */
export function isToolResultReport(sentence) {
  const folded = foldMarks(sentence).trim();
  if (!folded) return false;
  // §٢'s limit, and it is consulted first: news that the information did not hold is owed
  // to the reader whatever else the sentence is shaped like.
  if (NOT_ESTABLISHED_RE.test(folded)) return false;
  if (ANSWER_CONTENT_RE.test(folded)) return false;
  return TOOL_TOPIC_RE.test(folded) && TOOL_REPORT_RE.test(folded);
}

/**
 * ── THE SIXTH CLASS: THE MACHINE NARRATING ITS OWN PLAN ─────────────────────
 *
 * MEASURED, delivered to the reader: «ظهرت المسألة الأولى…». It is neither of the two classes
 * above and it fails them for different reasons. There is no future verb in it, so `PROMISE_RE`
 * cannot see it — correctly, it promises nothing. And it need not name the search at all, so the
 * line-level fast path never even OFFERED it to `isToolResultReport`: the pre-filter was
 * `PROMISE_RE || TOOL_MENTION_RE`, and a sentence carrying neither was returned whole without a
 * classifier being asked. A filter that is not consulted is not a filter.
 *
 * WHAT THE SENTENCE ACTUALLY IS: the machine counting off the sub-questions it set ITSELF. That
 * is a fact about its plan and never about the reader’s question, and the reader was never shown
 * the plan, so the ordinal refers to nothing they can see.
 *
 * THE ORDINAL IS LOAD-BEARING, and it is the whole of what keeps «ظهر أن الحكم جائز» out of this
 * class: a finding says WHAT appeared, and this shape says WHICH ITEM OF A LIST did. Drop the
 * ordinal from the rule and it becomes «drop every sentence about a مسألة appearing», which is
 * most of the answers this application writes.
 */
const PLAN_ORDINAL = 'ال(?:أولى|اولى|ثاني[هة]|ثالث[هة]|رابع[هة]|خامس[هة]|سادس[هة]|سابع[هة]'
  + '|ثامن[هة]|تاسع[هة]|عاشر[هة])';
const TOOL_PROGRESS_RE = new RegExp(
  '(?:ظهرت|ظهر|بدأت|بدأ|بقيت|بقي|انتهت|انتهى|تبقى)\\s+(?:ال)?مس[أا]ل[هة]\\s+' + PLAN_ORDINAL, 'u');

/** TRUE when this sentence narrates the machine’s progress through its own plan. */
export function isToolProgressLine(sentence) {
  const folded = foldMarks(sentence).trim();
  if (!folded) return false;
  if (ANSWER_CONTENT_RE.test(folded)) return false;
  return TOOL_PROGRESS_RE.test(folded);
}

/**
 * ── ONE AUTHORITY FOR THE DROP, AND THE DELIVERY BARRIER CONSULTS NOTHING ELSE ─
 *
 * The three shapes were three predicates and the barrier asked two of them, which is how the
 * third class shipped: adding a shape used to mean editing a `filter` expression AND a fast-path
 * condition in another function two hundred lines away, and the second edit is the one that was
 * missed. The KIND is now a value, so a fourth shape is one arm here and nothing anywhere else.
 *
 * THE ARMS ARE ORDERED AND THE ORDER IS THE OLD PRECEDENCE, unchanged: answer content beats
 * everything (inside each arm, where it already was), a promise beats a report, and the plan
 * narration is asked last. `null` is the delivered case and it is the default.
 *
 * BATCH AND STREAM SHARE THIS BY CONSTRUCTION and not by a second copy of it: the cumulative
 * terminal stream reaches the reader only through `deliverableText` on its settled prefix, so a
 * shape named here is dropped on both paths or on neither.
 */
export function machineProseKind(sentence) {
  if (isToolAnnouncement(sentence)) return 'announcement';
  if (isToolResultReport(sentence)) return 'report';
  if (isToolProgressLine(sentence)) return 'progress';
  return null;
}

/**
 * ── §١ (C): THE FIFTH CLASS — MACHINE PROSE THAT IS NOT IN THE READER'S SCRIPT ─
 *
 * WHY THE FOUR CLASSES ABOVE DID NOT CATCH IT. Every one of them is a list of ARABIC PHRASES.
 * The owner's live production run of 17 August put this line at the head of an answer:
 *
 *   «I'll research each of these five questions in the authoritative sources.»
 *
 * It announces a move to a tool exactly as «سأبحث» does, and `PROMISE_RE` cannot see it, because
 * `PROMISE_RE` is spelled in Arabic. WE CALIBRATED ON ONE SURFACE AND ENFORCED ON ANOTHER. A fifth
 * list of ENGLISH phrases would repeat the mistake one language later, so the rule here is about
 * the SCRIPT and the STRUCTURE and carries no vocabulary at all.
 *
 * THE RULE IS PER LINE AND BY MAJORITY, NEVER BY PRESENCE. §١ states both halves and each one is
 * a defect if dropped: an English TERM inside an Arabic sentence must survive, and a whole line of
 * English must not. So the unit is the line, and the test is the share.
 *
 * WHAT IS NOT COUNTED, AND WHY EACH EXCLUSION IS A WITNESS. Links are removed before counting, so
 * a line that is nothing but a URL scores zero letters and is never judged — a bare link is not
 * machine narration. Digits are not letters, so «85 gram» and «2.5%» weigh only what their letters
 * weigh. A fenced code block is exempt entirely (see `deliverableText`): a code block the reader
 * asked for is the one legitimately Latin thing an answer contains, and a fence is a STRUCTURAL
 * mark, so the distinction needs no guess about intent.
 *
 * THE TWO NUMBERS ARE MEASURED AND DECLARED, per §١'s «حدُّ الغلبةِ يُقاسُ ويُعلَن».
 * `node tools/latin-line-measure.mjs` prints both corpora and the gap between them. MEASURED
 * 2026-08-17 on this tree: every line of the machine corpus scores 1.000, and the answer corpus —
 * eleven lines, each carrying Latin on purpose — peaks at 0.440 («ويكتبُ في الطرفيّة: npm run
 * gates», 11 Latin letters against 14 Arabic). Two of its lines score no letters at all and are
 * held by the floor rather than by the share. So the gap is [0.440 .. 1.000], width 0.560, and the
 * shipped bound sits inside it with 0.310 of room below and 0.250 above.
 */
const LATIN_LETTER_RE = /[A-Za-z]/gu;
// The Arabic letters only: the harakat, the tatweel and the recitation marks are NOT letters, and
// counting them would make a fully vocalised Arabic sentence outweigh itself.
const ARABIC_LETTER_RE = /[ء-غف-يٮ-ٯٱ-ۓۺ-ۿ]/gu;
// Removed before counting. A line that is only a link has no letters left and is never judged.
const URL_IN_LINE_RE = /(?:https?:\/\/|www\.)\S+/giu;

// Source-resolved from CARD_TAG_NAMES, QURAN_SPAN_RE and updateQuoteChar in output-reviewer.js.
const FOREIGN_LINE_QUOTATION_MARK_RE = /(?:[\uFD3F\uFD3E]|<\/?(?:verse|surah|hadith|dhikr)\b)/iu;

/** The share of a line's LETTERS that are Latin, with links excluded. Exported for the measure. */
export function latinScriptShare(line) {
  const bare = String(line ?? '').replace(URL_IN_LINE_RE, ' ');
  const latin = (bare.match(LATIN_LETTER_RE) || []).length;
  const arabic = (bare.match(ARABIC_LETTER_RE) || []).length;
  const letters = latin + arabic;
  return { latin, arabic, letters, share: letters ? latin / letters : 0 };
}

// Below this many letters there is not enough line to have a majority. It is what protects
// «cos(x) + sin(x) = 1» and «npm run gates» — four and eleven letters — from a rule about prose.
const LATIN_LINE_FLOOR = 12;
// Inside the measured gap [0.440 .. 1.000], and deliberately above a bare majority: 0.5 clears the
// highest ANSWER line by only 0.060, so one more English term in that sentence would cross it.
// Raising it to 0.95 would be equally measured and would leave a machine line that happens to
// carry one Arabic word room to survive, which is the defect. 0.75 is the middle of the gap.
const LATIN_LINE_SHARE = 0.75;

/** TRUE when this line is delivered prose whose script is not the reader's. */
export function isForeignScriptLine(line) {
  const measured = latinScriptShare(line);
  if (measured.letters < LATIN_LINE_FLOOR) return false;
  return measured.share > LATIN_LINE_SHARE && !FOREIGN_LINE_QUOTATION_MARK_RE.test(String(line ?? ''));
}

/**
 * ── §١ (D): CODE IS KNOWN BY ITS SHAPE, NOT BY ITS SHARE OF LATIN ───────────
 *
 * WHAT THE RULE ABOVE COST, MEASURED. The share rule exempts a FENCED code block and tears an
 * UNFENCED one to pieces: every line of pure code scores 1.000 and is deleted, every line a
 * comment in Arabic rides on survives. On the 17 August preview a reader who asked for a zakat
 * function received JavaScript that does not parse — no `function` line, cut in the middle of the
 * body, and with nothing anywhere saying a line had been removed
 * (EZIK-FIX-C-MERGE-PUBLISH-REPORT-2026-08-17.md §٣/٤, eleven lines in and four deleted).
 *
 * THE REPAIR IS A REPLACEMENT AND NOT A CALIBRATION, AND THE THRESHOLD DOES NOT MOVE. Raising
 * LATIN_LINE_SHARE would keep `return 0;` and still delete `function calculateZakat(amount) {`;
 * lowering it would start eating the answer lines the constant was measured to protect. Both
 * directions trade one defect for another because the share is the wrong QUESTION: a line of code
 * and a line of machine narration are both Latin, and what separates them is not how much Latin
 * they carry but what SHAPE they are in. So the share rule keeps its numbers and stops being
 * consulted for lines that are code.
 *
 * THE MARKS ARE STRUCTURAL AND CARRY NO VOCABULARY, which is the same discipline the script rule
 * itself was written under: a statement terminator, an opening or closing bracket, a comment
 * opener, an indent, the `key: value,` of an object literal. None of them is a word, so none of
 * them can be right in one language and wrong in the next.
 *
 * AND A CODE BLOCK IS JUDGED AS A BLOCK. §١: «سطرٌ واحدٌ يُعرَفُ كودًا يجعلُ جيرانَه المتّصلينَ به
 * كودًا». A Python body carries no semicolons and a continuation line carries no bracket, so a
 * per-line test alone would deliver the block with holes in it — which is the defect again with a
 * smaller hole. The spread is CONNECTED and CONDITIONAL: it stops at a blank line, and it only
 * crosses into a neighbour that carries at least the weak mark below. That is what keeps it from
 * walking out of the block and into the prose that introduced it.
 */
// A line's code BODY: the trailing line comment removed, so `const n = 1; // شرح` is judged on
// `const n = 1;` and not on the Arabic after it. `://` is excluded — that is a URL, not a comment.
const LINE_COMMENT_TAIL_RE = /(?<![:/])\/\/.*$/u;
const codeBody = (line) => String(line ?? '').replace(LINE_COMMENT_TAIL_RE, '').trimEnd();

// ANY ONE of these makes the line code on its own evidence. `#` is deliberately absent: it opens
// a comment in three languages and a HEADING in the one this application actually writes.
const CODE_SHAPE_TESTS = Object.freeze([
  // a comment line, in the two forms that are not also a markdown mark
  (raw) => /^\s*(?:\/\/|\/\*|\*\/|#!)/u.test(raw),
  // ...and a statement carrying one after it
  (raw) => LINE_COMMENT_TAIL_RE.test(raw) && /[;{}()=]/u.test(codeBody(raw)),
  // a statement terminator at the end of the line. ASCII `;` only: `؛` is Arabic punctuation and
  // matching it here would make an ordinary sentence code.
  (raw) => /;\s*$/u.test(codeBody(raw)),
  // a block that OPENS: anything with a body ending in a bracket
  (raw) => /[{[(]\s*$/u.test(codeBody(raw)) && codeBody(raw).trim().length > 1,
  // brackets, and nothing but brackets, on a line of their own
  (raw) => /^\s*[{}()[\];,]+\s*$/u.test(raw),
  // a call or a definition that ENDS the line: `zakat(amount):`, `main()`. NO space is allowed
  // before the bracket, which is what separates it from an English aside `(see below)`.
  (raw) => /[A-Za-z_$][\w$]*\([^()]*\)\s*[:{;,]?\s*$/u.test(codeBody(raw)),
  // the `key: value,` of an object literal, a JSON body or a YAML map
  (raw) => /^\s*["'`]?[A-Za-z_$][\w$-]*["'`]?\s*:\s*\S.*,\s*$/u.test(raw),
]);

// NOT evidence on its own — the mark a line needs before a code block is allowed to spread into
// it. Measured against the two corpora of the script rule: no line of the machine corpus carries
// it, and no line of the KEEP corpus carries it either, so the spread cannot reach either one.
const CODE_JOIN_RE = /^[ \t]+\S|[{}()[\];=]/u;

/**
 * Whether a later code-shaped line can propagate its code classification into this line.
 *
 * This mirrors the pinned predicate in `codeShapedLines`: the batch source shape stays intact for
 * its standing mutants, while the terminal stream can name the trailing run a later line may
 * still change from "foreign prose" to "code".
 */
export function codeShapeCanSpreadInto(line) {
  return String(line ?? '').trim() !== '' && CODE_JOIN_RE.test(String(line ?? ''));
}

/** TRUE when this line is code on its own evidence, before any block spreading. */
export function isCodeShapedLine(line) {
  const raw = String(line ?? '');
  if (!raw.trim()) return false;
  return CODE_SHAPE_TESTS.some((test) => test(raw));
}

/**
 * Which lines of a text are code, as a parallel array of booleans: the shape marks decide first,
 * then every decided line spreads through the neighbours it is connected to.
 */
export function codeShapedLines(lines) {
  const rows = Array.isArray(lines) ? lines : [];
  const code = rows.map(isCodeShapedLine);
  const joins = (index) => rows[index] !== undefined && rows[index].trim() !== ''
    && CODE_JOIN_RE.test(rows[index]);
  rows.forEach((line, index) => {
    if (!code[index]) return;
    for (let up = index - 1; up >= 0 && joins(up); up -= 1) code[up] = true;
    for (let down = index + 1; down < rows.length && joins(down); down += 1) code[down] = true;
  });
  return code;
}

/**
 * ── §١ (C): TOOL-PROTOCOL MARKUP IS BANNED OUTRIGHT ─────────────────────────
 *
 * MEASURED on production, «مفصّل» mode, 17 August: the reader received the provider's own tool
 * protocol as raw text — `<function_results>` wrapping `<result>`, `<name>` and `<output>` with the
 * search results inside them. That is not prose with a defect; it is the wire showing through.
 *
 * TWO PROPERTIES §١ NAMES, AND NEITHER IS «AT THE HEAD».
 *   any position  — the block is removed wherever it sits, not only where it opened the answer
 *   any language  — it is markup, and markup has no language, so there is no vocabulary here either
 *
 * THE CONTAINERS ARE CUT TO THEIR CLOSE OR TO THE END, AND THAT IS THE WHOLE POINT. Removing the
 * TAGS alone would leave the search output standing as prose — the reader would keep the payload
 * and lose only the brackets, which is the defect with a tidier face. So `function_results`,
 * `function_calls`, `invoke` and the `antml:` family take their CONTENT with them, and when the
 * stream was cut mid-block and no close ever arrived they take the rest of the text: an
 * unterminated protocol container has nothing after it but more protocol.
 *
 * THE LEAVES ARE CUT WHEN THEY ARE BALANCED AND UNWRAPPED WHEN THEY ARE NOT. `<result>`, `<name>`,
 * `<output>`, `<parameter>` and `<error>` are ordinary enough words that eating everything after a
 * stray one would be a licence to delete an answer. So a MATCHED pair takes its content with it —
 * `<output>gold price today</output>` is a payload however it got there — while a lone opener or
 * closer loses only its brackets. That asymmetry is deliberate: it is the difference between
 * removing markup and removing prose that had a bracket near it.
 *
 * IT RUNS INSIDE A CODE FENCE TOO. §١ says «منعًا قاطعًا … في أيِّ لغةٍ وفي أيِّ موضع», and a fence
 * is a position. The cost is stated rather than hidden: a reader who explicitly asks this app to
 * print `<function_results>` inside a code block will not get it. The script rule above exempts
 * fences and this one does not, because a fence is evidence about PROSE and no evidence at all
 * about the wire.
 */
const PROTOCOL_CONTAINER = '(?:antml:[A-Za-z_][\\w:-]*|function_results|function_calls|function_call|invoke)';
const PROTOCOL_LEAF = '(?:system[_-]reminder|parameter|results|result|output|error|name)';
// Opening tag → matching close if there is one, otherwise everything that follows it.
const PROTOCOL_CONTAINER_RE = new RegExp(
  '<' + PROTOCOL_CONTAINER + '(?=[\\s>/])[^>]*>[\\s\\S]*?<\\/' + PROTOCOL_CONTAINER + '\\s*>'
  + '|<' + PROTOCOL_CONTAINER + '(?=[\\s>/])[\\s\\S]*$'
  + '|<\\/' + PROTOCOL_CONTAINER + '\\s*>', 'giu');
const PROTOCOL_LEAF_BLOCK_RE = new RegExp(
  '<(' + PROTOCOL_LEAF + ')(?=[\\s>/])[^>]*>[\\s\\S]*?<\\/\\1\\s*>', 'giu');
const PROTOCOL_LEAF_RE = new RegExp('<\\/?' + PROTOCOL_LEAF + '(?=[\\s>/])[^>]*>', 'giu');
// The same leaf, left unterminated by a cut stream: it runs to the end with no `>` after it.
const PROTOCOL_LEAF_TAIL_RE = new RegExp('<\\/?' + PROTOCOL_LEAF + '(?=[\\s/])[^>]*$', 'iu');

/** The text with every trace of the provider's tool protocol taken out of it. */
export function stripToolProtocol(text) {
  let out = String(text ?? '');
  // Containers first and to a fixed point: a nested `<invoke>` inside `<function_calls>` leaves a
  // stray close behind when the outer one is removed by the non-greedy arm.
  for (let pass = 0; pass < 4; pass += 1) {
    const next = out.replace(PROTOCOL_CONTAINER_RE, '');
    if (next === out) break;
    out = next;
  }
  // Balanced leaves next, also to a fixed point — `<result><output>x</output></result>` needs two
  // passes and a payload nested three deep needs three.
  for (let pass = 0; pass < 4; pass += 1) {
    const next = out.replace(PROTOCOL_LEAF_BLOCK_RE, '');
    if (next === out) break;
    out = next;
  }
  return out
    .replace(PROTOCOL_LEAF_RE, '')
    .replace(PROTOCOL_LEAF_TAIL_RE, '')
    .replace(INNER_RUN_RE, foldInnerRun)
    .replace(/\n{3,}/gu, '\n\n');
}

/** Remove only the measured, unmarked reader-directed question at the final answer block. */
function stripChattyClosingBlock(text) {
  const value = String(text ?? '');
  const rows = value.split('\n');
  if (rows.length < 2) return value;

  const tail = rows[rows.length - 1];
  const foldedTail = foldMarks(tail);
  if (!READER_QUESTION_END_RE.test(foldedTail) || !READER_OFFER_RE.test(foldedTail)) return value;
  if (CHATTY_TAIL_CITATION_RE.test(tail) || CHATTY_TAIL_CARD_RE.test(tail)
      || CHATTY_TAIL_TRANSMITTED_RE.test(tail)) return value;

  // A fenced or shape-recognised program is content even when its last line happens to contain the
  // same word and punctuation. That ambiguity is resolved as KEEP.
  let inFence = false;
  for (let index = 0; index < rows.length - 1; index += 1) {
    if (/^\s{0,3}(?:```|~~~)/u.test(rows[index])) inFence = !inFence;
  }
  if (inFence || codeShapedLines(rows)[rows.length - 1]) return value;

  const before = rows.slice(0, -1).join('\n');
  const visibleBefore = before.replace(CITE_RE, ' ').replace(/<[^>]*>/gu, ' ');
  if (!SUBSTANTIVE_TEXT_RE.test(visibleBefore)) return value;
  return before.trimEnd();
}

/**
 * ── ع-٥٤: «لا أملكُ عرضَ نصِّ الصفحة» AND THEN A QUOTATION FROM IT ──────────
 *
 * MEASURED, deterministic input, PHASE34-MEASURE-REPORT-2026-09-03 §٢.٤: «لا أملكُ عرضَ نصِّ
 * الصفحة. ثم جاء في الصفحة: «هذه فقرة كاملة من النص المنشور».» — BOTH sentences were delivered,
 * and `detectSelfContradiction` reported `detected=false`. That reviewer knows two shapes,
 * `polarity` and `named-answer`, and this is neither; and it MEASURES rather than edits, which
 * is a contract its own guard pins. So the repair belongs here, at the delivery barrier, where
 * the text is already being edited for a living.
 *
 * THE STATE IS THREE-VALUED AND THAT IS THE WHOLE DESIGN:
 *
 *   unknown           — no claim about the page has been made
 *   denialPending     — an ABSOLUTE denial has been written and nothing has contradicted it yet
 *   excerptQualified  — words transmitted FROM the page arrived after that denial
 *
 * WHICH SENTENCE LOSES IS DECIDED BY WHICH ONE THE READER CAN USE. The excerpt carries the
 * material; the denial carries only a fact about the writer, and it is a FALSE one the moment
 * the excerpt exists. So the denial is dropped and the quotation is kept — never the reverse,
 * which would take evidence away from the reader to protect a sentence about the tooling.
 *
 * A QUALIFIED DENIAL IS NOT A DENIAL, AND THIS IS THE LIMIT OF THE RULE. «لا أستطيعُ عرضَ
 * الصفحةِ كاملةً، لكنَّ المقتطفَ المتاحَ يقول…» is the HONEST shape of exactly this situation —
 * it concedes the part and then names it. A rule that could not tell it apart from the
 * contradiction would punish the correct sentence and teach nothing, so «كاملة» and «لكن» and
 * their kin answer for themselves BEFORE the denial test is reached.
 *
 * AND THE STREAM MUST NOT SPEAK FIRST. A denial released as a unit and deleted two sentences
 * later is text withdrawn from a reader who has already read it, which is worse than the
 * contradiction. `terminalStableRawCut` therefore holds a `denialPending` tail exactly as it
 * already holds an unclosed protocol leaf and a spreading code run — a third retroactive rule,
 * in the same place, with the same shape. Nothing is held when no denial has been written, so
 * an answer that makes no claim about a page is delivered on exactly the old schedule.
 */
// The INABILITY, in the first person, as negation + person + root: «لا أملك» and «لم أتمكن» and
// «لا أستطيع» are one rule with three conjugations, not three spellings.
const NO_ACCESS_RE = '(?:لا|لم|ما)\\s+(?:[أا]ملك|[أا]ستطيع|[أا]ستطع|[أا]تمكن|[أا]قدر|[أا]طلع|يمكنني)';
// …and the OBJECT that makes the claim absolute: the page's TEXT. A page one cannot open at all
// is a different statement from a page one holds only an excerpt of, and it is the object and
// not the verb that separates them.
const PAGE_TEXT_OBJECT_RE = '(?:عرض|قراء[هة]|فتح|الوصول|الاطلاع|رؤي[هة])'
  + '[^.؟!…]{0,24}نص[^.؟!…]{0,12}صفح[هة]';
const PAGE_TEXT_DENIAL_RE = new RegExp(NO_ACCESS_RE + '[^.؟!…]{0,8}' + PAGE_TEXT_OBJECT_RE, 'u');
// THE LIMIT, AND IT IS CONSULTED FIRST. Either mark makes the sentence a qualification: «كاملة»
// concedes a part and «لكن» announces it. A qualification is never a denial, whatever else its
// shape, and it is delivered whole.
const PAGE_TEXT_QUALIFIER_RE = /كامل|لكن|غير\s+[أا]ن|[إا]لا\s+[أا]ن|سوى|بيد\s+[أا]ن/u;
// WORDS TRANSMITTED FROM THE PAGE. Two marks and both are required: the page has to be named,
// and the sentence has to be CARRYING something rather than talking about it. The quotation
// mark is the carrying — the same delimiters `updateQuoteChar` consumes in output-reviewer.js.
const PAGE_REFERENCE_RE = /(?:ال)?صفح[هة]/u;
const PAGE_QUOTED_RE = /[\u{FD3F}\u{FD3E}\u{AB}\u{BB}\u{201C}\u{201D}"]/u;

/**
 * Which sentences of `lines` are page-text denials that a LATER page excerpt has falsified.
 *
 * Whole-text and computed before the delivery walk, for the same reason `codeShapedLines` is:
 * the answer lives in the sentences that come AFTER the one being judged, and a per-line walk
 * does not have them. The result is keyed by line and by sentence so the walk can drop the one
 * clause and rebuild the line around it, exactly as it does for the other classes.
 */
export function pageTextDenialsToDrop(lines) {
  const rows = Array.isArray(lines) ? lines : String(lines ?? '').split('\n');
  const drops = new Map();
  if (!PAGE_TEXT_DENIAL_RE.test(foldMarks(rows.join('\n')))) return drops;
  // Sentence units in READING ORDER, each remembering where it came from.
  const units = [];
  rows.forEach((line, lineIndex) => {
    const parts = line.match(/[^.؟!…]*(?:[.؟!…]+|$)/gu) || [line];
    parts.forEach((part, partIndex) => units.push({ lineIndex, partIndex, part }));
  });
  // TWO LIMITS, BOTH CONSULTED BEFORE THE DENIAL TEST. A sentence carrying a ruling, a citation
  // or a number is an answer however it opened — that is the standing law of ANSWER_CONTENT_RE
  // above and this class is not exempt from it. And a QUALIFICATION is not a denial: it concedes
  // a part and then names it, which is the honest shape of exactly this situation.
  const isDenial = (unit) => {
    const folded = foldMarks(unit.part);
    if (ANSWER_CONTENT_RE.test(folded)) return false;
    if (PAGE_TEXT_QUALIFIER_RE.test(folded)) return false;
    return PAGE_TEXT_DENIAL_RE.test(folded);
  };
  const isExcerpt = (unit) => PAGE_REFERENCE_RE.test(foldMarks(unit.part))
    && PAGE_QUOTED_RE.test(unit.part);
  units.forEach((unit, index) => {
    if (!isDenial(unit)) return;
    // `excerptQualified` is a fact about what came LATER. A quotation that preceded the denial
    // is a different sentence about a different page and cannot falsify it.
    if (!units.slice(index + 1).some(isExcerpt)) return;
    if (!drops.has(unit.lineIndex)) drops.set(unit.lineIndex, new Set());
    drops.get(unit.lineIndex).add(unit.partIndex);
  });
  return drops;
}

/**
 * Raw offset of the earliest `denialPending` sentence in `value`, or -1 when there is none.
 *
 * -1 covers both quiet cases and they are not the same: no denial was written at all, or one
 * was and a later excerpt has already settled it. Either way nothing is held.
 */
export function pendingPageDenialAt(value) {
  const source = String(value ?? '');
  if (!PAGE_TEXT_DENIAL_RE.test(foldMarks(source))) return -1;
  const parts = source.match(/[^.؟!…]*(?:[.؟!…]+|$)/gu) || [source];
  let at = 0;
  for (let index = 0; index < parts.length; index += 1) {
    const folded = foldMarks(parts[index]);
    // The same two limits as the batch decision, in the same order. A hold that recognised a
    // denial the batch pass does not would stall a sentence nothing was ever going to delete.
    if (!ANSWER_CONTENT_RE.test(folded) && !PAGE_TEXT_QUALIFIER_RE.test(folded)
      && PAGE_TEXT_DENIAL_RE.test(folded)) {
      const rest = parts.slice(index + 1);
      const settled = rest.some((part) => PAGE_REFERENCE_RE.test(foldMarks(part))
        && PAGE_QUOTED_RE.test(part));
      if (!settled) return at;
      return -1;
    }
    at += parts[index].length;
  }
  return -1;
}

/**
 * The delivered form of the collected text: the same string with the announcement sentences taken
 * out of it. Structure is preserved line by line — a markdown heading, a list marker and a blank
 * line all survive — because the drop is made INSIDE a line and a line that empties is removed
 * whole rather than left as a hole in the prose.
 *
 * §١ (C) ADDS TWO PASSES AROUND THE SENTENCE FILTER, AND THE ORDER MATTERS. The protocol strip runs
 * FIRST, over the whole text, because markup is not sentences and splitting it on full stops would
 * scatter it across lines that each look innocent. The script rule runs per line, INSIDE the same
 * walk as the sentence filter, so a fenced code block is exempt from both by one piece of state.
 */
export function deliverableText(text, notes) {
  const lines = stripToolProtocol(text).split('\n');
  // §١ (D): decided ONCE, over the whole text, because the block spreading needs the
  // neighbours and a per-line walk does not have them.
  const isCode = codeShapedLines(lines);
  // ع-٥٤: `pageTextState`, whole-text for the same reason and computed in the same place.
  const denialDrops = pageTextDenialsToDrop(lines);
  // Markdown's own structural mark for «this is not prose». It is toggled BEFORE either rule is
  // consulted, so the fence markers themselves always survive and never unbalance the block.
  let inFence = false;
  const kept = lines.map((line, index) => {
    if (/^\s{0,3}(?:```|~~~)/u.test(line)) { inFence = !inFence; return line; }
    if (inFence) return line;
    // §١ (D): a line that is CODE is exempt from both rules and delivered byte for byte —
    // indentation included. A fence is one structural mark for «this is not prose» and the
    // shape marks are another; the reader who asked for code gets it either way.
    if (isCode[index]) return line;
    // The script rule is whole-line and comes before the sentence split: a line of English is not
    // a sentence with a defect in it, and rebuilding it from surviving clauses is meaningless.
    if (isForeignScriptLine(line)) return '';
    // The fast path has to know about ALL THREE classes, or one of them is never reached: §٣'s
    // carries no promise verb at all, so keying the split on PROMISE_RE alone returned it whole —
    // and a line narrating the plan («ظهرت المسألة الأولى») carries neither a promise nor the word
    // البحث, so PROMISE_RE and TOOL_MENTION_RE TOGETHER still returned that one whole.
    // TOOL_MENTION_RE and not TOOL_TOPIC_RE, deliberately — see its comment. Every arm here only
    // has to be cheap and to OVER-admit; the decision below is `machineProseKind`'s alone.
    const foldedLine = foldMarks(line);
    // ع-٥٤ ADDS AN ARM HERE TOO, and it has to: a falsified denial carries no promise verb, no
    // search noun and no plan ordinal, so every arm above returns its line whole.
    if (!line.trim() || !(PROMISE_RE.test(foldedLine) || TOOL_MENTION_RE.test(foldedLine)
      || TOOL_PROGRESS_RE.test(foldedLine) || denialDrops.has(index))) return line;
    // Sentence boundaries, keeping the terminator with the sentence it ends.
    const parts = line.match(/[^.؟!…]*(?:[.؟!…]+|$)/gu) || [line];
    const droppedHere = denialDrops.get(index);
    const survivors = parts.filter((part, partIndex) => part.trim()
      && !machineProseKind(part) && !(droppedHere && droppedHere.has(partIndex)));
    const rebuilt = survivors.join(' ').replace(/[ \t]{2,}/gu, ' ').trim();
    // The indentation of a surviving list item is part of the list, not part of the sentence.
    const indent = /^[ \t]*(?:[-*•]\s+|\d+[.)]\s+)?/u.exec(line)[0];
    return rebuilt ? (rebuilt.startsWith(indent.trim()) ? rebuilt : indent + rebuilt) : '';
  });
  const out = stripChattyClosingBlock(kept.join('\n').replace(/\n{3,}/gu, '\n\n').trim());
  // §١/٣: A LINE OF A PROGRAMMATIC OUTPUT IS NEVER REMOVED SILENTLY. The rules above no
  // longer drop one, but `stripToolProtocol` still can and is meant to, so the check is made
  // on the RESULT rather than inside any one rule: whatever removed it, it is named. The
  // caller passes an array or passes nothing; the delivered text is the same either way.
  if (Array.isArray(notes)) {
    const original = String(text ?? '').split('\n');
    const wasCode = codeShapedLines(original);
    const survived = new Set(out.split('\n').map((line) => line.trim()));
    original.forEach((line, index) => {
      if (!wasCode[index] || !line.trim() || survived.has(line.trim())) return;
      notes.push(`code_line_dropped:${line.trim().slice(0, 60)}`);
    });
  }
  return out;
}

// ── P6: THE PREFIX OF A GROWING WRITE THAT IS STRUCTURALLY SETTLED ───────────
//
// `deliverableText` deliberately reasons over the whole value.  Almost all of its decisions are
// local once a line is closed, but two are retroactive by construction:
//
//   * a balanced tool-protocol leaf removes the payload between an opener and a closer; before the
//     closer arrives the batch rule only unwraps the opener, so that payload must not leave;
//   * `codeShapedLines` lets a later strong code line propagate the code attribute upward through a
//     connected run.  A line in that trailing run cannot be classified until a barrier arrives.
//
// The detector below holds exactly those two tails, plus the current incomplete line.  It does not
// rewrite either rule and it never guesses the final answer.  Each time the cut advances, the real
// batch functions above are rerun on the newly settled prefix and their output is required to
// extend what was already handed to the sentence stream.
const LIVE_PROTOCOL_LEAF_TAG_RE = new RegExp(
  '<(/?)(' + PROTOCOL_LEAF + ')(?=[\\s>/])[^>]*>', 'giu',
);

/** Earliest unmatched protocol-leaf opener, or -1 when every opener is balanced. */
export function unmatchedProtocolLeafAt(value) {
  const stack = [];
  const source = String(value ?? '');
  LIVE_PROTOCOL_LEAF_TAG_RE.lastIndex = 0;
  for (let match = LIVE_PROTOCOL_LEAF_TAG_RE.exec(source); match;
    match = LIVE_PROTOCOL_LEAF_TAG_RE.exec(source)) {
    const closing = match[1] === '/';
    const name = String(match[2] || '').toLowerCase();
    const selfClosing = /\/\s*>$/u.test(match[0]);
    if (!closing && !selfClosing) {
      stack.push({ name, at: match.index });
      continue;
    }
    if (!closing) continue;
    for (let index = stack.length - 1; index >= 0; index -= 1) {
      if (stack[index].name !== name) continue;
      stack.splice(index, 1);
      break;
    }
  }
  return stack.length ? Math.min(...stack.map((entry) => entry.at)) : -1;
}

/**
 * Raw-character boundary up to which future input cannot change either retroactive batch rule.
 * The returned prefix always ends on a line boundary; `createSentenceStream` owns the finer,
 * reviewer-defined unit boundary inside it.
 */
export function terminalStableRawCut(value) {
  const source = String(value ?? '');
  const lastLf = source.lastIndexOf('\n');
  let cut = lastLf < 0 ? 0 : lastLf + 1;
  if (cut === 0) return 0;

  // A later strong code line can walk upward only through the trailing connected run.  Hold that
  // run; the first blank or non-joinable completed line is a permanent barrier.
  const completed = source.slice(0, cut).split('\n');
  completed.pop(); // the split sentinel after the completed newline
  let stableLines = completed.length;
  while (stableLines > 0 && codeShapeCanSpreadInto(completed[stableLines - 1])) {
    stableLines -= 1;
  }
  if (stableLines < completed.length) {
    let stableBytes = 0;
    for (let index = 0; index < stableLines; index += 1) {
      stableBytes += completed[index].length + 1;
    }
    cut = Math.min(cut, stableBytes);
  }

  // A balanced leaf can delete payload that looked like prose while its closer was absent.
  // Containers need no companion hold: the batch rule already removes an unclosed container to
  // end-of-input, so no container payload can enter the candidate prefix in the first place.
  // Match against the prefix being offered, not against later bytes. A closer may already be
  // present in the incomplete tail while still lying beyond `cut`; it cannot make the opener safe
  // until both tags are inside the same batch input.
  const openLeaf = unmatchedProtocolLeafAt(source.slice(0, cut));
  if (openLeaf >= 0) cut = Math.min(cut, openLeaf);

  // ع-٥٤: THE THIRD RETROACTIVE RULE, and it is retroactive in the same way the other two are —
  // a later sentence can delete an earlier one. An absolute page-text denial is not decidable
  // until either an excerpt from that page arrives or the provider ends, so it is held. The
  // hold is conditional on a denial having been WRITTEN: `pendingPageDenialAt` returns -1 for
  // every answer that makes no claim about a page, so nothing waits on a rule it never met.
  const pendingDenial = pendingPageDenialAt(source.slice(0, cut));
  if (pendingDenial >= 0) cut = Math.min(cut, pendingDenial);
  return cut;
}

/**
 * Feed a growing terminal write through the existing batch filters and the real reviewer unit.
 *
 * `onUnit` receives only units returned by `createSentenceStream.push`, never its `end()` tail.
 * The last unit and answer-level material therefore remain behind the finalizer.  The callback may
 * return `false` to decline the wire; generation and the final answer continue unchanged.
 */
export function createTerminalUnitStream({ domain, mode, onUnit, degraded } = {}) {
  const notes = Array.isArray(degraded) ? degraded : [];
  const stream = createSentenceStream({
    evidence: [],
    domain: domain === 'fiqh' || domain === 'mixed' ? domain : 'general',
    mode: String(mode || ''),
    khilafFromOpinions: null,
    opinionCount: null,
    truncated: null,
    // Empty is conservative: a takhrij-dependent unit waits.  The final seal may know more pages
    // and keep it, but no unit retained only by a not-yet-cited page can leave early.
    sources: [],
  });

  let raw = '';
  let fed = '';
  let released = '';
  let accepted = '';
  let callbackOpen = typeof onUnit === 'function';
  let transformOpen = true;
  let closed = false;

  const result = () => {
    const ended = stream.end();
    return {
      raw,
      readerText: fed,
      finalText: ended.text,
      releasedPrefix: released,
      acceptedPrefix: accepted,
      transformOpen,
      // `ended.tail` is intentionally not handed to `onUnit`: it became decidable only when the
      // provider ended and belongs to the finalized remainder.
      violations: ended.violations,
    };
  };

  const handUnits = (units) => {
    for (const unit of units) {
      const piece = released ? `\n${unit}` : unit;
      released += piece;
      if (!callbackOpen) continue;
      let took = false;
      try {
        took = onUnit({ unit, piece, text: released }) === true;
      } catch (error) {
        notes.push(`stream_unit_callback:threw:${String(error?.message || error)}`);
      }
      if (took) accepted = released;
      else callbackOpen = false;
    }
  };

  const advance = (ending) => {
    if (!transformOpen) return;
    const cut = ending ? raw.length : terminalStableRawCut(raw);
    const candidate = stripCitations(deliverableText(raw.slice(0, cut)));
    if (!candidate.startsWith(fed)) {
      transformOpen = false;
      callbackOpen = false;
      notes.push('stream_units_withheld:terminal_transform_not_a_prefix');
      return;
    }
    const addition = candidate.slice(fed.length);
    fed = candidate;
    if (addition) handUnits(stream.push(addition));
  };

  return {
    push(chunk) {
      if (closed) throw new Error('createTerminalUnitStream: push after end');
      raw += String(chunk ?? '');
      advance(false);
    },

    end() {
      if (closed) throw new Error('createTerminalUnitStream: end called twice');
      closed = true;
      advance(true);
      return result();
    },

    cut() {
      if (closed) throw new Error('createTerminalUnitStream: cut called after close');
      closed = true;
      // Do not promote the current line or the reviewer's held last unit when upstream did not
      // finish. Only the structurally settled prefix offered by earlier `push` calls may survive.
      return result();
    },
  };
}

/**
 * ── §٢ (C): «انقطعَ» IS A FACT ABOUT THE PROVIDER, NOT A GUESS ABOUT THE TEXT ─
 *
 * MEASURED LIVE: an answer cut in the MIDDLE OF A WORD arrived carrying the closing review mark,
 * so it looked finished to the reader and to every surface downstream. Nothing on the path knew
 * whether the model had stopped or been stopped, because nothing on the path had ever asked.
 *
 * THE CONTRACT WITH CODEX, VERBATIM:
 *
 *   truncated   // true إن انتهتْ آخرُ جولةِ نموذجٍ بغيرِ end_turn · false إن تمّت · null إن لم يُعرَفْ
 *
 * SO THE TEST IS `!== 'end_turn'` AND NOT `=== 'max_tokens'`, and that is a decision rather than a
 * shorthand. `max_tokens` is the ceiling case and `tool_use` is the case where the model asked for
 * a round it was not given — both are answers that stopped short of their own ending, and a rule
 * naming only the first would report the second as complete. `pause_turn` and `refusal` are the
 * same shape again, which is why the rule is stated as a complement and not as a list.
 *
 * `stop_sequence` WOULD READ AS TRUNCATED AND CANNOT OCCUR. No call in this file sends a
 * `stop_sequences` key, so the provider has no sequence to stop on. It is named here rather than
 * special-cased, because a future call that adds one must come back and decide, not discover.
 *
 * AND `null` IS NOT `false`. An unknown finish state is unknown. Reading it as «it finished» is the
 * same lie as the review mark on the half-written word, told by us instead of by the model.
 *
 * @param {string|null|undefined} stop  the `stop_reason` of the round that wrote the delivered text
 * @returns {true|false|null}
 */
export function truncatedFrom(stop) {
  if (typeof stop !== 'string' || !stop) return null;
  return stop !== 'end_turn';
}

/**
 * @returns {'fiqh'|'general'|'mixed'} the domain reported to branch ب's reviewer.
 *
 * It is taken from what the turn DID, not from what the router guessed before reading. A turn
 * that searched the fatwa corpus is fiqh whatever the lexical router said; a turn that searched
 * both the fatwa corpus and the live world is the mixed message §٤/١ says one reply must serve.
 */
export function domainOf(spend, lexicalRoute) {
  const religious = spend.some((s) => s.tool === 'search_fatawa' || s.tool === 'search_sources');
  const live = spend.some((s) => s.tool === 'search_live');
  if (religious && live) return 'mixed';
  if (religious) return 'fiqh';
  if (live) return 'general';
  return lexicalRoute === 'DEEN' ? 'fiqh' : 'general';
}

/**
 * How this path divides its output pool between thinking and prose.
 *
 * `budget_tokens` is not available on this model (see ./tools.js), so the choice is between a
 * share of zero and an unbounded adaptive share. Default is zero, measured.
 *
 *   FREE_BRAIN_THINKING unset|off|disabled   thinking:{type:'disabled'}  — prose floor = ceiling
 *   FREE_BRAIN_THINKING=adaptive             thinking:{type:'adaptive'}
 *   FREE_BRAIN_THINKING=low|medium|high      adaptive + output_config.effort
 *
 * An unrecognised value resolves to the measured default, never to a guess.
 */
export function thinkingPolicy(env = process.env) {
  const raw = String(env.FREE_BRAIN_THINKING ?? '').trim().toLowerCase() || FREE_BRAIN_THINKING_DEFAULT;
  if (raw === 'adaptive') return { thinking: { type: 'adaptive' } };
  if (raw === 'low' || raw === 'medium' || raw === 'high') {
    return { thinking: { type: 'adaptive' }, output_config: { effort: raw } };
  }
  return { thinking: { type: 'disabled' } };
}

/**
 * The output ceiling THIS path asks for, flag-gated so the old behaviour is one environment write
 * away and needs no deploy — the same discipline ./flag.js applies to the path itself.
 *
 *   FREE_BRAIN_MAX_TOKENS unset       the measured budget in ./tools.js
 *   FREE_BRAIN_MAX_TOKENS=off|0|false defer to the caller's ceiling (MAX_CHAT_TOKENS today)
 *   FREE_BRAIN_MAX_TOKENS=<n>         that many, to measure another value without an edit
 *
 * An unrecognised value resolves to the measured default and never to a guess, for the reason
 * ./flag.js gives about typos: a value nobody defined must not silently become a new behaviour.
 *
 * @param {number} callerMaxTokens  what api/ask.js computed from the request (MAX_CHAT_TOKENS).
 */
export function outputBudget(callerMaxTokens, env = process.env) {
  const raw = String(env.FREE_BRAIN_MAX_TOKENS ?? '').trim().toLowerCase();
  if (raw === '') return FREE_BRAIN_MAX_TOKENS;
  if (raw === 'off' || raw === '0' || raw === 'false') return callerMaxTokens;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : FREE_BRAIN_MAX_TOKENS;
}

/** The tool-phase deadline, overridable for measurement. Never zero, never negative. */
export function toolPhaseMs(env = process.env) {
  const parsed = Number(String(env.FREE_BRAIN_TOOL_PHASE_MS ?? '').trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : FREE_BRAIN_TOOL_PHASE_MS;
}

async function callProvider({ providerUrl, headers, signal, body }) {
  const response = await fetch(providerUrl, {
    method: 'POST', headers, signal, body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(`upstream ${response.status}`);
    error.status = response.status;
    error.detail = String(detail).slice(0, 300);
    throw error;
  }
  return response.json();
}

// ── THE SAME CALL, READ AS IT ARRIVES (ح‑١) ──────────────────────────────────
//
// The provider's stream is a sequence of named events, and the payload this
// rebuilds from them is the SAME OBJECT `callProvider` would have returned:
// `content` blocks in order, `stop_reason`, and `usage`. Everything downstream —
// `textOf`, `ledgerRow`, `deliveredStop` — reads that object and cannot tell which
// of the two produced it. tools/stream-p1/sse-reconstruct-proof.cjs holds that
// claim to a byte comparison rather than to this comment.
//
// WHY RAW SSE AND NOT A CLIENT LIBRARY. Every provider call in this repository is
// a `fetch`, and there is no provider SDK among its five dependencies; two guards
// pin that dependency count. Matching the surrounding code is the smaller change.
//
// `onText` is called with each text delta as it lands. It is the only reason this
// function exists — the reconstructed payload alone would not be worth a second
// code path.
export async function callProviderStream({ providerUrl, headers, signal, body, onText }) {
  const response = await fetch(providerUrl, {
    method: 'POST',
    headers: { ...headers, accept: 'text/event-stream' },
    signal,
    body: JSON.stringify({ ...body, stream: true }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(`upstream ${response.status}`);
    error.status = response.status;
    error.detail = String(detail).slice(0, 300);
    throw error;
  }
  if (!response.body) throw new Error('upstream stream had no body');

  const message = { content: [] };
  const partialJson = new Map();

  const apply = (event) => {
    if (!event || typeof event !== 'object') return;
    switch (event.type) {
      case 'message_start':
        Object.assign(message, event.message || {});
        message.content = [];
        break;
      case 'content_block_start':
        message.content[event.index] = { ...(event.content_block || {}) };
        if (event.content_block?.type === 'tool_use') partialJson.set(event.index, '');
        break;
      case 'content_block_delta': {
        const block = message.content[event.index];
        if (!block) break;
        const delta = event.delta || {};
        if (delta.type === 'text_delta') {
          block.text = String(block.text || '') + String(delta.text || '');
          if (onText && delta.text) onText(String(delta.text));
        } else if (delta.type === 'thinking_delta') {
          block.thinking = String(block.thinking || '') + String(delta.thinking || '');
        } else if (delta.type === 'signature_delta') {
          block.signature = String(delta.signature || '');
        } else if (delta.type === 'input_json_delta') {
          partialJson.set(event.index, (partialJson.get(event.index) || '') + String(delta.partial_json || ''));
        }
        break;
      }
      case 'content_block_stop': {
        const block = message.content[event.index];
        if (block && partialJson.has(event.index)) {
          const raw = partialJson.get(event.index);
          // An empty argument object arrives as no deltas at all, which is not the
          // same thing as malformed JSON. Both keep the block; neither invents input.
          if (raw === '') block.input = block.input ?? {};
          else {
            try { block.input = JSON.parse(raw); } catch { block.input = block.input ?? {}; }
          }
          partialJson.delete(event.index);
        }
        break;
      }
      case 'message_delta':
        Object.assign(message, event.delta || {});
        if (event.usage) message.usage = { ...(message.usage || {}), ...event.usage };
        break;
      case 'error': {
        const error = new Error(`upstream stream error: ${event.error?.type || 'unknown'}`);
        error.detail = String(event.error?.message || '').slice(0, 300);
        throw error;
      }
      default:
        break; // ping, message_stop, and anything the provider adds later
    }
  };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE frames are separated by a blank line. A frame split across two chunks
    // stays in the buffer until its terminator arrives, so no frame is ever parsed
    // half-read.
    let cut = buffer.indexOf('\n\n');
    while (cut !== -1) {
      const frame = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue; // `event:` names it; `data:` carries it
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try { apply(JSON.parse(payload)); } catch (error) {
          if (error instanceof SyntaxError) continue; // a comment or keepalive, not a frame
          throw error;
        }
      }
      cut = buffer.indexOf('\n\n');
    }
  }

  message.content = message.content.filter(Boolean);
  return message;
}

/**
 * Run the whole free-brain turn and return the finished reader text plus its evidence.
 *
 * @returns {Promise<{
 *   text:string, cited:Array, evidence:Array, domain:string, rounds:number,
 *   spend:Array, degraded:Array, injectionMarkers:Array, verdict:string, annotations:Array,
 *   modelCalls:number, elapsedMs:number, roundLedger:Array
 * }>}
 */
export async function runFreeBrainTurn(options = {}) {
  const startedAt = Date.now();
  const {
    messages, system, model, maxTokens, usePremium, effort,
    band = '', mode = '', lexicalRoute = '',
    // S1/§١ — `storedContext.runtime`, from api/ask.js. THE GAP THIS ROUND CLOSES: the
    // deterministic key existed and was settled before any model call, and this function could
    // not see it.
    storedRuntime = '',
    providerUrl, headers, signal, dailyBudget = null, fetchImpl = undefined,
    // The library's keys, decided by api/ask.js and handed down. This module reads no environment
    // of its own for them: an absent flag or token simply means the tool is never offered.
    libEligible = false, libFlagValue = '', libToken = '',

    // ح‑١ — the caller may watch the writing call arrive. `env` is injectable so a
    // test states the environment instead of mutating the real one, exactly as the
    // free-brain flag is read.
    onWriteText = null, onWriteUnit = null, env = undefined,
  } = options;
  const streaming = streamDecision(env || process.env);

  const table = createEvidenceTable();
  const ctx = {
    table, band, dailyBudget, signal, fetchImpl, libFlagValue, libToken,
    spend: [], degraded: [], injectionMarkers: [],
  };
  const callsPerTool = new Map();
  // -- WHICH TOOLS THIS TURN IS OFFERED ----------------------------------------
  // The library is the only tool that is not offered on every turn. It is a network call behind a
  // flag and a token, and the owner's rule is that a brief answer never reaches it. Filtering the
  // OFFER, and not merely refusing the call, keeps the model from planning a search it will not be
  // allowed to make; runLibrary refuses on the same two conditions independently, so both halves
  // have to fail before a brief turn could touch the library.
  const libOffered = libEligible === true && libFlagValue === 'on' && libToken !== '';
  const turnTools = libOffered
    ? FREE_BRAIN_TOOLS
    : FREE_BRAIN_TOOLS.filter((tool) => tool.name !== 'search_library');

  const conversation = [...(Array.isArray(messages) ? messages : [])];
  // ── S1/§١ — THE OFFER, BEFORE THE FIRST CALL AND OUTSIDE THE CACHED PREFIX ──
  //
  // POSITION IS LOAD-BEARING. api/ask.js's `wrapSystem` puts the ONE cache breakpoint on the last
  // text block of the SYSTEM prompt, and no path writes `cache_control` onto a message. So writing
  // here moves nothing that is cached, and the prefix /api/chat shares stays byte-identical.
  //
  // THE COUNTER COUNTS EVENTS THAT HAPPENED. `fired` only once the call was actually made, `rows`
  // only what the admission gate actually returned, and `cited` only what the DELIVERED text
  // actually leaned on — which is computed after the reviewer has had its say, far below.
  const storedInjection = { fired: false, rows: 0, cited: 0, reason: '' };
  const injectedRefs = new Set();
  if (!storedInjectionApplies(storedRuntime, lexicalRoute)) {
    storedInjection.reason = 'not_stored_fiqh';
  } else {
    const query = lastUserText(conversation);
    const last = conversation.length - 1;
    if (!query) {
      storedInjection.reason = 'no_question';
    } else if (!conversation[last] || conversation[last].role !== 'user') {
      // The rows belong on the reader's own turn. If the turn does not end on one, offering
      // nothing is the honest outcome — inventing a place to put them is not.
      storedInjection.reason = 'no_trailing_user_turn';
    } else {
      // runTool, not searchFatwas directly: the row shape, the snippet ceiling, the failure text
      // and the `spend` row are then the SAME ones a model-requested call produces, because the
      // same function produces them.
      const out = await runTool('search_fatawa', { query }, ctx);
      const spent = ctx.spend[ctx.spend.length - 1];
      // A provider call the model did not ask for is still a provider call, so it is recorded —
      // and LABELLED, because a spend row nobody can tell apart from a requested one would make
      // «the model searched» unfalsifiable.
      if (spent && spent.tool === 'search_fatawa') spent.injected = true;
      storedInjection.fired = true;
      const rows = out.added.slice(0, STORED_INJECTION_MAX_ROWS);
      storedInjection.rows = rows.length;
      if (!rows.length) {
        storedInjection.reason = 'no_rows';
      } else {
        for (const row of rows) injectedRefs.add(row.ref);
        conversation[last] = withCandidateEvidence(conversation[last], renderEvidenceRows(rows));
        storedInjection.reason = 'injected';
      }
    }
  }

  let rounds = 0;
  let modelCalls = 0;
  // P6: this is TRUE only after an approved unit was accepted by the delivery caller.  Merely
  // choosing the provider's streaming transport is not reader streaming, and must not suppress a
  // citation retry when no byte left this function's caller.
  let streamedThisTurn = false;
  // TRUE once any round was allowed to stream. It is the flag AND both gates, and it is what the
  // reader-unit builder reads — a turn the gates withheld must deliver in one piece.
  let streamRoundEligible = false;
  // TRUE once the delivery caller accepted any part of the cumulative turn prefix.
  let readerOwnsHead = false;
  // One unit stream spans every eligible provider round. A per-round reset would call later prose
  // a head even though earlier prose belongs in front of it.
  let turnUnits = null;
  let turnUnitsHasText = false;
  let turnUnitsClosed = false;
  let acceptedStreamPrefix = '';
  let streamResult = null;
  let terminalWriteMs = null;
  // Each withhold is named ONCE per turn, not once per round: the gate is a fact about the turn,
  // and six copies of one line in `degraded` is a counter nobody can read.
  let cardWithholdNoted = false;
  // Every round's prose, in the order the model wrote it. See `joinRoundTexts`.
  const written = [];
  const closeTurnUnits = (cut = false) => {
    if (!turnUnits) return streamResult;
    streamResult = cut ? turnUnits.cut() : turnUnits.end();
    turnUnits = null;
    turnUnitsClosed = true;
    return streamResult;
  };
  const openTurnUnits = (roundDomain) => {
    if (turnUnits || turnUnitsClosed) return turnUnits;
    turnUnits = createTerminalUnitStream({
      domain: roundDomain,
      mode,
      degraded: ctx.degraded,
      onUnit: (detail) => {
        if (typeof onWriteUnit !== 'function') return false;
        const taken = onWriteUnit(detail) === true;
        if (taken) {
          streamedThisTurn = true;
          readerOwnsHead = true;
          acceptedStreamPrefix = detail.text;
        }
        return taken;
      },
    });
    // Cards may arrive after a buffered tool round. Seed its pinned join before the next delta so
    // every accepted byte remains at the front of the final delivered text.
    const head = joinRoundTextsHeadPinned(written);
    if (head) {
      turnUnits.push(head);
      turnUnitsHasText = true;
    }
    return turnUnits;
  };
  // TRUE only when the model STOPPED and said something. It is deliberately not «is `written`
  // non-empty»: a round that ends on `end_turn` with no text block (E4) must still reach the
  // tools-removed write, and after this change `written` can already be full from an earlier
  // round — so keying the write on the accumulated text would have deleted E4 silently.
  let finished = false;
  let sawOpenWeb = false;
  // ── §٢ (C): THE FINISH STATE OF THE ROUND THAT WROTE WHAT IS BEING DELIVERED ─
  //
  // NOT «the last round» and not «the last ledger row»: the round whose prose the reader is about
  // to read. The two come apart on the citation retry — a retry that comes back citing nothing is
  // NOT adopted, so its `stop_reason` describes text this turn threw away, and reporting it would
  // be an account of an answer nobody received.
  //
  // `null` IS «I DO NOT KNOW» AND IT IS THE OPENING VALUE. A turn whose every provider call threw
  // has no finish state to report, and inventing `false` there would tell the reader an answer
  // that does not exist is complete. Nothing below ever writes `null` back over a known value: a
  // later failure does not unlearn what an earlier success measured.
  let deliveredStop = null;
  // ── THE ROUND LEDGER (§٢ of the lost-text round) ───────────────────────────
  // MEASUREMENT ONLY. It changes no reader-visible byte; it exists because the platform log could
  // answer «how many rounds» and could not answer «did the early rounds carry text, and how long
  // was each block» — and §٢'s verdict may not be written on a hypothesis the log cannot test.
  // One row per provider call: its stop_reason, the block types in order, and the character count
  // of the text blocks, which is exactly the quantity that decides whether text was lost.
  const roundLedger = [];
  const ledgerRow = (n, payload, phase, ms = null) => {
    const blocks = Array.isArray(payload?.content) ? payload.content : [];
    roundLedger.push({
      n, phase, ms,
      stop: payload?.stop_reason ?? null,
      shape: blocks.map((block) => block?.type).join('+'),
      textChars: blocks.filter((block) => block?.type === 'text')
        .reduce((sum, block) => sum + String(block?.text || '').length, 0),
      toolUse: blocks.filter((block) => block?.type === 'tool_use').length,
      // ── ALL FOUR USAGE FIELDS, NOT ONE ───────────────────────────────────
      // The provider reports four numbers and this row kept one, so the log could
      // answer «how much did it write» and could not answer «how much did it read,
      // and how much of that was cached» — which is the whole of what a turn costs.
      // The three that were being dropped are recorded here because they are already
      // in hand; nothing new is fetched to get them. `null` is «the provider did not
      // say», and is never to be read as zero.
      outTokens: payload?.usage?.output_tokens ?? null,
      inTokens: payload?.usage?.input_tokens ?? null,
      cacheWriteTokens: payload?.usage?.cache_creation_input_tokens ?? null,
      cacheReadTokens: payload?.usage?.cache_read_input_tokens ?? null,
    });
  };

  // ── THE WALL CLOCK (§٤ of the owner's mandate) ─────────────────────────────
  // Checked BEFORE a round is started, never in the middle of one: an in-flight provider call
  // cannot be shortened, so the only honest place to stop is at a boundary. Crossing the deadline
  // is not an abort — it leaves the tool phase and falls through to the writing call below, so the
  // reader receives the best answer the evidence so far supports rather than a killed function.
  const phaseMs = toolPhaseMs();
  let deadlineHit = false;
  // Non-null once an upstream call failed. Returned to the caller so an infrastructure failure is
  // never invisible just because the reader still received an honest last rung.
  let failure = null;

  while (rounds < MAX_TOOL_ROUNDS) {
    if (Date.now() - startedAt >= phaseMs) {
      deadlineHit = true;
      ctx.degraded.push(`deadline_tool_phase:${Date.now() - startedAt}ms`);
      break;
    }
    rounds += 1;
    const roundStartedAt = Date.now();
    let payload;
    // ── ح‑١ (V3): THE ROUND THAT WRITES THE ANSWER IS THE ROUND THAT IS STREAMED ──
    //
    // V2 streamed a call of its own, made AFTER this loop, and paid for it: the prose round
    // ran in full, was billed, and its text was then thrown away and regenerated. MEASURED at
    // +1 provider call and ×2.01 on completion. There is no separate call here. The tool-bearing
    // call is the one that produces the reader's text, so it is the one whose transport streams.
    //
    // THE OLD HEAD GATE WAS evaluated per round instead of once after the loop:
    // `written.length === 0` is «nothing has been written for the reader yet», which is exactly
    // what `headFreeBeforeTerminal` measured. The cumulative turn stream now seeds that prose
    // before the next round, so an existing head is carried rather than withheld.
    //
    // AND THE CARD TEST IS THE SAME TEST, on the evidence in hand WHEN THE ROUND STARTS. A fiqh
    // scope with an empty table is the shape the citation retry exists to repair, and a retry may
    // not replace bytes the reader already owns — so that round is not streamed. Rows arriving in
    // a later round reopen it, which is the honest reading of «are there cards yet».
    const roundDomain = domainOf(ctx.spend, lexicalRoute);
    const roundRulingWithoutCards = roundDomain === 'fiqh' && table.rows.length === 0;
    const roundStreamEligible = streaming.enabled && !turnUnitsClosed && !roundRulingWithoutCards;
    if (streaming.enabled && roundRulingWithoutCards && !cardWithholdNoted) {
      cardWithholdNoted = true;
      ctx.degraded.push(`stream_withheld:ruling_without_cards:${roundDomain}`);
    }
    // An ineligible prose round after an open prefix would create a gap. Close at the boundary;
    // later output remains buffered and cannot leap over bytes the reader has not received.
    if (!roundStreamEligible && turnUnits) closeTurnUnits(false);
    if (roundStreamEligible) streamRoundEligible = true;
    const roundBody = {
      model,
      max_tokens: outputBudget(maxTokens),
      // Thinking policy first, so a premium `effort` below still wins if both name output_config.
      ...thinkingPolicy(),
      ...(usePremium && effort ? { output_config: { effort } } : {}),
      system,
      messages: conversation,
      tools: turnTools,
    };
    let roundTextStarted = false;
    try {
      if (roundStreamEligible) {
        openTurnUnits(roundDomain);
        payload = await callProviderStream({
          providerUrl,
          headers,
          signal,
          body: roundBody,
          onText: (delta) => {
            if (onWriteText) onWriteText(delta);
            if (!roundTextStarted) {
              roundTextStarted = true;
              if (turnUnitsHasText) turnUnits.push('\n\n');
            }
            turnUnits.push(delta);
          },
        });
      } else {
        payload = await callProvider({
          providerUrl, headers, signal, body: { ...roundBody, stream: false },
        });
      }
    } catch (error) {
      if (turnUnits && !streamResult) {
        try { closeTurnUnits(true); } catch { /* a cut that cannot close reports nothing */ }
      }
      if (acceptedStreamPrefix) {
        // The reader already owns this prefix. It becomes the turn's head so that nothing written
        // afterwards can replace it, and the finish state says the stream was cut rather than that
        // the model chose to stop.
        written.length = 0;
        written.push(acceptedStreamPrefix);
        readerOwnsHead = true;
        deliveredStop = 'stream_cut';
        ctx.degraded.push('stream_cut:provider_error_tool_phase');
      }
      // E5. A round that could not be made is not a turn that cannot answer: the evidence from
      // the rounds that DID run is in the table, and the tools-removed write below can still use
      // it. Recorded by name so telemetry can tell an upstream failure from a clock or a cap.
      failure = `provider_error_tool_phase:${String(error?.status || '')}:${String(error?.message || error)}`;
      ctx.degraded.push(failure);
      break;
    }
    modelCalls += 1;
    ledgerRow(rounds, payload, 'tool', Date.now() - roundStartedAt);

    // KEPT, NOT DROPPED. This one line is §٢'s repair: prose the model wrote in a round that also
    // called a tool is prose it wrote for the reader, and it is collected here whether the round
    // ends the turn or continues it.
    const roundText = textOf(payload.content);
    if (roundText) written.push(roundText);
    // A round that supplied text advanced the same cumulative stream used by every eligible round.
    // The callback marks `readerOwnsHead` only after the delivery caller accepted that prefix; the
    // pinned join and the final prefix check below keep the accepted bytes at the front.
    if (roundTextStarted) turnUnitsHasText = true;
    // §٢ — READ OFF THE PAYLOAD, NEVER OFF THE TEXT. Every round that came back is a round whose
    // finish state is known, so the last one to come back is the state of the answer so far.
    deliveredStop = payload.stop_reason ?? null;
    // A stream that ended without `message_delta` never reported a finish state, and `null` there
    // would be read as «I do not know» and suppress the truncation mark on a half-written answer.
    // Only the streamed transport can produce it: `callProvider` parses one body, and a body with
    // no `stop_reason` is not a body the provider sends.
    if (roundStreamEligible && deliveredStop === null) {
      deliveredStop = 'stream_cut';
      ctx.degraded.push('stream_cut:no_message_stop');
    }

    if (payload.stop_reason !== 'tool_use') {
      if (turnUnits && !streamResult) closeTurnUnits(false);
      finished = roundText !== '';
      break;
    }

    // The assistant turn is replayed VERBATIM, tool_use blocks included: the provider requires the
    // call it is being given results for to be present in the history, and reconstructing it from
    // our own record would be a second version of what the model said.
    conversation.push({ role: 'assistant', content: payload.content });

    const results = [];
    for (const block of payload.content || []) {
      if (!block || block.type !== 'tool_use') continue;
      const used = callsPerTool.get(block.name) || 0;
      if (used >= MAX_CALLS_PER_TOOL) {
        // SAID OUT LOUD, NOT SILENTLY DROPPED. A tool result that never arrives leaves the model
        // waiting on evidence it thinks it asked for, and it answers as though the search failed
        // rather than as though it was refused a fifth attempt.
        results.push({
          type: 'tool_result', tool_use_id: block.id,
          content: 'بلغتَ الحدَّ الأقصى لاستدعاءِ هذه الأداةِ في هذا الردّ. أجِبْ بما بين يديك.',
        });
        ctx.degraded.push(`cap:${block.name}`);
        continue;
      }
      callsPerTool.set(block.name, used + 1);
      const out = await runTool(block.name, block.input, ctx);
      if (out.added.some((row) => row.kind === 'live_open')) sawOpenWeb = true;
      results.push({ type: 'tool_result', tool_use_id: block.id, content: out.text });
    }
    // The open-web caution rides with the results it is about, so it arrives when it is true and
    // is absent when it is not. The round-text reminder rides with EVERY batch, because the thing
    // it is about — that the next round's prose is delivered verbatim — is true of every round.
    conversation.push({
      role: 'user',
      content: [
        ...results,
        ...(sawOpenWeb ? [{ type: 'text', text: OPEN_WEB_CAUTION }] : []),
        { type: 'text', text: ROUND_TEXT_REMINDER },
      ],
    });
  }

  // THE LOOP RAN OUT, WHICH IS NOT AN ANSWER. One final call with the tools REMOVED, so the model
  // cannot ask for a seventh round and must write from what it has.
  //
  // ── V3: THIS CALL IS MAIN'S CALL AGAIN, AND IT IS NEVER STREAMED ───────────
  // V2 also entered here on turns that had ALREADY FINISHED, to re-generate the prose it had just
  // popped off `written` so that a stream could carry it. That was the whole of the +1 call and of
  // the ×2.01 on completion time, and it is gone: this block runs when, and only when, the tool
  // loop did not end on prose — which is exactly `!finished`, exactly as on `origin/main`.
  //
  // It is not streamed for a reason beyond cost. It only ever runs on a turn that did not finish,
  // and on such a turn the reader may already own a prefix from a cut round; a stream here would
  // be a second answer written over the first.
  // A deadline, round ceiling, or tool-phase failure can leave the cumulative head open while the
  // ordinary tools-removed writer finishes the turn. Close before that buffered call so no later
  // byte can leap over an unstreamed gap.
  if (turnUnits && !streamResult) closeTurnUnits(false);
  const toolPhaseFailed = failure !== null;

  if (!finished) {
    const writeStartedAt = Date.now();
    try {
      const payload = await callProvider({
        providerUrl,
        headers,
        signal,
        body: {
          model,
          max_tokens: outputBudget(maxTokens),
          // Thinking policy first, so a premium `effort` below still wins if both name output_config.
          ...thinkingPolicy(),
          ...(usePremium && effort ? { output_config: { effort } } : {}),
          system,
          messages: conversation,
          stream: false,
        },
      });
      terminalWriteMs = Date.now() - writeStartedAt;
      modelCalls += 1;
      ledgerRow(rounds + 1, payload, 'write', terminalWriteMs);
      const writeText = textOf(payload.content);
      if (writeText) written.push(writeText);
      // §٢ — the tools-removed write is the round that finished this answer, so its state is the
      // answer's state. It runs whenever the tool loop did not end on prose, which is exactly the
      // set of turns whose earlier `tool_use` state would otherwise be reported as the finish.
      //
      // UNCONDITIONAL, as on `origin/main`. V2 guarded it, and although the guard could not fire
      // with the flag off — `terminalWriteAdded` was only ever set on the streaming path — the
      // condition existed only to serve a call that no longer exists.
      deliveredStop = payload.stop_reason ?? null;
    } catch (error) {
      // E6. The last call failed too, so there is no model text at all. The turn does NOT throw:
      // it falls through with an empty proposal, and the reviewer's last rung — an explicit
      // Arabic sentence saying nothing usable arrived — is what the reader receives. A thrown
      // turn here is the empty bubble with extra steps.
      terminalWriteMs = Date.now() - writeStartedAt;
      failure = `provider_error_write:${String(error?.status || '')}:${String(error?.message || error)}`;
      ctx.degraded.push(failure);
    }
    // NAME THE REAL CAUSE. `rounds_exhausted` on a turn that ran out of CLOCK sent the reader's
    // telemetry looking at MAX_TOOL_ROUNDS, which was not what stopped it — and the merge round
    // found two more turns wearing the same wrong label: a round whose provider call FAILED (E5),
    // and a round that stopped normally but emitted no text block (E4, the FREE_BRAIN_EMPTY
    // shape). Three causes reach this write and each is called by its own name; the fourth,
    // `terminal_write_after_tool_text`, named V2's extra call and is gone with it.
    ctx.degraded.push(
      deadlineHit ? 'deadline_write'
        : toolPhaseFailed ? 'write_after_tool_phase_failure'
          : rounds >= MAX_TOOL_ROUNDS ? 'rounds_exhausted'
            : 'write_after_empty_first_answer',
    );
  }

  // ── COLLECT EVERYTHING, DELIVER WHAT IS AN ANSWER (§٢) ─────────────────────
  // The join is untouched: `written` still holds every round's prose in order, and the lost-text
  // repair still stands. The filter is applied HERE, at the delivery boundary, and nowhere near
  // the collection — so a round's prose is dropped for what it SAYS and never for where it was
  // written. `collected` is kept beside it because the telemetry below reports the difference:
  // a filter nobody can see the size of is a filter nobody can check.
  //
  // §٢ (V3) — and the ONE exception is the round the reader already read. `readerOwnsHead` is set
  // only when a unit was ACCEPTED, so a turn that streamed nothing, or whose delivery caller
  // refused the first unit, joins exactly as it does today.
  const collected = readerOwnsHead ? joinRoundTextsHeadPinned(written) : joinRoundTexts(written);
  if (readerOwnsHead) {
    const unpinned = joinRoundTexts(written);
    if (unpinned !== collected) {
      // The size of what the pin kept, on the turn it kept it. A rule whose cost is not in the
      // log is a rule nobody can price later.
      ctx.degraded.push(`head_pin_kept:${collected.length - unpinned.length}`);
    }
  }
  const deliveryNotes = [];
  let answer = deliverableText(collected, deliveryNotes);
  if (answer.length !== collected.length) {
    ctx.degraded.push(`tool_announcement_dropped:${collected.length - answer.length}`);
  }
  // §١/٣: and the silent half of that number is named line by line.
  for (const note of deliveryNotes) ctx.degraded.push(note);

  const domain = domainOf(ctx.spend, lexicalRoute);
  let citedRefs = collectCited(answer);

  // ── §٢: ONE WRITING ROUND WHEN A RULING ARRIVES CITING NOTHING ─────────────
  //
  // MEASURED, and it is what decides the shape of this item rather than «search harder». Question
  // 19 of the owner's battery, four passes on ezik.app: THREE came back with `cited: []` and ALL
  // FOUR came back with `retrieved: 4`. The evidence reached the model every time. It did not cite
  // it. So the defect is in the writing, and the repair is a writing round — not a retrieval round,
  // and not a refusal.
  //
  // THE TRIGGER IS THE CONJUNCTION AND NOTHING WIDER: a fiqh-scope answer, `cited` EMPTY, and
  // `retrieved > 0`. An answer with nothing retrieved has nothing to be asked to cite, and asking
  // would only cost a call to be told so. `mixed` is inside the trigger because `mixed` IS a fiqh
  // scope with a live pass beside it (see `domainOf`), and a ruling delivered with zero attribution
  // while four unused rows sit in the table is the same defect whichever way the turn was routed.
  //
  // THE FIVE CONSTRAINTS, EACH WHERE IT IS ENFORCED:
  //   1. ONE ONLY — `citationRetries` against MAX_CITATION_RETRIES, and the block is not a loop.
  //      It does not run a second time even when the retry itself comes back citing nothing.
  //   2. THE TOOL LOOP IS NOT WIDENED — this call is made AFTER the loop, with no `tools` key and
  //      MAX_TOOL_ROUNDS untouched. There is no round for the model to ask for.
  //   3. ZERO EXTRA PAID SEARCH — a consequence of (2) rather than a rule beside it: with no tools
  //      offered there is no Brave call and no `search_live` call to make.
  //   4. STILL EMPTY THE SECOND TIME ⟹ THE FIRST ANSWER GOES OUT AS IT WAS. The retry's text is
  //      adopted ONLY when it actually cites; otherwise `answer` is untouched, and it carries its
  //      usual mark down the same path it would have taken had this block never run. No
  //      withholding, no refusal, and never a substitution by a weaker answer.
  //   5. IT IS NAMED IN `degraded` UNDER ITS OWN NAME. Deliberately NOT folded into
  //      `tool_announcement_dropped`: that counter already counts two classes and its shape is
  //      pinned by a standing assertion, so a third would make an unreadable number unreadable in
  //      a new way. The extra time is a raw number on its own line.
  //
  // AND THE ANSWER HAS TO EXIST BEFORE IT CAN BE MISSING AN ATTRIBUTION. E6 and E7 reach this
  // point with `collected` EMPTY — the write's provider call failed, or no call produced a text
  // block — and an empty answer satisfies «cited is empty» trivially while being no ruling at all.
  // Worse, the retry would then post `{role:'assistant', content: ''}`, which the provider refuses,
  // so the item would spend a call to earn a 400 on the one turn that is already in trouble. The
  // reviewer's explicit last rung is what those exits are for, and this block stays out of them.
  //
  // ── §٤ — AND NONE OF IT RUNS ONCE THE TURN HAS STREAMED ────────────────────
  // Measured in phase two at 37%, 29% and 31.5% of the call, which is not why it is
  // barred here. It is barred because adopting a retry's text after bytes have left
  // REPLACES an answer the reader already has, and that is §٦/١ broken in the plainest
  // way there is. The condition is the turn's own `streamedThisTurn` and not the flag:
  // a turn the flag allowed but the card test withheld never put a byte on the wire and
  // keeps its retry. The suppression is recorded rather than silent.
  let citationRetries = 0;
  const citationRetryNeeded = domain !== 'general' && answer.trim() !== ''
    && citedRefs.length === 0 && table.rows.length > 0;
  // P6 gate, named rather than inferred from control flow: adoption below is unconditional once a
  // retry cites, so a turn that has accepted a reader byte may not enter that replacement path.
  const citationRetryGateOpen = !streamedThisTurn;
  if (citationRetryNeeded && !citationRetryGateOpen) {
    ctx.degraded.push('citation_retry:suppressed_on_stream');
  }
  if (citationRetries < MAX_CITATION_RETRIES
    // §٤ — and none of it on a turn that has already put bytes on the wire. This line is
    // BELOW the ceiling test on purpose: guards/no-empty-answer-guard.cjs M17 rewrites the
    // line above it by regex to prove the item cannot become a loop, and a condition
    // inserted in front of it disarms that mutant without failing anything.
    && citationRetryGateOpen
    && citationRetryNeeded) {
    citationRetries += 1;
    const retryStartedAt = Date.now();
    let retryOutcome = 'still_uncited';
    try {
      const payload = await callProvider({
        providerUrl,
        headers,
        signal,
        body: {
          model,
          max_tokens: outputBudget(maxTokens),
          ...thinkingPolicy(),
          ...(usePremium && effort ? { output_config: { effort } } : {}),
          system,
          // The model's own prose is replayed as the assistant turn it was, so what it is being
          // asked to do is rewrite THAT — not answer the question a second time from scratch.
          // `conversation` already holds every tool_use turn and every tool_result batch, so the
          // evidence the note refers to as «أعلاه» really is above it.
          messages: [
            ...conversation,
            { role: 'assistant', content: collected || answer },
            { role: 'user', content: CITATION_RETRY_NOTE },
          ],
          // NO `tools` KEY. Constraint (2) and (3) are this absence and not a check somewhere else.
          stream: false,
        },
      });
      modelCalls += 1;
      // `rounds + 2` and never `rounds + 1`: the tools-removed write above already used that
      // number when it ran, and two rows with one ordinal is a ledger that cannot be read.
      ledgerRow(rounds + 2, payload, 'cite-retry', Date.now() - retryStartedAt);
      const retryAnswer = deliverableText(joinRoundTexts([textOf(payload.content)]));
      const retryRefs = collectCited(retryAnswer);
      if (retryRefs.length) {
        answer = retryAnswer;
        citedRefs = retryRefs;
        // §٢ — INSIDE the adoption branch and nowhere else. A retry that is not adopted leaves no
        // word of its text with the reader, so its finish state is a fact about a discarded draft.
        deliveredStop = payload.stop_reason ?? null;
        retryOutcome = `cited:${retryRefs.length}`;
      }
    } catch (error) {
      // A failed retry is not a failed turn. The first answer is already in hand and is what the
      // reader receives; `failure` is NOT set, because the turn did not fail — an extra, optional
      // call did, and conflating the two would make an upstream blip look like a broken answer.
      retryOutcome = `error:${String(error?.status || '')}:${String(error?.message || error)}`;
    }
    ctx.degraded.push(`citation_retry:${retryOutcome}`);
    ctx.degraded.push(`citation_retry_ms:${Date.now() - retryStartedAt}`);
  }

  // Emitted from HERE and not from api/ask.js, which is outside this round's ownership. One line,
  // one JSON array, so the platform log can be read without a parser.
  //
  // AND EMITTED AFTER THE §٢ RETRY, WHICH IS THE WHOLE OF THIS ITEM. Printed above that block the
  // line was serialised before `ledgerRow(rounds + 2, …, 'cite-retry')` had run, so the retry's row
  // was counted in `out.roundLedger` and appeared in the platform log NEVER. The witness is the
  // `mnjgt` call: `modelCalls: 4` beside a printed ledger of three rows. `ledgerRow` at `rounds + 2`
  // is the last writer of this array, and the turn returns it a hundred lines below, so this is the
  // first position from which the printed ledger and the returned one are the same ledger.
  //
  // NOTHING ELSE MOVED. The tool loop is not widened and its logic is untouched: this is one
  // statement's position and no other change.
  console.log('[free-brain/round-ledger]', JSON.stringify(roundLedger));

  // ── THE CARD FOLLOWS THE CITATION (§٣) ─────────────────────────────────────
  // WHAT THE REVIEWER IS GIVEN is every row the PROPOSAL cited: it is judging that proposal, and
  // evidence withheld from it is evidence it cannot credit a sentence with. That input is
  // unchanged. What moved is the CARD LIST, which is now decided below, after the review.
  const proposedRows = citedRefs.map((ref) => table.byRef(ref)).filter(Boolean);
  const readerText = stripCitations(answer);

  // ── §١: THE KHILAF SIGNAL, PRODUCED FROM THE EVIDENCE THE ANSWER RESTED ON ─
  // `proposedRows` and not `table.rows`: the count is about what the answer actually leaned on,
  // not about everything retrieval happened to return. See `khilafSignal`.
  const khilaf = khilafSignal(proposedRows);

  // ── §٢ (C): DID THE ANSWER FINISH? ─────────────────────────────────────────
  // The name is `truncated` and it is the contract with Codex, letter for letter.
  const truncated = truncatedFrom(deliveredStop);

  // ── THE ONE CALL TO BRANCH ب (§٧) ──────────────────────────────────────────
  const reviewed = await reviewAnswer({
    text: readerText,
    evidence: proposedRows.map(reviewerEvidence),
    domain,
    mode,
    // §١ — the two names are literal and are the contract with branch ب. `null` is «I do not
    // know» and is never to be read as `false`.
    khilafFromOpinions: khilaf.khilafFromOpinions,
    opinionCount: khilaf.opinionCount,
    // §٢ (C) — the third signal, crossing at the same seam and under the same discipline.
    truncated,
  });

  // ── AND NOW THE CARDS, FROM THE TEXT THAT IS ACTUALLY BEING HANDED OVER ────
  // Order is the DELIVERED order, not the proposal's: `api/ask.js` caps the list at MAX_SOURCES,
  // and the cards the reader's own prose reaches first are the ones that survive that cap.
  // The `||` keeps E7's invariant intact: the reviewer guarantees a non-empty string, and removing
  // reference numbers from it must not be the one thing that reintroduces the empty bubble.
  const deliveredText = dropOrphanRefNumbers(reviewed.text) || reviewed.text;
  const streamedPrefix = String(streamResult?.acceptedPrefix || '');
  const streamPrefixValid = !streamedThisTurn
    || (streamedPrefix !== '' && deliveredText.startsWith(streamedPrefix));
  if (!streamPrefixValid) {
    ctx.degraded.push('stream_violation:emitted-not-a-prefix');
  }
  const terminalWriteLedger = [...roundLedger].reverse().find((row) => row.phase === 'write') || null;
  const readerUnits = unitsForDelivery({
    streaming: streamRoundEligible ? streaming : { enabled: false },
    readerText, deliveredText, domain, mode, khilaf, truncated,
    evidence: proposedRows.map(reviewerEvidence), degraded: ctx.degraded,
  });
  const deliveredFolded = foldWs(deliveredText);
  const surviving = citedRefs
    .map((ref) => ({ ref, anchor: citationAnchor(answer, ref) }))
    // An anchor too short to identify is not evidence that the sentence is gone. See ANCHOR_MIN.
    .filter((entry) => !entry.anchor || deliveredFolded.includes(entry.anchor))
    .map((entry) => ({ ...entry, at: entry.anchor ? deliveredFolded.indexOf(entry.anchor) : Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.at - b.at);
  const cited = surviving.map((entry) => table.byRef(entry.ref)).filter(Boolean);
  if (cited.length !== proposedRows.length) {
    ctx.degraded.push(`cards_after_review:${proposedRows.length}->${cited.length}`);
  }

  // ── S1/§١/٥ — THE THIRD EVENT, AND IT IS COUNTED HERE FOR A REASON ────────
  // `cited` and not `proposedRows`: a row the draft cited and the reviewer then removed from the
  // delivered text was not used by the answer anybody read, and counting it would report a reach
  // this feature did not have. The other two events were counted where they happened, at the
  // call. All three move only when something occurred.
  storedInjection.cited = cited.filter((row) => injectedRefs.has(row.ref)).length;
  console.log('[stored-injection]', JSON.stringify(storedInjection));

  return {
    text: deliveredText,
    // P5 §٣ — the ordered prefixes of `text` that may go on the wire as they stand. Empty
    // whenever the flag is off or the prefix check declined, and the caller treats empty as
    // «deliver in one piece», so this field can never shorten an answer.
    readerUnits,
    streamedThisTurn,
    streamedPrefix,
    streamPrefixValid,
    streamRoundEligible,
    readerOwnsHead,
    terminalWriteMs,
    terminalWriteUsage: terminalWriteLedger ? {
      outTokens: terminalWriteLedger.outTokens,
      inTokens: terminalWriteLedger.inTokens,
      cacheWriteTokens: terminalWriteLedger.cacheWriteTokens,
      cacheReadTokens: terminalWriteLedger.cacheReadTokens,
    } : null,
    streamViolations: Array.isArray(streamResult?.violations)
      ? streamResult.violations : [],
    verdict: reviewed.verdict,
    annotations: reviewed.annotations,
    cited,
    evidence: table.rows,
    domain,
    // S1/§١/٥ — returned as well as logged, so a caller and a guard can read the same three
    // numbers the platform log prints rather than each deriving its own.
    storedInjection,
    // §١ — returned so the platform log can report what was sent to the reviewer. A signal that
    // only the reviewer ever sees is a signal nobody can check after the fact.
    khilafFromOpinions: khilaf.khilafFromOpinions,
    opinionCount: khilaf.opinionCount,
    // §٢ (C) — true | false | null. Returned so api/ask.js can tell the reader, and so the
    // platform log records what the reviewer was told rather than what anyone assumed.
    truncated,
    // The raw finish state beside the derived flag. A boolean nobody can trace back to a
    // `stop_reason` is a boolean nobody can check, and this is the one field that makes the
    // «derived from the text» mutant visible in a log rather than only in a guard.
    deliveredStop,
    rounds,
    // §٢ — 0 or 1, never more. Returned so the cost of the item is readable as a number beside the
    // model-call count it moved, rather than inferred from a string in `degraded`.
    citationRetries,
    modelCalls,
    spend: ctx.spend,
    degraded: ctx.degraded,
    roundLedger,
    failure,
    injectionMarkers: ctx.injectionMarkers,
    elapsedMs: Date.now() - startedAt,
  };
}

/**
 * ── THE SHAPE THE REVIEWER READS (merge §٢/٣) ───────────────────────────────
 *
 * The reviewer's world is the evidence of THIS turn and nothing else, and it reads that evidence
 * through `evidenceView` — a fixed set of field names, each with a fixed list of accepted aliases.
 * A row that arrives under a name outside that list is not rejected; it is silently INVISIBLE,
 * which is worse. So the normalisation is written out here, one field per line, rather than left
 * to the accident of what the tool layer happens to call things:
 *
 *   id       ← `<scholarId>:<recordId>` for a corpus fatwa, else the URL, else the table `ref`.
 *              This is the second of the two channels `officialSourceFor` accepts: a corpus record
 *              proves whose shelf it came off even when the URL host says nothing.
 *   title    ← the row's title, verbatim.
 *   url      ← the row's URL. Empty for the Kuwaiti encyclopedia, which has no page, and that is
 *              a real state the reviewer handles rather than a gap to paper over.
 *   scholar  ← the PUBLISHER. For a corpus fatwa this is the roster's own scholar name
 *              (lib/fatwa-service.js sets `publisher: scholar.name`), which is exactly the string
 *              the authority registry is derived from.
 *   snippet  ← the retrieved material. Carries the published question AND answer for a fatwa, so
 *              `supportsSentence` is matching a claim against the fatwa's own words.
 *   date     ← the RETRIEVAL date stamped in ./tools.js. Never presented as a publication date.
 *
 * PREVIOUS TURNS CANNOT REACH IT. The table is created inside `runFreeBrainTurn` and dies with it,
 * so «دليل الدورة» is scoped by construction and not by a reset anybody has to remember to run.
 * `cited` narrows it once more: the rows the FINISHED text actually cited, not everything retrieval
 * returned.
 */
/**
 * ── §١: THE CEILING IS THE SAME CEILING (XC-07) ─────────────────────────────
 *
 * `MAX_SOURCES = 3` has been in api/ask.js since it was written, and the free branch was the one
 * path that never read it: the card list was `out.cited.map(...).filter(Boolean)` with no `slice`
 * and no limit, and `registerOwnedCards` only removes duplicates. Every cited row with a usable
 * URL became a card, however many there were. MEASURED: four cards in three answers of the second
 * set, and five on question 17 of the 17 August production battery.
 *
 * THE CHOICE AT THE CEILING IS NOT ARBITRARY. `cited` arrives ordered by first appearance in the
 * text the reader is about to read (see the tail of `runFreeBrainTurn`), so the pages the reader's
 * own prose reaches FIRST are the ones that survive the cut.
 *
 * DEDUPLICATION RUNS BEFORE THE CUT, not after. Two citations of one page cost one slot, not two —
 * capping first and deduplicating afterwards would let a repeated source silently evict a distinct
 * one and hand the reader two cards where three were available.
 *
 * IT LIVES HERE AND NOT INLINE IN api/ask.js SO THAT IT CAN BE KILLED. A rule written inside a
 * Vercel handler cannot be driven by a mutant without loading the whole request path; the same
 * rule as a pure function is one line for guards/no-empty-answer-guard.cjs to mutate. `max` and
 * `buildTag` are passed IN rather than imported, so MAX_SOURCES stays the single constant it is
 * and URL safety stays where `buildSourceTag` already enforces it.
 *
 * @param {Array<object>} cited  rows in delivered-text order
 * @param {number} max           api/ask.js's MAX_SOURCES
 * @param {(row: object) => ({tag: string}|null)} buildTag  api/ask.js's card builder
 */
export function pickReaderCards(cited, max, buildTag) {
  const out = [];
  for (const row of Array.isArray(cited) ? cited : []) {
    if (out.length >= max) break;
    const card = row && row.url ? buildTag(row) : null;
    if (card && card.tag && !out.some((item) => item.tag === card.tag)) out.push(card);
  }
  return out;
}

/** The one place the library tool's own row kind is written down on this side of the seam. */
const LIB_BOOK_KIND = 'lib_book';

/**
 * ── ع-٤٩: A BOOK IS NOT A PAGE, AND IT WAS REACHING THE READER AS NOTHING ───
 *
 * MEASURED, 1 September 2026: `lib_book` existed in exactly one file in the whole tree
 * (./tools.js), appeared ZERO times in app.js and app.jsx, and the preview log for one day held
 * `search_library` ×9 and `lib_book` ×7. So the tool was called, the tool succeeded, the atoms
 * reached the answer — and there was no card builder in the server and no renderer in the client.
 * The quotation dissolved into prose and the reply was then stamped «معرفةٌ مستقرة غير منقولة».
 *
 * WHY `pickReaderCards` COULD NEVER HAVE DONE IT. That loop selects `row.url ? buildTag(row)`,
 * and a book atom carries `url: ''` ON PURPOSE — the row is attribution, not a link a reader can
 * open (./tools.js says so at the head of `runLibrary`). A book row was therefore not a candidate
 * there and never will be; this is the same shape of silent loss §٣ found for the encyclopedia,
 * and it gets its own selection rather than a relaxation of that one.
 *
 * IT COSTS NO PAGE SLOT, for the reason the encyclopedia footer costs none: `MAX_SOURCES` is a
 * ceiling on external PAGES a reply may display, and a book chip displays no page. The cap passed
 * in is its own, applied over book rows alone.
 *
 * THE SELECTION IS THE NARROWEST ONE THE CODE CAN EXPRESS: `cited` is the rows the DELIVERED text
 * actually cited, in delivered order — not everything the library returned.
 *
 * @param {Array<object>} cited  rows in delivered-text order — the same array pickReaderCards gets
 * @param {number} max          the ceiling on book chips in one reply
 * @param {(row: object) => ({tag: string}|null)} buildCard  api/ask.js's book-card builder
 */
export function pickBookCards(cited, max, buildCard) {
  const out = [];
  for (const row of Array.isArray(cited) ? cited : []) {
    if (out.length >= max) break;
    if (!row || row.kind !== LIB_BOOK_KIND) continue;
    const card = buildCard(row);
    if (card && card.tag && !out.some((item) => item.tag === card.tag)) out.push(card);
  }
  return out;
}

/**
 * ── §٣ (C): THE KUWAITI ENCYCLOPEDIA GETS A FOOTER, NOT A CARD ──────────────
 *
 * THE OWNER'S DECISION, VERBATIM: «إذا كان يأخذُ شيئًا من الموسوعةِ الفقهيّةِ الكويتيّة، يكتفي
 * بتذييلٍ أنّ المصدرَ من الموسوعةِ الفقهيّةِ الكويتيّة».
 *
 * AND THE MEASURED REASON IT WAS NEEDED. An encyclopedia row is added by `runSources` in ./tools.js
 * with `url: ''` — the corpus is a local gzip, there is no page to open. `pickReaderCards` above
 * builds a card only `if (row && row.url)`, so an encyclopedia row could be retrieved, cited by the
 * model, survive the reviewer, and reach the reader as NOTHING AT ALL. The loss was silent because
 * the selection gave up before the card builder was ever asked.
 *
 * A FOOTER IS NOT A CARD AND THAT IS THE WHOLE OF §٣/٢. It costs no slot: this function never
 * touches `MAX_SOURCES`, and `pickReaderCards` cannot see it. The ceiling therefore keeps meaning
 * what it means — «at most three external PAGES» — and an answer that leaned on the encyclopedia
 * and on three fatwa pages shows three cards and one line, not two cards and an argument.
 *
 * THE NAME OF THE ARTICLE IS TAKEN FROM THE ROW AND NEVER INVENTED. ./tools.js writes the title as
 * «الموسوعة الفقهية الكويتية — <term>», so the term is what follows the dash; a row that carries no
 * term yields the encyclopedia alone, which is exactly what §٣/١ asks for. The publisher string is
 * read off the row too rather than written here twice, so the two files cannot drift.
 *
 * @param {Array<object>} cited  the rows the DELIVERED text cited, in delivered order
 * @returns {string} the tail to append, or '' when the answer did not rest on the encyclopedia
 */
const ENCYCLOPEDIA_KIND = 'encyclopedia';
// How many articles a single tail may name before it stops being a footer and starts being a list.
const ENCYCLOPEDIA_TERMS_MAX = 3;

export function encyclopediaTail(cited) {
  const rows = (Array.isArray(cited) ? cited : [])
    .filter((row) => row && row.kind === ENCYCLOPEDIA_KIND);
  if (!rows.length) return '';
  const name = String(rows[0].publisher || '').trim() || 'الموسوعة الفقهية الكويتية';
  const terms = [];
  for (const row of rows) {
    // Everything after the first dash in the row's own title. Both dash shapes, because the title
    // is built with an em dash today and a hyphen is one edit away from being the same field.
    const term = String(row.title || '').split(/\s[—–-]\s/u).slice(1).join(' - ').trim();
    if (term && !terms.includes(term)) terms.push(term);
  }
  const named = terms.slice(0, ENCYCLOPEDIA_TERMS_MAX);
  if (!named.length) return `\n\nالمصدر: ${name}.`;
  return `\n\nالمصدر: ${name} — مادّة: ${named.join('، ')}.`;
}

/**
 * ── §٣/٣ (C): EVERY CITED ROW THAT GAVE THE READER NOTHING, BY NAME ─────────
 *
 * «لا صمتَ بعدَ اليوم». The card list is built by `pickReaderCards`, which returns what it kept and
 * says nothing whatever about what it did not. Three separate rules can end a cited row's life in
 * that loop and all three looked identical from outside: the row had no page, the row repeated a
 * page already shown, or the row arrived after the third slot was full.
 *
 * IT MIRRORS `pickReaderCards` RATHER THAN RE-DERIVING IT, and the one place the two deliberately
 * differ is the cap: the selection BREAKS at the ceiling because it has nothing left to do, and
 * this walk does not, because «the rows past the ceiling» is the answer to the question being
 * asked. Any other divergence between the two loops is a defect in this one.
 *
 * THE ENCYCLOPEDIA IS NOT A LOSS ANY MORE, and this is where that becomes visible: a row with no
 * URL is `footer` when it is the encyclopedia and `no_url` when it is not. A `no_url` line in the
 * log is now a real question — which corpus produced a row with no page and no footer? — rather
 * than the encyclopedia's daily noise.
 *
 * @param {Array<object>} cited  rows in delivered-text order — the same array `pickReaderCards` gets
 * @param {number} max           api/ask.js's MAX_SOURCES
 * @param {(row: object) => ({tag: string}|null)} buildTag  api/ask.js's card builder
 * @returns {Array<{ref:*, kind:string, outcome:string}>} one row per cited row, in order
 */
export function citedDeliveryLedger(cited, max, buildTag) {
  const tags = [];
  const out = [];
  for (const row of Array.isArray(cited) ? cited : []) {
    const base = { ref: row?.ref ?? null, kind: String(row?.kind || '') };
    if (!row || !row.url) {
      out.push({ ...base, outcome: row?.kind === ENCYCLOPEDIA_KIND ? 'footer' : 'no_url' });
      continue;
    }
    if (tags.length >= max) { out.push({ ...base, outcome: 'over_cap' }); continue; }
    const card = row.url ? buildTag(row) : null;
    if (!card || !card.tag) { out.push({ ...base, outcome: 'unbuildable' }); continue; }
    if (tags.includes(card.tag)) { out.push({ ...base, outcome: 'duplicate' }); continue; }
    tags.push(card.tag);
    out.push({ ...base, outcome: 'card' });
  }
  return out;
}

export function reviewerEvidence(row) {
  const corpusId = row.scholarId && row.recordId ? `${row.scholarId}:${row.recordId}` : '';
  // ع-٤٩/§٣-٤ — A BOOK ATOM HAS NO SCHOLAR AND NO URL, so before this line every book row and
  // every encyclopedia row reached the reviewer as the same anonymous «ref-N» and the reviewer had
  // no way to know a quotation from a book was in its hands. `recordId` is «lib:<atom>», stamped
  // by lib/lib-service.js, and it is the row's own identity rather than anything derived here.
  const bookId = row.kind === LIB_BOOK_KIND && row.recordId ? String(row.recordId) : '';
  return {
    id: corpusId || bookId || row.url || `ref-${row.ref}`,
    title: row.title || '',
    url: row.url || '',
    scholar: row.publisher || '',
    snippet: row.text || '',
    date: row.retrievedAt || '',
    // ع-٥٥ — AND THE TWO FIELDS THAT TELL THE REVIEWER WHAT IT IS HOLDING. Until this line the
    // reviewer was handed six fields and not one of them said «this is a book», so
    // `attributedEvidenceFor` in lib/output-reviewer.js could not tell a page of المغني from an
    // anonymous web hit, and stripped ابن قدامة's name off a sentence his own page supported.
    //
    // `kind` is GATED on this file's own constant rather than passed through: a library atom is
    // the one row shape that is allowed to announce itself to the reviewer, and a `kind` this
    // half does not recognise must not arrive there looking like one. `author` is `row.author`
    // (lib/free-brain/tools.js:456) verbatim and is NOT derived from `publisher` — the two carry
    // the same string in today's book row and nothing holds them to it.
    kind: row.kind === LIB_BOOK_KIND ? row.kind : '',
    author: row.author || '',
  };
}

// ════════════════════════════════════════════════════════════════════════════
// §١ — THE KHILAF SIGNAL. THIS HALF PRODUCES IT; lib/output-reviewer.js CONSUMES IT.
// ════════════════════════════════════════════════════════════════════════════
//
// The owner's rule has two prongs: a matter is known to be disputed (a) because MORE THAN ONE
// OPINION exists on the same question, and (b) because the early books usually SAY SO. Prong (b)
// is computed from the excerpt by the reviewer and is not this file's business. Prong (a) is, and
// it reaches the reviewer under exactly these two names:
//
//   khilafFromOpinions   true | false | null
//   opinionCount         a whole number, or null when it cannot be counted
//
// ── THE CONTRACT, AND WHY IT IS NOT NEGOTIABLE ──────────────────────────────
// `null` means «I do not know». It does NOT mean `false`. The reviewer treats it that way, so
// sending `false` out of ignorance SILENTLY SUPPRESSES the khilaf tail on a matter that is in fact
// disputed, and sending `true` out of a hunch attaches it to a matter that is not. Both are lies
// told in the reader's own reply. Honesty here is cheaper than coverage, and this producer is
// written so that the honest answer is the one that costs nothing to give.
const KHILAF_UNKNOWN = null;

/**
 * §١/١ — THE COUNT, ALWAYS. Distinct sources — «نطاقٌ + معرِّفُ فتوى» — among the rows the answer
 * ACTUALLY rested on. A pure number about the shape of the evidence set, carrying no judgement
 * whatever about what those sources say.
 *
 * THE KEY IS THE PAIR AND NOT EITHER HALF. Two fatwas by one scholar on one host are two sources,
 * because they are two published rulings that can differ; the domain alone would count them as
 * one. And the record id alone would collide across hosts, because ids are only unique per site.
 *
 * A ROW WITH NO LINK STILL COUNTS. The Kuwaiti encyclopedia has no page (`url: ''`) and is still a
 * distinct source, so the domain half falls back to the publisher and the id half to the record
 * id, then to the table `ref` — which is unique by construction. The one thing this must never do
 * is fold two real sources into one and under-report the multiplicity it exists to measure.
 */
export function distinctSourceKeys(rows) {
  const keys = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row) continue;
    let domain = '';
    if (row.url) {
      try { domain = new URL(row.url).hostname.toLowerCase().replace(/^www\./u, ''); } catch { domain = ''; }
    }
    if (!domain) domain = String(row.publisher || '').trim();
    const id = String(row.recordId || '').trim()
      || String(row.url || '').trim()
      || `ref:${row.ref}`;
    keys.add(`${domain}|${id}`);
  }
  return keys;
}

/**
 * §١/٢-٣ — THE PROBE, AND WHY IT ANSWERS «I DO NOT KNOW».
 *
 * The directive required this to be decided by measurement and not by preference: is there, in
 * what is ALREADY in hand and WITHOUT a ruling detector, a reliable sign that more than one
 * opinion exists? Three candidates were named and all three were measured against the fatwa set
 * deposited in this tree — 18 normalised records in fixtures/fatwa-authority-eighteen.json, one
 * per scholar of the roster, plus the 2 raw service records of
 * fixtures/riba-family-two-records.json, which are the only real multi-source evidence set the
 * tree holds. tools/khilaf-signal-measure.mjs runs the whole measurement and prints it.
 *
 *   (a) A FIELD IN THE FATWA STORE.  0 of 20. The raw service record carries exactly
 *       audio · categories · collection · content · id · recordHash · scholar · source · title ·
 *       uid, and `content` carries answer · answerExcerpt · question · questionExcerpt · type.
 *       Not one of them expresses dispute or multiplicity. The path does not exist.
 *   (b) A TAG IN THE DATA.  0 of 20. The only tag-shaped fields are `categories` and
 *       `collection.name`, and every value they hold is an archive label — «فتاوى الجامع الكبير»,
 *       «فتاوى نور على الدرب», «الشريط رقم [304]». They name a series, never a disagreement.
 *   (c) MULTIPLICITY OF DISTINCT SOURCES, i.e. `opinionCount >= 2`.  The deposited set contains
 *       exactly ONE evidence set with more than one source: the ribā pair. The proxy fires on it
 *       and is WRONG on it — Ibn Bāz and Ibn ʿUthaymīn are not two opinions on one question, they
 *       are one doctrine applied to two different questions, which the fixture's own note records
 *       («الأوّل في صميم المسألة والثاني عن القمح»). Measured precision of the only computable
 *       path: 0 correct, 1 false. There is no threshold to document on one trial, and the trial
 *       that exists says no.
 *
 * AND THE OTHER BRANCH IS WORSE. Reading `opinionCount === 1` as `false` would have contradicted
 * the material in hand on 1 of the 18 single-source records — al-Athary on divorce pronounced in
 * anger, whose own published text declares the matter disputed. One measured lie in eighteen is
 * the FLOOR and not the rate: an excerpt is short, and most disputed matters never say so in it.
 *
 * SO THE FIRST PRONG NEEDS THE RULING DETECTOR, IN A ROUND OF ITS OWN. «Two different opinions»
 * means comparing the DIRECTION of the ruling between two excerpts, and the ribā pair is the proof
 * that even that comparison is not enough on its own: the two records diverge on the surface —
 * prohibition against permission — while agreeing completely, because they answer two different
 * questions. Deciding that needs the five-step detector designed on paper and not yet built, and
 * building it inside a parallel round is a door that does not close again.
 *
 * @returns {true|false|null} null — and null always, until that detector exists.
 */
export function khilafFromOpinionsProbe(rows) {
  void rows;
  return KHILAF_UNKNOWN;
}

/**
 * The single producer of both fields, so the invariant below has exactly one place to live.
 *
 * THE NEGATIVE WITNESS IS ENFORCED HERE AND NOT ASSUMED. One source cannot be two opinions. So
 * `true` is unreachable from a single-source evidence set whatever the probe says — and it stays
 * unreachable for whoever fills the probe in next round, because this clause is above them.
 *
 * @param {Array<object>} rows  the evidence the answer actually rested on
 * @returns {{khilafFromOpinions:(true|false|null), opinionCount:number}}
 */
export function khilafSignal(rows) {
  const opinionCount = distinctSourceKeys(rows).size;
  const probed = khilafFromOpinionsProbe(rows);
  const known = probed === true || probed === false;
  const khilafFromOpinions = (probed === true && opinionCount <= 1) ? null
    : known ? probed
      : null;
  return { khilafFromOpinions, opinionCount };
}
