// guards/name-presence-guard.cjs — a name nobody knows is not a shaykh, and the app says so.
//
// THE MEASURED DEFECTS THIS PINS (batch 4, §2 and §3):
//
//   * «ما رأي الشيخ فلان الفلاني في كذا؟» — a name invented on the spot — was answered as though he
//     were a scholar, with «لم أقف على قولٍ للشيخ…»: the title conceded in the sentence that
//     withheld the fatwa.
//   * The shared refusal said «لا أنسبُ إلى هذا العالِم قولًا…» about خالد عبدالرحمن (a singer) and
//     طارق العلي (a comic actor).
//   * «من هو محمد صلاح؟» was answered correctly and then had «النقطة الشرعية» about players'
//     salaries appended, carrying an islamqa card — a fatwa nobody asked for.
//   * A reply cited «Home — موقع د. مطلق الجاسر»: the site ROOT, as though it were an article.
//   * «ما حكم بيع الذهب بالتقسيط؟» ended with the referral tail TWICE.
//   * «الراجح أنّ من ترك الصلاة عمدًا وجب عليه قضاؤها» went out with nobody credited with the
//     preference and no page stating it — the application weighing the qawls itself.
//
// AND THE CONSTRAINT EVERY CHECK BELOW IS WRITTEN UNDER. The old identity check was DELETED because
// it asked a model «is this name a scholar?» and its confident wrong «yes» was unchecked. The
// replacement may not be that check returning: §B asserts NO model call is spent deciding who
// anybody is, and that a found page grants no attribution, no grade and no list membership.
//
// Usage: node guards/name-presence-guard.cjs
'use strict';
const fs = require('fs');
const os = require('os');
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
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

const DEVICE = 'abcdefgh12345678';
const SACRED_CASES = [
  'قال رسول الله صلى الله عليه وسلم: إنما الأعمال بالنيات.',
  'قال رسولُ اللهِ ﷺ: إنما الأعمال بالنيات.',
  'قال الرسول صلى الله عليه وسلم: الدين النصيحة.',
  'قال الرسول ﷺ: الدين النصيحة.',
  'قال النبي صلى الله عليه وسلم: من غشنا فليس منا.',
  'قال النبي ﷺ: من غشنا فليس منا.',
  'يقول رسول الله صلى الله عليه وسلم: لا ضرر ولا ضرار.',
  'يقول رسول الله ﷺ: لا ضرر ولا ضرار.',
  'يقول النبي صلى الله عليه وسلم: المسلم من سلم المسلمون من لسانه ويده.',
  'يقول النبي ﷺ: المسلم من سلم المسلمون من لسانه ويده.',
  'عن رسول الله صلى الله عليه وسلم أنه قال: الدين النصيحة.',
  'عن رسول الله ﷺ أنه قال: الدين النصيحة.',
  'عن النبي صلى الله عليه وسلم أنه قال: لا ضرر ولا ضرار.',
  'عن النبي ﷺ أنه قال: لا ضرر ولا ضرار.',
  'قال صلى الله عليه وسلم: إنما الأعمال بالنيات.',
  'قال الله تعالى: إن مع العسر يسرا.',
  'يقول الله تعالى: إن مع العسر يسرا.',
  'قال تعالى: إن مع العسر يسرا.',
  'ما صحة ما قال رسول الله ﷺ؟',
  'هل ثبت ما قال النبي ﷺ؟',
  'ورد في السؤال: قال رسول الله ﷺ إنما الأعمال بالنيات.',
  'ما معنى ما نص عليه النبي ﷺ؟',
  'ماذا اختار النبي ﷺ؟',
  'ماذا رجّح النبي ﷺ؟',
];

const HUMAN_DIVINE_NAME_CASES = [
  ['ما رأي الشيخ عبد الله السالم في قصر الصلاة؟', 'عبد الله السالم'],
  ['ما رأي الشيخ عبدالله السالم في قصر الصلاة؟', 'عبدالله السالم'],
  ['ما رأي الشيخ عبد الرحمن السعدي في قصر الصلاة؟', 'عبد الرحمن السعدي'],
  ['ما رأي الشيخ عبدالرحمن السعدي في قصر الصلاة؟', 'عبدالرحمن السعدي'],
  ['ما رأي الشيخ عبد الرحيم الحسن في قصر الصلاة؟', 'عبد الرحيم الحسن'],
  ['ما رأي الشيخ عبدالرحيم الحسن في قصر الصلاة؟', 'عبدالرحيم الحسن'],
  ['ما رأي الشيخ عبد العزيز الهاشمي في قصر الصلاة؟', 'عبد العزيز الهاشمي'],
  ['ما رأي الشيخ عبدالعزيز الهاشمي في قصر الصلاة؟', 'عبدالعزيز الهاشمي'],
  ['ما رأي الشيخ عبد الله بن مسعود في قصر الصلاة؟', 'عبد الله بن مسعود'],
  ['ما رأي الشيخ عبد الله بن عباس في قصر الصلاة؟', 'عبد الله بن عباس'],
];

(async function main() {
  console.log('=== name-presence-guard — an unknown name is named as unknown ===');

  const NP = await esm('lib/policy/name-presence.js');
  const AT = await esm('lib/attribution.js');
  const AP = await esm('lib/ask-plan.js');
  const EK = await esm('lib/policy/entity-knowledge.js');
  const SA = await esm('lib/policy/sacred-attribution.js');
  const CG = await esm('lib/policy/consistency-gate.js');
  const FT = await esm('lib/finalize-reader-text.js');
  const RT = await esm('lib/policy/referral-tail.js');
  const PG = await esm('lib/source-page-gates.js');
  const RC = await esm('lib/route-classify.js');
  const RETRIEVE = await esm('lib/retrieve.js');
  const DAILY = await esm('lib/ledger/daily-budget.js');
  const DC = await esm('lib/daycap.js');
  const DAY = DC;
  const STORE = await esm('lib/ledger/redis.js');

  // =========================================================================
  console.log('\n=== A1. SACRED ATTRIBUTION FRAMES NEVER BECOME PEOPLE ===');
  {
    for (const question of SACRED_CASES) {
      const messages = [{ role: 'user', content: question }];
      const detection = AT.detectAttribution(messages);
      const plan = AP.planAsk(messages, { policyEnabled: true });
      const unregistered = EK.unregisteredNameInQuestion(plan);
      const shape = NP.probeShape(question, unregistered);
      const stripped = unregistered ? EK.stripEntityFromQuery(question, unregistered) : question.trim();
      ok('sacred chain: no scholar candidate — «' + question.slice(0, 28) + '…»',
        detection.scholarName === '', JSON.stringify(detection));
      ok('sacred chain: typed veto is not bypassed by raw attribution',
        unregistered === '', JSON.stringify({ mode: plan.attributionMode, raw: plan.attribution, unregistered }));
      ok('sacred chain: no world probe is shaped',
        shape.probe === false, JSON.stringify(shape));
      ok('sacred chain: no presence or UNKNOWN identity line can be owed',
        NP.presenceLine(shape.probe
          ? { probed: true, found: false, name: shape.name, kind: shape.kind }
          : { probed: false }) === '');
      ok('sacred chain: the reader/search query remains byte-for-byte intact',
        stripped === question.trim(), JSON.stringify({ stripped, question }));
    }

    for (const [question, expectedName] of HUMAN_DIVINE_NAME_CASES) {
      const messages = [{ role: 'user', content: question }];
      const detection = AT.detectAttribution(messages);
      const plan = AP.planAsk(messages, { policyEnabled: true });
      const unregistered = EK.unregisteredNameInQuestion(plan);
      const shape = NP.probeShape(question, unregistered);
      ok('human divine-name chain: capture is complete — «' + expectedName + '»',
        detection.scholarName === expectedName, JSON.stringify(detection));
      ok('human divine-name chain: the human name is not a sacred subject',
        SA.containsSacredSubject(expectedName) === false, expectedName);
      ok('human divine-name chain: typed unresolved identity survives to the bounded probe',
        plan.attributionMode === 'namedScholarOpinion' && unregistered === expectedName
          && shape.probe === true && shape.name === expectedName,
        JSON.stringify({ mode: plan.attributionMode, entities: plan.entities, unregistered, shape }));
    }

    const detected = (question) => AT.detectAttribution([{ role: 'user', content: question }]);
    ok('ordinary scholar remains: ابن باز', detected('ما رأي ابن باز في التصوير؟').scholarName === 'ابن باز');
    ok('ordinary scholar remains: الشيخ صالح الفوزان',
      detected('ما رأي الشيخ صالح الفوزان في المسألة؟').scholarName === 'صالح الفوزان');
    ok('embedded sacred wording does not veto the selected ordinary-scholar capture',
      detected('ما رأي ابن باز في قول الله تعالى؟').scholarName === 'ابن باز');
    ok('عبد الله بن مسعود is not cropped at «الله»',
      detected('ما رأي عبد الله بن مسعود في المسألة؟').scholarName === 'عبد الله بن مسعود');
    ok('عبد الله بن عباس is not cropped at «الله»',
      detected('ما رأي عبد الله بن عباس في المسألة؟').scholarName === 'عبد الله بن عباس');
    ok('the honorific suffix remains a suffix, not part of the name',
      detected('ما رأي ابن باز رحمه الله في التصوير؟').scholarName === 'ابن باز');
    const unknownPlan = AP.planAsk(
      [{ role: 'user', content: 'ما رأي الشيخ فلان الفلاني في قصر الصلاة؟' }], { policyEnabled: true });
    ok('a genuine typed unknown multi-word person still reaches the bounded probe',
      NP.probeShape(unknownPlan.attribution.question, EK.unregisteredNameInQuestion(unknownPlan)).probe === true);
    const mismatchedTypedPlan = {
      ...unknownPlan,
      entities: unknownPlan.entities.map((entity) => ({ ...entity, surface: 'شخص آخر' })),
    };
    ok('F-081 causal regression: an unrelated typed person cannot license the raw captured name',
      EK.unregisteredNameInQuestion(mismatchedTypedPlan) === '');
    const vetoedPlan = AP.planAsk(
      [{ role: 'user', content: 'ما رأي خالد عبدالرحمن في قصر الصلاة؟' }], { policyEnabled: true });
    ok('causal regression: a raw lexical capture cannot override the typed/IR veto',
      vetoedPlan.attribution.scholarName === 'خالد عبدالرحمن'
      && vetoedPlan.attributionMode === 'none'
      && EK.unregisteredNameInQuestion(vetoedPlan) === '');
    const sacredQuery = 'قال رسول الله صلى الله عليه وسلم: إنما الأعمال بالنيات.';
    ok('causal regression: even a stale raw capture cannot delete «رسول» from the query',
      EK.stripEntityFromQuery(sacredQuery, 'رسول') === sacredQuery);
    ok('F-002 causal RED: a stale divine-frame capture «تعالى» cannot shape a world probe',
      NP.probeShape('قال تعالى', 'تعالى').probe === false);
    const f013SacredPlan = AP.planAsk(
      [{ role: 'user', content: SACRED_CASES[0] }], { policyEnabled: true });
    const f013HumanPlan = AP.planAsk(
      [{ role: 'user', content: HUMAN_DIVINE_NAME_CASES[0][0] }], { policyEnabled: true });
    ok('F-013 direct chain: sacred capture reaches no unregistered name or probe',
      !AT.detectAttribution([{ role: 'user', content: SACRED_CASES[0] }]).scholarName
        && EK.unregisteredNameInQuestion(f013SacredPlan) === ''
        && NP.probeShape(SACRED_CASES[0], '').probe === false);
    ok('F-013 direct chain: a genuine typed human reaches the bounded probe',
      AT.detectAttribution([{ role: 'user', content: HUMAN_DIVINE_NAME_CASES[0][0] }]).scholarName
        === HUMAN_DIVINE_NAME_CASES[0][1]
        && EK.unregisteredNameInQuestion(f013HumanPlan) === HUMAN_DIVINE_NAME_CASES[0][1]
        && NP.probeShape(HUMAN_DIVINE_NAME_CASES[0][0], HUMAN_DIVINE_NAME_CASES[0][1]).probe === true);
  }

  // =========================================================================
  console.log('\n=== A. THE SHAPE THAT FIRES THE PROBE, AND THE SHAPES THAT MUST NOT ===');
  {
    ok('an unregistered name in an attribution question probes',
      NP.probeShape('ما رأي طارق العلي في أحكام العدة؟', 'طارق العلي').kind === NP.PRESENCE.ATTRIBUTION_SHAPE);
    ok('«من هو فلان؟» with a two-part worldly name probes',
      NP.probeShape('من هو محمد صلاح؟', '').kind === NP.PRESENCE.IDENTITY_SHAPE);
    ok('an ordinary ruling question probes NOTHING (the cost bound)',
      NP.probeShape('ما حكم بيع الذهب بالتقسيط؟', '').probe === false);
    ok('a REGISTERED name probes nothing — entity-knowledge returns "" for ابن باز',
      NP.probeShape('ما رأي ابن باز في التصوير؟', '').probe === false);

    // ── THE SACRED SUBJECTS NEVER REACH A NEWS SITE ────────────────────────
    // The entity registry resolves none of these, so it cannot be what excludes them; the three
    // deterministic tests in worldLookupAllowed() are.
    for (const s of ['الله', 'محمد', 'النبي محمد', 'عائشة', 'جبريل', 'أبو بكر الصديق',
      'أمير المؤمنين عمر', 'محمد رسول الله', 'موسى']) {
      ok('never looked up on the world list: «' + s + '»', NP.worldLookupAllowed(s) === false);
    }
    for (const s of ['محمد صلاح', 'ليونيل ميسي', 'خالد عبدالرحمن', 'طارق العلي', 'فلان الفلاني']) {
      ok('a worldly two-part name may be looked up: «' + s + '»', NP.worldLookupAllowed(s) === true);
    }
    ok('«عبدالرحمن» is not excluded by containing «الرحمن» — whole words only',
      NP.worldLookupAllowed('خالد عبدالرحمن') === true);

    // ── «مَن» IS TWO WORDS, AND ONLY ONE OF THEM ASKS WHO ──────────────────
    // MEASURED: the interrogative and the relative/conditional «مَن» shared one frame, so the
    // subject of an ordinary fiqh question was captured as a name and the reader was told «لا
    // أعرف هذا الاسم: أفطر ناسيًا». Nine of ten questions of this shape were read that way.
    for (const q of ['من أفطر ناسيًا؟', 'من نسي الوضوء؟', 'من ترك الصلاة عمدًا؟',
      'من قرأ سورة الكهف؟', 'من مات ولم يحج؟', 'من اغتاب أخاه؟', 'من حلف كاذبًا؟']) {
      ok('a VERBAL sentence is not a name: «' + q + '»', NP.probeShape(q, '').probe === false);
    }
    // The dialectal words are never relative pronouns, so they need no copula — the clause test
    // is what stops them, and it must.
    for (const q of ['مين أفطر ناسيًا؟', 'منو صام رمضان؟', 'شكون قرأ سورة الكهف؟']) {
      ok('...in the dialectal frame too: «' + q + '»', NP.probeShape(q, '').probe === false);
    }
    // AND THE CAPABILITY IS NOT TRADED AWAY. A real identity question still probes.
    for (const q of ['من هو محمد صلاح؟', 'من هي أنجلينا جولي؟', 'مين محمد صلاح؟',
      'منو خالد عبدالرحمن؟', 'من هو فلان الفلاني؟']) {
      ok('a real identity question still probes: «' + q + '»',
        NP.probeShape(q, '').kind === NP.PRESENCE.IDENTITY_SHAPE);
    }
    const sameNameTrust = { resolutionStatus: 'resolved', source: 'registry', surface: 'فركوس' };
    ok('F-005 causal RED: matching typed trust makes the single-token identity probe reachable',
      NP.probeShape('من هو فركوس؟', '', sameNameTrust).kind === NP.PRESENCE.IDENTITY_SHAPE);
    ok('F-005 causal control: trust for another name cannot license a single-token probe',
      NP.probeShape('من هو خالد؟', '', sameNameTrust).probe === false);
  }

  // =========================================================================
  console.log('\n=== B. A PAGE IS EVIDENCE OF EXISTENCE, AND OF NOTHING ELSE ===');
  {
    ok('every word of the name must be on the page',
      NP.pageBearsName('محمد صلاح', { title: 'محمد صلاح', passage: 'لاعب كرة قدم مصري' }) === true);
    ok('one common word is not the name — «العليّ الحكيم» is not طارق العلي',
      NP.pageBearsName('طارق العلي', { title: 'خطبة', passage: 'العليّ الحكيم سبحانه' }) === false);
    ok('the generic sacred token «رسول» is never a page-backed person',
      NP.pageBearsName('رسول', { title: 'قال رسول الله', passage: 'نص الحديث' }) === false);
    ok('the full normalized name is required, not separated tokens elsewhere on the page',
      NP.pageBearsName('محمد صلاح', { title: 'محمد لاعب', passage: 'ثم ذُكر صلاح في موضع آخر' }) === false);
    ok('an unresolved single token is not page-backed by an incidental occurrence',
      NP.pageBearsName('خالد', { title: 'خبر خالد اليوم', passage: 'ورد خالد عرضًا' }) === false);
    ok('a single-token name needs explicit resolved registry/IR trust',
      NP.pageBearsName('فركوس', { title: 'فركوس', passage: 'صفحة موثقة' }) === false);
    ok('the lookup contract itself refuses unresolved single-token identities',
      NP.identityLookupAllowed('خالد', { resolutionStatus: 'unresolved', source: 'ir' }) === false);
    ok('the lookup contract admits a resolved single token only with typed trust metadata',
      NP.identityLookupAllowed('فركوس', { resolutionStatus: 'resolved', source: 'registry', surface: 'فركوس' }) === true);
    ok('F-005 causal RED: resolved trust for another person cannot license this single token',
      NP.identityLookupAllowed('خالد', {
        resolutionStatus: 'resolved', source: 'registry', surface: 'فركوس',
      }) === false);
    ok('the lookup contract keeps full multi-token identities available',
      NP.identityLookupAllowed('محمد صلاح', { resolutionStatus: 'unresolved', source: 'ir' }) === true);
    ok('a trusted single-token name is supported only when trust metadata reaches the matcher',
      NP.pageBearsName('فركوس', { title: 'فركوس', passage: 'صفحة موثقة' },
        { resolutionStatus: 'resolved', source: 'registry', surface: 'فركوس' }) === true);
    ok('F-005 page matcher binds single-token trust to the same normalized surface',
      NP.pageBearsName('خالد', { title: 'خالد', passage: 'ورد خالد عرضًا' },
        { resolutionStatus: 'resolved', source: 'registry', surface: 'فركوس' }) === false);
    ok('an empty page bears nothing', NP.pageBearsName('محمد صلاح', { title: '', passage: '' }) === false);
    ok('a failed search produces no reader-facing negation',
      NP.presenceLine({ probed: false, name: 'فلان الفلاني', found: false, searchFailed: true }) === '');

    const originalFetch = globalThis.fetch;
    const originalBraveKey = process.env.BRAVE_API_KEY;
    process.env.BRAVE_API_KEY = 'local-timeout-contract';
    globalThis.fetch = async (_url, init = {}) => new Promise((_resolve, reject) => {
      const fail = () => { const error = new Error('local provider timeout'); error.name = 'AbortError'; reject(error); };
      if (init.signal?.aborted) fail();
      else init.signal?.addEventListener?.('abort', fail, { once: true });
    });
    try {
      const timedOut = await RETRIEVE.retrieveWorld('فلان الفلاني', {
        maxWaves: 1, maxResults: 1, searchTimeoutMs: 5,
        dailyBudget: new DAILY.DailySearchBudget({ limit: 1, store: DAILY.fakeStore() }),
      });
      ok('F-003 real timer: the cancellable provider deadline is SEARCH_FAILED, not ABSENT',
        timedOut.diagnostics.outcome === RETRIEVE.WORLD_RETRIEVAL_OUTCOME.SEARCH_FAILED
          && timedOut.diagnostics.reasons.includes('PROVIDER_TIMEOUT')
          && timedOut.diagnostics.search.failed === 1
          && timedOut.diagnostics.search.completed === 0,
        JSON.stringify(timedOut.diagnostics));
    } finally {
      globalThis.fetch = originalFetch;
      if (originalBraveKey === undefined) delete process.env.BRAVE_API_KEY;
      else process.env.BRAVE_API_KEY = originalBraveKey;
    }

    const src = read('lib/policy/name-presence.js');
    ok('the module makes NO model call and NO network call of its own',
      !/fetch\(|anthropic|retrieve\(/i.test(src));
    ok('...and imports only the normalizer it actually uses',
      /^import \{ normalizeArabic \} from '\.\.\/route-classify\.js';$/m.test(src));

    const ask = read('api/ask.js');
    ok('the probe is bounded to ONE wave and a handful of candidates',
      /retrieveWorld\(nameShape\.name, \{ maxWaves: 1, maxResults: 3 \}\)/.test(ask));
    ok('...and searches the WORLD list only — never a religious one',
      /retrieveWorld\(nameShape\.name/.test(ask) && !/retrieve\(nameShape\.name/.test(ask));
    ok('a search that never ran may not become an absence: no key ⇒ no probe, no line',
      /nameShape\.probe && process\.env\.BRAVE_API_KEY/.test(ask));
    ok('a THROWN probe is not an absence either',
      /const searchCompleted = retrievalOutcome === WORLD_RETRIEVAL_OUTCOME\.FOUND[\s\S]{0,200}?WORLD_RETRIEVAL_OUTCOME\.COMPLETED_EMPTY;[\s\S]{0,500}?searchCompleted \? PRESENCE\.ABSENT : PRESENCE\.SEARCH_FAILED[\s\S]{0,500}?catch \(e\)[\s\S]{0,300}?outcome: PRESENCE\.SEARCH_FAILED/.test(ask));
    ok('the world page is kept OUT of the religious evidence pool (not remembered)',
      /const w = await retrieveWorld\(nameShape\.name/.test(ask));
    ok('the identity answer carries NO referral tail — it is not a religious answer',
      /iDraft \+ '\\n' \+ idCards\.map\(\(c\) => c\.tag\)\.join\('\\n'\)/.test(ask));
  }

  // =========================================================================
  console.log('\n=== C. NOT ONE SENTENCE GRANTS A TITLE ===');
  {
    const unknown = NP.nameUnknownLine('فلان الفلاني');
    const unprovedNegative = NP.notAFatwaSourceLine('طارق العلي');
    const documentedNegative = NP.notAFatwaSourceLine('طارق العلي', {
      status: 'not_fatwa_source', verified: true, source: 'wikipedia', url: 'https://ar.wikipedia.org/wiki/x',
    });
    ok('a completed miss is described within the checked-result boundary',
      /ضمن النتائج التي فُحصت/.test(unknown) && !/لا أعرف هذا الاسم|لا يَرِد في المصادر/.test(unknown), unknown);
    ok('...and calls him nothing at all',
      !/الشيخ|العالِم|العالم|الداعية|طالب علم/.test(unknown), unknown);
    ok('...and claims no search of a corpus that does not exist',
      !/لم أقف|لم أجد|لم أعثر/.test(unknown), unknown);
    ok('an unproved public-page hit cannot produce a fatwa-source denial', unprovedNegative === '');
    ok('documented non-authority metadata permits the bounded correction without ranking him',
      /ليس ممّن تُؤخَذ عنه الفتوى/.test(documentedNegative)
      && !/الشيخ|العالِم|العالم/.test(documentedNegative), documentedNegative);
    ok('F-003 state: probe completed with no hit gets only the bounded checked-results line',
      NP.presenceLine({ probed: true, searchCompleted: true, found: false,
        name: 'فلان الفلاني', outcome: NP.PRESENCE.ABSENT }) === unknown);
    ok('F-003 causal RED: SEARCH_FAILED never becomes a reader-facing absence',
      NP.presenceLine({ probed: true, searchCompleted: false, found: false,
        name: 'فلان الفلاني', outcome: NP.PRESENCE.SEARCH_FAILED }) === '');
    ok('F-003 causal RED: a missing completion/outcome proof cannot self-license absence',
      NP.presenceLine({ probed: true, found: false, name: 'فلان الفلاني' }) === '');
    ok('F-003 state: a general page hit with no authority proof produces no reader line',
      NP.presenceLine({ probed: true, searchCompleted: true, outcome: NP.PRESENCE.FOUND,
        found: true, name: 'طارق العلي', page: { url: 'https://example.test/x' } }) === '');
    ok('F-003 state: a documented non-authority result alone permits the bounded correction',
      NP.presenceLine({ probed: true, searchCompleted: true, outcome: NP.PRESENCE.FOUND,
        found: true, name: 'طارق العلي', authority: {
          status: 'not_fatwa_source', verified: true, source: 'wikipedia', url: 'https://ar.wikipedia.org/wiki/x',
        } }) === documentedNegative);
    ok('F-003 state: a failed/unrun search produces no reader line',
      NP.presenceLine({ probed: false, found: false, name: 'فلان', outcome: NP.PRESENCE.SEARCH_FAILED }) === '');
    ok('F-003 state: a registered known identity produces no negative line',
      NP.presenceLine({ probed: false, found: true, name: 'ابن باز', registered: true }) === '');
    ok('F-003 state: a sacred candidate produces no line under any synthetic probe state',
      NP.presenceLine({ probed: true, searchCompleted: true, found: false,
        name: 'رسول', outcome: NP.PRESENCE.ABSENT }) === '');
    ok('the shared refusal no longer says «هذا العالِم»',
      !/هذا العالِم|هذا العالم/.test(CG.NO_ATTRIBUTION_AVAILABLE), CG.NO_ATTRIBUTION_AVAILABLE);
    ok('...and still refuses the attribution, naming nobody',
      /لا أنسبُ قولًا في هذه المسألة إلى أحدٍ/.test(CG.NO_ATTRIBUTION_AVAILABLE));
    ok('the ABOUT_ENTITY refusal grants no title either',
      /لا أنسب إلى أحدٍ قولًا لم أقف عليه في نصٍّ له/.test(read('api/ask.js'))
      && !/لا أنسب إلى العالِم قولًا/.test(read('api/ask.js')));
  }

  // =========================================================================
  console.log('\n=== A2. A CLAUSE IS NOT A NAME, AND A JOINED «ما» IS STILL A QUESTION ===');
  // Two measured failures of the SAME detector, in opposite directions.
  {
    const AT = await esm('lib/attribution.js');
    const capture = (q) => AT.detectAttribution([{ role: 'user', content: q }]).scholarName;
    const probed = (q) => { const p = NP.probeShape(q, capture(q)); return p.probe ? p.name : ''; };
    // This guard carries only `ok`, and a bare boolean here would report "FAIL" without ever
    // saying what was captured instead — which is the whole diagnostic on a detector.
    const eq = (name, actual, expected) =>
      ok(name, actual === expected, 'expected ' + JSON.stringify(expected) + '\n        actual   ' + JSON.stringify(actual));

    // ── THE FALSE POSITIVE (حادثة ١٣) ───────────────────────────────────────
    // «حسب» is an attribution trigger, «حسب علمي» is the idiom "as far as I know". The reader
    // was disclaiming, and was answered «لا أعرف هذا الاسم: علمي فهناك علماء اجازوا» — the app
    // naming a clause as a person.
    const IDIOM = 'على حسب علمي فهناك علماء اجازوا هذا الأمر';
    eq('RED→GREEN: «حسب علمي …» captures no name at all', capture(IDIOM), '');
    eq('...so no probe runs and no «لا أعرف هذا الاسم» line is owed', probed(IDIOM), '');
    // FIXED TWICE, ON PURPOSE: at the capture (NAME_STOP) and at the shape. The next idiom will
    // arrive through a trigger nobody has listed, so the shape test is asserted on its own.
    ok('...and the shape test refuses it independently of the capture',
      NP.looksLikeName('علمي فهناك علماء اجازوا') === false);
    ok('...as it refuses any plural past verb', NP.looksLikeName('قالوا كذا') === false);

    // ── THE FALSE NEGATIVE («الرويشد») ──────────────────────────────────────
    // «ماقول» — «ما» typed joined to the word after it, as it is written in the Gulf. The word
    // boundary the pattern demanded does not exist inside it, so the whole shape was invisible
    // and the name was never captured. NOT a normalisation failure: the same question spaced
    // «ما قول» always worked.
    eq('RED→GREEN: «ماقول عبدالله الرويشد …» captures the name',
      capture('ماقول عبدالله الرويشد في أحكام العقيقه'), 'عبدالله الرويشد');
    eq('...and fully vocalised, which is how the model writes it',
      capture('ماقول عبدالله الرُّويْشِد في أحكام العقيقه'), 'عبدالله الرويشد');
    eq('...the spaced form is unchanged',
      capture('ما قول عبدالله الرويشد في أحكام العقيقه'), 'عبدالله الرويشد');
    // ...and the joined form does not over-fire: «ماقولك» addresses the reader and names nobody.
    eq('«ماقولك في كذا» still names nobody', capture('ماقولك في هذا الأمر'), '');

    // ── AND THE ORDINARY NAMES STILL PASS ───────────────────────────────────
    // A shape test that refused real names would close the probe for everybody silently.
    for (const n of ['عبدالله الرويشد', 'ابن باز', 'فركوس', 'محمد بن صالح العثيمين', 'طارق العلي'])
      ok('«' + n + '» is still name-shaped', NP.looksLikeName(n) === true);
    // «علي» normalises «على» to the same string, so a curated list is used rather than the
    // clause-word list — otherwise every man called Ali would lose his probe.
    ok('a man called علي is not mistaken for the preposition',
      NP.looksLikeName('علي الطنطاوي') === true);
  }

  console.log('\n=== D. THE FOUR OTHER MEASURED DEFECTS ===');
  {
    // ب — a site root produced a citation.
    ok('RED→GREEN: a site ROOT is refused even on a host with no per-host rules',
      PG.pathRefusal('https://dr-mutlaq.com/', '') === 'site-root');
    ok('...and on every other allow-listed host',
      ['https://binbaz.org.sa/', 'https://islamqa.info/', 'https://www.islamweb.net/', 'https://al-badr.net/']
        .every((u) => PG.pathRefusal(u, '') === 'site-root'));
    ok('...and the generic index shapes with it',
      /^generic-listing-path/.test(String(PG.pathRefusal('https://dr-mutlaq.com/category/x', ''))));
    ok('...while a real article page is still admitted',
      PG.pathRefusal('https://binbaz.org.sa/fatwas/20214/y', '') === null
      && PG.pathRefusal('https://dr-mutlaq.com/12345/some-article', '') === null);

    // ج — the tail appeared twice.
    // The tail is now owed to a MEASURED referral, never to the subject (تكليف «شكلِ الجواب»
    // ٨ أغسطس ٢٠٢٦, البند ٣ — asserted in full by guards/referral-tail-guard.cjs). This section is
    // about the once-per-reply rule, so it needs a real tail to deduplicate: it takes one the
    // legitimate way rather than by the subject, and checks that the subject alone earns nothing.
    const tail = RT.referralTail('ما حكم بيع الذهب بالتقسيط؟', 'sharia_ruling', 5,
      RT.MEASURED_REFERRAL_OUTCOMES[0]);
    ok('a measured referral still earns a tail', !!tail);
    ok('...and a ruling question on its own earns none',
      RT.referralTail('ما حكم بيع الذهب بالتقسيط؟', 'sharia_ruling', 5) === '');
    ok('RED→GREEN: a draft that already referred gets no second tail',
      RT.referralOnce('الجواب كذا. وَلِلاطْمِئْنَانِ فِي مَسْأَلَتِك، اعْرِضْهَا عَلَى مُفْتٍ أَوْ طَالِبِ عِلْمٍ ثِقَة.', tail) === '');
    ok('...even fully vocalised', RT.referralOnce('كذا، فَاسْأَلْ أَهْلَ الْعِلْمِ عِنْدَك.', tail) === '');
    ok('...and each of the five server tails detects itself',
      RT.REFERRAL_TAILS.every((t) => RT.alreadyReferred('نص قبله. ' + t)));
    ok('GREEN: a draft with no referral still gets exactly one',
      RT.referralOnce('الجواب كذا وكذا، والله أعلم.', tail) === '\n\n' + tail);
    ok('every exit in the handler goes through the once-rule',
      !/referralBlock\b(?!For)/.test(read('api/ask.js')));

    // هـ — the app weighed the qawls itself.
    const base = { entity: 'ابن تيميه', notDirectlyVerified: false, searchProven: true };
    const M = 'الراجح أن من ترك الصلاة عمدًا وجب عليه قضاؤها.';
    ok('RED: a ترجيح no retrieved page states is refused',
      CG.consistencyProblems(M, { ...base, pageTexts: ['نص بلا ترجيح'] })
        .includes(CG.PROBLEM.TARJIH_WITHOUT_EVIDENCE));
    ok('RED: with no page at all, every ترجيح is the app\'s own',
      CG.consistencyProblems(M, { ...base, pageTexts: [] })
        .includes(CG.PROBLEM.TARJIH_WITHOUT_EVIDENCE));
    ok('RED: stated on the page but credited to nobody is still refused',
      CG.consistencyProblems(M, { ...base, pageTexts: ['والراجح وجوب القضاء.'] })
        .includes(CG.PROBLEM.TARJIH_WITHOUT_EVIDENCE));
    ok('GREEN: stated on the page AND credited to its sayer passes',
      !CG.consistencyProblems('والراجح عند الجمهور وجوب القضاء كما في المصدر المذكور.',
        { ...base, pageTexts: ['والراجح عند الجمهور وجوب القضاء.'] })
        .includes(CG.PROBLEM.TARJIH_WITHOUT_EVIDENCE));
    ok('GREEN: hadith grading is transmission, not ترجيح — «حديث صحيح» survives',
      !CG.consistencyProblems('هذا حديث صحيح رواه البخاري وإسناده صحيح.', { ...base, pageTexts: ['حديث صحيح'] })
        .includes(CG.PROBLEM.TARJIH_WITHOUT_EVIDENCE));
    ok('a caller not yet wired to the rule is unaffected',
      !CG.consistencyProblems(M, base).includes(CG.PROBLEM.TARJIH_WITHOUT_EVIDENCE));
    const unknownIdentityContext = {
      entity: 'فلان الفلاني', subjectEntity: 'فلان الفلاني',
      identityStatus: 'unknown', identityVerified: false, searchProven: true,
    };
    const finalizeUnknownIdentity = (text) => FT.finalizeReaderText({
      text, sources: [], fallbackText: 'SAFE', consistencyContext: unknownIdentityContext,
    });
    const hostileUnknownIdentityClaims = [
      'فلان الفلاني شيخ معروف.',
      'فلان الفلاني من كبار العلماء.',
      'فلان الفلاني عالم جليل.',
      'فلان الفلاني داعية مشهور.',
      'فلان الفلاني عضو هيئة كبار العلماء.',
      'يُعد فلان الفلاني من العلماء المعاصرين.',
      'الشيخ فلان الفلاني مفتي الديار.',
      'فلان الفلاني، وهو عالم معروف، قال شيئًا.',
    ];
    for (const text of hostileUnknownIdentityClaims) {
      const result = finalizeUnknownIdentity(text);
      ok('F-007 causal RED: typed UNKNOWN rejects the positive identity claim — «' + text + '»',
        result.ok === false && result.text === 'SAFE'
          && result.problems.includes(CG.PROBLEM.IDENTITY_WITHOUT_EVIDENCE)
          && result.problems.includes('CONSISTENCY_DROP_WHOLE'), JSON.stringify(result));
    }
    const safeUnknownIdentityProse = [
      'لم أتحقق من فلان الفلاني. لا أعلم هل ابن باز عالم معروف.',
      'فلان الفلاني ليس عالمًا معروفًا.',
      'لا أعلم هل فلان الفلاني عالم معروف.',
      'لم نقف على ما يثبت أن فلان الفلاني من العلماء.',
      'ورد اسم فلان الفلاني، أما ابن باز فذُكر اسمه فقط.',
      'هذا نص عام لا يحتوي اسم الشخص المقصود.',
      'ورد اسم فلان الفلاني فقط. ورد اسم ابن باز فقط.',
      'لم نقفْ على شخصيّةٍ معروفةٍ بهذا الاسم',
    ];
    for (const text of safeUnknownIdentityProse) {
      const result = finalizeUnknownIdentity(text);
      ok('F-007 causal RED: negation, uncertainty, or another person is not a target assertion — «' + text + '»',
        result.ok === true && result.text === text
          && !result.problems.includes(CG.PROBLEM.IDENTITY_WITHOUT_EVIDENCE), JSON.stringify(result));
    }
    const targetClaimAfterOtherUncertainty =
      'لا أعلم هل ابن باز عالم معروف، لكن فلان الفلاني شيخ معروف.';
    const targetClaimResult = finalizeUnknownIdentity(targetClaimAfterOtherUncertainty);
    ok('F-007 entity-binding RED: uncertainty about Ibn Baz cannot excuse a positive target claim',
      targetClaimResult.ok === false && targetClaimResult.text === 'SAFE'
        && targetClaimResult.problems.includes(CG.PROBLEM.IDENTITY_WITHOUT_EVIDENCE)
        && targetClaimResult.problems.includes('CONSISTENCY_DROP_WHOLE'),
      JSON.stringify(targetClaimResult));
    const otherIdentityBeforeTargetMention =
      'ابن باز عالم معروف، فلان الفلاني مذكور في السؤال.';
    const otherIdentityResult = FT.finalizeReaderText({
      text: otherIdentityBeforeTargetMention, sources: [], fallbackText: 'SAFE',
      consistencyContext: { ...unknownIdentityContext, sourceLicence: ['ibn-baz'] },
    });
    ok('F-007 entity-binding RED: a predicate about Ibn Baz cannot cross a comma onto the target',
      otherIdentityResult.ok === true && otherIdentityResult.text === otherIdentityBeforeTargetMention
        && !otherIdentityResult.problems.includes(CG.PROBLEM.IDENTITY_WITHOUT_EVIDENCE),
      JSON.stringify(otherIdentityResult));
    const singleExact = FT.finalizeReaderText({
      text: 'صالح عالم جليل.', sources: [], fallbackText: 'SAFE',
      consistencyContext: {
        entity: 'صالح', subjectEntity: 'صالح', identityStatus: 'unknown',
        identityVerified: false, searchProven: true,
      },
    });
    const singleEmbedded = FT.finalizeReaderText({
      text: 'الصالحين أهل خير، ولا يرد هنا اسم الشخص.', sources: [], fallbackText: 'SAFE',
      consistencyContext: {
        entity: 'صالح', subjectEntity: 'صالح', identityStatus: 'unknown',
        identityVerified: false, searchProven: true,
      },
    });
    ok('F-007 Unicode boundary: an exact one-token UNKNOWN identity is rejected',
      singleExact.ok === false && singleExact.problems.includes(CG.PROBLEM.IDENTITY_WITHOUT_EVIDENCE));
    ok('F-007 Unicode boundary: the entity does not match inside a longer Arabic word',
      singleEmbedded.ok === true && singleEmbedded.text === 'الصالحين أهل خير، ولا يرد هنا اسم الشخص.');
    const verifiedIdentity = FT.finalizeReaderText({
      text: 'ابن باز شيخ معروف.', sources: [], fallbackText: 'SAFE',
      consistencyContext: {
        ...unknownIdentityContext, entity: 'ابن باز', subjectEntity: 'ابن باز',
        identityVerified: true, identityStatus: 'scholar', sourceLicence: ['ibn-baz'],
      },
    });
    ok('F-007 resolved control: verified identity bypasses the UNKNOWN-only gate',
      verifiedIdentity.ok === true && verifiedIdentity.text === 'ابن باز شيخ معروف.');
    const finalizerSource = read('lib/finalize-reader-text.js');
    const consistencySource = read('lib/policy/consistency-gate.js');
    const helperSignature = 'export function assertsUnverifiedIdentityAbout(text, entity) {';
    ok('mutation precondition: the central entity-bound UNKNOWN helper is present',
      consistencySource.includes(helperSignature)
        && finalizerSource.includes('assertsUnverifiedIdentityAbout(screenInput,'));
    const fileUrl = (file) => 'file:///' + path.resolve(file).replace(/\\/g, '/');
    const absoluteImports = (source, baseFile) => source.replace(
      /from '(\.\.?\/[^']+)'/g,
      (_match, rel) => "from '" + fileUrl(path.resolve(path.dirname(baseFile), rel)) + "'",
    );
    const mutantDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-a2-identity-mut-'));
    try {
      const loadFinalizerMutant = async (name, helperBody) => {
        const consistencyMutantFile = path.join(mutantDir, name + '-consistency.mjs');
        const finalizerMutantFile = path.join(mutantDir, name + '-finalizer.mjs');
        const consistencyMutant = consistencySource.replace(
          helperSignature, helperSignature + '\n' + helperBody,
        );
        fs.writeFileSync(consistencyMutantFile,
          absoluteImports(consistencyMutant, path.join(REPO, 'lib/policy/consistency-gate.js')), 'utf8');
        const finalizerMutant = finalizerSource.replace(
          "from './policy/consistency-gate.js'", "from '" + fileUrl(consistencyMutantFile) + "'",
        );
        fs.writeFileSync(finalizerMutantFile,
          absoluteImports(finalizerMutant, path.join(REPO, 'lib/finalize-reader-text.js')), 'utf8');
        return import(fileUrl(finalizerMutantFile));
      };
      const DisabledHelperFinalizer = await loadFinalizerMutant('helper-disabled', '  return false;');
      const escaped = DisabledHelperFinalizer.finalizeReaderText({
        text: 'ابن باز عالم معروف.', sources: [], fallbackText: 'SAFE',
        consistencyContext: {
          ...unknownIdentityContext, entity: 'ابن باز', subjectEntity: 'ابن باز',
          sourceLicence: ['ibn-baz'],
        },
      });
      ok('MUTANT KILLED: disabling the central UNKNOWN helper lets a hostile identity pass',
        escaped.ok === true && escaped.text === 'ابن باز عالم معروف.', JSON.stringify(escaped));

      const GlobalBindingFinalizer = await loadFinalizerMutant('global-binding',
        `  const foldedText = fold(String(text || ''));
  const foldedEntity = fold(String(entity || ''));
  return !!foldedEntity && foldedText.includes(foldedEntity)
    && new RegExp('(?:' + IDENTITY_ATTRIBUTE_PATTERN + ')', 'u').test(foldedText);`);
      const separateClaim = 'لم أتحقق من فلان الفلاني. ابن باز عالم معروف.';
      const falsePositive = GlobalBindingFinalizer.finalizeReaderText({
        text: separateClaim, sources: [], fallbackText: 'SAFE',
        consistencyContext: { ...unknownIdentityContext, sourceLicence: ['ibn-baz'] },
      });
      ok('MUTANT KILLED: whole-answer entity/attribute co-occurrence rejects a separate person',
        falsePositive.ok === false && falsePositive.text === 'SAFE', JSON.stringify(falsePositive));
    } finally {
      try { fs.rmSync(mutantDir, { recursive: true, force: true }); } catch { /* temp only */ }
    }
    // RE-PINNED ON THE STRONGER CONDITION, ASSERTION KEPT. The claim here is that the ترجيح rule
    // is SENTENCE-level: the app's own preference goes and the transmitted ruling stays. That is
    // unchanged and still asserted. What the fixture had to gain is a page that actually carries
    // the surviving ruling — batch 5 holds every ruling to the pages in hand, so a page reading
    // «لا ترجيح هنا» now fails to source the sentence the assertion wants kept, and the draft
    // would be refused for a reason that has nothing to do with ترجيح. The page still contains no
    // preference word, which is what arms the rule under test.
    ok('the screen drops the ترجيح sentence and keeps the ruling',
      (() => {
        const d = CG.screenDraft('حكم المسألة وجوب القضاء كما في المصدر المذكور. ' + M,
          { ...base, pageTexts: ['حكم هذه المسألة وجوب القضاء كما ذكره أهل العلم في المصدر المذكور.'] });
        return !/الراجح/.test(d.text) && /وجوب القضاء/.test(d.text) && !d.dropWhole;
      })());
    ok('the handler supplies the pages the rule is armed by',
      /pageTexts: fetchedPages\.map\(\(p\) => \(p && p\.passage\) \|\| ''\)/.test(read('api/ask.js')));
  }

  // =========================================================================
  console.log('\n=== E. A RELIGIOUS QUESTION NEVER TRAVELS A SOURCELESS PATH (§4) ===');
  {
    const ask = read('api/ask.js');
    ok('the current-turn domain classifier is wired into effectiveRoute before world intent',
      /const currentRuntime = classifyReligiousRuntime\(currentQuestionText, currentPlan, route\);/.test(ask)
        && /const effectiveRoute = currentRuntime === 'GENERAL' \? 'GEN' : 'DEEN';/.test(ask));
    ok('...and routing plus source filtering share the shipped router module',
      /import \{[^}]*classifyRoute[^}]*createSourceFilter[^}]*isReligiousText[^}]*normalizeArabic[^}]*\} from '\.\.\/lib\/route-classify\.js';/.test(ask));
    // The twelve, and the ratio.
    const TWELVE = [
      'ما معنى الإحسان؟', 'اشرح لي معنى التوكل', 'ما معنى الإخلاص؟', 'ما معنى التقوى؟',
      'ما معنى الورع؟', 'اشرح لي معنى الزهد', 'ما معنى الاستقامة؟', 'ما فضل بر الوالدين؟',
      'ما هي أركان الإيمان؟', 'ما حكم بيع الذهب بالتقسيط؟', 'كيف أتوضأ؟', 'ما معنى الصبر في الإسلام؟',
    ];
    const missed = TWELVE.filter((q) => !RC.isReligiousText(q));
    ok('all twelve explicit religious questions are NAMED as religious (was 4 of 12)',
      missed.length === 0, JSON.stringify(missed));
    // …and the widening did not claim the language.
    const WORLDLY = ['شلون أسوي ماسك للشفايف؟', 'كم يساوي سبعة في ثمانية؟', 'ما آخر أخبار غزة اليوم؟',
      'ما عاصمة اليابان؟', 'علمني جدول الضرب', 'كيف أذاكر للامتحان؟', 'ما سعر الذهب اليوم؟'];
    const grabbed = WORLDLY.filter((q) => RC.isReligiousText(q));
    ok('...and no worldly question was swept in with them', grabbed.length === 0, JSON.stringify(grabbed));
  }

  // =========================================================================
  console.log('\n=== F. THROUGH THE REAL HANDLER — the three questions from the brief ===');
  {
    process.env.RFC_V05_MODE = 'internal';
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.BRAVE_API_KEY = 'test-brave';
    process.env.FOUNDER_SECRET = 'name-presence-guard-secret';
    // The legacy path, switched off the ledger by its documented floor — the ledger engine is a
    // separate concern and is not what this guard is about.
    process.env.LEDGER_RAG = 'off';
    STORE.__setRedisForTest(null);

    // THE DAY CAP IS A SEPARATE STORE, AND IT FAILS CLOSED. Without this stub guardDayCap cannot
    // reach Upstash, answers 429 `cap-unavailable` with a JSON body, and the handler returns before
    // a single line of the code under test runs — which would make every «X does not appear» check
    // below pass for a reason that has nothing to do with X. It only ever ALLOWS; it grants no
    // credential and no flag. Same idiom as guards/rfc-v05r2-wiring-guard.cjs.
    const capCounts = new Map();
    DAY.__setRedisForTest({
      async mget(...keys) { return keys.map((k) => (capCounts.has(k) ? capCounts.get(k) : null)); },
      async sismember() { return 0; },
      pipeline() {
        const ops = [];
        return {
          incr(k) { ops.push(() => { const n = (Number(capCounts.get(k)) || 0) + 1; capCounts.set(k, n); return n; }); },
          expire() { ops.push(() => 1); },
          async exec() { return ops.map((f) => f()); },
        };
      },
    });

    const WORLD_URL = 'https://ar.wikipedia.org/wiki/%D9%85%D8%AD%D9%85%D8%AF_%D8%B5%D9%84%D8%A7%D8%AD';
    const WORLD_TITLE = 'محمد صلاح';
    const WORLD_HTML = `<!doctype html><html><head><title>${WORLD_TITLE}</title></head><body><article>
<h1>محمد صلاح</h1><p>محمد صلاح حامد محروس غالي لاعب كرة قدم مصري يلعب في مركز الجناح الأيمن مع نادي ليفربول
الإنجليزي ومنتخب مصر لكرة القدم. ولد في قرية نجريج بمحافظة الغربية في مصر، وبدأ مسيرته الكروية مع نادي
المقاولون العرب قبل أن ينتقل إلى الدوري السويسري ثم إلى إنجلترا وإيطاليا. وقد حصل على جوائز عديدة أبرزها جائزة
الحذاء الذهبي في الدوري الإنجليزي الممتاز أكثر من مرة، ويُعدّ من أبرز لاعبي كرة القدم العرب في تاريخ اللعبة.</p>
<p>وقد ساهم محمد صلاح في تتويج فريقه ببطولات محلية وقارية، وشارك مع منتخب بلاده في نهائيات كأس العالم.</p>
</article></body></html>`;

    const FIQH_URL = 'https://islamqa.info/ar/answers/38209/';
    const FIQH_TITLE = 'صفة قصر الصلاة في السفر';
    const FIQH_HTML = `<!doctype html><html><head><title>${FIQH_TITLE}</title></head><body><article>
<h1>${FIQH_TITLE}</h1><p>الحمد لله. قصر الصلاة في السفر من رخص الشريعة التي وسع الله بها على عباده، وقد ثبت
ذلك بالكتاب والسنة وإجماع أهل العلم. فالمسافر يقصر الصلاة الرباعية فيصليها ركعتين، وهي الظهر والعصر والعشاء،
أما المغرب فلا تقصر لأنها وتر النهار، وأما الفجر فركعتان في الأصل فلا قصر فيها.</p>
<p>ويبدأ القصر إذا فارق المسافر عامر قريته وخرج عن بنيان بلده، ويستمر ما دام مسافرا، فإذا رجع إلى بلده أتم
الصلاة. وإذا صلى المسافر خلف إمام مقيم لزمه الإتمام تبعا لإمامه، وهذا قول عامة أهل العلم.</p></article></body></html>`;
    const BAZ_URL = 'https://binbaz.org.sa/fatwas/77777/qasr-local';
    const BAZ_TITLE = 'حكم قصر الصلاة للمسافر';
    const BAZ_DRAFT = 'بيّن ابن باز في المصدر أن المسافر يقصر الصلاة الرباعية إلى ركعتين.';
    const BAZ_HTML = `<!doctype html><html><head><title>${BAZ_TITLE}</title></head><body><article>
<h1>${BAZ_TITLE}</h1><p>${BAZ_DRAFT} ويبدأ القصر بعد مفارقة عامر البلد، ويستمر حكم السفر ما دام سببه قائمًا.
وهذا جواب منشور في الموقع الرسمي للشيخ عبد العزيز بن باز، وفيه بيان صفة القصر للمسافر وأن الصلاة الرباعية
تُصلّى ركعتين، أما المغرب والفجر فتبقيان على صفتهما المعروفة ولا يدخلهما القصر.</p>
<p>وإذا صلى المسافر خلف إمام مقيم فإنه يتم الصلاة اتباعًا لإمامه، لأن متابعة الإمام واجبة في هذه الحال.
وهذا التفصيل يبيّن الحكم المقصود من السؤال ويمنع حمل النص على غير موضعه.</p></article></body></html>`;
    const HADITH_URL = 'https://islamqa.info/ar/answers/99101/meaning-of-advice';
    const HADITH_TITLE = 'شرح معنى حديث الدين النصيحة';
    const HADITH_BODY = 'معنى «الدين النصيحة» أن النصيحة أصل جامع في الدين كما يوضح المصدر.';
    const HADITH_HTML = `<!doctype html><html><head><title>${HADITH_TITLE}</title></head><body><article>
<h1>${HADITH_TITLE}</h1><p>${HADITH_BODY} ويدخل في ذلك الإخلاص لله ولكتابه ولرسوله ولأئمة المسلمين
وعامتهم، وهو بيان لمعنى النصيحة الوارد في السؤال لا إنشاء لنص آخر ولا نسبة حكم إلى شخص مجهول.</p>
<p>ويشرح المصدر أن النصيحة تتضمن إرادة الخير، والصدق في الدلالة عليه، والقيام بحقوق الدين على الوجه
الذي دلت عليه النصوص. وهذا التفصيل متصل مباشرة بعبارة الدين النصيحة ومعناها المقصود.</p></article></body></html>`;
    const TAFSIR_URL = 'https://islamqa.info/ar/answers/99102/with-hardship-comes-ease';
    const TAFSIR_TITLE = 'معنى قول الله تعالى إن مع العسر يسرا';
    const TAFSIR_BODY = 'يبين المصدر أن معنى «إن مع العسر يسرا» اقتران التيسير بالشدة ووعد الله بالفرج.';
    const TAFSIR_HTML = `<!doctype html><html><head><title>${TAFSIR_TITLE}</title></head><body><article>
<h1>${TAFSIR_TITLE}</h1><p>${TAFSIR_BODY} والآية تسلية وتثبيت، وفيها أن المشقة لا تنفرد عن أسباب
التيسير التي يقدرها الله لعباده، وهذا هو المعنى المتصل بالسؤال دون زيادة دعوى لا يحملها النص.</p>
<p>ويذكر المصدر سياق السورة ومعنى العسر واليسر، وأن تكرار الخبر يقوي الرجاء ويحض على الصبر والعمل.
وهذا شرح للعبارة القرآنية نفسها كما وردت في السؤال.</p></article></body></html>`;

    const FINALIZATION_COMPLETE = Symbol.for('ustaz.finalized-sse.complete');
    const makeRes = () => ({
      writes: [], ended: 0, preFinalizationWrites: 0, preFinalizationEnds: 0,
      status() { return this; }, setHeader() { return this; }, flushHeaders() {},
      write(s) {
        const chunk = String(s);
        if (!this[FINALIZATION_COMPLETE] && !chunk.trimStart().startsWith(':')) this.preFinalizationWrites += 1;
        this.writes.push(chunk);
        return true;
      },
      end() {
        if (!this[FINALIZATION_COMPLETE]) this.preFinalizationEnds += 1;
        this.ended += 1;
        return this;
      },
      json(o) { this.jsonBody = o; this.ended += 1; return this; },
    });
    const founder = DC.founderTokenFor(DEVICE);
    const makeReq = (text) => ({
      method: 'POST',
      headers: { 'x-murabbi-device': DEVICE, 'x-murabbi-founder': founder, 'x-ezik-ai-consent': '2026-08-06-1' },
      body: { system: 'أنت عزك', age: 25, band: 'adult', messages: [{ role: 'user', content: text }] },
    });
    // Execute the parser shipped to the browser, not a more permissive test-only interpretation.
    const clientHandlerBody = (read('index.html').match(/const handleEvent = \(block\) => \{([\s\S]*?)\n      \};/) || [])[1];
    const clientVisibleFromRaw = clientHandlerBody && new Function('raw', `
      let full = '', streamError = null, onDelta = null;
      const handleEvent = (block) => {${clientHandlerBody}\n};
      let buffer = String(raw).replace(/\\r\\n/g, '\\n'), idx;
      while ((idx = buffer.indexOf('\\n\\n')) !== -1) { handleEvent(buffer.slice(0, idx)); buffer = buffer.slice(idx + 2); }
      if (buffer.trim()) handleEvent(buffer);
      return full;
    `);
    const readerText = (res) => clientVisibleFromRaw(res.writes.join(''));
    const protocolEvents = (res) => res.writes.join('').replace(/\r\n/g, '\n').split('\n\n')
      .filter((frame) => frame.trim() && !frame.trimStart().startsWith(':'))
      .map((frame) => frame.split('\n').filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart()).join(''))
      .map((data) => { try { return JSON.parse(data); } catch { return null; } });
    const closedLifecycle = (res) => {
      const events = protocolEvents(res);
      if (!events.length || events.some((event) => !event)) return false;
      let messageStarted = false, messageStopped = false;
      const open = new Set(), used = new Set();
      for (const event of events) {
        if (messageStopped) return false;
        if (event.type === 'message_start') {
          if (messageStarted || open.size || used.size || !event.message
            || event.message.role !== 'assistant') return false;
          messageStarted = true;
        } else if (event.type === 'content_block_start') {
          if (!messageStarted || !Number.isInteger(event.index) || !event.content_block
            || event.content_block.type !== 'text' || open.has(event.index) || used.has(event.index)) return false;
          open.add(event.index); used.add(event.index);
        } else if (event.type === 'content_block_delta') {
          if (!messageStarted || !open.has(event.index) || !event.delta
            || event.delta.type !== 'text_delta' || typeof event.delta.text !== 'string') return false;
        } else if (event.type === 'content_block_stop') {
          if (!messageStarted || !open.has(event.index)) return false;
          open.delete(event.index);
        } else if (event.type === 'message_stop') {
          if (!messageStarted || open.size) return false;
          messageStopped = true;
        } else return false;
      }
      return messageStarted && messageStopped && open.size === 0
        && events.filter((event) => event.type === 'message_stop').length === 1
        && events.at(-1).type === 'message_stop' && res.ended === 1
        && res.preFinalizationWrites === 0 && res.preFinalizationEnds === 0;
    };

    const realFetch = globalThis.fetch;
    const jsonRes = (o) => ({
      ok: true, status: 200,
      headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => o, text: async () => JSON.stringify(o),
    });
    const htmlRes = (u, body) => ({
      ok: true, status: 200, url: u,
      headers: {
        get: (h) => {
          const k = String(h).toLowerCase();
          if (k === 'content-type') return 'text/html; charset=utf-8';
          if (k === 'content-length') return String(Buffer.byteLength(body, 'utf8'));
          return null;
        },
      },
      text: async () => body,
      arrayBuffer: async () => Buffer.from(body, 'utf8'),
    });

    let activeState = null;
    let ledgerBudgetUsed = 0;
    STORE.__setRedisForTest({
      async get() { return null; },
      async set(key) {
        if (activeState && String(key).startsWith('lg:id:')) activeState.identityCacheWrites += 1;
        return 'OK';
      },
      async incr() { ledgerBudgetUsed += 1; return ledgerBudgetUsed; },
      async expire() { return 1; },
      async sismember() { return 0; },
      async eval(_script, _keys, args) {
        ledgerBudgetUsed += 1;
        return [ledgerBudgetUsed, ledgerBudgetUsed <= Number(args[0]) ? 1 : 0];
      },
    });

    const drive = async (question, draft, {
      worldHit = true, worldFailure = '', religiousHit = true, evidence = null, worldEvidence = null,
      classifiedRoute = 'DEEN',
    } = {}) => {
      // Each drive is an independent request fixture; do not let the test's matrix exhaust a
      // reader's production day cap and turn later assertions into cap-template assertions.
      capCounts.clear();
      const state = {
        braveQueries: [], round: 0, identityCalls: 0, identityCacheWrites: 0, worldProbeCalls: 0,
        ledgerPlannerCalls: 0, modelRequests: [], presenceEvents: [], routeEvents: [], modelStages: [],
        finalizerEvents: [],
      };
      activeState = state;
      const originalLog = console.log;
      const originalWarn = console.warn;
      console.log = (...args) => {
        if (args[0] === '[name-presence]' && args[1] && typeof args[1] === 'object') {
          state.presenceEvents.push({ ...args[1] });
        }
        if (args[0] === '[route]' && args[1] && typeof args[1] === 'object') {
          state.routeEvents.push({ ...args[1] });
        }
        originalLog(...args);
      };
      console.warn = (...args) => {
        if (args[0] === '[finalizer] reader text replaced' && args[1] && typeof args[1] === 'object') {
          state.finalizerEvents.push({ ...args[1] });
        }
        originalWarn(...args);
      };
      globalThis.fetch = async (url, init) => {
        const u = String(url);
        if (u.includes('api.anthropic.com')) {
          const b = JSON.parse(init.body);
          state.modelRequests.push(b);
          const last = b.messages[b.messages.length - 1];
          const txt = typeof last.content === 'string' ? last.content : '';
          if (/هُويّة|هوية|non_scholar|هل هذا الاسم عالم|is this name a scholar/i.test(txt)) state.identityCalls += 1;
          if (/GEN|DEEN/.test(txt) && txt.length < 400) {
            return jsonRes({ content: [{ type: 'text', text: classifiedRoute }], stop_reason: 'end_turn' });
          }
          if (txt.includes('### مُرشَّح') && txt.includes('"answers"')) {
            state.modelStages.push('page-match');
            const ids = Array.from(txt.matchAll(/### مُرشَّح (\S+)/g)).map((match) => match[1]);
            return jsonRes({ content: [{ type: 'text', text: JSON.stringify({
              verdicts: ids.map((id) => ({ id, answers: true })),
            }) }], stop_reason: 'end_turn' });
          }
          if (txt.includes('"issue_id"')) {
            state.modelStages.push('planner');
            state.ledgerPlannerCalls += 1;
            const authority = state.routeEvents.some((event) => event.mode === 'namedScholarOpinion'
              && event.entity === 'ابن باز') ? 'ibn-baz' : null;
            const prophetic = /رسول|النبي|الرسول|صلى الله عليه وسلم/.test(question);
            const divine = !prophetic && /(?:الله تعالى|قال تعالى|يقول الله)/.test(question);
            const protectedEntity = prophetic
              ? (/رسول/.test(question) ? 'رسول الله' : 'النبي')
              : (divine ? (/قال تعالى/.test(question) ? 'تعالى' : 'الله') : (authority ? 'ابن باز' : ''));
            const coreTerm = /قصر الصلاة/.test(question) ? 'قصر الصلاة'
              : (/الدين النصيحة/.test(question) ? 'الدين النصيحة'
                : (/العسر يسرا/.test(question) ? 'العسر يسرا'
                  : (/المصالح/.test(question) ? 'المصالح' : question)));
            const plan = {
              issues: [{
                issue_id: 'iss_1', intent: authority ? 'scholar_opinion'
                  : (prophetic ? 'hadith_explanation' : (divine ? 'tafsir' : 'fatwa')),
                requested_authority_id: authority,
                protected_entities: protectedEntity ? [protectedEntity] : [],
                core_terms: [coreTerm], context_vars: [],
                exact_user_phrases: [], required_slots: [], dependencies: [], temporal_scope: 'unknown',
              }],
              missing_qualifiers: [], confidence: 'high',
            };
            return jsonRes({ content: [{ type: 'text', text: JSON.stringify(plan) }], stop_reason: 'end_turn' });
          }
          if (txt.includes('استخرِجِ الادّعاءاتِ الذرّيّة')) {
            state.modelStages.push('extract');
            const span = (txt.match(/\[([^\]\s]+#u\d+s\d+)\]\s*([^\n]*)/) || []);
            const semanticSubject = /الدين النصيحة/.test(question) ? 'الدين النصيحة'
              : (/العسر يسرا/.test(question) ? 'إن مع العسر يسرا'
                : (/المصالح/.test(question) ? 'المصالح' : 'قصر الصلاة'));
            const semanticSlot = /الدين النصيحة|العسر يسرا/.test(question) ? 'meaning' : 'ruling';
            return jsonRes({ content: [{ type: 'text', text: JSON.stringify({ claims: span[1] ? [{
              claim_id: 'c1', text: span[2].slice(0, 100), slot: semanticSlot, span_ids: [span[1]],
              components: [
                { component_id: 'k1', kind: 'subject', text: semanticSubject, span_ids: [span[1]] },
                { component_id: 'k2', kind: 'ruling', text: span[2].slice(0, 60), span_ids: [span[1]] },
              ],
            }] : [] }) }], stop_reason: 'end_turn' });
          }
          if (txt.includes('تحقَّقْ من كلِّ ادّعاءٍ')) {
            const ids = Array.from(txt.matchAll(/### ادّعاء (\S+)/g)).map((match) => match[1]);
            state.modelStages.push('gate2:' + ids.join(','));
            return jsonRes({ content: [{ type: 'text', text: JSON.stringify({
              verdicts: ids.map((claimId) => ({ claim_id: claimId, verdict: 'PASS', unsupported_components: [] })),
            }) }], stop_reason: 'end_turn' });
          }
          if (txt.includes('اكتبِ الجوابَ جملةً جملة')) {
            state.modelStages.push('draft');
            const ids = Array.from(txt.matchAll(/^- \((\S+)\)/gm)).map((match) => match[1]);
            return jsonRes({ content: [{ type: 'text', text: JSON.stringify({
              sentences: ids.map((claimId, i) => ({ sentence_id: 's' + (i + 1), text: draft, claim_ids: [claimId] })),
            }) }], stop_reason: 'end_turn' });
          }
          if (txt.includes('افحصْ كلَّ جملةٍ على حِدَة')) {
            state.modelStages.push('gate3');
            const ids = Array.from(txt.matchAll(/### جملة (\S+)/g)).map((match) => match[1]);
            return jsonRes({ content: [{ type: 'text', text: JSON.stringify({
              verdicts: ids.map((sentenceId) => ({ sentence_id: sentenceId, verdict: 'PASS', added: [] })),
            }) }], stop_reason: 'end_turn' });
          }
          state.round += 1;
          if (state.round === 1 && b.tools) {
            return jsonRes({
              content: [{ type: 'tool_use', id: 'tu1', name: 'search_sources', input: { query: question } }],
              stop_reason: 'tool_use',
            });
          }
          if (b.stream) {
            const frames = [
              'data: ' + JSON.stringify({ type: 'message_start', message: {
                id: 'msg_local', type: 'message', role: 'assistant', content: [],
              } }) + '\n\n',
              'data: ' + JSON.stringify({ type: 'content_block_start', index: 0,
                content_block: { type: 'text', text: '' } }) + '\n\n',
              'data: ' + JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: draft } }) + '\n\n',
              'data: ' + JSON.stringify({ type: 'content_block_stop', index: 0 }) + '\n\n',
              'data: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n',
            ];
            let i = 0;
            return {
              ok: true, status: 200,
              headers: { get: () => 'text/event-stream' },
              body: {
                getReader: () => ({
                  read: async () => (i < frames.length
                    ? { done: false, value: new TextEncoder().encode(frames[i++]) }
                    : { done: true, value: undefined }),
                  releaseLock() {}, cancel: async () => {},
                }),
              },
            };
          }
          return jsonRes({ content: [{ type: 'text', text: draft }], stop_reason: 'end_turn' });
        }
        if (u.includes('api.search.brave.com')) {
          const q = decodeURIComponent((u.split('q=')[1] || '').split('&')[0]).replace(/\+/g, ' ');
          state.braveQueries.push(q);
          const world = /wikipedia|aljazeera|bbc|skynews/.test(q);
          if (world) {
            state.worldProbeCalls += 1;
            if (worldFailure === 'throw') throw new Error('fixture-world-provider-failed');
            if (worldFailure === 'timeout') {
              const timeout = new Error('fixture-world-provider-timeout');
              timeout.name = 'AbortError';
              timeout.code = 'ETIMEDOUT';
              throw timeout;
            }
            const wp = worldEvidence || { title: WORLD_TITLE, url: WORLD_URL, description: 'لاعب' };
            return jsonRes({ web: { results: worldHit ? [{ title: wp.title, url: wp.url, description: wp.description || '' }] : [] } });
          }
          if (/site:binbaz\.org\.sa/.test(q) && (q.match(/site:/g) || []).length === 1) {
            return jsonRes({ web: { results: [{ title: BAZ_TITLE, url: BAZ_URL, description: 'قصر الصلاة للمسافر' }] } });
          }
          const ep = evidence || { title: FIQH_TITLE, url: FIQH_URL, description: 'قصر' };
          return jsonRes({ web: { results: religiousHit
            ? [{ title: ep.title, url: ep.url, description: ep.description || ep.title }] : [] } });
        }
        if (worldEvidence && u.startsWith(worldEvidence.url)) return htmlRes(u, worldEvidence.html);
        if (u.startsWith(WORLD_URL)) return htmlRes(u, WORLD_HTML);
        if (u.startsWith(BAZ_URL)) return htmlRes(u, BAZ_HTML);
        if (evidence && u.startsWith(evidence.url)) return htmlRes(u, evidence.html);
        if (u.startsWith(FIQH_URL)) return htmlRes(u, FIQH_HTML);
        return { ok: false, status: 404, url: u, headers: { get: () => 'text/html' }, text: async () => '' };
      };
      const res = makeRes();
      // Generic fiqh now belongs to the stored-corpus branch and deliberately bypasses the old
      // public identity/retrieval path. These handler fixtures own the still-live specialised
      // hadith/name-presence path, while identity-shaped world questions remain byte-exact.
      const runtimeQuestion = classifiedRoute === 'GEN' || NP.identitySubject(question)
        ? question : question + ' — شرح حديث';
      try { await (await esm('api/ask.js')).default(makeReq(runtimeQuestion), res); } finally {
        activeState = null;
        console.log = originalLog;
        console.warn = originalWarn;
      }
      return { text: readerText(res), res, state };
    };

    try {
      ok('the endpoint checks execute the browser parser shipped in index.html',
        typeof clientVisibleFromRaw === 'function');
      const inventedBody = 'قصر الصلاة في السفر ركعتان كما في المصدر المذكور.';
      const fiqhCard = `<source site="islamqa.info" url="${FIQH_URL}">${FIQH_TITLE}</source>`;
      const bazCard = `<source site="binbaz.org.sa" url="${BAZ_URL}">${BAZ_TITLE}</source>`;
      const sourceRefusal = 'تعذّر عليّ التحقق من مصدر موثوق لهذه الإجابة الآن، لذلك لن أعطيك حكماً بلا مصدر. حاول مرة أخرى بعد قليل أو أعد صياغة السؤال.';
      const ledgerWrongSourceRefusal = 'وجدنا صفحاتٍ متصلةً بالموضوع، لكنها ليست من نوع المصادر التي يصحّ الاستناد إليها في هذا الجزء.';
      const ledgerServiceRefusal = 'تعذر استكمال البحث ضمن الحدود التشغيلية لهذا السؤال، فلم يُستوفَ هذا الجزء بعد.';
      const ledgerPartialNote = 'وجدنا مواد تتناول المسألة، لكن لم يثبت منها ما يكفي لإسناد هذا الجزء إسنادًا صريحًا.';
      const MASALIH_URL = 'https://islamqa.info/ar/answers/999998/masalih-local';
      const MASALIH_TITLE = 'المصالح المعتبرة وضوابطها';
      const masalihBody = 'تُراعى المصالح المعتبرة ضمن الضوابط الشرعية المذكورة في المصدر.';
      const masalihEvidence = {
        url: MASALIH_URL, title: MASALIH_TITLE, description: MASALIH_TITLE,
        html: '<!doctype html><html><head><title>' + MASALIH_TITLE
          + '</title></head><body><article><p>'
          + (masalihBody + ' المصالح المعتبرة لا تنفصل عن الضوابط الشرعية. ').repeat(8)
          + '</p></article></body></html>',
      };
      const masalihCard = `<source site="islamqa.info" url="${MASALIH_URL}">${MASALIH_TITLE}</source>`;
      const hasStandaloneSaleh = (query) => /(^|[^\p{L}\p{N}])صالح(?=$|[^\p{L}\p{N}])/u.test(query);
      const withoutSiteTerms = (query) => String(query || '')
        .replace(/\s*\(site:[\s\S]*\)\s*$/u, '').trim();
      const sacredNeedle = (question) => question.includes('رسول') ? 'رسول'
        : (question.includes('النبي') ? 'النبي'
          : (question.includes('الله') ? 'الله' : 'تعالى'));

      const failedPresenceQuestion = 'ما رأي الشيخ فلان الفلاني في قصر الصلاة؟';
      for (const worldFailure of ['throw', 'timeout']) {
        const failedPresence = await drive(failedPresenceQuestion, inventedBody, { worldFailure });
        const event = failedPresence.state.presenceEvents.at(-1) || {};
        ok('F-003 Legacy RED: a world-provider ' + worldFailure + ' is SEARCH_FAILED, never ABSENT',
          failedPresence.state.worldProbeCalls === 1
            && event.outcome === NP.PRESENCE.SEARCH_FAILED && event.searchCompleted === false
            && event.retrievalOutcome === 'SEARCH_FAILED', JSON.stringify(event));
        ok('F-003 Legacy RED: failed lookup emits no absence/identity instruction and exact body/card bytes survive',
          failedPresence.text === inventedBody + '\n' + fiqhCard
            && !failedPresence.text.includes(NP.nameUnknownLine('فلان الفلاني'))
            && !JSON.stringify(failedPresence.state.modelRequests).includes('لم نقفْ على شخصيّةٍ معروفةٍ بهذا الاسم')
            && closedLifecycle(failedPresence.res), failedPresence.text);
      }
      const completedMiss = await drive(failedPresenceQuestion, inventedBody, { worldHit: false });
      ok('F-003 Legacy control: a genuinely completed empty lookup alone earns the bounded ABSENT line',
        completedMiss.state.presenceEvents.some((event) => event.outcome === NP.PRESENCE.ABSENT
          && event.searchCompleted === true && event.retrievalOutcome === 'COMPLETED_EMPTY')
          && completedMiss.text === NP.nameUnknownLine('فلان الفلاني') + '\n\n'
            + inventedBody + '\n' + fiqhCard
          && closedLifecycle(completedMiss.res), completedMiss.text);
      ok('F-007 Legacy E2E: a proven human UNKNOWN keeps the bounded identity instruction in the model request',
        JSON.stringify(completedMiss.state.modelRequests).includes('لم نقفْ على شخصيّةٍ معروفةٍ بهذا الاسم'));
      const hostileUnknownBodies = [
        'فلان الفلاني شيخ معروف.',
        'فلان الفلاني من كبار العلماء.',
      ];
      const unknownIdentityQuestion = 'من هو فلان الفلاني؟';
      for (const hostileBody of hostileUnknownBodies) {
        const hostile = await drive(unknownIdentityQuestion, hostileBody, {
          worldHit: false, classifiedRoute: 'GEN',
        });
        const hostileProblems = hostile.state.finalizerEvents
          .flatMap((event) => Array.isArray(event.problems) ? event.problems : []);
        ok('F-007 Legacy E2E: typed UNKNOWN rejects the hostile body — «' + hostileBody + '»',
          hostile.res[Symbol.for('ustaz.finalized-sse.context')]?.consistencyContext?.identityStatus === 'unknown'
            && JSON.stringify(hostile.state.modelRequests).includes('لم نقفْ على شخصيّةٍ معروفةٍ بهذا الاسم')
            && hostileProblems.includes(CG.PROBLEM.IDENTITY_WITHOUT_EVIDENCE)
            && hostile.text === NP.nameUnknownLine('فلان الفلاني') + '\n\n' + FT.FINALIZER_REFUSAL
            && !hostile.text.includes(hostileBody) && !hostile.text.includes('<source')
            && closedLifecycle(hostile.res), JSON.stringify({ text: hostile.text, problems: hostileProblems }));
      }
      const safeUnknownBodies = [
        'لا أعلم هل فلان الفلاني عالم معروف.',
        'لم أتحقق من فلان الفلاني. لا أعلم هل ابن باز عالم معروف.',
      ];
      for (const safeBody of safeUnknownBodies) {
        const safe = await drive(unknownIdentityQuestion, safeBody, {
          worldHit: false, classifiedRoute: 'GEN',
        });
        ok('F-007 Legacy false-positive E2E: uncertainty or a separate person survives exactly',
          safe.res[Symbol.for('ustaz.finalized-sse.context')]?.consistencyContext?.identityStatus === 'unknown'
            && safe.text === NP.nameUnknownLine('فلان الفلاني') + '\n\n' + safeBody
            && !safe.state.finalizerEvents.some((event) => (event.problems || [])
              .includes(CG.PROBLEM.IDENTITY_WITHOUT_EVIDENCE))
            && closedLifecycle(safe.res), JSON.stringify({ body: safeBody, text: safe.text }));
      }
      const foundPresenceQuestion = 'ما رأي الشيخ محمد صلاح في قصر الصلاة؟';
      const documentedPublicFigure = NP.notAFatwaSourceLine('محمد صلاح', {
        status: 'not_fatwa_source', verified: true, source: 'wikipedia', url: WORLD_URL,
      });
      const completedFound = await drive(foundPresenceQuestion, inventedBody);
      ok('F-003 Legacy FOUND: positive evidence remains positive and exact reader bytes survive',
        completedFound.state.presenceEvents.some((event) => event.outcome === NP.PRESENCE.FOUND
          && event.retrievalOutcome === 'FOUND' && event.searchCompleted === true)
          && completedFound.text === documentedPublicFigure + '\n\n' + inventedBody + '\n' + fiqhCard
          && closedLifecycle(completedFound.res), completedFound.text);
      const mixedSacredScholarQuestion = 'قال رسول الله ﷺ إنما الأعمال بالنيات، وقال ابن باز إن قصر الصلاة سنة';
      const mixedPlan = AP.planAsk([{ role: 'user', content: mixedSacredScholarQuestion }], { policyEnabled: true });
      const mixedLegacy = await drive(mixedSacredScholarQuestion, BAZ_DRAFT);
      ok('F-001 Legacy E2E: sacred capture is skipped and the later typed scholar remains authoritative',
        mixedPlan.attributionMode === 'namedScholarOpinion' && mixedPlan.namedEntity === 'ابن باز'
          && mixedLegacy.state.worldProbeCalls === 0
          && mixedLegacy.state.routeEvents.some((event) => event.mode === 'namedScholarOpinion'
            && event.entity === 'ابن باز')
          && mixedLegacy.text === BAZ_DRAFT + '\n' + bazCard
          && closedLifecycle(mixedLegacy.res), mixedLegacy.text);
      ok('F-007 Legacy resolved green: a verified scholar is not treated as UNKNOWN',
        mixedLegacy.res[Symbol.for('ustaz.finalized-sse.context')]?.consistencyContext?.identityStatus !== 'unknown'
          && !JSON.stringify(mixedLegacy.state.modelRequests).includes('لم نقفْ على شخصيّةٍ معروفةٍ بهذا الاسم')
          && mixedLegacy.text === BAZ_DRAFT + '\n' + bazCard
          && closedLifecycle(mixedLegacy.res), mixedLegacy.text);
      const priorityLegacyCases = [
        {
          question: 'قال ابن باز إن القصر سنة، فما رأي فلان الفلاني في قصر الصلاة؟',
          target: 'فلان الفلاني', draft: inventedBody, expected: inventedBody + fiqhCard,
        },
        {
          question: 'ما رأي فلان الفلاني في قصر الصلاة؟ وقد ذكر ابن باز قولًا آخر',
          target: 'فلان الفلاني', draft: inventedBody, expected: inventedBody + fiqhCard,
        },
        {
          question: 'أريد المادة من موقع الشيخ فلان، فما رأي ابن باز في قصر الصلاة؟',
          target: 'ابن باز', draft: BAZ_DRAFT, expected: BAZ_DRAFT + '\n' + bazCard,
        },
        {
          question: 'قال ابن باز إن قصر الصلاة سنة، ثم قال رسول الله ﷺ إنما الأعمال بالنيات',
          target: 'ابن باز', draft: BAZ_DRAFT, expected: BAZ_DRAFT + '\n' + bazCard,
        },
      ];
      for (const fixture of priorityLegacyCases) {
        const planned = AP.planAsk([{ role: 'user', content: fixture.question }], { policyEnabled: true });
        const result = await drive(fixture.question, fixture.draft);
        ok('F-001 Legacy intent priority: selected target is «' + fixture.target + '»',
          planned.namedEntity === fixture.target
            && result.state.routeEvents.some((event) => event.mode === 'namedScholarOpinion'
              && event.entity === fixture.target)
            && result.text === fixture.expected && closedLifecycle(result.res),
          JSON.stringify({ plan: planned.namedEntity, text: result.text }));
      }
      const typedAmbiguityQuestions = [
        'ما رأي ابن حجر في المسألة؟',
        'ما رأي ابن حجر فيمن ترك الصلاة؟',
        'ماذا يقول ابن حجر عن صيام يوم الشك؟',
      ];
      const typedAmbiguityQuestion = typedAmbiguityQuestions[0];
      const typedAmbiguityPlan = AP.planAsk(
        [{ role: 'user', content: typedAmbiguityQuestion }], { policyEnabled: true });
      const typedAmbiguityText = 'هذا الاسم ينطبق على أكثر من عالِمٍ عندنا، ولا أختار أحدَهم بالظنّ. أيَّهما تقصد؟\n'
        + '- ابن حجر العسقلاني\n- ابن حجر الهيتمي';
      for (const question of typedAmbiguityQuestions) {
        const plan = AP.planAsk([{ role: 'user', content: question }], { policyEnabled: true });
        const authority = plan.entities.find((entity) => entity.role === 'authority');
        const ambiguityLegacy = await drive(question, 'نص يجب ألا يُنشأ لهذه الحالة.');
        ok('F-081 natural ambiguity Legacy coverage: chosen span owns the typed authority',
          plan.attributionMode === 'namedScholarOpinion' && plan.namedEntity === 'ابن حجر'
            && plan.attribution?.attributionSpan?.nameWordCount === 2
            && authority?.surface === 'ابن حجر' && authority?.resolutionStatus === 'ambiguous'
            && ambiguityLegacy.state.routeEvents.some((event) => event.mode === 'namedScholarOpinion'
              && event.entity === 'ابن حجر')
            && ambiguityLegacy.state.ledgerPlannerCalls === 0
            && ambiguityLegacy.text === typedAmbiguityText
            && ambiguityLegacy.res.writes.join('').includes(': rfc-path=legacy')
            && closedLifecycle(ambiguityLegacy.res), ambiguityLegacy.text);
      }
      const masalihQuestion = 'ما حكم المصالح عند الشيخ صالح؟';
      const masalihLegacy = await drive(masalihQuestion, masalihBody, {
        worldHit: false, evidence: masalihEvidence,
      });
      const masalihLegacyQueries = masalihLegacy.state.braveQueries
        .filter((query) => !/wikipedia|aljazeera|bbc|skynews/.test(query));
      ok('F-006 Legacy E2E: only the governed صالح span is removed while «المصالح» survives',
        masalihLegacyQueries.length > 0
          && masalihLegacyQueries.every((query) => withoutSiteTerms(query) === 'ما حكم المصالح'
            && !hasStandaloneSaleh(query))
          && masalihLegacy.text === NP.nameUnknownLine('صالح') + '\n\n'
            + masalihBody + '\n' + masalihCard
          && closedLifecycle(masalihLegacy.res), JSON.stringify({ text: masalihLegacy.text, queries: masalihLegacyQueries }));
      const markedSalehQuestion = 'ما رأي الشَّيخ صَالِح في قصر الصلاة؟';
      const markedSalehPlan = AP.planAsk(
        [{ role: 'user', content: markedSalehQuestion }], { policyEnabled: true });
      const markedSalehLegacy = await drive(markedSalehQuestion, inventedBody, { worldHit: false });
      const markedSalehLegacyQueries = markedSalehLegacy.state.braveQueries
        .filter((query) => !/wikipedia|aljazeera|bbc|skynews/.test(query));
      ok('F-006 diacritic Legacy coverage: typed span and topic survive standard Arabic marks',
        markedSalehPlan.namedEntity === 'صالح' && markedSalehPlan.topic === 'قصر الصلاة؟'
          && markedSalehLegacy.state.routeEvents.some((event) => event.entity === 'صالح')
          && markedSalehLegacyQueries.length > 0
          && markedSalehLegacyQueries.every((query) => withoutSiteTerms(query) === 'قصر الصلاة؟')
          && markedSalehLegacy.text === NP.nameUnknownLine('صالح') + '\n\n'
            + inventedBody + '\n' + fiqhCard
          && closedLifecycle(markedSalehLegacy.res), JSON.stringify({
            plan: markedSalehPlan, queries: markedSalehLegacyQueries, text: markedSalehLegacy.text,
          }));

      // Every F-014 case traverses the real entry point. Religious retrieval may run; the bounded
      // WORLD identity probe and identity cache must remain untouched.
      for (const question of SACRED_CASES) {
        const sacred = await drive(question, 'هذا النص غير مسند ويجب ألا يصل.', { religiousHit: false });
        ok('endpoint sacred: zero world probes — «' + question.slice(0, 24) + '…»',
          sacred.state.worldProbeCalls === 0, JSON.stringify(sacred.state.braveQueries));
        ok('endpoint sacred: zero identity-cache writes', sacred.state.identityCacheWrites === 0);
        ok('endpoint sacred: no false person/presence/UNKNOWN text',
          !/ليس ممّن تُؤخَذ عنه الفتوى|لم نقف على شخصية معروفة|لا أعرف هذا الاسم/.test(sacred.text),
          sacred.text.slice(0, 260));
        ok('endpoint sacred: valid, single-stop SSE lifecycle', closedLifecycle(sacred.res), sacred.res.writes.join(''));
        ok('endpoint sacred negative: no relevant evidence yields the exact fixed refusal only',
          sacred.text === sourceRefusal, sacred.text);
        ok('endpoint sacred: UNKNOWN instruction never entered any model request',
          !JSON.stringify(sacred.state.modelRequests).includes('لم نقفْ على شخصيّةٍ معروفةٍ بهذا الاسم'));
        if (question === SACRED_CASES[0]) {
          ok('F-013 Legacy handler: sacred chain reaches DEEN with no world identity side effect',
            sacred.state.routeEvents.some((event) => event.route === 'DEEN' && !event.entity)
              && sacred.state.worldProbeCalls === 0 && closedLifecycle(sacred.res));
        }
        const religious = sacred.state.braveQueries.filter((q) => !/wikipedia|aljazeera|bbc|skynews/.test(q));
        const needle = sacredNeedle(question);
        ok('endpoint sacred: an actual religious query ran and retained «' + needle + '»',
          religious.length > 0 && religious.some((query) => query.includes(needle)),
          JSON.stringify(religious));
        if (question === 'قال تعالى: إن مع العسر يسرا.') {
          ok('F-002 Legacy E2E: contextual divine frame routes DEEN without a person probe',
            sacred.state.routeEvents.some((event) => event.route === 'DEEN' && !event.entity)
              && sacred.state.worldProbeCalls === 0 && closedLifecycle(sacred.res));
        }
      }

      for (const question of [
        'تعالى صوت خالد في المجلس، فما رأيه؟',
        'تعالى البناء فوق الطريق',
      ]) {
        const body = question.includes('صوت')
          ? 'ارتفع صوت خالد في المجلس.' : 'ارتفع البناء فوق الطريق.';
        const mundane = await drive(question, body, { classifiedRoute: 'GEN' });
        ok('F-002 Legacy E2E: mundane «تعالى» remains GEN and byte-exact',
          mundane.state.routeEvents.some((event) => event.route === 'GEN' && !event.entity)
            && mundane.state.worldProbeCalls === 0 && mundane.state.braveQueries.length === 0
            && mundane.text === body && closedLifecycle(mundane.res), mundane.text);
      }

      for (const fixture of [
        {
          question: 'ما معنى ما نص عليه النبي ﷺ: الدين النصيحة؟', body: HADITH_BODY,
          evidence: { url: HADITH_URL, title: HADITH_TITLE, html: HADITH_HTML, description: HADITH_TITLE },
          card: `<source site="islamqa.info" url="${HADITH_URL}">${HADITH_TITLE}</source>`,
        },
        {
          question: 'ما معنى قول الله تعالى: إن مع العسر يسرا؟', body: TAFSIR_BODY,
          evidence: { url: TAFSIR_URL, title: TAFSIR_TITLE, html: TAFSIR_HTML, description: TAFSIR_TITLE },
          card: `<source site="islamqa.info" url="${TAFSIR_URL}">${TAFSIR_TITLE}</source>`,
        },
      ]) {
        const supported = await drive(fixture.question, fixture.body, { evidence: fixture.evidence });
        ok('endpoint sacred green: aligned body and owned card are byte-exact',
          supported.text === fixture.body + fixture.card && closedLifecycle(supported.res), supported.text);
        ok('endpoint sacred green: no identity probe/cache/prompt side effect',
          supported.state.worldProbeCalls === 0 && supported.state.identityCacheWrites === 0
            && !JSON.stringify(supported.state.modelRequests).includes('لم نقفْ على شخصيّةٍ معروفةٍ بهذا الاسم'));
      }

      for (const [question, expectedName] of HUMAN_DIVINE_NAME_CASES) {
        const human = await drive(question, inventedBody, { worldHit: false });
        const religious = human.state.braveQueries.filter((q) => !/wikipedia|aljazeera|bbc|skynews/.test(q));
        const expected = NP.nameUnknownLine(expectedName) + '\n\n' + inventedBody + '\n' + fiqhCard;
        ok('human divine-name endpoint: bounded identity probe runs — «' + expectedName + '»',
          human.state.worldProbeCalls > 0, JSON.stringify(human.state.braveQueries));
        ok('human divine-name endpoint: only the verified identity span is stripped from search',
          religious.length > 0 && religious.every((q) => !q.includes(expectedName)), JSON.stringify(religious));
        ok('human divine-name endpoint: exact bounded line/body/card and lifecycle survive',
          human.text === expected && closedLifecycle(human.res), human.text);
        if (question === HUMAN_DIVINE_NAME_CASES[0][0]) {
          ok('F-013 Legacy handler: typed human chain reaches its bounded world probe',
            human.state.worldProbeCalls > 0
              && human.state.routeEvents.some((event) => event.entity === expectedName)
              && closedLifecycle(human.res));
        }
      }

      const suffixHuman = await drive('ما رأي الشيخ عبد الرحمن السعدي رحمه الله في قصر الصلاة؟',
        inventedBody, { worldHit: false });
      ok('human divine-name endpoint: «رحمه الله» remains a cleaned suffix',
        suffixHuman.text === NP.nameUnknownLine('عبد الرحمن السعدي') + '\n\n'
          + inventedBody + '\n' + fiqhCard && closedLifecycle(suffixHuman.res), suffixHuman.text);

      const unknownHumanTitles = ['الإمام', 'المفتي', 'الحافظ', 'شيخ الإسلام'];
      for (const title of unknownHumanTitles) {
        const question = `ما رأي ${title} فلان الفلاني في قصر الصلاة؟`;
        const human = await drive(question, inventedBody, { worldHit: false });
        ok('F-007 Legacy human-title UNKNOWN remains bounded — «' + title + '»',
          human.state.worldProbeCalls === 1
            && human.res[Symbol.for('ustaz.finalized-sse.context')]?.consistencyContext?.identityStatus === 'unknown'
            && JSON.stringify(human.state.modelRequests).includes('لم نقفْ على شخصيّةٍ معروفةٍ بهذا الاسم')
            && human.text === NP.nameUnknownLine('فلان الفلاني') + '\n\n'
              + inventedBody + '\n' + fiqhCard
            && closedLifecycle(human.res), human.text);
      }

      for (const [plainQuestion, titledQuestion, person] of [
        ['ما رأي خالد عبدالرحمن في قصر الصلاة؟', 'ما رأي الشيخ خالد عبدالرحمن في قصر الصلاة؟', 'خالد عبدالرحمن'],
        ['ماقول عبدالله الرويشد في حكم قصر الصلاة؟', 'ماقول الشيخ عبدالله الرويشد في حكم قصر الصلاة؟', 'عبدالله الرويشد'],
      ]) {
        const plain = await drive(plainQuestion, inventedBody, { worldHit: false });
        const plainReligious = plain.state.braveQueries.filter((q) => !/wikipedia|aljazeera|bbc|skynews/.test(q));
        ok('plain natural fixture: no world identity claim or presence denial — «' + person + '»',
          plain.state.worldProbeCalls === 0
            && !/لم أتحقق من هذا الاسم|ليس ممّن تُؤخَذ عنه الفتوى/.test(plain.text)
            && !JSON.stringify(plain.state.modelRequests).includes('لم نقفْ على شخصيّةٍ معروفةٍ بهذا الاسم')
            && plain.text === inventedBody + fiqhCard && closedLifecycle(plain.res), plain.text);
        ok('plain natural fixture: raw capture shapes only the query, by exact whole-span removal',
          plainReligious.length > 0 && plainReligious.every((q) => !q.includes(person))
            && plainReligious.some((q) => q.includes('قصر الصلاة')), JSON.stringify(plainReligious));
        const titled = await drive(titledQuestion, inventedBody, { worldHit: false });
        const titledReligious = titled.state.braveQueries.filter((q) => !/wikipedia|aljazeera|bbc|skynews/.test(q));
        ok('titled typed fixture: bounded world path runs and emits only its scoped miss',
          titled.state.worldProbeCalls > 0
            && titled.text === NP.nameUnknownLine(person) + '\n\n' + inventedBody + '\n' + fiqhCard
            && closedLifecycle(titled.res), titled.text);
        ok('titled typed fixture: only its verified identity span is removed from search',
          titledReligious.length > 0 && titledReligious.every((q) => !q.includes(person)), JSON.stringify(titledReligious));
      }

      // The same entry point with the production Ledger floor enabled. A valid local planner reply
      // makes the seam run; no live dependency is used and the identity stages remain untouched.
      process.env.LEDGER_RAG = 'on';
      process.env.RFC_V05_MODE = 'internal';
      process.env.DAILY_SEARCH_BUDGET = '500';
      ledgerBudgetUsed = 0;
      for (const worldFailure of ['throw', 'timeout']) {
        const failedPresence = await drive(failedPresenceQuestion, inventedBody, { worldFailure });
        const event = failedPresence.state.presenceEvents.at(-1) || {};
        ok('F-003 Ledger RED: a world-provider ' + worldFailure + ' is SEARCH_FAILED, never ABSENT',
          failedPresence.state.ledgerPlannerCalls >= 1
            && failedPresence.state.worldProbeCalls === 1
            && event.outcome === NP.PRESENCE.SEARCH_FAILED && event.searchCompleted === false
            && event.retrievalOutcome === 'SEARCH_FAILED', JSON.stringify(event));
        ok('F-003 Ledger RED: failed lookup emits no absence/identity instruction and exact body/card bytes survive',
          failedPresence.res.writes.join('').includes(': rfc-path=ledger')
            && failedPresence.text === inventedBody + '\n' + fiqhCard
            && !failedPresence.text.includes(NP.nameUnknownLine('فلان الفلاني'))
            && !JSON.stringify(failedPresence.state.modelRequests).includes('لم نقفْ على شخصيّةٍ معروفةٍ بهذا الاسم')
            && closedLifecycle(failedPresence.res), failedPresence.text);
      }
      const ledgerCompletedMiss = await drive(failedPresenceQuestion, inventedBody, { worldHit: false });
      ok('F-003 Ledger control: a genuinely completed empty lookup alone earns the bounded ABSENT line',
        ledgerCompletedMiss.state.ledgerPlannerCalls >= 1
          && ledgerCompletedMiss.state.presenceEvents.some((event) => event.outcome === NP.PRESENCE.ABSENT
            && event.searchCompleted === true && event.retrievalOutcome === 'COMPLETED_EMPTY')
          && ledgerCompletedMiss.text === NP.nameUnknownLine('فلان الفلاني') + '\n\n'
            + inventedBody + '\n' + fiqhCard
          && closedLifecycle(ledgerCompletedMiss.res), ledgerCompletedMiss.text);
      ok('F-007 Ledger E2E: the narrow sacred veto does not suppress a genuine human UNKNOWN lead',
        ledgerCompletedMiss.text.startsWith(NP.nameUnknownLine('فلان الفلاني') + '\n\n'));
      for (const hostileBody of hostileUnknownBodies) {
        const hostileUnknown = await drive(failedPresenceQuestion, hostileBody, { worldHit: false });
        const hostileProblems = hostileUnknown.state.finalizerEvents
          .flatMap((event) => Array.isArray(event.problems) ? event.problems : []);
        ok('F-007 Ledger E2E: typed UNKNOWN rejects the hostile body — «' + hostileBody + '»',
          hostileUnknown.state.ledgerPlannerCalls >= 1
            && hostileUnknown.res.writes.join('').includes(': rfc-path=ledger')
            && hostileUnknown.res[Symbol.for('ustaz.finalized-sse.context')]
              ?.consistencyContext?.identityStatus === 'unknown'
            && hostileProblems.includes(CG.PROBLEM.IDENTITY_WITHOUT_EVIDENCE)
            && hostileUnknown.text === NP.nameUnknownLine('فلان الفلاني') + '\n\n' + FT.FINALIZER_REFUSAL
            && !hostileUnknown.text.includes(hostileBody) && !hostileUnknown.text.includes('<source')
            && hostileUnknown.text.split(NP.nameUnknownLine('فلان الفلاني')).length - 1 === 1
            && closedLifecycle(hostileUnknown.res), JSON.stringify({
              text: hostileUnknown.text, problems: hostileProblems,
            }));
      }
      for (const safeBody of safeUnknownBodies) {
        const safeUnknown = await drive(failedPresenceQuestion, safeBody, {
          worldHit: false,
          evidence: safeBody.includes('ابن باز')
            ? { title: BAZ_TITLE, url: BAZ_URL, description: BAZ_TITLE, html: BAZ_HTML }
            : null,
        });
        const expectedCard = safeBody.includes('ابن باز') ? bazCard : fiqhCard;
        ok('F-007 Ledger false-positive E2E: uncertainty or a separate person survives exactly',
          safeUnknown.state.ledgerPlannerCalls >= 1
            && safeUnknown.res.writes.join('').includes(': rfc-path=ledger')
            && safeUnknown.res[Symbol.for('ustaz.finalized-sse.context')]
              ?.consistencyContext?.identityStatus === 'unknown'
            && safeUnknown.text === NP.nameUnknownLine('فلان الفلاني') + '\n\n'
              + safeBody + '\n' + expectedCard
            && !safeUnknown.state.finalizerEvents.some((event) => (event.problems || [])
              .includes(CG.PROBLEM.IDENTITY_WITHOUT_EVIDENCE))
            && closedLifecycle(safeUnknown.res), JSON.stringify({ body: safeBody, text: safeUnknown.text }));
      }
      const ledgerCompletedFound = await drive(foundPresenceQuestion, inventedBody);
      ok('F-003 Ledger FOUND: positive evidence remains positive on the real Ledger path',
        ledgerCompletedFound.state.ledgerPlannerCalls >= 1
          && ledgerCompletedFound.res.writes.join('').includes(': rfc-path=ledger')
          && ledgerCompletedFound.state.presenceEvents.some((event) => event.outcome === NP.PRESENCE.FOUND
            && event.retrievalOutcome === 'FOUND' && event.searchCompleted === true)
          && ledgerCompletedFound.text === documentedPublicFigure + '\n\n' + inventedBody + '\n' + fiqhCard
          && closedLifecycle(ledgerCompletedFound.res), ledgerCompletedFound.text);
      const mixedLedger = await drive(mixedSacredScholarQuestion, BAZ_DRAFT);
      ok('F-001 Ledger E2E: mixed sacred/scholar attribution reaches the real Ledger path as ابن باز',
        mixedLedger.state.ledgerPlannerCalls >= 1
          && mixedLedger.res.writes.join('').includes(': rfc-path=ledger')
          && mixedLedger.state.worldProbeCalls === 0
          && mixedLedger.state.routeEvents.some((event) => event.mode === 'namedScholarOpinion'
            && event.entity === 'ابن باز')
          && mixedLedger.text === BAZ_DRAFT + '\n\n' + ledgerPartialNote + '\n' + bazCard
          && closedLifecycle(mixedLedger.res), mixedLedger.text);
      ok('F-007 Ledger resolved green: a verified scholar keeps exact output without UNKNOWN context',
        mixedLedger.state.ledgerPlannerCalls >= 1
          && mixedLedger.res[Symbol.for('ustaz.finalized-sse.context')]?.consistencyContext?.identityStatus !== 'unknown'
          && !JSON.stringify(mixedLedger.state.modelRequests).includes('لم نقفْ على شخصيّةٍ معروفةٍ بهذا الاسم')
          && mixedLedger.text === BAZ_DRAFT + '\n\n' + ledgerPartialNote + '\n' + bazCard
          && closedLifecycle(mixedLedger.res), mixedLedger.text);
      for (const fixture of priorityLegacyCases) {
        const expected = fixture.target === 'ابن باز'
          ? BAZ_DRAFT + '\n\n' + ledgerPartialNote + '\n' + bazCard
          : inventedBody + '\n' + fiqhCard;
        const result = await drive(fixture.question, fixture.draft);
        ok('F-001 Ledger intent priority: selected target is «' + fixture.target + '» on the real engine',
          result.state.ledgerPlannerCalls >= 1
            && result.res.writes.join('').includes(': rfc-path=ledger')
            && result.state.routeEvents.some((event) => event.mode === 'namedScholarOpinion'
              && event.entity === fixture.target)
            && result.text === expected && closedLifecycle(result.res),
          JSON.stringify({ text: result.text, stages: result.state.modelStages }));
      }
      for (const question of typedAmbiguityQuestions) {
        const ambiguityLedger = await drive(question, 'نص يجب ألا يُنشأ لهذه الحالة.');
        ok('F-081 natural ambiguity Ledger coverage: typed target returns before invention',
          ambiguityLedger.res.writes.join('').includes(': rfc-path=ledger')
            && ambiguityLedger.state.routeEvents.some((event) => event.mode === 'namedScholarOpinion'
              && event.entity === 'ابن حجر')
            && ambiguityLedger.state.ledgerPlannerCalls === 0
            && ambiguityLedger.text === typedAmbiguityText
            && closedLifecycle(ambiguityLedger.res), ambiguityLedger.text);
      }
      const masalihLedger = await drive(masalihQuestion, masalihBody, {
        worldHit: false, evidence: masalihEvidence,
      });
      const masalihLedgerQueries = masalihLedger.state.braveQueries
        .filter((query) => !/wikipedia|aljazeera|bbc|skynews/.test(query));
      ok('F-006 Ledger E2E: exact span deletion reaches the real Ledger query and output path',
        masalihLedger.state.ledgerPlannerCalls >= 1
          && masalihLedger.res.writes.join('').includes(': rfc-path=ledger')
          && masalihLedgerQueries.length > 0
          && masalihLedgerQueries.every((query) => withoutSiteTerms(query) === 'المصالح'
            && !hasStandaloneSaleh(query))
          && masalihLedger.text === NP.nameUnknownLine('صالح') + '\n\n'
            + masalihBody + '\n' + masalihCard
          && closedLifecycle(masalihLedger.res), JSON.stringify({ text: masalihLedger.text, queries: masalihLedgerQueries }));
      const markedSalehLedger = await drive(markedSalehQuestion, inventedBody, { worldHit: false });
      ok('F-006 diacritic Ledger coverage: typed span reaches the real planner without corrupting bytes',
        markedSalehLedger.state.ledgerPlannerCalls >= 1
          && markedSalehLedger.res.writes.join('').includes(': rfc-path=ledger')
          && markedSalehLedger.state.routeEvents.some((event) => event.entity === 'صالح')
          && markedSalehLedger.state.modelRequests.some((request) => JSON.stringify(request).includes(markedSalehQuestion))
          && markedSalehLedger.text === NP.nameUnknownLine('صالح') + '\n\n'
            + inventedBody + '\n' + fiqhCard
          && closedLifecycle(markedSalehLedger.res), JSON.stringify({
            stages: markedSalehLedger.state.modelStages, text: markedSalehLedger.text,
          }));
      for (const question of SACRED_CASES) {
        const sacred = await drive(question, 'هذا النص غير مسند ويجب ألا يصل.', { religiousHit: false });
        ok('ledger endpoint sacred: the real Ledger path ran — «' + question.slice(0, 22) + '…»',
          sacred.state.ledgerPlannerCalls >= 1 && sacred.res.writes.join('').includes(': rfc-path=ledger'));
        ok('ledger endpoint sacred: zero world probes and cache writes',
          sacred.state.worldProbeCalls === 0 && sacred.state.identityCacheWrites === 0,
          JSON.stringify(sacred.state));
        ok('ledger endpoint sacred: no false person/presence/UNKNOWN text',
          !/ليس ممّن تُؤخَذ عنه الفتوى|لم نقف على شخصية معروفة|لا أعرف هذا الاسم/.test(sacred.text),
          sacred.text.slice(0, 260));
        ok('ledger endpoint sacred: valid, single-stop SSE lifecycle',
          closedLifecycle(sacred.res), sacred.res.writes.join(''));
        ok('ledger endpoint sacred negative: no evidence yields the exact fixed safe rejection only',
          sacred.text === ledgerServiceRefusal, sacred.text);
        ok('ledger endpoint sacred: UNKNOWN instruction never entered any model request',
          !JSON.stringify(sacred.state.modelRequests).includes('لم نقفْ على شخصيّةٍ معروفةٍ بهذا الاسم'));
        if (question === SACRED_CASES[0]) {
          ok('F-013 Ledger handler: sacred chain reaches the real engine without identity side effects',
            sacred.state.ledgerPlannerCalls >= 1
              && sacred.res.writes.join('').includes(': rfc-path=ledger')
              && sacred.state.worldProbeCalls === 0 && closedLifecycle(sacred.res));
        }
        const religious = sacred.state.braveQueries
          .filter((query) => !/wikipedia|aljazeera|bbc|skynews/.test(query));
        const needle = sacredNeedle(question);
        ok('ledger endpoint sacred: actual query retained «' + needle + '»',
          religious.length > 0 && religious.some((query) => query.includes(needle)),
          JSON.stringify(religious));
        if (question === 'قال تعالى: إن مع العسر يسرا.') {
          ok('F-002 Ledger E2E: contextual divine frame stays person-free on the real engine',
            sacred.state.ledgerPlannerCalls >= 1
              && sacred.state.routeEvents.some((event) => event.route === 'DEEN' && !event.entity)
              && sacred.state.worldProbeCalls === 0 && closedLifecycle(sacred.res));
        }
      }


      for (const question of [
        'تعالى صوت خالد في المجلس، فما رأيه؟',
        'تعالى البناء فوق الطريق',
      ]) {
        const generalBody = 'نص دنيوي لا ينبغي أن يصل بلا دليل هنا.';
        const mundane = await drive(question, generalBody, {
          classifiedRoute: 'GEN', religiousHit: false,
        });
        ok('F-002 router-first E2E: mundane «تعالى» bypasses DEEN/Ledger and any person probe',
          mundane.state.ledgerPlannerCalls === 0
            && mundane.state.routeEvents.some((event) => event.route === 'GEN' && !event.entity)
            && mundane.state.worldProbeCalls === 0
            && mundane.text === generalBody && closedLifecycle(mundane.res), JSON.stringify({
              text: mundane.text,
              plannerCalls: mundane.state.ledgerPlannerCalls,
              routes: mundane.state.routeEvents,
              worldProbeCalls: mundane.state.worldProbeCalls,
              writes: mundane.res.writes,
            }));
      }

      for (const fixture of [
        {
          question: 'ما معنى ما نص عليه النبي ﷺ: الدين النصيحة؟', body: HADITH_BODY,
          evidence: { url: HADITH_URL, title: HADITH_TITLE, html: HADITH_HTML, description: HADITH_TITLE },
          card: `<source site="islamqa.info" url="${HADITH_URL}">${HADITH_TITLE}</source>`,
        },
        {
          question: 'ما معنى قول الله تعالى: إن مع العسر يسرا؟', body: TAFSIR_BODY,
          evidence: { url: TAFSIR_URL, title: TAFSIR_TITLE, html: TAFSIR_HTML, description: TAFSIR_TITLE },
          card: `<source site="islamqa.info" url="${TAFSIR_URL}">${TAFSIR_TITLE}</source>`,
        },
      ]) {
        const supported = await drive(fixture.question, fixture.body, { evidence: fixture.evidence });
        ok('ledger endpoint sacred green: real Ledger path ran',
          supported.state.ledgerPlannerCalls >= 1 && supported.res.writes.join('').includes(': rfc-path=ledger'));
        ok('ledger endpoint sacred green: aligned body/card bytes and lifecycle are exact',
          supported.text === fixture.body + '\n' + fixture.card && closedLifecycle(supported.res), supported.text);
        ok('ledger endpoint sacred green: no identity probe/cache/prompt side effect',
          supported.state.worldProbeCalls === 0 && supported.state.identityCacheWrites === 0
            && !JSON.stringify(supported.state.modelRequests).includes('لم نقفْ على شخصيّةٍ معروفةٍ بهذا الاسم'));
      }

      for (const [question, expectedName] of HUMAN_DIVINE_NAME_CASES) {
        const human = await drive(question, inventedBody, { worldHit: false });
        const expected = NP.nameUnknownLine(expectedName) + '\n\n' + inventedBody + '\n' + fiqhCard;
        ok('ledger human divine-name: the real Ledger path ran — «' + expectedName + '»',
          human.state.ledgerPlannerCalls >= 1 && human.res.writes.join('').includes(': rfc-path=ledger'));
        ok('ledger human divine-name: bounded line, body and owned card are byte-exact',
          human.text === expected && closedLifecycle(human.res),
          JSON.stringify({ text: human.text, stages: human.state.modelStages }));
        if (question === HUMAN_DIVINE_NAME_CASES[0][0]) {
          ok('F-013 Ledger handler: typed human chain reaches the real engine and bounded probe',
            human.state.ledgerPlannerCalls >= 1
              && human.res.writes.join('').includes(': rfc-path=ledger')
              && human.state.worldProbeCalls > 0 && closedLifecycle(human.res));
        }
      }

      for (const title of unknownHumanTitles) {
        const question = `ما رأي ${title} فلان الفلاني في قصر الصلاة؟`;
        const human = await drive(question, inventedBody, { worldHit: false });
        ok('F-007 Ledger human-title UNKNOWN is enforced as typed context — «' + title + '»',
          human.state.ledgerPlannerCalls >= 1
            && human.res.writes.join('').includes(': rfc-path=ledger')
            && human.res[Symbol.for('ustaz.finalized-sse.context')]?.consistencyContext?.identityStatus === 'unknown'
            && human.text === NP.nameUnknownLine('فلان الفلاني') + '\n\n'
              + inventedBody + '\n' + fiqhCard
            && closedLifecycle(human.res), human.text);
      }

      for (const [plainQuestion, titledQuestion, person] of [
        ['ما رأي خالد عبدالرحمن في قصر الصلاة؟', 'ما رأي الشيخ خالد عبدالرحمن في قصر الصلاة؟', 'خالد عبدالرحمن'],
        ['ماقول عبدالله الرويشد في حكم قصر الصلاة؟', 'ماقول الشيخ عبدالله الرويشد في حكم قصر الصلاة؟', 'عبدالله الرويشد'],
      ]) {
        const plain = await drive(plainQuestion, inventedBody, { worldHit: false });
        const plainReligious = plain.state.braveQueries.filter((q) => !/wikipedia|aljazeera|bbc|skynews/.test(q));
        ok('ledger plain raw fixture: query-only identity cannot reach reader behavior — «' + person + '»',
          plain.state.ledgerPlannerCalls >= 1 && plain.state.worldProbeCalls === 0
            && plain.text === inventedBody + '\n' + fiqhCard && closedLifecycle(plain.res)
            && !JSON.stringify(plain.state.modelRequests).includes('لم نقفْ على شخصيّةٍ معروفةٍ بهذا الاسم'), plain.text);
        ok('ledger plain raw fixture: exact whole span is absent only from retrieval query',
          plainReligious.length > 0 && plainReligious.every((q) => !q.includes(person))
            && plainReligious.some((q) => q.includes('قصر الصلاة')), JSON.stringify(plainReligious));

        const titled = await drive(titledQuestion, inventedBody, { worldHit: false });
        const expectedTitled = NP.nameUnknownLine(person) + '\n\n' + inventedBody + '\n' + fiqhCard;
        ok('ledger titled typed fixture: bounded identity path remains exact — «' + person + '»',
          titled.state.ledgerPlannerCalls >= 1 && titled.state.worldProbeCalls > 0
            && titled.text === expectedTitled && closedLifecycle(titled.res), titled.text);
      }

      const singleWorld = {
        url: 'https://ar.wikipedia.org/wiki/%D8%AE%D8%A7%D9%84%D8%AF', title: 'خالد', description: 'اسم عربي',
        html: '<!doctype html><html><head><title>خالد</title></head><body><article><h1>خالد</h1><p>'
          + 'خالد اسم عربي يرد في صفحات كثيرة وقد يطلق على أشخاص متعددين، ولا تكفي هذه الصفحة العامة '
          + 'لتعيين الشخص المقصود في السؤال أو إثبات هويته. '.repeat(5) + '</p></article></body></html>',
      };
      const singleUnknown = await drive('ما رأي الشيخ خالد في قصر الصلاة؟', inventedBody,
        { worldEvidence: singleWorld });
      ok('F-005 endpoint: an incidental single-token page cannot back an unresolved identity',
        singleUnknown.state.ledgerPlannerCalls >= 1
          && singleUnknown.res.writes.join('').includes(': rfc-path=ledger')
          && singleUnknown.state.worldProbeCalls > 0
          && singleUnknown.state.presenceEvents.some((event) => event.outcome === NP.PRESENCE.ABSENT)
          && singleUnknown.text === NP.nameUnknownLine('خالد') + '\n\n' + inventedBody + '\n' + fiqhCard
          && closedLifecycle(singleUnknown.res), singleUnknown.text);

      const ledgerFarkous = await drive('ما رأي فركوس في قصر الصلاة؟', inventedBody);
      ok('F-005 Ledger green: same-surface registered single-token authority reaches the real engine',
        ledgerFarkous.state.ledgerPlannerCalls >= 1
          && ledgerFarkous.res.writes.join('').includes(': rfc-path=ledger')
          && ledgerFarkous.state.routeEvents.some((event) => event.mode === 'namedScholarOpinion'
            && event.entity === 'فركوس')
          && ledgerFarkous.state.worldProbeCalls === 0
          && ledgerFarkous.text === inventedBody + '\n' + fiqhCard
          && closedLifecycle(ledgerFarkous.res), ledgerFarkous.text);

      const ledgerBaz = await drive('ما رأي ابن باز في قصر الصلاة؟', BAZ_DRAFT);
      const expectedLedgerBaz = BAZ_DRAFT + '\n\n' + ledgerPartialNote + '\n' + bazCard;
      ok('ledger known green: body, bounded ledger note and owned card bytes are exact and ordered',
        ledgerBaz.text === expectedLedgerBaz && closedLifecycle(ledgerBaz.res), ledgerBaz.text);
      const ledgerUnknown = await drive('ما رأي الشيخ فلان الفلاني في قصر الصلاة؟',
        inventedBody, { worldHit: false });
      const expectedLedgerUnknown = NP.nameUnknownLine('فلان الفلاني') + '\n\n'
        + inventedBody + '\n' + fiqhCard;
      ok('ledger unknown green: bounded line, body and card are exact',
        ledgerUnknown.text === expectedLedgerUnknown && closedLifecycle(ledgerUnknown.res),
        JSON.stringify({ text: ledgerUnknown.text, stages: ledgerUnknown.state.modelStages }));
      process.env.LEDGER_RAG = 'off';
      process.env.RFC_V05_MODE = 'internal';

      // ── TEST 1: the singer ─────────────────────────────────────────────────
      const singer = await drive('ما رأي خالد عبدالرحمن في قصر الصلاة؟',
        'قصر الصلاة في السفر ركعتان كما في المصدر المذكور.');
      ok('«خالد عبدالرحمن»: not one occurrence of the word «العالم»',
        !/العالِم|العالم\b|هذا العالم/.test(singer.text), singer.text.slice(0, 260));
      ok('...and he is not called «الشيخ» either',
        !/الشيخ خالد|الشيخ عبدالرحمن/.test(singer.text), singer.text.slice(0, 260));
      ok('...and NO model call was spent deciding who he is', singer.state.identityCalls === 0);
      ok('...and the reader still gets the ruling he asked about',
        /قصر|ركعتين|ركعتان/.test(singer.text), singer.text.slice(0, 260));
      ok('...and the stream closes exactly once', singer.res.ended === 1);

      const baz = await drive('ما رأي ابن باز في قصر الصلاة؟', BAZ_DRAFT);
      ok('known-scholar green keeps attributed text and owned card byte-for-byte in order',
        baz.text === BAZ_DRAFT + '\n' + bazCard && closedLifecycle(baz.res), baz.text);
      ok('known-scholar green spends no identity probe or cache write',
        baz.state.worldProbeCalls === 0 && baz.state.identityCacheWrites === 0, JSON.stringify(baz.state));

      // ── TEST 2: the invented name, with NO world page ──────────────────────
      const invented = await drive('ما رأي الشيخ فلان الفلاني في قصر الصلاة؟',
        inventedBody, { worldHit: false });
      ok('«فلان الفلاني»: the reply states only the bounded checked-results miss',
        /لم أتحقق من هذا الاسم ضمن النتائج التي فُحصت/.test(invented.text), invented.text.slice(0, 300));
      ok('...and NOT «لم أقف على قولٍ للشيخ»',
        !/لم أقف على قول/.test(invented.text), invented.text.slice(0, 300));
      ok('...and he is granted no title anywhere in it',
        !/العالِم|هذا العالم/.test(invented.text), invented.text.slice(0, 300));
      ok('...and the ruling of the question itself is still served',
        /قصر|ركعتين|ركعتان/.test(invented.text), invented.text.slice(0, 300));
      ok('...and the stream closes exactly once', invented.res.ended === 1);
      const expectedInvented = NP.nameUnknownLine('فلان الفلاني') + '\n\n' + inventedBody + '\n' + fiqhCard;
      ok('unknown-person green keeps body and server card byte-for-byte in order',
        invented.text === expectedInvented && closedLifecycle(invented.res), invented.text);

      // ── TEST 2b: THE DROP-WHOLE EXIT CARRIES THE LINE TOO ──────────────────
      //
      // MEASURED ON THE LIVE SERVICE, and the reason this check exists: when the model's draft
      // credits the man and the screen drops it whole, the reader used to get the bare refusal —
      // correct about not attributing, and silent about the one fact that removes his premise.
      const dropped = await drive('ما رأي الشيخ فلان الفلاني في قصر الصلاة؟',
        'يرى الشيخ فلان الفلاني أنّ قصر الصلاة واجب، وقال في ذلك كلامًا مشهورًا.', { worldHit: false });
      ok('a DROPPED draft still carries the bounded checked-results line',
        /لم أتحقق من هذا الاسم ضمن النتائج التي فُحصت/.test(dropped.text), dropped.text.slice(0, 300));
      ok('...and the credited draft itself never reaches him',
        !/يرى الشيخ فلان|قال في ذلك/.test(dropped.text), dropped.text.slice(0, 300));
      // RE-PINNED ON THE STRONGER CONDITION, ASSERTION KEPT. What this pins is that the «لا أعرف
      // هذا الاسم» line travels with EVERY drop-whole refusal and never gets emitted bare — that
      // is `withPresence`, and it is untouched. What changed underneath is only WHICH refusal
      // withPresence wraps: batch 5 added a second one for a draft whose every ruling rests on no
      // page, and both now come from one decision. Pinning the wrapper rather than the constant
      // is the stronger form of the same invariant, and it holds for the next refusal too.
      ok('...and every drop-whole exit is routed through the line, not just one',
        (read('api/ask.js').match(/emitOnce\(withPresence\(refusalFor\([a-zA-Z]+\)\)\)/g) || []).length === 3
        && !/emitOnce\(NO_ATTRIBUTION_AVAILABLE\)/.test(read('api/ask.js'))
        && !/emitOnce\(NO_VERIFIED_SOURCE_MESSAGE\)/.test(read('api/ask.js')));

      // ── TEST 3: the worldly identity question ──────────────────────────────
      const whoBody = 'محمد صلاح لاعب كرة قدم مصري يلعب مع نادي ليفربول ومنتخب مصر، بحسب المصدر المذكور.';
      const whoCard = `<source site="ar.wikipedia.org" url="${WORLD_URL}">${WORLD_TITLE}</source>`;
      const who = await drive('من هو محمد صلاح؟', whoBody);
      ok('F-003 FOUND control: exact identity body/card and retrieval outcome are preserved',
        who.text === whoBody + '\n' + whoCard
          && who.state.presenceEvents.some((event) => event.outcome === NP.PRESENCE.FOUND
            && event.retrievalOutcome === 'FOUND' && event.searchCompleted === true)
          && closedLifecycle(who.res), who.text);
      ok('...from the WORLD source, not the religious corpus',
        /site="ar\.wikipedia\.org"/.test(who.text), who.text.slice(0, 300));
      ok('...with NO religious ruling appended',
        !/النقطة الشرعية|حكم شرعي|islamqa/.test(who.text), who.text.slice(0, 300));
      ok('...and NO referral tail under a worldly answer',
        !RT.REFERRAL_TAILS.some((t) => who.text.includes(t.slice(0, 30))), who.text.slice(0, 300));
      ok('...and the stream closes exactly once', who.res.ended === 1);

      const farkousUrl = 'https://ar.wikipedia.org/wiki/%D9%81%D8%B1%D9%83%D9%88%D8%B3';
      const farkousTitle = 'فركوس';
      const farkousBody = 'فركوس اسم الشخص المعرّف في الصفحة الموثقة، بحسب المصدر المذكور.';
      const farkousWorld = {
        url: farkousUrl, title: farkousTitle, description: 'فركوس',
        html: '<!doctype html><html><head><title>فركوس</title></head><body><article><h1>فركوس</h1><p>'
          + ('تعرّف هذه الصفحة فركوس تعريفًا مباشرًا وتذكر الاسم نفسه في سياق السيرة الموثقة. ').repeat(8)
          + '</p></article></body></html>',
      };
      const farkousCard = '<source site="ar.wikipedia.org" url="' + farkousUrl + '">'
        + farkousTitle + '</source>';
      const runFarkousIdentity = async (ledgerMode) => {
        process.env.LEDGER_RAG = ledgerMode;
        const result = await drive('من هو فركوس؟', farkousBody, { worldEvidence: farkousWorld });
        ok('F-005 ' + (ledgerMode === 'on' ? 'Ledger-enabled' : 'Legacy')
          + ' E2E: same-name registry trust reaches the exact identity page',
        result.state.worldProbeCalls === 1
          && result.state.presenceEvents.some((event) => event.outcome === NP.PRESENCE.FOUND)
          && result.text === farkousBody + '\n' + farkousCard
          && closedLifecycle(result.res), result.text);
      };
      await runFarkousIdentity('off');
      await runFarkousIdentity('on');
      process.env.LEDGER_RAG = 'off';

      const singleLegacy = await drive('ما رأي الشيخ خالد في قصر الصلاة؟', inventedBody,
        { worldEvidence: singleWorld });
      ok('F-005 Legacy E2E: incidental single-token text cannot borrow identity trust',
        singleLegacy.state.worldProbeCalls > 0
          && singleLegacy.state.presenceEvents.some((event) => event.outcome === NP.PRESENCE.ABSENT)
          && singleLegacy.text === NP.nameUnknownLine('خالد') + '\n\n' + inventedBody + '\n' + fiqhCard
          && closedLifecycle(singleLegacy.res), singleLegacy.text);
    } finally {
      globalThis.fetch = realFetch;
      delete process.env.DAILY_SEARCH_BUDGET;
    }
  }

  // =========================================================================
  console.log('\n=== G. THE ROSTER ===');
  {
    const gates = JSON.parse(read('gates.json'));
    ok('gates.json lists this guard',
      gates.some((g) => g && g.script === 'guards/name-presence-guard.cjs'));
    ok('.gitattributes pins it to LF',
      /guards\/name-presence-guard\.cjs text eol=lf/.test(read('.gitattributes')));
  }

  console.log('\n' + (failures ? 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'
    : 'OK: ' + checks + '/' + checks + ' checks passed.'));
  process.exit(failures ? 1 : 0);
}()).catch((e) => { console.error('GUARD THREW:', e); process.exit(2); });
