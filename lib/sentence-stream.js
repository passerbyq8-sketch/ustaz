// lib/sentence-stream.js — THE REVIEWER AND THE TAKHRIJ LOCK, ON THE SENTENCE.
//
// ── WHAT WAS MEASURED BEFORE THIS FILE EXISTED ───────────────────────────────
// `lockTakhrij` splits in two, and only one half is local.
//
// ITS DROP DECISION IS LOCAL. It loops its OWN sentences and judges each from that
// sentence plus the haystack of fetched pages, and the haystack is in hand before the
// first character (retrieval precedes generation). Measured over 160 recorded answers
// in three domains: judging unit by unit and joining the survivors reproduced the
// whole-text result byte for byte in 474 of 480 answers.
//
// ITS REBUILD IS NOT LOCAL, and the six that failed say exactly why. After any cut,
// lib/takhrij-lock.js:230-236 runs a tidy pass over the WHOLE rebuilt text, and
// lib/takhrij-lock.js:217 makes that pass conditional on a cut occurring ANYWHERE.
// So a cut late in an answer retroactively edits text early in it. The witness is
// `battery2:Q18/ARCHIVED-CLOSED/production-1`: a dropped sentence in unit 5 makes
// line 232's `\s+([؟,.])` rewrite unit 3 from «… ما بكم .»» to «… ما بكم.»» — one
// byte, in a sentence a stream would already have sent. That is a sentence emitted
// and then replaced, which §٥/١ forbids outright.
//
// ── SO WHAT IS STREAMED IS WHAT THAT PASS CANNOT REACH ───────────────────────
// A unit is handed to the wire only when both hold:
//   1. the lock took nothing out of it, and
//   2. the tidy pass would not change it — `tidy(u) === u`.
// A unit failing either test ends the streamed prefix. Order is never disturbed, so
// everything after the first held unit is held too and arrives at `end()` with the
// answer-level material. What streams is therefore text no later cut can rewrite.
//
// ── AND A THIRD CONDITION: THE ATTRIBUTION VERDICT MUST BE SETTLED (§١/ب) ────
// The reviewer judges a sentence's attribution against the rows the answer has cited SO
// FAR, and that set grows as the answer is written. Every one of its evidence tests is
// monotone, so a MATCHED attribution is decided for good, while an UNMATCHED one is not
// decided at all — the next row may support it. Streaming an unmatched attribution would
// therefore mean sending a sentence whose name could still be stripped, which is §٥/١
// with the attribution door attached to it, the most dangerous door in the app.
//
// So the unit waits. `createReviewStream` reports settledness from the decision site
// itself rather than letting this file infer it from the emitted text: an inference from
// output would be a fingerprint, and attribution is not decided by fingerprints here.
//
// WHAT THIS COSTS was measured before it was adopted, on the same 160 answers and the
// same seven chunkings — see tools/stream-p1/hold-until-stable.cjs and §٢ of the
// STREAM-P3 report. It changes no byte of any answer; it moves only WHEN bytes leave.
//
// ── AND THE END RECONCILES AGAINST THE REAL THING, IT DOES NOT ASSUME ────────
// `end()` computes the shipped text the ordinary way — the whole-text reviewer's
// output through the whole-text lock — and then CHECKS that what was already sent is
// a prefix of it. If it is not, nothing is quietly patched: a violation is recorded
// and the caller is expected to refuse to stream. The final bytes are the whole-text
// path's bytes, always, so §٥/٣ holds by construction rather than by hope.

import { createReviewStream, reviewAnswer } from './output-reviewer.js';
import { lockTakhrij } from './takhrij-lock.js';
import { COLON_RE } from './colon-preamble.js';

// The rebuild's tidy pass, mirrored from lib/takhrij-lock.js:666-671 so a unit can be
// asked whether that pass would touch it. It is asked, never applied: this module does
// not tidy anything, it only declines to stream what tidying could still move.
//
// THE MARKS ARE THE COMMA AND THE SEMICOLON (U+060C, U+061B), NOT THE QUESTION MARK. This
// mirror was written with U+061F in their place, so every unit ending in «؟» was held as
// though the lock would rewrite it, and nothing after it streamed. MEASURED LIVE on 18
// September 2026: two of thirteen production answers stopped there, one before its first
// character (60 s of silence, then the whole answer). The lock never touches «؟».
// tools/stream-p1/replay-stream-stop.cjs names the stop rule on a recorded answer.
export function tidyWouldChange(value) {
  const s = String(value == null ? '' : value);
  const out = s
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([،؛,.])/g, '$1')
    .replace(/([،؛,])\s*([.؟!])/g, '$2')
    .replace(/([،؛,])\s*$/gm, '.')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
  return out !== s;
}

// ── AND A FOURTH CONDITION: THE REFERENCE-NUMBER PASS MUST NOT REACH IT (P5) ─
//
// `dropOrphanRefNumbers` (lib/free-brain/loop.js:195) is called at loop.js:1435 on the
// WHOLE reviewed text, AFTER the reviewer has finished. It deletes every `[1]`, `[2][4]`
// style group the model invented — there is no numbered reference list in this app, so
// none of them can ever be honoured — and then folds the whitespace the deletion left
// behind. A unit already on the wire carrying such a number would therefore be edited
// after the reader had read it: a unit emitted and then replaced, which is the same
// defect `tidyWouldChange` closes one stage earlier and which §٥/١ forbids outright.
//
// NOTE WHAT THIS PASS IS NOT. It does not consult the evidence and it does not wait for
// a card: every match is removed unconditionally. So there is no later arrival that can
// make one of these numbers safe, and a unit carrying one is held for good rather than
// held until settled. That asymmetry is the reason this is a separate test with its own
// counter instead of another clause inside the attribution one.
//
// MIRRORED, NOT IMPORTED, AND THAT IS A DELIBERATE TRADE. `dropOrphanRefNumbers` is
// exported and could be called directly, but it lives in the free-brain loop, whose
// module graph pulls the whole tool layer in behind it; this file sits on the delivery
// path and must not drag that cost onto every route that streams. The drift that
// mirroring risks is closed by measurement instead of by hope: the gate runs BOTH this
// predicate and the real `dropOrphanRefNumbers` over the corpus and fails if they ever
// disagree on a single unit. Asked, never applied — this module tidies nothing.
const ORPHAN_REF_RE = /\[\s*[0-9٠-٩]+(?:\s*[,،andو-]\s*[0-9٠-٩]+)*\s*\]/gu;
const INNER_RUN_RE = /^([ \t]*)([^\n]*)$/gmu;
const foldInnerRun = (whole, lead, rest) => lead + rest.replace(/[ \t]{2,}/gu, ' ');
export function refDropWouldChange(value) {
  const s = String(value == null ? '' : value);
  const out = s
    .split(/(```[\s\S]*?```|`[^`\n]*`)/u)
    .map((chunk, index) => (index % 2 === 1 ? chunk : chunk.replace(ORPHAN_REF_RE, '')))
    .join('')
    .replace(/[ \t]+([.،؟!:؛])/gu, '$1')
    .replace(INNER_RUN_RE, foldInnerRun)
    .replace(/[ \t]+\n/gu, '\n')
    .trim();
  return out !== s;
}

/**
 * Review and lock one answer as it is written, sentence by sentence.
 *
 * @param {{evidence?: Array<object>, domain: 'fiqh'|'general'|'mixed', mode?: string,
 *   khilafFromOpinions?: boolean|null, opinionCount?: number|null,
 *   truncated?: boolean|null, sources?: Array<object|string>}} input
 *   `sources` are the fetched pages the takhrij lock checks against — the same list
 *   api/ask.js hands `seal`, and known before the first character.
 *   `holdUnsettled` is route (ب) and defaults ON. It exists as a parameter so the
 *   measurement can run both arms against the SAME code in one process instead of
 *   comparing two commits' numbers; nothing on the delivery path passes it.
 */
export function createSentenceStream({
  evidence, domain, mode, khilafFromOpinions, opinionCount, truncated, sources,
  holdUnsettled = true, holdRefDrop = true, holdLeadIn = true,
} = {}) {
  // Settledness arrives beside the chunks, one record per reviewed unit, in order.
  const pending = [];
  const inner = createReviewStream({
    evidence, domain, mode, khilafFromOpinions, opinionCount, truncated,
    onUnit: (record) => { pending.push(record); },
  });
  const pages = Array.isArray(sources) ? sources : [];

  const emitted = [];
  const violations = [];
  let buffer = '';
  let streaming = true;
  let held = 0;
  let closed = false;
  let unsettledHolds = 0;
  let refHolds = 0;

  /** One reviewed unit judged alone: `[unit]` when it may go, `[]` when streaming stops. */
  const admit = (unit, settled) => {
    if (!streaming) { held += 1; return []; }
    if (holdUnsettled && settled === false) {
      // §١/ب. The attribution in this unit is not decided yet, so neither is the unit.
      streaming = false;
      held += 1;
      unsettledHolds += 1;
      return [];
    }
    if (holdRefDrop && refDropWouldChange(unit)) {
      // P5. The reference-number pass at loop.js:1435 would still edit this unit, and it
      // runs after the reviewer on the whole text. Nothing arriving later can make the
      // number safe, so this unit and everything after it travel with the answer.
      streaming = false;
      held += 1;
      refHolds += 1;
      return [];
    }
    const locked = lockTakhrij(unit, pages);
    if (locked.droppedSentences.length || locked.text !== unit || tidyWouldChange(unit)) {
      // The lock took something out, or the tidy pass could still move this text.
      // Either way it is not safe to send, and neither is anything after it.
      streaming = false;
      held += 1;
      return [];
    }
    return [unit];
  };

  // ── AND A FIFTH CONDITION: A LEAD-IN WAITS FOR WHAT IT LEADS INTO ─────────
  //
  // MEASURED BY THE OWNER, 18 September 2026, on «هل تجب الزكاة في مال الصبي الصغير؟»: a line
  // promising a prophetic text and ending in a colon went out, the text never came, the answer
  // jumped to the book cards and the «فهمٌ لا فتوى» footer was gone.
  //
  // THE MECHANISM, REPRODUCED BY tools/stream-p1/orphan-leadin-witness.cjs. The colon line is a
  // unit that passes every test above, so it left as soon as the card after it began. The card
  // carried a takhrij and the per-unit lock refused it, so streaming stopped. At the end
  // api/ask.js seals the text against the pages the turn cited; the card's takhrij was on none
  // of them, so the seal dropped the card AND — by `orphanedLeadInCuts`, lib/takhrij-lock.js —
  // the colon line that introduced it. What was sent was then no longer a prefix of what
  // shipped, and `finish()` there closes the message on the bytes already sent: the rest of
  // the answer, footer included, never reaches the reader, and the lead-in stands alone.
  //
  // So a colon line is one more thing a later cut can reach, and it waits exactly as long as
  // that cut can reach it: until the unit after it has passed. If that unit passes, both go
  // out together; if it does not, streaming stops BEFORE the lead-in, and the lead-in travels
  // with the card at the end — kept with it or dropped with it by the seal. The colon test is
  // the detector the lock itself asks (`COLON_RE`, lib/colon-preamble.js). A colon line
  // followed by another colon line is already orphaned as written, the seal leaves it, and it
  // goes out when the second one is judged.
  let leadIn = null;
  let leadInHolds = 0;
  /** One reviewed unit in; the chunks the wire may have now, which may be none. */
  const offer = (unit, settled) => {
    const admitted = admit(unit, settled);
    if (!admitted.length) {
      if (leadIn !== null) { held += 1; leadInHolds += 1; leadIn = null; }
      return [];
    }
    const out = leadIn === null ? [] : [leadIn];
    leadIn = null;
    if (holdLeadIn && COLON_RE.test(unit.trim())) leadIn = unit;
    else out.push(unit);
    emitted.push(...out);
    return out;
  };

  /**
   * Offer every unit the reviewer just produced, each with its own settledness.
   * `chunks` is what the reviewer returned; the records must partition it exactly, and
   * that is checked rather than assumed — a silent drift here would hand the wire a
   * chunk under the wrong unit's verdict.
   */
  const drain = (chunks) => {
    const records = pending.splice(0, pending.length);
    const flat = records.flatMap((record) => record.produced);
    if (flat.length !== chunks.length || flat.some((text, i) => text !== chunks[i])) {
      violations.push({ kind: 'unit-records-do-not-match-chunks', records: flat.length, chunks: chunks.length });
      // Fall back to the safe reading: nothing goes early.
      streaming = false;
      held += chunks.length;
      return [];
    }
    const out = [];
    for (const record of records) {
      for (const text of record.produced) out.push(...offer(text, record.settled));
    }
    return out;
  };

  return {
    push(chunk) {
      if (closed) throw new Error('createSentenceStream: push after end');
      buffer += String(chunk ?? '');
      return drain(inner.push(chunk));
    },

    end() {
      if (closed) throw new Error('createSentenceStream: end called twice');
      closed = true;
      const innerEnd = inner.end();
      // The inner stream always holds its last unit until now. Whatever it releases
      // here still goes through the same test, and whatever passes must be HANDED BACK
      // as well as counted — counting it as sent while never returning it would drop a
      // sentence out of the answer.
      const late = drain(innerEnd.tail);
      // The answer-level notices are global by definition and are never streamed early.
      held += innerEnd.notices.length;
      // A lead-in still waiting when the answer ended was never sent; it ships in the remainder.
      if (leadIn !== null) { held += 1; leadInHolds += 1; leadIn = null; }

      // THE SHIPPED TEXT, computed exactly as the unstreamed path computes it.
      const locked = lockTakhrij(innerEnd.text, pages);
      const finalText = locked.text;

      const sent = emitted.join('\n');
      if (sent && !finalText.startsWith(sent)) {
        // §٥/١. Something already on the wire is not a prefix of what ships. Nothing
        // is rewritten to hide it; the caller must not stream.
        violations.push({
          kind: 'emitted-not-a-prefix',
          emittedBytes: sent.length,
          finalBytes: finalText.length,
        });
      }
      violations.push(...innerEnd.violations);

      const remainder = sent && finalText.startsWith(sent)
        ? finalText.slice(sent.length).replace(/^\n/, '')
        : finalText;

      return {
        tail: remainder ? [...late, remainder] : [...late],
        text: finalText,
        reviewedText: innerEnd.text,
        annotations: innerEnd.annotations,
        verdict: innerEnd.verdict,
        takhrij: {
          outcome: locked.outcome,
          removed: locked.removed,
          droppedSentences: locked.droppedSentences,
          degraded: locked.degraded,
        },
        streamedUnits: emitted.length,
        heldUnits: held,
        unsettledHolds,
        refHolds,
        leadInHolds,
        violations,
      };
    },
  };
}

/** The unstreamed path, for the equivalence proof to compare against. */
export function reviewAndLock(input = {}) {
  const reviewed = reviewAnswer(input);
  const locked = lockTakhrij(reviewed.text, Array.isArray(input.sources) ? input.sources : []);
  return { text: locked.text, reviewedText: reviewed.text, verdict: reviewed.verdict, locked };
}
