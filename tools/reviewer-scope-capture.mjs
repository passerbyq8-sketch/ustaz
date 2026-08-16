// tools/reviewer-scope-capture.mjs — §٦ capture: drive api/ask.js in-process with the REAL
// provider and record, per question, exactly what reaches the reviewer.
//
// WHY IN-PROCESS AND NOT OVER HTTP. The preview is SSO-gated on every path (measured: 401 on
// POST /api/ask with no credential), and the "after" code is not deployed anyway. A before/after
// that re-calls the model twice would compare two different answers and prove nothing about the
// reviewer. So the model is called ONCE per question here; the captured payload is then replayed
// through the reviewer before and after the fix, which is the only way §٦'s "answer length /
// cards / citations unchanged" row can mean anything.
//
// WHAT IT CAPTURES. The reviewer's input is written by tools/reviewer-capture-hook.mjs, an ESM
// load hook that rewrites lib/free-brain/review.js IN MEMORY. Nothing on disk is touched, so the
// tree this harness measures is the tree that ships. Run it as:
//
//   node --import ./tools/reviewer-capture-register.mjs tools/reviewer-scope-capture.mjs <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));

// ── the owner's four questions (§٦), verbatim ──────────────────────────────
const QUESTIONS = [
  'توضّأت لصلاة العصر وأنا مسافر ولبست الدلاغ، كم يوم أقدر أمسح عليه؟',
  'شخص توضأ وطلع، وبعدين شكّ: هل أحدثت وانتقض وضوئي أو لا؟ متأكد ١٠٠٪ أنه توضأ لكنه شاكّ في الحدث. هل يعيد وضوءه ليصلي؟',
  'سلّفت رفيجك مبلغ كبير، وصار معسر لا يقدر يسدد ولا تدري متى. هل تطلع زكاة عن هالفلوس كل سنة وهي مو عندك؟',
  'وأنت تصلي الظهر نسيت تقعد للتشهد الأول وقمت واعتدل ظهرك، ثم تذكرت. ترجع تقعد أو تكمّل؟',
];

function loadEnvLocal() {
  const file = path.join(REPO, '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    let value = line.slice(eq + 1);
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    process.env[line.slice(0, eq).trim()] = value;
  }
}

async function main() {
  loadEnvLocal();
  if (!process.env.ANTHROPIC_API_KEY) { console.error('NO ANTHROPIC_API_KEY'); process.exit(2); }

  // The preview's own tier line for these requests read `model: 'claude-sonnet-5'`; matching it
  // keeps the captured answers the same shape the owner actually read.
  process.env.MODEL_STANDARD = process.env.MODEL_STANDARD || 'claude-sonnet-5';
  process.env.FREE_BRAIN_V1 = 'on';
  process.env.RFC_V05_MODE = 'off';
  process.env.LEDGER_RAG = 'off';
  process.env.VERCEL_ENV = 'preview';
  process.env.SEARCH_BUDGET_GLOBAL_PREVIEW = '1000';
  process.env.SEARCH_BUDGET_PER_CALLER = '1000';
  process.env.FOUNDER_SECRET = 'reviewer-scope-capture-secret';

  const outDir = process.argv[2];
  fs.mkdirSync(outDir, { recursive: true });

  const DC = await esm('lib/daycap.js');
  const CONSENT = await esm('lib/ai-consent.js');
  const LEDGER_STORE = await esm('lib/ledger/redis.js');
  // The daily-budget reservation is a Lua eval against Redis. With no store this harness would be
  // measuring an infrastructure outage instead of the reviewer, so it gets a local double — the
  // same one guards/identity-guard.cjs uses, for the same reason.
  let units = 0;
  LEDGER_STORE.__setRedisForTest({ async eval() { units += 1; return [units, units, 1, 0]; } });

  const DEVICE = 'reviewer-scope-capture';
  const handler = (await esm('api/ask.js')).default;

  const results = [];
  for (const [i, question] of QUESTIONS.entries()) {
    const capturePath = path.join(outDir, `q${i + 1}.reviewer-input.json`);
    process.env.EZIK_REVIEW_CAPTURE = capturePath;
    const chunks = [];
    const res = {
      statusCode: 0, headers: {},
      status(c) { this.statusCode = c; return this; },
      setHeader(k, v) { this.headers[k] = v; return this; },
      getHeader(k) { return this.headers[k]; },
      flushHeaders() {}, json(v) { chunks.push(JSON.stringify(v)); return this; },
      write(c) { chunks.push(String(c)); return true; },
      end(c) { if (c) chunks.push(String(c)); return this; },
      on() { return this; }, once() { return this; }, emit() { return this; },
    };
    const req = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ezik-ai-consent': CONSENT.AI_CONSENT_VERSION,
        'x-murabbi-device': DEVICE,
        'x-murabbi-founder': DC.founderTokenFor(DEVICE),
      },
      body: {
        name: 'مساعد', age: 30, gender: 'male', mode: 'chat', band: 'adult',
        max_tokens: 4096, stream: true,
        messages: [{ role: 'user', content: question }],
      },
      socket: { remoteAddress: '127.0.0.1' }, on() {}, url: '/api/ask',
    };
    const startedAt = Date.now();
    let threw = null;
    try { await handler(req, res); } catch (e) { threw = String(e?.message || e); }
    const wire = chunks.join('');
    const captured = fs.existsSync(capturePath) ? JSON.parse(fs.readFileSync(capturePath, 'utf8')) : null;
    results.push({
      n: i + 1, question, elapsedMs: Date.now() - startedAt,
      status: res.statusCode, threw,
      captured: Boolean(captured),
      wireBytes: Buffer.byteLength(wire, 'utf8'),
    });
    fs.writeFileSync(path.join(outDir, `q${i + 1}.wire.txt`), wire, 'utf8');
    console.log(`q${i + 1}: status=${res.statusCode} captured=${Boolean(captured)} `
      + `wire=${Buffer.byteLength(wire, 'utf8')}B ms=${Date.now() - startedAt}` + (threw ? ` threw=${threw}` : ''));
  }
  fs.writeFileSync(path.join(outDir, 'capture-summary.json'), JSON.stringify(results, null, 2), 'utf8');
}

main().catch((e) => { console.error('HARNESS FAILED:', e); process.exit(1); });
