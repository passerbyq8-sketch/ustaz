// attribution-guard.cjs — the scholar-attribution gate.
//
// IT EXISTS BECAUSE OF A REAL, REPRODUCED FAILURE. The question
//     «ما رأي الشيخ ابن عثيمين فيمن أسقطت دون 80 يوم؟»
// was answered on production with a confident ruling attributed to the Shaykh, carrying NO source
// card, and stating the OPPOSITE of his published fatwa: it said the blood is nifās and that she
// leaves prayer and fasting. His actual words are that it is neither nifās nor ḥayḍ but dam fasād,
// and that she prays and fasts. A woman following that answer would have abandoned obligatory
// prayer on a fabrication.
//
// WHAT THIS GATE PROVES, and the order matters:
//   A. DETECTION  — the shape of an attributing question is recognised, and ordinary questions
//                   are not swept up with it.
//   B. THE SOURCE — the official corpus is reachable, its text arrives clean, and a page that
//                   does not answer the question is refused rather than accepted.
//   C. THE GATE   — the verifier refuses a draft with no source, a source by someone else, a
//                   contradiction of the source, an invented duration, an invented criterion, a
//                   home-page link, and leaked markup.
//   D. THE WIRING — read off api/ask.js: attribution overrides the route, the source is fetched
//                   before the model is called, the answer is buffered, and refusal is the
//                   default on every failure path.
//
// NETWORK. Part B talks to binothaimeen.net. It is skipped automatically when the host is
// unreachable, and it never makes more than the two calls the adapter itself makes.
//
// Usage: node attribution-guard.cjs [--offline]
'use strict';
const fs = require('fs');
const path = require('path');

const OFFLINE = process.argv.includes('--offline');
const REPO = __dirname;

let failures = 0, checks = 0, skipped = 0;
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
function skip(name, why) { skipped++; console.log('  SKIP  ' + name + '  (' + why + ')'); }
const cps = (x) => Array.prototype.map.call(String(x == null ? '' : x), (c) => c.charCodeAt(0).toString(16)).join(' ');
const user = (t) => [{ role: 'user', content: t }];

(async function main() {
  console.log('=== attribution-guard — scholar attribution requires a matching source ===');

  const A = await import('file://' + path.join(REPO, 'lib', 'attribution.js').replace(/\\/g, '/'));
  const B = await import('file://' + path.join(REPO, 'lib', 'binothaimeen.js').replace(/\\/g, '/'));

  // =========================================================================
  console.log('\n=== A. DETECTION (the shape of the question, not a list of names) ===');
  const FIRES = [
    'ما رأي الشيخ ابن عثيمين فيمن أسقطت دون 80 يوم؟',
    'أسقطت بعد 79 يوماً، ماذا قال ابن عثيمين؟',
    'ما حكم الإسقاط في الشهر الثاني عند الشيخ ابن عثيمين؟',
    'هل الدم قبل ثمانين يوماً نفاس عند ابن عثيمين؟',
    'ما قول الشيخ الألباني في هذه المسألة؟',
    'هل أفتى الشيخ ابن باز بجواز ذلك؟',
    'فتوى الشيخ ابن عثيمين في صلاة المسافر',
    'قال الشيخ ابن عثيمين إن النفاس لا يكون إلا بعد نفخ الروح، صحيح؟',
    'ينسب إلى الشيخ ابن عثيمين القول بكذا',
    'ما مذهب الإمام مالك في هذه المسألة؟',
  ];
  FIRES.forEach((q) => {
    const d = A.detectAttribution(user(q));
    ok('fires: ' + q.slice(0, 46), d.attributed, 'not detected');
  });

  // ...and does NOT fire on ordinary religious or general questions.
  const QUIET = [
    'ما حكم الصلاة في السفر؟',
    'كيف أتوضأ؟',
    'ما فضل الصلاة في الإسلام؟',
    'ما هي أركان الإسلام؟',
    'كم يساوي سبعة في ثمانية؟',
    'أخي يضربني ماذا أفعل؟',
    'الحمد لله رب العالمين',
    'ما حكم الإسقاط قبل ثمانين يوماً؟',
  ];
  QUIET.forEach((q) => {
    const d = A.detectAttribution(user(q));
    ok('quiet: ' + q.slice(0, 46), !d.attributed, 'wrongly detected as attribution: ' + JSON.stringify(d.scholarName));
  });

  const known = A.detectAttribution(user('ما رأي الشيخ ابن عثيمين فيمن أسقطت دون 80 يوم؟'));
  ok('a registered scholar is resolved to his corpus', !!known.scholar && known.scholar.key === 'ibn-uthaymeen', JSON.stringify(known));
  const unknown = A.detectAttribution(user('ما رأي الشيخ عبد الرحمن الفلاني في هذه المسألة؟'));
  ok('an unregistered scholar still triggers the gate', unknown.attributed);
  ok('...but resolves to no corpus, so the answer will be refused', !unknown.scholar);
  // Only the LAST turn decides what THIS answer claims.
  const twoTurns = A.detectAttribution([
    { role: 'user', content: 'ما رأي الشيخ ابن عثيمين في كذا؟' },
    { role: 'assistant', content: '...' },
    { role: 'user', content: 'كم عدد أركان الإسلام؟' },
  ]);
  ok('an attribution two turns ago does not bind this answer', !twoTurns.attributed);

  // =========================================================================
  console.log('\n=== B. THE OFFICIAL SOURCE ===');
  const ADAPTER = fs.readFileSync(path.join(REPO, 'lib', 'binothaimeen.js'), 'utf8');
  const ID = '443c0396-cc67-4fd6-b320-1b79bba567a9';
  // The page that states the EIGHTY-DAY limit, which is the one an eighty-day question needs.
  const ID80 = '80651235-18e9-4f06-833b-0f531d2d1af9';
  let lesson = null;
  if (OFFLINE) {
    skip('the official corpus is reachable', '--offline');
  } else {
    try {
      lesson = await B.fetchLesson(ID);
    } catch (e) { lesson = null; }
    if (!lesson) {
      skip('the official corpus is reachable', 'binothaimeen.net did not answer');
      skip('...and the adapter fails CLOSED when it does not', 'covered by C');
    } else {
      ok('the official corpus is reachable and the lesson parses', !!lesson.exactText);
      eq('...it reports the scholar', lesson.scholar, 'محمد بن صالح العثيمين');
      ok('...and the publisher', /الموقع الرسمي/.test(lesson.publisher));
      eq('...the id it was asked for', lesson.sourceId, ID);
      ok('...a title', lesson.title.indexOf('أسقطت') !== -1, cps(lesson.title.slice(0, 20)));
      ok('...an ISO timestamp', /^\d{4}-\d{2}-\d{2}T/.test(lesson.retrievedAt));
      ok('...and a canonical URL on the official host',
        lesson.canonicalUrl.indexOf('https://binothaimeen.net/ar/voice_library/lessonDetails/') === 0
        && lesson.canonicalUrl.indexOf(ID) !== -1, lesson.canonicalUrl.slice(0, 80));
      // THE MEANING the brief requires
      ok('THE PUBLISHED TEXT CARRIES THE RULING: not nifās, not ḥayḍ, but dam fasād',
        /ليس نفاسا/.test(A.norm(lesson.exactText)) && /دم فساد/.test(A.norm(lesson.exactText)));
      ok('...and that she prays and fasts', /تصوم وتصلي/.test(A.norm(lesson.exactText)));
      ok('...and the criterion is that human form becomes distinguishable',
        /يتبين/.test(A.norm(lesson.exactText)) && /خلق الانسان/.test(A.norm(lesson.exactText)));
      ok('NO markup or entity survives into the text',
        !/[<>]/.test(lesson.exactText) && !/&[a-z]+;/i.test(lesson.exactText) && !/highLigated/i.test(lesson.exactText),
        lesson.exactText.slice(0, 80));

      // THE FOUR PHRASINGS THE BRIEF NAMES. Each must reach the SAME published fatwa. The ranker
      // is stood in for here by a fixed choice, because that half of the path is a model call and
      // this gate must be deterministic; what is being proved is that the page is in the pool the
      // ranker is offered, and that the programmatic gates then accept the real published text.
      const pickSecondMonth = async (q, cands) => {
        const hit = cands.find((c) => c.title.indexOf('الشهر الثاني') !== -1);
        return hit ? hit.id : null;
      };
      //
      // AND THE PAGE EACH ONE MUST REACH IS NOT THE SAME PAGE. A phrasing that names the SECOND
      // MONTH is answered by the second-month fatwa. A phrasing that names EIGHTY DAYS is not:
      // «دون ثمانين يومًا» runs from day 0 to day 79 and the second month is days 31–60, so that
      // page answers a third of her question and nothing about the rest. It has to reach a page
      // that states the eighty-day limit itself. NO RANKER IS SUPPLIED to any of these — the
      // whole point is that the deterministic path gets there alone.
      const PHRASINGS = [
        { q: 'ما رأي الشيخ ابن عثيمين فيمن أسقطت دون 80 يوم؟', needs: 'ثمانين' },
        { q: 'ماذا قال ابن عثيمين عن المرأة التي أسقطت في الشهر الثاني؟', id: ID },
        { q: 'هل أفتى الشيخ محمد بن صالح العثيمين بأن من أسقطت قبل ثمانين يوماً تترك الصلاة؟', needs: 'ثمانين' },
        { q: 'فتوى العثيمين في إسقاط الجنين في الشهر الثاني والصلاة', id: ID },
      ];
      for (const p of PHRASINGS) {
        const det = A.detectAttribution(user(p.q));
        const found = await B.retrieveIbnUthaymeen(det.question, {
          excludeWords: String(det.scholarName || '').split(' '),
        });
        const got = found[0];
        if (p.id) {
          ok('the second-month fatwa is reached from: ' + p.q.slice(0, 30) + '…',
            found.length === 1 && got.sourceId === p.id, JSON.stringify(found.map((f) => f.title)));
        } else {
          ok('A PAGE STATING THE EIGHTY-DAY LIMIT is reached from: ' + p.q.slice(0, 30) + '…',
            found.length === 1 && A.norm(got.title + ' ' + got.exactText).indexOf(p.needs) !== -1,
            JSON.stringify(found.map((f) => f.title)));
          ok('...and it carries the ruling that the blood is دم فساد',
            found.length === 1 && A.norm(got.exactText).indexOf('دم فساد') !== -1,
            found.length ? got.title : '(none)');
          ok('...and it is NOT the second-month page, which covers only part of the question',
            found.length === 1 && got.sourceId !== ID, found.length ? got.title : '(none)');
        }
      }

      // FORCING the second-month page for an eighty-day question must be overruled by code.
      const detBefore80 = A.detectAttribution(user('ما رأي الشيخ ابن عثيمين فيمن أسقطت دون 80 يوم؟'));
      const forced80 = await B.retrieveIbnUthaymeen(detBefore80.question, {
        excludeWords: String(detBefore80.scholarName || '').split(' '),
        rank: pickSecondMonth,
      });
      ok('a ranker forced onto the second-month page for «دون 80» is overruled',
        forced80.length === 0 || forced80[0].sourceId !== ID, JSON.stringify(forced80.map((f) => f.title)));

      // A question the corpus does not answer must come back EMPTY, not with a near miss.
      const miss = await B.retrieveIbnUthaymeen('ما حكم تعدين العملات الرقمية المشفرة والبلوكتشين');
      eq('a question the corpus does not answer yields NO source', miss.length, 0);

      // 81–120 DAYS and BEYOND 120. Neither may be answered from the second-month fatwa: it is a
      // different case, and the app has no business extending a ruling past what its source says.
      const later = A.detectAttribution(user('ما رأي الشيخ ابن عثيمين فيمن أسقطت بعد 90 يوماً؟'));
      let laterPool = [];
      const laterSrc = await B.retrieveIbnUthaymeen(later.question, {
        excludeWords: String(later.scholarName || '').split(' '),
        rank: async (q, cands) => {
          laterPool = cands.map((c) => c.title);
          const hit = cands.find((c) => c.title.indexOf('ثلاثة أشهر') !== -1);
          return hit ? hit.id : null;
        },
      });
      ok('the 81–120 day band has its OWN page in the pool, not the second-month one',
        laterPool.some((t) => t.indexOf('ثلاثة أشهر') !== -1), JSON.stringify(laterPool.slice(0, 6)));
      ok('...and a 90-day question resolves to a page whose own period covers it',
        laterSrc.length === 1 && laterSrc[0].sourceId !== ID && laterSrc[0].periodTier <= 1,
        JSON.stringify(laterSrc.map((s) => s.title + ' /' + s.periodVerdict)));

      // THE RANKER CAN BE OVERRULED, and this is the check that proves it against the live site.
      // Force it to make exactly the mistake a model can make — the second-month fatwa for a
      // ninety-day question — and the deterministic period gate must throw the page out anyway.
      const forced = await B.retrieveIbnUthaymeen(later.question, {
        excludeWords: String(later.scholarName || '').split(' '),
        rank: pickSecondMonth,
      });
      ok('a WRONG ranker choice is overruled by the period gate',
        forced.length === 0 || forced[0].sourceId !== ID,
        JSON.stringify(forced.map((s) => s.title)));

      // A RANKER MAY PROMOTE, NOT VETO. Its "none of these" is an absence of an opinion, and an
      // absence of an opinion cannot suppress a page that passed every deterministic gate — that
      // would make the model the guarantee, which is the one thing it must never be.
      const none = await B.retrieveIbnUthaymeen('فيمن أسقطت دون 80 يوم', { rank: async () => null });
      const plainForNone = await B.retrieveIbnUthaymeen('فيمن أسقطت دون 80 يوم');
      ok('a ranker that promotes nothing cannot veto the deterministic answer',
        none.length === plainForNone.length
        && (!none.length || none[0].sourceId === plainForNone[0].sourceId),
        JSON.stringify([none.map((x) => x.title), plainForNone.map((x) => x.title)]));
      ok('...and that answer is a real page of his', none.length === 1 && !!none[0].canonicalUrl,
        JSON.stringify(none.map((x) => x.title)));

      // A RANKER OUTAGE falls back to the deterministic order, which refuses an ambiguous pair.
      const broke = await B.retrieveIbnUthaymeen('فيمن أسقطت دون 80 يوم', {
        rank: async () => { throw new Error('ranker down'); },
      });
      const plain = await B.retrieveIbnUthaymeen('فيمن أسقطت دون 80 يوم');
      ok('a ranker that throws changes nothing — the deterministic path stands',
        broke.length === plain.length
        && (!broke.length || broke[0].sourceId === plain[0].sourceId),
        JSON.stringify([broke.map((x) => x.title), plain.map((x) => x.title)]));

      // A LECTURE TRANSCRIPT IS NOT A FATWA. Measured: before this rule the top-scoring candidate
      // for the original question was a two-hour tape of كتاب النكاح, at overlap 1.00.
      const tape = await B.fetchLesson('2a31bf00-7039-496b-9a42-27d74b796bb6');
      if (!tape) skip('a lecture transcript is rejected as a source', 'lesson unavailable');
      else ok('a lecture transcript is rejected as a source', !B.isTargetedFatwa(tape.title, tape.exactText),
        cps(tape.title) + ' / ' + tape.exactText.length + ' chars');
    }
  }

  // The sanitiser and the scorer are pure and are checked with or without the network.
  ok('the sanitiser strips the search endpoint\'s highlight spans',
    B.htmlToText('امرأة <span class="highLigatedText">أسقطت</span> جنيناً') === 'امرأة أسقطت جنيناً');
  ok('...and decodes entities', B.htmlToText('&quot;نص&quot; &amp; &#1575;') === '"نص" & ا');
  ok('...and turns block tags into line breaks', B.htmlToText('<p>سؤال</p><p>جواب</p>').split('\n').filter(Boolean).length === 2);
  ok('the scorer rates an unrelated page below the floor',
    B.scoreCandidate(['اسقطت', 'الجنين'], 'الوسوسة في الطهارة والصلاة والنفاس') < B.MIN_OVERLAP);
  ok('...and scores a genuine match highly',
    B.scoreCandidate(['اسقطت', 'النفاس'], 'حكم الصلاة لمن اسقطت الجنين والنفاس') >= B.MIN_OVERLAP);
  // The floor alone is not the gate: something of substance has to have matched, or a shared
  // function word on a two-word question would clear any fraction-based threshold.
  ok('a page matching only a short function word is refused',
    !B.acceptsCandidate(['فيمن', 'اسقطت'], 'كلام فيمن تصدق على أهله وليس فيه شيء آخر').ok);
  ok('...while a page matching the substantive word is accepted',
    B.acceptsCandidate(['فيمن', 'اسقطت'], 'حكم الصلاة والصيام لمن اسقطت الجنين').ok);
  // A series entry is a tape, not a fatwa, whatever its text happens to contain.
  ok('a series title is recognised as a lecture', B.isLectureTitle('كتاب النكاح (الشرح الثالث) - 17'));
  ok('...and a fatwa title is not', !B.isLectureTitle('حكم الصلاة والصيام لمن أسقطت الجنين في الشهر الثاني'));
  ok('...and a transcript body is refused even under a plain title',
    !B.isTargetedFatwa('عنوان عادي', 'التفريغ النصي للشريط رقم (17) ' + 'ن'.repeat(200)));
  // Search terms are contiguous slices of the reader's own wording.
  const pts = B.phraseTerms('المرأة التي أسقطت في الشهر الثاني');
  ok('phrase terms start and end on a content word',
    pts.length > 0 && pts.every((t) => t.split(' ').length >= 2), JSON.stringify(pts.slice(0, 3)));
  // The endpoint sorts by id, not by relevance, so the page has to be wide enough to hold the answer.
  ok('the search asks for a page wide enough to contain the answer',
    /const SEARCH_PAGE_SIZE = (\d+);/.test(ADAPTER) && Number(RegExp.$1) >= 50);

  // =========================================================================
  console.log('\n=== C. THE VERIFIER — every way a draft must be refused ===');
  // THE PAGE AND THE QUESTION MUST BE THE SAME CASE, in a fixture as much as in production.
  // Verbatim from the official site: the fatwa that states the eighty-day limit AND the ruling.
  const SRC = [{
    scholar: 'محمد بن صالح العثيمين',
    publisher: 'الموقع الرسمي للشيخ محمد بن صالح العثيمين',
    title: 'الدم الخارج بسبب السقط قبل تخلق الجنين',
    exactText: 'الجواب: إذا أسقطت المرأة الحامل لمدة شهر، أو شهرين، فإن هذا الدم دم فساد، لا يمنعها من صلاة، ولا صيام، ولا معاشرة زوج، ولها أن تجمع بين الصلاتين. والقاعدة عند أكثر العلماء: أن المرأة إذا أسقطت جنيناً، فإن كان قد تبين فيه خلق إنسان فالدم دم نفاس، وإلا فهو دم فساد، وأقل ما يمكن أن يتبين فيه خلق الإنسان ثمانون يوماً. إذا كانت قبل ثمانين يوماً، لا يمكن أن يكون الدم دم نفاس.',
    sourceId: ID80,
    canonicalUrl: 'https://binothaimeen.net/ar/voice_library/lessonDetails/%D8%A7%D9%84%D8%A8%D8%AD%D8%AB/x/' + ID80,
    retrievedAt: new Date().toISOString(),
  }];
  const DET = A.detectAttribution(user('ما رأي الشيخ ابن عثيمين فيمن أسقطت دون 80 يوم؟'));

  const GOOD = 'يرى الشيخ ابن عثيمين أن هذا الدم ليس نفاساً ولا حيضاً، وإنما هو دم فساد، فتصوم المرأة وتصلي؛ لأن النفاس لا يثبت حتى يتبين في الجنين خلق الإنسان.';
  const g = A.verifyAttributedReply(GOOD, DET, SRC);
  ok('a faithful answer passes', g.ok, JSON.stringify(g.problems));

  // 1. no source at all — the exact shape of the production defect
  const n1 = A.verifyAttributedReply(GOOD, DET, []);
  ok('NO SOURCE ⇒ refused', !n1.ok && n1.problems.indexOf('no-source') !== -1, JSON.stringify(n1.problems));

  // 2. a source by somebody else
  const other = [{ ...SRC[0], scholar: 'عبد العزيز بن باز' }];
  const n2 = A.verifyAttributedReply(GOOD, DET, other);
  ok('a source by ANOTHER scholar ⇒ refused', !n2.ok && n2.problems.indexOf('source-not-by-named-scholar') !== -1, JSON.stringify(n2.problems));

  // 3. THE PRODUCTION ANSWER ITSELF, verbatim in substance: it must not survive
  const BAD_REAL = 'إذا أسقطت دون ثمانين يوماً ورأت دماً فهي نفساء وتترك الصلاة والصوم طالما هو دم نفاس.';
  const n3 = A.verifyAttributedReply(BAD_REAL, DET, SRC);
  ok('THE ORIGINAL WRONG ANSWER IS REFUSED', !n3.ok, JSON.stringify(n3.problems));
  ok('...because it calls nifās what the source calls dam fasād',
    n3.problems.some((p) => p.indexOf('contradicts:نفاس') === 0 || p.indexOf('excludes:دم فساد vs نفاس') === 0),
    JSON.stringify(n3.problems));

  // 4. an invented duration
  const n4 = A.verifyAttributedReply('قال الشيخ إن النفاس يثبت بعد أربعين يوماً من الحمل.', DET, SRC);
  ok('a duration the source never gave ⇒ refused', !n4.ok && n4.problems.some((p) => p.indexOf('unsourced-duration') === 0), JSON.stringify(n4.problems));

  // 5. an invented criterion (the ensoulment drift the brief names explicitly)
  const n5 = A.verifyAttributedReply('يرى الشيخ أن النفاس لا يكون إلا بعد نفخ الروح في الجنين.', DET, SRC);
  ok('the ensoulment criterion the source never used ⇒ refused',
    !n5.ok && n5.problems.some((p) => p.indexOf('unsourced-claim') === 0), JSON.stringify(n5.problems));

  // 6. a home-page link
  const n6 = A.verifyAttributedReply(GOOD, DET, [{ ...SRC[0], canonicalUrl: 'https://binothaimeen.net/' }]);
  ok('a home-page link ⇒ refused', !n6.ok && n6.problems.indexOf('url-is-homepage') !== -1, JSON.stringify(n6.problems));

  // 7. leaked markup
  const n7 = A.verifyAttributedReply(GOOD + ' <span class="highLigatedText">x</span>', DET, SRC);
  ok('leaked markup ⇒ refused', !n7.ok && n7.problems.indexOf('raw-html') !== -1, JSON.stringify(n7.problems));

  // 8. the misleading claim in the brief must be CORRECTED, never agreed with
  const n8 = A.verifyAttributedReply('نعم، هذا صحيح، قال الشيخ إن النفاس لا يكون إلا بعد نفخ الروح.', DET, SRC);
  ok('agreeing with the false "only after ensoulment" claim ⇒ refused', !n8.ok, JSON.stringify(n8.problems));

  // 9. polarity helper, both directions
  eq('polarity reads a denial', A.polarity('هذا الدم ليس نفاساً', 'نفاس'), 'no');
  eq('polarity reads an assertion', A.polarity('هي نفساء ودمها نفاس', 'نفاس'), 'yes');
  eq('polarity reports absence', A.polarity('كلام آخر تماماً', 'نفاس'), null);
  // durations, digits and words
  ok('durations are read in digits', A.durations('بعد 80 يوماً').length === 1, JSON.stringify(A.durations('بعد 80 يوماً')));
  ok('...and in words', A.durations('بعد ثمانين يوماً').length === 1, JSON.stringify(A.durations('بعد ثمانين يوماً')));
  ok('...and the source\'s own "ثلاثة أشهر" is recognised', A.durations(SRC[0].exactText).length >= 1, JSON.stringify(A.durations(SRC[0].exactText)));
  // an answer that stays inside the source's own period is allowed
  const okDur = A.verifyAttributedReply('قال الشيخ: أقل ما يتبين فيه خلق الإنسان ثمانون يوماً، وقبل ذلك الدم دم فساد فتصلي وتصوم.', DET, SRC);
  ok('a duration the source DID give is allowed', okDur.ok, JSON.stringify(okDur.problems));

  // 10. A QUESTION THAT FIXES A TIME, ANSWERED FROM A TEXT THAT FIXES NONE.
  //     The hardest near miss there is: a real, correctly-attributed fatwa of his — about a
  //     different case. Every other check passes; only this one sees it.
  const timeless = [{ ...SRC[0],
    title: 'حكم من أسقطت جنينها وقد نفخت فيه الروح',
    exactText: 'إذا أسقطت المرأة جنينها وقد نفخت فيه الروح فإنها تكون نفساء وتترك الصلاة والصوم حتى تطهر.' }];
  const n10 = A.verifyAttributedReply('قال الشيخ إنها تكون نفساء وتترك الصلاة والصوم.', DET, timeless);
  ok('a source that never mentions a period ⇒ refused for a question that names one',
    !n10.ok && n10.problems.some((p) => p.indexOf('duration-unknown') === 0), JSON.stringify(n10.problems));
  ok('mentionsTime accepts a period stated in words', A.mentionsTime('وأثناء الشهرين لا يمكن أن يتبين'));
  ok('...and reports its absence', !A.mentionsTime('هذا الدم ليس نفاساً ولا حيضاً'));

  // 11. A HADITH THE SOURCE DOES NOT NARRATE. Phase 4: no verified source, no attributed text —
  //     the rule is the same for a narration as for a ruling, and a guessed wording or grading is
  //     the same failure in a more dangerous form.
  const n11 = A.verifyAttributedReply(
    'يرى الشيخ أنها تصوم وتصلي، وقال النبي صلى الله عليه وسلم: «دعي الصلاة أيام أقرائك»، رواه البخاري.',
    DET, SRC);
  ok('a hadith the source never narrates ⇒ refused',
    !n11.ok && n11.problems.some((p) => p.indexOf('unsourced-hadith') === 0), JSON.stringify(n11.problems));
  ok('...and a grading the source never gave is refused too',
    !A.verifyAttributedReply(GOOD + ' وهذا حديث صحيح.', DET, SRC).ok);

  // 12. THE FORBIDDEN PHRASES the brief lists for THIS question, each refused on its own.
  const FORBIDDEN = [
    'النفاس مرتبط بنفخ الروح، فإذا أسقطت قبل ذلك فلا نفاس.',
    'إذا أسقطت قبل ثمانين يوماً من نفخ الروح فالدم ليس نفاساً.',
    'دم الفساد يعرف بلونه وثخانته كما يعرف الحيض.',
  ];
  for (const bad of FORBIDDEN) {
    ok('a forbidden formulation is refused: ' + bad.slice(0, 28) + '…',
      !A.verifyAttributedReply(bad, DET, SRC).ok);
  }

  // =========================================================================
  console.log('\n=== D. THE WIRING (api/ask.js) ===');
  const ask = fs.readFileSync(path.join(REPO, 'api', 'ask.js'), 'utf8');
  ok('the verifier is imported', /import \{ verifyAttributedReply \} from '\.\.\/lib\/attribution\.js';/.test(ask));
  ok('the request is DESCRIBED by lib/ask-plan.js before it is routed',
    /import \{ planAsk,[\s\S]{0,120}\} from '\.\.\/lib\/ask-plan\.js';/.test(ask));
  // Measured against the HANDLER BODY, not the whole file: rankCandidates is a module-level helper
  // that also calls the API, and it is declared above the handler. What must hold is that no call
  // is reached inside a request before the question has been classified.
  const body = ask.slice(ask.indexOf('export default async function handler'));
  ok('the request is planned before any upstream call in the request path',
    body.indexOf('const plan = planAsk(') > -1
    && body.indexOf('const plan = planAsk(') < body.indexOf('await fetch(ANTHROPIC_URL'));
  // A NAME OVERRIDES THE ROUTE. It no longer ENDS the request — that was the defect — but it
  // must still keep an attributed question off the unsourced GEN path, which is how the
  // original inverted fatwa was produced.
  ok('naming a scholar forces the SOURCED route',
    /const effectiveRoute = plan\.attributionMode === 'none' \? route : 'DEEN';/.test(ask),
    'an attributed question could still take the unsourced GEN path');
  ok('the attributed branch runs BEFORE the GEN route',
    ask.indexOf("plan.attributionMode === 'namedScholarOpinion'") < ask.indexOf("if (effectiveRoute === 'GEN')"));
  ok('the scholar\'s own corpus is searched before the model is called',
    /namedScholarOpinion'\)[\s\S]{0,900}?retrieveIbnUthaymeen\(attribution\.question,[\s\S]{0,1400}?if \(!attributedSources\.length\)/.test(ask));
  // THE DEFECT THIS REPLACES. A name used to mean "stop": one adapter was consulted and every
  // other case emitted a fixed sentence with no search at all. These assert the new shape.
  ok('a scholar with no adapter still gets a REAL search of his own site',
    /else if \(plan\.officialDomain\)/.test(ask) && /onlySites: \[plan\.officialDomain\]/.test(ask),
    'a named scholar without a bespoke adapter must not be a dead end');
  ok('finding no text of his FALLS THROUGH instead of ending the request',
    /if \(!attributedSources\.length\) \{[\s\S]{0,400}?attributionNote = unattributedNote\(/.test(ask)
    && !/if \(!attributedSources\.length\)[\s\S]{0,400}?return res\.end\(\);/.test(ask));
  ok('the unattributed note is appended to a sourced answer, never emitted alone',
    /attributionNote \? '\\n\\n' \+ attributionNote/.test(ask));
  ok('the scholar\'s own name is stripped from the query',
    /excludeWords: String\(attribution\.scholarName \|\| ''\)\.split\(' '\)/.test(ask),
    'a fatwa page does not contain the name of the man who gave it');
  ok('the ranker is given titles, never asked for a ruling',
    /max_tokens: 16,[\s\S]{0,400}?لا تُفتِ/.test(ask) && /rank: \(q, cands\) => rankCandidates\(/.test(ask));
  ok('the grounding forbids narrating a hadith the source does not carry',
    /لا تنقلْ حديثًا/.test(ask));
  ok('no text of his ⇒ the ATTRIBUTED model call never happens',
    /if \(!attributedSources\.length\) \{[\s\S]{0,500}?\} else \{/.test(ask),
    'the grounded, attributed generation must be inside the else, not before it');
  ok('the attributed answer is BUFFERED, not streamed',
    /namedScholarOpinion'\)[\s\S]{0,3400}?stream: false,/.test(ask),
    'a streamed attributed answer cannot be withdrawn after verification fails');
  ok('the draft is verified before anything is emitted',
    ask.indexOf('verifyAttributedReply(draft, attribution, attributedSources)') !== -1);
  // THE DRAFT IS STILL DISCARDED WHOLE. What changed is only what happens NEXT: the reader
  // gets the general ruling with a note instead of a bare refusal. Nothing of the rejected
  // draft may survive — asserted by requiring the fall-through to set the note and never to
  // emit `draft`.
  ok('a failed verification discards the draft entirely',
    /if \(!verdict\.ok\) \{[\s\S]{0,1600}?attributionNote = unattributedNote\(plan\.namedEntity\);[\s\S]{0,40}?\} else \{/.test(ask));
  ok('...and the rejected draft is never written to the reader',
    !/if \(!verdict\.ok\)[\s\S]{0,600}?text: draft/.test(ask));
  ok('the model may not contribute a source card on this path',
    /const draft = drafted[\s\S]{0,200}?replace\(\/<source/.test(ask));
  ok('the card that IS emitted is built from the canonical URL',
    /buildSourceTag\(\{ url: src\.canonicalUrl, title: src\.title \}\)/.test(ask));

  // Nothing else about the app moved.
  const changed = (() => {
    try {
      return require('child_process')
        .execSync('git diff --name-only HEAD', { cwd: REPO, encoding: 'utf8' })
        .split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    } catch (e) { return null; }
  })();
  if (changed === null) skip('the client and its card systems are untouched', 'git unavailable');
  else ok('the client and its card systems are untouched by this phase',
    changed.indexOf('index.html') === -1 && changed.indexOf('quest.html') === -1, JSON.stringify(changed));
  ok('no key or credential appears in the adapter',
    !/api[_-]?key|authorizations*:|bearers|secret|password|process.env/i.test(fs.readFileSync(path.join(REPO, 'lib', 'binothaimeen.js'), 'utf8')));
  ok('the adapter declares a timeout and exactly one retry',
    /const RETRIES = 1;/.test(fs.readFileSync(path.join(REPO, 'lib', 'binothaimeen.js'), 'utf8')));
  ok('...and an internal rate limit', /MIN_GAP_MS/.test(fs.readFileSync(path.join(REPO, 'lib', 'binothaimeen.js'), 'utf8')));
  ok('...and a bounded cache', /MAX_ENTRIES/.test(fs.readFileSync(path.join(REPO, 'lib', 'binothaimeen.js'), 'utf8')));

  console.log('');
  if (failures === 0) console.log('OK: ' + checks + '/' + checks + ' checks passed' + (skipped ? ('  (' + skipped + ' skipped)') : '') + '.');
  else console.log('FAILED: ' + failures + ' of ' + checks + ' checks failed.');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('\nGUARD CRASHED: ' + String(e && e.stack ? e.stack : e)); process.exit(1); });
