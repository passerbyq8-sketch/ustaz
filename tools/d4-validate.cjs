'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const [packagePath, label] = process.argv.slice(2);
if (!packagePath || !/^attempt-[12]$/.test(label || '')) throw Error('usage: d4-validate.cjs package-path attempt-1|attempt-2');
const P = path.resolve(packagePath), output = path.join(P, 'gates', label);
if (fs.existsSync(output)) throw Error('Never overwrite a validation attempt');
fs.mkdirSync(output, { recursive: true });
const env = { ...process.env, FULL_ANSWER_V1: 'off', BEFORE_WRITING_V1: 'off', LIB_NAV_V1: 'off', DIAG_TRACE_V1: 'off' };
const git = args => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const result = { label, head: git(['rev-parse', 'HEAD']), branch: git(['branch', '--show-current']),
  dirtyBefore: git(['status', '--porcelain']), startedAt: new Date().toISOString(), commands: [] };
for (const [name, args] of [['suite', ['tools/run-gates.cjs']], ['recon', ['recon-audit.cjs']]]) {
  const log = path.join(output, name + '.log'), fd = fs.openSync(log, 'w');
  console.log('Running node ' + args.join(' ') + '; log: ' + log);
  const run = cp.spawnSync(process.execPath, args, { cwd: root, env, stdio: ['ignore', fd, fd] });
  fs.closeSync(fd);
  const text = fs.readFileSync(log, 'utf8');
  result.commands.push({ command: 'node ' + args.join(' '), exit: run.status, log, error: run.error?.message || null,
    summary: text.split(/\r?\n/).filter(line => /=== SUITE:|SUMMARY\s+PASS=|^FAILING|^evidence:/.test(line)) });
  console.log(JSON.stringify(result.commands.at(-1)));
}
result.dirtyAfter = git(['status', '--porcelain']); result.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ head: result.head, dirtyBefore: result.dirtyBefore, dirtyAfter: result.dirtyAfter, exits: result.commands.map(r => r.exit) }));
if (result.commands.some(r => r.exit !== 0) || result.dirtyBefore || result.dirtyAfter) process.exitCode = 1;
