'use strict';
// D-2 E8: the report-C 215s/276s clock, on two different real encyclopedia issues.
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/fix-d2-replay.json'), 'utf8'));
let checks = 0, failed = 0;
const ok = (name, pass, detail) => { checks++; if (!pass) failed++; console.log((pass ? 'PASS ' : 'FAIL ') + name + (!pass && detail ? ' ' + JSON.stringify(detail) : '')); };
const realNow = Date.now.bind(Date); let offset = 0;
const head = 'الصلاة من شعائر الإسلام.';
const bad = 'ذكر ابن باز أن هذا الفعل جائز عند الحاجة.';
const textOf = m => typeof m?.content === 'string' ? m.content : (m?.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
(async () => {
  const L = await import(pathToFileURL(path.join(ROOT, 'lib/free-brain/loop.js')));
  const I = await import(pathToFileURL(path.join(ROOT, 'lib/free-brain/instructions.js')));
  const RR = await import(pathToFileURL(path.join(ROOT, 'lib/ruling-review.js')));
  const owner = fixture.owners.find(o => o.id.endsWith('6af2ebb1'));
  const replay = await RR.reviewRulings({ text: owner.text, rows: owner.rows, ask: async () => owner.raw });
  ok('E8 recorded Saturday writer/reviewer replay unchanged', replay.record.claims === 6 && replay.record.supported === 3 && replay.record.notFound === 3);
  Date.now = () => realNow() + offset;
  const drive = async (sibling, flag = true) => {
    const tail = sibling.quote + '.\nويُنظر في تفاصيل المسألة بحسب حالها.';
    const draft = [head, bad, tail.slice(0, Math.floor(tail.length / 2))].join('\n');
    const calls = [], savedFetch = globalThis.fetch;
    const savedLog = { log: console.log, warn: console.warn, error: console.error, info: console.info };
    const hdrs = { get: h => String(h).toLowerCase() === 'content-type' ? 'application/json' : null };
    const noFetch = async u => ({ ok: false, status: 503, url: String(u), headers: hdrs, text: async () => '', json: async () => ({}) });
    globalThis.fetch = async (url, init = {}) => {
      if (!String(url).startsWith('https://provider.invalid')) return noFetch(url);
      const body = JSON.parse(init.body), last = textOf(body.messages?.at(-1));
      let kind = 'write', text = draft, stop = 'max_tokens', ms = 60894;
      if (last === I.CONTINUE_NOTE) { kind = 'continue'; text = tail; stop = 'end_turn'; ms = 29900; }
      else if (last.startsWith(I.REJECT_RETRY_NOTE)) { kind = 'reject'; text = head + '\n' + tail.slice(0, 50); }
      else if ((body.max_tokens || 0) <= 2000) { kind = 'aux'; text = 'DEEN'; stop = 'end_turn'; ms = 300; }
      offset += ms; calls.push({ kind, stop });
      const payload = { content: [{ type: 'text', text }], stop_reason: stop, usage: { input_tokens: 1000, output_tokens: stop === 'max_tokens' ? body.max_tokens : 2000 } };
      return { ok: true, status: 200, url: String(url), headers: hdrs, text: async () => JSON.stringify(payload), json: async () => payload };
    };
    const started = Date.now(); let out;
    try {
      console.log = console.warn = console.error = console.info = () => {};
      out = await L.runFreeBrainTurn({
        messages: [{ role: 'user', content: sibling.question }], system: 'system', model: 'claude-opus-5', maxTokens: 4096,
        usePremium: true, effort: 'high', band: 'adult', mode: 'chat', lexicalRoute: 'DEEN', storedRuntime: '',
        providerUrl: 'https://provider.invalid/v1/messages', headers: {}, env: {}, fetchImpl: noFetch,
        fullAnswer: flag ? { startedAt: started - 124206 } : null,
      });
    } finally { globalThis.fetch = savedFetch; Object.assign(console, savedLog); }
    return { out, calls, tail };
  };
  for (const sibling of fixture.siblings) {
    const result = await drive(sibling), out = result.out, notes = out.degraded || [];
    const detail = { text: out.text, truncated: out.truncated, calls: result.calls, notes };
    ok('E8 ' + sibling.id + ': report-C rejected capped rewrite reached', notes.includes('reject_retry:rewrite_cut_over_whole') && result.calls.some(c => c.kind === 'reject'), detail);
    ok('E8 ' + sibling.question + ': only rejected whole sentence lifted', out.text.startsWith(head) && out.text.includes(result.tail) && !out.text.includes('هذا الفعل جائز') && notes.some(n => n.startsWith('reject_lifted:')), detail);
    ok('E8 ' + sibling.id + ': no incomplete mark for that lift alone', out.truncated === false && !notes.some(n => n.includes('reject_unrepaired')), detail);
  }
  const off = await drive(fixture.siblings[0], false);
  ok('E8 flag off retains old path', !(off.out.degraded || []).some(n => n.startsWith('reject_lifted:')));
  console.log('E8 ' + (checks - failed) + '/' + checks); process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => { Date.now = realNow; });
