// kunuz-test-guard.cjs -- the fourth Kunuz game, «اختبر معلوماتك» (quest-test.html, 2026-10-16). ASCII output only.
// usage: node guards/kunuz-test-guard.cjs [--page file] [--seed 7]
//
// The page is run as it ships: its body in the mini DOM of guards/kunuz-sim, its script in a vm, the shared bank as DATA,
// a fake localStorage shared between "page opens" (the same account), exactly as kunuznorepeat runs the dive and the war.
//   T1 the two copied blocks stay copies: the no-repeat record (var SEEN_KEY= .. SEEN.stamp=) is byte-identical in
//      quest-ghaws.html, quest-harb.html and quest-test.html, and so is KZC_GROUPS (the eight groups)
//   T2 the engine alone (TE): three teams, the turn goes round, random draws only from the chosen categories, no repeat,
//      the show-options credit belongs to one team, free credit, ranking and the tie
//   T3 the setup: one category at least and no ceiling (all 53), two to four teams with distinct colours, the show-options
//      question only in hidden mode and worded for one player or for teams
//   T4 shown options: a tap marks a choice and puts «تأكيد» beside it, a second tap moves it, nothing is scored before
//      the confirm; the confirm locks, paints right and wrong and enables «التالي»
//   T5 hidden options: question alone, «أظهر الجواب» then «جاوبنا صح»/«غلط»; «أظهر الخيارات (باقي لكم N)» spends the
//      credit of the team whose turn it is and of no other, and turns the question into one with options
//   T6 the dropdown: «عشوائي» first, then the chosen categories; a switch before the confirm replaces the question from the
//      new category with no penalty, and the left question stays seen (owner order 2-7)
//   T7 the timer: running out counts the question wrong, shows the right answer and enables «التالي»
//   T8 the end: one player's score of the played total; teams ranked, the winner, the tie; «لعبة جديدة» returns to the
//      setup with the same choices
//   T9 no repeat: 200 games over random categories, then games and Ghaws dives on one record until three categories drain --
//      no question twice, every shown question is marked, nothing after exhaustion
//   T10 no number about the questions on any screen (the bank size, a category size, what is left); the owner's own
//      settings, the score and the game's progress are allowed
//   T11 nothing leaves the device: no fetch, no XMLHttpRequest, no beacon, no socket, no /api/ path, one script file (the bank);
//      the page names no Israeli entity; quest.html carries the card, without a digit in its text
//   T12 the gate bites: mutants of the page (turn that does not move, credit taken from every team, a seen record one byte
//      off, a switch that does not mark the left question, a timer that scores right, a question count that only a screen
//      reader would hear) are each caught
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const { VER, El, Txt, parseInto } = require('./kunuz-sim/dom.cjs');
const { readable } = require('./kunuz-sim/readable.cjs');   // text and every attribute a screen reader speaks (KUNUZ-QA-DECISIONS, 2026-10-19)
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i > -1 ? argv[i + 1] : d; };
const REPO = path.join(__dirname, '..');
const PAGE = arg('page', path.join(REPO, 'quest-test.html'));
const SEED = +arg('seed', 7);
const ascii = (s) => String(s).replace(/[^\x00-\x7f]/g, '?');
function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let R = prng(SEED);
const ri = (n) => Math.floor(R() * n);

// ---------- the world of kunuz-sim, with localStorage handed to the page (as kunuznorepeat does) ----------
const G_SRC = fs.readFileSync(path.join(__dirname, 'kunuz-sim', 'world.cjs'), 'utf8');
const wa = G_SRC.indexOf('// ---------- world ----------'), wb = G_SRC.indexOf('// ---------- synthetic bank');
let WORLD = G_SRC.slice(wa, wb);
const A1 = 'DATA, Math: M,';
if (wa < 0 || wb < 0 || WORLD.split(A1).length !== 2) throw new Error('kunuz-sim world section not as expected');
WORLD = WORLD.replace(A1, 'DATA, localStorage: o.storage, Math: M,').replace(/\bM\.random = R\b/, 'M.random = getR()');
const makeWorld = new Function('fs', 'vm', 'VER', 'El', 'Txt', 'parseInto', 'getR', WORLD + '\nreturn makeWorld;')(fs, vm, VER, El, Txt, parseInto, () => R);

const BANK_FILE = path.join(REPO, 'quest-data', 'kunuz-bank-3147.js');
const BANK_SCRIPT_RE = /<script\b[^>]*\bsrc=["'][^"']*kunuz-bank-3147\.js(?:\?[^"']*)?["'][^>]*>/i;
const BANK_TEXT = fs.readFileSync(BANK_FILE, 'utf8');
const DATA0 = new Function(BANK_TEXT + ';return DATA;')();
const N = DATA0.qs.length;
function srcOf(pageText) {
  if (BANK_SCRIPT_RE.test(pageText)) throw new Error('page has a parser-blocking shared bank tag');
  if (pageText.indexOf('var DATA=') > -1) throw new Error('page embeds a bank of its own');
  const sa = pageText.lastIndexOf('<script>'), sb = pageText.indexOf('</script>', sa);
  const bs = pageText.indexOf('<body>') + 6, be = pageText.indexOf('<script', bs);
  return { DATA: JSON.parse(JSON.stringify(DATA0)), ENGINE: pageText.slice(sa + 8, sb), BODY: pageText.slice(bs, be) };
}
function Store() { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; }
const SCREENS = ['cfg', 'play', 'end'];
const open = (src, store) => makeWorld(src, src.DATA, SCREENS, { reduce: true, storage: store || Store() });
const errsOf = (W) => W.errors.map((e) => String(e && e.stack || e).split('\n').slice(0, 2).join(' | '));

// ---------- drivers ----------
const shown = (W, sel) => W.doc.querySelectorAll(sel).filter((e) => W.shown(e));
const opts = (W) => shown(W, '#opts button.opt');
const chip = (W, host, text) => shown(W, '#' + host + ' .chip').find((b) => b.textContent === text);
function setup(W, o) {
  // o: {teams:[names] | null, cats:[idx] | 'all', total, timer, opts:'shown'|'hidden', shows:label}
  W.tap(chip(W, 'modeChips', o.teams ? 'مجموعات' : 'فردي'), 'mode');
  if (o.teams) {
    while (W.ctx.S.teams.length < o.teams.length) W.tap(W.$('addTeam'), 'addTeam');
    shown(W, '#teamList input').forEach((inp, i) => { inp.value = o.teams[i]; inp.oninput(); });
  }
  W.tap(W.doc.querySelector('[data-q="none"]'), 'none');
  if (o.cats === 'all') W.tap(W.doc.querySelector('[data-q="all"]'), 'all');
  else o.cats.forEach((c) => tapCat(W, c));
  W.ctx.S.total = o.total || 10; W.ctx.S.timer = o.timer || 0; W.ctx.S.opts = o.opts || 'shown'; W.ctx.S.shows = o.shows === undefined ? 0 : o.shows;
  W.ctx.drawOpts(); W.ctx.drawTotals(); W.ctx.drawTimes();
}
const chips = (W) => { const a = []; W.$('cats').querySelectorAll('[data-cat]').forEach((b) => { a[+b.dataset.cat] = b; }); return a; };
const tapCat = (W, c) => { let b = chips(W)[c]; if (b && !W.shown(b)) { W.tap(b.parentNode.parentNode.querySelector('.kzc-gh'), 'group of ' + c); b = chips(W)[c]; } return W.tap(b, 'chip ' + c); };
const start = (W) => W.tap(W.$('startBtn'), 'start');
const cur = (W) => W.ctx.G && W.ctx.G.cur;
function askNow(W) { const b = W.$('askBtn'); return W.tap(b, 'askBtn'); }
function choose(W, catIdx) { const s = W.$('catSel'); s.value = String(catIdx); s.onchange(); }
// answer the question on screen; right=true answers correctly. Works in both option modes.
function answer(W, right) {
  const q = W.ctx.DATA.qs[cur(W)];
  if (W.ctx.P.revealed) {
    const want = right ? q[5] : (q[5] + 1) % q[4].length;
    W.tap(opts(W).find((b) => +b.dataset.k === want), 'opt'); W.tap(W.$('confBtn'), 'confirm');
  } else { W.tap(W.$('revealBtn'), 'reveal'); W.tap(W.$(right ? 'judgeYes' : 'judgeNo'), 'judge'); }
}
function playOut(W, L, tag, rightP) {
  let n = 0;
  for (let g = 0; g < 1000 && W.screen() === 'play'; g++) {
    if (W.ctx.P.phase === 'pick') {
      const sel = shown(W, '#catSel option'); if (ri(3) === 0 && sel.length > 1) choose(W, +sel[1 + ri(sel.length - 1)].value); else askNow(W);
      if (W.screen() !== 'play') break;
      const k = cur(W); if (k === undefined || k < 0) { W.fail(tag + ' no question after the pick'); break; }
      if (L) { if (L.has(k)) L.rep++; L.add(k); L.shown++; if (W.$('qtext').textContent !== W.ctx.DATA.qs[k][3]) L.text++; }
      n++;
      answer(W, R() < (rightP === undefined ? 0.5 : rightP));
      W.tap(W.$('nextBtn'), 'next');
    } else W.advance(300);
  }
  return n;
}
function Ledger() { const s = new Set(); s.rep = 0; s.shown = 0; s.text = 0; return s; }

// ---------- results ----------
const results = [];
function report(id, name, fails, info) {
  results.push({ id, ok: !fails.length });
  console.log((fails.length ? 'FAIL ' : 'PASS ') + id + ' ' + name + (info ? ' :: ' + ascii(info) : ''));
  fails.slice(0, 8).forEach((m) => console.log('   - ' + ascii(m)));
}

// ======================================================================
// Every check is a function of the page text, so T12 can run the same checks on mutants.
function sliceSeen(t) { const a = t.indexOf('var SEEN_KEY='), b = t.indexOf('SEEN.stamp=seenStamp();', a); return a < 0 || b < 0 ? null : t.slice(a, b); }
function sliceGroups(t) { const a = t.indexOf('var KZC_GROUPS=['), b = t.indexOf('\n];', a); return a < 0 || b < 0 ? null : t.slice(a, b + 3); }
function checkT1(pageText) {
  const f = [];
  const g = fs.readFileSync(path.join(REPO, 'quest-ghaws.html'), 'utf8'), h = fs.readFileSync(path.join(REPO, 'quest-harb.html'), 'utf8');
  const sg = sliceSeen(g), sh = sliceSeen(h), st = sliceSeen(pageText);
  if (!sg || !sh || !st) f.push('a seen block is missing');
  else { if (sg !== sh) f.push('ghaws and harb seen blocks differ'); if (st !== sg) f.push('quest-test seen block differs from ghaws'); }
  const gg = sliceGroups(g), gt = sliceGroups(pageText);
  if (!gg || !gt || gg !== gt) f.push('KZC_GROUPS of quest-test differs from ghaws');
  if (pageText.indexOf('var SEEN_KEY="kunuz_seen_v1";') < 0) f.push('the record key is not kunuz_seen_v1');
  return { f, info: 'seenBytes=' + (st ? st.length : 0) + ' groupsBytes=' + (gt ? gt.length : 0) };
}
function checkT2(src) {
  const f = [];
  const W = open(src); const TE = W.ctx.TE;
  if (!TE) return { f: ['TE engine not defined'].concat(errsOf(W)), info: '' };
  const none = () => false;
  const teams = [{ n: 'a', c: '#1' }, { n: 'b', c: '#2' }, { n: 'c', c: '#3' }];
  const g = TE.newGame({ teams, cats: [0, 5, 9], total: 9, timer: 0, opts: 'hidden', shows: 2 });
  const turns = [];
  for (let i = 0; i < 9; i++) { turns.push(g.turn); const k = TE.pick(g, -1, none, R); if (k < 0) f.push('pick failed'); else if ([0, 5, 9].indexOf(DATA0.qs[k][0]) < 0) f.push('random drew an unchosen category'); TE.settle(g, i % 3 === 0); TE.next(g); }
  if (turns.join('') !== '012012012') f.push('turn order ' + turns.join(''));
  if (!TE.over(g)) f.push('over() false after the total');
  if (g.teams.map((t) => t.score).join(',') !== '3,0,0') f.push('scores ' + g.teams.map((t) => t.score).join(','));
  // a chosen category draws only from itself, an unchosen one draws nothing
  const g2 = TE.newGame({ teams, cats: [3], total: 5, opts: 'shown', shows: 0 });
  const k3 = TE.pick(g2, 3, none, R); if (k3 < 0 || DATA0.qs[k3][0] !== 3) f.push('category pick drew from another category');
  if (TE.pick(g2, 4, none, R) !== -1) f.push('an unchosen category was drawn from');
  // no repeat inside a game: drain one category fully
  const size = DATA0.qs.filter((q) => q[0] === 3 && q[2] !== 0).length, seen = new Set([k3]);
  for (let i = 1; i < size; i++) { const k = TE.pick(g2, 3, none, R); if (k < 0) { f.push('drained early at ' + i); break; } if (seen.has(k)) f.push('repeat inside a game'); seen.add(k); }
  if (TE.pick(g2, 3, none, R) !== -1 || TE.pick(g2, -1, none, R) !== -1) f.push('a drawn-out category still draws');
  if (TE.catsLeft(g2, none).length) f.push('catsLeft not empty after draining');
  // the record is honoured
  const g3 = TE.newGame({ teams, cats: [3], total: 5, opts: 'shown', shows: 0 });
  const half = new Set(DATA0.qs.map((q, i) => i).filter((i) => DATA0.qs[i][0] === 3).slice(0, Math.floor(size / 2)));
  for (let i = 0; i < 40; i++) { const k = TE.pick(g3, -1, (x) => half.has(x), R); if (half.has(k)) f.push('a seen question was drawn'); }
  // the show credit is per team
  const g4 = TE.newGame({ teams, cats: [0], total: 9, opts: 'hidden', shows: 2 });
  TE.useShow(g4); TE.useShow(g4); const third = TE.useShow(g4);
  if (third || g4.teams[0].shows !== 0 || g4.teams[1].shows !== 2 || g4.teams[2].shows !== 2) f.push('credit not per team: ' + g4.teams.map((t) => t.shows).join(','));
  TE.next(g4); if (!TE.canShow(g4)) f.push('the next team lost its credit');
  const g5 = TE.newGame({ teams, cats: [0], total: 9, opts: 'hidden', shows: -1 });
  for (let i = 0; i < 20; i++) if (!TE.useShow(g5)) f.push('free credit ran out');
  const g6 = TE.newGame({ teams, cats: [0], total: 9, opts: 'hidden', shows: 0 });
  if (TE.canShow(g6)) f.push('no-credit game offers the options');
  const g7 = TE.newGame({ teams, cats: [0], total: 9, opts: 'shown', shows: 3 });
  if (TE.canShow(g7)) f.push('shown-options game offers a show');
  // ranking and the tie
  const rk = TE.newGame({ teams, cats: [0], total: 9, opts: 'shown', shows: 0 });
  rk.teams[0].score = 2; rk.teams[1].score = 5; rk.teams[2].score = 5;
  const r = TE.rank(rk);
  if (r.order.join('') !== '120' || !r.tie || r.winners.join('') !== '12') f.push('rank ' + JSON.stringify(r));
  rk.teams[2].score = 4; const r2 = TE.rank(rk);
  if (r2.tie || r2.winners.join('') !== '1') f.push('rank without tie ' + JSON.stringify(r2));
  return { f: f.concat(errsOf(W)), info: 'turns=' + turns.join('') + ' drained=' + size + ' rank=' + r.order.join('') + ' tie=' + r.tie };
}
function checkT3(src) {
  const f = [];
  const W = open(src);
  if (W.screen() !== 'cfg') f.push('the page does not open on the setup');
  W.tap(W.doc.querySelector('[data-q="none"]'), 'none');
  if (!W.$('startBtn').disabled) f.push('start enabled with no category');
  tapCat(W, 7); if (W.$('startBtn').disabled) f.push('start disabled with one category');
  W.tap(W.doc.querySelector('[data-q="all"]'), 'all');
  if (W.ctx.S.cats.length !== DATA0.cats.length) f.push('all categories gave ' + W.ctx.S.cats.length);
  if (shown(W, '#cats .kzc-c').some((b) => b.disabled) || W.doc.querySelectorAll('#cats .kzc-c').some((b) => b.disabled)) f.push('a category chip is disabled with all chosen (there is no ceiling)');
  W.tap(W.doc.querySelector('[data-q="rel"]'), 'rel');
  if (!W.ctx.S.cats.length || W.ctx.S.cats.some((i) => DATA0.cats[i][2] !== 'religious')) f.push('religious quick pick');
  if (!W.shown(W.$('teamsBox')) === false) f.push('teams box shown in solo');
  W.tap(chip(W, 'modeChips', 'مجموعات'), 'teams');
  if (!W.shown(W.$('teamsBox'))) f.push('teams box hidden in teams mode');
  if (shown(W, '#teamList .team').length !== 2) f.push('teams mode does not start with two teams');
  W.tap(W.$('addTeam'), 'add'); W.tap(W.$('addTeam'), 'add');
  if (shown(W, '#teamList .team').length !== 4 || !W.$('addTeam').disabled) f.push('four teams is the ceiling');
  const cols = W.ctx.S.teams.map((t) => t.c); if (new Set(cols).size !== 4) f.push('team colours repeat: ' + cols.join(','));
  for (let i = 0; i < 8; i++) W.tap(shown(W, '#teamList .swatch')[0], 'swatch');
  const cols2 = W.ctx.S.teams.map((t) => t.c); if (new Set(cols2).size !== 4) f.push('cycling a colour made two teams alike');
  for (let i = 0; i < 2; i++) W.tap(shown(W, '#teamList .mini')[0], 'remove');
  if (W.ctx.S.teams.length !== 2 || shown(W, '#teamList .mini').length) f.push('removing stops at two teams');
  if (W.shown(W.$('showsBox'))) f.push('show-options question shown in shown mode');
  W.tap(chip(W, 'optChips', 'مخفية'), 'hidden');
  if (!W.shown(W.$('showsBox'))) f.push('show-options question missing in hidden mode');
  if (W.$('showsLbl').textContent !== 'كم مرة يحق لكل فريق إظهار الخيارات؟') f.push('teams wording of the credit question');
  const labels = shown(W, '#showChips .chip').map((b) => b.textContent);
  if (labels.join('|') !== 'بدون|مرة|مرتين|٣ مرات|حر') f.push('credit chips ' + labels.join('|'));
  W.tap(chip(W, 'modeChips', 'فردي'), 'solo');
  if (W.$('showsLbl').textContent !== 'كم مرة يحق لك إظهار الخيارات؟') f.push('solo wording of the credit question');
  const tq = shown(W, '#totals .chip').length, tt = shown(W, '#times .chip').map((b) => b.textContent);
  if (tq < 3 || !W.$('totalsFree').querySelector('input')) f.push('question count needs quick chips and a free number');
  if (tt[0] !== 'بلا وقت' || W.ctx.S.timer !== 0 || !W.$('timesFree').querySelector('input')) f.push('the timer must default to none and take a free number');
  return { f: f.concat(errsOf(W), W.fails), info: 'teamsMax=4 colours=' + new Set(cols).size + ' creditChips=' + labels.length };
}
function checkT4(src) {
  const f = [];
  const W = open(src);
  setup(W, { teams: null, cats: [2, 11], total: 3, opts: 'shown' });
  start(W);
  if (W.screen() !== 'play') return { f: ['play not shown'].concat(errsOf(W), W.fails), info: '' };
  if (W.ctx.P.phase !== 'pick' || !W.$('askBtn')) f.push('a turn does not open on the category pick');
  askNow(W);
  const q = W.ctx.DATA.qs[cur(W)];
  if (opts(W).length !== q[4].length) f.push('options not shown with the question');
  if (W.$('confBtn')) f.push('confirm shown before a choice');
  const wrong = (q[5] + 1) % q[4].length;
  W.tap(opts(W).find((b) => +b.dataset.k === wrong), 'wrong pick');
  const c1 = W.$('confBtn');
  if (!c1 || c1.parentNode.querySelector('.opt').dataset.k !== String(wrong)) f.push('confirm not beside the tapped choice');
  if (W.ctx.G.asked !== 0 || W.ctx.P.locked) f.push('a tap scored before the confirm');
  if (!W.$('nextBtn').disabled) f.push('next enabled before the confirm');
  W.tap(opts(W).find((b) => +b.dataset.k === q[5]), 'change pick');
  const c2 = W.$('confBtn');
  if (!c2 || c2.parentNode.querySelector('.opt').dataset.k !== String(q[5])) f.push('changing the choice did not move the confirm');
  if (W.doc.querySelectorAll('#confBtn').length !== 1) f.push('more than one confirm');
  W.tap(c2, 'confirm');
  if (!W.ctx.P.locked || W.ctx.G.asked !== 1 || W.ctx.G.teams[0].score !== 1) f.push('confirm did not score the right answer');
  if (!opts(W).every((b) => b.disabled)) f.push('options still open after the confirm');
  if (!opts(W).find((b) => +b.dataset.k === q[5]).classList.contains('right')) f.push('right answer not painted');
  if (W.$('nextBtn').disabled) f.push('next disabled after the confirm');
  W.tap(W.$('nextBtn'), 'next'); askNow(W);
  const q2 = W.ctx.DATA.qs[cur(W)], w2 = (q2[5] + 1) % q2[4].length;
  W.tap(opts(W).find((b) => +b.dataset.k === w2), 'w'); W.tap(W.$('confBtn'), 'confirm');
  const ow = opts(W);
  if (!ow.find((b) => +b.dataset.k === w2).classList.contains('wrong') || !ow.find((b) => +b.dataset.k === q2[5]).classList.contains('right')) f.push('wrong answer: red on the choice, green on the right one');
  if (W.ctx.G.teams[0].score !== 1) f.push('a wrong answer scored');
  return { f: f.concat(errsOf(W), W.fails), info: 'asked=' + W.ctx.G.asked + ' score=' + W.ctx.G.teams[0].score };
}
function checkT5(src) {
  const f = [];
  const W = open(src);
  setup(W, { teams: ['A', 'B', 'C'], cats: [2, 11, 20], total: 6, opts: 'hidden', shows: 1 });
  start(W);
  const G = () => W.ctx.G;
  if (W.$('turnBar').textContent !== 'دور A') f.push('turn bar: ' + W.$('turnBar').textContent);
  askNow(W);
  if (opts(W).length) f.push('hidden mode shows options');
  if (!W.$('revealBtn')) f.push('no reveal button');
  const sb = W.$('showOptsBtn');
  if (!sb || sb.textContent !== 'أظهر الخيارات (باقي لكم ١)') f.push('show button label: ' + (sb ? sb.textContent : 'none'));
  W.tap(sb, 'show');
  if (G().teams.map((t) => t.shows).join(',') !== '0,1,1') f.push('credit after show: ' + G().teams.map((t) => t.shows).join(','));
  const q = W.ctx.DATA.qs[cur(W)];
  if (opts(W).length !== q[4].length || W.$('revealBtn')) f.push('show did not turn the question into one with options');
  W.tap(opts(W).find((b) => +b.dataset.k === q[5]), 'pick'); W.tap(W.$('confBtn'), 'confirm');
  if (G().teams[0].score !== 1) f.push('confirmed right answer after show did not score');
  W.tap(W.$('nextBtn'), 'next');
  if (G().turn !== 1 || W.$('turnBar').textContent !== 'دور B') f.push('turn did not move to B');
  askNow(W);
  if (!W.$('showOptsBtn')) f.push('team B has no show button of its own');
  W.tap(W.$('revealBtn'), 'reveal');
  if (W.$('showOptsBtn')) f.push('show still offered after the answer is revealed');
  if (!shown(W, '#opts .ans').length || shown(W, '#opts .ans')[0].textContent !== W.ctx.DATA.qs[cur(W)][4][W.ctx.DATA.qs[cur(W)][5]]) f.push('revealed answer is not the right option');
  if (W.$('judgeYes').textContent !== 'جاوبنا صح' || W.$('judgeNo').textContent !== 'غلط') f.push('judge buttons wording');
  W.tap(W.$('judgeNo'), 'judgeNo');
  if (G().teams[1].score !== 0 || G().asked !== 2) f.push('wrong judgement scored');
  W.tap(W.$('nextBtn'), 'next'); askNow(W);
  W.tap(W.$('revealBtn'), 'reveal'); W.tap(W.$('judgeYes'), 'yes');
  if (G().teams[2].score !== 1) f.push('right judgement for C did not score');
  W.tap(W.$('nextBtn'), 'next'); askNow(W);
  if (G().turn !== 0 || W.$('showOptsBtn')) f.push('team A, credit spent, is offered a show again');
  // solo wording and free credit
  const V = open(src);
  setup(V, { teams: null, cats: [2], total: 3, opts: 'hidden', shows: -1 });
  start(V); askNow(V);
  if (!V.$('showOptsBtn') || V.$('showOptsBtn').textContent !== 'أظهر الخيارات') f.push('free credit label');
  const U = open(src);
  setup(U, { teams: null, cats: [2], total: 3, opts: 'hidden', shows: 2 });
  start(U); askNow(U);
  if (!U.$('showOptsBtn') || U.$('showOptsBtn').textContent !== 'أظهر الخيارات (باقي لك ٢)') f.push('solo credit label: ' + (U.$('showOptsBtn') || {}).textContent);
  return { f: f.concat(errsOf(W), W.fails, errsOf(V), V.fails, errsOf(U), U.fails), info: 'credits=' + G().teams.map((t) => t.shows).join(',') + ' scores=' + G().teams.map((t) => t.score).join(',') };
}
function checkT6(src) {
  const f = [];
  const store = Store(); const W = open(src, store);
  setup(W, { teams: ['A', 'B'], cats: [2, 11, 20], total: 4, opts: 'shown' });
  start(W);
  const o = shown(W, '#catSel option').map((x) => x.textContent);
  if (o[0] !== 'عشوائي' || o.length !== 4 || o.slice(1).join('|') !== [2, 11, 20].map((c) => DATA0.cats[c][1]).join('|')) f.push('dropdown: ' + o.join('|'));
  choose(W, 11);
  const k1 = cur(W); if (W.ctx.DATA.qs[k1][0] !== 11) f.push('choosing a category in the pick did not ask from it');
  const q1 = W.ctx.DATA.qs[k1];
  W.tap(opts(W).find((b) => +b.dataset.k === q1[5]), 'pick');  // a choice made, not confirmed
  choose(W, 20);
  const k2 = cur(W);
  if (k2 === k1 || W.ctx.DATA.qs[k2][0] !== 20) f.push('switch did not replace the question from the new category');
  if (W.ctx.G.asked !== 0 || W.ctx.G.turn !== 0 || W.ctx.G.teams[0].score !== 0 || W.$('confBtn')) f.push('the switch carried a penalty or a choice');
  if (!W.ctx.seenHas(k1)) f.push('the left question is not marked seen');
  const raw = JSON.parse(store.getItem('kunuz_seen_v1')); const b = Buffer.from(raw.b, 'base64');
  if (!(b[k1 >> 3] >> (k1 & 7) & 1)) f.push('the left question is not in the stored record');
  choose(W, -1);
  const k3 = cur(W); if ([2, 11, 20].indexOf(W.ctx.DATA.qs[k3][0]) < 0) f.push('random drew outside the chosen categories');
  const q3 = W.ctx.DATA.qs[k3];
  W.tap(opts(W).find((b2) => +b2.dataset.k === q3[5]), 'pick'); W.tap(W.$('confBtn'), 'confirm');
  const before = cur(W);
  choose(W, 2);
  if (W.ctx.G.asked !== 1 || !W.ctx.P.locked) f.push('a switch after the confirm replaced a settled question');
  // a hidden-mode switch is allowed before the answer is revealed, refused after
  const H = open(src);
  setup(H, { teams: null, cats: [2, 11], total: 4, opts: 'hidden', shows: 0 });
  start(H); askNow(H); const h1 = cur(H); choose(H, 11); const h2 = cur(H);
  if (h1 === h2) f.push('hidden-mode switch before the reveal did nothing');
  H.tap(H.$('revealBtn'), 'reveal'); choose(H, 2);
  if (cur(H) !== h2) f.push('hidden-mode switch after the reveal replaced the question');
  // a drained category leaves the dropdown
  const D = open(src, Store());
  DATA0.qs.forEach((q, i) => { if (q[0] === 11) D.ctx.seenMark(i); });
  setup(D, { teams: null, cats: [2, 11], total: 4, opts: 'shown' }); start(D);
  const od = shown(D, '#catSel option').map((x) => +x.value);
  if (od.indexOf(11) > -1) f.push('a drained category is still offered');
  return { f: f.concat(errsOf(W), W.fails, errsOf(H), H.fails, errsOf(D), D.fails), info: 'options=' + o.length + ' leftMarked=' + (W.ctx.seenHas(k1) ? 1 : 0) + ' drainedOffered=' + (od.indexOf(11) > -1 ? 1 : 0) + ' afterConfirmSame=' + (before === null || before === -1 ? 1 : 0) };
}
function checkT7(src) {
  const f = [];
  const W = open(src);
  setup(W, { teams: ['A', 'B'], cats: [2], total: 3, timer: 10, opts: 'shown' });
  start(W); askNow(W);
  const k = cur(W), q = W.ctx.DATA.qs[k];
  if (!/الوقت/.test(W.$('timer').textContent)) f.push('no countdown on screen');
  W.advance(5000);
  if (W.ctx.P.locked) f.push('locked before the time');
  W.advance(5600);
  if (!W.ctx.P.locked || W.ctx.G.asked !== 1 || W.ctx.G.teams[0].score !== 0) f.push('time out did not count the question wrong');
  if (!opts(W).find((b) => +b.dataset.k === q[5]).classList.contains('right')) f.push('time out did not show the right answer');
  if (W.$('nextBtn').disabled) f.push('next disabled after the time out');
  W.tap(W.$('nextBtn'), 'next'); askNow(W);
  W.advance(3000); answer(W, true);
  W.advance(20000);
  if (W.ctx.G.teams[1].score !== 1 || W.ctx.G.asked !== 2) f.push('a timer still ran after an answer');
  const H = open(src);
  setup(H, { teams: null, cats: [2], total: 3, timer: 5, opts: 'hidden', shows: 0 });
  start(H); askNow(H); H.advance(6000);
  if (!H.ctx.P.locked || H.ctx.G.teams[0].score !== 0 || !shown(H, '#opts .ans').length) f.push('hidden-mode time out did not show the answer and count wrong');
  return { f: f.concat(errsOf(W), W.fails, errsOf(H), H.fails), info: 'timeoutLocked=' + (W.ctx.G.asked >= 1 ? 1 : 0) };
}
function checkT8(src) {
  const f = [];
  const W = open(src);
  setup(W, { teams: null, cats: [2, 11], total: 4, opts: 'shown' });
  start(W);
  let right = 0;
  for (let i = 0; i < 4; i++) { askNow(W); const r = i !== 1; if (r) right++; answer(W, r); if (i === 3 && W.$('nextBtn').textContent !== 'النتيجة') f.push('last next is not the result'); W.tap(W.$('nextBtn'), 'next'); }
  if (W.screen() !== 'end') f.push('no end screen after the total');
  if (W.$('endNum').textContent !== '٣' || W.$('endSub').textContent !== 'أجبتَ صحيحًا عن ٣ من ٤') f.push('solo result: ' + W.$('endNum').textContent + ' / ' + W.$('endSub').textContent);
  W.tap(W.$('again'), 'again');
  if (W.screen() !== 'cfg' || W.ctx.S.total !== 4 || W.ctx.S.cats.join(',') !== '2,11') f.push('new game lost the choices');
  const T = open(src);
  setup(T, { teams: ['A', 'B', 'C'], cats: [2, 11], total: 6, opts: 'shown' });
  start(T);
  [true, true, false, false, false, false].forEach((r) => { askNow(T); answer(T, r); T.tap(T.$('nextBtn'), 'next'); });
  const rows = shown(T, '#rankBody tr').map((tr) => tr.textContent);
  if (T.screen() !== 'end' || T.$('winner').textContent !== 'تعادل بين «A» و«B»' || rows.length !== 3 || !/^C/.test(rows[2])) f.push('tie result: ' + T.$('winner').textContent + ' rows=' + rows.join('|'));
  const T2 = open(src);
  setup(T2, { teams: ['A', 'B'], cats: [2, 11], total: 4, opts: 'shown' });
  start(T2);
  [false, true, false, true].forEach((r) => { askNow(T2); answer(T2, r); T2.tap(T2.$('nextBtn'), 'next'); });
  if (T2.$('winner').textContent !== 'الفائز «B»' || !/^B/.test(shown(T2, '#rankBody tr')[0].textContent)) f.push('winner result: ' + T2.$('winner').textContent);
  return { f: f.concat(errsOf(W), W.fails, errsOf(T), T.fails, errsOf(T2), T2.fails), info: 'solo=' + right + '/4 tie=' + ascii(T.$('winner').textContent).length + ' winnerRow=' + (rows[0] ? 1 : 0) };
}
function checkT9(src) {
  const f = [];
  R = prng(SEED + 9);
  const store = Store(), L = Ledger();
  const cats = [16, 23, 20];   // three small categories, drained by the games
  const total = cats.reduce((s, c) => s + DATA0.qs.filter((q) => q[0] === c && q[2] !== 0).length, 0);
  let games = 0, after = 0, wide = 0;
  for (; wide < 200; wide++) {
    const W = open(src, store);
    const pick = []; const k = 1 + ri(5); while (pick.length < k) { const c = ri(DATA0.cats.length); if (cats.indexOf(c) < 0 && pick.indexOf(c) < 0) pick.push(c); }
    setup(W, { teams: wide % 2 ? ['A', 'B'] : null, cats: pick, total: 5 + ri(25), opts: wide % 3 ? 'shown' : 'hidden', shows: -1 });
    if (W.$('startBtn').disabled) continue;
    start(W); playOut(W, L, 'w' + wide, 0.5);
    if (W.screen() !== 'end') f.push('wide game ' + wide + ' did not reach its end');
    f.push(...errsOf(W).slice(0, 2), ...W.fails.slice(0, 2));
  }
  for (; games < 300; games++) {
    const W = open(src, store);
    const small = W.ctx.seenLeft(cats);
    if (games % 7 === 3) {   // a dive of the Ghaws page on the same record, if the bank still holds questions there
      const ghawsText = fs.readFileSync(path.join(REPO, 'quest-ghaws.html'), 'utf8');
      const gs = ghawsText.lastIndexOf('<script>'), ge = ghawsText.indexOf('</script>', gs), bs = ghawsText.indexOf('<body>') + 6, be = ghawsText.indexOf('<script', bs);
      const D = makeWorld({ DATA: JSON.parse(JSON.stringify(DATA0)), ENGINE: ghawsText.slice(gs + 8, ge), BODY: ghawsText.slice(bs, be) }, JSON.parse(JSON.stringify(DATA0)), ['home', 'how', 'cfg', 'turn', 'dive', 'end', 'board', 'verdict'], { reduce: true, storage: store });
      D.tap(D.doc.querySelector('[data-go="cfg1"]'), 'mode'); D.tap(D.doc.querySelector('[data-q="none"]'), 'none'); cats.concat([10, 17, 24]).forEach((c) => tapCat(D, c));
      D.ctx.S.cap = 3; D.ctx.S.breath = 0; D.ctx.S.noOpts = false;
      if (!D.$('goDive').disabled) {
        D.tap(D.$('goDive'), 'goDive');
        for (let g = 0; g < 30 && D.screen() === 'dive'; g++) {
          const sh = D.doc.querySelectorAll('#shells .shell').filter((e) => D.shown(e) && !e.disabled); if (!sh.length) break;
          D.tap(sh[ri(sh.length)], 'shell'); const q = D.ctx.S.cur, k = D.ctx.DATA.qs.indexOf(q);
          if (L.has(k)) L.rep++; L.add(k); L.shown++;
          D.tap(D.doc.querySelectorAll('#opts button.opt').find((b) => D.shown(b) && +b.dataset.k === q[5]), 'pearl'); D.advance(2600);
        }
      }
      f.push(...errsOf(D).slice(0, 2));
      continue;
    }
    setup(W, { teams: games % 2 ? ['A', 'B', 'C'] : null, cats, total: 5 + ri(20), opts: games % 3 ? 'shown' : 'hidden', shows: games % 3 ? 0 : 1 });
    if (W.$('startBtn').disabled) { if (small !== 0) f.push('start disabled with questions left'); after++; if (after > 3) break; continue; }
    start(W); playOut(W, L, 'g' + games, 0.5);
    if (W.screen() !== 'end') f.push('game ' + games + ' did not reach its end');
    f.push(...errsOf(W).slice(0, 2), ...W.fails.slice(0, 2));
  }
  const raw = JSON.parse(store.getItem('kunuz_seen_v1')); const b = Buffer.from(raw.b, 'base64');
  let unmarked = 0, heldShown = 0; L.forEach((k) => { if (!(b[k >> 3] >> (k & 7) & 1)) unmarked++; if (DATA0.qs[k][2] === 0) heldShown++; });
  const drained = cats.every((c) => DATA0.qs.every((q, i) => q[0] !== c || q[2] === 0 || (b[i >> 3] >> (i & 7) & 1)));
  if (heldShown) f.push('held questions were shown: ' + heldShown);
  if (L.rep) f.push('repeats=' + L.rep);
  if (L.text) f.push('question text differs from the bank ' + L.text);
  if (unmarked) f.push('shown but not marked ' + unmarked);
  if (!drained) f.push('the categories were not drained within ' + games + ' games');
  // after exhaustion: the setup refuses the start, nothing is shown
  const E = open(src, store); setup(E, { teams: null, cats, total: 5, opts: 'shown' });
  if (!E.$('startBtn').disabled || !/انتهت/.test(E.$('tally').textContent)) f.push('after exhaustion the start is not refused with the spent line');
  return { f, info: 'wideGames=' + wide + ' drainGames=' + games + ' shown=' + L.shown + ' distinct=' + L.size + ' smallCatsTotal=' + total + ' repeats=' + L.rep + ' unmarked=' + unmarked + ' drained=' + (drained ? 1 : 0) };
}
function checkT10(src) {
  const f = [];
  R = prng(SEED + 10);
  const STATE = new Set(['prog', 'totals', 'totalsFree', 'times', 'timesFree', 'showChips', 'scores', 'turnBar', 'endNum', 'endSub', 'rankBody', 'timer', 'winner', 'teamList', 'catSelN', 'act']);
  const CONTENT = new Set(['qtext', 'opts', 'why', 'qcat', 'catSel', 'cats', 'catPills']);   // the bank's own text (a question may hold a number)
  const QWORD = /(سؤال|أسئلة|اسئلة|بنك)/, DIGIT = /[0-9٠-٩]/;
  const arD = (n) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);
  const tot = DATA0.cats.map((c, i) => DATA0.qs.filter((q) => q[0] === i).length);
  let states = 0, strings = 0;
  function scan(W, label) {
    states++;
    const left = W.ctx.seenByCat(), set = new Set([N]);
    const L = left.reduce((a, b) => a + b, 0); set.add(L); set.add(N - L);
    tot.forEach((n) => { if (n >= 13) set.add(n); }); left.forEach((n) => { if (n >= 13) set.add(n); });
    const ch = W.ctx.S.cats; if (ch.length) { set.add(ch.reduce((s, c) => s + tot[c], 0)); set.add(ch.reduce((s, c) => s + left[c], 0)); }
    const can = [...set].filter((n) => n >= 13);
    const walk = (el, inState) => {
      if (el.nodeType !== 1) return;
      const id = el.attrs.id;
      if (id && CONTENT.has(id)) return;
      const st = inState || (id && STATE.has(id));
      const own = el.childNodes.filter((n) => n.nodeType === 3).map((n) => n.data).join('');
      for (const s of readable(el, own)) {
        strings++;
        if (!DIGIT.test(s)) continue;
        if (!st && QWORD.test(s)) f.push(label + ' #' + (id || el.localName) + ' word+digit: ' + s.trim().slice(0, 60));
        for (const c of can) { if (st && c < 1000) continue; if (c < 1000 && !QWORD.test(s)) continue;
          if (s.indexOf(arD(c)) > -1 || new RegExp('(^|[^0-9])' + c + '([^0-9]|$)').test(s)) f.push(label + ' #' + (id || el.localName) + ' canary ' + c + ': ' + s.trim().slice(0, 60)); }
      }
      el.childNodes.forEach((n) => walk(n, st));
    };
    walk(W.doc.documentElement, false);
  }
  const store = Store();
  const W = open(src, store); scan(W, 'cfg-default');
  DATA0.qs.forEach((q, i) => { if (q[0] === 16) W.ctx.seenMark(i); });
  setup(W, { teams: ['A', 'B'], cats: [16], total: 5, opts: 'hidden', shows: 2 }); scan(W, 'cfg-spent');
  W.tap(W.doc.querySelector('[data-q="all"]'), 'all'); scan(W, 'cfg-all');
  setup(W, { teams: ['A', 'B'], cats: [10, 17, 24], total: 3, timer: 20, opts: 'hidden', shows: 2 }); scan(W, 'cfg-hidden');
  start(W); scan(W, 'play-pick'); askNow(W); scan(W, 'play-hidden-q');
  W.tap(W.$('showOptsBtn'), 'show'); scan(W, 'play-shown-after-credit');
  const q = W.ctx.DATA.qs[cur(W)]; W.tap(opts(W)[0], 'pick'); scan(W, 'play-picked'); W.tap(W.$('confBtn'), 'c'); scan(W, 'play-locked');
  W.tap(W.$('nextBtn'), 'n'); askNow(W); W.tap(W.$('revealBtn'), 'r'); scan(W, 'play-revealed');
  W.tap(W.$('judgeYes'), 'y'); W.tap(W.$('nextBtn'), 'n'); askNow(W); W.advance(21000); scan(W, 'play-timeout');
  W.tap(W.$('nextBtn'), 'n'); scan(W, 'end-teams');
  const V = open(src, store); setup(V, { teams: null, cats: [10], total: 2, opts: 'shown' }); start(V); askNow(V); answer(V, true); V.tap(V.$('nextBtn'), 'n'); askNow(V); answer(V, false); V.tap(V.$('nextBtn'), 'n'); scan(V, 'end-solo');
  const s2 = Store(); const X = open(src, s2); const keep = DATA0.qs.map((x, i) => i).filter((i) => DATA0.qs[i][0] === 20).slice(0, 2);
  DATA0.qs.forEach((x, i) => { if (x[0] === 20 && keep.indexOf(i) < 0) X.ctx.seenMark(i); });
  setup(X, { teams: null, cats: [20], total: 10, opts: 'shown' }); start(X); playOut(X, null, 'spent', 1); scan(X, 'end-spent');
  const errs = [W, V, X].flatMap((x) => errsOf(x).concat(x.fails));
  return { f: f.concat(errs), info: 'states=' + states + ' strings=' + strings + ' leaks=' + f.length + ' spentEnd=' + (X.screen() === 'end' ? 1 : 0) + ' qCats=' + (q ? 1 : 0) };
}
function checkT11(pageText) {
  const f = [];
  const script = pageText.slice(pageText.lastIndexOf('<script>'));
  const bad = [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /EventSource/, /["'`]\/api\//, /navigator\.(geolocation|mediaDevices)/, /\bimport\s*\(/];
  bad.forEach((re) => { if (re.test(script)) f.push('the script reaches out: ' + re); });
  if (/\baction=/.test(pageText) || /<form\b/.test(pageText)) f.push('a form on the page');
  const srcs = [...pageText.matchAll(/<script\b[^>]*\bsrc="([^"]*)"/g)].map((m) => m[1]);
  // KUNUZ-LEVELS-POETRY (2026-10-19, C): the deferred shared loader requests the optional levels file after setup mounts;
  // kunuzlevels L4/L5 check its switch and single source entry.
  // Visual engine: four fixed same-origin assets; kunuzvisual checks their loaders and switch.
  if (srcs.join(',') !== '/quest-theme/motion-kit.js?v=20261022-roomsfix2,/quest-theme/icons.js?v=20261026-kfix6,/quest-theme/model.js?v=20261025-kfix5,/iap-pending.js?v=20261023-iapf,/hanna-laha/assets/iap-bridge-v1.js?v=20261027-apple-review-4,/quest-theme/journey.js?v=20261027-kfix2') f.push('scripts loaded: ' + srcs.join(','));
  { const mod = fs.readFileSync(path.join(REPO, 'quest-levels.js'), 'utf8'); bad.forEach((re) => { if (re.test(mod.replace('s.src="/quest-data/kunuz-levels-3147.js";', ''))) f.push('the levels module reaches out: ' + re); });
    if ((mod.match(/\.src="([^"]*)"/g) || []).join() !== '.src="/quest-data/kunuz-levels-3147.js"') f.push('the levels module loads something else than its file'); }
  if (!/<html lang="ar" dir="rtl">/.test(pageText)) f.push('not declared Arabic right to left');
  if (pageText.indexOf(['ezik', 'ui', 'lang', 'v1'].join('_')) > -1) f.push('writes the app language slot');
  if (!/<a\b[^>]*href="\/quest\.html"/.test(pageText) || !/<a\b[^>]*href="\/"/.test(pageText)) f.push('no way back to /quest.html and home /');
  const A = '[اأإآ]';
  const cp = (...c) => String.fromCharCode(...c);
  const israel = new RegExp(A + cp(0x633, 0x631, 0x627, 0x626, 0x64A, 0x644) + '|' + cp(0x635, 0x647, 0x64A, 0x648, 0x646) + '|israel', 'i');
  if (israel.test(pageText)) f.push('the page names the entity');
  const quest = fs.readFileSync(path.join(REPO, 'quest.html'), 'utf8');
  const card = quest.match(/<a class="door" href="\/quest-test\.html"><b>([^<]*)<\/b>\s*<span>([^<]*)<\/span><\/a>/);
  if (!card) f.push('quest.html has no card for /quest-test.html in the shape of the others');
  else { if (card[1] !== 'اختبر معلوماتك') f.push('card title'); if (/[0-9٠-٩]/.test(card[2])) f.push('a digit in the card text'); }
  return { f, info: 'scripts=' + srcs.length + ' card=' + (card ? 1 : 0) };
}

const PAGE_TEXT = fs.readFileSync(PAGE, 'utf8');
const SRC = srcOf(PAGE_TEXT);
console.log('FILE ' + ascii(path.relative(REPO, PAGE)) + ' bytes=' + Buffer.byteLength(PAGE_TEXT) + ' qs=' + N + ' cats=' + DATA0.cats.length + ' SEED ' + SEED);
const run = (id, name, fn, x) => { let r; try { r = fn(x); } catch (e) { r = { f: ['THROWN ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')], info: '' }; } report(id, name, r.f, r.info); return r; };
run('T1', 'the seen record and the eight groups are copies, byte for byte, of the two other pages', checkT1, PAGE_TEXT);
run('T2', 'engine: turn, scores, draws, no repeat, per-team credit, ranking and tie', checkT2, SRC);
run('T3', 'setup: one category minimum and no ceiling, 2..4 teams, colours, credit question', checkT3, SRC);
run('T4', 'shown options: choose, change, confirm, lock, green and red, next', checkT4, SRC);
run('T5', 'hidden options: reveal, judge, show-options credit of the team in turn only', checkT5, SRC);
run('T6', 'the dropdown: random first, switch before confirm, left question stays seen', checkT6, SRC);
run('T7', 'the timer: running out is wrong and shows the answer', checkT7, SRC);
run('T8', 'the end: solo score, ranking, winner, tie, new game keeps the choices', checkT8, SRC);
run('T9', 'no repeat: 200 games over random categories, then games and Ghaws dives on one record until three categories are drained', checkT9, SRC);
run('T10', 'no number about the questions on any screen', checkT10, SRC);
run('T11', 'nothing leaves the device; Arabic; the way back; the entity rule; the card', checkT11, PAGE_TEXT);

// ---------- T12: the gate bites ----------
{
  const mut = (name, from, to, check, viaSrc) => {
    if (PAGE_TEXT.split(from).length !== 2) return name + ' (seam moved)';
    const t = PAGE_TEXT.replace(from, () => to);
    let r; try { r = check(viaSrc ? srcOf(t) : t); } catch (e) { r = { f: ['thrown'] }; }
    return r.f.length ? null : name;
  };
  const missed = [
    mut('turn that does not move', 'function next(g){g.turn=(g.turn+1)%g.teams.length}', 'function next(g){g.turn=g.turn%g.teams.length}', checkT2, true),
    mut('credit taken from every team', 'if(t.shows>0)t.shows--;return true}', 'g.teams.forEach(function(x){if(x.shows>0)x.shows--});return true}', checkT2, true),
    mut('seen record one byte off', 'var SEEN_KEY="kunuz_seen_v1";', 'var SEEN_KEY="kunuz_seen_v1" ;', checkT1, false),
    mut('a switch that returns the left question to the pool', 'else if(P.phase==="q"&&!P.locked&&!P.answered)ask();', 'else if(P.phase==="q"&&!P.locked&&!P.answered){var o=G.cur;ask();SEEN.bits[o>>3]&=~(1<<(o&7));seenWrite();delete G.used[o]}', checkT6, true),
    mut('timer that scores right', '  lock(false,true);', '  lock(true,true);', checkT7, true),
    mut('a fetch on the page', '</body>', '<script>try{fetch("/api/x")}catch(e){}</script>\n</body>', checkT11, false),
    mut('a question count on the setup', '<p class="lbl">الفئات</p><p class="sub">', '<p class="lbl">الفئات</p><p class="sub">' + N + ' سؤال · ', checkT10, true),
    // KUNUZ-QA-DECISIONS (2026-10-19): a count a screen reader alone would hear is a count on the screen
    mut('a question count read only by a screen reader', '<p class="lbl">الفئات</p><p class="sub">', '<p class="lbl">الفئات</p><p class="sub" aria-description="' + N + ' سؤال">', checkT10, true),
    mut('a confirm that scores the first tap', 'b.onclick=function(){if(P.locked)return;P.picked=j;', 'b.onclick=function(){if(P.locked)return;P.picked=j;lock(j===cur()[5]);', checkT4, true),
  ].filter(Boolean);
  report('T12', 'the gate bites: nine mutants of the page are each caught', missed.map((m) => 'MUTANT SURVIVED: ' + m), 'mutants=9 missed=' + missed.length);
}

const bad = results.filter((r) => !r.ok);
console.log('SUMMARY ' + (results.length - bad.length) + '/' + results.length + ' pass' + (bad.length ? ' FAILED: ' + bad.map((r) => r.id).join(',') : ''));
process.exit(bad.length ? 1 : 0);
