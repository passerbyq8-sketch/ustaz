// guards/batch-split-guard.cjs — د-١: رسالةٌ واحدةٌ مرقّمةٌ = أسئلةٌ مستقلّةٌ بعددِ بنودِها.
//
// العطبُ الذي وُجد هذا الحارسُ لأجله. من يلصقُ عشرين سؤالًا في رسالةٍ واحدةٍ كان يحصلُ على طلبٍ
// واحد: سياقٌ واحدٌ يُوجَّهُ مرّةً واحدةً، واسترجاعٌ واحدٌ يبحثُ عن موضوعٍ واحد، وسقفُ إخراجٍ واحدٌ
// يُقسَمُ على عشرين — فيخرجُ جوابٌ مشوَّشٌ يخلطُ المواضيعَ ويبترُ آخرَها. والعلاجُ عميليٌّ بحت:
// تُقسَمُ الرسالةُ عند حدودِ أسطرِها المرقّمة، ويأخذُ كلُّ بندٍ الأنبوبَ كاملًا في طلبٍ مستقلّ.
//
// ما الذي يُقاس، ولماذا ليس مسحًا للملفّ. تُنتزَعُ كتلةُ text/babel من index.html المشحونة، وتُحوَّلُ
// بنسخةِ Babel التي تُحمّلها الصفحةُ نفسُها، وتُنفَّذ؛ ثمّ تُقادُ الدالّةُ التي تشحنُها الصفحةُ حقًّا.
// تعبيرٌ نمطيٌّ يُطابَقُ على النصِّ كان سيثبتُ أنّ محارفَ موجودةٌ في مكانٍ ما، لا أنّ التقسيمَ يعمل.
//
// العقدُ المُثبَّتُ هنا:
//   ١. قائمةٌ مرقّمةٌ من عشرين بندًا ⟹ عشرون مقطعًا، حرفيًّا بالعدد وبالنصّ.
//   ٢. الترقيمُ العربيُّ (١. ٢. …) كاللاتينيّ، والفواصلُ الأربعةُ كلُّها (. ) - ـ).
//   ٣. رقمٌ في وسطِ السطرِ لا يقسّم.
//   ٤. سطرٌ مرقّمٌ واحدٌ لا يقسّم.
//   ٥. نصٌّ متعدّدُ الأسئلةِ بلا ترقيمٍ يمرُّ كما هو، بايتًا ببايت.
//   ٦. البنودُ الفارغةُ/البيضاءُ تُتخطّى بلا مقطعٍ فارغ.
//   ٧. التمهيدُ قبلَ البندِ الأوّلِ لا يُرمى.
//   ٨. الدالّةُ نقيّةٌ حتميّة: نفسُ الدخلِ يعطي نفسَ الخرجِ في كلِّ مرّة.
//
// أوفلاين وحتميّ: لا شبكةَ ولا نموذج.
// الاستعمال: node guards/batch-split-guard.cjs [--mutants] [--index <path>]

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');
const { parseHTML } = require('linkedom');

const ROOT = path.resolve(__dirname, '..');
const argIndex = process.argv.indexOf('--index');
// `--index` يُوجّهُ الحارسَ إلى نسخةٍ أخرى من الصفحة، وهو ما يجعلُ «التوأمَ المُمسوخَ» خارجَ الشجرةِ
// قابلًا للقيادة. البوّابةُ المسجّلةُ لا تمرّرُه، فالمقيسُ افتراضًا هو الصفحةُ المشحونةُ وحدَها.
const INDEX = argIndex > -1 && process.argv[argIndex + 1]
  ? path.resolve(process.argv[argIndex + 1])
  : path.join(ROOT, 'index.html');

let pass = 0;
let fail = 0;
const failures = [];

function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + label); return true; }
  fail++; failures.push(label);
  console.log('  FAIL  ' + label + (detail === undefined ? '' : '  |  ' + detail));
  return false;
}

// ── إقلاعُ كتلةِ العميلِ المشحونة (نفسُ نمطِ truncatedtag) ───────────────────
function bootClient(source) {
  const html = source === undefined ? fs.readFileSync(INDEX, 'utf8') : source;
  const openRe = /<script[^>]*type=["']text\/babel["'][^>]*>/i;
  const mOpen = openRe.exec(html);
  if (!mOpen) throw new Error('no text/babel block in index.html');
  const from = mOpen.index + mOpen[0].length;
  const rawCode = html.slice(from, html.indexOf('</script>', from));

  const babelSrc = (html.match(/<script[^>]*src=["']([^"']*@babel\/standalone[^"']*)["']/i) || [])[1] || '';
  const verMatch = babelSrc.match(/@babel\/standalone@(\d+)\./);
  const babelMajor = verMatch ? parseInt(verMatch[1], 10) : 8;
  const jsxRuntime = babelMajor >= 8 ? 'automatic' : 'classic';

  const transformed = babel.transformSync(rawCode, {
    presets: [['@babel/preset-react', { runtime: jsxRuntime }]],
    filename: 'babel-block.jsx',
    configFile: false, babelrc: false,
  }).code;

  const { window } = parseHTML('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
  try { if (!window.TextDecoder) window.TextDecoder = TextDecoder; } catch (e) {}
  try { if (!window.TextEncoder) window.TextEncoder = TextEncoder; } catch (e) {}
  try { if (!window.AbortController) window.AbortController = AbortController; } catch (e) {}
  try { window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); } catch (e) {}
  try { window.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; } catch (e) {}
  global.window = window; global.document = window.document; global.navigator = window.navigator;
  try { window.self = window; } catch (e) {}
  try { window.globalThis = window; } catch (e) {}
  const ctx = vm.createContext(window);
  const vendor = path.join(ROOT, 'vendor');
  for (const f of ['react.umd.js', 'react-dom.umd.js']) {
    vm.runInContext(fs.readFileSync(path.join(vendor, f), 'utf8'), ctx, { filename: f });
  }
  vm.runInContext('ReactDOM.createRoot = function () { return { render: function () {}, unmount: function () {} }; };', ctx);
  window.console.error = () => {};
  window.addEventListener('error', () => {});
  vm.runInContext(transformed, ctx, { filename: 'babel-block.jsx' });

  const grab = (expr) => {
    try { return vm.runInContext('(' + expr + ')', ctx, { filename: 'guard-api' }); }
    catch (e) { return undefined; }
  };
  return { grab };
}

// ── الفكسچرات ───────────────────────────────────────────────────────────────
// عشرون بندًا بمواضيعَ متنوّعةٍ تمثيليّة: عبادات، وعقيدة، وسيرة، ومعاملات، وقرآن، وأدب.
// النصُّ هو ما يُتوقَّعُ خروجُه حرفيًّا، والقائمةُ المرقّمةُ تُبنى منه أدناه — فلا يُكتَبُ المتوقَّعُ
// مرّتين ولا يُخفي خطأً مطبعيًّا اتّفاقَ نسختين.
const TWENTY = [
  'ما حكم صلاة الجماعة للرجال؟',
  'كيف أتوضأ إذا كان على يدي جبيرة؟',
  'ما الفرق بين الزكاة والصدقة؟',
  'هل يجوز صيام يوم السبت منفردًا؟',
  'ما معنى «الإحسان» في حديث جبريل؟',
  'كم عدد أركان الإسلام وما هي؟',
  'ما حكم بيع الذهب بالتقسيط؟',
  'متى نزلت سورة الفاتحة ولماذا سُمّيت بأمّ الكتاب؟',
  'كيف أحفظ القرآن وأنا مشغول بالدراسة؟',
  'ما حكم قراءة القرآن بغير وضوء من الجوال؟',
  'من هي أوّل من آمن برسول الله صلّى الله عليه وسلّم؟',
  'ما الحكمة من تحريم الربا؟',
  'هل تجب العمرة على من لم يحجّ بعد؟',
  'ما آداب الدعاء وأوقات إجابته؟',
  'كيف أبرّ والديّ بعد وفاتهما؟',
  'ما حكم تأخير قضاء رمضان إلى رمضان التالي؟',
  'ما الفرق بين السنّة المؤكّدة وسنّة العادة؟',
  'هل يجوز الاستثمار في الأسهم؟',
  'ما معنى «لا حول ولا قوّة إلّا بالله»؟',
  'كيف أعلّم ابني الصلاة بلا تنفير؟',
];

// ترقيمٌ عربيٌّ للبنودِ العشرين (١ … ٢٠) — لفكسچرِ الترقيمِ العربيّ.
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toArabic = (n) => String(n).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);

function runSuite(client, phase) {
  const split = client.grab('splitNumberedBatch');
  if (!ok(phase + ': المقسّمُ موجودٌ على الصفحةِ المشحونة', typeof split === 'function')) return;

  // ── ١. عشرون بندًا ⟹ عشرون مقطعًا حرفيًّا ────────────────────────────────
  const twentyMsg = TWENTY.map((q, i) => (i + 1) + '. ' + q).join('\n');
  const twenty = split(twentyMsg);
  ok(phase + ' [٢٠ بندًا] العددُ عشرون لا واحد',
    Array.isArray(twenty) && twenty.length === 20,
    'got ' + (Array.isArray(twenty) ? twenty.length : typeof twenty));
  if (Array.isArray(twenty) && twenty.length === 20) {
    ok(phase + ' [٢٠ بندًا] كلُّ مقطعٍ نصُّ سؤالِه حرفيًّا بلا رقمِه',
      twenty.every((seg, i) => seg === TWENTY[i]),
      JSON.stringify(twenty.find((seg, i) => seg !== TWENTY[i]) || '').slice(0, 120));
    ok(phase + ' [٢٠ بندًا] لا رقمَ ولا فاصلَ بقيَ في صدرِ أيِّ مقطع',
      twenty.every((seg) => !/^[ \t]*[0-9٠-٩]+[.)\-ـ]/.test(seg)));
  }

  // ── ٢. الترقيمُ العربيُّ يعملُ كاللاتينيّ، والفواصلُ الأربعةُ كلُّها ────────
  const arabicMsg = TWENTY.map((q, i) => toArabic(i + 1) + '. ' + q).join('\n');
  const arabic = split(arabicMsg);
  ok(phase + ' [ترقيمٌ عربيّ] عشرون مقطعًا كالإنجليزيّ تمامًا',
    Array.isArray(arabic) && arabic.length === 20 && arabic.every((s, i) => s === TWENTY[i]),
    'got ' + (Array.isArray(arabic) ? arabic.length : typeof arabic));

  for (const [sepName, sep] of [['نقطة', '.'], ['قوس', ')'], ['شرطة', '-'], ['تطويل', 'ـ']]) {
    const msg = '1' + sep + ' ' + TWENTY[0] + '\n2' + sep + ' ' + TWENTY[1] + '\n3' + sep + ' ' + TWENTY[2];
    const got = split(msg);
    ok(phase + ' [فاصل: ' + sepName + '] ثلاثةُ بنودٍ بنصوصِها',
      Array.isArray(got) && got.length === 3 && got[0] === TWENTY[0] && got[2] === TWENTY[2],
      JSON.stringify(got).slice(0, 140));
  }

  // الشرطةُ داخلَ صنفِ المحارفِ يجبُ أن تكونَ حرفًا لا مدًى. «٥٠ر.س» سطرٌ يبدأُ برقمٍ يليه حرفٌ
  // عربيٌّ يقعُ داخلَ المدى الوهميّ ()‏…‏ـ)، فلو عاد المدى لانقسمَ ما ليس بقائمة.
  const priceMsg = '٥٠ر.س سعرُ الكتابِ الأوّل\n٧٠ر.س سعرُ الثاني، فهل في هذا زكاة؟';
  const price = split(priceMsg);
  ok(phase + ' [رقمٌ يليه حرفٌ لا فاصل] لا تقسيم — الشرطةُ حرفٌ لا مدًى',
    Array.isArray(price) && price.length === 1 && price[0] === priceMsg,
    JSON.stringify(price).slice(0, 160));

  // ── ٣. رقمٌ في وسطِ السطرِ لا يقسّم ──────────────────────────────────────
  const midMsg = 'قرأتُ أنّ أركان الإسلام 5 أركان\nوسمعتُ أنّ الصلوات 5 صلوات، فهل هذا صحيح؟';
  const mid = split(midMsg);
  ok(phase + ' [رقمٌ في الوسط] لا تقسيم، والنصُّ كما هو بايتًا ببايت',
    Array.isArray(mid) && mid.length === 1 && mid[0] === midMsg,
    JSON.stringify(mid).slice(0, 160));

  // ── ٤. سطرٌ مرقّمٌ واحدٌ لا يقسّم ────────────────────────────────────────
  const oneMsg = 'عندي سؤال:\n1. ما حكم صلاة الوتر؟\nوجزاك الله خيرًا.';
  const one = split(oneMsg);
  ok(phase + ' [سطرٌ مرقّمٌ واحد] لا تقسيم، والرقمُ باقٍ في مكانِه',
    Array.isArray(one) && one.length === 1 && one[0] === oneMsg,
    JSON.stringify(one).slice(0, 160));

  // ── ٥. أسئلةٌ متعدّدةٌ بلا ترقيمٍ تمرُّ كما هي ───────────────────────────
  const plainMsg = 'ما حكم صلاة الجماعة؟ وهل تجبُ على المسافر؟ وماذا لو نام عن الفجر؟';
  const plain = split(plainMsg);
  ok(phase + ' [بلا ترقيم] رسالةٌ واحدةٌ لا تُمَسّ',
    Array.isArray(plain) && plain.length === 1 && plain[0] === plainMsg,
    JSON.stringify(plain).slice(0, 160));

  const plainLinesMsg = 'ما حكم صلاة الجماعة؟\nوهل تجبُ على المسافر؟\nوماذا لو نام عن الفجر؟';
  const plainLines = split(plainLinesMsg);
  ok(phase + ' [أسطرٌ بلا ترقيم] كسرُ السطرِ وحدَه لا يقسّم',
    Array.isArray(plainLines) && plainLines.length === 1 && plainLines[0] === plainLinesMsg,
    JSON.stringify(plainLines).slice(0, 160));

  // ── ٦. بنودٌ فارغةٌ/بيضاءُ تُتخطّى بلا مقطعٍ فارغ ────────────────────────
  const gappyMsg = '1. ' + TWENTY[0] + '\n2.\n3.    \n4. ' + TWENTY[3] + '\n5. \t \n6. ' + TWENTY[5];
  const gappy = split(gappyMsg);
  ok(phase + ' [بنودٌ فارغة] ثلاثةُ مقاطعَ لا ستّة',
    Array.isArray(gappy) && gappy.length === 3, 'got ' + (Array.isArray(gappy) ? gappy.length : typeof gappy));
  ok(phase + ' [بنودٌ فارغة] ولا مقطعَ فارغًا ولا أبيضَ بينها',
    Array.isArray(gappy) && gappy.every((s) => typeof s === 'string' && s.trim().length > 0)
      && gappy[0] === TWENTY[0] && gappy[1] === TWENTY[3] && gappy[2] === TWENTY[5],
    JSON.stringify(gappy).slice(0, 160));

  // وحين لا ينجو إلّا بندٌ واحدٌ فليست دفعةً أصلًا: تعودُ الرسالةُ كما كتبَها صاحبُها، برقمِها
  // وفراغِها — لا «بندًا» منزوعَ الرقمِ مقصوصَ الطرف. تغييرُ رسالةِ المستخدمِ بلا فائدةٍ ثمنٌ بلا مقابل.
  const loneMsg = '1. ' + TWENTY[0] + '\n2.\n3.   ';
  const lone = split(loneMsg);
  ok(phase + ' [بندٌ واحدٌ نجا] الرسالةُ تعودُ كما هي حرفيًّا، لا مقطعًا مُعاد الكتابة',
    Array.isArray(lone) && lone.length === 1 && lone[0] === loneMsg,
    JSON.stringify(lone).slice(0, 160));

  // ── ٧. التمهيدُ قبلَ البندِ الأوّلِ لا يُرمى ─────────────────────────────
  const preMsg = 'السلام عليكم، عندي أسئلة:\n1. ' + TWENTY[0] + '\n2. ' + TWENTY[1];
  const pre = split(preMsg);
  ok(phase + ' [تمهيد] بندان، والتمهيدُ محفوظٌ في أوّلِهما',
    Array.isArray(pre) && pre.length === 2
      && pre[0] === 'السلام عليكم، عندي أسئلة:\n' + TWENTY[0] && pre[1] === TWENTY[1],
    JSON.stringify(pre).slice(0, 200));

  // ── بندٌ متعدّدُ الأسطرِ يبقى بجسدِه كاملًا ──────────────────────────────
  const multiMsg = '1. ' + TWENTY[0] + '\nوأقصدُ في السفرِ خاصّةً\nولو كان المسجدُ بعيدًا\n2. ' + TWENTY[1];
  const multi = split(multiMsg);
  ok(phase + ' [بندٌ متعدّدُ الأسطر] أسطرُ الشرحِ تبقى مع بندِها حرفيًّا',
    Array.isArray(multi) && multi.length === 2
      && multi[0] === TWENTY[0] + '\nوأقصدُ في السفرِ خاصّةً\nولو كان المسجدُ بعيدًا'
      && multi[1] === TWENTY[1],
    JSON.stringify(multi).slice(0, 200));

  // لصقُ ويندوز يحملُ CRLF: الحدودُ نفسُها، وبقيّةُ السطرِ لا تحملُ \r معلّقًا في آخرِ البند.
  const crlf = split('1. ' + TWENTY[0] + '\r\n2. ' + TWENTY[1] + '\r\n3. ' + TWENTY[2]);
  ok(phase + ' [CRLF] ثلاثةُ بنودٍ نظيفةٍ من \\r',
    Array.isArray(crlf) && crlf.length === 3 && crlf.every((s) => !/[\r]/.test(s))
      && crlf[0] === TWENTY[0] && crlf[2] === TWENTY[2],
    JSON.stringify(crlf).slice(0, 160));

  // ── ٨. نقاءٌ وحتميّة ────────────────────────────────────────────────────
  const again = split(twentyMsg);
  ok(phase + ': الدالّةُ حتميّةٌ — نفسُ الدخلِ يعطي نفسَ الخرجِ',
    JSON.stringify(again) === JSON.stringify(twenty));
  ok(phase + ': الدخلُ نفسُه لم يُمَسّ (لا طفرةَ على المُدخَل)',
    twentyMsg === TWENTY.map((q, i) => (i + 1) + '. ' + q).join('\n'));
  for (const odd of ['', '   ', '\n\n', null, undefined, 42]) {
    const got = split(odd);
    ok(phase + ' [دخلٌ شاذّ: ' + JSON.stringify(odd) + '] مصفوفةٌ من عنصرٍ واحدٍ بلا رمي',
      Array.isArray(got) && got.length === 1, JSON.stringify(got));
  }
}

// ── المُسوخ ─────────────────────────────────────────────────────────────────
// كلٌّ منها يُعيدُ كتابةَ مصدرِ index.html في الذاكرة ويُلزمُ هذا الحارسَ بأن يلحظ. ومسخةٌ لا
// تُغيّرُ المصدرَ خطأٌ صريحٌ لا نجاحٌ صامت. والمقاطعُ سطريّةٌ عمدًا: الصفحةُ CRLF في الشجرةِ
// وLF في مخزنِ الكائنات، فأيُّ مِرساةٍ تعبرُ كسرَ سطرٍ تُطابقُ في نسخةٍ وتُخفقُ في أخرى.
function mutants() {
  console.log('\n--- C. REQUIRED MUTANTS ---');
  const original = fs.readFileSync(INDEX, 'utf8');

  const cases = [
    {
      // المسخةُ المطلوبةُ نصًّا: تعطيلُ التقسيمِ رأسًا — كلُّ رسالةٍ تعودُ رسالةً واحدة.
      name: 'disable-the-split',
      apply: (s) => s.replace('if (marks.length < 2) return [src];', 'if (marks.length < 999) return [src];'),
    },
    {
      // شبكةُ الأمانِ الأخيرةُ تسقط: رسالةٌ نجا منها بندٌ واحدٌ تعودُ «دفعةً» من بندٍ واحد،
      // فيُنزَعُ رقمُها ويُلحَقُ تمهيدُها ويُقصُّ طرفُها — أي تُغيَّرُ رسالةُ المستخدمِ بلا داعٍ.
      // (وليست هذه مسخةَ `marks.length < 2`: تلك مكافئةٌ سلوكيًّا لأنّ هذا السطرَ يبتلعُها.)
      name: 'lone-item-passes-through-rewritten',
      apply: (s) => s.replace('return out.length >= 2 ? out : [src];', 'return out.length >= 1 ? out : [src];'),
    },
    {
      // الشرطةُ تعودُ مدًى: «٥٠ر.س» وأمثالُها تصيرُ «بنودًا».
      name: 'dash-becomes-a-range-again',
      apply: (s) => s.replace('[.)\\-\\u0640]', '[.)-\\u0640]'),
    },
    {
      // البنودُ الفارغةُ تعودُ مقاطعَ: أسئلةٌ بيضاءُ تُرسَلُ إلى الخادم.
      name: 'empty-items-become-questions',
      apply: (s) => s.replace('if (!body.trim()) continue;', 'if (false) continue;'),
    },
    {
      // التمهيدُ يُرمى: نصٌّ كتبَه المستخدمُ يختفي صامتًا.
      name: 'preamble-silently-dropped',
      apply: (s) => s.replace("if (!out.length && preamble) body = preamble + '\\n' + body;", ''),
    },
    {
      // يسقطُ قصُّ الفراغِ الطرفيّ: المقاطعُ تحملُ أسطرًا فارغةً و\r فلا تعودُ حرفيّةً.
      name: 'no-trailing-trim',
      apply: (s) => s.replace(".replace(EZIK_BATCH_MARK, '').replace(/\\s+$/, '')", ".replace(EZIK_BATCH_MARK, '')"),
    },
  ];

  for (const c of cases) {
    const changed = c.apply(original);
    if (changed === original) {
      fail++; failures.push('MUTANT ' + c.name + ' seam moved');
      console.log('  FAIL  MUTANT ' + c.name + ': seam moved, mutation did not apply');
      continue;
    }
    let survived = true;
    const before = fail;
    try {
      const client = bootClient(changed);
      const split = client.grab('splitNumberedBatch');
      if (typeof split !== 'function') survived = false;
      else survived = surviveCheck(split);
    } catch (e) { survived = false; }
    fail = before;
    ok('MUTANT KILLED: ' + c.name, !survived, 'the defect was reintroduced and this gate stayed green');
  }
}

// الفحصُ الذي يجبُ أن يسقطَ تحت كلِّ مسخة: العقدُ كلُّه في نداءاتٍ قليلةٍ حاسمة.
function surviveCheck(split) {
  const twentyMsg = TWENTY.map((q, i) => (i + 1) + '. ' + q).join('\n');
  const twenty = split(twentyMsg);
  if (!Array.isArray(twenty) || twenty.length !== 20 || !twenty.every((s, i) => s === TWENTY[i])) return false;
  const oneMsg = 'عندي سؤال:\n1. ما حكم صلاة الوتر؟\nوجزاك الله خيرًا.';
  const one = split(oneMsg);
  if (!Array.isArray(one) || one.length !== 1 || one[0] !== oneMsg) return false;
  const crlf = split('1. ' + TWENTY[0] + '\r\n2. ' + TWENTY[1] + '\r\n3. ' + TWENTY[2]);
  if (!Array.isArray(crlf) || crlf.length !== 3 || !crlf.every((s, i) => s === TWENTY[i])) return false;
  const price = split('٥٠ر.س سعرُ الكتابِ الأوّل\n٧٠ر.س سعرُ الثاني، فهل في هذا زكاة؟');
  if (!Array.isArray(price) || price.length !== 1) return false;
  const gappy = split('1. ' + TWENTY[0] + '\n2.\n3.    \n4. ' + TWENTY[3] + '\n5. \t \n6. ' + TWENTY[5]);
  if (!Array.isArray(gappy) || gappy.length !== 3) return false;
  const loneMsg = '1. ' + TWENTY[0] + '\n2.\n3.   ';
  const lone = split(loneMsg);
  if (!Array.isArray(lone) || lone.length !== 1 || lone[0] !== loneMsg) return false;
  const pre = split('السلام عليكم، عندي أسئلة:\n1. ' + TWENTY[0] + '\n2. ' + TWENTY[1]);
  if (!Array.isArray(pre) || pre.length !== 2 || pre[0] !== 'السلام عليكم، عندي أسئلة:\n' + TWENTY[0]) return false;
  return true;
}

(function main() {
  console.log('=== batch-split-guard -- د-١: الرسالةُ المرقّمةُ تُقسَمُ إلى أسئلةٍ مستقلّة ===');
  console.log('    index: ' + INDEX);
  try {
    console.log('\n--- A/B. SHIPPED CLIENT, THE SPLITTER ---');
    runSuite(bootClient(), 'live');
    if (process.argv.includes('--mutants')) mutants();
  } catch (e) {
    console.error('GUARD ERROR:', e && e.stack ? e.stack : e);
    process.exit(1);
  }
  console.log('\n=== ' + pass + '/' + (pass + fail) + ' — ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ===');
  if (fail) { console.log('-- FAILURES --'); for (const f of failures) console.log('   ' + f); }
  process.exit(fail === 0 ? 0 : 1);
})();
