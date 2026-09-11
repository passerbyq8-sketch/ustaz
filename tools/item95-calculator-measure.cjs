// item95-calculator-measure.cjs -- ITEM 95, THE SHARIAH CALCULATOR, MEASURED.
//
// WHAT THIS IS. The acceptance battery of the item-95 build order, executed against the SHIPPED
// code rather than against a copy of it. The block is cut out of app.jsx by tools/babel-block.cjs
// -- the one helper every coupled guard in this repository uses -- transformed with the runtime
// the page itself pins, and evaluated inside a linkedom window against a localStorage stub and a
// fetch this file owns. Then the calculator is MOUNTED, driven by real clicks and real input
// events, and the assertions below read the DOM those events produced.
//
// WHY IT IS NOT A GATE. The build order says a new gate needs five registration points and that
// this item most likely needs none. It does not: nothing here is a contract another round could
// silently break -- it is the battery for one item, run on demand:
//
//     node tools/item95-calculator-measure.cjs
//
// Exit 0 means every case passed. Exit 1 names the ones that did not.
//
// THE FOUR THINGS IT MEASURES.
//   A. THE ARITHMETIC -- the exact-fraction core, called directly, including the float trap the
//      order supplies: 85.000g at 15.612/g must be 33.176 and not the 33.175 a naive
//      `weight * price * 0.025` yields. This section also RUNS that naive expression, so the
//      trap is proved to be a real trap on this machine rather than asserted to be one.
//   B. THE NINE, RENDERED -- every expected value of section 8 read off the mounted DOM, plus the
//      negative case: B3 renders NO feeding sub-calculator at all.
//   C. THE STRUCTURE -- a source line under every Shariah figure, the five disagreement spots and
//      NOTHING outside them, and not one network call from any of it.
//   D. THE SAME NUMBERS, IN ARABIC -- because a quantity is drawn in the numerals of the
//      interface language, so B and C above measured one of the two languages and not both.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parseHTML } = require('linkedom');

const REPO = path.resolve(__dirname, '..');
const BB = require('./babel-block.cjs');

let pass = 0; const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); return true; }
  fails.push(name);
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const eq = (name, actual, expected) =>
  ok(name, String(actual) === String(expected), 'expected ' + JSON.stringify(expected) + '\n        actual   ' + JSON.stringify(actual));

/* ===================== the shipped block, transformed and run ===================== */
const block = BB.readBabelBlock();
const rawCode = block.raw;
const transformed = BB.transformBabelBlock(block);

// THE STORE STARTS EMPTY, WHICH IS A FRESH DEVICE. The app therefore boots in Arabic -- its own
// first-run rule -- and section B switches the interface to English through the app's OWN
// ezLangSet(), for the reason given there. It is NOT seeded with a language here, and the
// interface-language key is not named anywhere in this file: guards/i18n-ui-guard.cjs asserts,
// in both directions, that exactly four files in this tree name that key, and a fifth one fails
// it. Measured -- this file was the fifth for one run, and the gate said so.
const store = (() => {
  const d = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null),
    setItem: (k, v) => { d[k] = String(v); },
    removeItem: (k) => { delete d[k]; },
    clear: () => { for (const k in d) delete d[k]; },
  };
})();

const { window } = parseHTML('<!DOCTYPE html><html lang="ar" dir="rtl"><body><div id="root"></div><div id="calc"></div></body></html>');
window.self = window; window.window = window; window.globalThis = window;
window.matchMedia = (q) => ({ matches: false, media: String(q), addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
window.scrollTo = () => {};
window.alert = () => {}; window.confirm = () => true;
window.localStorage = store;
// THE NETWORK LEDGER. Not a stub that returns nothing -- a RECORDER. Section C asserts it is
// still empty after every one of the nine calculators has been driven.
const NET = [];
window.fetch = function (u) {
  NET.push(String(u));
  return Promise.resolve({ ok: false, status: 0, headers: { get: () => null }, text: () => Promise.resolve(''), json: () => Promise.resolve({}) });
};
window.XMLHttpRequest = function () { NET.push('XHR'); };
window.WebSocket = function () { NET.push('WS'); };
window.history = (() => {
  const entries = [{}]; let at = 0;
  return {
    get length() { return entries.length; }, get state() { return entries[at]; },
    pushState: (st) => { entries.splice(at + 1); entries.push(st); at = entries.length - 1; },
    replaceState: (st) => { entries[at] = st; },
    back: () => { if (at > 0) at--; },
  };
})();
if (window.Element && window.Element.prototype && !window.Element.prototype.scrollIntoView) {
  window.Element.prototype.scrollIntoView = () => {};
}
try { if (!window.crypto) window.crypto = require('crypto').webcrypto; } catch (e) {}
try { if (!window.TextDecoder) window.TextDecoder = TextDecoder; } catch (e) {}
try { if (!window.TextEncoder) window.TextEncoder = TextEncoder; } catch (e) {}
// linkedom's window is a Proxy over globalThis, so these three are the SAME object the shipped
// block will see. `navigator` is a getter on modern Node and has to be redefined rather than
// assigned; the other two assign cleanly.
const define = (k, v) => { try { Object.defineProperty(global, k, { configurable: true, writable: true, value: v }); } catch (e) {} };
define('navigator', window.navigator); define('window', window); define('document', window.document);

const ctx = vm.createContext(window);
const loadUMD = (f) => vm.runInContext(fs.readFileSync(path.join(REPO, 'vendor', f), 'utf8'), ctx, { filename: f });
loadUMD('react.umd.js'); loadUMD('react-dom.umd.js');
if (!window.React || !window.ReactDOM) { console.error('React/ReactDOM did not load.'); process.exit(2); }
// THE APPLICATION SELF-MOUNTS. Its own createRoot is neutered so that the whole app does not
// render into this window and start its boot effects; the REAL one is kept so that this file can
// mount the one component it is measuring.
vm.runInContext('globalThis.__realCreateRoot = ReactDOM.createRoot;'
  + 'ReactDOM.createRoot = function () { return { render: function () {}, unmount: function () {} }; };', ctx);
window.addEventListener('error', () => {});
window.console.error = () => {};
try { vm.runInContext(transformed, ctx, { filename: 'babel-block.jsx' }); }
catch (e) { console.error('RUNTIME ERROR:\n' + String(e && e.stack ? e.stack : e)); process.exit(2); }
const grab = (expr) => {
  try { return vm.runInContext('(' + expr + ')', ctx, { filename: 'item95-measure' }); }
  catch (e) { return { __err: String(e && e.message ? e.message : e) }; }
};

/* ===================== A. THE ARITHMETIC ===================== */
console.log('\n=== A. THE ARITHMETIC -- exact fractions, one rounding, no float ===');

// The core is called through the shipped functions, with the shipped constants.
const money = (expr) => grab('ezcText(' + expr + ')');
const RATE = 'EZC_RATE';

eq('the rate is the exact fraction 1/40, not a decimal',
  grab('String(EZC_RATE.n) + "/" + String(EZC_RATE.d)'), '1/40');
eq('the gold nisab is derived: 20 mithqal x 4.25g',
  money('EZC_GOLD_NISAB_G'), '85.000');
eq('the silver nisab is derived: 200 dirham x 2.975g',
  money('EZC_SILVER_NISAB_G'), '595.000');
eq('the mithqal is 4.25g', grab('ezcWeightText(EZC_MITHQAL_G)'), '4.25');
eq('the dirham is 2.975g', grab('ezcWeightText(EZC_DIRHAM_G)'), '2.975');
eq('one mudd for each poor person (majority)', grab('String(EZC_MUDD_PER_POOR)'), '1');
eq('ten poor for the oath', grab('String(EZC_POOR_YAMIN)'), '10');
eq('sixty poor for dhihar and for Ramadan', grab('String(EZC_POOR_SIXTY)'), '60');

// 🔴 THE FLOAT TRAP, BOTH HALVES. First: what the shipped arithmetic produces.
eq('THE FLOAT TRAP: 85.000g x 15.612/g, quarter-tenth = 33.176 exactly',
  money('ezcMul(ezcMul(ezcParse("85.000"), ezcParse("15.612")), EZC_RATE)'), '33.176');
// And second: what a naive 64-bit implementation produces on THIS machine, so the trap is
// demonstrated rather than described. If these two ever agreed, the case would have stopped
// discriminating and would need replacing.
const naive = (85.000 * 15.612 * 0.025).toFixed(3);
eq('...and a naive `weight * price * 0.025` in float really does yield 33.175 here', naive, '33.175');
ok('...so the two differ, which is what makes this case a trap at all', naive !== '33.176',
  'naive=' + naive);
// AND THIS IS WHERE THE FILS GOES. On this machine 85.000 * 15.612 IS exactly 1327.02 -- so the
// loss is not in the product, which is the guess a reader would make first. It is in the
// fortieth: 1327.02 * 0.025 lands just BELOW the true 33.1755, and toFixed(3) therefore rounds
// it DOWN. The exact fraction lands ON 33.1755 and round-half-up takes it up.
eq('...and the loss is in the fortieth, not in the product',
  String(85.000 * 15.612) + ' then ' + (85.000 * 15.612 * 0.025).toFixed(3), '1327.02 then 33.175');

// The parser: exactness, and refusal.
eq('a typed decimal becomes an exact fraction', grab('String(ezcParse("15.612").n) + "/" + String(ezcParse("15.612").d)'), '15612/1000');
eq('Arabic-Indic digits parse to the same number', money('ezcParse("١٥.٦١٢")'), '15.612');
ok('an empty field is null, not zero', grab('ezcParse("") === null'));
ok('a sign is refused', grab('ezcParse("-5") === null'));
ok('a letter is refused', grab('ezcParse("5x") === null'));
ok('two dots are refused', grab('ezcParse("5.1.2") === null'));
eq('rounding is half-UP at three places', money('ezcRat(1327020000, 40000000)'), '33.176');
eq('...and a value exactly on the half rounds up', money('ezcRat(1005, 2000)'), '0.503');
eq('...and a value below the half rounds down', money('ezcRat(1004, 2000)'), '0.502');
ok('the nisab comparison is exact at the boundary',
  grab('ezcGte(ezcParse("85.000"), EZC_GOLD_NISAB_G) === true'));
ok('...and one millionth below the boundary does NOT reach it',
  grab('ezcGte(ezcParse("84.999999"), EZC_GOLD_NISAB_G) === false'));

// The five disagreement spots, counted in the code rather than on the screen.
eq('the disagreement register holds exactly five spots', grab('Object.keys(EZC_KHILAF).length'), 5);
eq('...and they are the five the order names',
  JSON.stringify(grab('Object.keys(EZC_KHILAF).slice().sort()')),
  JSON.stringify(['feed', 'fidyah', 'jima', 'trade', 'waqs']));
eq('there are nine calculators', grab('EZC_LIST.length'), 9);

/* ===================== B. THE NINE, RENDERED ===================== */
console.log('\n=== B. THE NINE, MOUNTED AND DRIVEN ===');

// THE BATTERY RUNS IN ENGLISH, deliberately, and the switch happens THROUGH THE APP. Section 8's
// expected values are written in Western numerals, and this app draws a QUANTITY in the numerals
// of the interface language -- so in Arabic the very same 178.500 renders as ١٧٨.٥٠٠ and a
// Western-digit assertion would be measuring the numeral system rather than the arithmetic.
// Arabic is measured in section D, where the same numbers are asserted in Arabic-Indic digits.
eq('a fresh device boots this app in Arabic', grab('ezLangGet()'), 'ar');
grab('(function () { ezLangSet("en"); return ezLangGet(); })()');
eq('...and the harness switches it to English through the app\'s own setter', grab('ezLangGet()'), 'en');

const host = window.document.getElementById('calc');
vm.runInContext('globalThis.__calcRoot = __realCreateRoot(document.getElementById("calc"));', ctx);
// flushSync, so a click and the render it causes are one step. React 19 batches otherwise and
// the assertion after a click would read the DOM from before it.
const render = () => vm.runInContext(
  'ReactDOM.flushSync(function () { __calcRoot.render(React.createElement(EzikCalcSection, { onClose: function () {} })); });', ctx);
const flush = (fn) => vm.runInContext('ReactDOM.flushSync(function () { (' + fn + ')(); });', ctx);
render();

const q = (sel) => host.querySelector(sel);
const qa = (sel) => Array.from(host.querySelectorAll(sel));
const click = (el) => { if (!el) throw new Error('no element to click'); flush('function(){ __el.click(); }'.replace('__el', 'globalThis.__clickTarget')); };
// Clicking has to happen inside flushSync, so the element is handed over through the context.
const press = (sel) => {
  const el = q(sel);
  if (!el) { fails.push('missing control ' + sel); console.log('  FAIL  missing control ' + sel); return false; }
  window.__pressTarget = el;
  flush('function(){ globalThis.__pressTarget.click(); }');
  return true;
};
// TYPING, IN THREE STEPS, AND ALL THREE ARE NEEDED. This is the idiom guards/i18n-ui-guard.cjs
// already uses on this app's own text fields (its part D), and the reason for each step was
// re-measured here before it was copied:
//   1. the value is written through the NATIVE setter off the prototype, not by `el.value = x`.
//      React installs its own get/set pair over an input's value -- the change tracker -- and a
//      plain assignment records itself there, after which React's ChangeEventPlugin discards the
//      event as a no-op: the field shows the number and the component never hears about it.
//   2. an `input` event is dispatched, bubbling, which is what a keystroke does.
//   3. and the element's own React onChange is then called with the element as the target --
//      because under linkedom, measured here, step 2 alone does NOT reach React's delegated
//      root listener. Step 3 is what actually moves the component, and it moves it through the
//      component's OWN handler reading the REAL DOM value, not through a stub beside it.
const type = (name, value) => {
  const el = q('[data-ezik-calc-field="' + name + '"]');
  if (!el) { fails.push('missing field ' + name); console.log('  FAIL  missing field ' + name); return false; }
  const key = Object.keys(el).filter((k) => k.indexOf('__reactProps$') === 0)[0];
  if (!key) { fails.push('field ' + name + ' carries no React props'); console.log('  FAIL  field ' + name + ' carries no React props'); return false; }
  window.__typeTarget = el; window.__typeValue = String(value); window.__typeKey = key;
  flush('function(){ var e = globalThis.__typeTarget;'
    + ' var d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e), "value");'
    + ' if (d && typeof d.set === "function") d.set.call(e, globalThis.__typeValue);'
    + ' else e.value = globalThis.__typeValue;'
    + ' e.dispatchEvent(new window.Event("input", { bubbles: true }));'
    + ' var p = e[globalThis.__typeKey];'
    + ' if (p && typeof p.onChange === "function") p.onChange({ target: e, currentTarget: e,'
    + '   preventDefault: function () {}, stopPropagation: function () {} }); }');
  return true;
};
const pick = (id) => press('[data-ezik-calc="' + id + '"]');
const out = (id) => { const e = q('[data-ezik-calc-out="' + id + '"]'); return e ? e.textContent : null; };
const has = (sel) => !!q(sel);
const khilafs = () => qa('[data-ezik-calc-khilaf]').map((e) => e.getAttribute('data-ezik-calc-khilaf'));
const srcs = () => qa('[data-ezik-calc-src]').map((e) => e.getAttribute('data-ezik-calc-src'));

ok('the calculator mounted', qa('[data-ezik-calc]').length === 9, qa('[data-ezik-calc]').length + ' chooser buttons');
ok('...and the currency field defaults to KWD', q('[data-ezik-calc-field="cur"]')
  && q('[data-ezik-calc-field="cur"]').value === 'KWD');

// ---- A1 CASH ------------------------------------------------------------------
pick('a1');
type('cash', '1000.000'); type('silver', '0.300');
ok('A1 cash 1000.000 @ silver 0.300: nisab is 178.500', /178\.500/.test(out('nisab') || ''), out('nisab'));
ok('A1 ...REACHES, so zakat is 25.000', /25\.000/.test(out('zakat') || ''), out('zakat'));
ok('A1 ...and the working names the quarter-tenth of 1000.000',
  /1000\.000/.test(out('zakat') || ''), out('zakat'));
ok('A1 ...and the rate carries its source line', srcs().indexOf('calc.ref.rate') !== -1, JSON.stringify(srcs()));
ok('A1 ...and the waqs disagreement rides with it', khilafs().indexOf('waqs') !== -1, JSON.stringify(khilafs()));
ok('A1 ...and the hawl standing note is shown once for the group',
  qa('[data-ezik-calc-standing="hawl"]').length === 1);
type('cash', '100.000');
ok('A1 cash 100.000 @ silver 0.300: BELOW nisab, so "not due"', out('notdue') !== null, String(out('notdue')));
ok('A1 ...and no zakat figure is drawn at all', out('zakat') === null, String(out('zakat')));
ok('A1 ...but the nisab is still 178.500', /178\.500/.test(out('nisab') || ''), out('nisab'));

// ---- A2 GOLD ------------------------------------------------------------------
pick('a2');
type('goldW', '100.000'); type('goldP', '20.000');
ok('A2 gold 100.000g @ 20.000/g: nisab is 85g', /85/.test(out('nisab') || ''), out('nisab'));
ok('A2 ...the nisab working shows 20 mithqal x 4.25g = 85g',
  has('[data-ezik-calc-work="goldNisab"]'), 'no gold nisab working line');
ok('A2 ...value 2000.000 and zakat 50.000',
  /2000\.000/.test(out('zakat') || '') && /50\.000/.test(out('zakat') || ''), out('zakat'));
// 🔴 THE FLOAT TRAP, ON THE SCREEN.
type('goldW', '85.000'); type('goldP', '15.612');
const trap = out('zakat') || '';
ok('A2 THE FLOAT TRAP RENDERED: 85.000g @ 15.612/g reaches nisab exactly and pays 33.176',
  /33\.176/.test(trap), trap);
ok('A2 ...and NOT the 33.175 a naive float yields', !/33\.175(?!\d)/.test(trap.replace('33.176', '')), trap);
type('goldW', '84.999');
ok('A2 84.999g is below the 85g nisab: "not due"', out('notdue') !== null, String(out('notdue')));

// ---- A3 SILVER ----------------------------------------------------------------
pick('a3');
type('silverW', '700.000');
ok('A3 silver 700.000g @ 0.300/g (the SAME silver field A1 filled): nisab is 595g',
  /595/.test(out('nisab') || ''), out('nisab'));
ok('A3 ...and the shared silver price carried across: value 210.000, zakat 5.250',
  /210\.000/.test(out('zakat') || '') && /5\.250/.test(out('zakat') || ''), out('zakat'));
ok('A3 ...the nisab working shows 200 dirham x 2.975g = 595g',
  has('[data-ezik-calc-work="silverNisab"]'));

// ---- A4 TRADE GOODS -----------------------------------------------------------
pick('a4');
type('trade', '2000.000');
ok('A4 trade 2000.000 @ silver 0.300: nisab is 178.500', /178\.500/.test(out('nisab') || ''), out('nisab'));
ok('A4 ...REACHES, so zakat is 50.000', /50\.000/.test(out('zakat') || ''), out('zakat'));
ok('A4 ...and the trade-valuation disagreement is present under the result',
  khilafs().indexOf('trade') !== -1, JSON.stringify(khilafs()));
ok('A4 ...and the waqs disagreement rides with the rate as well',
  khilafs().indexOf('waqs') !== -1, JSON.stringify(khilafs()));
ok('A4 ...and the by-value nisab carries its own source', srcs().indexOf('calc.ref.trade') !== -1);

// ---- B1 YAMIN -----------------------------------------------------------------
pick('b1');
ok('B1 the oath offers a CHOICE of three, then the fast',
  qa('[data-ezik-calc-step]').length === 4, qa('[data-ezik-calc-step]').length + ' steps');
ok('B1 ...and the three are a <ul>, not an <ol>: it is a choice, not a sequence',
  has('ul[style]') && !has('ol[style]'));
ok('B1 ...a feeding sub-calculator is rendered', has('[data-ezik-calc-feed="poor"]'));
press('[data-ezik-calc-mode="money"]');
type('mudd', '0.750');
ok('B1 feeding, financial mode: 10 poor x 1 mudd x 0.750 = 7.500',
  /7\.500/.test(out('feedMoney') || ''), out('feedMoney'));
ok('B1 ...and the working names 10 x 1 x 0.750, not a 1/40 of anything',
  /10/.test(out('feedMoney') || '') && !/0\.187|0\.188/.test(out('feedMoney') || ''), out('feedMoney'));
ok('B1 ...and the feeding-measure disagreement rides under it',
  khilafs().indexOf('feed') !== -1, JSON.stringify(khilafs()));
ok('B1 ...and the oath carries its source', srcs().indexOf('calc.ref.b1') !== -1);
press('[data-ezik-calc-mode="measure"]');
ok('B1 by-measure mode is purely descriptive: 10 mudds, no money',
  /10/.test(out('feedMeasure') || '') && out('feedMoney') === null, out('feedMeasure'));

// ---- B2 DHIHAR ----------------------------------------------------------------
pick('b2');
ok('B2 dhihar is an ORDERED sequence of three', has('ol[style]') && qa('[data-ezik-calc-step]').length === 3);
press('[data-ezik-calc-mode="money"]');
ok('B2 feeding, financial mode: 60 poor x 1 mudd x 0.750 = 45.000',
  /45\.000/.test(out('feedMoney') || ''), out('feedMoney'));
ok('B2 ...and dhihar carries its source', srcs().indexOf('calc.ref.b2') !== -1);

// ---- B3 ACCIDENTAL KILLING -- THE NEGATIVE CASE -------------------------------
pick('b3');
ok('B3 accidental killing is an ordered pair: free a slave, then the fast',
  qa('[data-ezik-calc-step]').length === 2, qa('[data-ezik-calc-step]').length + ' steps');
ok('B3 🔴 NO feeding sub-calculator is rendered AT ALL', !has('[data-ezik-calc-feed]'));
ok('B3 ...and no mudd-price field exists for the reader to fill in',
  !has('[data-ezik-calc-field="mudd"]'));
ok('B3 ...and no feeding-measure disagreement appears, because there is no feeding output',
  khilafs().indexOf('feed') === -1, JSON.stringify(khilafs()));
ok('B3 ...and it says so in words', out('nofeeding') !== null);
ok('B3 ...and carries its source', srcs().indexOf('calc.ref.b3') !== -1);

// ---- B4 JIMA FI RAMADAN -------------------------------------------------------
pick('b4');
ok('B4 Ramadan shows the majority order of three', has('ol[style]') && qa('[data-ezik-calc-step]').length === 3);
ok('B4 ...and the order disagreement is directly under it',
  khilafs().indexOf('jima') !== -1, JSON.stringify(khilafs()));
ok('B4 ...the three options carry the "by agreement" source', srcs().indexOf('calc.ref.b4') !== -1);
ok('B4 ...and the order carries its own', srcs().indexOf('calc.ref.b4order') !== -1);
press('[data-ezik-calc-mode="money"]');
ok('B4 feeding, financial mode: 60 poor x 1 mudd x 0.750 = 45.000',
  /45\.000/.test(out('feedMoney') || ''), out('feedMoney'));

// ---- B5 FIDYAT AL-SIYAM -------------------------------------------------------
pick('b5');
type('days', '10');
ok('B5 fidyah is a mudd for every day', out('fidyah') !== null, String(out('fidyah')));
ok('B5 ...and the basis-and-amount disagreement is directly under the result',
  khilafs().indexOf('fidyah') !== -1, JSON.stringify(khilafs()));
ok('B5 ...and carries its source', srcs().indexOf('calc.ref.b5') !== -1);
press('[data-ezik-calc-mode="money"]');
ok('B5 financial mode: 10 days x 1 mudd x 0.750 = 7.500',
  /7\.500/.test(out('feedMoney') || ''), out('feedMoney'));
press('[data-ezik-calc-mode="measure"]');
ok('B5 by-measure mode: 10 mudds of the staple food, no money',
  /10/.test(out('feedMeasure') || '') && out('feedMoney') === null, out('feedMeasure'));

/* ===================== C. THE STRUCTURE ===================== */
console.log('\n=== C. THE STRUCTURE -- sources, the five spots, and no network ===');

// Every calculator walked once more, collecting what each one draws.
const ALLOWED = { a1: ['waqs'], a2: ['waqs'], a3: ['waqs'], a4: ['waqs', 'trade'], b1: ['feed'], b2: ['feed'], b3: [], b4: ['jima', 'feed'], b5: ['fidyah', 'feed'] };
const seen = {};
for (const id of Object.keys(ALLOWED)) {
  pick(id);
  // Fill whatever that calculator needs, so a result (and its notes) is actually drawn.
  if (id === 'a1') { type('cash', '1000.000'); type('silver', '0.300'); }
  if (id === 'a2') { type('goldW', '100.000'); type('goldP', '20.000'); }
  if (id === 'a3') { type('silverW', '700.000'); type('silver', '0.300'); }
  if (id === 'a4') { type('trade', '2000.000'); type('silver', '0.300'); }
  if (id === 'b5') { type('days', '10'); }
  seen[id] = khilafs().slice().sort();
  const want = ALLOWED[id].slice().sort();
  eq(id + ': the disagreement lines drawn are exactly the ones allowed there',
    JSON.stringify(seen[id]), JSON.stringify(want));
  ok(id + ': ...and every figure on it carries a book-and-page line', srcs().length > 0,
    JSON.stringify(srcs()));
}
const everySeen = Object.keys(seen).reduce((a, k) => a.concat(seen[k]), []);
eq('across all nine, no disagreement outside the five named spots appears',
  JSON.stringify(Array.from(new Set(everySeen)).sort()),
  JSON.stringify(['feed', 'fidyah', 'jima', 'trade', 'waqs']));

// THE SOURCE LINE IS COMPOSED OF BOOK **AND** PAGE, and this reads the text rather than the
// attribute: a source line that had lost its book name would still carry the attribute.
pick('a1'); type('cash', '1000.000'); type('silver', '0.300');
const oneSrc = q('[data-ezik-calc-src]');
ok('a source line names the book and the page together',
  !!oneSrc && oneSrc.textContent.length > 12 && /\d|[٠-٩]/.test(oneSrc.textContent),
  oneSrc ? oneSrc.textContent : '(none)');

// ZERO NETWORK. Read from the code as well as from the recorder: the whole calculator block is
// scanned for the names a request could be made through.
eq('not one network call was made by any of the nine', JSON.stringify(NET), JSON.stringify([]));
const start = rawCode.indexOf('// ITEM 95 -- THE SHARIAH CALCULATOR. NINE CALCULATORS');
const end = rawCode.indexOf('// THE HOME THE READER ARRANGES -- THE FRAMEWORK');
ok('the calculator block is locatable in the shipped source', start !== -1 && end > start,
  'start=' + start + ' end=' + end);
const featureRaw = rawCode.slice(start, end);
// COMMENTS OUT FIRST. The block's own prose says "no XHR, no WebSocket" and "there is no
// api/ask.js call on this path" -- so a scan over the raw text finds the very words it is looking
// for, in the sentence that promises they are absent. What is scanned below is CODE.
const feature = featureRaw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/([^:])\/\/.*$/gm, '$1');
const NET_WORDS = ['fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'navigator.sendBeacon',
  'import(', 'api/ask', 'runEngine', 'askEzik', 'sendMessage('];
const found = NET_WORDS.filter((w) => feature.indexOf(w) !== -1);
eq('...and the feature\'s own source names no way of making one', JSON.stringify(found), JSON.stringify([]));
ok('...and it declares no storage key of its own',
  feature.indexOf('localStorage') === -1 && !/ezik_[a-z_]+_v\d/.test(feature),
  'storage names found in the feature block');
eq('the zakat rate is never written as a decimal anywhere in the feature',
  JSON.stringify(['0.025', '* 0.025', '/ 40.0'].filter((w) => feature.indexOf(w) !== -1)),
  JSON.stringify([]));

// THE HOME ROW GAINED A CARD AND NOTHING ELSE.
const cards = grab('ezHomeDuoCards({ onOpenWird: function () {}, onOpenTasbih: function () {}, onOpenCalc: function () {} }).map(function (c) { return c.id; })');
eq('the home card row now names three cards, the calculator last',
  JSON.stringify(cards), JSON.stringify(['wird', 'tasbih', 'calc']));
ok('the row still derives its columns from that array\'s length',
  /gridTemplateColumns: 'repeat\(' \+ list\.length/.test(rawCode));
eq('the feature adds no new `screen` value',
  (feature.match(/screen === '/g) || []).length, 0);

/* ===================== D. THE SAME NUMBERS, IN ARABIC ===================== */
// The battery above ran in English so that the order's own expected values could be matched
// character for character. This section switches the interface to Arabic through the app's OWN
// language setter and asserts that the SAME arithmetic reaches the screen in Arabic-Indic
// numerals -- and that a CITATION does not move with it, because a volume and a page are a
// reference rather than a quantity.
console.log('\n=== D. THE SAME NUMBERS, IN ARABIC ===');
eq('the battery ran in English', grab('ezLangGet()'), 'en');
const toAr = (w) => w.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
flush('function(){ ezLangSet("ar"); }');
render();
eq('...and the interface is now Arabic', grab('ezLangGet()'), 'ar');
pick('a1'); type('cash', '1000.000'); type('silver', '0.300');
const arNisab = out('nisab') || '', arZakat = out('zakat') || '';
ok('A1 in Arabic: the nisab is ' + toAr('178.500'), arNisab.indexOf(toAr('178.500')) !== -1, arNisab.slice(0, 90));
ok('A1 in Arabic: the zakat is ' + toAr('25.000'), arZakat.indexOf(toAr('25.000')) !== -1, arZakat.slice(0, 90));
ok('A1 in Arabic: no Western digit is left in the figures', !/[0-9]/.test(arNisab.replace(/KWD/g, '')),
  arNisab.slice(0, 90));
pick('a2'); type('goldW', '85.000'); type('goldP', '15.612');
ok('A2 in Arabic: THE FLOAT TRAP still pays ' + toAr('33.176'),
  (out('zakat') || '').indexOf(toAr('33.176')) !== -1, (out('zakat') || '').slice(0, 90));
const arSrc = q('[data-ezik-calc-src]');
ok('a citation keeps the numerals its own dictionary wrote it in',
  !!arSrc && /[٠-٩]/.test(arSrc.textContent) && !/[0-9]/.test(arSrc.textContent),
  arSrc ? arSrc.textContent : '(none)');
flush('function(){ ezLangSet("en"); }');

/* ===================== the count ===================== */
console.log('\n' + (fails.length === 0
  ? '=== ' + pass + '/' + pass + ' - PASS ==='
  : '=== ' + pass + '/' + (pass + fails.length) + ' - FAIL ===\n' + fails.map((f) => '  * ' + f).join('\n')));
process.exit(fails.length === 0 ? 0 : 1);
