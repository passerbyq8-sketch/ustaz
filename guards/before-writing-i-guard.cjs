// guards/before-writing-i-guard.cjs -- م٢-ط (BEFORE_WRITING_V1): the encyclopedia's issues — the cold
// instance catches its first question, the encyclopedia is named once (card OR footer, never both),
// and the rows are not labelled «من قسم الفتاوى».
//
// THE OWNER'S ITEM (program order 2026-09-24, م٢-ط): «مسائلُ الموسوعة: النسخةُ الباردةُ لا تلحقُ أوّلَ
// سؤال · ذاكرةُ النسخة · البطاقةُ مع الذيل · وملاحظةُ «من قسم الفتاوى»». MEASURED (02-brain/measure A,
// D, E): cold build 1.6-2.4 s against a 1.5 s deadline (5 of 5 cold races lost); +105 MB heap and
// +260 MB RSS once built; every cited row showed its card AND «المصدر: الموسوعة الفقهية الكويتية.»;
// the candidate note told the model books and encyclopedia rows came «من قسم الفتاوى».
// The memory is not changed by code here: the index is built only on an adult's sharia turn under the
// switch, and its size is written in the program report for the owner.
//
// WHAT THIS PINS:
//   T1  api/ask.js starts the warm-up the moment the turn is an adult's sharia turn under the switch,
//       through lib/stored-deen.js (api/ask.js may not import lib/encyclopedia.js — gate cardorcontext);
//   T2  a COLD process's first before-writing fiqh turn pins encyclopedia rows (a child process);
//   T3  the footer is dropped exactly when the encyclopedia already stands as a card — ENCYC_V1's, or the
//       library's copy FC-003910 — and only under the switch, for an adult;
//   T4  the pinned rows are named by source, never «من قسم الفتاوى».
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { pathToFileURL } = require('url');

const rootArg = process.argv.indexOf('--root');
const REPO = rootArg > 0 ? path.resolve(process.argv[rootArg + 1]) : path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8').replace(/\r\n/g, '\n');
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 500) : ''));
  return false;
}

async function main() {
  console.log('before-writing-i guard — root ' + REPO);
  const askSrc = read('api/ask.js');
  const deenSrc = read('lib/stored-deen.js');
  const warmLine = /\n\s*if \(([^\n]+)\) warmStoredCorpusIndex\(\);\n/.exec(askSrc);
  const warmOn = (v, band, route) => { try { return new Function('beforeWritingValue', 'band', 'effectiveRoute', 'return (' + warmLine[1] + ');')(v, band, route); } catch { return 'threw'; } };
  ok('T1  api/ask.js starts the warm-up for an adult\'s sharia turn under the switch, through lib/stored-deen.js, and for nothing else',
    !!warmLine && warmOn('on', 'adult', 'DEEN') === true && warmOn('', 'adult', 'DEEN') === false
    && warmOn('on', 'teen', 'DEEN') === false && warmOn('on', 'adult', 'GEN') === false
    && deenSrc.includes("export { warmEncyclopedia as warmStoredCorpusIndex } from './encyclopedia.js';")
    && !askSrc.includes("import('../lib/encyclopedia.js')") && !/from '\.\.\/lib\/encyclopedia\.js'/.test(askSrc),
    warmLine ? warmLine[1] : '(no warm line)');

  // T2 — a cold process: nothing warmed, the first before-writing fiqh turn.
  const child = `
    const { pathToFileURL } = require('url');
    const root = ${JSON.stringify(REPO)};
    (async () => {
      const LOOP = await import(pathToFileURL(root + '/lib/free-brain/loop.js').href);
      const CONTRACT = await import(pathToFileURL(root + '/lib/fatwa-contract.js').href);
      let deen = null; try { deen = await import(pathToFileURL(root + '/lib/stored-deen.js').href); } catch {}
      const jr = (url, obj, status = 200) => ({ ok: status < 300, status, url: String(url), headers: { get: (h) => String(h).toLowerCase() === 'content-type' ? 'application/json' : String(h).toLowerCase() === 'content-length' ? String(Buffer.byteLength(JSON.stringify(obj))) : null }, json: async () => obj, text: async () => JSON.stringify(obj) });
      const scholars = CONTRACT.FATWA_SCHOLARS.map((e) => ({ id: e.id, snapshot: { records: e.count } }));
      let block = '';
      globalThis.fetch = async (url, init) => {
        const u = String(url);
        if (u.startsWith('https://provider.invalid')) {
          const body = JSON.parse(init.body);
          if (body.system === 'system') { const lu = [...body.messages].reverse().find((m) => m.role === 'user'); block = Array.isArray(lu.content) ? lu.content.slice(1).map((b) => b.text).join('\\n') : ''; }
          return jr(u, { content: [{ type: 'text', text: body.system === 'system' ? 'جواب [[1]].' : '{"claims":[]}' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
        }
        return jr(u, {}, 503);
      };
      const fetchImpl = async (url) => {
        const u = String(url);
        if (u.startsWith(CONTRACT.FATWA_BASE + '/api/v1/')) {
          const p = new URL(u).pathname;
          if (p === '/api/v1/health') return jr(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, counts: { scholars: scholars.length } });
          if (p === '/api/v1/scholars') return jr(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, scholars });
          return jr(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, results: [], pagination: { total: 0 } });
        }
        if (u.startsWith('https://lib.ezik.app')) return jr(u, { hits: [], took_ms: 1, refused: false });
        return jr(u, {}, 503);
      };
      const t0 = Date.now();
      // What api/ask.js does at request start under the switch (T1), before the loop.
      if (deen && typeof deen.warmStoredCorpusIndex === 'function') deen.warmStoredCorpusIndex();
      const saved = console.log; console.log = () => {}; console.warn = () => {}; console.info = () => {};
      const out = await LOOP.runFreeBrainTurn({
        messages: [{ role: 'user', content: 'تبرعت بالدم وأنا على وضوء، هل خروج الدم الكثير ينقض الوضوء؟' }],
        system: 'system', model: 'model', maxTokens: 512, effort: 'high', band: 'adult', mode: 'chat',
        lexicalRoute: 'DEEN', storedRuntime: 'STORED_FIQH',
        providerUrl: 'https://provider.invalid/v1/messages', headers: {}, env: {}, fetchImpl,
        beforeWriting: { libFlagValue: 'on', libToken: 'tk-guard-bw' },
      });
      console.log = saved;
      const enc = (block.match(/\\[\\[\\d+\\]\\] الموسوعة الفقهية الكويتية/g) || []).length;
      process.stdout.write(JSON.stringify({ enc, ms: Date.now() - t0, reason: out && out.storedInjection && out.storedInjection.beforeWriting && out.storedInjection.beforeWriting.reasons }));
    })().catch((e) => { process.stdout.write(JSON.stringify({ error: String(e && e.message || e) })); });
  `;
  let cold = null;
  try { cold = JSON.parse(cp.execFileSync(process.execPath, ['-e', child], { cwd: REPO, encoding: 'utf8', timeout: 60000 })); }
  catch (e) { cold = { error: String(e && e.message || e).slice(0, 200) }; }
  ok('T2  a cold process: the first before-writing fiqh turn already pins encyclopedia rows', cold && cold.enc > 0, JSON.stringify(cold));

  // T3 — the card or the footer.
  const cardLine = /\n\s*if \(beforeWritingValue === 'on' && band === 'adult'\n\s*&& \(([^\n]+)\)\) \{\n\s*finalizerContext\.readerSuffix = '';\n/.exec(askSrc);
  const dropped = (v, band, encycCards, cited) => {
    if (!cardLine) return 'no line';
    try { return new Function('beforeWritingValue', 'band', 'encycCards', 'out', "return (beforeWritingValue === 'on' && band === 'adult' && (" + cardLine[1] + '));')(v, band, encycCards, { cited }); } catch { return 'threw'; }
  };
  const libEnc = [{ kind: 'lib_book', subjectId: 'FC-003910' }];
  const otherBook = [{ kind: 'lib_book', subjectId: 'FC-003727' }];
  const encRow = [{ kind: 'encyclopedia' }];
  ok('T3  the footer goes exactly when the encyclopedia already stands as a card — and only under the switch, for an adult',
    dropped('on', 'adult', ['card'], encRow) === true && dropped('on', 'adult', [], libEnc) === true
    && dropped('on', 'adult', [], encRow) === false && dropped('on', 'adult', [], otherBook) === false
    && dropped('', 'adult', ['card'], encRow) === false && dropped('on', 'teen', ['card'], encRow) === false
    && askSrc.includes('finalizerContext.readerSuffix = encyclopediaTail(out.cited);'),
    cardLine ? cardLine[1] : '(no line)');
  let BW = null;
  try { BW = await import(pathToFileURL(path.join(REPO, 'lib/before-writing.js')).href); } catch { BW = null; }
  ok('T4  the pinned rows are named by source, never «من قسم الفتاوى»',
    !!BW && !BW.BW_PINNED_NOTE.includes('من قسم الفتاوى') && !BW.BW_PINNED_NOTE.includes('من قسمِ الفتاوى')
    && BW.sourceLabel({ kind: 'encyclopedia', part: 22, title: 'الموسوعة الفقهية الكويتية — رعاف' }).startsWith('الموسوعة الفقهية الكويتية — ج22'));
  console.log(`\n=== before-writing-i: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
