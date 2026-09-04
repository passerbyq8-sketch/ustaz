// guards/output-reviewer-matrix-guard.cjs — the six required pure reviewer cases.
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { runMutant } = require('./output-reviewer-mutant-lib.cjs');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'fixtures', 'output-reviewer-six-cases.json');
const REVIEWER = path.join(ROOT, 'lib', 'output-reviewer.js');
const REVIEWER_REPO_PATH = 'lib/output-reviewer.js';
const REPOSITORY_SCAN_IGNORES = new Set(['.git', 'node_modules']);

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

const repoPath = (absolute) => path.relative(ROOT, absolute).split(path.sep).join('/');
function repositoryFiles(directory = ROOT) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = repoPath(absolute);
    if (entry.isDirectory()) {
      if (!REPOSITORY_SCAN_IGNORES.has(entry.name)) files.push(...repositoryFiles(absolute));
    } else if (entry.isFile() && relative !== '.git') {
      files.push({ absolute, relative });
    }
  }
  return files;
}

function verbatimMarkerCopies(files, markerSets) {
  const signatures = markerSets.map((markerSet) => markerSet.toString());
  const copies = [];
  for (const file of files) {
    if (file.relative === REVIEWER_REPO_PATH) continue;
    const bytes = file.text === undefined ? fs.readFileSync(file.absolute) : Buffer.from(file.text);
    if (bytes.includes(0)) continue;
    const text = file.text === undefined ? bytes.toString('utf8') : file.text;
    signatures.forEach((signature, markerSet) => {
      if (text.includes(signature)) copies.push({ path: file.relative, markerSet });
    });
  }
  return copies;
}

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
    const markerSets = [module.KHILAF_PROSE_MARKERS, module.KHILAF_SOURCE_MARKERS];
    ok('reviewer exports distinct broad-prose and narrow-source marker sets',
      markerSets.every((markerSet) => markerSet instanceof RegExp)
        && markerSets[0].toString() !== markerSets[1].toString());
    const syntheticCopies = verbatimMarkerCopies([
      { relative: 'arbitrary/copied-markers.js', text: markerSets[0].toString() },
    ], markerSets);
    ok('marker-family guard rejects a verbatim copy at an arbitrary repository path',
      syntheticCopies.length === 1 && syntheticCopies[0].path === 'arbitrary/copied-markers.js',
      JSON.stringify(syntheticCopies));
    // No CC-tool exception is carried here: that file is absent on this branch. If its stale copy
    // is merged, this scan must fail until the tool imports these exported marker sets.
    const repositoryCopies = verbatimMarkerCopies(repositoryFiles(), markerSets);
    ok('no repository file outside the reviewer carries a verbatim khilaf marker-set copy',
      repositoryCopies.length === 0, JSON.stringify(repositoryCopies));

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

    ok('FIX-C-1 fixture carries truncated, complete, and unknown completion states',
      Array.isArray(fixture.c1?.cases) && fixture.c1.cases.length === 3);
    const c1CasePasses = (mod, test) => {
      const result = mod.reviewAnswer(test.input);
      return occurrences(result.text, fixture.c2.tail) === test.expect.tailCount
        && occurrences(result.text, mod.REVIEW_TAGS.FIQH_UNSOURCED) === test.expect.noticeCount
        && result.verdict.answerFooterSuppressedReason === test.expect.reason
        && (!test.expect.exactInput || result.text === test.input.text);
    };
    for (const test of fixture.c1?.cases || []) {
      const result = module.reviewAnswer(test.input);
      ok(test.id + ': answer footer follows the exact three-state truncation contract',
        c1CasePasses(module, test), JSON.stringify({
          text: result.text,
          reason: result.verdict.answerFooterSuppressedReason,
        }));
    }

    const truncatedFooterMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'append-answer-footer-on-truncated',
      transform: (source) => source.replace(
        '  const suppressAnswerFooter = truncated === true; // TRUNCATION_IS_STRICTLY_TRUE',
        '  const suppressAnswerFooter = false; // mutant: claim completion on truncated output'),
      survives: (mutantModule) => (fixture.c1?.cases || [])
        .every((test) => c1CasePasses(mutantModule, test)),
    });
    ok('FIX-C-1 append-footer-on-truncated mutant seam applied',
      truncatedFooterMutant.changed, truncatedFooterMutant.error);
    ok('FIX-C-1 append-footer-on-truncated mutant module loaded',
      truncatedFooterMutant.loaded, truncatedFooterMutant.error);
    ok('MUTANT KILLED: truncated output cannot receive a completion footer',
      truncatedFooterMutant.loaded && truncatedFooterMutant.survived === false,
      JSON.stringify(truncatedFooterMutant));

    const unknownFooterMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'suppress-answer-footer-when-truncation-unknown',
      transform: (source) => source.replace(
        '  const suppressAnswerFooter = truncated === true; // TRUNCATION_IS_STRICTLY_TRUE',
        '  const suppressAnswerFooter = truncated !== false; // mutant: unknown means suppress'),
      survives: (mutantModule) => (fixture.c1?.cases || [])
        .every((test) => c1CasePasses(mutantModule, test)),
    });
    ok('FIX-C-1 suppress-footer-on-unknown mutant seam applied',
      unknownFooterMutant.changed, unknownFooterMutant.error);
    ok('FIX-C-1 suppress-footer-on-unknown mutant module loaded',
      unknownFooterMutant.loaded, unknownFooterMutant.error);
    ok('MUTANT KILLED: unknown truncation retains today\'s answer footer',
      unknownFooterMutant.loaded && unknownFooterMutant.survived === false,
      JSON.stringify(unknownFooterMutant));

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

    const exportedMarkerCorpus = fixture.b2b?.exportedMarkerCorpus;
    const exportedMarkerCases = exportedMarkerCorpus?.cases || [];
    const withoutArabicDiacritics = (value) => String(value ?? '')
      .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu, '');
    const exportedMarkerCorpusPasses = (mod) => {
      const observations = exportedMarkerCases.map((test) =>
        mod.KHILAF_PROSE_MARKERS.test(withoutArabicDiacritics(test.text)));
      return observations.filter(Boolean).length === exportedMarkerCorpus.expectedBoundedHits
        && observations.every((actual, index) => actual === exportedMarkerCases[index].expect);
    };
    ok('D-1 exported-marker witness carries all twenty deposited X-Ray answers',
      exportedMarkerCases.length === 20
        && exportedMarkerCorpus.expectedRawHits === 11
        && exportedMarkerCorpus.expectedBoundedHits === 10);
    ok('D-1 importer receives the bounded detector and observes ten hits, not eleven',
      exportedMarkerCorpusPasses(module));
    ok('D-1 optional conjunction is accepted while Arabic-letter adhesion is rejected',
      exportedMarkerCases[12]?.expect === true
        && exportedMarkerCases[19]?.expect === false
        && module.KHILAF_PROSE_MARKERS.test(withoutArabicDiacritics(exportedMarkerCases[12]?.text))
        && !module.KHILAF_PROSE_MARKERS.test(withoutArabicDiacritics(exportedMarkerCases[19]?.text)));

    const d1 = fixture.d1;
    const d1Test = (mod, text) => mod.KHILAF_PROSE_MARKERS.test(withoutArabicDiacritics(text));
    ok('D-1 records the measured 8-to-10 corpus delta and exactly two new deposited hits',
      d1?.beforeHits === 8 && d1.afterHits === 10
        && Array.isArray(d1.newHits) && d1.newHits.length === 2
        && JSON.stringify(d1.newHits.map((test) => test.id))
          === JSON.stringify(['xray-answer-04', 'xray-answer-17']));
    ok('D-1 deposits the exact text of both newly detected answer-level witnesses',
      d1.newHits.every((test) => d1Test(module, test.text))
        && d1.newHits.every((test) => exportedMarkerCases
          .some((candidate) => candidate.id === test.id && candidate.text === test.text && candidate.expect === true)));
    for (const test of d1.positive || []) {
      ok('D-1 ' + test.id + ': construct form is detected at the Arabic boundary',
        d1Test(module, test.text));
    }
    for (const test of d1.negative || []) {
      ok('D-1 ' + test.id + ': Arabic adhesion is not a khilaf marker',
        !d1Test(module, test.text));
    }

    let priorHitCount = null;
    const priorArticleMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'idafa-requires-definite-article-again',
      transform: (source) => source.replace(
        '(?:ال)?راجح|(?:ال)?جمهور',
        'الراجح|الجمهور'),
      survives: (mutantModule) => {
        priorHitCount = exportedMarkerCases.filter((test) =>
          d1Test(mutantModule, test.text)).length;
        return exportedMarkerCorpusPasses(mutantModule);
      },
    });
    ok('D-1 prior-article mutant seam applied and module loaded',
      priorArticleMutant.changed && priorArticleMutant.loaded, priorArticleMutant.error);
    ok('D-1 prior-article mutant reproduces the measured eight-hit baseline',
      priorHitCount === d1.beforeHits, String(priorHitCount));
    ok('MUTANT KILLED: construct-state khilaf nouns cannot require the article again',
      priorArticleMutant.loaded && priorArticleMutant.survived === false,
      JSON.stringify(priorArticleMutant));

    const unboundedIdafaMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'idafa-loses-arabic-boundary',
      transform: (source) => source.replace(
        "  `(?<![\\\\p{Script=Arabic}\\\\p{M}])(?:[وف])?(?:${RAW_KHILAF_PROSE_MARKERS.source})(?![\\\\p{Script=Arabic}\\\\p{M}])`,",
        "  `(?:${RAW_KHILAF_PROSE_MARKERS.source})`, // mutant: idafa has no Arabic boundary"),
      survives: (mutantModule) => (d1.negative || []).every((test) => !d1Test(mutantModule, test.text)),
    });
    ok('D-1 unbounded-idafa mutant seam applied and module loaded',
      unboundedIdafaMutant.changed && unboundedIdafaMutant.loaded, unboundedIdafaMutant.error);
    ok('MUTANT KILLED: construct-state form cannot lose the Arabic boundary',
      unboundedIdafaMutant.loaded && unboundedIdafaMutant.survived === false,
      JSON.stringify(unboundedIdafaMutant));

    let rawExportHitCount = null;
    const rawExportMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'exports-raw-khilaf-vocabulary',
      transform: (source) => source.replace(
        'export const KHILAF_PROSE_MARKERS = new RegExp(',
        'export const KHILAF_PROSE_MARKERS = RAW_KHILAF_PROSE_MARKERS; // mutant: raw export\nconst UNUSED_BOUNDED_KHILAF_PROSE_MARKERS = new RegExp('),
      survives: (mutantModule) => {
        rawExportHitCount = exportedMarkerCases.filter((test) =>
          mutantModule.KHILAF_PROSE_MARKERS.test(withoutArabicDiacritics(test.text))).length;
        return exportedMarkerCorpusPasses(mutantModule);
      },
    });
    ok('D-1 raw-export mutant seam applied and module loaded',
      rawExportMutant.changed && rawExportMutant.loaded, rawExportMutant.error);
    ok('D-1 raw-export mutant reproduces the measured eleventh hit',
      rawExportHitCount === exportedMarkerCorpus.expectedRawHits, String(rawExportHitCount));
    ok('MUTANT KILLED: exported khilaf prose surface cannot regress to raw vocabulary',
      rawExportMutant.loaded && rawExportMutant.survived === false,
      JSON.stringify(rawExportMutant));

    const narrowedProseMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'prose-trigger-narrows-again',
      transform: (source) => source.replace(
        "  return KHILAF_PROSE_MARKERS.test(withoutDiacritics); // MODEL_PROSE_KHILAF_BROAD_BOUNDED",
        "  return KHILAF_SOURCE_MARKERS.test(normalizeArabic(sentence)); // mutant: prose narrows again"),
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
        '    if (khilafTrigger && !output.some((chunk) => chunk.includes(KHILAF_TAIL.trim()))) {\n      notices.push(KHILAF_TAIL.trim());\n    }',
        '    if (khilafFromSource) notices.push(KHILAF_TAIL.trim());\n    if (normalizedKhilafFromOpinions === true) notices.push(KHILAF_TAIL.trim());\n    if (khilafFromModelProse) notices.push(KHILAF_TAIL.trim()); // mutant: one tail per trigger'),
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

    const quantityMeasurement = fixture.b3a?.quantityMeasurement;
    ok('FIX-C-2 records the answer-only quantity measurement and numeric retirement decision',
      quantityMeasurement?.priorMixedBlocks === 230
        && quantityMeasurement.priorAnswerBlocksAfterQuestionExclusion === 140
        && quantityMeasurement.set2AnswerBlocks === 11
        && quantityMeasurement.totalAnswerBlocks === 151
        && quantityMeasurement.truePositives === 1
        && quantityMeasurement.falsePositives === 3
        && quantityMeasurement.falsePositives > quantityMeasurement.truePositives
        && quantityMeasurement.decision === 'retired'
        && Array.isArray(quantityMeasurement.falsePositiveIds)
        && quantityMeasurement.falsePositiveIds.length === 3,
      JSON.stringify(quantityMeasurement));
    const quantityPositive = module.reviewAnswer(quantityMeasurement.positive.input);
    ok('FIX-C-2 deposits the new real quantity hit while the rejected shape stays absent',
      quantityPositive.verdict.selfContradiction?.detected === false
        && quantityPositive.text.includes(quantityMeasurement.positive.input.text),
      JSON.stringify(quantityPositive.verdict.selfContradiction));

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

    // -- AA-64: THE SOURCE IS NAMED ONCE, AND THE RICHER NAMING IS THE ONE THAT LIVES --------
    //
    // `sourceTail` welds a source line onto a sentence the reviewer has just kept, and it welds
    // it beside a card head that already draws the same title (api/ask.js buildSourceTag /
    // buildBookTag, selected later by pickReaderCards). Its only guard against repeating itself
    // compared the URL and the DATE -- never the title -- so a sentence that already named its
    // source got a second naming welded on, under a card head carrying a third.
    //
    // Three fixtures, and the middle one is the one that matters most: an answer whose sentence
    // names nothing must come out with the tail it always had, byte for byte. A reader must
    // never lose the only mention he had.
    const AA64_TITLE = '\u0637\u0642\u0633 \u0627\u0644\u0643\u0648\u064a\u062a \u0627\u0644\u064a\u0648\u0645';
    const AA64_URL = 'https://weather.example/kuwait/2026-08-16';
    const AA64_DATE = '2026-08-16';
    const AA64_SENTENCE = '\u062f\u0631\u062c\u0629 \u0627\u0644\u062d\u0631\u0627\u0631\u0629 \u0627\u0644\u064a\u0648\u0645 \u0641\u064a \u0627\u0644\u0643\u0648\u064a\u062a 38 \u0645\u0626\u0648\u064a\u0629.';
    // the same sentence, with the source named inside it: "..., from <title>."
    const AA64_NAMES_IT = '\u062f\u0631\u062c\u0629 \u0627\u0644\u062d\u0631\u0627\u0631\u0629 \u0627\u0644\u064a\u0648\u0645 \u0641\u064a \u0627\u0644\u0643\u0648\u064a\u062a 38 \u0645\u0626\u0648\u064a\u0629\u060c \u0645\u0646 ' + AA64_TITLE + '.';
    // and again with a qualifier the card head does not carry: "... in its morning bulletin."
    const AA64_RICHER = AA64_NAMES_IT.slice(0, -1) + ' \u0641\u064a \u0646\u0634\u0631\u062a\u0647 \u0627\u0644\u0635\u0628\u0627\u062d\u064a\u0629.';
    const AA64_TAIL_HEAD = '\u0627\u0644\u0645\u0635\u062f\u0631: ';
    const AA64_SEP = ' \u2014 ';
    const AA64_EVIDENCE = [{
      id: 'weather-20260816',
      title: AA64_TITLE,
      url: AA64_URL,
      scholar: '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0623\u0631\u0635\u0627\u062f \u0627\u0644\u062c\u0648\u064a\u0629',
      snippet: AA64_SENTENCE,
      date: AA64_DATE,
    }];
    const aa64Review = (mod, text) => mod.reviewAnswer({
      text, evidence: AA64_EVIDENCE, domain: 'general', mode: '\u0639\u0627\u062f\u064a',
    });

    const aa64Named = aa64Review(module, AA64_NAMES_IT);
    ok('AA-64: a sentence that already names its source is not made to name it twice',
      occurrences(aa64Named.text, AA64_TITLE) === 1, JSON.stringify(aa64Named.text));
    ok('AA-64: ...and the page and the date, which the sentence did NOT carry, still arrive',
      aa64Named.text === AA64_NAMES_IT + '\n' + AA64_TAIL_HEAD + AA64_URL + AA64_SEP + AA64_DATE,
      JSON.stringify(aa64Named.text));

    const aa64Plain = aa64Review(module, AA64_SENTENCE);
    ok('AA-64 NEGATIVE: a sentence that names nothing keeps the whole tail, byte for byte',
      aa64Plain.text === AA64_SENTENCE + '\n' + AA64_TAIL_HEAD + AA64_TITLE + AA64_SEP + AA64_URL + AA64_SEP + AA64_DATE,
      JSON.stringify(aa64Plain.text));

    const aa64Richer = aa64Review(module, AA64_RICHER);
    ok('AA-64: a naming richer than the head keeps its extra, and still names the source once',
      aa64Richer.text === AA64_RICHER + '\n' + AA64_TAIL_HEAD + AA64_URL + AA64_SEP + AA64_DATE
        && aa64Richer.text.includes('\u0641\u064a \u0646\u0634\u0631\u062a\u0647 \u0627\u0644\u0635\u0628\u0627\u062d\u064a\u0629')
        && occurrences(aa64Richer.text, AA64_TITLE) === 1,
      JSON.stringify(aa64Richer.text));

    const aa64Mutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'aa64-duplicate-naming-revived',
      transform: (source) => source.replace(
        '  if (!named) parts.push(label);',
        '  parts.push(label); // mutant: the title is welded on whatever the sentence already said'),
      survives: (mutantModule) => occurrences(aa64Review(mutantModule, AA64_NAMES_IT).text, AA64_TITLE) === 1,
    });
    ok('AA-64 mutant seam applied', aa64Mutant.changed, aa64Mutant.error);
    ok('AA-64 mutant module loaded successfully', aa64Mutant.loaded, aa64Mutant.error);
    ok('MUTANT KILLED: the duplicate naming cannot come back',
      aa64Mutant.loaded && aa64Mutant.survived === false, JSON.stringify(aa64Mutant));

    ok('the pure reviewer made zero network calls', wireCalls === 0, String(wireCalls));
  } catch (error) {
    fail++;
    console.error('GUARD ERROR:', error && error.stack ? error.stack : error);
  }
  console.log(`SUMMARY PASS=${pass} FAIL=${fail}`);
  process.exit(fail ? 1 : 0);
})();
