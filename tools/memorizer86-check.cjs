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

/* ------------------------------------------------------------------ the switch */
// Who sees the new memorizer: MEM86_PART, read by mem86Lit(). The owner check is item 110's, lifted read-only from
// app.jsx the way gate ez110override's world() lifts it, and run against a fake window and localStorage per host.
// Everything after this section runs with the switch ON: the lifted helpers never ask it.
section('the switch -- MEM86_PART and mem86Lit(): only the owner sees the new memorizer');
{
  const src = fs.readFileSync(path.join(REPO, 'app.jsx'), 'utf8');
  const fnOf = (name) => {
    const i = src.indexOf('\nfunction ' + name + '(');
    if (i < 0) return '';
    let d = 0;
    for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i + 1, k + 1); } }
    return '';
  };
  const part = TOP.get('MEM86_PART');
  ok(part === "'off'" || part === "'owner'", "MEM86_PART is 'off' or 'owner' ('public' only by a later word of the owner): " + part);
  const fns = ['ez110Sha256Hex', 'ez110ReadOwner', 'ez110LocalOverride'].map(fnOf);
  ok(fns.every(Boolean) && TOP.has('mem86Lit') && TOP.has('EZ110_IDS') && TOP.has('EZ110_UNLOCK_KEY') && TOP.has('EZ110_UNLOCK_SHA'), 'item 110\'s owner check and mem86Lit lift from app.jsx');
  const TEST_CODE = 'mem86-check-' + 'c'.repeat(12);
  const litOn = ({ host, search = '', store = {}, partAs = part, sha = TOP.get('EZ110_UNLOCK_SHA') }) => {
    const ctx = vm.createContext({
      window: { location: { hostname: host, search } },
      localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: () => {}, removeItem: () => {} },
      URLSearchParams, unescape, encodeURIComponent,
    });
    return vm.runInContext(
      'const EZ110_IDS = ' + TOP.get('EZ110_IDS') + '; const EZ110_UNLOCK_KEY = ' + TOP.get('EZ110_UNLOCK_KEY') + '; const EZ110_UNLOCK_SHA = ' + sha + ';\n' +
      fns.join('\n') + '\nconst EZ110_OWNER = ez110ReadOwner(); const EZ110_OVERRIDE = ez110LocalOverride();\n' +
      'const MEM86_PART = ' + partAs + '; const mem86Lit = ' + TOP.get('mem86Lit') + ';\nmem86Lit()', ctx);
  };
  const HOSTS = ['ezik.app', 'www.ezik.app', 'almurabbi.app', 'ustaz-git-main-musaed-s-projects1.vercel.app', 'ustaz-cqznsm3am-musaed-s-projects1.vercel.app', 'localhost.evil.com', '127.0.0.1.nip.io', ''];
  for (const host of HOSTS) {
    ok(litOn({ host }) === false && litOn({ host, search: '?ezik110=b' }) === false && litOn({ host, search: '?ezik110=b&memred=1&fix=1&safe=1' }) === false,
      'dark for a reader without the owner\'s code on "' + host + '", with or without ?ezik110=b');
  }
  ok(litOn({ host: 'ezik.app', store: { [JSON.parse(TOP.get('EZ110_UNLOCK_KEY').replace(/'/g, '"'))]: 'not-the-code-but-long-enough' } }) === false, 'a wrong code on ezik.app stays dark');
  const testSha = "'" + require('crypto').createHash('sha256').update(TEST_CODE).digest('hex') + "'";
  const codeStore = { [JSON.parse(TOP.get('EZ110_UNLOCK_KEY').replace(/'/g, '"'))]: TEST_CODE };
  ok(litOn({ host: 'ezik.app', store: codeStore, sha: testSha }) === (part === "'owner'"), 'the device holding the owner\'s code (a test code against its own hash) is lit on ezik.app while the part is owner');
  ok(litOn({ host: 'localhost', search: '?ezik110=b' }) === (part === "'owner'") && litOn({ host: '127.0.0.1', search: '?ezik110=c' }) === (part === "'owner'"), '...and so is the localhost override ?ezik110=b');
  ok(litOn({ host: 'localhost', search: '?ezik110=b', store: codeStore, sha: testSha, partAs: "'off'" }) === false, "'off' is dark even for the owner");
  // the reader without the switch gets main's settings
  const PM = vm.runInContext('(' + TOP.get('MEM86_PREF_MAIN').replace('MEM86_PREF_DEFAULT', '(' + TOP.get('MEM86_PREF_DEFAULT') + ')') + ')', vm.createContext({}));
  ok(PM.dim === true && PM.speed === 1 && PM.repA === 1 && PM.repR === 1 && PM.hideNums === false && PM.weak === false, 'MEM86_PREF_MAIN is main\'s memorizer: dimmed text, speed 1, x1, numbers shown, no weak colours');
  // where it is asked: a pinned count, and never inside what the tool lifts
  const code = src.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  const all = (code.match(/mem86Lit\(\)/g) || []).length;
  ok(all === 27, 'mem86Lit() is asked at exactly 27 places (render, writes, the owner\'s menu of 12 October, his follower of that night, his own engine of phase 2, and a word given him on a held ayah): ' + all);
  const home = code.slice(code.indexOf('function Home('), code.indexOf('\nfunction ', code.indexOf('function Home(') + 10));
  ok((home.match(/mem86Lit\(\)/g) || []).length === 1 && home.includes('mem86Lit() ? dailyWirdLines(readDailyWird(), wt, mem86WirdToday()) : dailyWirdLines(readDailyWird(), wt)'), 'the home card asks once: the plan share for the owner, main\'s call for everyone else');
  const scr = code.slice(code.indexOf('function MemorizeScreen('), code.indexOf('\nfunction ', code.indexOf('function MemorizeScreen(') + 10));
  ok((scr.match(/mem86Lit\(\)/g) || []).length === 26, 'MemorizeScreen asks at 26 places: ' + (scr.match(/mem86Lit\(\)/g) || []).length);
  for (const [label, re] of [
    ['the tabs', /\{mem86Lit\(\) \? <Mem86Tabs /], ['the held count on a surah card', /\{mem86Lit\(\) && held\[n\] \?/],
    ['«similar passages»', /\{mem86Lit\(\) \? <button type="button" style=\{s\.mem86BtnQuiet\}/], ['the talqin options', /\{mem86Lit\(\) && drillMode === 'manual' && \(/],
    ['the listening options', /\{mem86Lit\(\) && drillMode === 'adnan' && \(/], ['the recite options (hints, pause, dimmed, numbers)', /\{mem86Lit\(\) && drillMode === 'recite' && \(/],
    ['the settings (read, and written)', /useState\(\(\) => \(mem86Lit\(\) \? mine\(mem86PrefsRead\(\)\) : MEM86_PREF_MAIN\)\)/],
    ['...written', /const setPref = \(patch\) => \{ if \(!mem86Lit\(\)\) return;/],
    ['the credit of a finished recitation', /const reciteCredit = \(\) => \{\n\s*if \(!mem86Lit\(\)\) return;/],
    ['the reveal-all effect', /useEffect\(\(\) => \{\n\s*if \(!mem86Lit\(\)\) return;\n\s*if \(!allRevealed/],
    ['the touch effect', /useEffect\(\(\) => \{\n\s*if \(!mem86Lit\(\)\) return undefined;\n\s*if \(view !== 'drill'/],
    ['the heard-word clock', /if \(mem86Lit\(\)\) mem86Ping\(\);/],
    ['?memred=1 marks', /if \(MEM_RED_FLAGGING\) \{[^\n]*\n\s*if \(mem86Lit\(\)\) \{/],
    ['?memred=1 dashed word', /if \(mem86Lit\(\) && MEM_RED_FLAGGING && redMarks\.notErr/], ['?memred=1 «not a mistake»', /\{mem86Lit\(\) && MEM_RED_FLAGGING && redMarks\.pick/],
    ['the follower at each result', /if \(mem86Lit\(\)\) \{ reciteFollowStep\(\); return; \}/],
    ['the follower at a restart, and the retried start', /if \(mem86Lit\(\)\) \{\n\s*const g = reciteFollowRef\.current, at = reciteAyahRef\.current \|\| startAyah;\n\s*reciteFollowRef\.current = \{ cur: at, prev: reciteShownRef\.current\.slice\(\), cut: 0, given: g\.cur === at \? g\.given : null \};\n\s*reciteHeardRef\.current = ''; reciteFinalRef\.current = '';[^\n]*\n\s*const tryStart = \(attempt\) => \{/],
    ['a word given him on his page (13 October)', /const f = reciteFollowRef\.current;\n\s*if \(mem86Lit\(\) && reciteRecognitionRef\.current && f\.cur === cur\) \{\n\s*reciteFollowRef\.current = \{ \.\.\.f, given: \(f\.given \|\| \[\]\)\.concat\(add\) \};\n\s*reciteFollowStep\(\);/],
    ['the units only for the manual talqin', /const units = view === 'drill' && \(drillMode === 'manual' \|\| !mem86Lit\(\)\) \? buildUnits\(\) : \[\];/],
    ['the sticky bar', /\{drillMode === 'recite' && \(mem86Lit\(\) \? \(\n/],
    ['the error line under the page for everyone else', /\{reciteErr && !mem86Lit\(\) && <div style=\{s\.memMsg\}>\{reciteErr\}<\/div>\}/],
    ['the first tab', /const \[tab, setTab\] = useState\(\(\) => \(mem86Lit\(\) \? 'recite' : 'learn'\)\);/],
    ['the start opens the tab\'s mode, listening for «سمِّعني»', /if \(mem86Lit\(\)\) \{ stopAdnan\(\); stopRecite\(\); resetRecite\(\); setDrillMode\(tab === 'listen' \? 'adnan' : 'recite'\); reciteAutoRef\.current = tab !== 'listen'; \}/],
    ['the three-mode switch is not drawn', /\{!mem86Lit\(\) && \(\n\s*<div style=\{s\.memToggleRow\}>\n\s*<button onClick=\{\(\) => setMode\('manual'\)\}/],
    ['the recite page', /\{mem86Lit\(\) \? \(\n\s*<Mem86RecitePage sn=\{selectedSurah\} from=\{startAyah\} to=\{surahCount\} cur=\{reciteAyah \|\| startAyah\}/],
    ['his own engine first, on the computer it runs on, the browser\'s when it does not answer (phase 2)', /const ear = mem86Lit\(\) && mem86Own\(\) && !viaWeb && ezEar\.here\(\);[^\n]*\n\s*if \(!ear && !ezSpeechAvailable\(\)\) \{ setReciteErr\(RECITE_NO_SR\); return; \}/],
  ]) ok(re.test(scr), 'gated by mem86Lit(): ' + label);
  // 13 October: what stays his alone whatever the part -- his engine, and the red of his experiment (decision 10)
  ok(TOP.get('mem86Own') === '() => EZ110_OWNER || !!(EZ110_OVERRIDE && EZ110_OVERRIDE.id)' && (TOP.get('mem86Lit') || '').includes("(MEM86_PART === 'owner' && (EZ110_OWNER || !!(EZ110_OVERRIDE && EZ110_OVERRIDE.id)))"),
    'what stays his alone whatever the part is asked by mem86Own: the device holding his code, or the localhost override -- mem86Lit\'s own owner test, word for word');
  ok(scr.includes('const ear = mem86Lit() && mem86Own() && !viaWeb && ezEar.here();'),
    'his engine is asked on his device alone: opened to everyone, no other reader\'s page ever tries to reach his own computer');
  ok(scr.includes('const mine = (p) => (mem86Own() ? p : { ...p, wrong: false });') && scr.includes('useState(() => (mem86Lit() ? mine(mem86PrefsRead()) : MEM86_PREF_MAIN))') && scr.includes('setPrefs(mine(mem86PrefsWrite(patch)))')
    && code.includes("{own ? <Mem86Switch on={prefs.wrong} onFlip={(v) => onPref({ wrong: v })} label={ezT('mem86.opt.wrong')} /> : null}") && scr.includes('<Mem86ReciteOpts prefs={prefs} onPref={setPref} own={mem86Own()} />'),
    'the red of his experiment is his alone (decision 10): its switch is drawn for him only, and any other reader has it off whatever is stored');
  const liftedAsk = [...TOP.keys()].filter((n) => /^(mem86|MEM86_)/.test(n) && n !== 'mem86Lit' && TOP.get(n).includes('mem86Lit'));
  ok(liftedAsk.length === 0, 'no top-level memorizer initializer asks the switch (the tool lifts them): ' + liftedAsk.join(', '));
  const reset = code.slice(code.indexOf('const resetAll = () => {'), code.indexOf('\n  };', code.indexOf('const resetAll = () => {')));
  ok(reset.length > 0 && !reset.includes('mem86Lit'), '«delete all my data» removes the eight keys for everyone, switch or not');
}

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
const pru = appNoComments.slice(appNoComments.indexOf('const playRecitationUrl = (url, myId, rate) =>'), appNoComments.indexOf('const playRecitation = (sNum, aNum, myId, rate, reciter) =>'));
ok(pru.length > 0 && /audio\.src = url;\n\s*if \(rate && rate !== 1\) audio\.playbackRate = rate;/.test(pru), 'the rate is an optional parameter set right AFTER src (src resets it)');
ok(appNoComments.length > 0 && !/defaultPlaybackRate/.test(appNoComments), 'defaultPlaybackRate is never touched');
ok((appNoComments.match(/playbackRate/g) || []).length === 1, 'playbackRate is written in exactly one place');
const memScreen = appSrc.slice(appSrc.indexOf('function MemorizeScreen('), appSrc.indexOf('\nfunction ', appSrc.indexOf('function MemorizeScreen(') + 10));
ok(memScreen.length > 0 && (memScreen.match(/onPlayVerse\(selectedSurah, a, prefs\.speed, prefs\.kids \? MEM86_KIDS_RECITER : undefined\)/g) || []).length === 2, 'only the memorizer passes a speed (and, with the children switch, the one other folder) -- in the loop and in «repeat»');
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
ok(memScreen.length > 0 && memScreen.includes('<button onClick={reciteListening ? pauseRecite : () => startRecite(reciteResumeAt)} style={s.memRevealBtn}>')
  && memScreen.includes('const reciteResumeAt = reciteListening || reciteFinished ? 0 : (recitePaused || ((reciteAyah || startAyah) > startAyah ? reciteAyah : 0));')
  && /const startRecite = \(fromAyah, viaWeb\) =>/.test(memScreen), 'the owner\'s «إيقاف» pauses and «متابعة» resumes through startRecite, at the paused ayah or the one a stopped run reached');
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
const hintFn = memScreen.slice(memScreen.indexOf('const reciteHint = (rest) => {'), memScreen.indexOf('const startRecite = (fromAyah, viaWeb) =>'));
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
ok(wl2.length > 0 && !/mem86/.test(wl2) && /^function dailyWirdLines\(dw, pageTarget, planLine\)/.test(wl2), 'decision 18: dailyWirdLines takes the plan line as a parameter and names no plan helper (gate wird lifts it alone)');
ok((appSrc.match(/dailyWirdLines\(readDailyWird\(\), wt, mem86WirdToday\(\)\)/g) || []).length === 1, '...and the home card hands it mem86WirdToday()');
lift(['mem86Day', 'mem86PortionLabel', 'mem86WirdToday']);
X.DW_LINE_MEMORIZE = 'MEM'; X.DW_SURAH_WORD = 'SURAH'; X.dailyWirdLines = vm.runInContext('(' + wl2 + '\n})', X);
X.SURAH_NAMES = new Proxy({}, { get: (t, k) => 'S' + String(k) }); X.toArabicDigits = (v) => String(v); X.ezT = (k, o) => k + (o ? ':' + o.n : '');
reset();
ok(X.mem86WirdToday() === '', 'decision 18: no plan, no share');
X.mem86PlansWrite([{ ...base, created: '2020-01-01' }]);
ok(X.mem86WirdToday() === 'S112 1\u20133', 'a due 3-ayah plan gives today\'s three ayat');
X.mem86PlansWrite([{ ...base, created: '2020-01-01' }, { ...base, id: 'p2', unit: 'mins', amt: 15, created: '2020-01-01' }, { ...base, id: 'p3', arch: true, created: '2020-01-01' }]);
ok(X.mem86WirdToday() === 'S112 1\u20133 \u00b7 mem86.minN:15', 'every due plan is listed, a minutes plan by its minutes, an archived plan not at all');
const dwPick = { mushaf: { mode: '', surah: 0 }, adhkar: { cat: '', title: '' }, memorize: { surah: 2 } };
ok(X.dailyWirdLines(dwPick, null).length === 1 && X.dailyWirdLines(dwPick, null)[0].indexOf('S2') !== -1, 'without a plan line the card keeps the chosen surah');
ok(X.dailyWirdLines(dwPick, null, 'PLAN')[0].indexOf('PLAN') !== -1 && X.dailyWirdLines(dwPick, null, 'PLAN')[0].indexOf('S2') === -1, '...and with one, the memorisation line is the plan\'s share');
reset();

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

/* ------------------------------------------------------------------ phase 8 */
section('phase 8 -- similar passages');
lift(['mem86SimIndex', 'mem86Rasm', 'mem86Similar']);
X.__mem86Sim = null;
const tb = Date.now();
const SIX = X.mem86SimIndex();
const buildMs = Date.now() - tb;
ok(SIX && Object.keys(SIX.toks).length === 6236, 'the index covers the 6236 ayat; built in ' + buildMs + ' ms here (measured, this machine)');
const r55 = X.mem86Similar(55, 13);
ok(r55 && r55.similar.length === 30 && r55.similar.every((x) => x.s === 55 && x.n === X.tokenizeForRecite(X.__quranData['55:13']).length), '55:13 recurs whole in 30 other ayat of ar-Rahman, every word shared');
const r235 = X.mem86Similar(2, 35);
const to719 = r235 && r235.similar.find((x) => x.s === 7 && x.a === 19);
ok(to719 && to719.n === 13 && to719.diff.length === 0, '2:35 and 7:19 (the garden) share 13 words, letter for letter (measured)');
const r220 = X.mem86Similar(2, 20);
const to2106 = r220 && r220.similar.find((x) => x.s === 2 && x.a === 106);
ok(to2106 && to2106.n === 5 && JSON.stringify(to2106.diff) === '[19]', '2:20 and 2:106 share 5 words; word 20 of 2:20 matches when normalized but differs in the rasm, so it is marked different (measured)');
let withDiff = 0, pairs = 0;
for (const k of ['2:20', '2:77', '2:87', '55:13']) { const [a1, a2] = k.split(':').map(Number); for (const x of X.mem86Similar(a1, a2).similar) { pairs++; if (x.diff.length) withDiff++; } }
ok(pairs > 0 && withDiff > 0 && withDiff < pairs, 'the normalized index finds candidates; the rasm check keeps ' + (pairs - withDiff) + ' of ' + pairs + ' fully identical and marks ' + withDiff + ' (sample of four ayat)');
const r1 = X.mem86Similar(112, 1);
ok(r1 && r1.similar.length === 0 && r1.phrases.length === 0, '112:1 has no three-word run elsewhere');
// the rasm check keeps the hamza seat and the dagger alef, ignores the harakat
const w1 = X.__quranData['2:2'].split(/\s+/)[0];
ok(X.mem86Rasm(w1) !== X.normalizeForRecite(w1) && X.mem86Rasm(w1).length < w1.length, 'the rasm drops the harakat but is not the matcher\'s flat form');
ok(!/[ً-ْ]/.test(X.mem86Rasm(X.__quranData['1:2'])), 'no haraka survives the rasm');
ok(/ٰ/.test(X.mem86Rasm(X.__quranData['1:2'])), 'the dagger alef survives it');

/* ------------------------------------------------------------------ the recite restart anchor */
// A recognizer RESTART begins a fresh transcript (Android ends a session at every pause). Measured on 49d5377:
// matching the session's words against everything since the run began bound an ayah whose words occurred
// earlier in the run to that earlier place, so 1:3 (its words end 1:1) never completed, nor 132 of 6122 ayat
// when a run starts at the first ayah of its surah. For the owner the anchor moves with the restart; for
// everyone else it stays at the run's start, which must be the old cumulative expected exactly. The recognizer
// here is perfect -- it returns each ayah's own words -- so any failure below is the matcher's.
section('the owner\'s follower -- every surah to its end, the openings by their names, moving on, never early');
// 12 October, night: «سمِّعني» FOLLOWS the owner (mem86Follow). The current ayah is judged in a window -- the ayah
// before it, itself, the two after it -- and completes by its last word or by his having moved on; the 30 openings
// are accepted spelled by the names of their letters. What a recognizer RETURNS is modelled here by the mushaf's own
// words only -- no second text lives in this repository. Measured outside it before the follower was written, on
// 685e447: a recognizer writing modern spelling halted 17 surahs at 30 ayat, one spelling the openings by their names
// 19 surahs at their first ayah; with the follower, none (the commit that brought it in has the numbers).
lift(['getVerseText', 'RECITE_LENIENT_THRESHOLD', 'wordSim', 'alignRecite',
  'RECITE_RED_HAMZAT', 'RECITE_RED_DAGGER', 'RECITE_RED_SMALL_WAW', 'RECITE_RED_SMALL_YA', 'RECITE_RED_SMALL_HIGH_YA',
  'RECITE_RED_HAMZA_ABOVE', 'RECITE_RED_SILENT', 'RECITE_RED_DROP', 'reciteRedAccepts', 'recitePattern', 'normalizeHeardRed',
  'tokenizeHeardRed', 'patternsForVerse', 'redWordSim', 'RECITE_RED_THRESHOLD', 'RECITE_RED_MAX_RUN', 'redSplitsInTwo',
  'redJoinsInTwo', 'alignReciteRed', 'mem86ReciteExpected', 'mem86ReciteSlice',
  'MEM86_LETTER_NAMES', 'mem86IsOpening', 'MEM86_SPELL_BAR', 'mem86Fold', 'mem86Spell', 'MEM86_WRONG_BAR', 'MEM86_NONE',
  '__mem86Words', 'mem86FollowWords', 'mem86FollowWindow', 'mem86FollowHeard', 'mem86FollowSpell', 'MEM86_ALIGN_WORD', 'MEM86_ALIGN_RUN', 'mem86PatSim',
  '__mem86Close', 'mem86Close', 'mem86FollowAlign', 'mem86FollowJudge', 'mem86Follow']);
{
  const ta = Date.now();
  const T = (sn, a) => X.tokenizeForRecite(X.getVerseText(sn, a) || '');
  const said = (sn, a, from = 0, to) => T(sn, a).slice(from, to).join(' ');
  const raw = (sn, a) => String(X.getVerseText(sn, a) || '').split(/\s+/).filter((w) => X.normalizeForRecite(w));
  const n = (sn) => { let a = 1; while (X.getVerseText(sn, a + 1)) a++; return a; };
  const follow = (sn, st, heard, red) => X.mem86Follow(sn, st, heard, n(sn), !!red);

  // the openings
  const openings = [];
  for (let sn = 1; sn <= 114; sn++) for (let a = 1; a <= n(sn); a++) raw(sn, a).forEach((w, i) => { if (X.mem86IsOpening(w)) openings.push([sn, a, i, w]); });
  ok(openings.length === 30 && openings.every(([, a, i]) => i === 0 && a <= 2), 'an opening is a word with no haraka: exactly 30 words of the mushaf, each the first word of its ayah (' + openings.length + ')');
  let spelled = 0;
  for (const [sn, a, , w] of openings) {
    const names = Array.from(X.normalizeForRecite(w)).map((c) => X.MEM86_LETTER_NAMES[c]);
    let good = names.every(Boolean);
    for (const spoken of [names.join(' '), names.join('')]) {
      const r = follow(sn, { cur: a, prev: null, cut: 0 }, (spoken + ' ' + said(sn, a, 1)).trim());
      if (!(r.left.length >= 1 && r.left[0][0] === a && r.left[0][1].every((x) => x === 'matched'))) good = false;
    }
    if (good) spelled++;
  }
  ok(spelled === 30, 'every opening said by the names of its letters, apart or glued, completes its ayah with every word heard (' + spelled + '/30)');

  // the whole mushaf, one session an ayah, the mushaf's own words, the red experiment on
  const tb = Date.now();
  let ayat = 0, moved = 0, quiet = 0, marked = 0, unfinished = 0, firstBad = '';
  for (let sn = 1; sn <= 114; sn++) {
    let st = { cur: 1, prev: null, cut: 0 }, done = false;
    for (let k = 1; k <= n(sn) && !done; k++) {
      ayat++;
      const r = follow(sn, st, said(sn, k), true);
      for (const [a, sh] of r.left) { if (a < k) moved++; if (sh.indexOf('pending') !== -1) quiet++; marked += sh.filter((x) => x === 'wrong').length; }
      if (r.finished) done = true;
      else st = { cur: r.cur, prev: r.shown, cut: 0 };   // the screen's restart: what was last shown of the current ayah
    }
    if (!done) { unfinished++; if (!firstBad) firstBad = sn + ':' + st.cur; }
  }
  ok(ayat === 6236 && unfinished === 0 && moved === 0 && quiet === 0 && marked === 0,
    'all 6236 ayat followed, one session an ayah: every surah to its end, each ayah by its own last word, no word left quiet, none marked red (' +
    [ayat, unfinished, moved, quiet, marked].join('/') + (firstBad ? ', first stuck ' + firstBad : '') + ') in ' + (Date.now() - tb) + ' ms');

  // the one-word-per-result reality: the interim results of a session grow a word at a time
  const tg = Date.now();
  let grown = 0, grownBad = '';
  for (const sn of [1, 112, 113, 114]) {
    let st = { cur: 1, prev: null, cut: 0 }, text = '', done = false;
    for (let k = 1; k <= n(sn) && !done; k++) for (const w of T(sn, k)) {
      text = (text + ' ' + w).trim();
      const r = follow(sn, st, text, false);
      if (r.finished) { done = true; break; }
      if (r.cur !== st.cur) st = { cur: r.cur, prev: null, cut: r.cut };
    }
    if (done) grown++; else if (!grownBad) grownBad = sn + ':' + st.cur;
  }
  ok(grown === 4, 'one session for a whole surah, its results growing a word at a time: al-Fatiha and the last three surahs followed to their ends (' + grown + '/4' + (grownBad ? ', stuck ' + grownBad : '') + ') in ' + (Date.now() - tg) + ' ms');

  // moving on: in al-Fatiha, juz Amma and al-Baqarah 1-40 every ayah but a surah's last loses its last word to the
  // recognizer; reciting what follows leaves it, with that one word quiet, and nothing is skipped
  const tm = Date.now();
  let leftQuiet = 0, wrongLeft = 0, endsReached = 0, surahs = 0;
  for (const sn of [1, 2].concat(Array.from({ length: 37 }, (_, i) => 78 + i))) {
    surahs++;
    const last = sn === 2 ? 40 : n(sn);
    let st = { cur: 1, prev: null, cut: 0 }, done = false;
    for (let k = 1; k <= last && !done; k++) {
      const w = T(sn, k);
      const r = X.mem86Follow(sn, st, (k < last ? w.slice(0, -1) : w).join(' '), last, false);
      for (const [a, sh] of r.left) {
        const q = sh.map((x, i) => (x === 'pending' ? i : -1)).filter((i) => i !== -1);
        if (a < last && q.length === 1 && q[0] === sh.length - 1) leftQuiet++; else if (a < last) wrongLeft++;
      }
      if (r.finished) done = true;
      else st = { cur: r.cur, prev: r.shown, cut: 0 };
    }
    if (done) endsReached++;
  }
  const lastWordAyat = [1, 2].concat(Array.from({ length: 37 }, (_, i) => 78 + i)).reduce((t, sn) => t + (sn === 2 ? 40 : n(sn)) - 1, 0);
  // Measured on this commit: 552 of the 572 are left with exactly that word quiet; 15 with more of it quiet, because a
  // short word heard alone is not taken as evidence of where the reader is; an-Nas alone stops, every one of its ayat
  // ending on the same lost word. Nothing is skipped and nothing is printed that was not heard or passed over.
  ok(lastWordAyat === 572 && endsReached === surahs - 1 && leftQuiet === 552 && wrongLeft === 15,
    'the last word of every ayah lost to the recognizer (al-Fatiha, al-Baqarah 1-40, juz Amma): reciting what follows leaves 552 of the 572 with exactly that word quiet and 15 with more of it, and every run but an-Nas\'s reaches its end (' +
    [endsReached + '/' + surahs, leftQuiet + '/' + lastWordAyat, wrongLeft].join(', ') + ') in ' + (Date.now() - tm) + ' ms');

  // never early: the first half of an ayah of four words or more never completes it -- the whole mushaf
  const th = Date.now();
  let halves = 0, early = 0, firstEarly = '';
  for (let sn = 1; sn <= 114; sn++) for (let k = 1; k <= n(sn); k++) {
    const w = T(sn, k);
    if (w.length < 4) continue;
    halves++;
    const r = follow(sn, { cur: k, prev: null, cut: 0 }, w.slice(0, Math.floor(w.length / 2)).join(' '));
    if (r.left.length) { early++; if (!firstEarly) firstEarly = sn + ':' + k; }
  }
  ok(halves === 5631 && early === 0, 'the first half of each of the ' + halves + ' ayat of four words or more completes nothing (' + early + (firstEarly ? ', first ' + firstEarly : '') + ') in ' + (Date.now() - th) + ' ms');

  // a restart in the middle of an ayah, then the whole ayah again from its start: it completes, and nothing after it
  const tr = Date.now();
  let again = 0, againBad = 0, firstAgain = '';
  for (let sn = 1; sn <= 114; sn += 3) for (let k = 1; k <= n(sn); k++) {
    const w = T(sn, k);
    if (w.length < 4) continue;
    again++;
    const half = follow(sn, { cur: k, prev: null, cut: 0 }, w.slice(0, Math.floor(w.length / 2)).join(' '));
    const r = follow(sn, { cur: k, prev: half.shown, cut: 0 }, w.join(' '));
    if (!(r.left.length === 1 && r.left[0][0] === k && (r.cur === k + 1 || r.finished))) { againBad++; if (!firstAgain) firstAgain = sn + ':' + k; }
  }
  ok(again > 1500 && againBad === 0, 'a restart in the middle of an ayah and the whole ayah said again (every third surah, ' + again + ' ayat): it completes and nothing after it (' + againBad + (firstAgain ? ', first ' + firstAgain : '') + ') in ' + (Date.now() - tr) + ' ms');

  // the red experiment: the second word replaced by an unlike word of the mushaf is marked there and nowhere else;
  // the second word left out is not marked at all (a word not heard is a recognizer's gap as often as a slip)
  const tw = Date.now();
  const pool = [];
  for (let sn = 2; sn <= 114 && pool.length < 3000; sn += 5) for (let k = 1; k <= n(sn); k++) for (const w of T(sn, k)) if (w.length >= 4) pool.push(w);
  let subs = 0, hit = 0, stray = 0, omitted = 0, omitMarked = 0, pi = 0;
  for (let sn = 1; sn <= 114; sn += 2) for (let k = 1; k <= n(sn); k++) {
    const w = T(sn, k);
    if (w.length < 4 || w[1].length < 3) continue;
    let rep = null;
    for (let t = 0; t < 60 && !rep; t++) { const c = pool[(pi++) % pool.length]; if (X.wordSim(c, w[1]) < 0.4) rep = c; }
    if (!rep) continue;
    subs++;
    const r = follow(sn, { cur: k, prev: null, cut: 0 }, [w[0], rep].concat(w.slice(2)).join(' '), true);
    const sh = r.left.length ? r.left[0][1] : r.shown;
    if (sh[1] === 'wrong') hit++;
    stray += sh.filter((x, i) => x === 'wrong' && i !== 1).length;
    omitted++;
    const o = follow(sn, { cur: k, prev: null, cut: 0 }, [w[0]].concat(w.slice(2)).join(' '), true);
    omitMarked += (o.left.length ? o.left[0][1] : o.shown).filter((x) => x === 'wrong').length;
  }
  ok(subs > 1500 && hit / subs > 0.95 && stray === 0 && omitMarked === 0, 'a word replaced by an unlike one is marked in its place (' + hit + ' of ' + subs + ', every other surah), never a word beside it (' + stray + '), and a word left out is never marked (' + omitMarked + ' of ' + omitted + ') in ' + (Date.now() - tw) + ' ms');
  // ...and by a LOOK-ALIKE: a word of the mushaf with the same first letter, a length within one, and a flat likeness of
  // 0.5 to 0.8 -- the swaps a reader really makes. Measured: about a third are marked, and nothing beside them.
  const tl = Date.now();
  const shapes = new Map();
  for (let sn = 1; sn <= 114; sn++) for (let k = 1; k <= n(sn); k++) for (const w of T(sn, k)) {
    if (w.length < 4) continue;
    const key = w[0] + w.length;
    if (!shapes.has(key)) shapes.set(key, []);
    const a = shapes.get(key);
    if (a.length < 400 && a.indexOf(w) === -1) a.push(w);
  }
  let looks = 0, lookHit = 0, lookStray = 0, li = 0;
  for (let sn = 1; sn <= 114; sn += 2) for (let k = 1; k <= n(sn); k++) {
    const w = T(sn, k);
    if (w.length < 4 || w[1].length < 4) continue;
    let rep = null;
    for (const L of [w[1].length, w[1].length + 1, w[1].length - 1]) {
      const a = shapes.get(w[1][0] + L) || [];
      for (let t = 0; t < a.length && !rep; t++) { const c = a[(li + t) % a.length]; const sim = X.wordSim(c, w[1]); if (sim >= 0.5 && sim < 0.8) rep = c; }
      if (rep) break;
    }
    li++;
    if (!rep) continue;
    looks++;
    const r = follow(sn, { cur: k, prev: null, cut: 0 }, [w[0], rep].concat(w.slice(2)).join(' '), true);
    const sh = r.left.length ? r.left[0][1] : r.shown;
    if (sh[1] === 'wrong') lookHit++;
    lookStray += sh.filter((x, i) => x === 'wrong' && i !== 1).length;
  }
  ok(looks > 1000 && lookHit / looks > 0.25 && lookStray === 0, 'a word replaced by a look-alike is marked in its place ' + lookHit + ' times of ' + looks + ', never beside it (' + lookStray + ') in ' + (Date.now() - tl) + ' ms');

  // HOLD -- the owner, 13 October: «المفترض انه يوقف مايتحرك, ماينتقل الى اي ايه نهائيا الا لما انطقها صح او انا اضغط كلمه
  // عشان يفتح علي واكمل, المهم انه ماينتقل الى اي شي حتى لو اطوف متعمد 10 مرات». His screen follows with hold: an ayah
  // is left only when it is said; a word of what follows heard first marks the words not said and keeps him there; a
  // word given him («كلمة») counts as said. The recognizer here is still perfect: the mushaf's own words.
  const holdF = (sn, st, heard, red, last) => X.mem86Follow(sn, st, heard, last || n(sn), !!red, true);
  const HOLD_SET = [1, 2].concat(Array.from({ length: 37 }, (_, i) => 78 + i));
  const hEnd = (sn) => (sn === 2 ? 40 : n(sn));
  const all = (sh, v) => sh.length > 0 && sh.every((x) => x === v);
  // (a) the whole mushaf as before: with hold nothing changes for an ayah said whole
  const ha = Date.now();
  let hAyat = 0, hHeld = 0, hOpen = 0, hMarked = 0, hFirst = '';
  for (let sn = 1; sn <= 114; sn++) {
    let st = { cur: 1, prev: null, cut: 0 }, done = false;
    for (let k = 1; k <= n(sn) && !done; k++) {
      hAyat++;
      const r = holdF(sn, st, said(sn, k), true);
      if (r.held) hHeld++;
      for (const [, sh] of r.left) hMarked += sh.filter((x) => x !== 'matched').length;
      if (r.finished) done = true; else st = { cur: r.cur, prev: r.shown, cut: 0 };
    }
    if (!done) { hOpen++; if (!hFirst) hFirst = sn + ':' + st.cur; }
  }
  ok(hAyat === 6236 && hHeld === 0 && hOpen === 0 && hMarked === 0, 'with hold, all 6236 ayat said whole, one session an ayah: every surah to its end, nothing held, nothing marked (' +
    [hAyat, hHeld, hOpen, hMarked].join('/') + (hFirst ? ', first stuck ' + hFirst : '') + ') in ' + (Date.now() - ha) + ' ms');
  // (b) an ayah left out (al-Fatiha, al-Baqarah 1-40, juz Amma; every ayah but a range's last): the next one said in its
  // place holds the page on it, its words marked -- red with the switch on, 'blank' with it off; the next ones said ten
  // times over in the same session, it stays; then said, it is left whole and the next ayah follows on
  const hb = Date.now();
  let skipped = 0, heldAny = 0, heldAll = 0, heldOff = 0, stayed = 0, back = 0, movedEarly = 0, firstEarly2 = '';
  for (const sn of HOLD_SET) for (let k = 1; k < hEnd(sn); k++) {
    skipped++;
    const last = hEnd(sn);
    let text = said(sn, k + 1);
    const r1 = holdF(sn, { cur: k, prev: null, cut: 0 }, text, true, last);
    if (r1.cur !== k || r1.left.length) { movedEarly++; if (!firstEarly2) firstEarly2 = sn + ':' + k; continue; }
    if (r1.held) heldAny++;
    if (r1.held && all(r1.shown, 'wrong')) heldAll++;
    const r0 = holdF(sn, { cur: k, prev: null, cut: 0 }, text, false, last);
    if (r0.held && all(r0.shown, 'blank')) heldOff++;
    let st = { cur: r1.cur, prev: r1.prev, cut: r1.cut }, still = true;
    for (let t = 0; t < 10; t++) {
      text += ' ' + said(sn, Math.min(last, k + 1 + (t % 2)));
      const r = holdF(sn, st, text, true, last);
      if (r.cur !== k || r.left.length) { still = false; break; }
      st = { cur: r.cur, prev: r.prev, cut: r.cut };
    }
    if (still) stayed++;
    text += ' ' + said(sn, k) + ' ' + said(sn, k + 1);
    const r2 = holdF(sn, st, text, true, last);
    if (r2.left.length >= 2 && r2.left[0][0] === k && all(r2.left[0][1], 'matched') && r2.left[1][0] === k + 1 && all(r2.left[1][1], 'matched')) back++;
  }
  // Measured on this commit: of 572, none is left for what follows it. 570 are held: 562 with every word marked, 8 with
  // the words the next ayah begins or ends with printed (said, as its words: 2:3, 81:24, 85:10, 97:2, 98:6, 107:5,
  // 113:3, 113:4); 1:2 and 109:4 are not held and not marked -- what follows them is the ayah behind them, or its twin --
  // so the page simply waits. All stay through ten more but 109:3, whose twin 109:5 is said among them; all are left
  // whole once said.
  ok(skipped === 572 && movedEarly === 0 && heldAny === 570 && heldAll === 562 && heldOff === heldAll && stayed === skipped - 1 && back === skipped,
    'an ayah left out holds the page on it: of ' + skipped + ' (al-Fatiha, al-Baqarah 1-40, juz Amma) none is left for what follows it (' + movedEarly + (firstEarly2 ? ', first ' + firstEarly2 : '') + '), ' +
    heldAny + ' held, ' + heldAll + ' with every word marked red (' + heldOff + ' blank with the switch off), ' + stayed + ' stay through ten more, ' + back + ' are left whole once said, the next ayah after them, in ' + (Date.now() - hb) + ' ms');
  // (c) part of an ayah, then the next one: held with the part he said printed and the rest marked; the rest said: left whole
  // (d) its last word lost to the recognizer (the case «moving on» covers without hold): held with that word marked; said again, left whole
  const hc = Date.now();
  let parts = 0, partHeld = 0, partBack = 0, lost = 0, lostHeld = 0, lostBack = 0;
  for (const sn of HOLD_SET) for (let k = 1; k < hEnd(sn); k++) {
    const w = T(sn, k), last = hEnd(sn);
    if (w.length >= 4) {
      parts++;
      const half = Math.floor(w.length / 2);
      let text = said(sn, k, 0, half) + ' ' + said(sn, k + 1);
      const r = holdF(sn, { cur: k, prev: null, cut: 0 }, text, true, last);
      if (r.held && r.cur === k && r.shown.every((x, i) => x === (i < half ? 'matched' : 'wrong'))) partHeld++;
      text += ' ' + said(sn, k, half) + ' ' + said(sn, k + 1);
      const r2 = holdF(sn, { cur: r.cur, prev: r.prev, cut: r.cut }, text, true, last);
      if (r2.left.length >= 1 && r2.left[0][0] === k && all(r2.left[0][1], 'matched')) partBack++;
    }
    lost++;
    let text = said(sn, k, 0, w.length - 1) + ' ' + said(sn, k + 1);
    const r = holdF(sn, { cur: k, prev: null, cut: 0 }, text, true, last);
    if (r.held && r.cur === k && r.shown.every((x, i) => x === (i < w.length - 1 ? 'matched' : 'wrong'))) lostHeld++;
    text += ' ' + said(sn, k) + ' ' + said(sn, k + 1);
    const r2 = holdF(sn, { cur: r.cur, prev: r.prev, cut: r.cut }, text, true, last);
    if (r2.left.length >= 1 && r2.left[0][0] === k && all(r2.left[0][1], 'matched')) lostBack++;
  }
  // Measured on this commit: 4 of the halves are held with a word more printed -- the next ayah begins with it (88:11,
  // 112:1, 112:3) -- or are complete (97:2: its last two words are how 97:3 begins, the short word before them passed
  // over); 2 ayat whose last word the next ayah begins with are complete when it is said (86:5, 96:1).
  ok(parts === 329 && partHeld === 325 && partBack === 328 && lost === 572 && lostHeld === 570 && lostBack === 570,
    'the first half of an ayah then the next one: held with the half printed and the rest red (' + partHeld + ' of ' + parts + '), left whole once the rest is said (' + partBack + '); its last word lost to the recognizer: held with that word red (' +
    lostHeld + ' of ' + lost + '), left whole once said again (' + lostBack + ') in ' + (Date.now() - hc) + ' ms');
  // (c2) the first word lost to the recognizer, the ayah said to its end and on: it is left (one word, or a third of a long
  // ayah, passes over at its start); the first half lost: held
  const hc2 = Date.now();
  let firstLost = 0, firstLeft = 0, firstLostBad = '', halfLost = 0, halfHeld = 0;
  for (const sn of HOLD_SET) for (let k = 1; k < hEnd(sn); k++) {
    const w = T(sn, k), last = hEnd(sn);
    if (w.length < 2) continue;
    firstLost++;
    const r = holdF(sn, { cur: k, prev: null, cut: 0 }, said(sn, k, 1) + ' ' + said(sn, k + 1), true, last);
    if (r.left.length >= 1 && r.left[0][0] === k) firstLeft++; else if (!firstLostBad) firstLostBad = sn + ':' + k;
    if (w.length >= 6) {
      halfLost++;
      const q = holdF(sn, { cur: k, prev: null, cut: 0 }, said(sn, k, Math.ceil(w.length / 2)) + ' ' + said(sn, k + 1), true, last);
      if (q.held && q.cur === k && !q.left.length) halfHeld++;
    }
  }
  ok(firstLost === 567 && firstLeft === firstLost && halfLost === 115 && halfHeld === halfLost,
    'the first word of an ayah lost to the recognizer, the ayah said to its end and on: it is left (' + firstLeft + ' of ' + firstLost + (firstLostBad ? ', first not ' + firstLostBad : '') + '); its first half left out: held (' + halfHeld + ' of ' + halfLost + ') in ' + (Date.now() - hc2) + ' ms');
  // (e) «كلمة»: a word given counts as said -- held with every word marked, the words given one by one leave it at the
  // last of them; stuck halfway, the rest given leaves it at once; nothing given, nothing moves
  const he = Date.now();
  let gHeld = 0, gLeft = 0, gEarly = 0, gHalf = 0, gHalfLeft = 0;
  for (const sn of HOLD_SET) for (let k = 1; k < hEnd(sn); k++) {
    const w = T(sn, k), last = hEnd(sn), text = said(sn, k + 1);
    const r1 = holdF(sn, { cur: k, prev: null, cut: 0 }, text, true, last);
    if (!r1.held) continue;
    gHeld++;
    let st = { cur: k, prev: r1.prev, cut: r1.cut, given: [] }, left = false;
    const need = r1.shown.map((x, i) => (x === 'matched' ? -1 : i)).filter((i) => i !== -1);   // the words not printed
    for (const i of need) {
      st = { ...st, given: st.given.concat([i]) };
      const r = holdF(sn, st, text, true, last);
      if (r.left.length) { if (i === need[need.length - 1] && r.left[0][0] === k && r.left[0][1].every((x, j) => x === (need.indexOf(j) === -1 ? 'matched' : 'hint'))) left = true; else gEarly++; break; }
    }
    if (left) gLeft++;
    if (w.length >= 4) {
      gHalf++;
      const half = Math.floor(w.length / 2);
      const r = holdF(sn, { cur: k, prev: null, cut: 0, given: Array.from({ length: w.length - half }, (_, i) => half + i) }, said(sn, k, 0, half), true, last);
      if (r.left.length === 1 && r.left[0][0] === k && r.cur === k + 1) gHalfLeft++;
    }
  }
  ok(gHeld > 500 && gLeft === gHeld && gEarly === 0 && gHalf > 300 && gHalfLeft === gHalf,
    '«كلمة» on a held ayah: its words not printed given one by one, it is left exactly at the last of them, printed with them as given ('  + gLeft + ' of ' + gHeld + ', ' + gEarly + ' early); stuck halfway, the rest given leaves it at once (' + gHalfLeft + ' of ' + gHalf + ') in ' + (Date.now() - he) + ' ms');
  // (f) a word replaced, the ayah said to its end and on: held with the word red; the ayah said again right, left whole
  const hf = Date.now();
  let wSubs = 0, wHeld = 0, wBack = 0, wi2 = 0;
  for (let sn = 1; sn <= 114; sn += 2) for (let k = 1; k < n(sn); k++) {
    const w = T(sn, k);
    if (w.length < 4 || w[1].length < 3) continue;
    let rep = null;
    for (let t = 0; t < 60 && !rep; t++) { const c = pool[(wi2++) % pool.length]; if (X.wordSim(c, w[1]) < 0.4) rep = c; }
    if (!rep) continue;
    wSubs++;
    let text = [w[0], rep].concat(w.slice(2)).join(' ') + ' ' + said(sn, k + 1);
    const r = holdF(sn, { cur: k, prev: null, cut: 0 }, text, true);
    if (!(r.cur === k && !r.left.length && r.shown[1] === 'wrong')) continue;   // the matcher's own misses: measured above
    wHeld++;
    text += ' ' + said(sn, k) + ' ' + said(sn, k + 1);
    const r2 = holdF(sn, { cur: r.cur, prev: r.prev, cut: r.cut }, text, true);
    if (r2.left.length >= 1 && r2.left[0][0] === k && all(r2.left[0][1], 'matched')) wBack++;
  }
  ok(wSubs > 1500 && wHeld / wSubs > 0.95 && wBack === wHeld, 'a word replaced by an unlike one, the ayah said to its end and on: held with that word red (' + wHeld + ' of ' + wSubs + '), left whole once said right (' + wBack + ') in ' + (Date.now() - hf) + ' ms');

  // the screen wires it
  const src2 = fs.readFileSync(path.join(REPO, 'app.jsx'), 'utf8');
  const scr2 = src2.slice(src2.indexOf('function MemorizeScreen('), src2.indexOf('\nfunction ', src2.indexOf('function MemorizeScreen(') + 10));
  ok(scr2.includes('reciteAnchorRef.current = [from, 0];\n    reciteFollowRef.current = { cur: from, prev: null, cut: 0 };'), 'a run starts the follower at its first ayah with nothing heard (and everyone else\'s anchor at the run\'s start)');
  ok(scr2.includes('if (r.left.length) setReciteDone((d) => { const o = { ...d }; for (const [a, st] of r.left) o[a] = st; return o; });')
    && scr2.includes('if (r.finished) { setReciteFinished(true); stopRecite(); reciteCredit(); return; }')
    && scr2.includes('reciteFollowRef.current = { cur: r.cur, prev: r.prev, cut: r.cut };'), 'each result keeps every ayah the follower left, finishes the range only when it says so, and moves its state on');
  ok(scr2.includes('if (attempt < 5) { setTimeout(() => tryStart(attempt + 1), 150); return; }')
    && scr2.includes('reciteRunIdRef.current++; setReciteListening(false); mem86Rest(); setRecitePaused(reciteAyahRef.current || startAyah);'), 'a restart that fails is tried five more times, then the bar offers «متابعة» -- never a dead microphone behind «إيقاف»');
  ok(scr2.includes('reciteFollowRef.current = { cur: next, prev: null, cut: mem86FollowHeard(reciteHeardRef.current, 0).total };'), '«الآية التالية» moves the follower on past every word heard so far');
  ok(scr2.includes('const r = mem86Follow(selectedSurah, f, reciteHeardRef.current, surahCount, prefsRef.current.wrong, true);')
    && scr2.includes('reciteFollowRef.current = { cur: r.cur, prev: r.prev, cut: Math.max(f.cut | 0, mem86FollowHeard(reciteFinalRef.current, 0).total), given: f.given };')
    && scr2.includes('reciteFinalRef.current = finalText;') && scr2.includes("reciteHeardRef.current = ''; reciteFinalRef.current = '';   // the new session hears from nothing; what was shown stays")
    && (scr2.match(/reciteFollowStep\(\);/g) || []).length === 2,
    'his follower HOLDS (13 October) -- at every result and at a word given him: a held ayah keeps its marks, and what was heard is dropped up to its final part; a restarted session hears from nothing');
  const row2 = src2.slice(src2.indexOf('const Mem86PageRow = '), src2.indexOf('const Mem86RecitePage = '));
  const curAt = row2.indexOf('if (isCur) {'), hintAt = row2.indexOf('if (hints.indexOf(idx) !== -1) return', curAt), wrongAt = row2.indexOf("if (st === 'wrong') return dim ?", curAt);
  ok(curAt > 0 && hintAt > curAt && wrongAt > hintAt, 'the ayah he is held on shows its marks in place, and a word given him is drawn as given before its mark');
  ok(scr2.includes("if (!reciteAutoRef.current || view !== 'drill' || drillMode !== 'recite' || !ready || !surahCount) return;\n    reciteAutoRef.current = false;\n    startRecite();")
    && scr2.includes("reciteAutoRef.current = kind === 'review';"), 'the owner\'s «سمِّعني» opens listening: from a surah\'s «ابدأ» and from a review in his plan, once');

  // everyone else: the anchor never moves, and the expected is the old cumulative one, result for result
  const step = (sn, anchor, cur, heard) => {
    const exp = X.mem86ReciteExpected(sn, anchor, cur, false);
    return X.mem86ReciteSlice(exp, X.alignRecite(exp.tokens, X.tokenizeForRecite(heard)));
  };
  const oldStep = (sn, from, cur, heard) => {
    const tokens = []; let off = 0, len = 0;
    for (let a = from; a <= cur; a++) { const at = T(sn, a); if (a === cur) { off = tokens.length; len = at.length; } tokens.push(...at); }
    return X.alignRecite(tokens, X.tokenizeForRecite(heard)).slice(off, off + len);
  };
  const ti = Date.now();
  const SAMPLE = [1].concat(Array.from({ length: 22 }, (_, i) => 93 + i));
  let compared = 0, differ = 0, firstDiff = '';
  const cmp = (sn, cur, heard, label) => {
    compared++;
    if (!eq(step(sn, [1, 0], cur, heard), oldStep(sn, 1, cur, heard))) { differ++; if (!firstDiff) firstDiff = label; }
  };
  for (const sn of SAMPLE) {
    let run = '';
    for (let k = 1; k <= n(sn); k++) {
      const mid = Math.floor(T(sn, k).length / 2);
      cmp(sn, k, (run + ' ' + said(sn, k, 0, mid)).trim(), sn + ':' + k + ' half heard');
      run = (run + ' ' + said(sn, k)).trim();
      cmp(sn, k, run, sn + ':' + k + ' whole');
    }
  }
  let bq = '';
  for (let k = 1; k <= 5; k++) { bq = (bq + ' ' + said(2, k)).trim(); cmp(2, k, bq, '2:' + k); }
  ok(compared === 333 && differ === 0, 'everyone else: the unmoved anchor gives the old cumulative states in all ' + compared + ' results (al-Fatiha, ad-Duha to an-Nas, al-Baqarah 1-5) in ' + (Date.now() - ti) + ' ms' + (firstDiff ? ' -- first difference ' + firstDiff : ''));
  ok(Date.now() - ta < 300000, 'this section ran in ' + (Date.now() - ta) + ' ms here (measured: 111 s on the session\'s machine; the bound is the lang gate\'s order of time)');
}

/* ------------------------------------------------------------------ the owner's memorizer of 12 October */
// The owner's order: «سمِّعني» · «استماع وترديد» · «خطّتي» · «تقدّمي», and no «اختبرني» or manual talqin for him;
// «سمِّعني» opens the range as a page of numbered blanks that fill as he recites; «استماع وترديد» gains a switch for
// the sheikh with children repeating. Everything here is drawn behind the switch above.
section('the owner\'s memorizer of 12 October -- four tabs, the page of blanks, the children\'s voice');
lift(['MEM86_TABS', 'MEM86_KIDS_RECITER']);
{
  const src3 = fs.readFileSync(path.join(REPO, 'app.jsx'), 'utf8');
  const scr3 = src3.slice(src3.indexOf('function MemorizeScreen('), src3.indexOf('\nfunction ', src3.indexOf('function MemorizeScreen(') + 10));
  ok(eq(Array.from(X.MEM86_TABS), ['recite', 'listen', 'plan', 'progress']), 'the tabs are «سمِّعني» · «استماع وترديد» · «خطّتي» · «تقدّمي», in that order');
  const LANG = path.join(REPO, 'lang');
  const files = fs.readdirSync(LANG).filter((f) => f.endsWith('.json'));
  const keys = X.MEM86_TABS.map((t) => 'mem86.tab.' + t).concat(['mem86.opt.kids', 'mem86.opt.wrong']);
  const missing = [];
  for (const f of files) { const d = JSON.parse(fs.readFileSync(path.join(LANG, f), 'utf8')); for (const k of keys) if (typeof d[k] !== 'string' || !d[k].trim()) missing.push(f + ' ' + k); }
  for (const k of keys) if ((src3.match(new RegExp("'" + k.replace(/\./g, '\\.') + "': '[^']+'", 'g')) || []).length !== 2) missing.push('app.jsx ' + k);
  ok(files.length === 21 && missing.length === 0, 'every tab, the children switch and the red-mark switch have a label in Arabic, English and the ' + files.length + ' language files' + (missing.length ? ': missing ' + missing.slice(0, 4).join(', ') : ''));
  ok(scr3.includes("<div hidden={tab !== 'learn' && tab !== 'recite' && tab !== 'listen'}>"), 'the catalog is the body of both drill tabs (and of main\'s picker)');
  ok(scr3.includes("setTab(kind === 'review' ? 'recite' : 'listen')") && scr3.includes("setDrillMode(kind === 'review' ? 'recite' : 'adnan')"), 'a plan opens a review in «سمِّعني» and new ayat in «استماع وترديد»');
  ok((scr3.match(/setMode\('manual'\)/g) || []).length === 1 && scr3.includes("{!mem86Lit() && (\n      <div style={s.memToggleRow}>\n        <button onClick={() => setMode('manual')}")
    && !/setDrillMode\([^)]*'manual'/.test(scr3), 'the manual talqin is reached only through the three-mode switch, which is not drawn for the owner, and no plan opens it');
  // the page
  const page = src3.slice(src3.indexOf('const Mem86PageRow = '), src3.indexOf('\n};\n', src3.indexOf('const Mem86RecitePage = ')) + 3);
  ok(page.length > 200 && TOP.has('Mem86RecitePage') && TOP.has('Mem86PageRow'), 'Mem86RecitePage and its row are top-level components');
  ok(page.includes("for (let a = from; a <= to; a++) {") && page.includes("const mode = (finished || a < cur) ? 'printed' : a === cur ? 'cur' : 'blank';"), 'the page draws every ayah of the range: printed behind the current one, the current one, blanks after it');
  ok(page.includes('const Mem86PageRow = React.memo(') && page.includes("states={mode === 'cur' ? states : MEM86_NONE}") && page.includes("left={mode === 'printed' ? (done[a] || null) : null}")
    && page.includes("dim={mode === 'cur' && dim}"), 'each ayah is a memoised row, and only the current one is handed what changes at a result');
  ok(page.includes("if (st === 'matched') return <span key={i} style={{ ...s.memWord, ...mem86WeakStyle(weak, ref) }}>{w}</span>;") && page.includes('return <span key={i} style={s.mem86WordHint}>{w}</span>;'),
    'a printed ayah shows its heard words as text and any word left unheard quietly');
  ok(page.includes("return <span key={i} style={s.memPlaceholder}>—</span>;") && page.includes("if (!normalizeForRecite(w)) return printed ? <span key={i} style={s.memWordPending}>{w}</span> : null;"),
    'a word not yet said is a blank, and a pause mark is drawn only on a printed ayah');
  const markAt = page.indexOf("if (st === 'wrong') return <span key={i} style={{ ...s.memPlaceholder, ...s.mem86WrongMark }}>—</span>;");
  const heldAt = page.indexOf("if (st === 'wrong') return dim ? <span key={i} style={{ ...s.memWordPending, ...s.mem86WrongMark }}>{w}</span> : <span key={i} style={{ ...s.memPlaceholder, ...s.mem86WrongMark }}>—</span>;");
  ok(page.length > 0 && !/RedDash|RedWas|#C0392B|mem86ErrWord|memWordWrong/.test(page) && (page.match(/mem86WrongMark/g) || []).length === 3 && markAt > 0 && markAt < page.indexOf('if (isCur) {') && heldAt > page.indexOf('if (isCur) {'),
    'the page reddens nothing but the owner\'s mark for a word not said right -- on an ayah already left, with no word in it, and on the ayah he is held on (13 October), the word itself only dimmed when he chose to see the text');
  ok(page.includes('getVerseText(sn, a)') && !/[ء-ي]{3,}/.test(page.replace(/\/\/[^\n]*/g, '')), 'every word on the page comes from getVerseText; no Arabic text is written in its code');
  // the bar and the switch
  ok(scr3.includes('<div className="ezq-drill-acts" style={{ ...s.ezqStartBar, flexWrap: \'wrap\' }} data-ez110-edge="sticky">'), 'the owner\'s controls ride in the picker\'s sticky start bar, marked for the safe-area family');
  ok(src3.includes("<Mem86Switch on={prefs.wrong} onFlip={(v) => onPref({ wrong: v })} label={ezT('mem86.opt.wrong')} />"), 'the red mark has its own switch in the recite options');
  ok(X.MEM86_PREF_DEFAULT.wrong === true && vm.runInContext('(' + TOP.get('MEM86_PREF_MAIN').replace('MEM86_PREF_DEFAULT', '(' + TOP.get('MEM86_PREF_DEFAULT') + ')') + ')', vm.createContext({})).wrong === false,
    'the red mark is on for the owner until he turns it off, and off for every other reader');
  reset();
  X.mem86PrefsWrite({ wrong: false });
  const wOff = X.mem86PrefsRead().wrong;
  store.set(X.MEM86_PREFS_KEY, JSON.stringify({ wrong: 'no' }));
  const wJunk = X.mem86PrefsRead().wrong;
  reset();
  ok(wOff === false && wJunk === true, 'the red-mark switch is stored as a true or false, and anything else reads back as the default');
  // what the page keeps of the ayat left behind
  ok((scr3.match(/setReciteDone\(\(d\) => \(\{ \.\.\.d, \[cur\]: shown \}\)\)/g) || []).length === 2 && scr3.includes('const left = reciteShownRef.current.slice();') && scr3.includes('setReciteDone((d) => ({ ...d, [cur]: left }));'),
    'an ayah left behind is kept with its states: completed by the matcher (twice: on the way and at the end) or left by «الآية التالية»');
  ok(scr3.includes('reciteHiddenRef.current = !prefs.dim; setReciteDone({}); }') && scr3.includes('reciteShownRef.current = []; setReciteDone({});'), 'a fresh run and a fresh start empty the page; a resume keeps it');
  // the children's voice
  ok(X.MEM86_KIDS_RECITER === 'Minshawy_Teacher_128kbps' && X.MEM86_PREF_DEFAULT.kids === false, 'the children\'s voice is the Minshawy teacher folder, and it is off until the owner turns it on');
  const PM2 = vm.runInContext('(' + TOP.get('MEM86_PREF_MAIN').replace('MEM86_PREF_DEFAULT', '(' + TOP.get('MEM86_PREF_DEFAULT') + ')') + ')', vm.createContext({}));
  ok(PM2.kids === false, 'a reader without the switch never gets the children\'s voice');
  reset();
  X.mem86PrefsWrite({ kids: true });
  const on = X.mem86PrefsRead().kids;
  store.set(X.MEM86_PREFS_KEY, JSON.stringify({ kids: 'yes' }));
  const junk = X.mem86PrefsRead().kids;
  reset();
  ok(on === true && junk === false, 'the switch is stored as a true or false and nothing else is read back');
  ok(src3.includes('const folder = reciter === MEM86_KIDS_RECITER ? MEM86_KIDS_RECITER : QURAN_RECITER;') && src3.includes('const url = `https://everyayah.com/data/${folder}/${pad3(sNum)}${pad3(aNum)}.mp3`;'),
    'the player takes the children\'s folder or the default one, and nothing else, from everyayah.com alone');
  ok(scr3.includes('const pause = prefs.kids ? ADNAN_PAUSE_FLOOR : Math.min(ADNAN_PAUSE_CEIL, Math.max(ADNAN_PAUSE_FLOOR, elapsed * ADNAN_PAUSE_FACTOR));'),
    'with the children repeating in the audio only the short pause follows each ayah; without them the pause is as before');
  ok(src3.includes("<Mem86Switch on={prefs.kids} onFlip={(v) => !disabled && onPref({ kids: v })} label={ezT('mem86.opt.kids')} />"), 'the switch sits in the listening options, locked while the loop runs');
}

/* ------------------------------------------------------------------ phase 2: the owner's own engine */
// 13 October: the owner's «سمِّعني» is heard by item 86's own engine on his own computer (ezEar), not by the browser's.
// The engine speaks in word numbers; the page numbers its words the same way, which is measured here against the
// engine's own count for every ayah (guards/fixtures-ear-words.json, numbers only, cut from ear-lab). What the engine
// answers is laid on the page by three small functions, tested here; the wiring around them is read from the source.
section('phase 2 -- the owner\'s own engine (ezEar): his words in the engine\'s numbers, and the browser\'s engine when it does not answer');
lift(['mem86EarWords', 'mem86EarShown', 'mem86EarLeft', 'mem86EarHold']);
{
  const src4 = fs.readFileSync(path.join(REPO, 'app.jsx'), 'utf8');
  const scr4 = src4.slice(src4.indexOf('function MemorizeScreen('), src4.indexOf('\nfunction ', src4.indexOf('function MemorizeScreen(') + 10));
  const FX = JSON.parse(fs.readFileSync(path.join(REPO, 'guards', 'fixtures-ear-words.json'), 'utf8'));
  let ayat = 0, same = 0, firstOff = '';
  FX.counts.forEach((row, s) => row.forEach((n, a) => { ayat++; if (X.mem86EarWords(s + 1, a + 1) === n) same++; else if (!firstOff) firstOff = (s + 1) + ':' + (a + 1); }));
  ok(FX.counts.length === 114 && ayat === 6236 && same === 6236, 'the page counts the words of every ayah as the engine numbers them: ' + same + ' of ' + ayat + (firstOff ? ' (first off: ' + firstOff + ')' : ''));
  const page4 = src4.slice(src4.indexOf('const Mem86PageRow = '), src4.indexOf('const Mem86RecitePage = '));
  ok(page4.includes('if (!normalizeForRecite(w)) return printed ?') && page4.includes('const idx = k++;'), '...the page\'s own rule: a word is what normalizeForRecite keeps, numbered in order');
  const sh = (s, a, u) => JSON.stringify(Array.from(X.mem86EarShown(s, a, u)));
  const n11 = X.mem86EarWords(1, 1);
  ok(sh(1, 1, 0) === JSON.stringify(Array(n11).fill('pending')) && sh(1, 1, 2) === JSON.stringify(['matched', 'matched'].concat(Array(n11 - 2).fill('pending')))
    && sh(1, 1, 99) === JSON.stringify(Array(n11).fill('matched')), 'the current ayah fills to the last word the engine heard, never past the ayah\'s own words');
  const lf = (d, red) => Array.from(X.mem86EarLeft(2, d, red));
  const n22 = X.mem86EarWords(2, 2);
  const m = lf({ ayah: 2, flag: [3] }, true);
  ok(m.length === n22 && m[2] === 'wrong' && m.filter((x) => x === 'wrong').length === 1 && m.filter((x) => x === 'matched').length === n22 - 1, 'an ayah the engine completed is printed whole, the word its judge flagged marked in place while the red switch is on');
  ok(lf({ ayah: 2, flag: [3] }, false).every((x) => x === 'matched'), '...and printed whole with no mark while the switch is off');
  ok(lf({ ayah: 2, flag: [99, 0, 'x'] }, true).every((x) => x === 'matched') && lf({ ayah: 2 }, true).every((x) => x === 'matched'),
    'a flag outside the ayah marks nothing, and an engine before p2.3 (no \'heard\') has every word of a completed ayah heard');
  // 13 October: «لما طوفت اياه متعمد راح طبعها لي» -- an ayah passed over, or the words after the last one heard, were not
  // said: never printed (never 'matched', never the quiet 'pending' that shows the word), marked red with the switch on,
  // a blank with it off
  const eqA = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const rep = (n, v) => Array(n).fill(v);
  ok(eqA(lf({ ayah: 2, flag: [], skipped: true, heard: 0 }, true), rep(n22, 'wrong')) && eqA(lf({ ayah: 2, flag: [3], skipped: true }, false), rep(n22, 'blank'))
    && eqA(lf({ ayah: 2, skipped: true, heard: 4 }, true), rep(n22, 'wrong')),
    'an ayah the engine saw passed over is never printed: every word red with the switch on, a blank with it off (whatever else it says)');
  ok(eqA(lf({ ayah: 2, flag: [3], heard: 2 }, true), ['matched', 'matched'].concat(rep(n22 - 2, 'wrong')))
    && eqA(lf({ ayah: 2, flag: [3], heard: 2 }, false), ['matched', 'matched'].concat(rep(n22 - 2, 'blank')))
    && eqA(lf({ ayah: 2, flag: [], heard: 0 }, true), rep(n22, 'wrong')) && eqA(lf({ ayah: 2, flag: [], heard: 99 }, false), rep(n22, 'matched')),
    'the words after the last one the engine heard (he left the ayah early) are never printed: red with the switch on, blanks with it off');
  ok(![true, false].some((red) => [{ ayah: 2, skipped: true }, { ayah: 2, heard: 1 }, { ayah: 2, heard: 0, flag: [2] }].some((d) => lf(d, red).indexOf('pending') !== -1)),
    '...and never the quiet word: a word the engine did not hear is not shown on the page at all');
  const page5 = src4.slice(src4.indexOf('const Mem86PageRow = '), src4.indexOf('const Mem86RecitePage = '));
  const blankAt = page5.indexOf("if (st === 'blank') return <span key={i} style={s.memPlaceholder}>—</span>;");
  ok(blankAt > 0 && blankAt < page5.indexOf('return <span key={i} style={s.mem86WordHint}>{w}</span>;') && blankAt < page5.indexOf('if (isCur) {'),
    'the page draws a blank for it on an ayah already left, before the quiet word could be drawn');
  // 13 October, his second decision: «يرجّعك لها وتسمّعها من جديد، وبعدها يكمّل معك»
  const page6 = src4.slice(src4.indexOf('const Mem86PageRow = '), src4.indexOf('\n};\n', src4.indexOf('const Mem86RecitePage = ')) + 3);
  ok(page6.includes("const back = printed && onBack && Array.isArray(left) && left.some((x) => x === 'wrong' || x === 'blank') ? () => onBack(a) : null;")
    && page6.includes("role={back ? 'button' : undefined} tabIndex={back ? 0 : undefined} aria-label={back ? ezT('mem86.back') : undefined}")
    && page6.includes('onClick={back || undefined}') && page6.includes("if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); back(); }"),
    'an ayah already left with a word he did not say (red, or a blank) is a button -- by touch and by keyboard -- named in his language; any other row is not');
  ok(page6.includes("onBack={mode === 'printed' ? onBack : null}") && src4.includes('weak={prefs.weak} onBack={onReciteBack} />')
    && src4.includes('const onReciteBack = React.useCallback((a) => reciteBackRef.current(a), []);'),
    '...only the rows already left are handed it, and the handler never changes, so no row redraws for it');
  const backFn = scr4.slice(scr4.indexOf('const reciteBack = (a) => {'), scr4.indexOf('const reciteBackRef = useRef(reciteBack);'));
  ok(backFn.length > 0 && /if \(!\(a >= startAyah && a <= surahCount\)\) return;\n\s*stopRecite\(\);\n\s*setReciteFinished\(false\);\n\s*startRecite\(a\);/.test(backFn)
    && !/mem86Credit|mem86DaysAdd|reciteCleanRef/.test(backFn),
    'going back stops what listens and listens again from that ayah, as «متابعة» does -- it earns nothing and forgives nothing by itself');
  const LANG6 = path.join(REPO, 'lang');
  const miss6 = fs.readdirSync(LANG6).filter((x) => x.endsWith('.json')).filter((f) => { const d = JSON.parse(fs.readFileSync(path.join(LANG6, f), 'utf8')); return typeof d['mem86.back'] !== 'string' || !d['mem86.back'].trim(); });
  ok(miss6.length === 0 && (src4.match(/'mem86\.back': '[^']+'/g) || []).length === 2, 'its name is in Arabic, English and every language file');
  // the wiring
  const at = (t) => scr4.indexOf(t);
  const branch = "if (ear) { const myRun = ++reciteRunIdRef.current; setReciteListening(true); setReciteEar('wait'); reciteEarGo(from, myRun); return; }";
  ok(at(branch) > at('if (!hasValidAIConsent()) { setReciteErr(EZ_SPEECH_NO_CONSENT); return; }') && at('if (!hasValidAIConsent()) { setReciteErr(EZ_SPEECH_NO_CONSENT); return; }') > at('if (childVoiceBlocked()) { setReciteErr(CHILD_VOICE_NOTICE); return; }')
    && at(branch) < at('const rec = ezNewRecognition();'), 'the owner\'s branch is taken after the child guard and the voice consent, and before any browser engine is built');
  ok((scr4.match(/reciteEarGo\(/g) || []).length === 1 && (scr4.match(/ezEar\.reachable\(\)/g) || []).length === 1 && (scr4.match(/ezEar\.open\(/g) || []).length === 1 && (scr4.match(/ezEar\.here\(\)/g) || []).length === 1
    && at('ezEar.reachable()') > at('const reciteEarGo = async (from, myRun) => {') && at('ezEar.open(') > at('ezEar.reachable()'), 'the engine is reached from that branch alone, on a computer (never a phone or the app\'s shell, until the phone has its own address): asked whether it answers, then opened');
  ok(scr4.includes("const reciteEarWeb = (at) => { setReciteListening(false); setReciteEar(ezSpeechAvailable() && hasValidAIConsent() && !childVoiceBlocked() ? 'off' : ''); startRecite(at, true); };")
    && (scr4.match(/reciteEarWeb\(/g) || []).length === 3, 'when it does not answer, cannot begin, or stops answering, the browser\'s engine takes over from the ayah he is on, and the line under his bar says so');
  ok(scr4.includes("if (h.err === 'mic') {") && scr4.includes("setReciteErr(ezT('mem86.ear.mic'))") && scr4.includes("if (h.err === 'consent') {"), 'a microphone that will not open is said as such, and a consent withdrawn meanwhile ends the start');
  ok(scr4.includes('const ear = reciteEarRef.current;\n    reciteEarRef.current = null;\n    setReciteEar(\'\');') && scr4.includes('return ear ? ear.stop() : null;')
    && scr4.includes('if (reciteEarRef.current) { reciteEarRef.current.stop(); reciteEarRef.current = null; }'), 'every stop -- pause, mode, leaving, finishing -- closes the engine\'s microphone, and so does leaving the screen');
  ok(scr4.includes('if (reciteEarRef.current) reciteEarRef.current.seek(next);'), '«الآية التالية» moves the engine with him');
  ok(scr4.includes('if (st.cur > st.last) { mem86Ping(); setReciteFinished(true); stopRecite(); reciteCredit(); return; }') && scr4.includes('if (st.cur > st.last) { setRecitePaused(0); setReciteFinished(true); reciteCredit(); return; }')
    && !/st\.finished/.test(scr4),
    'a range earns when the engine has moved past its last ayah -- while he recites, or in its last answer after a pause (its `finished` also means "session over", so it is never read) -- through the same credit, which a manual «next» still forfeits');
  ok(scr4.includes('for (const d of keep) o[d.ayah] = mem86EarLeft(selectedSurah, d, prefsRef.current.wrong);') && scr4.includes('const keep = done.filter((d) => !stale || d.ayah < cur);'),
    'its flags reach the page only through mem86EarLeft under his red switch, and a late answer only prints ayat behind him');
  const earFns = scr4.slice(at('const reciteEarWeb = (at) =>'), at('const advanceReciteManual = () => {'));
  ok(earFns.length > 500 && !/mem86WordsLog|mem86Store|localStorage|mem86DaysAdd|mem86HeldSet/.test(earFns), 'what the engine hears writes nothing to the word log or any store of its own');
  ok(scr4.includes("{reciteEar ? <div style={{ ...s.memReciteHint, width: '100%', padding: 0 }}>{reciteEar === 'on' ? ezT('mem86.ear.on') : reciteEar === 'off' ? ezT('mem86.ear.off') : ezT('mem86.ear.wait')}</div> : null}"),
    'his bar says which engine hears him: his own, reaching it, or the browser\'s');
  const LANG4 = path.join(REPO, 'lang');
  const keys4 = ['mem86.ear.wait', 'mem86.ear.on', 'mem86.ear.off', 'mem86.ear.mic'];
  const miss4 = [];
  for (const f of fs.readdirSync(LANG4).filter((x) => x.endsWith('.json'))) { const d = JSON.parse(fs.readFileSync(path.join(LANG4, f), 'utf8')); for (const k of keys4) if (typeof d[k] !== 'string' || !d[k].trim()) miss4.push(f + ' ' + k); }
  for (const k of keys4) if ((src4.match(new RegExp("'" + k.replace(/\./g, '\\.') + "': '[^']+'", 'g')) || []).length !== 2) miss4.push('app.jsx ' + k);
  ok(miss4.length === 0, 'the four lines of the engine have a label in Arabic, English and every language file' + (miss4.length ? ': missing ' + miss4.slice(0, 4).join(', ') : ''));
  // engine p2.5 -- the owner, 13 October, 14:28: it holds him on an ayah until it is said right, or the word is given him
  const hd = (st, red) => Array.from(X.mem86EarHold(1, Object.assign({ cur: 6 }, st), red));
  const n16 = X.mem86EarWords(1, 6);
  ok(n16 === 3 && eqA(hd({ marks: { ok: [], bad: [1, 2, 3] } }, true), rep(n16, 'wrong')) && eqA(hd({ marks: { ok: [], bad: [1, 2, 3] } }, false), rep(n16, 'blank')),
    'the ayah the engine holds him on, left out: every word red with his switch on, a blank with it off (1:6)');
  ok(eqA(hd({ marks: { ok: [1, 3], bad: [2] } }, true), ['matched', 'wrong', 'matched']) && eqA(hd({ marks: { ok: [1, 3], bad: [2] }, from: 2, upto: 2 }, true), ['matched', 'matched', 'matched'])
    && eqA(hd({ marks: { ok: [1], bad: [2, 3] }, from: 2, upto: 2 }, false), ['matched', 'matched', 'blank']),
    '...a word it marked in its place and the words right before printed; a marked word printed again as he says it in the saying he is in');
  ok(eqA(hd({ from: 1, upto: 2 }, true), ['matched', 'matched', 'pending']) && eqA(hd({}, true), rep(n16, 'pending')) && eqA(hd({ marks: { ok: [9, 'x'], bad: [0, -1] } }, true), rep(n16, 'pending')),
    '...before any mark, filled to the last word heard, as without hold; a mark outside the ayah marks nothing');
  ok(eqA(lf({ ayah: 2, flag: [], heard: 99, give: [3] }, true), ['matched', 'matched', 'hint'].concat(rep(n22 - 3, 'matched'))) && eqA(lf({ ayah: 2, flag: [3], heard: 99, give: [3] }, true), ['matched', 'matched', 'hint'].concat(rep(n22 - 3, 'matched'))),
    'an ayah the engine passed with a word given him («كلمة») prints that word as given, never red');
  ok(src4.includes("JSON.stringify({ sura: o.sura, ayah: o.ayah, last: o.last, hold: o.hold === true })") && src4.includes('holds = st0.hold === true;')
    && src4.includes("give: (a, words) => { if (dead || ending || !holds) return false; ctl.push({ ayah: a, give: words }); pump(); return true; },")
    && src4.includes("seek: (a) => { if (dead || ending) return; epoch++; pend.length = 0; pendN = 0; ctl.push({ ayah: a }); pump(); },")
    && src4.includes("const st = await send('/v1/seek' + q, JSON.stringify(ctl.shift()));"),
    'ezEar asks the engine to hold, and gives a word only to an engine that says it holds -- through the seek door, no sixth path');
  ok(scr4.includes('const h = await ezEar.open({ sura: selectedSurah, ayah: from, last: surahCount, hold: true,')
    && scr4.includes('if (reciteEarRef.current) reciteEarRef.current.give(cur, add.map((i) => i + 1));')
    && scr4.includes("const shown = st.hold ? mem86EarHold(selectedSurah, st, prefsRef.current.wrong) : mem86EarShown(selectedSurah, st.cur, st.upto);")
    && scr4.includes("} else if (st.hold) { const shown = mem86EarHold(selectedSurah, st, prefsRef.current.wrong); setReciteStates(shown); reciteShownRef.current = shown; }"),
    'his screen opens his engine holding, tells it every word given him, and draws the ayah it holds him on from its marks -- while he recites and after a pause');
}

/* ------------------------------------------------------------------ done */
console.log('\n' + (fail ? 'FAIL' : 'PASS') + '  memorizer86-check  ' + pass + ' passed, ' + fail + ' failed  (lifted ' + LIFT.length + ' initializers from app.jsx)');
process.exit(fail ? 1 : 0);
