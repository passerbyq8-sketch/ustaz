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

import { reviewAnswer } from './review.js';
import {
  FREE_BRAIN_TOOLS, MAX_TOOL_ROUNDS, MAX_CALLS_PER_TOOL,
  createEvidenceTable, runTool,
} from './tools.js';
import { OPEN_WEB_CAUTION } from './instructions.js';

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
 *   modelCalls:number, elapsedMs:number
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
  let answer = '';
  let sawOpenWeb = false;

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds += 1;
    const payload = await callProvider({
      providerUrl,
      headers,
      signal,
      body: {
        model,
        max_tokens: maxTokens,
        ...(usePremium && effort ? { output_config: { effort } } : {}),
        system,
        messages: conversation,
        tools: FREE_BRAIN_TOOLS,
        stream: false,
      },
    });
    modelCalls += 1;

    if (payload.stop_reason !== 'tool_use') {
      answer = textOf(payload.content);
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
    // is absent when it is not.
    conversation.push({
      role: 'user',
      content: sawOpenWeb
        ? [...results, { type: 'text', text: OPEN_WEB_CAUTION }]
        : results,
    });
  }

  // THE LOOP RAN OUT, WHICH IS NOT AN ANSWER. One final call with the tools REMOVED, so the model
  // cannot ask for a seventh round and must write from what it has.
  if (!answer) {
    const payload = await callProvider({
      providerUrl,
      headers,
      signal,
      body: {
        model,
        max_tokens: maxTokens,
        ...(usePremium && effort ? { output_config: { effort } } : {}),
        system,
        messages: conversation,
        stream: false,
      },
    });
    modelCalls += 1;
    answer = textOf(payload.content);
    ctx.degraded.push('rounds_exhausted');
  }

  // ── THE CARD FOLLOWS THE CITATION (§٣) ─────────────────────────────────────
  const citedRefs = collectCited(answer);
  const cited = citedRefs.map((ref) => table.byRef(ref)).filter(Boolean);
  const readerText = stripCitations(answer);
  const domain = domainOf(ctx.spend, lexicalRoute);

  // ── THE ONE CALL TO BRANCH ب (§٧) ──────────────────────────────────────────
  const reviewed = await reviewAnswer({
    text: readerText,
    evidence: cited.map((row) => ({
      title: row.title, url: row.url, publisher: row.publisher, kind: row.kind, text: row.text,
    })),
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
    injectionMarkers: ctx.injectionMarkers,
    elapsedMs: Date.now() - startedAt,
  };
}
