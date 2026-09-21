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
// ── THE CONTRACT THIS GUARD WAS BUILT ON, AND THE ONE IT HOLDS NOW ─────────
//
// IT WAS: «an attribution no evidence supports becomes understanding that is VISIBLY TAGGED».
// The owner struck the last two words on 18 Sep, and struck them for a stated reason: one answer
// is mostly transmitted from a published fatwa and partly the app's own reading, so a single
// verdict stamped across the whole of it lies about half of it — and a reply to a greeting was
// coming back badged «settled knowledge».
//
// SO THE WITNESS IS TURNED AROUND RATHER THAN DELETED. What it asserted has not become false; it
// has become the opposite obligation. Every row below now holds BOTH halves at once:
//
//   the five marks are never written — at any level, in any phase, in any spelling;
//   and what the mark announced STILL HAPPENS — the credit falls, the ruling is delivered, the
//   sentence stays whole, and the reviewer records which of those it did.
//
// A guard that only asserted the first half would pass on a reviewer that had stopped reviewing.
const unsupportedIsHandledSilently = (module) => {
  const out = module.reviewAnswer({ text: attributedText, evidence: [], domain: 'fiqh', mode: 'عادي' });
  return !Object.values(module.REVIEW_TAGS).some((visible) => out.text.includes(visible))
    && out.annotations[0]?.action === 'removed-unsupported-attribution'
    && !out.text.includes('ابن باز')
    && out.text.includes('الجمع للمسافر جائز عند الحاجة.');
};

(async () => {
  try {
    const module = await fresh(REVIEWER, 'tag-base');
    ok('unsupported attribution becomes understanding, silently: credit gone, claim delivered, no mark',
      unsupportedIsHandledSilently(module));
    const sourced = module.reviewAnswer({
      text: attributedText, evidence: [correct], domain: 'fiqh', mode: 'عادي',
    });
    ok('genuinely sourced attribution is passed through untouched',
      sourced.text === attributedText
        && !Object.values(module.REVIEW_TAGS).some((visible) => sourced.text.includes(visible)), sourced.text);
    const plainFiqh = module.reviewAnswer({
      text: 'الجمع للمسافر جائز.', evidence: [], domain: 'fiqh', mode: 'عادي',
    });
    ok('unattributed fiqh understanding is delivered whole and unmarked',
      plainFiqh.text === 'الجمع للمسافر جائز.'
        && plainFiqh.annotations[0]?.action === 'tagged-fiqh-understanding', plainFiqh.text);
    const stable = module.reviewAnswer({
      text: 'ناتج اثنين زائد اثنين أربعة.', evidence: [], domain: 'general', mode: 'موجز',
    });
    ok('stable unsourced general knowledge is delivered without a source and without a mark',
      stable.text === 'ناتج اثنين زائد اثنين أربعة.'
        && stable.annotations[0]?.action === 'tagged-stable-general-knowledge', stable.text);

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
    // ONE was the answer to ninety-six. NONE is the answer the owner gave on 18 Sep, and it is the
    // same rule carried one step further, not a different one: the flood was never information,
    // and the last copy of it was not either. The three rows under it are untouched and are what
    // make this a count of marks rather than a count of what the reader lost — every sentence is
    // still delivered, and the verdict still records a decision for each.
    ok('five unsourced rulings are reported not once but not at all',
      tagCount(flood.text, module.REVIEW_TAGS.FIQH_UNSOURCED) === 0,
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
    ok('and the ruling itself is still reported, and carries no mark',
      structured.text.includes('فلا وضوء عليه')
        && Object.values(module.REVIEW_TAGS)
          .every((visible) => tagCount(structured.text, visible) === 0), structured.text);

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
    //
    // The old form of this mutant called `tag(part, TAGS.FIQH_UNSOURCED)`. `tag()` was the writer
    // and went with the removal, so that seam applied and then threw `ReferenceError: tag is not
    // defined` on load — a mutant that cannot load is a mutant that cannot be killed. It welds the
    // mark directly now, which is the same defect without the helper, and the survival test is the
    // owner's rule rather than the old count: ONE stamp was acceptable before and none is now.
    const floodMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'stamp-every-sentence-again',
      transform: (source) => source.replace(
        /^ {8}let reviewed = part;$/mu,
        "        let reviewed = part + ' ' + TAGS.FIQH_UNSOURCED; // mutant: the old flood"),
      survives: (mutantModule) => {
        const out = mutantModule.reviewAnswer({ text: FLOOD, evidence: [], domain: 'fiqh', mode: 'عادي' });
        return out.text.split(mutantModule.REVIEW_TAGS.FIQH_UNSOURCED).length - 1 === 0;
      },
    });
    ok('flood mutant seam applied', floodMutant.changed, floodMutant.error);
    ok('flood mutant module loaded successfully', floodMutant.loaded, floodMutant.error);
    ok('MUTANT KILLED: the stamp cannot go back onto every sentence',
      floodMutant.loaded && floodMutant.survived === false, JSON.stringify(floodMutant));

    // ── §٧ MUTANT ٢: TREAT A QUOTED TEXT AS PROSE ────────────────────────────
    // Collapsing the structural split is exactly how the defect arose: with card runs treated as
    // prose, the narration becomes a sentence and is judged like any other.
    //
    // WHAT THE SURVIVAL TEST READS NOW. It read «the text came back byte-identical», which worked
    // only because a narration judged as prose was STAMPED and so came back changed. Nothing is
    // stamped any more, so the mutant's text is identical to the clean one and the old test let it
    // live. What still separates them is that a card is not judged at all: the clean reviewer
    // records NO sentence annotation for a narration, and the mutant records one.
    const quoteMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'mark-transmitted-text-again',
      transform: (source) => source.replace(
        /^ {4}if \(run\.kind === 'card'\) \{$/mu,
        "    if (run.kind === 'card' && false) { // mutant: a hadith is just another sentence"),
      survives: (mutantModule) => {
        const out = mutantModule.reviewAnswer({
          text: HADITH, evidence: [], domain: 'fiqh', mode: 'عادي',
        });
        return out.text === HADITH && out.annotations.length === 0;
      },
    });
    ok('quoted-text mutant seam applied', quoteMutant.changed, quoteMutant.error);
    ok('quoted-text mutant module loaded successfully', quoteMutant.loaded, quoteMutant.error);
    ok('MUTANT KILLED: transmitted text cannot be judged as understanding',
      quoteMutant.loaded && quoteMutant.survived === false, JSON.stringify(quoteMutant));

    // AND THE CLEAN TREE IS THE OTHER HALF OF THAT MUTANT: a narration is carried through with no
    // sentence annotation at all, which is what makes the mutant above detectable.
    ok('a narration is not judged as a sentence in the first place',
      module.reviewAnswer({ text: HADITH, evidence: [], domain: 'fiqh', mode: 'عادي' })
        .annotations.length === 0,
      JSON.stringify(module.reviewAnswer({ text: HADITH, evidence: [], domain: 'fiqh', mode: 'عادي' })
        .annotations));

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
    // sentence is the reader's own words with the credit removed, and NOTHING ELSE — not between
    // the two halves, and not after them.
    //
    // IT USED TO END «…and the mark after the full stop» (owner, 18 Sep). That clause was how this
    // block proved the repair had happened at all: the hedge was gone from the middle AND the mark
    // had landed at the end. With no mark written, the equality below carries the whole property by
    // itself and carries it more strictly, because it now admits no trailing anything.
    const stitchedCleanly = (mod) => MID_SENTENCE.every((witness) => {
      const out = mod.reviewAnswer({
        text: witness.head + witness.frame + witness.claim,
        evidence: [], domain: 'fiqh', mode: 'عادي',
      });
      // THIRD ORDER, STEP 6: was head + claim; «كما قال X:» is now «كما قال بعض أهل العلم:» between them.
      const expected = (witness.head + ' كما قال بعض أهل العلم:' + witness.claim).replace(/\s+/gu, ' ').trim();
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
      ok(witness.id + ': the sentence ENDS where the reader last wrote',
        out.text.trimEnd().endsWith(witness.claim.replace(/\s+/gu, ' ').trim()), out.text);
      ok(witness.id + ': and the credit itself is gone',
        !out.text.includes(witness.credit), out.text);
    }
    ok('both witnesses stitch back to exactly the sentence minus its credit', stitchedCleanly(module));
    ok('the hedge phrase exists nowhere in the reviewer any more',
      !require('fs').readFileSync(REVIEWER, 'utf8').includes(HEDGE));
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
        && out.text.trimEnd().endsWith(witness.text.trimEnd())
        && out.annotations[0]?.action === 'kept-unsupported-attribution-marked';
    });
    const seamHolds = (mod) => {
      const out = mod.reviewAnswer({ text: Q12, evidence: [], domain: 'fiqh', mode: 'عادي' });
      return out.text.includes(Q12)
        && !/به\s+في\s+رحمه\s+الله/u.test(out.text)
        && out.text.trimEnd().endsWith(Q12.trimEnd())
        && removalSafetyHolds(mod);
    };
    {
      const out = module.reviewAnswer({ text: Q12, evidence: [], domain: 'fiqh', mode: 'عادي' });
      ok('q12: the preposition is not left holding nothing', !/به\s+في\s+رحمه\s+الله/u.test(out.text), out.text);
      ok('q12: the reader receives his own sentence, whole', out.text.includes(Q12), out.text);
      ok('q12: and nothing whatever is welded onto it',
        out.text.trimEnd().endsWith(Q12.trimEnd()), out.text);
      ok('q12: and the verdict names what actually happened',
        out.annotations[0]?.action === 'kept-unsupported-attribution-marked',
        out.annotations[0]?.action);
    }
    for (const witness of REMOVAL_SAFETY) {
      const out = module.reviewAnswer({ text: witness.text, evidence: [], domain: 'fiqh', mode: 'عادي' });
      ok(witness.id + ': unsafe removal keeps every original character', out.text.includes(witness.text), out.text);
      // The disposition is read from the reviewer's own record. It always was the substantive half:
      // `kept-unsupported-attribution-marked` is the branch that KEEPS the credit because removing
      // it would break the sentence, and it is what tells this row apart from a clean removal.
      ok(witness.id + ': semantic subject and sentence structure remain intact',
        out.annotations[0]?.action === 'kept-unsupported-attribution-marked'
          && out.text.trimEnd().endsWith(witness.text.trimEnd()), out.text);
    }

    // Narrowing the destructive branch must not disable attribution review. These unsupported
    // credits are cleanly removable, including joined conjunctions and an attached honorific.
    for (const witness of [
      {
        id: 'joined-waw-credit',
        text: 'وقال الشيخ محمد الأمين إن الجمع للمسافر جائز عند الحاجة.',
        // THIRD ORDER, STEP 6: was the bare claim; now the claim behind the general speaker.
        claim: 'وقال بعض أهل العلم: الجمع للمسافر جائز عند الحاجة.',
      },
      {
        id: 'joined-fa-connector',
        text: 'فأما رأي الشيخ محمد الأمين أن الراجح المنع.',
        claim: 'الراجح المنع.',
        khilafTrigger: 'prose',
      },
      {
        id: 'joined-honorific-prayer',
        text: 'قال الشيخ محمد الأمين: ورحمه الله، الجمع للمسافر جائز عند الحاجة.',
        // THIRD ORDER, STEP 6: was the bare claim; now the claim behind the general speaker.
        claim: 'وقال بعض أهل العلم: الجمع للمسافر جائز عند الحاجة.',
      },
    ]) {
      const out = module.reviewAnswer({ text: witness.text, evidence: [], domain: 'fiqh', mode: 'عادي' });
      // The mark used to follow the claim on the same line. Nothing follows it now, so the whole
      // first line IS the claim — a stricter equality than the old one, and the one that actually
      // measures «the complete semantic claim survives the removal».
      const expected = witness.claim;
      const outputLines = out.text.split('\n');
      const expectedKhilafTrigger = witness.khilafTrigger || null;
      ok(witness.id + ': genuinely unsupported credit is still removed',
        out.annotations[0]?.action === 'removed-unsupported-attribution'
          && !out.text.includes('محمد الأمين'), out.text);
      ok(witness.id + ': removal preserves the complete semantic claim and adds nothing to it',
        outputLines[0] === expected
          && out.verdict.khilafTrigger === expectedKhilafTrigger
          && outputLines.length === (expectedKhilafTrigger ? 2 : 1), out.text);
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
        + '\\u0650 \\u0627\\u0644\\u0645\\u062a\\u0627\\u062d\\u0629\' + `: ${claim}`; // mutant')
        // THIRD ORDER, STEP 6 — the two «كما قال» witnesses now leave through the general-speaker seam,
        // so the phrase is injected there too; without this the mutant never reaches them and proves nothing.
        .replace("    const line = lead + ' ' + said;",
          "    const line = lead + ' \\u0627\\u0644\\u0641\\u0647\\u0645\\u064f \\u0627\\u0644\\u0639\\u0627\\u0645\\u0651\\u064f: ' + said; // mutant"),
      survives: stitchedCleanly,
    });
    ok('mid-sentence mutant seam applied', midMutant.changed, midMutant.error);
    ok('mid-sentence mutant module loaded successfully', midMutant.loaded, midMutant.error);
    ok('MUTANT KILLED: the phrase cannot go back into the middle of a sentence',
      midMutant.loaded && midMutant.survived === false, JSON.stringify(midMutant));

    // ── ع-٥٥/ب · WHAT CANNOT BE STOOD BEHIND IS REMOVED, NOT DECORATED ────
    //
    // On «he mentioned that» and «he said that» an unsupported credit came out MARKED rather
    // than removed: the reader was shown a decorated attribution instead of none. Measured, the
    // removal branch was never reached — removalBreaksSentence routed the sentence to the marked
    // branch because `head` still ended on «وقد», a pre-verbal particle belonging to the very
    // frame being removed. The repair is in attributionParts, one function earlier, and the seam
    // test is untouched. Five phrasings, and the owner's own witness among them: a passage
    // credited to a named book in a summary-mode answer.
    for (const witness of [
      { id: 'waqad-zakara-anna-book',
        text: 'وقد ذكر ابن قدامة في المغني أن المسح على الخفين جائز.',
        delivered: 'المسح على الخفين جائز.' },
      { id: 'waqad-zakara-anna-mid',
        text: 'المسألة فيها سعة، وقد ذكر ابن قدامة أن المسح على الخفين جائز.',
        delivered: 'المسألة فيها سعة، المسح على الخفين جائز.' },
      { id: 'waqad-qala-inna-summary',
        text: 'خلاصة الجواب أن المسح جائز، وقد قال ابن قدامة إن مدته يوم وليلة.',
        // THIRD ORDER, STEP 6: was «…جائز، مدته…»; «وقد قال X إن» now reads «وقال بعض أهل العلم:».
        delivered: 'خلاصة الجواب أن المسح جائز، وقال بعض أهل العلم: مدته يوم وليلة.' },
      { id: 'faqad-zakara-anna',
        text: 'الأمر واسع، فقد ذكر ابن قدامة أن المسح على الخفين جائز.',
        delivered: 'الأمر واسع، المسح على الخفين جائز.' },
      { id: 'qad-zakara-anna-head',
        text: 'قد ذكر ابن قدامة أن المسح على الخفين جائز.',
        delivered: 'المسح على الخفين جائز.' },
    ]) {
      const out = module.reviewAnswer({ text: witness.text, evidence: [], domain: 'fiqh', mode: 'عادي' });
      ok('ع-٥٥/ب ' + witness.id + ': the credit is REMOVED, not decorated',
        out.annotations[0]?.action === 'removed-unsupported-attribution',
        out.annotations[0]?.action + ' | ' + out.text);
      // `delivered` is the whole of what the reader should receive. The mark used to follow it; now
      // nothing does, so the row asserts equality with it rather than a prefix plus a mark — which
      // refuses a particle left behind, a truncation, and any appendage, all in one clause.
      ok('ع-٥٥/ب ' + witness.id + ': ...and the particle left with the frame it qualified',
        out.text.trim() === witness.delivered,
        out.text);
    }

    // [RED] THE NEGATIVE, AND IT IS THE WHOLE RISK OF THIS CHANGE. A credit that IS verified
    // must still be shown, and shown exactly as it is shown today. Three of them, each on its
    // own official host, each carrying one of the phrasings above.
    for (const witness of [
      { id: 'ibn-baz', text: 'وقد ذكر ابن باز أن المسح على الخفين جائز.',
        scholar: 'ابن باز', identifier: 'binbaz:1', host: 'binbaz.org.sa' },
      { id: 'al-barrak', text: 'المسألة فيها سعة، وقد قال عبد الرحمن البراك إن المسح جائز.',
        scholar: 'عبد الرحمن البراك', identifier: 'albarrak:1', host: 'sh-albarrak.com' },
      { id: 'al-khathlan', text: 'خلاصة الجواب أن الأمر واسع، وقد ذكر سعد الخثلان أن المسح جائز.',
        scholar: 'سعد الخثلان', identifier: 'alkhathlan:1', host: 'saadalkhathlan.com' },
    ]) {
      const out = module.reviewAnswer({
        text: witness.text,
        domain: 'fiqh',
        mode: 'عادي',
        evidence: [{
          id: witness.identifier, identifier: witness.identifier, title: 'فتوى',
          url: 'https://' + witness.host + '/x', scholar: witness.scholar,
          snippet: 'المسح على الخفين جائز يوما وليلة للمقيم.',
        }],
      });
      ok('ع-٥٥/ب [RED] a VERIFIED credit is still shown — ' + witness.id,
        out.text === witness.text
          && out.annotations[0]?.action === 'kept-sourced-attribution',
        JSON.stringify({ action: out.annotations[0]?.action, text: out.text }));
    }

    // THE MUTANT. Take «قد» back out of the trailing-connector list and the owner's witness
    // returns to the marked branch, with the credit standing in front of the reader.
    const qadMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'a55b-qad-not-a-frame-particle',
      transform: (source) => source.split('|قد|وقد|فقد)(?=').join(')(?='),
      survives: (mod) => {
        const out = mod.reviewAnswer({
          text: 'خلاصة الجواب أن المسح جائز، وقد قال ابن قدامة إن مدته يوم وليلة.',
          evidence: [], domain: 'fiqh', mode: 'عادي',
        });
        return out.annotations[0]?.action === 'removed-unsupported-attribution';
      },
    });
    ok('ع-٥٥/ب mutant seam applied', qadMutant.changed, qadMutant.error);
    ok('ع-٥٥/ب MUTANT KILLED: without «قد» the credit is decorated again, not removed',
      qadMutant.loaded && qadMutant.survived === false, JSON.stringify(qadMutant));

    // ── THE LAST MUTANT, TURNED AROUND WITH THE GUARD ────────────────────────
    //
    // It was `strip-unsupported-attribution-without-tag`: it deleted the `tag(...)` call so the
    // credit fell silently, and this guard had to notice. That mutation IS the owner's change of
    // 18 Sep — the line it rewrote no longer exists, and the behaviour it simulated is now the
    // shipped behaviour. A mutant that produces the correct product cannot be killed.
    //
    // SO IT RUNS THE OTHER WAY. The fear is no longer that the mark is missing; it is that the mark
    // comes back. This welds it onto the one branch that ever wrote a per-sentence mark, and the
    // guard's own headline predicate must kill it. That is what keeps the first row of this file
    // from being a clause about nothing: without this mutant, «no mark is written» would pass on a
    // reviewer that had been given a writer back, so long as no other row happened to look.
    const mutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'weld-the-attribution-mark-back-on',
      transform: (source) => source.replace(
        [
          "          const reviewed = generalized || '';",
          '          if (reviewed) {',
          '            output.push(reviewed);',
        ].join('\n'),
        [
          "          const reviewed = generalized || '';",
          '          if (reviewed) {',
          "            output.push(reviewed + ' ' + TAGS.ATTRIBUTION_REMOVED); // mutant: the writer returns",
        ].join('\n')),
      survives: unsupportedIsHandledSilently,
    });
    ok('mutant seam applied', mutant.changed, mutant.error);
    ok('mutant module loaded successfully', mutant.loaded, mutant.error);
    ok('MUTANT KILLED: the honesty mark cannot be welded back on',
      mutant.loaded && mutant.survived === false, JSON.stringify(mutant));
    // ── THIRD ORDER, STEP 6 · THE SPEAKER IS GENERALISED, NEVER ERASED (THE OWNER'S DECISION 2) ──
    // The four places measured in the second order, the five frames, and the two lines this rule
    // must never cross: a Companion is «in the athar» and never «رُوي», and a Companion narrating the
    // Prophet ﷺ is a chain — no speaker is put in front of the Prophet's words.
    {
      const say6 = (t) => module.reviewAnswer({ text: t, evidence: [], domain: 'fiqh', mode: 'عادي' });
      for (const [id, input, expected] of [
        ['W9 قال', 'وحكم عليه ابن الجوزي بالوضع، وقال ابن حبان: باطل لا أصل له.',
          'وحكم عليه ابن الجوزي بالوضع، وقال بعض أهل العلم: باطل لا أصل له.'],
        ['F20 يرى', 'وشيخ الإسلام ابن تيمية يرى أن وجه المرأة ويديها كبدن الرجل في الإحرام.',
          'ومن أهل العلم من يرى أن وجه المرأة ويديها كبدن الرجل في الإحرام.'],
        ['F20 صحابي', 'ولا فدية على الحائض، فقد قال ابن عباس رضي الله عنهما: «أمر الناس أن يكون آخر عهدهم بالبيت، إلا أنه خفف عن الحائض».',
          'ولا فدية على الحائض، وجاء في الأثر: «أمر الناس أن يكون آخر عهدهم بالبيت، إلا أنه خفف عن الحائض».'],
        ['F17 كما قال', 'ويجوز لها ذلك من غير حرج، كما قال الكاساني رحمه الله: «يجب على الحائض قضاء الصوم».',
          'ويجوز لها ذلك من غير حرج، كما قال بعض أهل العلم: «يجب على الحائض قضاء الصوم».'],
        ['ذهب', 'والوضوء من لحم الإبل واجب، وذهب الإمام أحمد وجوب الوضوء منه على كل حال.',
          'والوضوء من لحم الإبل واجب، وذهب بعض أهل العلم إلى وجوب الوضوء منه على كل حال.'],
        ['قال بـ', 'قال ابن باز بجواز الجمع للمسافر.', 'وقال بعض أهل العلم بجواز الجمع للمسافر.'],
      ]) {
        const out = say6(input);
        ok('111-T6 ' + id + ': the name goes, a general speaker takes its place, the claim is whole',
          out.text === expected && out.annotations[0]?.action === 'removed-unsupported-attribution', out.text);
      }
      {
        const out = say6('ولا فدية على الحائض، فقد قال ابن عباس رضي الله عنهما: «أمر الناس أن يكون آخر عهدهم بالبيت».').text;
        ok('111-T6 a Companion is never «رُوي» — the weakening form is not in what the reader gets',
          !/رُ?وي/u.test(out.replace(/«[^»]*»/gu, '')) && out.includes('وجاء في الأثر:'), out);
      }
      {
        const narr = 'الصدق واجب. عن ابن مسعود رضي الله عنه قال: قال رسول الله ﷺ: «إن الصدق يهدي إلى البر».';
        const out = say6(narr);
        ok('111-T6 a Companion narrating the Prophet ﷺ takes no speaker in front of the Prophet\'s words',
          !/أهل العلم|في الأثر/u.test(out.text) && out.text.includes('«إن الصدق يهدي إلى البر»'), out.text);
      }
      {
        // A frame outside the five is exactly as it was: the name goes and nothing takes its place.
        const out = say6('الأمر واسع، فقد ذكر ابن قدامة أن المسح على الخفين جائز.');
        ok('111-T6 a frame outside the five («ذكر») is handled exactly as before',
          out.text === 'الأمر واسع، المسح على الخفين جائز.', out.text);
      }
      const gen6 = await runMutant({
        sourceFile: REVIEWER,
        name: 'erase-the-speaker-again',
        transform: (source) => source.replace(
          '  const speaker = generalSpeakerFor(sentence, attribution);',
          '  const speaker = null; // mutant'),
        survives: (mod) => mod.reviewAnswer({ text: 'وحكم عليه ابن الجوزي بالوضع، وقال ابن حبان: باطل لا أصل له.', evidence: [], domain: 'fiqh', mode: 'عادي' })
          .text.includes('وقال بعض أهل العلم:'),
      });
      ok('111-T6 generalise mutant seam applied', gen6.changed, gen6.error);
      ok('MUTANT KILLED: with the speaker erased again, the view is left in the answer\'s own voice',
        gen6.loaded && gen6.survived === false, JSON.stringify(gen6));
    }
    // ── FOURTH ORDER [r36] · THE REVIEWER NEVER GENERALISES A SPEAKER WHO IS THE PROPHET ﷺ ──────
    // MEASURED (battery measure report, rows د and و): the logged T6 and T10 rows, replayed here
    // verbatim, were «وجاء في الأثر:» for «وقال لعائشةَ رضي الله عنها لمّا حاضت:» (she is addressed)
    // and «وقال بعض أهل العلم:» for «فلما أكثرَ عليه قال:» (the Prophet's ﷺ own word). A frame that
    // names no speaker stays exactly as written; «رضي الله عنه» counts on the speaker alone.
    {
      const say36 = (t) => module.reviewAnswer({ text: t, evidence: [], domain: 'fiqh', mode: 'chat' }).text;
      for (const [id, input] of [["T6","وقال لعائشةَ رضي الله عنها لمّا حاضت: «افعلي ما يفعل الحاجّ، غير ألا تطوفي بالبيت»."],["T10","ويؤكّد هذا الجمعَ ما رواه ابن حبان أنَّ أبا محصن استأذن النبيَّ صَلَّى اللهُ عَلَيْهِ وَسَلَّم في أخذ خراج حجّامه فأبى، فلما أكثرَ عليه قال: \"أَطْعِمْهُ رَقِيقَكَ وَاعْلِفْهُ نَاضِحَكَ\"، ولو كان حرامً لم يعطه."],["sib-saw-faqala","سئل النبي ﷺ عن الوضوء من لحوم الإبل فقال ﷺ: «نعم، فتوضأ من لحوم الإبل»."],["sib-saw-muadh","وقال صلى الله عليه وسلم لمعاذ رضي الله عنه: «إنك تأتي قوما من أهل الكتاب»."],["sib-rajul","سأل رجلٌ النبيَّ ﷺ عن الصلاة في مرابض الغنم، فقال: «صلوا فيها فإنها بركة»."],["sib-lahaa","ودخل النبي ﷺ على عائشة رضي الله عنها وهي تبكي. ثم قال لها: «إن هذا أمر كتبه الله على بنات آدم»."],["undet-qaala","وقال: «من لم يدع قول الزور والعمل به فليس لله حاجة في أن يدع طعامه وشرابه»."]]) {
        const out = say36(input);
        ok('r36 ' + id + ': no general speaker, the frame is exactly as the model wrote it',
          out.replace(/\s+/gu, ' ') === input.replace(/\s+/gu, ' ') &&!/وجاء في الأثر|بعض أهل العلم/u.test(out), out);
      }
      for (const [id, input, expected] of [["ctl-aisha","وقالت عائشة رضي الله عنها: «كنا نؤمر بقضاء الصوم ولا نؤمر بقضاء الصلاة».","وجاء في الأثر: «كنا نؤمر بقضاء الصوم ولا نؤمر بقضاء الصلاة»."],["ctl-ibnumar","وقال ابن عمر رضي الله عنهما: «إذا أمسيت فلا تنتظر الصباح».","وجاء في الأثر: «إذا أمسيت فلا تنتظر الصباح»."],["ctl-ibntaymiyya","وقال ابن تيمية: «الواجب على المسلم أن يتحرى الحق».","وقال بعض أهل العلم: «الواجب على المسلم أن يتحرى الحق»."],["ctl-ibnbaz","وسُئل ابن باز عن ذلك فقال: «لا حرج في ذلك إن شاء الله».","وقال بعض أهل العلم: «لا حرج في ذلك إن شاء الله»."]]) {
        ok('r36 control ' + id + ': generalised exactly as before', say36(input) === expected, say36(input));
      }
      ok('r36 the prayer on the person ADDRESSED is not the speaker\'s: al-Shafi\'i is a scholar',
        say36("وقال الشافعي لأبي هريرة رضي الله عنه: «هذا حسن».") === 'وقال بعض أهل العلم: «هذا حسن».', say36("وقال الشافعي لأبي هريرة رضي الله عنه: «هذا حسن»."));
      const noSpeaker = await runMutant({
        sourceFile: REVIEWER,
        name: 'a-frame-naming-nobody-is-a-credit-again',
        transform: (source) => source.replace(
          '    if (frameNamesNoSpeaker(claimed)) continue; // [r36] — the frame names nobody; see above\n', ''),
        survives: (mod) => !/وجاء في الأثر|بعض أهل العلم/u.test(mod.reviewAnswer({ text: "وقال لعائشةَ رضي الله عنها لمّا حاضت: «افعلي ما يفعل الحاجّ، غير ألا تطوفي بالبيت».", evidence: [], domain: 'fiqh', mode: 'chat' }).text),
      });
      ok('r36 speakerless-frame mutant seam applied', noSpeaker.changed, noSpeaker.error);
      ok('MUTANT KILLED: with a frame naming nobody read as a credit, T6 takes a general speaker again',
        noSpeaker.loaded && noSpeaker.survived === false, JSON.stringify(noSpeaker));
      const anyPrayer = await runMutant({
        sourceFile: REVIEWER,
        name: 'the-prayer-anywhere-makes-a-companion-again',
        transform: (source) => source.replace('!reachedThrough(matched.slice(0, prayerAt))', 'true'),
        survives: (mod) => !/وجاء في الأثر/u.test(mod.reviewAnswer({ text: "وقال الشافعي لأبي هريرة رضي الله عنه: «هذا حسن».", evidence: [], domain: 'fiqh', mode: 'chat' }).text),
      });
      ok('r36 speaker-only-prayer mutant seam applied', anyPrayer.changed, anyPrayer.error);
      ok('MUTANT KILLED: with the prayer read anywhere, al-Shafi\'i is «in the athar» again',
        anyPrayer.loaded && anyPrayer.survived === false, JSON.stringify(anyPrayer));
    }
  } catch (error) {
    ok('guard completed without exception', false, error?.stack || String(error));
  }
  process.exit(finish());
})();
