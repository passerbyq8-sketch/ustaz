// guards/full-answer-e-guard.cjs -- م٣-هـ (FULL_ANSWER_V1): the answer does not narrate its own
// machinery: no «لا حاجة لبحث», no «سأجمع/سأبحث» in place of an answer, no «المادة المتاحة» or «ما
// وجدته في … هو», and the takhrij pass's own sentences say «لم أقف» instead of «المكتبة… بحثنا».
//
// THE OWNER'S ITEM (program order 2026-09-24, م٣-هـ): «ما وجدته في الموسوعة الفقهية الكويتية…» · «فلا
// حاجة لبحث فيه» · «المكتبة… بحثنا»; his item-32 file adds four more. MEASURED before it was built
// (03-answer/measure/D-mechanism.md): all seven witnesses passed `deliverableText` whole.
//
// WHAT THIS PINS:
//   E1  each witness, with an answer line after it, comes out as measured;
//   E2  the controls: a sentence that promises AND answers, an ordinary answer, and fenced code are
//       delivered byte for byte; an answer the rules would empty is returned as it came;
//   E3  in the loop: with the switch on the write's machinery sentence is gone and the size is
//       logged; off, it is delivered as before;
//   E4  the pass's own sentences: «لم أقف…» with the switch on, today's wording off.
// Red on the tree before this item: `node guards/full-answer-e-guard.cjs --root <tree>`.
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
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 600) : ''));
  return false;
}
async function quiet(fn) {
  const saved = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  console.log = () => {}; console.warn = () => {}; console.error = () => {}; console.info = () => {};
  try { return await fn(); } finally { Object.assign(console, saved); }
}
const jsonResponse = (url, obj) => ({
  ok: true, status: 200, url: String(url),
  headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
  json: async () => obj, text: async () => JSON.stringify(obj),
});

async function main() {
  console.log('full-answer-e guard — root ' + REPO);
  const LOOP = await esm('lib/free-brain/loop.js');
  const T = await esm('lib/takhrij.js');
  const clean = typeof LOOP.withoutMechanismTalk === 'function' ? LOOP.withoutMechanismTalk : (x) => x;
  const TAIL = 'الزكاة واجبة في الذهب إذا بلغ النصاب.';
  const cases = [
    ['W1', 'هذا سؤال عملي بحت لا علاقة له بمسألة شرعية، فلا حاجة لبحث فيه. إليك الخطوات:', 'إليك الخطوات:'],
    ['W2', 'سأجمع لك المسألة من مصادرها الموثوقة قبل أن أعرضها عليك، فهذا موضوع واسع يحتاج دقة في كل تفصيلة.', ''],
    ['W3', 'سأبحث في المسائل المتبقية: زكاة الأسهم، والرواتب المدخرة، والحلي، ونصاب الإبل بالتفصيل.', ''],
    ['W4', 'وقد اختلف الفقهاء في زكاتها على اتجاهات، فذهب الشافعية والحنابلة إلى أنها كالعروض؛ ونص المادة المتاحة انقطع عند هذا الحد فلم أقف على تمام بقية الاتجاهات فيه.',
      // D4 S3: the cutoff goes, but the honest statement of missing detail must now remain.
      'وقد اختلف الفقهاء في زكاتها على اتجاهات، فذهب الشافعية والحنابلة إلى أنها كالعروض؛ فلم أقف على تمام بقية الاتجاهات فيه.'],
    ['W5', 'ولم أقف في المراجع المتاحة على نص صريح في مقدار نصابها (الخمسة الأوسق) ولا في خلاف الفقهاء في الأصناف التي تجب فيها.',
      'ولم أقف على نص صريح في مقدار نصابها (الخمسة الأوسق) ولا في خلاف الفقهاء في الأصناف التي تجب فيها.'],
    ['W7', 'ما وجدته في الموسوعة الفقهية الكويتية هو تعريف فقهي عام لصلاة الضحى، لا نص كلام الإمام النووي بعينه من كتابه المجموع.',
      'في الموسوعة الفقهية الكويتية تعريف فقهي عام لصلاة الضحى، لا نص كلام الإمام النووي بعينه من كتابه المجموع.'],
    ['Q09', 'ما وجدتُه هو مادّةٌ من الموسوعة الفقهية الكويتية تتحدّث عن طالب العلم وفضله.',
      'مادّةٌ من الموسوعة الفقهية الكويتية تتحدّث عن طالب العلم وفضله.'],
  ];
  const got = cases.map(([id, w, want]) => {
    const out = clean(w + '\n\n' + TAIL);
    const expect = want ? want + '\n\n' + TAIL : TAIL;
    return { id, ok: out === expect, out };
  });
  ok('E1  every witness comes out as measured (R1 R2 R3 R5 R4 R7)', got.every((g) => g.ok),
    JSON.stringify(got.filter((g) => !g.ok)));

  // ── E2 controls ───────────────────────────────────────────────────────────
  const both = 'سأتحقق من المدة، والجمع للمسافر جائز عند الحاجة.';
  const plain = 'صلاة الضحى سنة، ووقتها من ارتفاع الشمس إلى قبيل الزوال.\n\n- ركعتان في أقلها.';
  const fenced = '```\nسأبحث في المصادر المتاحة\n```\n' + TAIL;
  const alone = 'سأبحث لك في المصادر المتاحة.';
  ok('E2  a promise that answers, an ordinary answer and fenced code are untouched; an emptied answer comes back as it was',
    typeof LOOP.withoutMechanismTalk === 'function'
    && clean(both) === both && clean(plain) === plain && clean(fenced) === fenced && clean(alone) === alone,
    JSON.stringify({ both: clean(both), fenced: clean(fenced) }));

  // ── E3 in the loop ────────────────────────────────────────────────────────
  const W1 = cases[0][1];
  const drive = async (extra) => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url) => jsonResponse(url, {
      content: [{ type: 'text', text: W1 + '\n1. افتح ملفًا جديدًا.\n2. اكتب اسمك في أعلاه.' }],
      stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 40 },
    });
    try {
      return await quiet(() => LOOP.runFreeBrainTurn(Object.assign({
        messages: [{ role: 'user', content: 'كيف أكتب سيرة ذاتية؟' }],
        system: 'system', model: 'model', maxTokens: 512, band: 'adult', mode: 'chat', lexicalRoute: 'GENERAL',
        providerUrl: 'https://provider.invalid/v1/messages', headers: {}, env: {},
        fetchImpl: async (u) => jsonResponse(u, {}),
      }, extra)));
    } finally { globalThis.fetch = realFetch; }
  };
  const on = await drive({ fullAnswer: { startedAt: Date.now() } });
  const off = await drive({});
  ok('E3  in the loop: the machinery sentence is gone and its size logged; off, delivered as before',
    !String(on.text || '').includes('لا حاجة لبحث') && String(on.text || '').includes('إليك الخطوات')
    && (on.degraded || []).some((d) => /^mechanism_dropped:\d+$/u.test(d))
    && String(off.text || '').includes('لا حاجة لبحث'),
    JSON.stringify({ on: on.text, off: off.text, degraded: on.degraded }));

  // ── E4 the pass's own sentences ──────────────────────────────────────────
  const MATN = 'من صام يوم عرفة غفر له ذنب سنتين متتابعتين';
  const answer = `قال رسول الله صلى الله عليه وسلم: «${MATN}».`;
  const question = `ما صحة حديث «${MATN}»؟`;
  const empty = async (matns) => matns.map((m) => ({ matn: m, subjectIds: [], atoms: [] }));
  const hOn = await T.applyTakhrij(answer, { env: { TAKHRIJ_V1: 'on', FULL_ANSWER_V1: 'on' }, lookup: empty, question });
  const hOff = await T.applyTakhrij(answer, { env: { TAKHRIJ_V1: 'on' }, lookup: empty, question });
  ok('E4  the pass\'s own head: «لم أقف…» with the switch on, today\'s «المكتبة… بحثنا» off',
    String(hOn.gradingHead) === T.GRADING_HEAD_NOT_PROVED_OWN && !/المكتبة|بحثنا/u.test(String(hOn.text))
    && String(hOff.gradingHead) === T.GRADING_HEAD_NOT_PROVED,
    JSON.stringify({ on: hOn.gradingHead, off: hOff.gradingHead }));

  console.log(`\n=== full-answer-e: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); console.log('\n=== full-answer-e: crashed ==='); process.exit(1); });
