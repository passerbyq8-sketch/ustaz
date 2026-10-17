// guards/brain-line-r2-4-guard.cjs -- ITEM r2-4 (H3 follow-up) -- 2026-10-17 brain-line R2
//
// A TERM IS EXPLAINED ONCE IN THE WHOLE ANSWER. Measured on the preview of fa778c0e (sessions/side-brain-fix-2026-10-15/
// EZIK-EXT-PREVIEW-TEST-REPORT-2026-10-17.txt lines 294-295, F3, Persian «فضیلت خواندن سوره کهف در روز جمعه چیست؟»): «سوره
// (مجموعه‌ای متمایز از آیات قرآن کریم…)» twice and «غُسل (خالی کردن آب و ریختن آن بر روی تمام بدن…)» three times -- twice in
// the translated card of Ibn Uthaymin, once in the prose. The pieces are translated side by side and dropRepeatedNotes reads
// one piece and its seed only.
//
// What this guard holds (the R2 order, item 4): the F3 text (lines 300-313, copied below by sessions/side-brain-fix-2026-10-15/
// tools/r2-4-consts.cjs) through the real translateAnswer -- a source card, prose, a book card, prose -- with a fake translator
// that gives back those lines:
//   (1) «(خالی کردن آب…» once (it was three), «(…مجموعه‌ای متمایز…» once (it was two), the terms themselves kept;
//   (2) the words outside the parentheses unchanged (only the gloss goes);
//   (3) negatives: «البخاري (52)», «(2026-10-06)» and «(al-Bukhari: 60)» are not touched; a published translation (the
//       hadith card's tr=, the quoted line in the prose) is not touched.
'use strict';
const path = require('path');

const REPO = path.join(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
let failures = 0;
let checks = 0;
function ok(name, cond, detail) {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const ascii = (s) => String(s).replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).slice(0, 400);

const F3 = {
  // <F3>
  l301: "صحت حدیث خواندن سوره کهف (سوره : مجموعه‌ای متمایز از آیات قرآن کریم هستند که دارای ابتداء و پایان می‌باشند، و نام‌های ویژه‌ای دارند که کمترین آنها شامل سه آیت است) در روز جمعه چقدر است؟",  // report line 301
  l304: "خواندن سوره (مجموعه‌ای متمایز از آیات قرآن کریم که دارای ابتدا و پایان می‌باشند و نام‌های ویژه‌ای دارند که کمترین آن‌ها شامل سه آیت است) کهف در روز جمعه عملی مستحب و مورد ترغیب است، و در آن فضیلتی بزرگ وجود دارد.",  // report line 304
  l305: "بهتر این است که غُسل (خالی کردن آب و ریختن آن بر روی تمام بدن چه به نیت رفع غُسل باشد، یا به نیت نظافت کردن مستحب، یا بدون نیت باشد) را به ساعت ده به تأخیر بیندازی، سپس غُسل کنی و به مسجد بروی. * * * و از فضیلة الشیخ - رحمه‌الله تعالی - سؤال شد: زمان غُسل جمعه از چه وقتی آغاز می‌شود؟ فضیلت ایشان در پاسخ فرمودند: وقت غُسل (خالی کردن آب و ریختن آن بر روی تمام بدن) جمعه از طلوع فجر شروع می‌شود، لکن بهتر است که غسل نکند مگر بعد از طلوع آفتاب… * * * از فضیلت شیخ - رحمه‌الله تعالی - سؤال شد: آیا خواندن سوره کهف در روز جمعه سنت است؟ فضیلت ایشان در پاسخ فرمودند: خواندن سوره کهف در روز جمعه سنتی است که در فضیلت آن روایت شده که برای او از نوری روشنایی می‌بخشد که بین او و دو جمعه است… و آنچه بین دو جمعه است برایش آمرزیده می‌شود.",  // report line 305
  l309: "تفاوتی در رسیدن به این اجر نیست میان اینکه انسان آن را از مصحف بخواند یا از حفظ. و روز شرعی از طلوع فجر تا غروب خورشید امتداد دارد، پس اگر انسان آن را بعد از نماز جمعه (خواندن دو رکعت نماز بعد از دو خطبه‌ی ظهر روز جمعه) بخواند، باز هم به اجر می‌رسد، بر خلاف غسل جمعه (خالی کردن آب و ریختن آن بر روی تمام بدن) که باید پیش از نماز انجام شود.",  // report line 309
  l310: "اما آنچه برخی از مردم گمان می‌کنند که خواننده‌ی آن از کسی که بقیه‌ی قرآن (کلام الله متعال نازل شده بر رسولش محمد - صلی الله علیه و سلم - که قرائتش عبادت است…) را خوانده برتر است، و اینکه ترک‌کننده‌ی آن پاداشش کم می‌شود حتی اگر تمام قرآن را خوانده باشد، این سخنی است که اصل و اساسی ندارد.",  // report line 310
  // </F3>
};
const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64');
const unb64 = (s) => Buffer.from(String(s || ''), 'base64').toString('utf8');
// The Arabic the brain wrote is not in the report; each piece is composed here and carries a word that names its Persian line.
const AR = {
  l301: 'ما صحة حديث قراءة سورة الكهف يوم الجمعة ؟ أولا',
  l304: 'قراءة سورة الكهف يوم الجمعة مستحبة وفيها فضل عظيم ثانيا',
  l305: 'الأفضل أن تؤخر الغسل إلى الساعة العاشرة ثم تغتسل وتذهب إلى المسجد ثالثا',
  l309: 'ولا فرق في حصول هذا الأجر بين أن يقرأها الإنسان من المصحف أو عن ظهر قلب رابعا',
  l310: 'وأما ما يظنه بعض الناس من أن قارئها أفضل ممن قرأ بقية القرآن فلا أصل له خامسا',
};
const which = (s) => Object.keys(AR).find((k) => s.includes(AR[k].split(' ').pop())) || null;
const fakeTranslate = async ({ user }) => {
  const arr = JSON.parse(String(user).split('INPUT:\n')[1]);
  return { ok: true, text: JSON.stringify(arr.map((s) => { const k = which(s); return k ? F3[k] : 'Other.'; })) };
};
const ARABIC = '<source url="https://mostafaaladwy.com/x" title="t">' + AR.l301 + '</source>\n\n' + AR.l304 + '\n\n'
  + '<book title="مجموع فتاوى ورسائل العثيمين" matn="' + b64(AR.l305) + '">مجموع فتاوى ورسائل العثيمين</book>\n\n' + AR.l309 + '\n\n' + AR.l310;
const readable = (text) => String(text).replace(/\b(tl|tb)="([^"]*)"/g, (m, k, v) => ' [' + unb64(v) + '] ');
const count = (s, sub) => s.split(sub).length - 1;
const outsideWords = (s) => { let d = 0; let o = ''; for (const c of String(s)) { if (c === '(') d++; else if (c === ')') d = Math.max(0, d - 1); else if (!d) o += c; } return o.split(/\s+/u).filter(Boolean).length; };

(async () => {
  const A = await esm('lib/lang/answer.js');
  console.log('-- 1/2. the F3 answer through the real translateAnswer');
  const raw = Object.keys(AR).map((k) => F3[k]).join('\n\n');
  ok('the copied F3 lines carry the measured repeats (3 x the ghusl gloss, 2 x the surah gloss)', count(raw, '(خالی کردن آب') === 3 && count(raw, 'مجموعه‌ای متمایز') === 2);
  const r = await A.translateAnswer(ARABIC, { lang: 'fa', translate: fakeTranslate, budgetMs: 60000 });
  const text = readable(r.text);
  ok('the ghusl gloss (khali kardan-e ab ...) once in the answer', count(text, '(خالی کردن آب') === 1, String(count(text, '(خالی کردن آب')));
  ok('the surah gloss (majmu-e-i motamayez ...) once in the answer', count(text, 'مجموعه‌ای متمایز') === 1, String(count(text, 'مجموعه‌ای متمایز')));
  ok('the terms stay (ghusl, surah)', count(text, 'غُسل') >= 3 && count(text, 'سوره') >= 3);
  // what the reader reads: the cards' translations (tl) and the prose between the cards
  const shown = []; r.text.replace(/\btl="([^"]*)"/g, (m, v) => { shown.push(unb64(v)); return m; });
  shown.push(r.text.replace(/<(source|book)\b[^>]*>[\s\S]*?<\/\1>/g, ' '));
  ok('the words outside the parentheses did not change', outsideWords(shown.join(' ')) === outsideWords(raw), outsideWords(shown.join(' ')) + ' vs ' + outsideWords(raw));
  console.log('-- 3. what is not touched');
  const pass = typeof A.glossOncePass === 'function' ? A.glossOncePass : (s) => s;
  const NEG = 'قال البخاري (52) في صحيحه. HadeethEnc.com (2026-10-06). وروى (al-Bukhari: 60) كذلك.';
  const seen = new Set();
  ok('al-Bukhari (52), (2026-10-06) and (al-Bukhari: 60) untouched, twice over', pass(NEG, seen) === NEG && pass(NEG, seen) === NEG);
  const QUOTE = 'اللہ عز و جل فرماتا ہے: ولا تقتلوا أنفسكم (“اے ایمان والو! اپنے آپس کے مال ناجائز طریقہ سے مت کھاؤ” — ترجمۂ قرآن 4:29)';
  ok('a quoted published translation in the prose is untouched, twice over', pass(QUOTE, seen) === QUOTE && pass(QUOTE, seen) === QUOTE);
  const HAD = '<hadith source="x" tr="' + b64('Islam (surrendering to Allah through monotheism, submitting to Him)') + '">بني الإسلام على خمس</hadith>';
  const rh = await A.translateAnswer('الإسلام دين الله الذي ارتضاه لعباده أولا\n\n' + HAD, { lang: 'en', budgetMs: 60000,
    translate: async ({ user }) => ({ ok: true, text: JSON.stringify(JSON.parse(String(user).split('INPUT:\n')[1]).map(() => 'Islam (surrendering to Allah through monotheism, submitting to Him) is the religion of Allah.')) }) });
  ok('a hadith card keeps its published translation byte for byte after the same gloss in the prose (HadeethEnc, rule 27)',
    rh.text.includes('Islam (surrendering') && rh.text.includes('tr="' + b64('Islam (surrendering to Allah through monotheism, submitting to Him)') + '"'), ascii(rh.text.slice(0, 200)));
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-r2-4: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
