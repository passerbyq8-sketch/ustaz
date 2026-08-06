// guards/rfc-v05r2-entity-world-guard.cjs — NOBODY'S IDENTITY IS DECIDED BY A MODEL CALL.
//
// ── WHAT THIS GATE USED TO PIN, AND WHY IT DOES NOT ANY MORE ─────────────────
//
// It pinned a feature: «المغنّي ليس مفتيًا». One model call asked open world knowledge «is this
// name a scholar?», and a confident `non_scholar` removed the attribution path, re-typed «من هو
// …؟» as an ordinary question, and let the reply tell the reader who the man really was.
//
// THE ROOT DEFECT THAT REMOVED IT. The check was ONE model call, with no source, no ledger and no
// check after it — and only the «not a scholar» branch was ever hardened. When it said, wrongly,
// «yes, he is a scholar», NOTHING doubted it. Measured on the live service:
//
//   «ما رأي طارق العلي في أحكام العدة؟»  ->  «داعية وخطيب كويتي معروف من أهل العلم … يتبنّى
//   المذهب الحنفي», four positions credited to «رأيه», over an alukah.net khutbah page that does
//   not contain his name. He is a Kuwaiti comic actor.
//
// A yes/no oracle that is only checked on one of its two answers is not a safety mechanism.
//
// ── WHAT REPLACED IT ────────────────────────────────────────────────────────
// The registry alone decides searchability, and lib/policy/source-attribution.js decides who may
// be NAMED — from the pages in hand, deterministically, with no model call anywhere in it. The
// singer is no longer protected by a special case that knew he was a singer; he is protected by
// the general rule that no page licenses naming him, which also protects the man the oracle would
// have got wrong in the other direction.
//
// So this gate now asserts the ABSENCE and the replacement, and its own old assertions about the
// reader's experience are re-pinned on the stronger condition: nothing at all is said about him.
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

// The ruling, and not one word about the man. This is what a reply may now look like.
const GOOD_DRAFT = 'ذكر موقع الإسلام سؤال وجواب أنّ المسافر يقصر الرباعية إلى ركعتين، '
  + 'وأنّ القصر سنّة مؤكّدة عند عامّة أهل العلم.';

(async function main() {
  console.log('=== rfc-v05r2-entity-world-guard — nobody\'s identity is decided by a model call ===');

  const EK = await esm('lib/policy/entity-knowledge.js');
  const AP = await esm('lib/ask-plan.js');
  const CG = await esm('lib/policy/consistency-gate.js');
  const DC = await esm('lib/daycap.js');
  const STORE = await esm('lib/ledger/redis.js');

  const plan = (q, on = false) => AP.planAsk([{ role: 'user', content: q }], { policyEnabled: on });

  // =========================================================================
  console.log('\n=== A. THE CHECK IS GONE, AS CODE ===');
  {
    const ek = read('lib/policy/entity-knowledge.js');
    const ask = read('api/ask.js');
    for (const sym of ['nameNeedingWorldCheck', 'worldCheckPrompt', 'parseWorldVerdict',
      'isActionableNonScholar', 'nonScholarDraftingNote', 'identityQuestionSubject']) {
      ok('`' + sym + '` exists nowhere in the policy module', !ek.includes(sym));
      ok('...nor in the handler', !ask.includes(sym));
      ok('...nor is it exported', typeof EK[sym] === 'undefined');
    }
    ok('the handler carries no `nonScholar` state at all', !/\bnonScholar\b/.test(ask));
    ok('...and no world-check prompt text survives anywhere',
      !/مهمّتك تحديدُ هُويّةِ اسمٍ واحدٍ/.test(ek + ask));
  }

  // =========================================================================
  console.log('\n=== B. NO MODEL CALL ANYWHERE ASKS WHO A PERSON IS ===');
  {
    // Read the whole server surface, not just the two files edited. A prompt that asks a model to
    // identify a human being is the thing being forbidden, wherever it is written.
    const files = [];
    const walk = (dir) => {
      for (const f of fs.readdirSync(path.join(REPO, dir), { withFileTypes: true })) {
        if (f.isDirectory()) walk(dir + '/' + f.name);
        else if (f.name.endsWith('.js')) files.push(dir + '/' + f.name);
      }
    };
    walk('api'); walk('lib');
    // CHECKED AGAINST CODE WITH COMMENTS REMOVED. The comments record WHY the check was deleted
    // and quote the measured failure — that is the evidence, and it must survive. What may not
    // survive is the vocabulary in anything that runs.
    const code = (rel) => read(rel)
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .split('\n').map((l) => l.replace(/(^|[^:])\/\/[^\r\n]*/, '$1')).join('\n');
    const IDENTITY_ASK = /(?:هُويّةِ?|هوية|هُويّته|هويته)\s*(?:اسمٍ|الاسم|شخص|الشخص)|"?type"?\s*:\s*"?scholar\|non_scholar/;
    eq('no module builds a prompt asking a model to identify a person',
      files.filter((f) => IDENTITY_ASK.test(code(f))), []);
    eq('...and `non_scholar` is not a vocabulary any running line uses',
      files.filter((f) => /non_scholar/.test(code(f))), []);
  }

  // =========================================================================
  console.log('\n=== C. THE REGISTRY ALONE DECIDES, AND IT STILL STRIPS THE QUERY ===');
  {
    // THE SURVIVING HALF. An unregistered name is stripped out of the search query — because the
    // sources hold the ruling and nobody has published what an unregistered name thinks of it —
    // and the test for "unregistered" is now the registry and the roster, nothing else.
    eq('an unregistered name is reported for stripping, on the public path',
      EK.unregisteredNameInQuestion(plan(Q_SINGER, false)), 'خالد عبدالرحمن');
    eq('...and with an honorific, on the internal path too',
      EK.unregisteredNameInQuestion(plan(Q_SINGER_TITLED, true)), 'خالد عبدالرحمن');
    eq('a REGISTERED contemporary is never stripped',
      EK.unregisteredNameInQuestion(plan(Q_BAZ, true)), '');
    eq('a REGISTERED historical figure is never stripped',
      EK.unregisteredNameInQuestion(plan(Q_TAYMIYYAH, true)), '');
    eq('a question naming nobody has nothing to strip',
      EK.unregisteredNameInQuestion(plan('ما حكم قصر الصلاة؟', true)), '');
    eq('...and neither does a madhhab',
      EK.unregisteredNameInQuestion(plan('ما حكم قصر الصلاة عند الحنابلة؟', true)), '');
    ok('the decision costs no model call and no network',
      !/fetch\(|ANTHROPIC/.test(read('lib/policy/entity-knowledge.js')));

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
  console.log('\n=== D. WHAT PROTECTS HIM NOW — the attribution rule, not the oracle ===');
  {
    // THE SAFETY DID NOT DISAPPEAR, IT MOVED. The oracle protected him by knowing he was a singer.
    // The rule protects him by knowing no page names him — which is true of a singer, and equally
    // true of the scholar the oracle would have misjudged in the other direction.
    const screened = CG.screenDraft(
      'خالد عبدالرحمن فنّان سعودي معروف وليس من أهل العلم، ويرى خالد عبدالرحمن جواز القصر.', {
        entity: 'خالد عبدالرحمن',
        notDirectlyVerified: true, searchProven: true, sourceLicence: [],
      });
    ok('a reply that describes him at all is refused', screened.dropWhole, JSON.stringify(screened));
    ok('...for an attribution no page licenses',
      screened.problems.includes(CG.PROBLEM.ATTRIBUTION_NOT_LICENSED), JSON.stringify(screened.problems));
    // AND IN THE DIRECTION THE ORACLE COULD NOT SEE. The measured failure was a wrong «yes, he is a
    // scholar», which the old design left entirely unchecked.
    const tariq = CG.screenDraft('طارق العلي داعية وخطيب كويتي معروف من أهل العلم.', {
      entity: 'طارق العلي', notDirectlyVerified: true, searchProven: true, sourceLicence: [],
    });
    ok('the wrong answer in the OTHER direction is refused too', tariq.dropWhole, JSON.stringify(tariq));
  }

  // =========================================================================
  console.log('\n=== E. THE PLANNER NO LONGER TAKES A WORLD VERDICT ===');
  {
    ok('planAsk reports no world verdict and reads no option for one',
      typeof AP.planAsk([{ role: 'user', content: Q_SINGER }], {}).entityWorldKnowledgeType === 'undefined');
    // `Function.length` counts parameters before the first defaulted one, so `(text, ir = null)`
    // reports 1. A third parameter would have to be added after `ir` and could not change that,
    // which is why the source is checked too.
    ok('...and classifyTopic no longer takes one either',
      !/function classifyTopic\([^)]*opts/.test(read('lib/policy/core.js')));
    ok('...and the handler passes none to the topic classifier',
      !/classifyTopic\([^)]*entityWorldType/.test(read('api/ask.js')));
    eq('a plain ruling question attributes nothing',
      plan('ما حكم قصر الصلاة؟', true).attributionMode, 'none');
    eq('a registered scholar is still recognised as an authority',
      plan(Q_BAZ, true).claimRelation, 'BY_ENTITY');
  }

  // =========================================================================
  console.log('\n=== F. LIVE DRIVES THROUGH THE REAL HANDLER ===');
  {
    process.env.FOUNDER_SECRET = 'test-secret-for-the-world-gate';
    process.env.RFC_V05_LEGACY_POLICY = 'on';
    process.env.RFC_V05_MODE = 'internal';
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.BRAVE_API_KEY = 'test-brave';
    // The legacy path, switched off the ledger by its documented floor. See the same note in
    // guards/rfc-v05r2-consistency-guard.cjs.
    process.env.LEDGER_RAG = 'off';
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
      headers: { 'x-murabbi-device': DEVICE, 'x-murabbi-founder': founder, 'x-ezik-ai-consent': '2026-08-06-1' }, /* consented client (lib/ai-consent.js); the refusal is proved in tools/ai-consent-probe.cjs */
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

    const drive = async (question, draft) => {
      const state = { identityCalls: 0, braveQueries: [], round: 0, prompts: [] };
      globalThis.fetch = async (url, init) => {
        const u = String(url);
        if (u.includes('api.anthropic.com')) {
          const b = JSON.parse(init.body);
          const last = b.messages[b.messages.length - 1];
          const txt = typeof last.content === 'string' ? last.content : '';
          state.prompts.push(txt);
          // ANY call that asks who a person is, by any wording, is counted and fails the gate.
          if (/هُويّة|هوية|non_scholar|من هو هذا الاسم/.test(txt)) state.identityCalls += 1;
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
      const singer = await drive(Q_SINGER, GOOD_DRAFT);
      eq('NO model call was spent identifying anybody', singer.state.identityCalls, 0);
      ok('NO «لم أتبيّن أي شيخ» template reaches the reader',
        !/لم أتبيّنْ أيَّ شيخٍ تقصد/.test(singer.text), singer.text.slice(0, 200));
      ok('NO «لم أقف على نصٍّ» apology either',
        !/لم أقف على نصٍّ/.test(singer.text), singer.text.slice(0, 200));
      // ── RE-PINNED ON THE STRONGER CONDITION, ASSERTION KEPT ────────────────
      //
      // The invariant was: no Brave query may carry an unregistered name. Its REASON was always
      // narrower than its wording — a name nobody publishes a fatwa for cannot match on the
      // religious list, and the empty result then reads as an absence of evidence about the RULING.
      // That reason is untouched and is pinned below, now stated in the terms that carry it.
      //
      // What changed is that there is a second list. The bounded world look-up searches the name on
      // SITES_GENERAL alone, to establish one thing a page can answer: does this name exist at all.
      // It cannot produce the failure this assertion exists to prevent — nothing on that list is a
      // fatwa source, and its result may never become a ruling — so the pin distinguishes the two
      // queries by the list each one names rather than forbidding the name outright.
      const WORLD_ONLY = (q) => /site:/.test(q)
        && q.split('site:').slice(1).every((s) => /^(?:ar\.wikipedia\.org|aljazeera\.net|bbc\.com|skynewsarabia\.com)\b/.test(s.trim()));
      const religiousQueries = singer.state.braveQueries.filter((q) => !WORLD_ONLY(q));
      ok('the search of the RELIGIOUS list carried NO unregistered name',
        religiousQueries.length > 0 && religiousQueries.every((q) => !/خالد|عبدالرحمن/.test(q)),
        JSON.stringify(religiousQueries));
      ok('...and the only query that may carry the name is the world look-up, bounded to ONE',
        singer.state.braveQueries.filter((q) => /خالد|عبدالرحمن/.test(q)).length <= 1
        && singer.state.braveQueries.filter((q) => /خالد|عبدالرحمن/.test(q)).every(WORLD_ONLY),
        JSON.stringify(singer.state.braveQueries));
      ok('...and it still carried the actual fiqh topic',
        singer.state.braveQueries.some((q) => /قصر|الصلاة/.test(q)),
        JSON.stringify(singer.state.braveQueries));
      ok('the reader gets the ruling he actually asked about',
        /قصر|ركعتين/.test(singer.text), singer.text.slice(0, 200));
      // RE-PINNED, AND STRONGER. The old gate asserted the reader is TOLD who the man really is.
      // Nothing sourced that, so nothing may say it — in either direction.
      ok('...and not one word is said about the man himself',
        !/فنّان|مغنّ|ممثل|ليس من أهل العلم|داعية/.test(singer.text), singer.text.slice(0, 300));
      eq('the stream closes exactly once', singer.res.ended, 1);

      // ── A REGISTERED SCHOLAR IS NOT TOUCHED ────────────────────────────────
      for (const [label, q] of [['ابن باز', Q_BAZ], ['ابن تيمية', Q_TAYMIYYAH]]) {
        const sch = await drive(q, 'ذكر موقع الإسلام سؤال وجواب أنّ المسافر يقصر الرباعية ركعتين.');
        eq(label + ': no identity call is spent on him either', sch.state.identityCalls, 0);
        eq(label + ': the stream closes exactly once', sch.res.ended, 1);
      }
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
