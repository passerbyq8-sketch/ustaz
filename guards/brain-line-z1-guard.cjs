// guards/brain-line-z1-guard.cjs -- ITEM Z1 (130) -- 2026-10-15 brain-line
//
// THE COMPOUND QUESTION. Measured on 7ba44481 (side-brain-line-2026-10-15/side/t130.md): issueParts found 0 parts in
// each of the four compound questions Q130a-d, so the whole was asked as one mashed query
// («اسيله الصيام سحب الدم للتحليل صايم استعمال قطره العين للصايم اكل شرب ناسيا»), and the writer said «لم أقف» once per
// part that the mash did not bring, in its own words, inside the answer.
//
// What this guard holds (the order, Z1):
//   (1) the new deterministic splitter: Q130a -> 3 parts, Q130b -> 2, Q130c -> 3, Q130d -> 2; the controls of t130.md as
//       they are (issueParts x4 -> 4, x2 -> 2, x0a -> 0, x0b -> 0; and the splitter leaves x0a, x0b, x4, x2 alone);
//   (2) each part is asked of the fatwas, the library, the encyclopedia and the lessons, with a cap per part;
//   (3) the judge and the writer see the parts, and the writer answers each under its short heading;
//   (4) a fake turn: a part with no rows -> the server's sentence «لم أقف على نصٍّ في <الجزء>.» once, the writer's own
//       sentence for it dropped, and the answer to the other part out.
// The four questions and the controls are copied from side-brain-line-2026-10-15/side/t130.md lines 5-12.
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

const Q = {
  Q130a: 'عندي أسئلة في الصيام: ما حكم سحب الدم للتحليل وهو صائم؟ وما حكم استعمال قطرة العين للصائم؟ وما حكم من أكل أو شرب ناسيا؟',
  Q130b: 'عندي سؤالان: ما حكم قطرة الأذن للصائم؟ وما حكم الحجامة للصائم؟',
  Q130c: 'عندي ثلاثة أسئلة في الصيام: ما حكم المضمضة للصائم؟ وما حكم تذوق الطعام للصائم؟ وما حكم شم الطيب للصائم؟',
  Q130d: 'عندي سؤالان في الزكاة: ما حكم زكاة الأسهم؟ وما حكم زكاة الدين على الغير؟',
  x4: 'ما شروط الصلاة وأركانها وواجباتها وسننها؟',
  x2: 'الأضحية: وقتها وشروطها',
  x0a: 'ما حكم الصلاة والصيام للمسافر؟',
  x0b: 'ما حكم الجمع بين الصلاتين وما شروطه ومتى يجوز؟',
};

(async () => {
  const BW2 = await esm('lib/before-writing-v2.js');
  console.log('-- 1. the splitter');
  const qp = typeof BW2.questionParts === 'function' ? BW2.questionParts : () => [];
  for (const [id, n] of [['Q130a', 3], ['Q130b', 2], ['Q130c', 3], ['Q130d', 2]]) {
    const parts = qp(Q[id]);
    ok(id + ' -> ' + n + ' parts', parts.length === n, ascii(JSON.stringify(parts.map((p) => p.text))));
  }
  const a = qp(Q.Q130a);
  ok('each part is its own question, with a short title and its own query', a.length === 3 && a[0].title === 'حكم سحب الدم للتحليل وهو صائم'
    && a.every((p) => p.text && p.title && p.query) && a[2].query.includes('الصيام'), ascii(JSON.stringify(a)));
  for (const [id, n] of [['x4', 4], ['x2', 2], ['x0a', 0], ['x0b', 0]]) {
    ok('control ' + id + ': issueParts -> ' + n + ' as in t130.md', BW2.issueParts(Q[id]).length === n);
    ok('control ' + id + ': the splitter leaves it alone', qp(Q[id]).length === 0);
  }
  ok('at most five parts', qp('عندي أسئلة: ما حكم أ ب؟ وما حكم ج د؟ وما حكم هـ و؟ وما حكم ز ح؟ وما حكم ط ي؟ وما حكم ك ل؟').length === 5);
  // guards/speed-bw2-guard.cjs Q1 (its C6f pins the released bytes): a follow-up that points back is the same question.
  ok('a short follow-up pointing back is not a part («أين ورد حديث: الدين النصيحة؟ ومن رواه؟»)', qp('أين ورد حديث: الدين النصيحة؟ ومن رواه؟').length === 0);
  ok('an enumeration is a compound question', qp('أولا: ما حكم صلاة الوتر؟ ثانيا: ما وقت صلاة الضحى').length === 2);

  console.log('-- 2/3/4. a fake turn through the real runBw2Turn');
  {
    const SSE = await esm('lib/finalized-sse-writer.js');
    const target = () => ({ writes: [], ended: 0, headers: {}, statusCode: 200, headersSent: false,
      write(c) { this.headersSent = true; this.writes.push(String(c)); return true; }, end() { this.ended += 1; return this; },
      status(c) { this.statusCode = c; return this; }, setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; return this; },
      getHeader(k) { return this.headers[String(k).toLowerCase()]; }, flushHeaders() { this.headersSent = true; },
      once() { return this; }, on() { return this; }, removeListener() { return this; } });
    const framesOf = (writes) => writes.join('').split('\n\n').filter((f) => f.startsWith('data: '))
      .map((f) => { try { return JSON.parse(f.slice(6)); } catch { return null; } }).filter(Boolean);
    const Qb = Q.Q130b;
    // The fatwa store answers the first part (ear drops) and nothing else; every other source is empty.
    const EAR = 'قطرة الأذن لا تفطر الصائم على الصحيح لأن الأذن ليست منفذا إلى الجوف.';
    const asked = [];
    // The real tools add their rows to the member's private table (lib/before-writing-v2.js member()); so does this one.
    const runTool = async (name, input, own) => {
      asked.push(name + ':' + String(input && input.query || ''));
      const q = String(input && input.query || '');
      if (name === 'search_fatawa' && /الاذن|الأذن/.test(q)) {
        own.table.add({ kind: 'fatwa', url: 'https://binbaz.org.sa/fatwas/1', title: 'حكم قطرة الأذن للصائم', publisher: 'ابن باز', passage: EAR, text: EAR });
      }
      return { text: '', calls: 1 };
    };
    const bodies = [];
    let judgeUser = '';
    const t = target();
    const facade = SSE.createFinalizedSseResponse(t, { finalize: (input) => ({ ok: true, text: String(input.text || ''), problems: [] }) });
    const WRITER = '### حكم قطرة الأذن للصائم\nقطرة الأذن لا تفطر الصائم على الصحيح [[1]].\n\nولم أقف على نص في حكم الحجامة للصائم في النصوص المذكورة.';
    const out = await BW2.runBw2Turn({
      question: Qb, messages: [{ role: 'user', content: Qb }], wire: BW2.createBw2Wire(facade), libFlagValue: 'on', libToken: 't', lessonsToken: 't',
      deps: {
        runTool, searchStoredCorpus: async () => ({ records: [] }), encyclopediaReady: () => true, warmEncyclopedia: () => true,
        ask: async (o) => { judgeUser = String(o && (o.user || o.prompt) || ''); return '{"d":{"1":1}}'; },
        callWriter: async ({ body, onText }) => { bodies.push(body); onText(WRITER); return { stop_reason: 'end_turn', usage: {} }; },
      },
    });
    const text = framesOf(t.writes).filter((f) => f.type === 'content_block_delta').map((f) => f.delta.text).join('');
    const parts = qp(Qb);
    ok('each part was asked of the fatwas, the library and the lessons (the encyclopedia by searchStoredCorpus)', parts.length === 2
      && parts.every((p) => asked.some((x) => x.startsWith('search_fatawa:') && x.includes(p.fatwaQuery)) && asked.some((x) => x === 'search_library:' + p.query) && asked.some((x) => x === 'search_lessons:' + p.query)),
      ascii(JSON.stringify(asked)));
    ok('the judge sees the parts', parts.every((p) => judgeUser.includes(p.text)), ascii(judgeUser.slice(0, 300)));
    const writerText = bodies[0] ? JSON.stringify(bodies[0].messages) : '';
    ok('the writer sees the parts: a heading for the covered one, the empty one left to the server', writerText.includes('حكم قطرة الأذن للصائم') && writerText.includes('حكم الحجامة للصائم') && writerText.includes('###'),
      ascii(writerText.slice(-600)));
    const SENTENCE = 'لم أقف على نصٍّ في حكم الحجامة للصائم.';
    ok('the server writes the empty part\'s sentence, once', text.split(SENTENCE).length === 2, ascii(text));
    ok('...the writer\'s own sentence for it is dropped', !text.includes('ولم أقف على نص في حكم الحجامة'), ascii(text));
    ok('...and the covered part is answered under its heading', text.includes('### حكم قطرة الأذن للصائم') && text.includes('قطرة الأذن لا تفطر'), ascii(text));
    ok('...the whole-answer not-covered sentence is not written (one part was covered)', !text.includes(BW2.BW2_NOT_COVERED));
    ok('...telemetry counts the parts and the empty ones', out && out.telemetry && out.telemetry.parts === 2 && out.telemetry.emptyParts === 1, ascii(JSON.stringify(out && out.telemetry && { p: out.telemetry.parts, e: out.telemetry.emptyParts })));
  }
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-z1: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
