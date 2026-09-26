'use strict';
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const R = require('./d4-replay.cjs');
const fold = text => String(text || '').replace(/[\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/gu, '')
  .replace(/[أإآٱ]/gu, 'ا').replace(/\s+/gu, ' ').trim();
const listed = /ما بين يدي|في هذه النصوص|النصوص المتاحة|المادة المتاحة|انقطع النص|لم يجمع لي/u;
module.exports = async function run(fix) {
  const M = await R.load();
  const prose = await import(pathToFileURL(path.resolve(__dirname, '../lib/reader-prose.js')));
  const get = id => R.data.rows.find(r => r.id === id);
  let count = 0;
  const ok = (label, value) => { count++; assert.ok(value, label); console.log('PASS ' + label); };
  if (fix === 'S1') {
    const q = get('Q22'), pass = await M.tk.applyTakhrij(q.draft, { env: R.env, lookup: R.lookupFor(q) });
    const text = fold(pass.text);
    ok('Q22 no frame after li-qawlihi', !/لقوله[^:]*:\s*نص الحديث/u.test(text));
    ok('Q22 no frame after haythu qal', !/حيث قال:\s*(?:قال رسول الله|نص الحديث)/u.test(text));
    ok('Q22 both existing introductions remain', /لقوله/u.test(text) && /حيث قال/u.test(text));
    for (const target of M.tk.findTargets(q.draft).targets) ok('Q22 matn retained: ' + target.matn.slice(0, 20), pass.text.includes(target.matn));
    const literal = 'قال الشيخ: «الحكم واجب في هذه المسألة.»';
    const kept = await M.tk.applyTakhrij(literal, { env: R.env, lookup: async () => { throw Error('scholar quote lookup'); } });
    ok('T2 scholar quotation unchanged', kept.text === literal);
  }
  if (fix === 'S2') {
    const q = get('Q21'), result = await R.replay(M, q);
    const tail = prose.MISSING_ASKED_HADITH;
    ok('Q21 exact C2f wording once', result.finalText.split(tail).length === 2);
    ok('Q21 C2f at the end, one line', result.finalText.endsWith(tail) && !tail.includes('\n'));
    ok('Q21 C2f is not the opener', !result.finalText.startsWith(tail));
    ok('Q21 old wording absent', !fold(result.finalText).includes('لم اجد في المادة المسترجعة'));
    const cards = '<suggestions>\n- سؤال آخر\n</suggestions>';
    const moved = prose.terminalMissingHadith('جواب كامل.\n\n' + cards + '\n\n' + tail);
    ok('C2f stays before trailing UI cards', moved.indexOf(tail) < moved.indexOf(cards));
    ok('C2f terminal pass is idempotent', prose.terminalMissingHadith(moved) === moved);
  }
  if (fix === 'S3') {
    for (const id of ['Q22', 'Q29', 'Q30']) {
      const row = get(id), cleaned = M.loop.withoutMechanismTalk(row.draft);
      ok(id + ' recorded draft is a real witness', /بين يدي|هذه النصوص|المتاحة|انقطع النص|يجمع لي/u.test(fold(row.draft)));
      ok(id + ' listed mechanism phrases removed', !listed.test(fold(cleaned)));
      const quotes = [...row.draft.matchAll(/«[^»]*»/gu)].map(m => m[0]);
      ok(id + ' all quotations stay byte for byte', quotes.every(q => cleaned.includes(q)));
    }
    const q22 = fold(M.loop.withoutMechanismTalk(get('Q22').draft));
    ok('Q22 honest missing detail remains', q22.includes('فلم اقف على نص فيه'));
    const q29 = fold(M.loop.withoutMechanismTalk(get('Q29').draft));
    ok('Q29 honest missing Hanbali detail remains', q29.includes('فلم اقف على تفصيله'));
    ok('Q29 source-of-attribution qualification remains', q29.includes('نقل عن غيرهم لا من كتبهم'));
    const q30 = fold(M.loop.withoutMechanismTalk(get('Q30').draft));
    ok('Q30 honest missing legal classification remains', q30.includes('لم اقف على تصريح بحكمهما التكليفي'));
    const live = R.data.live.find(r => r.id === 'live-Q30');
    const liveClean = M.loop.withoutMechanismTalk(live.text);
    ok('live Q30 listed phrase removed', !listed.test(fold(liveClean)));
    ok('live Q30 honest qualification retained', fold(liveClean).includes('فلا انسبه اليهما من غير نص'));
    const quote = 'قال الشيخ: «لم أقف في النصوص المتاحة على هذا الحكم.»';
    ok('T2 quoted scholar text is opaque to mechanism cleanup', M.loop.withoutMechanismTalk(quote) === quote);
    ok('non-retrieval physical hands untouched', prose.cleanRetrievalProse('غسل ما بين يديه.') === 'غسل ما بين يديه.');
    ok('pure cutoff report removed', prose.cleanRetrievalProse('انقطع النص عندي.').trim() === '');
    for (const row of R.data.rows) {
      const out = await R.replay(M, row);
      ok(row.id + ' final listed phrases absent', !listed.test(fold(out.finalText)));
      ok(row.id + ' T5 forbidden incomplete sentence absent', !fold(out.finalText).includes('هذا الجواب لم يكتمل'));
      ok(row.id + ' sentence door skipped', !out.rulingReview);
    }
  }
  if (fix === 'S4') {
    const witness = get('Q21').recordedFinalizer.before;
    ok('Q21 recorded seal output has orphan second label', fold(witness).includes('اللفظ الثاني') && !fold(witness).includes('اللفظ الاول'));
    const repaired = prose.repairOrdinalLabels(witness);
    ok('Q21 surviving label becomes first', fold(repaired).includes('اللفظ الاول') && !fold(repaired).includes('اللفظ الثاني'));
    ok('Q21 body is unchanged by ordinal repair', repaired === witness.replace(/الثاني/u, 'الأول'));
    const text = 'اللفظ الأول: رواه البخاري وهو كلام تجريبي بلا مصدر.\nاللفظ الثاني: بيان واضح كامل مستقل.';
    const seal = M.lock.lockTakhrij(text, [], { bracketAfterQuote: true });
    ok('shared seal repairs ordinal after deletion', fold(seal.text).includes('اللفظ الاول: بيان واضح') && !fold(seal.text).includes('اللفظ الثاني'));
    const final = M.finalizer.finalizeReaderText({ text: 'اللفظ الثاني: بيان واضح كامل مستقل.', bracketAfterQuote: true });
    ok('finalizer repairs an already orphaned label', fold(final.text).includes('اللفظ الاول'));
    const quoted = 'قال الشيخ: «اللفظ الثاني: هذا كلامه.»';
    ok('T2 ordinal inside quotation unchanged', prose.repairOrdinalLabels(quoted) === quoted);
    ok('ordinal repair idempotent', prose.repairOrdinalLabels(repaired) === repaired);
    ok('flags-off shared seal remains unchanged', M.lock.lockTakhrij(text, []).text.includes('الثاني'));
  }
  if (fix === 'S5') {
    const q = get('Q21'), result = await R.replay(M, q);
    ok('Q21 real loop truncated=false', result.truncated === false && result.incompleteStrip === false);
    ok('Q21 no empty rewrite requested', !result.replayedCalls.includes('empty-retry'));
    const live = R.data.live.find(r => r.id === 'live-Q21');
    ok('live Q21 recorded answer is not hollow', M.loop.hollowAnswerReason(live.text, q.question) === '');
    for (const pair of [['«','»'], ['“','”'], ['"','"'], ['‘','’'], ["'","'"]]) {
      const question = 'ما صحة حديث ' + pair[0] + 'تعلموا الفرائض وعلموها الناس' + pair[1] + '؟';
      ok('quoted enumeration word ignored ' + pair.join(''), M.loop.hollowAnswerReason('هذا حديث ضعيف، وقد تكلم العلماء في إسناده.', question) === '');
    }
    ok('ordinal labels count as enumeration', M.loop.carriesEnumeration('اللفظُ الأوّل: بيان صحيح.\nاللفظُ الثاني: بيان آخر.'));
    ok('real enumeration request still judged hollow', M.loop.hollowAnswerReason('سأوضح لك ذلك في جواب مفصل.', 'اذكر شروط الصلاة') === 'no_enumeration');
    const negative = await R.replay(M, { ...q, id: 'negative-enumeration', question: 'اذكر شروط الصلاة', draft: 'هذه مسألة مهمة ولها تفصيل مفيد.', calls: [], materials: [] });
    ok('real loop negative control still marked incomplete', negative.truncated === true && negative.incompleteStrip === true);
  }
  if (fix === 'S6') {
    const opts = { locations: true, coalesce: true };
    for (const id of ['Q30', 'Q31']) {
      const q = get(id), refs = M.loop.collectCited(q.draft), rows = q.materials.filter(m => refs.includes(m.ref));
      const books = M.cards.locatedBookRows(rows, 3, q.question, opts);
      const encyc = M.loop.pickEncyclopediaCards(rows, 3, M.ask.buildBookTag, opts);
      if (id === 'Q30') ok('Q30 pageless same-volume encyclopedia card absent', encyc.length === 0);
      if (id === 'Q31') {
        ok('Q31 overlapping ranges make one card', books.length === 1);
        ok('Q31 union retains correct page bounds', books[0].locator === 'ج15 · ص289-291');
        ok('Q31 all available writer text retained', rows.every(r => books[0].writerText.includes(r.writerText)));
      }
    }
    const base = { kind: 'lib_book', subjectId: 'test', bookTitle: 'كتاب', author: 'مؤلف', writerText: 'بيان.' };
    const book = (volume, start, end) => ({ ...base, locatorSpan: { volume, pageStart: start, pageEnd: end }, locator: 'ج' + volume + ' ص' + start + '-' + end });
    ok('different volumes never merge', M.cards.locatedBookRows([book(1, 2, 4), book(2, 2, 4)], 3, '', opts).length === 2);
    ok('disjoint pages remain distinct', M.cards.locatedBookRows([book(1, 2, 4), book(1, 6, 8)], 3, '', opts).length === 2);
    ok('bridge overlap merges connected intervals', M.cards.locatedBookRows([book(1, 2, 4), book(1, 6, 8), book(1, 4, 6)], 3, '', opts).length === 1);
    ok('legacy option keeps distinct overlapping locators', M.cards.locatedBookRows([book(1, 2, 4), book(1, 3, 4)], 3).length === 2);
  }
  ok('network attempts = 0', R.networkAttempts() === 0);
  console.log('D4 ' + fix + ': ' + count + '/' + count + ' PASS');
};
