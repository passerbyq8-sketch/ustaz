// guards/prompt-consistency-par-a-guard.cjs — X-011: the prompt does not contradict itself.
//
// SCOPE. Two of the five contradictions in EZIK-GUARDS-HONESTY-SPEC-2026-08-15 Part B, and only
// the two the owner approved on 2026-08-15: P-01 (written verse text vs the empty verse tag) and
// P-05 (age 13 sitting in both the young and the teen band). P-02, P-03 and P-04 were put to the
// owner in the same numbered question and REJECTED, so nothing here asserts them — a guard that
// pinned a rejected wording would be pinning a decision that was never made.
//
// WHAT MAKES THIS A LIVE READING AND NOT A FILE SCAN. Every assertion below runs against the
// STRING buildSystemPrompt() actually returns, for each of the three real bands. A regex over
// lib/system-prompt.js would pass on text sitting in a comment, in a dead ternary arm, or in a
// band that never ships. The prompt is assembled from per-band branches (band === 'young' ? ...),
// so the only honest question is "what does the model actually receive", and that is what is
// measured here.
//
// AND THE AGE BOUNDARY IS NOT HARDCODED. index.html holds the ONE runtime band expression
// (`ageNum >= 18 ? 'adult' : ageNum >= 13 ? 'teen' : 'young'`). This guard parses the threshold
// out of that expression and derives every expectation from it. Pinning the literal 13 here would
// just be a second opinion that can drift from the shipped one; deriving it means the day someone
// moves the runtime boundary, the prompt is required to move with it or this gate goes red.
//
// Offline and deterministic. No network, no model, no store. Usage: node guards/prompt-consistency-par-a-guard.cjs

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const PROMPT_FILE = path.join(ROOT, 'lib', 'system-prompt.js');
const INDEX_FILE = path.join(ROOT, 'index.html');

let pass = 0;
let fail = 0;
const failures = [];

function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + label); return true; }
  fail++; failures.push(label);
  console.log('  FAIL  ' + label + (detail === undefined ? '' : '  |  ' + detail));
  return false;
}

// ── ASCII-ONLY OUTPUT ────────────────────────────────────────────────────────
// Session rule: Arabic lives in files, never on the terminal. Needles below are Arabic because
// the prompt is Arabic; what gets PRINTED is an ASCII label and a count, never the needle.
const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const toArabicIndic = (n) => String(n).split('').map((d) => ARABIC_INDIC[Number(d)]).join('');

// The exact clause P-01 removes: the final checklist ordering the model to write the verse text
// and the surah name as prose. Matched loosely on its two identifying fragments so that harmless
// re-punctuation does not produce a false green.
const P01_OLD_ORDER = ['**عند ذكر آية**', 'اذكر اسم السورة ورقم الآية'];
// The canonical rule P-01 defers to. If a "fix" ever deletes this instead of the contradiction,
// these two turn red and say so.
const P01_CANONICAL = ['استخدم وسم verse فارغاً', 'مَمْنُوعٌ مَنْعًا بَاتًّا أن تكتب نصّ الآية بنفسك'];
// What P-01 puts in place of the old order.
const P01_NEW_SCOPE = ['عند ذكر آية خارج وسم <document>', 'لا تكتب نصّ الآية بنفسك ولا اسم السورة في النثر'];

async function loadPrompt(file) {
  const mod = await import(pathToFileURL(file).href + '?v=' + Date.now() + '-' + Math.random());
  return mod.buildSystemPrompt;
}

// The runtime band expression is the single source of truth for where "young" ends.
function teenThresholdFromIndex() {
  // ITEM 32: the band expression ships in app.jsx now; index.html only loads the bundle built
  // from it. readShippedClient throws if the page ships no JSX it can find, so a missing source
  // is a named failure and never a null that reads as 'the expression is gone'.
  const src = require('../tools/babel-block.cjs').readShippedClient(INDEX_FILE);
  const m = /ageNum\s*>=\s*(\d+)\s*\?\s*'adult'\s*:\s*ageNum\s*>=\s*(\d+)\s*\?\s*'teen'\s*:\s*'young'/.exec(src);
  if (!m) return null;
  return { adult: Number(m[1]), teen: Number(m[2]) };
}

async function run() {
  console.log('=== prompt-consistency-par-a-guard -- X-011: P-01 verse rule, P-05 age band ===');

  const build = await loadPrompt(PROMPT_FILE);

  // ── SECTION 0 · THE RUNTIME BOUNDARY, READ FROM THE SHIPPED EXPRESSION ─────
  console.log('\n--- 0. RUNTIME BAND BOUNDARY (index.html is the source of truth) ---');
  const bounds = teenThresholdFromIndex();
  ok('index.html still exposes one parseable band expression', bounds !== null,
    'expected ageNum >= N ? adult : ageNum >= M ? teen : young');
  if (!bounds) return finish();
  ok('band expression names an adult and a teen threshold',
    Number.isInteger(bounds.adult) && Number.isInteger(bounds.teen) && bounds.adult > bounds.teen,
    JSON.stringify(bounds));

  const TEEN_AT = bounds.teen;          // first teen age, per shipped runtime
  const YOUNG_MAX = TEEN_AT - 1;        // last young age — derived, never assumed
  console.log('  INFO  teen_at=' + TEEN_AT + '  young_max=' + YOUNG_MAX);

  // The prompt module derives its own band. It must agree with index.html, or the two halves of
  // the product disagree about who the reader is before a single word is written.
  const promptSrc = fs.readFileSync(PROMPT_FILE, 'utf8');
  const pm = /ageNum\s*>=\s*(\d+)\s*\?\s*'adult'\s*:\s*ageNum\s*>=\s*(\d+)\s*\?\s*'teen'\s*:\s*'young'/.exec(promptSrc);
  ok('lib/system-prompt.js derives the same boundary as index.html',
    !!pm && Number(pm[1]) === bounds.adult && Number(pm[2]) === TEEN_AT,
    pm ? 'prompt=' + pm[1] + '/' + pm[2] + ' index=' + bounds.adult + '/' + TEEN_AT : 'no band expression in prompt');

  const bands = [
    { key: 'young', age: YOUNG_MAX, text: build('طفل', String(YOUNG_MAX), 'male') },
    { key: 'boundary', age: TEEN_AT, text: build('يافع', String(TEEN_AT), 'male') },
    { key: 'adult', age: bounds.adult, text: build('راشد', String(bounds.adult), 'male') },
  ];
  const callBands = bands.map((b) => ({ ...b, key: b.key + '/call', text: build(b.key, String(b.age), 'male', 'call') }));
  const all = [...bands, ...callBands];

  // ── SECTION A · P-01 · ONE VERSE RULE, NOT TWO ────────────────────────────
  console.log('\n--- A. P-01 THE VERSE RULE DOES NOT CONTRADICT ITSELF ---');
  for (const b of all) {
    const hasOld = P01_OLD_ORDER.every((n) => b.text.includes(n));
    ok('[' + b.key + '] does NOT order the model to write verse text and surah name as prose', !hasOld,
      hasOld ? 'the superseded final-checklist clause is still emitted' : '');
  }
  for (const b of bands) {
    ok('[' + b.key + '] still carries the canonical empty-verse-tag rule',
      P01_CANONICAL.every((n) => b.text.includes(n)),
      'the contradiction must be removed by deleting the WRONG side, not the right one');
  }
  for (const b of bands) {
    ok('[' + b.key + '] states the verse rule with its document scope',
      P01_NEW_SCOPE.every((n) => b.text.includes(n)),
      'replacement clause absent');
  }
  // The rule is only coherent if the tag it points at is the empty one.
  ok('[adult] the canonical rule still shows the empty verse tag shape',
    bands[2].text.includes('<verse surah_num=') && bands[2].text.includes('></verse>'));

  // ── SECTION B · P-05 · AGE 13 BELONGS TO EXACTLY ONE BAND ─────────────────
  console.log('\n--- B. P-05 THE AGE BOUNDARY IS STATED ONCE AND CORRECTLY ---');

  // B1 — behaviour: the first teen age must actually receive the teen persona.
  ok('the first teen age receives the teen persona, not the young one',
    bands[1].text.includes('مع يافعٍ') && !bands[1].text.includes('مع صغيرٍ'),
    'age ' + TEEN_AT + ' resolved to the wrong persona');
  ok('the last young age receives the young persona',
    bands[0].text.includes('مع صغيرٍ') && !bands[0].text.includes('مع يافعٍ'),
    'age ' + YOUNG_MAX + ' resolved to the wrong persona');

  // B2 — prose: no band may print a young range that swallows the first teen age.
  const badRange = '٤–' + toArabicIndic(TEEN_AT);
  for (const b of all) {
    const hits = b.text.split(badRange).length - 1;
    ok('[' + b.key + '] never prints a young range ending at the first teen age', hits === 0,
      hits + ' occurrence(s) of the contradictory range');
  }

  // B3 — prose: where a young range IS printed, it must end at the derived last young age.
  const goodRange = '٤–' + toArabicIndic(YOUNG_MAX);
  const youngRangeUsers = all.filter((b) => b.text.includes('٤–'));
  ok('at least one band still states the young range in prose', youngRangeUsers.length > 0,
    'nothing to check — the range disappeared entirely');
  for (const b of youngRangeUsers) {
    const others = b.text.split('٤–').length - 1;
    const good = b.text.split(goodRange).length - 1;
    ok('[' + b.key + '] every printed young range ends at the derived last young age', others === good,
      good + ' correct of ' + others + ' printed ranges');
  }

  // B4 — the document feature must not be granted and denied to the same age.
  const teenPlus = 'للأعمار ' + toArabicIndic(TEEN_AT) + ' سنةً فأكثر فقط';
  for (const b of all) {
    if (!b.text.includes(teenPlus)) continue;
    ok('[' + b.key + '] the document feature is not granted to and withheld from the same age',
      !b.text.includes(badRange),
      'the same line grants the feature at ' + TEEN_AT + ' and bans it for a range that includes ' + TEEN_AT);
  }

  // B5 — the teen persona must state a range that starts at the derived threshold.
  ok('the teen persona states a range starting at the runtime threshold',
    bands[1].text.includes('(' + toArabicIndic(TEEN_AT) + '–'),
    'teen band label disagrees with index.html');

  return finish();
}

// ── REQUIRED MUTANTS ────────────────────────────────────────────────────────
// Each one puts a specific defect BACK and requires this guard to notice. A mutant that fails to
// apply is reported as a hard error, never as a pass: a no-op mutation that "kills" nothing is
// the exact false green these sections exist to prevent.
async function mutants() {
  console.log('\n--- C. REQUIRED MUTANTS ---');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-par-a-prompt-'));
  const original = fs.readFileSync(PROMPT_FILE, 'utf8');

  async function mutant(name, mutate, check) {
    const changed = mutate(original);
    if (changed === original) {
      fail++; failures.push('MUTANT ' + name + ' seam moved');
      console.log('  FAIL  MUTANT ' + name + ': seam moved, mutation did not apply');
      return;
    }
    const file = path.join(temp, 'prompt-' + name + '.mjs');
    fs.writeFileSync(file, changed, 'utf8');
    const mod = await import(pathToFileURL(file).href + '?v=' + Date.now() + '-' + name);
    const survived = check(mod.buildSystemPrompt);
    ok('MUTANT KILLED: ' + name, !survived, 'the defect was reintroduced and this guard stayed green');
  }

  const bounds = teenThresholdFromIndex();
  const YOUNG_MAX = bounds.teen - 1;

  // M1 — put the superseded verse order back. Section A must go red.
  await mutant('p01-restore-prose-verse-order',
    (src) => src.replace(
      '١. **عند ذكر آية خارج وسم <document>**',
      '١. **عند ذكر آية**: اذكر اسم السورة ورقم الآية كاملاً. مَثَلًا. **عند ذكر آية خارج وسم <document>**',
    ),
    (build) => {
      const t = build('x', '18', 'male');
      return P01_OLD_ORDER.every((n) => t.includes(n)) === false;
    });

  // M2 — push the young range back over the first teen age. Section B must go red.
  await mutant('p05-restore-overlapping-young-range',
    (src) => src.replace(
      'مع صغيرٍ (٤–' + toArabicIndic(YOUNG_MAX) + ' سنوات)',
      'مع صغيرٍ (٤–' + toArabicIndic(bounds.teen) + ' سنوات)',
    ),
    (build) => {
      const t = build('x', String(YOUNG_MAX), 'male');
      return !t.includes('٤–' + toArabicIndic(bounds.teen));
    });

  fs.rmSync(temp, { recursive: true, force: true });
}

function finish() {
  console.log('\n=== ' + pass + '/' + (pass + fail) + ' — ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ===');
  if (fail) {
    console.log('-- FAILURES --');
    for (const f of failures) console.log('   ' + f);
  }
  return fail === 0;
}

(async () => {
  try {
    await run();
    if (process.argv.includes('--mutants')) await mutants();
    console.log('\n=== FINAL ' + pass + '/' + (pass + fail) + ' — ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ===');
    process.exit(fail === 0 ? 0 : 1);
  } catch (e) {
    console.error('GUARD ERROR:', e && e.stack ? e.stack : e);
    process.exit(1);
  }
})();
