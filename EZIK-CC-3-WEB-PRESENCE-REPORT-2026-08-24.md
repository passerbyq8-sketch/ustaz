# تقريرُ الأمرِ (٣) — الحضورُ الرقميّ · ٧٠ + ٦٩ + ٦٨

**الشجرة:** `C:\Users\passe\projects\ustaz` · **التاريخ:** ٢٤ أغسطس ٢٠٢٦
**الحال:** البنودُ الثلاثةُ منجَزةٌ · **بوّابةٌ واحدةٌ حمراءُ وهي المستثناةُ وحدَها** — `bankintegrity` بفرقِ `+1362`
**لم أدفعْ ولم أنشرْ.** ولم أُعدِّلْ حارسًا واحدًا · ولم أقطعْ `CORE_BYTES` ولا ختمًا · ولم أمسَسْ `sw.js` ولا `app.js` ولا `app.jsx` ولا `api/**` ولا `lib/**` ولا `guards/**` ولا `tools/**`.

---

## ٠ · ملفٌّ أُخرِجَ من الشجرةِ لتبقى نظيفةً

`ORDER-WEB-PRESENCE.md` كان الأثرَ الوحيدَ غيرَ المودَعِ في الشجرةِ، وحرّاسُ هذه الشجرةِ يفحصونَ نظافتَها فتُحمِّرُهم أيُّ رقعةٍ غيرِ مودَعة. فنُقِلَ خارجَ المستودعِ قبلَ أوّلِ تشغيلٍ للبوّابات، **ومقصدُه مطبوعٌ هنا**:

```
C:\Users\passe\AppData\Local\Temp\claude\C--Users-passe-projects-ustaz\148fdae1-b838-4848-bde7-b8e969d28c4e\scratchpad\ORDER-WEB-PRESENCE.md
```

(١١٨٧٢ بايتًا · نُقِلَ ولم يُنسَخْ ولم يُحذَفْ · وهو النسخةُ الوحيدةُ منه الآن.)

---

## ١ · الأساسُ والفرعُ والإيداعاتُ وما مسَّ كلٌّ منها

| الشيء | المتوقَّع | المقيس | الحكم |
|---|---|---|---|
| `git status --porcelain` قبلَ البدء | — | سطرٌ واحدٌ: `?? ORDER-WEB-PRESENCE.md` | نُقِلَ (§٠) فصارَتْ صفرًا |
| `git rev-parse origin/main` بعدَ `fetch` | `d4ebc70` | `d4ebc70dfe0dd4bd76282d6fa9ec4c31bbeb8e65` | ✅ مطابقٌ لما توقّعَه الأمر |
| `git rev-parse HEAD` عندَ البدء | — | `d4ebc70dfe0dd4bd76282d6fa9ec4c31bbeb8e65` | ✅ الفرعُ مقطوعٌ من `origin/main` بعينِه |
| `merge-base HEAD origin/main` | — | `d4ebc70dfe0dd4bd76282d6fa9ec4c31bbeb8e65` | ✅ صفرُ انحرافٍ |
| الفرع | `feat/web-presence-20260824` | `feat/web-presence-20260824` | ✅ |

### الإيداعاتُ وما مسَّ كلٌّ منها

```
$ git --no-pager log --oneline d4ebc70..HEAD
7eb2381 docs: the web-presence report (items 70 + 69 + 68)
e240adb fix: the root canonical is relative, so no guard sees a new host
c9c53e9 seo: sitemap, robots and a canonical on every static page (item 68)
2d24ea8 seo: the head tags on the root document (item 68, section 3-4)
bd40f39 feat: about.html -- the static landing page (items 69 + 70)
```

| الإيداع | الملفّاتُ الممسوسةُ | البند |
|---|---|---|
| `bd40f39` | `about.html` (جديدٌ · ٢٣٠ سطرًا) | ٦٩ + ٧٠ |
| `2d24ea8` | `index.html` (+١٣ سطرًا، كلُّها في `<head>`) | ٦٨ · §٣-٤ |
| `c9c53e9` | `robots.txt` · `sitemap.xml` · `privacy.html` · `support.html` · `delete.html` (٨ أسطرٍ مضافةٍ جملةً) | ٦٨ · §٣-٣ |
| `e240adb` | `index.html` (سطرٌ واحدٌ بُدِّل) | إصلاحُ حمرةِ بوّابتَين — §٤-٦ أدناه |
| `7eb2381` وما بعدَه | هذا التقريرُ وحدَه | §٦ من الأمر |

**الأربعةُ الأُوَلُ وحدَها تمسُّ ما يُشحَنُ**؛ وما بعدَها يمسُّ هذا التقريرَ لا غيرَه، فلا يُغيِّرُ رقمًا من أرقامِ §٤ ولا ختمَ §٨.

`git add` جاءَ بأسماءٍ صريحةٍ في كلِّ مرّةٍ، ولا `git add .` في أيِّ نداء. والشجرةُ نظيفةٌ الآن (`0 dirty path(s)` بشهادةِ مشغّلِ البوّاباتِ نفسِه).

---

## ٢ · ما وجدتُّه في §١ بنصِّه — وما كذّبَه القياسُ من §٢

### §١-٢ · `robots.txt` و`sitemap.xml`: **حاضرانِ حيَّانِ، لا غائبَين**

هذا أوّلُ سطرٍ كذّبَه القياس. الملفّانِ موجودانِ ومتتبَّعانِ في git عندَ `d4ebc70`. نصُّهما **قبلَ لمسي إيّاهما**:

```
robots.txt (٨١ بايتًا · CRLF)
User-agent: *
Allow: /
Disallow: /api/
Sitemap: https://ezik.app/sitemap.xml
```

```xml
sitemap.xml (٥٠٠ بايتٍ · CRLF)
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://ezik.app/delete.html</loc>
    <lastmod>2026-08-06</lastmod>
  </url>
  <url>
    <loc>https://ezik.app/</loc>
    <lastmod>2026-08-21</lastmod>
  </url>
  <url>
    <loc>https://ezik.app/privacy.html</loc>
    <lastmod>2026-08-06</lastmod>
  </url>
  <url>
    <loc>https://ezik.app/support.html</loc>
    <lastmod>2026-08-06</lastmod>
  </url>
</urlset>
```

فعُومِلا كما أمرَ §٣-٣: **وُسِّعا ولم يُعادَ إنشاؤهما** — كلُّ `loc` وكلُّ `lastmod` قائمٌ كما كان، بلا حرفٍ مبدَّل.

### §١-٣ · رأسُ `index.html` عندَ `d4ebc70`

الوسومُ التي وجدتُّها بنصِّها:

```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#1D4ED8">
<meta name="color-scheme" content="light dark">
<link rel="manifest" href="/manifest.json">
<link rel="icon" type="image/png" href="/icon-192.png">
<meta name="mobile-web-app-capable" content="yes">
<title>عزك</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://mushaf.almurabbi.app">
<link href="https://fonts.googleapis.com/css2?family=Tajawal:...&display=swap" rel="stylesheet">
```

والعدُّ: `og:` = **٠** · `twitter:` = **٠** · `canonical` = **٠** · `name="description"` = **٠** · `<title>` = **١** (وهو `عزك`).

### §١-٤ · الصفحاتُ الساكنةُ القائمةُ، والبريدُ الظاهرُ في كلٍّ منها بنصِّه

| الملفّ | البايتات | `<title>` بنصِّه | البريدُ الظاهرُ | سكربتات | `canonical` |
|---|---|---|---|---|---|
| `privacy.html` | ٤٩٠٠٩ | `سياسة الخصوصية — عزك \| Privacy Policy — Ezik` | `passerbyq8@gmail.com` | ٠ | ٠ |
| `support.html` | ٩٥٩٦ | `الدعم — عزك \| Support — Ezik` | `passerbyq8@gmail.com` | ٠ | ٠ |
| `delete.html` | ١٠٧٧٩ | `حذف البيانات — عزك \| Data Deletion — Ezik` | `passerbyq8@gmail.com` | ٠ | ٠ |
| `quest.html` | ٢١٢٥٦٥ | `عزك — رحلةُ الكنوز` | لا بريدَ فيه | **١٣** | ٠ |

الثلاثةُ الأُوَلُ كلُّها `<html lang="ar" dir="rtl">`، والقسمُ الإنجليزيُّ في كلٍّ منها كتلةٌ واحدةٌ بـ`class="en"` تُوجَّهُ بالـCSS لا بسمةِ `dir`. وصفرُ رابطٍ خارجيٍّ (`URLS: []`) في الثلاثة.

### §١-٥ · ما هي ملفّاتُ `CORE` بالضبط — وأداخلَها `index.html`؟

مقروءةً بأداةِ المستودعِ نفسِها (`node tools/core-bytes.cjs`، بلا `--write`) عندَ `d4ebc70`:

```
CORE entry                file on disk                   bytes
--------------------------------------------------------------
/                         index.html                    120617
/manifest.json            manifest.json                    533
/icon-192.png             icon-192.png                    5053
/icon-512.png             icon-512.png                   12893
/icon-maskable-512.png    icon-maskable-512.png           5938
/icon-watermark.png       icon-watermark.png            368386
/adhkar.json              adhkar.json                   177392
/app.js                   app.js                        990041
/vendor/react.umd.js      vendor/react.umd.js            10751
/vendor/react-dom.umd.js  vendor/react-dom.umd.js       131835
--------------------------------------------------------------
TOTAL                                                  1823439
declared in sw.js:  1823439        MATCH
```

**الجواب: نعم، `index.html` داخلَ `CORE` وهو مدخلُه الأوّلُ `/`.** فهو وحدَه ما يقطعُ الحزمةَ من الملفّاتِ السبعةِ التي مسَستُها؛ و`about.html` و`robots.txt` و`sitemap.xml` و`privacy.html` و`support.html` و`delete.html` **ليست في `CORE` ولا في الثلاثةَ عشرَ المختومةِ**، فلا تقطعُ شيئًا.

### §١-٦ · `vercel.json` — مقروءًا لا مُخترَعًا

```json
{
  "version": 2,
  "name": "ustaz-app",
  "functions": {
    "api/ask.js": { "maxDuration": 300, "includeFiles": "lib/data/fiqh-search.json.gz" },
    "api/chat.js": { "maxDuration": 300 },
    "api/chat-fast.js": { "maxDuration": 300 },
    "api/fatwa-proxy.js": { "maxDuration": 30 },
    "api/tashkeel.js": { "maxDuration": 300 },
    "api/tts.js": { "maxDuration": 300 },
    "api/stt.js": { "maxDuration": 300 },
    "api/report.js": { "maxDuration": 300 }
  },
  "rewrites": [
    { "source": "/api/v1/:path*", "destination": "/api/fatwa-proxy?path=:path*" }
  ],
  "headers": [
    { "source": "/", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
    { "source": "/index.html", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }
  ]
}
```

**صفرُ تحويلٍ يمسُّ `/about.html`**، وصفرُ رأسٍ خاصٍّ به: فيُخدَمُ كملفٍّ ساكنٍ من الجذرِ كما تُخدَمُ `privacy.html` وأخواتُها. ولم أُعدِّلْ هذا الملفَّ.

### حكمُ القياسِ على سطورِ §٢

| سطرُ §٢ | الحكم |
|---|---|
| لا مستودعَ موقعٍ مستقلًّا؛ الصفحاتُ داخلَ مستودعِ التطبيق | ✅ **صادق** — `privacy/support/delete/quest` كلُّها في هذه الشجرة |
| `/` هو التطبيقُ وما يقرؤه الزاحفُ لا شيءَ تقريبًا | ✅ **صادق ومقيسٌ رقمًا**: نصُّ جسمِ `index.html` بصفرِ تنفيذٍ = **٠ حرفًا** (وهو ٠ اليومَ أيضًا: لم أمسَسِ الجسم) |
| صفرُ رابطٍ إلى المتجرَينِ في الصفحاتِ كلِّها | ✅ **صادق** — الإصاباتُ الوحيدةُ عندَ `d4ebc70` في `data/transfer-fixtures/*.html`، وهي أرشيفُ مواقعِ غيرِنا لا صفحاتُنا |
| البريدُ الظاهرُ شخصيٌّ على `gmail.com` | ✅ **صادق** — `passerbyq8@gmail.com` في الصفحاتِ الثلاث |
| `canonical` صفرٌ و`JSON-LD` صفر | ✅ **صادق** عندَ `d4ebc70` |
| **`robots.txt` و`sitemap.xml` كانا `404`** | ❌ **كذّبَه القياس** — الاثنانِ حاضرانِ متتبَّعانِ في الشجرةِ، ونصُّهما مطبوعٌ أعلاه. (وحضورُهما في الشجرةِ ليس برهانًا على أنّهما يُخدَمانِ حيًّا؛ ذاك في §٧.) |
| MX وSPF نازلانِ ومُبرهَنانِ حيًّا | ⬜ **لم أقِسْه** — §٣-٥ يحرّمُ عليَّ DNS، فلا أُصدِّقُه ولا أُكذِّبُه |
| §٣-٤: «ووكيلٌ آخرُ ترَكَ في `bankintegrity` فرقًا سلفًا» | ❌ **كذّبَه القياس** — البوّاباتُ **٩٣/٩٣ خضراءُ** عندَ `d4ebc70`، و`CORE_BYTES` مطابقٌ تمامًا (`MATCH`). فلا فرقَ موروثٌ أقاسمُه: **الفرقُ كلُّه نصيبي** (§٤-٦) |

---

## ٣ · اسمُ الصفحةِ ومسارُها ولماذا هذا الاسم

**المسار:** `/about.html` (ملفٌّ في جذرِ الشجرةِ: `about.html`).

**لماذا:** الصفحاتُ الساكنةُ القائمةُ كلُّها على نسقٍ واحدٍ — كلمةٌ واحدةٌ صغيرةُ الحروفِ ثمّ `.html` في الجذرِ: `privacy.html` · `support.html` · `delete.html` · `quest.html`. فـ`about.html` هو الاسمُ الذي يقعُ في هذا النسقِ بلا استثناءٍ يُشرَح، وتذييلُ الصفحاتِ القائمةِ يربطُ بأمثالِه بالمسارِ المطلقِ (`/privacy.html`) فيربطُ بهذا مثلَه.

**والجذرُ لم يُمَسَّ محلُّه (§٣-٠):** `/` ما زالَ التطبيقَ. لم أُضِفْ تحويلًا ولا رأسًا في `vercel.json`، ولا لمَستُ جسمَ `index.html` ببايتٍ واحدٍ (مُبرهَنٌ في §٤-٤)، فغلافُ الجوّالِ وعاملُ الخدمةِ والتثبيتُ تجدُ ما تحمّلُه كما كان.

---

## ٤ · برهانُ §٥ — ستّتُه بأرقامِه

### ٤-١ · الصفحةُ تُقرأُ بلا جافاسكربتَ ألبتّة

النصُّ مستخرَجٌ من HTML الخامِّ **بصفرِ تنفيذٍ** (حذفُ `script` و`style` والتعليقاتِ ثمّ نزعُ الوسوم): **٣٧٨٠ حرفًا في ٧٢ سطرًا**. والنصُّ كاملًا في §٥ من هذا التقرير.

### ٤-٢ · الرابطانِ حاضرانِ في الخامِّ حرفًا — مطبوعانِ من الملفِّ لا من الأمر

هذه الأسطرُ مقروءةٌ من `about.html` نفسِه:

```html
<li><a class="store" href="https://apps.apple.com/gb/app/عزك/id6797100518">App Store — آيفون وآيباد</a></li>
<li><a class="store" href="https://play.google.com/store/apps/details?id=app.almurabbi.tutor&amp;hl=ar">Google Play — أندرويد</a></li>
<li><a class="store" href="https://apps.apple.com/gb/app/عزك/id6797100518">App Store — iPhone and iPad</a></li>
<li><a class="store" href="https://play.google.com/store/apps/details?id=app.almurabbi.tutor&amp;hl=ar">Google Play — Android</a></li>
"https://apps.apple.com/gb/app/عزك/id6797100518",
"https://play.google.com/store/apps/details?id=app.almurabbi.tutor&hl=ar"
```

رابطُ آبل حرفًا بحرفٍ كما في §٣-٢، بـ`عزك` عربيّةً غيرَ مُرمَّزة. ومعرِّفُ حزمةِ أندرويدَ `app.almurabbi.tutor` كما هو، لم يُصحَّحْ ولم تُخترَعْ له صيغةٌ «أنظف» — بل زدتُ على الصفحةِ سطرًا يشرحُ للقارئِ **لماذا** يحملُ الاسمَ القديم.

**فرقٌ واحدٌ أُعلِنُه صراحةً ولا أطويه:** في سمةِ `href` كُتِبَ `&amp;` بدلَ `&` — وهذا هو الترميزُ الواجبُ لعلامةِ العطفِ داخلَ سمةٍ في HTML، ولو كُتِبَتْ عاريةً لصارَتْ `ambiguous ampersand`. **والعنوانُ الذي يستقبلُه المتجرُ مطابقٌ بايتًا ببايتٍ** لأنّ المحلِّلَ يفكُّ الكيانَ قبلَ الطلب. **واللفظُ الحرفيُّ غيرُ المُرمَّزِ حاضرٌ في الملفِّ نفسِه أيضًا** — آخِرُ سطرَين أعلاه، داخلَ كتلةِ `JSON-LD`. فالشرطُ «حاضرانِ في الخامِّ حرفًا» مستوفًى نصًّا، ومستوفًى دلالةً في الموضعَين.

### ٤-٣ · صفرُ طلبٍ خارجيّ

| المقيس | العدد |
|---|---|
| عناصرُ `<script>` جملةً | **١** — وهي `<script type="application/ld+json">` |
| منها ما يحملُ `src=` | **٠** |
| **سكربتٌ قابلٌ للتنفيذ** (بعدَ استثناءِ `ld+json`) | **٠** |
| `<link rel="stylesheet">` | **٠** |
| `@font-face` أو `@import` | **٠** |
| `img` · `iframe` · `video` · `audio` · `embed` · `object` | **٠** |
| `url(` في الـCSS | **٠** |
| `preconnect` أو `dns-prefetch` | **٠** |

وكلُّ عنوانٍ مطلقٍ في الملفِّ مُصنَّفٌ بموضعِه: `apps.apple.com` و`play.google.com` **روابطُ `<a>` خارجةٌ** يضغطُها القارئُ (لا طلبٌ عندَ التحميل) · `ezik.app/about.html` في `canonical` و`meta` · `ezik.app/icon-512.png` في `og:image` و`twitter:image` (سمةُ `content`، لا تُجلَبُ عندَ التحميلِ، وهي على نطاقِنا أصلًا) · `schema.org` و`ezik.app/` قيمتانِ نصّيّتانِ داخلَ `JSON-LD`. **فصفرُ أصلٍ يُجلَبُ من نطاقٍ آخرَ، وصفرُ خطٍّ خارجيّ.**

**وهذا تعارضٌ في الأمرِ أُعلِنُه ولا أُخفيه:** §٣-٣ يطلبُ `JSON-LD` واحدةً على الصفحةِ التعريفيّة، و§٥-٣ يطلبُ «صفرَ `<script>`». و`JSON-LD` لا صيغةَ لها إلّا `<script type="application/ld+json">` — فهي ليستْ جافاسكربتَ ولا يُنفِّذُها متصفّحٌ ولا تُصدِرُ طلبًا. فاخترتُ استيفاءَ الطلبَينِ معًا على أضيقِ ما يُمكِن: **سكربتٌ قابلٌ للتنفيذِ = ٠، و`src` = ٠، وطلبٌ خارجيّ = ٠**، وكتلةٌ خامدةٌ واحدةٌ هي المطلوبُ في §٣-٣. ولو أرادَ المالكُ حرفيّةَ §٥-٣ فحذفُ الكتلةِ سطرٌ واحدٌ، وثمنُه بندُ ٦٨.

### ٤-٤ · رأسُ الجذرِ: الوسومُ حاضرةٌ · والفرقُ كلُّه داخلَ `<head>` · و`bare LF = 0`

الوسومُ الثلاثةَ عشرَ المضافةُ، كلُّها في `<head>` وحدَه:

```html
<meta name="description" content="عزك — رفيقٌ إسلاميٌّ للأطفال وأهلِهم: المصحفُ والأذكارُ ومواقيتُ الصلاةِ والقبلةُ وفتاوى العلماءِ ودروسُهم.">
<link rel="canonical" href="/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="عزك — Ezik">
<meta property="og:locale" content="ar_AR">
<meta property="og:title" content="عزك — رفيقٌ إسلاميٌّ للأطفال وأهلِهم">
<meta property="og:description" content="عزك — رفيقٌ إسلاميٌّ للأطفال وأهلِهم: المصحفُ والأذكارُ ومواقيتُ الصلاةِ والقبلةُ وفتاوى العلماءِ ودروسُهم.">
<meta property="og:url" content="https://ezik.app/">
<meta property="og:image" content="https://ezik.app/icon-512.png">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="عزك — رفيقٌ إسلاميٌّ للأطفال وأهلِهم">
<meta name="twitter:description" content="عزك — رفيقٌ إسلاميٌّ للأطفال وأهلِهم: المصحفُ والأذكارُ ومواقيتُ الصلاةِ والقبلةُ وفتاوى العلماءِ ودروسُهم.">
<meta name="twitter:image" content="https://ezik.app/icon-512.png">
```

**والعنوانُ القائمُ `<title>عزك</title>` تُرِكَ كما هو ولم يُزَدْ عليه ثانٍ** — عنصرُ `title` ثانٍ غيرُ صحيحٍ في HTML، والقائمُ عنوانٌ. فالعنوانُ حاصلٌ، و`og:title` و`twitter:title` يحملانِ الصيغةَ الأطولَ لمن يُشارِكُ الرابط.

البرهانُ على أنّ الفرقَ كلَّه داخلَ الرأس — مقطوعًا عندَ **الحدِّ الحقيقيِّ** `</head>` (وهي واحدةٌ في الملفِّ، فالحدُّ غيرُ ملتبِس):

| المقيس | قبلَ (`d4ebc70`) | بعدَ (`HEAD`) | الفرق |
|---|---|---|---|
| بايتاتُ الملفِّ جملةً | ١٢٠٦١٧ | ١٢١٩٧٩ | **+١٣٦٢** |
| بايتاتُ ما قبلَ `</head>` | ١٠٦٧٣٥ | ١٠٨٠٩٧ | **+١٣٦٢** |
| بايتاتُ ما من `</head>` إلى آخرِ الملفّ | ١٣٨٨٢ | ١٣٨٨٢ | **٠** |
| `sha256` لما من `</head>` إلى آخرِ الملفّ | `065d601cb1560ab9b9990f635c1f0bff5cf83f9a793f159a35a7023464bbdce1` | `065d601cb1560ab9b9990f635c1f0bff5cf83f9a793f159a35a7023464bbdce1` | **مطابقٌ** |

فالجسمُ كلُّه — وعنصرُ `<body>` يبدأُ بعدَ `</head>` — **مطابقٌ بايتًا ببايتٍ لما كانَ عليه عندَ `d4ebc70`**، وصفرُ مساسٍ بأيِّ شيفرة.

**فائدةٌ للقادمِ بعدي، وقعتُ فيها فصحّحتُها بالقياس:** البحثُ عن `<body` في هذا الملفِّ يُصيبُ أوّلًا عندَ الحرفِ ٣٧٨٦٠ — **داخلَ تعليقِ CSS في الرأس** («neither selector can match `<body>` or :root»). فمن قطعَ عندَ أوّلِ `<body` قطعَ في وسطِ الرأسِ وحسِبَ أنّه على حدِّ الجسم. عنصرُ `<body>` الحقيقيُّ عندَ الحرفِ ١٠٧٦٤٠، بعدَ `</head>` عندَ ١٠٧٦٣١. والقطعُ في الجدولِ أعلاه على `</head>`، وبرهانُه أقوى: كلُّ ما بعدَ ذلك الحدِّ مطابقٌ، والجسمُ كلُّه داخلَه.

**نهاياتُ الأسطر، معدودةً على البايتات** (لا بأداةٍ تكذبُ هنا):

| الملفّ | البايتات | `CRLF` | `bare LF` |
|---|---|---|---|
| `index.html` | ١٢١٩٧٩ | ١٦٩٨ | **٠** ✅ |
| `about.html` | ١٣٣٦٨ | ٢٣٠ | **٠** |
| `support.html` | ٩٦٥٧ | ١٥١ | ٠ |
| `delete.html` | ١٠٨٣٩ | ١٥٨ | ٠ |
| `privacy.html` | ٤٩٠٦٩ | ٠ | ٣٨٤ (مثبَّتٌ `eol=lf` في `.gitattributes`، فبقيَ كذلك) |
| `robots.txt` | ١٠٥ | ٥ | ٠ |
| `sitemap.xml` | ٥٩٨ | ٢٣ | ٠ |

`index.html` بقيَ `CRLF` خالصًا كما يُثبِّتُه `.gitattributes`، و`bare LF = 0` بعدَ الحقنِ كما طلبَ §٣-٤. وكلُّ ملفٍّ لمَستُه حُفِظَ على نهايتِه التي وجدتُّه عليها.

### ٤-٥ · الخريطةُ صادقةٌ — كلُّ مسارٍ فيها له ملفٌّ في الشجرة، مسارًا مسارًا

```
https://ezik.app/delete.html       -> delete.html      10839 b on disk | git-tracked
https://ezik.app/                  -> index.html      121979 b on disk | git-tracked
https://ezik.app/privacy.html      -> privacy.html     49069 b on disk | git-tracked
https://ezik.app/support.html      -> support.html      9657 b on disk | git-tracked
https://ezik.app/about.html        -> about.html       13368 b on disk | git-tracked

sitemap entries: 5  |  dead paths: 0
```

**صفرُ مسارٍ ميتٍ.** والمدخلُ الجديدُ وحدَه أُضيفَ (`lastmod 2026-08-24`)، والأربعةُ القائمةُ بأزمنتِها كما كانت.

و`robots.txt` وُسِّعَ بسطرٍ واحدٍ:

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /quest-data/
Sitemap: https://ezik.app/sitemap.xml
```

**ولماذا هذا السطرُ بالذاتِ، مقيسًا:** `quest-data/` **غيرُ مذكورٍ في `.vercelignore`**، فهو يُنشَرُ ويُخدَمُ على النطاق؛ و`quest.html` يجلبُ منه `quest-data/trivia-golden.json` وقتَ التشغيل، فلا يجوزُ استثناؤه من النشر. وبنكُ أسئلةِ لعبةِ الأطفالِ محلُّه النشرُ لا فهرسُ محرّكِ بحث. و`robots.txt` لا يمسُّ جلبَ التطبيقِ نفسِه بحرفٍ، فالكسبُ بلا ثمن.

و`canonical` أُضيفَ لكلِّ صفحةٍ ساكنةٍ: `about.html` (`https://ezik.app/about.html`) · `privacy.html` · `support.html` · `delete.html` — سطرٌ واحدٌ في كلٍّ منها بجانبِ الوصفِ الذي تحملُه أصلًا، **وصفرُ إعادةِ تصميمٍ وصفرُ لمسٍ لأيِّ شيءٍ آخرَ فيها** كما يأمرُ §٣-٥.

### ٤-٦ · البوّاباتُ قبلَ وبعدُ، على شجرةٍ نظيفةٍ — والاستثناءُ الوحيدُ ونصيبي منه معزولًا

**قبلُ، عندَ `d4ebc70` وشجرةٍ نظيفةٍ** (بعدَ إخراجِ ملفِّ الأمرِ في §٠):

```
=== SUITE: 93/93 EXIT=0 ===
recon:    SUMMARY   PASS=185   WARN=1   FAIL=0
tree after: 0 dirty path(s)
GATES_EXIT=0
```

**بعدُ، عندَ `HEAD` (`e240adb`) وشجرةٍ نظيفةٍ:**

```
=== SUITE: 92/93 EXIT=0 ===
recon:    SUMMARY   PASS=185   WARN=1   FAIL=0
tree after: 0 dirty path(s)
FAILING (1): bankintegrity=1
```

`recon` كما كانَ حرفًا: `PASS=185 WARN=1 FAIL=0` قبلَ وبعدُ — فلا اكتشافَ جديدًا جرَّتْه الصفحةُ ولا الوسوم. **والحمراءُ واحدةٌ وهي المستثناةُ في الأمرِ وحدَها.**

نصُّ حمرتِها، وهما فحصانِ من ٧٦ لا أكثر، **ومصدرُهما رقمٌ واحدٌ**:

```
FAIL [B12] CORE_BYTES = 1823439 but CORE weighs 1824801 bytes on disk (+1362).
FAIL [B14] sw.js prose says index.html is 120617 bytes; the disk says 121979 (+1362).
FAIL  74 checks passed, 2 failed.
```

**الفرقُ رقمًا: `+1362` بايتًا.** وهو بعينِه الوسومُ الثلاثةَ عشرَ التي حقنتُها في `<head>` — لا أكثرَ ولا أقلَّ، لأنّ `index.html` هو مدخلُ `CORE` الأوّلُ `/` (§١-٥).

**ونصيبي منه معزولًا بالقياس، لا بالتفسير:** الأمرُ يقولُ إنّ وكيلًا آخرَ ترَكَ في هذه البوّابةِ فرقًا سلفًا. **القياسُ يكذّبُ ذلك:** البوّاباتُ **٩٣/٩٣ خضراءُ** عندَ `d4ebc70`، وهذه البوّابةُ فيها خضراءُ، و`CORE_BYTES` مطابقٌ تمامًا (`declared 1823439 = measured 1823439 · MATCH`). **فالفرقُ الموروثُ صفرٌ، و`+1362` كلُّه نصيبي، ومن إيداعٍ واحدٍ بعينِه (`2d24ea8` ثمّ `e240adb` الذي خفّضَه من `+1378` إلى `+1362`).**

**ولم أُصلِحْه ولم أنقُضْه**، كما أمرَ §٣-٤: قطعُ `CORE_BYTES` وإعادةُ ختمِ `sw.js` مِلكُ جولةِ الدمج، و`sw.js` محرَّمٌ عليَّ في §٠. و`B14` من الجنسِ نفسِه — جدولُ بايتاتٍ في **نثرِ `sw.js`** يذكرُ ١٢٠٦١٧، وتصحيحُه لمسٌ لـ`sw.js`. فمن يقطعُ الشحنةَ يُصلِحُ الاثنَينِ في إيداعٍ واحدٍ بـ`node tools/core-bytes.cjs --write` ثمّ إعادةِ قطعِ الختم.

**وبوّابتانِ حمّرَتا ثمّ خضِرَتا، وأُعلِنُهما لأنّ الطريقَ إليهما درسٌ:** أوّلُ تشغيلٍ بعدَ الحقنِ أعطى `90/93` — `bankintegrity` و**`chatux` و`a11y`**. والأخيرتانِ تقيسانِ بالنمطِ نفسِه «المضائفَ التي يصلُها المستندُ»: `(?:src|href)=["']https?://([^/"']+)` ثمّ مقارنةً بقائمةٍ فيها ثلاثةٌ. و`<link rel="canonical" href="https://ezik.app/">` يُطابِقُ `href=` فيدخلُ القائمةَ:

```
FAIL  ...and reaches no host it did not already reach
      expected []
      actual   ["ezik.app"]
```

**فلم أُعدِّلْ حارسًا** (§٤-٣ من الأمر). ولم أحتَجْ إلى الوقوفِ أيضًا، لأنّ ثمّةَ مخرجًا صحيحًا لا يمسُّ الحارسَ: **`canonical` يقبلُ عنوانًا نسبيًّا** ويُحَلُّ إلى العنوانِ المطلقِ نفسِه، فصارَ `href="/"`. وعادَتِ المضائفُ إلى الثلاثةِ المُعلَنةِ بعينِها (`fonts.googleapis.com` · `fonts.gstatic.com` · `mushaf.almurabbi.app`) وخضِرَتِ البوّابتان. وعناوينُ `og:*`/`twitter:*` بقيَتْ مطلقةً كما تُوجِبُ مواصفتُها، لأنّها في `content=` وذاك النمطُ لا يقرؤها — فلم تكنْ هي ما حمّرَ شيئًا.

**ملاحظةٌ للحارسِ لا تعديلٌ له:** `href` في `<link rel="canonical">` ليس جلبًا لمضيفٍ، والنمطُ يعُدُّه واحدًا. فالحارسُ يمنعُ اليومَ `canonical` مطلقةً في `index.html` وهو لا يقصدُها. لم ألمَسْه، وأُثبِتُه هنا ليقرّرَ صاحبُ القرار.

---

## ٥ · نصُّ الصفحةِ كاملًا — ليقرأَه المالكُ بعينِه قبلَ الدمج

هذا هو ما يستخرجُه زاحفٌ من `about.html` **بصفرِ تنفيذٍ** (٣٧٨٠ حرفًا · ٧٢ سطرًا)، بترتيبِه على الصفحة:

```
عزك — رفيقٌ إسلاميٌّ للأطفال وأهلِهم | Ezik — an Islamic companion for children and their families
عزك
عزك — رفيقٌ إسلاميٌّ للأطفال وأهلِهم
تطبيقُ جوّالٍ بالعربيّة، على iOS وأندرويد
English version ↓
عزك تطبيقٌ يسألُه الطفلُ بالعربيّةِ فيُجيبُه بما يناسبُ سنَّه، ومعه المصحفُ والأذكارُ ومواقيتُ الصلاةِ والقبلةُ وفتاوى العلماءِ ودروسُهم.
ما في التطبيقِ اليومَ
هذه أقسامُ الصفحةِ الأولى، بأسمائِها في التطبيقِ نفسِه:
المحفّظ — احفظ وراجع.
الأذكار — أذكار الصباح والمساء.
المصحف — اقرأ وتابع وردك.
رحلةُ الكنوز — تعلّم باللعب.
فتاوى — بحث موثّق بالسؤال والجواب.
الدروس — بحثٌ في دروسِ العلماء.
الصلاة والقبلة — المواقيتُ والقبلة، محسوبةً على هذا الجهاز.
المحادثة
سؤالٌ وجوابٌ بالعربيّة، وللجوابِ ثلاثُ درجاتٍ من العمقِ تختارُها: موجز، ومفصّل، وطالبُ علم.
إملاءٌ صوتيّ، ومكالمةٌ صوتيّةٌ مباشرة، وقراءةُ الجوابِ صوتًا.
محادثاتُك ومفضّلتُك محفوظةٌ على جهازِك، ويُبحَثُ فيها.
دروسٌ ذاتُ صلةٍ تُقترحُ بجانبِ الجواب.
للأهل
التحكم — رمزٌ للأهلِ يقفُ دونَ الإعداداتِ الحسّاسة.
سهولةُ الاستخدام — حجمُ الخطِّ، ووضعُ القراءة، وتقليلُ الحركة.
واجهةٌ بالعربيّةِ أو الإنجليزيّة، ومظهرٌ فاتحٌ أو داكن.
الإسنادُ في قسمِ الفتاوى
في قسمِ الفتاوى يُعرَضُ النصُّ المنشورُ في موقعِ الشيخِ، ومعه رابطٌ يفتحُ المصدرَ الرسميَّ. وما كان تفريغًا آليًّا من مقطعٍ رسميٍّ فهو مَوسومٌ بذلك، والأصلُ هو المقطع.
عزك ذكاءٌ اصطناعيّ وقد يُخطئ — راجِعْ ما يهمُّك مع والديك أو مع أهل العلم. هذا التنبيهُ قائمٌ في التطبيقِ نفسِه، بجانبِ المحادثة.
تحميلُ التطبيق
App Store — آيفون وآيباد
Google Play — أندرويد
ومعرِّفُ الحزمةِ على أندرويد يحملُ اسمَ المشروعِ القديمَ، لأنّ معرِّفَ الحزمةِ لا يتغيّرُ بعدَ النشر.
الدعمُ والخصوصيّة
للأسئلةِ وتقاريرِ المشكلات:
passerbyq8@gmail.com
صفحةُ الدعم
سياسةُ الخصوصيّة
حذفُ البيانات
Ezik — an Islamic companion for children and their families
A mobile app in Arabic, on iOS and Android
A child asks Ezik in Arabic and is answered in a way that suits their age, alongside the Mushaf, the adhkar, prayer times and the qibla, and the fatwas and lessons of the scholars.
What is in the app today
These are the sections of the first screen, under the names they carry in the app:
Memoriser — memorise and review.
Adhkar — morning and evening adhkar.
Mushaf — read, and keep your wird.
Treasure journey — learn through play.
Fatwas — verified questions and answers.
Lessons — search the lessons of the scholars.
Prayer and qibla — the times and the qibla, computed on the device.
The conversation
Questions and answers in Arabic, with three depths you choose between: brief, detailed, and student of knowledge.
Voice dictation, a live voice call, and the reply read aloud.
Your conversations and favourites are kept on your device, and can be searched.
Related lessons are suggested beside the answer.
For parents
Parental controls — a code for the parents, standing in front of the sensitive settings.
Ease of use — text size, reading mode, and reduced motion.
An Arabic or English interface, and a light or dark appearance.
Attribution in the fatwa section
The fatwa section shows the text published on the website of the scholar, with a link that opens the official source. Anything that is an automatic transcript of an official clip is marked as one, and the clip itself is the original.
Ezik is an artificial intelligence and can be wrong — check what matters to you with your parents or with people of knowledge. This notice stands in the app itself, beside the conversation.
Download the app
App Store — iPhone and iPad
Google Play — Android
The Android package id carries the older name of the project, because a package id cannot change after publication.
Support and privacy
For questions and problem reports:
passerbyq8@gmail.com
Support page
Privacy policy
Data deletion
عزك — Ezik · ezik.app · الدعم / Support · سياسة الخصوصية / Privacy policy · حذف البيانات / Delete data
```

### من أين جاءَ كلُّ سطرٍ — الصدقُ المقيسُ وحدَه (§٣-١)

كلُّ ميزةٍ مذكورةٍ مقروءةٌ من الشجرةِ المنشورةِ، وبالأسماءِ التي يستعملُها التطبيقُ لنفسِه:

- **الأقسامُ السبعةُ** من مصفوفةِ الصفحةِ الأولى في `app.jsx` (`ezHomeModules`)، وسبعتُها بلا شرطٍ ولا رايةِ تشغيل. وعناوينُها ووصفُها من قاموسِ الترجمةِ نفسِه (`module.*` و`module.*.sub`)، عربيًّا وإنجليزيًّا. و«الصلاة والقبلة» و«المواقيتُ والقبلة، محسوبةً على هذا الجهاز» نصّانِ حرفيّانِ في المصدر.
- **درجاتُ العمقِ الثلاثُ** من `chat.depthBrief` / `chat.depthDetailed` / `chat.depthScholar` · **الإملاءُ والمكالمةُ** من `chat.dictate` و`chat.call` · **الدروسُ ذاتُ الصلةِ** من `chat.lessons` · **التحكمُ** من `settings.control` · **سهولةُ الاستخدامِ** من `a11y.*`.
- **التنبيهُ القائمُ منقولٌ حرفًا** من `chat.standingNotice` في التطبيقِ، ولم يُصَغْ من جديدٍ ولم يُلطَّفْ.
- **الإسنادُ نُسِبَ لقسمِ الفتاوى وحدَه** كما يأمرُ §٣-١، ومن نصوصِ ذلك القسمِ بعينِها: `fatwa.officialText` و`fatwa.source` و`fatwa.transcriptTag` و`fatwa.transcriptNotice`. **ولا عبارةَ في الصفحةِ من جنسِ «كلُّ جوابٍ بمصدرِه»** — ولا وعدَ مطلقٍ ولا صيغةَ تعميمٍ في سطرٍ واحدٍ منها.
- **صفرُ رقمٍ غيرِ مقيس:** لا عددَ تنزيلاتٍ ولا مستخدمينَ ولا تقييمَ ولا نجومَ — ولا رقمَ واحدَ من هذا الجنسِ في الصفحةِ ولا في `JSON-LD` (فلا `aggregateRating` ولا `offers`، إذ لا قياسَ عندي لواحدٍ منهما).
- **وما شككتُ فيه حذفتُه:** لم أذكرِ المكتبةَ ولا الترجمةَ ولا شيئًا من الطابور.
- `lang` و`dir`: المستندُ `<html lang="ar" dir="rtl">`، والكتلةُ الإنجليزيّةُ `<div class="en" id="english" lang="en" dir="ltr">` — **وهي زيادةٌ على الصفحاتِ القائمةِ**، فهي توجِّهُ كتلتَها الإنجليزيّةَ بالـCSS بلا سمةٍ (§١-٤). ولم أُعِدْ تصميمَها ولم ألمَسْ توجيهَها، فذاك محرَّمٌ في §٣-٥.

---

## ٦ · 🔴 حالُ البريدِ — بندٌ صريح

**الظاهرُ على الصفحةِ عنوانٌ مجّانيٌّ: `passerbyq8@gmail.com`** — على `gmail.com`، لا على النطاق. وهو **العنوانُ الحيُّ نفسُه** الظاهرُ اليومَ في `privacy.html` و`support.html` و`delete.html` كما قِستُه في §١-٤، فالصفحةُ الجديدةُ لم تُحدِثْ عنوانًا ولم تُخالِفْ أخواتِها.

**ولماذا لم أكتبْ عنوانًا على النطاق:** §٣-١ يمنعُ ذلك ما لم أُثبِتْ أنّه يستقبلُ، و§٣-٥ يمنعُني DNS وإنشاءَ حسابِ بريد. **فلا قياسَ عندي لعنوانٍ على `ezik.app` ألبتّة** — لا إرسالًا ولا استقبالًا. وعنوانٌ ميتٌ على صفحةِ دعمٍ أسوأُ من مجّانيٍّ حيّ.

**وما الذي ينقصُ لتحويلِه** (خطوةُ حسابٍ على المالكِ، لا شيءَ منها في الشيفرة):

1. حسابُ بريدٍ فعليٌّ على النطاقِ يُنشَأُ عندَ مزوّدٍ (مثلُ `salam@ezik.app` أو `support@ezik.app`).
2. إثباتُ الاستقبالِ حيًّا: رسالةٌ تُرسَلُ من خارجٍ وتُقرأُ في الصندوق. (سجلّا MX وSPF ذكرَ §٢ أنّهما نازلانِ ومُبرهَنانِ، **وأنا لم أقِسْ ذلك** — §٧.)
3. بعدَ ثبوتِ الاستقبالِ: يُبدَّلُ العنوانُ في **أربعةِ ملفّاتٍ** لا في واحدٍ — `about.html` و`privacy.html` و`support.html` و`delete.html` — وفي `about.html` موضعانِ (العربيُّ والإنجليزيُّ) وكلٌّ منهما في `href` وفي النصِّ الظاهر.
4. ولوحاتُ المتجرَينِ تحملُ بريدَ الدعمِ أيضًا، وهي خارجَ هذه الشجرةِ ومحرَّمةٌ عليَّ في §٠.

---

## ٧ · ما لم يُقَسْ — مسمًّى ولا يُطوى

1. **ما يفعلُه محرّكُ البحثِ فعلًا.** لا أدّعيه ولا أعِدُ به. أقصى ما فعلتُه أنّني جعلتُ الصفحةَ **قابلةً** للقراءةِ بلا تنفيذٍ، وأعلنتُها في الخريطةِ، وأذنتُ للزاحفِ في `robots.txt`. **ومتى تُفهرَسُ، أو هل تُفهرَسُ، أو بأيِّ ترتيبٍ تظهرُ — لا شيءَ من ذلك مقيسٌ ولا مضمونٌ**، ولا يُقاسُ إلّا بعدَ نشرٍ وبأدواتِ المالكِ.
2. **DNS: MX وSPF ونيابةُ النطاقِ عن البريد.** لم أستعلمْ سجلًّا واحدًا — §٣-٥ يحرّمُه. فسطرُ §٢ فيه لا أُصدِّقُه ولا أُكذِّبُه.
3. **هل تُخدَمُ هذه الملفّاتُ حيًّا على `ezik.app`؟** لم أنشرْ ولم أطلبْ عنوانًا. الذي قِستُه أنّها **في الشجرةِ ومتتبَّعةٌ**، وأنّ `vercel.json` لا يحوّلُها ولا يستثنيها، وأنّ `.vercelignore` لا يذكرُ واحدًا منها. **وأنّ `robots.txt` و`sitemap.xml` حاضرانِ في الشجرةِ لا يبرهنُ أنّهما يُجيبانِ `200` اليوم** — فذاك يُقاسُ على العنوانِ الحيِّ وحدَه.
4. **الصفحةُ في متصفّحٍ حقيقيّ.** برهانُ §٥ كلُّه على البايتاتِ: نصٌّ مستخرَجٌ، وعدُّ وسومٍ، وتصنيفُ عناوين. **لم أفتحْ `about.html` في متصفّحٍ ولم ألتقطْ لها صورةً**، فمظهرُها على شاشةٍ ضيّقةٍ وسلامةُ تشكيلِها البصريِّ غيرُ مقيسَين.
5. **عاملُ الخدمةِ (بندُ §٣-٥ مسمًّى).** لم أمسَسْ `sw.js` ببايتٍ، فـ`about.html` **خارجَ التخزينِ المسبَقِ عمدًا**: `CORE` عشرةُ مداخلَ وليست فيه (§١-٥). وقرأتُ سلوكَ العاملِ من مصدرِه ولم أُجرِّبْه على جهازٍ، وهذا ما يقولُه المصدرُ: فرعُ التنقّلِ `req.mode === 'navigate'` **شبكةٌ أوّلًا** — فالمتّصلُ يأخذُ الصفحةَ من الشبكةِ ويُخزَّنُ جوابُها وقتَ التشغيل، ومَن لا شبكةَ له ولم يزرِ الصفحةَ قبلًا يسقطُ إلى `caches.match('/')` **فيرى قوقعةَ التطبيقِ مكانَ الصفحة**. هذا ثمنُ بقاءِ العاملِ بلا لمسٍ، وهو مقروءٌ من الشيفرةِ **لا مُجرَّبٌ على جهاز**.
6. **`quest.html` مستثنًى من الخريطةِ عن قصدٍ.** هو موجودٌ ومتتبَّعٌ (٢١٢٥٦٥ بايتًا) ويصلُه التطبيقُ، فكانَ يجوزُ إعلانُه. تركتُه لأنّه صفحةُ لعبٍ يبنيها ثلاثةَ عشرَ سكربتًا، فما يقرؤه الزاحفُ منها كالذي يقرؤه من `/`: لا شيءَ تقريبًا. وإعلانُه قرارُ نشرٍ لا يطلبُه هذا الأمرُ، وقد أضفتُ `Disallow: /quest-data/` في الاتّجاهِ المضادِّ لبنكِ أسئلتِه.
7. **الثلاثةَ عشرَ المختومةُ ومنها `manifest.json`:** لم ألمَسْ واحدًا منها، ولم أُضِفْ إلى `manifest.json` ذكرًا للصفحةِ الجديدة. فالتثبيتُ وأيقوناتُه كما كانت.
8. **`.gitattributes` لم يُمَسّ.** و`about.html` **غيرُ مثبَّتِ النهاياتِ** فيه، مثلَ `support.html` و`delete.html` و`quest.html` قبلَه. `core.autocrlf=true` على هذه الآلةِ، فالمخزونُ في git سيكونُ `LF` والمسحوبُ `CRLF`. **ولا حارسَ يقرأُ `about.html`**، فلا ختمَ يُكسَرُ بذلك اليومَ — وإن قرأَه حارسٌ يومًا فالتثبيتُ سطرٌ في `.gitattributes`.
9. **العدُّ الذي لم أُغيِّرْه:** بوّابتانِ تُثبِّتانِ عددَ الاعتماديّاتِ ولم أُضِفْ اعتماديّةً واحدةً؛ ولم أُنشئْ شاشةً فلم يُطلَبْ منّي ذكرُها في مستندِ التسليم؛ **ولم أكتبْ في أيِّ ملفٍّ عبارةَ نداءِ التنقّلِ إلى شاشةِ الدروسِ** (§٤-٤ من الأمر) — لا في الصفحةِ ولا في هذا التقريرِ ولا في تعليقٍ.
10. **ما لم يُطلَبْ فلم يُفعَلْ:** صفرُ لوحةِ متجرٍ · صفرُ DNS · صفرُ إنشاءِ حسابِ بريدٍ · صفرُ تحليلاتٍ · صفرُ لقطةِ متجرٍ (البندُ ٦١ مستقلٌّ ويحتاجُ جهازًا) · صفرُ إعادةِ تصميمٍ للصفحاتِ القائمة · **وصفرُ دفعٍ وصفرُ نشر**.

---

## ٨ · الختم

| الملفّ | البايتات | `sha256` |
|---|---|---|
| `about.html` | ١٣٣٦٨ | `c7b599486508f58e7436542f916ef4a1011910072c495a40b86edfd97feb91b7` |
| `index.html` | ١٢١٩٧٩ | `a7f7c872a23ce9b05d86b7a16e32cb1550bba06be32a79a364ae6e23ddb747af` |
| `privacy.html` | ٤٩٠٦٩ | `42de240bab81c9f39c1b2f19f0bdcdc92f0a4925c28a601619ce37a78f08486c` |
| `support.html` | ٩٦٥٧ | `7bc95d450e6ff4c4dac647edc183508af40aac2ef2d50a0a6e22075fde50589a` |
| `delete.html` | ١٠٨٣٩ | `d39fbcde19b7b0e5af35299bb8df67fc51b5cd522f82947ddd00ccff69478879` |
| `robots.txt` | ١٠٥ | `bbfb30556bace3b80e1a92b2752bb568af00e991bf24bb628aa829e04a91c4e9` |
| `sitemap.xml` | ٥٩٨ | `b0d555a45eebf6706d994b6ecbdf4949ead9f5205f00139c91da666df7bbac27` |

```
PAYLOAD_BYTES  = 205615
PAYLOAD_SHA256 = 1b7735388cd35732976db0b0c0dc7cf0947b9b5cfb179f95a5b008cf025ef649
```

`PAYLOAD_BYTES` مجموعُ بايتاتِ الملفّاتِ السبعةِ التي مسَّتْها هذه الجولةُ في الشجرةِ، و`PAYLOAD_SHA256` مقطوعٌ على وصلِ بايتاتِها **بالترتيبِ المذكورِ في الجدولِ أعلاه** (وهذا هو تعريفُه، فلا يُعادُ قطعُه بترتيبٍ آخر).

**أقفُ هنا وأنتظر: صفرُ دفعٍ وصفرُ نشر.**
