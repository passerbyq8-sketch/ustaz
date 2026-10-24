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
// Not in this item: introducing Ezik when asked «من أنت» -- that waits for the owner's text.

export const SUPPORT_EMAIL = 'Passerbyq8@gmail.com';
export const SUPPORT_CONTACT_TEXT = 'للتواصلِ مع دعمِ عزك، راسِلْنا على البريد:\n' + SUPPORT_EMAIL;

const MAX_WORDS = 14;

function fold(text) {
  return String(text == null ? '' : text)
    .normalize('NFKC')
    .replace(/[ً-ٰٟـ]/gu, '')
    .replace(/[آأإٱ]/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/ة/gu, 'ه')
    .replace(/[^\p{L}\p{N}@.]+/gu, ' ')
    .trim()
    .toLowerCase();
}

// Arabic. «الدعم» as the desk: the article is required (the verb «أدعم» and the bare masdar «دعم X» are charity).
const AR_DESK = '(?:لل|بال|ال)دعم(?: الفني)?';
const AR_REACH = '(?:اتواصل|تواصل|التواصل|نتواصل|اكلم|كلم|اكلّم|نكلم|اراسل|راسل|مراسله|اتصل|الاتصال|اوصل|اكتب|ارسل|ابعث|اشتكي)';
const AR_CHANNEL = '(?:ايميل|الايميل|اميل|بريد|البريد|رقم|واتساب|حساب|عنوان|وسيله)';
const AR_APP = '(?:التطبيق|للتطبيق|بالتطبيق|البرنامج|للبرنامج|عزك|لعزك|بعزك|التطبيقه)';
const AR_PROBLEM = '(?:مشكله|مشكلتي|مشاكل|خطا|غلط|خلل|عطل|اقتراح|ملاحظه|شكوي|بلاغ|ثغره)';
const AR_WHERE = '(?:وين|اين|لمن|مين|كيف|من|لوين|ابلغ|بلغ|اقدم|ارسل|ارسله|ارسلها|ابعث|ابعثه|اوصل)';
const AR_RE = [
  new RegExp('(?:^| )' + AR_REACH + '(?: \\S+){0,3} ' + AR_DESK + '(?: |$)', 'u'),
  new RegExp('(?:^| )' + AR_CHANNEL + '(?: \\S+){0,2} ' + AR_DESK + '(?: |$)', 'u'),
  new RegExp('(?:^| )' + AR_DESK + '(?: \\S+){0,2} ' + AR_CHANNEL + '(?: |$)', 'u'),
];
const AR_APP_REPORT = [
  new RegExp('(?:^| )' + AR_PROBLEM + '(?: |$)', 'u'),
  new RegExp('(?:^| )' + AR_APP + '(?: |$)', 'u'),
  new RegExp('(?:^| )' + AR_WHERE + '(?: |$)', 'u'),
];

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

/** True when the reader is asking how to reach Ezik's support (see the header for what does NOT open it). */
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
  return false;
}
