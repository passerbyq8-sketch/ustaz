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
// ── WHY THE ANSWER IS BUFFERED AND NOT STREAMED ──────────────────────────────
// MEASURED, and it decides §٥'s streaming item rather than being an opinion about it:
// lib/finalized-sse-writer.js accumulates EVERY data frame into `frames` and writes nothing to
// the client until `flush()` runs at end-of-stream (see its `acceptFrame`/`flush`). So no path in
// this application — including the shipped "streamed" round 2 — puts a byte on a reader's screen
// before the whole answer exists server-side. Streaming from here would change nothing a reader
// can see, and would trade a real invariant for an appearance: §٠ of the directive requires the
// output checker to see the text «قبل أن يصل الحرف للمستخدم», which is the same requirement the
// writer already enforces. Incremental delivery therefore needs the writer's contract reopened,
// which is branch ب's ground. It is named as a deferred item in the report, not skipped silently.
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
  FREE_BRAIN_THINKING_DEFAULT, FREE_BRAIN_TOOL_PHASE_MS,
  createEvidenceTable, runTool,
} from './tools.js';
import { OPEN_WEB_CAUTION, ROUND_TEXT_REMINDER, CITATION_RETRY_NOTE } from './instructions.js';

// ── §٢ — HOW MANY WRITING ROUNDS A ZERO-CITATION RULING BUYS ──────────────────
// One. Written as a named constant rather than a bare `if` so the ceiling is a number a reader can
// see and a mutant can move, and so that «واحدةٌ فقط» is a property of this file rather than a fact
// about how its control flow happens to be shaped today.
const MAX_CITATION_RETRIES = 1;

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

/** Remove the markers, leaving the prose the reader reads. */
export function stripCitations(text) {
  return String(text || '')
    .replace(CITE_RE, '')
    // A marker sat at the end of a sentence, so removing it leaves a space before the full stop.
    .replace(/[ \t]+([.،؟!:؛])/gu, '$1')
    .replace(/[ \t]{2,}/gu, ' ')
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
    .replace(/[ \t]{2,}/gu, ' ')
    .replace(/[ \t]+\n/gu, '\n')
    .trim();
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

// The verbs a turn uses to say «not yet — first I go and look». Folded spelling only.
const PROMISE_VERB = 'أبحث|أتحقق|أتأكد|أستوثق|أستوضح|أستفسر|أراجع|أطلع|أستعرض|أجيب|أعود';
// The frames that put one of those verbs in the future or in a request for leave. A bare «أبحث»
// is present tense and can be part of an answer, so no frame means no match.
const PROMISE_RE = new RegExp(
  '(?:^|[\\s،؛:.«"(])(?:'
  + 'س(?:' + PROMISE_VERB + ')'                                  // سأبحث · سأتحقق
  + '|(?:دعني|اسمح لي|امهلني|أمهلني)\\s+(?:أن\\s+)?(?:' + PROMISE_VERB + ')'   // دعني أتأكد
  + '|(?:أن|بأن|لكي|كي|حتى)\\s+(?:' + PROMISE_VERB + ')'          // يستحق أن أستوثق
  + '|(?:أكمل|أواصل|أتابع|أستكمل)\\s+(?:ال)?بحث'                  // أكمل البحث
  + ')', 'u');
// Anything that makes the sentence an answer rather than a promise: a citation marker, any digit,
// a card the client draws, scripture between the ornate parentheses, or a ruling word. Presence of
// ANY of these keeps the sentence, whole, however it opened.
const ANSWER_CONTENT_RE = new RegExp(
  '\\[\\[|[0-9٠-٩]|﴿'
  + '|<(?:verse|surah|hadith|steps|suggestions|source|board|document|dhikr|worship)\\b'
  + '|(?:يجوز|جائز|يحرم|حرام|محرم|واجب|يجب|تجب|فرض|مستحب|يستحب|مندوب|مكروه|مباح|سنة'
  + '|صحيح|يصح|تصح|باطل|ينقض|بأس|حرج|نصاب|ركعة|ركعات|قال الله|قال تعالى|روى|عن النبي)', 'u');

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
// The search, or what it returned, as the thing the sentence is ABOUT. Folded spelling only.
const TOOL_TOPIC_RE = new RegExp(
  '(?:^|[\\s،؛:.«"(])(?:'
  + '(?:نتيجة|نتائج|حصيلة|مخرجات)\\s+(?:ال)?بحث'                       // نتيجة البحث · نتائج بحثي
  + '|(?:تلك|هذه)\\s+النتائج'                                          // تلك النتائج التي وصلتني
  + '|النتائج\\s+التي\\s+(?:وصلتني|رجعت|ظهرت|جاءتني|عادت)'             // النتائج التي وصلتني
  + '|ما\\s+(?:ظهر|رجع|وصلني|جاءني|عاد)\\s+(?:لي\\s+)?(?:في|من)\\s+(?:ال)?(?:بحث|نتائج|مصادر)'
  + '|(?:ال)?بحث\\s+الذي\\s+(?:أجريته|قمت\\s+به)'                       // البحث الذي أجريته
  + ')', 'u');
// …and the predicate that makes the sentence a REPORT ON that run rather than a finding from it.
const TOOL_REPORT_RE = new RegExp(
  'كان(?:ت)?\\s+(?:مجرد\\s+)?بحث'                                      // كانت بحثًا عن كلمة
  + '|لم\\s+(?:تعطني|يعطني|تفدني|يفدني|تسعفني|يسعفني|تتضمن|يتضمن)'
  + '|(?:مجرد|محض)\\s+معلومات'                                         // ما ظهر مجرد معلومات عامة
  + '|معلومات\\s+عامة'
  + '|(?:غير|ليست|ليس)\\s+(?:مفيدة?|ذات\\s+صلة|متعلقة)'
  + '|لا\\s+(?:تفيد|يفيد|علاقة\\s+لها|صلة\\s+لها)', 'u');

// A deliberately WIDE pre-filter for the line-level fast path, and nothing else. A fast path that
// UNDER-admits is a filter that silently stops filtering — which is how §٣'s class would have gone
// on being delivered while every assertion about it stayed green. This one only has to be cheap;
// it never has to be right, because the decision belongs to `isToolResultReport` alone.
const TOOL_MENTION_RE = /(?:بحث|نتائج|نتيجة|مصادر)/u;

/** TRUE when this sentence reports on the tool run instead of answering from it. */
export function isToolResultReport(sentence) {
  const folded = foldMarks(sentence).trim();
  if (!folded) return false;
  if (ANSWER_CONTENT_RE.test(folded)) return false;
  return TOOL_TOPIC_RE.test(folded) && TOOL_REPORT_RE.test(folded);
}

/**
 * The delivered form of the collected text: the same string with the announcement sentences taken
 * out of it. Structure is preserved line by line — a markdown heading, a list marker and a blank
 * line all survive — because the drop is made INSIDE a line and a line that empties is removed
 * whole rather than left as a hole in the prose.
 */
export function deliverableText(text) {
  const lines = String(text ?? '').split('\n');
  const kept = lines.map((line) => {
    // The fast path has to know about BOTH classes, or §٣'s is never reached: a line that reports
    // on the tool run carries no promise verb at all, so keying the split on PROMISE_RE alone
    // returned it whole. TOOL_MENTION_RE and not TOOL_TOPIC_RE, deliberately — see its comment.
    const foldedLine = foldMarks(line);
    if (!line.trim() || !(PROMISE_RE.test(foldedLine) || TOOL_MENTION_RE.test(foldedLine))) return line;
    // Sentence boundaries, keeping the terminator with the sentence it ends.
    const parts = line.match(/[^.؟!…]*(?:[.؟!…]+|$)/gu) || [line];
    const survivors = parts.filter((part) => part.trim()
      && !isToolAnnouncement(part) && !isToolResultReport(part));
    const rebuilt = survivors.join(' ').replace(/[ \t]{2,}/gu, ' ').trim();
    // The indentation of a surviving list item is part of the list, not part of the sentence.
    const indent = /^[ \t]*(?:[-*•]\s+|\d+[.)]\s+)?/u.exec(line)[0];
    return rebuilt ? (rebuilt.startsWith(indent.trim()) ? rebuilt : indent + rebuilt) : '';
  });
  return kept.join('\n').replace(/\n{3,}/gu, '\n\n').trim();
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
    providerUrl, headers, signal, dailyBudget = null, fetchImpl = undefined,
  } = options;

  const table = createEvidenceTable();
  const ctx = {
    table, band, dailyBudget, signal, fetchImpl,
    spend: [], degraded: [], injectionMarkers: [],
  };
  const callsPerTool = new Map();
  const conversation = [...(Array.isArray(messages) ? messages : [])];

  let rounds = 0;
  let modelCalls = 0;
  // Every round's prose, in the order the model wrote it. See `joinRoundTexts`.
  const written = [];
  // TRUE only when the model STOPPED and said something. It is deliberately not «is `written`
  // non-empty»: a round that ends on `end_turn` with no text block (E4) must still reach the
  // tools-removed write, and after this change `written` can already be full from an earlier
  // round — so keying the write on the accumulated text would have deleted E4 silently.
  let finished = false;
  let sawOpenWeb = false;
  // ── THE ROUND LEDGER (§٢ of the lost-text round) ───────────────────────────
  // MEASUREMENT ONLY. It changes no reader-visible byte; it exists because the platform log could
  // answer «how many rounds» and could not answer «did the early rounds carry text, and how long
  // was each block» — and §٢'s verdict may not be written on a hypothesis the log cannot test.
  // One row per provider call: its stop_reason, the block types in order, and the character count
  // of the text blocks, which is exactly the quantity that decides whether text was lost.
  const roundLedger = [];
  const ledgerRow = (n, payload, phase) => {
    const blocks = Array.isArray(payload?.content) ? payload.content : [];
    roundLedger.push({
      n, phase,
      stop: payload?.stop_reason ?? null,
      shape: blocks.map((block) => block?.type).join('+'),
      textChars: blocks.filter((block) => block?.type === 'text')
        .reduce((sum, block) => sum + String(block?.text || '').length, 0),
      toolUse: blocks.filter((block) => block?.type === 'tool_use').length,
      outTokens: payload?.usage?.output_tokens ?? null,
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
    let payload;
    try {
      payload = await callProvider({
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
          tools: FREE_BRAIN_TOOLS,
          stream: false,
        },
      });
    } catch (error) {
      // E5. A round that could not be made is not a turn that cannot answer: the evidence from
      // the rounds that DID run is in the table, and the tools-removed write below can still use
      // it. Recorded by name so telemetry can tell an upstream failure from a clock or a cap.
      failure = `provider_error_tool_phase:${String(error?.status || '')}:${String(error?.message || error)}`;
      ctx.degraded.push(failure);
      break;
    }
    modelCalls += 1;
    ledgerRow(rounds, payload, 'tool');

    // KEPT, NOT DROPPED. This one line is §٢'s repair: prose the model wrote in a round that also
    // called a tool is prose it wrote for the reader, and it is collected here whether the round
    // ends the turn or continues it.
    const roundText = textOf(payload.content);
    if (roundText) written.push(roundText);

    if (payload.stop_reason !== 'tool_use') {
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
  const toolPhaseFailed = failure !== null;
  if (!finished) {
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
      modelCalls += 1;
      ledgerRow(rounds + 1, payload, 'write');
      const writeText = textOf(payload.content);
      if (writeText) written.push(writeText);
    } catch (error) {
      // E6. The last call failed too, so there is no model text at all. The turn does NOT throw:
      // it falls through with an empty proposal, and the reviewer's last rung — an explicit
      // Arabic sentence saying nothing usable arrived — is what the reader receives. A thrown
      // turn here is the empty bubble with extra steps.
      failure = `provider_error_write:${String(error?.status || '')}:${String(error?.message || error)}`;
      ctx.degraded.push(failure);
    }
    // NAME THE REAL CAUSE. `rounds_exhausted` on a turn that ran out of CLOCK sent the reader's
    // telemetry looking at MAX_TOOL_ROUNDS, which was not what stopped it — and the merge round
    // found two more turns wearing the same wrong label: a round whose provider call FAILED (E5),
    // and a round that stopped normally but emitted no text block (E4, the FREE_BRAIN_EMPTY
    // shape). Four causes reach this write and each is now called by its own name.
    ctx.degraded.push(
      deadlineHit ? 'deadline_write'
        : toolPhaseFailed ? 'write_after_tool_phase_failure'
          : rounds >= MAX_TOOL_ROUNDS ? 'rounds_exhausted'
            : 'write_after_empty_first_answer',
    );
  }

  // Emitted from HERE and not from api/ask.js, which is outside this round's ownership. One line,
  // one JSON array, so the platform log can be read without a parser.
  console.log('[free-brain/round-ledger]', JSON.stringify(roundLedger));

  // ── COLLECT EVERYTHING, DELIVER WHAT IS AN ANSWER (§٢) ─────────────────────
  // The join is untouched: `written` still holds every round's prose in order, and the lost-text
  // repair still stands. The filter is applied HERE, at the delivery boundary, and nowhere near
  // the collection — so a round's prose is dropped for what it SAYS and never for where it was
  // written. `collected` is kept beside it because the telemetry below reports the difference:
  // a filter nobody can see the size of is a filter nobody can check.
  const collected = joinRoundTexts(written);
  let answer = deliverableText(collected);
  if (answer.length !== collected.length) {
    ctx.degraded.push(`tool_announcement_dropped:${collected.length - answer.length}`);
  }

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
  let citationRetries = 0;
  if (citationRetries < MAX_CITATION_RETRIES
    && domain !== 'general'
    && answer.trim() !== ''
    && citedRefs.length === 0
    && table.rows.length > 0) {
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
      ledgerRow(rounds + 2, payload, 'cite-retry');
      const retryAnswer = deliverableText(joinRoundTexts([textOf(payload.content)]));
      const retryRefs = collectCited(retryAnswer);
      if (retryRefs.length) {
        answer = retryAnswer;
        citedRefs = retryRefs;
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
  });

  // ── AND NOW THE CARDS, FROM THE TEXT THAT IS ACTUALLY BEING HANDED OVER ────
  // Order is the DELIVERED order, not the proposal's: `api/ask.js` caps the list at MAX_SOURCES,
  // and the cards the reader's own prose reaches first are the ones that survive that cap.
  // The `||` keeps E7's invariant intact: the reviewer guarantees a non-empty string, and removing
  // reference numbers from it must not be the one thing that reintroduces the empty bubble.
  const deliveredText = dropOrphanRefNumbers(reviewed.text) || reviewed.text;
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

  return {
    text: deliveredText,
    verdict: reviewed.verdict,
    annotations: reviewed.annotations,
    cited,
    evidence: table.rows,
    domain,
    // §١ — returned so the platform log can report what was sent to the reviewer. A signal that
    // only the reviewer ever sees is a signal nobody can check after the fact.
    khilafFromOpinions: khilaf.khilafFromOpinions,
    opinionCount: khilaf.opinionCount,
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

export function reviewerEvidence(row) {
  const corpusId = row.scholarId && row.recordId ? `${row.scholarId}:${row.recordId}` : '';
  return {
    id: corpusId || row.url || `ref-${row.ref}`,
    title: row.title || '',
    url: row.url || '',
    scholar: row.publisher || '',
    snippet: row.text || '',
    date: row.retrievedAt || '',
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
