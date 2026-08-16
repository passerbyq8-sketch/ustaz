// guards/standing-notice-band-guard.cjs — §٥: the standing notice is conditioned on the band the
// application actually measures.
//
// THE DEFECT THIS GATE EXISTS TO PIN. index.html rendered `ezT('chat.standingNotice')` with NO
// condition of any kind — no band, no age, no profile — so every adult using Ezik was told
// «راجِعْ ما يهمُّك مع والديك»: check what matters to you with your parents. A grown reader was
// being sent to his parents by a line that had never asked who he was.
//
// WHAT THE CONDITION IS ALLOWED TO READ. `deriveCaps(profile.age).band`, and nothing else. That
// is the band this application already derives from the stored birth year on every boot and
// already gates uploads, exports, the depth tiers and the voice call on. A new profile field
// invented for this notice would be a second age model, and the two would disagree the first
// time one of them was migrated.
//
// WHY THE SPLIT IS AT `adult` AND NOT AT `young`. The directive's words are «البالغُ يرى صيغةً
// بلا والديك، والصغيرُ يراها كما هي». A thirteen-to-seventeen reader is a minor living in his
// parents' house, so the sentence is true for him and he keeps it; eighteen and over is this
// application's own line for a grown reader (the depth tiers are gated on exactly it).
//
// HOW IT IS MEASURED. The shipped text/babel block is extracted from index.html, transformed with
// the page's own pinned Babel major and evaluated, and `standingNoticeKey` is driven for real.
// A regex over the file would prove only that some characters are present somewhere.
//
// Offline and deterministic. No network, no model.
//   node guards/standing-notice-band-guard.cjs [--mutants]
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');
const { parseHTML } = require('linkedom');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const PARENTS = 'والديك';

let pass = 0;
let fail = 0;

function ok(label, condition, detail) {
  if (condition) { pass++; console.log('  PASS  ' + label); return true; }
  fail++;
  console.log('  FAIL  ' + label + (detail === undefined ? '' : '  |  ' + detail));
  return false;
}

// ── Boot the shipped client block ───────────────────────────────────────────
// Same mechanics as guards/truncated-tag-fallback-par-a-guard.cjs, for the same reason.
function bootClient(source) {
  const html = source === undefined ? fs.readFileSync(INDEX, 'utf8') : source;
  const openRe = /<script[^>]*type=["']text\/babel["'][^>]*>/i;
  const mOpen = openRe.exec(html);
  if (!mOpen) throw new Error('no text/babel block in index.html');
  const from = mOpen.index + mOpen[0].length;
  const rawCode = html.slice(from, html.indexOf('</script>', from));

  const babelSrc = (html.match(/<script[^>]*src=["']([^"']*@babel\/standalone[^"']*)["']/i) || [])[1] || '';
  const verMatch = babelSrc.match(/@babel\/standalone@(\d+)\./);
  const babelMajor = verMatch ? parseInt(verMatch[1], 10) : 8;
  const jsxRuntime = babelMajor >= 8 ? 'automatic' : 'classic';

  const transformed = babel.transformSync(rawCode, {
    presets: [['@babel/preset-react', { runtime: jsxRuntime }]],
    filename: 'babel-block.jsx',
    configFile: false, babelrc: false,
  }).code;

  const { window } = parseHTML('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
  try { if (!window.TextDecoder) window.TextDecoder = TextDecoder; } catch (e) {}
  try { if (!window.TextEncoder) window.TextEncoder = TextEncoder; } catch (e) {}
  try { if (!window.AbortController) window.AbortController = AbortController; } catch (e) {}
  try { window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); } catch (e) {}
  try { window.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; } catch (e) {}
  global.window = window; global.document = window.document;
  // `globalThis.navigator` is an accessor with no setter from Node 21 on, so under 'use strict'
  // this assignment THROWS rather than failing quietly the way it does in a sloppy-mode guard.
  // The client block only ever reads it, so a failed install is not a reason to stop.
  try { global.navigator = window.navigator; } catch (e) { /* read-only global */ }
  try { window.self = window; } catch (e) {}
  try { window.globalThis = window; } catch (e) {}
  const ctx = vm.createContext(window);
  const vendor = path.join(ROOT, 'vendor');
  for (const f of ['react.umd.js', 'react-dom.umd.js']) {
    vm.runInContext(fs.readFileSync(path.join(vendor, f), 'utf8'), ctx, { filename: f });
  }
  vm.runInContext('ReactDOM.createRoot = function () { return { render: function () {}, unmount: function () {} }; };', ctx);
  window.console.error = () => {};
  window.addEventListener('error', () => {});
  vm.runInContext(transformed, ctx, { filename: 'babel-block.jsx' });

  const grab = (expr) => {
    try { return vm.runInContext('(' + expr + ')', ctx, { filename: 'guard-api' }); }
    catch (e) { return undefined; }
  };
  return { grab };
}

// The property both mutants are measured against, stated once. Each band is driven through the
// real `deriveCaps` from a real AGE, not from a hand-written band string — a rule keyed on a band
// nobody derives is a rule that never fires in the app.
function bandsAreServedCorrectly(client) {
  const keyFor = client.grab('standingNoticeKey');
  const caps = client.grab('deriveCaps');
  const dict = client.grab('EZ_I18N.ar');
  if (typeof keyFor !== 'function' || typeof caps !== 'function' || !dict) return false;
  const textFor = (age) => String(dict[keyFor(caps(age).band)] || '');
  return textFor(30).length > 0
    && !textFor(30).includes(PARENTS)
    && textFor(9).includes(PARENTS)
    && textFor(15).includes(PARENTS);
}

function runSuite(client, label) {
  console.log('\n--- ' + label + ' ---');
  const keyFor = client.grab('standingNoticeKey');
  const caps = client.grab('deriveCaps');
  ok('standingNoticeKey ships in the client block', typeof keyFor === 'function');
  ok('deriveCaps ships in the client block', typeof caps === 'function');
  if (typeof keyFor !== 'function' || typeof caps !== 'function') return;

  const dict = client.grab('EZ_I18N.ar');
  const dictEn = client.grab('EZ_I18N.en');
  ok('the Arabic string table is reachable', Boolean(dict));
  ok('the English string table is reachable', Boolean(dictEn));
  if (!dict || !dictEn) return;

  // Both keys must exist in BOTH languages, or an English reader loses the notice entirely.
  for (const key of ['chat.standingNotice', 'chat.standingNoticeAdult']) {
    ok('ar carries ' + key, typeof dict[key] === 'string' && dict[key].trim().length > 0);
    ok('en carries ' + key, typeof dictEn[key] === 'string' && dictEn[key].trim().length > 0);
  }

  // The bands, derived from ages the way the application derives them.
  const cases = [
    { age: 30, band: 'adult', parents: false },
    { age: 18, band: 'adult', parents: false },
    { age: 17, band: 'teen', parents: true },
    { age: 13, band: 'teen', parents: true },
    { age: 12, band: 'young', parents: true },
    { age: 7, band: 'young', parents: true },
  ];
  for (const c of cases) {
    const band = caps(c.age).band;
    ok('age ' + c.age + ' derives band ' + c.band, band === c.band, band);
    const text = String(dict[keyFor(band)] || '');
    ok('age ' + c.age + ' (' + band + ') ' + (c.parents ? 'keeps' : 'is NOT told') + ' «' + PARENTS + '»',
      text.includes(PARENTS) === c.parents, text);
    const en = String(dictEn[keyFor(band)] || '');
    ok('age ' + c.age + ' (' + band + ') gets the same rule in English',
      en.includes('your parents') === c.parents, en);
  }

  // The two texts must otherwise be the SAME sentence: the adult form is the child's minus the
  // parents clause, not a second notice somebody may drift.
  const child = String(dict['chat.standingNotice']);
  const adult = String(dict['chat.standingNoticeAdult']);
  ok('the adult notice is the child notice minus the parents clause, and nothing else',
    child.replace('مع والديك أو ', '') === adult, JSON.stringify([child, adult]));
  ok('the adult notice still sends the reader to people of knowledge',
    adult.includes('أهل العلم'), adult);

  ok('an unknown band is served the cautious form, never the adult one',
    keyFor(undefined) === 'chat.standingNotice' && keyFor('') === 'chat.standingNotice'
      && keyFor('grown-up') === 'chat.standingNotice', String(keyFor(undefined)));

  ok('THE PROPERTY: every band is served the notice that is true for it',
    bandsAreServedCorrectly(client));

  // The render site reads the function, not the raw key: a guard that only proved the function
  // exists would stay green while the page went on rendering the unconditional line.
  const html = fs.readFileSync(INDEX, 'utf8');
  ok('the render site is conditioned, not hard-coded',
    /ezT\(standingNoticeKey\(caps\.band\)\)/u.test(html)
      && !/ezT\('chat\.standingNotice'\)/u.test(html));
}

// ── MUTANTS ─────────────────────────────────────────────────────────────────
// Each rewrites the shipped index.html in memory and requires this gate to notice. A mutation
// that does not change the source is a hard error, never a pass. Single-line seams on purpose:
// index.html is CRLF in the working tree and LF in the object store.
function mutants() {
  console.log('\n--- REQUIRED MUTANTS ---');
  const original = fs.readFileSync(INDEX, 'utf8');
  const cases = [
    {
      name: 'unconditional-notice-again',
      // The exact pre-repair line: every reader, adult included, sent to his parents.
      apply: (s) => s.replace('ezT(standingNoticeKey(caps.band))', "ezT('chat.standingNotice')"),
    },
    {
      name: 'child-served-the-adult-form',
      // The condition inverted: the young reader loses the parents and the adult gets them.
      apply: (s) => s.replace(
        "return band === 'adult' ? 'chat.standingNoticeAdult' : 'chat.standingNotice';",
        "return band === 'adult' ? 'chat.standingNotice' : 'chat.standingNoticeAdult';"),
    },
  ];

  for (const c of cases) {
    const changed = c.apply(original);
    if (changed === original) {
      fail++;
      console.log('  FAIL  MUTANT ' + c.name + ': seam moved, mutation did not apply');
      continue;
    }
    let survived = true;
    try {
      const client = bootClient(changed);
      survived = bandsAreServedCorrectly(client)
        && /ezT\(standingNoticeKey\(caps\.band\)\)/u.test(changed)
        && !/ezT\('chat\.standingNotice'\)/u.test(changed);
    } catch (e) { survived = false; }
    ok('MUTANT KILLED: ' + c.name, !survived,
      'the defect was reintroduced and this gate stayed green');
  }
}

runSuite(bootClient(), 'live index.html');
if (process.argv.includes('--mutants')) mutants();
console.log(`\nSUMMARY standing-notice-band PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);
