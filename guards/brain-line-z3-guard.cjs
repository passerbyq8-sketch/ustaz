// guards/brain-line-z3-guard.cjs -- ITEM Z3 (125 b) -- 2026-10-15 brain-line
//
// ONE SCHOOL AND ITS BOOK. Measured on 7ba44481 (side-brain-line-2026-10-15/side/t130.md, the 125 table): the madhhab
// gate opened only for «the schools» or two schools named -- «ما حكم مس الذكر عند الحنابلة؟» (m1) and «… في المذهب
// الحنبلي؟» (m3) were false, so no Hanbali book was asked; SCHOOL_KEYS knew «الحنابلة» but not «المذهب الحنبلي», «أبو
// حنيفة», «مالك», «أحمد»; and a unit naming a school was released on any cited row that wrote the school's name, whatever
// that row said of it.
//
// What this guard holds (the order, Z3):
//   (1) the gate opens for one named school («عند الحنابلة», «في المذهب الحنبلي», «قول الشافعية», «عند أبي حنيفة»), and then
//       its book alone is asked; Q125c-e stay closed and Q125a/b, m4, m5 stay open;
//   (2) SCHOOL_KEYS carries the order's forms (the four adjectives, Abu Hanifa, the ahnaf/hanafiyya forms; Malik, al-Shafi'i,
//       Ahmad in an attribution);
//   (3) a unit attributing to a school is released only when a cited row of its book licenses it, or a cited row names the
//       school AND supports the sentence: the row «ينقض الوضوء عند الحنابلة» holds «وذهب الحنابلة إلى أنه لا ينقض [[1]]»
//       (unsupported_school) and releases «ذهب الحنابلة إلى أنه ينقض [[1]]».
// The questions are copied from side-brain-line-2026-10-15/side/t130.md lines 17-26; the row and the two units are the order's own.
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
const ascii = (s) => String(s).replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).slice(0, 300);

const T = {
  Q125a: ['ما قول كل مذهب من المذاهب الأربعة في حكم مس المصحف للمحدث؟ انقل من كتب كل مذهب', true],
  Q125b: ['اذكر أقوال الحنفية والمالكية والشافعية والحنابلة في حكم الجمع بين الصلاتين في السفر من كتب كل مذهب', true],
  Q125c: ['ما حكم بيع التقسيط بزيادة الثمن؟ واذكر مصادرك', false],
  Q125d: ['ما حكم التيمم وما صفته؟ واذكر الكتب التي أخذت منها', false],
  Q125e: ['ما حكم صلاة الجماعة للرجال في المسجد؟', false],
  m1: ['ما حكم مس الذكر عند الحنابلة؟', true],
  m2: ['ما قول الشافعية في القنوت في الفجر؟', true],
  m3: ['ما حكم مس الذكر في المذهب الحنبلي؟', true],
  m4: ['ما حكم مس الذكر عند الحنفية والحنابلة؟', true],
  m5: ['ما حكم مس الذكر حسب المذاهب؟', true],
};

(async () => {
  const BW = await esm('lib/before-writing-v2.js');
  const U = await esm('lib/bw2-units.js');
  console.log('-- 1. the gate');
  for (const [id, [q, want]] of Object.entries(T)) ok(id + ' -> ' + want, BW.isMadhhabQuestion(q) === want);
  const asked = typeof BW.madhhabsAsked === 'function' ? BW.madhhabsAsked : () => [];
  ok('«عند الحنابلة» asks the Hanbali book alone', JSON.stringify(asked(T.m1[0])) === JSON.stringify(['hanbali']), JSON.stringify(asked(T.m1[0])));
  ok('«في المذهب الحنبلي» asks the Hanbali book alone', JSON.stringify(asked(T.m3[0])) === JSON.stringify(['hanbali']));
  ok('«عند أبي حنيفة» asks the Hanafi book alone', JSON.stringify(asked('ما حكم القراءة خلف الإمام عند أبي حنيفة؟')) === JSON.stringify(['hanafi']));
  ok('«قول مالك» asks the Maliki book alone', JSON.stringify(asked('ما قول مالك في سجود السهو؟')) === JSON.stringify(['maliki']));
  ok('«حسب المذاهب» and two schools named ask all four, as before', asked(T.m5[0]).length === 4 && asked(T.m4[0]).length === 4);
  ok('a question naming no school asks none', asked(T.Q125e[0]).length === 0);

  console.log('-- 2. SCHOOL_KEYS');
  const keys = U.SCHOOL_KEYS || [];
  for (const k of ['مذهب الحنفي', 'مذهب المالكي', 'مذهب الشافعي', 'مذهب الحنبلي', 'احناف', 'حنفيه']) ok('SCHOOL_KEYS carries ' + ascii(k), keys.includes(k));
  ok('Abu Hanifa, Malik, al-Shafi\'i and Ahmad count in a madhhab attribution («عند أبي حنيفة», «وهذا قول مالك», «عند أحمد», «مذهب الشافعي»)',
    typeof U.schoolsNamed === 'function' && U.schoolsNamed('وعند أبي حنيفة يجوز').has('hanafi') && U.schoolsNamed('وهذا قول مالك').has('maliki')
    && U.schoolsNamed('وعند أحمد روايتان').has('hanbali') && U.schoolsNamed('وهو مذهب الشافعي').has('shafii') && U.schoolsNamed('وفي المذهب الحنبلي روايتان').has('hanbali'));
  ok('...and not elsewhere: «مالك الدار», nor the man quoted («قال الإمام مالك: …», «قال الإمام الشافعي: …»)',
    !U.schoolsNamed('مالك الدار أذن له').has('maliki') && !U.schoolsNamed('قال الإمام مالك: الكلام').has('maliki') && !U.schoolsNamed('قال الإمام الشافعي: الكلام').has('shafii'));

  console.log('-- 3. the unit and the row');
  const ROW = { ref: 1, kind: 'encyclopedia', publisher: 'الموسوعة الفقهية الكويتية', title: 'مس الذكر', recordId: 'F-z3', text: 'ينقض الوضوء عند الحنابلة' };
  const cards = { max: 3, encyclopediaCards: true, buildBookTag: (b) => ({ tag: '<book></book>' }), buildSourceTag: (r) => ({ tag: '<source></source>' }) };
  const run = async (stream) => {
    const rel = U.createBw2Releaser({ rows: [ROW], mode: 'brief', emit: () => true, cards, notCoveredSentence: BW.BW2_NOT_COVERED || '' });
    rel.push(stream);
    const sum = await rel.end();
    return { text: String(sum.text || ''), holds: sum.holds || {} };
  };
  const neg = await run('وذهب الحنابلة إلى أنه لا ينقض [[1]].');
  ok('«وذهب الحنابلة إلى أنه لا ينقض [[1]]» on «ينقض الوضوء عند الحنابلة»: held, unsupported_school', !neg.text.includes('لا ينقض') && Number(neg.holds.unsupported_school) === 1, ascii(JSON.stringify(neg)));
  const pos = await run('ذهب الحنابلة إلى أنه ينقض [[1]].');
  ok('«ذهب الحنابلة إلى أنه ينقض [[1]]»: released', pos.text.includes('ذهب الحنابلة إلى أنه ينقض') && !Number(pos.holds.unsupported_school), ascii(JSON.stringify(pos)));
  const adj = await run('وفي المذهب الحنبلي أن مس الذكر ينقض الوضوء [[1]].');
  ok('«المذهب الحنبلي» is the same school as «الحنابلة» (released on the same row)', adj.text.includes('المذهب الحنبلي') && !Number(adj.holds.unsupported_school), ascii(JSON.stringify(adj)));
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-z3: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
