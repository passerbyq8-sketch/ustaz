#!/usr/bin/env node
/**
 * STREAM-P3 §٢ — THE DECIDING MEASUREMENT: WHAT ROUTE (ب) COSTS.
 *
 * Route (ب) adds a third exit condition to the sentence stream: a unit leaves only if
 * its ATTRIBUTION VERDICT is settled by the evidence in hand, meaning no row arriving
 * later could change it. Every evidence test in the reviewer is a `find`/`some` over a
 * list that only grows, so the test is monotone: a MATCHED attribution is decided for
 * good, an UNMATCHED one is not decided at all.
 *
 * ── WHAT THIS CORPUS CAN AND CANNOT SAY ─────────────────────────────────────────────
 * The 160 recorded answers are READER TEXT: `stripCitations` has already run, so there
 * is not one `[[n]]` marker among them, and the evidence rows they rested on were never
 * recorded. So «the evidence in hand» is EMPTY for every unit of every answer, and every
 * detected attribution is therefore unmatched and unsettled.
 *
 * THAT IS ROUTE (ب) AT ITS WORST, and it is stated as such rather than smoothed over: an
 * answer whose attributions ARE supported by rows cited in the same sentence would hold
 * fewer units than this measures, never more. The number below is a ceiling on the cost.
 *
 * A SECOND UNDERSTATEMENT PULLS THE OTHER WAY and is also stated: these answers are the
 * reviewer's OUTPUT, so attributions it already generalised away cannot be detected here.
 * A raw model proposal carries more attributions than its reviewed text does.
 *
 * ── THE ARMS ────────────────────────────────────────────────────────────────────────
 * Both arms run against the SAME code in the SAME process — `holdUnsettled` is a
 * parameter for exactly this reason — so the comparison is not between two commits.
 *
 *   OFF  the phase-two behaviour: two exit conditions (the lock took nothing, the tidy
 *        pass cannot reach it). This must reproduce 10614 / 5130.
 *   ON   route (ب): the two above plus the settled-attribution test.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const url = require('url');

const SRC = path.join(__dirname, '..', '..', 'lib', 'sentence-stream.js');

// The seven chunkings of the phase-one and phase-two gates, letter for letter.
const CHUNKERS = {
  whole: (t) => [t],
  chars: (t) => [...t],
  size3: (t) => t.match(/[\s\S]{1,3}/gu) || [],
  size17: (t) => t.match(/[\s\S]{1,17}/gu) || [],
  size64: (t) => t.match(/[\s\S]{1,64}/gu) || [],
  words: (t) => t.match(/\S+\s*/gu) || [],
  lines: (t) => t.split(/(?<=\n)/u),
};

/** The lock's two page settings, from the phase-two gate. */
const PAGE_SETTINGS = [
  { name: 'no-pages', pages: [] },
  { name: 'supporting-page', pages: ['صحيح البخاري وصحيح مسلم'] },
];

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const pct = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : 0;
};
const f = (x) => x.toFixed(0).padStart(9);

/**
 * PART ONE — units out early against units held, on the phase-two gate's own grid:
 * 160 answers x 3 domains x 2 page settings x 2 truncation states, `words` chunking,
 * which is the grid that produced 10614 / 5130.
 */
function unitCensus(createSentenceStream, corpus, holdUnsettled) {
  let streamed = 0;
  let held = 0;
  let unsettledHolds = 0;
  let violations = 0;
  let runs = 0;
  for (const record of corpus) {
    for (const domain of ['fiqh', 'general', 'mixed']) {
      for (const setting of PAGE_SETTINGS) {
        for (const truncated of [false, true]) {
          runs += 1;
          const stream = createSentenceStream({
            evidence: [],
            domain,
            mode: 'standard',
            truncated,
            khilafFromOpinions: truncated ? true : null,
            opinionCount: truncated ? 2 : null,
            sources: setting.pages,
            holdUnsettled,
          });
          for (const piece of CHUNKERS.words(record.text)) stream.push(piece);
          const closed = stream.end();
          streamed += closed.streamedUnits;
          held += closed.heldUnits;
          unsettledHolds += closed.unsettledHolds || 0;
          violations += closed.violations.length;
        }
      }
    }
  }
  return { runs, streamed, held, unsettledHolds, violations };
}

/**
 * PART TWO — does the answer's FIRST unit still go out? This is the decisive number the
 * directive names. Run over all 160 in the timing model's own configuration, and again
 * over the full grid so the answer does not rest on one domain choice.
 */
function firstUnitCensus(createSentenceStream, corpus, holdUnsettled, everyDomain) {
  const domains = everyDomain ? ['fiqh', 'general', 'mixed'] : ['mixed'];
  let runs = 0;
  let firstHeld = 0;
  const ids = [];
  for (const record of corpus) {
    for (const domain of domains) {
      runs += 1;
      const stream = createSentenceStream({
        evidence: [], domain, mode: 'standard', truncated: false, sources: [], holdUnsettled,
      });
      let released = false;
      // Character by character, so «the first unit» means the first unit and not the
      // first chunk that happened to contain one.
      for (const ch of record.text) {
        if (stream.push(ch).length) { released = true; break; }
      }
      if (!released) {
        firstHeld += 1;
        if (ids.length < 12) ids.push(record.id + (everyDomain ? '/' + domain : ''));
      }
    }
  }
  return { runs, firstHeld, ids };
}

/**
 * PART THREE — time to first character, modelled EXACTLY as phase two modelled it:
 * the 80 `NEW` answers, arrival at each answer's own recorded rate (chars / recorded ms),
 * the release position computed by running the real code. The rate is the assumption;
 * the total and the length are measured.
 */
function timing(createSentenceStream, corpus, holdUnsettled) {
  const rows = [];
  let neverEarly = 0;
  for (const record of corpus) {
    const totalMs = Number(record.meta.ms);
    const msPerChar = totalMs / Math.max(1, record.text.length);
    const stream = createSentenceStream({
      evidence: [], domain: 'mixed', mode: 'standard', truncated: false, sources: [],
      holdUnsettled,
    });
    let releasedAt = null;
    const started = process.hrtime.bigint();
    for (let i = 0; i < record.text.length; i += 1) {
      const out = stream.push(record.text[i]);
      if (out.length && releasedAt === null) releasedAt = i + 1;
    }
    const closed = stream.end();
    const localMs = Number(process.hrtime.bigint() - started) / 1e6;
    if (releasedAt === null) neverEarly += 1;
    rows.push({
      id: record.id,
      beforeMs: totalMs,
      afterMs: releasedAt === null ? totalMs + localMs : (releasedAt * msPerChar) + localMs,
      releasedAt,
      units: closed.streamedUnits,
      held: closed.heldUnits,
    });
  }
  const before = rows.map((r) => r.beforeMs);
  const after = rows.map((r) => r.afterMs);
  return {
    neverEarly,
    medianBefore: median(before),
    medianAfter: median(after),
    p90Before: pct(before, 0.9),
    p90After: pct(after, 0.9),
    bestAfter: Math.min(...after),
    worstAfter: Math.max(...after),
    medianUnits: median(rows.map((r) => r.units)),
    medianHeld: median(rows.map((r) => r.held)),
    slowest: [...rows].sort((a, b) => b.afterMs - a.afterMs).slice(0, 5)
      .map((r) => ({ id: r.id, afterMs: Math.round(r.afterMs), releasedAt: r.releasedAt })),
  };
}

async function main() {
  const corpusPath = process.argv[2];
  const outPath = process.argv[3];
  if (!corpusPath) {
    console.error('usage: hold-until-stable.cjs <corpus.json> [out.json]');
    process.exit(2);
  }
  const { createSentenceStream } = await import(url.pathToFileURL(SRC).href);
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  const timed = corpus
    .filter((r) => r.run.includes('NEW'))
    .filter((r) => Number(r.meta && r.meta.ms) > 0);

  console.log('CORPUS       ' + corpus.length + ' recorded answers   (' + timed.length
    + ' with a recorded call time, used for the timing model)');
  console.log('EVIDENCE     empty for every unit - the corpus records none. Route B at its WORST.');
  console.log('');

  const census = {
    off: unitCensus(createSentenceStream, corpus, false),
    on: unitCensus(createSentenceStream, corpus, true),
  };
  console.log('UNITS OUT EARLY vs HELD   (160 x 3 domains x 2 page settings x 2 truncation, words)');
  console.log('                       runs       early        held   held-for-attribution   violations');
  for (const arm of ['off', 'on']) {
    const c = census[arm];
    console.log('  holdUnsettled=' + arm.toUpperCase().padEnd(4)
      + String(c.runs).padStart(8) + String(c.streamed).padStart(12) + String(c.held).padStart(12)
      + String(c.unsettledHolds).padStart(23) + String(c.violations).padStart(13));
  }
  const lost = census.off.streamed - census.on.streamed;
  console.log('  route B costs ' + lost + ' units of ' + census.off.streamed
    + ' (' + (100 * lost / census.off.streamed).toFixed(2) + '% of what phase two released)');

  const firstMixed = {
    off: firstUnitCensus(createSentenceStream, corpus, false, false),
    on: firstUnitCensus(createSentenceStream, corpus, true, false),
  };
  const firstAll = {
    off: firstUnitCensus(createSentenceStream, corpus, false, true),
    on: firstUnitCensus(createSentenceStream, corpus, true, true),
  };
  console.log('');
  console.log('ANSWERS THAT HOLD THEIR FIRST UNIT   (the decisive number)');
  console.log('  domain=mixed, no pages      OFF ' + firstMixed.off.firstHeld + ' / ' + firstMixed.off.runs
    + '        ON ' + firstMixed.on.firstHeld + ' / ' + firstMixed.on.runs
    + '        newly holding ' + (firstMixed.on.firstHeld - firstMixed.off.firstHeld));
  console.log('  all three domains           OFF ' + firstAll.off.firstHeld + ' / ' + firstAll.off.runs
    + '       ON ' + firstAll.on.firstHeld + ' / ' + firstAll.on.runs
    + '       newly holding ' + (firstAll.on.firstHeld - firstAll.off.firstHeld));
  if (firstMixed.on.ids.length) {
    console.log('  holding the first unit under B (mixed), first few:');
    for (const id of firstMixed.on.ids) console.log('    ' + id);
  }

  const t = {
    off: timing(createSentenceStream, timed, false),
    on: timing(createSentenceStream, timed, true),
  };
  console.log('');
  console.log('TIME TO FIRST CHARACTER, MODELLED   (' + timed.length
    + ' NEW answers, uniform rate from each answer own recorded ms and chars)');
  console.log('                         before   phase two (B off)         route B');
  console.log('  median       ' + f(t.off.medianBefore) + ' ms' + f(t.off.medianAfter) + ' ms'
    + f(t.on.medianAfter) + ' ms');
  console.log('  p90          ' + f(t.off.p90Before) + ' ms' + f(t.off.p90After) + ' ms'
    + f(t.on.p90After) + ' ms');
  console.log('  best                      ' + f(t.off.bestAfter) + ' ms' + f(t.on.bestAfter) + ' ms');
  console.log('  worst                     ' + f(t.off.worstAfter) + ' ms' + f(t.on.worstAfter) + ' ms');
  console.log('  first unit only at the end : OFF ' + t.off.neverEarly + ' / ' + timed.length
    + '   ON ' + t.on.neverEarly + ' / ' + timed.length);
  console.log('  median units early / held  : OFF ' + t.off.medianUnits + ' / ' + t.off.medianHeld
    + '   ON ' + t.on.medianUnits + ' / ' + t.on.medianHeld);
  console.log('  slowest five to a first character under B:');
  for (const r of t.on.slowest) {
    console.log('    ' + r.id.padEnd(34) + String(r.afterMs).padStart(7) + ' ms   released at char '
      + String(r.releasedAt));
  }

  // THE JUDGEMENT IS WRITTEN IN THE DIRECTIVE, NOT DECIDED HERE.
  const THRESHOLD = 1500;
  const verdict = t.on.medianAfter < THRESHOLD ? 'ADOPT-B' : 'GO-TO-A';
  console.log('');
  console.log('THRESHOLD     median time to first character under B < ' + THRESHOLD + ' ms ?');
  console.log('MEASURED      ' + t.on.medianAfter.toFixed(0) + ' ms');
  console.log('VERDICT       ' + verdict
    + (verdict === 'ADOPT-B'
      ? '  - adopt route B, go to section 4, do not touch the attribution door.'
      : '  - route A, and section 3 proof is required before a line of it.'));

  if (outPath) {
    fs.writeFileSync(outPath, JSON.stringify({
      corpus: corpus.length,
      timed: timed.length,
      census,
      firstMixed,
      firstAll,
      timing: t,
      threshold: THRESHOLD,
      medianAfterMs: t.on.medianAfter,
      verdict,
    }, null, 2), 'utf8');
    console.log('');
    console.log('wrote ' + outPath);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
