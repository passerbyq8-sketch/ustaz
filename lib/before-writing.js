// lib/before-writing.js — «قبلَ الكتابة» (BEFORE_WRITING_V1): the sharia question's evidence is
// gathered IN PARALLEL and PINNED before the first character is written.
//
// THE OWNER'S DECISION (program order 2026-09-24, §٢-٥): «المخُّ يُبنى على قبلَ الكتابة» — matching
// by the issue and not by the words, fidelity to the text sentence by sentence, and whatever the
// store does not cover is said plainly. Item م٢-أ: «في السؤالِ الشرعيِّ يُجمَعُ في الثانيةِ الأولى
// بالتوازي — الفتاوى المخزّنة · المكتبة · الموسوعة — ويُثبَّتُ قبلَ أوّلِ حرف. وسؤالُ الحديثِ يبقى على
// طريقِ التخريج، ولا تأتيه كتبُ الفقهِ ولا الموسوعةُ ولو كانَ موضوعُه فقهيًّا».
//
// WHAT WAS MEASURED BEFORE A LINE OF THIS WAS WRITTEN (program-2026-09-24/02-brain/measure):
//   * the first-second block returned ZERO rows on 8 of 8 logged production turns: the fatwa store
//     was sent the reader's raw question (240 chars; the service answers 400 past 180, and ANDs
//     every token, so a natural question matches nothing);
//   * owner test 11 («من روى حديث: «من غشنا فليس منا»…») is classified STORED_FIQH, so it received
//     fiqh books and encyclopedia headwords in place of its takhrij; owner test 12 («ما درجة حديث»)
//     is HADITH yet the model's own `search_sources` handed it the encyclopedia;
//   * the encyclopedia row the model reads is the first 1,200 characters of the article — its
//     definition — while the madhhab positions sit further on; owner test 7 was manufactured by that
//     cut («وَيَرَى الْحَنَابِلَةُ أَنَّ الرُّعَافَ لاَ يَنْقُضُ» with its «إلا إذا كان فاحشًا» cut off).
// So this module (1) decides hadith vs fiqh BEFORE anything is fetched, (2) builds SHORT issue
// queries, (3) fetches the three stores in one Promise.all under one deadline, (4) adds the rows to
// the turn's table AFTER the deadline and in a FIXED order, and (5) carries each row's full text
// (`fullText`) beside the 1,200-character `text` the old renderers read, for the writer and for the
// sentence-level door (./ruling-review.js).
//
// NOTHING HERE RUNS WITH THE SWITCH OFF. `beforeWritingEnabled` is read in api/ask.js and the loop
// is handed `beforeWriting: null` unless it is on, and null is the whole of the old behaviour.
import { normalizeArabic } from './route-classify.js';
import { asksForGrading } from './policy/takhrij-disclosure.js';

export const BEFORE_WRITING_ON = 'on';

// م٢-ج — THE FAST READER. The sentence-level door (./ruling-review.js) is one call to a fast model;
// 'claude-haiku-4-5' is already a production model id here (api/tashkeel.js). Overridable, never empty.
export const BW_FAST_MODEL_DEFAULT = 'claude-haiku-4-5';
export function fastModel(env = process.env) {
  return String((env && env.BW_FAST_MODEL) || '').trim() || BW_FAST_MODEL_DEFAULT;
}

/** The switch. Only the literal «on» opens it; an absent or malformed value is off. */
export function beforeWritingEnabled(env = process.env) {
  return String((env && env.BEFORE_WRITING_V1) ?? '').trim().toLowerCase() === BEFORE_WRITING_ON;
}

// ── م٢-أ: IS THIS A HADITH QUESTION? DECIDED BEFORE ANYTHING IS FETCHED ──────────────────
//
// THREE ROADS IN, ANY ONE SUFFICES:
//   1. the stored-context runtime already says HADITH (lib/stored-deen.js);
//   2. the reader asks for a VERDICT on a report's authenticity (asksForGrading, the careful
//      detector the takhrij disclosure owns — «هل يصح الصيام بلا نية» is NOT such a question, which
//      is why the looser `asksGradeOrSource` is not used here);
//   3. the reader asks who narrated it, whether it is sound, where it is found — AND names a hadith
//      or quotes a text. The question word alone is not enough: «هل يصح صوم من …» is fiqh.
const HADITH_NOUN_RE = /(?:^|\s)(?:[وفب]?(?:ال)?حديث|(?:ال)?احاديث|[وف]?(?:ال)?اثر)(?:\s|$)/u;
const HADITH_ASK_RE = new RegExp('(?:^|\\s)(?:'
  + 'من\\s+(?:روي|رواه|اخرجه|خرجه|يرويه)'
  + '|هل\\s+(?:صح|يصح|ثبت|يثبت|هو\\s+في|ورد)'
  + '|ما\\s+(?:صحه|درجه|مدي\\s+صحه)'
  + '|(?:ال)?درجه|(?:ال)?صحه|تخريج(?:ه|ها)?|اين\\s+ورد|رواه'
  + '|في\\s+(?:الصحيحين|البخاري|مسلم|صحيح|السنن)'
  + ')(?:\\s|$)', 'u');
const QUOTED_TEXT_RE = /«[^«»]{4,}»|"[^"]{4,}"|“[^”]{4,}”/u;

export function classifyShariaTurn({ question, storedRuntime, lexicalRoute } = {}) {
  if (lexicalRoute !== 'DEEN') return 'other';
  const raw = String(question || '');
  if (storedRuntime === 'HADITH') return 'hadith';
  if (asksForGrading(raw)) return 'hadith';
  const norm = ' ' + normalizeArabic(raw) + ' ';
  if (HADITH_ASK_RE.test(norm) && (HADITH_NOUN_RE.test(norm) || QUOTED_TEXT_RE.test(raw))) return 'hadith';
  if (storedRuntime === 'STORED_FIQH') return 'fiqh';
  return 'other';
}

// ── م٢-ب: «وسّع البحث» — THE READER'S OWN REQUEST TO GO BEYOND THE PINNED TEXTS ────────────
//
// The answer written from the pinned evidence offers this when the evidence did not suffice. The
// reader asking for it is the only thing that brings the live search back; the turn then runs the
// old loop, tools and all. A fixed phrase, matched deterministically, so the key is the reader's.
export const WIDEN_SEARCH_PROMPT = 'وسّع البحث في المصادر';
const WIDEN_RE = /(?:^|\s)(?:وسع\s+(?:ال)?بحث|ابحث\s+(?:اكثر|اوسع|في\s+مصادر\s+اخري)|بحث\s+اوسع)(?:\s|$)/u;
export function asksToWidenSearch(question) {
  return WIDEN_RE.test(' ' + normalizeArabic(String(question || '')) + ' ');
}

// ── THE ISSUE'S OWN WORDS: THE QUESTION WITHOUT ITS FRAME ─────────────────────────────────
//
// MEASURED on the library twin (F): the reader's frame decides the result — «ما حكم صلاة الخوف عند
// المذاهب الأربعة» is AND(المذاهب، الخوف) past the budget, and «المذاهب» zeroes every madhhab book;
// and the fatwa store ANDs every token, so a long question matches nothing. The frame is removed
// first; what is left is the issue.
const FRAME_WORDS = new Set([
  'ما', 'ماذا', 'هل', 'كيف', 'متي', 'اين', 'لماذا', 'لم', 'من', 'كم', 'اي', 'وهل', 'فهل', 'او', 'ام', 'و',
  'حكم', 'الحكم', 'يجوز', 'لا', 'جائز', 'حلال', 'حرام', 'شرعا', 'الشرع', 'الشرعي', 'الاسلام',
  'في', 'علي', 'عن', 'الي', 'الى', 'مع', 'عند', 'بين', 'بعد', 'قبل', 'حتي', 'ثم', 'اذا', 'ان', 'انا', 'انه',
  'انها', 'كان', 'كانت', 'يكون', 'تكون', 'هذا', 'هذه', 'ذلك', 'تلك', 'الذي', 'التي', 'هو', 'هي', 'هم',
  'وانا', 'عندي', 'لي', 'لنا', 'اريد', 'ابي', 'ابغي', 'ودي', 'ابغى', 'اذكر', 'اشرح', 'بين', 'وضح', 'فصل',
  'اعطني', 'قل', 'قول', 'اقوال', 'رأي', 'راي', 'المذاهب', 'المذهب', 'مذاهب', 'الاربعه', 'الاربع', 'الائمه',
  'العلماء', 'الفقهاء', 'اهل', 'العلم', 'حسب', 'بالتفصيل', 'تفصيل', 'كامله', 'كامل', 'باختصار', 'مع',
  'الدليل', 'بالدليل', 'دليل', 'ادله', 'بادلتها', 'والخلاف', 'الخلاف', 'والراجح', 'الراجح', 'مسأله',
  'مساله', 'المسأله', 'المساله', 'سؤال', 'سوال', 'يا', 'شيخ', 'الشيخ', 'لو', 'سمحت', 'جزاك', 'الله',
  'خيرا', 'خير', 'بس', 'شنو', 'شلون', 'وش', 'ايش', 'يعني', 'فيه', 'فيها', 'به', 'بها', 'له', 'لها',
  'ذكر', 'كل', 'احكام', 'الاحكام', 'صفات', 'صفه', 'كيفيه', 'اقوال', 'الاقوال', 'بادلته', 'بادلتها',
  'ادلتها', 'ادلته', 'كامله', 'تفصيلا', 'مفصلا', 'انقله', 'بحروفه', 'نص', 'كلام',
]);
// A frame word with a conjunction or a preposition welded on («وحكم», «لمذاهب», «بالتفصيل») is still
// the frame: the one letter is dropped and the rest asked again.
const WELDED = /^[وفلب]/u;
const isFrame = (token) => FRAME_WORDS.has(token)
  || (WELDED.test(token) && (FRAME_WORDS.has(token.slice(1)) || FRAME_WORDS.has('ال' + token.slice(1))));
export function issueTerms(question) {
  const out = [];
  for (const token of normalizeArabic(String(question || '')).split(' ')) {
    if (token.length < 2 || isFrame(token) || /^[0-9]+$/u.test(token)) continue;
    if (!out.includes(token)) out.push(token);
  }
  return out;
}

/** The fatwa store's own cap (MAX_QUERY_CHARS in the service), kept below on every query sent. */
export const FATWA_QUERY_MAX = 180;
const capChars = (words, max) => {
  let text = '';
  for (const word of words) {
    const next = text ? `${text} ${word}` : word;
    if (next.length > max) break;
    text = next;
  }
  return text;
};

/**
 * Two SHORT queries for the fatwa store, run side by side: the issue's first three words and its
 * last three. The store ANDs every token, so three is the most a query can carry and still match
 * a fatwa written in other words; a fiqh question usually opens on its subject and closes on its
 * ruling, which is why the two ends are asked separately. Deduplicated, so a short issue asks once.
 */
export function fatwaQueries(question) {
  const terms = issueTerms(question);
  if (!terms.length) return [];
  const head = capChars(terms.slice(0, 3), FATWA_QUERY_MAX);
  const tail = capChars(terms.slice(-3), FATWA_QUERY_MAX);
  return [...new Set([head, tail].filter(Boolean))];
}

/** The library/encyclopedia query: the whole issue, frame removed, under the same cap. */
export function libraryQuery(question) {
  return capChars(issueTerms(question), FATWA_QUERY_MAX);
}
/** The narrower retry when the service refuses or returns nothing: the issue's last three words. */
export function narrowLibraryQuery(question) {
  const terms = issueTerms(question);
  return terms.length > 3 ? capChars(terms.slice(-3), FATWA_QUERY_MAX) : '';
}

// ── WHICH BOOKS: THE COMPARATIVE TWO, ALWAYS ──────────────────────────────────────────────
// FC-003910 is the Kuwaiti encyclopedia AS A LIBRARY BOOK: split by page, with volume, printed page
// and heading path — the copy that can back a madhhab attribution with a place (measured F). And
// FC-003592 is «بداية المجتهد ونهاية المقتصد», the owner's named comparative text. The in-process
// encyclopedia below is the same encyclopedia without pages; it is kept because it is free and fast.
export const COMPARATIVE_BOOK_IDS = Object.freeze(['FC-003910', 'FC-003592']);

export const BW_FATWA_MAX_ROWS = 4;
export const BW_ENCYC_MAX_ROWS = 3;
export const BW_LIBRARY_MAX_ROWS = 4;
/** How much of one atom the library is asked for, and how much of it a pinned row carries. */
export const BW_LIBRARY_CHARS = 2400;
/** The encyclopedia's stored text is ≤ 6000 characters; that is what a pinned row carries. */
export const BW_ENCYC_CHARS = 6000;
/**
 * ONE deadline for the whole gathering. Measured: fatwa ~0.4-1.0 s, library ~0.6 s (twin) / ~1.0 s
 * (Vercel), a cold encyclopedia build 2.1-2.4 s. A member still out at the deadline is abandoned and
 * its late rows are never added — rows are added AFTER the race, never inside a search.
 */
export const BW_GATHER_MS = 3500;

// One member of the Promise.all. It runs `runTool` against a PRIVATE table so the turn's refs are
// assigned later, in a fixed order, and never by whichever network reply lands first (measured A:
// «the refs depend on which reply lands first»).
function member(runTool, name, input, ctx, extra) {
  const own = {
    ...ctx,
    ...extra,
    table: { rows: [], add(row) { this.rows.push(row); return row; }, byRef() { return null; } },
    spend: [],
    degraded: [],
  };
  return runTool(name, input, own).then(
    (out) => ({ rows: own.table.rows, spend: own.spend, degraded: own.degraded, ok: true, out }),
    (error) => ({ rows: [], spend: own.spend, degraded: [...own.degraded, `${name}:${String(error?.message || error)}`], ok: false }),
  );
}

function raceDeadline(promise, ms, empty) {
  let timer = null;
  const deadline = new Promise((resolve) => { timer = setTimeout(() => resolve(empty), ms); });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

/**
 * Gather the pinned evidence for a FIQH turn. Never throws. Returns the rows ADDED to `table`
 * (fatwas, then encyclopedia, then library — a fixed order) and a record of what each member did.
 *
 * `deps` carries the four collaborators so a guard can drive this without the network:
 *   runTool, searchStoredCorpus, encyclopediaRow, warmEncyclopedia.
 */
export async function gatherBeforeWriting({ question, table, ctx, libFlagValue, libToken, deps, deadlineMs = BW_GATHER_MS }) {
  const record = { fired: true, fatwaQueries: 0, fatwaRows: 0, encycRows: 0, libRows: 0, libRetried: false, reasons: [] };
  const { runTool, searchStoredCorpus, encyclopediaRow } = deps;
  const signal = ctx && ctx.signal;
  const empty = { rows: [], spend: [], degraded: ['deadline'], ok: false };

  const fq = fatwaQueries(question);
  record.fatwaQueries = fq.length;
  const lq = libraryQuery(question);
  const libOn = libFlagValue === 'on' && typeof libToken === 'string' && libToken !== '' && lq !== '';

  const fatwaMembers = fq.map((query) => raceDeadline(member(runTool, 'search_fatawa', { query }, ctx), deadlineMs, empty));
  const encycMember = lq
    ? raceDeadline(
      Promise.resolve()
        .then(() => searchStoredCorpus(lq, { limit: 6 }))
        .then((found) => ({ records: Array.isArray(found && found.records) ? found.records : [], ok: true }))
        .catch((error) => ({ records: [], ok: false, reason: String(error?.message || error) })),
      deadlineMs, { records: [], ok: false, reason: 'deadline' })
    : Promise.resolve({ records: [], ok: false, reason: 'no_query' });
  const libExtra = {
    libFlagValue, libToken, bookIds: [...COMPARATIVE_BOOK_IDS], resultCap: BW_LIBRARY_MAX_ROWS,
    maxCharsPerHit: BW_LIBRARY_CHARS, keepFullText: true,
  };
  const libMember = libOn
    ? raceDeadline(
      member(runTool, 'search_library', { query: lq }, ctx, libExtra).then(async (first) => {
        if (first.rows.length) return first;
        // ONE narrower retry when the service refused the phrasing or found nothing (measured F:
        // a refusal is `ok:true, refused:true, 0 records`, and wording decides the result).
        const narrow = narrowLibraryQuery(question);
        if (!narrow || narrow === lq) return first;
        record.libRetried = true;
        const second = await member(runTool, 'search_library', { query: narrow }, ctx, libExtra);
        return { ...second, spend: [...first.spend, ...second.spend], degraded: [...first.degraded, ...second.degraded] };
      }),
      deadlineMs, empty)
    : Promise.resolve({ rows: [], spend: [], degraded: [], ok: false });

  const [fatwaOuts, encycOut, libOut] = await Promise.all([Promise.all(fatwaMembers), encycMember, libMember]);
  // Every member's spend and notes are the turn's, and each spend row is LABELLED as unrequested.
  for (const out of [...fatwaOuts, libOut]) {
    for (const spent of out.spend) ctx.spend.push({ ...spent, injected: true, beforeWriting: true });
    for (const note of out.degraded) ctx.degraded.push(`before_writing:${note}`);
  }
  if (encycOut && encycOut.reason && encycOut.reason !== '') record.reasons.push(`encyclopedia:${encycOut.reason}`);

  const added = [];
  const seenFatwa = new Set();
  for (const out of fatwaOuts) {
    for (const row of out.rows) {
      const key = row.url || row.recordId || row.title;
      if (seenFatwa.has(key) || record.fatwaRows >= BW_FATWA_MAX_ROWS) continue;
      seenFatwa.add(key);
      added.push(table.add(row));
      record.fatwaRows += 1;
    }
  }
  const records = (encycOut && Array.isArray(encycOut.records) ? encycOut.records : [])
    .filter((rec) => rec && String(rec.snippet || '').trim() !== '')
    .slice(0, BW_ENCYC_MAX_ROWS);
  for (const rec of records) {
    added.push(table.add({ ...encyclopediaRow(rec), fullText: String(rec.text || '').slice(0, BW_ENCYC_CHARS) }));
    record.encycRows += 1;
  }
  for (const row of (libOut.rows || []).slice(0, BW_LIBRARY_MAX_ROWS)) {
    added.push(table.add(row));
    record.libRows += 1;
  }
  return { added, record };
}

// ── THE PINNED BLOCK THE WRITER READS ─────────────────────────────────────────────────────
//
// Each row is named by WHAT IT IS — a fatwa and its scholar, the encyclopedia and its volume, a book
// with its author and place — and not «من قسم الفتاوى», which the old note said of every row
// (measured E: library and encyclopedia rows were labelled «from the fatwa section»). The text is the
// row's FULL text, capped, because the madhhab positions sit past the 1,200 characters `text` holds.
export const BW_ROW_CHARS = 3500;
export const BW_PINNED_NOTE = 'نصوصٌ جُمِعَتْ لهذا السؤالِ قبلَ الكتابة: فتاوى، ومقاطعُ من الموسوعة الفقهية الكويتية، '
  + 'ومن كتب الفقه. كلُّ نصٍّ بعلامتِه [[n]] ومصدرِه. خُذْ منها ما يُجيبُ المسألةَ بعينِها، '
  + 'واتركْ ما لا يُجيبُها، وضَعْ علامةَ النصِّ بعدَ كلِّ جملةٍ تأخذُها منه.';

export function sourceLabel(row) {
  if (!row) return '';
  if (row.kind === 'fatwa') return ['فتوى', row.publisher, row.title].filter(Boolean).join(' — ');
  if (row.kind === 'encyclopedia') {
    return ['الموسوعة الفقهية الكويتية', row.part ? `ج${row.part}` : '', String(row.title || '').replace(/^الموسوعة الفقهية الكويتية — /u, '')]
      .filter(Boolean).join(' — ');
  }
  if (row.kind === 'lib_book') return ['كتاب', row.bookTitle || row.title, row.author, row.locator].filter(Boolean).join(' — ');
  return [row.title, row.publisher].filter(Boolean).join(' — ');
}

export function renderPinnedEvidence(rows) {
  if (!rows.length) return 'لم يُجمَعْ لهذا السؤالِ نصّ.';
  return rows.map((row) => [
    `[[${row.ref}]] ${sourceLabel(row)}`,
    `النص: ${String(row.fullText || row.text || '').slice(0, BW_ROW_CHARS)}`,
  ].join('\n')).join('\n\n───\n\n');
}

// ── م٢-ب: ONE WRITING ROUND, FROM THE PINNED TEXTS, AND SAID PLAINLY WHEN THEY DO NOT SUFFICE ──
//
// The owner's item: «جولةُ نموذجٍ واحدة تكتبُ من الدليلِ المثبَّت؛ والبحثُ الحيُّ لا يُنتظَر: إن لم يكفِ
// الدليلُ قالَ الجوابُ ذلك صراحةً، وعرضَ توسيعَ البحثِ خيارًا يطلبُه القارئ». The rules ride WITH the
// texts, on the reader's own turn — the system prompt is sha-pinned and cached, and a rule about THESE
// texts belongs beside them. Rule ٤ also names the words the reader must never be shown about how an
// answer was made («البحث»، «المصادر المتاحة»، «المكتبة»): the owner's live witnesses of 24 September.
export const BW_WRITE_RULES = 'قواعدُ الكتابةِ من هذه النصوص:\n'
  + '١. اكتبِ الجوابَ منها وحدَها، ولا تزدْ عليها حكمًا من حفظِك.\n'
  + '٢. ضعْ علامةَ النصِّ [[n]] بعدَ كلِّ جملةٍ تأخذُها منه.\n'
  + '٣. لا تنسبْ قولًا إلى مذهبٍ ولا إلى الجمهور، ولا تحكِ إجماعًا ولا اتفاقًا ولا نفيَ خلاف، ولا تنسبْ إلى مجمعٍ أو كتابٍ أو عالمٍ، إلّا بنصٍّ هنا يقولُ ذلك، وبعلامتِه.\n'
  + '٤. إن لم تكفِ النصوصُ للجوابِ عن المسألةِ كلِّها أو بعضِها فقلْ ذلك صراحةً: «لم أقفْ على نصٍّ في …»، '
  + 'بلا ذكرٍ للبحثِ ولا للمصادرِ ولا للمكتبة، ثمّ أتمَّ ما تسندُه النصوص.';

// ── م٢-د: NO RULING WITHOUT A TEXT ──────────────────────────────────────────────────────
// The owner's item: «سؤالُ حكمٍ بلا دليلٍ مسترجَعٍ لا يُجابُ من حفظِ النموذج؛ يُقالُ ذلك». When the
// gathering found nothing for the issue, the writer is told so in as many words, beside the rules;
// and the sentence-level door (./ruling-review.js), which has no text to hold any ruling against,
// takes out any ruling the writer wrote anyway and says that no text was found.
export const BW_NO_TEXT_RULE = 'لم يُجمَعْ لهذه المسألةِ نصّ: فلا تكتبْ فيها حكمًا من حفظِك، وقلْ في أوّلِ الجوابِ '
  + 'إنّك لم تقفْ على نصٍّ فيها، ولك أن تُبيِّنَ ما يُسألُ عنه بلا حكم.';
export function writeRulesFor(rows) {
  return Array.isArray(rows) && rows.length ? BW_WRITE_RULES : `${BW_WRITE_RULES}\n${BW_NO_TEXT_RULE}`;
}

/** The reader's own turn with the pinned block appended — a content block, never a new message. */
export function withPinnedEvidence(message, rows, rules = '') {
  if (!message || typeof message !== 'object' || message.role !== 'user') return message;
  const content = typeof message.content === 'string'
    ? [{ type: 'text', text: message.content }]
    : (Array.isArray(message.content) ? [...message.content] : []);
  if (!content.length) return message;
  const block = [BW_PINNED_NOTE, renderPinnedEvidence(rows), rules].filter(Boolean).join('\n\n');
  return { ...message, content: [...content, { type: 'text', text: block }] };
}

// The answer said the texts did not suffice, or nothing was gathered: the reader is offered the
// widening as a chip, deterministically — the first item of the answer's own <suggestions>, or a
// block of its own. A chip the reader taps sends exactly WIDEN_SEARCH_PROMPT, which asksToWidenSearch
// recognises, so the next turn runs the old loop with its live search.
const NOT_FOUND_RE = /لم\s+[أا]قف\s+على\s+نص|لم\s+[أا]جد\s+نص|لم\s+يجمع|لا\s+نص\s+(?:فيما|في\s+النصوص)/u;
export function withWidenOffer(answer, rowCount) {
  const text = String(answer || '');
  const plain = text.replace(/[\u064B-\u065F\u0670]/gu, '');
  if (rowCount > 0 && !NOT_FOUND_RE.test(plain)) return text;
  if (text.includes(WIDEN_SEARCH_PROMPT)) return text;
  const open = /<suggestions\b[^>]*>/iu.exec(text);
  if (open) {
    const at = open.index + open[0].length;
    return text.slice(0, at) + '\n- ' + WIDEN_SEARCH_PROMPT + text.slice(at);
  }
  return text.replace(/\s+$/u, '') + '\n<suggestions>\n- ' + WIDEN_SEARCH_PROMPT + '\n</suggestions>';
}
