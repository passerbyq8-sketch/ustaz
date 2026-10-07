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
  fr: [
    [PORN_REFUSAL_TEXT, 'Ce n’est pas quelque chose pour lequel je t’aide, car Allah nous a ordonné de baisser le regard. Et si tu as dans l’esprit une question que tu veux comprendre, ou quelque chose dont tu veux de l’aide pour t’en détacher, demande-moi et je suis avec toi.'],
    [WARM_TEMPLATES.SAFETY_REDIRECT, 'Ce n’est pas quelque chose que nous devons essayer, car le mélange de certaines substances dégage un gaz qui nuit à la poitrine et aux yeux même quand on ne voit rien. Si tu aimes les réactions et les bulles, il y a de beaux essais sans danger que nous pouvons faire avec maman ou papa \u2014 je peux t’en montrer un.'],
  ],
  fa: [
    [PORN_REFUSAL_TEXT, 'در این مورد کمکی نمی‌کنم، چون خداوند ما را به فروهشتن چشم فرمان داده است. و اگر پرسشی در ذهن شماست که می‌خواهید آن را بفهمید، یا چیزی هست که می‌خواهید برای رها کردنش کمک بگیرید، از من بپرسید؛ من در کنار شما هستم.'],
    [WARM_TEMPLATES.SAFETY_REDIRECT, 'این کاری نیست که باید امتحان کنیم، زیرا مخلوط کردن برخی مواد گازی تولید می‌کند که حتی وقتی چیزی دیده نمی‌شود به سینه و چشم‌ها آسیب می‌زند. اگر واکنش‌ها و جوشش را دوست داری، آزمایش‌های زیبا و بی‌خطری هست که می‌توانیم همراه مامان یا بابا انجام دهیم — می‌توانم یکی را نشانت بدهم.'],
  ],
  id: [
    [PORN_REFUSAL_TEXT, 'Ini adalah hal yang tidak aku bantu, karena Allah telah memerintahkan kita untuk menundukkan pandangan. Dan jika ada pertanyaan di benakmu yang ingin kamu pahami, atau sesuatu yang ingin kamu tinggalkan dengan bantuan, tanyakan kepadaku dan aku bersamamu.'],
    [WARM_TEMPLATES.SAFETY_REDIRECT, 'Ini bukan sesuatu yang boleh kita coba, karena mencampur beberapa bahan menghasilkan gas yang merusak dada dan mata meskipun tidak terlihat apa-apa. Jika kamu suka reaksi dan busa, ada percobaan menyenangkan yang aman yang bisa kita lakukan bersama mama atau papa — aku bisa menunjukkan salah satunya.'],
  ],
  ur: [
    [PORN_REFUSAL_TEXT, 'میں اس معاملے میں مدد نہیں کرتا، کیونکہ اللہ نے ہمیں نگاہیں نیچی رکھنے کا حکم دیا ہے۔ اور اگر آپ کے ذہن میں کوئی سوال ہے جسے آپ سمجھنا چاہتے ہیں، یا کوئی چیز ہے جسے چھوڑنے میں آپ مدد چاہتے ہیں، تو مجھ سے پوچھیں، میں آپ کے ساتھ ہوں۔'],
    [WARM_TEMPLATES.SAFETY_REDIRECT, 'یہ کوئی ایسی چیز نہیں جسے ہمیں آزمانا چاہیے، کیونکہ کچھ مادوں کو ملانے سے ایسی گیس نکلتی ہے جو سینے اور آنکھوں کو نقصان پہنچاتی ہے چاہے کچھ نظر نہ آئے۔ اگر آپ کو ردِعمل اور جھاگ پسند ہیں تو کچھ خوبصورت اور محفوظ تجربات ہیں جو ہم امی یا ابو کے ساتھ کر سکتے ہیں — میں آپ کو ایک دکھا سکتا ہوں۔'],
  ],
  bn: [
    [PORN_REFUSAL_TEXT, 'এ বিষয়ে আমি সাহায্য করি না, কারণ আল্লাহ আমাদের দৃষ্টি নত রাখার আদেশ দিয়েছেন। আর আপনার মনে যদি এমন কোনো প্রশ্ন থাকে যা আপনি বুঝতে চান, অথবা কোনো কিছু ছাড়তে সাহায্য চান, তবে আমাকে জিজ্ঞাসা করুন, আমি আপনার সঙ্গে আছি।'],
    [WARM_TEMPLATES.SAFETY_REDIRECT, 'এটি এমন কিছু নয় যা আমাদের চেষ্টা করা উচিত, কারণ কিছু উপাদান মেশালে এমন গ্যাস তৈরি হয় যা কিছু দেখা না গেলেও বুক ও চোখের ক্ষতি করে। আপনি যদি বিক্রিয়া আর ফেনা ভালোবাসেন, তবে আম্মু বা আব্বুর সঙ্গে করার মতো সুন্দর ও নিরাপদ কিছু পরীক্ষা আছে — আমি আপনাকে একটি দেখাতে পারি।'],
  ],
  tr: [
    [PORN_REFUSAL_TEXT, 'Bu konuda yardımcı olmuyorum, çünkü Allah bize gözlerimizi sakınmayı emretti. Ve aklınızda anlamak istediğiniz bir soru varsa ya da bırakmak için yardım istediğiniz bir şey varsa, bana sorun, ben sizinleyim.'],
    [WARM_TEMPLATES.SAFETY_REDIRECT, 'Bu denememiz gereken bir şey değil, çünkü bazı maddeleri karıştırmak, hiçbir şey görülmese bile göğse ve gözlere zarar veren bir gaz çıkarır. Tepkimeleri ve köpürmeyi seviyorsanız, annenizle ya da babanızla yapabileceğimiz güzel ve güvenli deneyler var — size birini gösterebilirim.'],
  ],
  ha: [
    [PORN_REFUSAL_TEXT, 'Wannan ba abin da nake taimakawa a kai ba ne, domin Allah ya umarce mu da mu runtse idanunmu. Kuma idan kana da wata tambaya a zuciyarka da kake so ka fahimta, ko wani abu da kake so a taimake ka ka bar shi, ka tambaye ni, ina tare da kai.'],
    [WARM_TEMPLATES.SAFETY_REDIRECT, 'Wannan ba abin da ya kamata mu gwada ba ne, domin haɗa wasu abubuwa yana fitar da iskar gas da ke cutar da ƙirji da idanu ko da ba a ga komai ba. Idan kana son tasirin sinadarai da kumfa, akwai kyawawan gwaje-gwaje masu aminci da za mu iya yi tare da mama ko baba — zan iya nuna maka ɗaya.'],
  ],
};
/** The fixed rendition of a guard's Arabic text in `lang`, or null when the text is not one of the fixed ones. */
export function fixedRendition(lang, arabic) {
  const rows = TABLE[lang]; if (!rows) return null;
  const k = norm(arabic);
  for (const [ar, out] of rows) if (norm(ar) === k) return out;
  return null;
}
