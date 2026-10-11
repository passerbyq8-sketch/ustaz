// memorizer86-check.cjs -- Item 86 (memorizer): the checks behind the memorizer's Tarteel-style features.
//
// WHAT IS TESTED IS THE SHIPPED CODE. Every function is hoisted out of app.jsx by the route
// tools/memorizer-red-battery.cjs uses (tools/babel-block.cjs, then each top-level initializer by
// name). There is no second copy here. No network, no microphone, no audio: the mushaf data is
// read from quran-uthmani.json and mushaf-layout.json, and localStorage is a Map.
//
// No Quran text is written in this file: an ayah is named `surah:ayah`, a word by its number.
//
// USAGE  node tools/memorizer86-check.cjs
// EXIT   0 when every check holds.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babelParser = require('@babel/parser');

const REPO = path.join(__dirname, '..');
const BB = require('./babel-block.cjs');
const raw = BB.readBabelBlock({ file: path.join(REPO, 'index.html'), html: fs.readFileSync(path.join(REPO, 'index.html'), 'utf8') }).raw;
const ast = babelParser.parse(raw, { sourceType: 'script', plugins: ['jsx'] });

const TOP = new Map();
for (const st of ast.program.body) {
  if (st.type !== 'VariableDeclaration') continue;
  for (const d of st.declarations) if (d.id && d.id.type === 'Identifier' && d.init) TOP.set(d.id.name, raw.slice(d.init.start, d.init.end));
}

// ---- the fakes ----
const store = new Map();
const sandbox = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  },
  __quranData: JSON.parse(fs.readFileSync(path.join(REPO, 'quran-uthmani.json'), 'utf8')),
  console,
};
vm.createContext(sandbox);
const LIFT = [];
const lift = (names) => {
  const missing = [];
  for (const n of names) {
    const src = TOP.get(n);
    if (!src) { missing.push(n); continue; }
    sandbox[n] = vm.runInContext('(' + src + ')', sandbox);
    LIFT.push(n);
  }
  if (missing.length) { console.error('app.jsx does not expose as a top-level initializer: ' + missing.join(', ')); process.exit(1); }
};
lift(['normalizeForRecite', 'tokenizeForRecite', 'JUZ_FIRST_AYAH']);
lift([
  'MEM86_HELD_KEY', 'MEM86_RANGES_KEY', 'MEM86_WORDS_KEY', 'MEM86_TESTS_KEY', 'MEM86_RUN_KEY', 'MEM86_PLANS_KEY',
  'MEM86_DAYS_KEY', 'MEM86_PREFS_KEY', 'MEM86_CAP', 'MEM86_WORDS_MAX', 'mem86Bytes', 'mem86Load', 'mem86Store', 'mem86Int', 'mem86Obj',
  'mem86Counts', 'mem86Offsets', 'mem86G', 'mem86SA', 'mem86Ref', 'mem86SegsClean', 'mem86SegsList', 'mem86SegsSize',
  'mem86SurahSegs', 'mem86JuzSegs', 'mem86PageIndex', 'mem86PageSegs', 'mem86StarterSegs',
  'mem86HeldRead', 'mem86HeldSegs', 'mem86HeldCount', 'mem86HeldTotal', 'mem86HeldHas', 'mem86HeldSet',
  'mem86RangesRead', 'mem86RangesWrite', 'mem86Move', 'mem86Now', 'mem86WordsRead', 'mem86WordScore', 'mem86WordLevel', 'mem86WordsLog',
  'mem86Day', 'mem86DayShift', 'mem86DaysRead', 'mem86DaysAdd', 'mem86DayActive', 'mem86Streak', 'MEM86_PREF_DEFAULT', 'mem86PrefsRead', 'mem86PrefsWrite',
]);
const X = sandbox;
const LAYOUT = JSON.parse(fs.readFileSync(path.join(REPO, 'mushaf-layout.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log('  PASS  ' + label); } else { fail++; console.log('  FAIL  ' + label); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const section = (t) => console.log('\n-- ' + t + ' --');
const reset = () => store.clear();
// globals declared with `let` in app.jsx: the sandbox carries them as plain properties
X.__mem86Counts = null; X.__mem86PageOf = null;

/* ------------------------------------------------------------------ phase 1 */
section('phase 1 -- keys, ranges, the memorised record, the word number');
const counts = X.mem86Counts();
ok(counts && counts.length === 115 && counts.slice(1).reduce((a, b) => a + b, 0) === 6236, 'ayah counts read from the mushaf data: 114 surahs, 6236 ayat');
const KEYS = ['HELD', 'RANGES', 'WORDS', 'TESTS', 'RUN', 'PLANS', 'DAYS', 'PREFS'].map((k) => X['MEM86_' + k + '_KEY']);
ok(KEYS.every((k) => /^ezik_mem_[a-z]+_v1$/.test(k)) && new Set(KEYS).size === 8, 'eight distinct device keys, all ezik_mem_*_v1');
ok(KEYS.every((k) => X.MEM86_CAP[k] > 0), 'every key has a byte ceiling');
const appSrc = fs.readFileSync(path.join(REPO, 'app.jsx'), 'utf8');
const resetBlock = appSrc.slice(appSrc.indexOf('const resetAll = () => {'), appSrc.indexOf('\n  };', appSrc.indexOf('const resetAll = () => {')));
ok(['HELD', 'RANGES', 'WORDS', 'TESTS', 'RUN', 'PLANS', 'DAYS', 'PREFS'].every((k) => resetBlock.includes('localStorage.removeItem(MEM86_' + k + '_KEY)')), '«delete all my data» removes every key by its constant');
const delTool = fs.readFileSync(path.join(REPO, 'tools', 'delete-truth-measure.cjs'), 'utf8');
ok(['HELD', 'RANGES', 'WORDS', 'TESTS', 'RUN', 'PLANS', 'DAYS', 'PREFS'].every((k) => delTool.includes("{ c: 'MEM86_" + k + "_KEY',\n    clause: 'your place in the Mushaf, your memorisation progress")), 'every key is entered in MUST_GO_NEW beside «your memorisation progress»');
const sync = appSrc.slice(appSrc.indexOf('function ezikSyncKv()'), appSrc.indexOf('function ezikSyncDeviceOnly()'));
ok(sync.length > 0 && KEYS.every((k) => !sync.includes(k)) && !/MEM86_/.test(sync), 'no memorizer key is in the sync tables (device only, the owner decides)');

reset();
ok(eq(X.mem86HeldRead(), {}), 'an empty store reads as nothing memorised');
store.set(X.MEM86_HELD_KEY, 'SEED:not json');
ok(eq(X.mem86HeldRead(), {}), 'a broken store reads as nothing memorised and does not throw');
store.set(X.MEM86_HELD_KEY, JSON.stringify({ 1: [[1, 3], [2, 5]], 2: [[400, 401]], 999: [[1, 1]], 3: 'x' }));
ok(eq(X.mem86HeldRead(), { 1: [[1, 5]] }), 'overlapping runs merge; out-of-range ayat and surahs are dropped');
reset();
let h = X.mem86HeldSet(112, 1, 4, true);
ok(eq(h[112], [[1, 4]]) && X.mem86HeldCount(h, 112) === 4 && eq(h.last, [112, 1, 4]), 'mark a whole surah: 112:1-4, remembered as the last memorised');
h = X.mem86HeldSet(2, 10, 20, true);
h = X.mem86HeldSet(2, 15, 16, false);
ok(eq(h[2], [[10, 14], [17, 20]]) && X.mem86HeldTotal(h) === 4 + 9, 'clearing inside a run splits it: 2:10-14 and 2:17-20');
ok(X.mem86HeldHas(h, 2, 17) && !X.mem86HeldHas(h, 2, 15), 'membership answers per ayah');
h = X.mem86HeldSet(2, 1, 286, false);
ok(!(2 in h), 'clearing a whole surah removes it');

const starter = X.mem86StarterSegs(counts);
ok(eq(starter, [[99, 1, 114, 6]]) && X.mem86SegsSize(starter, counts) === 6236 - (X.mem86Offsets(counts)[99]), 'the starting range is 99:1 to 114:6 and holds every ayah between');
const merged = X.mem86SegsClean([[2, 1, 2, 5], [112, 1, 112, 4], [2, 6, 2, 9], [113, 1, 113, 5], [1, 7, 2, 2]], counts);
ok(eq(merged, [[1, 7, 2, 9], [112, 1, 113, 5]]), 'merging joins touching and overlapping segments across surahs');
ok(X.mem86SegsSize(merged, counts) === 10 + 9, 'the merged range counts 19 ayat');
ok(eq(X.mem86SegsList([[1, 6, 2, 1]], counts), [[1, 6], [1, 7], [2, 1]]), 'a range crossing a surah lists its ayat in mushaf order');
const juz = X.mem86JuzSegs([30, 1], counts);
ok(eq(juz, [[78, 1, 114, 6], [1, 1, 2, 141]]), 'juz 30 is 78:1-114:6, juz 1 is 1:1-2:141 (from JUZ_FIRST_AYAH)');
ok(X.mem86JuzSegs(Array.from({ length: 30 }, (_, i) => i + 1), counts).reduce((n, sg) => n + X.mem86SegsSize([sg], counts), 0) === 6236, 'the thirty juz cover the 6236 ayat exactly once');
const p1 = X.mem86PageSegs(1, 1, LAYOUT, counts);
ok(eq(p1, [[1, 1, 1, 7]]), 'page 1 is al-Fatiha 1:1-7');
const pAll = X.mem86PageSegs(1, 604, LAYOUT, counts);
ok(eq(pAll, [[1, 1, 114, 6]]), 'pages 1-604 are the whole mushaf');
ok(X.mem86SegsSize(X.mem86PageSegs(604, 600, LAYOUT, counts), counts) > 0, 'a page range given backwards still reads');

// the word number: tokenizeForRecite order; a standalone pause mark is never a word
let same = 0, withMark = 0;
for (const k in X.__quranData) {
  const text = X.__quranData[k];
  const shown = text.split(/\s+/).filter(Boolean).filter((w) => X.normalizeForRecite(w));
  if (shown.length !== text.split(/\s+/).filter(Boolean).length) withMark++;
  if (shown.length === X.tokenizeForRecite(text).length) same++;
}
ok(same === 6236, 'counting the displayed words and skipping the marks gives tokenizeForRecite\'s number in all 6236 ayat');
ok(withMark > 2000, 'measured: ' + withMark + ' ayat carry a standalone mark that the display splits as a word and the count skips');

// saved ranges
reset();
let rl = X.mem86RangesWrite([{ id: 'a', name: 'one', segs: [[112, 1, 114, 6]] }, { id: 'b', name: 'two', segs: [[1, 1, 1, 7]] }, { id: '', name: 'bad', segs: [[1, 1, 1, 7]] }, { id: 'c', name: 'empty', segs: [] }]);
ok(rl.length === 2 && rl[0].id === 'a', 'saved ranges keep valid entries only');
rl = X.mem86RangesWrite(X.mem86Move(rl, 0, 1));
ok(rl[0].id === 'b' && rl[1].id === 'a', 'up/down reorders and the order is stored');
ok(eq(X.mem86Move(rl, 0, -1), rl), 'moving the first entry up changes nothing');

// the word log
reset();
let wl = X.mem86WordsLog(['1:2:3', '1:2:3', 'bad', '1:2'], 'err');
ok(eq(Object.keys(wl), ['1:2:3']) && wl['1:2:3'][0] === 2, 'errors are logged per surah:ayah:word, malformed refs refused');
wl = X.mem86WordsLog(['2:255:1'], 'ok');
ok(!('2:255:1' in wl), 'a correct answer on a word with no record writes nothing');
wl = X.mem86WordsLog(['1:2:4'], 'hint');
ok(wl['1:2:4'][1] === 1, 'a hint is logged');
for (let i = 0; i < 3; i++) wl = X.mem86WordsLog(['1:2:3'], 'ok');
ok(!('1:2:3' in wl), 'correct answers lower a word until it is gone');
const big = [];
for (let i = 1; i <= X.MEM86_WORDS_MAX + 50; i++) big.push('2:' + (1 + (i % 286)) + ':' + (1 + Math.floor(i / 286)));
wl = X.mem86WordsLog(big, 'err');
ok(Object.keys(wl).length <= X.MEM86_WORDS_MAX && X.mem86Bytes(store.get(X.MEM86_WORDS_KEY)) <= X.MEM86_CAP[X.MEM86_WORDS_KEY], 'the word log is capped by count and bytes: ' + Object.keys(wl).length + ' entries, ' + X.mem86Bytes(store.get(X.MEM86_WORDS_KEY)) + ' B');

// the byte ceiling of every key is enforced at write
reset();
ok(X.mem86Store(X.MEM86_PREFS_KEY, { pad: 'x'.repeat(5000) }) === false && !store.has(X.MEM86_PREFS_KEY), 'a write over its ceiling is refused, not truncated');

/* ------------------------------------------------------------------ phase 2 */
section('phase 2 -- listening range, repeats, speed');
const appNoComments = appSrc.split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '')).join('\n');
const pru = appNoComments.slice(appNoComments.indexOf('const playRecitationUrl = (url, myId, rate) =>'), appNoComments.indexOf('const playRecitation = (sNum, aNum, myId, rate) =>'));
ok(pru.length > 0 && /audio\.src = url;\n\s*if \(rate && rate !== 1\) audio\.playbackRate = rate;/.test(pru), 'the rate is an optional parameter set right AFTER src (src resets it)');
ok(appNoComments.length > 0 && !/defaultPlaybackRate/.test(appNoComments), 'defaultPlaybackRate is never touched');
ok((appNoComments.match(/playbackRate/g) || []).length === 1, 'playbackRate is written in exactly one place');
const memScreen = appSrc.slice(appSrc.indexOf('function MemorizeScreen('), appSrc.indexOf('\nfunction ', appSrc.indexOf('function MemorizeScreen(') + 10));
ok(memScreen.length > 0 && /onPlayVerse\(selectedSurah, a, prefs\.speed\)/.test(memScreen), 'only the memorizer passes a speed');
ok(memScreen.length > 0 && /for \(let round = 0; round < prefs\.repR; round\+\+\)\n\s*for \(let a = startAyah; a <= last; a\+\+\)\n\s*for \(let k = 0; k < prefs\.repA; k\+\+\)/.test(memScreen), 'each ayah repeats repA times, the whole range repR times, to the chosen last ayah');
reset();
ok(X.mem86PrefsRead().speed === 1 && X.mem86PrefsRead().repA === 1 && X.mem86PrefsRead().repR === 1, 'defaults: speed 1, each ayah once, the range once');
X.mem86PrefsWrite({ speed: 2, repA: 4, repR: 7 });
ok(X.mem86PrefsRead().speed === 1 && X.mem86PrefsRead().repA === 1 && X.mem86PrefsRead().repR === 1, 'values outside the offered sets are refused (speed 2, x4, x7)');
X.mem86PrefsWrite({ speed: 0.75, repA: 10, repR: 5 });
ok(X.mem86PrefsRead().speed === 0.75 && X.mem86PrefsRead().repA === 10 && X.mem86PrefsRead().repR === 5, 'offered values are kept (0.75, x10, x5)');

/* ------------------------------------------------------------------ phase 3 */
section('phase 3 -- «سمِّعني» hides while it listens, hints, pause, ?memred=1 marks');
const recLines = appSrc.split('\n').filter((l) => !/^\s*\/\//.test(l) && l.includes('ezNewRecognition('));
ok(recLines.length === 3, 'ezNewRecognition( stands on exactly three lines (no fourth engine): ' + recLines.length);
ok(memScreen.length > 0 && /onResume=\{\(\) => startRecite\(recitePaused\)\}/.test(memScreen) && /const startRecite = \(fromAyah\) =>/.test(memScreen), 'pause and resume reuse startRecite, resuming at the paused ayah');
ok(memScreen.length > 0 && /const hide = reciteListening && !prefs\.dim;/.test(memScreen), 'the text is hidden only while the engine listens and «show dimmed» is off');
ok(memScreen.length > 0 && /if \(hide && st !== 'matched' && st !== 'mismatch' && !hinted\)/.test(memScreen), 'a matched word, a mismatch word or a hinted word shows; every other word is masked');
const onres = memScreen.slice(memScreen.indexOf('rec.onresult = (event) => {'), memScreen.indexOf('rec.onend = () => {'));
ok(onres.length > 0 && !/mem86WordsLog/.test(onres), 'what the engine hears writes nothing to the word log (red is off; the matcher accepts meaning-changing letters)');
ok(onres.length > 0 && /if \(allMatched && cur >= surahCount\) \{ setReciteFinished\(true\); stopRecite\(\); reciteCredit\(\); \}/.test(onres), 'a segment earns only when the matcher finished it');
const credit = memScreen.slice(memScreen.indexOf('const reciteCredit = () => {'), memScreen.indexOf('const pauseRecite = () =>'));
ok(credit.length > 0 && /if \(!reciteCleanRef\.current\) return;/.test(credit), '...and only when no manual «next» was pressed');
ok(credit.length > 0 && /fresh: reciteHiddenRef\.current \? n : 0, review: n/.test(credit), '...new memorisation only with the text hidden throughout; review otherwise');
const adv = memScreen.slice(memScreen.indexOf('const advanceReciteManual = () => {'), memScreen.indexOf('const setMode = (m) =>'));
ok(adv.length > 0 && /reciteCleanRef\.current = false;/.test(adv) && !/mem86Credit|mem86DaysAdd/.test(adv), 'manual «next» earns nothing');
const hintFn = memScreen.slice(memScreen.indexOf('const reciteHint = (rest) => {'), memScreen.indexOf('const startRecite = (fromAyah) =>'));
ok(hintFn.length > 0 && /mem86WordsLog\(add\.map\(\(i\) => mem86Ref\(selectedSurah, cur, i \+ 1\)\), 'hint'\)/.test(hintFn), 'a hint is logged as a hint');
ok(memScreen.length > 0 && memScreen.split('\n').filter((l) => /redMarks/.test(l) && /(localStorage|mem86Store|mem86WordsLog|mem86DaysAdd)/.test(l)).length === 0, '?memred=1 marks live in screen state only -- no line that touches redMarks stores anything');
ok(memScreen.length > 0 && /if \(MEM_RED_FLAGGING\) \{/.test(memScreen) && /MEM_RED_FLAGGING && redMarks\.pick/.test(memScreen), 'the dashed line, the lingering colour and «not a mistake» exist only under MEM_RED_FLAGGING');
// the clock: a gap over 60 s does not count
reset();
let fakeNow = Date.UTC(2026, 9, 11, 9, 0, 0);
const RealDate = Date;
sandbox.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [fakeNow])); } static now() { return fakeNow; } };
lift(['mem86Clock', 'mem86Rest', 'mem86Ping', 'mem86Credit'].concat(['MEM86_PLAN_UNITS', 'MEM86_PLAN_SCHED', 'mem86PlansRead', 'mem86PlansWrite', 'mem86PlanAyat', 'mem86Weekday', 'mem86PlanDue', 'mem86PlanTarget', 'mem86PlanPortion', 'mem86MinuteOfDay', 'mem86PlansCredit'].filter((n) => TOP.has(n))));
X.mem86Ping(); fakeNow += 20000; X.mem86Ping(); fakeNow += 20000; X.mem86Ping();
fakeNow += 120000; X.mem86Ping(); fakeNow += 10000; X.mem86Ping(); X.mem86Rest();
const dd = X.mem86DaysRead();
const today = Object.keys(dd)[0];
ok(today && dd[today].m === 50, 'active seconds: 20 + 20, the 120 s gap dropped, then 10 = 50 s (' + (today ? dd[today].m : 'none') + ')');
ok(today && !X.mem86DayActive(dd[today]), 'minutes alone do not make an activity day');
X.mem86Credit({ fresh: 0, review: 7 });
ok(X.mem86DayActive(X.mem86DaysRead()[today]), 'a review credit does');
sandbox.Date = RealDate;

/* ------------------------------------------------------------------ phase 4 */
section('phase 4 -- «اختبرني»: starts, extent, no repeats, the record');
X.getVerseText = (sn, a) => X.__quranData[sn + ':' + a] || null;
lift(['mem86Starts', 'mem86Rand', 'mem86Pick', 'mem86LineIndex', 'mem86AyahWords', 'mem86Question', 'mem86TestsRead', 'mem86TestsPut', 'mem86RunRead', 'mem86RunWrite', 'mem86Suggest']);
X.__mem86Lines = null;
const lines = X.mem86LineIndex(LAYOUT);
ok(lines && Object.keys(lines).length === 77429, 'every word of the layout has a printed-line ordinal (77429)');
const whole = [[1, 1, 114, 6]];
const starts = X.mem86Starts(whole, counts);
let badStart = 0, afterMark = 0;
for (const [sn, a, k] of starts) {
  if (k === 0) continue;
  const ws = X.__quranData[sn + ':' + a].split(/\s+/).filter(Boolean);
  let c = 0, prevIsMark = false, okHere = false;
  for (const w of ws) {
    const isWord = !!X.normalizeForRecite(w);
    if (isWord) { if (c === k) { okHere = prevIsMark; break; } c++; }
    prevIsMark = !isWord;
  }
  if (okHere) afterMark++; else badStart++;
}
ok(badStart === 0, 'every question starts at an ayah\'s first word or right after a pause mark (' + starts.length + ' starts, ' + afterMark + ' after a mark)');
ok(starts.filter((x) => x[2] === 0).length === 6236, 'every ayah is a start');
const n = 37;
const firstRound = Array.from({ length: n }, (_, i) => X.mem86Pick(n, 12345, i));
ok(new Set(firstRound).size === n, 'no start repeats until all ' + n + ' are used');
const second = Array.from({ length: n }, (_, i) => X.mem86Pick(n, 12345, n + i));
ok(new Set(second).size === n && JSON.stringify(second) !== JSON.stringify(firstRound), 'then a fresh shuffle');
ok(X.mem86Pick(n, 12345, 5) === X.mem86Pick(n, 12345, 5), 'the order is reproducible from its seed (a paused test resumes the same order)');
const cfg = { ...X.MEM86_PREF_DEFAULT, tLines: 2, tToEnd: true };
const q1 = X.mem86Question([2, 255, 0], [[2, 1, 2, 286]], counts, cfg, lines);
ok(q1.length === X.tokenizeForRecite(X.__quranData['2:255']).length, 'complete-to-the-end: a 2-line question from 2:255:1 ends at the end of 2:255 (' + q1.length + ' words)');
const q2 = X.mem86Question([2, 255, 0], [[2, 1, 2, 286]], counts, { ...cfg, tToEnd: false }, lines);
ok(q2.length < q1.length && q2.length > 0 && q2[q2.length - 1].mark, 'turned off, it may stop at a pause mark inside the ayah (' + q2.length + ' words)');
const q3 = X.mem86Question([114, 5, 0], [[114, 1, 114, 6]], counts, { ...cfg, tLines: 15 }, lines);
ok(q3.length > 0 && q3[q3.length - 1].s === 114 && q3[q3.length - 1].a === 6, 'a question never leaves its range (stops at 114:6)');
const lnOf = (w) => lines[w.s + ':' + w.a + ':' + (w.k + 1)];
const q4 = X.mem86Question([2, 6, 0], [[2, 1, 2, 286]], counts, { ...cfg, tLines: 5 }, lines);
ok(q4.length > 0 && lnOf(q4[q4.length - 1]) - lnOf(q4[0]) >= 4, 'a 5-line question spans at least 5 printed lines');
ok(q1.every((w) => typeof w.text === 'string' && w.text === X.__quranData[w.s + ':' + w.a].split(/\s+/).filter(Boolean).filter((x) => X.normalizeForRecite(x))[w.k]), 'every word shown is the mushaf\'s own word at its number');
// results and the paused test
reset();
X.mem86TestsPut({ t: 1, shown: 4, ok: 3, errs: ['1:2:3', 'bad'], sur: [1, 999] });
ok(JSON.stringify(X.mem86TestsRead()) === JSON.stringify([{ t: 1, shown: 4, ok: 3, errs: ['1:2:3'], sur: [1] }]), 'a result keeps valid refs and surahs only');
X.mem86TestsPut({ t: 1, shown: 4, ok: 3, errs: [], sur: [1] });
ok(X.mem86TestsRead().length === 1 && X.mem86TestsRead()[0].errs.length === 0, 'removing a false error rewrites the same result');
ok(X.mem86TestsRead().length === 1 && (() => { X.mem86TestsPut({ t: 2, shown: 0, ok: 0, errs: [], sur: [] }); return X.mem86TestsRead().length === 1; })(), 'a test with nothing shown is not a result');
X.mem86RunWrite({ segs: [[112, 1, 114, 6]], seed: 99, i: 3, cfg: { tLimit: 'count', tCount: 10 }, st: { shown: 3, ok: 2, streak: 1, errs: ['113:1:2'], ayat: [6222], ms: 5000, cred: 0 } });
const rr = X.mem86RunRead();
ok(rr && rr.i === 3 && rr.seed === 99 && rr.st.shown === 3 && rr.cfg.tCount === 10, 'a paused test survives closing the app');
X.mem86RunWrite(null);
ok(X.mem86RunRead() === null, '...and is gone once ended');
// the word log: a removed false error is undone
X.mem86WordsLog(['3:7:1', '3:7:1'], 'err');
const after = X.mem86WordsLog(['3:7:1'], 'unerr');
ok(after['3:7:1'][0] === 1, 'removing a false error takes one error off that word');
// suggestions: only from the memorised, only when the record speaks
reset();
X.__mem86Counts = null;
ok(X.mem86Suggest({}, counts).length === 0, 'nothing memorised: no suggestions');
let hh = X.mem86HeldSet(112, 1, 4, true);
let sg = X.mem86Suggest(hh, counts).map((x) => x.id);
ok(JSON.stringify(sg) === JSON.stringify(['warm', 'last']), 'memorised but untested: warm-up and last memorised only (' + sg.join(',') + ')');
X.mem86WordsLog(['112:3:2'], 'err');
X.mem86TestsPut({ t: 5, shown: 2, ok: 1, errs: ['112:3:2'], sur: [112] });
sg = X.mem86Suggest(X.mem86HeldRead(), counts).map((x) => x.id);
ok(JSON.stringify(sg) === JSON.stringify(['warm', 'weak', 'review', 'last']), 'with a record: all four, at most four (' + sg.join(',') + ')');
const weak = X.mem86Suggest(X.mem86HeldRead(), counts).find((x) => x.id === 'weak');
ok(weak && JSON.stringify(weak.segs) === JSON.stringify([[112, 1, 112, 4]]), 'the weakest spot is the logged ayah with two either side, inside the surah');
const ui = appSrc.slice(appSrc.indexOf('const Mem86Test = ('), appSrc.indexOf('\n};\n', appSrc.indexOf('const Mem86Test = (')));
ok(ui.length > 0 && /const okNow = good && !helped;/.test(ui), 'a question is right only when judged right with no help');
ok(ui.length > 0 && /if \(!r\.temp\) \{\n\s*if \(wrong\.length\) mem86WordsLog\(wrong, 'err'\);/.test(ui), 'a temporary session writes nothing');
ok(ui.length > 0 && /const score = run\.st\.shown \? Math\.round\(\(100 \* run\.st\.ok\) \/ run\.st\.shown\) : 0;/.test(ui), 'the score is right / shown (a skip is shown and not right)');
ok(ui.length > 0 && /if \(Date\.now\(\) - lastTouch\.current > 30000\) pause\(\);/.test(ui) && /if \(document\.hidden\) pause\(\);/.test(ui), 'it pauses by itself after 30 s untouched or when the page is hidden');
ok(ui.length > 0 && !/navigator\.vibrate/.test(ui) && /tasbihBuzz\(\)/.test(ui), 'vibration reuses the app\'s one guarded pulse');
lift(['mem86ParseNum']);
ok(X.mem86ParseNum(String.fromCharCode(0x661, 0x662)) === 12 && X.mem86ParseNum(String.fromCharCode(0x6F1, 0x6F5)) === 15 && X.mem86ParseNum('7') === 7 && Number.isNaN(X.mem86ParseNum('')), 'number fields read Arabic-Indic, Persian and Latin digits (the field shows the reader\'s own)');
ok(appSrc.length > 0 && !/type="number"[^>]*mem86Num/.test(appSrc), 'no native number input in the memorizer (it would show Latin digits in Arabic)');

/* ------------------------------------------------------------------ phase 5 */
section('phase 5 -- the weakness map');
lift(['mem86WeakMap']);
X.__mem86WeakRaw = null; X.__mem86WeakMap = {};
reset();
const lv = (e) => X.mem86WordLevel(e);
ok(lv([2, 0, 0, 0]) === 4 && lv([1, 1, 0, 0]) === 3 && lv([0, 2, 0, 0]) === 2 && lv([0, 1, 0, 0]) === 1 && lv([0, 0, 0, 0]) === 0, 'four bands: 2 errors red, error+hint orange, 2 hints yellow, 1 hint green, nothing = none');
ok(lv([1, 0, 0, 0]) > lv([0, 1, 0, 0]), 'an error weighs more than a hint');
X.mem86WordsLog(['2:2:1', '2:2:1'], 'err');
ok(X.mem86WeakMap()['2:2:1'] === 4, 'two errors read red');
X.mem86WordsLog(['2:2:1'], 'ok');
ok(X.mem86WeakMap()['2:2:1'] === 3, 'one right answer in a test lowers it (red -> orange)');
X.mem86WordsLog(['2:2:1'], 'ok');
X.mem86WordsLog(['2:2:1'], 'ok');
ok(!('2:2:1' in X.mem86WeakMap()), 'right answers lower it until it is gone');
X.mem86WordsLog(['2:2:2'], 'hint');
X.mem86WordsLog(['2:2:2'], 'clear');
ok(!('2:2:2' in X.mem86WeakMap()), 'a word\'s record can be cleared from the result list');
const idx = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
const CRLF = String.fromCharCode(13, 10);
const lightAt = idx.indexOf('--nav-off:#93A0B8;' + CRLF + '    --mem86-w1:'), darkAt = idx.indexOf('--nav-off:#6B7689;' + CRLF + '    --mem86-w1:');
ok(lightAt > 0 && darkAt > lightAt && [1, 2, 3, 4].every((l) => idx.slice(lightAt, lightAt + 140).includes('--mem86-w' + l + ':#') && idx.slice(darkAt, darkAt + 140).includes('--mem86-w' + l + ':#')), 'four tokens, each in the light :root block and the dark block');
const tokenNames = idx.match(/--mem86-[a-z0-9-]+/g) || [];
ok(tokenNames.length > 0 && new Set(tokenNames).size === 4, 'exactly four new tokens');
ok(tokenNames.length > 0 && !/tajw|tajweed|ghunn|madd|ikhf|qalq/i.test(tokenNames.join(' ') + Object.keys(X).filter((k) => /^mem86W/.test(k)).join(' ')), 'nothing is named after a tajweed colour');
ok(memScreen.length > 0 && /mem86WeakStyle\(prefs\.weak && u\.k, mem86Ref\(selectedSurah, u\.ayah, u\.k\)\)/.test(memScreen) && /mem86WeakStyle\(prefs\.weak, ref\)/.test(memScreen), 'drawn on the visible words of the talqin and of «سمِّعني», behind the switch');

/* ------------------------------------------------------------------ phase 6 */
section('phase 6 -- plans, sessions, the streak, off-app sessions');
lift(['MEM86_PLAN_UNITS', 'MEM86_PLAN_SCHED', 'mem86PlansRead', 'mem86PlansWrite', 'mem86PlanAyat', 'mem86Weekday', 'mem86PlanDue', 'mem86PlanTarget', 'mem86PlanPortion', 'mem86PlanStatus', 'mem86MinuteOfDay', 'mem86PlansCredit', 'mem86OffApp']);
lift(['mem86Credit']);
X.__mem86PageOf = null;
const pidx = X.mem86PageIndex(LAYOUT);
reset();
const T = '2026-10-11';
const base = { id: 'p1', name: 'n', kind: 'new', segs: [[112, 1, 114, 6]], rev: false, unit: 'ayat', amt: 3, sched: 'daily', days: [], until: '', adapt: false, pos: 0, cycle: 0, created: '2026-10-01', arch: false, log: {} };
let pl = X.mem86PlansWrite([base]);
ok(pl.length === 1 && pl[0].amt === 3, 'a plan is stored and read back');
ok(JSON.stringify(X.mem86PlanAyat({ ...base, rev: true }, counts).slice(0, 2)) === JSON.stringify([[114, 1], [114, 2]]), 'reverse order runs surah by surah from the last, each surah forward');
ok(JSON.stringify(X.mem86PlanPortion(pl[0], counts, pidx, T)) === JSON.stringify([[112, 1], [112, 2], [112, 3]]), 'today\'s portion: the next 3 ayat');
ok(X.mem86PlanPortion({ ...base, unit: 'pages', amt: 1, segs: [[67, 1, 68, 52]] }, counts, pidx, T).every(([sn, a]) => pidx.first[sn + ':' + a] === pidx.first['67:1']), 'a pages plan takes the ayat of the next page only');
const adapt = { ...base, sched: 'until', until: '2026-10-15', adapt: true };
ok(X.mem86PlanTarget(adapt, counts, T) === Math.ceil(15 / 5), 'adaptive: 15 ayat left over 5 days = 3 a day');
ok(X.mem86PlanDue({ ...base, sched: 'days', days: [0] }, T) && !X.mem86PlanDue({ ...base, sched: 'days', days: [1] }, T), 'chosen days: 11 October 2026 is a Sunday');
ok(!X.mem86PlanDue({ ...base, created: '2026-10-12' }, T), 'a plan is not due before it was created');
// credit: only ayat inside the plan, only plans of that kind
pl = X.mem86PlansCredit(T, 'new', [[112, 1], [112, 2], [2, 255]], 0, false);
ok(pl[0].pos === 2 && pl[0].log[T][0] === 2, 'credit counts the plan\'s own ayat only (2 of 3)');
ok(X.mem86PlanStatus(pl[0], T, T, {}) === 'part', '2 of a 3-ayah day is partial (yellow)');
pl = X.mem86PlansCredit(T, 'review', [[112, 3]], 0, false);
ok(pl[0].pos === 2, 'a review credit does not advance a new-memorisation plan');
pl = X.mem86PlansCredit(T, 'new', [[112, 3]], 0, false);
ok(X.mem86PlanStatus(pl[0], T, T, {}) === 'full', 'the third ayah completes the day (green)');
ok(X.mem86PlanStatus(pl[0], '2026-10-05', T, {}) === 'miss', 'a scheduled past day with nothing done is missed (red)');
ok(X.mem86PlanStatus({ ...pl[0], sched: 'any' }, '2026-10-05', T, {}) === '', '...but an any-time plan never misses');
X.mem86PlansWrite([{ ...base, id: 'r1', kind: 'review', segs: [[113, 1, 113, 5]], pos: 4 }]);
pl = X.mem86PlansCredit(T, 'review', [[113, 5]], 0, false);
ok(pl[0].pos === 0 && pl[0].cycle === 1, 'a review plan that covers its range starts a new round');
// the streak and the off-app session
reset();
X.mem86DaysAdd('2026-10-09', { r: 3 });
X.mem86DaysAdd('2026-10-11', { n: 2 });
ok(X.mem86Streak(X.mem86DaysRead(), T).cur === 1, 'a gap breaks the streak (9th, then 11th)');
X.mem86PlansWrite([{ ...base, kind: 'review', segs: [[1, 1, 1, 7]] }]);
const dz = X.mem86OffApp('2026-10-10', 'review', [[1, 1, 1, 7]], 20);
ok(X.mem86Streak(dz, T).cur === 3 && X.mem86Streak(dz, T).best === 3, 'an off-app session fills the missed day: 3 in a row');
const pz = X.mem86PlansRead()[0];
ok(pz.log['2026-10-10'] && pz.log['2026-10-10'][3] === 1 && pz.log['2026-10-10'][1] === 20, 'it counts for the plan and is marked off-app, with its minutes');
ok(dz['2026-10-10'].o.length === 1 && dz['2026-10-10'].o[0].n === 7, '...and is kept on the day as an off-app session');
ok(X.mem86Streak({ '2026-10-11': { m: 900, n: 0, r: 0, o: [] } }, T).cur === 0, 'minutes alone make no streak day');
const wl2 = appSrc.slice(appSrc.indexOf('function dailyWirdLines('), appSrc.indexOf('\n}\n', appSrc.indexOf('function dailyWirdLines(')));
ok(wl2.length > 0 && !/mem86/.test(wl2), 'the daily wird card is untouched: gate wird evaluates dailyWirdLines alone, so the plan line waits for discussion');

/* ------------------------------------------------------------------ phase 7 */
section('phase 7 -- the numbers of «تقدّمي»');
lift(['mem86SurahDensity', 'MEM86_TOTAL_AYAT']);
reset();
X.mem86HeldSet(112, 1, 4, true);
X.mem86HeldSet(1, 1, 7, true);
const h7 = X.mem86HeldRead();
ok(X.mem86HeldTotal(h7) === 11 && X.MEM86_TOTAL_AYAT === 6236, 'memorised ayat are counted, out of 6236');
X.mem86WordsLog(['112:1:1', '112:1:1', '1:2:1'], 'err');
const dn = X.mem86SurahDensity(h7, X.mem86WordsRead());
const d112 = dn.find((x) => x.sn === 112), d1 = dn.find((x) => x.sn === 1);
ok(d112.e === 2 && d1.e === 1 && d112.d > d1.d, 'error density = errors / memorised ayat (al-Ikhlas 2/4 is weaker than al-Fatiha 1/7)');
ok(dn.length === 2, 'only surahs with memorised ayat are ranked');
const stats = appSrc.slice(appSrc.indexOf('const Mem86Stats = ('), appSrc.indexOf('\n};\n', appSrc.indexOf('const Mem86Stats = (')));
ok(stats.length > 0 && /const last10 = tests\.slice\(-10\);/.test(stats) && /Array\.from\(\{ length: 30 \}/.test(stats) && /mem86Streak\(days, today\)/.test(stats), 'the last ten scores, a 30-day calendar, the current and longest streak');

/* ------------------------------------------------------------------ done */
console.log('\n' + (fail ? 'FAIL' : 'PASS') + '  memorizer86-check  ' + pass + ' passed, ' + fail + ' failed  (lifted ' + LIFT.length + ' initializers from app.jsx)');
process.exit(fail ? 1 : 0);
