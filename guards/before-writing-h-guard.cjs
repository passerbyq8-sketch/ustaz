// guards/before-writing-h-guard.cjs -- م٢-ح (BEFORE_WRITING_V1): reconnect what was cut, where it is
// safe — the reviewer with its evidence, the khilaf signal from the texts, and no word attributed to
// the Prophet ﷺ without a retrieved hadith text.
//
// THE OWNER'S ITEM (program order 2026-09-24, م٢-ح): «وصلُ ما انقطع: مسبارُ الخلاف · المراجِعُ بأدلّتِه ·
// منعُ نسبةِ كلامِ غيرِه ﷺ إليه (لفظٌ يُنسَبُ إلى النبيِّ ﷺ لا بدَّ له من نصٍّ حديثيٍّ مسترجَع) · وبقيّةُ
// «غيرِ الموصول» في تقريرِ الفحص — يُقاسُ كلٌّ ويُوصَلُ حيثُ يسلم، ويُكتَبُ ما لا يسلم».
// MEASURED (02-brain/measure B, E): the reviewer sees only the rows the answer cited; the khilaf probe
// is frozen at null by an owner ruling and its gate; nothing on the free-brain path checks a word
// attributed to him ﷺ against a retrieved text («قال النبي ﷺ: «صلاة الخوف ركعة»» passed every run).
// The rest of the audit's list stays as it is, with its reasons, in the program report: each is either
// dead by an owner ruling and a gate, a no-op, or unsafe (it drops the whole reply).
//
// WHAT THIS PINS:
//   K1  the reviewer licenses a scholar's name from a pinned text the answer did not cite;
//   K2  the khilaf signal is true only on two verbatim quotes from two texts; else it is null, and the
//       frozen probe is untouched;
//   K3  a «…» quotation attributed to him ﷺ: carried by the takhrij ladder ⟹ kept; carried by nothing
//       ⟹ the sentence says the wording was not found;
//   K4  the ladder unreachable ⟹ nothing is removed, and it is counted;
//   K5  the switch off: none of it runs.
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
const jsonResponse = (url, obj, { status = 200 } = {}) => ({
  ok: status >= 200 && status < 300, status, url: String(url),
  headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json'
    : String(h).toLowerCase() === 'content-length' ? String(Buffer.byteLength(JSON.stringify(obj), 'utf8')) : null) },
  json: async () => obj, text: async () => JSON.stringify(obj),
});
const T7 = 'تبرعت بالدم وأنا على وضوء، هل خروج الدم الكثير ينقض الوضوء؟';
const FATWA_ANSWER = 'خروج الدم من غير السبيلين لا ينقض الوضوء على الصحيح وإن كثر، والأحوط الوضوء إذا كثر خروجا من الخلاف.';
const HANBALI = 'وذهب الحنابلة إلى أن الدم الكثير الفاحش ينقض الوضوء وأما اليسير فلا ينقض عندهم بحال من الأحوال.';
const REAL_MATN = 'من توضأ فأحسن الوضوء خرجت خطاياه من جسده حتى تخرج من تحت أظفاره';
const FAKE_MATN = 'الدم الكثير ينقض الوضوء ولو كان من جرح في غير السبيلين';

async function main() {
  console.log('before-writing-h guard — root ' + REPO);
  const LOOP = await esm('lib/free-brain/loop.js');
  const CONTRACT = await esm('lib/fatwa-contract.js');
  const ENC = await esm('lib/encyclopedia.js');
  let RR = null;
  try { RR = await esm('lib/ruling-review.js'); } catch { RR = null; }
  await quiet(() => ENC.searchStoredCorpus('الوضوء', { limit: 1 }));
  const scholars = CONTRACT.FATWA_SCHOLARS.map((entry) => ({ id: entry.id, snapshot: { records: entry.count } }));
  const fatwaRecord = {
    id: 'h-1', uid: 'binbaz:h-1', scholar: { id: 'binbaz' }, source: { url: 'https://binbaz.org.sa/fatwas/9998/h' },
    title: 'حكم خروج الدم الكثير من البدن هل ينقض الوضوء',
    content: { type: 'question_answer', question: 'هل خروج الدم الكثير من غير السبيلين ينقض الوضوء؟', answer: FATWA_ANSWER },
  };
  const hit = (id, text) => ({ atom_id: `${id}:0001:001`, subject_id: id, book_title: id === 'FC-003910' ? 'الموسوعة الفقهية الكويتية' : 'كتاب حديث',
    author: 'مؤلف', heading_path: ['باب'], heading_kind: 'section', volume: 1, page_start: 10, page_end: 10, page_citable: true, numbering: 'print', text, truncated: false, score: 9 });
  const drive = async ({ write, reading, bw = true, libOn = true }) => {
    const provider = [];
    const ladder = [];
    const real = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (u.startsWith('https://provider.invalid')) {
        const body = JSON.parse(init.body);
        provider.push(body);
        const sys = String(body.system || '');
        const text = sys === 'system' ? write : sys.startsWith('أنتَ فاحصُ') ? (typeof reading === 'function' ? reading(body) : reading) : 'لا';
        return jsonResponse(u, { content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
      }
      return jsonResponse(u, {}, { status: 503 });
    };
    const fetchImpl = async (url, init) => {
      const u = String(url);
      if (u.startsWith('https://lib.ezik.app')) {
        const body = JSON.parse(init && init.body || '{}');
        const ids = (body.filters && body.filters.book_ids) || [];
        if (ids.length > 6) {   // the takhrij ladder (54 books): it carries the real matn only
          ladder.push(body.q);
          return jsonResponse(u, { hits: String(body.q).includes('خطاياه') ? [hit('FC-000001', 'عن عثمان رضي الله عنه قال رسول الله صلى الله عليه وسلم: ' + REAL_MATN + '.')] : [], took_ms: 1, refused: false });
        }
        return jsonResponse(u, { hits: [hit('FC-003910', HANBALI)], took_ms: 1, refused: false });
      }
      if (u.startsWith(CONTRACT.FATWA_BASE + '/api/v1/')) {
        const p = new URL(u).pathname;
        if (p === '/api/v1/health') return jsonResponse(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, counts: { scholars: scholars.length } });
        if (p === '/api/v1/scholars') return jsonResponse(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, scholars });
        return jsonResponse(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, results: [fatwaRecord], pagination: { total: 1 } });
      }
      return jsonResponse(u, {}, { status: 503 });
    };
    let out = null;
    try {
      out = await quiet(() => LOOP.runFreeBrainTurn({
        messages: [{ role: 'user', content: T7 }],
        system: 'system', model: 'model', maxTokens: 512, effort: 'high', band: 'adult', mode: 'chat',
        lexicalRoute: 'DEEN', storedRuntime: 'STORED_FIQH',
        providerUrl: 'https://provider.invalid/v1/messages', headers: {}, env: {}, fetchImpl,
        ...(bw ? { beforeWriting: { libFlagValue: libOn ? 'on' : '', libToken: libOn ? 'tk-guard-bw' : '' } } : {}),
      }));
    } finally { globalThis.fetch = real; }
    return { out, provider, ladder };
  };

  // K1 — the reviewer licenses Ibn Bāz's name from the pinned fatwa the answer did not cite.
  const k1 = await drive({ write: 'قال ابن باز رحمه الله: خروج الدم من غير السبيلين لا ينقض الوضوء على الصحيح وإن كثر.', reading: '{"claims":[]}' });
  const counts = (k1.out && k1.out.verdict && k1.out.verdict.counts) || {};
  ok('K1  the reviewer is handed every pinned text: Ibn Bāz\'s name is licensed by his pinned fatwa, uncited',
    (counts['kept-sourced-attribution'] || 0) >= 1, JSON.stringify(counts));

  // K2 — the khilaf from two verbatim quotes of two texts.
  const refOf = (body, needle) => {
    const blocks = String(body.messages[0].content).split('\n\n');
    // The first block sits behind the «النصوص:» header line, so a ref is looked for at any line head.
    const block = blocks.find((x) => /(?:^|\n)\[\d+\]/.test(x) && x.includes(needle));
    return block ? Number(/(?:^|\n)\[(\d+)\]/.exec(block)[1]) : -1;
  };
  const khilafReading = (verbatim) => (body) => JSON.stringify({ claims: [], khilaf: { exists: true,
    a: { row: refOf(body, 'لا ينقض الوضوء على الصحيح'), quote: 'خروج الدم من غير السبيلين لا ينقض الوضوء على الصحيح' },
    b: { row: refOf(body, 'الدم الكثير الفاحش'), quote: verbatim ? 'ذهب الحنابلة إلى أن الدم الكثير الفاحش ينقض الوضوء' : 'الحنابلة يرون النقض بالدم مطلقا في كل حال' } } });
  const k2 = await drive({ write: 'لا ينقض خروج الدم الوضوء [[1]].', reading: khilafReading(true) });
  const k2b = await drive({ write: 'لا ينقض خروج الدم الوضوء [[1]].', reading: khilafReading(false) });
  ok('K2  the khilaf signal is true on two verbatim quotes from two texts, and null when one quote is not in its text',
    k2.out && k2.out.khilafFromOpinions === true && k2b.out && k2b.out.khilafFromOpinions === null,
    JSON.stringify({ a: k2.out && k2.out.khilafFromOpinions, b: k2b.out && k2b.out.khilafFromOpinions }));
  const probe = LOOP.khilafFromOpinionsProbe;
  ok('K2b the frozen probe is untouched: it still answers null', typeof probe === 'function' && probe([{ ref: 1 }, { ref: 2 }]) === null);

  // K3 — the prophetic words.
  const PW = `قال النبي ﷺ: «${REAL_MATN}».\nوقال رسول الله ﷺ: «${FAKE_MATN}».`;
  const k3 = await drive({ write: PW, reading: '{"claims":[]}' });
  const t3 = String(k3.out && k3.out.text || '');
  // D-2 E7 removes the leading conjunction in the terminal before-writing summary.
  const NF = (RR && RR.PROPHET_NOT_FOUND ? RR.PROPHET_NOT_FOUND : 'ولم أقفْ على هذا اللفظِ').replace(/^و/u, '');
  ok('K3  a quotation the ladder carries is kept; one nothing carries is replaced by «لم أقفْ على هذا اللفظِ…»',
    t3.includes('خرجت خطاياه') && !t3.includes('ولو كان من جرح') && t3.includes(NF) && k3.ladder.length >= 1,
    JSON.stringify({ ladder: k3.ladder, text: t3 }));
  const k4 = await drive({ write: PW, reading: '{"claims":[]}', libOn: false });
  const t4 = String(k4.out && k4.out.text || '');
  ok('K4  the ladder unreachable: nothing is removed, and it is counted',
    t4.includes('ولو كان من جرح') && k4.out && k4.out.prophetReview && k4.out.prophetReview.unverified === 2,
    JSON.stringify(k4.out && k4.out.prophetReview));
  const k5 = await drive({ write: PW, reading: '{"claims":[]}', bw: false });
  ok('K5  the switch off: none of it runs — the unfound quotation is left as the model wrote it',
    String(k5.out && k5.out.text || '').includes('ولو كان من جرح') && !(k5.out && k5.out.prophetReview), String(k5.out && k5.out.text || ''));
  console.log(`\n=== before-writing-h: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
