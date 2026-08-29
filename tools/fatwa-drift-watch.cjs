'use strict';
// tools/fatwa-drift-watch.cjs -- the drift watch for the fatwa contract (item 3).
//
// Why a tool and not a gate: all 99 gates in gates.json are offline by design, and
// source-liveness-guard.cjs asserts of itself that it makes no network request.
// That invariant is why a pinned number could sit wrong for twenty days:
// hybrid-live-fatwa-guard.cjs:827 compares fatwaContractTotals() with numbers
// written inside the guard -- a frozen fixture compared with itself.
// This watch calls the live service or it fails. It never compares us with us.
//
// MEASURED TRAP (2026-08-29, node v24.18.0 on Windows): calling process.exit()
// while an undici handle is still closing aborts the process ("uV_HANDLE_CLOSING")
// and returns -1073740791 AFTER printing PASS. An exit code is this tool's whole
// contract, so we set process.exitCode and let the loop drain instead.
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const CONTRACT = path.join(ROOT, 'lib', 'fatwa-contract.js');
const TIMEOUT_MS = 15000;
const ATTEMPTS = 3;
const SELFTEST = process.argv.includes('--selftest');
// Named test hook: proves the failure exit path really returns 1.
const FORCE = process.env.EZIK_DRIFT_FORCE === '1';

const ascii = (s) => String(s).replace(/[^\x20-\x7E]/g, '.');
const say = (s) => { console.log(ascii(s)); };

async function fetchScholars(base) {
  let lastErr = 'no_attempt';
  for (let i = 1; i <= ATTEMPTS; i += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(base + '/api/v1/scholars', { signal: ctrl.signal, redirect: 'manual' });
      if (res.status !== 200) { await res.text(); lastErr = 'http_' + res.status; continue; }
      const body = await res.json();
      return { ok: true, body, attempt: i };
    } catch (e) {
      lastErr = (e && e.message) ? e.message : 'fetch_failed';
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, error: lastErr };
}

// Pure function of (pinned rows, live rows) so the selftest can feed it a deliberately
// wrong expectation and prove the watch would have screamed.
function compare(pinnedRows, liveRows) {
  const live = new Map();
  for (const r of liveRows) {
    const snap = (r && r.snapshot) ? r.snapshot : {};
    live.set(r.id, typeof snap.records === 'number' ? snap.records : null);
  }
  const findings = [];
  let pinnedSum = 0;
  let liveSum = 0;
  for (const p of pinnedRows) {
    pinnedSum += p.count;
    if (!live.has(p.id)) { findings.push('MISSING_LIVE id=' + p.id + ' pinned=' + p.count); continue; }
    const lv = live.get(p.id);
    if (typeof lv !== 'number') { findings.push('NO_LIVE_COUNT id=' + p.id + ' pinned=' + p.count); continue; }
    liveSum += lv;
    if (lv !== p.count) findings.push('COUNT_DRIFT id=' + p.id + ' pinned=' + p.count + ' live=' + lv + ' delta=' + (lv - p.count));
  }
  for (const [id, lv] of live) {
    const known = pinnedRows.some((p) => p.id === id);
    if (!known) findings.push('UNPINNED_LIVE id=' + id + ' live=' + lv);
  }
  return { findings, pinnedSum, liveSum, liveCount: live.size };
}

(async () => {
  const FC = await import(pathToFileURL(CONTRACT).href);
  const pinned = FC.FATWA_SCHOLARS.map((e) => ({ id: e.id, count: e.count }));
  say('=== fatwa-drift-watch ===');
  say('base=' + FC.FATWA_BASE);
  say('pinned_rows=' + pinned.length + ' expected_rows=' + FC.FATWA_EXPECTED_SCHOLARS);

  const res = await fetchScholars(FC.FATWA_BASE);
  if (!res.ok) {
    say('LIVE_UNREACHABLE attempts=' + ATTEMPTS + ' last_error=' + res.error);
    say('RESULT=FAIL reason=live_unreachable');
    process.exitCode = 1;
    return;
  }
  const liveRows = Array.isArray(res.body && res.body.scholars) ? res.body.scholars : [];
  say('live_status=200 attempt=' + res.attempt + ' live_rows=' + liveRows.length + ' schema=' + (res.body.schemaVersion || ''));

  const real = compare(pinned, liveRows);
  say('pinned_sum=' + real.pinnedSum + ' live_sum=' + real.liveSum + ' delta=' + (real.liveSum - real.pinnedSum));
  if (pinned.length !== FC.FATWA_EXPECTED_SCHOLARS) real.findings.push('PINNED_ROW_COUNT pinned=' + pinned.length + ' expected=' + FC.FATWA_EXPECTED_SCHOLARS);
  if (liveRows.length !== pinned.length) real.findings.push('LIVE_ROW_COUNT live=' + liveRows.length + ' pinned=' + pinned.length);
  if (FORCE) real.findings.push('FORCED_TEST_FINDING env=EZIK_DRIFT_FORCE');
  for (const f of real.findings) say('DRIFT ' + f);
  say('findings=' + real.findings.length);

  if (SELFTEST) {
    const target = pinned[0];
    const mutated = pinned.map((p, i) => (i === 0 ? { id: p.id, count: p.count + 1 } : p));
    const m = compare(mutated, liveRows);
    const caught = m.findings.some((f) => f.startsWith('COUNT_DRIFT id=' + target.id + ' '));
    say('SELFTEST mutated=' + target.id + ' pinned+1=' + (target.count + 1) + ' caught=' + caught + ' findings=' + m.findings.length);
    if (!caught) { say('RESULT=FAIL reason=selftest_blind'); process.exitCode = 1; return; }
    say('SELFTEST=PASS');
  }

  if (real.findings.length) {
    say('RESULT=FAIL reason=contract_drift findings=' + real.findings.length);
    process.exitCode = 1;
    return;
  }
  say('RESULT=PASS rows=' + pinned.length + ' total=' + real.pinnedSum);
  process.exitCode = 0;
})().catch((e) => { console.error(ascii(e && e.stack ? e.stack : e)); process.exitCode = 1; });
