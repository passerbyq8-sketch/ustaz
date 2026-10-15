// guards/brain-line-b1-guard.cjs -- ITEM B1 (57 row 10) -- 2026-10-15 brain-line
//
// THE DECIMAL POINT IS NOT A FULL STOP. Measured on 7ba44481 (side-brain-line-2026-10-15,
// side/t57.md): «٠.٣٠٧» reached the reader as «٣٠٧ دينار…» under a correct source line, and the
// fiqh figure «٢.٥٪» was cut into «٢.» and «٥٪». A full stop with a digit (Arabic-Indic 0660-0669
// or Latin 0-9) right before it AND right after it is inside a number in every one of the six
// splitters named by the order; a full stop followed by a letter still ends a sentence.
//
// Fixtures (verbatim, path:line in the comment of each):
//   FX_INDIC  sessions/side-brain-fix-2026-10-15/EZIK-CC-SIDE-BRAIN-FIX-DIRECTIVE-2026-10-15.md:106
//             (also sessions/side-brain-line-2026-10-15/side/t57.md:4)
//   NISAB     sessions/side-brain-fix-2026-10-15/EZIK-CC-SIDE-BRAIN-FIX-DIRECTIVE-2026-10-15.md:106
//   ZAKAT     sessions/side-brain-line-2026-10-15/side/t57.md:22
//   FX_LATIN  sessions/side-brain-line-2026-10-15/side/t57.md:13
//   GLUED     sessions/side-brain-fix-2026-10-15/EZIK-CC-SIDE-BRAIN-FIX-DIRECTIVE-2026-10-15.md:106
//   «0.307» «3.14» the bare numbers of the same directive line.
//
// Usage: node guards/brain-line-b1-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
let failures = 0;
let checks = 0;
function ok(name, cond, detail) {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}

// directive:106 / t57.md:4
const FX_INDIC = 'سعر الدولار اليوم ٠.٣٠٧ دينار بحسب بنك الكويت المركزي في ١٣ أكتوبر ٢٠٢٦.';
// directive:106
const NISAB = 'نصاب زكاة المال ٢.٥٪ من المبلغ.';
// t57.md:22
const ZAKAT = 'ومقدار الزكاة الواجبة في النقدين ٢.٥٪ من المال إذا بلغ النصاب وحال عليه الحول.';
// t57.md:13
const FX_LATIN = 'سعر الدولار اليوم 0.307 دينار بحسب بنك الكويت المركزي في 13 أكتوبر 2026.';
// directive:106
const GLUED = 'انتهى الأمر.ثم بدأ';
const CBK = [{ url: 'https://www.cbk.gov.kw/ar', title: 'بنك الكويت المركزي', site: 'cbk.gov.kw' }];
const NOW = Date.parse('2026-10-15T12:00:00Z');
const evidenceFor = (t) => CBK.map((s, i) => ({ id: 'ref-' + (i + 1), title: s.title, url: s.url, snippet: t.slice(0, 600), date: '2026-10-13' }));

(async () => {
  const R = await esm('lib/output-reviewer.js');
  const LN = await esm('lib/live-number-source.js');
  const LOOP = await esm('lib/free-brain/loop.js');
  const TL = await esm('lib/takhrij-lock.js');
  const SEG = await esm('lib/ledger/segment.js');

  console.log('-- 1. output-reviewer (sentenceParts :2021) then the live contract, as the free brain orders them');
  const rv1 = R.reviewAnswer({ text: FX_INDIC, evidence: evidenceFor(FX_INDIC), domain: 'general', mode: 'brief' }).text;
  ok('reviewer keeps «٠.٣٠٧» whole', rv1.includes('٠.٣٠٧'), JSON.stringify(rv1));
  const live = LN.enforceLiveNumberSourcing(rv1, { sources: CBK, nowMs: NOW });
  const liveText = typeof live === 'string' ? live : (live && live.text) || '';
  ok('live contract prints «٠.٣٠٧» whole', liveText.includes('٠.٣٠٧'), JSON.stringify(liveText));
  ok('no orphan «٣٠٧ دينار» fragment opens a line', !/(^|\n)\s*٣٠٧ دينار/u.test(liveText), JSON.stringify(liveText));
  for (const [id, t] of [['NISAB', NISAB], ['ZAKAT', ZAKAT]]) {
    const rv = R.reviewAnswer({ text: t, evidence: [], domain: 'fiqh', mode: 'brief' }).text;
    ok('reviewer keeps «٢.٥٪» whole (' + id + ')', rv.includes('٢.٥٪'), JSON.stringify(rv));
  }
  const rvL = R.reviewAnswer({ text: FX_LATIN, evidence: evidenceFor(FX_LATIN), domain: 'general', mode: 'brief' }).text;
  ok('reviewer keeps «0.307» whole', rvL.includes('0.307'), JSON.stringify(rvL));

  console.log('-- 2. deliverableText (loop.js sentence split of a tool/promise line)');
  for (const n of ['0.307', '3.14', '٢.٥٪', '٠.٣٠٧']) {
    const t = 'بحثت في المصادر فوجدت أن الرقم ' + n + ' تقريبا.';
    const out = LOOP.deliverableText(t);
    ok('deliverableText keeps «' + n + '» whole', out.includes(n), JSON.stringify(out));
  }

  console.log('-- 3. takhrij-lock sentences (:1557) through dropUnsourcedGrades');
  {
    const t = ZAKAT.replace(/\.$/u, '') + '، وهو حديث صحيح. ' + NISAB;
    const out = TL.dropUnsourcedGrades(t).text;
    ok('the dropped sentence takes its whole number with it (no «٢.» stub)', !/٢\.\s*(?!٥)/u.test(out) && !/النقدين ٢\./u.test(out), JSON.stringify(out));
    ok('the next sentence keeps «٢.٥٪»', out.includes('٢.٥٪'), JSON.stringify(out));
  }

  console.log('-- 4. ledger/segment.js SENTENCE_END (:68)');
  {
    const p = SEG.segmentPage({ authorialText: ZAKAT, sourceId: 'b1' });
    const texts = p.spans.map((s) => s.exactText || s.text || '');
    ok('ledger keeps the zakat sentence one span', texts.length === 1 && texts[0].includes('٢.٥٪'), JSON.stringify(texts));
    const q = SEG.segmentPage({ authorialText: 'الجملة الأولى طويلة بما يكفي هنا.والجملة الثانية طويلة بما يكفي أيضا.', sourceId: 'b1b' });
    ok('ledger still splits a sentence glued to the next by a full stop', q.spans.length === 2, JSON.stringify(q.spans.map((s) => s.exactText)));
  }

  console.log('-- 5. hybrid-deen.js clause splitters (:219, :560, :570) -- the literals as written in the file');
  {
    const src = fs.readFileSync(path.join(REPO, 'lib/hybrid-deen.js'), 'utf8');
    const lits = [];
    const re = /\.split\((\/(?:\\.|[^/\n])+\/[a-z]*)\)/g;
    let m;
    while ((m = re.exec(src)) !== null) if (m[1].includes('(?<=[.!')) lits.push(m[1]);
    const consts = src.match(/const CLAUSE_SPLIT_RE = (\/(?:\\.|[^/\n])+\/[a-z]*);/);
    if (consts) lits.push(consts[1]);
    ok('three clause splitters (or their shared constant) found', lits.length >= 1, String(lits.length));
    for (const lit of lits) {
      const body = lit.slice(1, lit.lastIndexOf('/'));
      const flags = lit.slice(lit.lastIndexOf('/') + 1);
      const rx = new RegExp(body, flags);
      for (const n of ['٢.٥٪', '3.14', '0.307', '٠.٣٠٧']) ok('hybrid ' + lit.slice(0, 24) + '... keeps «' + n + '»', ('قبل ' + n + ' بعد').split(rx).length === 1);
      ok('hybrid ' + lit.slice(0, 24) + '... splits «' + GLUED + '»', GLUED.split(rx).filter(Boolean).length === 2);
    }
  }

  console.log('-- 6. a full stop followed by a letter still ends a sentence (reviewer)');
  {
    const rv = R.reviewAnswer({ text: GLUED + ' الكلام بعد ذلك.', evidence: [], domain: 'general', mode: 'brief' }).text;
    ok('«' + GLUED + '» is still cut after «الأمر.»', /الأمر\.\n/u.test(rv), JSON.stringify(rv));
  }

  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-b1: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
