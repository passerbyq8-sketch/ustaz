// lib/ruling-review.js — م٢-ج (BEFORE_WRITING_V1): the ruling is reviewed SENTENCE BY SENTENCE
// against EVERY text retrieved for the issue, not against what the answer chose to cite.
//
// THE OWNER'S ITEM (program order 2026-09-24, م٢-ج): «كلُّ نسبةٍ إلى مذهبٍ أو "الجمهور" أو "الإجماع"
// أو "المجامع" أو "اتّفقوا" أو "لا خلاف"، وكلُّ "يجوز / لا يجوز / يجب / يحرم" مطلقة — تُقاسُ على الدليلِ
// المسترجَعِ في المسألةِ نفسِها لا على ما استشهدَ به الجواب؛ وما لا يسندُه نصٌّ يُردُّ إلى نسبةِ مصدرِه، أو
// يُرفَع، أو يُقالُ إنّه لم يُوجَدْ نصّ». And §٢-٤: «قوّةُ الفقهِ بالأمانةِ للمصدرِ لا بالمحتوى وحدَه».
//
// WHAT WAS MEASURED (program-2026-09-24/02-brain/measure, B and D): today's reviewer acts only on a
// credit to a NAMED PERSON; a madhhab, «الجمهور», «الإجماع/اتفقوا/لا خلاف» and an absolute ruling are
// all `tagged-fiqh-understanding`, i.e. identity. 42 fixtures — the §4 hallucinations of the sources
// report verbatim, owner test 7 and the sheikh's «صلاة الخوف» — went through 239 of 239 runs unchanged.
// And a token-overlap test cannot be the replacement: it accepts the OPPOSITE ruling written in the
// same words (measured), and a madhhab's procedure in «صلاة الخوف» is not a matter of a negation.
//
// SO THE CHECK IS A READER WHO MUST QUOTE. One call to a fast model is handed every retrieved text
// and every claim sentence, and must answer each claim with supported / contradicted / not_found AND
// a verbatim quote from the text that decides it. The quote is then CHECKED BY THIS CODE against
// the text it names: a quote that is not in its text is not evidence, and the claim is treated as
// unsupported. The model finds; the code verifies; the remedy is the code's.
//
// THE REMEDY IS A WHOLE SENTENCE FOR A WHOLE SENTENCE (the owner's ruling ق٥٥: «لا يُمَدُّ مقصٌّ في
// نصٍّ عربيّ»). Supported: kept. Contradicted, with a verified quote: replaced by what the source says,
// in its own words, attributed to it («يُردُّ إلى نسبةِ مصدرِه»). Not found: removed, and one plain
// sentence says no text was found («يُقالُ إنّه لم يُوجَدْ نصّ»), once per kind.
import { normalizeArabic } from './route-classify.js';
// د-١ (DIAG_TRACE_V1) — records only while a traced turn is open.
import { diagTrace } from './diag-trace.js';

// ── WHICH SENTENCES ARE CLAIMS ────────────────────────────────────────────────────────────
// On the normalised sentence (route-classify's fold: no marks, one alef, ه for ة, ي for ى).
const CONSENSUS_RE = /(?:^|\s)(?:[وفب]?(?:ال)?اجماع|[وف]?اجمع(?:وا|ت)?|[وف]?اتفق(?:وا|ت)?|(?:ب|و|ف)?(?:ال)?اتفاق|لا\s+خلاف|بلا\s+خلاف|دون\s+خلاف|من\s+غير\s+خلاف|لم\s+يختلف(?:وا)?|محل\s+اتفاق|لم\s+يقل\s+احد)(?:\s|$)/u;
const MAJORITY_RE = /(?:^|\s)(?:[وفل]?(?:ال)?جمهور|[وفل]?جماهير|اكثر\s+(?:اهل\s+العلم|العلماء|الفقهاء|المحققين)|عامه\s+(?:اهل\s+العلم|العلماء|الفقهاء))(?:\s|$)/u;
const COUNCIL_RE = /(?:^|\s)(?:[وفل]?(?:ال)?مجمع|[وفل]?(?:ال)?مجامع|اللجنه\s+الدائمه|هيئه\s+كبار\s+العلماء|دار\s+الافتاء)(?:\s|$)/u;
const MADHHABS = Object.freeze([
  { key: 'hanafi', label: 'الحنفية', re: /(?:^|\s)(?:[وفلب]?(?:ال)?حنفيه|[وفلب]?(?:ال)?احناف|ابو\s+حنيفه|ابي\s+حنيفه)(?:\s|$)/u },
  { key: 'maliki', label: 'المالكية', re: /(?:^|\s)(?:[وفلب]?(?:ال)?مالكيه|الامام\s+مالك|مذهب\s+مالك|عند\s+مالك)(?:\s|$)/u },
  { key: 'shafii', label: 'الشافعية', re: /(?:^|\s)(?:[وفلب]?(?:ال)?شافعيه|[وفلب]?الشافعي|الامام\s+الشافعي)(?:\s|$)/u },
  { key: 'hanbali', label: 'الحنابلة', re: /(?:^|\s)(?:[وفلب]?(?:ال)?حنابله|[وفلب]?(?:ال)?حنبلي(?:ه)?|الامام\s+احمد|مذهب\s+احمد|عند\s+احمد)(?:\s|$)/u },
]);
const FOUR_RE = /(?:^|\s)(?:المذاهب\s+الاربعه|الايمه\s+الاربعه|الاربعه)(?:\s|$)/u;
// A book named as the holder of a statement: «كما جاء في كشاف القناع», «وفي المغني».
const BOOK_RE = /(?:^|\s)(?:كما\s+(?:جاء|ورد|في|قال)|جاء\s+في|ورد\s+في|نص\s+في|قال\s+في)\s+(?:كتاب\s+)?(كشاف\s+القناع|المغني|المجموع|الشرح\s+الكبير|الانصاف|بدائع\s+الصنائع|المبسوط|المدونه|مواهب\s+الجليل|مغني\s+المحتاج|الموسوعه(?:\s+الفقهيه)?|بدايه\s+المجتهد|رد\s+المحتار|حاشيه\s+[^\s]+|الفروع|زاد\s+المستقنع|الروض\s+المربع)(?:\s|$)/u;
// An absolute ruling. «متفق عليه» is NOT here or above: after a hadith it names the two Ṣaḥīḥs.
const ABSOLUTE_RE = /(?:^|\s)(?:[وف]?(?:لا\s+)?(?:يجوز|يجب|يحرم|يلزم|يصح|ينقض|يبطل|تبطل|تصح|تجب|تحرم|يشرع|يستحب|يكره)|[وف]?(?:جايز|حرام|محرم|واجب|مباح|مكروه|مستحب|فرض|باطل)(?:ه)?)(?:\s|$)/u;

// م٢-ز — a statement credited to a NAMED SCHOLAR: a verb of saying or holding, then a scholarly title
// or one of the names answers actually credit. A narrated non-scholar («قال أبو لهب», «قالت اليهود») is
// not a scholar and is never this kind — the old ladder's failure was to treat him as one.
const SCHOLAR_RE = /(?:^|\s)[وف]?(?:قال|يقول|ذهب|يري|افتي|رجح|اختار|نقل|ذكر|صرح|قرر|نص)(?:ه|ت)?\s+(?:الشيخ|الامام|العلامه|الحافظ|شيخ\s+الاسلام|ابن\s+(?:تيميه|القيم|قدامه|باز|عثيمين|حزم|رشد|المنذر|عبد\s+البر|حجر|كثير|عابدين|مفلح|جبرين|الهمام|نجيم|عرفه)|النووي|الكاساني|السرخسي|الدسوقي|الدردير|البهوتي|المرداوي|القرافي|الشوكاني|الصنعاني|الخطابي|البغوي)(?:\s|$)/u;
export const CLAIM_KINDS = Object.freeze(['consensus', 'majority', 'council', 'madhhab', 'book', 'scholar', 'absolute']);

// Card blocks are never judged: an ayah, a hadith card, the steps list and the suggestions.
const CARD_BLOCK_RE = /<(verse|surah|hadith|steps|suggestions|source|book|dhikr|worship|board|document)\b[^>]*>[\s\S]*?<\/\1>|<(?:verse|surah|hadith|source|book)\b[^>]*\/>/giu;
const CITE_RE = /\[\[\s*[0-9\s،,و]+?\s*\]\]/gu;

/**
 * The claim sentences of `text`, with their offsets IN `text`, so a remedy replaces exactly them.
 * A sentence ends at . ! ؟ ? or a line break, outside «…» quotations.
 */
export function claimSentences(text) {
  const src = String(text || '');
  const masked = src.replace(CARD_BLOCK_RE, (m) => ' '.repeat(m.length));
  const out = [];
  let start = 0;
  let inQuote = 0;
  const flush = (end) => {
    const raw = src.slice(start, end);
    const trimmedStart = start + (raw.length - raw.trimStart().length);
    const sentence = src.slice(trimmedStart, end).trimEnd();
    const maskedSentence = masked.slice(trimmedStart, trimmedStart + sentence.length);
    start = end;
    if (!sentence || !maskedSentence.trim()) return;
    const norm = ' ' + normalizeArabic(maskedSentence.replace(CITE_RE, ' ')) + ' ';
    const kinds = [];
    const madhhabs = MADHHABS.filter((m) => m.re.test(norm)).map((m) => m.key);
    if (CONSENSUS_RE.test(norm)) kinds.push('consensus');
    if (MAJORITY_RE.test(norm)) kinds.push('majority');
    if (COUNCIL_RE.test(norm)) kinds.push('council');
    if (madhhabs.length || FOUR_RE.test(norm)) kinds.push('madhhab');
    const book = BOOK_RE.exec(norm);
    if (book) kinds.push('book');
    if (SCHOLAR_RE.test(norm)) kinds.push('scholar');
    if (!kinds.length && ABSOLUTE_RE.test(norm)) kinds.push('absolute');
    if (kinds.length) out.push({ start: trimmedStart, end: trimmedStart + sentence.length, sentence, kinds, madhhabs, book: book ? book[1] : '' });
  };
  for (let i = 0; i < masked.length; i += 1) {
    const ch = masked[i];
    if (ch === '«') inQuote += 1;
    else if (ch === '»') inQuote = Math.max(0, inQuote - 1);
    else if (ch === '\n') { inQuote = 0; flush(i); }
    else if (!inQuote && (ch === '.' || ch === '!' || ch === '؟' || ch === '?')) {
      // Swallow a citation marker that sits right after the full stop: it belongs to this sentence.
      let end = i + 1;
      const rest = src.slice(end);
      const tail = /^\s*(?:\[\[\s*[0-9\s،,و]+?\s*\]\])+/u.exec(rest);
      if (tail) end += tail[0].length;
      flush(end);
      i = end - 1;
    }
  }
  flush(src.length);
  return out;
}

// ── THE QUOTE CHECK: THE CODE'S HALF ─────────────────────────────────────────────────────
const fold = (value) => normalizeArabic(String(value || '')).replace(/\s+/gu, ' ').trim();
const MIN_QUOTE_WORDS = 4;
/** Is `quote` in `text`, letter for letter after the fold? */
export function quoteIsVerbatim(quote, text) {
  const q = fold(quote);
  if (q.split(' ').length < MIN_QUOTE_WORDS) return false;
  return fold(text).includes(q);
}
// The holder a supporting quote must name, per kind — so a quote about another holder is not
// taken as support. A madhhab claim is also supported by a row taken from that madhhab's own book.
const HOLDER = {
  consensus: /(?:اجماع|اجمع|اتفق|اتفاق|خلاف)/u,
  majority: /(?:جمهور|جماهير|اكثر|عامه)/u,
  council: /(?:مجمع|المجامع|اللجنه|هيئه)/u,
};
// D-2 E3: school names can establish a majority without the literal word «الجمهور».
// The reader still decides that they hold THIS ruling; the code verifies its quoted holders.
function namedSchools(value) {
  const text = fold(value).replace(/(^|\s)[وف](?=[بل]ال|لل)/gu, '$1')
    .replace(/(^|\s)([وف]?)لل/gu, '$1$2ال');
  return MADHHABS.filter((m) => m.re.test(' ' + text + ' ')).map((m) => m.key);
}
export const MADHHAB_BOOKS = Object.freeze({
  hanafi: ['FC-003532', 'FC-003528', 'FC-003533', 'FC-003559', 'FC-003551', 'FC-003382'],
  maliki: ['FC-003566', 'FC-003623', 'FC-003613', 'FC-003597', 'FC-003583', 'FC-003608'],
  shafii: ['FC-003660', 'FC-003689', 'FC-003692', 'FC-003662', 'FC-003638', 'FC-003642'],
  hanbali: ['FC-003727', 'FC-003770', 'FC-003759', 'FC-003734', 'FC-003753', 'FC-003768'],
});
function quoteNamesHolder(claim, quote, row) {
  const q = fold(quote);
  const schools = namedSchools(q);
  for (const kind of ['consensus', 'majority', 'council']) {
    if (claim.kinds.includes(kind) && !HOLDER[kind].test(q)
      && !(kind === 'majority' && schools.length >= 3)) return false;
  }
  const four = claim.kinds.includes('madhhab')
    && (claim.madhhabs.length === 4 || FOUR_RE.test(' ' + fold(claim.sentence) + ' '));
  if (four && schools.length < 3 && !FOUR_RE.test(' ' + q + ' ')) return false;
  if (claim.kinds.includes('madhhab') && claim.madhhabs.length) {
    const fromOwnBook = row && row.subjectId && claim.madhhabs.some((m) => (MADHHAB_BOOKS[m] || []).includes(row.subjectId));
    const named = claim.madhhabs.some((m) => schools.includes(m));
    if (!fromOwnBook && !named) return false;
  }
  return true;
}

// ── THE READER THAT MUST QUOTE: THE MODEL'S HALF ─────────────────────────────────────────
export const RULING_REVIEW_SYSTEM = 'أنتَ فاحصُ أمانةٍ فقهيّة. أمامَك نصوصٌ مرقّمة، وجملٌ مرقّمةٌ من جوابٍ كُتِبَ منها. '
  + 'لكلِّ جملةٍ قرِّرْ واحدًا من ثلاثة:\n'
  + 'supported: نصٌّ منها يقولُ ما تقولُه الجملةُ نفسَه: القائلُ نفسُه (المذهبُ أو الجمهورُ أو الإجماعُ أو المجمعُ أو الكتاب)، والحكمُ نفسُه، في المسألةِ نفسِها.\n'
  + 'ويَسندُ قولَ الجمهور أو المذاهب الأربعة نصٌّ يسمّي ثلاثةً أو أكثر من المذاهب الأربعة قائلين بالحكم نفسه؛ مجرّد ذكر أسمائهم في أقوال متعارضة لا يكفي.\n'
  + 'contradicted: نصٌّ منها يقولُ خلافَها: ينسبُ إلى القائلِ نفسِه ضدَّ ما نسبَتْه الجملة، أو يحكي خلافًا حيثُ تحكي الجملةُ إجماعًا أو اتفاقًا، أو يذكرُ صفةً غيرَ الصفةِ التي ذكرَتْها.\n'
  + 'not_found: لا نصَّ منها يقولُ ذلك.\n'
  + 'احكمْ من النصوصِ وحدَها لا من علمِك. وفي supported وcontradicted انسخْ من النصِّ الحاسمِ اقتباسًا حرفيًّا متّصلًا '
  + 'من ستِّ كلماتٍ إلى أربعين كما هو بحروفِه، واذكرْ معرّفَ صفّه ROW_n، لا رقمَ فقرةٍ داخلَ النصّ. '
  + 'وأضفْ حقلَ "khilaf": إن كانت النصوصُ نفسُها تذكرُ في المسألةِ قولين مختلفين لقائلين مختلفين فاكتبْ '
  + '{"exists":true,"a":{"row":"ROW_1","quote":"..."},"b":{"row":"ROW_2","quote":"..."}} باقتباسين حرفيَّين، وإلّا {"exists":false}. '
  + 'أخرجْ JSON وحدَه بلا أيِّ كلامٍ قبلَه أو بعدَه: {"claims":[{"id":1,"verdict":"supported","row":"ROW_3","quote":"..."}],"khilaf":{"exists":false}}';
export const RULING_REVIEW_ROW_CHARS = 4000;
export const RULING_REVIEW_MAX_TOKENS = 2000;

export function rulingReviewPrompt(rows, claims) {
  const texts = rows.map((row) => `ROW_${row.ref} ${row.label || ''}\n${row.writerText || String(row.fullText || row.text || '').slice(0, RULING_REVIEW_ROW_CHARS)}`).join('\n\n');
  const sentences = claims.map((claim, i) => `(${i + 1}) ${claim.sentence.replace(CITE_RE, '').trim()}`).join('\n');
  return `النصوص:\n${texts}\n\nالجمل:\n${sentences}`;
}

/** Parse the reader's JSON; anything unreadable is «no verdict» for every claim. */
export function parseVerdicts(raw, count) {
  const text = String(raw || '');
  const at = text.indexOf('{');
  const end = text.lastIndexOf('}');
  let parsed = null;
  if (at >= 0 && end > at) { try { parsed = JSON.parse(text.slice(at, end + 1)); } catch { parsed = null; } }
  const list = parsed && Array.isArray(parsed.claims) ? parsed.claims : [];
  const out = new Array(count).fill(null);
  for (const item of list) {
    const id = Number(item && item.id);
    if (!Number.isInteger(id) || id < 1 || id > count) continue;
    const verdict = ['supported', 'contradicted', 'not_found'].includes(item.verdict) ? item.verdict : null;
    if (!verdict) continue;
    out[id - 1] = { verdict, row: rowReference(item.row), quote: String(item.quote || '') };
  }
  return out;
}

// D-2 E1: keep citation refs numeric outside the reader protocol. Legacy recorded readers may
// return a paragraph number. Only a MISSING row can be recovered, from a checked verbatim quote;
// an existing row carrying different words is still a failed attribution.
function rowReference(value) {
  const token = /^ROW_([1-9][0-9]*)$/u.exec(String(value));
  return token ? Number(token[1]) : Number(value);
}
function rulingRow(verdict, rows, claim) {
  if (!verdict) return null;
  const existing = rows.find((row) => row.ref === rowReference(verdict.row));
  if (existing) return existing;
  return rows.find((row) => quoteIsVerbatim(verdict.quote, row.fullText || row.text)
    && (verdict.verdict !== 'supported' || !claim || quoteNamesHolder(claim, verdict.quote, row))) || null;
}

// ── THE REMEDY: THE CODE'S, AND A WHOLE SENTENCE FOR A WHOLE SENTENCE ────────────────────
const withLam = (label) => (label.startsWith('ال') ? 'لل' + label.slice(2) : 'لـ' + label);
export function notFoundSentence(claim, rows = []) {
  if (claim.kinds.includes('madhhab') && claim.madhhabs.length) {
    const present = new Set(rows.flatMap((row) => namedSchools(row.fullText || row.text)));
    const labels = claim.madhhabs.filter((m) => !present.has(m)).map((m) => MADHHABS.find((x) => x.key === m).label);
    if (labels.length) return `ولم أقفْ على نصٍّ ${labels.map(withLam).join(' ولا ')} في هذه المسألةِ على ما ذُكِر.`;
  }
  if (claim.kinds.includes('consensus')) return 'ولم أقفْ على نصٍّ يحكي الإجماعَ أو الاتفاقَ في هذا.';
  if (claim.kinds.includes('majority')) return 'ولم أقفْ على نصٍّ ينسبُ هذا القولَ إلى الجمهور.';
  if (claim.kinds.includes('council')) return 'ولم أقفْ على نصِّ قرارٍ لمجمعٍ فقهيٍّ في هذا.';
  if (claim.kinds.includes('book') && claim.book) return `ولم أقفْ على هذا في نصِّ «${claim.book}».`;
  if (claim.kinds.includes('scholar')) return 'ولم أقفْ على نصٍّ يُسنِدُ هذا القولَ إلى قائلِه.';
  return 'ولم أقفْ على نصٍّ يُسنِدُ هذا الحكمَ بعينِه.';
}

// D-2 E7: presentation only. Decisions remain sentence-level; absence statements
// from the writer and the door become one terminal prose line, before suggestions.
export function terminalNotFound(text, extraLines = []) {
  const original = String(text || '');
  const tail = /\s*<suggestions>[\s\S]*?<\/suggestions>\s*$/u.exec(original);
  let body = tail ? original.slice(0, tail.index) : original;
  body = body.replace(/^\s*\*\*ما لم أقف[\u064B-\u065F]* عليه\*\*\s*:?\s*$/gmu, '');
  const mask = body.replace(CARD_BLOCK_RE, m => ' '.repeat(m.length))
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|«[^»]*»|`[^`\n]*`/gu, m => ' '.repeat(m.length));
  const lines = [...extraLines], cuts = [];
  const absence = /[وف]?لم\s+أقف[\u064B-\u065F]*\s+[^.\n<؟!]*[.؟!]?/gu;
  for (const match of mask.matchAll(absence)) {
    lines.push(body.slice(match.index, match.index + match[0].length));
    const comma = /[،؛]\s*$/u.exec(body.slice(0, match.index));
    cuts.push({ start: comma ? comma.index : match.index, end: match.index + match[0].length, text: comma ? '.' : '' });
  }
  if (!lines.length) return original;
  for (const cut of cuts.reverse()) body = body.slice(0, cut.start) + cut.text + body.slice(cut.end);
  const parts = [], seen = new Set(), schools = new Set();
  for (const line of lines) {
    const rawPart = String(line).replace(/^[وف]?لم\s+أقف[\u064B-\u065F]*\s+/u, '')
      .replace(CITE_RE, '').replace(/[.،؛:\s]+$/u, '').trim();
    // The final delivery pass may see an already combined summary plus a later door's
    // line. Reopen our own conjunctions so repeat passes retain every kind exactly once.
    for (const part of rawPart.split(/،\s+ولا\s+(?=على|في)/u)) {
    if (!part) continue;
    const key = fold(part);
    // Different struck sentences may overlap in their missing schools. Name each once.
    if (/^علي نص /u.test(key) && /في هذه المساله/u.test(key)) {
      const named = namedSchools(part);
      if (named.length) { for (const name of named) schools.add(name); continue; }
    }
    if (!seen.has(key)) { seen.add(key); parts.push(part); }
    }
  }
  if (schools.size) parts.push('على نصٍّ ' + MADHHABS.filter(m => schools.has(m.key))
    .map(m => withLam(m.label)).join(' ولا ') + ' في هذه المسألةِ على ما ذُكِر');
  if (!parts.length) return original;
  body = body.replace(/[ \t]+\n/gu, '\n').replace(/\n{3,}/gu, '\n\n').trim();
  const summary = 'لم أقفْ ' + parts.join('، ولا ') + '.';
  return [body, summary, tail ? tail[0].trim() : ''].filter(Boolean).join('\n\n');
}
export function sourceName(row) {
  if (!row) return 'المصدر';
  if (row.kind === 'fatwa') return row.publisher ? `فتوى ${row.publisher}` : 'الفتوى';
  if (row.kind === 'encyclopedia') return row.part ? `الموسوعة الفقهية الكويتية (ج${row.part})` : 'الموسوعة الفقهية الكويتية';
  if (row.kind === 'lib_book') return [`«${row.bookTitle || row.title}»`, row.locator || ''].filter(Boolean).join(' ');
  return row.publisher || row.title || 'المصدر';
}
export function contradictedSentence(row, quote) {
  return `والذي في ${sourceName(row)}: «${String(quote).trim()}» [[${row.ref}]].`;
}

/**
 * Review every claim sentence of `text` against `rows`. Never throws.
 * `ask(system, user)` returns the model's raw text (or throws); the loop supplies it.
 * Returns { text, record } where `record` counts each outcome and names every change.
 */
// م٢-ح — THE KHILAF SIGNAL FROM THE TEXTS, AND ONLY FROM TWO QUOTES THE CODE HAS CHECKED. The probe in
// lib/free-brain/loop.js (khilafFromOpinionsProbe) stays frozen at null by the owner's ruling of 15
// September and its gate; this is a different road, on a before-writing fiqh turn only: the reader
// names two texts that hold different positions, quotes each verbatim, and the khilaf is TRUE only when
// both quotes are in their texts and the texts are two. Anything less is «I do not know» (null).
export function khilafFromReading(raw, rows) {
  const text = String(raw || '');
  const at = text.indexOf('{');
  const end = text.lastIndexOf('}');
  let j = null;
  if (at >= 0 && end > at) { try { j = JSON.parse(text.slice(at, end + 1)); } catch { j = null; } }
  const k = j && j.khilaf;
  if (!k || k.exists !== true || !k.a || !k.b) return null;
  const ra = rulingRow(k.a, rows || []);
  const rb = rulingRow(k.b, rows || []);
  if (!ra || !rb || ra === rb) return null;
  return quoteIsVerbatim(k.a.quote, ra.fullText || ra.text) && quoteIsVerbatim(k.b.quote, rb.fullText || rb.text) ? true : null;
}

export async function reviewRulings({ text, rows, ask }) {
  const record = { claims: 0, supported: 0, contradicted: 0, notFound: 0, unverified: 0, downgraded: 0, verifier: 'none', changes: [], khilaf: null };
  const claims = claimSentences(text);
  record.claims = claims.length;
  if (!claims.length) return { text: terminalNotFound(text), record };
  const usable = (rows || []).filter((row) => row && String(row.fullText || row.text || '').trim() !== '');
  let verdicts = new Array(claims.length).fill(null);
  if (usable.length) {
    try {
      const raw = await ask(RULING_REVIEW_SYSTEM, rulingReviewPrompt(usable, claims));
      verdicts = parseVerdicts(raw, claims.length);
      record.khilaf = khilafFromReading(raw, usable);
      record.verifier = 'ok';
    } catch (error) {
      record.verifier = `error:${String(error?.status || '')}:${String(error?.message || error).slice(0, 60)}`;
    }
  } else {
    record.verifier = 'no_rows';
  }
  const replacements = [];
  const saidOnce = new Set();
  claims.forEach((claim, i) => {
    let v = verdicts[i];
    if (!v) {
      // No verdict at all: with NO rows the claim has nothing behind it (m2-د builds on this);
      // with rows but a failed reader, a claim of consensus/majority/council whose MARKER appears in
      // no text is still unsupported by construction; anything else is left and counted as unverified.
      const pool = usable.map((row) => fold(row.fullText || row.text)).join(' ');
      const markerless = ['consensus', 'majority', 'council'].some((k) => claim.kinds.includes(k) && !HOLDER[k].test(pool)
        && !(k === 'majority' && namedSchools(pool).length >= 3));
      if (!usable.length || markerless) v = { verdict: 'not_found', row: NaN, quote: '' };
      else { record.unverified += 1; return; }
    }
    const row = rulingRow(v, usable, claim);
    if (v.verdict === 'supported') {
      const verbatim = row && quoteIsVerbatim(v.quote, row.fullText || row.text);
      if (verbatim && quoteNamesHolder(claim, v.quote, row)) { record.supported += 1; return; }
      record.downgraded += 1;
      v = { verdict: 'not_found', row: NaN, quote: '' };
    }
    if (v.verdict === 'contradicted') {
      if (row && quoteIsVerbatim(v.quote, row.fullText || row.text)) {
        record.contradicted += 1;
        const line = contradictedSentence(row, v.quote);
        replacements.push({ start: claim.start, end: claim.end, text: line });
        record.changes.push({ kind: claim.kinds.join('+'), outcome: 'contradicted', ref: row.ref });
        return;
      }
      record.downgraded += 1;
    }
    record.notFound += 1;
    const line = notFoundSentence(claim, usable);
    replacements.push({ start: claim.start, end: claim.end, text: '' });
    saidOnce.add(line);
    record.changes.push({ kind: claim.kinds.join('+'), outcome: 'not_found' });
  });
  diagTrace('sentence-door', () => ({
    verifier: record.verifier, rows: usable.map((row) => row.ref),
    claims: claims.map((claim, i) => {
      const v = verdicts[i];
      const row = rulingRow(v, usable, claim);
      const rep = replacements.find((r) => r.start === claim.start);
      return {
        sentence: String(text).slice(claim.start, claim.end), kinds: claim.kinds,
        verdict: v ? v.verdict : null, quote: v ? v.quote : '', row: v ? v.row : null,
        resolvedRow: row ? row.ref : null,
        rowSource: row ? { kind: row.kind, title: row.bookTitle || row.title, volume: row.locatorSpan && row.locatorSpan.volume, page: row.locatorSpan && row.locatorSpan.pageStart, id: row.recordId || row.id } : null,
        replacedBy: rep ? rep.text : null,
      };
    }),
    record,
  }));
  if (!replacements.length) return { text: terminalNotFound(text), record };
  let out = String(text);
  for (const r of replacements.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, r.start) + r.text + out.slice(r.end);
  }
  out = out.replace(/[ \t]+\n/gu, '\n').replace(/\n{3,}/gu, '\n\n').replace(/[ \t]{2,}/gu, ' ').trim();
  return { text: terminalNotFound(out, [...saidOnce]), record };
}

// ── م٢-ح: A WORD ATTRIBUTED TO THE PROPHET ﷺ MUST HAVE A RETRIEVED HADITH TEXT ────────────────
//
// THE OWNER'S ITEM (program order 2026-09-24, م٢-ح): «منعُ نسبةِ كلامِ غيرِه ﷺ إليه (لفظٌ يُنسَبُ إلى
// النبيِّ ﷺ لا بدَّ له من نصٍّ حديثيٍّ مسترجَع)». MEASURED (02-brain/measure/B, D): nothing on the
// free-brain path checks it — the ascription door compares only with a <hadith> card in the same
// answer (prophet-ascription.js:31-33 forbids widening it to outside sources), and «قال النبي ﷺ:
// «صلاة الخوف ركعة»، رواه البخاري ومسلم» passed every run. So this is a separate check, on a before-
// writing fiqh turn only, and only for a quotation IN «…» whose frame names him ﷺ:
//   * carried by a pinned text (the takhrij pass's own matcher, atomCarriesMatn) ⟹ kept;
//   * otherwise asked of the takhrij ladder (the same runner, the same 54 books) ⟹ carried: kept, and
//     the takhrij pass after the loop writes its bracket;
//   * carried by neither ⟹ the sentence is replaced: «ولم أقفْ على هذا اللفظِ في نصٍّ حديثيٍّ…»;
//   * the ladder unreachable ⟹ kept and COUNTED, never removed on a failed call.
const PROPHET_FRAME_RE = /(?:النبي|النبيّ|رسول\s+الله|الرسول)\s*(?:ﷺ|صلى\s+الله\s+عليه\s+وسلم|صلّى\s+اللهُ\s+عليه\s+وسلّم)?[^«»\n]{0,40}?(?:قال|يقول|أنه\s+قال|أنّه\s+قال)?\s*[:：]?\s*«([^«»]{8,400})»/u;
export const PROPHET_NOT_FOUND = 'ولم أقفْ على هذا اللفظِ في نصٍّ حديثيٍّ مُسنَدٍ إلى النبيِّ ﷺ.';

export function prophetQuotes(text) {
  const src = String(text || '');
  const masked = src.replace(CARD_BLOCK_RE, (m) => ' '.repeat(m.length));
  const out = [];
  // Sentence units, the same splitter as the claims, but every sentence is looked at.
  let start = 0;
  let inQuote = 0;
  const flush = (end) => {
    const sentence = src.slice(start, end);
    const maskedSentence = masked.slice(start, end);
    const lead = sentence.length - sentence.trimStart().length;
    const s0 = start + lead;
    start = end;
    const m = PROPHET_FRAME_RE.exec(maskedSentence);
    if (m) out.push({ start: s0, end: s0 + sentence.trim().length, sentence: sentence.trim(), matn: m[1].trim() });
  };
  for (let i = 0; i < masked.length; i += 1) {
    const ch = masked[i];
    if (ch === '«') inQuote += 1;
    else if (ch === '»') inQuote = Math.max(0, inQuote - 1);
    else if (ch === '\n') { inQuote = 0; flush(i); }
    else if (!inQuote && (ch === '.' || ch === '!' || ch === '؟' || ch === '?')) {
      let end = i + 1;
      const tail = /^\s*(?:\[\[\s*[0-9\s،,و]+?\s*\]\])+/u.exec(src.slice(end));
      if (tail) end += tail[0].length;
      flush(end);
      i = end - 1;
    }
  }
  flush(src.length);
  return out;
}

/**
 * `carries(atom, matn)` is the takhrij pass's matcher; `lookup(matns)` is its runner (or null when the
 * library is not wired for this turn). Never throws.
 */
export async function reviewProphetQuotes({ text, rows, carries, lookup }) {
  const record = { quotes: 0, inPinned: 0, inLadder: 0, notFound: 0, unverified: 0 };
  const quotes = prophetQuotes(text);
  record.quotes = quotes.length;
  if (!quotes.length) return { text, record };
  const pinned = (rows || []).map((row) => String(row.fullText || row.text || ''));
  const pending = [];
  for (const q of quotes) {
    if (pinned.some((atom) => carries(atom, q.matn))) { record.inPinned += 1; q.found = true; } else pending.push(q);
  }
  if (pending.length) {
    let results = null;
    if (typeof lookup === 'function') {
      try { results = await lookup(pending.map((q) => q.matn)); } catch { results = null; }
    }
    pending.forEach((q, i) => {
      const res = results && results[i];
      if (!res || res.failure) { record.unverified += 1; q.found = true; return; }
      if ((res.atoms || []).some((atom) => carries(atom, q.matn))) { record.inLadder += 1; q.found = true; return; }
      record.notFound += 1;
      q.found = false;
    });
  }
  let out = String(text);
  for (const q of quotes.filter((x) => x.found === false).sort((a, b) => b.start - a.start)) {
    out = out.slice(0, q.start) + PROPHET_NOT_FOUND + out.slice(q.end);
  }
  return { text: out, record };
}
