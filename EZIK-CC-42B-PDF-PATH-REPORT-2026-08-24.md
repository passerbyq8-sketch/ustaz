# EZIK — تقريرُ مسارِ تصديرِ PDF وحارسِه · ٤٢-ب · ٢٤ أغسطس ٢٠٢٦

**الأعطابُ الثلاثةُ التي وقفَ عندَها التقريرُ السابقُ أُغلِقَتْ · والحارسُ عُدِّلَ بأمرِ المالكِ الصريحِ وحدَه ثمّ رُئيَ ساقطًا ثلاثَ مرّاتٍ · وخرجَتْ ٩٠٦ كيلوبايتٍ من الشجرةِ خروجًا تامًّا. لا دفعَ ولا نشر.**

---

## ١ · الأساسُ والفرعُ والإيداعات

| المفتاح | القيمة |
|---|---|
| الشجرة | `C:\Users\passe\projects\ustaz` |
| الأساس | `fix/reply-card-pdf-20260824` عندَ **`cfac9d3`** — **مقيسٌ ومطابقٌ** لما توقّعَه الأمر |
| الفرع | **هو نفسُه** — بُنيَ فوقَه، **ولم يُقطَعْ فرعٌ جديدٌ من `main`** كما تأمرُ §٠ |
| الرأسُ الآن | **`9242a594b0052ebd4d0454ba4e361c7cecb72b13`** |
| `origin/main` | `80007538e6c2ac9e38a5992734d30dd55b2d6fe5` — لم يُمَسَّ |

| # | الإيداع | ما مسَّ |
|---|---|---|
| ١ | **`a049492`** | `app.jsx` · `app.js` (مولَّدٌ) · `index.html` · **`theme-coverage-guard.cjs`** — قلبُ الأوّليّة، وخروجُ الحزمةِ من خريطةِ الموردين، وتعديلُ الحارس |
| ٢ | **`9242a59`** | `theme-coverage-guard.cjs` · `EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md` — عاقبتانِ كشفَهما الطقمُ، كلٌّ بعلّتِها (§٧) |

**وما لم يُمَسَّ، مقيسًا بالفرقِ لا بالنيّة:** `api/` صفرُ ملفّ · `lib/` صفرُ ملفّ · `sw.js` صفرُ سطر · البطاقةُ `ezikDrawReplyCard` صفرُ سطر · وأيُّ حارسٍ سوى `theme-coverage-guard.cjs` **صفرُ ملفّ**.

---

## ٢ · القياسُ أوّلًا (§١) — ما كانَ الحارسُ يفعلُه بالضبط

قُرِئَتِ الكتلةُ `Z` من الحارسِ ذاتِه لا من التقريرِ السابق. **وهي ليست ثلاثةَ تأكيداتٍ بل إحدى عشرَ**، ثلاثةٌ منها فقط تثبّتُ الأوّليّة:

| السطر | التأكيد | ماذا يمنعُ |
|---|---|---|
| `4546–4548` | `Z1: the lazy vendor loader is still what fetches html2pdf` | 🔴 **يثبّتُ الأوّليّة** — يوجبُ أن تُعلِنَ خريطةُ الموردين الحزمة |
| `4549–4551` | `Z1: ...and html2pdf is on no <script src> in the document` | 🟢 يمنعُ الضرر (تحميلٌ عندَ الإقلاع) |
| `4552` | `Z1: the app has exactly one PDF path` | 🟢 محايدٌ نافع |
| `4553–4555` | `Z1: ...and it still awaits the lazy bundle and degrades to print()` | 🔴 **يثبّتُ الأوّليّة** — يوجبُ `await …('html2pdf')` وحرفَ الاحتياطِ نفسَه |
| `4595–4596` | `Z5: exactly TWO canvas rasterisations` | 🟢 يمنعُ الضرر |
| `4597–4598` | `Z5: one is the upload downscaler` | 🟢 |
| `4599–4602` | `Z5: the other is the share card, which rasterises NO DOM` | 🟢 |
| `4603–4604` | `Z5: which draws an image element, not a DOM subtree` | 🟢 |
| `4605–4606` | `Z5: no DOM-to-image library entered the tree` | 🟢 |
| `4607–4608` | `Z5: ...html2canvas is named as an OPTION and never constructed or called` | 🟡 **نصفُه يمنعُ الضرر ونصفُه يثبّتُ الأوّليّة** — شرطانِ بـ`&&` |
| `4617–4624` | `Z5: CORE precaches no document-tool bundle` + الثلاثةُ التي يحتاجُها الإقلاع | 🟢 |

### ٢-١ · 🔴 فرضيّةٌ في تقريري السابقِ كذّبَها هذا القياس

اقتبسَ `EZIK-CC-42-CARD-PDF-REPORT-2026-08-24.md` §٥-١ **ثلاثةَ** أسطرٍ بوصفِها المانع: `4552` و`4553–4555` و`4607–4608`.
**المقيسُ الآنَ يقولُ غيرَ ذلك في طرفَين:**

- **`4552` لا يثبّتُ الأوّليّةَ أصلًا** — يعدُّ مساراتِ PDF ولا يذكرُ حزمةً. **بقيَ كما هو حرفًا.**
- **`4546–4548` يثبّتُها وأغفلَه التقريرُ السابق** — وهو الذي يوجبُ وجودَ الحزمةِ في خريطةِ الموردين، ولولا إسقاطُه لما أمكنَ إخراجُها.

فالمانعُ ثلاثةٌ عددًا، لكنّها ليست الثلاثةَ التي سُمِّيَتْ. **العددُ صحَّ والمواضعُ لم تصحّ**، ولهذا أمرَتْ §١-٢ بقياسِها لا بنقلِها.

### ٢-٢ · `printAsPdf` كما كانت — وحدودُها

`app.jsx:2391–2414`، أربعةٌ وعشرونَ سطرًا: تملأُ `#print-area`، ثمّ **تنتظرُ المورِدَ**، ثمّ — إن نزلَ — تبني `opt` فيه `html2canvas: { scale: 2, useCORS: true }` و`jsPDF`، وتستنسخُ العقدةَ وتُرَستِرُها. `window.print()` كانت **السطرَ الاحتياطيَّ الوحيد** (`2399`)، لا تُبلَغُ إلّا إذا سقطَ التحميل.

---

## ٣ · التأكيداتُ قبلَ وبعدُ — بنصِّها

### ٣-١ · ما **سقطَ**، وهو الادّعاءُ الذي كذّبَه القياسُ وحدَه

```js
// -- REMOVED (theme-coverage-guard.cjs:4546-4548) ------------------------------
ok('Z1: the lazy vendor loader is still what fetches html2pdf',
  vendAt !== -1 && /html2pdf: \['https:\/\/[^']+html2pdf\.bundle\.min\.js'/.test(html),
  'the lazy vendor map no longer declares html2pdf');

// -- REMOVED (theme-coverage-guard.cjs:4553-4555) ------------------------------
okOn('Z1: ...and it still awaits the lazy bundle and degrades to print()', [['html', html]],
  /await window\.__ezikVendor\('html2pdf'\)/.test(html)
  && /if \(!window\.html2pdf\) \{ document\.title = title; window\.print\(\); return; \}/.test(html));

// -- HALF REMOVED (theme-coverage-guard.cjs:4607-4608) -------------------------
ok('Z5: ...and html2canvas is named as an OPTION and never constructed or called',
  !/html2canvas\s*[.(]/.test(html) && /html2canvas: \{ scale: 2, useCORS: true \}/.test(html));
//                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ this half only
```

**لماذا سقطَتْ:** لأنّها تثبّتُ أنّ المُرَستِرَ **هو** مسارُ التصدير. وذلك مقيسٌ خاطئًا: ٣٤٤ مقطعًا من ٣٤٤ رُسِمَتْ بأساسٍ يساريّ، و٦٤ زوجًا من ٣٢٠ التصقَ، والعنوانُ معها. **والمالكُ أمرَ بإسقاطِها نصًّا وفي العلن** (`ORDER-PDF-PATH-42B.md` §٢-٢)، وهذه الملحوظةُ مكتوبةٌ في الحارسِ نفسِه فلا يحتاجُ أحدٌ أن يخمّنَ بعدَ سنةٍ لمَ ذهبَ التثبيت.

### ٣-٢ · ما **بقيَ**، مُوَسَّعًا لا مُضيَّقًا

| ما بقي | كان | صار |
|---|---|---|
| منعُ التحميلِ عندَ الإقلاع | `html2pdf` وحدَه في `<script src>` | **سبعةُ أسماءٍ**: `html2pdf\|html2canvas\|mammoth\|jspdf\|dom-to-image\|domtoimage\|satori` |
| منعُ استدعاءِ مُرَستِرِ DOM | `!/html2canvas\s*[.(]/` | **هو نفسُه ومعه** `html2pdf` و`domtoimage` و`htmlToImage` و`satori` |
| مسارُ PDF واحدٌ | `4552` | **حرفًا بحرف، لم يُمَسّ** |
| بقيّةُ `Z5` السبعة | — | **حرفًا بحرف، لم تُمَسّ** |

```js
// -- KEPT AND WIDENED ----------------------------------------------------------
ok('Z1-B: ...and NO document bundle is a <script src> on the boot path',
  !/<script[^>]+src=["'][^"']*(html2pdf|html2canvas|mammoth|jspdf|dom-to-image|domtoimage|satori)/i.test(html),
  'a heavy document bundle came back as a boot-blocking script tag');

ok('Z5: ...and NO DOM rasteriser is ever constructed or called anywhere in the client',
  !/html2canvas\s*[.(]/.test(html) && !/html2pdf\s*[.(]/.test(html)
  && !/\b(domtoimage|htmlToImage|satori)\s*[.(]/.test(html),
  'a DOM rasteriser is being constructed or called');
```

### ٣-٣ · ما **دخلَ** — محاسبةٌ بالأسماء، لا قائمةَ ممنوعات

الأمرُ حرَّمَ في §٢-٢ أن يُوسَّعَ عدُّ الحارسِ أو يُضيَّقَ نمطُه أو يُكتَبَ الكودُ بحيثُ يخطئُه النمط. **فالتأكيدُ الجديدُ لا يسألُ «هل تجنَّبَ كذا» بل «سمِّ كلَّ ما تفعل»**: تُجمَعُ **كلُّ** دالّةٍ تُنادى داخلَ `printAsPdf` وتُقابَلُ **المجموعةُ** بجدولٍ مصرَّحٍ به. فمسارٌ لم يخطرْ على بالِ كاتبِ الحارسِ **يسقطُ باسمِه هو** لا بنمطٍ لم يُكتَبْ من أجلِه.

```js
const EXPORT_CALLS = [
  'document.getElementById',    // the print area the document is written into
  'escapeHtml',                 // the title, escaped before it is written
  'Promise',                    // the latch that lets one press produce one document
  'window.addEventListener',    // afterprint
  'window.removeEventListener', // ...and its removal, so a second export cannot fire the first
  'window.print',               // THE EXPORT. The browser's own engine, and the only one.
  'setTimeout',                 // the backstop, for engines that never deliver afterprint
  'onBackstop',                 // ...called directly when print() throws
  'resolve',                    // settles the latch
];
```

وثلاثةُ أحكامٍ عليها: **لا نداءَ خارجَ الجدول** · **ولا سطرَ في الجدولِ بلا نداءٍ** (فلا يشيخُ الجدولُ صامتًا) · **و`window.print` موجودٌ قطعًا**. ومعها محاسبةٌ ثانيةٌ على خريطةِ الموردينِ نفسِها: `VENDOR_ENTRIES = ['mammoth']` ولا شيءَ سواه.

**والعدُّ ارتفعَ ولم ينخفض: `1346/1346 ⟶ 1351/1351` — خمسةُ تأكيداتٍ أكثرُ، لا أقلّ.**

---

## ٤ · برهانُ سقوطِ الحارس (§٢-٢) — بنصِّه

ثلاثُ طفراتٍ، كلٌّ **مُتحقَّقٌ أنّها غيّرَتِ البايتاتِ فعلًا** قبلَ تشغيلِ الحارس (فطافرٌ لا يغيّرُ شيئًا يُبلِغُ نجاحًا كاذبًا)، وكلٌّ استُعيدَتْ ببصمةٍ مطابقة:

```
================================================================
M1 — the rasteriser is called from the export path again
  sha256 before   : fe5a634e9e389de6
  sha256 mutated  : fba48d6ac2bf835b   (the mutation really applied)
  guard tally     : FAIL: 1346/1351 checks passed.
  THE GUARD SAID  :
    FAIL  Z1-A: ...and every call it makes is one this guard names
        the export path calls window.html2pdf, from, save -- which is not in EXPORT_CALLS.
        An export mechanism that is not named here has not been reviewed.
    FAIL  Z1-A: ...and every call this guard names is still made
        EXPORT_CALLS declares window.print, which the export path no longer calls --
        the table has gone stale, which is how a guard stops guarding.
    FAIL  Z1-A: ...and the export IS the browser print engine
        printAsPdf no longer calls window.print() -- something else is producing the document
    FAIL  Z1-A: ...and no bundle, rasteriser or canvas is named on that path at all
        the export path names a rasteriser or a vendor bundle again
    FAIL  Z5: ...and NO DOM rasteriser is ever constructed or called anywhere in the client
        a DOM rasteriser is being constructed or called
  sha256 restored : fe5a634e9e389de6   IDENTICAL to before, byte for byte
================================================================
M2 — the 906KB bundle is put back in the lazy vendor map
  sha256 before   : 3672754120b0a40a
  sha256 mutated  : ace2f4ecfef4bf2a   (the mutation really applied)
  guard tally     : FAIL: 1349/1351 checks passed.
  THE GUARD SAID  :
    FAIL  Z1-B: the lazy vendor map declares exactly the bundles this guard names
        the vendor map declares [html2pdf, mammoth] and this guard names [mammoth]
    FAIL  Z5: ...and NO DOM rasteriser is ever constructed or called anywhere in the client
        a DOM rasteriser is being constructed or called
  sha256 restored : 3672754120b0a40a   IDENTICAL to before, byte for byte
================================================================
M3 — an export mechanism nobody named replaces window.print()
  sha256 before   : fe5a634e9e389de6
  sha256 mutated  : 2aa1cc0074dc6502   (the mutation really applied)
  guard tally     : FAIL: 1348/1351 checks passed.
  THE GUARD SAID  :
    FAIL  Z1-A: ...and every call it makes is one this guard names
        the export path calls window.__ezikExportSomehow -- which is not in EXPORT_CALLS.
        An export mechanism that is not named here has not been reviewed.
    FAIL  Z1-A: ...and every call this guard names is still made
    FAIL  Z1-A: ...and the export IS the browser print engine
  sha256 restored : fe5a634e9e389de6   IDENTICAL to before, byte for byte
================================================================
after every restore, the clean tree: OK: 1351/1351 checks passed.   exit=0
```

**و`M3` هو الذي يبرهنُ على المحاسبةِ بالأسماء:** `window.__ezikExportSomehow` اسمٌ لم يخطرْ ببالِ أحدٍ ولا يوجدُ في أيِّ قائمةِ ممنوعات، **وسقطَ الحارسُ عليه باسمِه**. وقائمةُ الممنوعاتِ وحدَها كانت ستمرّرُه.

**والشجرةُ نظيفةٌ بعدَ الطفراتِ الثلاث:** `git status --porcelain` صفرُ سطر.

---

## ٥ · أرقامُ §٣ التسعة

**١ إلى ٧ على الجوابِ الثابتِ نفسِه** الذي قِيسَ في الجولةِ السابقة، ليصحَّ التقابل. **و`printAsPdf` المشحونةُ نفسُها هي التي تبني المستند**: مسلوخةً من `app.jsx` بعلاماتِها، مشغَّلةً في متصفّحٍ حقيقيّ، و`window.print()` مُوقَفةٌ بمسجِّلٍ لا غير — ثمّ تُرسَمُ الصفحةُ بمحرِّكِ الطباعةِ نفسِه عبرَ `Page.printToPDF`.

| # | المقياس | الشرط | **المقيس** | |
|---|---|---|---|---|
| ١ | العنوانُ نصًّا | `ردُّ عزك` بفراغِه | **`ردُّ عزك`** · و`document.title` لحظةَ الطباعة **`ردُّ عزك`** · و`window.print` نُوديَتْ **مرّةً واحدة** | ✅ |
| ٢ | أزواجٌ ملتصقة | `0` | **`0`** من **`272`** زوجًا فُحِصَتْ | ✅ |
| ٣ | أسطرٌ تبدأُ بترقيمٍ نهائيّ | `0` | **`0`** من `20` سطرًا | ✅ |
| ٤ | متراكبةٌ · عابرةٌ لحدِّ صفحة | `0` و`0` | **`0`** و**`0`** | ✅ |
| ٥ | هروبُ `%XX` | `0` | **`0`** | ✅ |
| ٦ | أسطرٌ تتجاوزُ عرضَ الصفحة | `0` | **`0`** · وأعرضُ سطرٍ `755` من `764` · وصفرُ كتلةٍ فائضة | ✅ |
| ٧ | نوعُ الملفّ | نصٌّ لا صورة | **`0` صورةٍ مضمَّنة · `0` مجرى `DCTDecode` · `2` خطٍّ مضمَّن · `38,923` بايتة** | ✅ |
| ٨ | جوابٌ طويلٌ فوقَ صفحة | صفحتانِ فأكثرُ · `0` و`0` | **`3` صفحات** · انظر §٥-١ | ✅ |
| ٩ | سقوطُ الحارس | نصُّه + استعادةٌ مطابقة | **§٤** — ثلاثُ طفراتٍ · ثلاثُ استعاداتٍ مطابقة | ✅ |

**والمقابلةُ مع ما كانَ يخرجُ بالأمس، على الجوابِ نفسِه:**

| | `html2pdf` (أمس) | **طباعةُ المتصفّح** (اليوم) |
|---|---|---|
| العنوان | `ردُّعزك` | **`ردُّ عزك`** |
| أزواجٌ ملتصقة | `64` من `320` | **`0`** من `272` |
| أساسُ اتّجاهِ المقاطع | `ltr` في `344` من `344` | اتّجاهُ المستندِ نفسِه |
| صورٌ مضمَّنة | `1` (صفحةٌ مسطَّحة) | **`0`** |
| خطوطٌ مضمَّنة | `0` | **`2`** |
| الحجم | `358,167` بايتة | **`38,923`** بايتة — **أقلُّ بـ٨٩٪** |

### ٥-١ · §٣-٨ · انتقالُ الصفحةِ — العطبُ الذي لم يُعَدْ إنتاجُه بالأمس

جوابٌ طويلٌ (`4,558` محرفًا) صُدِّرَ عمدًا فخرجَ في **ثلاثِ صفحات**. **والقياسُ من داخلِ الملفِّ لا من الـDOM**: مجاري المحتوى فُكَّ ضغطُها وسِيرَ على مؤثِّراتِها بحالةِ رسمٍ حقيقيّةٍ (`q`/`Q`/`cm`/`Tm`/`Td`/`TL`)، فكلُّ مؤثِّرِ إظهارِ نصٍّ أعطى خطَّ أساسٍ في فضاءِ الجهاز.

```
pages                        3
linesPerPage                 25 · 26 · 10        (61 سطرًا، 4218 مؤثِّرَ إظهار)
smallestBaselineGapPerPage   25.91 · 25.91 · 25.91   ← خطوةُ سطرٍ كاملةٌ في كلِّ صفحة
overlappingLines             0
linesClippedByThePageEdge    0
```

**وأصغرُ فجوةِ خطِّ أساسٍ في كلِّ صفحةٍ هي خطوةُ السطرِ الكاملةُ نفسُها** — فلا حرفَ فوقَ حرف، ولا سطرَ نصفُه في صفحةٍ ونصفُه في أخرى.

**والمحلِّلُ يرفضُ أن يشهدَ على لا شيء**: إن لم يجدْ مؤثِّرَ إظهارٍ واحدًا خرجَ بـ`ABORT` بدلَ أن يُبلِغَ «صفرَ أعطاب». وقد وقعَ ذلك فعلًا في أوّلِ نسخةٍ منه (لم يكن يقرأُ السلاسلَ السّتّ‌عشريّةَ `<...> Tj`) فطبعَ أصفارًا كاذبةً — **وهي فرضيّةٌ كذّبَها القياسُ في أداتي أنا، مذكورةٌ في §٨-٢.**

---

## ٦ · أثرُ خروجِ الحزمةِ على وزنِ ما يُشحَن (§٤-٥)

| السؤال | الجواب المقيس |
|---|---|
| أكانَتِ الحزمةُ في المستودع؟ | **لا** — `git ls-files` صفرُ ملفٍّ باسمِها. تُجلَبُ من cdnjs عندَ أوّلِ استعمال. |
| أكانَتْ في `CORE`؟ | **لا** — و`Z5` يمنعُ ذلك صراحةً منذُ البند ٣٢. |
| **فكم أسقطَتْ من المنشور؟** | **`0` بايتة.** لم تكنْ منشورةً من هذا المضيفِ يومًا. **والادّعاءُ بغيرِ ذلك كذبٌ**، ولذلك أمرَتْ §٢-١ بقياسِه. |
| **فماذا أسقطَتْ إذن؟** | **`906,041` بايتةً من طرفٍ ثالثٍ** كانَ يدفعُها القارئُ **عندَ أوّلِ تصديرٍ يضغطُه**. صارَتْ **صفرًا**: مسارُ التصديرِ لا يجلبُ شيئًا ألبتّة. |
| وتبعيّةُ سلسلةِ التوريد | **واحدةٌ أقلّ.** خريطةُ الموردينِ كانت مدخلَين وصارَتْ **مدخلًا واحدًا** (قارئُ `.docx`). |
| و`index.html` نفسُها | **`120,813 ⟶ 120,862` بايتةً في الـblob** — سطرُ الحزمةِ (`210` بايتة) خرجَ، ونصُّ الملحوظةِ الذي يشرحُ خروجَه دخل. |

**والفرقُ الذي لا يُقاسُ ببايتات:** التصديرُ كانَ يعملُ **بشبكةٍ فقط** — قارئٌ بلا شبكةٍ يضغطُ «PDF» فيسقطُ التحميلُ ويقعُ على الاحتياط. الآنَ **يعملُ دونَ شبكةٍ دائمًا**، لأنّه لم يعدْ فيه ما يُجلَب.

---

## ٧ · البوّابات

`summary.json` ⟸ `head_before = 9242a59…` · `head_after = 9242a59…` · `dirty_before = 0` · `dirty_after = 0` · `tree_dirtied_by_run = false`
المجلَّد: `…\Temp\ezik-gates\runs\2026-08-24T11-11-06-371Z-14604`

| البوّابة | الشرط | **المقيس** | |
|---|---|---|---|
| الروستر | `93` | **`93`** | 🟢 |
| `themecoverage` | **خضراءُ بعدَ التعديل** | **`OK: 1351/1351 checks passed`** (كانت `1346/1346`) | 🟢 |
| `recon` | `185/1/0` | **`SUMMARY PASS=184 WARN=1 FAIL=0`** | 🟡 §٧-١ |
| الإنذارُ الوحيد | المعروف | `[WARN] LONGEST_CARD_CHARS = 3405 > longest card 3401 -> cap oversized/stale (re-derive in api/report.js)` | 🟢 |
| حارسُ الدروس | `269` | `=== 269/269 - PASS ===` | 🟢 |
| `markdown` | — | `OK: 121/121 checks passed` | 🟢 |
| `vacuousassert` | — | `PASS 33 checks passed, 0 failed` | 🟢 |
| `SUITE` | — | **`92/93`** · `FAILING (1): bankintegrity=1` | 🟡 متوقَّع |
| `bankintegrity` | تحمرُّ بـ`CORE_BYTES` وحدَه | `FAIL 74 checks passed, 3 failed` | 🔴 **بأمرٍ صريح** |

### ٧-١ · 🔴 فرضيّةُ الأمرِ التي كذّبَها القياس: `recon` صارَ `184/1/0` لا `185/1/0`

**والسببُ مقيسٌ بسطرِه:** `recon-audit.cjs:426` يُصدِرُ `pass('pinned: ' + u)` **لكلِّ رابطِ CDN مثبَّتٍ** يجدُه في `index.html`. وقد خرجَ رابطُ الحزمةِ، **فنقصَ نجاحٌ واحدٌ لأنّ التبعيّةَ التي كانَ يشهدُ لها لم تعدْ موجودة.**

**وليسَ هذا خفضَ أرضيّةٍ لتمرَّ بوّابة**: لا تأكيدَ نُزِعَ ولا استثناءَ وُسِّع. الشيءُ الوحيدُ الذي تغيّرَ أنّ في الشجرةِ تبعيّةً خارجيّةً **أقلّ**.

وتَبِعَه أنّ `recon` بندَ ١٦ سقطَ لأنّ `EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md:366` صارَ يذكرُ عددًا قديمًا — **وهذا بالضبطِ ما وُجِدَ البندُ ١٦ من أجلِه**. صُحِّحَتِ الوثيقةُ لتقولَ ما يقيسُه `recon`:

```
RECON              PASS=184 WARN=1 FAIL=0   ⟶   RECON              PASS=183 WARN=1 FAIL=0
```

(العددُ في الوثيقةِ هو المجموعُ **قبلَ** أن يفحصَ البندُ ١٦ نفسَه، فالمجموعُ النهائيُّ `184`.) **وهذه وثيقةٌ لا حارس** — `.md` في الجذر — فلا تدخلُ في «أيُّ حارسٍ غيرِ المسمّى في §٢».

### ٧-٢ · `vacuousassert` — بوّابةٌ ثانيةٌ أمسكَتْ حارسي الجديد

كتبتُ حمايةَ الفراغِ `printSrc !== '' &&`، فسقطَتْ `vacuousassert` على `theme-coverage-guard.cjs:4619` وطلبَتِ الصيغةَ التي تسمّيها هي: `printSrc.length > 0 &&`. **كُتِبَتْ كما طلبَتْ.** ولم تُمَسَّ البوّابةُ نفسُها بحرف — وهي ليست في §٢، فتعديلُها كانَ محرَّمًا وما كانَ ليصحّ.

### ٧-٣ · فرقُ `CORE_BYTES` — **مُعلَنٌ رقمًا ولا يُصلَح**

```
FAIL [B12] CORE_BYTES = 1854255 but CORE weighs 1862145 bytes on disk (+7890).
FAIL [B14] sw.js prose says index.html is 121979 bytes; the disk says 122568 (+589).
FAIL [B14] sw.js prose says app.js is 1019495 bytes; the disk says 1026796 (+7301).
```

| | الجولةُ السابقة | الآن | فرقُ هذه الجولة |
|---|---|---|---|
| `index.html` | `122517` | `122568` | **`+51`** |
| `app.js` | `1024390` | `1026796` | **`+2406`** |
| **`CORE_BYTES` على القرص** | `1859688` | `1862145` | **`+2457`** |

`2457 = 51 + 2406` بالبايتةِ الواحدة. **و`sw.js` لم يُمَسَّ ولا خَتْمَ ولا اسمَ مخزن** — كلُّها محرَّمةٌ في §٠ وكلُّها ملكُ جولةِ الدمج.

---

## ٨ · العيّنة · وما لم يُقَسْ · وما كذّبَه القياس

### ٨-١ · مسارُ العيّنة — خارجَ المستودع

```
C:\Users\passe\AppData\Local\Temp\claude\C--Users-passe-projects-ustaz\
  5b0a4c83-a6f1-45cf-bf24-69f9735ef7d7\scratchpad\42\samples42b\

  00-pdf-BEFORE-html2pdf-for-comparison.pdf      358,167 بايتة  ← ما كانَ يخرجُ أمس
  00-pdf-BEFORE-html2pdf-page1.jpg               354,802 بايتة  ← صفحتُه صورةً، للنظرِ السريع
  01-pdf-AFTER-browser-print-same-reply.pdf       38,923 بايتة  ← الجوابُ نفسُه، اليوم
  02-pdf-AFTER-browser-print-THREE-PAGES.pdf      51,942 بايتة  ← الجوابُ الطويل، ثلاثُ صفحات
```

**افتحْ `01` مقابلَ `00`**: العنوانُ فيه فراغُه، والكلماتُ منفصلةٌ، والفواصلُ في أواخرِ الأسطرِ لا أوائلِها. **وجرّبْ أن تُظلِّلَ نصًّا في `01` وتنسخَه** — ينسخُ، لأنّه نصٌّ. جرّبْ ذلك في `00` فلن يُظلِّلَ شيئًا، لأنّه صورة.

### ٨-٢ · فرضيّاتٌ كذّبَها القياسُ في هذه الجولة

1. **🔴 مواضعُ المانعِ في تقريري السابقِ كانت خاطئةً في طرفَين** — §٢-١. العددُ ثلاثةٌ والمواضعُ ليست الثلاثةَ التي سُمِّيَتْ.
2. **🔴 `recon 185/1/0` في §٣ من الأمرِ صارَ `184/1/0`** — §٧-١، والسببُ سطرٌ بعينِه.
3. **🟡 قياسي الأوّلُ لعبورِ حدِّ الصفحةِ كانَ خاطئًا.** قِستُه على الـDOM غيرِ المُصفَّحِ بحسابٍ مسطَّحٍ، فأعطى `1` عابرًا — **والمُصفِّحُ لا يقصُّ سطرًا بل يُنزِلُه**، فالسطرُ الذي أبلغتُ عنه هو بعينِه السطرُ الذي نُقِلَ ولم يُقَصّ. أُلغيَ المقياسُ وقُرِئَ الملفُّ نفسُه: `0`.
4. **🟡 وأداتي لقراءةِ الملفِّ كذّبَها القياسُ مرّتَين:** أوّلًا لم تكنْ تقرأُ `<hex> Tj` فأبلغَتْ عن **صفرِ أسطرٍ** ثمّ **صفرِ أعطاب** — وهو النجاحُ الأجوفُ بعينِه، فأُضيفَ لها `ABORT` يمنعُها من الشهادةِ على لا شيء. وثانيًا كانت تعدُّ حركةَ الشدّةِ في «ردُّ» سطرًا ثانيًا متراكبًا (رفعُ قلمٍ مقدارُه `1.78` نقطة)، فصارَ التجميعُ بنسبةٍ من حجمِ الخطِّ لا برقمٍ ثابت.

### ٨-٣ · ما لم يُقَسْ — يُسمّى ولا يُطوى

1. **لم أفتحِ التطبيقَ الحيَّ ولم أضغطْ زرَّ «PDF» بإصبعي.** المقيسُ أنّ `printAsPdf` المشحونةَ تملأُ `#print-area` وتنادي `window.print()` **مرّةً واحدة** بعنوانِ المستندِ الصحيح — بمسجِّلٍ يحلُّ محلَّ `print`. **لم أرَ ورقةَ الطباعةِ تُفتَح**، ولا اخترتُ «حفظ كـPDF» بيدي.
2. **🔴 ولم أختبرْ ما يراهُ القارئُ على iOS.** التغييرُ الوحيدُ الذي يلمسُه: تُفتَحُ ورقةُ الطباعةِ بدلَ نزولِ ملفٍّ إلى التنزيلات. على المكتبِ وجهتُها «Save as PDF»؛ على iOS هي ورقةُ المشاركةِ و«Save to Files». **هذا مقروءٌ من التوثيقِ لا مقيسٌ على جهاز**، وهو أهمُّ ما يستحقُّ عينَ المالك.
3. **لم أختبرْ `afterprint` على محرِّكٍ لا يُرسِلُه.** الاحتياطُ مؤقّتٌ بستّينَ ثانية، وقد قِيسَ **بأنّه مكتوبٌ**، لا بأنّه أُطلِقَ.
4. **`Page.printToPDF` وكيلٌ عن `window.print()` لا هو.** المحرِّكُ واحدٌ والصحيفةُ واحدةٌ والتصفيحُ واحدٌ، لكنّ المسارَ الذي يسلكُه المستخدمُ يمرُّ بورقةِ الطباعةِ ولم أمرَّ بها.
5. **الخطُّ مُقاسٌ على Chrome/Windows.** `"Amiri"` غيرُ محمَّلٍ هنا فيقعُ على `"Arial"`. **اللفُّ وعددُ الأسطرِ وعددُ الصفحاتِ ستختلفُ حيثُ يوجدُ Amiri**؛ المقيسُ هو الاتّجاهُ والفواصلُ والتصفيحُ لا مظهرُ الخطّ.
6. **لم أقِسْ بطاقةَ المستندِ (`docToHtml` على الشاشة)** بعدَ هذه الجولة. لم أمسَّ `docToHtml` هنا، و`markdown` خضراءُ `121/121`.
7. **🟡 `sw.js` يحملُ ثلاثَ ملحوظاتٍ صارَتْ كاذبةً** — السطورُ `22` و`28` و`34` ما تزالُ تقولُ إنّ حزمةَ الـPDF تُجلَبُ عندَ أوّلِ تصدير. **§٢-٣ تحرّمُ مسَّ `sw.js`، فتُرِكَتْ.** **مُبلَّغةٌ للمالك، وتُصلَحُ في جولةِ الدمجِ التي تملكُ `sw.js` أصلًا.**
8. **لم أشغّلْ أيَّ بوّابةٍ ثلاثَ مرّاتٍ لفرزِ الرفرفة.** الطقمُ مرّتَين: الأولى كشفَتْ عاقبتَي §٧-١ و§٧-٢، والثانيةُ بعدَ إصلاحِهما.
9. **`ORDER-PDF-PATH-42B.md` وتقريرُ الجولةِ السابقةِ نُقِلا من جذرِ الشجرةِ** إلى مجلَّدِ العملِ المؤقّتِ قبلَ القياس، لأنّ `run-gates` يخرجُ بـ`1` على أيِّ اتّساخ. نسخُهما محفوظةٌ ولم يُحذَفْ محتواهما.
10. **البندُ ٤٢-ج ما يزالُ مفتوحًا.** أمرُ الجولةِ السابقةِ قالَ إنّه لا يُغلَقُ حتّى يرى المالكُ البطاقةَ والـPDF سليمَين بعينِه. **لم أغلقْه.**

---

## ٩ · الحال

```
origin/main                        80007538e6c2ac9e38a5992734d30dd55b2d6fe5   (لم يُمَسَّ)
fix/reply-card-pdf-20260824  HEAD  9242a594b0052ebd4d0454ba4e361c7cecb72b13
الإيداعاتُ فوقَ الأساس              a049492 · 9242a59
حارسٌ عُدِّل                        theme-coverage-guard.cjs وحدَه — بأمرٍ صريحٍ من المالك
حارسٌ آخرُ مُسَّ                    صفر
مكتبةٌ أو CDN أُضيف                 صفر  (وواحدةٌ خرجَتْ: 906,041 بايتة)
بندٌ جديدٌ فُتِح                     صفر
دفع · نشر                          صفر
```

**تُنتظَرُ كلمةُ المالكِ بعدَ فتحِ العيّنتَين.**

---


REPORT_PAYLOAD_BYTES=30709
REPORT_SHA256=c8bd5e483ca8c683e3435cbb2ae1f797feea351afa60e2199c9a72ecdd4fa2e2
REPORT_SHA8=c8bd5e48

(الحمولةُ المختومةُ: كلُّ بايتةٍ حتّى سطرِ الفصلِ الأخيرِ وسطرِه الجديدِ بعدَه، قبلَ إلحاقِ هذه الأسطر. أُعيدُ قطعَها بـ `head -c 30709 <file> | sha256sum`.)
