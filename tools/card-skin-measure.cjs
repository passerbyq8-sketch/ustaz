#!/usr/bin/env node
/* =============================================================================================
 * ITEM 94 · THE SHARE CARD'S NEW SKIN — THE MEASUREMENT PROBE
 * =============================================================================================
 * THIS IS A PROBE, NOT A GATE. It is registered in no roster and run by hand; the gate suite
 * stays at the count it had so that a run before this item and a run after it are comparable.
 *
 * WHAT IT MEASURES, and every number it prints is produced by CALLING the shipped code rather
 * than by reading it:
 *
 *   1  QR ROUND TRIP      an independent decoder, written below, recovers the format bits,
 *                         unmasks the matrix, de-interleaves the blocks, checks every
 *                         Reed-Solomon syndrome and parses the byte stream back out. 24 addresses
 *                         of graded length go in; what comes out must be the same bytes.
 *   2  STRUCTURE          twelve synthetic model answers, each of which must either draw the new
 *                         card or fall back to the old one. A third outcome is the failure.
 *   3  ICON KEYS          every key, with the primitives its painter ACTUALLY called recorded
 *                         off a recording context -- so «no living beings» is measured, not
 *                         asserted.
 *   4  CARD HEIGHTS       three, four and five points, drawn, and the heights read off the
 *                         canvas the renderer sized.
 *   5  PREVIEW  (--preview)  one real PNG, out of a real canvas in a real browser.
 *
 * USAGE
 *   node tools/card-skin-measure.cjs
 *   node tools/card-skin-measure.cjs --preview <out.png>
 * ============================================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');
const { spawn } = require('child_process');
const { parseHTML } = require('linkedom');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const BB = require('./babel-block.cjs');

let P = 0, F = 0;
const ok = (name, cond, detail) => {
  if (cond) { P++; console.log('  PASS  ' + name); return true; }
  F++; console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
};
const eq = (name, a, b) => ok(name, String(a) === String(b), 'expected ' + b + '  actual ' + a);
const head = (t) => console.log('\n=== ' + t + ' ===');

/* ---------------------------------------------------------------------------------------------
 * THE SHIPPED CLIENT, EVALUATED. Same machinery theme-coverage-guard.cjs uses: the block is read
 * out of index.html (which is app.jsx), transformed once, and run in a vm over a linkedom
 * document. Nothing below re-types a constant or a function the client declares.
 * ------------------------------------------------------------------------------------------ */
const html = fs.readFileSync(INDEX, 'utf8');
const block = BB.readBabelBlock({ file: INDEX, html: html });
const code = BB.transformBabelBlock(block);
const { window } = parseHTML('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
window.self = window.self || window;
window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
window.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, clear() {}, key: () => null, length: 0 };
const EP = window.Element && window.Element.prototype;
if (EP && !EP.scrollIntoView) EP.scrollIntoView = function () {};
if (!window.crypto) { try { window.crypto = require('crypto').webcrypto; } catch (e) {} }
try { global.navigator = window.navigator; } catch (e) {}
global.window = window; global.document = window.document;
const CTX = vm.createContext(window);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'vendor', f), 'utf8'), CTX, { filename: f });
load('react.umd.js'); load('react-dom.umd.js');
vm.runInContext('ReactDOM.createRoot=function(){return{render:function(){},unmount:function(){}};};', CTX);
vm.runInContext(code, CTX, { filename: 'app.jsx' });
const call = (expr) => vm.runInContext(expr, CTX);

/* =============================================================================================
 * 1. THE BARCODE, ROUND TRIP
 * =============================================================================================
 * THE DECODER BELOW IS NOT THE ENCODER READ BACKWARDS BY HAND. It re-derives the format
 * information from the two copies written into the symbol, matches them against all 32 legal
 * BCH codewords, takes the mask and the level from THAT rather than from what the encoder chose,
 * and only then unmasks. The Reed-Solomon check is a syndrome evaluation, which is arithmetic
 * the encoder never performs: a generator polynomial in the wrong order, a block table off by
 * one codeword, an interleave that walks the blocks in the wrong direction -- every one of those
 * leaves a non-zero syndrome and is caught here even though both sides share a placement walk.
 * ========================================================================================== */
const QR_BLOCKS = call('EZIK_QR_BLOCKS');
const qrExp = call('EZIK_QR_EXP');
const qrMul = (a, b) => call('ezikQrMul')(a, b);
const qrFunc = (v) => call('ezikQrFunc')(v);
const qrMask = (k, i, j) => call('ezikQrMask')(k, i, j);

const bchFormat = (d) => {
  let rem = d;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >> 9) & 1) * 0x537);
  return (((d << 10) | rem) ^ 0x5412) & 0x7FFF;
};
const qrDecode = (mods, size) => {
  const n = size;
  const v = (n - 17) / 4;
  if (!Number.isInteger(v) || v < 2 || v > 6) throw new Error('version out of range: ' + v);
  const get = (r, c) => mods[r][c] & 1;
  const bits = [];
  for (let i = 0; i <= 5; i++) bits[i] = get(8, i);
  bits[6] = get(8, 7); bits[7] = get(8, 8); bits[8] = get(7, 8);
  for (let i = 9; i <= 14; i++) bits[i] = get(14 - i, 8);
  let raw = 0;
  for (let i = 0; i < 15; i++) raw |= bits[i] << i;
  let bestD = 99, bestW = -1;
  for (let d = 0; d < 32; d++) {
    let x = bchFormat(d) ^ raw, dist = 0;
    while (x) { dist += x & 1; x >>= 1; }
    if (dist < bestD) { bestD = dist; bestW = d; }
  }
  if (bestD > 3) throw new Error('format information is unreadable');
  const lvl = ((bestW >> 3) & 1) === 1 ? 'L' : 'M';
  const mask = bestW & 7;
  let raw2 = 0;
  const b2 = [];
  for (let i = 0; i <= 7; i++) b2[i] = get(n - 1 - i, 8);
  for (let i = 8; i <= 14; i++) b2[i] = get(8, n - 15 + i);
  for (let i = 0; i < 15; i++) raw2 |= b2[i] << i;
  if (raw2 !== raw) throw new Error('the two format copies disagree');
  const fn = qrFunc(v);
  const cw = [];
  let cur = 0, cnt = 0, up = true;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let k = 0; k < n; k++) {
      const row = up ? (n - 1 - k) : k;
      for (let s = 0; s < 2; s++) {
        const c = col - s;
        if (fn[row][c]) continue;
        let b = get(row, c);
        if (qrMask(mask, row, c)) b ^= 1;
        cur = (cur << 1) | b; cnt++;
        if (cnt === 8) { cw.push(cur); cur = 0; cnt = 0; }
      }
    }
    up = !up;
  }
  const spec = QR_BLOCKS[v + lvl];
  const ecLen = spec[0];
  const sizes = [];
  for (const gr of spec[1]) for (let i = 0; i < gr[0]; i++) sizes.push(gr[1]);
  const nb = sizes.length;
  const dBlocks = sizes.map(() => []);
  const eBlocks = sizes.map(() => []);
  const maxD = Math.max.apply(null, sizes);
  let at = 0;
  for (let i = 0; i < maxD; i++) for (let b = 0; b < nb; b++) if (i < sizes[b]) dBlocks[b].push(cw[at++]);
  for (let i = 0; i < ecLen; i++) for (let b = 0; b < nb; b++) eBlocks[b].push(cw[at++]);
  for (let b = 0; b < nb; b++) {
    const full = dBlocks[b].concat(eBlocks[b]);
    for (let s = 0; s < ecLen; s++) {
      let acc = 0;
      const a = qrExp[s];
      for (let i = 0; i < full.length; i++) acc = qrMul(acc, a) ^ full[i];
      if (acc !== 0) throw new Error('Reed-Solomon syndrome ' + s + ' is non-zero on block ' + b);
    }
  }
  const stream = [];
  for (const b of dBlocks) for (const x of b) stream.push(x);
  let bp = 0;
  const take = (k) => {
    let r = 0;
    for (let i = 0; i < k; i++) { r = (r << 1) | ((stream[bp >> 3] >> (7 - (bp & 7))) & 1); bp++; }
    return r;
  };
  const mode = take(4);
  if (mode !== 4) throw new Error('mode indicator is ' + mode + ', not byte (4)');
  const len = take(8);
  const bytes = [];
  for (let i = 0; i < len; i++) bytes.push(take(8));
  return { text: Buffer.from(bytes).toString('utf8'), version: v, level: lvl, mask: mask };
};

// Twenty-four real-shaped addresses, graded from 18 to 160 characters.
const qrCases = [];
for (let k = 0; k < 24; k++) {
  const len = Math.round(18 + (k * (160 - 18)) / 23);
  let s = 'https://islamqa.info/ar/answers/';
  if (len < s.length) s = 'https://islamqa.info/'.slice(0, len);
  let i = 0;
  while (s.length < len) s += 'abcdefghijklmnopqrstuvwxyz0123456789-'[i++ % 37];
  qrCases.push(s.slice(0, len));
}

head('1) QR ROUND TRIP -- 24 addresses, 18 to 160 characters');
const capM6 = call('ezikQrCapacity')(6, 'M');
const capL6 = call('ezikQrCapacity')(6, 'L');
console.log('  capacity ceiling: v6-M = ' + capM6 + ' bytes, v6-L = ' + capL6 + ' bytes');
let qrOk = 0, qrBad = 0, qrNone = 0;
for (const url of qrCases) {
  const r = call('ezikQrEncode')(url);
  if (!r) {
    qrNone++;
    console.log('  len=' + String(url.length).padStart(3) + '  NO BARCODE -- ' + Buffer.byteLength(url, 'utf8')
      + ' bytes is past v6-L (' + capL6 + '); the short source name stands alone');
    continue;
  }
  try {
    const d = qrDecode(r.modules, r.size);
    if (d.text === url && d.version === r.version && d.level === r.level && d.mask === r.mask) {
      qrOk++;
      console.log('  len=' + String(url.length).padStart(3) + '  v' + r.version + '-' + r.level
        + '  mask ' + r.mask + '  ' + r.size + 'x' + r.size + '  EXACT');
    } else {
      qrBad++;
      console.log('  len=' + String(url.length).padStart(3) + '  MISMATCH  ' + JSON.stringify(d.text).slice(0, 60));
    }
  } catch (e) { qrBad++; console.log('  len=' + String(url.length).padStart(3) + '  THREW  ' + e.message); }
}
console.log('  --> encoded ' + (qrOk + qrBad) + '  exact ' + qrOk + '  wrong ' + qrBad + '  over capacity ' + qrNone);
ok('every address that produced a barcode decoded back byte for byte', qrBad === 0, qrBad + ' failed');
ok('every address that produced none was genuinely past the v6-L ceiling',
  qrCases.filter((u) => Buffer.byteLength(u, 'utf8') > capL6).length === qrNone,
  'the no-barcode count and the over-capacity count disagree');
eq('the 24 cases are all accounted for', qrOk + qrBad + qrNone, 24);
// The level policy, measured rather than read: M for everything it holds, L only past it.
{
  const short = call('ezikQrEncode')('https://a.info/x');
  const long = call('ezikQrEncode')(qrCases.filter((u) => u.length > capM6 && u.length <= capL6)[0] || 'x');
  eq('a short address takes level M', short && short.level, 'M');
  eq('...and one past the M ceiling takes L rather than no barcode', long && long.level, 'L');
}

/* =============================================================================================
 * 2. THE CLOSED STRUCTURE -- TWELVE SYNTHETIC ANSWERS, ZERO BROKEN CARDS
 * ========================================================================================== */
const W = call('EZIK_CARD_W');
// A recording 2D context. 20 units a character: enough that a long field must wrap and stable
// enough that a line count is arithmetic rather than a font's opinion. It is the same instrument
// theme-coverage-guard.cjs measures the old skin with.
const makeCanvas = () => {
  const rec = { text: [], rect: [], arc: [], line: [], fill: 0, stroke: 0, ops: [] };
  const ctx = {
    fillStyle: '', strokeStyle: '', font: '', globalAlpha: 1, textAlign: '', textBaseline: '', direction: '', lineWidth: 1,
    save() {}, restore() {}, beginPath() { rec.ops.push('beginPath'); }, closePath() { rec.ops.push('closePath'); },
    moveTo(x, y) { rec.ops.push('moveTo'); rec.line.push([x, y]); },
    lineTo(x, y) { rec.ops.push('lineTo'); rec.line.push([x, y]); },
    arc(x, y, r, a, b) { rec.ops.push('arc'); rec.arc.push([x, y, r, a, b]); },
    fill() { rec.ops.push('fill'); rec.fill++; },
    stroke() { rec.ops.push('stroke'); rec.stroke++; },
    fillRect(x, y, w, h) { rec.ops.push('fillRect'); rec.rect.push([x, y, w, h]); },
    measureText(t) { return { width: String(t).length * 20 }; },
    fillText(t, x, y) { rec.text.push({ t: String(t), x: x, y: y }); },
  };
  const canvas = {
    width: 0, height: 0, rec: rec,
    getContext() { return ctx; },
    toDataURL(type) { this.askedFor = type; return 'data:image/png;base64,ZHJhd24='; },
  };
  return canvas;
};
const draw = (opts) => {
  const canvas = makeCanvas();
  CTX.__cardOpts = Object.assign({ canvas: canvas }, opts);
  const r = call('ezikDrawReplyCard(__cardOpts)');
  return { r: r, canvas: canvas, rec: canvas.rec };
};
// Numbers only: a card whose geometry carries a NaN draws a blank rectangle in a real browser
// and nothing at all in some, which is exactly the "broken card" rule 5 forbids.
const geometrySane = (d) => {
  const fin = (n) => Number.isFinite(n);
  for (const [x, y, w, h] of d.rec.rect) if (!fin(x) || !fin(y) || !fin(w) || !fin(h)) return 'a rect carries a non-number';
  for (const t of d.rec.text) if (!fin(t.x) || !fin(t.y)) return 'a text run carries a non-number';
  for (const a of d.rec.arc) for (const n of a) if (!fin(n)) return 'an arc carries a non-number';
  for (const p of d.rec.line) for (const n of p) if (!fin(n)) return 'a path point carries a non-number';
  if (!fin(d.r.h) || d.r.h <= 0) return 'the card height is ' + d.r.h;
  if (d.canvas.height !== d.r.h) return 'the canvas was sized to ' + d.canvas.height + ' but the card reports ' + d.r.h;
  if (d.canvas.askedFor !== 'image/png') return 'the canvas was not asked for a PNG';
  if (!d.rec.text.length) return 'nothing was written on the card';
  return '';
};

const pt = (icon, head_, l1, l2) => ({ icon: icon, head: head_, line1: l1, line2: l2 === undefined ? '' : l2 });
const GOOD3 = { title: 'حكمُ صيامِ يومِ عاشوراء', source: 'islamqa.info', points: [
  pt('star', 'سنّةٌ مؤكَّدة', 'صيامُه سنّةٌ ثابتةٌ عن النبيِّ صلّى اللهُ عليه وسلّم', ''),
  pt('arch', 'يومُ عاشوراء', 'هو اليومُ العاشرُ من شهرِ اللهِ المحرَّم', 'ويُستحَبُّ صومُ التاسعِ معه'),
  pt('dot', 'فضلُه', 'يُكفِّرُ السنةَ الماضية، كما جاء في الحديثِ الصحيح', '')] };
const more = (n, base) => {
  const o = JSON.parse(JSON.stringify(base));
  const keys = ['bars', 'tri', 'dot', 'star', 'arch'];
  while (o.points.length < n) o.points.push(pt(keys[o.points.length % 5], 'نقطةٌ إضافيّة',
    'سطرٌ أوّلُ لهذه النقطةِ الإضافيّةِ بطولٍ معقول', 'وسطرٌ ثانٍ تحته'));
  while (o.points.length > n) o.points.pop();
  return o;
};
const longStr = (n) => 'ا'.repeat(n);
const CASES = [
  ['three points, line2 empty on one of them', JSON.stringify(GOOD3), true],
  ['four points', JSON.stringify(more(4, GOOD3)), true],
  ['five points', JSON.stringify(more(5, GOOD3)), true],
  ['a valid object wrapped in prose the model added anyway',
    'تفضَّلْ يا بنيَّ، هذا الملخَّص:\n' + JSON.stringify(GOOD3) + '\nوباللهِ التوفيق.', true],
  ['an icon key outside the list of five', JSON.stringify((() => {
    const o = JSON.parse(JSON.stringify(GOOD3)); o.points[0].icon = 'camel'; return o;
  })()), true],
  ['two points -- below the floor', JSON.stringify(more(2, GOOD3)), false],
  ['six points -- above the ceiling', JSON.stringify(more(6, GOOD3)), false],
  ['a title one character too long', JSON.stringify(Object.assign({}, GOOD3, { title: longStr(47) })), false],
  ['a head one character too long', JSON.stringify((() => {
    const o = JSON.parse(JSON.stringify(GOOD3)); o.points[1].head = longStr(31); return o;
  })()), false],
  ['a line1 one character too long', JSON.stringify((() => {
    const o = JSON.parse(JSON.stringify(GOOD3)); o.points[2].line1 = longStr(63); return o;
  })()), false],
  ['a full address where the short source name belongs',
    JSON.stringify(Object.assign({}, GOOD3, { source: 'https://islamqa.info/ar/answers/21775' })), false],
  ['the model declining, which it was told to do with a bare null', 'null', false],
];
head('2) THE CLOSED STRUCTURE -- 12 synthetic answers');
const REPLY = 'نصُّ الجوابِ كما يصلُ البطاقةَ اليوم.\n\nالمصدر: islamqa.info';
const URL0 = 'https://islamqa.info/ar/answers/21775';
let sOk = 0, sBad = 0, newSkin = 0, oldSkin = 0;
for (const [name, payload, shouldDraw] of CASES) {
  let verdict = '', detail = '';
  try {
    CTX.__raw = payload;
    const parsed = call('ezikSumParse(__raw)');
    CTX.__parsed = parsed;
    const sum = call('ezikSummaryValid(__parsed)');
    const d = draw({ text: REPLY, source: { links: 'islamqa.info', attribution: '', notice: '' }, url: URL0, summary: sum });
    const bad = geometrySane(d);
    const drewNew = !!sum;
    if (bad) { verdict = 'BROKEN'; detail = bad; }
    else if (drewNew !== shouldDraw) { verdict = 'WRONG BRANCH'; detail = 'summary=' + drewNew + ' expected=' + shouldDraw; }
    else { verdict = drewNew ? 'NEW SKIN  h=' + d.r.h + ' points=' + d.r.lines : 'OLD SKIN  h=' + d.r.h + ' lines=' + d.r.lines; }
    if (drewNew) newSkin++; else oldSkin++;
  } catch (e) { verdict = 'THREW'; detail = e.message; }
  if (verdict === 'BROKEN' || verdict === 'THREW' || verdict === 'WRONG BRANCH') { sBad++; console.log('  FAIL  ' + name + ' -> ' + verdict + '  ' + detail); }
  else { sOk++; console.log('  ok    ' + name + ' -> ' + verdict); }
}
console.log('  --> ' + sOk + '/' + CASES.length + ' correct  (' + newSkin + ' new skin, ' + oldSkin + ' fell back)  broken cards: ' + sBad);
eq('every synthetic answer produced a card, and never a broken one', sOk + '/' + CASES.length, CASES.length + '/' + CASES.length);
// The unknown key did not reach the painter as itself.
{
  const o = JSON.parse(JSON.stringify(GOOD3)); o.points[0].icon = 'camel';
  CTX.__parsed = o;
  const v = call('ezikSummaryValid(__parsed)');
  eq('an icon key outside the list becomes dot rather than reaching the painter', v.points[0].icon, 'dot');
}

/* =============================================================================================
 * 3. THE ICONS -- WHAT EACH KEY ACTUALLY DRAWS
 * ========================================================================================== */
head('3) ICON KEYS -- every key, and the primitives its painter called');
const ICONS = call('EZIK_SUM_ICONS');
const SHAPE = {
  dot: 'a filled disc inside a thin open ring -- two circles, concentric',
  star: 'one five-pointed star, filled, drawn as a ten-vertex closed polygon',
  arch: 'a stroked arch -- a half-circle arc standing on two straight jambs',
  bars: 'three stacked rectangles, widest at the top',
  tri: 'a filled upward triangle above one straight rule',
};
let iconBad = 0;
for (const key of ICONS.concat(['camel-that-never-gets-here'])) {
  const canvas = makeCanvas();
  const ctx = canvas.getContext();
  CTX.__ic = ctx;
  CTX.__key = key;
  call('ezikSumIcon(__ic, __key, 0, 0, 52, "#000")');
  const r = canvas.rec;
  const prim = [];
  if (r.rect.length) prim.push(r.rect.length + ' rect');
  if (r.arc.length) prim.push(r.arc.length + ' arc/circle');
  if (r.line.length) prim.push(r.line.length + ' path point');
  const known = ICONS.indexOf(key) !== -1;
  console.log('  ' + (known ? key : '(any other key)').padEnd(24) + prim.join(' + ').padEnd(34)
    + (known ? SHAPE[key] : 'falls through to dot -- ' + SHAPE.dot));
  if (!r.rect.length && !r.arc.length && !r.line.length) iconBad++;
}
ok('every icon key draws something, and only rectangles, circles, arcs, lines and polygons',
  iconBad === 0, iconBad + ' key(s) drew nothing');
eq('the vocabulary is exactly five keys', ICONS.length, 5);
ok('...and the painter has no path that is not one of them',
  ICONS.indexOf(call('EZIK_SUM_ICON_FALLBACK')) !== -1);

/* =============================================================================================
 * 4. THE HEIGHT FOLLOWS THE CONTENT
 * ========================================================================================== */
head('4) CARD HEIGHT vs POINT COUNT');
const heights = [];
for (const n of [3, 4, 5]) {
  CTX.__parsed = more(n, GOOD3);
  const sum = call('ezikSummaryValid(__parsed)');
  const d = draw({ text: REPLY, source: { links: 'islamqa.info', attribution: '', notice: '' }, url: URL0, summary: sum });
  heights.push(d.r.h);
  console.log('  ' + n + ' points  ->  ' + W + ' x ' + d.r.h + '   (canvas sized to ' + d.canvas.height + ')');
}
ok('three different heights, each taller than the one before',
  heights[0] < heights[1] && heights[1] < heights[2], heights.join(' / '));
ok('...and none of them is the old skin\'s fixed floor', heights.every((h) => h !== 1350), heights.join(' / '));
// The old skin is still exactly what it was -- this is the fallback, and it is not allowed to
// have moved while the new skin was being built on top of it.
{
  const d = draw({ text: 'السلام عليكم', source: 'example.com' });
  eq('the OLD skin still draws at its declared floor', d.r.h, 1350);
  eq('...and still reports itself uncut', d.r.cut, false);
}

/* =============================================================================================
 * 5. THE PREVIEW -- ONE REAL PNG OUT OF A REAL CANVAS
 * =============================================================================================
 * A vm and a recording context prove geometry; they cannot prove that a browser shapes Arabic
 * inside fillText and hands back a decodable PNG. That needs a real canvas, so this launches
 * headless Chrome against a page that loads the very same shipped block, draws one card from a
 * real example and posts the bytes back. No CDP socket and no package: the page does the POST.
 * ========================================================================================== */
const previewAt = process.argv.indexOf('--preview');
if (previewAt !== -1) {
  const out = process.argv[previewAt + 1] || path.join(ROOT, 'CARD-PREVIEW.png');
  const EXAMPLE = {
    title: 'حكمُ صيامِ يومِ عاشوراء',
    source: 'islamqa.info',
    points: [
      pt('star', 'سنّةٌ مؤكَّدة', 'صيامُ عاشوراءَ سنّةٌ ثابتةٌ عن النبيِّ ﷺ، وليس بواجب', ''),
      pt('arch', 'أيُّ يومٍ هو', 'هو اليومُ العاشرُ من شهرِ اللهِ المحرَّم', 'ويُستحَبُّ صومُ التاسعِ معه مخالفةً لأهلِ الكتاب'),
      pt('dot', 'فضلُ صيامِه', 'يُكفِّرُ اللهُ به ذنوبَ السنةِ التي قبلَه', ''),
      pt('bars', 'على مَن يُستحَبّ', 'يُستحَبُّ للرجالِ والنساءِ، وللصغيرِ إن أطاقَه', ''),
    ],
  };
  const jsCode = code;
  const page = '<!DOCTYPE html><html lang="ar" dir="rtl" data-theme="dark" data-ezik-visual-theme="istana_33">'
    + '<head><meta charset="utf-8"><style>' + fs.readFileSync(INDEX, 'utf8').slice(
      fs.readFileSync(INDEX, 'utf8').indexOf('<style>') + 7,
      fs.readFileSync(INDEX, 'utf8').indexOf('</style>')) + '</style></head>'
    + '<body><div id="root"></div>'
    + '<script src="/vendor/react.umd.js"></script><script src="/vendor/react-dom.umd.js"></script>'
    + '<script>ReactDOM.createRoot=function(){return{render:function(){},unmount:function(){}};};</script>'
    + '<script>\n' + jsCode + '\n'
    + 'try{\n'
    + '  var card = ezikDrawReplyCard({ text: "", source: { links: "islamqa.info", attribution: "", notice: "" },'
    + '    url: ' + JSON.stringify(URL0) + ', summary: ' + JSON.stringify(EXAMPLE) + ' });\n'
    + '  var cs = getComputedStyle(document.documentElement);\n'
    + '  var pal = {}; for (var k in EZIK_SUM_TOKENS) pal[k] = cs.getPropertyValue(EZIK_SUM_TOKENS[k]).trim();\n'
    + '  fetch("/card", { method: "POST", body: JSON.stringify({ url: card.url, w: card.w, h: card.h, pal: pal }) });\n'
    + '} catch (e) { fetch("/card", { method: "POST", body: JSON.stringify({ error: String(e && e.stack || e) }) }); }\n'
    + '</script></body></html>';
  head('5) PREVIEW -- headless Chrome, a real canvas');
  let done = null;
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/card') {
      let b = '';
      req.on('data', (c) => { b += c; });
      req.on('end', () => { res.end('ok'); if (done) done(JSON.parse(b)); });
      return;
    }
    if (req.url === '/' || req.url === '/index.html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(page);
    }
    const f = path.join(ROOT, req.url.replace(/^\//, '').split('?')[0]);
    if (f.startsWith(ROOT) && fs.existsSync(f) && fs.statSync(f).isFile()) {
      if (/\.js$/.test(f)) res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
      return res.end(fs.readFileSync(f));
    }
    res.statusCode = 404; res.end('no');
  });
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].filter((p) => fs.existsSync(p))[0];
    if (!chrome) { ok('a Chrome to draw the preview in was found', false, 'no chrome.exe'); server.close(); return; }
    const prof = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ezik-card-'));
    const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--user-data-dir=' + prof, '--window-size=1200,2400', 'http://127.0.0.1:' + port + '/'],
      { stdio: 'ignore' });
    const timer = setTimeout(() => { ok('the browser answered', false, 'timed out'); try { proc.kill(); } catch (e) {} server.close(); process.exit(F ? 1 : 0); }, 60000);
    done = (msg) => {
      clearTimeout(timer);
      try { proc.kill(); } catch (e) {}
      server.close();
      if (msg.error) { ok('the card drew in a real browser', false, msg.error); finish(); return; }
      const b64 = String(msg.url).replace(/^data:image\/png;base64,/, '');
      const buf = Buffer.from(b64, 'base64');
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, buf);
      const png = buf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
      const iw = buf.readUInt32BE(16), ih = buf.readUInt32BE(20);
      ok('the browser returned a real PNG', png, buf.subarray(0, 8).toString('hex'));
      eq('...at the card width the renderer reports', iw, msg.w);
      eq('...and at the height it computed', ih, msg.h);
      console.log('  wrote ' + out + '  ' + buf.length + ' bytes  ' + iw + 'x' + ih);
      console.log('  sha256 ' + require('crypto').createHash('sha256').update(buf).digest('hex'));
      // THE PALETTE THE BROWSER ACTUALLY RESOLVED, printed rather than claimed: every role on
      // this card came out of a --vt-* token of the shipped identity, and these are the values.
      console.log('  resolved theme tokens:');
      for (const k of Object.keys(msg.pal || {})) console.log('    ' + k.padEnd(10) + msg.pal[k]);
      // AND THE BARCODE, READ BACK OUT OF THE IMAGE ITSELF. Not off the matrix the encoder
      // returned -- off the PIXELS a browser painted and a PNG encoder compressed. The white
      // frame is the only pure white region on the card, so it is found by its own colour, the
      // module size is the one integer that divides it by a legal symbol span, and the sampled
      // grid goes through the same independent decoder section 1 used.
      try {
        const px = readPng(buf);
        const box = whiteBox(px);
        ok('the barcode\'s white frame is in the painted image', !!box,
          'no pure-white square was found in the preview');
        if (box) {
          const side = box.x1 - box.x0 + 1;
          let got = null, tried = [];
          for (const v of [2, 3, 4, 5, 6]) {
            const span = 17 + 4 * v + 8;
            if (side % span !== 0) continue;
            const unit = side / span;
            tried.push('v' + v + ' unit=' + unit);
            const n = 17 + 4 * v;
            const mods = [];
            for (let i = 0; i < n; i++) {
              const row = new Uint8Array(n);
              for (let j = 0; j < n; j++) {
                const cx = box.x0 + (4 + j) * unit + Math.floor(unit / 2);
                const cy = box.y0 + (4 + i) * unit + Math.floor(unit / 2);
                row[j] = px.at(cx, cy)[0] < 128 ? 1 : 0;
              }
              mods.push(row);
            }
            try { got = qrDecode(mods, n); break; } catch (e) { tried.push('  v' + v + ' -> ' + e.message); }
          }
          console.log('  barcode sampled off the PNG: ' + (got ? ('v' + got.version + '-' + got.level + ' mask ' + got.mask) : tried.join(' | ')));
          eq('the barcode in the PRINTED IMAGE decodes back to the source address',
            got && got.text, URL0);
        }
      } catch (e) { ok('the preview PNG could be read back', false, e.message); }
      finish();
    };
  });
} else {
  finish();
}

/* A minimal PNG reader: 8-bit RGB or RGBA, no interlace, which is what a canvas produces.
 * zlib is in Node; nothing is installed for this. */
function readPng(buf) {
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('not a PNG');
  let at = 8, w = 0, h = 0, depth = 0, type = 0, inter = 0;
  const idat = [];
  while (at < buf.length) {
    const len = buf.readUInt32BE(at);
    const tag = buf.subarray(at + 4, at + 8).toString('latin1');
    const body = buf.subarray(at + 8, at + 8 + len);
    if (tag === 'IHDR') {
      w = body.readUInt32BE(0); h = body.readUInt32BE(4);
      depth = body[8]; type = body[9]; inter = body[12];
    } else if (tag === 'IDAT') idat.push(body);
    else if (tag === 'IEND') break;
    at += 12 + len;
  }
  if (depth !== 8 || inter !== 0 || (type !== 6 && type !== 2)) {
    throw new Error('unexpected PNG shape: depth=' + depth + ' type=' + type + ' interlace=' + inter);
  }
  const bpp = type === 6 ? 4 : 3;
  const raw = require('zlib').inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(w * h * bpp);
  const stride = w * bpp;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = src[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[i] = v & 255;
    }
  }
  return { w: w, h: h, bpp: bpp, at: (x, y) => out.subarray((y * w + x) * bpp, (y * w + x) * bpp + bpp) };
}
/* The pure-white bounding box: on this card it is the barcode's frame and nothing else. */
function whiteBox(px) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
    const p = px.at(x, y);
    if (p[0] === 255 && p[1] === 255 && p[2] === 255) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  return { x0: x0, y0: y0, x1: x1, y1: y1 };
}

function finish() {
  console.log('\n==================================================================');
  console.log(' CARD SKIN PROBE   PASS=' + P + '   FAIL=' + F);
  console.log('==================================================================');
  process.exitCode = F ? 1 : 0;
}
