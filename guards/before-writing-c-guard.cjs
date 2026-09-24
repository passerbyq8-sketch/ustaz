// guards/before-writing-c-guard.cjs -- م٢-ج (BEFORE_WRITING_V1): the ruling is reviewed sentence by
// sentence against EVERY text retrieved for the issue — a madhhab, «الجمهور», «الإجماع/اتفقوا/لا خلاف»,
// a council, a named book, and an absolute «يجوز/لا يجوز/يجب/يحرم» — and what no text supports is
// returned to its source's words, removed, or said to have no text.
//
// THE OWNER'S ITEM (program order 2026-09-24, م٢-ج) and §٢-٤: «قوّةُ الفقهِ بالأمانةِ للمصدرِ لا
// بالمحتوى وحدَه: لا نسبةَ لمذهبٍ أو جمهورٍ أو إجماعٍ إلّا من نصٍّ مسترجَع».
//
// FIXTURES — FROM WHAT IS SAVED, NOT FROM A NEW QUESTION:
//   * the hallucinated sentences of §4 of EZIK-SOURCES-REPORT-2026-09-24.md, verbatim: «الجمهور»
//     without a source (F01, F03, F06, N07), the false agreement on the menstruating woman's divorce
//     (F12 ×2), «اتّفقوا» on excusing small impurities (X03), «كما جاء في كشاف القناع» for what its own
//     card negates (X03), «بلا خلاف» (F05, N08), «أجمع الفقهاء» (N01), and the absolute «جائز» (F10);
//   * owner test 7, verbatim (EZIK-SOURCES-OWNER-TEST-2026-09-24.md): the Hanbalis made to hold «does
//     not nullify, however much», with the encyclopedia's v22 «رعاف» card saying the opposite;
//   * Sheikh Nayef al-Ajmi's «صفات صلاة الخوف حسب المذاهب الأربعة» (brief): its text is NOT saved
//     anywhere in the archive (decision D5), so its four wrong madhhab claims are written as the
//     program order itself describes them;
//   * table 111 row 29 (a consensus claim) is the consensus family above; row 38 (a fiqh hallucination
//     from the model) is «فلا تصح صلاة من صلى مكشوف الصدر أو الظهر», an absolute ruling.
//
// WHAT THIS PINS — and what it does NOT: the model that reads the texts is stubbed here, so this
// guard proves the DETECTION, the VERBATIM-QUOTE CHECK, the REMEDY and the WIRING, and that the old
// tree lets every fixture through. Whether the fast model judges a real answer rightly is proven only
// on the owner's preview.
//   R1  every fixture is detected, with its kind;
//   R2  a hadith card, «(متفق عليه)» and a plain sentence are not claims;
//   R3  the remedy: contradicted + a verbatim quote ⟹ the source's own words; not_found ⟹ removed and
//       one «لم أقفْ على نصٍّ…» per kind; a quote not in its text, or a consensus «support» that does
//       not say consensus, is NOT support; with the reader down, a majority claim whose marker is in no
//       text is still removed, anything else is left and counted;
//   R4  driven through the loop: the review runs after the write and before the reviewer, on the fast
//       model, and its change is what the reader receives; with the switch off, nothing runs.
'use strict';
const path = require('path');
const { pathToFileURL } = require('url');

const rootArg = process.argv.indexOf('--root');
const REPO = rootArg > 0 ? path.resolve(process.argv[rootArg + 1]) : path.join(__dirname, '..');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 500) : ''));
  return false;
}
async function quiet(fn) {
  const saved = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  console.log = () => {}; console.warn = () => {}; console.error = () => {}; console.info = () => {};
  try { return await fn(); } finally { Object.assign(console, saved); }
}

// ── THE FIXTURES, VERBATIM ────────────────────────────────────────────────────────────────
const FIX = [
  ['F01-majority', 'majority', 'يجوز الجمعُ بسببه بين المغرب والعشاء عند من يرى القياس على المطر والريح، وهو مذهب جمهور الفقهاء في الجملة.'],
  ['F03-majority', 'majority', 'نعم، والصحيح عند جمهور من الفقهاء أنّ أكل لحم الإبل ينقض الوضوء، ويجب الوضوء منه.'],
  ['F06-majority', 'majority', 'وهذا الإمساك مستحبٌّ عند جمهور العلماء وليس واجبًا، فلو أخذ المضحّي شيئًا من شعره أو أظفاره ناسيًا أو جاهلًا فلا إثم عليه ولا فديةَ، وإن كان تعمّد ذلك فقد ترك الأولى.'],
  ['N07-majority', 'majority', 'الجمهورُ من أهل العلم على أنّ ما نزل عن الكعبين من الثياب حرامٌ على الرجل مطلقًا، سواء قصد به الخيلاءَ أو لم يقصد، وإن كان الإثمُ يشتدُّ ويتأكّدُ إذا كان القصدُ الخيلاءَ والتكبّر.'],
  ['F12-agreement', 'consensus', 'وإن كان زوجُكِ لا يعلمُ أنّكِ حائضٌ حين طلَّقكِ، فالطلاقُ يقع باتفاق، لأنّه لم يتعمّد مخالفةَ السنّة.'],
  ['F12-no-khilaf', 'consensus', 'أمّا إن كان لا يعلم بحالك ثمّ تبيّن له بعد الطلاق أنّك كنتِ حائضًا، فالطلاق يقع بلا خلافٍ يُذكر في هذه الحال.'],
  ['X03-ittafaqu', 'consensus', 'لكنّهم اتّفقوا على أنّ ما يشقُّ التحرّزُ منه من يسيرِ النجاسات يُعفى عنه، دفعًا للحرجِ عن المكلَّف.'],
  ['X03-kashshaf', 'book', 'فالخلاصة أنّ اليسير من النجاسة التي يعسر الاحتراز منها، كرشاش البول اليسير، أو أثر الدم القليل من جرحٍ أو حيضٍ، أو أثر الاستجمار، معفوٌّ عنه فلا يبطل الصلاة، بخلاف الكثير الفاحش، وبخلاف المائع والمطعوم النجس فلا يُعفى فيه عن شيء البتّة، كما جاء في كشاف القناع.'],
  ['F05-bila-khilaf', 'consensus', 'تَقْرَأُ كَذَلِكَ عَنْ ظَهْرِ قَلْبٍ مِنْ حِفْظِهَا بِلَا خِلَافٍ يُعْتَدُّ بِهِ فِي الجَوَازِ عَلَى الرَّاجِحِ.'],
  ['N01-ajmaa', 'consensus', 'الجمعُ بين الظهرِ والعصرِ: هذا الذي يخصّك، وقد أجمعَ الفقهاءُ على مشروعيّةِ الجمعِ بين الصلاتين للعذر.'],
  ['N08-la-khilaf', 'consensus', 'وهذا هو الفارقُ بينه وبين "التورّق الفرديّ" الذي يشتري فيه الشخصُ سلعةً حقيقيّةً ثم يبيعها بنفسه لطرفٍ آخر مستقلّ، فهذا لا خلافَ في جوازه.'],
  ['F10-absolute', 'absolute', 'وأمّا بطاقةُ الائتمان (الفيزا) وبطاقةُ الصرّاف، فالشراء بها جائز؛ لأنّ حقيقة عمل بطاقة الائتمان قرضٌ من البنك لحاملها، والثمنُ يُدفع للبائع فورًا لا تأخّر فيه، فيتحقّق القبضُ المشترط شرعًا.'],
  ['T7-hanbali-a', 'madhhab', 'وظاهر مذهب الحنابلة أن الرعاف لا ينقض الوضوء، وفي الكثير من الدم عندهم لا حد له سوى أن يكون فاحشا في نظر الإنسان نفسه.'],
  ['T7-hanbali-b', 'madhhab', 'فعلى قول جمهور الصحابة ومذهب المالكية والشافعية وظاهر مذهب الحنابلة، فإن خروج الدم بالتبرع لا ينقض وضوءك، ولو كان كثيرا، لأنه من غير السبيلين.'],
  ['KHAWF-hanafi', 'madhhab', 'فعند الحنفية يقف الإمام بالطائفة الأولى في التشهد ثم يسلم بالجميع.'],
  ['KHAWF-maliki', 'madhhab', 'وعند المالكية ينتظر الإمام الطائفة الثانية جالسا ويسلم بها.'],
  ['KHAWF-shafii', 'madhhab', 'وعند الشافعية صلاة بطن نخل: يصلي بكل طائفة ركعة ركعة.'],
  ['KHAWF-hanbali', 'madhhab', 'وعند الحنابلة تتم الطائفتان صلاتهما بعد سلامه.'],
  ['R38-absolute', 'absolute', 'فلا تصح صلاة من صلى مكشوف الصدر أو الظهر.'],
];

async function main() {
  console.log('before-writing-c guard — root ' + REPO);
  let RR = null;
  try { RR = await esm('lib/ruling-review.js'); } catch (e) { ok('R0  lib/ruling-review.js loads', false, e.message); }

  if (RR) {
    // R1 — detection.
    for (const [id, kind, sentence] of FIX) {
      const found = RR.claimSentences(sentence);
      ok(`R1  ${id}: detected as a «${kind}» claim`, found.length === 1 && found[0].kinds.includes(kind),
        JSON.stringify(found.map((c) => c.kinds)));
    }
    // R2 — what is not a claim.
    const card = '<hadith narrator="أبو هريرة">«لا يجب عليكم إلا ما أوجب الله»</hadith>';
    ok('R2  a hadith card, «(متفق عليه)» and a plain sentence are not claims',
      RR.claimSentences(card).length === 0
      && RR.claimSentences('قال النبي ﷺ: «إنما الأعمال بالنيات» (متفق عليه).').length === 0
      && RR.claimSentences('وهذه المسألة من مسائل الطهارة.').length === 0);

    // R3 — the remedy, with the reader stubbed.
    const ENC = await esm('lib/encyclopedia.js');
    const TOOLS = await esm('lib/free-brain/tools.js');
    const found = await quiet(() => ENC.searchStoredCorpus('رعاف', { limit: 6 }));
    const rec = (found.records || []).find((r) => r.term === 'رعاف' || r.term === 'رُعاف') || (found.records || [])[0];
    const encRow = { ...TOOLS.encyclopediaRow(rec), fullText: String(rec.text || ''), ref: 1 };
    const fold = (s) => String(s || '').replace(/\s+/gu, ' ');
    const words = fold(encRow.fullText).split(' ');
    const at = words.findIndex((w) => w.includes('الحنابله'));
    const quote = at >= 0 ? words.slice(Math.max(0, at - 2), at + 10).join(' ') : words.slice(0, 12).join(' ');
    const t7 = FIX.find((f) => f[0] === 'T7-hanbali-b')[2];
    const ask = (reply) => async () => JSON.stringify(reply);
    const r1 = await RR.reviewRulings({ text: t7 + ' [[1]]', rows: [encRow], ask: ask({ claims: [{ id: 1, verdict: 'contradicted', row: 1, quote }] }) });
    ok('R3a owner test 7: contradicted with a verbatim quote ⟹ replaced by what the encyclopedia says, attributed to it',
      !r1.text.includes('ولو كان كثيرا') && r1.text.includes('الموسوعة الفقهية الكويتية') && r1.text.includes(quote.trim())
      && r1.text.includes('[[1]]') && r1.record.contradicted === 1, r1.text + ' | quote=' + quote);
    const n07 = FIX.find((f) => f[0] === 'N07-majority')[2];
    const r2 = await RR.reviewRulings({ text: n07, rows: [encRow], ask: ask({ claims: [{ id: 1, verdict: 'not_found' }] }) });
    ok('R3b «الجمهور» with no text ⟹ removed, and one sentence says no text names the majority',
      !r2.text.includes('حرامٌ على الرجل') && r2.text.includes('الجمهور') && r2.text.startsWith('ولم أقفْ') && r2.record.notFound === 1, r2.text);
    const f12 = FIX.find((f) => f[0] === 'F12-agreement')[2];
    const r3 = await RR.reviewRulings({ text: f12, rows: [encRow], ask: ask({ claims: [{ id: 1, verdict: 'supported', row: 1, quote: 'اتفق الفقهاء على وقوع طلاق الحائض بلا خلاف بينهم' }] }) });
    ok('R3c a «support» whose quote is not in its text is not support: the agreement claim is removed',
      !r3.text.includes('يقع باتفاق') && r3.record.downgraded === 1 && r3.record.notFound === 1, r3.text);
    const r4 = await RR.reviewRulings({ text: f12, rows: [encRow], ask: ask({ claims: [{ id: 1, verdict: 'supported', row: 1, quote: words.slice(0, 8).join(' ') }] }) });
    ok('R3d a verbatim quote that does not say consensus does not support a consensus claim',
      !r4.text.includes('يقع باتفاق') && r4.record.downgraded === 1, r4.text + ' | ' + JSON.stringify(r4.record));
    const two = FIX.find((f) => f[0] === 'F03-majority')[2] + '\n' + FIX.find((f) => f[0] === 'F06-majority')[2];
    const r5 = await RR.reviewRulings({ text: two, rows: [encRow], ask: ask({ claims: [{ id: 1, verdict: 'not_found' }, { id: 2, verdict: 'not_found' }] }) });
    ok('R3e two unsupported majority claims ⟹ the «no text» sentence is said once',
      (r5.text.match(/ينسبُ هذا القولَ إلى الجمهور/gu) || []).length === 1 && r5.record.notFound === 2, r5.text);
    const r6 = await RR.reviewRulings({ text: n07 + '\n' + FIX.find((f) => f[0] === 'KHAWF-hanbali')[2], rows: [{ ...encRow, fullText: 'نص لا يذكر شيئا من ذلك في هذه المادة.' }],
      ask: async () => { throw Object.assign(new Error('upstream 529'), { status: 529 }); } });
    ok('R3f the reader down: a majority claim whose marker is in no text is still removed; the madhhab claim is left and counted',
      !r6.text.includes('حرامٌ على الرجل') && r6.text.includes('تتم الطائفتان') && r6.record.unverified === 1
      && String(r6.record.verifier).startsWith('error:'), r6.text + ' | ' + JSON.stringify(r6.record));
    const r7 = await RR.reviewRulings({ text: n07, rows: [], ask: ask({ claims: [] }) });
    ok('R3g no text gathered at all: the claim has nothing behind it and is removed', !r7.text.includes('حرامٌ على الرجل') && r7.record.verifier === 'no_rows', r7.text);
  }

  // R4 — driven through the loop.
  let LOOP = null, CONTRACT = null, ENC2 = null;
  try { LOOP = await esm('lib/free-brain/loop.js'); CONTRACT = await esm('lib/fatwa-contract.js'); ENC2 = await esm('lib/encyclopedia.js'); }
  catch (e) { ok('R4  the loop loads', false, e.message); }
  if (LOOP && CONTRACT && ENC2) {
    await quiet(() => ENC2.searchStoredCorpus('الوضوء', { limit: 1 }));
    const jsonResponse = (url, obj, { status = 200 } = {}) => ({
      ok: status >= 200 && status < 300, status, url: String(url),
      headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json'
        : String(h).toLowerCase() === 'content-length' ? String(Buffer.byteLength(JSON.stringify(obj), 'utf8')) : null) },
      json: async () => obj, text: async () => JSON.stringify(obj),
    });
    const scholars = CONTRACT.FATWA_SCHOLARS.map((entry) => ({ id: entry.id, snapshot: { records: entry.count } }));
    const WRITE = 'الجمهورُ من أهل العلم على أنّ خروج الدم الكثير ينقض الوضوء [[1]].\nوالأحوط الوضوء.';
    const drive = async (extra) => {
      const provider = [];
      const real = globalThis.fetch;
      globalThis.fetch = async (url, init) => {
        const u = String(url);
        if (u.startsWith('https://provider.invalid')) {
          const body = JSON.parse(init.body);
          provider.push(body);
          if (String(body.system || '').startsWith('أنتَ فاحصُ أمانةٍ فقهيّة')) {
            return jsonResponse(u, { content: [{ type: 'text', text: '{"claims":[{"id":1,"verdict":"not_found"}]}' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
          }
          return jsonResponse(u, { content: [{ type: 'text', text: WRITE }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
        }
        return jsonResponse(u, {}, { status: 503 });
      };
      const fetchImpl = async (url) => {
        const u = String(url);
        if (u.startsWith(CONTRACT.FATWA_BASE + '/api/v1/')) {
          const p = new URL(u).pathname;
          if (p === '/api/v1/health') return jsonResponse(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, counts: { scholars: scholars.length } });
          if (p === '/api/v1/scholars') return jsonResponse(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, scholars });
          return jsonResponse(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, results: [], pagination: { total: 0 } });
        }
        if (u.startsWith('https://lib.ezik.app')) return jsonResponse(u, { hits: [], took_ms: 1, refused: false });
        return jsonResponse(u, {}, { status: 503 });
      };
      let out = null;
      try {
        out = await quiet(() => LOOP.runFreeBrainTurn(Object.assign({
          messages: [{ role: 'user', content: 'تبرعت بالدم وأنا على وضوء، هل خروج الدم الكثير ينقض الوضوء؟' }],
          system: 'system', model: 'model', maxTokens: 512, effort: 'high', band: 'adult', mode: 'chat',
          lexicalRoute: 'DEEN', storedRuntime: 'STORED_FIQH',
          providerUrl: 'https://provider.invalid/v1/messages', headers: {}, env: {}, fetchImpl,
        }, extra)));
      } finally { globalThis.fetch = real; }
      return { out, provider };
    };
    const on = await drive({ beforeWriting: { libFlagValue: 'on', libToken: 'tk-guard-bw' } });
    const review = on.provider.find((b) => String(b.system || '').startsWith('أنتَ فاحصُ أمانةٍ فقهيّة'));
    const writerIdx = on.provider.findIndex((b) => b.system === 'system');
    const reviews = on.provider.filter((b) => String(b.system || '').startsWith('أنتَ فاحصُ أمانةٍ فقهيّة'));
    ok('R4a under the switch the review runs once, on the fast model, after the write',
      reviews.length === 1 && review && review.model === 'claude-haiku-4-5' && writerIdx >= 0 && on.provider.indexOf(review) > writerIdx
      && String(review.messages[0].content).includes('الجمهورُ من أهل العلم'),
      JSON.stringify(on.provider.map((b) => b.model)));
    const text = String(on.out && on.out.text || '');
    ok('R4b and the reader receives its remedy: the unsupported «الجمهور» sentence is gone, «لم أقفْ» stands',
      !text.includes('ينقض الوضوء') && text.includes('ولم أقفْ على نصٍّ ينسبُ هذا القولَ إلى الجمهور') && text.includes('والأحوط الوضوء'), text);
    const off = await drive({});
    ok('R4c the switch off: no review call, and the sentence ships as the model wrote it',
      !off.provider.some((b) => String(b.system || '').startsWith('أنتَ فاحصُ أمانةٍ فقهيّة'))
      && String(off.out && off.out.text || '').includes('الجمهورُ من أهل العلم'), String(off.out && off.out.text || ''));
  }

  console.log(`\n=== before-writing-c: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
