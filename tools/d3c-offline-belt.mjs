// D3C: replay the D3A merge belt against its existing baseline, never re-baseline.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const [root, packagePath, label] = process.argv.slice(2);
if (!root || !packagePath || !label || !/^[A-Za-z0-9._-]+$/.test(label) || label === 'base') {
  throw new Error('usage: d3c-offline-belt.mjs root package-path label (not base)');
}
const session = path.dirname(path.resolve(packagePath));
const archive = path.resolve(session, '..', '..');
const previous = path.join(session, '13-fix-d3a');
const harness = path.join(archive, 'probes/ez111-harness');
const stream = path.join(archive, 'sessions/stream-build-2026-09-23');
const output = path.join(packagePath, 'belt', label);
fs.mkdirSync(output, { recursive: true });
const configs = [
  ['streq154', harness + '/third-order/s7/streq.mjs', [root, harness + '/third-order/s7/drafts.json', output + '/streq154.json', label], 3],
  ['streq40', harness + '/third-order/s7/streq.mjs', [root, harness + '/third-order/s7/drafts40.json', output + '/streq40.json', label], 3],
  ['streqtk154', harness + '/batch4/streq-tk.mjs', [root, harness + '/third-order/s7/drafts.json', output + '/streqtk154.json', label], 2],
  ['streqtk40', harness + '/batch4/streq-tk.mjs', [root, harness + '/third-order/s7/drafts40.json', output + '/streqtk40.json', label], 2],
  ['streqtk17', harness + '/batch4/streq-tk.mjs', [root, harness + '/batch4/shapes-drafts.json', output + '/streqtk17.json', label], 2],
  ...['fiqh-rows', 'fiqh-empty', 'mixed', 'gen-then-fiqh'].map(sc => [
    'fiqh-' + sc + '-154', stream + '/streq-fiqh.mjs',
    [root, harness + '/third-order/s7/drafts.json', output + '/fiqh-' + sc + '-154.json', label, sc], 2,
  ]),
  ['threeq', stream + '/threeq.mjs', [root, label, output + '/threeq.json'], Infinity],
];
const childEnv = { ...process.env };
for (const name of Object.keys(childEnv)) {
  if (/(?:_V\d+|_TOKEN|_KEY|_SECRET|_PASSWORD)$/.test(name)) delete childEnv[name];
}
for (const name of ['FULL_ANSWER_V1', 'DIAG_TRACE_V1', 'LIB_NAV_V1', 'BEFORE_WRITING_V1', 'ENCYC_V1', 'LIB_MUJAZ_V1', 'LIB_QUOTE_V1', 'TAKHRIJ_V1', 'STREAM_V1']) {
  childEnv[name] = 'off';
}
const stable = row => { const copy = { ...row }; delete copy.firstDeltaMs; return JSON.stringify(copy); };
const hash = value => createHash('sha256').update(value).digest('hex').toUpperCase();
const records = [];
const summaries = [];
for (const [name, script, args, tail] of configs) {
  const networkLog = path.join(output, name + '.network.json');
  const run = spawnSync(process.execPath, ['--import', pathToFileURL(path.join(previous, 'deny-network.mjs')).href, script, ...args], {
    cwd: stream, env: { ...childEnv, D3A_NET_LOG: networkLog }, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 300000,
  });
  fs.writeFileSync(path.join(output, name + '.stdout.txt'), run.stdout || '');
  fs.writeFileSync(path.join(output, name + '.stderr.txt'), run.stderr || '');
  let lines = (run.stdout || '').trimEnd().split(/\r?\n/);
  if (Number.isFinite(tail)) lines = lines.slice(-tail);
  summaries.push(lines.join('\n').replace(/[^\x09\x0a\x0d\x20-\x7e]/g, ''));
  const network = fs.existsSync(networkLog) ? JSON.parse(fs.readFileSync(networkLog, 'utf8')) : null;
  const baseline = JSON.parse(fs.readFileSync(path.join(previous, 'belt/belt-base', name + '.json'), 'utf8'));
  const currentPath = path.join(output, name + '.json');
  const current = fs.existsSync(currentPath) ? JSON.parse(fs.readFileSync(currentPath, 'utf8')) : [];
  const differences = [];
  for (let i = 0; i < Math.max(baseline.length, current.length); i++) {
    const before = Buffer.from(stable(baseline[i]) || '');
    const after = Buffer.from(stable(current[i]) || '');
    if (before.equals(after)) continue;
    let offset = 0;
    while (offset < Math.min(before.length, after.length) && before[offset] === after[offset]) offset++;
    differences.push({ index: i, baselineId: baseline[i]?.id, currentId: current[i]?.id, offset,
      beforeHex: before.subarray(offset, offset + 32).toString('hex'), afterHex: after.subarray(offset, offset + 32).toString('hex') });
  }
  records.push({ name, script, args, exit: run.status, error: run.error?.message || null, network,
    baselineRows: baseline.length, currentRows: current.length, differences,
    baselineStableSha256: hash(baseline.map(stable).join('\n')), currentStableSha256: hash(current.map(stable).join('\n')) });
  console.log(JSON.stringify({ name, exit: run.status, rows: current.length, differences: differences.length, network }));
  // The owner's stop rule applies immediately to a changed belt case.
  if (differences.length || run.status !== 0) break;
}
const normalize = text => text.replace(/\r/g, '').replace(/firstDelta median=[0-9.]+ms p95=[0-9.]+ms/g, '').replace(/^\[[A-Za-z0-9._-]+\]/gm, '');
const summaryText = summaries.join('\n') + '\nDONE\n';
const normalized = normalize(summaryText);
const baselineSummary = fs.readFileSync(path.join(previous, 'belt/belt-base.normalized.txt'), 'utf8');
const result = { label, root, baseline: path.join(previous, 'belt/belt-base'), ignoredProperties: ['firstDeltaMs'],
  allExitedZero: records.length === configs.length && records.every(r => r.exit === 0),
  allStableRowsIdentical: records.length === configs.length && records.every(r => r.differences.length === 0),
  rows: records.reduce((n, r) => n + r.currentRows, 0), summaryIdentical: normalized === baselineSummary, records };
fs.writeFileSync(output + '.txt', summaryText);
fs.writeFileSync(output + '.normalized.txt', normalized);
fs.writeFileSync(output + '.result.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ label, allExitedZero: result.allExitedZero, allStableRowsIdentical: result.allStableRowsIdentical, summaryIdentical: result.summaryIdentical, rows: result.rows }));
if (!result.allExitedZero || !result.allStableRowsIdentical || !result.summaryIdentical) process.exitCode = 1;
