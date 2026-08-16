// guards/tag-honesty-guard.cjs — understanding is visibly tagged; sourced text is not falsely tagged.
'use strict';

const path = require('path');
const { fresh, runMutant, harness } = require('./output-reviewer-mutant-lib.cjs');
const REVIEWER = path.resolve(__dirname, '..', 'lib', 'output-reviewer.js');
const { ok, finish } = harness('tag-honesty');

const attributedText = 'قال ابن باز إن الجمع للمسافر جائز عند الحاجة.';
const correct = {
  id: 'bb-1', title: 'حكم الجمع', url: 'https://binbaz.org.sa/fatwas/1/x', scholar: 'ابن باز',
  snippet: 'الجمع للمسافر جائز عند الحاجة إذا وجد سببه.',
};
const unsupportedIsTagged = (module) => {
  const out = module.reviewAnswer({ text: attributedText, evidence: [], domain: 'fiqh', mode: 'عادي' });
  return out.text.includes(module.REVIEW_TAGS.ATTRIBUTION_REMOVED)
    && out.annotations[0]?.action === 'removed-unsupported-attribution';
};

(async () => {
  try {
    const module = await fresh(REVIEWER, 'tag-base');
    ok('unsupported attribution becomes visibly tagged understanding', unsupportedIsTagged(module));
    const sourced = module.reviewAnswer({
      text: attributedText, evidence: [correct], domain: 'fiqh', mode: 'عادي',
    });
    ok('genuinely sourced attribution carries no false understanding tag',
      sourced.text === attributedText
        && !Object.values(module.REVIEW_TAGS).some((visible) => sourced.text.includes(visible)), sourced.text);
    const plainFiqh = module.reviewAnswer({
      text: 'الجمع للمسافر جائز.', evidence: [], domain: 'fiqh', mode: 'عادي',
    });
    ok('unattributed fiqh understanding is tagged as understanding, not fatwa',
      plainFiqh.text.includes(module.REVIEW_TAGS.FIQH_UNSOURCED), plainFiqh.text);
    const stable = module.reviewAnswer({
      text: 'ناتج اثنين زائد اثنين أربعة.', evidence: [], domain: 'general', mode: 'موجز',
    });
    ok('stable unsourced general knowledge is tagged without demanding a source',
      stable.text.includes(module.REVIEW_TAGS.GENERAL_STABLE) && !stable.text.includes('المصدر:'), stable.text);

    const mutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'strip-unsupported-attribution-without-tag',
      transform: (source) => source.replace(
        'const reviewed = generalized ? tag(generalized, TAGS.ATTRIBUTION_REMOVED) : \'\';',
        'const reviewed = generalized; // mutant: hide that this is understanding'),
      survives: unsupportedIsTagged,
    });
    ok('mutant seam applied', mutant.changed, mutant.error);
    ok('mutant module loaded successfully', mutant.loaded, mutant.error);
    ok('MUTANT KILLED: removing the honesty tag is detected',
      mutant.loaded && mutant.survived === false, JSON.stringify(mutant));
  } catch (error) {
    ok('guard completed without exception', false, error?.stack || String(error));
  }
  process.exit(finish());
})();
