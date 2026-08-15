'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const H = require('./_lib.cjs');

function dispatchContract(source) {
  const stored = source.indexOf("if (storedContext.runtime === 'STORED_FIQH') {");
  const ledger = source.indexOf("if (ledgerPath.path === 'ledger' && storedContext.runtime === 'HADITH') {");
  return { stored, ledger, valid: stored >= 0 && ledger > stored };
}

function fakeRedis(storedValue) {
  return {
    async get() { return storedValue; },
    async set() { return 'OK'; },
  };
}

module.exports = {
  id: 'G-06',
  async run(ctx) {
    const fixture = H.readJson(ctx.root, 'guards/fixtures/honesty/g06-ledger-runtime.json');
    ctx.eq('G-06 fixture baseline is locked', fixture.baseline, ctx.baseline);
    for (const source of fixture.sources) {
      ctx.eq('G-06 source seal ' + source.key,
        H.sha256(H.gitShow(ctx.root, source.revision, source.path)), source.sha256);
    }

    const guard = fs.readFileSync(path.join(ctx.root, 'ledger-runtime-guard.cjs'), 'utf8');
    ctx.ok('G-06 guard discloses preview configuration and the in-memory Redis double',
      guard.includes("process.env.VERCEL_ENV = 'preview';") && guard.includes('function fakeRedis()'));
    ctx.ok('G-06 corrected claim separates a routing decision from engine execution',
      guard.includes('necessary but not sufficient to run the Ledger engine')
        && guard.includes('does not claim to observe a deployed environment or a real store'));
    ctx.ok('G-06 external deployment evidence is explicitly absent',
      fixture.externalEvidence.deploymentEnvironmentObserved === false
        && fixture.externalEvidence.realRedisObserved === false);

    const redisUrl = pathToFileURL(path.join(ctx.root, 'lib/ledger/redis.js')).href;
    const flagUrl = pathToFileURL(path.join(ctx.root, 'lib/ledger/flag.js')).href;
    const STORE = await import(redisUrl);
    const FLAG = await import(flagUrl);
    const saved = { floor: process.env.LEDGER_RAG, mode: process.env.RFC_V05_MODE };
    try {
      for (let i = 0; i < fixture.decisionCases.length; i++) {
        const entry = fixture.decisionCases[i];
        process.env.LEDGER_RAG = entry.floor;
        process.env.RFC_V05_MODE = entry.mode;
        STORE.__setRedisForTest(fakeRedis(entry.stored));
        FLAG.__resetFlagCacheForTest();
        const result = await FLAG.decidePath({ headers: {} }, 100000 + i * 100000);
        ctx.eq('G-06 real decidePath case ' + (i + 1), result.path, entry.expected);
      }
    } finally {
      if (saved.floor === undefined) delete process.env.LEDGER_RAG;
      else process.env.LEDGER_RAG = saved.floor;
      if (saved.mode === undefined) delete process.env.RFC_V05_MODE;
      else process.env.RFC_V05_MODE = saved.mode;
      STORE.__resetRedis();
      FLAG.__resetFlagCacheForTest();
    }

    const ask = fs.readFileSync(path.join(ctx.root, 'api/ask.js'), 'utf8');
    ctx.ok('G-06 ordinary fiqh exits before the eligible HADITH Ledger dispatch',
      dispatchContract(ask).valid);
    const wrongRuntime = ask.replace(
      "storedContext.runtime === 'HADITH'", "storedContext.runtime === 'STORED_FIQH'");
    ctx.ok('G-06 MUTANT 1 KILLED: STORED_FIQH cannot replace the HADITH dispatch predicate',
      !dispatchContract(wrongRuntime).valid);
    const noRuntime = ask.replace(" && storedContext.runtime === 'HADITH'", '');
    ctx.ok('G-06 MUTANT 2 KILLED: a rollout decision alone cannot dispatch Ledger',
      !dispatchContract(noRuntime).valid);
  },
};
