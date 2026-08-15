'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const H = require('./_lib.cjs');

function disclosureContract(fn, notice, table) {
  const draft = 'offline-draft';
  for (const entry of table) {
    const value = fn(entry);
    if (typeof value !== 'string') return false;
    if ((value === notice) !== entry.notice) return false;
    const final = [value, draft].filter(Boolean).join('\n\n');
    const count = final.split(notice).length - 1;
    if (entry.notice && (!final.startsWith(notice + '\n\n') || count !== 1)) return false;
    if (!entry.notice && count !== 0) return false;
  }
  return true;
}

module.exports = {
  id: 'G-15',
  async run(ctx) {
    const fixture = H.readJson(ctx.root, 'guards/fixtures/honesty/g15-live-search.json');
    ctx.eq('G-15 fixture baseline is locked', fixture.baseline, ctx.baseline);
    for (const source of fixture.sources) {
      ctx.eq('G-15 source seal ' + source.key,
        H.sha256(H.gitShow(ctx.root, source.revision, source.path)), source.sha256);
    }
    const guard = fs.readFileSync(
      path.join(ctx.root, 'guards/live-search-disclosure-guard.cjs'), 'utf8');
    ctx.ok('G-15 original guard explicitly limits itself to offline deterministic evidence',
      guard.includes('Offline and deterministic. No network, no live model, no live Redis')
        && guard.includes('THE FOUR COMBINATIONS')
        && guard.includes('NO disclosure anywhere in it'));
    ctx.ok('G-15 optional external replay is not claimed',
      fixture.optionalExternalReplay.status === 'NOT_ACQUIRED_OPTIONAL'
        && fixture.optionalExternalReplay.deploymentId === null
        && fixture.optionalExternalReplay.braveRequestId === null
        && fixture.optionalExternalReplay.rawSse === null);

    const POLICY = await import(
      pathToFileURL(path.join(ctx.root, 'lib/policy/live-search-disclosure.js')).href);
    ctx.ok('G-15 production liveSearchNotice satisfies all four final-byte combinations',
      disclosureContract(POLICY.liveSearchNotice, POLICY.NO_LIVE_RESULTS_DISCLOSURE,
        fixture.truthTable));
    const ask = fs.readFileSync(path.join(ctx.root, 'api/ask.js'), 'utf8');
    const decisionAt = ask.indexOf('liveSearchNotice({');
    const prefixAt = ask.indexOf(
      "finalizerContext.readerPrefix = [presenceLead, liveNotice].filter(Boolean).join('\\n\\n')");
    ctx.ok('G-15 server owns the disclosure decision and prefix before response replay',
      decisionAt >= 0 && prefixAt > decisionAt);

    const removedPrefix = () => '';
    ctx.ok('G-15 MUTANT 1 KILLED: removing the empty-live prefix breaks the truth table',
      !disclosureContract(removedPrefix, POLICY.NO_LIVE_RESULTS_DISCLOSURE, fixture.truthTable));
    const prefixEverything = () => POLICY.NO_LIVE_RESULTS_DISCLOSURE;
    ctx.ok('G-15 MUTANT 2 KILLED: prefixing ordinary answers breaks the truth table',
      !disclosureContract(prefixEverything, POLICY.NO_LIVE_RESULTS_DISCLOSURE, fixture.truthTable));
  },
};
