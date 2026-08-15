'use strict';

const fs = require('fs');
const path = require('path');
const H = require('./_lib.cjs');

function capturedDeploymentConsistent(record) {
  if (!record || record.status !== 'CAPTURED' || record.acceptanceGreen !== true) return false;
  if (!record.deploymentId || !/^[a-f0-9]{40}$/.test(record.approvedGitSha || '')) return false;
  if (record.deployedGitSha !== record.approvedGitSha) return false;
  if (!record.expectedEnvironment || !record.observedEnvironment) return false;
  if (JSON.stringify(record.expectedEnvironment) !== JSON.stringify(record.observedEnvironment)) return false;
  if (!record.requestId || !/^[a-f0-9]{64}$/.test(record.rawSseSha256 || '')) return false;
  return record.closeCount === 1;
}

module.exports = {
  id: 'G-10',
  async run(ctx) {
    const fixture = H.readJson(ctx.root, 'guards/fixtures/honesty/g10-shipped-reality.json');
    ctx.eq('G-10 fixture baseline is locked', fixture.baseline, ctx.baseline);
    for (const source of fixture.sources) {
      ctx.eq('G-10 source seal ' + source.key,
        H.sha256(H.gitShow(ctx.root, source.revision, source.path)), source.sha256);
    }
    const guard = fs.readFileSync(path.join(ctx.root, 'guards/shipped-reality-guard.cjs'), 'utf8');
    ctx.ok('G-10 gate labels its state and transports as constructed local inputs',
      guard.includes('CONSTRUCTED LOCAL HANDLER SCENARIOS')
        && guard.includes('LOCAL ZERO-CONFIG SIMULATION')
        && guard.includes('Nothing here observes a real store.'));
    ctx.ok('G-10 old fresh-production advertised claim is absent',
      !guard.includes('FRESH PRODUCTION, AS IT REALLY IS')
        && !guard.includes('the two states that actually exist'));
    ctx.ok('G-10 local scenario manifest matches executable doubles',
      fixture.localScenario.rolloutEnvironment === 'cleared'
        && fixture.localScenario.ledgerStore === 'injected-null'
        && fixture.localScenario.anthropic === 'authored-fetch-double'
        && guard.includes("process.env.ANTHROPIC_API_KEY = 'guard-not-a-real-key';")
        && guard.includes('LEDGER_REDIS.__setRedisForTest(null);'));
    ctx.ok('G-10 external reader evidence remains explicitly blocked',
      fixture.externalEvidence.status === 'BLOCKED_OFFLINE'
        && fixture.externalEvidence.acceptanceGreen === false
        && Object.entries(fixture.externalEvidence)
          .filter(([key]) => !['status', 'acceptanceGreen', 'reason'].includes(key))
          .every(([, value]) => value === null));

    const base = {
      status: 'CAPTURED', acceptanceGreen: true, deploymentId: 'dpl_mutation_probe',
      approvedGitSha: 'a'.repeat(40), deployedGitSha: 'a'.repeat(40),
      expectedEnvironment: { RFC_V05_MODE: 'public', LEDGER_RAG: 'on' },
      observedEnvironment: { RFC_V05_MODE: 'public', LEDGER_RAG: 'on' },
      requestId: 'req_mutation_probe', rawSseSha256: 'b'.repeat(64), closeCount: 1,
    };
    ctx.ok('G-10 captured-record validator accepts its internally consistent precondition',
      capturedDeploymentConsistent(base));
    const envDrift = {
      ...base,
      observedEnvironment: { ...base.observedEnvironment, RFC_V05_MODE: 'off' },
    };
    ctx.ok('G-10 MUTANT 1 KILLED: deployed environment drift cannot match local construction',
      !capturedDeploymentConsistent(envDrift));
    const shaDrift = { ...base, deployedGitSha: 'c'.repeat(40) };
    ctx.ok('G-10 MUTANT 2 KILLED: another deployed commit cannot inherit local green',
      !capturedDeploymentConsistent(shaDrift));
  },
};
