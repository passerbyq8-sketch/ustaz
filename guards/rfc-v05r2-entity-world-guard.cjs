// guards/rfc-v05r2-entity-world-guard.cjs — a singer is not a mufti.
//
// THE MEASURED FAILURE. «ما رأي خالد عبدالرحمن في قصر الصلاة؟» — the lexical classifier sees the
// shape «ما رأي فلان في كذا», calls it a request for a scholar's position, finds no registry entry,
// and asks the reader for the shaykh's official website. The app went looking for a fatwa by a
// musician and then apologised for not finding one.
//
// WHY A REGISTRY CANNOT FIX IT. The registries answer "is this one of OURS". They cannot answer "is
// this a scholar at all", because the people who are not scholars are everybody else. So the model's
// open world knowledge is asked — but ONLY about the identity of a name, ONLY after the
// deterministic plan has run and run out, and ONLY in a direction that narrows: `non_scholar`
// removes an attribution path and nothing here can add one.
//
// WHAT MUST NOT BREAK. A registered scholar never reaches this path at all. «ابن باز» resolves,
// «ابن تيمية» is on the historical roster, and neither pays for the extra call nor risks its answer.
// That is asserted below by driving the real handler and counting the calls.
//
// Usage: node guards/rfc-v05r2-entity-world-guard.cjs
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

const DEVICE = 'abcdefgh12345678';
const Q_SINGER = 'ما رأي خالد عبدالرحمن في قصر الصلاة؟';
const Q_SINGER_TITLED = 'ما رأي الشيخ خالد عبدالرحمن في قصر الصلاة؟';
const Q_BAZ = 'ما رأي ابن باز في قصر الصلاة؟';
const Q_TAYMIYYAH = 'ما رأي ابن تيمية في قصر الصلاة؟';

// What a correct reply looks like: his real identity said kindly, then the ruling from the source.
const GOOD_DRAFT = 'خالد عبدالرحمن فنّانٌ معروف وليس من أهل الإفتاء، فلا تُؤخذ عنه أحكام الشرع. '
  + 'أمّا قصر الصلاة فقد ذكر موقع الإسلام سؤال وجواب أنّ المسافر يقصر الرباعية إلى ركعتين، '
  + 'وأنّ القصر سنّة مؤكّدة عند عامّة أهل العلم.';

(async function main() {
  console.log('=== rfc-v05r2-entity-world-guard — a singer is not a mufti ===');

  const EK = await esm('lib/policy/entity-knowledge.js');
  const AP = await esm('lib/ask-plan.js');
  const DC = await esm('lib/daycap.js');
  const STORE = await esm('lib/ledger/redis.js');

  const plan = (q, on = false, world) =>
    AP.planAsk([{ role: 'user', content: q }], { policyEnabled: on, entityWorldType: world });

  // =========================================================================
  console.log('\n=== A. WHO IS EVEN ASKED ABOUT — the registries go first ===');
  {
    // The defect exists on BOTH sides of the rollout flag, so both are asserted.
    eq('the singer needs a world check on the public path',
      EK.nameNeedingWorldCheck(plan(Q_SINGER, false)), 'خالد عبدالرحمن');
    eq('...and with an honorific, on the internal path too',
      EK.nameNeedingWorldCheck(plan(Q_SINGER_TITLED, true)), 'خالد عبدالرحمن');
    eq('a REGISTERED contemporary is never asked about', EK.nameNeedingWorldCheck(plan(Q_BAZ, true)), '');
    eq('a REGISTERED historical figure is never asked about',
      EK.nameNeedingWorldCheck(plan(Q_TAYMIYYAH, true)), '');
    eq('a question naming nobody is never asked about',
      EK.nameNeedingWorldCheck(plan('ما حكم قصر الصلاة؟', true)), '');
    eq('...and neither is a madhhab', EK.nameNeedingWorldCheck(plan('ما حكم قصر الصلاة عند الحنابلة؟', true)), '');
  }

  // =========================================================================
  console.log('\n=== B. THE VERDICT IS FAIL-SAFE — doubt is «unknown» ===');
  {
    const act = (raw) => EK.isActionableNonScholar(EK.parseWorldVerdict(raw));
    ok('a confident non_scholar WITH an identity is actionable',
      act('{"type":"non_scholar","identity_ar":"مغنٍّ سعودي","confidence":"high"}'));
    for (const [label, raw] of [
      ['no identity', '{"type":"non_scholar","identity_ar":"","confidence":"high"}'],
      ['low confidence', '{"type":"non_scholar","identity_ar":"مغنٍّ","confidence":"low"}'],
      ['a scholar', '{"type":"scholar","identity_ar":"فقيه","confidence":"high"}'],
      ['explicit unknown', '{"type":"unknown","identity_ar":"","confidence":"low"}'],
      ['an invented type', '{"type":"probably_a_singer","identity_ar":"x","confidence":"high"}'],
      ['malformed json', '{type: non_scholar'],
      ['prose', 'أظنّه مغنٍّ لكنّي لست متأكّدًا'],
      ['empty', ''],
    ]) ok('...but ' + label + ' is NOT actionable', !act(raw));
    eq('an unparseable verdict reads as unknown', EK.parseWorldVerdict('???').type, 'unknown');
    // The prompt must offer the escape hatch, or the classifier invents an answer instead.
    ok('the prompt names «unknown» and forbids guessing',
      /unknown/.test(EK.worldCheckPrompt('س')) && /لا يجوز التخمين/.test(EK.worldCheckPrompt('س')));
    ok('...and it asks about a NAME, never about the ruling',
      /ولا شأنَ لك بالسؤالِ الشرعيِّ ولا بالحكم/.test(EK.worldCheckPrompt('س')));
  }

  // =========================================================================
  console.log('\n=== C. THE PLANNER VETO ONLY NARROWS ===');
  {
    eq('non_scholar removes the attribution mode', plan(Q_SINGER, false, 'non_scholar').attributionMode, 'none');
    eq('...and with it the identity template', plan(Q_SINGER, false, 'non_scholar').needsScholarIdentity, false);
    eq('...and the field is reported', plan(Q_SINGER, false, 'non_scholar').entityWorldKnowledgeType, 'non_scholar');
    eq('unknown changes nothing at all', plan(Q_SINGER, false, 'unknown').attributionMode, 'namedScholarOpinion');
    eq('...and is the default', plan(Q_SINGER, false).entityWorldKnowledgeType, 'unknown');
    eq('scholar changes nothing either', plan(Q_SINGER, false, 'scholar').attributionMode, 'namedScholarOpinion');
    // It may never CREATE an attribution where the deterministic side found none.
    eq('a plain ruling question stays plain under every verdict',
      ['unknown', 'scholar', 'non_scholar'].map((w) => plan('ما حكم قصر الصلاة؟', true, w).attributionMode).join(','),
      'none,none,none');
    eq('...and a registered scholar is untouched by a non_scholar verdict',
      plan(Q_BAZ, true, 'non_scholar').claimRelation, plan(Q_BAZ, true).claimRelation);
  }

  // =========================================================================
  console.log('\n=== D. THE QUERY REACHES THE PROVIDER WITHOUT HIS NAME ===');
  {
    eq('the frame and the name both go',
      EK.stripEntityFromQuery('ما رأي خالد عبدالرحمن في قصر الصلاة', 'خالد عبدالرحمن'), 'قصر الصلاة');
    eq('...including an honorific and a trailing qualifier',
      EK.stripEntityFromQuery('رأي الشيخ خالد عبدالرحمن قصر الصلاة للمسافر', 'خالد عبدالرحمن'),
      'قصر الصلاة للمسافر');
    eq('a query that never named him is untouched',
      EK.stripEntityFromQuery('حكم قصر الصلاة في السفر', 'خالد عبدالرحمن'), 'حكم قصر الصلاة في السفر');
    ok('the topic survives — stripping must not empty the query',
      EK.stripEntityFromQuery('ما رأي خالد عبدالرحمن في قصر الصلاة', 'خالد عبدالرحمن').length > 4);
  }

  // =========================================================================
  console.log('\n=== E. THE HANDLER IS WIRED THE RIGHT WAY ROUND ===');
  {
    const s = read('api/ask.js');
    const body = s.slice(s.indexOf('export default async function handler'));
    ok('the plan is still computed before the world check',
      body.indexOf('const plan = planAsk(') < body.indexOf('nameNeedingWorldCheck('),
      'the model may not be consulted before the question is classified');
    ok('the world check reads the PLAN, never the raw question',
      /if \(nameNeedingWorldCheck\(plan\)\)/.test(s),
      're-deriving the mode from the text gave a different answer from the one the handler acts on');
    ok('a non-scholar suppresses the identity template',
      /if \(plan\.needsScholarIdentity\) \{[\s\S]{0,400}?if \(!nonScholar\) \{/.test(s),
      'the sterile «which shaykh do you mean» must not be reached once we know he is not one');
    ok('...and the whole attributed hunt',
      /const attributionActive = \(plan\.attributionMode === 'namedScholarOpinion'\) && !nonScholar/.test(s));
    ok('...and the query is stripped deterministically, not by asking the model nicely',
      /const q = nonScholar \? stripEntityFromQuery\(rawQ, nonScholar\.name\) : rawQ/.test(s));
    ok('the drafting note is pushed for the reader',
      /toolResults\.push\(\{ type: 'text', text: nonScholarDraftingNote\(/.test(s));
    ok('the note forbids ruling on the man himself',
      /لا تحكمْ عليه هو بشيء/.test(read('lib/policy/entity-knowledge.js')));
    ok('...and forbids attributing any position to him',
      /لا تنسبْ إليه رأيًا ولا قولًا ولا موقفًا/.test(read('lib/policy/entity-knowledge.js')));
    ok('a world-check failure leaves the shipped path',
      /catch \(e\) \{[\s\S]{0,200}\[world\] check failed/.test(s));
  }

  // =========================================================================
  console.log('\n=== F. LIVE DRIVES THROUGH THE REAL HANDLER ===');
  {
    process.env.FOUNDER_SECRET = 'test-secret-for-the-world-gate';
    process.env.LEDGER_RAG = 'on';
    process.env.RFC_V05_LEGACY_POLICY = 'on';
    process.env.RFC_V05_MODE = 'internal';
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.BRAVE_API_KEY = 'test-brave';
    delete process.env.DAILY_SEARCH_BUDGET;
    STORE.__setRedisForTest(null);

    const PAGE_URL = 'https://islamqa.info/ar/answers/38209/';
    const PAGE_TITLE = 'صفة قصر الصلاة في السفر';
    const PAGE_HTML = `<!doctype html><html><head><title>${PAGE_TITLE}</title></head><body><article>
<h1>${PAGE_TITLE}</h1>
<p>الحمد لله. قصر الصلاة في السفر من رخص الشريعة التي وسع الله بها على عباده، وقد ثبت ذلك بالكتاب والسنة
وإجماع أهل العلم. فالمسافر يقصر الصلاة الرباعية فيصليها ركعتين، وهي الظهر والعصر والعشاء، أما المغرب فلا تقصر
لأنها وتر النهار، وأما الفجر فركعتان في الأصل فلا قصر فيها.</p>
<p>وذهب جمهور أهل العلم إلى أن القصر سنة مؤكدة في حق المسافر، وذهب بعضهم إلى أنه واجب، والأمر في ذلك واسع.
ويبدأ القصر إذا فارق المسافر عامر قريته وخرج عن بنيان بلده، ويستمر ما دام مسافرا على الصحيح من أقوال أهل العلم،
فإذا رجع إلى بلده أتم الصلاة.</p>
<p>وإذا صلى المسافر خلف إمام مقيم لزمه الإتمام تبعا لإمامه، وهذا قول عامة أهل العلم، لحديث ابن عباس رضي الله عنهما
لما سئل عن ذلك فقال: تلك السنة. والله أعلم.</p></article></body></html>`;

    const makeRes = () => ({
      writes: [], ended: 0,
      status() { return this; }, setHeader() { return this; }, flushHeaders() {},
      write(s) { this.writes.push(String(s)); return true; }, end() { this.ended += 1; return this; },
      json(o) { this.jsonBody = o; this.ended += 1; return this; },
    });
    const founder = DC.founderTokenFor(DEVICE);
    const makeReq = (text) => ({
      method: 'POST',
      headers: { 'x-murabbi-device': DEVICE, 'x-murabbi-founder': founder },
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

    // `worldReply` is what the identity classifier returns; `draft` is the final answer.
    const drive = async (question, worldReply, draft) => {
      const state = { worldCalls: 0, braveQueries: [], round: 0 };
      globalThis.fetch = async (url, init) => {
        const u = String(url);
        if (u.includes('api.anthropic.com')) {
          const b = JSON.parse(init.body);
          const last = b.messages[b.messages.length - 1];
          const txt = typeof last.content === 'string' ? last.content : '';
          if (txt.includes('مهمّتك تحديدُ هُويّةِ اسمٍ واحدٍ')) {
            state.worldCalls += 1;
            return jsonRes({ content: [{ type: 'text', text: worldReply }], stop_reason: 'end_turn' });
          }
          if (/GEN|DEEN/.test(txt) && txt.length < 400) {
            return jsonRes({ content: [{ type: 'text', text: 'DEEN' }], stop_reason: 'end_turn' });
          }
          state.round += 1;
          if (state.round === 1) {
            return jsonRes({
              content: [{ type: 'tool_use', id: 'tu1', name: 'search_sources', input: { query: question } }],
              stop_reason: 'tool_use',
            });
          }
          // Round 2 STREAMS. A stub that answers it with a JSON body leaves the relay nothing to
          // read and the reader sees an empty reply — which is a defect in the test, not the code.
          if (b.stream) {
            const frames = [
              'event: content_block_delta\ndata: ' + JSON.stringify({
                type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: draft },
              }) + '\n\n',
              'event: message_stop\ndata: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n',
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
                  releaseLock() {},
                  cancel: async () => {},
                }),
              },
            };
          }
          return jsonRes({ content: [{ type: 'text', text: draft }], stop_reason: 'end_turn' });
        }
        if (u.includes('api.search.brave.com')) {
          const q = decodeURIComponent((u.split('q=')[1] || '').split('&')[0]).replace(/\+/g, ' ');
          state.braveQueries.push(q);
          return jsonRes({ web: { results: [{ title: PAGE_TITLE, url: PAGE_URL, description: 'قصر الصلاة' }] } });
        }
        if (u.startsWith(PAGE_URL)) {
          return {
            ok: true, status: 200, url: u,
            headers: {
              get: (h) => {
                const k = String(h).toLowerCase();
                if (k === 'content-type') return 'text/html; charset=utf-8';
                if (k === 'content-length') return String(Buffer.byteLength(PAGE_HTML, 'utf8'));
                return null;
              },
            },
            text: async () => PAGE_HTML,
            arrayBuffer: async () => Buffer.from(PAGE_HTML, 'utf8'),
          };
        }
        return { ok: false, status: 404, url: u, headers: { get: () => 'text/html' }, text: async () => '' };
      };
      const res = makeRes();
      await (await esm('api/ask.js')).default(makeReq(question), res);
      return { text: readerText(res), res, state };
    };

    try {
      // ── THE FIXTURE: the reported question ─────────────────────────────────
      const singer = await drive(Q_SINGER,
        '{"type":"non_scholar","identity_ar":"فنّانٌ سعوديّ","confidence":"high"}', GOOD_DRAFT);
      eq('the identity classifier was consulted exactly once', singer.state.worldCalls, 1);
      ok('NO «لم أتبيّن أي شيخ» template reaches the reader',
        !/لم أتبيّنْ أيَّ شيخٍ تقصد/.test(singer.text), singer.text.slice(0, 200));
      ok('NO «لم أقف على نصٍّ» apology either',
        !/لم أقف على نصٍّ/.test(singer.text), singer.text.slice(0, 200));
      ok('the search that ran carried NO singer\'s name',
        singer.state.braveQueries.length > 0
        && singer.state.braveQueries.every((q) => !/خالد|عبدالرحمن/.test(q)),
        JSON.stringify(singer.state.braveQueries));
      ok('...and it still carried the actual fiqh topic',
        singer.state.braveQueries.some((q) => /قصر|الصلاة/.test(q)),
        JSON.stringify(singer.state.braveQueries));
      ok('the reader is told who the man really is',
        /فنّان/.test(singer.text), singer.text.slice(0, 200));
      ok('...and gets the ruling he actually asked about',
        /قصر|ركعتين/.test(singer.text), singer.text.slice(0, 200));
      eq('the stream closes exactly once', singer.res.ended, 1);

      // ── A REGISTERED SCHOLAR IS NOT TOUCHED ────────────────────────────────
      for (const [label, q] of [['ابن باز', Q_BAZ], ['ابن تيمية', Q_TAYMIYYAH]]) {
        const sch = await drive(q, '{"type":"non_scholar","identity_ar":"x","confidence":"high"}',
          'ذكر موقع الإسلام سؤال وجواب أنّ المسافر يقصر الرباعية ركعتين.');
        eq(label + ': the identity classifier is never called', sch.state.worldCalls, 0);
        eq(label + ': the stream closes exactly once', sch.res.ended, 1);
      }

      // ── FAIL-SAFE: a useless verdict leaves the shipped behaviour ───────────
      // Asserted on what the HANDLER did, not on the reply — the reply is a scripted draft, so its
      // wording proves nothing. Stripping the query happens only when a non-scholar was
      // established, so a query that still carries the name is proof the verdict was ignored.
      const unsure = await drive(Q_SINGER, 'لست متأكدًا من هذا الاسم', GOOD_DRAFT);
      eq('an unusable verdict still costs exactly one call', unsure.state.worldCalls, 1);
      ok('...and nothing was concluded from it: the query keeps the name',
        unsure.state.braveQueries.some((q) => /خالد|عبدالرحمن/.test(q)),
        JSON.stringify(unsure.state.braveQueries));
      eq('...and the stream closes exactly once', unsure.res.ended, 1);

      // ── THE PUBLIC PATH ────────────────────────────────────────────────────
      // NOT DRIVEN LIVE, and the reason is the harness rather than the code: an anonymous request
      // with no reachable store is stopped by the day cap, which fails CLOSED for anyone without a
      // founder credential. A founder request bypasses it, which is why every drive above works.
      // The property that matters on the public path — the sterile template appears under an
      // unusable verdict and disappears under a confident one — is asserted deterministically in
      // section C against planAsk itself, where no store is involved.

    } finally {
      globalThis.fetch = realFetch;
      STORE.__resetRedis();
      for (const k of ['RFC_V05_MODE', 'LEDGER_RAG', 'RFC_V05_LEGACY_POLICY', 'ANTHROPIC_API_KEY',
        'BRAVE_API_KEY', 'FOUNDER_SECRET']) delete process.env[k];
    }
  }

  console.log('\n' + (failures ? 'FAIL ' : 'PASS ') + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
