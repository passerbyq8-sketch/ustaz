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

    // ── ONE WRITER (§٥/١) ─────────────────────────────────────────────────────
    // The tag text must be written in exactly one place in the reviewer: the frozen TAGS object.
    // A second hand-written copy is how the two spellings the owner saw would come back.
    const reviewerSource = require('fs').readFileSync(REVIEWER, 'utf8');
    for (const [key, value] of Object.entries(module.REVIEW_TAGS)) {
      ok('the text of ' + key + ' is written exactly once in the reviewer',
        reviewerSource.split(value).length - 1 === 1,
        (reviewerSource.split(value).length - 1) + ' literal(s)');
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
    const MID_SENTENCE = [
      {
        id: 'q15',
        head: 'كفارةُ الشهرينِ المتتابعينِ إنّما تجبُ في جماعِ الصائمِ عمدًا في نهارِ رمضانَ تحديدًا،',
        frame: ' كما قال ابن عثيمين:',
        claim: ' لا في مطلقِ الأكلِ والشربِ المتعمّد.',
      },
      {
        id: 'q19',
        head: 'يبني على مدة إقامة (يوم وليلة) لا مدة سفر؛ لأن العبرة بحاله',
        frame: ' عند المسح:',
        claim: ' وقد مسح وهو مقيم، فتُحسب مدته على أساس الإقامة.',
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
        !/ابن عثيمين/u.test(out.text), out.text);
    }
    ok('both witnesses stitch back to exactly the sentence minus its credit', stitchedCleanly(module));
    ok('the hedge phrase exists nowhere in the reviewer any more',
      !require('fs').readFileSync(REVIEWER, 'utf8').includes(HEDGE));

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
