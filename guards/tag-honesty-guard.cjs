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
        // FIFTH ORDER [r44] (1): the name alone goes; «إن» stays and no colon is added.
        claim: 'وقال بعض أهل العلم إن الجمع للمسافر جائز عند الحاجة.',
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
        // [h46]: was 'وقال بعض أهل العلم: الجمع للمسافر جائز عند الحاجة.' — the prayer is no part of the
        // name, so it stays behind the general speaker, exactly where the model wrote it.
        // FOLLOWUP 49 item 1 (the owner's decision 5): MOVED BACK, with its reason. The owner ruled that a prayer after a generalised name goes with it («كما قال بعض أهل العلم رحمه الله»
        // read as a dua for nobody, printed in production at 48), so the claim is again the one [h46] had.
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
    // [h46] — REVERSED by the owner's invariant: a prayer is one piece and no part of a name that is
    // generalised. The name goes and the prayer stays, behind the general speaker. Was:
    //   ok('a removed name takes its honorific prayer with it',
    //     !out.text.includes('ابن باز') && !out.text.includes('رحمه الله') && out.text.includes('الجمع للمسافر جائز'))
    {
      const out = module.reviewAnswer({
        text: 'قال ابن باز رحمه الله إن الجمع للمسافر جائز عند الحاجة.',
        evidence: [], domain: 'fiqh', mode: 'عادي',
      });
      // FOLLOWUP 49 item 1 (the owner's decision 5): REVERSED AGAIN, with its reason. The prayer that closed a generalised name goes with it; the row's old title is kept in this comment: «a removed
      // name leaves its honorific prayer whole behind the general speaker [h46]», and its old expectation was 'وقال بعض أهل العلم رحمه الله إن الجمع للمسافر جائز عند الحاجة.'
      ok('a removed name takes its honorific prayer with it (FOLLOWUP 49 item 1, the owner\'s decision 5)',
        !out.text.includes('ابن باز') && out.text === 'وقال بعض أهل العلم إن الجمع للمسافر جائز عند الحاجة.'
          && !out.text.includes('رحمه الله') && out.text.includes('الجمع للمسافر جائز'), out.text);
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
        // FIFTH ORDER [r44]: the general-speaker line is now `lead + rest` (the rest verbatim).
        .replace("    const line = lead + rest;",
          "    const line = lead + ' \\u0627\\u0644\\u0641\\u0647\\u0645\\u064f \\u0627\\u0644\\u0639\\u0627\\u0645\\u0651\\u064f:' + rest; // mutant"),
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
      // MOVED BY FIX 48 item 9 (the owner's decision 11, row 14): «ذكر X أنّ …» keeps its verb and loses the name: «ذكر بعض أهل العلم أنّ …» (it was: the credit deleted, a bare claim).
      { id: 'waqad-zakara-anna-book',
        text: 'وقد ذكر ابن قدامة في المغني أن المسح على الخفين جائز.',
        delivered: 'ذكر بعض أهل العلم أن المسح على الخفين جائز.' },
      { id: 'waqad-zakara-anna-mid',
        text: 'المسألة فيها سعة، وقد ذكر ابن قدامة أن المسح على الخفين جائز.',
        delivered: 'المسألة فيها سعة، ذكر بعض أهل العلم أن المسح على الخفين جائز.' }, // FIX 48 item 9, as above
      { id: 'waqad-qala-inna-summary',
        text: 'خلاصة الجواب أن المسح جائز، وقد قال ابن قدامة إن مدته يوم وليلة.',
        // THIRD ORDER, STEP 6: was «…جائز، مدته…»; «وقد قال X إن» now reads «وقال بعض أهل العلم:».
        // FIFTH ORDER [r44] (1): «إن» after the name is the claim's, and stays.
        delivered: 'خلاصة الجواب أن المسح جائز، وقال بعض أهل العلم إن مدته يوم وليلة.' },
      { id: 'faqad-zakara-anna',
        text: 'الأمر واسع، فقد ذكر ابن قدامة أن المسح على الخفين جائز.',
        delivered: 'الأمر واسع، ذكر بعض أهل العلم أن المسح على الخفين جائز.' }, // FIX 48 item 9, as above
      { id: 'qad-zakara-anna-head',
        text: 'قد ذكر ابن قدامة أن المسح على الخفين جائز.',
        delivered: 'ذكر بعض أهل العلم أن المسح على الخفين جائز.' }, // FIX 48 item 9, as above
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
        // [h46]: was '…، كما قال بعض أهل العلم: «…».' — the prayer stays whole behind the general speaker.
        ['F17 كما قال', 'ويجوز لها ذلك من غير حرج، كما قال الكاساني رحمه الله: «يجب على الحائض قضاء الصوم».',
          'ويجوز لها ذلك من غير حرج، كما قال بعض أهل العلم: «يجب على الحائض قضاء الصوم».'],
        // FOLLOWUP 49 item 1 (the owner's decision 5): was '…، كما قال بعض أهل العلم رحمه الله: «…».' — the prayer that closed a generalised name goes with it.
        // FIFTH ORDER [r44] (1)(6): what followed the name follows the general speaker byte for byte;
        // the reviewer no longer adds an «إلى» the model did not write.
        ['ذهب', 'والوضوء من لحم الإبل واجب، وذهب الإمام أحمد وجوب الوضوء منه على كل حال.',
          'والوضوء من لحم الإبل واجب، وذهب بعض أهل العلم وجوب الوضوء منه على كل حال.'],
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
        // MOVED BY FIX 48 item 9 (the owner's decision 11, row 14): «ذكر X أنّ …» keeps its verb and loses the name: «ذكر بعض أهل العلم أنّ …» (it was: the credit deleted, a bare claim).
        // It was: «a frame outside the five is exactly as it was: the name goes and nothing takes its place» (the owner's earlier ruling). The owner has since given the verbs ذكر/أفتى/أجاب/قرر
        // and تقول their own formula (FIX 48 item 9); a frame outside THOSE nine verbs is still handled as before (see the FIX48-9 rows below).
        const out = say6('الأمر واسع، فقد ذكر ابن قدامة أن المسح على الخفين جائز.');
        ok('111-T6 «ذكر X أنّ»: the verb stays and the name is generalised (the owner\'s formula of row 14)',
          out.text === 'الأمر واسع، ذكر بعض أهل العلم أن المسح على الخفين جائز.', out.text);
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
      for (const [id, input, expected] of [["ctl-aisha","وقالت عائشة رضي الله عنها: «كنا نؤمر بقضاء الصوم ولا نؤمر بقضاء الصلاة».","وجاء في الأثر: «كنا نؤمر بقضاء الصوم ولا نؤمر بقضاء الصلاة»."],["ctl-ibnumar","وقال ابن عمر رضي الله عنهما: «إذا أمسيت فلا تنتظر الصباح».","وجاء في الأثر: «إذا أمسيت فلا تنتظر الصباح»."],["ctl-ibntaymiyya","وقال ابن تيمية: «الواجب على المسلم أن يتحرى الحق».","وقال بعض أهل العلم: «الواجب على المسلم أن يتحرى الحق»."],["ctl-ibnbaz","وسُئل ابن باز عن ذلك فقال: «لا حرج في ذلك إن شاء الله».","وسُئل بعض أهل العلم عن ذلك فقال: «لا حرج في ذلك إن شاء الله»."]]) {
        // FIFTH ORDER [r44] (1): ctl-ibnbaz was «وقال بعض أهل العلم: «…»» — «سُئل … عن ذلك ف» eaten with
        // the name. The name alone is replaced now; the other three are byte for byte what they were.
        ok('r36 control ' + id + ': generalised exactly as before', say36(input) === expected, say36(input));
      }
      ok('r36 the prayer on the person ADDRESSED is not the speaker\'s: al-Shafi\'i is a scholar',
        // FIFTH ORDER [r44] (3): was 'وقال بعض أهل العلم: «هذا حسن».' — «لأبي هريرة رضي الله عنه» eaten.
        // The name alone is replaced; the person addressed and his prayer stay, and he is still a scholar.
        say36("وقال الشافعي لأبي هريرة رضي الله عنه: «هذا حسن».") === 'وقال بعض أهل العلم لأبي هريرة رضي الله عنه: «هذا حسن».', say36("وقال الشافعي لأبي هريرة رضي الله عنه: «هذا حسن»."));
      const noSpeaker = await runMutant({
        sourceFile: REVIEWER,
        name: 'a-frame-naming-nobody-is-a-credit-again',
        transform: (source) => source.replace(
          '    if (frameNamesNoSpeaker(claimed)) continue; // [r36] — the frame names nobody; see above\n', ''),
        // [h46] — on T6 itself the mutant's rewrite would also drop «رضي الله عنها», which [h46] refuses on
        // its own; so T6 is asked together with its prayer-free twin, where only [r36] stands.
        survives: (mod) => ["وقال لعائشةَ رضي الله عنها لمّا حاضت: «افعلي ما يفعل الحاجّ، غير ألا تطوفي بالبيت».", "وقال لعائشةَ لمّا حاضت: «افعلي ما يفعل الحاجّ، غير ألا تطوفي بالبيت»."]
          .every((text) => !/وجاء في الأثر|بعض أهل العلم/u.test(mod.reviewAnswer({ text, evidence: [], domain: 'fiqh', mode: 'chat' }).text)),
      });
      ok('r36 speakerless-frame mutant seam applied', noSpeaker.changed, noSpeaker.error);
      ok('MUTANT KILLED: with a frame naming nobody read as a credit, T6 takes a general speaker again',
        noSpeaker.loaded && noSpeaker.survived === false, JSON.stringify(noSpeaker));
      const anyPrayer = await runMutant({
        sourceFile: REVIEWER,
        name: 'the-prayer-anywhere-makes-a-companion-again',
        // FIFTH ORDER [r44]: the speaker now ends at the name, so «reading the prayer anywhere» means
        // reading it past the speaker too — the whole rest of the sentence — as well as not asking how
        // it was reached. That is the mutant; the seam it cuts is where the speaker's span is read.
        transform: (source) => source.replace('!reachedThrough(matched.slice(0, prayerAt))', 'true')
          .replace('  const matched = sentence.slice(attribution.start, speakerEnd).replace(ARABIC_DIACRITICS, \'\');',
            '  const matched = sentence.slice(attribution.start).replace(ARABIC_DIACRITICS, \'\'); // mutant'),
        survives: (mod) => !/وجاء في الأثر/u.test(mod.reviewAnswer({ text: "وقال الشافعي لأبي هريرة رضي الله عنه: «هذا حسن».", evidence: [], domain: 'fiqh', mode: 'chat' }).text),
      });
      ok('r36 speaker-only-prayer mutant seam applied', anyPrayer.changed, anyPrayer.error);
      ok('MUTANT KILLED: with the prayer read anywhere, al-Shafi\'i is «in the athar» again',
        anyPrayer.loaded && anyPrayer.survived === false, JSON.stringify(anyPrayer));
    }
    // ── FIFTH ORDER [r44] · THE REVIEWER TOUCHES THE SPEAKER'S NAME AND NOTHING ELSE ───────────
    // MEASURED on the preview at 6119411 (21:13:31Z): the reviewer took «أنّه يجوزُ ذكرُ» out of the
    // sentence below while generalising a speaker who names nobody, and the ruling went with it.
    {
      const say44 = (t) => module.reviewAnswer({ text: t, evidence: [], domain: 'fiqh', mode: 'chat' }).text;
      const firstLine = (t) => say44(t).split('\n')[0];
      const Q9 = 'ذهب طائفةٌ من أهل العلم إلى أنّه يجوزُ ذكرُ الحديث الضعيف في الترغيب والترهيب وفضائل الأعمال، لا في إثبات الأحكام ولا العقائد، وذلك بشروط ثلاثة اشترطها المحدّثون:';
      ok('r44 the logged sentence («قبل», verbatim) leaves the reviewer exactly as it came in', say44(Q9) === Q9, say44(Q9));
      for (const [id, input, expected] of [
        // (1)(3) — the three shapes of the fourth order's run notes (1) and (2), and one more of (2).
        ['shape-1 بعد', 'قال ابن باز بعد ذكر حديث أنس رضي الله عنه: «من صلى البردين دخل الجنة».',
          'وقال بعض أهل العلم بعد ذكر حديث أنس رضي الله عنه: «من صلى البردين دخل الجنة».'],
        ['shape-2 عن', 'وقال ابن تيمية عن ابن عباس رضي الله عنهما: «كان فقيها في الدين».',
          'وقال بعض أهل العلم عن ابن عباس رضي الله عنهما: «كان فقيها في الدين».'],
        ['shape-2 في', 'وقال ابن القيم في حديث أبي هريرة رضي الله عنه: «فيه دليل على جواز ذلك».',
          'وقال بعض أهل العلم في حديث أبي هريرة رضي الله عنه: «فيه دليل على جواز ذلك».'],
        ['shape-2 عن حديث', 'وقال ابن عثيمين عن حديث عائشة رضي الله عنها: «هذا يدل على الاستحباب».',
          'وقال بعض أهل العلم عن حديث عائشة رضي الله عنها: «هذا يدل على الاستحباب».'],
        // siblings written for this order
        ['sib ذهب إلى أنّه', 'وذهب ابن حزم إلى أنّه يجب الوتر على كل مسلم.', 'وذهب بعض أهل العلم إلى أنّه يجب الوتر على كل مسلم.'],
        // [h46]: was 'وقال بعض أهل العلم بعد أن ذكر الخلاف: «…».' — the title goes with the name, the prayer stays.
        ['sib لقب ودعاء ثم ظرف', 'وقال الشيخ ابن عثيمين رحمه الله بعد أن ذكر الخلاف: «والأقرب أن الأمر واسع».',
          'وقال بعض أهل العلم بعد أن ذكر الخلاف: «والأقرب أن الأمر واسع».'],
        // FOLLOWUP 49 item 1 (the owner's decision 5): was 'وقال بعض أهل العلم رحمه الله بعد أن ذكر الخلاف: …' — the prayer goes with the generalised name.
        // MOVED BY FIX 48 item 9 (the owner's decision 11, row 14): «ذكر X أنّ …» keeps its verb and loses the name: «ذكر بعض أهل العلم أنّ …» (it was: the credit deleted, a bare claim). The first clause now carries the general speaker, so «ثم قال:» after it has no NAMED speaker left to generalise: it stays as written, and its subject is the one before it.
        ['sib ثم قال: عالم متعيّن', 'وذكر ابن القيم أنّ الأمرَ فيه سعة، ثم قال: «والصواب أن يفعل ما هو أيسر».',
          'وذكر بعض أهل العلم أنّ الأمرَ فيه سعة، ثم قال: «والصواب أن يفعل ما هو أيسر».'],
      ]) {
        ok('r44 ' + id + ': the name alone is generalised, every byte after it stays', say44(input) === expected, say44(input));
      }
      for (const [id, input] of [
        ['(2) جمهور العلماء', 'ذهب جمهور العلماء إلى أنّه يُستحبُّ رفع اليدين في تكبيرات العيد.'],
        ['(2) بعض أهل العلم', 'ويرى بعض أهل العلم أنّه يجب قضاء الصوم على الفور.'],
        ['(2) طائفة، لا تُعمَّم', 'ذهب طائفة من أهل العلم إلى أنه لا يعمل بالحديث الضعيف مطلقا.'],
      ]) {
        ok('r44 ' + id + ': a speaker who names nobody is not touched', firstLine(input) === input, say44(input));
      }
      for (const [id, input] of [
        ['(4) النبي ﷺ في الجملة قبلها', 'وكان النبي ﷺ يفعلُ ذلك في السفر. وقال: «صلوا كما رأيتموني أصلي».'],
        ['(4) النبي ﷺ مسؤولًا، والسائل مسمًّى', 'وسأل ابن عمر النبيَّ ﷺ عن ذلك. فقال: «افعل ولا حرج».'],
        ['(4) «وقال:» في أوّل الجواب', 'وقال: «من صلى الفجر في جماعة فهو في ذمة الله».'],
      ]) {
        const out = say44(input);
        ok('r44 ' + id + ': the frame is exactly as the model wrote it',
          out.replace(/\s+/gu, ' ') === input.replace(/\s+/gu, ' ') && !/وجاء في الأثر|بعض أهل العلم/u.test(out), out);
      }
      const killed44 = async (name, from, to, survives) => {
        const m = await runMutant({ sourceFile: REVIEWER, name, transform: (source) => source.replace(from, to), survives });
        ok('r44 mutant seam applied — ' + name, m.changed, m.error);
        ok('MUTANT KILLED: ' + name, m.loaded && m.survived === false, JSON.stringify(m));
      };
      const NAMED_Q9 = 'وذهب ابن حزم إلى أنّه يجوزُ ذكرُ الحديث الضعيف في الترغيب والترهيب وفضائل الأعمال.';
      await killed44('without (1) the rewrite eats «أنّه يجوزُ ذكرُ» again (the logged shape, named)',
        '    const rest = sentence.slice(attribution.speakerEnd ?? attribution.end);',
        '    const rest = sentence.slice(attribution.end); // mutant',
        (mod) => mod.reviewAnswer({ text: NAMED_Q9, evidence: [], domain: 'fiqh', mode: 'chat' }).text.includes('إلى أنّه يجوزُ ذكرُ الحديث'));
      await killed44('without (2) «طائفةٌ من أهل العلم» is generalised again',
        '    if (namesNoOne(claimed)) continue; // [r44] (2) — «أهل العلم» names nobody; see above\n', '',
        // On the logged line itself (1) also holds: a name-first capture with no man in it is passed
        // over. So (2) is proved on the same speaker in a frame (1) does not shield.
        (mod) => mod.reviewAnswer({ text: 'وقال طائفةٌ من أهل العلم: إن الأمر فيه سعة.', evidence: [], domain: 'fiqh', mode: 'chat' }).text === 'وقال طائفةٌ من أهل العلم: إن الأمر فيه سعة.');
      await killed44('without the first condition of (4) the Prophet\'s ﷺ words go to a general speaker again',
        '  if (PROPHET_FRAME_RE.test(view(text)) || (previous && PROPHET_FRAME_RE.test(view(previous)))) return null;\n', '',
        // [h53]: was the first witness alone; [h53] keeps it too, so a twin it does not shield joins it.
        (mod) => ['وسأل ابن عمر النبيَّ ﷺ عن ذلك. فقال: «افعل ولا حرج».', 'وكان ابن باز يستدل بسنة النبيِّ ﷺ في ذلك. فقال: «افعل ولا حرج».']
          .every((text) => !/بعض أهل العلم|في الأثر/u.test(mod.reviewAnswer({ text, evidence: [], domain: 'fiqh', mode: 'chat' }).text)));
    }
    // ── [h46] · GOD'S NAME IS NEVER REPLACED, AND A PRAYER IS ONE PIECE ───────────────────────
    // MEASURED (batch 4, W-mash-c) at 92d3c7d, in production wherever the seal keeps the sentence:
    //   in   «وعن علي رضي الله عنه قال: …»   out  «وعن علي رضي بعض أهل العلم عنه قال: …»
    // The owner's invariant: «الله» is never replaced, dropped or parted from its formula; each formula
    // is one piece and no part of a name that is generalised. A Companion's whole frame may become
    // «وجاء في الأثر:» and take its prayer with it — that alone. Anything else keeps the frame as written.
    {
      const say46 = (t) => module.reviewAnswer({ text: t, evidence: [], domain: 'fiqh', mode: 'chat' }).text;
      const LEAD = 'المسح على الخفين جائز باتفاق أهل العلم.';
      for (const [id, input, expected] of [
        ['W-mash-c (b26, with «رواه»)', 'وعن علي رضي الله عنه قال: لو كان الدين بالرأي لكان أسفل الخف أولى بالمسح من أعلاه، رواه أبو داود.', null],
        ['the live shape (no «رواه», the seal keeps it)', 'وعن علي رضي الله عنه قال: لو كان الدين بالرأي لكان أسفل الخف أولى بالمسح من أعلاه.', null],
        ['عن ابن عمر … عنهما', 'وعن ابن عمر رضي الله عنهما قال: صحبت النبي ﷺ فكان لا يزيد في السفر على ركعتين.', null],
        ['عن عائشة … عنها قالت', 'وعن عائشة رضي الله عنها قالت: فرضت الصلاة ركعتين ركعتين.', null],
        ['عن أنس … «…»', 'وعن أنس رضي الله عنه قال: «كان النبي ﷺ يفطر على رطبات قبل أن يصلي».', null],
        ['عن ابن مسعود … موقوفا', 'وعن ابن مسعود رضي الله عنه موقوفا: إنما يكفي أحدكم أن يقول ما يكفيه.', null],
        ['قال عمر … عنه: (the athar takes the whole frame)', 'قال عمر بن الخطاب رضي الله عنه: نعمت البدعة هذه.', 'وجاء في الأثر: نعمت البدعة هذه.'],
        ['قال ابن القيم رحمه الله:', 'قال ابن القيم رحمه الله: منزلة التوبة أول المنازل وأوسطها وآخرها.',
          'وقال بعض أهل العلم: منزلة التوبة أول المنازل وأوسطها وآخرها.'],
        // FOLLOWUP 49 item 1 (the owner's decision 5): was 'وقال بعض أهل العلم رحمه الله: منزلة التوبة…' — the prayer goes with the generalised name.
        ['وقال الشيخ ابن باز رحمه الله تعالى:', 'وقال الشيخ ابن باز رحمه الله تعالى: صلاة الجماعة في المسجد واجبة على الرجال القادرين.',
          'وقال بعض أهل العلم: صلاة الجماعة في المسجد واجبة على الرجال القادرين.'],
        // FOLLOWUP 49 item 1 (the owner's decision 5): was 'وقال بعض أهل العلم رحمه الله تعالى: صلاة الجماعة…' — the prayer (with «تعالى») goes with the generalised name.
      ]) {
        const out = say46(LEAD + '\n' + input).split('\n')[1];
        const want = expected === null ? input : expected;
        ok('h46 ' + id + (expected === null ? ': the frame is exactly as the model wrote it' : ': generalised, every formula whole'),
          out === want && !/رضي بعض|رحمه بعض/u.test(out), out);
      }
      const ALI = LEAD + '\n' + 'وعن علي رضي الله عنه قال: لو كان الدين بالرأي لكان أسفل الخف أولى بالمسح من أعلاه.';
      const net46 = await runMutant({
        sourceFile: REVIEWER,
        name: 'a-rewrite-may-cut-a-formula-again',
        transform: (source) => source.replace(
          '  if (rewriteCutsSacredText(sentence, attribution, generalizeAttribution(sentence, attribution))) return true;\n', ''),
        survives: (mod) => !mod.reviewAnswer({ text: ALI, evidence: [], domain: 'fiqh', mode: 'chat' }).text.includes('رضي بعض أهل العلم عنه'),
      });
      ok('h46 formula mutant seam applied', net46.changed, net46.error);
      ok('MUTANT KILLED: without [h46] «رضي الله عنه» becomes «رضي بعض أهل العلم عنه» again',
        net46.loaded && net46.survived === false, JSON.stringify(net46));
      const implied46 = await runMutant({
        sourceFile: REVIEWER,
        name: 'the-divine-name-is-a-subject-again',
        transform: (source) => source.replace(
          '  return nameMentions(text).filter((item) => !item.through && !DIVINE_AUTHORITY_HEAD_RE.test(item.name));',
          '  return nameMentions(text).filter((item) => !item.through); // mutant'),
        survives: (mod) => !/قال بعض أهل العلم/u.test(mod.reviewAnswer({ text: ALI, evidence: [], domain: 'fiqh', mode: 'chat' }).text),
      });
      ok('h46 divine-subject mutant seam applied', implied46.changed, implied46.error);
      ok('MUTANT KILLED: without [h46] «الله» is read as the speaker and «قال بعض أهل العلم» is put after it',
        implied46.loaded && implied46.survived === false, JSON.stringify(implied46));
      const before46 = await runMutant({
        sourceFile: REVIEWER,
        name: 'a-named-frame-takes-a-speaker-from-before-again',
        transform: (source) => source.replace(
          '    if (!named.length && previous && !nameMentions(text.slice(0, m.index)).length) named = subjectMentions(previous);',
          '    if (!named.length && previous) named = subjectMentions(previous); // mutant'),
        // «على» in the sentence before is read as «علي»; the Companion's own frame must not take him.
        survives: (mod) => !/قال بعض أهل العلم/u.test(mod.reviewAnswer({ text: ALI, evidence: [], domain: 'fiqh', mode: 'chat' }).text),
      });
      ok('h46 speaker-from-before mutant seam applied', before46.changed, before46.error);
      ok('MUTANT KILLED: without [h46] «وعن علي رضي الله عنه قال:» takes a speaker from the sentence before',
        before46.loaded && before46.survived === false, JSON.stringify(before46));
    }
    // ── [h53] · A VERB OF NARRATION IS NO FRAME, AND A COMPANION IS NEVER «بعض أهل العلم» ─────────
    // MEASURED on the owner's battery (batch-4 preview 7f671f7, 22 Sep, question 11) and in production
    // (2026-09-22T03:48:04Z): «فبعث إليهم أبا عبيدة وقال» → «فبعث إليهم بعض أهل العلم وقال»، «بل تمنى عمر
    // … فقال» → «بل تمنى بعض أهل العلم …»، «فلمّا ذهب أبو طالبٍ ليأخذَه» → «فلمّا وذهب بعض أهل العلم ليأخذَه».
    // The owner's invariant: a name is generalised only as the subject of a verb of saying or view that
    // brings in words or a school; a narrated man, an object and a Companion keep the text as written
    // (a Companion who SAYS takes «وجاء في الأثر:», as he always has with his prayer).
    // The witnesses are the log's own «before» texts (the second completed after the log's 200-char cut).
    // null = the text exactly as the model wrote it; otherwise the whole delivered text.
    {
      const say53 = (t) => module.reviewAnswer({ text: t, evidence: [], domain: 'fiqh', mode: 'chat' }).text;
      // FOLLOWUP 49 item 1 (the owner's decision 5): row O53-qala-ibnbaz MOVED — its expected line was 'وقال بعض أهل العلم رحمه الله: …'; the prayer that closed a generalised name goes with it.
      const ROWS53 = [["W53-abu-talib-log","كان النبي ﷺ في صغره مع عمه في تجارة الشام.\nثمّ انصرف بحيرى فصنع لهم طعامًا، فلمّا ذهب أبو طالبٍ ليأخذَه معه استخبرَه بحيرى عمّا هو له، فأخبره أنّه ابنُ أخيه، فقال له: ما ينبغي لهذا الغلامِ أن يذهبَ إلى الشام، فإنّ اليهودَ إن رأَوه وعرفوا منه م",null],["W53-bath-abu-ubayda-log","وشهد له النبي صلى الله عليه وسلم بالجنة ضمن العشرة المبشرين، وائتمنه على أموال الأمة وأسرارها، حتى إن وفداً جاء يطلب من النبي صلى الله عليه وسلم أن يبعث معهم أميناً، فبعث إليهم أبا عبيدة وقال: «هذا أمين هذه الأمة».",null],["W53-tamanna-umar-log","وكان أبو عبيدة محبوبا عند الصحابة.\nبل تمنى عمر ذات مرة وهو بين جلسائه فقال: «لكني أتمنى بيتاً ممتلئاً رجالاً مثل أبي عبيدة بن الجراح».",null],["O53-arsala-muadh","والدعوة إلى التوحيد أول الواجبات.\nثم أرسل النبي ﷺ معاذا إلى اليمن وقال: «إنك تأتي قوما من أهل الكتاب».",null],["O53-jaa-abubakr","وكان الصديق أسبق الناس إلى الخير.\nفجاء أبو بكر رضي الله عنه فقال: «يا رسول الله، هذا مالي كله».","وكان الصديق أسبق الناس إلى الخير.\nوجاء في الأثر: «يا رسول الله، هذا مالي كله»."],["O53-dhahaba-ibnumar-souq","وكان ابن عمر شديد الاتباع.\nوذهب ابن عمر إلى السوق فاشترى طعاما لأهله.",null],["O53-dhahaba-ahmad-wujub","واختلف العلماء في الوضوء من لحم الإبل.\nوذهب الإمام أحمد إلى وجوب الوضوء من لحم الإبل.","واختلف العلماء في الوضوء من لحم الإبل.\nوذهب بعض أهل العلم إلى وجوب الوضوء من لحم الإبل.\nوتُراجَع المسألة مع أهل العلم لظهور الخلاف فيها."],["O53-qala-ibnbaz","وصلاة الجماعة واجبة.\nوقال ابن باز رحمه الله: صلاة الجماعة في المسجد واجبة على الرجال القادرين.","وصلاة الجماعة واجبة.\nوقال بعض أهل العلم: صلاة الجماعة في المسجد واجبة على الرجال القادرين."],["S53-jaa-umar-bare","وكان عمر وقافا عند كتاب الله.\nفجاء عمر فقال: «يا رسول الله، ألسنا على الحق؟».",null],["S53-kharaja-ibnmasud","وكان ابن مسعود من فقهاء الصحابة.\nوخرج ابن مسعود إلى الناس فقال: «اتبعوا ولا تبتدعوا».",null],["S53-raa-ibnumar","والسنة في الصلاة الطمأنينة.\nورأى ابن عمر رجلا يصلي فقال له: «ارجع فصل».",null],["S53-saala-abuhurayra","وكان أبو هريرة حريصا على العلم.\nوسأل أبو هريرة النبي ﷺ فقال: «من أسعد الناس بشفاعتك؟».",null],["S53-baatha-umar-abumusa","وكان عمر يولي الأكفاء.\nوبعث عمر أبا موسى إلى البصرة وقال: «علمهم السنة».",null],["S53-ata-rajul-ibnabbas","وكان ابن عباس ترجمان القرآن.\nوأتى ابن عباس رجل فسأله عن ذلك فقال: «لا بأس».",null],["S53-dhahaba-malik-madina","وكان مالك محدثا.\nوذهب مالك إلى المدينة فلقي شيوخها.",null],["S53-dhahaba-shafii-anna","واختلفوا في مس الذكر.\nوذهب الشافعي إلى أن مس الذكر ينقض الوضوء.",null],["S53-dhahaba-ibnqudama-qawl","واختلفوا في المسألة.\nوذهب ابن قدامة إلى القول بالاستحباب.","واختلفوا في المسألة.\nوذهب بعض أهل العلم إلى القول بالاستحباب."],["S53-suila-ibnbaz","والمسألة فيها سعة.\nوسُئل ابن باز عن ذلك فقال: «لا حرج في ذلك إن شاء الله».","والمسألة فيها سعة.\nوسُئل بعض أهل العلم عن ذلك فقال: «لا حرج في ذلك إن شاء الله»."],["S53-yara-ibnuthaymin","والجمع للمسافر جائز.\nويرى ابن عثيمين أن الجمع للمسافر جائز عند الحاجة.","والجمع للمسافر جائز.\nومن أهل العلم من يرى أن الجمع للمسافر جائز عند الحاجة."],["S53-dhakara-nawawi","والسواك سنة.\nوذكر النووي أن السواك مستحب في كل وقت.","والسواك سنة.\nوذكر بعض أهل العلم أن السواك مستحب في كل وقت."],["S53-ibntaymiyya-namefirst","والتوبة واجبة.\nوابن تيمية قال: «التوبة واجبة من كل ذنب».","والتوبة واجبة.\nوقال بعض أهل العلم: «التوبة واجبة من كل ذنب»."],["C53-qala-umar-bare","والتراويح سنة.\nوقال عمر: «نعمت البدعة هذه».","والتراويح سنة.\nوجاء في الأثر: «نعمت البدعة هذه»."],["C53-qalat-aisha-bare","وقضاء الحائض الصوم واجب.\nوقالت عائشة: «كنا نؤمر بقضاء الصوم ولا نؤمر بقضاء الصلاة».","وقضاء الحائض الصوم واجب.\nوجاء في الأثر: «كنا نؤمر بقضاء الصوم ولا نؤمر بقضاء الصلاة»."],["C53-qala-ibnabbas-bare","والكفر دركات.\nوقال ابن عباس: «هو كفر دون كفر».","والكفر دركات.\nوجاء في الأثر: «هو كفر دون كفر»."],["C53-qala-umar-abdalaziz","والعدل أساس الملك.\nوقال عمر بن عبد العزيز: «إن الله لا يؤاخذ العامة بعمل الخاصة».","والعدل أساس الملك.\nوقال بعض أهل العلم: «إن الله لا يؤاخذ العامة بعمل الخاصة»."],["C53-qala-ali-qari","والشرح مفيد.\nوقال علي القاري: «هذا حديث حسن المعنى».","والشرح مفيد.\nوقال بعض أهل العلم: «هذا حديث حسن المعنى»."],["C53-qala-malik-ibn-anas","والسنة سفينة نوح.\nوقال مالك بن أنس: «السنة سفينة نوح من ركبها نجا».","والسنة سفينة نوح.\nوقال بعض أهل العلم: «السنة سفينة نوح من ركبها نجا»."]];
      for (const [id, input, expected] of ROWS53) {
        const out = say53(input);
        ok('h53 ' + id + (expected === null ? ': exactly as the model wrote it' : ': as before h53, or «وجاء في الأثر:» for a Companion'),
          out === (expected === null ? input : expected), out);
      }
      const W53 = (id) => ROWS53.find((row) => row[0] === id)[1];
      const killed53 = async (name, from, to, survives) => {
        const m = await runMutant({ sourceFile: REVIEWER, name, transform: (source) => source.replace(from, to), survives });
        ok('h53 mutant seam applied — ' + name, m.changed, m.error);
        ok('MUTANT KILLED: ' + name, m.loaded && m.survived === false, JSON.stringify(m));
      };
      await killed53('without [h53] «ذهب أبو طالب ليأخذه» is a school again',
        "    if (at.verb === 'ذهب' && !DHAHABA_TO_A_SCHOOL_RE.test(next)) continue; // [h53] — he walked\n", '',
        (mod) => mod.reviewAnswer({ text: W53('W53-abu-talib-log'), evidence: [], domain: 'fiqh', mode: 'chat' }).text === W53('W53-abu-talib-log'));
      await killed53('without [h53] «فبعث إليهم أبا عبيدة وقال» names «بعض أهل العلم» again',
        '  if (narratesTheName(sentence.slice(match.index, nameStart)) || /^أبا\\s/u.test(name.name) || isCompanionName(name.name)) return null;\n', '',
        (mod) => mod.reviewAnswer({ text: W53('W53-bath-abu-ubayda-log'), evidence: [], domain: 'fiqh', mode: 'chat' }).text === W53('W53-bath-abu-ubayda-log'));
      await killed53('without [h53] «وخرج ابن مسعود إلى الناس فقال:» takes «بعض أهل العلم» after the verb again',
        '    if (told(text.slice(0, m.index)) || (previous && told(previous)) || (!companion && isCompanionName(claimed))) return null;\n', '',
        (mod) => mod.reviewAnswer({ text: W53('S53-kharaja-ibnmasud'), evidence: [], domain: 'fiqh', mode: 'chat' }).text === W53('S53-kharaja-ibnmasud'));
      await killed53('without [h53] «وقال عمر:» becomes «وقال بعض أهل العلم:» again',
        '  const companion = isCompanionName(attribution.claimed) // [h53]\n    || (', '  const companion = (',
        (mod) => !/بعض أهل العلم/u.test(mod.reviewAnswer({ text: W53('C53-qala-umar-bare'), evidence: [], domain: 'fiqh', mode: 'chat' }).text));
    }
    // ── COMPREHENSIVE 8-د, row 66 · A FRAME WITH NO NAME GETS NO CLASS AFTER «أنه قال» ─────────────────────────────────────────────────
    // The owner's own words (B4B §٦٦): «إطارٌ بلا اسمٍ لا يُحشى فيه صنفٌ بعدَ «أنه قال»؛ الاسمُ بعدَ «عن» ليس فاعلًا». MEASURED at bea348b, live in the
    // preview: «ونقل الخطيب البغدادي عن يحيى بن معين أنه قال: إنه كذب لا أصل له.» → «…أنه قال بعض أهل العلم: إنه كذب…». «حكى … عن … أنه قال» and
    // «ذكر … عن … أنه قال» too. The hearsay frame stays as written; the plain «قال X:» is generalised exactly as before.
    {
      const say66 = (t) => module.reviewAnswer({ text: t, evidence: [], domain: 'fiqh', mode: 'chat' }).text;
      const HEARSAY = [
        'ونقل الخطيب البغدادي عن يحيى بن معين أنه قال: إنه كذب لا أصل له.',
        'وحكى ابن عبد البر عن مالك أنه قال: لا بأس بذلك.',
        'وذكر الخطيب البغدادي عن يحيى بن معين أنه قال: إنه كذب.',
        'وأورد الذهبي عن أبي حاتم أنه قال: منكر الحديث.',
      ];
      HEARSAY.forEach((t, i) => ok('c66 hearsay frame #' + i + ': exactly as the model wrote it (no «بعض أهل العلم» behind «أنه قال»)', say66(t) === t, say66(t)));
      ok('c66 control: «وقال ابن باز: …» and «ثم قال ابن عثيمين: …» are generalised exactly as before',
        say66('وقال ابن باز: لا يجوز ذلك.') === 'وقال بعض أهل العلم: لا يجوز ذلك.' && say66('ثم قال ابن عثيمين: إنه مكروه.') === 'وقال بعض أهل العلم: إنه مكروه.');
      const m66 = await runMutant({ sourceFile: REVIEWER, name: 'without row 66 hearsay frames are stuffed again',
        transform: (source) => source.replace("    if (/(?:^|\\s)أن(?:ه|ها)\\s*$/u.test(view(text.slice(0, m.index)))) continue;", ''),
        survives: (mod) => mod.reviewAnswer({ text: HEARSAY[0], evidence: [], domain: 'fiqh', mode: 'chat' }).text === HEARSAY[0] });
      ok('c66 mutant seam applied', m66.changed, m66.error);
      ok('MUTANT KILLED: without the hearsay rule «…أنه قال بعض أهل العلم:» comes back', m66.loaded && m66.survived === false, JSON.stringify(m66));
    }
    // ── COMPREHENSIVE 8-د, row 67 · A SAYING VERB LEFT WITH NOBODY TO SAY IT TAKES THE GENERAL SPEAKER ─────────────────────────────────
    // The owner's: «وذكر ابن حجر عن الدارقطني أنه قال:» ⟸ «قال:». MEASURED at bea348b through the real reviewer: a credit whose verb is outside the five frames
    // («ذكر») went whole and left a bare «قال: تفرد به فلان.» with no speaker. It now reads «وقال بعض أهل العلم: …», the formula «وقال X:» already takes; the words
    // after the colon are byte for byte.
    {
      const say67 = (t) => module.reviewAnswer({ text: t, evidence: [], domain: 'fiqh', mode: 'chat' }).text;
      const W67 = [
        ['وذكر ابن حجر عن الدارقطني أنه قال: تفرد به فلان.', 'وقال بعض أهل العلم: تفرد به فلان.'],
        ['وقد ذكر ابن حجر عن الدارقطني أنه قال: تفرد به فلان.', 'وقال بعض أهل العلم: تفرد به فلان.'],
        ['وذكر ابن حجر عن الدارقطني قال: تفرد به فلان.', 'وقال بعض أهل العلم: تفرد به فلان.'],
      ];
      W67.forEach(([input, expected], i) => ok('c67 witness #' + i + ': no bare «قال:» is left; the general speaker stands in the frame', say67(input) === expected, say67(input)));
      ok('c67 controls: a frame that names its book, a reporter that is a hearsay frame, and a plain «قال X:» are exactly as before',
        say67('وذكر ابن حجر في الفتح عن الدارقطني أنه قال: تفرد به فلان.') === 'وذكر ابن حجر في الفتح عن الدارقطني أنه قال: تفرد به فلان.'
        && say67('ونقل الخطيب عن ابن معين أنه قال: ثقة.') === 'ونقل الخطيب عن ابن معين أنه قال: ثقة.'
        && say67('وقال ابن باز: لا يجوز ذلك.') === 'وقال بعض أهل العلم: لا يجوز ذلك.');
      ok('c67 the words after the colon are letter for letter what the model wrote', say67(W67[0][0]).endsWith(': تفرد به فلان.'));
      const m67 = await runMutant({ sourceFile: REVIEWER, name: 'without row 67 a bare «قال:» is left behind',
        transform: (source) => source.replace('if (!head) return givesBareSayingASpeaker(detachWeldedSubject(claim));', 'if (!head) return detachWeldedSubject(claim);'),
        survives: (mod) => mod.reviewAnswer({ text: W67[0][0], evidence: [], domain: 'fiqh', mode: 'chat' }).text === W67[0][1] });
      ok('c67 mutant seam applied', m67.changed, m67.error);
      ok('MUTANT KILLED: without the rule «قال: تفرد به فلان.» comes back', m67.loaded && m67.survived === false, JSON.stringify(m67));
    }
    // ── FIX 48 item 9 · ROW 14: THE VERBS OUTSIDE THE FORMULA (the owner's decision 11) ──────────────────────────────────────────────────────
    // MEASURED at the head through the real reviewer (the comprehensive report, 3.5 row 14): «ذكر X أنّ …» went whole and left a bare claim; «أجاب X بأن» became «ذلك جائز.»; «تقول X: …» became
    // «إن ذلك جائز.»; «قرر X أنّ» was not read as a credit at all. The owner's formula: the verb stays and the name goes («ذكر/أفتى/أجاب/قرر X أنّ/أنه/بأن …» ⟶ «… بعض أهل العلم أنّ …»), «تقول X: …» ⟶
    // «وقال بعض أهل العلم: …»; the sentence is rebuilt from its own text (the «و» it opens with, the verb as written, the general speaker, what followed the name byte for byte).
    // Only where the connector (or the colon) stands right after the name: «ذكر X عن Y أنه قال» (row 67) and «أفتى X بجواز …» keep the rules they had.
    {
      const say9 = (t) => module.reviewAnswer({ text: t, evidence: [], domain: 'fiqh', mode: 'chat' }).text;
      const SHAPES = [
        ['ذكر أنّ', 'وذكر ابن قدامة أن المسح على الخفين جائز.', 'وذكر بعض أهل العلم أن المسح على الخفين جائز.'],
        ['ذكر أنه', 'وذكر ابن قدامة أنه يجوز المسح على الخفين.', 'وذكر بعض أهل العلم أنه يجوز المسح على الخفين.'],
        ['ذكر بأن + لقب ودعاء', 'وذكر الشيخ ابن باز رحمه الله بأن المسح جائز.', 'وذكر بعض أهل العلم بأن المسح جائز.'],
        // FOLLOWUP 49 item 1 (the owner's decision 5): was 'وذكر بعض أهل العلم رحمه الله بأن المسح جائز.' — the prayer goes with the generalised name.
        ['أفتى أن', 'وأفتى ابن باز أن ذلك جائز.', 'وأفتى بعض أهل العلم أن ذلك جائز.'],
        ['أفتى بأن', 'وأفتى ابن باز بأن ذلك جائز.', 'وأفتى بعض أهل العلم بأن ذلك جائز.'],
        ['أجاب بأن', 'وأجاب ابن باز بأن ذلك جائز.', 'وأجاب بعض أهل العلم بأن ذلك جائز.'],
        ['أجاب أنه + لقب', 'وأجاب الشيخ ابن عثيمين أنه لا يجوز.', 'وأجاب بعض أهل العلم أنه لا يجوز.'],
        ['قرر أن', 'وقرر ابن تيمية أن الجمع جائز للمسافر.', 'وقرر بعض أهل العلم أن الجمع جائز للمسافر.'],
        ['قرر بلا واو', 'قرر ابن القيم أنه لا يصح.', 'قرر بعض أهل العلم أنه لا يصح.'],
        ['تقول: إن', 'وتقول اللجنة الدائمة: إن ذلك جائز.', 'وقال بعض أهل العلم: إن ذلك جائز.'],
        ['تقول: بلا إن', 'وتقول اللجنة الدائمة: ذلك جائز.', 'وقال بعض أهل العلم: ذلك جائز.'],
        ['ثم تقول', 'ثم تقول دار الإفتاء: لا حرج في ذلك.', 'وقال بعض أهل العلم: لا حرج في ذلك.'],
      ];
      SHAPES.forEach(([id, input, expected]) => ok('FIX48-9 ' + id + ': the verb stays, the name goes, what followed the name is byte for byte', say9(input) === expected, say9(input)));
      ok('FIX48-9 the words after the connector (or the colon) are letter for letter what the model wrote',
        say9(SHAPES[0][1]).endsWith('أن المسح على الخفين جائز.') && say9(SHAPES[9][1]).endsWith(': إن ذلك جائز.'));
      // controls: what keeps the rules it always had
      const CONTROLS = [
        ['row 67 (a relayed saying)', 'وذكر ابن حجر عن الدارقطني أنه قال: تفرد به فلان.', 'وقال بعض أهل العلم: تفرد به فلان.'],
        ['row 67 with its book named', 'وذكر ابن حجر في الفتح عن الدارقطني أنه قال: تفرد به فلان.', 'وذكر ابن حجر في الفتح عن الدارقطني أنه قال: تفرد به فلان.'],
        ['hearsay «نقل … عن … أنه قال»', 'ونقل الخطيب البغدادي عن يحيى بن معين أنه قال: إنه كذب لا أصل له.', 'ونقل الخطيب البغدادي عن يحيى بن معين أنه قال: إنه كذب لا أصل له.'],
        ['«أفتى X بجواز …» (no connector): kept as written', 'وأفتى ابن عثيمين بجواز المسح على الجوربين.', 'وأفتى ابن عثيمين بجواز المسح على الجوربين.'],
        ['«وقال X:» (the five): as before', 'وقال ابن باز: لا يجوز ذلك.', 'وقال بعض أهل العلم: لا يجوز ذلك.'],
        ['«ذهب X إلى أن» (the five): as before', 'وذهب الشافعي إلى أن مس الذكر ينقض الوضوء.', 'وذهب الشافعي إلى أن مس الذكر ينقض الوضوء.'],
      ];
      CONTROLS.forEach(([id, input, expected]) => {
        const out = say9(input);
        ok('FIX48-9 control · ' + id, out === expected, out);
      });
      ok('FIX48-9 a Companion keeps the rules he had: «ذكر ابن عباس أن …» is not given the general speaker', !/بعض أهل العلم/u.test(say9('وذكر ابن عباس رضي الله عنهما أن الصلاة واجبة.')), say9('وذكر ابن عباس رضي الله عنهما أن الصلاة واجبة.'));
      ok('FIX48-9 a VERIFIED credit is still shown as it is (the formula is for what nothing stands behind)',
        (() => {
          const out = module.reviewAnswer({ text: 'وقد ذكر ابن باز أن المسح على الخفين جائز.', domain: 'fiqh', mode: 'عادي',
            evidence: [{ id: 'binbaz:1', identifier: 'binbaz:1', title: 'فتوى', url: 'https://binbaz.org.sa/x', scholar: 'ابن باز', snippet: 'المسح على الخفين جائز يوما وليلة للمقيم.' }] });
          return out.text.includes('ابن باز') && !/بعض أهل العلم/u.test(out.text);
        })());
      // mutants: each piece of the rule taken out
      const mk9 = async (name, from, to, survives) => {
        const m = await runMutant({ sourceFile: REVIEWER, name, transform: (source) => source.replace(from, to), survives });
        ok('FIX48-9 mutant seam applied: ' + name, m.changed, m.error);
        ok('FIX48-9 MUTANT KILLED: ' + name, m.loaded && m.survived === false, JSON.stringify(m));
      };
      await mk9('the report verbs are out of the formula (the credit is deleted again)', "  ذكر: 'report', أفتى: 'report', أجاب: 'report', قرر: 'report', تقول: 'present',", "  // mutant: no new verbs",
        (mod) => mod.reviewAnswer({ text: SHAPES[0][1], evidence: [], domain: 'fiqh', mode: 'chat' }).text === SHAPES[0][2]);
      await mk9('«تقول» is out of the formula', ", تقول: 'present',", ',',
        (mod) => mod.reviewAnswer({ text: SHAPES[9][1], evidence: [], domain: 'fiqh', mode: 'chat' }).text === SHAPES[9][2]);
      await mk9('the connector need not stand right after the name (row 67 would be rebuilt)', '      if (!REPORT_CONNECTOR_RE.test(after)) return null;\n', '',
        (mod) => mod.reviewAnswer({ text: CONTROLS[0][1], evidence: [], domain: 'fiqh', mode: 'chat' }).text === CONTROLS[0][2]);
      await mk9('«قرر» is not read as a credit', '(?:قال|ذكر|أفتى|أجاب|يرى|تقول|قالت|قرر)', '(?:قال|ذكر|أفتى|أجاب|يرى|تقول|قالت)',
        (mod) => mod.reviewAnswer({ text: SHAPES[7][1], evidence: [], domain: 'fiqh', mode: 'chat' }).text === SHAPES[7][2]);
    }
    // ── ORDER 52 item 2 · THE FRAME IS GENERALISED WHOLE WHEN A QUOTATION STANDS INSIDE IT (the owner's decision; row 68's remaining shape) ──────────────────────────────────────────────────
    // MEASURED at the head (085dac0) through the real reviewer: «وسئل الإمام أحمد عن معناه مع حديث «…» فقال: لا بأس به.» came out «… الإمام أحمد … فقال بعض أهل العلم: …» — the name-first pattern cannot reach across the
    // guillemets, so the sentence arrived at the implied-speaker route, which put the class behind «فقال» and left the man named. Without a quotation inside, the same sentence gives «وسئل بعض أهل العلم عن معناه فقال: …».
    {
      const say52 = (t) => module.reviewAnswer({ text: t, evidence: [], domain: 'fiqh', mode: 'chat' }).text;
      const Q52 = '«من أدرك ركعة من الصلاة فقد أدرك الصلاة»';
      const mid52 = 'وسئل الإمام أحمد عن معناه مع حديث ' + Q52 + ' فقال: لا بأس به.';
      const SHAPES52 = [
        ['a quotation in the MIDDLE of the frame', mid52, 'وسئل بعض أهل العلم عن معناه مع حديث ' + Q52 + ' فقال: لا بأس به.'],
        ['a quotation at the START of the frame', 'وروي حديث ' + Q52 + ' وسئل الإمام أحمد عنه فقال: لا بأس به.', 'وروي حديث ' + Q52 + ' وسئل بعض أهل العلم عنه فقال: لا بأس به.'],
        ['a quotation at the END of the frame', 'وسئل الإمام أحمد عن معناه فقال: ' + Q52 + '.', 'وسئل بعض أهل العلم عن معناه فقال: ' + Q52 + '.'],
        ['no quotation (the shape that was always right)', 'وسئل الإمام أحمد عن معناه فقال: لا بأس به.', 'وسئل بعض أهل العلم عن معناه فقال: لا بأس به.'],
        ['a prayer after the name goes with it', 'وسئل الإمام أحمد رحمه الله عن معناه مع حديث ' + Q52 + ' فقال: لا بأس به.', 'وسئل بعض أهل العلم عن معناه مع حديث ' + Q52 + ' فقال: لا بأس به.'],
        ['«الشيخ ابن باز» in the same shape', 'وسئل الشيخ ابن باز عن معناه مع حديث ' + Q52 + ' فقال: لا بأس به.', 'وسئل بعض أهل العلم عن معناه مع حديث ' + Q52 + ' فقال: لا بأس به.'],
      ];
      SHAPES52.forEach(([id, input, expected]) => { const out = say52(input); ok('ORDER52-2 ' + id, out === expected, out); });
      ok('ORDER52-2 the quotation itself and the words after «فقال:» are letter for letter what the model wrote',
        say52(mid52).includes(Q52) && say52(mid52).endsWith(' فقال: لا بأس به.'));
      // controls: what is NOT this shape keeps the rules it had
      const comp52 = 'وسئل ابن عمر رضي الله عنه عن معناه مع حديث ' + Q52 + ' فقال: لا بأس به.';
      ok('ORDER52-2 control: a Companion is never generalised (he keeps the rule he had: his name stays and no class is put in his place)', say52(comp52).includes('ابن عمر') && !/وسئل بعض أهل العلم/u.test(say52(comp52)), say52(comp52));
      const two52 = 'وسئل الإمام أحمد وابن باز عن معناه مع حديث ' + Q52 + ' فقال: لا بأس به.';
      ok('ORDER52-2 control: two men named in the sentence — the frame stays as written', say52(two52) === two52, say52(two52));
      const prev52 = 'وذكر ابن باز المسألة.\nوروي حديث ' + Q52 + ' فقال: لا بأس به.';
      ok('ORDER52-2 control: a man named in the sentence BEFORE is not renamed (the class goes behind the verb as before)', say52(prev52) === 'وذكر بعض أهل العلم المسألة.\nوروي حديث ' + Q52 + ' فقال بعض أهل العلم: لا بأس به.' || say52(prev52).endsWith('فقال بعض أهل العلم: لا بأس به.'), say52(prev52));
      const m52 = await runMutant({ sourceFile: REVIEWER, name: 'without ORDER 52 item 2 the class is put behind the verb and the name stays',
        transform: (source) => source.replace('if (fromThisSentence && last && ', 'if (false && last && '),
        survives: (mod) => mod.reviewAnswer({ text: mid52, evidence: [], domain: 'fiqh', mode: 'chat' }).text === SHAPES52[0][2] });
      ok('ORDER52-2 mutant seam applied', m52.changed, m52.error);
      ok('ORDER52-2 MUTANT KILLED: without the rule «الإمام أحمد» stays and «فقال بعض أهل العلم:» is written again', m52.loaded && m52.survived === false, JSON.stringify(m52));
    }
    // ── FOLLOWUP 49 item 1 · THE PRAYER GOES WITH THE NAME THAT IS GENERALISED (the owner's decision 5) ───────────────────────────────────────
    // MEASURED at the head (8864c48) through the real reviewer: «كما قال ابن القيم رحمه الله، ومن أطلق…» became «كما قال بعض أهل العلم رحمه الله، …» (the production text at 48, preview question 7):
    // a dua for nobody. The owner's closed list — رحمه/رحمها/رحمهما/رحمهم الله, رضي الله عنه/عنها/عنهما/عنهم, حفظه الله, عفا الله عنه, غفر الله له, نفع الله به, each with «تعالى» if it follows —
    // falls with the name. A name that STAYS keeps its prayer (the sentence is not touched). A dua outside the list, or one that is not the last thing in the speaker's span, is not dropped:
    // that sentence is left as the model wrote it, as before.
    {
      const say1 = (t) => module.reviewAnswer({ text: t, evidence: [], domain: 'fiqh', mode: 'chat' }).text;
      const PRAYERS = ['رحمه الله', 'رحمها الله', 'رحمهما الله', 'رحمهم الله', 'رضي الله عنه', 'رضي الله عنها', 'رضي الله عنهما', 'رضي الله عنهم',
        'حفظه الله', 'عفا الله عنه', 'غفر الله له', 'نفع الله به'];
      PRAYERS.forEach((prayer) => {
        // «رضي الله عنه» after a name makes it a Companion (the rule it always had): the athar takes the whole frame and the prayer goes with it.
        const want = /^رضي/u.test(prayer) ? 'وجاء في الأثر: لا يجوز ذلك.' : 'وقال بعض أهل العلم: لا يجوز ذلك.';
        ok('FOLLOWUP49-1 «' + prayer + '» goes with the generalised name',
          say1('وقال ابن باز ' + prayer + ': لا يجوز ذلك.') === want, say1('وقال ابن باز ' + prayer + ': لا يجوز ذلك.'));
      });
      ok('FOLLOWUP49-1 «تعالى» goes with it when it follows', say1('وقال ابن باز رحمه الله تعالى: لا يجوز ذلك.') === 'وقال بعض أهل العلم: لا يجوز ذلك.', say1('وقال ابن باز رحمه الله تعالى: لا يجوز ذلك.'));
      const W7 = 'النظرة المحرمة سهم مسموم من سهام إبليس، كما قال ابن القيم رحمه الله، ومن أطلق لحظاته دامت حسراته.';
      ok('FOLLOWUP49-1 the production witness (preview question 7): the comma and everything after the name stay byte for byte',
        say1(W7) === 'النظرة المحرمة سهم مسموم من سهام إبليس، كما قال بعض أهل العلم، ومن أطلق لحظاته دامت حسراته.', say1(W7));
      const SIBLINGS = [
        ['«ذهب X رحمه الله إلى»', 'وذهب ابن تيمية رحمه الله إلى أن الجمع جائز.', 'وذهب بعض أهل العلم إلى أن الجمع جائز.'],
        ['«يرى X رحمه الله أن»', 'ويرى ابن باز رحمه الله أن ذلك لا يجوز.', 'ومن أهل العلم من يرى أن ذلك لا يجوز.'],
        ['name first, «فصل فقال»', 'والشيخ محمد بن صالح العثيمين رحمه الله فصل فقال: إن صامه لسبب فلا بأس به.', 'وبعض أهل العلم فصل فقال: إن صامه لسبب فلا بأس به.'],
        ['the prayer after the colon', 'قال الشيخ محمد الأمين: ورحمه الله، الجمع للمسافر جائز عند الحاجة.', 'وقال بعض أهل العلم: الجمع للمسافر جائز عند الحاجة.'],
        ['a Companion takes the athar and his prayer goes with the frame (as it always did)', 'وقالت عائشة رضي الله عنها: كان يصوم.', 'وجاء في الأثر: كان يصوم.'],
        ['a dua that is NOT on the list is not dropped: the sentence is left as the model wrote it', 'وقال ابن باز رحمه الله ورفع درجته: لا يجوز ذلك.', 'وقال ابن باز رحمه الله ورفع درجته: لا يجوز ذلك.'],
        ['a dua that is not the last thing in the span is not dropped', 'وقال الشيخ ابن باز رحمه الله تعالى وغفر له: لا يجوز.', 'وقال الشيخ ابن باز رحمه الله تعالى وغفر له: لا يجوز.'],
        ['a name that STAYS keeps its prayer (not a credit frame)', 'هذا ما قرره ابن القيم رحمه الله في زاد المعاد.', 'هذا ما قرره ابن القيم رحمه الله في زاد المعاد.'],
      ];
      SIBLINGS.forEach(([id, input, expected]) => ok('FOLLOWUP49-1 ' + id, say1(input) === expected, say1(input)));
      ok('FOLLOWUP49-1 a VERIFIED credit keeps its name and its prayer',
        (() => {
          const out = module.reviewAnswer({ text: 'وقال ابن باز رحمه الله: المسح على الخفين جائز.', domain: 'fiqh', mode: 'عادي',
            evidence: [{ id: 'binbaz:1', identifier: 'binbaz:1', title: 'فتوى', url: 'https://binbaz.org.sa/x', scholar: 'ابن باز', snippet: 'المسح على الخفين جائز يوما وليلة للمقيم.' }] });
          return out.text.includes('ابن باز') && out.text.includes('رحمه الله') && !/بعض أهل العلم/u.test(out.text);
        })());
      const mk1 = async (name, from, to, survives) => {
        const m = await runMutant({ sourceFile: REVIEWER, name, transform: (source) => source.replace(from, to), survives });
        ok('FOLLOWUP49-1 mutant seam applied: ' + name, m.changed, m.error);
        ok('FOLLOWUP49-1 MUTANT KILLED: ' + name, m.loaded && m.survived === false, JSON.stringify(m));
      };
      await mk1('the prayer is put back behind the general speaker', 'return head ? `${head} ${line}` : line;', 'return head ? `${head} ${line.replace(/:/u, " رحمه الله:")}` : line.replace(/:/u, " رحمه الله:");',
        (mod) => mod.reviewAnswer({ text: 'وقال ابن باز رحمه الله: لا يجوز ذلك.', evidence: [], domain: 'fiqh', mode: 'chat' }).text === 'وقال بعض أهل العلم: لا يجوز ذلك.');
      await mk1('the sacred-text check does not let go of the prayer (the rewrite is refused and the name stays)', 'prayers ? prayers[i] : 0', '0',
        (mod) => mod.reviewAnswer({ text: 'وقال ابن باز رحمه الله: لا يجوز ذلك.', evidence: [], domain: 'fiqh', mode: 'chat' }).text === 'وقال بعض أهل العلم: لا يجوز ذلك.');
      await mk1('the list loses «نفع الله به»', 'غفر\\s+الله\\s+له|نفع\\s+الله\\s+به', 'غفر\\s+الله\\s+له',
        (mod) => mod.reviewAnswer({ text: 'وقال ابن باز نفع الله به: لا يجوز ذلك.', evidence: [], domain: 'fiqh', mode: 'chat' }).text === 'وقال بعض أهل العلم: لا يجوز ذلك.');
      await mk1('a prayer that is not the last thing in the span is dropped too (a dua outside the list would be lost with the name)', '(?:\\s+تعالى)?\\s*[،,]?$`, \'u\');', '(?:\\s+تعالى)?\\s*[،,]?`, \'u\');',
        (mod) => mod.reviewAnswer({ text: 'وقال ابن باز رحمه الله ورفع درجته: لا يجوز ذلك.', evidence: [], domain: 'fiqh', mode: 'chat' }).text === 'وقال ابن باز رحمه الله ورفع درجته: لا يجوز ذلك.');
    }
    // ── FOLLOWUP 49 item 6 · A NAME THAT JOINS THE MAN A TITLE NAMES TO THE ROW'S OWN AUTHOR IS NOBODY'S NAME (the owner's decision 9) ───────────────────────────────────────
    // MEASURED (the 3 Oct production text at 48): «وفصل ابن قدامة الطيار ذلك: …» under the card «وبل الغمامة في شرح عمدة الفقه لابن قدامة — عبد الله الطيار». The reviewer had NOT licensed the name (none of
    // the licences reaches it: «فصل» is no credit frame, so the sentence was never examined). Now a run of whole words «<the man the title names> + <the end of the author's name>» is an unsupported
    // credit whatever the verb; the author who IS the man the title names, the author's own name, and a turn with no such book row are untouched.
    {
      const row6 = (over = {}) => ({
        id: 'lib:6', title: 'وبل الغمامة في شرح عمدة الفقه لابن قدامة · ج1 · ص10', url: '', scholar: 'عبد الله الطيار',
        snippet: 'ذهب عامة متأخري الحنفية إلى أنه لا بأس بصيام هذه الست بعد الفطر، وهو مذهب الشافعية والحنابلة.',
        date: '', kind: 'lib_book', bookTitle: 'وبل الغمامة في شرح عمدة الفقه لابن قدامة', author: 'عبد الله الطيار', ...over,
      });
      const REST6 = ': ذهب عامة متأخري الحنفية إلى أنه لا بأس بصيام هذه الست بعد الفطر.';
      const say6 = (t, rows = [row6()]) => module.reviewAnswer({ text: t, evidence: rows, domain: 'fiqh', mode: 'chat' });
      const W6 = 'وفصل ابن قدامة الطيار ذلك' + REST6;
      ok('FOLLOWUP49-6 the production sentence: «وفصل ابن قدامة الطيار ذلك:» becomes «وفصل بعض أهل العلم ذلك:», the rest byte for byte',
        say6(W6).text === 'وفصل بعض أهل العلم ذلك' + REST6, say6(W6).text);
      ok('FOLLOWUP49-6 it is recorded as an unsupported credit, with the merged name', say6(W6).annotations.some((a) => a.action === 'removed-unsupported-attribution' && a.mergedBookName === true && /ابن قدامه الطيار/u.test(String(a.claimedAuthority).replace(/ة/gu, 'ه'))), JSON.stringify(say6(W6).annotations));
      const SIB6 = [
        ['«قال»', 'وقال ابن قدامة الطيار' + REST6, 'وقال بعض أهل العلم' + REST6],
        ['«ذكر»', 'وذكر ابن قدامة الطيار' + REST6, 'وذكر بعض أهل العلم' + REST6],
        ['a verb outside every credit frame («بين … ذلك»)', 'وبين ابن قدامة الطيار ذلك' + REST6, 'وبين بعض أهل العلم ذلك' + REST6],
        ['the author\'s full name after the man the title names', 'وفصل ابن قدامة عبد الله الطيار ذلك' + REST6, 'وفصل بعض أهل العلم ذلك' + REST6],
        ['a comma straight after the name', 'وابن قدامة الطيار، كما سبق' + REST6, 'وبعض أهل العلم، كما سبق' + REST6],
        ['a conjunction in front of the name stays', 'ثم ابن قدامة الطيار ذلك' + REST6, 'ثم بعض أهل العلم ذلك' + REST6],
      ];
      SIB6.forEach(([id, input, expected]) => ok('FOLLOWUP49-6 sibling · ' + id, say6(input).text === expected, say6(input).text));
      const owner6 = (name, rows) => say6('وقال ' + name + REST6, rows).text;
      ok('FOLLOWUP49-6 «للإمام X»: the man the title names and the commentator who wrote the book are not one man',
        owner6('النووي السبكي', [row6({ title: 'تكملة المجموع للإمام النووي', bookTitle: 'تكملة المجموع للإمام النووي', author: 'تقي الدين السبكي', scholar: 'تقي الدين السبكي' })]) === 'وقال بعض أهل العلم' + REST6);
      // what is NOT a merged name
      ok('FOLLOWUP49-6 control · the author alone is a name that is kept (his own page carries it)', owner6('عبد الله الطيار') === 'وقال عبد الله الطيار' + REST6, owner6('عبد الله الطيار'));
      ok('FOLLOWUP49-6 control · the author who IS the man the title names («المغني لابن قدامة» — ابن قدامة المقدسي) is kept',
        owner6('ابن قدامة المقدسي', [row6({ title: 'المغني لابن قدامة', bookTitle: 'المغني لابن قدامة', author: 'ابن قدامة المقدسي', scholar: 'ابن قدامة المقدسي' })]) === 'وقال ابن قدامة المقدسي' + REST6,
        owner6('ابن قدامة المقدسي', [row6({ title: 'المغني لابن قدامة', bookTitle: 'المغني لابن قدامة', author: 'ابن قدامة المقدسي', scholar: 'ابن قدامة المقدسي' })]));
      ok('FOLLOWUP49-6 control · a turn with no library book row leaves the sentence exactly as the reviewer left it before', say6(W6, []).text === W6, say6(W6, []).text);
      ok('FOLLOWUP49-6 control · the same words in another order are no merged name', say6('وفصل الطيار ابن قدامة ذلك' + REST6).text === 'وفصل الطيار ابن قدامة ذلك' + REST6, say6('وفصل الطيار ابن قدامة ذلك' + REST6).text);
      ok('FOLLOWUP49-6 a row that is not a library book never makes a merged name', say6(W6, [row6({ kind: '' })]).annotations.every((a) => a.mergedBookName !== true));
      const streamed6 = (t) => { const st = module.createReviewStream({ domain: 'fiqh', evidence: [row6()] }); st.push(t); const r = st.end(); return typeof r === 'string' ? r : r.text; };
      ok('FOLLOWUP49-6 the streamed path generalises it the same way', streamed6(W6) === say6(W6).text, streamed6(W6));
      const mk6 = async (name, from, to, survives) => {
        const m = await runMutant({ sourceFile: REVIEWER, name, transform: (source) => source.replace(from, to), survives });
        ok('FOLLOWUP49-6 mutant seam applied: ' + name, m.changed, m.error);
        ok('FOLLOWUP49-6 MUTANT KILLED: ' + name, m.loaded && m.survived === false, JSON.stringify(m));
      };
      const gen6 = (mod, t) => mod.reviewAnswer({ text: t, evidence: [row6()], domain: 'fiqh', mode: 'chat' }).text;
      await mk6('the merged name is not generalised (the step is out)', '        const mergedName = generaliseMergedBookName(part, sources);\n        if (mergedName) {', '        const mergedName = null;\n        if (mergedName) {',
        (mod) => gen6(mod, W6) === 'وفصل بعض أهل العلم ذلك' + REST6);
      await mk6('the author who is the man the title names is generalised too', "      if (containsWholeWords(author, owner.join(' '))) continue; // the author IS the man the title names\n", '',
        (mod) => mod.reviewAnswer({ text: 'وقال ابن قدامة المقدسي' + REST6, evidence: [row6({ title: 'المغني لابن قدامة', bookTitle: 'المغني لابن قدامة', author: 'ابن قدامة المقدسي', scholar: 'ابن قدامة المقدسي' })], domain: 'fiqh', mode: 'chat' }).text === 'وقال ابن قدامة المقدسي' + REST6);
      await mk6('only the whole author name merges (the end of it does not)', 'for (let k = 1; k <= authorWords.length; k += 1) runs.push(', 'for (let k = authorWords.length; k <= authorWords.length; k += 1) runs.push(',
        (mod) => gen6(mod, W6) === 'وفصل بعض أهل العلم ذلك' + REST6);
      await mk6('the streamed path does not generalise it', '      const mergedName = generaliseMergedBookName(part, sources);\n      if (mergedName) {\n        mark();', '      const mergedName = null;\n      if (mergedName) {\n        mark();',
        (mod) => { const st = mod.createReviewStream({ domain: 'fiqh', evidence: [row6()] }); st.push(W6); const r = st.end(); return (typeof r === 'string' ? r : r.text) === 'وفصل بعض أهل العلم ذلك' + REST6; });
    }
    // ── FOLLOWUP 49 item 9 · AN ATOM INSIDE A QUOTATION IS NO LICENCE OF THE BOOK'S AUTHOR (the owner's decision 1) ────────────────────────────────────────────────────────────────
    // MEASURED (the 48 report, item 10): in a collection of fatwas the author quotes another man at length, and an atom in the MIDDLE of the quotation read as «ابن باز يرى …» credited him with the quoted
    // man's words. The row now carries `innerQuote` (the atoms found by tools/inner-quote-atoms.mjs, lib/data/inner-quote-atoms.js); the reviewer gives neither licence of the book's author to such a row.
    // The licence of a fatwa from the man's own site, and the licence of an atom that is not inside a quotation, are untouched.
    {
      const SNIP9 = 'يجب إعفاء اللحية وتوفيرها ولا يجوز حلقها ولا تقصيرها ولا الأخذ منها.';
      const row9 = (over = {}) => ({ id: 'lib:FC-004528:4349:046', title: 'مجموع فتاوى ابن باز · ج1 · ص350', url: '', scholar: 'ابن باز', snippet: SNIP9, date: '', kind: 'lib_book', bookTitle: 'مجموع فتاوى ابن باز', author: 'ابن باز', ...over });
      const CL9 = 'وقال ابن باز: يجب إعفاء اللحية وتوفيرها ولا يجوز حلقها ولا تقصيرها.';
      const CB9 = 'قال ابن قدامة في المغني: يجب إعفاء اللحية وتوفيرها ولا يجوز حلقها ولا تقصيرها.'; // the man's short name and his book: only the licence that names the book reaches it
      const rowB9 = (over = {}) => row9({ id: 'lib:FC-003727:0275:001', title: 'المغني لابن قدامة · ج1 · ص345', bookTitle: 'المغني', author: 'ابن قدامة المقدسي', scholar: 'ابن قدامة المقدسي', ...over });
      const rev9 = (mod, text, row) => mod.reviewAnswer({ text, evidence: [row], domain: 'fiqh', mode: 'chat' }).text;
      ok('FOLLOWUP49-9 the author\'s licence is given to an atom that is not inside a quotation (the name stays)', rev9(module, CL9, row9({ innerQuote: false })) === CL9, rev9(module, CL9, row9({ innerQuote: false })));
      ok('FOLLOWUP49-9 ...and withheld from an atom inside a quotation: the name is generalised, the rest byte for byte', rev9(module, CL9, row9({ innerQuote: true })) === 'وقال بعض أهل العلم: يجب إعفاء اللحية وتوفيرها ولا يجوز حلقها ولا تقصيرها.', rev9(module, CL9, row9({ innerQuote: true })));
      ok('FOLLOWUP49-9 the licence of a credit that names the book as well as the man is withheld in the same way (and given to the atom that is not inside)',
        rev9(module, CB9, rowB9({ innerQuote: false })) === CB9 && /^وقال بعض أهل العلم: يجب/u.test(rev9(module, CB9, rowB9({ innerQuote: true }))), rev9(module, CB9, rowB9({ innerQuote: true })));
      ok('FOLLOWUP49-9 the licence of a fatwa from the man\'s own site is not the book\'s: the flag changes nothing for it',
        rev9(module, CL9, { id: 'binbaz:1', title: 'حكم اللحية', url: 'https://binbaz.org.sa/fatwas/1', scholar: 'ابن باز', snippet: SNIP9, date: '', kind: '', innerQuote: true }) === CL9);
      ok('FOLLOWUP49-9 a row with no flag at all (every row before this order) is treated as before', rev9(module, CL9, row9()) === CL9);
      const mk9 = async (name, from, to, expected, row) => {
        const m = await runMutant({ sourceFile: REVIEWER, name, transform: (source) => source.replace(from, to),
          survives: (mod) => rev9(mod, expected.text, row) === expected.out });
        ok('FOLLOWUP49-9 mutant seam applied: ' + name, m.changed, m.error);
        ok('FOLLOWUP49-9 MUTANT KILLED: ' + name, m.loaded && m.survived === false, JSON.stringify(m));
      };
      const GEN9 = 'وقال بعض أهل العلم: يجب إعفاء اللحية وتوفيرها ولا يجوز حلقها ولا تقصيرها.';
      await mk9('the block of the first licence is lifted (the author\'s licence is given to the inner atom again)', "    if (item.innerQuote) return false; // FOLLOWUP 49 item 9: an atom inside a quotation holds another man's words\n", '',
        { text: CL9, out: GEN9 }, row9({ innerQuote: true }));
      await mk9('the block of the second licence is lifted', '    if (item.innerQuote) return false; // FOLLOWUP 49 item 9\n', '',
        { text: CB9, out: 'وقال بعض أهل العلم: يجب إعفاء اللحية وتوفيرها ولا يجوز حلقها ولا تقصيرها.' }, rowB9({ innerQuote: true }));
      await mk9('the reviewer ignores the flag (the licence is given to every atom)', '    innerQuote: Boolean(item && item.innerQuote === true),\n', '    innerQuote: false,\n',
        { text: CL9, out: GEN9 }, row9({ innerQuote: true }));
    }
    // ── ORDER 50 item 1 · THE GENERALISED SPEAKER DOES NOT REPEAT THE SENTENCE'S OWN WAW (the owner's decision 8) ────────────────────────────────────────────────────────────────
    // MEASURED (the 49 report, «رُئيَ في الطريق» 1): «وقال ابن باز في مجموع فتاوى ابن باز: …» for a credit nothing supports came out «و وقال بعض أهل العلم في مجموع…» — the detector stops the frame
    // after the lone conjunction and the formula brought its own. The waw is written once, and a «ف» is kept as a «ف».
    {
      const REST1 = ' في مجموع فتاوى ابن باز: يجب إعفاء اللحية.';
      const rev1 = (mod, text, streamed) => {
        if (!streamed) return mod.reviewAnswer({ text, evidence: [], domain: 'fiqh', mode: 'chat' }).text;
        const st = mod.createReviewStream({ domain: 'fiqh', evidence: [] }); st.push(text); const r = st.end(); return typeof r === 'string' ? r : r.text;
      };
      const want1 = (lead) => lead + ' بعض أهل العلم' + REST1;
      ok('ORDER50-1 «وقال ابن باز في مجموع …» → «وقال بعض أهل العلم في مجموع …» (one waw), whole sentence byte for byte',
        rev1(module, 'وقال ابن باز' + REST1) === want1('وقال'), rev1(module, 'وقال ابن باز' + REST1));
      ok('ORDER50-1 the same sentence after an earlier sentence', rev1(module, 'مقدمة. وقال ابن باز' + REST1) === 'مقدمة.\n' + want1('وقال'), rev1(module, 'مقدمة. وقال ابن باز' + REST1));
      ok('ORDER50-1 sibling «فقال» keeps its «ف» (not turned into «و», not doubled)', rev1(module, 'فقال ابن باز' + REST1) === want1('فقال'), rev1(module, 'فقال ابن باز' + REST1));
      ok('ORDER50-1 sibling with no waw («قال ابن باز في مجموع …») still takes «وقال»', rev1(module, 'قال ابن باز' + REST1) === want1('وقال'), rev1(module, 'قال ابن باز' + REST1));
      ok('ORDER50-1 sibling «وقال ابن باز: …» (no book) is as before', rev1(module, 'وقال ابن باز: يجب إعفاء اللحية.') === 'وقال بعض أهل العلم: يجب إعفاء اللحية.', rev1(module, 'وقال ابن باز: يجب إعفاء اللحية.'));
      ok('ORDER50-1 sibling «وذكر ابن باز … أن …» is as before (a frame outside the five is not touched)', rev1(module, 'وذكر ابن باز في مجموع فتاوى ابن باز أن اللحية تعفى.') === 'وذكر ابن باز في مجموع فتاوى ابن باز أن اللحية تعفى.');
      ok('ORDER50-1 the streamed path writes it the same way', rev1(module, 'وقال ابن باز' + REST1, true) === rev1(module, 'وقال ابن باز' + REST1), rev1(module, 'وقال ابن باز' + REST1, true));
      ok('ORDER50-1 no output of any of these holds «و وقال»', !/(?:^|\s)و\s+وقال/u.test(rev1(module, 'وقال ابن باز' + REST1)));
      const m1 = await runMutant({ sourceFile: REVIEWER, name: 'the formula brings its own waw again',
        transform: (source) => source.replace("if (head && /(?:^|\\s)[وف]$/u.test(head) && /^و/u.test(line)) return head + line.slice(1);\n", ''),
        survives: (mod) => rev1(mod, 'وقال ابن باز' + REST1) === want1('وقال') });
      ok('ORDER50-1 mutant seam applied', m1.changed, m1.error);
      ok('ORDER50-1 MUTANT KILLED: the formula brings its own waw again', m1.loaded && m1.survived === false, JSON.stringify(m1));
    }
  } catch (error) {
    ok('guard completed without exception', false, error?.stack || String(error));
  }
  process.exit(finish());
})();
