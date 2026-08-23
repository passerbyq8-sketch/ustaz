# تقريرُ دمجِ ٢٤-أ — بطاقةُ الدرسِ إلى `main`

**التاريخ:** ٢٣ أغسطس ٢٠٢٦ · **الشجرة:** `C:\Users\passe\projects\ustaz` (الشجرةُ الأمُّ، وهي وحدَها تملكُ `main`)
**كلُّ رقمٍ هنا مقيسٌ في هذه الجلسة**، ومخرجُ كلِّ خطوةٍ مطبوعٌ. وما لم يُقَسْ فله §٧.
**لا دفعَ ولا نشر:** `origin/main` بعدَ العملِ ما زالَ `f626ed18…` — مقيسٌ في §٦.

---

## ٠ · بوّابةُ الدخول — كما قِستُها

```
--- remotes ---
origin  https://github.com/passerbyq8-sketch/ustaz.git (fetch)
origin  https://github.com/passerbyq8-sketch/ustaz.git (push)
EXIT=0
--- origin/main ---
f626ed18d2c45b6c1f4cb004bfd15dc57bfeca84
EXIT=0
--- main ---
f626ed18d2c45b6c1f4cb004bfd15dc57bfeca84
EXIT=0
--- feat ---
14cbe332fefbbd9b405860f65840f6c1e580adb6
EXIT=0
--- is-ancestor f626ed18 -> feat/lesson-card-24a ---
EXIT=0
--- status ---
EXIT=0
```

| الشيء | المطلوبُ في الأمر | ما قِستُه | الحكم |
|---|---|---|---|
| `git rev-parse origin/main` | `f626ed18d2c45b6c1f4cb004bfd15dc57bfeca84` | `f626ed18d2c45b6c1f4cb004bfd15dc57bfeca84` | مطابق ⟹ **لا `BASE_MOVED`** |
| `git rev-parse feat/lesson-card-24a` | `d44620b…` | `14cbe332fefbbd9b405860f65840f6c1e580adb6` | **مختلف — وهو متوقَّعٌ، انظرْ أدناه** |
| `merge-base --is-ancestor f626ed18… feat/…` | خروجٌ `0` | `EXIT=0` | مطابق |
| `git status --porcelain` | صفرُ سطر | صفرُ سطر | مطابق |

**عن الرأسِ المختلف.** رأسُ الفرعِ ليسَ `d44620b` بل `14cbe33`، و`d44620b` تحتَه. وهذا **بالضبطُ ما يستبقُه §٦ من الأمر**: «رأسُ الدمجِ يُتحقَّقُ بـ`merge-base --is-ancestor` لا بمساواةِ الرأس — إيداعُ التقريرِ يعلوه دائمًا». قِستُ النسبَ صراحةً بدلَ أن أفترضَه:

```
git merge-base --is-ancestor d44620b feat/lesson-card-24a
d44620b_is_ancestor_EXIT=0
git rev-parse d44620b
d44620bc58c0b08707fe5be8db75c41f858af98c

git log --oneline f626ed18..feat/lesson-card-24a
14cbe33 docs: report the lesson-card round (item 24-a)
d44620b feat: related-lessons card under a settled reply (item 24-a)
```

فالفرعُ إيداعانِ: إيداعُ الرقعةِ `d44620b` وفوقَه إيداعُ تقريرِ ٢٤-أ `14cbe33`. **وشرطُ التوقّفِ الوحيدُ في §٠ هو تحرّكُ `origin/main`، ولم يتحرّكْ.** فمضيتُ.

---

## ١ · الدمج — **صفرُ تعارض**

```
git checkout main
Switched to branch 'main'
Your branch is up to date with 'origin/main'.
CHECKOUT_EXIT=0

git merge --no-ff feat/lesson-card-24a
Merge made by the 'ort' strategy.
 EZIK-CC-LESSON-CARD-24A-REPORT-2026-08-23.md | 302 +++++++++++++++++++++++++++
 app.js                                       |  79 ++++++-
 app.jsx                                      | 160 +++++++++++++-
 guards/lessons-search-guard.cjs              | 195 +++++++++++++++--
 4 files changed, 708 insertions(+), 28 deletions(-)
 create mode 100644 EZIK-CC-LESSON-CARD-24A-REPORT-2026-08-23.md
MERGE_EXIT=0

git diff --name-only --diff-filter=U
UNMERGED_EXIT=0
```

| الشيء | القيمةُ المقيسة |
|---|---|
| **عددُ التعارضات** | **صفر** — `git diff --name-only --diff-filter=U` ⟹ صفرُ سطر |
| **الملفّاتُ المتعارضة** | لا شيء |
| **رأسُ الدمج** | `db3c4a4b4d6e30d0c63caae934a991560f072f65` |
| **أبواه** | `f626ed1` (رأسُ `main` السابق) و`14cbe33` (رأسُ الفرع) — مقيسٌ بـ`git log -1 --format=%p` |
| الملفّاتُ الداخلة | أربعة: التقريرُ الجديدُ و`app.js` و`app.jsx` و`guards/lessons-search-guard.cjs` |

صفرُ التعارضِ متوقَّعٌ ومُبرهَنٌ لا مُخمَّن: الفرعُ مقطوعٌ من `f626ed18` نفسِه، والدمجُ استعملَ استراتيجيّةَ `ort` وأنهى بـ`EXIT=0` بلا مسارٍ واحدٍ غيرِ مدموج.

---

## ٢ · إعادةُ القطع — إيداعٌ واحدٌ يحملُ الخمسةَ

نُفِّذَتْ بالترتيبِ المأمورِ به لا غيرِه، لأنّ ختمَ `sw.js` يُحسَبُ بعدَ آخرِ حرفٍ يتغيّرُ فيه.

### ٢-١ جدولُ القيمِ الخمسِ — قبلَ وبعدُ

| # | الموضع | قبل | بعد | كيفَ اشتُقَّتِ القيمةُ الجديدة |
|---|---|---|---|---|
| ١ | `sw.js:112` — `const CORE_BYTES` | `1781243` | `1789173` | `node tools/core-bytes.cjs --write` — الأداةُ تقرأُ مصفوفةَ `CORE` من `sw.js` نفسِه وتجمعُ الملفّاتِ العشرةَ على القرص |
| ٢ | `sw.js:96` — نثرُ جدولِ `CORE` | `app.js 947845` | `app.js 955775` | `fs.statSync('app.js').size` **من القرصِ**، لا نقلًا من الأمر |
| ٣أ | `sw.js:44` — `const CACHE` | `'ezik-v19'` | `'ezik-v20'` | الرقمُ الحاليُّ مقروءٌ من الملفِّ ومرفوعٌ واحدًا |
| ٣ب | `quest-bank-integrity-guard.cjs:182` — `const SW_CACHE` | `'ezik-v19'` | `'ezik-v20'` | نظيرُه، في الإيداعِ نفسِه |
| ٤ | `quest-bank-integrity-guard.cjs:1268` — مرآةُ `SW_PROSE` | `{ n: 947845, of: 'app.js' }` | `{ n: 955775, of: 'app.js' }` | القيمةُ المقيسةُ نفسُها من القرص |
| ٥ | `quest-bank-integrity-guard.cjs:158` — `SEALED['sw.js']` | `2eb610f03989f84b1dba61ecdc64c9ef711f04b08fbacad3e56b37000ffb4ff1` | `b21c1c8fbc90939692fa4c48bd995d0b6e842b1f6aabbe61b2c73038269f3b87` | `sha256` لـ`sw.js` **بعدَ استقرارِه نهائيًّا**، مقطوعٌ على شجرةٍ مقيسةٍ عندَ `CR = 0` |

والفرقُ كلُّه في الملفّينِ **ستّةُ أسطرٍ لا سابعَ**، مقيسٌ بـ`git diff -U0`:

```
-  'sw.js': '2eb610f03989f84b1dba61ecdc64c9ef711f04b08fbacad3e56b37000ffb4ff1',
+  'sw.js': 'b21c1c8fbc90939692fa4c48bd995d0b6e842b1f6aabbe61b2c73038269f3b87',
-const SW_CACHE = 'ezik-v19';
+const SW_CACHE = 'ezik-v20';
-      { n: 947845, of: 'app.js' },
+      { n: 955775, of: 'app.js' },
-const CACHE = 'ezik-v19';
+const CACHE = 'ezik-v20';
-//   /  (index.html) 120617 + app.js 947845 + icon-watermark.png 368386
+//   /  (index.html) 120617 + app.js 955775 + icon-watermark.png 368386
-const CORE_BYTES = 1781243;
+const CORE_BYTES = 1789173;
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
/app.js                   app.js                        955775
/vendor/react.umd.js      vendor/react.umd.js            10751
/vendor/react-dom.umd.js  vendor/react-dom.umd.js       131835
--------------------------------------------------------------
TOTAL                                                  1789173

declared in sw.js:  1781243
measured on disk:   1789173
WROTE  CORE_BYTES  1781243 -> 1789173
CORE_BYTES_WRITE_EXIT=0
```

الفرقُ `1789173 − 1781243 = 7930` بايتة — وهو **بعينِه** نموُّ `app.js` (`955775 − 947845 = 7930`) الذي أحدثَه البندُ ٢٤-أ. فالحمرةُ التي فتحَتْ هذه الجولةَ مفسَّرةٌ بالكاملِ بملفٍّ واحدٍ، ولا بقيّةَ فيها.

### ٢-٣ `sw.js` بايتاتُه قبلَ وبعدُ — **لم تتغيّرْ، وهذا مقيسٌ لا مفترَض**

| الملفّ | بايتاتٌ قبل | بايتاتٌ بعد | الفرق |
|---|---|---|---|
| `sw.js` | `42994` | `42994` | `0` |
| `quest-bank-integrity-guard.cjs` | `112962` | `112962` | `0` |

«قبل» مقيسٌ على `db3c4a4` (بعدَ الدمجِ وقبلَ أوّلِ تحرير) بـ`git show db3c4a4:<file> | wc -c`، و«بعد» على القرصِ بـ`wc -c`.

**والأمرُ يطلبُ ذكرَ أثرِ رفعةِ الاسم**: رفعةُ اسمٍ **بطولٍ مختلفٍ** كانت ستغيّرُ الحجمَ — لكنّ الرفعةَ هنا `ezik-v19 ⟶ ezik-v20`، وكلاهما ثمانيةُ محارف. وكذلك الباقي: `1781243 ⟶ 1789173` سبعةُ أرقامٍ لكليهما، و`947845 ⟶ 955775` ستّةٌ لكليهما، والختمُ ٦٤ محرفًا ستّةَ عشريًّا لكليهما. فالبدائلُ الستُّ كلُّها **متساويةُ الطول**، ولذلك بقيَ الحجمانِ كما كانا. ولو رُفِعَ الاسمُ إلى `ezik-v100` مثلًا لزادَ كلُّ ملفٍّ بايتةً واحدةً، ولوجبَ قطعُ الختمِ بعدَ ذلك لا قبلَه — وهو الترتيبُ المتَّبَعُ هنا على كلِّ حال.

### ٢-٤ ما قِستُه حولَ الرفعةِ والختم

- **`ezik-mushaf-pages-v1` لم يُمَسَّ**، كما يأمرُ §٢/٣. مقيسٌ بعدَ الرفعة: `sw.js:506` و`quest-bank-integrity-guard.cjs:219` ما زالا يحملانِه، والبوّابةُ تؤكِّدُه بسطرين — `PASS a version bump sweeps the superseded store and LEAVES "ezik-mushaf-pages-v1" intact` و`PASS the page store still carries its own unversioned name (ezik-mushaf-pages-v1)`.
- **الاسمُ القديمُ في الشجرة**: الأمرُ يطلبُ قياسَ أنّه «صفرُ مواضع». المقيسُ بـ`git grep -n "ezik-v19"` بعدَ الرفعة: **صفرٌ في الكود**، وثلاثةُ مواضعَ باقيةٍ في تقريرٍ تاريخيٍّ واحدٍ هو `EZIK-LIB-UI-REMOVE-REPORT-2026-08-22.md` (السطور ٢٧١ و٣٤٧ و٣٦٤)، وهي تسجّلُ الرفعةَ السابقةَ `ezik-v18 ⟶ ezik-v19`. **وهذا هو العرفُ القائمُ لا استثناءٌ أخترعُه**: قِستُ أنّ `ezik-v18` نفسَه ما زالَ في تقريرين (`EZIK-LIB-UI-REMOVE-REPORT-2026-08-22.md` بخمسةِ مواضعَ و`EZIK-MERGE-27-REPORT-2026-08-22.md` بستّة). والتقاريرُ التاريخيّةُ خارجَ حدودِ §٤ على كلِّ حال. فالصياغةُ الدقيقةُ: **صفرٌ في كلِّ موضعٍ يقرؤُه برنامجٌ أو حارس، وثلاثةٌ في سجلٍّ لا يُقرَأُ إلّا بعينٍ.**
- **الختمُ يسكنُ الحارسَ لا الملفَّ الذهبيّ** — أعدتُ قياسَه ولم أنقلْه: `grep -c "sw.js" quest-data/bank-integrity-golden.json` ⟹ `0` (خروجٌ `1`، أي لا مطابقة). فـ`HASH_IN_GUARD=1 · HASH_IN_GOLDEN=0` كما ينصُّ الأمر. **ولم يُعَدْ توليدُ الملفِّ الذهبيِّ جملةً** — لم يُمَسَّ بحرفٍ، وهو ليس في قائمةِ التغيير.
- **`CR = 0` قبلَ قطعِ الختم**: الحارسُ نفسُه ينبِّهُ أنّ ختمَ `sw.js` مقطوعٌ على بايتاتِ `LF` وأنّه لا يُعادُ قطعُه إلّا من شجرةٍ مقيسةٍ عندَ `CR = 0`. فقِستُ قبلَ القطع: `sw.js bytes = 42994 · CR = 0`، وجعلتُ السكربتَ يرفضُ القطعَ لو خالفَ. ولم يخالفْ.

### ٢-٥ الإيداع

```
git add sw.js quest-bank-integrity-guard.cjs
ADD_EXIT=0
COMMIT_EXIT=0
bf544b9 chore: re-cut the four app.js pins and the sw.js seal (merge 24-a)
git status --porcelain  ⟹  صفرُ سطر
```

**إيداعٌ واحدٌ يحملُ الخمسةَ**، بأسماءٍ صريحةٍ لا `git add .`.

---

## ٣ · البوّاباتُ الأربع — على شجرةٍ نظيفةٍ بعدَ الإيداع

الأربعُ شُغِّلَتْ كلُّها **بعدَ** `bf544b9` وعلى شجرةٍ صفرِ سطر، عملًا بالقاعدةِ المقيسةِ في §٣ من الأمر.

### ١) `node tools/build-app.cjs --check` ⟹ **`OK`**

```
built     955775 bytes  0acf444308f5ea793f478152069ccc5586b5c9c0bd5f242f6d0e68d937e1957d
on disk   955775 bytes  0acf444308f5ea793f478152069ccc5586b5c9c0bd5f242f6d0e68d937e1957d
OK: app.js is exactly what this source builds
BUILD_CHECK_EXIT=0
```

### ٢) `node tools/run-gates.cjs` ⟹ **`92/92 EXIT=0`**

```
=== SUITE: 92/92 EXIT=0 ===
recon:    SUMMARY   PASS=184   WARN=1   FAIL=0
tree after: 0 dirty path(s)
evidence: C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-08-23T09-31-12-621Z-24532
GATES_EXIT=0
```

لا سطرَ `FAILING`. وهذه هي الحمرةُ الوحيدةُ التي أوقفَتْ جولةَ ٢٤-أ عندَ `91/92`، وقد أُغلِقَتْ.

**و`bankintegrity` كاملةً — وهي سببُ هذه الجولة:**

```
PASS  76 checks passed, 0 failed.
```

كانت في جولةِ ٢٤-أ `74 checks passed, 2 failed`. والسطورُ التي تخصُّ الخمسةَ، من سجلِّها:

```
-- B10 sealed files (unconditional: no git, no skip) --
  sealed files hashed: 13/13
  PASS all 13 sealed files are byte-for-byte unchanged

-- B11 service worker: data files must revalidate (item 80) --
  PASS service worker opens cache "ezik-v20"

-- B12 service worker: storage quota management (item 91-A) --
  PASS the eviction never touches the current store "ezik-v20"
  PASS a full disk evicts the stale store "ezik-v6" first
  PASS SW_CORE is still the list sw.js precaches (10 entries, read from the worker)
  PASS CORE_BYTES (1789173) equals the 1789173 bytes CORE weighs on disk, exactly
  PASS every size sw.js states in prose is true of the disk (17 claims)
  PASS no unregistered number of 500 or more survives in sw.js prose (4 declared uncheckable, each with its reason)

-- B15 service worker: the printed mushaf pages are capped (item 33) --
  PASS a version bump sweeps the superseded store and LEAVES "ezik-mushaf-pages-v1" intact

-- B16 offline package: the policy the page is answered with (A-4) --
  PASS the page store still carries its own unversioned name (ezik-mushaf-pages-v1)
```

كلُّ واحدةٍ من الخمسِ يقابلُها تأكيدٌ أخضرُ يسمّيها بقيمتِها الجديدة: الختمُ في `B10` (١٣/١٣ بايتًا ببايت)، والاسمُ في `B11` و`B12`، والثابتُ في `B12` («يساوي بالضبط»)، والنثرُ في `B12` («سبعَ عشرةَ دعوى، كلُّها صادقةٌ على القرص»). ومرآةُ `SW_PROSE` هي أداةُ الدعاوى السبعَ عشرةَ نفسِها.

### ٣) `node recon-audit.cjs` ⟹ **`FAIL=0`**

```
==================================================================
 SUMMARY   PASS=184   WARN=1   FAIL=0
 No structural FAILs. WARNs are eyeball items, not necessarily bugs.
==================================================================
RECON_EXIT=0
```

و`WARN` **واحدٌ** هو المعروفُ نفسُه، مطبوعٌ ولم يُصلَحْ كما يأمرُ §٣:

```
[WARN] LONGEST_CARD_CHARS = 3405 > longest card 3401 -> cap oversized/stale (re-derive in api/report.js)
```

### ٤) `git status --porcelain` ⟹ **صفرُ سطر**

```
git status --porcelain
STATUS_EXIT=0
--- end ---
```

ثمّ صارَ هذا التقريرُ وحدَه غيرَ متتبَّعٍ قبلَ إيداعِه.

---

## ٤ · الشجرةُ بعدَ العمل

| الملفّ | بايتات | `sha256[0:8]` |
|---|---|---|
| `sw.js` | `42994` | `b21c1c8f` |
| `quest-bank-integrity-guard.cjs` | `112962` | `f761bb88` |
| `app.js` | `955775` | `0acf4443` |
| `app.jsx` | `1063427` | `d69f3e2f` |
| `index.html` | `120617` | `0933a9cb` |

`index.html` و`app.jsx` و`app.js` لم تُمَسَّ في هذه الجولةِ ألبتّة — بصماتُها هي بصماتُ نهايةِ جولةِ ٢٤-أ نفسُها، و`index.html` هي بصمةُ `f626ed18` منذُ البداية.

---

## ٥ · الإيداعات

| البصمةُ القصيرة | البصمةُ الكاملة | ما فيه |
|---|---|---|
| `db3c4a4` | `db3c4a4b4d6e30d0c63caae934a991560f072f65` | `merge: lesson card in the interface (item 24-a)` — دمجٌ `--no-ff`، أبواه `f626ed1` و`14cbe33` |
| `bf544b9` | `bf544b94a6ef1d710ab009046597757a7537381d` | `chore: re-cut the four app.js pins and the sw.js seal (merge 24-a)` — `sw.js` · `quest-bank-integrity-guard.cjs` |

ورأسُ `main` الآنَ `bf544b94a6ef1d710ab009046597757a7537381d`. وقِستُ أنّ `d44620b` — إيداعُ الرقعةِ نفسِه — صارَ سلفًا لـ`main`: `git merge-base --is-ancestor d44620b main` ⟹ `EXIT=0`.

---

## ٦ · لا دفعَ ولا نشر

```
git rev-parse origin/main
f626ed18d2c45b6c1f4cb004bfd15dc57bfeca84
```

`origin/main` بعدَ كلِّ العملِ ما زالَ عندَ نقطةِ البداية، فـ**لم يقعْ دفعٌ**. ولم يُشغَّلْ أمرُ نشرٍ ولا `vercel` من أيِّ نوع. `main` المحلّيُّ يسبقُ `origin/main` بثلاثةِ إيداعاتٍ في انتظارِ أمرِ المالكِ المستقلّ.

---

## ٧ · ما لم أقِسْه — بعلّتِه

1. **لم أفتحْ متصفّحًا ولم أرَ الرفعةَ تعملُ على جهازِ قارئ.** أنّ `ezik-v20` يُخلي مخزنَ `ezik-v19` ويُبقي `ezik-mushaf-pages-v1` **مقيسٌ بحارسِ `bankintegrity` وحدَه** — الذي يشغّلُ العاملَ في `vm` بـ`caches` و`fetch` مُدجَّنَين — لا بمتصفّحٍ حقيقيٍّ ولا بجهاز. **العلّة:** لا متصفّحَ في هذا المسار، والحارسُ هو أقصى ما تملكُه الشجرةُ من برهان.
2. **لم أقِسْ بطاقةَ الدرسِ مرسومةً.** هذه جولةُ دمجٍ وأرقامٍ؛ لم أشغّلِ التطبيقَ ولم ألتقطْ شاشةً. ما يخصُّ الواجهةَ مبرهَنٌ في تقريرِ ٢٤-أ وبحارسِ `lessonssearch` (`EXIT=0` في هذه التشغيلة)، لا بعينٍ. **العلّة:** خارجَ نطاقِ هذا الأمر.
3. **لم أضفْ سطرًا إلى سجلِّ إعادةِ قطعِ ختمِ `sw.js` داخلَ الحارس.** الملفُّ يحملُ فوقَ الختمِ تعليقًا بعنوان *«Re-cut history for this one file, newest first»* وفيه ستُّ مُدخَلاتٍ تاريخيّة، وعرفُ الملفِّ أن يُضافَ مُدخَلٌ جديدٌ مع كلِّ قطع. **لم أفعلْ عمدًا**: §٤ من الأمرِ يحصرُ ما يُمَسُّ في الحارسِ بـ«القيمُ الأربعُ والختمُ فقط»، والتعليقُ ليسَ واحدًا منهما. **فالنتيجةُ المقيسةُ:** الختمُ تحرّكَ وسجلُّه لم يذكرْ لماذا، وأوّلُ قارئٍ يبحثُ عن سببِ `b21c1c8f` لن يجدَه في الحارسِ بل في هذا التقريرِ وفي رسالةِ `bf544b9`. **أرفعُها للمالكِ**: إن أُريدَ المُدخَلُ فهو سطرُ تعليقٍ واحدٌ وإعادةُ قطعٍ للختمِ بعدَه — لأنّ الحارسَ لا يختمُ نفسَه، فالتعليقُ لا يُبطِلُ ختمَ `sw.js`.
4. **`WARN` الوحيدُ في recon** (`LONGEST_CARD_CHARS = 3405 > 3401`) لم أفحصْ سببَه ولم أُصلحْه. **العلّة:** §٣ يأمرُ بطبعِه لا بإصلاحِه، و`api/report.js` خارجَ حدودِ §٤.
5. **لم أقِسْ حجمَ `app.js` المنقولَ على الشبكة** (`transfer`). نثرُ `sw.js` يصرّحُ أنّ أرقامَ النقلِ تعتمدُ على مُرمِّزِ الـCDN ولا تفحصُها الشجرة، والبوّابةُ تعدُّها من الأربعةِ «المُعلَنةِ غيرِ القابلةِ للفحص». فالذي قِستُه هو حجمُ القرصِ وحدَه.
6. **لم أُشغِّلِ الطقمَ إلّا مرّةً واحدةً** بعدَ `bf544b9`. لا إعادةَ تشغيلٍ ولا متوسّطَ تشغيلاتٍ، فما يخصُّ بوّاباتٍ معروفةً بالتذبذبِ (مثلَ `lockpackage` بملحِها العشوائيِّ، أو `questux` وما يعتمدُ على Chrome) **لم يُقَسْ إلّا في تلكَ التشغيلةِ الواحدة**، وقد خرجَتْ كلُّها بـ`EXIT=0`.
7. **لم أتحقّقْ من الشجراتِ الأخرى** (`worktrees` المستودعِ نفسِه). عملتُ في الشجرةِ الأمِّ وحدَها كما يأمرُ §١، ولم أقِسْ ما إذا كانت شجرةٌ أخرى تحملُ `sw.js` قديمًا في نسختِها العاملة. **العلّة:** خارجَ نطاقِ الأمر، ولا يؤثّرُ في `main`.

---

## ٨ · خلاصةٌ في سطرين

الفرعُ دُمِجَ في `main` بـ`--no-ff` وبصفرِ تعارض (`db3c4a4`)، ثمّ رُدَّتِ المواضعُ الخمسةُ التي يثبَّتُ فيها حجمُ `app.js` — الثابتُ والنثرُ واسمُ المخزنِ ومرآتُه والختم — في إيداعٍ واحدٍ (`bf544b9`) وبالترتيبِ الذي يجعلُ الختمَ آخرَها. والبوّاباتُ الأربعُ خضراء: `92/92 EXIT=0` و`bankintegrity` `76/0` بعدَ أن كانت `74/2`، و`FAIL=0` في recon، وشجرةٌ نظيفة. لا دفعَ ولا نشر.

---

**تعريفُ الختم:** `REPORT_SHA8` هو `sha256[0:8]` للحمولة، والحمولةُ هي بايتاتُ هذا الملفِّ **إلى ما قبلَ سطرِ `---` الذي يفتحُ كتلةَ الختمِ هذه** — أي التقريرُ كلُّه منتهيًا بآخرِ سطرٍ من §٨، بمحرفِ سطرٍ واحدٍ في آخرِه، وبترميزِ `UTF-8` وبنهاياتِ أسطرِ `LF`. وطولُها مطبوعٌ في `REPORT_PAYLOAD_BYTES` أدناه، فيمكنُ إعادةُ القياسِ حرفيًّا.

REPORT_PAYLOAD_BYTES=21985
REPORT_SHA8=fe8c632d
