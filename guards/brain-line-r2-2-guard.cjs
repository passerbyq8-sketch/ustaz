// guards/brain-line-r2-2-guard.cjs -- ITEM r2-2 (O3b follow-up) -- 2026-10-17 brain-line R2
//
// THE EARLY PARAGRAPH IS NOT PRINTED TWICE. Measured on the preview of fa778c0e (sessions/side-brain-fix-2026-10-15/
// EZIK-EXT-PREVIEW-TEST-REPORT-2026-10-17.txt line 249, F1 «What are the pillars of Islam?»: "The whole opening paragraph is
// printed twice in a row"; line 284, G2: "The paragraph is printed twice here too"). Rebuilt in the O3b harness (the real
// gate, the real speculator, the real translateAnswer, a fake translator): with small deltas, status frames between them,
// a hadith card after the first paragraph, an ezik_lessons frame last, "\n\n" and "\r\n\r\n" separators, the shown prefix
// was the final Arabic's byte for byte every time; the opening came out twice only when the Arabic itself carried it twice
// in a row (the speculator gives both the same translation). The R2 order's three fixes are held here:
//   (1) the prefix is matched NORMALIZED (white space, tashkeel and [[n]] markers do not count), and the rest is seeded;
//   (2) a prefix not found: the whole is translated, but no translated paragraph equal to one shown early goes out again;
//   (3) the text that reached the reader has no two consecutive paragraphs equal after normalization.
// The existing guards/brain-line-o3b-guard.cjs is not touched.
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

// Composed for this guard (no Arabic answer text of F1/G2 is in the report): plain prose, long enough to be speculated.
const P1 = 'أركان الإسلام خمسة كما جاء في الحديث الصحيح عن النبي صلى الله عليه وسلم.';
const P2 = 'وهذه الأركان هي التي يقوم عليها بناء الإسلام كله ولا يصح إلا بها.';
const P3 = 'والركن الأول الشهادتان وهما مفتاح الدخول في الإسلام.';
const HADITH = '<hadith source="x">بني الإسلام على خمس</hadith>';
const hash = (w) => { let h = 7; for (const c of w) h = (h * 31 + c.charCodeAt(0)) % 9973; return 'w' + h; };
const tr = (s) => s.replace(/[؀-ۿً-ْ]+/g, hash);
const fakeTranslate = async ({ user }) => { const arr = JSON.parse(String(user).split('INPUT:\n')[1]); await sleep(5); return { ok: true, text: JSON.stringify(arr.map(tr)) }; };
const frame = (e) => 'data: ' + JSON.stringify(e) + '\n\n';
const delta = (t) => frame({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } });
const key = (s) => String(s).replace(/[\sـً-ْ]/gu, '').toLowerCase();

async function through(G, A, units, spy) {
  const res = { chunks: [], ended: false, on() {}, setHeader() {}, status() { return this; }, flushHeaders() {}, write(c) { this.chunks.push(String(c)); return true; }, end(c) { if (c) this.chunks.push(String(c)); this.ended = true; } };
  const logs = [];
  const inner = async (req, r) => {
    r.status(200); r.setHeader('Content-Type', 'text/event-stream; charset=utf-8'); r.flushHeaders();
    r.write(frame({ type: 'ezik_status', stage: 'retrieve' }));
    for (const u of units) {
      if (u.status) { r.write(frame({ type: 'ezik_status', stage: u.status })); continue; }
      for (let i = 0; i < u.length; i += 7) r.write(delta(u.slice(i, i + 7)));
      await sleep(40);
    }
    r.write(frame({ type: 'ezik_lessons', rows: [] })); r.write(frame({ type: 'message_stop' })); r.end();
  };
  await G.languageGate({ method: 'POST', headers: { 'x-ezik-lang': 'en' }, on() {}, body: { messages: [{ role: 'user', content: 'What are the pillars of Islam?' }] } }, res, inner, {
    log: (...a) => logs.push(String(a[0])), speculate: true, translateImpl: fakeTranslate, translateQuestionImpl: async () => ({ ok: true, ms: 1 }),
    translateAnswerImpl: (arabic, o) => { if (spy) spy.push({ arabic, seed: o.seed || null }); return A.translateAnswer(arabic, { ...o, translate: fakeTranslate }); },
  });
  const ev = res.chunks.join('').split('\n\n').filter((f) => f.startsWith('data: ')).map((f) => { try { return JSON.parse(f.slice(6)); } catch { return null; } }).filter(Boolean);
  return { text: ev.filter((e) => e.type === 'content_block_delta').map((e) => e.delta.text).join(''), logs, ev };
}
const consecutiveEqual = (text) => { const ps = String(text).split(/\n\s*\n/).map(key).filter((k) => k.length >= 12); return ps.some((k, i) => i > 0 && k === ps[i - 1]); };

(async () => {
  const G = await esm('lib/lang/gate.js');
  const A = await esm('lib/lang/answer.js');
  console.log('-- 0. the measured cause (the hypothesis of the order)');
  {
    const spy = [];
    const r = await through(G, A, [P1 + '\r\n\r\n', { status: 'write' }, HADITH, '\r\n\r\n' + P2 + '\n\n', P3], spy);
    ok('a BW2-like stream (CRLF separators, status frames, a card): the prefix matches, no "differs" log, P1 once',
      !r.logs.some((l) => /differs/.test(l)) && r.text.split(tr(P1)).length === 2, ascii(r.text));
    ok('...and the end translates only the rest, seeded', spy.length === 1 && !spy[0].arabic.includes(P1) && !!spy[0].seed, ascii(JSON.stringify(spy.map((s) => s.arabic.slice(0, 40)))));
  }
  console.log('-- 1. the normalized prefix');
  const match = typeof G.matchEarlyPrefix === 'function' ? G.matchEarlyPrefix : () => -1;
  const FULL = P1 + '\r\n\r\n' + P2;
  ok('a byte prefix is found where it ends', match(FULL, P1) === P1.length);
  ok('a prefix that differs only by white space is found', match(FULL, P1.replace(/ /g, '  ') + '\n\n') >= P1.length && FULL.slice(match(FULL, P1.replace(/ /g, '  ') + '\n\n')).trim() === P2,
    String(match(FULL, P1.replace(/ /g, '  ') + '\n\n')));
  ok('a prefix that differs only by a [[n]] marker or tashkeel is found', match(P1.replace('خمسة', 'خمسةٌ [[1]]') + '\n\n' + P2, P1) > 0
    && (P1.replace('خمسة', 'خمسةٌ [[1]]') + '\n\n' + P2).slice(match(P1.replace('خمسة', 'خمسةٌ [[1]]') + '\n\n' + P2, P1)).trim() === P2);
  ok('a different text is not a prefix (-1)', match(FULL, P2) === -1);
  console.log('-- 2. not found: what was shown does not go out again');
  const guardOf = typeof G.createOnceEmitter === 'function' ? G.createOnceEmitter : null;
  {
    const out = [];
    const em = guardOf ? guardOf((s) => out.push(s)) : (s) => out.push(s);
    const write = em.write || em;
    write(tr(P1)); if (em.markShown) em.markShown(tr(P1)); if (em.strict) em.strict();
    write('\n\n'); write(tr(P1)); write('\n\n'); write(tr(P2)); write('\n\n'); write(tr(P1).replace(/ /g, '  '));
    const text = out.join('');
    ok('a paragraph equal (normalized) to one shown early is not emitted again', text.split(tr(P1)).length === 2 && !text.includes(tr(P1).replace(/ /g, '  ')) && text.includes(tr(P2)), ascii(text));
  }
  console.log('-- 3. through the real gate: the Arabic carries the opening twice in a row');
  {
    const r = await through(G, A, [P1 + '\n\n', P1 + '\n\n', P2 + '\n\n', P3]);
    ok('the opening reaches the reader once', r.text.split(tr(P1)).length === 2, ascii(r.text));
    ok('no two consecutive paragraphs equal after normalization', !consecutiveEqual(r.text), ascii(r.text));
    ok('...and the rest is all there, in order', r.text.indexOf(tr(P2)) > r.text.indexOf(tr(P1)) && r.text.indexOf(tr(P3)) > r.text.indexOf(tr(P2)));
  }
  {
    const r = await through(G, A, [P1 + '\n\n', P2 + '\n\n', P3]);
    ok('control: an ordinary answer is untouched (three paragraphs, each once)', [P1, P2, P3].every((p) => r.text.split(tr(p)).length === 2), ascii(r.text));
  }
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-r2-2: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
