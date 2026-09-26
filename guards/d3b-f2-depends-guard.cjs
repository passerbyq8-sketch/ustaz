'use strict';
// D3B F2 (BEFORE_WRITING_V1) — a deleted sentence and what depends on it.
// F2a every sentence that refers back to a deleted sentence goes with it, whole, so no reference is left
// pointing at nothing (witnesses Q32 «وقالوا», Q2 «إلا أن مالكًا…» and «هذه الصفة»).
// F2b a madhhab named in the question never disappears silently: it is in the answer or named in the one
// «لم أقف» line; a contradicted school sentence keeps its school's name (witnesses Q2, Q28, Q32).
// The recorded witness turns are replayed; to reach the deletion paths the recorded verdict of the named
// sentence is turned into the recorded base decision (not_found), exactly as 5f0dbec decided it.
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const rootAt = process.argv.indexOf('--root');
const ROOT = rootAt < 0 ? path.join(__dirname, '..') : process.argv[rootAt + 1];
const W = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/fix-d3b-witnesses.json'), 'utf8'));
const turn = (q) => W.turns.find((t) => t.q === q);
const rowsOf = (t) => t.rows.map((r) => ({ ...r, text: r.fullText }));
let checks = 0, failed = 0;
const ok = (name, pass, info) => { checks++; if (!pass) failed++; console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || info === undefined ? '' : ' :: ' + info)); };
const prose = (text) => String(text).replace(/<suggestions>[\s\S]*?<\/suggestions>/gu, '').trim();
const absenceLine = (text) => prose(text).split('\n').filter((l) => /^لم أقف/u.test(l.trim())).at(-1) || '';
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
  const run = (q, notFound = []) => { const t = turn(q); return RR.reviewRulings({ text: t.text, rows: rowsOf(t), ask: perSentence(t, notFound), question: t.question }); };

  // F2a — Q32: the Hanafi opening removed ⟹ «وقالوا» goes with it.
  const q32 = await run(32, [1]);
  ok('F2a Q32 the Hanafi sentence removed takes «وقالوا» with it', !/(^|\n)\s*وقالوا/u.test(q32.text) && q32.record.dependents >= 1, q32.text.slice(0, 240));
  ok('F2a Q32 the Maliki paragraph after it is untouched', q32.text.includes(turn(32).recordedDoor.claims[2].sentence), q32.text.slice(0, 400));

  // F2a — Q2: the three-school paragraph removed ⟹ «إلا أن مالكًا» and «هذه الصفة» go with it; the Hanafi one stays.
  const q2 = await run(2, [2]);
  ok('F2a Q2 «إلا أن مالكًا خالف» goes with its antecedent', !q2.text.includes('إلا أن مالكًا خالف'), q2.text.slice(0, 500));
  ok('F2a Q2 «هذه الصفةَ» goes with its antecedent', !q2.text.includes('هذه الصفةَ'), q2.text.slice(0, 600));
  ok('F2a Q2 the chain stops at the Hanafi paragraph', q2.text.includes(turn(2).recordedDoor.claims[3].sentence) && q2.record.dependents === 2, JSON.stringify(q2.record.changes));
  const dep = typeof RR.dependsOnPrevious === 'function' ? RR.dependsOnPrevious : () => null;
  ok('F2a dependents are whole sentences: no sentence cut', dep('إلا أن مالكًا خالف في نقطةٍ واحدة.') && dep('وقالوا: إن المراد اللمس.')
    && dep('وقد اختار الشافعي هذه الصفةَ.') && dep('الحنفية: لا ينتقض الوضوء بلمس المرأة.') === false);
  ok('F2a a sentence naming its own subject, or a bare demonstrative, is not a dependent', dep('قال النووي: هو الصحيح.') === false && dep('هذه نهاية الجواب.') === false);

  // F2b — Q28: Maliki and Hanbali removed ⟹ named in the one line; the Shafi'i contradiction keeps its label.
  const q28 = await run(28, [3, 6]);
  const line28 = absenceLine(q28.text);
  // D3B F4c: a school's struck sentence is named by the school and its head («يُسنِدُ إلى المالكية…»).
  ok('F2b Q28 the removed Maliki and Hanbali schools are named in the «لم أقف» line', /المالكية/u.test(line28) && /الحنابلة/u.test(line28), line28);
  const full28 = await run(28, []);
  ok('F2b Q28 the contradicted Shafi\'i sentence keeps «الشافعية» before the source\'s words', /الشافعية: والذي في/u.test(full28.text), full28.text.slice(0, 900));
  // F2b — Q32 on the recorded base verdicts: Hanafi and Shafi'i are named, never silently lost.
  const q32base = await run(32, [1, 2, 6]);
  const line32 = absenceLine(q32base.text);
  ok('F2b Q32 on the base verdicts: Hanafi and Shafi\'i are named in the line', /الحنفية/u.test(line32) && /الشافعية/u.test(line32), line32);
  // F2b — a question school the answer never mentions is named; one the answer keeps is not.
  const lone = await RR.reviewRulings({ text: 'قال الحنفية بالجواز [[1]].', rows: [{ ref: 1, kind: 'encyclopedia', title: 'م', fullText: 'قال الحنفية بالجواز في هذه المسألة عندهم.' }],
    ask: async () => JSON.stringify({ claims: [{ id: 1, verdict: 'supported', row: 1, quote: 'قال الحنفية بالجواز في هذه المسألة' }] }), question: 'ما حكمها عند الحنفية والحنابلة؟' });
  ok('F2b a school the question names and the answer never mentions is named', /للحنابلة/u.test(absenceLine(lone.text)) && !/للحنفية/u.test(absenceLine(lone.text)), lone.text);
  const none = await RR.reviewRulings({ text: 'قال الحنفية بالجواز [[1]].', rows: [{ ref: 1, kind: 'encyclopedia', title: 'م', fullText: 'قال الحنفية بالجواز في هذه المسألة عندهم.' }],
    ask: async () => JSON.stringify({ claims: [{ id: 1, verdict: 'supported', row: 1, quote: 'قال الحنفية بالجواز في هذه المسألة' }] }), question: 'ما حكم هذه المسألة؟' });
  ok('F2b a question naming no school adds no line', none.text === 'قال الحنفية بالجواز [[1]].', none.text);
  ok('F2b the line never starts with «و»', !/^و/u.test(line28) && !/^و/u.test(line32));
  console.log('D3B-F2 ' + (checks - failed) + '/' + checks); process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
