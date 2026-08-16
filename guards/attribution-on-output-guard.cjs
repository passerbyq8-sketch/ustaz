// guards/attribution-on-output-guard.cjs — a name needs this-turn evidence from its own source.
'use strict';

const path = require('path');
const { fresh, runMutant, harness } = require('./output-reviewer-mutant-lib.cjs');
const REVIEWER = path.resolve(__dirname, '..', 'lib', 'output-reviewer.js');
const { ok, finish } = harness('attribution-on-output');

const text = 'قال ابن باز إن الجمع للمسافر جائز عند الحاجة.';
const supporting = {
  id: 'bb-1', title: 'حكم الجمع للمسافر', url: 'https://binbaz.org.sa/fatwas/1/x',
  scholar: 'ابن باز', snippet: 'الجمع للمسافر جائز عند الحاجة إذا وجد سببه.',
};
const wrongScholar = {
  id: 'wrong-1', title: 'حكم الجمع للمسافر', url: 'https://binbaz.org.sa/fatwas/2/x',
  scholar: 'ابن عثيمين', snippet: 'الجمع للمسافر جائز عند الحاجة إذا وجد سببه.',
};
const oppositeRuling = {
  ...supporting,
  id: 'bb-opposite',
  snippet: 'الجمع للمسافر غير جائز في هذه الصورة ولا يباح له فعله.',
};
const input = (evidence) => ({ text, evidence, domain: 'fiqh', mode: 'عادي' });
const rejectsWrongScholar = (module) => {
  const out = module.reviewAnswer(input([wrongScholar]));
  return !out.text.includes('ابن باز')
    && out.text.includes(module.REVIEW_TAGS.ATTRIBUTION_REMOVED)
    && out.annotations[0]?.action === 'removed-unsupported-attribution';
};

(async () => {
  try {
    const module = await fresh(REVIEWER, 'attribution-base');
    const good = module.reviewAnswer(input([supporting]));
    ok('matching name + official domain + supporting snippet passes byte-identically',
      good.text === text && good.annotations[0]?.action === 'kept-sourced-attribution', good.text);
    const nextCycle = module.reviewAnswer(input([]));
    ok('evidence from the preceding call grants no licence in the next cycle',
      !nextCycle.text.includes('ابن باز')
        && nextCycle.annotations[0]?.action === 'removed-unsupported-attribution', nextCycle.text);
    ok('evidence for another scholar strips the attribution and keeps the claim',
      rejectsWrongScholar(module), module.reviewAnswer(input([wrongScholar])).text);
    const wrongDomain = { ...supporting, url: 'https://example.test/fatwa/1' };
    ok('matching name on the wrong domain is not a licence',
      rejectsWrongScholar({
        ...module,
        reviewAnswer: () => module.reviewAnswer(input([wrongDomain])),
      }), module.reviewAnswer(input([wrongDomain])).text);
    const irrelevant = { ...supporting, snippet: 'هذا نص في زكاة الحبوب والثمار.' };
    ok('the right scholar and host with an unrelated snippet is not a licence',
      module.reviewAnswer(input([irrelevant])).annotations[0]?.action === 'removed-unsupported-attribution');
    ok('the right scholar and host carrying the opposite ruling is not a licence',
      module.reviewAnswer(input([oppositeRuling])).annotations[0]?.action === 'removed-unsupported-attribution');
    const honorific = module.reviewAnswer(input([{ ...supporting, scholar: 'الشيخ ابن باز' }]));
    ok('an honorific in evidence does not break the exact authority match',
      honorific.text === text && honorific.annotations[0]?.action === 'kept-sourced-attribution');
    for (const framed of [
      'يرى ابن باز جواز الجمع للمسافر.',
      'رأي الشيخ ابن باز أن الجمع للمسافر جائز.',
      'ابن باز يرى أن الجمع للمسافر جائز.',
      'حكم ابن باز هو تحريم الدخان.',
      'ابن باز يحرّم الدخان.',
      'قال ابنُ بازٍ بجواز الجمع للمسافر.',
      'وفقًا لابن باز، الجمع للمسافر جائز.',
    ]) {
      const out = module.reviewAnswer({ text: framed, evidence: [], domain: 'fiqh', mode: 'عادي' });
      ok('unsupported attribution frame is removed: ' + framed,
        out.annotations[0]?.action === 'removed-unsupported-attribution'
          && !out.text.includes('ابن باز')
          && out.text.includes(module.REVIEW_TAGS.ATTRIBUTION_REMOVED), out.text);
    }

    const mutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'wrong-scholar-counts-as-same',
      transform: (source) => source.replace(
        'sameAuthority(attribution.claimed, item.scholar)\n    && officialSourceFor(attribution.claimed, item)',
        'Boolean(item.scholar)\n    && officialSourceFor(attribution.claimed, item)'),
      survives: rejectsWrongScholar,
    });
    ok('mutant seam applied', mutant.changed, mutant.error);
    ok('mutant module loaded successfully', mutant.loaded, mutant.error);
    ok('MUTANT KILLED: another scholar on the claimed domain cannot license the name',
      mutant.loaded && mutant.survived === false, JSON.stringify(mutant));

    const supportMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'right-name-and-host-license-opposite-ruling',
      transform: (source) => source.replace('\n    && supportsSentence(sentence, item)) || null;', ') || null;'),
      survives: (mutantModule) => mutantModule.reviewAnswer(input([oppositeRuling]))
        .annotations[0]?.action === 'removed-unsupported-attribution',
    });
    ok('support mutant seam applied', supportMutant.changed, supportMutant.error);
    ok('support mutant module loaded successfully', supportMutant.loaded, supportMutant.error);
    ok('MUTANT KILLED: matching identity cannot license the opposite ruling',
      supportMutant.loaded && supportMutant.survived === false, JSON.stringify(supportMutant));
  } catch (error) {
    ok('guard completed without exception', false, error?.stack || String(error));
  }
  process.exit(finish());
})();
