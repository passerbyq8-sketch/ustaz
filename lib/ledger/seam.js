// lib/ledger/seam.js
// THE JOIN BETWEEN A REQUEST AND THE ENGINE — extracted so that the handler and the tests run
// THE SAME CODE.
//
// WHY IT IS A MODULE AND NOT TEN LINES INSIDE api/ask.js. When the join lived in the handler,
// nothing could exercise it: the handler needs a rate limiter, a day cap, an API key, a live
// socket and a full req/res pair before it reaches its first interesting line. So the join was
// tested by matching a regular expression against the handler's source, which proves a branch
// was TYPED and proves nothing about what it does. Three defects lived in exactly that gap.
//
// ── THE QUESTION IS THE READER'S OWN WORDS ───────────────────────────────────
// It used to be `plan.attribution.question` — a field of the LEGACY attribution classifier,
// the same classifier that is measured mis-reading the verb «ذهب» in «ذهب إلى المسجد فهل يصح؟»
// as a scholar's name. The VALUE was byte-identical to the raw text on every case checked, and
// that is exactly what made the coupling dangerous rather than harmless: an engine fed from a
// field whose contract is "the question as the attribution gate sees it" will silently inherit
// whatever that gate starts doing to it.
//
// So rawQuestion() reads the last user turn and does four things and no more: check the TYPE,
// join text blocks, strip C0 control characters, collapse whitespace, and cap the length. It
// removes no word, no name and no framing. Arabic — including every hamza seat, ta-marbuta and
// diacritic — passes through untouched.

import { Budget } from './budgets.js';
import { runEngine } from './engine.js';
import { READER } from './assemble.js';

// Long enough for any real question, short enough that the planner prompt stays bounded.
export const MAX_QUESTION_CHARS = 4000;

// C0 controls except tab and newline, DEL, and the Unicode line/paragraph separators.
// Written as \u escapes ON PURPOSE — the same convention lib/retrieve.js uses for its Arabic
// constants: a literal control character in source is invisible in every editor, and the first
// attempt at this line pasted raw control bytes and produced an unparseable regex (and a source
// file git called binary).
//
// Deliberately NOT bidi marks: those are legitimate in Arabic text, and stripping them would be
// editing the reader's words rather than sanitising them.
const CONTROL = new RegExp('[' + [
  '\\u0000-\\u0008', '\\u000B\\u000C', '\\u000E-\\u001F', '\\u007F', '\\u2028\\u2029',
].join('') + ']', 'g');

/**
 * The reader's question, from the last user turn.
 *
 * @returns {{ok:true, question:string, truncated:boolean} | {ok:false, reason:string}}
 */
export function rawQuestion(messages) {
  const list = Array.isArray(messages) ? messages : null;
  if (!list) return { ok: false, reason: 'messages-not-an-array' };

  let raw = null;
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (!m || m.role !== 'user') continue;
    const c = m.content;
    if (typeof c === 'string') { raw = c; break; }
    if (Array.isArray(c)) {
      raw = c.filter((b) => b && b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text).join(' ');
      break;
    }
    // A user turn whose content is neither a string nor an array of blocks is not a question.
    return { ok: false, reason: 'unsupported-content-type' };
  }
  if (raw === null) return { ok: false, reason: 'no-user-turn' };

  const cleaned = String(raw).replace(CONTROL, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return { ok: false, reason: 'empty-question' };

  const truncated = cleaned.length > MAX_QUESTION_CHARS;
  return { ok: true, question: truncated ? cleaned.slice(0, MAX_QUESTION_CHARS) : cleaned, truncated };
}

// ── the wire ─────────────────────────────────────────────────────────────────
// One text delta carrying the answer and its cards, then message_stop, then end. The client's
// parser (index.html) reads exactly this shape, and the cards must be the tail of the reply.
//
// ── WHO STOPS THE KEEPALIVE, AND WHEN ────────────────────────────────────────
// api/ask.js opens an SSE keepalive because round 1 of the shipped path is byte-silent for tens
// of seconds and mobile carriers reset an idle socket at about thirty. The ledger path is silent
// for the same reason and for as long — up to the full 25-second budget — so it needs the
// keepalive for exactly the same reason.
//
// The first version of this seam had the handler call clearKeepAlive() BEFORE runLedgerTurn(),
// which removed the protection precisely for the interval it exists to cover. It is now stopped
// by a callback fired immediately before the FIRST byte this function writes: the socket stays
// warm for the whole of the engine's work, and no keepalive comment can ever interleave with a
// content frame, follow a message_stop, or arrive after end().
function makeWriter(res, beforeFirstOutput) {
  let opened = false;
  const open = () => {
    if (opened) return;
    opened = true;
    if (typeof beforeFirstOutput === 'function') {
      try { beforeFirstOutput(); } catch { /* a failing hook must not cost the reader the answer */ }
    }
  };
  return {
    delta(text) {
      open();
      res.write(`data: ${JSON.stringify({
        type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text },
      })}\n\n`);
    },
    close() {
      open();
      res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
      res.end();
    },
  };
}

/**
 * RUN ONE LEDGER TURN AND WRITE IT TO THE WIRE.
 *
 * The caller has already decided this request takes the ledger path, has already committed the
 * SSE headers, and has already stopped any keepalive. This function owns everything after that
 * and ALWAYS closes the stream exactly once.
 *
 * IT NEVER SIGNALS "FALL BACK TO LEGACY". A ledger request that cannot verify a source answers
 * with its own refusal: re-running the question through an unguarded route would defeat the
 * gate it fell back from, and by this point bytes are already committed to the socket anyway.
 *
 * @param {object} res    a Node response (or any object with write/end)
 * @param {object} opts   messages, band, bandSites, buildSourceTag, search, fetchImpl,
 *                        directReader, now, startedAt, traceId, plannerOverride
 * @returns {Promise<{outcome, text, cards, ledger, budget, cacheHits, cacheMisses}>}
 */
export async function runLedgerTurn(res, opts = {}) {
  const now = typeof opts.now === 'function' ? opts.now : () => Date.now();
  // THE CLOCK STARTS WHERE THE REQUEST DECIDED TO TRY THE LEDGER, not where the engine begins.
  // The switch — including the Upstash read — is inside the deadline, not before it.
  // A caller may supply the budget — the handler does not, but a test that needs a shorter
  // deadline or a partly-spent one does, and sharing the object is what proves the direct path
  // and the searched path draw on ONE ceiling rather than two.
  const budget = opts.budget || new Budget({ now, startedAt: opts.startedAt });
  const wire = makeWriter(res, opts.beforeFirstOutput);

  const parsed = rawQuestion(opts.messages);
  if (!parsed.ok) {
    // No question means no answer, and no religious claim of any kind.
    wire.delta(READER.NO_EVIDENCE_GENERAL);
    wire.close();
    return { outcome: 'SAFE_REJECTION', text: READER.NO_EVIDENCE_GENERAL, cards: [], reason: parsed.reason, budget };
  }

  let out;
  try {
    out = await runEngine(parsed.question, {
      band: opts.band,
      bandSites: opts.bandSites,
      search: opts.search,
      fetchImpl: opts.fetchImpl,
      directReader: opts.directReader,
      plannerOverride: opts.plannerOverride,
      traceId: opts.traceId,
      budget,
      now,
    });
  } catch (e) {
    // An engine that throws is a bug, and the reader gets a line that asserts nothing. The
    // stream is still closed exactly once, and nothing is written after it.
    console.warn('[ledger] engine threw:', e && e.message ? String(e.message).slice(0, 120) : 'unknown');
    wire.delta(READER.NO_EVIDENCE_GENERAL);
    wire.close();
    return { outcome: 'SAFE_REJECTION', text: READER.NO_EVIDENCE_GENERAL, cards: [], threw: true, budget };
  }

  // Cards are built by the CALLER'S builder — api/ask.js owns the grammar the live client
  // parses, and a second copy here is how the two would drift.
  const build = typeof opts.buildSourceTag === 'function' ? opts.buildSourceTag : () => null;
  const tags = (out.cards || [])
    .map((c) => build({ url: c.url, title: c.title }))
    .filter(Boolean)
    .map((c) => c.tag);

  wire.delta(out.text + (tags.length ? '\n' + tags.join('\n') : ''));
  wire.close();
  return { ...out, cardTags: tags };
}
