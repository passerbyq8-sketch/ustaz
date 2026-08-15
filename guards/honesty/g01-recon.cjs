'use strict';

const fs = require('fs');
const path = require('path');
const H = require('./_lib.cjs');

module.exports = {
  id: 'G-01',
  async run(ctx) {
    const fixture = H.readJson(ctx.root, 'guards/fixtures/honesty/g01-recon.json');
    ctx.eq('G-01 fixture baseline is the locked baseline', fixture.baseline, ctx.baseline);

    const blobs = {};
    for (const source of fixture.sources) {
      const bytes = H.gitShow(ctx.root, source.revision, source.path);
      blobs[source.key] = bytes;
      ctx.eq('G-01 source seal ' + source.key, H.sha256(bytes), source.sha256);
    }

    const baselineGates = JSON.parse(blobs.gates.toString('utf8')).map((gate) => gate.name);
    ctx.eq('G-01 independently frozen baseline roster', baselineGates, fixture.expectedGateNames);

    const currentRecon = fs.readFileSync(path.join(ctx.root, 'recon-audit.cjs'), 'utf8');
    const parser = H.loadNamedFunction(currentRecon, 'extractArrayBody');
    const retrieve = blobs.retrieve.toString('utf8');
    ctx.eq('G-01 real baseline SITES_MINOR extraction',
      H.domains(parser(retrieve, 'SITES_MINOR')), fixture.expectedMinorDomains);
    ctx.eq('G-01 real baseline SITES_ADULT extraction',
      H.domains(parser(retrieve, 'SITES_ADULT')), fixture.expectedAdultDomains);

    const historicalReal = blobs.historicalReal.toString('utf8');
    const currentBody = parser(historicalReal, fixture.historical.arrayName);
    ctx.eq('G-01 current parser reads the complete historical real array length',
      currentBody.length, fixture.historical.fullLength);
    ctx.eq('G-01 complete historical real array seal',
      H.sha256(Buffer.from(currentBody)), fixture.historical.fullSha256);

    const oldParser = H.loadNamedFunction(blobs.historicalParser.toString('utf8'), 'extractArrayBody');
    const truncated = oldParser(historicalReal, fixture.historical.arrayName);
    ctx.eq('G-01 historical mutant precondition seal',
      H.sha256(Buffer.from(truncated)), fixture.historical.oldSha256);
    ctx.ok('G-01 MUTANT 1 KILLED: first-closing-bracket parser truncates a real array',
      truncated.length === fixture.historical.oldLength
        && H.sha256(Buffer.from(truncated)) !== fixture.historical.fullSha256);

    const missingRound3 = baselineGates.filter((name) => name !== 'rfcround3');
    ctx.ok('G-01 MUTANT 2 KILLED: removing rfcround3 breaks the frozen roster',
      JSON.stringify(missingRound3) !== JSON.stringify(fixture.expectedGateNames));

    const currentGates = JSON.parse(fs.readFileSync(path.join(ctx.root, 'gates.json'), 'utf8'));
    const countMatch = /const GATES_EXPECTED = (\d+);/.exec(currentRecon);
    ctx.eq('G-01 current gate roster matches recon count', currentGates.length,
      countMatch ? Number(countMatch[1]) : null);
  },
};
