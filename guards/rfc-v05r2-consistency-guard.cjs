// guards/rfc-v05r2-consistency-guard.cjs — one answer unit may not credit a man and disclaim him.
//
// THE MEASURED P0. «ما رأي ابن تيمية فيمن ترك الصلاة تكاسلًا هل عليه قضاء؟» was answered with his
// position stated as fact, a quotation attributed to مجموع الفتاوى, the majority view, his view
// called weak, a recommendation to make up the prayer — and then, in the SAME reply:
//
//   «لم أقف على نصٍّ مباشرٍ للشيخ ابن تيميه»
//
// Both halves cannot be true. The handler already instructed the model not to attribute anything
// in that state; the model attributed anyway, because an instruction is a request and not a gate.
//
// WHICH ENGINE PRODUCED IT — ESTABLISHED HERE, NOT ASSUMED. unattributedNote() exists only in
// api/ask.js's legacy branch and in no file under lib/ledger/, and the ledger branch returns
// unconditionally with no fallback. This gate asserts both, so the attribution of the defect to
// the legacy path stays true as the code moves.
//
// Every drive below is the REAL api/ask.js default export with req/res doubles and a scripted
// model, so what is asserted is what the reader would actually have received.
//
// Usage: node guards/rfc-v05r2-consistency-guard.cjs
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

// ── the exact questions from the report ──────────────────────────────────────
const Q_QADA = 'ما رأي ابن تيمية فيمن ترك الصلاة تكاسلًا هل عليه قضاء؟';
const Q_AHLSUNNA = 'هل خالف شيخ الإسلام ابن تيمية أهل السنة والجماعة؟';
const Q_MUTLAQ = 'ما رأي الشيخ مطلق الجاسر في هذه المسألة؟';
const Q_DUA = 'ما حكم قول يا معطي لا تبطي؟';

// The reply that was actually served, reproduced verbatim in shape: assertion + quotation +
// majority + weakening + advice, then the disclaimer.
const BAD_DRAFT = [
  'يرى ابن تيمية أنّ من ترك الصلاة تكاسلًا لا قضاء عليه،',
  'قال في مجموع الفتاوى: «ومن ترك الصلاة عمدًا فلا يشرع له قضاؤها».',
  'وذهب الجمهور إلى وجوب القضاء، وقول ابن تيمية ضعيف، والأحوط أن تقضي ما فاتك.',
].join(' ');

// What a correct grade-C reply looks like: the SOURCE carries the transmission, no speech, no
// quotation of him, and nothing added that no evidence supports.
const GOOD_DRAFT = [
  'ذكر موقع إسلام ويب أنّ ابن تيمية يرى عدم مشروعية قضاء الصلاة المتروكة عمدًا،',
  'وأنّ عامّة أهل العلم على وجوب القضاء، كما هو مبيَّن في المصدر المذكور.',
].join(' ');

(async function main() {
  console.log('=== rfc-v05r2-consistency-guard — credited and disclaimed cannot both be true ===');

  const CG = await esm('lib/policy/consistency-gate.js');
  const DC = await esm('lib/daycap.js');
  const STORE = await esm('lib/ledger/redis.js');

  // =========================================================================
  console.log('\n=== A. WHICH ENGINE PRODUCED THE DEFECT — ESTABLISHED, NOT ASSUMED ===');
  {
    const askSrc = read('api/ask.js');
    ok('the disclaimer exists only in the legacy branch of api/ask.js',
      /unattributedNote\(/.test(askSrc));
    const ledgerDir = fs.readdirSync(path.join(REPO, 'lib', 'ledger'));
    ok('...and in no ledger module at all',
      ledgerDir.every((f) => !/unattributedNote|لم أقف على/.test(read('lib/ledger/' + f))));
    const branchAt = askSrc.indexOf("if (ledgerPath.path === 'ledger') {");
    const tail = askSrc.slice(branchAt, branchAt + 2600);
    ok('the ledger branch returns unconditionally — there is no fallback to legacy',
      /\n      return;\n/.test(tail) && !/catch[\s\S]{0,400}legacy/i.test(tail));
  }

  // =========================================================================
  console.log('\n=== B. THE GATE ITSELF — RED on the served reply, GREEN on the sourced one ===');
  {
    const ctx = { entity: 'ابن تيميه', notDirectlyVerified: true, searchProven: false, allowSourcedPosition: true };
    const bad = CG.consistencyProblems(BAD_DRAFT + ' تنبيه: لم أقف على نصٍّ مباشرٍ للشيخ ابن تيميه.', ctx);
    ok('RED: the served reply is rejected', bad.length > 0, JSON.stringify(bad));
    ok('...for claiming a position with no verified text',
      bad.includes(CG.PROBLEM.POSITION_WITHOUT_EVIDENCE), JSON.stringify(bad));
    ok('...for quoting him', bad.includes(CG.PROBLEM.QUOTE_WITHOUT_EVIDENCE), JSON.stringify(bad));
    ok('...and for denying a search that never ran',
      bad.includes(CG.PROBLEM.NEGATION_WITHOUT_SEARCH), JSON.stringify(bad));

    eq('GREEN: the sourced grade-C transmission passes', CG.consistencyProblems(GOOD_DRAFT, ctx), []);
    eq('GREEN: a general ruling naming nobody passes',
      CG.consistencyProblems('الحكم العام عند أهل العلم وجوب المبادرة بالتوبة كما في المصدر المذكور.', ctx), []);

    // Both word orders, because Arabic fronts the subject too.
    for (const t of ['قال ابن تيمية بعدم القضاء', 'ابن تيمية قال بعدم القضاء',
      'ذكر الموقع أنّ ابن تيمية قال بعدم القضاء']) {
      ok('speech is refused: «' + t.slice(0, 26) + '…»',
        CG.consistencyProblems(t, ctx).includes(CG.PROBLEM.SPEECH_WITHOUT_EVIDENCE));
    }
    ok('a bare position with no source named is refused',
      CG.consistencyProblems('يرى ابن تيمية عدم القضاء.', ctx).includes(CG.PROBLEM.POSITION_WITHOUT_EVIDENCE));
    // A quotation that is not his must survive, or the gate would silence the Qur'an.
    eq('a Qur\'anic quotation naming no scholar passes',
      CG.consistencyProblems('قال تعالى «وأقيموا الصلاة» والحكم العام وجوب المبادرة.', ctx), []);
    // Once his text IS verified, none of this applies.
    eq('with his text verified, the same reply is unrestricted',
      CG.consistencyProblems(BAD_DRAFT, { entity: 'ابن تيميه', notDirectlyVerified: false, searchProven: true }), []);
  }

  // =========================================================================
  console.log('\n=== C. «لم أقف» NEEDS PROOF THAT A SEARCH RAN ===');
  {
    const base = { entity: 'ابن تيميه', notDirectlyVerified: true, allowSourcedPosition: true };
    ok('RED: the negation without a search is refused',
      CG.consistencyProblems('لم أقف على نصٍّ له. والحكم العام كذا.', { ...base, searchProven: false })
        .includes(CG.PROBLEM.NEGATION_WITHOUT_SEARCH));
    ok('GREEN: the same sentence is fine once a search actually ran',
      !CG.consistencyProblems('لم أقف على نصٍّ له. والحكم العام كذا.', { ...base, searchProven: true })
        .includes(CG.PROBLEM.NEGATION_WITHOUT_SEARCH));
    ok('the operational-limit wording exists and does not claim an absence',
      /تعذّر استكمالُ البحث/.test(CG.SEARCH_NOT_COMPLETED) && !/لم أقف|لم أجد/.test(CG.SEARCH_NOT_COMPLETED));
    ok('the replacement reply makes no religious claim and no false negation',
      !/لم أجد|لم أقف|لم أعثر/.test(CG.NO_ATTRIBUTION_AVAILABLE)
      && /لا أنسبُ إلى هذا العالِم قولًا/.test(CG.NO_ATTRIBUTION_AVAILABLE));
    // A replacement that breaks the rule it enforces is not a replacement. This is the gate
    // turned on its own output, in the strictest state it can be asked about.
    eq('the replacement itself passes the gate it exists to satisfy',
      CG.consistencyProblems(CG.NO_ATTRIBUTION_AVAILABLE, {
        entity: 'ابن تيميه', notDirectlyVerified: true, searchProven: false, allowSourcedPosition: false,
      }), []);
    eq('...and so does the operational-limit wording',
      CG.consistencyProblems(CG.SEARCH_NOT_COMPLETED, {
        entity: 'ابن تيميه', notDirectlyVerified: true, searchProven: false, allowSourcedPosition: false,
      }), []);
  }

  // =========================================================================
  console.log('\n=== D. THE HANDLER IS WIRED TO THE GATE, NOT TO AN INSTRUCTION ===');
  {
    const s = read('api/ask.js');
    ok('the gate is imported', /import \{ consistencyProblems, NO_ATTRIBUTION_AVAILABLE \}/.test(s));
    ok('it runs on a BUFFERED draft — a streamed reply cannot be checked',
      /if \(legacyPolicy\.enabled && attributionUnverified\) \{[\s\S]{0,900}stream: false/.test(s));
    ok('a failing draft is dropped WHOLE, not edited down',
      /if \(attributionProblems\(bDraft\) \|\| !bDraft\) \{[\s\S]{0,300}return emitOnce\(NO_ATTRIBUTION_AVAILABLE\)/.test(s));
    ok('the gate sits BEFORE the streaming round 2',
      s.indexOf('const attributionProblems =') < s.indexOf('// ── ROUND 2: streamed, WITHOUT tools'));
    // ONE GATE, EVERY BUFFERED EXIT. The defect escaped through the exit nobody was watching —
    // round 1 answering without calling the search tool — so the count matters, not just presence.
    // THREE BUFFERED EXITS CAN CARRY A COMPLETE DRAFT IN THIS STATE, and all three are guarded:
    //   1. round 1 answering with no tool_use   — the exit the defect escaped through
    //   2. the specific-expression claim branch
    //   3. the forced buffer that replaces the streamed round 2
    // The streamed exit is unreachable here because (3) returns before it; the attributed-success
    // exit needs no gate because reaching it means a text of his WAS verified; and ABOUT_ENTITY
    // has its own violatesTemplate check and never sets attributionUnverified.
    const guardedExits = (s.match(/attributionProblems\(/g) || []).length;
    ok('every buffered exit that can carry a draft is guarded',
      guardedExits === 3, 'found ' + guardedExits + ' call sites');
    ok('the disclaimer is only set when a search actually ran',
      /if \(attributionSearched\) attributionNote = unattributedNote/.test(s));
    ok('searching his own corpus is what sets that flag',
      (s.match(/attributionSearched = true/g) || []).length === 2);
  }

  // =========================================================================
  console.log('\n=== E. THE PATH INDICATOR REFLECTS THE ENGINE THAT RAN ===');
  {
    const s = read('api/ask.js');
    ok('the indicator is derived from the SAME value the branch tests',
      /rfc-path=\$\{toLedger \? 'ledger' : 'legacy'\}/.test(s));
    ok('...and is emitted only while the mode is internal',
      /if \(envMode\(\) === 'internal'\) \{[\s\S]{0,200}rfc-path=/.test(s));
    ok('it is an SSE COMMENT, so no client behaviour changes',
      /res\.write\(`: rfc-path=/.test(s));
    ok('it carries no question, no credential, no reason code',
      !/rfc-path=[\s\S]{0,120}(reason|founder|question|token)/i.test(s));
    // The value cannot drift from the branch: both read `toLedger`, and `toLedger` has one source.
    ok('toLedger is assigned exactly once', (s.match(/const toLedger =/g) || []).length === 1);
  }

  // =========================================================================
  console.log('\n=== F. LIVE DRIVES THROUGH THE REAL HANDLER ===');
  {
    process.env.FOUNDER_SECRET = 'test-secret-for-the-consistency-gate';
    process.env.LEDGER_RAG = 'on';
    process.env.RFC_V05_LEGACY_POLICY = 'on';
    process.env.RFC_V05_MODE = 'internal';
    process.env.ANTHROPIC_API_KEY = 'test-key';
    delete process.env.DAILY_SEARCH_BUDGET;   // ledger stays off; this exercises the LEGACY path
    STORE.__setRedisForTest(null);

    const makeRes = () => ({
      writes: [], ended: 0,
      status() { return this; }, setHeader() { return this; }, flushHeaders() {},
      write(s) { this.writes.push(String(s)); return true; }, end() { this.ended += 1; return this; },
      json(o) { this.jsonBody = o; this.ended += 1; return this; },
    });
    const founder = DC.founderTokenFor(DEVICE);
    const makeReq = (text, prior = []) => ({
      method: 'POST',
      headers: { 'x-murabbi-device': DEVICE, 'x-murabbi-founder': founder },
      body: {
        system: 'أنت عزك', band: 'adult',
        messages: [...prior, { role: 'user', content: text }],
      },
    });
    const readerText = (res) => res.writes.join('')
      .split('data: ').filter(Boolean)
      .map((s) => { try { return JSON.parse(s.trim()); } catch { return null; } })
      .filter((p) => p && p.type === 'content_block_delta')
      .map((p) => p.delta.text).join('');
    const comments = (res) => res.writes.join('').split('\n').filter((l) => l.startsWith(': '));

    const realFetch = globalThis.fetch;
    // One scripted model reply for every model call, plus an empty retrieval so the attributed
    // route finds no text of his — which is the state the defect lives in.
    // `searchFirst` makes round 1 CALL the search tool before answering, which is the realistic
    // shape for a fiqh question: the tool runs, retrieval comes back empty, and the model then
    // drafts anyway. Without it round 1 answers straight from the model and a whole class of
    // gating never runs — which is itself the exit the defect escaped through.
    const install = (draft, searchFirst = false) => {
      let round = 0;
      globalThis.fetch = async (url, init) => {
        const u = String(url);
        if (u.includes('api.anthropic.com')) {
          const body = JSON.parse(init.body);
          const last = body.messages[body.messages.length - 1];
          const txt = typeof last.content === 'string' ? last.content : '';
          // The route classifier's own probe answers with a bare label.
          if (/GEN|DEEN/.test(txt) && txt.length < 400) {
            return { ok: true, status: 200, headers: { get: () => 'application/json' },
              json: async () => ({ content: [{ type: 'text', text: 'DEEN' }], stop_reason: 'end_turn' }) };
          }
          round += 1;
          if (searchFirst && round === 1) {
            return { ok: true, status: 200, headers: { get: () => 'application/json' },
              json: async () => ({
                content: [{ type: 'tool_use', id: 'tu_1', name: 'search_sources', input: { query: 'س' } }],
                stop_reason: 'tool_use',
              }) };
          }
          return { ok: true, status: 200, headers: { get: () => 'application/json' },
            json: async () => ({ content: [{ type: 'text', text: draft }], stop_reason: 'end_turn' }) };
        }
        // No Brave results and no pages: nothing of his is found, which is the defect's state.
        return { ok: true, status: 200, headers: { get: () => 'application/json' },
          json: async () => ({ web: { results: [] } }), text: async () => '' };
      };
    };

    const handler = (await esm('api/ask.js')).default;
    const drive = async (q, draft, prior = [], searchFirst = false) => {
      install(draft, searchFirst);
      const res = makeRes();
      await handler(makeReq(q, prior), res);
      return { text: readerText(res), res };
    };

    try {
      // ── THE RED FIXTURE, THROUGH THE HANDLER ───────────────────────────────
      const bad = await drive(Q_QADA, BAD_DRAFT);
      ok('RED: the served reply never reaches the reader',
        !/مجموع الفتاوى/.test(bad.text) && !/الأحوط أن تقضي/.test(bad.text), bad.text.slice(0, 220));
      ok('...and no assertion of his position survives',
        !/يرى ابن تيمية/.test(bad.text), bad.text.slice(0, 220));
      ok('...and the contradiction is impossible: no «لم أقف» beside a credit',
        !(/لم أقف/.test(bad.text) && /ابن تيمية (?:يرى|قال)/.test(bad.text)), bad.text.slice(0, 220));
      ok('...the reader gets the constrained reply instead',
        /لا أنسبُ إلى هذا العالِم قولًا/.test(bad.text), bad.text.slice(0, 220));
      eq('...and the stream closes exactly once', bad.res.ended, 1);

      // ── THE GREEN FIXTURE ──────────────────────────────────────────────────
      const good = await drive(Q_QADA, GOOD_DRAFT);
      ok('GREEN: a sourced grade-C transmission reaches the reader',
        /ذكر موقع إسلام ويب/.test(good.text), good.text.slice(0, 220));
      ok('...with no quotation of him', !/«[^»]{12,}»/.test(good.text), good.text.slice(0, 220));
      eq('...and the stream closes exactly once', good.res.ended, 1);

      // ── THE SAME, AFTER A PRIOR TURN (no conversation contamination) ────────
      const prior = [
        { role: 'user', content: 'ما رأي ابن باز في صلاة المسافر؟' },
        { role: 'assistant', content: 'جواب سابق.' },
      ];
      const badAfter = await drive(Q_QADA, BAD_DRAFT, prior);
      ok('RED holds inside a running thread too',
        !/مجموع الفتاوى/.test(badAfter.text) && /لا أنسبُ إلى هذا العالِم قولًا/.test(badAfter.text),
        badAfter.text.slice(0, 200));

      // ── THE PATH INDICATOR, AGAINST THE ENGINE THAT ACTUALLY RAN ───────────
      ok('the indicator says legacy when the ledger did not run',
        comments(bad.res).some((l) => l.includes('rfc-path=legacy')), comments(bad.res).join(' | '));
      ok('...and it never leaks a reason code or a credential',
        !comments(bad.res).some((l) => /founder|reason|token|budget/i.test(l)));

      // ── «يا معطي لا تبطي» — nothing may be invented ────────────────────────
      // Driven the realistic way: the search tool IS called and retrieval comes back empty, so the
      // claim layer has a verdict to reach rather than being skipped entirely.
      const dua = await drive(Q_DUA,
        'هذا اللفظ ورد في حديث صحيح رواه البخاري، ومن قاله فقد وقع في الشرك الأكبر.', [], true);
      ok('a specific expression with NO matching evidence gets no fabricated hadith',
        !/رواه البخاري/.test(dua.text), dua.text.slice(0, 220));
      ok('...and no ruling of shirk is pronounced on it unsourced',
        !/الشرك الأكبر/.test(dua.text), dua.text.slice(0, 220));
      eq('...and the stream still closes exactly once', dua.res.ended, 1);

      // ── مطلق الجاسر — a clear name, searched first, never credited unsourced ─
      const mutlaq = await drive(Q_MUTLAQ, 'قال الشيخ مطلق الجاسر إنّ ذلك جائز.');
      ok('a contemporary is not credited without a primary source',
        !/قال الشيخ مطلق الجاسر/.test(mutlaq.text), mutlaq.text.slice(0, 200));
      eq('...and the stream closes exactly once', mutlaq.res.ended, 1);

      // ── the ABOUT question must not regress to the identity template ───────
      const about = await drive(Q_AHLSUNNA, 'ذكرت المصادر أنّ له اختيارات تفرّد بها، وأنّه من أئمة أهل السنة.');
      ok('«هل خالف …» never returns the «لم أتبيّن أي شيخ» template',
        !/لم أتبيّنْ أيَّ شيخٍ تقصد/.test(about.text), about.text.slice(0, 200));
      eq('...and the stream closes exactly once', about.res.ended, 1);
    } finally {
      globalThis.fetch = realFetch;
      STORE.__resetRedis();
      delete process.env.RFC_V05_MODE;
      delete process.env.LEDGER_RAG;
      delete process.env.RFC_V05_LEGACY_POLICY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.FOUNDER_SECRET;
    }
  }

  console.log('\n' + (failures ? 'FAIL ' : 'PASS ') + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
