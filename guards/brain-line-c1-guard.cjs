// guards/brain-line-c1-guard.cjs -- ITEM C1 (axis row 1) -- 2026-10-15 brain-line
//
// TWELVE OF FORTY-ONE RELIGIOUS QUESTIONS WENT TO THE GENERAL PATH. Measured on 7ba44481
// (side-brain-line-2026-10-15/side/axis-1-classify.md): «ما معنى الكفر؟», «اشرح لي معنى الاستواء»,
// «ما المقصود بالمغضوب عليهم والضالين؟», «من هم أصحاب الكهف؟», «كم مسافة القصر؟», «من هي خديجة بنت
// خويلد؟», «ماذا حدث في غزوة بدر؟», «من أول من أسلم من الصبيان؟», «ما آداب الأكل والشرب؟», «ماذا أقول إذا
// عطست؟», «ما آداب زيارة المريض؟», «كيف أبر والدي بعد موتهما؟» -- classifyRoute GEN, runtime GENERAL: no
// tools, no retrieval, and every source tag stripped.
//
// What this guard holds: every one of the forty-one is NOT GENERAL, whether the front sorter (injected, no
// model) says RELIGIOUS, times out or fails; and twenty worldly controls ARE GENERAL when the sorter says
// WORLDLY. The runtime is computed exactly as api/ask.js computes it: classifyRoute -> planAsk ->
// classifyReligiousRuntime -> sorterEligibility (adult, free brain on, switch on) -> runtimeAfterSorter.
//
// Fixtures: the forty-one are read from sessions/side-brain-line-2026-10-15/side/classify-list.md
// (lines 6-46 of its code block) when that file is on this machine, and from the copy below otherwise
// (copied verbatim from the same file). Controls: four from the order (directive:114), eight from the
// repository's own comments (lib/route-classify.js:164, :198; lib/front-sorter.js:151-159), eight COMPOSED.
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

// side-brain-line-2026-10-15/side/classify-list.md, verbatim
const FORTY_ONE = [
  ['A01', 'ما معنى الكفر؟'], ['A02', 'اشرح لي معنى الاستواء'], ['A03', 'ما الفرق بين الإسلام والإيمان والإحسان؟'],
  ['A04', 'ما معنى أن القرآن كلام الله غير مخلوق؟'], ['A05', 'هل يرى المؤمنون ربهم يوم القيامة؟'], ['A06', 'ما هي نواقض الإسلام؟'],
  ['A07', 'ما معنى التوكل على الله؟'], ['T01', 'ما معنى قوله تعالى: إن مع العسر يسرا؟'], ['T02', 'ما تفسير آية الكرسي؟'],
  ['T03', 'ما معنى الصراط المستقيم في سورة الفاتحة؟'], ['T04', 'لماذا سميت سورة البقرة بهذا الاسم؟'], ['T05', 'ما المقصود بالمغضوب عليهم والضالين؟'],
  ['T06', 'ما سبب نزول سورة الكوثر؟'], ['T07', 'من هم أصحاب الكهف؟'], ['H01', 'هل حديث «اطلبوا العلم ولو بالصين» صحيح؟'],
  ['H02', 'ما شرح حديث إنما الأعمال بالنيات؟'], ['H03', 'من روى حديث جبريل الطويل؟'], ['H04', 'ما معنى الحديث القدسي؟'],
  ['H05', 'ما الفرق بين الحديث الصحيح والحسن؟'], ['H06', 'كم عدد أحاديث صحيح البخاري؟'], ['H07', 'هل "الدين المعاملة" حديث صحيح؟'],
  ['F01', 'ما حكم الجمع بين الصلاتين للمسافر؟'], ['F02', 'كم مسافة القصر؟'], ['F03', 'هل يجوز أن أصلي وأنا جالس على الكرسي؟'],
  ['F04', 'ما الذي يفسد الوضوء؟'], ['F05', 'كم نصاب زكاة الذهب؟'], ['F06', 'هل يفطر من بلع ريقه؟'],
  ['F07', 'ما حكم الفطر في رمضان لمريض السكري؟'], ['S01', 'متى ولد النبي صلى الله عليه وسلم؟'], ['S02', 'كم كان عمر النبي ﷺ حين نزل عليه الوحي؟'],
  ['S03', 'ما قصة الهجرة إلى المدينة؟'], ['S04', 'من هي خديجة بنت خويلد؟'], ['S05', 'ماذا حدث في غزوة بدر؟'],
  ['S06', 'من أول من أسلم من الصبيان؟'], ['S07', 'كيف كان النبي يعامل أهله؟'], ['D01', 'ما آداب الأكل والشرب؟'],
  ['D02', 'ماذا أقول إذا عطست؟'], ['D03', 'ما آداب زيارة المريض؟'], ['D04', 'كيف أبر والدي بعد موتهما؟'],
  ['D05', 'ما الدعاء عند دخول المنزل؟'], ['D06', 'هل يجوز الكذب للإصلاح بين الناس؟'],
];
const CONTROLS = [
  ['directive:114', 'ما جذر ٤٩؟'], ['directive:114', 'عاصمة فرنسا'], ['directive:114', 'كيف أطبخ الرز'], ['directive:114', 'ما هو الذكاء الاصطناعي'],
  ['route-classify.js:164', 'كم يساوي ٧ × ٨؟'], ['route-classify.js:198', 'تيلفون وكفر سعرهم مع بعض ١١٠'], ['route-classify.js:198', 'كم شهر بالسنة الميلادية'],
  ['front-sorter.js:151', 'رتّب لي أسماء الطلاب أبجديًّا: يوسف، إبراهيم، محمد'], ['front-sorter.js:152', 'اكتب لي إيميلًا لشركة الطيران أطلب استرجاع المبلغ'],
  ['front-sorter.js:153', 'كيف أفتح حسابًا في البنك؟'], ['front-sorter.js:155', 'اقترح لي طريقة لتغليف هدايا العيد'],
  ['front-sorter.js:159', 'ترجم لي هذا العقد التجاري إلى الإنجليزية'],
  ['COMPOSED', 'ما أطول نهر في العالم؟'], ['COMPOSED', 'كيف أكتب سيرة ذاتية للوظيفة؟'], ['COMPOSED', 'كم درجة غليان الماء؟'],
  ['COMPOSED', 'اشرح لي قانون نيوتن الثاني'], ['COMPOSED', 'كيف أتعلم البرمجة بلغة بايثون؟'], ['COMPOSED', 'كيف أحسب مساحة الدائرة؟'],
  ['COMPOSED', 'متى بدأت الحرب العالمية الثانية؟'], ['COMPOSED', 'كم عدد سكان الكويت؟'],
];

(async () => {
  const RC = await esm('lib/route-classify.js');
  const SD = await esm('lib/stored-deen.js');
  const AP = await esm('lib/ask-plan.js');
  const FS = await esm('lib/front-sorter.js');

  // The list on disk, when present, must be the list above.
  const LIST = 'C:/Users/passe/projects/ustaz-archive/sessions/side-brain-line-2026-10-15/side/classify-list.md';
  if (fs.existsSync(LIST)) {
    const onDisk = [];
    for (const l of fs.readFileSync(LIST, 'utf8').split('\n')) { const m = l.match(/^([A-Z]\d\d) \| ([^|]+) \| (.+)$/); if (m) onDisk.push([m[1], m[3].trim()]); }
    ok('the forty-one above are classify-list.md verbatim', JSON.stringify(onDisk) === JSON.stringify(FORTY_ONE), onDisk.length + ' on disk');
  }

  const runtimeOf = (q, verdict) => {
    const messages = [{ role: 'user', content: q }];
    const route = RC.classifyRoute(messages);
    const plan = AP.planAsk(messages, { policyEnabled: true });
    const lexical = SD.classifyReligiousRuntime(q, plan, route);
    const el = FS.sorterEligibility({ enabled: true, band: 'adult', freeBrainEnabled: true, runtime: lexical, text: q });
    return { lexical, final: el.ask ? FS.runtimeAfterSorter(lexical, verdict) : lexical, asked: el.ask };
  };

  console.log('-- 1. the forty-one are never GENERAL: sorter RELIGIOUS, TIMEOUT or ERROR');
  for (const verdict of ['religious', 'timeout', 'error']) {
    const gen = FORTY_ONE.filter(([, q]) => runtimeOf(q, verdict).final === 'GENERAL').map(([id]) => id);
    ok('sorter ' + verdict + ': 41/41 not GENERAL', gen.length === 0, 'GENERAL: ' + gen.join(','));
  }
  console.log('-- 2. the twelve measured ones, one by one (sorter RELIGIOUS)');
  for (const id of ['A01', 'A02', 'T05', 'T07', 'F02', 'S04', 'S05', 'S06', 'D01', 'D02', 'D03', 'D04']) {
    const q = FORTY_ONE.find(([i]) => i === id)[1];
    const r = runtimeOf(q, 'religious');
    ok(id + ' -> ' + r.final, r.final !== 'GENERAL');
  }
  console.log('-- 3. twenty worldly controls are GENERAL when the sorter says WORLDLY');
  for (const [src, q] of CONTROLS) {
    const r = runtimeOf(q, 'worldly');
    ok('[' + src + '] GENERAL', r.final === 'GENERAL', 'lexical ' + r.lexical + ' asked ' + r.asked);
  }

  console.log('-- 4. the default is DEEN: a lexically GENERAL turn is asked, and only WORLDLY keeps it GENERAL');
  {
    const el = FS.sorterEligibility({ enabled: true, band: 'adult', freeBrainEnabled: true, runtime: 'GENERAL', text: 'ما أطول نهر في العالم؟' });
    ok('an adult turn the lexicon calls GENERAL is asked', el.ask === true, JSON.stringify(el));
    for (const s of ['religious', 'timeout', 'error']) ok('GENERAL + sorter ' + s + ' -> DEEN (not GENERAL)', FS.runtimeAfterSorter('GENERAL', s) !== 'GENERAL', FS.runtimeAfterSorter('GENERAL', s));
    ok('GENERAL + sorter worldly -> GENERAL', FS.runtimeAfterSorter('GENERAL', 'worldly') === 'GENERAL');
    ok('the switch off keeps the lexical value (disabled)', FS.runtimeAfterSorter('GENERAL', 'disabled') === 'GENERAL');
    for (const rt of ['LOCAL_QURAN', 'LOCAL_ADHKAR', 'LOCAL_WORSHIP']) ok(rt + ' is still not asked', FS.sorterEligibility({ enabled: true, band: 'adult', freeBrainEnabled: true, runtime: rt, text: 'x' }).ask === false);
    const askSrc = fs.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
    ok('api/ask.js: the general frame only where the sorter said WORLDLY',
      /const frameFor = \(runtime, sorter\) => \([^\n]*runtime === 'GENERAL' && sorter === 'worldly'/.test(askSrc)
      && /frameFor\(currentRuntime, sorterState\) === 'general'/.test(askSrc));
  }

  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-c1: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
