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
  const askSrc = read('api/ask.js');
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

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL' : ' — PASS') + ' ===');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
