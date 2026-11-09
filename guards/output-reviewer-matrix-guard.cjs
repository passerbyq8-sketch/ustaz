// guards/output-reviewer-matrix-guard.cjs — the six required pure reviewer cases.
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { runMutant } = require('./output-reviewer-mutant-lib.cjs');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'fixtures', 'output-reviewer-six-cases.json');
const IMMUNITY_FIXTURE = path.join(ROOT, 'fixtures', 'output-reviewer-attribution-immunity.json');
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

// ── COUNTING A MARK THAT IS NO LONGER WRITTEN (owner, 18 Sep) ───────────────
//
// Four witnesses below used to count one named review tag in the reviewed text. None of the five
// marks is written any longer, so what is counted here is ALL of them at once, and in every
// spelling: the frozen text, and the diacritic-folded form beside it. The folding is not
// decoration — lib/output-reviewer.js folds the same way for the same reason, because a mark
// welded back with one haraka more than the constant is invisible to an exact-string count, and
// that is exactly how a writer would come back without any of these counts moving.
//
// The tag TEXT is never spelled here. It is read from the module under test, for the reason
// guards/tag-honesty-guard.cjs pins: a hand-typed mark orders shadda and damma the other way
// round, and a guard that retypes one is measuring its own typing. `REVIEW_TAGS` is the source.
const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu;
const foldMarks = (value) => String(value ?? '').replace(ARABIC_DIACRITICS, '');
const reviewTagCount = (mod, text) => Object.values(mod.REVIEW_TAGS).reduce(
  (total, reviewTag) => total + occurrences(foldMarks(text), foldMarks(reviewTag)), 0,
);

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
    // The three-state truncation contract is carried by `tailCount` and `reason`, both of which are
    // about the disagreement tail and are untouched by the removal. `noticeCount` counted the
    // honesty notice that the footer used to carry with it; the fixture now asks for zero marks in
    // all three states, so the clause pins that the footer never brings one back.
    const c1CasePasses = (mod, test) => {
      const result = mod.reviewAnswer(test.input);
      return occurrences(result.text, fixture.c2.tail) === test.expect.tailCount
        && reviewTagCount(mod, result.text) === test.expect.noticeCount
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
    // WHAT THE BODY-PLUS-MARK EQUALITY BECOMES WHEN THE MARK IS NEVER WRITTEN (owner, 18 Sep).
    // `expect.body` in the fixture is, and always was, the whole of what the reader should receive
    // once the unsupported credit comes off. The mark used to follow it; now nothing does, so the
    // equality is against the body alone — which is the stricter statement, since it refuses any
    // appendage at all and not merely a second copy of one particular mark.
    const a2CasePasses = (mod, test) => {
      const result = mod.reviewAnswer(test.input);
      return result.text === test.expect.body
        && reviewTagCount(mod, result.text) === 0
        && JSON.stringify(result.annotations.map((item) => item.action))
          === JSON.stringify(test.expect.actions);
    };
    for (const test of fixture.a2?.cases || []) {
      const result = module.reviewAnswer(test.input);
      ok(test.id + ': quoted prose reaches the reader whole, with nothing welded onto it',
        a2CasePasses(module, test), result.text);
      ok(test.id + ': review remains exactly one sentence with the expected action',
        result.annotations.length === 1
          && JSON.stringify(result.annotations.map((item) => item.action))
            === JSON.stringify(test.expect.actions), JSON.stringify(result.annotations));
      // THE CLOSING-DELIMITER AND UNCLOSED BRANCHES THAT STOOD HERE ARE GONE, AND SAYING SO IS THE
      // POINT. Both asked where the mark sat relative to the quote — «after the closing quote», and
      // «at the part end when the quote never closes». With no mark written, both questions are
      // about a thing that is not in the text. What they were really protecting — that the quoted
      // prose is not split, truncated, or interrupted — is now carried WHOLE by `a2CasePasses`'s
      // exact equality against the fixture body, which is strictly stronger than either of them was
      // and which no placement error can satisfy. `expect.close` and `expect.unclosed` are left in
      // the fixture untouched: they name the shapes, and the shapes are still the seven measured.
    }

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

    // ── THE TWO TAG-PLACEMENT MUTANTS THAT STOOD HERE, AND WHAT REPLACES THEM ──
    //
    // `tag-inside-open-quote` and `drop-tag-when-no-safe-slot` both mutated the inside of
    // `sentenceTagInsertionIndex()` — the locator that walked a sentence past its markup to find a
    // safe slot to weld a mark into. That function was deleted with the writer it served (owner,
    // 18 Sep); both seams report `mutation seam moved`, and there is no line left in the product
    // for either of them to change. A mutant aimed at absent code cannot be killed and cannot be
    // repaired — only replaced by one aimed at the fear that is still real.
    //
    // AND THE FEAR REVERSED WITH THE ORDER. It was «the mark lands in the wrong place, or is lost».
    // It is now «the mark comes back at all». So the mutant below re-welds the sentence mark in the
    // exact branch that used to write it — the one branch that ever wrote one per sentence — and
    // A-2's own seven shapes must kill it. That is what gives the new `reviewTagCount` clause in
    // `a2CasePasses` teeth: without this mutant it would be a clause no measurement could break.
    const reweldMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'weld-the-sentence-mark-back-on',
      // The seam is spelled as lines and joined rather than written with escapes: this block has to
      // match lib/output-reviewer.js byte for byte, indentation included, and an escape that a tool
      // collapses on the way in is a seam that silently matches nothing.
      transform: (source) => source.replace(
        [
          "          const reviewed = generalized || '';",
          '          if (reviewed) {',
          '            output.push(reviewed);',
        ].join('\n'),
        [
          "          const reviewed = generalized || '';",
          '          if (reviewed) {',
          "            output.push(reviewed + ' ' + TAGS.ATTRIBUTION_REMOVED); // mutant: the writer comes back",
        ].join('\n')),
      survives: (mutantModule) => (fixture.a2?.cases || [])
        .every((test) => a2CasePasses(mutantModule, test)),
    });
    ok('A-2 re-weld mutant seam applied', reweldMutant.changed, reweldMutant.error);
    ok('A-2 re-weld mutant module loaded', reweldMutant.loaded, reweldMutant.error);
    ok('MUTANT KILLED: the sentence mark cannot be welded back onto a reviewed sentence',
      reweldMutant.loaded && reweldMutant.survived === false,
      JSON.stringify(reweldMutant));

    ok('C-2 fixture carries the four measured open-structure cases',
      Array.isArray(fixture.c2?.cases) && fixture.c2.cases.length === 4);
    // The tail in `tailCount` is the disagreement tail, which is ALIVE and is what now carries this
    // placement contract end to end: it is the note whose position these four cases measure. The
    // second count was the honesty notice, which is no longer written; the fixture therefore asks
    // for zero of them, and the clause has become the pin on the owner's removal.
    const c2CasePasses = (mod, test) => {
      const result = mod.reviewAnswer(test.input);
      return (test.expect.adjacent || []).every((needle) => result.text.includes(needle))
        && appearsInOrder(result.text, test.expect.ordered || [])
        && occurrences(result.text, fixture.c2.tail) === test.expect.tailCount
        && reviewTagCount(mod, result.text) === test.expect.noticeCount;
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

    // brain35 A-1: the three restored words are retired (null), and a ninth row carries the new vocabulary
    ok('B-2c fixture carries four trigger-priority witnesses, three retired words, one boundary control and one new-vocabulary witness',
      Array.isArray(fixture.b2b?.cases) && fixture.b2b.cases.length === 9);
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
    // brain35 A-1 (2026-11-06, owner: the khilaf warning only for a real contradiction): the prose vocabulary lost
    // الراجح / الجمهور / بعض أهل العلم; the twenty deposited answers now carry 3 bounded hits (07, 08, 15) and 4 raw (+20 «بخلاف»).
    ok('D-1 exported-marker witness carries all twenty deposited X-Ray answers',
      exportedMarkerCases.length === 20
        && exportedMarkerCorpus.expectedRawHits === 4
        && exportedMarkerCorpus.expectedBoundedHits === 3);
    ok('D-1 importer receives the bounded detector and observes three hits, not four',
      exportedMarkerCorpusPasses(module));
    ok('D-1 optional conjunction is accepted while Arabic-letter adhesion is rejected',
      exportedMarkerCases[19]?.expect === false
        && module.KHILAF_PROSE_MARKERS.test(withoutArabicDiacritics('فخلاف أهل العلم'))
        && module.KHILAF_PROSE_MARKERS.test(withoutArabicDiacritics('وأقوال الفقهاء'))
        && !module.KHILAF_PROSE_MARKERS.test(withoutArabicDiacritics(exportedMarkerCases[19]?.text)));

    const d1 = fixture.d1;
    const d1Test = (mod, text) => mod.KHILAF_PROSE_MARKERS.test(withoutArabicDiacritics(text));
    ok('D-1 records the measured 1-to-3 corpus delta and exactly two new deposited hits',
      d1?.beforeHits === 1 && d1.afterHits === 3
        && Array.isArray(d1.newHits) && d1.newHits.length === 2
        && JSON.stringify(d1.newHits.map((test) => test.id))
          === JSON.stringify(['xray-answer-07', 'xray-answer-08']));
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
        'خلاف|اختلف|قولان|أقوال|',
        'الخلاف|اختلف|قولان|الأقوال|'),
      survives: (mutantModule) => {
        priorHitCount = exportedMarkerCases.filter((test) =>
          d1Test(mutantModule, test.text)).length;
        return exportedMarkerCorpusPasses(mutantModule);
      },
    });
    ok('D-1 prior-article mutant seam applied and module loaded',
      priorArticleMutant.changed && priorArticleMutant.loaded, priorArticleMutant.error);
    ok('D-1 prior-article mutant reproduces the measured one-hit baseline',
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
    ok('D-1 raw-export mutant reproduces the measured fourth hit',
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

    // ── TWO RULINGS THAT TOUCHED THE ATTRIBUTION PATH AND HAD NO GUARD ────────
    //
    // `exempt-divine-name` and `kept-attribution-pronoun-tail` both landed on the most dangerous
    // thing in the brain -- who a statement is credited to -- and NEITHER was measured anywhere:
    // removing either one reddened nothing in the whole suite. A repair with no guard is not a
    // kept repair. Each therefore gets a row of its own below.
    //
    // Both rows guard BEHAVIOUR and not source text: each drives the real reviewer through the
    // same public `reviewAnswer` the rows above use, with a case made of its own kind, and reads
    // only what the reviewer returns. No private function is called and no reviewer logic is
    // restated here. The carded evidence is not re-typed either -- it is the very record the
    // matched-attribution case of the six-case fixture already carries, so one card is described
    // in one place and a change to it is felt in both rows.
    const immunity = JSON.parse(fs.readFileSync(IMMUNITY_FIXTURE, 'utf8'));
    ok('attribution-immunity fixture schema is exact',
      immunity.schema === 'ezik.output-reviewer.attribution-immunity.v1', immunity.schema);
    const matchedCase = (fixture.cases || []).find((item) => item.id === 'a-matched-attribution');
    const cardedEvidence = matchedCase && matchedCase.input && matchedCase.input.evidence;
    ok('the carded witness is the six-case fixture own matched-attribution evidence, not a copy',
      Array.isArray(cardedEvidence) && cardedEvidence.length === 1
        && cardedEvidence[0].id === 'binbaz-join-1'
        && cardedEvidence[0].scholar === immunity.pronounTail.cardedName,
      JSON.stringify(cardedEvidence));

    // A verdict sentence carries `before`/`after` only for an action inside DESTRUCTIVE_ACTIONS.
    // A KEEP that arrives carrying that pair is a keep the ledger is reporting to its reader as a
    // cut, which is the second way either of these rulings can be lost without the text changing.
    const recordsAStrike = (sentence) => Object.prototype.hasOwnProperty.call(sentence, 'before')
      || Object.prototype.hasOwnProperty.call(sentence, 'after');

    const divineInput = (witness) => ({
      text: witness.text,
      evidence: [],
      domain: immunity.divineImmunity.domain,
      mode: immunity.divineImmunity.mode,
    });
    const divineImmunityHolds = (mod) => immunity.divineImmunity.cases.every((witness) => {
      const result = mod.reviewAnswer(divineInput(witness));
      const sentences = result.verdict.sentences;
      return result.text === witness.text
        && result.annotations.length === 1
        && result.annotations[0].action === immunity.divineImmunity.expect.action
        && result.annotations[0].claimedAuthority === witness.claimed
        && sentences.length === 1
        && sentences[0].action === immunity.divineImmunity.expect.action
        && !recordsAStrike(sentences[0]);
    });
    ok('a claim whose authority is God is exempt: the sentence stands byte for byte, the verdict is the immunity itself, and no strike is recorded',
      divineImmunityHolds(module),
      JSON.stringify(immunity.divineImmunity.cases.map((witness) => {
        const result = module.reviewAnswer(divineInput(witness));
        return { text: result.text, sentences: result.verdict.sentences };
      })));

    const tail = immunity.pronounTail;
    const tailInput = {
      text: [tail.cardedSentence, tail.unsupportedSentence, tail.tailSentence].join('\n'),
      evidence: cardedEvidence,
      domain: tail.domain,
      mode: tail.mode,
    };
    const pronounTailHolds = (mod) => {
      const result = mod.reviewAnswer(tailInput);
      const actions = result.annotations.map((item) => item.action);
      const kept = result.verdict.sentences[1];
      return result.text === tailInput.text
        && JSON.stringify(actions) === JSON.stringify(tail.expect.actions)
        && result.text.includes(tail.unsupportedName)
        && result.text.includes(tail.cardedName)
        && !actions.includes('removed-unsupported-attribution')
        && !!kept && kept.action === 'kept-attribution-pronoun-tail'
        && !recordsAStrike(kept);
    };
    ok('a credit whose strike would hand its tail to a carded name is withheld: the unsupported name still stands, nothing is cut, and the verdict says it was kept',
      pronounTailHolds(module), JSON.stringify({
        text: module.reviewAnswer(tailInput).text,
        sentences: module.reviewAnswer(tailInput).verdict.sentences,
      }));

    // ── brain35 A-1 (2026-11-06; DIAG 35.8 / PKG-2): ONE SCOPED GATE FOR THE THREE TRIGGERS ──
    // The captured battery texts (fixtures/brain35-khilaf-cases.json, UTF-8 copies of Qnn.text.md fed as H3-khilaf.mjs fed
    // them) and four hand-written controls: the tail only under a topic that allows it and only when the released text
    // sets out two attributed views whose stances differ.
    const khilafCases = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', 'brain35-khilaf-cases.json'), 'utf8'));
    ok('A-1 fixture carries Q39, Q19, Q13, Q08, the four controls, F6 three and X10 one (re-cut 2026-11-07 twice: owner decision R7, three cases; brain35-3 X10, one case)', Array.isArray(khilafCases.cases) && khilafCases.cases.length === 12
      && ['Q39', 'Q19', 'Q13', 'Q08'].every((id) => khilafCases.cases.some((c) => c.id === id)));
    const { classifyTopic } = await import(pathToFileURL(path.join(ROOT, 'lib', 'policy', 'core.js')).href);
    const QT = await import(pathToFileURL(path.join(ROOT, 'lib', 'question-terms.js')).href); // brain35-2 F6: the subject the caller passes
    const khilafCasePasses = (mod, test) => {
      const input = { ...test.input, topic: test.input.topic || classifyTopic(String(test.question || '')), question: test.question || '', subjectTerms: QT.subjectTermsOf(test.question || '') };
      const result = mod.reviewAnswer(input);
      return result.verdict.khilafTrigger === test.expect.trigger
        && occurrences(result.text, fixture.c2.tail) === (test.expect.trigger ? 1 : 0);
    };
    for (const test of khilafCases.cases) {
      const input = { ...test.input, topic: test.input.topic || classifyTopic(String(test.question || '')), question: test.question || '', subjectTerms: QT.subjectTermsOf(test.question || '') };
      const result = module.reviewAnswer(input);
      ok('A-1 ' + test.id + ': khilaf trigger is ' + JSON.stringify(test.expect.trigger) + ' (' + test.note.slice(0, 60) + ')',
        khilafCasePasses(module, test), JSON.stringify({ trigger: result.verdict.khilafTrigger, releasedViews: result.verdict.releasedViews, topic: input.topic }));
    }
    ok('A-1 releasedViewsIn counts three school sections on Q08 and none on Q39/Q19',
      module.releasedViewsIn([khilafCases.cases.find((c) => c.id === 'Q08').input.text]) >= 3
        && module.releasedViewsIn([khilafCases.cases.find((c) => c.id === 'Q39').input.text]) < 2
        && module.releasedViewsIn([khilafCases.cases.find((c) => c.id === 'Q19').input.text]) < 2);
    // ── brain35-2 F6 (2026-11-07; DIAG2 R7; owner: yes) · THE KHILAF VIEW COUNT IS PARTY-LEVEL ON THE QUESTION'S SUBJECT ──
    // MEASURED (DIAG2 R7, P13 «ما حكم الزكاة في الإسلام وهل هي فرض؟»): the tail stood under an agreed ruling, lit by two
    // attributed parties on WHEN zakah was made obligatory. releasedViewsIn now takes the question's stemmed issue terms
    // (subjectTermsOf: lib/question-terms.js issueTerms + stemWord) and counts a party only when at least one of its clauses
    // shares a term with the question -- party-level, never clause-level (clause-level loses Q11's tail, measured in DIAG2
    // HC); with fewer than two issue terms the filter is off. Both call sites pass the question. Fixture re-cut: three cases
    // added (S5 the P13 shape -> null, S6 two parties on the subject in one sentence each -> source, S7 a generic question
    // -> the filter off -> source), so the fixture-count row above reads eleven.
    {
      const S5 = khilafCases.cases.find((c) => c.id === 'S5-p13-side-issue-parties');
      const S6 = khilafCases.cases.find((c) => c.id === 'S6-two-parties-on-subject-party-level');
      const S7 = khilafCases.cases.find((c) => c.id === 'S7-generic-question-filter-off');
      ok('F6 the three cases are in the fixture with their questions', !!S5 && !!S6 && !!S7 && S5.question && S6.question && S7.question);
      ok('F6 wiring: the before-writing path\'s whole-answer review passes the subject (subjectTerms: subjectTermsOf(question)); the reviewer imports nothing',
        /subjectTerms: subjectTermsOf\(question\),\n\s*\}\);\n\s*const tail = String\(REVIEW_KHILAF_TAIL/u.test(fs.readFileSync(path.join(ROOT, 'lib', 'before-writing-v2.js'), 'utf8'))
        && !/(\bfrom\s*')(\.\.?\/)/u.test(fs.readFileSync(REVIEWER, 'utf8')));
      ok('F6 the reviewer\'s own stem equals question-terms.js stemWord on the words the subject test meets',
        ['والزكاه', 'للصلاه', 'بالوضوء', 'الفرض', 'فرضت', 'لمس', 'ال', 'ينقض'].every((w) => QT.stemWord(w) === w.replace(/^[وفب](?=...)/u, '').replace(/^(?:لل|ال|ل)(?=..)/u, ''))
        && /const subjectStem = \(w\) => w\.replace\(\/\^\[وفب\]\(\?=\.\.\.\)\/u, ''\)\.replace\(\/\^\(\?:لل\|ال\|ل\)\(\?=\.\.\)\/u, ''\);/u.test(fs.readFileSync(REVIEWER, 'utf8')));
      const subj5 = QT.subjectTermsOf(S5.question);
      ok('F6a subjectTermsOf(P13) is the two stemmed issue terms «زكاه», «فرض»; a generic question gives null (the filter off)',
        subj5 instanceof Set && subj5.has('زكاه') && subj5.has('فرض') && subj5.size === 2 && QT.subjectTermsOf('ما الحكم؟') === null && QT.subjectTermsOf('') === null,
        JSON.stringify(subj5 ? [...subj5] : null));
      ok('F6b the P13 text counts two parties with no subject and none on the question\'s subject (both parties speak of the timing only)',
        module.releasedViewsIn([S5.input.text]) === 2 && module.releasedViewsIn([S5.input.text], null, { subjectTerms: subj5 }) === 0,
        JSON.stringify([module.releasedViewsIn([S5.input.text]), module.releasedViewsIn([S5.input.text], null, { subjectTerms: subj5 })]));
      ok('F6c the party-level match: the Hanafi party names the subject in one of its two sentences only, and still counts',
        module.releasedViewsIn([S6.input.text], null, { subjectTerms: QT.subjectTermsOf(S6.question) }) === 2, String(module.releasedViewsIn([S6.input.text], null, { subjectTerms: QT.subjectTermsOf(S6.question) })));
      ok('F6d Q08 keeps its count on its own question (party-level): at least three views', module.releasedViewsIn([khilafCases.cases.find((c) => c.id === 'Q08').input.text], null, { subjectTerms: QT.subjectTermsOf(khilafCases.cases.find((c) => c.id === 'Q08').question) }) >= 3);
      const partyFilterMutant = await runMutant({
        sourceFile: REVIEWER,
        name: 'khilaf-party-filter-dropped',
        transform: (source) => source.replace(
          '    if (!partySubject.get(key)) continue; // ITEM 35-D2 R7 (brain35-2 F6): a party whose every clause is on a side point is not a view on the question',
          '    // mutant: every party counts, on the subject or not'),
        survives: (mutantModule) => khilafCases.cases.every((test) => khilafCasePasses(mutantModule, test)),
      });
      ok('F6 party-filter mutant seam applied and module loaded', partyFilterMutant.changed && partyFilterMutant.loaded, partyFilterMutant.error);
      ok('MUTANT KILLED: without the party filter the P13 shape draws the khilaf tail again', partyFilterMutant.loaded && partyFilterMutant.survived === false, JSON.stringify(partyFilterMutant));
    }

    // \u2500\u2500 brain35-5g K4a (2026-11-09; DIAG7 K4 and FOUND 1, from our batches c32106c7 F6) \u00b7 THE SUBJECT FILTER FOLDS THE HAMZA SEATS \u2500\u2500
    // MEASURED (DIAG7 K4b-views-subject, preview Q13): the Shafi'i clause carries \u00ab\u0627\u0644\u062d\u0627\u0626\u0636\u00bb, the term is \u00ab\u062d\u0627\u064a\u0636\u00bb (question-terms folds the
    // hamza seats), the reviewer kept them: 0 views. Q13's prose: DIAG7 K4.Q13.prose.txt (copied from the EXT report). Measured after
    // the fold: 1 view (the Shafi'i party); the Hanbali clause \u00ab\u064a\u062c\u0648\u0632 \u0623\u0646 \u064a\u0635\u0646\u0639 \u0643\u0644 \u0634\u064a\u0621\u00bb names no subject term and stays out (F6, party-level).
    {
      const Q13_K4A = '\u0645\u0627\u0630\u0627 \u064a\u062d\u0644 \u0644\u0644\u0631\u062c\u0644 \u0645\u0646 \u0627\u0645\u0631\u0623\u062a\u0647 \u0648\u0647\u064a \u062d\u0627\u0626\u0636\u061f';
      const T13_K4A = '\u0627\u0644\u0630\u064a \u064a\u062d\u0631\u0645 \u0639\u0644\u0649 \u0627\u0644\u0631\u062c\u0644 \u0645\u0646 \u0627\u0645\u0631\u0623\u062a\u0647 \u0648\u0647\u064a \u062d\u0627\u0626\u0636 \u0647\u0648 \u0648\u0637\u0624\u0647\u0627 \u0641\u064a \u0627\u0644\u0641\u0631\u062c\u060c \u0623\u0645\u0627 \u0645\u0627 \u0633\u0648\u0649 \u0630\u0644\u0643 \u0641\u062c\u0627\u0626\u0632.\n\n\u0648\u0642\u062f \u0643\u0627\u0646\u062a \u0627\u0644\u064a\u0647\u0648\u062f \u062a\u063a\u0644\u0648 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u0623\u0645\u0631\u060c \u0641\u0625\u0630\u0627 \u062d\u0627\u0636\u062a \u0627\u0644\u0645\u0631\u0623\u0629 \u0644\u0645 \u064a\u0648\u0627\u0643\u0644\u0648\u0647\u0627 \u0648\u0644\u0645 \u064a\u0634\u0627\u0631\u0628\u0648\u0647\u0627 \u0648\u0644\u0645 \u064a\u0636\u0627\u062c\u0639\u0648\u0647\u0627 \u0641\u064a \u0627\u0644\u0641\u0631\u0627\u0634\u060c \u0648\u0647\u0630\u0627 \u0645\u0646 \u063a\u0644\u0648\u0647\u0645\u060c \u0641\u0623\u0646\u0643\u0631 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u0630\u0644\u0643 \u2014 \u0627\u0628\u0646 \u0628\u0627\u0632.\n\n\u0648\u0643\u0627\u0646 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u064a\u0623\u0645\u0631 \u0639\u0627\u0626\u0634\u0629 \u0648\u0646\u0633\u0627\u0621\u0647 \u0623\u0646 \u064a\u062a\u0632\u0631\u0646 \u0625\u0630\u0627 \u0623\u0631\u0627\u062f \u0645\u0628\u0627\u0634\u0631\u062a\u0647\u0646\u060c \u0641\u0647\u0630\u0627 \u0623\u0641\u0636\u0644 \u0648\u0645\u0633\u062a\u062d\u0628\u060c \u0648\u0644\u064a\u0633 \u0628\u0648\u0627\u062c\u0628. \u0641\u0627\u0644\u0648\u0627\u062c\u0628 \u0647\u0648 \u062a\u062c\u0646\u0628 \u0627\u0644\u0648\u0637\u0621 \u0648\u062d\u062f\u0647\u060c \u0641\u0625\u0630\u0627 \u062a\u062c\u0646\u0628 \u0627\u0644\u0648\u0637\u0621 \u0641\u0644\u0627 \u0628\u0623\u0633 \u0623\u0646 \u064a\u0628\u0627\u0634\u0631 \u0628\u062f\u0646\u0647\u0627 \u0648\u0644\u0648 \u0645\u0633 \u0641\u062e\u0630\u0647\u0627\u060c \u0623\u0648 \u0645\u0633 \u0641\u0631\u062c\u0647 \u0641\u062e\u0630\u0647\u0627 \u0641\u0644\u0627 \u064a\u0636\u0631.\n\n\u0623\u0645\u0627 \u0627\u0644\u0639\u0644\u0645\u0627\u0621 \u0641\u0642\u062f \u0627\u062e\u062a\u0644\u0641\u0648\u0627 \u0641\u064a \u0645\u0628\u0627\u0634\u0631\u062a\u0647\u0627 \u0641\u064a\u0645\u0627 \u0628\u064a\u0646 \u0627\u0644\u0633\u0631\u0629 \u0648\u0627\u0644\u0631\u0643\u0628\u0629\u060c \u0641\u0644\u0627 \u062e\u0644\u0627\u0641 \u0628\u064a\u0646\u0647\u0645 \u0641\u064a \u062c\u0648\u0627\u0632 \u0645\u0628\u0627\u0634\u0631\u062a\u0647\u0627 \u0641\u064a\u0645\u0627 \u0641\u0648\u0642 \u0627\u0644\u0633\u0631\u0629 \u0648\u062f\u0648\u0646 \u0627\u0644\u0631\u0643\u0628\u0629 \u2014 \u0627\u0644\u0645\u0648\u0633\u0648\u0639\u0629 \u0627\u0644\u0641\u0642\u0647\u064a\u0629 \u0627\u0644\u0643\u0648\u064a\u062a\u064a\u0629. \u0648\u0642\u0627\u0644 \u0627\u0644\u062d\u0646\u0627\u0628\u0644\u0629: \u064a\u062c\u0648\u0632 \u0623\u0646 \u064a\u0635\u0646\u0639 \u0643\u0644 \u0634\u064a\u0621.\n\n\u0643\u0645\u0627 \u0646\u0635 \u0627\u0644\u0634\u0627\u0641\u0639\u064a\u0629 \u0639\u0644\u0649 \u0623\u0646\u0647 \u0644\u0627 \u064a\u062c\u062a\u0646\u0628 \u0627\u0644\u0632\u0648\u062c \u0645\u0636\u0627\u062c\u0639\u0629 \u0632\u0648\u062c\u062a\u0647 \u0627\u0644\u062d\u0627\u0626\u0636 \u0625\u0630\u0627 \u0633\u062a\u0631\u062a \u0645\u0627 \u0628\u064a\u0646 \u0627\u0644\u0633\u0631\u0629 \u0648\u0627\u0644\u0631\u0643\u0628\u0629.';
      const views13 = (mod) => mod.releasedViewsIn([T13_K4A], null, { subjectTerms: QT.subjectTermsOf(Q13_K4A) });
      ok('K4a-1 question 13 prose with subjectTermsOf(question 13): the Shafii party is kept -> releasedViews 1 (0 before the fold)', views13(module) === 1, String(views13(module)));
      const TERM_K4A = new Set(['\u062d\u0627\u064a\u0636']);
      ok('K4a-2 SYNTHETIC \u00ab\u0648\u0642\u0627\u0644 \u0627\u0644\u062d\u0646\u0627\u0628\u0644\u0629: \u064a\u062c\u0648\u0632 \u0644\u0644\u062d\u0627\u0626\u0636 \u0643\u0630\u0627.\u00bb against the term \u00ab\u062d\u0627\u064a\u0636\u00bb -> kept', module.releasedViewsIn(['\u0648\u0642\u0627\u0644 \u0627\u0644\u062d\u0646\u0627\u0628\u0644\u0629: \u064a\u062c\u0648\u0632 \u0644\u0644\u062d\u0627\u0626\u0636 \u0643\u0630\u0627.'], null, { subjectTerms: TERM_K4A }) === 1, String(module.releasedViewsIn(['\u0648\u0642\u0627\u0644 \u0627\u0644\u062d\u0646\u0627\u0628\u0644\u0629: \u064a\u062c\u0648\u0632 \u0644\u0644\u062d\u0627\u0626\u0636 \u0643\u0630\u0627.'], null, { subjectTerms: TERM_K4A })));
      ok('K4a-3 SYNTHETIC \u00ab\u0648\u0642\u0627\u0644 \u0627\u0644\u062d\u0646\u0627\u0628\u0644\u0629: \u064a\u062c\u0648\u0632 \u0630\u0644\u0643.\u00bb (no subject word) -> dropped, as today (pinned)', module.releasedViewsIn(['\u0648\u0642\u0627\u0644 \u0627\u0644\u062d\u0646\u0627\u0628\u0644\u0629: \u064a\u062c\u0648\u0632 \u0630\u0644\u0643.'], null, { subjectTerms: TERM_K4A }) === 0, String(module.releasedViewsIn(['\u0648\u0642\u0627\u0644 \u0627\u0644\u062d\u0646\u0627\u0628\u0644\u0629: \u064a\u062c\u0648\u0632 \u0630\u0644\u0643.'], null, { subjectTerms: TERM_K4A })));
      const seatMutant = await runMutant({
        sourceFile: REVIEWER,
        name: 'k4a-seat-fold-removed',
        transform: (source) => source.replace('const subjectSeatFold = (s) => String(s)', 'const subjectSeatFold = (s) => String(s); const subjectSeatFoldMutant = (s) => String(s)'),
        survives: (mutantModule) => views13(mutantModule) === 1,
      });
      ok('K4a seat-fold mutant seam applied and module loaded', seatMutant.changed && seatMutant.loaded, seatMutant.error);
      ok('MUTANT KILLED: without the hamza-seat fold question 13 loses its Shafii party again (K4a-1 red)', seatMutant.loaded && seatMutant.survived === false, JSON.stringify(seatMutant));
    }

    // ── brain35-3 X10 (2026-11-07; DIAG3 FOUND 4) · A TIMING DISPUTE IS TWO STANCES ─────────────────────────────────
    // MEASURED (DIAG3 H6 (c), live Q12): with both stance sentences released («ذهب الجمهور إلى أن الحج يجب على الفور.» /
    // «وذهب الشافعية ومحمد بن الحسن إلى أنه يجب على التراخي.») releasedViewsIn = 1 and khilafTrigger = null: the stance
    // vocabulary read «يجب» in both and no timing word, so the two parties folded into one view. «على الفور» and «على التراخي»
    // (with the «يجب / واجب / الوجوب» before them consumed) are now two opposed stances. Fixture +1 (S8), the count row 11 -> 12.
    {
      const S8 = khilafCases.cases.find((c) => c.id === 'S8-timing-dispute-two-stances');
      const S5x = khilafCases.cases.find((c) => c.id === 'S5-p13-side-issue-parties');
      ok('X10 the S8 case is in the fixture with its question', !!S8 && !!S8.question);
      const subj8 = QT.subjectTermsOf(S8.question);
      ok('X10a S8: two views on the subject (one party on «على الفور», one on «على التراخي»)', module.releasedViewsIn([S8.input.text], null, { subjectTerms: subj8 }) === 2, String(module.releasedViewsIn([S8.input.text], null, { subjectTerms: subj8 })));
      ok('X10b S8 draws the trigger (source), and S5 (the P13 shape) stays null', khilafCasePasses(module, S8) && khilafCasePasses(module, S5x));
      const timingMutant = await runMutant({
        sourceFile: REVIEWER,
        name: 'timing-pair-is-no-stance',
        transform: (source) => source.replace(
          "  take(/(?:(?:يجب|واجب|وجوب|الوجوب)\\s+)?علي\\s+الفور|(?:ال)?فوريه|فورا/gu, 'immediate');\n  take(/(?:(?:يجب|واجب|وجوب|الوجوب)\\s+)?علي\\s+التراخي|(?:ال)?تراخي/gu, 'deferred');\n",
          "  // mutant: the timing pair is no stance\n"),
        survives: (mutantModule) => khilafCasePasses(mutantModule, S8),
      });
      ok('X10 timing-pair mutant seam applied and module loaded', timingMutant.changed && timingMutant.loaded, timingMutant.error);
      ok('MUTANT KILLED: with the timing pair removed S8 folds into one view and draws no tail', timingMutant.loaded && timingMutant.survived === false, JSON.stringify(timingMutant));
    }

    // ── brain35-5e G5a (2026-11-09; DIAG6 G5 (A)) · «وسئل X عن …؟» WAITS FOR ITS ANSWER ─────────────────────────────────────────
    // MEASURED (DIAG6 G5-hanging-openings, preview Q14): «وسئل البراك عن الأفضل: …؟» stood with no answer under it; sentenceIntegrity's
    // 'unanswered-report' regex read «سئل» and «قد/وقد/فقد سئل» but a «و» or «ف» glued to «سئل» is neither a listed prefix nor a word
    // boundary. The prefix group gains «و» and «ف».
    {
      const REPORT_G5A = "وسئل البراك عن الأفضل: هل سردها ركعتين ركعتين في أوقات متفرقة أم صلاتها دفعة واحدة؟"; // copied (EXT Q14, via the DIAG6 G5 harness)
      const rulesOf = (mod, text) => mod.sentenceIntegrity(text).findings.map((f) => f.rule);
      ok('G5a-1 «وسئل البراك عن الأفضل: هل سردها … أم صلاتها دفعة واحدة؟» (EXT Q14) -> \'unanswered-report\'', rulesOf(module, REPORT_G5A).includes('unanswered-report'), JSON.stringify(rulesOf(module, REPORT_G5A)));
      const FA = 'ف' + REPORT_G5A.slice(1);
      ok('G5a-2 SYNTHETIC the same with «فسئل» -> \'unanswered-report\'', rulesOf(module, FA).includes('unanswered-report'), JSON.stringify(rulesOf(module, FA)));
      const ANSWERED = 'وسئل البراك عن الأفضل فأجاب: الأمر في ذلك واسع، والسرد والتفريق جائزان.';
      ok('G5a-3 SYNTHETIC «وسئل البراك عن الأفضل فأجاب: …» -> no finding (pinned)', !rulesOf(module, ANSWERED).includes('unanswered-report'), JSON.stringify(rulesOf(module, ANSWERED)));
      const prefixMutant = await runMutant({
        sourceFile: REVIEWER,
        name: 'g5a-glued-prefix-removed',
        transform: (source) => source.replace('    if (/(?:^|\\s)(?:فقد|وقد|قد|و|ف)?\\s*س[ئي]ل\\s.+?\\sعن\\s/u.test(folded)', '    if (/(?:^|\\s)(?:فقد|وقد|قد)?\\s*س[ئي]ل\\s.+?\\sعن\\s/u.test(folded) /* mutant: the glued letters removed */'),
        survives: (mutantModule) => rulesOf(mutantModule, REPORT_G5A).includes('unanswered-report'),
      });
      ok('G5a prefix mutant seam applied and module loaded', prefixMutant.changed && prefixMutant.loaded, prefixMutant.error);
      ok('MUTANT KILLED: without «و» and «ف» in the prefix the glued «وسئل» is no report again (G5a-1 red)', prefixMutant.loaded && prefixMutant.survived === false, JSON.stringify(prefixMutant));
    }

    // ── brain35-5f G7 (2026-11-09; DIAG6 G7; order FIX5F, Claude's ruling) · A DENIED DISPUTE IS NOT A DISPUTE: THE TEST STANDS ON THE MARKER ──
    // MEASURED (DIAG6 G7-khilaf-no-contradiction, preview Q14): the tail «لظهور الخلاف فيها» on a settled recommendation; the source prong matched
    // KHILAF_SOURCE_MARKERS inside the Mawsu'a's «ولا خلاف بين الفقهاء …». A marker now counts unless the marker ITSELF is denied: a
    // particle of the closed list within the five words right before it, in its own clause. No agreement test (FIX5E's sentence-level
    // form killed S7's real dispute). Q14's prose: G7.Q14.prose.txt (DIAG6, copied from the EXT report); the evidence: the G7 harness's
    // SYNTHETIC snippets; G7-2..5 SYNTHETIC (each sentence followed by the same supporting sentence, so the source supports the prose).
    {
      const Q14_G7 = "ما حكم صلاة الضحى، وما أفضل وقتها، وأبي أحاديث الباب";
      const T14_G7 = "صلاة الضحى نافلة مستحبة عند جمهور الفقهاء، وصرح المالكية والشافعية بأنها سنة مؤكدة.\n\nوقال ابن باز: صلاة الضحى سنة مؤكدة، والنبي أوصى بها عليه الصلاة والسلام، وكان يصليها بعض الأحيان، فإذا تيسر للمؤمن فعلها فهذا خير عظيم، لكنها غير لازمة، لو فعلها بعض الأحيان وتركها بعض الأحيان أو تركها بالكلية فلا حرج.\n\nأقلها ركعتان، ولا حد لأكثرها، وقال النووي في شرح المهذب: إن أكثرها ثمان، وذكر أن أدنى الكمال أربع وأفضل منه ست.\n\nوقال ابن باز أيضا: ويكفي من ذلك ركعتان تركعهما من الضحى، وإذا صلى أربعا أو ستا أو ثمانيا أو أكثر فلا بأس.\n\nما أفضل وقت لصلاة الضحى؟\n\nأما وقتها، فذهب الجمهور إلى أن وقت صلاة الضحى من ارتفاع الشمس إلى قبيل زوالها ما لم يدخل وقت النهي — الموسوعة الفقهية الكويتية. قال ابن عثيمين: أول وقتها إذا ارتفعت الشمس قيد رمح، وهذا يكون بنحو ربع ساعة بعد طلوع الشمس، وينتهي وقتها قبيل الزوال، أي قبل زوال الشمس بعشر دقائق تقريبا.\n\nوأفضل وقتها إذا اشتد الحر؛ لا خلاف بين الفقهاء في أن الأفضل فعل صلاة الضحى إذا علت الشمس واشتد حرها، لقول النبي صلى الله عليه وسلم: «صلاة الأوابين حين ترمض الفصال» (مسلم)، ومعناه أن تحمى الرمضاء فتبرك الفصال من شدة الحر. وقال ابن باز: الأفضل أن تكون بعد ارتفاع النهار، إذا اشتد النهار قبل زوال الشمس بنصف ساعة، وإن صلاها مبكرا بعد ارتفاع الشمس قيد رمح حصل المقصود، وإن أخرها حتى يرتفع النهار فهو أفضل — ابن باز. وقال ابن عثيمين: هذه الصلاة من الصلوات التي ينبغي أن تصلى في آخر وقتها، لكن قبل الزوال بنحو ربع ساعة هذا هو الأفضل، وإذا كان لا يتيسر للإنسان هذا الوقت لكونه مشغولا بوظيفة أو دراسة أو تجارة، فإنه يصليها إذا ارتفعت الشمس قيد رمح — ابن عثيمين.\n\nوسئل البراك عن الأفضل: هل سردها ركعتين ركعتين في أوقات متفرقة أم صلاتها دفعة واحدة؟\n\nأما الأحاديث الواردة في فضلها:\n\nعن أبي هريرة رضي الله عنه: «أوصاني خليلي صلى الله عليه وسلم بثلاث: صيام ثلاثة أيام من كل شهر، وركعتي الضحى، وأن أوتر قبل أن أنام» (متفق عليه) — مختصر الفقه الإسلامي\n\n«يصبح على كل سلامى من أحدكم صدقة، فكل تسبيحة صدقة، وكل تحميدة صدقة، وكل تهليلة صدقة، وكل تكبيرة صدقة، وأمر بالمعروف صدقة، ونهي عن المنكر صدقة، ويجزئ من ذلك ركعتان يركعهما من الضحى» (مسلم)\n\nقاله النبي صلى الله عليه وسلم لما رأى زيد بن أرقم قوما يصلون من الضحى فقال: أما لقد علموا أن الصلاة في غير هذه الساعة أفضل.";
      const EV14_G7 = [{"id":"ref-1","title":"الموسوعة الفقهية الكويتية","url":"","snippet":"صلاة الضحى نافلة مستحبة عند جمهور الفقهاء، وصرح المالكية والشافعية بأنها سنة مؤكدة. وذهب الجمهور إلى أن وقت صلاة الضحى من ارتفاع الشمس إلى قبيل زوالها، ولا خلاف بين الفقهاء في أن الأفضل فعلها إذا علت الشمس واشتد حرها."},{"id":"ref-2","title":"فتاوى نور على الدرب لابن باز","url":"","snippet":"صلاة الضحى سنة مؤكدة، والنبي أوصى بها، لكنها غير لازمة، لو فعلها بعض الأحيان وتركها بعض الأحيان فلا حرج."},{"id":"ref-3","title":"مختصر الفقه الإسلامي","url":"","snippet":"أقلها ركعتان ولا حد لأكثرها، وقال النووي: إن أكثرها ثمان، وأدنى الكمال أربع وأفضل منه ست."},{"id":"ref-4","title":"ما أفضل وقت لصلاة الضحى؟","url":"https://binbaz.org.sa/SYNTHETIC","snippet":"ويكفي من ذلك ركعتان، وإذا صلى أربعا أو ستا أو ثمانيا أو أكثر فلا بأس، والأفضل أن تكون بعد ارتفاع النهار."},{"id":"ref-5","title":"آخر وقت صلاة الضحى، وأفضل وقت لصلاتها","url":"https://binothaimeen.net/SYNTHETIC","snippet":"أول وقتها إذا ارتفعت الشمس قيد رمح، وينتهي قبيل الزوال، والأفضل في آخر وقتها."}];
      const triggerG7 = (mod, ev) => mod.reviewAnswer({ text: T14_G7, evidence: ev, domain: 'fiqh', mode: 'brief', truncated: false, topic: classifyTopic(Q14_G7), subjectTerms: QT.subjectTermsOf(Q14_G7) }).verdict.khilafTrigger;
      const withRef1 = (snippet) => EV14_G7.map((e, i) => (i === 0 ? { ...e, snippet } : e));
      ok('G7-1 Q14\'s prose with the SYNTHETIC Mawsu\'a snippet («… ولا خلاف بين الفقهاء في أن الأفضل …»): khilafTrigger null', triggerG7(module, EV14_G7) === null, JSON.stringify(triggerG7(module, EV14_G7)));
      const DISPUTE = 'اختلف الفقهاء في حكم صلاة الضحى، فصلاة الضحى نافلة مستحبة عند جمهور الفقهاء، وصرح المالكية والشافعية بأنها سنة مؤكدة.';
      ok('G7-2 SYNTHETIC a snippet «اختلف الفقهاء في حكم …»: \'source\' (pinned)', triggerG7(module, withRef1(DISPUTE)) === 'source', JSON.stringify(triggerG7(module, withRef1(DISPUTE))));
      const G7_SUPPORT = " صلاة الضحى نافلة مستحبة عند جمهور الفقهاء، وصرح المالكية والشافعية بأنها سنة مؤكدة.";
      const G7_3 = "لا خلاف بين الفقهاء في مشروعيتها، واختلفوا في عدد ركعاتها." + G7_SUPPORT;
      ok('G7-3 SYNTHETIC «لا خلاف بين الفقهاء في مشروعيتها، واختلفوا في عدد ركعاتها»: \'source\' (the second clause\'s marker «اختلفوا في …» stands under no denial)', triggerG7(module, withRef1(G7_3)) === 'source', JSON.stringify(triggerG7(module, withRef1(G7_3))));
      const G7_4 = "اتفق الفقهاء على مشروعيتها واختلفوا في وقتها." + G7_SUPPORT;
      ok('G7-4 SYNTHETIC «اتفق الفقهاء على مشروعيتها واختلفوا في وقتها»: as today, "source" (pinned)', JSON.stringify(triggerG7(module, withRef1(G7_4))) === "\"source\"", JSON.stringify(triggerG7(module, withRef1(G7_4))));
      const G7_5 = "لا نعلم بين أهل العلم خلافا في ذلك." + G7_SUPPORT;
      ok('G7-5 SYNTHETIC «لا نعلم بين أهل العلم خلافا في ذلك»: no source trigger from it (neither \'source\' nor \'both\')', !['source', 'both'].includes(triggerG7(module, withRef1(G7_5))), JSON.stringify(triggerG7(module, withRef1(G7_5))));
      const denialMutant = await runMutant({
        sourceFile: REVIEWER,
        name: 'g7-marker-denial-removed',
        transform: (source) => source.replace(
          '  for (const m of bare.matchAll(KHILAF_SOURCE_MARKERS_ALL)) if (!khilafMarkerDenied(bare, clauseStart(m.index), m.index)) return true;',
          '  for (const m of bare.matchAll(KHILAF_SOURCE_MARKERS_ALL)) return true; // mutant: the denial test removed'),
        survives: (mutantModule) => triggerG7(mutantModule, EV14_G7) === null,
      });
      ok('G7 denial mutant seam applied and module loaded', denialMutant.changed && denialMutant.loaded, denialMutant.error);
      ok('MUTANT KILLED: without the marker-denial test the Mawsu\'a\'s «ولا خلاف» declares a khilaf again (G7-1 red)', denialMutant.loaded && denialMutant.survived === false, JSON.stringify(denialMutant));
    }

    // ── brain35-3 X12 (2026-11-07; FIX-2 request 1) · THE LEGACY PATH COUNTS KHILAF PARTIES ON THE SUBJECT TOO ──────
    // brain35-2 F6 wired the subject into the before-writing path only: lib/free-brain/review.js forwards named fields alone,
    // so the legacy path kept the old count. review.js now forwards `subjectTerms` (a Set, or null: the filter off) and
    // lib/free-brain/loop.js passes subjectTermsOf(ctx.question) from the leaf lib/question-terms.js.
    {
      const reviewSrc = fs.readFileSync(path.join(ROOT, 'lib', 'free-brain', 'review.js'), 'utf8');
      const loopSrc = fs.readFileSync(path.join(ROOT, 'lib', 'free-brain', 'loop.js'), 'utf8');
      ok('X12 wiring: review.js forwards the Set (or null) and loop.js passes subjectTermsOf(ctx.question), imported from the leaf lib/question-terms.js',
        reviewSrc.includes("      subjectTerms: input.subjectTerms instanceof Set ? input.subjectTerms : null,") && loopSrc.includes("    subjectTerms: subjectTermsOf(ctx.question),")
        && /import \{ subjectTermsOf \} from '\.\.\/question-terms\.js';/u.test(loopSrc));
      const LEGACY = await import(pathToFileURL(path.join(ROOT, 'lib', 'free-brain', 'review.js')).href + '?x12=' + Date.now());
      const S5y = khilafCases.cases.find((c) => c.id === 'S5-p13-side-issue-parties');
      const legacyRun = async (mod, subjectTerms) => (await mod.reviewAnswer({ text: S5y.input.text, evidence: S5y.input.evidence, domain: S5y.input.domain, mode: S5y.input.mode, topic: S5y.input.topic || classifyTopic(String(S5y.question || '')), subjectTerms })).verdict.khilafTrigger;
      const withSubject = await legacyRun(LEGACY, QT.subjectTermsOf(S5y.question));
      const withoutSubject = await legacyRun(LEGACY, null);
      ok('X12a the P13 shape through the legacy path with the subject -> null; with no subject -> source (the old count, the filter off)', withSubject === null && withoutSubject === 'source', JSON.stringify([withSubject, withoutSubject]));
      const loadsX12 = ['lib/free-brain/loop.js', 'lib/free-brain/review.js', 'lib/before-writing-v2.js', 'lib/bw2-units.js', 'lib/question-terms.js', 'api/ask.js'].map((rel) => {
        try {
          const r = require('child_process').spawnSync(process.execPath, ['--input-type=module', '-e', 'await import(' + JSON.stringify(pathToFileURL(path.join(ROOT, rel)).href) + '); console.log("LOADED")'], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
          return rel + ':' + (/LOADED/.test(r.stdout) ? 'ok' : 'FAIL ' + String(r.stderr).slice(0, 200));
        } catch (e) { return rel + ':THREW ' + String(e && e.message); }
      });
      ok('X12b every entry order still loads in a fresh process (loop, review, before-writing, bw2-units, question-terms, the handler)', loadsX12.every((l) => /:ok$/u.test(l)), loadsX12.join(' | '));
      // the mutant: the forwarding line removed from a twin of review.js
      const seamR = "      subjectTerms: input.subjectTerms instanceof Set ? input.subjectTerms : null,\n";
      ok('X12 mutant seam present once', reviewSrc.split(seamR).length === 2);
      const tmpR = path.join(ROOT, 'lib', 'free-brain', '.mut-x12-review.mjs');
      fs.writeFileSync(tmpR, reviewSrc.split(seamR).join('').replace(/from\s+(['"])(\.[^'"]*)\1/gu, (_a, q, spec) => 'from ' + q + pathToFileURL(path.resolve(ROOT, 'lib', 'free-brain', spec)).href + q));
      let MR = null;
      try { MR = await import(pathToFileURL(tmpR).href + '?m=' + Date.now()); } catch (e) { MR = null; } finally { fs.rmSync(tmpR, { force: true }); }
      ok('X12 mutant loads', !!MR);
      ok('X12 MUTANT KILLED: with the forwarding line removed the legacy path draws the tail on the P13 shape again', !!MR && (await legacyRun(MR, QT.subjectTermsOf(S5y.question))) === 'source', MR ? JSON.stringify(await legacyRun(MR, QT.subjectTermsOf(S5y.question))) : 'no module');
    }
    const viewGateMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'khilaf-gate-ignores-released-views',
      transform: (source) => source.replace(
        '  if (!(Number(releasedViews) >= 2)) return null;',
        '  if (false && !(Number(releasedViews) >= 2)) return null; // mutant: one view is enough again'),
      survives: (mutantModule) => khilafCases.cases.every((test) => khilafCasePasses(mutantModule, test)),
    });
    ok('A-1 view-gate mutant seam applied and module loaded', viewGateMutant.changed && viewGateMutant.loaded, viewGateMutant.error);
    ok('MUTANT KILLED: the khilaf tail cannot return on a one-view answer', viewGateMutant.loaded && viewGateMutant.survived === false, JSON.stringify(viewGateMutant));
    const topicGateMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'khilaf-gate-ignores-hadith-topic',
      transform: (source) => source.replace(
        "const KHILAF_NO_TAIL_TOPICS_EXTRA = new Set(['hadith']);",
        "const KHILAF_NO_TAIL_TOPICS_EXTRA = new Set([]); // mutant: a hadith grade may draw the tail again"),
      survives: (mutantModule) => khilafCases.cases.every((test) => khilafCasePasses(mutantModule, test)),
    });
    ok('A-1 topic-gate mutant seam applied and module loaded', topicGateMutant.changed && topicGateMutant.loaded, topicGateMutant.error);
    ok('MUTANT KILLED: a hadith-grade answer cannot draw the khilaf tail', topicGateMutant.loaded && topicGateMutant.survived === false, JSON.stringify(topicGateMutant));


    // ── brain35 A-5 (2026-11-06; DIAG 35.6, GEMMA-4b, NOTE-4, NOTE-9): GRADE MEANING, PRIOR TEXT, THE SAME-CASE PAIRS ──
    // The grade frame compares FAMILIES (جيد/حسن are one; the CMP:483 frame was a false warning) and reads a grader's verb
    // («جزم الألباني بضعف هذا الطريق» against the head's «موضوع»: Q22 never reached the frame); the self-contradiction check
    // knows three same-case pairs, read only when both parts name the pair's subject (Q07: the fatwa's «وجوب قراءة المأموم
    // الفاتحة» against the unit's «الواجب عليه الاستماع»); «عند X … وعند Y …» (rule 13's shape) names two speakers and is no
    // contradiction; a view a licensed row attributes to a named man is a differentiated case.
    {
      const Q17 = 'ما درجة حديث «من صلى الغداة في جماعة ثم قعد يذكر الله حتى تطلع الشمس ثم صلى ركعتين»؟';
      const P17 = 'حديث «من صلى الغداة في جماعة ثم قعد يذكر الله حتى تطلع الشمس ثم صلى ركعتين» حديث جيد رواه الترمذي.';
      const framed = (mod, value, question, priorText) => mod.frameHadithGradeDisagreement(value, { question, priorText }) !== value;
      ok('A-5 (jayyid, hasan) -> no frame: one family', !framed(module, 'وهذا الحديث حسن عند الألباني.', Q17, P17));
      ok('A-5 (sahih, daif) -> frame: two families', framed(module, 'وهذا الحديث ضعيف عند غيره.', Q17, P17.replace('جيد', 'صحيح')));
      const Q22 = 'ما درجة حديث «الجنة تحت أقدام الأمهات»؟ ومن خرّجه؟';
      const H22 = 'الحديث لا يثبت مرفوعا إلى النبي صلى الله عليه وسلم، والحكم عليه في السلسلة الضعيفة: موضوع.';
      ok('A-5 (موضوع in the head, «جزم الألباني بضعف هذا الطريق» in the unit) -> frame: the grader\'s verb is a claim', framed(module, 'وقد جزم الألباني بضعف هذا الطريق، ونقل عن ابن طاهر قوله فيه.', Q22, H22));
      ok('A-5 («ضعفه الترمذي» after a head that says صحيح) -> frame; («صححه ابن حبان» after it) -> none', framed(module, 'وضعفه الترمذي بقوله: غريب.', Q22, H22.replace('موضوع', 'صحيح')) && !framed(module, 'وصححه ابن حبان في صحيحه.', Q22, H22.replace('موضوع', 'صحيح')));
      const BLOCK07 = 'القول الصحيح في هذه المسألة هو وجوب قراءة المأموم الفاتحة في الصلاة السرية والجهرية، وتقرأ في سكتة الإمام بعد الفاتحة.';
      const UNIT07 = 'والواجب عليه الاستماع والإنصات لقراءة الإمام، سواء في الجهرية أو السرية، واستدلوا بحديث ابن عباس.';
      const sc = (mod, text, priorText, evidence = []) => mod.reviewAnswer({ text, evidence, domain: 'fiqh', mode: 'brief', priorText }).verdict.selfContradiction;
      ok('A-5 Q07: the shown fatwa (وجوب القراءة) as prior text + the unit (الواجب عليه الاستماع) -> contradiction detected', sc(module, UNIT07, BLOCK07).detected === true && sc(module, UNIT07, BLOCK07).shape === 'polarity');
      ok('A-5 ...and the unit alone (no prior text) is no contradiction', sc(module, UNIT07, '').detected === false);
      ok('A-5 «فعند الحنفية يجب القضاء دون الكفارة، وعند الشافعية لا يجب القضاء.» -> no contradiction (two named speakers)', sc(module, 'فعند الحنفية يجب القضاء دون الكفارة، وعند الشافعية لا يجب القضاء.', '').detected === false);
      const Q16A = 'ولو أفطر على شكه دون أن يتبين الحال بعد ذلك فعليه القضاء اتفاقا.';
      const Q16B = 'وقد نص أبو بكر الحدادي على أنه إذا كان شاكا في الغروب فأفطر فعليه الكفارة.';
      const ROW16 = { id: 'lib:FC-000001:0001', kind: 'lib_book', bookTitle: 'الجوهرة النيرة', title: 'الجوهرة النيرة · ج1 · ص140', author: 'أبو بكر الحدادي', authorRole: 'author', snippet: 'وإن أفطر وهو شاك في الغروب فعليه الكفارة، لأن الأصل بقاء النهار.', url: '' };
      ok('A-5 Q16: «فعليه القضاء اتفاقا» then al-Haddadi\'s «فعليه الكفارة» on a row that licenses him -> his view, no contradiction', sc(module, Q16B, Q16A, [ROW16]).detected === false);
      ok('A-5 Q16: the same kaffara sentence with no speaker -> contradiction (the qada / kaffara pair on the doubtful sunset)', sc(module, 'أما إذا كان شاكا في الغروب فأفطر فعليه الكفارة.', Q16A).detected === true);
      ok('A-5 the pair reads nothing without its subject noun («عليه القضاء» about a prayer vs «عليه الكفارة» about an oath)', sc(module, 'ومن حنث في يمينه فعليه الكفارة.', 'ومن نام عن الصلاة فعليه القضاء.').detected === false);
      const BW2A5 = await import(pathToFileURL(path.join(ROOT, 'lib', 'before-writing-v2.js')).href + '?a5=' + Date.now());
      const rule13 = String(BW2A5.BW2_WRITE_RULES_BRAIN35 || '').split('\n')[1] || '';
      ok('A-5 writer rule 13 (the order\'s sentence) follows rule 12 on every turn, pinned by sha256', rule13.startsWith('١٣. ') && require('crypto').createHash('sha256').update(rule13, 'utf8').digest('hex') === '255b767864eeb095100c723db5b04ecf416e7834f31d1be6fbe05882b621fef8' && BW2A5.bw2RulesFor([], 'x', []).includes(rule13));
      const familyMutant = await runMutant({
        sourceFile: REVIEWER,
        name: 'grade-families-are-words-again',
        transform: (source) => source.replace("export const gradeFamilyOf = (word) => GRADE_FAMILY[String(word || '')] || String(word || '');", "export const gradeFamilyOf = (word) => String(word || ''); // mutant: every word its own family"),
        survives: (mutantModule) => !framed(mutantModule, 'وهذا الحديث حسن عند الألباني.', Q17, P17),
      });
      ok('A-5 family mutant seam applied and loaded', familyMutant.changed && familyMutant.loaded, familyMutant.error);
      ok('MUTANT KILLED: with every grade word its own family, جيد vs حسن draws the frame again', familyMutant.loaded && familyMutant.survived === false, JSON.stringify(familyMutant));
      const verbMutant = await runMutant({
        sourceFile: REVIEWER,
        name: 'grade-verb-is-no-claim',
        transform: (source) => source.replace("      const byVerb = verbGradeIn(folded);", "      const byVerb = ''; // mutant: a grader's verb says nothing"),
        survives: (mutantModule) => framed(mutantModule, 'وقد جزم الألباني بضعف هذا الطريق، ونقل عن ابن طاهر قوله فيه.', Q22, H22),
      });
      ok('A-5 verb mutant seam applied and loaded', verbMutant.changed && verbMutant.loaded, verbMutant.error);
      ok('MUTANT KILLED: without the grader\'s verb Q22\'s «جزم بضعف» never reaches the frame', verbMutant.loaded && verbMutant.survived === false, JSON.stringify(verbMutant));
      const pairMutant = await runMutant({
        sourceFile: REVIEWER,
        name: 'reading-pair-gone',
        // the pair's own subject list is the seam: a second `subjects` key in the same object literal would be overridden by it
        transform: (source) => source.replace("Object.freeze(['فاتحه', 'ماموم', 'امام', 'قراءه', 'لقراءه', 'جهريه', 'سريه'])", "Object.freeze(['nothing']) /* mutant: the reading pair reads nothing */"),
        survives: (mutantModule) => sc(mutantModule, UNIT07, BLOCK07).detected === true,
      });
      ok('A-5 pair mutant seam applied and loaded', pairMutant.changed && pairMutant.loaded, pairMutant.error);
      ok('MUTANT KILLED: without the reading/listening pair Q07\'s two obligations pass as one', pairMutant.loaded && pairMutant.survived === false, JSON.stringify(pairMutant));
    }

    // ── brain35-3 X1 (2026-11-07; DIAG3 D2 fix 1; owner D2: both fixes) · THE FRAME NEEDS A RELEASED GRADE STATEMENT BEFORE IT ──
    // MEASURED (DIAG3 H2 (a), preview Q7): the first unit «حديث «حب الوطن من الإيمان» لا يصح عن النبي صلى الله عليه وسلم، فهو حديث
    // موضوع.» drew the frame ON ITSELF: A-5's verb reader makes «لا يصح» the family ضعيف and «موضوع» the family موضوع, and the
    // rule compared a claim with the earlier claims OF THE SAME UNIT. One grader's two words in one sentence are not two reports.
    // The frame now needs a claim in priorText (a released grade statement) whose family differs from a claim of the unit.
    {
      const Q7 = 'ما درجة حديث «حب الوطن من الإيمان»؟ ومن أخرجه؟';
      const U1 = 'حديث «حب الوطن من الإيمان» لا يصح عن النبي صلى الله عليه وسلم، فهو حديث موضوع.';
      const framedX1 = (mod, value, priorText) => mod.frameHadithGradeDisagreement(value, { question: Q7, priorText }) !== value;
      ok('X1a «لا يصح … فهو حديث موضوع» in ONE unit, empty prior text -> no frame (one grader\'s sentence)', !framedX1(module, U1, ''));
      ok('X1b prior «ضعفه الترمذي» + unit «صححه ابن حبان» -> frame (two released reports, two families)',
        framedX1(module, 'وصححه ابن حبان في صحيحه.', 'حديث «حب الوطن من الإيمان» ضعفه الترمذي.'));
      ok('X1c prior «جيد» + unit «حسن» -> no frame (one family, unchanged)',
        !framedX1(module, 'وهذا الحديث حسن عند الألباني.', 'حديث «حب الوطن من الإيمان» حديث جيد رواه الترمذي.'));
      ok('X1d the unit\'s second half with the first half as PRIOR text -> frame (the released statement differs)',
        framedX1(module, 'فهو حديث موضوع.', 'حديث «حب الوطن من الإيمان» لا يصح عن النبي صلى الله عليه وسلم.'));
      const withinUnitMutant = await runMutant({
        sourceFile: REVIEWER,
        name: 'frame-compares-within-the-unit-again',
        transform: (source) => source.replace(
          '  if (!before.length || !current.some((claim) => before',
          '  if (!current.some((claim, i) => [...before, ...current.slice(0, i)] // mutant: the unit\'s own earlier words count again'),
        survives: (mutantModule) => !framedX1(mutantModule, U1, ''),
      });
      ok('X1 within-unit mutant seam applied and module loaded', withinUnitMutant.changed && withinUnitMutant.loaded, withinUnitMutant.error);
      ok('MUTANT KILLED: with the unit\'s own words compared again, Q7\'s first unit frames itself', withinUnitMutant.loaded && withinUnitMutant.survived === false, JSON.stringify(withinUnitMutant));
    }
    // ── brain35-4 Y1 (2026-11-07; FIX3 FOUND 1; owner: "yes to the four") · «لا يصح أن …» IS AN ATTRIBUTION, NOT A GRADE ──
    // MEASURED (FIX3 H2.AFTER.out.txt (b), preview Q7): once X1 made the frame need a released statement, the frame moved to the
    // SECOND unit «ولذلك لا يصح أن ينسب إلى الرسول صلى الله عليه وسلم أنه قال هذا الكلام»: A-5's verb reader (verbGradeIn) read its
    // «لا يصح» as the family ضعيف against the head's «موضوع». «لا يصح / لا يثبت» + «أن» + a verb of attribution or speech (ينسب،
    // يُنسب، تنسب، نسبته، يقال، يُقال، يضاف، يُضاف، يروى، يُروى، يعزى، يُعزى، قال، يقول; folded as the reader folds, the salutation
    // allowed between) is a statement about the ATTRIBUTION, not a grade: one more negative lookahead beside `(?!\s+مرفوع)`. The
    // bare «لا يصح» and «لا يصح أن يُحتج به» (a grading judgement) stay the family ضعيف. The head and the units are the H2 strings.
    {
      const Q7y = "ما درجة حديث «حب الوطن من الإيمان»؟ ومن أخرجه؟";
      const HEAD7 = "حديث «حب الوطن من الإيمان» لا يصح عن النبي صلى الله عليه وسلم، فهو حديث موضوع.";
      const U2y = "ولذلك لا يصح أن ينسب إلى الرسول صلى الله عليه وسلم أنه قال هذا الكلام";
      const U3y = "ومعناه أيضا غير مستقيم من حيث المضمون، إذ إن حب الوطن كحب النفس والمال ونحوه، وكل ذلك غريزي في الإنسان لا يمدح بحبه ولا هو من لوازم الإيمان. والدليل على ذلك أن الناس كلهم مشتركون في هذا الحب، فلا فرق في ذلك بين مؤمنهم وكافرهم.";
      const U4y = "وحب الوطن أمر غريزي في الناس، مثل حب الحياة وكراهية الموت، فالإنسان الذي يحب الحياة لا يمدح ولا يذم على هذا الحب في ذاته، وإنما يمدح ويذم باعتبار ما يتعلق بحياته.";
      const framedY1 = (mod, value, priorText) => mod.frameHadithGradeDisagreement(value, { question: Q7y, priorText }) !== value;
      ok('Y1a the FIX3 FOUND-1 sentence «ولذلك لا يصح أن ينسب إلى الرسول …» after the released «موضوع» head -> no claim (no frame)', !framedY1(module, U2y + '.', HEAD7));
      ok('Y1b «لا يثبت أن النبي صلى الله عليه وسلم قال ذلك» after the head -> no claim (no frame)', !framedY1(module, 'لا يثبت أن النبي صلى الله عليه وسلم قال ذلك.', HEAD7));
      ok('Y1c the bare «هذا الحديث لا يصح» -> a claim of the family ضعيف (today\'s reading, pinned): the frame after the «موضوع» head', framedY1(module, 'هذا الحديث لا يصح.', HEAD7));
      ok('Y1d «لا يصح أن يُحتج به» -> a claim (today\'s reading, pinned): the frame after the «موضوع» head', framedY1(module, 'لا يصح أن يُحتج به.', HEAD7));
      const TURN7 = [HEAD7, U2y + '.', U3y, U4y];
      const framedUnits = TURN7.map((u, i) => framedY1(module, u, TURN7.slice(0, i).join('\n')));
      ok('Y1e the whole Q7 reviewer turn (the released «موضوع» head, the FOUND-1 second unit, the two meaning units) -> the frame on no unit', framedUnits.every((f) => !f), JSON.stringify(framedUnits));
      const LOOKAHEAD_Y1 = "(?!\\s+ان\\s+(?:\\S+\\s+){0,2}?(?:صلي الله عليه وسلم\\s+)?(?:ينسب|تنسب|نسبته|يقال|يضاف|يروي|يعزي|قال|قاله|قالها|يقول)(?=\\s|$))";
      const attributionMutant = await runMutant({
        sourceFile: REVIEWER,
        name: 'la-yasihhu-an-is-a-grade-again',
        transform: (source) => source.replace(LOOKAHEAD_Y1, ''),
        survives: (mutantModule) => !framedY1(mutantModule, U2y + '.', HEAD7),
      });
      ok('Y1 attribution-lookahead mutant seam applied and module loaded', attributionMutant.changed && attributionMutant.loaded, attributionMutant.error);
      ok('MUTANT KILLED: without the lookahead «لا يصح أن ينسب …» is the family ضعيف again and Q7\'s second unit frames', attributionMutant.loaded && attributionMutant.survived === false, JSON.stringify(attributionMutant));
    }
    // ── brain35-4 Y2 (2026-11-07; FIX3 FOUND 3; owner: "yes to the four") · «اختلفوا في <matter>» IS A DECLARED KHILAF ──
    // MEASURED (FIX3 H6c.AFTER.out.txt, live Q12): after X10 the two stance sentences are two views (releasedViewsIn=2) and the
    // trigger on the LIVE Mawsu'a row is still null: KHILAF_SOURCE_MARKERS read «في هذه المسألة خلاف», «خلاف بين أهل العلم»,
    // «اختلف(وا) (فيها) أهل العلم / العلماء / الفقهاء», «قولان» … and not the row's «اخْتَلَفُوا فِي وُجُوبِ الْحَجِّ …» (the verb + «في» + a
    // matter). One more marker: اختلف / اختلفوا / اختلفت (with or without a leading و / ف) + «في» + a matter word; the trigger still
    // needs two released views on the subject beside it (X10, X12). The row is the live card's text (BRAIN35-DIAG3-evidence/L12.book-matn.txt).
    {
      const S8y = khilafCases.cases.find((c) => c.id === 'S8-timing-dispute-two-stances');
      const LIVE12 = "وُجُوبُ الْحَجِّ عَلَى الْفَوْرِ أَوِ التَّرَاخِي: 5 - اخْتَلَفُوا فِي وُجُوبِ الْحَجِّ عِنْدَ تَحَقُّقِ الشُّرُوطِ هَل هُوَ عَلَى الْفَوْرِ أَوْ عَلَى التَّرَاخِي؟ . ذَهَبَ أَبُو حَنِيفَةَ فِي أَصَحِّ الرِّوَايَتَيْنِ عَنْهُ وَأَبُو يُوسُفَ وَمَالِكٌ فِي الرَّاجِحِ عَنْهُ وَأَحْمَدُ (1) إِلَى أَنَّهُ يَجِبُ عَلَى الْفَوْرِ، فَمَنْ تَحَقَّقَ فَرْضُ الْحَجِّ عَلَيْهِ فِي عَامٍ فَأَخَّرَهُ يَكُونُ آثِمًا، وَإِذَا أَدَّاهُ بَعْدَ ذَلِكَ كَانَ أَدَاءً لاَ قَضَاءً، وَارْتَفَعَ الإِْثْمُ. وَذَهَبَ الشَّافِعِيُّ وَالإِْمَامُ مُحَمَّدُ بْنُ الْحَسَنِ إِلَى أَنَّهُ يَجِبُ عَلَى التَّرَاخِي، فَلاَ يَأْثَمُ الْمُسْتَطِيعُ بِتَأْخِيرِهِ. وَالتَّأْخِيرُ إِنَّمَا يَجُوزُ بِشَرْطِ الْعَزْمِ عَلَى الْفِعْل فِي الْمُسْتَقْبَل، فَلَوْ خَشِيَ الْعَجْزَ أَوْ خَشِيَ هَلاَكَ مَالِهِ حَرُمَ التَّأْخِيرُ، أَمَّا التَّعْجِيل بِالْحَجِّ لِمَنْ وَجَبَ عَلَيْهِ فَهُوَ سُنَّةٌ عِنْدَ الشَّافِعِيِّ مَا لَمْ يَمُتْ، فَإِذَا مَاتَ تَبَيَّنَ أَنَّهُ كَانَ عَاصِيًا مِنْ آخِرِ سَنَوَاتِ الاِسْتِطَاعَةِ (2) . اسْتَدَل الْجُمْهُورُ عَلَى الْوُجُوبِ الْفَوْرِيِّ بِالآْتِي: أ - الْحَدِيثُ: مَنْ مَلَكَ زَادًا. وَرَاحِلَةً تُبَلِّغُهُ إِلَى بَيْتِ اللَّهِ، وَلَمْ يَحُجَّ فَلاَ عَلَيْهِ أَنْ يَمُوتَ يَهُودِيًّا أَوْ";
      const ONE_STANCE = "ذهب الجمهور إلى أن الحج يجب على الفور."; // the first S8 stance sentence alone
      const RC = await import(pathToFileURL(path.join(ROOT, 'lib', 'route-classify.js')).href);
      const triggerY2 = (mod, text) => mod.reviewAnswer({ ...S8y.input, text, evidence: [{ id: S8y.input.evidence[0].id, snippet: LIVE12 }], topic: S8y.input.topic, question: S8y.question, subjectTerms: QT.subjectTermsOf(S8y.question) }).verdict.khilafTrigger;
      ok('Y2a the live Q12 row («اخْتَلَفُوا فِي وُجُوبِ الْحَجِّ …») + the two S8 stance sentences -> the trigger is source', triggerY2(module, S8y.input.text) === 'source', String(triggerY2(module, S8y.input.text)));
      ok('Y2b the same row + ONE stance sentence -> null (the marker alone never fires the tail)', triggerY2(module, ONE_STANCE) === null, String(triggerY2(module, ONE_STANCE)));
      ok('Y2c «اختلفت الرواية عنه» (the verb with no «في» after it) -> no marker', !module.KHILAF_SOURCE_MARKERS.test(RC.normalizeArabic('اختلفت الرواية عنه.')));
      ok('Y2 the fixture keeps its 12 cases and every case its expected trigger (law 4: no re-cut)', khilafCases.cases.length === 12 && khilafCases.cases.every((t) => khilafCasePasses(module, t)));
      const MARKER_Y2 = "|\\u0627\\u062e\\u062a\\u0644\\u0641(?:\\u0648\\u0627|\\u062a)?\\s+\\u0641\\u064a\\s+\\p{L}{2,}"; // the alternative as it stands in the source line (\u-escaped)
      const markerMutant = await runMutant({
        sourceFile: REVIEWER,
        name: 'ikhtalafu-fi-is-no-marker',
        transform: (source) => source.replace(MARKER_Y2, ''),
        survives: (mutantModule) => triggerY2(mutantModule, S8y.input.text) === 'source',
      });
      ok('Y2 marker mutant seam applied and module loaded', markerMutant.changed && markerMutant.loaded, markerMutant.error);
      ok('MUTANT KILLED: without the marker the live Q12 row declares no khilaf and the trigger is null again', markerMutant.loaded && markerMutant.survived === false, JSON.stringify(markerMutant));
    }
    // ── brain35-5 Z4 (2026-11-08; DIAG4 C4 (a)) · TWO ROSTER NAMES ARE TWO MEN, NOT ONE UNRESOLVED NAME ───────────────
    // MEASURED (DIAG4 H4, preview Q25 «ما قول ابن باز وابن عثيمين في حكم صلاة الجماعة للرجال؟»): the plan read the conjunction
    // as ONE entity («ابن باز وابن عثيمين», resolved to nobody), api/ask.js built `requestedIdentity { status: 'unresolved' }`,
    // and because the first paragraph had lost its name the reviewer wrote «تنبيه: لم أتبيّنْ مَن تقصِد بالاسمِ الذي ذكرتَ …».
    // The builder now returns null when namedScholarsIn (lib/before-writing-v2.js, the roster) finds more than one man: the
    // arbiter (O-1) owns a two-shaykhs question and there is no single identity to respect. The builder is a closure inside
    // the handler, so the rows cut its IIFE out of api/ask.js by its own text and evaluate it with its three free names.
    {
      const PLAN = await import(pathToFileURL(path.join(ROOT, 'lib', 'ask-plan.js')).href);
      const BW2Z4 = await import(pathToFileURL(path.join(ROOT, 'lib', 'before-writing-v2.js')).href);
      const Q25 = 'ما قول ابن باز وابن عثيمين في حكم صلاة الجماعة للرجال؟';
      const Q25c = 'ما قول الشيخ ابن باز في حكم صلاة الجماعة للرجال؟';
      const askSrc = fs.readFileSync(path.join(ROOT, 'api', 'ask.js'), 'utf8').replace(/\r\n/g, '\n');
      const builderOf = (src) => {
        const open = '    const requestedIdentity = (() => {';
        const start = src.indexOf(open);
        const end = src.indexOf('\n    })();', start);
        if (start < 0 || end < 0) return null;
        const body = src.slice(start + '    const requestedIdentity = '.length, end + '\n    })();'.length).trim().replace(/;$/u, '');
        try { return new Function('plan', 'namedScholarsIn', 'ambiguousScholarPrompt', 'return ' + body); } catch (e) { return null; }
      };
      const build = builderOf(askSrc);
      const identityFor = (fn, q) => fn(PLAN.planAsk([{ role: 'user', content: q }], {}), BW2Z4.namedScholarsIn, PLAN.ambiguousScholarPrompt);
      ok('Z4 the identity builder is cut out of api/ask.js by its own text and evaluates', typeof build === 'function');
      ok('Z4 api/ask.js imports namedScholarsIn from lib/before-writing-v2.js beside the existing imports',
        /^import \{ namedScholarsIn \} from '\.\.\/lib\/before-writing-v2\.js';/mu.test(askSrc));
      const plan25 = PLAN.planAsk([{ role: 'user', content: Q25 }], {});
      ok('Z4a Q25 names two roster men (binbaz, binothaimeen) while the plan reads ONE entity «ابن باز وابن عثيمين» with no authority id (the inputs, pinned)',
        BW2Z4.namedScholarsIn(Q25).map((n) => n.id).join(',') === 'binbaz,binothaimeen' && plan25.attributionMode === 'namedScholarOpinion'
        && plan25.namedEntity === 'ابن باز وابن عثيمين' && !plan25.requestedAuthorityId, JSON.stringify([BW2Z4.namedScholarsIn(Q25).map((n) => n.id), plan25.namedEntity, plan25.requestedAuthorityId]));
      const id25 = build ? identityFor(build, Q25) : 'no builder';
      ok('Z4b Q25 -> requestedIdentity null (two men: the arbiter owns the question, no single identity to respect)', build && id25 === null, JSON.stringify(id25));
      const id25c = build ? identityFor(build, Q25c) : null;
      ok('Z4c Q25c «ما قول الشيخ ابن باز في …» -> ibn-baz resolved (unchanged)', !!id25c && id25c.status === 'resolved' && id25c.id === 'ibn-baz' && id25c.name === 'ابن باز', JSON.stringify(id25c));
      const WITNESS = 'فبعض أهل العلم رحمه الله يرى أن صلاة الجماعة واجبة على الرجال في المساجد، وأن التخلف عنها بغير عذر إثم.\n\nوقال ابن عثيمين رحمه الله: صلاة الجماعة واجبة على الرجال، ومن تركها بلا عذر فهو آثم، لكن صلاته صحيحة.\n\nوالراجح وجوبها على الأعيان.';
      const r25 = module.requestedIdentityRespected(WITNESS, module.identityView(id25 === 'no builder' ? null : id25));
      ok('Z4d the witness\'s three paragraphs under the Q25 identity -> respected, no notice', r25.respected === true && !r25.notice, JSON.stringify(r25));
      const rOld = module.requestedIdentityRespected(WITNESS, module.identityView({ id: '', name: 'ابن باز وابن عثيمين', status: 'unresolved', candidates: [] }));
      ok('Z4e the same text under the OLD joint identity -> the notice «تنبيه: لم أتبيّنْ مَن تقصِد …» (why the rule exists; the reviewer unchanged)',
        rOld.respected === false && rOld.reason === 'unresolved-substituted' && rOld.notice.startsWith('تنبيه: لم أتبيّنْ مَن تقصِد'), JSON.stringify(rOld));
      // the mutant: the two-names line removed from the builder -> Q25 is one unresolved name again
      {
        const seamZ4 = "      if (namedScholarsIn(name).length > 1) return null; // ITEM 35-D4 C4 (a) (brain35-5 Z4): two roster men are two men, not one unresolved name";
        ok('Z4 mutant seam present once', askSrc.split(seamZ4).length === 2);
        const mutant = builderOf(askSrc.split(seamZ4).join('      // mutant: the joint name stands as one'));
        const idM = mutant ? identityFor(mutant, Q25) : null;
        ok('Z4 MUTANT KILLED: without the two-names line Q25 is «ابن باز وابن عثيمين» unresolved again and the witness text draws the notice',
          !!idM && idM.status === 'unresolved' && idM.name === 'ابن باز وابن عثيمين' && module.requestedIdentityRespected(WITNESS, module.identityView(idM)).respected === false, JSON.stringify(idM));
      }
    }
    // ---------------------------------------------------------------- FIX5D F-D5b (2026-11-09; DIAG5 FOUND 2, preview Q2): ذهب THE NOUN IS NOT THE VIEW VERB.
    // MEASURED (DIAG5 H5): Q2's two parties were «ذهب المرأة» and «ذهب الزينة» -- the metal read as «ذهب X إلى». A closed exception: ذهب
    // followed by a noun of its own field, or governed by زكاة / preceded by في / من, opens no view clause. «ذهب الجمهور / الشافعي / ابن باز إلى …» unchanged.
    {
      const P1_D5B = "تجب الزكاة في ذهب المرأة الذي تلبسه وتتزين به، فقد سئل ابن باز عن زكاة الحلي من الذهب فأجاب: الصواب فيه الزكاة إذا بلغ النصاب، ولو كانت المرأة تلبسه وتتزين به عليها أن تزكيه إذا بلغ النصاب وحال عليه الحول، وهذا هو المختار من أقوال أهل العلم عنده."; // Q2's first paragraph (EXT report)
      const T2_D5B = "تجب الزكاة في ذهب المرأة الذي تلبسه وتتزين به، فقد سئل ابن باز عن زكاة الحلي من الذهب فأجاب: الصواب فيه الزكاة إذا بلغ النصاب، ولو كانت المرأة تلبسه وتتزين به عليها أن تزكيه إذا بلغ النصاب وحال عليه الحول، وهذا هو المختار من أقوال أهل العلم عنده.\n\nوالنصاب كما ذكر ابن باز هو اثنان وعشرون مثقالا، ومقداره بالغرام اثنان وتسعون غراما، ومقداره بالجنيه السعودي أحد عشر جنيها ونصف جنيه — ابن باز. فإذا بلغ الذهب هذا القدر وحال عليه الحول وجبت فيه الزكاة، فإن كان كثيرا فالواجب ربع العشر، أي في كل أربعين جنيها جنيه واحد.\n\nوقد سئل عبدالرحمن البراك عن الذهب الذي لا تلبسه المرأة إلا في المناسبات، فأجاب أن الحلي لبس أو لم يلبس لا يختلف حكمه، فالزكاة لا تتعلق بكونه يلبس أو لا يلبس، وإنما تتعلق بكونه مما يقصد لبسه، فما كان من الأساور والفتخات والقلائد مما يقصد للبس فحكمه واحد سواء لبس كل سنة أو كل شهر أو كل يوم.\n\nهل تجب الزكاة في ذهب الزينة الذي لا تلبسه المرأة إلا في المناسبات؟\n\nوبنحو هذا أجاب سليمان الماجد في مسألة الذهب الذي لا يلبس إلا نادرا، فقال: ما دام معدا للبس فلا زكاة فيه ولو لم يلبس إلا أحيانا.\n\nوفرق في موضع آخر بين الذهب المعد للبس فلا زكاة فيه، والمعد للادخار أو التجارة ففيه الزكاة.\n\nوأما من لا تملك نقودا تخرجها زكاة عن حليها، فقد بين ابن عثيمين أنها تزكي من الحلي نفسه، إما بإخراج شيء منه بقدر الزكاة، وإما بتقدير قيمته وإخراج ذلك من القيمة — ابن عثيمين."; // Q2's prose (EXT report lines 108-129, as DIAG5 H5 extracted it)
      const CONTROLS_D5B = ["ذهب الجمهور إلى وجوب الزكاة في الحلي.","ذهب الشافعي إلى وجوب الزكاة في الحلي.","فذهب ابن باز إلى وجوب الزكاة في الحلي."]; // SYNTHETIC
      ok('F-D5b-1 Q2\'s first paragraph («تجب الزكاة في ذهب المرأة …»): 0 parties', module.releasedViewsIn([P1_D5B]) === 0, String(module.releasedViewsIn([P1_D5B])));
      ok('F-D5b-2 Q2\'s prose: the two parties read from the gold nouns are gone (0)', module.releasedViewsIn([T2_D5B]) === 0, String(module.releasedViewsIn([T2_D5B])));
      ok('F-D5b-3 «ذهب الجمهور إلى …», «ذهب الشافعي إلى …», «فذهب ابن باز إلى وجوب الزكاة في الحلي» (SYNTHETIC): 1 each, unchanged',
        CONTROLS_D5B.every((t) => module.releasedViewsIn([t]) === 1), JSON.stringify(CONTROLS_D5B.map((t) => module.releasedViewsIn([t]))));
      const goldMutant = await runMutant({
        sourceFile: REVIEWER,
        name: 'fd5b-gold-exception-removed',
        transform: (source) => source.replace('const key = goldNotView(sentence, m) ? null : viewPartyKey(m[2], m[1]);', 'const key = viewPartyKey(m[2], m[1]); /* mutant: the gold exception removed */'),
        survives: (mm) => mm.releasedViewsIn([P1_D5B]) === 0,
      });
      ok('F-D5b mutant seam applied', goldMutant.changed, goldMutant.error);
      ok('F-D5b mutant module loaded', goldMutant.loaded, goldMutant.error);
      ok('F-D5b MUTANT KILLED: without the exception Q2\'s first paragraph counts the gold noun as a party again', goldMutant.loaded && goldMutant.survived === false, JSON.stringify(goldMutant));
    }
    ok('the pure reviewer made zero network calls', wireCalls === 0, String(wireCalls));
  } catch (error) {
    fail++;
    console.error('GUARD ERROR:', error && error.stack ? error.stack : error);
  }
  console.log(`SUMMARY PASS=${pass} FAIL=${fail}`);
  process.exit(fail ? 1 : 0);
})();
