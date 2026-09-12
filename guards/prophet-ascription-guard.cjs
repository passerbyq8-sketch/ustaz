// guards/prophet-ascription-guard.cjs
// A DESCRIPTION OF SOMEONE ELSE MUST NOT REACH THE READER AS NEWS ABOUT THE PROPHET ﷺ.
//
// ── THE MEASURED WITNESS THIS FILE WAS BUILT ON (البند ٣٦ · الباب ب · الطور الأول) ──
//
// MEASURED IN PRODUCTION 2026-09-12, five rounds, new conversation each round, one question:
// «ما هدي النبي صلى الله عليه وسلم في يومه وليلته؟». The record is
// ustaz-archive/sessions/EZIK-ITEM36-LIVE-MEASURE-2026-09-12.md (sha256[0:8] 44d385c6), and its
// §2 is the whole reason this guard exists:
//
//   in prose describing the Prophet's night, round four wrote
//   «وكان ينام نصف الليل، ويقوم ثلثه، وينام سدسه»
//   — and the hadith it came from says that of داود عليه السلام, not of the Prophet ﷺ.
//   The block quoted right after it in the SAME answer said so: «أحب الصلاة إلى الله صلاة
//   داود عليه السلام».
//
// So the reader was handed another man's description as a report about the Prophet ﷺ. That is
// the defect. It is not a missing citation and not an invented matn: every word was true of
// somebody, and the answer moved it.
//
// ── WHAT THIS GUARD IS ALLOWED TO KNOW, AND WHAT IT REFUSES TO KNOW ─────────────────────────
//
// IT USES ONLY EVIDENCE INSIDE THE ANSWER. It does not open a book, does not call the network,
// does not call a model, and does not carry a list of who said what. It cannot: a guard that
// needs to know whose description a sentence is has left the tree and gone to the world.
//
// THE ONE THING IT CAN SEE WITHOUT LEAVING THE ANSWER is the answer contradicting itself:
//
//   * a run of words sits in the prose, and the nearest ascription before it names the Prophet ﷺ;
//   * the same run of words sits inside a TAGGED transmitted matn — a `<hadith>…</hadith>` block —
//     in that same answer, and the nearest ascription before it there names someone else.
//
// One answer, two owners for one sentence. That is measurable here, and nothing else about the
// sentence's truth is.
//
// «ولا يحكم الحارس على متن لم يرد في الجواب نفسه» — if the matn is not in the answer, there is no
// finding, because there is no evidence. The untagged half of item 36 (the same matn travelling
// between «…» with no block, rounds one/three/five of the measurement) is therefore INVISIBLE to
// this guard BY DESIGN, and section D proves that blindness is a decision and not an accident.
//
// ── THE PROPHET FRAME IS BORROWED, NEVER RE-WRITTEN ─────────────────────────────────────────
//
// lib/output-reviewer.js:838 holds `PROPHET_FRAME_RE` and it is the ONLY place in this tree that
// says which spellings name him — section E measures that claim rather than asserting it. This
// guard reads that file and imports the definition off a throw-away copy under os.tmpdir(); the
// copy is the established idiom of guards/output-reviewer-mutant-lib.cjs, and it exists here for
// one reason only: PROPHET_FRAME_RE is module-private and NOTHING IN lib/output-reviewer.js IS
// TOUCHED to make this guard see it. A second spelling list written here would be a second answer
// to «who is the Prophet ﷺ» the day one of them is edited.
//
// Scripture is excluded on the same principle: the ornate parentheses U+FD3F…U+FD3E are the app's
// own declaration of what is scripture (app.jsx, ITEM 28), and a verse quoted in prose and again
// inside a card is not a stolen ascription. Section C drives that trap.
//
// Usage: node guards/prophet-ascription-guard.cjs
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.join(__dirname, '..');
const REVIEWER_REL = 'lib/output-reviewer.js';
const REVIEWER = path.join(REPO, REVIEWER_REL);

let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}

// ── BORROWING THE DEFINITION ────────────────────────────────────────────────────────────────
// The twin is the reviewer's own bytes plus ONE appended export line. Nothing is rewritten, so
// if the spelling list at :838 changes, this guard changes with it on the next run.
const DEFINITION_SEAM = 'const PROPHET_FRAME_RE = ';
const TWIN_EXPORT = '\nexport { PROPHET_FRAME_RE, frameNamesTheProphet };\n';

async function borrowProphetFrame() {
  const source = fs.readFileSync(REVIEWER, 'utf8');
  const seams = source.split(DEFINITION_SEAM).length - 1;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ezik-prophet-ascription-'));
  const twin = path.join(dir, 'output-reviewer-twin.mjs');
  fs.writeFileSync(twin, source + TWIN_EXPORT, 'utf8');
  try {
    const mod = await import(pathToFileURL(twin).href + '?t=' + Date.now());
    return { mod, seams, dir, source };
  } catch (error) {
    return { mod: null, seams, dir, source, error };
  }
}

// ── READING AN ANSWER ───────────────────────────────────────────────────────────────────────

// The diacritics the reviewer itself strips before testing a frame. The system prompt asks for a
// VOWELLED matn inside `<hadith>` (lib/system-prompt.js:815) while prose arrives bare, so without
// this the two halves of the very defect could never be compared.
const ARABIC_MARKS_RE = /[ً-ٰٟۖ-ۭـ]/gu;
const HADITH_BLOCK_RE = /<hadith\b[^>]*>([\s\S]*?)<\/hadith>/giu;
const ANGLE_TAG_RE = /<[^>]*>/gu;
const ORNATE_SPAN_RE = /﴿[\s\S]*?﴾/gu;
const PROSE_QUOTE_RE = /«([^»]*)»/gu;
const WORD_RE = /[\p{L}\p{N}]+/gu;
const SENTENCE_BREAK_RE = /[.!?؟\n؛;:]/u;

const blank = (text, re) => String(text).replace(re, (m) => ' '.repeat(m.length));

// A token stream that remembers WHERE each word sat and WHICH sentence it sat in. The sentence id
// is what stops a shared run from being stitched across a full stop — «جملة» is the unit the order
// names, and a run that straddles two of them is not one sentence's text.
function tokenize(text) {
  const out = [];
  let seg = 0, last = 0, m;
  WORD_RE.lastIndex = 0;
  while ((m = WORD_RE.exec(text)) !== null) {
    const gap = text.slice(last, m.index);
    if (SENTENCE_BREAK_RE.test(gap)) seg++;
    out.push({ w: m[0], at: m.index, seg });
    last = m.index + m[0].length;
  }
  return out;
}

// Every ascription this guard can read off the text itself: a frame that names the Prophet ﷺ
// (borrowed), or an honorific that names somebody — and an honorific whose name IS one of his
// spellings is his, not another's.
function anchorsOf(text, frame, namesTheProphet) {
  const found = [];
  const global = new RegExp(frame.source, frame.flags.includes('g') ? frame.flags : frame.flags + 'g');
  let m;
  while ((m = global.exec(text)) !== null) {
    found.push({ at: m.index, kind: 'prophet', text: m[0] });
    if (m[0] === '') global.lastIndex++;
  }
  const honorific = /([\p{L}ـ]+(?:\s+بن\s+[\p{L}ـ]+)*)\s+(?:عليه\s+السلام|عليها\s+السلام|عليهما\s+السلام|رضي\s+الله\s+عنهما|رضي\s+الله\s+عنهم|رضي\s+الله\s+عنها|رضي\s+الله\s+عنه)/gu;
  while ((m = honorific.exec(text)) !== null) {
    found.push({ at: m.index, kind: namesTheProphet(m[1]) ? 'prophet' : 'other', text: m[0] });
  }
  found.sort((a, b) => a.at - b.at);
  return found;
}

const nearestBefore = (anchors, at) => {
  let hit = null;
  for (const a of anchors) { if (a.at < at) hit = a; else break; }
  return hit;
};

// The longest run of words that sits, unbroken and inside ONE sentence on each side, in both
// streams. This is the measurable form of «ويكون نص الجملة داخلًا في ذلك المتن المنقول».
function longestSharedRun(a, b) {
  let best = { len: 0, aAt: -1, bAt: -1, words: [] };
  const table = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prevDiag = 0;
    for (let j = 1; j <= b.length; j++) {
      const here = table[j];
      if (a[i - 1].w === b[j - 1].w
        && (prevDiag === 0 || (a[i - 1].seg === a[i - 2].seg && b[j - 1].seg === b[j - 2].seg))) {
        table[j] = prevDiag + 1;
        if (table[j] > best.len) {
          best = {
            len: table[j],
            aAt: a[i - table[j]].at,
            bAt: b[j - table[j]].at,
            words: a.slice(i - table[j], i).map((t) => t.w),
          };
        }
      } else table[j] = 0;
      prevDiag = here;
    }
  }
  return best;
}

const MIN_RUN = 6;

/**
 * @param {string} answer  the model's answer, exactly as it left the model
 * @param {object} [opts]  mutation switches — every one of them OFF is the shipped rule
 * @returns {{findings: Array, matns: Array}}
 */
function detectStolenAscription(answer, opts) {
  const o = opts || {};
  const minRun = typeof o.minRun === 'number' ? o.minRun : MIN_RUN;
  let src = String(answer == null ? '' : answer).replace(ARABIC_MARKS_RE, '');
  for (const mark of o.marks || []) src = src.split(mark).join(' '.repeat(mark.length));

  const matns = [];
  HADITH_BLOCK_RE.lastIndex = 0;
  let m;
  while ((m = HADITH_BLOCK_RE.exec(src)) !== null) matns.push({ kind: 'tagged', text: m[1] });

  let prose = blank(src, HADITH_BLOCK_RE);
  if (o.untaggedQuotesAreMatns) {
    PROSE_QUOTE_RE.lastIndex = 0;
    while ((m = PROSE_QUOTE_RE.exec(prose)) !== null) matns.push({ kind: 'quoted', text: m[1] });
    prose = blank(prose, PROSE_QUOTE_RE);
  }
  prose = blank(prose, ANGLE_TAG_RE);

  const scripture = (t) => (o.judgeScripture ? t : blank(t, ORNATE_SPAN_RE));
  prose = scripture(prose);

  const proseTokens = tokenize(prose);
  const proseAnchors = anchorsOf(prose, o.frame, o.namesTheProphet);

  const findings = [];
  matns.forEach((matn, index) => {
    const body = scripture(matn.text);
    const run = longestSharedRun(proseTokens, tokenize(body));
    if (run.len < minRun) return;
    const proseAnchor = nearestBefore(proseAnchors, run.aAt);
    const matnAnchor = nearestBefore(anchorsOf(body, o.frame, o.namesTheProphet), run.bAt);

    const proseSaysProphet = o.ignoreProseAnchor ? true : Boolean(proseAnchor && proseAnchor.kind === 'prophet');
    const matnSaysOther = o.invertMatnAnchor
      ? Boolean(matnAnchor && matnAnchor.kind === 'prophet')
      : Boolean(matnAnchor && matnAnchor.kind === 'other');
    if (!proseSaysProphet || !matnSaysOther) return;

    findings.push({
      run: run.words.join(' '),
      length: run.len,
      matn: index,
      matnKind: matn.kind,
      proseAnchor: proseAnchor ? proseAnchor.text : null,
      matnAnchor: matnAnchor ? matnAnchor.text : null,
    });
  });
  return { findings, matns };
}

// ── THE FIXTURES ────────────────────────────────────────────────────────────────────────────
//
// PROVENANCE, STATED PLAINLY BECAUSE IT LIMITS WHAT THESE PROVE. The five answers of the
// 2026-09-12 measurement were NOT kept on disk — the measurement file records their findings, not
// their bodies. What IS verbatim from that file is the two strings the defect is made of:
//   §2  «وكان ينام نصف الليل، ويقوم ثلثه، وينام سدسه»           — the prose sentence
//   §3  «أحب الصلاة إلى الله صلاة داود عليه السلام»             — the matn that owns it
// Both are transcribed here character for character. The prose around them is RECONSTRUCTED to
// the shape the file describes: a tagged block in rounds two and four, an untagged «…» quote in
// rounds one, three and five. So section A pins the defect's SHAPE on its own measured words, and
// section B pins the four green rounds on their measured tagging — no fixture claims to be a
// transcript.

const WITNESS_PROSE = 'وكان ينام نصف الليل، ويقوم ثلثه، وينام سدسه';
const WITNESS_MATN_HEAD = 'أحب الصلاة إلى الله صلاة داود عليه السلام';
const WITNESS_MATN_TAIL = 'كان ينام نصف الليل، ويقوم ثلثه، وينام سدسه';
const DAWUD_MATN = WITNESS_MATN_HEAD + '، ' + WITNESS_MATN_TAIL;

const ROUND_4 = [
  'هدي النبي صلى الله عليه وسلم في ليله هدي معتدل، لا إفراط فيه ولا تفريط.',
  WITNESS_PROSE + '.',
  '<hadith narrator="عبد الله بن عمرو رضي الله عنهما" ruling="متفق عليه">' + DAWUD_MATN + '</hadith>',
  'وفي هذا تعليم للأمة أن تأخذ من ليلها بنصيب.',
].join('\n');

// Round four with the narrator attribute taken away. The attribute is OUTSIDE the matn and is
// blanked with the tag, so the finding must survive its removal — otherwise the isnad, not the
// ascription inside the matn, would be doing the work.
const ROUND_4_BARE = ROUND_4.replace(/<hadith[^>]*>/, '<hadith>');

const ROUND_2 = [
  'دعني أبحث لك عن جواب موثق من مصادر أهل العلم.',
  'هدي النبي صلى الله عليه وسلم في ليله قسمة بين نوم وقيام، فلم يكن يحيي ليله كله ولم يكن يدعه كله.',
  '<hadith narrator="عبد الله بن عمرو رضي الله عنهما" ruling="متفق عليه">' + DAWUD_MATN + '</hadith>',
  'وهذا الحديث متفق عليه كما ورد في المصدر.',
].join('\n');

const ROUND_1 = [
  'كان من هدي النبي صلى الله عليه وسلم أن يأخذ من الليل حظه من النوم والقيام.',
  'وقد صح عنه أنه قال: «' + DAWUD_MATN + '».',
].join('\n');

const ROUND_3 = [
  'هدي النبي صلى الله عليه وسلم في يومه وليلته هدي وسط بين الشدة والتفريط.',
  'ومن ذلك قوله: «' + DAWUD_MATN + '».',
].join('\n');

const ROUND_5 = [
  'سؤالك عن هدي النبي صلى الله عليه وسلم في ليله، وجوابه أنه كان يقوم ثم ينام ثم يقوم.',
  'وفي الحديث: «' + DAWUD_MATN + '».',
  'فهذا هدي يسير يقدر عليه الصغير والكبير.',
].join('\n');

// ── SECTION C FIXTURES — REVELATION IS NOT TOUCHED ──────────────────────────────────────────

// C1. His own description, in prose and in the block, and the block names him. The twin of
// round four: every byte outside the matn's ascription head is the same shape.
const ABOUT_HIM = [
  'هدي النبي صلى الله عليه وسلم في ليله هدي معتدل، لا إفراط فيه ولا تفريط.',
  WITNESS_PROSE + '.',
  '<hadith narrator="عائشة رضي الله عنها" ruling="متفق عليه">سئل النبي صلى الله عليه وسلم عن قيامه، فأخبر أنه '
    + WITNESS_MATN_TAIL + '</hadith>',
].join('\n');

// C2. A verse quoted in the prose, and the SAME verse arriving inside a `<hadith>` card — the case
// app.jsx ITEM 28 measured — with another man's name ahead of it in the block. Without the ornate
// parentheses being honoured this reads as a stolen ascription, and it is scripture.
const AYAH = '﴿إِنَّ نَاشِئَةَ اللَّيْلِ هِيَ أَشَدُّ وَطْئًا وَأَقْوَمُ قِيلًا﴾';
const SCRIPTURE_CASE = [
  'وكان النبي صلى الله عليه وسلم يحيي ليله بالقرآن، وفيه ' + AYAH + '.',
  '<hadith>وكان داود عليه السلام يقوم من الليل، وفي التنزيل ' + AYAH + '</hadith>',
].join('\n');

// C3. A hadith ascribed to him by a frame that names him, its matn restated in the prose after it.
const FRAMED_TO_HIM = [
  'كان النبي صلى الله عليه وسلم يقسم ليله ثلاثا.',
  '<hadith narrator="عائشة رضي الله عنها" ruling="رواه مسلم">قال رسول الله صلى الله عليه وسلم: من نام عن حزبه أو عن شيء منه فقرأه فيما بين صلاة الفجر وصلاة الظهر كتب له</hadith>',
  'ومن نام عن حزبه أو عن شيء منه فقرأه فيما بين صلاة الفجر وصلاة الظهر كتب له.',
].join('\n');

// The prose is about داود عليه السلام and so is the matn. Nobody's description moved, and the
// prose-side anchor is the only thing saying so.
const ABOUT_DAWUD = [
  'وكان داود عليه السلام أعبد أهل زمانه، وكان ينام نصف الليل، ويقوم ثلثه، وينام سدسه.',
  '<hadith narrator="عبد الله بن عمرو رضي الله عنهما" ruling="متفق عليه">' + DAWUD_MATN + '</hadith>',
].join('\n');

// An incidental overlap: two words that any two sentences about night may share. The floor is
// what separates a sentence lifted whole from a coincidence of Arabic.
const SHORT_COINCIDENCE = [
  'هدي النبي صلى الله عليه وسلم في ليله معتدل.',
  'وكان ينام نصف ليله ويصلي ما كتب له.',
  '<hadith narrator="عبد الله بن عمرو رضي الله عنهما" ruling="متفق عليه">' + DAWUD_MATN + '</hadith>',
].join('\n');

// Round four's defect wearing rounds one/three/five's clothes: the matn travels untagged. The
// shipped rule is silent here on purpose — there is no tagged matn — and section D proves it.
const UNTAGGED_DEFECT = [
  'هدي النبي صلى الله عليه وسلم في ليله هدي معتدل، لا إفراط فيه ولا تفريط.',
  WITNESS_PROSE + '.',
  'وفي الحديث: «' + DAWUD_MATN + '».',
].join('\n');

(async () => {
  console.log('=== guards/prophet-ascription-guard.cjs — البند ٣٦ · الباب (ب) · الطور الأول ===\n');

  const borrowed = await borrowProphetFrame();
  try {
    console.log('=== S. THE DEFINITION IS BORROWED AND NOT RE-WRITTEN ===');
    ok('S1 · lib/output-reviewer.js defines PROPHET_FRAME_RE exactly once', borrowed.seams === 1,
      'seams found: ' + borrowed.seams);
    ok('S2 · the twin loaded and published the borrowed frame',
      Boolean(borrowed.mod && borrowed.mod.PROPHET_FRAME_RE instanceof RegExp
        && typeof borrowed.mod.frameNamesTheProphet === 'function'),
      borrowed.error ? String(borrowed.error && borrowed.error.message) : 'no regexp on the twin');
    if (!borrowed.mod) {
      console.log('\nFAILED: ' + failures + ' of ' + checks + ' checks failed.');
      process.exit(1);
    }
    const frame = borrowed.mod.PROPHET_FRAME_RE;
    const namesTheProphet = borrowed.mod.frameNamesTheProphet;
    const base = { frame, namesTheProphet };
    const run = (answer, extra) => detectStolenAscription(answer, Object.assign({}, base, extra || {}));
    const fires = (answer, extra) => run(answer, extra).findings.length > 0;

    ok('S3 · the borrowed frame reads his spellings and not a scholar\'s',
      namesTheProphet('النبي صلى الله عليه وسلم') && namesTheProphet('ﷺ')
      && !namesTheProphet('داود عليه السلام') && !namesTheProphet('ابن قدامة'),
      'the frame no longer separates him from a name');

    // ── E. AND IT IS THE ONLY PLACE IN THE TREE THAT SAYS SO ──────────────────────────────
    console.log('\n=== E. ONE DEFINITION IN THE WHOLE TREE ===');
    {
      const needle = frame.source;
      const hits = [];
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (['node_modules', '.git', '.vercel', '.next', 'dist'].includes(entry.name)) continue;
            walk(full);
          } else if (/\.(?:js|cjs|mjs|jsx|ts)$/u.test(entry.name)) {
            let text = '';
            try { text = fs.readFileSync(full, 'utf8'); } catch (_) { continue; }
            if (text.includes(needle)) hits.push(path.relative(REPO, full).replace(/\\/g, '/'));
          }
        }
      };
      walk(REPO);
      ok('E1 · the prophet frame is written in exactly one file', hits.length === 1, JSON.stringify(hits));
      ok('E2 · and that file is ' + REVIEWER_REL, hits[0] === REVIEWER_REL, JSON.stringify(hits));
      const self = fs.readFileSync(__filename, 'utf8');
      ok('E3 · this guard holds no second copy of it', !self.includes(needle), 'a copy was written here');
    }

    // ── A. IT CATCHES THE MEASURED ROUND ───────────────────────────────────────────────────
    console.log('\n=== A. قسم أ · الدورة الرابعة — المقيسة في الإنتاج ١٢ سبتمبر ٢٠٢٦ ===');
    {
      const out = run(ROUND_4);
      ok('A1 · round four is caught', out.findings.length === 1, JSON.stringify(out.findings));
      const f = out.findings[0] || {};
      ok('A2 · the run it caught is the measured sentence',
        typeof f.run === 'string' && f.run.includes('ينام نصف الليل ويقوم ثلثه وينام سدسه'), JSON.stringify(f.run));
      ok('A3 · the prose side is ascribed to the Prophet ﷺ',
        typeof f.proseAnchor === 'string' && namesTheProphet(f.proseAnchor), JSON.stringify(f.proseAnchor));
      ok('A4 · the matn side is ascribed to someone else',
        f.matnAnchor === 'داود عليه السلام', JSON.stringify(f.matnAnchor));
      ok('A5 · and the matn it read is a TAGGED one', f.matnKind === 'tagged', JSON.stringify(f.matnKind));
      ok('A6 · the finding survives the narrator attribute being removed', fires(ROUND_4_BARE),
        'the isnad outside the matn was doing the work');
      ok('A7 · the two measured strings are in the fixture verbatim',
        ROUND_4.includes(WITNESS_PROSE) && ROUND_4.includes(WITNESS_MATN_HEAD),
        'the fixture drifted off the measurement file');
    }

    // ── B. IT CATCHES NOTHING IN THE FOUR GREEN ROUNDS ─────────────────────────────────────
    console.log('\n=== B. قسم ب · الدورات الأولى والثانية والثالثة والخامسة — كلها خضراء ===');
    for (const [label, answer] of [
      ['الدورة الأولى — اقتباس في النثر بلا كتلة', ROUND_1],
      ['الدورة الثانية — كتلة موسومة، والنثر لم ينقل عنها', ROUND_2],
      ['الدورة الثالثة — اقتباس في النثر بلا كتلة', ROUND_3],
      ['الدورة الخامسة — اقتباس في النثر بلا كتلة', ROUND_5],
    ]) ok('B · ' + label, !fires(answer), JSON.stringify(run(answer).findings));
    ok('B5 · round two really did carry a tagged matn (the green is not an empty read)',
      run(ROUND_2).matns.length === 1, JSON.stringify(run(ROUND_2).matns.length));

    // ── C. REVELATION IS NOT TOUCHED ───────────────────────────────────────────────────────
    console.log('\n=== C. قسم ج · الوحي لا يُمس ===');
    ok('C1 · his own description, in prose and in a block that names him', !fires(ABOUT_HIM),
      JSON.stringify(run(ABOUT_HIM).findings));
    ok('C2 · a verse between the ornate parentheses is never judged', !fires(SCRIPTURE_CASE),
      JSON.stringify(run(SCRIPTURE_CASE).findings));
    ok('C3 · a hadith ascribed to him by a frame that names him', !fires(FRAMED_TO_HIM),
      JSON.stringify(run(FRAMED_TO_HIM).findings));
    ok('C4 · prose about داود عليه السلام over a matn about him is nobody\'s theft',
      !fires(ABOUT_DAWUD), JSON.stringify(run(ABOUT_DAWUD).findings));
    ok('C5 · the guard stays silent on the untagged travel of the same matn — by design',
      !fires(UNTAGGED_DEFECT), JSON.stringify(run(UNTAGGED_DEFECT).findings));
    ok('C6 · a two-word overlap with the matn is a coincidence, not a lifted sentence',
      !fires(SHORT_COINCIDENCE), JSON.stringify(run(SHORT_COINCIDENCE).findings));
    ok('C2a · and the scripture case really does share a long run (the silence is the rule, not a short run)',
      run(SCRIPTURE_CASE, { judgeScripture: true }).findings.length === 1,
      'the fixture no longer exercises the scripture exclusion');

    // ── D. EVERY CONDITION IS KILLED, ONE AT A TIME ────────────────────────────────────────
    console.log('\n=== D. قسم د · الطافرات تُقتل ===');
    ok('MUTANT KILLED: inverting the matn-side ascription stops round four being caught',
      !fires(ROUND_4, { invertMatnAnchor: true }),
      'the matn-side ascription measures nothing — section A would pass either way');
    ok('MUTANT KILLED: ...and the same inversion makes the innocent block that names him fire',
      fires(ABOUT_HIM, { invertMatnAnchor: true }),
      'the inverted rule catches nothing, so section C is not resting on that condition');
    ok('MUTANT KILLED: dropping the prose-side ascription makes prose about داود fire',
      fires(ABOUT_DAWUD, { ignoreProseAnchor: true }),
      'the prose-side ascription measures nothing');
    ok('MUTANT KILLED: judging scripture makes the verse fire',
      fires(SCRIPTURE_CASE, { judgeScripture: true }),
      'the ornate-parentheses exclusion measures nothing');
    ok('MUTANT KILLED: a two-word floor turns the coincidence into a finding',
      fires(SHORT_COINCIDENCE, { minRun: 2 }), 'the run floor measures nothing');
    ok('MUTANT KILLED: admitting untagged «…» quotes as matns catches the untagged travel',
      fires(UNTAGGED_DEFECT, { untaggedQuotesAreMatns: true }),
      'the tagged-matn requirement measures nothing, so C5 is silence for no reason');
    ok('D7 · and that same mutant still leaves the four green rounds green',
      [ROUND_1, ROUND_2, ROUND_3, ROUND_5].every((a) => !fires(a, { untaggedQuotesAreMatns: true })),
      'the untagged widening is not free — it reds the measured-green rounds');
  } finally {
    try { fs.rmSync(borrowed.dir, { recursive: true, force: true }); } catch (_) { /* temp only */ }
  }

  console.log('\n' + (failures === 0
    ? 'OK: ' + checks + '/' + checks + ' checks passed.'
    : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'));
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('prophet-ascription-guard CRASHED:', (e && e.stack) || e);
  process.exit(1);
});
