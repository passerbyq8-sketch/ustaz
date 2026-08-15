// guards/explicit-failure-par-a-guard.cjs — X-013/z: nothing is deleted in silence.
//
// THE RULE. When either finaliser has to drop something a reader would otherwise have read, it may
// not simply hand back the remainder. It must (1) make ONE marked repair attempt, and then (2)
// either rebuild the text whole or refuse explicitly — and either way say that it degraded.
//
// WHY MID-SENTENCE SURGERY IS THE DEFECT AND NOT THE REPAIR. lockTakhrij used to excise the
// unsupported takhrij phrase and ship the rest of the sentence. «رواه البخاري» removed from
// «والحديث صحيح رواه البخاري» does not leave a weaker claim, it leaves «والحديث صحيح» — the
// grading now reads as the answer's own settled position, with the attribution that could have
// been checked gone. That is a STRONGER and falser claim than the one that failed. The same
// reasoning is already written into hybrid-deen's majority gate, which rebuilds the whole summary
// rather than deleting the offending clause. This gate generalises it to both finalisers.
//
// Offline and deterministic. Usage: node guards/explicit-failure-par-a-guard.cjs [--mutants]

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const TAKHRIJ = path.join(ROOT, 'lib', 'takhrij-lock.js');
const CONSISTENCY = path.join(ROOT, 'lib', 'policy', 'consistency-gate.js');

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

// ── FIXTURES ────────────────────────────────────────────────────────────────
// A page that supports ONE grading and says nothing about the other.
const PAGE = {
  title: 'صفحةٌ موثوقة',
  passage: 'حديثُ إنّما الأعمالُ بالنيّات رواه البخاريُّ ومسلم. وهو حديثٌ صحيحٌ متّفقٌ عليه.',
};
// Sentence 1 is supported by the page. Sentence 2 credits a collector the page never mentions,
// and it is long enough to SURVIVE having that credit cut out — which is exactly the case where
// the old code shipped a silently strengthened claim.
const DRAFT = 'حديثُ إنّما الأعمالُ بالنيّات رواه البخاريُّ ومسلم. '
  + 'وحديثُ صلاةِ الليلِ في هذا البابِ حديثٌ صحيحٌ ثابتٌ عن النبيِّ صلّى الله عليه وسلّم رواه الترمذيُّ وابنُ ماجه.';
const FORBIDDEN_CREDIT = 'الترمذيُّ';

async function suite() {
  console.log('=== explicit-failure-par-a-guard -- X-013/z: no silent deletion in either finaliser ===');

  const T = await esm(TAKHRIJ);
  const C = await esm(CONSISTENCY);

  // ── A. takhrij-lock ───────────────────────────────────────────────────────
  console.log('\n--- A. lib/takhrij-lock.js ---');
  const locked = T.lockTakhrij(DRAFT, [PAGE]);
  ok('A1 the lock still detects the unsupported takhrij at all',
    (locked.removed || []).length + (locked.droppedSentences || []).length > 0,
    'nothing was flagged, so the fixture no longer exercises the rule');

  ok('A2 it does NOT excise the credit and ship the surrounding claim',
    !(locked.text.includes('حديثٌ صحيحٌ ثابتٌ') && !locked.text.includes(FORBIDDEN_CREDIT)),
    'mid-sentence surgery: the grading survived while its attribution was cut away');

  ok('A3 it reports an explicit outcome, not just a shorter string',
    typeof locked.outcome === 'string' && ['CLEAN', 'REBUILT', 'REFUSED'].includes(locked.outcome),
    'outcome=' + JSON.stringify(locked.outcome));

  ok('A4 it marks the single repair attempt it made',
    locked.repairAttempted === true, 'repairAttempted=' + JSON.stringify(locked.repairAttempted));

  ok('A5 it always reports degraded when it changed the reader text',
    Array.isArray(locked.degraded) && locked.degraded.length > 0,
    'degraded=' + JSON.stringify(locked.degraded));

  ok('A6 the surviving text is built from whole sentences only',
    !locked.text.includes(' .') && !/[،؛]\s*$/.test(locked.text.trim()),
    JSON.stringify(locked.text.slice(0, 120)));

  // A clean draft must stay untouched and say so.
  const clean = T.lockTakhrij('حديثُ إنّما الأعمالُ بالنيّات رواه البخاريُّ ومسلم.', [PAGE]);
  ok('A7 a clean draft is returned whole, with outcome CLEAN and no degraded',
    clean.outcome === 'CLEAN' && (clean.degraded || []).length === 0
      && clean.text.includes('البخاريُّ'),
    JSON.stringify({ outcome: clean.outcome, degraded: clean.degraded }));

  // When the takhrij WAS the whole sentence and nothing substantive survives, refuse explicitly.
  const nothingLeft = T.lockTakhrij('رواه الترمذيُّ.', [PAGE]);
  ok('A8 when nothing substantive survives it refuses explicitly rather than returning a stub',
    nothingLeft.outcome === 'REFUSED' && nothingLeft.text.trim() === '',
    JSON.stringify({ outcome: nothingLeft.outcome, text: nothingLeft.text }));

  // ── B. consistency-gate ───────────────────────────────────────────────────
  console.log('\n--- B. lib/policy/consistency-gate.js ---');
  // A draft where one sentence offends and others do not, with no subject entity to escalate on.
  const CTX = { pageTexts: [], entity: '', subjectEntity: '', identityStatus: 'unknown' };
  const mixed = 'الصلاةُ ركنٌ من أركانِ الإسلام. والحكمُ في هذه المسألةِ أنّه واجبٌ بلا خلاف.';
  const screened = C.screenDraft(mixed, CTX);

  ok('B1 the screen still drops the offending sentence',
    (screened.droppedSentences || []).length > 0 || screened.dropWhole === true,
    'the fixture no longer triggers the rule: ' + JSON.stringify(screened.problems));

  if ((screened.droppedSentences || []).length > 0 || screened.dropWhole) {
    ok('B2 it reports an explicit outcome',
      typeof screened.outcome === 'string' && ['CLEAN', 'REBUILT', 'REFUSED'].includes(screened.outcome),
      'outcome=' + JSON.stringify(screened.outcome));
    ok('B3 it marks the single repair attempt it made',
      screened.repairAttempted === true, 'repairAttempted=' + JSON.stringify(screened.repairAttempted));
    ok('B4 it always reports degraded when sentences were dropped',
      Array.isArray(screened.degraded) && screened.degraded.length > 0,
      'degraded=' + JSON.stringify(screened.degraded));
  }

  // A genuinely clean sentence. NOT «الصلاةُ ركنٌ من أركانِ الإسلام.» — that carries a ruling with
  // no source in this context and is correctly refused, which is the rule working, not a fixture.
  const cleanDraft = C.screenDraft('هذا بابٌ من أبوابِ العلمِ النافع.', CTX);
  ok('B5 a clean draft keeps outcome CLEAN and reports no degraded',
    cleanDraft.outcome === 'CLEAN' && (cleanDraft.degraded || []).length === 0,
    JSON.stringify({ outcome: cleanDraft.outcome, degraded: cleanDraft.degraded }));

  ok('B6 a wholly dropped draft refuses explicitly',
    (() => {
      const r = C.screenDraft(mixed, { ...CTX, subjectEntity: 'فلان', entity: 'فلان' });
      return r.dropWhole ? r.outcome === 'REFUSED' && r.text === '' : true;
    })(), 'dropWhole did not map to an explicit refusal outcome');
}

// ── MUTANTS ─────────────────────────────────────────────────────────────────
async function mutants() {
  console.log('\n--- C. REQUIRED MUTANTS ---');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-par-a-xfail-'));

  async function mutate(name, file, apply, check) {
    const original = fs.readFileSync(file, 'utf8');
    const changed = apply(original);
    if (changed === original) {
      fail++; failures.push('MUTANT ' + name + ' seam moved');
      console.log('  FAIL  MUTANT ' + name + ': seam moved, mutation did not apply');
      return;
    }
    // Keep the module's own imports resolvable by writing the mutant beside the original.
    const twin = file.replace(/\.js$/, '.__mutant__.js');
    fs.writeFileSync(twin, changed, 'utf8');
    let survived = true;
    try {
      const mod = await esm(twin);
      survived = await check(mod);
    } catch (e) { survived = false; }
    finally { fs.rmSync(twin, { force: true }); }
    ok('MUTANT KILLED: ' + name, !survived, 'the defect was reintroduced and this gate stayed green');
  }

  // M1 — put mid-sentence surgery back: excise the unsupported credit and ship the claim that was
  // sitting around it. This is the exact defect X-013/z removes, so A2 must go red.
  await mutate('takhrij-restore-mid-sentence-surgery', TAKHRIJ,
    (s) => s.replace(
      `    cuts.push({ start: sen.start, end: sen.end });
    droppedSentences.push({ text: body.trim(), spans: unsupported.map((x) => x.phrase) });
    for (const sp of unsupported) removed.push({ kind: sp.kind, phrase: sp.phrase });`,
      `    for (const sp of unsupported) {
      cuts.push({ start: sen.start + sp.start, end: sen.start + sp.end });
      removed.push({ kind: sp.kind, phrase: sp.phrase });
    }`),
    (mod) => {
      const r = mod.lockTakhrij(DRAFT, [PAGE]);
      // "Survived" is A2's own assertion re-evaluated: if it still holds under the mutant, the
      // gate did not notice the defect. It must not hold.
      return !(r.text.includes('حديثٌ صحيحٌ ثابتٌ') && !r.text.includes(FORBIDDEN_CREDIT));
    });

  // M2 — consistency-gate goes back to reporting no outcome at all.
  await mutate('consistency-drops-outcome', CONSISTENCY,
    (s) => s.replace('outcome: dropWhole ? \'REFUSED\' : \'REBUILT\',', ''),
    (mod) => {
      const r = mod.screenDraft('الصلاةُ ركنٌ من أركانِ الإسلام. والحكمُ في هذه المسألةِ أنّه واجبٌ بلا خلاف.',
        { pageTexts: [], entity: '', subjectEntity: '', identityStatus: 'unknown' });
      return typeof r.outcome === 'string';
    });

  fs.rmSync(temp, { recursive: true, force: true });
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
