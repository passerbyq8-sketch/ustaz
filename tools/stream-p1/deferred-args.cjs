#!/usr/bin/env node
/**
 * STREAM-P5 §٣/٦ — CAN THE THREE END-OF-ANSWER ARGUMENTS REACH A RELEASED UNIT?
 *
 * `createReviewStream` takes `khilafFromOpinions`, `opinionCount` and `truncated` at
 * CONSTRUCTION, and on the free-brain path not one of them is knowable then:
 *
 *   khilafFromOpinions = khilafSignal(proposedRows)   lib/free-brain/loop.js:1410
 *   opinionCount       = the same call                lib/free-brain/loop.js:1410
 *   truncated          = truncatedFrom(deliveredStop) lib/free-brain/loop.js:1414
 *
 * The directive's rule is that what depends on them is DEFERRED to the close and never
 * guessed at construction — and that if any of them touches the TEXT OF A RELEASED UNIT,
 * the work stops and is written up instead.
 *
 * So this asks exactly that question and nothing wider. Every answer is streamed under
 * every combination of the three, and the SEQUENCE OF RELEASED UNIT TEXTS is compared
 * against the all-unknown construction (`null, null, null`) — which is what a stream built
 * before the first character can honestly claim to know.
 *
 * A DIFFERENCE IN THE FINAL TEXT IS NOT A FAILURE HERE and is reported separately: the
 * answer footer and the disagreement tail are answer-level by design, they are appended at
 * the close, and the close is exactly where the real values are available. What may not
 * differ is a unit that has ALREADY LEFT.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const url = require('url');

const SRC = path.join(__dirname, '..', '..', 'lib', 'sentence-stream.js');

const CHUNKERS = {
  words: (t) => t.match(/\S+\s*/gu) || [],
  chars: (t) => [...t],
};

/** The construction a stream can honestly make before the first character. */
const UNKNOWN = { khilafFromOpinions: null, opinionCount: null, truncated: null };

/** Every combination the close might turn out to hold. */
const VARIANTS = [];
for (const khilafFromOpinions of [null, false, true]) {
  for (const opinionCount of [null, 0, 2, 5]) {
    for (const truncated of [null, false, true]) {
      VARIANTS.push({ khilafFromOpinions, opinionCount, truncated });
    }
  }
}

const label = (v) => `khilaf=${v.khilafFromOpinions} opinions=${v.opinionCount} truncated=${v.truncated}`;

function release(createSentenceStream, text, domain, pages, chunk, args) {
  const stream = createSentenceStream({
    evidence: [], domain, mode: 'standard', sources: pages, ...args,
  });
  const early = [];
  for (const piece of chunk(text)) early.push(...stream.push(piece));
  const closed = stream.end();
  return { early, finalText: closed.text };
}

async function main() {
  const corpusPath = process.argv[2];
  if (!corpusPath) {
    console.error('usage: deferred-args.cjs <corpus.json>');
    process.exit(2);
  }
  const { createSentenceStream } = await import(url.pathToFileURL(SRC).href);
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));

  let comparisons = 0;
  let releasedDiffs = 0;
  let finalDiffs = 0;
  const samples = [];
  const finalSamples = new Set();

  for (const record of corpus) {
    for (const domain of ['fiqh', 'general', 'mixed']) {
      for (const pages of [[], ['صحيح البخاري وصحيح مسلم']]) {
        for (const [chunkName, chunk] of Object.entries(CHUNKERS)) {
          const base = release(createSentenceStream, record.text, domain, pages, chunk, UNKNOWN);
          for (const variant of VARIANTS) {
            comparisons += 1;
            const got = release(createSentenceStream, record.text, domain, pages, chunk, variant);
            const sameEarly = got.early.length === base.early.length
              && got.early.every((u, i) => u === base.early[i]);
            if (!sameEarly) {
              releasedDiffs += 1;
              if (samples.length < 8) {
                samples.push({
                  id: record.id, domain, chunker: chunkName, variant: label(variant),
                  baseUnits: base.early.length, gotUnits: got.early.length,
                });
              }
            }
            if (got.finalText !== base.finalText) {
              finalDiffs += 1;
              finalSamples.add(label(variant));
            }
          }
        }
      }
    }
  }

  console.log('');
  console.log(`DEFERRED-ARGUMENT PROBE   ${corpus.length} answers x 3 domains x 2 page settings x 2 chunkings x ${VARIANTS.length} variants`);
  console.log(`  comparisons                                   ${String(comparisons).padStart(8)}`);
  console.log(`  RELEASED unit text differs from the unknown   ${String(releasedDiffs).padStart(8)}   <- must be 0`);
  console.log(`  final text differs (expected, answer-level)   ${String(finalDiffs).padStart(8)}`);
  console.log(`  variants that move the final text             ${String(finalSamples.size).padStart(8)} of ${VARIANTS.length}`);
  for (const s of samples) {
    console.log(`    ${s.id} ${s.domain}/${s.chunker} ${s.variant}: ${s.baseUnits} -> ${s.gotUnits} units`);
  }
  console.log('');
  if (releasedDiffs === 0) {
    console.log('VERDICT   the three are ANSWER-LEVEL ONLY. Nothing they decide reaches a unit that has');
    console.log('          already left, so a stream may be built on the unknown and the close may');
    console.log('          carry the real values. Section 3 may proceed on this point.');
  } else {
    console.log('VERDICT   STOP. One of the three reaches the text of a released unit.');
  }
  process.exit(releasedDiffs === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
