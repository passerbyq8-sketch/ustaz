// lib/source-followup.js -- SPEED PIPES FIX 8: «ما مصدرك في هذا الجواب؟» ANSWERED FROM THE ANSWER ITSELF.
//
// MEASURED (round 6, question 29-b, preview trace): the follow-up "what is your source for this answer?" after
// a fiqh answer classified GENERAL and went to the free-brain path. Its first round wrote 687 characters in
// 9.7 s, the reviewer rejected them, and the reject-retry round wrote for 106 s until max_tokens (6144): the
// reader waited 113 s, got the previous answer written out again with its scholars turned into «بعض أهل
// العلم», and «هذا الجواب لم يكتملْ» under it. The sources of the previous answer were in the conversation
// all along: the server wrote them as card tags into that answer, and the client sends it back as history.
//
// So a question that asks ONLY for the source of the previous answer (a closed, short grammar below) is
// answered by the server with that answer's own cards, in their order, each under the name the answer gave
// its speaker («قال مصطفى العدوي:», «وقالت اللجنة الدائمة:»), or the book's own author. No model call, no
// search. Every card is rebuilt through the same builders that made it (a forged tag in the history is
// refused exactly as a forged row would be); a previous answer with no card leaves the question on the
// ordinary path. PURE: no network, no environment, no clock.

import { normalizeArabic } from './route-classify.js';

const LEADS = new Set(['ما', 'وما', 'وش', 'ايش', 'شنو', 'شو', 'طيب', 'و', 'هو', 'هي', 'يا', 'شيخ']);
const NOUNS = new Set(['مصدرك', 'مصادرك', 'المصدر', 'المصادر', 'مرجعك', 'مراجعك', 'مصدر', 'مصادر', 'مراجع', 'مصدره', 'مصادره']);
const TAILS = new Set(['في', 'فيه', 'ل', 'هذا', 'هذه', 'هذي', 'ذا', 'الجواب', 'الكلام', 'الاجابه', 'المعلومه', 'المعلومات',
  'الفتوي', 'عليه', 'عليها', 'السابق', 'للجواب', 'لهذا', 'لهذه', 'بهذا', 'يا', 'شيخ', 'من', 'اين']);
const WHERE = new Set(['اين', 'وين', 'منين']);
const TOOK = new Set(['اخذت', 'جبت', 'نقلت', 'اتيت', 'جئت', 'اخذته', 'جبته', 'نقلته']);

/** Does the reader ask only for the source of the previous answer? */
export function asksPreviousSource(question) {
  const words = normalizeArabic(String(question || '')).split(' ').filter(Boolean);
  if (!words.length || words.length > 8) return false;
  const noun = words.findIndex((w) => NOUNS.has(w));
  if (noun >= 0) {
    return words.slice(0, noun).every((w) => LEADS.has(w)) && words.slice(noun + 1).every((w) => TAILS.has(w));
  }
  // «من أين أخذت هذا الكلام؟»
  const took = words.findIndex((w) => TOOK.has(w));
  if (took < 1) return false;
  const head = words.slice(0, took);
  return head.some((w) => WHERE.has(w)) && head.every((w) => WHERE.has(w) || w === 'من' || LEADS.has(w))
    && words.slice(took + 1).every((w) => TAILS.has(w));
}

const CARD_RE = /<source\b((?:"[^"]*"|'[^']*'|[^>"'])*)>([\s\S]*?)<\/source>|<book\b((?:"[^"]*"|'[^']*'|[^>"'])*)>([\s\S]*?)<\/book>/g;
const attrOf = (attrs, name) => {
  const m = new RegExp('\\b' + name + '="([^"]*)"').exec(String(attrs || ''));
  return m ? m[1] : '';
};
// «قال X:», «وقالت X:», «ذهب X إلى», «أفتى X» -- a speech frame in the text before a card; the nearest names it.
const SPEAKER_RE = /(?:^|[\s.\u060c\u061b:])[\u0648\u0641]?(?:قال|قالت|ذكر|ذهب|أفتى|افتى|يرى|يقول|تقول|سئل|سُئل)\s+((?:(?!إن|أن|إلى|الى|في|على|بأن|عن)[^\s:\u060c.\n]+\s*){1,4}?)\s*(?=[:\u060c]|\s(?:إن|أن|إلى|الى|في|على|بأن|عن)(?=[\s.:،]|$))/u;
const SPEAKER_ALL = new RegExp(SPEAKER_RE.source, 'gu');

/**
 * The previous answer's cards, in order, each rebuilt by the caller's builders.
 * @returns {Array<{tag:string, speaker:string}>}
 */
export function previousCards(answer, { buildSourceTag, buildBookTag }) {
  const text = String(answer || '');
  const out = [];
  const seen = new Set();
  let from = 0;
  CARD_RE.lastIndex = 0;
  let m;
  while ((m = CARD_RE.exec(text))) {
    const before = text.slice(from, m.index);
    from = m.index + m[0].length;
    let card = null;
    if (m[1] !== undefined) {
      card = buildSourceTag({ url: attrOf(m[1], 'url'), title: String(m[2] || '').trim() });
    } else {
      const matn = attrOf(m[3], 'matn');
      const text64 = /^[A-Za-z0-9+/=]{1,12000}$/.test(matn) ? Buffer.from(matn, 'base64').toString('utf8') : '';
      card = buildBookTag({ bookTitle: String(m[4] || '').trim(), author: attrOf(m[3], 'author'), locator: attrOf(m[3], 'ref'),
        text: text64, matnCut: attrOf(m[3], 'cut') === '1' });
    }
    if (!card || !card.tag || seen.has(card.tag)) continue;
    seen.add(card.tag);
    // The frame nearest the card names it («فذهب بعضهم إلى … فقد قال مصطفى العدوي:» is al-'Adawi's card).
    const said = [...before.matchAll(SPEAKER_ALL)].pop();
    out.push({ tag: card.tag, speaker: said ? said[1].trim() : '' });
  }
  return out;
}

export const SOURCE_FOLLOWUP_LEAD = 'مصادر الجواب السابق كما وردت فيه:';

/** The reply: the lead, then each card under its speaker's name as the answer wrote it. '' when none. */
export function composeSourceReply(cards) {
  if (!Array.isArray(cards) || !cards.length) return '';
  const items = cards.map((c) => (c.speaker ? c.speaker + '\n' : '') + c.tag);
  return [SOURCE_FOLLOWUP_LEAD, ...items].join('\n');
}

/** The last assistant message before the current user turn, as text ('' when there is none). */
export function previousAnswerOf(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 2; i >= 0; i -= 1) {
    const m = list[i];
    if (!m || m.role !== 'assistant') continue;
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.content)) return m.content.map((c) => (c && typeof c.text === 'string' ? c.text : '')).join('');
    return '';
  }
  return '';
}
