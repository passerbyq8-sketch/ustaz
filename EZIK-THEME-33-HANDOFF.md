# عزك — تسليم ثيم إستانة ٣٣ (Istana 33 handoff)

**التصميم انتهى بالكامل.** كل شاشة في التطبيق وفي اللعبة صارت على هوية إستانة ٣٣.
هذا الملف هو نقطة التسليم للجلسة التالية، والجلسة التالية **مخصّصة لإصلاح ردود عزك وعقله فقط،
وليست للثيم**.

---

## الحالة عند التسليم

| البند | القيمة |
|---|---|
| الفرع | `main` |
| Gates | 27/27 · EXIT=0 |
| Recon | PASS=111 · WARN=6 · FAIL=0 |
| theme-coverage-guard | 1065 فحصًا · كلها خضراء |
| index.html | CRLF فقط · bareLF=0 · بلا BOM |
| quest.html | LF فقط · بلا BOM |

الـHEAD النهائي مسجَّل في رسالة الالتزام الأخيرة على `main`؛ ما بعده لم يُلمس شيء.

---

## شاشات إستانة ٣٣ — القائمة الكاملة

### index.html — ١٢ شاشة، صفر legacy

| الشاشة | المفردات |
|---|---|
| loading | `.ezload-*` |
| onboarding | `.ezonb-*` |
| chat | `.ezc-*` |
| call | `.ezcall-*` |
| favorites | `.ezfav-*` |
| parentGate | `.ezgate-*` |
| parentDashboard | `.ezparent-*` |
| home | `.ezist-*` |
| adhkar | `.ezia-*` |
| memorize / settings | `.ezsh-*` (الغلاف المشترك) |
| mushaf | `.ezmr-*` |

### الحواجز الثلاثة — كلها إستانة

`SpendGate` · `ChildVoiceNotice` · `UnlockSheet` — جميعها على عائلة البطاقة `.ezgate-*`.

### quest.html — ١٧ view، صفر legacy

`map` · `_regionCard` · `region` · `startStation` · `challenges` · `_modeCard` · `daily` ·
`speed` · `teamsSetup` · `teamsCats` · `teamsTrack` · `teamsAsk` · `teamsEnd` · `book` ·
`profile` · `settings` · `inspect` — على `.ezq-*` وعلى نظام الرموز نفسه الذي تستخدمه الخريطة.

**قاعدة الهوية:** كل مفردة مستقلة، لا يصل أيّ selector منها إلى `html` أو `body` أو `:root`،
ولا واحدة منها تُعلن تدرّجًا أو نقشًا أو صورة أو pseudo-element فوق المحتوى، ولا واحدة منها
تُصرّح بلونٍ خاصّ بها — الألوان كلّها من tokens.

---

## قفل صريح لجلسة إصلاح الردود

### يحقّ لها أن تلمس

- `api/**` — مسارات الردود والـprompts والـretrieval.
- `lib/**` — المكتبات التي تخدمها.
- `quest-data/**` فقط إن كان الإصلاح عن محتوى الأسئلة وبطلبٍ صريح.
- الـguards الخاصّة بالردود عند الحاجة:
  `classifier-guard.cjs` · `attribution-guard.cjs` · `source-registry-guard.cjs` ·
  `brave-query-guard.cjs` · `smart-retrieval-guard.cjs` · `claim-guard.cjs` · `referral-guard.cjs`.

### لا يحقّ لها أن تلمس — إلا بطلبٍ مستقلّ وصريح

- **theme CSS**: كتلة `<style>` في `index.html` و`quest.html`، وكل مفردة `.ez*`.
- **بنية أيّ شاشة**: أيّ `className="theme-dark ezhome ez…"` أو أيّ rail/wrap/card/dock.
- **كائن الأنماط `s`** في `index.html`.
- **هندسة المصحف**: `pgViewport` · `pgStrip` · `pgSlot` · `MADINA_*` · صور WebP · بديل SVG ·
  `mushaf-layout.json` · `assets/madina-hafs/**`.
- **البيانات**: `quran-uthmani.json` · `adhkar.json` · `worship-*.json` · `quest-data/**` ·
  كل ملفّ golden.
- **البنية التحتية**: `sw.js` · `manifest.json` · `vercel.json` · `package*.json` · `gates.json`.
- **جدول الرجوع والتنقّل**: `ezikBackTarget` · `EZIK_ROOT_SCREENS` · `EZIK_SHEET_SCREENS`.
- **ترتيب الحواجز**: SpendGate ← childVoiceBlocked ← hasFounderToken ← CallScreen.

---

## مفاتيح التخزين — لا تُمسّ ولا تُهاجَر

```
child_profile              ملف الطفل
disclosureAck              إقرار أوّل تشغيل
murabbi_theme_v1           فاتح/داكن
ezik_visual_theme_v2       هوية التصميم (istana_33)
ezik_chats_v1              فهرس المحادثات
ezik_chat_v1_<id>          جسم كل محادثة
ezik_favorite_replies_v1   الردود المفضلة
ezik_reading_prefs_v1      تفضيلات القراءة
parent_pin_hash            بصمة رمز لوحة الأهل
spend_gate_unlock          قفل الإنفاق
mrb_device_v1              معرّف الجهاز
mrb_founder_v1             رمز الفتح
directConvoLocked          قفل المحادثة المباشرة
tashkeel_v1                التشكيل
mushaf_bookmark_v1 · mushaf_last_page_v1 · mushaf_wird_target_v1 · mushaf_wird_day_v1
adhkar_daily_progress_v1 · adhkar_favorites_v1 · adhkar_usage_v1
murabbi.quest.v1           حالة اللعبة (Store)
```

لا تُضِف مفتاحًا جديدًا ولا migration بلا طلبٍ صريح. `theme-coverage-guard` يرصد الاثنين.

---

## المعاينة المحلية

`/api/*` **لا يعمل** في المعاينة المحلية. فراغ المحادثة أو صمت المكالمة محليًّا ليس عطلًا في
الواجهة. للفحص البصري استُخدم Chrome معزول عبر CDP من مجلّد مؤقّت خارج المستودع، مع اعتراض
الشبكة خارجيًّا فقط — لا mock ولا fixture ولا خادم اختبار داخل المستودع، و`theme-coverage-guard`
يتحقّق من ذلك.

عنوان المعاينة المستخدم: `http://127.0.0.1:8787/`.

---

## ملاحظة غير منفَّذة

أثناء الفحص البصري لم يُرصَد أيّ خلل في الواجهة. أيّ سلوك يخصّ الردود لم يُفحَص في هذه الجلسة
لأنّ `/api/*` معطَّل محليًّا — وهو موضوع الجلسة التالية، لا هذه.

---

## الجلسة التالية

**إصلاح الردود وعقل عزك فقط.** لا ثيم، ولا بنية شاشات، ولا هندسة مصحف، ولا بيانات.
إن ظهر ما يستدعي تعديلًا في الثيم، سجّله ولا تنفّذه: يحتاج طلبًا مستقلًّا.
