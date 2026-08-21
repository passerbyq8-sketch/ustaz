// guards/transfer-mode-guard.cjs — MOVING A PUBLISHED ANSWER, OR REFUSING TO.
//
// ── WHAT TRANSFER MODE RISKS (قرار ١ + ٢) ────────────────────────────────────
// When the reader's question IS a question a vetted source already published, handing over the
// published answer beats generating a paraphrase of it. The entire risk is ONE failure: two
// questions that look alike and are not the same question. «قصر الصلاة للمسافر» and «قصر الصلاة
// للمقيم» differ by one word, score above 0.9 on any word measure, and have opposite answers.
//
// So this gate is mostly about REFUSALS. A transfer that does not happen costs the reader nothing
// — the ordinary sourced answer runs. A transfer that happens wrongly puts a scholar's name on an
// answer to a question he was never asked.
//
// ── NO NETWORK AND NO MODEL ──────────────────────────────────────────────────
// Every page is a saved fixture and the judge is a mock, both injected. `globalThis.fetch` is a
// throwing stub for the whole run: reaching for the network is a failure here, not a slow pass.
//
// Usage: node guards/transfer-mode-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const MODEL_PROBE_EXPECTED = process.env.F028_MODEL_PROBE_EXPECTED || '';
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond === true) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const eq = (name, actual, expected) =>
  ok(name, actual === expected, 'expected ' + JSON.stringify(expected) + '\n        actual   ' + JSON.stringify(actual));
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

// ── FIXTURES: saved pages, never fetched ─────────────────────────────────────
const HAMDALA = 'الحمد لله والصلاة والسلام على رسول الله وعلى آله وصحبه، أما بعد:';
const BODY = 'العقيقة سنة مؤكدة عن المولود، وهي شاة عن الأنثى وشاتان عن الذكر، تُذبح في اليوم السابع. ';
const labelPage = (q, a) => '<html><body><article>'
  + '<div class="mainitem quest-fatwa"><h3>السؤال</h3><div><p>' + q + '</p></div></div>'
  + '<div class="mainitem quest-fatwa" itemprop="acceptedAnswer">'
  + '<h3>الإجابــة</h3><div itemprop="text"><p>' + a + '</p></div></div>'
  + '</article></body></html>';       // the bounded shape islamweb actually publishes
const A3_CASES = JSON.parse(read('data/transfer-fixtures/a3-cases.json'));

(async function main() {
  console.log('=== transfer-mode-guard — the published answer moves, or nothing does ===');

  const realFetch = globalThis.fetch;
  let reached = 0;
  globalThis.fetch = async (u) => { reached++; throw new Error('network reached: ' + u); };

  try {
    const M = await esm('lib/transfer/match.js');
    const X = await esm('lib/transfer/extract.js');
    const T = await esm('lib/transfer/trim.js');
    const I = await esm('lib/transfer/index.js');

    // =========================================================================
    console.log('\n=== A0. A3 MUTATION: AN ASSERTION PASSES ONLY ON BOOLEAN TRUE ===');
    {
      const cases = [
        { value: true, expected: true },
        { value: false, expected: false },
        { value: { pass: false }, expected: false },
        { value: 'false', expected: false },
        { value: 1, expected: false },
        { value: new Boolean(true), expected: false }, // eslint-disable-line no-new-wrappers
      ];
      const mutationReds = (predicate) => cases
        .filter((test) => predicate(test.value) !== test.expected).length;
      const truthyMutant = (value) => !!value;
      const strictCandidate = (value) => value === true;
      const mutantRedCount = mutationReds(truthyMutant);
      const productRedCount = mutationReds(strictCandidate);
      console.log('        MUTANT_RESULT=' + (mutantRedCount ? 'RED' : 'GREEN')
        + ' mismatches=' + mutantRedCount);
      console.log('        STRICT_RESULT=' + (productRedCount ? 'RED' : 'GREEN')
        + ' mismatches=' + productRedCount);
      ok('the actual truthy mutant records RED on non-Boolean assertion results', mutantRedCount > 0,
        String(mutantRedCount));
      eq('the strict Boolean predicate records GREEN', productRedCount, 0);
      ok('the guard product uses strict Boolean true in ok(), not truthiness',
        /function ok\(name, cond, detail\) \{[\s\S]{0,100}if \(cond === true\)/.test(read('guards/transfer-mode-guard.cjs')));
    }

    // =========================================================================
    console.log('\n=== A. THE NAMED CONSTANTS ARE WHAT THE DECISION SAYS ===');
    eq('TRANSFER_MATCH', M.TRANSFER_MATCH, 0.97);
    eq('JUDGE_BAND low', M.JUDGE_BAND[0], 0.85);
    eq('JUDGE_BAND high', M.JUDGE_BAND[1], 0.97);
    ok('the judge band ends where the match begins — no gap and no overlap',
      M.JUDGE_BAND[1] === M.TRANSFER_MATCH);
    // PRINTED IN FULL, because قرار ٢ requires the list to be auditable rather than described.
    console.log('        FLIP_TOKENS (' + M.FLIP_TOKENS.length + '):');
    console.log('        ' + M.FLIP_TOKENS.join(' '));
    ok('FLIP_TOKENS is non-trivial', M.FLIP_TOKENS.length >= 80, String(M.FLIP_TOKENS.length));
    // THE ḤĀL FAMILIES ARE SHARED, NOT COPIED. A second list is a list that can disagree.
    const PM = await esm('lib/page-match.js');
    const halMembers = Object.values(PM.QUALIFIER_GROUPS).flat();
    ok('every ḥāl family member from lib/page-match.js is a flip token',
      halMembers.every((h) => M.FLIP_TOKENS.includes(h)),
      halMembers.filter((h) => !M.FLIP_TOKENS.includes(h)).join(' '));
    ok('...and match.js imports them rather than restating them',
      /import \{ QUALIFIER_GROUPS \} from '\.\.\/page-match\.js'/.test(read('lib/transfer/match.js')));
    // The framing words that are DELIBERATELY not flip tokens.
    for (const w of ['ما', 'يجوز', 'يجب', 'سنه']) {
      ok('«' + w + '» is deliberately NOT a flip token', !M.FLIP_TOKENS.includes(w),
        'a framing word in this list makes «هل يجوز…» and «ما حكم…» different questions');
    }

    // =========================================================================
    console.log('\n=== B. THE CAPABILITY TABLE SAYS ONLY WHAT WAS MEASURED ===');
    {
      const rows = X.transferableDomains();
      const readable = X.readableDomains();
      const incapable = X.declaredIncapableDomains();
      console.log('        rows      (' + rows.length + '): ' + rows.join(' '));
      console.log('        readable  (' + readable.length + '): ' + readable.join(' '));
      console.log('        incapable (' + incapable.length + '): ' + incapable.join(' '));

      // ── the eighth domain, unchanged ──────────────────────────────────────
      ok('mostafaaladwy.com has NO row at all', !rows.includes('mostafaaladwy.com'),
        'قرار ١٠ says its answer is a video — there is no published text to transfer');
      // ...and enforced at the entry point too, not only by omission from the table.
      eq('a video-answer page is unreadable even if asked directly',
        X.extractPair('https://mostafaaladwy.com/fatwa/1', labelPage('س', BODY.repeat(3))), null);

      // ── AND «HAS A ROW» IS NOT «CAN BE READ» ──────────────────────────────
      // The conflation is what W4 cost. Four hosts sat in this table claiming a generic label
      // reader that had never been run against one of their pages, and three of the four could
      // not be read by it at all. The two lists are now separate and BOTH are asserted, so a
      // host cannot quietly rejoin the capability list by being added to the table.
      ok('the two lists partition the table',
        readable.length + incapable.length === rows.length
        && readable.every((d) => !incapable.includes(d)),
        JSON.stringify({ rows: rows.length, readable: readable.length, incapable: incapable.length }));
      ok('a declared incapacity is DECLARED, not inferred from a null',
        incapable.every((d) => X.EXTRACTORS[d].declaredIncapable === true),
        'an undeclared absence is exactly what let four hosts claim a reader they did not have');
      // The three measured on 2026-08-08 against frozen real pages, each named.
      for (const d of ['ferkous.app', 'alukah.net', 'islamqa.info']) {
        ok('«' + d + '» declares it cannot be read', incapable.includes(d),
          'measured 2026-08-08: the label on its pages is «الجواب», never «الإجابة»');
      }
      // ...and the ones that CAN, likewise named, so a silent removal is a failure too.
      for (const d of ['islamweb.net', 'binbaz.org.sa', 'sh-albarrak.com', 'almosleh.com']) {
        ok('«' + d + '» is readable', readable.includes(d));
      }
    }

    // =========================================================================
    console.log('\n=== C. FIXTURE: A CLEAN HIT IS TRANSFERRED ===');
    {
      const Q = 'ما حكم العقيقة عن المولود';
      const r = await I.considerTransfer(Q, {
        url: 'https://islamweb.net/ar/fatwa/1001/x', html: labelPage(Q, HAMDALA + ' ' + BODY.repeat(3)),
      }, { band: 'adult' });
      ok('a verbatim question transfers', r.transfer === true, r.reason);
      ok('...at or above TRANSFER_MATCH', r.score >= M.TRANSFER_MATCH, String(r.score));
      ok('...carrying the PUBLISHED text', /العقيقة سنة مؤكدة/.test(r.text || ''));
      ok('...with the ḥamdala removed', r.openingStripped === true && !/الحمد لله/.test(r.text || ''));
      ok('...and the card is the page itself', r.url === 'https://islamweb.net/ar/fatwa/1001/x');
      // NO MODEL WAS ASKED. The clean hit is the common case and it must cost nothing.
      eq('...and no judge was consulted', r.judged, false);
    }

    // =========================================================================
    console.log('\n=== D. FIXTURE: A FLIPPED QUALIFIER AT HIGH SIMILARITY IS REFUSED ===');
    {
      // THE CASE THIS WHOLE GATE EXISTS FOR. One word apart, opposite answers.
      const READER = 'ما حكم قصر الصلاة للمسافر في السفر الطويل عند أهل العلم';
      const PAGE = 'ما حكم قصر الصلاة للمقيم في السفر الطويل عند أهل العلم';
      const r = await I.considerTransfer(READER, {
        url: 'https://islamweb.net/ar/fatwa/1002/x', html: labelPage(PAGE, BODY.repeat(3)),
      }, { judge: async () => 'لا', band: 'adult' });   // even a PERMISSIVE judge must not rescue it
      ok('the مسافر/مقيم pair does NOT transfer', r.transfer === false, r.reason);
      ok('...and the reason names the flip', /flip-token/.test(r.reason), r.reason);
      ok('...having scored high enough that similarity alone would have allowed it',
        r.score >= 0.8, String(r.score));
      ok('...and the flip tokens are reported', (r.flips || []).length >= 1, JSON.stringify(r.flips));
      // ── THE VETO ABOVE THE THRESHOLD, WHICH IS THE ONLY PLACE IT DECIDES ANYTHING ──
      //
      // MEASURED WHILE WRITING THIS GATE, and it changed the fixture: the pair above scores 0.833,
      // which is BELOW the judge band, so it refuses on the arithmetic alone. Disabling the veto
      // entirely left it refusing — the assertion was passing for a reason that had nothing to do
      // with the rule under test.
      //
      // A one-word difference cannot reach 0.97 in a short question: with n words each side and
      // one differing, Jaccard is (n-1)/(n+1), which needs n ≥ 66. The realistic shape that DOES
      // reach it is an extra QUALIFIER on a long question — the page answers «…للمسافر» and the
      // reader asked the same thing without it — where Jaccard is n/(n+1).
      //
      // قرار ٢ says the check is «حتميٌّ دائمًا — حتى فوقَ العتبة», and this is that case.
      const LONG = 'ما حكم قصر الصلاة الرباعية في السفر الطويل الذي تبلغ مسافته ثمانين كيلا عند '
        + 'جمهور أهل العلم من الفقهاء المتقدمين والمتأخرين مع بيان الدليل من الكتاب والسنة وقول '
        + 'الصحابة رضوان الله عليهم اجمعين في هذه المسالة المهمة';
      const cmp = M.compareQuestions(LONG, LONG + ' للمسافر');
      ok('the above-threshold pair really is above the threshold',
        cmp.score >= M.TRANSFER_MATCH, String(cmp.score));
      ok('...and the flip veto downgrades it anyway', cmp.verdict !== 'transfer', JSON.stringify(cmp.verdict));
      ok('...naming the qualifier that did it', cmp.flips.includes('للمسافر'), JSON.stringify(cmp.flips));

      // A3 / F-085: the same named qualifier is a deterministic veto in BOTH directions. A judge
      // asked only whether the reader added a constraint cannot safely clear a page-only one.
      const f = A3_CASES.stage2;
      const published = (question) => ({
        url: 'https://islamweb.net/ar/fatwa/a3-travel',
        published: { question, answer: f.answer.repeat(2), domain: 'islamweb.net' },
      });
      let qualifierJudgeCalls = 0;
      const permissiveJudge = async () => { qualifierJudgeCalls++; return 'لا'; };
      const readerOnly = await I.considerTransferPair(f.baseQuestion + ' ' + f.qualifier,
        published(f.baseQuestion), { judge: permissiveJudge, band: 'adult' });
      ok('«للمسافر» in the reader only refuses transfer', readerOnly.transfer === false,
        readerOnly.reason);
      const pageOnly = await I.considerTransferPair(f.baseQuestion,
        published(f.baseQuestion + ' ' + f.qualifier), { judge: permissiveJudge, band: 'adult' });
      ok('«للمسافر» on the page only refuses transfer', pageOnly.transfer === false,
        pageOnly.reason);
      const both = await I.considerTransferPair(f.baseQuestion + ' ' + f.qualifier,
        published(f.baseQuestion + ' ' + f.qualifier), { judge: permissiveJudge, band: 'adult' });
      ok('matching «للمسافر» permits the transfer path', both.transfer === true, both.reason);
      eq('known symmetric qualifiers cost no judge/model call', qualifierJudgeCalls,
        f.expected.judgeCallsForKnownQualifier);
      ok('the remaining judge question is itself symmetric',
        M.JUDGE_QUESTION.includes('أحد السؤالين') && !M.JUDGE_QUESTION.includes('الأوّلِ'),
        M.JUDGE_QUESTION);
    }

    // =========================================================================
    console.log('\n=== E. THE JUDGE IS DECISIVE, AND EVERY DOUBT REFUSES ===');
    {
      const B = 'ما حكم العقيقة عن المولود في اليوم السابع من ولادته';
      const A = B + ' في البيت';
      const page = { url: 'https://islamweb.net/ar/fatwa/1003/x', html: labelPage(B, BODY.repeat(3)) };
      const cmp = M.compareQuestions(A, B);
      ok('the pair really is inside the judge band',
        cmp.score >= M.JUDGE_BAND[0] && cmp.score < M.JUDGE_BAND[1], String(cmp.score));

      const yes = await I.considerTransfer(A, page, { judge: async () => 'نعم', band: 'adult' });
      ok('«نعم» refuses', yes.transfer === false && yes.reason === 'judge-refused');
      const no = await I.considerTransfer(A, page, { judge: async () => 'لا', band: 'adult' });
      ok('«لا» allows', no.transfer === true && no.reason === 'judge-allowed');
      const parserAllows = ['لا', ' لا ', '\n\tلا\r\n'];
      const parserRejects = [
        'نعم', 'لا بالتأكيد', 'الجواب لا', 'لا.', 'لَا', 'ﻻ', 'لـا',
        'لا\u200f', 'لا\nبالتأكيد', '{"answer":"لا"}', '```لا```', '', '   ',
        null, undefined, false, 0, ['لا'], { answer: 'لا' },
      ];
      ok('strict parser allows only exact «لا» with outer ECMAScript whitespace',
        parserAllows.every((reply) => M.judgeAllowsTransfer(reply) === true)
          && parserRejects.every((reply) => M.judgeAllowsTransfer(reply) === false));
      // AMBIGUITY IS A REFUSAL. None of these is an unambiguous «لا».
      for (const reply of ['لا، لأن أحدهما مقيد بالمكان', 'ربما', 'no', '', 'نعم في الجملة']) {
        const r = await I.considerTransfer(A, page, { judge: async () => reply, band: 'adult' });
        ok('an ambiguous reply refuses: ' + JSON.stringify(reply), r.transfer === false, r.reason);
      }
      // A JUDGE THAT THREW HAS NOT SAID NO.
      const threw = await I.considerTransfer(A, page,
        { judge: async () => { throw new Error('upstream 500'); }, band: 'adult' });
      ok('a judge that threw refuses', threw.transfer === false && threw.reason === 'judge-unavailable');
      // NO JUDGE AT ALL — a caller without one has not established anything.
      const none = await I.considerTransfer(A, page, { band: 'adult' });
      ok('no judge means no transfer', none.transfer === false && none.reason === 'judge-band-with-no-judge');
      // ...and the judge asks the SPECIFIC question, not «are these the same?»
      ok('the judge is asked about a fiqh qualifier, not about similarity',
        M.JUDGE_QUESTION.includes('قيدٌ فقهيٌّ'), M.JUDGE_QUESTION);
    }

    // =========================================================================
    console.log('\n=== E2. A3: TRANSFER ELIGIBILITY FOLLOWS THE ACTUAL AUDIENCE ===');
    {
      const f = A3_CASES.stage3;
      const pair = (x) => ({
        url: x.url,
        published: { question: x.question, answer: x.answer, domain: new URL(x.url).hostname.replace(/^www\./, '') },
      });
      const adult = await I.considerTransferPair(f.samePage.question, pair(f.samePage), { band: 'adult' });
      ok('the frozen page remains eligible for an adult', adult.transfer === true, adult.reason);
      // These are the real values emitted by deriveCaps(), not a synthetic "minor" alias. Testing
      // both kills the asymmetric mutant that rejects only an invented alias while allowing a real
      // child or teen band through to verbatim transfer.
      for (const minorBand of ['young', 'teen']) {
        const minor = await I.considerTransferPair(f.samePage.question,
          pair(f.samePage), { band: minorBand });
        ok('the same page is not automatically eligible for a ' + minorBand + ' reader',
          minor.transfer === false, minor.reason);
        const alukahMinor = await I.considerTransferPair(f.alukahMinor.question,
          pair(f.alukahMinor), { band: minorBand });
        ok('alukah /fatawa_counsels/ is not transferable to a ' + minorBand
          + ' reader merely because its path is a fatwa',
        alukahMinor.transfer === false, alukahMinor.reason);
      }
      const R = await esm('lib/retrieve.js');
      ok('alukah remains available to minor retrieval; only verbatim transfer is refused',
        R.SITES_MINOR.includes('alukah.net'));
      ok('api/ask passes the narrowed real band into the transfer decision',
        /considerTransferPair\(questionText,[\s\S]{0,180}\{ judge, band \}\)/.test(read('api/ask.js')));
    }

    // =========================================================================
    console.log('\n=== F. FIXTURE: THE ḤAMDALA IS CUT, BY A CLOSED LIST ===');
    {
      eq('a bare ḥamdala opening is removed',
        T.stripOpening(HAMDALA + ' ' + BODY).startsWith('العقيقة'), true);
      // FULLY VOCALISED is the same formula. The pages write it both ways.
      const voc = 'الحَمْدُ للهِ وَالصَّلاةُ وَالسَّلامُ عَلَى رَسُولِ اللهِ وَعَلَى آلِهِ وَصَحْبِهِ، أَمَّا بَعْدُ:';
      ok('...and so is the vocalised spelling', T.stripOpening(voc + ' ' + BODY).startsWith('العقيقة'),
        T.stripOpening(voc + ' ' + BODY).slice(0, 40));
      // A CLOSED LIST, NOT A HEURISTIC: a first sentence that merely praises God is NOT an opening.
      const real = 'الحمد لله الذي جعل العقيقة سنة، وهي شاة عن الأنثى.';
      eq('a first sentence that is part of the ANSWER is not cut', T.stripOpening(real), real);
      // NEVER RETURNS EMPTY.
      ok('a page whose whole body is the formula keeps its text',
        T.stripOpening(HAMDALA).length > 0);
    }

    // =========================================================================
    console.log('\n=== G. A3: LENGTH IS HARD AND STRUCTURE STAYS COHERENT ===');
    {
      // An āyah cut in half is a misquotation. A hadith cut in half can invert its meaning.
      //
      // THE FIXTURE IS THE MUSHAF'S OWN BYTES (2:43), read from quran-uthmani.json rather than
      // typed. MEASURED while writing this gate: a hand-typed «وَأَقِيمُوا الصَّلَاةَ …» in modern
      // orthography matched NOTHING — the Uthmani text writes «ٱلصَّلَوٰةَ» with a wāw, and
      // normalizeArabic folds diacritics and hamza forms but cannot turn a wāw into an alif. So
      // the check looked like it had failed when it was the fixture that was not Qur'an.
      const AYAH = require(path.join(REPO, 'quran-uthmani.json'))['2:43'];
      ok('the āyah fixture really is the mushaf text', typeof AYAH === 'string' && AYAH.length > 40);
      // The quotation SPANS the cut: it begins in the first paragraph and ends in the second.
      // SPLIT AT A WORD BOUNDARY. Cutting mid-word leaves two broken tokens that rejoin into
      // nothing, so lib/frozen-text.js would correctly report no run and the case would prove the
      // opposite of what it claims. The realistic shape is a quotation continuing across a break.
      const at = AYAH.indexOf(' ', Math.floor(AYAH.length / 2));
      const head = 'قال تعالى: ' + AYAH.slice(0, at);
      const tail = AYAH.slice(at + 1) + ' وهذا يدل على وجوب الصلاة.';
      const spanning = [head, tail, 'وسط. '.repeat(80), 'والله أعلم.'].join('\n\n');
      const t = T.trimToLength(spanning, 120);
      ok('a quotation that cannot fit whole is rejected instead of exceeding maxChars',
        t.rejected === true && t.text === '', JSON.stringify(t).slice(0, 200));

      const f = A3_CASES.stage4;
      const limit = f.maxChars;
      const atLimit = T.prepareTransfer(f.boundaryChar.repeat(limit), { maxChars: limit });
      const overLimit = T.prepareTransfer(f.boundaryChar.repeat(limit + 1), { maxChars: limit });
      const one = T.prepareTransfer(f.oneShort, { maxChars: limit });
      const two = T.prepareTransfer(f.twoParagraphs.join('\n\n'), { maxChars: limit });
      const three = T.prepareTransfer(f.threeParagraphs.join('\n\n'), { maxChars: limit });

      eq('one paragraph exactly at maxChars is preserved', atLimit.text.length, limit);
      ok('one indivisible paragraph over maxChars is rejected',
        overLimit.rejected === true && overLimit.text === '');
      ok('an ordinary short one-paragraph answer is unchanged',
        one.text === f.oneShort && one.truncated === false);
      ok('two paragraphs trim only at a forward boundary and report the truth',
        two.truncated === true && two.text.includes(f.twoParagraphs[0])
          && !two.text.includes(f.twoParagraphs[1]) && two.text.endsWith(T.TRUNCATION_TAIL),
        JSON.stringify(two));
      ok('three paragraphs never splice the first to the last across a missing middle',
        !(three.text.includes(f.threeParagraphs[0]) && !three.text.includes(f.threeParagraphs[1])
          && three.text.includes(f.threeParagraphs[2])), JSON.stringify(three));
      ok('the three-paragraph result is a truthful forward truncation',
        three.truncated === true && three.text.includes(f.threeParagraphs[0])
          && !three.text.includes(f.threeParagraphs[2]) && three.text.endsWith(T.TRUNCATION_TAIL),
        JSON.stringify(three));
      const successful = [atLimit, one, two, three].filter((x) => x && x.text);
      ok('every successful 1/2/3-paragraph result obeys maxChars',
        successful.every((x) => x.text.length <= limit),
        successful.map((x) => x.text.length).join(','));

      const tooLongPair = await I.considerTransferPair('ما حكم المسألة', {
        url: 'https://islamweb.net/ar/fatwa/a3-too-long',
        published: {
          question: 'ما حكم المسألة',
          answer: f.boundaryChar.repeat(limit + 1),
          domain: 'islamweb.net',
        },
      }, { band: 'adult', maxChars: limit });
      ok('an indivisible answer that cannot fit falls back to generation',
        tooLongPair.transfer === false, tooLongPair.reason);
    }

    // =========================================================================
    console.log('\n=== H. THE NEGATIVE WITNESS ===');
    // A gate that only proved transfers happen would pass while everything transferred.
    {
      const Q = 'ما حكم العقيقة عن المولود';
      // A different question entirely.
      const other = await I.considerTransfer('ما حكم صلاة الاستخارة', {
        url: 'https://islamweb.net/ar/fatwa/1004/x', html: labelPage(Q, BODY.repeat(3)),
      }, { judge: async () => 'لا', band: 'adult' });
      ok('an unrelated question does not transfer', other.transfer === false, other.reason);
      // A page that is not a Q&A page at all.
      const article = await I.considerTransfer(Q, {
        url: 'https://islamweb.net/ar/article/1/x',
        html: '<html><body><article><p>' + BODY.repeat(3) + '</p></article></body></html>',
      }, { band: 'adult' });
      ok('a page with no published question does not transfer', article.transfer === false, article.reason);
      // A page whose "answer" is a stub.
      const stub = await I.considerTransfer(Q, {
        url: 'https://islamweb.net/ar/fatwa/1005/x', html: labelPage(Q, 'قريبا.'),
      }, { band: 'adult' });
      ok('a page with a stub answer does not transfer', stub.transfer === false, stub.reason);
      // A host with no extractor.
      const off = await I.considerTransfer(Q, {
        url: 'https://example.org/x', html: labelPage(Q, BODY.repeat(3)),
      }, { band: 'adult' });
      ok('a host with no extractor does not transfer', off.transfer === false, off.reason);
      // ── alukah, AND THE ASSERTION THAT USED TO PROVE THE WRONG THING ──────
      //
      // This pair used to read «outside /fatawa_counsels/ it does not transfer» / «...and inside
      // it does» — and the second half PASSED against `labelPage()`, a page written by the author
      // of the extractor, printing «الإجابة». Measured 2026-08-08 on three real
      // /fatawa_counsels/ pages: alukah prints «الجواب» and never «الإجابة», so the reader
      // returned null on all three. The gate was proving a capability the host did not have,
      // which is W4 in one line of code.
      //
      // The host now DECLARES incapacity, so BOTH paths refuse — and the second one is asserted
      // against the real reason rather than a helpful fixture.
      const alukahArticle = await I.considerTransfer(Q, {
        url: 'https://alukah.net/sharia/0/1234/', html: labelPage(Q, BODY.repeat(3)),
      }, { band: 'adult' });
      ok('alukah outside /fatawa_counsels/ does not transfer', alukahArticle.transfer === false, alukahArticle.reason);
      const alukahFatwa = await I.considerTransfer(Q, {
        url: 'https://alukah.net/fatawa_counsels/0/1234/', html: labelPage(Q, BODY.repeat(3)),
      }, { band: 'adult' });
      ok('...and inside it does not transfer EITHER, because the host declares it cannot be read',
        alukahFatwa.transfer === false, alukahFatwa.reason);
      ok('...and an authored «الإجابة» page cannot talk it back into transferring',
        X.extractPair('https://alukah.net/fatawa_counsels/0/1234/', labelPage(Q, BODY.repeat(3))) === null,
        'a declared incapacity that a fixture can override is not a declaration');
    }

    // =========================================================================
    console.log('\n=== L. THE FROZEN REAL PAGES (ح٣ — شاهد W4) ===');
    //
    // ── WHY THIS SECTION EXISTS ────────────────────────────────────────────────
    // Sections C · D · F · G are all marked FIXTURE, and every one of their pages is built by
    // labelPage() — a page written by the author of the extractor, printing the exact label the
    // extractor looks for. They test the MATCHER and the TRIMMER honestly, and they tested the
    // EXTRACTOR against its own assumptions. That is how binbaz passed here for weeks while
    // returning null on every real page it was ever shown.
    //
    // These pages are not written by anybody here. They are the bytes eleven hosts served on
    // 2026-08-08, frozen under data/transfer-fixtures/ with a full SHA-256 in its manifest, and
    // marked binary in .gitattributes so no checkout can rewrite an ending and break the seal.
    //
    // WHAT A FROZEN PAGE CAN AND CANNOT PROVE. It proves the reader reads what the host really
    // published on the day it was frozen. It does NOT prove the host still serves that markup
    // today — a site can rewrite its templates overnight, and this gate would not notice. That
    // is the live witness (W5), it is a separate thing, and it is not claimed here.
    {
      const FIXDIR = 'data/transfer-fixtures';
      const manifest = JSON.parse(read(FIXDIR + '/manifest.json'));
      const a3 = A3_CASES;
      const crypto = require('crypto');
      const names = Object.keys(manifest.pages).sort();
      const page = (n) => fs.readFileSync(path.join(REPO, FIXDIR, n));

      // ── the seal ────────────────────────────────────────────────────────────
      ok('the manifest records how the pages were obtained',
        manifest.method === 'GET' && /EzikBot/.test(String(manifest.userAgent || '')),
        JSON.stringify({ method: manifest.method, ua: manifest.userAgent }));
      ok('every fixture carries a source URL, a fetch date and a full SHA-256',
        names.every((n) => {
          const p = manifest.pages[n];
          return p && /^https:\/\//.test(p.url) && /^\d{4}-\d{2}-\d{2}$/.test(p.fetchedAt) && /^[0-9a-f]{64}$/.test(p.sha256);
        }));
      // AND THE SHA-256 IS RECOMPUTED, not trusted. A header nobody checks is a header that drifts.
      let sealed = 0;
      for (const n of names) {
        const actual = crypto.createHash('sha256').update(page(n)).digest('hex');
        if (actual === manifest.pages[n].sha256) sealed++;
        else ok('SHA-256 of ' + n, false, 'manifest ' + manifest.pages[n].sha256 + ' · actual ' + actual);
      }
      ok('every frozen page still hashes to the full SHA-256 its manifest publishes',
        sealed === names.length, sealed + '/' + names.length);
      ok('...and there are pages from at least seven distinct hosts',
        new Set(names.map((n) => { try { return new URL(manifest.pages[n].url).hostname.replace(/^www\./, ''); } catch { return n; } })).size >= 7);

      const pairOf = (n) => X.extractPair(manifest.pages[n].url, page(n).toString('utf8'));

      // ── binbaz: the host this batch built a reader for ──────────────────────
      {
        const clean = pairOf('binbaz-3577.html');
        ok('binbaz: a real page yields a pair at all', !!clean,
          'byLabels returned null here on 5 of 5 real pages — «الجواب» is the label, not «الإجابة»');
        if (clean) {
          eq('...and the published question is the question, with its label removed',
            clean.question, 'الماء إذا نقص عن قلتين وخالطته النجاسة من بول أو عذرة، هل تذهب طهوريته بذلك؟');
          ok('...and the answer is the شيخ\'s answer', /قد اختلف العلماء في ذلك/.test(clean.answer));
          ok('...with its own «الجواب:» lead removed too', !/^الجواب/.test(clean.answer));
          // THE MENU IS THE POINT. This page carries a 1587-character topic tree; a reader that
          // took running text would have carried it into a child's answer.
          ok('...and NOT ONE WORD of the navigation tree came with it',
            !/العبادات الطهارة المياه الآنية/.test(clean.answer) && !/صوتيات/.test(clean.answer),
            clean.answer.slice(0, 160));
          // ...and the paragraph boundaries trim.js cuts by survived.
          ok('...and the block boundaries survived, because trim.js cuts by them',
            clean.answer.includes('\n\n'));
        }
        // The bare-text-node shape: a p/li sweep read SEVEN characters of this answer.
        const bare = pairOf('binbaz-21305.html');
        ok('binbaz: an answer living in a bare text node is read whole', !!bare && bare.answer.length > 400,
          bare ? String(bare.answer.length) : 'null');
        // The short-answer-plus-footnote shape.
        const foot = pairOf('binbaz-15222.html');
        ok('binbaz: a short answer beside a <section class=footnotes> is read', !!foot,
          'the footnote citation is a <p> and the answer is not — reading only <p> found the citation alone');
        if (foot) ok('...and it is the ANSWER, not the citation', /نعم إذا كانت المحظورات من جنس واحد/.test(foot.answer));

        const multiCase = a3.stage4.binBaz;
        const multi = pairOf(multiCase.file);
        ok('binbaz: the frozen multi-speaker page yields its complete published pair', !!multi);
        if (multi) {
          const prepared = T.prepareTransfer(multi.answer, { maxChars: multiCase.transferMaxChars });
          ok('...and its successful transfer obeys maxChars',
            !!prepared.text && prepared.text.length <= multiCase.transferMaxChars,
            String(prepared.text && prepared.text.length));
          const hasQuestionLead = prepared.text.includes(multiCase.questionLead);
          const hasAnswerLead = prepared.text.includes(multiCase.answerLead);
          ok('...and the ordinary boundary carries both speaker labels or neither',
            hasQuestionLead === hasAnswerLead, prepared.text.slice(-240));

          // Derive one genuine speaker round directly from the frozen Bin Baz bytes. A following
          // paragraph forces a length trim while the exact limit leaves room for the WHOLE round.
          // This makes the assertion non-vacuous: both labels must survive once, in order.
          const multiParas = multi.answer.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
          const questionAt = multiParas.findIndex((p) => p.startsWith(multiCase.questionLead));
          ok('...and the frozen page contains an adjacent presenter/scholar round',
            questionAt >= 0 && multiParas[questionAt + 1]
              && multiParas[questionAt + 1].startsWith(multiCase.answerLead));
          if (questionAt >= 0 && multiParas[questionAt + 1]) {
            const realRoundParas = multiParas.slice(questionAt, questionAt + 2);
            const realRound = realRoundParas.join('\n\n');
            const suffixChars = 2 + T.TRUNCATION_TAIL.length;
            const roundLimit = realRound.length + suffixChars;
            const forcedTrim = realRound + '\n\n' + a3.stage4.boundaryChar.repeat(200);
            const paired = T.prepareTransfer(forcedTrim, { maxChars: roundLimit });
            const pairedParas = paired.text.split(/\n\s*\n/);
            const qLabels = pairedParas.filter((p) => p.startsWith(multiCase.questionLead)).length;
            const aLabels = pairedParas.filter((p) => p.startsWith(multiCase.answerLead)).length;
            ok('...and a successful boundary keeps exactly one complete ordered speaker pair',
              paired.truncated === true && paired.text.length <= roundLimit
                && qLabels === 1 && aLabels === 1
                && paired.text.indexOf(multiCase.questionLead) < paired.text.indexOf(multiCase.answerLead)
                && paired.text.includes(realRoundParas[0]) && paired.text.includes(realRoundParas[1]),
            JSON.stringify({ length: paired.text.length, roundLimit, qLabels, aLabels }));

            // A paragraph-only mutant would keep the short presenter prompt here and strand it.
            // The product must reject the transfer because the paired scholar answer cannot fit.
            const orphanLimit = realRoundParas[0].length + suffixChars;
            const orphanDecision = await I.considerTransferPair(multi.question, {
              url: manifest.pages[multiCase.file].url,
              published: { ...multi, answer: realRound },
            }, { band: 'adult', maxChars: orphanLimit });
            ok('...and a boundary that fits only the presenter prompt rejects the transfer',
              orphanDecision.transfer === false
                && orphanDecision.reason === 'cannot-fit-coherent-transfer',
            orphanDecision.reason);
          }
          const tooTight = await I.considerTransferPair(multi.question, {
            url: manifest.pages[multiCase.file].url, published: multi,
          }, { band: 'adult', maxChars: multiCase.rejectMaxChars });
          ok('...and a limit that cannot hold a complete answer unit rejects transfer',
            tooTight.transfer === false, tooTight.reason);
        }
      }

      // ── THE ADVERSARIAL WITNESS: A PAGE WHERE THE GENERIC READER LIES ───────
      //
      // This is the one the directive asks for, and it is not hypothetical — it is the reader
      // this file shipped, on a page islamqa really served. The generic label reader returns a
      // NON-NULL pair here whose «answer» is the related-topics sidebar, because the only
      // «الإجابة» on the page is the feedback widget UNDER the answer.
      {
        const html = page('islamqa-508244.html').toString('utf8');
        const url = manifest.pages['islamqa-508244.html'].url;
        // What the page really answers with — present in the bytes, so the test is not vacuous.
        ok('the frozen islamqa page really does contain its answer',
          /فالمسلمون نواب عن النبي/.test(html));
        // The label the generic reader keys on is on the page — as FEEDBACK, not as a heading.
        // Measured wording: «هل انتفعت بهذه الإجابة؟», inside the evaluation form BELOW the answer.
        ok('...and the only «الإجابة» on it is the evaluation widget under the answer',
          /هل انتفعت بهذه الإجابة/.test(html));
        // AND THE HOST NOW REFUSES, so the lie cannot reach a reader.
        eq('the host declares it cannot be read, so nothing is extracted', pairOf('islamqa-508244.html'), null);
        // ...and the refusal is the DECLARED one, not an accident of this page.
        ok('...by declaration, not by this page happening to fail',
          X.EXTRACTORS['islamqa.info'].declaredIncapable === true);
        // A host-bounded reader must not fall back to labels on a foreign page. This frozen page
        // is the adversarial witness: its only «الإجابة» is the feedback widget below the answer.
        eq('the islamweb container reader refuses the adversarial foreign page',
          X.EXTRACTORS['islamweb.net'](require('linkedom').parseHTML(html).document, url), null);
      }

      // ── the two other declared incapacities, on real pages ──────────────────
      for (const [n, host] of [['alukah-183761.html', 'alukah.net'], ['ferkous-1438.html', 'ferkous.app']]) {
        const html = page(n).toString('utf8');
        ok(host + ': the real page prints «الجواب»', /الجواب/.test(html));
        ok('...and never «الإجابة»', !/الإجابة|الاجابة/.test(html),
          'this is the whole reason byLabels returned null on it');
        eq('...and the host declares it cannot be read', pairOf(n), null);
      }

      // ── the hosts that DO work, proven on real pages rather than on our own ──
      {
        const iwCase = a3.stage1.islamwebFooter;
        const iw = pairOf(iwCase.file);
        ok('islamweb: the label reader really does work on a real page', !!iw);
        if (iw) {
          ok('...and the answer is the fatwa', /آسية\s*: هي اسم امرأة فرعون/.test(iw.answer));
          eq('...and its valid 615-character question is preserved without a silent cut',
            iw.question.length, iwCase.questionChars);
          ok('...and the answer ends at the published fatwa', iw.answer.endsWith(iwCase.answerEndsWith),
            iw.answer.slice(-160));
          ok('...and footer, navigation and language chrome are absent',
            iwCase.forbidden.every((token) => !iw.answer.includes(token)), iw.answer.slice(-300));
          const trimmed = T.prepareTransfer(iw.answer, { maxChars: 2400 });
          // ITEM 106, reached through a TRUNCATOR rather than an anchor: prepareTransfer is the
          // thing being measured, and any return shape it does not have collapses to '' here.
          // The check below is `every(!includes)`, which an empty string satisfies for every
          // token at once -- so a prepareTransfer that returned nothing would report the
          // cleanest possible result. The text is now required to exist first.
          const trimmedText = typeof trimmed === 'string' ? trimmed : (trimmed && trimmed.text) || '';
          ok('...and transfer preparation returned text at all', trimmedText.length > 0,
            'prepareTransfer returned ' + typeof trimmed);
          ok('...and no forbidden chrome can reappear after transfer preparation',
            trimmedText.length > 0 && iwCase.forbidden.every((token) => !trimmedText.includes(token)),
            trimmedText.slice(-300));
        }
        const barCase = a3.stage1.shAlbarrakHtml;
        const bar = pairOf(barCase.file);
        ok('sh-albarrak: the __NEXT_DATA__ reader works on a real page', !!bar);
        if (bar) {
          ok('...and HTML artifacts are removed from both published fields',
            barCase.forbidden.every((token) => !bar.question.includes(token) && !bar.answer.includes(token)),
            JSON.stringify({ question: bar.question.slice(0, 120), answer: bar.answer.slice(0, 120) }));
          const reachable = await I.considerTransferPair(bar.question,
            { url: manifest.pages[barCase.file].url, published: bar }, { band: 'adult' });
          ok('...so the cleaned pair remains reachable by transfer', reachable.transfer === true,
            reachable.reason);
        }
        const almCase = a3.stage1.almoslehArtifact;
        const alm = pairOf(almCase.file);
        ok('almosleh: the LAST-label reader works on a real page', !!alm);
        if (alm) {
          ok('...and it did NOT harvest the submission form', !/حل المعادلة|1 \+ 1/.test(alm.question), alm.question.slice(0, 80));
          ok('...and the vocalised label residue is absent from question and answer',
            !alm.question.startsWith(almCase.forbiddenPrefix) && !alm.answer.startsWith(almCase.forbiddenPrefix),
            JSON.stringify({ question: alm.question.slice(0, 20), answer: alm.answer.slice(0, 20) }));
        }

        const longCase = a3.stage1.question615;
        const longHtml = page(longCase.file).toString('utf8');
        const longUrl = manifest.pages[longCase.file].url;
        const longPair = X.extractPair(longUrl, longHtml);
        ok('a valid 615-character question is preserved whole or the transfer pair is refused',
          longPair === null || longPair.question.length === longCase.expectedChars,
          longPair ? String(longPair.question.length) : 'refused');
        if (longPair) {
          const longDecision = await I.considerTransferPair(longPair.question,
            { url: longUrl, published: longPair }, { band: 'adult' });
          ok('...and an accepted 615-character pair transfers only with the complete question',
            longDecision.transfer === true && longDecision.question.length === longCase.expectedChars,
            JSON.stringify({ transfer: longDecision.transfer, chars: longDecision.question && longDecision.question.length }));
        }
      }

      // ── and the eighth domain, on a real page of its own ────────────────────
      eq('mostafaaladwy: a REAL video-answer page is still unreadable',
        pairOf('mostafaaladwy-106715.html'), null);
    }

    // =========================================================================
    console.log('\n=== I. THE MODEL IS OFF THE TRANSFER PATH ===');
    {
      const src = read('lib/transfer/trim.js') + read('lib/transfer/extract.js') + read('lib/transfer/match.js');
      ok('nothing on the transfer path calls a model', !/anthropic|max_tokens|messages\.create/i.test(src));
      ok('...and nothing fetches', !/globalThis\.fetch/.test(src));
      // The judge must arrive as a PARAMETER. Asserted on where it comes from, not on the absence
      // of the word: index.js legitimately imports buildJudgePrompt and judgeAllowsTransfer from
      // its own matcher, and a substring test on «judge» calls that a violation.
      const idx = read('lib/transfer/index.js');
      ok('the judge is destructured from deps, not imported',
        /const \{ judge = null[^}]*\} = deps;/.test(idx));
      ok('...and nothing on this path imports a vendor client',
        !/from '[^']*anthropic[^']*'/i.test(idx) && !/api\.anthropic\.com/.test(idx + src));
      ok('NOTHING in this gate reached the network', reached === 0, String(reached));
    }

    // =========================================================================
    console.log('\n=== K. DRIVEN: THE TRANSFER ACTUALLY REACHES THE READER ===');
    // Sections A–I prove the decision is correct. This proves it is CALLED, and that a transfer
    // REPLACES the generated answer rather than sitting beside it — which is the only way it
    // saves anything. Measured on the vendor-call count, because "the reply looks published" and
    // "no answer was generated" are different claims and only the second one is the feature.
    {
      const saved = {};
      for (const k of ['ANTHROPIC_API_KEY', 'BRAVE_API_KEY', 'FOUNDER_SECRET', 'RFC_V05_MODE', 'LEDGER_RAG',
        'VERCEL_ENV', 'SEARCH_BUDGET_GLOBAL_PREVIEW', 'SEARCH_BUDGET_PER_CALLER',
        'MODEL_STANDARD', 'MODEL', 'MODEL_FAST', 'MODEL_PREMIUM'])
        saved[k] = Object.prototype.hasOwnProperty.call(process.env, k) ? process.env[k] : undefined;
      process.env.ANTHROPIC_API_KEY = 'sk-ant-transfer-guard-fake';
      process.env.BRAVE_API_KEY = 'brave-transfer-guard-fake';
      process.env.RFC_V05_MODE = 'off';
      process.env.LEDGER_RAG = 'off';
      process.env.FOUNDER_SECRET = 'transfer-guard-driven-secret';
      process.env.VERCEL_ENV = 'preview';
      process.env.SEARCH_BUDGET_GLOBAL_PREVIEW = '40';
      process.env.SEARCH_BUDGET_PER_CALLER = '20';
      if (!MODEL_PROBE_EXPECTED) {
        process.env.MODEL_STANDARD = 'F028_STANDARD_SENTINEL';
        process.env.MODEL = 'F028_LEGACY_SENTINEL';
        process.env.MODEL_FAST = 'F028_FAST_SENTINEL';
        process.env.MODEL_PREMIUM = 'F028_PREMIUM_SENTINEL';
      }
      const throwingFetch = globalThis.fetch;
      try {
        const DC = await esm('lib/daycap.js');
        const CONSENT = await esm('lib/ai-consent.js');
        const STORE = await esm('lib/ledger/redis.js');
        let budgetUsed = 0;
        STORE.__setRedisForTest({
          async get() { return null; },
          async set() { return 'OK'; },
          async eval(_script, _keys, args) {
            if (budgetUsed >= Number(args[0])) return [budgetUsed, 0, 0, 1];
            if (budgetUsed >= Number(args[1])) return [budgetUsed, budgetUsed, 0, 2];
            budgetUsed += 1;
            return [budgetUsed, budgetUsed, 1, 0];
          },
        });
        const DEVICE = 'transfer-guard-device';
        const FOUNDER = DC.founderTokenFor(DEVICE);
        const PUBLISHED_Q = 'ما معنى حديث إنما الأعمال بالنيات';
        const HANDLER_BODY = 'يبين النص المنشور أن الحديث يتعلق بأثر النية في العمل، وأن المقصود يختلف باختلاف ما نواه صاحبه. ';
        const DEFAULT_URL = 'https://islamweb.net/ar/fatwa/1001/x';
        let vendor = 0, judgeCalls = 0, judgeRequest = null;
        const install = (config = {}) => {
          vendor = 0;
          judgeCalls = 0;
          judgeRequest = null;
          budgetUsed = 0;
          const publishedQuestion = config.publishedQuestion || PUBLISHED_Q;
          const pageUrl = config.pageUrl || DEFAULT_URL;
          const pageTitle = config.pageTitle || 'معنى حديث إنما الأعمال بالنيات';
          const pageAnswer = config.pageAnswer || (HAMDALA + ' ' + HANDLER_BODY.repeat(4));
          const page = labelPage(publishedQuestion, pageAnswer);
          const judgeOutcome = Object.prototype.hasOwnProperty.call(config, 'judgeOutcome')
            ? config.judgeOutcome
            : { stop_reason: 'end_turn', content: [{ type: 'text', text: 'لا' }] };
          globalThis.fetch = async (url, opts = {}) => {
            if (url === '/pipeline') return new Response('{}', { status: 500 });
            const u = String(url);
            if (u.includes('api.anthropic.com')) {
              vendor++;
              const b = JSON.parse(opts.body);
              if (b.max_tokens === 8) {
                judgeCalls++;
                judgeRequest = b;
                if (config.judgeThrows) throw new Error('judge fixture unavailable');
                return {
                  ok: true, status: 200, json: async () => judgeOutcome,
                  body: { getReader: () => ({ read: async () => ({ done: true }) }) }, text: async () => '',
                };
              }
              return {
                ok: true, status: 200,
                json: async () => (vendor === 1
                  ? { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'search_islamic_sources', input: { query: 'شرح حديث إنما الأعمال بالنيات' } }] }
                  : { stop_reason: 'end_turn', content: [{ type: 'text', text: 'مسوّدة مولَّدة.' }] }),
                body: { getReader: () => ({ read: async () => ({ done: true }) }) }, text: async () => '',
              };
            }
            if (u.includes('api.search.brave.com')) {
              return { ok: true, status: 200, text: async () => '', json: async () => ({ web: { results: [
                { title: pageTitle, url: pageUrl, description: publishedQuestion },
              ] } }) };
            }
            if (u === pageUrl) {
              return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => page, url: u };
            }
            throw new Error('unexpected transfer guard fetch: ' + u);
          };
        };
        const mkRes = () => {
          const r = {
            writes: [], statusCode: 0, headers: {}, ended: false,
            endCount: 0, writesAfterEnd: 0,
          };
          r.status = (c) => { r.statusCode = c; return r; };
          r.setHeader = (k, v) => { r.headers[k] = v; return r; };
          r.getHeader = (k) => r.headers[k];
          r.flushHeaders = () => {}; r.json = () => r;
          r.write = (s, encoding, callback) => {
            if (typeof encoding === 'function') callback = encoding;
            if (r.ended) r.writesAfterEnd++;
            r.writes.push(typeof s === 'string' ? s
              : Buffer.from(s.buffer || s, s.byteOffset || 0, s.byteLength || s.length).toString('utf8'));
            if (typeof callback === 'function') callback();
            return true;
          };
          r.end = (s, encoding, callback) => {
            if (typeof s === 'function') { callback = s; s = undefined; }
            else if (typeof encoding === 'function') callback = encoding;
            r.endCount++;
            if (s) r.write(s);
            r.ended = true;
            if (typeof callback === 'function') callback();
            return r;
          };
          r.on = () => r; r.once = () => r; r.removeListener = () => r; r.emit = () => r;
          return r;
        };
        const mkReq = (q, bodyOverrides = {}) => ({
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-ezik-ai-consent': CONSENT.AI_CONSENT_VERSION,
            'x-murabbi-device': DEVICE, 'x-murabbi-founder': FOUNDER },
          body: { name: 'خالد', age: 30, gender: 'male', mode: 'chat', band: 'adult',
            messages: [{ role: 'user', content: q }], ...bodyOverrides },
          socket: { remoteAddress: '127.0.0.1' }, on: () => {}, url: '/',
        });
        // Execute the exact handleEvent body shipped in index.html, not a test-only SSE parser.
        // ITEM 32: the parser ships in app.jsx now; index.html only loads the bundle built from it.
        const clientHandlerBody = (require('../tools/babel-block.cjs').readShippedClient('index.html').match(/const handleEvent = \(block\) => \{([\s\S]*?)\n      \};/) || [])[1];
        const clientVisibleFromRaw = clientHandlerBody && new Function('raw', `
          let full = '', streamError = null, onDelta = null;
          const handleEvent = (block) => {${clientHandlerBody}\n};
          let buffer = String(raw).replace(/\\r\\n/g, '\\n'), idx;
          while ((idx = buffer.indexOf('\\n\\n')) !== -1) { handleEvent(buffer.slice(0, idx)); buffer = buffer.slice(idx + 2); }
          if (buffer.trim()) handleEvent(buffer);
          return full;
        `);
        ok('endpoint assertions execute the handleEvent parser shipped in index.html',
          typeof clientVisibleFromRaw === 'function');
        const readerText = (r) => clientVisibleFromRaw(r.writes.join(''));
        const protocolEvents = (r) => r.writes.join('').replace(/\r\n/g, '\n').split('\n\n')
          .map((block) => block.split('\n').filter((line) => line.trim().startsWith('data:'))
            .map((line) => line.trim().slice(5).trim()).join(''))
          .filter(Boolean)
          .map((raw) => { try { return JSON.parse(raw); } catch { return null; } })
          .filter(Boolean);

        const handler = (await esm('api/ask.js')).default;

        // ── the reader types the published question verbatim ──────────────
        install();
        const res = mkRes();
        try { await handler(mkReq(PUBLISHED_Q), res); } catch (e) { /* a refusal is not a silence */ }
        const t = readerText(res);
        ok('the reader is given the PUBLISHED text', /الحديث يتعلق بأثر النية/.test(t), JSON.stringify(t).slice(0, 200));
        // THE FEATURE IS THE CALL THAT DID NOT HAPPEN. Round 1 decides to search; a transfer
        // means round 2 never runs, so exactly ONE vendor call is the whole saving.
        eq('...and NO answer was generated (round 2 never ran)', vendor, 1);
        ok('...with the ḥamdala stripped', !/الحمد لله/.test(t));
        ok('...carrying its OWN page as the card', /islamweb\.net/.test(t));

        // ── the same question with a flip word ────────────────────────────
        install();
        const res2 = mkRes();
        try { await handler(mkReq('ما معنى حديث إنما الأعمال بالنيات في معاملات الشركات'), res2); } catch (e) { /* ditto */ }
        const t2 = readerText(res2);
        ok('a flipped question does NOT get the published text', !/الحديث يتعلق بأثر النية/.test(t2));
        ok('...and is generated instead', vendor >= 2, String(vendor));
        eq('a non-transfer route makes zero transfer-judge calls', judgeCalls, 0);

        // ── F-028: conditional judge routing, envelope and publication ──────────
        const INJECTION_MARKERS = [
          'F028_QUESTION_INJECTION', 'F028_PAGE_INJECTION',
          'F028_TITLE_INJECTION', 'F028_URL_INJECTION',
        ];
        const SAFE_JUDGE_MARKER = 'F028_SAFE_JUDGE_LITERAL';
        const JUDGE_BASE = 'ما معنى حديث إنما الأعمال بالنيات في الأعمال اليومية المعتادة';
        const JUDGE_PUBLISHED_Q = JUDGE_BASE + ' ' + INJECTION_MARKERS[0];
        const JUDGE_READER_Q = JUDGE_BASE + ' في البيت ' + INJECTION_MARKERS[0];
        const JUDGE_URL = 'https://islamweb.net/ar/fatwa/1001/' + INJECTION_MARKERS[3];
        const JUDGE_ANSWER = SAFE_JUDGE_MARKER + ' ' + HANDLER_BODY.repeat(4)
          + ' ' + INJECTION_MARKERS[1];
        const validEnvelope = { stop_reason: 'end_turn', content: [{ type: 'text', text: 'لا' }] };
        const judgeCmp = M.compareQuestions(JUDGE_READER_Q, JUDGE_PUBLISHED_Q);
        ok('F-028 fixture traverses the real conditional judge band', judgeCmp.verdict === M.TRANSFER.JUDGE,
          JSON.stringify(judgeCmp));
        const runJudge = async (judgeOutcome, judgeThrows = false) => {
          install({
            publishedQuestion: JUDGE_PUBLISHED_Q,
            pageUrl: JUDGE_URL,
            pageTitle: INJECTION_MARKERS[2],
            pageAnswer: JUDGE_ANSWER,
            judgeOutcome,
            judgeThrows,
          });
          const out = mkRes();
          await handler(mkReq(JUDGE_READER_Q, {
            depth: 'scholar', model: 'F028_BODY_MODEL_ATTACK', premium: true, founder: true,
          }), out);
          return { text: readerText(out), vendor, judgeCalls, request: judgeRequest };
        };

        const allowed = await runJudge(validEnvelope);
        ok('exact «لا» in one end_turn text block publishes the safe literal marker',
          allowed.text.includes(SAFE_JUDGE_MARKER), allowed.text.slice(0, 240));
        ok('the conditional transfer spends one judge call and no generated-answer call',
          allowed.vendor === 2 && allowed.judgeCalls === 1,
          JSON.stringify({ vendor: allowed.vendor, judgeCalls: allowed.judgeCalls }));
        const expectedModel = MODEL_PROBE_EXPECTED || 'F028_STANDARD_SENTINEL';
        const modelPass = allowed.request && allowed.request.model === expectedModel
          && allowed.request.model !== process.env.MODEL_FAST
          && allowed.request.model !== process.env.MODEL_PREMIUM
          && allowed.request.model !== 'F028_BODY_MODEL_ATTACK';
        ok('the transfer judge uses only the server-controlled standard-model precedence',
          modelPass, JSON.stringify({ actual: allowed.request && allowed.request.model, expected: expectedModel }));
        const fixedSystem = allowed.request && allowed.request.system;
        ok('the transfer judge has a fixed top-level system boundary for the existing symmetric question',
          typeof fixedSystem === 'string' && fixedSystem.includes(M.JUDGE_QUESTION)
            && INJECTION_MARKERS.every((marker) => !fixedSystem.includes(marker))
            && JSON.stringify(allowed.request.messages).includes(INJECTION_MARKERS[0]));
        ok('the judge request keeps its one-word budget and disables streaming/thinking',
          allowed.request && allowed.request.max_tokens === 8 && allowed.request.stream === false
            && JSON.stringify(allowed.request.thinking) === JSON.stringify({ type: 'disabled' })
            && Object.keys(allowed.request).sort().join(',')
              === 'max_tokens,messages,model,stream,system,thinking');

        const invalidJudgeCases = [
          ['yes', { stop_reason: 'end_turn', content: [{ type: 'text', text: 'نعم' }] }, false],
          ['extra text', { stop_reason: 'end_turn', content: [{ type: 'text', text: 'لا بالتأكيد' }] }, false],
          ['surrounding words', { stop_reason: 'end_turn', content: [{ type: 'text', text: 'الجواب لا' }] }, false],
          ['empty', { stop_reason: 'end_turn', content: [{ type: 'text', text: '   ' }] }, false],
          ['JSON', { stop_reason: 'end_turn', content: [{ type: 'text', text: '{"answer":"لا"}' }] }, false],
          ['Markdown', { stop_reason: 'end_turn', content: [{ type: 'text', text: '```لا```' }] }, false],
          ['zero blocks', { stop_reason: 'end_turn', content: [] }, false],
          ['multiple blocks', { stop_reason: 'end_turn', content: [{ type: 'text', text: 'لا' }, { type: 'text', text: '' }] }, false],
          ['non-text block', { stop_reason: 'end_turn', content: [{ type: 'tool_use', text: 'لا' }] }, false],
          ['non-string text', { stop_reason: 'end_turn', content: [{ type: 'text', text: 7 }] }, false],
          ['malformed response', null, false],
          ['max_tokens stop', { stop_reason: 'max_tokens', content: [{ type: 'text', text: 'لا' }] }, false],
          ['missing stop', { content: [{ type: 'text', text: 'لا' }] }, false],
          ['other stop', { stop_reason: 'tool_use', content: [{ type: 'text', text: 'لا' }] }, false],
          ['provider exception', null, true],
        ];
        let comparisonSystem = null;
        for (const [name, outcome, throws] of invalidJudgeCases) {
          const rejected = await runJudge(outcome, throws);
          ok('F-028 rejects ' + name + ' without publishing the literal marker',
            !rejected.text.includes(SAFE_JUDGE_MARKER) && rejected.judgeCalls === 1,
            JSON.stringify({ published: rejected.text.includes(SAFE_JUDGE_MARKER), calls: rejected.judgeCalls }));
          if (!comparisonSystem && rejected.request) comparisonSystem = rejected.request.system;
        }
        ok('the top-level system is byte-identical across response fixtures',
          typeof fixedSystem === 'string' && comparisonSystem === fixedSystem);

        if (MODEL_PROBE_EXPECTED) {
          if (modelPass) console.log('F028_MODEL_PROBE=PASS:' + MODEL_PROBE_EXPECTED);
        } else {
          const modelCases = [
            ['MODEL_STANDARD wins', 'F028_CASE_STANDARD', 'F028_CASE_LEGACY', 'F028_CASE_STANDARD'],
            ['MODEL fallback wins', null, 'F028_CASE_LEGACY', 'F028_CASE_LEGACY'],
            ['local fallback wins', null, null, 'claude-sonnet-5'],
          ];
          for (const [name, standard, legacy, expected] of modelCases) {
            const childEnv = { ...process.env,
              F028_MODEL_PROBE_EXPECTED: expected,
              MODEL_FAST: 'F028_CASE_FAST', MODEL_PREMIUM: 'F028_CASE_PREMIUM' };
            if (standard === null) delete childEnv.MODEL_STANDARD;
            else childEnv.MODEL_STANDARD = standard;
            if (legacy === null) delete childEnv.MODEL;
            else childEnv.MODEL = legacy;
            const child = spawnSync(process.execPath, [__filename], {
              cwd: REPO, env: childEnv, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024,
            });
            ok('fresh-process precedence: ' + name,
              child.status === 0 && child.stdout.includes('F028_MODEL_PROBE=PASS:' + expected),
              JSON.stringify({ status: child.status, signal: child.signal,
                error: child.error && child.error.code, stderr: String(child.stderr || '').slice(-300) }));
          }
        }

        // ── A3 / F-203: real endpoint, local pages, shipped client parser ───────
        const stage5 = A3_CASES.stage5;
        const f5 = {
          unsupportedTakhrij: {
            ...stage5.unsupportedTakhrij,
            title: 'معنى حديث فضل الصدقة في السر',
            question: 'ما معنى حديث فضل الصدقة في السر؟',
            answer: HANDLER_BODY.repeat(5) + ' ' + stage5.unsupportedTakhrij.unsupportedPhrase + '.',
            visibleEvidence: ('ما معنى حديث فضل الصدقة في السر؟ ' + HANDLER_BODY).repeat(4),
            bodyNeedle: 'يبين النص المنشور أن الحديث يتعلق بأثر النية',
          },
          supportedTransfer: {
            ...stage5.supportedTransfer,
            title: 'معنى حديث إنما الأعمال بالنيات',
            question: 'ما معنى حديث إنما الأعمال بالنيات؟',
            answer: HANDLER_BODY.repeat(5),
            visibleEvidence: ('ما معنى حديث إنما الأعمال بالنيات؟ ' + HANDLER_BODY).repeat(4),
            bodyNeedle: 'يبين النص المنشور أن الحديث يتعلق بأثر النية',
          },
        };
        const nextPage = (fixture) => {
          const data = JSON.stringify({ props: { pageProps: { postContent: {
            question: '<p><strong>' + fixture.question + '</strong></p>',
            content: '<p>' + fixture.answer + '</p>',
          } } } }).replace(/</g, '\\u003c');
          return '<html><head><title>' + fixture.title + '</title></head><body>'
            + '<article><h1>' + fixture.title + '</h1><p>' + fixture.visibleEvidence + '</p></article>'
            + '<script id="__NEXT_DATA__" type="application/json">' + data + '</script>'
            + '</body></html>';
        };
        const installA3 = (fixture, { ledgerFailure = false } = {}) => {
          const counts = { model: 0, search: 0, page: 0, other: 0 };
          globalThis.fetch = async (url, opts = {}) => {
            const u = String(url);
            if (u.includes('api.anthropic.com')) {
              counts.model++;
              if (ledgerFailure) throw new Error('ledger fixture model unavailable');
              return {
                ok: true, status: 200, headers: { get: () => 'application/json' },
                json: async () => (counts.model === 1
                  ? { stop_reason: 'tool_use', content: [{
                    type: 'tool_use', id: 'a3-t1', name: 'search_islamic_sources',
                    input: { query: fixture.question },
                  }] }
                  : { content: [{ type: 'text', text: 'مسوّدة مولَّدة آمنة من fixture.' }] }),
                text: async () => '',
                body: { getReader: () => ({ read: async () => ({ done: true }) }) },
              };
            }
            if (u.includes('api.search.brave.com')) {
              counts.search++;
              return {
                ok: true, status: 200, text: async () => '',
                json: async () => ({ web: { results: [{
                  title: fixture.title, url: fixture.url, description: fixture.visibleEvidence.slice(0, 120),
                }] } }),
              };
            }
            if (u === fixture.url) {
              counts.page++;
              return {
                ok: true, status: 200, url: u,
                headers: { get: () => 'text/html; charset=utf-8' },
                text: async () => nextPage(fixture),
              };
            }
            counts.other++;
            return {
              ok: false, status: 503, headers: { get: () => 'application/json' },
              text: async () => '', json: async () => ({}),
            };
          };
          return counts;
        };
        const sourceCards = (text) => Array.from(String(text).matchAll(
          /<source site="([^"]+)" url="([^"]+)">[\s\S]*?<\/source>/g),
        ).map((m) => ({ site: m[1], url: m[2], tag: m[0], at: m.index }));
        const assertLifecycle = (name, response) => {
          const events = protocolEvents(response);
          const stops = events.filter((event) => event.type === 'message_stop');
          const stopAt = events.findIndex((event) => event.type === 'message_stop');
          ok(name + ': exactly one message_stop ends the protocol',
            stops.length === 1 && stopAt === events.length - 1,
            events.map((event) => event.type).join(','));
          ok(name + ': response ends once with no write after end',
            response.endCount === 1 && response.writesAfterEnd === 0,
            JSON.stringify({ endCount: response.endCount, writesAfterEnd: response.writesAfterEnd }));
          return events;
        };

        process.env.LEDGER_RAG = 'off';
        process.env.RFC_V05_MODE = 'off';
        const unsupportedCounts = installA3(f5.unsupportedTakhrij);
        const unsupportedRes = mkRes();
        await handler(mkReq(f5.unsupportedTakhrij.question), unsupportedRes);
        const unsupportedText = readerText(unsupportedRes);
        const unsupportedEvents = assertLifecycle('unsupported-takhrij transfer', unsupportedRes);
        const unsupportedCards = sourceCards(unsupportedText);
        ok('unsupported takhrij is removed while the safe transferred body remains',
          unsupportedText.includes(f5.unsupportedTakhrij.bodyNeedle)
            && !unsupportedText.includes(f5.unsupportedTakhrij.unsupportedPhrase),
          unsupportedText.slice(0, 400));
        ok('lock/finalizer runs before the first reader text byte',
          unsupportedEvents.filter((event) => event.type === 'content_block_delta')
            .every((event) => !String(event.delta && event.delta.text).includes(f5.unsupportedTakhrij.unsupportedPhrase))
            && !unsupportedRes.writes.join('').includes(f5.unsupportedTakhrij.unsupportedPhrase));
        const bodyAt = unsupportedText.indexOf(f5.unsupportedTakhrij.bodyNeedle);
        const cardAt = unsupportedText.indexOf('<source ');
        ok('the finalized supported body precedes the server-owned source card',
          bodyAt !== -1 && cardAt > bodyAt,
          JSON.stringify({ bodyAt, cardAt }));
        ok('the source card is server-owned, unique, and backed by the transfer page',
          unsupportedCards.length === 1
            && unsupportedCards[0].url === f5.unsupportedTakhrij.url
            && unsupportedCards[0].site === 'sh-albarrak.com',
          JSON.stringify(unsupportedCards));
        ok('the transfer never emits an orphan card',
          unsupportedCards.length === 1
            && unsupportedText.slice(0, unsupportedCards[0].at).trim().length > 0);
        ok('the legacy transfer costs only its fixture round, search and page fetch',
          unsupportedCounts.model === 1 && unsupportedCounts.search === 1 && unsupportedCounts.page === 1,
          JSON.stringify(unsupportedCounts));

        const supportedCounts = installA3(f5.supportedTransfer);
        const supportedRes = mkRes();
        await handler(mkReq(f5.supportedTransfer.question), supportedRes);
        const supportedText = readerText(supportedRes);
        assertLifecycle('supported transfer', supportedRes);
        const supportedCards = sourceCards(supportedText);
        ok('a supported transfer reaches the shipped client with its visible body',
          supportedText.includes(f5.supportedTransfer.bodyNeedle), supportedText.slice(0, 300));
        ok('...and carries exactly its own correct server card after the body',
          supportedCards.length === 1
            && supportedCards[0].site === f5.supportedTransfer.expectCardHost
            && supportedCards[0].url === f5.supportedTransfer.url
            && supportedCards[0].at > supportedText.indexOf(f5.supportedTransfer.bodyNeedle),
          JSON.stringify(supportedCards));
        ok('...without an extra model or retrieval call',
          supportedCounts.model === 1 && supportedCounts.search === 1 && supportedCounts.page === 1,
          JSON.stringify(supportedCounts));

        // The ledger owns its failure and closes safely; it must never re-enter the legacy
        // transfer block with the candidate page after a ledger model failure.
        process.env.LEDGER_RAG = 'on';
        process.env.RFC_V05_MODE = 'public';
        process.env.VERCEL_ENV = 'preview';
        process.env.SEARCH_BUDGET_GLOBAL_PREVIEW = '40';
        process.env.SEARCH_BUDGET_PER_CALLER = '20';
        const LF = await esm('lib/ledger/flag.js');
        LF.__resetFlagCacheForTest();
        const ledgerCounts = installA3(f5.supportedTransfer, { ledgerFailure: true });
        const ledgerRes = mkRes();
        await handler(mkReq(f5.supportedTransfer.question), ledgerRes);
        const ledgerText = readerText(ledgerRes);
        assertLifecycle('ledger safe failure', ledgerRes);
        ok('LEDGER_RAG=true never falls through to the unsafe transfer candidate',
          !!ledgerText.trim() && !ledgerText.includes(f5.supportedTransfer.bodyNeedle)
            && sourceCards(ledgerText).length === 0,
          ledgerText.slice(0, 300));
        ok('...and performs only Ledger\'s bounded search/page, with no second legacy pass',
          ledgerCounts.search === 1 && ledgerCounts.page === 1 && ledgerCounts.model <= 2,
          JSON.stringify(ledgerCounts));
      } finally {
        globalThis.fetch = throwingFetch;
        try { (await esm('lib/ledger/redis.js')).__resetRedis(); } catch {}
        for (const k of Object.keys(saved)) {
          if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
        }
      }
    }

    // =========================================================================
    console.log('\n=== J. THE ROSTER ===');
    {
      const gates = JSON.parse(read('gates.json'));
      ok('gates.json lists this guard',
        gates.some((g) => g && g.script === 'guards/transfer-mode-guard.cjs'));
      ok('.gitattributes pins it to LF',
        /guards\/transfer-mode-guard\.cjs text eol=lf/.test(read('.gitattributes')));
    }
  } finally {
    globalThis.fetch = realFetch;
  }

  console.log('\n' + (failures ? 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'
    : 'OK: ' + checks + '/' + checks + ' checks passed.'));
  process.exit(failures ? 1 : 0);
}()).catch((e) => { console.error('GUARD THREW:', e); process.exit(2); });
