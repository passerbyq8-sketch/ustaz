#!/usr/bin/env node
/**
 * STREAM-P4 §٢ — WHY `earlyRelease` HAS NOWHERE TO LAND YET, MEASURED.
 *
 * §٢ ordered `earlyRelease` passed from the delivery path to the writer, behind
 * STREAM_V1, and it ordered something else in the same breath: «do not move the review
 * stage to a place that changes what it sees — if the wiring requires a move that
 * changes the ORDER of what the reviewer owns, STOP AND WRITE.»
 *
 * It does require exactly that, and this file is the stop, written as a measurement so
 * the next session can re-run it instead of re-reading an argument.
 *
 * ── THE SHAPE OF api/ask.js, AS IT IS ────────────────────────────────────────
 * There are three delivery shapes, and the reviewer is on the one that cannot stream.
 *
 *   emitOnce()          api/ask.js:994. ONE content_block_delta carrying the whole
 *                       sealed answer, then message_stop. No message_start and no
 *                       content_block_start. Twelve exits use it, INCLUDING the
 *                       free-brain path (api/ask.js:1396).
 *   the GEN relay       api/ask.js:2816-2848. Real upstream lifecycle, piped through.
 *   the round-2 relay   api/ask.js:3519-3560. Real upstream lifecycle, piped through.
 *
 * And `reviewAnswer` — the reviewer this whole phase is built around — is called in
 * exactly one place: lib/free-brain/loop.js:1417, on the COMPLETE answer, on the
 * free-brain path. So the only path that has a reviewer delivers through emitOnce, and
 * the only paths that can stream have no reviewer at all.
 *
 * ── PROBE A: THE PASS THAT RUNS AFTER THE REVIEWER ───────────────────────────
 * `dropOrphanRefNumbers` (lib/free-brain/loop.js:195) runs on `reviewed.text`, over the
 * WHOLE answer, AFTER the review (loop.js:1435). It deletes the model's own `[1]`-style
 * reference numbers and then folds inner runs and pulls spaces off punctuation across
 * everything. That is the same hazard STREAM-P3 met in the takhrij rebuild's tidy pass
 * and answered with `tidyWouldChange` — except this pass lives downstream of the
 * reviewer, in a different file, and `createSentenceStream` does not mirror it and
 * cannot see it. A unit it released is therefore still editable after release.
 *
 * THE RECORDED ARCHIVE CANNOT SHOW THIS, and saying so is the point. Those 160 answers
 * are the DELIVERED text — they have already been through this pass in production — so
 * it is idempotent on them by construction. Measured over the corpus it edits 0 of 2506
 * released units, and that zero is an artefact of where the corpus was captured, not a
 * safety property. The witness below is built instead.
 *
 * ── PROBE B: WHAT emitOnce EARNS ─────────────────────────────────────────────
 * The writer's `trackEarlyLifecycle` wants message_start, then content_block_start, then
 * deltas. emitOnce opens with a delta, so eligibility ends on the first frame and
 * `earlyRelease` is never consulted. Passing it on that path today is a literal no-op.
 *
 * ── AND THREE ARGUMENTS THAT ARE NOT KNOWABLE UNTIL THE END ──────────────────
 * `createReviewStream` takes `evidence`, `khilafFromOpinions`, `opinionCount` and
 * `truncated` at CONSTRUCTION. On the free-brain path:
 *   evidence           = the rows the COMPLETE answer cited (loop.js:1404)
 *   khilafFromOpinions = khilafSignal(those rows)          (loop.js:1410)
 *   opinionCount       = the same
 *   truncated          = truncatedFrom(deliveredStop)      (loop.js:1414)
 * Not one is knowable when the first sentence is judged. `evidence` becoming a growing
 * set is the case STREAM-P4 §١ now gates. The other three are answer-level only, but
 * they are constructor arguments, so a stream must be built on a guess and the guess
 * lands in `verdict.khilafTrigger` and `verdict.answerFooterSuppressedReason`.
 */
'use strict';

const path = require('path');
const url = require('url');

const LIB = path.join(__dirname, '..', '..', 'lib');
const href = (...p) => url.pathToFileURL(path.join(LIB, ...p)).href;

async function main() {
  const { createSentenceStream } = await import(href('sentence-stream.js'));
  const { dropOrphanRefNumbers } = await import(href('free-brain', 'loop.js'));
  const { createFinalizedSseResponse } = await import(href('finalized-sse-writer.js'));

  let blockers = 0;

  // ── PROBE A ──
  console.log('PROBE A — does a pass downstream of the reviewer edit a RELEASED unit?');
  const answer = [
    'زكاة الفطر واجبة على كل مسلم [1].',
    'ومقدارها صاع من غالب قوت البلد.',
    'وتخرج قبل صلاة العيد.',
  ].join('\n');
  const stream = createSentenceStream({ evidence: [], domain: 'fiqh', mode: 'standard', sources: [] });
  const pushed = [];
  for (const piece of (answer.match(/\S+\s*/gu) || [])) pushed.push(...stream.push(piece));
  const ended = stream.end();
  const released = pushed.concat(ended.tail.slice(0, Math.max(0, ended.streamedUnits - pushed.length)));
  const sent = released.join('\n');
  const delivered = dropOrphanRefNumbers(ended.text) || ended.text;
  const firstMoved = dropOrphanRefNumbers(released[0]) !== released[0];
  const prefixHolds = delivered.startsWith(sent);
  console.log('  units released by the sentence stream : ' + released.length);
  console.log('  unit 1 as RELEASED                    : ' + JSON.stringify(released[0]));
  console.log('  unit 1 after dropOrphanRefNumbers     : ' + JSON.stringify(dropOrphanRefNumbers(released[0])));
  console.log('  the released text is still a prefix   : ' + prefixHolds);
  if (firstMoved && !prefixHolds) {
    blockers += 1;
    console.log('  => BLOCKER. A sentence that went out is not in the answer that ships.');
  } else {
    console.log('  => no blocker seen on this witness.');
  }

  // ── PROBE B ──
  console.log('\nPROBE B — can the emitOnce frame shape earn early release?');
  const written = [];
  const target = {
    write: (chunk) => { written.push(String(chunk)); return true; },
    once() {}, removeListener() {}, end() {},
  };
  let consulted = 0;
  const res = createFinalizedSseResponse(target, {
    finalize: (input) => ({ ok: true, text: input.text }),
    context: {},
    earlyRelease: ({ wireText }) => { consulted += 1; return wireText; },
  });
  res.write('data: ' + JSON.stringify({
    type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'كل الجواب دفعة واحدة.' },
  }) + '\n\n');
  res.write('data: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n');
  res.end();
  console.log('  earlyRelease consulted : ' + consulted + ' time(s)');
  if (consulted === 0) {
    blockers += 1;
    console.log('  => BLOCKER. On the one path that has a reviewer, passing earlyRelease is a no-op');
    console.log('     until emitOnce is replaced by a real lifecycle emitter.');
  } else {
    console.log('  => no blocker seen.');
  }

  console.log('\nBLOCKERS ' + blockers + ' — §٢ stops here and is written up rather than wired.');
  // This file REPORTS a stop; it is not a gate that fails the build. Exit 0 on either
  // outcome, and let the number above be the finding.
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
