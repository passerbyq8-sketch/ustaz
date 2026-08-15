'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const H = require('./_lib.cjs');

function searchContract(source) {
  const body = H.functionSource(source, 'braveSearch') || '';
  const reserveAt = body.indexOf('await opts.dailyBudget.reserve()');
  const fetchAt = body.indexOf('await doFetch(');
  return {
    ordering: reserveAt >= 0 && fetchAt > reserveAt,
    failClosed: body.includes('if (!reservation || !reservation.ok)'),
  };
}

module.exports = {
  id: 'G-07',
  async run(ctx) {
    const fixture = H.readJson(ctx.root, 'guards/fixtures/honesty/g07-rfc-runtime.json');
    ctx.eq('G-07 fixture baseline is locked', fixture.baseline, ctx.baseline);
    for (const source of fixture.sources) {
      ctx.eq('G-07 source seal ' + source.key,
        H.sha256(H.gitShow(ctx.root, source.revision, source.path)), source.sha256);
    }
    const runtimeGuard = fs.readFileSync(
      path.join(ctx.root, 'guards/rfc-v05r2-runtime-guard.cjs'), 'utf8');
    const budgetGuard = fs.readFileSync(
      path.join(ctx.root, 'guards/search-budget-p0-guard.cjs'), 'utf8');
    ctx.ok('G-07 existing guards disclose their offline doubles',
      runtimeGuard.includes('EVERYTHING HERE IS OFFLINE AND DETERMINISTIC')
        && runtimeGuard.includes('https://fake.invalid')
        && budgetGuard.includes('Entirely offline: Redis and Brave are deterministic doubles'));
    // MERGE ROUND: the offline round could assert "every field is null", which is easy to keep
    // true and says nothing once a deployment exists. The rule now is per field: whatever was
    // observed must be named in a checkable shape, and whatever is still missing must carry a
    // measured reason. acceptanceGreen may only be true when NOTHING is missing -- the bar this
    // fixture set for itself, not the bar the reachable evidence happens to clear.
    const evidence = fixture.externalEvidence;
    const named = (value) => typeof value === 'string' && value.length > 0;
    function evidenceIsHonest(subject) {
      const required = ['deploymentId', 'deployedGitSha', 'upstashTransaction',
        'braveRequestId', 'anthropicRequestId', 'rawSse'];
      const missing = required.filter((key) => subject[key] === null || subject[key] === undefined);
      for (const key of missing) {
        if (!named(subject.blocked && subject.blocked[key])) return false;
      }
      if (subject.acceptanceGreen === true && missing.length) return false;
      if (subject.deploymentId !== null && !/^dpl_[A-Za-z0-9]+$/.test(subject.deploymentId)) return false;
      if (subject.deployedGitSha !== null && !/^[0-9a-f]{40}$/.test(subject.deployedGitSha)) return false;
      if (subject.rawSse !== null) {
        if (!/^[0-9a-f]{64}$/.test(subject.rawSse.sha256)) return false;
        if (!(Number.isInteger(subject.rawSse.bytes) && subject.rawSse.bytes > 0)) return false;
        if (!named(subject.rawSse.vercelId)) return false;
      }
      return named(subject.reason);
    }
    ctx.ok('G-07 the deployed half is named and the missing half states why',
      evidence.acceptanceGreen === false
        && named(evidence.deploymentId) && named(evidence.deployedGitSha) && evidence.rawSse !== null
        && evidenceIsHonest(evidence));
    ctx.ok('G-07 MUTANT 3 KILLED: declaring acceptance green while a required field is missing fails',
      !evidenceIsHonest({ ...evidence, acceptanceGreen: true }));
    ctx.ok('G-07 MUTANT 4 KILLED: dropping a blocked field reason fails',
      !evidenceIsHonest({ ...evidence, blocked: { ...evidence.blocked, braveRequestId: '' } }));
    ctx.ok('G-07 MUTANT 5 KILLED: an SSE seal that is not a sha256 fails',
      !evidenceIsHonest({ ...evidence, rawSse: { ...evidence.rawSse, sha256: 'not-a-hash' } }));

    const searchPath = path.join(ctx.root, 'lib/ledger/search.js');
    const SEARCH = await import(pathToFileURL(searchPath).href);
    const savedKey = process.env.BRAVE_API_KEY;
    try {
      process.env.BRAVE_API_KEY = 'offline-honesty-key';
      const order = [];
      await SEARCH.braveSearch('bounded offline query', ['islamqa.info'], {
        dailyBudget: { reserve: async () => { order.push('reserve'); return { ok: true }; } },
        fetchImpl: async () => {
          order.push('fetch');
          return { ok: true, json: async () => ({ web: { results: [] } }) };
        },
      });
      ctx.eq('G-07 production search reserves before its injected transport', order, ['reserve', 'fetch']);

      const blockedOrder = [];
      let blockedReason = '';
      try {
        await SEARCH.braveSearch('bounded blocked query', ['islamqa.info'], {
          dailyBudget: {
            reserve: async () => {
              blockedOrder.push('reserve');
              return { ok: false, reason: 'budget_store_unavailable' };
            },
          },
          fetchImpl: async () => { blockedOrder.push('fetch'); throw new Error('must not run'); },
        });
      } catch (error) {
        blockedReason = error && error.reason;
      }
      ctx.eq('G-07 production search fails closed before transport on store refusal',
        { order: blockedOrder, reason: blockedReason },
        { order: ['reserve'], reason: 'budget_store_unavailable' });
    } finally {
      if (savedKey === undefined) delete process.env.BRAVE_API_KEY;
      else process.env.BRAVE_API_KEY = savedKey;
    }

    const searchSource = fs.readFileSync(searchPath, 'utf8');
    const original = searchContract(searchSource);
    ctx.ok('G-07 source contract agrees with driven ordering and fail-closed behavior',
      original.ordering && original.failClosed);
    const body = H.functionSource(searchSource, 'braveSearch') || '';
    const moved = body.replace('await opts.dailyBudget.reserve()', 'true')
      + '\nawait opts.dailyBudget.reserve();';
    ctx.ok('G-07 MUTANT 1 KILLED: moving reservation after provider transport breaks ordering',
      !searchContract(moved).ordering);
    const failOpen = searchSource.replace(
      'if (!reservation || !reservation.ok)', 'if (!reservation)');
    ctx.ok('G-07 MUTANT 2 KILLED: ignoring a refused reservation breaks fail-closed policy',
      !searchContract(failOpen).failClosed);
  },
};
