// lib/front-sorter.js -- THE FRONT SORTER (order EZIK-SORTER-ORDER-2026-10-01, "understand before you frame").
//
// THE DEFECT. classifyReligiousRuntime (lib/stored-deen.js) is lexical: one word from DEEN_WORDS
// (lib/route-classify.js) is enough, and «محمد», «الشركة» (folded to «شرك»), «حساب», «عيد» are in it. So a
// table of staff names, a letter to a company, a question about a bank account, a gift for a birthday
// all arrive as STORED_FIQH, are taken by the before-writing path (BW2) and are held to fiqh texts.
//
// THE REPAIR, ONE STEP. For an adult whose question the lexicon calls STORED_FIQH or HADITH, and only
// then, one fast-model call decides RELIGIOUS or WORLDLY before the request is framed:
//   RELIGIOUS (or any doubt, timeout, error, unreadable answer)  the lexical runtime stands, as today;
//   WORLDLY                                                      the runtime becomes GENERAL.
// Nothing else changes here: no consumer of the runtime is touched, they read the value they always read.
//
// WHAT IT NEVER DOES. It never decides alone against a plain ruling word (RULING_CUES below): such a
// message is religious without a call and without waiting. It never reads anything for a child or a
// teen, never runs when the free brain is off, never runs on a live-search turn or on the canonical
// stores' scope. It writes nothing: the question is not logged, not even as a fingerprint.
//
// ZERO IMPORTS BUT route-classify.js (which itself imports nothing): this file is driven by a guard with
// an injected fake model, and must stay loadable without the handler.

import { normalizeArabic, isShortFollowUp } from './route-classify.js';

/** The fixed budget of the call. Not an environment variable: the order forbids a new one. */
export const FRONT_SORTER_MS_DEFAULT = 1500;
export const FRONT_SORTER_MAX_TOKENS = 8;
export const FRONT_SORTER_INPUT_CHARS = 2000;

// The same fast model as the BW2 judge: BW_FAST_MODEL, default claude-haiku-4-5
// (lib/before-writing-v2.js BW_FAST_MODEL_DEFAULT -- guards/front-sorter-guard.cjs holds the two equal).
export const FRONT_SORTER_MODEL_DEFAULT = 'claude-haiku-4-5';
export function sorterModel(env = process.env) {
  return String((env && env.BW_FAST_MODEL) || '').trim() || FRONT_SORTER_MODEL_DEFAULT;
}

// -- FRONT_SORTER_V1 --------------------------------------------------------------------------------
//
// ON in code, like BEFORE_WRITING_V2 and BW2_CONTINUE: only the words that plainly mean off take it
// down, so going back is one environment row and a redeploy, no code.
//
//   FRONT_SORTER_V1=off|false|0   today's behaviour byte for byte (no call, and the shari'a frame always)
//   anything else, including unset   on
export function frontSorterDecision(env = process.env) {
  const raw = String((env && env.FRONT_SORTER_V1) ?? '').trim().toLowerCase();
  return { enabled: !(raw === 'off' || raw === 'false' || raw === '0') };
}
export const FRONT_SORTER_DEFAULT = true;

// -- THE EXPLICIT RULING CUES -----------------------------------------------------------------------
//
// A message that carries one of these words is religious and is never sent to the model.
// WHOLE WORDS ONLY, after normalizeArabic, and the only thing taken off the front of a word is a
// prefix from {و، ف، ب، ال}, in any chain. NO SUFFIX IS EVER TAKEN OFF: the folding that put
// «الشركة» in the religious list (suffix «ة» then «ال») is exactly the defect being repaired, and
// «حكمة» (wisdom) and «محكمة» (a court) must not match «حكم».
const RULING_CUE_WORDS = Object.freeze([
  'حكم', 'يجوز', 'جائز', 'حلال', 'حرام', 'مكروه', 'مستحب', 'فتوى', 'الشرع', 'شرعا', 'الشريعة',
  'قال الله', 'رسول الله', 'صلى الله عليه وسلم',
]);
const RULING_CUES = Object.freeze(RULING_CUE_WORDS.map((cue) => normalizeArabic(cue).split(' ')));
const CUE_FIRST_WORDS = new Set(RULING_CUES.map((words) => words[0]));
const PROPHET_SYMBOL = String.fromCodePoint(0xFDFA);  // the ligature of the salutation -- a symbol, not a letter: normalizeArabic turns it into a space.

const PREFIXES = Object.freeze(['ال', 'و', 'ف', 'ب']);

/** Every form of one word with prefixes from the closed set taken off, the word itself included. */
export function prefixForms(word) {
  const forms = new Set([word]);
  let frontier = [word];
  while (frontier.length) {
    const next = [];
    for (const form of frontier) {
      for (const prefix of PREFIXES) {
        if (form.length > prefix.length && form.startsWith(prefix)) {
          const rest = form.slice(prefix.length);
          if (!forms.has(rest)) { forms.add(rest); next.push(rest); }
        }
      }
    }
    frontier = next;
  }
  return forms;
}

/** Does this message carry an explicit ruling cue? Pure and synchronous. */
export function hasRulingCue(raw) {
  const text = String(raw == null ? '' : raw);
  if (text.includes(PROPHET_SYMBOL)) return true;
  const words = normalizeArabic(text).split(' ').filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const forms = prefixForms(words[i]);
    for (const cue of RULING_CUES) {
      if (!forms.has(cue[0])) continue;
      if (cue.length === 1) return true;
      // A phrase: the first word may wear prefixes, the rest must follow exactly.
      let whole = true;
      for (let j = 1; j < cue.length; j++) if (words[i + j] !== cue[j]) { whole = false; break; }
      if (whole) return true;
    }
  }
  return false;
}

// -- WHEN IT IS ASKED -------------------------------------------------------------------------------
export const SORTER_STATES = Object.freeze(['not_asked', 'ruling_cue', 'worldly', 'religious', 'timeout', 'error', 'disabled']);
export const SORTED_RUNTIMES = Object.freeze(['STORED_FIQH', 'HADITH']);

/**
 * Should the model be asked? Every condition together; otherwise nothing changes.
 * @returns {{ask:boolean, sorter:'not_asked'|'ruling_cue'|'disabled'}}
 */
export function sorterEligibility({
  enabled = false, band = '', freeBrainEnabled = false, runtime = '', liveSearch = false, excluded = '', text = '', closedDeen = false,
} = {}) {
  if (!enabled) return { ask: false, sorter: 'disabled' };
  if (band !== 'adult') return { ask: false, sorter: 'not_asked' };
  if (!freeBrainEnabled) return { ask: false, sorter: 'not_asked' };
  if (!SORTED_RUNTIMES.includes(runtime)) return { ask: false, sorter: 'not_asked' };
  if (liveSearch === true) return { ask: false, sorter: 'not_asked' };
  if (excluded === 'canonical_store' || excluded === 'estate_division') return { ask: false, sorter: 'not_asked' };
  // A registered hadith the closed dispatcher answers with no model at all: the sorter adds no call to a turn that makes none.
  if (closedDeen === true) return { ask: false, sorter: 'not_asked' };
  if (hasRulingCue(text)) return { ask: false, sorter: 'ruling_cue' };
  return { ask: true, sorter: 'not_asked' };
}

/** WORLDLY turns the lexical runtime into GENERAL; every other state leaves it as it is. */
export function runtimeAfterSorter(lexicalRuntime, sorter) {
  return sorter === 'worldly' ? 'GENERAL' : lexicalRuntime;
}

// -- THE MODEL'S INSTRUCTIONS, LETTER FOR LETTER AS THE ORDER GAVE THEM -----------------------------
export const FRONT_SORTER_SYSTEM = [
  'You are the routing step of an Islamic educational app. You never answer the user. You only classify the latest user message.',
  '',
  'Reply with exactly one word: RELIGIOUS or WORLDLY.',
  '',
  'RELIGIOUS: the message asks about Islamic rulings, worship, belief, the Quran, hadith, tafsir, the life of the Prophet or the Companions, a scholar\'s opinion, the Islamic view of anything, or any Islamic knowledge; or it mixes such a question with anything else; or it asks to summarize, translate, explain or format a text that is itself religious.',
  '',
  'WORLDLY: the message asks for a worldly task or a worldly answer: formatting a table or a list, writing a letter, a message or an email, translating or summarizing a worldly text, arithmetic and calculations, programming, planning, recipes, school subjects other than Islamic studies, or general knowledge. This holds even when the message contains names such as Muhammad, Ibrahim, Yusuf, Aisha, Fatima or Maryam, or words such as company, account or Eid, or any other word that also appears in religious contexts.',
  '',
  'If the latest message is a short follow-up, classify it by the previous user message it follows.',
  '',
  'If you are not sure, reply RELIGIOUS.',
  '',
  'Examples:',
  'رتّب لي أسماء الطلاب أبجديًّا: يوسف، إبراهيم، محمد → WORLDLY',
  'اكتب لي إيميلًا لشركة الطيران أطلب استرجاع المبلغ → WORLDLY',
  'كيف أفتح حسابًا في البنك؟ → WORLDLY',
  'من هو أول من أسلم من الرجال؟ → RELIGIOUS',
  'اقترح لي طريقة لتغليف هدايا العيد → WORLDLY',
  'ما سنن العيد؟ → RELIGIOUS',
  'اكتب لي جدول مذاكرة، وما فضل المذاكرة بعد الفجر؟ → RELIGIOUS',
  'لخّص لي هذا الدرس في التوحيد: … → RELIGIOUS',
  'ترجم لي هذا العقد التجاري إلى الإنجليزية: … → WORLDLY',
].join('\n');

// -- WHAT IT IS SHOWN -------------------------------------------------------------------------------
function textOf(message) {
  const c = message && message.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join(' ');
  return '';
}

/**
 * The model's input: the reader's last message (first 2000 characters); and, when it is a short
 * follow-up by route-classify's own measure, the reader's previous message above it.
 */
export function sorterInput(messages) {
  const users = (Array.isArray(messages) ? messages : []).filter((m) => m && m.role === 'user');
  const latest = textOf(users[users.length - 1]).slice(0, FRONT_SORTER_INPUT_CHARS);
  const previous = users.length > 1 ? textOf(users[users.length - 2]).slice(0, FRONT_SORTER_INPUT_CHARS) : '';
  if (previous && isShortFollowUp(latest)) {
    return `Previous user message:\n${previous}\n\nLatest user message:\n${latest}`;
  }
  return latest;
}

/** WORLDLY, any case, with punctuation after it, is worldly; everything else reads as religious. */
export function readSorterAnswer(raw) {
  if (typeof raw !== 'string') return 'error';
  const word = raw.trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '').toLowerCase();
  if (word === 'worldly') return 'worldly';
  if (word === 'religious') return 'religious';
  return 'error';
}

// The non-streaming provider call, the same shape as the BW2 judge's (lib/before-writing-v2.js defaultAsk),
// with temperature 0. Kept here and not imported: that file is not to be touched by this round.
async function defaultAsk({ providerUrl, headers, model, system, user, maxTokens, signal }) {
  const response = await fetch(providerUrl, {
    method: 'POST', headers, signal,
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!response.ok) throw new Error('sorter_http_' + response.status);
  const payload = await response.json();
  return (Array.isArray(payload && payload.content) ? payload.content : [])
    .filter((block) => block && block.type === 'text').map((block) => block.text).join('');
}

/**
 * Start the call and return at once. The returned object never rejects:
 *   .promise  resolves to {sorter:'worldly'|'religious'|'timeout'|'error', ms}
 *   .cancel() aborts the call (a turn that left before it was needed)
 * `ask` is injectable so a guard fakes the model; `now` and `timeoutMs` likewise.
 */
export function startSorter({
  messages, ask, providerUrl, headers, env = process.env, signal = null,
  timeoutMs = FRONT_SORTER_MS_DEFAULT, now = Date.now,
} = {}) {
  const started = now();
  const controller = new AbortController();
  const callSignal = signal && typeof AbortSignal.any === 'function'
    ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  let timer = null;
  let settled = false;
  let finish = () => {};
  const promise = new Promise((resolve) => {
    const done = (sorter) => { if (settled) return; settled = true; clearTimeout(timer); resolve({ sorter, ms: Math.max(0, now() - started) }); };
    finish = done;
    timer = setTimeout(() => { controller.abort(); done('timeout'); }, timeoutMs);
    try {
      const caller = typeof ask === 'function' ? ask : defaultAsk;
      Promise.resolve()
        .then(() => (settled ? '' : caller({
          providerUrl, headers, model: sorterModel(env), system: FRONT_SORTER_SYSTEM,
          user: sorterInput(messages), maxTokens: FRONT_SORTER_MAX_TOKENS, signal: callSignal,
        })))
        .then((raw) => done(readSorterAnswer(raw)), () => done('error'));
    } catch {
      done('error');
    }
  });
  // A cancelled run resolves at once as 'error' (nobody awaits it: the turn that cancelled it has left).
  return { promise, cancel: () => { try { controller.abort(); } catch { /* nothing to cancel */ } finish('error'); } };
}
