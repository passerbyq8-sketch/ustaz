// guards/lib-mujaz-guard.cjs -- LIB_MUJAZ_V1: one library call for the brief turn, in parallel with
// the fatwa-store prefetch, for the religious question only, and nothing when the switch is off.
//
// THE OWNER'S ASK, 24 September 2026 (sources order, decision 4): «نبي نخلي المكتبة ايضا شغاله في
// الموجز» -- the books should also work in the brief depth, with ONE call, for the religious
// question alone, so the fast depth does not slow down. The brief depth is never OFFERED the
// library tool (the depth rule is untouched); instead lib/free-brain/loop.js makes the call itself
// in the same tick as the fatwa-store prefetch and hands the rows to the model as candidate
// evidence, through runTool('search_library') so the row shape, the locator, the snippet ceiling
// and the spend row are the ones a model-requested call produces.
//
// WHAT THIS PINS:
//   * OFF by default: with no `libPrefetch` handed down, the loop makes no library request and the
//     turn is what it was;
//   * ON: exactly one library request, asking for LIB_MUJAZ_MAX_ROWS rows, started BEFORE the
//     fatwa prefetch resolves (parallel, never serial), rows appended to the reader's own turn as
//     the fatwa rows are, and the tool still withheld from the offer;
//   * the worldly route and the hadith runtime get nothing new; a turn that is OFFERED the tool
//     (deep, scholar) is not also prefetched;
//   * api/ask.js hands the prefetch down only for an adult brief turn with LIB_MUJAZ_V1 === 'on'
//     and the library's own two switches on -- the expression is cut out of the source and
//     evaluated, not re-typed.
//
// Usage: node guards/lib-mujaz-guard.cjs
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
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
async function quiet(fn) {
  const saved = { log: console.log, warn: console.warn, error: console.error };
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return await fn(); } finally { Object.assign(console, saved); }
}

const LIB_ORIGIN = 'https://lib.ezik.app';
const BOOK_TITLE = 'كتاب الغواصين';   // a title no real book carries, so a match is this stub's
const ATOM_TEXT = 'قال المؤلف رحمه الله: هذه مسألة الغواصين، وفيها قولان لأهل العلم.';
const libHit = () => ({
  atom_id: 'FC-999999:0001:001', subject_id: 'FC-999999', book_title: BOOK_TITLE, author: 'مؤلف الاختبار',
  heading_path: ['باب الغواصين'], heading_kind: 'chapter', volume: 2, page_start: 17, page_end: 17,
  page_citable: true, numbering: 'print', hadith_no: null, matn_spans: [], matn_chars: 0,
  text: ATOM_TEXT, truncated: false, score: 12.5,
});
const jsonResponse = (url, obj, { status = 200 } = {}) => ({
  ok: status >= 200 && status < 300, status, url: String(url),
  headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
  json: async () => obj, text: async () => JSON.stringify(obj),
});

// The two stubs: the provider on globalThis.fetch, the services on the injected fetchImpl.
function providerStub() {
  const requests = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    requests.push(body);
    return jsonResponse(url, {
      content: [{ type: 'text', text: 'جواب الاختبار.' }],
      stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 },
    });
  };
  return { requests, restore() { globalThis.fetch = real; } };
}
function servicesStub({ libDelayMs = 0 } = {}) {
  const log = [];        // { kind: 'lib'|'other', at, body }
  let fatwaResolvedAt = null;
  const t0 = Date.now();
  const fetchImpl = async (url, init) => {
    const u = String(url);
    if (u.startsWith(LIB_ORIGIN)) {
      let body = null; try { body = JSON.parse(init && init.body || 'null'); } catch { body = null; }
      log.push({ kind: 'lib', at: Date.now() - t0, body });
      if (libDelayMs > 0) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, libDelayMs);
          const sig = init && init.signal;
          if (sig) sig.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')); }, { once: true });
        });
      }
      return jsonResponse(u, { hits: [libHit()], took_ms: 1, refused: false });
    }
    // Every other service (the fatwa store and anything else) answers slowly and emptily, so a
    // library call that waited for it is visible as a timestamp AFTER fatwaResolvedAt.
    log.push({ kind: 'other', at: Date.now() - t0, url: u });
    await new Promise((r) => setTimeout(r, 60));
    fatwaResolvedAt = Date.now() - t0;
    return jsonResponse(u, {});
  };
  return { log, fetchImpl, resolvedAt: () => fatwaResolvedAt };
}

const QUESTION = 'ما حكم الجمع بين الصلاتين في السفر؟';
const TURN = {
  messages: [{ role: 'user', content: QUESTION }],
  system: 'system', model: 'model', maxTokens: 512, effort: 'high', band: 'adult', mode: 'chat',
  lexicalRoute: 'DEEN', storedRuntime: 'STORED_FIQH',
  providerUrl: 'https://provider.invalid/v1/messages', headers: {},
  env: {},
};
const PREFETCH = { flagValue: 'on', token: 'tk-fix-9' };

async function drive(loopModule, flags, stubOptions = {}) {
  const provider = providerStub();
  const services = servicesStub(stubOptions);
  const startedAt = Date.now();
  try {
    await quiet(() => loopModule.runFreeBrainTurn(Object.assign({}, TURN, { fetchImpl: services.fetchImpl }, flags)));
  } finally { provider.restore(); }
  const libCalls = services.log.filter((e) => e.kind === 'lib');
  const first = provider.requests[0] || null;
  const tools = first ? (first.tools || []).map((t) => t.name) : [];
  const lastUser = first ? [...(first.messages || [])].reverse().find((m) => m.role === 'user') : null;
  const blocks = lastUser ? (Array.isArray(lastUser.content) ? lastUser.content : [{ type: 'text', text: lastUser.content }]) : [];
  const appended = blocks.slice(1).map((b) => String(b.text || '')).join('\n');
  return { libCalls, tools, appended, providerCalls: provider.requests.length, fatwaResolvedAt: services.resolvedAt(), elapsedMs: Date.now() - startedAt };
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
  return import(pathToFileURL(file).href + '?v=' + Date.now() + '-' + name);
}

(async () => {
  console.log('\n=== lib-mujaz -- one library call for the brief turn, in parallel, religious only ===');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ezik-lib-mujaz-'));
  const askSrc = read('api/ask.js');
  const loopSrc = read('lib/free-brain/loop.js');
  const loop = await esm('lib/free-brain/loop.js');
  try {
    // ---- A. the switch, cut out of api/ask.js and evaluated --------------------------------
    const flagReads = (askSrc.match(/process\.env\.LIB_MUJAZ_V1/g) || []).length;
    ok('A1  LIB_MUJAZ_V1 is read in api/ask.js exactly once, beside the library switches, and nowhere else in lib/',
      flagReads === 1 && !/process.env.LIB_MUJAZ_V1|env.LIB_MUJAZ_V1/.test(loopSrc) && !/LIB_MUJAZ_V1/.test(read('lib/free-brain/tools.js')));
    const prefetchExpr = (/\n\s*libPrefetch: \(([^\n]+)\)\n\s*\? \{ flagValue: libFlagValue, token: libToken \} : null,/.exec(askSrc) || [])[1] || '';
    ok('A2  the hand-down expression was found whole', prefetchExpr !== '', prefetchExpr);
    const decide = (expr) => new Function('libMujazValue', 'libDepthEligible', 'band', 'libFlagValue', 'libToken', 'return (' + expr + ');');
    const handsDown = (v, deep, band, flag, token) => { try { return decide(prefetchExpr)(v, deep, band, flag, token); } catch { return 'threw'; } };
    ok('A3  handed down only for: on + brief + adult + SHAMELA_BRAIN on + token',
      handsDown('on', false, 'adult', 'on', 'tk') === true
      && handsDown('', false, 'adult', 'on', 'tk') === false
      && handsDown('off', false, 'adult', 'on', 'tk') === false
      && handsDown('on', true, 'adult', 'on', 'tk') === false
      && handsDown('on', false, 'child', 'on', 'tk') === false
      && handsDown('on', false, 'adult', 'off', 'tk') === false
      && handsDown('on', false, 'adult', 'on', '') === false);
    ok('A4  the depth rule itself is untouched: the tool offer still rides libDepthEligible && adult',
      /libEligible: libDepthEligible && band === 'adult',/.test(askSrc));

    // ---- B. the loop-side key ----------------------------------------------------------------
    const applies = loop.libPrefetchApplies;
    ok('B1  libPrefetchApplies: on + DEEN + STORED_FIQH + not offered',
      typeof applies === 'function' && applies(PREFETCH, 'STORED_FIQH', 'DEEN', false) === true);
    ok('B2  ...and nothing for null, off flag, empty token, GEN route, HADITH runtime, or an offered tool',
      applies(null, 'STORED_FIQH', 'DEEN', false) === false
      && applies({ flagValue: 'off', token: 'tk' }, 'STORED_FIQH', 'DEEN', false) === false
      && applies({ flagValue: 'on', token: '' }, 'STORED_FIQH', 'DEEN', false) === false
      && applies(PREFETCH, 'STORED_FIQH', 'GEN', false) === false
      && applies(PREFETCH, 'HADITH', 'DEEN', false) === false
      && applies(PREFETCH, 'STORED_FIQH', 'DEEN', true) === false);
    ok('B3  the ceiling is a named number the model would otherwise never be handed: LIB_MUJAZ_MAX_ROWS = 3',
      loop.LIB_MUJAZ_MAX_ROWS === 3);

    // ---- C. the real loop, driven --------------------------------------------------------
    const off = await drive(loop, { libPrefetch: null });
    ok('C1  OFF (no prefetch handed down): zero library requests, tool not offered, provider called',
      off.libCalls.length === 0 && !off.tools.includes('search_library') && off.providerCalls >= 1,
      JSON.stringify({ lib: off.libCalls.length, tools: off.tools, provider: off.providerCalls }));

    const on = await drive(loop, { libPrefetch: PREFETCH });
    ok('C2  ON: exactly one library request, asking for LIB_MUJAZ_MAX_ROWS rows',
      on.libCalls.length === 1 && on.libCalls[0].body && on.libCalls[0].body.limit === loop.LIB_MUJAZ_MAX_ROWS
      && on.libCalls[0].body.q === QUESTION,
      JSON.stringify(on.libCalls));
    ok('C3  ON: the tool is still withheld from the brief offer (the call is the loop\'s, not the model\'s)',
      on.tools.length > 0 && !on.tools.includes('search_library') && on.tools.includes('search_fatawa'), JSON.stringify(on.tools));
    ok('C4  ON: the library row reaches the model on the reader\'s own turn, with the book and its locator',
      on.appended.includes(BOOK_TITLE) && on.appended.includes(ATOM_TEXT) && /٢|2/.test(on.appended) && /١٧|17/.test(on.appended),
      on.appended.slice(0, 300));
    ok('C5  ON: the library request started BEFORE the fatwa prefetch resolved (parallel, not serial)',
      on.fatwaResolvedAt !== null && on.libCalls[0].at < on.fatwaResolvedAt,
      JSON.stringify({ libAt: on.libCalls[0] && on.libCalls[0].at, fatwaResolvedAt: on.fatwaResolvedAt }));

    const gen = await drive(loop, { libPrefetch: PREFETCH, lexicalRoute: 'GEN', storedRuntime: 'GENERAL' });
    ok('C6  ON but a worldly question: zero library requests', gen.libCalls.length === 0);
    const hadith = await drive(loop, { libPrefetch: PREFETCH, storedRuntime: 'HADITH' });
    ok('C7  ON but a hadith-runtime question: zero prefetch requests (the takhrij pass owns that road)', hadith.libCalls.length === 0);
    const deep = await drive(loop, { libPrefetch: PREFETCH, libEligible: true, libFlagValue: 'on', libToken: 'tk-fix-9' });
    ok('C8  ON and the tool is OFFERED (deep): no prefetch -- never both roads on one turn',
      deep.libCalls.length === 0 && deep.tools.includes('search_library'), JSON.stringify({ lib: deep.libCalls.length, tools: deep.tools }));
    const slow = await drive(loop, { libPrefetch: PREFETCH }, { libDelayMs: 6000 });
    ok('C10 ON but the library is slow: the turn goes on without it inside the deadline (LIB_MUJAZ_TIMEOUT_MS = 2500)',
      loop.LIB_MUJAZ_TIMEOUT_MS === 2500 && slow.libCalls.length === 1 && !slow.appended.includes(ATOM_TEXT) && slow.elapsedMs < 4500,
      JSON.stringify({ elapsedMs: slow.elapsedMs, appended: slow.appended.length }));
    const flagOff = await drive(loop, { libPrefetch: { flagValue: 'off', token: 'tk-fix-9' } });
    ok('C9  ON with SHAMELA_BRAIN off: zero library requests', flagOff.libCalls.length === 0);

    // ---- D. mutants of lib/free-brain/loop.js ------------------------------------------------
    const m1 = await mutantModule(temp, 'lib/free-brain/loop.js', 'offered-guard-dropped',
      (s) => s.replace('    && libOffered !== true\n', '    && true\n'), '    && true\n');
    const m1deep = await drive(m1, { libPrefetch: PREFETCH, libEligible: true, libFlagValue: 'on', libToken: 'tk-fix-9' });
    ok('D1  MUTANT KILLED: dropping the never-both rule prefetches on an offered turn', m1deep.libCalls.length !== 0);

    const m2 = await mutantModule(temp, 'lib/free-brain/loop.js', 'library-waits-for-fatwa',
      (s) => s.replace("        runTool('search_fatawa', { query }, ctx),\n        libMujaz\n", "        await runTool('search_fatawa', { query }, ctx),\n        libMujaz\n"),
      "        await runTool('search_fatawa', { query }, ctx),\n        libMujaz\n");
    const m2on = await drive(m2, { libPrefetch: PREFETCH });
    ok('D2  MUTANT KILLED: a library call that waits for the fatwa call is serial, and C5 sees it',
      m2on.libCalls.length === 1 && m2on.fatwaResolvedAt !== null && !(m2on.libCalls[0].at < m2on.fatwaResolvedAt),
      JSON.stringify({ libAt: m2on.libCalls[0] && m2on.libCalls[0].at, fatwaResolvedAt: m2on.fatwaResolvedAt }));

    const m3 = await mutantModule(temp, 'lib/free-brain/loop.js', 'ceiling-dropped',
      (s) => s.replace('resultCap: LIB_MUJAZ_MAX_ROWS, signal:', 'signal:'), 'libToken: libPrefetch.token, signal:');
    const m3on = await drive(m3, { libPrefetch: PREFETCH });
    ok('D3  MUTANT KILLED: without the ceiling the request asks for the tool\'s default, not 3',
      m3on.libCalls.length === 1 && m3on.libCalls[0].body.limit !== loop.LIB_MUJAZ_MAX_ROWS, JSON.stringify(m3on.libCalls[0] && m3on.libCalls[0].body));

    const m4 = await mutantModule(temp, 'lib/free-brain/loop.js', 'religious-key-dropped',
      (s) => s.replace('    && storedInjectionApplies(storedRuntime, lexicalRoute);\n}', '    && true;\n}'), '    && true;\n}');
    ok('D4  MUTANT KILLED: dropping the religious key makes the loop-side predicate say yes to a worldly route',
      m4.libPrefetchApplies(PREFETCH, 'GENERAL', 'GEN', false) === true);
  } finally {
    try { fs.rmSync(temp, { recursive: true, force: true }); } catch { /* temp only */ }
  }
  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? '  FAIL' : '  PASS') + ' ===');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
