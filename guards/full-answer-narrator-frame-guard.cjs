// D3A H1: real applyTakhrij, offline structural witnesses, exact quoted letters, and frozen 2fd562c OFF objects.
// The red baseline and measurement live in the order archive; no library or Ezik service is called.
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const rootAt = process.argv.indexOf('--root');
const ROOT = rootAt > 0 ? path.resolve(process.argv[rootAt + 1]) : path.join(__dirname, '..');
const recordAt = process.argv.indexOf('--record');
const P = 'صلى الله عليه وسلم';
const ON = { TAKHRIJ_V1: 'on', FULL_ANSWER_V1: 'on' };
const OFF = { TAKHRIJ_V1: 'on' };
const J = 'بينما نحن جلوس عند رسول الله ﷺ ذات يوم إذ طلع علينا رجل';
const S = 'كنا مع رسول الله ﷺ في سفر فمنا الصائم ومنا المفطر';
const V = 'جاء رجل إلى رسول الله ﷺ فقال يا رسول الله من أحق الناس بحسن صحابتي';
const M = 'إنما الأعمال بالنيات وإنما لكل امرئ ما نوى';
const N = 'لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه';
const frame = m => `قال رسول الله ${P}: «${m}».`;
const narrative = m => `حدثنا وكيع عن عمر بن الخطاب قال: ${m}`;
const speech = m => `حدثنا وكيع عن عمر بن الخطاب قال: قال رسول الله ${P}: «${m}»`;
const cases = [
  { id: 'H1', label: 'Q52 narrator opening', matn: J, atom: narrative(J) },
  { id: 'H2', label: 'sibling travel narration', matn: S, atom: narrative(S) },
  { id: 'H3', label: 'sibling visitor narration', matn: V, atom: narrative(V) },
  { id: 'H4', label: 'explicit prophetic saying one retains frame', matn: M, atom: speech(M), prophetic: true },
  { id: 'H5', label: 'explicit prophetic saying two retains frame', matn: N, atom: speech(N), prophetic: true },
  { id: 'H6', label: 'failed lookup does not prove model frame', matn: J, atom: '' },
  { id: 'H7', label: 'existing prose attribution still repairs frame', matn: J, atom: narrative(J), draft: frame(J) + ' رواه مسلم.' },
  { id: 'H8', label: 'existing prose grade still repairs frame', matn: J, atom: narrative(J), ids: ['FC-000658'], draft: frame(J).slice(0, -1) + ' وهو حديث حسن.' },
  { id: 'H9', label: 'prefix outside dissolved card is repaired', matn: J, atom: narrative(J), draft: `قال رسول الله ${P}: <hadith>${J}</hadith>` },
  { id: 'H10', label: 'silent card prefix is repaired', matn: J, atom: '', draft: `قال رسول الله ${P}: <hadith>${J}</hadith>` },
  { id: 'H11', label: 'unconfirmed atom cannot prove frame', matn: J, atom: speech('حديث آخر لا يحمل شيئا من المقطع') },
  { id: 'H12', label: 'previous prophetic quote cannot lend its speaker', matn: J, atom: speech(M) + ' ثم قال عمر: «' + J + '»' },
  { id: 'H13', label: 'quoted words inside narration are not prophetic', matn: V, atom: `حدثنا وكيع عن أبي هريرة قال: «${V}»` },
  { id: 'H14', label: 'unquoted explicit speech retains frame', matn: M, atom: `حدثنا وكيع عن عمر قال: قال رسول الله ${P}: ${M}`, prophetic: true },
  { id: 'H15', label: 'vocalised frame is repaired', matn: J, atom: narrative(J), draft: `قَالَ رَسُولُ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ: «${J}».` },
  { id: 'H16', label: 'B2 narrator is retained for narration', matn: S, atom: `حدثنا وكيع عن أنس رضي الله عنه قال: ${S}`, named: 'أنس' },
  { id: 'H17', label: 'B2 narrator is retained for prophetic speech', matn: M, atom: `حدثنا وكيع عن عمر بن الخطاب رضي الله عنه قال: قال رسول الله ${P}: «${M}»`, named: 'عمر بن الخطاب', prophetic: true },
  { id: 'H18', label: 'chapter heading cannot prove narrator speech', matn: J, atom: `باب قال رسول الله ${P}: «${J}» حدثنا وكيع عن عمر قال: ${J}` },
  { id: 'H19', label: 'middle excerpt in explicit prophetic quotation retains frame', matn: N, atom: speech(M + ' ' + N), prophetic: true },
  { id: 'H21', label: 'excerpt crossing into narrator voice is not prophetic', matn: M + ' قال الراوي ' + J, atom: speech(M) + ' قال الراوي: ' + J },
  { id: 'H22', label: 'Prophet quotation later inside story does not prove story frame', matn: J, atom: narrative(J) + ' فقال رسول الله ' + P + ': «' + N + '»' },
  { id: 'H23', label: 'proven speech mentioning Prophet in third person retains frame', matn: 'أنا رسول الله إليكم جميعا ورحمة للعالمين', atom: speech('أنا رسول الله إليكم جميعا ورحمة للعالمين'), prophetic: true },
  { id: 'H24', label: 'no-safe-slot exit still repairs nominal frame', matn: J, atom: narrative(J), draft: `قول النبي ﷺ «${J}» يروى` },
  { id: 'H25', label: 'unquoted unlisted narrator turn cannot inherit speech', matn: M + ' ثم قال خالد ' + J, atom: `حدثنا وكيع عن عمر قال: قال رسول الله ${P}: ${M} ثم قال خالد: ${J}` },
  { id: 'H26', label: 'quoted Prophet story can mention another speaker', matn: 'ذكر من مضى ثم قال خالد لصاحبه إنه يوم عظيم', atom: speech('ذكر من مضى ثم قال خالد لصاحبه إنه يوم عظيم'), prophetic: true },
  { id: 'H27', label: 'conflicting confirmed narration vetoes speech frame', matn: J, atom: narrative(J), otherAtoms: [speech(J)] },
  { id: 'H28', label: 'over-cap quote has no proof for its frame', matn: J, atom: narrative(J), cap: true, draft: Array.from({ length: 6 }, (_, n) => frame(M + ' ' + n)).join('\n') + '\n' + frame(J) },
  { id: 'H29', label: 'subject-first subordinate frame preserves grammar', matn: J, atom: narrative(J), draft: `والدليل أن رسول الله ${P} قال: «${J}».`, exact: `والدليل أن في الرواية: «${J}» (مسلم).` },
  { id: 'H30', label: 'subject-first saying frame becomes narration', matn: J, atom: narrative(J), draft: `رسول الله ﷺ يقول: «${J}».`, exact: `ورد في الرواية: «${J}» (مسلم).` },
  { id: 'H31', label: 'nominal frame preserves governing prose', matn: J, atom: narrative(J), draft: `والأصل قول النبي ﷺ: «${J}».`, exact: `والأصل رواية الحديث: «${J}» (مسلم).` },
  { id: 'H32', label: 'excerpt crossing a closing quote into narration has no single speaker', matn: M + ' ثم خرج عمر إلى السوق', atom: speech(M) + ' ثم خرج عمر إلى السوق' },
  { id: 'H33', label: 'lafz variant cannot prove speech of original excerpt', matn: M, atom: '«' + M + '»', variantAtom: speech(M.replace('بالنيات', 'بالنية')), ids: ['FC-000658'] },
  { id: 'H34', label: 'actual direct speech below a chapter heading remains proven', matn: M, atom: 'باب فضل العمل ' + speech(M), prophetic: true },
  { id: 'H35', label: 'subject-first explicit atom proves prophetic speech', matn: M, atom: `حدثنا وكيع عن عمر أن رسول الله ${P} قال: «${M}»`, prophetic: true },
  { id: 'H36', label: 'saved row3 partial Ibn Umar variant cannot veto complete explicit speech', matn: 'بني الإسلام على خمس: شهادة أن لا إله إلا الله، وأن محمدا', atom: speech('بني الإسلام على خمس: شهادة أن لا إله إلا الله، وأن محمدا'), otherAtoms: ['عن ابن عمر قال: بني الإسلام على خمس شهادة أن لا إله إلا الله وإقام الصلاة وإيتاء الزكاة وصيام رمضان ثم الجهاد بعد ذلك حسن هكذا حدثنا رسول الله صلى الله عليه وسلم'], prophetic: true },
  { id: 'H37', label: 'saved row5 same-Prophet wording variant is unknown rather than narrator speech', matn: 'من أحدث في أمرنا هذا ما ليس منه فهو رد', atom: speech('من أحدث في أمرنا هذا ما ليس منه فهو رد'), otherAtoms: ['عن عائشة قالت قال رسول الله صلى الله عليه وسلم: «من أحدث في أمرنا هذا ما ليس فيه فهو رد»'], prophetic: true },
  { id: 'H38', label: 'question before narrator answer cannot become subject-first Prophet speech', matn: 'حفظت من رسول الله صلى الله عليه وسلم دع ما يريبك إلى', atom: 'عن أبي الحوراء السعدي قال قلت للحسن بن علي ما حفظت من رسول الله صلى الله عليه وسلم؟ قال: حفظت من رسول الله صلى الله عليه وسلم دع ما يريبك إلى ما لا يريبك' },
  { id: 'H39', label: 'quoted narrator answer keeps its preceding question boundary', matn: 'حفظت من رسول الله صلى الله عليه وسلم دع ما يريبك إلى', atom: 'عن أبي الحوراء السعدي قال قلت للحسن بن علي ما حفظت من رسول الله صلى الله عليه وسلم؟ قال: «حفظت من رسول الله صلى الله عليه وسلم دع ما يريبك إلى ما لا يريبك»' },
  { id: 'H40', label: 'hearing frame is replaced whole without orphaned سمعت', matn: J, atom: narrative(J), draft: 'سمعت رسول الله صلى الله عليه وسلم يقول: «' + J + '».', exact: 'ورد في الرواية: «' + J + '» (مسلم).' },
  { id: 'H41', label: 'connecting ف survives frame correction', matn: J, atom: narrative(J), draft: 'كنا في سفر فقال النبي صلى الله عليه وسلم: «' + J + '».', exact: 'كنا في سفر فورد في الرواية: «' + J + '» (مسلم).' },
  { id: 'H42', label: 'unreadable full direct frame with addressee cannot veto another complete proof', matn: M, atom: speech(M), otherAtoms: ['حدثنا وكيع عن عمر أن النبي صلى الله عليه وسلم قال له: «' + M + '»'], prophetic: true },
  { id: 'H43', label: 'narrator words in heading cannot veto proven body speech', matn: M, atom: speech(M), prophetic: true, otherAtoms: ['باب عن عمر قال: ' + M + ' حدثنا وكيع عن عمر قال: إنما الأعمال بالنيات وإنما لكل امرئ شأن آخر'] },
  { id: 'H20', label: 'two independent targets keep their own speaker', matn: J, atom: narrative(J), draft: frame(J) + '\n' + frame(M), extra: { matn: M, atom: speech(M) } },
];
globalThis.fetch = async () => { throw new Error('H1 guard forbids network'); };
(async () => {
  const T = await import(pathToFileURL(path.join(ROOT, 'lib/takhrij.js')).href);
  let checks = 0, failures = 0;
  const rows = [];
  function ok(label, pass, detail) { checks++; if (!pass) failures++; console.log(`  ${pass ? 'PASS' : 'FAIL'} ${label}${!pass ? '\n    ' + detail : ''}`); }
  for (const c of cases) {
    const draft = c.draft || frame(c.matn);
    const lookup = async ms => ms.map(m => {
      const atom = m === c.matn ? c.atom : c.variantAtom && m === c.matn.replace('بالنيات', 'بالنية') ? c.variantAtom : c.extra && m === c.extra.matn ? c.extra.atom : '';
      const atoms = atom ? [atom, ...(c.otherAtoms || [])] : [];
      return { matn: m, subjectIds: atoms.map(() => (c.ids || ['FC-000648'])[0]), atoms };
    });
    const on = await T.applyTakhrij(draft, { env: ON, lookup });
    const off = await T.applyTakhrij(draft, { env: OFF, lookup });
    const bare = T.bareArabic(on.text);
    const main = c.cap ? bare.split('\n').at(-1) : c.extra ? bare.split('\n')[0] : bare;
    const propheticFrame = /(?:قال رسول الله|قال النبي|قول النبي|قول رسول الله)/u.test(main.slice(0, main.indexOf('«')));
    ok(c.id + ' ' + c.label, c.named ? on.entries[0].companion === c.named : c.prophetic ? propheticFrame : !propheticFrame, on.text);
    ok(c.id + '-matn quoted letters survive', on.text.includes('«' + c.matn + '»'), on.text);
    if (c.exact) ok(c.id + '-grammar exact prose', on.text === c.exact, on.text);
    if (c.extra) ok(c.id + '-other other matn retains proven frame', on.text.includes(frame(M).slice(0, -1)), on.text);
    if (c.cap) ok(c.id + '-cap still unexamined', on.entries.some(e => e.matn === J && e.declined === 'over_matn_cap' && e.subjectIds.length === 0), JSON.stringify(on.entries));
    rows.push({ id: c.id, label: c.label, draft, on, off });
  }
  const snapshot = path.join(__dirname, 'h1-off-baseline.json');
  if (!fs.existsSync(snapshot)) throw new Error('Required frozen 2fd562c OFF fixture is missing: ' + snapshot);
  {
    const expected = JSON.parse(fs.readFileSync(snapshot, 'utf8').replace(/^\uFEFF/u, ''));
    for (const row of rows) ok(row.id + '-off FULL_ANSWER_V1 off byte identity', JSON.stringify(row.off) === JSON.stringify(expected[row.id]), JSON.stringify(row.off));
  }
  if (recordAt > 0) {
    const dest = path.resolve(process.argv[recordAt + 1]);
    fs.writeFileSync(dest, JSON.stringify({ root: ROOT, checks, failures, rows }, null, 2) + '\n');
  }
  console.log(`\n=== full-answer-narrator-frame: ${checks - failures}/${checks} PASS ===`);
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
