# تقريرُ دمجِ ٢٤-ب — قسمُ الدروسِ إلى `main`

**التاريخ:** ٢٣ أغسطس ٢٠٢٦ · **الشجرة:** `C:\Users\passe\projects\ustaz` (الشجرةُ الأمُّ، وهي وحدَها تملكُ `main`)
**كلُّ رقمٍ هنا مقيسٌ في هذه الجلسة**، ومخرجُ كلِّ خطوةٍ مطبوعٌ. وما لم يُقَسْ فله §٧.
**لا دفعَ ولا نشر:** `origin/main` بعدَ العملِ ما زالَ `3eb5aff6…` — مقيسٌ في §٦.

---

## ٠ · بوّابةُ الدخول — كما قِستُها

```
--- origin/main ---                        3eb5aff60542f467cb0d10ddb165f090623ff0ed   EXIT=0
--- main ---                               3eb5aff60542f467cb0d10ddb165f090623ff0ed   EXIT=0
--- feat/lessons-section-24b ---           c56d5c22b113ed8a7d411121a9c13f485048c36a   EXIT=0
--- is-ancestor e07d0eb -> the branch ---  EXIT=0
--- status ---                             (صفرُ سطر)                                  EXIT=0
```

| الشيء | القيمةُ المطلوبة | ما قِستُه | الحكم |
|---|---|---|---|
| `git rev-parse origin/main` | `3eb5aff60542f467cb0d10ddb165f090623ff0ed` | `3eb5aff60542f467cb0d10ddb165f090623ff0ed` | مطابق ⟹ **لا `BASE_MOVED`** |
| `merge-base --is-ancestor e07d0eb …` | خروجٌ `0` | `EXIT=0` | مطابق |
| `git status --porcelain` | صفرُ سطر | صفرُ سطر | مطابق |

**سلسلةُ إيداعاتِ الفرع**، كما يأمرُ §٠ بطبعِها:

```
git log --oneline 3eb5aff..feat/lessons-section-24b
c56d5c2 docs: report the lessons section round (item 24-b)
e07d0eb chore: register the lessons screen in the theme inventory (item 24-b)
6fcaa36 feat: the lessons section -- a search screen in ezik (item 24-b)
EXIT=0
```

رأسُ الفرعِ `c56d5c2` يعلو `e07d0eb` بإيداعِ التقرير، وهو ما استبقَه الأمر. **والتحقّقُ جرى بالسَّلَفِ لا بالمساواةِ**، ومخرجُه `EXIT=0` أعلاه.

---

## ١ · الدمج — **صفرُ تعارض**

```
git checkout main
Switched to branch 'main'
Your branch is up to date with 'origin/main'.
CHECKOUT_EXIT=0

git merge --no-ff feat/lessons-section-24b
Merge made by the 'ort' strategy.
 EZIK-CC-LESSONS-SECTION-24B-REPORT-2026-08-23.md | 327 +++++++++++++++++++++++
 EZIK-THEME-33-HANDOFF.md                         |   3 +-
 app.js                                           |  85 +++++-
 app.jsx                                          | 251 ++++++++++++++++-
 guards/lessons-search-guard.cjs                  | 218 +++++++++++++++
 theme-coverage-guard.cjs                         |  44 ++-
 6 files changed, 906 insertions(+), 22 deletions(-)
 create mode 100644 EZIK-CC-LESSONS-SECTION-24B-REPORT-2026-08-23.md
MERGE_EXIT=0

git diff --name-only --diff-filter=U
UNMERGED_EXIT=0
```

| الشيء | القيمةُ المقيسة |
|---|---|
| **عددُ التعارضات** | **صفر** — `--diff-filter=U` ⟹ صفرُ سطر |
| **الملفّاتُ المتعارضة** | لا شيء |
| **رأسُ الدمج** | `a68e4b4a470e740ba341c664bb63772d051c72f5` |
| **أبواه** | `3eb5aff` (رأسُ `main` السابق) و`c56d5c2` (رأسُ الفرع) — مقيسٌ بـ`git log -1 --format=%p` |
| **الملفّاتُ الداخلة** | ستّة: التقريرُ الجديد · `EZIK-THEME-33-HANDOFF.md` · `app.js` · `app.jsx` · `guards/lessons-search-guard.cjs` · `theme-coverage-guard.cjs` |

صفرُ التعارضِ مُبرهَنٌ لا مُخمَّن: الفرعُ مقطوعٌ من `3eb5aff` نفسِه، والدمجُ أنهى بـ`EXIT=0` بلا مسارٍ واحدٍ غيرِ مدموج.

---

## ٢ · إعادةُ القطع — إيداعٌ واحدٌ يجمعُ الخمسةَ وسطرَ السجلّ

نُفِّذَتْ بالترتيبِ المأمورِ به: ١ ثمّ ٢ ثمّ ٣ ثمّ ٤ ثمّ **٦** ثمّ **٥** ثمّ ٧ — سطرُ السجلِّ **قبلَ** الختمِ، والختمُ آخرَ حرفٍ يستقرُّ.

### ٢-١ جدولُ القيمِ الخمسِ — قبلَ وبعدُ

| # | الموضع | قبل | بعد | كيفَ اشتُقَّتِ القيمةُ الجديدة |
|---|---|---|---|---|
| ١ | `sw.js:112` — `const CORE_BYTES` | `1789173` | `1802087` | `node tools/core-bytes.cjs --write` — تقرأُ مصفوفةَ `CORE` من `sw.js` نفسِه وتجمعُ العشرةَ على القرص |
| ٢ | `sw.js:96` — نثرُ جدولِ `CORE` | `app.js 955775` | `app.js 968689` | `fs.statSync('app.js').size` **من القرصِ**، لا نقلًا من الأمر |
| ٣أ | `sw.js:44` — `const CACHE` | `'ezik-v20'` | `'ezik-v21'` | الرقمُ الحاليُّ مقروءٌ من الملفِّ ومرفوعٌ واحدًا |
| ٣ب | `quest-bank-integrity-guard.cjs:182` — `const SW_CACHE` | `'ezik-v20'` | `'ezik-v21'` | نظيرُه، في الإيداعِ نفسِه |
| ٤ | `quest-bank-integrity-guard.cjs:1268` — مرآةُ `SW_PROSE` | `{ n: 955775, of: 'app.js' }` | `{ n: 968689, of: 'app.js' }` | القيمةُ المقيسةُ نفسُها من القرص |
| ٥ | `quest-bank-integrity-guard.cjs:168` — `SEALED['sw.js']` | `b21c1c8fbc90939692fa4c48bd995d0b6e842b1f6aabbe61b2c73038269f3b87` | `c268b2f352d2697f410b13e7dc58bfc09b5dbd11a788b5295b553a5d3f125082` | `sha256` لـ`sw.js` **بعدَ استقرارِه نهائيًّا**، على شجرةٍ مقيسةٍ عندَ `CR = 0` |

والفرقُ في القيمِ **ستّةُ أسطرٍ لا سابعَ**، مقيسٌ بـ`git diff -U0`:

```
-  'sw.js': 'b21c1c8fbc90939692fa4c48bd995d0b6e842b1f6aabbe61b2c73038269f3b87',
+  'sw.js': 'c268b2f352d2697f410b13e7dc58bfc09b5dbd11a788b5295b553a5d3f125082',
-const SW_CACHE = 'ezik-v20';
+const SW_CACHE = 'ezik-v21';
-      { n: 955775, of: 'app.js' },
+      { n: 968689, of: 'app.js' },
-const CACHE = 'ezik-v20';
+const CACHE = 'ezik-v21';
-//   /  (index.html) 120617 + app.js 955775 + icon-watermark.png 368386
+//   /  (index.html) 120617 + app.js 968689 + icon-watermark.png 368386
-const CORE_BYTES = 1789173;
+const CORE_BYTES = 1802087;
```

### ٢-٢ مخرجُ الخطوةِ الأولى، كما طُبِع

```
=== CORE, as sw.js names it and as the disk answers ===
CORE entry                file on disk                   bytes
--------------------------------------------------------------
/                         index.html                    120617
/manifest.json            manifest.json                    533
/icon-192.png             icon-192.png                    5053
/icon-512.png             icon-512.png                   12893
/icon-maskable-512.png    icon-maskable-512.png           5938
/icon-watermark.png       icon-watermark.png            368386
/adhkar.json              adhkar.json                   177392
/app.js                   app.js                        968689
/vendor/react.umd.js      vendor/react.umd.js            10751
/vendor/react-dom.umd.js  vendor/react-dom.umd.js       131835
--------------------------------------------------------------
TOTAL                                                  1802087

declared in sw.js:  1789173
measured on disk:   1802087
WROTE  CORE_BYTES  1789173 -> 1802087
CORE_BYTES_WRITE_EXIT=0
```

الفرقُ `1802087 − 1789173 = 12914` بايتة، **وهو بعينِه** نموُّ `app.js` (`968689 − 955775 = 12914`) الذي أحدثَه البند ٢٤-ب. فلا بقيّةَ في هذا الانحرافِ لملفٍّ آخر.

### ٢-٣ سطرُ السجلِّ الذي أُضيف — **الدَّينُ المرفوعُ من جولةِ ٢٤-أ**

أُدرِجَ في رأسِ تعليقِ *Re-cut history* فوقَ الختمِ، الأحدثُ أوّلًا كما يقتضي العرفُ المكتوبُ هناك، **وقبلَ قطعِ الختمِ**. نصُّه كما هو في الملفِّ:

```
  //   2026-08-23   -- items 24-A and 24-B put the lessons route in the interface: first the tail
  //                    card under a settled reply, then the section of its own. app.js grew
  //                    947845 -> 955775 -> 968689 across the two merge rounds, so CORE_BYTES and
  //                    the byte table above it were re-cut from the disk both times, by
  //                    tools/core-bytes.cjs --write. CACHE moved ezik-v19 -> v20 -> v21: index.html
  //                    is in CORE and the bundle under it changed, so a returning reader must stop
  //                    being served the old shell out of the old store. SW_CACHE and the SW_PROSE
  //                    mirror were re-cut in the SAME commit each time. This line is the one the
  //                    24-A merge round owed and did not write: its order allowed the four values
  //                    and the seal only, so the seal moved with no word here saying why.
```

وهو **مُدخَلٌ واحدٌ يغطّي الجولتين**، لأنّ الدَّينَ نشأ في ٢٤-أ ولم يكنْ لي أن أكتبَه هناك: حدودُ ذلك الأمرِ أذِنَتْ بالقيمِ الأربعِ والختمِ فقط، فتحرّكَ الختمُ يومَها بلا كلمةٍ في الحارسِ تقولُ لماذا. وقد رُفِعَ ذلك في تقريرِ دمجِ ٢٤-أ (§٧/٣) وأُذِنَ به هنا صراحةً في §٢/٦.

**ولا أثرَ له على ختمِ `sw.js`**: الحارسُ لا يختمُ نفسَه — الختمُ في خريطةِ `SEALED` يخصُّ `sw.js` وحدَه، والسطرُ مكتوبٌ في الحارس. وقد كُتِبَ قبلَ الخطوةِ ٥ على كلِّ حالٍ، فترتيبٌ خاطئٌ لم يقعْ.

### ٢-٤ `sw.js` بايتاتُه قبلَ وبعدُ — **لم تتغيّرْ، وهذا مقيس**

| الملفّ | بايتاتٌ قبل | بايتاتٌ بعد | الفرق |
|---|---|---|---|
| `sw.js` | `42994` | `42994` | **`0`** |
| `quest-bank-integrity-guard.cjs` | `112962` | `113928` | `+966` |

«قبل» مقيسٌ على `a68e4b4` (بعدَ الدمجِ وقبلَ أوّلِ تحرير) بـ`git show a68e4b4:<file> | wc -c`؛ و«بعد» على القرصِ بـ`wc -c`.

**ورفعةُ الاسمِ متساويةُ الطول، والأمرُ يطلبُ التصريحَ بذلك**: `ezik-v20 ⟶ ezik-v21` ثمانيةُ محارفَ لكليهما. وكذلك بقيّةُ البدائلِ في `sw.js`: `1789173 ⟶ 1802087` سبعةُ أرقامٍ لكليهما، و`955775 ⟶ 968689` ستّةٌ لكليهما. فالثلاثةُ متساويةُ الطولِ، **ولذلك بقيَ حجمُ `sw.js` كما كان بالضبط**. ولو رُفِعَ الاسمُ يومًا إلى `ezik-v100` لزادَ الملفُّ بايتةً واحدةً — ولوجبَ قطعُ الختمِ بعدَ ذلك لا قبلَه، وهو الترتيبُ المتَّبَعُ هنا على كلِّ حال.

والزيادةُ في الحارسِ (`+966`) هي سطرُ السجلِّ وحدَه؛ والقيمُ الثلاثُ فيه متساويةُ الطولِ أيضًا (الاسمُ، والرقمُ، والختمُ ٦٤ محرفًا ستّةَ عشريًّا).

### ٢-٥ ما قِستُه حولَ الرفعةِ والختم

- **`ezik-mushaf-pages-v1` لم يُمَسَّ.** مقيسٌ بعدَ الرفعة: `sw.js:506` و`quest-bank-integrity-guard.cjs:219` ما زالا يحملانِه، والبوّابةُ تؤكِّدُه بسطرين — `PASS a version bump sweeps the superseded store and LEAVES "ezik-mushaf-pages-v1" intact` و`PASS the page store still carries its own unversioned name (ezik-mushaf-pages-v1)`.
- **الاسمُ القديمُ في الشجرة.** الأمرُ يطلبُ قياسَ أنّه «صفرُ مواضع». المقيسُ بعدَ الرفعةِ بـ`git grep -n "ezik-v20" -- '*.js' '*.cjs' '*.json' '*.html'` ⟹ **صفرُ نتيجةٍ، خروجٌ `1`**. والباقي ثمانيةُ مواضعَ في تقريرٍ تاريخيٍّ واحدٍ هو `EZIK-CC-MERGE-24A-REPORT-2026-08-23.md`، وهي تسجّلُ الرفعةَ السابقة. وهذا هو العرفُ نفسُه الذي تبِعَه `ezik-v19` و`ezik-v18` قبلَه، والتقاريرُ التاريخيّةُ خارجَ حدودِ §٤. فالصياغةُ الدقيقة: **صفرٌ في كلِّ موضعٍ يقرؤُه برنامجٌ أو حارس، وثمانيةٌ في سجلٍّ لا يُقرَأُ إلّا بعين.**
- **الختمُ يسكنُ الحارسَ لا الملفَّ الذهبيّ.** أعدتُ قياسَه: `grep -c "sw.js" quest-data/bank-integrity-golden.json` ⟹ `0` (خروجٌ `1`، أي لا مطابقة). **ولم يُعَدْ توليدُ الملفِّ الذهبيِّ جملةً** — لم يُمَسَّ بحرفٍ وليسَ في قائمةِ التغيير.
- **`CR = 0` قبلَ قطعِ الختم.** قِستُ قبلَ القطع: `sw.js bytes = 42994 · CR = 0`، وجعلتُ السكربتَ **يرفضُ** القطعَ لو خالفَ. ولم يخالفْ.
- **فخُّ نهاياتِ الأسطرِ الذي حذّرَ منه §٣**: قِستُ الملفَّينِ بعدَ كلِّ كتابة. `sw.js: CRLF=0 loneLF=738` و`quest-bank-integrity-guard.cjs: CRLF=0 loneLF=1912` — **كلاهما `LF` خالصٌ بلا خلط**، فسطرُ السجلِّ المكتوبُ بـ`\n` موافقٌ لما حولَه لا مخالفٌ له. (وكلاهما مرصودٌ `text eol=lf` في `.gitattributes`، بخلافِ `EZIK-THEME-33-HANDOFF.md` الذي أوقعَ الجولةَ السابقةَ.)

### ٢-٦ الإيداع

```
git add sw.js quest-bank-integrity-guard.cjs
ADD_EXIT=0
COMMIT_EXIT=0
01f4d8f chore: re-cut the four app.js pins, the sw.js seal and its log (merge 24-b)
git status --porcelain  ⟹  صفرُ سطر
```

**إيداعٌ واحدٌ يحملُ الخمسةَ وسطرَ السجلّ**، بأسماءَ صريحةٍ لا `git add .`.

---

## ٣ · البوّاباتُ الأربع — على شجرةٍ نظيفةٍ بعدَ الإيداع

### ١) `node tools/build-app.cjs --check` ⟹ **`OK`**

```
built     968689 bytes  0cd7f9ceb58728103c7dc1f1a16f28c5b98596504f4bed6fe5ca87857a443e3f
on disk   968689 bytes  0cd7f9ceb58728103c7dc1f1a16f28c5b98596504f4bed6fe5ca87857a443e3f
OK: app.js is exactly what this source builds
BUILD_CHECK_EXIT=0
```

### ٢) `node tools/run-gates.cjs` ⟹ **`92/92 EXIT=0`**

```
=== SUITE: 92/92 EXIT=0 ===
recon:    SUMMARY   PASS=184   WARN=1   FAIL=0
tree after: 0 dirty path(s)
evidence: C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-08-23T10-39-05-354Z-19668
GATES_EXIT=0
```

لا سطرَ `FAILING`. والحمرةُ التي أنهَتْ جولةَ ٢٤-ب عندَ `91/92` أُغلِقَتْ.

**و`bankintegrity` كاملةً — وهي سببُ هذه الجولة:**

```
PASS  76 checks passed, 0 failed.
```

كانت في جولةِ ٢٤-ب `74 checks passed, 2 failed`. والسطورُ التي تخصُّ الخمسةَ، من سجلِّها:

```
-- B10 sealed files (unconditional: no git, no skip) --
  sealed files hashed: 13/13
  PASS all 13 sealed files are byte-for-byte unchanged

-- B11 service worker: data files must revalidate (item 80) --
  PASS service worker opens cache "ezik-v21"

-- B12 service worker: storage quota management (item 91-A) --
  PASS the eviction never touches the current store "ezik-v21"
  PASS CORE_BYTES (1802087) equals the 1802087 bytes CORE weighs on disk, exactly
  PASS every size sw.js states in prose is true of the disk (17 claims)
  PASS no unregistered number of 500 or more survives in sw.js prose (4 declared uncheckable, each with its reason)

-- B15 service worker: the printed mushaf pages are capped (item 33) --
  PASS a version bump sweeps the superseded store and LEAVES "ezik-mushaf-pages-v1" intact

-- B16 offline package: the policy the page is answered with (A-4) --
  PASS the page store still carries its own unversioned name (ezik-mushaf-pages-v1)
```

كلُّ واحدةٍ من الخمسِ يقابلُها تأكيدٌ أخضرُ يسمّيها بقيمتِها الجديدة: الختمُ في `B10` (١٣/١٣ بايتًا ببايت)، والاسمُ في `B11` و`B12`، والثابتُ في `B12` («يساوي بالضبط»)، والنثرُ في `B12` («سبعَ عشرةَ دعوى، كلُّها صادقةٌ على القرص»)؛ ومرآةُ `SW_PROSE` هي أداةُ تلكَ الدعاوى السبعَ عشرةَ نفسِها.

### ٣) `node recon-audit.cjs` ⟹ **`FAIL=0`**

```
==================================================================
 SUMMARY   PASS=184   WARN=1   FAIL=0
 No structural FAILs. WARNs are eyeball items, not necessarily bugs.
==================================================================
RECON_EXIT=0
```

و`WARN` واحدٌ، هو المعروفُ نفسُه، مطبوعٌ ولم يُصلَحْ كما يأمرُ §٣:

```
[WARN] LONGEST_CARD_CHARS = 3405 > longest card 3401 -> cap oversized/stale (re-derive in api/report.js)
```

**ولا أثرَ لفخِّ نهاياتِ الأسطرِ هذه المرّة**: لا سطرَ `MIXED line endings` في المخرج، والقياسُ المباشرُ في §٢-٥ يؤكّدُه.

### ٤) `git status --porcelain` ⟹ **صفرُ سطر**

ثمّ صارَ هذا التقريرُ وحدَه غيرَ متتبَّعٍ قبلَ إيداعِه.

---

## ٤ · الشجرةُ بعدَ العمل

| الملفّ | بايتات | `sha256[0:8]` |
|---|---|---|
| `sw.js` | `42994` | `c268b2f3` |
| `quest-bank-integrity-guard.cjs` | `113928` | `a8ec393f` |
| `app.js` | `968689` | `0cd7f9ce` |
| `app.jsx` | `1077614` | `d4103039` |
| `index.html` | `120617` | `0933a9cb` |

`index.html` و`app.jsx` و`app.js` لم تُمَسَّ في هذه الجولةِ ألبتّة — بصماتُها هي بصماتُ نهايةِ جولةِ ٢٤-ب نفسُها، و`index.html` هي بصمةُ `f626ed18` منذُ ثلاثِ جولات.

---

## ٥ · الإيداعات

| البصمةُ القصيرة | البصمةُ الكاملة | ما فيه |
|---|---|---|
| `a68e4b4` | `a68e4b4a470e740ba341c664bb63772d051c72f5` | `merge: the lessons section (item 24-b)` — دمجٌ `--no-ff`، أبواه `3eb5aff` و`c56d5c2` |
| `01f4d8f` | `01f4d8f17b5c77593082a20f1b3ce51d555903c8` | `chore: re-cut the four app.js pins, the sw.js seal and its log (merge 24-b)` — `sw.js` · `quest-bank-integrity-guard.cjs` |

ورأسُ `main` الآنَ `01f4d8f17b5c77593082a20f1b3ce51d555903c8`. وقِستُ أنّ إيداعاتِ الفرعِ الثلاثةَ صارَتْ أسلافًا لـ`main`:

```
6fcaa36 ancestor_of_main_EXIT=0
e07d0eb ancestor_of_main_EXIT=0
c56d5c2 ancestor_of_main_EXIT=0
```

---

## ٦ · لا دفعَ ولا نشر

```
git rev-parse origin/main
3eb5aff60542f467cb0d10ddb165f090623ff0ed
```

`origin/main` بعدَ كلِّ العملِ عندَ نقطةِ البداية، فـ**لم يقعْ دفعٌ**. ولم يُشغَّلْ أمرُ نشرٍ ولا `vercel` من أيِّ نوع. `main` المحلّيُّ يسبقُ `origin/main` بخمسةِ إيداعاتٍ في انتظارِ أمرِ المالكِ المستقلّ.

---

## ٧ · ما لم أقِسْه — بعلّتِه

1. **لم أفتحْ متصفّحًا ولم أرَ الرفعةَ تعملُ على جهازِ قارئ.** أنّ `ezik-v21` يُخلي مخزنَ `ezik-v20` ويُبقي `ezik-mushaf-pages-v1` **مقيسٌ بحارسِ `bankintegrity` وحدَه** — يشغّلُ العاملَ في `vm` بـ`caches` و`fetch` مُدجَّنَين — لا بمتصفّحٍ ولا بجهاز. **العلّة:** لا متصفّحَ في هذا المسار، والحارسُ أقصى ما تملكُه الشجرةُ من برهان.
2. **لم أرَ قسمَ الدروسِ مرسومًا.** هذه جولةُ دمجٍ وأرقام: لم أشغّلِ التطبيقَ ولم ألتقطْ شاشة. ما يخصُّ الشاشةَ مبرهَنٌ في تقريرِ ٢٤-ب وبحارسِ `lessonssearch` (`EXIT=0` في هذه التشغيلة)، لا بعين. **العلّة:** خارجَ نطاقِ هذا الأمر.
3. **لم أنادِ `/api/lessons-search` حيًّا** ولا وقعَ نداءُ شبكةٍ واحدٌ في هذه الجلسة. **العلّة:** لا شأنَ لهذه الجولةِ بالخدمة.
4. **`WARN` الوحيدُ في recon** (`LONGEST_CARD_CHARS = 3405 > 3401`) لم أفحصْ سببَه ولم أُصلحْه؛ أثبتُّه كما طُبِع. **العلّة:** §٣ يأمرُ بطبعِه لا بإصلاحِه، و`api/report.js` خارجَ حدودِ §٤.
5. **لم أقِسْ حجمَ `app.js` المنقولَ على الشبكة.** نثرُ `sw.js` يصرّحُ أنّ أرقامَ النقلِ تعتمدُ على مُرمِّزِ الـCDN ولا تفحصُها الشجرة، والبوّابةُ تعدُّها من الأربعةِ «المُعلَنةِ غيرِ القابلةِ للفحص». فالمقيسُ حجمُ القرصِ وحدَه.
6. **لم أُشغِّلِ الطقمَ إلّا مرّةً واحدةً** بعدَ `01f4d8f`. لا إعادةَ تشغيلٍ ولا متوسّطَ تشغيلات، فبوّاباتٌ معروفةٌ بالتذبذبِ (`lockpackage` بملحِها العشوائيّ، و`questux` وما يعتمدُ على Chrome) لم تُقَسْ إلّا في تلكَ الواحدة، وقد خرجَتْ كلُّها بـ`EXIT=0`.
7. **لم أتحقّقْ من الشجراتِ الأخرى** (`worktrees` المستودعِ نفسِه). عملتُ في الشجرةِ الأمِّ وحدَها كما يأمرُ §١، ولم أقِسْ ما إذا كانت شجرةٌ أخرى تحملُ `sw.js` قديمًا في نسختِها العاملة. **العلّة:** خارجَ نطاقِ الأمر، ولا يؤثّرُ في `main`.
8. **الدَّينانِ اللذانِ رُفِعا في تقريرِ ٢٤-ب لم يُقضَ منهما شيءٌ هنا**، وهما خارجَ حدودِ §٤: تعليقُ `app.jsx:8661` ما زالَ يقولُ *«this app has no lessons section»* وقد صارَ غيرَ صحيح؛ و`ezLangRelabel` ما زالَ يعيدُ بناءَ `EZIST_SUB` بلا `prayer` و`library`. **العلّة:** `app.jsx` ممنوعٌ صراحةً في §٤ من هذا الأمر. **يبقيانِ مرفوعَينِ للمالك.**
9. **ختمُ هذا التقريرِ مقطوعٌ على بايتاتِ `LF`.** لا رصدَ لـ`*.md` في `.gitattributes` (وهو خارجَ §٤ على كلِّ حال)، فسحبٌ على آلةٍ بـ`core.autocrlf=true` يُنزِلُ هذا الملفَّ `CRLF` فتختلفُ البصمة. **لم أقِسْ** ذلك السحب.

---

## ٨ · خلاصةٌ في سطرين

الفرعُ دُمِجَ في `main` بـ`--no-ff` وبصفرِ تعارض (`a68e4b4`)، ثمّ رُدَّتِ المواضعُ الخمسةُ التي يثبَّتُ فيها حجمُ `app.js` — الثابتُ والنثرُ واسمُ المخزنِ ومرآتُه والختم — ومعها **سطرُ السجلِّ الذي عجزَتْ جولةُ ٢٤-أ عن كتابتِه**، في إيداعٍ واحدٍ (`01f4d8f`) وبالترتيبِ الذي يجعلُ الختمَ آخرَها. والبوّاباتُ الأربعُ خضراء: `92/92 EXIT=0`، و`bankintegrity` `76/0` بعدَ أن كانت `74/2`، و`FAIL=0` في recon، وشجرةٌ نظيفة. لا دفعَ ولا نشر.

---

**تعريفُ الختم:** `REPORT_SHA8` هو `sha256[0:8]` للحمولة، والحمولةُ هي بايتاتُ هذا الملفِّ **إلى ما قبلَ سطرِ `---` الذي يفتحُ كتلةَ الختمِ هذه** — أي التقريرُ كلُّه منتهيًا بآخرِ سطرٍ من §٨، بمحرفِ سطرٍ واحدٍ في آخرِه، وبترميزِ `UTF-8` وبنهاياتِ أسطرِ `LF`. وطولُها مطبوعٌ في `REPORT_PAYLOAD_BYTES` أدناه، فيمكنُ إعادةُ القياسِ حرفيًّا.

REPORT_PAYLOAD_BYTES=23522
REPORT_SHA8=cc7af568
