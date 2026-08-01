/* quest-content-review-guard.cjs -- CONTENT-REVIEW GATE for the question bank.
 *
 * WHY THIS GATE EXISTS
 *   Gate 17 proves the bank is structurally sound. This one proves the phase-5
 *   content review actually covers it, and freezes the result: every one of the
 *   1785 non-protected questions is accounted for in
 *   quest-data/content-review-manifest.json, with a fingerprint, a locating
 *   source, and an honest statement of what was done to it.
 *
 *   The manifest deliberately does NOT claim that all 1785 were individually
 *   fact-checked, because they were not. It records four levels -- authored,
 *   fact-read, sourced, structural -- and this gate enforces that every question
 *   carries one of them and that its fingerprint still matches. A later pass that
 *   promotes `structural` questions to `fact-read` edits the manifest deliberately;
 *   it cannot happen by accident, and it cannot be faked by leaving questions out.
 *
 * OFFLINE. No network. Reads only.
 *
 * DISCIPLINE: zero literal Arabic in this file -- same law as quran-guard.cjs and
 * quest-bank-integrity-guard.cjs. Every Arabic character is a \uXXXX escape, and
 * anything echoed to the terminal is printed as codepoints, because bidi reordering
 * makes a raw-Arabic failure message lie about what actually failed.
 *
 * WHAT IT PROVES
 *   C1 coverage    -- every non-protected question has exactly one manifest entry,
 *                     and the manifest has no entry for a question that is gone.
 *   C2 fingerprint -- each entry's sha256 still matches the live question, so no
 *                     question was edited after it was reviewed.
 *   C3 sources     -- non-empty, not a "to be reviewed" or hearsay marker, not a
 *                     bare hostname, and carrying a locator INSIDE the named work.
 *   C4 one answer  -- per type: the answer exists, is in range, is of the right JS
 *                     type, and the key is a non-empty option.
 *   C5 no dupes    -- no two questions in a category share a content signature
 *                     (stem + answer key +, for tf, the why) beyond the pairs the
 *                     manifest adjudicates. This is the check that finally sees
 *                     tf/mcq pairs and inverse pairs.
 *   C6 protected   -- the 394 protected questions are absent from the manifest and
 *                     still match the hashes gate 17 pinned to commit 17bb52a.
 *   C7 identity    -- count, ids and categories agree with the manifest.
 *   C8 no unknowns -- every entry carries a known review level; none is blank.
 *
 * USAGE
 *   node quest-content-review-guard.cjs --compare quest-data/content-review-manifest.json
 */
'use strict';
const fs = require('fs');
const crypto = require('crypto');

const BANK = 'quest-data/trivia-golden.json';
const INTEGRITY_GOLDEN = 'quest-data/bank-integrity-golden.json';
const PROTECTED_CATS = ['quran', 'juz-amma', 'juz-tabarak', 'prayer'];
const LEVELS = ['authored', 'fact-read', 'sourced', 'structural'];

// --- Arabic, escapes only ---------------------------------------------------
const AR_YURAJA = '\u064a\u0631\u0627\u062c\u0639';     // yuraja' -- "to be reviewed"
const AR_MASHHUR = '\u0645\u0634\u0647\u0648\u0631';    // mashhur -- "well known"
const STOPWORDS = ['\u0645\u0627', '\u0647\u0648', '\u0647\u064a', '\u0645\u0646', '\u0641\u064a', '\u0639\u0644\u064a',
  '\u0627\u0644\u0630\u064a', '\u0627\u0644\u062a\u064a', '\u0639\u0646', '\u0627\u0644\u064a', '\u0647\u0630\u0627', '\u0647\u0630\u0647',
  '\u0627\u0646', '\u0627\u0648', '\u0643\u0627\u0646', '\u0642\u0627\u0644', '\u0627\u0644\u0646\u0628\u064a', '\u0631\u0633\u0648\u0644',
  '\u0627\u0644\u0644\u0647', '\u0639\u0644\u064a\u0647', '\u0648\u0633\u0644\u0645', '\u0647\u0644', '\u0645\u0639', '\u0628\u0639\u062f',
  '\u0642\u0628\u0644', '\u0643\u0644', '\u0639\u0646\u062f', '\u0644\u0647', '\u0628\u0647\u0627', '\u0628\u0647', '\u0644\u0627',
  '\u062b\u0645', '\u0642\u062f', '\u064a\u0627', '\u0627\u064a', '\u0643\u0645', '\u0644\u0645\u0627\u0630\u0627',
  '\u0643\u064a\u0641', '\u0627\u064a\u0646', '\u0645\u062a\u064a', '\u0645\u0627\u0630\u0627', '\u0628\u064a\u0646', '\u0627\u0644\u0627',
  '\u0627\u0630\u0627', '\u0627\u0644\u0633\u0644\u0627\u0645', '\u062a\u0639\u0627\u0644\u064a', '\u0639\u0632', '\u0648\u062c\u0644',
  '\u0631\u0636\u064a', '\u0639\u0646\u0647', '\u0639\u0646\u0647\u0627', '\u0639\u0644\u064a\u0647\u0627', '\u0639\u0644\u064a\u0647\u0645'];

// A citation locates something if it carries a number, a sub-reference after an
// em- or en-dash, or a \u00abquoted entry title\u00bb.
const LOCATOR = /[0-9\u0660-\u0669]|[\u2014\u2013]\s*\S|\u00ab[^\u00bb]+\u00bb/;

// Must fold EXACTLY as quest-bank-integrity-guard.cjs does. Subscripts and
// superscripts survive as digits, otherwise "H\u2082O" and "HO" sign differently
// and two chemistry questions look like duplicates of each other.
const TASHKEEL = /[\u064b-\u0652\u0670\u0640\u06d6-\u06ed]/g;
const SUB = '\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089';
const SUP = '\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079';
function norm(s) {
  if (s == null) return '';
  let t = String(s).replace(TASHKEEL, '');
  t = t.replace(/[\u2080-\u2089]/g, c => String(SUB.indexOf(c)));
  t = t.replace(/[\u2070\u00b9\u00b2\u00b3\u2074-\u2079]/g, c => String(SUP.indexOf(c)));
  t = t.replace(/[\u06f0-\u06f9]/g, c => String(c.charCodeAt(0) - 0x06f0));
  t = t.replace(/[\u2212\u2013\u2014]/g, '-');
  t = t.replace(/[\u0660-\u0669]/g, c => String(c.charCodeAt(0) - 0x0660));
  t = t.replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627');
  t = t.replace(/\u0629/g, '\u0647').replace(/\u0649/g, '\u064a');
  t = t.replace(/[\u0624\u0626]/g, '\u0621');
  t = t.replace(/[^\u0621-\u064a0-9a-zA-Z\-%]+/g, ' ');
  return t.trim();
}
const wordsOf = s => norm(s).split(' ').filter(Boolean);
function hasWord(s, w) { return wordsOf(s).includes(norm(w)); }
const cp = s => '[' + [...String(s)].map(c => {
  const n = c.charCodeAt(0);
  return n < 128 ? c : 'U+' + n.toString(16).toUpperCase().padStart(4, '0');
}).join(' ') + ']';

const stemOf = q => q.q != null ? q.q : (q.verse != null ? q.verse : '');
const optsOf = q => q.choices || q.bank || null;
function fingerprint(q) {
  return crypto.createHash('sha256').update(JSON.stringify(q, Object.keys(q).sort())).digest('hex').slice(0, 16);
}
const STOP = new Set(STOPWORDS.map(norm));
function signature(q) {
  let t = stemOf(q);
  const o = optsOf(q);
  if (o && typeof q.answer === 'number') t += ' ' + o[q.answer];
  if (q.type === 'tf') t += ' ' + (q.why || '');
  return new Set(wordsOf(t).filter(w => !STOP.has(w) && w.length > 2));
}
function jaccard(A, B) { let i = 0; for (const v of A) if (B.has(v)) i++; return i / (A.size + B.size - i); }

function load(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function compare(manifestPath) {
  const d = load(BANK), m = load(manifestPath);
  let pass = 0, fail = 0;
  const ok = s => { pass++; console.log('  PASS ' + s); };
  const no = (c, s) => { fail++; console.log('  FAIL [' + c + '] ' + s); };

  const isProt = q => PROTECTED_CATS.includes(q.cat);
  const rest = d.questions.filter(q => !isProt(q));
  const byId = new Map(m.entries.map(e => [e.id, e]));

  // -- C1 coverage ---------------------------------------------------------
  console.log('\n-- C1 coverage --');
  let missing = 0, extra = 0;
  for (const q of rest) if (!byId.has(q.id)) { missing++; no('C1', q.id + ' has no manifest entry'); }
  const live = new Set(rest.map(q => q.id));
  for (const e of m.entries) if (!live.has(e.id)) { extra++; no('C1', e.id + ' is in the manifest but not in the bank'); }
  if (m.entries.length !== new Set(m.entries.map(e => e.id)).size) no('C1', 'the manifest contains duplicate ids');
  if (!missing && !extra) ok('all ' + rest.length + ' non-protected questions are accounted for');

  // -- C2 fingerprints -----------------------------------------------------
  console.log('\n-- C2 fingerprints --');
  let drift = 0;
  for (const q of rest) {
    const e = byId.get(q.id);
    if (!e) continue;
    if (e.fingerprint !== fingerprint(q)) { drift++; no('C2', q.id + ' was edited after it was reviewed'); }
  }
  if (!drift) ok('every reviewed question is byte-identical to what was reviewed');

  // -- C3 sources ----------------------------------------------------------
  console.log('\n-- C3 sources --');
  let bad = 0;
  for (const q of rest) {
    const s = String(q.src == null ? '' : q.src).trim();
    if (!s) { bad++; no('C3', q.id + ' has no source'); continue; }
    if (hasWord(s, AR_YURAJA)) { bad++; no('C3', q.id + ' source is a "to be reviewed" marker ' + cp(AR_YURAJA)); }
    if (norm(s) === norm(AR_MASHHUR)) { bad++; no('C3', q.id + ' source is a hearsay marker'); }
    if (/^https?:\/\/[^\/]+\/?$/i.test(s)) { bad++; no('C3', q.id + ' source is a bare hostname'); }
    if (!LOCATOR.test(s)) { bad++; no('C3', q.id + ' source names a work but no place inside it'); }
    const e = byId.get(q.id);
    if (e && e.src !== q.src) { bad++; no('C3', q.id + ' source differs from the reviewed one'); }
  }
  if (!bad) ok('all ' + rest.length + ' sources name a work and a place inside it');

  // -- C4 one clear answer -------------------------------------------------
  console.log('\n-- C4 one clear answer --');
  let ans = 0;
  for (const q of rest) {
    const o = optsOf(q);
    if (q.type === 'mcq' || q.type === 'complete') {
      if (!o || typeof q.answer !== 'number' || q.answer < 0 || q.answer >= o.length) { ans++; no('C4', q.id + ' has no single valid answer index'); }
      else if (!norm(o[q.answer])) { ans++; no('C4', q.id + ' answer key is empty'); }
    } else if (q.type === 'tf') {
      if (typeof q.answer !== 'boolean') { ans++; no('C4', q.id + ' tf answer is not a boolean'); }
    } else if (q.type === 'order') {
      if (!Array.isArray(q.items) || !Array.isArray(q.answer) || q.items.length !== q.answer.length) { ans++; no('C4', q.id + ' order answer is malformed'); }
    } else if (q.type === 'match') {
      if (!Array.isArray(q.left) || !Array.isArray(q.a) || q.left.length !== q.a.length) { ans++; no('C4', q.id + ' match answer is malformed'); }
    } else { ans++; no('C4', q.id + ' has an unknown type ' + q.type); }
  }
  if (!ans) ok('every question resolves to exactly one clear answer');

  // -- C5 no duplicates ----------------------------------------------------
  console.log('\n-- C5 duplicates --');
  const allowed = new Set(m.allowedSimilarPairs || []);
  const byCat = {};
  for (const q of rest) (byCat[q.cat] = byCat[q.cat] || []).push(q);
  let dup = 0;
  for (const c of Object.keys(byCat)) {
    const a = byCat[c], sg = a.map(signature);
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
      if (jaccard(sg[i], sg[j]) < 0.34) continue;
      const key = [a[i].id, a[j].id].sort().join('|');
      if (allowed.has(key)) continue;
      dup++; no('C5', 'un-adjudicated near-duplicate in ' + c + ': ' + a[i].id + ' ~ ' + a[j].id);
    }
  }
  if (!dup) ok('no un-adjudicated duplicate (' + allowed.size + ' pairs documented as legitimately parallel)');

  // -- C6 protected --------------------------------------------------------
  console.log('\n-- C6 protected questions --');
  const prot = d.questions.filter(isProt);
  let pbad = 0;
  for (const q of prot) if (byId.has(q.id)) { pbad++; no('C6', q.id + ' is protected but appears in the review manifest'); }
  let golden = null;
  try { golden = load(INTEGRITY_GOLDEN); } catch (e) { pbad++; no('C6', 'cannot read ' + INTEGRITY_GOLDEN); }
  if (golden) {
    if (prot.length !== golden.protectedCount) { pbad++; no('C6', 'protected count = ' + prot.length + ' (gate-17 golden says ' + golden.protectedCount + ')'); }
    for (const q of prot) {
      if (golden.protected[q.id] !== fingerprint(q)) { pbad++; no('C6', q.id + ' no longer matches its commit-17bb52a hash'); }
    }
  }
  if (!pbad) ok('all ' + prot.length + ' protected questions untouched and outside the manifest');

  // -- C7 identity ---------------------------------------------------------
  console.log('\n-- C7 identity --');
  let idn = 0;
  if (rest.length !== m.total) { idn++; no('C7', 'non-protected count = ' + rest.length + ' (manifest says ' + m.total + ')'); }
  for (const q of rest) {
    const e = byId.get(q.id);
    if (e && e.cat !== q.cat) { idn++; no('C7', q.id + ' moved ' + e.cat + ' -> ' + q.cat); }
  }
  if (!idn) ok('count, ids and categories all agree with the manifest');

  // -- C8 no unresolved ----------------------------------------------------
  console.log('\n-- C8 review levels --');
  let lvl = 0;
  const seen = {};
  for (const e of m.entries) {
    if (!LEVELS.includes(e.review)) { lvl++; no('C8', e.id + ' has an unknown review level "' + e.review + '"'); }
    else seen[e.review] = (seen[e.review] || 0) + 1;
  }
  if (!lvl) ok('every entry carries a known review level: ' + LEVELS.map(l => l + '=' + (seen[l] || 0)).join(', '));

  console.log('\n' + (fail ? 'FAIL' : 'PASS') + '  ' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
}

const mode = process.argv[2];
if (mode === '--compare' && process.argv[3]) compare(process.argv[3]);
else {
  console.error('usage: node quest-content-review-guard.cjs --compare quest-data/content-review-manifest.json');
  process.exit(2);
}
