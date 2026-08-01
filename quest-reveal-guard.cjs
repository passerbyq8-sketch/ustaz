/* quest-reveal-guard.cjs -- REVEAL-MODE GATE for quest-data/trivia-golden.json.
 *
 * WHY THIS GATE EXISTS
 *   quest.html defaults to answerMode="reveal" (see P.fresh()). In that mode the
 *   choices are NEVER rendered: revealBody() shows the stem, then the answer, and the
 *   player grades himself. So any question whose stem only makes sense while looking at
 *   a list of options is BROKEN for the default audience -- silently, with no error.
 *   Phase 1 rewrote the 26 questions proven broken that way. This gate freezes that work.
 *
 * OFFLINE. No network. Reads only. Runs beside quran-guard / runtime-gate / babel-gate.
 *
 * DISCIPLINE: this file contains ZERO literal Arabic -- same law as quran-guard.cjs and
 * esc.cjs. Every Arabic character in the source and in every failure message is a \uXXXX
 * escape, and any Arabic echoed back to the terminal is printed as codepoints. A guard
 * that prints raw Arabic to a Windows console LIES about what it found: bidi reorders the
 * line, so the eye reads a different string than the one that failed.
 *
 * WHAT IT PROVES, per phase-1 question:
 *   C1 self-contained  -- the stem carries an interrogative/imperative and enough text to
 *                         be answered with the choices hidden.
 *   C2 option-free     -- the stem contains no deictic pointer at a list ("mimma yali",
 *                         "al-atiya", "al-taliya", "ay min hadhihi", "ikhtar min" ...).
 *   C3 one clear answer-- for Quranic fill-in questions, EXACTLY ONE offered option
 *                         produces attested Quranic text when substituted.
 *   C4 one correct key -- answer index in range; no two options normalise to the same
 *                         string (which would make two keys correct).
 *   C5 no self-reveal  -- the normalised answer does not appear inside the normalised stem.
 *   C6 Quran intact    -- every {...} quotation in q / verse / why verifies against
 *                         quran-uthmani.json, the project's attested mushaf.
 *   C7 metadata frozen -- id / cat / band / diff / type / status unchanged for all 26.
 *
 * AND, for the rest of the bank:
 *   C8 no collateral   -- every question NOT in the phase-1 list is byte-identical to the
 *                         golden emitted before the phase-1 patch.
 *
 * USAGE
 *   node quest-reveal-guard.cjs --emit    > quest-data/reveal-golden.json
 *   node quest-reveal-guard.cjs --compare quest-data/reveal-golden.json
 */
'use strict';
const fs = require('fs');
const crypto = require('crypto');

const BANK = 'quest-data/trivia-golden.json';
const MUSHAF = 'quran-uthmani.json';

// ---------------------------------------------------------------------------
// The 26 ids rewritten in phase 1, with the metadata that must never drift.
// band/diff/type/cat are frozen here so a later "fix" cannot quietly re-tier a
// question while claiming to be a wording change.
// ---------------------------------------------------------------------------
const PHASE1 = {
  'gemini-juz-amma-b3-005':  { cat: 'juz-amma',     band: 'young', diff: 2, type: 'complete' },
  'gemini2-juz-tabarak-019': { cat: 'juz-tabarak',  band: 'teen',  diff: 3, type: 'mcq' },
  'quran-0007':              { cat: 'quran',        band: 'adult', diff: 3, type: 'mcq' },
  'quran-0013':              { cat: 'quran',        band: 'teen',  diff: 3, type: 'mcq' },
  'gemini2-quran-002':       { cat: 'quran',        band: 'young', diff: 2, type: 'mcq' },
  'gemini-juz-amma-b3-020':  { cat: 'juz-amma',     band: 'adult', diff: 3, type: 'mcq' },
  'salah-0007':              { cat: 'prayer',       band: 'teen',  diff: 2, type: 'order' },
  'salah-0014':              { cat: 'prayer',       band: 'adult', diff: 3, type: 'mcq' },
  'geo-0025':                { cat: 'geography',    band: 'adult', diff: 3, type: 'mcq' },
  'cap-0017':                { cat: 'geography',    band: 'adult', diff: 2, type: 'mcq' },
  'whist-0012':              { cat: 'world-history',band: 'young', diff: 1, type: 'mcq' },
  'anim-0033':               { cat: 'animals',      band: 'young', diff: 1, type: 'mcq' },
  'chatgpt3-chemistry-001':  { cat: 'chemistry',    band: 'young', diff: 1, type: 'mcq' },
  'gemini-deen-005':         { cat: 'deen',         band: 'adult', diff: 3, type: 'mcq' },
  'gemini2-deen-010':        { cat: 'deen',         band: 'adult', diff: 3, type: 'mcq' },
  'gemini2-deen-015':        { cat: 'deen',         band: 'adult', diff: 3, type: 'mcq' },
  'gemini2-deen-019':        { cat: 'deen',         band: 'teen',  diff: 3, type: 'mcq' },
  'gemini2-prayer-005':      { cat: 'prayer',       band: 'adult', diff: 3, type: 'mcq' },
  'gemini2-prayer-020':      { cat: 'prayer',       band: 'adult', diff: 3, type: 'mcq' },
  'gemini2-seerah-005':      { cat: 'seerah',       band: 'adult', diff: 3, type: 'mcq' },
  'gemini2-manners-007':     { cat: 'manners',      band: 'young', diff: 2, type: 'mcq' },
  'gemini2-manners-018':     { cat: 'manners',      band: 'teen',  diff: 2, type: 'mcq' },
  'gemini2-hadith-016':      { cat: 'hadith',       band: 'young', diff: 1, type: 'mcq' },
  'gemini-hadith-b2-019':    { cat: 'hadith',       band: 'teen',  diff: 3, type: 'mcq' },
  'gemini-prayer-b3-009':    { cat: 'prayer',       band: 'teen',  diff: 3, type: 'mcq' },
  'gemini-manners-003':      { cat: 'manners',      band: 'teen',  diff: 2, type: 'mcq' },
};
const QURAN_CATS = ['quran', 'juz-amma', 'juz-tabarak'];

// ---------------------------------------------------------------------------
// Arabic literals -- escapes only. See DISCIPLINE above.
// ---------------------------------------------------------------------------
// pointers at an unseen list: "mimma yali", "fima yali", "min al-ati(ya)",
// "min al-tali(ya)", "al-atiya", "al-taliya", "ay min hadhihi", "ikhtar min",
// "min al-khiyarat", "al-'ibarat al-taliya"
const DEICTIC = [
  '\u0645\u0645\u0627 \u064A\u0644\u064A', '\u0645\u0645\u0651\u0627 \u064A\u0644\u064A',
  '\u0645\u0645\u0627 \u064A\u0623\u062A\u064A', '\u0641\u064A\u0645\u0627 \u064A\u0644\u064A',
  '\u0641\u064A\u0645\u0627 \u064A\u0623\u062A\u064A', '\u0645\u0646 \u0627\u0644\u0622\u062A\u064A',
  '\u0645\u0646 \u0627\u0644\u0622\u062A\u064A\u0629', '\u0645\u0646 \u0627\u0644\u062A\u0627\u0644\u064A',
  '\u0645\u0646 \u0627\u0644\u062A\u0627\u0644\u064A\u0629', '\u0627\u0644\u0622\u062A\u064A\u0629',
  '\u0627\u0644\u062A\u0627\u0644\u064A\u0629', '\u0627\u0644\u0622\u062A\u064A',
  '\u0627\u0644\u062A\u0627\u0644\u064A', '\u0623\u064A \u0645\u0646 \u0647\u0630\u0647',
  '\u0623\u064A\u064F\u0651 \u0647\u0630\u0647', '\u0623\u064A \u0645\u0645\u0627',
  '\u0627\u062E\u062A\u0631 \u0645\u0646', '\u0645\u0646 \u0627\u0644\u062E\u064A\u0627\u0631\u0627\u062A',
  '\u0627\u0644\u0639\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u062A\u0627\u0644\u064A\u0629',
];
// interrogatives + imperatives: ma, madha, man, mata, ayna, kayfa, limadha, hal,
// ay, ayy, kam, bim, bimadha, fiman, 'amman, udhkur, rattib, tabiq, akmil, 'arrif, samm
const INTERROG = [
  '\u0645\u0627', '\u0645\u0627\u0630\u0627', '\u0645\u0646', '\u0645\u062A\u0649', '\u0623\u064A\u0646',
  '\u0643\u064A\u0641', '\u0644\u0645\u0627\u0630\u0627', '\u0647\u0644', '\u0623\u064A', '\u0623\u064A\u0651',
  '\u0643\u0645', '\u0628\u0645', '\u0628\u0645\u0627\u0630\u0627', '\u0641\u064A\u0645\u0646', '\u0639\u0645\u0646',
  '\u0627\u0630\u0643\u0631', '\u0631\u062A\u0628', '\u0631\u062A\u0651\u0628', '\u0637\u0627\u0628\u0642',
  '\u0623\u0643\u0645\u0644', '\u0639\u0631\u0651\u0641', '\u0633\u0645\u0651', '\u0628\u0645\u064E',
];
const ORN_OPEN = '\uFD3F';   // {
const ORN_CLOSE = '\uFD3E';  // }
const AYAH_SEP = '\u06DD';   // end-of-ayah mark
const QMARK = '\u061F';      // Arabic question mark
// proclitics that fuse onto an interrogative: fa, wa, bi, li ("fa-ayyuha", "bi-ayyi")
const PROCLITIC = ['\u0641', '\u0648', '\u0628', '\u0644'];

// ---------------------------------------------------------------------------
// rasm normaliser -- same law as quran-guard.cjs. `loose` additionally drops the
// long vowels so imla'i spelling in a question matches uthmani rasm in the mushaf
// (e.g. "ya ayyuha" vs the mushaf's dagger-alif form). Doubling is collapsed too.
// ---------------------------------------------------------------------------
const FOLD = {
  0x06CC: 0x064A, 0x0649: 0x064A, 0x06A9: 0x0643, 0x06AA: 0x0643, 0x06BE: 0x0647,
  0x06C0: 0x0629, 0x06D5: 0x0647, 0x0671: 0x0627, 0x0622: 0x0627, 0x0623: 0x0627,
  0x0625: 0x0627, 0x0629: 0x0647,
};
const DROP = /[\u0300-\u036F\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u06F0-\u06FF\u0640\u0621\u08D3-\u08FF\s\u200B-\u200F\uFEFF\u00A0*]/g;
const rasm = (s) => [...String(s).normalize('NFD').replace(DROP, '')]
  .map((c) => { const n = c.codePointAt(0); return FOLD[n] ? String.fromCodePoint(FOLD[n]) : c; })
  .join('');
const loose = (s) => rasm(s).replace(/[\u0627\u0648\u064A]/g, '').replace(/(.)\1+/g, '$1');

// plain-text normaliser for the self-reveal and duplicate-option checks
const flat = (s) => String(s || '')
  .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
  .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627')
  .replace(/\u0649/g, '\u064A').replace(/\u0629/g, '\u0647')
  .replace(/[^\u0621-\u064A0-9a-zA-Z]+/g, ' ').trim();

const cp = (s) => [...String(s)]
  .map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');

// ---------------------------------------------------------------------------
function load(file) {
  if (!fs.existsSync(file)) { console.error('ABORT: not found: ' + file); process.exit(2); }
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.error('ABORT: unparseable JSON: ' + file + ' -- ' + e.message); process.exit(2); }
}
const stemOf = (q) => (q.type === 'complete' ? String(q.verse || '') : String(q.q || ''));
const optsOf = (q) => q.type === 'mcq' ? (q.choices || [])
  : q.type === 'complete' ? (q.bank || [])
  : q.type === 'order' ? (q.items || []) : [];
const answerOf = (q) => {
  if (q.type === 'mcq') return (q.choices || [])[q.answer];
  if (q.type === 'complete') return (q.bank || [])[q.answer];
  if (q.type === 'tf') return q.answer ? 'true' : 'false';
  if (q.type === 'order') return (q.answer || []).map((i) => (q.items || [])[i]).join(' ');
  return '';
};

// ---- mushaf index -----------------------------------------------------------
let AY = null, ST = null, SL = null;
function mushaf() {
  if (AY) return;
  const M = load(MUSHAF);
  AY = Object.entries(M).map(([k, v]) => {
    const s = Number(k.split(':')[0]);
    return { k, s, r: rasm(v), l: loose(v) };
  });
  ST = {}; SL = {};
  AY.forEach((x) => { ST[x.s] = (ST[x.s] || '') + x.r; SL[x.s] = (SL[x.s] || '') + x.l; });
}
// is `text` attested Quran? exact rasm first, then loose (orthography-tolerant),
// each at ayah level then as a span inside one surah.
function attested(text) {
  mushaf();
  const r = rasm(text), l = loose(text);
  if (r.length < 6) return false;
  if (AY.some((x) => x.r.includes(r))) return true;
  for (const s in ST) if (ST[s].includes(r)) return true;
  if (AY.some((x) => x.l.includes(l))) return true;
  for (const s in SL) if (SL[s].includes(l)) return true;
  return false;
}
// every {...} quotation in a field
function quotes(text) {
  const out = [];
  const re = new RegExp(ORN_OPEN + '([^' + ORN_CLOSE + ']+)' + ORN_CLOSE, 'g');
  let m;
  while ((m = re.exec(String(text || ''))) !== null) out.push(m[1]);
  return out;
}
// the blank slot: "___" or "..." or the ellipsis char
const BLANK_RE = /_{2,}|\.{3}|\u2026/;

// ---------------------------------------------------------------------------
function checkOne(q, fail) {
  const id = q.id;
  const meta = PHASE1[id];
  const stem = stemOf(q);
  const opts = optsOf(q);
  const ans = answerOf(q);

  // C7 metadata frozen
  ['cat', 'band', 'diff', 'type'].forEach((k) => {
    if (q[k] !== meta[k]) fail(id, 'C7', 'metadata drift: ' + k + '=' + q[k] + ' expected ' + meta[k]);
  });
  if (q.status !== 'draft') fail(id, 'C7', 'status changed: ' + q.status);

  // C1 self-contained.
  //   A stem stands alone if it is long enough to carry a question AND it actually asks
  //   one. "Asks one" = ends with the Arabic question mark, OR carries an interrogative /
  //   imperative -- allowing the proclitics fa/wa/bi/li that fuse onto it ("fa-ayyuha",
  //   "bi-ayyi"). `complete` questions are exempt from the interrogative test: their
  //   instruction comes from the UI label (Q.label -> "akmil al-ayah"), not from the text.
  if (flat(stem).length < 12) fail(id, 'C1', 'stem too short to stand without options: ' + flat(stem).length + ' chars');
  if (q.type !== 'complete') {
    const words = flat(stem).split(' ');
    const asks = String(stem).trim().endsWith(QMARK)
      || INTERROG.some((w) => {
        const t = flat(w);
        return words.some((x) => x === t || (PROCLITIC.includes(x[0]) && x.slice(1) === t));
      });
    if (!asks) fail(id, 'C1', 'stem neither ends in a question mark nor carries an interrogative: ' + cp(stem.slice(0, 40)));
  }

  // C2 option-free
  DEICTIC.forEach((p) => {
    if (flat(stem).includes(flat(p))) fail(id, 'C2', 'deictic pointer at an unseen list: ' + cp(p));
  });

  // C4 one correct key
  if (q.type === 'mcq' || q.type === 'complete') {
    if (!Array.isArray(opts) || opts.length < 2) fail(id, 'C4', 'fewer than two options');
    if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= opts.length)
      fail(id, 'C4', 'answer index out of range: ' + q.answer + ' of ' + opts.length);
    const seen = new Map();
    opts.forEach((o, i) => {
      const k = flat(o);
      if (!k) fail(id, 'C4', 'blank option at index ' + i);
      if (seen.has(k)) fail(id, 'C4', 'two options normalise identically (indices ' + seen.get(k) + ',' + i + '): ' + cp(String(o).slice(0, 24)));
      seen.set(k, i);
    });
  } else if (q.type === 'order') {
    const sorted = [...(q.answer || [])].sort((a, b) => a - b).join(',');
    if (sorted !== (q.items || []).map((_, i) => i).join(','))
      fail(id, 'C4', 'order answer is not a permutation of the item indices');
  }

  // C5 no self-reveal
  const fa = flat(ans);
  if (fa && fa.length > 3 && flat(stem).includes(fa))
    fail(id, 'C5', 'stem contains the answer verbatim: ' + cp(String(ans).slice(0, 30)));

  // C3 one clear answer -- Quranic fill-in questions.
  //   The test runs on the QURANIC SPAN alone, never on the surrounding prose: prose can
  //   never be "attested", and disambiguating in prose would let a stem stay ambiguous to
  //   anyone reciting from memory. So the span itself must admit exactly one completion.
  //     complete -> the renderer (Q.stem) appends the blank AFTER q.verse, so the
  //                 candidate is `verse + option`.
  //     mcq      -> the candidate is the {...} quotation that carries the blank, with the
  //                 option substituted into it.
  if (QURAN_CATS.includes(q.cat)) {
    let template = null;
    if (q.type === 'complete') template = stem + ' ' + '\u0000';
    else {
      const carrier = quotes(String(q.q || '')).find((x) => BLANK_RE.test(x));
      if (carrier) template = carrier.replace(BLANK_RE, ' ' + '\u0000' + ' ');
    }
    if (template) {
      const valid = [];
      opts.forEach((o, i) => {
        const filled = template.split('\u0000').join(o).split(AYAH_SEP).join(' ');
        if (attested(filled)) valid.push(i);
      });
      if (valid.length !== 1)
        fail(id, 'C3', 'a Quranic fill-in must have exactly ONE attested completion; ' +
          valid.length + ' of ' + opts.length + ' options produce attested text (indices ' + valid.join(',') + ')');
      else if (valid[0] !== q.answer)
        fail(id, 'C3', 'the only attested completion is index ' + valid[0] + ' but answer=' + q.answer);
    }
  }

  // C6 Quran intact -- every {...} in stem / q / why
  [stem, String(q.q || ''), String(q.why || '')].forEach((field) => {
    quotes(field).forEach((qt) => {
      if (BLANK_RE.test(qt)) return;                 // an elided quote is the puzzle itself
      if (rasm(qt).length < 8) return;
      if (!attested(qt)) fail(id, 'C6', 'quotation not found in the attested mushaf: ' + cp(qt.slice(0, 40)));
    });
  });
}

// ---------------------------------------------------------------------------
function fingerprint(q) {
  return crypto.createHash('sha256').update(JSON.stringify(q, Object.keys(q).sort())).digest('hex').slice(0, 16);
}
function emit() {
  const d = load(BANK);
  const rest = {};
  d.questions.forEach((q) => { if (!PHASE1[q.id]) rest[q.id] = fingerprint(q); });
  process.stdout.write(JSON.stringify({
    schema: 'quest-reveal-golden/v1',
    note: 'sha256 fingerprints of every question OUTSIDE the phase-1 list. Regenerate only when a later phase intentionally edits them.',
    phase1: Object.keys(PHASE1).sort(),
    total: d.questions.length,
    frozen: Object.keys(rest).length,
    fingerprints: rest,
  }, null, 2) + '\n');
}

function compare(goldenFile) {
  const d = load(BANK);
  const golden = load(goldenFile);
  let hard = 0;
  const fail = (id, code, msg) => { hard++; console.log('  FAIL [' + code + '] ' + id + ' -- ' + msg); };

  console.log('=== quest-reveal-guard ===');
  console.log('bank: ' + BANK + '  questions: ' + d.questions.length);

  // every phase-1 id must still exist
  const byId = {};
  d.questions.forEach((q) => { byId[q.id] = q; });
  const ids = Object.keys(PHASE1);
  console.log('\n-- phase-1 questions (' + ids.length + ') --');
  ids.forEach((id) => {
    if (!byId[id]) { fail(id, 'C7', 'question disappeared from the bank'); return; }
    checkOne(byId[id], fail);
  });
  if (hard === 0) console.log('  all ' + ids.length + ' pass C1-C7');

  // C8 no collateral damage
  console.log('\n-- frozen remainder (C8) --');
  let drift = 0, added = 0, gone = 0;
  const fp = golden.fingerprints || {};
  d.questions.forEach((q) => {
    if (PHASE1[q.id]) return;
    if (!(q.id in fp)) { added++; console.log('  FAIL [C8] ' + q.id + ' -- question not present in the golden'); return; }
    if (fp[q.id] !== fingerprint(q)) { drift++; console.log('  FAIL [C8] ' + q.id + ' -- edited outside the phase-1 list'); }
  });
  Object.keys(fp).forEach((id) => {
    if (!byId[id]) { gone++; console.log('  FAIL [C8] ' + id + ' -- question removed from the bank'); }
  });
  hard += drift + added + gone;
  if (drift + added + gone === 0)
    console.log('  ' + Object.keys(fp).length + ' questions byte-identical to the golden');

  if (golden.total !== d.questions.length) {
    hard++;
    console.log('  FAIL [C8] bank size changed: golden=' + golden.total + ' now=' + d.questions.length);
  }

  console.log('\nhard=' + hard + ' soft=0');
  console.log(hard === 0
    ? '=== PASS: every phase-1 question stands without its choices, and nothing else moved. ==='
    : '=== FAIL: DO NOT COMMIT. ===');
  process.exit(hard === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------------
const [, , mode, a1] = process.argv;
if (mode === '--emit') emit();
else if (mode === '--compare') compare(a1 || 'quest-data/reveal-golden.json');
else {
  console.error('usage: node quest-reveal-guard.cjs --emit    > quest-data/reveal-golden.json');
  console.error('       node quest-reveal-guard.cjs --compare quest-data/reveal-golden.json');
  process.exit(2);
}
