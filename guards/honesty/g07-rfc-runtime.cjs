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
    ctx.ok('G-07 external acceptance remains explicitly not green',
      fixture.externalEvidence.acceptanceGreen === false
        && Object.entries(fixture.externalEvidence)
          .filter(([key]) => !['acceptanceGreen', 'reason'].includes(key))
          .every(([, value]) => value === null));

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
