// guards/scholar-separation-par-a-guard.cjs — X-023/X-005: whose words are these?
//
// THE PROPERTY. When a reply carries BOTH a named shaykh's own published text AND general rulings
// drawn from other sources, the boundary between them is written by the SERVER. Not requested of
// the model, not implied by ordering, not left to the reader to infer from a source card.
//
// WHY THE PROMPT CANNOT OWN IT. Every individual sentence in a blended paragraph is true. The
// falsehood is produced by adjacency: a general ruling placed under a named shaykh's heading reads
// as his ruling. Nothing in the model's output is wrong, so nothing downstream can detect it, and
// the reader walks away believing a named living scholar holds a position he may not hold. An
// instruction in a system prompt is a request; this gate requires an enforcement.
//
// TWO SITES, MEASURED SEPARATELY:
//   A  lib/hybrid-deen.js — the composed summary, where direct and general claims are both present.
//   B  api/ask.js         — the legacy attributed path, whose separation lived only in the
//                           `grounding` text handed to the model.
//
// Offline and deterministic. Usage: node guards/scholar-separation-par-a-guard.cjs [--mutants]

const fs = require('fs');
const os = require('os');
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

function importsFromTree(source, originalFile) {
  return source.replace(/(['"])(\.\.?\/[^'"\r\n]+\.js)\1/gu, (_all, quote, specifier) => {
    const target = path.resolve(path.dirname(originalFile), specifier);
    return quote + pathToFileURL(target).href + quote;
  });
}

const SHAYKH = { id: 'ibn-baz', display: 'الشيخ ابن باز' };
const CONTEXT = { resolvedScholar: SHAYKH, currentQuestion: 'ما حكم كذا؟' };

// One claim carried by HIS text, one carried by a different source. This is the mixed reply.
const CLAIMS = [
  {
    sentence: 'الحكمُ عندَه أنّ الأمرَ واسعٌ ولا حرجَ فيه.',
    evidence: { id: 'E1', directAttribution: true, authorityId: 'ibn-baz', kind: 'fatwa_service' },
  },
  {
    sentence: 'وذهب غيرُه إلى المنعِ في هذه الصورةِ بعينِها.',
    evidence: { id: 'E2', directAttribution: false, authorityId: 'other-body', kind: 'fatwa_service' },
  },
];

async function suite() {
  console.log('=== scholar-separation-par-a-guard -- X-023/X-005: the server says whose words ===');

  // ── A. lib/hybrid-deen.js ─────────────────────────────────────────────────
  console.log('\n--- A. hybrid-deen composed summary ---');
  const H = await esm(HYBRID);
  const hybridSrc = fs.readFileSync(HYBRID, 'utf8');
  // The baseline builds every summary as a bare flat join of claim sentences, with the shaykh's
  // own text and the general ruling indistinguishable inside one string. These two assertions
  // measure that directly, so this section reports the real defect rather than merely reporting
  // that a new helper is missing.
  ok('A0a no summary is composed by a bare flat join of claim sentences',
    !/\[lead, body\]\.filter\(Boolean\)/.test(hybridSrc)
      && !/\[lead, retryBody\]\.filter\(Boolean\)/.test(hybridSrc)
      && !/summary = \[lead, rebuilt\.slice/.test(hybridSrc),
    'a flat join still composes a summary — direct and general claims are merged unlabelled');
  ok('A0b the composition is a single named function, so every path separates alike',
    /^function composeSummary\(/m.test(hybridSrc),
    'no composeSummary(): the three summary build sites can drift apart');

  const compose = H.__hybridTest && H.__hybridTest.composeSummary;
  if (typeof compose !== 'function') {
    ok('A0c composeSummary is exposed for behavioural measurement', false,
      'summary still built inline — behavioural separation cannot be measured');
    return sectionB();
  }

  const mixed = compose(CLAIMS, CONTEXT, '');
  ok('A1 the mixed summary names the shaykh as the owner of his half',
    mixed.includes('قولُ ' + SHAYKH.display), JSON.stringify(mixed.slice(0, 120)));
  ok('A2 ...and marks the general ruling as general, not his',
    /وأمّا الحكمُ العامُّ/.test(mixed), JSON.stringify(mixed.slice(0, 200)));
  ok('A3 ...and his sentence sits under HIS label, before the general one',
    mixed.indexOf('قولُ ' + SHAYKH.display) < mixed.indexOf(CLAIMS[0].sentence)
      && mixed.indexOf(CLAIMS[0].sentence) < mixed.indexOf('وأمّا الحكمُ العامُّ')
      && mixed.indexOf('وأمّا الحكمُ العامُّ') < mixed.indexOf(CLAIMS[1].sentence),
    JSON.stringify(mixed));
  ok('A4 both claims still reach the reader — separating is not dropping',
    mixed.includes(CLAIMS[0].sentence) && mixed.includes(CLAIMS[1].sentence));

  // An UNMIXED reply must be left exactly as it was: no gratuitous headings on ordinary answers.
  const onlyDirect = compose([CLAIMS[0]], CONTEXT, '');
  ok('A5 a reply with only his own text gets no separation heading',
    !onlyDirect.includes('وأمّا الحكمُ العامُّ') && onlyDirect.includes(CLAIMS[0].sentence),
    JSON.stringify(onlyDirect));
  const onlyGeneral = compose([CLAIMS[1]], CONTEXT, '');
  ok('A6 a reply with no text of his gets no false attribution heading',
    !onlyGeneral.includes('قولُ ' + SHAYKH.display) && onlyGeneral.includes(CLAIMS[1].sentence),
    JSON.stringify(onlyGeneral));
  const noScholar = compose(CLAIMS, { resolvedScholar: null }, '');
  ok('A7 with nobody named, nothing is separated',
    !noScholar.includes('وأمّا الحكمُ العامُّ'), JSON.stringify(noScholar));
  // The existing not-found lead must still survive in front of the composition.
  const withLead = compose(CLAIMS, CONTEXT, 'تعذّر التحقق.');
  ok('A8 an existing lead is preserved ahead of the separation',
    withLead.startsWith('تعذّر التحقق.'), JSON.stringify(withLead.slice(0, 60)));

  return sectionB();
}

// ── B. api/ask.js legacy attributed path ────────────────────────────────────
// Source-measured on purpose: this exit is reached only after a live model call and a live
// attributed retrieval, neither of which may happen here. What CAN be measured offline, and is
// what the item turns on, is whether the separation exists in the server's own bytes at all.
function sectionB() {
  console.log('\n--- B. api/ask.js legacy attributed path ---');
  const askSrc = fs.readFileSync(ASK, 'utf8');
  // ── SITE B IS BLOCKED, AND THIS SECTION PINS THE SAFE STATE RATHER THAN A FIX ──
  //
  // Three server-owned placements were built and MEASURED on this exit, and all three turned the
  // same 5 name-presence checks red (803/803 -> 798/803):
  //   1. concatenated into the draft            -> screened as model output
  //   2. moved onto finalizerContext.readerPrefix -> readerPrefix is composed BEFORE the A1
  //                                                finalizer, so it is screened too
  //   3. gated on attrLicence.includes(requestedAuthorityId) -> still screened
  // In every case: ATTRIBUTION_NOT_LICENSED -> CONSISTENCY_DROP_WHOLE -> the finalizer discards the
  // whole verified answer and the reader gets a refusal instead of a correct attributed fatwa.
  //
  // The screen is not wrong. A server sentence «قولُ فلان» IS a claim about a policed name, and on
  // this exit `ownedByHim` is satisfied by the `!plan.requestedAuthorityId` short-circuit, so the
  // pages have not established that naming him is licensed. Enforcing the separation here needs
  // the finalizer to distinguish server-authored prose from model-authored prose — which is
  // finalizer/licence ownership, not this item's, and belongs to the merge round.
  //
  // SO WHAT IS PINNED HERE IS THE SAFE STATE: this exit must not carry an UNLICENSED server-written
  // attribution. That is a real invariant, it is the one currently held, and it fails loudly if
  // someone reintroduces the lead without solving the licence question first.
  ok('B1 the attributed exit carries no unlicensed server-written attribution line',
    !/finalizerContext\.readerPrefix = `قولُ \$\{src\.scholar\}/.test(askSrc)
      && !/seal\(separated\)/.test(askSrc),
    'a server-authored «قولُ فلان» is back on this exit — re-measure name-presence before shipping');
  const groundingOwned = /انسبْ إلى الشيخ ما في النصِّ أعلاه وحدَه/.test(askSrc);
  ok('B2 the prompt-side instruction is still present as the interim separation',
    groundingOwned, 'the grounding instruction was removed while no server enforcement replaced it');
}

// ── MUTANTS ─────────────────────────────────────────────────────────────────
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
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-scholar-separation-'));
    const twin = path.join(temp, path.basename(file).replace(/\.js$/, '.__mutant__.mjs'));
    fs.writeFileSync(twin, importsFromTree(changed, file), 'utf8');
    let survived = true;
    try { survived = await check(twin, changed); } catch (e) { survived = false; }
    finally { fs.rmSync(temp, { recursive: true, force: true }); }
    ok('MUTANT KILLED: ' + name, !survived, 'the enforcement was removed and this gate stayed green');
  }

  // M1 — hybrid-deen stops separating and goes back to one flat paragraph.
  await mutate('hybrid-drop-the-separation', HYBRID,
    (s) => s.replace('if (!context?.resolvedScholar || !direct.length || !general.length) {',
      'if (true) {'),
    async (twin) => {
      const mod = await esm(twin);
      const c = mod.__hybridTest.composeSummary;
      const out = c(CLAIMS, CONTEXT, '');
      // A1/A2 re-evaluated: do they still hold?
      return out.includes('قولُ ' + SHAYKH.display) && /وأمّا الحكمُ العامُّ/.test(out);
    });

  // M2 — someone reintroduces the unlicensed server lead on the attributed exit. B1 must catch it,
  // because shipping it costs the reader the entire verified answer.
  await mutate('ask-reintroduce-unlicensed-server-lead', ASK,
    (s) => s.replace('        clearKeepAlive();\n        res.write(`data: ${JSON.stringify({\n          type: \'content_block_delta\', index: 0,\n          delta: { type: \'text_delta\', text: seal(draft) + referralBlockFor(draft)',
      '        finalizerContext.readerPrefix = `قولُ ${src.scholar} كما جاء في نصِّه المنشور:`;\n        clearKeepAlive();\n        res.write(`data: ${JSON.stringify({\n          type: \'content_block_delta\', index: 0,\n          delta: { type: \'text_delta\', text: seal(draft) + referralBlockFor(draft)'),
    async (twin, changed) => !/finalizerContext\.readerPrefix = `قولُ \$\{src\.scholar\}/.test(changed));
}

(async () => {
  try {
    await suite();
    if (process.argv.includes('--mutants')) await mutants();
  } catch (e) {
    console.error('GUARD ERROR:', e && e.stack ? e.stack : e);
    process.exit(1);
  }
  console.log('\n=== ' + pass + '/' + (pass + fail) + ' — ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ===');
  if (fail) { console.log('-- FAILURES --'); for (const f of failures) console.log('   ' + f); }
  process.exit(fail === 0 ? 0 : 1);
})();
