'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const H = require('./_lib.cjs');

function recomputeStatus(transaction) {
  if (!transaction || transaction.httpStatus < 200 || transaction.httpStatus >= 500) return 'dead';
  if (transaction.httpStatus === 404 || transaction.httpStatus === 410) return 'probe-stale';
  if (transaction.httpStatus >= 400) return 'dead';
  return transaction.pageGate === 'eligible' ? 'live-cites' : 'live-no-citation';
}

function authenticEnvelope(envelope) {
  if (!envelope || envelope.status !== 'CAPTURED' || envelope.acceptanceGreen !== true) return false;
  if (!/^[a-f0-9]{64}$/.test(envelope.toolSha256 || '')) return false;
  if (!/^[a-f0-9]{64}$/.test(envelope.manifestSignature || '')) return false;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(envelope.signedAt || '')) return false;
  if (envelope.measuredAt !== envelope.signedAt.slice(0, 10)) return false;
  if (!Array.isArray(envelope.transactions) || !envelope.transactions.length) return false;
  return envelope.transactions.every((transaction) =>
    /^[a-f0-9]{64}$/.test(transaction.rawSha256 || '')
      && transaction.claimedStatus === recomputeStatus(transaction)
      && String(transaction.finishedAt || '').slice(0, 10) === envelope.measuredAt);
}

module.exports = {
  id: 'G-12',
  async run(ctx) {
    const fixture = H.readJson(ctx.root, 'guards/fixtures/honesty/g12-source-liveness.json');
    ctx.eq('G-12 fixture baseline is locked', fixture.baseline, ctx.baseline);
    for (const source of fixture.sources) {
      ctx.eq('G-12 source seal ' + source.key,
        H.sha256(H.gitShow(ctx.root, source.revision, source.path)), source.sha256);
    }
    const guard = fs.readFileSync(path.join(ctx.root, 'guards/source-liveness-guard.cjs'), 'utf8');
    ctx.ok('G-12 consumer labels the JSON as an editable unauthenticated summary',
      guard.includes('reads that editable summary')
        && guard.includes('not authentic proof of current external liveness')
        && guard.includes('Date freshness is not transaction authenticity'));

    const summaryBytes = fs.readFileSync(path.join(ctx.root, 'data/source-liveness.json'));
    const summary = JSON.parse(summaryBytes.toString('utf8'));
    ctx.eq('G-12 protected summary remains byte-identical to the locked baseline',
      H.sha256(summaryBytes), fixture.sources.find((entry) => entry.key === 'protectedSummary').sha256);
    ctx.eq('G-12 protected summary claimed date', summary.measuredAt,
      fixture.protectedSummary.measuredAt);
    ctx.eq('G-12 protected summary row count', summary.domains.length,
      fixture.protectedSummary.rows);
    ctx.eq('G-12 protected summary authenticity fields are absent', {
      signaturePresent: Object.hasOwn(summary, 'signature'),
      rawResponseShaRows: summary.domains.filter((row) => row.rawSha256).length,
    }, {
      signaturePresent: fixture.protectedSummary.signaturePresent,
      rawResponseShaRows: fixture.protectedSummary.rawResponseShaRows,
    });

    const REGISTRY = await import(pathToFileURL(path.join(ctx.root, 'lib/source-registry.js')).href);
    const RETRIEVE = await import(pathToFileURL(path.join(ctx.root, 'lib/retrieve.js')).href);
    const production = new Set([
      ...RETRIEVE.SITES_ADULT, ...RETRIEVE.SITES_MINOR, ...RETRIEVE.SITES_MINOR_FALLBACK,
      ...RETRIEVE.SITES_GENERAL, ...REGISTRY.activeSources().map((source) => source.domain),
      ...REGISTRY.worldSources().map((source) => source.domain),
    ].map((domain) => String(domain).toLowerCase()));
    const byDomain = new Map(summary.domains.map((row) => [String(row.domain).toLowerCase(), row]));
    ctx.ok('G-12 offline summary covers every production domain',
      [...production].every((domain) => byDomain.has(domain)));
    ctx.ok('G-12 no production domain is recorded dead in the unsigned summary',
      [...production].every((domain) => byDomain.get(domain).status !== 'dead'));
    ctx.ok('G-12 external current-liveness acceptance remains blocked',
      fixture.externalEvidence.status === 'BLOCKED_OFFLINE'
        && fixture.externalEvidence.acceptanceGreen === false
        && fixture.externalEvidence.signedManifest === null
        && fixture.externalEvidence.rawResponseArchive === null);

    const base = {
      status: 'CAPTURED', acceptanceGreen: true, measuredAt: '2026-08-07',
      signedAt: '2026-08-07T12:05:00Z', toolSha256: 'a'.repeat(64),
      manifestSignature: 'b'.repeat(64),
      transactions: [{
        url: 'https://dorar.net/feqhia/1', httpStatus: 403, pageGate: 'ineligible',
        claimedStatus: 'dead', rawSha256: 'c'.repeat(64), finishedAt: '2026-08-07T12:04:00Z',
      }],
    };
    ctx.ok('G-12 authenticated-envelope validator accepts its consistent precondition',
      authenticEnvelope(base));
    const dateOnly = { ...base, measuredAt: '2026-08-08' };
    ctx.ok('G-12 MUTANT 1 KILLED: advancing measuredAt without a new signed probe fails',
      !authenticEnvelope(dateOnly));
    const flipped = {
      ...base,
      transactions: [{ ...base.transactions[0], claimedStatus: 'live-cites' }],
    };
    ctx.ok('G-12 MUTANT 2 KILLED: flipping dead to live with the same response hash fails',
      !authenticEnvelope(flipped));
  },
};
