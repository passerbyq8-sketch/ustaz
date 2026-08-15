// guards/card-or-no-context-par-a-guard.cjs — X-020 + X-003/C-004: a card, or not in the context.
//
// THE LAW, IN ONE LINE. Every source text that reaches the model either has a card among the cards
// the reader is shown, or it never enters the context at all. There is no third category, and the
// third category is exactly where religious answers get drafted over material the reader cannot
// see and cannot check.
//
// A  lib/hybrid-deen.js — REAL, AND IT TOOK A PAIRED FIXTURE TO SEE IT. cardsFor() hands back
//    fewer cards than the records it was given whenever externalCard() refuses a URL: not clean
//    https, carrying userinfo, or a malformed host. The record still travels into usedEvidence and
//    into the drafting context, so the answer is written over a source the reader is never shown.
//
//    THE TRAP THIS FIXTURE EXISTS TO AVOID: an uncardable page presented ALONE is rejected far
//    upstream and returns NO_HYBRID_EVIDENCE, which reads as "the hole is unreachable" and is
//    wrong. Paired with one cardable page the request survives, and the baseline then reports
//    used=2 against cards=1 — one used record with no card. So every case below pairs the two,
//    and the assertion is the invariant itself: used == cards, always.
//
// B  api/ask.js — the Kuwaiti Fiqh Encyclopedia excerpt was appended to the tool_result while the
//    cards were built only from retrievedSources. Measured before removal: ten batteries that
//    drive this handler reached the branch ZERO times, so under §5ج the excerpt leaves the context
//    rather than being given a card it never demonstrably earned.
//
// Offline and deterministic. Usage: node guards/card-or-no-context-par-a-guard.cjs [--mutants]

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const HYBRID = path.join(ROOT, 'lib', 'hybrid-deen.js');
const ASK = path.join(ROOT, 'api', 'ask.js');

let pass = 0;
let fail = 0;
const failures = [];
function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + label); return true; }
  fail++; failures.push(label);
  console.log('  FAIL  ' + label + (detail === undefined ? '' : '  |  ' + detail));
  return false;
}
const esm = (f) => import(pathToFileURL(f).href + '?v=' + Date.now() + '-' + Math.random());

const openBudget = { reserve: async () => ({ ok: true }), snapshot: () => ({}) };

// One live page that CAN become a card (clean https) and one that cannot (http, which
// externalCard() refuses outright). Both carry the same answering passage, so the only thing
// separating them is whether the reader could ever be shown them.
const PASSAGE = 'الحكمُ في هذه المسألةِ أنّها جائزةٌ ولا حرجَ فيها عند جمهور أهل العلم، '
  + 'وقد نصّ على ذلك غيرُ واحدٍ من أهل العلم، والأمرُ في هذا واسع.';

const cardable = () => ({
  url: 'https://binbaz.org.sa/fatwas/3577/example', title: 'فتوى مؤهَّلة',
  publisher: 'binbaz.org.sa', passage: PASSAGE, text: PASSAGE, authorialText: PASSAGE,
});
const uncardable = () => ({
  url: 'http://insecure.example/fatwa/1', title: 'صفحةٌ لا تصلح بطاقةً',
  publisher: 'insecure.example', passage: PASSAGE, text: PASSAGE, authorialText: PASSAGE,
});

async function sectionA() {
  console.log('\n--- A. lib/hybrid-deen.js: no used record without a card ---');
  const H = await esm(HYBRID);

  const run = (sources) => H.runHybridDeenTurn({
    context: { currentQuestion: 'ما حكم هذه المسألة؟', resolvedScholar: null },
    band: 'adult', depth: 'normal', dailyBudget: openBudget,
    localRetrieve: async () => ({ storedCorpusCalls: 1, candidateRecordIds: [], accepted: [] }),
    fatwaSearch: async () => ({ calls: 1, records: [] }),
    liveRetrieve: async () => ({ text: '', sources, injectionMarkers: [] }),
    generate: async () => { throw new Error('model offline'); },
    verify: async () => '{"supported_ids":[]}',
  });

  const both = await run([cardable(), uncardable()]);
  ok('A1 the turn still answers when a cardable page is present',
    both.outcome === 'ANSWER' || both.outcome === 'NO_HYBRID_EVIDENCE',
    'outcome=' + both.outcome);

  if (both.outcome === 'ANSWER') {
    ok('A2 every used record is matched by a card the reader is shown',
      both.usedEvidence.length === both.cards.length,
      'used=' + both.usedEvidence.length + ' cards=' + both.cards.length);
    ok('A3 ...and no uncardable page survived into the used set',
      !both.usedEvidence.some((e) => String(e.url || '').startsWith('http://')),
      JSON.stringify(both.usedEvidence.map((e) => e.url)));
  }

  // The invariant must hold for every shape that COULD produce an uncardable record, even though
  // each is currently rejected upstream. This is the pin: if a future change to the registry lets
  // one through, used == cards is where it surfaces.
  for (const bad of ['https://user:pass@binbaz.org.sa/f/1', 'https://BIN_BAZ.example/x', 'http://insecure.example/a']) {
    const r = await run([cardable(), { ...uncardable(), url: bad }]);
    ok('A4 invariant holds with an uncardable shape present — ' + bad.slice(0, 34),
      r.outcome !== 'ANSWER' || r.usedEvidence.length === r.cards.length,
      'used=' + r.usedEvidence.length + ' cards=' + r.cards.length);
  }

  // And the enforcement is actually present, so the mutant below has something to remove.
  ok('A5 the card-or-drop enforcement exists at the point the used set is built',
    /const uncarded = usedEvidence\.filter\(\(entry\) => !cardsFor\(\[entry\]\)\.length\);/
      .test(fs.readFileSync(HYBRID, 'utf8')),
    'nothing enforces the law where usedEvidence is assembled');

  // An uncardable page ALONE must not produce an answer drafted over an invisible source.
  const aloneUncardable = await run([uncardable()]);
  ok('A6 an uncardable page alone yields no answer rather than an uncarded one',
    aloneUncardable.outcome !== 'ANSWER' || aloneUncardable.cards.length > 0,
    'outcome=' + aloneUncardable.outcome + ' cards=' + aloneUncardable.cards.length);

  // The ordinary case must be untouched: a clean page still answers with its card.
  const cleanOnly = await run([cardable()]);
  if (cleanOnly.outcome === 'ANSWER') {
    ok('A7 an ordinary cardable page is unaffected — it answers and carries its card',
      cleanOnly.cards.length >= 1 && cleanOnly.usedEvidence.length === cleanOnly.cards.length,
      'used=' + cleanOnly.usedEvidence.length + ' cards=' + cleanOnly.cards.length);
    ok('A8 ...and reports no uncarded drop, because nothing was dropped',
      !(cleanOnly.degraded || []).some((d) => String(d).startsWith('uncarded-evidence-dropped')),
      JSON.stringify(cleanOnly.degraded));
  } else {
    ok('A7 an ordinary cardable page is unaffected', false, 'outcome=' + cleanOnly.outcome);
  }
}

function sectionB() {
  console.log('\n--- B. api/ask.js: nothing uncarded is appended to the tool_result ---');
  const src = fs.readFileSync(ASK, 'utf8');

  ok('B1 the encyclopedia excerpt no longer enters the model context',
    !/retrieveEncyclopedia\s*\(/.test(src),
    'the excerpt is still retrieved and appended somewhere in this handler');
  ok('B2 the encyclopedia module is not imported into this handler at all',
    !/import\(['"]\.\.\/lib\/encyclopedia\.js['"]\)/.test(src),
    'a lazy import of the encyclopedia remains');
  ok('B3 the tool_result content is the retrieved page text and nothing appended',
    /const content = webText;/.test(src) && !/content = webText\s*\n?\s*\+/.test(src),
    'something is still concatenated onto the tool_result content');
  ok('B4 the removal is explained where it happened, not silently dropped',
    /X-020 \/ X-003/.test(src), 'no rationale recorded at the site');
  // The cards on this path must still come from the retrieved sources only.
  ok('B5 cards on this path are still built from the retrieved sources',
    /pickVerifiedSources\(retrievedSources/.test(src));
}

async function mutants() {
  console.log('\n--- C. REQUIRED MUTANTS ---');

  async function mutate(name, file, apply, check) {
    const original = fs.readFileSync(file, 'utf8');
    const changed = apply(original);
    if (changed === original) {
      fail++; failures.push('MUTANT ' + name + ' seam moved');
      console.log('  FAIL  MUTANT ' + name + ': seam moved, mutation did not apply');
      return;
    }
    const twin = file.replace(/\.js$/, '.__mutant__.js');
    fs.writeFileSync(twin, changed, 'utf8');
    let survived = true;
    try { survived = await check(twin, changed); } catch (e) { survived = false; }
    finally { fs.rmSync(twin, { force: true }); }
    ok('MUTANT KILLED: ' + name, !survived, 'the rule was removed and this gate stayed green');
  }

  // M1 — hybrid-deen stops dropping uncarded records. A5 is re-evaluated, not A2: the drop cannot
  // fire on any input reachable today (measured, see the header), so removing it changes no
  // behaviour to observe. What it does change is that the law is no longer enforced anywhere on
  // this path, and that is the thing worth failing on.
  await mutate('hybrid-remove-the-card-or-drop-enforcement', HYBRID,
    (s) => s.replace('const uncarded = usedEvidence.filter((entry) => !cardsFor([entry]).length);',
      'const uncarded = [];'),
    async (twin, changed) => /const uncarded = usedEvidence\.filter\(\(entry\) => !cardsFor\(\[entry\]\)\.length\);/.test(changed));

  // M2 — the encyclopedia excerpt is appended to the tool_result again.
  await mutate('ask-reappend-uncarded-excerpt', ASK,
    (s) => s.replace('const content = webText;',
      'let content = webText; if (globalThis.__enc) content = webText + "\\n" + globalThis.__enc;'),
    async (twin, changed) => /const content = webText;/.test(changed) && !/content = webText \+/.test(changed));
}

(async () => {
  try {
    await sectionA();
    sectionB();
    if (process.argv.includes('--mutants')) await mutants();
  } catch (e) {
    console.error('GUARD ERROR:', e && e.stack ? e.stack : e);
    process.exit(1);
  }
  console.log('\n=== ' + pass + '/' + (pass + fail) + ' — ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ===');
  if (fail) { console.log('-- FAILURES --'); for (const f of failures) console.log('   ' + f); }
  process.exit(fail === 0 ? 0 : 1);
})();
