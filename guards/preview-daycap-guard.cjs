// guards/preview-daycap-guard.cjs -- the per-IP DAY window is skipped on a preview deployment,
// and NOWHERE else; and the GLOBAL window is consulted by checkAskGlobal alone, never by
// checkAskLimit.
//
// THE MEASURED PROBLEM, 24 September 2026 (sources order, decision 5). A preview deployment is
// reachable only by signed-in members of the Vercel team, and its whole purpose is to be measured:
// a battery of a hundred questions from one address in one afternoon. Production and preview
// share the same Upstash store and the same `ask:day` prefix, so the night exam of 2026-09-24 saw
// 97 of 210 requests refused by the day window while measuring the previews (night report, D16).
//
// THE SECOND MEASURED PROBLEM, 5 November 2026 (BRAIN36 diagnosis, causes U1-C2 and U1-C3). The
// three ask windows sat in ONE Promise.all, so a request the minute window refused still charged
// the global day window of every reader (HARNESS-1 A2: GLOBAL_CHARGED=true), and a request the
// day cap refused afterwards had already charged it too. The global was a free kill switch: one
// address, 20,000 empty posts, and /api/ask was down for everyone until midnight UTC.
//
// THE RULES THIS PINS, in `lib/ratelimit.js`:
//   * checkAskLimit consults the per-IP MINUTE and per-IP DAY windows and NOTHING ELSE -- no
//     EVALSHA on `ask:all:day` leaves it, whether the pair admits or refuses;
//   * on a PREVIEW deployment (VERCEL_ENV === 'preview' AND VERCEL_URL non-empty, the same
//     reading as lib/free-brain/flag.js) the per-IP day window is not consulted at all;
//   * the per-IP MINUTE window is consulted in BOTH environments and still refuses on its own,
//     naming itself: { ok:false, window:'min' };
//   * production, and a process with no VERCEL_ENV at all, consult the pair exactly as before;
//   * VERCEL_ENV='preview' WITHOUT VERCEL_URL -- the fixture ten guards set to name a paid-search
//     budget -- does NOT switch the day window off;
//   * checkAskGlobal issues EXACTLY ONE EVALSHA, on `ask:all:day`, and names itself 'all'. It is
//     the only site that consults the global window, and api/ask.js calls it after the day cap.
//
// HOW IT IS PROVED: the real module is driven with one fake `globalThis.fetch` at the Upstash REST
// boundary (the client pipelines the per-IP pair into one POST; the global is its own POST). The
// stub records which window prefixes were asked and answers `[remaining, limit]` per command, so
// a refusal is a negative remaining on exactly the window under test. Every per-IP identifier is
// unique per case because the client caches a denied identifier until its window resets, and the
// global refusal row runs last for the same reason. Seven mutants of the source are then loaded
// from a temp copy and each must be caught by one of the drives.
//
// Usage: node guards/preview-daycap-guard.cjs
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..');
const RL_REL = 'lib/ratelimit.js';
const RL_ABS = path.join(REPO, RL_REL);
let failures = 0, checks = 0;

function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}

// ---- the fetch stub at the Upstash REST boundary --------------------------------------------
let asked = [];             // window prefixes seen since the last reset
let refuse = () => false;   // (prefix) => should this window refuse?
function installFetch() {
  globalThis.fetch = async (url, init) => {
    let cmds = [];
    try { cmds = JSON.parse(String(init && init.body || '[]')); } catch { cmds = []; }
    const single = cmds.length && !Array.isArray(cmds[0]);
    if (single) cmds = [cmds];
    const out = cmds.map((c) => {
      const key = String(c[3] || '');
      const prefix = key.startsWith('ask:all:day') ? 'ask:all:day' : key.startsWith('ask:day') ? 'ask:day' : key.startsWith('ask:min') ? 'ask:min' : key;
      asked.push(prefix);
      const limit = Number(c[6]) || 1;
      return { result: refuse(prefix) ? [-1, limit] : [limit - 1, limit] };
    });
    const body = single ? out[0] : out;
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => body, text: async () => JSON.stringify(body) };
  };
}

const ENV_KEYS = ['VERCEL_ENV', 'VERCEL_URL'];
function withEnv(env, fn) {
  const saved = {};
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  return Promise.resolve().then(fn).finally(() => {
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  });
}

let ipSeq = 0;
const ip = () => '10.0.' + Math.floor(ipSeq / 250) + '.' + (1 + (ipSeq++ % 250));
const PROD = { VERCEL_ENV: 'production', VERCEL_URL: 'ustaz-abc.vercel.app' };
const PREVIEW = { VERCEL_ENV: 'preview', VERCEL_URL: 'ustaz-xyz-preview.vercel.app' };
const FIXTURE = { VERCEL_ENV: 'preview' };
const NONE = {};

async function drive(mod, env, refuseFn) {
  asked = []; refuse = refuseFn || (() => false);
  const res = await withEnv(env, () => mod.checkAskLimit(ip()));
  const seen = Array.from(new Set(asked)).sort();
  return { ok: res.ok, window: res.window, seen, evals: asked.length };
}
async function driveGlobal(mod, refuseFn) {
  asked = []; refuse = refuseFn || (() => false);
  const res = typeof mod.checkAskGlobal === 'function' ? await mod.checkAskGlobal() : { ok: 'absent' };
  const seen = Array.from(new Set(asked)).sort();
  return { ok: res.ok, window: res.window, seen, evals: asked.length };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const PAIR = ['ask:day', 'ask:min'];
const NO_DAY = ['ask:min'];
const GLOBAL = ['ask:all:day'];

// The board every module (shipped or mutant) is driven across. Returns the list of row names
// that FAILED, so a mutant is "killed" when at least one row fails under it.
async function board(mod) {
  const bad = [];
  const row = async (name, env, refuseFn, expectOk, expectSeen, expectWindow) => {
    const r = await drive(mod, env, refuseFn);
    if (r.ok !== expectOk || !same(r.seen, expectSeen) || (expectWindow !== undefined && r.window !== expectWindow)) bad.push(name + ' -> ' + JSON.stringify(r));
  };
  await row('R1 production consults the per-IP pair and not the global',  PROD,    null,                      true,  PAIR);
  await row('R2 no VERCEL_ENV consults the per-IP pair and not the global', NONE,   null,                      true,  PAIR);
  await row('R3 preview deployment never asks the day window',           PREVIEW, null,                      true,  NO_DAY);
  await row('R4 preview fixture without VERCEL_URL keeps the day',       FIXTURE, null,                      true,  PAIR);
  await row('R5 preview: the minute window still refuses, naming itself', PREVIEW, (p) => p === 'ask:min',   false, NO_DAY, 'min');
  await row('R7 production: the day window still refuses, naming itself', PROD,   (p) => p === 'ask:day',    false, PAIR,   'day');
  await row('R8 preview: a day window that would refuse is not consulted', PREVIEW, (p) => p === 'ask:day',  true,  NO_DAY);
  await row('R9 fixture: the day window refuses as in production',       FIXTURE, (p) => p === 'ask:day',    false, PAIR,   'day');
  await row('R10 production: a refused minute window issues no global EVALSHA', PROD, (p) => p === 'ask:min', false, PAIR,  'min');
  await row('R6 preview: a global window that would refuse is never asked by checkAskLimit', PREVIEW, (p) => p === 'ask:all:day', true, NO_DAY);
  // The global window, by its own door. G2 LAST on purpose: the client caches a denied
  // identifier until its window resets, and the global window's identifier ('all') is the one
  // every call shares.
  const g1 = await driveGlobal(mod, null);
  if (g1.ok !== true || !same(g1.seen, GLOBAL) || g1.evals !== 1 || g1.window !== 'all') bad.push('G1 checkAskGlobal issues exactly one EVALSHA on ask:all:day -> ' + JSON.stringify(g1));
  const g2 = await driveGlobal(mod, (p) => p === 'ask:all:day');
  if (g2.ok !== false || !same(g2.seen, GLOBAL) || g2.window !== 'all') bad.push('G2 checkAskGlobal refuses, naming itself -> ' + JSON.stringify(g2));
  return bad;
}

const absoluteImports = (source) => source
  .replace(/from '(\.\.?\/[^']+)'/g, (_m, rel) => "from 'file:///" + path.resolve(path.dirname(RL_ABS), rel).replace(/\\/g, '/') + "'")
  .replace("from '@upstash/ratelimit'", "from 'file:///" + path.join(REPO, 'node_modules/@upstash/ratelimit/dist/index.js').replace(/\\/g, '/') + "'")
  .replace("from '@upstash/redis'", "from 'file:///" + path.join(REPO, 'node_modules/@upstash/redis/nodejs.mjs').replace(/\\/g, '/') + "'");

(async () => {
  const src = fs.readFileSync(RL_ABS, 'utf8');
  const askSrc = fs.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');

  // ---- A. source pins --------------------------------------------------------------------
  const seatAt = askSrc.indexOf('const { ok } = await checkAskLimit(ip);');
  const validatedAt = askSrc.indexOf('body.messages = messages;');
  const capAt = askSrc.indexOf('const cap = await guardDayCap(req, res);');
  const globalAt = askSrc.indexOf('const global = await checkAskGlobal();');
  ok('A1 checkAskLimit exists and is the seat api/ask.js calls after the body is validated and before the day cap',
    /export async function checkAskLimit\(/.test(src)
    && seatAt !== -1 && validatedAt !== -1 && capAt !== -1 && validatedAt < seatAt && seatAt < capAt,
    'validated@' + validatedAt + ' seat@' + seatAt + ' cap@' + capAt);
  ok('A2 the preview reading requires VERCEL_ENV AND VERCEL_URL, as lib/free-brain/flag.js does',
    /export function previewSkipsDayWindow\(/.test(src) && /VERCEL_ENV/.test(src) && /VERCEL_URL/.test(src)
    && /return isPreview && onPlatform;/.test(src));
  const askLimitBody = src.slice(src.indexOf('export async function checkAskLimit('), src.indexOf('export async function checkAskGlobal('));
  ok('A3 only the DAY window is conditional; the minute window is unconditional; the global is absent from checkAskLimit',
    /ASK_WINDOWS\.min\.limit\(ip\),\s*\n\s*skipDay \? Promise\.resolve\(\{ success: true \}\) : ASK_WINDOWS\.day\.limit\(ip\),\s*\n\s*\]\);/.test(src)
    && askLimitBody.length > 0 && !/ASK_WINDOWS\.all/.test(askLimitBody));
  ok('A4 production windows unchanged: 40/min and 400/day per IP',
    /const ASK_PER_IP_MIN = 40;/.test(src) && /const ASK_PER_IP_DAY = 400;/.test(src));
  ok('A5 checkAskGlobal is exported, is the ONLY site that consults the global window, and api/ask.js calls it after the day cap',
    /export async function checkAskGlobal\(/.test(src)
    && src.split("ASK_WINDOWS.all.limit('all')").length - 1 === 1
    && globalAt !== -1 && capAt !== -1 && capAt < globalAt,
    'cap@' + capAt + ' global@' + globalAt);

  // ---- B. the shipped module, driven -----------------------------------------------------
  process.env.KV_REST_API_URL = process.env.KV_REST_API_URL || 'https://preview-daycap-guard.invalid';
  process.env.KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN || 'guard-not-a-real-token';
  const realFetch = globalThis.fetch;
  installFetch();
  try {
    const mod = await import('file:///' + RL_ABS.replace(/\\/g, '/'));
    const bad = await board(mod);
    ok('B  the shipped limiter passes every row of the board (12 rows)', bad.length === 0, bad.join(' | '));
    ok('B0 previewSkipsDayWindow reads the env it is given',
      mod.previewSkipsDayWindow(PREVIEW) === true && mod.previewSkipsDayWindow(FIXTURE) === false
      && mod.previewSkipsDayWindow(PROD) === false && mod.previewSkipsDayWindow({}) === false);

    // ---- C. mutants ------------------------------------------------------------------------
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-preview-daycap-mut-'));
    try {
      const mutant = async (name, edit, mustFailRow) => {
        const mutated = edit(src);
        if (mutated === src) { ok('M precondition: ' + name + ' edits the source', false); return; }
        const file = path.join(dir, name.replace(/[^a-z0-9]+/gi, '-') + '.mjs');
        fs.writeFileSync(file, absoluteImports(mutated), 'utf8');
        const m = await import('file:///' + file.replace(/\\/g, '/'));
        const bad = await board(m);
        ok('M KILLED: ' + name, bad.some((b) => b.startsWith(mustFailRow)), 'rows failed: ' + (bad.join(' | ') || 'none'));
      };
      // M-1  the VERCEL_URL half is dropped: the budget fixture would switch the day window off.
      await mutant('the-VERCEL_URL-condition-is-dropped',
        (s) => s.replace('return isPreview && onPlatform;', 'return isPreview;'), 'R4');
      // M-2  the minute window is skipped along with the day window on preview.
      await mutant('the-minute-window-is-skipped-too',
        (s) => s.replace("ASK_WINDOWS.min.limit(ip),\n      skipDay ?", "skipDay ? Promise.resolve({ success: true }) : ASK_WINDOWS.min.limit(ip),\n      skipDay ?"), 'R5');
      // M-3  the skip is unconditional: production loses its day window.
      await mutant('the-skip-is-unconditional',
        (s) => s.replace('const skipDay = previewSkipsDayWindow(env);', 'const skipDay = true;'), 'R7');
      // M-4  the skip reads production as preview.
      await mutant('production-reads-as-preview',
        (s) => s.replace("=== 'preview'", "=== 'production'"), 'R1');
      // M-5  the global window is put back beside the per-IP pair (the shape of 2b82c821).
      await mutant('the-global-window-is-back-in-checkAskLimit',
        (s) => s.replace("skipDay ? Promise.resolve({ success: true }) : ASK_WINDOWS.day.limit(ip),\n    ]);", "skipDay ? Promise.resolve({ success: true }) : ASK_WINDOWS.day.limit(ip),\n      ASK_WINDOWS.all.limit('all'),\n    ]);"), 'R1');
      // M-6  checkAskGlobal consults a second window.
      await mutant('checkAskGlobal-consults-a-second-window',
        (s) => s.replace("const g = await ASK_WINDOWS.all.limit('all');", "const g = await ASK_WINDOWS.all.limit('all'); await ASK_WINDOWS.day.limit('all');"), 'G1');
      // M-7  a minute refusal no longer names its window.
      await mutant('the-minute-refusal-is-anonymous',
        (s) => s.replace("if (!m.success) return { ok: false, window: 'min' };", "if (!m.success) return { ok: false };"), 'R5');
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp only */ }
    }
  } finally {
    globalThis.fetch = realFetch;
  }

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? '  FAIL' : '  PASS') + ' ===');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
