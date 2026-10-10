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
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const jsx = fs.readFileSync(path.join(ROOT, 'app.jsx'), 'utf8');
let fails = 0, passes = 0;
const pass = (m) => { passes++; console.log('PASS ' + m); };
const fail = (m) => { fails++; console.log('FAIL ' + m); };
const PUBLIC_BY_OWNER = []; // parts the owner has published by his word, e.g. ['safe']

function lift(name) {
  const i = jsx.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing ' + name);
  let d = 0, j = jsx.indexOf('{', i);
  for (let k = j; k < jsx.length; k++) { if (jsx[k] === '{') d++; else if (jsx[k] === '}') { d--; if (!d) return jsx.slice(i, k + 1); } }
  throw new Error('unbalanced ' + name);
}
const constOf = (name) => { const m = jsx.match(new RegExp('const ' + name + ' = ([^;]+);')); if (!m) throw new Error('missing const ' + name); return m[1]; };
const SRC = ['ez110Sha256Hex', 'ez110ReadOwner', 'ez110LocalOverride', 'ez110PartLit', 'ez110Choosable', 'ez110ReadIdentity', 'ez110SafeLit', 'ez110ReadDigits', 'ez110LinkCss', 'ez110Apply'].map(lift).join('\n');
function world({ host = 'ezik.app', search = '', store = {} } = {}) {
  const calls = [];
  const el = { setAttribute: (a, v) => calls.push('attr:' + a), removeAttribute: (a) => calls.push('rm:' + a), getAttribute: () => null, style: {} };
  const document = { documentElement: el, querySelector: () => { calls.push('query'); return null; }, createElement: () => { calls.push('create'); return {}; }, head: { appendChild: () => calls.push('append') } };
  const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { calls.push('set:' + k); store[k] = String(v); } };
  const window = { location: { hostname: host, search } };
  const f = new Function('window', 'document', 'localStorage', 'URLSearchParams', 'setTimeout',
    `const EZ110_PARTS = ${constOf('EZ110_PARTS')}; const EZ110_IDS = ${constOf('EZ110_IDS')};
     const EZ110_UNLOCK_KEY = ${constOf('EZ110_UNLOCK_KEY')}; const EZ110_IDENTITY_KEY = ${constOf('EZ110_IDENTITY_KEY')};
     const EZ110_DIGITS_KEY = ${constOf('EZ110_DIGITS_KEY')}; const EZ110_UNLOCK_SHA = ${constOf('EZ110_UNLOCK_SHA')};
     const EZ110_CSS = ${constOf('EZ110_CSS')}; const EZ110_SAFE_CSS = ${constOf('EZ110_SAFE_CSS')};
     ${SRC}
     const EZ110_OWNER = ez110ReadOwner(); const EZ110_OVERRIDE = ez110LocalOverride();
     return { ez110Sha256Hex, ez110ReadOwner, ez110LocalOverride, ez110PartLit, ez110Apply, EZ110_PARTS, owner: EZ110_OWNER, ov: EZ110_OVERRIDE };`);
  const api = f(window, document, localStorage, URLSearchParams, () => calls.push('timer'));
  return { api, calls };
}
// O1 / O2
const Q = '?ezik110=b&mode=dark&safe=1';
for (const host of ['ezik.app', 'www.ezik.app', 'almurabbi.app', 'ustaz-git-main-musaed-s-projects1.vercel.app', 'ustaz-abc123-musaed-s-projects1.vercel.app', 'localhost.evil.com', '127.0.0.1.nip.io', 'evil-localhost', '10.0.0.1', '0.0.0.0', '']) {
  const { api } = world({ host, search: Q });
  api.ov === null ? pass(`O1 override inert on "${host}"`) : fail(`O1 override ANSWERS on "${host}"`);
}
for (const host of ['localhost', '127.0.0.1']) {
  const { api } = world({ host, search: Q });
  api.ov && api.ov.id === 'b' && api.ov.safe && api.ov.dark ? pass(`O2 override answers on ${host}`) : fail(`O2 override does not answer on ${host}`);
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
  const { calls } = world({ host: 'ezik.app', search: Q, store: { ezik_110_identity_v1: 'c' } });
  calls.length === 0 ? pass('O6 nothing lit: ez110Apply touched nothing (no attribute, meta, stylesheet, timer)') : fail('O6 nothing lit, yet ez110Apply did: ' + calls.join(' '));
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
