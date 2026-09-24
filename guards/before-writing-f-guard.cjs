// guards/before-writing-f-guard.cjs -- م٢-و (BEFORE_WRITING_V1): the evidence is matched to the
// reader's ISSUE and not to the reader's words, so the «adjacent card» does not come.
//
// THE OWNER'S ITEM (program order 2026-09-24, م٢-و): «المطابقةُ بالمسألةِ في الفتاوى المخزّنةِ بدلَ قربِ
// الألفاظ، حتّى لا تأتي البطاقةُ المجاورة». MEASURED (02-brain/measure/A): «من مسح مسافرًا ثم أقام» and
// «من مسح مقيمًا ثم سافر» both score 46 for the مقيم→سافر question; the store admits a record on two
// of the first five topic tokens near each other; the encyclopedia search has no relevance gate at all
// (nonsense words return six random articles — measured in this program).
//
// WHAT THIS PINS — with the fast model stubbed, so this proves the wiring, the validation and the
// fallbacks; whether the model judges a real issue rightly is seen on the owner's preview:
//   I1  the resolver runs BEFORE the gathering and its searches are the ones sent (fatwa queries
//       folded to ≤ 3 words and ≤ 180 characters, the library query, the encyclopedia headwords);
//   I2  the judge runs AFTER it and the adjacent fatwa is not pinned — the old tree pins both;
//   I3  an unreadable resolver or judge costs nothing but the matching: the deterministic queries
//       are sent and every candidate is kept;
//   I4  a judge that names only candidates that do not exist is no verdict (all kept); an explicit
//       empty list is a verdict (nothing on the issue);
//   I5  parseIssuePlan folds and bounds what it is given.
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
const Q = 'هل يجوز للمعتدة من وفاة زوجها أن تخرج لزيارة أمها المريضة؟';
const fatwa = (id, title, question) => ({
  id, uid: `binbaz:${id}`, scholar: { id: 'binbaz' }, source: { url: `https://binbaz.org.sa/fatwas/${id}/x` }, title,
  content: { type: 'question_answer', question, answer: 'الجواب في هذه المسألة كذا وكذا والله أعلم بالصواب.' },
});
const RIGHT = fatwa('801', 'حكم خروج المعتدة من وفاة زوجها لزيارة أمها المريضة', 'هل للمعتدة من وفاة زوجها أن تخرج لزيارة أمها المريضة؟');
// THE ADJACENT CARD, MEASURED ON THE REAL ADMISSION (lib/fatwa-service.js topicalScore): the reader's own
// second query admits BOTH, and the neighbouring issue (a revocable divorce, not a death) scores 82 to
// the right fatwa's 68.
const ADJACENT = fatwa('802', 'حكم زيارة المعتدة من الطلاق الرجعي لأمها المريضة', 'هل للمطلقة طلاقا رجعيا في عدتها أن تخرج لزيارة أمها المريضة؟');

async function main() {
  console.log('before-writing-f guard — root ' + REPO);
  let LOOP = null, CONTRACT = null, ENC = null, IM = null;
  try { LOOP = await esm('lib/free-brain/loop.js'); CONTRACT = await esm('lib/fatwa-contract.js'); ENC = await esm('lib/encyclopedia.js'); }
  catch (e) { ok('I0  the modules load', false, e.message); }
  try { IM = await esm('lib/issue-match.js'); } catch (e) { ok('I0  lib/issue-match.js loads', false, e.message); }
  if (!LOOP || !CONTRACT || !ENC) { console.log(`\n=== before-writing-f: ${checks - failures}/${checks} PASS ===`); process.exit(1); }
  await quiet(() => ENC.searchStoredCorpus('العدة', { limit: 1 }));
  const scholars = CONTRACT.FATWA_SCHOLARS.map((entry) => ({ id: entry.id, snapshot: { records: entry.count } }));
  const drive = async ({ resolver, judge }) => {
    const provider = [];
    const fatwaQ = [];
    const libQ = [];
    const real = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (u.startsWith('https://provider.invalid')) {
        const body = JSON.parse(init.body);
        provider.push(body);
        const sys = String(body.system || '');
        let text = 'الجواب [[1]].';
        if (IM && sys === IM.RESOLVER_SYSTEM) text = resolver;
        else if (IM && sys === IM.JUDGE_SYSTEM) text = typeof judge === 'function' ? judge(body) : judge;
        else if (sys.startsWith('أنتَ فاحصُ أمانةٍ فقهيّة')) text = '{"claims":[]}';
        return jsonResponse(u, { content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
      }
      return jsonResponse(u, {}, { status: 503 });
    };
    const fetchImpl = async (url, init) => {
      const u = String(url);
      if (u.startsWith('https://lib.ezik.app')) { libQ.push(JSON.parse(init && init.body || '{}').q); return jsonResponse(u, { hits: [], took_ms: 1, refused: false }); }
      if (u.startsWith(CONTRACT.FATWA_BASE + '/api/v1/')) {
        const parsed = new URL(u);
        if (parsed.pathname === '/api/v1/health') return jsonResponse(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, counts: { scholars: scholars.length } });
        if (parsed.pathname === '/api/v1/scholars') return jsonResponse(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, scholars });
        fatwaQ.push(parsed.searchParams.get('q') || '');
        return jsonResponse(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, results: [RIGHT, ADJACENT], pagination: { total: 2 } });
      }
      return jsonResponse(u, {}, { status: 503 });
    };
    let out = null;
    try {
      out = await quiet(() => LOOP.runFreeBrainTurn({
        messages: [{ role: 'user', content: Q }],
        system: 'system', model: 'model', maxTokens: 512, effort: 'high', band: 'adult', mode: 'chat',
        lexicalRoute: 'DEEN', storedRuntime: 'STORED_FIQH',
        providerUrl: 'https://provider.invalid/v1/messages', headers: {}, env: {}, fetchImpl,
        beforeWriting: { libFlagValue: 'on', libToken: 'tk-guard-bw' },
      }));
    } finally { globalThis.fetch = real; }
    const writer = provider.find((b) => !IM || (b.system !== IM.RESOLVER_SYSTEM && b.system !== IM.JUDGE_SYSTEM && !String(b.system || '').startsWith('أنتَ فاحصُ')));
    const lastUser = writer ? [...(writer.messages || [])].reverse().find((m) => m.role === 'user') : null;
    const block = lastUser && Array.isArray(lastUser.content) ? lastUser.content.slice(1).map((b) => b.text || '').join('\n') : '';
    return { out, provider, fatwaQ, libQ, block };
  };
  const PLAN = '{"issue":"خروج المعتدة من الوفاة من بيتها لزيارة المريض","fatwa_queries":["خروج المعتدة وفاة","المعتدة زيارة أمها المريضة في العدة"],"library_query":"خروج المعتدة من الوفاة نهارا للحاجة","encyclopedia_terms":["عدة"]}';
  // The judge keeps whichever candidate is the مقيم→سافر fatwa, by its title — never by position.
  const judgeRight = (body) => {
    const listing = String(body.messages[0].content);
    const lines = [...listing.matchAll(/\[(\d+)\] ([^\n]+)/g)];
    const keep = lines.filter((m) => !m[2].includes('الرجعي')).map((m) => Number(m[1]));
    return JSON.stringify({ keep });
  };
  const on = await drive({ resolver: PLAN, judge: judgeRight });
  const sysOf = (b) => String(b.system || '');
  const order = on.provider.map((b) => (IM && sysOf(b) === IM.RESOLVER_SYSTEM ? 'resolver' : IM && sysOf(b) === IM.JUDGE_SYSTEM ? 'judge'
    : sysOf(b).startsWith('أنتَ فاحصُ') ? 'review' : 'write'));
  ok('I1a the resolver runs first, the judge after the gathering, then the write',
    order[0] === 'resolver' && order.indexOf('judge') > 0 && order.indexOf('judge') < order.indexOf('write'), JSON.stringify(order));
  ok('I1b the resolver\'s searches are the ones sent: its fatwa queries folded to ≤ 3 words, its library query',
    on.fatwaQ.includes('خروج المعتده وفاه') && on.fatwaQ.every((q) => q.split(' ').length <= 3 && q.length <= 180)
    && on.libQ.includes('خروج المعتده من الوفاه نهارا للحاجه'), JSON.stringify({ fatwaQ: on.fatwaQ, libQ: on.libQ }));
  ok('I2  the adjacent fatwa («الطلاق الرجعي») is not pinned; the right one is',
    on.block.includes('وفاة زوجها لزيارة') && !on.block.includes('زيارة المعتدة من الطلاق الرجعي'), on.block.slice(0, 700));
  const broken = await drive({ resolver: 'لا أعرف', judge: 'هذا ليس JSON' });
  ok('I3  an unreadable resolver and judge cost only the matching: the deterministic queries go out, every candidate is kept',
    broken.fatwaQ.length >= 1 && broken.fatwaQ.every((q) => q !== 'خروج المعتده وفاه')
    && broken.block.includes('وفاة زوجها لزيارة') && broken.block.includes('زيارة المعتدة من الطلاق الرجعي'), JSON.stringify(broken.fatwaQ));
  const ghost = await drive({ resolver: PLAN, judge: '{"keep":[99,100]}' });
  ok('I4  a judge that names only candidates that do not exist is no verdict: every candidate is kept',
    ghost.block.includes('زيارة المعتدة من الطلاق الرجعي') && ghost.block.includes('وفاة زوجها لزيارة'), ghost.block.slice(0, 300));
  const none = await drive({ resolver: PLAN, judge: '{"keep":[]}' });
  ok('I4b an explicit empty verdict is a verdict: nothing on the issue is pinned, and the turn still writes',
    !none.block.includes('زيارة المعتدة من الطلاق الرجعي') && !none.block.includes('وفاة زوجها لزيارة') && String(none.out && none.out.text || '') !== '',
    none.block.slice(0, 300));
  if (IM) {
    const plan = IM.parseIssuePlan('{"issue":"x","fatwa_queries":["مسح الخفين للمقيم إذا سافر","  "],"library_query":"' + 'كلمة '.repeat(60) + '","encyclopedia_terms":[]}');
    ok('I5  parseIssuePlan folds and bounds: ≤ 3 words per fatwa query, ≤ 6 words and ≤ 180 characters for the library',
      plan && plan.fatwaQueries.length === 1 && plan.fatwaQueries[0].split(' ').length <= 3
      && plan.libraryQuery.split(' ').length <= 6 && plan.libraryQuery.length <= 180 && IM.parseIssuePlan('نص') === null,
      JSON.stringify(plan));
  } else {
    ok('I5  parseIssuePlan folds and bounds', false, 'lib/issue-match.js missing');
  }
  console.log(`\n=== before-writing-f: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
