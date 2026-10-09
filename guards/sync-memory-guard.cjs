// guards/sync-memory-guard.cjs -- item 58, the memory the brain keeps of the asker, driven for real.
//
// THE REAL /api/ask HANDLER is called with a stubbed global fetch that records the one vendor call
// it makes (the pattern guards/system-prompt-parity-guard.cjs uses). What is compared is the
// `system` the brain would have received -- byte for byte -- across the switch and the profile:
//
//   A  the people's prompt is the base prompt BYTE FOR BYTE: switch off (any gender), and switch
//      open with no stated gender
//   B  switch open + a stated gender: the base prompt plus exactly ONE inserted block (after the
//      date block, before the free-brain instructions), the address line, and nothing else moved
//   C  the line speaks of the address only: it says the ruling does not change, and neither the
//      name nor a madhhab has a road into it (two names, one line; a madhhab field changes nothing)
//   D  owner mode: the owner's session opens it, a stranger's session and a guest do not
//   E  the translator: its prompt is unchanged without an addressee, and gains one rule with one
//
// Usage: node guards/sync-memory-guard.cjs      Exit 0 when every case holds.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { makeStore } = require('./sync-fake-store.cjs');

const REPO = path.join(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const AI_CONSENT_VERSION = (fs.readFileSync(path.join(REPO, 'lib', 'ai-consent.js'), 'utf8').match(/AI_CONSENT_VERSION\s*=\s*'([^']+)'/) || [])[1];

const results = [];
let failed = 0;
const check = (name, cond, detail) => { results.push({ name, ok: !!cond, detail: cond ? '' : (detail || '') }); if (!cond) failed++; };
const say = (s) => process.stdout.write(s + '\n');

async function main() {
  const realFetch = globalThis.fetch;
  const realLog = console.log, realWarn = console.warn, realErr = console.error;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-guard-fake';
  process.env.RFC_V05_MODE = 'off';
  process.env.LEDGER_RAG = 'off';
  process.env.FOUNDER_SECRET = ['sync', 'memory', 'guard', 'local'].join('-');   // a local stand-in, never a real value
  process.env.VERCEL_ENV = 'preview';
  const DC = await esm('lib/daycap.js');
  const AUTHSTORE = await esm('lib/auth/store.js');
  const ACCOUNT = await esm('lib/auth/account.js');
  const MEM = await esm('lib/sync/memory.js');
  const MODEL = await esm('lib/lang/model.js');
  const ANSWER = await esm('lib/lang/answer.js');
  const store = makeStore();
  AUTHSTORE.__setAuthStoreForTest(store);
  const DEVICE = 'sync-memory-guard-device';
  const FOUNDER = DC.founderTokenFor(DEVICE);
  const ASK = (await esm('api/ask.js')).default;

  let captured = null;
  globalThis.fetch = async (url, opts) => {
    if (String(url).indexOf('api.anthropic.com') !== -1 && captured === null) {
      captured = JSON.parse(opts.body);
    }
    if (String(url).indexOf('api.anthropic.com') !== -1) {
      return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
        body: { getReader: () => ({ read: async () => ({ done: true }) }) }, text: async () => '' };
    }
    return { ok: false, status: 500, text: async () => '', json: async () => ({}) };
  };
  const mkRes = () => {
    const r = { statusCode: 200, headers: {} };
    r.status = (c) => { r.statusCode = c; return r; };
    r.setHeader = (k, v) => { r.headers[k] = v; };
    r.getHeader = (k) => r.headers[k];
    r.flushHeaders = () => {}; r.json = () => r; r.write = () => true; r.end = () => r; r.send = () => r;
    r.on = () => r; r.once = () => r; r.emit = () => r;
    return r;
  };
  const systemFor = async (reader, extraHeaders) => {
    captured = null;
    const body = Object.assign({ age: 7, band: 'young', mode: 'chat', messages: [{ role: 'user', content: 'كم حاصل سبعة في ثمانية؟' }] }, reader);
    const req = { method: 'POST', headers: Object.assign({ 'content-type': 'application/json', 'x-ezik-ai-consent': AI_CONSENT_VERSION, 'x-murabbi-device': DEVICE, 'x-murabbi-founder': FOUNDER }, extraHeaders || {}),
      body, socket: { remoteAddress: '127.0.0.1' }, on: () => {}, url: '/' };
    console.log = () => {}; console.warn = () => {}; console.error = () => {};
    try { await ASK(req, mkRes()); } catch (e) { /* the capture is what matters */ } finally { console.log = realLog; console.warn = realWarn; console.error = realErr; }
    if (!captured) return null;
    const sys = captured.system;
    return Array.isArray(sys) ? sys.map((b) => b.text || '') : [String(sys || '')];
  };
  const J = (x) => JSON.stringify(x);
  // open = base with exactly ONE block inserted, and that block is the line.
  const onePlus = (open, base, line) => !!open && open.length === base.length + 1 && open.filter((b) => b === line).length === 1 && J(open.filter((b) => b !== line)) === J(base);

  try {
    // A -- the people
    delete process.env.SYNC_SWITCH;
    const baseMale = await systemFor({ name: 'خالد', gender: 'male' });
    const baseFemale = await systemFor({ name: 'خالد', gender: 'female' });
    const baseNone = await systemFor({ name: 'خالد', gender: null });
    check('A0 the handler reached the vendor (the harness proves something)', baseMale && baseFemale && baseNone);
    process.env.SYNC_SWITCH = 'off';
    check('A1 switch off: the prompt is the base prompt byte for byte (male, female, unset)',
      J(await systemFor({ name: 'خالد', gender: 'male' })) === J(baseMale) && J(await systemFor({ name: 'خالد', gender: 'female' })) === J(baseFemale) && J(await systemFor({ name: 'خالد', gender: null })) === J(baseNone));
    process.env.SYNC_SWITCH = 'garbage';
    check('A2 a corrupt switch is off: base prompt byte for byte', J(await systemFor({ name: 'خالد', gender: 'female' })) === J(baseFemale));
    process.env.SYNC_SWITCH = 'all';
    check('A3 switch open, gender NOT stated: the base prompt byte for byte', J(await systemFor({ name: 'خالد', gender: null })) === J(baseNone) && J(await systemFor({ name: 'خالد' })) === J(await (async () => { process.env.SYNC_SWITCH = 'off'; const x = await systemFor({ name: 'خالد' }); process.env.SYNC_SWITCH = 'all'; return x; })()));

    // B -- open + stated
    const f = await systemFor({ name: 'خالد', gender: 'female' });
    const m = await systemFor({ name: 'خالد', gender: 'male' });
    check('B1 open + female: the base prompt, then exactly one appended block -- the feminine address line', onePlus(f, baseFemale, MEM.ADDRESS_LINES.female));
    check('B2 open + male: the same, with the masculine line', onePlus(m, baseMale, MEM.ADDRESS_LINES.male));

    // C -- address only; no name, no madhhab
    const f2 = await systemFor({ name: 'فاطمة', gender: 'female', madhhab: 'hanafi' });
    check('C1 the line is the same for two names: the name has no road into it', f2 && f2.includes(MEM.ADDRESS_LINES.female) && f.includes(MEM.ADDRESS_LINES.female) && !MEM.ADDRESS_LINES.female.includes('خالد') && !MEM.ADDRESS_LINES.female.includes('فاطمة'));
    check('C2 a madhhab field in the body changes nothing', J(f2) === J(await systemFor({ name: 'فاطمة', gender: 'female' })));
    check('C3 the line says the ruling, its evidence and its detail do not change, and forbids name and gender in the answer', /الحكمُ الشرعيّ/.test(MEM.ADDRESS_LINES.female) && /بلا زيادة/.test(MEM.ADDRESS_LINES.female) && /لا تذكر اسمَ/.test(MEM.ADDRESS_LINES.female) && /لا تذكر اسمَ/.test(MEM.ADDRESS_LINES.male));
    check('C4 the memory module reads neither the name nor a madhhab', !/body\.name|\.madhhab/.test(fs.readFileSync(path.join(REPO, 'lib', 'sync', 'memory.js'), 'utf8').replace(/\/\/.*$/gm, '')));

    // D -- owner mode
    process.env.SYNC_SWITCH = 'owner';
    process.env.EZIK_OWNER_ACCOUNTS = ACCOUNT.emailDigest('owner@example.com');
    const mk = async (sub, email) => { const a = await ACCOUNT.upsertAccount({ provider: 'google', sub, email, emailVerified: true }); return (await ACCOUNT.mintSession(a.key)).session; };
    const ownerS = await mk('901', 'owner@example.com');
    const otherS = await mk('902', 'other@example.com');
    const fo = await systemFor({ name: 'خالد', gender: 'female' }, { 'x-ezik-session': ownerS });
    const fx = await systemFor({ name: 'خالد', gender: 'female' }, { 'x-ezik-session': otherS });
    const fg = await systemFor({ name: 'خالد', gender: 'female' });
    check('D1 owner mode: the owner session gets the address line', onePlus(fo, baseFemale, MEM.ADDRESS_LINES.female));
    check('D2 owner mode: another account and a guest get the base prompt byte for byte', J(fx) === J(baseFemale) && J(fg) === J(baseFemale));
    delete process.env.EZIK_OWNER_ACCOUNTS;

    // E -- the translator
    check('E1 translator: no addressee, no change (every language, both marker forms)', ['en', 'fr', 'ur', 'fa', 'id'].every((c) => MODEL.answerSystem(c, true) === MODEL.answerSystem(c, true, '') && MODEL.answerSystem(c, false) === MODEL.answerSystem(c, false, '')));
    const lineF = MEM.translatorAddressLine('female');
    check('E2 translator: an addressee adds exactly one rule at the end', ['fr', 'ur'].every((c) => MODEL.answerSystem(c, true, lineF) === MODEL.answerSystem(c, true) + '\n' + lineF));
    const seen = [];
    await ANSWER.translateAnswer('السلام عليكم.\n\nهذا جوابٌ قصير.', { lang: 'fr', addressLine: lineF, translate: async (o) => { seen.push(o.system); return { ok: true, text: '["Paix sur vous.","Ceci est une courte réponse."]', ms: 1 }; }, budgetMs: 5000 }).catch(() => null);
    check('E3 translator: the answer translation carries the addressee rule to the model', seen.length > 0 && seen.every((s) => s.endsWith(lineF)), String(seen.length));
  } finally {
    globalThis.fetch = realFetch;
  }

  say('=== sync-memory-guard: item 58 ===');
  for (const r of results) say((r.ok ? '[PASS] ' : '[FAIL] ') + r.name + (r.ok ? '' : '  -- ' + r.detail));
  say('=== ' + (results.length - failed) + '/' + results.length + ' cases hold ===');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { say('[FAIL] the guard could not run: ' + (e && e.stack || e)); process.exit(1); });
