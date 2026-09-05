// Layer 1: only certain sacred references and name-free fragments are rejected.
//
// Rule order is pinned at the production seam. Name-bearing spans survive first,
// even with swallowed prose, books, grades or clauses. Source-bearing spans
// survive second and keep their existing verdict. Sacred/name-free fragments
// alone take the no-capture path: no claimed authority, attribution verdict, cut
// or mark, and a byte-identical sentence. Independent mutants remove each allow
// rule, and the gate itself is bypassed in a third mutant.
'use strict';

const fs = require('fs');
const path = require('path');
const { fresh, runMutant, harness } = require('./output-reviewer-mutant-lib.cjs');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'lib', 'output-reviewer.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'layer1-human-capture.json');
const GATE = 'if (!capturedAttributionMayReachVerdict(claimed)) return null;';
const BYPASS = 'if (false && !capturedAttributionMayReachVerdict(claimed)) return null;';
const NAME_ALLOW = 'if (capturedSpanContainsHumanName(claimed)) return true;';
const NAME_SWALLOWED = 'if (false && capturedSpanContainsHumanName(claimed)) return true;';
const SOURCE_ALLOW = 'if (capturedSpanClaimsSource(claimed)) return true;';
const SOURCE_SWALLOWED = 'if (false && capturedSpanClaimsSource(claimed)) return true;';
const suite = harness('layer1-human-capture');

function ascii(value) {
  return String(value).replace(/[^\x00-\x7F]/gu,
    (char) => '\\u' + char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
}

function review(module, text) {
  return module.reviewAnswer({ text, evidence: [], domain: 'fiqh', mode: 'detailed' });
}

function capture(result) {
  return result.annotations.find((item) => typeof item.claimedAuthority === 'string') || null;
}

function droppedLikeNoCapture(module, row) {
  const result = review(module, row.text);
  const sentence = result.annotations.find((item) => item.input === row.text);
  return capture(result) === null
    && sentence?.action === 'tagged-fiqh-understanding'
    && sentence.output === row.text
    && result.text.split('\n')[0] === row.text;
}

function capturedAsExpected(module, row) {
  const captured = capture(review(module, row.text));
  return captured?.claimedAuthority === row.claimed
    && (!row.action || captured.action === row.action);
}

(async () => {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const source = fs.readFileSync(SOURCE, 'utf8');
  const live = await fresh(SOURCE, 'layer1-live');
  const allowed = [...fixture.nameBearing, ...fixture.sourceBearing, ...fixture.passing];

  suite.ok('capture-site gate anchor is unique', source.split(GATE).length - 1 === 1);
  suite.ok('rule A allow anchor is unique', source.split(NAME_ALLOW).length - 1 === 1);
  suite.ok('rule B allow anchor is unique', source.split(SOURCE_ALLOW).length - 1 === 1);
  suite.ok('fixture has rejected cases', Array.isArray(fixture.rejected) && fixture.rejected.length > 0);
  suite.ok('fixture has name-bearing cases', Array.isArray(fixture.nameBearing) && fixture.nameBearing.length > 0);
  suite.ok('fixture has source-bearing cases', Array.isArray(fixture.sourceBearing) && fixture.sourceBearing.length > 0);
  suite.ok('fixture has ordinary passing cases', Array.isArray(fixture.passing) && fixture.passing.length > 0);

  for (const row of fixture.rejected) {
    const result = review(live, row.text);
    suite.ok('rule C ' + row.id + ' is rejected before verdict', droppedLikeNoCapture(live, row),
      ascii(JSON.stringify(result.annotations)));
  }
  for (const row of fixture.nameBearing) {
    const result = review(live, row.text);
    suite.ok('rule A ' + row.id + ' keeps its existing capture and verdict', capturedAsExpected(live, row),
      ascii(JSON.stringify(result.annotations)));
  }
  for (const row of fixture.sourceBearing) {
    const result = review(live, row.text);
    suite.ok('rule B ' + row.id + ' keeps its existing capture and verdict', capturedAsExpected(live, row),
      ascii(JSON.stringify(result.annotations)));
  }
  for (const row of fixture.passing) {
    const result = review(live, row.text);
    suite.ok('ordinary passing ' + row.id + ' keeps its capture', capturedAsExpected(live, row),
      ascii(JSON.stringify(result.annotations)));
  }

  let allowedStayedByteIdentical = false;
  const bypassMutant = await runMutant({
    sourceFile: SOURCE,
    name: 'layer1-reject-gate-bypassed',
    transform: (text) => text.replace(GATE, BYPASS),
    survives: async (module) => {
      allowedStayedByteIdentical = allowed.every((row) =>
        JSON.stringify(review(module, row.text)) === JSON.stringify(review(live, row.text)));
      return fixture.rejected.every((row) => droppedLikeNoCapture(module, row));
    },
  });
  suite.ok('all allowed captures and verdicts are byte-identical with the reject gate bypassed',
    allowedStayedByteIdentical);
  suite.ok('MUTANT KILLED: bypassing rule C lets a rejected capture reach a verdict',
    bypassMutant.changed && bypassMutant.loaded && bypassMutant.survived === false,
    ascii(JSON.stringify(bypassMutant)));

  const nameMutant = await runMutant({
    sourceFile: SOURCE,
    name: 'layer1-name-allow-swallowed',
    transform: (text) => text.replace(NAME_ALLOW, NAME_SWALLOWED),
    survives: async (module) => fixture.nameBearing.every((row) =>
      JSON.stringify(review(module, row.text)) === JSON.stringify(review(live, row.text))),
  });
  suite.ok('RULE A MUTANT KILLED: the gate cannot swallow a name-bearing span',
    nameMutant.changed && nameMutant.loaded && nameMutant.survived === false,
    ascii(JSON.stringify(nameMutant)));

  const sourceMutant = await runMutant({
    sourceFile: SOURCE,
    name: 'layer1-source-allow-swallowed',
    transform: (text) => text.replace(SOURCE_ALLOW, SOURCE_SWALLOWED),
    survives: async (module) => fixture.sourceBearing.every((row) =>
      JSON.stringify(review(module, row.text)) === JSON.stringify(review(live, row.text))),
  });
  suite.ok('RULE B MUTANT KILLED: the gate cannot swallow a book-bearing span',
    sourceMutant.changed && sourceMutant.loaded && sourceMutant.survived === false,
    ascii(JSON.stringify(sourceMutant)));

  process.exitCode = suite.finish();
})().catch((error) => {
  console.error('layer1-human-capture guard crashed: ' + ascii(error?.stack || error));
  process.exitCode = 1;
});
