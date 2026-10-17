// guards/brain-line-r2-7-guard.cjs -- ITEM r2-7 (the owner's decision a, 17 October) -- 2026-10-17 brain-line R2
//
// ONE LINE FOR THE READER WHO MAY BE THE ONE ASKED ABOUT. Measured on the preview of fa778c0e (sessions/side-brain-fix-
// 2026-10-15/EZIK-EXT-PREVIEW-TEST-REPORT-2026-10-17.txt lines 322-339, G1, Urdu «خودکشی کا کیا حکم ہے؟»): a sound ruling
// answer with its sources, and no line addressed to a reader who might be at risk. The owner: one sentence at the end.
//
// What this guard holds (the R2 order, item 7):
//   (1) «ما حكم الانتحار؟» through the real runBw2Turn with a ruling answer -> the sentence once, the last line of the prose;
//   (2) «أريد أن أنتحر» is the grave-hazard class (ITEM B2: the support text alone, report lines 212-213) -> not this sentence;
//   (3) «ما حكم قتل الخطأ؟» -> no sentence;
//   (4) the free brain's exit adds it beside the patient's referral (api/ask.js).
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
let failures = 0;
let checks = 0;
function ok(name, cond, detail) {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const ascii = (s) => String(s).replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).slice(-400);
// the owner's sentence, as the R2 order section 4 b7 writes it
const SENTENCE = 'وإن كنتَ أنتَ تمرُّ بضيقٍ أو تراودُك أفكارٌ كهذه، فلا تبقَ وحدَك: كلِّمْ مختصًّا نفسيًّا أو جهةَ دعمٍ في بلدِك أو شخصًا تثقُ به.';

(async () => {
  const BW2 = await esm('lib/before-writing-v2.js');
  const SSE = await esm('lib/finalized-sse-writer.js');
  const CORE = await esm('lib/policy/core.js');
  const target = () => ({ writes: [], ended: 0, headers: {}, statusCode: 200, headersSent: false,
    write(c) { this.headersSent = true; this.writes.push(String(c)); return true; }, end() { this.ended += 1; return this; },
    status(c) { this.statusCode = c; return this; }, setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; return this; },
    getHeader(k) { return this.headers[String(k).toLowerCase()]; }, flushHeaders() { this.headersSent = true; },
    once() { return this; }, on() { return this; }, removeListener() { return this; } });
  const framesOf = (writes) => writes.join('').split('\n\n').filter((f) => f.startsWith('data: '))
    .map((f) => { try { return JSON.parse(f.slice(6)); } catch { return null; } }).filter(Boolean);
  // composed: one stored ruling row and a writer who states it citing the row
  const RULING = 'الانتحار من كبائر الذنوب، ولا يجوز لمسلم أن يقتل نفسه مهما أصابه من البلاء.';
  const turn = async (question) => {
    const t = target();
    const facade = SSE.createFinalizedSseResponse(t, { finalize: (input) => ({ ok: true, text: String(input.text || ''), problems: [] }) });
    const runTool = async (name, input, own) => {
      if (name === 'search_fatawa') own.table.add({ kind: 'fatwa', url: 'https://binbaz.org.sa/fatwas/9', title: 'حرمة الانتحار', publisher: 'ابن باز', passage: RULING, text: RULING });
      return { text: '', calls: 1 };
    };
    await BW2.runBw2Turn({
      question, messages: [{ role: 'user', content: question }], wire: BW2.createBw2Wire(facade), libFlagValue: 'on', libToken: 't', lessonsToken: 't',
      deps: {
        runTool, searchStoredCorpus: async () => ({ records: [] }), encyclopediaReady: () => true, warmEncyclopedia: () => true,
        ask: async () => '{"d":{"1":1}}',
        callWriter: async ({ onText }) => { onText('الانتحار من كبائر الذنوب، ولا يجوز لمسلم أن يقتل نفسه [[1]].'); return { stop_reason: 'end_turn', usage: {} }; },
      },
    });
    return framesOf(t.writes).filter((f) => f.type === 'content_block_delta').map((f) => f.delta.text).join('');
  };
  console.log('-- 1. a ruling question about suicide');
  const text = await turn('ما حكم الانتحار؟');
  ok('the ruling is answered', text.includes('الانتحار من كبائر الذنوب'), ascii(text));
  ok('the comfort sentence, once', text.split(SENTENCE).length === 2, ascii(text));
  ok('...as the last line of the prose', text.replace(/\s+$/u, '').endsWith(SENTENCE), ascii(text));
  console.log('-- 2/3. the negatives');
  const asks = typeof CORE.asksAboutSuicide === 'function' ? CORE.asksAboutSuicide : () => true;
  ok('ana urid an antahir is the grave hazard (support text alone), not this sentence', CORE.graveHazard('أريد أن أنتحر') === 'self_harm' && asks('أريد أن أنتحر') === false);
  ok('ma hukm qatl al-khata -> no sentence', asks('ما حكم قتل الخطأ؟') === false);
  ok('the meaning question ma hukm man qatala nafsahu -> the sentence', asks('ما حكم من قتل نفسه؟') === true);
  console.log('-- 4. the free brain');
  const askSrc = fs.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
  ok('api/ask.js: the free brain\'s answer goes through withSuicideComfort after the patient\'s referral',
    /readerText = withPatientReferral\(readerText, questionText, audienceBand\);[\s\S]{0,200}readerText = withSuicideComfort\(readerText, questionText\);/.test(askSrc));
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-r2-7: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
