// guards/domain-contract-guard.cjs — general answers do not inherit the fatwa contract.
'use strict';

const path = require('path');
const { fresh, runMutant, harness } = require('./output-reviewer-mutant-lib.cjs');
const REVIEWER = path.resolve(__dirname, '..', 'lib', 'output-reviewer.js');
const { ok, finish } = harness('domain-contract');

const stableInput = {
  text: 'ناتج ضرب سبعة في ثمانية هو ستة وخمسون.', evidence: [], domain: 'general', mode: 'موجز',
};
const retrievedButUnneeded = {
  id: 'math-1', title: 'جدول الضرب', url: 'https://education.example/math/seven-times-eight',
  scholar: 'موسوعة تعليمية', snippet: 'سبعة في ثمانية يساوي ستة وخمسين.', date: '2026-08-16',
};
const keepsStableGeneral = (module) => {
  const out = module.reviewAnswer(stableInput);
  return out.text.includes('ستة وخمسون')
    && out.text.includes(module.REVIEW_TAGS.GENERAL_STABLE)
    && !out.text.includes(module.REVIEW_TAGS.FIQH_UNSOURCED)
    && !out.text.includes('لم يصلني نصٌّ')
    && !out.text.includes('المصدر:');
};

(async () => {
  try {
    const module = await fresh(REVIEWER, 'domain-base');
    ok('stable general knowledge remains answerable without a source', keepsStableGeneral(module));
    const uncarded = module.reviewAnswer({ ...stableInput, evidence: [retrievedButUnneeded] });
    ok('a retrieved result does not earn a source tail when stable knowledge needs none',
      !uncarded.text.includes(retrievedButUnneeded.url)
        && !uncarded.text.includes('المصدر:')
        && uncarded.annotations[0]?.evidenceId === undefined, uncarded.text);
    const dynamic = module.reviewAnswer({
      text: 'درجة الحرارة اليوم في الكويت 38 مئوية.', domain: 'general', mode: 'عادي',
      evidence: [{
        id: 'w1', title: 'طقس الكويت', url: 'https://weather.example/kuwait',
        scholar: 'إدارة الأرصاد', snippet: 'درجة الحرارة اليوم في الكويت 38 مئوية.', date: '2026-08-16',
      }],
    });
    ok('mutable general knowledge receives its dated link, not a fatwa wrapper',
      /https:\/\/weather\.example\/kuwait/u.test(dynamic.text)
        && /2026-08-16/u.test(dynamic.text)
        && !dynamic.text.includes(module.REVIEW_TAGS.FIQH_UNSOURCED), dynamic.text);
    const wrongNumber = module.reviewAnswer({
      text: 'درجة الحرارة اليوم في الكويت 38 مئوية.', domain: 'general', mode: 'عادي',
      evidence: [{
        id: 'w2', title: 'طقس الكويت', url: 'https://weather.example/kuwait',
        scholar: 'إدارة الأرصاد', snippet: 'درجة الحرارة اليوم في الكويت 20 مئوية.', date: '2026-08-16',
      }],
    });
    ok('a topical dated source with a different number does not license the mutable claim',
      wrongNumber.text === module.REVIEW_DYNAMIC_UNSOURCED
        && !wrongNumber.text.includes('https://weather.example/kuwait'), wrongNumber.text);

    const mutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'force-general-through-fiqh-law',
      transform: (source) => source.replace(
        "if (scopedDomain === 'fiqh') {",
        "if (scopedDomain === 'fiqh' || scopedDomain === 'general') {"),
      survives: keepsStableGeneral,
    });
    ok('mutant seam applied', mutant.changed, mutant.error);
    ok('mutant module loaded successfully', mutant.loaded, mutant.error);
    ok('MUTANT KILLED: a general arithmetic answer cannot become a fatwa refusal/contract',
      mutant.loaded && mutant.survived === false, JSON.stringify(mutant));

    const cardMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'every-retrieved-result-earns-a-card',
      transform: (source) => source.replace(
        'const reviewed = tag(sentence, TAGS.GENERAL_STABLE);\n    output.push(reviewed);',
        "const reviewed = sources[0] ? `${tag(sentence, TAGS.GENERAL_STABLE)}\\n${sourceTail(sources[0])}` : tag(sentence, TAGS.GENERAL_STABLE);\n    output.push(reviewed);"),
      survives: (mutantModule) => {
        const out = mutantModule.reviewAnswer({ ...stableInput, evidence: [retrievedButUnneeded] });
        return !out.text.includes(retrievedButUnneeded.url) && !out.text.includes('المصدر:');
      },
    });
    ok('card-entitlement mutant seam applied', cardMutant.changed, cardMutant.error);
    ok('card-entitlement mutant module loaded successfully', cardMutant.loaded, cardMutant.error);
    ok('MUTANT KILLED: retrieval alone cannot award a visible source tail',
      cardMutant.loaded && cardMutant.survived === false, JSON.stringify(cardMutant));
  } catch (error) {
    ok('guard completed without exception', false, error?.stack || String(error));
  }
  process.exit(finish());
})();
