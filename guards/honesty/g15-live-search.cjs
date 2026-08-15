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
    // MERGE ROUND: the optional replay was acquired. Two states are legitimate here and a third
    // is not: NOT_ACQUIRED_OPTIONAL with everything empty, or ACQUIRED with the deployment, the
    // sha and the raw stream all named. "ACQUIRED" with nothing behind it is the failure this
    // assertion exists to catch, which is exactly why it is written as a function of the status.
    const replay = fixture.optionalExternalReplay;
    const named = (value) => typeof value === 'string' && value.length > 0;
    function replayIsHonest(subject) {
      if (subject.status === 'NOT_ACQUIRED_OPTIONAL') {
        return subject.deploymentId === null && subject.braveRequestId === null && subject.rawSse === null;
      }
      if (subject.status !== 'ACQUIRED') return false;
      if (!/^dpl_[A-Za-z0-9]+$/.test(subject.deploymentId || '')) return false;
      if (!/^[0-9a-f]{40}$/.test(subject.deployedGitSha || '')) return false;
      if (!subject.rawSse || !/^[0-9a-f]{64}$/.test(subject.rawSse.sha256 || '')) return false;
      if (!named(subject.rawSse.vercelId)) return false;
      if (!subject.observed || !named(subject.observed.siteRestrictedPass)) return false;
      if (subject.braveRequestId === null
        && !named(subject.blocked && subject.blocked.braveRequestId)) return false;
      return named(subject.reason);
    }
    ctx.ok('G-15 the acquired replay names its deployment, its stream and its empty pass',
      replay.status === 'ACQUIRED' && replayIsHonest(replay));
    ctx.ok('G-15 MUTANT 3 KILLED: a replay declared acquired with no stream behind it fails',
      !replayIsHonest({ ...replay, rawSse: null }));
    ctx.ok('G-15 MUTANT 4 KILLED: a replay declared acquired with no deployment behind it fails',
      !replayIsHonest({ ...replay, deploymentId: null }));
    ctx.ok('G-15 MUTANT 5 KILLED: an unknown replay status fails rather than passing quietly',
      !replayIsHonest({ ...replay, status: 'PROBABLY_FINE' }));

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
