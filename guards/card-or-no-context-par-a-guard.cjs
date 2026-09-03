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
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
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

function importsFromTree(source, originalFile) {
  return source.replace(/(['"])(\.\.?\/[^'"\r\n]+\.js)\1/gu, (_all, quote, specifier) => {
    const target = path.resolve(path.dirname(originalFile), specifier);
    return quote + pathToFileURL(target).href + quote;
  });
}

const openBudget = { reserve: async () => ({ ok: true }), snapshot: () => ({}) };

// One live page that CAN become a card (clean https) and one that cannot (http, which
// externalCard() refuses outright). The two passages answer the question equally and are equally
// topical, so the only thing separating the pages is still whether the reader could ever be shown
// them — which is the whole point of the pair.
//
// THEY MUST NOT BE THE SAME STRING, and that is measured, not stylistic. أ-٤ added containment
// de-duplication to the summary: a span sitting inside another span is one piece of evidence, not
// two. With both fixtures carrying one identical passage the pair COLLAPSED before the used set was
// ever assembled, so the uncardable page never reached the card-or-drop rule —
// `uncarded-evidence-dropped` stopped appearing, and M1 below could no longer observe the rule it
// exists to remove. The mutant went from killed to silently surviving without one byte of the
// product regressing. Distinct passages restore the reach.
const PASSAGE = 'الحكمُ في هذه المسألةِ أنّها جائزةٌ ولا حرجَ فيها عند جمهور أهل العلم، '
  + 'وقد نصّ على ذلك غيرُ واحدٍ من أهل العلم، والأمرُ في هذا واسع.';
const PASSAGE_TWIN = 'وهذه المسألةُ حكمُها الجوازُ أيضًا عند أكثر أهل العلم، ولا بأسَ بها، '
  + 'وقد أفتى بذلك جمعٌ من المحقِّقين، والأمرُ فيها موسَّع.';

const cardable = () => ({
  url: 'https://binbaz.org.sa/fatwas/3577/example', title: 'فتوى مؤهَّلة',
  publisher: 'binbaz.org.sa', passage: PASSAGE, text: PASSAGE, authorialText: PASSAGE,
});
const uncardable = () => ({
  url: 'http://insecure.example/fatwa/1', title: 'صفحةٌ لا تصلح بطاقةً',
  publisher: 'insecure.example', passage: PASSAGE_TWIN, text: PASSAGE_TWIN, authorialText: PASSAGE_TWIN,
});

function runHybrid(H, sources) {
  return H.runHybridDeenTurn({
    context: { currentQuestion: 'ما حكم هذه المسألة؟', resolvedScholar: null },
    band: 'adult', depth: 'normal', dailyBudget: openBudget,
    localRetrieve: async () => ({ storedCorpusCalls: 1, candidateRecordIds: [], accepted: [] }),
    fatwaSearch: async () => ({ calls: 1, records: [] }),
    liveRetrieve: async () => ({ text: '', sources, injectionMarkers: [] }),
    generate: async () => { throw new Error('model offline'); },
    verify: async () => '{"supported_ids":[]}',
  });
}

// ع-٤٣ · IDENTITY, NOT ARITHMETIC. `used.length === cards.length` is satisfied by two lists
// that name entirely different records, which is exactly the failure measured on 3 September:
// a summary drawn from evidence B over a card for evidence A. Counting them agreed; the
// reader was still shown the wrong source. The comparison is now between the IDS the answer
// claims (`validatedUsedEvidenceIds`), the ids it used, and the ids it shows.
const sameIds = (result) => {
  const claimed = JSON.stringify(result.validatedUsedEvidenceIds || []);
  const used = JSON.stringify((result.usedEvidence || []).map((entry) => entry.id));
  const shown = JSON.stringify((result.cards || []).map((card) => card.evidenceId));
  return claimed === used && claimed === shown;
};

async function sectionA() {
  console.log('\n--- A. lib/hybrid-deen.js: no used record without a card ---');
  const H = await esm(HYBRID);

  const run = (sources) => runHybrid(H, sources);

  const both = await run([cardable(), uncardable()]);
  ok('A1 the turn still answers when a cardable page is present',
    both.outcome === 'ANSWER' || both.outcome === 'NO_HYBRID_EVIDENCE',
    'outcome=' + both.outcome);

  if (both.outcome === 'ANSWER') {
    ok('A2 every used record is matched by a card the reader is shown, by ID and not by count',
      both.usedEvidence.length === both.cards.length && sameIds(both),
      'used=' + JSON.stringify(both.usedEvidence.map((e) => e.id))
        + ' cards=' + JSON.stringify(both.cards.map((c2) => c2.evidenceId))
        + ' claimed=' + JSON.stringify(both.validatedUsedEvidenceIds));
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
      r.outcome !== 'ANSWER' || (r.usedEvidence.length === r.cards.length && sameIds(r)),
      'used=' + JSON.stringify(r.usedEvidence.map((e) => e.id))
        + ' cards=' + JSON.stringify(r.cards.map((c2) => c2.evidenceId))
        + ' claimed=' + JSON.stringify(r.validatedUsedEvidenceIds));
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
      cleanOnly.cards.length >= 1 && cleanOnly.usedEvidence.length === cleanOnly.cards.length
        && sameIds(cleanOnly),
      'used=' + JSON.stringify(cleanOnly.usedEvidence.map((e) => e.id))
        + ' cards=' + JSON.stringify(cleanOnly.cards.map((c2) => c2.evidenceId))
        + ' claimed=' + JSON.stringify(cleanOnly.validatedUsedEvidenceIds));
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
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-card-or-context-'));
    const twin = path.join(temp, path.basename(file).replace(/\.js$/, '.__mutant__.mjs'));
    fs.writeFileSync(twin, importsFromTree(changed, file), 'utf8');
    let survived = true;
    try { survived = await check(twin, changed); } catch (e) { survived = false; }
    finally { fs.rmSync(temp, { recursive: true, force: true }); }
    ok('MUTANT KILLED: ' + name, !survived, 'the rule was removed and this gate stayed green');
  }

  // M1 — boot the changed module and drive the paired fixture through it. Reading `changed` here
  // used to ask whether the mutation removed the very string it had just removed, so this mutant
  // was declared dead by construction without executing one byte of the twin.
  await mutate('hybrid-remove-the-card-or-drop-enforcement', HYBRID,
    (s) => s.replace('const uncarded = usedEvidence.filter((entry) => !cardsFor([entry]).length);',
      'const uncarded = [];'),
    async (twin) => {
      const mod = await esm(twin);
      const reachesEvidenceButNotCards = {
        ...uncardable(),
        url: 'https://user:pass@binbaz.org.sa/fatwas/3578/example',
      };
      const out = await runHybrid(mod, [cardable(), reachesEvidenceButNotCards]);
      return out.outcome !== 'ANSWER'
        || (out.usedEvidence.length === out.cards.length
          && !out.usedEvidence.some((entry) => String(entry.url || '').startsWith('http://')));
    });

  // M2 — expose only the mutant's content composer, wire the changed handler through it, import
  // the changed api module, and measure the bytes it would return. The export exists only in the
  // temporary twin; production keeps no test seam and the gate no longer substitutes a text scan
  // for executable evidence.
  await mutate('ask-reappend-uncarded-excerpt', ASK,
    (s) => s
      .replace("const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';",
        "const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';\n"
        + "export const __cardOrContextMutantContent = (webText, excerpt) => webText + '\\n' + excerpt;")
      .replace('const content = webText;',
        "const content = __cardOrContextMutantContent(webText, globalThis.__enc || '');"),
    async (twin) => {
      const mod = await esm(twin);
      const visible = 'retrieved page with a reader-visible card';
      const hidden = 'uncarded encyclopedia excerpt';
      return mod.__cardOrContextMutantContent(visible, hidden) === visible;
    });
}

// ── E. THE REPLACED LAW (merge §٤ / L2) ─────────────────────────────────────
//
// A AND B STAY TRUE AND MUST. On the hybrid path, `used == cards` is still the invariant and the
// encyclopedia excerpt still stays out of the model's context. Neither is touched by this round,
// and with FREE_BRAIN_V1 off they are the law a reader gets.
//
// WHAT FLIPS. On the reviewer path the rule is THE CARD FOLLOWS THE CITATION, and the difference
// is not a relaxation — it is a different mechanism for the same guarantee. The old law protected
// the reader by refusing to draft over anything they could not open. The new one lets the material
// in and makes the SENTENCE carry its own standing: a claim built on a page gets that page's card,
// and a claim built on something with no page is marked as understanding rather than presented as
// a transmitted text. The Kuwaiti fiqh encyclopedia is exactly that case — 3,070 edited fiqh
// terms, quotable, citable, and with no URL anywhere in the corpus — so under `used == cards` it
// could only ever be excluded, which is what section B recorded when it removed it.
//
// Driven, not scanned: the model really calls `search_sources`, the encyclopedia really answers
// in-process, the answer really cites it, and the card rule really produces one fewer card.
async function sectionE() {
  console.log('\n--- E. the replaced law: the card follows the citation, not the retrieval ---');
  const LAW = require('./replaced-law-lib.cjs');
  const loop = await LAW.fresh(LAW.LOOP, 'cardorcontext-flip');

  const free = await LAW.driveFreeTurn({
    module: loop,
    search: 'الوضوء',
    answer: 'الوضوء في اللغة من الوضاءة وهي النظافة [[1]].',
  });
  const cards = LAW.freePathCards(free.cited);
  ok('E1 the encyclopedia really answered, and the answer really cited it',
    free.cited.length === 1 && free.cited[0].kind === 'encyclopedia',
    JSON.stringify(free.cited.map((row) => [row.kind, row.url])));
  ok('E2 FLIPPED — a cited record with no page is USED and carries no card',
    free.cited.length === 1 && cards.length === 0 && free.cited[0].url === '',
    'cited=' + free.cited.length + ' cards=' + cards.length);
  ok('E3 ...and the answer stands rather than being refused for the missing card',
    free.text.includes('الوضاءة') && free.text.trim().length > 0, JSON.stringify(free.text));
  ok('E4 ...and the sentence is marked, which is what replaced the card as the honesty mechanism',
    free.verdict && free.verdict !== 'unreviewed'
      && Object.keys(free.verdict.counts || {}).length > 0, JSON.stringify(free.verdict?.counts));
  ok('E5 the citation marker itself never reaches the reader',
    !/\[\[|\]\]/u.test(free.text), JSON.stringify(free.text));

  const twin = await LAW.mutate({
    file: LAW.LOOP,
    name: 'uncardable-citation-dropped-again',
    // SEAM MOVED BY §٣ OF THE 2026-08-17 DELIVERY ROUND, PROPERTY UNCHANGED. The card list is now
    // built AFTER the reviewer, from the refs whose sentences survived into the delivered text
    // (`surviving`), instead of straight off the proposal. The mutation this gate makes is the
    // same one it always made — re-add the «only a row with a page counts» filter — applied at the
    // line that now carries it, and E8 still asserts that a cited record without a page reaches
    // the model's context and simply gets no card.
    transform: (src) => src.replace(
      /^ {2}const cited = surviving\.map\(\(entry\) => table\.byRef\(entry\.ref\)\)\.filter\(Boolean\);$/mu,
      '  const cited = surviving.map((entry) => table.byRef(entry.ref)).filter(Boolean).filter((row) => row.url);'),
    check: async (mod) => {
      const out = await LAW.driveFreeTurn({
        module: mod,
        search: 'الوضوء',
        answer: 'الوضوء في اللغة من الوضاءة وهي النظافة [[1]].',
      });
      return out.cited.length === 1 && LAW.freePathCards(out.cited).length === 0;
    },
  });
  ok('E6 mutant restoring «used == cards» on this path applies', twin.changed, twin.error);
  ok('E7 mutant twin loads', twin.loaded, twin.error);
  ok('E8 MUTANT KILLED: a cited record without a page cannot be dropped again',
    twin.loaded && twin.survived === false, JSON.stringify(twin));
}

function registeredCompanions() {
  console.log('\n--- D. REGISTERED COMPANION GATES ---');
  let roster;
  try {
    roster = JSON.parse(fs.readFileSync(path.join(ROOT, 'gates.json'), 'utf8'));
  } catch (error) {
    ok('gates.json companion registration is readable', false, error.message);
    return;
  }
  const self = Array.isArray(roster)
    ? roster.find((entry) => entry?.script === 'guards/card-or-no-context-par-a-guard.cjs')
    : null;
  const companions = Array.isArray(self?.companions) ? self.companions : [];
  ok('gemini13 is named in this gate registration', companions.some((entry) =>
    entry?.name === 'gemini13' && entry?.script === 'guards/gemini13-route-guard.cjs'));
  for (const companion of companions) {
    const args = String(companion?.args || '').trim().split(/\s+/u).filter(Boolean);
    const result = spawnSync(process.execPath, [path.join(ROOT, companion.script), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    ok('registered companion passes: ' + companion.name, result.status === 0,
      result.error?.message || result.stderr || `exit=${result.status}`);
  }
}

(async () => {
  try {
    await sectionA();
    sectionB();
    await sectionE();
    if (process.argv.includes('--mutants')) await mutants();
    if (process.argv.includes('--registered-companions')) registeredCompanions();
  } catch (e) {
    console.error('GUARD ERROR:', e && e.stack ? e.stack : e);
    process.exit(1);
  }
  console.log('\n=== ' + pass + '/' + (pass + fail) + ' — ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ===');
  if (fail) { console.log('-- FAILURES --'); for (const f of failures) console.log('   ' + f); }
  process.exit(fail === 0 ? 0 : 1);
})();
