// kunuz-norepeat-guard.js — البرهان العدديّ على «لا تكرار حتّى النفاد» (2026-09-17). ASCII output only.
// usage: node guards/kunuz-norepeat-guard.cjs [--ghaws file] [--harb file] [--seed 7] [--dives 1000]
// كلّ «فتح صفحة» عالم جديد (مستند مصغّر + محرّك من الملفّ نفسه + بياناته المضمَّنة)، والعوالم تتشارك localStorage
// واحدًا مزيّفًا، فهذا هو «نفس الحساب» بين الجلسات وبين الطورين. العالم مأخوذ حرفيًّا من guard.js.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const { VER, El, Txt, parseInto } = require('./kunuz-sim/dom.cjs');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i > -1 ? argv[i + 1] : d; };
const REPO = path.join(__dirname, '..');
const GF = arg('ghaws', path.join(REPO, 'quest-ghaws.html'));
const HF = arg('harb', path.join(REPO, 'quest-harb.html'));
const SEED = +arg('seed', 7), DIVES = +arg('dives', 1000);
const ascii = s => String(s).replace(/[^\x00-\x7f]/g, '?');
function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let R = prng(SEED);
const ri = n => Math.floor(R() * n);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- world from guard.js, with localStorage handed to the page ----------
const G_SRC = fs.readFileSync(path.join(__dirname, 'kunuz-sim', 'world.cjs'), 'utf8');
const wa = G_SRC.indexOf('// ---------- world ----------'), wb = G_SRC.indexOf('// ---------- synthetic bank');
let WORLD = G_SRC.slice(wa, wb);
const A1 = 'DATA, Math: M,';
if (wa < 0 || wb < 0 || WORLD.split(A1).length !== 2) throw new Error('guard.js world section not as expected');
WORLD = WORLD.replace(A1, 'DATA, localStorage: o.storage, Math: M,').replace(/\bM\.random = R\b/, 'M.random = getR()');
const makeWorld = new Function('fs', 'vm', 'VER', 'El', 'Txt', 'parseInto', 'getR', WORLD + '\nreturn makeWorld;')(fs, vm, VER, El, Txt, parseInto, () => R);

// ezik: the page no longer embeds its bank -- it loads ONE shared file, so DATA is read from that file.
const BANK_TAG = '<script src="/quest-data/kunuz-bank-3147.js"></script>';
function load(file) {
  const page = fs.readFileSync(file, 'utf8');
  if (page.split(BANK_TAG).length !== 2) throw new Error('page does not load the shared bank exactly once: ' + file);
  if (page.indexOf('var DATA=') > -1) throw new Error('page still embeds a bank: ' + file);
  const t = '<script>' + fs.readFileSync(path.join(REPO, 'quest-data', 'kunuz-bank-3147.js'), 'utf8') + '</script>\n' + page;
  const k = t.indexOf('var DATA='), i = t.lastIndexOf('<script>', k), j = t.indexOf('</script>', k);
  const DATA = new Function(t.slice(i + 8, j) + ';return DATA;')();
  const sa = t.lastIndexOf('<script>'), sb = t.indexOf('</script>', sa);
  const bs = t.indexOf('<body>') + 6, be = t.indexOf('<script', bs);
  return { DATA, ENGINE: t.slice(sa + 8, sb), BODY: t.slice(bs, be) };
}
function Store() {
  const m = new Map(); let writes = 0;
  return { m, get writes() { return writes; },
    getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { writes++; m.set(k, String(v)); }, removeItem: k => { writes++; m.delete(k); } };
}
const DENIED = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); }, removeItem() { throw new Error('SecurityError'); } };
const GS = ['home', 'how', 'cfg', 'turn', 'dive', 'end', 'board', 'verdict'];
const HS = ['home', 'how', 'cfg', 'war', 'win', 'verdict'];
const KEY = 'kunuz_seen_v1';

// ---------- results ----------
const results = [];
function report(n, name, ok, info, fails) {
  results.push({ n, name, ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + n + ' ' + name + ' :: ' + info);
  (fails || []).slice(0, 8).forEach(m => console.log('   - ' + ascii(m)));
}
function worldErrors(W) { return W.errors.map(e => String(e && e.stack || e).split('\n').slice(0, 2).join(' | ')); }

// ---------- a ledger of every question actually shown ----------
function Ledger() { return { seen: new Set(), shown: 0, repeats: 0, textBad: 0, firstRepeat: null }; }
function record(L, DATA, idx, text, tag) {
  L.shown++;
  if (idx < 0) { L.textBad++; return; }
  if (DATA.qs[idx][3] !== text) L.textBad++;
  if (L.seen.has(idx)) { L.repeats++; if (!L.firstRepeat) L.firstRepeat = tag + ' idx ' + idx; }
  L.seen.add(idx);
}
function popcount(store, DATA) {
  const raw = store.getItem(KEY); if (raw === null) return 0;
  const o = JSON.parse(raw), b = Buffer.from(o.b, 'base64'); let n = 0;
  for (let i = 0; i < DATA.qs.length; i++) if (b[i >> 3] >> (i & 7) & 1) n++;
  return n;
}

// ---------- ghaws driver ----------
const gsrc = load(GF), hsrc = load(HF);
function gOpen(store, src) { const W = makeWorld(src || gsrc, (src || gsrc).DATA, GS, { reduce: true, storage: store }); return W; }
const chips = W => W.$('cats').childNodes.filter(n => n.nodeType === 1);
const shells = W => W.doc.querySelectorAll('#shells .shell').filter(e => W.shown(e) && !e.disabled);
const pearls = W => W.doc.querySelectorAll('#opts button.opt').filter(e => W.shown(e) && !e.disabled && e.dataset.k !== undefined);
function toCfg(W, crew) {
  if (W.screen() !== 'home') W.tap(W.doc.querySelectorAll('[data-go="home"]').find(b => W.shown(b)), 'home');
  W.tap(W.doc.querySelector(crew ? '[data-go="cfgc"]' : '[data-go="cfg1"]'), 'mode');
}
function pick(W, cats) { W.tap(W.doc.querySelector('[data-q="none"]'), 'none'); cats.forEach(c => W.tap(chips(W)[c], 'chip ' + c)); }
// one dive: returns number of questions shown; wrong=false answers correctly
function dive(W, L, cats, cap, tag) {
  toCfg(W, false); pick(W, cats);
  const S = W.ctx.S; S.cap = cap; S.breath = 0; S.noOpts = false;
  if (W.$('goDive').disabled) return -1;
  W.tap(W.$('goDive'), 'goDive');
  let n = 0;
  for (let g = 0; g < 400 && W.screen() === 'dive'; g++) {
    const sh = shells(W); if (!sh.length) { W.fail(tag + ' dive screen without shells'); break; }
    W.tap(sh[ri(sh.length)], 'shell');
    const q = S.cur; record(L, W.ctx.DATA, W.ctx.DATA.qs.indexOf(q), W.$('qtext').textContent, tag); n++;
    W.tap(pearls(W).find(b => +b.dataset.k === q[5]), 'pearl'); W.advance(2600);
  }
  return n;
}
const leftByCat = (DATA, store) => { const raw = store.getItem(KEY), o = raw && JSON.parse(raw), b = o ? Buffer.from(o.b, 'base64') : Buffer.alloc(0), a = DATA.cats.map(() => 0);
  DATA.qs.forEach((q, i) => { if (!(b[i >> 3] >> (i & 7) & 1)) a[q[0]]++; }); return a; };

// ---------- harb driver: real setup + war start; each question asked through the engine's own askQ ----------
function hOpen(store) { return makeWorld(hsrc, hsrc.DATA, HS, { reduce: true, storage: store }); }
function war(W, L, cats, asks, tag) {
  if (W.screen() === 'war') { W.ctx.quitFight(); W.ctx.show('home'); }
  else if (W.screen() !== 'home') W.tap(W.doc.querySelectorAll('[data-go="home"]').find(b => W.shown(b)), 'home');
  W.tap(W.doc.querySelector('[data-go="cfg"]'), 'cfg');
  W.tap(W.doc.querySelector('[data-q="none"]'), 'none'); cats.forEach(c => W.tap(W.$('cats').childNodes.filter(n => n.nodeType === 1)[c], 'chip'));
  const G = W.ctx.G; G.fuse = 0;
  if (W.$('startWar').disabled) return -1;
  W.tap(W.$('startWar'), 'startWar');
  if (W.screen() !== 'war') { W.fail(tag + ' war not shown'); return 0; }
  let n = 0, last = null;
  const orig = W.ctx.pickQ; W.ctx.pickQ = function (ci) { const q = orig.apply(this, arguments); last = q; return q; };
  for (let a = 0; a < asks && W.screen() === 'war'; a++) {
    const live = [...Array(12).keys()].filter(i => !W.ctx.isDead(i)); if (!live.length) break; // SILENT: dormant islands are never asked
    const k = live[ri(live.length)]; G.tgt = k; G.base = (k + 1) % 12; G.turn = 0; last = null;
    W.ctx.startFight();
    W.ctx.askQ(G.players[0], 0, G.slotCat[k], '', a % 2 === 1, function () {});
    if (W.screen() !== 'war') break;
    if (!last) { W.fail(tag + ' askQ showed nothing'); break; }
    record(L, W.ctx.DATA, W.ctx.DATA.qs.indexOf(last), W.$('qtext').textContent, tag); n++;
    const b = W.doc.querySelectorAll('#ops .opt').find(x => W.shown(x) && +x.dataset.k === last[5]);
    W.tap(b, 'answer'); W.advance(4000); W.ctx.quitFight();
    if (G.slotCat.some(c => cats.indexOf(c) < 0)) W.fail(tag + ' island from unchosen cat');
  }
  return n;
}

// =====================================================================
const DG = gsrc.DATA, N = DG.qs.length;
if (hsrc.DATA.qs.length !== N || JSON.stringify(hsrc.DATA) !== JSON.stringify(DG)) throw new Error('ghaws and harb carry different DATA');
console.log('FILES ghaws=' + ascii(path.basename(GF)) + ' harb=' + ascii(path.basename(HF)) + ' qs=' + N + ' cats=' + DG.cats.length + ' SEED ' + SEED);

// ---- 1, 2, 3: one account, 1000 dives, then drain, then after exhaustion ----
(function () {
  const store = Store(), L = Ledger(), fails = [], errs = [];
  let W = gOpen(store), dives = 0, reloads = 1, blocked = 0, qs1 = 0, maxDive = 0;
  const live = () => leftByCat(DG, store).map((v, i) => [i, v]).filter(x => x[1] > 0).map(x => x[0]);
  for (let d = 0; d < DIVES; d++) {
    if (d % 10 === 0 && d) { errs.push(...worldErrors(W)); fails.push(...W.fails); W = gOpen(store); reloads++; }
    const lv = live(); if (lv.length < 3) break;
    const cats = shuffle(lv).slice(0, 3 + ri(4)), cap = 1 + ri(3);
    const n = dive(W, L, cats, cap, 'dive' + d);
    if (n < 0) { blocked++; continue; }
    dives++; qs1 += n; maxDive = Math.max(maxDive, n);
    if (popcount(store, DG) !== L.seen.size) fails.push('dive ' + d + ' stored ' + popcount(store, DG) + ' != shown unique ' + L.seen.size);
  }
  const after1 = L.seen.size;
  report(1, DIVES + ' dives on one record, new categories each dive', dives === DIVES && L.repeats === 0 && L.textBad === 0 && !fails.length && !errs.length,
    'dives=' + dives + ' pageLoads=' + reloads + ' shown=' + L.shown + ' repeats=' + L.repeats + ' textMismatch=' + L.textBad + ' stored=' + popcount(store, DG) + ' blocked=' + blocked + ' errors=' + errs.length + ' fails=' + fails.length, errs.concat(fails));

  // drain [SILENT: start needs 1 remaining now, so no leftover planning]: random live cats (padded with spent ones to reach 3), random cap
  const f2 = [], e2 = []; let drains = 0;
  for (let g = 0; g < 2000 && L.seen.size < N; g++) {
    W = gOpen(store); reloads++;
    const lb = leftByCat(DG, store), lv = lb.map((v, i) => [i, v]).filter(x => x[1] > 0).map(x => x[0]);
    const total = lv.reduce((s, c) => s + lb[c], 0);
    let chosen = shuffle(lv).slice(0, 3 + ri(4)), inC = chosen.reduce((s, c) => s + lb[c], 0);
    const all = DG.cats.map((c, i) => i);
    if (chosen.length < 3) chosen = chosen.concat(shuffle(all.filter(c => chosen.indexOf(c) < 0)).slice(0, 3 - chosen.length)); // spent cats may still be chosen
    const cap = 1 + ri(40);
    const n = dive(W, L, chosen, cap, 'drain' + g);
    if (n < 0) { f2.push('drain blocked total=' + total + ' inChosen=' + inC); break; }
    drains++; e2.push(...worldErrors(W)); f2.push(...W.fails);
  }
  const consumed = popcount(store, DG);
  report(2, 'consumed at exhaustion', consumed === N && L.seen.size === N && L.repeats === 0 && !f2.length && !e2.length,
    'consumed=' + consumed + '/' + N + ' uniqueShown=' + L.seen.size + ' afterPhase1=' + after1 + ' drainDives=' + drains + ' repeats=' + L.repeats + ' errors=' + e2.length + ' fails=' + f2.length, e2.concat(f2));

  // 3: after exhaustion — setup says so, start is blocked, a forced start shows nothing and does not recycle
  const f3 = [];
  W = gOpen(store); toCfg(W, false); pick(W, [0, 1, 2]);
  const sub = W.$('catTally').textContent, goOff = W.$('goDive').disabled, resetOn = !W.$('seenReset').disabled; // SILENT: the announcement lives in the tally line now
  if (sub.indexOf('انتهت') < 0) f3.push('setup does not announce: ' + sub);
  if (!goOff) f3.push('goDive enabled after exhaustion');
  const S = W.ctx.S; S.cap = 30; S.breath = 0;
  W.ctx.startDive(); W.advance(3000);
  const scr = W.screen(), title = W.$('endTitle').textContent, again = W.$('again').disabled;
  if (scr !== 'end') f3.push('forced dive screen ' + scr);
  if (title !== 'انتهت الأسئلة كلّها') f3.push('end title ' + title);
  if (S.cur) f3.push('a question is current');
  if (!again) f3.push('again enabled');
  const hW = hOpen(store); hW.tap(hW.doc.querySelector('[data-go="cfg"]'), 'cfg'); pickH(hW, [0, 1, 2]); // SILENT: pick cats, read the tally line
  const hsub = hW.$('catTally').textContent, hOff = hW.$('startWar').disabled;
  if (hsub.indexOf('انتهت') < 0) f3.push('harb setup does not announce');
  if (!hOff) f3.push('startWar enabled after exhaustion');
  // SILENT: a forced war now has every island dormant, and asking hands back nothing; the war ends by the all-dormant rule
  hW.ctx.G.players.forEach((p, i) => { p.n = 'P' + i; }); hW.ctx.newWar(); const G = hW.ctx.G; G.tgt = 0; G.base = 1; G.fuse = 0;
  let got = 'none'; hW.ctx.startFight(); hW.ctx.askQ(G.players[0], 0, G.slotCat[0], '', false, v => { got = v; });
  const qShown = hW.$('qtext').textContent; hW.ctx.quitFight();
  const ended = hW.ctx.warEnd();
  const hscr = hW.screen(), hname = hW.$('winWhy').textContent;
  if (got !== null || qShown) f3.push('harb forced ask showed a question');
  if (!ended || hscr !== 'win' || hname.indexOf('انتهت الأسئلة كلّها') !== 0) f3.push('harb forced war screen=' + hscr);
  const W2 = gOpen(store); toCfg(W2, false);
  if (popcount(store, DG) !== N) f3.push('record changed after exhaustion: ' + popcount(store, DG));
  f3.push(...worldErrors(W), ...W.fails, ...worldErrors(hW), ...hW.fails, ...worldErrors(W2), ...W2.fails);
  report(3, 'after exhaustion: announce, nothing shown, no recycle', !f3.length,
    'setupAnnounces=' + (sub.indexOf('انتهت') > -1 ? 1 : 0) + ' goDiveDisabled=' + (goOff ? 1 : 0) + ' resetEnabled=' + (resetOn ? 1 : 0) + ' forcedDiveScreen=' + scr + ' spentTitle=' + (title === 'انتهت الأسئلة كلّها' ? 1 : 0) + ' questionShown=' + (S.cur ? 1 : 0) + ' againDisabled=' + (again ? 1 : 0) +
    ' harbStartDisabled=' + (hOff ? 1 : 0) + ' harbForcedAsk=' + hscr + ' storedAfterReload=' + popcount(store, DG) + ' fails=' + f3.length, f3);
})();

// ---- 4: dive, war, dive on one record; then two tabs open at once ----
(function () {
  R = prng(SEED + 4);
  const store = Store(), L = Ledger(), f = [];
  const cats = shuffle(DG.cats.map((c, i) => i)).slice(0, 4);
  let W = gOpen(store); const a = dive(W, L, cats, 40, 'g1'); f.push(...worldErrors(W), ...W.fails);
  const H = hOpen(store); const b = war(H, L, cats, 60, 'h1'); f.push(...worldErrors(H), ...H.fails);
  W = gOpen(store); const c = dive(W, L, cats, 40, 'g2'); f.push(...worldErrors(W), ...W.fails);
  // two tabs alive together, alternating
  const T1 = gOpen(store), T2 = hOpen(store); let d = 0, e = 0;
  for (let i = 0; i < 5; i++) { d += dive(T1, L, cats, 5, 'tab1'); e += war(T2, L, cats, 5, 'tab2'); }
  f.push(...worldErrors(T1), ...T1.fails, ...worldErrors(T2), ...T2.fails);
  const stored = popcount(store, DG);
  report(4, 'cross-mode: dive -> war -> dive, then two tabs alternating', L.repeats === 0 && L.textBad === 0 && stored === L.seen.size && !f.length,
    'dive1=' + a + ' war=' + b + ' dive2=' + c + ' tabDive=' + d + ' tabWar=' + e + ' shown=' + L.shown + ' repeats=' + L.repeats + ' stored=' + stored + ' fails=' + f.length, f);
})();

// ---- 5: one long game ----
(function () {
  R = prng(SEED + 5);
  const store = Store(), L = Ledger(), L2 = Ledger(), f = [];
  const size = DG.cats.map((c, i) => DG.qs.filter(q => q[0] === i).length);
  const cats = DG.cats.map((c, i) => i).sort((x, y) => size[y] - size[x]).slice(0, 6);
  const W = gOpen(store); const a = dive(W, L, cats, 200, 'long');
  f.push(...worldErrors(W), ...W.fails);
  const depth = W.ctx.S.depth;
  const H = hOpen(Store()); const b = war(H, L2, cats, 300, 'longwar');
  f.push(...worldErrors(H), ...H.fails);
  report(5, 'one long game: dive cap 200, one war of 300 questions (6 largest cats)', a === 200 && depth === 200 && L.repeats === 0 && b === 300 && L2.repeats === 0 && !f.length,
    'diveShown=' + a + ' depth=' + depth + ' diveRepeats=' + L.repeats + ' warShown=' + b + ' warRepeats=' + L2.repeats + ' fails=' + f.length, f);
})();

// ---- 6: bank stamp changes ----
(function () {
  R = prng(SEED + 6);
  const f = [], rows = [];
  const variants = [
    ['same-count-one-id-changed', D => { D.qs[1234][8] = D.qs[1234][8] + '-x'; }],
    ['one-question-removed', D => { D.qs.pop(); }],
    ['order-swapped', D => { const t = D.qs[0]; D.qs[0] = D.qs[1]; D.qs[1] = t; }],
  ];
  for (const [name, mut] of variants) {
    const store = Store(), L = Ledger();
    const W = gOpen(store); dive(W, L, shuffle(DG.cats.map((c, i) => i)).slice(0, 6), 120, 'fill');
    const before = popcount(store, DG);
    const D2 = JSON.parse(JSON.stringify(DG)); mut(D2);
    const src2 = Object.assign({}, gsrc, { DATA: D2 });
    const W2 = gOpen(store, src2); toCfg(W2, false);
    const n2 = D2.qs.length; // SILENT: no seenSub text to read any more
    const leftNum = W2.ctx.seenLeft(null);
    const raw = store.getItem(KEY), o = raw && JSON.parse(raw);
    if (leftNum !== n2) f.push(name + ' left ' + leftNum + ' != ' + n2);
    if (!o || o.s !== W2.ctx.seenStamp() || Buffer.from(o.b, 'base64').some(x => x)) f.push(name + ' stale record kept');
    // and the unchanged bank still reads its own record (control)
    const W3 = gOpen(store); const back = W3.ctx.seenLeft(null);
    rows.push(name + ':before=' + before + ',left=' + leftNum + '/' + n2 + ',stampChanged=' + (W2.ctx.seenStamp() !== W.ctx.seenStamp() ? 1 : 0) + ',origBankLeftAfter=' + back);
    f.push(...worldErrors(W), ...W.fails, ...worldErrors(W2), ...W2.fails, ...worldErrors(W3), ...W3.fails);
  }
  // control: same bank, new page → record kept
  const store = Store(), L = Ledger(); const W = gOpen(store); const n = dive(W, L, [0, 1, 2], 50, 'ctl');
  const kept = gOpen(store).ctx.seenLeft(null);
  if (kept !== N - n) f.push('control: same bank lost record ' + kept);
  report(6, 'bank stamp change drops the record', !f.length, rows.join(' ') + ' control:sameBankLeft=' + kept + '/' + (N - n) + ' fails=' + f.length, f);
})();

// ---- 7: owner reset ----
(function () {
  R = prng(SEED + 7);
  const f = [], store = Store(), L = Ledger();
  let W = gOpen(store); dive(W, L, [3, 4, 5, 6], 80, 'fill');
  W = gOpen(store); toCfg(W, false);
  const before = W.ctx.seenLeft(null), btn = W.$('seenReset');
  W.tap(btn, 'reset once'); const afterOne = W.ctx.seenLeft(null), label = btn.textContent;
  W.tap(btn, 'reset confirm'); const afterTwo = W.ctx.seenLeft(null);
  const keyGone = store.getItem(KEY) === null, disabled = btn.disabled; // SILENT: seenSub removed
  const reload = gOpen(store).ctx.seenLeft(null);
  const H = hOpen(store); H.tap(H.doc.querySelector('[data-go="cfg"]'), 'cfg'); const hLeft = H.ctx.seenLeft(null);
  // reset from harb too
  const W4 = gOpen(store); dive(W4, Ledger(), [7, 8, 9], 20, 'fill2');
  const H2 = hOpen(store); H2.tap(H2.doc.querySelector('[data-go="cfg"]'), 'cfg'); const hb = H2.ctx.seenLeft(null);
  H2.tap(H2.$('seenReset'), 'h reset'); H2.tap(H2.$('seenReset'), 'h confirm'); const ha = gOpen(store).ctx.seenLeft(null);
  if (afterOne !== before) f.push('single tap reset');
  if (afterTwo !== N || reload !== N || hLeft !== N || ha !== N) f.push('reset did not restore');
  if (!keyGone) f.push('key not removed');
  [W, H, W4, H2].forEach(x => f.push(...worldErrors(x), ...x.fails));
  report(7, 'owner reset (two taps)', !f.length, 'before=' + before + ' afterOneTap=' + afterOne + ' afterConfirm=' + afterTwo + ' keyRemoved=' + (keyGone ? 1 : 0) + ' resetBtnDisabledAfter=' + (disabled ? 1 : 0) + ' reloadLeft=' + reload + ' harbSeesLeft=' + hLeft + ' harbResetFrom=' + hb + '->' + ha + ' fails=' + f.length, f);
})();

// ---- 8: stored size when full; also private mode (storage refused) and mark-at-display ----
(function () {
  const f = [];
  const store = Store(); const W = gOpen(store);
  for (let i = 0; i < N; i++) W.ctx.SEEN.bits[i >> 3] |= 1 << (i & 7);
  W.ctx.seenWrite();
  const raw = store.getItem(KEY), bytes = Buffer.byteLength(KEY, 'utf8') + Buffer.byteLength(raw, 'utf8'), vb = Buffer.byteLength(raw, 'utf8');
  const b64len = JSON.parse(raw).b.length;
  const full = gOpen(store).ctx.seenLeft(null);
  if (!(bytes < 4096) || full !== 0 || popcount(store, DG) !== N) f.push('size/full wrong');
  // round trip of every bit pattern boundary
  const W2 = gOpen(Store()); let rt = 0;
  for (let t = 0; t < 200; t++) { const a = []; const len = 1 + ri(400); for (let i = 0; i < len; i++) a.push(ri(256)); if (JSON.stringify(W2.ctx.b64d(W2.ctx.b64e(a))) !== JSON.stringify(a) || W2.ctx.b64e(a) !== Buffer.from(a).toString('base64')) rt++; }
  if (rt) f.push('base64 round trip bad ' + rt);
  report(8, 'stored size when full', !f.length, 'valueBytes=' + vb + ' keyPlusValueBytes=' + bytes + ' base64Chars=' + b64len + ' leftWhenFull=' + full + ' base64RoundTripBad=' + rt, f);

  // 8b private mode
  R = prng(SEED + 8);
  const fp = [], L = Ledger();
  const P = gOpen(DENIED); toCfg(P, false);
  const memShown = P.shown(P.$('seenMem'));
  const n1 = dive(P, L, [10, 11, 12], 30, 'priv1'), n2 = dive(P, L, [10, 11, 12], 30, 'priv2');
  fp.push(...worldErrors(P), ...P.fails);
  if (!memShown || L.repeats || n1 !== 30 || n2 !== 30) fp.push('private mode');
  report('8b', 'storage refused: quiet line, no repeat inside the session', !fp.length, 'memLineShown=' + (memShown ? 1 : 0) + ' dive1=' + n1 + ' dive2=' + n2 + ' repeats=' + L.repeats + ' fails=' + fp.length, fp);

  // 8c marked when shown, before any answer: close the page while the question is on screen
  R = prng(SEED + 9);
  const fm = [], s3 = Store();
  const A = gOpen(s3); toCfg(A, false); pick(A, [13, 14, 15]); A.ctx.S.cap = 10; A.ctx.S.breath = 0; A.tap(A.$('goDive'), 'go');
  A.tap(shells(A)[0], 'shell'); const shownIdx = DG.qs.indexOf(A.ctx.S.cur);
  const marked = popcount(s3, DG);
  const H = hOpen(s3); H.tap(H.doc.querySelector('[data-go="cfg"]'), 'cfg'); pickH(H, [13, 14, 15]); H.ctx.G.fuse = 0; H.tap(H.$('startWar'), 'go');
  let got = null; const o = H.ctx.pickQ; H.ctx.pickQ = function () { return (got = o.apply(this, arguments)); };
  const G = H.ctx.G; G.tgt = 0; G.base = 1; H.ctx.startFight(); H.ctx.askQ(G.players[0], 0, G.slotCat[0], '', false, () => {});
  const hIdx = DG.qs.indexOf(got), marked2 = popcount(s3, DG);
  fm.push(...worldErrors(A), ...A.fails, ...worldErrors(H), ...H.fails);
  if (marked !== 1 || marked2 !== 2 || hIdx === shownIdx) fm.push('not marked at display');
  report('8c', 'marked when shown, before answering (dive then war)', !fm.length, 'storedAfterDiveShow=' + marked + ' storedAfterWarShow=' + marked2 + ' sameQuestion=' + (hIdx === shownIdx ? 1 : 0) + ' fails=' + fm.length, fm);
})();
function pickH(H, cats) { H.tap(H.doc.querySelector('[data-q="none"]'), 'none'); cats.forEach(c => H.tap(H.$('cats').childNodes.filter(n => n.nodeType === 1)[c], 'chip')); }

// =====================================================================
// SILENT ORDER (2026-09-17): a real war played turn by turn, dormant islands, literal exhaustion, number-leak scan
// =====================================================================
const endKind = W => { const t = W.$('winWhy').textContent;
  return t === 'رُفعت الراية على الأرخبيل' ? 'victory' : t.indexOf('خمدت الجزر كلّها') === 0 ? 'allDormant' : t.indexOf('انتهت الأسئلة كلّها') === 0 ? 'bankEmpty' : t.indexOf('لا هجوم ممكنًا') === 0 ? 'stuck' : 'other'; };
function harbStart(W, cats, players, winRule) {
  if (W.screen() !== 'home') { W.ctx.quitFight(); W.ctx.show('home'); }
  W.tap(W.doc.querySelector('[data-go="cfg"]'), 'cfg'); pickH(W, cats);
  const G = W.ctx.G; while (G.players.length < players) W.tap(W.$('addP'), 'addP');
  G.fuse = 0; G.winRule = winRule; G.noOpts = false; G.shots = 1;
  if (W.$('startWar').disabled) return false;
  W.tap(W.$('startWar'), 'startWar'); return W.screen() === 'war';
}
// plays until the war screen closes. Policy: random bases/targets among what the engine allows, answers right with probability acc.
function playWar(W, L, o) {
  const ctx = W.ctx, G = ctx.G, st = { steps: 0, fights: 0, deadFights: 0, deadBannerChanges: 0, deadIsles: new Set(), deadCats: new Set(), qtextBad: 0, catSpentAt: {}, snap: {}, nullAsks: 0 };
  let last = null;
  const oq = ctx.pickQ; ctx.pickQ = function (ci) { const q = oq.apply(this, arguments); if (q) { last = q; record(L, ctx.DATA, ctx.DATA.qs.indexOf(q), q[3], 'war'); } else st.nullAsks++; return q; };
  const oc = ctx.combat; ctx.combat = function () { st.fights++; if (ctx.isDead(G.tgt) || ctx.isDead(G.base)) st.deadFights++; return oc.apply(this, arguments); };
  const nb = () => W.$('nextBtn'), idle = () => !G.busy && W.$('slab').classList.contains('hidden');
  for (; st.steps < (o.maxSteps || 400000) && W.screen() === 'war'; st.steps++) {
    const left = ctx.seenByCat();
    for (const c of (o.watch || [])) if (!(c in st.catSpentAt) && left[c] === 0) st.catSpentAt[c] = L.shown;
    if (idle()) for (let k = 0; k < 12; k++) {
      if (!ctx.isDead(k)) continue;
      if (!st.deadIsles.has(k)) { st.deadIsles.add(k); st.deadCats.add(G.slotCat[k]); st.snap[k] = G.own[k] + ':' + G.ban[k];
        if (!W.$('g' + k).classList.contains('dead')) { ctx.paint(); if (!W.$('g' + k).classList.contains('dead')) W.fail('dormant island without dead class ' + k); } }
      else if (st.snap[k] !== G.own[k] + ':' + G.ban[k]) { st.deadBannerChanges++; st.snap[k] = G.own[k] + ':' + G.ban[k]; }
    }
    if (o.onIdle && idle() && G.phase === 'attack' && o.onIdle(st) === 'stop') break;
    const slab = W.$('slab'), pg = W.$('pg');
    if (!slab.classList.contains('hidden')) {
      if (slab.classList.contains('flip') && !pg.disabled) { W.tap(pg, 'handover'); continue; }
      const ops = W.doc.querySelectorAll('#ops .opt').filter(b => W.shown(b) && !b.disabled && b.dataset.k !== undefined);
      if (ops.length && last) {
        if (W.$('qtext').textContent !== last[3]) st.qtextBad++;
        const right = R() < (o.acc || 0.5), b = ops.find(x => (+x.dataset.k === last[5]) === right) || ops[0];
        W.tap(b, 'answer'); last = null; W.advance(200); continue;
      }
      W.advance(250); continue;
    }
    if (G.busy) { W.advance(300); continue; }
    if (G.phase === 'deploy') {
      if (G.pool > 0) { const mine = [...Array(12).keys()].filter(k => G.own[k] === G.turn); ctx.tap(mine[ri(mine.length)]); }
      else if (!nb().disabled) W.tap(nb(), 'next'); else W.advance(300);
      continue;
    }
    if (G.phase === 'move') { if (G.moveLeft > 0 && R() < 0.5) ctx.tap(G.moveTgt); else if (!nb().disabled) W.tap(nb(), 'next'); else W.advance(300); continue; }
    if (G.phase === 'attack') {
      if (G.base === null) {
        const c = [...Array(12).keys()].filter(k => G.own[k] === G.turn && G.ban[k] >= 2 && !ctx.isDead(k) && [...Array(12).keys()].some(j => G.own[j] !== G.turn && ctx.adj(k, j) && !ctx.isDead(j)));
        if (!c.length || R() < 0.03) { if (!nb().disabled) W.tap(nb(), 'next'); else W.advance(300); continue; }
        ctx.tap(c[ri(c.length)]); continue;
      }
      const t = [...Array(12).keys()].filter(k => ctx.canHit(k));
      if (!t.length || R() < 0.1) { if (!nb().disabled) W.tap(nb(), 'next'); else W.advance(300); continue; }
      ctx.tap(t[ri(t.length)]); continue;
    }
    W.advance(300);
  }
  ctx.pickQ = oq; ctx.combat = oc;
  st.ended = W.screen() === 'win'; st.end = st.ended ? endKind(W) : 'running';
  return st;
}

// ---- أ: six categories, smallest 23, played to its end ----
(function () {
  const size = DG.cats.map((c, i) => DG.qs.filter(q => q[0] === i).length);
  const small = size.indexOf(Math.min(...size));
  const cats = [small].concat(DG.cats.map((c, i) => i).filter(i => i !== small).sort((x, y) => size[x] - size[y]).slice(0, 5));
  const tries = []; let ok = false, best = null;
  for (let a = 0; a < 10 && !ok; a++) {
    R = prng(SEED + 100 + a);
    const store = Store(), L = Ledger(), W = hOpen(store);
    if (!harbStart(W, cats, 4, 9)) { tries.push('start blocked'); continue; }
    const st = playWar(W, L, { acc: 0.5, watch: [small] });
    const spentAt = st.catSpentAt[small], after = spentAt === undefined ? -1 : L.shown - spentAt;
    const errs = worldErrors(W).concat(W.fails);
    const row = { attempt: a + 1, shown: L.shown, repeats: L.repeats, spentAt: spentAt === undefined ? -1 : spentAt, after, end: st.end, fights: st.fights, deadFights: st.deadFights, deadBannerChanges: st.deadBannerChanges, deadCats: [...st.deadCats].join('/'), steps: st.steps, qtextBad: st.qtextBad, errors: errs.length };
    tries.push(row); best = row;
    // proven only when the small category was spent during the war and questions kept coming after it
    ok = st.ended && after > 0 && L.shown > 114 && L.repeats === 0 && st.deadCats.has(small) && st.deadFights === 0 && st.deadBannerChanges === 0 && st.qtextBad === 0 && !errs.length && ['victory', 'allDormant', 'stuck', 'bankEmpty'].indexOf(st.end) > -1;
    if (!ok && errs.length) errs.slice(0, 3).forEach(m => console.log('   - ' + ascii(m)));
  }
  report('A', 'war on 6 cats (smallest ' + size[small] + '), played to its end', ok,
    'cats=' + cats.join('/') + ' sizes=' + cats.map(c => size[c]).join('/') + ' attempts=' + tries.length + ' last=' + JSON.stringify(best));
})();

// ---- ب: a category is spent on purpose mid-war ----
(function () {
  R = prng(SEED + 200);
  const f = [], store = Store(), L = Ledger(), W = hOpen(store), ctx = W.ctx, G = ctx.G;
  const cats = [2, 7, 10];
  if (!harbStart(W, cats, 3, 9)) f.push('start blocked');
  // play a little, then spend one island category through the engine's own record
  playWar(W, L, { acc: 0.5, onIdle: () => (L.shown >= 12 ? 'stop' : '') });
  const victim = G.slotCat[0], isles = [...Array(12).keys()].filter(k => G.slotCat[k] === victim);
  ctx.DATA.qs.forEach((q, i) => { if (q[0] === victim && !ctx.seenHas(i)) ctx.seenMark(i); });
  const beforeDead = isles.map(k => ctx.isDead(k)).filter(Boolean).length; // live cache not yet refreshed
  G.left = ctx.seenByCat(); ctx.paint();   // what beginTurn/pickQ do
  const deadNow = isles.filter(k => ctx.isDead(k)).length, deadClass = isles.filter(k => W.$('g' + k).classList.contains('dead')).length;
  const liveOthers = [...Array(12).keys()].filter(k => !ctx.isDead(k)).length;
  // no attack from / on a dormant island, through every door the engine has
  let canHitDead = 0, baseTaken = 0, tgtTaken = 0;
  const savedTurn = G.turn, savedBase = G.base, savedPhase = G.phase;
  for (const k of isles) for (let b = 0; b < 12; b++) { if (!ctx.adj(b, k)) continue; G.base = b; G.phase = 'attack'; G.turn = (G.own[k] + 1) % G.players.length; G.own[b] = G.turn; G.ban[b] = Math.max(G.ban[b], 2); if (ctx.canHit(k)) canHitDead++; }
  G.base = savedBase; G.turn = savedTurn; G.phase = savedPhase;
  const snap = isles.map(k => G.own[k] + ':' + G.ban[k]).join(',');
  if (G.phase === 'attack' && !G.busy) {
    const k0 = isles[0]; const t0 = G.turn; G.own[k0] = t0; G.ban[k0] = 3; const s1 = isles.map(k => G.own[k] + ':' + G.ban[k]).join(',');
    G.base = null; ctx.tap(k0); if (G.base === k0) baseTaken++;
    const liveMine = [...Array(12).keys()].find(k => !ctx.isDead(k) && isles.some(d => ctx.adj(k, d)));
    if (liveMine !== undefined) { G.own[liveMine] = t0; G.ban[liveMine] = 3; G.base = null; ctx.tap(liveMine); const d = isles.find(x => ctx.adj(liveMine, x) && G.own[x] !== t0) ;
      if (d !== undefined) { const ft = G.tgt; ctx.tap(d); if (G.tgt === d) tgtTaken++; G.tgt = ft; } G.base = null; G.sel = null; ctx.paint(); }
    if (s1 !== isles.map(k => G.own[k] + ':' + G.ban[k]).join(',')) f.push('dormant banners changed by refused taps');
  }
  // the war goes on over live islands
  const fightsBefore = L.shown;
  const st = playWar(W, L, { acc: 0.5 });
  const liveFights = st.fights - st.deadFights;
  // victory is counted over live islands: build the map by hand and ask the engine
  const W2 = hOpen(Store()); harbStart(W2, cats, 2, 9); // fresh record: the war above may already have spent these categories
  const c2 = W2.ctx, G2 = c2.G;
  c2.DATA.qs.forEach((q, i) => { if (q[0] === G2.slotCat[0] && !c2.seenHas(i)) c2.seenMark(i); }); G2.left = c2.seenByCat();
  const dead2 = [...Array(12).keys()].filter(k => c2.isDead(k)), live2 = [...Array(12).keys()].filter(k => !c2.isDead(k));
  for (let k = 0; k < 12; k++) G2.own[k] = dead2.indexOf(k) > -1 ? 1 : 0;
  G2.winRule = 9; const winAll = c2.whoWon();
  G2.own[live2[0]] = 1; const winMissingOne = c2.whoWon(); G2.own[live2[0]] = 0;
  // two complete seas counted on live islands, with a dormant island of the other player inside one of them
  G2.winRule = 2; const seaOf = k => c2.SLOTS[k].s;
  const seasWithDead = [...new Set(dead2.map(seaOf))].filter(s => live2.some(k => seaOf(k) === s));
  const otherSeas = [0, 1, 2, 3].filter(s => seasWithDead.indexOf(s) < 0 && live2.some(k => seaOf(k) === s));
  const pickSeas = seasWithDead.slice(0, 1).concat(otherSeas).slice(0, 2);
  for (let k = 0; k < 12; k++) G2.own[k] = (pickSeas.indexOf(seaOf(k)) > -1 && !c2.isDead(k)) ? 0 : 1;
  // give player 1 at least one live island in every other sea so it holds no complete live sea of its own... player 0 is checked first anyway
  const seas0 = c2.seas(0), winSeas = c2.whoWon();
  const ended = c2.warEnd(), endName = W2.$('winName').textContent;
  // all islands dormant -> the war ends with the full board and a winner by the standing rule
  const W3 = hOpen(Store()); harbStart(W3, [3, 4, 5], 3, 9); const c3 = W3.ctx;
  c3.DATA.qs.forEach((q, i) => { if ([3, 4, 5].indexOf(q[0]) > -1 && !c3.seenHas(i)) c3.seenMark(i); }); c3.G.left = c3.seenByCat();
  const leader = c3.leader(), allEnd = c3.warEnd();
  const rows3 = W3.$('winBody').childNodes.filter(n => n.nodeType === 1).length, why3 = W3.$('winWhy').textContent, name3 = W3.$('winName').textContent;
  if (deadNow !== isles.length || deadClass !== isles.length) f.push('victim islands not dormant ' + deadNow + '/' + deadClass + '/' + isles.length);
  if (canHitDead || baseTaken || tgtTaken) f.push('dormant island usable in attack');
  if (!(liveFights > 0) || st.deadFights || st.deadBannerChanges) f.push('war did not go on over live islands');
  if (winAll !== 0 || winMissingOne !== null) f.push('live-island victory wrong ' + winAll + '/' + winMissingOne);
  if (pickSeas.length < 2 || seas0 < 2 || winSeas !== 0 || !ended || endName !== G2.players[0].n) f.push('two-seas on live islands wrong seas0=' + seas0 + ' pick=' + pickSeas.join('/'));
  if (!allEnd || W3.screen() !== 'win' || rows3 !== c3.G.players.length || name3 !== c3.G.players[leader].n || why3.indexOf('خمدت الجزر كلّها') !== 0) f.push('all-dormant end wrong');
  [W, W2, W3].forEach(x => f.push(...worldErrors(x), ...x.fails));
  report('B', 'dormant islands: spent category mid-war', !f.length,
    'victimIsles=' + isles.length + ' deadAfterRefresh=' + deadNow + ' deadClass=' + deadClass + ' liveIslesLeft=' + liveOthers + ' canHitOnDead=' + canHitDead + ' baseOnDead=' + baseTaken + ' targetDead=' + tgtTaken +
    ' shownBefore=' + fightsBefore + ' warAfter:fights=' + st.fights + ',onDead=' + st.deadFights + ',deadBannerChanges=' + st.deadBannerChanges + ',shown=' + (L.shown - fightsBefore) + ',end=' + st.end + ' repeats=' + L.repeats +
    ' winAllLive(dead owned by other)=' + winAll + ' winMissingOneLive=' + winMissingOne + ' twoSeas:seas0=' + seas0 + ',whoWon=' + winSeas + ',seasWithDormant=' + seasWithDead.length + ' allDormantEnd=' + (allEnd ? 1 : 0) + ',boardRows=' + rows3 + ',winnerIsLeader=' + (name3 === c3.G.players[leader].n ? 1 : 0) + ' fails=' + f.length, f);
})();

// ---- ج: the bank is spent literally: the very last question can be played ----
(function () {
  R = prng(SEED + 300);
  const f = [];
  const size = DG.cats.map((c, i) => DG.qs.filter(q => q[0] === i).length);
  const X = 5, lastIdx = DG.qs.findIndex(q => q[0] === X), spentCats = [6, 7];
  // dive: everything seen but one question
  const store = Store(); let W = gOpen(store);
  for (let i = 0; i < N; i++) if (i !== lastIdx) W.ctx.SEEN.bits[i >> 3] |= 1 << (i & 7);
  W.ctx.seenWrite();
  W = gOpen(store); toCfg(W, false);
  pick(W, [spentCats[0], spentCats[1], 8]); const offSpent = W.$('goDive').disabled, txtSpent = W.$('catTally').textContent;
  pick(W, [X, spentCats[0], spentCats[1]]); const onOne = !W.$('goDive').disabled;
  const L = Ledger(); const shown = dive(W, L, [X, spentCats[0], spentCats[1]], 30, 'last');
  const lastShown = L.seen.has(lastIdx) && L.seen.size === 1, endT = W.$('endTitle').textContent;
  const consumedDive = popcount(store, DG);
  f.push(...worldErrors(W), ...W.fails);
  // war: two questions left in one category
  const s2 = Store(); let H = hOpen(s2); const two = DG.qs.map((q, i) => i).filter(i => DG.qs[i][0] === X).slice(0, 2);
  for (let i = 0; i < N; i++) if (two.indexOf(i) < 0) H.ctx.SEEN.bits[i >> 3] |= 1 << (i & 7);
  H.ctx.seenWrite();
  let warRows = [], consumedWar = 0, startOn = 0;
  for (let a = 0; a < 12 && consumedWar < N; a++) {
    R = prng(SEED + 310 + a);
    H = hOpen(s2); const LH = Ledger();
    if (!harbStart(H, [X, spentCats[0], spentCats[1]], 2, 9)) { warRows.push('blocked'); break; }
    startOn++;
    const st = playWar(H, LH, { acc: 0.5 });
    consumedWar = popcount(s2, DG); warRows.push(LH.shown + ':' + st.end);
    f.push(...worldErrors(H), ...H.fails);
  }
  if (!offSpent || txtSpent.indexOf('انتهت') < 0) f.push('spent choice not blocked/announced');
  if (!onOne || shown !== 1 || !lastShown || consumedDive !== N || endT !== 'انتهت الأسئلة كلّها') f.push('last question not playable in dive');
  if (!startOn || consumedWar !== N) f.push('war did not reach the last questions');
  report('C', 'literal exhaustion: last question reachable', !f.length,
    'dive:oneLeftStartEnabled=' + (onOne ? 1 : 0) + ',spentOnlyBlocked=' + (offSpent ? 1 : 0) + ',shown=' + shown + ',wasTheLast=' + (lastShown ? 1 : 0) + ',consumed=' + consumedDive + '/' + N +
    ' war:twoLeftStarts=' + startOn + ',wars=' + warRows.join(',') + ',consumed=' + consumedWar + '/' + N + ' fails=' + f.length, f);
})();

// ---- E: stress — random wars under heavy dormancy must all end by the rules, never on a dormant island ----
(function () {
  const WARS = +arg('stresswars', 100), rows = { victory: 0, allDormant: 0, bankEmpty: 0, stuck: 0, other: 0, running: 0 };
  let shown = 0, repeats = 0, deadFights = 0, deadBanner = 0, errors = 0, qtextBad = 0, maxSteps = 0, dormantWars = 0, stepsTot = 0;
  for (let w = 0; w < WARS; w++) {
    R = prng(SEED + 500 + w);
    const store = Store(), L = Ledger(), pre = gOpen(store);
    // leave each category with 0..10 unseen questions
    DG.cats.forEach((c, ci) => { const idx = DG.qs.map((q, i) => i).filter(i => DG.qs[i][0] === ci); const keep = ri(11); idx.slice(keep).forEach(i => { pre.ctx.SEEN.bits[i >> 3] |= 1 << (i & 7); }); });
    pre.ctx.seenWrite();
    const live = leftByCat(DG, store).map((v, i) => [i, v]).filter(x => x[1] > 0).map(x => x[0]);
    const cats = shuffle(live).slice(0, 3 + ri(4));
    const H = hOpen(store);
    if (!harbStart(H, cats, 2 + ri(3), ri(2) ? 2 : 9)) { rows.other++; continue; }
    H.ctx.G.shots = 1 + ri(3); H.ctx.G.noOpts = false;
    const st = playWar(H, L, { acc: 0.35 + R() * 0.4, maxSteps: 200000 });
    rows[st.end] = (rows[st.end] || 0) + 1;
    shown += L.shown; repeats += L.repeats; deadFights += st.deadFights; deadBanner += st.deadBannerChanges; qtextBad += st.qtextBad; maxSteps = Math.max(maxSteps, st.steps); stepsTot += st.steps;
    if (st.deadIsles.size) dormantWars++;
    const e = worldErrors(H).concat(H.fails); errors += e.length; if (e.length) e.slice(0, 2).forEach(m => console.log('   - war ' + w + ' ' + ascii(m)));
  }
  const ended = WARS - rows.running - rows.other;
  report('E', 'stress: ' + WARS + ' random wars, categories pre-spent to 0..10 left', ended === WARS && !repeats && !deadFights && !deadBanner && !errors && !qtextBad && !rows.other,
    'ended=' + ended + '/' + WARS + ' ends=' + JSON.stringify(rows) + ' warsWithDormancy=' + dormantWars + ' shown=' + shown + ' repeats=' + repeats + ' fightsOnDormant=' + deadFights + ' dormantBannerChanges=' + deadBanner + ' qtextMismatch=' + qtextBad + ' maxSteps=' + maxSteps + ' steps=' + stepsTot + ' errors=' + errors);
})();

// ---- د: number-leak scan over every screen of both modes ----
(function () {
  const CONTENT = new Set(['qtext', 'opts', 'ops', 'why']); // question text, choices and explanation are content, not bank information
  const STATE = new Set(['caps', 'capsFree', 'breaths', 'breathsFree', 'kval', 'boatN', 'crewDots', 'depth', 'net', 'netDots', 'netN', 'stat', 'bankBtn', 'endNum', 'endSub', 'endShare', 'boardSub', 'boardBody', 'plist',
    'mapBox', 'winMap', 'sShot', 'secs', 'winBody', 'fuses', 'fusesFree', 'deploy', 'deployFree', 'shots', 'shotsFree', 'pgName', 'stars']); // owner's choices and game progress (§2 exceptions)
  const QWORD = /(سؤال|أسئلة|اسئلة|الأسئلة|بنك)/, DIGIT = /[0-9٠-٩]/;
  const arD = n => String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);
  const leaks = []; let states = 0, strings = 0, withDigits = 0;
  function canaries(W) {
    const ctx = W.ctx, left = ctx.seenByCat(), set = new Set();
    const tot = DG.cats.map((c, i) => DG.qs.filter(q => q[0] === i).length);
    const add = n => { if (n >= 13) set.add(n); };
    add(N); const L = left.reduce((a, b) => a + b, 0); add(L); add(N - L);
    tot.forEach(add); left.forEach(add);
    const chosen = (ctx.S ? ctx.S.cats : ctx.G.cats) || [];
    if (chosen.length) { add(chosen.reduce((s, c) => s + tot[c], 0)); add(chosen.reduce((s, c) => s + left[c], 0)); add(Math.min(...chosen.map(c => left[c]))); add(Math.min(...chosen.map(c => tot[c]))); }
    return [...set];
  }
  function scan(W, label) {
    states++;
    const can = canaries(W);
    const walk = (el, inState) => {
      if (el.nodeType !== 1) return;
      const id = el.attrs.id;
      if (id && CONTENT.has(id)) return;
      const st = inState || (id && STATE.has(id));
      const own = el.childNodes.filter(n => n.nodeType === 3).map(n => n.data).join('');
      const strs = [own, el.attrs.title, el.attrs['aria-label'], typeof el.title === 'string' ? el.title : null].filter(s => s && s.trim());
      for (const s of strs) {
        strings++;
        if (!DIGIT.test(s)) continue; withDigits++;
        if (!st && QWORD.test(s)) leaks.push(label + ' #' + (id || el.localName) + ' word+digit: ' + s.trim().slice(0, 60));
        for (const c of can) { if (st && c < 1000) continue; if (c < 1000 && !QWORD.test(s)) continue; // small canaries (category sizes such as 55/89) collide with game values like the pearl sequence; they count only beside a question word
          if (s.indexOf(arD(c)) > -1 || new RegExp('(^|[^0-9])' + c + '([^0-9]|$)').test(s)) leaks.push(label + ' #' + (id || el.localName) + ' canary ' + c + ': ' + s.trim().slice(0, 60)); }
      }
      el.childNodes.forEach(n => walk(n, st));
    };
    walk(W.doc.documentElement, false);
  }
  R = prng(SEED + 400);
  const store = Store();
  // a used record so remaining numbers differ from totals; two small categories fully spent
  let W = gOpen(store); dive(W, Ledger(), [10, 17, 24], 60, 'pre');
  DG.qs.forEach((q, i) => { if (q[0] === 16 || q[0] === 23) W.ctx.seenMark(i); });
  // ---- dive
  W = gOpen(store); scan(W, 'G:home');
  W.tap(W.doc.querySelector('[data-go="how"]'), 'how'); scan(W, 'G:how'); W.ctx.show('home');
  toCfg(W, false); scan(W, 'G:cfg-default'); pick(W, [10, 17, 24]); scan(W, 'G:cfg-picked');
  pick(W, [16, 23]); scan(W, 'G:cfg-two'); pick(W, [16, 23, 21]); scan(W, 'G:cfg-with-spent');
  pick(W, [10, 17, 24]); W.ctx.S.cap = 5; W.ctx.S.breath = 0; W.tap(W.$('goDive'), 'go'); scan(W, 'G:dive-shells');
  W.tap(shells(W)[0], 'shell'); scan(W, 'G:dive-question'); const q = W.ctx.S.cur;
  W.tap(pearls(W).find(b => +b.dataset.k === q[5]), 'pearl'); scan(W, 'G:dive-answered'); W.advance(2600); scan(W, 'G:dive-next');
  for (let i = 0; i < 6 && W.screen() === 'dive'; i++) { const s = shells(W); W.tap(s[0], 's'); const qq = W.ctx.S.cur; W.tap(pearls(W).find(b => +b.dataset.k === qq[5]), 'p'); W.advance(2600); }
  scan(W, 'G:end');
  W.tap(W.$('toVerdict'), 'verdict'); scan(W, 'G:verdict');
  // spent end: a category with two left
  const s2 = Store(); let V = gOpen(s2); const keep = DG.qs.map((x, i) => i).filter(i => DG.qs[i][0] === 20).slice(0, 2);
  DG.qs.forEach((x, i) => { if (x[0] === 20 && keep.indexOf(i) < 0) V.ctx.seenMark(i); });
  V = gOpen(s2); dive(V, Ledger(), [20, 16, 23], 30, 'spend'); scan(V, 'G:end-spent');
  // crew
  const C = gOpen(store); toCfg(C, true); scan(C, 'G:cfg-crew'); pick(C, [10, 17, 24]); C.ctx.S.cap = 3; C.ctx.S.breath = 0; C.tap(C.$('goDive'), 'go'); scan(C, 'G:turn');
  for (let g = 0; g < 200 && C.screen() !== 'board'; g++) {
    if (C.screen() === 'turn') { C.tap(C.$('turnGo'), 'turnGo'); continue; }
    if (C.screen() === 'dive') { const s = shells(C); if (!s.length) { C.advance(500); continue; } C.tap(s[0], 's'); const qq = C.ctx.S.cur; C.tap(pearls(C).find(b => +b.dataset.k === qq[5]), 'p'); C.advance(2600); continue; }
    C.advance(500);
  }
  scan(C, 'G:board');
  const P = gOpen(DENIED); toCfg(P, false); scan(P, 'G:cfg-private');
  // ---- war
  let H = hOpen(store); scan(H, 'H:home');
  H.tap(H.doc.querySelector('[data-go="how"]'), 'how'); scan(H, 'H:how'); H.ctx.show('home');
  H.tap(H.doc.querySelector('[data-go="cfg"]'), 'cfg'); scan(H, 'H:cfg-default'); pickH(H, [10, 17, 24]); scan(H, 'H:cfg-picked');
  pickH(H, [16, 23, 21]); scan(H, 'H:cfg-with-spent'); pickH(H, [16, 23]); scan(H, 'H:cfg-two');
  H = hOpen(store); harbStart(H, [10, 17, 24], 2, 2); scan(H, 'H:war-deploy');
  let scannedQ = 0, scannedPass = 0, scannedResult = 0, scannedDead = 0;
  playWar(H, Ledger(), { acc: 0.5, maxSteps: 3000, onIdle: () => { if (!scannedResult && H.ctx.G.turnNo > 1) { scan(H, 'H:war-attack'); scannedResult = 1; } return ''; } });
  // fight screens: force one fight and scan its phases
  H = hOpen(store); harbStart(H, [10, 17, 24], 2, 9); const HG = H.ctx.G;
  const drive = () => { for (let g = 0; g < 400; g++) { if (HG.phase === 'attack' && !HG.busy) return true; if (HG.phase === 'deploy') { if (HG.pool > 0) H.ctx.tap([...Array(12).keys()].find(k => HG.own[k] === HG.turn)); else H.tap(H.$('nextBtn'), 'n'); } else H.advance(300); } return false; };
  drive();
  const base = [...Array(12).keys()].find(k => HG.own[k] === HG.turn && HG.ban[k] >= 2 && [...Array(12).keys()].some(j => H.ctx.adj(k, j) && HG.own[j] !== HG.turn));
  if (base !== undefined) {
    H.ctx.tap(base); scan(H, 'H:war-base'); const tg = [...Array(12).keys()].find(k => H.ctx.canHit(k)); H.ctx.tap(tg); scan(H, 'H:war-question'); scannedQ = 1;
    const wrongDef = H.doc.querySelectorAll('#ops .opt').filter(b => W.shown(b));
    let qq = null; const opq = H.ctx.DATA.qs.find(x => x[3] === H.$('qtext').textContent);
    const right = H.doc.querySelectorAll('#ops .opt').find(b => H.shown(b) && +b.dataset.k === opq[5]); H.tap(right, 'right'); H.advance(2500); scan(H, 'H:war-after-answer');
    if (!H.$('pg').disabled) { scan(H, 'H:war-handover'); scannedPass = 1; H.tap(H.$('pg'), 'pg'); scan(H, 'H:war-defender'); }
    H.advance(4000); scan(H, 'H:war-result');
  }
  // dormant island on the map, then victory and all-dormant boards
  const D = hOpen(store); harbStart(D, [10, 17, 24], 3, 9); D.ctx.DATA.qs.forEach((x, i) => { if (x[0] === D.ctx.G.slotCat[0] && !D.ctx.seenHas(i)) D.ctx.seenMark(i); });
  D.ctx.G.left = D.ctx.seenByCat(); D.ctx.paint(); scan(D, 'H:war-dormant'); scannedDead = 1;
  for (let k = 0; k < 12; k++) D.ctx.G.own[k] = 0; D.ctx.warEnd(); scan(D, 'H:win-victory');
  D.tap(D.$('toVerdict'), 'v'); scan(D, 'H:verdict');
  const E = hOpen(store); harbStart(E, [10, 17, 24], 3, 9); E.ctx.DATA.qs.forEach((x, i) => { if ([10, 17, 24].indexOf(x[0]) > -1 && !E.ctx.seenHas(i)) E.ctx.seenMark(i); });
  E.ctx.G.left = E.ctx.seenByCat(); E.ctx.warEnd(); scan(E, 'H:win-all-dormant');
  const PH = hOpen(DENIED); PH.tap(PH.doc.querySelector('[data-go="cfg"]'), 'cfg'); scan(PH, 'H:cfg-private');
  const errs = [W, V, C, P, H, D, E, PH].flatMap(x => worldErrors(x).concat(x.fails));
  report('D', 'number-leak scan, every screen of both modes', !leaks.length && !errs.length && scannedQ && scannedDead,
    'states=' + states + ' stringsScanned=' + strings + ' stringsWithDigits=' + withDigits + ' leaks=' + leaks.length + ' fightScreens=' + scannedQ + ' handover=' + scannedPass + ' dormantMap=' + scannedDead + ' errors=' + errs.length, leaks.concat(errs));
})();

const bad = results.filter(r => !r.ok);
console.log('SUMMARY ' + (results.length - bad.length) + '/' + results.length + ' pass' + (bad.length ? ' FAILED: ' + bad.map(r => r.n).join(',') : ''));
process.exit(bad.length ? 1 : 0);
