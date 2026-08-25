# EZIK — تقريرُ البند ٣٦-ب: النثرُ الكاذبُ وحدَه

**٢٤ أغسطس ٢٠٢٦ · تعليقاتٌ ونثرٌ فقط · صفرُ بايتةٍ تنفيذيّةٍ تحرّكت · صفرُ دفع**

## ٠ · النتيجةُ أوّلًا

قُرِئتِ المواضعُ التسعةُ من جديدٍ وحُكِمَ عليها بالقياسِ لا بالنقل. **ثلاثةٌ صادقةٌ تُرِكت،
وستّةٌ صُحِّحت، وموضعٌ عاشرٌ لم يذكرْه التقريرُ السابقُ وُجِدَ كاذبًا وصُحِّحَ ويُسمّى إضافةً
منّي.** والإيداعُ واحدٌ: `da0e6d0`. وشَهِدَ البرهانُ البايتيُّ أنّ الشيفرةَ لم تتحرّك: `app.jsx`
منزوعةَ التعليقاتِ قبلَ وبعدُ **بصمةٌ واحدةٌ لا تختلفُ بايتة**، وكذلك `index.html` منزوعةَ
كتلِ `/* */`.

والبوّاباتُ بعدَ الإيداعِ على شجرةٍ نظيفة: **`SUITE: 92/93`** · **`recon PASS=184 WARN=1
FAIL=0`** · **`tree after: 0 dirty path(s)`** · والحمراءُ الوحيدةُ `bankintegrity`، ولم تُصلَحْ.

---

## ١ · الهويّةُ والحدّ

| الحقل | القيمةُ المقيسة |
|---|---|
| الشجرة | `C:\Users\passe\projects\ustaz` |
| الفرع | `feat/wird-khatmah-20260824` — لم يُقطَعْ فرعٌ جديد |
| الأساس | `4e26fffcaa00275753311f4a6c300d88ca6924b9` (`4e26fff`) |
| الإيداع | **`da0e6d0`** — واحدٌ لا غير، ورسالتُه تقولُ إنّه نثرٌ لا سلوك |
| ما مُسّ | `app.jsx` (ستُّ كتلِ تعليقٍ) · `index.html` (تعليقُ CSS واحد) · `app.js` (إعادةُ بناءٍ للمصدرِ عينِه) |
| ما لم يُمسّ | `api/**` · `lib/**` · `sw.js` · أيُّ حارس · `gates.json` · `.gitattributes` · أيُّ رايةٍ أو نمطٍ أو شاشة |
| النزع | **صفر** — لم يُحذفْ معرِّفٌ ولا نمطٌ ولا رايةٌ ولا سطرُ شيفرة |
| `CORE_BYTES` · ختمٌ · رفعةُ مخزن | **لم يُقطَعْ ولم يُختَمْ ولم تُرفَعْ** (§٠ من الأمر) |
| الدفعُ والنشر | **صفر** |

### ١-١ · كائناتُ Git قبلَ وبعد

| الملف | عندَ `4e26fff` | عندَ `da0e6d0` |
|---|---|---|
| `app.jsx` | `4b132d2bcc4ffe957c9206467305ffd76741c697` | `3501086e0a370bfbb3a8b68cb5782298be8d2797` |
| `app.js` | `c6ae53ca177ef0a3be2e16bcbb2716bcbcd0a17c` | `ff2c3fbc6066c3952c412410d7fb099edaa3e447` |
| `index.html` | `28823c00e5bc0b802d1fc290110e9b990db7c451` | `5073f80b2e726841d0b831748cdc0012b4689146` |

**ولماذا بُنيَ `app.js`؟** لأنّه ناتجُ بناءٍ لا مصدرٌ، والبوّابةُ `babel` تعيدُ بناءَه من
`app.jsx` وتفشلُ على أيِّ فرق. وتعليقاتُ المصدرِ **تُحفَظُ في الناتج** (مقيسٌ: كلُّ عبارةٍ من
الكتلِ الستِّ موجودةٌ في `app.js`)، فتركُه بلا بناءٍ يعني بوّابةً حمراءَ ثانيةً ونثرًا كاذبًا
يبقى في ما يُشحَن. وسابقةُ الشجرةِ نفسُها: `4e26fff` أودعَ `app.jsx` و`app.js` معًا. والبناءُ
ليس في محرَّماتِ §٠.

---

## ٢ · البرهانُ الحاسم (§٤-١): الشيفرةُ لم تتحرّك

أداةٌ واحدةٌ، خيارٌ واحد، شُغِّلت على نسخةِ «قبلُ» وعلى الملفِّ بعدُ:
`@babel/core` من `node_modules` نفسِها، `comments:false`، `configFile:false`،
`babelrc:false`، `compact:false`، `preset-react` بـ`runtime:'classic'`.

| المقيس | قبل | بعد | الحكم |
|---|---|---|---|
| `app.jsx` منزوعةَ التعليقات | `696441` بايتة · `886a35ae21f0c36f657d4c7f50f29f86eb9cb8ae953225af53adbc7788820401` | `696441` بايتة · `886a35ae21f0c36f657d4c7f50f29f86eb9cb8ae953225af53adbc7788820401` | **تطابقٌ بايتيّ** |
| `index.html` منزوعةَ كتلِ `/* */` | `67421` بايتة · `d2f9975c0a509811d914cb7532b36a8a9538efd60e8ff0edb0c6f65f6de76eb2` | `67421` بايتة · `d2f9975c0a509811d914cb7532b36a8a9538efd60e8ff0edb0c6f65f6de76eb2` | **تطابقٌ بايتيّ** |
| `app.js` منزوعةَ التعليقات | `696441` بايتة · `886a35ae…8820401` | `696441` بايتة · `886a35ae…8820401` | **تطابقٌ بايتيّ** |

وبصمةُ `app.js` منزوعةَ التعليقاتِ هي **بصمةُ `app.jsx` عينُها**، وهو ما ينبغي: الناتجُ هو
المصدرُ محوَّلًا، وحينَ تُنزَعُ التعليقاتُ من الاثنَينِ يبقى شيءٌ واحد.

### ٢-١ · البايتاتُ الخام وسطورُ الأسطر

| الملف | قبل | بعد | الفرق | `bare LF` | `CR` |
|---|---:|---:|---:|---|---|
| `app.jsx` | `1175679` | `1178123` | `+2444` | `18701 → 18730` | `0 → 0` |
| `index.html` | `122568` | `122884` | `+316` | **`0 → 0`** | `1706 → 1710` (CRLF) |
| `app.js` | `1057624` | `1060060` | `+2436` | `5826 → 5855` | `0 → 0` |

`index.html`: **`bare LF = 0`** و**`CRLF = 1710`** مقيسانِ بعدِّ البايتَينِ `0x0D`/`0x0A` في
Node، لا بـ`grep`.

### ٢-٢ · §٤-٦ · رايتا المصحفِ وجهازُ رايةِ الأذكارِ والشاشةُ القديمة

**لم تتغيّرْ منها بايتةٌ تنفيذيّةٌ واحدة**، والبرهانُ هو جدولُ §٢ أعلاه نفسُه: تطابقُ
`app.jsx` منزوعةَ التعليقاتِ يشملُ `readAdhkarUiFlag` و`ADHKAR_UI_V2_KEY` و`ADHKAR_UI_V2_ON`
و`AdhkarScreenV1` ومفاتيحَ نمطِها التسعةَ و`readMushafSvgFlag` و`readMadinaImgFlag`
و`MushafSheet` — كلُّها داخلَ الملفِّ الذي طابقَ. ولم يُمسّ `theme-coverage-guard.cjs` الذي
يسمّي `adhkarContainer`.

---

## ٣ · جدولُ المواضع (§٤-٢)

الترقيمُ `P1..P9` هو ترقيمُ التقريرِ السابق، و`P10` إضافةٌ منّي. والأسطرُ **بعدَ الإيداع**.

### P1 — `app.jsx:5516-5526` — **صادق · تُرِك**

قبلَ وبعدُ **نصٌّ واحد**:

```text
// ITEM 32 (commit three) -- THE ROLLBACK IS RETIRED, and this one line is the whole of it.
// … V2 has been the default since session 84 and the parameter was the escape hatch …
// … AdhkarScreenV1 is untouched, and so are readAdhkarUiFlag and ADHKAR_UI_V2_KEY above …
```

**سببُ الترك:** كلُّ جملةٍ فيه مقيسةٌ صادقة: `ADHKAR_UI_V2_ON` ثابتٌ على `true`
(`app.jsx:5541`)، و`readAdhkarUiFlag` بلا مستدعٍ (بحثٌ دقيقٌ في الملفِّ: تعريفٌ وتعليقاتٌ
فقط)، و`AdhkarScreenV1` قائمةٌ بمفاتيحِها. **ولم تُعَدْ صياغةُ فقرةٍ صادقةٍ لتحسينِها.**

### P2 — `app.jsx:5528-5540` — **كاذبٌ إجمالًا · صُحِّح**

**قبل:**

```text
// THE OTHER TWO LEVERS OF THIS SHAPE ARE STILL LIVE, ON PURPOSE. ?mushafsvg=0 and
// ?madinaimg=0 both roll a QUR'AN RENDERER back on a device, and both are executed and
// asserted by tools/madina-hafs-guard.cjs (its section 5a drives ten parameter and storage
// cases through the madinaimg switch) and named at eight sites in theme-coverage-guard.cjs.
// Shutting either one means re-cutting roughly twenty assertions to say the opposite of what
// they say today, and taking a printed-mushaf rollback away from readers who chose it. That
// is an owner's decision, not a build one, and it is recorded in BABEL-32-REPORT.md as open.
```

**بعد:**

```text
// THE OTHER TWO LEVERS OF THIS SHAPE ARE STILL LIVE, ON PURPOSE. ?mushafsvg=0 and
// ?madinaimg=0 both roll a QUR'AN RENDERER back on a device, and tools/madina-hafs-guard.cjs
// holds both -- but NOT in the same way, and only one of them is executed. Its section 5a
// lifts readMadinaImgFlag out of the shipped client and runs it against 16 environments: 12
// parameter-and-storage pairs, 3 with a storage that throws, and 1 window carrying no
// location at all. The mushafsvg lever is asserted by SOURCE SHAPE instead -- one pattern
// over the switch and one over the flag name -- and nothing executes it. The two constants
// are then named at 8 executable sites in theme-coverage-guard.cjs, and at 2 more inside its
// own comments. Every count in this paragraph was measured on this tree on 2026-08-24.
// Shutting either lever means re-cutting those assertions to say the opposite of what they
// say today, and taking a printed-mushaf rollback away from readers who chose it. That is an
// owner's decision, not a build one. BABEL-32-REPORT.md, which this used to name as the place
// that decision was recorded as open, is not a file in this tree -- so it is recorded here.
```

**سببُ التصحيح — أربعةُ أكاذيبَ مقيسة:**

1. **«both are executed»** كاذبة. `buildFlag()` في `tools/madina-hafs-guard.cjs` يرفعُ
   `readMadinaImgFlag` وحدَها بتعبيرٍ نمطيٍّ ثمّ يبنيها `new Function` ويشغّلُها؛ أمّا
   `mushafsvg` فمذكورٌ في تأكيدَينِ من نوعِ «شكلِ المصدر» لا غير (اسمُ الرايةِ، وشكلُ
   المبدّلِ). **هذه إضافةٌ منّي: التقريرُ السابقُ لم يذكرْها.**
2. **«ten … cases»** كاذبة. عدَّةُ ما يُقادُ فعلًا في §5a هي **١٦ بيئة**: `cases` فيها `12`
   مدخلًا، ثمّ `dead` فيها `3` بمخزنٍ يرمي، ثمّ حالةُ نافذةٍ بلا `location`.
3. **«roughly twenty assertions»** تنبّؤٌ لم يُقَسْ — أُبدِلَ بإشارةٍ إلى التأكيداتِ
   المعدودةِ في الفقرةِ نفسِها، بلا رقمٍ مُخترَع.
4. **`BABEL-32-REPORT.md` لا وجودَ لها** — لا على القرصِ ولا في أيِّ إيداعٍ من `1062`
   إيداعًا. فالإحالةُ حُذِفت وكُتِبَ مكانَها أنّ الوثيقةَ غيرُ موجودة، امتثالًا لـ§٢-٥.

**وما بقيَ صادقًا فلم يُمَسّ:** «الرايتانِ حيّتانِ عمدًا» صادقة، و**«ثمانيةُ مواضع»
صادقةٌ بالقياس** (٨ ورودًا في شيفرةٍ تنفيذيّة) — ولم تُبدَّلْ، وإنّما زِيدَ عليها الوَردانِ
اللذانِ في تعليقاتِ الحارسِ حتّى لا يُقرأَ الرقمُ خطأً.

### P3 — `app.jsx:6608-6611` — **كاذب · صُحِّح**

**قبل:**

```text
// The one place the flag is spent. App still renders <AdhkarScreen onBack=... /> and knows
// nothing about either version, so ?adhkarui=0 changes this line's answer and nothing else.
```

**بعد:**

```text
// The one place the constant is spent. App still renders <AdhkarScreen onBack=... /> and
// knows nothing about either version. ITEM 32: ADHKAR_UI_V2_ON is a fixed true above and the
// reader of ?adhkarui has no caller, so this line answers V2 on every device, and the V1 arm
// is kept without being reached.
```

**سببُ التصحيح:** المعاملُ لا يُقرَأُ اليوم، فلا يغيّرُ جوابَ هذا السطرِ ولا غيرَه. والجوابُ
هو الثابتُ `true`. وصدرُ الجملةِ («المصرفُ الوحيد») صادقٌ وبقيَ.

### P4 — `app.jsx:17837-17846` — **مختلطٌ وكاذبٌ إجمالًا · صُحِّح**

**قبل:**

```text
  // Session 84 - Adhkar UI V2 (ADHKAR_UI_V2_ON). ADDITIVE: every key below is new and not one
  // key above it changed, so ?adhkarui=0 renders the S13.3-A screen out of its own untouched
  // style keys. Colours are tokens, so V2 follows the palette rather than pinning hexes. The
  // only literals are rgba(255,255,255,a) -- white at a fraction, sitting ON the accent band --
  // and the shadow rgba(18,50,122,a), which is --red-deep at a fraction. Neither has a token,
  // and both are written the same way by homeHero, the chat header and the drawer already.
```

**بعد:**

```text
  // Session 84 - Adhkar UI V2 (ADHKAR_UI_V2_ON). ADDITIVE, as that session left it: every key
  // below was new and not one key above it changed, so the S13.3-A screen went on rendering
  // out of its own untouched style keys. ITEM 32 then shut the parameter that reached it: the
  // V1 keys above are all still here, and the screen that names them is no longer reached.
  // Colours are tokens, so V2 follows the palette rather than pinning hexes. The only literals
  // are rgba(255,255,255,a) -- white at a fraction, on the accent-FILLED counter, since session
  // 85 took the accent band away -- and the shadow rgba(18,50,122,a), which is --red-deep at a
  // fraction. Neither has a token. Measured on this tree on 2026-08-24: the keys below carry
  // five such literals in three distinct values and not one hex value, and outside them that
  // white-at-a-fraction shape is written only by the memorizer's header and its back button.
```

**سببُ التصحيح — ثلاثةُ مواضع:**

1. `?adhkarui=0` لا يعرضُ الشاشةَ القديمة (كما في P3). وجملةُ «ADDITIVE» بقيَتْ **بوصفِها
   سجلَّ الجلسةِ ٨٤** بصيغةِ الماضي، لأنّها صادقةٌ عن تلكَ الجلسةِ وكاذبةٌ لو قُرِئت عن اليوم.
2. **«sitting ON the accent band»** بائدة: الجلسةُ ٨٥ نزعتِ الشريطَ الأزرقَ (والتعليقُ
   المجاورُ في الملفِّ يقولُ ذلك). واللونُ اليومَ على `adhkar2Counter` وخلفيّتُه
   `var(--accent-fill)`. **إضافةٌ منّي.**
3. **«written the same way by homeHero, the chat header and the drawer»** كاذبةٌ اليوم:
   المواضعُ الوحيدةُ خارجَ كتلةِ V2 هي `memHeader` و`memBackBtn` (المحفِّظ). **إضافةٌ منّي.**

**وما بقيَ صادقًا:** «الألوانُ رموزٌ لا هكسات» — مقيسٌ: كتلةُ `adhkar2*` تحملُ `0` قيمةَ
هكسٍ في قِيَمِ الأنماط (الهكساتُ الثمانيةُ في تلكَ المنطقةِ كلُّها داخلَ تعليقاتٍ)، و`5`
حرفيّاتِ `rgba` في `3` قيمٍ متمايزة.

### P5 — `index.html:225-233` — **مختلطٌ وكاذبٌ إجمالًا · صُحِّح (تعليقُ CSS وحدَه)**

**قبل:**

```text
  /* Session 84 -- Adhkar UI V2. Exactly two things an inline style cannot express: a media
     query and :focus-visible. Both selectors are NEW class names used only by the two V2
     components, so ?adhkarui=0 (the S13.3-A screen, which carries neither class) renders
     byte-identically with these rules present. The grid is 2 columns on a phone and steps to
     3 then 4 on wider displays -- never more, so a tile never shrinks to a chip on a desktop. */
```

**بعد:**

```text
  /* Session 84 -- Adhkar UI V2. Exactly two things an inline style cannot express: a media
     query and :focus-visible. Both selectors were new class names when this was written, and
     measured on this tree on 2026-08-24 they are no longer alike: .adhkar2-focus is carried
     by five components at thirteen sites -- the card, the feature card, the browse screen,
     the reader and the audio button -- while .adhkar2-grid is carried by NONE. That rule and
     the adhkar2Tile key it lays out are both leftovers with no user in the shipped source. The
     S13.3-A screen carries neither class, and it is not reached at all any more: ITEM 32 shut
     ?adhkarui. The rule below steps 2 columns on a phone to 3 and then 4 on wider displays,
     and never further. */
```

**سببُ التصحيح:**

1. `?adhkarui=0` لا يصلُ إلى الشاشةِ القديمة.
2. **«used only by the two V2 components»** كاذبة: `.adhkar2-focus` يحملُها اليومَ
   **١٣ موضعًا في ٥ مكوّنات** — `IstanaAdhkarCard` · `IstanaAdhkarFeature` ·
   `IstanaAdhkarBrowse` · `IstanaAdhkarReader` · `A3AudioBtn`.
3. **`.adhkar2-grid` لا يحملُها أحدٌ أصلًا** — ورودُها الوحيدُ في `app.jsx` تعليقٌ، ومفتاحُ
   `adhkar2Tile` الذي تُنسِّقُه بلا مستهلكٍ هو الآخر. **إضافةٌ منّي: التقريرُ السابقُ سمّى
   `adhkar2-focus` ولم يسمِّ الشبكة.**

**ولم يُمسَّ من `index.html` غيرُ هذا التعليق**، ولا قاعدةَ نمطٍ ولا محدِّدَ ولا سطرَ HTML.
ولا يسمّي أيُّ حارسٍ في الشجرةِ `adhkar2-focus` أو `adhkar2-grid` أو `adhkar2Tile` (بحثٌ في
كلِّ `*.cjs`/`*.mjs`/`*.js` خارجَ `node_modules`)، فلا تأكيدَ تحرّكَ بهذا النثر.

### P6 — `app.jsx:15026-15039` — **مختلطٌ وكاذبٌ إجمالًا · صُحِّح**

**قبل** (آخرُ جملتَين، وما قبلَهما بقيَ حرفًا):

```text
// … land on the official page. No input
// produces a blank screen, and the one input that produces the text reader is the one a
// person typed on purpose.
```

**بعد:**

```text
// … land on the official page. No input
// produces a blank screen.
// TWO THINGS THIS SWITCH DOES NOT DO, both read off this tree on 2026-08-24. It does not
// ANSWER from the URL the way MADINA_IMG_ON below does: the parameter is only WRITTEN to
// storage here and the answer is read back OUT of storage, so on a device whose storage
// throws -- private mode, a full quota, a blocked origin -- the write is swallowed, the read
// throws too, and ?mushafsvg=0 leaves the default ON for that visit. And it does not reach
// the text reader on its own: MushafSheet tests the printed Madina page FIRST, so while
// MADINA_IMG_ON is true, ?mushafsvg=0 alone changes nothing the reader sees.
```

**سببُ التصحيح:** `readMushafSvgFlag` يكتبُ المعاملَ ثمّ **يقرأُ من المخزن**؛ فإن رمى المخزنُ
ابتُلِعَتِ الكتابةُ ورمَتِ القراءةُ، والمرتجَعُ هو `true` الافتراضيُّ — أي أنّ `?mushafsvg=0`
**لا يُرجِعُ** على جهازٍ بلا مخزنٍ صالح. وثانيًا: فرعُ صورةِ المدينةِ يُختبَرُ قبلَ
`MUSHAF_SVG_ON`، فإطفاءُ SVG وحدَه لا يُنشئُ قارئَ النصّ. **وثلاثُ الجملِ الأولى صادقةٌ
وتُرِكت حرفًا** (القراءةُ مرّةً عندَ الإقلاع، الكتابةُ في `try/catch`، والاختبارُ ضدَّ `'0'`).

### P7 — `app.jsx:15348-15358` — **كاذب · صُحِّح**

**قبل:**

```text
// One sheet of the reader. This is the ONLY place that decides which renderer runs, and it
// is the fallback too. Two ways back to the current reader, and both return the identical
// element with the identical four props:
//   • the flag is off  -> MUSHAF_SVG_ON is false, first branch, no image is ever created
//   • the image failed  -> onError latches `broke`, and the next render takes that branch
// Offline, 404, origin down, decode failure: all of them arrive as onError, and all of them
// land on the reader that ships today. The reader never shows a blank or a broken image.
```

**بعد:**

```text
// One sheet of the reader. This is the ONLY place that decides which renderer runs, and it
// is the fallback too. The chain below is THREE renderers deep, not two, and the printed
// Madina page is at the head of it -- the 78 and 81 notes inside MushafSheet describe the
// order the branches are actually written in. Two ways reach the verified TEXT page, and
// both return the identical element with the identical four props:
//   • the flag is off  -> MUSHAF_SVG_ON is false. That is the SECOND test and not the
//     first: the printed page is tested before it, so while MADINA_IMG_ON is true an image
//     element IS created and this test is never reached.
//   • the SVG failed  -> onError latches `broke`, and the next render takes that branch
// Offline, 404, origin down, decode failure: each renderer's own onError latch hands the
// sheet down to the next one. The reader never shows a blank or a broken image.
```

**سببُ التصحيح:** الاختبارُ الأوّلُ في `MushafSheet` هو `if (madina && !imgBroke)` عندَ
`app.jsx:15398`، و`if (!MUSHAF_SVG_ON || broke)` عندَ `app.jsx:15421` بعدَه. فـ«الفرعُ
الأوّلُ» و«لا تُنشَأُ صورةٌ أبدًا» كاذبتان، والسلسلةُ ثلاثٌ لا اثنتان — والتعليقانِ `78`
و`81` داخلَ الدالّةِ نفسِها يقولانِ ذلك، فكانَ النصُّ يناقضُ جارَه.

### P8 — `app.jsx:15053-15063, 15194-15199` — **صادق · تُرِك**

قبلَ وبعدُ **نصٌّ واحد** (جدولُ `madinaimg` الثلاثيُّ وفقرةُ «the parameter ANSWERS»).

**سببُ الترك:** `readMadinaImgFlag` يُرجِعُ من المعاملِ الصريحِ **قبلَ** أن يمسَّ المخزنَ
(`app.jsx:15203-15206`)، والكتابةُ في `try/catch` خاصٍّ بها. مقيسٌ ومطابقٌ لما يقولُه النص.

### P9 — `app.jsx:16745-16749` — **صادق · تُرِك**

قبلَ وبعدُ **نصٌّ واحد** (شريطُ الوِرد).

**سببُ الترك:** الشرطُ `MADINA_IMG_ON && chromeOn` قائمٌ بالترتيبِ الذي يصفُه، ومؤقّتُ
المكوثِ (`useEffect` عندَ `app.jsx:16384`) مشروطٌ بـ`state !== 'ok'` وحدَه — لا
بـ`MADINA_IMG_ON` ولا بـ`chromeOn`. فقولُه «gated on NEITHER» مقيسٌ صادق.

### P10 — `app.jsx:5474-5490` — **إضافةٌ منّي · كاذب · صُحِّح**

موضعٌ **لم يذكرْه التقريرُ السابق**: ترويسةُ الكتلةِ، على بعدِ أحدَ عشرَ سطرًا فوقَ P1،
تصفُ المبدّلَ حيًّا.

**قبل:**

```text
// THE SWITCH, and it has the same shape as MADINA_IMG_ON below: the parameter ANSWERS
// rather than merely writing, so an explicit '1' or '0' returns straight from the URL and
// never consults storage at all. A stale key, a value some other build wrote, a quota-full
// setItem or a storage that throws cannot make ?adhkarui=0 keep V2 on or ?adhkarui=1 keep
// it off. The write is still attempted, in its own try/catch, so the answer survives the
// next visit without the parameter -- but the write failing changes nothing about THIS visit.
//
//   no adhkarui parameter -> V2   (unless this device stored an explicit refusal)
//   ?adhkarui=1           -> V2
//   ?adhkarui=0           -> V1   (the S13.3-A screen, immediate rollback, sticks on device)
```

**بعد:**

```text
// THE SWITCH AS SESSION 84 BUILT IT -- AND IT IS RETIRED. ITEM 32 shut it: ADHKAR_UI_V2_ON
// below is a fixed true, readAdhkarUiFlag has no caller anywhere in this file, and no
// ?adhkarui value changes what any device opens. The function below is still WRITTEN the
// way MADINA_IMG_ON is written -- the parameter ANSWERS rather than merely writing, so an
// explicit '1' or '0' returns straight from the URL and never consults storage at all, and
// a stale key, a value some other build wrote, a quota-full setItem or a storage that
// throws cannot override it -- but nothing calls it, so what follows describes the shape of
// the code and not a behaviour any reader can reach:
//
//   no adhkarui parameter -> V2   (unless this device stored an explicit refusal)
//   ?adhkarui=1           -> V2
//   ?adhkarui=0           -> V1   (the S13.3-A screen, immediate rollback, sticks on device)
//
// THOSE THREE LINES ARE SESSION 84's OWN TABLE, LEFT WORD FOR WORD ON PURPOSE. They are what
// readAdhkarUiFlag would return if it were ever called again; today nothing calls it, so no
// device takes any of the three. Rewriting the table would erase the record rather than keep
// it -- this paragraph is the correction, and the table is left standing as what was true.
```

**سببُ التصحيح:** الترويسةُ كانت تصفُ رايةً ميّتةً بصيغةِ الحاضر، وكانَ نصُّ P1 تحتَها
مباشرةً يقولُ إنّها أُغلِقت — فالملفُّ يناقضُ نفسَه في اثنَي عشرَ سطرًا.

🔵 **والأسطرُ الثلاثةُ (جدولُ `?adhkarui`) تُرِكت حرفًا حرفًا** عملًا بـ§٢-٣: هي سجلُّ ما
بنَتْه الجلسةُ ٨٤، وتصحيحُها يمحو السجلَّ بدلَ أن يحفظَه. وكُتِبَ تحتَها صراحةً أنّها متروكةٌ
عمدًا، وأنّ الفقرةَ فوقَها هي التصحيح.

**وما لم أمسسْه في هذه الكتلة:** فقرةُ «V1 IS NOT EDITED» وفقرةُ «NO DEVOTIONAL CONTENT IS
AUTHORED» — كلتاهما مقيسةٌ صادقةٌ اليومَ ولم تُعَدْ صياغتُها.

### موضعٌ رأيتُه ولم أمسسْه، وأُبلِّغُ

`app.jsx:5505` — التعليقُ المسطّرُ على مفتاحِ المخزن:
`const ADHKAR_UI_V2_KEY = 'adhkar_ui_v2';   // device key. '0' = V1, anything else = V2`.
هو **وصفٌ صادقٌ لما تفعلُه الدالّةُ تحتَه**، وكاذبٌ فقط لو قُرِئَ على أنّه سلوكُ جهازٍ اليوم.
تركتُه لأنّ P10 فوقَه صارَ يقولُ صراحةً إنّ الدالّةَ بلا مستدعٍ، ولأنّ أقلَّ تعديلٍ يكفي هو
ألّا يُكرَّرَ الكلامُ في سطرٍ ثالث.

---

## ٤ · العددُ (§٤-٣)

| المقياس | العدد |
|---|---:|
| مواضعُ التقريرِ السابقِ التي أُعيدَ قراءتُها والحكمُ عليها | **٩** |
| منها: صُحِّحَت | **٦** (P2 · P3 · P4 · P5 · P6 · P7) |
| منها: تُرِكت صادقةً بلا تعديل | **٣** (P1 · P8 · P9) |
| مواضعُ كاذبةٌ إضافيّةٌ وجدتُها ولم يذكرْها التقريرُ السابق | **١** (P10) — وثلاثُ جملٍ داخلَ P4/P5 مذكورةٌ في مواضعِها |
| **مجموعُ المواضعِ المصحَّحة** | **٧** |
| تُرِكَ اقتباسًا/سجلًّا حرفًا حرفًا ومُعلَنًا | **١** (جدولُ `?adhkarui` الثلاثيُّ في P10) |
| كتلُ التعليقِ التي مُسّت | **٦** في `app.jsx` · **١** في `index.html` |
| بايتاتُ شيفرةٍ تنفيذيّةٍ تحرّكت | **٠** |

---

## ٥ · كلُّ رقمٍ كتبتُه في النثرِ الجديد، ومصدرُ قياسِه (§٤-٤)

| الرقم | أينَ كُتِب | كيفَ قيسَ |
|---|---|---|
| **١٦ بيئة** (`12` + `3` + `1`) | P2 | قراءةُ `tools/madina-hafs-guard.cjs:555-622`: مصفوفةُ `cases` (١٢ عنصرًا) تُقادُ في حلقةٍ، ثمّ `dead` (٣ عناصر) بـ`deadStore()`، ثمّ كتلةُ `flag({}, store({}))` الواحدة |
| **٨ مواضعَ تنفيذيّة** و**٢ في التعليقات** | P2 | عدٌّ في Node لورودِ `MADINA_IMG_ON`/`MUSHAF_SVG_ON` في `theme-coverage-guard.cjs` مع تصنيفِ كلِّ سطرٍ: `CODE_OCC=8` (٥ للأولى، ٣ للثانية) و`COMMENT_OCC=2` — المجموعُ ١٠ |
| **«one pattern over the switch and one over the flag name»** | P2 | ورودُ `mushafsvg` في حارسِ المدينةِ ٦ مرّاتٍ، منها تأكيدانِ فقط: اسمُ الرايةِ في جدولِ الحضور، وتعبيرُ شكلِ المبدّلِ — ولا `new Function` عليه |
| **٥ حرفيّاتٍ في ٣ قيمٍ · ٠ هكس** | P4 | مسحُ كتلةِ `adhkar2*` كاملةً في Node: `rgba occurrences=5`، `distinct=3`، وهكساتُ قِيَمِ الأنماطِ `0` |
| **«memorizer's header and its back button»** | P4 | ورودُ `rgba(255,255,255,` في `app.jsx` خارجَ كتلةِ V2: `memHeader` و`memBackBtn` وحدَهما |
| **١٣ موضعًا في ٥ مكوّنات** | P5 (`index.html`) | عدُّ `className="adhkar2-focus"` في `app.jsx` (١٣ سطرًا)، وردُّ كلِّ سطرٍ إلى الدالّةِ الحاويةِ (٥ دوالّ) |
| **`.adhkar2-grid` بلا حامل** | P5 | ورودُها في `app.jsx` مرّةً واحدةً وهي **داخلَ تعليق**؛ و`adhkar2Tile` وردَ مرّةً واحدةً وهي **تعريفُه نفسُه** |
| **«BABEL-32-REPORT.md ليست في الشجرة»** | P2 | `ls` تقولُ لا وجودَ لها، و`git log --all -- BABEL-32-REPORT.md` صفرُ إيداع، وفحصُ كلِّ الإضافاتِ في `1062` إيداعًا صفر |
| **«MushafSheet tests the printed page FIRST»** | P6 · P7 | موضعُ الفرعَينِ: `app.jsx:15398` ثمّ `app.jsx:15421` |
| **«storage that throws → default ON»** | P6 | قراءةُ `readMushafSvgFlag`: الكتابةُ في `try` مبتلَعةٌ، والقراءةُ في `try` مرتجَعُها `true` |
| **«dwell gated on NEITHER»** (تُرِكَ صادقًا) | P9 | `useEffect` عندَ `app.jsx:16384`: شرطُه `state !== 'ok'` فقط |

**ولا رقمَ في النثرِ الجديدِ منقولٌ من تقريرٍ سابق.** كلُّ رقمٍ أعلاه قيسَ في هذه الجولةِ على
هذه الشجرة.

---

## ٦ · البوّاباتُ بعدَ الإيداعِ على شجرةٍ نظيفة (§٤-٥)

شُغِّلَت `node tools/run-gates.cjs` بعدَ الإيداعِ `da0e6d0`، وبعدَ نقلِ ثلاثةَ عشرَ ملفًّا غيرَ
متتبَّعٍ (تقاريرُ وأوامرُ جولاتٍ سابقة) إلى خارجِ المستودعِ ثمّ إعادتِها — إذ يفشلُ تأكيدُ
«شجرةُ العملِ نظيفة» في `recon` بوجودِها، وهي سابقةُ الجولةِ الماضيةِ نفسُها.

```
=== SUITE: 92/93 EXIT=0 ===
recon:    SUMMARY   PASS=184   WARN=1   FAIL=0
tree after: 0 dirty path(s)
FAILING (1): bankintegrity=1
```

| ما تطلبُه §٤-٥ | المقيس | الحكم |
|---|---|---|
| الروستر `93` | `gates.json` = **٩٣** مدخلًا، والسويتُ عدَّ `93` | **مطابق** |
| `recon 184/1/0` | `PASS=184 WARN=1 FAIL=0` | **مطابق** (و`WARN=1` هو التحذيرُ القائمُ من قبلِ هذه الجولة) |
| حارسُ الدروسِ `269` | `lessonssearch`: `=== 269/269 - PASS ===` | **مطابق** |
| `themecoverage` لا تنقصُ أرضيّتُها | `OK: 1351/1351` (الأساس: `1351/1351`) | **صفرُ نقص** |
| `questux` لا تنقصُ أرضيّتُها | `OK: 61/61` (الأساس: `61/61`) | **صفرُ نقص** |
| `wird` لا تنقصُ أرضيّتُها | `passed: 1122 · failed: 0` (الأساس: `1122 · 0`) | **صفرُ نقص** |
| `bankintegrity` تحمرُّ ولا تُصلَح | حمراءُ، ولم تُصلَحْ | **مطابق** |

وأرضيّاتٌ أخرى قِيسَت ولم تنقصْ: `lessonsbrowse` `81/81` و`MUTANTS_KILLED=2/2` ·
`a11y` `138/138` · `chatux` `439/439`.

### ٦-١ · `bankintegrity`: الفرقُ رقمًا، ولم يُصلَح

```
FAIL [B12] CORE_BYTES = 1870613 but CORE weighs 1895725 bytes on disk (+25112).
FAIL [B14] sw.js prose says index.html is 122568 bytes; the disk says 122884 (+316).
FAIL [B14] sw.js prose says app.js is 1035264 bytes; the disk says 1060060 (+24796).
FAIL  74 checks passed, 3 failed.
```

| التأكيد | عندَ الأساسِ `4e26fff` | بعدَ `da0e6d0` | **ما أضافتْه هذه الجولة** |
|---|---:|---:|---:|
| `[B12] CORE_BYTES` | `+22360` | `+25112` | **`+2752`** |
| `[B14] app.js` | `+22360` | `+24796` | **`+2436`** |
| `[B14] index.html` | **ناجح** | `+316` | **`+316`** (تأكيدٌ حمراءُ جديدةٌ سبّبتْها هذه الجولة) |
| المجموع | `74 passed, 2 failed` | `74 passed, 3 failed` | **`+1` فاشل** |

والحسابُ يُغلِق: `2436` (`app.js`) `+ 316` (`index.html`) `= 2752` وهو فرقُ `CORE_BYTES`
بالضبط. وموضعُ الأرقامِ الثلاثةِ كلِّها `sw.js`، وقطعُ `CORE_BYTES` والختمُ ومسُّ `sw.js`
محرَّمٌ في §٠ — **فلم يُقطَعْ ولم يُختَمْ ولم يُمَسّ**.

---

## ٧ · ما خالفَ حكمي فيه التقريرَ السابق (§٥)

1. **P2 — «كلتا الرايتَينِ تُنفَّذانِ في حارسِ المدينة».** التقريرُ السابقُ ناقشَ عددَ
   المدخلاتِ (١٦ لا ١٠) وصدّقَ «ثمانيةَ مواضع»، **ولم يلاحظْ أنّ `mushafsvg` لا يُنفَّذُ
   أصلًا**. القياسُ: `buildFlag()` يرفعُ `readMadinaImgFlag` وحدَها. فحكمي على هذا الموضعِ
   **أوسعُ كذبًا** ممّا قالَ.
2. **P2 — عددُ ذكرِ الرايتَينِ في حارسِ التغطية.** أوافقُ على `8` بوصفِها ورودًا **تنفيذيًّا**،
   وأزيدُ ما لم يُقَسْ هناك: `2` ورودٍ في تعليقاتِ الحارسِ، فالمجموعُ `10`. وهذا لا ينقضُ
   حكمَه، بل يمنعُ قراءةَ الرقمِ على غيرِ وجهِه.
3. **P4 — التقريرُ السابقُ قالَ إنّ «جملَ الألوانِ وصفٌ منفصل».** القياسُ يكذّبُ جملتَين
   منها: «الشريطُ اللونيُّ» بائدٌ منذُ الجلسةِ ٨٥، و«homeHero والترويسةُ والدُّرج» لا تكتبُ
   ذلكَ الشكلَ اليوم. **إضافتانِ منّي.**
4. **P5 — التقريرُ السابقُ سمّى `adhkar2-focus` وحدَها.** أزيدُ أنّ `.adhkar2-grid` بلا
   حاملٍ بالمرّة، ومعها مفتاحُ `adhkar2Tile`. **إضافةٌ منّي.**
5. **P10 — موضعٌ كاذبٌ كاملٌ لم يذكرْه التقريرُ السابق** (ترويسةُ الكتلة). **إضافةٌ منّي.**
6. **«عدد المواضع المصححة: 0»** في التقريرِ السابقِ كانَ حكمَ توقّفٍ لا حكمَ نثرٍ، وقد
   نُسِخَ بهذه الجولةِ: العددُ الآنَ **٧**.
7. **حكمُ التقريرِ السابقِ على P1 و P8 و P9 بالصدق: أوافقُ**، بعدَ إعادةِ قياسٍ مستقلّةٍ
   لكلِّ جملةٍ فيها — ومنها مؤقّتُ المكوثِ في P9، الذي لم يكنْ قد قِيسَ هناك بموضعِه.
8. **حكمُه على P3 و P6 و P7 بالكذب: أوافقُ**، وقيسَ كلُّ سببٍ من جديد.

---

## ٨ · ما لم يُقَسْ — مسمًّى ولا يُطوى

1. **لم أفتحِ التطبيقَ في متصفّح.** لا حاجةَ إليه هنا (لم يتحرّكْ سلوك)، لكنّي أُثبتُه
   صراحةً: **لم أقِسْ مظهرًا ولا أداءً ولا زمنَ إقلاعٍ قبلَ وبعد**. وبرهانُ §٢ برهانُ
   بايتاتٍ لا برهانُ شاشة.
2. **لم أقِسْ سلوكَ `?mushafsvg=0` على جهازٍ حقيقيٍّ بمخزنٍ يرمي.** الحكمُ في P6 مشتقٌّ من
   قراءةِ الدالّةِ سطرًا سطرًا، **لا من تشغيلٍ**. وهو استنتاجٌ من نصِّ الكودِ لا قياسٌ حيّ.
3. **لم أقِسْ لِمَ بقيَتْ `.adhkar2-grid` و`adhkar2Tile` بلا حامل** — هل نُزِعَ حاملُهما في
   الجلسةِ ٨٥ أم لم يُوصَلْ قطّ. أثبتُّ الحالَ اليومَ ولم أدّعِ سببًا.
4. **لم أنزعْ شيئًا ولم أُوصِ بنزع.** الأمرُ حرّمَه، وبقايا الشبكةِ المذكورةُ أعلاه
   **أُبلِّغُ عنها ولم أمسسْها**.
5. **لم أقِسْ أثرَ `+2436` بايتةً في `app.js` على زمنِ التحميل.** الزيادةُ تعليقاتٌ، وتُضغَطُ
   على الشبكةِ، **لكنّي لم أقِسْ ذلك** ولا أدّعيه.
6. **`recon WARN=1`** لم أفحصْ مضمونَه؛ هو قائمٌ من قبلِ هذه الجولةِ وبقيَ `1`.

---

## ٩ · الحدودُ والسلامة

- **صفرُ دفعٍ وصفرُ نشر.** لم يُشغَّلْ `git push` ولا `vercel`.
- **إيداعٌ واحد** (`da0e6d0`)، وبأسماءٍ صريحةٍ ثلاثةٍ: `app.jsx` و`index.html` و`app.js`.
  **لم يُستعملْ `git add .`**، ولم يدخلْ في الإيداعِ تقريرٌ ولا أمرٌ ولا ملفٌّ غيرُ متتبَّع.
- **لم يُمسّ حارسٌ ولا `gates.json` ولا `.gitattributes` ولا `sw.js` ولا `api/**` ولا
  `lib/**`.**
- **لم يُقطَعْ `CORE_BYTES`، ولم يُختَمْ شيءٌ، ولم يُرفَعِ اسمُ مخزن.**
- **لم تُكتَبْ في أيِّ ملفٍّ ولا في هذا التقريرِ العبارةُ التي حرّمَتْها §٣-١.**
- التقاريرُ والأوامرُ غيرُ المتتبَّعةِ أُعيدَتْ إلى الجذرِ بعدَ تشغيلِ البوّابات، وهي
  ثلاثةَ عشرَ ملفًّا كما كانت، ولم يُحذفْ منها شيء.

تعريفُ payload في الختم: كلُّ بايتة UTF-8 من أوّلِ الملفِّ حتّى نهايةِ هذا السطر، بما في ذلك
محرفُ LF الذي يليه، وقبلَ الفاصلِ النهائيِّ وحقلَي الختم.
---
PAYLOAD_BYTES=37927
sha256=58f41b93becc34b4594529642150a57094782dd73ace1c2ee8e4f98bc61e0fe9
