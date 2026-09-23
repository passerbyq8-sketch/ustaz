// guards/tag-honesty-guard.cjs — understanding is visibly tagged; sourced text is not falsely tagged.
'use strict';

const path = require('path');
const { fresh, runMutant, harness } = require('./output-reviewer-mutant-lib.cjs');
// [111-close-6b] — the implied speaker's wider rule («a man named in this very sentence keeps his own verb») answers
// several older rows too; a mutant that removes one of those older rules removes this line with it, or it is masked.
const CLOSE6B_LINE = "      if (here.length && !/[.؟!«»:\"]/u.test(gap)) return null;\n";
const noClose6b = (source) => source.split(CLOSE6B_LINE).join('');
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
      // [111-b4b-14] — and «كما قال X:» is «كما يرى بعض أهل العلم:», the owner's formula after «كما».
      const expected = (witness.head + ' كما يرى بعض أهل العلم:' + witness.claim).replace(/\s+/gu, ' ').trim();
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
        // [111-b4b-14]: the owner's one formula, and «يرى» takes «أنّ» where «قال» took «إنّ».
        claim: 'ومن أهل العلم من يرى أن الجمع للمسافر جائز عند الحاجة.',
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
        // [111-b4b-14]: the owner's formula, and the prayer behind it — never after the colon (item 14's witness).
        claim: 'ومن أهل العلم من يرى رحمه الله: الجمع للمسافر جائز عند الحاجة.',
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
          && outputLines.length === (expectedKhilafTrigger && module.presentsTwoViews(expected) ? 2 : 1), out.text); // [111-close-14]
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
      ok('a removed name leaves its honorific prayer whole behind the general speaker [h46]',
        !out.text.includes('ابن باز') && out.text === 'ومن أهل العلم من يرى رحمه الله أن الجمع للمسافر جائز عند الحاجة.' /* [111-b4b-14] */
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
      { id: 'waqad-zakara-anna-book',
        text: 'وقد ذكر ابن قدامة في المغني أن المسح على الخفين جائز.',
        delivered: 'ومن أهل العلم من يرى أن المسح على الخفين جائز.' }, // [111-b4b-14] «ذكر» takes the formula; the particle still goes
      { id: 'waqad-zakara-anna-mid',
        text: 'المسألة فيها سعة، وقد ذكر ابن قدامة أن المسح على الخفين جائز.',
        delivered: 'المسألة فيها سعة، ومن أهل العلم من يرى أن المسح على الخفين جائز.' }, // [111-b4b-14]
      { id: 'waqad-qala-inna-summary',
        text: 'خلاصة الجواب أن المسح جائز، وقد قال ابن قدامة إن مدته يوم وليلة.',
        // THIRD ORDER, STEP 6: was «…جائز، مدته…»; «وقد قال X إن» now reads «وقال بعض أهل العلم:».
        // FIFTH ORDER [r44] (1): «إن» after the name is the claim's, and stays.
        delivered: 'خلاصة الجواب أن المسح جائز، ومن أهل العلم من يرى أن مدته يوم وليلة.' }, // [111-b4b-14]
      { id: 'faqad-zakara-anna',
        text: 'الأمر واسع، فقد ذكر ابن قدامة أن المسح على الخفين جائز.',
        delivered: 'الأمر واسع، ومن أهل العلم من يرى أن المسح على الخفين جائز.' }, // [111-b4b-14]
      { id: 'qad-zakara-anna-head',
        text: 'قد ذكر ابن قدامة أن المسح على الخفين جائز.',
        delivered: 'ومن أهل العلم من يرى أن المسح على الخفين جائز.' }, // [111-b4b-14] «ذكر» takes the formula; the particle still goes
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
          'وحكم عليه ابن الجوزي بالوضع، ومن أهل العلم من يرى: باطل لا أصل له.'],
        ['F20 يرى', 'وشيخ الإسلام ابن تيمية يرى أن وجه المرأة ويديها كبدن الرجل في الإحرام.',
          'ومن أهل العلم من يرى أن وجه المرأة ويديها كبدن الرجل في الإحرام.'],
        ['F20 صحابي', 'ولا فدية على الحائض، فقد قال ابن عباس رضي الله عنهما: «أمر الناس أن يكون آخر عهدهم بالبيت، إلا أنه خفف عن الحائض».',
          'ولا فدية على الحائض، وجاء في الأثر: «أمر الناس أن يكون آخر عهدهم بالبيت، إلا أنه خفف عن الحائض».'],
        // [h46]: was '…، كما قال بعض أهل العلم: «…».' — the prayer stays whole behind the general speaker.
        ['F17 كما قال', 'ويجوز لها ذلك من غير حرج، كما قال الكاساني رحمه الله: «يجب على الحائض قضاء الصوم».',
          'ويجوز لها ذلك من غير حرج، كما يرى بعض أهل العلم رحمه الله: «يجب على الحائض قضاء الصوم».'],
        // FIFTH ORDER [r44] (1)(6): what followed the name follows the general speaker byte for byte;
        // the reviewer no longer adds an «إلى» the model did not write.
        ['ذهب', 'والوضوء من لحم الإبل واجب، وذهب الإمام أحمد وجوب الوضوء منه على كل حال.',
          'والوضوء من لحم الإبل واجب، ومن أهل العلم من يرى وجوب الوضوء منه على كل حال.'],
        ['قال بـ', 'قال ابن باز بجواز الجمع للمسافر.', 'ومن أهل العلم من يرى جواز الجمع للمسافر.'],
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
        // [111-b4b-14] — «ذكر» is inside the owner's formula now; «وفقًا لـ» is still outside it.
        const out = say6('الأمر واسع، ووفقا لابن قدامة، المسح على الخفين جائز.');
        ok('111-T6 a frame outside the formula («وفقًا لـ») is handled exactly as before',
          out.text === 'الأمر واسع، المسح على الخفين جائز.', out.text);
      }
      const gen6 = await runMutant({
        sourceFile: REVIEWER,
        name: 'erase-the-speaker-again',
        transform: (source) => source.replace(
          '  const speaker = generalSpeakerFor(sentence, attribution);',
          '  const speaker = null; // mutant'),
        survives: (mod) => mod.reviewAnswer({ text: 'وحكم عليه ابن الجوزي بالوضع، وقال ابن حبان: باطل لا أصل له.', evidence: [], domain: 'fiqh', mode: 'عادي' })
          .text.includes('ومن أهل العلم من يرى'), // [111-b4b-14]
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
          out.replace(/\s+/gu, ' ') === input.replace(/\s+/gu, ' ') &&!/وجاء في الأثر|بعض أهل العلم|من أهل العلم من يرى/u.test(out), out);
      }
      for (const [id, input, expected] of [["ctl-aisha","وقالت عائشة رضي الله عنها: «كنا نؤمر بقضاء الصوم ولا نؤمر بقضاء الصلاة».","وجاء في الأثر: «كنا نؤمر بقضاء الصوم ولا نؤمر بقضاء الصلاة»."],["ctl-ibnumar","وقال ابن عمر رضي الله عنهما: «إذا أمسيت فلا تنتظر الصباح».","وجاء في الأثر: «إذا أمسيت فلا تنتظر الصباح»."],["ctl-ibntaymiyya","وقال ابن تيمية: «الواجب على المسلم أن يتحرى الحق».","ومن أهل العلم من يرى: «الواجب على المسلم أن يتحرى الحق»."],["ctl-ibnbaz","وسُئل ابن باز عن ذلك فقال: «لا حرج في ذلك إن شاء الله».","وسُئل بعض أهل العلم عن ذلك فقال: «لا حرج في ذلك إن شاء الله»."]]) {
        // FIFTH ORDER [r44] (1): ctl-ibnbaz was «وقال بعض أهل العلم: «…»» — «سُئل … عن ذلك ف» eaten with
        // the name. The name alone is replaced now; the other three are byte for byte what they were.
        ok('r36 control ' + id + ': generalised exactly as before', say36(input) === expected, say36(input));
      }
      ok('r36 the prayer on the person ADDRESSED is not the speaker\'s: al-Shafi\'i is a scholar',
        // FIFTH ORDER [r44] (3): was 'وقال بعض أهل العلم: «هذا حسن».' — «لأبي هريرة رضي الله عنه» eaten.
        // The name alone is replaced; the person addressed and his prayer stay, and he is still a scholar.
        say36("وقال الشافعي لأبي هريرة رضي الله عنه: «هذا حسن».") === 'ومن أهل العلم من يرى لأبي هريرة رضي الله عنه: «هذا حسن».' /* [111-b4b-14] */, say36("وقال الشافعي لأبي هريرة رضي الله عنه: «هذا حسن»."));
      const noSpeaker = await runMutant({
        sourceFile: REVIEWER,
        name: 'a-frame-naming-nobody-is-a-credit-again',
        transform: (source) => source.replace(
          '    if (frameNamesNoSpeaker(claimed)) continue; // [r36] — the frame names nobody; see above\n', ''),
        // [h46] — on T6 itself the mutant's rewrite would also drop «رضي الله عنها», which [h46] refuses on
        // its own; so T6 is asked together with its prayer-free twin, where only [r36] stands.
        survives: (mod) => ["وقال لعائشةَ رضي الله عنها لمّا حاضت: «افعلي ما يفعل الحاجّ، غير ألا تطوفي بالبيت».", "وقال لعائشةَ لمّا حاضت: «افعلي ما يفعل الحاجّ، غير ألا تطوفي بالبيت»."]
          .every((text) => !/وجاء في الأثر|بعض أهل العلم|من أهل العلم من يرى/u.test(mod.reviewAnswer({ text, evidence: [], domain: 'fiqh', mode: 'chat' }).text)),
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
          'ومن أهل العلم من يرى بعد ذكر حديث أنس رضي الله عنه: «من صلى البردين دخل الجنة».'],
        ['shape-2 عن', 'وقال ابن تيمية عن ابن عباس رضي الله عنهما: «كان فقيها في الدين».',
          'ومن أهل العلم من يرى عن ابن عباس رضي الله عنهما: «كان فقيها في الدين».'],
        ['shape-2 في', 'وقال ابن القيم في حديث أبي هريرة رضي الله عنه: «فيه دليل على جواز ذلك».',
          'ومن أهل العلم من يرى في حديث أبي هريرة رضي الله عنه: «فيه دليل على جواز ذلك».'],
        ['shape-2 عن حديث', 'وقال ابن عثيمين عن حديث عائشة رضي الله عنها: «هذا يدل على الاستحباب».',
          'ومن أهل العلم من يرى عن حديث عائشة رضي الله عنها: «هذا يدل على الاستحباب».'],
        // siblings written for this order
        ['sib ذهب إلى أنّه', 'وذهب ابن حزم إلى أنّه يجب الوتر على كل مسلم.', 'ومن أهل العلم من يرى أنّه يجب الوتر على كل مسلم.'],
        // [h46]: was 'وقال بعض أهل العلم بعد أن ذكر الخلاف: «…».' — the title goes with the name, the prayer stays.
        ['sib لقب ودعاء ثم ظرف', 'وقال الشيخ ابن عثيمين رحمه الله بعد أن ذكر الخلاف: «والأقرب أن الأمر واسع».',
          'ومن أهل العلم من يرى رحمه الله بعد أن ذكر الخلاف: «والأقرب أن الأمر واسع».'],
        ['sib ثم قال: عالم متعيّن', 'وذكر ابن القيم أنّ الأمرَ فيه سعة، ثم قال: «والصواب أن يفعل ما هو أيسر».',
          'ومن أهل العلم من يرى أنّ الأمرَ فيه سعة، ثم قال: «والصواب أن يفعل ما هو أيسر».'],
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
          out.replace(/\s+/gu, ' ') === input.replace(/\s+/gu, ' ') && !/وجاء في الأثر|بعض أهل العلم|من أهل العلم من يرى/u.test(out), out);
      }
      const killed44 = async (name, from, to, survives) => {
        const m = await runMutant({ sourceFile: REVIEWER, name, transform: (source) => noClose6b(source).replace(from, to), survives });
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
          .every((text) => !/بعض أهل العلم|من أهل العلم من يرى|في الأثر/u.test(mod.reviewAnswer({ text, evidence: [], domain: 'fiqh', mode: 'chat' }).text)));
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
          'ومن أهل العلم من يرى رحمه الله: منزلة التوبة أول المنازل وأوسطها وآخرها.'],
        ['وقال الشيخ ابن باز رحمه الله تعالى:', 'وقال الشيخ ابن باز رحمه الله تعالى: صلاة الجماعة في المسجد واجبة على الرجال القادرين.',
          'ومن أهل العلم من يرى رحمه الله تعالى: صلاة الجماعة في المسجد واجبة على الرجال القادرين.'],
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
        transform: (source) => noClose6b(source).replace(
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
      const ROWS53 = [["W53-abu-talib-log","كان النبي ﷺ في صغره مع عمه في تجارة الشام.\nثمّ انصرف بحيرى فصنع لهم طعامًا، فلمّا ذهب أبو طالبٍ ليأخذَه معه استخبرَه بحيرى عمّا هو له، فأخبره أنّه ابنُ أخيه، فقال له: ما ينبغي لهذا الغلامِ أن يذهبَ إلى الشام، فإنّ اليهودَ إن رأَوه وعرفوا منه م",null],["W53-bath-abu-ubayda-log","وشهد له النبي صلى الله عليه وسلم بالجنة ضمن العشرة المبشرين، وائتمنه على أموال الأمة وأسرارها، حتى إن وفداً جاء يطلب من النبي صلى الله عليه وسلم أن يبعث معهم أميناً، فبعث إليهم أبا عبيدة وقال: «هذا أمين هذه الأمة».",null],["W53-tamanna-umar-log","وكان أبو عبيدة محبوبا عند الصحابة.\nبل تمنى عمر ذات مرة وهو بين جلسائه فقال: «لكني أتمنى بيتاً ممتلئاً رجالاً مثل أبي عبيدة بن الجراح».",null],["O53-arsala-muadh","والدعوة إلى التوحيد أول الواجبات.\nثم أرسل النبي ﷺ معاذا إلى اليمن وقال: «إنك تأتي قوما من أهل الكتاب».",null],["O53-jaa-abubakr","وكان الصديق أسبق الناس إلى الخير.\nفجاء أبو بكر رضي الله عنه فقال: «يا رسول الله، هذا مالي كله».","وكان الصديق أسبق الناس إلى الخير.\nوجاء في الأثر: «يا رسول الله، هذا مالي كله»."],["O53-dhahaba-ibnumar-souq","وكان ابن عمر شديد الاتباع.\nوذهب ابن عمر إلى السوق فاشترى طعاما لأهله.",null],["O53-dhahaba-ahmad-wujub","واختلف العلماء في الوضوء من لحم الإبل.\nوذهب الإمام أحمد إلى وجوب الوضوء من لحم الإبل.","واختلف العلماء في الوضوء من لحم الإبل.\nومن أهل العلم من يرى وجوب الوضوء من لحم الإبل.\nوتُراجَع المسألة مع أهل العلم لظهور الخلاف فيها."],["O53-qala-ibnbaz","وصلاة الجماعة واجبة.\nوقال ابن باز رحمه الله: صلاة الجماعة في المسجد واجبة على الرجال القادرين.","وصلاة الجماعة واجبة.\nومن أهل العلم من يرى رحمه الله: صلاة الجماعة في المسجد واجبة على الرجال القادرين."],["S53-jaa-umar-bare","وكان عمر وقافا عند كتاب الله.\nفجاء عمر فقال: «يا رسول الله، ألسنا على الحق؟».",null],["S53-kharaja-ibnmasud","وكان ابن مسعود من فقهاء الصحابة.\nوخرج ابن مسعود إلى الناس فقال: «اتبعوا ولا تبتدعوا».",null],["S53-raa-ibnumar","والسنة في الصلاة الطمأنينة.\nورأى ابن عمر رجلا يصلي فقال له: «ارجع فصل».",null],["S53-saala-abuhurayra","وكان أبو هريرة حريصا على العلم.\nوسأل أبو هريرة النبي ﷺ فقال: «من أسعد الناس بشفاعتك؟».",null],["S53-baatha-umar-abumusa","وكان عمر يولي الأكفاء.\nوبعث عمر أبا موسى إلى البصرة وقال: «علمهم السنة».",null],["S53-ata-rajul-ibnabbas","وكان ابن عباس ترجمان القرآن.\nوأتى ابن عباس رجل فسأله عن ذلك فقال: «لا بأس».",null],["S53-dhahaba-malik-madina","وكان مالك محدثا.\nوذهب مالك إلى المدينة فلقي شيوخها.",null],["S53-dhahaba-shafii-anna","واختلفوا في مس الذكر.\nوذهب الشافعي إلى أن مس الذكر ينقض الوضوء.",null],["S53-dhahaba-ibnqudama-qawl","واختلفوا في المسألة.\nوذهب ابن قدامة إلى القول بالاستحباب.","واختلفوا في المسألة.\nومن أهل العلم من يرى القول بالاستحباب."],["S53-suila-ibnbaz","والمسألة فيها سعة.\nوسُئل ابن باز عن ذلك فقال: «لا حرج في ذلك إن شاء الله».","والمسألة فيها سعة.\nوسُئل بعض أهل العلم عن ذلك فقال: «لا حرج في ذلك إن شاء الله»."],["S53-yara-ibnuthaymin","والجمع للمسافر جائز.\nويرى ابن عثيمين أن الجمع للمسافر جائز عند الحاجة.","والجمع للمسافر جائز.\nومن أهل العلم من يرى أن الجمع للمسافر جائز عند الحاجة."],["S53-dhakara-nawawi","والسواك سنة.\nوذكر النووي أن السواك مستحب في كل وقت.","والسواك سنة.\nومن أهل العلم من يرى أن السواك مستحب في كل وقت."],["S53-ibntaymiyya-namefirst","والتوبة واجبة.\nوابن تيمية قال: «التوبة واجبة من كل ذنب».","والتوبة واجبة.\nومن أهل العلم من يرى: «التوبة واجبة من كل ذنب»."],["C53-qala-umar-bare","والتراويح سنة.\nوقال عمر: «نعمت البدعة هذه».","والتراويح سنة.\nوجاء في الأثر: «نعمت البدعة هذه»."],["C53-qalat-aisha-bare","وقضاء الحائض الصوم واجب.\nوقالت عائشة: «كنا نؤمر بقضاء الصوم ولا نؤمر بقضاء الصلاة».","وقضاء الحائض الصوم واجب.\nوجاء في الأثر: «كنا نؤمر بقضاء الصوم ولا نؤمر بقضاء الصلاة»."],["C53-qala-ibnabbas-bare","والكفر دركات.\nوقال ابن عباس: «هو كفر دون كفر».","والكفر دركات.\nوجاء في الأثر: «هو كفر دون كفر»."],["C53-qala-umar-abdalaziz","والعدل أساس الملك.\nوقال عمر بن عبد العزيز: «إن الله لا يؤاخذ العامة بعمل الخاصة».","والعدل أساس الملك.\nومن أهل العلم من يرى: «إن الله لا يؤاخذ العامة بعمل الخاصة»."],["C53-qala-ali-qari","والشرح مفيد.\nوقال علي القاري: «هذا حديث حسن المعنى».","والشرح مفيد.\nومن أهل العلم من يرى: «هذا حديث حسن المعنى»."],["C53-qala-malik-ibn-anas","والسنة سفينة نوح.\nوقال مالك بن أنس: «السنة سفينة نوح من ركبها نجا».","والسنة سفينة نوح.\nومن أهل العلم من يرى: «السنة سفينة نوح من ركبها نجا»."]];
      for (const [id, input, expected] of ROWS53) {
        const out = say53(input);
        ok('h53 ' + id + (expected === null ? ': exactly as the model wrote it' : ': as before h53, or «وجاء في الأثر:» for a Companion'),
          out === (expected === null ? input : expected), out);
      }
      const W53 = (id) => ROWS53.find((row) => row[0] === id)[1];
      const killed53 = async (name, from, to, survives) => {
        const m = await runMutant({ sourceFile: REVIEWER, name, transform: (source) => noClose6b(source).replace(from, to), survives });
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
        (mod) => !/بعض أهل العلم|من أهل العلم من يرى/u.test(mod.reviewAnswer({ text: W53('C53-qala-umar-bare'), evidence: [], domain: 'fiqh', mode: 'chat' }).text));
    }
    // ── [111-b4b-66] · «أنه قال» NAMES ITS SPEAKER: THE PRONOUN ────────────────────────────────
    // MEASURED at eca359e (r44, alive in production): «ونقل الخطيب البغدادي عن يحيى بن معين أنه قال: إنه
    // كذب لا أصل له.» left as «…أنه قال بعض أهل العلم: …». The name after «عن» is no subject, and the verb
    // after «أنه» has its subject already: no category is stuffed into such a frame — it stays as written.
    // Every row below was «…أنه قال بعض أهل العلم:» at eca359e.
    {
      const say66 = (t) => module.reviewAnswer({ text: t, evidence: [], domain: 'fiqh', mode: 'chat' }).text;
      const ROWS66 = [
        ['W66-naqala-khatib-ibnmain', 'وفي الحديث كلام كثير.\nونقل الخطيب البغدادي عن يحيى بن معين أنه قال: إنه كذب لا أصل له.'],
        ['S66-haka-ibnabdalbarr-ahmad', 'وفي الباب أحاديث.\nوحكى ابن عبد البر عن الإمام أحمد أنه قال: لا يصح في هذا الباب شيء.'],
        ['S66-haka-tirmidhi-bukhari', 'وفي الحديث كلام.\nوحكى الترمذي عن البخاري أنه قال: هذا حديث منكر.'],
        ['S66-naqala-ibnkathir-ibnabbas', 'وفي الآية أقوال للمفسرين.\nونقل ابن كثير عن ابن عباس رضي الله عنهما أنه قال: هي منسوخة.'],
        ['S66-naqala-aisha-annaha-qalat', 'والمسألة قديمة.\nونقل ابن المنذر عن عائشة رضي الله عنها أنها قالت: لا بأس بذلك.'],
        ['S66-qawluhu-innahu-qala', 'وفي الحديث كلام.\nونقل ابن حجر عن الدارقطني قوله إنه قال: المحفوظ أنه مرسل.'],
      ];
      for (const [id, input] of ROWS66) {
        const out = say66(input);
        // (the answer-level khilaf tail may follow; the model's own lines are what is asserted)
        ok('b4b-66 ' + id + ': the frame whose subject is the pronoun stays exactly as the model wrote it',
          out.split('\n').slice(0, input.split('\n').length).join('\n') === input, out);
      }
      const R44 = 'وصلاة الجماعة واجبة.\nوتكلم ابن باز في المسألة ثم قال: صلاة الجماعة في المسجد واجبة.';
      ok('b4b-66 control · a name that IS the subject is still generalised, and the nameless «ثم قال:» after it is untouched',
        say66(R44) === 'وصلاة الجماعة واجبة.\nوتكلم بعض أهل العلم في المسألة ثم قال: صلاة الجماعة في المسجد واجبة.', say66(R44));
      const W66 = ROWS66[0][1];
      const m66 = await runMutant({ sourceFile: REVIEWER, name: 'without [b4b-66] «أنه قال» takes «بعض أهل العلم» again',
        transform: (source) => noClose6b(source).replace('    if (PRONOUN_SUBJECT_BEFORE_RE.test(view(text.slice(0, m.index)))) continue; // [111-b4b-66]\n', ''),
        survives: (mod) => !/أنه قال بعض أهل العلم/u.test(mod.reviewAnswer({ text: W66, evidence: [], domain: 'fiqh', mode: 'chat' }).text) });
      ok('b4b-66 mutant seam applied', m66.changed, m66.error);
      ok('MUTANT KILLED: without [b4b-66] «أنه قال» takes «بعض أهل العلم» again', m66.loaded && m66.survived === false, JSON.stringify(m66));
    }
    // ── [111-b4b-14] · THE OWNER'S ONE FORMULA: «ومن أهل العلم من يرى» ────────────────────────────
    // THE OWNER'S DECISION (batch-4 sheet, row 14): the general speaker is one formula whatever verb framed
    // the name — and «ذكر · قرر · تقول · يقول · أفتى · أجاب» are verbs it covers — a Companion stays «وجاء في
    // الأثر:», a nameless fatwa («كما جاء في فتوى…») takes it too, and no prayer ever follows the colon.
    // MEASURED at eca359e: «كما جاء في فتوى نصت على أن…» and «كما قرر ذلك ابن قدامة في المغني» passed with no
    // page; «ذكر/أجاب/تقول X أن…» lost the speaker and read as the answer's own voice; «وقال ابن باز: ورحمه
    // الله، …» left as «وقال بعض أهل العلم: ورحمه الله، …».
    {
      const say14 = (t) => module.reviewAnswer({ text: t, evidence: [], domain: 'fiqh', mode: 'chat' }).text;
      const ROWS14 = [
        ['W14-vague-fatwa', 'والوتر سنة.\nكما جاء في فتوى نصت على أن الوتر سنة مؤكدة.', 'والوتر سنة.\nكما يرى بعض أهل العلم أن الوتر سنة مؤكدة.'],
        ['W14-qarrara-dhalika-mughni', 'والماء طهور.\nكما قرر ذلك ابن قدامة في المغني.', 'والماء طهور.\nكما يرى بعض أهل العلم.'],
        ['W14-prayer-after-colon', 'والجمع جائز.\nوقال ابن باز: ورحمه الله، الجمع للمسافر جائز.', 'والجمع جائز.\nومن أهل العلم من يرى رحمه الله: الجمع للمسافر جائز.'],
        ['S14-dhakara', 'والسواك سنة.\nوذكر النووي أن السواك مستحب في كل وقت.', 'والسواك سنة.\nومن أهل العلم من يرى أن السواك مستحب في كل وقت.'],
        ['S14-afta-bi', 'والجمع جائز.\nوأفتى ابن باز بجواز الجمع للمسافر.', 'والجمع جائز.\nومن أهل العلم من يرى جواز الجمع للمسافر.'],
        ['S14-ajaba-bianna', 'والجمع جائز.\nوأجاب ابن عثيمين بأن الجمع جائز للحاجة.', 'والجمع جائز.\nومن أهل العلم من يرى أن الجمع جائز للحاجة.'],
        ['S14-qarrara-shaykh', 'والجمع جائز.\nوقرر شيخ الإسلام أن الجمع جائز للحاجة.', 'والجمع جائز.\nومن أهل العلم من يرى أن الجمع جائز للحاجة.'],
        ['S14-qala-prayer-before-colon', 'والجمع جائز.\nوقال ابن باز رحمه الله: الجمع للمسافر جائز.', 'والجمع جائز.\nومن أهل العلم من يرى رحمه الله: الجمع للمسافر جائز.'],
      ];
      for (const [id, input, expected] of ROWS14) {
        const out = say14(input);
        ok('b4b-14 ' + id + ': the owner\'s formula, the claim whole', out === expected, out);
      }
      ok('b4b-14 no prayer is ever left after the formula\'s colon',
        ROWS14.every(([, input]) => !/من يرى:\s*(?:[وف])?رحم/u.test(say14(input))));
      ok('b4b-14 control · a Companion who says stays «وجاء في الأثر:»',
        say14('والتراويح سنة.\nوقال عمر: «نعمت البدعة هذه».') === 'والتراويح سنة.\nوجاء في الأثر: «نعمت البدعة هذه».');
      ok('b4b-14 control · a speaker who names nobody is not touched',
        say14('ويرى بعض أهل العلم أنّه يجب قضاء الصوم على الفور.').split('\n')[0] === 'ويرى بعض أهل العلم أنّه يجب قضاء الصوم على الفور.');
      const m14a = await runMutant({ sourceFile: REVIEWER, name: 'without [b4b-14] the retired formula comes back',
        transform: (source) => source.replace("  return kama ? 'كما يرى بعض أهل العلم' : 'ومن أهل العلم من يرى';\n", "  return kama ? 'كما قال بعض أهل العلم:' : 'وقال بعض أهل العلم:';\n"),
        survives: (mod) => mod.reviewAnswer({ text: ROWS14[5][1], evidence: [], domain: 'fiqh', mode: 'chat' }).text === ROWS14[5][2] });
      ok('b4b-14 formula mutant seam applied', m14a.changed, m14a.error);
      ok('MUTANT KILLED: without [b4b-14] «وقال بعض أهل العلم:» comes back', m14a.loaded && m14a.survived === false, JSON.stringify(m14a));
      const m14b = await runMutant({ sourceFile: REVIEWER, name: 'without [b4b-14] the nameless fatwa passes again',
        transform: (source) => source.replace('  const vague = VAGUE_FATWA_RE.exec(sentence);\n', '  const vague = null;\n'),
        survives: (mod) => mod.reviewAnswer({ text: ROWS14[0][1], evidence: [], domain: 'fiqh', mode: 'chat' }).text === ROWS14[0][2] });
      ok('b4b-14 vague-fatwa mutant seam applied', m14b.changed, m14b.error);
      ok('MUTANT KILLED: without [b4b-14] «كما جاء في فتوى…» passes with no page again', m14b.loaded && m14b.survived === false, JSON.stringify(m14b));
    }
    // ── [111-roots-68/67] · WHERE THE OWNER'S FORMULA DOES NOT GO, AND THE FRAMES WHOSE NAME ALONE IS TAKEN ──
    // MEASURED on the preview of 20308f8 (roots rounds 1–3) and the b4b battery; every input below is a live sentence
    // (or its battery twin), and every expectation is what this reviewer now writes. Order row 68: no Companion named with
    // another, no narration, no speaker who names nobody, no non-speaker, no grader and no reporter of a consensus is
    // generalised; «سُئل… فقال» is not eaten; no name is maimed. Row 67: «وذكر X عن Y أنه قال:» keeps Y and his words.
    {
      const say68 = (t) => module.reviewAnswer({ text: t, evidence: [], domain: 'fiqh', mode: 'chat' }).text.split('\n')[0];
      const ROWS68 = [
        [
          "mangle-ibn-abd-al-barr",
          "ومن المالكيّة نقله الباجيّ في شرح الموطّأ، وابنُ عبد البرّ الذي قال: \"كلُّ زيادةٍ من عينٍ أو منفعةٍ يشترطها المُسلِف على المُستسلِف فهي ربا، لا خلاف في ذلك\".",
          "ومن المالكيّة نقله الباجيّ في شرح الموطّأ، وابنُ عبد البرّ الذي قال: \"كلُّ زيادةٍ من عينٍ أو منفعةٍ يشترطها المُسلِف على المُستسلِف فهي ربا، لا خلاف في ذلك\"."
        ],
        [
          "mangle-shaykh-barrak",
          "وسُئل الشيخ عبدالرحمن البراك عمّن يصوم يوم عرفة وهو واقفٌ بها فقال: هذا خلاف السنّة، والله أعلم بالقبول.",
          "وسُئل بعض أهل العلم عمّن يصوم يوم عرفة وهو واقفٌ بها فقال: هذا خلاف السنّة، والله أعلم بالقبول."
        ],
        [
          "mangle-amma-barrak",
          "وأمّا الشيخُ عبدُالرحمن البراك فقد أجابَ من سأله عن صيامِ يومِ عرفةَ وهو واقفٌ به بأنّ ذلك خلافُ السنّة.",
          "وأمّا بعض أهل العلم فقد أجابَ من سأله عن صيامِ يومِ عرفةَ وهو واقفٌ به بأنّ ذلك خلافُ السنّة."
        ],
        [
          "mangle-abd-barrak",
          "وقد سُئل عبدُالرحمن البراك رَحِمَهُ اللَّه عن صيامِ الواقفِ بعرفةَ فقال إنّه خلافُ السُّنَّة، وأنّ اللهَ أعلمُ بالقَبول.",
          "وقد سُئل بعض أهل العلم رَحِمَهُ اللَّه عن صيامِ الواقفِ بعرفةَ فقال إنّه خلافُ السُّنَّة، وأنّ اللهَ أعلمُ بالقَبول."
        ],
        [
          "glue-bukhari-tarikh",
          "والإمام البخاري نفسه، وهو أعلم أهل زمانه بعلل الحديث، قال في كتابه التاريخ الكبير: \"ولا يصح إلا عن علي بن حسين عن النبي صلى الله عليه وسلم\" — يعني أنّه أرسله.",
          "والإمام البخاري نفسه، وهو أعلم أهل زمانه بعلل الحديث، قال في كتابه التاريخ الكبير: \"ولا يصح إلا عن علي بن حسين عن النبي صلى الله عليه وسلم\" — يعني أنّه أرسله."
        ],
        [
          "named-before-ayni",
          "فمن الحنفيّة نقله الجصّاصُ والعينيّ، وقال العينيّ: \"أجمع المسلمون بالنقل عن النبيّ صَلَّى اللهُ عَلَيْهِ وَسَلَّم أنّ اشتراط الزيادة في السلف ربا حرام\".",
          "فمن الحنفيّة نقله الجصّاصُ والعينيّ، وقال العينيّ: \"أجمع المسلمون بالنقل عن النبيّ صَلَّى اللهُ عَلَيْهِ وَسَلَّم أنّ اشتراط الزيادة في السلف ربا حرام\"."
        ],
        [
          "implied-ibn-hajar",
          "- حسَّنها الحافظُ ابن حجر مرفوعةً، وقال: هو أقوى ما ورد في قراءة سورة الكهف.",
          "- حسَّنها الحافظُ ابن حجر مرفوعةً، وقال: هو أقوى ما ورد في قراءة سورة الكهف."
        ],
        [
          "hassanaha-ibn-hajar",
          "وفي المقابل صحَّح ابنُ الملقّنِ روايةَ الرفع، وحسَّنها الحافظُ ابنُ حجرٍ وقال: هو أقوى ما ورد في قراءة سورة الكهف.",
          "وفي المقابل صحَّح ابنُ الملقّنِ روايةَ الرفع، وحسَّنها الحافظُ ابنُ حجرٍ وقال: هو أقوى ما ورد في قراءة سورة الكهف."
        ],
        [
          "noname-liman-qala",
          "أنّ الوتر يجب في السفر كما يجب في الحضر، خلافًا لمن قال بأنّه سُنّة فإنّه يُسنّ في السفر كما يُسنّ في الحضر.",
          "أنّ الوتر يجب في السفر كما يجب في الحضر، خلافًا لمن قال بأنّه سُنّة فإنّه يُسنّ في السفر كما يُسنّ في الحضر."
        ],
        [
          "noname-jam",
          "فالمسألةُ إذن ليست محلَّ اتفاق، وممّن قال بالتحريمِ مطلقًا جمعٌ من أهلِ العلم، وممّن فصَّل بحسبِ نسبةِ المخالطةِ ووجودِ الرقابةِ الشرعيّةِ آخرون.",
          "فالمسألةُ إذن ليست محلَّ اتفاق، وممّن قال بالتحريمِ مطلقًا جمعٌ من أهلِ العلم، وممّن فصَّل بحسبِ نسبةِ المخالطةِ ووجودِ الرقابةِ الشرعيّةِ آخرون."
        ],
        [
          "companion-ibn-abbas-malik",
          "القولُ الأوّل: التحريم، وهو مذهبُ الحنابلةِ وقولُ جمهورِ أهلِ العلم، وممّن قال بمنعها ابنُ عبّاسٍ رضي الله عنهما وعمرُ بن عبدِ العزيز والإمامُ مالك.",
          "القولُ الأوّل: التحريم، وهو مذهبُ الحنابلةِ وقولُ جمهورِ أهلِ العلم، وممّن قال بمنعها ابنُ عبّاسٍ رضي الله عنهما وعمرُ بن عبدِ العزيز والإمامُ مالك."
        ],
        [
          "companion-ibn-abbas-ikrima",
          "وقال ابنُ عباس وعكرمة: الفطرُ مما دخل وليس مما خرج.",
          "وقال ابنُ عباس وعكرمة: الفطرُ مما دخل وليس مما خرج."
        ],
        [
          "story-umm-alqama",
          "ويُروى عن أمِّ علقمة قالت: كنّا نحتجمُ ونحن صيامٌ فلا يُنهى عنه.",
          "ويُروى عن أمِّ علقمة قالت: كنّا نحتجمُ ونحن صيامٌ فلا يُنهى عنه."
        ],
        [
          "suila-nawawi",
          "سُئل الإمامُ النوويُّ عنه في فتاويه فقال: إنه ليس بثابت.",
          "سُئل بعض أهل العلم عنه في فتاويه فقال: إنه ليس بثابت."
        ],
        [
          "frame-zarkashi",
          "فقد نصَّ ابنُ تيميةَ رحمه الله على أنها موضوعة، وقال النووي رحمه الله: إنها ليست بثابتة، وذكر الزركشي أن ابن السمعاني عدّها من كلام يحيى بن معاذ الرازي لا من كلام النبي صلى الله عليه وسلم.",
          "فقد نصَّ ابنُ تيميةَ رحمه الله على أنها موضوعة، وقال النووي رحمه الله: إنها ليست بثابتة، وذكر بعض أهل العلم أن ابن السمعاني عدّها من كلام يحيى بن معاذ الرازي لا من كلام النبي صلى الله عليه وسلم."
        ],
        [
          "frame-ibn-hajar-daraqutni",
          "وذكر ابن حجر عن الدارقطني أنه قال: هذا حديث باطل لا أصل له.",
          "وذكر بعض أهل العلم عن الدارقطني أنه قال: هذا حديث باطل لا أصل له."
        ],
        [
          "frame-dhahabi-abu-hatim",
          "وذكر الذهبي عن أبي حاتم أنه قال: هذا حديث منكر.",
          "وذكر بعض أهل العلم عن أبي حاتم أنه قال: هذا حديث منكر."
        ],
        [
          "frame-ibn-saad-umm-salama",
          "وذكر ابن سعد عن أم سلمة أنها قالت: كان رسول الله صلى الله عليه وسلم يصوم يوم السبت ويوم الأحد.",
          "وذكر بعض أهل العلم عن أم سلمة أنها قالت: كان رسول الله صلى الله عليه وسلم يصوم يوم السبت ويوم الأحد."
        ],
        [
          "ijma-ibn-taymiyya",
          "نعم، هذه المسألة قد نُقل فيها الإجماع، وذكر أهل العلم أمثلةً عليها؛ فقد ذكر شيخ الإسلام ابن تيمية وغيرُه من أهل العلم أن تحريم الخمر من المسائل المُجمَع عليها في الأمة.",
          "نعم، هذه المسألة قد نُقل فيها الإجماع، وذكر أهل العلم أمثلةً عليها؛ فقد ذكر شيخ الإسلام ابن تيمية وغيرُه من أهل العلم أن تحريم الخمر من المسائل المُجمَع عليها في الأمة."
        ],
        [
          "ijma-ibn-qudama",
          "وكذلك نُقل الإجماع على وجوب الجمعة، فقد قال ابن قدامة في المغني: «أجمع المسلمون على وجوب الجمعة»، وحكى ابن المنذر الإجماع على كونها فرض عين.",
          "وكذلك نُقل الإجماع على وجوب الجمعة، فقد قال ابن قدامة في المغني: «أجمع المسلمون على وجوب الجمعة»، وحكى ابن المنذر الإجماع على كونها فرض عين."
        ],
        [
          "saghani-grade",
          "قال الصغاني: إنه موضوع، وتبعه على ذلك العجلوني والشوكاني والألباني في السلسلة الضعيفة.",
          "قال الصغاني: إنه موضوع، وتبعه على ذلك العجلوني والشوكاني والألباني في السلسلة الضعيفة."
        ],
        [
          "nonspeaker-dhikr",
          "فتكرارُ ذكرِ الأمِّ ثلاثَ مرّاتٍ يدلُّ على عِظَمِ حقِّها.",
          "فتكرارُ ذكرِ الأمِّ ثلاثَ مرّاتٍ يدلُّ على عِظَمِ حقِّها."
        ],
        [
          "control-qala-ibn-baz",
          "وقال ابن باز: يجب الوضوء من لحم الإبل.",
          "ومن أهل العلم من يرى: يجب الوضوء من لحم الإبل."
        ],
        [
          "control-yara-ibn-uthaymin",
          "ويرى ابن عثيمين أنّ صلاة الجماعة واجبة.",
          "ويرى ابن عثيمين أنّ صلاة الجماعة واجبة."
        ]
      ];
      for (const [id, input, expected] of ROWS68) {
        const got = say68(input);
        ok('roots-68 ' + id + (expected === input ? ': left as the model wrote it' : ': the name alone, taken whole'), got === expected, got);
      }
      ok('roots-68 no output keeps a fragment of a name beside the general speaker',
        ROWS68.every(([, input]) => !/بعض أهل العلم (?:ال[\u0621-\u064A]+ي|البر|البراك)(?:\s|:)/u.test(say68(input))));
      ok('roots-68 control · a bare grade then «ولكن خالفه…» is generalised exactly as before, for [b12]/[b4b-65] downstream to take',
        say68('وقال ابن حبان: صحيح، ولكن خالفه غيره فضعفه.') === 'ومن أهل العلم من يرى: صحيح، ولكن خالفه غيره فضعفه.', say68('وقال ابن حبان: صحيح، ولكن خالفه غيره فضعفه.'));
      const pick = (id) => ROWS68.find((r) => r[0] === id);
      const seams68 = [
        ['refusal-gate', '  if (ownersFormulaRefused(sentence, attribution)) return true;\n', '', 'companion-ibn-abbas-ikrima'],
        ['whole-name', '    attribution = { ...attribution, nameOnly: wholeNameSpan(sentence, attribution.nameOnly || reported) };', '    attribution = { ...attribution, nameOnly: attribution.nameOnly || reported };', 'mangle-shaykh-barrak'],
        ['reported-frame', '  const reported = speaker && !attribution.nameOnly ? reportingFrameNameOnly(sentence, attribution) : null;', '  const reported = null;', 'frame-ibn-hajar-daraqutni'],
        ['implied-same-sentence', "      if (here.length && (/،/u.test(gap) || /(?:^|\\s)(?:الذي|التي)\\s*[وف]?\\s*$/u.test(gap))) return null;\n", '', 'implied-ibn-hajar', CLOSE6B_LINE],
      ];
      for (const [tag, from, to, id, also] of seams68) {
        const [, input, expected] = pick(id);
        const m68 = await runMutant({ sourceFile: REVIEWER, name: 'without [roots-68] ' + tag,
          transform: (source) => { const one = source.split(from).join(to); return also ? one.split(also).join('') : one; }, // [111-close-6] the widened line goes with it
          survives: (mod) => mod.reviewAnswer({ text: input, evidence: [], domain: 'fiqh', mode: 'chat' }).text.split('\n')[0] === expected });
        ok('roots-68 ' + tag + ' mutant seam applied', m68.changed, m68.error);
        ok('MUTANT KILLED: without [roots-68] ' + tag + ' «' + id + '» is rewritten again', m68.loaded && m68.survived === false, JSON.stringify(m68));
      }
      // ── [111-close-6] · THE REST OF ROW 68, MEASURED ON THE PREVIEW OF efcdcf4 (roots phase 3) ──────────────────────
      const ROWS6 = [
        ['close6-narrator-shurayh', 'جمهورُ الفقهاءِ على أنّ مدّةَ المسحِ يومٌ وليلةٌ للمقيم، لحديثِ شُريحِ بنِ هانئٍ قال: سألتُ عائشةَ رضي الله عنها عن المسحِ على الخفَّين، فقالت: سَلْ عليًّا.'],
        ['close6-narrator-sulayman', 'حديثٌ ضعيفٌ جدًّا: ففي سندِه معروفُ بنُ حسّانَ وهو ضعيف، وفيه سليمانُ بنُ عمرٍو النخعيّ الذي قال: حدثنا فلان.'],
        ['close6-story-bayhaqi', 'وقد ذكر البيهقيُّ في كتاب الاعتقاد أن سبب الحديث أن النبي صلى الله عليه وسلم لما بعث عليًّا رضي الله عنه إلى اليمن كثرت الشكوى منه.'],
        ['close6-consensus-nawawi', 'قال الإمامُ النوويُّ رحمه الله في هذا الحديث: «واتَّفَقَ الحُفَّاظُ عَلَى ضَعْفِهِ، وَإِنْ كَثُرَتْ طُرُقُهُ».'],
        ['close6-implied-mubarak', 'فقد كره ابنُ المبارك أن يُسألَ عن حديثٍ وهو يمشي وقال: «ليس هذا من توقير العلم»، وأن يتقدّمَ عليه في المواطنِ الخطيرة.'],
      ];
      for (const [id, input] of ROWS6) ok('close-6 ' + id + ': left as the model wrote it', say68(input) === input, say68(input));
      ok('close-6 control · «وقد قال فيها ابن عساكر: منكر…» still takes it', say68('فهذه أشد نكارة، وقد قال فيها ابن عساكر: منكر جداً إسناداً ومتناً.') === 'فهذه أشد نكارة، ومن أهل العلم من يرى: منكر جداً إسناداً ومتناً.',
        say68('فهذه أشد نكارة، وقد قال فيها ابن عساكر: منكر جداً إسناداً ومتناً.'));
      // [111-close-6b] — this round's preview (battery Q1, Q7 «مفصّل»; round 5 Q6, Q7, Q8, Q14)
      const ROWS6B = [
        'والدليلُ على ذلك حديثُ شُريحِ بنِ هانئ قال: سألتُ عائشةَ عن المسح على الخفين، فقالت: ائتِ عليَّ بنَ أبي طالب فسَلْه.',
        'الترمذي قال: هو حديثٌ منكر، وقال أيضاً في كتاب العلل: سألتُ محمداً (يعني البخاري) عن هذا الحديث فأنكره.',
        'يحيى بن معين قال: هو حديثٌ لا أصل له، وقال أيضاً: إنه كذبٌ لا أصل له.',
        'وممّن نقلَ هذا الإجماعَ أيضًا: الغزاليُّ، وابنُ العربيِّ إذ قال: "قد اجتمعتِ الأمةُ على وجوبِ الوضوء".',
        'القولُ الأوّل: تحريمُ حلقِ اللحيةِ، وهو ما نقلَه ابنُ حزمٍ حين قال: اتّفقوا أنّ حلقَ جميعِ اللحيةِ مُثلةٌ لا تجوز.',
        'وذكرَ ابنُ عابدين من الحنفيّةِ أنّ الأخذَ من اللحيةِ دون القبضةِ لم يُبِحْه أحد.',
        'القولُ الثاني: المنعُ مطلقًا، وممّا استُدلَّ به لتشديدِ المنعِ ما نقله ابنُ عابدين من أنّ الأخذَ من اللحيةِ دونَ القبضةِ لم يُبِحْه أحد.',
        'فقد نقل القرطبي هذا الإجماع صراحة فقال: "أجمع المسلمون على وجوب الحج في الجملة".',
        'فالخلاصةُ: إن كانت الشركةُ تعاونيةً حقيقةً، فأكثرُ من أفتى في المسألة يُجيز العملَ فيها.',
      ];
      for (const input of ROWS6B) ok('close-6b ' + input.slice(0, 28) + '…: left as the model wrote it', say68(input) === input, say68(input));
      ok('close-6b · «أبو زرعة الرازي قال:» — a name taken whole, never «بعض أهل العلم الرازي»',
        !/بعض أهل العلم (?:الرازي|العيد)/u.test(say68('أبو زرعة الرازي قال: خلقٌ كثيرٌ افتُضِحوا فيه.') + say68('ابن دقيق العيد قال: لم يثبتوه.')));
      const seams6 = [
        ['narrator', "  if (OWNER_FORMULA_NARRATOR_LEAD_RE.test(frame)) return 'narrator';\n", 'close6-narrator-sulayman'],
        ['story', "  if (OWNER_FORMULA_REPORTED_STORY_RE.test(said)) return 'narration';\n", 'close6-story-bayhaqi'],
      ];
      for (const [tag, from, id] of seams6) {
        const input = ROWS6.find((r) => r[0] === id)[1];
        const m6 = await runMutant({ sourceFile: REVIEWER, name: 'without [close-6] ' + tag,
          transform: (source) => source.split(from).join(''),
          survives: (mod) => mod.reviewAnswer({ text: input, evidence: [], domain: 'fiqh', mode: 'chat' }).text.split('\n')[0] === input });
        ok('close-6 ' + tag + ' mutant seam applied', m6.changed, m6.error);
        ok('MUTANT KILLED: without [close-6] ' + tag + ' «' + id + '» is generalised again', m6.loaded && m6.survived === false, JSON.stringify(m6));
      }
    }
    // ── [111-close-14] · THE OWNER'S DECISION 7: THE KHILAF TAIL FOLLOWS ONLY AN ANSWER THAT SET OUT TWO VIEWS ──
    // MEASURED over the 246 stored replies (close/fix14/count.txt): the tail stood on 98; 37 of them set out two views.
    {
      const R14 = await fresh(REVIEWER, 'close14-base');
      const TAIL14 = 'وتُراجَع المسألة مع أهل العلم لظهور الخلاف فيها.';
      const ev14 = [{ id: 'k1', title: 'فتوى', snippet: 'اختلف العلماء في هذه المسألة على قولين', url: 'https://example.org/k1' }];
      const said = (mod, text) => mod.reviewAnswer({ text, evidence: ev14, domain: 'fiqh', mode: 'chat' }).text;
      const IJMA = 'نعم، تحريم الزنا من المسائل التي انعقد عليها إجماع الأمة، ولم يختلف فيها أحد.';
      ok('close-14 W · a consensus answer takes no khilaf tail', !said(R14, IJMA).includes(TAIL14), said(R14, IJMA));
      const DENY = 'وليس بين أهل العلم خلاف في وجوب الصلاة.';
      ok('close-14 W · nor does an answer that DENIES a disagreement', !said(R14, DENY).includes(TAIL14));
      const TWO = 'اختلف العلماء في زكاة الحلي على قولين: فذهب الحنفية إلى الوجوب، وذهب الجمهور إلى عدمه.';
      ok('close-14 control · an answer that sets out two views keeps the tail', said(R14, TWO).includes(TAIL14), said(R14, TWO));
      ok('close-14 control · presentsTwoViews reads «ومنهم من…» and «خلافًا لـ…»', R14.presentsTwoViews('ومنهم من قال بالجواز.') && R14.presentsTwoViews('وهو قول الجمهور خلافًا للحنفية.'));
      const m14 = await runMutant({ sourceFile: REVIEWER, name: 'without [close-14]',
        transform: (source) => source.split("if (khilafTrigger && presentsTwoViews(output.join('\\n')) // [111-close-14]").join('if (khilafTrigger'),
        survives: (mod) => !mod.reviewAnswer({ text: DENY, evidence: [], domain: 'fiqh', mode: 'chat' }).text.includes(TAIL14) });
      ok('close-14 mutant seam applied', m14.changed, m14.error);
      ok('MUTANT KILLED: without [close-14] the consensus answer takes the tail again', m14.loaded && m14.survived === false, JSON.stringify(m14));
    }
  } catch (error) {
    ok('guard completed without exception', false, error?.stack || String(error));
  }
  process.exit(finish());
})();
