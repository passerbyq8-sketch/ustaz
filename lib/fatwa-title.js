// lib/fatwa-title.js -- SPEED WASL W3 a): THE ISSUE ASKED IN THE FATWA'S OWN WORDS.
//
// WHY. The fatwa store ANDs every word of a query and does not fold. A reader asks in his own words
// («إخراج زكاة المال عروضا بدل النقود»); a fatwa is titled in the fiqh's («حكم إخراج القيمة في زكاة الغنم»,
// «حكم إخراج الزكاة من الأقمشة»). MEASURED on the live store, read only (CONNECT F1 and the WASL round):
// for the owner's question the issue's own queries («إخراج زكاة المال», «عروضا بدل النقود») brought five
// fatwas and none on the question, while «إخراج الزكاة عروضا» and «إخراج القيمة في الزكاة» reach binbaz 6518,
// binbaz 14611 and binothaimeen 6991 -- the last is the very paragraph the owner's page quoted.
//
// WHAT THE RULE READS, AND ONLY THAT. A due that is paid (زكاة، كفارة، فدية، صدقة) and a word saying it is
// paid in another kind than its own (بدل، عوض، نقدا، نقودا، عروضا، مالا، فلوسا، القيمة). The fiqh's name for
// that act is «إخراج», and its name for paying in another kind is «القيمة»; so the titles are:
//   «إخراج <the due as written> <the manner word>»      «إخراج زكاة الفطر نقودا»
//   «إخراج القيمة في <the due as written>»              «إخراج القيمة في زكاة الغنم»
// and the same two with the due made definite («زكاة الغنم» -> «الزكاة»), the form a general title takes; «زكاة المال»
// (zakat in general) is asked only in that form. The words are sent as written
// (the store does not fold), at most four queries, and none when either half is missing: every other
// question is asked exactly as before. It is a rule on the question's words and two fiqh terms, never a
// list of questions.
//
// Pure: no environment, no network.
import { normalizeArabic } from './route-classify.js';

const DUE = new Set(['زكاه', 'زكاة', 'كفاره', 'فديه', 'صدقه'].map((w) => normalizeArabic(w)));
const OTHER_KIND = new Set(['بدل', 'عوض', 'عوضا', 'نقدا', 'نقودا', 'نقود', 'النقود', 'عروضا', 'عروض', 'العروض',
  'قيمه', 'القيمه', 'بالقيمه', 'مالا', 'فلوس', 'فلوسا', 'كاش'].map((w) => normalizeArabic(w)));
// The manner word a title keeps: an accusative of the other kind («نقودا», «عروضا»), never «بدل».
const MANNER = new Set(['نقدا', 'نقودا', 'عروضا', 'مالا', 'فلوسا'].map((w) => normalizeArabic(w)));
// «زكاة المال» names zakat in general, not a kind of it: a title says «الزكاة». MEASURED: with «إخراج زكاة المال عروضا» and
// «إخراج القيمة في زكاة المال» asked too, their zakat-of-cattle rows filled the before-writing cap of 6 before binbaz 6518.
const GENERAL = new Set(['المال', 'الاموال', 'ماله', 'مالي'].map((w) => normalizeArabic(w)));
const ACT = 'إخراج';
const VALUE = 'القيمة';
export const FATWA_TITLE_MAX = 4;

function wordsOf(question) {
  return String(question || '').replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ').split(/\s+/u)
    .map((word) => [...word].filter((c) => normalizeArabic(c) !== '').join('')).filter(Boolean)
    .map((surface) => ({ surface, folded: normalizeArabic(surface) }));
}
// «وزكاة», «بزكاة», «للزكاة», «الزكاة» -> the due's bare letters, and whether it carried «ال».
function bareDue(word) {
  let f = word.folded;
  let s = word.surface;
  if (/^[وفب]/u.test(f) && DUE.has(f.slice(1).replace(/^ال/u, ''))) { f = f.slice(1); s = s.slice(1); }
  if (/^لل/u.test(f) && DUE.has(f.slice(2))) return { surface: s.slice(2), definite: true };
  const definite = f.startsWith('ال');
  if (definite) { f = f.slice(2); s = s.slice(2); }
  return DUE.has(f) ? { surface: s, definite } : null;
}

/** The question -> the issue as fatwa titles state it, as written for the store; [] when the rule does not apply. */
export function fatwaTitleQueries(question) {
  const words = wordsOf(question);
  const at = words.findIndex((w) => bareDue(w));
  if (at < 0 || !words.some((w) => OTHER_KIND.has(w.folded))) return [];
  const due = bareDue(words[at]);
  const next = words[at + 1];
  const complement = !due.definite && next && next.folded.startsWith('ال') && !OTHER_KIND.has(next.folded) ? next : null;
  const definite = 'ال' + due.surface;
  // A generic complement («زكاة المال») names no kind: the due is asked in its definite form only.
  const asWritten = complement && GENERAL.has(complement.folded) ? definite
    : (due.definite ? 'ال' : '') + due.surface + (complement ? ' ' + complement.surface : '');
  const manner = words.find((w) => MANNER.has(w.folded));
  const out = [];
  const add = (q) => { if (q && !out.includes(q)) out.push(q); };
  for (const named of [asWritten, definite]) {
    if (manner) add(`${ACT} ${named} ${manner.surface}`);
    add(`${ACT} ${VALUE} في ${named}`);
  }
  return out.slice(0, FATWA_TITLE_MAX);
}

// SPEED WASL W3 b) -- THE FLOOR UNDER THE JUDGE'S DIRECT MATCH. The judge (lib/before-writing-v2.js) says when a fatwa's own
// question or title asks the reader's question; this floor must agree before the stored fatwa opens the answer. It reads
// the stored TITLE's content words (the frame of asking taken off) and asks how many of them the reader's question carries,
// counting the fiqh words the rule above derives from it (so «القيمة» counts for «عروضا بدل النقود»). MEASURED on the
// owner's question: binbaz 6518 «حكم إخراج الزكاة من الأقمشة» 2 of 3, binbaz 14611 «حكم إخراج القيمة في زكاة الغنم» 3 of 4
// pass; albarrak 30148 «دفع الزيت لصاحب المعصرة بدل النقود» 2 of 8 and binbaz 9323 «إخراج زكاة الفطر مالا» 2 of 4 do not.
// A title that shares words by accident (a fatwa on paying zakat to an orphanage) can pass the floor: the judge is the one
// that reads meaning, and both must agree.
const TITLE_FRAME = new Set(['حكم', 'هل', 'يجوز', 'تجوز', 'جواز', 'ما', 'ماذا', 'في', 'من', 'عن', 'علي', 'الي', 'او', 'مع',
  'كيف', 'كيفيه', 'بيان', 'مساله', 'سؤال', 'عند', 'ان', 'لا', 'به', 'بها', 'فيه', 'فيها', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي'].map((w) => normalizeArabic(w)));
export const DIRECT_FLOOR_SHARE = 0.6;
function stem(folded) {
  let w = folded;
  if (/^[وفب]/u.test(w) && w.length > 3) w = w.slice(1);
  if (w.startsWith('لل') && w.length > 4) w = w.slice(2);
  else if (w.startsWith('ال') && w.length > 3) w = w.slice(2);
  return w;
}

// COMPREHENSIVE 3.4d -- A STORED FATWA NARROWER THAN THE QUESTION IS NOT «نص الفتوى» FOR IT (the owner's note 6, seen again on 2 Oct, answer 8).
// MEASURED on the real store (salmajed 1567): «ما حكم الجمع بين الظهر والعصر للمسافر؟» was answered with the text of «جمع الظهر والعصر للمسافر يوم الجمعة» --
// 4 of the title's 6 content words are the reader's (0.67 >= 0.6), and the two it lacks, «يوم الجمعة», are the CONDITION: a day. The same floor admits
// «صيام يوم عرفة للحاج» for «ما حكم صيام يوم عرفة؟» (a person), «الصيام في السفر مع المشقة» (a state), «صلاة المسافر الظهر مع من يصلي العصر» (a
// circumstance). So the share of words is not enough: a restricting condition in the stored fatwa (its TITLE)
// that the reader's own question does not carry makes the fatwa narrower than the question, and it is not shown as the answer.
// WHAT COUNTS AS A CONDITION is closed and written here, never a list of fatwas: a FRAME word that opens one («يوم», «ليلة», «أثناء», «حال», «عند»,
// «بعد», «قبل», «مع», «بسبب», «إذا», «لو», «خلف», «داخل», «خارج», «بدون», ...) with the (at most two) content words that follow it, and a PERSON or STATE
// noun on its own («الحاج», «المرأة», «الحائض», «المسبوق», «الصائم»...). The reader covers it when EVERY content word of it is among his own words
// (stemmed as above); a person noun next to «أو» («رجلا أو امرأة») restricts nothing. Doubt is not a block here: a fatwa that is vetoed is still
// evidence the writer explains from; it only does not open the answer under «نص الفتوى».
const RESTRICT_FRAMES = new Set(['يوم', 'ليله', 'ليل', 'نهار', 'اثناء', 'خلال', 'حال', 'حاله', 'عند', 'بعد', 'قبل', 'مع', 'بدون', 'بغير', 'بلا', 'بسبب',
  'لعذر', 'اذا', 'لو', 'عندما', 'حينما', 'متي', 'خلف', 'داخل', 'خارج', 'الا'].map((w) => stem(normalizeArabic(w))));
const RESTRICT_PERSONS = new Set(['حاج', 'معتمر', 'محرم', 'مراه', 'امراه', 'نساء', 'حائض', 'نفساء', 'حامل', 'مرضع', 'مريض', 'صغير', 'طفل', 'طفله',
  'اعمي', 'اصم', 'امام', 'مامون', 'مسبوق', 'صائم', 'عاجز', 'كافر', 'زوجه', 'زوج', 'ابوين', 'يتيم', 'فقير', 'غني', 'عامل', 'موظف', 'طالب', 'جندي',
  'طبيب', 'قاصر', 'معتكف', 'نائم', 'سكران', 'مجنون', 'مسن', 'عجوز', 'مسافره'].map((w) => stem(normalizeArabic(w))));
const CONDITION_STOP = new Set(['من', 'ما', 'هو', 'هي', 'ان', 'كان', 'كانت', 'يكون', 'تكون', 'قد', 'لم', 'لن', 'لا', 'ثم', 'او', 'و', 'هل', 'في', 'علي', 'عن', 'الي', 'به', 'بها']
  .map((w) => stem(normalizeArabic(w))));
/** The restricting conditions of a stored fatwa's words: each is the list of its content stems. */
function conditionsIn(text) {
  const toks = wordsOf(text).map((w) => stem(w.folded));
  const out = [];
  for (let i = 0; i < toks.length; i += 1) {
    const w = toks[i];
    if (RESTRICT_FRAMES.has(w)) {
      const cond = [w];
      for (let j = i + 1; j < toks.length && cond.length < 3; j += 1) {
        if (RESTRICT_FRAMES.has(toks[j])) break;
        if (CONDITION_STOP.has(toks[j])) continue;
        cond.push(toks[j]);
      }
      if (cond.length > 1) out.push(cond);
    } else if (RESTRICT_PERSONS.has(w)) {
      // «رجلا أو امرأة»: a person named beside «أو» is a pair of cases, not a restriction.
      const near = [toks[i - 1], toks[i - 2], toks[i + 1], toks[i + 2]];
      if (near.includes(stem(normalizeArabic('او')))) continue;
      out.push([w]);
    }
  }
  return out;
}
// FIX 48 item 7 (the owner's decision 8) -- A STORED FATWA WIDER THAN THE QUESTION IS NOT «نص الفتوى» FOR IT EITHER.
// MEASURED (the 2 Oct preview, answer 1, and the measure report م٤): «هل يستحب صيام يوم عرفة؟ وما فضله؟» opened with binbaz 14896, titled «الأيام التي يستحب فيها الصيام»,
// because 2 of its 3 title words are the reader's (0.67 >= 0.6); the floor counts the TITLE's words found in the question and never asks about the question's word that
// is not in the title: «عرفة». The second veto, after the one above: a NAME OF AN OCCASION (the closed list below, the one the owner approved) in the QUESTION that is in
// neither the fatwa's title nor its stored question. The fatwa stays evidence the writer explains from; it only does not open the answer. «عرفة» and «الوقوف» are one thing:
// either covers the other. The names are read after the fold (the article, the taa marbuta and the haa) and the stem, as every word here.
const OCCASION_NAMES = ['عرفة', 'عاشوراء', 'رمضان', 'شعبان', 'شوال', 'محرم', 'الجمعة', 'العيد', 'الأضحى', 'الفطر', 'الحج', 'العمرة', 'القدر', 'التراويح', 'الوقوف']
  .map((w) => normalizeArabic(w));
const OCCASION_SAME = [[stem(normalizeArabic('عرفة')), stem(normalizeArabic('الوقوف'))]];
// every form a written word may take (with the article, without it, stemmed) -> the one canonical name
const OCCASION_FORMS = new Map();
for (const name of OCCASION_NAMES) {
  for (const form of [name, name.replace(/^ال/u, ''), stem(name)]) OCCASION_FORMS.set(form, stem(name));
}
// «قدر» alone is also «the amount» («ما قدر النصاب؟»): it names the Night only with the article or after «ليلة»
const OCCASION_NEEDS_ARTICLE = new Set([stem(normalizeArabic('القدر'))]);
function occasionsOf(text) {
  const folded = wordsOf(text).map((w) => w.folded);
  const out = new Set();
  folded.forEach((f, i) => {
    const canonical = [f, f.replace(/^ال/u, ''), stem(f)].map((form) => OCCASION_FORMS.get(form)).find(Boolean);
    if (!canonical) return;
    if (OCCASION_NEEDS_ARTICLE.has(canonical) && !(f.startsWith('ال') || folded[i - 1] === normalizeArabic('ليلة'))) return;
    out.add(canonical);
  });
  return out;
}
function occasionCovered(name, present) {
  if (present.has(name)) return true;
  return OCCASION_SAME.some((group) => group.includes(name) && group.some((other) => present.has(other)));
}

export function directMatchFloor(question, title, storedQuestion = '') {
  const askedWords = [question, ...fatwaTitleQueries(question)].flatMap((q) => wordsOf(q)).map((w) => stem(w.folded));
  const asked = new Set(askedWords);
  const words = [...new Set(wordsOf(title).map((w) => w.folded).filter((w) => !TITLE_FRAME.has(w) && w.length > 1).map(stem))];
  const shared = words.filter((w) => asked.has(w)).length;
  const restricted = [];
  for (const cond of conditionsIn(title)) {
    // a frame word is covered by the reader's own words around it; the nouns it governs are what must be his
    const need = cond.filter((c) => !RESTRICT_FRAMES.has(c));
    if (need.length && !need.every((c) => asked.has(c)) && !restricted.some((r) => r.join(' ') === need.join(' '))) restricted.push(need);
  }
  // the second veto: an occasion the reader names that neither the title nor the stored question names
  const inFatwa = new Set([...occasionsOf(title), ...occasionsOf(storedQuestion)]);
  const occasions = [...occasionsOf(question)].filter((name) => !occasionCovered(name, inFatwa));
  return {
    ok: words.length > 0 && shared >= 2 && shared / words.length >= DIRECT_FLOOR_SHARE && restricted.length === 0 && occasions.length === 0,
    shared, of: words.length, restricted: restricted.map((r) => r.join(' ')), occasions,
  };
}
