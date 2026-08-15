'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const H = require('./_lib.cjs');

module.exports = {
  id: 'G-17',
  async run(ctx) {
    const fixture = H.readJson(ctx.root, 'guards/fixtures/honesty/g17-anchor-mode.json');
    ctx.eq('G-17 fixture baseline is locked', fixture.baseline, ctx.baseline);
    for (const source of fixture.sources) {
      ctx.eq('G-17 source seal ' + source.key,
        H.sha256(H.gitShow(ctx.root, source.revision, source.path)), source.sha256);
    }
    const guard = fs.readFileSync(path.join(ctx.root, 'guards/anchor-mode-guard.cjs'), 'utf8');
    ctx.ok('G-17 authored parser page and URL are explicitly diagnostic',
      guard.includes('AUTHORED DIAGNOSTICS PLUS SEALED REAL-PAGE ANCHORS')
        && guard.includes('fixture://authored-anchor-diagnostic')
        && !guard.includes('https://islamweb.net/ar/fatwa/1001/x'));
    ctx.ok('G-17 external current-liveness and reviewer records remain blocked',
      fixture.externalEvidence.status === 'BLOCKED_OFFLINE'
        && fixture.externalEvidence.acceptanceGreen === false
        && fixture.externalEvidence.currentLivenessRecord === null
        && fixture.externalEvidence.twoReviewerSemanticLabels === null);

    const manifest = H.readJson(ctx.root, 'data/transfer-fixtures/manifest.json');
    const EXTRACT = await import(pathToFileURL(path.join(ctx.root, 'lib/transfer/extract.js')).href);
    const ANCHOR = await import(pathToFileURL(path.join(ctx.root, 'lib/anchor/units.js')).href);
    const measured = [];
    for (const annotation of fixture.pages) {
      const entry = manifest.pages[annotation.file];
      const bytes = fs.readFileSync(path.join(ctx.root, 'data/transfer-fixtures', annotation.file));
      ctx.ok('G-17 real page seal and URL identity ' + annotation.file,
        !!entry && H.sha256(bytes) === annotation.sha256
          && entry.sha256 === annotation.sha256
          && H.sha256(Buffer.from(entry.url, 'utf8')) === annotation.urlSha256);
      const pair = EXTRACT.extractPair(entry.url, bytes.toString('utf8'));
      ctx.ok('G-17 real page extracts the independently sealed answer ' + annotation.file,
        pair && pair.answer.length === annotation.answerChars
          && H.sha256(Buffer.from(pair.answer, 'utf8')) === annotation.answerSha256);
      if (!pair) continue;
      const span = pair.answer.slice(annotation.span.offset,
        annotation.span.offset + annotation.span.chars);
      ctx.ok('G-17 exact published span keeps its seal ' + annotation.file,
        annotation.claimForm === 'exact-published-span'
          && H.sha256(Buffer.from(span, 'utf8')) === annotation.span.sha256);
      const unit = { claim: span.replace(/\s+/gu, ' ').trim(), url: entry.url, span };
      const requestPages = [{ url: entry.url, passage: pair.answer }];
      const result = ANCHOR.verifyUnits([unit], requestPages);
      ctx.ok('G-17 production verifier keeps the real request-page unit ' + annotation.file,
        result.kept.length === 1 && result.dropped.length === 0
          && ANCHOR.composeUnits(result.kept).includes(unit.claim));
      measured.push({ unit, requestPages });
    }
    ctx.eq('G-17 two independent real anchor records were measured', measured.length, 2);
    if (measured.length === 2) {
      const wrongUrl = { ...measured[0].unit, url: measured[1].requestPages[0].url };
      const wrong = ANCHOR.verifyUnits([wrongUrl], measured[0].requestPages);
      ctx.ok('G-17 MUTANT 1 KILLED: changing source URL while retaining text fails request identity',
        wrong.kept.length === 0 && wrong.dropped[0]?.why === 'url-not-retrieved');
      const missing = ANCHOR.verifyUnits([{ ...measured[0].unit, span: '' }],
        measured[0].requestPages);
      ctx.ok('G-17 MUTANT 2 KILLED: retaining claim after removing support span fails',
        missing.kept.length === 0 && missing.dropped[0]?.why === 'no-span'
          && !ANCHOR.composeUnits(missing.kept).includes(measured[0].unit.claim));
    }
  },
};
