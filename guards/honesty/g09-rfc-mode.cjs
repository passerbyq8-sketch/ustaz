'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const H = require('./_lib.cjs');

function fakeRedis(value) {
  return { async get() { return value; }, async set() { return 'OK'; } };
}

function capturedRecordConsistent(record) {
  if (!record || record.status !== 'CAPTURED' || record.acceptanceGreen !== true) return false;
  if (!record.deployment || !/^[a-f0-9]{40}$/.test(record.deployment.gitSha || '')) return false;
  if (!record.store || !['absent', 'unreadable', 'present'].includes(record.store.status)) return false;
  if (!record.probe || !['ledger', 'legacy'].includes(record.probe.observedPath)) return false;
  const floorOpen = !['off', 'false', '0'].includes(String(record.deployment.floor || '').toLowerCase());
  const mode = record.deployment.mode || 'public';
  const killed = record.store.status === 'present'
    && ['off', 'false', '0'].includes(String(record.store.valueClass || '').toLowerCase());
  const expected = floorOpen && mode === 'public' && !killed ? 'ledger' : 'legacy';
  return record.probe.observedPath === expected;
}

module.exports = {
  id: 'G-09',
  async run(ctx) {
    const fixture = H.readJson(ctx.root, 'guards/fixtures/honesty/g09-rfc-mode.json');
    ctx.eq('G-09 fixture baseline is locked', fixture.baseline, ctx.baseline);
    for (const source of fixture.sources) {
      ctx.eq('G-09 source seal ' + source.key,
        H.sha256(H.gitShow(ctx.root, source.revision, source.path)), source.sha256);
    }
    const guard = fs.readFileSync(path.join(ctx.root, 'guards/rfc-v05r2-mode-guard.cjs'), 'utf8');
    ctx.ok('G-09 dated live-store note is explicitly historical and unverified',
      guard.includes('this gate consumes no immutable external record')
        && guard.includes('not a passing assertion')
        && !guard.includes('Measured on 2026-08-07 against the live store'));
    ctx.ok('G-09 guard no longer labels its fake state as production',
      !guard.includes('which is the actual production state')
        && !guard.includes('This is the state a fresh production environment is'));
    ctx.ok('G-09 external evidence is honestly blocked',
      fixture.externalEvidence.status === 'BLOCKED_OFFLINE'
        && fixture.externalEvidence.acceptanceGreen === false
        && fixture.externalEvidence.deployment === null
        && fixture.externalEvidence.store === null
        && fixture.externalEvidence.probes === null);

    const STORE = await import(pathToFileURL(path.join(ctx.root, 'lib/ledger/redis.js')).href);
    const FLAG = await import(pathToFileURL(path.join(ctx.root, 'lib/ledger/flag.js')).href);
    const saved = { floor: process.env.LEDGER_RAG, mode: process.env.RFC_V05_MODE };
    try {
      for (let i = 0; i < fixture.localCases.length; i++) {
        const entry = fixture.localCases[i];
        if (entry.floor === null) delete process.env.LEDGER_RAG;
        else process.env.LEDGER_RAG = entry.floor;
        if (entry.mode === null) delete process.env.RFC_V05_MODE;
        else process.env.RFC_V05_MODE = entry.mode;
        STORE.__setRedisForTest(fakeRedis(entry.stored));
        FLAG.__resetFlagCacheForTest();
        const result = await FLAG.decidePath({ headers: {} }, 1000000 + i * 100000);
        ctx.eq('G-09 production mode decision on local case ' + (i + 1),
          result.path, entry.expected);
      }
    } finally {
      if (saved.floor === undefined) delete process.env.LEDGER_RAG;
      else process.env.LEDGER_RAG = saved.floor;
      if (saved.mode === undefined) delete process.env.RFC_V05_MODE;
      else process.env.RFC_V05_MODE = saved.mode;
      STORE.__resetRedis();
      FLAG.__resetFlagCacheForTest();
    }

    const base = {
      status: 'CAPTURED', acceptanceGreen: true,
      deployment: { id: 'preview-mutant', gitSha: 'a'.repeat(40), floor: 'on', mode: 'public' },
      store: { serviceId: 'store-mutant', status: 'absent', valueClass: null },
      probe: { observedPath: 'ledger', responseSha256: 'b'.repeat(64) },
    };
    const deploymentOff = { ...base, deployment: { ...base.deployment, mode: 'off' } };
    ctx.ok('G-09 MUTANT 1 KILLED: deployed mode off cannot be reported as a public Ledger path',
      !capturedRecordConsistent(deploymentOff));
    const storeOff = { ...base, store: { ...base.store, status: 'present', valueClass: 'off' } };
    ctx.ok('G-09 MUTANT 2 KILLED: a real-store off record cannot be cleared by a fake-map result',
      !capturedRecordConsistent(storeOff));
  },
};
