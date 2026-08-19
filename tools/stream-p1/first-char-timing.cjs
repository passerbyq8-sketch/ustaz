#!/usr/bin/env node
/**
 * STREAM-P2 §٦ — TIME TO FIRST CHARACTER, BEFORE AND AFTER.
 *
 * WHAT IS MEASURED, AND WHAT IS ASSUMED. The archive records, for every answer,
 * the wall time of the provider call and the length of the answer — but not the
 * arrival time of each token, because nothing streamed. So the arrival of the
 * text is modelled at a UNIFORM rate derived from that answer's own recorded
 * `ms` and `chars`. The rate is the assumption; the total and the length are
 * measured, and the position at which the first sentence clears review and the
 * takhrij lock is computed by running the real code, not estimated.
 *
 *   BEFORE  the whole answer must exist before one character may be released,
 *           so time-to-first-character is the recorded call time.
 *   AFTER   the first unit is released once its last character has arrived and
 *           it has cleared the local reviewer and the lock.
 *
 * A uniform rate understates a real stream's early tokens (providers front-load
 * neither evenly nor predictably), so treat AFTER as an estimate of the right
 * order, not a promise of a millisecond.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const url = require('url');

const SRC = path.join(__dirname, '..', '..', 'lib', 'sentence-stream.js');

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const pct = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : 0;
};

async function main() {
  const corpusPath = process.argv[2];
  const runFilter = process.argv[3] || 'NEW';
  if (!corpusPath) {
    console.error('usage: first-char-timing.cjs <corpus.json> [run-filter]');
    process.exit(2);
  }
  const { createSentenceStream } = await import(url.pathToFileURL(SRC).href);
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'))
    .filter((r) => r.run.includes(runFilter))
    .filter((r) => Number(r.meta && r.meta.ms) > 0);

  const rows = [];
  let neverReleasedEarly = 0;

  for (const record of corpus) {
    const totalMs = Number(record.meta.ms);
    const chars = record.text.length;
    const msPerChar = totalMs / Math.max(1, chars);

    // Feed one character at a time and note the index at which the first unit
    // is released. The reviewer and the lock both run for real here.
    const stream = createSentenceStream({
      evidence: [], domain: 'mixed', mode: 'standard', truncated: false, sources: [],
    });
    let releasedAt = null;
    const started = process.hrtime.bigint();
    for (let i = 0; i < record.text.length; i += 1) {
      const out = stream.push(record.text[i]);
      if (out.length && releasedAt === null) releasedAt = i + 1;
    }
    const closed = stream.end();
    const localMs = Number(process.hrtime.bigint() - started) / 1e6;
    if (releasedAt === null) neverReleasedEarly += 1;

    // Arrival of the first released unit's last character, plus the local work
    // done up to that point. The local work is charged in full, which overstates
    // it — only the part before the release actually counts.
    const afterMs = releasedAt === null ? totalMs + localMs : (releasedAt * msPerChar) + localMs;
    rows.push({
      id: record.id,
      chars,
      beforeMs: totalMs,
      afterMs,
      releasedAt,
      units: closed.streamedUnits,
      held: closed.heldUnits,
    });
  }

  const before = rows.map((r) => r.beforeMs);
  const after = rows.map((r) => r.afterMs);
  const ratio = rows.map((r) => r.afterMs / r.beforeMs);

  const f = (x) => x.toFixed(0).padStart(8);
  console.log('answers: ' + rows.length + '  (run filter "' + runFilter + '", recorded ms present)');
  console.log('arrival modelled at each answer\'s own recorded rate (chars / recorded ms)\n');
  console.log('                     before      after     after/before');
  console.log('median        ' + f(median(before)) + ' ms' + f(median(after)) + ' ms      '
    + (median(ratio) * 100).toFixed(1) + '%');
  console.log('p90           ' + f(pct(before, 0.9)) + ' ms' + f(pct(after, 0.9)) + ' ms      '
    + (pct(ratio, 0.9) * 100).toFixed(1) + '%');
  console.log('best          ' + f(Math.min(...before)) + ' ms' + f(Math.min(...after)) + ' ms');
  console.log('worst         ' + f(Math.max(...before)) + ' ms' + f(Math.max(...after)) + ' ms');
  console.log('\nanswers whose first unit was only released at the end: ' + neverReleasedEarly
    + ' / ' + rows.length);
  console.log('median units released early: ' + median(rows.map((r) => r.units))
    + '   median held to the end: ' + median(rows.map((r) => r.held)));
  console.log('\nfastest five to a first character:');
  for (const r of [...rows].sort((a, b) => a.afterMs - b.afterMs).slice(0, 5)) {
    console.log('  ' + r.id.padEnd(30) + ' before ' + r.beforeMs.toFixed(0).padStart(6)
      + ' ms   after ' + r.afterMs.toFixed(0).padStart(6) + ' ms   at char '
      + String(r.releasedAt).padStart(5) + ' / ' + r.chars);
  }
  console.log('\nNOTE. Nothing on the delivery path releases these bytes yet — door H-2 is');
  console.log('not open. This is what the first two doors make POSSIBLE, not what a reader got.');
}

main().catch((e) => { console.error(e); process.exit(1); });
