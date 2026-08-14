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
const parser = require('@babel/parser');
const { withRestoredProcessEnv } = require('../tools/guard-env.cjs');

const ENV_KEYS = ['FOUNDER_SECRET', 'LEDGER_RAG', 'RFC_V05_LEGACY_POLICY',
  'RFC_V05_MODE', 'ANTHROPIC_API_KEY'];

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

function ledgerBranchBody(src) {
  const ast = parser.parse(src, { sourceType: 'module' });
  const stack = [ast.program];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (node.type === 'IfStatement'
      && src.slice(node.test.start, node.test.end).replace(/\s+/g, ' ').trim()
        === "ledgerPath.path === 'ledger'") {
      return src.slice(node.consequent.start, node.consequent.end);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (let i = value.length - 1; i >= 0; i--) stack.push(value[i]);
      } else if (value && typeof value === 'object' && typeof value.type === 'string') {
        stack.push(value);
      }
    }
  }
  return null;
}

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

async function main() {
  console.log('=== rfc-v05r2-consistency-guard — credited and disclaimed cannot both be true ===');

  const CG = await esm('lib/policy/consistency-gate.js');
  const DC = await esm('lib/daycap.js');
  const STORE = await esm('lib/ledger/redis.js');
  const SA = await esm('lib/policy/source-attribution.js');
  const deliveredTransmissionPages = [{
    url: 'https://islamqa.info/ar/answers/064',
    text: 'ذكر المصدر أن شيخ الإسلام ابن تيمية يرى عدم مشروعية القضاء.',
  }];
  const deliveredTransmissionLicence = SA.attributionLicence(deliveredTransmissionPages);
  ok('the historical licence used by GREEN fixtures is derived from delivered page evidence',
    JSON.stringify(deliveredTransmissionLicence.personIds) === JSON.stringify(['ibn-taymiyyah'])
      && deliveredTransmissionLicence.pages[0].class === SA.ATTRIBUTION_SOURCE_CLASS.NAME_IN_TEXT,
    JSON.stringify(deliveredTransmissionLicence));

  // =========================================================================
  console.log('\n=== A. WHICH ENGINE PRODUCED THE DEFECT — ESTABLISHED, NOT ASSUMED ===');
  {
    const askSrc = read('api/ask.js');
    ok('the disclaimer exists only in the legacy branch of api/ask.js',
      /unattributedNote\(/.test(askSrc));
    const ledgerDir = fs.readdirSync(path.join(REPO, 'lib', 'ledger'));
    ok('...and in no ledger module at all',
      ledgerDir.every((f) => !/unattributedNote|لم أقف على/.test(read('lib/ledger/' + f))));
    // BOUNDED BY THE IF NODE, NOT BY AN INDENTATION GUESS OR A BYTE WINDOW. A nested block may
    // close thousands of characters before this branch does, so Babel's brace-balanced range is
    // the stable unit the assertion is about.
    const tail = ledgerBranchBody(askSrc);
    ok('the ledger branch returns unconditionally — there is no fallback to legacy',
      typeof tail === 'string' && /\n      return;\n/.test(tail)
      && !/catch[\s\S]{0,400}legacy/i.test(tail));

    const longFixture = `async function fixture() {
      if (ledgerPath.path === 'ledger') {
        if (nested) {
          nestedWork();
        }
        /* ${'padding '.repeat(650)} */
        return;
      }
      legacyFallback();
    }`;
    const longTail = ledgerBranchBody(longFixture);
    ok('a ledger branch longer than 4000 characters is still decided by its own braces',
      typeof longTail === 'string' && longTail.length > 4000
      && /return;/.test(longTail) && !/legacyFallback/.test(longTail),
      longTail === null ? 'branch not found' : 'length=' + longTail.length);
  }

  // =========================================================================
  console.log('\n=== B. THE GATE ITSELF — RED on the served reply, GREEN on the sourced one ===');
  {
    const ctx = {
      entity: 'ابن تيميه', notDirectlyVerified: true, searchProven: false,
      allowSourcedPosition: true, sourceLicence: deliveredTransmissionLicence.personIds,
    };
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
      CG.consistencyProblems(BAD_DRAFT, {
        entity: 'ابن تيميه', notDirectlyVerified: false, searchProven: true,
        sourceLicence: deliveredTransmissionLicence.personIds,
      }), []);
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
    // RE-PINNED ON THE STRONGER CONDITION, AND THE OLD ASSERTION IS KEPT INSIDE IT. The text used
    // to be pinned as «لا أنسبُ إلى هذا العالِم قولًا», which is the defect: that sentence was
    // served for a singer and for a comic actor, granting each of them the standing it was
    // declining to act on. The pin still requires the refusal-to-attribute clause — it simply
    // requires it to name NOBODY, which the old form could not satisfy.
    ok('the replacement reply makes no religious claim and no false negation',
      !/لم أجد|لم أقف|لم أعثر/.test(CG.NO_ATTRIBUTION_AVAILABLE)
      && /لا أنسبُ قولًا في هذه المسألة إلى أحدٍ/.test(CG.NO_ATTRIBUTION_AVAILABLE));
    ok('RED→GREEN: the replacement confers no scholarly standing on anybody',
      !/هذا العالِم|هذا العالم|هذا الشيخ|الشيخ المذكور/.test(CG.NO_ATTRIBUTION_AVAILABLE));
    ok('...and neither does the ABOUT_ENTITY refusal in the handler',
      !/لا أنسب إلى العالِم قولًا/.test(read('api/ask.js'))
      && /لا أنسب إلى أحدٍ قولًا لم أقف عليه في نصٍّ له/.test(read('api/ask.js')));
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
    // RE-PINNED ON THE STRONGER CONDITION. The constrained reply is now wrapped in withPresence(),
    // which prepends «لا أعرف هذا الاسم» when the question hung on a name no registry knows and no
    // page carries — measured on the live service, where the bare refusal left the reader holding
    // the premise that there was somebody to attribute to. The verdict being pinned is unchanged:
    // a draft whose offence is the substance is dropped WHOLE and replaced. Nothing of the draft
    // survives either way, which the next assertion states directly.
    // RE-PINNED ON THE STRONGER CONDITION, ASSERTION KEPT. The replacement is no longer a single
    // constant: batch 5 added a second failure — a draft whose every RULING rests on no page we
    // fetched — and that one is answered by NO_VERIFIED_SOURCE_MESSAGE, which says no ruling is
    // given without a source, rather than by a sentence about an attribution nobody asked for.
    // The invariant being pinned is UNCHANGED and now stated where it actually lives: every
    // buffered exit refuses whole on `dropWhole`, and every one of them takes its wording from
    // the ONE decision that chooses between the two refusals. An exit that hard-codes either
    // constant is an exit that will not pick up the next one.
    ok('the choice of refusal is made in one place, and reads the ruling verdict',
      /const refusalFor = \(verdict\) =>[\s\S]{0,200}rulingUnsourced\)\s*\?\s*NO_VERIFIED_SOURCE_MESSAGE\s*:\s*NO_ATTRIBUTION_AVAILABLE/.test(s));
    ok('a draft whose offence is the SUBSTANCE is still dropped whole',
      /if \(!bDraft \|\| \(bScreened && bScreened\.dropWhole\)\) \{[\s\S]{0,400}return emitOnce\(withPresence\(refusalFor\(bScreened\)\)\)/.test(s));
    ok('...and every buffered exit honours the same verdict',
      (s.match(/\.dropWhole\) return emitOnce\(withPresence\(refusalFor\(|dropWhole\)\) \{/g) || []).length >= 3,
      'a screened exit that ignores dropWhole is an exit with no gate');
    ok('...and the replacement is never emitted bare — every exit carries the name verdict with it',
      !/emitOnce\(NO_ATTRIBUTION_AVAILABLE\)/.test(s)
      && !/emitOnce\(NO_VERIFIED_SOURCE_MESSAGE\)/.test(s)
      && (s.match(/emitOnce\(withPresence\(refusalFor\([a-zA-Z]+\)\)\)/g) || []).length === 3);
    ok('...and no buffered exit still hard-codes a refusal past the one decision',
      (s.match(/dropWhole\)[\s\S]{0,80}?withPresence\(NO_(?:ATTRIBUTION_AVAILABLE|VERIFIED_SOURCE_MESSAGE)\)/g) || []).length === 0);
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
      /if \(attributionUnverified && trustedReaderEntity && !attributionSearched && !unregisteredName\)[\s\S]{0,1800}?await retrieve\(/.test(s),
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
      /if \(attributionUnverified && trustedReaderEntity && !attributionSearched && !unregisteredName\)/.test(s));
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
      sourceLicence: deliveredTransmissionLicence.personIds,
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
        /لا أنسبُ قولًا في هذه المسألة إلى أحدٍ/.test(bad.text), bad.text.slice(0, 220));
      eq('...and the stream closes exactly once', bad.res.ended, 1);

      // ── THE GREEN FIXTURE, RE-PINNED ON THE STRONGER CONDITION ─────────────
      //
      // This drive used to assert that GOOD_DRAFT reaches the reader, and it passed for a reason
      // the fixture never intended: the harness returns NO Brave results and NO pages, so the
      // reply naming «رأي ابن تيمية» was serving a transmission from a result set that was empty.
      // The batch-3 source-class rule (lib/policy/source-attribution.js) refuses exactly that —
      // a man may be named only when a page in hand names him — so with nothing retrieved the
      // correct outcome here is the constrained reply, not the transmission.
      //
      // THE ASSERTION IS NOT DELETED, IT IS MOVED TO WHERE IT IS TRUE. That a well-formed grade-C
      // transmission passes the gate is still pinned, twice: once in section D against
      // `consistencyProblems` directly, and once below with a licence in hand — which is the state
      // production is in whenever this branch actually has pages to draft over.
      const good = await drive(Q_QADA, GOOD_DRAFT);
      ok('GREEN: with NO page retrieved, even a well-formed transmission is refused',
        /لا أنسبُ قولًا في هذه المسألة إلى أحدٍ/.test(good.text), good.text.slice(0, 220));
      ok('...and it is not replaced by a quotation of him', !/«[^»]{12,}»/.test(good.text), good.text.slice(0, 220));
      ok('...and the same draft passes the gate once a page licenses him',
        CG.consistencyProblems(GOOD_DRAFT, {
          entity: 'ابن تيميه', notDirectlyVerified: true, searchProven: true,
          allowSourcedPosition: true, sourceLicence: ['ibn-taymiyyah'],
        }).length === 0);
      eq('...and the stream closes exactly once', good.res.ended, 1);

      // ── THE SAME, AFTER A PRIOR TURN (no conversation contamination) ────────
      const prior = [
        { role: 'user', content: 'ما رأي ابن باز في صلاة المسافر؟' },
        { role: 'assistant', content: 'جواب سابق.' },
      ];
      const badAfter = await drive(Q_QADA, BAD_DRAFT, prior);
      ok('RED holds inside a running thread too',
        !/مجموع الفتاوى/.test(badAfter.text) && /لا أنسبُ قولًا في هذه المسألة إلى أحدٍ/.test(badAfter.text),
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
  return failures ? 1 : 0;
}

withRestoredProcessEnv(ENV_KEYS, main).then((code) => {
  process.exitCode = code;
}).catch((e) => { console.error(e); process.exitCode = 1; });
