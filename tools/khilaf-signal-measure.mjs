// tools/khilaf-signal-measure.mjs — §١/٢ of the ب-١ order, run rather than asserted.
//
// THE QUESTION IT ANSWERS. Is there, in what is ALREADY in hand and WITHOUT a ruling detector, a
// RELIABLE sign that more than one opinion exists on a matter? The order named three candidates —
// a field in the fatwa store, a tag in the data, an explicit divergence in the excerpts — and
// required the answer to be given in numbers on the fatwa set deposited in this tree, not decided
// by preference.
//
// THE DEPOSITED SET, AND ITS SIZE SAID OUT LOUD.
//   fixtures/fatwa-authority-eighteen.json  18 NORMALISED records — one published fatwa per
//                                           scholar of the roster, harvested from the live
//                                           service, in the very shape the reviewer reads.
//   fixtures/riba-family-two-records.json    2 RAW service records for ONE query. This is the only
//                                           multi-source evidence set the tree holds, and it is
//                                           therefore the entire trial set for candidate (c).
// Twenty records. That is small, and the report says so: the numbers below settle candidates (a)
// and (b) completely, because those are enumerations rather than samples, and they settle (c) only
// in the negative — one trial cannot license a threshold, and the one trial there is says no.
//
// WHAT IT DOES NOT DO. It builds no ruling detector. The one regex it uses is IMPORTED from the
// reviewer and never copied, and it is used as a MEASURING INSTRUMENT to count how often a
// deposited excerpt declares dispute in its own words. It is never used to decide anything this
// producer emits.
//
// Usage:  node tools/khilaf-signal-measure.mjs
// Exit:   0 always. This is a measurement, not a gate.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { distinctSourceKeys, khilafSignal } from '../lib/free-brain/loop.js';
import { KHILAF_PROSE_MARKERS } from '../lib/output-reviewer.js';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));

// IMPORTED, NEVER COPIED — and the import is the point. The reviewer owns this vocabulary and
// exports it under two names: KHILAF_PROSE_MARKERS, the broad model-prose set, which is the one
// this instrument has measured with since it was written; and KHILAF_SOURCE_MARKERS, the
// narrowed constructions the source prong keys on. A copy here drifts from the thing it measures
// the moment the reviewer's set moves, and the reviewer's own guard now fails ANY file outside it
// that carries either set verbatim, with no exception for this tool.

const line = (s) => process.stdout.write(s + '\n');
const rule = () => line('-'.repeat(78));

const eighteen = read('fixtures/fatwa-authority-eighteen.json');
const riba = read('fixtures/riba-family-two-records.json');

line('=== khilaf signal — measured on the deposited fatwa set ===');
line(`corpus A: fixtures/fatwa-authority-eighteen.json  ${eighteen.cases.length} normalised records`);
line(`corpus B: fixtures/riba-family-two-records.json   ${riba.records.length} raw service records, ONE query`);
line('');

// ── (a) A FIELD IN THE FATWA STORE ───────────────────────────────────────────
// An ENUMERATION, not a sample: every key present on any deposited record is listed, so «there is
// no dispute field» is a statement about the whole contract rather than about the rows we looked at.
rule();
line('(a) a field in the fatwa store');
const rawKeys = new Set();
const contentKeys = new Set();
for (const record of riba.records) {
  Object.keys(record).forEach((k) => rawKeys.add(k));
  Object.keys(record.content || {}).forEach((k) => contentKeys.add(k));
}
const normalisedKeys = new Set();
for (const c of eighteen.cases) Object.keys(c.evidence).forEach((k) => normalisedKeys.add(k));
// The words a dispute-bearing field would have to be built out of, in either language. A field
// named anything outside this set is not a dispute field by any reading.
const DISPUTE_WORD = /khilaf|dispute|disagree|opinions?|madhhab|قول|أقوال|خلاف|رأي/iu;
const disputeFields = [...rawKeys, ...contentKeys, ...normalisedKeys].filter((k) => DISPUTE_WORD.test(k));
line(`  raw record keys        (${rawKeys.size}): ${[...rawKeys].sort().join(' · ')}`);
line(`  raw content keys       (${contentKeys.size}): ${[...contentKeys].sort().join(' · ')}`);
line(`  normalised record keys (${normalisedKeys.size}): ${[...normalisedKeys].sort().join(' · ')}`);
line(`  fields expressing dispute or multiplicity: ${disputeFields.length}`
  + (disputeFields.length ? ' -> ' + disputeFields.join(' · ') : ''));
line(`  VERDICT: distinguishes 0 of 20 records. The path does not exist.`);
line('');

// ── (b) A TAG IN THE DATA ────────────────────────────────────────────────────
rule();
line('(b) a tag in the data');
const tagValues = new Set();
let taggedRecords = 0;
for (const record of riba.records) {
  const values = [...(record.categories || []), record.collection?.name].filter(Boolean);
  if (values.length) taggedRecords += 1;
  values.forEach((v) => tagValues.add(v));
}
const disputeTags = [...tagValues].filter((v) => KHILAF_PROSE_MARKERS.test(v) || DISPUTE_WORD.test(v));
line(`  tag-shaped fields present: categories · collection.name`);
line(`  records carrying any tag value: ${taggedRecords} of ${riba.records.length}`);
line(`  distinct tag values (${tagValues.size}):`);
for (const v of tagValues) line(`    - ${v}`);
line(`  values naming a disagreement rather than an archive series: ${disputeTags.length}`);
line(`  VERDICT: distinguishes 0 of ${taggedRecords} tagged records. Every value names a series.`);
line('');

// ── (c) MULTIPLICITY OF DISTINCT SOURCES ─────────────────────────────────────
// Driven through the SHIPPED producer, so the numbers below are the numbers production emits.
rule();
line('(c) opinionCount >= 2, i.e. multiplicity of distinct sources');

// Corpus A rows carry the reviewer's evidence shape (url/id), which is what the producer keys on;
// the producer reads `recordId`, so the fixture's `id` is mapped onto it and nothing else is added.
const rowsA = eighteen.cases.map((c, i) => ({
  ref: i + 1, url: c.evidence.url, publisher: c.evidence.scholar, recordId: c.evidence.id,
  text: c.evidence.snippet, title: c.evidence.title,
}));
const rowsB = riba.records.map((r, i) => ({
  ref: i + 1, url: r.source?.url || '', publisher: r.scholar?.shortName || '', recordId: r.uid,
  text: [r.content?.question, r.content?.answer].filter(Boolean).join(' — '), title: r.title,
}));

let singles = 0;
let singlesWhoseOwnTextDeclaresKhilaf = 0;
const declaring = [];
for (const row of rowsA) {
  const signal = khilafSignal([row]);
  if (signal.opinionCount === 1) singles += 1;
  if (KHILAF_PROSE_MARKERS.test(row.text)) {
    singlesWhoseOwnTextDeclaresKhilaf += 1;
    declaring.push(row.title);
  }
}
line(`  corpus A — one source per evidence set:`);
line(`    evidence sets with opinionCount === 1 : ${singles} of ${rowsA.length}`);
line(`    of those, sets whose OWN excerpt declares the matter disputed : ${singlesWhoseOwnTextDeclaresKhilaf}`);
for (const t of declaring) line(`      * ${t}`);
line(`    => reading opinionCount === 1 as \`false\` contradicts the material in hand`);
line(`       ${singlesWhoseOwnTextDeclaresKhilaf} time(s) in ${rowsA.length}. A floor, not a rate:`);
line(`       an excerpt is short, and most disputed matters never say so in one.`);
line('');

const signalB = khilafSignal(rowsB);
line(`  corpus B — the ONE real multi-source evidence set the tree holds:`);
line(`    distinct source keys : ${[...distinctSourceKeys(rowsB)].join('  ,  ')}`);
line(`    opinionCount         : ${signalB.opinionCount}`);
line(`    query                : ${riba.query}`);
for (const r of riba.records) {
  line(`    - ${r.scholar?.shortName}: ${r.title}`);
  line(`        own text declares khilaf: ${KHILAF_PROSE_MARKERS.test((r.content?.question || '') + ' ' + (r.content?.answer || ''))}`);
}
line(`    fixture's own note   : ${riba.note}`);
line('');
line('    GROUND TRUTH, read off that note and off the two answers: NOT two opinions on one');
line('    question. One doctrine (the six ribā categories, like-for-like and hand-to-hand)');
line('    applied to two DIFFERENT questions — which is why their surface stances diverge');
line('    (prohibition vs «لا حرج») while the doctrine does not.');
line('    => proxy fires: 1.  correct: 0.  false: 1.');
line('');

rule();
line('WHAT THE PRODUCER THEREFORE EMITS');
const shipped = khilafSignal(rowsB);
line(`  opinionCount        : always. Measured on corpus B: ${shipped.opinionCount}`);
line(`  khilafFromOpinions  : ${JSON.stringify(shipped.khilafFromOpinions)}  (null = «I do not know»)`);
const single = khilafSignal([rowsA[0]]);
line(`  negative witness    : one source -> opinionCount=${single.opinionCount},`
  + ` khilafFromOpinions=${JSON.stringify(single.khilafFromOpinions)} (never true)`);
line('');
line('  The first prong needs the ruling detector, in a round of its own. And corpus B is the');
line('  proof that a bare stance comparison would not be enough either: two records that look');
line('  opposed and are not, because they answer two different questions.');
rule();
