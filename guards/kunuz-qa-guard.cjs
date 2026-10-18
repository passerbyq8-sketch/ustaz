// kunuz-qa-guard.cjs -- the defects of the Kunuz mobile QA (order KUNUZ-FULL-QA-ORDER-2026-10-18) stay fixed. ASCII output only.
// usage: node guards/kunuz-qa-guard.cjs
//
// Every defect the QA proved on production and fixed in the five Kunuz pages is held here, so none comes back silently:
//   Q1 the fix of each defect is in its page: fragments that must be there (the fix) and fragments that must not (the defect)
//   Q2 the double tap of the board, run as it ships (the page's script in the mini DOM of guards/kunuz-sim): a second touch
//      within the settle time of a reveal, an award or a tile does nothing, a later one acts, and a tap with no event time
//      (the simulator's) is never refused
//   Q3 the grey of every Kunuz page reads at 4.5:1 on white
//   Q4 the gate bites: every "must" fragment removed, and every "must not" fragment put back, is caught by Q1; the board's settle
//      check removed is caught by Q2
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const { VER, El, Txt, parseInto } = require('./kunuz-sim/dom.cjs');
const REPO = path.join(__dirname, '..');
const ascii = (s) => String(s).replace(/[^\x00-\x7f]/g, '?');
const read = (f) => fs.readFileSync(path.join(REPO, f), 'utf8');
const PAGES = ['quest.html', 'quest-ghaws.html', 'quest-harb.html', 'quest-test.html', 'quest-board.html', 'quest-i18n.js'];
const TEXT = {}; PAGES.forEach((f) => { TEXT[f] = read(f); });

const results = [];
function report(id, name, fails, info) {
  results.push({ id, ok: !fails.length });
  console.log((fails.length ? 'FAIL ' : 'PASS ') + id + ' ' + name + (info ? ' :: ' + ascii(info) : ''));
  fails.slice(0, 12).forEach((m) => console.log('   - ' + ascii(m)));
}

// ---------- Q1: each fix in its page ----------
// { id, file, must: [fragments of the fix], not: [fragments of the defect] }
const FIXES = [
  { id: 'HUB-ru', file: 'quest-i18n.js', must: ['Пять игр из вопросов Ezik'], not: ['Пять игры'] },
  { id: 'BOARD-01/02', file: 'quest-board.html', must: ['function tooSoon(e){return !!(e&&e.timeStamp)&&e.timeStamp-P.ts<SETTLE_MS}',
    'if(!G||G.cur||P.open||tooSoon(e))return;', 'if(!P.open||!P.revealed||!G||tooSoon(e))return;', 'P.revealed=true;stamp(e);paintQ();',
    'b.onclick=function(e){give(i,e)};', 'return function(e){openQ(s,e)}'] },
  { id: 'BOARD-03', file: 'quest-board.html', must: ['if(G&&!BE.over(G)&&BE.played(G)&&$("quit").dataset.arm!=="1"'] },
  { id: 'BOARD-04', file: 'quest-board.html', must: ['if(q==="rnd"&&S.cats.length<BE.CATS)$("tally").textContent=spentText()'] },
  { id: 'GHAWS-01', file: 'quest-ghaws.html', must: ['id!=="cfg"&&id!=="how";}', 'if(id==="how"){if(!atCfg){try{history.pushState({kz:"how"}', 'else if(k==="how"){'] },
  { id: 'GHAWS-02', file: 'quest-ghaws.html', must: ['td.textContent=v;'], not: ['body.innerHTML+="<tr><td>"+c.n'] },
  { id: 'GHAWS-03', file: 'quest-ghaws.html', must: ['margin:8px 0 4px;overflow-wrap:anywhere}', 'inp.placeholder="غوّاص "+ar(i+1);inp.maxLength=24;'] },
  { id: 'GHAWS-04', file: 'quest-ghaws.html', must: ['if(!$("dive").classList.contains("hidden")){stopB();clearT();S.lock=true;S.ending=true;deep(0)}'] },
  { id: 'GHAWS-05', file: 'quest-ghaws.html', must: ['#dive{flex-direction:row;max-width:none}'] },
  { id: 'GHAWS-06', file: 'quest-ghaws.html', must: ['.slice(0,Math.min(2,S.cur[4].length-2))'] },
  { id: 'GHAWS-09', file: 'quest-ghaws.html', must: ['.shell{flex:1 1 0;min-width:0;'] },
  { id: 'GHAWS-10', file: 'quest-ghaws.html', must: ['Array.from(p.n.trim())[0]'], not: ['p.n.trim().charAt(0)'] },
  { id: 'GHAWS-11', file: 'quest-ghaws.html', must: ['cursor:pointer;min-width:44px;min-height:44px}', '#verdict .chip{min-width:44px}'] },
  { id: 'GHAWS-14', file: 'quest-ghaws.html', must: ['inset-inline-start:14px', 'id="qtext" dir="auto"'], not: ['text-align:right', 'text-align:left'] },
  { id: 'GHAWS-15', file: 'quest-ghaws.html', must: ['textContent=seenLeft(null)<1?spentText().join(" — "):'] },
  { id: 'GHAWS-16', file: 'quest-ghaws.html', not: ['>الرئيسة<'] },
  { id: 'TEST-01', file: 'quest-test.html', must: ['SETTLE_MS', 'function tooSoon(e)'] },
  { id: 'TEST-02', file: 'quest-test.html', must: ['overflow-wrap:anywhere'] },
  { id: 'TEST-03', file: 'quest-test.html', must: ['if(history.state&&history.state.kz==="play")history.back()'] },
  { id: 'TEST-04', file: 'quest-test.html', must: ['"bdi"'] },
  { id: 'TEST-05', file: 'quest-test.html', must: ['spentText().join(" — ")'] },
  { id: 'HARB-01', file: 'quest-harb.html', must: ['ws.send("ping")', 'kaStop();ka=setInterval('] },
  { id: 'HARB-02', file: 'quest-harb.html', must: ['){quitFight();stopFx();stop()}', '  quitFight();stopFx();stop();T.lock=false;'] },
  { id: 'HARB-03', file: 'quest-harb.html', must: ['if(G.busy||tooSoon(e))return;', 'function tooSoon(e){return !!(e&&e.timeStamp)&&e.timeStamp-TURN_TS<SETTLE_MS}'] },
  { id: 'HARB-04', file: 'quest-harb.html', must: ['.winmap{overflow:hidden}', '.winmap .mapbox{height:100%}'] },
  { id: 'HARB-05', file: 'quest-harb.html', must: ['id!=="how"&&!isL1(id);}', 'window.kzHowBack=function(){'] },
  { id: 'HARB-06', file: 'quest-harb.html', must: ['$("winName").textContent="تعادل بين "+tn.join(" و");'] },
  { id: 'HARB-07', file: 'quest-harb.html', must: ['if(G.cats.length<3)preset("mix");'], not: ['if(G.cats.length!==12)preset("mix")'] },
  { id: 'HARB-08', file: 'quest-harb.html', must: ['<b>\'+esc(who.n)+"</b>'], not: ['<b>\'+who.n+"</b>'] },
  { id: 'HARB-11', file: 'quest-harb.html', must: ['#war.fight .mapbox{height:max(64px,20vh);'] },
  { id: 'HARB-12', file: 'quest-harb.html', must: ['.sw{height:44px;min-width:44px;', '#verdict .chip{min-width:44px}'] },
  { id: 'HARB-14', file: 'quest-harb.html', must: ['function mt(ms){return RMQ&&RMQ.matches?0:ms}'] },
  { id: 'HARB-15', file: 'quest-harb.html', must: ['$("catTally").textContent=spentText().join(". ")'] },
  { id: 'HARB-16', file: 'quest-harb.html', must: ['" فاز بـ"+cntI(count(i))'], not: ['>الرئيسة<'] },
];
function checkQ1(T) {
  const f = [];
  for (const x of FIXES) {
    const t = T[x.file];
    (x.must || []).forEach((m) => { if (t.indexOf(m) < 0) f.push(x.id + ' fix missing: ' + m.slice(0, 70)); });
    (x.not || []).forEach((m) => { if (t.indexOf(m) > -1) f.push(x.id + ' defect back: ' + m.slice(0, 70)); });
  }
  return f;
}
const q1 = checkQ1(TEXT);
report('Q1', 'every QA fix is in its page and no fixed defect is back', q1, 'defects=' + FIXES.length + ' fragments=' + FIXES.reduce((n, x) => n + (x.must || []).length + (x.not || []).length, 0));

// ---------- Q2: the board's double tap, run as it ships ----------
const G_SRC = fs.readFileSync(path.join(__dirname, 'kunuz-sim', 'world.cjs'), 'utf8');
const wa = G_SRC.indexOf('// ---------- world ----------'), wb = G_SRC.indexOf('// ---------- synthetic bank');
let WORLD = G_SRC.slice(wa, wb);
if (wa < 0 || wb < 0 || WORLD.split('DATA, Math: M,').length !== 2) throw new Error('kunuz-sim world section not as expected');
WORLD = WORLD.replace('DATA, Math: M,', 'DATA, localStorage: o.storage, Math: M,').replace(/\bM\.random = R\b/, 'M.random = getR()');
// a fixed seed, as the other kunuz guards use: the run is the same every time
function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const RND = prng(7);
const makeWorld = new Function('fs', 'vm', 'VER', 'El', 'Txt', 'parseInto', 'getR', WORLD + '\nreturn makeWorld;')(fs, vm, VER, El, Txt, parseInto, () => RND);
const DATA0 = new Function(read('quest-data/kunuz-bank-3147.js') + ';return DATA;')();
function Store() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; }
function srcOf(t) {
  const sa = t.lastIndexOf('<script>'), sb = t.indexOf('</script>', sa), bs = t.indexOf('<body>') + 6, be = t.indexOf('<script', bs);
  return { DATA: JSON.parse(JSON.stringify(DATA0)), ENGINE: t.slice(sa + 8, sb), BODY: t.slice(bs, be) };
}
function checkQ2(pageText) {
  const f = [];
  const src = srcOf(pageText); const W = makeWorld(src, src.DATA, ['cfg', 'play', 'end'], { reduce: true, storage: Store() });
  const C = W.ctx, $ = W.$;
  W.tap(W.doc.querySelector('[data-q="rnd"]'), 'rnd'); W.tap($('startBtn'), 'start');
  const free = () => W.doc.querySelectorAll('#board .pt').filter((b) => W.shown(b) && !b.disabled);
  const ev = (ts) => ({ timeStamp: ts, type: 'click' });
  const score = () => C.G.teams.map((t) => t.score).join(',');
  free()[0].onclick(ev(1000));
  if (!C.P.open) f.push('a tile tap did not open its question');
  $('revealBtn').onclick(ev(2000));
  if (!C.P.revealed) f.push('reveal did not reveal');
  const s0 = score(); const award = () => W.doc.querySelector('#award button[data-t="0"]');
  award().onclick(ev(2090));
  if (!C.P.open || score() !== s0) f.push('the second touch of a double tap on reveal gave points (BOARD-02)');
  award().onclick(ev(2600));
  if (C.P.open || score() === s0) f.push('an award 600 ms after the reveal was refused');
  free()[0].onclick(ev(2690));
  if (C.P.open || (C.G && C.G.cur)) f.push('the second touch of a double tap on an award opened the next tile (BOARD-01)');
  free()[0].onclick(ev(3200));
  if (!C.P.open) f.push('a tile 600 ms after the award was refused');
  // the simulator's taps carry no event time: never refused
  W.tap($('backBtn'), 'back'); W.tap(free()[0], 'tile'); W.tap($('revealBtn'), 'reveal'); W.tap(W.doc.querySelector('#nobody'), 'nobody');
  if (C.P.open) f.push('a tap with no event time was refused');
  f.push(...W.fails, ...W.errors.map((e) => 'page error: ' + String(e && e.message || e).slice(0, 80)));
  return f;
}
const q2 = checkQ2(TEXT['quest-board.html']);
report('Q2', 'board: a double tap acts once, a later tap acts, a timeless tap is never refused', q2, 'settle=350ms');

// ---------- Q3: the grey reads ----------
function lum(h) { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function checkQ3(T) {
  const f = [];
  for (const p of PAGES.filter((x) => x.endsWith('.html'))) {
    const m = T[p].match(/--muted:(#[0-9A-Fa-f]{6})/);
    if (!m) { f.push(p + ' has no --muted'); continue; }
    const r = 1.05 / (lum(m[1]) + 0.05);
    if (r < 4.5) f.push(p + ' --muted ' + m[1] + ' is ' + r.toFixed(2) + ':1 on white');
  }
  return f;
}
report('Q3', 'the grey of every Kunuz page reads at 4.5:1 on white', checkQ3(TEXT), 'pages=5');

// ---------- Q4: the gate bites ----------
{
  const missed = []; let n = 0;
  for (const x of FIXES) {
    for (const m of x.must || []) {
      n++; const T = Object.assign({}, TEXT); T[x.file] = T[x.file].split(m).join('');
      if (!checkQ1(T).length) missed.push(x.id + ' must ' + m.slice(0, 40));
    }
    for (const m of x.not || []) {
      n++; const T = Object.assign({}, TEXT); T[x.file] = T[x.file] + '\n' + m;
      if (!checkQ1(T).length) missed.push(x.id + ' not ' + m.slice(0, 40));
    }
  }
  n++; const nb = TEXT['quest-board.html'].replace('function tooSoon(e){return !!(e&&e.timeStamp)&&e.timeStamp-P.ts<SETTLE_MS}', 'function tooSoon(e){return false}');
  if (nb === TEXT['quest-board.html'] || !checkQ2(nb).length) missed.push('Q2 settle removed');
  n++; const T3 = Object.assign({}, TEXT); T3['quest.html'] = T3['quest.html'].replace(/--muted:#[0-9A-Fa-f]{6}/, '--muted:#5D8398');
  if (!checkQ3(T3).length) missed.push('Q3 old grey');
  report('Q4', 'the gate bites: each fix removed and each defect put back is caught', missed.map((m) => 'MUTANT SURVIVED: ' + m), 'mutants=' + n + ' missed=' + missed.length);
}

const bad = results.filter((r) => !r.ok);
console.log('SUMMARY ' + (results.length - bad.length) + '/' + results.length + ' pass' + (bad.length ? ' FAILED: ' + bad.map((r) => r.id).join(',') : ''));
process.exit(bad.length ? 1 : 0);
