# EZIK — تقريرُ توقّفِ البند ٣٦: حارسٌ يسمّي نمطَ الشاشةِ القديمة

**٢٤ أغسطس ٢٠٢٦ · قياسٌ وتنفيذٌ متوقّفٌ بأمر §١-٤ · صفرُ دفع**

## ٠ · النتيجةُ أوّلًا

وجد القياسُ السابقُ لأي تعديل أن `theme-coverage-guard.cjs:873` يسمّي
`adhkarContainer`، وهو مفتاحُ نمطٍ خاصٌّ بالشاشة القديمة المطلوب نزعُها. وليس الذكرُ
تعليقًا خامدًا؛ فالكائن `SCREENS` يُقرأ في الحلقة عند الأسطر `884-887`، وتطلب الحلقة
وجودَ النمط ثم تقيس خلفيتَه.

النص المقيس في الحارس:

```js
  'adhkar (v1)': 'adhkarContainer',
```

لذلك انطبق أمر §١-٤: **توقّف التنفيذ، ولم يُمسّ الحارس**. لم تُعدّل الشيفرة، ولم
يُبنَ `app.js`، ولم يُنشأ أيٌّ من الإيداعين، ولم تُشغّل بوابات ما بعد الإيداع. الملف
الحاضر هو تقرير التوقف وحده.

## ١ · الهويةُ والحالة

| الحقل | القيمة المقيسة |
|---|---|
| الشجرة | `C:\Users\passe\projects\ustaz` |
| الفرع | `feat/wird-khatmah-20260824` |
| الرأس | `4e26fffcaa00275753311f4a6c300d88ca6924b9` (`4e26fff`) |
| الأساس المطلوب | مطابق للرأس |
| الحالة قبل القياس | لا فرق في ملف متعقّب؛ ١١ ملفًا غير متعقّب سابقًا، تُركت كلّها |
| إيداع النزع | **لم يُنشأ**؛ لا ملفات مسّها |
| إيداع النثر | **لم يُنشأ**؛ لا ملفات مسّها |
| الدفع والنشر | **صفر** |

## ٢ · جوابُ §١ الخمسة

### ٢-١ · جهازُ راية الأذكار اليوم

أعيد القياس من `app.jsx` الحالي، ولم تُستعمل أرقام التقرير السابق:

| الجزء | الموضع الحالي | الأسطر | بايتات UTF-8، مع LF الختامي |
|---|---|---:|---:|
| مفتاح الجهاز وقارئ URL/`localStorage` الخامل | `app.jsx:5498-5508` | 11 | 547 |
| الثابت المثبّت على `true` | `app.jsx:5528` | 1 | 30 |
| المبدّل بين الشاشتين | `app.jsx:6597-6599` | 3 | 138 |
| **الجهاز كله** | المقاطع الثلاثة أعلاه | **15** | **715** |

المعامل هو `adhkarui`، ومفتاح الجهاز هو `adhkar_ui_v2`، والقارئ هو
`readAdhkarUiFlag`، والثابت هو `ADHKAR_UI_V2_ON`. البحث الدقيق وجد تعريف القارئ
وتعليقات تصفه، ولم يجد استدعاءً له. الثابت له مصرف واحد في مبدّل `AdhkarScreen`.
المناظر المشحون موجود في `app.js:1695-1697,1716,2033`.

### ٢-٢ · الشاشة القديمة وأنماطها

| الجزء | الموضع الحالي | الأسطر | بايتات المصدر | بايتات المناظر المشحون المقيسة |
|---|---|---:|---:|---:|
| `AdhkarScreenV1` | `app.jsx:5935-5999` | 65 | 2,873 | 2,765 |
| مفاتيح النمط الخاصة | `app.jsx:17802-17811` | 10 | 1,540 | 1,360 |

المناظر المشحون للشاشة يبدأ في `app.js:1877`، ومفاتيح النمط مجتمعة في
`app.js:5477`. `app.js` كله بقي 1,057,624 بايت.

### ٢-٣ · المستدعون في كل الشجرة

بُحثت الأسماء الدقيقة في كل الشجرة خارج `.git` و`node_modules` و`vendor`:

- `readAdhkarUiFlag` لا مستدعي له؛ وروداته تعريفٌ وتعليقاتٌ ومناظر البناء فقط.
- `ADHKAR_UI_V2_ON` مستهلكه البرمجي الوحيد مبدّل `AdhkarScreen` المطلوب نزعه معه.
- `AdhkarScreenV1` مستهلكه البرمجي الوحيد ذلك المبدّل.
- تسعة مفاتيح نمط قديمة لا تخرج عن الشاشة وتعريفات النمط ومناظر البناء.
- **الاستثناء الحاسم:** `adhkarContainer` له ذكرٌ آخر في
  `theme-coverage-guard.cjs:873`. هذا ذكرٌ تنفيذي يقرؤه الحارس، لا سجلٌ تاريخي.
- التقرير السابق `EZIK-CX-36-SPEED-ROLLBACK-2026-08-24.md` يحمل أسماء تاريخية؛
  سُمّي هنا ولم يُعدّ مستدعيًا.

وبقاعدة الأمر «معرّف له مستدعٍ واحد لا يُحذف»، لم يُحذف `adhkarContainer`، ثم أوقف
§١-٤ النزع كله.

### ٢-٤ · هل يذكر حارس شيئًا من المنزوع؟

**نعم.** الموضع `theme-coverage-guard.cjs:873`، والسياق الفعّال هو:

```js
const SCREENS = {
  // ...
  'adhkar (v1)': 'adhkarContainer',
  'adhkar (v2)': 'adhkar2Container',
  // ...
};
for (const label of Object.keys(SCREENS)) {
  const key = SCREENS[label];
  const st = s[key];
  if (!ok('screen present: ' + label + ' (' + key + ')', !!st)) continue;
```

لم يُمسّ الحارس بحرف. هذه النتيجة تكذّب الفرضية الأوسع اللازمة للنزع، وهي أن لا
حارس يسمّي الشاشة القديمة أو أنماطها. أما العبارة الأضيق في تقرير كودكس، التي حصرت
البحث في أسماء المعامل والمفتاح والثابت، فتبقى صحيحة ضمن حدّها الضيق.

### ٢-٥ · مواضع النثر التي سمّاها تقرير كودكس

أعيدت القراءة قراءةً فقط لإكمال تقرير التوقف؛ لم تستأنف التنفيذ. كل كتلة أدناه هي
**نص قبل ونص بعد معًا** لأنها بقيت مطابقة بايتةً. عدد المواضع المصححة: **0**.

#### P1 — `app.jsx:5509-5519`

```text
// ITEM 32 (commit three) -- THE ROLLBACK IS RETIRED, and this one line is the whole of it.
//
// WHAT CHANGES FOR A READER. Nothing, unless that reader had typed ?adhkarui=0 at some point
// on this device: V2 has been the default since session 84 and the parameter was the escape
// hatch for it. The hatch is now shut, so a device carrying a stored '0' opens V2 like every
// other device on its next visit.
//
// WHAT IS DELIBERATELY NOT DONE HERE. AdhkarScreenV1 is untouched, and so are readAdhkarUiFlag
// and ADHKAR_UI_V2_KEY above -- deleting the screen a lever protected in the same commit that
// shuts the lever leaves nothing to go back to if shutting it was wrong. The lever is shut
// first and alone; the screen and the reader come out separately, or not at all.
```

الحكم: **صادق على الرأس المقيس قبل النزع**؛ الثابت `true`، والقارئ خامل، والشاشة
القديمة ما زالت موجودة. لم يُغيّر بسبب التوقف.

#### P2 — `app.jsx:5521-5527`

```text
// THE OTHER TWO LEVERS OF THIS SHAPE ARE STILL LIVE, ON PURPOSE. ?mushafsvg=0 and
// ?madinaimg=0 both roll a QUR'AN RENDERER back on a device, and both are executed and
// asserted by tools/madina-hafs-guard.cjs (its section 5a drives ten parameter and storage
// cases through the madinaimg switch) and named at eight sites in theme-coverage-guard.cjs.
// Shutting either one means re-cutting roughly twenty assertions to say the opposite of what
// they say today, and taking a printed-mushaf rollback away from readers who chose it. That
// is an owner's decision, not a build one, and it is recorded in BABEL-32-REPORT.md as open.
```

الحكم: **مختلط وكاذب إجمالًا**. الرايتان حيّتان، وعدد ورود الاسمين في الشيفرة
التنفيذية لحارس التغطية هو فعلًا 8 (`MADINA_IMG_ON=5` و`MUSHAF_SVG_ON=3`). لكن حارس
المدينة يقود اليوم 12 حالة عادية + 3 حالات مخزن رامٍ + حالة نافذة بلا `location` =
**16 مدخلًا**، لا 10. وعبارة «نحو عشرين» لم تُقَس، و`BABEL-32-REPORT.md` غير موجود
في الشجرة الحالية. لم يُصحّح النص بسبب التوقف.

#### P3 — `app.jsx:6595-6596`

```text
// The one place the flag is spent. App still renders <AdhkarScreen onBack=... /> and knows
// nothing about either version, so ?adhkarui=0 changes this line's answer and nothing else.
```

الحكم: **كاذب اليوم**. المعامل لا يُقرأ، والثابت المثبّت على `true` هو الذي يجيب.
لم يُصحّح النص بسبب التوقف.

#### P4 — `app.jsx:17812-17817`

```text
// Session 84 - Adhkar UI V2 (ADHKAR_UI_V2_ON). ADDITIVE: every key below is new and not one
// key above it changed, so ?adhkarui=0 renders the S13.3-A screen out of its own untouched
// style keys. Colours are tokens, so V2 follows the palette rather than pinning hexes. The
// only literals are rgba(255,255,255,a) -- white at a fraction, sitting ON the accent band --
// and the shadow rgba(18,50,122,a), which is --red-deep at a fraction. Neither has a token,
// and both are written the same way by homeHero, the chat header and the drawer already.
```

الحكم: **مختلط وكاذب إجمالًا**؛ الادعاء بأن المعامل يُظهر الشاشة القديمة كاذب، وإن
كانت جمل الألوان وصفًا منفصلًا. لم يُصحّح النص بسبب التوقف.

#### P5 — `index.html:225-229`

```text
/* Session 84 -- Adhkar UI V2. Exactly two things an inline style cannot express: a media
   query and :focus-visible. Both selectors are NEW class names used only by the two V2
   components, so ?adhkarui=0 (the S13.3-A screen, which carries neither class) renders
   byte-identically with these rules present. The grid is 2 columns on a phone and steps to
   3 then 4 on wider displays -- never more, so a tile never shrinks to a chip on a desktop. */
```

الحكم: **مختلط وكاذب إجمالًا**؛ المعامل لا يصل إلى الشاشة القديمة، كما أن
`adhkar2-focus` مستعمل اليوم في أكثر من المكوّنين القديمين اللذين يصفهما النص. بقي
`index.html` بلا تعديل، والقياس البايتي أعطى `bare LF = 0` و`CRLF = 1706`.

#### P6 — `app.jsx:15011-15018`

```text
// The switch. Read ONCE at startup: the parameter writes the device key and then no longer
// matters, so it does not need to stay in the URL afterwards. The parameter still writes
// '1'/'0' exactly as it did, and every localStorage touch is still in a try/catch.
// THE DEFAULT IS ON, and only an explicit refusal turns it off. The test is against '0'
// rather than for '1', so all three ways of holding no answer -- an absent key, a value
// we do not recognise, and a storage that throws -- land on the official page. No input
// produces a blank screen, and the one input that produces the text reader is the one a
// person typed on purpose.
```

الحكم: **مختلط وكاذب إجمالًا**. الافتراضي وقراءة التحميل صادقان، لكن معامل SVG لا
يجيب مباشرة إذا فشلت الكتابة إلى المخزن، ومع راية صور المدينة مشغلة لا يعني إطفاء SVG
وحده إنشاء قارئ النص. لم يُصحّح النص بسبب التوقف.

#### P7 — `app.jsx:15327-15333`

```text
// One sheet of the reader. This is the ONLY place that decides which renderer runs, and it
// is the fallback too. Two ways back to the current reader, and both return the identical
// element with the identical four props:
//   • the flag is off  -> MUSHAF_SVG_ON is false, first branch, no image is ever created
//   • the image failed  -> onError latches `broke`, and the next render takes that branch
// Offline, 404, origin down, decode failure: all of them arrive as onError, and all of them
// land on the reader that ships today. The reader never shows a blank or a broken image.
```

الحكم: **كاذب جزئيًا وكاذب إجمالًا**. فرع WebP عند `app.jsx:15373-15395` يسبق فحص
`MUSHAF_SVG_ON`؛ لذلك قد تُنشأ صورة مع إطفاء SVG. لم يُصحّح النص بسبب التوقف.

#### P8 — `app.jsx:15032-15042,15173-15178`

```text
// 81 -- ON BY DEFAULT. All 604 printed pages passed the asset guard and the owner's
// visual acceptance on a real phone, so the printed Madina page is now the Quran reader
// the app opens with, and the parameter is a rollback switch rather than an opt-in:
//
//   no madinaimg parameter -> ON      (unless this device stored an explicit refusal)
//   ?madinaimg=1           -> ON
//   ?madinaimg=0           -> OFF     (immediate rollback, and it sticks on this device)
//
// The test is now against '0' rather than for '1', so an absent key, a value we do not
// recognise and a storage that throws all land on the printed page. This is the same
// shape as MUSHAF_SVG_ON above, and now for the same reason: both are shipped.
// 81 -- the parameter ANSWERS, it does not merely write. An explicit '1' or '0' returns
// straight from the URL and never consults storage at all, so a stale key, a value some
// other build wrote, a quota-full setItem or a storage that throws cannot make ?madinaimg=0
// keep the image reader on or ?madinaimg=1 keep it off. The write is still attempted, in
// its own try/catch, so the answer survives the next visit without the parameter -- but
// the write failing changes nothing about THIS visit.
```

الحكم: **صادق لسلوك راية صور المدينة اليوم**؛ القارئ عند `15179-15189` يعيد جواب
المعامل الصريح قبل قراءة المخزن. لم يُغيّر النص.

#### P9 — `app.jsx:16720-16724`

```text
{/* 82 -- the wird strip. MADINA_IMG_ON is still the FIRST term, so ?madinaimg=0 rolls
    it back with the reader it belongs to and the fallback renderers are byte for byte
    what they were. ITEM 22+104: `chromeOn` is the second term, so reading mode carries
    no strip in the DOM at all. The dwell timer is gated on NEITHER -- the page goes on
    counting towards the wird while the strip that reports it is gone. */}
```

الحكم: **صادق اليوم**؛ الشرط عند `16725` هو `MADINA_IMG_ON && chromeOn`، والمنتقي
مشروط أيضًا عند `16747`. لم يُغيّر النص.

## ٣ · أرقامُ البرهان السبعة

| رقم §٣ | النتيجة المقيسة |
|---:|---|
| 1 · صفر مستدعٍ باقٍ بعد النزع | **لم يُقَس بوصفه ناتج نزع** لأن النزع مُنع. عدد المعرّفات المنزوعة = `0`، وذِكر `adhkarContainer` الخارجي الباقي في الحارس = `1`. |
| 2 · تطابق مخرج الشاشة الحية قبل/بعد | **لم يُقَس**؛ لا توجد رقعة «بعد» بسبب التوقف. |
| 3 · الرجوع المبكر قبل تمام الخطافات | **لم يُقَس**؛ لم تتكوّن نسخة معدلة تُختبر. |
| 4 · النثر | المواضع المعاد قراءتها = `9`؛ المصحح = `0`؛ جدول النص والحكم في §٢-٥. |
| 5 · رايتا المصحف | **لم تتغيرا بايتةً** لأن كامل `app.jsx` و`app.js` مطابق لكائني HEAD: `4b132d2bcc4ffe957c9206467305ffd76741c697` و`c6ae53ca177ef0a3be2e16bcbb2716bcbcd0a17c`. فرق Git عليهما فارغ. |
| 6 · البوابات بعد الإيداع | **لم تُشغّل**: لا إيداعان ولا شجرة ما بعد الإيداع. لذلك لا نتيجة جديدة للروستر أو `recon` أو حارس الدروس أو `themecoverage` أو `questux` أو `wird` أو `bankintegrity`، ولم يُقطع `CORE_BYTES`. |
| 7 · وزن المنزوع من `app.js` | المنزوع الفعلي = **`0` بايت**؛ حجم الملف بقي **`1,057,624`** بايت. وزن رقعة نزع افتراضية **لم يُقَس** لأنها لم تُنشأ ولم تُبنَ. |

## ٤ · ما كذّبه القياس وما لم يُقَس

- كذّب القياس فرضية أن بقايا الشاشة القديمة وأنماطها غير مذكورة في حارس: الحارس
  يسمّي `adhkarContainer` ويقيسه فعليًا.
- صدقت أرقام المصدر السابقة للشاشة القديمة (`65 / 2,873`) ولأنماطها (`10 / 1,540`)
  بعد إعادة قياس مستقلة؛ لم تُنقل بلا تحقق.
- صدق حجم `app.js` الحالي (`1,057,624`) بعد قراءة البايتات.
- ثبت أن عدد مدخلات اختبار `madinaimg` هو `16`، وأن الرقم القديم `10` في نثر المصدر
  كاذب اليوم.
- لم تُقَس رقعة نزع، ولا فرق بناء، ولا مخرج مرئي قبل/بعد، ولا بوابة؛ لم تُطوَ أيٌّ
  منها على أنها نجاح.
- لم يُكتب المحظور النصي المحدد في §٣ في هذا التقرير.

## ٥ · سلامةُ الحدود ونقطةُ التوقف

طابقت كائنات العمل كائنات HEAD قبل إنشاء هذا التقرير:

| الملف | Git blob في العمل وHEAD |
|---|---|
| `app.jsx` | `4b132d2bcc4ffe957c9206467305ffd76741c697` |
| `app.js` | `c6ae53ca177ef0a3be2e16bcbb2716bcbcd0a17c` |
| `index.html` | `28823c00e5bc0b802d1fc290110e9b990db7c451` |
| `theme-coverage-guard.cjs` | `5cd16e479291dd50e3a9f88f8d72de53032df5c7` |
| `sw.js` | `f1677e5321a09419d2a5ac6567111dcb58f18df1` |

لم يُمسّ `api/**` أو `lib/**` أو `sw.js` أو حارس أو راية مصحف أو قارئها أو ثابتُها أو
مصرفُها. لا ختم شحنة، ولا رفعة اسم مخزن، ولا فرع جديد، ولا إيداع، ولا دفع. تعريف
payload في الختم: كل بايت UTF-8 من أول الملف حتى نهاية هذا السطر، بما في ذلك محرف LF
الذي يليه، وقبل الفاصل النهائي وحقلي الختم.
---
PAYLOAD_BYTES=18161
sha256=a4c8ffb8845b5c6239d90f3b59e1a20ee8ea583f6e5c65506dce815e79d3c4e9
