'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const H = require('./_lib.cjs');

function recordMatchesAnnotation(record, page, manifestUrl) {
  const urlMatches = page.urlPrefixOnly ? manifestUrl.startsWith(page.url) : manifestUrl === page.url;
  return urlMatches
    && record.url === manifestUrl
    && record.authorityId === page.registryId
    && record.directAttribution === page.directAttribution
    && record.fullTextHash === page.fullTextHash;
}

module.exports = {
  id: 'G-08',
  async run(ctx) {
    const fixture = H.readJson(ctx.root, 'guards/fixtures/honesty/g08-rfc-round3.json');
    ctx.eq('G-08 fixture baseline is locked', fixture.baseline, ctx.baseline);
    for (const source of fixture.sources) {
      ctx.eq('G-08 source seal ' + source.key,
        H.sha256(H.gitShow(ctx.root, source.revision, source.path)), source.sha256);
    }
    const guard = fs.readFileSync(
      path.join(ctx.root, 'guards/rfc-v05r2-round3-guard.cjs'), 'utf8');
    ctx.ok('G-08 guard now labels model, plan, transport and HTML truth as authored',
      guard.includes('model replies, plans and most HTML bodies are authored doubles')
        && guard.includes('prove wiring and branch contracts'));
    ctx.ok('G-08 real preview planner acceptance remains explicitly not green',
      fixture.externalEvidence.acceptanceGreen === false
        && fixture.externalEvidence.previewDeploymentId === null
        && fixture.externalEvidence.providerPlannerRecord === null);

    const EXTRACT = await import(pathToFileURL(path.join(ctx.root, 'lib/transfer/extract.js')).href);
    const FULL = await import(pathToFileURL(path.join(ctx.root, 'lib/full-fatwa.js')).href);
    const REGISTRY = await import(pathToFileURL(path.join(ctx.root, 'lib/source-registry.js')).href);
    const manifest = H.readJson(ctx.root, 'data/transfer-fixtures/manifest.json');
    const measured = [];
    for (const page of fixture.pages) {
      const bytes = fs.readFileSync(path.join(ctx.root, 'data/transfer-fixtures', page.file));
      ctx.eq('G-08 real page blob seal ' + page.file, H.sha256(bytes), page.blobSha256);
      ctx.eq('G-08 real page byte count ' + page.file, bytes.length, page.bytes);
      const manifestUrl = manifest.pages[page.file] && manifest.pages[page.file].url;
      const pair = EXTRACT.extractPair(manifestUrl, bytes.toString('utf8'));
      ctx.ok('G-08 production extractor returns a real pair ' + page.file, !!pair);
      if (!pair) continue;
      ctx.eq('G-08 real question length ' + page.file, pair.question.length, page.questionChars);
      ctx.eq('G-08 real question seal ' + page.file,
        H.sha256(Buffer.from(pair.question, 'utf8')), page.questionSha256);
      ctx.eq('G-08 real answer length ' + page.file, pair.answer.length, page.answerChars);
      ctx.eq('G-08 real answer seal ' + page.file,
        H.sha256(Buffer.from(pair.answer, 'utf8')), page.answerSha256);
      const registry = REGISTRY.findSource(manifestUrl);
      ctx.eq('G-08 URL resolves to independently frozen registry id ' + page.file,
        registry && registry.id, page.registryId);
      const record = FULL.buildFatwaRecord({
        id: 'real:' + page.file,
        kind: 'live_page',
        sourceKind: 'live',
        url: manifestUrl,
        publisher: registry && registry.name,
        authorityId: registry && registry.id,
        directAttribution: page.directAttribution,
        contentMode: 'written_fatwa',
        question: pair.question,
        answer: pair.answer,
      });
      ctx.ok('G-08 real pair is a complete production fatwa record ' + page.file,
        FULL.recordUsableAsFatwa(record) && recordMatchesAnnotation(record, page, manifestUrl));
      const span = pair.answer.slice(page.supportSpan.offset, page.supportSpan.offset + page.supportSpan.chars);
      ctx.eq('G-08 independently frozen support span seal ' + page.file,
        H.sha256(Buffer.from(span, 'utf8')), page.supportSpan.sha256);
      ctx.ok('G-08 support span belongs to the same production record ' + page.file,
        FULL.verifySpan(record, span));
      measured.push({ page, record, span, manifestUrl });
    }

    const first = measured[0];
    const second = measured[1];
    ctx.ok('G-08 real-page precondition supplies two independent records', !!first && !!second);
    if (first && second) {
      const swappedAuthor = { ...first.record, authorityId: second.record.authorityId };
      ctx.ok('G-08 MUTANT 1 KILLED: swapping author while retaining a real URL breaks provenance',
        !recordMatchesAnnotation(swappedAuthor, first.page, first.manifestUrl));
      ctx.ok('G-08 MUTANT 2 KILLED: a quote from one real page cannot use another page locator',
        !FULL.verifySpan(first.record, second.span)
          && first.record.url !== second.record.url);
    }
  },
};
