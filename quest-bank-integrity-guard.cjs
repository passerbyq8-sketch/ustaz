/* quest-bank-integrity-guard.cjs -- STRUCTURAL GATE for quest-data/trivia-golden.json.
 *
 * WHY THIS GATE EXISTS
 *   Phase 4 swept the 1785 non-protected questions for structural rot: true/false
 *   statements stored as two-option mcq, stems that only parse while a list of
 *   options is on screen, stems whose text contains their own answer, duplicate
 *   questions, questions whose stem had been overwritten by an ingestion bug,
 *   sources that were category labels or "to be reviewed" markers, and keys that
 *   were twice as long as every distractor (which hands the answer to the player
 *   in mcq mode). This gate freezes that work and, above all, proves that the 394
 *   PROTECTED questions -- quran / juz-amma / juz-tabarak / prayer -- are still
 *   byte-for-byte what they were at commit 17bb52a.
 *
 * OFFLINE. No network. Reads only.
 *
 * DISCIPLINE: this file contains ZERO literal Arabic -- same law as quran-guard.cjs,
 * esc.cjs and quest-reveal-guard.cjs. Every Arabic character is a \uXXXX escape and
 * any Arabic echoed to the terminal is printed as codepoints. A guard that prints raw
 * Arabic to a Windows console LIES about what it found: bidi reorders the line, so the
 * eye reads a different string than the one that failed.
 *
 * WHAT IT PROVES
 *   B1 count        -- the bank still holds exactly `total` questions.
 *   B2 identity     -- the id list is unchanged, in order, with no additions or drops.
 *   B3 categories   -- every question sits in the category it sat in, and the per
 *                      category histogram is unchanged.
 *   B4 schema       -- per type: required fields present, answer in range and of the
 *                      right JS type, mcq has >= 3 choices, no empty or duplicate
 *                      choice, `why` and `src` non-empty.
 *   B5 no duplicate -- no two non-protected questions share a normalised stem, and no
 *                      two in the same category share an answer key with overlapping
 *                      stems (beyond a documented allow-list).
 *   B6 answer valid -- exactly one key, and the key is a non-empty option.
 *   B7 option-free  -- the stem carries an interrogative / imperative / completion
 *                      marker, contains no deictic pointer at an unseen list, and does
 *                      not contain its own answer as a whole phrase.
 *   B8 sources      -- `src` is present, is not a "to be reviewed" or hearsay marker,
 *                      is not a bare hostname, and points INSIDE the work it names:
 *                      a hadith number, an aya, the year of the events, a kitab/bab
 *                      or tarjama after a dash, or a quoted entry title. Naming
 *                      "al-Kamil fi al-Tarikh" (11 volumes) proves nothing on its own.
 *   B9 protected    -- sha256 of each of the 394 protected questions equals the hash
 *                      recorded from commit 17bb52a. This is the load-bearing check.
 *   B10 sealed 13   -- sha256 of the eight quest-data files, the three scripture /
 *                      adhkar / layout files, the manifest and the service worker.
 *                      Unconditional: no git, no branch, no skip.
 *
 * USAGE
 *   node quest-bank-integrity-guard.cjs --emit    > quest-data/bank-integrity-golden.json
 *   node quest-bank-integrity-guard.cjs --compare quest-data/bank-integrity-golden.json
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BANK = 'quest-data/trivia-golden.json';
const PROTECTED_CATS = ['quran', 'juz-amma', 'juz-tabarak', 'prayer'];

// ---------------------------------------------------------------------------
// THE SEALED THIRTEEN. Every file here carries scripture, adhkar, the mushaf
// layout, the question bank, or the two files that decide what a phone installs
// and caches. None of them may move without the seal being re-cut deliberately.
//
// This list used to live in chat-ux-guard.cjs, inside the ELSE arm of a
// `git diff --name-only HEAD` probe. When git was absent -- a fresh export, a
// container, any CI image without .git -- the probe threw, the guard reported
// one honest failure about the blast radius, and the seal below it NEVER RAN.
// A reader saw a single red line about git and read it as harmless plumbing;
// the thirteen went unchecked. The most valuable guarantee in the repository
// cannot be a passenger on a `git` lookup, and it does not belong inside a
// user-experience guard at all. It runs here, unconditionally, and a mismatch
// prints the file, the expected digest and the actual one.
// ---------------------------------------------------------------------------
const SEALED = {
  'quest-data/trivia-golden.json': '4066160153f7648e7eeb145edae0ed43a2d24048d549ce076b37a6e144a425a9',
  'quest-data/reveal-golden.json': 'b3a89a4997b9b9ab6c91bd26a020e2e85a8d697ffec19bbd29937885d3819743',
  'quest-data/quran-quest-golden.json': 'd657ce9fcad754afd75ab96dbb3a8670d056cb3f103c37b689a4d51f31d9fefc',
  'quest-data/prayer-quest-golden.json': 'fdff7d29711735f0ce72e62c025a7596b9c2d3c6d0f254e9f198854d812b5807',
  'quest-data/bank-integrity-golden.json': '04877fb4faa2f21786a1b65f2be4f879bcccfd7af0f3621b4abefb31afef46ec',
  'quest-data/content-review-manifest.json': 'ae79702252e711f11804e2c0cf36166d085649035b032106fe3e8658c08ced85',
  'quest-data/rewards.json': '536caf3d048ca3e11361135b635a6284916ba286c4139ac5b8f8f176e6e84ba3',
  'quest-data/world.json': '6da5033bef577784238e7ab98d356dc8cf345958215d3232bad221922feb751b',
  'quran-uthmani.json': 'd4fd1a1507f70a4261789eaec8380750cd0f65f4d641f6df2ef6334b18c6877b',
  'adhkar.json': '19ef96b9ecc275376d46a667a86297261ea5991749ffe46dd35448196cb4c9c3',
  'mushaf-layout.json': 'ea9223ef7f18b5d933ce1c87cbebabc5d78f1ec0e8ac9714260f9dee6d571351',
  'manifest.json': '4b96523dac293c0c7a663888aee0ea749786e57613786a0f6287e12c75905f1a',
  'sw.js': '4de761376cbffba7801c385b913bafd0bc5bd58afbc52e5b14771a87bab19759',
};

// ---------------------------------------------------------------------------
// Arabic, as escapes only.
// ---------------------------------------------------------------------------
const AR = {
  // deictic pointers at a list the default reveal mode never renders
  MIMMA_YALI: '\u0645\u0645\u0627 \u064a\u0644\u064a',                  // mimma yali
  ATIYA: '\u0627\u0644\u0627\u062a\u064a\u0647',                        // al-atiya
  TALIYA: '\u0627\u0644\u062a\u0627\u0644\u064a\u0647',                 // al-taliya
  TALI: '\u0627\u0644\u062a\u0627\u0644\u064a',                         // al-tali
  ATI: '\u0627\u0644\u0627\u062a\u064a',                                // al-ati
  MIN_HADHIHI: '\u0645\u0646 \u0647\u0630\u0647',                       // min hadhihi
  MIN_HAULA: '\u0645\u0646 \u0647\u0621\u0644\u0627\u0621',             // min ha'ula'
  KHIYARAT: '\u0627\u0644\u062e\u064a\u0627\u0631\u0627\u062a',         // al-khiyarat
  // source markers that are not sources
  YURAJA: '\u064a\u0631\u0627\u062c\u0639',                             // yuraja' -- "to be reviewed"
  MASHHUR: '\u0645\u0634\u0647\u0648\u0631',                            // mashhur -- "well known"
  // the two literal options a mis-typed true/false question used to carry
  TF_T: '\u0635\u062d', TF_F: '\u062e\u0637\u0623',                     // sahh / khata'
};
const DEICTIC = [AR.MIMMA_YALI, AR.ATIYA, AR.TALIYA, AR.TALI, AR.ATI, AR.MIN_HADHIHI, AR.MIN_HAULA, AR.KHIYARAT];
// interrogatives and imperatives that make a stem stand on its own
const INTERROGATIVES = ['\u0645\u0627', '\u0645\u0646', '\u0643\u0645', '\u0627\u064a\u0646',
  '\u0645\u062a\u064a', '\u0643\u064a\u0641', '\u0644\u0645\u0627\u0630\u0627', '\u0645\u0627\u0630\u0627',
  '\u0627\u064a', '\u0647\u0644', '\u0627\u0630\u0643\u0631', '\u0627\u0643\u0645\u0644',
  '\u0631\u062a\u0628', '\u0637\u0627\u0628\u0642', '\u0635\u0644', '\u0633\u0645'];

// ---------------------------------------------------------------------------
// Normalisation. Diacritics go; alef/ya/ta-marbuta/hamza forms collapse; but
// DIGITS SURVIVE -- Arabic-Indic, subscripts, superscripts and the minus sign all
// fold to ASCII. An earlier sweep that dropped them reported six duplicate choices
// that did not exist ("100" and "0" both normalising to the empty string).
// ---------------------------------------------------------------------------
const TASHKEEL = /[\u064b-\u0652\u0670\u0640\u06d6-\u06ed]/g;
const SUB = '\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089';
const SUP = '\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079';
function norm(s) {
  if (s == null) return '';
  let t = String(s).replace(TASHKEEL, '');
  t = t.replace(/[\u2080-\u2089]/g, c => String(SUB.indexOf(c)));
  t = t.replace(/[\u2070\u00b9\u00b2\u00b3\u2074-\u2079]/g, c => String(SUP.indexOf(c)));
  t = t.replace(/[\u0660-\u0669]/g, c => String(c.charCodeAt(0) - 0x0660));
  t = t.replace(/[\u06f0-\u06f9]/g, c => String(c.charCodeAt(0) - 0x06f0));
  t = t.replace(/[\u2212\u2013\u2014]/g, '-');
  t = t.replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627');
  t = t.replace(/\u0629/g, '\u0647').replace(/\u0649/g, '\u064a');
  t = t.replace(/[\u0624\u0626]/g, '\u0621');
  t = t.replace(/[^\u0621-\u064a0-9a-zA-Z\-%]+/g, ' ');
  return t.trim();
}
const wordsOf = s => norm(s).split(' ').filter(Boolean);
function hasPhrase(stem, phrase) {
  const w = wordsOf(stem), p = phrase.split(' ').filter(Boolean);
  for (let i = 0; i + p.length <= w.length; i++) {
    let ok = true;
    for (let j = 0; j < p.length; j++) if (w[i + j] !== p[j]) { ok = false; break; }
    if (ok) return true;
  }
  return false;
}
// print any string as codepoints -- never raw Arabic
const cp = s => '[' + [...String(s)].map(c => {
  const n = c.charCodeAt(0);
  return n < 128 ? c : 'U+' + n.toString(16).toUpperCase().padStart(4, '0');
}).join(' ') + ']';

const stemOf = q => q.q != null ? q.q : (q.verse != null ? q.verse : '');
const optsOf = q => q.choices || q.bank || null;
const keyOf = q => { const o = optsOf(q); return o && typeof q.answer === 'number' ? norm(o[q.answer]) : null; };
function fingerprint(q) {
  return crypto.createHash('sha256').update(JSON.stringify(q, Object.keys(q).sort())).digest('hex').slice(0, 16);
}
// A citation locates something if it carries a number (hadith no., aya, year),
// or a sub-reference introduced by an em- or en-dash, or a \u00abquoted entry\u00bb.
const LOCATOR = /[0-9\u0660-\u0669]|[\u2014\u2013]\s*\S|\u00ab[^\u00bb]+\u00bb/;

function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  let i = 0; for (const v of A) if (B.has(v)) i++;
  return i / (A.size + B.size - i);
}

// ---------------------------------------------------------------------------
// Documented exceptions. Each one is a judgement call recorded in the source so a
// later reader can overturn it deliberately rather than by accident.
// ---------------------------------------------------------------------------
// Two questions ask for the same dhikr on two DIFFERENT occasions (before food /
// before wudu). Same key, overlapping stem, but genuinely two questions.
const ALLOWED_DUP = new Set(['adhkar|azkar-0001|gemini-adhkar-b2-001']);
// The stem legitimately contains the key.
const ALLOWED_SELF_REVEAL = {
  'phys-0016': 'angle of reflection EQUALS the angle of incidence named in the stem -- that identity IS the question',
  'chatgpt-chemistry-001': 'stem names solvent and solute; asking which is which is the concept being tested',
  'chatgpt4-geography-009': 'stem offers the A-or-B pair explicitly; it is an either/or question, not a list pointer',
  'gemini-hadith-b2-014': 'the hadith itself repeats the word ("da` ma yuribuk ila ma la yuribuk")',
};

function load(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

// ---------------------------------------------------------------------------
function emit() {
  const d = load(BANK);
  const prot = {}, cats = {}, hist = {};
  for (const q of d.questions) {
    cats[q.id] = q.cat;
    hist[q.cat] = (hist[q.cat] || 0) + 1;
    if (PROTECTED_CATS.includes(q.cat)) prot[q.id] = fingerprint(q);
  }
  process.stdout.write(JSON.stringify({
    schema: 'bank-integrity-golden/v1',
    note: 'Phase-4 structural baseline. `protected` pins the 394 questions of the four protected '
      + 'categories to their commit-17bb52a bytes and must NEVER be regenerated to paper over a change '
      + 'to them. `ids` / `cats` / `total` pin identity. Everything else the guard recomputes live.',
    total: d.questions.length,
    protectedCats: PROTECTED_CATS,
    protectedCount: Object.keys(prot).length,
    categoryCounts: hist,
    ids: d.questions.map(q => q.id),
    cats,
    protected: prot,
  }, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
function compare(goldenPath) {
  const d = load(BANK), g = load(goldenPath);
  let pass = 0, fail = 0;
  const ok = m => { pass++; console.log('  PASS ' + m); };
  const no = (c, m) => { fail++; console.log('  FAIL [' + c + '] ' + m); };

  const isProt = q => PROTECTED_CATS.includes(q.cat);
  const rest = d.questions.filter(q => !isProt(q));

  // -- B1 count ------------------------------------------------------------
  console.log('\n-- B1 count --');
  if (d.questions.length === g.total) ok('question count = ' + g.total);
  else no('B1', 'question count = ' + d.questions.length + ' (golden says ' + g.total + ')');

  // -- B2 identity ---------------------------------------------------------
  console.log('\n-- B2 identity --');
  const live = d.questions.map(q => q.id);
  if (live.length === g.ids.length && live.every((v, i) => v === g.ids[i])) ok('id list unchanged, in order');
  else {
    const L = new Set(live), G = new Set(g.ids);
    const added = live.filter(x => !G.has(x)), gone = g.ids.filter(x => !L.has(x));
    if (added.length) no('B2', 'ids not in the golden: ' + added.slice(0, 8).join(', '));
    if (gone.length) no('B2', 'ids dropped from the bank: ' + gone.slice(0, 8).join(', '));
    if (!added.length && !gone.length) no('B2', 'id ORDER changed');
  }

  // -- B3 categories -------------------------------------------------------
  console.log('\n-- B3 categories --');
  let moved = 0;
  for (const q of d.questions) if (g.cats[q.id] && g.cats[q.id] !== q.cat) { moved++; no('B3', q.id + ' moved ' + g.cats[q.id] + ' -> ' + q.cat); }
  if (!moved) ok('every question is still in its own category');
  const hist = {};
  for (const q of d.questions) hist[q.cat] = (hist[q.cat] || 0) + 1;
  const drift = Object.keys(g.categoryCounts).filter(c => hist[c] !== g.categoryCounts[c]);
  if (!drift.length) ok('category histogram unchanged (' + Object.keys(hist).length + ' categories)');
  else for (const c of drift) no('B3', 'category ' + c + ' = ' + (hist[c] || 0) + ' (golden ' + g.categoryCounts[c] + ')');

  // -- B4 schema + B6 answer validity --------------------------------------
  console.log('\n-- B4 schema / B6 answer validity --');
  let bad = 0;
  for (const q of rest) {
    const o = optsOf(q), t = q.type;
    const stem = stemOf(q);
    if (!stem || !String(stem).trim()) { no('B4', q.id + ' has no stem'); bad++; }
    if (!q.why || !String(q.why).trim()) { no('B4', q.id + ' has no why'); bad++; }
    if (t === 'mcq') {
      if (!Array.isArray(q.choices)) { no('B4', q.id + ' mcq without choices'); bad++; }
      else {
        if (q.choices.length < 3) { no('B4', q.id + ' mcq with only ' + q.choices.length + ' choices (a 2-option mcq is a mis-typed tf)'); bad++; }
        if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.choices.length) { no('B6', q.id + ' answer index ' + q.answer + ' out of range'); bad++; }
        if (q.choices[0] === AR.TF_T && q.choices[1] === AR.TF_F) { no('B4', q.id + ' is a true/false statement stored as mcq'); bad++; }
        const seen = new Set();
        for (const c of q.choices) {
          const n = norm(c);
          if (!n) { no('B4', q.id + ' has an empty choice'); bad++; }
          if (seen.has(n)) { no('B4', q.id + ' has a duplicate choice ' + cp(String(c).slice(0, 24))); bad++; }
          seen.add(n);
        }
      }
    } else if (t === 'tf') {
      if (typeof q.answer !== 'boolean') { no('B6', q.id + ' tf answer is not a boolean'); bad++; }
      if (q.choices) { no('B4', q.id + ' tf carries a dead choices array'); bad++; }
    } else if (t === 'complete') {
      if (!Array.isArray(q.bank)) { no('B4', q.id + ' complete without a bank'); bad++; }
      else if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.bank.length) { no('B6', q.id + ' answer index out of range'); bad++; }
    } else if (t === 'order') {
      if (!Array.isArray(q.items) || !Array.isArray(q.answer) || q.items.length !== q.answer.length) { no('B4', q.id + ' order shape is broken'); bad++; }
    } else if (t === 'match') {
      if (!Array.isArray(q.left) || !Array.isArray(q.right) || !Array.isArray(q.a)
        || q.left.length !== q.right.length || q.left.length !== q.a.length) { no('B4', q.id + ' match shape is broken'); bad++; }
    } else { no('B4', q.id + ' unknown type ' + t); bad++; }
    if (o && typeof q.answer === 'number' && o[q.answer] != null && !norm(o[q.answer])) { no('B6', q.id + ' answer key is empty'); bad++; }
  }
  if (!bad) ok('all ' + rest.length + ' non-protected questions are schema-clean');

  // -- B5 duplicates -------------------------------------------------------
  console.log('\n-- B5 duplicates --');
  const byStem = new Map();
  for (const q of rest) {
    const k = norm(stemOf(q));
    if (!k) continue;
    if (!byStem.has(k)) byStem.set(k, []);
    byStem.get(k).push(q.id);
  }
  let dups = 0;
  for (const [, ids] of byStem) if (ids.length > 1) { dups++; no('B5', 'identical stems: ' + ids.join(' = ')); }
  const byCat = {};
  for (const q of rest) (byCat[q.cat] = byCat[q.cat] || []).push(q);
  for (const c of Object.keys(byCat)) {
    const grp = new Map();
    for (const q of byCat[c]) { const k = keyOf(q); if (!k) continue; if (!grp.has(k)) grp.set(k, []); grp.get(k).push(q); }
    for (const [, qs] of grp) {
      if (qs.length < 2) continue;
      for (let i = 0; i < qs.length; i++) for (let j = i + 1; j < qs.length; j++) {
        if (jaccard(wordsOf(stemOf(qs[i])), wordsOf(stemOf(qs[j]))) < 0.40) continue;
        if (ALLOWED_DUP.has(c + '|' + qs[i].id + '|' + qs[j].id)) continue;
        dups++; no('B5', 'same answer key and overlapping stems in ' + c + ': ' + qs[i].id + ' ~ ' + qs[j].id);
      }
    }
  }
  if (!dups) ok('no duplicate question in the 1785 (1 documented parallel pair allowed)');

  // -- B7 option independence ----------------------------------------------
  console.log('\n-- B7 the stem stands on its own --');
  let dep = 0;
  for (const q of rest) {
    const stem = stemOf(q);
    for (const dpat of DEICTIC) {
      if (hasPhrase(stem, dpat)) { dep++; no('B7', q.id + ' stem points at an unrendered list: ' + cp(dpat)); }
    }
    // a stem must ask something; tf statements and fill-in prompts are exempt
    if (q.type !== 'tf' && q.type !== 'complete') {
      const w = wordsOf(stem);
      const asks = /[\u061f?]/.test(stem) || /[:\uff1a]\s*$/.test(String(stem).trim())
        || /\.\.\.|\u2026|_{2,}/.test(stem) || INTERROGATIVES.some(t => w.includes(norm(t)));
      if (!asks) { dep++; no('B7', q.id + ' stem is not a question and carries no completion marker'); }
    }
    // the stem must not contain its own answer
    const k = keyOf(q);
    if (k && k.length >= 5 && (' ' + norm(stem) + ' ').includes(' ' + k + ' ') && !ALLOWED_SELF_REVEAL[q.id]) {
      dep++; no('B7', q.id + ' stem contains its own answer key');
    }
  }
  if (!dep) ok('every stem is answerable with the choices hidden (' + Object.keys(ALLOWED_SELF_REVEAL).length + ' documented exceptions)');

  // -- B8 sources ----------------------------------------------------------
  console.log('\n-- B8 sources --');
  let src = 0;
  for (const q of rest) {
    const s = String(q.src == null ? '' : q.src).trim();
    if (!s) { src++; no('B8', q.id + ' has no src'); continue; }
    if (hasPhrase(s, AR.YURAJA)) { src++; no('B8', q.id + ' src is a "to be reviewed" marker, not a source'); }
    else if (norm(s) === norm(AR.MASHHUR)) { src++; no('B8', q.id + ' src is a hearsay marker, not a source'); }
    if (/^https?:\/\/[^\/]+\/?$/i.test(s)) { src++; no('B8', q.id + ' src is a bare hostname, not the page that proves the fact'); }
    if (s.length < 4) { src++; no('B8', q.id + ' src is too short to locate anything'); }
    // A source must point INSIDE the work it names. Naming a fourteen-volume
    // chronicle is the same defect as citing a homepage: it proves nothing and
    // nobody can check it. A locator is a number (hadith no. / aya / year), a
    // sub-reference after a dash (kitab, bab, tarjama, entry), or a \u00abquoted
    // entry title\u00bb. All 1785 satisfied this when the rule was added.
    if (!LOCATOR.test(s)) { src++; no('B8', q.id + ' src names a work but no place inside it'); }
  }
  if (!src) ok('all ' + rest.length + ' non-protected sources name a work AND a place inside it');

  // -- B9 the 394 protected questions --------------------------------------
  console.log('\n-- B9 protected questions (the load-bearing check) --');
  const liveProt = d.questions.filter(isProt);
  if (liveProt.length === g.protectedCount) ok('protected question count = ' + g.protectedCount);
  else no('B9', 'protected count = ' + liveProt.length + ' (golden ' + g.protectedCount + ')');
  let touched = 0;
  for (const q of liveProt) {
    const want = g.protected[q.id];
    if (!want) { touched++; no('B9', q.id + ' is protected but absent from the golden'); continue; }
    if (fingerprint(q) !== want) { touched++; no('B9', q.id + ' WAS EDITED -- protected questions are frozen at commit 17bb52a'); }
  }
  for (const id of Object.keys(g.protected)) {
    if (!d.questions.some(q => q.id === id)) { touched++; no('B9', id + ' disappeared from the bank'); }
  }
  if (!touched) ok('all ' + g.protectedCount + ' protected questions are byte-for-byte unchanged');

  // -- B10 the sealed thirteen ---------------------------------------------
  // No `if git`, no `try`. Every file is opened and hashed on every run, and the
  // count of what was actually hashed is printed so a silent skip is impossible
  // to mistake for a pass.
  console.log('\n-- B10 sealed files (unconditional: no git, no skip) --');
  const sealNames = Object.keys(SEALED);
  let sealed = 0, sealBad = 0;
  for (const f of sealNames) {
    const p = path.join(__dirname, f);
    if (!fs.existsSync(p)) {
      sealBad++; no('B10', f + ' is ABSENT -- sealed as ' + SEALED[f]);
      continue;
    }
    const h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    sealed++;
    if (h !== SEALED[f]) {
      sealBad++;
      no('B10', f + ' MOVED');
      console.log('         sealed ' + SEALED[f]);
      console.log('         actual ' + h);
    }
  }
  console.log('  sealed files hashed: ' + sealed + '/' + sealNames.length);
  if (sealed !== sealNames.length) no('B10', 'only ' + sealed + ' of ' + sealNames.length + ' sealed files were readable');
  if (!sealBad) ok('all ' + sealNames.length + ' sealed files are byte-for-byte unchanged');

  console.log('\n' + (fail ? 'FAIL' : 'PASS') + '  ' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
}

const mode = process.argv[2];
if (mode === '--emit') emit();
else if (mode === '--compare' && process.argv[3]) compare(process.argv[3]);
else {
  console.error('usage: node quest-bank-integrity-guard.cjs --emit    > quest-data/bank-integrity-golden.json');
  console.error('       node quest-bank-integrity-guard.cjs --compare quest-data/bank-integrity-golden.json');
  process.exit(2);
}
