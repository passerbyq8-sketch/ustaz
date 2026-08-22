# تقريرُ إغلاقِ جولةِ الدمجِ ٢٦ — ٢٠٢٦-٠٨-٢٢

**الحال:** وقوفٌ في §٢ قبلَ إيداع الحارس.  
**سبب الوقوف:** `STOP_REASON=BANKINTEGRITY_STANDALONE_USAGE_EXIT_2`  
**الدفع:** `PUSHES=0` · `PUSH_READY=NO`

هذا تقريرُ قياسٍ بلا حكم.

---

## ١ · بوّاباتُ ما قبلَ العمل

| المفتاح | المقيس | الشرط | الحصيلة |
|---|---|---|---|
| `ORDER_MOVED` | `True` إلى `C:\EZIK-STAGE\orders\ORDER-MERGE-26-CLOSE.md` | `True` | مطابق |
| `CURRENT_BRANCH` | `main` | `main` | مطابق |
| `HEAD` | `5d7f1eb02bad89ea760320de9f7d16a79d210afc` | يُطبع كاملًا | مقيس |
| `F9C70FD_IS_ANCESTOR_EXIT` | `0` | `0` | مطابق |
| `DIRTY_LINES` | `0` بعدَ نقل الأمر | `0` | مطابق |
| `ORIGIN_MAIN` | `4c9531cb4687ed9f576fe047aa21b130f692b3ff` | القيمةُ المعيّنة | مطابق |

لم يُعَد الدمج، ولم يُلمس `app.jsx` ولا `app.js` ولا `index.html` ولا `sw.js`.

---

## ٢ · بنيةُ `SW_PROSE` قبل الرقعة

طُبعت البنيةُ على الطرفية بأرقام أسطرها. وهذه مدخلاتُها كما قُرئت:

```text
1264:    const SW_PROSE = [
1265:      { n: 120617, of: 'index.html' },
1268:      { n: 947721, of: 'app.js' },
1269:      { n: 131835, of: 'vendor/react-dom.umd.js' },
1270:      { n: 10751, of: 'vendor/react.umd.js' },
1271:      { n: 368386, of: 'icon-watermark.png' },
1272:      { n: 177392, of: 'adhkar.json' },
1273:      { n: 12893, of: 'icon-512.png' },
1274:      { n: 5938, of: 'icon-maskable-512.png' },
1275:      { n: 5053, of: 'icon-192.png' },
1276:      { n: 533, of: 'manifest.json' },
1277:      { n: 1412005, of: 'quran-uthmani.json' },
1278:      { n: 996528, of: 'mushaf-layout.json' },
1279:      { n: 18132, of: 'worship-display.json' },
1280:      { n: 2408533, sum: ['quran-uthmani.json', 'mushaf-layout.json'] },
1282:      { n: 604, dir: 'count' },
1283:      { n: 66012516, dir: 'sum' },
1284:      { n: 109292, dir: 'mean' },
1285:    ];
```

وكان `SW_PROSE_NOT_MEASUREMENTS` موجودًا كما يأتي، ولم يُعدّل:

```text
1290:    const SW_PROSE_NOT_MEASUREMENTS = {
1291:      512: 'a fragment of the filenames icon-512.png and icon-maskable-512.png, not a size',
1292:      298686: 'a SUPERSEDED transfer size for the shell. A transfer size depends on the CDN encoder, '
1293:        + 'its settings and its version, none of which are in this tree, so nothing here can ever '
1294:        + 'check it. It survives in the prose only to record what was removed and why.',
1295:      338409: 'a SUPERSEDED transfer size for quran-uthmani.json -- same reason.',
1296:      151653: 'a SUPERSEDED transfer size for mushaf-layout.json -- same reason.',
1297:    };
```

---

## ٣ · جدولُ `SW_PROSE` الكامل

كلُّ رقمٍ قيس من القرص في الجريان نفسه قبل الرقعة:

| الملف أو المجموعة | المسجّل | المقيس | مطابق؟ |
|---|---:|---:|---|
| `index.html` | `120617` | `120617` | `True` |
| `app.js` | `947721` | `947738` | `False` |
| `vendor/react-dom.umd.js` | `131835` | `131835` | `True` |
| `vendor/react.umd.js` | `10751` | `10751` | `True` |
| `icon-watermark.png` | `368386` | `368386` | `True` |
| `adhkar.json` | `177392` | `177392` | `True` |
| `icon-512.png` | `12893` | `12893` | `True` |
| `icon-maskable-512.png` | `5938` | `5938` | `True` |
| `icon-192.png` | `5053` | `5053` | `True` |
| `manifest.json` | `533` | `533` | `True` |
| `quran-uthmani.json` | `1412005` | `1412005` | `True` |
| `mushaf-layout.json` | `996528` | `996528` | `True` |
| `worship-display.json` | `18132` | `18132` | `True` |
| `quran-uthmani.json + mushaf-layout.json` | `2408533` | `2408533` | `True` |
| `assets/madina-hafs count` | `604` | `604` | `True` |
| `assets/madina-hafs sum` | `66012516` | `66012516` | `True` |
| `assets/madina-hafs mean` | `109292` | `109292` | `True` |

كان `SW_PROSE_ENTRY_COUNT=17` و`SW_PROSE_MISMATCH_COUNT=1`. أُجري إبدالٌ واحدٌ بالاسم
والقيمة:

```text
{ n: 947721, of: 'app.js' }
->
{ n: 947738, of: 'app.js' }
```

بعد الرقعة كان `APP_JS_NEW_ENTRY_COUNT=1` و`APP_JS_OLD_ENTRY_COUNT=0`. لم يحتج أيُّ مدخلٍ
آخر إلى تصحيح، ولم يُضف مدخلٌ، ولم يُنقل رقمٌ إلى قائمة الاستثناءات.

بحثُ خريطة الختم عن مدخلٍ على صورة اسم الحارس وبصمة SHA-256 أعاد صفرَ مطابقات:

```text
GUARD_SELF_SEALED=False
```

---

## ٤ · البوابةُ المنفردة وسببُ الوقوف

شُغّل الأمرُ المعيّن حرفًا:

```text
node quest-bank-integrity-guard.cjs
```

وكان نصُّه كاملًا:

```text
usage: node quest-bank-integrity-guard.cjs --emit    > quest-data/bank-integrity-golden.json
       node quest-bank-integrity-guard.cjs --compare quest-data/bank-integrity-golden.json
BANKINTEGRITY_STANDALONE_EXIT=2
```

لم تُشغّل تأكيداتُ الحارس؛ أعاد الاستدعاءُ شاشةَ الاستعمال والرمز `2`. وبموجب «أحمر ⟹ اطبع
النص وقف» لم يُشغّل الحارسُ بصيغةٍ أخرى، ولم تُودع رقعةُ الحارس.

حالةُ الشجرة عند الوقوف:

```text
HEAD_AT_STOP=5d7f1eb02bad89ea760320de9f7d16a79d210afc
MODIFIED=quest-bank-integrity-guard.cjs
DIFF_CHECK_EXIT=0
```

---

## ٥ · جرياناتُ `questux`

| الجريان | `EXIT` | `CHECKS_RUN` | `ASSERTIONS_FAILED` | `CRASHED` | `CRASH_TEXT_FIRST_LINE` |
|---|---:|---:|---:|---|---|
| لا جريان | غير مقيس | غير مقيس | غير مقيس | غير مقيس | توقّف §٢ قبل بلوغ §٣ |

```text
QUESTUX_RUNS=0
QUESTUX_CLEAN_PASSES=0
QUESTUX_CRASHES=0
QUESTUX_ASSERTION_FAILURES_TOTAL=0
```

هذه الأصفارُ عدٌّ لما جرى، لا نتيجةُ قبول؛ لم يبدأ أيُّ جريان.

---

## ٦ · السلسلةُ الكاملة

لم يُشغّل `node tools/run-gates.cjs` لأن شرطَ الانتقال إليه — خضرةُ الحارس المنفرد ثم إيداع
§٢ — لم يتحقق.

```text
SUITE_RUN=False
SUITE=0/90
BANKINTEGRITY_ASSERTIONS_RUN=0
BANKINTEGRITY_FAIL=0
```

`BANKINTEGRITY_FAIL=0` هنا عددُ التأكيدات الساقطة المرصودة؛ لا يدل على خضرة الأمر، إذ كان
`BANKINTEGRITY_STANDALONE_EXIT=2` قبل تشغيل أي تأكيد.

---

## ٧ · ما لم يُقَسْ بعلّتِه

1. لم تُقَس جرياناتُ `questux` الخمسة لأن §٢ أمرَ بالوقوف قبل §٣.
2. لم تُقَس المجموعةُ ذات التسعين بوابة لأن إيداع §٢ لم يقع.
3. لم تُقَس أرضياتُ `themecoverage` و`wird` و`i18nui` في جريان إغلاق؛ السلسلة لم تبدأ.
4. لم يُقَس `bankintegrity` بصيغة `--compare` لأن ذلك استدعاءٌ آخر بعد الحمرة.
5. لم يُقَس زمنٌ ولم يُستدل بزمن.
6. لم يقع دفعٌ أو نشر.

---

## ٨ · الخلاصةُ بالمفاتيح

```text
FINAL_HEAD=5d7f1eb02bad89ea760320de9f7d16a79d210afc
SUITE=0/90
BANKINTEGRITY_FAIL=0
BANKINTEGRITY_STANDALONE_EXIT=2
QUESTUX_CLEAN_PASSES=0
STOP_REASON=BANKINTEGRITY_STANDALONE_USAGE_EXIT_2
PUSHES=0
PUSH_READY=NO
```

`FINAL_HEAD` أعلاه هو رأسُ الشجرة عند القياس؛ رقعةُ الحارس باقيةٌ غيرَ مودعة. يُودع هذا
التقريرُ وحدَه فوق ذلك الرأس.

---
PAYLOAD_BYTES=7707 SHA256=33787cd7ae2144993d7799de7c64164d3ceec79c26194ecf2461b038d6deef1b
