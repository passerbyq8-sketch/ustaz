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

// SPEED PIPES2 fix 1 (order EZIK-SPEED-PIPES2-ORDER-2026-09-28, item 1): ANY WORDING, NOT A LIST OF WORDINGS.
// MEASURED (round 7, question 11-b, preview log): «ما المراجع التي اعتمدت عليها في هذا الجواب؟» was not one of
// fix 8's sentences («المراجع» was not in its noun list, «التي» and «اعتمدت» not in its tails), so it went to the
// model path as GENERAL: one round, 7.8 s, no card -- and the model listed the sources itself, named the owner of
// salmajed.com «سعد الماجد», said four and listed five, and left out the binbaz.org.sa card. The question is now
// read by its parts: every word must be a source noun (any article, welded preposition or possessive), the
// reader's verb for what the answer did with its sources («اعتمدت»، «استندت»، «رجعت» …), «where did you take
// it», a word that points at the answer («هذا الجواب»، «الكلام»، «الحكم»), or a function word. One content word
// of any other kind -- «التشريع», «الحديث», «الفقه الحنبلي» -- and it is not a follow-up about the answer.
const SOURCE_NOUN_RE = /^(?:[وفبل]|وال|فال|بال|لل|ال)?(?:مصدر|مصادر|مرجع|مراجع)(?:ك|كم|ه|ها|ي)?$/u;
const SOURCE_VERB_RE = /^[وف]?(?:اعتمدت|استندت|رجعت|نقلت|اخذت|استقيت|جبت|استفدت|بنيت|اتيت|جئت)(?:ه|ها)?$/u;
const WHERE = new Set(['اين', 'وين', 'منين']);
// ORDER 52 item 12 (the owner's decision): «من أي كتاب أو موقع أخذت هذا الجواب بالتحديد؟» and «هل أنت متأكد أنك أخذته من هذا المصدر نفسه؟» are source questions. A BOOK or a SITE is a source noun only beside the reader's verb of taking
// («أخذت/جبت/نقلت…»), so «ما هذا الكتاب؟» is still not one; the frame of the second («هل أنت متأكد أنك … نفسه») is function words, and it needs a real source noun («المصدر») to count.
const BOOKSITE_RE = /^(?:[وفبل]|وال|فال|بال|لل|ال)?(?:كتاب|كتب|موقع|مواقع|موقعا|كتابا)(?:ك|كم|ه|ها)?$/u;
const TOOK = new Set(['اخذت', 'جبت', 'نقلت', 'اتيت', 'جئت', 'اخذته', 'جبته', 'نقلته']);
const POINTERS = new Set(['الجواب', 'الكلام', 'الاجابه', 'المعلومه', 'المعلومات', 'الفتوي', 'الرد', 'القول', 'الحكم',
  'السابق', 'للجواب', 'للكلام']);
const FUNCTION_WORDS = new Set(['ما', 'وما', 'ماهي', 'ماهو', 'ماذا', 'هي', 'هو', 'وش', 'ايش', 'شنو', 'شو', 'طيب', 'و', 'يا',
  'شيخ', 'التي', 'الذي', 'اللي', 'عليها', 'عليه', 'اليها', 'اليه', 'لها', 'له', 'منها', 'منه', 'بها', 'به', 'في', 'فيه',
  'من', 'علي', 'عن', 'الي', 'ل', 'لي', 'لنا', 'هذا', 'هذه', 'هذي', 'ذا', 'ذلك', 'تلك', 'هنا', 'لهذا', 'لهذه', 'بهذا',
  'اذكر', 'اذكرلي', 'اعطني', 'عطني', 'هات', 'ممكن', 'تذكر', 'تعطيني', 'تعطينا', 'ارجو', 'لو', 'سمحت', 'فضلا', 'كل',
  'جميع', 'بالتفصيل', 'اي', 'او', 'بالتحديد', 'نفسه', 'نفسها', 'انت', 'انك', 'متاكد', 'متاكده']);

/** Does the reader ask only for the source of the previous answer? */
export function asksPreviousSource(question) {
  let words = normalizeArabic(String(question || '')).split(' ').filter(Boolean);
  // ORDER 52 item 12: «هل» is a function word only in the confirming frame «هل أنت متأكد …» (so «هل رجعت؟» is still not a source question).
  if (words[0] === 'هل' && (words.includes('متاكد') || words.includes('متاكده'))) words = words.slice(1);
  if (!words.length || words.length > 12) return false;
  let noun = false;
  let verb = false;
  let where = false;
  let took = false;
  let bookSite = false;
  for (const w of words) {
    if (SOURCE_NOUN_RE.test(w)) noun = true;
    else if (BOOKSITE_RE.test(w)) bookSite = true;
    else if (SOURCE_VERB_RE.test(w)) { verb = true; if (TOOK.has(w)) took = true; }
    else if (WHERE.has(w)) where = true;
    else if (TOOK.has(w)) took = true;
    else if (!POINTERS.has(w) && !FUNCTION_WORDS.has(w)) return false;
  }
  return noun || verb || (where && took);
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
