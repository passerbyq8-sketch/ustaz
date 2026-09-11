// item96-goldprice-measure.cjs -- ITEM 96, THE DAILY GOLD PRICE, MEASURED.
//
// WHAT THIS IS. The acceptance battery of the item-96 build order, executed against the SHIPPED
// code rather than against a copy of it. The server's parser and its transport are the real
// exported functions of api/gold-price.js; the client's hook, prefill, picker and two lines are
// the real block cut out of app.jsx by tools/babel-block.cjs, transformed with the runtime the
// page itself pins, evaluated in a linkedom window, MOUNTED, and read off the DOM the mount
// produced. Nothing below re-implements anything it checks.
//
// WHY IT IS NOT A GATE. The build order forbids registering one, and the feature needs none:
// what it does is measured here on demand, in one command --
//
//     node tools/item96-goldprice-measure.cjs
//
// Exit 0 means every case passed. Exit 1 names the ones that did not.
//
// THE FIXTURE IS THE REAL PAGE. tools/fixtures/moci-gold-2026-09-12.html is the slice of
// https://www.moci.gov.kw/ar/nthm-lasaar/gold/ that carries the whole table and the update line,
// fetched on 12 September 2026 and saved byte for byte -- not a hand-written imitation of it.
// Every "page shape changed" case below is that same fixture with ONE thing broken in memory, so
// the negative cases are measured against the positive one rather than against a fiction.
//
// THE EIGHT THINGS IT MEASURES.
//   A. THE PARSER, HAPPY  -- four printed digit strings and one raw ministry date, off the real page.
//   B. THE PARSER, BROKEN -- table gone, date gone, a karat row gone, a price cell that is not a
//      number. Each must be ok:false with NO prices object at all: a partial parse is a failure.
//   C. THE TRANSPORT      -- a timeout and a non-200 are failures; a 200 reaches the parser.
//   D. THE CONTRACT       -- the two response shapes and the cache header, driven through the
//      real default export with a recording res.
//   E. THE DAY            -- an entry for today costs no call; an entry for yesterday costs
//      exactly one; and a second open on the same day costs nothing after the first.
//   F. THE PRICE PATH     -- the fetched digit string reaches the shipped exact-fraction parser
//      unchanged and produces the exact answer, and no float name exists anywhere on that path.
//   G. THE ROSTER AND THE DICTIONARY -- the storage key is on both wipe lists, and the seven new
//      keys are on both sides of EZ_I18N with the counts still equal.
//   H. THE FAILURE AND THE WAIT -- an empty field with a failure line and no price at all, and
//      NO line of any kind while the call is still out.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parseHTML } = require('linkedom');

const REPO = path.resolve(__dirname, '..');
const BB = require('./babel-block.cjs');
const FIXTURE = path.join(REPO, 'tools', 'fixtures', 'moci-gold-2026-09-12.html');

let pass = 0; const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); return true; }
  fails.push(name);
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const eq = (name, actual, expected) =>
  ok(name, String(actual) === String(expected),
    'expected ' + JSON.stringify(expected) + '\n        actual   ' + JSON.stringify(actual));

/* ===================== the shipped client block, transformed and run ===================== */
const block = BB.readBabelBlock();
const rawCode = block.raw;
const transformed = BB.transformBabelBlock(block);

// A STORE THIS FILE OWNS, with the one thing a stub usually forgets: the ability to be emptied
// and re-seeded between scenes, so each scene below starts on a device of its own.
const store = (() => {
  const d = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null),
    setItem: (k, v) => { d[k] = String(v); },
    removeItem: (k) => { delete d[k]; },
    clear: () => { for (const k in d) delete d[k]; },
    raw: (k) => (Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null),
  };
})();

const { window } = parseHTML('<!DOCTYPE html><html lang="ar" dir="rtl"><body><div id="root"></div><div id="calc"></div></body></html>');
window.self = window; window.window = window; window.globalThis = window;
window.matchMedia = (q) => ({ matches: false, media: String(q), addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
window.scrollTo = () => {};
window.alert = () => {}; window.confirm = () => true;
window.localStorage = store;
// THE NETWORK LEDGER, AND THE ONE ANSWER IT GIVES. Not a stub that swallows the call -- a
// RECORDER with a swappable reply, because half of section E is a claim about how many times
// this array is appended to.
const NET = [];
let REPLY = () => Promise.resolve(jsonResponse({ ok: false, reason: 'network' }));
function jsonResponse(body, status) {
  const code = status == null ? 200 : status;
  return { ok: code >= 200 && code < 300, status: code, json: () => Promise.resolve(body) };
}
window.fetch = function (u) { NET.push(String(u)); return REPLY(); };
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
const define = (k, v) => { try { Object.defineProperty(global, k, { configurable: true, writable: true, value: v }); } catch (e) {} };
define('navigator', window.navigator); define('window', window); define('document', window.document);

const ctx = vm.createContext(window);
const loadUMD = (f) => vm.runInContext(fs.readFileSync(path.join(REPO, 'vendor', f), 'utf8'), ctx, { filename: f });
loadUMD('react.umd.js'); loadUMD('react-dom.umd.js');
if (!window.React || !window.ReactDOM) { console.error('React/ReactDOM did not load.'); process.exit(2); }
// The application self-mounts; its createRoot is neutered so the whole app does not boot into
// this window, and the real one is kept for the one component this file mounts.
vm.runInContext('globalThis.__realCreateRoot = ReactDOM.createRoot;'
  + 'ReactDOM.createRoot = function () { return { render: function () {}, unmount: function () {} }; };', ctx);
window.addEventListener('error', () => {});
window.console.error = () => {};
try { vm.runInContext(transformed, ctx, { filename: 'babel-block.jsx' }); }
catch (e) { console.error('RUNTIME ERROR:\n' + String(e && e.stack ? e.stack : e)); process.exit(2); }
const grab = (expr) => {
  try { return vm.runInContext('(' + expr + ')', ctx, { filename: 'item96-measure' }); }
  catch (e) { return { __err: String(e && e.message ? e.message : e) }; }
};

// THE HOST. It is the ONE thing this file writes in JSX-free React, and it exists because the
// hook and the layer are deliberately not in the same component in the shipped code: the owner
// fetches, the layer receives. This host is that owner, and nothing else about it is invented.
vm.runInContext(`globalThis.__GoldHost = function (props) {
  var g = useEzikGoldPrice(props.open);
  return React.createElement(EzikCalcSection, { onClose: function () {}, gold: g });
};`, ctx);
const host = window.document.getElementById('calc');
vm.runInContext('globalThis.__calcRoot = __realCreateRoot(document.getElementById("calc"));', ctx);

const flush = (fn) => vm.runInContext('ReactDOM.flushSync(function () { (' + fn + ')(); });', ctx);
// A REAL WAIT, not a guess. React schedules passive effects through the scheduler and the fetch
// resolves on the microtask queue, so a scene is only settled once both have had their turn.
const settle = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0)); };
let sceneNo = 0;
const render = (open) => {
  window.__open = !!open; window.__key = 's' + sceneNo;
  flush('function(){ __calcRoot.render(React.createElement(__GoldHost, { open: globalThis.__open, key: globalThis.__key })); }');
};
const q = (sel) => host.querySelector(sel);
const qa = (sel) => Array.from(host.querySelectorAll(sel));
const press = (sel) => {
  const el = q(sel);
  if (!el) { fails.push('missing control ' + sel); console.log('  FAIL  missing control ' + sel); return false; }
  window.__pressTarget = el;
  flush('function(){ globalThis.__pressTarget.click(); }');
  return true;
};
// Typing, in the three steps guards/i18n-ui-guard.cjs and the item-95 battery both use: the
// native setter, a bubbling input event, and the element's own React onChange.
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
const fieldValue = (name) => { const e = q('[data-ezik-calc-field="' + name + '"]'); return e ? e.value : null; };
const out = (id) => { const e = q('[data-ezik-calc-out="' + id + '"]'); return e ? e.textContent : null; };
const goldLine = () => { const e = q('[data-ezik-gold-line]'); return e ? e.getAttribute('data-ezik-gold-line') : null; };
const goldLineText = () => { const e = q('[data-ezik-gold-line]'); return e ? e.textContent : null; };

/* ===================== the fixture and the shipped server module ===================== */
const KEY = 'ezik_gold_price_v1';
const GOLD_ENDPOINT = '/api/gold-price';
// THE MINISTRY'S OWN FOUR NUMBERS on the day the fixture was taken, written here as the strings
// the page printed. The build order states the same four; if the fixture and these disagree the
// case below says so rather than quietly following whichever moved.
const PRICES = { 24: '43.179', 22: '39.617', 21: '37.819', 18: '32.416' };
// The update line the ministry printed, character for character. It is DATA, not a sentence this
// app wrote: it is never translated, never reformatted and never converted to other numerals, so
// it is asserted here as the bytes the ministry served rather than as an escape of them.
const UPDATED = 'سبتمبر 11, 2026, 8:05 ص';

(async () => {
  let API;
  try { API = await import('file://' + path.join(REPO, 'api', 'gold-price.js').replace(/\\/g, '/')); }
  catch (e) { console.error('api/gold-price.js did not load:\n' + String(e && e.stack ? e.stack : e)); process.exit(2); }

  let fixture = null, fixtureRead = null;
  try { fixture = fs.readFileSync(FIXTURE, 'utf8'); } catch (e) { fixtureRead = String(e && e.message ? e.message : e); }

  /* ===================== A. THE PARSER, AGAINST THE REAL PAGE ===================== */
  console.log('\n=== A. THE PARSER -- the real ministry page, read as text ===');
  if (fixture == null) {
    ok('FIXTURE=BLOCKED -- tools/fixtures/moci-gold-2026-09-12.html could not be read', false, String(fixtureRead));
  } else {
    ok('the fixture is the real page: it carries the table and the update line',
      fixture.indexOf('id="gold_price"') !== -1 && fixture.indexOf('id="update_time"') !== -1,
      fixture.slice(0, 120));
    const r = API.parseGoldPage(fixture);
    ok('the happy path parses', r.ok === true, JSON.stringify(r));
    for (const k of ['24', '22', '21', '18']) {
      eq('karat ' + k + ' comes out as the printed digit string', r.prices && r.prices[k], PRICES[k]);
      ok('...and it is a STRING, not a number', typeof (r.prices || {})[k] === 'string',
        typeof (r.prices || {})[k]);
    }
    eq('the date comes out raw, exactly as the ministry printed it', r.updated_text, UPDATED);
    eq('the ounce row is read past: four karats and no fifth key',
      JSON.stringify(Object.keys(r.prices || {}).sort()), JSON.stringify(['18', '21', '22', '24']));
    ok('...and the ounce figure appears nowhere in the result',
      JSON.stringify(r).indexOf('1343.01') === -1, JSON.stringify(r));
    ok('the dollar column is never read: no dollar figure reaches the result',
      JSON.stringify(r).indexOf('140.808') === -1, JSON.stringify(r));
    // A NEGATIVE ON THE FIXTURE ITSELF. If the saved page ever stopped carrying the numbers the
    // build order measured, every case above would go on passing against whatever replaced them.
    for (const k of Object.keys(PRICES)) {
      ok('the fixture still carries the ministry figure ' + PRICES[k] + ' for karat ' + k,
        fixture.indexOf(PRICES[k]) !== -1);
    }
  }

  /* ===================== B. THE PARSER, WHEN THE PAGE CHANGES SHAPE ===================== */
  console.log('\n=== B. THE PARSER -- a page whose shape moved. Never a partial result ===');
  if (fixture == null) {
    ok('FIXTURE=BLOCKED -- the shape cases cannot be measured without the real page', false, 'no fixture');
  } else {
    // Each mutation is applied to the real fixture IN MEMORY and is asserted to have CHANGED it,
    // so a mutation that silently matched nothing cannot report a false pass.
    const mutate = (name, from, to, reason) => {
      const broken = fixture.replace(from, to);
      if (!ok(name + ': the mutation really changed the page', broken !== fixture)) return;
      const r = API.parseGoldPage(broken);
      eq(name + ': ok is false', r.ok, false);
      eq(name + ': ...and the reason is ' + reason, r.reason, reason);
      ok(name + ': ...and NO prices object is returned at all',
        !Object.prototype.hasOwnProperty.call(r, 'prices'), JSON.stringify(r));
    };
    mutate('the table is gone', 'id="gold_price"', 'id="something_else"', 'table_missing');
    mutate('the update line is gone', 'id="update_time"', 'id="whenever"', 'date_missing');
    // ONE karat row removed -- the 22 row, whole, from its <tr> to its </tr>.
    const rowRe = /<tr>\s*<td><p class="gold_type">[^<]*22[^<]*<\/p><\/td>[\s\S]*?<\/tr>/;
    ok('a single karat row is locatable in the real page', rowRe.test(fixture));
    mutate('one karat row is missing', rowRe, '', 'karat_missing');
    // A price cell that is not a plain decimal number, in three shapes it could really take.
    mutate('a price cell is a dash', '43.179', '--', 'bad_price');
    mutate('a price cell uses a comma for the decimal mark', '43.179', '43,179', 'bad_price');
    mutate('a price cell carries a thousands separator', '39.617', '1,039.617', 'bad_price');
    // AND THE OUNCE ROW IS NOT READ AT ALL, which is asserted rather than assumed: breaking it
    // must NOT break the answer, because the calculator's nisab is 85 grams and has no use for
    // an ounce. A parser that read it would be a parser with a fifth way to fail.
    {
      const ouncebroken = fixture.replace('1343.01', 'not a number');
      ok('breaking the ounce row changes the page', ouncebroken !== fixture);
      const r = API.parseGoldPage(ouncebroken);
      eq('...and the four karats still parse, because the ounce is never read', r.ok, true);
    }
    // And the empty page, which is the shape a fetch that returned nothing would take.
    const empty = API.parseGoldPage('');
    eq('an empty body is a failure, not an empty success', empty.ok, false);
    eq('...with the table named as the reason', empty.reason, 'table_missing');
  }

  /* ===================== C. THE TRANSPORT ===================== */
  console.log('\n=== C. THE TRANSPORT -- a timeout and a non-200 are failures ===');
  {
    const realFetch = globalThis.fetch;
    const drive = async (impl) => {
      globalThis.fetch = impl;
      try { return await API.fetchGoldPrice(); } finally { globalThis.fetch = realFetch; }
    };
    const timedOut = await drive(() => {
      const e = new Error('The operation was aborted due to timeout');
      e.name = 'TimeoutError';
      return Promise.reject(e);
    });
    eq('a timeout is ok:false', timedOut.ok, false);
    eq('...and it is named a timeout rather than a generic failure', timedOut.reason, 'timeout');
    const refused = await drive(() => Promise.reject(new TypeError('fetch failed')));
    eq('a network error is ok:false', refused.ok, false);
    eq('...and is named as one', refused.reason, 'network');
    const five = await drive(() => Promise.resolve({ status: 503, text: () => Promise.resolve('<html></html>') }));
    eq('a non-200 from the ministry is ok:false', five.ok, false);
    eq('...and is named by its status rather than parsed anyway', five.reason, 'bad_status');
    const three = await drive(() => Promise.resolve({ status: 302, text: () => Promise.resolve('') }));
    eq('a redirect that was not followed to a 200 is also ok:false', three.ok, false);
    if (fixture != null) {
      const good = await drive(() => Promise.resolve({ status: 200, text: () => Promise.resolve(fixture) }));
      eq('a 200 carrying the real page reaches the parser and succeeds', good.ok, true);
      eq('...with karat 24 intact through the whole transport', good.prices && good.prices['24'], PRICES['24']);
    }
    // THE TIMEOUT IS EIGHT SECONDS, AS THE ORDER SPECIFIES, and it is read off the shipped
    // constant rather than off a comment about it.
    eq('the declared timeout is 8 seconds', API.GOLD_TIMEOUT_MS, 8000);
    eq('the URL is the one the order names', API.GOLD_URL, 'https://www.moci.gov.kw/ar/nthm-lasaar/gold/');
  }

  /* ===================== D. THE RESPONSE CONTRACT ===================== */
  console.log('\n=== D. THE CONTRACT -- two shapes, both 200, and the cache header ===');
  {
    const realFetch = globalThis.fetch;
    const call = async (impl, method) => {
      globalThis.fetch = impl;
      const res = { code: null, headers: {}, body: null,
        status(c) { this.code = c; return this; },
        setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; },
        json(b) { this.body = b; return this; } };
      try { await API.default({ method: method || 'GET' }, res); } finally { globalThis.fetch = realFetch; }
      return res;
    };
    if (fixture != null) {
      const good = await call(() => Promise.resolve({ status: 200, text: () => Promise.resolve(fixture) }));
      eq('success answers HTTP 200', good.code, 200);
      eq('...and its body carries exactly the six fields the order names',
        JSON.stringify(Object.keys(good.body).sort()),
        JSON.stringify(['fetched_at', 'ok', 'prices', 'source', 'updated_text', 'url'].sort()));
      eq('...ok is true', good.body.ok, true);
      eq('...source is moci.gov.kw', good.body.source, 'moci.gov.kw');
      eq('...url is the page the number came from', good.body.url, API.GOLD_URL);
      eq('...updated_text is the ministry line, raw', good.body.updated_text, UPDATED);
      eq('...prices carries the four karats as strings',
        JSON.stringify(good.body.prices), JSON.stringify(PRICES));
      ok('...fetched_at is an ISO 8601 UTC instant',
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(String(good.body.fetched_at)),
        String(good.body.fetched_at));
      eq('the success cache header is the one the order specifies',
        good.headers['cache-control'], 'public, s-maxage=600, stale-while-revalidate=0');
    }
    const bad = await call(() => Promise.reject(new TypeError('fetch failed')));
    eq('failure ALSO answers HTTP 200', bad.code, 200);
    eq('...and its body carries ok and reason and nothing else',
      JSON.stringify(Object.keys(bad.body).sort()), JSON.stringify(['ok', 'reason']));
    eq('...ok is false', bad.body.ok, false);
    ok('...and the reason is short ascii', /^[a-z_]{1,32}$/.test(String(bad.body.reason)), String(bad.body.reason));
    ok('a failure is never cached', /no-store/.test(String(bad.headers['cache-control'])),
      String(bad.headers['cache-control']));
    const posted = await call(() => Promise.resolve({ status: 200, text: () => Promise.resolve('') }), 'POST');
    eq('a method that is not GET makes no outbound call and answers in the failure shape',
      JSON.stringify(posted.body), JSON.stringify({ ok: false, reason: 'method' }));
  }

  /* ===================== E. THE DAY ===================== */
  console.log('\n=== E. THE DAY -- one round trip per calendar day, and never one per open ===');
  // THE MOUNTED SECTIONS RUN IN ENGLISH, deliberately, and the switch happens THROUGH THE APP.
  // This app draws a QUANTITY in the numerals of the interface language, so in Arabic a figure
  // assertion written in Western digits would be measuring the numeral system -- and, worse, the
  // negative case in H1 ("yesterday's price appears nowhere") would pass vacuously, because the
  // digits it searches for would not be the digits on the screen. The item-95 battery measures
  // the Arabic rendering of this same screen, in its own section D.
  eq('a fresh device boots this app in Arabic', grab('ezLangGet()'), 'ar');
  flush('function(){ ezLangSet("en"); }');
  eq('...and the harness switches it to English through the app\'s own setter', grab('ezLangGet()'), 'en');
  const today = grab('ezcGoldDay()');
  ok('the device day is a plain YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(String(today)), String(today));
  const yesterday = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    const two = (n) => (n < 10 ? '0' + n : String(n));
    return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
  })();

  // A SCENE: an empty device, one seeded entry, one reply, one open.
  const scene = async (seed, reply) => {
    sceneNo++;
    render(false);
    await settle();
    // ONLY THIS FEATURE'S KEY IS SWEPT between scenes, not the whole store: the interface
    // language is a key too, and clearing it would send the next scene back to Arabic.
    store.removeItem(KEY);
    if (seed) store.setItem(KEY, JSON.stringify(seed));
    NET.length = 0;
    REPLY = reply || (() => Promise.resolve(jsonResponse({ ok: false, reason: 'network' })));
    render(true);
    await settle();
  };
  const okReply = () => Promise.resolve(jsonResponse({
    ok: true, source: 'moci.gov.kw', url: API.GOLD_URL, updated_text: UPDATED,
    prices: { 24: PRICES['24'], 22: PRICES['22'], 21: PRICES['21'], 18: PRICES['18'] },
    fetched_at: '2026-09-12T05:05:00.000Z',
  }));

  // E1 -- SAME DAY. A complete entry stamped today answers the open by itself.
  await scene({ day: today, prices: PRICES, updated_text: UPDATED }, okReply);
  eq('E1 an entry stored for TODAY makes no call at all', JSON.stringify(NET), JSON.stringify([]));
  press('[data-ezik-calc="a2"]');
  await settle();
  eq('E1 ...and the field is prefilled from the stored 24-karat price', fieldValue('goldP'), PRICES['24']);
  eq('E1 ...and the line drawn is the source line', goldLine(), 'source');
  ok('E1 ...carrying the ministry date the entry was stored with',
    String(goldLineText()).indexOf(UPDATED) !== -1, String(goldLineText()));

  // E2 -- A NEW DAY. An entry stamped yesterday is not today's, so exactly one call is made.
  await scene({ day: yesterday, prices: PRICES, updated_text: UPDATED }, okReply);
  eq('E2 an entry stored for YESTERDAY costs exactly one call',
    JSON.stringify(NET), JSON.stringify([GOLD_ENDPOINT]));
  eq('E2 ...and the entry now on the device is stamped today',
    JSON.parse(store.raw(KEY) || '{}').day, today);

  // E3 -- A DEVICE THAT HAS NEVER OPENED IT, and then the SAME day a second time.
  await scene(null, okReply);
  eq('E3 a device with no entry at all costs exactly one call',
    JSON.stringify(NET), JSON.stringify([GOLD_ENDPOINT]));
  const wrote = JSON.parse(store.raw(KEY) || '{}');
  eq('E3 ...and the entry written carries the day, the prices and the ministry text',
    JSON.stringify(Object.keys(wrote).sort()), JSON.stringify(['day', 'prices', 'updated_text']));
  eq('E3 ...with the four prices as the strings they arrived as',
    JSON.stringify(wrote.prices), JSON.stringify(PRICES));
  ok('E3 ...and the chosen karat is NOT stored',
    String(store.raw(KEY)).indexOf('karat') === -1, String(store.raw(KEY)));
  // The second open, on the entry the first one just wrote. NET is NOT cleared here: the whole
  // claim is that it does not grow.
  sceneNo++;
  render(false);
  await settle();
  render(true);
  await settle();
  eq('E3 ...and opening it AGAIN the same day adds no second call',
    JSON.stringify(NET), JSON.stringify([GOLD_ENDPOINT]));
  press('[data-ezik-calc="a2"]');
  await settle();
  eq('E3 ...while the field is still prefilled on that second open', fieldValue('goldP'), PRICES['24']);

  /* ===================== F. THE PRICE PATH ===================== */
  console.log('\n=== F. THE PRICE PATH -- a digit string into an exact fraction, and no float ===');
  // The scene is still E3's: today's prices are in hand and a2 is on screen.
  eq('the prefilled string is the ministry\'s, character for character', fieldValue('goldP'), '43.179');
  eq('...and the shipped parser turns that very string into an exact fraction',
    grab('String(ezcParse("43.179").n) + "/" + String(ezcParse("43.179").d)'), '43179/1000');
  type('goldW', '100.000');
  await settle();
  ok('100.000g at the ministry\'s 43.179: the value is 4317.900',
    /4317\.900/.test(out('zakat') || ''), out('zakat'));
  ok('...and the fortieth of it is 107.948, computed as a fraction',
    /107\.948/.test(out('zakat') || ''), out('zakat'));
  eq('...which is what the shipped arithmetic makes of it, called directly',
    grab('ezcText(ezcMul(ezcMul(ezcParse("100.000"), ezcParse("43.179")), EZC_RATE))'), '107.948');

  // CHANGING THE KARAT IS AN EXPLICIT ACT AND DOES REFILL.
  press('[data-ezik-gold-karat="21"]');
  await settle();
  eq('pressing a karat refills the field from THAT karat', fieldValue('goldP'), PRICES['21']);
  eq('...and the picker offers exactly the four karats',
    JSON.stringify(qa('[data-ezik-gold-karat]').map((e) => e.getAttribute('data-ezik-gold-karat'))),
    JSON.stringify(['24', '22', '21', '18']));
  // AND A TYPED PRICE IS NEVER OVERWRITTEN.
  type('goldP', '19.500');
  await settle();
  eq('a price the reader typed stands', fieldValue('goldP'), '19.500');
  press('[data-ezik-calc="a1"]'); await settle();
  press('[data-ezik-calc="a2"]'); await settle();
  eq('...and still stands after leaving the gold calculator and coming back', fieldValue('goldP'), '19.500');
  press('[data-ezik-gold-karat="18"]');
  await settle();
  eq('...but pressing a karat -- an explicit act -- does replace it', fieldValue('goldP'), PRICES['18']);

  // NO FLOAT ANYWHERE ON THE PATH, read out of the source of both halves.
  const FLOAT_WORDS = ['parseFloat', 'Number(', 'parseInt', 'toFixed', 'Math.round', 'valueOf()'];
  const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, '').replace(/([^:])\/\/.*$/gm, '$1');
  const blockStart = rawCode.indexOf('// ITEM 96 -- THE DAY\'S GOLD PRICE, AND THE ONE ROUND TRIP IT COSTS');
  const blockEnd = rawCode.indexOf('// ITEM 95 -- THE SHARIAH CALCULATOR. NINE CALCULATORS');
  ok('the item 96 block is locatable in the shipped source, above the item 95 one',
    blockStart !== -1 && blockEnd > blockStart, 'start=' + blockStart + ' end=' + blockEnd);
  const clientCode = stripComments(rawCode.slice(blockStart, blockEnd));
  eq('the client block names no float conversion at all',
    JSON.stringify(FLOAT_WORDS.filter((w) => clientCode.indexOf(w) !== -1)), JSON.stringify([]));
  const serverCode = stripComments(fs.readFileSync(path.join(REPO, 'api', 'gold-price.js'), 'utf8'));
  eq('api/gold-price.js names no float conversion either',
    JSON.stringify(FLOAT_WORDS.filter((w) => serverCode.indexOf(w) !== -1)), JSON.stringify([]));
  ok('...and neither file does arithmetic on a price',
    clientCode.indexOf('prices[') !== -1 && !/prices\[[^\]]*\]\s*[*+/-]/.test(clientCode)
    && !/prices\[[^\]]*\]\s*[*+/-]/.test(serverCode));
  // THE ITEM 95 BLOCK IS STILL WHAT IT SAYS IT IS: the network and the storage key live above it.
  const calcCode = stripComments(rawCode.slice(blockEnd, rawCode.indexOf('// THE HOME THE READER ARRANGES -- THE FRAMEWORK')));
  ok('the calculator block itself still makes no request and declares no key',
    calcCode.indexOf('fetch(') === -1 && calcCode.indexOf('localStorage') === -1
    && !/ezik_[a-z_]+_v\d/.test(calcCode));

  /* ===================== G. THE ROSTER AND THE DICTIONARY ===================== */
  console.log('\n=== G. THE ROSTER AND THE DICTIONARY ===');
  const appSrc = fs.readFileSync(path.join(REPO, 'app.jsx'), 'utf8');
  const deleteSrc = fs.readFileSync(path.join(REPO, 'tools', 'delete-truth-measure.cjs'), 'utf8');
  eq('the key is declared once, as a named constant',
    (appSrc.match(/const EZC_GOLD_PRICE_KEY = 'ezik_gold_price_v1';/g) || []).length, 1);
  eq('...and the literal appears nowhere else in app.jsx',
    (appSrc.match(/ezik_gold_price_v1/g) || []).length, 1);
  const resetAt = appSrc.indexOf('const resetAll = () => {');
  const resetEnd = appSrc.indexOf('setScreen(\'onboarding\');', resetAt);
  ok('resetAll is locatable', resetAt !== -1 && resetEnd > resetAt, resetAt + '/' + resetEnd);
  ok('resetAll removes it', appSrc.slice(resetAt, resetEnd).indexOf('localStorage.removeItem(EZC_GOLD_PRICE_KEY)') !== -1);
  const rosterAt = deleteSrc.indexOf('const MUST_GO_ALREADY = [');
  const rosterEnd = deleteSrc.indexOf('\n];', rosterAt);
  ok('MUST_GO_ALREADY is locatable', rosterAt !== -1 && rosterEnd > rosterAt);
  ok('...and it names the key', deleteSrc.slice(rosterAt, rosterEnd).indexOf("{ c: 'EZC_GOLD_PRICE_KEY' }") !== -1);

  const dict = (() => {
    const src = appSrc.slice(appSrc.indexOf('const EZ_I18N = {'));
    const enAt = src.indexOf('\n  en: {');
    const arHalf = src.slice(0, enAt), enHalf = src.slice(enAt, src.indexOf('\n};', enAt));
    const keysIn = (s) => (s.match(/^    '([^']+)':/gm) || []).map((x) => x.replace(/^\s*'/, '').replace(/':$/, ''));
    return { ar: keysIn(arHalf), en: keysIn(enHalf) };
  })();
  eq('the two dictionary halves are still the same size', dict.ar.length, dict.en.length);
  eq('...and they are 549 each after this item added seven', dict.ar.length, 549);
  const NEW_KEYS = ['calc.gold.source', 'calc.gold.failed', 'calc.gold.karat',
    'calc.gold.karat24', 'calc.gold.karat22', 'calc.gold.karat21', 'calc.gold.karat18'];
  for (const k of NEW_KEYS) {
    ok('"' + k + '" exists on both sides', dict.ar.indexOf(k) !== -1 && dict.en.indexOf(k) !== -1,
      'ar=' + (dict.ar.indexOf(k) !== -1) + ' en=' + (dict.en.indexOf(k) !== -1));
  }
  const AR = grab('EZ_I18N.ar'), EN = grab('EZ_I18N.en');
  for (const k of NEW_KEYS) {
    ok('"' + k + '" has a non-empty value in both languages',
      typeof AR[k] === 'string' && AR[k].trim() !== '' && typeof EN[k] === 'string' && EN[k].trim() !== '');
  }
  const ph = (v) => (String(v).match(/\{[A-Za-z0-9_]+\}/g) || []).sort();
  eq('the source line carries {date} in Arabic', JSON.stringify(ph(AR['calc.gold.source'])), JSON.stringify(['{date}']));
  eq('...and in English', JSON.stringify(ph(EN['calc.gold.source'])), JSON.stringify(['{date}']));
  eq('the failure line carries no placeholder at all', JSON.stringify(ph(AR['calc.gold.failed'])), JSON.stringify([]));
  // THE WORD «TODAY» IS NOT IN THE SOURCE LINE, in either language: the date shown is the
  // ministry's, and a line that said "today" would be this app speaking for them.
  ok('the source line never says "today" in English', String(EN['calc.gold.source']).toLowerCase().indexOf('today') === -1,
    String(EN['calc.gold.source']));
  ok('...and never says اليوم in Arabic',
    String(AR['calc.gold.source']).indexOf('اليوم') === -1);

  // ITEM 96-B -- THE HINT NO LONGER SAYS EVERY PRICE IS THE READER'S TO TYPE. The sentence under
  // the calculator picker was written for item 95, when it was true of every price on the screen;
  // item 96 made it false of one of them, and the sentence did not move with it. It is asserted
  // here by what the value does NOT say -- so an edit that puts the old claim back, in either
  // language, fails here rather than shipping a promise the gold field no longer keeps.
  const OFFLINE_GONE = {
    ar: ['والأسعارُ من إدخالك وحدَك', 'وحدَك'],
    en: ['the prices are yours alone to type', 'yours alone'],
  };
  ok('calc.offline no longer claims that every price is typed by the reader',
    OFFLINE_GONE.ar.every((p) => String(AR['calc.offline']).indexOf(p) === -1)
    && OFFLINE_GONE.en.every((p) => String(EN['calc.offline']).indexOf(p) === -1),
    'ar=' + AR['calc.offline'] + ' | en=' + EN['calc.offline']);

  /* ===================== H. THE FAILURE, AND THE WAIT ===================== */
  console.log('\n=== H. THE FAILURE STATE, AND THE SILENCE BEFORE IT ===');
  // H1 -- THE CALL FAILS on a device that has YESTERDAY's prices stored. The old price must not
  // appear: not in the field, not in the line, not anywhere on the screen.
  await scene({ day: yesterday, prices: PRICES, updated_text: UPDATED },
    () => Promise.resolve(jsonResponse({ ok: false, reason: 'timeout' })));
  press('[data-ezik-calc="a2"]');
  await settle();
  eq('H1 the field is empty', fieldValue('goldP'), '');
  eq('H1 ...the failure line is the one shown', goldLine(), 'failure');
  eq('H1 ...and the source line is absent', qa('[data-ezik-gold-line="source"]').length, 0);
  eq('H1 ...and the karat picker is not drawn, because there is nothing to pick from',
    qa('[data-ezik-gold-karat]').length, 0);
  ok('H1 ...and YESTERDAY\'s price appears nowhere on the screen',
    String(host.textContent).indexOf(PRICES['24']) === -1);
  ok('H1 ...and the field is still editable', (() => {
    const el = q('[data-ezik-calc-field="goldP"]');
    return !!el && el.getAttribute('disabled') === null && el.getAttribute('readonly') === null;
  })());
  type('goldP', '44.000');
  await settle();
  eq('H1 ...and typing into it works', fieldValue('goldP'), '44.000');

  // H2 -- A REPLY THAT IS MALFORMED is a failure too, not a half-filled screen.
  await scene(null, () => Promise.resolve(jsonResponse({ ok: true, updated_text: UPDATED, prices: { 24: '43.179' } })));
  press('[data-ezik-calc="a2"]');
  await settle();
  eq('H2 a reply carrying one karat of four is a failure', goldLine(), 'failure');
  eq('H2 ...and the field stays empty rather than half-right', fieldValue('goldP'), '');
  eq('H2 ...and the day is still recorded, so the failure costs one call and not one per open',
    JSON.parse(store.raw(KEY) || '{}').day, today);
  eq('H2 ...with an empty prices object on it',
    JSON.stringify(JSON.parse(store.raw(KEY) || '{}').prices), JSON.stringify({}));

  // H3 -- WHILE THE CALL IS OUT there is no line at all. The reply never resolves, so what is on
  // screen is exactly what a reader sees in the second before the answer arrives.
  await scene(null, () => new Promise(() => {}));
  press('[data-ezik-calc="a2"]');
  await settle();
  eq('H3 a call in flight draws NO line of any kind', qa('[data-ezik-gold-line]').length, 0);
  eq('H3 ...not the failure line in particular', qa('[data-ezik-gold-line="failure"]').length, 0);
  eq('H3 ...and the field is empty and waiting', fieldValue('goldP'), '');
  eq('H3 ...and exactly one call is out', JSON.stringify(NET), JSON.stringify([GOLD_ENDPOINT]));

  // H4 -- THE NINE STILL CALCULATE WITH ZERO NETWORK. Every calculator is walked on a device
  // whose day is already recorded, and the ledger is read afterwards.
  await scene({ day: today, prices: PRICES, updated_text: UPDATED }, okReply);
  NET.length = 0;
  for (const id of ['a1', 'a2', 'a3', 'a4', 'b1', 'b2', 'b3', 'b4', 'b5']) {
    press('[data-ezik-calc="' + id + '"]');
    await settle();
  }
  eq('H4 walking all nine calculators makes no request of any kind',
    JSON.stringify(NET), JSON.stringify([]));

  /* ===================== the count ===================== */
  console.log('\nFIXTURE=' + (fixture == null ? 'BLOCKED' : 'OK'));
  console.log((fails.length === 0
    ? '=== ' + pass + '/' + pass + ' - PASS ==='
    : '=== ' + pass + '/' + (pass + fails.length) + ' - FAIL ===\n' + fails.map((f) => '  * ' + f).join('\n')));
  process.exit(fails.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error('BATTERY ERROR:\n' + String(e && e.stack ? e.stack : e));
  process.exit(2);
});
