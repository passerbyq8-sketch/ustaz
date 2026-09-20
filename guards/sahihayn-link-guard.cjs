// guards/sahihayn-link-guard.cjs — a bare ascription to the Ṣaḥīḥayn must be about THIS matn.
//
// THE MEASURED FAILURE, 20 September 2026. The owner read, on his own screen, the answer to
// «هل يجوز صيام يوم السبت تطوعًا؟». It carried:
//
//     «ويؤيد هذا أيضا ما ثبت في الصحيحين: كان رسول الله صلى الله عليه وسلم يصوم يوم السبت ويوم الأحد.»
//
// That narration is NOT in the Ṣaḥīḥayn. The sentence ascribed it to the two books whose names
// end an argument in this subject, and `lockTakhrij` — the seat whose whole purpose is to delete
// a takhrij nobody published — read the span, judged it, and passed it.
//
// WHY IT PASSED, measured locally with no network and no model. The span was found correctly
// (`SPAN_COUNT=1 · attribution · «في الصحيحين»`) and the bytes were in order. The defect was one
// condition in `lib/takhrij-lock.js`, which asked whether the page named both Shaykhs ANYWHERE
// and never whether THIS matn had been ascribed to them. The Ibn Bāz page displayed under that
// answer names al-Bukhārī and Muslim in unrelated passages, and that was enough:
//
//     page naming both Shaykhs in other passages  → CLEAN    removed=[]        ← the defect
//     page naming neither                         → REFUSED  removed=[«في الصحيحين»]
//     no sources at all                           → REFUSED  removed=[«في الصحيحين»]
//
// THE RULE THIS PINS. The bare forms — «متفق عليه» · «في الصحيحين» · «الصحيحين» — are supported
// only where ONE passage of a fetched page names both Shaykhs AND talks about the matn being
// claimed: adjacency and word overlap together, never either alone. Every other phrase, and
// every other road through the lock, is untouched by this rule and guarded elsewhere.
//
// AND THE FOURTH CASE IS THE REGRESSION GUARD. A page that really does ascribe this matn to both
// Shaykhs must still pass exactly as it did before. A patch that buys the three refusals by
// silencing true ascriptions has not fixed this defect, it has moved it.
//
// Usage: node guards/sahihayn-link-guard.cjs
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..');
const LOCK_REL = 'lib/takhrij-lock.js';
const LOCK_ABS = path.join(REPO, LOCK_REL);
let failures = 0, checks = 0;

function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}

// ── THE MEASURED SENTENCE, AND THE PAGES IT WAS JUDGED AGAINST ───────────────
// The claim the owner saw, byte for byte.
const CLAIM = 'ويؤيد هذا أيضا ما ثبت في الصحيحين: كان رسول الله صلى الله عليه وسلم يصوم يوم السبت ويوم الأحد.';
// The same claim wearing the other bare form, to prove «متفق عليه» travels the same road.
const CLAIM_AGREED = 'ويؤيد هذا أيضا ما ثبت أنه متفق عليه: كان رسول الله صلى الله عليه وسلم يصوم يوم السبت ويوم الأحد.';

// A page that names BOTH Shaykhs — in passages about other narrations entirely. This is the
// owner's case: the two names are present, and the page never ascribed this matn to them.
const PAGE_BOTH_ELSEWHERE = 'أخرجه البخاري في كتاب آخر، ورواه مسلم في موضع آخر.';
// A page that names neither.
const PAGE_NEITHER = 'الحديث الوارد في النهي شاذ مخالف للأحاديث الصحيحة.';
// A page that ascribes THIS matn to both Shaykhs. This one must survive untouched, forever.
const PAGE_ASCRIBES = 'أخرجه البخاري ومسلم عن النبي صلى الله عليه وسلم أنه كان يصوم يوم السبت '
  + 'ويوم الأحد ويقول إنهما يوما عيد للمشركين.';

// A page where the matn IS discussed and BOTH Shaykhs are named, but the two names sit far apart —
// the second one hundreds of characters away, in a passage of its own. Adjacency is the only
// condition that refuses this page, so it is the witness that keeps that condition alive.
const FAR_FILLER = 'وقد تكلم أهل العلم على هذا الباب بكلام طويل في مسائل الصيام وأحكامه وما يتصل '
  + 'به من النوافل والفرائض وبيان أقوال الفقهاء في ذلك على وجه التفصيل الذي لا يخفى على من طالع '
  + 'كتب الفقه وشروح السنة وتتبع مذاهب أهل العلم في هذه المسألة وما جاء فيها من الآثار والأخبار '
  + 'وأقوال السلف رحمهم الله تعالى ورضي عنهم أجمعين في كل ما تقدم ذكره من هذه الأحكام. ';
const PAGE_FAR_APART = 'أخرجه البخاري وحده. كان يصوم يوم السبت ويوم الأحد كما جاء في الباب. '
  + FAR_FILLER + 'ورواه مسلم في موضع بعيد عن هذا كله.';

const esmUrl = (abs) => 'file:///' + abs.replace(/\\/g, '/');

(async function main() {
  console.log('=== sahihayn-link-guard — the Ṣaḥīḥayn are named about THIS matn, or not at all ===');

  if (!fs.existsSync(LOCK_ABS)) {
    console.log('\n=== 0/1 — FAIL (lib/takhrij-lock.js missing) ===');
    process.exit(1);
  }
  const LOCK = await import(esmUrl(LOCK_ABS));
  ok('exports lockTakhrij()', typeof LOCK.lockTakhrij === 'function');

  // The span is found, and it is found as an attribution. If this ever stops being true the four
  // cases below would pass for the wrong reason — nothing to judge is not the same as judging.
  const spans = LOCK.takhrijSpans(CLAIM);
  ok('the claim carries exactly one attribution span, and it is the bare Ṣaḥīḥayn form',
    spans.length === 1 && spans[0].kind === 'attribution' && spans[0].phrase === 'في الصحيحين',
    JSON.stringify(spans));
  const spansAgreed = LOCK.takhrijSpans(CLAIM_AGREED);
  ok('...and the «متفق عليه» form carries exactly one attribution span too',
    spansAgreed.length === 1 && spansAgreed[0].kind === 'attribution'
      && spansAgreed[0].phrase === 'متفق عليه',
    JSON.stringify(spansAgreed));

  // ── 1. THE OWNER'S CASE ────────────────────────────────────────────────────
  // Both names on the page, in other passages. This is the byte-for-byte reproduction of what
  // reached his screen, and it is the whole reason this file exists.
  const c1 = LOCK.lockTakhrij(CLAIM, [{ passage: PAGE_BOTH_ELSEWHERE }]);
  ok('1 both Shaykhs named elsewhere on the page does NOT establish this ascription',
    c1.outcome !== 'CLEAN', 'outcome=' + c1.outcome + ' text=' + c1.text);
  ok('1 ...and the refusal names the phrase it refused',
    Array.isArray(c1.removed)
      && c1.removed.some((r) => r.phrase === 'في الصحيحين' && r.kind === 'attribution'),
    JSON.stringify(c1.removed));

  // ── 2. A PAGE THAT NAMES NEITHER ───────────────────────────────────────────
  const c2 = LOCK.lockTakhrij(CLAIM, [{ passage: PAGE_NEITHER }]);
  ok('2 a page naming neither Shaykh does not establish it',
    c2.outcome !== 'CLEAN', 'outcome=' + c2.outcome + ' text=' + c2.text);

  // ── 3. NO SOURCES AT ALL ───────────────────────────────────────────────────
  const c3 = LOCK.lockTakhrij(CLAIM, []);
  ok('3 with no fetched page at all it is not established',
    c3.outcome !== 'CLEAN', 'outcome=' + c3.outcome + ' text=' + c3.text);

  // ── 4. THE REGRESSION GUARD, AND IT IS THE WHOLE RISK ──────────────────────
  // A true, published ascription of THIS matn to both Shaykhs. It passed before this rule and it
  // passes after it. A patch that reds this row is refused however many false ascriptions it
  // catches — over-refusing costs the reader an answer he was entitled to.
  const c4 = LOCK.lockTakhrij(CLAIM, [{ passage: PAGE_ASCRIBES }]);
  ok('4 REGRESSION: a page that really ascribes this matn to both Shaykhs still passes',
    c4.outcome === 'CLEAN' && Array.isArray(c4.removed) && c4.removed.length === 0,
    'outcome=' + c4.outcome + ' removed=' + JSON.stringify(c4.removed));
  ok('4 ...and the sentence reaches the reader byte-identical',
    c4.text === CLAIM, JSON.stringify(c4.text));

  // ── 5. «متفق عليه» TRAVELS THE SAME ROAD, BOTH WAYS ────────────────────────
  const c5 = LOCK.lockTakhrij(CLAIM_AGREED, [{ passage: PAGE_BOTH_ELSEWHERE }]);
  ok('5 «متفق عليه» over a page that names both elsewhere is refused exactly the same',
    c5.outcome !== 'CLEAN'
      && c5.removed.some((r) => r.phrase === 'متفق عليه' && r.kind === 'attribution'),
    'outcome=' + c5.outcome + ' removed=' + JSON.stringify(c5.removed));
  const c5b = LOCK.lockTakhrij(CLAIM_AGREED, [{ passage: PAGE_ASCRIBES }]);
  ok('5 ...and it still passes where the page really does ascribe this matn to both',
    c5b.outcome === 'CLEAN' && c5b.removed.length === 0 && c5b.text === CLAIM_AGREED,
    'outcome=' + c5b.outcome + ' removed=' + JSON.stringify(c5b.removed));

  // ── 6. THE TWO NAMES MUST SHARE ONE PASSAGE, NOT ONE PAGE ──────────────────
  // This page discusses the matn AND names both Shaykhs, but hundreds of characters apart. It is
  // the only case that distinguishes «near each other» from «on the same page», and without it
  // the adjacency condition could be deleted with every other row still green.
  const c6 = LOCK.lockTakhrij(CLAIM, [{ passage: PAGE_FAR_APART }]);
  ok('6 both Shaykhs on one page but in different passages is not one ascription',
    c6.outcome !== 'CLEAN', 'outcome=' + c6.outcome + ' text=' + c6.text);

  // ── 7. THE MUTANTS ─────────────────────────────────────────────────────────
  // Each one deletes a piece of the rule from a COPY of the module and drives the real function
  // over the real fixtures. `alive` is «the property still holds under the mutation»; a mutant
  // that leaves every property standing is a piece of rule nothing is guarding.
  {
    const src = fs.readFileSync(LOCK_ABS, 'utf8');
    const absolutise = (source) => source.replace(
      /from\s+(['"])(\.[^'"]*)\1/gu,
      (_all, quote, spec) => 'from ' + quote
        + esmUrl(path.resolve(path.dirname(LOCK_ABS), spec)) + quote,
    );
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-sahihayn-mut-'));
    const drive = async (name, apply, survives) => {
      const changed = apply(src);
      if (changed === src) {
        ok('MUTANT ' + name, false, 'seam moved: the mutation did not apply, so nothing was tested');
        return;
      }
      const file = path.join(dir, name.replace(/[^a-z0-9-]/gi, '_') + '.mjs');
      fs.writeFileSync(file, absolutise(changed), 'utf8');
      let alive = true;
      try { alive = await survives(await import(esmUrl(file))); }
      catch { alive = false; }
      ok('MUTANT KILLED: ' + name, !alive, 'the mutant survived — this property is not guarded');
    };

    try {
      // M-1 — THE THRESHOLD IS TURNED OFF. Requiring zero shared words is the old rule wearing
      // the new rule's shape: both names anywhere, nothing about the matn. The property is «the
      // owner's page does not establish the ascription».
      await drive('the-shared-word-threshold-is-turned-off',
        (s) => s.replace('const SAHIHAYN_SHARED_WORDS = 3;', 'const SAHIHAYN_SHARED_WORDS = 0;'),
        async (mod) => mod.lockTakhrij(CLAIM, [{ passage: PAGE_BOTH_ELSEWHERE }]).outcome !== 'CLEAN');

      // M-2 — ADJACENCY IS DELETED. The two names may then sit at opposite ends of the page and
      // still count as one passage. Case 6 above is its witness.
      await drive('the-adjacency-condition-is-deleted',
        (s) => s.replace('      if (hi - lo > SAHIHAYN_WINDOW_CHARS) continue;', '      if (false) continue;'),
        async (mod) => mod.lockTakhrij(CLAIM, [{ passage: PAGE_FAR_APART }]).outcome !== 'CLEAN');

      // M-3 — THE OVERLAP TEST IS DELETED. A window containing both names is accepted whatever it
      // says, which is precisely the condition that shipped the defect.
      await drive('the-shared-word-condition-is-deleted',
        (s) => s.replace(
          '      if (shared.size >= SAHIHAYN_SHARED_WORDS) return true;',
          '      return true;'),
        async (mod) => mod.lockTakhrij(CLAIM, [{ passage: PAGE_BOTH_ELSEWHERE }]).outcome !== 'CLEAN');

      // M-4 — THE SENTENCE IS NOT HANDED OVER. Dropping the third argument at the call site makes
      // every bare ascription fail closed; the regression row is what notices.
      await drive('the-sentence-is-not-handed-to-the-rule',
        (s) => s.replace('!supported(sp.phrase, hay, body)', '!supported(sp.phrase, hay)'),
        async (mod) => mod.lockTakhrij(CLAIM, [{ passage: PAGE_ASCRIBES }]).outcome === 'CLEAN');
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp only */ }
    }
  }

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL' : ' — PASS') + ' ===');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
