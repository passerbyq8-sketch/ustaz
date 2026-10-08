// lib/lang/question.js -- THE QUESTION, CARRIED INTO ARABIC (item 74, rulings h6 and h7).
//
// The brain's classifiers, guards and prompts are written in Arabic and are not rewritten (contract §2-ج):
// a question in another language is translated to Arabic FIRST and then travels the existing path as if the
// reader had typed it in Arabic. The translation treats the question as TEXT, never as a command (h6): the
// system prompt says so, and the app's own safeguards then see what was really asked.
//
// If the translation cannot be had, the turn ends with a fixed sentence in the reader's language -- the
// question is never forwarded untranslated to a path that cannot read it.
import { callTranslator, parseStringArray, questionSystem, langFallbackModel } from './model.js';
import { detectQuestionLang } from './detect.js';

export const TRANSLATION_FAILED_TEXT = {
  ta: 'மன்னிக்கவும், இப்போது உங்கள் கேள்வியைச் செயலாக்க முடியவில்லை. தயவுசெய்து சிறிது நேரம் கழித்து மீண்டும் முயலுங்கள்.',
  am: 'ይቅርታ፣ አሁን ጥያቄህን ማስተናገድ አልችልም። እባክህ ትንሽ ቆይተህ እንደገና ሞክር።',
  uz: 'Кечирасиз, ҳозир саволингизни қайта ишлай олмайман. Илтимос, бироздан кейин қайта уриниб кўринг.',
  ku: 'ببورە، ئێستا ناتوانم پرسیارەکەت پرۆسێس بکەم. تکایە کەمێکی تر دووبارە هەوڵ بدەوە.',
  ps: 'بخښنه غواړم، زه همدا اوس ستاسو پوښتنه نه شم پروسس کولی. مهرباني وکړئ لږ وروسته بیا هڅه وکړئ.',
  so: 'Waan ka raali ahay, hadda ma awoodo inaan hawlgeliyo su’aashaada. Fadlan dhawaan mar kale isku day.',
  hi: 'क्षमा करें, मैं अभी आपके प्रश्न पर काम नहीं कर पा रहा। कृपया थोड़ी देर बाद फिर कोशिश करें।',
  de: 'Entschuldige, ich kann deine Frage gerade nicht bearbeiten. Bitte versuche es gleich noch einmal.',
  pt: 'Desculpe, não consigo processar a sua pergunta agora. Tente novamente daqui a pouco.',
  es: 'Lo siento, ahora mismo no puedo procesar tu pregunta. Inténtalo de nuevo en un momento.',
  zh: '抱歉,我现在无法处理您的问题。请稍后再试。',
  ru: 'Извините, сейчас я не могу обработать ваш вопрос. Пожалуйста, попробуйте ещё раз чуть позже.',
  sw: 'Samahani, siwezi kushughulikia swali lako sasa hivi. Tafadhali jaribu tena baada ya muda mfupi.',
  ms: 'Maaf, saya tidak dapat memproses soalan anda sekarang. Sila cuba lagi sebentar nanti.',
  ha: 'Yi haƙuri, ban iya sarrafa tambayarka a yanzu ba. Don Allah ka sake gwadawa nan da ɗan lokaci.',
  tr: 'Üzgünüm, sorunuzu şu anda işleyemedim. Lütfen biraz sonra tekrar deneyin.',
  bn: 'দুঃখিত, আমি এখন আপনার প্রশ্ন প্রক্রিয়া করতে পারিনি। অনুগ্রহ করে একটু পরে আবার চেষ্টা করুন।',
  ur: 'معذرت، میں ابھی آپ کا سوال پروسیس نہیں کر سکا۔ براہِ کرم تھوڑی دیر بعد دوبارہ کوشش کریں۔',
  id: 'Maaf, aku tidak dapat memproses pertanyaanmu sekarang. Silakan coba lagi sebentar lagi.',
  en: 'Sorry, I could not process your question just now. Please try again in a moment.',
  fr: 'Désolé, je n’ai pas pu traiter ta question à l’instant. Réessaie dans un moment.',
  fa: 'متأسفم، اکنون نتوانستم پرسش شما را پردازش کنم. لطفاً کمی بعد دوباره امتحان کنید.',
};
// E2 (amendment 5): THE ONE LINE A READER GETS WHEN THE TRANSLATION OF AN ANSWER COULD NOT BE COMPLETED. It stands before the first part that is shown in Arabic
// (or before the whole Arabic answer, when nothing could be translated), so an Arabic answer never reaches a reader of another language without a word.
export const TRANSLATION_INCOMPLETE_TEXT = {
  en: 'The translation could not be completed, so this part is shown in Arabic.',
  fr: 'La traduction n’a pas pu être terminée ; ce passage est donc affiché en arabe.',
  fa: 'ترجمه کامل نشد؛ بنابراین این بخش به عربی نمایش داده می‌شود.',
  ur: 'ترجمہ مکمل نہیں ہو سکا، اس لیے یہ حصہ عربی میں دکھایا جا رہا ہے۔',
  id: 'Terjemahan tidak dapat diselesaikan, jadi bagian ini ditampilkan dalam bahasa Arab.',
  es: 'No se pudo completar la traducción, por eso esta parte se muestra en árabe.',
  pt: 'Não foi possível concluir a tradução, por isso esta parte é mostrada em árabe.',
  de: 'Die Übersetzung konnte nicht abgeschlossen werden, deshalb wird dieser Teil auf Arabisch angezeigt.',
  tr: 'Çeviri tamamlanamadı, bu yüzden bu bölüm Arapça gösteriliyor.',
  ru: 'Перевод не удалось завершить, поэтому эта часть показана на арабском.',
  zh: '翻译未能完成,因此这部分以阿拉伯语显示。',
  hi: 'अनुवाद पूरा नहीं हो सका, इसलिए यह भाग अरबी में दिखाया जा रहा है।',
  bn: 'অনুবাদ সম্পূর্ণ করা যায়নি, তাই এই অংশ আরবিতে দেখানো হচ্ছে।',
  sw: 'Tafsiri haikukamilika, kwa hiyo sehemu hii inaonyeshwa kwa Kiarabu.',
  ms: 'Terjemahan tidak dapat disiapkan, jadi bahagian ini dipaparkan dalam bahasa Arab.',
  ha: 'Ba a iya kammala fassarar ba, don haka ana nuna wannan sashe da Larabci.',
  so: 'Tarjumaadda lama dhammaystiri karin, sidaas darteed qaybtan waxaa lagu soo bandhigay af Carabi.',
  ps: 'ژباړه بشپړه نه شوه، نو دا برخه په عربي ښودل کېږي.',
  ku: 'وەرگێڕانەکە تەواو نەبوو، بۆیە ئەم بەشە بە عەرەبی پیشان دەدرێت.',
  uz: 'Таржимани якунлаб бўлмади, шу сабабли бу қисм арабча кўрсатилмоқда.',
  am: 'ትርጉሙን ማጠናቀቅ አልተቻለም፤ ስለዚህ ይህ ክፍል በአረብኛ ተሰጥቷል።',
  ta: 'மொழிபெயர்ப்பை முடிக்க முடியவில்லை, எனவே இந்தப் பகுதி அரபியில் காட்டப்படுகிறது.',
};
export function translationNotice(lang) { return TRANSLATION_INCOMPLETE_TEXT[lang] || TRANSLATION_INCOMPLETE_TEXT.en; }
const HISTORY_MAX_MESSAGES = 4;
const HISTORY_MAX_CHARS = 1500;
const QUESTION_MAX_CHARS = 6000;

const LATIN = /[A-Za-z]/g; const ARABIC = /[ء-ي]/g;
const countOf = (s, re) => (String(s).match(re) || []).length;

/** the plain text of a message's content (string or text blocks), or null when it holds anything else */
export function messageText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content) && content.every((b) => b && b.type === 'text' && typeof b.text === 'string')) return content.map((b) => b.text).join('\n');
  return null;
}
export function lastUserIndex(messages) { for (let i = messages.length - 1; i >= 0; i--) if (messages[i] && messages[i].role === 'user') return i; return -1; }
export function lastUserText(messages) { const i = lastUserIndex(messages); return i < 0 ? '' : (messageText(messages[i].content) || ''); }

/**
 * Translate the last user message (always) and the recent earlier messages that are written in the reader's
 * language, to Arabic, IN PLACE: the same message objects keep their identity so every later reference to the
 * array sees the Arabic text.
 * @returns {Promise<{ok:boolean, ms:number, count:number, why:string[]}>} `why`: one short code per failed call (sNNN = HTTP status, timeout, net, parse), for the log -- never text
 */
export async function translateQuestionInPlace(messages, { lang = 'en', translate = callTranslator, hedgeMs = QUESTION_HEDGE_MS } = {}) {
  const t0 = Date.now();
  const li = lastUserIndex(messages);
  const targets = [];
  for (let i = Math.max(0, li - HISTORY_MAX_MESSAGES); i < li; i++) {
    const t = messageText(messages[i] && messages[i].content); if (t == null) continue;
    // an earlier message is carried when it is in the reader's language: Latin-script text that outweighs its Arabic, or (for a language written in
    // another script, or in the Arabic script with its own letters) a text the one detector reads as a language of the table
    const own = detectQuestionLang(t, 'ar') !== 'ar';
    if ((countOf(t, LATIN) >= 20 && countOf(t, LATIN) > 2 * countOf(t, ARABIC)) || (own && t.trim().length >= 12)) targets.push({ i, cut: HISTORY_MAX_CHARS });
  }
  targets.push({ i: li, cut: QUESTION_MAX_CHARS });
  const texts = targets.map(({ i, cut }) => String(messageText(messages[i].content)).slice(0, cut));
  const user = JSON.stringify(texts);
  const why = [];
  const arr = await hedged((k) => translate({ system: questionSystem(lang), user, maxTokens: 2048, timeoutMs: QUESTION_CALL_MS, ...(QUESTION_MODEL_PLAN[k] === 'second' ? { model: langFallbackModel() } : {}) }).then((r) => {
    const a = r && r.ok ? parseStringArray(r.text, texts.length) : null;
    const good = a && a.every((t) => t.trim()) ? a : null;
    if (!good) why.push(r && !r.ok ? (r.status ? 's' + r.status : /abort/i.test(String(r.error || '')) ? 'timeout' : 'net') : 'parse');
    return good;
  }), hedgeMs, QUESTION_CALLS_MAX);
  if (arr) {
    targets.forEach(({ i }, k) => { messages[i].content = arr[k]; });
    return { ok: true, ms: Date.now() - t0, count: targets.length, why };
  }
  return { ok: false, ms: Date.now() - t0, count: targets.length, why };
}

// L (amendment 11) -- THE SAME CALL, GIVEN UP TO 30 SECONDS AND A SECOND MODEL. Measured on the final link of 8fdab1d (extension test 2, 15 non-Arabic tries): six ended in the
// question-processing line. The preview's own log has the [lang] rows of those asks: three took 19-20 s (all three hedged calls stalled for their 12 s: a provider stall), three
// took 2.5-3.5 s (all three calls failed within about a second each; the log did not say why, so it now carries one code per failed call, never text). The hedge gave a stalled
// or failing provider 20 s and made its three calls in a row on the SAME model, with no pause after a quick failure. Now: up to five calls, 4 s apart (the longest wait is
// 4 x 4 + 12 = 28 s, under the 30 s bound), the second and fifth on the second model (lib/lang/model.js langFallbackModel), and after a quick failure the next call waits
// QUESTION_BACKOFF_MS instead of firing at once. The normal case still makes one call.
export const QUESTION_MODEL_PLAN = ['first', 'first', 'second', 'first', 'second'];
export const QUESTION_BACKOFF_MS = 700;
// J (amendment 9) -- THE QUESTION CALL IS HEDGED, NOT RETRIED. Measured in the preview's own log (41 [lang] rows): the call that carries a question takes about 1.2 s,
// but in one five-minute window it stalled and three of four French asks ended in the fixed failure line after 30 s: two attempts of 15 s one after the other, the second
// started only when the first was dead. Now a second identical call starts QUESTION_HEDGE_MS after the first when the first has not answered, a third after the same time
// again; the first good answer wins and the others are let go. The longest wait is about 20 s (not 30); the normal case still makes one call.
export const QUESTION_CALL_MS = 12000;
export const QUESTION_HEDGE_MS = 4000;
export const QUESTION_CALLS_MAX = QUESTION_MODEL_PLAN.length;
/** Start `make(k)` now (k = 0, 1, ...) and again every `gap` ms while no call has given a result (null = none); after a failure that leaves no call running, the next starts `backoff` ms later. Resolves with the first result, or null when every call has failed. */
export function hedged(make, gap = QUESTION_HEDGE_MS, max = QUESTION_CALLS_MAX, backoff = QUESTION_BACKOFF_MS) {
  return new Promise((resolve) => {
    let started = 0; let failed = 0; let done = false; let timer = null;
    const finish = (v) => { if (done) return; done = true; clearTimeout(timer); resolve(v); };
    const lost = () => { failed++; if (failed < started) return; clearTimeout(timer); if (started < max) { timer = setTimeout(fire, Math.min(gap, backoff)); } else finish(null); };
    function fire() {
      if (done || started >= max) return;
      const k = started++;
      Promise.resolve().then(() => make(k)).then((v) => { if (v != null) finish(v); else lost(); }, lost);
      if (started < max) { clearTimeout(timer); timer = setTimeout(fire, gap); }
    }
    fire();
  });
}
