// ez110-override-guard.cjs -- ITEM 110: THE SWITCH CANNOT LEAK.
//
// The redesign ships to production dark. Three things could light it for a reader who is not the
// owner, and this guard runs the REAL functions (lifted out of app.jsx) against each:
//   O1/O2  the local override ?ezik110=..&mode=..&safe=1 answers on localhost / 127.0.0.1 ONLY --
//          ezik.app, the previews, look-alike hosts and the shell are inert
//   O3     no part is 'public' unless the owner said «انشر» for it (PUBLIC_BY_OWNER below, which only
//          an agent acting on that word may extend -- see PUBLISH.md in the item 110 session)
//   O4     the in-page SHA-256 equals node's on ASCII, Arabic and long input
//   O5     the owner test accepts the code and nothing else -- not the stored hash, not an empty key
//   O6     with nothing lit, ez110Apply() touches no attribute, no meta, no stylesheet
//   O7     the plaintext code is in no tracked file
//   O8     the new device keys never enter the sync tables
//   O9     part fix (round 2): &fix=1 lights it on localhost / 127.0.0.1 only; elsewhere a non-owner never has it
//   O10    the call-to-prayer card (round 4): its own state off|owner|public, 'public' only by the owner's word ('adhan'
//          in PUBLIC_BY_OWNER); a reader who is not the owner never has it off this machine; its render asks for it
//   O10b   the call-to-prayer card draws only in a shell that answered the widget-data probe ('supported'): the
//          render's condition holds a state that starts from, and is re-synced to, ezikWidgetDataCapability === 'supported'
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const jsx = fs.readFileSync(path.join(ROOT, 'app.jsx'), 'utf8');
let fails = 0, passes = 0;
const pass = (m) => { passes++; console.log('PASS ' + m); };
const fail = (m) => { fails++; console.log('FAIL ' + m); };
// The owner's word «انشر», 11 October 2026 (round 4 order, section 1): safe, b and fix. Not c, d, e, nor the call-to-prayer card.
// The owner's word, station 5, 12 October 2026: the identities c and d. Not e (its smoothness check failed on the test
// phone, so by that word it stays the owner's), nor the call-to-prayer card.
// The owner's word, 13 October 2026 00:46 Kuwait time ("with your recommendation"), on whether the call-to-prayer card
// goes public now: 'adhan', gated on the shell's widget-data capability (EZIK-ITEM24-58-ADHAN-GATE-REPORT).
const PUBLIC_BY_OWNER = ['safe', 'b', 'fix', 'c', 'd', 'adhan']; // parts the owner has published by his word

function lift(name) {
  const i = jsx.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing ' + name);
  let d = 0, j = jsx.indexOf('{', i);
  for (let k = j; k < jsx.length; k++) { if (jsx[k] === '{') d++; else if (jsx[k] === '}') { d--; if (!d) return jsx.slice(i, k + 1); } }
  throw new Error('unbalanced ' + name);
}
const constOf = (name) => { const m = jsx.match(new RegExp('const ' + name + ' = ([^;]+);')); if (!m) throw new Error('missing const ' + name); return m[1]; };
const SRC = ['ez110AdhanCardLit', 'ez110Sha256Hex', 'ez110ReadOwner', 'ez110LocalOverride', 'ez110PartLit', 'ez110Choosable', 'ez110ReadIdentity', 'ez110SafeLit', 'ez110FixLit', 'ez110ReadDigits', 'ez110LinkCss', 'ez110Apply'].map(lift).join('\n');
function world({ host = 'ezik.app', search = '', store = {} } = {}) {
  const calls = [];
  const el = { setAttribute: (a, v) => calls.push('attr:' + a + '=' + v), removeAttribute: (a) => calls.push('rm:' + a), getAttribute: () => null, style: {} };
  const document = { documentElement: el, querySelector: () => { calls.push('query'); return null; }, createElement: () => { calls.push('create'); return {}; }, head: { appendChild: () => calls.push('append') } };
  const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { calls.push('set:' + k); store[k] = String(v); } };
  const window = { location: { hostname: host, search } };
  const f = new Function('window', 'document', 'localStorage', 'URLSearchParams', 'setTimeout',
    `const EZ110_PARTS = ${constOf('EZ110_PARTS')}; const EZ110_IDS = ${constOf('EZ110_IDS')};
     const EZ110_UNLOCK_KEY = ${constOf('EZ110_UNLOCK_KEY')}; const EZ110_IDENTITY_KEY = ${constOf('EZ110_IDENTITY_KEY')};
     const EZ110_DIGITS_KEY = ${constOf('EZ110_DIGITS_KEY')}; const EZ110_UNLOCK_SHA = ${constOf('EZ110_UNLOCK_SHA')};
     const EZ110_CSS = ${constOf('EZ110_CSS')}; const EZ110_ADHAN_CARD = ${constOf('EZ110_ADHAN_CARD')}; const EZ110_SAFE_CSS = ${constOf('EZ110_SAFE_CSS')}; const EZ110_FIX_CSS = ${constOf('EZ110_FIX_CSS')};
     ${SRC}
     const EZ110_OWNER = ez110ReadOwner(); const EZ110_OVERRIDE = ez110LocalOverride();
     return { ez110AdhanCardLit, EZ110_ADHAN_CARD, ez110Sha256Hex, ez110ReadOwner, ez110LocalOverride, ez110PartLit, ez110FixLit, ez110Apply, EZ110_PARTS, owner: EZ110_OWNER, ov: EZ110_OVERRIDE };`);
  const api = f(window, document, localStorage, URLSearchParams, () => calls.push('timer'));
  return { api, calls };
}
// O1 / O2
const Q = '?ezik110=b&mode=dark&safe=1&fix=1';
for (const host of ['ezik.app', 'www.ezik.app', 'almurabbi.app', 'ustaz-git-main-musaed-s-projects1.vercel.app', 'ustaz-abc123-musaed-s-projects1.vercel.app', 'localhost.evil.com', '127.0.0.1.nip.io', 'evil-localhost', '10.0.0.1', '0.0.0.0', '']) {
  const { api } = world({ host, search: Q });
  api.ov === null ? pass(`O1 override inert on "${host}"`) : fail(`O1 override ANSWERS on "${host}"`);
}
for (const host of ['localhost', '127.0.0.1']) {
  const { api } = world({ host, search: Q });
  api.ov && api.ov.id === 'b' && api.ov.safe && api.ov.dark && api.ov.fix ? pass(`O2 override answers on ${host}`) : fail(`O2 override does not answer on ${host}`);
  const { api: a2 } = world({ host, search: '?ezik110=z' });
  a2.ov === null ? pass(`O2 an unknown identity is ignored on ${host}`) : fail(`O2 unknown identity accepted on ${host}`);
}
// O3
const { api: base } = world();
for (const [part, st] of Object.entries(base.EZ110_PARTS)) {
  if (st === 'public' && !PUBLIC_BY_OWNER.includes(part)) fail(`O3 part ${part} is PUBLIC without the owner's word`);
  else if (!['off', 'owner', 'public'].includes(st)) fail(`O3 part ${part} has an unknown state ${st}`);
  else pass(`O3 part ${part} = ${st}`);
}
// O9
for (const host of ['ezik.app', 'www.ezik.app', 'almurabbi.app', 'ustaz-git-main-musaed-s-projects1.vercel.app', 'localhost.evil.com', '127.0.0.1.nip.io', '']) {
  const { api } = world({ host, search: '?fix=1' });
  // round 4: once fix is public every reader has it; the override still ADDS nothing off this machine
  const { api: plain } = world({ host });
  api.ez110FixLit() === plain.ez110FixLit() && plain.ez110FixLit() === (base.EZ110_PARTS.fix === 'public') ? pass(`O9 &fix=1 adds nothing on "${host}"`) : fail(`O9 &fix=1 changes part fix on "${host}"`);
}
for (const host of ['localhost', '127.0.0.1']) {
  const { api } = world({ host, search: '?fix=1' });
  api.ez110FixLit() === true ? pass(`O9 &fix=1 answers on ${host}`) : fail(`O9 &fix=1 does not answer on ${host}`);
}
'fix' in base.EZ110_PARTS ? pass('O9 part fix is declared') : fail('O9 part fix is missing from EZ110_PARTS');
// O10
{
  const st = base.EZ110_ADHAN_CARD;
  if (!['off', 'owner', 'public'].includes(st)) fail('O10 the call-to-prayer card has an unknown state ' + st);
  else if (st === 'public' && !PUBLIC_BY_OWNER.includes('adhan')) fail('O10 the call-to-prayer card is PUBLIC without the owner word');
  else pass('O10 the call-to-prayer card = ' + st);
  if (st !== 'public') for (const host of ['ezik.app', 'www.ezik.app', 'ustaz-git-main-musaed-s-projects1.vercel.app', 'localhost.evil.com', '']) {
    const { api } = world({ host, search: '?ezik110=b&fix=1&safe=1' });
    api.ez110AdhanCardLit() === false ? pass('O10 card dark for a non-owner on "' + host + '"') : fail('O10 card LIT for a non-owner on "' + host + '"');
  }
  const at = jsx.indexOf('<Ez110AdhanCard ');
  const cond = at > 0 ? jsx.slice(jsx.lastIndexOf('{ez110.id', at), at) : '';
  cond.indexOf('ez110AdhanCardLit()') >= 0 ? pass('O10 the card is drawn only when ez110AdhanCardLit() says so') : fail('O10 the card render does not ask ez110AdhanCardLit()');
}
// O10b
{
  const at = jsx.indexOf('<Ez110AdhanCard ');
  const cond = at > 0 ? jsx.slice(jsx.lastIndexOf('{ez110.id', at), at) : '';
  const terms = cond.replace(/^\{/, '').split('&&').map((t) => t.trim());
  const re = /const \[(\w+), (set\w+)\] = useState\(\(\) => ezikWidgetDataCapability === 'supported'\);/g;
  const app = jsx.lastIndexOf('function App()', at);
  let gate = null;
  for (let m; (m = re.exec(jsx));) if (terms.includes(m[1]) && m.index > app && m.index < at) gate = { name: m[1], setter: m[2], at: m.index };
  if (!gate) fail('O10b the card can draw without the widget-data capability: no term of its condition is a state born of ezikWidgetDataCapability === \'supported\'');
  else {
    pass('O10b the card condition holds ' + gate.name + ', born of ezikWidgetDataCapability === \'supported\'');
    const setCall = gate.setter + "(ezikWidgetDataCapability === 'supported')";
    const calls = jsx.split(gate.setter + '(').length - 1;
    const k = jsx.indexOf(setCall, gate.at);
    const near = k > 0 ? jsx.slice(k - 80, k + 220) : '';
    calls === 1 && /const sync = \(\) => $/.test(jsx.slice(k - 80, k)) && near.includes('window.addEventListener(SHELL_SCHED_CHANNEL, sync)')
      ? pass('O10b ' + gate.name + ' is re-synced only to ezikWidgetDataCapability === \'supported\' on every ' + 'scheduler reply')
      : fail('O10b ' + gate.name + ' is not re-synced (only) from ezikWidgetDataCapability on the scheduler channel');
  }
}
// O4
for (const s of ['', 'abc', 'ezk110-test', 'عزك', 'x'.repeat(200)]) {
  const want = crypto.createHash('sha256').update(s, 'utf8').digest('hex');
  base.ez110Sha256Hex(s) === want ? pass(`O4 sha256 matches node (len ${s.length})`) : fail(`O4 sha256 differs from node on input of length ${s.length}`);
}
// O5
const SHA = JSON.parse(constOf('EZ110_UNLOCK_SHA').replace(/'/g, '"'));
const key = JSON.parse(constOf('EZ110_UNLOCK_KEY').replace(/'/g, '"'));
for (const [label, store] of [['no key', {}], ['wrong code', { [key]: 'ezk110-not-the-code-0000000000' }], ['the hash itself', { [key]: SHA }], ['empty', { [key]: '' }]]) {
  world({ store }).api.owner === false ? pass(`O5 not the owner with ${label}`) : fail(`O5 owner recognised with ${label}`);
}
// O6
{
  // round 4: the world is built AND ez110Apply() is called -- before, O6 never called it, so it held vacuously
  const { api: o6, calls } = world({ host: 'ezik.app', search: Q, store: { ezik_110_identity_v1: 'c' } });
  calls.length = 0; try { o6.ez110Apply(); } catch (e) {}
  if (!PUBLIC_BY_OWNER.length) calls.length === 0 ? pass('O6 nothing lit: ez110Apply touched nothing (no attribute, meta, stylesheet, timer)') : fail('O6 nothing lit, yet ez110Apply did: ' + calls.join(' '));
  else {
    // round 4 (published parts): a guest on ezik.app -- the override in the address and identity c stored -- is lit with the
    // PUBLIC parts and nothing else: the identity is a public one (never c, d or e), and safe / fix only if public
    const ids = calls.filter((c) => c.indexOf('attr:data-ez110=') === 0).map((c) => c.slice('attr:data-ez110='.length));
    const wantId = ['b', 'c', 'd', 'e'].filter((x) => PUBLIC_BY_OWNER.includes(x));
    ids.length > 0 && ids.every((x) => wantId.includes(x)) ? pass('O6 a guest is lit with a public identity only (' + ids.join(',') + '), never c/d/e') : fail('O6 a guest is lit with ' + (ids.join(',') || 'no identity'));
    for (const [part, attr] of [['safe', 'attr:data-ez110-safe='], ['fix', 'attr:data-ez110-fix=']]) {
      const has = calls.some((c) => c.indexOf(attr) === 0);
      has === PUBLIC_BY_OWNER.includes(part) ? pass('O6 a guest ' + (has ? 'has' : 'has not') + ' part ' + part) : fail('O6 part ' + part + ' for a guest is ' + has);
    }
  }
}
// O7
{
  const files = cp.execFileSync('git', ['ls-files'], { cwd: ROOT, maxBuffer: 64 << 20 }).toString().split('\n').filter(Boolean);
  let hit = '';
  for (const f of files) {
    let b; try { b = fs.readFileSync(path.join(ROOT, f)); } catch (e) { continue; }
    if (b.length > 8e6) continue;
    const m = b.toString('latin1').match(/ezk110-[A-Za-z0-9_-]{32,}/);
    if (m && crypto.createHash('sha256').update(m[0]).digest('hex') === SHA) { hit = f; break; }
  }
  hit ? fail('O7 the plaintext unlock code is in tracked file ' + hit) : pass(`O7 the plaintext code is in none of ${files.length} tracked files`);
}
// O8
{
  const sync = (jsx.match(/function ezikSyncKv\(\)[\s\S]*?\n\}/) || [''])[0];
  if (!sync) fail('O8 ezikSyncKv not found');
  for (const k of ['EZ110_UNLOCK_KEY', 'EZ110_IDENTITY_KEY', 'EZ110_DIGITS_KEY', 'ezik_110_']) sync.includes(k) ? fail(`O8 ${k} is in the sync table`) : pass(`O8 ${k} is not synced`);
}
console.log(`\nez110-override: PASS=${passes} FAIL=${fails}`);
process.exit(fails ? 1 : 0);
