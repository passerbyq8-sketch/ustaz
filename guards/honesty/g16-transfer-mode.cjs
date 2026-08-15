'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const H = require('./_lib.cjs');

function freshWitnessValid(record, expectedUrlSha256) {
  return !!(record
    && record.status === 'CAPTURED'
    && record.acceptanceGreen === true
    && record.requestId
    && /^[a-f0-9]{64}$/.test(record.rawResponseSha256 || '')
    && record.urlSha256 === expectedUrlSha256
    && record.extractorResult === 'pair'
    && record.currentQuestionChars > 0
    && record.currentAnswerChars > 0);
}

module.exports = {
  id: 'G-16',
  async run(ctx) {
    const fixture = H.readJson(ctx.root, 'guards/fixtures/honesty/g16-transfer-mode.json');
    ctx.eq('G-16 fixture baseline is locked', fixture.baseline, ctx.baseline);
    for (const source of fixture.sources) {
      ctx.eq('G-16 source seal ' + source.key,
        H.sha256(H.gitShow(ctx.root, source.revision, source.path)), source.sha256);
    }
    const manifest = H.readJson(ctx.root, 'data/transfer-fixtures/manifest.json');
    ctx.eq('G-16 independently frozen page roster',
      Object.keys(manifest.pages), fixture.pages.map((page) => page.file));
    ctx.ok('G-16 manifest uses only full SHA-256 seals',
      Object.values(manifest.pages).every((page) =>
        /^[a-f0-9]{64}$/.test(page.sha256 || '') && !Object.hasOwn(page, 'sha8')));
    const EXTRACT = await import(pathToFileURL(path.join(ctx.root, 'lib/transfer/extract.js')).href);
    const MATCH = await import(pathToFileURL(path.join(ctx.root, 'lib/transfer/match.js')).href);
    const pairs = new Map();
    for (const page of fixture.pages) {
      const entry = manifest.pages[page.file];
      const bytes = fs.readFileSync(path.join(ctx.root, 'data/transfer-fixtures', page.file));
      ctx.ok('G-16 full real-page seal and URL identity ' + page.file,
        !!entry
          && entry.sha256 === page.sha256
          && H.sha256(bytes) === page.sha256
          && bytes.length === page.bytes
          && H.sha256(Buffer.from(entry.url, 'utf8')) === page.urlSha256);
      const pair = EXTRACT.extractPair(entry.url, bytes.toString('utf8'));
      if (page.pair === null) {
        ctx.eq('G-16 production extractor refuses real page ' + page.file, pair, null);
      } else {
        ctx.eq('G-16 production extractor preserves real pair lengths ' + page.file,
          pair && [pair.question.length, pair.answer.length], page.pair);
        ctx.eq('G-16 identical real question transfers ' + page.file,
          pair && MATCH.compareQuestions(pair.question, pair.question).verdict, 'transfer');
        if (pair) pairs.set(page.file, pair);
      }
    }

    const semantic = fixture.semanticCase;
    const pair = pairs.get(semantic.file);
    const qualifier = String.fromCodePoint(...semantic.qualifierCodePoints);
    const comparison = pair && MATCH.compareQuestions(pair.question, pair.question + qualifier);
    ctx.ok('G-16 real long question is highly similar but qualifier-conflicted',
      comparison
        && comparison.score >= semantic.minimumSimilarity
        && comparison.flips.length === semantic.expectedFlipCount
        && comparison.verdict === semantic.expectedVerdict);
    const bypassed = comparison && (comparison.score >= MATCH.TRANSFER_MATCH ? 'transfer' : comparison.verdict);
    ctx.ok('G-16 MUTANT 1 KILLED: similarity cannot bypass a real qualifier conflict',
      bypassed !== semantic.expectedVerdict);

    // MERGE ROUND: the capture happened, against the real host, with the manifest's own user agent
    // and the shipped extractor. It is checked by the SAME validator the offline round wrote for
    // this moment -- freshWitnessValid -- so nothing about the bar was rewritten to fit the
    // evidence. The page it was taken from is named by its URL seal, not by trust.
    ctx.ok('G-16 current-markup evidence is captured and satisfies the fresh-witness contract',
      freshWitnessValid(fixture.currentMarkupEvidence, fixture.pages[0].urlSha256));
    ctx.ok('G-16 the live capture does not pretend a live raw hash is a seal',
      fixture.currentMarkupEvidence.rawSealIsStable === false
        && fixture.currentMarkupEvidence.rawResponseSha256 !== fixture.currentMarkupEvidence.frozenSha256
        && typeof fixture.currentMarkupEvidence.rawSealNote === 'string'
        && fixture.currentMarkupEvidence.rawSealNote.length > 0);
    ctx.ok('G-16 MUTANT 3 KILLED: a capture pinned to the wrong page cannot pass',
      !freshWitnessValid(fixture.currentMarkupEvidence, fixture.pages[1].urlSha256));
    const freshBase = {
      status: 'CAPTURED', acceptanceGreen: true, requestId: 'req_markup_probe',
      rawResponseSha256: 'a'.repeat(64), urlSha256: fixture.pages[4].urlSha256,
      extractorResult: 'pair', currentQuestionChars: 615, currentAnswerChars: 1900,
    };
    ctx.ok('G-16 fresh-witness validator accepts its consistent precondition',
      freshWitnessValid(freshBase, fixture.pages[4].urlSha256));
    const brokenMarkup = {
      ...freshBase, rawResponseSha256: 'b'.repeat(64), extractorResult: 'refused',
      currentQuestionChars: 0, currentAnswerChars: 0,
    };
    ctx.ok('G-16 MUTANT 2 KILLED: current broken markup cannot inherit an old fixture green',
      !freshWitnessValid(brokenMarkup, fixture.pages[4].urlSha256));
  },
};
