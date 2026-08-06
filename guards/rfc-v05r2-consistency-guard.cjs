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
    // WINDOWED TO THE BRANCH, NOT TO A BYTE COUNT. A fixed 2600-character slice made this pin a
    // hostage to how much PROSE the branch carries: documenting why a child's fourth domain must
    // be passed pushed the `return;` out of the window and turned a green invariant red without
    // anything about the invariant changing. The window now ends where the branch does.
    const branchAt = askSrc.indexOf("if (ledgerPath.path === 'ledger') {");
    const branchEnd = askSrc.indexOf('\n    }\n', branchAt);
    // +6 so the slice includes the branch's own closing line: the `return;` sits on the last line
    // before it, and cutting exactly at the brace leaves the match without its trailing newline.
    const tail = askSrc.slice(branchAt, branchEnd > branchAt ? branchEnd + 6 : branchAt + 4000);
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
    ok('the gate is imported', /import \{ consistencyProblems, screenDraft, NO_ATTRIBUTION_AVAILABLE \}/.test(s));
    // RE-PINNED ON THE STRONGER CONDITION. The buffering used to be conditional on the rollout
    // flag as well; with the flag default-OFF, fresh production streamed this state unchecked —
    // which is the exact failure the gate exists to prevent, shipped behind a switch. Buffering is
    // now armed by the state alone. The assertion is kept and tightened, never dropped.
    ok('it runs on a BUFFERED draft — a streamed reply cannot be checked',
      /if \(attributionUnverified\) \{[\s\S]{0,900}stream: false/.test(s));
    ok('...and no rollout flag can leave that state streaming',
      !/if \(legacyPolicy\.enabled && attributionUnverified\) \{/.test(s));
    // RE-PINNED, AND THE RULE IS NOW SHARPER RATHER THAN LOOSER. «Dropped whole» was the right
    // answer to the failure it was written for — the reader asked what Ibn Taymiyyah held, and a
    // reply that credits him unverified has nothing left once the credit is gone. It was the wrong
    // answer to one invented clause inside an otherwise sourced ruling, where it cost the reader
    // the answer he came for. So: dropped whole when the attribution IS the substance, trimmed
    // when it is an aside — and `screenDraft` decides which by whether the offending sentence
    // names the man the reader actually asked about.
    ok('a draft whose offence is the SUBSTANCE is still dropped whole',
      /if \(!bDraft \|\| \(bScreened && bScreened\.dropWhole\)\) \{[\s\S]{0,400}return emitOnce\(NO_ATTRIBUTION_AVAILABLE\)/.test(s));
    ok('...and every buffered exit honours the same verdict',
      (s.match(/\.dropWhole\) return emitOnce\(NO_ATTRIBUTION_AVAILABLE\)|dropWhole\)\) \{/g) || []).length >= 3,
      'a screened exit that ignores dropWhole is an exit with no gate');
    {
      const CGm = require('path').join(REPO, 'lib/policy/consistency-gate.js');
      const src = fs.readFileSync(CGm, 'utf8');
      ok('the trim is sentence-level, not a substring edit of the claim',
        /const SENTENCE_SPLIT =/.test(src) && /kept\.join\(' '\)/.test(src),
        'editing inside a sentence leaves the same claim in a shorter form');
    }
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
    // THREE PLACES SEARCH, AND ONLY THEY MAY SET THE FLAG: the purpose-built adapter, the
    // scholar's own official domain, and the encyclopedic pass over the band's approved list that
    // a historical scholar reaches because he has neither of the first two. A fourth assignment
    // would mean something claimed to have searched without searching.
    const searchSites = (s.match(/attributionSearched = true/g) || []).length;
    ok('exactly the three searching branches set the searched flag',
      searchSites === 3, 'found ' + searchSites + ' assignments');
  }

  // =========================================================================
  console.log('\n=== D2. SEARCH BEFORE APOLOGISING — the encyclopedic transmission ===');
  {
    const s = read('api/ask.js');
    // STRONGER AGAIN. «Historical» was only ever a description of the state that matters — no
    // adapter, no official domain, nothing searched — and an unregistered contemporary name lands
    // in exactly the same state. It used to be sent away with the identity template instead.
    ok('ANY named entity whose own corpus was never searched still gets a real search',
      /if \(attributionUnverified && plan\.namedEntity && !attributionSearched && !nonScholar\)[\s\S]{0,1800}?await retrieve\(/.test(s),
      'the fallback must call retrieve, not fall straight through to a refusal');
    ok('...and a historical scholar is inside that set, not a special case for it',
      !/plan\.authorityEra === 'historical'\s*\n?\s*&& plan\.namedEntity\) \{/.test(s));
    ok('...over the band\'s ordinary approved list, not a new one',
      /retrieve\(encQuery, \{ band, depth: effectiveDepth \}\)/.test(s),
      'no onlySites: narrowing to a domain a historical scholar does not have is the original bug');
    ok('...with the reader\'s own sentence as the query, so the NAME is bound into it',
      /const asked = lastUserText\(body\.messages\)/.test(s));
    ok('the draft it produces is checked by the SAME gate',
      /transmissionPublishers: encyclopedicPublishers/.test(s));
    ok('...and the publishers come from the pages actually fetched',
      /encyclopedicPublishers = \[\.\.\.new Set\(cards\.flatMap/.test(s));
    // RE-PINNED ON THE STRONGER CONDITION. «search before apologising» was itself behind the
    // rollout flag, so fresh production went on apologising unsearched — the defect this branch
    // was written to fix, still being served. Searching before refusing is not a staged feature.
    ok('the branch runs on the STATE alone, with no rollout flag in front of it',
      /if \(attributionUnverified && plan\.namedEntity && !attributionSearched && !nonScholar\)/.test(s));
    ok('...and no flag can send it back to apologising unsearched',
      !/legacyPolicy\.enabled && attributionUnverified/.test(s));
    // A SEARCH THAT RAN IS ALSO A NOTE THAT MAY BE WRITTEN. The note is composed here rather than
    // before the search, where it would have been a claim about work not yet done.
    ok('...and the earned note is set by the branch that earned it',
      /attributionSearched = true;\s*\n\s*attributionNote = unattributedNote\(plan\.namedEntity\);/.test(s));
    // THE SEARCH IS NOT A LICENCE TO TRANSMIT. A name no registry recognises returns pages about
    // the TOPIC, and drafting «بحسب موقع كذا فإنّ رأيه هو…» over them credits an unidentified man
    // with a position no source ascribed to him — which the gate cannot catch, because it can
    // check that a publisher was named and not that the publisher mentioned him.
    ok('...but only a RECOGNISED entity may have a position transmitted to him',
      /const mayTransmitPosition = !!plan\.requestedAuthorityId \|\| plan\.authorityEra === 'historical';/.test(s)
      && /if \(encSources\.length && mayTransmitPosition\)/.test(s));
    ok('the instruction forbids direct speech and demands the source be named',
      /صُغْه بأسلوبِ النقلِ الموثَّق/.test(s) && /ممنوعٌ إيرادُ اقتباسٍ حرفيٍّ/.test(s));

    // The gate's own behaviour for this state, asserted directly.
    const pubs = ['islamqa.info', 'الإسلام سؤال وجواب'];
    const ctx = {
      entity: 'ابن تيميه', notDirectlyVerified: true, searchProven: true,
      allowSourcedPosition: true, transmissionPublishers: pubs,
    };
    eq('GREEN: a transmission that NAMES the publisher passes',
      CG.consistencyProblems(
        'بحسب ما نقله ووثَّقه موقع الإسلام سؤال وجواب المعتمد، فإنّ رأي ابن تيمية هو عدم مشروعية القضاء.', ctx), []);
    ok('RED: a transmission frame with NO publisher named is refused',
      CG.consistencyProblems('ذكرت بعض المواقع أنّ ابن تيمية يرى عدم القضاء.', ctx)
        .includes(CG.PROBLEM.POSITION_WITHOUT_EVIDENCE),
      'a frame with nobody in it cites nothing the reader can check');
    ok('RED: speech is still refused even with the publisher named',
      CG.consistencyProblems(
        'ذكر موقع الإسلام سؤال وجواب أنّ ابن تيمية قال بعدم القضاء.', ctx)
        .includes(CG.PROBLEM.SPEECH_WITHOUT_EVIDENCE));
    ok('RED: a quotation of him is still refused even with the publisher named',
      CG.consistencyProblems(
        'نقل موقع الإسلام سؤال وجواب عن ابن تيمية «ومن ترك الصلاة عمدًا فلا يشرع له قضاؤها».', ctx)
        .includes(CG.PROBLEM.QUOTE_WITHOUT_EVIDENCE));
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
    // THIS SECTION EXERCISES THE LEGACY PATH, so the ledger is switched off — explicitly.
    //
    // It used to be switched off by DELETING the daily search budget, which worked only as a
    // side effect: an unconfigured spend cap made decidePath() refuse the ledger. The public
    // go-live (lib/ledger/flag.js PUBLIC_GO_LIVE, 2026-08-05) gave the budget a default, so
    // that lever silently stopped working and every drive below took the ledger instead — which
    // is how a harness detail turns into four failing assertions about somebody's prose.
    //
    // `LEDGER_RAG=off` is the documented floor and says what it means. RFC_V05_MODE stays
    // 'internal' on purpose: the `: rfc-path=` indicator is only emitted in that mode, and one
    // of the assertions below is that it reads `legacy` when the ledger did not run.
    process.env.LEDGER_RAG = 'off';
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
      headers: { 'x-murabbi-device': DEVICE, 'x-murabbi-founder': founder, 'x-ezik-ai-consent': '2026-08-06-1' }, /* consented client (lib/ai-consent.js); the refusal is proved in tools/ai-consent-probe.cjs */
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
