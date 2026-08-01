/* quran-quest-guard.cjs -- QURAN-CATEGORY GATE for quest-data/trivia-golden.json.
 *
 * WHY THIS GATE EXISTS
 *   Phase 2 rebuilt the three Quran categories (quran / juz-amma / juz-tabarak, 294
 *   questions) so that no single question shape dominates and every quoted verse comes
 *   verbatim out of quran-uthmani.json. Those properties are invisible at review time and
 *   trivially lost by a later well-meaning edit, so they are asserted here instead.
 *
 * OFFLINE. No network. Reads only. Runs beside quran-guard / quest-reveal-guard.
 *
 * DISCIPLINE: ZERO literal Arabic -- same law as quran-guard.cjs, esc.cjs and
 * quest-reveal-guard.cjs. Every Arabic character is a \uXXXX escape and every Arabic
 * string echoed to the terminal is printed as codepoints. Raw Arabic on a Windows console
 * is bidi-reordered, so a guard that prints it lies about what actually failed.
 *
 * WHAT IT PROVES
 *   Q1  count + identity  -- exactly 294 questions across the three categories, and the
 *                            id set is byte-identical to the golden.
 *   Q2  verbatim Quran    -- every {...} quotation in q / verse / why appears in the
 *                            mushaf at EXACT rasm. Imla'i spelling is a failure, not a
 *                            warning: rule 8 says copy from the protected source.
 *   Q3  citation truth    -- when src names "surah X, ayah N", the quoted text really is
 *                            at that surah and that ayah.
 *   Q4  adjacency         -- a previous/next question quotes two genuinely consecutive
 *                            ayat of the named surah, and never runs off either edge.
 *   Q5  sourced meaning   -- meaning / who-is-meant / occasion questions carry a real src
 *                            (a named tafsir or a hadith collection), not a bare label.
 *   Q6  no weak fada'il   -- the discredited virtue claims are absent.
 *   Q7  no duplication    -- no two questions in a category share an answer and a stem.
 *   Q8  shape balance     -- no pattern exceeds 25% of its category, and all nine appear.
 *   Q9  works unseen      -- every stem stands without its choices (phase-1 criteria).
 *   Q10 one right answer  -- answer index valid, options distinct, and a Quranic fill-in
 *                            admits exactly one attested completion.
 *   Q11 no collateral     -- every question OUTSIDE the three categories is byte-identical
 *                            to the golden.
 *
 * USAGE
 *   node quran-quest-guard.cjs --emit    > quest-data/quran-quest-golden.json
 *   node quran-quest-guard.cjs --compare quest-data/quran-quest-golden.json
 */
'use strict';
const fs = require('fs');
const crypto = require('crypto');

const BANK = 'quest-data/trivia-golden.json';
const MUSHAF = 'quran-uthmani.json';
const CATS = ['quran', 'juz-amma', 'juz-tabarak'];
const TOTAL = 294;
const CAP = 0.25;
const FLOOR = 5;

// ---------------------------------------------------------------------------
// Arabic literals -- escapes only.
// ---------------------------------------------------------------------------
const SURAH = ('\u0627\u0644\u0641\u0627\u062A\u062D\u0629,\u0627\u0644\u0628\u0642\u0631\u0629,\u0622\u0644 \u0639\u0645\u0631\u0627\u0646,\u0627\u0644\u0646\u0633\u0627\u0621,\u0627\u0644\u0645\u0627\u0626\u062F\u0629,\u0627\u0644\u0623\u0646\u0639\u0627\u0645,\u0627\u0644\u0623\u0639\u0631\u0627\u0641,\u0627\u0644\u0623\u0646\u0641\u0627\u0644,\u0627\u0644\u062A\u0648\u0628\u0629,\u064A\u0648\u0646\u0633,\u0647\u0648\u062F,\u064A\u0648\u0633\u0641,\u0627\u0644\u0631\u0639\u062F,\u0625\u0628\u0631\u0627\u0647\u064A\u0645,\u0627\u0644\u062D\u062C\u0631,\u0627\u0644\u0646\u062D\u0644,\u0627\u0644\u0625\u0633\u0631\u0627\u0621,\u0627\u0644\u0643\u0647\u0641,\u0645\u0631\u064A\u0645,\u0637\u0647,\u0627\u0644\u0623\u0646\u0628\u064A\u0627\u0621,\u0627\u0644\u062D\u062C,\u0627\u0644\u0645\u0624\u0645\u0646\u0648\u0646,\u0627\u0644\u0646\u0648\u0631,\u0627\u0644\u0641\u0631\u0642\u0627\u0646,\u0627\u0644\u0634\u0639\u0631\u0627\u0621,\u0627\u0644\u0646\u0645\u0644,\u0627\u0644\u0642\u0635\u0635,\u0627\u0644\u0639\u0646\u0643\u0628\u0648\u062A,\u0627\u0644\u0631\u0648\u0645,\u0644\u0642\u0645\u0627\u0646,\u0627\u0644\u0633\u062C\u062F\u0629,\u0627\u0644\u0623\u062D\u0632\u0627\u0628,\u0633\u0628\u0623,\u0641\u0627\u0637\u0631,\u064A\u0633,\u0627\u0644\u0635\u0627\u0641\u0627\u062A,\u0635,\u0627\u0644\u0632\u0645\u0631,\u063A\u0627\u0641\u0631,\u0641\u0635\u0644\u062A,\u0627\u0644\u0634\u0648\u0631\u0649,\u0627\u0644\u0632\u062E\u0631\u0641,\u0627\u0644\u062F\u062E\u0627\u0646,\u0627\u0644\u062C\u0627\u062B\u064A\u0629,\u0627\u0644\u0623\u062D\u0642\u0627\u0641,\u0645\u062D\u0645\u062F,\u0627\u0644\u0641\u062A\u062D,\u0627\u0644\u062D\u062C\u0631\u0627\u062A,\u0642,\u0627\u0644\u0630\u0627\u0631\u064A\u0627\u062A,\u0627\u0644\u0637\u0648\u0631,\u0627\u0644\u0646\u062C\u0645,\u0627\u0644\u0642\u0645\u0631,\u0627\u0644\u0631\u062D\u0645\u0646,\u0627\u0644\u0648\u0627\u0642\u0639\u0629,\u0627\u0644\u062D\u062F\u064A\u062F,\u0627\u0644\u0645\u062C\u0627\u062F\u0644\u0629,\u0627\u0644\u062D\u0634\u0631,\u0627\u0644\u0645\u0645\u062A\u062D\u0646\u0629,\u0627\u0644\u0635\u0641,\u0627\u0644\u062C\u0645\u0639\u0629,\u0627\u0644\u0645\u0646\u0627\u0641\u0642\u0648\u0646,\u0627\u0644\u062A\u063A\u0627\u0628\u0646,\u0627\u0644\u0637\u0644\u0627\u0642,\u0627\u0644\u062A\u062D\u0631\u064A\u0645,\u0627\u0644\u0645\u0644\u0643,\u0627\u0644\u0642\u0644\u0645,\u0627\u0644\u062D\u0627\u0642\u0629,\u0627\u0644\u0645\u0639\u0627\u0631\u062C,\u0646\u0648\u062D,\u0627\u0644\u062C\u0646,\u0627\u0644\u0645\u0632\u0645\u0644,\u0627\u0644\u0645\u062F\u062B\u0631,\u0627\u0644\u0642\u064A\u0627\u0645\u0629,\u0627\u0644\u0625\u0646\u0633\u0627\u0646,\u0627\u0644\u0645\u0631\u0633\u0644\u0627\u062A,\u0627\u0644\u0646\u0628\u0623,\u0627\u0644\u0646\u0627\u0632\u0639\u0627\u062A,\u0639\u0628\u0633,\u0627\u0644\u062A\u0643\u0648\u064A\u0631,\u0627\u0644\u0627\u0646\u0641\u0637\u0627\u0631,\u0627\u0644\u0645\u0637\u0641\u0641\u064A\u0646,\u0627\u0644\u0627\u0646\u0634\u0642\u0627\u0642,\u0627\u0644\u0628\u0631\u0648\u062C,\u0627\u0644\u0637\u0627\u0631\u0642,\u0627\u0644\u0623\u0639\u0644\u0649,\u0627\u0644\u063A\u0627\u0634\u064A\u0629,\u0627\u0644\u0641\u062C\u0631,\u0627\u0644\u0628\u0644\u062F,\u0627\u0644\u0634\u0645\u0633,\u0627\u0644\u0644\u064A\u0644,\u0627\u0644\u0636\u062D\u0649,\u0627\u0644\u0634\u0631\u062D,\u0627\u0644\u062A\u064A\u0646,\u0627\u0644\u0639\u0644\u0642,\u0627\u0644\u0642\u062F\u0631,\u0627\u0644\u0628\u064A\u0646\u0629,\u0627\u0644\u0632\u0644\u0632\u0644\u0629,\u0627\u0644\u0639\u0627\u062F\u064A\u0627\u062A,\u0627\u0644\u0642\u0627\u0631\u0639\u0629,\u0627\u0644\u062A\u0643\u0627\u062B\u0631,\u0627\u0644\u0639\u0635\u0631,\u0627\u0644\u0647\u0645\u0632\u0629,\u0627\u0644\u0641\u064A\u0644,\u0642\u0631\u064A\u0634,\u0627\u0644\u0645\u0627\u0639\u0648\u0646,\u0627\u0644\u0643\u0648\u062B\u0631,\u0627\u0644\u0643\u0627\u0641\u0631\u0648\u0646,\u0627\u0644\u0646\u0635\u0631,\u0627\u0644\u0645\u0633\u062F,\u0627\u0644\u0625\u062E\u0644\u0627\u0635,\u0627\u0644\u0641\u0644\u0642,\u0627\u0644\u0646\u0627\u0633').split(',');

const ORN_OPEN = '\uFD3F', ORN_CLOSE = '\uFD3E', AYAH_SEP = '\u06DD', QMARK = '\u061F';
const WORD_SURAH = '\u0633\u0648\u0631\u0629', WORD_AYAH = '\u0622\u064A\u0629', WORD_AYAH2 = '\u0627\u0644\u0622\u064A\u0629', WORD_AYATAN = '\u0627\u0644\u0622\u064A\u062A\u0627\u0646';
const PROCLITIC = ['\u0641', '\u0648', '\u0628', '\u0644'];
const DEICTIC = ['\u0645\u0645\u0627 \u064A\u0644\u064A', '\u0645\u0645\u0651\u0627 \u064A\u0644\u064A', '\u0645\u0645\u0627 \u064A\u0623\u062A\u064A', '\u0641\u064A\u0645\u0627 \u064A\u0644\u064A', '\u0641\u064A\u0645\u0627 \u064A\u0623\u062A\u064A', '\u0645\u0646 \u0627\u0644\u0622\u062A\u064A',
  '\u0645\u0646 \u0627\u0644\u0622\u062A\u064A\u0629', '\u0645\u0646 \u0627\u0644\u062A\u0627\u0644\u064A', '\u0645\u0646 \u0627\u0644\u062A\u0627\u0644\u064A\u0629', '\u0627\u0644\u0622\u062A\u064A\u0629', '\u0627\u0644\u062A\u0627\u0644\u064A\u0629', '\u0627\u0644\u0622\u062A\u064A', '\u0627\u0644\u062A\u0627\u0644\u064A',
  '\u0623\u064A \u0645\u0646 \u0647\u0630\u0647', '\u0623\u064A\u064F\u0651 \u0647\u0630\u0647', '\u0623\u064A \u0645\u0645\u0627', '\u0627\u062E\u062A\u0631 \u0645\u0646', '\u0645\u0646 \u0627\u0644\u062E\u064A\u0627\u0631\u0627\u062A', '\u0627\u0644\u0639\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u062A\u0627\u0644\u064A\u0629'];
const INTERROG = ['\u0645\u0627', '\u0645\u0627\u0630\u0627', '\u0645\u0646', '\u0645\u062A\u0649', '\u0623\u064A\u0646', '\u0643\u064A\u0641', '\u0644\u0645\u0627\u0630\u0627', '\u0647\u0644', '\u0623\u064A', '\u0623\u064A\u0651', '\u0643\u0645',
  '\u0628\u0645', '\u0628\u0645\u0627\u0630\u0627', '\u0641\u064A\u0645\u0646', '\u0639\u0645\u0646', '\u0627\u0630\u0643\u0631', '\u0631\u062A\u0628', '\u0631\u062A\u0651\u0628', '\u0637\u0627\u0628\u0642', '\u0623\u0643\u0645\u0644', '\u0639\u0631\u0651\u0641', '\u0633\u0645\u0651', '\u0628\u0645\u064E'];
/* virtue claims that rest on weak reports -- phase 2 removed them; they must not return */
const WEAK_CLAIMS = ['\u0642\u0644\u0628 \u0627\u0644\u0642\u0631\u0622\u0646', '\u0639\u0631\u0648\u0633 \u0627\u0644\u0642\u0631\u0622\u0646', '\u0644\u0643\u0644 \u0634\u064A\u0621 \u0639\u0631\u0648\u0633', '\u0644\u0643\u0644 \u0634\u064A\u0621 \u0642\u0644\u0628'];
/* a src is real if it names one of these */
const GOOD_SRC = ['\u0627\u0644\u0646\u0634\u0631', '\u063A\u0627\u064A\u0629', '\u062A\u062D\u0641\u0629', '\u0627\u0644\u0641\u0642\u0647', '\u062A\u0641\u0633\u064A\u0631', '\u0635\u062D\u064A\u062D', '\u0633\u0646\u0646', '\u0645\u0633\u0646\u062F', '\u0645\u0633\u062A\u062F\u0631\u0643', '\u0627\u0644\u0628\u062E\u0627\u0631\u064A', '\u0645\u0633\u0644\u0645', '\u0627\u0644\u062A\u0631\u0645\u0630\u064A',
  '\u0623\u0628\u064A \u062F\u0627\u0648\u062F', '\u0627\u0628\u0646 \u0645\u0627\u062C\u0647', '\u0627\u0644\u0646\u0633\u0627\u0626\u064A', '\u0627\u0644\u0637\u0628\u0631\u064A', '\u0627\u0628\u0646 \u0643\u062B\u064A\u0631', '\u0627\u0644\u0633\u0639\u062F\u064A', '\u0633\u0639\u062F\u064A', '\u062A\u064A\u0633\u064A\u0631', '\u0627\u0644\u0642\u0631\u0637\u0628\u064A', '\u0627\u0644\u0648\u0627\u062D\u062F\u064A',
  '\u0627\u0644\u0633\u064A\u0648\u0637\u064A', '\u0627\u0644\u0625\u062A\u0642\u0627\u0646', '\u0645\u0628\u0627\u062D\u062B', '\u0645\u0639\u0627\u0631\u062C', '\u0627\u0644\u0642\u0631\u0622\u0646 \u0627\u0644\u0643\u0631\u064A\u0645', '\u0645\u062A\u0641\u0642', '\u0645\u062A\u0651\u0641\u0642'];

// ---------------------------------------------------------------------------
const FOLD = { 0x06CC: 0x064A, 0x0649: 0x064A, 0x06A9: 0x0643, 0x06AA: 0x0643, 0x06BE: 0x0647,
  0x06C0: 0x0629, 0x06D5: 0x0647, 0x0671: 0x0627, 0x0622: 0x0627, 0x0623: 0x0627,
  0x0625: 0x0627, 0x0629: 0x0647 };
/* Ranges are written out one by one on purpose. Collapsing them into wider spans (or
   letting a mechanical re-escape merge them) silently swallows the Arabic LETTER block
   0620-064A, which makes rasm() return the empty string and every comparison below
   trivially true -- a guard that passes everything. */
const DROP = new RegExp('['
  + '\\u0300-\\u036F'      // combining marks
  + '\\u0610-\\u061A'      // Quranic annotation signs
  + '\\u064B-\\u065F'      // harakat / tanwin / shadda / sukun
  + '\\u0670'              // dagger alif
  + '\\u06D6-\\u06ED'      // small high waqf + Quranic marks
  + '\\u06F0-\\u06FF'      // extended Arabic-Indic digits
  + '\\u0640'              // tatweel
  + '\\u0621'              // standalone hamza
  + '\\u08D3-\\u08FF'      // extended Arabic marks
  + '\\u200B-\\u200F\\uFEFF\\u00A0'  // zero-width / bidi / nbsp
  + '\\u06DD'              // end-of-ayah
  + '\\s*'                 // whitespace and the ayah-separator asterisk
  + ']', 'g');
const rasm = (s) => [...String(s).normalize('NFD').replace(DROP, '')]
  .map((c) => { const n = c.codePointAt(0); return FOLD[n] ? String.fromCodePoint(FOLD[n]) : c; }).join('');
const flat = (s) => String(s || '').replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627')
  .replace(/\u0649/g, '\u064A').replace(/\u0629/g, '\u0647').replace(/[^\u0621-\u064A0-9a-zA-Z]+/g, ' ').trim();
const cp = (s) => [...String(s)].map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');
const AR2EN = (s) => String(s).replace(/[\u0660-\u0669]/g, (c) => c.charCodeAt(0) - 0x0660);

function load(f) {
  if (!fs.existsSync(f)) { console.error('ABORT: not found: ' + f); process.exit(2); }
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { console.error('ABORT: bad JSON ' + f + ' -- ' + e.message); process.exit(2); }
}

// ---- mushaf ----
const M = load(MUSHAF);
const AMAX = {};
for (const k in M) { const [s, a] = k.split(':').map(Number); if (!AMAX[s] || a > AMAX[s]) AMAX[s] = a; }
const AY = Object.keys(M).map((k) => { const [s, a] = k.split(':').map(Number); return { k, s, a, r: rasm(M[k]) }; });
const SURAH_RASM = {};
for (let s = 1; s <= 114; s++) SURAH_RASM[s] = AY.filter((x) => x.s === s).map((x) => x.r).join('');
/* exact-rasm attestation only: an imla'i spelling deliberately does NOT pass */
function attestedExact(text) {
  const r = rasm(text);
  if (r.length < 6) return true;
  if (AY.some((x) => x.r.includes(r))) return true;
  for (let s = 1; s <= 114; s++) if (SURAH_RASM[s].includes(r)) return true;
  return false;
}
function hostsOf(text) {
  const r = rasm(text); const out = new Set();
  if (r.length < 6) return out;
  AY.forEach((x) => { if (x.r.includes(r)) out.add(x.s); });
  for (let s = 1; s <= 114; s++) if (SURAH_RASM[s].includes(r)) out.add(s);
  return out;
}
function atAyah(text, s, a) {
  const r = rasm(text); if (!M[s + ':' + a]) return false;
  let acc = '';
  for (let x = Math.max(1, a - 6); x <= Math.min(AMAX[s], a + 6); x++) {
    acc = '';
    for (let y = x; y <= Math.min(AMAX[s], x + 8); y++) {
      acc += rasm(M[s + ':' + y]);
      if (acc.includes(r) && x <= a && y >= a) return true;
    }
  }
  return false;
}

// ---- shared helpers ----
const stemOf = (q) => (q.type === 'complete' ? String(q.verse || '') : String(q.q || ''));
const optsOf = (q) => q.type === 'mcq' ? (q.choices || []) : q.type === 'complete' ? (q.bank || [])
  : q.type === 'order' ? (q.items || []) : [];
const ansOf = (q) => q.type === 'mcq' ? (q.choices || [])[q.answer]
  : q.type === 'complete' ? (q.bank || [])[q.answer]
  : q.type === 'tf' ? 'TF' : q.type === 'order' ? 'ORDER' : '';
const SN = new Set(SURAH.map(flat));
const isSurahName = (a) => SN.has(flat(String(a).split(WORD_SURAH).join(' ')));
const BLANK = /_{2,}|\.{3}|\u2026/;
const SLOT = '\u0000';   // sentinel: cannot occur in Arabic text
const HASQ = new RegExp('[' + ORN_OPEN + '\u00AB]');
function quotes(t) {
  const out = []; const re = new RegExp(ORN_OPEN + '([^' + ORN_CLOSE + ']+)' + ORN_CLOSE, 'g');
  let m; while ((m = re.exec(String(t || ''))) !== null) out.push(m[1]);
  return out;
}

/* ---- the nine shapes; deterministic, first match wins. Mirrors the phase-2 builder. ---- */
const PATTERNS = ['COMPLETE', 'WHICH_SURAH', 'PREV_NEXT', 'OPEN_CLOSE', 'AYAH_MEANING',
  'WORD_MEANING', 'WHO_MEANT', 'SABAB', 'ORDER_TOPIC'];
function classify(q) {
  const s = stemOf(q), a = ansOf(q);
  if (q.type === 'complete') return 'COMPLETE';
  if (BLANK.test(s) && HASQ.test(s)) return 'COMPLETE';
  if (/(\u0627\u0644\u0622\u064A\u0629\u064F?\s*(\u0627\u0644\u0633\u0627\u0628\u0642\u0629|\u0627\u0644\u062A\u0627\u0644\u064A\u0629)|\u0627\u0644\u0622\u064A\u0629\s*\u0627\u0644\u062A\u064A\s*(\u062A\u0633\u0628\u0642|\u062A\u0644\u064A)|\u0627\u0644\u062A\u064A\s*\u0642\u0628\u0644\u064E\u0647\u0627|\u0627\u0644\u062A\u064A\s*\u0628\u0639\u062F\u064E\u0647\u0627|\u064A\u062A\u0644\u0648\u0647\u0627|\u062A\u0633\u0628\u0642\u064F\u0647\u0627|\u0627\u0644\u0622\u064A\u0629\u0650\s*\u0627\u0644\u062A\u064A\s*\u062A\u0644\u064A\u0647\u0627|\u0645\u0627\s*\u0627\u0644\u0622\u064A\u0629\u064F\s*\u0627\u0644\u062A\u064A)/.test(s)) return 'PREV_NEXT';
  if (/(\u0628\u0645\u0627\u0630\u0627\s*(\u062A\u0628\u062F\u0623|\u062A\u064F\u0628\u062F\u0623|\u062A\u0646\u062A\u0647\u064A|\u062A\u064F\u062E\u062A\u062A\u0645|\u062E\u064F\u062A\u0645\u062A|\u0627\u0641\u062A\u064F\u062A\u062D\u062A)|\u0628\u0645\u064E\s*(\u062A\u0628\u062F\u0623|\u062A\u0646\u062A\u0647\u064A|\u062E\u064F\u062A\u0645\u062A|\u0627\u0641\u062A\u064F\u062A\u062D\u062A)|\u062A\u064F\u062E\u062A\u062A\u0645|\u062E\u064F\u062A\u0645\u062A|\u0627\u0641\u062A\u064F\u062A\u062D\u062A|\u0622\u062E\u0631\u064F\s*\u0622\u064A\u0629\u064D|\u0623\u0648\u0651\u0644\u064F\s*\u0622\u064A\u0629\u064D|\u0628\u0623\u064A\u0650\u0651\s*\u0622\u064A\u0629\u064D\s*(\u062A\u0628\u062F\u0623|\u062A\u0646\u062A\u0647\u064A))/.test(s)) return 'OPEN_CLOSE';
  if (/(\u0641\u0646\u0632\u0644\u062A|\u0641\u0646\u0632\u0644\u064E|\u0641\u0623\u0646\u0632\u0644\u064E|\u0623\u0646\u0632\u0644\u064E\s*\u0627\u0644\u0644\u0647\u064F|\u0646\u0632\u0644\u062A\s*\u0641\u064A|\u0646\u0632\u0644\u064E\s*\u0641\u064A\s*\u0634\u0623\u0646|\u0633\u0628\u0628\u0650?\s*\u0646\u0632\u0648\u0644|\u0641\u064A\u0645\u0646\s*\u0646\u0632\u0644|\u0642\u0627\u0644\u0647\u0627|\u0642\u0650\u064A\u0644\u062A|\u0641\u064A\s*\u0623\u064A\u0650\u0651\s*\u0645\u0648\u0642\u0641|\u0639\u0627\u062A\u0628\u064E|\u0646\u0632\u0644\u064E\s*\u0628\u0633\u0628\u0628\u0650\u0647)/.test(s)) return 'SABAB';
  if (/(\u0645\u0646\s*\u0627\u0644\u0645\u0642\u0635\u0648\u062F\u064F?|\u0645\u064E\u0646\s*\u0627\u0644\u0645\u0642\u0635\u0648\u062F\u064F?|\u0645\u0646\s*\u0647\u0648\s|\u0645\u064E\u0646\s*\u0647\u0648\s|\u0645\u0646\s*\u0647\u0645\s|\u0645\u064E\u0646\s*\u0647\u0645\s|\u0639\u0645\u0651\u0646|\u0645\u0646\s*\u0647\u064A\s|\u0645\u064E\u0646\s*\u0647\u064A\s)/.test(s)) return 'WHO_MEANT';
  if (/(\u0645\u0627\s*\u0645\u0639\u0646\u0649\s*(\u0643\u0644\u0645\u0629|\u0627\u0644\u0641\u0639\u0644|\u0644\u0641\u0638)|\u0645\u0639\u0646\u0649\s*\u0643\u0644\u0645\u0629|\u0627\u0644\u0645\u0631\u0627\u062F\u064F?\s*\u0628\u0643\u0644\u0645\u0629|\u0645\u0627\s*\u0645\u0639\u0646\u0649\s*[\u00AB\uFD3F(]|\u0645\u0627\s*\u0627\u0644\u0645\u0642\u0635\u0648\u062F\u064F?\s*\u0628\u0640?\s*[\u00AB\uFD3F(])/.test(s)) return 'WORD_MEANING';
  if (a !== 'TF' && a !== 'ORDER' && isSurahName(a)) return 'WHICH_SURAH';
  if (HASQ.test(s) || /(\u0645\u0627\s*\u0645\u0639\u0646\u0649|\u062A\u0639\u0646\u064A|\u0645\u0627\s*\u062A\u0641\u0633\u064A\u0631|\u0627\u0644\u0645\u0642\u0635\u0648\u062F\u064F?\s*\u0628\u0627\u0644\u0622\u064A\u0629|\u062F\u0644\u0627\u0644\u0629\u064F|\u0645\u0627\s*\u0627\u0644\u0645\u0642\u0635\u0648\u062F\u064F|\u0645\u0627\s*\u0627\u0644\u0645\u0631\u0627\u062F\u064F)/.test(s)) return 'AYAH_MEANING';
  return 'ORDER_TOPIC';
}
const NEEDS_SRC = ['AYAH_MEANING', 'WORD_MEANING', 'WHO_MEANT', 'SABAB'];

// ---------------------------------------------------------------------------
function fingerprint(q) {
  return crypto.createHash('sha256').update(JSON.stringify(q, Object.keys(q).sort())).digest('hex').slice(0, 16);
}
function emit() {
  const d = load(BANK);
  const outside = {};
  d.questions.forEach((q) => { if (!CATS.includes(q.cat)) outside[q.id] = fingerprint(q); });
  const ids = d.questions.filter((q) => CATS.includes(q.cat)).map((q) => q.id).sort();
  process.stdout.write(JSON.stringify({
    schema: 'quran-quest-golden/v1',
    note: 'ids of the three Quran categories (identity is frozen, content is free to improve) plus fingerprints of every question OUTSIDE them (frozen byte-for-byte).',
    total: d.questions.length,
    quranIds: ids,
    outside,
  }, null, 2) + '\n');
}

function compare(goldenFile) {
  const d = load(BANK);
  const golden = load(goldenFile);
  let hard = 0;
  const fail = (code, id, msg) => { hard++; console.log('  FAIL [' + code + '] ' + id + ' -- ' + msg); };

  const qs = d.questions.filter((q) => CATS.includes(q.cat));
  const byCat = {}; CATS.forEach((c) => byCat[c] = qs.filter((q) => q.cat === c));
  console.log('=== quran-quest-guard ===');
  console.log('bank: ' + BANK + '   quran-category questions: ' + qs.length);

  /* Q1 count + identity */
  if (qs.length !== TOTAL) fail('Q1', '(all)', 'expected ' + TOTAL + ' questions, found ' + qs.length);
  const ids = qs.map((q) => q.id).sort();
  const gids = (golden.quranIds || []).slice().sort();
  if (ids.join('') !== gids.join('')) {
    const lost = gids.filter((i) => !ids.includes(i)), gained = ids.filter((i) => !gids.includes(i));
    lost.forEach((i) => fail('Q1', i, 'id disappeared from the Quran categories'));
    gained.forEach((i) => fail('Q1', i, 'id appeared that the golden does not know'));
  }

  qs.forEach((q) => {
    const id = q.id, stem = stemOf(q), opts = optsOf(q), pat = classify(q);

    /* Q2 every quotation is verbatim mushaf */
    [stem, String(q.q || ''), String(q.why || '')].forEach((field) => {
      quotes(field).forEach((qt) => {
        if (BLANK.test(qt)) return;
        if (rasm(qt).length < 8) return;
        if (!attestedExact(qt)) fail('Q2', id, 'quotation is not verbatim mushaf rasm: ' + cp(qt.slice(0, 32)));
      });
    });

    /* Q3 the src citation points at the right place */
    const m = String(q.src || '').match(new RegExp(WORD_SURAH + '\\s+([^,\u060C\\d]+?)\\s*[\u060C,]?\\s*(?:' +
      WORD_AYATAN + '|' + WORD_AYAH2 + '|' + WORD_AYAH + ')?\\s*[:\\s]?\\s*([\u0660-\u06690-9]+)'));
    if (m) {
      const idx = SURAH.findIndex((x) => flat(x) === flat(m[1].trim()));
      if (idx < 0) fail('Q3', id, 'src names an unknown surah: ' + cp(String(q.src).slice(0, 40)));
      else {
        const s = idx + 1, a = Number(AR2EN(m[2]));
        if (a < 1 || a > AMAX[s]) fail('Q3', id, 'src ayah out of range: surah has ' + AMAX[s] + ', src says ' + a);
        else {
          const qt = quotes(stem).concat(quotes(String(q.why || ''))).filter((x) => !BLANK.test(x) && rasm(x).length >= 8);
          if (qt.length && !qt.some((x) => atAyah(x, s, a)))
            fail('Q3', id, 'no quotation in this question sits at the cited surah/ayah ' + s + ':' + a);
        }
      }
    }

    /* Q4 previous/next really are adjacent */
    if (pat === 'PREV_NEXT') {
      const sm = String(q.q || '').match(new RegExp(WORD_SURAH + '\\s+([^\\u060C,\\u061F?]+?)\\s*[,\\u060C]'));
      const anchor = quotes(String(q.q || ''))[0];
      const answer = ansOf(q);
      if (!sm || !anchor) fail('Q4', id, 'a previous/next question must name its surah and quote the anchor ayah');
      else {
        const idx2 = SURAH.findIndex((x) => flat(x) === flat(sm[1].trim()));
        if (idx2 < 0) fail('Q4', id, 'unknown surah in stem: ' + cp(sm[1].slice(0, 24)));
        else {
          const s = idx2 + 1;
          let pa = -1, pb = -1;
          for (let a = 1; a <= AMAX[s]; a++) {
            if (rasm(M[s + ':' + a]) === rasm(anchor)) pa = a;
            if (rasm(M[s + ':' + a]) === rasm(answer)) pb = a;
          }
          if (pa < 0) fail('Q4', id, 'the quoted anchor is not an ayah of the named surah');
          else if (pb < 0) fail('Q4', id, 'the recorded answer is not an ayah of the named surah');
          else if (Math.abs(pa - pb) !== 1) fail('Q4', id, 'ayat ' + pa + ' and ' + pb + ' are not adjacent');
          else if (pb < 1 || pb > AMAX[s]) fail('Q4', id, 'answer runs off the edge of the surah');
        }
      }
    }

    /* Q5 meaning / who / occasion questions must be sourced */
    if (NEEDS_SRC.includes(pat)) {
      const src = String(q.src || '');
      if (!src.trim()) fail('Q5', id, pat + ' question has no src');
      else if (!GOOD_SRC.some((g) => src.includes(g)))
        fail('Q5', id, pat + ' src names no tafsir or hadith collection: ' + cp(src.slice(0, 36)));
    }

    /* Q6 no discredited virtue claims */
    const blob = flat([q.q, q.verse, q.why, ...(q.choices || []), ...(q.bank || [])].filter(Boolean).join(' '));
    WEAK_CLAIMS.forEach((w) => { if (blob.includes(flat(w))) fail('Q6', id, 'weak-hadith virtue claim: ' + cp(w)); });

    /* Q9 stands without its choices */
    if (flat(stem).length < (q.type === 'complete' ? 5 : 12)) fail('Q9', id, 'stem too short to stand alone');
    // a true/false prompt is a proposition to judge, not a question -- it needs no
    // interrogative and reads fine with the choices hidden.
    const isTF = q.type === 'tf' || (q.type === 'mcq' && opts.length === 2);
    if (q.type !== 'complete' && !isTF) {
      const words = flat(stem).split(' ');
      const asks = /[\u061F:\uFF1A]s*$/.test(String(stem).trim()) || INTERROG.some((w) => {
        const t = flat(w);
        return words.some((x) => x === t || (PROCLITIC.includes(x[0]) && x.slice(1) === t));
      });
      if (!asks) fail('Q9', id, 'stem neither ends in a question mark nor carries an interrogative');
    }
    DEICTIC.forEach((p) => { if (flat(stem).includes(flat(p))) fail('Q9', id, 'points at an unseen list: ' + cp(p)); });
    const fa = flat(ansOf(q));
    const quotedBlob = flat((String(stem).match(new RegExp('[' + ORN_OPEN + '\u00AB][^' + ORN_CLOSE + '\u00BB]+', 'g')) || []).join(' '));
    if (q.type !== 'complete' && fa && fa.length > 3 && flat(stem).includes(fa) && !quotedBlob.includes(fa))
      fail('Q9', id, 'stem contains the answer verbatim');

    /* Q10 exactly one correct answer */
    if (q.type === 'mcq' || q.type === 'complete') {
      if (opts.length < 2) fail('Q10', id, 'fewer than two options');
      if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= opts.length)
        fail('Q10', id, 'answer index out of range');
      const seen = new Map();
      opts.forEach((o, i) => {
        const k = flat(o);
        if (!k) fail('Q10', id, 'blank option at ' + i);
        if (seen.has(k)) fail('Q10', id, 'options ' + seen.get(k) + ' and ' + i + ' are the same');
        seen.set(k, i);
      });
    }
    // a Quranic fill-in must admit exactly one attested completion
    let template = null;
    if (q.type === 'complete') template = BLANK.test(stem) ? stem.replace(BLANK, ' ' + SLOT + ' ') : stem + ' ' + SLOT;
    else { const c = quotes(String(q.q || '')).find((x) => BLANK.test(x)); if (c) template = c.replace(BLANK, ' ' + SLOT + ' '); }
    if (template) {
      const ok = [];
      // an option may carry a parenthetical gloss ("kal-muhl (molten metal)"); the gloss is
      // explanatory, not Quranic, so strip it before testing the completion against the mushaf
      const bare = (o) => String(o).replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
      opts.forEach((o, i) => { if (attestedExact(template.split(SLOT).join(bare(o)))) ok.push(i); });
      if (ok.length !== 1) fail('Q10', id, 'a Quranic fill-in must have exactly ONE attested completion, found ' + ok.length);
      else if (ok[0] !== q.answer) fail('Q10', id, 'the only attested completion is ' + ok[0] + ' but answer=' + q.answer);
    }
    // identify-the-surah questions must quote something unique to one surah
    if (pat === 'WHICH_SURAH' && new RegExp('\u0648\u0631\u062F\u062A \u0647\u0630\u0647').test(String(q.q || ''))) {
      quotes(stem).filter((x) => !BLANK.test(x) && rasm(x).length >= 10).forEach((x) => {
        const h = hostsOf(x);
        if (h.size > 1) fail('Q10', id, 'the quoted ayah occurs in ' + h.size + ' surahs, so more than one option is right');
      });
    }
  });

  /* Q7 duplication inside a category */
  const STOP = new Set(flat('\u0641\u064A \u0645\u0646 \u0645\u0627 \u0647\u0648 \u0647\u064A \u0627\u0644\u062A\u064A \u0627\u0644\u0630\u064A \u0639\u0644\u0649 \u0639\u0646 \u0627\u0644\u0644\u0647 \u0643\u0627\u0646 \u0645\u0627\u0630\u0627 \u0643\u064A\u0641 \u0627\u064A\u0646 \u0645\u062A\u0649 \u0647\u0644 \u0627\u064A \u0643\u0645 \u0642\u0627\u0644 \u062A\u0639\u0627\u0644\u0649 \u0627\u0644\u0646\u0628\u064A \u0627\u0644\u0643\u0631\u064A\u0645 \u0627\u0644\u0642\u0631\u0627\u0646 \u0633\u0648\u0631\u0647 \u0627\u064A\u0647 \u0647\u0630\u0647 \u0630\u0644\u0643 \u0628\u0639\u062F \u0642\u0628\u0644 \u0639\u0646\u062F \u0643\u0644 \u0628\u064A\u0646 \u0645\u0639 \u0627\u0644\u0627 \u0627\u0644\u064A \u0628\u0647 \u0644\u0647\u0627 \u0644\u0647 \u0648\u0645\u0627 \u0648\u0647\u0648 \u0627\u0646\u0647 \u0627\u0630\u0627 \u064A\u0648\u0645').split(' '));
  const tok = (q) => new Set(flat(stemOf(q)).split(' ').filter((w) => w.length > 2 && !STOP.has(w)));
  CATS.forEach((c) => {
    const v = byCat[c];
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) {
      const a = flat(String(ansOf(v[i]))), b = flat(String(ansOf(v[j])));
      if (!a || a !== b || a === 'TF' || a === 'ORDER') continue;
      const A = tok(v[i]), B = tok(v[j]);
      let inter = 0; A.forEach((x) => { if (B.has(x)) inter++; });
      const jac = inter / (A.size + B.size - inter || 1);
      if (jac >= 0.30 && inter >= 3)
        fail('Q7', v[i].id + ' + ' + v[j].id, 'same answer and ' + Math.round(jac * 100) + '% stem overlap');
    }
  });

  /* Q8 shape balance */
  console.log('\n-- shape balance --');
  CATS.forEach((c) => {
    const v = byCat[c], cap = Math.floor(v.length * CAP);
    const dist = {}; v.forEach((q) => { const p = classify(q); dist[p] = (dist[p] || 0) + 1; });
    const line = PATTERNS.map((p) => p + '=' + (dist[p] || 0)).join(' ');
    console.log('  ' + c.padEnd(12) + '(' + v.length + ', cap ' + cap + ')  ' + line);
    PATTERNS.forEach((p) => {
      const n = dist[p] || 0;
      if (n > cap) fail('Q8', c, p + ' is ' + n + ' of ' + v.length + ' (> 25% cap of ' + cap + ')');
      if (n < FLOOR) fail('Q8', c, p + ' is only ' + n + ' (must be at least ' + FLOOR + ')');
    });
  });

  /* Q11 nothing outside the three categories moved */
  const out = golden.outside || {};
  let moved = 0;
  d.questions.forEach((q) => {
    if (CATS.includes(q.cat)) return;
    if (!(q.id in out)) { moved++; fail('Q11', q.id, 'question outside the Quran categories is not in the golden'); return; }
    if (out[q.id] !== fingerprint(q)) { moved++; fail('Q11', q.id, 'question outside the Quran categories was edited'); }
  });
  Object.keys(out).forEach((id) => {
    if (!d.questions.some((q) => q.id === id)) { moved++; fail('Q11', id, 'question vanished from the bank'); }
  });
  if (!moved) console.log('\n  ' + Object.keys(out).length + ' non-Quran questions byte-identical to the golden');
  if (golden.total !== d.questions.length) fail('Q11', '(all)', 'bank size changed: golden=' + golden.total + ' now=' + d.questions.length);

  console.log('\nhard=' + hard + ' soft=0');
  console.log(hard === 0
    ? '=== PASS: the Quran categories are balanced, verbatim, sourced and unique. ==='
    : '=== FAIL: DO NOT COMMIT. ===');
  process.exit(hard === 0 ? 0 : 1);
}

const [, , mode, a1] = process.argv;
if (mode === '--emit') emit();
else if (mode === '--compare') compare(a1 || 'quest-data/quran-quest-golden.json');
else {
  console.error('usage: node quran-quest-guard.cjs --emit    > quest-data/quran-quest-golden.json');
  console.error('       node quran-quest-guard.cjs --compare quest-data/quran-quest-golden.json');
  process.exit(2);
}
