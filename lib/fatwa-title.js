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
// and the same two with the due made definite when the reader wrote it in construct («زكاة المال» ->
// «الزكاة»), because a title names the due, not the reader's property. The words are sent as written
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
  const complement = !due.definite && next && next.folded.startsWith('ال') && !OTHER_KIND.has(next.folded) ? next.surface : '';
  const asWritten = (due.definite ? 'ال' : '') + due.surface + (complement ? ' ' + complement : '');
  const definite = 'ال' + due.surface;
  const manner = words.find((w) => MANNER.has(w.folded));
  const out = [];
  const add = (q) => { if (q && !out.includes(q)) out.push(q); };
  for (const named of [asWritten, definite]) {
    if (manner) add(`${ACT} ${named} ${manner.surface}`);
    add(`${ACT} ${VALUE} في ${named}`);
  }
  return out.slice(0, FATWA_TITLE_MAX);
}
