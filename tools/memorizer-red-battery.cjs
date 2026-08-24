// memorizer-red-battery.cjs — the battery behind the memorizer's red marking.
//
// WHAT THIS MEASURES. The memorizer's «سمِّعني» compares what a child recites against the Uthmani
// rasm. Red marking has been OFF since it was built, because the matcher deleted U+0670 and then
// demanded the deleted spelling back: أَعْطَيْنَـٰكَ became «اعطينك», no recogniser ever returns that,
// and a child who recited the ayah perfectly watched the word go red. MEM_RED_FLAGGING and the
// pattern matcher beside it in app.jsx exist to fix that, and this file is the evidence that they
// do -- and, just as importantly, that they did not fix it by agreeing with everything.
//
// TWO NUMBERS COME OUT OF THIS, AND THEY PULL AGAINST EACH OTHER:
//   FALSE RED   -- pairs that are the SAME recitation in two spellings, where a word went red.
//                  On a child reciting the Quran this is real harm, so the target is zero.
//   ESCAPED     -- pairs carrying a REAL error (a word dropped, added, swapped, replaced) where
//                  nothing went red. A lenient miss is not harm, so this one is allowed to be
//                  worse than zero -- but it is stated, never hidden, because a matcher that
//                  greens everything would score a perfect false-red rate.
//
// WHERE THE PAIRS COME FROM, SAID PLAINLY. The EXPECTED side of every pair is real: it is a verse
// of quran-uthmani.json, the same file the screen reads. The HEARD side is DERIVED BY RULE -- this
// file has never heard a child. Each derivation is a named rule that rewrites the rasm the way a
// recogniser plausibly would (write the dagger alef as an alef; drop it; put the hamza on its
// modern seat; ...), and every pair is tagged with the rule that made it. NO PAIR IN HERE IS A
// TRANSCRIPT. What the battery can prove is that the matcher accepts the spellings the rules
// describe and refuses the errors the rules inject; whether those rules are what Chrome's ar-SA
// recogniser actually emits is a question only a real child at a real microphone can settle.
//
// WHAT IS TESTED IS THE SHIPPED CODE. Every function is hoisted out of app.jsx -- the file
// tools/build-app.cjs compiles into the bundle -- by the same route attribution-guard uses. There
// is no second copy of the matcher in this file to drift from the first.
//
// USAGE
//   node tools/memorizer-red-battery.cjs           the two numbers, the per-category table
//   node tools/memorizer-red-battery.cjs --verbose  every failing pair, with its rule and its states
// EXIT  0 when the false-red count is zero and every category meets the bar declared below.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babelParser = require('@babel/parser');

const REPO = path.join(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');

/* ---------------------------------------------------------------------------------------------
 * 1. HOIST THE SHIPPED MATCHER
 * ------------------------------------------------------------------------------------------- */
const BB = require('./babel-block.cjs');
const raw = BB.readBabelBlock({ file: path.join(REPO, 'index.html'), html: fs.readFileSync(path.join(REPO, 'index.html'), 'utf8') }).raw;
const ast = babelParser.parse(raw, { sourceType: 'script', plugins: ['jsx'] });

function initializer(name) {
  for (const statement of ast.program.body) {
    if (statement.type !== 'VariableDeclaration') continue;
    const d = statement.declarations.find((it) => it.id && it.id.type === 'Identifier' && it.id.name === name && it.init);
    if (d) return raw.slice(d.init.start, d.init.end);
  }
  return '';
}
const sandbox = {};
vm.createContext(sandbox);
const HOISTED = [
  'MEM_RED_FLAGGING', 'RECITE_RED_HAMZAT', 'RECITE_RED_DAGGER', 'RECITE_RED_SMALL_WAW',
  'RECITE_RED_SMALL_YA', 'RECITE_RED_SMALL_HIGH_YA', 'RECITE_RED_HAMZA_ABOVE',
  'RECITE_RED_SILENT', 'RECITE_RED_DROP', 'reciteRedAccepts', 'recitePattern',
  'normalizeHeardRed', 'tokenizeHeardRed', 'patternsForVerse', 'redWordSim',
  'RECITE_RED_THRESHOLD', 'RECITE_RED_MAX_RUN', 'redSplitsInTwo', 'redJoinsInTwo',
  'alignReciteRed',
  // the flag-off path, hoisted only so the token rules can be compared for drift
  'normalizeForRecite', 'tokenizeForRecite',
];
const missing = [];
for (const name of HOISTED) {
  const src = initializer(name);
  if (!src) { missing.push(name); continue; }
  sandbox[name] = vm.runInContext('(' + src + ')', sandbox);
}
if (missing.length) {
  console.error('app.jsx does not expose as a structural unit: ' + missing.join(', '));
  process.exit(1);
}
const {
  recitePattern, normalizeHeardRed, tokenizeHeardRed, patternsForVerse,
  alignReciteRed, redWordSim, tokenizeForRecite, RECITE_RED_THRESHOLD, RECITE_RED_MAX_RUN,
} = sandbox;

const QURAN = JSON.parse(fs.readFileSync(path.join(REPO, 'quran-uthmani.json'), 'utf8'));

/* ---------------------------------------------------------------------------------------------
 * 2. THE DERIVATION RULES
 *
 * Each takes the Uthmani word (or verse) and returns the spelling a recogniser plausibly emits
 * for the SAME sound. Nothing in here changes which word is being said -- that is the whole
 * contract, and §2 of the order refuses any rule that breaks it. The two rules that would have
 * broken it are recorded at the bottom of this file under REFUSED, with the reason.
 * ------------------------------------------------------------------------------------------- */
const D = 'ٰ', SW = 'ۥ', SY = 'ۦ', SHY = 'ۧ', HA = 'ٔ';
const SILENT = /[۟۠]/;
const MARK = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/;
const HARAKAH = /[ً-ْ]/;
const bare = (w) => w.replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '');

// R1 · the dagger alef WRITTEN as the alef it is pronounced as (ذَٰلِكَ ⟶ «ذالك»)
// REFUSED DERIVATION, recorded rather than quietly dropped: ى + ٰ is NOT written «ىا». The
// alef maqsura already IS the long a, and «علىا» for عَلَىٰ is a spelling no reader and no
// recogniser produces. Deriving it and then demanding the matcher accept it would have been
// asking the matcher to green «عليا» -- a different word (العُليا) -- for «على».
const r1DaggerWritten = (w) => {
  let out = '', lastBase = '';
  for (const ch of w) {
    if (ch === D) { if (lastBase !== 'ى') out += 'ا'; continue; }
    if (MARK.test(ch)) continue;
    out += ch; lastBase = ch;
  }
  return out;
};
// R2 · the dagger alef simply GONE, which is what plain mark-stripping leaves (ذَٰلِكَ ⟶ «ذلك»)
const r2DaggerDropped = (w) => bare(w);
// R3 · the hamza of wasl written as a plain alef (ٱلْكِتَـٰبُ ⟶ «الكتاب»)
const r3WaslPlain = (w) => bare(w).replace(/ٱ/g, 'ا');
// R4 · the hamza of wasl ELIDED, as it is when the word is joined (وَٱدْعُوا۟ ⟶ «ودعوا»)
const r4WaslElided = (w) => bare(w).replace(/(.)ٱ/g, '$1');
// R5 · a letter marked ۟ ۠ dropped, because it is drawn and not said (كَفَرُوا۟ ⟶ «كفرو»)
const r5SilentDropped = (w) => {
  let out = '';
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    if (MARK.test(ch)) continue;
    let j = i + 1, silent = false;
    while (j < w.length && MARK.test(w[j])) { if (SILENT.test(w[j])) silent = true; j++; }
    if (!silent) out += ch;
  }
  return out;
};
// R6 · the same letter KEPT, because modern spelling keeps it (كَفَرُوا۟ ⟶ «كفروا»)
const r6SilentKept = (w) => bare(w);
// R7 · واو/ياء الصلة written out (عِندَهُۥ ⟶ «عندهو»)
const r7PronounWritten = (w) => bare(w.replace(new RegExp(SW, 'g'), 'و#').replace(new RegExp('[' + SY + SHY + ']', 'g'), 'ي#')).replace(/#/g, '');
// R8 · واو/ياء الصلة not written (عِندَهُۥ ⟶ «عنده»)
const r8PronounDropped = (w) => bare(w);
// R9 · a seatless hamza given a seat (يَسْـَٔلُونَ ⟶ «يسألون»)
const r9HamzaSeated = (w) => bare(w.replace(new RegExp('([^' + MARK.source + '])([\\u064B-\\u0652]*)' + HA, 'g'), '$1أ#')).replace(/#/g, '');
// R10 · every hamza bare (سَوَآءٌ ⟶ «سواء», أَنذَرْتَهُمْ ⟶ «ءنذرتهم»)
const r10HamzaBare = (w) => bare(w).replace(/[أإآؤئ]/g, 'ء');
// R11 · the hamza not written at all, only its seat (أُو۟لَـٰٓئِكَ ⟶ «اوليك»)
const r11HamzaDropped = (w) => bare(w).replace(/[أإآٱ]/g, 'ا').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '');
// R12 · التاء المربوطة heard as a ha, which is the pause form (بَرَآءَةٌ ⟶ «براءه»)
const r12TaHa = (w) => bare(w).replace(/ة/g, 'ه');
// R13 · ... and as an open ta, which is the continuation form (بَرَآءَةٌ ⟶ «براءت»)
const r13TaTa = (w) => bare(w).replace(/ة/g, 'ت');
// R14 · الألف المقصورة written as an alef (عَلَىٰ ⟶ «علا»)
const r14MaqsuraAlef = (w) => bare(w).replace(/ى/g, 'ا');
// R15 · ... and as a ya, which is how ar-SA usually writes it (عَلَىٰ ⟶ «علي»)
const r15MaqsuraYa = (w) => bare(w).replace(/ى/g, 'ي');
// R16 · إشباع الحركة: the case vowel heard as its long vowel (رَبِّ ⟶ «ربي»)
const r16Saturation = (w) => {
  const b = bare(w);
  if (!b) return b;
  const at = w.lastIndexOf(b[b.length - 1]);
  const tail = at === -1 ? '' : w.slice(at + 1);
  const sat = /[ًَ]/.test(tail) ? 'ا' : /[ٌُ]/.test(tail) ? 'و' : /[ٍِ]/.test(tail) ? 'ي' : '';
  return b + sat;
};
// R17 · الوقف: nothing after the last consonant at all -- which mark-stripping already gives
const r17WaqfBare = (w) => bare(w);
// R24 · التنوين: ألف التنوين dropped, which is what the word sounds like joined to the next
//       (ذَهَبًا ⟶ «ذهب»). Its counterpart -- keeping it -- is R17.
const r24TanwinAlefDropped = (w) => bare(w.replace(/ًا/g, 'ً'));
// R20 · the recogniser keeping a tatweel it should not
const r20Tatweel = (w) => bare(w).replace(/(.)$/, '$1ـ');
// R21 · ALL of the plain-modern choices at once -- the single most plausible spelling a recogniser
//       returns for a word of the rasm.
const r21Modern = (w) => r15MaqsuraYa(r12TaHa(r3WaslPlain(r6SilentKept(r2DaggerDropped(w)))));
// R22 · the same, but writing every madd the rasm only marks
const r22ModernMadd = (w) => r15MaqsuraYa(r12TaHa(r3WaslPlain(r6SilentKept(r7PronounWritten(r1DaggerWritten(w))))));

const WORD_RULES = [
  ['R1-DAGGER-WRITTEN', r1DaggerWritten, (w) => w.indexOf(D) !== -1],
  ['R2-DAGGER-DROPPED', r2DaggerDropped, (w) => w.indexOf(D) !== -1],
  ['R3-WASL-PLAIN', r3WaslPlain, (w) => w.indexOf('ٱ') !== -1],
  ['R4-WASL-ELIDED', r4WaslElided, (w) => /(.)ٱ/.test(w)],
  ['R5-SILENT-DROPPED', r5SilentDropped, (w) => SILENT.test(w)],
  ['R6-SILENT-KEPT', r6SilentKept, (w) => SILENT.test(w)],
  ['R7-PRONOUN-WRITTEN', r7PronounWritten, (w) => new RegExp('[' + SW + SY + SHY + ']').test(w)],
  ['R8-PRONOUN-DROPPED', r8PronounDropped, (w) => new RegExp('[' + SW + SY + SHY + ']').test(w)],
  ['R9-HAMZA-SEATED', r9HamzaSeated, (w) => w.indexOf(HA) !== -1],
  ['R10-HAMZA-BARE', r10HamzaBare, (w) => /[أإآؤئ]/.test(w)],
  ['R11-HAMZA-DROPPED', r11HamzaDropped, (w) => /[أإآؤئء]/.test(w)],
  ['R12-TA-HA', r12TaHa, (w) => w.indexOf('ة') !== -1],
  ['R13-TA-TA', r13TaTa, (w) => w.indexOf('ة') !== -1],
  ['R14-MAQSURA-ALEF', r14MaqsuraAlef, (w) => w.indexOf('ى') !== -1],
  ['R15-MAQSURA-YA', r15MaqsuraYa, (w) => w.indexOf('ى') !== -1],
  ['R16-SATURATION', r16Saturation, (w) => HARAKAH.test(w.slice(-2))],
  ['R17-WAQF-BARE', r17WaqfBare, () => true],
  ['R24-TANWIN-ALEF-DROPPED', r24TanwinAlefDropped, (w) => /ًا/.test(w)],
  ['R20-TATWEEL', r20Tatweel, () => true],
  ['R21-MODERN', r21Modern, () => true],
  ['R22-MODERN-MADD', r22ModernMadd, () => true],
];

/* ---------------------------------------------------------------------------------------------
 * 3. THE PAIRS
 * ------------------------------------------------------------------------------------------- */
// A deterministic spread over the whole mushaf: short surahs and long ones, first ayat and last.
// No randomness -- the same run twice gives the same battery, so a regression is a regression.
const KEYS = Object.keys(QURAN);
const pick = (n, offset) => {
  const out = [];
  const stride = Math.max(1, Math.floor(KEYS.length / n));
  for (let i = 0; i < n; i++) {
    const k = KEYS[(offset + i * stride) % KEYS.length];
    const words = QURAN[k].split(/\s+/).filter((w) => normalizeHeardRed(w));
    if (words.length >= 3) out.push({ key: k, verse: QURAN[k], words });
  }
  return out;
};

const pairs = [];
const add = (cat, rule, verse, heardWords, expectRed, note) =>
  pairs.push({ cat, rule, verse: verse.verse, key: verse.key, heard: heardWords.join(' '), expectRed, note: note || '' });

// ---- CATEGORY 1 · the same recitation, letter for letter. Green, always. ----
for (const v of pick(250, 0)) add(1, 'R0-RASM-AS-IS', v, v.words, null);
for (const v of pick(250, 7)) add(1, 'R17-WAQF-BARE', v, v.words.map(bare), null);

// ---- CATEGORY 2 · the same recitation, a different spelling. Green. ----
for (const [name, fn, applies] of WORD_RULES) {
  let made = 0;
  for (let off = 0; off < KEYS.length && made < 60; off++) {
    const k = KEYS[off * 37 % KEYS.length];
    const words = QURAN[k].split(/\s+/).filter((w) => normalizeHeardRed(w));
    if (words.length < 3) continue;
    if (!words.some(applies)) continue;
    const heard = words.map((w) => (applies(w) ? fn(w) : bare(w)));
    if (heard.some((h) => !normalizeHeardRed(h))) continue;   // a rule that erased a whole word
    add(2, name, { key: k, verse: QURAN[k], words }, heard, null);
    made++;
  }
}
// R18 · one word of the rasm heard as two (يَـٰٓأَيُّهَا ⟶ «يا أيها»)
{
  let made = 0;
  for (let off = 0; off < KEYS.length && made < 60; off++) {
    const k = KEYS[off * 13 % KEYS.length];
    const words = QURAN[k].split(/\s+/).filter((w) => normalizeHeardRed(w));
    if (words.length < 3) continue;
    const i = words.findIndex((w) => new RegExp('^ي[ً-ْـ]*' + D).test(w));
    if (i === -1) continue;
    const heard = [];
    for (let t = 0; t < words.length; t++) {
      if (t === i) { heard.push('يا'); heard.push(r21Modern(words[t]).replace(/^يا?/, '')); }
      else heard.push(r21Modern(words[t]));
    }
    if (heard.some((h) => !normalizeHeardRed(h))) continue;
    add(2, 'R18-ONE-WORD-HEARD-AS-TWO', { key: k, verse: QURAN[k], words }, heard, null);
    made++;
  }
}
// R19 · two words of the rasm heard as one
{
  let made = 0;
  for (let off = 0; off < KEYS.length && made < 60; off++) {
    const k = KEYS[off * 23 % KEYS.length];
    const words = QURAN[k].split(/\s+/).filter((w) => normalizeHeardRed(w));
    if (words.length < 4) continue;
    const i = 1 + (off % (words.length - 2));
    const heard = [];
    for (let t = 0; t < words.length; t++) {
      if (t === i) { heard.push(r21Modern(words[t]) + r21Modern(words[t + 1])); t++; }
      else heard.push(r21Modern(words[t]));
    }
    add(2, 'R19-TWO-WORDS-HEARD-AS-ONE', { key: k, verse: QURAN[k], words }, heard, null);
    made++;
  }
}

// ---- CATEGORY 3 · a real error. Red, at its own place and nowhere else. ----
const FOREIGN = ['الناس', 'كتاب', 'محمد', 'شجرة', 'الجبل'];
{
  let n = 0;
  for (const v of pick(400, 3)) {
    if (v.words.length < 5) continue;
    const i = 1 + (n % (v.words.length - 2));         // never the last word: see §3 of the report
    const modern = v.words.map(r21Modern);
    // E1 · a word DROPPED
    add(3, 'E1-WORD-DROPPED', v, modern.filter((_, t) => t !== i), [i]);
    // E2 · a word ADDED. This one is REAL and CANNOT BE SHOWN, and saying so is the point of
    // keeping it in the battery. The screen colours the mushaf's own words; the child's words are
    // never rendered and never stored (that is a standing contract of this screen, and the theme
    // guard checks it). An inserted word therefore has no square to turn red. What the matcher
    // MUST do is leave the real words alone -- reddening a neighbour because something was slipped
    // in beside it would be the false red this whole exercise exists to remove -- so the expected
    // verdict here is GREEN, and the escape is declared in the report rather than counted away.
    const ins = modern.slice(); ins.splice(i, 0, FOREIGN[n % FOREIGN.length]);
    add(3, 'E2-WORD-ADDED', v, ins, null, 'a real error the screen has no square to show');
    // E3 · a word REPLACED by another word
    const sub = modern.slice(); sub[i] = FOREIGN[(n + 2) % FOREIGN.length];
    add(3, 'E3-WORD-REPLACED', v, sub, [i]);
    // E4 · two words in the WRONG ORDER
    const sw = modern.slice(); const t = sw[i]; sw[i] = sw[i + 1]; sw[i + 1] = t;
    add(3, 'E4-WORDS-TRANSPOSED', v, sw, [i, i + 1]);
    n++;
    if (n >= 150) break;
  }
}

// ---- CATEGORY 4 · the recogniser's own defects. Not the child's fault, so not red. ----
{
  let n = 0;
  for (const v of pick(400, 11)) {
    if (v.words.length < 8) continue;
    const i = 1 + (n % (v.words.length - 3));
    const modern = v.words.map(r21Modern);
    // S1 · one word came back CUT SHORT.
    // SIX LETTERS IS THE FLOOR, AND IT IS A MEASUREMENT, NOT A CONVENIENCE. Cutting the tail off a
    // short word does not make a damaged word, it makes a DIFFERENT one: عنها becomes «عنه»,
    // منهم becomes «منه», فكلا becomes «فكل». All three are ordinary Arabic words with their own
    // meanings, and a matcher that greened them would be greening a real slip. Below six letters
    // a one-letter truncation is not distinguishable from an error by anything in this tree, and
    // pretending otherwise would be writing the battery to agree with the matcher.
    const cut = modern.slice();
    const long1 = cut.findIndex((w, t) => t > 0 && t < cut.length - 1 && w.length >= 6);
    if (long1 !== -1) { cut[long1] = cut[long1].slice(0, cut[long1].length - 1); add(4, 'S1-WORD-CUT-SHORT', v, cut, null); }
    // S1b · TWO letters gone off the tail of a longer word
    const cut2 = modern.slice();
    // 2 letters gone out of N scores 1 - 2/N, and the bar is 0.8, so N >= 10 is where a
    // double truncation can survive at all. Below that the matcher cannot pass it without
    // the bar moving, and the bar is inherited from the flag-off path and was not moved.
    const long2 = cut2.findIndex((w, t) => t > 0 && t < cut2.length - 1 && w.length >= 10);
    if (long2 !== -1) { cut2[long2] = cut2[long2].slice(0, cut2[long2].length - 2); add(4, 'S1B-WORD-CUT-TWICE', v, cut2, null); }
    // S4 · the recogniser's first segment lost, so the child's words start mid-ayah. Nothing
    //      before the first thing it caught may redden: those words were said, just not received.
    // THREE WORDS IS THE FLOOR HERE FOR THE SAME REASON THE RUN CAP IS TWO. Losing one or two
    // words off the front is not distinguishable from a child who started late, and §3 requires
    // a dropped word to redden -- so a two-word derivation here would be asking the matcher to
    // unlearn the thing it was just made to do. A lost SEGMENT is three words or more, and
    // that is what the recogniser actually drops when it restarts.
    const lost = 3 + (n % 3);
    if (lost + 2 < modern.length) add(4, 'S4-OPENING-LOST', v, modern.slice(lost), null, lost + ' words lost off the front');
    // S5 · the recogniser stopped early. The tail is 'pending', never red.
    add(4, 'S5-TAIL-LOST', v, modern.slice(0, modern.length - 2), null);
    // S2 · one word came back TWICE
    const rep = modern.slice(); rep.splice(i, 0, modern[i]); add(4, 'S2-WORD-REPEATED', v, rep, null);
    // S3 · a SILENCE in the middle swallowed a run of words
    const run = 3 + (n % 3);
    if (i + run < modern.length - 1) {
      add(4, 'S3-SILENCE-SWALLOWED-A-RUN', v, modern.filter((_, t) => t < i || t >= i + run), null,
        run + ' words missing');
    }
    n++;
    if (n >= 60) break;
  }
}

/* ---------------------------------------------------------------------------------------------
 * 4. RUN
 * ------------------------------------------------------------------------------------------- */
const G = { matched: '.', mismatch: 'X', pending: '-' };
const byCat = new Map();
const byRule = new Map();
let falseRedPairs = 0, greenPairs = 0, escapedPairs = 0, redPairs = 0, spreadPairs = 0, nearPairs = 0;
const failures = [];

for (const p of pairs) {
  const pats = patternsForVerse(p.verse);
  const states = alignReciteRed(pats, tokenizeHeardRed(p.heard));
  const reds = [];
  for (let k = 0; k < states.length; k++) if (states[k] === 'mismatch') reds.push(k);
  const bucket = (m, key) => { if (!m.has(key)) m.set(key, { n: 0, falseRed: 0, escaped: 0, spread: 0 }); return m.get(key); };
  const bc = bucket(byCat, p.cat), br = bucket(byRule, p.rule);
  bc.n++; br.n++;
  let bad = '';
  if (p.expectRed === null) {
    greenPairs++;
    if (reds.length) { falseRedPairs++; bc.falseRed++; br.falseRed++; bad = 'FALSE RED at ' + reds.join(','); }
  } else {
    redPairs++;
    const hit = p.expectRed.some((i) => reds.indexOf(i) !== -1);
    // OFF BY ONE IS NOT AN ESCAPE. When the dropped word and its neighbour are near-twins --
    // 9:74 drops وَلِىٍّ and the next word is وَلَا -- the alignment can claim the neighbour and
    // redden the twin instead. The child still sees red at the place they slipped, which is the
    // whole job, so it is counted apart rather than as a miss or as a clean hit.
    const near = !hit && p.expectRed.some((i) => reds.indexOf(i - 1) !== -1 || reds.indexOf(i + 1) !== -1);
    if (near) { nearPairs++; bc.near = (bc.near || 0) + 1; br.near = (br.near || 0) + 1; }
    if (!hit && !near) { escapedPairs++; bc.escaped++; br.escaped++; bad = 'ESCAPED (expected red at ' + p.expectRed.join(',') + ')'; }
    const allowed = new Set(p.expectRed);
    const strays = reds.filter((i) => !allowed.has(i) && !allowed.has(i - 1) && !allowed.has(i + 1));
    if (strays.length) { spreadPairs++; bc.spread++; br.spread++; bad = (bad ? bad + ' · ' : '') + 'SPREAD to ' + strays.join(','); }
  }
  if (bad) failures.push({ p, states, bad });
}

const pct = (a, b) => (b === 0 ? '—' : (100 * a / b).toFixed(2) + '%');
console.log('\n=== المحفّظ · بطاريّةُ التمييزِ الأحمر ===');
console.log('pairs: ' + pairs.length + '   (expected green ' + greenPairs + ' · expected red ' + redPairs + ')');
console.log('');
console.log('  FALSE RED   ' + falseRedPairs + '/' + greenPairs + '  = ' + pct(falseRedPairs, greenPairs)
  + '   (a correct recitation reddened -- the number that must be zero)');
console.log('  ESCAPED     ' + escapedPairs + '/' + redPairs + '  = ' + pct(escapedPairs, redPairs)
  + '   (a real error not reddened -- lenient, stated, not hidden)');
console.log('  OFF BY ONE  ' + nearPairs + '/' + redPairs + '  = ' + pct(nearPairs, redPairs)
  + '   (reddened, but on the twin beside the slip -- still shown at the place)');
console.log('  SPREAD      ' + spreadPairs + '/' + redPairs + '  = ' + pct(spreadPairs, redPairs)
  + '   (red reaching a word that was not the slip)');

console.log('\n-- by category --');
const CATNAME = { 1: 'مطابقٌ تامًّا', 2: 'رسمٌ يختلف · نطقٌ واحد', 3: 'خطأٌ حقيقيّ', 4: 'عيبٌ في التعرّفِ على الكلام' };
for (const c of [1, 2, 3, 4]) {
  const b = byCat.get(c); if (!b) continue;
  console.log('  ' + c + '. ' + CATNAME[c].padEnd(26) + ' pairs ' + String(b.n).padStart(4)
    + '   falseRed ' + String(b.falseRed).padStart(3) + '   escaped ' + String(b.escaped).padStart(3) + '   offByOne ' + String(b.near || 0).padStart(3)
    + '   spread ' + String(b.spread).padStart(3));
}

console.log('\n-- by rule --');
for (const [name, b] of byRule) {
  const state = b.falseRed ? 'FALSE RED x' + b.falseRed : b.escaped ? 'escaped x' + b.escaped : b.spread ? 'spread x' + b.spread : b.near ? 'covered (x' + b.near + ' on the twin beside it)' : 'covered';
  console.log('  ' + name.padEnd(30) + String(b.n).padStart(4) + ' pairs   ' + state);
}

if (VERBOSE && failures.length) {
  console.log('\n-- failing pairs --');
  for (const f of failures.slice(0, 80)) {
    console.log('  [' + f.p.rule + '] ' + f.p.key + '  ' + f.bad);
    console.log('      rasm  : ' + f.p.verse);
    console.log('      heard : ' + f.p.heard);
    console.log('      states: ' + f.states.map((x) => G[x]).join(''));
  }
  if (failures.length > 80) console.log('  ... and ' + (failures.length - 80) + ' more');
}

/* ---------------------------------------------------------------------------------------------
 * 5. THE INVARIANTS THE BATTERY ENFORCES
 * ------------------------------------------------------------------------------------------- */
console.log('\n-- invariants --');
let hard = 0;
const inv = (label, cond, detail) => {
  console.log('  ' + (cond ? 'PASS  ' : 'FAIL  ') + label + (cond || !detail ? '' : '\n        ' + detail));
  if (!cond) hard++;
};
inv('no correct recitation was reddened', falseRedPairs === 0, falseRedPairs + ' pairs went red');
// Every word of the mushaf must match ITSELF exactly. This is the floor under everything above:
// if the rasm does not match the rasm, no derived spelling means anything.
{
  let n = 0, bad = 0, worst = null;
  for (const k of KEYS) {
    for (const w of QURAN[k].split(/\s+/)) {
      const h = normalizeHeardRed(w); if (!h) continue;
      n++;
      const s = redWordSim(recitePattern(w), h);
      if (s < 1) { bad++; if (!worst) worst = k + ' ' + w + ' -> ' + h + ' = ' + s.toFixed(3); }
    }
  }
  inv('every one of the ' + n + ' words of the mushaf matches its own rasm at 1.000', bad === 0, worst);
}
// The two paths must agree on WHAT A WORD IS, or the offsets the screen slices with are wrong.
{
  let bad = 0, worst = null;
  for (const k of KEYS) {
    const a = tokenizeForRecite(QURAN[k]).length, b = patternsForVerse(QURAN[k]).length;
    if (a !== b) { bad++; if (!worst) worst = k + ': tokenizeForRecite ' + a + ' vs patternsForVerse ' + b; }
  }
  inv('patternsForVerse and tokenizeForRecite cut every one of the ' + KEYS.length + ' verses into the same number of words', bad === 0, worst);
}
// A rule that made two DIFFERENT words the same would be erasing meaning, not spelling. These are
// the pairs §2 of the order says must be REFUSED, and they are checked rather than promised.
{
  const REFUSED = [
    ['قَالَ', 'قل', 'قال / قل — a real alef in the rasm is not a madd mark'],
    ['قَالَ', 'قيل', 'قال / قيل'],
    ['كَانَ', 'كن', 'كان / كن'],
    ['عالم', 'علم', 'عالم / علم'],
    ['نُور', 'نار', 'نور / نار — two long vowels are not interchangeable'],
    ['سامع', 'سميع', 'سامع / سميع'],
    ['مُلك', 'ملاك', 'ملك / ملاك'],
    ['عَلَىٰ', 'عليا', 'على / عليا — the refused ى+ٰ derivation, checked from the other side'],
    ['عَنْهَا', 'عنه', 'عنها / عنه'],
    ['مِّنْهُمْ', 'منه', 'منهم / منه'],
    ['فَكُلَا', 'فكل', 'فكلا / فكل'],
    ['رَبِّ', 'ربنا', 'رب / ربنا'],
    ['خَلَقَ', 'خلق', null],          // the same word: this one MUST match, and anchors the list
    ['ٱلْحَمْدُ', 'الحمد', null],
  ];
  let bad = 0, worst = null, apart = 0, same = 0;
  for (const [word, other, why] of REFUSED) {
    const s = redWordSim(recitePattern(word), normalizeHeardRed(other));
    // A null reason means the two ARE the same word: it must still match, so the list cannot be
    // satisfied by a matcher that simply refuses everything.
    if (why === null) { same++; if (s < 1) { bad++; if (!worst) worst = word + ' no longer matches itself (' + s.toFixed(3) + ')'; } continue; }
    apart++;
    if (s >= RECITE_RED_THRESHOLD) { bad++; if (!worst) worst = why + ' scored ' + s.toFixed(3); }
  }
  inv('no rule folds two words of different meaning together (' + apart + ' kept apart, ' + same + ' kept together)', bad === 0, worst);

  // WHAT THE 0.8 BAR LETS THROUGH, STATED RATHER THAN DISCOVERED LATER. These are pairs the
  // matcher DOES fold, measured here so the number is on the page. They are inflections, not
  // different words, and the bar that would separate them is the same bar that reddens a correct
  // recitation -- 0.8 is inherited from the flag-off path and was not moved for this work.
  const LENIENT = [
    ['ٱلْعَـٰلَمِينَ', 'العالمون', 'a case ending inside a nine-letter word: one letter in nine'],
    ['يَعْمَلُونَ', 'تعملون', 'third person for second: one letter in seven'],
    ['يَعْلَمُ', 'يعلمون', 'singular for plural: one letter in six'],
    ['ٱلنَّاسِ', 'الناسك', 'a letter added to a five-letter word: one letter in six'],
  ];
  for (const [word, other, why] of LENIENT) {
    const s = redWordSim(recitePattern(word), normalizeHeardRed(other));
    console.log('  ' + (s >= RECITE_RED_THRESHOLD ? 'LENIENT' : 'caught ') + '  ' + word + ' / ' + other
      + '  = ' + s.toFixed(3) + '   ' + why);
  }
}
// THE WHOLE MUSHAF, NOT A SAMPLE. The battery above spreads over the book by stride; this sweeps
// every verse in it, three ways, and is the number the sample is only a shortcut for. Same
// honesty limit: the three spellings are DERIVED, not transcribed.
{
  const SWEEPS = [
    ['as written', (w) => w],
    ['plain modern spelling', r21Modern],
    ['modern spelling with every madd written', r22ModernMadd],
  ];
  for (const [label, fn] of SWEEPS) {
    let verses = 0, words = 0, redVerses = 0, redWords = 0, firstBad = null;
    for (const k of KEYS) {
      const pats = patternsForVerse(QURAN[k]);
      if (!pats.length) continue;
      const heard = QURAN[k].split(/\s+/).map(fn).filter((w) => normalizeHeardRed(w)).join(' ');
      const states = alignReciteRed(pats, tokenizeHeardRed(heard));
      const reds = states.filter((x) => x === 'mismatch').length;
      verses++; words += pats.length;
      if (reds) {
        redVerses++; redWords += reds;
        if (!firstBad) firstBad = k + ': ' + states.map((x) => G[x]).join('') + '  heard: ' + heard;
      }
    }
    inv('the whole mushaf ' + label + ': ' + verses + ' verses / ' + words + ' words, '
      + redVerses + ' verses reddened (' + redWords + ' words)', redVerses === 0, firstBad);
  }
}
inv('the shipped flag is still off', sandbox.MEM_RED_FLAGGING === false,
  'MEM_RED_FLAGGING is ' + sandbox.MEM_RED_FLAGGING + ' -- the app would redden words tonight');
inv('the red path is never reached while the flag is off', /MEM_RED_FLAGGING$/.test('MEM_RED_FLAGGING')
  && raw.indexOf('MEM_RED_FLAGGING\n        ? alignReciteRed(') !== -1
  && raw.indexOf('const shown = MEM_RED_FLAGGING ? currentSlice :') !== -1,
  'the call site no longer guards both the alignment and the shown state on the one constant');

console.log('\nthreshold ' + RECITE_RED_THRESHOLD + ' · red-run cap ' + RECITE_RED_MAX_RUN
  + ' · every heard side in this file is DERIVED BY RULE, not transcribed from a child.\n');
process.exit(hard ? 1 : 0);
