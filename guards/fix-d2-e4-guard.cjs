'use strict';
// D-2 E4: measured /toc and /page envelopes, no network and no invented article text.
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..');
const articles = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/fix-d2-articles.json'), 'utf8'));
const replay = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/fix-d2-replay.json'), 'utf8'));
let checks = 0, failed = 0;
const ok = (name, pass) => { checks++; if (!pass) failed++; console.log((pass ? 'PASS ' : 'FAIL ') + name); };
(async () => {
  const BW = await import(pathToFileURL(path.join(ROOT, 'lib/before-writing.js')));
  const N = await import(pathToFileURL(path.join(ROOT, 'lib/lib-nav.js')));
  const RR = await import(pathToFileURL(path.join(ROOT, 'lib/ruling-review.js')));
  const owner = replay.owners[0]; let asked = 0;
  const reviewed = await RR.reviewRulings({ text: owner.text, rows: owner.rows, ask: async () => { asked++; return owner.raw; } });
  ok('E4 recorded owner writer and reviewer replayed unchanged', asked === 1 && reviewed.record.claims === 5);
  const cases = [
    ['صلاة الخوف', 27, owner.question || 'اذكر لي صفات صلاة الخوف حسب لمذاهب الاربعة', 'بعض الانواع المرويه', 18693],
    ['رعاف', 22, 'هل يبني الراعف على صلاته عند المالكية والحنفية؟', 'بناء الراعف', 15870],
    ['سجود التلاوة', 24, 'ما حكم سجود التلاوة في أوقات النهي عند الشافعية والحنابلة؟', 'اوقات النهي', 59332],
  ];
  const fold = s => s.replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
  const calls = [];
  const fetchImpl = async (url, init) => {
    const u = new URL(url), body = JSON.parse(init.body); calls.push({ path: u.pathname, body });
    if (u.origin !== 'https://lib-preview.ezik.app' || !['/toc', '/page'].includes(u.pathname)) throw Error('forbidden route');
    const payload = u.pathname === '/toc' ? articles.toc : articles.pages.find(p => p.body.volume === body.volume && p.body.page === body.page)?.payload;
    return new Response(JSON.stringify(payload || {}), { status: payload ? 200 : 404, headers: { 'content-type': 'application/json' } });
  };
  for (const [term, volume, question, heading, chars] of cases) {
    const full = typeof N.encyclopediaArticle === 'function' ? await N.encyclopediaArticle(term, volume, { flagValue: 'on', token: 'offline', fetchImpl }) : null;
    ok('E4 ' + term + ': complete measured article and no adjacent entry', full?.text.length === chars && full?.complete === true);
    const row = { ref: 1, kind: 'encyclopedia', title: term, fullText: full?.text || '', articleSections: full?.sections || [] };
    const chosen = typeof BW.selectPinnedText === 'function' ? BW.selectPinnedText(row, question) : '';
    ok('E4 ' + term + ': answers section reaches writer', fold(chosen).includes(heading) && !fold(chosen).startsWith('التعريف'));
    ok('E4 ' + term + ': source text remains available in full', full?.text.length > 6000 && chosen.length <= 12000);
  }
  ok('E4 navigation stays on toc/page', calls.length > 3 && calls.every(c => ['/toc', '/page'].includes(c.path)));
  const none = typeof N.encyclopediaArticle === 'function' ? await N.encyclopediaArticle('رعاف', 22, { flagValue: 'off', token: 'offline', fetchImpl }) : undefined;
  ok('E4 disabled library returns no article', none === null);
  const failedArticle = typeof N.encyclopediaArticle === 'function' ? await N.encyclopediaArticle('رعاف', 22, { flagValue: 'on', token: 'offline', fetchImpl: async () => { throw Error('offline'); } }) : undefined;
  ok('E4 unavailable library does not claim a complete article', failedArticle === null);
  console.log('E4 ' + (checks - failed) + '/' + checks); process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
