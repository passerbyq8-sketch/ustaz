// guards/brain-postship-3-guard.cjs -- POSTSHIP ITEM 3 -- 2026-10-24 (row 6)
//
// THE LONGER NAME WINS. Measured (sessions/side-brain-postship-2026-10-24/EZIK-CC-POSTSHIP-MEASURE-REPORT-2026-10-24.md,
// row 6; measure/r6-names.mjs, measure/r6-names.out.txt): lib/output-reviewer.js authorityRule took the FIRST registry
// entry whose alias contained the name or was contained in it, so «عبدالله الفوزان» became Shaykh Saleh (entry
// :142-143, alias «الفوزان») before Abdullah's own entry (:231-232). Through sameAuthority / officialSourceFor /
// attributedEvidenceFor: 0 of 42 of Abdullah's fatwas licensed a sentence crediting him, and 1530 of 1543 of Saleh's
// licensed a sentence crediting Abdullah; requestedIdentityRespected took «الفوزان» inside «عبدالله الفوزان» for
// Saleh. And «صالح الفوزان» was not in lib/policy/entities.js ROSTER, so readEntities left him unresolved.
//
// The order (item 3): the exact full name first, then the longest matching name or alias; a short alias does not count
// for its owner where it is part of a longer name of somebody else; Saleh al-Fawzan joins ROSTER with the reviewer's
// names. The three measured ROSTER pairs (Ibn Hajar in al-Asqalani / al-Haytami, al-Shafi'i in the Shafi'i school)
// must not regress. The sentences and the evidence are the measurement's own (measure/r6-names.mjs lines 18-20).
'use strict';
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

(async () => {
  const R = await esm('lib/output-reviewer.js');
  const EN = await esm('lib/policy/entities.js');
  // measure/r6-names.mjs:18-20, copied
  const SAL = { id: 'alfawzan:101', url: 'https://www.alfawzan.af.org.sa/ar/node/101', scholar: 'صالح الفوزان', title: 'حكم المسألة', snippet: 'يجوز ذلك إذا كان بإذن الزوج.' };
  const ABD = { id: 'abdullah-alfuzan:900000101', url: '', scholar: 'عبدالله الفوزان', title: 'حكم المسألة', snippet: 'يجوز ذلك إذا كان بإذن الزوج.' };
  const SENT = { abd: 'قال الشيخ عبدالله الفوزان: يجوز ذلك إذا كان بإذن الزوج.', sal: 'قال الشيخ صالح الفوزان: يجوز ذلك إذا كان بإذن الزوج.' };
  const kept = (text, ev) => {
    const r = R.reviewAnswer({ text, evidence: [ev], domain: 'fiqh', mode: 'brief' });
    return String(r.text || r.output || '').includes(text.split(':')[0].replace('قال الشيخ ', ''));
  };
  console.log('-- 1. the reviewer: each man licensed by his own fatwa only');
  ok('«عبدالله الفوزان» + his own fatwa -> kept (was removed)', kept(SENT.abd, ABD));
  ok('«عبدالله الفوزان» + Saleh\'s fatwa -> removed (was kept)', !kept(SENT.abd, SAL));
  ok('«صالح الفوزان» + his own fatwa -> kept', kept(SENT.sal, SAL));
  ok('«صالح الفوزان» + Abdullah\'s fatwa -> removed', !kept(SENT.sal, ABD));

  console.log('-- 2. the identity check (measure/r6-names.mjs ID rows)');
  const idr = (req, text) => R.requestedIdentityRespected(text, R.identityView(req));
  ok('asked Saleh, the answer names Abdullah only -> mismatch (was respected)',
    idr({ id: 'al-fawzan', name: 'صالح الفوزان', status: 'resolved' }, 'قال الشيخ عبدالله الفوزان: يجوز ذلك.').respected === false);
  ok('asked Abdullah, the answer names Saleh only -> mismatch',
    idr({ id: 'abdullah-al-fawzan', name: 'عبدالله الفوزان', status: 'resolved' }, 'قال الشيخ صالح الفوزان: يجوز ذلك.').respected === false);
  ok('control: asked Saleh, answer names Saleh -> respected',
    idr({ id: 'al-fawzan', name: 'صالح الفوزان', status: 'resolved' }, 'قال الشيخ صالح الفوزان: يجوز ذلك.').respected === true);
  ok('control: asked Abdullah, answer names Abdullah -> respected',
    idr({ id: 'abdullah-al-fawzan', name: 'عبدالله الفوزان', status: 'resolved' }, 'قال الشيخ عبدالله الفوزان: يجوز ذلك.').respected === true);
  ok('control: asked Saleh by «الفوزان» alone, answer «الفوزان» -> respected',
    idr({ id: 'al-fawzan', name: 'الفوزان', status: 'resolved' }, 'قال الفوزان: يجوز ذلك.').respected === true);

  console.log('-- 3. the lookup itself: no name of one entry lands on another (3 -> 0)');
  const rule = R.reviewAuthorityRule;
  ok('the lookup is reachable for this guard', typeof rule === 'function');
  if (typeof rule === 'function') {
    const steals = [];
    for (const e of R.REVIEW_AUTHORITY_SOURCES) for (const n of [e.canonical, ...e.aliases]) {
      const hit = rule(n); if (hit && hit.canonical !== e.canonical) steals.push(n);
    }
    ok('every reviewer name resolves to its own entry', steals.length === 0, 'steals ' + steals.length);
    ok('«الفوزان» alone is still Saleh', (rule('الفوزان') || {}).canonical === 'صالح الفوزان');
    ok('«الشيخ عبد الله الفوزان حفظه الله» is Abdullah', (rule('الشيخ عبد الله الفوزان حفظه الله') || {}).canonical === 'عبدالله الفوزان');
    ok('«الشيخ صالح بن فوزان الفوزان» is Saleh', (rule('الشيخ صالح بن فوزان الفوزان') || {}).canonical === 'صالح الفوزان');
    ok('control: «ابن باز» is still Ibn Baz', /باز/u.test((rule('ابن باز') || {}).canonical || ''));
  }

  console.log('-- 4. the entities roster');
  const ids = (q) => EN.readEntities(q).entities.map((x) => (x.canonicalId || '-') + ':' + x.resolutionStatus);
  ok('Saleh al-Fawzan is in ROSTER', EN.ROSTER.some((e) => e.canonicalId === 'al-fawzan'));
  ok('«صالح الفوزان» resolves (was unresolved)', ids('ما رأي الشيخ صالح الفوزان في المسألة؟').join() === 'al-fawzan:resolved', ids('ما رأي الشيخ صالح الفوزان في المسألة؟').join());
  ok('«عبدالله الفوزان» is still Abdullah, alone', ids('ما رأي الشيخ عبدالله الفوزان في زكاة الحلي؟').join() === 'abdullah-al-fawzan:resolved');
  ok('«الفوزان» alone is Saleh', ids('ما رأي الفوزان في زكاة الحلي؟').join() === 'al-fawzan:resolved', ids('ما رأي الفوزان في زكاة الحلي؟').join());
  ok('pair: «ابن حجر العسقلاني» stays al-Asqalani', ids('ما رأي ابن حجر العسقلاني في المسألة؟').join() === 'ibn-hajar-al-asqalani:resolved');
  ok('pair: «ابن حجر الهيتمي» stays al-Haytami', ids('ما رأي ابن حجر الهيتمي في المسألة؟').join() === 'ibn-hajar-al-haytami:resolved');
  ok('pair: «ابن حجر» alone stays ambiguous', ids('ما رأي ابن حجر في المسألة؟').join() === 'ibn-hajar:ambiguous');
  ok('pair: «المذهب الشافعي» stays the school', ids('ما رأي المذهب الشافعي في المسألة؟').join() === 'shafii:resolved');
  ok('pair: «الشافعي» stays the imam', ids('ما رأي الشافعي في المسألة؟').join() === 'al-shafii:resolved');

  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
