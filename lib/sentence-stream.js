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
// ── AND THE END RECONCILES AGAINST THE REAL THING, IT DOES NOT ASSUME ────────
// `end()` computes the shipped text the ordinary way — the whole-text reviewer's
// output through the whole-text lock — and then CHECKS that what was already sent is
// a prefix of it. If it is not, nothing is quietly patched: a violation is recorded
// and the caller is expected to refuse to stream. The final bytes are the whole-text
// path's bytes, always, so §٥/٣ holds by construction rather than by hope.

import { createReviewStream, reviewAnswer } from './output-reviewer.js';
import { lockTakhrij } from './takhrij-lock.js';

// The rebuild's tidy pass, mirrored from lib/takhrij-lock.js:230-236 so a unit can be
// asked whether that pass would touch it. It is asked, never applied: this module does
// not tidy anything, it only declines to stream what tidying could still move.
export function tidyWouldChange(value) {
  const s = String(value == null ? '' : value);
  const out = s
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([؟,.])/g, '$1')
    .replace(/([؟,])\s*([.؟!])/g, '$2')
    .replace(/([؟,])\s*$/gm, '.')
    .replace(/\s*\n\s*/g, '\n')
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
 */
export function createSentenceStream({
  evidence, domain, mode, khilafFromOpinions, opinionCount, truncated, sources,
} = {}) {
  const inner = createReviewStream({
    evidence, domain, mode, khilafFromOpinions, opinionCount, truncated,
  });
  const pages = Array.isArray(sources) ? sources : [];

  const emitted = [];
  const violations = [];
  let buffer = '';
  let streaming = true;
  let held = 0;
  let closed = false;

  /** One reviewed unit in; the chunks the wire may have now, which may be none. */
  const offer = (unit) => {
    if (!streaming) { held += 1; return []; }
    const locked = lockTakhrij(unit, pages);
    if (locked.droppedSentences.length || locked.text !== unit || tidyWouldChange(unit)) {
      // The lock took something out, or the tidy pass could still move this text.
      // Either way it is not safe to send, and neither is anything after it.
      streaming = false;
      held += 1;
      return [];
    }
    emitted.push(unit);
    return [unit];
  };

  return {
    push(chunk) {
      if (closed) throw new Error('createSentenceStream: push after end');
      buffer += String(chunk ?? '');
      const out = [];
      for (const unit of inner.push(chunk)) out.push(...offer(unit));
      return out;
    },

    end() {
      if (closed) throw new Error('createSentenceStream: end called twice');
      closed = true;
      const innerEnd = inner.end();
      // The inner stream always holds its last unit until now. Whatever it releases
      // here still goes through the same test, and whatever passes must be HANDED BACK
      // as well as counted — counting it as sent while never returning it would drop a
      // sentence out of the answer.
      const late = [];
      for (const unit of innerEnd.tail) late.push(...offer(unit));
      // The answer-level notices are global by definition and are never streamed early.
      held += innerEnd.notices.length;

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
