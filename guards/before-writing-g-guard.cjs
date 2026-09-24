// guards/before-writing-g-guard.cjs -- م٢-ز (BEFORE_WRITING_V1): speaker generalisation. On a
// before-writing fiqh turn no speaker is rewritten into «بعض أهل العلم»; the claim is the sentence
// door's, which keeps it, returns it to its source, or removes it and says no text was found.
//
// THE OWNER'S ITEM (program order 2026-09-24, م٢-ز): «تعميمُ القائل: قولُ أبي لهبٍ صارَ «وقال بعض أهل
// العلم» — يُقاسُ على الحارسِ (الصفّ ٣٠) ثمّ يُعالَج». MEASURED against the guard first
// (02-brain/measure/C): gate taghonesty pins r44/h46 — the generalisation of a named but unlicensed
// scholar, the Ibn al-Mundhir shape included (tag-honesty-guard.cjs:751-752) — and row 30 of table 111
// is still open. This item leaves every one of those pins as it is (the switch off is untouched) and
// changes the behaviour only where the sentence door now judges the claim.
//
// FIXTURES — the owner's live witnesses of 24 September (EZIK-ITEM32-OWNER-TEST-2026-09-24.md), each
// reproduced letter for letter offline by the measurement (C1b, C2, C3a, the zakat «مشهور» case), the
// madhhab name the M1 harness saw broken («فذهب الحنابلة إلى جواز» ⟶ «وذهب بعض أهل العلم جواز»), and
// Abū Lahab, whom the owner names.
//
// WHAT THIS PINS:
//   S1  with the policy, every witness passes the reviewer as it was written — no «بعض أهل العلم»;
//   S2  control: without it the old ladder still generalises (so S1 is not vacuous);
//   S3  the policy crosses lib/free-brain/review.js as the one literal 'keep', and nothing else;
//   S4  the sentence door knows a named scholar's statement as a claim, and never a narrated
//       non-scholar's («قال أبو لهب»);
//   S5  driven: a before-writing fiqh turn delivers «ابن قدامة» where the old tree delivered «بعض أهل العلم»;
//   S6  the switch off: the same draft is generalised as before.
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
const GENERAL = 'بعض أهل العلم';
const W = [
  ['W1-ahmad', 'قال الأثرم: قيل لأبي عبد الله — أي الإمام أحمد: في كم تقصر الصلاة؟\nقال: في أربعة برد.', 'قال: في أربعة برد'],
  ['W2-ibn-al-mundhir', 'ونقل ابن المنذر أن عامة العلماء يقولون: مسيرة يوم تام، ثم قال: «وبه نأخذ».', 'ثم قال: «وبه نأخذ»'],
  ['W3-ibn-qudama', 'وقال ابن قدامة رحمه الله في "المغني": مذهب أبي عبد الله أن القصر لا يجوز في أقل من ستة عشر فرسخا.', 'وقال ابن قدامة'],
  ['W4-hanabila', 'فذهب الحنابلة إلى جواز ذلك.', 'فذهب الحنابلة إلى جواز'],
  ['W5-mashhur', 'هذه مسألة فيها خلاف مشهور بين أهل العلم.\nفمنهم من قال: لا زكاة في الحلي المعد للبس.', 'فمنهم من قال: لا زكاة'],
  ['W6-abu-lahab', 'وقال أبو لهب: تبًّا لك سائر اليوم، ألهذا جمعتنا؟', 'وقال أبو لهب'],
];
const jsonResponse = (url, obj, { status = 200 } = {}) => ({
  ok: status >= 200 && status < 300, status, url: String(url),
  headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json'
    : String(h).toLowerCase() === 'content-length' ? String(Buffer.byteLength(JSON.stringify(obj), 'utf8')) : null) },
  json: async () => obj, text: async () => JSON.stringify(obj),
});

async function main() {
  console.log('before-writing-g guard — root ' + REPO);
  const OR = await esm('lib/output-reviewer.js');
  const REVIEW = await esm('lib/free-brain/review.js');
  const review = (text, speakerPolicy) => OR.reviewAnswer({ text, evidence: [], domain: 'fiqh', mode: 'chat', khilafFromOpinions: null, opinionCount: null, truncated: false, ...(speakerPolicy ? { speakerPolicy } : {}) });
  for (const [id, text, kept] of W) {
    const out = review(text, 'keep');
    ok(`S1  ${id}: with the policy the witness passes as written`, out.text.includes(kept) && !out.text.includes(GENERAL), out.text);
  }
  const old1 = review(W[0][1], null);
  const old6 = review(W[5][1], null);
  ok('S2  control: without the policy the old ladder still generalises (Aḥmad\'s answer, Abū Lahab)',
    old1.text.includes(GENERAL) && old6.text.includes(GENERAL), old1.text + ' | ' + old6.text);
  const viaSeam = await REVIEW.reviewAnswer({ text: W[2][1], evidence: [], domain: 'fiqh', mode: 'chat', speakerPolicy: 'keep' });
  const viaSeamJunk = await REVIEW.reviewAnswer({ text: W[2][1], evidence: [], domain: 'fiqh', mode: 'chat', speakerPolicy: 'KEEP ' });
  ok('S3  the policy crosses review.js as the one literal \'keep\' and nothing else',
    viaSeam.text.includes('وقال ابن قدامة') && viaSeamJunk.text.includes(GENERAL), viaSeam.text + ' | ' + viaSeamJunk.text);
  let RR = null;
  try { RR = await esm('lib/ruling-review.js'); } catch { RR = null; }
  ok('S4  the sentence door knows a named scholar\'s statement as a claim, and never Abū Lahab\'s',
    !!RR && RR.claimSentences(W[2][1]).some((c) => c.kinds.includes('scholar'))
    && !RR.claimSentences(W[5][1]).some((c) => c.kinds.includes('scholar')),
    RR ? JSON.stringify([RR.claimSentences(W[2][1]).map((c) => c.kinds), RR.claimSentences(W[5][1]).map((c) => c.kinds)]) : 'no module');

  const LOOP = await esm('lib/free-brain/loop.js');
  const CONTRACT = await esm('lib/fatwa-contract.js');
  const ENC = await esm('lib/encyclopedia.js');
  await quiet(() => ENC.searchStoredCorpus('القصر', { limit: 1 }));
  const scholars = CONTRACT.FATWA_SCHOLARS.map((entry) => ({ id: entry.id, snapshot: { records: entry.count } }));
  const drive = async (extra) => {
    const real = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (u.startsWith('https://provider.invalid')) {
        const body = JSON.parse(init.body);
        const sys = String(body.system || '');
        const text = sys === 'system' ? W[2][1] : sys.startsWith('أنتَ فاحصُ') ? '{"claims":[]}' : 'لا';
        return jsonResponse(u, { content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
      }
      return jsonResponse(u, {}, { status: 503 });
    };
    const fetchImpl = async (url) => {
      const u = String(url);
      if (u.startsWith(CONTRACT.FATWA_BASE + '/api/v1/')) {
        const p = new URL(u).pathname;
        if (p === '/api/v1/health') return jsonResponse(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, counts: { scholars: scholars.length } });
        if (p === '/api/v1/scholars') return jsonResponse(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, scholars });
        return jsonResponse(u, { ok: true, schemaVersion: CONTRACT.FATWA_SCHEMA, results: [], pagination: { total: 0 } });
      }
      if (u.startsWith('https://lib.ezik.app')) return jsonResponse(u, { hits: [], took_ms: 1, refused: false });
      return jsonResponse(u, {}, { status: 503 });
    };
    let out = null;
    try {
      out = await quiet(() => LOOP.runFreeBrainTurn(Object.assign({
        messages: [{ role: 'user', content: 'ما مسافة القصر عند الحنابلة؟' }],
        system: 'system', model: 'model', maxTokens: 512, effort: 'high', band: 'adult', mode: 'chat',
        lexicalRoute: 'DEEN', storedRuntime: 'STORED_FIQH',
        providerUrl: 'https://provider.invalid/v1/messages', headers: {}, env: {}, fetchImpl,
      }, extra)));
    } finally { globalThis.fetch = real; }
    return String(out && out.text || '');
  };
  const on = await drive({ beforeWriting: { libFlagValue: 'on', libToken: 'tk-guard-bw' } });
  ok('S5  driven under the switch: «ابن قدامة» reaches the reader, not «بعض أهل العلم»', on.includes('ابن قدامة') && !on.includes(GENERAL), on);
  const off = await drive({});
  ok('S6  the switch off: the same draft is generalised exactly as before', off.includes(GENERAL), off);
  console.log(`\n=== before-writing-g: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
