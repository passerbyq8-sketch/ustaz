// lib/prophetic-claims.js -- ITEM D1-A (136) -- 2026-10-15 brain-line
//
// THE FALSE ASCRIPTION: THE FRAMES AND THE MODEL'S OWN PARENTHESES. Measured on 7ba44481
// (side-brain-line-2026-10-15/items/136.md, side/t136.md): «وقد جاء في الحديث: «لن يغلب عسر يسرين» (البخاري)» --
// Sufyan's saying, credited to al-Bukhari by the writer's own parenthesis; «وقد ورد أنّه كان ينامُ نصفَ الليلِ…»
// (Dawud's prayer, credited to the Prophet ﷺ through Aisha); «وقد جاء في الحديث أن الصيام جنة.» with no matn at all.
// The detector of 36 reads only <hadith>-tagged matns, and nothing read a frame with no target or a parenthesis the
// model wrote.
//
// Two steps, both pure:
//   stripModelCollectionParens(text)   BEFORE the takhrij pass: a bare parenthesis that names a collection («(البخاري)»,
//                                      «(مسلم)», «(النسائي)», «(متفق عليه)» …) is the model's, and goes; the only
//                                      parenthesis left after the pass is the one the server writes.
//   dropUnconfirmedProphetic(text, e)  AFTER it: a sentence with a Prophetic frame («قال النبي/رسول الله», «كان
//                                      النبي», «جاء/ورد/ثبت/صحّ في الحديث», «في الحديث الصحيح», «جاء/ورد أنّه») whose
//                                      matn the pass did not source (entries[].sourced) is removed whole.
import { normalizeArabic } from './route-classify.js';

const COLLECTIONS = ['البخاري', 'مسلم', 'متفق عليه', 'النسائي', 'أبو داود', 'ابو داود', 'الترمذي', 'ابن ماجه', 'ابن ماجة',
  'أحمد', 'احمد', 'مالك', 'الدارمي', 'ابن حبان', 'ابن خزيمة', 'الحاكم', 'البيهقي', 'الطبراني', 'الدارقطني', 'البزار',
  'ابن أبي شيبة', 'عبد الرزاق', 'أبو يعلى', 'رواه البخاري', 'رواه مسلم', 'البخاري ومسلم', 'أخرجه البخاري', 'أخرجه مسلم'];
// a parenthesis that holds a collection's name and nothing else (the server's own carry a «·» or a grade beside it)
const MODEL_PAREN_RE = new RegExp('[ \\t]*\\((?:' + COLLECTIONS.map((c) => c.replace(/\s+/gu, '\\s+')).join('|') + ')\\)', 'gu');

/** The model's bare collection parentheses removed; everything else byte for byte. */
export function stripModelCollectionParens(text) {
  return String(text == null ? '' : text).replace(MODEL_PAREN_RE, '');
}

// the frames, on normalizeArabic's folding (همزات folded, ة -> ه, ى -> ي)
const FRAME_RE = /(?:^|\s)[وفب]?(?:ان\s+(?:النبي|رسول\s+الله)(?:\s+صلي\s+الله\s+عليه\s+وسلم)?\s+قال|قال\s+(?:النبي|رسول\s+الله)|كان\s+(?:النبي|رسول\s+الله)|(?:جاء|ورد|ثبت|صح)\s+في\s+(?:ال)?حديث|في\s+الحديث\s+الصحيح|(?:وقد\s+)?(?:جاء|ورد)\s+انه?)(?=\s|$|[:،,])/u;
const fold = (s) => normalizeArabic(String(s || '')).replace(/\s+/gu, ' ').trim();

/** Does this sentence carry a Prophetic frame of the order's list? */
export function hasPropheticFrame(sentence) {
  return FRAME_RE.test(fold(String(sentence || '').replace(/[«»"“”]/gu, ' ')));
}

// ITEM D2 (133) -- 2026-10-15 brain-line: a sentence that speaks of a hadith or hadiths (the BW2 reading, mentionsHadith)
const HADITH_MENTION_RE = /(?:^|\s)[وفبل]?(?:ال|لل)?(?:حديث|احاديث|حديثين|حديثان)(?=\s|$|[.،؛:؟!])/u;
const QUOTED_MATN_RE = /«[^»]{12,}»/u;
/**
 * ITEM D2 (133): after a matn was removed (dropUnconfirmedProphetic), a sentence that speaks of a hadith or hadiths
 * points at nothing the reader can see when no quoted matn is left in the text: it goes too. A text that still
 * quotes a matn, or carries a card, is left as it is.
 */
export function dropHadithPointersWithoutMatn(text) {
  const value = String(text == null ? '' : text);
  if (QUOTED_MATN_RE.test(value) || /<hadith\b/u.test(value)) return { text: value, removed: 0 };
  let removed = 0;
  const lines = value.split('\n').map((line) => {
    if (/<(?:source|book|verse)\b/u.test(line)) return line;
    const parts = line.match(/(?:[^.؟!…]|(?<=[0-9٠-٩])\.(?=[0-9٠-٩]))*(?:[.؟!…]+|$)/gu) || [line];
    let here = 0;
    const kept = parts.filter((part) => {
      if (!part.trim() || !HADITH_MENTION_RE.test(fold(part))) return true;
      here += 1;
      return false;
    });
    removed += here;
    return here ? kept.join('').replace(/[ \t]{2,}/gu, ' ').trim() : line;
  });
  return { text: removed ? lines.join('\n').replace(/\n{3,}/gu, '\n\n').trim() : value, removed };
}

/**
 * Remove each sentence with a Prophetic frame whose matn no entry sourced. A sentence holding a card (<hadith …>,
 * <source …>, <book …>) is the server's and is never touched.
 * @param {string} text
 * @param {Array<{matn:string, sourced:boolean}>} entries  the takhrij pass's entries
 * @returns {{text:string, removed:number}}
 */
export function dropUnconfirmedProphetic(text, entries = []) {
  const sourced = (Array.isArray(entries) ? entries : []).filter((e) => e && e.sourced).map((e) => fold(e.matn)).filter(Boolean);
  let removed = 0;
  const lines = String(text == null ? '' : text).split('\n').map((line) => {
    if (/<(?:hadith|source|book|verse)\b/u.test(line)) return line;
    const parts = line.match(/(?:[^.؟!…]|(?<=[0-9٠-٩])\.(?=[0-9٠-٩])|«[^»]*»)*(?:[.؟!…]+|$)/gu) || [line];
    let here = 0;
    const kept = parts.filter((part) => {
      if (!part.trim() || !hasPropheticFrame(part)) return true;
      const folded = fold(part.replace(/[«»"“”]/gu, ' '));
      if (sourced.some((m) => folded.includes(m))) return true;
      here += 1;
      return false;
    });
    removed += here;
    return here ? kept.join('').replace(/[ \t]{2,}/gu, ' ').trim() : line;
  });
  return { text: removed ? lines.join('\n').replace(/\n{3,}/gu, '\n\n').trim() : String(text == null ? '' : text), removed };
}
