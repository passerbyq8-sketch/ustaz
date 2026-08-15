'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const H = require('./_lib.cjs');

function eligibleTransaction(transaction) {
  if (!transaction || transaction.authenticated !== true) return false;
  let final;
  try { final = new URL(transaction.finalUrl); } catch { return false; }
  return final.protocol === 'https:'
    && transaction.httpStatus >= 200 && transaction.httpStatus < 300
    && transaction.pageGate === 'eligible'
    && transaction.cleanTextChars >= transaction.requiredFloor
    && /^[a-f0-9]{64}$/.test(transaction.rawSha256 || '');
}

function decisionMatchesTransaction(registryStatus, transaction) {
  return eligibleTransaction(transaction) ? registryStatus === 'active' : registryStatus !== 'active';
}

module.exports = {
  id: 'G-11',
  async run(ctx) {
    const fixture = H.readJson(ctx.root, 'guards/fixtures/honesty/g11-dead-domains.json');
    ctx.eq('G-11 fixture baseline is locked', fixture.baseline, ctx.baseline);
    for (const source of fixture.sources) {
      ctx.eq('G-11 source seal ' + source.key,
        H.sha256(H.gitShow(ctx.root, source.revision, source.path)), source.sha256);
    }
    const guard = fs.readFileSync(path.join(ctx.root, 'guards/dead-domains-guard.cjs'), 'utf8');
    ctx.ok('G-11 guard labels historical notes as non-authentic context',
      guard.includes('HISTORICAL OPERATOR NOTES')
        && guard.includes('consumes no raw responses')
        && guard.includes('no note length or prose status is treated as authentic liveness evidence'));
    ctx.ok('G-11 external current-liveness acceptance remains blocked',
      fixture.externalEvidence.status === 'BLOCKED_OFFLINE'
        && fixture.externalEvidence.acceptanceGreen === false
        && fixture.externalEvidence.transactions === null
        && fixture.externalEvidence.rawResponseArchive === null
        && fixture.externalEvidence.signature === null);

    const REGISTRY = await import(pathToFileURL(path.join(ctx.root, 'lib/source-registry.js')).href);
    const POLICY = await import(pathToFileURL(path.join(ctx.root, 'lib/ledger/source-policy.js')).href);
    const RETRIEVE = await import(pathToFileURL(path.join(ctx.root, 'lib/retrieve.js')).href);
    const lists = [RETRIEVE.SITES_ADULT, RETRIEVE.SITES_MINOR,
      RETRIEVE.SITES_MINOR_FALLBACK, RETRIEVE.SITES_GENERAL];
    for (const domain of fixture.decisions.deferred) {
      const row = REGISTRY.findSource(domain);
      ctx.ok('G-11 deferred decision is enforced everywhere for ' + domain,
        row && row.status === 'deferred'
          && row.scopes.length === 0
          && row.bands.length === 0
          && lists.every((list) => !list.includes(domain))
          && !POLICY.searchableDomains().includes(domain));
    }
    for (const domain of fixture.decisions.active) {
      const row = REGISTRY.findSource(domain);
      ctx.ok('G-11 active registry decision remains explicit for ' + domain,
        row && row.status === 'active' && RETRIEVE.SITES_ADULT.includes(domain));
    }

    const eligible = {
      authenticated: true, finalUrl: 'https://dorar.net/feqhia/1', httpStatus: 200,
      pageGate: 'eligible', cleanTextChars: 900, requiredFloor: 200, rawSha256: 'a'.repeat(64),
    };
    ctx.ok('G-11 MUTANT 1 KILLED: a newly eligible deferred host requires a decision refresh',
      !decisionMatchesTransaction('deferred', eligible));
    const movedToHttp = {
      ...eligible, finalUrl: 'http://www.ferkous.app/home/?q=fatwa-660',
    };
    ctx.ok('G-11 MUTANT 2 KILLED: an enabled host ending on HTTP is not eligible',
      !decisionMatchesTransaction('active', movedToHttp));
  },
};
