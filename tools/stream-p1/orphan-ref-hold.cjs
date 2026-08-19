#!/usr/bin/env node
/**
 * STREAM-P5 §٢ — THE DECIDING MEASUREMENT: WHAT THE REFERENCE-NUMBER HOLD COSTS.
 *
 * `dropOrphanRefNumbers` (lib/free-brain/loop.js:195, called at :1435) runs on the WHOLE
 * reviewed text after the reviewer is done. It removes every `[1]`-style group and folds
 * the whitespace left behind. A unit already sent that carries one would be edited after
 * the reader read it — a unit emitted and then replaced, which §٥/١ forbids.
 *
 * The cure is the same shape as the phase-three cure: the unit does not leave if this
 * stage could still change it. `holdRefDrop` is a parameter for exactly the same reason
 * `holdUnsettled` is one — both arms run against the SAME code in the SAME process, so
 * the comparison is not between two commits.
 *
 *   OFF  route B as adopted in phase three. This must reproduce 9982 / 5762 and 9 / 160.
 *   ON   route B plus the reference-number test.
 *
 * ── WHAT THIS CORPUS CAN AND CANNOT SAY ─────────────────────────────────────────────
 * The 160 answers are READER TEXT as the archive recorded it. Whatever `[n]` groups they
 * carry are the ones the model actually wrote and the delivery path actually removed, so
 * for THIS predicate the corpus is direct evidence and not a worst case — unlike the
 * attribution measurement, whose evidence rows were never recorded.
 *
 * The one direction it understates: these are answers the reviewer already rewrote. A raw
 * proposal carries at least as many invented reference numbers as its reviewed text does.
 *
 * ── AND THE MIRROR IS CHECKED, NOT TRUSTED ──────────────────────────────────────────
 * `refDropWouldChange` mirrors `dropOrphanRefNumbers` rather than importing it (the loop's
 * module graph pulls the whole tool layer). PART ZERO runs both over every unit of every
 * answer and fails if they ever disagree, so the copy cannot drift in silence.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const url = require('url');

const SRC = path.join(__dirname, '..', '..', 'lib', 'sentence-stream.js');
const LOOP = path.join(__dirname, '..', '..', 'lib', 'free-brain', 'loop.js');

/** The seven chunkings of the phase-one, -two and -three gates, letter for letter. */
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
 * PART ZERO — the mirror agrees with the real function, unit by unit.
 * Every unit of every answer under every chunking is put to both. One disagreement is a
 * failure: the whole point of mirroring is that the copy answers the same question.
 */
function mirrorCheck(refDropWouldChange, dropOrphanRefNumbers, corpus) {
  let compared = 0;
  const disagreements = [];
  for (const record of corpus) {
    // The units the predicate actually sees are sentences, so ask it about sentences AND
    // about the whole answer: a predicate that is right on one granularity and wrong on
    // the other is still wrong.
    const pieces = [record.text, ...record.text.split(/(?<=[.؟!\n])/u)];
    for (const piece of pieces) {
      if (!piece) continue;
      compared += 1;
      const mirror = refDropWouldChange(piece);
      const real = dropOrphanRefNumbers(piece) !== piece;
      if (mirror !== real && disagreements.length < 8) {
        disagreements.push({ id: record.id, mirror, real, sample: piece.slice(0, 60) });
      } else if (mirror !== real) {
        disagreements.push({ id: record.id });
      }
    }
  }
  return { compared, disagreements };
}

/** PART ONE — units out early against units held, on the phase-three gate's own grid. */
function unitCensus(createSentenceStream, corpus, holdRefDrop) {
  let streamed = 0;
  let held = 0;
  let refHolds = 0;
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
            holdUnsettled: true,
            holdRefDrop,
          });
          for (const piece of CHUNKERS.words(record.text)) stream.push(piece);
          const closed = stream.end();
          streamed += closed.streamedUnits;
          held += closed.heldUnits;
          refHolds += closed.refHolds || 0;
          violations += closed.violations.length;
        }
      }
    }
  }
  return { runs, streamed, held, refHolds, violations };
}

/** PART TWO — does the answer's FIRST unit still go out? The decisive number. */
function firstUnitCensus(createSentenceStream, corpus, holdRefDrop, everyDomain) {
  const domains = everyDomain ? ['fiqh', 'general', 'mixed'] : ['mixed'];
  let runs = 0;
  let firstHeld = 0;
  const ids = [];
  for (const record of corpus) {
    for (const domain of domains) {
      runs += 1;
      const stream = createSentenceStream({
        evidence: [], domain, mode: 'standard', truncated: false, sources: [],
        holdUnsettled: true, holdRefDrop,
      });
      let released = false;
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

/** PART THREE — time to first character, modelled EXACTLY as phases two and three did. */
function timing(createSentenceStream, corpus, holdRefDrop) {
  const rows = [];
  let neverEarly = 0;
  for (const record of corpus) {
    const totalMs = Number(record.meta.ms);
    const msPerChar = totalMs / Math.max(1, record.text.length);
    const stream = createSentenceStream({
      evidence: [], domain: 'mixed', mode: 'standard', truncated: false, sources: [],
      holdUnsettled: true, holdRefDrop,
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
  const after = rows.map((r) => r.afterMs);
  return {
    neverEarly,
    medianBefore: median(rows.map((r) => r.beforeMs)),
    medianAfter: median(after),
    p90Before: pct(rows.map((r) => r.beforeMs), 0.9),
    p90After: pct(after, 0.9),
    bestAfter: Math.min(...after),
    worstAfter: Math.max(...after),
    medianUnits: median(rows.map((r) => r.units)),
    medianHeld: median(rows.map((r) => r.held)),
    slowest: [...rows].sort((a, b) => b.afterMs - a.afterMs).slice(0, 5)
      .map((r) => ({ id: r.id, afterMs: Math.round(r.afterMs), releasedAt: r.releasedAt })),
  };
}

/**
 * THE EXPOSURE — was this a LIVE defect or a latent one?
 *
 * The unit census can show zero cost for two very different reasons: because no unit in the
 * corpus carries an invented reference number, or because `tidyWouldChange` happened to be
 * holding every unit that does. Only the second is «free»; and only a unit that the reference
 * pass would edit while EVERY existing test would have let it through was ever really on the
 * wire. That unit is what this counts, and it is the number that says whether the hold earns
 * its place or merely renames a hold that already existed.
 */
function exposure(refDropWouldChange, tidyWouldChange, lockTakhrij, corpus) {
  let units = 0;
  let wouldEdit = 0;
  let caughtByTidyToo = 0;
  let onlyTheRefTest = 0;
  const samples = [];
  for (const record of corpus) {
    for (const unit of record.text.split(/(?<=[.؟!\n])/u)) {
      const u = unit.trim();
      if (!u) continue;
      units += 1;
      if (!refDropWouldChange(u)) continue;
      wouldEdit += 1;
      if (tidyWouldChange(u)) { caughtByTidyToo += 1; continue; }
      // The tidy test lets it through. Does the lock stop it? If not, it was on the wire.
      const locked = lockTakhrij(u, []);
      if (locked.droppedSentences.length || locked.text !== u) { caughtByTidyToo += 1; continue; }
      onlyTheRefTest += 1;
      if (samples.length < 6) samples.push({ id: record.id, chars: u.length });
    }
  }
  return { units, wouldEdit, caughtByTidyToo, onlyTheRefTest, samples };
}

/** How many answers carry an invented reference number at all. Context for every number above. */
function refCensus(dropOrphanRefNumbers, corpus) {
  let answersWithRefs = 0;
  for (const record of corpus) {
    if (dropOrphanRefNumbers(record.text) !== record.text.trim()) answersWithRefs += 1;
  }
  return answersWithRefs;
}

async function main() {
  const corpusPath = process.argv[2];
  const outPath = process.argv[3];
  if (!corpusPath) {
    console.error('usage: orphan-ref-hold.cjs <corpus.json> [out.json]');
    process.exit(2);
  }
  const { createSentenceStream, refDropWouldChange, tidyWouldChange } = await import(url.pathToFileURL(SRC).href);
  const { dropOrphanRefNumbers } = await import(url.pathToFileURL(LOOP).href);
  const { lockTakhrij } = await import(url.pathToFileURL(
    path.join(__dirname, '..', '..', 'lib', 'takhrij-lock.js'),
  ).href);
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  const timed = corpus.filter((r) => r.run.includes('NEW') && Number(r.meta.ms) > 0);

  console.log('');
  console.log('MIRROR AGREES WITH THE REAL FUNCTION   (refDropWouldChange vs dropOrphanRefNumbers)');
  const mirror = mirrorCheck(refDropWouldChange, dropOrphanRefNumbers, corpus);
  console.log(`  compared        ${String(mirror.compared).padStart(6)} pieces`);
  console.log(`  disagreements   ${String(mirror.disagreements.length).padStart(6)}`);
  for (const d of mirror.disagreements.slice(0, 8)) {
    console.log(`    ${d.id} mirror=${d.mirror} real=${d.real}`);
  }

  console.log('');
  console.log(`ANSWERS CARRYING AN INVENTED REFERENCE NUMBER   ${refCensus(dropOrphanRefNumbers, corpus)} / ${corpus.length}`);

  console.log('');
  console.log('THE EXPOSURE   (units the reference pass would edit, against what already held them)');
  const exp = exposure(refDropWouldChange, tidyWouldChange, lockTakhrij, corpus);
  console.log(`  units in the corpus                          ${String(exp.units).padStart(6)}`);
  console.log(`  units the reference pass would edit          ${String(exp.wouldEdit).padStart(6)}`);
  console.log(`  of those, an existing test held anyway       ${String(exp.caughtByTidyToo).padStart(6)}`);
  console.log(`  of those, ONLY the new test holds            ${String(exp.onlyTheRefTest).padStart(6)}   <- the live exposure`);

  console.log('');
  console.log('UNITS OUT EARLY vs HELD   (160 x 3 domains x 2 page settings x 2 truncation, words)');
  console.log('                       runs       early        held      held-for-refs   violations');
  const off = unitCensus(createSentenceStream, corpus, false);
  const on = unitCensus(createSentenceStream, corpus, true);
  console.log(`  holdRefDrop=OFF ${String(off.runs).padStart(10)}${f(off.streamed)}${f(off.held)}${f(off.refHolds)}${f(off.violations)}`);
  console.log(`  holdRefDrop=ON  ${String(on.runs).padStart(10)}${f(on.streamed)}${f(on.held)}${f(on.refHolds)}${f(on.violations)}`);
  const cost = off.streamed - on.streamed;
  console.log(`  the reference-number hold costs ${cost} units of ${off.streamed} (${(100 * cost / Math.max(1, off.streamed)).toFixed(2)}% of what route B released)`);

  console.log('');
  console.log('ANSWERS THAT HOLD THEIR FIRST UNIT   (the decisive number)');
  const fOff = firstUnitCensus(createSentenceStream, corpus, false, false);
  const fOn = firstUnitCensus(createSentenceStream, corpus, true, false);
  const aOff = firstUnitCensus(createSentenceStream, corpus, false, true);
  const aOn = firstUnitCensus(createSentenceStream, corpus, true, true);
  console.log(`  domain=mixed, no pages      OFF ${fOff.firstHeld} / ${fOff.runs}        ON ${fOn.firstHeld} / ${fOn.runs}        newly holding ${fOn.firstHeld - fOff.firstHeld}`);
  console.log(`  all three domains           OFF ${aOff.firstHeld} / ${aOff.runs}       ON ${aOn.firstHeld} / ${aOn.runs}       newly holding ${aOn.firstHeld - aOff.firstHeld}`);

  console.log('');
  console.log(`TIME TO FIRST CHARACTER, MODELLED   (${timed.length} NEW answers, uniform rate from each answer own recorded ms and chars)`);
  const tOff = timing(createSentenceStream, timed, false);
  const tOn = timing(createSentenceStream, timed, true);
  console.log('                         before      route B (refs off)     refs held');
  console.log(`  median        ${f(tOff.medianBefore)}${f(tOff.medianAfter)}${f(tOn.medianAfter)}`);
  console.log(`  p90           ${f(tOff.p90Before)}${f(tOff.p90After)}${f(tOn.p90After)}`);
  console.log(`  best                            ${f(tOff.bestAfter)}${f(tOn.bestAfter)}`);
  console.log(`  worst                           ${f(tOff.worstAfter)}${f(tOn.worstAfter)}`);
  console.log(`  first unit only at the end : OFF ${tOff.neverEarly} / ${timed.length}   ON ${tOn.neverEarly} / ${timed.length}`);
  console.log(`  median units early / held  : OFF ${tOff.medianUnits} / ${tOff.medianHeld}   ON ${tOn.medianUnits} / ${tOn.medianHeld}`);
  console.log('  slowest five to a first character with the reference hold on:');
  for (const s of tOn.slowest) {
    console.log(`    ${s.id.padEnd(36)}${String(s.afterMs).padStart(6)} ms   released at char ${s.releasedAt}`);
  }

  const verdictOk = tOn.medianAfter < 1500;
  console.log('');
  console.log('THRESHOLD     median time to first character with the reference hold on < 1500 ms ?');
  console.log(`MEASURED      ${Math.round(tOn.medianAfter)} ms`);
  console.log(`VERDICT       ${verdictOk ? 'ADOPT - adopt the hold, go to section 3.' : 'STOP - do not open section 3, write instead.'}`);

  if (mirror.disagreements.length) {
    console.log('');
    console.log('MIRROR FAILED - the copy no longer answers the same question as the real function.');
  }

  if (outPath) {
    fs.writeFileSync(outPath, JSON.stringify({
      mirror, off, on, firstUnit: { fOff, fOn, aOff, aOn }, timing: { tOff, tOn }, verdictOk,
    }, null, 2), 'utf8');
    console.log(`\nwrote ${outPath}`);
  }
  process.exit(mirror.disagreements.length ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
