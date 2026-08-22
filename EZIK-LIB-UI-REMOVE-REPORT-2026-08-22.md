# تقريرُ تنفيذٍ — عزك · **نزعُ واجهةِ المكتبة** (٢٥-ب · شقُّ الواجهةِ وحدَه)

**الأمرُ:** `ORDER-LIB-UI-REMOVE-28.md` — نُقِلَ إلى `C:\EZIK-STAGE\orders\` أوّلَ فعلٍ بعدَ قراءتِه · `ORDER_MOVED=True`
**النافذةُ:** ن٥ · **الشجرةُ:** `C:\Users\passe\projects\ustaz` (الأمُّ) · **التاريخُ:** ٢٠٢٦-٠٨-٢٢
**الأساسُ:** `main` عندَ `1b1579134220d8fefda7eb69ecc019043e415c66`
**الإيداعُ:** `9fd9bd6794e29ffe346296c5f7b3c97a65b75f65`

> هذا التقريرُ يقيسُ ولا يحكمُ. كلُّ رقمٍ فيه مقيسٌ في هذا الجريانِ نفسِه، بما فيه عمودُ «قبلُ» في جدولِ الأرضيّات.

---

## ١ · بوّاباتُ ما قبلَ العمل (§٢ من الأمر)

| المفتاح | الشرط | المقيسُ | الحصيلةُ |
|---|---|---|---|
| `CWD` | `C:\Users\passe\projects\ustaz` | `C:/Users/passe/projects/ustaz` | ✅ |
| `BRANCH` | `main` | `main` | ✅ |
| `HEAD` | `1b157913…` | `1b1579134220d8fefda7eb69ecc019043e415c66` | ✅ |
| `HEAD == origin/main` | متساويانِ | `origin/main = 1b1579134220d8fefda7eb69ecc019043e415c66` | ✅ |
| `DIRTY_LINES` | `0` بعدَ نقلِ الأمر | `0` | ✅ |
| `SOURCECARD_COUNT_BEFORE` | يُقاسُ | `5` | ✅ |
| `GUARD_16A_BEFORE` | المتوقَّعُ `210/210` | `210/210 — PASS` · `EXIT=0` | ✅ |

### `PIPES_SHA_BEFORE` — قبلَ أيِّ مساس

```
cd9d370aaeaa8ca84c0b06db64bf0227d5cfc1a3638268e84fa083aba9142bee  api/lib-search.js
44d5810eb8a6ab53ca1c2019ca578638357cdb502b40dff43d5f6e65b541dee1  lib/lib-source-card.js
68a54224a64c48e92cb091df2ddecd12dc92a51a984aea09039dbf26b9aa69d7  guards/fixtures-lib-search-16a.json
```

**لم تسقطْ بوّابةٌ. مضى العملُ.**

---

## ٢ · المواضعُ الستّةُ المنزوعةُ من `app.jsx`

كلُّ موضعٍ طُوبِقَ **بنصِّه** لا برقمِه، وطُبِعَ رقمُه الفعليُّ وأوّلُ سطرِه وآخرُه قبلَ الحذف. **لم يتعدّدْ موضعٌ ولم يتعذّرْ واحدٌ.**

| # | الموضعُ | المرساةُ النصّيّةُ | السطرُ الفعليُّ | المحذوفُ |
|---|---|---|---|---|
| ٦-أ | بلاطةُ المكتبةِ ورمزُها | `const EZH_LIBRARY = 'المكتبة';` + `EZH_ICON_LIBRARY` | `3266-3271` | ٦ |
| ٦-ب | وصفُ الوحدةِ في الرئيسيّة | `{ id: 'library', … onClick: v.onOpenLibrary, … }` | `3292` | ١ |
| ١ | حالةُ الفتح | `const [libraryOpen, setLibraryOpen] = useState(false);` | `3526-3527` | ٢ |
| ٢ | مفتاحُ الوحدة | `onOpenLibrary: () => setLibraryOpen(true),` | `3555` | ١ |
| ٣ | سطرُ العرض | `if (libraryOpen) return <LibrarySheet` | `3574` | ١ |
| ٤ | كتلةُ الشاشة | من رايةِ `ITEM 16-ب` حتّى نهايةِ `function LibrarySheet` | `12287-12505` | ٢١٩ |
| ٥ | الأنماطُ السبعةُ | مفاتيحُ `s` التي تبدأُ بـ`ezlib` | `15695-15704` | ١٠ |
| | | | **المجموعُ** | **٢٤٠** |

`APPJSX_LINES_BEFORE = 16856` ⟶ `APPJSX_LINES_AFTER = 16616` · **الفرقُ `-240`**

### القياساتُ الملزِمةُ بعدَ النزع

| المفتاح | الشرطُ | المقيسُ | الحصيلةُ |
|---|---|---|---|
| `LIB_TOKENS_LEFT_IN_APPJSX` | `0` | `0` | ✅ |
| `SOURCECARD_COUNT_AFTER` | `= SOURCECARD_COUNT_BEFORE` | `5 = 5` | ✅ |
| `EZH_LIBRARY` / `EZH_ICON_LIBRARY` | لا يتيمَ | `0` | ✅ |

النمطُ المقيسُ عليه `LIB_TOKENS`: `LibrarySheet|EZLIB_|ezLib|ezlib|libraryOpen|onOpenLibrary` — كان `64` سطرًا، صارَ `0`.

### سلامةُ التركيبِ عندَ كلِّ حزٍّ — ثلاثةُ أسطرٍ حولَ كلِّ حذف

```
6-a  const EZH_ICON_PRAYER = ( … );          <- ) ;
     const EZH_ICON_MENU = ( … );            <- الحزُّ نظيفٌ، لا تعليقَ يتيمٌ

6-b  { id: 'prayer', … meta: null },
     ];                                      <- لا فاصلةَ زائدةٌ، والقائمةُ ستٌّ

1    // ITEM 108-أ: the sheet's one piece of state…
     const [prayerOpen, setPrayerOpen] = useState(false);
     const wt = readWirdTarget();             <- useState ما يزالُ مستعمَلًا

2    onOpenPrayer: () => setPrayerOpen(true),
     };                                       <- لا فاصلةَ يتيمةٌ ولا كائنَ فارغٌ

3    if (prayerOpen) return <PrayerSheet … />;
     return <EzikIstanaHome {...home} />;      <- فرعٌ واحدٌ ذهبَ، والباقي قائمٌ

4    );  }                                     <- نهايةُ PrayerSheet
     (سطرٌ فارغٌ واحدٌ)
     // ============ ITEM 109 — التاريخُ الهجريُّ …   <- تباعدُ الأقسامِ محفوظٌ

5    qiblaBtn: { … },
     // ITEM 109: the Hijri line …             <- التعليقُ التالي ما يزالُ لصاحبِه
```

### ثلاثةُ أحكامٍ اجتهاديّةٍ تُعلَنُ صراحةً

1. **بدايةُ الموضعِ ٤ عندَ `12287` لا `12292`.** المرساةُ (`a shipped secret cannot be un-shipped`) وُجِدَتْ عندَ `12292` تمامًا كما قالَ الأمرُ، غيرَ أنّ **كتلةَ التعليقِ المتّصلةَ التي تحويها تبدأُ عندَ `12287`** برايةِ القسمِ وعنوانِه العربيِّ «ITEM 16-ب — البحثُ في المكتبة». والقطعُ من `12292` كان يتركُ خمسةَ أسطرٍ يتيمةٍ تُعرِّفُ بندًا معدومًا — وهو عينُ ما يحرّمُه بندُ «لا سطرَ يتيمًا» 🔴 في §٣.
2. **نهايةُ الموضعِ ٤ عندَ `12503` لا `12539`.** أعطى الأمرُ مرساتَين للنهايةِ **تختلفانِ في الشجرة**: «نهايةُ `function LibrarySheet`» = `12503`، و«قبلَ `HIJRI_CALENDAR` مباشرةً» = `12539`. والأسطرُ الستّةُ والثلاثونَ بينَهما **هي كتلةُ تعليقِ `ITEM 109` نفسِها** (التاريخُ الهجريُّ)، لا شيءَ للمكتبةِ فيها. فأُخِذَ بالمرساةِ الأولى، وبقيَتْ وثيقةُ `ITEM 109` سليمةً — عملًا بـ§٩ «لا يُفعَلُ ما وراءَ النطاق».
3. **زيادةُ الموضعِ ٦ ليشملَ `3266-3271`.** حذفُ الواصفِ وحدَه كان يُيتِّمُ `EZH_LIBRARY` و`EZH_ICON_LIBRARY`، وقد قِيسَ أنّهما **لا يُذكَرانِ في سطرٍ آخرَ واحدٍ في الشجرةِ كلِّها**. فنُزِعا تحتَ بندِ «لا سطرَ يتيمًا».

---

## ٣ · حارسُ ٢٥-أ — النقصُ المأذونُ، مقيسًا لا مقدَّرًا

| المفتاح | القيمةُ |
|---|---|
| `GUARD_16A_BEFORE` | `210/210 — PASS` |
| `GUARD_16A_AFTER` | `137/137 — PASS` · `EXIT=0` |
| `GUARD_ASSERTIONS_REMOVED` | **`73`** |
| `GUARD_ASSERTIONS_ADDED` | **`0`** |
| تأكيداتُ الخادمِ أو بنّاءِ البطاقةِ أو العيّناتِ المرفوعةُ | **`0`** |
| ملفُّ الحارسِ | **قائمٌ** (`890 ⟶ 610` سطرًا) |
| ملفُّ العيّناتِ | **قائمٌ، ولم تُمَسَّ بايتةٌ** |

**كيفَ قِيسَ الفرقُ:** لم تُحصَ الأسماءُ باليدِ. شُغِّلَ الحارسُ **الأصليُّ على الشجرةِ الأصليّةِ** (بـ`git stash` ثمّ `stash pop`، وأُثبِتَتِ الاستعادةُ بمطابقةِ `sha256` للملفّاتِ الثلاثةِ المعدَّلةِ: `app.jsx: OK` · `app.js: OK` · `guards/lib-search-16a-guard.cjs: OK`)، ثمّ قُورِنَتْ قائمتا الأسماءِ حرفًا بحرف.

### الموضعُ الوحيدُ الذي أُعيدَ تأسيسُه بدلَ رفعِه

`F6` — `...and no code outside the library block reaches the route`.
كان يقولُ: «لا كودَ **خارجَ الكتلةِ** يحملُ العنوانَ أو النداء». ولا كتلةَ اليومَ، فصارَ يقولُها على **الملفِّ كلِّه**:

```js
check("...and no code outside the library block reaches the route",
  !APPJSX.includes("EZLIB_ROUTE") && !APPJSX.includes("ezLibSearchCall") &&
  !APPJSX.includes("'/api/lib-search'"));
```

وهي **الصيغةُ الأقوى** للجملةِ نفسِها: تُثبِتُ النزعَ بدلَ أن تأذنَ به. وكذلك أُعيدَ تأسيسُ تأكيدَي `F3` («لا يُسمّي متغيّرَ بيئةٍ» و«ولا يُسمّي مضيفًا») على **جسدِ الردِّ الذي أرسلَه الخادمُ** بدلَ الواجهةِ التي كانت تنقلُه — فبقيَ التأكيدُ على الخادمِ حيًّا وذهبَ النقلُ وحدَه.

### توزيعُ المرفوعِ على أقسامِ الحارس

| القسمُ | العددُ | موضوعُه |
|---|---|---|
| `F` | ١ | قطعُ الكتلةِ من `app.jsx` |
| `F1` | ١ | موضعُ النداءِ الواحدُ في الواجهة |
| `F2` | ٢ | بايتاتُ `VIEW` |
| `F3` | ١٨ | سَوقُ `ezLibViewState` / `ezLibSentence` |
| `F4` | ٥ | تفتيشُ مصدرِ الواجهةِ و`ezLibCardLine` |
| `F5` | ٢ | تطفيرُ مصدرِ الواجهة |
| `F6` | ٣ | موضعُ النداءِ وموضعُه في الشاشةِ ولمسةُ الفتح |
| `F7` | ١ | `LibrarySheet` في الحزمةِ المشحونة |
| `F8` | ١٣ | جدولُ الأسبقيّةِ مسوقًا في الواجهة |
| `G` | ٢٧ | الشاشةُ مركَّبةً ومسوقةً بمعالِجاتِها |
| **المجموعُ** | **٧٣** | |

### التأكيداتُ المرفوعةُ، واحدًا واحدًا بأسمائِها وأسبابِها

| # | القسمُ | اسمُ التأكيدِ المرفوع | سببُ الرفع |
|---|---|---|---|
| 1 | `F` | `the library block is in app.jsx exactly once` | قطعُ الكتلةِ من `app.jsx` بطرفَيها — ولا كتلةَ |
| 2 | `F1` | `the client speaks to this repo's own function and to nothing else` | عَدَّ موضعَ النداءِ الواحدَ في الواجهة — ولا موضعَ |
| 3 | `F2` | `the view names the response fields rather than quoting them` | مقصورٌ على بايتاتِ `VIEW` — ولا `VIEW` |
| 4 | `F2` | `...and it draws the card line off the hit rather than assembling one` | مقصورٌ على بايتاتِ `VIEW` — ولا `VIEW` |
| 5 | `F3` | `the pure half of the view carries no JSX` | يقرأُ النصفَ الخالصَ من الواجهة — منزوعٌ |
| 6 | `F3` | `refused: true is its own state` | يسوقُ `ezLibViewState`/`ezLibSentence` المقطوعَينِ من `app.jsx` — منزوعانِ |
| 7 | `F3` | `...and the view draws exactly that, byte for byte` | يسوقُ `ezLibViewState`/`ezLibSentence` المقطوعَينِ من `app.jsx` — منزوعانِ |
| 8 | `F3` | `...and the view draws exactly that, byte for byte` | يسوقُ `ezLibViewState`/`ezLibSentence` المقطوعَينِ من `app.jsx` — منزوعانِ |
| 9 | `F3` | `...and it offers no retry, because the ceiling is not a fault` | يسوقُ `ezLibViewState`/`ezLibSentence` المقطوعَينِ من `app.jsx` — منزوعانِ |
| 10 | `F3` | `degraded_reason is its own state` | يسوقُ `ezLibViewState`/`ezLibSentence` المقطوعَينِ من `app.jsx` — منزوعانِ |
| 11 | `F3` | `...and the results are still shown` | يسوقُ `ezLibViewState`/`ezLibSentence` المقطوعَينِ من `app.jsx` — منزوعانِ |
| 12 | `F3` | `503 is a neutral state, not an error state` | يسوقُ `ezLibViewState`/`ezLibSentence` المقطوعَينِ من `app.jsx` — منزوعانِ |
| 13 | `F3` | `...and its sentence is the server's, not the view's` | يسوقُ `ezLibViewState`/`ezLibSentence` المقطوعَينِ من `app.jsx` — منزوعانِ |
| 14 | `F3` | `...and its sentence is the server's, not the view's` | يسوقُ `ezLibViewState`/`ezLibSentence` المقطوعَينِ من `app.jsx` — منزوعانِ |
| 15 | `F3` | `...and it offers no retry, because retrying cannot add a token` | يسوقُ `ezLibViewState`/`ezLibSentence` المقطوعَينِ من `app.jsx` — منزوعانِ |
| 16 | `F3` | `502 is neutral and retryable` | يسوقُ `ezLibViewState`/`ezLibSentence` المقطوعَينِ من `app.jsx` — منزوعانِ |
| 17 | `F3` | `a network that never answered lands in the same state` | يسوقُ `ezLibViewState`/`ezLibSentence` المقطوعَينِ من `app.jsx` — منزوعانِ |
| 18 | `F3` | `...and with no body there is NO sentence, not an invented one` | يسوقُ `ezLibViewState`/`ezLibSentence` المقطوعَينِ من `app.jsx` — منزوعانِ |
| 19 | `F3` | `a malformed 200 is treated as a dead answer, not as zero results` | يسوقُ `ezLibViewState`/`ezLibSentence` المقطوعَينِ من `app.jsx` — منزوعانِ |
| 20 | `F3` | `a plain 200 with hits shows them` | يسوقُ `ezLibViewState`/`ezLibSentence` المقطوعَينِ من `app.jsx` — منزوعانِ |
| 21 | `F3` | `a plain 200 with no hits is not an error` | يسوقُ `ezLibViewState`/`ezLibSentence` المقطوعَينِ من `app.jsx` — منزوعانِ |
| 22 | `F3` | `...and it names the field the server fills for it` | يسوقُ `ezLibViewState`/`ezLibSentence` المقطوعَينِ من `app.jsx` — منزوعانِ |
| 23 | `F4` | `the view never reads hit.page_start` | يفتّشُ مصدرَ الواجهةِ عن حقلِ صفحة — ولا مصدرَ |
| 24 | `F4` | `the view never reads hit.page_end` | يفتّشُ مصدرَ الواجهةِ عن حقلِ صفحة — ولا مصدرَ |
| 25 | `F4` | `the view never reads hit.volume` | يفتّشُ مصدرَ الواجهةِ عن حقلِ صفحة — ولا مصدرَ |
| 26 | `F4` | `the view never reads hit.page_citable` | يفتّشُ مصدرَ الواجهةِ عن حقلِ صفحة — ولا مصدرَ |
| 27 | `F4` | `the view drops a hit whose card did not arrive rather than drawing it bare` | يسوقُ `ezLibCardLine` ويقرأُ مصدرَ الواجهة — منزوعانِ |
| 28 | `F5` | `the view mutant is a real mutation, not a no-op` | يطفّرُ مصدرَ الواجهةِ نفسَه — ولا مصدرَ يُطفَّر |
| 29 | `F5` | `THE GUARD BITES: a view that reaches for a page field is caught` | يطفّرُ مصدرَ الواجهةِ نفسَه — ولا مصدرَ يُطفَّر |
| 30 | `F6` | `the route is reached through exactly one call site` | موضعُ النداءِ وموضعُه داخلَ الشاشةِ ولمسةُ فتحِها — الثلاثةُ منزوعةٌ |
| 31 | `F6` | `CALLS_ON_BOOT = 0: that call site is inside the sheet, not at module scope` | موضعُ النداءِ وموضعُه داخلَ الشاشةِ ولمسةُ فتحِها — الثلاثةُ منزوعةٌ |
| 32 | `F6` | `...and the sheet is only rendered behind a reader's tap` | موضعُ النداءِ وموضعُه داخلَ الشاشةِ ولمسةُ فتحِها — الثلاثةُ منزوعةٌ |
| 33 | `F7` | `...and the sheet really is in it` | يطلبُ `LibrarySheet` في الحزمةِ المشحونة — منزوعةٌ منها |
| 34 | `F8` | `...and the view names the field instead` | مقصورٌ على بايتاتِ `VIEW` — ولا `VIEW` |
| 35 | `F8` | `the view asks for the same field the server sent (row 1 refused)` | يسوقُ `ezLibViewState`/`ezLibSentence` صفًّا صفًّا في جدولِ الأسبقيّة — منزوعانِ |
| 36 | `F8` | `...and draws it, or draws nothing when there was nothing (row 1 refused)` | يسوقُ `ezLibViewState`/`ezLibSentence` صفًّا صفًّا في جدولِ الأسبقيّة — منزوعانِ |
| 37 | `F8` | `the view asks for the same field the server sent (row 1 edge refused+hits)` | يسوقُ `ezLibViewState`/`ezLibSentence` صفًّا صفًّا في جدولِ الأسبقيّة — منزوعانِ |
| 38 | `F8` | `...and draws it, or draws nothing when there was nothing (row 1 edge refused+hits)` | يسوقُ `ezLibViewState`/`ezLibSentence` صفًّا صفًّا في جدولِ الأسبقيّة — منزوعانِ |
| 39 | `F8` | `the view asks for the same field the server sent (row 2 degraded with hits)` | يسوقُ `ezLibViewState`/`ezLibSentence` صفًّا صفًّا في جدولِ الأسبقيّة — منزوعانِ |
| 40 | `F8` | `...and draws it, or draws nothing when there was nothing (row 2 degraded with hits)` | يسوقُ `ezLibViewState`/`ezLibSentence` صفًّا صفًّا في جدولِ الأسبقيّة — منزوعانِ |
| 41 | `F8` | `the view asks for the same field the server sent (row 2 edge degraded no hits)` | يسوقُ `ezLibViewState`/`ezLibSentence` صفًّا صفًّا في جدولِ الأسبقيّة — منزوعانِ |
| 42 | `F8` | `...and draws it, or draws nothing when there was nothing (row 2 edge degraded no hits)` | يسوقُ `ezLibViewState`/`ezLibSentence` صفًّا صفًّا في جدولِ الأسبقيّة — منزوعانِ |
| 43 | `F8` | `the view asks for the same field the server sent (row 3 empty)` | يسوقُ `ezLibViewState`/`ezLibSentence` صفًّا صفًّا في جدولِ الأسبقيّة — منزوعانِ |
| 44 | `F8` | `...and draws it, or draws nothing when there was nothing (row 3 empty)` | يسوقُ `ezLibViewState`/`ezLibSentence` صفًّا صفًّا في جدولِ الأسبقيّة — منزوعانِ |
| 45 | `F8` | `the view asks for the same field the server sent (row 4 hits only)` | يسوقُ `ezLibViewState`/`ezLibSentence` صفًّا صفًّا في جدولِ الأسبقيّة — منزوعانِ |
| 46 | `F8` | `...and draws it, or draws nothing when there was nothing (row 4 hits only)` | يسوقُ `ezLibViewState`/`ezLibSentence` صفًّا صفًّا في جدولِ الأسبقيّة — منزوعانِ |
| 47 | `G` | `the shipped bundle boots` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 48 | `G` | `the sheet component is in the shipped bundle` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 49 | `G` | `the sheet renders a search field and a form` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 50 | `G` | `CALLS_ON_BOOT = 0, measured on a rendered sheet with nothing typed` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 51 | `G` | `the shipped handlers are reachable on the rendered nodes` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 52 | `G` | `SCREEN refused: the module's own sentence is on it, carried by the server` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 53 | `G` | `SCREEN degraded: the shortfall is on it` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 54 | `G` | `...and the results are on it too, not withheld` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 55 | `G` | `SCREEN 503: the server's neutral sentence is on it` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 56 | `G` | `...and no environment variable is named` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 57 | `G` | `SCREEN 502: the server's neutral sentence, and a retry is offered` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 58 | `G` | `SCREEN offline: no body came, so NO sentence is drawn and none is invented` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 59 | `G` | `...but the retry is still there, so the reader is not stranded` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 60 | `G` | `SCREEN ok: both hits are drawn` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 61 | `G` | `...and each carries the line the SERVER rendered, byte for byte` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 62 | `G` | `...and the citable hit shows its page` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 63 | `G` | `PAGE_SHOWN_WHEN_NOT_CITABLE = 0, ON THE RENDERED SCREEN` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 64 | `G` | `...and the chapter path is on the screen instead` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 65 | `G` | `...and the matn is on it, so the card was not simply dropped` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 66 | `G` | `a hit whose card did not arrive is NOT drawn bare` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 67 | `G` | `SCREEN empty: the module's EMPTY_TEXT is on it, carried by the server` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 68 | `G` | `...and no result is drawn beside it` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 69 | `G` | `...and a body with hits shows no such sentence` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 70 | `G` | `every call the screen made went to this repo's own route, by POST` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 71 | `G` | `...carrying q and limit 10, and nothing else` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 72 | `G` | `...and no token, and no service host, ever left the browser` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |
| 73 | `G` | `...and not one request went anywhere under lib/` | يُقلِعُ الحزمةَ ويركّبُ الشاشةَ ويسوقُها بمعالِجاتِها — ولا شاشةَ تُركَّب |

---

## ٤ · برهانُ سلامةِ الأنابيبِ — الفقرةُ التي لا تُسامَح

**`PIPES_UNTOUCHED=true`**

| الملفُّ | `PIPES_SHA_BEFORE` | `PIPES_SHA_AFTER` | الحكمُ |
|---|---|---|---|
| `api/lib-search.js` | `cd9d370aaeaa8ca84c0b06db64bf0227d5cfc1a3638268e84fa083aba9142bee` | `cd9d370aaeaa8ca84c0b06db64bf0227d5cfc1a3638268e84fa083aba9142bee` | **SAME** |
| `lib/lib-source-card.js` | `44d5810eb8a6ab53ca1c2019ca578638357cdb502b40dff43d5f6e65b541dee1` | `44d5810eb8a6ab53ca1c2019ca578638357cdb502b40dff43d5f6e65b541dee1` | **SAME** |
| `guards/fixtures-lib-search-16a.json` | `68a54224a64c48e92cb091df2ddecd12dc92a51a984aea09039dbf26b9aa69d7` | `68a54224a64c48e92cb091df2ddecd12dc92a51a984aea09039dbf26b9aa69d7` | **SAME** |

وشهدَ `git` بالمثلِ: `git status --porcelain` على الثلاثةِ ⟹ **`0` سطر**. ولم تُستدعَ استعادةٌ ولا وقعَ `pipe_touched`.

---

## ٥ · البناءُ والأرقامُ الثلاثةُ والرفعةُ والختم

### ٥-١ · البناءُ

```
node tools/build-app.cjs          wrote app.js 947845 bytes
                                  sha256 9a607e1069f66e138d57979834ec53d30fb10df354c5634aa48e49772abbf8a9
node tools/build-app.cjs --check  built  947845  9a607e10…
                                  on disk 947845  9a607e10…
                                  OK: app.js is exactly what this source builds
```

### ٥-٢ · `CORE_BYTES`

| المفتاح | القيمةُ |
|---|---|
| `CORE_BYTES_OLD` | `1794078` |
| `CORE_BYTES_NEW` | `1781243` |
| `CORE_BYTES_DELTA` | **`-12835`** |

كُتِبَ بـ`node tools/core-bytes.cjs --write`، والفرقُ هو بعينِه فرقُ `app.js` — لا شيءَ آخرَ في `CORE` تحرّك.

### ٥-٣ · حجمُ `app.js` — المواضعُ الثلاثةُ، مُحدَّدةً برمجيًّا

بُحِثَ عن الرقمِ القديمِ `960680` في الشجرةِ كلِّها (خلا `node_modules` و`app.js` نفسِه وتقاريرِ الجولات)، فكانت المواضعُ الحيّةُ ثلاثةً وهذه هي:

| # | الموضعُ | قبلُ | بعدُ |
|---|---|---|---|
| ١ | `sw.js:112` — `const CORE_BYTES` (مجموعٌ يضمُّه) | `1794078` | `1781243` |
| ٢ | `sw.js:96` — نثرُ جدولِ `CORE` | `app.js 960680` | `app.js 947845` |
| ٣ | `quest-bank-integrity-guard.cjs:1268` — مرآةُ `SW_PROSE` | `{ n: 960680, of: 'app.js' }` | `{ n: 947845, of: 'app.js' }` |

`960680` المتبقّي في نطاقِ التشغيلِ: **`0`**.

> **فرقٌ عن نصِّ الأمرِ يُعلَنُ:** قال §٥-٣ «`sw.js` ومرآتانِ في حارسِ البنك». والمقيسُ أنّ القسمةَ **اثنانِ في `sw.js`** (الثابتُ ونثرُه) **وواحدةٌ في حارسِ البنك**. والعددُ ثلاثةٌ كما قالَ الأمرُ، والمواضعُ نفسُها، ولم يُترَكْ رابعٌ: ما في الحارسِ عندَ `1207` يقرأُ `CORE_BYTES` من `sw.js` اشتقاقًا لا تثبيتًا، وما عندَ `132` تعليقٌ تاريخيٌّ عن جولةِ `89-ب`.

### ٥-٤ · الرفعةُ `ezik-v18 ⟶ ezik-v19`

طُوبِقَتْ بـ`ezik-v18(?![0-9])`.

| المفتاح | القيمةُ |
|---|---|
| `EZIK_V18_OCCURRENCES` (نطاقُ التشغيل) | **`0`** |
| `EZIK_V19_OCCURRENCES` | **`2`** — `sw.js:44` (`const CACHE`) · `quest-bank-integrity-guard.cjs:182` (`const SW_CACHE`) |
| `ezik-v18` في تقاريرِ الجولاتِ السابقةِ (`*.md`) | `6` — **مستثناةٌ، ولم تُمَسّ** |
| `ezik-mushaf-pages-v1` | **لم يُمَسّ**: `sw.js:506` · `quest-bank-integrity-guard.cjs:117,219` — عُدَّ قبلَ الاستبدالِ وبعدَه فكانَ `1` و`2` في الملفَّينِ على حالِه |

### ٥-٥ · ختمُ `sw.js`

| المفتاح | القيمةُ |
|---|---|
| البصمةُ قبلُ | `0df9ee77efe73b0b2fad4fff0fe1c0f322e939d3aedc88fe3f2cb54f2a659183` |
| البصمةُ بعدُ | `2eb610f03989f84b1dba61ecdc64c9ef711f04b08fbacad3e56b37000ffb4ff1` |
| `SW_CR_BYTES` | `0` — الشرطُ الذي يفرضُه تعليقُ `D09` على هذا الختمِ محقَّقٌ |
| `bankintegrity` | **خضراءُ** · `76 checks passed, 0 failed` |

### ٥-٦ · `TDZ`

```
node C:\Users\passe\tdz-scan.cjs
PARSE_OK=1 MODE=script   SCOPES=1338   TDZ_COUNT=0
```

---

## ٦ · الإيداعُ والبوّابات

| المفتاح | القيمةُ |
|---|---|
| `git add` | بالأسماءِ صراحةً: `app.jsx` · `app.js` · `guards/lib-search-16a-guard.cjs` · `quest-bank-integrity-guard.cjs` · `sw.js` — **ولا `git add .` ألبتّة** |
| `COMMIT_SHA` | `9fd9bd6794e29ffe346296c5f7b3c97a65b75f65` |
| `DIRTY_LINES` بعدَ الإيداعِ | **`0`** |
| `run-gates` | **`90/90` · `EXIT=0` · `tree after: 0 dirty path(s)`** |

```
 app.js                          |  84 +--------
 app.jsx                         | 240 -------------------------
 guards/lib-search-16a-guard.cjs | 386 ++++++----------------------------------
 quest-bank-integrity-guard.cjs  |   6 +-
 sw.js                           |   6 +-
 5 files changed, 65 insertions(+), 657 deletions(-)
```

> **جريانُ البوّاباتِ الذي سبقَ الإيداعَ** أعطى `88/90` بحمراوَينِ: `recon` و`chatux`. وقِيسَ سببُهما فكانَ **ختمَ الشجرةِ غيرِ المودَعةِ** لا خللًا: `recon` يعدُّ «الشجرةُ نظيفةٌ» تأكيدًا من تأكيداتِه، و`chatux` يقرأُ `git diff --name-only HEAD` ويرفضُ أن يكونَ `sw.js` معدَّلًا فيه (`expected [] / actual ["sw.js"]`). وأُثبِتَ التشخيصُ بالجريانِ **بعدَ الإيداعِ**: خضراوانِ كلتاهما.

---

## ٧ · الأرضيّاتُ العشرُ — عمودان

«قبلُ» **مقيسٌ في هذا الجريانِ نفسِه**: أُنشئَتْ شجرةُ عملٍ منفصلةٌ (`git worktree`) على `1b157913` مع وصلةِ `node_modules`، وشُغِّلَتِ الحُرّاسُ العشرةُ عليها.

| الأرضيّةُ | قبلَ النزعِ (`1b157913`) | بعدَ الإيداعِ (`9fd9bd67`) | الحركةُ |
|---|---|---|---|
| `recon` | `PASS=182 WARN=1 FAIL=0` | `PASS=182 WARN=1 FAIL=0` | ثابتةٌ |
| `bankintegrity` | `76/0` | `76/0` | ثابتةٌ |
| `themecoverage` | `1341/1341` | `1341/1341` | ثابتةٌ |
| `questux` | `61/61` | `61/61` | ثابتةٌ |
| `wird` | `passed 1122 / failed 0` | `passed 1122 / failed 0` | ثابتةٌ |
| `i18nui` | `277/277` | `277/277` | ثابتةٌ |
| `attributionoutput` | `PASS=69 FAIL=0` | `PASS=69 FAIL=0` | ثابتةٌ |
| `noemptyanswer` | `PASS=356 FAIL=0` | `PASS=356 FAIL=0` | ثابتةٌ |
| `bootinvariants` | `30/0` | `30/0` | ثابتةٌ |
| حارسُ `lib-search-16a` | `210/210 PASS` | `137/137 PASS` | **`-73` — النقصُ المأذونُ في §٤ من الأمرِ، وحدَه** |

**لم تنخفضْ أرضيّةٌ لسببٍ غيرِ حارسِ ٢٥-أ المأذونِ.** ولم تُخفَّضْ عتبةٌ، ولم يُعدَّلْ ملفٌّ ذهبيٌّ، ولم يُحذَفْ حارسٌ ولا عيّنةٌ.

---

## ٨ · ما لم يُقَسْ بعلّتِه

1. **المسارُ العامُّ `/api/lib-search` ما يزالُ مفتوحًا** ولم يُقَسْ إغلاقُه: أخرجَه §٩ من الأمرِ صراحةً إلى «جولةٍ مستقلّةٍ لاحقة». والدالّةُ حيّةٌ عاملةٌ كما كانت، وهذا هو المرادُ: الأنابيبُ لمخِّ عزك لا للقارئ.
2. **لم يُقَسْ غيابُ الشاشةِ على صفحةٍ مرسومةٍ.** تأكيداتُ `G` السبعةُ والعشرونَ كانت تُقلِعُ الحزمةَ في `linkedom` وتركّبُ الشاشةَ؛ ورُفِعَتْ ولم يُوضَعْ مكانَها قياسٌ مرسومٌ يقولُ «لا شاشةَ». الغيابُ مقيسٌ على **المصدرِ والحزمةِ** (`LIB_TOKENS=0` · `F6` بصيغتِه الجديدةِ على الملفِّ كلِّه · `F7` وتطابقُ البناء)، لا على صفحةٍ حيّةٍ.
3. **لم يُقَسْ أثرُ الرفعةِ على جهازِ قارئٍ حقيقيٍّ.** أنّ `ezik-v19` يُخلي مخزنَ `ezik-v18` مقيسٌ بحارسِ `bankintegrity` وحدَه، لا بمتصفّحٍ.
4. **الأرضيّاتُ خارجَ العشرِ المسمّاةِ** قِيسَتْ نجاحًا أو سقوطًا بحصيلةِ `run-gates` جملةً، **لا بأعدادِ فحوصِها** واحدةً واحدةً.
5. **لم يُقَسْ شيءٌ في الإنتاج.** صفرُ دفعٍ، وصفرُ نشرٍ، ولا استُدعِيَ `vercel`.

---

## ٩ · الخلاصةُ

| المفتاح | القيمةُ |
|---|---|
| `ORDER_MOVED` | `True` |
| `LIB_TOKENS_LEFT_IN_APPJSX` | `0` |
| `SOURCECARD_COUNT` | `5 ⟶ 5` |
| `PIPES_UNTOUCHED` | `true` |
| `GUARD_16A_AFTER` | `137/137 PASS` (`-73` مأذونًا) |
| `CORE_BYTES` | `1794078 ⟶ 1781243` |
| `app.js` | `960680 ⟶ 947845` في ثلاثةِ مواضعَ |
| `CACHE` | `ezik-v18 ⟶ ezik-v19` |
| `sw.js` seal | `0df9ee77 ⟶ 2eb610f0` |
| `TDZ_COUNT` | `0` |
| `run-gates` | **`90/90` · `EXIT=0` · `tree after: 0 dirty path(s)`** |
| `FINAL_HEAD` | **`9fd9bd6794e29ffe346296c5f7b3c97a65b75f65` (يُودَعُ التقريرُ فوقَه بإيداعٍ مستقلٍّ لا كودَ فيه)** |
| **`PUSH_READY`** | **`YES`** — إعلانًا لا فعلًا. **لم يقعْ دفعٌ.** ينتظرُ أمرَ المالكِ الصريحَ في رسالةٍ منفصلةٍ. |

---

## ١٠ · الختمُ

---
PAYLOAD_BYTES=33855 SHA256=abc4fa25cb428c2f6d31deb2257e6dbc503f2074a29e99f6b3b61c50eac1d5da
