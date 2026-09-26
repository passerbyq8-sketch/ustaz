'use strict';
// D3B F1 (BEFORE_WRITING_V1) — correct sentences are not deleted by the sentence door.
// F1a a leading و/ف of the quoted span is normalized on both sides; F1b a failed support is re-checked
// ONCE with the correct quote; F1c a contradiction is judged only within the same proposition.
// Replays the recorded witness turns of 2026-09-26 (guards/fixtures/fix-d3b-witnesses.json) offline:
// the recorded door input, the rows recovered from the trace, the recorded reviewer reply.
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const rootAt = process.argv.indexOf('--root');
const ROOT = rootAt < 0 ? path.join(__dirname, '..') : process.argv[rootAt + 1];
const W = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/fix-d3b-witnesses.json'), 'utf8'));
const turn = (q) => W.turns.find((t) => t.q === q);
const rowsOf = (t) => t.rows.map((r) => ({ ...r, text: r.fullText }));
let checks = 0, failed = 0;
const ok = (name, pass, info) => { checks++; if (!pass) failed++; console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || info === undefined ? '' : ' :: ' + info)); };
(async () => {
  const RR = await import(pathToFileURL(path.join(ROOT, 'lib/ruling-review.js')));
  // The recorded reply, answered PER ASKED SENTENCE: each numbered sentence of the request gets the
  // verdict the model wrote for that same sentence (matched by its text), renumbered for the request.
  // A reply is then right whatever batch the door sends (D3B F3); a sentence never reviewed gets none.
  const RC = await import(pathToFileURL(path.join(ROOT, 'lib/route-classify.js')));
  const key = (s) => RC.normalizeArabic(String(s || '').replace(/\[\[\s*[0-9\s،,و]+?\s*\]\]/gu, ' ')).replace(/\s+/gu, ' ').trim();
  const perSentence = (t, notFound = []) => {
    const json = JSON.parse(t.raw.slice(t.raw.indexOf('{'), t.raw.lastIndexOf('}') + 1));
    const items = new Map(json.claims.map((c) => [Number(c.id), notFound.includes(Number(c.id)) ? { id: c.id, verdict: 'not_found' } : c]));
    const idOf = new Map(t.recordedDoor.claims.map((c, i) => [key(c.sentence), i + 1]));
    return async (system, user) => {
      const claims = [];
      for (const [, n, s] of (user.split('\nالجمل:\n')[1] || '').matchAll(/^\((\d+)\) (.*)$/gmu)) {
        const item = items.get(idOf.get(key(s)));
        if (item) claims.push({ ...item, id: Number(n) });
      }
      return JSON.stringify({ claims, khilaf: json.khilaf || { exists: false } });
    };
  };
  const door = (q) => { const t = turn(q); return RR.reviewRulings({ text: t.text, rows: rowsOf(t), ask: perSentence(t), question: t.question }); };
  const sentence = (q, n) => turn(q).recordedDoor.claims[n - 1].sentence;
  const keeps = (out, q, ns) => ns.every((n) => out.text.includes(sentence(q, n)));

  // F1a — the conjunction, and only the conjunction.
  ok('F1a reader «وذهب» against source «فذهب» is verbatim',
    RR.quoteIsVerbatim('وذهب المالكية والشافعية والحنابلة إلى أنه', 'فَذَهَبَ الْمَالِكِيَّةُ وَالشَّافِعِيَّةُ وَالْحَنَابِلَةُ إِلَى أَنَّهُ إِذَا قَامَ'));
  ok('F1a reader «فذهب» against source «وذهب» is verbatim',
    RR.quoteIsVerbatim('فذهب الحنفية إلى أنه يكره', 'قال: وَذَهَبَ الْحَنَفِيَّةُ إِلَى أَنَّهُ يُكْرَهُ ذلك'));
  ok('F1a the stripped span must start a word of the text', !RR.quoteIsVerbatim('وقتل الصيد في الحرم حرام', 'ومقتل الصيد في الحرم حرام'));
  ok('F1a a changed word is still not verbatim', !RR.quoteIsVerbatim('وذهب المالكية إلى الجواز مطلقا', 'فذهب المالكية إلى المنع مطلقا'));

  // Q2 (TOOL DIAG §3/§5): claim 2 «وذهب» vs «فذهب», claim 6 «وهذه صلاته بعسفان» (three words).
  const q2 = await door(2);
  ok('F1 Q2 the three-school paragraph before the Malik exception stays (claim 2)', keeps(q2, 2, [2]), q2.text.slice(0, 300));
  ok('F1 Q2 the عسفان description stays on its widened quote (claim 6)', keeps(q2, 2, [6]) && q2.record.rechecked >= 1, JSON.stringify(q2.record));
  ok('F1 Q2 six of seven supported (claim 7 claims consensus its quote does not state)', q2.record.supported === 6 && q2.record.notFound === 1, JSON.stringify(q2.record));

  // Q11 (TOOL DIAG §3): claims 3-6 carried the next school's quote; claim 2 says «اختلفوا».
  const q11 = await door(11);
  ok('F1 Q11 all seven school sentences stay', q11.record.supported === 7 && q11.record.notFound === 0 && keeps(q11, 11, [2, 3, 4, 5, 6]), JSON.stringify(q11.record));
  ok('F1 Q11 the shifted quotes were re-checked, not deleted', q11.record.rechecked >= 4, JSON.stringify(q11.record.changes));

  // Q28 (COMPARE-DIAG Q28 #49): the Maliki and Hanbali paragraphs.
  const q28 = await door(28);
  ok('F1 Q28 the Maliki paragraph stays', keeps(q28, 28, [3]), JSON.stringify(q28.record.changes));
  ok('F1 Q28 the Hanbali paragraph stays', keeps(q28, 28, [6]), JSON.stringify(q28.record.changes));
  ok('F1 Q28 no sentence deleted', q28.record.notFound === 0, JSON.stringify(q28.record));

  // Q32 (COMPARE-DIAG Q32 #33): «كـأبي حنيفة», «كـأحمد», and the Shafi'i sentence's neighbour quote.
  const q32 = await door(32);
  ok('F1 Q32 the Hanafi opening, the Ahmad narration and the Shafi\'i paragraph stay', keeps(q32, 32, [1, 2, 6]) && q32.record.notFound === 0, JSON.stringify(q32.record.changes));

  // Q26 (COMPARE-DIAG Q26 #69): «المذاهب الأربعة» as scope before one named school.
  const q26 = await door(26);
  ok('F1 Q26 the Hanafi wudu exception stays', keeps(q26, 26, [2]), JSON.stringify(q26.record.changes));

  // F1c — Q10 (TOOL DIAG §9): prohibition is not «does it take effect».
  const q10 = await door(10);
  ok('F1c Q10 the opening denial of agreement on occurrence stays', q10.text.includes(sentence(10, 1)) && q10.record.contradicted === 0, q10.text.slice(0, 200));
  ok('F1c Q10 counted as another proposition, left unverified', q10.record.otherProposition === 1, JSON.stringify(q10.record));
  ok('F1c same family still contradicts', RR.sameProposition && RR.sameProposition('يجوز المسح على الجورب الرقيق.', 'لا يجوز المسح على الجورب إلا أن يكون صفيقا'));
  const row = { ref: 1, kind: 'encyclopedia', title: 'م', fullText: 'اتفق الفقهاء على أن الطلاق في الحيض يقع مع الإثم عند الجمهور وفيه خلاف قليل.' };
  const same = await RR.reviewRulings({ text: 'لا يقع طلاق الحائض عند المذاهب الأربعة [[1]].', rows: [row],
    ask: async () => JSON.stringify({ claims: [{ id: 1, verdict: 'contradicted', row: 'ROW_1', quote: 'اتفق الفقهاء على أن الطلاق في الحيض يقع مع الإثم' }] }) });
  ok('F1c a same-proposition contradiction is still replaced by the source', same.record.contradicted === 1 && same.text.includes('والذي في'), same.text);

  // What the re-check must never do.
  const lone = { ref: 1, kind: 'lib_book', subjectId: 'FC-003532', bookTitle: 'بدائع الصنائع', fullText: 'فإذا سلم الإمام ذهبت الطائفة إلى وجه العدو وجاء الأولون فأتموا صلاتهم وحدانا.' };
  const hanbali = 'وعند الحنابلة يجلس الإمام في التشهد والطائفة تتم ثم يسلم بهم.';
  const other = await RR.reviewRulings({ text: hanbali, rows: [lone], ask: async () => JSON.stringify({ claims: [{ id: 1, verdict: 'supported', row: 1, quote: 'ذهبت الطائفة إلى وجه العدو وجاء الأولون فأتموا صلاتهم' }] }) });
  ok('F1b no text names the holder: still not support', other.record.supported === 0 && other.record.notFound === 1, JSON.stringify(other.record));
  const fabricated = await RR.reviewRulings({ text: 'وذهب الحنفية إلى أن الجماعة سنة مؤكدة قريبة من الواجب [[1]].',
    rows: [{ ref: 1, kind: 'encyclopedia', title: 'م', fullText: 'وذهب الحنفية إلى أن الجماعة سنة مؤكدة. وقال غيرهم خلاف ذلك.' }],
    ask: async () => JSON.stringify({ claims: [{ id: 1, verdict: 'supported', row: 1, quote: 'وذهب الحنفية إلى أن الجماعة سنة مؤكدة قريبة من الواجب' }] }) });
  ok('F1b a quote of the sentence\'s own words that is not in its text stays rejected (D-2 E1)', fabricated.record.supported === 0, JSON.stringify(fabricated.record));
  const wideRow = { ref: 1, kind: 'encyclopedia', title: 'م', fullText: 'ذهب المالكية والشافعية إلى أن الرعاف لا ينقض الوضوء، وذهب الحنفية والحنابلة إلى أنه ينقض الوضوء إن كان كثيرا' };
  const majority = await RR.reviewRulings({ text: 'يرى جمهور الفقهاء أن الرعاف لا ينقض الوضوء [[1]].', rows: [wideRow],
    ask: async () => JSON.stringify({ claims: [{ id: 1, verdict: 'supported', row: 1, quote: 'ذهب المالكية والشافعية إلى أن الرعاف لا ينقض الوضوء' }] }) });
  ok('F1b a majority is never counted off a widened span', majority.record.supported === 0, JSON.stringify(majority.record));
  console.log('D3B-F1 ' + (checks - failed) + '/' + checks); process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
