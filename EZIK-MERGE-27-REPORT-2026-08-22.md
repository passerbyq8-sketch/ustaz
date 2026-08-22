# تقريرُ عزك — **جولةُ الدمجِ ٢٧**: إنزالُ ٢٥-أ و٢٥-ب (بحثُ المكتبةِ وبطاقةُ المصدر)

**الشجرةُ:** `C:\Users\passe\projects\ustaz` (الأمُّ) · **الفرعُ المدموج:** `feat/lib-search-16b-20260822`
**التاريخُ:** ٢٢ أغسطس ٢٠٢٦ · **الدفعُ:** لم يقعْ (`PUSHES=0`)

---

## ١ · بوّاباتُ ما قبلَ العمل — مقيسةً في هذا الجريان

| المفتاح | المشروطُ في الأمر | المقيسُ | الحال |
|---|---|---|---|
| `CWD` | `C:\Users\passe\projects\ustaz` | `C:/Users/passe/projects/ustaz` | مطابق |
| `MOTHER_BRANCH` | `main` | `main` | مطابق |
| `ORIGIN_MAIN` | `6cae89c9…41d1e` | `6cae89c92cc2dced8f9137ebd6142a2c00e41d1e` | مطابق |
| `HEAD` المحلّيُّ = `ORIGIN_MAIN` | نعم | `6cae89c92cc2dced8f9137ebd6142a2c00e41d1e` | مطابق |
| `DIRTY_LINES` | `0` بعدَ نقلِ الأمر | `0` | مطابق |
| `LIB_BRANCH_HEAD` | `25868609…8cfd1` | `25868609641304ace3d29d33b6292c4f17c8cfd1` | مطابق |
| `AHEAD_COUNT` | `12` | `12` | مطابق |
| `SW_CACHE_BEFORE` | `ezik-v17` من `sw.js` وحدَه | `sw.js:44 ← const CACHE = 'ezik-v17';` | مطابق |

`ORDER_MOVED=True` — نُقلَ ملفُّ الأمرِ إلى `C:\EZIK-STAGE\orders\ORDER-MERGE-27.md` قبلَ أيِّ فعلٍ آخر.

---

## ٢ · حصيلةُ الدمج

```text
MERGE_EXIT=0
MERGE_CONFLICT_FILES=0
MERGE_COMMIT=b2c7c8ef49b6df75763e6f64abb16d50f6e3c0b5
```

استراتيجيّةُ `ort` · بلا تعارضٍ واحد.

### `git --no-pager diff --stat origin/main..HEAD` (عندَ الدمج)

```text
 EZIK-CC-LIBSEARCH-16A-REPORT-2026-08-22.md   | 232 +++++++
 EZIK-CC-LIBSEARCH-16B-B-REPORT-2026-08-22.md | 243 ++++++++
 EZIK-CC-LIBSEARCH-16B-C-REPORT-2026-08-22.md | 217 +++++++
 EZIK-CC-LIBSEARCH-16B-D-REPORT-2026-08-22.md | 190 ++++++
 EZIK-CC-LIBSEARCH-16B-REPORT-2026-08-22.md   | 273 ++++++++
 api/lib-search.js                            | 262 ++++++++
 app.js                                       |  86 ++-
 app.jsx                                      | 243 +++++++-
 guards/fixtures-lib-search-16a.json          | 142 +++++
 guards/lib-search-16a-guard.cjs              | 890 +++++++++++++++++++++++++++
 lib/lib-source-card.js                       | 173 ++++++
 11 files changed, 2943 insertions(+), 8 deletions(-)
```

### الأربعةُ حاضرةٌ بأحجامِها المقيسةِ على القرص

| الملفّ | الحال | البايتات |
|---|---|---|
| `api/lib-search.js` | حاضر | `13452` |
| `lib/lib-source-card.js` | حاضر | `7789` |
| `guards/lib-search-16a-guard.cjs` | حاضر | `59273` |
| `guards/fixtures-lib-search-16a.json` | حاضر | `4384` |

**حارسُ `lib-search-16a` بعدَ الدمجِ:** `=== 210/210 - PASS ===` · `EXIT=0` — أخضرُ.

---

## ٣ · الأرقامُ الثلاثةُ — والموضعُ الرابعُ الذي لم يُسَمَّ في الأمر

### ٣-١ · مواضعُ الحقيقةِ كما حُدِّدَتْ برمجيًّا

حارسُ البنكِ الفعليُّ ليسَ تحتَ `guards/` بل في جذرِ الشجرة، وحُدِّدَ من `gates.json` لا بالافتراض:

```text
gates.json:83  name=bankintegrity
               script=quest-bank-integrity-guard.cjs  (جذرُ الشجرة)
               args=--compare quest-data/bank-integrity-golden.json
```

| القيمةُ | الملفُّ | السطرُ |
|---|---|---|
| خريطةُ الختمِ `SEALED['sw.js']` | `quest-bank-integrity-guard.cjs` | `158` |
| اسمُ المخزنِ المرآةِ `SW_CACHE` | `quest-bank-integrity-guard.cjs` | `182` |
| نثرُ حجمِ `app.js` (الأصل) | `sw.js` | `96` |
| نثرُ حجمِ `app.js` (**المرآةُ في الحارسِ نفسِه**) | `quest-bank-integrity-guard.cjs` | `1268` |
| `CORE_BYTES` | `sw.js` | `112` |

🔴 **موضعٌ خامسٌ لم يَنُصَّ عليه الأمر:** رقمُ `app.js` **مُثنّى** — يُعلَنُ في نثرِ `sw.js:96` **ويُمرآ** في جدولِ `SW_PROSE` داخلَ الحارسِ (`quest-bank-integrity-guard.cjs:1268`). تبديلُ الأوّلِ وحدَه قلبَ `B14` من سقطةٍ واحدةٍ إلى سقطتَين (`لم تعُدْ تذكرُ 947738` و`تذكرُ 960680 ولا شيءَ يفحصُه`)، فبُدِّلَ الموضعان معًا.

### ٣-٢ · جدولُ الأرقامِ: القديمُ · الجديدُ · مصدرُ القياس

| الرقمُ | القديمُ | الجديدُ | الفرقُ | مصدرُ القياس |
|---|---|---|---|---|
| `CORE_BYTES` (`sw.js:112`) | `1781136` | `1794078` | `+12942` | `node tools/core-bytes.cjs --write` — مجموعُ العشرةِ مداخلَ على القرص |
| نثرُ `app.js` (`sw.js:96`) | `947738` | `960680` | `+12942` | `wc -c app.js` على القرص |
| مرآةُ `app.js` (`الحارس:1268`) | `947738` | `960680` | `+12942` | المصدرُ نفسُه |
| اسمُ المخزنِ (`sw.js:44`) | `ezik-v17` | `ezik-v18` | — | رفعةُ الشحنة |
| مرآةُ المخزنِ (`الحارس:182`) | `ezik-v17` | `ezik-v18` | — | المصدرُ نفسُه |
| ختمُ `sw.js` (`الحارس:158`) | `d9974b29cea5fe3edd8d1b2c63969e267e4e43c0ba3f7d89719c18ddb76d1aa6` | `0df9ee77efe73b0b2fad4fff0fe1c0f322e939d3aedc88fe3f2cb54f2a659183` | — | `sha256` لبايتاتِ `sw.js` بعدَ الثلاثةِ أعلاه |

الفرقُ واحدٌ في الثلاثةِ (`+12942`) لأنّ `app.js` وحدَه نما في هذه الشحنة؛ بقيّةُ مداخلِ `CORE` العشرةِ لم تتحرّكْ بايتةً.

**تأكيدُ الختمِ على البايتاتِ المودَعةِ لا على القرصِ وحدَه** (`sw.js` يحملُ `738` محرفَ `CR`، وهي علّةُ انفصامٍ معروفةٍ بينَ الشجرةِ والمستودع):

```text
SEAL_IN_GUARD     = 0df9ee77efe73b0b2fad4fff0fe1c0f322e939d3aedc88fe3f2cb54f2a659183
HASH_DISK_SW      = 0df9ee77efe73b0b2fad4fff0fe1c0f322e939d3aedc88fe3f2cb54f2a659183
HASH_COMMITTED_SW = 0df9ee77efe73b0b2fad4fff0fe1c0f322e939d3aedc88fe3f2cb54f2a659183
```

الثلاثةُ متطابقةٌ، فالختمُ يصمدُ في استنساخٍ جديدٍ لا في هذه الشجرةِ فحسب. (وقبلَ التبديلِ كانتِ الثلاثةُ متطابقةً كذلك على `d9974b29…`.)

### ٣-٣ · مواضعُ الرفعةِ `ezik-v17 ⟵ ezik-v18`

المطابقةُ بحدودِ الكلمةِ حصرًا (`ezik-v17` متبوعًا بغيرِ رقمٍ) — ولم يُمَسَّ `ezik-mushaf-pages-v1` بحرفٍ واحد.

```text
sw.js:44                            const CACHE = 'ezik-v18';
quest-bank-integrity-guard.cjs:182  const SW_CACHE = 'ezik-v18';

EZIK_V18_OCCURRENCES=2
EZIK_V17_OCCURRENCES=0
EZIK_V17_HISTORICAL_REPORT_REFERENCES=5
MUSHAF_STORE_OCCURRENCES=9   (قبلَ الرفعةِ وبعدَها سواءً)
SW_BYTES_BEFORE=42994
SW_BYTES_AFTER=42994
SW_BYTES_DELTA=0
```

🔴 **نطاقا القياسِ مفصولان عمدًا.** `EZIK_V17_OCCURRENCES=0` مقيسٌ على الشجرةِ كلِّها **خلا تقاريرِ الجولاتِ السابقةِ المجمَّدة**. بقيَتْ خمسُ إشاراتٍ تاريخيّةٍ إلى `ezik-v17` لم تُحرَّرْ:

```text
EZIK-CX-MERGE-26-CLOSE-B-REPORT-2026-08-22.md:105
EZIK-CX-MERGE-26-CLOSE-B-REPORT-2026-08-22.md:126
EZIK-CX-MERGE-26-REPORT-2026-08-22.md:85
EZIK-CX-MERGE-26-REPORT-2026-08-22.md:92
EZIK-CX-MERGE-26-REPORT-2026-08-22.md:308
```

وهي **قياساتٌ صادقةٌ لجولةِ ٢٦ حينَ قِيسَتْ**؛ تحريرُها يجعلُ تقريرًا مختومًا يشهدُ بما لم يقعْ. والسابقةُ منصوصةٌ في الشجرةِ نفسِها لا مستنبَطةٌ هنا: جولةُ ٢٦ تركَتْ أربعَ إشاراتٍ إلى `ezik-v16` حيّةً، وسجّلَتْ في `EZIK-CX-MERGE-26-REPORT:105-112` أنّها «استُبعدت تقاريرُ Markdown التاريخية من هذا العدّ التشغيلي» مع تسجيلِ عددِها منفصلًا «كي لا يُخفى اختلافُ نطاقَي القياس». اتُّبعَتْ هنا حرفًا. **والحكمُ في هذا لصاحبِ الأمر.**

### ٣-٤ · بوّابةُ البنكِ قبلَ الإصلاحِ وبعدَه

```text
قبلَ  §٣:  FAIL  74 checks passed, 2 failed.   EXIT=1
           FAIL [B12] CORE_BYTES = 1781136 but CORE weighs 1794078 bytes on disk (+12942).
           FAIL [B14] sw.js prose says app.js is 947738 bytes; the disk says 960680 (+12942).

بعدَ  §٣:  PASS  76 checks passed, 0 failed.   EXIT=0
```

---

## ٤ · البناءُ والمسابير

```text
node tools/build-app.cjs --check
built     960680 bytes  da153a702832c55527b1cd83d061a493c7ca7442dae1cd61904769bc9c7300a9
on disk   960680 bytes  da153a702832c55527b1cd83d061a493c7ca7442dae1cd61904769bc9c7300a9
OK: app.js is exactly what this source builds
BUILD_CHECK_EXIT=0

node C:\Users\passe\tdz-scan.cjs
PARSER_OK=1
SRC_CHARS=1020527
PARSE_OK=1 MODE=script
SCOPES=1355
TDZ_COUNT=0
```

`app.jsx` و`index.html` لم يُلمَسا في هذه الجولةِ ألبتّة.

---

## ٥ · الإيداعُ ثمّ البوّابات

```text
git add sw.js quest-bank-integrity-guard.cjs      (بالأسماءِ صراحةً — لا `git add .`)
COMMIT_SHA=0ea0a61a5e95c0d99a00570f83cc7d8806ee7908
 quest-bank-integrity-guard.cjs | 6 +++---
 sw.js                          | 6 +++---
 2 files changed, 6 insertions(+), 6 deletions(-)
DIRTY_LINES=0
```

ستُّ سطورٍ لا سابعَ لها، وقد طُبعَ الفارقُ كاملًا قبلَ الإيداعِ للتحقُّقِ من ألّا رقعةً جانبيّةً تسلَّلَتْ مع تحريرِ البايتات.

### حصيلةُ الطقمِ الكامل

```text
node tools/run-gates.cjs
=== SUITE: 90/90 EXIT=0 ===
recon:    SUMMARY   PASS=182   WARN=1   FAIL=0
tree after: 0 dirty path(s)
```

### الأرضيّاتُ قبلَ الدمجِ وبعدَه — عمودان

«قبلُ» **مقيسٌ في هذا الجريانِ نفسِه** لا منقولٌ: أُنشئَتْ شجرةُ عملٍ منفصلةٌ على `6cae89c9` (مع وصلةِ `node_modules`) وشُغِّلَتِ الحُرّاسُ العشرةُ عليها، ثمّ أُزيلَتْ.

| الأرضيّةُ | قبلَ الدمجِ (`6cae89c9`) | بعدَ الدمجِ والإصلاحِ (`0ea0a61a`) | الحركةُ |
|---|---|---|---|
| `recon` | `PASS=182 WARN=1 FAIL=0` | `PASS=182 WARN=1 FAIL=0` | ثابتة |
| `bankintegrity` | `76/0` | `76/0` | ثابتة |
| `themecoverage` | `1341/1341` | `1341/1341` | ثابتة |
| `wird` | `passed 1122 / failed 0` | `passed 1122 / failed 0` | ثابتة |
| `i18nui` | `277/277` | `277/277` | ثابتة |
| `bootinvariants` | `30/0` | `30/0` | ثابتة |
| `attributionoutput` | `PASS=69 FAIL=0` | `PASS=69 FAIL=0` | ثابتة |
| `questux` | `61/61` | `61/61` | ثابتة |
| `noemptyanswer` | `PASS=356 FAIL=0` | `PASS=356 FAIL=0` | ثابتة |
| حارسُ `lib-search-16a` | **غيرُ موجودٍ** (الملفُّ لم يكنْ في الشجرة) | `210/210 PASS` | جديدة |

**لا أرضيّةَ نزلَتْ.** ولم تُخفَّضْ عتبةٌ ولم يُنزَعْ تأكيدٌ ولم يُعدَّلْ ملفٌّ ذهبيٌّ واحدٌ في هذه الجولة.

---

## ٦ · شرطُ القبولِ، بندًا بندًا

| البندُ | المقيسُ | الحال |
|---|---|---|
| `MERGE_CONFLICT_FILES=0` | `0` | ✅ |
| الأربعةُ حاضرةٌ | أربعتُها بأحجامِها | ✅ |
| حارسُ `lib-search-16a` أخضرُ بعدَ الدمج | `210/210 EXIT=0` | ✅ |
| `bankintegrity` خضراءُ بعدَ §٣ | `76/0 EXIT=0` | ✅ |
| `EZIK_V17_OCCURRENCES=0` | `0` تشغيليًّا · `5` إشاراتٍ تاريخيّةً مسجَّلةً صراحةً | ✅ مع الإفصاحِ في §٣-٣ |
| `build --check` مطابقٌ | `EXIT=0`، بصمتان متطابقتان | ✅ |
| `TDZ_COUNT=0` | `0` · `SCOPES=1355` | ✅ |
| `90/90 EXIT=0` على شجرةٍ نظيفة | `90/90 EXIT=0` · `tree after: 0 dirty` | ✅ |
| صفرُ دفعٍ | `PUSHES=0` | ✅ |

---

## ٧ · ما لم يُقَسْ — بعلّتِه

1. **لم يُجرَّبْ نداءٌ حيٌّ على `/api/lib-search` لأنّ التوكنَ في الإنتاجِ وحدَه ولا يوجدُ محلّيًّا.** كلُّ ما يُقالُ عن المسارِ في هذا التقريرِ مأخوذٌ من حارسِ `lib-search-16a` وهو يشغِّلُ الدالّةَ بخادمٍ مُستعاضٍ، لا من الشبكة.
2. **لم يُقَسْ أثرُ رفعةِ المخزنِ على قارئٍ عائدٍ حقيقيّ.** أنّ `activate` يكنسُ المخزنَ المسبوقَ ويُبقي `ezik-mushaf-pages-v1` مقيسٌ داخلَ الحارسِ تنفيذًا، أمّا ما يقعُ على جهازٍ فيه المخزنُ القديمُ فعلًا فلم يُجرَّبْ.
3. **لم يُقَسْ نزولٌ ولا نشرٌ ولا سلوكُ إنتاج.** لم يقعْ دفعٌ أصلًا.
4. **لم يُقَسْ زمنٌ ولم يُستدلَّ بزمن.** أرقامُ الأزمنةِ التي طبعَتْها أداةُ البوّاباتِ آليًّا لم تدخلْ في شرطٍ ولا استنتاجٍ ها هنا.
5. **لم يُقَسْ ما وراءَ العشرِ أرضيّاتٍ المسمّاةِ في الأمر** إلّا بما تقولُه حصيلةُ `90/90` جملةً؛ الأرضيّاتُ الأخرى قِيسَتْ نجاحًا أو سقوطًا لا بأعدادِ فحوصِها.
6. **`WARN=1` في `recon` لم يُفتَّشْ عن سببِه** — كانَ حاضرًا قبلَ الدمجِ وبعدَه سواءً، فلم يُحدِثْه هذا العمل.

---

## ٨ · الخلاصةُ بالمفاتيح

```text
ORDER_MOVED=True
MERGE_EXIT=0
MERGE_CONFLICT_FILES=0
MERGE_COMMIT_FULL=b2c7c8ef49b6df75763e6f64abb16d50f6e3c0b5
FINAL_HEAD=0ea0a61a5e95c0d99a00570f83cc7d8806ee7908
APP_JS_BYTES=960680
CORE_BYTES_OLD=1781136
CORE_BYTES_NEW=1794078
CORE_BYTES_DELTA=+12942
APPJS_PROSE_OLD=947738
APPJS_PROSE_NEW=960680
CACHE_OLD=ezik-v17
CACHE_NEW=ezik-v18
SW_OLD_SHA=d9974b29cea5fe3edd8d1b2c63969e267e4e43c0ba3f7d89719c18ddb76d1aa6
SW_NEW_SHA=0df9ee77efe73b0b2fad4fff0fe1c0f322e939d3aedc88fe3f2cb54f2a659183
EZIK_V17_OCCURRENCES=0
EZIK_V17_HISTORICAL_REPORT_REFERENCES=5
EZIK_V18_OCCURRENCES=2
BUILD_CHECK=OK
TDZ_COUNT=0
SCOPES=1355
SUITE=90/90
SUITE_EXIT=0
RECON_FAIL=0
BANKINTEGRITY_FAIL=0
LIBSEARCH_16A=210/210
FLOORS_DROPPED=0
STOP_REASON=NONE
PUSHES=0
PUSH_READY=YES
```

`PUSH_READY=YES` **إعلانٌ لا فعل** — لم يُنفَّذْ `git push` ولن يُنفَّذَ إلّا بأمرٍ صريحٍ منفصلٍ من المالك.

`FINAL_HEAD` أعلاه هو رأسُ إيداعِ الإصلاحِ الذي قِيسَتْ عليه البوّاباتُ؛ ويُودَعُ هذا التقريرُ فوقَه بإيداعٍ مستقلٍّ لا يحملُ تغييرًا في كود.

---
PAYLOAD_BYTES=15246 SHA256=e738aa25266dea303d5d16b1050ac6218cd59a70bc645a5b3a692a5d0b6b4d81
