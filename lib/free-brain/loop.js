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
import { OPEN_WEB_CAUTION, ROUND_TEXT_REMINDER } from './instructions.js';

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

  const answer = joinRoundTexts(written);

  // ── THE CARD FOLLOWS THE CITATION (§٣) ─────────────────────────────────────
  const citedRefs = collectCited(answer);
  const cited = citedRefs.map((ref) => table.byRef(ref)).filter(Boolean);
  const readerText = stripCitations(answer);
  const domain = domainOf(ctx.spend, lexicalRoute);

  // ── THE ONE CALL TO BRANCH ب (§٧) ──────────────────────────────────────────
  const reviewed = await reviewAnswer({
    text: readerText,
    evidence: cited.map(reviewerEvidence),
    domain,
    mode,
  });

  return {
    text: reviewed.text,
    verdict: reviewed.verdict,
    annotations: reviewed.annotations,
    cited,
    evidence: table.rows,
    domain,
    rounds,
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
