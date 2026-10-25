// lib/policy/support-contact.js -- POSTSHIP ITEM 4 -- 2026-10-24 (row 11).
//
// THE OWNER'S ORDER OF 18 OCTOBER: whoever asks Ezik how to reach its support is answered with the owner's e-mail.
// A fixed text, no model, no source card (it is not a shari'a answer), served from the same seat as the other fixed
// texts (api/ask.js, beside the hazard redirect and the pornography refusal) and rendered for the open languages by
// lookup (lib/lang/fixed.js). Logged on the canned path with the flag `support_contact`.
//
// THE MATCHER IS NARROW ON PURPOSE. «الدعم» is also charity and backing («ما حكم دعم الظالم؟», «كيف أدعم الفقراء؟»), and
// "support" is also a verb about people ("How can I support my parents?"). So a question opens this answer only when
//   (a) it reaches FOR the support desk: a contact word or a channel word next to «الدعم» as a noun («الدعم» / «الدعم الفني»),
//       or "support" as a noun after a contact word / before a channel word; or
//   (b) it reports a problem, a bug or a suggestion ABOUT THE APP («التطبيق» / «البرنامج» / «عزك» / "the app" / "Ezik")
//       and asks where or to whom to send it;
// and it is short (a compound question that also asks something else is not taken over by this text).
// POSTSHIP FIX2 ITEM 1 -- 2026-10-25: the Arabic a translated question arrives in. The problem / suggestion / note words
// are taken in the plural and with a possessive («ملاحظاتي», «اقتراحي», «مشاكلنا»), «رأيي» with the speaker's yaa alone
// (never «رأي»: «ما رأي الشيخ…» is a question about a scholar); «دعم» in construct with عزك / التطبيق («دعم عزك») is the
// desk as «الدعم» is; and the team addressed by name («فريق عزك» · «المطورين» · «أصحاب التطبيق» · «القائمين على
// التطبيق») stands where «الدعم» stands. api/ask.js reads the reader's own text, before the translation, as well.
// POSTSHIP FIX3 ITEM 2 -- 2026-10-25: the reader who writes Persian or Urdu. `fold` takes their letters to the Arabic
// counterparts (the kaf «ک» and the yaa «ی» / «ے» first, so «عزک» is «عزك»); «تطبيق» / «برنامج» without the article count
// when Ezik's name follows, and the name in Latin letters («Ezik») counts; and a Persian and an Urdu matcher read the
// reader's own text, as narrow as the Arabic and English ones: a contact or channel word next to the support desk
// («پشتیبانی» / «سپورٹ»), or a problem / suggestion about the app (Ezik named) with where / to whom / send. They run
// only on a text that carries a Persian or Urdu letter, so an Arabic text is read exactly as before.
// Not in this item: introducing Ezik when asked «من أنت» -- that waits for the owner's text.

export const SUPPORT_EMAIL = 'Passerbyq8@gmail.com';
export const SUPPORT_CONTACT_TEXT = 'للتواصلِ مع دعمِ عزك، راسِلْنا على البريد:\n' + SUPPORT_EMAIL;

const MAX_WORDS = 14;

// FIX3 item 2: the letters only, so the Persian and Urdu patterns below are folded by the same rule as the text.
// Persian / Urdu to Arabic: kaf «ک ڪ» -> «ك»; yaa «ی ې ۍ ێ ے» -> «ي»; haa «ہ ھ ە» -> «ه» («ۀ» «ۃ» «ۓ» reach these through
// NFKC, their hamza is a mark); «ۆ ۇ ۈ ۋ» -> «و»; «ٹ» -> «ت», «ڈ» -> «د», «ڑ» -> «ر», «ں» -> «ن»; and the four with no
// Arabic letter of their own to the nearest one: «پ» -> «ب», «چ» -> «ج», «ژ» -> «ز», «گ» -> «ك».
const FA_UR_LETTER = /[پچژکڪگیېۍێےہھەۆۇۈۋٹڈڑں]/u;
function foldLetters(text) {
  return String(text == null ? '' : text)
    .normalize('NFKC')
    .replace(/[ً-ٰٟـ]/gu, '')
    .replace(/[آأإٱ]/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/ة/gu, 'ه')
    .replace(/[کڪگ]/gu, 'ك')
    .replace(/[یېۍێے]/gu, 'ي')
    .replace(/[ہھە]/gu, 'ه')
    .replace(/[ۆۇۈۋ]/gu, 'و')
    .replace(/ٹ/gu, 'ت').replace(/ڈ/gu, 'د').replace(/ڑ/gu, 'ر').replace(/ں/gu, 'ن')
    .replace(/پ/gu, 'ب').replace(/چ/gu, 'ج').replace(/ژ/gu, 'ز');
}

function fold(text) {
  return foldLetters(text)
    .replace(/[^\p{L}\p{N}@.]+/gu, ' ')
    .trim()
    .toLowerCase();
}

// Arabic. «الدعم» as the desk: the article is required (the verb «أدعم» and the bare masdar «دعم X» are charity).
const AR_DESK = '(?:(?:لل|بال|ال)دعم(?: الفني)?|[لب]?دعم (?:تطبيق عزك|عزك|التطبيق)(?: الفني)?)';
// the people behind the app, addressed (FIX2 item 1): «المطورين» alone only at the end or before the app's name
const AR_TEAM = '(?:[لب]?فريق (?:تطبيق عزك|عزك|التطبيق)|(?:لل|ال)مطورين(?=$| (?:لعزك|للتطبيق|عزك|التطبيق|في عزك|في التطبيق))|[لب]?مطوري (?:عزك|التطبيق)|ل?اصحاب (?:عزك|التطبيق)|(?:لل|ال)قائمين علي (?:عزك|التطبيق))';
const AR_REACH = '(?:اتواصل|تواصل|التواصل|نتواصل|اكلم|كلم|اكلّم|نكلم|اراسل|راسل|مراسله|اتصل|الاتصال|اوصل|اكتب|ارسل|ابعث|اشتكي)';
const AR_CHANNEL = '(?:ايميل|الايميل|اميل|بريد|البريد|رقم|واتساب|حساب|عنوان|وسيله)';
// FIX3 item 2: «تطبيق» / «برنامج» without the article when Ezik's name follows, and the name in Latin letters
const AR_APP = '(?:التطبيق|للتطبيق|بالتطبيق|البرنامج|للبرنامج|عزك|لعزك|بعزك|التطبيقه|[لب]?(?:تطبيق|برنامج) (?:عزك|ezik)|ezik)';
// FIX2 item 1: plural and possessive for problem / suggestion / note; «رأيي» (the speaker's) only
const AR_POSS = '(?:ي|نا|ك|كم|ه|ها|هم)?';
const AR_PROBLEM = '(?:(?:مشكله|مشكلات|مشاكل|اقتراح|اقتراحات|ملاحظه|ملاحظات)' + AR_POSS + '|(?:مشكلت|ملاحظت)(?:ي|نا|ك|كم|ه|ها|هم)|رايي|خطا|غلط|خلل|عطل|شكوي|بلاغ|ثغره)';
const AR_WHERE = '(?:وين|اين|لمن|مين|كيف|من|لوين|ابلغ|بلغ|اقدم|ارسل|ارسله|ارسلها|ابعث|ابعثه|اوصل|ارسال|لارسال)';
const AR_RE = [
  new RegExp('(?:^| )' + AR_REACH + '(?: \\S+){0,3} ' + AR_DESK + '(?: |$)', 'u'),
  new RegExp('(?:^| )' + AR_CHANNEL + '(?: \\S+){0,2} ' + AR_DESK + '(?: |$)', 'u'),
  new RegExp('(?:^| )' + AR_DESK + '(?: \\S+){0,2} ' + AR_CHANNEL + '(?: |$)', 'u'),
  new RegExp('(?:^| )' + AR_REACH + '(?: \\S+){0,3} ' + AR_TEAM + '(?: |$)', 'u'),
  new RegExp('(?:^| )' + AR_CHANNEL + '(?: \\S+){0,2} ' + AR_TEAM + '(?: |$)', 'u'),
  new RegExp('(?:^| )' + AR_TEAM + '(?: \\S+){0,2} ' + AR_CHANNEL + '(?: |$)', 'u'),
];
const AR_APP_REPORT = [
  new RegExp('(?:^| )' + AR_PROBLEM + '(?: |$)', 'u'),
  new RegExp('(?:^| )' + AR_APP + '(?: |$)', 'u'),
  // FIX2 item 1: a channel word asks where as well («هل يوجد بريد لإرسال ملاحظاتي حول التطبيق؟»)
  new RegExp('(?:^| )(?:' + AR_WHERE + '|' + AR_CHANNEL + ')(?: |$)', 'u'),
];

// Persian and Urdu (FIX3 item 2), written as the reader writes them and folded by the text's own rule. The desk is the
// support noun («پشتیبانی» / «سپورٹ», also "backing" in both): it opens the answer only beside a contact or a channel
// word. The app is Ezik named («عزک» / «Ezik», alone or after «برنامه» / «اپلیکیشن» / «ایپ» …); a bare «برنامه» is also
// a plan or a schedule, so it is not the app here.
const FAUR = (s) => foldLetters(s).toLowerCase();
const NAME = '(?:عزک|ezik)';
const FA_DESK = FAUR('(?:پشتیبانی(?: فنی)?|تیم (?:پشتیبانی|' + NAME + ')|(?:سازندگان|توسعه دهندگان) (?:برنامه )?' + NAME + ')');
const FA_REACH = FAUR('(?:تماس|ارتباط|پیام|بنویسم|صحبت)');
const FA_CHANNEL = FAUR('(?:ایمیل|ای میل|رایانامه|شماره|آدرس|راه ارتباطی|واتساپ)');
const FA_APP = FAUR('(?:(?:برنامه|اپ|اپلیکیشن|نرم افزار)(?: ی)? ' + NAME + '|' + NAME + ')');
const FA_PROBLEM = FAUR('(?:مشکل|مشکلی|مشکلات|ایراد|ایرادی|خطا|خطایی|باگ|پیشنهاد|پیشنهادم|پیشنهادی|پیشنهادها|پیشنهادات|نظرم|انتقاد|انتقادم|شکایت|شکایتم)');
const FA_WHERE = FAUR('(?:کجا|چه کسی|کی|چطور|چگونه|بفرستم|بفرستیم|ارسال|گزارش)');
const UR_DESK = FAUR('(?:سپورٹ(?: ٹیم)?|کسٹمر سپورٹ|ہیلپ ڈیسک|ٹیم ' + NAME + ')');
const UR_REACH = FAUR('(?:رابطہ|رابطے|میسج|لکھوں|کال)');
const UR_CHANNEL = FAUR('(?:ای میل|ایمیل|نمبر|پتہ|واٹس ایپ)');
const UR_APP = FAUR('(?:(?:ایپ|ایپلیکیشن|پروگرام|سافٹ ویئر) ' + NAME + '|' + NAME + '(?: (?:ایپ|ایپلیکیشن))?)');
const UR_PROBLEM = FAUR('(?:مسئلہ|مسئلے|مسائل|خرابی|غلطی|بگ|شکایت|تجویز|تجاویز|مشورہ|مشورے|اپنی رائے|میری رائے)');
const UR_WHERE = FAUR('(?:کہاں|کس کو|کسے|کس سے|کیسے|بھیجوں|بھیجیں|بتاؤں|بتائیں|رپورٹ)');
const nearRe = (a, b, n) => [new RegExp('(?:^| )' + a + '(?: \\S+){0,' + n + '} ' + b + '(?: |$)', 'u'), new RegExp('(?:^| )' + b + '(?: \\S+){0,' + n + '} ' + a + '(?: |$)', 'u')];
const wordRe = (a) => new RegExp('(?:^| )' + a + '(?: |$)', 'u');
const FA_UR_RE = [...nearRe(FA_REACH, FA_DESK, 3), ...nearRe(FA_CHANNEL, FA_DESK, 2), ...nearRe(UR_REACH, UR_DESK, 3), ...nearRe(UR_CHANNEL, UR_DESK, 2)];
const FA_UR_APP_REPORT = [[FA_PROBLEM, FA_APP, FA_WHERE].map(wordRe), [UR_PROBLEM, UR_APP, UR_WHERE].map(wordRe)];

// English.
const EN_REACH = '(?:contact|reach|email|e mail|mail|message|write to|talk to|speak to|get in touch with|get hold of)';
const EN_SUPPORT_NOUN = 'support(?: team| desk| staff| service| email| address| contact)?';
const EN_RE = [
  new RegExp('\\b' + EN_REACH + '(?: \\w+){0,3} (?:customer |tech |technical |app |ezik )?' + EN_SUPPORT_NOUN + '(?: (?:team|please|now|here))?$', 'u'),
  new RegExp('\\bsupport (?:email|e mail|address|contact|team|desk|number|line)\\b', 'u'),
  new RegExp('\\b(?:customer|tech|technical|app|ezik) support\\b', 'u'),
];
const EN_APP_REPORT = [
  /\b(?:bug|bugs|problem|problems|issue|issues|error|errors|glitch|crash|crashes|suggestion|feedback|complaint)\b/u,
  /\b(?:app|application|ezik|the program)\b/u,
  /\b(?:report|reporting|who|where|whom|send|talk|tell|contact)\b/u,
];

/** True when the reader is asking how to reach Ezik's support (see the header for what does NOT open it). Called on
 *  the reader's own text and on its Arabic translation alike (api/ask.js). */
export function isSupportContactRequest(text) {
  const t = fold(text);
  if (!t) return false;
  if (t.split(' ').length > MAX_WORDS) return false;
  if (/[a-z]/u.test(t)) {
    if (EN_RE.some((re) => re.test(t))) return true;
    if (EN_APP_REPORT.every((re) => re.test(t))) return true;
  }
  if (AR_RE.some((re) => re.test(t))) return true;
  if (AR_APP_REPORT.every((re) => re.test(t))) return true;
  // FIX3 item 2: Persian and Urdu, on a text that carries one of their letters
  if (FA_UR_LETTER.test(String(text))) {
    if (FA_UR_RE.some((re) => re.test(t))) return true;
    if (FA_UR_APP_REPORT.some((set) => set.every((re) => re.test(t)))) return true;
  }
  return false;
}
