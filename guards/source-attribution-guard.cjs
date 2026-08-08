// guards/source-attribution-guard.cjs — A PERSON IS NAMED BY A PAGE, OR NOT AT ALL.
//
// ── THE THREE MEASURED FAILURES THIS GATE EXISTS TO MAKE IMPOSSIBLE ──────────
//
//   1. «ما رأي طارق العلي في أحكام العدة؟» was answered with «داعية وخطيب كويتي معروف من أهل
//      العلم… يتبنّى المذهب الحنفي» plus four positions credited to «رأيه» — over a card from
//      alukah.net titled «أحكام العدة للمرأة (خطبة)», a page that does not contain his name
//      anywhere. He is a Kuwaiti comic actor.
//
//   2. «الشيخ مطلق الجاسر — رحمه الله — إعلامي سعودي محترم». He is alive, he is a scholar, and
//      no page said either half.
//
//   3. «اتفق ابن حجر مع الجمهور… في الفتح» over an إسلام ويب page that never mentions him.
//
// ── THE COMMON ROOT ──────────────────────────────────────────────────────────
// In all three the app decided WHO A SENTENCE MAY NAME from the model's recollection rather than
// from the page in hand. So the rule here is about the SOURCE CLASS and nothing else, in four
// ordered tiers, and it runs without a model call:
//
//   1. extracted metadata (`author`) outranks everything, even a domain owned by somebody else;
//   2. domain ownership, when there is no byline — unless the extracted text transmits another
//      registered entity («اللجنة الدائمة», «قال ابن تيمية», «سُئل الشيخ فلان»), which drops the
//      attribution to the SITE;
//   3. the name in the extracted text, on an aggregator or an ownerless domain;
//   4. otherwise NOBODY, and a sentence crediting a person with a صفة or a موقف is dropped while
//      the ruling stays attributed to its page.
//
// Usage: node guards/source-attribution-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  return ok(name, a === e, 'expected ' + e + '\n        actual   ' + a);
}
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

// ── THE PAGE FROM INCIDENT 1, in shape: a khutbah on an aggregator, no byline, and his name
//    nowhere in it. Long enough to be a real extraction rather than a stub.
const KHUTBAH_TEXT = [
  'أحكام العدة للمرأة. الحمد لله رب العالمين، أما بعد فإن العدة مدة تتربص فيها المرأة بعد فراق زوجها.',
  'وعدة المتوفى عنها زوجها أربعة أشهر وعشرًا لقوله تعالى: والذين يتوفون منكم ويذرون أزواجًا يتربصن بأنفسهن أربعة أشهر وعشرًا.',
  'وعدة المطلقة ثلاثة قروء، وعدة الحامل وضع حملها. وتجتنب المعتدة الطيب والزينة والخروج لغير حاجة.',
].join(' ');

// ── THE ANSWER THAT WAS ACTUALLY SERVED, in shape: identity, madhhab, then positions.
const TARIQ_DRAFT = [
  'طارق العلي داعية وخطيب كويتي معروف من أهل العلم.',
  'ويتبنى طارق العلي المذهب الحنفي في أحكام العدة.',
  'ويرى طارق العلي أن عدة المتوفى عنها زوجها أربعة أشهر وعشرًا.',
  'وعدة المطلقة ثلاثة قروء كما هو مقرر في المصدر المذكور.',
].join(' ');

(async function main() {
  console.log('=== source-attribution-guard — a person is named by a page, or not at all ===');

  let SA = null, CG = null;
  try {
    SA = await esm('lib/policy/source-attribution.js');
    CG = await esm('lib/policy/consistency-gate.js');
  } catch (e) {
    ok('lib/policy/source-attribution.js loads', false, e.message);
    console.log('\n=== ' + (checks - failures) + '/' + checks + ' — FAIL ===');
    process.exit(1);
  }

  // ==========================================================================
  console.log('\n=== A. THE FOUR TIERS, IN ORDER ===');
  {
    eq('the classes are declared and frozen',
      Object.keys(SA.ATTRIBUTION_SOURCE_CLASS).sort(),
      ['DOMAIN_OWNER', 'METADATA_AUTHOR', 'NAME_IN_TEXT', 'SITE_ONLY']);

    // ── TIER 1: extracted metadata outranks the domain that hosts it ─────────
    const byline = SA.pageAttribution({
      url: 'https://binbaz.org.sa/fatwas/12345',
      author: 'محمد بن صالح العثيمين',
      text: KHUTBAH_TEXT,
    });
    eq('TIER 1 — an extracted byline outranks the domain owner',
      [byline.class, byline.personIds], [SA.ATTRIBUTION_SOURCE_CLASS.METADATA_AUTHOR, ['ibn-uthaymeen']]);

    // ── TIER 2: domain ownership, no byline ──────────────────────────────────
    const owned = SA.pageAttribution({
      url: 'https://binbaz.org.sa/fatwas/9876',
      author: '',
      text: 'حكم التصوير باليد للذوات ذوات الأرواح لا يجوز، وأما التصوير الفوتوغرافي فللعلماء فيه كلام، والأحوط تركه إلا لحاجة كالتابعية ورخصة القيادة.',
    });
    eq('TIER 2 — a page on his own domain with no byline is his',
      [owned.class, owned.personIds], [SA.ATTRIBUTION_SOURCE_CLASS.DOMAIN_OWNER, ['ibn-baz']]);

    const adapted = SA.pageAttribution({
      url: 'https://binothaimeen.net/content/1234',
      author: '',
      text: 'سئل فضيلة الشيخ عمن أسقطت دون ثمانين يومًا فأجاب بأن ما نزل قبل تخلق الجنين لا يعد نفاسًا وتصلي وتصوم.',
    });
    eq('TIER 2 — the adapted corpus keeps its owner',
      [adapted.class, adapted.personIds], [SA.ATTRIBUTION_SOURCE_CLASS.DOMAIN_OWNER, ['ibn-uthaymeen']]);

    // ── TIER 2's EXCEPTION: his domain, transmitting somebody else ───────────
    const transmitted = SA.pageAttribution({
      url: 'https://binbaz.org.sa/fatwas/5555',
      author: '',
      text: 'جاء في فتوى اللجنة الدائمة للبحوث العلمية والإفتاء أن هذا العمل لا يجوز، وقد نقلت اللجنة الدائمة عن جمهور أهل العلم المنع منه.',
    });
    eq('TIER 2 EXCEPTION — a transmitted committee fatwa drops the attribution to the site',
      [transmitted.class, transmitted.personIds], [SA.ATTRIBUTION_SOURCE_CLASS.SITE_ONLY, []]);

    // THE OWNER LOSES THE PAGE, AND THE PAGE DOES NOT STOP BEING A PAGE. It is read under tier 3
    // with the owner struck out — which is what keeps the previous batch's grade-C encyclopedic
    // transmission alive on islamqa.info, a host that is owned by a person and carries most of it.
    const transmittedPerson = SA.pageAttribution({
      url: 'https://binbaz.org.sa/fatwas/5556',
      author: '',
      text: 'قال ابن تيمية رحمه الله في هذه المسألة كلامًا نفيسًا، وقد نقل عنه أهل العلم أن الأمر فيه سعة، وجاء في مجموع الفتاوى ما يؤيده.',
    });
    eq('TIER 2 EXCEPTION — a transmitted named scholar is the one who may be named',
      [transmittedPerson.class, transmittedPerson.personIds],
      [SA.ATTRIBUTION_SOURCE_CLASS.NAME_IN_TEXT, ['ibn-taymiyyah']]);
    ok('...and the owner is struck out by it, which is the point of the exception',
      !transmittedPerson.personIds.includes('ibn-baz'));

    // AND THE ENCYCLOPEDIC TRANSMISSION THE PREVIOUS BATCH BUILT still has a licence. islamqa.info
    // carries `ownerId: almunajjid`, so this page transmits another and would have licensed
    // nobody at all under a bare SITE_ONLY.
    const encyclopedic = SA.pageAttribution({
      url: 'https://islamqa.info/ar/answers/8360/',
      author: '',
      text: 'وقد ذهب شيخ الإسلام ابن تيمية رحمه الله إلى أن من ترك الصلاة عمدًا حتى خرج وقتها فلا يشرع له قضاؤها، وخالفه في ذلك جمهور أهل العلم.',
    });
    eq('the grade-C encyclopedic transmission keeps its licence',
      [encyclopedic.class, encyclopedic.personIds],
      [SA.ATTRIBUTION_SOURCE_CLASS.NAME_IN_TEXT, ['ibn-taymiyyah']]);

    // ── TIER 3: an aggregator, and the name really is in the page ────────────
    const inText = SA.pageAttribution({
      url: 'https://www.alukah.net/sharia/0/1234/',
      author: '',
      text: 'وقد ذكر الشيخ ابن عثيمين في هذه المسألة أن الحكم كذا، ونقل عنه تلاميذه ذلك في أكثر من موضع من الشرح الممتع على زاد المستقنع.',
    });
    eq('TIER 3 — on an aggregator, a registered name present in the text licenses it',
      [inText.class, inText.personIds], [SA.ATTRIBUTION_SOURCE_CLASS.NAME_IN_TEXT, ['ibn-uthaymeen']]);

    // ── TIER 4: the khutbah page from the incident ───────────────────────────
    const khutbah = SA.pageAttribution({
      url: 'https://www.alukah.net/sharia/0/99999/',
      author: '',
      text: KHUTBAH_TEXT,
    });
    eq('TIER 4 — the alukah khutbah page licenses nobody',
      [khutbah.class, khutbah.personIds], [SA.ATTRIBUTION_SOURCE_CLASS.SITE_ONLY, []]);

    // A one-word surface that is also an ordinary Arabic word may not license anybody.
    const thursday = SA.pageAttribution({
      url: 'https://www.islamweb.net/ar/fatwa/1111/',
      author: '',
      text: 'من صام يوم الخميس تطوعًا فله أجره، وقد كان النبي صلى الله عليه وسلم يتحرى صيام الاثنين والخميس، وليس في ذلك إلزام.',
    });
    eq('TIER 3 — a bare one-word surface («الخميس») licenses nobody',
      [thursday.class, thursday.personIds], [SA.ATTRIBUTION_SOURCE_CLASS.SITE_ONLY, []]);

    // An institution's domain is never a person, whoever the page names.
    const committee = SA.pageAttribution({
      url: 'https://eftaa.awqaf.gov.kw/fatwa/1',
      author: '',
      text: 'أجابت إدارة الإفتاء بأن هذه المعاملة جائزة بشروطها، وهذا ما عليه العمل في اللجان الشرعية المعاصرة.',
    });
    eq('an institution-owned domain never licenses a person',
      [committee.class, committee.personIds], [SA.ATTRIBUTION_SOURCE_CLASS.SITE_ONLY, []]);
  }

  // ==========================================================================
  console.log('\n=== B. THE LICENCE OVER A WHOLE RESULT SET ===');
  {
    const licence = SA.attributionLicence([
      { url: 'https://www.alukah.net/sharia/0/99999/', author: '', text: KHUTBAH_TEXT },
      { url: 'https://binbaz.org.sa/fatwas/9876', author: '', text: 'حكم التصوير عند أهل العلم فيه تفصيل معروف، والأحوط تركه إلا لحاجة معتبرة شرعًا.' },
    ]);
    eq('the licence is the union of what the pages support', licence.personIds, ['ibn-baz']);
    ok('...and it carries the per-page classes for the log', Array.isArray(licence.pages) && licence.pages.length === 2);

    eq('no pages at all licenses nobody', SA.attributionLicence([]).personIds, []);
    eq('a null argument licenses nobody', SA.attributionLicence(null).personIds, []);
  }

  // ==========================================================================
  console.log('\n=== C. THE DRAFT SCREEN — the three incidents, sentence by sentence ===');
  {
    // INCIDENT 1. The reader named him, so he is in the alternation; no page licenses him.
    const v1 = CG.screenDraft(TARIQ_DRAFT, {
      entity: 'طارق العلي',
      notDirectlyVerified: true,
      searchProven: true,
      allowSourcedPosition: true,
      sourceLicence: [],
    });
    ok('INCIDENT 1 — every sentence naming him is dropped',
      v1.droppedSentences.length === 3, JSON.stringify(v1.droppedSentences));
    ok('...for an attribution no source licenses',
      v1.problems.includes(CG.PROBLEM.ATTRIBUTION_NOT_LICENSED), JSON.stringify(v1.problems));
    ok('...and the ruling sentence that names nobody survives',
      /وعدة المطلقة ثلاثة قروء/.test(v1.text), JSON.stringify(v1.text));

    // The «صفة» vocabulary the rule names, one sentence each.
    const each = (s) => CG.screenDraft(s, {
      entity: 'طارق العلي', notDirectlyVerified: true, searchProven: true, sourceLicence: [],
    }).problems.includes(CG.PROBLEM.ATTRIBUTION_NOT_LICENSED);
    ok('صفة — a scholarly rank («من أهل العلم»)', each('طارق العلي من أهل العلم.'));
    ok('صفة — a preaching role («داعية وخطيب»)', each('طارق العلي داعية وخطيب.'));
    ok('صفة — a nationality', each('طارق العلي كويتي.'));
    ok('صفة — a madhhab adopted', each('يتبنى طارق العلي المذهب الحنفي.'));
    ok('موقف — a position', each('يرى طارق العلي وجوب ذلك.'));
    ok('موقف — an alignment («اتفق … مع الجمهور»)', each('اتفق طارق العلي مع الجمهور.'));

    // INCIDENT 2.
    const v2 = CG.screenDraft('الشيخ مطلق الجاسر — رحمه الله — إعلامي سعودي محترم.', {
      entity: 'مطلق الجاسر',
      notDirectlyVerified: true, searchProven: true, sourceLicence: [],
    });
    ok('INCIDENT 2 — the fabricated obituary is dropped', v2.dropWhole, JSON.stringify(v2));

    // INCIDENT 3. An إسلام ويب page that never mentions him.
    const licence3 = SA.attributionLicence([{
      url: 'https://www.islamweb.net/ar/fatwa/22222/',
      author: '',
      text: 'ذهب جمهور أهل العلم إلى أن هذا الأمر على التفصيل المذكور، وهو ما عليه عامة الفقهاء من غير خلاف معتبر.',
    }]);
    const v3 = CG.screenDraft('اتفق ابن حجر مع الجمهور في هذه المسألة في الفتح.', {
      entity: 'ابن حجر',
      notDirectlyVerified: true, searchProven: true,
      sourceLicence: licence3.personIds,
    });
    ok('INCIDENT 3 — «اتفق ابن حجر مع الجمهور» over a page that never names him is dropped',
      v3.problems.includes(CG.PROBLEM.ATTRIBUTION_NOT_LICENSED), JSON.stringify(v3.problems));

    // ── AND THE GREEN SIDE: a licence really does license ────────────────────
    const licensed = CG.screenDraft('ذكر موقع ابن باز أن حكم التصوير فيه تفصيل، ويرى ابن باز تركه إلا لحاجة.', {
      entity: 'ابن باز',
      notDirectlyVerified: true, searchProven: true, allowSourcedPosition: true,
      sourceLicence: ['ibn-baz'],
    });
    ok('GREEN — a licensed man may be credited by the source-class rule',
      !licensed.problems.includes(CG.PROBLEM.ATTRIBUTION_NOT_LICENSED), JSON.stringify(licensed.problems));

    // ── AND THE RULE IS OFF WHEN NOBODY SUPPLIED A LICENCE ───────────────────
    // An absent `sourceLicence` is "this caller has not been wired yet", NOT "license nothing":
    // a check that fired on absence would refuse every existing caller's draft.
    const unwired = CG.screenDraft(TARIQ_DRAFT, {
      entity: 'طارق العلي', notDirectlyVerified: true, searchProven: true,
    });
    ok('an absent licence leaves the shipped behaviour exactly as it was',
      !unwired.problems.includes(CG.PROBLEM.ATTRIBUTION_NOT_LICENSED), JSON.stringify(unwired.problems));
  }

  // ==========================================================================
  console.log('\n=== D. BOTH PATHS ARE WIRED TO THE SAME RULE ===');
  {
    const ask = read('api/ask.js');
    ok('the legacy path imports the rule',
      /from '\.\.\/lib\/policy\/source-attribution\.js'/.test(ask));
    ok('...and computes it from the pages it actually retrieved',
      /sourceLicence = attributionLicence\(/.test(ask));
    // SLICED, NOT MATCHED AT A DISTANCE. This was `/screenDraft\([\s\S]{0,2400}?sourceLicence/`,
    // and a character budget across a call that carries explanatory comments fails the day
    // somebody adds a paragraph to it — which reads as "the licence is no longer wired" when
    // nothing is wired differently. (Measured: ج٢ added 14 comment lines inside this very call and
    // pushed `sourceLicence` past 2400 characters. Same lesson as identity-guard section H.)
    // The call is taken whole and asked whether the key is in IT.
    {
      const start = ask.indexOf('screenDraft(');
      const end = start === -1 ? -1 : ask.indexOf('});', start);
      const call = start === -1 || end === -1 ? '' : ask.slice(start, end);
      ok('...and passes it into the draft screen itself',
        call.includes('sourceLicence'), call.slice(0, 200));
    }

    const g = read('lib/ledger/gates.js');
    ok('the ledger path imports the same rule, not a copy',
      /from '\.\.\/policy\/source-attribution\.js'/.test(g));
    ok('...and consults it in the deterministic half of gate 3',
      /gate3Deterministic[\s\S]{0,4000}attributionLicence\(|gate3Deterministic[\s\S]{0,4000}unlicensedAttribution\(/.test(g));

    ok('the rule itself makes no network or model call',
      !/fetch\(|ANTHROPIC|callModel/.test(read('lib/policy/source-attribution.js')));
  }

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL ===' : ' — PASS ==='));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
