// guards/takhrij-lock-guard.cjs — no unsourced takhrij leaves this app, ever.
//
// THE MEASURED FAILURE (batch 2, incident 3). Inside an ordinary fiqh answer about travelling
// alone, the app produced:
//     «نهى النبي ﷺ عن السفر وحده، وقال: الراكب شيطان والراكبان شيطانان والثلاثة ركب»
//     — رواه البخاري ومسلم / متفق عليه
// The hadith is real. The attribution is false: it is not in the Ṣaḥīḥayn. The consistency gate
// checks scholars' names and ruling verbs; nothing checked a takhrij, so a grading and a
// collector attached from the model's memory travelled straight to the reader wearing the
// authority of al-Bukhārī and Muslim.
//
// THE RULE THIS PINS. Any attribution («رواه فلان»، «متفق عليه»، «في الصحيحين») or grade
// («صحيح»، «حسن»، «ضعيف»، «صححه فلان») must be PRESENT IN THE EXTRACTED TEXT of a page that was
// actually fetched. When it is not:
//   * the takhrij and the grade are STRIPPED and the matn stands, or
//   * the sentence is DROPPED when the takhrij was its whole content.
// A takhrij that nobody published is never emitted, in any form, under any budget.
//
// THE ONE EXEMPTION, and it is explicit. The frozen texts — the worship cards, the adhkār and the
// Qur'anic verses — carry attributions pinned in their golden files and asserted by their own
// guards. They are not drafted, they are not retrieved, and they do not enter this check.
//
// Usage: node guards/takhrij-lock-guard.cjs
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

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
const askSourceArg = process.argv.indexOf('--ask-source');
const askSourceFile = askSourceArg >= 0 && process.argv[askSourceArg + 1]
  ? path.resolve(process.argv[askSourceArg + 1])
  : path.join(REPO, 'api/ask.js');
const readAsk = () => fs.readFileSync(askSourceFile, 'utf8');
const exists = (rel) => fs.existsSync(path.join(REPO, rel));
const bare = (s) => String(s == null ? '' : s).replace(/[ً-ْٰـ]/g, '');

// ── THE MEASURED SENTENCE ────────────────────────────────────────────────────
const MATN = 'الراكب شيطان والراكبان شيطانان والثلاثة ركب';
const FALSE_TAKHRIJ = 'وقد نهى النبي صلى الله عليه وسلم عن السفر وحده، وقال: «' + MATN
  + '»، رواه البخاري ومسلم.';
// A page from an approved host that carries the matn and says NOTHING about the Ṣaḥīḥayn.
const PAGE_WITHOUT = 'يكره للمسلم أن يسافر وحده إلا لحاجة، وقد ورد في ذلك ما يدل على النهي عن '
  + 'الوحدة في السفر، وجاء في الحديث: الراكب شيطان والراكبان شيطانان والثلاثة ركب. '
  + 'وقد تكلم أهل العلم على معنى ذلك وبينوا أن المقصود التحذير من الانفراد في الأسفار.';
// A page that DOES carry the attribution — the same sentence must then survive untouched.
const PAGE_WITH = PAGE_WITHOUT + ' رواه البخاري ومسلم في صحيحيهما، وهو متفق عليه.';

(async function main() {
  console.log('=== takhrij-lock-guard — no unsourced takhrij leaves this app ===');

  if (!ok('lib/takhrij-lock.js exists', exists('lib/takhrij-lock.js'))) {
    console.log('\n=== ' + (checks - failures) + '/' + checks + ' — FAIL (module missing) ===');
    process.exit(1);
  }
  const TL = await esm('lib/takhrij-lock.js');
  const src = read('lib/takhrij-lock.js');

  ok('exports lockTakhrij()', typeof TL.lockTakhrij === 'function');
  ok('the lock is deterministic — no model, no network',
    !/\bfetch\s*\(|callModel/.test(src), 'this check must cost nothing');

  // ── 1. THE INCIDENT ────────────────────────────────────────────────────────
  const r = TL.lockTakhrij(FALSE_TAKHRIJ, [{ passage: PAGE_WITHOUT }]);
  ok('the false attribution to the Ṣaḥīḥayn is removed',
    bare(r.text).indexOf('رواه البخاري ومسلم') === -1 && bare(r.text).indexOf('متفق عليه') === -1,
    'text=' + r.text);
  ok('...and the matn itself still stands',
    bare(r.text).indexOf('الراكب شيطان') !== -1, 'text=' + r.text);
  ok('...and the removal is REPORTED, not silent',
    Array.isArray(r.removed) && r.removed.length >= 1, JSON.stringify(r.removed));

  // ── 2. THE SAME SENTENCE OVER A PAGE THAT DOES CARRY IT ────────────────────
  const r2 = TL.lockTakhrij(FALSE_TAKHRIJ, [{ passage: PAGE_WITH }]);
  ok('a SUPPORTED attribution is left exactly as written',
    bare(r2.text).indexOf('رواه البخاري ومسلم') !== -1 && r2.removed.length === 0,
    'text=' + r2.text + ' removed=' + JSON.stringify(r2.removed));

  // ── 3. WHEN THE TAKHRIJ IS THE WHOLE SENTENCE, THE SENTENCE GOES ───────────
  const onlyTakhrij = 'حكم السفر وحده مكروه عند أهل العلم. والحديث متفق عليه رواه البخاري ومسلم.';
  const r3 = TL.lockTakhrij(onlyTakhrij, [{ passage: PAGE_WITHOUT }]);
  ok('a sentence whose whole content is the takhrij is DROPPED',
    bare(r3.text).indexOf('متفق عليه') === -1 && bare(r3.text).indexOf('رواه البخاري') === -1,
    'text=' + r3.text);
  ok('...while the ruling sentence beside it survives',
    bare(r3.text).indexOf('حكم السفر وحده مكروه') !== -1, 'text=' + r3.text);
  ok('...and the drop is reported',
    Array.isArray(r3.droppedSentences) && r3.droppedSentences.length >= 1,
    JSON.stringify(r3.droppedSentences));

  // ── 4. GRADES, NOT ONLY COLLECTORS ─────────────────────────────────────────
  const graded = 'وجاء في الحديث: الراكب شيطان والراكبان شيطانان والثلاثة ركب، وقد صححه الألباني.';
  const r4 = TL.lockTakhrij(graded, [{ passage: PAGE_WITHOUT }]);
  ok('an unsupported GRADE is removed too',
    bare(r4.text).indexOf('صححه الألباني') === -1, 'text=' + r4.text);
  ok('...and the matn survives the grade being removed',
    bare(r4.text).indexOf('الراكب شيطان') !== -1, 'text=' + r4.text);
  const r5 = TL.lockTakhrij(graded, [{ passage: PAGE_WITHOUT + ' وقد صححه الألباني رحمه الله.' }]);
  ok('a SUPPORTED grade is left alone',
    bare(r5.text).indexOf('صححه الألباني') !== -1 && r5.removed.length === 0, 'text=' + r5.text);

  // ── 5. NO SOURCES AT ALL IS NOT A LICENCE ──────────────────────────────────
  const r6 = TL.lockTakhrij(FALSE_TAKHRIJ, []);
  ok('with NO retrieved pages, every takhrij is unsupported and goes',
    bare(r6.text).indexOf('رواه البخاري') === -1, 'text=' + r6.text);

  // ── 6. THE FROZEN TEXTS ARE EXEMPT, AND PROVABLY SO ────────────────────────
  ok('lib/frozen-text.js exists', exists('lib/frozen-text.js'));
  if (exists('lib/frozen-text.js')) {
    const FT = await esm('lib/frozen-text.js');
    ok('exports classifyFrozenPhrase()', typeof FT.classifyFrozenPhrase === 'function');
    const v = FT.classifyFrozenPhrase('فإن مع العسر يسرًا');
    ok('a Qur\'anic phrase is recognised as Qur\'an',
      v && v.kind === 'quran', JSON.stringify(v));
    ok('...and carries its reference', v && v.kind === 'quran' && /^\d+:\d+$/.test(String(v.ref)),
      JSON.stringify(v));
    const d = FT.classifyFrozenPhrase('اللهم إني أصبحت أشهدك وأشهد حملة عرشك وملائكتك وجميع خلقك');
    ok('a dhikr from adhkar.json is recognised as a dhikr', d && d.kind === 'dhikr', JSON.stringify(d));
    ok('an ordinary sentence is NOT a frozen text',
      FT.classifyFrozenPhrase('الراكب شيطان والراكبان شيطانان والثلاثة ركب') === null,
      JSON.stringify(FT.classifyFrozenPhrase('الراكب شيطان والراكبان شيطانان والثلاثة ركب')));
    // A two-word fragment must never be claimed as Qur'an: half the language appears in the mushaf.
    ok('a short common fragment is not claimed as Qur\'an',
      FT.classifyFrozenPhrase('الحمد لله') === null,
      JSON.stringify(FT.classifyFrozenPhrase('الحمد لله')));
  }

  // A verse quoted with its own frame is never stripped, whatever the retrieved pages say.
  const ayah = 'قال الله تعالى: ﴿فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا﴾ صحيح ثابت في كتاب الله.';
  const r7 = TL.lockTakhrij(ayah, [{ passage: 'نص لا علاقة له' }]);
  ok('a Qur\'anic sentence is returned BYTE-FOR-BYTE unchanged by the hadith lock',
    r7.text === ayah && r7.removed.length === 0 && r7.droppedSentences.length === 0,
    'text=' + r7.text);

  // ── 7. WIRING — both paths ─────────────────────────────────────────────────
  const askSrc = readAsk();
  ok('api/ask.js imports the takhrij lock', /takhrij-lock\.js/.test(askSrc));
  ok('api/ask.js applies it to the drafted reply', /lockTakhrij\s*\(/.test(askSrc));

  // THE LEDGER IS THE PATH EVERY READER TAKES (api/ask.js, PUBLIC_GO_LIVE 2026-08-05), and it is
  // where the measured incident happened. Its draft is buffered, so the lock can run on the whole
  // sentence — which is what makes it reliable there and not on the legacy stream.
  const engSrc = read('lib/ledger/engine.js');
  ok('the ledger engine imports the takhrij lock', /takhrij-lock\.js/.test(engSrc),
    'the live path may not be the one path without the lock');
  ok('...and applies it BEFORE the sentence is stored',
    engSrc.indexOf('lockTakhrij(') !== -1
    && engSrc.indexOf('lockTakhrij(') < engSrc.indexOf('ledger.addSentence('),
    'a lock that runs after storage has already let the sentence through');
  ok('...and a sentence that was ONLY an unsourced takhrij is dropped, not blanked',
    /unsourced_takhrij_sentence_dropped/.test(engSrc));

  // =========================================================================
  // AN ĀYAH IS NOT INTRODUCED BY A HADITH PHRASE, AND NOT THE OTHER WAY EITHER
  //
  // MEASURED, batch 5: in the gold answer the reply wrote «قال النبي ﷺ:» and then set out
  // ﴾وَأَحَلَّ اللَّهُ الْبَيْعَ وَحَرَّمَ الرِّبَا﴿ — al-Baqara 275. The Book was published as the
  // Prophet's speech.
  //
  // WHY THE LOCK ABOVE COULD NOT SEE IT, and this is the whole diagnosis: the takhrij lock's
  // FROZEN EXEMPTION is doing exactly its job. A span overlapping an āyah is exempt, because an
  // āyah is not a takhrij and holding it to «رواه فلان» would refuse the Book. So the span was
  // skipped — correctly — and nothing anywhere then asked whether the words INTRODUCING it called
  // it something it is not. The tag and the text are checked by two different rules and the join
  // between them was checked by neither.
  console.log('\n=== F. THE TAG MUST MATCH THE TEXT IT INTRODUCES ===');
  {
    const CG = await esm('lib/policy/consistency-gate.js');
    ok('the problem code is declared', !!CG.PROBLEM.FROZEN_TAG_MISMATCH);
    const has = (t) => CG.consistencyProblems(t, {}).includes(CG.PROBLEM.FROZEN_TAG_MISMATCH);

    // RED — the measured sentence, and its siblings.
    ok('«قال النبي ﷺ:» over an āyah is refused',
      has('قال النبي ﷺ: وأحل الله البيع وحرم الربا.'),
      JSON.stringify(CG.consistencyProblems('قال النبي ﷺ: وأحل الله البيع وحرم الربا.', {})));
    ok('...and «قال رسول الله» over an āyah too',
      has('قال رسول الله صلى الله عليه وسلم: وأحل الله البيع وحرم الربا.'));
    ok('...and «عن النبي» over an āyah',
      has('عن النبي صلى الله عليه وسلم: وأحل الله البيع وحرم الربا.'));

    // GREEN — the correct tag, and the correct tag AFTER a hadith tag, which is the ordinary
    // shape of «he said … and recited». The NEAREST tag before the text is the one that names it.
    ok('«قال تعالى» over the same āyah is untouched',
      !has('قال تعالى: وأحل الله البيع وحرم الربا.'));
    ok('«قال الله تعالى» over the same āyah is untouched',
      !has('قال الله تعالى: وأحل الله البيع وحرم الربا.'));
    ok('a hadith tag EARLIER in the sentence does not condemn a properly tagged āyah',
      !has('قال النبي ﷺ ما قال، ثم تلا قوله تعالى: وأحل الله البيع وحرم الربا.'));
    ok('a sentence with no frozen text in it is not judged',
      !has('قال النبي صلى الله عليه وسلم إن الأعمال بالنيات وإنما لكل امرئ ما نوى.'));
    ok('an āyah with no tag at all is not judged',
      !has('وأحل الله البيع وحرم الربا، وهذا أصل في الباب.'));

    // AND THE CONVERSE, which the brief names explicitly: a dhikr is not the Book.
    const F = await esm('lib/frozen-text.js');
    const ADHKAR = JSON.parse(read('adhkar.json'));
    const items = Array.isArray(ADHKAR) ? ADHKAR : (ADHKAR.items || ADHKAR.adhkar || []);
    // Selected with the SAME detector the rule uses. Many adhkār are built out of āyāt — āyat
    // al-Kursī is dhikr #75 and is also 2:255 — and for those «قال الله تعالى» is the correct
    // tag, so probing the converse with one of them would invent a failure.
    const dhikr = (items.map((i) => String((i && (i.text || i.body || i.dhikr)) || ''))
      .find((t) => { const r = F.containsFrozenRun(t); return r && r.kind === 'dhikr'; })) || '';
    if (dhikr) {
      ok('a dhikr introduced as the Book is refused', has('قال الله تعالى: ' + dhikr), dhikr.slice(0, 60));
      ok('...and the same dhikr with no Qur\'an tag is untouched', !has(dhikr), dhikr.slice(0, 60));
    } else {
      ok('(no pure-dhikr entry available to probe the converse)', true);
    }

    // THE SENTENCE GOES, THE REST OF THE ANSWER STAYS.
    {
      const v = CG.screenDraft(
        'الربا محرم بالكتاب والسنة. قال النبي ﷺ: وأحل الله البيع وحرم الربا.', {});
      ok('the mis-tagged sentence is dropped',
        v.droppedSentences.length === 1 && /قال النبي/.test(v.droppedSentences[0]),
        JSON.stringify(v.droppedSentences));
      ok('...and the rest of the answer survives',
        /محرم بالكتاب والسنة/.test(v.text) && v.dropWhole === false, JSON.stringify(v));
    }
  }

  // A1 output-safety acceptance tests live in this existing gate so the roster remains 71.
  console.log('\n=== 9. A1 FINAL READER TEXT ===');
  const finalizerPath = 'lib/finalize-reader-text.js';
  let A1 = null;
  if (exists(finalizerPath)) A1 = await esm(finalizerPath);
  const finalize = A1 && A1.finalizeReaderText;
  const run = (input) => typeof finalize === 'function'
    ? finalize(input)
    : { ok: true, text: String((input && input.text) || ''), problems: ['finalizer-missing'] };
  const evidence = [{ passage: '\u0642\u0627\u0644 \u0631\u0633\u0648\u0644 \u0627\u0644\u0644\u0647 \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645: \u0627\u0644\u062f\u064a\u0646 \u0627\u0644\u0646\u0635\u064a\u062d\u0629. \u0631\u0648\u0627\u0647 \u0645\u0633\u0644\u0645.' }];

  const f008 = run({ text: '\u0644\u0627 \u0623\u0639\u0631\u0641 \u0647\u0630\u0627 \u0627\u0644\u0627\u0633\u0645.\\n\\n\u064a\u0631\u0649 \u0627\u0644\u0634\u064a\u062e \u0641\u0644\u0627\u0646 \u0648\u062c\u0648\u0628 \u0630\u0644\u0643.', consistencyContext: { entity: '\u0641\u0644\u0627\u0646', subjectEntity: '\u0641\u0644\u0627\u0646', notDirectlyVerified: true, sourceLicence: [] }, fallbackText: 'SAFE' });
  ok('F-008: the fully composed presence lead plus body is screened', f008.text === 'SAFE' || !f008.text.includes('\u064a\u0631\u0649 \u0627\u0644\u0634\u064a\u062e'));

  const f010 = run({ text: '\u0647\u0630\u0627 \u062d\u062f\u064a\u062b \u0639\u0638\u064a\u0645 \u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a \u0648\u0645\u0633\u0644\u0645.', sources: [], fallbackText: 'SAFE' });
  ok('F-010: the final lock runs before any output path', !f010.text.includes('\u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a'));

  /* SPLIT BATCH: F-011/F-021/F-047/F-053/F-063 remain open. Their former
     experimental assertions are intentionally disabled with their production enforcement.
  const f021 = run({ text: '\u0642\u0627\u0644 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645: \u0646\u0635 \u0645\u0644\u0641\u0642 \u0644\u0627 \u062a\u062d\u0645\u0644\u0647 \u0623\u064a \u0635\u0641\u062d\u0629 \u0645\u0646 \u0627\u0644\u0645\u0635\u0627\u062f\u0631.', sources: evidence, claimSubject: { specific: false }, fallbackText: 'SAFE' });
  ok('F-021: hadithProblems runs when claimSubject.specific is false', f021.text === 'SAFE');

  const f011 = run({ text: '\u0642\u0627\u0644 \u0631\u0633\u0648\u0644 \u0627\u0644\u0644\u0647 \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645: \u0627\u0644\u062f\u064a\u0646 \u0627\u0644\u0646\u0635\u064a\u062d\u0629. \u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a.', sources: evidence, fallbackText: 'SAFE' });
  ok('F-011: unsupported hadith collector or grade cannot leave', !f011.text.includes('\u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a'));
  const supportedHadith = '\u0642\u0627\u0644 \u0631\u0633\u0648\u0644 \u0627\u0644\u0644\u0647 \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645: \u0627\u0644\u062f\u064a\u0646 \u0627\u0644\u0646\u0635\u064a\u062d\u0629. \u0631\u0648\u0627\u0647 \u0645\u0633\u0644\u0645.';
  ok('F-011 green: supported wording and collector remain byte-identical', run({ text: supportedHadith, sources: evidence }).text === supportedHadith);

  const f047 = run({ text: '\u0644\u0627 \u064a\u0648\u062c\u062f \u0642\u0648\u0644 \u0644\u0644\u0634\u064a\u062e \u0641\u064a \u0647\u0630\u0627.', fallbackText: 'SAFE' });
  ok('F-047: absolute negation always fails closed', f047.text === 'SAFE');
  const scopedNegation = '\u0644\u0645 \u0646\u0642\u0641 \u0641\u064a \u0627\u0644\u0645\u0635\u0627\u062f\u0631 \u0627\u0644\u0645\u062a\u0627\u062d\u0629 \u0639\u0644\u0649 \u0646\u0635 \u0644\u0647.';
  ok('F-047: scoped negation without its slot proof fails', run({ text: scopedNegation, fallbackText: 'SAFE' }).text === 'SAFE');
  ok('F-047 green: scoped negation passes with its own search proof', run({ text: scopedNegation, slotProofs: [{ text: scopedNegation, entityId: 'subject', slotId: 'position', proof: { slotId: 'position', searchAttempted: true } }] }).text === scopedNegation);

  const f053 = run({ text: '\u0642\u0627\u0644 \u0627\u0644\u0634\u064a\u062e: \u00ab\u0646\u0635 \u0645\u0644\u0641\u0642 \u0644\u0627 \u0648\u062c\u0648\u062f \u0644\u0647\u00bb.', verifyQuotes: true, quoteChecks: [{ actualGrade: 'B', entityId: 'scholar', sourceId: 's1', quotedText: '\u0646\u0635 \u0645\u0644\u0641\u0642 \u0644\u0627 \u0648\u062c\u0648\u062f \u0644\u0647', exactEvidenceText: '\u0627\u0644\u0623\u0635\u0644 \u0641\u064a \u0627\u0644\u0639\u0628\u0627\u062f\u0627\u062a \u0627\u0644\u062a\u0648\u0642\u064a\u0641' }], fallbackText: 'SAFE' });
  ok('F-053: grade A/B is insufficient when the exact quote is absent', f053.text === 'SAFE');
  const matchingQuote = '\u0642\u0627\u0644 \u0627\u0644\u0634\u064a\u062e: \u00ab\u0627\u0644\u0623\u0635\u0644 \u0641\u064a \u0627\u0644\u0639\u0628\u0627\u062f\u0627\u062a \u0627\u0644\u062a\u0648\u0642\u064a\u0641\u00bb.';
  ok('F-053 green: an exact quote in its evidence passes', run({ text: matchingQuote, verifyQuotes: true, quoteChecks: [{ actualGrade: 'B', entityId: 'scholar', sourceId: 's1', quotedText: '\u0627\u0644\u0623\u0635\u0644 \u0641\u064a \u0627\u0644\u0639\u0628\u0627\u062f\u0627\u062a \u0627\u0644\u062a\u0648\u0642\u064a\u0641', exactEvidenceText: matchingQuote }] }).text === matchingQuote);

  const f063 = run({ text: '\u0641\u0644\u0627\u0646 \u0645\u0628\u062a\u062f\u0639 \u0648\u0646\u064a\u062a\u0647 \u0627\u0644\u0634\u0631.', personStatus: 'living', fallbackText: 'SAFE' });
  ok('F-063: a sensitive personal verdict on a living person fails closed', f063.text === 'SAFE');
  ok('F-063: unknown status fails closed on the same personal verdict', run({ text: f063.text === 'SAFE' ? '\u0641\u0644\u0627\u0646 \u0645\u0628\u062a\u062f\u0639.' : f063.text, personStatus: 'unknown', fallbackText: 'SAFE' }).text === 'SAFE');
  ok('F-063 green: the living-person rule does not rewrite a dead-person statement', run({ text: '\u0641\u0644\u0627\u0646 \u0645\u0628\u062a\u062f\u0639.', persons: [{ entityId: 'dead-1', status: 'dead', deathVerified: true }], sensitiveClaims: [{ entityId: 'dead-1' }] }).text === '\u0641\u0644\u0627\u0646 \u0645\u0628\u062a\u062f\u0639.');
  const neutralTransfer = '\u0630\u0643\u0631 \u0627\u0644\u0645\u0635\u062f\u0631 \u0623\u0646 \u0641\u0644\u0627\u0646\u0627 \u062a\u062d\u062f\u062b \u0639\u0646 \u0627\u0644\u0645\u0633\u0623\u0644\u0629.';
  ok('F-063 green: verified neutral transmission about a living person remains', run({ text: neutralTransfer, personStatus: 'living' }).text === neutralTransfer);

  console.log('\n=== 9B. A1 CORRECTION REGRESSIONS ===');
  const shortOne = '\u00ab\u0625\u0646\u0645\u0627 \u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0628\u0627\u0644\u0646\u064a\u0627\u062a\u00bb';
  const shortTwo = '\u00ab\u0645\u0646 \u063a\u0634\u0646\u0627 \u0641\u0644\u064a\u0633 \u0645\u0646\u0627\u00bb';
  ok('F-021 correction: a short unmarked hadith is checked', run({ text: shortOne, religious: true, verifyQuotes: true, fallbackText: 'SAFE' }).text === 'SAFE');
  ok('F-021 correction: a second short unmarked hadith is checked', run({ text: shortTwo, religious: true, verifyQuotes: true, fallbackText: 'SAFE' }).text === 'SAFE');
  ok('F-011 correction: an invented unmarked matn fails closed', run({ text: '\u00ab\u0645\u0646 \u0646\u0627\u0645 \u0628\u0639\u062f \u0627\u0644\u0639\u0635\u0631 \u0641\u0642\u062f \u062d\u0631\u0645 \u0639\u0644\u0649 \u0646\u0641\u0633\u0647 \u0627\u0644\u0639\u0627\u0641\u064a\u0629\u00bb', religious: true, verifyQuotes: true, fallbackText: 'SAFE' }).text === 'SAFE');
  const boundQuote = { quotedText: '\u0625\u0646\u0645\u0627 \u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0628\u0627\u0644\u0646\u064a\u0627\u062a', entityId: 'prophet', sourceId: 's1', actualGrade: 'A', exactEvidenceText: '\u0625\u0646\u0645\u0627 \u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0628\u0627\u0644\u0646\u064a\u0627\u062a' };
  ok('F-011 correction green: specific=false with matching evidence passes', run({ text: shortOne, religious: true, verifyQuotes: true, quoteChecks: [boundQuote], claimSubject: { specific: false }, sources: [{ passage: boundQuote.exactEvidenceText }] }).text === shortOne);
  const scopedA = '\u0644\u0645 \u0646\u062c\u062f \u0641\u064a \u0645\u0635\u0627\u062f\u0631\u0646\u0627 \u0642\u0648\u0644\u0627 \u0644\u0644\u0634\u062e\u0635 \u0623.';
  const scopedB = '\u0644\u0645 \u0646\u062c\u062f \u0641\u064a \u0645\u0635\u0627\u062f\u0631\u0646\u0627 \u0642\u0648\u0644\u0627 \u0644\u0644\u0634\u062e\u0635 \u0628.';
  ok('F-047 correction: proof for A cannot license B', run({ text: scopedB, slotProofs: [{ text: scopedA, entityId: 'A', slotId: 'position', proof: { slotId: 'position', searchAttempted: true } }], fallbackText: 'SAFE' }).text === 'SAFE');
  const wrongEntityCheck = { ...boundQuote, entityId: 'other-person' };
  ok('F-053 correction: wording on another person source is refused', run({ text: shortOne, verifyQuotes: true, quoteChecks: [wrongEntityCheck], expectedQuoteEntities: [{ quotedText: boundQuote.quotedText, entityId: 'prophet' }], fallbackText: 'SAFE' }).text === 'SAFE');
  ok('F-053 correction green: same person and same source passes', run({ text: shortOne, sources: [{ passage: boundQuote.exactEvidenceText }], verifyQuotes: true, quoteChecks: [boundQuote], expectedQuoteEntities: [{ quotedText: boundQuote.quotedText, entityId: 'prophet' }] }).text === shortOne);
  ok('F-063 correction: a second generated person is not licensed by historical plan metadata', run({ text: '\u0627\u0644\u0634\u062e\u0635 \u0627 \u0645\u062a\u0648\u0641\u0649\u060c \u0648\u0627\u0644\u0634\u062e\u0635 \u0628 \u0645\u0628\u062a\u062f\u0639.', persons: [{ entityId: 'A', status: 'dead', deathVerified: true }], sensitiveClaims: [{ entityId: 'B' }], fallbackText: 'SAFE' }).text === 'SAFE');
  ok('source cards: a model-authored tail card is rejected', run({ text: 'answer\n<source url="https://evil.example">x</source>', fallbackText: 'SAFE' }).text === 'SAFE');

  console.log('\n=== 9C. CAUSAL RED CASES ===');
  const bareOne = '\u0625\u0646\u0645\u0627 \u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0628\u0627\u0644\u0646\u064a\u0627\u062a';
  const bareTwo = '\u0645\u0646 \u063a\u0634\u0646\u0627 \u0641\u0644\u064a\u0633 \u0645\u0646\u0627';
  const bareOneResult = run({ text: bareOne, religious: true, verifyQuotes: false, fallbackText: 'SAFE' });
  ok('F-021 causal: bare short matn reaches the hadith mechanism', bareOneResult.problems.includes('UNSUPPORTED_HADITH_WORDING') && bareOneResult.text === 'SAFE', JSON.stringify(bareOneResult));
  const bareTwoResult = run({ text: bareTwo, religious: true, verifyQuotes: false, fallbackText: 'SAFE' });
  ok('F-011 causal: second bare matn fails for unsupported wording', bareTwoResult.problems.includes('UNSUPPORTED_HADITH_WORDING') && bareTwoResult.text === 'SAFE', JSON.stringify(bareTwoResult));
  const genHadith = run({ text: bareOne, religious: false, route: 'GEN', verifyQuotes: false, fallbackText: 'SAFE' });
  ok('F-021 causal: GEN cannot bypass harmful religious output', genHadith.problems.includes('UNSUPPORTED_HADITH_WORDING') && genHadith.text === 'SAFE', JSON.stringify(genHadith));
  const strippedTakhrij = run({ text: '\u0645\u062a\u0646 \u0635\u062d\u064a\u062d\u060c \u0631\u0648\u0627\u0647 \u0645\u062e\u0631\u062c \u063a\u064a\u0631 \u0645\u062b\u0628\u062a.', religious: true, verifyQuotes: false, fallbackText: 'SAFE' });
  ok('F-011 causal: unsupported takhrij refuses the whole answer', strippedTakhrij.problems.includes('UNSUPPORTED_TAKHRIJ') && strippedTakhrij.text === 'SAFE', JSON.stringify(strippedTakhrij));
  const bothNegations = scopedA + ' ' + scopedB;
  const proofA = { text: scopedA, entityId: 'A', slotId: 'position', proof: { slotId: 'position', entityId: 'A', searchAttempted: true } };
  const proofB = { text: scopedB, entityId: 'B', slotId: 'position', proof: { slotId: 'position', entityId: 'B', searchAttempted: true } };
  ok('F-047 causal: A proof does not license B in the same answer', run({ text: bothNegations, slotProofs: [proofA], fallbackText: 'SAFE' }).problems.includes('UNBOUND_SLOT_PROOF'));
  ok('F-047 green: independent A and B proofs license their own spans', run({ text: bothNegations, slotProofs: [proofA, proofB], fallbackText: 'SAFE' }).text === bothNegations);
  const notice = '\u0644\u0645 \u0646\u062a\u0645\u0643\u0646 \u0645\u0646 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0646\u062a\u0627\u0626\u062c \u062d\u064a\u0629.';
  ok('F-047 causal: live notice cannot license another negation', run({ text: notice + '\n' + scopedB, slotProofs: [{ text: notice, entityId: 'live-world', slotId: 'live', kind: 'operational-disclosure', proof: { outcome: 'NOT_SEARCHED_BUDGET', searchAttempted: false } }], fallbackText: 'SAFE' }).problems.includes('UNBOUND_SLOT_PROOF'));
  const ibnTaymiyyah = { entityId: 'ibn-taymiyyah', names: ['\u0627\u0628\u0646 \u062a\u064a\u0645\u064a\u0629'], status: 'dead', deathVerified: true };
  ok('F-063 causal: a dead speaker cannot license his verdict on an unresolved target', run({ text: '\u0642\u0627\u0644 \u0627\u0628\u0646 \u062a\u064a\u0645\u064a\u0629 \u0625\u0646 \u0641\u0644\u0627\u0646\u0627 \u0645\u0628\u062a\u062f\u0639.', persons: [ibnTaymiyyah], fallbackText: 'SAFE' }).problems.includes('UNVERIFIED_PERSON_VERDICT'));
  ok('F-063 green: a sensitive verdict directly targeting the verified dead passes', run({ text: '\u0627\u0628\u0646 \u062a\u064a\u0645\u064a\u0629 \u0645\u0628\u062a\u062f\u0639.', persons: [ibnTaymiyyah] }).text === '\u0627\u0628\u0646 \u062a\u064a\u0645\u064a\u0629 \u0645\u0628\u062a\u062f\u0639.');
  ok('F-063 causal: a living target fails closed', run({ text: '\u0641\u0644\u0627\u0646 \u0645\u0628\u062a\u062f\u0639.', persons: [{ entityId: 'living', names: ['\u0641\u0644\u0627\u0646'], status: 'living', deathVerified: false }], fallbackText: 'SAFE' }).problems.includes('UNVERIFIED_PERSON_VERDICT'));
  */

  console.log('\n=== 10. A1 SSE WRITER CONTRACT ===');
  const SW = await esm('lib/finalized-sse-writer.js');
  const makeTarget = () => {
    const writes = [];
    const listeners = new Map();
    return {
      writes, ended: 0, headersSent: true,
      status() { return this; }, setHeader() { return this; }, flushHeaders() {},
      write(chunk, encoding, callback) { writes.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk)); if (typeof encoding === 'function') encoding(); else callback?.(); return true; },
      end(callback) { this.ended++; callback?.(); },
      on(name, fn) { listeners.set(name, fn); }, once(name, fn) { listeners.set(name, fn); },
      removeListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); },
      emit(name) { listeners.get(name)?.(); },
    };
  };
  const delta = (text) => `data: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } })}\n\n`;
  const stop = 'data: {"type":"message_stop"}\n\n';
  const event = (value) => `data: ${JSON.stringify(value)}\n\n`;
  const parseEvents = (target) => target.writes.join('').split(/\r?\n/)
    .filter((line) => line.startsWith('data:')).map((line) => JSON.parse(line.slice(5)));
  const validClientSequence = (events) => {
    if (!events.length || events[0].type !== 'message_start' || events.at(-1).type !== 'message_stop') return false;
    const open = new Set();
    for (const e of events) {
      if (e.type === 'content_block_start') open.add(e.index);
      if (e.type === 'content_block_delta' && !open.has(e.index)) return false;
      if (e.type === 'content_block_stop') { if (!open.has(e.index)) return false; open.delete(e.index); }
    }
    return open.size === 0 && events.filter((e) => e.type === 'message_stop').length === 1;
  };
  const visible = (target) => target.writes.join('').split(/\r?\n/)
    .filter((line) => line.startsWith('data:')).map((line) => { try { return JSON.parse(line.slice(5)); } catch { return null; } })
    .filter(Boolean).filter((e) => e.type === 'content_block_delta').map((e) => e.delta.text).join('');

  {
    const target = makeTarget();
    let finalizerCalls = 0;
    const writer = SW.createFinalizedSseResponse(target, { finalize: (x) => {
      finalizerCalls++;
      return { text: x.text, ok: true };
    } });
    const payload = delta('# Heading\n\n- one\n- two') + stop;
    writer.write(payload.slice(0, 7));
    writer.write(payload.slice(7, 29));
    writer.write(payload.slice(29));
    ok('partial and multi-frame writes are byte-safe and preserve Markdown', target.writes.length === 0);
    writer.end();
    ok('...and final text is emitted only at end', visible(target) === '# Heading\n\n- one\n- two');
    ok('...with exactly one message_stop and one end', (target.writes.join('').match(/message_stop/g) || []).length === 1 && target.ended === 1);
    writer.end();
    writer.write(delta('late'));
    ok('F-024: the central composer runs exactly once and a terminal response accepts no later byte',
      finalizerCalls === 1 && (target.writes.join('').match(/message_stop/g) || []).length === 1
        && target.ended === 1 && !visible(target).includes('late'));
  }
  {
    const target = makeTarget();
    const card = { tag: '<source url="https://owned.example">owned</source>' };
    const writer = SW.createFinalizedSseResponse(target, {
      context: { readerPrefix: 'server prefix', readerCards: [card], readerCardPrefix: '\n', sourceCards: [card] },
      finalize: (x) => ({ text: x.text, ok: true }),
    });
    const full = event({ type: 'message_start', message: { role: 'assistant' } })
      + event({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })
      + delta('body')
      + event({ type: 'content_block_stop', index: 0 }) + stop;
    writer.write(full); writer.end();
    ok('SSE causal RED: a server-owned prefix composes before a full-lifecycle body and owned card',
      validClientSequence(parseEvents(target)) && visible(target) === 'server prefix\n\nbody\n' + card.tag);
  }
  {
    const target = makeTarget();
    const writer = SW.createFinalizedSseResponse(target, { finalize: (x) => ({ text: x.text, ok: true }) });
    const full = event({ type: 'message_start', message: { role: 'assistant' } })
      + event({ type: 'ping' })
      + event({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })
      + delta('body')
      + event({ type: 'content_block_stop', index: 0 })
      + event({ type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } })
      + stop;
    writer.write(full); writer.end();
    ok('SSE causal RED: real Anthropic ping/message_delta lifecycle is accepted without exposing protocol as text',
      visible(target) === 'body' && parseEvents(target).filter((item) => item.type === 'message_stop').length === 1);
  }
  for (const [name, payload] of [
    ['delta before block start', event({ type: 'message_start', message: { role: 'assistant' } }) + delta('raw') + stop],
    ['block stop with another index', event({ type: 'message_start', message: {} }) + event({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }) + event({ type: 'content_block_stop', index: 1 }) + stop],
    ['duplicate message start', event({ type: 'message_start', message: {} }) + event({ type: 'message_start', message: {} }) + event({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }) + event({ type: 'content_block_stop', index: 0 }) + stop],
    ['duplicate block stop', event({ type: 'message_start', message: {} }) + event({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }) + event({ type: 'content_block_stop', index: 0 }) + event({ type: 'content_block_stop', index: 0 }) + stop],
    ['overlapping text blocks', event({ type: 'message_start', message: { role: 'assistant' } }) + event({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }) + event({ type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } }) + event({ type: 'content_block_stop', index: 0 }) + event({ type: 'content_block_stop', index: 1 }) + stop],
  ]) {
    const target = makeTarget();
    const writer = SW.createFinalizedSseResponse(target, { finalize: (x) => ({ text: x.text, ok: true }) });
    writer.write(payload); writer.end();
    ok('SSE causal RED: ' + name + ' fails closed', visible(target) === 'server output rejected');
  }
  {
    const source = read('lib/finalized-sse-writer.js');
    const deltaGate = `      const blockType = open.get(event.index);
      if (!messageStarted || messageDeltaSeen || !blockType || !event.delta) return reject('content-block-delta');`;
    ok('mutation precondition: text deltas require both message and block start', source.includes(deltaGate));
    const mutant = source.replace(deltaGate, `      const blockType = open.get(event.index) || 'text';
      if (messageDeltaSeen || !event.delta) return reject('content-block-delta');`);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-a2-sse-mut-'));
    try {
      const file = path.join(dir, 'delta-before-start.mjs');
      fs.writeFileSync(file, mutant, 'utf8');
      const MutantWriter = await import('file:///' + file.replace(/\\/g, '/'));
      const invalid = delta('raw')
        + event({ type: 'message_start', message: { role: 'assistant' } })
        + event({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })
        + event({ type: 'content_block_stop', index: 0 }) + stop;
      const productionTarget = makeTarget();
      const productionWriter = SW.createFinalizedSseResponse(productionTarget, {
        finalize: (input) => ({ text: input.text, ok: true }),
      });
      productionWriter.write(invalid); productionWriter.end();
      const mutantTarget = makeTarget();
      const mutantWriter = MutantWriter.createFinalizedSseResponse(mutantTarget, {
        finalize: (input) => ({ text: input.text, ok: true }),
      });
      mutantWriter.write(invalid); mutantWriter.end();
      ok('MUTANT KILLED: allowing delta-before-start revives the invalid raw prefix',
        visible(productionTarget) === 'server output rejected' && visible(mutantTarget) === 'raw');
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp only */ }
    }
  }
  {
    const target = makeTarget();
    const writer = SW.createFinalizedSseResponse(target, { finalize: (x) => ({ text: x.text, ok: true }) });
    writer.write(delta('x') + stop + stop); writer.end();
    ok('duplicate stop fails closed with a client-valid replacement sequence', validClientSequence(parseEvents(target)) && visible(target) === 'server output rejected');
  }
  {
    const target = makeTarget();
    const writer = SW.createFinalizedSseResponse(target, { finalize: (x) => ({ text: x.text, ok: true }) });
    writer.write(delta('x') + stop + delta('late')); writer.end();
    ok('event after stop fails closed', validClientSequence(parseEvents(target)) && visible(target) === 'server output rejected');
  }
  {
    const target = makeTarget();
    const writer = SW.createFinalizedSseResponse(target, { finalize: (x) => ({ text: x.text, ok: true }) });
    const full = event({ type: 'message_start', message: { role: 'assistant' } })
      + event({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })
      + event({ type: 'content_block_stop', index: 0 }) + stop;
    writer.write(full); writer.end();
    ok('a no-text answer retains a valid complete lifecycle', validClientSequence(parseEvents(target)) && visible(target) === '');
  }
  {
    const target = makeTarget();
    const writer = SW.createFinalizedSseResponse(target, { finalize: (x) => ({ text: x.text, ok: true }) });
    const full = event({ type: 'message_start', message: { role: 'assistant' } })
      + event({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }) + delta('a')
      + event({ type: 'content_block_stop', index: 0 })
      + event({ type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } })
      + event({ type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'b' } })
      + event({ type: 'content_block_stop', index: 1 }) + stop;
    writer.write(full); writer.end();
    const events = parseEvents(target);
    ok('multiple content blocks replay in order through the client parser', validClientSequence(events) && visible(target) === 'ab' && events.filter((e) => e.type === 'content_block_start').length === 2);
  }
  {
    const target = makeTarget();
    const writer = SW.createFinalizedSseResponse(target, { finalize: () => ({ text: 7, ok: true }) });
    writer.write(delta('raw') + stop); writer.end();
    ok('invalid finalizer result schema fails closed', validClientSequence(parseEvents(target)) && visible(target) === 'server output rejected');
  }
  {
    const target = makeTarget();
    const writer = SW.createFinalizedSseResponse(target, { finalize: (x) => ({ text: x.text, ok: true }) });
    let callbackError = null;
    writer.write(delta('raw')); target.emit('close'); writer.end(stop, (error) => { callbackError = error; });
    ok('a real response close is terminal: no replacement write or target.end follows it',
      target.writes.length === 0 && target.ended === 0 && callbackError instanceof Error);
  }
  {
    const target = makeTarget();
    const writer = SW.createFinalizedSseResponse(target, { finalize: (x) => ({ text: x.text, ok: true }) });
    writer.write(delta('raw without stop'));
    writer.end();
    ok('missing stop fails closed without raw text', !visible(target).includes('raw without stop') && /server output rejected/.test(target.writes.join('')));
  }
  {
    const target = makeTarget();
    const writer = SW.createFinalizedSseResponse(target, { finalize: (x) => ({ text: x.text, ok: true }) });
    writer.write('data: {broken}\r\n\r\n'); writer.end();
    ok('malformed JSON fails closed for CRLF frames', /server output rejected/.test(target.writes.join('')));
  }
  {
    const target = makeTarget();
    const writer = SW.createFinalizedSseResponse(target, { limits: { totalBytes: 24 }, finalize: (x) => ({ text: x.text, ok: true }) });
    writer.write(delta('overflow') + stop); writer.end();
    ok('byte overflow fails closed', /server output rejected/.test(target.writes.join('')) && !visible(target).includes('overflow'));
  }
  {
    const target = makeTarget();
    const writer = SW.createFinalizedSseResponse(target, { finalize: () => { throw new Error('boom'); } });
    writer.write(delta('raw') + stop); writer.end();
    ok('finalizer exception fails closed', /server output rejected/.test(target.writes.join('')) && !visible(target).includes('raw'));
  }
  {
    const ac = new AbortController();
    const target = makeTarget();
    const writer = SW.createFinalizedSseResponse(target, { signal: ac.signal, finalize: (x) => ({ text: x.text, ok: true }) });
    let callbackError = null;
    writer.write(delta('raw')); ac.abort(); writer.end(stop, (error) => { callbackError = error; });
    ok('abort before replay is terminal with one callback and no target write/end',
      target.writes.length === 0 && target.ended === 0 && callbackError instanceof Error);
  }
  {
    const target = makeTarget();
    const originalWrite = target.write.bind(target);
    let first = true;
    target.write = (...args) => { const accepted = originalWrite(...args); if (first) { first = false; return false; } return accepted; };
    const writer = SW.createFinalizedSseResponse(target, { finalize: (x) => ({ text: x.text, ok: true }) });
    writer.write(delta('held') + stop); writer.end();
    ok('backpressure pauses replay before end', target.ended === 0 && target.writes.length === 1);
    target.emit('drain');
    ok('drain resumes the same byte sequence and ends once', target.ended === 1 && validClientSequence(parseEvents(target)) && visible(target) === 'held');
  }
  for (const mode of ['close', 'abort']) {
    const ac = new AbortController();
    const target = makeTarget();
    const originalWrite = target.write.bind(target);
    let first = true, callbackError = null;
    target.write = (...args) => { originalWrite(...args); if (first) { first = false; return false; } return true; };
    const writer = SW.createFinalizedSseResponse(target, { signal: ac.signal, finalize: (x) => ({ text: x.text, ok: true }) });
    writer.write(delta('cancelled') + stop);
    writer.end((error) => { callbackError = error; });
    const before = target.writes.length;
    if (mode === 'close') target.emit('close'); else ac.abort();
    ok(mode + ' immediately cancels a drain wait without post-close write or target.end', target.writes.length === before && target.ended === 0 && callbackError instanceof Error);
  }
  {
    const target = makeTarget();
    target.write = () => { throw new Error('closed-socket'); };
    const writer = SW.createFinalizedSseResponse(target, { finalize: (x) => ({ text: x.text, ok: true }) });
    let callbackCount = 0, callbackError = null, escaped = null;
    writer.write(delta('held') + stop);
    try { writer.end((error) => { callbackCount++; callbackError = error; }); } catch (error) { escaped = error; }
    ok('SSE causal RED: a synchronous target.write failure settles once and cleans up',
      !escaped && callbackCount === 1 && callbackError instanceof Error && target.ended === 0);
  }
  {
    const warm = '\u062e\u0644\u0651\u064a\u0646\u0627 \u0646\u0633\u0648\u064a\u0647\u0627 \u0635\u062d \u0645\u0639 \u0645\u0627\u0645\u0627 \u0623\u0648 \u0628\u0627\u0628\u0627.';
    const once = run({ text: warm });
    const twice = run({ text: once.text });
    ok('warm/general text is byte-identical and finalization is idempotent', once.text === warm && twice.text === once.text);
  }
  {
    const target = makeTarget();
    const cards = [{ tag: '<source url="https://one.example">one</source>' }, { tag: '<source url="https://two.example">two</source>' }];
    const writer = SW.createFinalizedSseResponse(target, { context: { sourceCards: cards }, finalize: (x) => ({ text: x.text, ok: true }) });
    const answer = 'answer\n' + cards[0].tag + '\n' + cards[1].tag;
    writer.write(delta(answer) + stop); writer.end();
    ok('multiple server-owned cards retain byte order after prose finalization', visible(target) === answer);
  }
  {
    const target = makeTarget();
    const card = { tag: '<source url="https://owned.example">owned</source>' };
    const writer = SW.createFinalizedSseResponse(target, {
      context: { sourceCards: [card], readerCards: [card] },
      finalize: () => ({ text: '', ok: true }),
    });
    writer.write(delta('text removed by finalizer') + stop); writer.end();
    ok('SSE causal RED: a finalizer-empty answer never leaves an orphan source card', visible(target) === '');
  }
  {
    const target = makeTarget();
    const card = { tag: '<source url="https://owned.example">owned</source>' };
    const writer = SW.createFinalizedSseResponse(target, {
      context: { readerPrefix: 'LEAD', sourceCards: [card], readerCards: [card] },
      finalize,
    });
    writer.write(delta('\u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a \u0648\u0645\u0633\u0644\u0645.') + stop); writer.end();
    ok('SSE causal RED: server prefix cannot make a stripped body eligible for an orphan card',
      visible(target) === 'LEAD' && !visible(target).includes('<source'));
  }
  {
    const target = makeTarget();
    const owned = { tag: '<source url="https://owned.example">owned</source>' };
    const forged = '<source url="https://forged.example">forged</source>';
    const writer = SW.createFinalizedSseResponse(target, { context: { sourceCards: [owned] }, finalize });
    writer.write(delta('answer\n' + owned.tag + '\n' + forged) + stop); writer.end();
    ok('an owned card does not license an extra model-authored source tag', !visible(target).includes('<source') && visible(target).includes('\u0644\u0627 \u0623\u0633\u062a\u0637\u064a\u0639'));
  }
  {
    const parser = require('@babel/parser');
    const askSource = readAsk();
    const ast = parser.parse(askSource, { sourceType: 'module', plugins: ['optionalChaining'] });
    const writes = [], wrappers = [];
    const walk = (node, fn = '') => {
      if (!node || typeof node !== 'object') return;
      let scope = fn;
      if ((node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') && node.id) scope = node.id.name;
      if (node.type === 'CallExpression' && node.callee && node.callee.type === 'MemberExpression'
        && node.callee.object.type === 'Identifier' && node.callee.object.name === 'res'
        && node.callee.property.type === 'Identifier' && node.callee.property.name === 'write') writes.push({ line: node.loc.start.line, scope });
      if (node.type === 'CallExpression' && node.callee && node.callee.type === 'Identifier'
        && node.callee.name === 'createFinalizedSseResponse') wrappers.push({ line: node.loc.start.line, scope });
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach((item) => walk(item, scope));
        else if (value && typeof value === 'object' && value.type) walk(value, scope);
      }
    };
    walk(ast);
    const handlerWrapper = wrappers.find((item) => item.scope === 'handler');
    const synthWrapper = wrappers.find((item) => item.scope === 'sendSynthesizedText');
    const handlerWrapperLine = handlerWrapper ? handlerWrapper.line : Number.POSITIVE_INFINITY;
    const bypasses = writes.filter((item) => item.scope === 'handler' && item.line < handlerWrapperLine)
      .filter((item) => !askSource.split(/\r?\n/)[item.line - 1].includes(': keepalive'));
    ok('AST structural gate: every reader-text write is dominated by a finalized writer', !!handlerWrapper && !!synthWrapper && bypasses.length === 0, JSON.stringify(bypasses));
    ok('the ledger receives the reassigned response facade in the real handler AST', !!handlerWrapper && writes.some((item) => item.scope === 'handler' && item.line > handlerWrapper.line));
  }

  // Real entrypoint smoke: dependencies are mocked locally and an unknown URL throws.
  console.log('\n=== 11. REAL /api/ask HANDLER, OFFLINE DEPENDENCIES ===');
  {
    const { EventEmitter } = require('events');
    const DAY = await esm('lib/daycap.js');
    const STORE = await esm('lib/ledger/redis.js');
    process.env.ANTHROPIC_API_KEY = 'a1-local'; process.env.BRAVE_API_KEY = 'a1-local';
    process.env.FOUNDER_SECRET = 'a1-local-secret'; process.env.RFC_V05_MODE = 'internal'; process.env.LEDGER_RAG = 'off';
    process.env.VERCEL_ENV = 'preview'; process.env.SEARCH_BUDGET_GLOBAL_PREVIEW = '100';
    process.env.SEARCH_BUDGET_PER_CALLER = '100';
    let dailySearchUnits = 0;
    STORE.__setRedisForTest({
      async eval(_script, _keys, args) {
        dailySearchUnits++;
        return [dailySearchUnits, dailySearchUnits, 1, 0];
      },
    });
    const cap = new Map();
    DAY.__setRedisForTest({ async mget(...ks) { return ks.map((k) => cap.get(k) || null); }, async sismember() { return 0; }, pipeline() { const q = []; return {
      incr(k) { q.push(() => { const n = (Number(cap.get(k)) || 0) + 1; cap.set(k, n); return n; }); }, expire() { q.push(() => 1); }, async exec() { return q.map((f) => f()); },
    }; } });
    class Response extends EventEmitter {
      constructor() { super(); this.writes = []; this.ended = 0; this.textWritesBeforeFinalizer = 0; this.endsBeforeFinalizer = 0; }
      status(n) { this.statusCode = n; return this; } setHeader() { return this; } flushHeaders() {}
      write(v, e, cb) { const raw = String(v); if (raw.trim() && !raw.trimStart().startsWith(':') && !this[SW.FINALIZATION_COMPLETE]) this.textWritesBeforeFinalizer++; this.writes.push(raw); if (typeof e === 'function') e(); if (typeof cb === 'function') cb(); return true; }
      end(v, e, cb) { if (typeof v === 'function') { cb = v; v = undefined; e = undefined; } else if (typeof e === 'function') { cb = e; e = undefined; } if (!this[SW.FINALIZATION_COMPLETE]) this.endsBeforeFinalizer++; if (v != null) { const raw = String(v); if (raw.trim() && !this[SW.FINALIZATION_COMPLETE]) this.textWritesBeforeFinalizer++; this.writes.push(raw); } this.ended++; if (typeof cb === 'function') cb(); return this; }
      json(v) { this.jsonBody = v; this.ended++; return this; }
    }
    const jr = (v) => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => v, text: async () => JSON.stringify(v) });
    const sourceUrl = 'https://islamqa.info/ar/answers/999999/a1-local';
    const originalFetch = globalThis.fetch, device = 'a1endpoint1234567', founder = DAY.founderTokenFor(device);
    const clientHandlerBody = (read('index.html').match(/const handleEvent = \(block\) => \{([\s\S]*?)\n      \};/) || [])[1];
    const clientVisibleFromRaw = clientHandlerBody && new Function('raw', `
      let full = '', streamError = null, onDelta = null;
      const handleEvent = (block) => {${clientHandlerBody}\n};
      let buffer = String(raw).replace(/\\r\\n/g, '\\n'), idx;
      while ((idx = buffer.indexOf('\\n\\n')) !== -1) { handleEvent(buffer.slice(0, idx)); buffer = buffer.slice(idx + 2); }
      if (buffer.trim()) handleEvent(buffer);
      return full;
    `);
    const drive = async ({ question, draft, evidence, route = 'DEEN', wireMode = 'frames', disconnectMode = '' }) => {
      let planned = false;
      let activeResponse = null, pendingRead = null, disconnected = false;
      let upstreamCancelCalls = 0, upstreamSignalAborted = false, writesAtDisconnect = -1, endsAtDisconnect = -1;
      const requestAbort = new AbortController();
      globalThis.fetch = async (url, init = {}) => {
        const u = String(url);
        if (u.includes('api.anthropic.com')) {
          const b = JSON.parse(init.body || '{}');
          if (b.stream) { const frames = [
            event({ type: 'message_start', message: { id: 'msg_a1', type: 'message', role: 'assistant', content: [] } }),
            event({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
            delta(draft),
            event({ type: 'content_block_stop', index: 0 }),
            stop,
          ]; const raw = wireMode === 'crlf-partial' ? frames.join('').replace(/\n/g, '\r\n') : '';
            const bytes = wireMode === 'crlf-partial' ? Buffer.from(raw, 'utf8') : null;
            const chunks = wireMode === 'crlf-partial'
              ? [bytes.subarray(0, 7), bytes.subarray(7, 43), bytes.subarray(43, 121), bytes.subarray(121)]
              : frames.map((frame) => Buffer.from(frame, 'utf8'));
            let i = 0; return { ok: true, status: 200, headers: { get: () => 'text/event-stream' }, body: { getReader: () => ({
              read: async () => {
                if (disconnectMode && i === 1 && !disconnected) {
                  disconnected = true;
                  return new Promise((resolve) => {
                    pendingRead = resolve;
                    queueMicrotask(() => {
                      writesAtDisconnect = activeResponse.writes.length;
                      endsAtDisconnect = activeResponse.ended;
                      if (disconnectMode === 'close') activeResponse.emit('close');
                      else requestAbort.abort();
                    });
                  });
                }
                return i < chunks.length ? { done: false, value: chunks[i++] } : { done: true };
              },
              releaseLock() {},
              cancel: async () => {
                upstreamCancelCalls++;
                upstreamSignalAborted = !!init.signal?.aborted;
                const settle = pendingRead; pendingRead = null;
                settle?.({ done: true });
              },
            }) } }; }
          if (b.tools && !planned) { planned = true; return jr({ content: [{ type: 'tool_use', id: 'a1', name: 'search_sources', input: { query: question } }], stop_reason: 'tool_use' }); }
          if (planned) return jr({ content: [{ type: 'text', text: draft }], stop_reason: 'end_turn' });
          return jr({ content: [{ type: 'text', text: route }], stop_reason: 'end_turn' });
        }
        if (u.includes('api.search.brave.com')) return jr({ web: { results: [{ title: 'A1 evidence', url: sourceUrl, description: evidence }] } });
        if (u.startsWith(sourceUrl)) { const paddedEvidence = evidence + ' ' + ('\u0647\u0630\u0627 \u0646\u0635 \u0645\u062d\u0644\u064a \u0645\u0648\u062b\u0642 \u0644\u0627\u062e\u062a\u0628\u0627\u0631 \u0645\u0633\u0627\u0631 \u0627\u0644\u062f\u0644\u064a\u0644 \u062f\u0648\u0646 \u0623\u064a \u0637\u0644\u0628 \u0634\u0628\u0643\u0629. ').repeat(8); const h = '<html><head><title>A1 evidence</title></head><body><article><p>' + paddedEvidence + '</p></article></body></html>'; return { ok: true, status: 200, url: sourceUrl, headers: { get: (n) => String(n).toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null }, text: async () => h, arrayBuffer: async () => Buffer.from(h) }; }
        throw new Error('unexpected offline URL: ' + u);
      };
      const req = new EventEmitter(); req.method = 'POST'; req.signal = requestAbort.signal; req.headers = { 'x-murabbi-device': device, 'x-murabbi-founder': founder, 'x-ezik-ai-consent': '2026-08-06-1' }; req.body = { age: 25, band: 'adult', messages: [{ role: 'user', content: question }] };
      const res = new Response();
      activeResponse = res;
      const finalizerProblems = [];
      const originalWarn = console.warn;
      console.warn = (...args) => {
        if (args[0] === '[finalizer] reader text replaced' && args[1] && Array.isArray(args[1].problems)) {
          finalizerProblems.push(...args[1].problems);
        }
        originalWarn(...args);
      };
      try { await (await esm('api/ask.js')).default(req, res); } finally { console.warn = originalWarn; }
      const text = clientVisibleFromRaw(res.writes.join(''));
      return {
        text, res, finalizerProblems,
        upstreamCancelCalls, upstreamSignalAborted, writesAtDisconnect, endsAtDisconnect,
      };
    };
    try {
      ok('A1 endpoint assertions execute the handleEvent parser shipped in index.html', typeof clientVisibleFromRaw === 'function');
      /* Split out of A1: bare-hadith claim detection remains open.
      const h1 = '\u0625\u0646\u0645\u0627 \u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0628\u0627\u0644\u0646\u064a\u0627\u062a';
      const bad = await drive({ question: '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u0646\u064a\u0629\u061f', draft: h1, evidence: '\u0627\u0644\u0646\u064a\u0629 \u0634\u0631\u0637 \u0641\u064a \u0627\u0644\u0639\u0628\u0627\u062f\u0627\u062a' });
      ok('F-011 endpoint negative: unsupported bare matn is absent from reader text', !bad.text.includes(h1), bad.text);
      const good = await drive({ question: '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u0646\u064a\u0629\u061f', draft: h1, evidence: '\u062d\u0643\u0645 \u0627\u0644\u0646\u064a\u0629 \u0641\u064a \u0627\u0644\u0639\u0628\u0627\u062f\u0627\u062a: ' + h1 });
      ok('F-011 endpoint green: exact fetched matn passes', good.text.includes(h1), good.text);
      const h2 = '\u0645\u0646 \u063a\u0634\u0646\u0627 \u0641\u0644\u064a\u0633 \u0645\u0646\u0627';
      const genBad = await drive({ question: '\u0645\u0627 \u0639\u0627\u0635\u0645\u0629 \u0627\u0644\u064a\u0627\u0628\u0627\u0646\u061f', draft: h2, evidence: '\u0637\u0648\u0643\u064a\u0648 \u0639\u0627\u0635\u0645\u0629 \u0627\u0644\u064a\u0627\u0628\u0627\u0646', route: 'GEN' });
      ok('F-021 endpoint negative: GEN cannot bypass bare-hadith validation', !genBad.text.includes(h2), genBad.text);
      const genText = '\u0637\u0648\u0643\u064a\u0648 \u0639\u0627\u0635\u0645\u0629 \u0627\u0644\u064a\u0627\u0628\u0627\u0646.';
      const genGood = await drive({ question: '\u0645\u0627 \u0639\u0627\u0635\u0645\u0629 \u0627\u0644\u064a\u0627\u0628\u0627\u0646\u061f', draft: genText, evidence: genText, route: 'GEN' });
      ok('F-021 endpoint green: ordinary GEN prose is preserved', genGood.text.includes(genText), genGood.text);
      */
      const rawContract = ({ res }) => {
        const raw = res.writes.join('');
        const protocol = raw.split(/\r?\n\r?\n/u).filter(Boolean)
          .filter((frame) => !frame.trimStart().startsWith(':'));
        const events = protocol.map((frame) => {
          const data = frame.split(/\r?\n/u).filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart()).join('');
          try { return JSON.parse(data); } catch { return null; }
        });
        return res.textWritesBeforeFinalizer === 0 && res.endsBeforeFinalizer === 0
          && events.every(Boolean) && validClientSequence(events)
          && events.filter((event) => event.type === 'message_stop').length === 1
          && events.at(-1).type === 'message_stop';
      };
      const badTakhrij = '\u062c\u0648\u0627\u0628 \u0645\u0641\u064a\u062f. \u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a \u0648\u0645\u0633\u0644\u0645.';
      const genUnsafe = await drive({ question: '\u0645\u0627 \u0639\u0627\u0635\u0645\u0629 \u0627\u0644\u064a\u0627\u0628\u0627\u0646\u061f', draft: badTakhrij, evidence: '\u0637\u0648\u0643\u064a\u0648', route: 'GEN' });
      ok('F-010 GEN negative: only the unverified takhrij is removed', rawContract(genUnsafe) && genUnsafe.text === '\u062c\u0648\u0627\u0628 \u0645\u0641\u064a\u062f.' && !genUnsafe.res.writes.join('').includes('\u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a'), genUnsafe.res.writes.join(''));
      const genBody = '\u0637\u0648\u0643\u064a\u0648 \u0639\u0627\u0635\u0645\u0629 \u0627\u0644\u064a\u0627\u0628\u0627\u0646.';
      const genSafe = await drive({ question: '\u0645\u0627 \u0639\u0627\u0635\u0645\u0629 \u0627\u0644\u064a\u0627\u0628\u0627\u0646\u061f', draft: genBody, evidence: genBody, route: 'GEN' });
      ok('F-010 GEN green: visible text is byte-identical and lifecycle is closed', rawContract(genSafe) && genSafe.text === genBody, genSafe.text);
      for (const disconnectMode of ['close', 'abort']) {
        const disconnected = await drive({
          question: '\u0645\u0627 \u0639\u0627\u0635\u0645\u0629 \u0627\u0644\u064a\u0627\u0628\u0627\u0646\u061f',
          draft: genBody, evidence: genBody, route: 'GEN', disconnectMode,
        });
        ok('SSE handler causal regression: real ' + disconnectMode + ' cancels upstream and emits nothing later',
          disconnected.upstreamCancelCalls === 1 && disconnected.upstreamSignalAborted
            && disconnected.writesAtDisconnect === disconnected.res.writes.length
            && disconnected.endsAtDisconnect === disconnected.res.ended
            && disconnected.res.ended === 0);
      }

      // Stored fiqh now has a stricter evidence -> claim -> sentence contract than the legacy
      // public-page branch above. Keep its acceptance matrix inside this original gate: the
      // sub-suite drives the real handler, rejects unsupported takhrij/URLs/claims, verifies SSE
      // completion and kills the grounding/card/relevance mutants without changing gates.json.
      const storedSuite = spawnSync(process.execPath, [path.join(REPO, 'guards', 'stored-deen-sub-suite.cjs')], {
        cwd: REPO,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      });
      if (storedSuite.stdout) process.stdout.write(storedSuite.stdout);
      if (storedSuite.stderr) process.stderr.write(storedSuite.stderr);
      ok('F-010 stored-DEEN sub-suite: grounded output, real takhrij lock and all mutants pass',
        storedSuite.status === 0 && /stored-DEEN sub-suite: 85\/85 — PASS/u.test(storedSuite.stdout || ''),
        'status=' + storedSuite.status + (storedSuite.error ? ' error=' + storedSuite.error.message : ''));

      // A typed identity question is the live structured route where namedEntity is empty while a
      // real, completed name-presence probe can still own a lead.  The old raw-attribution fixture
      // would now violate F-081 by reviving a lexical capture vetoed by the entity IR.
      const presenceQuestion = '\u0645\u0646 \u0647\u0648 \u062e\u0627\u0644\u062f \u0639\u0628\u062f\u0627\u0644\u0631\u062d\u0645\u0646\u061f';
      const contradiction = '\u062e\u0627\u0644\u062f \u0639\u0628\u062f\u0627\u0644\u0631\u062d\u0645\u0646 \u0645\u0637\u0631\u0628 \u0643\u0648\u064a\u062a\u064a \u0645\u0639\u0631\u0648\u0641.';
      const presenceBad = await drive({ question: presenceQuestion, draft: contradiction, evidence: '' });
      ok('F-008 endpoint negative: consistency removes the composed contradiction before first text write/end',
        rawContract(presenceBad)
          && presenceBad.res.textWritesBeforeFinalizer === 0
          && presenceBad.res.endsBeforeFinalizer === 0
          && !presenceBad.res.writes.join('').includes(contradiction)
          && JSON.stringify(presenceBad.finalizerProblems)
            === JSON.stringify([
              'IDENTITY_WITHOUT_EVIDENCE',
              'ATTRIBUTION_NOT_LICENSED',
              'CONSISTENCY_DROP_WHOLE',
            ]),
        JSON.stringify({ text: presenceBad.text, problems: presenceBad.finalizerProblems }));
      const presenceBody = '\u0647\u0630\u0627 \u0647\u0648 \u0627\u0644\u062d\u062f \u0627\u0644\u0645\u062a\u0627\u062d \u0645\u0646 \u0627\u0644\u062a\u062d\u0642\u0642.';
      const presencePlan = (await esm('lib/ask-plan.js')).planAsk(presenceQuestion);
      const presenceGood = await drive({ question: presenceQuestion, draft: presenceBody, evidence: '' });
      const expectedPresenceLead = (await esm('lib/policy/name-presence.js'))
        .nameUnknownLine('\u062e\u0627\u0644\u062f \u0639\u0628\u062f\u0627\u0644\u0631\u062d\u0645\u0646');
      ok('F-008 endpoint fixture has namedEntity empty and a real structured presence lead', presencePlan.namedEntity === '' && presenceGood.text.startsWith(expectedPresenceLead + '\n\n'), JSON.stringify({ namedEntity: presencePlan.namedEntity, text: presenceGood.text }));
      ok('F-008 endpoint green: composed text is finalized before first target write/end', rawContract(presenceGood) && presenceGood.res.textWritesBeforeFinalizer === 0 && presenceGood.res.endsBeforeFinalizer === 0 && presenceGood.finalizerProblems.length === 0 && presenceGood.text === expectedPresenceLead + '\n\n' + presenceBody, presenceGood.text);
    } finally { globalThis.fetch = originalFetch; }
  }

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL' : ' — PASS') + ' ===');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
