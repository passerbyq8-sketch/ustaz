// lib/lang/question.js -- THE QUESTION, CARRIED INTO ARABIC (item 74, rulings h6 and h7).
//
// The brain's classifiers, guards and prompts are written in Arabic and are not rewritten (contract §2-ج):
// a question in another language is translated to Arabic FIRST and then travels the existing path as if the
// reader had typed it in Arabic. The translation treats the question as TEXT, never as a command (h6): the
// system prompt says so, and the app's own safeguards then see what was really asked.
//
// If the translation cannot be had, the turn ends with a fixed sentence in the reader's language -- the
// question is never forwarded untranslated to a path that cannot read it.
import { callTranslator, parseStringArray, QUESTION_TO_ARABIC_SYSTEM } from './model.js';

export const TRANSLATION_FAILED_TEXT = {
  en: 'Sorry, I could not process your question just now. Please try again in a moment.',
};
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
 * @returns {Promise<{ok:boolean, ms:number, count:number}>}
 */
export async function translateQuestionInPlace(messages, { lang = 'en', translate = callTranslator } = {}) {
  const t0 = Date.now();
  const li = lastUserIndex(messages);
  const targets = [];
  for (let i = Math.max(0, li - HISTORY_MAX_MESSAGES); i < li; i++) {
    const t = messageText(messages[i] && messages[i].content); if (t == null) continue;
    if (countOf(t, LATIN) >= 20 && countOf(t, LATIN) > 2 * countOf(t, ARABIC)) targets.push({ i, cut: HISTORY_MAX_CHARS });
  }
  targets.push({ i: li, cut: QUESTION_MAX_CHARS });
  const texts = targets.map(({ i, cut }) => String(messageText(messages[i].content)).slice(0, cut));
  const user = JSON.stringify(texts);
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await translate({ system: QUESTION_TO_ARABIC_SYSTEM, user, maxTokens: 2048, timeoutMs: 25000 });
    const arr = r.ok ? parseStringArray(r.text, texts.length) : null;
    if (arr && arr.every((t) => t.trim())) {
      targets.forEach(({ i }, k) => { messages[i].content = arr[k]; });
      return { ok: true, ms: Date.now() - t0, count: targets.length };
    }
  }
  return { ok: false, ms: Date.now() - t0, count: targets.length };
}
