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

export const CLAIM_KINDS = Object.freeze(['consensus', 'majority', 'council', 'madhhab', 'book', 'absolute']);

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
export const MADHHAB_BOOKS = Object.freeze({
  hanafi: ['FC-003532', 'FC-003528', 'FC-003533', 'FC-003559', 'FC-003551', 'FC-003382'],
  maliki: ['FC-003566', 'FC-003623', 'FC-003613', 'FC-003597', 'FC-003583', 'FC-003608'],
  shafii: ['FC-003660', 'FC-003689', 'FC-003692', 'FC-003662', 'FC-003638', 'FC-003642'],
  hanbali: ['FC-003727', 'FC-003770', 'FC-003759', 'FC-003734', 'FC-003753', 'FC-003768'],
});
function quoteNamesHolder(claim, quote, row) {
  const q = fold(quote);
  for (const kind of ['consensus', 'majority', 'council']) {
    if (claim.kinds.includes(kind) && !HOLDER[kind].test(q)) return false;
  }
  if (claim.kinds.includes('madhhab') && claim.madhhabs.length) {
    const fromOwnBook = row && row.subjectId && claim.madhhabs.some((m) => (MADHHAB_BOOKS[m] || []).includes(row.subjectId));
    const named = claim.madhhabs.some((m) => MADHHABS.find((x) => x.key === m).re.test(' ' + q + ' '));
    if (!fromOwnBook && !named) return false;
  }
  return true;
}

// ── THE READER THAT MUST QUOTE: THE MODEL'S HALF ─────────────────────────────────────────
export const RULING_REVIEW_SYSTEM = 'أنتَ فاحصُ أمانةٍ فقهيّة. أمامَك نصوصٌ مرقّمة، وجملٌ مرقّمةٌ من جوابٍ كُتِبَ منها. '
  + 'لكلِّ جملةٍ قرِّرْ واحدًا من ثلاثة:\n'
  + 'supported: نصٌّ منها يقولُ ما تقولُه الجملةُ نفسَه: القائلُ نفسُه (المذهبُ أو الجمهورُ أو الإجماعُ أو المجمعُ أو الكتاب)، والحكمُ نفسُه، في المسألةِ نفسِها.\n'
  + 'contradicted: نصٌّ منها يقولُ خلافَها: ينسبُ إلى القائلِ نفسِه ضدَّ ما نسبَتْه الجملة، أو يحكي خلافًا حيثُ تحكي الجملةُ إجماعًا أو اتفاقًا، أو يذكرُ صفةً غيرَ الصفةِ التي ذكرَتْها.\n'
  + 'not_found: لا نصَّ منها يقولُ ذلك.\n'
  + 'احكمْ من النصوصِ وحدَها لا من علمِك. وفي supported وcontradicted انسخْ من النصِّ الحاسمِ اقتباسًا حرفيًّا متّصلًا '
  + 'من ستِّ كلماتٍ إلى أربعين كما هو بحروفِه، واذكرْ رقمَه. '
  + 'أخرجْ JSON وحدَه بلا أيِّ كلامٍ قبلَه أو بعدَه: {"claims":[{"id":1,"verdict":"supported","row":3,"quote":"..."}]}';
export const RULING_REVIEW_ROW_CHARS = 4000;
export const RULING_REVIEW_MAX_TOKENS = 2000;

export function rulingReviewPrompt(rows, claims) {
  const texts = rows.map((row) => `[${row.ref}] ${row.label || ''}\n${String(row.fullText || row.text || '').slice(0, RULING_REVIEW_ROW_CHARS)}`).join('\n\n');
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
    out[id - 1] = { verdict, row: Number(item.row), quote: String(item.quote || '') };
  }
  return out;
}

// ── THE REMEDY: THE CODE'S, AND A WHOLE SENTENCE FOR A WHOLE SENTENCE ────────────────────
const withLam = (label) => (label.startsWith('ال') ? 'لل' + label.slice(2) : 'لـ' + label);
export function notFoundSentence(claim) {
  if (claim.kinds.includes('madhhab') && claim.madhhabs.length) {
    const labels = claim.madhhabs.map((m) => MADHHABS.find((x) => x.key === m).label);
    return `ولم أقفْ على نصٍّ ${labels.map(withLam).join(' ولا ')} في هذه المسألةِ على ما ذُكِر.`;
  }
  if (claim.kinds.includes('consensus')) return 'ولم أقفْ على نصٍّ يحكي الإجماعَ أو الاتفاقَ في هذا.';
  if (claim.kinds.includes('majority')) return 'ولم أقفْ على نصٍّ ينسبُ هذا القولَ إلى الجمهور.';
  if (claim.kinds.includes('council')) return 'ولم أقفْ على نصِّ قرارٍ لمجمعٍ فقهيٍّ في هذا.';
  if (claim.kinds.includes('book') && claim.book) return `ولم أقفْ على هذا في نصِّ «${claim.book}».`;
  return 'ولم أقفْ على نصٍّ يُسنِدُ هذا الحكمَ بعينِه.';
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
export async function reviewRulings({ text, rows, ask }) {
  const record = { claims: 0, supported: 0, contradicted: 0, notFound: 0, unverified: 0, downgraded: 0, verifier: 'none', changes: [] };
  const claims = claimSentences(text);
  record.claims = claims.length;
  if (!claims.length) return { text, record };
  const usable = (rows || []).filter((row) => row && String(row.fullText || row.text || '').trim() !== '');
  let verdicts = new Array(claims.length).fill(null);
  if (usable.length) {
    try {
      const raw = await ask(RULING_REVIEW_SYSTEM, rulingReviewPrompt(usable, claims));
      verdicts = parseVerdicts(raw, claims.length);
      record.verifier = 'ok';
    } catch (error) {
      record.verifier = `error:${String(error?.status || '')}:${String(error?.message || error).slice(0, 60)}`;
    }
  } else {
    record.verifier = 'no_rows';
  }
  const byRef = new Map(usable.map((row) => [row.ref, row]));
  const replacements = [];
  const saidOnce = new Set();
  claims.forEach((claim, i) => {
    let v = verdicts[i];
    if (!v) {
      // No verdict at all: with NO rows the claim has nothing behind it (m2-د builds on this);
      // with rows but a failed reader, a claim of consensus/majority/council whose MARKER appears in
      // no text is still unsupported by construction; anything else is left and counted as unverified.
      const pool = usable.map((row) => fold(row.fullText || row.text)).join(' ');
      const markerless = ['consensus', 'majority', 'council'].some((k) => claim.kinds.includes(k) && !HOLDER[k].test(pool));
      if (!usable.length || markerless) v = { verdict: 'not_found', row: NaN, quote: '' };
      else { record.unverified += 1; return; }
    }
    const row = byRef.get(v.row);
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
    const line = notFoundSentence(claim);
    replacements.push({ start: claim.start, end: claim.end, text: saidOnce.has(line) ? '' : line });
    saidOnce.add(line);
    record.changes.push({ kind: claim.kinds.join('+'), outcome: 'not_found' });
  });
  if (!replacements.length) return { text, record };
  let out = String(text);
  for (const r of replacements.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, r.start) + r.text + out.slice(r.end);
  }
  out = out.replace(/[ \t]+\n/gu, '\n').replace(/\n{3,}/gu, '\n\n').replace(/[ \t]{2,}/gu, ' ').trim();
  return { text: out, record };
}
