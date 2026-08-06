// guards/ruling-source-guard.cjs — A RULING COMES FROM A PAGE, OR IT DOES NOT GO OUT.
//
// ── THE MEASURED FAILURE ─────────────────────────────────────────────────────
// «ذهب إلى المسجد فهل يصح؟» was answered with
//
//     «يجب الطهور قبل دخول المسجد»
//
// over a single source card whose page is titled about الحائض and carries no such clause
// anywhere. That is a ruling issued by the application itself, wearing a citation.
//
// ── WHY EVERY EXISTING GUARD MISSED IT ───────────────────────────────────────
// It is a WHOLE CLASS with nothing watching it:
//   * it attributes nothing to a named man, so the source-class rule of batch 3 never fires —
//     there is no name in the sentence to police;
//   * it quotes no hadith, so the takhrij lock of batch 2 never fires;
//   * it prefers no qawl over another, so TARJIH_WITHOUT_EVIDENCE never fires;
//   * the page is on the allow-list, extracted cleanly and cleared every page gate.
// Every check in the building asked a question about the SOURCE or about a NAME. None asked
// the one that matters here: does the page in hand actually say this?
//
// ── THE RULE ─────────────────────────────────────────────────────────────────
// A sentence carrying a RULING WORD — يجب · لا يجوز · يحرم · يُشترط · لا يصح · مباح · مكروه ·
// سنّة — must have its pivot terms present in the text extracted from a page we fetched.
// Not found ⟹ that sentence is dropped and the rest of the answer stands. Every
// ruling-bearing sentence dropped ⟹ the reply is the «no verified source» text rather than a
// composed answer.
//
// ── AND WHAT IS DELIBERATELY OUTSIDE IT ──────────────────────────────────────
// The FROZEN texts — the description of the acts of worship, the adhkār and the āyāt. Their
// attribution is pinned in the golden file and its own guard, they are transmitted verbatim
// rather than drafted, and holding «سنة» inside a dhikr to a retrieved web page would refuse
// the one category whose provenance is the most certain thing in the repository.
//
// Usage: node guards/ruling-source-guard.cjs
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

// ── THE FIXTURES, verbatim from the incident ────────────────────────────────
// A page about the menstruating woman. It does NOT contain «الطهور», and it is the only page
// the reply had in hand.
const HAIDH_PAGE =
  'أحكام الحائض: لا تصوم الحائض ولا تصلي حال حيضها، وتقضي الصوم دون الصلاة. '
  + 'واختلف أهل العلم في مكثها في المسجد، فمنعه الجمهور وأجاز بعضهم المرور. '
  + 'وإذا انقطع دمها اغتسلت وعادت إلى عبادتها.';
// The invented clause.
const INVENTED_RULING = 'يجب الطهور قبل دخول المسجد.';
// A ruling that IS written out on its page, in the page's own words.
const QASR_PAGE =
  'حكم قصر الصلاة في السفر: يجب على المسافر أن يقصر الصلاة الرباعية إلى ركعتين عند الحنفية، '
  + 'وهو سنة مؤكدة عند الجمهور، ويبدأ القصر بمفارقة عمران البلد.';
const SOURCED_RULING = 'يجب على المسافر أن يقصر الصلاة الرباعية إلى ركعتين.';
// A framing sentence: it carries no ruling at all and must survive untouched.
const FRAMING = 'هذه المسألة مما تكلم فيه أهل العلم، وإليك ما ورد في المصدر المذكور.';

(async function main() {
  console.log('=== ruling-source-guard — a ruling comes from a page, or it does not go out ===');

  let CG = null;
  try { CG = await esm('lib/policy/consistency-gate.js'); }
  catch (e) {
    ok('lib/policy/consistency-gate.js loads', false, e.message);
    console.log('\n=== ' + (checks - failures) + '/' + checks + ' — FAIL ===');
    process.exit(1);
  }

  // The screen this rule lives in is THE EXISTING ONE. A second deterministic screen beside it
  // is two screens that can disagree about the same draft.
  console.log('\n=== A. IT IS PART OF THE EXISTING SCREEN, NOT A SECOND ONE ===');
  ok('the problem code is declared', CG.PROBLEM && !!CG.PROBLEM.RULING_WITHOUT_SOURCE);
  ok('exports carriesRuling()', typeof CG.carriesRuling === 'function');
  ok('no second screen module was created beside it',
    !fs.existsSync(path.join(REPO, 'lib/policy/ruling-gate.js'))
    && !fs.existsSync(path.join(REPO, 'lib/ruling-source.js')));

  // The rule is ARMED BY THE CALLER SUPPLYING THE PAGES, exactly like the ترجيح rule. An absent
  // `pageTexts` means "this caller is not wired yet" and must change nothing at all.
  console.log('\n=== B. UNWIRED CALLERS ARE UNAFFECTED ===');
  {
    const p = CG.consistencyProblems(INVENTED_RULING, {});
    ok('with NO pageTexts the rule does not fire',
      !p.includes(CG.PROBLEM.RULING_WITHOUT_SOURCE), JSON.stringify(p));
  }

  console.log('\n=== C. THE MEASURED INCIDENT ===');
  {
    const p = CG.consistencyProblems(INVENTED_RULING, { pageTexts: [HAIDH_PAGE] });
    ok('«يجب الطهور قبل دخول المسجد» over a page about الحائض is refused',
      p.includes(CG.PROBLEM.RULING_WITHOUT_SOURCE), JSON.stringify(p));
  }
  {
    const p = CG.consistencyProblems(SOURCED_RULING, { pageTexts: [QASR_PAGE] });
    ok('a ruling WRITTEN OUT on the page stands',
      !p.includes(CG.PROBLEM.RULING_WITHOUT_SOURCE), JSON.stringify(p));
  }
  {
    const p = CG.consistencyProblems(FRAMING, { pageTexts: [HAIDH_PAGE] });
    ok('a framing sentence carries no ruling and is not measured',
      !p.includes(CG.PROBLEM.RULING_WITHOUT_SOURCE), JSON.stringify(p));
    ok('...and carriesRuling() says so', CG.carriesRuling(FRAMING) === false);
    ok('...while carriesRuling() does see the invented clause',
      CG.carriesRuling(INVENTED_RULING) === true);
  }
  {
    // NO PAGES AT ALL is the strongest form of the same thing: there is nothing a ruling could
    // have come from. An EMPTY ARRAY is "we retrieved nothing", not "the caller is unwired".
    const p = CG.consistencyProblems(SOURCED_RULING, { pageTexts: [] });
    ok('with zero pages retrieved, every ruling is unsourced',
      p.includes(CG.PROBLEM.RULING_WITHOUT_SOURCE), JSON.stringify(p));
  }

  console.log('\n=== D. THE SENTENCE GOES, THE ANSWER STAYS ===');
  {
    const draft = FRAMING + ' ' + SOURCED_RULING + ' ' + INVENTED_RULING;
    const v = CG.screenDraft(draft, { pageTexts: [QASR_PAGE] });
    ok('the invented clause is dropped',
      v.droppedSentences.some((s) => s.includes('الطهور')), JSON.stringify(v.droppedSentences));
    ok('...and the sourced ruling survives', v.text.includes('المسافر'), v.text);
    ok('...and the framing sentence survives', v.text.includes('أهل العلم'), v.text);
    ok('...and the whole draft is NOT thrown away', v.dropWhole === false, JSON.stringify(v));
    ok('...and the reply is not reduced to the no-source text',
      v.rulingUnsourced !== true, JSON.stringify(v.rulingUnsourced));
  }

  console.log('\n=== E. EVERY RULING GONE ⟹ THE NO-SOURCE TEXT, NOT A COMPOSED ANSWER ===');
  {
    const draft = FRAMING + ' ' + INVENTED_RULING;
    const v = CG.screenDraft(draft, { pageTexts: [HAIDH_PAGE] });
    ok('every ruling-bearing sentence was dropped',
      v.problems.includes(CG.PROBLEM.RULING_WITHOUT_SOURCE), JSON.stringify(v.problems));
    ok('...so the draft is refused whole', v.dropWhole === true, JSON.stringify(v));
    ok('...and it is flagged as a RULING failure, so the caller can say «no source» '
      + 'rather than «I attribute nothing to anyone»',
      v.rulingUnsourced === true, JSON.stringify(v));
  }

  console.log('\n=== E2. AN ATTRIBUTION FAILURE STILL ANSWERS AS AN ATTRIBUTION FAILURE ===');
  {
    // The reader asked about a MAN and the draft credits him with a ruling over nothing at all.
    // Both rules fire. The refusal he needs is the one that explains the attribution and offers
    // the ruling from its own sources — not the generic «no source», which would drop the only
    // part of the reply that speaks to what he actually asked.
    const draft = 'يرى الشيخ فلان الفلاني أنّ قصر الصلاة واجب على المسافر.';
    const v = CG.screenDraft(draft, {
      entity: 'فلان الفلاني', notDirectlyVerified: true, searchProven: false,
      subjectEntity: 'فلان الفلاني', pageTexts: [],
    });
    ok('the draft is refused', v.dropWhole === true, JSON.stringify(v));
    ok('...and it is NOT reported as a bare no-source failure, because it is also an attribution one',
      v.rulingUnsourced === false, JSON.stringify(v.problems));
    ok('...and the attribution problem is the one recorded',
      v.problems.includes(CG.PROBLEM.POSITION_WITHOUT_EVIDENCE), JSON.stringify(v.problems));
  }

  console.log('\n=== F. THE FROZEN TEXTS ARE OUTSIDE IT, WHOLLY ===');
  {
    // An āyah. Rulings are legislated IN the Book; a verse is not held to a fetched web page.
    const ayah = 'قال الله تعالى: ﴿وَأَحَلَّ اللَّهُ الْبَيْعَ وَحَرَّمَ الرِّبَا﴾.';
    const p = CG.consistencyProblems(ayah, { pageTexts: [HAIDH_PAGE] });
    ok('an āyah carrying «حرم» is not measured against a retrieved page',
      !p.includes(CG.PROBLEM.RULING_WITHOUT_SOURCE), JSON.stringify(p));
  }
  {
    const F = await esm('lib/frozen-text.js');
    // Drive it from the corpus itself rather than from a phrase typed here, so the exemption
    // cannot drift away from what the frozen index actually holds.
    const ADHKAR = JSON.parse(read('adhkar.json'));
    const items = Array.isArray(ADHKAR) ? ADHKAR : (ADHKAR.items || ADHKAR.adhkar || []);
    const withRuling = [];
    for (const it of items) {
      const txt = String((it && (it.text || it.body || it.dhikr)) || '');
      if (txt && CG.carriesRuling(txt) && F.containsFrozenPhrase(txt)) withRuling.push(txt);
      if (withRuling.length >= 3) break;
    }
    if (withRuling.length) {
      const bad = withRuling.filter((t) =>
        CG.consistencyProblems(t, { pageTexts: [HAIDH_PAGE] }).includes(CG.PROBLEM.RULING_WITHOUT_SOURCE));
      ok('no dhikr in the frozen corpus is refused for lacking a web page',
        bad.length === 0, JSON.stringify(bad.slice(0, 1)));
    } else {
      ok('(no dhikr in the corpus carries a ruling word — nothing to exempt)', true);
    }
    ok('the module consults the frozen index rather than a hand-written list',
      /frozen-text\.js/.test(read('lib/policy/consistency-gate.js')),
      'the exemption must be read from lib/frozen-text.js');
  }

  console.log('\n=== G. IT IS WIRED INTO EVERY BUFFERED DRAFT IN api/ask.js ===');
  {
    const ask = read('api/ask.js');
    ok('the screen is handed the pages it fetched', /pageTexts:/.test(ask));
    ok('the no-source outcome is acted on rather than logged',
      /rulingUnsourced/.test(ask), 'api/ask.js must read verdict.rulingUnsourced');
    // The reply in that case is the NO-SOURCE text, which makes no religious claim, and NOT the
    // attribution replacement, which is about a person nobody asked about here.
    ok('...and the wording chosen is the no-verified-source message',
      /rulingUnsourced\)\s*\?\s*NO_VERIFIED_SOURCE_MESSAGE\s*:\s*NO_ATTRIBUTION_AVAILABLE/.test(ask),
      'the no-source branch must emit NO_VERIFIED_SOURCE_MESSAGE');
    // THE CHOICE IS MADE IN ONE PLACE AND USED AT EVERY EXIT. Three buffered exits screen a
    // draft; every one of them must route its dropWhole refusal through that one decision, or
    // the exit that did not is the exit the next incident escapes through.
    const uses = (ask.match(/refusalFor\(/g) || []).length;
    ok('...at every one of the three buffered exits',
      uses >= 3, 'found ' + uses + ' call site(s) of refusalFor(');
    const bare = (ask.match(/dropWhole\)\s*return emitOnce\(withPresence\(NO_ATTRIBUTION_AVAILABLE/g) || []).length;
    ok('...and no buffered exit still hard-codes the attribution refusal',
      bare === 0, 'found ' + bare + ' un-routed exit(s)');
  }

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL ===' : ' — PASS ==='));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
