// ez110-edges-guard.cjs -- ITEM 110, part `safe`: NO CONTROL MAY SIT UNDER A SYSTEM BAR AGAIN.
//
// The defect (owner, 10 Oct 2026, a picture): the memorizer's «start» bar hid behind the Android
// three-button bar. It came back more than once because nothing measured it. This guard is the
// static half of the fix; tools/ez110/cross-probe.cjs is the runtime half (geometry on every screen).
//
// WHAT IT READS: index.html's stylesheet, app.jsx's inline style object and JSX, and the two 110
// stylesheets (ez110/ez110-safe.css, ez110/ez110.css).
// WHAT IT ASSERTS:
//   F1  the family exists: --ez-safe-{t,b,l,r} = max(env(safe-area-inset-*), var(--ez-shell-inset-*), 0px)
//   F2  the lit path makes the viewport cover the screen (viewport-fit=cover) -- at run time only
//   E1  EVERY index.html rule that pins an element to an edge (position fixed/sticky, or a padding
//       that reads env(safe-area-inset-*)) is either re-read in ez110-safe.css through the family,
//       or named in EXEMPT below with its reason
//   E2  EVERY app.jsx style key that pins an element to an edge (position fixed/sticky, an env()
//       inset, or a layout dock) is either marked at its JSX site with data-ez110-edge="<kind>" and
//       that kind is re-read in ez110-safe.css, or named in EXEMPT_KEYS with its reason
//   E3  every position:fixed/sticky rule in ez110.css (the new design's own bars) reads the family
//   E4  every data-ez110-edge kind used in app.jsx has a rule in ez110-safe.css
// A new bar added anywhere without the family fails E1/E2/E3 by construction.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let fails = 0, passes = 0;
const pass = (m) => { passes++; console.log('PASS ' + m); };
const fail = (m) => { fails++; console.log('FAIL ' + m); };

const html = read('index.html');
const jsx = read('app.jsx');
const safe = read('ez110/ez110-safe.css');
const design = fs.existsSync(path.join(ROOT, 'ez110/ez110.css')) ? read('ez110/ez110.css') : '';
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
function rules(css) {
  const out = []; const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  const c = strip(css);
  while ((m = re.exec(c))) out.push({ sel: m[1].trim(), body: m[2] });
  return out;
}
const READS_FAMILY = /var\(--ez-safe-[tblr]\)/;

// ---- F1 the family
for (const e of ['t', 'b', 'l', 'r']) {
  const side = { t: 'top', b: 'bottom', l: 'left', r: 'right' }[e];
  const re = new RegExp(`--ez-safe-${e}:\\s*max\\(env\\(safe-area-inset-${side}, 0px\\), var\\(--ez-shell-inset-${e}, 0px\\), 0px\\)`);
  re.test(safe) ? pass(`F1 family --ez-safe-${e} = max(env, shell, 0)`) : fail(`F1 family --ez-safe-${e} missing or not a max() of env, shell and 0`);
}
// ---- F2 viewport-fit at run time, only on the lit path
const applyFn = (jsx.match(/function ez110Apply\(\) \{[\s\S]*?\n\}/) || [''])[0];
/if \(safe\) \{[\s\S]*viewport-fit=cover/.test(applyFn) ? pass('F2 the lit safe path adds viewport-fit=cover') : fail('F2 ez110Apply no longer adds viewport-fit=cover when safe is lit');
/<meta name="viewport" content="[^"]*viewport-fit=cover/.test(html) ? fail('F2 index.html itself says viewport-fit=cover -- the switch-off app must stay as it was') : pass('F2 index.html viewport meta unchanged (switch off = as before)');

// ---- E1 index.html edge rules
const styleBlock = (html.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
const EXEMPT = {
  '.ezc-drawer-ov': 'full-screen scrim (inset:0); it holds no control',
  '.ezgate-scrim': 'full-screen scrim; its card is centred with 20px padding',
  '#ezik-diagnostic-catcher': 'pre-React diagnostic panel, never part of the app surface',
  '.ezdiag': 'pre-React diagnostic panel',
  '.ezc-drawer-ov.is-desk': 'desk scrim',
};
const safeRules = rules(safe).filter((r) => READS_FAMILY.test(r.body));
const covered = (sel) => safeRules.some((r) => r.sel.split(',').some((s) => s.trim().endsWith(sel)));
const edgeRules = rules(styleBlock).filter((r) => /position:\s*(fixed|sticky)/.test(r.body) || /env\(safe-area-inset-/.test(r.body));
const seen = new Set();
for (const r of edgeRules) {
  for (const raw of r.sel.split(',')) {
    const sel = raw.trim();
    if (!sel || sel.startsWith('@') || seen.has(sel)) continue; seen.add(sel);
    const last = (sel.match(/[.#][\w-]+(?:\.[\w-]+)*\s*$/) || [sel])[0].trim();
    if (EXEMPT[last] || EXEMPT[sel]) { pass(`E1 exempt ${sel} -- ${EXEMPT[last] || EXEMPT[sel]}`); continue; }
    if (/^html|^body|^:root|^#root/.test(sel)) continue;
    if (/inset:\s*0\b/.test(r.body) && /position:\s*fixed/.test(r.body) && !/env\(/.test(r.body)) { pass(`E1 exempt ${sel} -- full-screen overlay (inset:0), no edge control`); continue; }
    covered(last) ? pass(`E1 ${sel} reads the family in ez110-safe.css`) : fail(`E1 ${sel} sits on an edge (${(r.body.match(/position:\s*\w+|env\(safe-area-inset-\w+/g) || []).join(' ')}) and ez110-safe.css does not re-read it through --ez-safe-*`);
  }
}
// ---- E2 app.jsx style keys
const sObj = (jsx.match(/\nconst s = \{([\s\S]*?)\n\};/) || ['', ''])[1];
const EXEMPT_KEYS = {
  shareChooserWrap: 'full-screen centred chooser (fixed inset:0, padding 16)',
  wirdBack: 'full-screen centred picker (fixed inset:0, padding 18)',
  adhkar2Scroll: 'unreferenced key (no s.adhkar2Scroll in JSX)',
  a3Bar: 'unreferenced key (no s.a3Bar in JSX)',
  wirdWrap: 'side insets only, and the shell locks portrait (murabbi-shell app.json orientation) where they are 0; its own env() padding stays; its JSX line is pinned verbatim by wird-guard and themecoverage',
  pgBar: 'unreferenced key', pgBarFb: 'unreferenced key', memStartBar: 'unreferenced key',
};
const LAYOUT_DOCKS = ['eziaDock'];
const keyRe = /\n  (\w+): \{([^\n]*)\},?/g; let km; const edgeKeys = [];
while ((km = keyRe.exec('\n' + sObj))) {
  const [, key, body] = km;
  if (/position: '(fixed|sticky)'/.test(body) || /env\(safe-area-inset-/.test(body) || LAYOUT_DOCKS.includes(key)) edgeKeys.push({ key, body });
}
const KIND_RULES = new Set(); for (const r of safeRules) { const m = r.sel.match(/data-ez110-edge="(\w+)"/g) || []; m.forEach((x) => KIND_RULES.add(x.match(/"(\w+)"/)[1])); }
for (const { key, body } of edgeKeys) {
  if (EXEMPT_KEYS[key]) { pass(`E2 exempt s.${key} -- ${EXEMPT_KEYS[key]}`); continue; }
  if (/position: 'fixed'/.test(body) && /inset: 0/.test(body)) { pass(`E2 exempt s.${key} -- full-screen overlay`); continue; }
  const sites = jsx.match(new RegExp(`style=\\{s\\.${key}\\}[^>]*`, 'g')) || [];
  const live = sites.length;
  if (!live) { pass(`E2 s.${key} has no JSX site (dead style)`); continue; }
  const unmarked = sites.filter((t) => !/data-ez110-edge="(\w+)"/.test(t));
  const kinds = sites.map((t) => (t.match(/data-ez110-edge="(\w+)"/) || [])[1]).filter(Boolean);
  if (unmarked.length) fail(`E2 s.${key} pins an element to an edge at ${unmarked.length} JSX site(s) with no data-ez110-edge mark`);
  else if (kinds.some((k) => !KIND_RULES.has(k))) fail(`E2 s.${key} is marked ${kinds.join(',')} and ez110-safe.css has no family rule for that kind`);
  else pass(`E2 s.${key} marked ${[...new Set(kinds)].join(',')} at ${live} site(s), re-read through the family`);
}
// MADINA_SAFE_PAD (the ?mushaflab=0 rollback reader) is the one inline env() constant outside s
/const MADINA_SAFE_PAD = /.test(jsx) ? pass('E2 exempt MADINA_SAFE_PAD -- rollback reader only (?mushaflab=0), env() on all four sides') : pass('E2 MADINA_SAFE_PAD gone');
// ---- E3 the new design's own pinned bars
for (const r of rules(design)) {
  if (!/position:\s*(fixed|sticky)/.test(r.body)) continue;
  if (/inset:\s*0\b/.test(r.body) && !/(bottom|top):\s*\d/.test(r.body)) { pass(`E3 ${r.sel.slice(0, 60)} full-screen layer`); continue; }
  READS_FAMILY.test(r.body) ? pass(`E3 ${r.sel.slice(0, 60)} reads the family`) : fail(`E3 ez110.css ${r.sel.slice(0, 80)} is pinned (fixed/sticky) and does not read --ez-safe-*`);
}
// ---- E4 every mark kind has a rule
const usedKinds = new Set((jsx.match(/data-ez110-edge="(\w+)"/g) || []).map((x) => x.match(/"(\w+)"/)[1]));
for (const k of usedKinds) KIND_RULES.has(k) ? pass(`E4 kind ${k} has a family rule`) : fail(`E4 data-ez110-edge="${k}" is used in app.jsx and ez110-safe.css has no rule reading the family for it`);
console.log(`\nez110-edges: PASS=${passes} FAIL=${fails}`);
process.exit(fails ? 1 : 0);
