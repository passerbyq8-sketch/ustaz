// guards/output-reviewer-matrix-guard.cjs — the six required pure reviewer cases.
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { runMutant } = require('./output-reviewer-mutant-lib.cjs');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'fixtures', 'output-reviewer-six-cases.json');
const REVIEWER = path.join(ROOT, 'lib', 'output-reviewer.js');

let pass = 0;
let fail = 0;
function ok(label, condition, detail = '') {
  if (condition) { pass++; console.log('  PASS  ' + label); return; }
  fail++; console.log('  FAIL  ' + label + (detail ? ' | ' + detail : ''));
}

const occurrences = (text, needle) => String(text).split(needle).length - 1;
const appearsInOrder = (text, needles) => {
  let cursor = 0;
  for (const needle of needles) {
    const found = text.indexOf(needle, cursor);
    if (found < 0) return false;
    cursor = found + needle.length;
  }
  return true;
};

(async () => {
  try {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    ok('fixture schema is exact', fixture.schema === 'ezik.output-reviewer.six-cases.v1');
    ok('the required matrix has exactly six cases', Array.isArray(fixture.cases) && fixture.cases.length === 6);

    let wireCalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { wireCalls++; throw new Error('reviewer matrix forbids network'); };
    let module;
    try { module = await import(pathToFileURL(REVIEWER).href + '?matrix=' + Date.now()); }
    finally { globalThis.fetch = originalFetch; }
    ok('module exports the exact reviewAnswer function', typeof module.reviewAnswer === 'function');

    for (const test of fixture.cases || []) {
      const result = module.reviewAnswer(test.input);
      const keys = Object.keys(result).sort();
      ok(test.id + ': contract returns exactly text/annotations/verdict',
        JSON.stringify(keys) === JSON.stringify(['annotations', 'text', 'verdict']), JSON.stringify(keys));
      ok(test.id + ': output is non-empty', typeof result.text === 'string' && result.text.trim().length > 0);
      ok(test.id + ': verdict covers every annotation',
        result.verdict?.sentences?.length === result.annotations?.length, JSON.stringify(result.verdict));
      if (typeof test.expect.exactText === 'string') {
        ok(test.id + ': matched text is byte-identical', result.text === test.expect.exactText, result.text);
      }
      for (const needle of test.expect.contains || []) {
        ok(test.id + ': contains ' + JSON.stringify(needle), result.text.includes(needle), result.text);
      }
      for (const needle of test.expect.excludes || []) {
        ok(test.id + ': excludes ' + JSON.stringify(needle), !result.text.includes(needle), result.text);
      }
      const actions = result.annotations.map((item) => item.action);
      ok(test.id + ': sentence actions are exact',
        JSON.stringify(actions) === JSON.stringify(test.expect.actions), JSON.stringify(actions));
      if (test.expect.domains) {
        const domains = result.annotations.map((item) => item.domain);
        ok(test.id + ': sentence domains are exact',
          JSON.stringify(domains) === JSON.stringify(test.expect.domains), JSON.stringify(domains));
      }
    }

    ok('C-2 fixture carries the four measured open-structure cases',
      Array.isArray(fixture.c2?.cases) && fixture.c2.cases.length === 4);
    const c2CasePasses = (mod, test) => {
      const result = mod.reviewAnswer(test.input);
      return (test.expect.adjacent || []).every((needle) => result.text.includes(needle))
        && appearsInOrder(result.text, test.expect.ordered || [])
        && occurrences(result.text, fixture.c2.tail) === test.expect.tailCount
        && occurrences(result.text, mod.REVIEW_TAGS.FIQH_UNSOURCED) === test.expect.noticeCount;
    };
    for (const test of fixture.c2?.cases || []) {
      const result = module.reviewAnswer(test.input);
      ok(test.id + ': notes stay outside the open sentence and its structural continuation',
        c2CasePasses(module, test), result.text);
    }
    const tailFlood = module.reviewAnswer(fixture.c2.tailFlood);
    ok('C-2 disagreement tail appears at most once across the whole answer',
      occurrences(tailFlood.text, fixture.c2.tail) === 1, tailFlood.text);

    const placementMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'inject-answer-notes-after-first-prose',
      transform: (source) => source.replace(
        '  if (notices.length) output.splice(noticeInsertionIndex(output), 0, ...notices);',
        '  if (notices.length) output.splice(Math.min(1, output.length), 0, ...notices); // mutant: split the open structure'),
      survives: (mutantModule) => (fixture.c2?.cases || [])
        .every((test) => c2CasePasses(mutantModule, test)),
    });
    ok('C-2 placement mutant seam applied', placementMutant.changed, placementMutant.error);
    ok('C-2 placement mutant module loaded successfully', placementMutant.loaded, placementMutant.error);
    ok('MUTANT KILLED: answer notes cannot return inside an open sentence',
      placementMutant.loaded && placementMutant.survived === false, JSON.stringify(placementMutant));

    const auditExcerpt = (value) => Array.from(String(value ?? '')).slice(0, 200).join('');
    const c3CasePasses = (mod, test) => {
      const result = mod.reviewAnswer(test.input);
      const annotation = result.annotations.find((item) => item.action === test.action);
      const sentence = result.verdict.sentences.find((item) => item.action === test.action);
      return Boolean(annotation && sentence)
        && Object.hasOwn(sentence, 'before')
        && Object.hasOwn(sentence, 'after')
        && sentence.before === auditExcerpt(annotation.input)
        && sentence.after === auditExcerpt(annotation.output)
        && Array.from(sentence.before).length <= 200
        && Array.from(sentence.after).length <= 200;
    };
    ok('C-3 fixture carries all three destructive actions',
      Array.isArray(fixture.c3?.cases) && fixture.c3.cases.length === 3);
    for (const test of fixture.c3?.cases || []) {
      const result = module.reviewAnswer(test.input);
      ok(test.id + ': verdict carries exact clipped before/after excerpts',
        c3CasePasses(module, test), JSON.stringify(result.verdict));
    }
    const nonDestructive = module.reviewAnswer(fixture.c3.nonDestructive).verdict.sentences[0];
    ok('C-3 non-destructive actions do not copy answer text into the verdict',
      !Object.hasOwn(nonDestructive, 'before') && !Object.hasOwn(nonDestructive, 'after'),
      JSON.stringify(nonDestructive));

    const longClaim = 'الجمع للمسافر جائز عند الحاجة، '.repeat(20);
    const longAudit = module.reviewAnswer({
      text: 'قال ابن باز إن ' + longClaim, evidence: [], domain: 'fiqh', mode: 'عادي',
    }).verdict.sentences[0];
    ok('C-3 audit excerpts are capped at exactly 200 Unicode characters when input is longer',
      Array.from(longAudit.before || '').length === 200
        && Array.from(longAudit.after || '').length === 200, JSON.stringify(longAudit));

    const auditMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'drop-destructive-before-after-audit',
      transform: (source) => source.replace(
        /      \.\.\.\(DESTRUCTIVE_ACTIONS\.has\(item\.action\) \? \{\r?\n        before: auditExcerpt\(item\.input\),\r?\n        after: auditExcerpt\(item\.output\),\r?\n      \} : \{\}\),/u,
        '      // mutant: destructive action text disappears from the verdict'),
      survives: (mutantModule) => (fixture.c3?.cases || [])
        .every((test) => c3CasePasses(mutantModule, test)),
    });
    ok('C-3 audit mutant seam applied', auditMutant.changed, auditMutant.error);
    ok('C-3 audit mutant module loaded successfully', auditMutant.loaded, auditMutant.error);
    ok('MUTANT KILLED: destructive verdict actions cannot drop before/after',
      auditMutant.loaded && auditMutant.survived === false, JSON.stringify(auditMutant));
    ok('the pure reviewer made zero network calls', wireCalls === 0, String(wireCalls));
  } catch (error) {
    fail++;
    console.error('GUARD ERROR:', error && error.stack ? error.stack : error);
  }
  console.log(`SUMMARY PASS=${pass} FAIL=${fail}`);
  process.exit(fail ? 1 : 0);
})();
