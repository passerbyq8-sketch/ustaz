#!/usr/bin/env node
/**
 * STREAM-P4 §١ — THE GATE FOR THE GROWING EVIDENCE SET.
 *
 * ── THE CLAIM THIS GATE EXISTS TO OPERATE ────────────────────────────────────
 * STREAM-P3 held units whose attribution was not settled, and the argument for it was
 * an argument FROM THE SOURCE: every evidence test in the reviewer is a `find`/`some`
 * over a list that only grows, so a MATCHED attribution can never become unmatched.
 * That argument is sound and it was written down honestly as an argument. It was never
 * a gate that could fail, and an argument that cannot fail proves nothing about the
 * next edit to lib/output-reviewer.js.
 *
 * ── WHY THE ARCHIVE CANNOT BE THE CORPUS ─────────────────────────────────────
 * The 160 recorded answers carry no evidence rows. Every unit in them is judged against
 * an empty set from the first character to the last, so «does a row that arrives later
 * change a unit that already went out?» cannot even be ASKED of them. The fixtures in
 * fixtures/growing-evidence.json are built for exactly that question: each row carries
 * the 1-based index of the unit whose citation first brings it into the set, and the
 * gate replays the answer once per prefix of that schedule.
 *
 *   E_k  =  every row with arrivesAtUnit <= k  =  the evidence in hand after unit k.
 *   E_0  =  the empty set the answer starts with.
 *
 * ── THE CONDITION ────────────────────────────────────────────────────────────
 * SAFETY   For every prefix E_k and every unit the stream RELEASED under E_k, that
 *          unit's produced text must be BYTE-IDENTICAL to its text under the final set,
 *          and its entry in `verdict.sentences` must be the same object. Text alone is
 *          not enough: the fall-through to `tagged-fiqh-understanding` emits the same
 *          characters as a matched attribution would in some shapes, and the ANNOTATION
 *          is what «باب النسبة» is judged by.
 *
 *          Checking every prefix independently covers every growth trajectory. A real
 *          run judges unit i against whatever set is in hand at unit i, and holding is
 *          monotone forward — once the stream stops it never resumes — so the released
 *          units of any trajectory are a prefix of units, each judged under some E_k.
 *          Every (unit, E_k) release decision is examined here, so no trajectory has a
 *          release this gate did not look at.
 *
 * LIVENESS A gate that only ever holds passes vacuously, and «hold everything» is the
 *          one change that would satisfy SAFETY perfectly while deleting the feature.
 *          So each case states how many units MUST still go out under the empty set,
 *          and the gate fails if fewer do.
 *
 * NEIGHBOUR A row belonging to a neighbouring mas-ala must not support the unit beside
 *          it. This one is an ABSOLUTE assertion, not a differential one, and it has to
 *          be: a cross-match would corrupt the final answer and the early one in the
 *          same way, so comparing the two against each other would see nothing. It is
 *          checked under every prefix, against a row deliberately built so that the
 *          scholar, the official host and the stance all pass and only the topic does
 *          not.
 *
 * ── HOW A UNIT IS TIED TO ITS VERDICT ENTRY ──────────────────────────────────
 * `createReviewStream`'s `onUnit` reports the units in order with the chunks each one
 * produced. Annotations are appended in that same order, and whether a unit produces an
 * annotation is a pure function of its kind and its text — cards and sentences that
 * assert nothing produce none, every other prose unit produces exactly one — so it does
 * NOT depend on the evidence set. The walk that pairs them is therefore stable across
 * prefixes, and it is asserted rather than trusted: if it does not consume every
 * annotation, the gate stops instead of reporting on a mapping it guessed.
 *
 * ── A GATE THAT CANNOT FAIL PROVES NOTHING ───────────────────────────────────
 * `--selftest` runs the same checks against deliberately broken copies of the two
 * modules, one mutant per claim, and demands every one of them FAILS. The mutation is
 * verified to have changed the source before the copy is run, so a mutant that quietly
 * did not apply cannot report a pass.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');

const LIB = path.join(__dirname, '..', '..', 'lib');
const FIXTURES = path.join(__dirname, '..', '..', 'fixtures', 'growing-evidence.json');

// The import closure of lib/sentence-stream.js. A mutant copy needs all of it, because
// the two modules under test import each other by relative path. lib/frozen-text.js
// resolves its corpora from process.cwd() first, so a copy outside lib/ still reads the
// same data files this repo ships.
const CLOSURE = [
  'sentence-stream.js',
  'output-reviewer.js',
  'takhrij-lock.js',
  'route-classify.js',
  'frozen-text.js',
];

/** One mutant per claim. Each anchor must occur EXACTLY once in its file. */
const MUTANTS = [
  {
    name: 'hold-unsettled-off',
    file: 'sentence-stream.js',
    claim: 'a unit whose attribution is not yet settled is not streamed',
    find: '  holdUnsettled = true,\n',
    replace: '  holdUnsettled = false,\n',
  },
  {
    name: 'settledness-never-reported',
    file: 'output-reviewer.js',
    claim: 'the reviewer reports unsettledness from the decision site itself',
    find: '    const produced = reviewUnitInner(unit, () => { unitSettled = false; });',
    replace: '    const produced = reviewUnitInner(unit, () => { unitSettled = true; });',
  },
  {
    name: 'no-mark-on-unmatched-attribution',
    file: 'output-reviewer.js',
    claim: 'an unmatched ATTRIBUTION is what marks a fiqh unit unsettled',
    find: '\n        if (!matched) mark();',
    replace: '\n        if (!matched) { /* nothing */ }',
  },
  {
    name: 'no-mark-on-unmatched-dynamic',
    file: 'output-reviewer.js',
    claim: 'an unmatched DYNAMIC claim marks its unit unsettled too',
    find: '\n      if (!matched) mark();',
    replace: '\n      if (!matched) { /* nothing */ }',
  },
  {
    name: 'cross-mas-ala-support',
    file: 'output-reviewer.js',
    claim: 'a row from a neighbouring mas-ala does not support this unit',
    find: '  if (overlap < Math.min(2, claimTokens.length)) return false;',
    replace: '  if (false) return false;',
  },
  {
    name: 'hold-everything',
    file: 'sentence-stream.js',
    claim: 'units that ARE safe still go out — the gate is not passed by holding all',
    find: '    emitted.push(unit);\n    return [unit];',
    replace: '    streaming = false;\n    held += 1;\n    return [];',
  },
];

/** Write a mutated copy of the whole closure and PROVE the mutation landed. */
function mutatedClosure(mutant) {
  const dir = path.join(os.tmpdir(), 'ezik-stream-p4', 'mutant-' + mutant.name);
  fs.mkdirSync(dir, { recursive: true });
  let applied = false;
  for (const name of CLOSURE) {
    const source = fs.readFileSync(path.join(LIB, name), 'utf8');
    let out = source;
    if (name === mutant.file) {
      const hits = source.split(mutant.find).length - 1;
      if (hits !== 1) {
        throw new Error('mutant ' + mutant.name + ': anchor found ' + hits + ' times in '
          + name + ', expected 1');
      }
      out = source.replace(mutant.find, mutant.replace);
      if (out === source) throw new Error('mutant ' + mutant.name + ': source unchanged');
      applied = true;
    }
    fs.writeFileSync(path.join(dir, name), out, 'utf8');
  }
  if (!applied) throw new Error('mutant ' + mutant.name + ': file ' + mutant.file + ' is not in the closure');
  return path.join(dir, 'sentence-stream.js');
}

/** Deterministic chunkings. No randomness: a proof that cannot be replayed is not one. */
const CHUNKERS = {
  whole: (t) => [t],
  chars: (t) => [...t],
  size3: (t) => t.match(/[\s\S]{1,3}/gu) || [],
  size17: (t) => t.match(/[\s\S]{1,17}/gu) || [],
  size64: (t) => t.match(/[\s\S]{1,64}/gu) || [],
  words: (t) => t.match(/\S+\s*/gu) || [],
  lines: (t) => t.split(/(?<=\n)/u),
};

/** E_k — the rows in hand once unit k has been written. */
function evidenceAfterUnit(entries, k) {
  return entries.filter((e) => e.arrivesAtUnit <= k).map((e) => e.row);
}

/**
 * Replay one answer under one evidence set and one chunking, and report per unit.
 * Two streams are run over the same input: the reviewer alone, which is the only thing
 * that can name the units and hand back their annotations, and the sentence stream,
 * which is the only thing that decides what leaves. They are then reconciled.
 */
function replay(mod, kase, evidence, chunk) {
  const text = kase.units.join('\n');
  const input = { evidence, domain: kase.domain, mode: kase.mode || 'standard' };

  // ── the reviewer, for the units and their annotations ──
  const seen = [];
  const review = mod.createReviewStream({ ...input, onUnit: (r) => seen.push(r) });
  for (const piece of chunk(text)) review.push(piece);
  const closed = review.end();

  // Pair units with annotations. Order is shared; a unit contributes 0 or 1.
  const anns = closed.annotations;
  const verdicts = closed.verdict.sentences;
  const perUnit = [];
  let j = 0;
  for (const unit of seen) {
    if (j < anns.length && anns[j].input === unit.text) {
      perUnit.push({ text: unit.text, produced: unit.produced, settled: unit.settled, verdict: verdicts[j] });
      j += 1;
    } else {
      perUnit.push({ text: unit.text, produced: unit.produced, settled: unit.settled, verdict: null });
    }
  }
  if (j !== anns.length) {
    throw new Error('unit/annotation walk consumed ' + j + ' of ' + anns.length
      + ' annotations — the pairing is not sound, refusing to report');
  }

  // ── the sentence stream, for what actually left ──
  const stream = mod.createSentenceStream({
    ...input, sources: Array.isArray(kase.sources) ? kase.sources : [],
  });
  const pushed = [];
  for (const piece of chunk(text)) pushed.push(...stream.push(piece));
  const ended = stream.end();
  // `tail` is the units released at end() followed by the remainder; streamedUnits says
  // how many of the whole run were released, so the split point is arithmetic, not a guess.
  const lateCount = ended.streamedUnits - pushed.length;
  if (lateCount < 0 || lateCount > ended.tail.length) {
    throw new Error('streamedUnits=' + ended.streamedUnits + ' does not reconcile with '
      + pushed.length + ' pushed and ' + ended.tail.length + ' tail chunks');
  }
  const released = [...pushed, ...ended.tail.slice(0, lateCount)];

  // Which UNITS those released chunks belong to.
  const flat = [];
  perUnit.forEach((u, i) => u.produced.forEach((c) => flat.push({ chunk: c, unit: i })));
  const releasedUnits = new Set();
  for (let i = 0; i < released.length; i += 1) {
    if (!flat[i] || flat[i].chunk !== released[i]) {
      throw new Error('released chunk ' + i + ' does not match the reviewer\'s own output — '
        + JSON.stringify(released[i]) + ' vs ' + JSON.stringify(flat[i] ? flat[i].chunk : null));
    }
    releasedUnits.add(flat[i].unit);
  }

  return {
    perUnit,
    releasedUnits: [...releasedUnits],
    streamedUnits: ended.streamedUnits,
    violations: ended.violations,
    finalText: ended.text,
  };
}

function runGate(moduleHref, quiet) {
  const doc = JSON.parse(fs.readFileSync(FIXTURES, 'utf8'));
  // The reviewer is imported as the ENTRY'S OWN SIBLING, never from lib/, so that a mutant
  // copy is the one both halves of the machine run on.
  const reviewerHref = new URL('./output-reviewer.js', moduleHref).href;
  return Promise.all([import(moduleHref), import(reviewerHref)]).then(([stream, reviewer]) => {
    const mod = { ...reviewer, ...stream };
    const failures = [];
    const cases = [];
    let checksSafety = 0;
    let checksLiveness = 0;
    let checksNeighbour = 0;
    let replays = 0;

    for (const kase of doc.cases) {
      const n = kase.units.length;
      const perChunker = {};
      let releasedEver = new Set();
      let heldForever = new Set();

      for (const [cname, chunk] of Object.entries(CHUNKERS)) {
        // The final set is the yardstick, and it is computed under the SAME chunking so
        // that a segmentation difference cannot be mistaken for an evidence difference.
        let last;
        try {
          last = replay(mod, kase, evidenceAfterUnit(kase.evidence, n), chunk);
        } catch (e) {
          failures.push({ case: kase.id, chunker: cname, kind: 'replay-threw', detail: String(e.message || e) });
          continue;
        }
        perChunker[cname] = { prefixes: 0, releasedUnderEmpty: 0 };

        for (let k = 0; k <= n; k += 1) {
          let run;
          try {
            run = replay(mod, kase, evidenceAfterUnit(kase.evidence, k), chunk);
          } catch (e) {
            failures.push({ case: kase.id, chunker: cname, prefix: k, kind: 'replay-threw', detail: String(e.message || e) });
            continue;
          }
          replays += 1;
          perChunker[cname].prefixes += 1;
          if (k === 0) perChunker[cname].releasedUnderEmpty = run.streamedUnits;

          if (run.violations.length) {
            failures.push({ case: kase.id, chunker: cname, prefix: k, kind: 'stream-violation', detail: JSON.stringify(run.violations) });
          }

          // ── SAFETY ──
          for (const i of run.releasedUnits) {
            releasedEver.add(i);
            checksSafety += 1;
            const early = run.perUnit[i];
            const final = last.perUnit[i];
            const earlyText = early.produced.join(' ');
            const finalText = final ? final.produced.join(' ') : null;
            if (earlyText !== finalText) {
              failures.push({
                case: kase.id, chunker: cname, prefix: k, unit: i + 1, kind: 'text-changed-under-later-rows',
                early: earlyText, final: finalText,
              });
              continue;
            }
            const a = JSON.stringify(early.verdict);
            const b = JSON.stringify(final ? final.verdict : null);
            if (a !== b) {
              failures.push({
                case: kase.id, chunker: cname, prefix: k, unit: i + 1, kind: 'verdict-changed-under-later-rows',
                early: a, final: b,
              });
            }
          }

          // ── NEIGHBOUR ──
          for (const rule of (kase.expect.mustNotSupport || [])) {
            checksNeighbour += 1;
            const v = run.perUnit[rule.unit - 1] && run.perUnit[rule.unit - 1].verdict;
            if (v && v.evidenceId === rule.evidenceId) {
              failures.push({
                case: kase.id, chunker: cname, prefix: k, unit: rule.unit, kind: 'neighbouring-row-supported-this-unit',
                early: rule.evidenceId, final: rule.why,
              });
            }
          }
        }

        // ── LIVENESS ──
        checksLiveness += 1;
        const underEmpty = perChunker[cname].releasedUnderEmpty;
        if (underEmpty < kase.expect.streamedUnitsUnderEmptySet) {
          failures.push({
            case: kase.id, chunker: cname, kind: 'nothing-goes-out-any-more',
            early: String(underEmpty), final: String(kase.expect.streamedUnitsUnderEmptySet),
          });
        }
      }

      for (let i = 0; i < n; i += 1) if (!releasedEver.has(i)) heldForever.add(i);
      cases.push({
        id: kase.id,
        units: n,
        rows: kase.evidence.length,
        prefixes: n + 1,
        unitsReleasedUnderSomePrefix: [...releasedEver].map((i) => i + 1).sort((a, b) => a - b),
        unitsNeverReleased: [...heldForever].map((i) => i + 1).sort((a, b) => a - b),
        perChunker,
      });
    }

    const report = {
      fixtures: FIXTURES,
      cases,
      replays,
      checks: { safety: checksSafety, liveness: checksLiveness, neighbour: checksNeighbour },
      failures,
      pass: failures.length === 0,
    };

    if (!quiet) {
      console.log('FIXTURES    ' + doc.cases.length + ' handmade cases, '
        + doc.cases.reduce((s, c) => s + c.units.length, 0) + ' units, '
        + doc.cases.reduce((s, c) => s + c.evidence.length, 0) + ' rows on an arrival schedule');
      console.log('REPLAYS     ' + replays + '  (case x evidence-prefix x chunking)');
      console.log('CHECKS      safety ' + checksSafety + '   liveness ' + checksLiveness
        + '   neighbour ' + checksNeighbour);
      console.log('');
      for (const c of cases) {
        console.log('  ' + c.id);
        console.log('    units ' + c.units + '   rows ' + c.rows + '   prefixes E_0..E_' + c.units);
        console.log('    released under some prefix : [' + c.unitsReleasedUnderSomePrefix.join(', ') + ']');
        console.log('    never released early       : [' + c.unitsNeverReleased.join(', ') + ']');
        const line = Object.entries(c.perChunker)
          .map(([k, v]) => k + '=' + v.releasedUnderEmpty).join('  ');
        console.log('    units out under E_0        : ' + line);
      }
      console.log('');
      if (failures.length) {
        console.log('FAILURES (' + failures.length + '):');
        for (const f of failures.slice(0, 40)) {
          console.log('  ' + f.kind + '  case=' + f.case + ' chunker=' + f.chunker
            + (f.prefix === undefined ? '' : ' E_' + f.prefix)
            + (f.unit === undefined ? '' : ' unit=' + f.unit));
          if (f.detail) console.log('      ' + f.detail);
          if (f.early !== undefined) console.log('      early : ' + String(f.early).slice(0, 200));
          if (f.final !== undefined) console.log('      final : ' + String(f.final).slice(0, 200));
        }
        if (failures.length > 40) console.log('  ... and ' + (failures.length - 40) + ' more');
      }
    }

    return report;
  });
}

async function main() {
  const args = process.argv.slice(2);
  const selftest = args.includes('--selftest');
  const outPath = args.filter((a) => !a.startsWith('--'))[0];

  const report = await runGate(url.pathToFileURL(path.join(LIB, 'sentence-stream.js')).href, false);
  if (outPath) {
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log('wrote ' + outPath);
  }
  console.log('\n' + (report.pass ? 'GATE PASS' : 'GATE FAIL'));

  let selftestOk = true;
  if (selftest) {
    console.log('\nSELFTEST — each mutant must be caught:');
    for (const mutant of MUTANTS) {
      // A MUTANT THAT DID NOT BUILD IS NOT A MUTANT THAT WAS CAUGHT. An anchor that has
      // drifted out of the source reports zero hits, and reading that as «caught» is how a
      // selftest congratulates itself for running nothing at all. Building and running are
      // therefore two separate verdicts, and only the second can say CAUGHT.
      let verdict;
      let detail;
      let entry;
      try {
        entry = mutatedClosure(mutant);
      } catch (e) {
        verdict = 'BROKEN ';
        detail = 'the mutant did not build: ' + String(e.message || e).slice(0, 110);
      }
      if (entry) {
        try {
          const r = await runGate(url.pathToFileURL(entry).href, true);
          const kinds = {};
          for (const f of r.failures) kinds[f.kind] = (kinds[f.kind] || 0) + 1;
          verdict = r.pass ? 'MISSED ' : 'CAUGHT ';
          detail = r.failures.length + ' failures'
            + (r.failures.length ? ' — ' + Object.entries(kinds).map(([k, v]) => k + ' x' + v).join(', ') : '');
        } catch (e) {
          // The mutation made the module unusable. That is a catch, but say which kind.
          verdict = 'CAUGHT ';
          detail = 'the mutated module threw: ' + String(e.message || e).slice(0, 100);
        }
      }
      if (verdict !== 'CAUGHT ') selftestOk = false;
      console.log('  ' + verdict + mutant.name.padEnd(34) + detail);
      console.log('           claim: ' + mutant.claim);
    }
    console.log('\nSELFTEST ' + (selftestOk ? 'PASS' : 'FAIL')
      + ' — ' + MUTANTS.length + ' mutants, ' + (selftestOk ? 'all caught' : 'one or more MISSED'));
  }

  process.exit(report.pass && selftestOk ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
