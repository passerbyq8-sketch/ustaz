#!/usr/bin/env node
/* =============================================================================================
 * ITEM 94 · THE SHARE CARD'S SKIN — THE MEASUREMENT PROBE  (round two, 2026-09-13)
 * =============================================================================================
 * THIS IS A PROBE, NOT A GATE. It is registered in no roster and run by hand; the gate suite
 * stays at the count it had so that a run before this item and a run after it are comparable.
 *
 * WHAT IT MEASURES, and every number it prints is produced by CALLING the shipped code rather
 * than by reading it:
 *
 *   1    QR ROUND TRIP      an independent decoder, written below, recovers the format bits,
 *                           unmasks the matrix, de-interleaves the blocks, checks every
 *                           Reed-Solomon syndrome and parses the byte stream back out. 24
 *                           addresses of graded length go in; what comes out must be the same
 *                           bytes.
 *   1-B  THE PAYLOAD        round two puts the APP's address in the symbol instead of the
 *                           source's. It is read out of the tree and the line is printed.
 *   2    STRUCTURE          seventeen synthetic model answers against round two's narrower
 *                           caps, each of which must either draw the new card or fall back to
 *                           the old one. A third outcome is the failure.
 *   3    THE GRAMMAR        24 combinations of the six shape keys, every one resolved through
 *                           the shipped resolver and drawn. Three properties are read off the
 *                           op list each one produced: the numbers and the arrows never meet,
 *                           nothing is written at or below the bottom strip, and no drawn
 *                           string looks like an address.
 *   4    DETERMINISM        the same answer, three times, one fingerprint.
 *   5    DIAGRAM KEYS       every key, with the primitives its painter ACTUALLY called recorded
 *                           off a recording context -- so «no living beings» is measured, not
 *                           asserted -- and the colours it actually set.
 *   6    THE PALETTE        every colour the card was drawn in, against the locked list.
 *   7    CARD HEIGHTS       two, three and four points, drawn, and the heights read off the
 *                           canvas the renderer sized.
 *   8    PREVIEW (--preview)  real PNGs, out of a real canvas in a real browser, with the
 *                           barcode read back out of the painted pixels and the determinism
 *                           half repeated on real image bytes.
 *
 * USAGE
 *   node tools/card-skin-measure.cjs
 *   node tools/card-skin-measure.cjs --preview <out.png> [--shape f,fl,g,d,s,w] [--summary x.json]
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
 * 1-B. THE PAYLOAD ROUND TWO PUTS IN THE SYMBOL -- MEASURED OUT OF THE TREE, NEVER WRITTEN HERE
 * =============================================================================================
 * The owner's second new order: the barcode leads to ezik, not to the source. The address is
 * therefore READ off the shipped client rather than typed into this probe, and the line it was
 * read from is printed beside it so the reading can be checked.
 * ========================================================================================== */
head('1-B) THE BARCODE PAYLOAD -- read out of the tree');
const APPJSX = fs.readFileSync(path.join(ROOT, 'app.jsx'), 'utf8').split(/\r?\n/);
const SMART_AT = APPJSX.findIndex((l) => l.indexOf('const EZIK_SMART_LINK_URL =') === 0) + 1;
const SMART = call('EZIK_SMART_LINK_URL');
const APP_AT = APPJSX.findIndex((l) => l.indexOf('const EZIK_APP_URL =') === 0) + 1;
console.log('  payload           ' + SMART);
console.log('  read from         app.jsx line ' + SMART_AT + '  (const EZIK_SMART_LINK_URL)');
console.log('  the alternative   ' + call('EZIK_APP_URL') + '  at app.jsx line ' + APP_AT + '  (const EZIK_APP_URL)');
ok('the payload is the address the tree declares, not one written in this probe',
  SMART === APPJSX[SMART_AT - 1].split("'")[1], APPJSX[SMART_AT - 1]);
{
  const r = call('ezikQrEncode')(SMART);
  ok('the new payload encodes', !!r);
  const d = qrDecode(r.modules, r.size);
  console.log('  encoded as        v' + r.version + '-' + r.level + '  mask ' + r.mask + '  ' + r.size + 'x' + r.size);
  eq('...and decodes back to the same address, byte for byte', d.text, SMART);
}
ok('and no source address reaches the symbol any more -- the card path encodes ONE constant',
  /ezikSummaryLayout\(ctx0, summary, shape, innerW, EZIK_SMART_LINK_URL,/.test(APPJSX.join('\n')),
  'the summary layout is being handed something other than the smart link');

/* =============================================================================================
 * 2. THE CLOSED STRUCTURE -- ROUND TWO'S NARROWER CAPS, AND ZERO BROKEN CARDS
 * ========================================================================================== */
const W = call('EZIK_CARD_W');
const PAL = call('EZIK_PAL');
const PAL_VALUES = {};
for (const k of Object.keys(PAL)) PAL_VALUES[String(PAL[k]).toUpperCase()] = k;
// A recording 2D context. 20 units a character: enough that a long field must wrap and stable
// enough that a line count is arithmetic rather than a font's opinion. It is the same instrument
// theme-coverage-guard.cjs measures the old skin with, widened to record the COLOUR every
// primitive was actually drawn in -- which is what makes the palette proof a measurement.
const makeCanvas = () => {
  const rec = { text: [], rect: [], arc: [], line: [], fill: 0, stroke: 0, ops: [], colours: [], prims: [] };
  const note = (prim, colour) => {
    rec.prims.push(prim);
    if (colour) rec.colours.push(String(colour).toUpperCase());
  };
  const ctx = {
    fillStyle: '', strokeStyle: '', font: '', globalAlpha: 1, textAlign: '', textBaseline: '', direction: '', lineWidth: 1,
    save() {}, restore() {}, beginPath() { rec.ops.push('beginPath'); }, closePath() { rec.ops.push('closePath'); },
    moveTo(x, y) { rec.ops.push('moveTo'); rec.line.push([x, y]); },
    lineTo(x, y) { rec.ops.push('lineTo'); rec.line.push([x, y]); },
    arc(x, y, r, a, b) { rec.ops.push('arc'); rec.arc.push([x, y, r, a, b]); },
    fill() { rec.ops.push('fill'); rec.fill++; note('fill', this.fillStyle); },
    stroke() { rec.ops.push('stroke'); rec.stroke++; note('stroke', this.strokeStyle); },
    fillRect(x, y, w, h) { rec.ops.push('fillRect'); rec.rect.push([x, y, w, h]); note('fillRect', this.fillStyle); },
    measureText(t) { return { width: String(t).length * 20 }; },
    fillText(t, x, y) { rec.text.push({ t: String(t), x: x, y: y, c: String(this.fillStyle).toUpperCase() }); note('fillText', this.fillStyle); },
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
// and nothing at all in some, which is exactly the "broken card" the order forbids.
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

const pt = (dia, head_, l1, l2, labels) => ({ dia: dia, head: head_, line1: l1,
  line2: l2 === undefined ? '' : l2, labels: labels || [] });
const GOOD3 = { title: 'حكمُ صيامِ يومِ عاشوراء', points: [
  pt('day-mark', 'أيُّ يومٍ هو', 'هو اليومُ العاشرُ من شهرِ المحرَّم', '', ['١٠']),
  pt('two-days', 'وصومُ التاسع', 'يُستحَبُّ أن تصومَ التاسعَ معه', 'وهو أتمُّ للأجر', ['٩', '١٠']),
  pt('page-check', 'فضلُه', 'يُكفِّرُ ذنوبَ السنةِ التي قبلَه', '', ['يُكفِّر'])] };
const DIA_CYCLE = ['balance', 'ratio-bar', 'clock-window', 'shield-check', 'coin-stack'];
const more = (n, base) => {
  const o = JSON.parse(JSON.stringify(base));
  while (o.points.length < n) o.points.push(pt(DIA_CYCLE[o.points.length % 5], 'نقطةٌ إضافيّة',
    'سطرٌ أوّلُ لهذه النقطةِ بطولٍ معقول', 'وسطرٌ ثانٍ تحته', ['وسم', 'آخر']));
  while (o.points.length > n) o.points.pop();
  return o;
};
const longStr = (n) => 'ا'.repeat(n);
const CASES = [
  ['two points -- the new floor', JSON.stringify(more(2, GOOD3)), true],
  ['three points', JSON.stringify(GOOD3), true],
  ['four points -- the new ceiling', JSON.stringify(more(4, GOOD3)), true],
  ['a valid object wrapped in prose the model added anyway',
    'تفضَّلْ يا بنيَّ، هذا الملخَّص:\n' + JSON.stringify(GOOD3) + '\nوباللهِ التوفيق.', true],
  ['a diagram key outside the fourteen', JSON.stringify((() => {
    const o = JSON.parse(JSON.stringify(GOOD3)); o.points[0].dia = 'camel'; return o;
  })()), true],
  ['a label eleven characters long -- CUT, never refused', JSON.stringify((() => {
    const o = JSON.parse(JSON.stringify(GOOD3)); o.points[0].labels = ['ابجدهوزحطيك']; return o;
  })()), true],
  ['a shape key outside its list -- DEFAULTED, never a fallback', JSON.stringify((() => {
    const o = JSON.parse(JSON.stringify(GOOD3)); o.shape = { frame: 'gilded', flow: 'rows' }; return o;
  })()), true],
  ['one point -- below the new floor', JSON.stringify(more(1, GOOD3)), false],
  ['five points -- above the new ceiling', JSON.stringify(more(5, GOOD3)), false],
  ['a title one character past 40', JSON.stringify(Object.assign({}, GOOD3, { title: longStr(41) })), false],
  ['a head one character past 22', JSON.stringify((() => {
    const o = JSON.parse(JSON.stringify(GOOD3)); o.points[1].head = longStr(23); return o;
  })()), false],
  ['a line1 one character past 52', JSON.stringify((() => {
    const o = JSON.parse(JSON.stringify(GOOD3)); o.points[2].line1 = longStr(53); return o;
  })()), false],
  ['a bare domain smuggled into a head', JSON.stringify((() => {
    const o = JSON.parse(JSON.stringify(GOOD3)); o.points[0].head = 'islamqa.info'; return o;
  })()), false],
  ['a full address smuggled into line2', JSON.stringify((() => {
    const o = JSON.parse(JSON.stringify(GOOD3)); o.points[1].line2 = 'https://x.example/ar/1'; return o;
  })()), false],
  ['a domain smuggled into a drawing label', JSON.stringify((() => {
    const o = JSON.parse(JSON.stringify(GOOD3)); o.points[2].labels = ['ezik.app']; return o;
  })()), false],
  ['a site name smuggled into the title', JSON.stringify(Object.assign({}, GOOD3, { title: 'انظرْ www.example' })), false],
  ['the model declining, which it was told to do with a bare null', 'null', false],
];
head('2) THE CLOSED STRUCTURE -- ' + CASES.length + ' synthetic answers');
const REPLY = 'نصُّ الجوابِ كما يصلُ البطاقةَ اليوم، وفيه ما يكفي لبصمةٍ ثابتة.';
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
// The unknown key did not reach the painter as itself, and the long label was cut rather than lost.
{
  const o = JSON.parse(JSON.stringify(GOOD3));
  o.points[0].dia = 'camel';
  o.points[0].labels = ['ابجدهوزحطيك', 'ثان'];
  CTX.__parsed = o;
  const v = call('ezikSummaryValid(__parsed)');
  eq('a diagram key outside the fourteen becomes the plain mark', v.points[0].icon, call('EZIK_DIA_FALLBACK'));
  eq('...and an eleven-character label is cut to ten', v.points[0].labels[0].length, 10);
  eq('...and the labels beside it survive', v.points[0].labels[1], 'ثان');
}

/* =============================================================================================
 * 3. THE SHAPE GRAMMAR -- 24 COMBINATIONS, EVERY ONE DRAWN
 * =============================================================================================
 * The grammar is read off the shipped client, so the count below is the client's count and not
 * a number typed here. Every combination is RESOLVED through the shipped resolver -- which is
 * where grid2 without four points and stack without two become rows -- and then DRAWN, twice:
 * once through ezikDrawReplyCard for the height a real canvas would be sized to, and once
 * through ezikSummaryLayout for the op list the three proofs below read.
 * ========================================================================================== */
head('3) THE SHAPE GRAMMAR -- 24 combinations');
const GRAM = call('EZIK_SHAPE_GRAMMAR');
const GKEYS = call('EZIK_SHAPE_KEYS');
{
  let total = 1;
  for (const k of GKEYS) total *= GRAM[k].length;
  console.log('  the grammar: ' + GKEYS.map((k) => k + '=' + GRAM[k].length).join('  ')
    + '  ->  ' + total + ' x 3 point counts = ' + (total * 3) + ' pages');
  ok('the grammar carries more than the 900 distinct pages the order asks for', total * 3 > 900, String(total * 3));
}
const COMBOS = [];
for (let i = 0; i < 24; i++) {
  COMBOS.push({
    frame: GRAM.frame[i % 3],
    flow: GRAM.flow[Math.floor(i / 3) % 3],
    guide: GRAM.guide[Math.floor(i / 2) % 3],
    disc: GRAM.disc[i % 2],
    side: GRAM.side[Math.floor(i / 4) % 3],
    weight: GRAM.weight[Math.floor(i / 6) % 2],
    points: [2, 3, 4][Math.floor(i / 8) % 3],
  });
}
const INNER = W - call('EZIK_CARD_PAD') * 2;
const layoutOf = (sum, shape) => {
  const canvas = makeCanvas();
  CTX.__lctx = canvas.getContext();
  CTX.__lsum = sum;
  CTX.__lshape = shape;
  return { laid: call('ezikSummaryLayout(__lctx, __lsum, __lshape, ' + INNER + ', EZIK_SMART_LINK_URL, 1)'),
    rec: canvas.rec };
};
let gBad = 0, bothGuides = 0, stripText = 0, addrText = 0;
const seen = {};
for (const k of GKEYS) seen[k] = {};
const resolvedFlows = {};
const usedColours = {};
const ADDRESS = /:\/\/|\bwww\.|[A-Za-z0-9][A-Za-z0-9-]*\.[A-Za-z]{2,24}(?![A-Za-z0-9-])/;
for (let i = 0; i < COMBOS.length; i++) {
  const c = COMBOS[i];
  const base = more(c.points, GOOD3);
  base.shape = { frame: c.frame, flow: c.flow, guide: c.guide, disc: c.disc, side: c.side, weight: c.weight };
  CTX.__parsed = base;
  const sum = call('ezikSummaryValid(__parsed)');
  let note = '';
  let h = 0, shape = null;
  try {
    CTX.__rawShape = base.shape;
    shape = call('ezikShapeResolve(__rawShape, ' + c.points + ', "x")');
    const d = draw({ text: REPLY + i, source: '', url: URL0, summary: sum });
    const bad = geometrySane(d);
    h = d.r.h;
    const L = layoutOf(sum, shape);
    for (const k of GKEYS) seen[k][shape[k]] = (seen[k][shape[k]] || 0) + 1;
    resolvedFlows[shape.flow] = (resolvedFlows[shape.flow] || 0) + 1;
    for (const col of d.rec.colours) usedColours[col] = (usedColours[col] || 0) + 1;
    for (const t of d.rec.text) usedColours[t.c] = (usedColours[t.c] || 0) + 1;
    // PROOF: the numbers and the arrows never appear on one card.
    const guides = {};
    for (const o of L.laid.ops) if (o.guide) guides[o.guide] = 1;
    if (guides.numbers && guides.arrows) { bothGuides++; note += ' BOTH-GUIDES'; }
    // PROOF: nothing is written at or below the bottom strip's ruler.
    const under = L.laid.ops.filter((o) => o.op === 'text' && o.y >= L.laid.stripY);
    if (under.length) { stripText += under.length; note += ' TEXT-UNDER-STRIP(' + under.length + ')'; }
    // PROOF: no drawn string on the card looks like an address.
    const addr = L.laid.ops.filter((o) => o.op === 'text' && ADDRESS.test(o.t));
    if (addr.length) { addrText += addr.length; note += ' ADDRESS(' + JSON.stringify(addr[0].t) + ')'; }
    if (bad) { gBad++; note += ' BROKEN: ' + bad; }
    if (Math.abs(L.laid.h - h) > 1) note += ' layout/draw disagree ' + L.laid.h + ' vs ' + h;
  } catch (e) { gBad++; note = ' THREW ' + e.message; }
  console.log('  ' + String(i + 1).padStart(2) + '  '
    + (shape ? [shape.frame, shape.flow, shape.guide, shape.disc, shape.side, shape.weight].map((s) => String(s).padEnd(6)).join(' ') : '??')
    + '  p=' + c.points + '  h=' + String(h).padStart(4)
    + (note ? '   <<<' + note : '   ok'));
}
eq('all 24 combinations drew, and none of them broke', gBad, 0);
eq('the numbers and the arrows never appeared on one card', bothGuides, 0);
eq('not one text run was drawn at or below the bottom strip', stripText, 0);
eq('not one drawn string on any of the 24 looks like an address', addrText, 0);
for (const k of GKEYS) {
  eq('every value of `' + k + '` was drawn at least once: ' + Object.keys(seen[k]).sort().join(','),
    Object.keys(seen[k]).length, GRAM[k].length);
}
ok('grid2 and stack were each really drawn, not resolved away every time',
  (resolvedFlows.grid2 || 0) > 0 && (resolvedFlows.stack || 0) > 0,
  JSON.stringify(resolvedFlows));
// The two flows that need a particular count get it, or they become rows -- measured on the
// resolver rather than read off the grammar.
{
  CTX.__rawShape = { flow: 'grid2' };
  eq('grid2 with three points resolves to rows', call('ezikShapeResolve(__rawShape, 3, "x")').flow, 'rows');
  eq('grid2 with four points stays grid2', call('ezikShapeResolve(__rawShape, 4, "x")').flow, 'grid2');
  CTX.__rawShape = { flow: 'stack' };
  eq('stack with three points resolves to rows', call('ezikShapeResolve(__rawShape, 3, "x")').flow, 'rows');
  eq('stack with two points stays stack', call('ezikShapeResolve(__rawShape, 2, "x")').flow, 'stack');
  CTX.__rawShape = { frame: 'gilded', weight: 'heavy' };
  const def = call('EZIK_SHAPE_DEFAULT');
  const r = call('ezikShapeResolve(__rawShape, 3, "x")');
  eq('a key outside its list takes the default rather than failing the card', r.frame, def.frame);
  eq('...and so does the next one', r.weight, def.weight);
}

/* =============================================================================================
 * 4. DETERMINISM -- THE SAME ANSWER IS THE SAME CARD
 * =============================================================================================
 * With no shape keys from the model the six are derived from the reply's own text, so the thing
 * being measured here is that there is NO live randomness on the path: three draws of one answer
 * must produce one op list, byte for byte.
 * ========================================================================================== */
head('4) DETERMINISM -- the same answer, three times');
const crypto = require('crypto');
const opPrint = (rec) => crypto.createHash('sha256')
  .update(JSON.stringify({ text: rec.text, rect: rec.rect, arc: rec.arc, line: rec.line,
    prims: rec.prims, colours: rec.colours })).digest('hex');
{
  const noShape = more(3, GOOD3);
  delete noShape.shape;
  const prints = [];
  let shape = null;
  for (let i = 0; i < 3; i++) {
    CTX.__parsed = JSON.parse(JSON.stringify(noShape));
    const sum = call('ezikSummaryValid(__parsed)');
    CTX.__rawShape = sum.shape;
    CTX.__detText = REPLY;
    shape = call('ezikShapeResolve(__rawShape, 3, __detText)');
    const d = draw({ text: REPLY, source: '', url: URL0, summary: sum });
    prints.push(opPrint(d.rec) + '  h=' + d.r.h);
  }
  for (const p of prints) console.log('  ' + p);
  console.log('  derived shape: ' + GKEYS.map((k) => k + '=' + shape[k]).join(' '));
  ok('three draws of one answer give one fingerprint', prints[0] === prints[1] && prints[1] === prints[2],
    prints.join(' | '));
  // ...and a DIFFERENT answer derives a different shape, or the derivation is not a derivation.
  const alt = ['a', 'bb', 'ccc', 'dddd', 'eeeee', 'ffffff', 'ggggggg', 'hhhhhhhh'].map((t) => {
    CTX.__rawShape = undefined;
    CTX.__detText = 'جواب مختلف ' + t;
    const r = call('ezikShapeResolve(undefined, 3, __detText)');
    return GKEYS.map((k) => r[k]).join('/');
  });
  const distinct = Object.keys(alt.reduce((a, s) => { a[s] = 1; return a; }, {})).length;
  console.log('  eight different answers derived ' + distinct + ' different shapes');
  ok('the derivation actually varies with the text', distinct >= 4, alt.join('  '));
}

/* =============================================================================================
 * 5. THE DIAGRAM LIBRARY -- WHAT EVERY KEY ACTUALLY DRAWS
 * =============================================================================================
 * Each key is painted on a recording context and the PRIMITIVES it called are printed. That is
 * what makes «no living beings» a measurement: a figure that could draw one would have to reach
 * a primitive that is not on this list, and the list is what was recorded.
 * ========================================================================================== */
head('5) DIAGRAM KEYS -- every key, its primitives and its colours');
const DIA = call('EZIK_DIA_KEYS');
const DIA_LABELS = {
  balance: ['يترجح', 'يمنع'], 'two-days': ['٩', '١٠'], 'day-mark': ['١٠'],
  'page-check': ['يصح'], 'page-cross': ['يبطل'], 'stack-steps': ['أول', 'ثان', 'ثالث'],
  'ratio-bar': ['٤٠', 'من المال'], 'clock-window': ['الفجر', 'الظهر'], 'door-two': ['يجوز', 'لا'],
  'coin-stack': ['٨٥'], 'scale-cup': ['٣', 'صاع'], 'crescent-month': ['محرم'],
  'shield-check': ['بشرط'], 'mark-plain': [],
};
let diaBad = 0, diaColourBad = 0, diaTooMany = 0;
for (const key of DIA.concat(['camel-that-never-gets-here'])) {
  const canvas = makeCanvas();
  CTX.__ic = canvas.getContext();
  CTX.__key = key;
  CTX.__labels = DIA_LABELS[key] || [];
  call('ezikDiaDraw(__ic, __key, 0, 0, 200, __labels)');
  const r = canvas.rec;
  const tally = {};
  for (const p of r.prims) tally[p] = (tally[p] || 0) + 1;
  const prims = Object.keys(tally).sort().map((p) => tally[p] + ' ' + p).join(' + ');
  const cols = Object.keys(r.colours.concat(r.text.map((t) => t.c))
    .reduce((a, c) => { a[c] = 1; return a; }, {})).sort();
  const named = cols.map((c) => PAL_VALUES[c] || ('!!' + c));
  // The PRIMITIVES, by name and by count, exactly as the recorder saw them called.
  console.log('  ' + (DIA.indexOf(key) === -1 ? '(any other key)' : key).padEnd(17)
    + prims.padEnd(46)
    + (r.arc.length + ' arc/' + r.rect.length + ' rect/' + r.line.length + ' pathpt').padEnd(28)
    + named.join(' '));
  for (const c of r.colours.concat(r.text.map((t) => t.c))) usedColours[c] = (usedColours[c] || 0) + 1;
  if (!r.prims.length) diaBad++;
  if (named.some((n) => n.indexOf('!!') === 0)) diaColourBad++;
  if (cols.length > 3) { diaTooMany++; console.log('        ^^ ' + cols.length + ' colours, and the order allows three'); }
  const stray = r.prims.filter((p) => ['fill', 'stroke', 'fillRect', 'fillText'].indexOf(p) === -1);
  if (stray.length) { diaBad++; console.log('        ^^ an unexpected primitive: ' + stray.join(',')); }
}
eq('every diagram key drew something', diaBad, 0);
eq('...in colours that are all from the locked palette', diaColourBad, 0);
eq('...and never more than three colours in one drawing', diaTooMany, 0);
eq('the vocabulary is exactly fourteen keys', DIA.length, 14);
ok('...and the fallback is one of them', DIA.indexOf(call('EZIK_DIA_FALLBACK')) !== -1);
console.log('  the primitive set, and it is the whole of it: fillRect, fill and stroke over');
console.log('  beginPath/moveTo/lineTo/arc/closePath, plus fillText for a label. There is no');
console.log('  drawImage, no putImageData and no path data of any other kind, so nothing here');
console.log('  can draw a living being or any part of one.');

/* =============================================================================================
 * 6. THE PALETTE -- EVERY COLOUR THE CARD WAS ACTUALLY DRAWN IN
 * ========================================================================================== */
head('6) PALETTE -- every colour actually used');
{
  const used = Object.keys(usedColours).sort();
  for (const c of used) {
    console.log('  ' + c + '   ' + String(usedColours[c]).padStart(5) + ' draw(s)   '
      + (PAL_VALUES[c] ? PAL_VALUES[c] : 'NOT IN THE LOCKED PALETTE'));
  }
  const stray = used.filter((c) => !PAL_VALUES[c]);
  eq('every colour drawn on this card is one of the locked palette', stray.length, 0, stray.join(' '));
  const unused = Object.keys(PAL).filter((k) => !usedColours[String(PAL[k]).toUpperCase()]);
  console.log('  declared but not reached by these cases: ' + (unused.join(' ') || '(none)'));
}

/* =============================================================================================
 * 7. THE HEIGHT FOLLOWS THE CONTENT, AND THE OLD SKIN IS STILL THE FALLBACK
 * ========================================================================================== */
head('7) CARD HEIGHT vs POINT COUNT');
const heights = [];
for (const n of [2, 3, 4]) {
  const o = more(n, GOOD3);
  o.shape = { frame: 'band', flow: 'rows', guide: 'numbers', disc: 'on', side: 'right', weight: 'calm' };
  CTX.__parsed = o;
  const sum = call('ezikSummaryValid(__parsed)');
  const d = draw({ text: REPLY, source: '', url: URL0, summary: sum });
  heights.push(d.r.h);
  console.log('  ' + n + ' points  ->  ' + W + ' x ' + d.r.h + '   (canvas sized to ' + d.canvas.height + ')');
}
ok('three different heights, each taller than the one before',
  heights[0] < heights[1] && heights[1] < heights[2], heights.join(' / '));
ok('...and none of them is the old skin\'s fixed floor', heights.every((h) => h !== 1350), heights.join(' / '));
{
  const d = draw({ text: 'السلام عليكم', source: 'example.com' });
  eq('the OLD skin still draws at its declared floor', d.r.h, 1350);
  eq('...and still reports itself uncut', d.r.cut, false);
}

/* =============================================================================================
 * 8. THE PREVIEW -- REAL PNGs OUT OF A REAL CANVAS
 * =============================================================================================
 * A vm and a recording context prove geometry; they cannot prove that a browser shapes Arabic
 * inside fillText and hands back a decodable PNG. That needs a real canvas, so this launches
 * headless Chrome against a page that loads the very same shipped block, draws the card and
 * posts the bytes back. No CDP socket and no package: the page does the POST.
 *
 *   --preview <out.png>                  write one card
 *   --shape frame,flow,guide,disc,side,weight    draw it at that shape
 *   --summary <file.json>                draw a CAPTURED model answer instead of the example
 * ========================================================================================== */
const previewAt = process.argv.indexOf('--preview');
if (previewAt !== -1) {
  const out = process.argv[previewAt + 1] || path.join(ROOT, 'CARD-PREVIEW.png');
  const shapeAt = process.argv.indexOf('--shape');
  const SHAPE = shapeAt === -1 ? null : (() => {
    const v = String(process.argv[shapeAt + 1]).split(',');
    const o = {};
    for (let i = 0; i < GKEYS.length; i++) o[GKEYS[i]] = v[i];
    return o;
  })();
  const summaryAt = process.argv.indexOf('--summary');
  const CAPTURED = summaryAt === -1 ? null : JSON.parse(fs.readFileSync(process.argv[summaryAt + 1], 'utf8'));
  const EXAMPLE = CAPTURED || {
    title: 'حكمُ صيامِ يومِ عاشوراء',
    points: [
      pt('day-mark', 'أيُّ يومٍ هو', 'هو اليومُ العاشرُ من شهرِ المحرَّم', '', ['١٠']),
      pt('two-days', 'وصومُ التاسعِ معه', 'الأفضلُ أن تصومَ التاسعَ والعاشرَ معًا', '', ['٩', '١٠']),
      pt('page-check', 'ما فضلُه', 'يُكفِّرُ اللهُ به ذنوبَ السنةِ التي قبلَه', '', ['يُكفِّر']),
      pt('door-two', 'على مَن', 'يُستحَبُّ للرجالِ والنساء، ولا يجبُ على أحد', '', ['سنّة', 'لا يجب']),
    ],
  };
  if (SHAPE) EXAMPLE.shape = SHAPE;
  const PREVIEW_TEXT = 'جوابٌ ثابتٌ تُقاسُ عليه البصمةُ في المتصفِّح.';
  const jsCode = code;
  const indexSrc = fs.readFileSync(INDEX, 'utf8');
  const page = '<!DOCTYPE html><html lang="ar" dir="rtl">'
    + '<head><meta charset="utf-8"><style>'
    + indexSrc.slice(indexSrc.indexOf('<style>') + 7, indexSrc.indexOf('</style>')) + '</style></head>'
    + '<body><div id="root"></div>'
    + '<script src="/vendor/react.umd.js"></script><script src="/vendor/react-dom.umd.js"></script>'
    + '<script>ReactDOM.createRoot=function(){return{render:function(){},unmount:function(){}};};</script>'
    + '<script>\n' + jsCode + '\n'
    + 'try{\n'
    + '  var text = ' + JSON.stringify(PREVIEW_TEXT) + ';\n'
    + '  var sum = ' + JSON.stringify(EXAMPLE) + ';\n'
    + '  var card = ezikDrawReplyCard({ text: text, source: "", url: "", summary: sum });\n'
    + '  var shape = ezikShapeResolve(sum.shape, sum.points.length, text);\n'
    // THE DETERMINISM HALF, IN A REAL BROWSER: the SAME answer with NO shape keys, drawn three
    // times, and the three PNGs must be the same bytes.
    + '  var bare = JSON.parse(JSON.stringify(sum)); delete bare.shape;\n'
    + '  var det = [];\n'
    + '  for (var i = 0; i < 3; i++) det.push(ezikDrawReplyCard({ text: text, source: "", url: "", summary: JSON.parse(JSON.stringify(bare)) }).url);\n'
    + '  fetch("/card", { method: "POST", body: JSON.stringify({ url: card.url, w: card.w, h: card.h,'
    + '    shape: shape, det: det, payload: EZIK_SMART_LINK_URL }) });\n'
    + '} catch (e) { fetch("/card", { method: "POST", body: JSON.stringify({ error: String(e && e.stack || e) }) }); }\n'
    + '</script></body></html>';
  head('8) PREVIEW -- headless Chrome, a real canvas');
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
      console.log('  sha256 ' + crypto.createHash('sha256').update(buf).digest('hex'));
      console.log('  shape  ' + GKEYS.map((k) => k + '=' + msg.shape[k]).join(' ') + '  points=' + msg.shape.points);
      console.log('  payload in the symbol: ' + msg.payload);
      // THE DETERMINISM HALF, ON REAL IMAGE BYTES.
      const dets = (msg.det || []).map((u) => crypto.createHash('sha256')
        .update(Buffer.from(String(u).replace(/^data:image\/png;base64,/, ''), 'base64')).digest('hex'));
      for (const d of dets) console.log('  determinism draw: ' + d);
      ok('the same answer drew the same PNG three times in a real browser',
        dets.length === 3 && dets[0] === dets[1] && dets[1] === dets[2], dets.join(' '));
      // AND THE BARCODE, READ BACK OUT OF THE IMAGE ITSELF. Not off the matrix the encoder
      // returned -- off the PIXELS a browser painted and a PNG encoder compressed. The card is
      // white now, so the symbol is found by ITS OWN dark colour, which is a value no other
      // thing on this card is drawn in; the module size is the one integer that divides the box
      // by a legal symbol span, and the sampled grid goes through the decoder section 1 used.
      try {
        const px = readPng(buf);
        const box = darkBox(px, PAL.qrDark);
        ok('the barcode\'s dark modules are in the painted image', !!box,
          'no run of ' + PAL.qrDark + ' was found in the preview');
        if (box) {
          const side = box.x1 - box.x0 + 1;
          let got = null, tried = [];
          for (const v of [2, 3, 4, 5, 6]) {
            const n = 17 + 4 * v;
            if (side % n !== 0) continue;
            const unit = side / n;
            tried.push('v' + v + ' unit=' + unit);
            const mods = [];
            for (let i = 0; i < n; i++) {
              const row = new Uint8Array(n);
              for (let j = 0; j < n; j++) {
                const cx = box.x0 + j * unit + Math.floor(unit / 2);
                const cy = box.y0 + i * unit + Math.floor(unit / 2);
                row[j] = px.at(cx, cy)[0] < 128 ? 1 : 0;
              }
              mods.push(row);
            }
            try { got = qrDecode(mods, n); break; } catch (e) { tried.push('  v' + v + ' -> ' + e.message); }
          }
          console.log('  barcode sampled off the PNG: ' + (got ? ('v' + got.version + '-' + got.level + ' mask ' + got.mask) : tried.join(' | ')));
          eq('the barcode in the PRINTED IMAGE decodes back to the ezik address',
            got && got.text, msg.payload);
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
/* THE SYMBOL'S OWN BOUNDING BOX, found by ITS OWN COLOUR. Round two made the card white, so the
 * pure-white box the first round looked for is now the whole page; the barcode's dark value is
 * the one colour on this card that nothing else is drawn in, so it is the locator instead. The
 * box returned is the SYMBOL, quiet zone excluded -- the outer finder patterns touch the symbol's
 * edges on all four sides, which is what makes side / (17 + 4v) the module size. */
function darkBox(px, hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, hits = 0;
  for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
    const p = px.at(x, y);
    if (p[0] === r && p[1] === g && p[2] === b) {
      hits++;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0 || hits < 64) return null;
  return { x0: x0, y0: y0, x1: x1, y1: y1, hits: hits };
}

function finish() {
  console.log('\n==================================================================');
  console.log(' CARD SKIN PROBE   PASS=' + P + '   FAIL=' + F);
  console.log('==================================================================');
  process.exitCode = F ? 1 : 0;
}
