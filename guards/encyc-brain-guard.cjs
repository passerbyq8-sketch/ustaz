// guards/encyc-brain-guard.cjs -- ENCYC_V1: the Kuwaiti fiqh encyclopedia offered to the model in
// the first second of a religious turn, beside the fatwa-store prefetch, and a cited row's reader
// card naming the encyclopedia and its volume -- and nothing at all when the switch is off.
//
// THE OWNER'S ASK, 24 September 2026 (sources order, item 4): wire the encyclopedia into the live
// brain, with a card naming the encyclopedia, its volume and its page where they exist. The page
// exists on none of the 3,045 records, so the card is «الموسوعة الفقهية الكويتية · جN» and no
// more; the article is not named (the owner's ruling on the footer, which stays).
//
// WHAT THIS PINS:
//   A  api/ask.js reads ENCYC_V1 once, hands `encycPrefetch` down only for 'on' + an adult band,
//      and calls the card picker only for 'on' -- both expressions are cut out of the source and
//      evaluated, not re-typed;
//   B  the loop-side key is the fatwa offer's own (DEEN + STORED_FIQH), and the three numbers;
//   C  COLD, in a fresh process: the first provider call leaves inside the deadline and no single
//      stall of the event loop takes up half of that wait (the index build yields);
//   D  WARM, the real loop driven with a stubbed provider and stubbed services: OFF adds nothing
//      and the [stored-injection] line keeps its four keys; ON adds at most three rows with their
//      volume, never an empty-passage stub, after the fatwa and library rows, in the shape
//      search_sources itself produces; a worldly or hadith turn gets nothing; a slow index lets
//      the turn go on at the deadline and its late result never reaches the table;
//   E  the card: the book chip, «<publisher> · ج<part>», the passage as the matn, no page, no
//      article name; no volume / no passage / no switch -> no card; the footer still rides;
//   F  seven mutants killed.
//
// Usage: node guards/encyc-brain-guard.cjs
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const REPO = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8').replace(/\r\n/g, '\n');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
// Silences the loop's own logging, and keeps the one line this gate reads.
async function captured(fn) {
  const saved = { log: console.log, warn: console.warn, error: console.error };
  const lines = [];
  console.log = (...args) => { lines.push(args); };
  console.warn = () => {}; console.error = () => {};
  try { return { value: await fn(), lines }; } finally { Object.assign(console, saved); }
}

// A question the index answers (the correct article, F01173 · ج15, ranks second), and one whose
// top six hold an empty-passage stub (F01730) in the first three -- the stub filter's fixture.
const QUERY_HIT = 'حكم الجمع بين الصلاتين لغير المطر';
const QUERY_STUB = 'شراء الذهب ببطاقة الائتمان';
const LIB_ORIGIN = 'https://lib.ezik.app';
const BOOK_TITLE = 'كتاب الحارس الموسوعي';   // a title no real book carries
const ATOM_TEXT = 'نص ذرة الحارس للترتيب بين الصفوف.';
const libHit = () => ({
  atom_id: 'FC-999998:0001:001', subject_id: 'FC-999998', book_title: BOOK_TITLE, author: 'مؤلف الحارس',
  heading_path: ['باب الحارس'], heading_kind: 'chapter', volume: 2, page_start: 17, page_end: 17,
  page_citable: true, numbering: 'print', hadith_no: null, matn_spans: [], matn_chars: 0,
  text: ATOM_TEXT, truncated: false, score: 12.5,
});
const jsonResponse = (url, obj, { status = 200 } = {}) => ({
  ok: status >= 200 && status < 300, status, url: String(url),
  headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
  json: async () => obj, text: async () => JSON.stringify(obj),
});

// The two stubs, in the house style: the provider on globalThis.fetch, the services on fetchImpl.
async function drive(loopModule, question, flags = {}, { fatwaDelayMs = 60 } = {}) {
  const t0 = Date.now();
  const requests = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    requests.push({ at: Date.now() - t0, body: JSON.parse(init.body) });
    return jsonResponse(url, {
      content: [{ type: 'text', text: 'جواب الحارس.' }],
      stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 },
    });
  };
  const fetchImpl = async (url) => {
    const u = String(url);
    if (u.startsWith(LIB_ORIGIN)) return jsonResponse(u, { hits: [libHit()], took_ms: 1, refused: false });
    await new Promise((r) => setTimeout(r, fatwaDelayMs));
    return jsonResponse(u, {});
  };
  let run;
  try {
    run = await captured(() => loopModule.runFreeBrainTurn(Object.assign({
      messages: [{ role: 'user', content: question }],
      system: 'system', model: 'model', maxTokens: 512, effort: 'high', band: 'adult', mode: 'chat',
      lexicalRoute: 'DEEN', storedRuntime: 'STORED_FIQH',
      providerUrl: 'https://provider.invalid/v1/messages', headers: {}, env: {}, fetchImpl,
    }, flags)));
  } finally { globalThis.fetch = real; }
  const out = run.value;
  const first = requests[0] || null;
  const lastUser = first ? [...(first.body.messages || [])].reverse().find((m) => m.role === 'user') : null;
  const blocks = lastUser ? (Array.isArray(lastUser.content) ? lastUser.content : [{ type: 'text', text: lastUser.content }]) : [];
  const logged = run.lines.filter((a) => a[0] === '[stored-injection]').map((a) => { try { return JSON.parse(a[1]); } catch { return null; } });
  return {
    out,
    evidence: out && Array.isArray(out.evidence) ? out.evidence : [],
    encRows: (out && Array.isArray(out.evidence) ? out.evidence : []).filter((row) => row.kind === 'encyclopedia'),
    appended: blocks.slice(1).map((b) => String(b.text || '')).join('\n'),
    firstProviderAt: first ? first.at : null,
    logged: logged.length === 1 ? logged[0] : null,
    elapsedMs: Date.now() - t0,
  };
}

async function mutantModule(temp, rel, name, mutate, probe) {
  const lf = read(rel);
  const changed = mutate(lf);
  if (changed === lf) throw new Error('mutation seam moved: ' + name + ' in ' + rel);
  const sourceDir = path.dirname(path.join(REPO, rel));
  const resolved = changed.replace(/(\bfrom\s*')(\.\.?\/[^']+)(')/g,
    (all, head, spec, tail) => head + pathToFileURL(path.resolve(sourceDir, spec)).href + tail);
  const dir = path.join(temp, name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, path.basename(rel));
  fs.writeFileSync(file, resolved, 'utf8');
  const written = fs.readFileSync(file, 'utf8');
  if (written.indexOf(probe) === -1 || lf.indexOf(probe) !== -1) {
    throw new Error('mutant not on disk (or its probe is not distinctive): ' + name);
  }
  return pathToFileURL(file).href + '?v=' + Date.now() + '-' + name;
}

// ---- C, run in a FRESH process so the index is really cold -----------------------------------
// The child drives one ON turn and reports when the first provider call left and the longest
// stall a 5 ms heartbeat saw before it. A synchronous index build is one stall as long as the
// wait itself; the yielding build's longest stall is JSON.parse.
async function coldChild(loopUrl) {
  const loop = await import(loopUrl);
  const beats = [];
  const beat = setInterval(() => { beats.push(Date.now()); }, 5);
  await new Promise((r) => setTimeout(r, 30));
  const t0 = Date.now();
  const d = await drive(loop, QUERY_HIT, { encycPrefetch: true });
  clearInterval(beat);
  // The longest gap between two beats from the drive's start up to (and across) the moment the
  // first provider call left -- the wait this check is about, and nothing after it.
  const cut = t0 + (d.firstProviderAt === null ? 0 : d.firstProviderAt);
  let stall = 0, prev = t0;
  for (const at of beats) {
    if (at < t0) continue;
    stall = Math.max(stall, at - prev);
    prev = at;
    if (at > cut) break;
  }
  process.stdout.write('\n' + JSON.stringify({
    firstProviderAt: d.firstProviderAt, stallMs: stall, rows: d.encRows.length,
    reason: d.logged ? d.logged.encycReason : null,
  }) + '\n');
  process.exit(0);
}
function runCold(loopUrl) {
  const r = spawnSync(process.execPath, [__filename, '--cold-child', loopUrl], { cwd: REPO, encoding: 'utf8', timeout: 90000 });
  const line = String(r.stdout || '').trim().split('\n').pop();
  try { return JSON.parse(line); } catch { return { error: String(r.stderr || r.stdout || '').slice(0, 400) }; }
}

async function main() {
  console.log('\n=== encyc-brain -- the Kuwaiti encyclopedia in the first second, and its card ===');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ezik-encyc-brain-'));
  const askSrc = read('api/ask.js');
  const loopSrc = read('lib/free-brain/loop.js');
  const toolsSrc = read('lib/free-brain/tools.js');
  const encSrc = read('lib/encyclopedia.js');
  const loop = await esm('lib/free-brain/loop.js');
  const tools = await esm('lib/free-brain/tools.js');
  const E = await esm('lib/encyclopedia.js');
  const section = async (label, fn) => {
    try { await fn(); } catch (e) { ok(label + ' ran to the end', false, String(e && e.stack || e).slice(0, 400)); }
  };
  try {
    // ---- A. the switch, cut out of api/ask.js and evaluated ------------------------------------
    await section('A', async () => {
      const reads = (askSrc.match(/process\.env\.ENCYC_V1/g) || []).length;
      const libRead = askSrc.indexOf("const libMujazValue = String(process.env.LIB_MUJAZ_V1 || '').trim().toLowerCase();");
      const encRead = askSrc.indexOf("const encycValue = String(process.env.ENCYC_V1 || '').trim().toLowerCase();");
      ok('A1  ENCYC_V1 is read in api/ask.js exactly once, beside LIB_MUJAZ_V1, and in no lib module',
        reads === 1 && libRead !== -1 && encRead > libRead && encRead - libRead < 1500
        && !/env(\.|\[\s*['"])ENCYC_V1/.test(loopSrc) && !/process\.env/.test(toolsSrc) && !/process\.env/.test(encSrc),
        JSON.stringify({ reads, libRead, encRead }));
      const handExpr = (/\n\s*encycPrefetch: ([^\n]+),\n/.exec(askSrc) || [])[1] || '';
      ok('A2  the hand-down expression was found whole', handExpr !== '', handExpr);
      const handsDown = (v, band) => { try { return new Function('encycValue', 'band', 'return (' + handExpr + ');')(v, band); } catch { return 'threw'; } };
      ok('A3  handed down only for: ENCYC_V1 on + an adult band (every depth)',
        handsDown('on', 'adult') === true
        && handsDown('', 'adult') === false && handsDown('off', 'adult') === false
        && handsDown('true', 'adult') === false && handsDown('1', 'adult') === false
        && handsDown('on', 'minor') === false && handsDown('on', 'child') === false
        && handsDown('on', 'teen') === false && handsDown('on', '') === false,
        handExpr);
      const cardExpr = (/const encycCards = ([^\n]+)\n\s*\? registerOwnedCards\(pickEncyclopediaCards\(out\.cited, MAX_SOURCES, buildBookTag\)\) : \[\];/.exec(askSrc) || [])[1] || '';
      const cardsOn = (v) => { try { return new Function('encycValue', 'return (' + cardExpr + ');')(v); } catch { return 'threw'; } };
      ok('A4  the card picker is called only with the switch on, through buildBookTag, and its cards ride last',
        cardExpr !== '' && cardsOn('on') === true && cardsOn('') === false && cardsOn('off') === false
        && (askSrc.match(/pickEncyclopediaCards\(/g) || []).length === 1
        && askSrc.includes('finalizerContext.readerCards = [...cards, ...bookCards, ...encycCards];'),
        cardExpr);
      ok('A5  what cardorcontext and noemptyanswer seal is untouched: no retrieveEncyclopedia call and no lazy'
        + ' encyclopedia import in api/ask.js, and the footer line stands',
        !/retrieveEncyclopedia\s*\(/.test(askSrc) && !askSrc.includes("import('../lib/encyclopedia.js')")
        && askSrc.includes('finalizerContext.readerSuffix = encyclopediaTail(out.cited);'));
    });

    // ---- B. the loop-side key and the three numbers --------------------------------------------
    await section('B', async () => {
      const applies = loop.encycPrefetchApplies;
      ok('B1  encycPrefetchApplies: true + DEEN + STORED_FIQH',
        typeof applies === 'function' && applies(true, 'STORED_FIQH', 'DEEN') === true);
      ok('B2  ...and nothing for false, a truthy non-boolean, a worldly route, a hadith or general runtime',
        applies(false, 'STORED_FIQH', 'DEEN') === false && applies('on', 'STORED_FIQH', 'DEEN') === false
        && applies(1, 'STORED_FIQH', 'DEEN') === false && applies(true, 'STORED_FIQH', 'GEN') === false
        && applies(true, 'HADITH', 'DEEN') === false && applies(true, 'GENERAL', 'DEEN') === false);
      ok('B3  the numbers: ENCYC_MAX_ROWS 3, ENCYC_SEARCH_LIMIT 6, ENCYC_TIMEOUT_MS 1500',
        loop.ENCYC_MAX_ROWS === 3 && loop.ENCYC_SEARCH_LIMIT === 6 && loop.ENCYC_TIMEOUT_MS === 1500);
      ok('B4  the warm-up is exported by lib/encyclopedia.js and the loop starts it only when the offer applies',
        typeof E.warmEncyclopedia === 'function' && /\n {2}if \(encycOn\) warmEncyclopedia\(\);\n/.test(loopSrc));
    });

    // ---- C. cold, in a fresh process ------------------------------------------------------------
    const TIMEOUT = loop.ENCYC_TIMEOUT_MS || 1500;
    await section('C', async () => {
      const cold = runCold(pathToFileURL(path.join(REPO, 'lib/free-brain/loop.js')).href);
      console.log('        cold: ' + JSON.stringify(cold));
      ok('C1  COLD index: the first provider call leaves inside the deadline (< ENCYC_TIMEOUT_MS + 700 ms)',
        typeof cold.firstProviderAt === 'number' && cold.firstProviderAt < TIMEOUT + 700, JSON.stringify(cold));
      ok('C2  COLD index: no single stall of the event loop takes half of that wait -- the build yields',
        typeof cold.stallMs === 'number' && cold.firstProviderAt > 0 && cold.stallMs < cold.firstProviderAt * 0.5,
        JSON.stringify(cold));
      ok('C3  COLD index: the offer applied and says what happened (injected, or timeout at the deadline)',
        cold.reason === 'injected' || cold.reason === 'timeout', JSON.stringify(cold));
    });

    // From here the index is warm in THIS process (the plain search builds it on a tree without
    // the warm-up, so the sections below still run and report).
    if (typeof E.warmEncyclopedia === 'function') await E.warmEncyclopedia();
    else await E.searchStoredCorpus(QUERY_HIT, { limit: 1 });
    const hitTop = await E.searchStoredCorpus(QUERY_HIT, { limit: 6 });
    const stubTop = await E.searchStoredCorpus(QUERY_STUB, { limit: 6 });
    const recordById = new Map([...hitTop.records, ...stubTop.records].map((r) => [r.id, r]));
    const stubIds = stubTop.records.filter((r) => r.snippet.trim() === '').map((r) => r.id);

    // ---- D. the real loop, warm ------------------------------------------------------------------
    let onRows = [];
    await section('D', async () => {
      const off = await drive(loop, QUERY_HIT, {});
      ok('D1  OFF (nothing handed down): no encyclopedia row, and the [stored-injection] line keeps exactly its four keys',
        off.encRows.length === 0 && off.logged
        && JSON.stringify(Object.keys(off.logged)) === JSON.stringify(['fired', 'rows', 'cited', 'reason'])
        && !off.appended.includes('[['),
        JSON.stringify({ rows: off.encRows.length, logged: off.logged }));
      const offStr = await drive(loop, QUERY_HIT, { encycPrefetch: 'on' });
      ok('D2  a truthy non-boolean is not the switch: no row, four keys', offStr.encRows.length === 0
        && offStr.logged && Object.keys(offStr.logged).length === 4);

      const on = await drive(loop, QUERY_HIT, { encycPrefetch: true });
      onRows = on.encRows;
      console.log('        warm ON rows: ' + JSON.stringify(on.encRows.map((r) => r.recordId + ':' + r.part)) + ' firstProviderAt=' + on.firstProviderAt + ' (OFF ' + off.firstProviderAt + ')');
      ok('D3  ON: one to three encyclopedia rows, each with its volume (1..45), its record id and a passage',
        on.encRows.length >= 1 && on.encRows.length <= 3
        && on.encRows.every((r) => Number.isInteger(r.part) && r.part >= 1 && r.part <= 45
          && /^F\d{5}$/.test(r.recordId) && typeof r.text === 'string' && r.text.trim() !== ''),
        JSON.stringify(on.encRows.map((r) => ({ id: r.recordId, part: r.part, text: (r.text || '').length }))));
      ok('D4  ON: each row is exactly the row search_sources would build from the same record (tools.encyclopediaRow)',
        on.encRows.length > 0 && on.encRows.every((r) => {
          const rec = recordById.get(r.recordId);
          if (!rec) return false;
          const { ref, retrievedAt, ...shape } = r;
          return JSON.stringify(shape) === JSON.stringify(tools.encyclopediaRow(rec));
        }) && toolsSrc.includes('added.push(ctx.table.add(encyclopediaRow(record)));'));
      ok('D5  ON: the rows reach the model on the reader\'s own turn, citable by marker, with the publisher line',
        on.encRows.length > 0
        && on.encRows.every((r) => on.appended.includes('[[' + r.ref + ']] ' + r.title) && on.appended.includes(r.text.slice(0, 80)))
        && on.encRows.every((r) => on.appended.includes(r.publisher)));
      ok('D6  ON: the [stored-injection] line gains encycFired/encycRows/encycReason, and says injected',
        on.logged && on.logged.encycFired === true && on.logged.encycRows === on.encRows.length
        && on.logged.encycReason === 'injected'
        && JSON.stringify(Object.keys(on.logged)) === JSON.stringify(['fired', 'rows', 'cited', 'reason', 'encycFired', 'encycRows', 'encycReason']),
        JSON.stringify(on.logged));

      const stub = await drive(loop, QUERY_STUB, { encycPrefetch: true });
      const stubInTop3 = stubTop.records.slice(0, 3).some((r) => r.snippet.trim() === '');
      ok('D7  ON: an empty-passage stub never becomes a row (fixture: a stub ranks in this query\'s first three)',
        stubInTop3 && stub.encRows.length === 3 && stub.encRows.every((r) => !stubIds.includes(r.recordId) && r.text.trim() !== ''),
        JSON.stringify({ stubIds, rows: stub.encRows.map((r) => r.recordId) }));

      const both = await drive(loop, QUERY_HIT, { encycPrefetch: true, libPrefetch: { flagValue: 'on', token: 'tk-fix-9' } });
      const libRow = both.evidence.find((r) => r.kind === 'lib_book');
      ok('D8  ON beside the library prefetch: the encyclopedia rows come AFTER the library row, in the table and in the text',
        !!libRow && both.encRows.length >= 1 && both.encRows.every((r) => r.ref > libRow.ref)
        && both.appended.indexOf(BOOK_TITLE) !== -1 && both.appended.indexOf(BOOK_TITLE) < both.appended.indexOf(both.encRows[0].title),
        JSON.stringify({ lib: libRow && libRow.ref, enc: both.encRows.map((r) => r.ref) }));

      const gen = await drive(loop, QUERY_HIT, { encycPrefetch: true, lexicalRoute: 'GEN', storedRuntime: 'GENERAL' });
      ok('D9  ON but a worldly question: no row, and no encyc keys on the line', gen.encRows.length === 0
        && gen.logged && !('encycFired' in gen.logged));
      const hadith = await drive(loop, QUERY_HIT, { encycPrefetch: true, storedRuntime: 'HADITH' });
      ok('D10 ON but a hadith-runtime question: no row, and no encyc keys on the line', hadith.encRows.length === 0
        && hadith.logged && !('encycFired' in hadith.logged));

      // The slow index: the same loop with the search held back 5 s at its call site.
      const slowUrl = await mutantModule(temp, 'lib/free-brain/loop.js', 'slow-index',
        (s) => s.replace('const search = searchStoredCorpus(text, { limit: ENCYC_SEARCH_LIMIT })',
          'const search = new Promise((r) => setTimeout(r, 5000)).then(() => searchStoredCorpus(text, { limit: ENCYC_SEARCH_LIMIT }))'),
        'new Promise((r) => setTimeout(r, 5000)).then(() => searchStoredCorpus(');
      const slow = await drive(await import(slowUrl), QUERY_HIT, { encycPrefetch: true });
      ok('D11 ON but the index takes 5 s: the turn goes on at the deadline, without rows, and says timeout',
        slow.firstProviderAt !== null && slow.firstProviderAt >= TIMEOUT - 100 && slow.firstProviderAt < TIMEOUT + 700
        && slow.encRows.length === 0 && slow.logged && slow.logged.encycReason === 'timeout',
        JSON.stringify({ firstProviderAt: slow.firstProviderAt, rows: slow.encRows.length, logged: slow.logged }));
      await new Promise((r) => setTimeout(r, Math.max(0, 5400 - slow.elapsedMs)));
      ok('D12 ...and the late result never reaches the table after the turn went on',
        slow.evidence.filter((r) => r.kind === 'encyclopedia').length === 0);
    });

    // ---- E. the card ------------------------------------------------------------------------
    const ask = await captured(() => esm('api/ask.js')).then((r) => r.value);
    const labelOf = (tag) => String(tag).replace(/ matn="[^"]*"/, '').replace(/ cut="1"/, '');
    const matnOf = (tag) => { const m = / matn="([^"]+)"/.exec(String(tag)); return m ? Buffer.from(m[1], 'base64').toString('utf8') : ''; };
    await section('E', async () => {
      const pick = loop.pickEncyclopediaCards;
      const rows = onRows.length ? onRows : [];
      const cards = typeof pick === 'function' ? pick(rows, 3, ask.buildBookTag) : [];
      const first = cards[0] ? String(cards[0].tag) : '';
      const firstRow = rows[0] || {};
      const term = (recordById.get(firstRow.recordId) || {}).term || '';
      console.log('        card label: ' + labelOf(first));
      ok('E1  a cited row gets the book chip «<publisher> · ج<part>»: no author, no ref, no link',
        cards.length === rows.length && rows.length > 0
        && labelOf(first) === '<book>' + firstRow.publisher + ' · ج' + firstRow.part + '</book>'
        && first.length > 0 && !/ author=| ref=| url=| site=/.test(first),
        labelOf(first));
      ok('E2  ...its passage is the row\'s own text, letter for letter',
        cards.length > 0 && cards.every((c, i) => matnOf(c.tag) === rows[i].text));
      ok('E3  ...and its label names no article and no page',
        term !== '' && cards.every((c) => !labelOf(c.tag).includes(term) && !/ص\s*\d/.test(labelOf(c.tag))),
        JSON.stringify({ term }));
      const base = rows[0] ? { ...rows[0] } : {};
      const other = rows[1] ? { ...rows[1] } : { ...base, recordId: 'F99999', ref: 99, text: '9 ' + base.text };
      ok('E4  nothing is derived: no volume, no publisher, no passage, or not the encyclopedia -> no card',
        typeof pick === 'function'
        && pick([{ ...base, part: null }], 3, ask.buildBookTag).length === 0
        && pick([{ ...base, publisher: '' }], 3, ask.buildBookTag).length === 0
        && pick([{ ...base, text: '' }], 3, ask.buildBookTag).length === 0
        && pick([{ ...base, kind: 'fatwa' }], 3, ask.buildBookTag).length === 0);
      ok('E5  one card per record, and the ceiling holds',
        typeof pick === 'function'
        && pick([base, { ...base, ref: 50 }], 3, ask.buildBookTag).length === 1
        && pick([base, other, { ...base, recordId: 'F99997', ref: 97, text: '7 ' + base.text }, { ...base, recordId: 'F99996', ref: 96, text: '6 ' + base.text }], 3, ask.buildBookTag).length === 3);
      ok('E6  a cut passage says so on the card (cut="1"), an uncut one does not',
        typeof pick === 'function'
        && / cut="1"/.test(String((pick([{ ...base, matnCut: true }], 3, ask.buildBookTag)[0] || {}).tag))
        && !/ cut="1"/.test(String((pick([{ ...base, text: 'نص قصير.', matnCut: false }], 3, ask.buildBookTag)[0] || {}).tag)));
      ok('E7  the footer still rides beside the card', rows.length > 0
        && loop.encyclopediaTail(rows) === '\n\nالمصدر: ' + rows[0].publisher + '.');
    });

    // ---- F. mutants ----------------------------------------------------------------------------
    await section('F', async () => {
      const LOOP = 'lib/free-brain/loop.js';
      const deadlineUrl = await mutantModule(temp, LOOP, 'deadline-dropped', (s) => s
        .replace('const search = searchStoredCorpus(text, { limit: ENCYC_SEARCH_LIMIT })',
          'const search = new Promise((r) => setTimeout(r, 5000)).then(() => searchStoredCorpus(text, { limit: ENCYC_SEARCH_LIMIT }))')
        .replace('return Promise.race([search, deadline]).finally(() => clearTimeout(timer));',
          'return search.finally(() => clearTimeout(timer));'),
      'return search.finally(() => clearTimeout(timer));');
      const m1 = await drive(await import(deadlineUrl), QUERY_HIT, { encycPrefetch: true });
      ok('F1  MUTANT KILLED: without the deadline a 5 s index holds the first provider call past it',
        m1.firstProviderAt !== null && m1.firstProviderAt >= TIMEOUT + 700, JSON.stringify({ firstProviderAt: m1.firstProviderAt }));

      const keyUrl = await mutantModule(temp, LOOP, 'religious-key-dropped', (s) => s.replace(
        'return encycPrefetch === true && storedInjectionApplies(storedRuntime, lexicalRoute);',
        'return encycPrefetch === true;'), 'return encycPrefetch === true;');
      const m2 = await import(keyUrl);
      ok('F2  MUTANT KILLED: dropping the religious key says yes to a worldly and a hadith turn',
        m2.encycPrefetchApplies(true, 'GENERAL', 'GEN') === true || m2.encycPrefetchApplies(true, 'HADITH', 'DEEN') === true);

      const stubUrl = await mutantModule(temp, LOOP, 'stub-filter-dropped', (s) => s.replace(
        ".filter((record) => record && String(record.snippet || '').trim() !== '')", '.filter((record) => record)'),
      '.filter((record) => record)\n');
      const m3 = await drive(await import(stubUrl), QUERY_STUB, { encycPrefetch: true });
      ok('F3  MUTANT KILLED: without the stub filter an empty-passage headword becomes a row',
        m3.encRows.some((r) => stubIds.includes(r.recordId) || String(r.text || '').trim() === ''),
        JSON.stringify(m3.encRows.map((r) => r.recordId)));

      const capUrl = await mutantModule(temp, LOOP, 'ceiling-dropped', (s) => s.replace(
        "    .slice(0, ENCYC_MAX_ROWS);\n  return records.map", ";\n  return records.map"),
      "!== '')\n;\n  return records.map");
      const m4 = await drive(await import(capUrl), QUERY_HIT, { encycPrefetch: true });
      ok('F4  MUTANT KILLED: without the ceiling the offer carries more than three rows', m4.encRows.length > 3,
        String(m4.encRows.length));

      const termUrl = await mutantModule(temp, LOOP, 'card-names-term', (s) => s.replace(
        "bookTitle: [name, renderBookLocator({ volume: part })].join(' · '),",
        "bookTitle: [row.title, renderBookLocator({ volume: part })].join(' · '),"),
      "bookTitle: [row.title, renderBookLocator");
      const m5 = await import(termUrl);
      const term = (recordById.get((onRows[0] || {}).recordId) || {}).term || '';
      const m5cards = onRows.length ? m5.pickEncyclopediaCards(onRows, 3, ask.buildBookTag) : [];
      ok('F5  MUTANT KILLED: a card that names the article is caught by E3',
        term !== '' && m5cards.some((c) => labelOf(c.tag).includes(term)));

      const partUrl = await mutantModule(temp, LOOP, 'card-without-volume', (s) => s.replace(
        "bookTitle: [name, renderBookLocator({ volume: part })].join(' · '),", 'bookTitle: name,'), 'bookTitle: name,');
      const m6 = await import(partUrl);
      const m6cards = onRows.length ? m6.pickEncyclopediaCards(onRows, 3, ask.buildBookTag) : [];
      ok('F6  MUTANT KILLED: a card that drops the volume is caught by E1',
        m6cards.length > 0 && labelOf(m6cards[0].tag) !== '<book>' + onRows[0].publisher + ' · ج' + onRows[0].part + '</book>');

      const warmUrl = await mutantModule(temp, LOOP, 'warm-up-dropped', (s) => s.replace(
        '  if (encycOn) warmEncyclopedia();\n', '  if (encycOn) void 0;\n'), '  if (encycOn) void 0;\n');
      const m7 = runCold(warmUrl);
      console.log('        cold, warm-up dropped: ' + JSON.stringify(m7));
      ok('F7  MUTANT KILLED: without the yielding warm-up the cold build is one stall as long as the wait (C2)',
        typeof m7.stallMs === 'number' && !(m7.stallMs < m7.firstProviderAt * 0.5), JSON.stringify(m7));
    });
  } finally {
    try { fs.rmSync(temp, { recursive: true, force: true }); } catch { /* temp only */ }
  }
  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? '  FAIL' : '  PASS') + ' ===');
  process.exit(failures ? 1 : 0);
}

if (process.argv[2] === '--cold-child') {
  coldChild(process.argv[3]).catch((e) => { process.stdout.write('\n' + JSON.stringify({ error: String(e && e.message || e) }) + '\n'); process.exit(1); });
} else {
  main().catch((e) => { console.error(e); process.exit(1); });
}
