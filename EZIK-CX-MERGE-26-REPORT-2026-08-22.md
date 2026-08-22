# تقريرُ جولةِ الدمجِ ٢٦ — ٢٠٢٦-٠٨-٢٢

**الوجهة:** `main` في `C:\Users\passe\projects\ustaz`  
**المدموج:** `fix/daily-dropdown-20260822`  
**الحال:** وقوفٌ بعدَ بوّابتين حمراوين على شجرةٍ نظيفة.  
**سبب الوقوف:** `STOP_REASON=RED_GATE_AFTER_COMMIT: bankintegrity=1, questux=1`  
**الدفع:** `PUSHES=0` · `PUSH_READY=NO`

هذا التقريرُ قياسٌ بلا حكم؛ والحكمُ لصاحبِ الأمر.

---

## ١ · بوّاباتُ ما قبلَ العمل

| المفتاح | المقيس | الشرط | الحصيلة |
|---|---|---|---|
| `ORDER_MOVED` | `True` إلى `C:\EZIK-STAGE\orders\ORDER-MERGE-26.md` | `True` | مطابق |
| `CWD` | `C:\Users\passe\projects\ustaz` | المسارُ المعيّن | مطابق |
| `CURRENT_BRANCH` | `main` | `main` | مطابق |
| `DIRTY_LINES` | `0` بعدَ نقلِ الدخيل | `0` | مطابق |
| `ORIGIN_MAIN` | `4c9531cb4687ed9f576fe047aa21b130f692b3ff` | القيمةُ المعيّنة | مطابق |
| `LOCAL_MAIN` | `4c9531cb4687ed9f576fe047aa21b130f692b3ff` | `= ORIGIN_MAIN` | مطابق |
| `BRANCH_HEAD` | `309abbc7ddbd07143979e1b9d5d2c6251a5bcaf8` | القيمةُ المعيّنة | مطابق |
| `FIX_IS_ANCESTOR_EXIT` | `0` | `0` | مطابق |

أظهرَ `git status --porcelain` بعدَ نقلِ الأمر سطرًا واحدًا:

```text
?? .claude/
```

نُقِلَ ولم يُحذَف إلى
`C:\EZIK-STAGE\stray-untracked-ustaz-20260822\.claude`، فكان
`STRAY_UNTRACKED_ROOT_COUNT=1`، ثم أُعيد القياس فكان `DIRTY_LINES=0`.

---

## ٢ · الدمج

المحاولةُ الأولى لم تغيّر الشجرة؛ منعَ صندوقُ التنفيذ إنشاءَ
`.git/ORIG_HEAD.lock` وأعادَ Git الرمز `128`. أُعيدَ الاستدعاءُ نفسه بإذن الكتابة بعدَ قياس
`MERGE_IN_PROGRESS=False` و`DIRTY_LINES_BEFORE_RETRY=0`.

| المفتاح | المقيس |
|---|---|
| `MERGE_EXIT` | `0` |
| `MERGE_CONFLICT_FILES` | `0` |
| `MERGE_HEAD_FULL` | `0d48bff57665e5e50bbf0de0843c54d3390fba7a` |

الناتجُ الكامل لـ `git --no-pager diff --stat origin/main..HEAD` عندَ رأس الدمج:

```text
 EZIK-CC-DROPDOWN-REPORT-2026-08-22.md | 268 ++++++++++++++++++++++++++++++++++
 app.js                                |   2 +-
 app.jsx                               |  13 +-
 3 files changed, 280 insertions(+), 3 deletions(-)
```

---

## ٣ · قياسُ مجموعةِ `CORE`

قُرئت القائمةُ من مصفوفة `CORE` في `sw.js` نفسِه، ثم قيسَ كلُّ ملفٍ من القرص:

| مسارُ `CORE` | المسارُ على القرص | البايتات |
|---|---|---:|
| `/` | `index.html` | `120617` |
| `/manifest.json` | `manifest.json` | `533` |
| `/icon-192.png` | `icon-192.png` | `5053` |
| `/icon-512.png` | `icon-512.png` | `12893` |
| `/icon-maskable-512.png` | `icon-maskable-512.png` | `5938` |
| `/icon-watermark.png` | `icon-watermark.png` | `368386` |
| `/adhkar.json` | `adhkar.json` | `177392` |
| `/app.js` | `app.js` | `947738` |
| `/vendor/react.umd.js` | `vendor/react.umd.js` | `10751` |
| `/vendor/react-dom.umd.js` | `vendor/react-dom.umd.js` | `131835` |
| **المجموعُ المقيس** | **١٠ ملفات** | **`1781136`** |

والأرقامُ الثلاثةُ قبلَ التصحيح وبعدَه:

| الرقم | قبل | بعد |
|---|---:|---:|
| نثرُ حجم `app.js` في `sw.js` | `947721` | `947738` |
| `CORE_BYTES` | `1781119` | `1781136` |
| اسمُ مخزن الشحنة | `ezik-v16` | `ezik-v17` |

المفاتيحُ المطلوبةُ صراحةً:

```text
APP_JS_BYTES=947738
CORE_BYTES=1781136
CACHE_NEW=ezik-v17
CACHE_OLD=ezik-v16
```

قياسُ `sw.js` بعدَ التعديل وقبلَ الختم:

```text
SW_JS_BYTES_AFTER_EDIT=42994
BARE_LF=738
CR=0
```

قيسَ البحثُ التشغيليُّ بعدَ إعادة قطع `SW_CACHE` في الحارس:

```text
OLD_NAME_LEFT_IN_TREE=0
```

استُبعدت تقاريرُ Markdown التاريخية من هذا العدّ التشغيلي؛ والبحثُ النصيُّ الشاملُ وجدَ مرجعًا
تاريخيًّا واحدًا إلى `ezik-v16` في
`EZIK-CC-DROPDOWN-REPORT-2026-08-22.md`. لم يُحرَّر التقريرُ المدموج، وسُجّل
`OLD_NAME_HISTORICAL_REPORT_REFERENCES=1` كي لا يُخفى اختلافُ نطاقَي القياس.

---

## ٤ · ختمُ `sw.js` وإيداعُ الدفتر

| المفتاح | القيمة |
|---|---|
| `SW_OLD_SHA` | `11bf2f62a420eb8de99141fac0fb80a84629592ff7df4b4067e73f2c0f966bf4` |
| `SW_NEW_SHA` | `d9974b29cea5fe3edd8d1b2c63969e267e4e43c0ba3f7d89719c18ddb76d1aa6` |
| `SW_SEAL_MATCH` | `True` |
| `CACHE_GUARD_MATCH` | `True` |
| ملفّاتُ الإيداع | `sw.js` و`quest-bank-integrity-guard.cjs` فقط |
| إيداعُ الدفتر | `f9c70fda14bba03142f5ff2a0737913c9248853a` |
| الشجرةُ بعدَه | `DIRTY_LINES_AFTER_LEDGER_COMMIT=0` |

استُبدلت بصمةُ `sw.js` وحدَها في خريطة الختم؛ لم تُولّد الخريطةُ جملةً. ورُفعَ ثابتُ
`SW_CACHE` في الحارس إلى القيمة التي فتحَها العامل. لم تُرخَ بوّابةٌ ولم تُخفض أرضيّة.

---

## ٥ · حصيلةُ البوّابات

قيسَ `node tools/run-gates.cjs` على الرأس
`f9c70fda14bba03142f5ff2a0737913c9248853a` وعلى شجرةٍ نظيفة قبلَ الجريان وبعدَه:

```text
SUITE_DISPLAY=88/90 EXIT=0
RUN_GATES_EXIT=1
RECON=PASS=182 WARN=1 FAIL=0
TREE_DIRTIED_BY_RUN=False
DIRTY_BEFORE=0
DIRTY_AFTER=0
FAILING=bankintegrity=1, questux=1
```

والعداداتُ المطلوبةُ، مقيسةً من سجلات هذا الجريان:

| البوابة | المقيس | أرضيةُ الفرع | الحصيلةُ العددية |
|---|---:|---:|---|
| `themecoverage` | `1341/1341` | `1341` | لم ينخفض |
| `wird` | `1122/0` | `1122/0` | لم ينخفض |
| `i18nui` | `277/277` | `277` | لم ينخفض |
| `bankintegrity` | `74` ناجحًا · `2` ساقطًا | صفرُ ساقط | لم يتحقق الشرط |
| `questux` | جريانٌ واحدٌ: انهيارٌ بعد `7` فحوص، و`0` ساقطٍ قبل الانهيار | خمسةُ جريانات ناجحة | لم يتحقق الشرط |

### جدولُ البوابات التسعين كاملًا

| البوابة | `EXIT` |
|---|---:|
| `worship` | `0` |
| `quran` | `0` |
| `layout` | `0` |
| `babel` | `0` |
| `runtime` | `0` |
| `recon` | `0` |
| `display` | `0` |
| `referral` | `0` |
| `classifier` | `0` |
| `hafs` | `0` |
| `call` | `0` |
| `history` | `0` |
| `markdown` | `0` |
| `reveal` | `0` |
| `quranquest` | `0` |
| `prayerquest` | `0` |
| `bankintegrity` | `1` |
| `contentreview` | `0` |
| `themecoverage` | `0` |
| `chatux` | `0` |
| `a11y` | `0` |
| `questux` | `1` |
| `attribution` | `0` |
| `claim` | `0` |
| `sourceregistry` | `0` |
| `bravequery` | `0` |
| `smartretrieval` | `0` |
| `ledgercontract` | `0` |
| `ledgerretrieval` | `0` |
| `ledgergates` | `0` |
| `ledgerruntime` | `0` |
| `ledgerfixtures` | `0` |
| `ledgerseam` | `0` |
| `rfcpolicy` | `0` |
| `rfcruntime` | `0` |
| `rfcwiring` | `0` |
| `rfcround3` | `0` |
| `rfcmode` | `0` |
| `rfchistorical` | `0` |
| `rfcconsistency` | `0` |
| `rfcworld` | `0` |
| `scholardrift` | `0` |
| `shippedreality` | `0` |
| `pagematch` | `0` |
| `takhrij` | `0` |
| `quotedphrase` | `0` |
| `adaptedcorpus` | `0` |
| `deaddomains` | `0` |
| `floorsfilters` | `0` |
| `liveness` | `0` |
| `aiconsent` | `0` |
| `srcattr` | `0` |
| `referraltail` | `0` |
| `namepresence` | `0` |
| `voicesafety` | `0` |
| `wird` | `0` |
| `worldparity` | `0` |
| `rulingsource` | `0` |
| `retrievalobs` | `0` |
| `madinahafs` | `0` |
| `i18nui` | `0` |
| `adhkartwins` | `0` |
| `systemprompt` | `0` |
| `lockpackage` | `0` |
| `sourcehonesty` | `0` |
| `ledgertelemetry` | `0` |
| `livesearch` | `0` |
| `answershape` | `0` |
| `identity` | `0` |
| `transfermode` | `0` |
| `anchormode` | `0` |
| `searchbudgetp0` | `0` |
| `fullfatwa` | `0` |
| `retiredchat` | `0` |
| `guardhonesty` | `0` |
| `promptconsistency` | `0` |
| `truncatedtag` | `0` |
| `explicitfailure` | `0` |
| `scholarseparation` | `0` |
| `cardorcontext` | `0` |
| `reviewermatrix` | `0` |
| `attributionoutput` | `0` |
| `domaincontract` | `0` |
| `noemptyanswer` | `0` |
| `ladderorder` | `0` |
| `taghonesty` | `0` |
| `standingnotice` | `0` |
| `telemetrytext` | `0` |
| `vacuousassert` | `0` |
| `bootinvariants` | `0` |

### نصُّ حمرة `bankintegrity` حرفًا

```text
FAIL [B14] sw.js prose no longer states 947721 for app.js.
      Either the sentence was rewritten and this table was not, or the measurement
      was dropped from the worker while the table still claims it is there.
FAIL [B14] sw.js prose states 947738 and nothing checks it.
      Register each one in SW_PROSE with the file it measures, or in
      SW_PROSE_NOT_MEASUREMENTS with the reason it cannot be checked. There is no
      third option: a number in this worker that nothing re-measures is the defect
      item 115-ب was raised to end.
```

### نصُّ حمرة `questux` حرفًا

```text
=== B. THE ROUND (a real round, in a real browser) ===
  RETRY  browser attach attempt 1/2 failed: Page.enable aborted: read ECONNRESET
         retrying once — this line is the record that it happened.

GUARD CRASHED (not an assertion failure) after 7 check(s), 0 of which had already failed.
Error: Page.enable aborted: read ECONNRESET
    at C:\Users\passe\projects\ustaz\quest-ux-guard.cjs:318:66
    at Socket.die (C:\Users\passe\projects\ustaz\quest-ux-guard.cjs:239:54)
    at Socket.emit (node:events:509:28)
    at emitErrorNT (node:internal/streams/destroy:170:8)
    at emitErrorCloseNT (node:internal/streams/destroy:129:3)
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
```

موضعُ دليل الجريان:
`C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-08-22T07-01-28-339Z-4656`.

---

## ٦ · ما لم يُقَسْ بعلّتِه

1. لم تُجرَ التكراراتُ الأربعةُ الباقيةُ لـ`questux`: الجريانُ الأول داخل المجموعة صار أحمرَ،
   ونصُّ الأمر يأمر بالوقوف عند بوابةٍ حمراء بعد الإيداع.
2. لم يُعَد تشغيلُ المجموعة بعد الحمرة، ولم يُعدّل `SW_PROSE` في
   `quest-bank-integrity-guard.cjs`: ذلك إصلاحٌ بعد بوابة حمراء، وقد حظره الأمر.
3. لم يُقَس نزولٌ حيٌّ ولا نشرٌ؛ لم يقع دفعٌ أصلًا.
4. لم يُقَس زمنٌ ولم يُستدلَّ بزمن؛ أرقامُ الزمن الصادرة آليًّا في سجل أداة البوابات لم تدخل
   في أي شرطٍ أو استنتاجٍ في هذا التقرير.

---

## ٧ · الخلاصةُ بالمفاتيح

```text
MERGE_HEAD_FULL=0d48bff57665e5e50bbf0de0843c54d3390fba7a
FINAL_HEAD=f9c70fda14bba03142f5ff2a0737913c9248853a
APP_JS_BYTES=947738
CORE_BYTES=1781136
CACHE_NEW=ezik-v17
SW_OLD_SHA=11bf2f62a420eb8de99141fac0fb80a84629592ff7df4b4067e73f2c0f966bf4
SW_NEW_SHA=d9974b29cea5fe3edd8d1b2c63969e267e4e43c0ba3f7d89719c18ddb76d1aa6
SUITE=88/90
RECON_FAIL=0
BANKINTEGRITY_FAIL=2
QUESTUX_RUNS=1/5
STOP_REASON=RED_GATE_AFTER_COMMIT: bankintegrity=1, questux=1
PUSHES=0
PUSH_READY=NO
```

`FINAL_HEAD` أعلاه هو رأسُ إيداع الدفتر الذي قيسَت عليه البوابات. يُودَع هذا التقريرُ فوقَه
بإيداعٍ مستقلٍّ ولا يحمل إصلاحًا للبوابتين الحمراوين.

---
PAYLOAD_BYTES=11810 SHA256=2512479be9546c6e319818b7702b5db09cd09c80fd38534b5f8069f430aa85cf
