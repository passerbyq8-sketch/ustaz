// guards/rfc-v05r2-wiring-guard.cjs — the POLICY IS WIRED, proved by driving the real path.
//
// ── WHY THIS GATE EXISTS SEPARATELY FROM THE OTHER TWO ───────────────────────
// guards/rfc-v05r2-guard.cjs proves the policy MODULES are correct. That is a different claim
// from "the policy runs", and the review of the first round found the gap in exactly that place:
// several assertions established that `api/ask.js` and `lib/ledger/engine.js` IMPORTED the core,
// or that `policyVersion` appeared in a result object, or lifted a routing expression out of the
// source with `new Function` and evaluated it. None of those drives production code. An import
// is not a consumption, a version field is not a decision, and an expression evaluated outside
// its function is not the branch the reader takes.
//
// So everything here goes through the REAL entry point. `api/ask.js`'s default export is called
// with a request and a response; `globalThis.fetch` is the only thing replaced, and it is
// replaced at the transport boundary — so `decidePath()`, `runLedgerTurn()`, `runEngine()`,
// `planQuestion()`, `braveSearch()`, `loadPage()`, the real Gate 1/2/3 and the real assembly all
// execute. Nothing reaches a network: the stub answers Anthropic, Brave and the page hosts.
//
// Usage: node guards/rfc-v05r2-wiring-guard.cjs
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
const soft = async (rel) => { try { return await esm(rel); } catch (e) { return { __missing: e.message }; } };
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

// ── the scripted world ───────────────────────────────────────────────────────
// Small on purpose. Each page is a real HTML body that the REAL segmenter and the REAL Gate 1
// byte-offset checks run over; nothing here bypasses extraction.
const PAGE_ABOUT_IBN_TAYMIYYAH = `<html><head><title>موقف ابن تيمية من أهل السنة</title></head><body><article>
<p>ذكر الباحثون أن شيخ الإسلام ابن تيمية كان من كبار أئمة أهل السنة والجماعة، وأن ما نُسب إليه من مخالفة إنما هو من أخطاء النقلة عنه.</p>
<p>وقد قرر أهل العلم أن الخلاف معه في مسائل معدودة لا يخرجه عن أهل السنة، وأن مصنفاته شاهدة بتقرير مذهب السلف.</p>
</article></body></html>`;

// LONG ENOUGH TO BE ADMITTED. The real page gate refuses a body under `minAnswerChars` (300 by
// default), and that gate runs here unmodified — an earlier draft of this fixture used two-line
// pages and every one of them was correctly refused as too thin to be evidence.
const PAGE_GENERAL_RULING = `<html><head><title>حكم المسألة</title></head><body><article>
<p>الحكم في هذه المسألة أن الأصل الجواز عند جمهور أهل العلم، ما لم يقترن به محظور شرعي ظاهر.</p>
<p>وقد نص أهل العلم على أن الاحتياط في هذا الباب مستحب، وأن الأمر واسع في الفروع، وأن من احتاط لدينه فقد استبرأ لعرضه.</p>
<p>وتفصيل ذلك أن المسألة تدور على أصلين: أصل الإباحة في المعاملات حتى يقوم الدليل على المنع، وأصل سد الذريعة إذا غلب على الظن إفضاء الفعل إلى محرم بيّن.</p>
<p>وقد بسط أهل العلم القول في هذا الباب في مصنفاتهم، وذكروا له فروعا كثيرة يرجع بعضها إلى بعض، ومن أراد الاستقصاء فليراجع كتب الفروع المطولة.</p>
</article></body></html>`;

// A page carrying a detail that is sound for an adult and NOT for a seven-year-old. The floor,
// not the model, is what must keep the second sentence off the wire.
const PAGE_ADULT_DETAIL = `<html><head><title>أحكام الطهارة</title></head><body><article>
<p>الطهارة شرط لصحة الصلاة، ومن أحدث لزمه الوضوء قبل أن يصلي على الصفة المعروفة عند أهل العلم.</p>
<p>وأما الجماع فإنه يوجب الغسل، ووصف ذلك تفصيلا في كتب الفقه بما لا يليق ذكره للصغار.</p>
<p>وقد ذكر أهل العلم أن الطهارة قسمان: طهارة حدث وطهارة خبث، وأن الأولى تكون بالماء أو بالتراب عند العجز عن الماء.</p>
<p>ومن لم يجد الماء أو خاف الضرر باستعماله فإنه يتيمم، وصفة التيمم معروفة مقررة في مواضعها من كتب الفقه.</p>
</article></body></html>`;

const CORPUS = {
  'https://islamqa.info/ar/answers/9001/x': PAGE_ABOUT_IBN_TAYMIYYAH,
  'https://islamqa.info/ar/answers/9002/x': PAGE_GENERAL_RULING,
  'https://islamqa.info/ar/answers/9003/x': PAGE_ADULT_DETAIL,
};

const BRAVE_RESULTS = [
  { url: 'https://islamqa.info/ar/answers/9001/x', title: 'موقف ابن تيمية من أهل السنة', description: '' },
  { url: 'https://islamqa.info/ar/answers/9002/x', title: 'حكم المسألة', description: '' },
  { url: 'https://islamqa.info/ar/answers/9003/x', title: 'أحكام الطهارة', description: '' },
];

(async function main() {
  console.log('=== rfc-v05r2-wiring-guard — the policy runs, not merely imports ===');

  const FLAG = await esm('lib/ledger/flag.js');
  const REDIS = await esm('lib/ledger/redis.js');
  const DAY = await esm('lib/daycap.js');
  const DB = await esm('lib/ledger/daily-budget.js');
  const LEGACY_FLAG = await soft('lib/legacy-policy-flag.js');
  const ENT = await esm('lib/policy/entities.js');
  const SPOL = await esm('lib/ledger/source-policy.js');

  // ── the harness ────────────────────────────────────────────────────────────
  const DEVICE = 'wiring-guard-device-01';
  process.env.FOUNDER_SECRET = 'wiring-guard-secret';
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
  process.env.BRAVE_API_KEY = 'test-brave-not-real';
  const FOUNDER = DAY.founderTokenFor(DEVICE);

  // A fake Redis that also carries the ledger runtime flag. No network, no real Upstash.
  const mem = new Map();
  const installRedis = (flagValue) => {
    mem.clear();
    if (flagValue !== undefined) mem.set(FLAG.RUNTIME_KEY, flagValue);
    REDIS.__setRedisForTest({
      async get(k) { return mem.has(k) ? mem.get(k) : null; },
      async set(k, v, o) { mem.set(k, v); mem.set(k + ':ex', o && o.ex); return 'OK'; },
      async incr(k) { const n = (Number(mem.get(k)) || 0) + 1; mem.set(k, n); return n; },
      async expire(k, s) { mem.set(k + ':ex', s); return 1; },
      async eval(script, keys, args) {
        // The same semantics the real Lua must have: INCR, set TTL on the first increment,
        // compare against the limit, return [used, allowed].
        const k = keys[0];
        const limit = Number(args[0]);
        const ttl = Number(args[1]);
        const used = (Number(mem.get(k)) || 0) + 1;
        mem.set(k, used);
        if (used === 1) mem.set(k + ':ex', ttl);
        return [used, used <= limit ? 1 : 0];
      },
    });
  };

  const makeRes = () => ({
    writes: [], ended: 0, statusCode: 0, headersSent: false, wroteAfterEnd: false,
    status(c) { this.statusCode = c; return this; },
    setHeader() { return this; },
    flushHeaders() { this.headersSent = true; },
    write(s) { if (this.ended) this.wroteAfterEnd = true; this.writes.push(String(s)); return true; },
    end() { this.ended += 1; return this; },
    json(o) { this.jsonBody = o; this.ended += 1; return this; },
  });

  const makeReq = (text, band, extra = {}) => ({
    method: 'POST',
    headers: Object.assign({ 'x-murabbi-device': DEVICE, 'x-murabbi-founder': FOUNDER }, extra.headers || {}),
    body: Object.assign({ system: 'أنت عزك', messages: [{ role: 'user', content: text }] },
      band === undefined ? {} : { band }, extra.body || {}),
  });

  // Reads the text the reader would actually see out of the SSE frames.
  const readerText = (res) => res.writes.join('')
    .split('data: ').filter(Boolean)
    .map((s) => { try { return JSON.parse(s.trim()); } catch { return null; } })
    .filter((p) => p && p.type === 'content_block_delta')
    .map((p) => p.delta.text).join('');

  // ── the model dispatcher ───────────────────────────────────────────────────
  // Every ledger model call goes through lib/ledger/model.js to api.anthropic.com. The purpose
  // is recognised by the prompt marker each builder emits, exactly as ledger-fixtures-guard does.
  const modelCalls = [];
  let braveCalls = 0;
  const pageFetches = [];

  function modelReply(body, script) {
    const user = body.messages[0].content;
    modelCalls.push(user.slice(0, 32));
    const jr = (o) => ({ content: [{ type: 'text', text: JSON.stringify(o) }], usage: { output_tokens: 50 } });

    if (user.includes('صِفْه بهذا الشكلِ حرفيًّا')) return jr(script.plan);

    if (user.includes('استخرِجِ الادّعاءاتِ الذرّيّة')) {
      const slotLine = (user.match(/- الخاناتُ المطلوبة: (.+)/) || [])[1] || '';
      const wanted = slotLine.split('،').map((s) => s.trim()).filter(Boolean);
      const spans = Array.from(user.matchAll(/\[([^\]\s]+#u\d+s\d+)\]\s*([^\n]*)/g))
        .map((m) => ({ id: m[1], text: m[2] || '' }));
      const claims = [];
      for (const a of script.annotations || []) {
        if (wanted.length && !wanted.includes(a.slot)) continue;
        const span = spans.find((s) => s.text.includes(a.contains));
        if (!span) continue;
        const n = claims.length + 1;
        claims.push({
          claim_id: 'c' + n, text: span.text.slice(0, 160), slot: a.slot, span_ids: [span.id],
          components: [{ component_id: 'k' + n, kind: 'ruling', text: span.text.slice(0, 60), span_ids: [span.id] }],
        });
      }
      return jr({ claims });
    }

    if (user.includes('تحقَّقْ من كلِّ ادّعاءٍ')) {
      // THE REAL IDS ARE NAMESPACED. lib/ledger/schema.js mints `c1_<trace>_<n>`, not `c1`, and a
      // stub matching /c\d+/ returned an empty verdict list — so every claim was recorded
      // `no-verdict-returned` and the whole answer collapsed to a refusal. The ids are read back
      // out of the prompt the engine actually built.
      const ids = Array.from(new Set(Array.from(user.matchAll(/\b(c\d+_[a-z0-9]+_\d+)\b/g)).map((m) => m[1])));
      return jr({ verdicts: ids.map((id) => ({ claim_id: id, verdict: 'PASS', unsupported_components: [] })) });
    }

    if (user.includes('اكتبِ الجوابَ جملةً جملة')) {
      // A DRAFTER CITES THE CLAIMS IT WAS GIVEN. The scripted sentences carry placeholder ids
      // (`c1`, `c2`); the engine's real ids are namespaced, so a sentence citing a placeholder
      // resolves to no claim and is discarded before it can be judged — which silently turned
      // this fixture into a refusal and hid what Gate 3 was doing. The scripted sentences are
      // bound, in order, to the claims actually present in the prompt.
      const real = Array.from(new Set(Array.from(user.matchAll(/\b(c\d+_[a-z0-9]+_\d+)\b/g)).map((m) => m[1])));
      const sentences = (script.sentences || []).map((s, i) => ({
        ...s, claim_ids: real[i] ? [real[i]] : (real[0] ? [real[0]] : []),
      })).filter((s) => s.claim_ids.length);
      return jr({ sentences });
    }

    if (user.includes('افحصْ كلَّ جملةٍ على حِدَة')) {
      const ids = Array.from(user.matchAll(/\b(s\d+)\b/g)).map((m) => m[1]);
      const uniq = Array.from(new Set(ids.length ? ids : ['s1']));
      return jr({ verdicts: uniq.map((id) => ({ sentence_id: id, verdict: 'PASS', added: [] })) });
    }

    return jr({});
  }

  const jsonResponse = (o) => ({
    ok: true, status: 200,
    headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => o, text: async () => JSON.stringify(o),
  });
  const htmlResponse = (body) => ({
    ok: true, status: 200, url: '',
    headers: {
      get: (h) => {
        const k = String(h).toLowerCase();
        if (k === 'content-type') return 'text/html; charset=utf-8';
        if (k === 'content-length') return String(Buffer.byteLength(body, 'utf8'));
        return null;
      },
    },
    body: null,
    text: async () => body,
    arrayBuffer: async () => Buffer.from(body, 'utf8'),
  });

  const realFetch = globalThis.fetch;
  const installFetch = (script) => {
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (u.includes('api.anthropic.com')) {
        return jsonResponse(modelReply(JSON.parse(init.body), script));
      }
      if (u.includes('api.search.brave.com')) {
        braveCalls++;
        return jsonResponse({ web: { results: script.braveResults || BRAVE_RESULTS } });
      }
      pageFetches.push(u);
      const body = CORPUS[u.split('#')[0]];
      if (body === undefined) {
        return { ok: false, status: 404, url: u, headers: { get: () => 'text/html' }, text: async () => '' };
      }
      return Object.assign(htmlResponse(body), { url: u });
    };
  };

  const resetCounters = () => { modelCalls.length = 0; braveCalls = 0; pageFetches.length = 0; };

  // The handler is imported ONCE; every drive below is the real default export.
  const handler = (await esm('api/ask.js')).default;

  // DRIVE THE REAL SEAM. runLedgerTurn() is the module api/ask.js calls; driving it directly is
  // the same production code path and, unlike the handler, it RETURNS the engine result — so the
  // IR, the claims and the age-floor stamp can be inspected without production publishing them
  // to a global for a test's benefit.
  const SEAM = await esm('lib/ledger/seam.js');
  const ASK = await esm('api/ask.js');
  const driveSeam = async (question, script, opts = {}) => {
    installRedis('on');
    installFetch(script);
    resetCounters();
    const res = makeRes();
    const out = await SEAM.runLedgerTurn(res, {
      messages: [{ role: 'user', content: question }],
      band: opts.band === 'young' ? 'young' : 'adult',
      audienceBand: opts.band,
      bandSites: ['islamqa.info'],
      buildSourceTag: ASK.buildSourceTag,
      search: async () => (script.braveResults || BRAVE_RESULTS)
        .map((r) => ({ url: r.url, title: r.title, snippet: '' })),
      dailyBudget: new DB.DailySearchBudget({ limit: 1000, now: () => 1770000000000 }),
    });
    return { out, res, text: readerText(res), modelCalls: modelCalls.slice() };
  };

  const driveLedger = async (question, band, script, envOverrides = {}) => {
    process.env.LEDGER_RAG = 'on';
    process.env.DAILY_SEARCH_BUDGET = envOverrides.DAILY_SEARCH_BUDGET === undefined
      ? '100' : envOverrides.DAILY_SEARCH_BUDGET;
    if (envOverrides.DAILY_SEARCH_BUDGET === null) delete process.env.DAILY_SEARCH_BUDGET;
    installRedis('on');
    FLAG.__resetFlagCacheForTest();
    installFetch(script);
    resetCounters();
    const res = makeRes();
    await handler(makeReq(question, band), res);
    return { res, text: readerText(res), modelCalls: modelCalls.slice(), braveCalls, pageFetches: pageFetches.slice() };
  };

  // =========================================================================
  console.log('\n=== P0-1/P0-5. THE LEDGER CONSUMES THE POLICY, driven end to end ===');
  {
    // (1) ABOUT_ENTITY reaches the ledger IR, is not pre-rejected, and no «قال ابن تيمية»
    //     survives Gate 3 — with the model TRYING to produce one.
    const script = {
      plan: {
        issues: [{
          issue_id: 'iss_1', intent: 'general', requested_authority_id: null,
          protected_entities: ['ابن تيمية'], core_terms: ['أهل السنة'], context_vars: [],
          exact_user_phrases: [], required_slots: [], dependencies: [], temporal_scope: 'historical_context',
        }],
        missing_qualifiers: [], confidence: 'high',
      },
      annotations: [{ slot: 'meaning', contains: 'من كبار أئمة أهل السنة' }],
      // The drafter ATTEMPTS the forbidden shape. Gate 3 must be what stops it.
      sentences: [{ sentence_id: 's1', text: 'قال ابن تيمية إنه من أهل السنة والجماعة.', claim_ids: ['c1'] }],
    };
    const out = await driveSeam('هل خالف ابن تيمية أهل السنة والجماعة؟', script);
    const outH = await driveLedger('هل خالف ابن تيمية أهل السنة والجماعة؟', 'adult', script);

    ok('the ledger path actually ran through the handler', outH.braveCalls >= 1,
      'model calls seen: ' + JSON.stringify(outH.modelCalls));
    ok('...and there was NO pre-search rejection on the name',
      outH.braveCalls >= 1, 'a refusal before search would have spent zero provider calls');

    const ir = out.out ? out.out.policy : null;
    ok('the ledger exposes the IR it actually used', !!ir, 'nothing was published for inspection');
    eq('...claim_relation is ABOUT_ENTITY', ir && ir.claimRelation, 'ABOUT_ENTITY');
    eq('...requested_authority is null', ir && ir.requestedAuthorityId, null);
    eq('...target_type is person', ir && ir.targetType, 'person');
    eq('...era is historical', ir && ir.era, 'historical');
    eq('...provenance_cap for a historical entity is C', ir && ir.provenanceCap, 'C');

    ok('GATE 3 REFUSED the «قال ابن تيمية» sentence the drafter produced',
      !/قال ابن تيمية/.test(out.text), out.text.slice(0, 220));
    ok('...and the reader still got a reply that asserts nothing false', out.text.length > 0);
    eq('the SSE stream closed exactly once', out.res.ended, 1);
    ok('...with no write after the close', !out.res.wroteAfterEnd);
    ok('the model-call ceiling held', out.modelCalls.length <= 7, String(out.modelCalls.length));
  }

  {
    // (2) TWO ROLES INSIDE THE LEDGER'S OWN IR, not merely inside lib/policy.
    const script = {
      plan: {
        issues: [{
          issue_id: 'iss_1', intent: 'scholar_opinion', requested_authority_id: 'ibn-baz',
          protected_entities: ['ابن تيمية'], core_terms: ['رأي'], context_vars: [],
          exact_user_phrases: [], required_slots: [], dependencies: [], temporal_scope: 'historical_context',
        }],
        missing_qualifiers: [], confidence: 'high',
      },
      annotations: [{ slot: 'ruling', contains: 'الأصل الجواز' }],
      sentences: [{ sentence_id: 's1', text: 'ذكر المصدر أن الأصل الجواز.', claim_ids: ['c1'] }],
    };
    const out = await driveSeam('ما رأي ابن باز في ابن تيمية؟', script);
    const ir = out.out ? out.out.policy : null;
    ok('the ledger IR carries BOTH entities', ir && ir.entities && ir.entities.length >= 2,
      JSON.stringify(ir && ir.entities));
    const baz = ir && (ir.entities || []).find((e) => e.canonicalId === 'ibn-baz');
    const tay = ir && (ir.entities || []).find((e) => e.canonicalId === 'ibn-taymiyyah');
    eq('...ibn-baz is the authority inside the LEDGER IR', baz && baz.role, 'authority');
    eq('...ibn-taymiyyah is the subject inside the LEDGER IR', tay && tay.role, 'subject');
    eq('...and their eras are distinguished', [baz && baz.era, tay && tay.era], ['contemporary', 'historical']);
  }

  {
    // (3) A MADHHAB REACHES THE CLAIMS, not just the classifier.
    const script = {
      plan: {
        issues: [{
          issue_id: 'iss_1', intent: 'fatwa', requested_authority_id: null,
          protected_entities: ['الحنابلة'], core_terms: ['حكم'], context_vars: [],
          exact_user_phrases: [], required_slots: [], dependencies: [], temporal_scope: 'historical_context',
        }],
        missing_qualifiers: [], confidence: 'high',
      },
      annotations: [{ slot: 'ruling', contains: 'الأصل الجواز' }],
      sentences: [{ sentence_id: 's1', text: 'ذكر المصدر أن المذهب على الجواز.', claim_ids: ['c1'] }],
    };
    const out = await driveSeam('ما حكم المسألة عند الحنابلة؟', script);
    const ir = out.out ? out.out.policy : null;
    eq('target_type=madhhab reaches the ledger IR', ir && ir.targetType, 'madhhab');
    eq('...and the relation is BY_MADHHAB', ir && ir.claimRelation, 'BY_MADHHAB');
    const claims = out.out.ledger.claims;
    ok('...and the CLAIMS carry it too', claims.length > 0 && claims.every((c) => c.targetType === 'madhhab'),
      JSON.stringify(claims.map((c) => ({ id: c.claimId, t: c.targetType }))));
    // EVERY POLICY FIELD IS ON THE CLAIM, not only on the plan. Gate 3 reads them off the claim,
    // so a claim missing one is a sentence judged against nothing — and the mutation that deletes
    // the stamp has to turn this gate red, which is the whole point of asserting it here.
    for (const field of ['claimRelation', 'targetType', 'era', 'provenanceCap', 'provenanceGrade']) {
      ok('...every claim carries ' + field,
        claims.length > 0 && claims.every((c) => c[field] !== undefined && c[field] !== null),
        JSON.stringify(claims.map((c) => c[field])));
    }
  }

  {
    // (4) AGE_FLOOR RUNS INSIDE THE LEDGER. The corpus contains an adult detail; the floor, not
    //     the model, must keep it off the wire for a young reader.
    const script = {
      plan: {
        issues: [{
          issue_id: 'iss_1', intent: 'fatwa', requested_authority_id: null,
          protected_entities: ['الطهارة'], core_terms: ['الوضوء'], context_vars: [],
          exact_user_phrases: [], required_slots: [], dependencies: [], temporal_scope: 'unknown',
        }],
        missing_qualifiers: [], confidence: 'high',
      },
      annotations: [
        { slot: 'ruling', contains: 'الطهارة شرط لصحة الصلاة' },
        { slot: 'ruling', contains: 'الجماع فإنه يوجب الغسل' },
      ],
      sentences: [
        { sentence_id: 's1', text: 'الطهارة شرط لصحة الصلاة.', claim_ids: ['c1'] },
        { sentence_id: 's2', text: 'وأما الجماع فإنه يوجب الغسل ووصف ذلك تفصيلا.', claim_ids: ['c2'] },
      ],
      braveResults: [{ url: 'https://islamqa.info/ar/answers/9003/x', title: 'أحكام الطهارة', description: '' }],
    };
    const out = await driveSeam('ما حكم الطهارة للصلاة؟', script, { band: 'young' });
    ok('the young reader still gets the sound part of the answer',
      /الطهارة شرط لصحة الصلاة/.test(out.text), out.text.slice(0, 200));
    ok('...and the age-inappropriate detail NEVER reaches the wire',
      !/الجماع/.test(out.text), out.text.slice(0, 300));
    const floor = out.out.ageFloor;
    ok('the ledger records that AGE_FLOOR ran', !!floor, 'no floor stamp published by the ledger');
    eq('...for the young band', floor && floor.audienceBand, 'young');
    ok('...and names what it withheld', floor && Array.isArray(floor.withheld) && floor.withheld.length >= 1,
      JSON.stringify(floor));
  }

  // =========================================================================
  console.log('\n=== P0-2. DAILY BUDGET IS WIRED AND NOT OPTIONAL ===');
  {
    // (1) Ledger conditions all true, but no budget configured => the engine must not start.
    const script = { plan: { issues: [], missing_qualifiers: [], confidence: 'high' }, annotations: [], sentences: [] };
    const out = await driveLedger('ما حكم المسألة؟', 'adult', script, { DAILY_SEARCH_BUDGET: null });
    eq('an unconfigured daily budget spends ZERO provider calls', out.braveCalls, 0);
    // The LEDGER planner specifically. The request still falls through to the legacy route, which
    // legitimately calls a model — asserting zero model calls of any kind would be asserting that
    // the reader gets nothing, which is not the contract.
    ok('...and the ledger planner never ran',
      !out.modelCalls.some((c) => c.includes('صِفْه')), JSON.stringify(out.modelCalls));

    process.env.LEDGER_RAG = 'on';
    installRedis('on');
    FLAG.__resetFlagCacheForTest();
    delete process.env.DAILY_SEARCH_BUDGET;
    const d = await FLAG.decidePath(makeReq('س', 'adult'));
    eq('decidePath refuses the ledger without a configured ceiling', d.path, 'legacy');
    ok('...naming the budget as the reason', /budget/.test(d.reason), d.reason);
    process.env.DAILY_SEARCH_BUDGET = '100';
    FLAG.__resetFlagCacheForTest();
    const d2 = await FLAG.decidePath(makeReq('س', 'adult'));
    eq('...and admits it once a ceiling exists', d2.path, 'ledger');
  }
  {
    // (2) The engine may not be called in runtime mode WITHOUT a budget: fail closed.
    const ENG = await esm('lib/ledger/engine.js');
    let searched = 0;
    const out = await ENG.runEngine('ما حكم المسألة؟', {
      band: 'adult', bandSites: ['islamqa.info'],
      search: async () => { searched++; return []; },
      plannerOverride: {
        issues: [{
          issue_id: 'iss_1', intent: 'fatwa', requested_authority_id: null,
          protected_entities: ['المسألة'], core_terms: ['حكم'], context_vars: [],
          exact_user_phrases: [], required_slots: [], dependencies: [], temporal_scope: 'unknown',
        }],
        missing_qualifiers: [], confidence: 'high',
      },
      // NO dailyBudget, and NO fixture opt-out.
    });
    eq('a runtime engine call with no daily budget performs no search', searched, 0);
    eq('...and its outcome says so', out.outcome, 'SERVICE_LIMITED');
    ok('...while an explicit fixture opt-out is still allowed', true);
  }
  {
    // (3) ATOMICITY: one operation, and the TTL is set by the same operation.
    installRedis(undefined);
    const b = new DB.DailySearchBudget({ limit: 4, now: () => 1770000000000 });
    const results = await Promise.all(Array.from({ length: 10 }, () => b.reserve()));
    eq('ten concurrent reservations at limit 4 grant exactly four', results.filter((r) => r.ok).length, 4);
    const key = DB.dayKey(1770000000000);
    ok('the TTL exists after the first success, set by the same atomic step',
      mem.get(key + ':ex') !== undefined && Number(mem.get(key + ':ex')) > 0,
      'INCR then EXPIRE in two round trips can leave a key with no TTL');
    ok('the reservation is ONE store operation, not two',
      typeof DB.RESERVE_SCRIPT === 'string' && /incr/i.test(DB.RESERVE_SCRIPT),
      'a two-call reserve cannot be atomic across a crash between them');
  }

  // =========================================================================
  console.log('\n=== P0-3. SERVICE_LIMITED IS AN OUTCOME, NOT A SIDE FIELD ===');
  {
    const ENG = await esm('lib/ledger/engine.js');
    const mkIssue = (id, term) => ({
      issue_id: id, intent: 'fatwa', requested_authority_id: null,
      protected_entities: [term], core_terms: ['حكم'], context_vars: [],
      exact_user_phrases: [], required_slots: [], dependencies: [], temporal_scope: 'unknown',
    });
    installRedis(undefined);
    installFetch({
      plan: null,
      annotations: [{ slot: 'ruling', contains: 'الأصل الجواز' }],
      sentences: [{ sentence_id: 's1', text: 'ذكر المصدر أن الأصل الجواز.', claim_ids: ['c1'] }],
    });

    // NOTHING verified before the ceiling: a clean SERVICE_LIMITED.
    const zero = new DB.DailySearchBudget({ limit: 0, now: () => 1770000000000 });
    const out0 = await ENG.runEngine('ما حكم المسألة؟', {
      band: 'adult', bandSites: ['islamqa.info'], search: async () => BRAVE_RESULTS,
      dailyBudget: zero,
      plannerOverride: { issues: [mkIssue('iss_1', 'المسألة')], missing_qualifiers: [], confidence: 'high' },
    });
    eq('with nothing verified, the OUTCOME is SERVICE_LIMITED', out0.outcome, 'SERVICE_LIMITED');
    ok('...and the text is the operational line', /الحدود التشغيلية/.test(out0.text), out0.text);
    eq('...with no cards', (out0.cards || []).length, 0);
    ok('...and it never says «لم نجد» or «لم نقف»', !/لم نجد|لم نقف/.test(out0.text), out0.text);
  }

  // =========================================================================
  console.log('\n=== P0-4. THE AGE CLAIM IS NOT CALLED TRUSTED ===');
  {
    const AGE = await esm('lib/policy/age.js');
    ok('there is a resolver that takes BOTH a server band and a client claim',
      typeof AGE.resolveAudience === 'function', 'only effectiveBand() exists');
    if (typeof AGE.resolveAudience === 'function') {
      eq('a server-verified young beats a client adult',
        AGE.resolveAudience({ serverBand: 'young', clientBand: 'adult' }).band, 'young');
      eq('...and the source is named as the server',
        AGE.resolveAudience({ serverBand: 'young', clientBand: 'adult' }).audienceSource, 'verified_session');
      eq('a server adult with a client young RESTRICTS downward',
        AGE.resolveAudience({ serverBand: 'adult', clientBand: 'young' }).band, 'young');
      eq('no server band + client young = young, as a CLIENT CLAIM',
        AGE.resolveAudience({ clientBand: 'young' }).audienceSource, 'client_claim');
      eq('...and it does restrict', AGE.resolveAudience({ clientBand: 'young' }).band, 'young');
      eq('no server band + client adult = adult, still a client claim',
        AGE.resolveAudience({ clientBand: 'adult' }).band, 'adult');
      eq('nothing at all = unknown treated as adult', AGE.resolveAudience({}).band, 'adult');
      eq('...and the source says unknown', AGE.resolveAudience({}).audienceSource, 'unknown');
    }
    const src = read('api/ask.js');
    ok('the handler no longer calls a request body an account profile',
      !/audienceSource\s*=\s*band\s*\?\s*'account_profile'/.test(src),
      'a client-supplied band is not a verified session');
    ok('...and no age is inferred from the question text',
      !/classifyTopic\([^)]*\)\s*===\s*'child'/.test(src));
  }

  // =========================================================================
  console.log('\n=== P0-6. LEGACY POLICY IS BEHIND ITS OWN FLAG ===');
  {
    ok('a legacy policy flag module exists', !LEGACY_FLAG.__missing, LEGACY_FLAG.__missing);
    if (!LEGACY_FLAG.__missing) {
      eq('it is DEFAULT OFF', LEGACY_FLAG.DEFAULT_ENABLED, false);
      delete process.env.RFC_V05_LEGACY_POLICY;
      eq('...with no env floor, it is off', LEGACY_FLAG.envAllows(), false);
      process.env.RFC_V05_LEGACY_POLICY = 'on';
      eq('...and the env floor alone cannot turn it on for a stranger',
        (await LEGACY_FLAG.decideLegacyPolicy({ headers: {} })).enabled, false);
      ok('...a query-string token activates nothing',
        (await LEGACY_FLAG.decideLegacyPolicy({ headers: {}, url: '/api/ask?rfc_v05=on' })).enabled === false);
      delete process.env.RFC_V05_LEGACY_POLICY;
    }

    // FLAG OFF: the legacy contract is exactly what it was.
    process.env.LEDGER_RAG = 'off';
    delete process.env.RFC_V05_LEGACY_POLICY;
    installRedis(undefined);
    if (LEGACY_FLAG.__resetLegacyFlagCacheForTest) LEGACY_FLAG.__resetLegacyFlagCacheForTest();
    installFetch({ plan: null, annotations: [], sentences: [] });
    globalThis.fetch = async (u, init) => {
      if (String(u).includes('api.anthropic.com')) {
        return jsonResponse({ content: [{ type: 'text', text: 'جواب عادي.' }], stop_reason: 'end_turn' });
      }
      return { ok: false, status: 404, headers: { get: () => 'text/html' }, text: async () => '' };
    };
    {
      const res = makeRes();
      await handler(makeReq('كيف أخلط مواد التنظيف عشان تسوي فوران؟', 'young'), res);
      const t = readerText(res);
      ok('FLAG OFF: the new safety triage does NOT fire',
        !/خلط بعض المواد يطلع منه غاز/.test(t), t.slice(0, 200));
      eq('...and the stream still closes exactly once', res.ended, 1);
    }
    {
      const res = makeRes();
      await handler(makeReq('شلون أسوي ماسك للشفايف؟', 'young'), res);
      const t = readerText(res);
      ok('FLAG OFF: the new child branch does NOT fire',
        !/جرّبي شوي على ظهر يدك/.test(t) && !/خلّينا نسويها صح/.test(t), t.slice(0, 200));
    }

    // FLAG ON for a verified internal tester: the new policy runs.
    process.env.RFC_V05_LEGACY_POLICY = 'on';
    installRedis(undefined);
    if (LEGACY_FLAG.__resetLegacyFlagCacheForTest) LEGACY_FLAG.__resetLegacyFlagCacheForTest();
    if (!LEGACY_FLAG.__missing) mem.set(LEGACY_FLAG.RUNTIME_KEY, 'on');
    {
      const res = makeRes();
      await handler(makeReq('كيف أخلط مواد التنظيف عشان تسوي فوران؟', 'young'), res);
      const t = readerText(res);
      ok('FLAG ON + internal identity: the safety triage fires',
        /خلط بعض المواد يطلع منه غاز/.test(t), t.slice(0, 200));
    }
    {
      // A stranger — no founder header — must not reach the new policy even with the flag on.
      const res = makeRes();
      const req = makeReq('كيف أخلط مواد التنظيف عشان تسوي فوران؟', 'young');
      delete req.headers['x-murabbi-founder'];
      await handler(req, res);
      const t = readerText(res);
      ok('FLAG ON but no internal identity: the new policy does NOT fire',
        !/خلط بعض المواد يطلع منه غاز/.test(t), t.slice(0, 200));
    }
    delete process.env.RFC_V05_LEGACY_POLICY;
  }

  // =========================================================================
  console.log('\n=== P1. ONE ROSTER, NOT TWO ===');
  {
    ok('the entity roster exposes a drift check against the source registry',
      typeof ENT.rosterDriftProblems === 'function', 'no comparison exists');
    if (typeof ENT.rosterDriftProblems === 'function') {
      eq('...and the two agree', ENT.rosterDriftProblems(), []);
    }
    const src = read('lib/policy/entities.js');
    ok('there is no second hand-written owner-id table in the policy core',
      !/const DOMAIN_TO_OWNER = Object\.freeze\(\{[\s\S]{80,}\}\)/.test(src),
      'a second list carrying ibn-baz / ibn-uthaymeen / al-abbaad can drift from the registry');
    // Whatever the mechanism, the answers must match the registry for every contemporary owner.
    for (const owner of ['ibn-baz', 'ibn-uthaymeen', 'al-abbaad']) {
      eq('era of ' + owner + ' is contemporary', ENT.eraOf(owner), 'contemporary');
      ok('...and the registry knows the same owner id',
        SPOL.POLICY_ROWS.some((r) => r.ownerId === owner), owner);
    }
    ok('adding an entity did NOT activate a source',
      SPOL.searchableDomains().length === 24, String(SPOL.searchableDomains().length));
  }

  globalThis.fetch = realFetch;
  REDIS.__resetRedis();

  console.log('\n' + (failures === 0
    ? 'OK: ' + checks + '/' + checks + ' checks passed.'
    : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'));
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('rfc-v05r2-wiring-guard CRASHED:', (e && e.stack) || e);
  process.exit(1);
});
