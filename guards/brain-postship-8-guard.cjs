// guards/brain-postship-8-guard.cjs -- POSTSHIP ITEM 8 -- 2026-10-24 (row 4)
//
// (a) THE SCHOOLS AND THE ABSENT ONE, FOR EVERY FIQH QUESTION. Measured (sessions/side-brain-postship-2026-10-24/
// EZIK-CC-POSTSHIP-MEASURE-REPORT-2026-10-24.md row 4; measure/r4-p2.mjs): BW_MADHHAB_RULE reached the writer only when
// madhhabsAsked() read the schools in the question, so P2 «ما حكم زكاة الحلي المستعمل؟» had no rule (3/4), and the free brain had
// none at all (0/4). The order: every fiqh question in both paths carries the rule -- when the answer sets out views, the four
// schools by name or the absent school said plainly; rule 10 stays about named scholars.
// (b) WHAT COUNTS AS A VERSE IN TRANSLATION. Measured (measure/r4-quran.mjs, the echo translator of guards/brain-line-h2-guard.cjs):
// in prose 5 of 12 hadith/du'a phrases matched as verses, between «» 11 of 12 stayed Arabic, 4 with no translation. The order:
// only ﴿…﴾ or a long single-verse stretch outside a hadith's frame is a verse; a «…» that is neither verse nor hadith is translated.
// The twelve phrases and their sentences are measure/r4-quran.mjs's own (CASES), copied.
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
// measure/r4-p2.mjs:14-16, copied
const RULE_KEY = 'ومذهبٌ لم تجدْ له نصًّا هنا قلْ فيه صراحةً';
const P2 = ['ما حكم زكاة الحلي المستعمل؟', 'ما حكم زكاة الحلي المستعمل؟ وما قول الأئمة الأربعة فيه؟', 'ما حكم زكاة الحلي المستعمل عند المذاهب الأربعة؟', 'ما حكم زكاة الحلي المستعمل عند الحنابلة؟'];
const NOT_FIQH = ['من هو أول من أسلم من الصبيان؟', 'كم عدد سكان الكويت؟', 'كيف أطبخ الأرز؟'];
// measure/r4-quran.mjs CASES, copied
const CASES = [
  ['P6 jibril', 'أن تؤمن بالله وملائكته وكتبه ورسله واليوم الآخر', 'أركان الإيمان ستة كما في حديث جبريل: أن تؤمن بالله وملائكته وكتبه ورسله واليوم الآخر، وتؤمن بالقدر خيره وشره.'],
  ['P6 phrase bare', 'بالله وملائكته وكتبه ورسله واليوم الآخر', 'والإيمان بالله وملائكته وكتبه ورسله واليوم الآخر من أصول الدين.'],
  ['hamd in dua', 'الحمد لله رب العالمين', 'وكان يقول بعد الطعام: الحمد لله رب العالمين، اللهم بارك لنا فيه.'],
  ['amantu', 'آمنت بالله ورسوله', 'فقال الرجل: آمنت بالله ورسوله، ثم استقام.'],
  ['samina', 'سمعنا وأطعنا', 'فقال الصحابة: سمعنا وأطعنا، ثم عملوا بما أمروا به.'],
  ['hasbuna', 'حسبنا الله ونعم الوكيل', 'وقالها إبراهيم حين ألقي في النار: حسبنا الله ونعم الوكيل.'],
  ['istirja', 'إنا لله وإنا إليه راجعون', 'ومن أصابته مصيبة فليقل: إنا لله وإنا إليه راجعون، اللهم أجرني في مصيبتي.'],
  ['mashaallah', 'ما شاء الله لا قوة إلا بالله', 'ويقول من رأى ما يعجبه: ما شاء الله لا قوة إلا بالله، تبارك الله.'],
  ['basmala', 'بسم الله الرحمن الرحيم', 'ويستحب أن يقول قبل الوضوء: بسم الله الرحمن الرحيم، ثم يغسل كفيه.'],
  ['sabirin', 'إن الله مع الصابرين', 'والصبر خلق عظيم، وإن الله مع الصابرين في كل حال.'],
  ['yunus', 'لا إله إلا أنت سبحانك إني كنت من الظالمين', 'ودعوة ذي النون: لا إله إلا أنت سبحانك إني كنت من الظالمين، لم يدع بها مسلم إلا استجيب له.'],
  ['lahawla', 'لا حول ولا قوة إلا بالله', 'وأكثروا من قول: لا حول ولا قوة إلا بالله، فإنها كنز من كنوز الجنة.'],
];
// the positive side (COMPOSED frames; the verses are the mushaf's): ten marked quotations (each one the matcher resolved before
// this item) and five long unmarked ones of VERSE_STRETCH_MIN words or more
const MARKED = ['قل هو الله أحد', 'إن مع العسر يسرا', 'ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار', 'إنا أعطيناك الكوثر', 'إنما المؤمنون إخوة',
  'وما خلقت الجن والإنس إلا ليعبدون', 'لا يكلف الله نفسا إلا وسعها', 'إنا أنزلناه في ليلة القدر', 'واعتصموا بحبل الله جميعا ولا تفرقوا', 'وتعاونوا على البر والتقوى'];
const LONG = [
  'يا أيها الذين آمنوا كتب عليكم الصيام كما كتب على الذين من قبلكم لعلكم تتقون',
  'شهر رمضان الذي أنزل فيه القرآن هدى للناس وبينات من الهدى والفرقان',
  'إن الله يأمر بالعدل والإحسان وإيتاء ذي القربى وينهى عن الفحشاء والمنكر والبغي يعظكم لعلكم تذكرون',
  'يا أيها الناس اتقوا ربكم الذي خلقكم من نفس واحدة وخلق منها زوجها وبث منهما رجالا كثيرا ونساء',
  'وقضى ربك ألا تعبدوا إلا إياه وبالوالدين إحسانا إما يبلغن عندك الكبر أحدهما أو كلاهما فلا تقل لهما أف ولا تنهرهما وقل لهما قولا كريما',
];

(async () => {
  const BW = await esm('lib/before-writing-v2.js');
  const FB = await esm('lib/free-brain/instructions.js');
  const A = await esm('lib/lang/answer.js');
  console.log('-- (a) the schools rule');
  const bw2 = P2.filter((q) => { const r = BW.bw2RulesFor([{ id: 'x' }], q, []); return r.includes(RULE_KEY) || r.includes('السؤالُ عن مذهبِ'); }).length;
  ok('before writing: the rule in all four P2 forms (was 3/4)', bw2 === 4, bw2 + '/4');
  const fbFiqh = FB.buildFreeBrainInstruction({ band: 'adult', fiqh: true });
  ok('the free brain: a fiqh turn carries the rule (was 0/4)', fbFiqh.includes(RULE_KEY));
  ok('the free brain: a turn that is not fiqh does not', !FB.buildFreeBrainInstruction({ band: 'adult' }).includes(RULE_KEY));
  ok('the free brain: the text of a turn that is not fiqh is byte for byte what it was', FB.buildFreeBrainInstruction({ band: 'adult' }) === FB.buildFreeBrainInstruction({ band: 'adult', fiqh: false }));
  const fs = require('fs');
  const askSrc = fs.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
  ok('api/ask.js gives the free brain the rule on a fiqh runtime only', askSrc.includes("buildFreeBrainInstruction({ band, fiqh: !generalSystem && currentRuntime === 'STORED_FIQH' })"));
  const RT = await esm('lib/stored-deen.js');
  const PL = await esm('lib/ask-plan.js');
  const RC = await esm('lib/route-classify.js');
  // the runtime as api/ask.js computes it before the sorter (classifyRoute, then classifyReligiousRuntime)
  const rt = (q) => { const m = [{ role: 'user', content: q }]; return RT.classifyReligiousRuntime(q, PL.planAsk(m, { policyEnabled: true }), RC.classifyRoute(m)); };
  ok('the four P2 forms are fiqh (STORED_FIQH), so the free brain gets the rule for each: 4/4', P2.filter((q) => rt(q) === 'STORED_FIQH').length === 4, P2.map(rt).join(','));
  ok('three questions that are not fiqh are not STORED_FIQH: no rule', NOT_FIQH.every((q) => rt(q) !== 'STORED_FIQH'), NOT_FIQH.map(rt).join(','));
  ok('rule 10 is still the last of before writing\'s rules', BW.bw2RulesFor([], 'x', []).endsWith('١٠. لا تذكرْ غيابَ قولِ عالمٍ لم يسألْ عنه السائل.'));
  ok('the rule says rule 10 does not forbid naming an absent school', String(BW.BW_MADHHAB_VIEWS_RULE || '').includes('ولا تمنعُ التصريحَ بغيابِ قولِ مذهب'));

  console.log('-- (b) what counts as a verse');
  const echo = async ({ user }) => { const arr = JSON.parse(user.split('INPUT:\n')[1]); return { ok: true, text: JSON.stringify(arr.map((s) => 'EN ' + s.replace(/[؀-ۿ]/g, ''))) }; };
  const arLeft = (t) => (String(t).match(/[؀-ۿ][؀-ۿ\sً-ْ«»،]*/g) || []).map((x) => x.trim()).filter((x) => x.length > 1);
  const run = async (text) => { const o = await A.translateAnswer(text, { lang: 'en', translate: echo, budgetMs: 20000 }); return String(o.text || o); };
  let prose = 0; let quoted = 0; let bare = 0; let hadithKept = 0;
  const asVerse = (t) => /Qur'?an translation|\d+:\d+/i.test(t);
  const asHadith = (t) => /reported:|HadeethEnc/i.test(t);
  for (const [, phrase, sentence] of CASES) {
    const tb = await run(sentence);
    const tq = await run(sentence.replace(phrase, '«' + phrase + '»'));
    if (arLeft(tb).length) prose++;
    // kept Arabic AS A VERSE -- the defect: a Qur'an translation beside a phrase that is no quotation of a verse
    if (arLeft(tq).length && asVerse(tq)) quoted++;
    // kept Arabic as a hadith the published data knows, with that hadith's translation: the order lets a hadith stay
    if (arLeft(tq).length && asHadith(tq) && !asVerse(tq)) hadithKept++;
    if (arLeft(tq).length && !asVerse(tq) && !asHadith(tq)) bare++;
  }
  ok('in prose: hadith and du\'a phrases matched as verses 5/12 -> 0', prose === 0, prose + '/12');
  ok('between «»: kept Arabic as a verse 11/12 -> 0', quoted === 0, quoted + '/12');
  console.log('        between «»: kept Arabic as a hadith with its published translation: ' + hadithKept + '/12');
  ok('kept Arabic with no translation at all 4 -> 0', bare === 0, String(bare));
  let marked = 0; let long = 0;
  for (const v of MARKED) { const t = await run('قال الله تعالى: ﴿' + v + '﴾ وهذا أصل في الباب.'); if (/\d+:\d+/.test(t) && arLeft(t).length) marked++; }
  for (const v of LONG) { const t = await run('وقد قال الله تعالى في كتابه ' + v + ' وهذا أصل في الباب.'); if (/\d+:\d+/.test(t) && arLeft(t).length) long++; }
  ok('the positive side holds: ten marked verses and five long unmarked ones are matched 15/15', marked + long === 15, 'marked ' + marked + '/10, long ' + long + '/5');

  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
