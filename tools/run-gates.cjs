// run-gates.cjs — the gate suite, run from inside the repository.
//
// WHY THIS FILE EXISTS. gates.json has been the single gate roster for a long time, and
// sixteen files in this tree read it — every one of them as DATA (to count it, to check its
// entries are tracked, to assert eol pins). Not one of them ran it. The only thing that ever
// ran the suite was a hand-rolled box outside the repository that wiped its own logs before
// each run, so every "60/60" a report ever quoted was a number with no trace behind it and no
// way for anyone else to reproduce it.
//
// So: the roster is read here and EXECUTED here, and every run leaves evidence that outlives it.
//
// WHAT THIS DOES NOT DO. It writes nothing into the working tree — not a log, not a summary,
// not a scratch file. A runner that dirties the tree cannot be trusted to report on the tree,
// and several gates assert precisely that nothing moved. Evidence goes to
// <os.tmpdir()>/ezik-gates/runs/<timestamp>/ and previous runs are never deleted.
//
// Usage:  npm run gates          (or: node tools/run-gates.cjs)
// Exit:   0 when every gate exited 0; 1 otherwise, with the failing gates named.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const REPO = path.join(__dirname, '..');
const RUNS_DIR = path.join(os.tmpdir(), 'ezik-gates', 'runs');

// A filesystem-safe, sortable run id. The pid disambiguates two runs inside the same second.
const startedAt = new Date();
const runId = startedAt.toISOString().replace(/[:.]/g, '-') + '-' + process.pid;
const runDir = path.join(RUNS_DIR, runId);

// `git` may not be present, and this must still run. Anything unreadable reports as null rather
// than crashing the suite — a missing HEAD is a weaker record, not a reason to refuse.
const git = (args) => {
  try {
    return cp.execSync('git ' + args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { return null; }
};
const headOf = () => { const h = git('rev-parse HEAD'); return h === null ? null : h.trim(); };
const dirtyOf = () => {
  const s = git('status --porcelain');
  if (s === null) return null;
  const lines = s.split('\n').filter((l) => l.trim() !== '');
  return { count: lines.length, lines };
};

const rosterPath = path.join(REPO, 'gates.json');
let gates;
try {
  gates = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
} catch (e) {
  console.error('ABORT: cannot read gates.json: ' + e.message);
  process.exit(2);
}
if (!Array.isArray(gates) || gates.length === 0) {
  console.error('ABORT: gates.json is not a non-empty array of {name, script, args}');
  process.exit(2);
}

fs.mkdirSync(runDir, { recursive: true });

const headBefore = headOf();
const dirtyBefore = dirtyOf();

console.log('=== gate suite — ' + gates.length + ' gates from gates.json ===');
console.log('HEAD:     ' + (headBefore || '(no git)'));
console.log('tree:     ' + (dirtyBefore === null ? '(no git)' : dirtyBefore.count + ' dirty path(s)'));
console.log('evidence: ' + runDir);
console.log('');

const pad = (s) => (s + '                    ').slice(0, 20);

const results = [];
for (const entry of gates) {
  const name = String((entry && entry.name) || '(unnamed)');
  const script = entry && entry.script;
  const args = String((entry && entry.args) || '').split(/\s+/).filter(Boolean);

  if (!script) {
    console.log(pad(name) + ' EXIT=ERR  (entry has no "script" field)');
    results.push({ name, script: null, args, exit: null, ms: 0, error: 'entry has no "script" field' });
    continue;
  }

  const t0 = Date.now();
  // argv is passed as an array, verbatim. Joining it into a shell string is how arguments get
  // mangled and how gates that actually pass get reported as failures.
  const r = cp.spawnSync(process.execPath, [script, ...args], {
    cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28,
  });
  const ms = Date.now() - t0;

  const exit = r.error ? null : r.status;
  const body = [
    '$ node ' + [script, ...args].join(' '),
    'cwd:  ' + REPO,
    'exit: ' + (r.error ? 'ERR (' + r.error.message + ')' : r.status),
    'ms:   ' + ms,
    '',
    '--- stdout ---',
    r.stdout || '',
    '--- stderr ---',
    r.stderr || '',
  ].join('\n');
  fs.writeFileSync(path.join(runDir, 'gate-' + name.replace(/[^\w.-]/g, '_') + '.log'), body, 'utf8');

  console.log(pad(name) + ' EXIT=' + (exit === null ? 'ERR' : exit) + '  (' + ms + 'ms)');
  results.push({ name, script, args, exit, ms, error: r.error ? r.error.message : null });
}

const failed = results.filter((r) => r.exit !== 0);
const headAfter = headOf();
const dirtyAfter = dirtyOf();

// The recon summary line, lifted out of recon's own log rather than retyped. Reports have
// quoted "recon FAIL=0" for a long time; this makes the number the one recon actually printed.
let reconSummary = null;
try {
  const log = fs.readFileSync(path.join(runDir, 'gate-recon.log'), 'utf8');
  const m = log.match(/^.*\bSUMMARY\b.*$/m);
  if (m) reconSummary = m[0].trim();
} catch (e) { /* recon may not be in the roster */ }

console.log('');
console.log('=== SUITE: ' + (results.length - failed.length) + '/' + results.length + ' EXIT=0 ===');
if (reconSummary) console.log('recon:    ' + reconSummary);
console.log('tree after: ' + (dirtyAfter === null ? '(no git)' : dirtyAfter.count + ' dirty path(s)'));
if (failed.length) {
  console.log('FAILING (' + failed.length + '): ' + failed.map((f) => f.name + '=' + (f.exit === null ? 'ERR' : f.exit)).join(', '));
  for (const f of failed) {
    console.log('  ' + f.name + '  ->  ' + path.join(runDir, 'gate-' + f.name.replace(/[^\w.-]/g, '_') + '.log'));
  }
}
console.log('evidence: ' + runDir);

fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify({
  schema: 'ezik-gate-run-v1',
  started_at: startedAt.toISOString(),
  finished_at: new Date().toISOString(),
  duration_ms: results.reduce((a, r) => a + r.ms, 0),
  head_before: headBefore,
  head_after: headAfter,
  // Both ends, deliberately. `dirty_after` is the measurement that says whether the suite
  // itself moved anything; `dirty_before` says what the suite was measuring in the first place.
  dirty_before: dirtyBefore === null ? null : dirtyBefore.count,
  dirty_after: dirtyAfter === null ? null : dirtyAfter.count,
  dirty_paths_after: dirtyAfter === null ? null : dirtyAfter.lines,
  roster: 'gates.json',
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.map((f) => f.name),
  recon_summary: reconSummary,
  gates: results,
}, null, 2) + '\n', 'utf8');

process.exit(failed.length ? 1 : 0);
