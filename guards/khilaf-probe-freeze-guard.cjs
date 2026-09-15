// guards/khilaf-probe-freeze-guard.cjs — item 72, door (b): THE THIRD TRIGGER STAYS EMPTY.
//
// ── WHAT THIS GUARD IS FOR ──────────────────────────────────────────────────
//
// The khilaf notice — one sentence, appended once — has three igniters:
//
//   sourceDeclaresKhilaf       lib/output-reviewer.js    the excerpt says so in its own words
//   modelProseDeclaresKhilaf   lib/output-reviewer.js    the model's prose says so
//   khilafFromOpinionsProbe    lib/free-brain/loop.js    more than one OPINION exists
//
// The third one has an empty body. It returns KHILAF_UNKNOWN — null — for every evidence set it
// is ever handed, and it does so BY MEASUREMENT, not by oversight. Its own file carries the
// minute: a field in the fatwa store (0 of 20 deposited records), a tag in the data (0 of 20),
// and multiplicity of distinct sources (`opinionCount >= 2`) which fired exactly once on the only
// multi-source set the tree holds and was WRONG on it — 0 correct, 1 false. The opposite reading
// is worse still: treating one source as «no disagreement» contradicts the material in hand on 1
// of the 18 single-source records.
//
// So every value that could be put in that body today is a measured lie told inside the reader's
// own reply, and the owner's ruling of 15 September is that it stays empty until a ruling-
// direction detector exists — which is an item of its own, not a line to be slipped in here.
//
// ── WHAT THIS GUARD THEREFORE PROVES, BY RUNNING AND NOT BY READING ─────────
//
//   1  the probe answers null on EVERY evidence set deposited in this tree, including every set
//      that holds two or more distinct sources, and including every pair and triple this file
//      builds out of the deposited records to make multi-source sets in quantity;
//   2  `khilafSignal(...).khilafFromOpinions` is never `true` on any of them;
//   3  THE NEGATIVE WITNESS, with the probe INJECTED: a single-source set still does not produce
//      `true` even when the probe is rewritten to return `true`, because the clause above it
//      refuses — and the same twin with that clause deleted DOES produce `true`, which is what
//      makes assertion 3 load-bearing rather than decorative;
//   4  `opinionCount` is a whole number >= 0 on every one of them.
//
// A text assertion could satisfy none of these. The probe is called, the signal is called, and
// the injected twin is really loaded and really run.
//
// ── ON LANGUAGE ─────────────────────────────────────────────────────────────
// Everything this file prints is English, including the refusal at the bottom. Arabic belongs in
// the tree's documents, not in a terminal.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { fresh, harness } = require('./output-reviewer-mutant-lib.cjs');

const ROOT = path.resolve(__dirname, '..');
const LOOP = path.join(ROOT, 'lib', 'free-brain', 'loop.js');
const FIXTURES = path.join(ROOT, 'fixtures');
const { ok, finish } = harness('khilaf-probe-freeze');

// Nothing this guard prints may carry Arabic, and evidence rows are full of it. Every detail
// string goes through here, so a failing assertion still says something useful without spilling
// a fatwa excerpt into a terminal that may not be able to draw it.
const ascii = (value) => String(value).replace(/[^\x20-\x7E]/gu, '.');

const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));

// A copy of the loop in os.tmpdir() cannot resolve './tools.js', so relative specifiers are
// rewritten to absolute file URLs pointing back at the real tree. Only the file under mutation
// moves; everything it imports stays where it is.
function importsFromTree(source, originalFile) {
  return source.replace(/(['"])(\.\.?\/[^'"\r\n]+\.js)\1/gu, (_all, quote, specifier) => {
    const target = path.resolve(path.dirname(originalFile), specifier);
    return quote + pathToFileURL(target).href + quote;
  });
}

// THE MUTATION IS VERIFIED TO HAVE APPLIED BEFORE THE TWIN IS TRUSTED. A transform whose seam has
// moved leaves the source untouched, the twin then behaves exactly like the original, and the
// assertion below it reports a PASS that measured nothing at all. `changed` is checked first and
// asserted separately, so a moved seam is a FAIL and never a silent success.
async function loopTwin(name, transform) {
  const original = fs.readFileSync(LOOP, 'utf8');
  const mutated = transform(original);
  if (mutated === original) return { changed: false, loaded: false, module: null, error: 'mutation seam moved' };
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-khilaf-freeze-'));
  const twin = path.join(temp, name.replace(/[^a-z0-9_-]/giu, '_') + '.mjs');
  fs.writeFileSync(twin, importsFromTree(mutated, LOOP), 'utf8');
  try {
    return { changed: true, loaded: true, module: await fresh(twin, name), error: null, temp };
  } catch (error) {
    fs.rmSync(temp, { recursive: true, force: true });
    return { changed: true, loaded: false, module: null, error: error?.stack || String(error) };
  }
}

// The two seams, each written for LF and for CRLF, because this repository checks out both ways
// and a seam spelled one way reports «moved» on the other machine and kills nothing.
const PROBE_BODY = /(export function khilafFromOpinionsProbe\(rows\) \{\r?\n {2}void rows;\r?\n {2}return )KHILAF_UNKNOWN;/u;
const NEGATIVE_WITNESS = /( {2}const khilafFromOpinions = )\(probed === true && opinionCount <= 1\) \? null\r?\n {4}: known \? probed\r?\n {6}: null;/u;

// ── THE CORPUS: every evidence set this tree deposits, plus multi-source sets built from them ─
//
// Built once and printed by size, because assertion 1 is only worth anything if the sets it ran
// on really do include sets of two sources and more. The deposited shapes differ from one another
// and each is unwrapped the way its own consumer unwraps it: `fatwa-authority-eighteen` holds ONE
// evidence object per case, `growing-evidence` wraps each row in `{arrivesAtUnit, row}`, and the
// riba records are raw service records mapped to rows the way lib/hybrid-deen.js maps them.
function buildCorpus() {
  const sets = [];
  const push = (id, rows) => sets.push({ id, rows });

  const eighteen = readFixture('fatwa-authority-eighteen.json');
  const singles = [];
  eighteen.cases.forEach((entry, index) => {
    const rows = Array.isArray(entry.evidence) ? entry.evidence : [entry.evidence].filter(Boolean);
    singles.push(rows[0]);
    push('eighteen[' + index + ']', rows);
  });

  const riba = readFixture('riba-family-two-records.json');
  const ribaRows = riba.records.map((record, index) => ({
    ref: index + 1,
    url: (record.source && record.source.url) || '',
    publisher: (record.scholar && record.scholar.shortName) || '',
    recordId: record.uid,
  }));
  push('riba[both]', ribaRows);
  push('riba[first]', [ribaRows[0]]);

  readFixture('growing-evidence.json').cases.forEach((entry, index) => {
    const rows = (Array.isArray(entry.evidence) ? entry.evidence : []).map((item) => (item && item.row ? item.row : item));
    push('growing[' + index + ']', rows);
  });

  readFixture('output-reviewer-six-cases.json').cases.forEach((entry, index) => {
    push('six[' + index + ']', (entry.input && entry.input.evidence) || []);
  });

  // MULTI-SOURCE SETS IN QUANTITY. The deposited corpus holds only two sets of two sources or
  // more, which is too thin a floor for «the probe answers null on every set with two sources and
  // more». Every pair and every adjacent triple of the eighteen real records is therefore an
  // evidence set of its own here: 153 pairs, 16 triples, and the whole roster at once.
  for (let i = 0; i < singles.length; i += 1) {
    for (let j = i + 1; j < singles.length; j += 1) push('pair[' + i + ',' + j + ']', [singles[i], singles[j]]);
  }
  for (let i = 0; i + 2 < singles.length; i += 1) push('triple[' + i + ']', singles.slice(i, i + 3));
  push('all-eighteen', singles.slice());

  // The empty set is an evidence set too, and the one that must count zero rather than throw.
  push('empty', []);
  return sets;
}

(async () => {
  console.log('=== khilaf-probe-freeze-guard -- the third igniter is empty BY MEASUREMENT ===');

  const loop = await fresh(LOOP, 'khilaf-freeze-base');
  const corpus = buildCorpus();
  const multi = corpus.filter((entry) => loop.khilafSignal(entry.rows).opinionCount >= 2);

  console.log('  cases: ' + corpus.length + ' evidence sets, of which ' + multi.length
    + ' hold two or more distinct sources');
  ok('the corpus really contains multi-source sets, or assertion 1 proves nothing',
    multi.length >= 100, 'multi-source sets = ' + multi.length);

  // ── 1. THE PROBE ANSWERS null ON EVERY SET ────────────────────────────────
  const probeOffenders = corpus.filter((entry) => loop.khilafFromOpinionsProbe(entry.rows) !== null);
  ok('1. khilafFromOpinionsProbe returns null on all ' + corpus.length + ' evidence sets',
    probeOffenders.length === 0,
    ascii(probeOffenders.slice(0, 5).map((entry) => entry.id + '=' + JSON.stringify(loop.khilafFromOpinionsProbe(entry.rows))).join(', ')));
  const multiOffenders = multi.filter((entry) => loop.khilafFromOpinionsProbe(entry.rows) !== null);
  ok('1b. ...including every set of two or more sources (' + multi.length + ' of them)',
    multiOffenders.length === 0, ascii(multiOffenders.slice(0, 5).map((entry) => entry.id).join(', ')));

  // ── 2. THE SIGNAL IS NEVER `true` ─────────────────────────────────────────
  const trueOffenders = corpus.filter((entry) => loop.khilafSignal(entry.rows).khilafFromOpinions === true);
  ok('2. khilafSignal(...).khilafFromOpinions is never `true` on any of them',
    trueOffenders.length === 0,
    ascii(trueOffenders.slice(0, 5).map((entry) => entry.id + ' count=' + loop.khilafSignal(entry.rows).opinionCount).join(', ')));
  // ...and it is never `false` either, which is the other half of the same contract: `false` sent
  // out of ignorance SUPPRESSES the notice on a matter that really is disputed.
  const falseOffenders = corpus.filter((entry) => loop.khilafSignal(entry.rows).khilafFromOpinions === false);
  ok('2b. ...and never `false`, which would suppress the notice out of ignorance',
    falseOffenders.length === 0, ascii(falseOffenders.slice(0, 5).map((entry) => entry.id).join(', ')));

  // ── 4. THE COUNT IS ALWAYS A WHOLE NUMBER >= 0 ────────────────────────────
  const countOffenders = corpus.filter((entry) => {
    const count = loop.khilafSignal(entry.rows).opinionCount;
    return !Number.isInteger(count) || count < 0;
  });
  ok('4. opinionCount is an integer >= 0 on every evidence set',
    countOffenders.length === 0,
    ascii(countOffenders.slice(0, 5).map((entry) => entry.id + '=' + JSON.stringify(loop.khilafSignal(entry.rows).opinionCount)).join(', ')));
  ok('4b. ...and the empty set counts zero rather than throwing',
    loop.khilafSignal([]).opinionCount === 0, JSON.stringify(loop.khilafSignal([])));

  // ── 3. THE NEGATIVE WITNESS, WITH THE PROBE INJECTED ──────────────────────
  //
  // Assertions 1 and 2 hold today for a reason that would evaporate the moment somebody fills the
  // probe in: the probe answers null, so nothing downstream is being exercised. The clause that
  // actually protects the reader is the one ABOVE the probe in khilafSignal — one source cannot be
  // two opinions, whatever the probe says. It is proved here by rewriting the probe to return
  // `true` in a twin and running it.
  const singleSourceIds = ['eighteen[0]', 'riba[first]', 'six[0]'];
  const singleSets = corpus.filter((entry) => singleSourceIds.includes(entry.id));
  ok('3. the three named single-source sets were found in the corpus', singleSets.length === 3,
    ascii(singleSets.map((entry) => entry.id).join(', ')));

  const injected = await loopTwin('probe-returns-true',
    (source) => source.replace(PROBE_BODY, '$1true; // injected by khilaf-probe-freeze-guard'));
  ok('3a. the probe-injection seam applied (a moved seam proves nothing)', injected.changed, ascii(injected.error || ''));
  ok('3b. the injected twin loaded', injected.loaded, ascii(injected.error || ''));
  if (injected.loaded) {
    // The injection really took: on a TWO-source set the twin now says `true`, where the real
    // module says null. Without this the next assertion could pass on a twin that changed nothing.
    const twoSource = corpus.find((entry) => entry.id === 'riba[both]');
    ok('3c. the injection is live: the twin reports `true` on a two-source set where the tree reports null',
      injected.module.khilafSignal(twoSource.rows).khilafFromOpinions === true
      && loop.khilafSignal(twoSource.rows).khilafFromOpinions === null,
      'twin=' + JSON.stringify(injected.module.khilafSignal(twoSource.rows))
      + ' tree=' + JSON.stringify(loop.khilafSignal(twoSource.rows)));

    const leaked = singleSets.filter((entry) => injected.module.khilafSignal(entry.rows).khilafFromOpinions === true);
    ok('3d. THE NEGATIVE WITNESS: a single-source set still does not produce `true`, probe or no probe',
      leaked.length === 0, ascii(leaked.map((entry) => entry.id).join(', ')));
    ok('3e. ...and reports null on it -- "I do not know", never "no"',
      singleSets.every((entry) => injected.module.khilafSignal(entry.rows).khilafFromOpinions === null
        && injected.module.khilafSignal(entry.rows).opinionCount === 1),
      ascii(JSON.stringify(singleSets.map((entry) => injected.module.khilafSignal(entry.rows)))));
    if (injected.temp) fs.rmSync(injected.temp, { recursive: true, force: true });
  }

  // 3f — AND THE ASSERTION ABOVE IS LOAD-BEARING. A twin with the probe injected AND the negative
  // witness deleted MUST leak, or 3d was passing on the shape of the data rather than on the
  // clause it names.
  const gutted = await loopTwin('negative-witness-deleted',
    (source) => source
      .replace(PROBE_BODY, '$1true; // injected by khilaf-probe-freeze-guard')
      .replace(NEGATIVE_WITNESS, '$1known ? probed : null; // mutant: the negative witness deleted'));
  ok('3f. the clause-deletion seam applied', gutted.changed, ascii(gutted.error || ''));
  ok('3g. the gutted twin loaded', gutted.loaded, ascii(gutted.error || ''));
  if (gutted.loaded) {
    const leaks = singleSets.filter((entry) => gutted.module.khilafSignal(entry.rows).khilafFromOpinions === true);
    ok('3h. MUTANT KILLED: with the negative witness deleted the single-source set DOES leak `true`',
      leaks.length === singleSets.length,
      ascii(JSON.stringify(singleSets.map((entry) => gutted.module.khilafSignal(entry.rows)))));
    if (gutted.temp) fs.rmSync(gutted.temp, { recursive: true, force: true });
  }

  const code = finish();
  if (code !== 0) {
    console.log('');
    console.log('--------------------------------------------------------------------------');
    console.log('READ THIS BEFORE YOU "FIX" IT.');
    console.log('');
    console.log('khilafFromOpinionsProbe is empty BY MEASUREMENT, not by oversight. Three ways of');
    console.log('filling it were measured against the fatwa set deposited in this tree and all');
    console.log('three failed on the record:');
    console.log('  * a field in the fatwa store      0 of 20 records carry one');
    console.log('  * a tag in the data               0 of 20; every tag names an archive series');
    console.log('  * opinionCount >= 2 as a proxy    fired once, wrong once. 0 correct, 1 false');
    console.log('  * and the opposite reading is worse: "one source means no disagreement"');
    console.log('    contradicts the material in hand on 1 of the 18 single-source records');
    console.log('');
    console.log('Anything put in that body today is a lie the reader is told in their own reply.');
    console.log('Filling it honestly needs a ruling-direction detector, which is an item of its');
    console.log('own and not a line to be added here. If you are building that detector, the');
    console.log('owner signs it off first and this guard moves WITH it -- it does not get');
    console.log('deleted around it.');
    console.log('');
    console.log('The minute of the measurement is in lib/free-brain/loop.js, above the probe.');
    console.log('--------------------------------------------------------------------------');
  }
  process.exit(code);
})().catch((error) => {
  console.error('khilaf-probe-freeze-guard CRASHED: ' + ascii(error && error.stack || error));
  process.exit(1);
});
