// guards/hadith-block-guard.cjs -- brain35 B-5 (2026-11-06; DIAG PKG-1): A «<hadith …>» BLOCK IS ONE QUOTATION.
//
// MEASURED OFFLINE (H4 case A, the smallest input that reproduces it): the legacy path's backup ruling filter
// (lib/free-brain/loop.js withoutUnsourcedRulings) judges a line sentence by sentence; its quote tracker skipped markup
// and opened no quotation for a card, so a hadith block was split at its own inner full stop, the piece carrying the
// ruling word («يكره») was removed, and what reached the reader was an INTACT card holding a PARTIAL matn. P3's rule
// («no partial matn») failed inside a block that looked whole.
//
// THE RULE NOW: the tracker opens on «<hadith …>» and closes on «</hadith>» (a card counter), so the filter judges the
// whole block and removes or keeps it WHOLE. The block is sourced by a [[n]] of its own or by the ruling attribute the
// takhrij pass wrote into its tag; with neither, the whole block goes and nothing of it is left behind.
//
// Usage: node guards/hadith-block-guard.cjs
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
let checks = 0;
let failures = 0;
const ok = (name, cond, detail) => {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).replace(/[^\x20-\x7e\n]/g, '~').slice(0, 300) : ''));
  return false;
};
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href + '?hadithblock=' + Date.now());

(async () => {
  console.log('=== hadith-block-guard -- brain35 B-5: the backup ruling filter judges a hadith block whole ===');
  const L = await esm('lib/free-brain/loop.js');
  // the hadith of EXT-Q5 (Q38 on the battery), in the tagged form the legacy path writes
  const MATN = 'أتدرون ما الغيبة؟ قالوا: الله ورسوله أعلم. قال: ذكرك أخاك بما يكره.';
  const TAG_OPEN = '<hadith narrator="أبو هريرة">';
  const TAG_RULED = '<hadith narrator="أبو هريرة" ruling="رواه مسلم">';
  const LAST = 'ذكرك أخاك بما يكره';
  const whole = (text) => /<hadith/u.test(text) === /<\/hadith>/u.test(text);
  const gone = (text) => !/<hadith/u.test(text) && !/<\/hadith>/u.test(text) && !text.includes(LAST) && !text.includes('أتدرون ما الغيبة');

  // 1. neither a [[n]] nor a ruling attribute: the whole block goes
  const bare = L.withoutUnsourcedRulings(TAG_OPEN + MATN + '</hadith>', []);
  ok('1a a block with neither a [[n]] nor a ruling attribute is removed WHOLE', gone(bare.text) && bare.removed === 1, JSON.stringify(bare));
  ok('1b ...and nothing of its matn is left behind, nor an orphan tag', !bare.text.includes('الغيبة') && whole(bare.text), bare.text);
  // 2. a [[n]] after the closing tag: kept whole
  const cited = L.withoutUnsourcedRulings(TAG_OPEN + MATN + '</hadith> [[1]]', [1]);
  ok('2a a block cited by a [[n]] is kept WHOLE, its last sentence included',
    cited.removed === 0 && cited.text.includes(LAST) && whole(cited.text) && /<hadith/u.test(cited.text), JSON.stringify(cited));
  ok('2b ...and the turn is not marked not-covered', cited.notCovered === false && cited.sourcedRulings === 1, JSON.stringify(cited));
  // 3. the ruling attribute the takhrij pass wrote is a source of its own
  const ruled = L.withoutUnsourcedRulings(TAG_RULED + MATN + '</hadith>', []);
  ok('3 a block whose tag carries the takhrij pass\'s ruling attribute is kept whole',
    ruled.removed === 0 && ruled.text.includes(LAST) && ruled.sourcedRulings === 1, JSON.stringify(ruled));
  // 4. H4's own case A, in full
  const h4a = L.withoutUnsourcedRulings('الغيبة محرمة بالكتاب والسنة [[1]].\n' + TAG_RULED + MATN + '</hadith>\nوالغيبة من كبائر الذنوب [[1]].', [1]);
  ok('4 H4 case A: the block keeps its last sentence and both tags, and the prose around it stands',
    h4a.text.includes(LAST) && whole(h4a.text) && h4a.text.includes('الغيبة محرمة') && h4a.text.includes('كبائر الذنوب'), h4a.text);
  // 5. a <document> block is NOT bound by this tracker: only «<hadith>» is. Its sentences are judged one by one, exactly as
  // they were before the change (the ruling sentence goes, the rest stays) -- the proof that the binding is the card's alone.
  const doc = '<document>النص الأول. وهذا يكره عند أهل العلم. النص الثالث.</document>';
  const docOut = L.withoutUnsourcedRulings(doc, []);
  ok('5a a <document> block is not bound: its own ruling sentence is judged alone, as before',
    docOut.removed === 1 && !docOut.text.includes('يكره') && docOut.text.includes('النص الأول') && docOut.text.includes('النص الثالث'), docOut.text);
  const docClean = '<document>النص الأول. والنص الثاني من المصدر. النص الثالث.</document>';
  ok('5b ...and a <document> block that states no ruling is left exactly as it was',
    L.withoutUnsourcedRulings(docClean, []).text === docClean && L.withoutUnsourcedRulings(docClean, []).removed === 0);
  // 6. the ordinary quotation rule still holds (the guillemet form of the same hadith)
  const guill = L.withoutUnsourcedRulings('قال صلى الله عليه وسلم: «' + MATN + '»', []);
  ok('6 the same hadith in guillemets is still judged by the quotation rule, whole', guill.removed === 1 && !guill.text.includes(LAST), JSON.stringify(guill));

  // 7. the mutants
  const twin = async (transform, tag) => {
    const src = fs.readFileSync(path.join(REPO, 'lib/free-brain/loop.js'), 'utf8');
    const mutated = transform(src);
    if (mutated === src) return { changed: false };
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-hadithblock-' + tag + '-'));
    const file = path.join(tmp, 'loop.mjs');
    fs.writeFileSync(file, mutated.replace(/from\s+(['"])(\.[^'"]*)\1/gu,
      (_a, q, spec) => 'from ' + q + pathToFileURL(path.resolve(REPO, 'lib/free-brain', spec)).href + q), 'utf8');
    try { return { changed: true, mod: await import(pathToFileURL(file).href + '?t=' + Date.now()) }; } catch (e) { return { changed: true, error: String(e && e.message) }; } finally {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* temp only */ }
    }
  };
  const m1 = await twin((s) => s.replace('    get open() { return state.card > 0 ||', '    get open() { return false ||'), 'open');
  ok('7a MUTANT card-open seam applied and loaded', m1.changed && m1.mod, m1.error);
  ok('7a MUTANT KILLED: without the card counter the block is cut at its own full stop again',
    !!m1.mod && (() => { const r = m1.mod.withoutUnsourcedRulings(TAG_RULED + MATN + '</hadith>', []); return !r.text.includes(LAST) && /<hadith/u.test(r.text); })(), m1.error);
  const m2 = await twin((s) => s.replace('      if (HADITH_BLOCK_RULED_RE.test(part)) { sourcedRulings += 1; return false; }', '      // mutant: the ruling attribute says nothing'), 'ruled');
  ok('7b MUTANT ruling-attribute seam applied and loaded', m2.changed && m2.mod, m2.error);
  ok('7b MUTANT KILLED: without it a block the takhrij pass graded is removed whole',
    !!m2.mod && (() => { const r = m2.mod.withoutUnsourcedRulings(TAG_RULED + MATN + '</hadith>', []); return r.removed === 1 && !r.text.includes(LAST); })(), m2.error);


  // ── brain35 B-6 (2026-11-06; DIAG GEMMA-4a, VAGUE-START) · TWO SMALL ONES ON THIS SAME PATH ────────────────────
  // (a) «لم أجد في مصادر عزك نصا يجيب عن هذه المسألة بعينها.» was appended UNDER an answer that still carried its
  // sources: notCovered is set when every RULING sentence was removed, and a draft whose quoted material survives is
  // not an answer we did not find. (b) the writer's instruction about a person we hold no source for forbade his name
  // and a pronoun, not a description, and an answer opened on «المصدر المسؤول عنه»: a description and a kenning are
  // forbidden too, and a unit that opens on one is held.
  {
    const R = await esm('lib/removed-sources.js');
    const U = await esm('lib/bw2-units.js');
    // the measured GEMMA-4a shape: the only RULING sentence cites nothing (so it goes and notCovered is set), while what
    // survives is carded material the reader can check -- a full-looking answer that the C3 sentence used to deny.
    const sourcedDraft = 'وقد جاء في الحديث بيان معنى الغيبة [[1]].\n<source site="binbaz.org.sa" url="https://binbaz.org.sa/fatwas/1">معنى الغيبة</source>\nولا يجوز الاغتياب بحال.';
    const outSourced = L.withoutUnsourcedRulings(sourcedDraft, [1]);
    ok('B-6a the measured draft: every ruling sentence is unsourced (notCovered) yet the delivered text keeps a [[n]] and a card',
      outSourced.notCovered === true && L.deliveredCarriesSource(outSourced.text) === true, JSON.stringify({ notCovered: outSourced.notCovered, text: outSourced.text.slice(0, 60) }));
    ok('B-6a ...so the C3 sentence is NOT appended to it',
      L.shouldAppendC3NotCovered({ ...outSourced, streamedThisTurn: false }, '', 0) === false);
    ok('B-6a ...and over a draft that kept nothing sourced it still is',
      L.shouldAppendC3NotCovered({ notCovered: true, streamedThisTurn: false, text: 'الحكم جائز.' }, '', 0) === true);
    ok('B-6a deliveredCarriesSource reads a [[n]], a card and an empty text',
      L.deliveredCarriesSource('حكم [[2]].') === true && L.deliveredCarriesSource('<source site="x" url="y">t</source>') === true
      && L.deliveredCarriesSource('حكم بلا مصدر.') === false && L.deliveredCarriesSource('') === false);
    ok('B-6a a streamed turn is still exempt, and the removed-person exemption still holds',
      L.shouldAppendC3NotCovered({ notCovered: true, streamedThisTurn: true, text: 'الحكم جائز.' }, '', 0) === false
      && L.shouldAppendC3NotCovered({ notCovered: true, streamedThisTurn: false, text: 'الحكم جائز.' }, 'سؤال', 1) === false);
    const attribution = R.removedPersonAttribution('ماذا قال عمر عبد الكافي عن الغيبة؟');
    ok('B-6b the question names a person we hold no source for', !!attribution && attribution.role === 'removed_person');
    const instruction = R.removedPersonWriterInstruction(attribution);
    ok('B-6b the writer is told not to point at him by a description or a kenning, and to begin on the question itself',
      instruction.includes('ولا تشرْ إليه بوصفٍ ولا بكناية («المسؤول عنه»، «صاحب الكتاب»)، وابدأْ بالمسألة نفسِها.'), instruction);
    ok('B-6b ...and the older clauses are still in it (no name, no attribution, no pronoun)',
      instruction.includes('فلا تذكر اسمه') && instruction.includes('ولا تنسب إليه شيئا') && instruction.includes('ولا تشر إليه بضمير'), instruction);
    ok('B-6b a unit that opens on a demonstrative standing for a man is a vague-person opening',
      U.subjectlessOpening('هذا المسؤول عنه يرى الجواز.') === 'vague_person'
      && U.subjectlessOpening('وصاحب الكتاب يرى المنع.') === 'vague_person'
      && U.subjectlessOpening('وهذا المذكور يرى الجواز.') === 'vague_person');
    ok('B-6b ...and an opening that names somebody is not', U.subjectlessOpening('هذا المذكور عند ابن باز جائز.') === ''
      && U.subjectlessOpening('وهذا الحكم جائز عند أهل العلم.') === '');
    const mC3 = await twin((s) => s.replace("    && !deliveredCarriesSource(out && out.text)\n", ''), 'c3');
    ok('B-6 MUTANT C3 seam applied and loaded', mC3.changed && mC3.mod, mC3.error);
    ok('B-6 MUTANT KILLED: without the test the sentence is appended under a sourced answer again',
      !!mC3.mod && mC3.mod.shouldAppendC3NotCovered({ ...outSourced, streamedThisTurn: false }, '', 0) === true, mC3.error);
  }


  // ── brain35-2 F2 (2026-11-07; DIAG2 R5) · THE COMPLETION LEDGER RUNS ON THIS PATH TOO ─────────────────────────────────
  // MEASURED (DIAG2 R5): completionLedger (lib/before-writing-v2.js, pure) had one call site, the before-writing path's; a
  // turn that path handed over (P11: no book card, a prose answer) ended with no collector named and no sentence saying so.
  // The legacy turn's delivered text now goes through the same ledger before it is returned: each sentence the ledger
  // returns that the text does not already carry is appended, once. The question is the turn's own (ctx.question).
  {
    const BW2 = await esm('lib/before-writing-v2.js');
    const P11 = 'ما صحة حديث «من صلى الفجر في جماعة ثم جلس يذكر الله حتى تطلع الشمس ثم صلى ركعتين»؟ ومن أخرجه؟';
    const PROVIDER = 'https://stub.invalid/v1/messages';
    // the legacy turn driven offline, as guards/no-empty-answer-guard.cjs drives it: the provider is a scripted stub keyed on
    // its own URL, every other host throws, the model writes the prose it is handed
    const driveLegacy = async (mod, question, text) => {
      const realFetch = globalThis.fetch;
      globalThis.fetch = async (input) => {
        const url = String(input?.url || input);
        if (!url.startsWith('https://stub.invalid/')) throw new Error('offline: ' + url);
        return { ok: true, status: 200, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }] }) };
      };
      try { return await mod.runFreeBrainTurn({ messages: [{ role: 'user', content: question }], system: 'أنت أستاذ.', model: 'stub', maxTokens: 1024, mode: 'عادي', lexicalRoute: 'DEEN', providerUrl: PROVIDER, headers: {} }); }
      finally { globalThis.fetch = realFetch; }
    };
    const COLLECTOR = BW2.LEDGER_COLLECTOR_SENTENCE;
    const count = (text, needle) => String(text).split(needle).length - 1;
    const GRADED = 'هذا الحديث حسّنه الألباني وابن باز بمجموع طرقه.';
    const legacy = await driveLegacy(L, P11, GRADED);
    ok('F2a wired: a legacy-path answer to P11 that names no collection ends on the collector sentence, once',
      legacy.text.endsWith('\n\n' + COLLECTOR) && count(legacy.text, COLLECTOR) === 1 && legacy.text.startsWith(GRADED), JSON.stringify(legacy.text));
    ok('F2a ...and the grader sentence is not added beside it (two graders are named)', !legacy.text.includes(BW2.LEDGER_GRADER_SENTENCE), legacy.text);
    const named = await L.appendCompletionLedger('رواه الترمذي وقال: حسن غريب، وحسّنه الألباني.', P11);
    ok('F2b the same answer naming its collection («رواه الترمذي») gets no collector sentence',
      named === 'رواه الترمذي وقال: حسن غريب، وحسّنه الألباني.' && !named.includes(COLLECTOR), named);
    const fiqh = await driveLegacy(L, 'ما حكم الجمع للمسافر؟', 'الجمع للمسافر جائز عند الحاجة.');
    ok('F2c a non-hadith question gets nothing from the ledger', fiqh.text === 'الجمع للمسافر جائز عند الحاجة.', fiqh.text);
    const twice = await L.appendCompletionLedger(GRADED + '\n\n' + COLLECTOR, P11);
    ok('F2d a text that already carries the sentence is left as it is (the byte-level includes test)', count(twice, COLLECTOR) === 1 && twice === GRADED + '\n\n' + COLLECTOR, twice);
    ok('F2d an empty text stays empty', (await L.appendCompletionLedger('', P11)) === '' && (await L.appendCompletionLedger('   ', P11)) === '   ');
    // the import: lib/before-writing-v2.js imports this module, so the ledger's binding closes a cycle that is read at call
    // time only -- every entry order loads in a fresh process (loop first, as api/ask.js enters it; the two others; the handler)
    const loads = ['lib/free-brain/loop.js', 'lib/before-writing-v2.js', 'lib/bw2-units.js', 'api/ask.js'].map((rel) => {
      try {
        const r = require('child_process').spawnSync(process.execPath, ['--input-type=module', '-e', 'await import(' + JSON.stringify(pathToFileURL(path.join(REPO, rel)).href) + '); console.log("LOADED")'], { cwd: REPO, encoding: 'utf8', timeout: 60000 });
        return rel + ':' + (/LOADED/.test(r.stdout) ? 'ok' : 'FAIL ' + String(r.stderr).slice(0, 200));
      } catch (e) { return rel + ':THREW ' + String(e && e.message); }
    });
    ok('F2e the import cycle is call-time only: loop.js, before-writing-v2.js, bw2-units.js and api/ask.js each load first in a fresh process', loads.every((l) => /:ok$/u.test(l)), loads.join(' | '));
    const mLedger = await twin((s) => s.replace("  reviewed = { ...reviewed, text: appendCompletionLedger(reviewed.text, ctx.question) }; // ITEM 35-D2 R5 (brain35-2 F2)", '  // mutant: the ledger is not consulted on this path'), 'ledger');
    ok('F2 MUTANT seam applied and loaded', mLedger.changed && mLedger.mod, mLedger.error);
    const mutantText = mLedger.mod ? (await driveLegacy(mLedger.mod, P11, GRADED)).text : '';
    ok('F2 MUTANT KILLED: with the call removed the P11 answer ends with no collector sentence again', !!mLedger.mod && mutantText === GRADED, mutantText);
  }
  console.log('\n=== hadith-block: ' + (checks - failures) + '/' + checks + (failures ? ' FAIL' : ' PASS') + ' ===');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('GUARD THREW: ' + (e && e.stack ? e.stack : String(e))); process.exit(1); });
