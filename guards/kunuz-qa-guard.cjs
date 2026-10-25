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
// The four owner decisions of the QA (KUNUZ-QA-DECISIONS-ORDER-2026-10-19):
//   Q5 Ghaws: the Nokhtha's letter is the answer's first real letter, never a mark (KUNUZ-LEVELS-POETRY-ORDER-2026-10-19, A),
//      and it hides in every question that letter cannot help (the page's nokhBlind() over the whole bank against
//      this guard's own rule, and a dive where it hides and where it hints); the Seeb is a sign, not a control, and still saves
//      once. Harb on one device: «إنهاء اللعبة» asks on the first tap and ends on the second with the standing of that moment
//   Q6 Hanna Laha as shipped in hanna-laha/: no aria string carries a question count; the disc reads available / spent
//   Q7 the no-question-number scans of kunuztest, kunuzboard and kunuznorepeat read every attribute a screen reader speaks
//   Q8 each of these fixes taken back is caught
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
  // the games' translations: per-language number patterns (they returned English to every reader), the three pearling terms
  // in their meaning (not cannonball / float / keeper), the back arrow of a left-to-right reader pointing left
  { id: 'I18N', file: 'quest-i18n.js', must: ['var LOC =', '"← Back"', '"The Hauler"', '"The Great Pearl"', '"The Homecoming"'],
    not: ['"The Cannonball"', '"The Float"', '"The Keeper"', '"→ Back"'] },
  { id: 'RESET-44', file: 'quest-ghaws.html', must: ['.seenfoot button{background:none;border:0;min-height:44px;'] },
  { id: 'RESET-44-harb', file: 'quest-harb.html', must: ['.seenfoot button{background:none;border:0;min-height:44px;'] },
  { id: 'VERDICT', file: 'quest-ghaws.html', must: ['x.className="chip"+(x===b?" on":"")', '.quick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));'] },
  { id: 'VERDICT-harb', file: 'quest-harb.html', must: ['x.className="chip"+(x===b?" on":"")', '.quick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));'] },
  { id: 'BOARD-01/02', file: 'quest-board.html', must: ['function tooSoon(e){return !!(e&&e.timeStamp)&&e.timeStamp-P.ts<SETTLE_MS}',
    'if(!G||G.cur||P.open||tooSoon(e))return;', 'if(!P.open||!P.revealed||!G||tooSoon(e))return;', 'P.revealed=true;stamp(e);paintQ();',
    'b.onclick=function(e){give(i,e)};', 'return function(e){openQ(s,e)}'] },
  { id: 'BOARD-03', file: 'quest-board.html', must: ['if(G&&!BE.over(G)&&BE.played(G)&&$("quit").dataset.arm!=="1"'] },
  { id: 'BOARD-04', file: 'quest-board.html', must: ['if(q==="rnd"&&S.cats.length<BE.MIN_CATS)$("tally").textContent=spentText()'] },
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
  // KUNUZ-QA-DECISIONS (2026-10-19): the four owner decisions of the QA
  { id: 'GHAWS-07', file: 'quest-ghaws.html', must: ['.tool.blind{display:none}', 'if(k==="nokh")t.classList.toggle("blind",nokhBlind())', 'if(k==="nokh"){if(nokhBlind())return;'] },
  { id: 'GHAWS-08', file: 'quest-ghaws.html', must: ['<div class="gear" id="seebGear">'], not: ['data-tool="seeb"'] },
  { id: 'HARB-09', file: 'quest-harb.html', must: ['<div class="wtop hidden" id="wTop"><button type="button" class="tbexit" id="endWar">إنهاء اللعبة</button></div>',
    'if($("endWar").dataset.arm!=="1"){armEnd(true);return}', 'victory(leader(),"أُنهيت اللعبة","quit")',
    // the row's height comes out of the map, never out of the question; on a short landscape screen it floats on the map corner
    '#war.solo.fight .mapbox{height:calc(max(200px,40vh) - 53px);', '#war.solo.fight .mapbox{height:calc(max(150px,30vh) - 53px);',
    '#war .wtop{position:absolute;top:0;left:0;'] },
  { id: 'HARB-09-i18n', file: 'quest-i18n.js', must: ['"End the game"', '"Sure? Tap to end"', '"The game was ended"'] },
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

// ---------- Q5-Q8: the four owner decisions of the QA (KUNUZ-QA-DECISIONS-ORDER-2026-10-19), run as they ship ----------
const stripAl = (s) => String(s).replace(/^ال/, '');
// the guard's own rule, written apart from the page (by Unicode class, the page by a list): only letters and digits count,
// never a mark, the tatweel, a direction mark, a space or a sign, and «ٱ» reads «ا». The hint is the first of them after «ال»;
// it cannot help when there is none, or when no wrong option still standing can be ruled out by it (with or without «ال»)
const bare = (s) => Array.from(String(s)).filter((c) => /[\p{L}\p{N}]/u.test(c) && c !== '\u0640').join('').replace(/\u0671/g, '\u0627');
const hintOf = (q) => stripAl(bare(q[4][q[5]])).charAt(0);
function blindByRule(q, dimmed, noOpts) {
  const h = hintOf(q);
  if (!h) return true;
  if (noOpts) return false;
  return !q[4].some((o, i) => i !== q[5] && !(dimmed && dimmed.has(i)) && bare(o).charAt(0) !== h && stripAl(bare(o)).charAt(0) !== h);
}
const BLIND_N = DATA0.qs.filter((q) => blindByRule(q)).length;
const pageErrors = (W, tag) => W.fails.concat(W.errors.map((e) => tag + ' page error: ' + String(e && e.message || e).slice(0, 80)));
function checkQ5(T) {
  const f = []; const info = {};
  // (a) Ghaws: the Nokhtha hides in a question it cannot help and works in the others; the Seeb is a sign, not a button
  {
    const src = srcOf(T['quest-ghaws.html']);
    const W = makeWorld(src, src.DATA, ['home', 'how', 'cfg', 'dive', 'end', 'board'], { reduce: true, storage: Store() });
    const C = W.ctx, $ = W.$;
    // every question of the bank, through the page's own function, against the rule above
    let pageBlind = 0, differ = 0;
    if (typeof C.nokhBlind !== 'function') f.push('GHAWS-07 the page has no nokhBlind()');
    else for (const q of C.DATA.qs) { C.S.cur = q; C.S.noOpts = false; const b = !!C.nokhBlind(); if (b) pageBlind++; if (b !== blindByRule(q)) differ++; }
    C.S.cur = null;
    // the hint itself, over the whole bank: never a mark, a space or a sign, and the very letter of the rule
    if (typeof C.nokhChar !== 'function') f.push('GHAWS-07 the page has no nokhChar()');
    else {
      let marks = 0, other = 0, ex = '';
      for (const q of C.DATA.qs) { const h = String(C.nokhChar(q)); if (h && !/^[\p{L}\p{N}]$/u.test(h) || h === '\u0640') { marks++; ex = ex || q[8] + ' ' + h; } else if (h !== hintOf(q)) { other++; ex = ex || q[8] + ' ' + h + '/' + hintOf(q); } }
      if (marks || other) f.push('GHAWS-07 the hint is a mark in ' + marks + ' answers and not the first letter in ' + other + ' (' + ex + ')');
      info.marks = marks;
    }
    // an answer with no letter at all (only marks and a sign): nothing to hint, so the Nokhtha hides
    C.S.cur = [0, 0, 1, '?', ['\u0640\u064C\u061F', 'ب', 'ت', 'ث'], 0, '', '', 'letterless']; C.S.noOpts = false;
    if (!C.nokhBlind() || !blindByRule(C.S.cur)) f.push('GHAWS-07 a letterless answer shows the Nokhtha');
    C.S.cur = null;
    if (pageBlind !== BLIND_N || differ) f.push('GHAWS-07 the page hides the Nokhtha in ' + pageBlind + ' questions, the rule in ' + BLIND_N + ' (' + differ + ' differ)');
    info.blind = pageBlind;
    W.tap(W.doc.querySelector('[data-go="cfg1"]'), 'solo'); W.tap(W.doc.querySelector('[data-q="rel"]'), 'rel');
    C.S.cap = 80; C.S.breath = 0; C.S.noOpts = false; W.tap($('goDive'), 'goDive');
    const nokh = W.doc.querySelector('.tool[data-tool="nokh"]');
    let seenBlind = 0, seenUseful = 0, hinted = 0;
    for (let g = 0; g < 80 && W.screen() === 'dive'; g++) {
      const sh = W.doc.querySelectorAll('#shells .shell').filter((e) => W.shown(e) && !e.disabled); if (!sh.length) break;
      W.tap(sh[0], 'shell'); const q = C.S.cur; if (!q) { f.push('GHAWS-07 a shell opened no question'); break; }
      const blind = blindByRule(q);
      if (!nokh || nokh.classList.contains('blind') !== blind) { f.push('GHAWS-07 nokh ' + (blind ? 'shown in a question it cannot help' : 'hidden in a question it helps') + ': ' + q[4].join(' | ')); break; }
      if (blind) { seenBlind++; const t0 = C.S.tools.nokh; if (nokh.onclick) nokh.onclick(); if (C.S.tools.nokh !== t0) f.push('GHAWS-07 a hidden Nokhtha still spends itself'); }
      else {
        seenUseful++;
        if (C.S.tools.nokh) {
          nokh.onclick(); hinted++; const w = $('why').textContent;
          if (C.S.tools.nokh || w.indexOf('«' + hintOf(q) + '»') < 0) f.push('GHAWS-07 a useful Nokhtha did not give its letter: ' + w.slice(0, 40));
        }
      }
      W.tap(W.doc.querySelectorAll('#opts button.opt').find((b) => +b.dataset.k === q[5]), 'right'); W.advance(2600);
    }
    if (!seenBlind || !seenUseful || !hinted) f.push('GHAWS-07 the dive met blind=' + seenBlind + ' useful=' + seenUseful + ' hinted=' + hinted + ' (needs each)');
    info.dive = seenBlind + '/' + seenUseful;
    // the Seeb: no button, no role, no tab stop, not one of the tools; it still saves once and shows itself spent
    const gear = $('seebGear');
    if (!gear) f.push('GHAWS-08 no #seebGear');
    else {
      if (gear.localName === 'button' || gear.getAttribute('role') || gear.hasAttribute('tabindex') || gear.classList.contains('tool') || gear.onclick)
        f.push('GHAWS-08 the Seeb is still a control: <' + gear.localName + '> role=' + gear.getAttribute('role') + ' tabindex=' + gear.getAttribute('tabindex'));
      if (W.doc.querySelector('[data-tool="seeb"]')) f.push('GHAWS-08 a [data-tool=seeb] control is back');
      const css = T['quest-ghaws.html'];
      if (/\.gear[^{]*:(hover|focus|active)/.test(css)) f.push('GHAWS-08 the Seeb has a hover/focus/pressed state');
      if (!/\.gear\{[^}]*cursor:default;/.test(css) || /\.gear\{[^}]*(border|background|min-height)/.test(css)) f.push('GHAWS-08 the Seeb looks like a button again (a pointer, a frame, a fill or a touch size)');
      // a wrong answer: the Seeb saves the diver once, and the sign shows it spent
      const W2 = makeWorld(src, src.DATA, ['home', 'cfg', 'dive', 'end'], { reduce: true, storage: Store() });
      W2.tap(W2.doc.querySelector('[data-go="cfg1"]'), 'solo'); W2.tap(W2.doc.querySelector('[data-q="rel"]'), 'rel');
      W2.ctx.S.cap = 20; W2.ctx.S.breath = 0; W2.ctx.S.noOpts = false; W2.tap(W2.$('goDive'), 'goDive');
      W2.tap(W2.doc.querySelectorAll('#shells .shell').filter((e) => W2.shown(e) && !e.disabled)[0], 'shell');
      const q2 = W2.ctx.S.cur;
      if (q2) { W2.tap(W2.doc.querySelectorAll('#opts button.opt').find((b) => +b.dataset.k !== q2[5]), 'wrong'); W2.advance(2600); }
      if (!q2 || W2.screen() !== 'dive' || W2.ctx.S.tools.seeb || !W2.$('seebGear').classList.contains('used')) f.push('GHAWS-08 the Seeb no longer saves once and shows itself spent');
      f.push(...pageErrors(W2, 'ghaws'));
    }
    f.push(...pageErrors(W, 'ghaws'));
  }
  // (b) Harb, one device: «إنهاء اللعبة» at the top, the first tap asks, the second ends with the standing of that moment
  {
    const src = srcOf(T['quest-harb.html']);
    const W = makeWorld(src, src.DATA, ['home', 'how', 'cfg', 'room', 'join', 'lobby', 'war', 'win', 'verdict'], { reduce: true, storage: Store() });
    const C = W.ctx, $ = W.$;
    W.tap(W.doc.querySelector('#home [data-go="cfg"]'), 'cfg'); W.tap(W.doc.querySelector('[data-q="rnd"]'), 'rnd'); W.tap($('startWar'), 'start');
    const b = $('endWar');
    if (W.screen() !== 'war' || !b || !W.shown(b)) f.push('HARB-09 no «إنهاء اللعبة» on the one-device war screen');
    else {
      if (b.textContent !== 'إنهاء اللعبة') f.push('HARB-09 the button says ' + b.textContent);
      W.tap(b, 'end 1');
      if (W.screen() !== 'war' || b.textContent !== 'متأكّدون؟ اضغطوا للإنهاء') f.push('HARB-09 the first tap did not ask: ' + W.screen() + ' ' + b.textContent);
      W.advance(400); if (W.shown(b)) W.tap(b, 'end 2');
      const lead = C.leader();
      if (W.screen() !== 'win' || $('winWhy').textContent !== 'أُنهيت اللعبة') f.push('HARB-09 the second tap did not end the war: ' + W.screen() + ' ' + $('winWhy').textContent);
      else {
        const top = C.G.players.map((p, k) => k).filter((k) => C.count(k) === C.count(lead) && C.banners(k) === C.banners(lead));
        const want = top.length > 1 ? 'تعادل بين ' + top.map((k) => C.G.players[k].n).join(' و') : C.G.players[lead].n;
        if ($('winName').textContent !== want) f.push('HARB-09 the result is not the standing of the moment: ' + $('winName').textContent + ' / ' + want);
      }
      if (W.screen() === 'win') { W.tap($('rematch'), 'rematch'); W.tap($('startWar'), 'start again'); }
      if (W.screen() !== 'war' || $('endWar').textContent !== 'إنهاء اللعبة' || !W.shown($('endWar'))) f.push('HARB-09 a new war does not start clean');
      // a room hides it: the room has its own way out (خروج) and the server rules its end
      if (T['quest-harb.html'].indexOf('$("war").insertBefore($("turnBar"),$("mapBox"));$("wTop").classList.add("hidden");') < 0) f.push('HARB-09 a room war no longer hides the one-device button');
    }
    f.push(...pageErrors(W, 'harb'));
  }
  return { f, info };
}
const q5 = checkQ5(TEXT);
report('Q5', 'Ghaws: the Nokhtha hides where it cannot help, the Seeb is a sign; Harb ends in two taps on one device', q5.f,
  'nokhBlind=' + q5.info.blind + '/' + DATA0.qs.length + ' hintMarks=' + q5.info.marks + ' diveBlindUseful=' + q5.info.dive);

// Q6: Hanna Laha as shipped in hanna-laha/: no aria string of its copy carries a count of the questions (only the seconds of
// the timer and a team's own option reveals), and the category disc reads available / spent
const HL_DIR = path.join(REPO, 'hanna-laha', 'assets');
const HL_ALLOWED = new Set(['time_left_aria', 'show_options_aria']);
function checkQ6(js) {
  const f = []; let n = 0;
  const re = /([A-Za-z_]*aria[A-Za-z_]*):`([^`]*)`/g; let m;
  while ((m = re.exec(js))) { n++; if (!HL_ALLOWED.has(m[1]) && /\{(n|total|count|left|share)\}|[0-9٠-٩]/.test(m[2])) f.push('HANNA-ARIA ' + m[1] + ' reads a count: ' + m[2]); }
  if (js.indexOf('cat_open_aria:`{name}، متاح`') < 0 || js.indexOf('cat_spent_aria:`{name}، مستنفد`') < 0) f.push('HANNA-ARIA the disc no longer reads available / spent');
  if (js.indexOf('باقي له {n} من {total}') > -1) f.push('HANNA-ARIA "n of total left" is back');
  if (n < 5) f.push('HANNA-ARIA only ' + n + ' aria strings found: the bundle changed shape');
  return { f, n };
}
const HL_JS = fs.readdirSync(HL_DIR).filter((x) => x.endsWith('.js')).map((x) => fs.readFileSync(path.join(HL_DIR, x), 'utf8')).join('\n');
const q6 = checkQ6(HL_JS);
report('Q6', 'Hanna Laha: a screen reader hears no question count', q6.f, 'ariaStrings=' + q6.n);

// Q7: the no-question-number scans read what a screen reader reads: the shared reader takes every such attribute (and the
// property form), and the three scans (kunuztest T10, kunuzboard B7, kunuznorepeat D) read through it
const { READABLE_ATTRS, readable } = require('./kunuz-sim/readable.cjs');
function checkQ7(G) {
  const f = [];
  for (const a of ['aria-label', 'aria-description', 'aria-valuetext', 'aria-roledescription', 'title', 'alt', 'placeholder']) {
    const el = new El('span', null); el.setAttribute(a, '١٢ سؤال');
    if (READABLE_ATTRS.indexOf(a) < 0 || readable(el, '').indexOf('١٢ سؤال') < 0) f.push('the reader skips ' + a);
  }
  const p = new El('img', null); p.title = '١٢ سؤال'; if (readable(p, '').indexOf('١٢ سؤال') < 0) f.push('the reader skips a title set as a property');
  for (const [file, line] of [['kunuz-test-guard.cjs', 'for (const s of readable(el, own)) {'], ['kunuz-board-guard.cjs', 'for (const s of readable(el, own)) {'], ['kunuz-norepeat-guard.cjs', 'const strs = readable(el, own);']]) {
    const t = G[file];
    if (t.indexOf("const { readable } = require('./kunuz-sim/readable.cjs');") < 0 || t.indexOf(line) < 0) f.push(file + ' does not scan through the shared reader');
  }
  return f;
}
const GUARDS = {}; ['kunuz-test-guard.cjs', 'kunuz-board-guard.cjs', 'kunuz-norepeat-guard.cjs'].forEach((x) => { GUARDS[x] = fs.readFileSync(path.join(__dirname, x), 'utf8'); });
report('Q7', 'the no-question-number scans read every attribute a screen reader speaks', checkQ7(GUARDS), 'scans=3');

// Q8: the four decisions bite: each fix taken back is caught
{
  const missed = []; let n = 0;
  const mutQ5 = (name, file, from, to) => {
    n++; const T = Object.assign({}, TEXT);
    if (T[file].split(from).length !== 2) { missed.push(name + ' (seam moved)'); return; }
    T[file] = T[file].replace(from, () => to);
    let r; try { r = checkQ5(T).f; } catch (e) { r = ['thrown']; }
    if (!r.length) missed.push(name);
  };
  mutQ5('the Nokhtha never hides', 'quest-ghaws.html', 'if(k==="nokh")t.classList.toggle("blind",nokhBlind())', 'if(k==="nokh")t.classList.toggle("blind",false)');
  mutQ5('the hint takes a mark again', 'quest-ghaws.html', 'function nokhChar(q){return nokhBare(q[4][q[5]])', 'function nokhChar(q){return String(q[4][q[5]])');
  mutQ5('the hint keeps the Quranic alef', 'quest-ghaws.html', '.replace(/\\u0671/g,"ا")}', '}');
  mutQ5('the options read with their marks', 'quest-ghaws.html', 'o=nokhBare(o);return i!==q[5]', 'o=String(o);return i!==q[5]');
  mutQ5('a letterless answer shows the Nokhtha', 'quest-ghaws.html', 'var h=nokhChar(q);if(!h)return true;', 'var h=nokhChar(q);');
  mutQ5('the Seeb a button again', 'quest-ghaws.html', '<div class="gear" id="seebGear">', '<div class="gear" id="seebGear" role="button" tabindex="0">');
  mutQ5('the Seeb with a pressed state', 'quest-ghaws.html', '.gear.used svg{', '.gear:active{opacity:.6}\n.gear.used svg{');
  mutQ5('the Seeb framed as a tile', 'quest-ghaws.html', '.gear{width:52px;', '.gear{width:52px;border:1px solid var(--line);');
  mutQ5('the war ends in one tap', 'quest-harb.html', 'if($("endWar").dataset.arm!=="1"){armEnd(true);return}', '');
  mutQ5('the war ended for the first player', 'quest-harb.html', 'victory(leader(),"أُنهيت اللعبة","quit")', 'victory(0,"أُنهيت اللعبة","victory")');
  mutQ5('no button on one device', 'quest-harb.html', 'drawMap();beginDeploy();$("wTop").classList.remove("hidden");', 'drawMap();beginDeploy();');
  n++; if (!checkQ6(HL_JS.replace('cat_open_aria:`{name}، متاح`', 'cat_open_aria:`{name}، باقي له {n} من {total}`')).f.length) missed.push('Hanna Laha counts again');
  n++; { const G = Object.assign({}, GUARDS); G['kunuz-norepeat-guard.cjs'] = G['kunuz-norepeat-guard.cjs'].replace('const strs = readable(el, own);', "const strs = [own, el.attrs['aria-label']];"); if (!checkQ7(G).length) missed.push('a scan back to the visible text'); }
  report('Q8', 'the four decisions bite: each fix taken back is caught', missed.map((m) => 'MUTANT SURVIVED: ' + m), 'mutants=' + n + ' missed=' + missed.length);
}

const bad = results.filter((r) => !r.ok);
console.log('SUMMARY ' + (results.length - bad.length) + '/' + results.length + ' pass' + (bad.length ? ' FAILED: ' + bad.map((r) => r.id).join(',') : ''));
process.exit(bad.length ? 1 : 0);
