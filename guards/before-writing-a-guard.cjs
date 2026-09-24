// guards/before-writing-a-guard.cjs -- م٢-أ (BEFORE_WRITING_V1): the sharia question's evidence is
// gathered in parallel and PINNED before the first character; a hadith question gets no fiqh books
// and no encyclopedia on any road; and with the switch off nothing moves.
//
// THE OWNER'S ITEM (program order 2026-09-24, م٢-أ): «في السؤالِ الشرعيِّ يُجمَعُ في الثانيةِ الأولى
// بالتوازي — الفتاوى المخزّنة · المكتبة · الموسوعة — ويُثبَّتُ قبلَ أوّلِ حرف. وسؤالُ الحديثِ يبقى على
// طريقِ التخريجِ والدرر، ولا تأتيه كتبُ الفقهِ ولا الموسوعةُ ولو كانَ موضوعُه فقهيًّا (تجربةُ المالك ١١ و١٢)».
//
// FIXTURES, FROM WHAT IS SAVED AND NOT FROM A NEW QUESTION:
//   * owner test 11 and 12, letter for letter (EZIK-SOURCES-OWNER-TEST-2026-09-24.md);
//   * owner test 7 («تبرعت بالدم…»), whose delivered answer made the Hanbalis hold «does not nullify,
//     however much» because the encyclopedia row stopped at 1,200 characters, mid-sentence;
//   * the two item-32 questions (EZIK-ITEM32-OWNER-TEST-2026-09-24.md), 271 and 259 characters,
//     which the fatwa store refused with 400 on production (its cap is 180).
//
// WHAT THIS PINS:
//   A  api/ask.js reads the switch once and hands the loop `beforeWriting` only for 'on' + adult;
//   B  hadith vs fiqh is decided from the question before anything is fetched, and the fatwa
//      queries are short (≤ 180 characters, ≤ 3 words);
//   C  driven: the pinned block reaches the FIRST provider call with fatwa, encyclopedia and book
//      rows in a fixed order and their full text; a hadith turn gets no library call, no
//      `search_library` offer and no encyclopedia row even when the model calls `search_sources`;
//      «وسّع البحث» returns to the old loop; and the switch off leaves the old prefetch as it was.
//
// RED ON THE OLD TREE: `node guards/before-writing-a-guard.cjs --root <tree>` drives another tree's
// modules with the same fixtures (the old tree has no lib/before-writing.js and ignores the option).
//
// Usage: node guards/before-writing-a-guard.cjs [--root <tree>]
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const rootArg = process.argv.indexOf('--root');
const REPO = rootArg > 0 ? path.resolve(process.argv[rootArg + 1]) : path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8').replace(/\r\n/g, '\n');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 400) : ''));
  return false;
}
async function quiet(fn) {
  const saved = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  console.log = () => {}; console.warn = () => {}; console.error = () => {}; console.info = () => {};
  try { return await fn(); } finally { Object.assign(console, saved); }
}

const T11 = 'من روى حديث: «من غشنا فليس منا»؟ وهل هو في الصحيحين؟';
const T12 = 'ما درجة حديث: «تبسمك في وجه أخيك لك صدقة»؟ ومن رواه؟';
const T7 = 'تبرعت بالدم وأنا على وضوء، هل خروج الدم الكثير ينقض الوضوء؟';
const Q32A = 'اشرح لي أحكام صلاة المسافر كاملة بالتفصيل: متى يبدأ القصر ومتى ينتهي، ومسافة القصر عند المذاهب الأربعة بأدلتها، وحكم الجمع بين الصلاتين للمسافر وصوره، وحكم صلاة المسافر خلف المقيم والمقيم خلف المسافر، ومتى تنقطع أحكام السفر بنية الإقامة، مع ذكر الخلاف والراجح في كل مسألة';
const Q32B = 'اذكر لي أحكام الزكاة كاملة بالتفصيل: شروط وجوبها، وأنصبة الذهب والفضة والنقود وعروض التجارة والأنعام والزروع والثمار، ومقدار الواجب في كل صنف، وحكم زكاة الديون والأسهم والرواتب المدخرة والحلي، ومصارف الزكاة الثمانية بشرح كل مصرف، مع أدلة كل مسألة والخلاف فيها';

const LIB_ORIGIN = 'https://lib.ezik.app';
const HANBALI_LINE = 'وَيَرَى الْحَنَابِلَةُ أَنَّ الرُّعَافَ لاَ يَنْقُضُ الْوُضُوءَ إِلاَّ إِذَا كَانَ فَاحِشًا كَثِيرًا';
// An atom longer than the 1,200 characters a row's `text` carries, with the madhhab line past it.
const LONG_ATOM = 'رعاف التعريف: الرعاف لغة الدم الخارج من الأنف. '.repeat(30) + HANBALI_LINE + '.';
const libHits = () => ([
  { atom_id: 'FC-003910:0220:004', subject_id: 'FC-003910', book_title: 'الموسوعة الفقهية الكويتية', author: 'وزارة الأوقاف',
    heading_path: ['رعاف', 'نقض الوضوء بالرعاف'], heading_kind: 'section', volume: 22, page_start: 263, page_end: 264,
    page_citable: true, numbering: 'print', text: LONG_ATOM, truncated: false, score: 20 },
  { atom_id: 'FC-003592:0040:002', subject_id: 'FC-003592', book_title: 'بداية المجتهد ونهاية المقتصد', author: 'ابن رشد الحفيد',
    heading_path: ['كتاب الطهارة', 'نواقض الوضوء'], heading_kind: 'section', volume: 1, page_start: 40, page_end: 40,
    page_citable: true, numbering: 'print', text: 'اختلف العلماء في انتقاض الوضوء بما يخرج من الجسد من النجس.', truncated: false, score: 12 },
]);
const jsonResponse = (url, obj, { status = 200 } = {}) => ({
  ok: status >= 200 && status < 300, status, url: String(url),
  headers: { get: (h) => {
    const k = String(h).toLowerCase();
    if (k === 'content-type') return 'application/json';
    if (k === 'content-length') return String(Buffer.byteLength(JSON.stringify(obj), 'utf8'));
    return null;
  } },
  json: async () => obj, text: async () => JSON.stringify(obj),
});

async function main() {
  console.log('before-writing-a guard — root ' + REPO);
  const askSrc = read('api/ask.js');
  const loopSrc = read('lib/free-brain/loop.js');

  // ── A · WIRING ─────────────────────────────────────────────────────────────────────────
  {
    const reads = (askSrc.match(/process\.env\.BEFORE_WRITING_V1/g) || []).length;
    ok('A1  api/ask.js reads BEFORE_WRITING_V1 exactly once, trimmed and lower-cased',
      reads === 1 && askSrc.includes("const beforeWritingValue = String(process.env.BEFORE_WRITING_V1 || '').trim().toLowerCase();"),
      'reads=' + reads);
    const expr = (/\n\s*beforeWriting: \(([^\n]+)\)\n\s*\? \{ libFlagValue, libToken \} : null,\n/.exec(askSrc) || [])[1] || '';
    const hand = (v, band) => { try { return new Function('beforeWritingValue', 'band', 'return (' + expr + ');')(v, band); } catch { return 'threw'; } };
    ok('A2  the loop is handed `beforeWriting` only for the literal «on» and an adult band',
      expr !== '' && hand('on', 'adult') === true && hand('', 'adult') === false && hand('off', 'adult') === false
      && hand('true', 'adult') === false && hand('1', 'adult') === false && hand('on', 'young') === false
      && hand('on', 'teen') === false && hand('on', '') === false, expr || '(expression not found)');
    ok('A3  the loop takes `beforeWriting` (default null) and imports the module that decides it',
      /\n\s*beforeWriting = null,\n/.test(loopSrc) && loopSrc.includes("from '../before-writing.js';"));
  }

  // ── B · CLASSIFICATION AND QUERIES, BEFORE ANYTHING IS FETCHED ─────────────────────────
  let BW = null;
  try { BW = await esm('lib/before-writing.js'); } catch (e) { ok('B0  lib/before-writing.js loads', false, e.message); }
  if (BW) {
    const k = (question, storedRuntime, lexicalRoute = 'DEEN') => BW.classifyShariaTurn({ question, storedRuntime, lexicalRoute });
    ok('B1  owner test 11 (production calls it STORED_FIQH) is a HADITH question', k(T11, 'STORED_FIQH') === 'hadith');
    ok('B2  owner test 12 is a HADITH question', k(T12, 'HADITH') === 'hadith' && k(T12, 'STORED_FIQH') === 'hadith');
    ok('B3  «هل صح حديث …» and «أين ورد حديث …» are hadith questions',
      k('هل صح حديث: «حب الوطن من الإيمان»؟', 'STORED_FIQH') === 'hadith'
      && k('أين ورد حديث «اطلبوا العلم ولو بالصين»؟', 'STORED_FIQH') === 'hadith');
    ok('B4  a fiqh question that merely says «هل يصح» or asks for its proof stays fiqh',
      k('هل يصح الصيام بدون نية؟', 'STORED_FIQH') === 'fiqh'
      && k('ما حكم الجمع بين الصلاتين للمطر؟ وما دليله من الحديث؟', 'STORED_FIQH') === 'fiqh'
      && k(T7, 'STORED_FIQH') === 'fiqh');
    ok('B5  a worldly route is neither', k('شلون أنظف مكيف السبليت؟', 'GENERAL', 'GEN') === 'other');
    const all = [T7, Q32A, Q32B].flatMap((q) => BW.fatwaQueries(q));
    ok('B6  every fatwa query is short: ≤ 180 characters and ≤ 3 words (the item-32 questions were 271 and 259 and got 400)',
      all.length >= 3 && all.every((q) => q.length <= 180 && q.split(' ').length <= 3), JSON.stringify(all));
    ok('B7  the reader\'s «وسّع البحث في المصادر» is recognised, an ordinary question is not',
      BW.asksToWidenSearch('وسّع البحث في المصادر') === true && BW.asksToWidenSearch(T7) === false);
  }

  // ── C · DRIVEN ───────────────────────────────────────────────────────────────────────────
  let LOOP = null, CONTRACT = null, ENC = null;
  try {
    LOOP = await esm('lib/free-brain/loop.js');
    CONTRACT = await esm('lib/fatwa-contract.js');
    ENC = await esm('lib/encyclopedia.js');
  } catch (e) { ok('C0  the loop loads', false, e.message); }
  if (LOOP && CONTRACT && ENC) {
    await quiet(() => ENC.searchStoredCorpus('الوضوء', { limit: 1 }));   // the index warm, so no member races a cold build
    const scholars = CONTRACT.FATWA_SCHOLARS.map((entry) => ({ id: entry.id, snapshot: { records: entry.count } }));
    const fatwaRecord = {
      id: 'g-1', uid: 'binbaz:g-1', scholar: { id: 'binbaz' }, source: { url: 'https://binbaz.org.sa/fatwas/9999/g' },
      title: 'حكم خروج الدم الكثير من البدن هل ينقض الوضوء',
      content: { type: 'question_answer', question: 'هل خروج الدم الكثير من غير السبيلين ينقض الوضوء؟',
        answer: 'خروج الدم من غير السبيلين لا ينقض الوضوء على الصحيح وإن كثر، والأحوط الوضوء إذا كثر خروجا من الخلاف.' },
    };
    const drive = async (question, extra = {}, script = null) => {
      const log = [];   // { kind, at, url, body }
      const provider = [];
      const t0 = Date.now();
      const realFetch = globalThis.fetch;
      let round = 0;
      globalThis.fetch = async (url, init) => {
        const u = String(url);
        if (u.startsWith('https://provider.invalid')) {
          const body = JSON.parse(init.body);
          provider.push({ at: Date.now() - t0, body });
          round += 1;
          const reply = script && script[round - 1] ? script[round - 1]
            : { content: [{ type: 'text', text: 'جواب الاختبار [[1]].' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } };
          return jsonResponse(u, reply);
        }
        log.push({ kind: 'global', at: Date.now() - t0, url: u });
        return jsonResponse(u, {}, { status: 503 });
      };
      const fetchImpl = async (url, init) => {
        const u = String(url);
        if (u.startsWith(LIB_ORIGIN)) {
          let body = null; try { body = JSON.parse(init && init.body || 'null'); } catch { body = null; }
          log.push({ kind: 'lib', at: Date.now() - t0, url: u, body });
          return jsonResponse(u, { hits: libHits(), took_ms: 1, refused: false });
        }
        if (u.startsWith(CONTRACT.FATWA_BASE + '/api/v1/')) {
          const parsed = new URL(u);
          if (parsed.pathname === '/api/v1/health') return jsonResponse(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, counts: { scholars: scholars.length } });
          if (parsed.pathname === '/api/v1/scholars') return jsonResponse(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, scholars });
          log.push({ kind: 'fatwa', at: Date.now() - t0, url: u, q: parsed.searchParams.get('q') || '' });
          return jsonResponse(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, results: [fatwaRecord], pagination: { total: 1 } });
        }
        log.push({ kind: 'other', at: Date.now() - t0, url: u });
        return jsonResponse(u, {}, { status: 503 });
      };
      let out = null;
      try {
        out = await quiet(() => LOOP.runFreeBrainTurn(Object.assign({
          messages: [{ role: 'user', content: question }],
          system: 'system', model: 'model', maxTokens: 512, effort: 'high', band: 'adult', mode: 'chat',
          lexicalRoute: 'DEEN', storedRuntime: 'STORED_FIQH',
          providerUrl: 'https://provider.invalid/v1/messages', headers: {}, env: {}, fetchImpl,
        }, extra)));
      } finally { globalThis.fetch = realFetch; }
      const first = provider[0] ? provider[0].body : null;
      const lastUser = first ? [...(first.messages || [])].reverse().find((m) => m.role === 'user') : null;
      const blocks = lastUser ? (Array.isArray(lastUser.content) ? lastUser.content : [{ type: 'text', text: lastUser.content }]) : [];
      const appended = blocks.slice(1).map((b) => String(b.text || '')).join('\n');
      return { out, log, provider, first, appended, tools: first ? (first.tools || []).map((t) => t.name) : [] };
    };
    const BWON = { beforeWriting: { libFlagValue: 'on', libToken: 'tk-guard-bw' } };

    // C1-C3 — the fiqh turn.
    const fiqh = await drive(T7, BWON);
    const note = BW ? BW.BW_PINNED_NOTE : 'نصوصٌ جُمِعَتْ لهذا السؤالِ قبلَ الكتابة';
    const refsOf = (label) => [...fiqh.appended.matchAll(/\[\[(\d+)\]\] ([^\n]+)/g)]
      .filter((m) => m[2].startsWith(label)).map((m) => Number(m[1]));
    const fatwaRefs = refsOf('فتوى'), encRefs = refsOf('الموسوعة الفقهية الكويتية'), bookRefs = refsOf('كتاب');
    ok('C1  the FIRST provider call already carries the pinned block, named by source: fatwa, encyclopedia, books',
      fiqh.appended.startsWith(note) && fatwaRefs.length >= 1 && encRefs.length >= 1 && bookRefs.length >= 1,
      JSON.stringify({ fatwaRefs, encRefs, bookRefs, head: fiqh.appended.slice(0, 160) }));
    ok('C2  the refs are assigned in a fixed order — fatwas, then encyclopedia, then books — not by arrival',
      fatwaRefs.length && encRefs.length && bookRefs.length
      && Math.max(...fatwaRefs) < Math.min(...encRefs) && Math.max(...encRefs) < Math.min(...bookRefs),
      JSON.stringify({ fatwaRefs, encRefs, bookRefs }));
    ok('C3  a pinned row carries its FULL text: the Hanbali line past character 1,200 reaches the writer',
      fiqh.appended.includes(HANBALI_LINE.slice(0, 40)),
      'appended length ' + fiqh.appended.length);
    const encBlocks = fiqh.appended.split('\n\n───\n\n').filter((b) => /^\[\[\d+\]\] الموسوعة الفقهية الكويتية/.test(b));
    ok('C4  an encyclopedia row is pinned with more than the 1,200-character head',
      encBlocks.some((b) => b.length > 1300), JSON.stringify(encBlocks.map((b) => b.length)));
    const libCalls = fiqh.log.filter((e) => e.kind === 'lib');
    const ids = libCalls[0] && libCalls[0].body && libCalls[0].body.filters ? libCalls[0].body.filters.book_ids : null;
    ok('C5  the library is asked for the two comparative books (encyclopedia with pages, بداية المجتهد) with a short query',
      libCalls.length >= 1 && JSON.stringify(ids) === JSON.stringify(['FC-003910', 'FC-003592'])
      && String(libCalls[0].body.q || '').length <= 180, JSON.stringify(libCalls.map((c) => c.body)));
    const fatwaCalls = fiqh.log.filter((e) => e.kind === 'fatwa');
    ok('C6  the fatwa store is asked short queries (≤ 180 characters, ≤ 3 words), never the raw question',
      fatwaCalls.length >= 1 && fatwaCalls.every((c) => c.q.length <= 180 && c.q.split(' ').length <= 3 && c.q !== T7),
      JSON.stringify(fatwaCalls.map((c) => c.q)));
    const firstAt = fiqh.provider[0] ? fiqh.provider[0].at : -1;
    ok('C7  every store was asked BEFORE the first provider call (gathered before the first character)',
      firstAt >= 0 && [...libCalls, ...fatwaCalls].every((c) => c.at <= firstAt));

    // C8-C10 — the hadith turn: no fiqh books, no encyclopedia, on any road, even with the old switches on.
    const OLD = { encycPrefetch: true, libPrefetch: { flagValue: 'on', token: 'tk-guard-bw' } };
    const hadith = await drive(T11, { ...BWON, ...OLD });
    ok('C8  owner test 11 under the switch: no library call and nothing from the fiqh stores pinned',
      hadith.log.filter((e) => e.kind === 'lib').length === 0 && !hadith.appended.includes('الموسوعة الفقهية الكويتية')
      && !hadith.appended.includes('كتاب'), JSON.stringify({ lib: hadith.log.filter((e) => e.kind === 'lib').length, appended: hadith.appended.slice(0, 160) }));
    ok('C9  and `search_library` is not offered to a hadith turn', hadith.first && !hadith.tools.includes('search_library'),
      JSON.stringify(hadith.tools));
    const toolScript = [
      { content: [{ type: 'tool_use', id: 'tu1', name: 'search_sources', input: { query: 'تبسمك في وجه أخيك لك صدقة' } }], stop_reason: 'tool_use', usage: { input_tokens: 1, output_tokens: 1 } },
      { content: [{ type: 'text', text: 'جواب الحديث.' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } },
    ];
    const t12 = await drive(T12, { ...BWON, storedRuntime: 'HADITH' }, toolScript);
    const t12Off = await drive(T12, { storedRuntime: 'HADITH' }, toolScript);
    const encRows = (o) => (o && Array.isArray(o.evidence) ? o.evidence : []).filter((r) => r.kind === 'encyclopedia').length;
    ok('C10 owner test 12 under the switch: the model\'s own `search_sources` brings back no encyclopedia row',
      t12.out && encRows(t12.out) === 0, 'rows=' + encRows(t12.out));
    ok('C11 control: the same turn with the switch off still gets the encyclopedia (the check can see it)',
      t12Off.out && encRows(t12Off.out) > 0, 'rows=' + encRows(t12Off.out));

    // C12 — the reader's «وسّع البحث»: the old loop, with nothing pinned.
    const widen = await drive('وسّع البحث في المصادر', BWON);
    ok('C12 «وسّع البحث» returns the turn to the old loop: nothing pinned, the tools offered',
      widen.out && widen.out.storedInjection && widen.out.storedInjection.reason === 'before_writing:widen'
      && widen.appended === '' && widen.tools.includes('search_live'),
      JSON.stringify(widen.out && widen.out.storedInjection));

    // C13 — the switch off: the old prefetch as it was, byte for byte in its request.
    const off = await drive(T7, {});
    const offFatwa = off.log.filter((e) => e.kind === 'fatwa');
    ok('C13 the switch off: no pinned block, and the old fatwa offer still sends the question as it always did',
      !off.appended.startsWith(note) && offFatwa.length >= 1 && offFatwa.some((c) => c.q.includes('تبرعت')),
      JSON.stringify(offFatwa.map((c) => c.q)));
  }

  console.log(`\n=== before-writing-a: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
