// guards/live-number-source-guard.cjs
// NO LIVE NUMBER REACHES THE READER WITHOUT A SOURCE AND A DATE BESIDE IT.
//
// ── THE RULE THIS GATE ENFORCES, IN THE OWNER'S WORDS ────────────────────────
// «لا رقمَ حيٌّ ولا خبرٌ حيٌّ يُطبَعُ بلا مصدرٍ وتاريخٍ ظاهرَينِ للقارئ» — and the mechanism he
// chose: «حارسٌ على المخرجِ لا تعليمةٌ للنموذج. التعليمةُ رجاءٌ والحارسُ قفل.»
//
// ── WHY GREPPING THE INSTRUCTION WOULD PROVE NOTHING ─────────────────────────
// api/ask.js already ASKS the model for a source and a date on every open-search answer, and has
// since that path shipped. The measured production answer to «كم سعر صرف الدولار مقابل الدينار؟»
// carried neither. So this gate does not check that the request exists; it DRIVES the enforcement
// — lib/live-number-source.js — over real answer shapes and reads what comes out.
//
// ── AND IT CHECKS THE OTHER DIRECTION JUST AS HARD ───────────────────────────
// A deleter is easy to write and easy to make too eager, and an over-eager one silently empties
// good answers. Half the cases below are sentences that must SURVIVE untouched: settled facts,
// ordinary numbers, prose containing the ordinary word «اليوم». Two of them are regressions this
// module actually shipped and had fixed — a decimal point read as a full stop, which truncated a
// rate mid-number, and «طن» matched inside «المنطقة».
//
// Usage: node guards/live-number-source-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));

let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want),
  'got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want));

// The pages a live answer is built from. The vocabulary a sentence may name comes from HERE and
// from nowhere static — a source that was not retrieved is not a source the answer may claim.
const SOURCES = [
  { host: 'cbk.gov.kw', title: 'بنك الكويت المركزي: أسعار صرف العملات العالمية' },
  { host: 'aljazeera.net', title: 'الجزيرة نت' },
];

// KEPT — every one of these must survive byte for byte.
const KEEP = [
  ['a source and a date beside the rate',
    'بحسب بنك الكويت المركزي بتاريخ 2026-09-19، بلغ سعر صرف الدولار 307.350 فلسًا.'],
  ['a percentage with a named month and a named site',
    'ارتفع المؤشر 0.11% يوم 17 سبتمبر 2026 بحسب الجزيرة نت.'],
  ['Arabic-Indic digits are read the same way',
    'بحسب الجزيرة نت في ١٩ سبتمبر ٢٠٢٦، بلغ سعر البرميل ٧٢ دولارًا.'],
  ['an event with an absolute date',
    'اندلع الحريق يوم 18 سبتمبر 2026 في المنطقة الصناعية.'],
  // ── the false positives, each one measured ────────────────────────────────
  ['a settled fact containing the ordinary word «اليوم»',
    'الصلاة خمس صلوات في اليوم والليلة.'],
  ['a settled fact with no number at all',
    'عاصمة الكويت هي مدينة الكويت.'],
  ['«طن» inside «المنطقة» is not a unit — it was, and it deleted this sentence',
    'اندلع حريق في المنطقة الصناعية والتهم 3 مصانع.'],
  ['a counted noun is not a moving quantity',
    'للمسألة ثلاثة أوجه عند أهل العلم.'],
  ['a dated site name with no attribution frame at all still counts as attributed',
    'نشرت cbk.gov.kw جدول 2026-09-19 وفيه سعر الدولار 307.350 فلسًا.'],
];

// DELETED — every one must be removed, with the reason named.
const DROP = [
  ['a rate with neither source nor date', 'live-number-without-source-or-date',
    'سعر صرف الدولار الأمريكي مقابل الدينار الكويتي هو 307.350 فلسًا للوحدة.'],
  ['a rate with a source and no date', 'live-number-without-date',
    'بحسب بنك الكويت المركزي، بلغ سعر صرف الدولار 307.350 فلسًا.'],
  ['a rate with a date and no source', 'live-number-without-source',
    'في 19 سبتمبر 2026 بلغ سعر صرف الدولار 307.350 فلسًا.'],
  ['a temperature with neither', 'live-number-without-source-or-date',
    'درجة الحرارة في الكويت اليوم 42 درجة مئوية.'],
  ['«أمس» with no absolute date', 'relative-date-without-absolute',
    'اندلع الحريق أمس في المنطقة الصناعية.'],
  ['«هذا الأسبوع» with no absolute date', 'relative-date-without-absolute',
    'هذا الأسبوع ارتفعت أسعار النفط.'],
  ['«منذ يومين» with no absolute date', 'relative-date-without-absolute',
    'وقّع الطرفان الاتفاق منذ يومين.'],
];

(async function main() {
  console.log('=== live-number-source-guard — a live number carries a source and a date, or goes ===');

  const M = await esm('lib/live-number-source.js');
  const run = (t) => M.enforceLiveNumberSourcing(t, { sources: SOURCES });

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== A. the module exists and says what it did ===');
  // ══════════════════════════════════════════════════════════════════════════
  ok('lib/live-number-source.js exports enforceLiveNumberSourcing',
    typeof M.enforceLiveNumberSourcing === 'function');
  for (const sym of ['carriesLiveNumber', 'carriesAbsoluteDate', 'carriesRelativeDate', 'carriesSource',
    'offersExternalService', 'introducesWhatFollows', 'isCardLine']) {
    ok('...and exports ' + sym + ', so each half can be tested on its own', typeof M[sym] === 'function');
  }
  {
    const r = run('');
    ok('an empty draft is returned untouched and is NOT reported as emptied',
      r.text === '' && r.removed.length === 0 && r.emptied === false,
      JSON.stringify(r));
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== B. what must survive ===');
  // ══════════════════════════════════════════════════════════════════════════
  for (const [name, sentence] of KEEP) {
    const r = run(sentence);
    ok(name, r.text.trim() === sentence.trim() && r.removed.length === 0 && !r.emptied,
      'removed=' + JSON.stringify(r.removed) + '\n        text=' + JSON.stringify(r.text));
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== C. what must go, and for the stated reason ===');
  // ══════════════════════════════════════════════════════════════════════════
  for (const [name, why, sentence] of DROP) {
    const r = run(sentence);
    ok(name, r.emptied && r.removed.length === 1 && r.removed[0].why === why,
      JSON.stringify({ emptied: r.emptied, removed: r.removed, text: r.text }));
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== D. THE NUMBER IS NEVER TRUNCATED — the decimal-point regression ===');
  // ══════════════════════════════════════════════════════════════════════════
  //
  // THE MEASURED DEFECT, in this module's own first version: sentences were split on «.», so
  // «307.350» became two sentences. The first half was kept and the second deleted, and the
  // reader was shown «307.» — the enforcement CREATED a wrong number, which is the precise harm
  // it exists to prevent. A rule that can corrupt a figure is more dangerous than no rule.
  {
    const dated = 'بحسب بنك الكويت المركزي بتاريخ 2026-09-19، بلغ سعر صرف الدولار 307.350 فلسًا.';
    const r = run(dated);
    ok('a decimal point does not end a sentence', r.text.includes('307.350'), JSON.stringify(r.text));
    const bare = 'بلغ سعر صرف الدولار 307.350 فلسًا.';
    const r2 = run(bare);
    ok('...and when the sentence IS deleted, no fragment of the number survives',
      !r2.text.includes('307') && !r2.text.includes('350'), JSON.stringify(r2.text));
    const numericDate = 'بحسب الجزيرة نت في 19.09.2026 ارتفع سعر البرميل إلى 72 دولارًا.';
    ok('a dotted numeric date is a date, not three sentences',
      run(numericDate).removed.length === 0, JSON.stringify(run(numericDate)));
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== E. the unit of removal is the SENTENCE, not the answer ===');
  // ══════════════════════════════════════════════════════════════════════════
  {
    const para = 'بحسب الجزيرة نت في 18 سبتمبر 2026، ارتفعت أسعار النفط. وبلغ سعر البرميل 72 دولارًا. والكويت عضو في أوبك.';
    const r = run(para);
    ok('the sourced sentence survives', r.text.includes('ارتفعت أسعار النفط'));
    ok('...the unsourced one does not', !r.text.includes('72'));
    ok('...and the innocent one is untouched', r.text.includes('والكويت عضو في أوبك'));
    ok('...and the answer is not reported as emptied', r.emptied === false);
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== F. when nothing survives, the SERVER\'S existing sentence speaks ===');
  // ══════════════════════════════════════════════════════════════════════════
  //
  // «تُستعمَلُ العبارةُ الخادميّةُ القائمةُ… ولا تُؤلَّفُ عبارةٌ ثانيةٌ تنافسُها». So this module must
  // not contain a «لم أجد» wording of its own, and the handler must reach for the one that
  // already exists. Two sentences saying the same thing is how they come to say different things.
  {
    // CODE ONLY. The header of that module explains WHY it writes no such sentence, and quotes
    // the words it does not write; a check that could not tell a comment from a string literal
    // would fail on the explanation and pass on the offence.
    const src = read('lib/live-number-source.js').replace(/^\s*\/\/.*$/gm, '');
    ok('the enforcement composes NO reader-facing sentence of its own',
      !/لم\s+أعثر|لم\s+أجد|لا\s+أستطيع|عذرا/.test(src),
      'the one «لم أجد» line lives in lib/policy/live-search-disclosure.js');
    const ASK = read('api/ask.js');
    ok('...and the handler answers an emptied draft with that one line',
      /if \(printed\.emptied\) \{[\s\S]{0,200}liveSearchNotice\(\{ worldWanted: true, answeredFromLive: false \}\)/.test(ASK));
    const DISC = await esm('lib/policy/live-search-disclosure.js');
    ok('...which is still the server-owned constant it has always been',
      typeof DISC.NO_LIVE_RESULTS_DISCLOSURE === 'string'
      && DISC.liveSearchNotice({ worldWanted: true, answeredFromLive: false }) === DISC.NO_LIVE_RESULTS_DISCLOSURE);
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== G. NO HEDGE IS AN ACCEPTABLE SUBSTITUTE FOR DELETION ===');
  // ══════════════════════════════════════════════════════════════════════════
  //
  // «لا يُترَكُ بتخفيفٍ ولا بتحفُّظٍ ولا بعبارةِ تقريبًا». A hedged number is still a number the
  // reader will quote, so the module may not have a softening path at all — and an unsourced
  // number does not become acceptable by the model calling it approximate.
  {
    const src = read('lib/live-number-source.js');
    ok('the module writes no hedge into the answer',
      !/تقريبا|نحو\s|قد\s+يكون\s+الرقم/.test(src.replace(/^\s*\/\/.*$/gm, '')));
    const hedged = 'سعر صرف الدولار تقريبًا 307 فلوس.';
    const r = run(hedged);
    ok('...and «تقريبًا» does not rescue an unsourced number', r.emptied === true, JSON.stringify(r));
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== H. the gate can fail — each rule disarmed in turn ===');
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Every check above passes today, which is exactly when a gate is impossible to trust. Each
  // predicate is asked a question it must answer NO to; if any of them says yes, the predicate
  // is not discriminating and the section that rests on it proves nothing.
  {
    ok('carriesLiveNumber says NO to a sentence with no digits',
      M.carriesLiveNumber('ارتفعت أسعار النفط ارتفاعًا ملحوظًا.') === false);
    ok('carriesLiveNumber says NO to digits with no moving unit',
      M.carriesLiveNumber('في المسألة 3 أقوال.') === false);
    ok('carriesLiveNumber says YES to digits with one', M.carriesLiveNumber('سعره 307 فلسًا') === true);
    ok('carriesAbsoluteDate says NO to a bare day and month',
      M.carriesAbsoluteDate('في 19/09 ارتفع السعر') === false);
    ok('carriesAbsoluteDate says YES to a year', M.carriesAbsoluteDate('في 2026 ارتفع السعر') === true);
    ok('carriesRelativeDate says NO to the ordinary «اليوم»',
      M.carriesRelativeDate('خمس صلوات في اليوم') === false);
    ok('carriesRelativeDate says YES to «أمس»', M.carriesRelativeDate('وقع الحادث أمس') === true);
    ok('carriesSource says NO when no retrieved page is named and no frame is used',
      M.carriesSource('بلغ السعر 307 فلسًا', M.sourceVocabulary(SOURCES)) === false);
    ok('carriesSource says YES to a retrieved page named without a frame',
      M.carriesSource('جدول بنك الكويت المركزي', M.sourceVocabulary(SOURCES)) === true);
    ok('...and NO to a page that was NOT retrieved for this answer',
      M.carriesSource('بنك الكويت المركزي', M.sourceVocabulary([])) === false,
      'an answer may only credit a source it actually had');
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== I. THE FREE-BRAIN SEAT — and the settled number it may not touch ===');
  // ══════════════════════════════════════════════════════════════════════════
  //
  // ٢/٣'s THIRD CONSTRAINT, IN THE OWNER'S WORDS: «الجوابُ الشرعيُّ والعلميُّ لا يُمَسّ… فيهما
  // أرقامٌ (١٥٠ مليون كم · ٨٫٥ دقائق) وهي معرفةٌ مستقرّةٌ لا رقمٌ يتحرّك. إن حذفَ عقدُك واحدًا
  // منهما فالعقدُ خطأٌ لا الجواب.»
  //
  // AND THE MEASUREMENT THAT DECIDED HOW IT IS KEPT. The enforcement is a rule about UNITS beside
  // DIGITS, and three of its units — «يساوي», «درجة», «جرام» — are as ordinary in settled prose as
  // they are in a quoted rate. Run over EVERY free-brain answer it would therefore empty an
  // astronomy answer that says «يساوي ١٥٠ مليون كم… ٥٥٠٠ درجة مئوية» and a zakat answer that says
  // «نصابُ الذهبِ ٨٥ جرامًا… أي ٢٫٥٪». Both are measured below, and both are why the seat is gated
  // on the QUESTION: `asksLiveNumber` answers NO to a science question and NO to a religious one,
  // so on those turns the contract is never reached. The gate is not a convenience; it is the
  // constraint, and these assertions are what stop it being deleted as redundant.
  {
    const WI = await esm('lib/world-intent.js');
    const withFlag = (value, fn) => {
      const had = Object.prototype.hasOwnProperty.call(process.env, 'LIVE_WORLD_V2');
      const old = process.env.LIVE_WORLD_V2;
      process.env.LIVE_WORLD_V2 = value;
      try { return fn(); } finally {
        if (had) process.env.LIVE_WORLD_V2 = old; else delete process.env.LIVE_WORLD_V2;
      }
    };

    // THE SWITCH IS FORCED ON for every check in this section. Off, `asksLiveNumber` is false for
    // everything and the section would pass while proving nothing.
    const gated = withFlag('on', () => ({
      rayleigh: WI.asksLiveNumber('ما سبب زرقة السماء؟ اشرح لي تشتت رايلي'),
      sun: WI.asksLiveNumber('كم تبعد الشمس عن الأرض؟ وكم يستغرق ضوءها حتى يصلنا؟'),
      sunHeat: WI.asksLiveNumber('كم درجة حرارة سطح الشمس؟'),
      zakat: WI.asksLiveNumber('كم نصاب زكاة الذهب بالجرام؟'),
      fitr: WI.asksLiveNumber('كم مقدار زكاة الفطر بالكيلو؟'),
      // …and the other direction, so the gate is not simply always-false.
      fx: WI.asksLiveNumber('كم يساوي الين الياباني مقابل الكرونة السويدية اليوم؟'),
      price: WI.asksLiveNumber('كم سعر أوقية الفضة اليوم؟'),
    }));
    eq('the seat is closed to the science and the fiqh question, and open to the two live ones',
      gated,
      { rayleigh: false, sun: false, sunHeat: false, zakat: false, fitr: false, fx: true, price: true });

    // The owner's two witnesses, written as this app writes them. These survive the enforcement
    // ITSELF, byte for byte, with no source and no date anywhere in them.
    const RAYLEIGH = 'تشتّتُ رايلي هو تشتّتُ الضوءِ على جُسيماتٍ أصغرَ من طولِ موجتِه. وشدّةُ التشتّتِ '
      + 'تتناسبُ عكسيًّا مع القوّةِ الرابعةِ لطولِ الموجة، فتُشتَّتُ الأطوالُ القصيرةُ أكثرَ من الطويلة.';
    const SUN = 'متوسّطُ بُعدِ الشمسِ عن الأرضِ نحو 150 مليون كيلومتر، وهي الوحدةُ الفلكيّة. '
      + 'والضوءُ يقطعُ هذه المسافةَ في نحو 8.3 دقائق.';
    for (const [name, text] of [['تشتّت رايلي', RAYLEIGH], ['بُعد الشمس', SUN]]) {
      const r = run(text);
      ok('«' + name + '» passes the enforcement byte for byte',
        r.text === text && r.removed.length === 0 && r.emptied === false,
        JSON.stringify({ removed: r.removed, text: r.text }));
    }

    // AND THE TWO THAT WOULD NOT — the reason the gate exists, asserted rather than remembered.
    const SUN_HEAT = 'بُعدُ الشمسِ عن الأرضِ يساوي 150 مليون كم تقريبًا، ودرجةُ حرارةِ سطحِها نحو 5500 درجة مئوية.';
    const NISAB = 'نصابُ الذهبِ 85 جرامًا، ونصابُ الفضّةِ 595 جرامًا. ومن ملكَ ذلك وحالَ عليه الحولُ أخرجَ ربعَ العشرِ، أي 2.5%.';
    ok('a settled astronomy sentence with «يساوي» and «درجة مئوية» WOULD be emptied by the raw contract',
      run(SUN_HEAT).emptied === true,
      'this is why the seat is gated on the question and not run over every answer');
    ok('...and so WOULD a zakat nisab in grams and a quarter-tenth in percent',
      run(NISAB).emptied === true);

    // The wiring itself: the handler's free-brain seat asks the gate before it asks the contract.
    const ASK = read('api/ask.js');
    ok('the handler gates the free-brain seat on asksLiveNumber(questionText)',
      /if \(liveWorldV2Enabled\(\) && asksLiveNumber\(questionText\)\) \{[\s\S]{0,1400}enforceLiveNumberSourcing\(readerText,/.test(ASK));
  }


  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== J. THE LEAD-IN GOES WITH WHAT IT LED INTO (2026-09-20) ===');
  // ══════════════════════════════════════════════════════════════════════════
  //
  // THE MEASURED ANSWER, on the preview, to the owner's exchange-rate question: five sentences
  // removed, «emptied: false», and what the reader was handed was «تفاوتَتِ الأرقامُ قليلًا بينَ
  // المواقعِ، وهذا طبيعيٌّ…» and then nothing whatever. «وهذا أسوأُ من لم أجد: وعدٌ بلا وفاء.»
  //
  // AND THE OTHER DIRECTION IS ASSERTED JUST AS HARD, for the reason section B exists: a rule
  // that removes the sentence BEFORE a deletion is one shape away from removing the sentence
  // before every deletion, and the answer around it would go quietly.
  {
    const orphaned = 'تفاوتَتِ الأرقامُ قليلًا بينَ المواقعِ، وهذا طبيعيٌّ.\n'
      + 'سعرُ صرفِ الدولارِ مقابلَ الدينارِ الكويتيِّ 307.350 فلسًا.';
    const r = run(orphaned);
    ok('the promise goes with the figure it promised', !r.text.includes('تفاوتَتِ'),
      JSON.stringify(r));
    ok('...and it is recorded under its own reason, not the figure\'s',
      r.removed.length === 2 && r.removed.some((x) => x.why === 'lead-in-to-a-removed-sentence'),
      JSON.stringify(r.removed));
    ok('...and an answer that was nothing but the promise and the figure is emptied',
      r.emptied === true, JSON.stringify(r.text));

    const colon = 'وهذه أسعارُ النفطِ كما وردتْ:\nسعرُ برميلِ برنت 67.44 دولارًا.';
    const rc = run(colon);
    ok('a colon lead-in whose content was deleted goes too', rc.emptied === true, JSON.stringify(rc));

    // THE OTHER DIRECTION, AND IT IS THE ONE THAT MATTERS: the paragraph of section E, whose
    // FIRST sentence names «أسعار» and is followed by a deletion. It carries its own source, its
    // own date and its own figures, so it is a statement and not a promise, and it must stand.
    const para = 'بحسب الجزيرة نت في 18 سبتمبر 2026، ارتفعت أسعار النفط. وبلغ سعر البرميل 72 دولارًا. والكويت عضو في أوبك.';
    const rp = run(para);
    ok('a sourced, dated sentence that MENTIONS prices is not a lead-in',
      rp.text.includes('ارتفعت أسعار النفط') && rp.text.includes('والكويت عضو في أوبك'),
      JSON.stringify(rp));

    const survived = 'وهذه أسعارُ النفطِ كما وردتْ:\nبحسب الجزيرة نت في 18 سبتمبر 2026 بلغ سعرُ البرميل 72 دولارًا.';
    ok('...and a lead-in whose content SURVIVED is never touched',
      run(survived).removed.length === 0, JSON.stringify(run(survived)));
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== K. WE DO NOT SEND THE READER SOMEWHERE ELSE (2026-09-20) ===');
  // ══════════════════════════════════════════════════════════════════════════
  //
  // «هذا ممنوعٌ منعًا باتًّا. عزك لا يدلُّ قارئَه على خدمةٍ أخرى ليأخذَ منها ما عجزَ هو عنه.»
  // The five names below are the ones the preview actually offered, in three separate answers.
  {
    for (const [name, sentence] of [
      ['XE.com and Investing, offered as somewhere to look',
        'يمكنكَ التحقُّقُ من السعرِ عبرَ موقعِ XE.com أو Investing.'],
      ['Kitco, with the bare noun of a destination',
        'أسعارُ الذهبِ لحظةً بلحظةٍ متاحةٌ على موقعِ Kitco.com.'],
      ['Oilprice, named as the place to go',
        'راجعْ Oilprice للاطّلاعِ على سعرِ البرميلِ الآن.'],
      ['Google, in Arabic letters',
        'ابحثْ في جوجل عن آخرِ الأسعارِ لتجدَها محدَّثة.'],
    ]) {
      const r = run(sentence);
      ok(name, r.emptied === true && r.removed.length === 1
        && r.removed[0].why === 'external-service-referral', JSON.stringify(r));
    }

    // AND THE ALLOWED ALTERNATIVE, WHICH COSTS NO EXCEPTION. «ودلَّ على الجهةِ الرسميّةِ صاحبةِ
    // الرقمِ إن كانتْ في قوائمِنا» — the central bank has a registry row, so the "is this ours"
    // test answers for it and the sentence stands with no rule written for it.
    const official = 'ولكَ مراجعةُ موقعِ بنك الكويت المركزي cbk.gov.kw لأسعارِ الصرفِ الرسميّة.';
    ok('the OFFICIAL body in our own lists is not a referral', run(official).removed.length === 0,
      JSON.stringify(run(official)));

    // AND A SOURCE CARD IS NOT A REFERRAL EITHER — «تلك تبقى، فهي دليلُنا لا إحالةُ عجز».
    //
    // THE CARD IS BUILT TO BE THE HARDEST CASE, and the first version of this row was not: a card
    // whose title is plain English trips no rule at all, so it survived whether isCardLine existed
    // or not, and the row proved nothing. MEASURED: with the card test disarmed by hand, that
    // fixture still passed 77/77. This one names a host that is in neither the retrieved set nor
    // the registry AND carries «موقع» in its Arabic title — the exact two halves the referral lock
    // fires on — so the ONLY thing standing between it and deletion is «this line is markup the
    // server built». Disarm that line and this row goes red.
    const CARD = '<source site="Oilprice" url="https://oilprice.com/oil-price-charts" '
      + 'title="أسعارُ النفطِ لحظةً بلحظةٍ على موقعِ Oilprice">';
    const carded = 'راجعْ موقعَ Oilprice للحصولِ على السعر.\n' + CARD;
    const rk = run(carded);
    ok('the prose referral goes', !rk.text.includes('راجعْ موقعَ'), JSON.stringify(rk.text));
    ok('...and the source card standing beside it is untouched, byte for byte',
      rk.text.includes(CARD), JSON.stringify(rk.text));
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== L. THE ANSWER THAT ALREADY WORKS — NO REGRESSION, BYTE FOR BYTE ===');
  // ══════════════════════════════════════════════════════════════════════════
  //
  // «جوابُ النفطِ الناجحُ (رقمٌ + aljazeera.net + تاريخٌ صريح) يمرُّ بايتًا ببايتٍ بلا حذف. إن حذفَ
  // عقدُك منه شيئًا فالعقدُ خطأ.» This is the owner's second preview question, written as the
  // model wrote it: the figure, the site and the day in the same sentence, twice over.
  {
    const OIL = 'بحسبِ الجزيرة نت في 18 سبتمبر 2026، أغلقَ خامُ برنت عندَ 67.44 دولارًا للبرميل. '
      + 'وخامُ غربِ تكساسَ الوسيطِ عندَ 63.68 دولارًا في 18 سبتمبر 2026 بحسبِ الجزيرة نت. '
      + 'والسوقُ متأثّرةٌ بقراراتِ أوبك+ وبمستوياتِ المخزونِ الأمريكيّ.';
    const r = run(OIL);
    ok('the reference answer passes byte for byte, with nothing removed',
      r.text === OIL && r.removed.length === 0 && r.emptied === false,
      JSON.stringify({ removed: r.removed, text: r.text }));
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== M. the two new rules can fail — each predicate asked to say NO ===');
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Section H's discipline, applied to the 2026-09-20 half: a predicate that says YES to
  // everything proves nothing about the sections that rest on it.
  {
    const V = M.sourceVocabulary(SOURCES);
    ok('offersExternalService says NO when no foreign name is in the sentence',
      M.offersExternalService('يمكنكَ مراجعةُ الجدولِ أعلاه.', V) === false);
    ok('offersExternalService says NO to a foreign name that is NOT a destination',
      M.offersExternalService('بحسب XE.com بلغ السعر 307 فلسًا.', V) === false,
      'an attribution to a page we did not fetch is a different defect, ruled on elsewhere');
    ok('offersExternalService says YES when both halves are there',
      M.offersExternalService('يمكنكَ زيارةُ موقعِ XE.com.', V) === true);
    ok('...and NO to a page this very answer retrieved',
      M.offersExternalService('يمكنكَ مراجعةُ موقعِ cbk.gov.kw.', V) === false);
    ok('introducesWhatFollows says NO to ordinary prose',
      M.introducesWhatFollows('والكويت عضو في أوبك.', V) === false);
    ok('introducesWhatFollows says NO to a sentence carrying its own figure',
      M.introducesWhatFollows('بلغت الأرقام 307 فلسًا في 2026.', V) === false);
    ok('introducesWhatFollows says YES to a line ending in a colon',
      M.introducesWhatFollows('وهذه الأسعارُ:', V) === true);
    ok('introducesWhatFollows says YES to a promise that gives nothing',
      M.introducesWhatFollows('تفاوتَتِ الأرقامُ قليلًا بينَ المواقع.', V) === true);
    ok('isCardLine says NO to prose', M.isCardLine('راجعْ موقعَ Oilprice.') === false);
    ok('isCardLine says YES to a card', M.isCardLine('<source site="x" url="https://x/">') === true);
  }

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL ===' : ' — PASS ==='));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
