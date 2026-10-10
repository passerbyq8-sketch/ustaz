// lib/sync/privacy-page.js -- GENERATED from the draft of the new privacy text (items 24 + 58, phase 4).
// Served by api/sync.js at GET /api/sync?page=privacy while SYNC_SWITCH is `owner` or `all` (sync fix 5,
// 10 October: the owner's own link inside the app answered 404 under `owner`), and 404 while it is off.
// The public privacy page (privacy.html) does not change until the switch opens to everybody.
export const PRIVACY_SYNC_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>سياسة الخصوصية — مزامنة الحساب — عزك | Privacy Policy — Account sync — Ezik</title>
<meta name="description" content="سياسة خصوصية عزك لمزامنة الحساب عبر الأجهزة — Ezik privacy policy for account sync across devices.">
<style>
  :root{--ink:#161616;--blue:#12327A;--muted:#6E6E6E;--line:#E4E6EC;--paper:#FFFFFF;--wash:#F6F7FA}
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  body{margin:0;background:var(--wash);color:var(--ink);font-family:"Segoe UI","Noto Naskh Arabic","Noto Sans Arabic",Tahoma,system-ui,-apple-system,sans-serif;font-size:17px;line-height:1.95}
  .wrap{max-width:760px;margin:0 auto;padding:40px 22px 90px}
  .card{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:34px 30px}
  header{margin-bottom:34px}
  .mark{font-size:30px;font-weight:800;color:var(--blue);margin:0}
  .rule{width:54px;height:3px;background:var(--blue);border-radius:2px;margin:14px 0 16px}
  h1{font-size:22px;font-weight:700;margin:0 0 6px}
  .meta{color:var(--muted);font-size:14px;line-height:1.7;margin:0}
  .jump{display:inline-block;margin-top:16px;color:var(--blue);font-size:14px;font-weight:600;text-decoration:none;border-bottom:1px solid var(--line)}
  h2{font-size:18px;font-weight:700;color:var(--blue);margin:34px 0 10px;padding-top:22px;border-top:1px solid var(--line)}
  h2:first-of-type{border-top:0;padding-top:0;margin-top:0}
  p{margin:0 0 14px}
  ul{margin:0 0 14px;padding-inline-start:20px}
  li{margin-bottom:9px}
  a{color:var(--blue)}
  .note{background:var(--wash);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin:18px 0}
  .note p:last-child{margin-bottom:0}
  table{width:100%;border-collapse:collapse;margin:0 0 16px;font-size:15.5px;line-height:1.6}
  th,td{border:1px solid var(--line);padding:10px 12px;text-align:start;vertical-align:top}
  th{background:var(--wash);font-weight:700}
  .en{direction:ltr;text-align:left;margin-top:60px}
  .en h2,.en h1,.en p,.en li,.en td,.en th{text-align:left}
  .divider{margin:56px 0 0;border:0;border-top:3px solid var(--blue);width:54px;border-radius:2px}
  footer{margin-top:36px;padding-top:20px;border-top:1px solid var(--line);color:var(--muted);font-size:14px}
  @media (max-width:520px){body{font-size:16px}.wrap{padding:24px 14px 60px}.card{padding:24px 18px;border-radius:12px}table{font-size:14.5px}th,td{padding:8px 9px}}
</style>
</head>
<body>
<div class="wrap">
<div class="card">

<header>
  <p class="mark">عزك</p>
  <div class="rule"></div>
  <h1>سياسة الخصوصية — مزامنة الحساب عبر الأجهزة</h1>
  <p class="meta">مسوّدةٌ للإقرار — تسري يومَ تُفتَح المزامنةُ للناس، وتنضمّ عندئذٍ إلى <a href="/privacy.html">سياسة الخصوصية</a> القائمة، وكلُّ ما فيها غيرُ ما هنا يبقى كما هو.</p>
  <a class="jump" href="#english">English version ↓</a>
</header>

<h2>١ · ما الذي تغيّر</h2>
<p>إذا <strong>دخلتَ بحسابك</strong> (جوجل أو آبل)، صار ما تكتبه وتختاره في عزك <strong>محفوظًا في حسابك</strong>، فتجده على كلّ جهازٍ تدخل منه. ومن لم يدخل بحسابٍ — الضيف — فلا يتغيّر عليه شيء: بياناتُه على جهازه وحدَه كما كانت.</p>

<h2>٢ · ما يُحفَظ في حسابك، وما يبقى على جهازك</h2>
<table>
  <tr><th>يُحفَظ في حسابك (ويظهر على أجهزتك)</th><th>يبقى على كلّ جهازٍ وحده ولا يغادره</th></tr>
  <tr><td>المحادثاتُ والردودُ المفضّلة — نصًّا</td><td>الصورُ التي ترفقها بسؤالك (يظهر مكانَها على أجهزتك الأخرى علامةٌ تقول إنّها على جهازٍ آخر)</td></tr>
  <tr><td>«ملفّك»: الاسمُ وسنةُ الميلاد والجنس</td><td>مكانُ الصلاة واتّجاهُ القبلة</td></tr>
  <tr><td>الوِردُ والأذكارُ والختمةُ والتسبيح</td><td>التنبيهاتُ وساعاتُها</td></tr>
  <tr><td>مواضعُ القراءة في المصحف والمكتبة، وملاحظاتُ المكتبة</td><td>موافقتُك على استعمال الذكاء الاصطناعيّ (تُسأَل في كلّ جهاز)</td></tr>
  <tr><td>الإعدادات: الثيمُ والخطُّ واللغةُ والرئيسيّةُ وترتيبُها وطريقةُ المواقيت وتعديلاتُها والهجريُّ ومشايخُ الفتاوى</td><td>قفلُ الأهل ورمزُه، وتنزيلاتُ المصحف</td></tr>
</table>

<h2>٣ · كيف نحفظها</h2>
<ul>
  <li><strong>مشفّرة:</strong> كلُّ سجلٍّ يُشفَّر على خادمنا قبل أن يُخزَّن، بمفتاحٍ سرّيٍّ لا يُخزَّن معه. ومن وصل إلى المخزن وحدَه لا يقرأ منه شيئًا.</li>
  <li><strong>لا يراها غيرُك:</strong> لا يصل إلى بياناتك إلّا جلسةُ دخولك أنت. لا لوحةَ تعرضها لأحد، ولا نقرؤها نحن.</li>
  <li><strong>لا تحليلَ ولا تدريب:</strong> لا نحلّل بياناتك، ولا نستعملها لتدريب أيّ نموذج، ولا نبيعها ولا نشاركها.</li>
  <li><strong>سجلُّ التشغيل لا يمسّها:</strong> السجلُّ الذي نقيس به عملَ التطبيق لا يحمل نصَّ سؤالك، ولا يقرأ بيانات حسابك.</li>
  <li><strong>المدّة:</strong> تبقى حتّى تحذفها أنت.</li>
</ul>

<h2>٤ · ذاكرةُ عزك عنك</h2>
<p>يراعي عزك <strong>الجنسَ الذي كتبتَه بيدك في «ملفّك»</strong> فيخاطبك بصيغة المذكّر أو المؤنّث. <strong>يتغيّر الخطابُ وحدَه، لا الحكمُ الشرعيّ.</strong> ولا يذكر اسمَك في الجواب، ولا يحفظ مذهبًا، ولا يستنتج عنك شيئًا من محادثاتك.</p>

<h2>٥ · حقوقك — بزرٍّ من داخل التطبيق</h2>
<ul>
  <li><strong>«حذف كل البيانات»</strong> يمسحها من جهازك ومن حسابك فورًا، ويبقى حسابُك فارغًا.</li>
  <li><strong>«حذف الحساب»</strong> يمسح الحسابَ وكلَّ ما فيه فورًا.</li>
  <li><strong>«نزّل بياناتي»</strong> يعطيك ملفًّا فيه كلُّ ما في حسابك، ومنه المحادثات.</li>
  <li><strong>«اربط حسابك الآخر»</strong> يجمع حسابَي جوجل وآبل في حسابٍ واحد — لأنّ دخول آبل قد يُخفي بريدك فلا نعرف أنّهما لك.</li>
  <li><strong>الخروج</strong> يمسح من الجهاز ما هو محفوظٌ في حسابك، ويبقيه في الحساب، ويبقي ما يخصّ الجهاز.</li>
</ul>
<p>وللسؤال عن بياناتك: <a href="/support.html">صفحة الدعم</a>، أو عنوانُ التواصل في <a href="/privacy.html">سياسة الخصوصية</a>.</p>

<hr class="divider" id="english">

<div class="en" dir="ltr" lang="en">
<h1>Privacy Policy — Account sync across devices</h1>
<p class="meta">A draft for approval. It takes effect on the day sync opens to everyone, and is then joined to the current <a href="/privacy.html">Privacy Policy</a>; everything there that is not covered here stays as it is.</p>

<h2>1 · What changed</h2>
<p>If you <strong>sign in with your account</strong> (Google or Apple), what you write and choose in Ezik is <strong>kept in your account</strong>, so you find it on every device you sign in on. If you do not sign in — a guest — nothing changes: your data stays on your device alone, as before.</p>

<h2>2 · What is kept in your account, and what stays on your device</h2>
<table>
  <tr><th>Kept in your account (and shown on your devices)</th><th>Stays on each device alone and never leaves it</th></tr>
  <tr><td>Conversations and favourite replies — as text</td><td>Images you attach to a question (your other devices show a mark saying the image is on another device)</td></tr>
  <tr><td>Your profile: name, birth year and gender</td><td>Your prayer location and the qibla</td></tr>
  <tr><td>Wird, adhkar, khatmah and tasbih</td><td>Reminders and their times</td></tr>
  <tr><td>Reading positions in the Mushaf and the library, and library notes</td><td>Your consent to the use of AI (asked on each device)</td></tr>
  <tr><td>Settings: theme, font, language, home screen and its order, prayer-time method and adjustments, Hijri date, fatwa scholars</td><td>The parental lock and its code, and Mushaf downloads</td></tr>
</table>

<h2>3 · How we keep it</h2>
<ul>
  <li><strong>Encrypted:</strong> every record is encrypted on our server before it is stored, with a secret key that is not stored with it. Someone who reaches the store alone can read nothing in it.</li>
  <li><strong>Seen by no one else:</strong> only your own sign-in session reaches your data. No dashboard shows it to anyone, and we do not read it.</li>
  <li><strong>No analysis, no training:</strong> we do not analyse your data, use it to train any model, sell it or share it.</li>
  <li><strong>The operational log does not touch it:</strong> the log we use to measure how the app works carries no question text and does not read your account data.</li>
  <li><strong>How long:</strong> it stays until you delete it.</li>
</ul>

<h2>4 · What Ezik remembers about you</h2>
<p>Ezik takes into account <strong>the gender you wrote yourself in your profile</strong> and addresses you in the masculine or the feminine. <strong>Only the form of address changes, never the ruling.</strong> It does not put your name in the answer, keeps no madhhab, and infers nothing about you from your conversations.</p>

<h2>5 · Your rights — one button inside the app</h2>
<ul>
  <li><strong>"Delete all data"</strong> erases it from your device and from your account at once; your account stays, empty.</li>
  <li><strong>"Delete account"</strong> erases the account and everything in it at once.</li>
  <li><strong>"Download my data"</strong> gives you a file with everything in your account, conversations included.</li>
  <li><strong>"Link your other account"</strong> joins your Google and Apple accounts into one — because Apple sign-in may hide your email, so we cannot tell they are both yours.</li>
  <li><strong>Signing out</strong> removes from the device what is kept in your account, keeps it in the account, and keeps what belongs to the device.</li>
</ul>
<p>Questions about your data: the <a href="/support.html">support page</a>, or the contact address in the <a href="/privacy.html">Privacy Policy</a>.</p>
</div>

<footer>عزك · Ezik</footer>
</div>
</div>
</body>
</html>
`;
