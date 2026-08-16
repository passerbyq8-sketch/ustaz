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
const FINALIZE = path.join(ROOT, 'lib', 'finalize-reader-text.js');

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

  // ── C. THE CONSUMER (أ-٧ / CI-03) ─────────────────────────────────────────
  //
  // A and B prove the two finalisers REPORT a REBUILT outcome. They cannot prove anybody acts on
  // it, and for a long time nobody did: lib/finalize-reader-text.js computed `screened.text` and
  // then discarded it, because every code the screen reported made the result fatal one branch
  // later. So a rebuilt, safe, sourced answer was replaced by the blanket refusal on every path —
  // the reporting was honest and the delivery was not. This drives the CONSUMER and asserts that
  // the rebuilt text reaches the reader and that `degraded` reaches the caller with it.
  console.log('\n--- C. lib/finalize-reader-text.js — the consumer of both verdicts ---');
  const FIN = await esm(FINALIZE);
  const REBUILT_CTX = {
    pageTexts: ['قال ابن باز إن الجمع بين الصلاتين للمسافر جائز، وهو قول جمهور أهل العلم.'],
    entity: 'ابن باز', subjectEntity: '', identityStatus: 'verified', identityVerified: true,
    sourceLicence: ['ibn-baz'],
  };
  // Sentence 1 is an attributed ruling the page carries. Sentence 2 is the app weighing the views
  // in its own voice, which the screen drops. One survives, so the verdict is REBUILT, not REFUSED.
  const REBUILT_DRAFT = 'قال ابنُ بازٍ إنّ الجمعَ بين الصلاتين للمسافرِ جائزٌ. '
    + 'والراجحُ عندي في هذه المسألةِ خلافُ ذلك.';
  const rebuilt = FIN.finalizeReaderText({
    kind: 'answer', text: REBUILT_DRAFT, sources: [], consistencyContext: REBUILT_CTX,
  });
  ok('C1 the fixture still produces a REBUILT screen verdict, not a whole drop',
    C.screenDraft(REBUILT_DRAFT, REBUILT_CTX).outcome === 'REBUILT',
    'the fixture no longer exercises the rule: ' + JSON.stringify(C.screenDraft(REBUILT_DRAFT, REBUILT_CTX).outcome));
  ok('C2 the rebuilt text is DELIVERED, not replaced by the blanket refusal',
    rebuilt.ok === true && rebuilt.text !== FIN.FINALIZER_REFUSAL,
    JSON.stringify({ ok: rebuilt.ok, text: rebuilt.text.slice(0, 90) }));
  ok('C3 ...and it is the attributed sentence that survived',
    rebuilt.text.includes('الجمعَ بين الصلاتين للمسافرِ جائزٌ')
      && !rebuilt.text.includes('والراجحُ عندي'),
    JSON.stringify(rebuilt.text.slice(0, 140)));
  ok('C4 the caller is told it was degraded, and how',
    Array.isArray(rebuilt.degraded) && rebuilt.degraded.some((d) => /consistency-dropped/.test(String(d))),
    'degraded=' + JSON.stringify(rebuilt.degraded));
  ok('C5 the outcome travels with it', rebuilt.outcome === 'REBUILT',
    'outcome=' + JSON.stringify(rebuilt.outcome));

  // dropWhole must remain fatal. The relaxation above is scoped to a verdict that kept something.
  const refused = FIN.finalizeReaderText({
    kind: 'answer', text: 'والحكمُ في هذه المسألةِ أنّه واجبٌ بلا خلاف.', sources: [],
    consistencyContext: { pageTexts: [], entity: 'فلان', subjectEntity: 'فلان', identityStatus: 'unknown' },
  });
  ok('C6 a whole drop is STILL fatal and still refuses explicitly',
    refused.ok === false && refused.text === FIN.FINALIZER_REFUSAL && refused.outcome === 'REFUSED',
    JSON.stringify({ ok: refused.ok, outcome: refused.outcome }));

  // ── D. THE FLIPPED LAW (merge §٤ / L1) ────────────────────────────────────
  //
  // EVERYTHING ABOVE STAYS TRUE AND MUST. A through C are the LEGACY finalisers, which the free
  // path does not use and this round does not touch: with FREE_BRAIN_V1 off, api/ask.js runs
  // exactly what it ran on 40f540e. «غياب النص الباقي ⇒ رفض» is still their law.
  //
  // WHAT FLIPS IS WHICH PATH THAT LAW GOVERNS. On the reviewer's path the same input produces the
  // opposite outcome, and the pairing is the proof: the SAME sentence A8 refuses to a blank, and
  // the SAME draft B1 drops, are both DELIVERED here — visibly tagged as understanding rather
  // than presented as a fatwa. A refusal is the last rung, not the first.
  console.log('\n--- D. the replaced law: on the reviewer path nothing is refused to a blank ---');
  const LAW = require('./replaced-law-lib.cjs');
  const loop = await LAW.fresh(LAW.LOOP, 'xfail-flip');

  // A8's fixture: the takhrij WAS the whole sentence, so the legacy lock leaves nothing.
  const A8_LEGACY = T.lockTakhrij('رواه الترمذيُّ.', [PAGE]);
  const a8Free = await LAW.driveFreeTurn({ module: loop, answer: 'رواه الترمذيُّ.' });
  ok('D1 the legacy lock still refuses that sentence to an empty string',
    A8_LEGACY.outcome === 'REFUSED' && A8_LEGACY.text.trim() === '', JSON.stringify(A8_LEGACY.outcome));
  ok('D2 FLIPPED — the reviewer path delivers the same sentence instead of blanking it',
    a8Free.text.trim().length > 0 && a8Free.text.includes('الترمذيُّ'), JSON.stringify(a8Free.text));

  // B1's fixture: one offending sentence among clean ones, no subject entity to escalate on.
  const B1_DRAFT = 'الصلاةُ ركنٌ من أركانِ الإسلام. والحكمُ في هذه المسألةِ أنّه واجبٌ بلا خلاف.';
  const b1Legacy = C.screenDraft(B1_DRAFT, { pageTexts: [], entity: '', subjectEntity: '', identityStatus: 'unknown' });
  const b1Free = await LAW.driveFreeTurn({ module: loop, answer: B1_DRAFT });
  ok('D3 the legacy screen still drops the offending sentence',
    (b1Legacy.droppedSentences || []).length > 0 || b1Legacy.dropWhole === true,
    JSON.stringify(b1Legacy.problems));
  ok('D4 FLIPPED — the reviewer keeps that sentence and tags it as understanding',
    b1Free.text.includes('واجبٌ بلا خلاف') && b1Free.text.includes('【فهمٌ لا فتوى】'),
    JSON.stringify(b1Free.text));
  ok('D5 ...and reports it as a tagged understanding, not as a drop',
    (b1Free.verdict?.counts || {})['tagged-fiqh-understanding'] >= 1
      && b1Free.verdict?.usedLastResort === false,
    JSON.stringify(b1Free.verdict?.counts));

  // The loop imports the reviewer STATICALLY (deliberately — see lib/free-brain/review.js), so a
  // reviewer twin cannot be swapped underneath a loop twin. The mutant is therefore measured on
  // the reviewer's own contract, which is where the law being restored actually lives: does the
  // sentence D4 just proved survives, still survive?
  const reviewerTwin = await LAW.mutate({
    file: LAW.REVIEWER,
    name: 'unsourced-ruling-refused-again-direct',
    transform: (source) => source.replace(
      /^ {8}let reviewed = part;$/mu,
      "        let reviewed = ''; // mutant: the old law — an unsourced ruling is refused, not tagged"),
    check: (twin) => {
      const out = twin.reviewAnswer({ text: B1_DRAFT, evidence: [], domain: 'fiqh', mode: 'عادي' });
      return out.text.includes('واجبٌ بلا خلاف') && out.text.includes('【فهمٌ لا فتوى】');
    },
  });
  ok('D6 mutant restoring «nothing survives ⇒ refuse» applies', reviewerTwin.changed, reviewerTwin.error);
  ok('D7 mutant twin loads', reviewerTwin.loaded, reviewerTwin.error);
  ok('D8 MUTANT KILLED — the unsourced ruling cannot be blanked again',
    reviewerTwin.loaded && reviewerTwin.survived === false, JSON.stringify(reviewerTwin));
}

// ── MUTANTS ─────────────────────────────────────────────────────────────────
async function mutants() {
  console.log('\n--- C. REQUIRED MUTANTS ---');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-par-a-xfail-'));

  // ── THE MUTANT NEVER TOUCHES THE TRACKED TREE (أ-٧ / CI-17) ───────────────
  //
  // This used to write `<module>.__mutant__.js` NEXT TO the original, inside lib/, and delete it
  // afterwards. A read-only gate was therefore writing into the working tree; `git status` was
  // dirty for the duration of every run, and a kill between the write and the `rmSync` left a
  // mutant sitting beside the module it mutates. The reason it was written there at all was to
  // keep the module's own relative imports resolvable — so the fix is to make the imports
  // resolvable from anywhere instead: rewrite each relative specifier to an ABSOLUTE file URL
  // pointing back at the real tree, then write the mutant into an OS temp directory.
  function importableFrom(file, source) {
    const dir = path.dirname(file);
    return source.replace(/from\s+(['"])(\.[^'"]*)\1/gu, (_all, quote, specifier) =>
      `from ${quote}${pathToFileURL(path.resolve(dir, specifier)).href}${quote}`);
  }

  async function mutate(name, file, apply, check) {
    const original = fs.readFileSync(file, 'utf8');
    const changed = apply(original);
    if (changed === original) {
      fail++; failures.push('MUTANT ' + name + ' seam moved');
      console.log('  FAIL  MUTANT ' + name + ': seam moved, mutation did not apply');
      return;
    }
    const twin = path.join(temp, path.basename(file).replace(/\.js$/, '.__mutant__.mjs'));
    fs.writeFileSync(twin, importableFrom(file, changed), 'utf8');
    let survived = true;
    try {
      const mod = await esm(twin);
      survived = await check(mod);
    } catch (e) { survived = false; }
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
