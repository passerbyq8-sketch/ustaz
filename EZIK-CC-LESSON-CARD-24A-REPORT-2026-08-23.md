# تقريرُ ٢٤-أ — بطاقةُ الدرسِ في الواجهة

**التاريخ:** ٢٣ أغسطس ٢٠٢٦ · **الشجرة:** `C:\Users\passe\projects\ustaz` · **الفرع:** `feat/lesson-card-24a` من `f626ed18`
**كلُّ رقمٍ هنا مقيسٌ في هذه الجلسة.** وما لم يُقَسْ فله قسمٌ في آخرِ التقريرِ يُسمّيه.

---

## ٠ · بوّابةُ الدخول — كما قِستُها، لا كما نُقِلَتْ

الأمرُ الواحد:

```
git rev-parse HEAD
f626ed18d2c45b6c1f4cb004bfd15dc57bfeca84
--- status ---
--- end status ---
app.jsx bytes=1054535 sha8=6f3db4e3
app.js bytes=947845 sha8=9a607e10
index.html bytes=120617 sha8=0933a9cb
```

| الشيء | ما يطلبُه الأمر | ما قِستُه | الحكم |
|---|---|---|---|
| `git rev-parse HEAD` | `f626ed18d2c45b6c1f4cb004bfd15dc57bfeca84` | `f626ed18d2c45b6c1f4cb004bfd15dc57bfeca84` | مطابق |
| `git status --porcelain` | صفرُ سطر | صفرُ سطر | مطابق |
| `app.jsx` | `1,054,535` · `6f3db4e3` | `1054535` · `6f3db4e3` | مطابق |
| `app.js` | `947,845` · `9a607e10` | `947845` · `9a607e10` | مطابق |
| `index.html` | `120,617` · `0933a9cb` | `120617` · `0933a9cb` | مطابق |

الخمسةُ مطابقةٌ، فمضيتُ. البايتاتُ مقيسةٌ بـ`wc -c` والبصماتُ بـ`sha256sum` على البايتِ الخام.
`app.jsx` كلُّه `LF` — قِستُه: `crlf 0 · lf 16616` — فلا رقمَ هنا يزيدُ بسببِ نهاياتِ الأسطر.

---

## ١ · المخيط — مقيسٌ قبلَ أن أكتبَ حرفًا

**الدالّة:** `MessageBubble` — `React.memo(function MessageBubble({ … }))`.
**قِستُ موضعَها على `f626ed18` نفسِه** بـ`git show f626ed18:app.jsx`:

```
10232:const MessageBubble = React.memo(function MessageBubble({ message, index, … })
10233:  const isUser = message.role === 'user';
10316:      <div className="ezc-ans" style={{ ...s.assistantBubble, … }}>
```

- `app.jsx:10232` — الدالّةُ التي ترسمُ الدور.
- `app.jsx:10233` — `isUser`؛ ودورُ المستخدمِ يخرجُ مبكّرًا، فما بعدَه هو فقاعةُ جوابِ المساعدِ وحدَها.
- `app.jsx:10316` — `.ezc-ans`، «ورقةُ القراءة»: متنُ الجواب. تحتَها في الدورِ نفسِه شريطُ الأفعالِ `.ezc-acts` ثمّ الاقتراحات.

**أينَ رُكِّبَتِ البطاقة:** في **ذيلِ الدورِ نفسِه** — آخرُ ابنٍ في حاوية دورِ المساعد، بعدَ كتلةِ الاقتراحات. بعدَ الرقعة:

```
10374:const MessageBubble = React.memo(function MessageBubble({ …, foldEpoch, lessonRows })
10458:      <div className="ezc-ans" …>
10537:      <EzikLessonCards rows={lessonRows} />
```

**عن المخيطِ الجاهز:** الأمرُ يذكرُ أنّ واجهةَ بحثِ المكتبةِ نُزِعَتْ (`EZIK-LIB-UI-REMOVE-REPORT-2026-08-22.md`). فتّشتُ فلم أجدْ مخيطًا صالحًا: `grep` عن `lib-search|libSearch|sourceResults|sourceCard` في `app.jsx` ⟹ **صفرُ نتيجة**. قائمةُ النتائجِ الوحيدةُ الباقيةُ في الملفِّ (`app.jsx:9091` وما بعدَه، `chatResults`) هي بحثُ **المحادثاتِ المحفوظة** في الدرج: ترسمُ `snippet` وتفتحُ محادثةً داخليّةً بـ`openSavedChat` — فليست مخيطًا لنتائجِ مصادرَ خارجيّةٍ ألبتّة. فبنيتُ الأصغرَ، كما يأمرُ البند ٣-٣.

---

## ٢ · ما بُنِيَ

### ٢-١ الكتلتان في `app.jsx`

| الكتلة | الموضعُ بعدَ الرقعة | ما فيها |
|---|---|---|
| كتلةُ الرسم | `app.jsx:10277-10372` | الثوابتُ الأربعة · `ezikLessonRows` (القائمةُ البيضاء) · `ezikFetchLessonRows` (النداء) · `EzikLessonCards` (البطاقة) |
| كتلةُ النداء | `app.jsx:6270-6299` | `lessonRows` حالةً · `lessonsAbortRef` · `lessonsSeqRef` · `resetLessons()` · `startLessonsSearch()` |

والمخيطُ ثلاثةُ مواضعَ: `resetLessons()` عندَ رأسِ `sendMessage` بجوارِ إجهاضِ البثّ، و`startLessonsSearch(text, lessonsSeq)` **آخرَ سطرٍ** بعدَ التزامِ الجواب، و`lessonRows={i === messages.length - 1 ? lessonRows : null}` في موضعِ رسمِ الفقاعة.

### ٢-٢ القائمةُ البيضاءُ — مكتوبةٌ بالاسم

`ezikLessonRows` تقرأُ **ثلاثَ خصائصَ لا رابعَ**: `hit.title` · `hit.scholar_id` · `hit.url`. قِستُ ذلك بجمعِ كلِّ `hit.<name>` في الكتلةِ بعدَ نزعِ التعليقات:

```
hit.* المقروءةُ في كتلةِ الرسم: ["title","url","scholar_id"]
```

والسبعةُ الباقيةُ من التسعةِ — `unit_id` · `tier` · `usage` · `citation_allowed` · `content_type` · `score` — **لا يُذكَرُ اسمُ واحدٍ منها في كودِ الكتلةِ ألبتّة**، ولا `snippet` ولا `excerpt` ولا `matn`. قِستُه: كلُّ واحدةٍ من التسعِ ⟹ `false`.
ولا `Object.keys` ولا `Object.entries` ولا `Object.values` ولا `for…in` ولا `JSON.stringify(hit`: كلُّها ⟹ `false`. فحقلُ نصٍّ يضيفُه الخادمُ غدًا **لا يبلغُ شاشةَ قارئٍ** إلّا أن يكتبَ إنسانٌ اسمَه في هذا الملف.

الرابطُ خارجيٌّ بـ`target="_blank"` و`rel="noopener noreferrer"`، و`citation_allowed=0` و`usage=search_only` ⟹ الرابطُ هو المنتهى: لا اقتباسَ ولا مقتطفَ ولا زرَّ نسخٍ ولا «النصُّ الأصليّ».

### ٢-٣ السلوك

| البند | كيفَ نُفِّذ |
|---|---|
| ٣-١/١ لا يحبسُ البثَّ ولا الرسم | `startLessonsSearch` آخرُ سطرٍ في `sendMessage`، **بعدَ** `markStreamedOpen` و`saveMessages` و`setIsLoading(false)` و`speakReply`، و**بلا `await`** — قِستُ: `await startLessonsSearch` في `app.jsx` ⟹ صفرُ نتيجة |
| ٣-١/٢ `q` نصُّ السؤالِ كما هو · أقلُّ من ٣ محارفَ ⟹ لا نداء | يُمرَّرُ `text` نفسُه؛ و`EZIK_LESSONS_MIN_Q = 3` تحرسُ الطريقَ في موضعين |
| ٣-١/٣ `AbortController` · مسحٌ فوريّ | `resetLessons()` ترفعُ الجيلَ وتُجهضُ المعلَّقَ وتُصفِّرُ البطاقةَ عندَ **رأسِ** كلِّ سؤال؛ ونتيجةٌ تهبطُ بعدَ سؤالٍ أحدثَ تُسقَطُ بـ`lessonsSeqRef.current !== seq` |
| ٣-١/٤ الفشلُ صامت | غيرُ `200` ⟹ `[]` · رميٌ في أيِّ جزءٍ ⟹ `[]` · `hits` غائبةٌ أو ليست مصفوفةً ⟹ `[]` · مهلةُ **٨٠٠٠ms** تُجهض ⟹ `[]`؛ و`[]` تُرجِعُ `null` من المكوّن — لا رسالةَ ولا هيكلَ ولا مؤشّرَ تحميلٍ ألبتّة (لا مؤشّرَ أصلًا: لا حالةَ «جارٍ» في هذا المسار) |
| ٣-١/٥ سقفُ ٣ | `EZIK_LESSONS_MAX = 3` داخلَ حلقةِ القائمةِ البيضاء؛ لا زرَّ «المزيد» |

المهلةُ ٨ ثوانٍ **دونَ** سقفِ الخادمِ للمنبعِ (`TIMEOUT_MS = 12000` في `api/lessons-search.js`) عمدًا: العميلُ ييأسُ أوّلًا.

### ٢-٤ التنسيقُ والاتّجاه

خمسةُ مفاتيحَ جديدةٍ في كائنِ `s` القائم، بالنمطِ السائدِ في الملفِّ ولا نظامَ جديد. كلُّ لونٍ **رمزٌ قائم**: `--tint` · `--line` · `--red` · `--muted` · `--answer-ink` · `--white` — فلا قيمةَ سماتٍ (theme) أُضيفَتْ ولا غُيِّرَتْ. و`direction: 'rtl'` مُصرَّحٌ في الصندوق، كما يفعلُ الملفُّ في كلِّ كتلةٍ تقرأُ من اليمين. والعنوانُ في المعجمِ لا نصًّا حرًّا: `'chat.lessons'` بالعربيّةِ «دروسٌ ذاتُ صلة» وبالإنجليزيّةِ `Related lessons`.

---

## ٣ · الحارس

### ٣-١ حالُه قبلَ التعديل — **كانَ يبرهنُ الغياب**، وهذا مقيسٌ لا مُستنتَج

قسمُه الخامسُ كانَ عنوانُه `// == 5. NO INTERFACE. ZERO MENTION IN index.html` ويطبعُ `=== 5. THIS ROUND HAS NO INTERFACE ===`، ويؤكِّدُ على `index.html` و`app.jsx` و`app.js` و`quest.html` أنّ أيًّا منها **لا يذكرُ** `lessons/search` ولا `lessons-search` ولا `lessons-source-card`.

ولم أكتفِ بقراءتِه: أخرجتُ نسخةَ `f626ed18` منه وشغّلتُها **على الشجرةِ بعدَ الرقعة**، ثمّ حذفتُها:

```
=== 5. THIS ROUND HAS NO INTERFACE ===
  PASS  index.html was actually read
  PASS  index.html does not mention lessons/search
  PASS  index.html does not mention lessons-search
  PASS  index.html does not mention lessons-source-card
  PASS  index.html does not mention the lessons service address
  PASS  app.jsx was actually read
  FAIL  app.jsx mentions none of the new names
        lessons-search,lessons-source-card
  PASS  app.js was actually read
  FAIL  app.js mentions none of the new names
        lessons-search,lessons-source-card
  PASS  quest.html was actually read
  PASS  quest.html mentions none of the new names
  PASS  no interface file was added to the service worker CORE either

=== 122/124 - FAIL ===
```

فالجوابُ: **نعم، كانَ يبرهنُ الغياب**، وسقطَ سقوطًا يخصُّ الملفّين اللذين وُصِلا، ولا شيءَ غيرَهما.

### ٣-٢ ما صارَ يبرهنُه

القسمُ الخامسُ وحدَه بُدِّل. الأقسامُ ١-٤ و٦ و٧ و«ب» و«ج» لم يُمَسَّ منها حرف، ومُسوخُها الثلاثةُ في مكانِها. والحارسُ لم يُنزَعْ ولم يُضعَفْ ولم يُضَفْ ملفُّ حارسٍ جديد — الروسترُ **٩٢** كما كان.

القسمُ الجديدُ يبرهنُ الغيابَ حيثُ بقيَ غيابٌ، والشكلَ حيثُ صارَ وصل:

- **يبقى الغياب** على `index.html` (الأسماءُ الثلاثةُ وعنوانُ الخدمة) و`quest.html` و`sw.js`. وزيادةً: `app.jsx` **لا يسمّي عنوانَ الخدمةِ** `lib.ezik.app/lessons` — الرمزُ هو البوّابةُ وهو في الخادمِ وحدَه.
- **مطلبُ الأمرِ الأوّل** (`/api/lessons-search` بـ`POST`): يُبرهَنُ بأربعِ تأكيداتٍ — الطريقُ · `method: 'POST'` · `JSON.stringify({ q:` · و**موضعُ نداءٍ واحدٌ لا غير** في `app.jsx` كلِّه.
- **مطلبُ الأمرِ الثاني** (الحقولُ الثلاثةُ حاضرةٌ و`snippet` وكلُّ حقلِ متنٍ غائبٌ من كتلةِ الرسم): يُبرهَنُ بـ**مساواةِ مجموعة**، لا ببحثٍ عن ثلاثةِ أسماء — `hit.*` المقروءةُ تساوي `scholar_id,title,url` بالضبط. فحقلٌ رابعٌ يسقُطُ هنا ولو بقيَتِ الثلاثةُ. ومعها قائمةُ تسعِ كلماتٍ ممنوعةٍ في الكتلة، وقائمةُ ستِّ صيغِ تعداد.
- **مطلبُ الأمرِ الثالث** (`AbortController` في مسارِ النداء): يُبرهَنُ بأربعِ تأكيداتٍ — إنشاءُ المتحكّمِ وتمريرُ إشارتِه إلى `fetch` · الإجهاضُ والمسحُ معًا · وقوعُ `resetLessons()` عندَ رأسِ الإرسالِ بجوارِ `abortRef.current.abort()` · وإسقاطُ الهبوطِ المتأخّرِ بالجيل.
- وزيادةً على الثلاثة: السقفُ ٣، والأرضيّةُ ٣ محارف، والمهلةُ ٨٠٠٠، وأربعةُ مساراتِ الصمت، وأنّ النداءَ يقعُ **بعدَ** `markStreamedOpen` وأنّه **بلا `await`**، وأنّ البطاقةَ تُسلَّمُ للفقاعةِ الأحدثِ وحدَها، وأنّ الحزمةَ المبنيّةَ `app.js` تحملُ العلاماتِ الأربعَ (فلا تمرُّ حزمةٌ بائتةٌ من حارسٍ موضوعُه الواجهة).
- **والمُسوخ**: أضفتُ مسخًا نصّيًّا للقائمةِ البيضاء — قارئٌ يأخذُ `snippet` — وأُبرهِنُ أنّه **تغييرٌ حقيقيٌّ لا لاغٍ**، وأنّ التأكيدين يعضّانِه، وأنّ الكتلةَ على القرصِ لم تتغيّرْ بعدَه.

قِستُ الحارسَ بعدَ التعديل:

```
=== 158/158 - PASS ===
```

القسمُ الخامسُ وحدَه: **٤٦ تأكيدًا، كلُّها PASS**.

---

## ٤ · البناء

```
node tools/build-app.cjs
source (LF-normalised)   1063427 bytes  (CR removed: 0)
runtime                  classic  (preset-react, sourceType=script)
wrote                    app.js  955775 bytes  in 806ms
sha256                   0acf444308f5ea793f478152069ccc5586b5c9c0bd5f242f6d0e68d937e1957d

node tools/build-app.cjs --check
built     955775 bytes  0acf444308f5ea793f478152069ccc5586b5c9c0bd5f242f6d0e68d937e1957d
on disk   955775 bytes  0acf444308f5ea793f478152069ccc5586b5c9c0bd5f242f6d0e68d937e1957d
OK: app.js is exactly what this source builds
```

`app.js` **مولَّدٌ بالأداةِ ولم يُحرَّرْ بيد**. و`index.html` **لم يُمَسَّ بحرف** — بصمتُه بعدَ العملِ `120617 · 0933a9cb`، وهي بصمةُ §٠ نفسُها.

### الملفّاتُ بعدَ العمل

| الملفّ | قبل | بعد | الفرق |
|---|---|---|---|
| `app.jsx` | `1054535` · `6f3db4e3` | `1063427` · `d69f3e2f` | `+8892` |
| `app.js` | `947845` · `9a607e10` | `955775` · `0acf4443` | `+7930` |
| `index.html` | `120617` · `0933a9cb` | `120617` · `0933a9cb` | `0` |
| `guards/lessons-search-guard.cjs` | `31608` | `42913` | `+11305` |

---

## ٥ · البوّاباتُ الأربع — حرفيًّا

### ١) البناءُ والتحقّق ⟹ **مرّ**

مطبوعٌ كاملًا في §٤ أعلاه: `OK: app.js is exactly what this source builds`.

### ٢) `node tools/run-gates.cjs` ⟹ **٩١/٩٢، لم يبلغْ ٩٢/٩٢**

```
=== SUITE: 91/92 EXIT=0 ===
recon:    SUMMARY   PASS=184   WARN=1   FAIL=0
tree after: 0 dirty path(s)
FAILING (1): bankintegrity=1
  bankintegrity  ->  C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-08-23T08-56-30-939Z-22152\gate-bankintegrity.log
evidence: C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-08-23T08-56-30-939Z-22152
```

الحمرةُ واحدةٌ: `bankintegrity`، وسببُها كاملًا من سجلِّها:

```
FAIL [B12] CORE_BYTES = 1781243 but CORE weighs 1789173 bytes on disk (+7930).
      The quota pre-check is measured against a number that stopped being true.
      Repair it with `node tools/core-bytes.cjs --write` and re-cut the sw.js
      digest in the SAME commit -- never by hand from the comment table.
FAIL [B14] sw.js prose says app.js is 947845 bytes; the disk says 955775 (+7930).
      A comment that states a size is what the next person re-cuts CORE_BYTES from,
      so it is wrong in exactly the way the constant used to be.
FAIL  74 checks passed, 2 failed.
```

**الحمرةُ تُنسَبُ إلى رقعتي، وهذا مقيسٌ لا مُخمَّن.** التأكيدانِ فرعانِ عن حقيقةٍ واحدة: `app.js` كبُرَ `+7930` بايتة. وحجمُه مثبَّتٌ في **ثلاثةِ مواضع**، قِستُها بالاسمِ والسطر:

| # | الموضع | القيمةُ المثبَّتة |
|---|---|---|
| ١ | `sw.js:112` — `const CORE_BYTES` | `1781243` |
| ٢ | `sw.js:96` — نثرُ جدولِ `CORE` | `app.js 947845` |
| ٣ | `quest-bank-integrity-guard.cjs:1268` — مرآةُ `SW_PROSE` | `{ n: 947845, of: 'app.js' }` |

وجمعُ `CORE` على القرصِ اليومَ (`node tools/core-bytes.cjs`) هو `1789173`. وبحسابٍ على القيمِ المقيسةِ نفسِها: `1789173 − 955775 + 947845 = 1781243` — وهو المُعلَنُ بالضبط. **فعلى `f626ed18` كانَ B12 أخضرَ، وكسرَتْه رقعتي.**

**ولم أُصلِحْها، وهذا قرارٌ لا سهو.** الإصلاحُ يقتضي تحريرَ `sw.js` و`quest-bank-integrity-guard.cjs`، وكلاهما **خارجَ** ما يُمَسُّ في §٥ من الأمر، والثاني يقعُ تحتَ خطِّ 🔴 «لا تنزعْ حارسًا … ولا تضفْ ملفَّ حارسٍ جديد» ومعه «لا يُمَسُّ … أيُّ حارسٍ آخر». وزيادةً على ذلك، نثرُ `sw.js:104-107` يحجزُ إعادةَ القطعِ لجولةِ الدمجِ وحدَها:

> *«It is re-derived by tools/core-bytes.cjs --write, and the MERGE ROUND is the only place that command may run -- item 112 owns it, and a screen that re-cuts it here would be re-cutting a number two other screens are also moving.»*

فمطلبُ §٦ (`92/92`) ومطلبُ §٥ (الحدود) **لا يجتمعانِ لفرعٍ يغيّرُ `app.js`** — وأيُّ تنفيذٍ لهذا الأمرِ يغيّرُه. عرضتُ الأمرينِ على المالكِ وكانَ القرارُ: **تُترَكُ الحمرةُ وتُكتَبُ كاملة**. وهذا موضعُها. (وسابقةُ البندِ ١٤٤ في `EZIK-CX-B-FIQH-INDEX-144-REPORT-2026-08-23.md` تركَتْ `bankintegrity` حمراءَ وكتبَتْها كذلك، وإن كانَ سببُها هناكَ انحرافًا سابقًا لا مُحدَثًا.)

وإصلاحُ الموضعينِ الأوّلينِ دونَ الثالثِ **يزيدُ الحمرةَ ولا ينقصُها**: مرآةُ الحارسِ تخالفُ حينئذٍ نثرَ `sw.js`، فتصيرُ حمرةُ B14 حمرتين.

الواحدُ والتسعونَ الباقيةُ خُضرٌ، ومنها `lessonssearch` و`babel` و`i18nui` و`chatux` و`attribution` و`markdown` و`a11y` و`themecoverage` و`guardhonesty` و`vacuousassert`.

### ٣) `node recon-audit.cjs` ⟹ **`FAIL=0`**

```
==================================================================
 SUMMARY   PASS=184   WARN=1   FAIL=0
 No structural FAILs. WARNs are eyeball items, not necessarily bugs.
==================================================================
```

و`WARN` **واحدٌ**، وهو كما هو ولا صلةَ له بهذه الجولة:

```
[WARN] LONGEST_CARD_CHARS = 3405 > longest card 3401 -> cap oversized/stale (re-derive in api/report.js)
```

### ٤) `git status --porcelain` بعدَ العمل

قبلَ الإيداعِ كانَ المطبوعُ ثلاثةَ أسطرٍ لا رابعَ:

```
 M app.js
 M app.jsx
 M guards/lessons-search-guard.cjs
```

وبعدَ الإيداعِ صفرُ سطر. ثمّ صارَ هذا التقريرُ وحدَه غيرَ متتبَّعٍ قبلَ إيداعِه.
و`git add` جرى **بأسماءَ صريحةٍ** — `git add app.jsx app.js guards/lessons-search-guard.cjs` — لا `git add .`.

---

## ٦ · الإيداعات

| البصمةُ القصيرة | ما فيه |
|---|---|
| `d44620b` | `feat: related-lessons card under a settled reply (item 24-a)` — `app.jsx` · `app.js` · `guards/lessons-search-guard.cjs` |

والفرعُ `feat/lesson-card-24a` مقطوعٌ من `f626ed18`.
**لا `git push`. لا دمجَ في `main`.** قِستُ: `git log --oneline -3` ⟹ `d44620b` فوقَ `f626ed1` فوقَ `4ff8f14`.

---

## ٧ · ما لم أقِسْه

يُسمّى ولا يُطوى:

1. **لم أنادِ `https://ezik.app/api/lessons-search` حيًّا في هذه الجلسة.** أرقامُ §٢ من الأمرِ — `200` بجسمِ `{hits:[…]}` بلا `ok`، و`405` على `GET`، و`2,938ms` باردًا و`1,220ms` دافئًا، والحقولُ التسعةُ، والعيّنةُ `tier=C · usage=search_only · citation_allowed=0 · content_type=fatwa` — **مأخوذةٌ من الأمرِ كما هي**. ما قِستُه أنا هو ما يفعلُه `api/lessons-search.js` في الشجرةِ: `shapeSearchResponse` يمرّرُ `hits` وحدَها من الغلاف، والتسعةَ من العشرةِ في كلِّ إصابة.
2. **لم أفتحِ التطبيقَ في متصفّحٍ ولم أرَ البطاقةَ مرسومةً.** لا لقطةَ شاشةٍ ولا تشغيلَ حيًّا: كلُّ ما أعرفُه عن الرسمِ مقروءٌ من المصدرِ ومن الحارس. فارتفاعُ الصندوقِ وتموضعُه وتباينُ ألوانِه على شاشةٍ حقيقيّةٍ — **لم يُقَسْ**.
3. **لم أقِسْ زمنًا.** «لا يحبسُ البثَّ ولا الرسم» مُبرهَنٌ **بنيويًّا** (آخرُ سطرٍ، بعدَ الالتزام، بلا `await` — والحارسُ يؤكِّدُ الثلاثةَ)، لا بقياسِ محرفٍ أوّلَ قبلَ الرقعةِ وبعدَها.
4. **مسارُ المكالمةِ الصوتيّةِ `runCallTurn` لم يوصَلْ ولم يُقَسْ.** يكتبُ دورًا في `messages` نفسِها ولا يستدعي `startLessonsSearch`، فلا بطاقةَ تحتَ جوابِ مكالمة. هذا حدُّ ما بنيتُ («ابنِ الأصغر»)، وهو غيابٌ مقصودٌ لا سهو — لكنّي لم أقِسْ ما يبدو عليه ثَرْدٌ فيه أدوارُ مكالمةٍ ثمّ سؤالٌ نصّيّ.
5. **`quest.html` و`sw.js`**: قِستُ أنّهما لا يذكرانِ أسماءَ الجولةِ (الحارسُ يؤكِّدُه)، ولم أقرأْهما لغيرِ ذلك.
6. **الوضعُ الإنجليزيّ**: أضفتُ `'chat.lessons'` إلى المعجمين، ولم أشغّلِ الواجهةَ بالإنجليزيّةِ لأرى العنوانَ في مكانِه.
7. **`WARN` الوحيدُ في recon** (`LONGEST_CARD_CHARS`) لم أفحصْ سببَه ولم أُصلحْه؛ أثبتُّه كما طُبِع.
8. **لم أشغّلْ `node tools/core-bytes.cjs --write`** ولا حرّرتُ `sw.js` ولا مرآةَ الحارس. فلا أعلمُ **بالقياسِ** أنّ إعادةَ القطعِ تُخضِرُ `bankintegrity`؛ أقصى ما أعلمُه أنّ الحسابَ في §٥ يقولُ إنّها ينبغي أن تفعل.
9. **لم أُعِدْ تشغيلَ الطقمِ كاملًا بعدَ الإيداع.** المطبوعُ في §٥ من تشغيلةٍ واحدةٍ على شجرةٍ نظيفةٍ عندَ `d44620b`.
10. **ختمُ هذا التقريرِ مقطوعٌ على بايتاتِ `LF`.** قِستُ عندَ إيداعِه أنّ git حذّر: `LF will be replaced by CRLF the next time Git touches it`، ولا رصدَ لـ`*.md` في `.gitattributes` (قِستُه: الملفُّ يرصدُ تسعةَ مسارٍ بالاسمِ وليسَ فيها امتدادُ `md`). فما يخزنُه git هو `LF` — وهو ما قِيسَ عليه الختمُ، وهو ما خُزِّنَ به تقريرُ البندِ ١٤٤ أيضًا (قِستُه: `crlf 0 · lf 297`) — لكنّ سحبًا على آلةٍ بـ`core.autocrlf=true` يُنزِلُه `CRLF` فتختلفُ البصمة. **لم أقِسْ** ذلك السحبَ، ولم أُضِفْ رصدًا: `.gitattributes` خارجَ حدودِ §٥.

---

## ٨ · خلاصةٌ في سطرين

بطاقةُ «دروسٌ ذاتُ صلة» مبنيّةٌ في ذيلِ فقاعةِ `MessageBubble`، بثلاثةِ حقولٍ مكتوبةٍ بالاسم، ونداءٍ واحدٍ بعدَ اكتمالِ الجوابِ يُجهَضُ بمتحكّمٍ ويصمتُ في كلِّ فشل. الحارسُ كانَ يبرهنُ الغيابَ فصارَ يبرهنُ الشكل، والروسترُ ٩٢. والبوّاباتُ ثلاثٌ من أربعٍ خضراءُ، والرابعةُ حمراءُ بسببٍ مطبوعٍ كاملًا: `app.js` كبُرَ فخالفَ تثبيتًا يقعُ في ملفّينِ يمنعُ هذا الأمرُ مسَّهما.

---

**تعريفُ الختم:** `REPORT_SHA8` هو `sha256[0:8]` للحمولة، والحمولةُ هي بايتاتُ هذا الملفِّ **إلى ما قبلَ خطِّ `---` الذي يفتحُ كتلةَ الختمِ هذه** — أي التقريرُ كلُّه منتهيًا بآخرِ سطرٍ من §٨، بمحرفِ سطرٍ واحدٍ في آخرِه. وطولُها مطبوعٌ في `REPORT_PAYLOAD_BYTES` أدناه، فيمكنُ إعادةُ القياسِ حرفيًّا.

REPORT_PAYLOAD_BYTES=24409
REPORT_SHA8=cd0f926a
