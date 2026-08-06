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

(async function main() {
  console.log('=== name-presence-guard — an unknown name is named as unknown ===');

  const NP = await esm('lib/policy/name-presence.js');
  const CG = await esm('lib/policy/consistency-gate.js');
  const RT = await esm('lib/policy/referral-tail.js');
  const PG = await esm('lib/source-page-gates.js');
  const RC = await esm('lib/route-classify.js');
  const DC = await esm('lib/daycap.js');
  const DAY = DC;
  const STORE = await esm('lib/ledger/redis.js');

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
  }

  // =========================================================================
  console.log('\n=== B. A PAGE IS EVIDENCE OF EXISTENCE, AND OF NOTHING ELSE ===');
  {
    ok('every word of the name must be on the page',
      NP.pageBearsName('محمد صلاح', { title: 'محمد صلاح', passage: 'لاعب كرة قدم مصري' }) === true);
    ok('one common word is not the name — «العليّ الحكيم» is not طارق العلي',
      NP.pageBearsName('طارق العلي', { title: 'خطبة', passage: 'العليّ الحكيم سبحانه' }) === false);
    ok('an empty page bears nothing', NP.pageBearsName('محمد صلاح', { title: '', passage: '' }) === false);

    const src = read('lib/policy/name-presence.js');
    ok('the module makes NO model call and NO network call of its own',
      !/fetch\(|anthropic|retrieve\(/i.test(src));
    ok('...and imports nothing that could make one',
      /^import \{ normalizeArabic, stripFormulas \} from '\.\.\/route-classify\.js';$/m.test(src));

    const ask = read('api/ask.js');
    ok('the probe is bounded to ONE wave and a handful of candidates',
      /retrieveWorld\(nameShape\.name, \{ maxWaves: 1, maxResults: 3 \}\)/.test(ask));
    ok('...and searches the WORLD list only — never a religious one',
      /retrieveWorld\(nameShape\.name/.test(ask) && !/retrieve\(nameShape\.name/.test(ask));
    ok('a search that never ran may not become an absence: no key ⇒ no probe, no line',
      /nameShape\.probe && process\.env\.BRAVE_API_KEY/.test(ask));
    ok('a THROWN probe is not an absence either',
      /ran = false;[\s\S]{0,200}if \(ran\) \{/.test(ask));
    ok('the world page is kept OUT of the religious evidence pool (not remembered)',
      /const w = await retrieveWorld\(nameShape\.name/.test(ask));
    ok('the identity answer carries NO referral tail — it is not a religious answer',
      /iDraft \+ '\\n' \+ idCards\.map\(\(c\) => c\.tag\)\.join\('\\n'\)/.test(ask));
  }

  // =========================================================================
  console.log('\n=== C. NOT ONE SENTENCE GRANTS A TITLE ===');
  {
    const unknown = NP.nameUnknownLine('فلان الفلاني');
    const known = NP.notAFatwaSourceLine('طارق العلي');
    ok('the unknown-name line says so in those words', /لا أعرف هذا الاسم/.test(unknown));
    ok('...and calls him nothing at all',
      !/الشيخ|العالِم|العالم|الداعية|طالب علم/.test(unknown), unknown);
    ok('...and claims no search of a corpus that does not exist',
      !/لم أقف|لم أجد|لم أعثر/.test(unknown), unknown);
    ok('the found-name line places him outside the fatwa sources without ranking him',
      /ليس ممّن تُؤخَذ عنه الفتوى/.test(known) && !/الشيخ|العالِم|العالم/.test(known), known);
    ok('the shared refusal no longer says «هذا العالِم»',
      !/هذا العالِم|هذا العالم/.test(CG.NO_ATTRIBUTION_AVAILABLE), CG.NO_ATTRIBUTION_AVAILABLE);
    ok('...and still refuses the attribution, naming nobody',
      /لا أنسبُ قولًا في هذه المسألة إلى أحدٍ/.test(CG.NO_ATTRIBUTION_AVAILABLE));
    ok('the ABOUT_ENTITY refusal grants no title either',
      /لا أنسب إلى أحدٍ قولًا لم أقف عليه في نصٍّ له/.test(read('api/ask.js'))
      && !/لا أنسب إلى العالِم قولًا/.test(read('api/ask.js')));
  }

  // =========================================================================
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
    const tail = RT.referralTail('ما حكم بيع الذهب بالتقسيط؟', 'sharia_ruling', 5);
    ok('a ruling question still earns a tail', !!tail);
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
    ok('isReligiousText() is wired into effectiveRoute, as world-intent.js uses it',
      /const effectiveRoute = \([\s\S]{0,200}?isReligiousText\(lastUserText\(body\.messages\)\)\)/.test(ask));
    ok('...and it is imported from the same module the router uses',
      /import \{ classifyRoute, createSourceFilter, isReligiousText \} from '\.\.\/lib\/route-classify\.js';/.test(ask));
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

    const makeRes = () => ({
      writes: [], ended: 0,
      status() { return this; }, setHeader() { return this; }, flushHeaders() {},
      write(s) { this.writes.push(String(s)); return true; }, end() { this.ended += 1; return this; },
      json(o) { this.jsonBody = o; this.ended += 1; return this; },
    });
    const founder = DC.founderTokenFor(DEVICE);
    const makeReq = (text) => ({
      method: 'POST',
      headers: { 'x-murabbi-device': DEVICE, 'x-murabbi-founder': founder, 'x-ezik-ai-consent': '2026-08-06-1' },
      body: { system: 'أنت عزك', band: 'adult', messages: [{ role: 'user', content: text }] },
    });
    const readerText = (res) => res.writes.join('')
      .split('data: ').filter(Boolean)
      .map((s) => { try { return JSON.parse(s.trim()); } catch { return null; } })
      .filter((p) => p && p.type === 'content_block_delta')
      .map((p) => p.delta.text).join('');

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

    const drive = async (question, draft, { worldHit = true } = {}) => {
      const state = { braveQueries: [], round: 0, identityCalls: 0 };
      globalThis.fetch = async (url, init) => {
        const u = String(url);
        if (u.includes('api.anthropic.com')) {
          const b = JSON.parse(init.body);
          const last = b.messages[b.messages.length - 1];
          const txt = typeof last.content === 'string' ? last.content : '';
          if (/هُويّة|هوية|non_scholar|هل هذا الاسم عالم|is this name a scholar/i.test(txt)) state.identityCalls += 1;
          if (/GEN|DEEN/.test(txt) && txt.length < 400) {
            return jsonRes({ content: [{ type: 'text', text: 'DEEN' }], stop_reason: 'end_turn' });
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
              'data: ' + JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: draft } }) + '\n\n',
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
            return jsonRes({ web: { results: worldHit ? [{ title: WORLD_TITLE, url: WORLD_URL, description: 'لاعب' }] : [] } });
          }
          return jsonRes({ web: { results: [{ title: FIQH_TITLE, url: FIQH_URL, description: 'قصر' }] } });
        }
        if (u.startsWith(WORLD_URL)) return htmlRes(u, WORLD_HTML);
        if (u.startsWith(FIQH_URL)) return htmlRes(u, FIQH_HTML);
        return { ok: false, status: 404, url: u, headers: { get: () => 'text/html' }, text: async () => '' };
      };
      const res = makeRes();
      await (await esm('api/ask.js')).default(makeReq(question), res);
      return { text: readerText(res), res, state };
    };

    try {
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

      // ── TEST 2: the invented name, with NO world page ──────────────────────
      const invented = await drive('ما رأي الشيخ فلان الفلاني في قصر الصلاة؟',
        'قصر الصلاة في السفر ركعتان كما في المصدر المذكور.', { worldHit: false });
      ok('«فلان الفلاني»: the reply says «لا أعرف هذا الاسم»',
        /لا أعرف هذا الاسم/.test(invented.text), invented.text.slice(0, 300));
      ok('...and NOT «لم أقف على قولٍ للشيخ»',
        !/لم أقف على قول/.test(invented.text), invented.text.slice(0, 300));
      ok('...and he is granted no title anywhere in it',
        !/العالِم|هذا العالم/.test(invented.text), invented.text.slice(0, 300));
      ok('...and the ruling of the question itself is still served',
        /قصر|ركعتين|ركعتان/.test(invented.text), invented.text.slice(0, 300));
      ok('...and the stream closes exactly once', invented.res.ended === 1);

      // ── TEST 2b: THE DROP-WHOLE EXIT CARRIES THE LINE TOO ──────────────────
      //
      // MEASURED ON THE LIVE SERVICE, and the reason this check exists: when the model's draft
      // credits the man and the screen drops it whole, the reader used to get the bare refusal —
      // correct about not attributing, and silent about the one fact that removes his premise.
      const dropped = await drive('ما رأي فلان الفلاني في قصر الصلاة؟',
        'يرى الشيخ فلان الفلاني أنّ قصر الصلاة واجب، وقال في ذلك كلامًا مشهورًا.', { worldHit: false });
      ok('a DROPPED draft still tells the reader the name is unknown',
        /لا أعرف هذا الاسم/.test(dropped.text), dropped.text.slice(0, 300));
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
      const who = await drive('من هو محمد صلاح؟',
        'محمد صلاح لاعب كرة قدم مصري يلعب مع نادي ليفربول ومنتخب مصر، بحسب المصدر المذكور.');
      ok('«من هو محمد صلاح؟»: answered, with a card',
        /<source\b/.test(who.text) && /صلاح/.test(who.text), who.text.slice(0, 300));
      ok('...from the WORLD source, not the religious corpus',
        /site="ar\.wikipedia\.org"/.test(who.text), who.text.slice(0, 300));
      ok('...with NO religious ruling appended',
        !/النقطة الشرعية|حكم شرعي|islamqa/.test(who.text), who.text.slice(0, 300));
      ok('...and NO referral tail under a worldly answer',
        !RT.REFERRAL_TAILS.some((t) => who.text.includes(t.slice(0, 30))), who.text.slice(0, 300));
      ok('...and the stream closes exactly once', who.res.ended === 1);
    } finally {
      globalThis.fetch = realFetch;
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
