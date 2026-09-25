'use strict';
// D-2 E3: real encyclopedia school lists support a majority without the literal word.
const fs = require('fs'), path = require('path'), { gunzipSync } = require('zlib');
const { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/fix-d2-replay.json'), 'utf8'));
const corpus = JSON.parse(gunzipSync(fs.readFileSync(path.join(ROOT, 'lib/data/fiqh-search.json.gz'))));
let checks = 0, failed = 0;
const ok = (name, pass) => { checks++; if (!pass) failed++; console.log((pass ? 'PASS ' : 'FAIL ') + name); };
(async () => {
  const RR = await import(pathToFileURL(path.join(ROOT, 'lib/ruling-review.js')));
  const owner = fixture.owners.find((f) => f.id.endsWith('6af2ebb1'));
  const replay = await RR.reviewRulings({ text: owner.text, rows: owner.rows, ask: async () => owner.raw });
  ok('E3 recorded Saturday turn: school-list majority survives', replay.record.supported === 3 && replay.record.notFound === 3);
  ok('E3 recorded Saturday turn: no false school absence', !/لم أقف[^.]*للحنفية/u.test(replay.text));
  const siblings = [
    ['F00099', 'ما حكم قضاء القاضي وهو حاقن عند الجمهور؟', 'يرى جمهور الفقهاء كراهة قضاء القاضي وهو حاقن.',
      'ذهب الحنفيه والمالكيه والشافعيه، وهو راي للحنابله، وقول شريح وعمر بن عبد العزيز، الي انه يكره ان يقضي القاضي وهو حاقن'],
    ['F00107', 'هل يجوز الاستصباح بالدهن المتنجس في غير المسجد عند الجمهور؟', 'يرى جمهور الفقهاء جواز الاستصباح بالدهن المتنجس في غير المسجد.',
      'ذهب الحنفيه والمالكيه والشافعيه في المشهور عندهم وهو روايه عند الحنابله اختارها الخرقي، انه يجوز الاستصباح به في غير المسجد'],
  ];
  for (const [id, question, text, quote] of siblings) {
    const article = corpus.find((r) => r.id === id);
    const row = { ref: 1, kind: 'encyclopedia', title: article.term, part: article.part, fullText: article.search };
    ok('E3 ' + id + ': actual stored quote for ' + question, article.search.includes(quote));
    const supported = async () => JSON.stringify({ claims: [{ id: 1, verdict: 'supported', row: 1, quote }] });
    const majority = await RR.reviewRulings({ text, rows: [row], ask: supported });
    ok('E3 ' + id + ': majority supported by named schools', majority.record.supported === 1 && majority.text === text);
    const four = await RR.reviewRulings({ text: text.replace('جمهور الفقهاء', 'المذاهب الأربعة'), rows: [row], ask: supported });
    ok('E3 ' + id + ': four-school claim supported by named schools', four.record.supported === 1);
    const refusal = await RR.reviewRulings({ text: 'ذهب الحنفية والمالكية والشافعية والحنابلة إلى هذا التفصيل.', rows: [row],
      ask: async () => '{"claims":[{"id":1,"verdict":"not_found"}]}' });
    ok('E3 ' + id + ': unsupported detail is struck without denying named schools', refusal.record.notFound === 1 && !/للحنفية|للمالكية|للشافعية|للحنابلة/u.test(refusal.text));
    const down = await RR.reviewRulings({ text, rows: [row], ask: async () => { throw Error('offline reader unavailable'); } });
    ok('E3 ' + id + ': reader failure does not manufacture absent majority', down.record.unverified === 1 && down.record.notFound === 0);
  }
  const two = fixture.siblings[0];
  const noMajority = await RR.reviewRulings({ text: 'يرى الجمهور أن الرعاف لا ينقض الوضوء.', rows: [two.row],
    ask: async () => JSON.stringify({ claims: [{ id: 1, verdict: 'supported', row: two.row.ref, quote: two.quote }] }) });
  ok('E3 two named schools alone do not establish a majority', noMajority.record.supported === 0);
  const noFour = await RR.reviewRulings({ text: 'ترى المذاهب الأربعة أن الرعاف لا ينقض الوضوء.', rows: [two.row],
    ask: async () => JSON.stringify({ claims: [{ id: 1, verdict: 'supported', row: two.row.ref, quote: two.quote }] }) });
  ok('E3 two named schools alone do not establish four schools', noFour.record.supported === 0);
  console.log('E3 ' + (checks - failed) + '/' + checks); process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
