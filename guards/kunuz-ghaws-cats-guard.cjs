// Guard: ghaws category rules (2026-09-17). ASCII output only.
// usage: node guards/kunuz-ghaws-cats-guard.cjs <ghaws page> [more files...] [--seed 7]
// Runs the engine of each built file against the DATA embedded in that same file.
//   R1 selection: play needs 3..6 categories; a 7th cannot be added
//   R2 shellCats returns EVERY chosen category that still has an unused question (not three)
//   R3 shell order follows the owner's pick order and does not change between questions
//   R4 no shell from a category the owner did not choose
// The world (mini DOM, timers, vm) is taken verbatim from guard.js so both guards simulate the same browser.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const { VER, El, Txt, parseInto } = require('./kunuz-sim/dom.cjs');
const argv = process.argv.slice(2);
const REPO = path.join(__dirname, '..');
const si = argv.indexOf('--seed'), SEED = si > -1 ? +argv[si + 1] : 7;
const FILES = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--seed');
const ascii = s => String(s).replace(/[^\x00-\x7f]/g, '?');
function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let R = prng(SEED);
const ri = n => Math.floor(R() * n);

// ---------- makeWorld from guard.js ----------
const G_SRC = fs.readFileSync(path.join(__dirname, 'kunuz-sim', 'world.cjs'), 'utf8');
const wa = G_SRC.indexOf('// ---------- world ----------'), wb = G_SRC.indexOf('// ---------- synthetic bank');
if (wa < 0 || wb < 0) throw new Error('guard.js world section not found');
const makeWorld = new Function('fs', 'vm', 'VER', 'El', 'Txt', 'parseInto', 'getR', G_SRC.slice(wa, wb).replace(/\bM\.random = R\b/, 'M.random = getR()') + '\nreturn makeWorld;')(fs, vm, VER, El, Txt, parseInto, () => R);

// ---------- load a built file ----------
// ezik: the page no longer embeds its bank -- it loads ONE shared file, so DATA is read from that file.
const BANK_TAG = '<script src="/quest-data/kunuz-bank-3147.js"></script>';
function load(file) {
  const page = fs.readFileSync(file, 'utf8');
  if (page.split(BANK_TAG).length !== 2) throw new Error('page does not load the shared bank exactly once: ' + file);
  if (page.indexOf('var DATA=') > -1) throw new Error('page still embeds a bank: ' + file);
  const t = '<script>' + fs.readFileSync(path.join(REPO, 'quest-data', 'kunuz-bank-3147.js'), 'utf8') + '</script>\n' + page;
  const k = t.indexOf('var DATA='), i = t.lastIndexOf('<script>', k), j = t.indexOf('</script>', k);
  if (k < 0) throw new Error('no DATA in ' + file);
  const DATA = new Function(t.slice(i + 8, j) + ';return DATA;')();
  const sa = t.lastIndexOf('<script>'), sb = t.indexOf('</script>', sa);
  if (sa === i) throw new Error('engine script not found after DATA in ' + file);
  const bs = t.indexOf('<body>') + 6, be = t.indexOf('<script', bs);
  return { DATA, ENGINE: t.slice(sa + 8, sb), BODY: t.slice(bs, be) };
}

const GS = ['home', 'how', 'cfg', 'turn', 'dive', 'end', 'board', 'verdict'];
const results = [];
function run(tag, name, src, fn) {
  const W = makeWorld(src, src.DATA, GS, { reduce: false });
  let thrown = null, info = '';
  try { info = fn(W) || ''; } catch (e) { thrown = e; }
  const errs = W.errors.map(e => String(e && e.stack || e).split('\n').slice(0, 2).join(' | '));
  if (thrown) errs.push('THROWN ' + String(thrown.stack || thrown).split('\n').slice(0, 3).join(' | '));
  const ok = !errs.length && !W.fails.length;
  results.push({ tag, name, ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + tag + ' ' + name + ' errors=' + errs.length + ' fails=' + W.fails.length + (info ? ' :: ' + info : ''));
  errs.concat(W.fails).slice(0, 10).forEach(m => console.log('   - ' + ascii(m)));
}

const chips = W => W.$('cats').childNodes.filter(n => n.nodeType === 1);
const shellsNow = W => W.doc.querySelectorAll('#shells .shell').filter(e => W.shown(e)).map(e => +e.dataset.cat);
const pearls = W => W.doc.querySelectorAll('#opts button.opt').filter(e => W.shown(e) && !e.disabled);
function openCfg(W, crew) {
  W.tap(W.doc.querySelector(crew ? '[data-go="cfgc"]' : '[data-go="cfg1"]'), 'mode');
  if (W.screen() !== 'cfg') W.fail('cfg not shown');
}
function pickByChips(W, order) {
  W.tap(W.doc.querySelector('[data-q="none"]'), 'none');
  if (W.ctx.S.cats.length !== 0) W.fail('clear left ' + W.ctx.S.cats.length);
  order.forEach(c => W.tap(chips(W)[c], 'chip ' + c));
}
function start(W, crew) {
  const S = W.ctx.S; S.cap = 200; S.breath = 0; S.noOpts = false;
  W.tap(W.$('goDive'), 'goDive');
  if (crew) { if (W.screen() !== 'turn') W.fail('turn not shown'); W.tap(W.$('turnGo'), 'turnGo'); }
  if (W.screen() !== 'dive') W.fail('dive not shown');
}
function answer(W) {
  const S = W.ctx.S, sh = W.doc.querySelectorAll('#shells .shell').filter(e => W.shown(e) && !e.disabled);
  const c = +sh[ri(sh.length)].dataset.cat;
  W.tap(sh.find(e => +e.dataset.cat === c), 'shell');
  if (!S.cur || S.cur[0] !== c) W.fail('question not from touched shell ' + c);
  const p = pearls(W).find(b => b.dataset.k !== undefined && +b.dataset.k === S.cur[5]);
  W.tap(p, 'correct pearl'); W.advance(2600);
}
// expected shells = chosen categories, in pick order, that still hold an unused question in the pool
function expected(W) {
  const S = W.ctx.S, D = W.ctx.DATA, has = new Set();
  S.pool.forEach(k => { if (!S.used[k]) has.add(D.qs[k][0]); });
  return S.cats.filter(c => has.has(c));
}

function checks(tag, src) {
  const D = src.DATA, N = D.cats.length;
  const perCat = D.cats.map((c, i) => D.qs.filter(q => q[0] === i).length);
  const nonEmpty = [...Array(N).keys()].filter(i => perCat[i] > 0);
  console.log('DATA ' + tag + ' cats=' + N + ' qs=' + D.qs.length + ' emptyCats=' + (N - nonEmpty.length));

  run(tag, 'R1 selection 3..6 by chips', src, W => {
    openCfg(W, false);
    const S = W.ctx.S, go = W.$('goDive'), order = [];
    while (order.length < 7) { const c = nonEmpty[ri(nonEmpty.length)]; if (order.indexOf(c) < 0) order.push(c); }
    W.tap(W.doc.querySelector('[data-q="none"]'), 'none');
    const seen = [];
    for (let n = 0; n < 6; n++) {
      if (n < 3 && !go.disabled) W.fail('goDive enabled with ' + n + ' cats');
      W.tap(chips(W)[order[n]], 'chip');
      if (S.cats.length !== n + 1) W.fail('pick ' + (n + 1) + ' gave ' + S.cats.length);
      const want = n + 1 >= 3 && n + 1 <= 6;
      if (want === go.disabled) W.fail('goDive disabled=' + go.disabled + ' at ' + (n + 1));
      seen.push(S.cats.length + (go.disabled ? 'x' : 'v'));
    }
    const seventh = chips(W)[order[6]];
    if (!seventh.disabled) W.fail('7th chip not disabled');
    seventh.click();
    if (S.cats.length !== 6) W.fail('7th chip added: ' + S.cats.length);
    if (S.cats.join() !== order.slice(0, 6).join()) W.fail('S.cats not in pick order');
    // untick one: back to 5, every chip enabled again
    W.tap(chips(W)[order[5]], 'untick');
    if (S.cats.length !== 5 || chips(W).some(b => b.disabled)) W.fail('untick to 5 failed');
    // forced 7 (state, not UI) must still block play
    S.cats = order.slice(); W.ctx.tally();
    if (!go.disabled) W.fail('goDive enabled with 7 forced cats');
    // re-entering setup with a bad count resets to a valid default
    S.cats = order.slice(0, 2); W.tap(W.doc.querySelector('#cfg [data-go="home"]'), 'back');
    openCfg(W, false);
    if (S.cats.length < 3 || S.cats.length > 6) W.fail('openCfg kept ' + S.cats.length);
    // quick buttons never exceed 6
    const quick = [];
    ['rnd', 'rel', 'sec', 'inv', 'rnd', 'inv'].forEach(q => { W.tap(W.doc.querySelector('[data-q="' + q + '"]'), q); quick.push(q + '=' + S.cats.length); if (S.cats.length > 6) W.fail(q + ' gave ' + S.cats.length); if ((S.cats.length >= 3) === go.disabled && W.ctx.avail(S.cats) >= 3) W.fail(q + ' goDive state wrong'); });
    return 'steps=' + seen.join(',') + ' seventh=blocked forced7=blocked quick=' + quick.join(',');
  });

  const dive = (label, crew, pickN, depths) => run(tag, label, src, W => {
    openCfg(W, crew);
    const S = W.ctx.S, order = [];
    while (order.length < pickN) { const c = nonEmpty[ri(nonEmpty.length)]; if (order.indexOf(c) < 0) order.push(c); }
    pickByChips(W, order);
    if (S.cats.join() !== order.join()) W.fail('pick order not kept in S.cats');
    start(W, crew);
    let maxShells = 0, depthsChecked = 0, firstOrder = null;
    const rank = c => order.indexOf(c);
    for (let d = 0; d < depths && W.screen() === 'dive'; d++) {
      const got = shellsNow(W), want = expected(W), fn = W.ctx.shellCats();
      if (got.join() !== want.join()) W.fail('d' + d + ' shells [' + got + '] want [' + want + ']');
      if (fn.join() !== want.join()) W.fail('d' + d + ' shellCats() [' + fn + '] want [' + want + ']');
      if (got.some(c => order.indexOf(c) < 0)) W.fail('d' + d + ' shell from unchosen cat');
      for (let i = 1; i < got.length; i++) if (rank(got[i]) < rank(got[i - 1])) W.fail('d' + d + ' order broken');
      if (firstOrder === null) firstOrder = got.join();
      W.advance(5000); if (shellsNow(W).join() !== got.join()) W.fail('d' + d + ' shells changed while waiting');
      maxShells = Math.max(maxShells, got.length); depthsChecked++;
      answer(W);
    }
    return 'picked=' + pickN + ' depths=' + depthsChecked + ' maxShells=' + maxShells + ' firstShells=' + (firstOrder || '').split(',').length;
  });
  dive('R2-R4 solo, 6 cats, 40 depths', false, 6, 40);
  dive('R2-R4 solo, 3 cats, 40 depths', false, 3, 40);
  dive('R2-R4 crew, 5 cats, 30 depths', true, 5, 30);

  run(tag, 'R2 exhaust one chosen cat: its shell leaves, others stay', src, W => {
    openCfg(W, false);
    const S = W.ctx.S, order = [];
    while (order.length < 4) { const c = nonEmpty[ri(nonEmpty.length)]; if (order.indexOf(c) < 0) order.push(c); }
    pickByChips(W, order); start(W, false);
    const gone = order[1];
    S.pool.forEach(k => { if (W.ctx.DATA.qs[k][0] === gone) S.used[k] = 1; });
    answer(W);
    const got = shellsNow(W), want = order.filter(c => c !== gone);
    if (got.join() !== want.join()) W.fail('after exhausting cat: [' + got + '] want [' + want + ']');
    if (got.indexOf(gone) > -1) W.fail('exhausted cat still offered');
    return 'shells=' + got.length + '/4 exhaustedGone=' + (got.indexOf(gone) < 0);
  });

  run(tag, 'R4 pool holds only chosen cats; shellCats filters an injected unchosen cat', src, W => {
    openCfg(W, false);
    const S = W.ctx.S, Dq = W.ctx.DATA.qs, order = [];
    while (order.length < 3) { const c = nonEmpty[ri(nonEmpty.length)]; if (order.indexOf(c) < 0) order.push(c); }
    pickByChips(W, order); start(W, false);
    const want = Dq.map((q, i) => i).filter(i => order.indexOf(Dq[i][0]) > -1);
    if (S.pool.length !== want.length || S.pool.some(k => order.indexOf(Dq[k][0]) < 0)) W.fail('pool ' + S.pool.length + ' has unchosen or misses chosen (want ' + want.length + ')');
    const out = nonEmpty.find(c => order.indexOf(c) < 0);
    Dq.forEach((q, i) => { if (q[0] === out) S.pool.push(i); });
    answer(W);
    const got = shellsNow(W);
    if (got.indexOf(out) > -1) W.fail('injected unchosen cat ' + out + ' offered as shell');
    if (W.ctx.shellCats().indexOf(out) > -1) W.fail('shellCats() returned unchosen cat ' + out);
    return 'pool=' + want.length + ' injectedCat=' + out + ' shells=' + got.join('/');
  });

  run(tag, 'R2-R4 every category, 6 at a time (' + Math.ceil(nonEmpty.length / 6) + ' dives)', src, W => {
    let total = 0;
    for (let s = 0; s < nonEmpty.length; s += 6) {
      let order = nonEmpty.slice(s, s + 6);
      if (order.length < 3) order = order.concat(nonEmpty.filter(c => order.indexOf(c) < 0).slice(0, 3 - order.length));
      order = order.reverse();
      if (s) { W.ctx.stopB && W.ctx.stopB(); W.ctx.show('home'); }
      openCfg(W, false); pickByChips(W, order); start(W, false);
      for (let d = 0; d < 3; d++) {
        const got = shellsNow(W), want = expected(W);
        if (got.join() !== want.join()) W.fail('set@' + s + ' d' + d + ' [' + got + '] want [' + want + ']');
        if (got.length !== order.length) W.fail('set@' + s + ' d' + d + ' count ' + got.length + ' != ' + order.length);
        total++; answer(W);
      }
    }
    return 'depthsChecked=' + total;
  });
}

if (!FILES.length) { console.log('usage: node guards/kunuz-ghaws-cats-guard.cjs <file.html> [...]'); process.exit(2); }
console.log('SEED ' + SEED);
FILES.forEach((f, n) => { R = prng(SEED); console.log('FILE ' + ascii(f)); checks('F' + n, load(f)); });
const bad = results.filter(r => !r.ok);
console.log('SUMMARY ' + (results.length - bad.length) + '/' + results.length + ' pass' + (bad.length ? ' FAILED: ' + bad.map(r => r.tag + ' ' + r.name).join(' ; ') : ''));
process.exit(bad.length ? 1 : 0);
