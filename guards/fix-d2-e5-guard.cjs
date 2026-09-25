'use strict';
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/fix-d2-replay.json'), 'utf8'));
let checks = 0, failed = 0;
const ok = (name, pass) => { checks++; if (!pass) failed++; console.log((pass ? 'PASS ' : 'FAIL ') + name); };
(async () => {
  const L = await import(pathToFileURL(path.join(ROOT, 'lib/free-brain/loop.js')));
  const normalize = (text, rows) => L.normalizePinnedCitations ? L.normalizePinnedCitations(text, rows) : text;
  const owner = fixture.owners.find(o => o.id.endsWith('6af2ebb1'));
  // The actual recorded writer response, served by the offline scripted provider.
  const provider = async () => ({ content: [{ type: 'text', text: owner.text }], stop_reason: 'end_turn' });
  const draft = (await provider()).content[0].text;
  const answer = normalize(draft, owner.rows), refs = L.collectCited(answer);
  ok('E5 recorded Saturday single citations recovered in appearance order', JSON.stringify(refs) === '[5,7,1,2,3,4,8]');
  const cardRows = refs.map(n => owner.rows.find(r => r.ref === n)).map(r => ({ ...r, publisher: r.publisher || 'الموسوعة الفقهية الكويتية', text: r.text || r.fullText }));
  ok('E5 recorded encyclopedia reference reaches its card', L.pickEncyclopediaCards(cardRows, 3, () => ({ tag: 'card' })).length > 0);
  ok('E5 recorded citation syntax disappears from reader prose', !/(?<!\[)\[\d+\](?!\])/u.test(L.stripCitations(answer)));
  for (const s of fixture.siblings) {
    const row = { ...s.row, ref: 2 }, text = s.quote + '[2].';
    ok('E5 sibling ' + row.title + ': single citation read', JSON.stringify(L.collectCited(normalize(text, [row]))) === '[2]');
    ok('E5 sibling ' + row.title + ': existing double citation unchanged', normalize(s.quote + '[[2]].', [row]) === s.quote + '[[2]].');
  }
  const rows = [{ ref: 5 }, { ref: 7 }];
  for (const text of ['﴿آية فيها [5]﴾', 'قال تعالى: ﴿نص الآية﴾[5].', '<verse>نص [5]</verse>', 'العدد هو [5].', 'هذه الآية [5].', '5[5] + 7[7]', '[5] + [7]', '```\nالنص [5]\n```', 'المصدر [5](https://example.invalid)', 'الحكم جائز[99].']) {
    ok('E5 verse/numeric/code/link/unknown control: ' + text, normalize(text, rows) === text);
  }
  ok('E5 mixed syntax canonicalized once', normalize('الحكم جائز[5][[7]].', rows) === 'الحكم جائز[[5]][[7]].');
  const src = fs.readFileSync(path.join(ROOT, 'lib/free-brain/loop.js'), 'utf8');
  ok('E5 explicit bracket instruction on flagged retry', src.includes('BW_CITATION_RETRY_NOTE') && src.includes('[[n]]'));
  console.log('E5 ' + (checks - failed) + '/' + checks); process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
