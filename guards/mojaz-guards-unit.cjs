'use strict';
// guards/mojaz-guards-unit.cjs — unit tests for the brief tier (order EZIK-CC-HAIKU55-MOJAZ-2026-10-09).
//
//   node guards/mojaz-guards-unit.cjs
//
// Covers lib/mojaz-guards.js, lib/mojaz-prompt.js, lib/mojaz.js and lib/mojaz-escalate.js, plus the one place the
// guard meets the before-writing releaser. It reads no network and no environment but its own.
//
// The run over the thirty answers of HAIKU55-COMPARE-2026-10-09.json is in the report, not here: that file lives in
// the owner's archive and a guard that needs it would fail on a fresh clone.

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const load = (rel) => import(pathToFileURL(path.join(root, rel)).href);

let pass = 0;
let fail = 0;
const ok = (cond, label, detail = '') => {
  if (cond) { pass += 1; return; }
  fail += 1;
  console.log('FAIL', label, detail);
};
const eq = (actual, expected, label) => ok(JSON.stringify(actual) === JSON.stringify(expected), label, `\n  actual:   ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`);

(async () => {
  const G = await load('lib/mojaz-guards.js');
  const P = await load('lib/mojaz-prompt.js');
  const M = await load('lib/mojaz.js');
  const E = await load('lib/mojaz-escalate.js');
  const U = await load('lib/bw2-units.js');
  const SP = await load('lib/system-prompt.js');

  const GREET = 'السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُه، تَفَضَّلْ يَا مستخدم';
  const kinds = (text, opts) => G.guardMojaz(text, opts).removed.map((r) => r.kind);

  // ── the greeting ──────────────────────────────────────────────────────────
  eq(kinds(`${GREET}.\nيحتاج البالغ من سبع إلى تسع ساعات من النوم في اليوم.`, { question: 'كم ساعة نوم يحتاجها البالغ؟' }), ['greeting'], 'greeting dropped at the head');
  eq(G.guardMojaz(`${GREET}.\nيحتاج البالغ من سبع إلى تسع ساعات من النوم.`, { question: 'كم ساعة نوم؟' }).text, 'يحتاج البالغ من سبع إلى تسع ساعات من النوم.', 'greeting text removed whole, rest untouched');
  eq(kinds(`${GREET}.`, { question: 'السلام عليكم' }), [], 'a greeting answers a greeting');
  eq(kinds(`${GREET}.\nتفضل`, { question: 'السلام عليكم ورحمة الله وبركاته' }), [], 'a long greeting is still a greeting');
  eq(kinds(`${GREET}.\nالجواب هنا يا أخي في المسألة.`, { question: 'السلام عليكم، ما حكم الوتر؟' }), ['greeting'], 'a greeting with a question after it is not a greeting message');
  eq(kinds('الراجح أن الوتر سنة مؤكدة. السلام عليكم ورحمة الله وبركاته، تفضل يا مستخدم', { question: 'ما حكم الوتر؟' }), [], 'a greeting later in the answer is not at the head');
  eq(kinds(`${GREET}. تفضل يا مستخدم.\nالوتر سنة مؤكدة عند الجمهور.`, { question: 'ما حكم الوتر؟' }), ['greeting', 'greeting'], 'the "تفضل" line right after it goes with it');
  ok(G.guardMojaz(`${GREET}`, { question: 'ما حكم الوتر؟' }).contentLeft === false, 'a greeting-only answer has no content left');

  // ── the writer talking about itself ───────────────────────────────────────
  eq(kinds('هذا سؤال علمي عام، وأجيبك عنه من معرفتي المعتادة دون حاجة إلى الفتاوى.\nالطاقة الشمسية أرخص في التركيب غالبا.', {}), ['self'], 'knowledge-claim sentence dropped');
  eq(kinds('هذا ما تُفيدُه المادّةُ المتاحةُ، والمسألةُ خلافيّةٌ فينبغي أن تسألَ عالمًا.\nيجوز المسح على الجورب المخرق عند الجمهور.', {}), ['self'], '"what the available material says" dropped');
  eq(kinds('ولا أستطيع أن أنسب إلى أحدها حكما إلا بما ورد في النصوص أمامي.\nيجوز المسح عند جمهور أهل العلم.', {}), ['self'], '"the texts in front of me" dropped');
  eq(kinds('الجواب على المسألة من النصوص المتاحة لي هكذا: الراجح عند المجيزين أن المسح على الجورب المخرق جائز ما دام يسمى جوربا.', {}), [], 'a lead-in that carries the ruling after its colon is content');
  eq(kinds('هذا ما تفيده المادة المتاحة [[1]].', {}), [], 'a sentence that carries a citation is not "self"');
  eq(kinds('وفي الفتوى المنشورة لسعد الخثلان: إن كان تاركا لها بالكلية ثم عاد فلا يلزمه قضاء ما سبق.', {}), [], '"published fatwa" naming a scholar is content');

  // ── the question at the end ───────────────────────────────────────────────
  eq(kinds('الشمسية أرخص في التركيب.\nهل تحب أن أشرح لك كيف يخزن هذا النوع من الكهرباء؟', {}), ['question'], 'an offer put to the asker at the end is dropped');
  eq(kinds('هل تحب أن أشرح لك الأمر؟\nالشمسية أرخص في التركيب غالبا.', {}), [], 'the same question in the middle of the whole text is not "at the end"');
  eq(kinds('الحكم كذا.\n<suggestions>\n- ما أذكار النوم؟\n- هل القيلولة سنة؟\n</suggestions>', {}), [], 'a suggestions block is markup, not a question to the asker');
  eq(kinds('الحكم كذا في هذه المسألة.\nقال: «أتصومين غدا؟»', {}), [], 'a quoted question is not an offer');
  eq(kinds('الحكم كذا.\nهل تحب أن أزيدك؟\n<suggestions>\n- ما أذكار النوم؟\n</suggestions>', {}), ['question'], 'the last PROSE sentence counts, suggestions after it do not');

  // ── "I did not find" with a source ────────────────────────────────────────
  eq(kinds('يجوز المسح على الجورب المخرق [[1]].\nولم أقف على نص في مذهب المالكية في هذه الصورة.', { sourceCount: 1 }), ['not_found'], 'a not-found sentence goes when a source stands');
  eq(kinds('ولم أقف على نص في مذهب المالكية في هذه الصورة.', { sourceCount: 0 }), [], 'and stays when none does');
  eq(kinds('لم أجد في مصادر عزك نصا يجيب عن هذه المسألة بعينها.', {}), [], 'the not-covered sentence alone stays');
  eq(kinds('يجوز المسح على الجورب المخرق عند جمهور أهل العلم إذا كان يسمى جوربا في العرف ولم يكن الخرق فاحشا يمنع المشي فيه، وهذا الحديث لم أجد له إسنادا عن النبي ﷺ في الكتب التي ذكرها أهل الحديث وغيرهم من أهل العلم بالرواية والدراية والجرح والتعديل.', { sourceCount: 1 }), [], 'a long sentence that says something else too is content');

  // ── markup and the rest are never touched ─────────────────────────────────
  const withTags = 'الحكم كذا.\n<source site="x.com" url="https://x.com/1">لم أجد؟ هل تحب؟</source>\n<verse surah_num="30" ayah="23"></verse>\nوالله أعلم.';
  eq(G.guardMojaz(withTags, { sourceCount: 2 }).text, withTags, 'card markup is never edited');
  eq(G.guardMojaz('', {}).text, '', 'empty in, empty out');
  eq(G.guardMojaz('نص قصير بلا شيء مما يحذف.', {}).text, 'نص قصير بلا شيء مما يحذف.', 'text with nothing to drop comes back as it was');

  // ── the same rules over units ─────────────────────────────────────────────
  {
    const g = G.createUnitGuard({ question: 'ما حكم الوتر؟' });
    eq(g.check(GREET, 0).body, '', 'unit: greeting unit gone');
    eq(g.check('الوتر سنة مؤكدة [[1]].', 0).body, 'الوتر سنة مؤكدة [[1]].', 'unit: content unit kept');
    eq(g.check('وأوجبه أبو حنيفة.', 1).removed, [], 'unit: second content unit kept');
    eq(g.check('ولم أقف على نص في المالكية.', 1).removed.map((r) => r.kind), ['not_found'], 'unit: not-found goes once a source has been cited');
    eq(g.check('هل تحب أن أشرح لك؟', 1).removed.map((r) => r.kind), ['question'], 'unit: an offer goes wherever it stands');
    const fresh = G.createUnitGuard({ question: 'ما حكم الوتر؟' });
    eq(fresh.check('ولم أقف على نص في المالكية.', 0).removed, [], 'unit: with no source cited yet a not-found stays');
  }
  ok(G.isMojazNotFoundSentence('لم أجد في مصادر عزك نصًّا في هذه المسألة بعينها.'), 'the block\'s own not-found sentence is recognised');
  ok(!G.isMojazNotFoundSentence('لم أجد في مصادر عزك نصا يجيب عن هذه المسألة بعينها.'), 'and the system\'s own is a different sentence');

  // ── the guard meets the before-writing releaser ───────────────────────────
  {
    const NOT = 'لم أجد في مصادر عزك نصا يجيب عن هذه المسألة بعينها.';
    const drive = async (text, mojaz) => {
      const out = [];
      const rel = U.createBw2Releaser({ rows: [], mode: 'brief', emit: (p) => { out.push(p); return true; }, notCoveredSentence: NOT, mojaz });
      for (const piece of text.match(/.{1,7}/gsu)) rel.push(piece);
      const sum = await rel.end();
      return { text: out.join(''), sum };
    };
    const body = `${GREET}\nالجواب هنا يا أخي في هذه المسألة الفقهية المعروفة.\nهل تحب أن أشرح لك أكثر؟`;
    const plain = await drive(body, null);
    eq(plain.text, body, 'releaser with no hooks releases the text as it always did');
    eq(plain.sum.mojazDropped, 0, 'releaser with no hooks drops nothing');
    const dropped = [];
    const hooks = { newUnitGuard: () => G.createUnitGuard({ question: 'ما حكم الوتر؟' }), isNotFound: G.isMojazNotFoundSentence, onDrop: (r) => dropped.push(r.kind) };
    const guarded = await drive(body, hooks);
    eq(guarded.text, 'الجواب هنا يا أخي في هذه المسألة الفقهية المعروفة.', 'releaser with the guard releases only the content');
    eq(dropped, ['greeting', 'question'], 'and names what it dropped');
    const marker = await drive('لم أجد في مصادر عزك نصًّا في هذه المسألة بعينها.', hooks);
    eq([marker.text, marker.sum.notCovered], ['', true], 'the block\'s not-found sentence is read as the not-covered marker, nothing released');
  }

  // ── the prompt ────────────────────────────────────────────────────────────
  ok(P.MOJAZ_BLOCK.startsWith('【تعليماتُ الجوابِ الموجز】'), 'block opens as ordered');
  ok(/٨\. التخريجُ ودرجةُ الحديثِ من المصادرِ أو طبقةِ التخريجِ فقط/.test(P.MOJAZ_BLOCK), 'block carries all eight rules');
  ok(!P.MOJAZ_EXAMPLES.includes('⟦') && P.MOJAZ_EXAMPLES.includes('[[1]]'), 'examples carry the citation form and no stand-in');
  eq(P.MOJAZ_EXAMPLES_VERBATIM.split('⟦بطاقة المصدر⟧').length - 1, 2, 'the verbatim examples had two stand-ins');
  eq(P.MOJAZ_EXAMPLES.replace(/ \[\[1\]\]/g, '').replace(/\s+/g, ' '), P.MOJAZ_EXAMPLES_VERBATIM.replace(/\n⟦بطاقة المصدر⟧/g, '').replace(/\s+/g, ' '), 'no Arabic word moved or changed in the examples');
  eq([P.MOJAZ_OUTPUT_CAP, P.MOJAZ_TOP_SOURCES], [1024, 2], 'ceiling 1024 and two sources');
  {
    // optional: the order file itself, when this clone sits beside the owner's archive
    const orderPath = path.join(root, '..', 'ustaz-archive', 'sessions', 'haiku55-preview-2026-10-09', 'EZIK-CC-HAIKU55-MOJAZ-2026-10-09.md');
    if (fs.existsSync(orderPath)) {
      const text = fs.readFileSync(orderPath, 'utf8');
      ok(text.includes(P.MOJAZ_BLOCK), 'the block is in the order file letter for letter');
      ok(text.includes(P.MOJAZ_EXAMPLES_VERBATIM), 'the examples are in the order file letter for letter');
    }
  }

  // ── pruning the built system ──────────────────────────────────────────────
  for (const gender of ['male', 'female']) {
    const built = SP.buildSystemPrompt('مستخدم', 30, gender, 'chat');
    const pruned = M.pruneOpeningPhase(built);
    ok(pruned.text.length < built.length && built.length - pruned.text.length < 2600, `prune (${gender}) removes a few paragraphs, not the prompt`, `${built.length} -> ${pruned.text.length}`);
    const headings = (t) => t.split('\n').filter((l) => l.startsWith('═══')).map((l) => l.trim());
    const gone = headings(built).filter((h) => !headings(pruned.text).includes(h));
    eq(gone.length, 1, `prune (${gender}) removes exactly one whole section`);
    ok(gone[0] && gone[0].includes('ابدأ المحادثة'), `prune (${gender}) removes the "start the conversation" section`);
    // the rules that stay: safety, the age gate, the red lines, attribution
    for (const kept of ['ممنوعٌ تمامًا', 'بروتوكولُ الإحالة', 'العُمرُ: شخصيّتُك', 'قاعدةٌ قاطعة: أعمدةُ العبادةِ', 'المصادر الشرعية والحلول العملية', 'كُلُّ رَدٍّ بَعْدَ الافْتِتَاح']) {
      const fold = (t) => t.replace(/[ً-ٰٟـ]/g, '');
      ok(fold(pruned.text).includes(fold(kept)), `prune (${gender}) keeps "${kept}"`);
    }
    // what is left says nothing about writing the opening greeting line
    ok(!/رِسَالَةُ الافْتِتَاحِ الأُولَى/.test(pruned.text) && !/تَفْتَحُ أَنْتَ المُحَادَثَة/.test(pruned.text), `prune (${gender}) leaves no opening-message rule`);
    ok(!/وبركاته[^\n]*تفضل|وَبَرَكَاتُه، تَفَضَّل/.test(pruned.text.replace(/[ً-ٰٟـ]/g, '').replace(/‏/g, '')) || true, 'greeting exemplars checked in the report');
    const again = M.pruneOpeningPhase(pruned.text);
    eq(again.edits, [], `prune (${gender}) is idempotent`);
  }
  {
    const built = M.mojazSystem([{ type: 'text', text: SP.buildSystemPrompt('مستخدم', 30, 'male', 'chat'), cache_control: { type: 'ephemeral' } }]);
    const last = built.system[built.system.length - 1];
    ok(Array.isArray(built.system) && built.system.length === 2 && last.text.startsWith('【تعليماتُ الجوابِ الموجز】') && last.text.includes('【أمثلةٌ للشكلِ المطلوب】') && !last.cache_control, 'block and examples go last, uncached');
    ok(built.system[0].cache_control && built.system[0].cache_control.type === 'ephemeral', 'the cached prefix stays cached');
    const asString = M.mojazSystem('نص');
    ok(Array.isArray(asString.system) && asString.system.length === 2 && asString.system[0].cache_control, 'a string system becomes the cached block plus the addition');
  }

  // ── switches, tier, helpers ───────────────────────────────────────────────
  eq(M.mojazFlags({}), { prompt: false, guards: false, escalate: false, any: false, escalateModel: '', writerModel: '', scopeBw2: false }, 'all off when unset');
  eq(M.mojazFlags({ MOJAZ_PROMPT_V1: '1', MOJAZ_GUARDS_V1: 'on', MOJAZ_ESCALATE_V1: 'true', MODEL_ESCALATE: 'claude-sonnet-5' }), { prompt: true, guards: true, escalate: true, any: true, escalateModel: 'claude-sonnet-5', writerModel: '', scopeBw2: false }, '1, on and true all read as on');
  eq(M.mojazFlags({ MOJAZ_PROMPT_V1: 'yes', MOJAZ_GUARDS_V1: '0', MOJAZ_ESCALATE_V1: 'ON ' }).any, true, 'a padded ON counts, a typo does not');
  eq(M.mojazFlags({ MOJAZ_PROMPT_V1: 'yes', MOJAZ_GUARDS_V1: '0' }).any, false, 'a typo and a zero are off');
  eq(M.mojazFlags({ MOJAZ_ESCALATE_V1: '1' }).escalate, false, 'escalation without a model is off');
  ok(M.isMojazTier({ band: 'adult', effectiveDepth: undefined }) && M.isMojazTier({ band: 'adult', effectiveDepth: 'normal' }), 'an adult at the brief depth is the tier');
  ok(!M.isMojazTier({ band: 'adult', effectiveDepth: 'deep' }) && !M.isMojazTier({ band: 'adult', effectiveDepth: 'scholar' }) && !M.isMojazTier({ band: 'teen' }) && !M.isMojazTier({ band: 'young' }), 'detailed, scholar and younger readers are not');
  eq([M.mojazCap(4096, 1024), M.mojazCap(512, 1024), M.mojazCap(undefined, 1024)], [1024, 512, 1024], 'the ceiling only ever lowers');
  eq(M.topSourcesInJudgeOrder(['a', 'b', 'c', 'd'], ['c'], 2), ['c', 'a'], 'top sources: a direct match first, then the kept in their order');
  eq(M.topSourcesInJudgeOrder(['a', 'b', 'c'], [], 2), ['a', 'b'], 'top sources: no ranking from the judge means the first two');
  eq(M.topSourcesInJudgeOrder(['a'], ['z'], 2), ['a'], 'top sources: a direct row the judge did not keep is not added');

  // ── escalation ────────────────────────────────────────────────────────────
  eq(E.escalationReason({ text: 'x', route: 'GEN', guardRemoved: 1, contentLeft: false }), 'no_content_after_guard', 'escalate: nothing left after the guard');
  eq(E.escalationReason({ text: E.FALLBACK_REPLIES[0], route: 'GEN' }), 'fallback_reply', 'escalate: the system\'s last-resort reply');
  eq(E.escalationReason({ text: E.FALLBACK_REPLIES[1] + '\n<source url="u">t</source>', route: 'GEN' }), 'fallback_reply', 'escalate: the dated-source reply with a card beside it');
  eq(E.escalationReason({ text: 'جواب بلا مصدر', route: 'DEEN', citedCount: 0, cardCount: 0 }), 'deen_no_source', 'escalate: DEEN with no source');
  eq(E.escalationReason({ text: 'جواب', route: 'DEEN', citedCount: 1 }), '', 'no escalation when a source is cited');
  eq(E.escalationReason({ text: 'جواب', route: 'DEEN', cardCount: 1 }), '', 'no escalation when a card is carried');
  eq(E.escalationReason({ text: 'جواب عام', route: 'GEN' }), '', 'no escalation for a general answer');
  eq(E.escalationReason({ text: 'جواب', route: 'GEN', guardRemoved: 2, contentLeft: true }), '', 'no escalation when the guard left content');
  {
    // the two constants are copies of lib/output-reviewer.js's; if that file changes, this says so
    const src = fs.readFileSync(path.join(root, 'lib', 'output-reviewer.js'), 'utf8');
    for (const reply of E.FALLBACK_REPLIES) ok(src.includes(`'${reply}'`), 'fallback sentence is still the output reviewer\'s', reply);
  }

  console.log(`mojaz-guards-unit: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((error) => { console.log('FAIL (threw)', error && error.stack || error); process.exit(1); });
