# تقريرُ ٢٤-ج — وسيطُ تصفّحِ الدروس

STATUS=IN_PROGRESS
REPORT_DATE=2026-08-23
ORDER=C:\EZIK-ORDERS\ORDER-24C-B-PROXY.md
BRANCH=feat/lessons-browse-proxy-24c
BASE=a332cb3bfc43067f88f4878654a9a3846d07cb14

## ٠ · بوّابةُ الدخول

قِيسَت البوّابةُ قبلَ أيِّ كتابة:

```text
git rev-parse origin/main
a332cb3bfc43067f88f4878654a9a3846d07cb14

git status --porcelain
<صفرُ سطر>

git checkout -B feat/lessons-browse-proxy-24c a332cb3
Switched to a new branch 'feat/lessons-browse-proxy-24c'
```

إذًا لم يتحرّك الأساس، وقُطِع الفرعُ المطلوبُ من `a332cb3` قبلَ أيِّ فعلٍ في
ملفّاتِ العمل. طبعَ Git تحذيرَ صلاحيةٍ عن ملفِّ التجاهلِ العامّ
`C:\Users\passe\.config\git\ignore`؛ لم يكن سطرَ حالةٍ ولم يغيّر نتيجةَ أنَّ
الشجرةَ كانت نظيفة.

## ١ · الجردُ المقيسُ قبلَ أيِّ رقعةٍ تنفيذيّة

### ١-١ قالبُ `api/lessons-search.js`

قُرئ الملفُ كاملًا من الأساسِ المثبّت. الحقائقُ الحرفيّةُ فيه:

- رابطُ الخدمةِ في ثابتٍ محلّيٍّ اسمُه `SEARCH_URL` وقيمتُه
  `https://lib.ezik.app/lessons/search`. **ليس للرابطِ متغيّرُ بيئةٍ في الملف.**
- الرمزُ يُقرأ من `process.env.SEARCH_API_TOKEN`. وهذه هي مجموعةُ أسماءِ
  `process.env` في الملف كلِّه: `{SEARCH_API_TOKEN}`.
- لذلك معنى «صفرُ متغيّرِ بيئةٍ جديد» المقيسُ هنا هو أن يقرأَ الوسيطُ الجديدُ
  `SEARCH_API_TOKEN` نفسَه وألّا يضيفَ أيَّ اسمٍ آخرَ تحتَ `process.env`؛ أمّا
  عنوانُ `/browse` فيبقى ثابتًا محلّيًّا على نسقِ `SEARCH_URL`.
- `TIMEOUT_MS=12000`.
- `MAX_Q_CHARS=400`.
- `LIMIT_MAX=10`.
- البنيةُ المرجعيّةُ تقرأ الجسمَ النصّيَّ أو الكائن، ترفض غيرَ `POST` بـ`405`،
  ترفض المدخلَ الفاسدَ بـ`400`، ترفض غيابَ الرمزِ بـ`503`، وتحوّل فشلَ الاتصالِ
  أو حالةَ المنبعِ أو جسمَه غيرَ المقروءِ إلى `502`. النداءُ محكومٌ بـ
  `AbortSignal.timeout(TIMEOUT_MS)`.
- `shapeSearchResponse` دالّةٌ صافيةٌ مُصدَّرةٌ كي يختبرَ الحارسُ التشكيلَ بلا
  شبكة. وهي لا تمرّرُ غلافَ المنبعِ أو صفوفَه مرورًا أعمى.

### ١-٢ شكلُ `gates.json` وتسجيلُ الحارس

قُرئ `gates.json` نفسُه وحُلِّل، لا أسماءُ مفاتيحَ مفترضة:

- الجذرُ **مصفوفة JSON** طولُها الآن `92`.
- سجلُّ الحارسِ العاديِّ كائنٌ بالمفاتيحِ `name` و`script` و`args`؛
  `args` سلسلةٌ، وتوجدُ في الروستر حالةٌ ذاتُ مفتاحٍ اختياريٍّ `companions`.
- آخرُ ثلاثةِ سجلاتٍ المقيسة: `bootinvariants` ثم `lessonssearch` ثم
  `fiqhindex`.
- `tools/run-gates.cjs` يقرأ المصفوفةَ من `gates.json`، ويشغّل كلَّ سجلٍ
  بالتتابع هكذا: `node <script> ...<args>` من جذرِ المستودع، ثم يطبع
  `<passed>/<total> EXIT=0` ويُخرج الدليلَ خارجَ شجرةِ العمل.
- تسجيلُ هذا العملِ سيكونُ سجلًّا واحدًا بالنمطِ الفعليِّ نفسِه:

  ```json
  {
    "name": "lessonsbrowse",
    "script": "guards/lessons-browse-guard.cjs",
    "args": ""
  }
  ```

  وبذلك يكونُ تغيّرُ الروسترِ المقصودُ `92 -> 93`، بسطرِ التسجيلِ وحدَه في
  `gates.json`.

### ١-٣ نسقُ القائمةِ البيضاءِ في `lib/lessons-source-card.js`

قُرئ الملفُ كاملًا. لا ينسخُ الكائنَ ولا يشتقُ مفاتيحَه. المساعدُ `carry`
يحملُ اسمًا واحدًا فقط إذا كان موجودًا، ثم يستدعيه `buildLessonCard` بالأسماءِ
المكتوبةِ صراحةً: `title` ثم `scholar_id` ثم `url`، ويضيفُ `content_type`
بالاسمِ بعدَ فحصِه. الحقلُ الغائبُ يبقى غائبًا، والحقلُ غيرُ المقيسِ لا يُختَرعُ
ولا يعبر. وسيبني وسيطُ التصفّحِ قوائمَه البيضاءَ بالطريقةِ ذاتِها: أسماءٌ
صريحةٌ لكلِّ مستوى، بلا `Object.keys` أو `Object.entries` أو `Object.values`
أو نشرِ كائنٍ.

## ٢ · التنفيذ

PENDING_AFTER_SECTION_1_INVENTORY

## ٣ · الحارسُ والفيكستشر

PENDING_AFTER_IMPLEMENTATION

## ٤ · الروسترُ والحدود

PENDING_AFTER_IMPLEMENTATION

## ٥ · البوّاباتُ الثلاثُ حرفيًّا

PENDING_AFTER_CLEAN_COMMIT

## ٦ · الإيداعات

PENDING_AFTER_COMMITS

## ٧ · ما لم أقِسْه — بعلّتِه

PENDING_AFTER_MEASUREMENT

## ٨ · الختم

PENDING_AFTER_FINAL_REPORT
