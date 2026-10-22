// kunuz-board-guard.cjs -- the Kunuz board game (quest-board.html, 2026-10-16). ASCII output only.
// usage: node guards/kunuz-board-guard.cjs [--page file] [--seed 7]
//
// The page is run as it ships: its body in the mini DOM of guards/kunuz-sim, its script in a vm, the shared bank as DATA,
// a fake localStorage shared between "page opens" (the same account), exactly as kunuznorepeat runs the dive and the war.
//   B1 the three copied blocks stay copies: the no-repeat record (var SEEN_KEY= .. SEEN.stamp=), KZC_GROUPS (the eight
//      groups) and the category picker (var KZC= .. kzcDraw) are byte-identical in quest-ghaws.html, quest-harb.html and here
//   B2 the engine alone (BE): six categories exactly or no game, 2..4 teams, six slots per category (two each of 200, 400,
//      600), the turn goes round for 2, 3 and 4 teams, points to whoever answered, none below zero, back returns the slot,
//      the question is drawn from the slot's category when the slot opens, no repeat in a game, the record honoured,
//      ranking and the tie, random categories
//   B3 the setup: start only with exactly six, the seventh chip refused, random gives six, clear, the whole-group button,
//      two to four teams with distinct colours, the name comes from one constant
//   B4 the board: six cards of 200/400/600 on each side, icon and name in the middle, the turn pill, the team bar; a slot
//      opens the question; back; reveal paints the right option and offers every team and «ما أحد جاوب»; a used slot
//   B5 whole games with 2, 3 and 4 teams to the end, the tie named, «إنهاء اللعبة» (two taps), a new game keeps the setup
//   B6 no repeat: games on one record, with Ghaws dives on the same record, until small categories are drained
//   B7 no number about the questions on any screen
//   B8 nothing leaves the device; Arabic; the way back; the entity rule; the card in quest.html; no difficulty
//   B9 the icons: stroke drawings with no living thing and no image, one per group and a general one
//   B10 the layout rules: three columns, two up to 900, one up to 560; left-to-right inside a card; 44px touch
//   B11 the gate bites: mutants of the page are each caught
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const { VER, El, Txt, parseInto } = require('./kunuz-sim/dom.cjs');
const { readable } = require('./kunuz-sim/readable.cjs');   // text and every attribute a screen reader speaks (KUNUZ-QA-DECISIONS, 2026-10-19)
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i > -1 ? argv[i + 1] : d; };
const REPO = path.join(__dirname, '..');
const PAGE = arg('page', path.join(REPO, 'quest-board.html'));
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
const BANK_TAG = '<script src="/quest-data/kunuz-bank-3147.js"></script>';
const DATA0 = new Function(fs.readFileSync(BANK_FILE, 'utf8') + ';return DATA;')();
const N = DATA0.qs.length;
function srcOf(pageText) {
  if (pageText.split(BANK_TAG).length !== 2) throw new Error('page does not load the shared bank exactly once');
  if (pageText.indexOf('var DATA=') > -1) throw new Error('page embeds a bank of its own');
  const sa = pageText.lastIndexOf('<script>'), sb = pageText.indexOf('</script>', sa);
  const bs = pageText.indexOf('<body>') + 6, be = pageText.indexOf('<script', bs);
  return { DATA: JSON.parse(JSON.stringify(DATA0)), ENGINE: pageText.slice(sa + 8, sb), BODY: pageText.slice(bs, be) };
}
function Store() { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; }
const SCREENS = ['cfg', 'play', 'end'];
const open = (src, store) => makeWorld(src, src.DATA, SCREENS, { reduce: true, storage: store || Store() });
const errsOf = (W) => W.errors.map((e) => String(e && e.stack || e).split('\n').slice(0, 2).join(' | '));
const AD = '٠-٩';   // the Arabic-Indic digits, as a character-class range
const arD = (n) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);
const bitOf = (store, k) => { const raw = JSON.parse(store.getItem('kunuz_seen_v1')); const b = Buffer.from(raw.b, 'base64'); return (b[k >> 3] >> (k & 7)) & 1; };

// ---------- drivers ----------
const shown = (W, sel) => W.doc.querySelectorAll(sel).filter((e) => W.shown(e));
const chips = (W) => { const a = []; W.$('cats').querySelectorAll('[data-cat]').forEach((b) => { a[+b.dataset.cat] = b; }); return a; };
const tapCat = (W, c) => { let b = chips(W)[c]; if (b && !W.shown(b)) { W.tap(b.parentNode.parentNode.querySelector('.kzc-gh'), 'group of ' + c); b = chips(W)[c]; } return W.tap(b, 'chip ' + c); };
function setup(W, o) {
  // o: {teams:[names], cats:[idx] | 'rnd'}
  while (W.ctx.S.teams.length < o.teams.length) W.tap(W.$('addTeam'), 'addTeam');
  while (W.ctx.S.teams.length > o.teams.length) W.tap(shown(W, '#teamList .mini')[0], 'remove');
  shown(W, '#teamList input').forEach((inp, i) => { inp.value = o.teams[i]; inp.oninput(); });
  W.tap(W.doc.querySelector('[data-q="none"]'), 'none');
  if (o.cats === 'rnd') W.tap(W.doc.querySelector('[data-q="rnd"]'), 'rnd');
  else o.cats.forEach((c) => tapCat(W, c));
}
const start = (W) => W.tap(W.$('startBtn'), 'start');
const slotBtn = (W, s) => W.doc.querySelector('#board [data-s="' + s + '"]');
const freeSlots = (W) => shown(W, '#board .pt').filter((b) => !b.disabled);
const curK = (W) => (W.ctx.G && W.ctx.G.cur ? W.ctx.G.cur.k : -1);
function openSlot(W, s) { return W.tap(slotBtn(W, s), 'slot ' + s); }
function reveal(W) { return W.tap(W.$('revealBtn'), 'reveal'); }
function give(W, t) { const b = t < 0 ? W.$('nobody') : W.$('award').querySelector('[data-t="' + t + '"]'); return W.tap(b, 'award ' + t); }
// one turn: open a random free slot, maybe back first, reveal and award (who: team index, -1 nobody, undefined random)
function turn(W, L, who, backP) {
  const fs0 = freeSlots(W); if (!fs0.length) return false;
  let s = +fs0[ri(fs0.length)].dataset.s;
  openSlot(W, s);
  if (L) { const k = curK(W); if (L.has(k)) L.rep++; L.add(k); L.shown++; if (W.$('qtext').textContent !== W.ctx.DATA.qs[k][3]) L.text++; }
  if (backP && R() < backP) { W.tap(W.$('backBtn'), 'back'); return true; }
  reveal(W);
  give(W, who === undefined ? ri(W.ctx.G.teams.length + 1) - 1 : who);
  return true;
}
function playOut(W, L, backP) { let n = 0; for (let g = 0; g < 400 && W.screen() === 'play'; g++) { if (!turn(W, L, undefined, backP)) break; n++; } return n; }
function Ledger() { const s = new Set(); s.rep = 0; s.shown = 0; s.text = 0; return s; }

// ---------- results ----------
const results = [];
function report(id, name, fails, info) {
  results.push({ id, ok: !fails.length });
  console.log((fails.length ? 'FAIL ' : 'PASS ') + id + ' ' + name + (info ? ' :: ' + ascii(info) : ''));
  fails.slice(0, 8).forEach((m) => console.log('   - ' + ascii(m)));
}

// ======================================================================
// Every check is a function of the page text (or of srcOf(page)), so B11 can run the same checks on mutants.
function sliceSeen(t) { const a = t.indexOf('var SEEN_KEY='), b = t.indexOf('SEEN.stamp=seenStamp();', a); return a < 0 || b < 0 ? null : t.slice(a, b); }
function sliceGroups(t) { const a = t.indexOf('var KZC_GROUPS=['), b = t.indexOf('\n];', a); return a < 0 || b < 0 ? null : t.slice(a, b + 3); }
function slicePicker(t) { const a = t.indexOf('var KZC={open:-1,g:null};'), d = t.indexOf('function kzcDraw(', a), b = d < 0 ? -1 : t.indexOf('\n}\n', d); return a < 0 || b < 0 ? null : t.slice(a, b + 2); }
function checkB1(pageText) {
  const f = [];
  const g = fs.readFileSync(path.join(REPO, 'quest-ghaws.html'), 'utf8'), h = fs.readFileSync(path.join(REPO, 'quest-harb.html'), 'utf8');
  const sizes = [];
  for (const [name, fn] of [['seen record', sliceSeen], ['KZC_GROUPS', sliceGroups], ['category picker', slicePicker]]) {
    const a = fn(g), b = fn(h), c = fn(pageText);
    if (!a || !b || !c) { f.push(name + ': a block is missing'); continue; }
    if (a !== b) f.push(name + ': ghaws and harb differ');
    if (c !== a) f.push(name + ': quest-board differs from ghaws');
    sizes.push(c.length);
  }
  if (pageText.indexOf('var SEEN_KEY="kunuz_seen_v1";') < 0) f.push('the record key is not kunuz_seen_v1');
  return { f, info: 'bytes=' + sizes.join('/') };
}
function checkB2(src) {
  const f = [];
  const W = open(src); const BE = W.ctx.BE;
  if (!BE) return { f: ['BE engine not defined'].concat(errsOf(W)), info: '' };
  const none = () => false;
  const T = (n) => ['a', 'b', 'c', 'd', 'e'].slice(0, n).map((x, i) => ({ n: x, c: '#' + i }));
  const six = [0, 5, 9, 14, 20, 30];
  // refusal
  const bad = [[T(2), [0, 1, 2, 3, 4]], [T(2), [0, 1, 2, 3, 4, 5, 6]], [T(2), [0, 1, 2, 3, 4, 4]], [T(2), [0, 1, 2, 3, 4, DATA0.cats.length]], [T(2), []], [T(1), six], [T(5), six], [T(2), [0, 1, 2, 3, 4, -1]]];
  bad.forEach(([t, c], i) => { if (BE.newGame({ teams: t, cats: c }) !== null) f.push('a game started with bad setup #' + i); });
  [2, 3, 4].forEach((n) => { if (!BE.newGame({ teams: T(n), cats: six })) f.push('no game with ' + n + ' teams and six categories'); });
  // the slots
  const g = BE.newGame({ teams: T(3), cats: six });
  if (g.slots.length !== 36) f.push('slots ' + g.slots.length);
  six.forEach((c, p) => {
    const sl = g.slots.slice(p * 6, p * 6 + 6);
    if (!sl.every((x) => x.cat === c)) f.push('slots of card ' + p + ' are not its category');
    if (sl.map((x) => x.pts).join(',') !== '200,400,600,200,400,600') f.push('points of card ' + p + ': ' + sl.map((x) => x.pts).join(','));
  });
  // turn for 2, 3, 4 teams, points to whoever answered, nobody, no negatives
  const turns = {};
  [2, 3, 4].forEach((n) => {
    const x = BE.newGame({ teams: T(n), cats: six }); let seq = '', prev = x.teams.map(() => 0);
    for (let i = 0; i < 12; i++) {
      seq += x.turn; const s = x.slots.findIndex((y) => !y.used); const k = BE.open(x, s, none, R);
      if (k < 0 || DATA0.qs[k][0] !== x.slots[s].cat) f.push('open drew outside the slot category');
      const who = i % (n + 1) - 1; BE.award(x, who);
      x.teams.forEach((t, j) => { const add = t.score - prev[j]; if (add < 0) f.push('a score went down'); if (j === who && add !== x.slots[s].pts) f.push('award to ' + who + ' added ' + add); if (j !== who && add) f.push('a team that did not answer gained'); prev[j] = t.score; });
    }
    const want = Array.from({ length: 12 }, (_, i) => i % n).join('');
    if (seq !== want) f.push(n + ' teams turn order ' + seq);
    turns[n] = seq;
  });
  // back: slot returns unused, turn unchanged, the shown question is not drawn again in the game
  const b = BE.newGame({ teams: T(2), cats: six });
  const k1 = BE.open(b, 0, none, R); BE.back(b);
  if (b.slots[0].used || b.turn !== 0 || b.cur) f.push('back did not return the slot');
  if (BE.open(b, 1, none, R) < 0) f.push('a second slot does not open after back');
  if (BE.open(b, 2, none, R) !== -1) f.push('two slots open at once');
  BE.back(b);
  // no repeat inside a game: drain category six[0] through its slots with backs
  const size = DATA0.qs.filter((q) => q[0] === six[0] && q[2] !== 0).length, seen = new Set();
  const d = BE.newGame({ teams: T(2), cats: six });
  for (let i = 0; i < size; i++) { const k = BE.open(d, 0, none, R); if (k < 0) { f.push('drained early at ' + i); break; } if (DATA0.qs[k][2] === 0) f.push('held question drawn'); if (seen.has(k)) f.push('repeat inside a game'); seen.add(k); BE.back(d); }
  if (BE.open(d, 0, none, R) !== -1) f.push('a drawn-out category still draws');
  // a full game: 36 distinct questions, over() only at the end
  const full = BE.newGame({ teams: T(4), cats: six }); const fset = new Set();
  for (let s = 0; s < 36; s++) { if (BE.over(full)) f.push('over before the end'); const k = BE.open(full, s, none, R); fset.add(k); BE.award(full, -1); }
  if (!BE.over(full) || fset.size !== 36) f.push('full game: over=' + BE.over(full) + ' distinct=' + fset.size);
  if (BE.open(full, 3, none, R) !== -1) f.push('a used slot opened again');
  // the record is honoured
  const liveHalfPool = DATA0.qs.map((q, i) => i).filter((i) => DATA0.qs[i][0] === six[1] && DATA0.qs[i][2] !== 0);
  const half = new Set(liveHalfPool.slice(0, Math.floor(liveHalfPool.length / 2)));
  const h = BE.newGame({ teams: T(2), cats: six });
  for (let i = 0; i < 30; i++) { const k = BE.open(h, 6, (x) => half.has(x), R); if (half.has(k)) f.push('a seen question was drawn'); BE.back(h); }
  // ranking and the tie
  const rk = BE.newGame({ teams: T(3), cats: six });
  rk.teams[0].score = 200; rk.teams[1].score = 600; rk.teams[2].score = 600;
  const r = BE.rank(rk);
  if (r.order.join('') !== '120' || !r.tie || r.winners.join('') !== '12') f.push('rank ' + JSON.stringify(r));
  rk.teams[2].score = 400; const r2 = BE.rank(rk);
  if (r2.tie || r2.winners.join('') !== '1') f.push('rank without tie ' + JSON.stringify(r2));
  // random: six distinct, each enough for the board, varying; a short category is never offered
  const sets = new Set(); const shortCat = 2; const sh = (i) => DATA0.qs[i][0] === shortCat;
  for (let i = 0; i < 60; i++) {
    const c = BE.randomCats(sh, R);
    if (c.length !== 6 || new Set(c).size !== 6) f.push('random gave ' + c.join(','));
    if (c.indexOf(shortCat) > -1) f.push('random offered a drained category');
    sets.add(c.slice().sort((x, y) => x - y).join(','));
  }
  if (sets.size < 50) f.push('random is not random: ' + sets.size + ' distinct of 60');
  if (BE.enough(shortCat, sh) || !BE.enough(shortCat, none)) f.push('enough() wrong');
  // the points are a wager, not a difficulty: the drawing code never reads them -- except through lvOf, the one reader of the
  // owner's experimental «حسب النقاط» (2026-10-19), which is 0 unless that choice is made (kunuzlevels L3/L4 hold it)
  const eng = src.ENGINE; const oa = eng.indexOf('function bag('), ob = eng.indexOf('function back(');
  if (oa < 0 || ob < 0 || /pts/.test(eng.slice(oa, ob))) f.push('the question draw reads the points');
  const LVOF = 'function lvOf(sl){return typeof KZL==="undefined"?0:KZL.forPts(sl.pts)}';
  if (eng.split('function lvOf(').length !== 2 || eng.indexOf(LVOF) < 0) f.push('lvOf is not the one experimental reader of the points');
  return { f: f.concat(errsOf(W)), info: 'turns=' + turns[2] + '/' + turns[3] + '/' + turns[4] + ' drained=' + size + ' randomSets=' + sets.size + ' rank=' + r.order.join('') };
}
function checkB3(src) {
  const f = [];
  const W = open(src);
  if (W.screen() !== 'cfg') f.push('the page does not open on the setup');
  const name = (/var GAME_NAME="([^"]*)";/.exec(src.ENGINE) || [])[1];
  if (!name || W.$('gameName').textContent !== name || W.doc.title !== 'كنوز المعرفة — ' + name) f.push('the name does not come from GAME_NAME');
  W.tap(W.doc.querySelector('[data-q="none"]'), 'none');
  if (!W.$('startBtn').disabled) f.push('start enabled with no category');
  if (!/ستّ فئات بالضبط/.test(W.$('tally').textContent)) f.push('no line saying six exactly: ' + W.$('tally').textContent);
  [0, 5, 9, 14, 20].forEach((c) => tapCat(W, c));
  if (!W.$('startBtn').disabled) f.push('start enabled with five');
  tapCat(W, 30);
  if (W.$('startBtn').disabled || W.$('tally').textContent) f.push('start disabled with six');
  const off = W.doc.querySelectorAll('#cats .kzc-c').filter((b) => b.getAttribute('aria-pressed') !== 'true');
  if (!off.length || !off.every((b) => b.disabled)) f.push('a seventh category can be chosen');
  W.tap(W.doc.querySelector('[data-q="none"]'), 'none');
  if (W.ctx.S.cats.length) f.push('clear left categories');
  W.tap(W.doc.querySelector('[data-q="rnd"]'), 'rnd');
  if (W.ctx.S.cats.length !== 6 || new Set(W.ctx.S.cats).size !== 6 || W.$('startBtn').disabled) f.push('random did not give six: ' + W.ctx.S.cats.join(','));
  // the whole-group button
  W.tap(W.doc.querySelector('[data-q="none"]'), 'none');
  const G0 = W.ctx.kzcGroups();
  W.tap(W.doc.querySelector('.kzc-gh[data-g="0"]'), 'open group 0');
  const all0 = W.doc.querySelector('#kzcG0 .kzc-all');
  if (!all0 || !W.shown(all0) || all0.textContent !== 'اختر المجموعة كلّها') f.push('no whole-group button in an open group');
  W.tap(all0, 'group all');
  if (W.ctx.S.cats.join(',') !== G0[0].c.slice(0, 6).join(',')) f.push('group all chose ' + W.ctx.S.cats.join(','));
  const rm = W.doc.querySelector('#kzcG0 .kzc-all');
  if (G0[0].c.length <= 6 && (!rm || rm.textContent !== 'أزل المجموعة كلّها')) f.push('a chosen group does not offer removal');
  if (G0[0].c.length <= 6) { W.tap(rm, 'group remove'); if (W.ctx.S.cats.length) f.push('group removal left ' + W.ctx.S.cats.length); }
  const big = G0.findIndex((g) => g.c.length > 6);
  if (big > -1) {
    W.tap(W.doc.querySelector('[data-q="none"]'), 'none'); W.tap(W.doc.querySelector('.kzc-gh[data-g="' + big + '"]'), 'open big');
    W.tap(W.doc.querySelector('#kzcG' + big + ' .kzc-all'), 'big all');
    if (W.ctx.S.cats.length !== 6) f.push('a group of more than six did not stop at six');
  }
  // teams
  if (shown(W, '#teamList .team').length !== 2) f.push('the setup does not start with two teams');
  if (shown(W, '#teamList .mini').length) f.push('two teams can be cut to one');
  W.tap(W.$('addTeam'), 'add'); W.tap(W.$('addTeam'), 'add');
  if (shown(W, '#teamList .team').length !== 4 || !W.$('addTeam').disabled) f.push('four teams is the ceiling');
  const cols = W.ctx.S.teams.map((t) => t.c); if (new Set(cols).size !== 4) f.push('team colours repeat: ' + cols.join(','));
  W.tap(shown(W, '#teamList .mini')[0], 'remove');
  for (let i = 0; i < 6; i++) W.tap(shown(W, '#teamList .swatch')[0], 'swatch');
  const cols2 = W.ctx.S.teams.map((t) => t.c); if (new Set(cols2).size !== cols2.length) f.push('cycling a colour made two teams alike');
  return { f: f.concat(errsOf(W), W.fails), info: 'name=' + (name ? 1 : 0) + ' teamsMax=4 colours=' + new Set(cols).size };
}
function checkB4(src) {
  const f = [];
  const store = Store(); const W = open(src, store);
  const cats = [0, 5, 9, 14, 20, 30];
  setup(W, { teams: ['A', 'B'], cats }); start(W);
  if (W.screen() !== 'play') return { f: ['the board is not shown'].concat(errsOf(W), W.fails), info: '' };
  const cards = shown(W, '#board .cc');
  if (cards.length !== 6) f.push('cards ' + cards.length);
  cards.forEach((cc, p) => {
    const cols = cc.children;
    if (cols.length !== 3 || cols[0].className !== 'ccol' || cols[1].className !== 'cmid' || cols[2].className !== 'ccol') { f.push('card ' + p + ' is not left / middle / right'); return; }
    [cols[0], cols[2]].forEach((c) => { const t = c.querySelectorAll('.pt').map((b) => b.textContent).join(','); if (t !== '٢٠٠,٤٠٠,٦٠٠') f.push('card ' + p + ' column ' + t); });
    if (!cols[1].querySelector('.ic svg')) f.push('card ' + p + ' has no icon');
    if (cols[1].querySelector('.cname').textContent !== DATA0.cats[cats[p]][1]) f.push('card ' + p + ' name');
  });
  if (W.$('turn').textContent !== 'دور فريق A: اختاروا النقاط') f.push('turn pill: ' + W.$('turn').textContent);
  if (W.$('turn').style.getPropertyValue('background') !== W.ctx.G.teams[0].c && W.$('turn').style.background !== W.ctx.G.teams[0].c) f.push('turn pill not in the team colour');
  const tc = shown(W, '#teams .tcard');
  if (tc.length !== 2 || !tc[0].classList.contains('now') || tc[1].classList.contains('now')) f.push('team bar');
  // open, back
  openSlot(W, 4);   // card 0, right column, 400
  if (!W.shown(W.$('qm'))) f.push('the slot did not open the question');
  const k1 = curK(W), q1 = DATA0.qs[k1];
  if (q1[0] !== cats[0]) f.push('the question is not from the card category');
  if (W.$('qcat').textContent !== DATA0.cats[cats[0]][1] || W.$('qpts').textContent !== '٤٠٠ نقطة' || W.$('qtext').textContent !== q1[3]) f.push('question window: ' + W.$('qcat').textContent + ' / ' + W.$('qpts').textContent);
  if (shown(W, '#opts .opt').length !== (q1[4] || []).length) f.push('options not shown');
  if (!W.$('revealBtn') || !W.$('backBtn') || W.$('award')) f.push('before the reveal: show-answer and back, and no award');
  if (!bitOf(store, k1)) f.push('a shown question is not in the record');
  W.tap(W.$('backBtn'), 'back');
  if (W.shown(W.$('qm')) || slotBtn(W, 4).disabled || W.ctx.G.turn !== 0 || W.ctx.G.slots[4].used) f.push('back did not return the slot');
  openSlot(W, 4); const k2 = curK(W);
  if (k2 === k1) f.push('the question left by back came again');
  reveal(W);
  const right = shown(W, '#opts .opt.right');
  if ((q1[4] || []).length && (right.length !== 1 || +right[0].dataset.k !== DATA0.qs[k2][5])) f.push('the right option is not painted');
  if (W.$('backBtn')) f.push('back offered after the reveal');
  const aw = shown(W, '#award button').map((b) => b.textContent);
  if (aw.join('|') !== 'A|B|ما أحد جاوب') f.push('award row: ' + aw.join('|'));
  give(W, 1);   // the team NOT in turn answered
  if (W.ctx.G.teams[1].score !== 400 || W.ctx.G.teams[0].score !== 0) f.push('points to the answering team: ' + W.ctx.G.teams.map((t) => t.score).join(','));
  if (W.ctx.G.turn !== 1 || W.$('turn').textContent !== 'دور فريق B: اختاروا النقاط') f.push('turn did not move to B');
  const used = slotBtn(W, 4);
  if (!used.disabled || !used.classList.contains('used') || !/استُعملت/.test(used.getAttribute('aria-label'))) f.push('a used slot is not marked and closed');
  if (shown(W, '#teams .tcard')[1].querySelector('span').textContent !== '٤٠٠') f.push('team bar score');
  openSlot(W, 0); reveal(W); give(W, -1);
  if (W.ctx.G.teams.map((t) => t.score).join(',') !== '0,400' || W.ctx.G.turn !== 0) f.push('nobody answered: scores or turn');
  return { f: f.concat(errsOf(W), W.fails), info: 'cards=' + cards.length + ' slots=' + shown(W, '#board .pt').length };
}
function checkB5(src) {
  const f = [];
  const info = [];
  [2, 3, 4].forEach((n) => {
    const W = open(src);
    const names = ['A', 'B', 'C', 'D'].slice(0, n);
    setup(W, { teams: names, cats: 'rnd' }); start(W);
    let turns = 0; const exp = names.map(() => 0);
    for (; turns < 60 && W.screen() === 'play'; turns++) {
      const fs0 = freeSlots(W); const s = +fs0[ri(fs0.length)].dataset.s; const pts = W.ctx.G.slots[s].pts;
      if (W.ctx.G.turn !== turns % n) f.push(n + ' teams: turn ' + W.ctx.G.turn + ' at ' + turns);
      openSlot(W, s); reveal(W); const who = ri(n + 1) - 1; if (who >= 0) exp[who] += pts; give(W, who);
    }
    if (turns !== 36 || W.screen() !== 'end') f.push(n + ' teams: the game did not end after the 36 slots (' + turns + ')');
    const rows = shown(W, '#rankBody tr').map((tr) => tr.textContent);
    const order = names.map((x, i) => i).sort((a, b) => exp[b] - exp[a] || a - b);
    if (rows.join('|') !== order.map((i) => names[i] + arD(exp[i])).join('|')) f.push(n + ' teams ranking ' + rows.join('|'));
    const top = exp[order[0]], win = order.filter((i) => exp[i] === top);
    const want = top === 0 ? 'لم يُحرز أحد نقاطًا' : win.length > 1 ? 'تعادل بين ' + win.map((i) => '«' + names[i] + '»').join(' و') : 'الفائز «' + names[win[0]] + '»';
    if (W.$('winner').textContent !== want || W.$('endTitle').textContent !== 'انتهت اللعبة') f.push(n + ' teams winner: ' + W.$('winner').textContent);
    f.push(...errsOf(W), ...W.fails);
    info.push(n + ':' + turns);
  });
  // the tie, named
  const T = open(src);
  setup(T, { teams: ['A', 'B', 'C'], cats: 'rnd' }); start(T);
  for (let i = 0; i < 36; i++) { const s = i; openSlot(T, s); reveal(T); give(T, i < 6 ? (i % 2) : -1); }
  // A got slots 0,2,4 (200+600+400), B got 1,3,5 (400+200+600)
  if (T.screen() !== 'end' || T.$('winner').textContent !== 'تعادل بين «A» و«B»') f.push('tie: ' + T.$('winner').textContent);
  // the quit: one tap asks, the second ends; with a question open it is not counted
  const Q = open(src);
  setup(Q, { teams: ['A', 'B'], cats: 'rnd' }); start(Q);
  openSlot(Q, 0); reveal(Q); give(Q, 0); openSlot(Q, 7);
  Q.tap(Q.$('quit'), 'quit 1');
  if (Q.screen() !== 'play') f.push('one tap on quit ended the game');
  Q.tap(Q.$('quit'), 'quit 2');
  if (Q.screen() !== 'end' || Q.$('endTitle').textContent !== 'أُنهيت اللعبة' || Q.$('winner').textContent !== 'الفائز «A»' || Q.ctx.G.slots[7].used) f.push('quit: ' + Q.$('endTitle').textContent + ' / ' + Q.$('winner').textContent);
  const keep = Q.ctx.S.cats.join(',');
  Q.tap(Q.$('again'), 'again');
  if (Q.screen() !== 'cfg' || Q.ctx.S.cats.join(',') !== keep || Q.ctx.S.teams.map((t) => t.n).join(',') !== 'A,B') f.push('a new game lost the setup');
  start(Q);
  if (Q.screen() !== 'play' || Q.ctx.G.teams.some((t) => t.score) || Q.ctx.G.slots.some((s) => s.used)) f.push('the new game is not fresh');
  return { f: f.concat(errsOf(T), T.fails, errsOf(Q), Q.fails), info: 'games=' + info.join(',') + ' tie=' + (T.$('winner').textContent ? 1 : 0) };
}
function checkB6(src) {
  const f = [];
  R = prng(SEED + 6);
  const store = Store(), L = Ledger();
  // three small categories plus three others; games on one record until a small category can no longer fill a board
  const sizes = DATA0.cats.map((c, i) => DATA0.qs.filter((q) => q[0] === i && q[2] !== 0).length);
  const small = sizes.map((n, i) => [n, i]).sort((a, b) => a[0] - b[0]).slice(0, 3).map((x) => x[1]);
  let games = 0, dives = 0, refused = 0, wide = 0;
  const ghawsText = fs.readFileSync(path.join(REPO, 'quest-ghaws.html'), 'utf8');
  for (; games < 400; games++) {
    if (games % 5 === 2) {   // a Ghaws dive on the same record
      const gs = ghawsText.lastIndexOf('<script>'), ge = ghawsText.indexOf('</script>', gs), bs = ghawsText.indexOf('<body>') + 6, be = ghawsText.indexOf('<script', bs);
      const D = makeWorld({ DATA: JSON.parse(JSON.stringify(DATA0)), ENGINE: ghawsText.slice(gs + 8, ge), BODY: ghawsText.slice(bs, be) }, JSON.parse(JSON.stringify(DATA0)), ['home', 'how', 'cfg', 'turn', 'dive', 'end', 'board', 'verdict'], { reduce: true, storage: store });
      D.tap(D.doc.querySelector('[data-go="cfg1"]'), 'mode'); D.tap(D.doc.querySelector('[data-q="none"]'), 'none'); small.concat([10, 17, 24]).forEach((c) => tapCat(D, c));
      D.ctx.S.cap = 3; D.ctx.S.breath = 0; D.ctx.S.noOpts = false;
      if (!D.$('goDive').disabled) {
        D.tap(D.$('goDive'), 'goDive'); dives++;
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
    const W = open(src, store);
    setup(W, { teams: ['A', 'B'], cats: small.concat([10, 17, 24]) });
    if (W.$('startBtn').disabled) {
      const short = W.ctx.BE.shortOf(W.ctx.S.cats, W.ctx.seenHas);
      if (!short.length) f.push('start refused with every category able to fill the board');
      if (!/لم يبق فيها ما يكفي/.test(W.$('tally').textContent)) f.push('refusal without its line');
      refused++; break;
    }
    start(W); playOut(W, L, 0);
    if (W.screen() !== 'end') f.push('game ' + games + ' did not end');
    f.push(...errsOf(W).slice(0, 2), ...W.fails.slice(0, 2));
  }
  for (; wide < 40; wide++) {   // random categories, no back: strict
    const W = open(src, store); setup(W, { teams: ['A', 'B', 'C'], cats: 'rnd' });
    if (W.$('startBtn').disabled) { f.push('random setup refused with the bank full'); continue; }
    start(W); playOut(W, L, 0);
    if (W.screen() !== 'end') f.push('wide game ' + wide + ' did not end');
    f.push(...errsOf(W).slice(0, 2), ...W.fails.slice(0, 2));
  }
  let unmarked = 0, heldShown = 0; L.forEach((k) => { if (!bitOf(store, k)) unmarked++; if (DATA0.qs[k][2] === 0) heldShown++; });
  if (heldShown) f.push('held questions shown ' + heldShown);
  if (L.rep) f.push('repeats=' + L.rep);
  if (L.text) f.push('question text differs from the bank ' + L.text);
  if (unmarked) f.push('shown but not marked ' + unmarked);
  if (!refused) f.push('the small categories never ran short within ' + games + ' games');
  if (!dives) f.push('no Ghaws dive ran on the shared record');
  // a board question is seen by Ghaws on the same record
  const anyK = [...L][0];
  const gs = ghawsText.lastIndexOf('<script>'), ge = ghawsText.indexOf('</script>', gs), bs = ghawsText.indexOf('<body>') + 6, be = ghawsText.indexOf('<script', bs);
  const D2 = makeWorld({ DATA: JSON.parse(JSON.stringify(DATA0)), ENGINE: ghawsText.slice(gs + 8, ge), BODY: ghawsText.slice(bs, be) }, JSON.parse(JSON.stringify(DATA0)), ['home'], { reduce: true, storage: store });
  if (!D2.ctx.seenHas(anyK)) f.push('Ghaws does not see a board question as seen');
  return { f, info: 'wideGames=' + wide + ' drainGames=' + games + ' dives=' + dives + ' shown=' + L.shown + ' distinct=' + L.size + ' repeats=' + L.rep + ' unmarked=' + unmarked + ' refused=' + refused };
}
function checkB7(src) {
  const f = [];
  R = prng(SEED + 7);
  const STATE = new Set(['teams', 'turn', 'rankBody', 'winner', 'teamList', 'qpts', 'board', 'catSelN']);   // points, scores, team numbers
  const CONTENT = new Set(['qtext', 'opts', 'qans', 'qcat', 'cats', 'catPills', 'award']);   // the bank's own text and the team names
  const QWORD = /(سؤال|أسئلة|اسئلة|بنك|خان)/, DIGIT = /[0-9٠-٩]/;
  const tot = DATA0.cats.map((c, i) => DATA0.qs.filter((q) => q[0] === i).length);
  let states = 0, strings = 0;
  function scan(W, label) {
    states++;
    const left = W.ctx.seenByCat(), set = new Set([N, 36, 6 * 6]);
    const L = left.reduce((a, b) => a + b, 0); set.add(L); set.add(N - L);
    tot.forEach((n) => { if (n >= 13) set.add(n); }); left.forEach((n) => { if (n >= 13) set.add(n); });
    if (W.ctx.G) { const rest = W.ctx.G.slots.filter((s) => !s.used).length; if (rest >= 2) set.add(rest); }
    const ch = W.ctx.S.cats; if (ch.length) { set.add(ch.reduce((s, c) => s + tot[c], 0)); set.add(ch.reduce((s, c) => s + left[c], 0)); }
    const can = [...set].filter((n) => n >= 2 && n !== 200 && n !== 400 && n !== 600);
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
        if (!st) for (const c of can) if (s.indexOf(arD(c)) > -1 || new RegExp('(^|[^0-9])' + c + '([^0-9]|$)').test(s)) f.push(label + ' #' + (id || el.localName) + ' canary ' + c + ': ' + s.trim().slice(0, 60));
        if (st) for (const c of can.filter((x) => x >= 13 && x !== 36)) if (new RegExp('(^|[^0-9' + AD + '])' + arD(c) + '([^0-9' + AD + ']|$)').test(s)) f.push(label + ' #' + (id || el.localName) + ' state canary ' + c + ': ' + s.trim().slice(0, 60));
        if (st && /(^|[^0-9٠-٩])(36|٣٦)([^0-9٠-٩]|$)/.test(s) && id !== 'rankBody' && id !== 'teams') f.push(label + ' #' + (id || el.localName) + ' the slot count: ' + s.trim().slice(0, 60));
      }
      el.childNodes.forEach((n) => walk(n, st));
    };
    walk(W.doc.documentElement, false);
  }
  const store = Store();
  const W = open(src, store); scan(W, 'cfg-default');
  W.tap(W.doc.querySelector('[data-q="rnd"]'), 'rnd'); scan(W, 'cfg-random');
  W.tap(W.doc.querySelector('.kzc-gh[data-g="2"]'), 'g'); scan(W, 'cfg-group-open');
  W.tap(W.$('addTeam'), 'add'); W.tap(W.$('addTeam'), 'add'); scan(W, 'cfg-four-teams');
  start(W); scan(W, 'board');
  openSlot(W, 5); scan(W, 'question');
  W.tap(W.$('backBtn'), 'back'); scan(W, 'after-back');
  openSlot(W, 5); reveal(W); scan(W, 'revealed'); give(W, 2); scan(W, 'after-award');
  for (let i = 0; i < 20; i++) turn(W, null);
  scan(W, 'mid-game');
  W.tap(W.$('quit'), 'q'); scan(W, 'quit-armed'); W.tap(W.$('quit'), 'q'); scan(W, 'end-quit');
  const V = open(src, store); setup(V, { teams: ['A', 'B'], cats: 'rnd' }); start(V); playOut(V, null, 0); scan(V, 'end-full');
  // a short category on the setup
  const X = open(src, Store()); DATA0.qs.forEach((q, i) => { if (q[0] === 2) X.ctx.seenMark(i); });
  setup(X, { teams: ['A', 'B'], cats: [2, 5, 9, 14, 20, 30] }); scan(X, 'cfg-short');
  if (!X.$('startBtn').disabled) f.push('a drained category did not refuse the start');
  const errs = [W, V, X].flatMap((x) => errsOf(x).concat(x.fails));
  return { f: f.concat(errs), info: 'states=' + states + ' strings=' + strings + ' leaks=' + f.length };
}
function checkB8(pageText) {
  const f = [];
  const script = pageText.slice(pageText.lastIndexOf('<script>'));
  const bad = [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /EventSource/, /["'`]\/api\//, /navigator\.(geolocation|mediaDevices)/, /\bimport\s*\(/, /\bnew\s+Image\b/, /\.src\s*=/];
  bad.forEach((re) => { if (re.test(script)) f.push('the script reaches out: ' + re); });
  if (/\baction=/.test(pageText) || /<form\b/.test(pageText) || /<img\b/.test(pageText)) f.push('a form or an image on the page');
  const srcs = [...pageText.matchAll(/<script\b[^>]*\bsrc="([^"]*)"/g)].map((m) => m[1]);
  // KUNUZ-LEVELS-POETRY (2026-10-19, C): the owner's experimental levels add exactly one more script, the shared module, after
  // the page's own; it reaches nothing but its own data file (kunuzlevels L4/L5 hold what it does and that it can be switched off)
  // Visual engine: four fixed same-origin assets; kunuzvisual checks their loaders and switch.
  if (srcs.join(',') !== '/quest-theme/motion-kit.js?v=20261021-room1,/quest-theme/icons.js?v=20261021-room1,/quest-theme/model.js?v=20261021-room1,/iap-pending.js?v=2,/hanna-laha/assets/iap-bridge-v1.js?v=20261022-iapfree3,/quest-theme/board-rooms.js?v=20261022-iapfree3,/quest-theme/journey.js?v=20261022-iapfree3,/quest-data/kunuz-bank-3147.js,/quest-data/kunuz-geo-index.js,/quest-data/kunuz-packs-manifest.js?v=20261021-room1,/quest-visual.js,/quest-levels.js') f.push('scripts loaded: ' + srcs.join(','));
  { const mod = fs.readFileSync(path.join(REPO, 'quest-levels.js'), 'utf8'); bad.forEach((re) => { if (re.test(mod.replace('s.src="/quest-data/kunuz-levels-3147.js";', ''))) f.push('the levels module reaches out: ' + re); });
    if ((mod.match(/\.src="([^"]*)"/g) || []).join() !== '.src="/quest-data/kunuz-levels-3147.js"') f.push('the levels module loads something else than its file'); }
  if (!/<html lang="ar" dir="rtl">/.test(pageText)) f.push('not declared Arabic right to left');
  if (pageText.indexOf(['ezik', 'ui', 'lang', 'v1'].join('_')) > -1) f.push('writes the app language slot');   // assembled: i18nui holds the literal to three files
  if (!/<a\b[^>]*href="\/quest\.html"/.test(pageText) || !/<a\b[^>]*href="\/"/.test(pageText)) f.push('no way back to /quest.html and home /');
  const A = '[اأإآ]', cp = (...c) => String.fromCharCode(...c);
  const israel = new RegExp(A + cp(0x633, 0x631, 0x627, 0x626, 0x64A, 0x644) + '|' + cp(0x635, 0x647, 0x64A, 0x648, 0x646) + '|israel', 'i');
  if (israel.test(pageText)) f.push('the page names the entity');
  // the name is ONE constant
  const nm = (/var GAME_NAME="([^"]*)";/.exec(pageText) || [])[1];
  if (!nm || pageText.split(nm).length !== 2) f.push('the game name is not written once, in GAME_NAME');
  // no difficulty, no level, no age -- in the page itself. The owner's experimental levels (2026-10-19) live in quest-levels.js;
  // the page carries only the tag that loads it and hooks that ask typeof KZL (kunuzlevels holds them)
  if (/(level|difficulty|age_?group|مستوى|صعوبة)/i.test(pageText.replace(/\/\*[\s\S]*?\*\//g, '').replace('<script src="/quest-levels.js"></script>', ''))) f.push('a level or difficulty outside comments');
  const quest = fs.readFileSync(path.join(REPO, 'quest.html'), 'utf8');
  const card = quest.match(/<a class="door" href="\/quest-board\.html"><b>([^<]*)<\/b>\s*<span>([^<]*)<\/span><\/a>/);
  if (!card) f.push('quest.html has no card for /quest-board.html in the shape of the others');
  else { if (card[1] !== nm) f.push('card title is not the game name'); if (/[0-9٠-٩]/.test(card[2])) f.push('a digit in the card text'); }
  return { f, info: 'scripts=' + srcs.length + ' card=' + (card ? 1 : 0) };
}
function checkB9(src) {
  const f = [];
  const W = open(src); const C = W.ctx;
  if (!C.ICONS || C.ICONS.length !== 9) return { f: ['nine icons expected'].concat(errsOf(W)), info: '' };
  if (new Set(C.ICONS).size !== 9) f.push('two icons alike');
  C.ICONS.forEach((s, i) => {
    const tags = [...s.matchAll(/<([a-zA-Z]+)/g)].map((m) => m[1]);
    if (tags.some((t) => t !== 'path' && t !== 'circle')) f.push('icon ' + i + ' holds ' + tags.join(','));
    if (/fill="(?!none)|<image|href|<text|url\(/.test(s)) f.push('icon ' + i + ' is not a plain stroke drawing');
  });
  const svg = C.iconSvg(0);
  if (!/fill="none"/.test(svg) || !/stroke="currentColor"/.test(svg) || !/aria-hidden="true"/.test(svg)) f.push('the icon frame is not stroke-only');
  C.KZC_GROUPS.forEach((g, k) => g[2].forEach((slug) => { const i = DATA0.cats.findIndex((c) => c[0] === slug); if (i > -1 && C.iconOf(i) !== k) f.push(slug + ' has the icon of another group'); }));
  const loose = DATA0.cats.map((c, i) => i).filter((i) => !C.KZC_GROUPS.some((g) => g[2].indexOf(DATA0.cats[i][0]) > -1));
  loose.forEach((i) => { if (C.iconOf(i) !== 8) f.push('ungrouped ' + DATA0.cats[i][0] + ' lacks the general icon'); });
  C.DATA.cats.push(['future-cat', 'x', 'secular']);
  if (C.iconOf(C.DATA.cats.length - 1) !== 8) f.push('a future category does not take the general icon');
  C.DATA.cats.pop();
  return { f: f.concat(errsOf(W)), info: 'icons=9 ungrouped=' + loose.length };
}
function checkB10(pageText) {
  const f = [];
  const css = fs.readFileSync(path.join(REPO, 'quest-theme/theme.css'), 'utf8');
  const has = (re, m) => { if (!re.test(css)) f.push(m); };
  has(/\.j-board-grid\{display:grid;grid-template-columns:minmax\(0,1fr\)/, 'one board column on phones');
  has(/@media\(min-width:620px\).*\.j-board-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, 'two board columns on wide screens');
  has(/\.j-board-category\{[^}]*grid-template-columns:64px minmax\(0,1fr\) 64px[^}]*direction:ltr/, 'two point columns around the category');
  has(/\.j-category-middle\{direction:rtl/, 'the name right to left');
  has(/\.j-point\.j-used\{[^}]*opacity:[^}]*dashed/, 'played tiles dimmed and marked');
  has(/\.journey-app\[data-game=board\]\{background:radial-gradient\(ellipse at 50% 0,#69534a,#272b37 70%\)/, 'the reference board gradient');
  has(/\.ezik-treasure-theme\{[^}]*overflow-x:hidden/, 'no horizontal scroll');
  has(/\.j-point\{min-height:44px;min-width:44px/, 'point tiles at least 44 by 44');
  has(/\.j-btn\{min-height:52px/, 'primary touch targets');
  if (!pageText.includes('href="/quest-theme/theme.css?v=20261022-board1"')) f.push('scoped theme stylesheet not loaded');
  return { f, info: 'rules ok=' + (f.length ? 0 : 1) };
}

const PAGE_TEXT = fs.readFileSync(PAGE, 'utf8');
const SRC = srcOf(PAGE_TEXT);
console.log('FILE ' + ascii(path.relative(REPO, PAGE)) + ' bytes=' + Buffer.byteLength(PAGE_TEXT) + ' qs=' + N + ' cats=' + DATA0.cats.length + ' SEED ' + SEED);
const run = (id, name, fn, x) => { let r; try { r = fn(x); } catch (e) { r = { f: ['THROWN ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')], info: '' }; } report(id, name, r.f, r.info); return r; };
run('B1', 'the seen record, the eight groups and the picker are copies, byte for byte, of the dive and the war', checkB1, PAGE_TEXT);
run('B2', 'engine: six categories exactly, six slots each, turn for 2/3/4, points, back, draws, no repeat, rank, tie, random', checkB2, SRC);
run('B3', 'setup: exactly six, random, clear, whole group, 2..4 teams, colours, the name constant', checkB3, SRC);
run('B4', 'the board: cards, columns, icon, turn pill, team bar, question window, back, reveal, award, used slot', checkB4, SRC);
run('B5', 'whole games with 2, 3, 4 teams, the named tie, quit in two taps, new game', checkB5, SRC);
run('B6', 'no repeat: games and Ghaws dives on one record until small categories run short', checkB6, SRC);
run('B7', 'no number about the questions on any screen', checkB7, SRC);
run('B8', 'nothing leaves the device; Arabic; the way back; the entity rule; one name; no level; the card', checkB8, PAGE_TEXT);
run('B9', 'icons: stroke drawings, one per group and a general one', checkB9, SRC);
run('B10', 'scoped reference gradient, phone/wide grid, two point columns, 44px tiles', checkB10, PAGE_TEXT);

// ---------- B11: the gate bites ----------
{
  const mut = (name, from, to, check, viaSrc) => {
    if (PAGE_TEXT.split(from).length !== 2) return name + ' (seam moved)';
    const t = PAGE_TEXT.replace(from, () => to);
    let r; try { r = check(viaSrc ? srcOf(t) : t); } catch (e) { r = { f: ['thrown'] }; }
    return r.f.length ? null : name;
  };
  const missed = [
    mut('a turn that does not move', 'g.cur=null;g.turn=(g.turn+1)%g.teams.length;return true;', 'g.cur=null;return true;', checkB2, true),
    mut('points always to the team in turn', 'if(sl.by>=0)g.teams[t].score+=sl.pts;', 'if(sl.by>=0)g.teams[g.turn].score+=sl.pts;', checkB2, true),
    mut('five categories are enough', 'if(!c||c.length!==CATS)return null;', 'if(!c||c.length<5)return null;', checkB2, true),
    mut('a back that advances the turn', 'function back(g){if(!g.cur)return false;g.cur=null;return true}', 'function back(g){if(!g.cur)return false;g.cur=null;g.turn=(g.turn+1)%g.teams.length;return true}', checkB2, true),
    mut('a question chosen by the points', 'var k=a[Math.floor(rnd()*a.length)];', 'var k=a[Math.min(a.length-1,Math.floor(rnd()*a.length*sl.pts/600))];', checkB2, true),
    mut('the record ignored', '(seen(i)?b:a).push(i);', 'a.push(i);', checkB6, true),
    mut('a shown question not marked', '  seenMark(k);   /*', '  /*', checkB4, true),
    mut('seen record one byte off', 'var SEEN_KEY="kunuz_seen_v1";', 'var SEEN_KEY="kunuz_seen_v1" ;', checkB1, false),
    mut('a fetch on the page', 'openCfg();\n</script>', 'openCfg();try{fetch("/api/x")}catch(e){}\n</script>', checkB8, false),
    mut('a slot count on the board', 'tn.textContent="دور "+teamLabel(t.n)+": اختاروا النقاط";', 'tn.textContent="دور "+teamLabel(t.n)+": اختاروا النقاط · باقي "+ar(G.slots.filter(function(x){return !x.used}).length)+" خانة";', checkB7, true),
    mut('the tie not named', '(r.tie?"تعادل بين "+names.join(" و"):', '(r.tie?"تعادل":', checkB5, true),
    mut('quit in one tap', 'if($("quit").dataset.arm!=="1"){arm(true);return}', '', checkB5, true),
    // KUNUZ-QA-DECISIONS (2026-10-19): a count a screen reader alone would hear is a count on the screen
    mut('a question count read only by a screen reader', '<p class="lbl">الفئات</p><p class="sub">ست فئات', '<p class="lbl">الفئات</p><p class="sub" title="' + N + ' سؤال">ست فئات', checkB7, true),
    mut('a living icon', '<circle cx="12" cy="12" r="9"/>', '<image href="x.png"/>', checkB9, true),
  ].filter(Boolean);
  report('B11', 'the gate bites: fourteen mutants of the page are each caught', missed.map((m) => 'MUTANT SURVIVED: ' + m), 'mutants=14 missed=' + missed.length);
}

const bad = results.filter((r) => !r.ok);
console.log('SUMMARY ' + (results.length - bad.length) + '/' + results.length + ' pass' + (bad.length ? ' FAILED: ' + bad.map((r) => r.id).join(',') : ''));
process.exit(bad.length ? 1 : 0);
