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
    // MERGE ROUND: the planner record exists now, produced by the deployed preview. What the
    // assertion has to prevent is a record that merely LOOKS live: the deployment id, the git sha
    // and the request id are what tie these lines to one real invocation, and a record without
    // them is prose. reviewerLabels stays empty and must say why -- a human label is not measurable.
    const evidence = fixture.externalEvidence;
    const named = (value) => typeof value === 'string' && value.length > 0;
    function evidenceIsHonest(subject) {
      const record = subject.providerPlannerRecord;
      if (record !== null) {
        if (!/^dpl_[A-Za-z0-9]+$/.test(subject.previewDeploymentId || '')) return false;
        if (!/^[0-9a-f]{40}$/.test(record.deployedGitSha || '')) return false;
        if (!named(record.vercelId) || !named(record.plan) || !named(record.groupOutcome)) return false;
        if (!Array.isArray(record.providerCalls) || !record.providerCalls.length) return false;
      }
      if (subject.reviewerLabels === null
        && !named(subject.blocked && subject.blocked.reviewerLabels)) return false;
      if (subject.acceptanceGreen === true
        && (record === null || subject.reviewerLabels === null)) return false;
      return named(subject.reason);
    }
    ctx.ok('G-08 the preview planner record is tied to one named deployed invocation',
      evidence.acceptanceGreen === false
        && evidence.providerPlannerRecord !== null
        && evidenceIsHonest(evidence));
    ctx.ok('G-08 MUTANT 3 KILLED: a planner record with no deployment id behind it fails',
      !evidenceIsHonest({ ...evidence, previewDeploymentId: null }));
    ctx.ok('G-08 MUTANT 4 KILLED: acceptance green while reviewer labels are empty fails',
      !evidenceIsHonest({ ...evidence, acceptanceGreen: true }));
    ctx.ok('G-08 MUTANT 5 KILLED: an empty reviewer-label field with no stated reason fails',
      !evidenceIsHonest({ ...evidence, blocked: {} }));

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
