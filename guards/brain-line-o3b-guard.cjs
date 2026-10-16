// guards/brain-line-o3b-guard.cjs -- ITEM O3b (132) -- 2026-10-15 brain-line
//
// THE READER WHO IS NOT ARABIC SEES SOMETHING BEFORE THE END. Measured on 7ba44481 (side-brain-line-2026-10-15/items/
// 132.md): the language gate (lib/lang/gate.js) wrote nothing but keepalive comments until the inner handler had
// finished; the parallel translation (createSpeculator) was prepared and then shown only after the end, and the inner
// handler's own status frames were written last of all.
//
// What this guard holds (the order, O3b): a fake Arabic stream of three paragraphs through the real gate, the real
// speculator and the real translateAnswer, with a fake translator --
//   (1) the reader's first frame is ezik_status `translate`, and the inner handler's status passes at once;
//   (2) the first paragraph arrives translated BEFORE the third Arabic paragraph is complete;
//   (3) the order is kept, and nothing is shown twice.
'use strict';
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
const ascii = (s) => String(s).replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).slice(0, 400);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const G = await esm('lib/lang/gate.js');
  const A = await esm('lib/lang/answer.js');
  // Composed for this guard (the order names "three paragraphs"): plain prose, long enough to be speculated.
  const P = [
    'الفقرة الأولى من الجواب طويلة بما يكفي لتترجم وحدها فور اكتمالها.',
    'الفقرة الثانية من الجواب طويلة كذلك وتأتي بعد الأولى مباشرة في البث.',
    'الفقرة الثالثة والأخيرة من الجواب تكتمل بعد أن تصل الأولى مترجمة.',
  ];
  const EN = ['First paragraph of the answer.', 'Second paragraph of the answer.', 'Third and last paragraph of the answer.'];
  const english = (ar) => { const i = P.findIndex((p) => ar.includes(p.slice(0, 20))); return i >= 0 ? EN[i] : 'Other.'; };
  const fakeTranslate = async ({ user }) => {
    const arr = JSON.parse(String(user).split('INPUT:\n')[1]);
    return { ok: true, text: JSON.stringify(arr.map(english)) };
  };
  const frame = (e) => 'data: ' + JSON.stringify(e) + '\n\n';
  const delta = (t) => frame({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } });
  const res = { headers: {}, chunks: [], code: null, ended: false, on() {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; },
    flushHeaders() {}, write(c) { this.chunks.push(String(c)); return true; }, end(c) { if (c) this.chunks.push(String(c)); this.ended = true; } };
  let shownBeforeThird = null;
  const inner = async (req, r) => {
    r.status(200); r.setHeader('Content-Type', 'text/event-stream; charset=utf-8'); r.flushHeaders && r.flushHeaders();
    r.write(frame({ type: 'ezik_status', stage: 'retrieve' }));
    await sleep(30);
    r.write(delta(P[0] + '\n\n'));
    await sleep(80);
    r.write(delta(P[1] + '\n\n'));
    await sleep(80);
    shownBeforeThird = res.chunks.join('');
    r.write(delta(P[2]));
    r.write(frame({ type: 'message_stop' }));
    r.end();
  };
  await G.languageGate({ method: 'POST', headers: { 'x-ezik-lang': 'en' }, on() {}, body: { messages: [{ role: 'user', content: 'What is the ruling on prayer for a traveller?' }] } }, res, inner, {
    log() {}, speculate: true, translateImpl: fakeTranslate, translateQuestionImpl: async () => ({ ok: true, ms: 1 }),
    translateAnswerImpl: (arabic, o) => A.translateAnswer(arabic, { ...o, translate: fakeTranslate }),
  });
  const events = res.chunks.join('').split('\n\n').filter((f) => f.startsWith('data: ')).map((f) => { try { return JSON.parse(f.slice(6)); } catch { return null; } }).filter(Boolean);
  const text = events.filter((e) => e.type === 'content_block_delta').map((e) => e.delta.text).join('');
  console.log('-- 1. the first frames');
  ok('the reader\'s first frame is ezik_status translate', events[0] && events[0].type === 'ezik_status' && events[0].stage === 'translate', ascii(JSON.stringify(events.slice(0, 3))));
  const firstText = events.findIndex((e) => e.type === 'content_block_delta');
  const innerStatus = events.findIndex((e) => e.type === 'ezik_status' && e.stage === 'retrieve');
  ok('the inner handler\'s status passes at once (before any text), and only once', innerStatus > 0 && (firstText < 0 || innerStatus < firstText)
    && events.filter((e) => e.type === 'ezik_status' && e.stage === 'retrieve').length === 1, ascii(JSON.stringify(events.map((e) => e.type + ':' + (e.stage || '')))));
  console.log('-- 2. the first paragraph before the third is complete');
  ok('the first paragraph reached the reader translated before the third Arabic paragraph was written', !!shownBeforeThird && shownBeforeThird.includes(EN[0]), ascii(shownBeforeThird));
  console.log('-- 3. order, and nothing twice');
  const at = EN.map((e) => text.indexOf(e));
  ok('all three, in order', at.every((i) => i >= 0) && at[0] < at[1] && at[1] < at[2], ascii(text));
  ok('each once', EN.every((e) => text.split(e).length === 2), ascii(text));
  ok('no Arabic paragraph shown untranslated, and the stream ends', !P.some((p) => text.includes(p)) && res.ended === true && events[events.length - 1].type === 'message_stop');
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-o3b: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
