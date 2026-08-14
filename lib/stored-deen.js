// lib/stored-deen.js
// The religious answer path: one local corpus lookup, then one answer grounded in the returned
// records. There is no planner, clarification state, web search, page fetch, source adapter,
// authority gate, or fallback to model memory in this module.

import { isStoredCorpusRecord, searchStoredCorpus } from './encyclopedia.js';
import { FINALIZATION_COMPLETE } from './finalized-sse-writer.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const SOURCE_SITE = 'الموسوعة الفقهية الكويتية';
const RECENT_USER_TURNS = 4;

export const NO_STORED_EVIDENCE =
  'لا يوجد في المصادر المخزنة لدي الآن نص كافٍ للإجابة عن هذا السؤال.';

export const IBN_BAZ_NO_RECORD_LEAD =
  'لا يوجد في مصادري المخزنة نص منسوب لابن باز في هذه المسألة، لكن الموجود في الموسوعة الفقهية المخزنة هو:';

export const STORED_DEEN_METRICS = Object.freeze({
  publicSourceSearchCalls: 0,
  publicSourceFetchCalls: 0,
  externalSourceAdapterCalls: 0,
});

const SEARCH_STOP_WORDS = new Set([
  'ما', 'ماذا', 'هو', 'هي', 'هل', 'من', 'في', 'عن', 'حول', 'علي', 'الى', 'الي', 'مع',
  'بين', 'عند', 'هذا', 'هذه', 'ذلك', 'تلك', 'ثم', 'او', 'أو', 'و', 'ف', 'ب', 'ل',
  'راي', 'قول', 'قال', 'يقول', 'الشيخ', 'شيخ', 'العالم', 'الامام', 'الدكتور', 'ابن',
  'فتوي', 'فتوى', 'حكم', 'الحكم', 'الدليل', 'دليل', 'المصدر', 'مصدر', 'المساله',
  'اقصد', 'اريد', 'يريد', 'ابي', 'فما', 'فهل', 'اذا', 'إذ', 'ان', 'أن', 'انه', 'انها',
  'له', 'لها', 'به', 'بها', 'منه', 'منها', 'عنه', 'عنها', 'الذي', 'التي', 'الذين',
]);

const GENERIC_AUTHORITIES = new Set([
  'الشرع', 'الشريعه', 'الفقه', 'الفقهاء', 'العلماء', 'اهل العلم', 'المذاهب', 'الجمهور',
]);

const FORBIDDEN_READER_LINES = [
  'أحتاج تفصيلاً قبل الجواب',
  'وجدنا صفحات متصلة بالموضوع',
  'تعذّر عليّ التحقق من مصدر موثوق لهذه الإجابة الآن',
  'لا أستطيع إرسال هذا الجواب لأن بعض ما فيه لم يتحقق من المصادر المتاحة',
];

const ANSWER_PROFILES = Object.freeze({
  brief: Object.freeze({ id: 'brief', maxTokens: 900, length: 'أجب بإيجاز واضح، في نحو 120 كلمة ما لم يحتج نقل الدليل إلى زيادة يسيرة.' }),
  normal: Object.freeze({ id: 'normal', maxTokens: 1500, length: 'أجب بطول معتدل، في نحو 250 كلمة، مع الحكم والدليل المتاحين بلا حشو.' }),
  deep: Object.freeze({ id: 'deep', maxTokens: 3000, length: 'أجب بشرح وافٍ، في نحو 500 كلمة، مع تفصيل ما يثبته النص المخزن فقط.' }),
  scholar: Object.freeze({ id: 'scholar', maxTokens: 4096, length: 'أجب بشرح موسع، في نحو 800 كلمة، مع تحرير الدليل والتفصيل الموجودين في النص المخزن فقط.' }),
});

function textOf(message) {
  if (!message) return '';
  if (typeof message.content === 'string') return message.content;
  if (!Array.isArray(message.content)) return '';
  return message.content
    .map((block) => (block && block.type === 'text' && typeof block.text === 'string' ? block.text : ''))
    .join(' ');
}

function normalizeArabic(value) {
  return String(value || '')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

function userTexts(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => message && message.role === 'user')
    .map(textOf)
    .filter((text) => text.trim())
    .slice(-RECENT_USER_TURNS);
}

// Remove only the request frame around a named opinion. The words after «في/عن/حول» are still
// the reader's own question and travel unchanged into the corpus query.
function topicClause(value) {
  const normalized = normalizeArabic(value);
  const framed = normalized.match(
    /^(?:(?:ما\s+(?:هو\s+)?(?:راي|قول))|(?:ماذا\s+(?:قال|يقول))|(?:هل\s+(?:قال|افتي))|(?:(?:اريد|ابي)\s+(?:راي|قول))|(?:راي|قول))\s+.{1,90}?\s+(?:في|فيمن|عن|حول)\s+(.+)$/u,
  );
  return framed ? framed[1] : normalized;
}

export function buildStoredSearchQuery(messages) {
  const tokens = [];
  for (const text of userTexts(messages)) {
    for (const rawToken of topicClause(text).split(/\s+/u)) {
      let token = rawToken;
      if (/^[وف]ال/u.test(token)) token = token.slice(1);
      else if (/^[وف]/u.test(token) && SEARCH_STOP_WORDS.has(token.slice(1))) token = token.slice(1);
      if (!token || token.length < 3 || SEARCH_STOP_WORDS.has(token)) continue;
      if (!tokens.includes(token)) tokens.push(token);
      if (tokens.length >= 24) break;
    }
    if (tokens.length >= 24) break;
  }
  return tokens.join(' ');
}

const SCHOLAR_REQUEST =
  /(?:(?:ما\s+(?:هو\s+)?(?:رأي|راي|قول))|(?:ماذا\s+(?:قال|يقول))|(?:هل\s+(?:قال|أفتى|افتى))|(?:(?:أريد|اريد|أبي|ابي)\s+(?:رأي|راي|قول))|(?:رأي|راي|قول))\s+(?:(?:فضيلة\s+)?(?:الشيخ|الإمام|الامام|العالم|الدكتور)\s+)?([\p{L}][\p{L}\s]{1,70}?)(?=\s+(?:في|فيمن|عن|حول)\s|[؟?]|$)/iu;

export function requestedScholarFromMessages(messages) {
  const texts = userTexts(messages);
  for (let index = texts.length - 1; index >= 0; index--) {
    const match = texts[index].match(SCHOLAR_REQUEST);
    if (!match) continue;
    const name = match[1]
      .replace(/^(?:فضيلة\s+)?(?:الشيخ|الإمام|الامام|العالم|الدكتور)\s+/u, '')
      .replace(/\s+/gu, ' ')
      .trim();
    const normalized = normalizeArabic(name);
    if (!normalized || normalized.split(' ').length > 8 || GENERIC_AUTHORITIES.has(normalized)) continue;
    return name;
  }
  return '';
}

export function isStoredDeenRequest(messages) {
  return requestedScholarFromMessages(messages) !== '';
}

export function storedAnswerProfile(depth) {
  return ANSWER_PROFILES[depth] || ANSWER_PROFILES.brief;
}

function safeTagValue(value) {
  return String(value || '').replace(/["'<>\s]/gu, '').slice(0, 64);
}

function safeTagText(value) {
  return String(value || '').replace(/[<>]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, 180);
}

export function storedSourceCard(record) {
  if (!isStoredCorpusRecord(record)) return '';
  if (!record || !/^F\d{5}$/u.test(String(record.id || ''))) return '';
  if (record.sourceType !== 'stored_fiqh_encyclopedia_record') return '';
  const id = safeTagValue(record.id);
  const term = safeTagText(record.term);
  const part = Number.isFinite(Number(record.part)) ? String(Number(record.part)) : '';
  const label = ['مادة ' + term, part ? 'الجزء ' + part : '', 'السجل ' + id].filter(Boolean).join(' — ');
  // No URL is deliberate: this is a card for an in-process record, not a claim that a public page
  // was fetched. SourceCard already renders a missing-url card as a non-clickable evidence chip.
  return `<source site="${SOURCE_SITE}" record="${id}">${label}</source>`;
}

function scholarLead(name) {
  const normalized = normalizeArabic(name);
  if (normalized === 'ابن باز') return IBN_BAZ_NO_RECORD_LEAD;
  const attributed = normalized.startsWith('ابن ') ? `ل${name}` : `لـ${name}`;
  return `لا يوجد في مصادري المخزنة نص منسوب ${attributed} في هذه المسألة، لكن الموجود في الموسوعة الفقهية المخزنة هو:`;
}

function stripModelSourceMarkup(value) {
  return String(value || '')
    .replace(/<source\b[^>]*>[\s\S]*?<\/source>/giu, '')
    .replace(/<source\b[^>]*>?[\s\S]*$/iu, '')
    .replace(/https?:\/\/[^\s<>()]+/giu, '')
    .trim();
}

function splitSentences(value) {
  return String(value || '').split(/(?<=[.!؟?])\s+|\n+/u).map((part) => part.trim()).filter(Boolean);
}

export function cleanStoredAnswer(value, { requestedScholar = '', records = [] } = {}) {
  const scholarNorm = normalizeArabic(requestedScholar);
  const kept = [];
  for (const sentence of splitSentences(stripModelSourceMarkup(value))) {
    if (FORBIDDEN_READER_LINES.some((line) => sentence.includes(line))) continue;
    if (/[؟?]/u.test(sentence)) continue;
    if (scholarNorm && normalizeArabic(sentence).includes(scholarNorm)) continue;
    kept.push(sentence);
  }
  let answer = kept.join('\n').trim();
  if (!answer && records.length) {
    const excerpt = String(records[0].text || records[0].snippet || '').trim().slice(0, 1600).trim();
    if (excerpt) answer = `من نص المادة المخزنة:\n\n${excerpt}`;
  }
  return answer;
}

function evidencePack(records) {
  return records.map((record) => ({
    record_id: record.id,
    source_type: record.sourceType,
    publisher: record.publisher,
    term: record.term,
    part: record.part,
    attributed_to: record.attributedTo,
    stored_text: record.text,
  }));
}

export function buildStoredDeenRequest({ messages, records, requestedScholar = '', depth } = {}) {
  const profile = storedAnswerProfile(depth);
  const system = [
    'أجب عن السؤال الديني اعتمادًا على Evidence Pack المخزن المرفق وحده.',
    'لا تستخدم معلومات من الذاكرة، ولا تبحث في الويب، ولا تقترح مصدرًا خارجيًّا، ولا تنشئ رابطًا أو وسم <source>.',
    'أجب طبيعيًّا من النص المسترجع. لا تطلب توضيحًا ولا تطرح أسئلة متابعة؛ إن كان في السؤال قيد لا يغطيه النص، فاذكر فقط القدر الذي يثبته النص بلا اختلاق.',
    'لا تجعل نوع المصدر أو اكتماله أو حياة شخص أو وفاته أو مرتبته سببًا لرفض الجواب.',
    requestedScholar
      ? `طلب المستخدم رأي «${requestedScholar}»، ولا يحمل أي record في Evidence Pack نسبةً إليه. لا تذكر اسمه في متن الجواب ولا تنسب إليه حكمًا؛ الخادم سيضيف بيان عدم وجود النص المنسوب.`
      : 'لا تنسب قولًا إلى عالم بعينه إلا إذا حمل record نفسه attributed_to مطابقًا، وهو غير متاح هنا.',
    'انسب المادة العامة إلى الموسوعة الفقهية الكويتية، واذكر المادة والجزء عند نفع ذلك.',
    profile.length,
  ].join('\n');
  const conversation = (Array.isArray(messages) ? messages : []).map((message) => ({
    role: message && message.role === 'assistant' ? 'assistant' : 'user',
    text: textOf(message).slice(0, 12000),
  }));
  return {
    profile,
    system,
    user: JSON.stringify({ conversation, evidence_pack: evidencePack(records) }),
  };
}

function writeTextSse(res, text) {
  // The full stored answer has already been cleaned and its cards rebuilt from marked records.
  // Stamp the target before the first byte so the shared SSE safety instrumentation can prove
  // that no draft text was written ahead of that boundary.
  res[FINALIZATION_COMPLETE] = true;
  res.write(`data: ${JSON.stringify({
    type: 'message_start',
    message: { id: 'msg_stored_deen', type: 'message', role: 'assistant', content: [] },
  })}\n\n`);
  res.write(`data: ${JSON.stringify({
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'text', text: '' },
  })}\n\n`);
  res.write(`data: ${JSON.stringify({
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'text_delta', text: String(text || '') },
  })}\n\n`);
  res.write(`data: ${JSON.stringify({ type: 'content_block_stop', index: 0 })}\n\n`);
  res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
  res.end();
}

export function writeStoredErrorSse(res, message) {
  res[FINALIZATION_COMPLETE] = true;
  res.write(`data: ${JSON.stringify({ type: 'error', error: { message } })}\n\n`);
  res.end();
}

export async function runStoredDeenTurn(res, options = {}) {
  const messages = Array.isArray(options.messages) ? options.messages : [];
  const searchQuery = buildStoredSearchQuery(messages);
  const retrieve = options.retrieve || searchStoredCorpus;
  const found = searchQuery
    ? await retrieve(searchQuery, { limit: 1 })
    : { records: [], queryTokens: [], recordCount: 0 };
  const records = Array.isArray(found && found.records)
    ? found.records.filter(isStoredCorpusRecord)
    : [];
  const requestedScholar = requestedScholarFromMessages(messages);

  if (!records.length) {
    options.beforeFirstOutput?.();
    writeTextSse(res, NO_STORED_EVIDENCE);
    return {
      outcome: 'NO_STORED_EVIDENCE',
      text: NO_STORED_EVIDENCE,
      records: [],
      searchQuery,
      requestedScholar,
      ...STORED_DEEN_METRICS,
      modelCalls: 0,
    };
  }

  const request = buildStoredDeenRequest({
    messages,
    records,
    requestedScholar,
    depth: options.depth,
  });
  const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const maxTokens = Math.min(
    request.profile.maxTokens,
    Number.isFinite(options.maxTokens) && options.maxTokens > 0 ? Math.floor(options.maxTokens) : request.profile.maxTokens,
  );
  const controller = new AbortController();
  const abort = () => { if (!controller.signal.aborted) controller.abort(); };
  options.signal?.addEventListener?.('abort', abort, { once: true });
  let response;
  try {
    response = await fetchImpl(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: options.model,
        max_tokens: maxTokens,
        ...(options.usePremium ? { output_config: { effort: options.effort === 'high' ? 'high' : 'medium' } } : {}),
        system: request.system,
        messages: [{ role: 'user', content: request.user }],
        stream: false,
      }),
    });
  } catch (error) {
    options.signal?.removeEventListener?.('abort', abort);
    if (controller.signal.aborted || error?.name === 'AbortError') {
      return {
        outcome: 'ABORTED',
        records,
        searchQuery,
        requestedScholar,
        ...STORED_DEEN_METRICS,
        modelCalls: 1,
      };
    }
    options.beforeFirstOutput?.();
    writeStoredErrorSse(res, 'upstream unavailable');
    return { outcome: 'MODEL_ERROR', records, searchQuery, requestedScholar, ...STORED_DEEN_METRICS, modelCalls: 1 };
  }
  options.signal?.removeEventListener?.('abort', abort);

  if (controller.signal.aborted || options.signal?.aborted) {
    return {
      outcome: 'ABORTED',
      records,
      searchQuery,
      requestedScholar,
      ...STORED_DEEN_METRICS,
      modelCalls: 1,
    };
  }

  if (!response.ok) {
    options.beforeFirstOutput?.();
    writeStoredErrorSse(res, `upstream ${response.status}`);
    return { outcome: 'MODEL_ERROR', records, searchQuery, requestedScholar, ...STORED_DEEN_METRICS, modelCalls: 1 };
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    options.beforeFirstOutput?.();
    writeStoredErrorSse(res, 'upstream invalid response');
    return { outcome: 'MODEL_ERROR', records, searchQuery, requestedScholar, ...STORED_DEEN_METRICS, modelCalls: 1 };
  }
  const drafted = (Array.isArray(payload.content) ? payload.content : [])
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('');
  const body = cleanStoredAnswer(drafted, { requestedScholar, records });
  const attributedRecord = requestedScholar && records.some((record) => (
    normalizeArabic(record.attributedTo) === normalizeArabic(requestedScholar)
  ));
  const lead = requestedScholar && !attributedRecord ? scholarLead(requestedScholar) : '';
  const cards = records.map(storedSourceCard).filter(Boolean);
  const answer = [lead, body, ...cards].filter(Boolean).join('\n\n').trim();

  options.beforeFirstOutput?.();
  writeTextSse(res, answer || NO_STORED_EVIDENCE);
  return {
    outcome: answer ? 'ANSWER' : 'NO_STORED_EVIDENCE',
    text: answer || NO_STORED_EVIDENCE,
    records,
    searchQuery,
    requestedScholar,
    ...STORED_DEEN_METRICS,
    modelCalls: 1,
  };
}
