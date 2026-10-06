// lib/lang/fixed.js -- THE FIXED TEXTS, IN THE READER'S LANGUAGE (item 74).
// Two answers of this app are written by NO model: the hard rule on a request for pornographic content and the warm
// safety redirect for a grave hazard. The guards that own them decide by the reader's own words and answer with a fixed
// Arabic text and zero outbound calls (lib/policy/porn-request.js, lib/policy/core.js) -- and those guards are not
// rewritten here. For a reader who declared another interface language the same decision is delivered in that language
// by LOOKUP: the Arabic text the guard emitted is the key, the rendition is fixed text, and no model is asked.
import { PORN_REFUSAL_TEXT } from '../policy/porn-request.js';
import { WARM_TEMPLATES } from '../policy/core.js';

const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const TABLE = {
  en: [
    [PORN_REFUSAL_TEXT, 'This is something I do not help with, for Allah has commanded us to lower our gaze. And if there is a question in your mind that you want to understand, or something you want help to leave behind, ask me and I am with you.'],
    [WARM_TEMPLATES.SAFETY_REDIRECT, 'This is not something we should try, because mixing some materials gives off a gas that harms the chest and the eyes even when nothing can be seen. If you like reactions and fizzing, there are lovely safe experiments we can do with mama or papa \u2014 I can show you one.'],
  ],
  fa: [
    [PORN_REFUSAL_TEXT, 'در این مورد کمکی نمی‌کنم، چون خداوند ما را به فروهشتن چشم فرمان داده است. و اگر پرسشی در ذهن شماست که می‌خواهید آن را بفهمید، یا چیزی هست که می‌خواهید برای رها کردنش کمک بگیرید، از من بپرسید؛ من در کنار شما هستم.'],
    [WARM_TEMPLATES.SAFETY_REDIRECT, 'این کاری نیست که باید امتحان کنیم، زیرا مخلوط کردن برخی مواد گازی تولید می‌کند که حتی وقتی چیزی دیده نمی‌شود به سینه و چشم‌ها آسیب می‌زند. اگر واکنش‌ها و جوشش را دوست داری، آزمایش‌های زیبا و بی‌خطری هست که می‌توانیم همراه مامان یا بابا انجام دهیم — می‌توانم یکی را نشانت بدهم.'],
  ],
};
/** The fixed rendition of a guard's Arabic text in `lang`, or null when the text is not one of the fixed ones. */
export function fixedRendition(lang, arabic) {
  const rows = TABLE[lang]; if (!rows) return null;
  const k = norm(arabic);
  for (const [ar, out] of rows) if (norm(ar) === k) return out;
  return null;
}
