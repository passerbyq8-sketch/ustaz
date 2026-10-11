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
ok(KEYS.every((k) => !sync.includes(k)) && !/MEM86_/.test(sync), 'no memorizer key is in the sync tables (device only, the owner decides)');

reset();
ok(eq(X.mem86HeldRead(), {}), 'an empty store reads as nothing memorised');
store.set(X.MEM86_HELD_KEY, 'SEED:not json');
ok(eq(X.mem86HeldRead(), {}), 'a broken store reads as nothing memorised and does not throw');
store.set(X.MEM86_HELD_KEY, JSON.stringify({ 1: [[1, 3], [2, 5]], 2: [[400, 401]], 999: [[1, 1]], 3: 'x' }));
ok(eq(X.mem86HeldRead(), { 1: [[1, 5]] }), 'overlapping runs merge; out-of-range ayat and surahs are dropped');
reset();
let h = X.mem86HeldSet(112, 1, 4, true);
ok(eq(h, { 112: [[1, 4]] }) && X.mem86HeldCount(h, 112) === 4, 'mark a whole surah: 112:1-4');
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

/* ------------------------------------------------------------------ done */
console.log('\n' + (fail ? 'FAIL' : 'PASS') + '  memorizer86-check  ' + pass + ' passed, ' + fail + ' failed  (lifted ' + LIFT.length + ' initializers from app.jsx)');
process.exit(fail ? 1 : 0);
