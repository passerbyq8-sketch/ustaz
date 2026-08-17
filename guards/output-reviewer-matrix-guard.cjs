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

    ok('A-2 fixture carries the literal regression, all quote styles, fallback, and controls',
      Array.isArray(fixture.a2?.cases) && fixture.a2.cases.length === 7);
    const a2CasePasses = (mod, test) => {
      const result = mod.reviewAnswer(test.input);
      const tag = mod.REVIEW_TAGS.ATTRIBUTION_REMOVED;
      return result.text === test.expect.body + ' ' + tag
        && occurrences(result.text, tag) === 1
        && JSON.stringify(result.annotations.map((item) => item.action))
          === JSON.stringify(test.expect.actions);
    };
    for (const test of fixture.a2?.cases || []) {
      const result = module.reviewAnswer(test.input);
      const tag = module.REVIEW_TAGS.ATTRIBUTION_REMOVED;
      ok(test.id + ': quoted prose stays contiguous and the tag remains last',
        a2CasePasses(module, test), result.text);
      ok(test.id + ': review remains exactly one sentence with the expected action',
        result.annotations.length === 1
          && JSON.stringify(result.annotations.map((item) => item.action))
            === JSON.stringify(test.expect.actions), JSON.stringify(result.annotations));
      if (test.expect.close) {
        ok(test.id + ': the tag is after the closing quote',
          result.text.lastIndexOf(test.expect.close) < result.text.indexOf(tag), result.text);
      } else if (test.expect.unclosed) {
        ok(test.id + ': an unclosed quote keeps its tag at the part end',
          result.text.endsWith(tag) && occurrences(result.text, tag) === 1, result.text);
      }
    }

    const tagPlacementMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'tag-inside-open-quote',
      transform: (source) => source.replace(
        '    if (SENTENCE_STOP_RE.test(char) && !hasOpenQuote(quoteState)) safeAt = index + 1;',
        '    if (SENTENCE_STOP_RE.test(char)) safeAt = index + 1; // mutant: tag inside an open quote'),
      survives: (mutantModule) => (fixture.a2?.cases || [])
        .every((test) => a2CasePasses(mutantModule, test)),
    });
    ok('A-2 tag-inside-open-quote mutant seam applied',
      tagPlacementMutant.changed, tagPlacementMutant.error);
    ok('A-2 tag-inside-open-quote mutant module loaded',
      tagPlacementMutant.loaded, tagPlacementMutant.error);
    ok('MUTANT KILLED: a sentence tag cannot land inside an open quote',
      tagPlacementMutant.loaded && tagPlacementMutant.survived === false,
      JSON.stringify(tagPlacementMutant));

    const sentenceSplitMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'split-sentence-inside-quote',
      transform: (source) => source.replace(
        '    if (hasOpenQuote(quoteState)) continue; // QUOTE_AWARE_SENTENCE_BOUNDARY',
        '    if (false && hasOpenQuote(quoteState)) continue; // mutant: split inside a quote'),
      survives: (mutantModule) => (fixture.a2?.cases || [])
        .every((test) => a2CasePasses(mutantModule, test)),
    });
    ok('A-2 split-sentence-inside-quote mutant seam applied',
      sentenceSplitMutant.changed, sentenceSplitMutant.error);
    ok('A-2 split-sentence-inside-quote mutant module loaded',
      sentenceSplitMutant.loaded, sentenceSplitMutant.error);
    ok('MUTANT KILLED: quoted punctuation cannot become a sentence boundary',
      sentenceSplitMutant.loaded && sentenceSplitMutant.survived === false,
      JSON.stringify(sentenceSplitMutant));

    const droppedTagMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'drop-tag-when-no-safe-slot',
      transform: (source) => source.replace(
        '  if (hasOpenQuote(quoteState)) return value.length; // KEEP_TAG_AT_UNCLOSED_PART_END',
        '  if (hasOpenQuote(quoteState)) return -1; // mutant: drop tag when no safe slot exists'),
      survives: (mutantModule) => (fixture.a2?.cases || [])
        .every((test) => a2CasePasses(mutantModule, test)),
    });
    ok('A-2 drop-tag-when-no-safe-slot mutant seam applied',
      droppedTagMutant.changed, droppedTagMutant.error);
    ok('A-2 drop-tag-when-no-safe-slot mutant module loaded',
      droppedTagMutant.loaded, droppedTagMutant.error);
    ok('MUTANT KILLED: an unclosed quote cannot make the tag disappear',
      droppedTagMutant.loaded && droppedTagMutant.survived === false,
      JSON.stringify(droppedTagMutant));

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

    ok('B-2 fixture carries the six required source/opinion/prose witnesses',
      Array.isArray(fixture.b2?.cases) && fixture.b2.cases.length === 6);
    const b2CasePasses = (mod, test) => {
      const result = mod.reviewAnswer(test.input);
      return occurrences(result.text, fixture.c2.tail) === test.expect.tailCount
        && result.verdict.khilafTrigger === test.expect.trigger
        && result.verdict.khilafFromSource === test.expect.fromSource
        && result.verdict.khilafFromOpinions === test.expect.fromOpinions
        && result.verdict.khilafFromModelProse === test.expect.fromModelProse
        && result.verdict.opinionCount === test.expect.opinionCount;
    };
    for (const test of fixture.b2?.cases || []) {
      const result = module.reviewAnswer(test.input);
      ok(test.id + ': tail count and verdict provenance are exact',
        b2CasePasses(module, test), JSON.stringify({
          tailCount: occurrences(result.text, fixture.c2.tail),
          trigger: result.verdict.khilafTrigger,
          fromSource: result.verdict.khilafFromSource,
          fromOpinions: result.verdict.khilafFromOpinions,
          fromModelProse: result.verdict.khilafFromModelProse,
          opinionCount: result.verdict.opinionCount,
        }));
    }

    ok('B-2 fixture measures four explicit and four weak source constructions',
      Array.isArray(fixture.b2?.markerCases) && fixture.b2.markerCases.length === 8);
    const markerBase = fixture.b2.cases[0].input;
    for (const test of fixture.b2?.markerCases || []) {
      const result = module.reviewAnswer({
        ...markerBase,
        evidence: [{ id: test.id, snippet: test.snippet }],
      });
      ok(test.id + ': source construction classification is exact',
        result.verdict.khilafFromSource === test.expect
          && occurrences(result.text, fixture.c2.tail) === (test.expect ? 1 : 0),
        JSON.stringify(result.verdict));
    }

    ok('B-2c fixture carries four trigger-priority witnesses, three restored words, and one boundary control',
      Array.isArray(fixture.b2b?.cases) && fixture.b2b.cases.length === 8);
    const b2bCasePasses = (mod, test) => {
      const result = mod.reviewAnswer(test.input);
      return occurrences(result.text, fixture.c2.tail) === test.expect.tailCount
        && result.verdict.khilafTrigger === test.expect.trigger
        && result.verdict.khilafFromSource === test.expect.fromSource
        && result.verdict.khilafFromOpinions === test.expect.fromOpinions
        && result.verdict.khilafFromModelProse === test.expect.fromModelProse
        && result.verdict.opinionCount === test.expect.opinionCount;
    };
    for (const test of fixture.b2b?.cases || []) {
      const result = module.reviewAnswer(test.input);
      ok(test.id + ': one-tail count and named trigger priority are exact',
        b2bCasePasses(module, test), JSON.stringify({
          tailCount: occurrences(result.text, fixture.c2.tail),
          trigger: result.verdict.khilafTrigger,
          fromSource: result.verdict.khilafFromSource,
          fromOpinions: result.verdict.khilafFromOpinions,
          fromModelProse: result.verdict.khilafFromModelProse,
          opinionCount: result.verdict.opinionCount,
        }));
    }

    const narrowedProseMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'prose-trigger-narrows-again',
      transform: (source) => source.replace(
        "  return BOUNDED_KHILAF_PROSE_MARKERS.test(withoutDiacritics); // MODEL_PROSE_KHILAF_BROAD_BOUNDED",
        "  return KHILAF_MARKERS.test(normalizeArabic(sentence)); // mutant: prose narrows again"),
      survives: (mutantModule) => (fixture.b2b?.cases || [])
        .every((test) => b2bCasePasses(mutantModule, test)),
    });
    ok('B-2c prose-trigger-narrows-again mutant seam applied',
      narrowedProseMutant.changed, narrowedProseMutant.error);
    ok('B-2c prose-trigger-narrows-again mutant module loaded',
      narrowedProseMutant.loaded, narrowedProseMutant.error);
    ok('MUTANT KILLED: prose cannot lose the restored production vocabulary',
      narrowedProseMutant.loaded && narrowedProseMutant.survived === false,
      JSON.stringify(narrowedProseMutant));

    const proseShadowMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'prose-shadows-the-evidence-trigger',
      transform: (source) => source.replace(
        "  if (khilafFromSource && khilafFromOpinions === true) return 'both';",
        "  if (khilafFromModelProse) return 'prose'; // mutant: prose shadows evidence\n  if (khilafFromSource && khilafFromOpinions === true) return 'both';"),
      survives: (mutantModule) => (fixture.b2b?.cases || [])
        .every((test) => b2bCasePasses(mutantModule, test)),
    });
    ok('B-2b prose-shadows-the-evidence-trigger mutant seam applied',
      proseShadowMutant.changed, proseShadowMutant.error);
    ok('B-2b prose-shadows-the-evidence-trigger mutant module loaded',
      proseShadowMutant.loaded, proseShadowMutant.error);
    ok('MUTANT KILLED: evidence retains trigger naming priority over prose',
      proseShadowMutant.loaded && proseShadowMutant.survived === false,
      JSON.stringify(proseShadowMutant));

    const wholePageMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'khilaf-scan-whole-page',
      transform: (source) => source.replace(
        '  return evidence.snippet; // KHILAF_EXCERPT_ONLY',
        "  return Object.values(evidence.raw || {}).filter((value) => typeof value === 'string').join(' '); // mutant: scan whole page"),
      survives: (mutantModule) => (fixture.b2?.cases || [])
        .every((test) => b2CasePasses(mutantModule, test)),
    });
    ok('B-2 khilaf-scan-whole-page mutant seam applied',
      wholePageMutant.changed, wholePageMutant.error);
    ok('B-2 khilaf-scan-whole-page mutant module loaded',
      wholePageMutant.loaded, wholePageMutant.error);
    ok('MUTANT KILLED: page text outside the supporting excerpt cannot trigger',
      wholePageMutant.loaded && wholePageMutant.survived === false,
      JSON.stringify(wholePageMutant));

    const absentOpinionsMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'khilaf-guess-opinions-when-absent',
      transform: (source) => source.replace(
        '    ? true : khilafFromOpinions === false ? false : null; // PRESERVE_ABSENT_OPINIONS',
        '    ? true : khilafFromOpinions === false ? false : false; // mutant: absence guessed false'),
      survives: (mutantModule) => (fixture.b2?.cases || [])
        .every((test) => b2CasePasses(mutantModule, test)),
    });
    ok('B-2 khilaf-guess-opinions-when-absent mutant seam applied',
      absentOpinionsMutant.changed, absentOpinionsMutant.error);
    ok('B-2 khilaf-guess-opinions-when-absent mutant module loaded',
      absentOpinionsMutant.loaded, absentOpinionsMutant.error);
    ok('MUTANT KILLED: missing opinion metadata remains null without muting source evidence',
      absentOpinionsMutant.loaded && absentOpinionsMutant.survived === false,
      JSON.stringify(absentOpinionsMutant));

    const threeTailMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'three-triggers-three-tails',
      transform: (source) => source.replace(
        '  if (khilafTrigger && !output.some((chunk) => chunk.includes(KHILAF_TAIL.trim()))) {\n    notices.push(KHILAF_TAIL.trim());\n  }',
        '  if (khilafFromSource) notices.push(KHILAF_TAIL.trim());\n  if (normalizedKhilafFromOpinions === true) notices.push(KHILAF_TAIL.trim());\n  if (khilafFromModelProse) notices.push(KHILAF_TAIL.trim()); // mutant: one tail per trigger'),
      survives: (mutantModule) => (fixture.b2b?.cases || [])
        .every((test) => b2bCasePasses(mutantModule, test)),
    });
    ok('B-2b three-triggers-three-tails mutant seam applied',
      threeTailMutant.changed, threeTailMutant.error);
    ok('B-2b three-triggers-three-tails mutant module loaded',
      threeTailMutant.loaded, threeTailMutant.error);
    ok('MUTANT KILLED: three true triggers still produce one answer-level tail',
      threeTailMutant.loaded && threeTailMutant.survived === false,
      JSON.stringify(threeTailMutant));

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

    const emptySelfContradiction = {
      detected: false, shape: null, first: null, later: null, at: null,
    };
    const selfContradictionKeys = ['at', 'detected', 'first', 'later', 'shape'];
    const b3ExpectedText = new Map();
    ok('B-3A fixture carries the two surviving contradiction witnesses',
      Array.isArray(fixture.b3a?.positives) && fixture.b3a.positives.length === 2);
    for (const test of fixture.b3a?.positives || []) {
      const result = module.reviewAnswer(test.input);
      const finding = result.verdict.selfContradiction;
      b3ExpectedText.set(test.id, result.text);
      ok(test.id + ': detector reports the measured shape',
        finding?.detected === true && finding.shape === test.expect.shape,
        JSON.stringify(finding));
      ok(test.id + ': first/later excerpts name the deposited clauses',
        finding?.first?.includes(test.expect.firstContains)
          && finding?.later?.includes(test.expect.laterContains), JSON.stringify(finding));
      ok(test.id + ': part ordinals are an increasing integer pair',
        Array.isArray(finding?.at) && finding.at.length === 2
          && finding.at.every(Number.isInteger) && finding.at[0] < finding.at[1],
        JSON.stringify(finding));
      ok(test.id + ': both audit excerpts are capped at 200 Unicode points',
        Array.from(finding?.first || '').length <= 200
          && Array.from(finding?.later || '').length <= 200, JSON.stringify(finding));
      ok(test.id + ': detection leaves every deposited character in reader text',
        result.text.includes(test.input.text), result.text);
    }

    ok('B-3A fixture carries every mandatory differentiated negative and the struck quantity witness',
      Array.isArray(fixture.b3a?.negatives) && fixture.b3a.negatives.length === 5);
    for (const test of fixture.b3a?.negatives || []) {
      const result = module.reviewAnswer(test.input);
      const finding = result.verdict.selfContradiction;
      b3ExpectedText.set(test.id, result.text);
      ok(test.id + ': differentiation is not reported as contradiction',
        Object.hasOwn(result.verdict, 'selfContradiction')
          && JSON.stringify(finding) === JSON.stringify(emptySelfContradiction),
        JSON.stringify(finding));
      ok(test.id + ': the present false field has the exact stable schema',
        JSON.stringify(Object.keys(finding || {}).sort()) === JSON.stringify(selfContradictionKeys),
        JSON.stringify(finding));
      ok(test.id + ': a negative finding still leaves reader text untouched',
        result.text.includes(test.input.text), result.text);
    }

    const longSelfContradiction = module.reviewAnswer({
      text: 'وضوؤك صحيح ' + 'والحكم متعلق بالوضوء نفسه دون غيره '.repeat(12) + '. '
        + 'وضوؤك باطل ' + 'والحكم متعلق بالوضوء نفسه دون غيره '.repeat(12) + '.',
      evidence: [], domain: 'fiqh', mode: 'audit',
    }).verdict.selfContradiction;
    ok('B-3A long contradiction clips first and later at exactly 200 Unicode points',
      longSelfContradiction.detected
        && Array.from(longSelfContradiction.first).length === 200
        && Array.from(longSelfContradiction.later).length === 200,
      JSON.stringify(longSelfContradiction));

    const b3FixturePasses = (mod) => {
      for (const test of fixture.b3a?.positives || []) {
        const result = mod.reviewAnswer(test.input);
        const finding = result.verdict.selfContradiction;
        if (result.text !== b3ExpectedText.get(test.id)
            || finding?.detected !== true || finding.shape !== test.expect.shape
            || !finding.first?.includes(test.expect.firstContains)
            || !finding.later?.includes(test.expect.laterContains)) return false;
      }
      for (const test of fixture.b3a?.negatives || []) {
        const result = mod.reviewAnswer(test.input);
        if (result.text !== b3ExpectedText.get(test.id)
            || !Object.hasOwn(result.verdict, 'selfContradiction')
            || JSON.stringify(result.verdict.selfContradiction)
              !== JSON.stringify(emptySelfContradiction)) return false;
      }
      return true;
    };
    const printB3Mutant = (name, result) => console.log('MUTANT ' + name
      + ' changed=' + result.changed + ' loaded=' + result.loaded + ' survived=' + result.survived);

    const conditionsMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'contradiction-ignores-conditions',
      transform: (source) => source.replaceAll(
        '      if (differentiatedCase(first, claim)) continue;',
        '      if (false && differentiatedCase(first, claim)) continue; // mutant: ignore differentiated cases'),
      survives: b3FixturePasses,
    });
    printB3Mutant('contradiction-ignores-conditions', conditionsMutant);
    ok('B-3A contradiction-ignores-conditions mutant seam applied',
      conditionsMutant.changed, conditionsMutant.error);
    ok('B-3A contradiction-ignores-conditions mutant module loaded',
      conditionsMutant.loaded, conditionsMutant.error);
    ok('MUTANT KILLED: differentiated cases cannot become contradictions',
      conditionsMutant.loaded && conditionsMutant.survived === false,
      JSON.stringify(conditionsMutant));

    const editsTextMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'contradiction-edits-the-text',
      transform: (source) => source.replace(
        '  return { text: reviewedText, annotations: Object.freeze(annotations), verdict };',
        '  return { text: selfContradiction.detected ? selfContradiction.later : reviewedText, annotations: Object.freeze(annotations), verdict }; // mutant: edit on detection'),
      survives: b3FixturePasses,
    });
    printB3Mutant('contradiction-edits-the-text', editsTextMutant);
    ok('B-3A contradiction-edits-the-text mutant seam applied', editsTextMutant.changed, editsTextMutant.error);
    ok('B-3A contradiction-edits-the-text mutant module loaded', editsTextMutant.loaded, editsTextMutant.error);
    ok('MUTANT KILLED: contradiction measurement cannot edit reader text',
      editsTextMutant.loaded && editsTextMutant.survived === false,
      JSON.stringify(editsTextMutant));

    // String.raw, not a plain template: the captured regexes carry backslash escapes and a
    // cooked template would eat them, leaving a mutant that cannot fire and a guard that
    // reports a kill it never made.
    const QUANTITY_AGAIN = String.raw`
const RESULT_QUANTITY_RE = /(?:^|\s)(?:فالحاصل|فالخلاصه|الخلاصه|اي|عليه|يلزمه|يقوم|ياتي|يتم|اتم|يكمل|قدرها|مقدارها|فتكون|تكون)(?:\s|$)/u;

function quantityClaims(part) {
  const normalized = normalizeArabic(part.text);
  const claims = [];
  const add = (unit, amount) => {
    if (!claims.some((claim) => claim.unit === unit && claim.amount === amount)) {
      claims.push({ ...part, unit, amount });
    }
  };
  if (/(?:^|\s)ركعت(?:ان|ين)(?:\s|$)/u.test(normalized)) add('rakah', 2);
  if (/(?:^|\s)ركعه\s+واحده(?:\s|$)/u.test(normalized)) add('rakah', 1);
  for (const match of normalized.matchAll(/(?:^|\s)(\d+)\s+ركع(?:ه|ات)(?:\s|$)/gu)) {
    add('rakah', Number(match[1]));
  }
  if (/(?:^|\s)نصف\s+صاع(?:\s|$)/u.test(normalized)) add('saa', 0.5);
  if (/(?:^|\s)صاع(?:\s+واحد)?(?:\s|$)/u.test(normalized)
      && !/(?:^|\s)نصف\s+صاع(?:\s|$)/u.test(normalized)) add('saa', 1);
  if (/(?:^|\s)صاع(?:ان|ين)(?:\s|$)/u.test(normalized)) add('saa', 2);
  for (const match of normalized.matchAll(/(?:^|\s)(\d+)\s+اصواع?(?:\s|$)/gu)) {
    add('saa', Number(match[1]));
  }
  return claims;
}

function quantityContradiction(parts) {
  const claims = [];
  for (const part of parts) {
    for (const claim of quantityClaims(part)) {
      for (const first of claims) {
        if (first.unit !== claim.unit || first.amount === claim.amount) continue;
        const framed = RESULT_QUANTITY_RE.test(normalizeArabic(first.scope))
          || RESULT_QUANTITY_RE.test(normalizeArabic(claim.scope));
        if (!framed && !sameContradictionTopic(first, claim)) continue;
        if (differentiatedCase(first, claim)) continue;
        return contradictionFinding('quantity', first, claim);
      }
      claims.push(claim);
    }
  }
  return null;
}
`;
    const quantityBackMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'contradiction-quantity-reintroduced',
      transform: (source) => source
        .replace(
          '    namedAnswerContradiction(parts), // TWO_MEASURED_SHAPES_ONLY',
          '    quantityContradiction(parts),\n    namedAnswerContradiction(parts), // mutant: the struck shape returns')
        .replace(
          'const NO_SELF_CONTRADICTION = Object.freeze({',
          QUANTITY_AGAIN.trim() + '\n\nconst NO_SELF_CONTRADICTION = Object.freeze({'),
      survives: b3FixturePasses,
    });
    printB3Mutant('contradiction-quantity-reintroduced', quantityBackMutant);
    ok('B-3A contradiction-quantity-reintroduced mutant seam applied',
      quantityBackMutant.changed, quantityBackMutant.error);
    ok('B-3A contradiction-quantity-reintroduced mutant module loaded',
      quantityBackMutant.loaded, quantityBackMutant.error);
    ok('MUTANT KILLED: the retired quantity shape cannot come back — it fires on «two, not one»',
      quantityBackMutant.loaded && quantityBackMutant.survived === false,
      JSON.stringify(quantityBackMutant));

    const dropsFieldMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'contradiction-field-dropped',
      transform: (source) => source.replace(
        '    selfContradiction, // SELF_CONTRADICTION_FIELD_ALWAYS_PRESENT',
        '    ...(selfContradiction.detected ? { selfContradiction } : {}), // mutant: silence looks like detector failure'),
      survives: b3FixturePasses,
    });
    printB3Mutant('contradiction-field-dropped', dropsFieldMutant);
    ok('B-3A contradiction-field-dropped mutant seam applied', dropsFieldMutant.changed, dropsFieldMutant.error);
    ok('B-3A contradiction-field-dropped mutant module loaded', dropsFieldMutant.loaded, dropsFieldMutant.error);
    ok('MUTANT KILLED: a clean answer must retain the explicit false field',
      dropsFieldMutant.loaded && dropsFieldMutant.survived === false,
      JSON.stringify(dropsFieldMutant));
    ok('the pure reviewer made zero network calls', wireCalls === 0, String(wireCalls));
  } catch (error) {
    fail++;
    console.error('GUARD ERROR:', error && error.stack ? error.stack : error);
  }
  console.log(`SUMMARY PASS=${pass} FAIL=${fail}`);
  process.exit(fail ? 1 : 0);
})();
