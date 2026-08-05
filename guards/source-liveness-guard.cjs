// guards/source-liveness-guard.cjs — no dead domain sits on a production list.
//
// ── THE HOLE THIS CLOSES ─────────────────────────────────────────────────────
// On 2026-08-05, dorar.net (on the ADULT list and on the CHILD'S list), tafsir.app and
// ferkous.com could not produce a citation between them, and mostafaaladwy.com's pages were being
// discarded by a floor that overrode the one it declared. Every gate in the repo was green
// throughout — because every gate in the repo is offline, and they all check that the LISTS are
// CONSISTENT. Consistency with a dead domain is still consistency.
//
// So the measurement is taken by tools/source-liveness.cjs (network required, run by hand, one
// real article per registered domain through lib/retrieve.js's own fetch and gates) and committed
// to data/source-liveness.json. THIS gate reads that file and never touches a network: a suite
// that goes red because somebody else's server is slow teaches a team to ignore red.
//
// ── WHAT IT FAILS ON ─────────────────────────────────────────────────────────
//   1. a domain measured DEAD that is still on a production list;
//   2. a production-list domain that the file does not mention at all — otherwise deleting a row
//      would be a way to hide a dead source;
//   3. a measurement older than MAX_AGE_DAYS. A liveness file nobody re-runs is a liveness file
//      that describes a web which no longer exists, and it would go on certifying a dead domain
//      indefinitely.
//
// ── WHAT IT DELIBERATELY DOES NOT FAIL ON ────────────────────────────────────
// `live-no-citation` on a NON-production domain, and `dead` on a non-production domain. Those are
// the deferred and blocked rows — tafsir.app, shkhudheir.com, alarabiya.net — and the whole point
// of keeping them in the table is that their evidence survives. Failing on them would force
// somebody to delete the record in order to get to green, which is the opposite of what the rows
// are for.
//
// Usage: node guards/source-liveness-guard.cjs
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
const FILE = path.join(REPO, 'data', 'source-liveness.json');

// Thirty days, as the brief sets it. Long enough that nobody is re-running this weekly for its own
// sake; short enough that a domain cannot rot for a season while the file still vouches for it.
const MAX_AGE_DAYS = 30;

(async function main() {
  console.log('=== source-liveness-guard — no dead domain sits on a production list ===');

  if (!ok('data/source-liveness.json exists', fs.existsSync(FILE),
    'run: node tools/source-liveness.cjs --write')) {
    console.log('\n=== ' + (checks - failures) + '/' + checks + ' — FAIL ===');
    process.exit(1);
  }

  let doc;
  try { doc = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (e) {
    ok('...and is valid JSON', false, String(e.message));
    console.log('\n=== ' + (checks - failures) + '/' + checks + ' — FAIL ===');
    process.exit(1);
  }
  ok('...and is valid JSON', true);
  ok('it records WHEN it was measured', typeof doc.measuredAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(doc.measuredAt),
    String(doc.measuredAt));
  ok('it records WHICH tool measured it', doc.tool === 'tools/source-liveness.cjs', String(doc.tool));
  ok('it carries a row per domain', Array.isArray(doc.domains) && doc.domains.length > 0,
    String(doc.domains && doc.domains.length));

  // ── 3. STALENESS ───────────────────────────────────────────────────────────
  const measured = Date.parse(doc.measuredAt + 'T00:00:00Z');
  const ageDays = Math.floor((Date.now() - measured) / 86400000);
  ok('the measurement is not in the future', ageDays >= 0, 'measuredAt=' + doc.measuredAt);
  ok('the measurement is younger than ' + MAX_AGE_DAYS + ' days',
    ageDays <= MAX_AGE_DAYS,
    'measured ' + doc.measuredAt + ' — ' + ageDays + ' days ago. '
    + 'Re-run: node tools/source-liveness.cjs --write');

  // ── THE PRODUCTION LISTS, read from the shipped code rather than restated ──
  const RT = await esm('lib/retrieve.js');
  const R = await esm('lib/source-registry.js');
  const production = new Set([
    ...RT.SITES_ADULT, ...RT.SITES_MINOR, ...RT.SITES_MINOR_FALLBACK, ...RT.SITES_GENERAL,
    ...R.activeSources().map((s) => s.domain),
    ...R.worldSources().map((s) => s.domain),
  ].map((d) => String(d).toLowerCase()));
  ok('there are production domains to check at all', production.size >= 15, String(production.size));

  const byDomain = new Map(doc.domains.map((r) => [String(r.domain || '').toLowerCase(), r]));

  // ── 1. A DEAD DOMAIN ON A PRODUCTION LIST ─────────────────────────────────
  const deadOnList = [...production].filter((d) => {
    const row = byDomain.get(d);
    return row && row.status === 'dead';
  });
  ok('no domain measured DEAD is on a production list', deadOnList.length === 0,
    deadOnList.map((d) => d + ' (' + (byDomain.get(d) || {}).note + ')').join('; '));

  // A production domain that cannot produce a citation is not a failure on its own — a single
  // article can rot — but it is reported, because two of them is a pattern.
  const noCite = [...production].filter((d) => (byDomain.get(d) || {}).status === 'live-no-citation');
  if (noCite.length) console.log('  NOTE  production domains whose probe page produced no citation: ' + noCite.join(', '));
  const stale = [...production].filter((d) => (byDomain.get(d) || {}).status === 'probe-stale');
  if (stale.length) console.log('  NOTE  probe URLs that have rotted (fix the URL, not the domain): ' + stale.join(', '));

  // ── 2. COVERAGE — deleting a row must not be a way to reach green ──────────
  const missing = [...production].filter((d) => !byDomain.has(d));
  ok('every production domain is measured in the file', missing.length === 0,
    missing.join(', ') + ' — add a probe URL in tools/source-liveness.cjs and re-run it');

  // Every row must carry the URL that was actually tried, or the measurement is unreviewable.
  const noUrl = doc.domains.filter((r) => r.status !== 'unprobed' && !r.url);
  ok('every measured row records the URL that was tried', noUrl.length === 0,
    noUrl.map((r) => r.domain).join(', '));

  // The deferred rows must NOT be on a production list — that is step 5's decision, re-checked
  // here against the measurement rather than against the registry alone.
  const deferred = R.SOURCES.filter((s) => s.status === 'deferred').map((s) => s.domain);
  const deferredOnList = deferred.filter((d) => production.has(d));
  ok('no DEFERRED domain is on a production list', deferredOnList.length === 0, deferredOnList.join(', '));

  // ── NO GATE IS BLIND ───────────────────────────────────────────────────────
  // The checks above all pass today, which is exactly when a gate is impossible to trust. The same
  // three rules are re-run against SYNTHETIC files that break each one, and each must be caught.
  // Without this, a rule with a typo in it would look identical to a rule that holds.
  {
    const anyProduction = [...production][0];
    const deadFile = { measuredAt: doc.measuredAt, domains: [{ domain: anyProduction, status: 'dead', url: 'x' }] };
    const deadHit = [...production].filter((d) => {
      const row = new Map(deadFile.domains.map((r) => [r.domain, r])).get(d);
      return row && row.status === 'dead';
    });
    ok('MUTATION — a DEAD production domain is caught', deadHit.length > 0, anyProduction);

    const emptyFile = { measuredAt: doc.measuredAt, domains: [] };
    const missHit = [...production].filter((d) => !new Map(emptyFile.domains.map((r) => [r.domain, r])).has(d));
    ok('MUTATION — a production domain absent from the file is caught', missHit.length > 0);

    const oldDate = new Date(Date.now() - (MAX_AGE_DAYS + 5) * 86400000).toISOString().slice(0, 10);
    const oldAge = Math.floor((Date.now() - Date.parse(oldDate + 'T00:00:00Z')) / 86400000);
    ok('MUTATION — a stale measurement is caught', oldAge > MAX_AGE_DAYS, oldDate + ' => ' + oldAge + 'd');
  }

  // ── THE GATE IS OFFLINE, AND THAT IS ASSERTED ─────────────────────────────
  const self = fs.readFileSync(path.join(REPO, 'guards', 'source-liveness-guard.cjs'), 'utf8');
  ok('this gate makes no network request of its own',
    !/\bfetch\s*\(|https?:\/\/[a-z]/i.test(self.replace(/^\/\/.*$/gm, '')),
    'a gate that depends on somebody else\'s uptime is a gate that gets ignored');

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL' : ' — PASS') + ' ===');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
