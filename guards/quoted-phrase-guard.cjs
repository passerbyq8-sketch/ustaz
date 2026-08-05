// guards/quoted-phrase-guard.cjs — ask the mushaf before calling a phrase unknown.
//
// THE MEASURED FAILURE (batch 2, incident 4). «ما تفسير «فإن مع العسر يسرًا»؟» was REFUSED.
//
// WHY. lib/claim-gate.js exists because of a real defect: «حكم قول يا معطي لا تبطي» was answered
// with a confident verdict hung on pages that never mention the expression. Its rule — a quoted
// span is a SPECIFIC expression, and no specific verdict may be given unless a retrieved page
// addresses that expression — is correct and must not be weakened.
//
// But the rule was applied to a phrase that is not an unknown expression at all. «فإن مع العسر
// يسرًا» is Sūrat al-Sharḥ 94:5. Without «قوله تعالى» in front of it there was nothing to tell the
// gate that, so a reader who quoted the Book was told that no source addressing the expression had
// been found. The app owns quran-uthmani.json — 6,236 āyāt — and never asked it.
//
// THE FIX THIS PINS. Before the specific-claim path decides a quoted phrase is unknown, the phrase
// is normalised and matched DETERMINISTICALLY against the mushaf and against adhkar.json. A full
// match, or a contiguous run inside one āyah or one dhikr, means the phrase is Qur'an or a known
// dhikr — so the question goes to its own path and is not treated as an unattested expression.
// No model, no network, no cost.
//
// WHAT MUST NOT MOVE. «يا معطي لا تبطي» is in neither corpus, so it stays exactly on the path the
// claim gate put it on. This guard asserts BOTH directions, because a change that fixed the verse
// by disabling the gate would pass a one-sided test.
//
// Usage: node guards/quoted-phrase-guard.cjs
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

const Q_TAFSIR = 'ما تفسير «فإن مع العسر يسرًا»؟';
const Q_FOLK = 'ما حكم قول «يا معطي لا تبطي»؟';
const Q_DHIKR = 'ما حكم قول «سبحان الله وبحمده سبحان الله العظيم»؟';

(async function main() {
  console.log('=== quoted-phrase-guard — ask the mushaf before calling a phrase unknown ===');

  const FT = await esm('lib/frozen-text.js');
  const CG = await esm('lib/claim-gate.js');
  const SP = await esm('lib/source-purpose.js');

  // ── 1. THE CORPORA ARE ACTUALLY CONSULTED, AND THEY ARE COMPLETE ───────────
  const quran = JSON.parse(read('quran-uthmani.json'));
  ok('the mushaf is the whole mushaf (6,236 āyāt)', Object.keys(quran).length === 6236,
    'got ' + Object.keys(quran).length);
  ok('a verse is matched with no «قوله تعالى» to help it',
    (FT.classifyFrozenPhrase('فإن مع العسر يسرًا') || {}).kind === 'quran');
  ok('...and the match is CONTIGUOUS, not a bag of shared words',
    FT.classifyFrozenPhrase('يسرا العسر مع فإن') === null,
    'a reordered phrase is not a quotation');
  ok('a known dhikr is matched too',
    (FT.classifyFrozenPhrase('سبحان الله وبحمده سبحان الله العظيم') || {}).kind === 'dhikr');
  ok('the check is deterministic — no model, no network',
    !/\bfetch\s*\(|callModel|anthropic/i.test(read('lib/frozen-text.js')));

  // ── 2. THE VERSE IS NO LONGER AN «UNKNOWN EXPRESSION» ──────────────────────
  const sTafsir = CG.detectSubject(Q_TAFSIR);
  ok('a quoted āyah is NOT treated as an unattested specific expression',
    sTafsir.specific === false,
    JSON.stringify(sTafsir));
  ok('...and it is recognised as Qur\'an, with its reference',
    sTafsir.frozen && sTafsir.frozen.kind === 'quran' && sTafsir.frozen.ref === '94:5',
    JSON.stringify(sTafsir.frozen));
  ok('...so the question routes to TAFSIR',
    SP.classifyPurpose(Q_TAFSIR) === 'tafsir', SP.classifyPurpose(Q_TAFSIR));

  // The whole point: with `specific` false, verifyClaims can no longer refuse the reply for
  // lacking a page that rules on «the expression».
  const reply = 'معنى الآية أن مع الشدة فرجًا، وقد كررها الله تعالى تأكيدًا لهذا المعنى.';
  const v = CG.verifyClaims(reply, sTafsir, [{ title: 'تفسير سورة الشرح', passage: 'قوله تعالى فإن مع العسر يسرا أي مع الشدة فرجا ويسرا' }]);
  ok('a tafsir answer about the āyah is no longer refused', v.ok === true,
    JSON.stringify(v.problems));

  // ── 3. THE EXPRESSION THAT IS NOT IN EITHER CORPUS DOES NOT MOVE ───────────
  const sFolk = CG.detectSubject(Q_FOLK);
  ok('«يا معطي لا تبطي» is still a SPECIFIC expression', sFolk.specific === true,
    JSON.stringify(sFolk));
  ok('...and is NOT claimed to be Qur\'an or a dhikr', !sFolk.frozen, JSON.stringify(sFolk.frozen));
  ok('...and its subject is still captured as before',
    typeof sFolk.subject === 'string' && sFolk.subject.indexOf('معطي') !== -1, sFolk.subject);
  // The claim gate must still refuse a specific verdict with no supporting page. THIS IS THE
  // ASSERTION THE ORIGINAL DEFECT BOUGHT, and it is re-pinned here rather than removed.
  const badReply = 'قول «يا معطي لا تبطي» مستحب وهو من أفضل الدعاء.';
  const v2 = CG.verifyClaims(badReply, sFolk, [
    { title: 'مسألة حول الدعاء بأسماء الله الحسنى', passage: 'الدعاء باسماء الله الحسنى مشروع دل عليه الكتاب والسنة' },
  ]);
  ok('a specific verdict with no page addressing the expression is STILL refused',
    v2.ok === false && v2.problems.some((p) => /specific-verdict-without-matching-source/.test(p)),
    JSON.stringify(v2.problems));

  // ── 4. THE WORDING IS ATTESTED; A RULING ABOUT IT IS NOT ───────────────────
  //
  // A corpus hit proves the WORDING is established. It proves nothing about whether saying those
  // words at a particular moment is prescribed — and inventing that verdict is precisely what this
  // gate was written to stop. So a hit is RECORDED on every path, and it releases the gate only
  // when the reader is not asking for a ruling.
  const sDhikr = CG.detectSubject(Q_DHIKR);
  ok('a known dhikr is recognised as such', sDhikr.frozen && sDhikr.frozen.kind === 'dhikr',
    JSON.stringify(sDhikr.frozen));
  ok('...but a RULING question about it keeps the specific-claim gate',
    sDhikr.specific === true, JSON.stringify(sDhikr));
  ok('...and its subject is still captured for the gate to check pages against',
    typeof sDhikr.subject === 'string' && sDhikr.subject.indexOf('سبحان') !== -1, sDhikr.subject);

  // The measured case the shipped claim-guard already pins, restated here so the two guards agree:
  // «اللهم صل على محمد» is adhkar.json #53 AND the question is a ruling about when to say it.
  const sSalah = CG.detectSubject('ما حكم قول «اللهم صل على محمد» بعد الأذان؟');
  ok('a ruling question about a dhikr in the corpus is STILL specific',
    sSalah.specific === true, JSON.stringify(sSalah));

  // And the release is real for a meaning question about the same kind of text.
  const sMeaning = CG.detectSubject('ما معنى «سبحان الله وبحمده سبحان الله العظيم»؟');
  ok('a MEANING question about a known dhikr is released to its own path',
    sMeaning.specific === false && sMeaning.frozen && sMeaning.frozen.kind === 'dhikr',
    JSON.stringify(sMeaning));

  // ── 5. THE FLOOR — half the language appears somewhere in the mushaf ───────
  for (const short of ['الحمد لله', 'يا الله', 'بسم الله']) {
    ok('a short common formula is NOT claimed as Qur\'an: «' + short + '»',
      FT.classifyFrozenPhrase(short) === null,
      JSON.stringify(FT.classifyFrozenPhrase(short)));
  }

  // ── 6. WIRING ──────────────────────────────────────────────────────────────
  ok('lib/claim-gate.js consults the corpora', /frozen-text\.js/.test(read('lib/claim-gate.js')));

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL' : ' — PASS') + ' ===');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
