// claim-guard.cjs — the specific-claim gate (gate 24).
//
// IT EXISTS BECAUSE OF A SECOND REPRODUCED FAILURE, of a different shape from the one
// attribution-guard.cjs covers. The question
//     «حكم قول يا معطي لا تبطي»
// was answered on production with a confident verdict on that exact expression — that it is a
// fine supplication, commendable, "among the finest forms of du'ā" — hung on an islamweb fatwa
// that never mentions the expression at all. One production run cited 121485 («مسألة حول الدعاء
// بأسماء الله الحسنى»), a second cited 120875 («معنى: اللهم لا مانع لما أعطيت، ولا معطي لما
// منعت»). Both are real, allow-listed, correctly-fetched pages, and both share vocabulary with
// the question — 120875 contains the word معطي — while ruling on something else entirely. The
// same reply produced a hadith wording welded together from more than one narration and credited
// it to al-Tirmidhī with al-Albānī's authentication, and glossed the Gulf word «تبطي» (تُبطئ, "be
// slow") as though it meant "stop giving".
//
// WHAT THIS GATE PROVES:
//   A. SUBJECT     — a question about a named expression is told apart from a question about a
//                    general rule, and general questions are NOT swept up.
//   B. DIALECT     — «تبطي» reaches «تبطئ» and never «تبطلي», and a variant is never evidence.
//   C. ENTAILMENT  — the two pages production actually cited are refused as evidence for a
//                    verdict on this expression, by their TEXT, not their domain or their title.
//   D. VERDICTS    — permission and prohibition are held to the same standard, and a general
//                    principle stated AS a general principle is still allowed through.
//   E. HADITH      — wording, attribution and grading are each required separately, a composite
//                    wording is refused, and a verbatim one passes.
//   F. DURATION    — the miscarriage bands, now compared as ranges of days rather than by the
//                    presence of any period at all.
//   G. WIRING      — read off api/ask.js: the claim branch buffers, verifies, and shows one card.
//
// NO NETWORK. Every page in this gate is a fixture; the two islamweb bodies are the real pages,
// captured from the live site, trimmed to the part that matters.
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = __dirname;
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  return ok(name, a === e, 'expected ' + e + '\n        actual   ' + a);
}

(async function main() {
  const C = await import('file://' + path.join(REPO, 'lib', 'claim-gate.js').replace(/\\/g, '/'));
  const D = await import('file://' + path.join(REPO, 'lib', 'duration.js').replace(/\\/g, '/'));
  const A = await import('file://' + path.join(REPO, 'lib', 'attribution.js').replace(/\\/g, '/'));

  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n=== A. IS THE QUESTION ABOUT A NAMED EXPRESSION? ===');
  const SPECIFIC = [
    'حكم قول يا معطي لا تبطي',
    'هل قول يا معطي لا تبطئ سنة؟',
    'ما حكم قول «اللهم صل على محمد» بعد الأذان؟',
    'حكم عبارة الله يعطيك العافية',
    'حكم قول آمين بعد الفاتحة',
  ];
  for (const q of SPECIFIC) {
    const s = C.detectSubject(q);
    ok('specific: ' + q.slice(0, 34), s.specific && !!s.subject, JSON.stringify(s));
  }
  // The other half of the job, and the one a careless gate gets wrong: a question about a RULE
  // must keep working from a general source.
  const GENERAL = [
    'هل يجوز أن أدعو الله بأسمائه الحسنى؟',
    'ما حكم الصلاة في السفر؟',
    'ما حكم صيام يوم عرفة؟',
    'كيف أتوضأ؟',
    'ما فضل الدعاء بين الأذان والإقامة؟',
  ];
  for (const q of GENERAL) {
    ok('general (NOT gated): ' + q.slice(0, 34), !C.detectSubject(q).specific, JSON.stringify(C.detectSubject(q)));
  }
  // Anaphora resolves against the thread, and refuses when it cannot.
  const resolved = C.detectSubjectInThread([
    { role: 'user', content: 'حكم قول يا معطي لا تبطي' },
    { role: 'assistant', content: '...' },
    { role: 'user', content: 'هل هذه العبارة بدعة أو حرام؟' },
  ]);
  ok('«هذه العبارة» resolves to what was asked earlier', resolved.specific && resolved.subject.indexOf('معطي') !== -1,
    JSON.stringify(resolved));
  const unresolved = C.detectSubjectInThread([{ role: 'user', content: 'هل هذه العبارة بدعة أو حرام؟' }]);
  ok('...and an unresolvable one stays specific with NO subject', unresolved.specific && !unresolved.subject,
    JSON.stringify(unresolved));

  // THE EXPRESSION IS NOT THE PERSON. «قول فلان» can introduce a scholar's opinion, but the
  // vocative words in «حكم قول يا معطي لا تبطي» are the subject being judged, not a byline.
  const att = A.detectAttribution([{ role: 'user', content: 'حكم قول يا معطي لا تبطي' }]);
  ok('the expression creates no person attribution',
    !att.attributed && att.mode === 'none' && att.scholarName === '', JSON.stringify(att));
  const realAtt = A.detectAttribution([{ role: 'user', content: 'ما رأي الشيخ ابن عثيمين في حكم قول آمين' }]);
  ok('...without disarming a real attribution in the same sentence',
    realAtt.attributed && !C.subjectSwallowsName(C.detectSubject('ما رأي الشيخ ابن عثيمين في حكم قول آمين'), realAtt.scholarName),
    JSON.stringify(realAtt.scholarName));

  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n=== B. DIALECT, CONSERVATIVELY ===');
  const V = C.phraseVariants('يا معطي لا تبطي');
  ok('«تبطي» reaches the standard spelling «تبطئ»', V.some((v) => v.indexOf('تبطئ') !== -1), JSON.stringify(V));
  ok('...and the vocative may be absent', V.some((v) => v.indexOf('يا ') !== 0));
  ok('...and it NEVER becomes «تبطلي»', !V.some((v) => v.indexOf('تبطل') !== -1), JSON.stringify(V));
  const baseVariantWords = 'يا معطي لا تبطي'.split(' ');
  const illegalVariants = V.filter((variant) => {
    const words = variant.split(' ');
    const originals = words[0] === 'يا' ? baseVariantWords : baseVariantWords.slice(1);
    return words.length !== originals.length || words.some((word, i) => {
      const original = originals[i];
      return word !== original && !(original.endsWith('ي') && word === original.slice(0, -1) + 'ئ');
    });
  });
  ok('...and no variant inserts a letter mid-word',
    illegalVariants.length === 0, JSON.stringify(illegalVariants));
  ok('the variant set stays small', V.length <= 8, String(V.length));

  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n=== C. DOES THE PAGE ADDRESS THE EXPRESSION? ===');
  const FIX = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'claim-fixtures.json'), 'utf8'));
  const SUBJ = 'يا معطي لا تبطي';
  const page121485 = { title: 'مسألة حول الدعاء بأسماء الله الحسنى', url: 'https://www.islamweb.net/ar/fatwa/121485/', passage: FIX.f121485 };
  const page120875 = { title: 'معنى: اللهم لا مانع لما أعطيت، ولا معطي لما منعت', url: 'https://www.islamweb.net/ar/fatwa/120875/', passage: FIX.f120875 };

  ok('the fixture pages are the real ones (they do contain «معطي»)',
    /معطي/.test(FIX.f121485) && /معطي/.test(FIX.f120875));
  ok('FATWA 121485 IS NOT EVIDENCE FOR THIS EXPRESSION', !C.pageAddressesSubject(SUBJ, FIX.f121485));
  ok('FATWA 120875 IS NOT EVIDENCE EITHER, though it shares the word معطي',
    !C.pageAddressesSubject(SUBJ, FIX.f120875));
  eq('...so neither supports the subject', C.sourcesAddressingSubject(SUBJ, [page121485, page120875]).length, 0);
  // and the gate is not simply "always no"
  const real = { title: 'حكم قول يا معطي لا تبطي', url: 'https://www.islamweb.net/ar/fatwa/999999/',
    passage: 'الجواب: قول يا معطي لا تبطي دعاء لا حرج فيه إذا قصد به سؤال الله تعجيل العطاء، ومعنى لا تبطي أي لا تُبطئ.' };
  ok('a page that DOES rule on the expression is recognised', C.pageAddressesSubject(SUBJ, real.passage));
  const dialectPage = { title: 'x', url: 'https://www.islamweb.net/ar/fatwa/888888/',
    passage: 'سئل عن حكم قول يا معطي لا تبطئ فأجاب بأنه لا بأس به.' };
  ok('...including one that spells it the standard way', C.pageAddressesSubject(SUBJ, dialectPage.passage));
  ok('the title alone is never enough',
    !C.pageAddressesSubject(SUBJ, 'عنوان فيه يا معطي لا تبطي'.replace('يا معطي لا تبطي', 'الدعاء')));

  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n=== D. VERDICTS — BOTH DIRECTIONS ===');
  const subj = C.detectSubject('حكم قول يا معطي لا تبطي');
  const generalOnly = [page121485];

  const PROD = 'الدعاء بـ"يا معطي لا تبطي" دعاء جميل ومستحب، وهو من أرقى صيغ الدعاء، ومعنى لا تبطي أي لا توقف العطاء.';
  const v1 = C.verifyClaims(PROD, subj, generalOnly);
  ok('THE PRODUCTION VERDICT IS REFUSED', !v1.ok && v1.problems.some((p) => p.indexOf('specific-verdict') === 0),
    JSON.stringify(v1.problems));

  const v2 = C.verifyClaims('قول يا معطي لا تبطي سنة ثابتة عن النبي.', subj, generalOnly);
  ok('«سنة» is refused without a direct source', !v2.ok, JSON.stringify(v2.problems));
  const v3 = C.verifyClaims('هذه العبارة بدعة محدثة ولا يجوز قولها.', subj, generalOnly);
  ok('«بدعة» is refused just as firmly — no severity without evidence', !v3.ok, JSON.stringify(v3.problems));
  const v4 = C.verifyClaims('هذه العبارة جائزة ولا بأس بها.', subj, generalOnly);
  ok('«جائز» is refused too — no laxity without evidence', !v4.ok, JSON.stringify(v4.problems));

  // THE ALLOWED SHAPE: the general principle, said as a general principle.
  const GOOD = 'المصدر يقرر الأصل العام: دعاء الله بأسمائه الحسنى مشروع. '
    + 'ولم أجد فيه حكماً على هذه العبارة بعينها، فيسأل عنها عالم موثوق.';
  const v5 = C.verifyClaims(GOOD, subj, generalOnly);
  ok('A GENERAL PRINCIPLE, STATED AS ONE, IS ALLOWED', v5.ok, JSON.stringify(v5.problems));

  // and with a page that does address it, the verdict stands
  const v6 = C.verifyClaims('قول يا معطي لا تبطي لا حرج فيه، ومعنى لا تبطي أي لا تُبطئ.', subj, [real]);
  ok('a supported verdict passes', v6.ok, JSON.stringify(v6.problems));
  eq('...and the supporting page is the one reported', v6.supporting.length, 1);

  // an unresolvable anaphora can support nothing at all
  const v7 = C.verifyClaims('هذه العبارة مستحبة.', unresolved, generalOnly);
  ok('a verdict on an expression nobody identified is refused', !v7.ok, JSON.stringify(v7.problems));

  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n=== E. HADITH — WORDING, ATTRIBUTION, GRADING, EACH ON ITS OWN ===');
  const dorar = {
    title: 'شرح حديث الدعاء لا يرد بين الأذان والإقامة',
    url: 'https://www.dorar.net/hadith/sharh/12345',
    passage: 'عن أنس بن مالك رضي الله عنه أن رسول الله صلى الله عليه وسلم قال: '
      + 'الدعاء لا يرد بين الأذان والإقامة. رواه الترمذي وقال حديث حسن صحيح.',
  };
  // THE PRODUCTION HADITH — a wording assembled out of more than one narration.
  const COMPOSITE = 'قال النبي صلى الله عليه وسلم: الدعاء مستجاب في ثلاث ساعات عند الأذان '
    + 'وعند تقام الصلاة وآخر ساعة من يوم الجمعة. رواه الترمذي وصححه الألباني.';
  const h1 = C.hadithProblems(COMPOSITE, [dorar]);
  ok('THE «ثلاث ساعات» WORDING DOES NOT PASS AS A HADITH',
    h1.some((p) => p.indexOf('unsourced-hadith-wording') === 0), JSON.stringify(h1));
  ok('...and part of its meaning being sound does not rescue it',
    !C.hadithWordingFound(COMPOSITE, [dorar]));
  const h2 = C.hadithProblems(COMPOSITE, []);
  ok('...and with no retrieved page at all it certainly does not', h2.length > 0, JSON.stringify(h2));

  // verbatim from the page: passes
  const VERBATIM = 'قال النبي صلى الله عليه وسلم: الدعاء لا يرد بين الأذان والإقامة. رواه الترمذي وقال حديث حسن صحيح.';
  eq('a hadith carried verbatim by the page passes', C.hadithProblems(VERBATIM, [dorar]).length, 0);

  // right meaning, recomposed wording
  const RECOMPOSED = 'قال النبي صلى الله عليه وسلم: إن الدعاء بين الأذان والإقامة لا يرد أبداً وهو مستجاب قطعاً.';
  ok('a recomposed wording is refused even when the meaning is sound',
    C.hadithProblems(RECOMPOSED, [dorar]).length > 0, JSON.stringify(C.hadithProblems(RECOMPOSED, [dorar])));

  // right wording, an attribution the page never gives
  const WRONG_ATTR = 'قال النبي صلى الله عليه وسلم: الدعاء لا يرد بين الأذان والإقامة. رواه البخاري.';
  ok('an attribution the page never gives is refused',
    C.hadithProblems(WRONG_ATTR, [dorar]).some((p) => p.indexOf('unsourced-hadith-attribution') === 0),
    JSON.stringify(C.hadithProblems(WRONG_ATTR, [dorar])));

  // right wording, a grading the page never gives
  const WRONG_GRADE = 'قال النبي صلى الله عليه وسلم: الدعاء لا يرد بين الأذان والإقامة. رواه الترمذي وهو حديث ضعيف.';
  ok('a grading the page never gives is refused',
    C.hadithProblems(WRONG_GRADE, [dorar]).some((p) => p.indexOf('unsourced-hadith-grading') === 0),
    JSON.stringify(C.hadithProblems(WRONG_GRADE, [dorar])));

  // an answer with no narration in it is not dragged into any of this
  eq('an ordinary answer with no hadith is untouched',
    C.hadithProblems('الوضوء يبدأ بالنية ثم غسل الكفين ثلاثاً.', []).length, 0);

  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n=== F. PERIODS, AS COVERAGE — NOT AS OVERLAP ===');
  // THE RULE THIS SECTION PINS. «دون ثمانين يومًا» is days 0–79. «الشهر الثاني» is days 31–60.
  // They overlap, and overlapping is not answering: a page that speaks to a third of a question
  // is not the source for the question. Containment, or refusal.
  const PAGES = {
    second: ['حكم الصلاة والصيام لمن أسقطت الجنين في الشهر الثاني',
      'هذه المرأة تصوم وتصلي. وأثناء الشهرين لا يمكن أن يتبين. غالباً يتبين في ثلاثة أشهر.'],
    limit80: ['الدم الخارج بسبب السقط قبل تخلق الجنين',
      'إذا أسقطت المرأة الحامل لمدة شهر، أو شهرين، فإن هذا الدم دم فساد، لا يمنعها من صلاة ولا صيام. وأقل ما يمكن أن يتبين فيه خلق الإنسان ثمانون يوماً. إذا كانت قبل ثمانين يوماً، لا يمكن أن يكون الدم دم نفاس. وإذا بلغ تسعين يوماً فالغالب أنها تكون مخلقة.'],
    rule80: ['ضابط السقط الذي تترك المرأة لأجله الصلاة',
      'إن سقط ولم يخلق فالدم دم فساد، لا تترك من أجله الصلاة، وأدنى ما يمكن أن يخلق فيه (81) يوماً، ولا يمكن أن يخلق قبل الثمانين.'],
    threeMonths: ['أسقطت بعد ثلاثة أشهر من حملها فهل هي نفساء؟', ''],
    fromEighty: ['سقط الجنين قبل تمام أربعة أشهر فهل تعتبر المرأة نفساء؟',
      'يتبين خلق الإنسان من ثمانين يوماً فما فوق، وما قبل ذلك الدم فهو دم فساد لا يمنع من صلاة ولا صيام ولا زوج.'],
    incidental: ['حكم هجر المسلم لأخيه المسلم', 'ولو هجره ثمانين يوماً فإنه آثم، والهجر فوق ثلاث لا يجوز.'],
  };
  const PV = (q, p) => D.compareDurations(q, PAGES[p][0], PAGES[p][1]).verdict;
  const A_OK = (q, p) => D.durationAcceptable(PV(q, p));

  // THE ORIGINAL QUESTION
  eq('«دون 80 يوم» is NOT covered by the second-month page', PV('فيمن أسقطت دون 80 يوم؟', 'second'), 'partial');
  ok('...so that page is not acceptable for it', !A_OK('فيمن أسقطت دون 80 يوم؟', 'second'));
  eq('...and the page that draws the eighty-day line IS, at the exact boundary',
    PV('فيمن أسقطت دون 80 يوم؟', 'limit80'), 'exact-boundary');
  eq('...as is the page stating the rule «قبل الثمانين»', PV('فيمن أسقطت دون 80 يوم؟', 'rule80'), 'exact-boundary');
  eq('...and «قبل تمام أربعة أشهر» covers it too, one tier down',
    PV('فيمن أسقطت دون 80 يوم؟', 'fromEighty'), 'covered');

  // THE BOUNDARY LADDER
  eq('50 days IS inside the second month', PV('فيمن أسقطت ولها 50 يوماً؟', 'second'), 'covered');
  eq('70 days is NOT', PV('فيمن أسقطت ولها 70 يوماً؟', 'second'), 'unknown');
  ok('...and is refused there', !A_OK('فيمن أسقطت ولها 70 يوماً؟', 'second'));
  eq('day 80 exactly is refused by the page whose rule stops at 79',
    PV('فيمن أسقطت ولها 80 يوماً؟', 'rule80'), 'unknown');
  ok('...and refused by the second-month page', !A_OK('فيمن أسقطت ولها 80 يوماً؟', 'second'));
  eq('...and accepted ONLY where the source settles it outright («من ثمانين فما فوق»)',
    PV('فيمن أسقطت ولها 80 يوماً؟', 'fromEighty'), 'covered');
  ok('...which is an acceptance, not a refusal', A_OK('فيمن أسقطت ولها 80 يوماً؟', 'fromEighty'));
  eq('«بعد 90 يوماً» is not the second month', PV('فيمن أسقطت بعد 90 يوماً؟', 'second'), 'unknown');
  eq('...and matches the page that names ninety', PV('فيمن أسقطت بعد 90 يوماً؟', 'limit80'), 'exact-boundary');
  eq('...and the three-month page draws the same line', PV('فيمن أسقطت بعد 90 يوماً؟', 'threeMonths'), 'exact-boundary');
  eq('«بعد 120 يوماً» is covered by «بعد ثلاثة أشهر»', PV('فيمن أسقطت بعد 120 يوماً؟', 'threeMonths'), 'covered');
  ok('...and refused by the second-month page', !A_OK('فيمن أسقطت بعد 120 يوماً؟', 'second'));

  // DIRECTION AT THE SAME NUMBER
  eq('«بعد 80» does not match a source that says «قبل الثمانين»', PV('فيمن أسقطت بعد 80 يوماً؟', 'rule80'), 'partial');
  ok('...and is refused', !A_OK('فيمن أسقطت بعد 80 يوماً؟', 'rule80'));
  eq('«دون 80» does not match a source that says «بعد ثلاثة أشهر»', PV('فيمن أسقطت دون 80 يوم؟', 'threeMonths'), 'unknown');

  // A NUMBER MENTIONED IN PASSING, IN ANOTHER MATTER
  ok('a page mentioning eighty days in an unrelated ruling is not thereby a source',
    !A_OK('فيمن أسقطت دون 80 يوم؟', 'incidental'), PV('فيمن أسقطت دون 80 يوم؟', 'incidental'));

  // NUMERALS AND WORDS READ ALIKE
  eq('Arabic-Indic digits read the same', PV('فيمن أسقطت دون ٨٠ يوماً؟', 'second'), 'partial');
  eq('number words read the same', PV('من أسقطت قبل ثمانين يوماً تترك الصلاة؟', 'second'), 'partial');
  eq('a question that fixes no period is unaffected', PV('ما حكم الصلاة في السفر؟', 'second'), 'no-question-period');
  eq('a source that fixes no period is refused for a question that does',
    D.compareDurations('فيمن أسقطت دون 80 يوم', 'عنوان بلا وقت', 'نص بلا وقت').verdict, 'unknown');

  // THE SEARCH TERMS THE QUESTION'S OWN NUMBER IMPLIES
  ok('«دون 80 يوم» implies a search for «قبل الثمانين»',
    D.durationTerms('فيمن أسقطت دون 80 يوم؟').indexOf('قبل الثمانين') !== -1,
    JSON.stringify(D.durationTerms('فيمن أسقطت دون 80 يوم؟')));
  ok('a bare day count implies the month that contains it',
    D.durationTerms('فيمن أسقطت ولها 50 يوماً؟').indexOf('الشهر الثاني') !== -1,
    JSON.stringify(D.durationTerms('فيمن أسقطت ولها 50 يوماً؟')));
  eq('a question with no period implies no period search', D.durationTerms('ما حكم الصلاة؟').length, 0);

  // AND THE VERIFIER REPORTS IT
  const durSrc = [{ scholar: 'محمد بن صالح العثيمين', title: PAGES.second[0], exactText: PAGES.second[1],
    canonicalUrl: 'https://binothaimeen.net/ar/voice_library/lessonDetails/a/b/c' }];
  const durDet = A.detectAttribution([{ role: 'user', content: 'ما رأي الشيخ ابن عثيمين فيمن أسقطت دون 80 يوم؟' }]);
  const dv = A.verifyAttributedReply('قال الشيخ إنها تصوم وتصلي.', durDet, durSrc);
  ok('THE VERIFIER REFUSES A SOURCE THAT COVERS ONLY PART OF THE QUESTION',
    !dv.ok && dv.problems.some((p) => p.indexOf('duration-partial') === 0), JSON.stringify(dv.problems));


  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n=== G. THE WIRING (api/ask.js, lib/retrieve.js) ===');
  const ask = fs.readFileSync(path.join(REPO, 'api', 'ask.js'), 'utf8');
  ok('the claim gate is imported', /from '\.\.\/lib\/claim-gate\.js';/.test(ask));
  // Both of these moved into lib/ask-plan.js, which composes the classifiers into one
  // description of the request; api/ask.js reads the result. The BEHAVIOUR asserted is
  // unchanged — only its owner moved — so the assertions follow it rather than pinning a
  // location it no longer occupies.
  const plan = fs.readFileSync(path.join(REPO, 'lib', 'ask-plan.js'), 'utf8');
  ok('the subject is resolved across the thread', /detectSubjectInThread\(messages\)/.test(plan));
  ok('...and api/ask.js takes it from the plan rather than recomputing it',
    /const claimSubject = plan\.claimSubject;/.test(ask));
  ok('a captured name that IS the asked-about expression is disarmed',
    /subjectSwallowsName\(claimSubject, attribution\.scholarName\)/.test(plan));
  ok('...and disarming it means the question is NOT treated as an attribution',
    /subjectSwallowsName\(claimSubject, attribution\.scholarName\)\)\s*\{\s*mode = 'none';/.test(plan));
  const body = ask.slice(ask.indexOf('export default async function handler'));
  ok('the claim branch runs BEFORE round 2',
    body.indexOf('if (claimSubject.specific)') > -1
    && body.indexOf('if (claimSubject.specific)') < body.indexOf('── ROUND 2'));
  ok('...and only for a SPECIFIC question, so general ones still stream',
    /if \(claimSubject\.specific\) \{/.test(body));
  ok('the claim answer is BUFFERED, not streamed',
    /if \(claimSubject\.specific\)[\s\S]{0,3000}?stream: false,/.test(body),
    'a streamed verdict cannot be withdrawn after verification fails');
  ok('the draft is verified before anything is emitted', /verifyClaims\(cDraft, claimSubject, retrievedPages\)/.test(ask));
  ok('a failed verification emits the refusal and nothing of the draft',
    /if \(!cVerdict\.ok\)[\s\S]{0,400}?CLAIM_REFUSAL/.test(ask));
  ok('the model may not contribute a card on this path either',
    /const cDraft = cDrafted[\s\S]{0,200}?replace\(\/<source/.test(ask));
  ok('exactly ONE card is shown', /pickVerifiedSources\(supporting\.length \? supporting : retrievedPages, 1\)/.test(ask));
  ok('the phrase probe searches the reader\'s own wording', /const probe = variants\.length > 1/.test(ask));
  const ret = fs.readFileSync(path.join(REPO, 'lib', 'retrieve.js'), 'utf8');
  ok('retrieve() carries the passage so a claim can be checked against it',
    /passage: k\.passage/.test(ret));
  ok('the refusal makes no religious claim of its own',
    !/يجوز|حرام|مستحب|بدعة/.test(C.CLAIM_REFUSAL), C.CLAIM_REFUSAL);

  // =========================================================================
  // H. AN ARITHMETICALLY FALSE COMPARISON NEEDS NO SOURCE TO REFUTE
  //
  // MEASURED, batch 5: «المسافة ١٥٠ كيلومترًا وهي لا تبلغ ٨٠ كيلومترًا». Both halves are in one
  // sentence and one of them is simply false — 150 does reach 80. No page has to be fetched to
  // know that, and no evidence rule in the building looks at it: every screen we have asks where
  // a claim CAME FROM, and this one is refuted by reading it.
  console.log('\n=== H. NUMERIC SELF-CONTRADICTION ===');
  {
    const CG = await import('file://' + path.join(REPO, 'lib', 'policy', 'consistency-gate.js').replace(/\\/g, '/'));
    ok('the problem code is declared', !!CG.PROBLEM.NUMERIC_CONTRADICTION);
    // The tools are the ones that already exist. A second number parser beside lib/duration.js is
    // two parsers that can disagree about what «ثمانين» is.
    ok('lib/duration.js exposes the cardinals rather than hiding them',
      CG.PROBLEM.NUMERIC_CONTRADICTION && D.CARDINALS && typeof D.CARDINALS === 'object');
    ok('the screen reads them from lib/duration.js and parses no digits of its own',
      /from '\.\.\/duration\.js'/.test(fs.readFileSync(path.join(REPO, 'lib', 'policy', 'consistency-gate.js'), 'utf8')));

    const p = (t) => CG.consistencyProblems(t, {});
    const has = (t) => p(t).includes(CG.PROBLEM.NUMERIC_CONTRADICTION);

    // ── RED: the measured sentence, in digits, in Arabic-Indic digits, and in words ──
    ok('«١٥٠ كيلومترًا وهي لا تبلغ ٨٠ كيلومترًا» is refuted',
      has('المسافة ١٥٠ كيلومترًا وهي لا تبلغ ٨٠ كيلومترًا.'), JSON.stringify(p('المسافة ١٥٠ كيلومترًا وهي لا تبلغ ٨٠ كيلومترًا.')));
    ok('...in western digits too',
      has('المسافة 150 كيلومترا وهي لا تبلغ 80 كيلومترا.'));
    ok('...and when the second number drops its unit',
      has('المسافة 150 كيلومترا وهي لا تبلغ 80.'));
    ok('a false "more than" is refuted as well',
      has('المسافة 50 كيلومترا وهي أكثر من 80 كيلومترا.'));
    ok('...and a false "less than"',
      has('مدة السفر 30 يوما وهي أقل من 10 أيام.'));

    // ── GREEN: everything true, and everything not a comparison, is untouched ──
    for (const t of [
      'المسافة 150 كيلومترا وهي تزيد على 80 كيلومترا.',      // true
      'المسافة 50 كيلومترا وهي لا تبلغ 80 كيلومترا.',         // true
      'المسافة 80 كيلومترا وهي لا تزيد على 80 كيلومترا.',     // true at the boundary
      'صلى أربع ركعات ثم سافر أكثر من 80 كيلومترا.',          // two numbers, DIFFERENT units
      'المسافة 150 كيلومترا.',                                 // one number
      'قصر الصلاة في السفر مشروع بالكتاب والسنة.',            // no number at all
      'المسافة 150 كيلومترا، ومدة الإقامة أقل من 4 أيام.',    // two comparisons, both true
    ]) ok('untouched: «' + t.slice(0, 40) + '…»', !has(t), JSON.stringify(p(t)));

    // A verse that counts is not a contradiction, and is outside this check regardless.
    ok('a frozen text is outside the check',
      !has('فَصِيَامُ ثَلَاثَةِ أَيَّامٍ فِي الْحَجِّ وَسَبْعَةٍ إِذَا رَجَعْتُمْ تِلْكَ عَشَرَةٌ كَامِلَةٌ'));

    // ── THE SENTENCE GOES, THE ANSWER STAYS ──
    {
      const v = CG.screenDraft(
        'قصر الصلاة في السفر مشروع بالكتاب والسنة. المسافة 150 كيلومترا وهي لا تبلغ 80 كيلومترا.', {});
      ok('the contradicting sentence is dropped',
        v.droppedSentences.length === 1 && /لا تبلغ/.test(v.droppedSentences[0]),
        JSON.stringify(v.droppedSentences));
      ok('...and the rest of the answer survives',
        /مشروع بالكتاب والسنة/.test(v.text) && v.dropWhole === false, JSON.stringify(v));
    }
  }

  console.log('');
  if (failures === 0) console.log('OK: ' + checks + '/' + checks + ' checks passed.');
  else console.log('FAILED: ' + failures + ' of ' + checks + ' checks failed.');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
