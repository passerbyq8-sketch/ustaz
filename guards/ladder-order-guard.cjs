// guards/ladder-order-guard.cjs — apology is the last rung, never the first.
'use strict';

const path = require('path');
const { fresh, runMutant, harness } = require('./output-reviewer-mutant-lib.cjs');
const REVIEWER = path.resolve(__dirname, '..', 'lib', 'output-reviewer.js');
const { ok, finish } = harness('ladder-order');

const matchedInput = {
  text: 'قال ابن باز إن الجمع للمسافر جائز عند الحاجة.', domain: 'fiqh', mode: 'عادي',
  evidence: [{
    id: 'bb-1', title: 'حكم الجمع', url: 'https://binbaz.org.sa/fatwas/1/x', scholar: 'ابن باز',
    snippet: 'الجمع للمسافر جائز عند الحاجة إذا وجد سببه.',
  }],
};
const usesHigherRung = (module) => {
  const out = module.reviewAnswer(matchedInput);
  return out.text === matchedInput.text
    && out.text !== module.REVIEW_LAST_RESORT
    && out.annotations[0]?.action === 'kept-sourced-attribution';
};

(async () => {
  try {
    const module = await fresh(REVIEWER, 'ladder-base');
    ok('matching evidence uses the top rung', usesHigherRung(module));
    const generalized = module.reviewAnswer({ ...matchedInput, evidence: [] });
    ok('without matching evidence, usable understanding beats apology',
      generalized.text.includes(module.REVIEW_TAGS.ATTRIBUTION_REMOVED)
        && generalized.text !== module.REVIEW_LAST_RESORT, generalized.text);
    const plain = module.reviewAnswer({
      text: 'الجمع للمسافر جائز عند الحاجة.', evidence: [], domain: 'fiqh', mode: 'عادي',
    });
    ok('an unattributed understanding also beats apology',
      plain.text.includes(module.REVIEW_TAGS.FIQH_UNSOURCED) && plain.text !== module.REVIEW_LAST_RESORT, plain.text);

    const mutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'apology-despite-matching-evidence',
      transform: (source) => source.replace(
        'if (matched) {\n            output.push(part);',
        'if (matched) {\n            output.push(LAST_RESORT);'),
      survives: usesHigherRung,
    });
    ok('mutant seam applied', mutant.changed, mutant.error);
    ok('mutant module loaded successfully', mutant.loaded, mutant.error);
    ok('MUTANT KILLED: matching evidence cannot be replaced by the apology rung',
      mutant.loaded && mutant.survived === false, JSON.stringify(mutant));
  } catch (error) {
    ok('guard completed without exception', false, error?.stack || String(error));
  }
  process.exit(finish());
})();
