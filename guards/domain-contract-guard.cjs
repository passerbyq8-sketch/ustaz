// guards/domain-contract-guard.cjs — general answers do not inherit the fatwa contract.
'use strict';

const fs = require('fs');
const path = require('path');
const { fresh, runMutant, harness } = require('./output-reviewer-mutant-lib.cjs');
const REVIEWER = path.resolve(__dirname, '..', 'lib', 'output-reviewer.js');
const CORPUS = path.resolve(__dirname, '..', 'fixtures', 'reviewer-variable-claim-corpus.json');
const { ok, finish } = harness('domain-contract');

// ── THE RULE AS IT STOOD BEFORE THE REPAIR (§١) ─────────────────────────────
// Written out here, whole, because the property being proved below is a CONTAINMENT: the narrowed
// rule may fire only where this one fired. A guard that could not state the old rule could not
// tell a narrowing apart from a rewrite, and a rewrite is how a guard gets talked into accepting
// a new set of false positives in exchange for the old ones.
const PRE_REPAIR_MARKERS = /(?:اليوم|الآن|حالي[ًاا]?|أحدث|آخر\s+(?:خبر|الأخبار|سعر|نتيجة)|طقس|درجة\s+الحرارة|سعر|أسعار|نتيجة|أخبار|خبر\s+عاجل|بورصة|سهم|سعر\s+الصرف|عدد\s+الإصابات|هذا\s+(?:الأسبوع|الشهر|العام))/u;

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

    // ── §١: WHAT A VARIABLE CLAIM IS, MEASURED AND NOT GUESSED ───────────────
    //
    // THE DEFECT. The rule that replaces an unsupported claim about the changing world used to
    // fire on ANY ONE of seventeen markers, and replacing means DELETING the sentence and putting
    // «لم يصلني مصدرٌ مؤرّخ…» where it stood. On the owner's twenty-question battery it fired
    // eight times — twice inside one worked equation and four times inside another — so the reader
    // watched «٢س + ٥٠ = ٥٥» being solved with a refusal wedged between the lines of the solution.
    //
    // THE MEASUREMENT. fixtures/reviewer-variable-claim-corpus.json holds EVERY sentence in all
    // eighty answers of that battery that the pre-repair rule matched, produced by
    // tools/reviewer-dynamic-measure.mjs. Fourteen of them, and not one is a variable claim: three
    // are the verb «أحدثَ» (broke his ablution) read as the elative «latest», three are the
    // unknown of a word problem, four are «الآن» in a race riddle and in a creedal constant, two
    // are «ذلك اليوم» of a broken fast, one is «الأخبار الصحيحة» about the Prophet, and one is a
    // sentence that says outright that it is not about real prices.
    //
    // The four cases after them are NOT from the corpus. They are the negative witness, and they
    // are why this section cannot be satisfied by a reviewer that simply stopped checking.
    const corpus = JSON.parse(fs.readFileSync(CORPUS, 'utf8'));
    ok('the variable-claim corpus schema is exact',
      corpus.schema === 'ezik.reviewer.variable-claim-corpus.v1');
    ok('the corpus carries the fourteen measured sentences and the four-case negative witness',
      corpus.cases.length === 18
        && corpus.cases.filter((c) => !c.variable).length === 14
        && corpus.cases.filter((c) => c.variable).length === 4,
      JSON.stringify(corpus.cases.length));
    // Every measured sentence is fed through the GENERAL lane on purpose — the lane the rule lives
    // in — so a sentence that only escapes because the fiqh branch caught it first does not count
    // as escaping.
    const readsCorpusRight = (mod) => corpus.cases.every((entry) => {
      const out = mod.reviewAnswer({ text: entry.text, evidence: [], domain: 'general', mode: 'عادي' });
      const replaced = out.annotations[0]?.action === 'replaced-unsupported-dynamic-claim';
      return replaced === Boolean(entry.variable);
    });
    for (const entry of corpus.cases) {
      const out = module.reviewAnswer({ text: entry.text, evidence: [], domain: 'general', mode: 'عادي' });
      const replaced = out.annotations[0]?.action === 'replaced-unsupported-dynamic-claim';
      ok((entry.variable ? 'a REAL variable claim is still replaced: ' : 'not a variable claim, not replaced: ')
        + entry.id, replaced === Boolean(entry.variable), entry.why + ' | ' + out.text.slice(0, 140));
      if (!entry.variable) {
        ok('...and ' + entry.id + ' reaches the reader in his own words',
          out.text.includes(entry.text), out.text.slice(0, 140));
      }
    }
    ok('all eighteen corpus cases are read correctly', readsCorpusRight(module));
    // THE NARROWING IS A NARROWING. Nothing may now be replaced that the old rule left alone.
    ok('every claim the narrowed rule replaces, the old alternation matched too',
      corpus.cases.every((entry) => {
        const out = module.reviewAnswer({ text: entry.text, evidence: [], domain: 'general', mode: 'عادي' });
        return out.annotations[0]?.action !== 'replaced-unsupported-dynamic-claim'
          || PRE_REPAIR_MARKERS.test(entry.text);
      }));

    // ── §١ MUTANT ١: PUT THE FLAT ALTERNATION BACK ───────────────────────────
    const flatMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'any-one-marker-is-enough-again',
      transform: (source) => source.replace(
        '  return DYNAMIC_WHEN.test(sentence) && DYNAMIC_WHAT.test(sentence);',
        '  return DYNAMIC_WHEN.test(sentence) || DYNAMIC_WHAT.test(sentence); // mutant: the old flat list'),
      survives: readsCorpusRight,
    });
    ok('flat-alternation mutant seam applied', flatMutant.changed, flatMutant.error);
    ok('flat-alternation mutant module loaded successfully', flatMutant.loaded, flatMutant.error);
    ok('MUTANT KILLED: one marker on its own cannot condemn a sentence again',
      flatMutant.loaded && flatMutant.survived === false, JSON.stringify(flatMutant));

    // ── §١ MUTANT ٢: DRIVE THE REFUSAL BACK INTO A CALCULATION ───────────────
    // The shape the owner actually read: a price, today, and an equation, all in one sentence.
    const CALCULATION = 'لنفترض أن سعر الدلاغ اليوم س دينارًا، وسعر الجوتي س + 50.';
    const calculationSurvives = (mod) => !mod.reviewAnswer({
      text: CALCULATION, evidence: [], domain: 'general', mode: 'عادي',
    }).text.includes(mod.REVIEW_DYNAMIC_UNSOURCED);
    ok('a worked sum carrying both halves is still not replaced', calculationSurvives(module),
      module.reviewAnswer({ text: CALCULATION, evidence: [], domain: 'general', mode: 'عادي' }).text);
    // ...and the exemption does not swallow a DATE. «2026-08-16» carries two hyphens touching
    // digits; read as subtraction it would exempt the very claims this rule exists to reach, since
    // a variable claim is precisely the kind that names a date.
    for (const dated of [
      'سعر الذهب اليوم 2026-08-16 بلغ ثلاثة آلاف دولار للأوقية.',
      'درجة الحرارة اليوم 16/8 في الكويت 38 مئوية.',
      'أسعار النفط الآن بين 80-90 دولارًا للبرميل.',
    ]) {
      ok('a date or a range is not a calculation: ' + dated.slice(0, 24),
        module.reviewAnswer({ text: dated, evidence: [], domain: 'general', mode: 'عادي' })
          .annotations[0]?.action === 'replaced-unsupported-dynamic-claim',
        module.reviewAnswer({ text: dated, evidence: [], domain: 'general', mode: 'عادي' }).text);
    }
    const sumMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'refusal-inside-a-calculation-again',
      transform: (source) => source.replace(
        '  if (CALCULATION_RE.test(sentence)) return false;',
        '  // mutant: a worked sum is just another claim about the world'),
      survives: calculationSurvives,
    });
    ok('calculation mutant seam applied', sumMutant.changed, sumMutant.error);
    ok('calculation mutant module loaded successfully', sumMutant.loaded, sumMutant.error);
    ok('MUTANT KILLED: the refusal cannot go back inside a worked equation',
      sumMutant.loaded && sumMutant.survived === false, JSON.stringify(sumMutant));

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
        "      output.push(part);\n      annotations.push(actionRecord(ordinal, scopedDomain, 'tagged-stable-general-knowledge'",
        "      output.push(sources[0] ? `${part}\\n${sourceTail(sources[0])}` : part);\n      annotations.push(actionRecord(ordinal, scopedDomain, 'tagged-stable-general-knowledge'"),
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
