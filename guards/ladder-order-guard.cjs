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
    // ── THE RUNG IS READ FROM THE SENTENCE NOW, NOT FROM ITS BADGE (owner, 18 Sep) ──
    //
    // «Usable understanding beats apology» was proved by the presence of ATTRIBUTION_REMOVED: the
    // badge was how this guard knew the reviewer had taken the middle rung rather than the last.
    // The badge is no longer written, so the same rung is read off the three things it announced,
    // each of which is still there to be measured:
    //
    //   the CREDIT came off  — the authority the reviewer recorded stripping is absent from the text;
    //   the SENTENCE stayed  — what ships is a suffix of what arrived, so only a prefix was removed
    //                          and the ruling clause behind it is verbatim, not paraphrased or cut;
    //   the APOLOGY was not taken — the text is not the last-resort line.
    //
    // `endsWith` is the strict form on purpose. A reviewer that deleted the ruling and kept only the
    // full stop would still satisfy «not the apology», and this clause is what refuses it.
    ok('without matching evidence, usable understanding beats apology',
      generalized.annotations[0]?.action === 'removed-unsupported-attribution'
        && typeof generalized.annotations[0]?.claimedAuthority === 'string'
        && generalized.annotations[0].claimedAuthority.length > 0
        && !generalized.text.includes(generalized.annotations[0].claimedAuthority)
        // THIRD ORDER, STEP 6: what ships is the general speaker and then a suffix of what arrived.
        // FIFTH ORDER [r44] (1): the suffix is everything after the name, «إن» included, with no
        // colon of the reviewer's own in front of it.
        // [111-b4b-14] the owner's formula; «يرى» takes «أنّ» where «قال» took «إنّ» — that one letter
        // is the only byte of the suffix that moves, so the suffix is compared from the letter after it.
        && generalized.text.startsWith('ومن أهل العلم من يرى أ')
        && matchedInput.text.endsWith(generalized.text.slice('ومن أهل العلم من يرى أ'.length))
        && generalized.text.length > matchedInput.text.length / 2
        && generalized.text !== module.REVIEW_LAST_RESORT, generalized.text);
    const plainInput = {
      text: 'الجمع للمسافر جائز عند الحاجة.', evidence: [], domain: 'fiqh', mode: 'عادي',
    };
    const plain = module.reviewAnswer(plainInput);
    // The same reading for the rung below it: an understanding that never claimed a source at all is
    // delivered WHOLE — byte-for-byte what arrived — and is not exchanged for the apology.
    ok('an unattributed understanding also beats apology',
      plain.text === plainInput.text
        && plain.annotations[0]?.action === 'tagged-fiqh-understanding'
        && plain.text !== module.REVIEW_LAST_RESORT, plain.text);
    // AND THE OWNER'S REMOVAL IS ITSELF PINNED HERE: neither rung may wear a badge again.
    ok('...and neither rung wears a review tag any more',
      !Object.values(module.REVIEW_TAGS).some((reviewTag) =>
        generalized.text.includes(reviewTag) || plain.text.includes(reviewTag)),
      generalized.text + ' | ' + plain.text);

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
