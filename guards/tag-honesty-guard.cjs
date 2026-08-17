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

    // ── §٧: THE OLD LAW WAS «A STAMP ON EVERY SENTENCE», AND IT IS INVERTED HERE ──
    //
    // Nothing above this line was removed or softened: an unsourced ruling still carries the mark
    // and a sourced one still does not. What changed is the COUNT and the PLACE, and both are now
    // asserted rather than left to whoever reads the output next.
    //
    // MEASURED, on the platform, before the change: 96 stamps in one reply (12:46:07.645Z),
    // 17 in another (12:49:30.299Z), 15 on the owner's own fourth question. The rule was never
    // wrong — a ruling with no source in hand must reach the reader marked — but a mark repeated
    // ninety-six times is not ninety-six warnings, it is one warning and ninety-five obstructions.
    const FLOOD = [
      'الجمع للمسافر جائز عند الحاجة.',
      'ومدة المسح للمسافر ثلاثة أيام بلياليها.',
      'وتبدأ المدة من أول مسح بعد الحدث.',
      'ولا علاقة لعدد الصلوات بهذه المدة.',
      'ومن نزع الخف انتقضت طهارته.',
    ].join(' ');
    const flood = module.reviewAnswer({ text: FLOOD, evidence: [], domain: 'fiqh', mode: 'عادي' });
    const tagCount = (text, needle) => text.split(needle).length - 1;
    ok('five unsourced rulings are reported ONCE, not five times',
      tagCount(flood.text, module.REVIEW_TAGS.FIQH_UNSOURCED) === 1,
      tagCount(flood.text, module.REVIEW_TAGS.FIQH_UNSOURCED) + ' occurrence(s): ' + flood.text);
    ok('...and every one of the five sentences still reaches the reader',
      [
        'الجمع للمسافر جائز', 'ثلاثة أيام بلياليها', 'من أول مسح بعد الحدث',
        'لا علاقة لعدد الصلوات', 'من نزع الخف',
      ].every((piece) => flood.text.includes(piece)), flood.text);
    ok('...and the verdict still records all five, one annotation each',
      (flood.verdict.counts || {})['tagged-fiqh-understanding'] === 5,
      JSON.stringify(flood.verdict.counts));
    ok('no line in a reviewed answer is the bare tag and nothing else',
      flood.text.split('\n').every((line) => Object.values(module.REVIEW_TAGS)
        .every((visible) => line.trim() !== visible)), flood.text);

    // ── THE SCOPE IS THE ANSWER'S PROSE (§٥/٢) ────────────────────────────────
    // The narration is the one the owner reported seeing marked «understanding, not text», and the
    // chip is the shape of question he reported seeing marked as a ruling. Both are carried
    // through byte-for-byte, because neither is a claim this reviewer is entitled to judge.
    const HADITH = '<hadith>لَا يَنْصَرِفْ حَتَّى يَسْمَعَ صَوْتًا أَوْ يَجِدَ رِيحًا</hadith>';
    const CHIPS = '<suggestions>\n- ما نواقض الوضوء الثابتة؟\n- ما حكم الشك أثناء الصلاة؟\n</suggestions>';
    const HEADING = '### ضوابط المسح على الخف للمسافر';
    const structured = module.reviewAnswer({
      text: 'من تيقن الطهارة وشك في الحدث فلا وضوء عليه.\n' + HEADING + '\n' + HADITH + '\n' + CHIPS,
      evidence: [], domain: 'fiqh', mode: 'عادي',
    });
    ok('a quoted narration is carried through byte-for-byte, unmarked',
      structured.text.includes(HADITH), structured.text);
    ok('the suggestion chips are carried through byte-for-byte, unmarked',
      structured.text.includes(CHIPS), structured.text);
    ok('a heading is carried through byte-for-byte, unmarked',
      structured.text.includes(HEADING), structured.text);
    ok('and the ruling itself is still reported, exactly once',
      structured.text.includes('فلا وضوء عليه')
        && tagCount(structured.text, module.REVIEW_TAGS.FIQH_UNSOURCED) === 1, structured.text);

    // ── ONE ENCODING (§٥/١) ───────────────────────────────────────────────────
    // Comments may name a tag, but every NFC-equivalent occurrence must use the exact same code
    // point sequence as the frozen runtime value. A reordered combining mark renders identically
    // and compares differently, which is precisely how two spellings reached one answer before.
    const reviewerSource = require('fs').readFileSync(REVIEWER, 'utf8');
    const writtenTags = [...reviewerSource.matchAll(/\u3010[^\u3011]+\u3011/gu)].map((match) => match[0]);
    for (const [key, value] of Object.entries(module.REVIEW_TAGS)) {
      const equivalentForms = new Set(writtenTags
        .filter((candidate) => candidate.normalize('NFC') === value.normalize('NFC')));
      ok('every NFC-equivalent ' + key + ' uses the runtime code-point sequence',
        equivalentForms.size === 1 && equivalentForms.has(value),
        JSON.stringify([...equivalentForms].map((form) => Array.from(form)
          .map((char) => char.codePointAt(0).toString(16)))));
    }

    // ── §٧ MUTANT ١: PUT THE STAMP BACK ON EVERY SENTENCE ────────────────────
    const floodMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'stamp-every-sentence-again',
      transform: (source) => source.replace(
        /^ {8}let reviewed = part;$/mu,
        '        let reviewed = tag(part, TAGS.FIQH_UNSOURCED); // mutant: the old flood'),
      survives: (mutantModule) => {
        const out = mutantModule.reviewAnswer({ text: FLOOD, evidence: [], domain: 'fiqh', mode: 'عادي' });
        return out.text.split(mutantModule.REVIEW_TAGS.FIQH_UNSOURCED).length - 1 === 1;
      },
    });
    ok('flood mutant seam applied', floodMutant.changed, floodMutant.error);
    ok('flood mutant module loaded successfully', floodMutant.loaded, floodMutant.error);
    ok('MUTANT KILLED: the stamp cannot go back onto every sentence',
      floodMutant.loaded && floodMutant.survived === false, JSON.stringify(floodMutant));

    // ── §٧ MUTANT ٢: MARK A QUOTED TEXT ──────────────────────────────────────
    // Collapsing the structural split is exactly how the defect arose: with card runs treated as
    // prose, the narration becomes a sentence and is stamped like any other.
    const quoteMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'mark-transmitted-text-again',
      transform: (source) => source.replace(
        /^ {4}if \(run\.kind === 'card'\) \{$/mu,
        "    if (run.kind === 'card' && false) { // mutant: a hadith is just another sentence"),
      survives: (mutantModule) => mutantModule.reviewAnswer({
        text: HADITH, evidence: [], domain: 'fiqh', mode: 'عادي',
      }).text === HADITH,
    });
    ok('quoted-text mutant seam applied', quoteMutant.changed, quoteMutant.error);
    ok('quoted-text mutant module loaded successfully', quoteMutant.loaded, quoteMutant.error);
    ok('MUTANT KILLED: transmitted text cannot be marked as understanding',
      quoteMutant.loaded && quoteMutant.survived === false, JSON.stringify(quoteMutant));

    // ── §٣: THE MARK GOES AT THE END OF THE SENTENCE, OR IT DOES NOT GO ──────
    //
    // THE DEFECT, MEASURED ON THE LIVE PREVIEW AND REPORTED BY THE OWNER. When an attribution was
    // detected in the MIDDLE of a sentence, `generalizeAttribution` rebuilt the sentence as
    // `<before> ‹hedge›: <claim>` — driving a fixed phrase through the spine of a connected
    // Arabic sentence and breaking its back. Two witnesses, questions ١٥ and ١٩ of the owner's
    // twenty-question message.
    //
    // WHY THE FOUR ANSWERS OF THE PREVIOUS ROUND DID NOT CATCH IT. Their proof was «the prose is
    // byte-identical», and not one of those four carried a REPLACED attribution — only tagged
    // ones. The case was outside the witness, not inside it and passing.
    //
    // The hedge is written here in escapes on purpose: it must no longer exist as a literal
    // anywhere in the reviewer, and a guard that spells it out in Arabic would be one more copy.
    // Escapes, not Arabic: the shadda/damma ORDER in the middle word is the whole reason a
    // hand-typed copy of this phrase silently fails to match the one the module used to carry.
    const HEDGE = String.fromCharCode(0x0627,0x0644,0x0641,0x0647,0x0645,0x064f,0x0020,0x0627,0x0644,0x0639,0x0627,0x0645,0x0651,0x064f,0x0020,0x0645,0x0646,0x0020,0x0627,0x0644,0x0645,0x0639,0x0637,0x064a,0x0627,0x062a,0x0650,0x0020,0x0627,0x0644,0x0645,0x062a,0x0627,0x062d,0x0629);
    //
    // ── AND WHY q19 IS NO LONGER ONE OF THESE WITNESSES (repair §٢/١) ────────
    // It used to be. Its «frame» was ' عند المسح:' — «at the time of wiping», a plain Arabic
    // adverbial — and this guard asserted that the reviewer CUT it out of the sentence, so the
    // defect was not merely shipped, it was pinned in place by a green gate. It moves below, to
    // ADVERBIALS, where the assertion is inverted: the phrase is carried and the sentence is not
    // touched. Nothing was softened to make room for it — a second real mid-sentence credit takes
    // its place here, so the property below is still proved on two witnesses and the mutant that
    // guards it still has two chances to survive.
    const MID_SENTENCE = [
      {
        id: 'q15',
        head: 'كفارةُ الشهرينِ المتتابعينِ إنّما تجبُ في جماعِ الصائمِ عمدًا في نهارِ رمضانَ تحديدًا،',
        frame: ' كما قال ابن عثيمين:',
        claim: ' لا في مطلقِ الأكلِ والشربِ المتعمّد.',
        credit: 'ابن عثيمين',
      },
      {
        id: 'khuff',
        head: 'ومدةُ المسحِ للمقيمِ يومٌ وليلة،',
        frame: ' كما قال ابن باز:',
        claim: ' وتبدأُ من أوّلِ مسحٍ بعدَ الحدث.',
        credit: 'ابن باز',
      },
    ];

    // The property, stated once so the mutant below is measured against exactly it: the reviewed
    // sentence is the reader's own words with the credit removed, and the mark after the full
    // stop. Nothing between the two halves, and nothing after the mark.
    const stitchedCleanly = (mod) => MID_SENTENCE.every((witness) => {
      const out = mod.reviewAnswer({
        text: witness.head + witness.frame + witness.claim,
        evidence: [], domain: 'fiqh', mode: 'عادي',
      });
      const expected = (witness.head + witness.claim).replace(/\s+/gu, ' ').trim()
        + ' ' + mod.REVIEW_TAGS.ATTRIBUTION_REMOVED;
      return out.text.replace(/\s+/gu, ' ').trim() === expected;
    });

    for (const witness of MID_SENTENCE) {
      const out = module.reviewAnswer({
        text: witness.head + witness.frame + witness.claim,
        evidence: [], domain: 'fiqh', mode: 'عادي',
      });
      ok(witness.id + ': nothing is injected into the middle of the sentence',
        !out.text.includes(HEDGE), out.text);
      ok(witness.id + ': the reader keeps his own words on both sides of the removed credit',
        out.text.includes(witness.head.trim()) && out.text.includes(witness.claim.trim()), out.text);
      ok(witness.id + ': the mark is the LAST thing in the sentence',
        out.text.trimEnd().endsWith(module.REVIEW_TAGS.ATTRIBUTION_REMOVED), out.text);
      ok(witness.id + ': and the credit itself is gone',
        !out.text.includes(witness.credit), out.text);
    }
    ok('both witnesses stitch back to exactly the sentence minus its credit', stitchedCleanly(module));
    ok('the hedge phrase exists nowhere in the reviewer any more',
      !require('fs').readFileSync(REVIEWER, 'utf8').includes(HEDGE));

    // ── ADVERBIALS: «عندَ» IS TWO WORDS, AND ONLY ONE OF THEM CREDITS ANYBODY ─
    //
    // THE DEFECT THIS INVERTS. «عندَ الحنفيّةِ كذا» names whose view it is. «عندَ الوضوءِ كذا»
    // names WHEN. The reviewer's third frame read the particle and not what followed it, so an
    // adverbial was classified as a credit to a scholar named «المسح» and cut out of a connected
    // sentence. Measured on the owner's question ١٩, and carried in this very file as a witness
    // of correct behaviour until this round.
    //
    // A SCHOOL IS NOT A MAN EITHER, and that is not an accident of the person test — it is
    // lib/policy/entities.js:103 stating the same rule for the router: a madhhab «may never take a
    // person-attribution template and may never be routed to somebody's official site». There is
    // no source that could ever license it, so classifying it as a person-credit would mean
    // stripping it from every sentence it ever appears in. It is carried, and the answer-level
    // notice is what tells the reader this is understanding rather than a sourced fatwa.
    const ADVERBIALS = [
      { id: 'q19-wiping', text: 'يبني على مدة إقامة (يوم وليلة) لا مدة سفر؛ لأن العبرة بحاله عند المسح: وقد مسح وهو مقيم، فتُحسب مدته على أساس الإقامة.', keep: 'عند المسح' },
      { id: 'wudu', text: 'عند الوضوء: يُسمّي المتوضّئ ويغسل كفّيه ثلاثًا.', keep: 'عند الوضوء' },
      { id: 'as-needed', text: 'يخرج بحسب الحاجة: بقدر ما يدفع الضرر لا أكثر.', keep: 'بحسب الحاجة' },
      { id: 'madhhab', text: 'عند الحنابلة: نقض الوضوء بأكل لحم الإبل ثابت.', keep: 'عند الحنابلة' },
      { id: 'jumhur', text: 'صلاة الكسوف سنّة مؤكّدة عند جمهور الفقهاء، وتُصلّى ركعتين.', keep: 'عند جمهور الفقهاء' },
    ];
    const adverbialsSurvive = (mod) => ADVERBIALS.every((witness) => {
      const out = mod.reviewAnswer({ text: witness.text, evidence: [], domain: 'fiqh', mode: 'عادي' });
      return out.text.includes(witness.text)
        && out.annotations[0]?.action === 'tagged-fiqh-understanding';
    });
    for (const witness of ADVERBIALS) {
      const out = module.reviewAnswer({ text: witness.text, evidence: [], domain: 'fiqh', mode: 'عادي' });
      ok(witness.id + ': the phrase is not read as a credit and is carried whole',
        out.text.includes(witness.keep) && out.text.includes(witness.text), out.text);
      ok(witness.id + ': and nothing was cut out of the sentence',
        out.annotations[0]?.action === 'tagged-fiqh-understanding', out.annotations[0]?.action);
    }
    // ...AND THE SAME PARTICLE STILL CREDITS A PERSON. Without these three, the rule above could
    // be satisfied by a reviewer that stopped reading «عند» at all.
    for (const [label, text, credit] of [
      ['registry name', 'عند ابن باز: الجمع للمسافر جائز عند الحاجة.', 'ابن باز'],
      ['title + name', 'عند الشيخ محمد الأمين: الجمع للمسافر جائز.', 'محمد الأمين'],
      ['«بحسب» + name', 'بحسب ابن عثيمين: الجمع للمسافر جائز.', 'ابن عثيمين'],
    ]) {
      const out = module.reviewAnswer({ text, evidence: [], domain: 'fiqh', mode: 'عادي' });
      ok('«عند/بحسب» still removes an unsupported PERSON credit: ' + label,
        !out.text.includes(credit)
          && out.annotations[0]?.action === 'removed-unsupported-attribution', out.text);
    }

    // ── §٢/٢: A REMOVAL THAT LEAVES A HOLE IS NOT A REMOVAL ──────────────────
    //
    // THE WITNESS, printed whole in the battery report, from the owner's question ١٢ on the live
    // preview. The reviewer cut «فتوى ابن باز» out and left the preposition that governed it
    // holding nothing, and left the prayer for a man who was no longer in the sentence:
    //
    //   «يجوز لها ذلك، وهذا مصرَّحٌ به في رحمه الله: فقد نصّ على أنّ…»
    //
    // §٢ allows two outcomes and forbids only the third: either what remains is a complete Arabic
    // sentence, or the name stays and the sentence is marked as it is. A broken output is not
    // guarding anything.
    const Q12 = 'يجوز لها ذلك، وهذا مصرَّحٌ به في فتوى ابن باز رحمه الله: فقد نصّ على أنّ كونَ المرأةِ المعتدَّةِ طالبةً أو معلّمةً أو موظّفةً من الحاجاتِ المهمّةِ التي تُبيحُ لها الخروجَ من بيتِ العدّةِ نهارًا.';
    const REMOVAL_SAFETY = [
      {
        id: 'set2-preview-1-14-joined-preposition',
        text: 'ومن رأي الشيخ محمد الأمين أن فالأولى عنده الإنصات لقراءة الإمام والاستماع لها.',
      },
      {
        id: 'set2-preview-1-18-semantic-subject',
        text: 'والفقه عند الشيخ محمد الأمين: يعطى من الزكاة أصلًا، فيقبض المال ثم يقضى به الدين.',
      },
      {
        id: 'set2-preview-2-18-comma-fragment',
        text: 'فهذا معروف عظيم وصدقة يثاب عليها صاحبها، بحسب الشيخ محمد الأمين:',
      },
      {
        id: 'joined-relative-claim',
        text: 'قال الشيخ محمد الأمين: والذي اختاره وجوب الوضوء.',
      },
    ];
    const removalSafetyHolds = (mod) => REMOVAL_SAFETY.every((witness) => {
      const out = mod.reviewAnswer({ text: witness.text, evidence: [], domain: 'fiqh', mode: 'عادي' });
      return out.text.includes(witness.text)
        && out.text.trimEnd().endsWith(mod.REVIEW_TAGS.ATTRIBUTION_REMOVED)
        && out.annotations[0]?.action === 'kept-unsupported-attribution-marked';
    });
    const seamHolds = (mod) => {
      const out = mod.reviewAnswer({ text: Q12, evidence: [], domain: 'fiqh', mode: 'عادي' });
      return out.text.includes(Q12)
        && !/به\s+في\s+رحمه\s+الله/u.test(out.text)
        && out.text.trimEnd().endsWith(mod.REVIEW_TAGS.ATTRIBUTION_REMOVED)
        && removalSafetyHolds(mod);
    };
    {
      const out = module.reviewAnswer({ text: Q12, evidence: [], domain: 'fiqh', mode: 'عادي' });
      ok('q12: the preposition is not left holding nothing', !/به\s+في\s+رحمه\s+الله/u.test(out.text), out.text);
      ok('q12: the reader receives his own sentence, whole', out.text.includes(Q12), out.text);
      ok('q12: and it is marked as understanding rather than transmitted text',
        out.text.trimEnd().endsWith(module.REVIEW_TAGS.ATTRIBUTION_REMOVED), out.text);
      ok('q12: and the verdict names what actually happened',
        out.annotations[0]?.action === 'kept-unsupported-attribution-marked',
        out.annotations[0]?.action);
    }
    for (const witness of REMOVAL_SAFETY) {
      const out = module.reviewAnswer({ text: witness.text, evidence: [], domain: 'fiqh', mode: 'عادي' });
      ok(witness.id + ': unsafe removal keeps every original character', out.text.includes(witness.text), out.text);
      ok(witness.id + ': semantic subject and sentence structure remain intact',
        out.annotations[0]?.action === 'kept-unsupported-attribution-marked'
          && out.text.trimEnd().endsWith(module.REVIEW_TAGS.ATTRIBUTION_REMOVED), out.text);
    }

    // Narrowing the destructive branch must not disable attribution review. These unsupported
    // credits are cleanly removable, including joined conjunctions and an attached honorific.
    for (const witness of [
      {
        id: 'joined-waw-credit',
        text: 'وقال الشيخ محمد الأمين إن الجمع للمسافر جائز عند الحاجة.',
        claim: 'الجمع للمسافر جائز عند الحاجة.',
      },
      {
        id: 'joined-fa-connector',
        text: 'فأما رأي الشيخ محمد الأمين أن الراجح المنع.',
        claim: 'الراجح المنع.',
      },
      {
        id: 'joined-honorific-prayer',
        text: 'قال الشيخ محمد الأمين: ورحمه الله، الجمع للمسافر جائز عند الحاجة.',
        claim: 'الجمع للمسافر جائز عند الحاجة.',
      },
    ]) {
      const out = module.reviewAnswer({ text: witness.text, evidence: [], domain: 'fiqh', mode: 'عادي' });
      const expected = witness.claim + ' ' + module.REVIEW_TAGS.ATTRIBUTION_REMOVED;
      ok(witness.id + ': genuinely unsupported credit is still removed',
        out.annotations[0]?.action === 'removed-unsupported-attribution'
          && !out.text.includes('محمد الأمين'), out.text);
      ok(witness.id + ': removal preserves the complete semantic claim', out.text === expected, out.text);
    }

    const joinedCalculation = 'سعر اليوم وس + ص مجموع المبلغين.';
    const calculation = module.reviewAnswer({ text: joinedCalculation, evidence: [], domain: 'general', mode: 'عادي' });
    ok('joined Arabic algebra variable remains calculation rather than a dynamic claim',
      calculation.text.includes(joinedCalculation)
        && calculation.annotations[0]?.action === 'tagged-stable-general-knowledge', calculation.text);

    const noSpaceSentences = module.reviewAnswer({
      text: 'الجمع للمسافر جائز.والقصر للمسافر سنة.', evidence: [], domain: 'fiqh', mode: 'عادي',
    });
    ok('Arabic sentences separated by punctuation without whitespace are reviewed independently',
      noSpaceSentences.annotations.length === 2
        && noSpaceSentences.annotations.every((item) => item.action === 'tagged-fiqh-understanding')
        && noSpaceSentences.text.includes('الجمع للمسافر جائز.')
        && noSpaceSentences.text.includes('والقصر للمسافر سنة.'), noSpaceSentences.text);
    // The prayer belongs to the name, so when the name CAN be cut the prayer goes with it.
    {
      const out = module.reviewAnswer({
        text: 'قال ابن باز رحمه الله إن الجمع للمسافر جائز عند الحاجة.',
        evidence: [], domain: 'fiqh', mode: 'عادي',
      });
      ok('a removed name takes its honorific prayer with it',
        !out.text.includes('ابن باز') && !out.text.includes('رحمه الله')
          && out.text.includes('الجمع للمسافر جائز'), out.text);
    }

    // ── §٢/١ MUTANT: LET THE PARTICLE ALONE DECIDE AGAIN ─────────────────────
    const particleMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'ambiguous-particle-credits-any-noun',
      transform: (source) => source.replace(
        '    if (!framePointsAtAPerson(match.groups.frame, claimed)) continue;\n',
        '    // mutant: «عند الوضوء» is a scholar named «الوضوء»\n'),
      survives: adverbialsSurvive,
    });
    ok('adverbial mutant seam applied', particleMutant.changed, particleMutant.error);
    ok('adverbial mutant module loaded successfully', particleMutant.loaded, particleMutant.error);
    ok('MUTANT KILLED: an Arabic adverbial cannot be read as a credit again',
      particleMutant.loaded && particleMutant.survived === false, JSON.stringify(particleMutant));

    // ── §٢/٢ MUTANT: LEAVE THE BROKEN SENTENCE ───────────────────────────────
    const seamMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'remove-the-name-and-leave-the-hole',
      transform: (source) => source.replace(
        '          if (removalBreaksSentence(part, attribution)) {',
        '          if (false && removalBreaksSentence(part, attribution)) { // mutant: ship the break'),
      survives: seamHolds,
    });
    ok('broken-seam mutant seam applied', seamMutant.changed, seamMutant.error);
    ok('broken-seam mutant module loaded successfully', seamMutant.loaded, seamMutant.error);
    ok('MUTANT KILLED: a name cannot be cut out leaving a sentence that is not Arabic',
      seamMutant.loaded && seamMutant.survived === false, JSON.stringify(seamMutant));

    // ── §٣ MUTANT: PUT THE PHRASE BACK INTO THE MIDDLE ───────────────────────
    const midMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'inject-into-the-middle-again',
      transform: (source) => source.replace(
        '  return `${head} ${claim}`;',
        '  return `${head} ` + \'\\u0627\\u0644\\u0641\\u0647\\u0645\\u064f \\u0627\\u0644\\u0639\\u0627'
        + '\\u0645\\u0651\\u064f \\u0645\\u0646 \\u0627\\u0644\\u0645\\u0639\\u0637\\u064a\\u0627\\u062a'
        + '\\u0650 \\u0627\\u0644\\u0645\\u062a\\u0627\\u062d\\u0629\' + `: ${claim}`; // mutant'),
      survives: stitchedCleanly,
    });
    ok('mid-sentence mutant seam applied', midMutant.changed, midMutant.error);
    ok('mid-sentence mutant module loaded successfully', midMutant.loaded, midMutant.error);
    ok('MUTANT KILLED: the phrase cannot go back into the middle of a sentence',
      midMutant.loaded && midMutant.survived === false, JSON.stringify(midMutant));

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
