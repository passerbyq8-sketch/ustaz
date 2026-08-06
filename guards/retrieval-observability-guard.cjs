// guards/retrieval-observability-guard.cjs — NO PAGE IS DROPPED IN SILENCE.
//
// ── WHY THIS GATE EXISTS ─────────────────────────────────────────────────────
// MEASURED, batch 4: an answer came back with zero source cards and the log said nothing at
// all about why. Two completely different failures produce that same silence —
//
//   (a) the provider returned no results, so there was never a page to reject;
//   (b) pages WERE fetched, cleaned and kept, and then every one of them was thrown away at
//       card-build time (non-https final URL, a hostile character in the href, an
//       unparseable host).
//
// (a) is a bad search. (b) is a bug in our own encoder, sitting on top of a search that
// worked. Telling them apart cost hours, because `buildSourceTag` returned a bare `null`
// from seven different places and `pickVerifiedSources` swallowed it with `continue`.
//
// ── THE RULE THIS GATE PINS ──────────────────────────────────────────────────
// Every drop in the retrieval path leaves ONE line naming the REASON and the URL, and the
// "we had pages and encoded none of them" case is a DISTINCT line from "the provider gave
// us nothing". The return values are unchanged — a rejected card is still `null`, a hopeless
// retrieval still yields an empty `sources` array. Only the silence is removed.
//
// Usage: node guards/retrieval-observability-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

// Run `fn` with console.warn/log/error captured, and hand back every line it emitted.
function captured(fn) {
  const lines = [];
  const keys = ['warn', 'log', 'error'];
  const saved = {};
  for (const k of keys) {
    saved[k] = console[k];
    console[k] = (...a) => lines.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '));
  }
  try { fn(); } finally { for (const k of keys) console[k] = saved[k]; }
  return lines;
}

(async function main() {
  console.log('=== retrieval-observability-guard — every drop names its reason and its url ===');

  let ASK = null;
  try { ASK = await esm('api/ask.js'); }
  catch (e) {
    ok('api/ask.js loads', false, e.message);
    console.log('\n=== ' + (checks - failures) + '/' + checks + ' — FAIL ===');
    process.exit(1);
  }
  const { buildSourceTag, pickVerifiedSources } = ASK;

  // =========================================================================
  console.log('\n=== A. EVERY buildSourceTag REFUSAL IS AUDIBLE, AND STILL RETURNS null ===');

  // One case per `return null` inside buildSourceTag. Each must (1) still return null —
  // the contract source-registry-guard depends on — and (2) leave exactly one line that
  // carries both a reason and the offending url.
  const REFUSALS = [
    ['no url at all', { title: 'x' }, null],
    ['empty url', { url: '   ', title: 'x' }, null],
    ['unparseable url', { url: 'not a url', title: 'x' }, 'not a url'],
    ['plain http', { url: 'http://khutabaa.com/x', title: 'x' }, 'http://khutabaa.com/x'],
    ['javascript:', { url: 'javascript:alert(1)', title: 'x' }, 'javascript:alert(1)'],
    ['userinfo in the authority', { url: 'https://u:p@islamweb.net/x', title: 'x' }, 'islamweb.net'],
    ['host outside the dotted-label grammar', { url: 'https://exa_mple.com/x', title: 'x' }, 'exa_mple.com'],
  ];
  for (const [label, src, mustMention] of REFUSALS) {
    let out;
    const lines = captured(() => { out = buildSourceTag(src); });
    ok(`${label} — still returns null`, out === null, JSON.stringify(out));
    const hit = lines.filter((l) => /\[card\]/.test(l));
    ok(`${label} — leaves exactly one [card] line`, hit.length === 1,
      JSON.stringify(lines));
    if (hit.length === 1) {
      ok(`${label} — the line names a reason`, /\[card\] drop [a-z0-9-]+/.test(hit[0]), hit[0]);
      if (mustMention) {
        ok(`${label} — the line carries the offending url`, hit[0].includes(mustMention), hit[0]);
      }
    } else { checks += mustMention ? 2 : 1; failures += mustMention ? 2 : 1; }
  }

  // A GOOD card says nothing. An audible success is a log nobody reads.
  {
    let out;
    const lines = captured(() => { out = buildSourceTag({ url: 'https://www.khutabaa.com/ar/article/x', title: 'خطبة' }); });
    ok('a card that builds is silent', lines.length === 0, JSON.stringify(lines));
    ok('...and it is a real card', !!out && out.host === 'khutabaa.com');
  }

  // =========================================================================
  console.log('\n=== B. "WE HAD PAGES AND ENCODED NONE" IS ITS OWN LINE ===');
  {
    // Three real, fetched, cleaned pages — every one unencodable. This is failure (b).
    const doomed = [
      { url: 'http://binbaz.org.sa/fatwa/1', title: 'أ' },
      { url: 'http://binothaimeen.net/fatwa/2', title: 'ب' },
      { url: 'javascript:alert(1)', title: 'ج' },
    ];
    let out;
    const lines = captured(() => { out = pickVerifiedSources(doomed); });
    ok('zero cards come out', Array.isArray(out) && out.length === 0, JSON.stringify(out));
    const summary = lines.filter((l) => /\[card\] none/.test(l));
    ok('a DISTINCT summary line is emitted for "pages in, no cards out"',
      summary.length === 1, JSON.stringify(lines));
    if (summary.length === 1) {
      ok('...and it states how many pages were on the table', /\b3\b/.test(summary[0]), summary[0]);
    } else { checks++; failures++; }
    ok('...and each individual refusal is still named', lines.filter((l) => /\[card\] drop/.test(l)).length === 3,
      JSON.stringify(lines));
  }
  {
    // Failure (a): the provider gave us nothing. There was no page to reject, so the
    // "encoded none" line must NOT fire — otherwise the two are indistinguishable again.
    let out;
    const lines = captured(() => { out = pickVerifiedSources([]); });
    ok('an empty retrieval yields no cards', out.length === 0);
    ok('...and does NOT claim pages were rejected', lines.filter((l) => /\[card\] none/.test(l)).length === 0,
      JSON.stringify(lines));
  }
  {
    // A duplicate is a drop too, and it is not the same drop as an unencodable one.
    const dupes = [
      { url: 'https://binbaz.org.sa/fatwa/1', title: 'أ' },
      { url: 'https://www.binbaz.org.sa/fatwa/1/', title: 'أ مكرّر' },
    ];
    let out;
    const lines = captured(() => { out = pickVerifiedSources(dupes); });
    ok('the duplicate is folded', out.length === 1, JSON.stringify(out));
    ok('...and the fold is named as a duplicate, not as a refusal',
      lines.some((l) => /\[card\] drop duplicate/.test(l)), JSON.stringify(lines));
    ok('...and a partially-successful pick emits no "none" summary',
      !lines.some((l) => /\[card\] none/.test(l)), JSON.stringify(lines));
  }

  // =========================================================================
  console.log('\n=== C. NO SILENT `NO_SOURCE_TEXT` RETURN IN lib/retrieve.js ===');
  {
    const src = read('lib/retrieve.js');
    // Every early exit that hands the caller an empty `sources` array must be preceded by a
    // console line. Checked structurally: take the 400 characters before each such return
    // and require a console.* call in them.
    const re = /return \{ text: (NO_SOURCE_TEXT|NO_WORLD_SOURCE_TEXT), sources: \[\] \};/g;
    let m, total = 0, mute = [];
    while ((m = re.exec(src))) {
      total++;
      const before = src.slice(Math.max(0, m.index - 400), m.index);
      if (!/console\.(warn|error|log)\(/.test(before)) {
        mute.push('line ' + (src.slice(0, m.index).split('\n').length));
      }
    }
    ok('every empty-source return in lib/retrieve.js is preceded by a log line',
      total > 0 && mute.length === 0, 'silent at ' + mute.join(', ') + ' (of ' + total + ')');
    ok('an exhausted search says so by name',
      /\[retrieve\] exhausted/.test(src), 'no [retrieve] exhausted marker');
    ok('a query plan that produced no groups says so by name',
      /\[retrieve\] no query plan/.test(src), 'no [retrieve] no query plan marker');
    ok('the world pass names its own empty result',
      /\[retrieve\/world\] nothing survived/.test(src), 'no [retrieve/world] nothing survived marker');
  }

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL ===' : ' — PASS ==='));
  process.exit(failures ? 1 : 0);
})();
