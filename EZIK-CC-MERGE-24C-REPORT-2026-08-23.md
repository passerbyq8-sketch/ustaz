# تقريرُ دمجِ ٢٤-ج — التصفّحُ إلى `main`

**الشجرة:** `C:\Users\passe\projects\ustaz` · **التاريخ:** ٢٣ أغسطس ٢٠٢٦
**الحال:** الدمجانِ تمّا وإعادةُ القطعِ تمّت · **بوّابةٌ واحدةٌ حمراءُ توقفني** — `lessonsbrowse`
**لم أدفعْ ولم أنشرْ.**

---

## ٠ · بوّابةُ الدخول — كما قِستُها

| الشيء | المطلوب | المقيس | الحكم |
|---|---|---|---|
| `git rev-parse origin/main` | `a332cb3bfc43067f88f4878654a9a3846d07cb14` | `a332cb3bfc43067f88f4878654a9a3846d07cb14` | ✅ لم يتحرّك |
| `merge-base --is-ancestor 4c68dd1 …proxy-24c` | `0` | `LASTEXITCODE=0` | ✅ |
| `merge-base --is-ancestor 7c81437 …ui-24c` | `0` | `LASTEXITCODE=0` | ✅ |
| `git status --porcelain` | صفرُ سطر | `STATUS_LINE_COUNT=0` | ✅ |

`BASE_MOVED` لم يقع. والفرعانِ كلاهما معلَّمٌ بـ`+` في `git branch --list` (مسحوبانِ في شجرتَي عملٍ أخريَين) — وهذا لا يمنعُ دمجَهما هنا.

### سلسلتا الإيداعات

```
$ git --no-pager log --oneline a332cb3..feat/lessons-browse-proxy-24c
dd12e2c docs: report lessons browse proxy gate correction
4c68dd1 fix: green lessons browse proxy gates
b82a61b docs: report blocked lessons browse proxy gate run
ed12562 feat: add lessons browse proxy and guard
5d026c0 docs: record lessons browse proxy measurements

$ git --no-pager log --oneline a332cb3..feat/lessons-browse-ui-24c
7c81437 report: item 24-C -- browsing is a second tab, not a second screen
b580cec feat(lessons): the section grows a browse tab -- scholar, series, lessons
```

---

## ١ · الدمجُ — الوسيطُ أوّلًا ثمّ الواجهة

`git checkout main` ⟹ `Already on 'main'` · `LASTEXITCODE=0`

| الدمج | رأسُ الدمج | أبواه | التعارضات |
|---|---|---|---|
| (ب) `feat/lessons-browse-proxy-24c` | `963cba83abc01fbaabb39ed9f8fece8f4add33c6` | `a332cb3b` + `dd12e2cd` | `CONFLICT_COUNT=0` |
| (ج) `feat/lessons-browse-ui-24c` | `195b3611c60dfc8510f31c891695e6cf017963ca` | `963cba83` + `7c81437b` | `CONFLICT_COUNT=0` |

كلاهما `Merge made by the 'ort' strategy` و`LASTEXITCODE=0`، و`git diff --name-only --diff-filter=U` صفرُ سطرٍ بعدَ كلٍّ.

### اتّحادُ الملفّاتِ الداخلة — مقيسٌ لا منقول

(ب) عشرةُ ملفّات · (ج) أربعة · **والتقاطعُ صفرٌ** (`INTERSECTION_COUNT=0`)، كما وعدَ الأمر:

```
(ب) .gitattributes · api/lessons-browse.js · gates.json · recon-audit.cjs
    guards/lessons-browse-guard.cjs · guards/fixtures-lessons-browse.json
    guards/stored-deen-sub-suite.cjs · EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md
    EZIK-CX-LESSONS-BROWSE-PROXY-24C-REPORT-2026-08-23.md
    EZIK-CX-LESSONS-BROWSE-PROXY-24C-B-REPORT-2026-08-23.md

(ج) app.js · app.jsx · guards/lessons-search-guard.cjs
    EZIK-CC-LESSONS-BROWSE-UI-24C-REPORT-2026-08-23.md
```

---

## ٢ · إعادةُ القطعِ — القيمُ الستُّ في إيداعٍ واحدٍ `9bd57fc`

`app.js` قُرِئَ من القرصِ لا من الأمر: **قبلَ الدمجِ `968689`** ⟶ **بعدَه `989166`** (`+20477`).

| # | الموضع | قبل | بعد |
|---|---|---|---|
| ١ | `sw.js:112` — `const CORE_BYTES` | `1802087` | `1822564` |
| ٢ | `sw.js:96` — جدولُ `CORE` النثريّ | `app.js 968689` | `app.js 989166` |
| ٣أ | `sw.js:44` — `const CACHE` | `'ezik-v21'` | `'ezik-v22'` |
| ٣ب | `quest-bank-integrity-guard.cjs:202` — `const SW_CACHE` | `'ezik-v21'` | `'ezik-v22'` |
| ٤ | `quest-bank-integrity-guard.cjs:1288` — مرآةُ `SW_PROSE` | `{ n: 968689, of: 'app.js' }` | `{ n: 989166, of: 'app.js' }` |
| ٦ | `quest-bank-integrity-guard.cjs:178` — `SEALED['sw.js']` | `c268b2f3…f125082` | `b8af94d7…6691616` |

**الترتيبُ المتَّبَع:** `core-bytes.cjs --write` ⟶ الجدولُ النثريُّ ⟶ رفعةُ الاسمِ في الموضعَين ⟶ مرآةُ `SW_PROSE` ⟶ **سطرُ السجلِّ** ⟶ **الختمُ آخِرًا** بعدَ استقرارِ `sw.js`.

`tools/core-bytes.cjs --write` طبعَ الجدولَ كاملًا وفيه `TOTAL 1822564` مقابلَ `declared 1802087` ثمّ `WROTE CORE_BYTES 1802087 -> 1822564`.

### الختمُ قُطِعَ عندَ `CR = 0` كما يشترطُ `D09`

مقيسٌ في Node بعدَّ البايتةِ `0x0D` — لا بـ`grep -c`:

```
SW_JS_BYTES=42994
SW_CR_BYTES=0
SW_SHA256=b8af94d75e25721b59a0b8f176dd65e93b4c96d6df1e614c0e98938006691616
```

**و`sw.js` لم يتغيّرْ حجمُه بايتةً واحدة: `42994 ⟶ 42994`** — لأنّ البدائلَ الثلاثةَ متساويةُ الطولِ حرفًا بحرف: `1802087⟶1822564` سبعةُ أرقامٍ، و`968689⟶989166` ستّةٌ، و`ezik-v21⟶ezik-v22` ثمانيةُ محارف.

### الاسمُ القديمُ — صفرُ مواضعَ في الكودِ الحيّ

`ezik-v21` (محدودًا بـ`(?![0-9])`) عبرَ `git ls-files` كلِّها: **صفرٌ في أيِّ `.js` أو `.cjs`**. وبقيَتْ عشرةُ مواضعَ، **كلُّها في تقاريرِ جولاتٍ ماضيةٍ `.md`** — وهي سجلٌّ تاريخيٌّ مجمَّدٌ، وخارجَ حدودِ §٥ أصلًا. و`ezik-v22` موضعانِ اثنانِ لا ثالثَ لهما: `sw.js:44` و`quest-bank-integrity-guard.cjs:202`.

**و`ezik-mushaf-pages-v1` لم يُمَسَّ** (مقيسٌ: ما يزالُ في `sw.js:506` و`quest-bank-integrity-guard.cjs:229`).

### نصُّ سطرِ السجلِّ الذي أُضيف

أُدرِجَ **الأحدثَ أوّلًا**، تحتَ ترويسةِ *Re-cut history* مباشرةً وفوقَ مدخلِ ٢٤-أ/٢٤-ب:

```
  //   2026-08-23   -- item 24-C gave the lessons section a BROWSE tab beside its search: a
  //                    scholar, then a series, then the lessons under it. Browsing is a second
  //                    TAB, not a second screen, so index.html did not move -- but app.js grew
  //                    968689 -> 989166 (+20477) under it, and CORE_BYTES followed
  //                    1802087 -> 1822564, re-cut from the disk by tools/core-bytes.cjs --write.
  //                    CACHE moved v21 -> ezik-v22 for the reason the two rounds below give:
  //                    index.html is in CORE and the bundle under it changed, so a returning
  //                    reader must stop being served the old shell out of the old store.
  //                    SW_CACHE, the SW_PROSE mirror and the byte table above sw.js CORE_BYTES
  //                    were re-cut in THIS commit, and the seal below AFTER all of them.
```

كُتِبَ **قبلَ** الختمِ كما يأمرُ البند. وسطرُ التاريخِ القديمُ الذي يذكرُ `947845 -> 955775 -> 968689` **تُرِكَ كما هو**: هو خبرٌ صادقٌ عن جولتَينِ ماضيتَين، لا مسمارٌ يُعادُ قطعُه.

الإيداع: `git add sw.js quest-bank-integrity-guard.cjs` ⟹ `9bd57fc` · ملفّانِ · `+16 / -6` · `LASTEXITCODE=0`.

---

## ٣ · تقريرُ التنفيذِ مع `recon` — لم يلزمْ تحديث

`recon` **لم يطبعْ `RECON summary is stale`**، بل طبعَ في القسمِ ١٦:

```
[PASS] implementation report matches gates.json, wird registration, and this recon summary
```

**العلّة:** فرعُ (ب) نفسُه يحملُ `EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md` بينَ ملفّاتِه العشرةِ (`+8/-8`)، فسطرُ الملخّصِ جاءَ مُحدَّثًا معَ البوّابةِ التي أضافَها. فلا إيداعَ مستقلًّا هنا، **ولم يُمَسَّ ذلك الملفُّ منّي بحرف**.

---

## ٤ · البوّاباتُ الأربعُ — حرفيًّا

### ١) `node tools/build-app.cjs --check`

```
built     989166 bytes  ef0d81adc80748d002d7306de5be369a49c8b4331a790c8d075c004804e4a43e
on disk   989166 bytes  ef0d81adc80748d002d7306de5be369a49c8b4331a790c8d075c004804e4a43e
OK: app.js is exactly what this source builds
LASTEXITCODE=0
```

### ٢) `node tools/run-gates.cjs` — **٩٢/٩٣ لا ٩٣/٩٣**

اللافتةُ طبعَتْ `=== SUITE: 92/93 EXIT=0 ===`، **ولم أصدّقْها**. الحكمُ خروجُ العمليّةِ و`summary.json`:

```
REAL_PROCESS_EXIT_LASTEXITCODE=1

summary.json:  passed = 92
               failed = lessonsbrowse
               total  = 93

FAILING (1): lessonsbrowse=1
evidence: C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-08-23T13-01-56-368Z-2572
```

الحمراءُ واحدةٌ: **`lessonsbrowse`** — وهي بوّابةُ فرعِ (ب) نفسِه. تفصيلُها في §٤ب أدناه.
و`recon` داخلَ الطقمِ: `SUMMARY PASS=185 WARN=1 FAIL=0` · و`tree after: 0 dirty path(s)`.

### ٣) `node recon-audit.cjs`

```
 SUMMARY   PASS=185   WARN=1   FAIL=0
LASTEXITCODE=0
```

و`WARN`ُ الواحدُ هو المعروفُ، طُبِعَ ولم يُصلَح:

```
[WARN] LONGEST_CARD_CHARS = 3405 > longest card 3401 -> cap oversized/stale (re-derive in api/report.js)
```

### ٤) `git status --porcelain`

`STATUS_LINE_COUNT=0` · `LASTEXITCODE=0` — مقيسٌ **قبلَ** كتابةِ هذا التقرير.

### `questux` — ثلاثُ تشغيلاتٍ في الشجرةِ الأمّ

| التشغيل | النتيجة | الخروج |
|---|---|---|
| ١ | `OK: 61/61 checks passed.` | `0` |
| ٢ | `OK: 61/61 checks passed.` | `0` |
| ٣ | `OK: 61/61 checks passed.` | `0` |

**خضراءُ ثلاثًا من ثلاث.** فحمرةُ `questux` في شجرةِ (ب) كانت **بيئةَ تلكَ الشجرة**، لا عطبًا في الرقعة — والشجرةُ الأمُّ هي الحكَمُ وقد حكمت.

---

## ٤ب · الحمراءُ التي توقفني — `lessonsbrowse`

الفشلُ **تأكيدٌ مسمًّى**، لا تعطُّلُ متصفّحٍ، في القسمِ الخامسِ وحدَه (`E. MUTATION PROOF`)؛ والأقسامُ أ–د خضراءُ بتمامِها:

```
=== E. MUTATION PROOF ===
  FAIL  M1 snippet pass-through is a real source mutation
  FAIL  M1 snippet pass-through is killed by the contract assertion
  PASS  M2 fourth accepted level is a real source mutation
  PASS  M2 fourth accepted level is killed by the contract assertion
  FAIL  at least two mutants were created and every one was killed
        1/2
  PASS  the API file on disk is unchanged after in-memory mutation

MUTANTS_KILLED=1/2
ASSERTIONS=78/81
=== FAIL ===
```

### العلّةُ مقيسةٌ: نهايةُ سطرٍ، لا منطق

مرساةُ `M1` في `guards/lessons-browse-guard.cjs:409` تعبرُ سطرًا:

```js
const snippetAnchor = "  carry(out, row, 'count');\n  return out;";
```

و`api/lessons-browse.js` **مسحوبٌ في هذه الشجرةِ بـCRLF**، فالمرساةُ ذاتُ `\n` لا تُطابِقُ شيئًا، فيخرجُ `snippetMutantSrc === apiSrc`: **طافرٌ لم يُخلَقْ**، فيسقطُ التأكيدُ الذي يشترطُ أنّ الطفرةَ حقيقيّةٌ. أمّا `M2` فمرساتُه سطرٌ واحدٌ بلا `\n` فطابقتْ ونجحت.

**القياسُ المباشر:**

```
DISK contains LF-anchor   : false
DISK contains CRLF-anchor : true
api/lessons-browse.js (working tree)  bytes=6915  CR=206
api/lessons-browse.js (git blob HEAD) bytes=6709  CR=0
guards/lessons-browse-guard.cjs       bytes=22049 CR=0
```

### السببُ الجذريُّ: سطرٌ ناقصٌ في `.gitattributes`

فرعُ (ب) أضافَ سطرًا واحدًا: `guards/lessons-browse-guard.cjs text eol=lf` — **فثبّتَ الحارسَ ولم يثبّتْ مقروءَه**. ولذلك الحارسُ `CR=0` والملفُّ الذي يقرؤُه `CR=206`.

### برهانٌ حاسمٌ بالتشغيل

صدّرتُ بايتاتِ المستودعِ الخامَ (`git show HEAD:<path>`، ٩٩٩ ملفًّا) إلى شجرةٍ مؤقّتةٍ خارجَ المستودع، فصارَ `api/lessons-browse.js` بـ`CR=0`، ثمّ شغّلتُ الحارسَ نفسَه هناك:

```
MUTANTS_KILLED=2/2
ASSERTIONS=81/81
=== PASS ===
GUARD_EXIT_LASTEXITCODE=0
```

**الإيداعُ نفسُه، والبايتاتُ نفسُها في git: خضراءُ ٨١/٨١ على سحبٍ بـLF، وحمراءُ ٧٨/٨١ على هذا السحبِ بـCRLF.** فما في `main` سليمٌ، والحمرةُ سحبُ هذه الشجرةِ على Windows.

> ملحوظةٌ: `git archive` **لا يصلحُ** لهذا البرهان — جرّبتُه أوّلًا فصدّرَ الملفَّ بـ`CR=206` أيضًا، لأنّه يطبّقُ تحويلَ شجرةِ العملِ. البرهانُ الصحيحُ بكتابةِ بايتاتِ الـblob الخامِ من `git show`.

### ولمَ لم أُصلحْها

الإصلاحُ سطرٌ واحدٌ — `api/lessons-browse.js text eol=lf` في `.gitattributes` ثمّ إعادةُ تطبيعِ الملفّ. و**§٥ تحرّمُ عليَّ `.gitattributes` و`api/**` و`guards/**` صراحةً**. فوقفتُ ولم أحسمْ باجتهادٍ، كما يأمرُ البند.

---

## ٥ · الحدودُ — ما مسِستُ وما لم أمسّ

**مسِستُ ملفّينِ اثنينِ لا غير**: `sw.js` و`quest-bank-integrity-guard.cjs`.

**ولم أمسَّ** `EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md` (لم يلزمْ — §٣)، ولا `index.html` ولا `app.jsx` ولا `app.js` ولا `api/**` ولا `lib/**` ولا `guards/**` ولا `gates.json` ولا `.gitattributes` ولا `theme-coverage-guard.cjs` ولا `recon-audit.cjs`.

ولا `git add .` وقعَ: الإيداعُ بأسماءٍ صريحةٍ. **ولا `git push` ولا نشرَ.**

`git --no-pager diff -U0` قبلَ الإيداعِ أظهرَ **ستَّ رقعٍ لا سابعةَ لها**: ثلاثٌ في `sw.js` وثلاثٌ في الحارسِ، معها كتلةُ السجلِّ العشريّة.

---

## ٦ · ما لم أقِسْه — بعلّتِه

1. **لم أفتحْ متصفّحًا ولم أرَ تبويبَ التصفّحِ يعملُ لقارئ.** كلُّ ما أشهدُ به عن (ج) هو أنّ `app.js` يُبنى من مصدرِه بالضبط (`build-app --check`) وأنّ بوّاباتِ الواجهةِ خضراء. **العلّة:** لا متصفّحَ في مسارِ هذا الأمر، وأمرُ الجولةِ لم يطلبْ تشغيلًا حيًّا.
2. **لم أتحقّقْ أنّ `ezik-v22` يُخلي `ezik-v21` فعليًّا على جهازِ قارئٍ.** المقيسُ حارسُ `bankintegrity` وحدَه، يشغّلُ العاملَ في `vm` بـ`caches` و`fetch` مُدجَّنَين. **العلّة:** لا جهازَ ولا متصفّحَ هنا.
3. **لم أقِسْ `lessonsbrowse` خضراءَ في الشجرةِ الأمِّ نفسِها** — إنّما في تصديرِ بايتاتٍ خامٍ خارجَها. **العلّة:** تخضيرُها في هذه الشجرةِ يقتضي تطبيعَ `api/lessons-browse.js` وتعديلَ `.gitattributes`، وكلاهما محرَّمٌ بـ§٥.
4. **لم أفحصْ لماذا حمرَتْ `questux` في شجرةِ (ب).** حكمتُ بالشجرةِ الأمِّ كما أُمِرتُ فخضرَتْ ثلاثًا، ولم أدخلْ تلكَ الشجرةَ. **العلّة:** خارجَ نطاقِ هذا الأمر.
5. **`WARN` الوحيدُ (`LONGEST_CARD_CHARS`) لم يُتحقَّقْ من أثرِه** — طُبِعَ ولم يُصلَحْ، كما نصَّ الأمرُ حرفًا.
6. **لم أمسحِ الشجرةَ بحثًا عن ملفّاتٍ أخرى تعاني انقسامَ CRLF/LF نفسَه.** قِستُ الملفَّينِ اللذَينِ تخصُّهما هذه الجولة. **العلّة:** مسحٌ شاملٌ خارجَ نطاقِ الأمر، وإنْ كانَ يستحقُّ جولةً خاصّةً به.
7. **لم أشغّلِ الطقمَ ثانيةً بعدَ إيداعِ هذا التقرير.** القياساتُ المذكورةُ كلُّها على `9bd57fc` بشجرةٍ نظيفة. **العلّة:** التقريرُ نفسُه يُوسِّخُ الشجرةَ، والأمرُ يطلبُ البوّاباتِ على النظيفةِ قبلَه.

---

## ٧ · الخلاصة

| الشيء | الحال |
|---|---|
| بوّابةُ §٠ | ✅ أربعتُها |
| الدمجانِ | ✅ صفرُ تعارضٍ في الاثنين |
| القيمُ الستُّ + سطرُ السجلّ | ✅ إيداعٌ واحدٌ `9bd57fc` |
| `build-app --check` | ✅ `OK` · خروج `0` |
| `run-gates` | ❌ **٩٢/٩٣** · خروجٌ حقيقيٌّ `1` · `lessonsbrowse` |
| `recon-audit` | ✅ `FAIL=0` `WARN=1` · خروج `0` |
| `git status` | ✅ صفرُ سطر |
| `questux` ×٣ | ✅ `61/61` ثلاثًا |
| `git push` / نشر | ⛔ لم يقعْ ولن يقع |

**`HEAD` = `9bd57fc2fe28971d6961aef86b7a0de699426daa`** · و`origin/main` ما يزالُ عندَ `a332cb3b` — الجولةُ كلُّها محلّيّةٌ.

**القرارُ المطلوبُ من المالك:** إذنٌ بسطرٍ واحدٍ في `.gitattributes` (`api/lessons-browse.js text eol=lf`) وإعادةِ تطبيعِ الملفّ — أو ردُّ الأمرِ إلى شجرةِ (ب) لتُصلحَه في فرعِها.

---

## ٨ · حمولةُ التقرير

**تعريفُ الحمولة:** كلُّ بايتاتِ هذا الملفِّ من أوّلِ محرفٍ فيه حتّى آخرِ سطرٍ يسبقُ سطرَ `REPORT_PAYLOAD_BYTES=` (غيرَ شاملٍ لسطرِ الفاصلِ `---` الذي يعلوه ولا لسطرَي القيمتَين)، مقروءةً خامًا بلا تطبيعِ نهاياتِ أسطر. و`REPORT_SHA8` أوّلُ ثمانيةِ محارفَ من `sha256` تلكَ الحمولةِ نفسِها.

---

## ٩ · ذيلٌ مؤرَّخ — ٢٣ أغسطس ٢٠٢٦ · تعديلُ الأمرِ ورفعُ الحمراء

المالكُ أذِنَ بتعديلٍ على أمرِ ٢٤-ج: فتحُ `.gitattributes` **لغرضٍ واحدٍ لا غير** — تثبيتُ `eol=lf` للملفّاتِ التي أضافَتْها هذه الجولةُ والتي نسختُها على القرصِ تحملُ `CR` بينما blobُها في git لا يحملُ شيئًا.

### ٩-١ · القياسُ أوّلًا — كلُّ ملفٍّ مسَّتْه (ب) أو (ج)

`CR` على القرصِ مقابلَ `CR` في الـblob، جنبًا إلى جنب. `ADDED` أضافَتْه الجولةُ، و`modif` كانَ موجودًا فعُدِّل:

```
file                                                origin  diskCR  blobCR  diskB     blobB    mismatch
------------------------------------------------------------------------------------------------------------
.gitattributes                                      modif   0       0       29633     29633
EZIK-CC-LESSONS-BROWSE-UI-24C-REPORT-2026-08-23.md  ADDED   333     0       25914     25581    <== MISMATCH
EZIK-CX-LESSONS-BROWSE-PROXY-24C-B-REPORT-2026-08-23.md ADDED 929     0       49824     48895    <== MISMATCH
EZIK-CX-LESSONS-BROWSE-PROXY-24C-REPORT-2026-08-23.md ADDED 310     0       18051     17741    <== MISMATCH
EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md           modif   0       0       34473     34473
api/lessons-browse.js                               ADDED   206     0       6915      6709     <== MISMATCH
app.js                                              modif   0       0       989166    989166
app.jsx                                             modif   0       0       1101363   1101363
gates.json                                          modif   0       0       9726      9726
guards/fixtures-lessons-browse.json                 ADDED   61      0       1793      1732     <== MISMATCH
guards/lessons-browse-guard.cjs                     ADDED   0       0       22049     22049
guards/lessons-search-guard.cjs                     modif   0       0       83828     83828
guards/stored-deen-sub-suite.cjs                    modif   738     0       46327     45589    <== MISMATCH
quest-bank-integrity-guard.cjs                      modif   0       0       114858    114858
recon-audit.cjs                                     modif   0       0       71907     71907
sw.js                                               modif   0       0       42994     42994

MISMATCHES=6
```

**ستُّ حالاتٍ، خمسٌ منها أضافَتْها هذه الجولةُ وواحدةٌ سابقةٌ عليها:**

| # | الملفّ | `CR` قرص | `CR` blob | أصلُه | داخلَ نطاقِ التعديل؟ |
|---|---|---|---|---|---|
| ١ | `api/lessons-browse.js` | `206` | `0` | ADDED | ✅ نعم — وهي المعلومةُ سلفًا |
| ٢ | `guards/fixtures-lessons-browse.json` | `61` | `0` | ADDED | ✅ نعم |
| ٣ | `EZIK-CX-LESSONS-BROWSE-PROXY-24C-REPORT-2026-08-23.md` | `310` | `0` | ADDED | ✅ نعم |
| ٤ | `EZIK-CX-LESSONS-BROWSE-PROXY-24C-B-REPORT-2026-08-23.md` | `929` | `0` | ADDED | ✅ نعم |
| ٥ | `EZIK-CC-LESSONS-BROWSE-UI-24C-REPORT-2026-08-23.md` | `333` | `0` | ADDED | ✅ نعم |
| ٦ | `guards/stored-deen-sub-suite.cjs` | `738` | `0` | **modif** | ❌ **لا** — سابقٌ على الجولةِ، عدَّلَتْه (ب) ولم تُضِفْه |

**و`app.js` و`app.jsx` كلاهما `CR=0` على القرصِ** — فلا خطرَ على مساميرِ `CORE_BYTES` التي قُطِعَتْ في §٢، إذ هي مقيسةٌ على قرصٍ بلا `CR` أصلًا. ولو كانَ أحدُهما مختلًّا لكانَ تطبيعُه يُغيِّرُ حجمَ `app.js` ويُحمِّرُ `bankintegrity` فورًا؛ وهذا لم يقع.

### ٩-٢ · لماذا التطبيعُ يُصلحُ الأختامَ ولا يكسرُها

التقاريرُ الثلاثةُ مختومةٌ ذاتيًّا بـ`REPORT_SHA8`، وتقريرُ (ج) **ينصُّ صراحةً** أنّ حمولتَه «بترميزِ `UTF-8` وبنهاياتِ أسطرِ `LF`». فأُعيدَ حسابُ الأختامِ الثلاثةِ على بايتاتِ الـblob (وهي `LF`) قبلَ لمسِ شيء:

```
EZIK-CC-LESSONS-BROWSE-UI-24C-REPORT   stated=c61e716a  LF-blob=c61e716a  *** MATCH ***
EZIK-CX-LESSONS-BROWSE-PROXY-24C-B     stated=d7f096af  LF-blob=d7f096af  *** MATCH ***
EZIK-CX-LESSONS-BROWSE-PROXY-24C       stated=ba97aa3a  LF-blob=ba97aa3a  *** MATCH ***
```

فالأختامُ قُطِعَتْ على `LF`، **والنسخةُ المحوَّلةُ إلى `CRLF` هي الحالُ المكسورة** لا العكس. فالتطبيعُ يُعيدُها إلى ما خُتِمَتْ عليه.

### ٩-٣ · الأسطرُ المضافةُ إلى `.gitattributes`

خمسةُ أسطرٍ وكتلةُ تعليقٍ تشرحُ العلّة، بالصيغةِ والترتيبِ اللذَينِ تتّبعُهما المداخلُ القائمةُ (المصدرُ، ثمّ الفيكستشر، ثمّ التقاريرُ المختومة — كما في كتلةِ `fiqhindex`):

```
# lessonsbrowse is an offline proxy-contract guard. Its own source was pinned when the gate
# landed, but the files it READS were not: api/lessons-browse.js checked out with 206 CR while
# git stored it at 0, so the M1 mutation anchor -- which spans a newline -- matched nothing and
# the mutant came back a no-op. Pin the proxy it mutates, its fixture, and the three self-sealed
# round reports, whose REPORT_SHA8 payloads are defined over LF bytes and verify only on LF.
api/lessons-browse.js text eol=lf
guards/fixtures-lessons-browse.json text eol=lf
EZIK-CX-LESSONS-BROWSE-PROXY-24C-REPORT-2026-08-23.md text eol=lf
EZIK-CX-LESSONS-BROWSE-PROXY-24C-B-REPORT-2026-08-23.md text eol=lf
EZIK-CC-LESSONS-BROWSE-UI-24C-REPORT-2026-08-23.md text eol=lf
```

**ولم يُضَفْ سطرٌ لـ`guards/stored-deen-sub-suite.cjs`** رغمَ أنّ قياسَه يُظهرُ الخللَ نفسَه (`738 CR`): التعديلُ أذِنَ بـ«الملفّاتِ التي أضافَتْها هذه الجولة»، وهذا الملفُّ سابقٌ عليها. **مُبلَّغٌ للمالكِ ولم يُمَسّ.**

### ٩-٤ · التطبيعُ — `CR` قبلَ وبعد

أُسقِطَتِ النسخُ العاملةُ ثمّ أُعيدَ سحبُها تحتَ السماتِ الجديدة (`git checkout --`، خروج `0`):

| الملفّ | `CR` قبل | بايتات قبل | `CR` بعد | بايتات بعد |
|---|---|---|---|---|
| `api/lessons-browse.js` | `206` | `6915` | **`0`** | **`6709`** |
| `guards/fixtures-lessons-browse.json` | `61` | `1793` | **`0`** | **`1732`** |
| `EZIK-CX-LESSONS-BROWSE-PROXY-24C-REPORT-…md` | `310` | `18051` | **`0`** | **`17741`** |
| `EZIK-CX-LESSONS-BROWSE-PROXY-24C-B-REPORT-…md` | `929` | `49824` | **`0`** | **`48895`** |
| `EZIK-CC-LESSONS-BROWSE-UI-24C-REPORT-…md` | `333` | `25914` | **`0`** | **`25581`** |

وكلُّ حجمٍ «بعد» يساوي حجمَ blobِه في الجدولِ أعلاه بالضبط — فالقرصُ صارَ نسخةَ git حرفًا بحرف.

### ٩-٥ · البرهانُ أنّ لا blob تحرّك

```
$ git status --porcelain
 M .gitattributes

$ git diff --cached --name-only
.gitattributes
CACHED_FILE_COUNT=1

$ git diff --cached --stat
 .gitattributes | 11 +++++++++++
 1 file changed, 11 insertions(+)

$ git diff --name-only          # تغييراتٌ غيرُ مُدرَجة
UNSTAGED_COUNT=0
```

**ملفٌّ واحدٌ في الفهرسِ لا غير، و`+11` سطرًا إدراجًا لا حذفًا، وصفرُ تغييرٍ غيرِ مُدرَج.** الخمسةُ المطبَّعةُ لم تظهرْ في الفهرسِ أصلًا لأنّ blobَها كانَ `LF` من قبلُ: التطبيعُ غيّرَ القرصَ وحدَه.

الإيداع: `git commit .gitattributes` باسمٍ صريح ⟹ **`85a5d10`** · ملفٌّ واحدٌ · `+11` · `LASTEXITCODE=0`.

### ٩-٦ · البوّاباتُ الثلاثُ بعدَ الرقعة

**١) `node tools/build-app.cjs --check`**

```
built     989166 bytes  ef0d81adc80748d002d7306de5be369a49c8b4331a790c8d075c004804e4a43e
on disk   989166 bytes  ef0d81adc80748d002d7306de5be369a49c8b4331a790c8d075c004804e4a43e
OK: app.js is exactly what this source builds
LASTEXITCODE=0
```

**٢) `node tools/run-gates.cjs`**

```
lessonsbrowse        EXIT=0  (68ms)

=== SUITE: 93/93 EXIT=0 ===
recon:    SUMMARY   PASS=185   WARN=1   FAIL=0
tree after: 0 dirty path(s)

REAL_PROCESS_EXIT_LASTEXITCODE=0

summary.json:  passed = 93
               failed = ''
               total  = 93
               non-zero gates: 0
```

**واللافتةُ هذه المرّةَ صادقةٌ — ولم أصدّقْها وحدَها**: خروجُ العمليّةِ الحقيقيُّ `0`، و`failed` سلسلةٌ فارغةٌ، وصفرُ بوّابةٍ بخروجٍ غيرِ صفريّ. الثلاثةُ متوافقة.

**٣) `node recon-audit.cjs`**

```
 SUMMARY   PASS=185   WARN=1   FAIL=0
LASTEXITCODE=0
```

و`WARN`ُ الواحدُ هو `LONGEST_CARD_CHARS` المعروفُ نفسُه — طُبِعَ ولم يُصلَحْ، ولم يتغيّرْ عددُ التأكيداتِ (`185`) عمّا كانَ قبلَ الرقعة.

### ٩-٧ · الحارسُ نفسُه، والأختامُ

`node guards/lessons-browse-guard.cjs` في الشجرةِ الأمّ:

```
  PASS  M1 snippet pass-through is a real source mutation
  PASS  M1 snippet pass-through is killed by the contract assertion
  PASS  M2 fourth accepted level is a real source mutation
  PASS  M2 fourth accepted level is killed by the contract assertion
  PASS  at least two mutants were created and every one was killed
  PASS  the API file on disk is unchanged after in-memory mutation

MUTANTS_KILLED=2/2
ASSERTIONS=81/81
=== PASS ===
GUARD_LASTEXITCODE=0
```

`78/81 ⟶ 81/81` و`1/2 ⟶ 2/2`. والأختامُ الذاتيّةُ الثلاثةُ صارتْ تتحقّقُ **على القرصِ** بعدَ أن كانتْ لا تتحقّقُ إلّا في git:

```
EZIK-CC-LESSONS-BROWSE-UI-24C-REPORT   stated=c61e716a onDisk=c61e716a  VERIFIES
EZIK-CX-LESSONS-BROWSE-PROXY-24C-B     stated=d7f096af onDisk=d7f096af  VERIFIES
EZIK-CX-LESSONS-BROWSE-PROXY-24C       stated=ba97aa3a onDisk=ba97aa3a  VERIFIES
```

### ٩-٨ · ما لم يتغيّرْ

لا أرضيّةَ خُفِضَتْ · لا تأكيدَ نُزِعَ (`81` كما كانَ مطلوبًا، و`185` في `recon` كما كانت) · لا ملفَّ استُثنيَ · لا منطقَ حارسٍ مُسّ. و`index.html` و`app.jsx` و`app.js` و`api/**` و`guards/**` **لم يتحرّكْ منها blob واحد** — والبرهانُ §٩-٥. الإيداعُ الوحيدُ في هذا الذيلِ رقعةُ `.gitattributes` وحدَها.
**ولا `git push` ولا نشرَ.**

### ٩-٩ · ما لم أقِسْه في هذا الذيل — بعلّتِه

1. **لم أتحقّقْ أنّ `guards/stored-deen-sub-suite.cjs` سليمٌ رغمَ `738 CR`.** بوّابتُه خضراءُ اليومَ، لكنّي لم أفحصْ هل يحملُ حارسُها مرساةً عابرةً لسطرٍ كمرساةِ `M1`. **العلّة:** خارجَ نطاقِ التعديلِ المأذونِ (ملفٌّ لم تُضِفْه هذه الجولة). **مُبلَّغٌ، ويستحقُّ أمرًا خاصًّا به.**
2. **هذا التقريرُ نفسُه (`EZIK-CC-MERGE-24C-REPORT-…md`) غيرُ مثبَّتٍ بـ`eol=lf`.** قياسُه الآنَ `CR=0` على القرصِ و`0` في الـblob، **فلا مطابقةَ لشرطِ التعديل** ولم أُضِفْ له سطرًا. لكنّ git حذَّرَ حرفيًّا: `LF will be replaced by CRLF the next time Git touches it` — فإذا وقعَ ذلك انكسرَ `REPORT_SHA8` أدناه بالضبطِ كما انكسرَتْ أختامُ الثلاثةِ. **مُبلَّغٌ للمالك، ولم أتصرّفْ**: التعديلُ أذِنَ بإيداعِ `.gitattributes` مرّةً واحدةً ولملفّاتٍ يُظهرُ قياسُها الخللَ، وهذا لا يُظهرُه بعد.
3. **لم أمسحِ الشجرةَ كلَّها بحثًا عن انقسامِ `CRLF/LF`** — قِستُ ستّةَ عشرَ ملفًّا مسَّتْها هذه الجولةُ وحدَها. **العلّة:** التعديلُ حدَّدَ النطاقَ بملفّاتِ الجولة.
4. **لم أفتحْ متصفّحًا** — كما في §٦؛ لا شيءَ في هذا الذيلِ يغيّرُ ذلك.
5. **لم أُعِدْ تشغيلَ `questux` ثلاثًا بعدَ الرقعة.** شغّلَها الطقمُ مرّةً وخرجَتْ `EXIT=0` ضمنَ الـ٩٣. **العلّة:** التعديلُ طلبَ ثلاثةَ أوامرَ بعينِها، وثلاثيّةُ `questux` كانت لحسمِ نسبةِ الحمرةِ إلى البيئةِ وقد حُسِمَتْ في §٤.

### ٩-١٠ · خلاصةُ الذيل

| الشيء | قبلَ الذيل | بعدَه |
|---|---|---|
| `run-gates` | ٩٢/٩٣ · خروج `1` | **٩٣/٩٣ · خروج `0`** |
| `summary.json` | `passed=92 failed=lessonsbrowse` | **`passed=93 failed=''`** |
| `lessonsbrowse` | `78/81` · `1/2` طافر | **`81/81` · `2/2`** |
| `build-app --check` | `OK` · `0` | `OK` · `0` |
| `recon-audit` | `FAIL=0 WARN=1` · `0` | `FAIL=0 WARN=1` · `0` |
| `git status` | صفرُ سطر | صفرُ سطر |
| blobs متحرّكة | — | **`.gitattributes` وحدَه** |

`HEAD = 85a5d10e018db33f130913f155f5c63cfb8dfb26` · و`origin/main` ما يزالُ `a332cb3b`. الجولةُ كلُّها محلّيّةٌ، ولا دفعَ ولا نشر.

---

REPORT_PAYLOAD_BYTES=31901
REPORT_SHA8=8538f78c
