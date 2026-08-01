/* prayer-quest-guard.cjs -- PRAYER-CATEGORY GATE for quest-data/trivia-golden.json.
 *
 * WHY THIS GATE EXISTS
 *   Phase 3 rebuilt the prayer category (100 questions) so that every axis of the fiqh of
 *   salah is actually covered, adults are not asked to recite rak'ah counts, and no
 *   contested ruling is presented as though the scholars agreed on it. None of that is
 *   visible in a diff, and all of it is easy to lose. So it is asserted here.
 *
 * OFFLINE. No network. Reads only. Runs beside quest-reveal-guard / quran-quest-guard.
 *
 * DISCIPLINE: ZERO literal Arabic -- the law of quran-guard.cjs and esc.cjs. Every Arabic
 * character is a \uXXXX escape and any Arabic echoed to the terminal is printed as
 * codepoints. Raw Arabic on a Windows console is bidi-reordered, so a guard that prints it
 * lies about which string failed.
 *
 * The character classes below are written out one range at a time on purpose. Collapsing
 * them (or letting a mechanical re-escape merge them) swallows the Arabic letter block and
 * makes every comparison trivially true -- that exact bug shipped into phase 2's guard and
 * was only caught because an assertion that should have failed did not.
 *
 * WHAT IT PROVES
 *   P1  100 prayer questions, ids identical to the golden.
 *   P2  the 2079 questions outside prayer are byte-identical to the golden.
 *   P3  every stem stands up with the choices hidden (reveal mode is the default).
 *   P4  exactly one correct answer: index in range, options distinct.
 *   P5  no adult question is bare recall (rak'ah counts, prayer names, the qibla...).
 *   P6  a contested ruling names who holds it, inside the stem.
 *   P7  every question carries a traceable source.
 *   P8  no verbal or semantic duplication inside the category.
 *   P9  every required axis meets its floor.
 *   P10 band and difficulty are well-formed and mutually consistent.
 *   P11 the three Quran categories are untouched (named subset of P2).
 *   P12 prayer questions that phase 1 fixed still satisfy the reveal criteria.
 *
 * USAGE
 *   node prayer-quest-guard.cjs --emit    > quest-data/prayer-quest-golden.json
 *   node prayer-quest-guard.cjs --compare quest-data/prayer-quest-golden.json
 */
'use strict';
const fs = require('fs');
const crypto = require('crypto');

const BANK = 'quest-data/trivia-golden.json';
const CAT = 'prayer';
const TOTAL = 100;
const OUTSIDE = 2079;
const QURAN_CATS = ['quran', 'juz-amma', 'juz-tabarak'];

// ---------------------------------------------------------------------------
// Arabic literals -- escapes only.
// ---------------------------------------------------------------------------
const QMARK = '\u061F';
const PROCLITIC = ['\u0641', '\u0648', '\u0628', '\u0644'];
const DEICTIC = ['\u0645\u0645\u0627 \u064A\u0644\u064A', '\u0645\u0645\u0651\u0627 \u064A\u0644\u064A', '\u0645\u0645\u0627 \u064A\u0623\u062A\u064A', '\u0641\u064A\u0645\u0627 \u064A\u0644\u064A', '\u0641\u064A\u0645\u0627 \u064A\u0623\u062A\u064A', '\u0645\u0646 \u0627\u0644\u0622\u062A\u064A',
  '\u0645\u0646 \u0627\u0644\u0622\u062A\u064A\u0629', '\u0645\u0646 \u0627\u0644\u062A\u0627\u0644\u064A', '\u0645\u0646 \u0627\u0644\u062A\u0627\u0644\u064A\u0629', '\u0627\u0644\u0622\u062A\u064A\u0629', '\u0627\u0644\u062A\u0627\u0644\u064A\u0629', '\u0627\u0644\u0622\u062A\u064A', '\u0627\u0644\u062A\u0627\u0644\u064A',
  '\u0623\u064A \u0645\u0646 \u0647\u0630\u0647', '\u0623\u064A\u064F\u0651 \u0647\u0630\u0647', '\u0623\u064A \u0645\u0645\u0627', '\u0627\u062E\u062A\u0631 \u0645\u0646', '\u0645\u0646 \u0627\u0644\u062E\u064A\u0627\u0631\u0627\u062A', '\u0627\u0644\u0639\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u062A\u0627\u0644\u064A\u0629'];
const INTERROG = ['\u0645\u0627', '\u0645\u0627\u0630\u0627', '\u0645\u0646', '\u0645\u062A\u0649', '\u0623\u064A\u0646', '\u0643\u064A\u0641', '\u0644\u0645\u0627\u0630\u0627', '\u0647\u0644', '\u0623\u064A', '\u0623\u064A\u0651', '\u0643\u0645',
  '\u0628\u0645', '\u0628\u0645\u0627\u0630\u0627', '\u0641\u064A\u0645\u0646', '\u0639\u0645\u0646', '\u0627\u0630\u0643\u0631', '\u0631\u062A\u0628', '\u0631\u062A\u0651\u0628', '\u0637\u0627\u0628\u0642', '\u0623\u0643\u0645\u0644', '\u0639\u0631\u0651\u0641', '\u0633\u0645\u0651', '\u0628\u0645\u064E'];

/* bare recall -- fine for a child, banned for an adult */
const TRIVIAL = ['\u0643\u0645 \u0639\u062F\u062F \u0627\u0644\u0631\u0643\u0639\u0627\u062A', '\u0643\u0645 \u0639\u062F\u062F \u0631\u0643\u0639\u0627\u062A', '\u0643\u0645 \u0631\u0643\u0639\u0629', '\u0639\u062F\u062F \u0631\u0643\u0639\u0627\u062A\u0647\u0627',
  '\u0643\u0645 \u0639\u062F\u062F \u0627\u0644\u0635\u0644\u0648\u0627\u062A', '\u0645\u0627 \u0627\u0644\u0642\u0628\u0644\u0629', '\u0645\u0627 \u0647\u064A \u0627\u0644\u0642\u0628\u0644\u0629', '\u0627\u0633\u0645 \u0627\u0644\u0646\u062F\u0627\u0621', '\u0645\u0627\u0630\u0627 \u0646\u0642\u0648\u0644 \u0641\u064A \u0627\u0644\u0633\u062C\u0648\u062F',
  '\u0645\u0627\u0630\u0627 \u0646\u0642\u0648\u0644 \u0641\u064A \u0627\u0644\u0631\u0643\u0648\u0639', '\u0645\u0627\u0630\u0627 \u064A\u0642\u0648\u0644 \u0627\u0644\u0645\u0635\u0644\u064A \u0641\u064A \u0633\u062C\u0648\u062F\u0647', '\u0645\u0627\u0630\u0627 \u064A\u0642\u0648\u0644 \u0627\u0644\u0645\u0635\u0644\u064A \u0641\u064A \u0631\u0643\u0648\u0639\u0647',
  '\u0628\u0645\u0627\u0630\u0627 \u0646\u062E\u062A\u0645 \u0627\u0644\u0635\u0644\u0627\u0629', '\u0628\u0645\u0627\u0630\u0627 \u062A\u062E\u062A\u0645 \u0627\u0644\u0635\u0644\u0627\u0629'];

/* the rulings the brief singles out as genuinely disputed */
const CONTESTED = ['\u0645\u0633\u0627\u0641\u0629 \u0627\u0644\u0633\u0641\u0631', '\u0645\u0633\u0627\u0641\u0629 \u0627\u0644\u0642\u0635\u0631', '\u0645\u062F\u0629 \u0627\u0644\u0645\u0633\u062D', '\u0643\u0645 \u0645\u062F\u0629 \u0627\u0644\u0645\u0633\u062D',
  '\u0627\u062F\u0631\u0627\u0643 \u0627\u0644\u0631\u0643\u0639\u0629', '\u0627\u062F\u0631\u0643 \u0627\u0644\u0627\u0645\u0627\u0645 \u0631\u0627\u0643\u0639\u0627', '\u0633\u062C\u0648\u062F \u0627\u0644\u0633\u0647\u0648 \u0642\u0628\u0644 \u0627\u0644\u0633\u0644\u0627\u0645', '\u062D\u0643\u0645 \u0627\u0644\u062A\u0634\u0647\u062F \u0627\u0644\u0627\u0648\u0644',
  '\u0633\u062C\u0648\u062F \u0627\u0644\u062A\u0644\u0627\u0648\u0629', '\u0627\u0644\u062C\u0645\u0639 \u0628\u064A\u0646 \u0627\u0644\u0635\u0644\u0627\u062A\u064A\u0646', '\u062D\u0643\u0645 \u0627\u0644\u062C\u0645\u0639', '\u0627\u0644\u0642\u0647\u0642\u0647\u0629', '\u0628\u064A\u0648\u062A\u0647\u0646',
  '\u0627\u0633\u062A\u062A\u0645 \u0642\u0627\u0626\u0645\u0627', '\u064A\u0628\u062F\u0627 \u0627\u0644\u0645\u0633\u0627\u0641\u0631 \u0641\u064A \u0642\u0635\u0631'];
/* naming a holder -- any one of these satisfies P6 */
const ATTRIB = ['\u062C\u0645\u0647\u0648\u0631', '\u0627\u0644\u062C\u0645\u0647\u0648\u0631', '\u0627\u0644\u062D\u0646\u0627\u0628\u0644\u0629', '\u0627\u0644\u062D\u0646\u0641\u064A\u0629', '\u0627\u0644\u0634\u0627\u0641\u0639\u064A\u0629', '\u0627\u0644\u0645\u0627\u0644\u0643\u064A\u0629',
  '\u0627\u0644\u0645\u0630\u0627\u0647\u0628 \u0627\u0644\u0627\u0631\u0628\u0639\u0629', '\u0639\u0646\u062F \u0627\u0644\u062D\u0646\u0627\u0628\u0644\u0629', '\u0641\u064A \u0627\u0644\u0645\u0630\u0647\u0628', '\u0627\u0628\u0646 \u0642\u062F\u0627\u0645\u0629', '\u0627\u0628\u064A \u0633\u0639\u064A\u062F', '\u0627\u0628\u0646 \u0645\u0633\u0639\u0648\u062F'];
/* over-claims that need explicit proof; bare "the scholars agreed" is not allowed */
const OVERCLAIM = ['\u0627\u062A\u0641\u0642 \u0627\u0644\u0639\u0644\u0645\u0627\u0621', '\u0628\u0627\u062C\u0645\u0627\u0639 \u0627\u0644\u0639\u0644\u0645\u0627\u0621', '\u0628\u0627\u0644\u0627\u062C\u0645\u0627\u0639'];

const GOOD_SRC = ['\u0635\u062D\u064A\u062D \u0627\u0644\u0628\u062E\u0627\u0631\u064A', '\u0635\u062D\u064A\u062D \u0645\u0633\u0644\u0645', '\u0627\u0644\u0628\u062E\u0627\u0631\u064A', '\u0645\u0633\u0644\u0645', '\u0633\u0646\u0646', '\u0645\u0633\u0646\u062F', '\u0645\u0633\u062A\u062F\u0631\u0643',
  '\u0627\u0644\u062A\u0631\u0645\u0630\u064A', '\u0627\u0628\u064A \u062F\u0627\u0648\u062F', '\u0627\u0628\u0646 \u0645\u0627\u062C\u0647', '\u0627\u0644\u0646\u0633\u0627\u0626\u064A', '\u0627\u0644\u0645\u063A\u0646\u064A', '\u0627\u0628\u0646 \u0642\u062F\u0627\u0645\u0629', '\u0628\u062F\u0627\u064A\u0629 \u0627\u0644\u0645\u062C\u062A\u0647\u062F',
  '\u0627\u0628\u0646 \u0631\u0634\u062F', '\u0627\u0644\u0642\u0631\u0622\u0646 \u0627\u0644\u0643\u0631\u064A\u0645', '\u0627\u0644\u0641\u0642\u0647 \u0627\u0644\u0645\u064A\u0633\u0631', '\u0627\u0644\u0641\u0642\u0647 \u0627\u0644\u0627\u0633\u0644\u0627\u0645\u064A', '\u0645\u062A\u0641\u0642', '\u0645\u062A\u0651\u0641\u0642',
  '\u0645\u062F\u0627\u0631\u062C \u0627\u0644\u0633\u0627\u0644\u0643\u064A\u0646', '\u0627\u0644\u062F\u0631\u0631 \u0627\u0644\u0633\u0646\u064A\u0629'];

// ---------------------------------------------------------------------------
const STRIP_MARKS = new RegExp('[' + '\\u064B-\\u0652' + '\\u0670' + '\\u0640' + ']', 'g');
const ALIF = new RegExp('[' + '\\u0623\\u0625\\u0622\\u0671' + ']', 'g');
const NON_AR = new RegExp('[^' + '\\u0621-\\u064A' + '0-9a-zA-Z' + ']+', 'g');
const flat = (s) => String(s || '').replace(STRIP_MARKS, '').replace(ALIF, '\u0627')
  .replace(/\u0649/g, '\u064A').replace(/\u0629/g, '\u0647')
  .replace(NON_AR, ' ').trim();
const cp = (s) => [...String(s)].map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');

function load(f) {
  if (!fs.existsSync(f)) { console.error('ABORT: not found: ' + f); process.exit(2); }
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { console.error('ABORT: bad JSON ' + f + ' -- ' + e.message); process.exit(2); }
}
const stemOf = (q) => (q.type === 'complete' ? String(q.verse || '') : String(q.q || ''));
const optsOf = (q) => q.type === 'mcq' ? (q.choices || []) : q.type === 'complete' ? (q.bank || [])
  : q.type === 'order' ? (q.items || []) : [];
const ansOf = (q) => q.type === 'mcq' ? (q.choices || [])[q.answer]
  : q.type === 'complete' ? (q.bank || [])[q.answer]
  : q.type === 'tf' ? 'TF' : q.type === 'order' ? 'ORDER' : '';

/* ---- axes (mirrors the phase-3 builder). Stem decides; the explanation only breaks a
        tie. Distractors never classify anything: a wrong option that mentions sujud
        al-sahw must not file an invalidators question under sahw. ---- */
const AXES = ['PILLARS', 'PURITY', 'TRAVEL', 'SAHW', 'EXCUSED', 'INVALIDATORS', 'CONGREGATION', 'BASICS'];
const FLOOR = { PILLARS: 15, PURITY: 10, TRAVEL: 8, SAHW: 8, EXCUSED: 8, INVALIDATORS: 8, CONGREGATION: 8 };
function axisOf(b) {
  const has = (...w) => w.some((x) => b.includes(flat(x)));
  if (has('\u0633\u062C\u0648\u062F \u0627\u0644\u0633\u0647\u0648', '\u0633\u0647\u0648', '\u0627\u0644\u0634\u0643 \u0641\u064A \u0639\u062F\u062F', '\u0634\u0643 \u0627\u0644\u0645\u0635\u0644\u064A', '\u0632\u0627\u062F \u0631\u0643\u0639\u0629', '\u0646\u0642\u0635 \u0631\u0643\u0639\u0629', '\u0646\u0633\u064A \u0627\u0644\u062A\u0634\u0647\u062F', '\u0627\u0644\u0628\u0646\u0627\u0621 \u0639\u0644\u0649 \u0627\u0644\u064A\u0642\u064A\u0646', '\u0627\u0644\u062A\u062D\u0631\u064A')) return 'SAHW';
  if (has('\u0645\u0631\u064A\u0636', '\u0627\u0644\u0645\u0631\u064A\u0636', '\u0645\u0631\u064A\u0636\u0627', '\u0627\u0644\u0645\u0631\u0636', '\u0627\u0644\u0639\u0627\u062C\u0632', '\u0627\u0644\u0639\u062C\u0632', '\u0645\u0633\u062A\u062D\u0627\u0636\u0647', '\u0627\u0644\u0627\u0633\u062A\u062D\u0627\u0636\u0647', '\u0642\u0627\u0639\u062F\u0627', '\u062C\u0627\u0644\u0633\u0627',
    '\u0645\u0636\u0637\u062C\u0639\u0627', '\u0639\u0644\u0649 \u062C\u0646\u0628', '\u0633\u0644\u0633', '\u0635\u0627\u062D\u0628 \u0627\u0644\u0639\u0630\u0631', '\u0627\u0635\u062D\u0627\u0628 \u0627\u0644\u0627\u0639\u0630\u0627\u0631', '\u0627\u0644\u0627\u064A\u0645\u0627\u0621', '\u064A\u0648\u0645\u0626', '\u0644\u0627 \u064A\u0633\u062A\u0637\u064A\u0639 \u0627\u0644\u0642\u064A\u0627\u0645', '\u0644\u0627 \u064A\u0642\u062F\u0631 \u0639\u0644\u0649')) return 'EXCUSED';
  if (has('\u0627\u0644\u0645\u0633\u0627\u0641\u0631', '\u0627\u0644\u0633\u0641\u0631', '\u0627\u0644\u0642\u0635\u0631', '\u0642\u0635\u0631 \u0627\u0644\u0635\u0644\u0627\u0629', '\u0627\u0644\u062C\u0645\u0639 \u0628\u064A\u0646', '\u062C\u0645\u0639 \u062A\u0642\u062F\u064A\u0645', '\u062C\u0645\u0639 \u062A\u0627\u062E\u064A\u0631', '\u0645\u0633\u0627\u0641\u0629')) return 'TRAVEL';
  if (has('\u0627\u0644\u0645\u0633\u0628\u0648\u0642', '\u0627\u062F\u0631\u0627\u0643 \u0627\u0644\u0631\u0643\u0639\u0647', '\u0627\u062F\u0631\u0643 \u0627\u0644\u0631\u0643\u0648\u0639', '\u0635\u0644\u0627\u0647 \u0627\u0644\u062C\u0645\u0627\u0639\u0647', '\u0627\u0644\u062C\u0645\u0627\u0639\u0647', '\u0627\u0644\u062C\u0645\u0639\u0647', '\u062E\u0644\u0641 \u0627\u0644\u0627\u0645\u0627\u0645',
    '\u0645\u0639 \u0627\u0644\u0627\u0645\u0627\u0645', '\u0627\u0644\u0645\u0627\u0645\u0648\u0645', '\u0627\u0644\u0635\u0641\u0648\u0641', '\u0627\u0644\u062E\u0637\u0628\u0647', '\u062E\u0637\u0628\u062A\u0627\u0646', '\u0628\u064A\u0648\u062A\u0647\u0646', '\u0635\u0644\u0627\u0647 \u0627\u0644\u0645\u0631\u0627\u0647')) return 'CONGREGATION';
  if (has('\u064A\u0628\u0637\u0644', '\u062A\u0628\u0637\u0644', '\u0645\u0628\u0637\u0644\u0627\u062A', '\u0645\u0641\u0633\u062F\u0627\u062A', '\u0627\u0628\u0637\u0644', '\u0645\u0643\u0631\u0648\u0647', '\u064A\u0643\u0631\u0647', '\u0627\u0644\u0645\u0643\u0631\u0648\u0647\u0627\u062A', '\u0627\u0644\u0642\u0647\u0642\u0647\u0647', '\u0627\u0644\u0627\u0643\u0644 \u0648\u0627\u0644\u0634\u0631\u0628')) return 'INVALIDATORS';
  if (has('\u0627\u0644\u0648\u0636\u0648\u0621', '\u0627\u0644\u062A\u064A\u0645\u0645', '\u0627\u0644\u0637\u0647\u0627\u0631\u0647', '\u0646\u0648\u0627\u0642\u0636', '\u0627\u0644\u0645\u0633\u062D \u0639\u0644\u0649 \u0627\u0644\u062E\u0641\u064A\u0646', '\u0627\u0644\u063A\u0633\u0644', '\u0627\u0644\u0646\u062C\u0627\u0633\u0647', '\u0637\u0647\u0648\u0631', '\u0627\u0644\u062D\u062F\u062B')) return 'PURITY';
  if (has('\u0631\u0643\u0646', '\u0627\u0631\u0643\u0627\u0646', '\u0648\u0627\u062C\u0628', '\u0648\u0627\u062C\u0628\u0627\u062A', '\u0633\u0646\u0647', '\u0633\u0646\u0646', '\u0634\u0631\u0637', '\u0634\u0631\u0648\u0637', '\u0627\u0644\u0637\u0645\u0627\u0646\u064A\u0646\u0647', '\u0627\u0644\u062A\u0634\u0647\u062F', '\u062A\u0643\u0628\u064A\u0631\u0647 \u0627\u0644\u0627\u062D\u0631\u0627\u0645', '\u0627\u0644\u0641\u0627\u062A\u062D\u0647', '\u0627\u0644\u0627\u0639\u062A\u062F\u0627\u0644', '\u0627\u0644\u062A\u0631\u062A\u064A\u0628')) return 'PILLARS';
  return 'BASICS';
}
function classify(q) {
  const s = axisOf(flat(stemOf(q)));
  if (s !== 'BASICS') return s;
  return axisOf(flat([stemOf(q), q.why].filter(Boolean).join(' ')));
}

// ---------------------------------------------------------------------------
function fingerprint(q) {
  return crypto.createHash('sha256').update(JSON.stringify(q, Object.keys(q).sort())).digest('hex').slice(0, 16);
}
function emit() {
  const d = load(BANK);
  const outside = {};
  d.questions.forEach((q) => { if (q.cat !== CAT) outside[q.id] = fingerprint(q); });
  process.stdout.write(JSON.stringify({
    schema: 'prayer-quest-golden/v1',
    note: 'ids of the prayer category (identity frozen, content free to improve) plus fingerprints of every question OUTSIDE it, frozen byte-for-byte.',
    total: d.questions.length,
    prayerIds: d.questions.filter((q) => q.cat === CAT).map((q) => q.id).sort(),
    quranIds: d.questions.filter((q) => QURAN_CATS.includes(q.cat)).map((q) => q.id).sort(),
    outside,
  }, null, 2) + '\n');
}

function compare(goldenFile) {
  const d = load(BANK);
  const golden = load(goldenFile);
  let hard = 0;
  const fail = (code, id, msg) => { hard++; console.log('  FAIL [' + code + '] ' + id + ' -- ' + msg); };

  const qs = d.questions.filter((q) => q.cat === CAT);
  console.log('=== prayer-quest-guard ===');
  console.log('bank: ' + BANK + '   prayer questions: ' + qs.length);

  /* P1 */
  if (qs.length !== TOTAL) fail('P1', '(all)', 'expected ' + TOTAL + ' prayer questions, found ' + qs.length);
  const ids = qs.map((q) => q.id).sort(), gids = (golden.prayerIds || []).slice().sort();
  gids.filter((i) => !ids.includes(i)).forEach((i) => fail('P1', i, 'prayer id disappeared'));
  ids.filter((i) => !gids.includes(i)).forEach((i) => fail('P1', i, 'prayer id appeared that the golden does not know'));

  qs.forEach((q) => {
    const id = q.id, stem = stemOf(q), opts = optsOf(q), fstem = flat(stem);

    /* P3 works with the choices hidden */
    if (fstem.length < 12) fail('P3', id, 'stem too short to stand alone');
    const isTF = q.type === 'tf' || (q.type === 'mcq' && opts.length === 2);
    if (q.type !== 'complete' && !isTF) {
      const words = fstem.split(' ');
      const asks = /[\u061F:\uFF1A]\s*$/.test(String(stem).trim()) || INTERROG.some((w) => {
        const t = flat(w);
        return words.some((x) => x === t || (PROCLITIC.includes(x[0]) && x.slice(1) === t));
      });
      if (!asks) fail('P3', id, 'stem neither ends in a question mark nor carries an interrogative');
    }
    DEICTIC.forEach((p) => { if (fstem.includes(flat(p))) fail('P3', id, 'points at an unseen list: ' + cp(p)); });
    const fa = flat(ansOf(q));
    if (q.type !== 'complete' && fa && fa.length > 3 && fstem.includes(fa))
      fail('P3', id, 'stem contains the answer verbatim');

    /* P4 exactly one correct answer */
    if (q.type === 'mcq' || q.type === 'complete') {
      if (opts.length < 2) fail('P4', id, 'fewer than two options');
      if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= opts.length)
        fail('P4', id, 'answer index out of range');
      const seen = new Map();
      opts.forEach((o, i) => {
        const k = flat(o);
        if (!k) fail('P4', id, 'blank option at ' + i);
        if (seen.has(k)) fail('P4', id, 'options ' + seen.get(k) + ' and ' + i + ' are the same');
        seen.set(k, i);
      });
    }

    /* P5 no bare recall aimed at adults */
    if (q.band === 'adult') {
      if (q.diff === 1) fail('P5', id, 'an adult question tiered at difficulty 1');
      TRIVIAL.forEach((t) => { if (fstem.includes(flat(t))) fail('P5', id, 'bare recall put to an adult: ' + cp(t)); });
    }

    /* P6 a contested ruling must name who holds it, in the stem */
    const hits = CONTESTED.filter((t) => fstem.includes(flat(t)));
    if (hits.length && !ATTRIB.some((a) => fstem.includes(flat(a))))
      fail('P6', id, 'contested ruling with no holder named in the stem: ' + cp(hits[0]));
    OVERCLAIM.forEach((o) => {
      if (flat([q.q, q.why].filter(Boolean).join(' ')).includes(flat(o)))
        fail('P6', id, 'claims consensus without qualification: ' + cp(o));
    });

    /* P7 traceable source */
    const src = String(q.src || '');
    if (!src.trim()) fail('P7', id, 'no src');
    else if (!GOOD_SRC.some((g) => flat(src).includes(flat(g))))
      fail('P7', id, 'src is not traceable: ' + cp(src.slice(0, 36)));

    /* P10 band / difficulty well-formed */
    if (!['young', 'teen', 'adult'].includes(q.band)) fail('P10', id, 'bad band ' + q.band);
    if (![1, 2, 3].includes(q.diff)) fail('P10', id, 'bad diff ' + q.diff);
    if (q.band === 'young' && q.diff === 3) fail('P10', id, 'a young question tiered at difficulty 3');
  });

  /* P8 duplication */
  const STOP = new Set(flat('\u0641\u064A \u0645\u0646 \u0645\u0627 \u0647\u0648 \u0647\u064A \u0627\u0644\u062A\u064A \u0627\u0644\u0630\u064A \u0639\u0644\u0649 \u0639\u0646 \u0627\u0644\u0644\u0647 \u0643\u0627\u0646 \u0645\u0627\u0630\u0627 \u0643\u064A\u0641 \u0627\u064A\u0646 \u0645\u062A\u0649 \u0647\u0644 \u0627\u064A \u0643\u0645 \u0642\u0627\u0644 \u0627\u0644\u0646\u0628\u064A \u0635\u0644\u0627\u0629 \u0627\u0644\u0635\u0644\u0627\u0629 \u0648\u0645\u0627 \u0648\u0647\u0648 \u0627\u0646\u0647 \u0627\u0630\u0627').split(' '));
  const tok = (q) => new Set(flat(stemOf(q)).split(' ').filter((w) => w.length > 2 && !STOP.has(w)));
  for (let i = 0; i < qs.length; i++) for (let j = i + 1; j < qs.length; j++) {
    const a = flat(String(ansOf(qs[i]))), b = flat(String(ansOf(qs[j])));
    if (!a || a !== b || a === 'TF' || a === 'ORDER') continue;
    const A = tok(qs[i]), B = tok(qs[j]);
    let inter = 0; A.forEach((x) => { if (B.has(x)) inter++; });
    const jac = inter / (A.size + B.size - inter || 1);
    if (jac >= 0.30 && inter >= 3)
      fail('P8', qs[i].id + ' + ' + qs[j].id, 'same answer and ' + Math.round(jac * 100) + '% stem overlap');
  }

  /* P9 axis floors */
  console.log('\n-- axis coverage --');
  const dist = {}; qs.forEach((q) => { const a = classify(q); dist[a] = (dist[a] || 0) + 1; });
  AXES.forEach((a) => {
    const n = dist[a] || 0, f = FLOOR[a] || 0;
    console.log('  ' + a.padEnd(14) + String(n).padStart(4) + (f ? '   floor ' + f + (n < f ? '  SHORT' : '  ok') : ''));
    if (n < f) fail('P9', a, 'axis has ' + n + ' questions, floor is ' + f);
  });

  /* P2 + P11 nothing outside prayer moved */
  const out = golden.outside || {};
  let moved = 0, quranMoved = 0;
  d.questions.forEach((q) => {
    if (q.cat === CAT) return;
    if (!(q.id in out)) { moved++; fail('P2', q.id, 'question outside prayer is not in the golden'); return; }
    if (out[q.id] !== fingerprint(q)) {
      moved++;
      if (QURAN_CATS.includes(q.cat)) { quranMoved++; fail('P11', q.id, 'a Quran-category question was edited'); }
      else fail('P2', q.id, 'a question outside prayer was edited');
    }
  });
  Object.keys(out).forEach((id) => {
    if (!d.questions.some((q) => q.id === id)) { moved++; fail('P2', id, 'question vanished from the bank'); }
  });
  const outsideCount = d.questions.filter((q) => q.cat !== CAT).length;
  if (outsideCount !== OUTSIDE) fail('P2', '(all)', 'expected ' + OUTSIDE + ' questions outside prayer, found ' + outsideCount);
  if (!moved) console.log('\n  ' + Object.keys(out).length + ' questions outside prayer byte-identical (' +
    (golden.quranIds || []).length + ' of them Quran-category)');
  if (golden.total !== d.questions.length) fail('P2', '(all)', 'bank size changed');

  /* P12 the prayer questions phase 1 rewrote still satisfy the reveal criteria.
     Those criteria are P3 above; this line records that the subset was covered. */
  const P1_IDS = ['salah-0007', 'salah-0014', 'gemini2-prayer-005', 'gemini2-prayer-020', 'gemini-prayer-b3-009'];
  P1_IDS.forEach((id) => { if (!qs.some((q) => q.id === id)) fail('P12', id, 'phase-1 prayer question missing'); });

  console.log('\nhard=' + hard + ' soft=0');
  console.log(hard === 0
    ? '=== PASS: prayer is covered on every axis, sourced, attributed and unduplicated. ==='
    : '=== FAIL: DO NOT COMMIT. ===');
  process.exit(hard === 0 ? 0 : 1);
}

const [, , mode, a1] = process.argv;
if (mode === '--emit') emit();
else if (mode === '--compare') compare(a1 || 'quest-data/prayer-quest-golden.json');
else {
  console.error('usage: node prayer-quest-guard.cjs --emit    > quest-data/prayer-quest-golden.json');
  console.error('       node prayer-quest-guard.cjs --compare quest-data/prayer-quest-golden.json');
  process.exit(2);
}
