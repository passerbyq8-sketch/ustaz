'use strict';
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/fix-d2-replay.json'), 'utf8'));
let checks = 0, failed = 0;
const ok = (name, pass) => { checks++; if (!pass) failed++; console.log((pass ? 'PASS ' : 'FAIL ') + name); };
const prose = text => text.replace(/<suggestions>[\s\S]*?<\/suggestions>/gu, '').trim();
const terminal = text => { const p = prose(text), lines = p.split('\n').filter(Boolean); return (p.match(/لم أقف/gu) || []).length === 1 && lines.at(-1).startsWith('لم أقف'); };
(async () => {
  const RR = await import(pathToFileURL(path.join(ROOT, 'lib/ruling-review.js')));
  const owner = fixture.owners[0];
  const out = await RR.reviewRulings({ text: owner.text, rows: owner.rows, ask: async () => owner.raw });
  // D3B F1 (2026-09-26) supersedes the recorded 5/5 strikes: three of them carried another sentence's
  // quote (kinds, al-Nawawi's sixteen, the Hanafi and Maliki mistaken-enemy rules) and are now re-checked
  // once with the correct quote from their own cited text and kept. E7 itself still changes no decision.
  ok('E7 recorded owner decisions (D3B F1: three mispaired school quotes re-checked and kept)',
    out.record.claims === 5 && out.record.notFound === 2 && out.record.supported === 3 && out.record.rechecked === 3);
  ok('E7 recorded owner one terminal absence line without wa', terminal(out.text));
  for (const s of fixture.siblings) {
    const bad = 'يحرم هذا الفعل مطلقا.';
    const text = s.claim + '\n' + bad + '\n' + bad + '\nهذه نهاية الجواب.';
    const got = await RR.reviewRulings({ text, rows: [s.row], ask: async () => JSON.stringify({ claims: [
      { id: 1, verdict: 'supported', row: s.row.ref, quote: s.quote },
      { id: 2, verdict: 'not_found' }, { id: 3, verdict: 'not_found' },
    ] }) });
    ok('E7 sibling ' + s.question + ': same supported/struck decisions', got.record.supported === 1 && got.record.notFound === 2 && !got.text.includes(bad));
    ok('E7 sibling ' + s.id + ': surviving prose retained before summary', got.text.startsWith(s.claim) && got.text.includes('هذه نهاية الجواب.') && terminal(got.text));
  }
  const compact = RR.terminalNotFound || (text => text);
  const line = RR.notFoundSentence({ kinds: ['majority'], madhhabs: [], book: '' });
  const mixed = compact('مقدمة.\n' + line + '\nخاتمة.\n' + line + '\n<suggestions>اختيار</suggestions>');
  ok('E7 writer and door absence lines deduplicate at prose end', terminal(mixed) && mixed.startsWith('مقدمة.\n\nخاتمة.') && mixed.endsWith('<suggestions>اختيار</suggestions>'));
  const schools = compact('جواب.\n' + RR.notFoundSentence({ kinds: ['madhhab'], madhhabs: ['maliki', 'shafii'] }) + '\n'
    + RR.notFoundSentence({ kinds: ['madhhab'], madhhabs: ['shafii', 'hanbali'] }));
  ok('E7 repeated school names merged', terminal(schools) && (schools.match(/للشافعية/gu) || []).length === 1 && schools.includes('للمالكية') && schools.includes('للحنابلة'));
  ok('E7 orphan absence heading removed', !compact('جواب.\n**ما لم أقفْ عليه**\n' + line).includes('**ما لم'));
  for (const text of ['جواب عادي.\nخاتمة.', '<source>قال المؤلف: لم أقف على ذلك.</source>', 'قال الباحث: «لم أقف على ذلك».', '```\nلم أقف على ذلك.\n```']) {
    ok('E7 ordinary/quoted/card/code text unchanged', compact(text) === text);
  }
  ok('E7 C1 sentence generator default retained', line.startsWith('ولم أقف'));
  console.log('E7 ' + (checks - failed) + '/' + checks); process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
