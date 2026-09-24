// guards/preview-daycap-guard.cjs -- the per-IP DAY window is skipped on a preview deployment,
// and NOWHERE else.
//
// THE MEASURED PROBLEM, 24 September 2026 (sources order, decision 5). A preview deployment is
// reachable only by signed-in members of the Vercel team, and its whole purpose is to be measured:
// a battery of a hundred questions from one address in one afternoon. Production and preview
// share the same Upstash store and the same `ask:day` prefix, so the night exam of 2026-09-24 saw
// 97 of 210 requests refused by the day window while measuring the previews (night report, D16).
//
// THE RULE THIS PINS, in `lib/ratelimit.js` checkAskLimit:
//   * on a PREVIEW deployment (VERCEL_ENV === 'preview' AND VERCEL_URL non-empty, the same
//     reading as lib/free-brain/flag.js) the per-IP day window is not consulted at all;
//   * the per-IP MINUTE window and the GLOBAL day window are consulted in BOTH environments,
//     and each still refuses on its own;
//   * production, and a process with no VERCEL_ENV at all, consult all three exactly as before;
//   * VERCEL_ENV='preview' WITHOUT VERCEL_URL -- the fixture ten guards set to name a paid-search
//     budget -- does NOT switch the day window off.
//
// HOW IT IS PROVED: the real module is driven with one fake `globalThis.fetch` at the Upstash REST
// boundary (the client pipelines the three EVALSHA calls into one POST). The stub records which
// window prefixes were asked and answers `[remaining, limit]` per command, so a refusal is a
// negative remaining on exactly the window under test. Every per-IP identifier is unique per
// case because the client caches a denied identifier until its window resets, and the global
// refusal row runs last for the same reason. Three mutants of the
// source are then loaded from a temp copy and each must be caught by one of the drives.
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
    if (cmds.length && !Array.isArray(cmds[0])) cmds = [cmds];
    const out = cmds.map((c) => {
      const key = String(c[3] || '');
      const prefix = key.startsWith('ask:all:day') ? 'ask:all:day' : key.startsWith('ask:day') ? 'ask:day' : key.startsWith('ask:min') ? 'ask:min' : key;
      asked.push(prefix);
      const limit = Number(c[6]) || 1;
      return { result: refuse(prefix) ? [-1, limit] : [limit - 1, limit] };
    });
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => out, text: async () => JSON.stringify(out) };
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
  return { ok: res.ok, seen };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ALL3 = ['ask:all:day', 'ask:day', 'ask:min'];
const NO_DAY = ['ask:all:day', 'ask:min'];

// The board every module (shipped or mutant) is driven across. Returns the list of row names
// that FAILED, so a mutant is "killed" when at least one row fails under it.
async function board(mod) {
  const bad = [];
  const row = async (name, env, refuseFn, expectOk, expectSeen) => {
    const r = await drive(mod, env, refuseFn);
    if (r.ok !== expectOk || !same(r.seen, expectSeen)) bad.push(name + ' -> ' + JSON.stringify(r));
  };
  await row('R1 production consults all three windows',            PROD,    null,                      true,  ALL3);
  await row('R2 no VERCEL_ENV consults all three windows',         NONE,    null,                      true,  ALL3);
  await row('R3 preview deployment never asks the day window',     PREVIEW, null,                      true,  NO_DAY);
  await row('R4 preview fixture without VERCEL_URL keeps the day', FIXTURE, null,                      true,  ALL3);
  await row('R5 preview: the minute window still refuses',         PREVIEW, (p) => p === 'ask:min',    false, NO_DAY);
  await row('R7 production: the day window still refuses',         PROD,    (p) => p === 'ask:day',    false, ALL3);
  await row('R8 preview: a day window that would refuse is not consulted', PREVIEW, (p) => p === 'ask:day', true, NO_DAY);
  await row('R9 fixture: the day window refuses as in production', FIXTURE, (p) => p === 'ask:day',    false, ALL3);
  // LAST on purpose: the client caches a denied identifier until its window resets, and the
  // global window's identifier ('all') is the one every row shares.
  await row('R6 preview: the global day window still refuses',     PREVIEW, (p) => p === 'ask:all:day', false, NO_DAY);
  return bad;
}

const absoluteImports = (source) => source
  .replace(/from '(\.\.?\/[^']+)'/g, (_m, rel) => "from 'file:///" + path.resolve(path.dirname(RL_ABS), rel).replace(/\\/g, '/') + "'")
  .replace("from '@upstash/ratelimit'", "from 'file:///" + path.join(REPO, 'node_modules/@upstash/ratelimit/dist/index.js').replace(/\\/g, '/') + "'")
  .replace("from '@upstash/redis'", "from 'file:///" + path.join(REPO, 'node_modules/@upstash/redis/nodejs.mjs').replace(/\\/g, '/') + "'");

(async () => {
  const src = fs.readFileSync(RL_ABS, 'utf8');

  // ---- A. source pins --------------------------------------------------------------------
  ok('A1 checkAskLimit exists and is the seat api/ask.js calls before the body is parsed',
    /export async function checkAskLimit\(/.test(src)
    && /const \{ ok \} = await checkAskLimit\(ip\);/.test(fs.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8')));
  ok('A2 the preview reading requires VERCEL_ENV AND VERCEL_URL, as lib/free-brain/flag.js does',
    /export function previewSkipsDayWindow\(/.test(src) && /VERCEL_ENV/.test(src) && /VERCEL_URL/.test(src)
    && /return isPreview && onPlatform;/.test(src));
  ok('A3 only the DAY window is conditional; minute and global are unconditional',
    /ASK_WINDOWS\.min\.limit\(ip\),\s*\n\s*skipDay \? Promise\.resolve\(\{ success: true \}\) : ASK_WINDOWS\.day\.limit\(ip\),\s*\n\s*ASK_WINDOWS\.all\.limit\('all'\),/.test(src));
  ok('A4 production windows unchanged: 40/min and 400/day per IP',
    /const ASK_PER_IP_MIN = 40;/.test(src) && /const ASK_PER_IP_DAY = 400;/.test(src));

  // ---- B. the shipped module, driven -----------------------------------------------------
  process.env.KV_REST_API_URL = process.env.KV_REST_API_URL || 'https://preview-daycap-guard.invalid';
  process.env.KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN || 'guard-not-a-real-token';
  const realFetch = globalThis.fetch;
  installFetch();
  try {
    const mod = await import('file:///' + RL_ABS.replace(/\\/g, '/'));
    const bad = await board(mod);
    ok('B  the shipped limiter passes every row of the board (9 rows)', bad.length === 0, bad.join(' | '));
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
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp only */ }
    }
  } finally {
    globalThis.fetch = realFetch;
  }

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? '  FAIL' : '  PASS') + ' ===');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
