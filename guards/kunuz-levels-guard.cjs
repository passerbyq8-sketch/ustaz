// kunuz-levels-guard.cjs -- the experimental question levels of the Kunuz games (order KUNUZ-LEVELS-POETRY-ORDER-2026-10-19, C).
// ASCII output only. usage: node guards/kunuz-levels-guard.cjs
//
// The owner's one exception to "one level": an optional «المستوى» field marked «تجريبي» at the start of each of the four games,
// removable in one line (LEVELS_EXPERIMENT in quest-levels.js) without a trace. The pages are run as they ship, in the mini DOM
// of guards/kunuz-sim, with the module and its file loaded the way a browser loads them.
//   L1 the file: a level 1..3 for every live id and for nothing else, its stamp the bank's (the pages' seenStamp), and inside
//      each category the levels are its thirds, so every category holds all three, at least MIN_EACH of each (the board needs
//      two of each level per category, plus room to fall back)
//   L2 the field: in each of the four setups «المستوى» with «تجريبي» beside it, the choices كلّ المستويات/سهل/متوسط/صعب (the
//      board: عشوائي/حسب النقاط), the first on by default, 44px chips, and nothing readable that counts questions
//   L3 drawing: a game at each level draws only that level (dive, war, test, board), «حسب النقاط» draws the slot's level
//      (200 easy, 400 medium, 600 hard), and «كلّ المستويات» draws exactly what the page draws without the module (same seed)
//   L4 off: LEVELS_EXPERIMENT=false requests no file, leaves the slot empty and no «المستوى»/«تجريبي» anywhere, and draws exactly
//      what the page draws without the module; a short, foreign-stamped or missing file hides the field with no page error;
//      the experiment writes no storage key
//   L5 one line: LEVELS_EXPERIMENT appears once (quest-levels.js), each game loads the module once, after its own script
//   L6 the gate bites: a field with no «تجريبي», a level that draws another level, an off switch that leaves the field, a short
//      file that still shows the field, and a by-points board that ignores the slot are each caught
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const { VER, El, Txt, parseInto } = require('./kunuz-sim/dom.cjs');
const { readable } = require('./kunuz-sim/readable.cjs');
const REPO = path.join(__dirname, '..');
const ascii = (s) => String(s).replace(/[^\x00-\x7f]/g, '?');
const read = (f) => fs.readFileSync(path.join(REPO, f), 'utf8');
const GAMES = ['quest-ghaws.html', 'quest-harb.html', 'quest-test.html', 'quest-board.html'];
const MODULE = 'quest-levels.js', LVFILE = 'quest-data/kunuz-levels-3147.js', BANK = 'quest-data/kunuz-bank-3147.js';
const MIN_EACH = 3;
const TEXT = {}; GAMES.concat([MODULE, LVFILE]).forEach((f) => { TEXT[f] = read(f); });
const DATA0 = new Function(read(BANK) + ';return DATA;')();
const LV0 = new Function(TEXT[LVFILE] + ';return KUNUZ_LEVELS;')();
const W_ = String.fromCharCode;
// the Arabic this gate looks for, by code point (the file stays ASCII)
const AR = {
  field: W_(0x627, 0x644, 0x645, 0x633, 0x62a, 0x648, 0x649),                                        // المستوى
  exp: W_(0x62a, 0x62c, 0x631, 0x64a, 0x628, 0x64a),                                                  // تجريبي
  all: W_(0x643, 0x644, 0x651, 0x20, 0x627, 0x644, 0x645, 0x633, 0x62a, 0x648, 0x64a, 0x627, 0x62a),    // كلّ المستويات
  easy: W_(0x633, 0x647, 0x644), mid: W_(0x645, 0x62a, 0x648, 0x633, 0x637), hard: W_(0x635, 0x639, 0x628),
  rnd: W_(0x639, 0x634, 0x648, 0x627, 0x626, 0x64a), pts: W_(0x62d, 0x633, 0x628, 0x20, 0x627, 0x644, 0x646, 0x642, 0x627, 0x637),
};

const results = [];
function report(id, name, fails, info) {
  results.push({ id, ok: !fails.length });
  console.log((fails.length ? 'FAIL ' : 'PASS ') + id + ' ' + name + (info ? ' :: ' + ascii(info) : ''));
  fails.slice(0, 10).forEach((m) => console.log('   - ' + ascii(m)));
}

// ---------- the world (the shared mini DOM), the page's script, then the module the way the page loads it ----------
const G_SRC = fs.readFileSync(path.join(__dirname, 'kunuz-sim', 'world.cjs'), 'utf8');
const wa = G_SRC.indexOf('// ---------- world ----------'), wb = G_SRC.indexOf('// ---------- synthetic bank');
let WORLD = G_SRC.slice(wa, wb);
if (wa < 0 || wb < 0 || WORLD.split('DATA, Math: M,').length !== 2) throw new Error('kunuz-sim world section not as expected');
WORLD = WORLD.replace('DATA, Math: M,', 'DATA, localStorage: o.storage, Math: M,').replace(/\bM\.random = R\b/, 'M.random = getR()');
function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let RND = prng(11);
const makeWorld = new Function('fs', 'vm', 'VER', 'El', 'Txt', 'parseInto', 'getR', WORLD + '\nreturn makeWorld;')(fs, vm, VER, El, Txt, parseInto, () => RND);
function Store() { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; }
function srcOf(t) {
  const sa = t.lastIndexOf('<script>'), sb = t.indexOf('</script>', sa), bs = t.indexOf('<body>') + 6, be = t.indexOf('<script', bs);
  return { DATA: JSON.parse(JSON.stringify(DATA0)), ENGINE: t.slice(sa + 8, sb), BODY: t.slice(bs, be) };
}
const SCREENS = {
  'quest-ghaws.html': ['home', 'how', 'cfg', 'turn', 'dive', 'end', 'board', 'verdict'],
  'quest-harb.html': ['home', 'how', 'cfg', 'room', 'join', 'lobby', 'war', 'win', 'verdict'],
  'quest-test.html': ['cfg', 'play', 'end'], 'quest-board.html': ['cfg', 'play', 'end'],
};
// mode: 'none' (the page with no module: as it was), 'on', 'off' (the switch false), 'short'/'foreign'/'missing' (a bad file)
function open(T, page, mode, seed) {
  RND = prng(seed || 11);
  const store = Store(), src = srcOf(T[page]);
  const W = makeWorld(src, src.DATA, SCREENS[page], { reduce: true, storage: store });
  W.store = store; W.requested = [];
  if (mode !== 'none') {
    let mod = T[MODULE];
    if (mode === 'off') mod = mod.replace('var LEVELS_EXPERIMENT=true;', 'var LEVELS_EXPERIMENT=false;');
    try { vm.runInContext(mod, W.ctx, { filename: MODULE }); } catch (e) { W.errors.push(e); }
    // the module asked for its file: find the <script> it appended and play the network
    const tags = W.doc.querySelectorAll('script').filter((s) => s.src);
    tags.forEach((s) => W.requested.push(s.src));
    const tag = tags.find((s) => s.src === '/' + LVFILE);
    if (tag) {
      let lv = T[LVFILE];
      if (mode === 'short') { const L = JSON.parse(JSON.stringify(LV0)); delete L.levels[Object.keys(L.levels)[5]]; lv = 'var KUNUZ_LEVELS=' + JSON.stringify(L) + ';'; }
      if (mode === 'foreign') { const L = JSON.parse(JSON.stringify(LV0)); L.stamp = '1-00000000'; lv = 'var KUNUZ_LEVELS=' + JSON.stringify(L) + ';'; }
      if (mode === 'missing') { try { if (tag.onerror) tag.onerror(); } catch (e) { W.errors.push(e); } }
      else { try { vm.runInContext(lv, W.ctx, { filename: LVFILE }); if (tag.onload) tag.onload(); } catch (e) { W.errors.push(e); } }
    }
  }
  return W;
}
const errs = (W, tag) => W.fails.concat(W.errors.map((e) => tag + ' page error: ' + String(e && e.message || e).slice(0, 90)));
const shownAll = (W, sel) => W.doc.querySelectorAll(sel).filter((e) => W.shown(e));
const lvOf = (i) => LV0.levels[DATA0.qs[i][8]];
const lvChip = (W, text) => shownAll(W, '#lvSlot .kzl-chip').find((b) => b.textContent === text);
function setLevel(W, text, f, tag) { const b = lvChip(W, text); if (!b) { f.push(tag + ' no level chip ' + ascii(text)); return false; } W.tap(b, 'level ' + text); return true; }
const LEVEL_TEXT = { 1: AR.easy, 2: AR.mid, 3: AR.hard };
function allText(W) { const out = []; (function walk(n) { if (n.nodeType === 3) out.push(n.nodeValue); else if (n.nodeType === 1) { if (n.localName === 'script' || n.localName === 'style') return; readable(n, '').forEach((s) => out.push(s)); n.childNodes.forEach(walk); } })(W.doc.body); return out.join(' | '); }

// ---------- per game: go to the setup, and play one round of drawing at the current level ----------
const tapCatGroupAnd = (W, c) => { const all = {}; W.$('cats').querySelectorAll('[data-cat]').forEach((b) => { all[+b.dataset.cat] = b; }); let b = all[c]; if (b && !W.shown(b)) { W.tap(b.parentNode.parentNode.querySelector('.kzc-gh'), 'group'); W.$('cats').querySelectorAll('[data-cat]').forEach((x) => { all[+x.dataset.cat] = x; }); b = all[c]; } return W.tap(b, 'cat ' + c); };
const CATS6 = [0, 10, 17, 24, 25, 27];
const SETUP = {
  'quest-ghaws.html': (W) => { W.tap(W.doc.querySelector('[data-go="cfg1"]'), 'solo'); },
  'quest-harb.html': (W) => { W.tap(W.doc.querySelector('#home [data-go="cfg"]'), 'cfg'); },
  'quest-test.html': () => {}, 'quest-board.html': () => {},
};
const pickCats = (W, page) => {
  W.tap(W.doc.querySelector('[data-q="none"]'), 'none');
  const want = page === 'quest-test.html' ? [0, 10, 27] : page === 'quest-board.html' ? CATS6 : [0, 10, 27, 28];
  want.forEach((c) => tapCatGroupAnd(W, c));
};
// the indices a game draws, read straight from the page's own state as it plays
function draw(W, page, n) {
  const C = W.ctx, got = [];
  if (page === 'quest-ghaws.html') {
    C.S.cap = n; C.S.breath = 0; C.S.noOpts = false; if (W.$('goDive').disabled) return { got, blocked: true };
    W.tap(W.$('goDive'), 'goDive');
    for (let g = 0; g < n && W.screen() === 'dive'; g++) {
      const sh = W.doc.querySelectorAll('#shells .shell').filter((e) => W.shown(e) && !e.disabled); if (!sh.length) break;
      W.tap(sh[0], 'shell'); const q = C.S.cur; if (!q) break; got.push(C.DATA.qs.indexOf(q));
      W.tap(W.doc.querySelectorAll('#opts button.opt').find((b) => +b.dataset.k === q[5]), 'right'); W.advance(2600);
    }
  } else if (page === 'quest-harb.html') {
    if (W.$('startWar').disabled) return { got, blocked: true };
    W.tap(W.$('startWar'), 'start');
    for (let g = 0; g < n; g++) { const ci = C.G.cats[g % C.G.cats.length]; const q = C.pickQ(ci); if (!q) continue; got.push(C.DATA.qs.indexOf(q)); }
  } else if (page === 'quest-test.html') {
    C.S.total = n; if (W.$('startBtn').disabled) return { got, blocked: true };
    W.tap(W.$('startBtn'), 'start');
    for (let g = 0; g < n; g++) { const k = C.TE.pick(C.G, -1, C.seenHas); if (k < 0) break; got.push(k); C.seenMark(k); }
  } else {
    if (W.$('startBtn').disabled) return { got, blocked: true };
    W.tap(W.$('startBtn'), 'start');
    for (let s = 0; s < C.G.slots.length && got.length < n; s++) { const k = C.BE.open(C.G, s, C.seenHas, C.Math.random); if (k < 0) continue; got.push({ k, pts: C.G.slots[s].pts }); C.BE.award(C.G, -1); }
  }
  return { got, blocked: false };
}

// ---------- L1 the file ----------
function checkL1(LV, D) {
  const f = [];
  // the pages' own stamp formula (count + FNV-1a of the ids in order)
  let h = 2166136261; for (const q of D.qs) { const t = String(q.length > 8 ? q[8] : q[3]) + '\n'; for (let j = 0; j < t.length; j++) h = Math.imul(h ^ t.charCodeAt(j), 16777619) >>> 0; }
  const stamp = D.qs.length + '-' + ('0000000' + h.toString(16)).slice(-8);
  if (!LV || LV.stamp !== stamp) f.push('the file is stamped ' + (LV && LV.stamp) + ', the bank is ' + stamp);
  const L = (LV && LV.levels) || {}, live = new Set();
  D.qs.forEach((q) => { if (q[2] !== 0) live.add(q[8]); });
  let bad = 0, extra = 0, missing = 0;
  for (const id of Object.keys(L)) { if (!live.has(id)) extra++; else if ([1, 2, 3].indexOf(L[id]) < 0) bad++; }
  for (const id of live) if (!(id in L)) missing++;
  if (bad || extra || missing) f.push('levels: ' + bad + ' out of 1..3, ' + extra + ' for no live question, ' + missing + ' live questions without one');
  let minEach = 1e9, thirdsOff = 0;
  D.cats.forEach((c, ci) => {
    const ids = D.qs.filter((q) => q[0] === ci && q[2] !== 0).map((q) => q[8]), n = ids.length;
    const cnt = [1, 2, 3].map((l) => ids.filter((id) => L[id] === l).length);
    minEach = Math.min(minEach, ...cnt);
    const want = [Math.round(n / 3), Math.round(2 * n / 3) - Math.round(n / 3), n - Math.round(2 * n / 3)];
    if (cnt.join() !== want.join()) { thirdsOff++; f.push('category ' + c[0] + ' levels ' + cnt.join('/') + ', its thirds are ' + want.join('/')); }
  });
  if (minEach < MIN_EACH) f.push('a category holds only ' + minEach + ' of a level (needs ' + MIN_EACH + ')');
  return { f, info: 'stamp=' + stamp + ' live=' + live.size + ' minEachLevelPerCategory=' + minEach };
}
{ const r = checkL1(LV0, DATA0); report('L1', 'the file: a level for every live question, the bank\'s stamp, each category in thirds', r.f, r.info); }

// ---------- L2 the field in the four games ----------
function checkL2(T) {
  const f = []; let fields = 0;
  for (const page of GAMES) {
    const W = open(T, page, 'on'); SETUP[page](W);
    const slot = W.$('lvSlot');
    if (!slot) { f.push(page + ' has no #lvSlot'); continue; }
    if (!W.shown(slot)) { f.push(page + ' the level field is hidden in the setup'); continue; }
    const lbl = slot.querySelector('.lbl'), txt = lbl ? lbl.textContent : '';
    if (txt.indexOf(AR.field) < 0) f.push(page + ' the field is not named ' + ascii(AR.field));
    const badge = slot.querySelector('.kzl-exp');
    if (!badge || badge.textContent !== AR.exp || badge.parentNode !== lbl) f.push(page + ' no ' + ascii(AR.exp) + ' badge beside the name');
    const chips = slot.querySelectorAll('.kzl-chip').map((b) => b.textContent);
    const want = page === 'quest-board.html' ? [AR.rnd, AR.pts] : [AR.all, AR.easy, AR.mid, AR.hard];
    if (chips.join('|') !== want.join('|')) f.push(page + ' the choices are ' + ascii(chips.join('|')));
    const on = slot.querySelectorAll('.kzl-chip.on').map((b) => b.textContent);
    if (on.join() !== want[0]) f.push(page + ' the default is not ' + ascii(want[0]));
    if (!/\.kzl-chip\{min-height:44px;min-width:44px;/.test(T[MODULE])) f.push('the chips are under 44px');
    // nothing readable about a count of questions, in the field or anywhere in the setup
    const all = readable(slot, slot.textContent).join(' ');
    if (/[0-9\u0660-\u0669]/.test(all)) f.push(page + ' the field carries a number: ' + ascii(all.slice(0, 60)));
    if (!/role="group"|setAttribute\("role","group"\)/.test(T[MODULE])) f.push('the chips are not a labelled group');
    f.push(...errs(W, page));
    fields++;
  }
  return { f, info: 'fields=' + fields };
}
{ const r = checkL2(TEXT); report('L2', 'the field: «level» with «experimental» in all four games, its choices, the default', r.f, r.info); }

// ---------- L3 drawing ----------
function checkL3(T) {
  const f = []; const rows = [];
  for (const page of GAMES) {
    // «كلّ المستويات» (and the board's «عشوائي») draws exactly what the page draws without the module
    const A = open(T, page, 'none', 21); SETUP[page](A); pickCats(A, page); const a = draw(A, page, 12);
    const B = open(T, page, 'on', 21); SETUP[page](B); pickCats(B, page); const b = draw(B, page, 12);
    if (JSON.stringify(a.got) !== JSON.stringify(b.got) || !a.got.length) f.push(page + ' all levels draws differently from the page without the module');
    f.push(...errs(A, page), ...errs(B, page));
    if (page !== 'quest-board.html') {
      for (const l of [1, 2, 3]) {
        const W = open(T, page, 'on', 30 + l); SETUP[page](W); pickCats(W, page);
        if (!setLevel(W, LEVEL_TEXT[l], f, page)) continue;
        const r = draw(W, page, 12);
        const wrong = r.got.filter((k) => lvOf(k) !== l);
        if (r.blocked || !r.got.length) f.push(page + ' level ' + l + ' drew nothing');
        if (wrong.length) f.push(page + ' level ' + l + ' drew ' + wrong.length + ' of another level');
        rows.push(page.slice(6, 10) + l + '=' + r.got.length);
        f.push(...errs(W, page));
      }
    } else {
      const W = open(T, page, 'on', 41); SETUP[page](W);
      if (setLevel(W, AR.pts, f, page)) {
        pickCats(W, page); const r = draw(W, page, 36);
        const want = { 200: 1, 400: 2, 600: 3 };
        const wrong = r.got.filter((x) => lvOf(x.k) !== want[x.pts]);
        if (r.blocked || r.got.length < 36) f.push('board by points drew ' + r.got.length + ' of 36');
        if (wrong.length) f.push('board by points: ' + wrong.length + ' slots drew another level than their points');
        rows.push('board=' + r.got.length);
      }
      f.push(...errs(W, page));
    }
  }
  // a level spent in the chosen categories: the setup says so in words (no number) and the game does not start
  const NOT_ENOUGH = W_(0x641, 0x64a, 0x20, 0x641, 0x626, 0x627, 0x62a, 0x643, 0x645, 0x20, 0x644, 0x627, 0x20, 0x64a, 0x643, 0x641, 0x64a);   // in your categories is not enough
  const DIGIT = new RegExp('[0-9' + W_(0x660) + '-' + W_(0x669) + ']');
  for (const page of ['quest-ghaws.html', 'quest-harb.html', 'quest-test.html']) {
    const W = open(T, page, 'on', 61); SETUP[page](W); pickCats(W, page);
    const C = W.ctx, cats = page === 'quest-harb.html' ? C.G.cats : C.S.cats;
    for (let i = 0; i < C.DATA.qs.length; i++) if (cats.indexOf(C.DATA.qs[i][0]) > -1 && lvOf(i) === 3) C.SEEN.bits[i >> 3] |= 1 << (i & 7);
    C.seenWrite();
    if (!setLevel(W, AR.hard, f, page)) continue;
    const tally = (W.$('catTally') || W.$('tally')).textContent, start = W.$('goDive') || W.$('startWar') || W.$('startBtn');
    if (tally.indexOf(NOT_ENOUGH) < 0 || tally.indexOf(AR.hard) < 0 || DIGIT.test(tally)) f.push(page + ' a spent level is not said in words: ' + ascii(tally.slice(0, 60)));
    if (!start.disabled) f.push(page + ' a spent level still starts');
    rows.push(page.slice(6, 10) + 'Spent=said');
    f.push(...errs(W, page));
  }
  {
    const W = open(T, 'quest-board.html', 'on', 62); SETUP['quest-board.html'](W); setLevel(W, AR.pts, f, 'board'); pickCats(W, 'quest-board.html');
    const C = W.ctx; for (let i = 0; i < C.DATA.qs.length; i++) if (C.DATA.qs[i][0] === CATS6[0] && lvOf(i) === 3) C.SEEN.bits[i >> 3] |= 1 << (i & 7);
    C.seenWrite(); C.tally();
    const t = W.$('tally').textContent;
    if (!W.$('startBtn').disabled || t.indexOf(AR.pts) < 0 || DIGIT.test(t)) f.push('board: a category short of one level under by points still starts or is not said in words: ' + ascii(t.slice(0, 60)));
    f.push(...errs(W, 'board'));
  }
  return { f, info: rows.join(' ') };
}
{ const r = checkL3(TEXT); report('L3', 'each level draws only its level; by points draws the slot\'s level; all levels draws as before', r.f, r.info); }

// ---------- L4 off, and a bad file ----------
function checkL4(T) {
  const f = []; const rows = [];
  for (const page of GAMES) {
    const O = open(T, page, 'off', 51); SETUP[page](O);
    if (O.requested.length) f.push(page + ' off still requests ' + O.requested.join(','));
    const slot = O.$('lvSlot');
    if (slot && slot.childNodes.length) f.push(page + ' off leaves something in the slot');
    const txt = allText(O);
    if (txt.indexOf(AR.exp) > -1 || txt.indexOf(AR.field) > -1) f.push(page + ' off still shows the field words');
    pickCats(O, page); const o = draw(O, page, 12);
    const N = open(T, page, 'none', 51); SETUP[page](N); pickCats(N, page); const n = draw(N, page, 12);
    if (JSON.stringify(o.got) !== JSON.stringify(n.got) || !n.got.length) f.push(page + ' off draws differently from the page as it was');
    const keysO = [...O.store.m.keys()].sort().join(), keysN = [...N.store.m.keys()].sort().join();
    if (keysO !== keysN) f.push(page + ' the experiment changed the stored keys: ' + keysO + ' / ' + keysN);
    f.push(...errs(O, page), ...errs(N, page));
    for (const bad of ['short', 'foreign', 'missing']) {
      const B = open(T, page, bad, 52); SETUP[page](B);
      const s = B.$('lvSlot');
      if (s && s.childNodes.length) f.push(page + ' a ' + bad + ' file still shows the field');
      f.push(...errs(B, page + ' ' + bad));
    }
    rows.push(page.slice(6, 10) + ':' + n.got.length);
  }
  return { f, info: 'offEqualsAsWas ' + rows.join(' ') };
}
{ const r = checkL4(TEXT); report('L4', 'off: no file, no field, the same draws, no new key; a bad file hides the field', r.f, r.info); }

// ---------- L5 one line ----------
function checkL5(T) {
  const f = [];
  const all = GAMES.concat([MODULE]).map((x) => T[x]).join('\n');
  if (all.split('LEVELS_EXPERIMENT=').length - 1 !== 1 || T[MODULE].indexOf('var LEVELS_EXPERIMENT=true;') < 0) f.push('LEVELS_EXPERIMENT is not one line in quest-levels.js');
  for (const page of GAMES) {
    const t = T[page], tag = '<script src="/' + MODULE + '"></script>';
    if (t.split(tag).length !== 2) f.push(page + ' does not load the module exactly once');
    else if (t.indexOf(tag) < t.lastIndexOf('<script>')) f.push(page + ' loads the module before its own script');
    const hooks = (t.match(/KZL\./g) || []).length, guarded = (t.match(/typeof KZL/g) || []).length;
    if (!hooks || !guarded) f.push(page + ' has no guarded hook');
  }
  return { f, info: 'switch=1' };
}
{ const r = checkL5(TEXT); report('L5', 'one switch; each game loads the module once, after its own script', r.f, r.info); }

// ---------- L6 the gate bites ----------
{
  const missed = []; let n = 0;
  const mut = (name, file, from, to, check) => {
    n++; const T = Object.assign({}, TEXT);
    if (T[file].split(from).length !== 2) { missed.push(name + ' (seam moved)'); return; }
    T[file] = T[file].replace(from, () => to);
    let r; try { r = check(T).f; } catch (e) { r = ['thrown']; }
    if (!r.length) missed.push(name);
  };
  mut('a field with no experimental badge', MODULE, 'b.textContent="' + AR.exp + '"', 'b.textContent=""', checkL2);
  mut('a level that draws any level', MODULE, 'function ok(i){return !lv||want<1||lv[i]===want}', 'function ok(i){return true}', checkL3);
  mut('a level that draws its neighbour', MODULE, 'function ok(i){return !lv||want<1||lv[i]===want}', 'function ok(i){return !lv||want<1||lv[i]===(want%3)+1}', checkL3);
  mut('an off switch that loads anyway', MODULE, 'if(LEVELS_EXPERIMENT){try{load()}catch(e){}}', 'try{load()}catch(e){}', checkL4);
  mut('a short file that still shows the field', MODULE, 'if(v!==1&&v!==2&&v!==3)return;', 'if(v!==1&&v!==2&&v!==3)v=1;', checkL4);
  mut('a foreign stamp accepted', MODULE, '||L.stamp!==seenStamp())return;', ')return;', checkL4);
  mut('by points that ignores the slot', 'quest-board.html', 'var a=bag(g,sl.cat,seen,lvOf(sl));', 'var a=bag(g,sl.cat,seen,0);', checkL3);
  mut('the dive pool that ignores the level', 'quest-ghaws.html', 'if(kzLive(i)&&kzLv(i)&&S.cats', 'if(kzLive(i)&&S.cats', checkL3);
  mut('the war that ignores the level', 'quest-harb.html', 'if(kzLive(i)&&kzLv(i)&&DATA.qs[i][0]===ci&&!G.used[i]', 'if(kzLive(i)&&DATA.qs[i][0]===ci&&!G.used[i]', checkL3);
  mut('the test that ignores the level', 'quest-test.html', 'return kzLive(i)&&kzLv(i)&&!g.used[i]', 'return kzLive(i)&&!g.used[i]', checkL3);
  mut('a spent level that is not said', MODULE, 'function spent(){return lv&&want>0?', 'function spent(){return false?', checkL3);
  mut('a second switch in a page', 'quest-test.html', '<script src="/quest-levels.js"></script>', '<script>var LEVELS_EXPERIMENT=true;</script><script src="/quest-levels.js"></script>', checkL5);
  { n++; const L = JSON.parse(JSON.stringify(LV0)); const id = Object.keys(L.levels).find((k) => DATA0.qs.find((q) => q[8] === k)[0] === 16); L.levels[id] = 4; if (!checkL1(L, DATA0).f.length) missed.push('a level 4 in the file'); }
  { n++; const L = JSON.parse(JSON.stringify(LV0)); L.stamp = '0-00000000'; if (!checkL1(L, DATA0).f.length) missed.push('a file stamped for another bank'); }
  report('L6', 'the gate bites: each broken rule is caught', missed.map((m) => 'MUTANT SURVIVED: ' + m), 'mutants=' + n + ' missed=' + missed.length);
}

const bad = results.filter((r) => !r.ok);
console.log('SUMMARY ' + (results.length - bad.length) + '/' + results.length + ' pass' + (bad.length ? ' FAILED: ' + bad.map((r) => r.id).join(',') : ''));
process.exit(bad.length ? 1 : 0);
