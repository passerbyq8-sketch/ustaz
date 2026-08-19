#!/usr/bin/env node
/**
 * STREAM-P1 §٦ — what the reviewer stage costs, before and after.
 *
 * BEFORE  the whole answer must be reviewed before one character may be released,
 *         so the reviewer's own contribution to «time to first character» is its
 *         entire running time.
 * AFTER   the first reviewed sentence is released as soon as it is complete, so the
 *         contribution is the time to the FIRST chunk `push` returns.
 *
 * The stream also costs more in total than the one-shot reviewer, because it re-runs
 * the reviewer's own splitters over the whole buffer on every push rather than
 * keeping a second, drifting copy of them. That price is measured here too instead
 * of being left as an implementation detail nobody priced.
 *
 * Medians over repeated runs: single readings on this machine are noise.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const url = require('url');

const SRC = path.join(__dirname, '..', '..', 'lib', 'output-reviewer.js');
const REPEATS = 7;

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const ms = (t) => Number(t) / 1e6;

async function main() {
  const corpusPath = process.argv[2];
  const only = process.argv[3] || 'NEW';
  if (!corpusPath) {
    console.error('usage: stage-timing.cjs <corpus.json> [run-filter]');
    process.exit(2);
  }
  const { reviewAnswer, createReviewStream } = await import(url.pathToFileURL(SRC).href);
  const all = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  const corpus = all.filter((r) => r.run.includes(only));

  const rows = [];
  for (const record of corpus) {
    const input = {
      text: record.text, evidence: [], domain: 'mixed', mode: 'standard', truncated: false,
    };
    const words = record.text.match(/\S+\s*/gu) || [];

    const whole = [];
    const first = [];
    const total = [];
    for (let r = 0; r < REPEATS; r += 1) {
      let t0 = process.hrtime.bigint();
      reviewAnswer(input);
      whole.push(ms(process.hrtime.bigint() - t0));

      t0 = process.hrtime.bigint();
      const stream = createReviewStream(input);
      let firstAt = null;
      for (const w of words) {
        const out = stream.push(w);
        if (out.length && firstAt === null) firstAt = ms(process.hrtime.bigint() - t0);
      }
      stream.end();
      total.push(ms(process.hrtime.bigint() - t0));
      first.push(firstAt === null ? ms(process.hrtime.bigint() - t0) : firstAt);
    }
    rows.push({
      id: record.id,
      chars: record.text.length,
      words: words.length,
      whole: median(whole),
      first: median(first),
      total: median(total),
    });
  }

  const f = (x) => x.toFixed(2).padStart(8);
  console.log('corpus: ' + corpus.length + ' answers matching run filter "' + only + '"');
  console.log('medians of ' + REPEATS + ' runs each, milliseconds\n');
  console.log('               whole-text   first-sentence   stream-total   first/whole');
  const w = rows.map((r) => r.whole);
  const fi = rows.map((r) => r.first);
  const to = rows.map((r) => r.total);
  console.log('median   ' + f(median(w)) + '     ' + f(median(fi)) + '       ' + f(median(to))
    + '     ' + (median(fi) / median(w)).toFixed(2) + 'x');
  const p = (xs, q) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * q))];
  console.log('p90      ' + f(p(w, 0.9)) + '     ' + f(p(fi, 0.9)) + '       ' + f(p(to, 0.9)));
  console.log('max      ' + f(Math.max(...w)) + '     ' + f(Math.max(...fi)) + '       ' + f(Math.max(...to)));
  console.log('\nslowest five answers by stream-total:');
  for (const r of [...rows].sort((a, b) => b.total - a.total).slice(0, 5)) {
    console.log('  ' + r.id.padEnd(34) + ' chars ' + String(r.chars).padStart(5)
      + '  whole ' + r.whole.toFixed(2) + '  first ' + r.first.toFixed(2)
      + '  total ' + r.total.toFixed(2));
  }
  console.log('\nNOTE. These are the REVIEWER stage only. They are not a reader-visible');
  console.log('first-character time: nothing on the delivery path releases a byte early.');
}

main().catch((e) => { console.error(e); process.exit(1); });
