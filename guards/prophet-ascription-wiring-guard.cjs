// guards/prophet-ascription-wiring-guard.cjs — البند ٣٦ · الباب (ب) · الطور الثاني.
//
// THE RULE NOW STANDS IN THE ANSWER PATH, AND THIS FILE IS WHAT PROVES IT STILL DOES.
//
// ── WHAT THE FIRST PHASE LEFT, MEASURED BEFORE THIS ROUND TOUCHED ANYTHING ──────────────────
//
// guards/prophet-ascription-guard.cjs measured the defect in production on ٢٠٢٦-٠٩-١٢ and proved
// the rule that catches it — and it was a DETECTOR AND NOTHING ELSE. ZERO references to it from
// the answer path, and the dependency running the wrong way: guards import lib/, never the
// reverse. A rule that only ever runs in a battery cannot refuse one sentence to one reader.
//
// ── WHY THE LOGIC IS A COPY, WHICH IS THIS FILE'S FIRST AND LARGEST CLAIM ───────────────────
//
// THE ORDER OF ١٥ سبتمبر ASKED FOR ONE MODULE IMPORTED BY BOTH — «تُنزَعُ دالّةُ الكشفِ إلى وحدةٍ
// جديدةٍ يستوردُها الاثنانِ — الحارسُ ومسارُ الجواب — فيبقى ملفُّ الحارسِ ساكنًا». IT CANNOT BE
// BOTH. §٣ of that same order seals guards/prophet-ascription-guard.cjs byte for byte and says
// what to do about it in as many words: «إن اضطرَّك النزعُ إلى تعديلِه فقِفْ واكتبْ ذلك في التقريرِ
// ولا تعدِّلْه». A guard that imports the new module is a guard that was edited, so the seal won
// and the logic was carried across VERBATIM.
//
// A COPY IS A LIABILITY AND IT IS PRICED HERE RATHER THAN PROMISED AWAY. Section S cuts the same
// region out of BOTH files by the SAME TWO CONTENT ANCHORS and compares it byte for byte; section
// P then runs the guard's own copy and the module's copy over every fixture and every mutation
// switch that guard owns and fails on the first result that differs. Bytes AND behaviour, because
// either one alone can be satisfied by a file that is quietly wrong.
//
// ── AND EVERY CLAIM ABOUT THE DOOR IS DRIVEN, NOT READ ──────────────────────────────────────
//
// Section D runs the REAL `runFreeBrainTurn` against a scripted provider — the harness idiom of
// guards/reject-door-guard.cjs, borrowed on purpose — and reads the text the turn returns. Section
// M is the negative witness the order's own standard demands: each remedy is removed from a twin
// of loop.js and the same driven assertion is re-run against it, and each one must FAIL there. A
// green check that cannot go red proves nothing.
//
// Usage: node guards/prophet-ascription-wiring-guard.cjs
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const GUARD = path.join(ROOT, 'guards', 'prophet-ascription-guard.cjs');
const MODULE = path.join(ROOT, 'lib', 'prophet-ascription.js');
const LOOP = path.join(ROOT, 'lib', 'free-brain', 'loop.js');
const REVIEWER = path.join(ROOT, 'lib', 'output-reviewer.js');
const FLAG = path.join(ROOT, 'lib', 'free-brain', 'flag.js');
const read = (file) => fs.readFileSync(file, 'utf8');

let checks = 0;
let failures = 0;
function ok(label, pass, detail) {
  checks += 1;
  if (pass) { console.log('  PASS  ' + label); return true; }
  failures += 1;
  console.log('  FAIL  ' + label);
  if (detail !== undefined) console.log('        ' + String(detail).slice(0, 700));
  return false;
}

const fresh = (file, label) => import(pathToFileURL(file).href
  + '?' + encodeURIComponent(label) + '=' + Date.now() + '-' + Math.random());

function importsFromTree(source, originalFile) {
  return source.replace(/(['"])(\.\.?\/[^'"\r\n]+\.js)\1/gu, (_all, quote, specifier) => {
    const target = path.resolve(path.dirname(originalFile), specifier);
    return quote + pathToFileURL(target).href + quote;
  });
}

// ── THE SEALED REGION, CUT THE SAME WAY OUT OF BOTH FILES ───────────────────────────────────
//
// CONTENT ANCHORS AND NOT LINE NUMBERS, so an edit ABOVE the region in either file cannot make
// this pass by accident or fail by accident. Both anchors are written here in halves and joined,
// because a guard that carries the opening anchor as one literal would find ITSELF if it were
// ever read as source — and section S3 proves neither file carries a second copy.
const OPEN_ANCHOR = 'const ARABIC_MARKS' + '_RE = ';
const CLOSE_ANCHOR = '  return { findings, ' + 'matns };\n}\n';

function sealedRegion(source) {
  const a = source.indexOf(OPEN_ANCHOR);
  const b = source.indexOf(CLOSE_ANCHOR);
  if (a < 0 || b < 0 || b < a) return null;
  return source.slice(a, b + CLOSE_ANCHOR.length);
}

// ── THE FIXTURES ────────────────────────────────────────────────────────────────────────────
//
// TRANSCRIBED FROM guards/prophet-ascription-guard.cjs, which transcribed the two strings the
// defect is made of from the measurement file itself. Section P does not trust this transcription:
// it asserts that the guard's own source still contains both strings, so a fixture that drifts off
// the measurement fails here rather than quietly testing something else.
const WITNESS_PROSE = 'وكان ينام نصف الليل، ويقوم ثلثه، وينام سدسه';
const WITNESS_MATN_HEAD = 'أحب الصلاة إلى الله صلاة داود عليه السلام';
const WITNESS_MATN_TAIL = 'كان ينام نصف الليل، ويقوم ثلثه، وينام سدسه';
const DAWUD_MATN = WITNESS_MATN_HEAD + '، ' + WITNESS_MATN_TAIL;
const BLOCK = '<hadith narrator="عبد الله بن عمرو رضي الله عنهما" ruling="متفق عليه">'
  + DAWUD_MATN + '</hadith>';

const ROUND_4 = [
  'هدي النبي صلى الله عليه وسلم في ليله هدي معتدل، لا إفراط فيه ولا تفريط.',
  WITNESS_PROSE + '.',
  BLOCK,
  'وفي هذا تعليم للأمة أن تأخذ من ليلها بنصيب.',
].join('\n');
const ROUND_4_BARE = ROUND_4.replace(/<hadith[^>]*>/u, '<hadith>');
const ROUND_2 = [
  'دعني أبحث لك عن جواب موثق من مصادر أهل العلم.',
  'هدي النبي صلى الله عليه وسلم في ليله قسمة بين نوم وقيام، فلم يكن يحيي ليله كله ولم يكن يدعه كله.',
  BLOCK,
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
const ABOUT_HIM = [
  'هدي النبي صلى الله عليه وسلم في ليله هدي معتدل، لا إفراط فيه ولا تفريط.',
  WITNESS_PROSE + '.',
  '<hadith narrator="عائشة رضي الله عنها" ruling="متفق عليه">سئل النبي صلى الله عليه وسلم عن قيامه، فأخبر أنه '
    + WITNESS_MATN_TAIL + '</hadith>',
].join('\n');
const AYAH = '﴿إِنَّ نَاشِئَةَ اللَّيْلِ هِيَ أَشَدُّ وَطْئًا وَأَقْوَمُ قِيلًا﴾';
const SCRIPTURE_CASE = [
  'وكان النبي صلى الله عليه وسلم يحيي ليله بالقرآن، وفيه ' + AYAH + '.',
  '<hadith>وكان داود عليه السلام يقوم من الليل، وفي التنزيل ' + AYAH + '</hadith>',
].join('\n');
const FRAMED_TO_HIM = [
  'كان النبي صلى الله عليه وسلم يقسم ليله ثلاثا.',
  '<hadith narrator="عائشة رضي الله عنها" ruling="رواه مسلم">قال رسول الله صلى الله عليه وسلم: من نام عن حزبه أو عن شيء منه فقرأه فيما بين صلاة الفجر وصلاة الظهر كتب له</hadith>',
  'ومن نام عن حزبه أو عن شيء منه فقرأه فيما بين صلاة الفجر وصلاة الظهر كتب له.',
].join('\n');
const ABOUT_DAWUD = [
  'وكان داود عليه السلام أعبد أهل زمانه، وكان ينام نصف الليل، ويقوم ثلثه، وينام سدسه.',
  BLOCK,
].join('\n');
const SHORT_COINCIDENCE = [
  'هدي النبي صلى الله عليه وسلم في ليله معتدل.',
  'وكان ينام نصف ليله ويصلي ما كتب له.',
  BLOCK,
].join('\n');
const UNTAGGED_DEFECT = [
  'هدي النبي صلى الله عليه وسلم في ليله هدي معتدل، لا إفراط فيه ولا تفريط.',
  WITNESS_PROSE + '.',
  'وفي الحديث: «' + DAWUD_MATN + '».',
].join('\n');

// The answer whose ONLY prose is the refused sentence. §٥/٣ القيد ٢ lives or dies on this one.
//
// AND THE PROPHET FRAME SITS INSIDE THE REFUSED SENTENCE, WHICH IS THE WHOLE POINT OF THE SHAPE.
// The first draft of this fixture put it in a head of its own — «هدي النبي ﷺ: …» — and a colon is
// a SENTENCE BREAK in the sealed rule's own list, so that head survived the drop as prose and the
// floor below was never reached. A fixture that cannot corner the floor cannot prove the floor.
const ONLY_THE_THEFT = [
  'وكان النبي صلى الله عليه وسلم ينام نصف الليل، ويقوم ثلثه، وينام سدسه.',
  BLOCK,
].join('\n');

const ALL_FIXTURES = [
  ['ROUND_4', ROUND_4], ['ROUND_4_BARE', ROUND_4_BARE], ['ROUND_1', ROUND_1],
  ['ROUND_2', ROUND_2], ['ROUND_3', ROUND_3], ['ROUND_5', ROUND_5],
  ['ABOUT_HIM', ABOUT_HIM], ['SCRIPTURE_CASE', SCRIPTURE_CASE], ['FRAMED_TO_HIM', FRAMED_TO_HIM],
  ['ABOUT_DAWUD', ABOUT_DAWUD], ['SHORT_COINCIDENCE', SHORT_COINCIDENCE],
  ['UNTAGGED_DEFECT', UNTAGGED_DEFECT], ['ONLY_THE_THEFT', ONLY_THE_THEFT],
  ['EMPTY', ''], ['NULL', null],
];

// Every switch the guard's own section D drives, plus the shipped rule with none of them.
const ALL_SWITCHES = [
  ['shipped', {}],
  ['invertMatnAnchor', { invertMatnAnchor: true }],
  ['ignoreProseAnchor', { ignoreProseAnchor: true }],
  ['judgeScripture', { judgeScripture: true }],
  ['minRun2', { minRun: 2 }],
  ['untaggedQuotesAreMatns', { untaggedQuotesAreMatns: true }],
];

// ── DRIVING A REAL TURN ─────────────────────────────────────────────────────────────────────
const PROVIDER = 'https://stub.invalid/v1/messages';
const textPayload = (text) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }] });

async function drive(loopModule, script, extra = {}) {
  const realFetch = globalThis.fetch;
  const bodies = [];
  let call = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input?.url || input);
    if (!url.startsWith('https://stub.invalid/')) throw new Error('offline: ' + url);
    bodies.push(JSON.parse(String(init?.body ?? '{}')));
    const step = script[Math.min(call, script.length - 1)];
    call += 1;
    return { ok: true, status: 200, json: async () => textPayload(step) };
  };
  try {
    const out = await loopModule.runFreeBrainTurn({
      messages: [{ role: 'user', content: 'ما هدي النبي صلى الله عليه وسلم في يومه وليلته؟' }],
      system: 'أنت أستاذ.', model: 'stub', maxTokens: 1024,
      mode: 'عادي', lexicalRoute: 'DEEN', providerUrl: PROVIDER, headers: {},
      ...extra,
    });
    return { ...out, bodies, calls: call };
  } finally {
    globalThis.fetch = realFetch;
  }
}

/** Mutate one module, import the twin, hand it to `check`. */
async function mutate({ file, name, transform, check }) {
  const original = read(file);
  const changed = transform(original);
  if (changed === original) return { changed: false, loaded: false, result: null, error: 'seam moved' };
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ezik-ascription-wiring-'));
  const twin = path.join(temp, name.replace(/[^a-z0-9_-]/giu, '_') + '.mjs');
  fs.writeFileSync(twin, importsFromTree(changed, file), 'utf8');
  try {
    const twinModule = await fresh(twin, name);
    return { changed: true, loaded: true, result: await check(twinModule), error: null };
  } catch (error) {
    return { changed: true, loaded: false, result: null, error: error?.stack || String(error) };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

const marks = (out) => (out.degraded || []).filter((d) => String(d).startsWith('ascription'));

(async function main() {
  console.log('=== guards/prophet-ascription-wiring-guard.cjs — البند ٣٦ · الباب (ب) · الطور الثاني ===\n');

  const guardSource = read(GUARD);
  const moduleSource = read(MODULE);
  const loopSource = read(LOOP);
  const reviewerSource = read(REVIEWER);

  // ═════════════════════════════════════════════════════════════════════════════════════════
  console.log('=== S. THE SEAL — ONE RULE LIVING IN TWO FILES, BYTE FOR BYTE ===');
  // ═════════════════════════════════════════════════════════════════════════════════════════
  const guardRegion = sealedRegion(guardSource);
  const moduleRegion = sealedRegion(moduleSource);
  ok('S1 · the region is findable in the guard by its two content anchors', guardRegion !== null);
  ok('S2 · and in lib/prophet-ascription.js by the same two', moduleRegion !== null);
  ok('S3 · each file carries the opening anchor exactly once',
    guardSource.split(OPEN_ANCHOR).length - 1 === 1
    && moduleSource.split(OPEN_ANCHOR).length - 1 === 1,
    'guard: ' + (guardSource.split(OPEN_ANCHOR).length - 1)
      + ' module: ' + (moduleSource.split(OPEN_ANCHOR).length - 1));
  ok('S4 · THE RULE IS THE SAME BYTES IN BOTH FILES',
    guardRegion !== null && guardRegion === moduleRegion,
    guardRegion === null || moduleRegion === null ? 'a region was not found'
      : 'guard ' + Buffer.byteLength(guardRegion, 'utf8') + 'B vs module '
        + Buffer.byteLength(moduleRegion, 'utf8') + 'B');
  ok('S5 · and it is not an empty seal — the region carries the detection function',
    Boolean(guardRegion && guardRegion.includes('function detectStolenAscription(answer, opts)')
      && guardRegion.includes('const MIN_RUN = 6;')));
  // The guard file is sealed by the order. This does not re-hash it — that is §٤ of the report's
  // job — but it does refuse the one edit this item could have been tempted into.
  ok('S6 · the sealed guard still imports nothing from lib/prophet-ascription.js',
    !guardSource.includes('prophet-ascription.js'),
    'the guard was edited to import the module — the seal of §٣ is broken');

  // ═════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n=== P. PARITY — THE TWO COPIES ANSWER EVERY CASE IDENTICALLY ===');
  // ═════════════════════════════════════════════════════════════════════════════════════════
  //
  // THE GUARD'S COPY IS EXECUTED, NOT ASSUMED. Its region is written to a throw-away twin under
  // os.tmpdir() with one appended export — the same idiom the guard itself uses to borrow the
  // prophet frame — so what section P compares is two RUNNING functions and not two strings.
  ok('P0 · the two measured strings are still in the guard verbatim',
    guardSource.includes(WITNESS_PROSE) && guardSource.includes(WITNESS_MATN_HEAD),
    'the fixtures here have drifted off the guard, so parity would be testing the wrong text');

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ezik-ascription-parity-'));
  let guardCopy = null;
  try {
    const twin = path.join(temp, 'guard-copy.mjs');
    fs.writeFileSync(twin, guardRegion + '\nexport { detectStolenAscription };\n', 'utf8');
    guardCopy = await fresh(twin, 'guard-copy');
  } catch (error) {
    ok('P1 · the guard\'s own copy loads and publishes its detection', false, String(error));
  }
  const mod = await fresh(MODULE, 'module-copy');
  const RV = await fresh(REVIEWER, 'wiring-reviewer');

  ok('P1 · the guard\'s own copy loads and publishes its detection',
    Boolean(guardCopy && typeof guardCopy.detectStolenAscription === 'function'));
  ok('P2 · the prophet frame is borrowed from the reviewer under its two lent names',
    RV.prophetFrame instanceof RegExp && typeof RV.frameNamesProphet === 'function');
  ok('P3 · and it still separates him from a name',
    RV.frameNamesProphet('النبي صلى الله عليه وسلم') && RV.frameNamesProphet('ﷺ')
    && !RV.frameNamesProphet('داود عليه السلام') && !RV.frameNamesProphet('ابن قدامة'));

  if (guardCopy) {
    const base = { frame: RV.prophetFrame, namesTheProphet: RV.frameNamesProphet };
    let compared = 0;
    let differed = [];
    for (const [fixtureName, answer] of ALL_FIXTURES) {
      for (const [switchName, extra] of ALL_SWITCHES) {
        const opts = Object.assign({}, base, extra);
        const a = JSON.stringify(guardCopy.detectStolenAscription(answer, opts));
        const b = JSON.stringify(mod.detectStolenAscription(answer, opts));
        compared += 1;
        if (a !== b) differed.push(fixtureName + '/' + switchName + ': ' + a + ' vs ' + b);
      }
    }
    ok('P4 · EVERY case answers identically through both copies — ' + compared + ' comparisons',
      differed.length === 0, differed.slice(0, 4).join(' | '));
    ok('P5 · and the comparison is not vacuous — the measured round still fires in both',
      guardCopy.detectStolenAscription(ROUND_4, base).findings.length === 1
      && mod.detectStolenAscription(ROUND_4, base).findings.length === 1);
    ok('P6 · ...and the four green rounds are still silent in both',
      [ROUND_1, ROUND_2, ROUND_3, ROUND_5].every((a) => guardCopy.detectStolenAscription(a, base).findings.length === 0
        && mod.detectStolenAscription(a, base).findings.length === 0));
    ok('P7 · ...and the untagged travel is still invisible to both, by design',
      guardCopy.detectStolenAscription(UNTAGGED_DEFECT, base).findings.length === 0
      && mod.detectStolenAscription(UNTAGGED_DEFECT, base).findings.length === 0);
  }
  fs.rmSync(temp, { recursive: true, force: true });

  // ═════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n=== E. STILL ONE DEFINITION OF WHO THE PROPHET ﷺ IS ===');
  // ═════════════════════════════════════════════════════════════════════════════════════════
  const frameSource = RV.prophetFrame.source;
  ok('E1 · the module holds no second copy of the prophet frame',
    !moduleSource.includes(frameSource),
    'a spelling list was written into lib/prophet-ascription.js — the first guard\'s E1 will go red');
  ok('E2 · nor does the answer path', !loopSource.includes(frameSource));
  ok('E3 · the reviewer lends it out under names that are NOT its local ones',
    reviewerSource.includes('export { PROPHET_FRAME_RE as prophetFrame, frameNamesTheProphet as frameNamesProphet };'),
    'renaming either alias to its local spelling makes the first guard\'s twin a duplicate export');
  ok('E4 · and lib/output-reviewer.js still imports nothing at all',
    !/^\s*import\s/mu.test(reviewerSource),
    'an import here resolves against os.tmpdir() in the first guard\'s twin and kills it at S2');

  // ═════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n=== L. THE LOCATOR — THE SENTENCE ALONE, AND NOTHING AROUND IT ===');
  // ═════════════════════════════════════════════════════════════════════════════════════════
  const opts = { frame: RV.prophetFrame, namesTheProphet: RV.frameNamesProphet };
  const located = mod.locateStolenAscriptions(ROUND_4, opts);
  ok('L1 · the measured round yields exactly one located sentence', located.length === 1,
    JSON.stringify(located.map((one) => one.text)));
  ok('L2 · and the sentence it points at is the measured one, character for character',
    located.length === 1 && located[0].text === WITNESS_PROSE + '.',
    JSON.stringify(located[0] && located[0].text));
  const kept = mod.withoutStolenAscriptions(ROUND_4, located);
  ok('L3 · dropping it removes the stolen sentence', !kept.includes(WITNESS_PROSE));
  ok('L4 · ...and keeps the matn that proved the theft',
    kept.includes(WITNESS_MATN_HEAD) && kept.includes('</hadith>'));
  ok('L5 · ...and keeps every other sentence untouched',
    kept.includes('هدي النبي صلى الله عليه وسلم في ليله هدي معتدل، لا إفراط فيه ولا تفريط.')
    && kept.includes('وفي هذا تعليم للأمة أن تأخذ من ليلها بنصيب.'), JSON.stringify(kept));
  ok('L6 · an answer with no finding comes back byte for byte',
    [ROUND_1, ROUND_2, ROUND_3, ROUND_5, ABOUT_DAWUD, SCRIPTURE_CASE].every((a) =>
      mod.withoutStolenAscriptions(a, mod.locateStolenAscriptions(a, opts)) === a));
  ok('L7 · the card is never swallowed by the sentence around the run',
    located.length === 1 && located[0].end <= ROUND_4.indexOf('<hadith'),
    JSON.stringify(located[0] && [located[0].start, located[0].end, ROUND_4.indexOf('<hadith')]));

  // ═════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n=== D. THE DOOR, DRIVEN THROUGH THE REAL TURN ===');
  // ═════════════════════════════════════════════════════════════════════════════════════════
  const loop = await fresh(LOOP, 'wiring-door');

  // البند ٣٦ · الإصلاحُ الضيّق (١٦ سبتمبر) — THE DROP WAS TURNED INTO A CORRECTION. The sentence
  // must still be in the answer, rewritten to the man the matn named, and must not be in it as it
  // stood. A door that drops it fails the first half; a door that does nothing fails the second.
  const CORRECTED_PROSE = 'وكان داود عليه السلام ينام نصف الليل، ويقوم ثلثه، وينام سدسه.';
  const caught = await drive(loop, [ROUND_4, ROUND_4]);
  ok('D1 · the measured sentence reaches the reader CORRECTED — ascribed to the matn\'s owner, not dropped',
    caught.text.includes(CORRECTED_PROSE) && !caught.text.includes(WITNESS_PROSE), caught.text);
  ok('D2 · and the rest of the answer does',
    caught.text.includes('وفي هذا تعليم للأمة أن تأخذ من ليلها بنصيب.')
    && caught.text.includes(WITNESS_MATN_HEAD), caught.text);
  ok('D3 · §٥/٣ القيد ٢ — the reader is never handed an empty screen',
    caught.text.trim() !== '');
  ok('D4 · §٥/٣ القيد ١ — exactly ONE regeneration was asked for', caught.calls === 2,
    'provider calls: ' + caught.calls);
  ok('D5 · ...and the turn says so by name — a correction, and never a drop',
    marks(caught).includes('ascription_caught:1')
    && marks(caught).some((m) => m.startsWith('ascription_retry:still_caught'))
    && marks(caught).some((m) => m.startsWith('ascription_corrected:1:'))
    && marks(caught).includes('ascription:corrected_after_retry')
    && !marks(caught).some((m) => m.startsWith('ascription_dropped')),
    JSON.stringify(marks(caught)));
  ok('D6 · the rewriting call carries NO tools key — it is a writing round',
    caught.bodies.length === 2 && !Object.prototype.hasOwnProperty.call(caught.bodies[1], 'tools'),
    JSON.stringify(Object.keys(caught.bodies[1] || {})));
  ok('D7 · ...and it names the run that was caught, so the writer is not left guessing',
    JSON.stringify(caught.bodies[1] || {}).includes('داود عليه السلام'));

  const repaired = await drive(loop, [ROUND_4, [
    'هدي النبي صلى الله عليه وسلم في ليله هدي معتدل، لا إفراط فيه ولا تفريط.',
    'وكان داود عليه السلام ينام نصف الليل، ويقوم ثلثه، وينام سدسه.',
    BLOCK,
  ].join('\n')]);
  ok('D8 · a rewrite that hands the description back is ADOPTED',
    repaired.text.includes('وكان داود عليه السلام ينام نصف الليل')
    && !repaired.text.includes(WITNESS_PROSE), repaired.text);
  ok('D9 · ...and it is recorded as a repair and not as a drop',
    marks(repaired).includes('ascription:repaired')
    && !marks(repaired).some((m) => m.startsWith('ascription_dropped')),
    JSON.stringify(marks(repaired)));

  // §٦/٢ — «وغيرُ الصنفِ يمرُّ سليمًا», and the standard is byte-for-byte and not "mostly".
  let cleanPass = [];
  for (const [name, answer] of [['ROUND_1', ROUND_1], ['ROUND_2', ROUND_2], ['ROUND_3', ROUND_3],
    ['ROUND_5', ROUND_5], ['ABOUT_HIM', ABOUT_HIM], ['ABOUT_DAWUD', ABOUT_DAWUD],
    ['SCRIPTURE_CASE', SCRIPTURE_CASE], ['FRAMED_TO_HIM', FRAMED_TO_HIM],
    ['SHORT_COINCIDENCE', SHORT_COINCIDENCE], ['UNTAGGED_DEFECT', UNTAGGED_DEFECT]]) {
    const on = await drive(loop, [answer]);
    process.env.PROPHET_ASCRIPTION_BLOCK = 'off';
    const off = await drive(loop, [answer]);
    delete process.env.PROPHET_ASCRIPTION_BLOCK;
    if (on.text !== off.text || on.calls !== 1 || off.calls !== 1 || marks(on).length !== 0) {
      cleanPass.push(name + ' on=' + on.calls + ' off=' + off.calls
        + ' same=' + (on.text === off.text) + ' marks=' + JSON.stringify(marks(on)));
    }
  }
  ok('D10 · every answer OUTSIDE the measured class is delivered byte for byte with the door up,'
    + ' costs no extra call, and leaves no trace', cleanPass.length === 0, cleanPass.join(' | '));

  // §٥/٣ القيد ٣, first half — the switch.
  process.env.PROPHET_ASCRIPTION_BLOCK = 'off';
  const switchedOff = await drive(loop, [ROUND_4, ROUND_4]);
  delete process.env.PROPHET_ASCRIPTION_BLOCK;
  ok('D11 · with the switch off the OLD behaviour returns exactly — the defect ships',
    switchedOff.text.includes(WITNESS_PROSE) && switchedOff.calls === 1,
    'calls: ' + switchedOff.calls);
  ok('D12 · ...and the turn says which switch did it',
    marks(switchedOff).includes('ascription:off:env_off'), JSON.stringify(marks(switchedOff)));

  // §٥/٣ القيد ٢ — the screen is never blank. Since ١٦ سبتمبر no exit takes a sentence out, so the
  // answer whose ONLY prose is the refused sentence is corrected like any other, not kept as it was.
  const onlyTheft = await drive(loop, [ONLY_THE_THEFT, ONLY_THE_THEFT]);
  ok('D13 · an answer whose ONLY prose is the refused sentence still reaches the reader as prose',
    loop.carriesReaderProse(onlyTheft.text), JSON.stringify(onlyTheft.text));
  ok('D14 · ...and it arrives CORRECTED — the frame naming him replaced by the matn\'s owner — and named so',
    onlyTheft.text.includes(CORRECTED_PROSE)
    && !onlyTheft.text.includes('وكان النبي صلى الله عليه وسلم ينام نصف الليل')
    && marks(onlyTheft).some((m) => m.startsWith('ascription_corrected:1:'))
    && !marks(onlyTheft).some((m) => m.startsWith('ascription_kept_no_prose_left')),
    JSON.stringify([onlyTheft.text, marks(onlyTheft)]));

  // ═════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n=== M. THE MUTANTS — EVERY REMEDY IS REMOVED AND MUST BE MISSED ===');
  // ═════════════════════════════════════════════════════════════════════════════════════════

  // §٥/٣ القيد ٣, second half: «وإن تعطَّلَ الكشفُ نفسُه يمرُّ الجوابُ كما هو — فشلٌ مفتوحٌ لا مغلق».
  // This is the ONE mutant whose twin must still DELIVER, because failing open is the contract.
  const exploding = await mutate({
    file: LOOP,
    name: 'detector-throws',
    transform: (s) => s.replace(
      'let located = locateStolenAscriptions(reviewed.text, ascriptionOpts);',
      'let located = (() => { throw new Error(\'detector exploded\'); })();',
    ),
    check: async (twin) => drive(twin, [ROUND_4, ROUND_4]),
  });
  ok('M1 · a detector that THROWS passes the answer through untouched — fails OPEN',
    exploding.loaded && exploding.result
    && exploding.result.text.includes(WITNESS_PROSE)
    && exploding.result.calls === 1,
    exploding.error || ('calls: ' + (exploding.result && exploding.result.calls)));
  ok('M2 · ...and the failure is recorded rather than swallowed',
    exploding.loaded && exploding.result
    && marks(exploding.result).some((m) => m.startsWith('ascription_error:')),
    exploding.error || JSON.stringify(exploding.result && marks(exploding.result)));

  const dropBack = await mutate({
    file: LOOP,
    name: 'drop-back',
    transform: (s) => {
      const a = s.replace(
        "import { locateStolenAscriptions } from '../prophet-ascription.js';",
        "import { locateStolenAscriptions, withoutStolenAscriptions } from '../prophet-ascription.js';",
      );
      const b = a.replace(
        'const correction = correctedAscriptions(reviewed.text, located, ascriptionOpts);',
        'const correction = { text: withoutStolenAscriptions(reviewed.text, located), corrected: located.length, left: [] };',
      );
      return a === s || b === a ? s : b;
    },
    check: async (twin) => drive(twin, [ROUND_4, ROUND_4]),
  });
  ok('M3 KILLED: putting the drop back makes the sentence vanish — neither corrected nor as it stood',
    dropBack.loaded && dropBack.result
    && !dropBack.result.text.includes(CORRECTED_PROSE)
    && !dropBack.result.text.includes(WITNESS_PROSE)
    && dropBack.result.text.includes('وفي هذا تعليم للأمة أن تأخذ من ليلها بنصيب.'),
    dropBack.error || (dropBack.result && dropBack.result.text));

  const noRetry = await mutate({
    file: LOOP,
    name: 'no-retry',
    transform: (s) => s.replace(
      "          if (rewriteBudget.take('ascription_retry')) {",
      '          if (false) {',
    ),
    check: async (twin) => drive(twin, [ROUND_4, [
      'هدي النبي صلى الله عليه وسلم في ليله هدي معتدل، لا إفراط فيه ولا تفريط.',
      'وكان داود عليه السلام ينام نصف الليل، ويقوم ثلثه، وينام سدسه.',
      BLOCK,
    ].join('\n')]),
  });
  ok('M4 KILLED: removing the regeneration loses the repair — the sentence is only ever corrected',
    noRetry.loaded && noRetry.result
    && noRetry.result.calls === 1
    && !marks(noRetry.result).includes('ascription:repaired')
    && marks(noRetry.result).includes('ascription:corrected')
    && noRetry.result.text.includes(CORRECTED_PROSE),
    noRetry.error || ('calls: ' + (noRetry.result && noRetry.result.calls)
      + ' marks: ' + JSON.stringify(noRetry.result && marks(noRetry.result))));

  const noCorrection = await mutate({
    file: LOOP,
    name: 'no-correction',
    transform: (s) => s.replace(
      'const correction = correctedAscriptions(reviewed.text, located, ascriptionOpts);',
      "const correction = { text: reviewed.text, corrected: 0, left: ['no_slot'] };",
    ),
    check: async (twin) => drive(twin, [ONLY_THE_THEFT, ONLY_THE_THEFT]),
  });
  // «الصمتُ عطبٌ أسوأُ من عطبِ النسبة.» Since ١٦ سبتمبر there is no drop and so no empty-screen floor
  // under it; the exit that floor used to guard is the one where NO CORRECTION CAN BE MADE. There
  // the sentence goes out exactly as it stood — the answer keeps its prose, the defect is delivered
  // rather than silenced — and the exit is named. The twin removes the correction, and every half
  // of that is what the shipped door must NOT show on this fixture, which D14 already pins.
  ok('M5 KILLED: removing the correction delivers the sentence as it stood — prose kept, never dropped, and named',
    noCorrection.loaded && noCorrection.result
    && loop.carriesReaderProse(noCorrection.result.text) === true
    && noCorrection.result.text.includes('وكان النبي صلى الله عليه وسلم ينام نصف الليل، ويقوم ثلثه، وينام سدسه.')
    && marks(noCorrection.result).includes('ascription:kept_uncorrected')
    && marks(noCorrection.result).some((m) => m.startsWith('ascription_uncorrected:1:no_slot')),
    noCorrection.error || JSON.stringify(noCorrection.result
      && [noCorrection.result.text, marks(noCorrection.result)]));

  const flagDefaultOff = await mutate({
    file: FLAG,
    name: 'flag-default-off',
    transform: (s) => s.replace(
      "  if (raw === '') return { enabled: true, reason: 'unset_default_on' };",
      "  if (raw === '') return { enabled: false, reason: 'unset_default_off' };",
    ),
    check: async (twin) => twin.prophetAscriptionDecision({}),
  });
  ok('M6 KILLED: the switch really does default ON — an inverted default is a different answer',
    flagDefaultOff.loaded && flagDefaultOff.result
    && flagDefaultOff.result.enabled === false,
    flagDefaultOff.error || JSON.stringify(flagDefaultOff.result));
  const flagModule = await fresh(FLAG, 'wiring-flag-read');
  ok('M7 · ...and a value nobody defined leaves the door STANDING',
    flagModule.prophetAscriptionDecision({}).enabled === true
    && flagModule.prophetAscriptionDecision({ PROPHET_ASCRIPTION_BLOCK: 'ملغى' }).enabled === true
    && flagModule.prophetAscriptionDecision({ PROPHET_ASCRIPTION_BLOCK: 'off' }).enabled === false,
    JSON.stringify([flagModule.prophetAscriptionDecision({}),
      flagModule.prophetAscriptionDecision({ PROPHET_ASCRIPTION_BLOCK: 'ملغى' })]));

  const brokenSeal = await mutate({
    file: MODULE,
    name: 'broken-seal',
    transform: (s) => s.replace('const MIN_RUN = 6;', 'const MIN_RUN = 2;'),
    check: async () => null,
  });
  ok('M8 KILLED: a single byte changed inside the sealed region is visible to section S',
    brokenSeal.changed && sealedRegion(read(MODULE).replace('const MIN_RUN = 6;', 'const MIN_RUN = 2;'))
      !== sealedRegion(guardSource),
    'the seal comparison cannot see an edit to the rule it is sealing');

  // ═════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n=== T. THE TAIL — THE NEW SUBJECT STOPS WHERE THE CAUGHT RUN STOPS ===');
  // ═════════════════════════════════════════════════════════════════════════════════════════
  //
  // البند ٣٦ · ذيلُ التصحيح (١٦ سبتمبر). MEASURED ON THE WITNESS: the corrected sentence ran on past
  // the caught run to «وَيَقُول:», and the matn under it is the Prophet's ﷺ saying — so the first
  // correction made داود عليه السلام its speaker. The sealed sentence break has no Arabic comma, so
  // the sentence does not stop where the run does. These checks pin the split: the run takes the
  // matn's owner, the tail takes back the frame the detector read before the run, and a tail that
  // cannot be given back leaves the whole sentence uncorrected — never swallowed, never removed.
  const TAIL_SENTENCE = 'وكان ينام نصف الليل، ويقوم ثلثه، وينام سدسه، ويقول:';
  const TAIL_EXPECTED = 'وكان داود عليه السلام ينام نصف الليل، ويقوم ثلثه، وينام سدسه. ويقول صلى الله عليه وسلم:';
  const TAIL_SWALLOWED = 'وكان داود عليه السلام ينام نصف الليل، ويقوم ثلثه، وينام سدسه، ويقول:';
  const TAIL_CASE = [
    'هدي النبي صلى الله عليه وسلم في ليله هدي معتدل، لا إفراط فيه ولا تفريط.',
    TAIL_SENTENCE,
    BLOCK,
    'وفي هذا تعليم للأمة أن تأخذ من ليلها بنصيب.',
  ].join('\n');
  const TAIL_NO_SLOT_SENTENCE = 'وكان ينام نصف الليل، ويقوم ثلثه، وينام سدسه، وهذا هدي حسن.';
  const TAIL_NO_SLOT = [
    'هدي النبي صلى الله عليه وسلم في ليله هدي معتدل، لا إفراط فيه ولا تفريط.',
    TAIL_NO_SLOT_SENTENCE,
    BLOCK,
  ].join('\n');

  // Every "on" is read against the SAME fixture with the switch off, so a check says exactly which
  // bytes moved and cannot be satisfied by a turn that also dropped or added something elsewhere.
  const offText = async (answer) => {
    process.env.PROPHET_ASCRIPTION_BLOCK = 'off';
    try { return (await drive(loop, [answer])).text; } finally { delete process.env.PROPHET_ASCRIPTION_BLOCK; }
  };

  const tailOn = await drive(loop, [TAIL_CASE, TAIL_CASE]);
  const tailOff = await offText(TAIL_CASE);
  ok('T1 · with a tail, the run carries the matn\'s owner and the tail carries the frame read before the run',
    tailOn.text.includes(TAIL_EXPECTED) && !tailOn.text.includes(TAIL_SWALLOWED)
    && marks(tailOn).some((m) => m.startsWith('ascription_corrected:1:')),
    JSON.stringify([tailOn.text, marks(tailOn)]));
  ok('T2 · ...and that sentence is the ONLY difference from the door switched off — the tail kept, the matn byte for byte',
    tailOff.includes(TAIL_SENTENCE) && tailOff.includes(WITNESS_MATN_HEAD)
    && tailOn.text === tailOff.replace(TAIL_SENTENCE, TAIL_EXPECTED),
    JSON.stringify([tailOn.text, tailOff]));

  const noTailOn = await drive(loop, [ROUND_4, ROUND_4]);
  const noTailOff = await offText(ROUND_4);
  const onlyOn = await drive(loop, [ONLY_THE_THEFT, ONLY_THE_THEFT]);
  const onlyOff = await offText(ONLY_THE_THEFT);
  ok('T3 · with NO tail, the correction is the one before this rule, byte for byte',
    noTailOn.text === noTailOff.replace(WITNESS_PROSE + '.', CORRECTED_PROSE)
    && onlyOn.text === onlyOff.replace('وكان النبي صلى الله عليه وسلم ينام نصف الليل، ويقوم ثلثه، وينام سدسه.', CORRECTED_PROSE),
    JSON.stringify([noTailOn.text, onlyOn.text]));

  const floorOn = await drive(loop, [TAIL_NO_SLOT, TAIL_NO_SLOT]);
  const floorOff = await offText(TAIL_NO_SLOT);
  ok('T4 · a tail that cannot take the frame back leaves the sentence UNCORRECTED, whole, and named tail_after_span',
    floorOn.text === floorOff && floorOn.text.includes(TAIL_NO_SLOT_SENTENCE)
    && marks(floorOn).some((m) => m.startsWith('ascription_uncorrected:1:tail_after_span'))
    && marks(floorOn).includes('ascription:kept_uncorrected'),
    JSON.stringify([floorOn.text, marks(floorOn)]));

  const swallow = await mutate({
    file: LOOP,
    name: 'tail-swallowed',
    transform: (src) => src.replace(
      '  if (!hasTail) return correctedSentence(sentence, actor, frame);',
      '  if (true) return correctedSentence(sentence, actor, frame);',
    ),
    check: async (twin) => drive(twin, [TAIL_CASE, TAIL_CASE]),
  });
  ok('T5 KILLED: a correction that swallows the tail again hands «يقول» to داود — T1 sees it',
    swallow.loaded && swallow.result
    && swallow.result.text.includes(TAIL_SWALLOWED) && !swallow.result.text.includes(TAIL_EXPECTED),
    swallow.error || (swallow.result && swallow.result.text));

  const cutTail = await mutate({
    file: LOOP,
    name: 'tail-deleted',
    transform: (src) => src.replace(
      "  return { text: head.text + tail, reason: head.reason + '+tail' };",
      "  return { text: head.text + '.', reason: head.reason + '+tail' };",
    ),
    check: async (twin) => drive(twin, [TAIL_CASE, TAIL_CASE]),
  });
  ok('T6 KILLED: a correction that deletes the tail loses «ويقول» — T1 and T2 see it',
    cutTail.loaded && cutTail.result
    && !cutTail.result.text.includes('ويقول') && !cutTail.result.text.includes(TAIL_EXPECTED),
    cutTail.error || (cutTail.result && cutTail.result.text));

  const noFrameBack = await mutate({
    file: LOOP,
    name: 'tail-frame-not-restored',
    transform: (src) => src.replace(
      "  return '. ' + rest.slice(from, after) + ' ' + name + rest.slice(after);",
      "  return '. ' + rest.slice(from, after) + rest.slice(after);",
    ),
    check: async (twin) => drive(twin, [TAIL_CASE, TAIL_CASE]),
  });
  ok('T7 KILLED: a split that does not give the frame back leaves «يقول» with no subject but داود — T1 sees it',
    noFrameBack.loaded && noFrameBack.result
    && noFrameBack.result.text.includes('وينام سدسه. ويقول:') && !noFrameBack.result.text.includes(TAIL_EXPECTED),
    noFrameBack.error || (noFrameBack.result && noFrameBack.result.text));

  const floorSwallows = await mutate({
    file: LOOP,
    name: 'tail-floor-corrects-head',
    transform: (src) => src.replace(
      "  if (tail === null) return { text: '', reason: 'tail_after_span' };",
      '  if (tail === null) return head;',
    ),
    check: async (twin) => drive(twin, [TAIL_NO_SLOT, TAIL_NO_SLOT]),
  });
  ok('T8 KILLED: a floor that corrects the head anyway throws the tail away — T4 sees it',
    floorSwallows.loaded && floorSwallows.result
    && !floorSwallows.result.text.includes('وهذا هدي حسن')
    && floorSwallows.result.text !== floorOff,
    floorSwallows.error || (floorSwallows.result && floorSwallows.result.text));

  console.log('\n' + (failures === 0
    ? 'OK: ' + checks + '/' + checks + ' checks passed.'
    : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'));
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('prophet-ascription-wiring-guard CRASHED:', (e && e.stack) || e);
  process.exit(1);
});
