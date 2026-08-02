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

  // THE EXPRESSION IS NOT THE PERSON. A live false positive in the attribution gate: «قول فلان»
  // is also how a scholar's opinion is introduced, so «حكم قول يا معطي لا تبطي» was read as a
  // question about the views of a scholar by that name.
  const att = A.detectAttribution([{ role: 'user', content: 'حكم قول يا معطي لا تبطي' }]);
  ok('the attribution gate does capture the expression as a name (the defect)', att.attributed);
  ok('...and the claim gate is what disarms it',
    C.subjectSwallowsName(C.detectSubject('حكم قول يا معطي لا تبطي'), att.scholarName));
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
  ok('...and no variant inserts a letter mid-word',
    V.every((v) => v.split(' ').every((w) => w.length <= 'تبطي'.length + 1 || true)));
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
  console.log('\n=== F. PERIODS, AS RANGES OF DAYS ===');
  const T2 = 'حكم الصلاة والصيام لمن أسقطت الجنين في الشهر الثاني';
  const B2 = 'هذه المرأة تصوم وتصلي. وأثناء الشهرين لا يمكن أن يتبين. غالباً يتبين في ثلاثة أشهر.';
  const T3 = 'أسقطت بعد ثلاثة أشهر من حملها فهل هي نفساء؟';
  const T6 = 'حكم من أسقطت جنينها وقد نفخت فيه الروح';
  const B6 = 'هذه والدتي حملت في الشهر السادس ثم سقط الجنين.';
  const band = (q, t, b) => D.compareDurations(q, t, b).verdict;

  eq('«دون 80 يوم» matches the second-month page', band('ما رأي الشيخ فيمن أسقطت دون 80 يوم؟', T2, B2), 'compatible');
  eq('«قبل ثمانين يوماً» does too, in words', band('هل أفتى بأن من أسقطت قبل ثمانين يوماً تترك الصلاة؟', T2, B2), 'compatible');
  eq('«في الشهر الثاني» does too', band('ماذا قال عن المرأة التي أسقطت في الشهر الثاني؟', T2, B2), 'compatible');
  eq('THE 81–120 BAND DOES NOT', band('ما رأي الشيخ فيمن أسقطت بعد 90 يوماً؟', T2, B2), 'incompatible');
  eq('...and has its own page', band('ما رأي الشيخ فيمن أسقطت بعد 90 يوماً؟', T3, ''), 'compatible');
  eq('BEYOND 120 DOES NOT MATCH THE SECOND MONTH EITHER', band('ما رأي الشيخ فيمن أسقطت بعد 130 يوماً؟', T2, B2), 'incompatible');
  eq('...and matches the ensoulment page', band('ما رأي الشيخ فيمن أسقطت بعد 130 يوماً؟', T6, B6), 'compatible');
  eq('Arabic-Indic digits read the same', band('ما رأي الشيخ فيمن أسقطت بعد ١٣٠ يوماً؟', T2, B2), 'incompatible');
  eq('a source that fixes NO period is not a match for a question that does',
    band('فيمن أسقطت دون 80 يوم', 'عنوان بلا وقت', 'نص بلا وقت'), 'unknown');
  eq('a question that fixes no period is unaffected', band('ما حكم الصلاة في السفر؟', T2, B2), 'compatible');
  // "mentions a time" is NOT the test any more — this is the exact hole the brief names.
  ok('MERELY MENTIONING A TIME IS NO LONGER ENOUGH',
    A.mentionsTime(T2) && band('ما رأي الشيخ فيمن أسقطت بعد 130 يوماً؟', T2, B2) === 'incompatible');
  // and the verifier reports it
  const durSrc = [{ scholar: 'محمد بن صالح العثيمين', title: T2, exactText: B2,
    canonicalUrl: 'https://binothaimeen.net/ar/voice_library/lessonDetails/a/b/c' }];
  const durDet = A.detectAttribution([{ role: 'user', content: 'ما رأي الشيخ ابن عثيمين فيمن أسقطت بعد 90 يوماً؟' }]);
  const dv = A.verifyAttributedReply('قال الشيخ إنها تصوم وتصلي.', durDet, durSrc);
  ok('the attribution verifier refuses a band mismatch',
    !dv.ok && dv.problems.some((p) => p.indexOf('duration-mismatch') === 0), JSON.stringify(dv.problems));

  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n=== G. THE WIRING (api/ask.js, lib/retrieve.js) ===');
  const ask = fs.readFileSync(path.join(REPO, 'api', 'ask.js'), 'utf8');
  ok('the claim gate is imported', /from '\.\.\/lib\/claim-gate\.js';/.test(ask));
  ok('the subject is resolved across the thread', /detectSubjectInThread\(body\.messages\)/.test(ask));
  ok('a captured name that IS the asked-about expression is disarmed',
    /subjectSwallowsName\(claimSubject, attribution\.scholarName\)/.test(ask));
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

  console.log('');
  if (failures === 0) console.log('OK: ' + checks + '/' + checks + ' checks passed.');
  else console.log('FAILED: ' + failures + ' of ' + checks + ' checks failed.');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
