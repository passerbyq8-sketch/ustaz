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
// D3B F1a — a leading conjunction letter of the quoted span (و or ف) is not the source's word: the
// reader writes «وذهب» where the source has «فذهب». Normalized on both sides, and only there: the
// span then starts at a word of the text, with or without its own و/ف.
function containsQuote(foldedText, q) {
  if (!q) return false;
  if (foldedText.includes(q)) return true;
  const core = q.replace(/^[وف](?=\S{2})/u, '');
  for (let at = foldedText.indexOf(core); at >= 0; at = foldedText.indexOf(core, at + 1)) {
    const before = foldedText[at - 1];
    if (at === 0 || before === ' ') return true;
    if ((before === 'و' || before === 'ف') && (at === 1 || foldedText[at - 2] === ' ')) return true;
  }
  return false;
}
/** Is `quote` in `text`, letter for letter after the fold? */
export function quoteIsVerbatim(quote, text) {
  const q = fold(quote);
  if (q.split(' ').length < MIN_QUOTE_WORDS) return false;
  return containsQuote(fold(text), q);
}
// The holder a supporting quote must name, per kind — so a quote about another holder is not
// taken as support. A madhhab claim is also supported by a row taken from that madhhab's own book.
const HOLDER = {
  consensus: /(?:اجماع|اجمع|اتفق|اتفاق|خلاف)/u,
  majority: /(?:جمهور|جماهير|اكثر|عامه)/u,
  council: /(?:مجمع|المجامع|اللجنه|هيئه)/u,
};
// D3B F1: a sentence that itself says they DISAGREED («فقد اختلفوا في قدره», witness Q11 claim 2) is
// held by a quote that says «اختلفوا». Only such a sentence: a sentence of agreement never is.
const DISAGREE_RE = /(?:^|\s)[وف]?(?:اختلف|اختلفوا|اختلفت|يختلف|يختلفون|اختلاف|الاختلاف)(?:\s|$)/u;
// D-2 E3: school names can establish a majority without the literal word «الجمهور».
// The reader still decides that they hold THIS ruling; the code verifies its quoted holders.
// D3B F1: the comparison form «كـأبي حنيفة»، «كـأحمد»، «كالشافعي» names its imam as the holder.
function namedSchools(value) {
  const text = fold(value).replace(/(^|\s)[وف](?=[بل]ال|لل)/gu, '$1')
    .replace(/(^|\s)([وف]?)لل/gu, '$1$2ال')
    .replace(/(^|\s)ك(?=(?:ابي|ابو)\s+حنيفه|الشافعي(?:\s|$)|ال(?:حنفيه|مالكيه|شافعيه|حنابله)(?:\s|$))/gu, '$1')
    .replace(/(^|\s)كاحمد(?=\s|$)/gu, '$1الامام احمد').replace(/(^|\s)كمالك(?=\s|$)/gu, '$1الامام مالك');
  return MADHHABS.filter((m) => m.re.test(' ' + text + ' ')).map((m) => m.key);
}
export const MADHHAB_BOOKS = Object.freeze({
  hanafi: ['FC-003532', 'FC-003528', 'FC-003533', 'FC-003559', 'FC-003551', 'FC-003382'],
  maliki: ['FC-003566', 'FC-003623', 'FC-003613', 'FC-003597', 'FC-003583', 'FC-003608'],
  shafii: ['FC-003660', 'FC-003689', 'FC-003692', 'FC-003662', 'FC-003638', 'FC-003642'],
  hanbali: ['FC-003727', 'FC-003770', 'FC-003759', 'FC-003734', 'FC-003753', 'FC-003768'],
});
// D3B F1: «المذاهب الأربعة» that only introduces one or two named schools («من المذاهب الأربعة، الحنفية
// لا يشترطون…») is scope, not a four-school claim: the named schools are the holder (witness Q26).
const fourSchools = (claim) => claim.kinds.includes('madhhab')
  && (claim.madhhabs.length === 4 || (FOUR_RE.test(' ' + fold(claim.sentence) + ' ')
    && claim.madhhabs.length !== 1 && claim.madhhabs.length !== 2));
function quoteNamesHolder(claim, quote, row) {
  const q = fold(quote);
  const schools = namedSchools(q);
  for (const kind of ['consensus', 'majority', 'council']) {
    if (claim.kinds.includes(kind) && !HOLDER[kind].test(q)
      && !(kind === 'majority' && schools.length >= 3)
      && !(kind === 'consensus' && DISAGREE_RE.test(' ' + fold(claim.sentence) + ' ') && DISAGREE_RE.test(' ' + q + ' '))) return false;
  }
  const four = fourSchools(claim);
  if (four && schools.length < 3 && !FOUR_RE.test(' ' + q + ' ')) return false;
  if (claim.kinds.includes('madhhab') && claim.madhhabs.length) {
    const fromOwnBook = row && row.subjectId && claim.madhhabs.some((m) => (MADHHAB_BOOKS[m] || []).includes(row.subjectId));
    const named = claim.madhhabs.some((m) => schools.includes(m));
    if (!fromOwnBook && !named) return false;
  }
  return true;
}

// ── D3B F1b — A FAILED SUPPORT IS RE-CHECKED ONCE, WITH THE CORRECT QUOTE ─────────────────
// MEASURED (14-tool-test DIAG, Q2 #37, Q11 #33, COMPARE-DIAG Q28 #49, Q32 #33): the reader said
// «supported» and its quote is text of its row, but the quote is too short (Q2 «وهذه صلاته بعسفان»),
// stops just before the holder's name (Q11 claim 6), or is the NEIGHBOUR's quote — the verdicts
// shifted by one sentence (Q11 claims 3–6, Q28 claims 3 and 6, Q32 claim 6). The first failure no
// longer deletes. One re-check, by the code, with: (1) the reader's own quote widened to its source
// sentence; (2) for a holder failure, the other quotes of the same reply; (3) for a sentence naming
// one or two schools, a sentence of a text it cites that names them. Each candidate is still verbatim
// text of its row and still names the holder; (2) and (3) must also share the sentence's content
// words. A sentence with a count holder (consensus, majority, council, four schools) is not re-checked:
// the holder IS its claim, and schools named in one long sentence may hold different rulings. A quote that is not text of its row
// is not re-checked: that is a fabricated quote, and it stays rejected (D-2 E1).
const OVERLAP_STOP = new Set(['في', 'من', 'علي', 'الي', 'عن', 'ان', 'او', 'لا', 'ما', 'هذا', 'هذه', 'ذلك', 'تلك', 'التي', 'الذي', 'الذين',
  'عند', 'مع', 'ثم', 'قد', 'كان', 'كانت', 'يكون', 'تكون', 'بين', 'كل', 'بعض', 'غير', 'الا', 'اذا', 'اذ', 'لم', 'لن', 'هو', 'هي', 'هم',
  'عليه', 'فيه', 'به', 'له', 'لها', 'لهم', 'عليها', 'فيها', 'بها', 'منه', 'منها', 'عنه', 'انه', 'انها', 'قال', 'قالوا', 'ذكر',
  'يري', 'يرون', 'ذهب', 'ذهبوا', 'مذهب', 'قول', 'عندهم', 'منهم', 'ايضا', 'حتي', 'لان', 'كما', 'اما', 'قد', 'الله', 'رحمه', 'رضي', 'نعم']);
const HOLDER_STEM_RE = /^(?:حنفي|احناف|مالكي|شافعي|حنابل|حنبلي|جمهور|جماهير|فقهاء|علماء|اجماع|اتفاق|اتفق|اجمع|حنيف|احمد|مالك|امام|مذهب|مذاهب|اربع)/u;
function stemOf(word) {
  let s = word.replace(/^(?:[وف]?(?:بال|لل|كال|ال)|[وفبلك])(?=\S{3})/u, '');
  const m = /(?:ين|ون|ات|ان|يه|ها|هم|ه)$/u.exec(s);
  if (m && s.length - m[0].length >= 3) s = s.slice(0, -m[0].length);
  return s;
}
function contentStems(value) {
  const out = new Set();
  for (const w of fold(String(value || '').replace(CITE_RE, ' ')).split(' ')) {
    if (!w || OVERLAP_STOP.has(w)) continue;
    const s = stemOf(w);
    if (s.length >= 3 && !OVERLAP_STOP.has(s) && !HOLDER_STEM_RE.test(s)) out.add(s);
  }
  return out;
}
function sharedStems(a, b) {
  const B = contentStems(b);
  let n = 0;
  for (const s of contentStems(a)) if (B.has(s)) n += 1;
  return n;
}
function sourceSentences(text) {
  return String(text || '').split(/(?<=[.!؟?])\s+|\n+/u).map(fold).filter(Boolean);
}
const WIDEN_WORDS = 30;
/** The source sentence around `quote` in `text` (folded), at most WIDEN_WORDS words either side. */
function widenedQuote(quote, text) {
  const q = fold(quote);
  if (!q) return '';
  const sents = sourceSentences(text);
  for (let width = 1; width <= 3; width += 1) {
    for (let i = 0; i + width <= sents.length; i += 1) {
      const span = sents.slice(i, i + width).join(' ');
      if (!containsQuote(span, q)) continue;
      const core = q.replace(/^[وف](?=\S{2})/u, '');
      const at = span.indexOf(span.includes(q) ? q : core);
      const words = span.split(' ');
      const first = at <= 0 ? 0 : span.slice(0, at).trim().split(' ').length;
      return words.slice(Math.max(0, first - WIDEN_WORDS), first + q.split(' ').length + WIDEN_WORDS).join(' ');
    }
  }
  return '';
}
const countHolder = (claim) => ['consensus', 'majority', 'council'].some((k) => claim.kinds.includes(k)) || fourSchools(claim);
function citedRefs(sentence) {
  return [...String(sentence || '').matchAll(/\[\[\s*([0-9\s،,و]+?)\s*\]\]/gu)]
    .flatMap((m) => m[1].split(/[\s،,و]+/u).map(Number)).filter((n) => Number.isInteger(n) && n > 0);
}
/** One re-check of a «supported» verdict the code could not verify; null when none holds. */
export function recheckSupport(claim, verdict, row, pool, rows) {
  const own = fold(verdict && verdict.quote);
  // A count holder (consensus, majority, council, four schools) is what the sentence asserts: the
  // reader's own quote must carry it. It is never borrowed from another quote or a wider span.
  if (!own || countHolder(claim)) return null;
  const textOf = (r) => r.fullText || r.text;
  const ownInRow = !!row && containsQuote(fold(textOf(row)), own);
  // A quote that shares under two content words with its sentence was written for another sentence:
  // the pairing error. A quote of the sentence's own words that is not in its text is neither.
  const misPaired = sharedStems(claim.sentence, verdict.quote) < 2;
  if (!ownInRow && !misPaired) return null;
  // Every candidate that holds is scored by the content it shares with the sentence; the best wins
  // (ties to the earlier step), so a neighbouring ruling in a long source sentence never beats the
  // passage the sentence is about.
  let best = null;
  const consider = (quote, r, minShared, via) => {
    if (!quote || !r || !quoteIsVerbatim(quote, textOf(r)) || !quoteNamesHolder(claim, quote, r)) return;
    const n = sharedStems(claim.sentence, quote);
    if (n >= minShared && (!best || n > best.n)) best = { quote, row: r, via, n };
  };
  const wide = (quote, r) => (countHolder(claim) ? '' : widenedQuote(quote, textOf(r)));
  const short = own.split(' ').length < MIN_QUOTE_WORDS;
  if (ownInRow) consider(wide(verdict.quote, row), row, short ? 1 : 2, 'own-widened');
  if (short) return best ? { quote: best.quote, row: best.row, via: best.via } : null;
  for (const p of pool) {
    if (!p.row || fold(p.quote) === own) continue;
    consider(p.quote, p.row, 2, 'reply-quote');
    consider(wide(p.quote, p.row), p.row, 3, 'reply-quote-widened');
  }
  if (!countHolder(claim) && (claim.madhhabs.length === 1 || claim.madhhabs.length === 2)) {
    const cited = new Set([...citedRefs(claim.sentence), ...(row ? [row.ref] : [])]);
    for (const r of rows.filter((x) => cited.has(x.ref))) {
      for (const s of sourceSentences(textOf(r))) {
        const words = s.split(' ');
        for (let at = 0; at < words.length; at += WIDEN_WORDS) {
          const span = words.slice(at, at + 2 * WIDEN_WORDS).join(' ');
          if (span.split(' ').length >= MIN_QUOTE_WORDS) consider(span, r, 3, 'cited-text');
        }
      }
    }
  }
  return best ? { quote: best.quote, row: best.row, via: best.via } : null;
}

// ── D3B F1c — A CONTRADICTION IS OF THE SAME PROPOSITION ─────────────────────────────────
// MEASURED (TOOL DIAG Q10 #28–#29): «لم يقع الاتفاق على وقوع طلاق الحائض» was replaced by the quote
// that its pronouncement is حرام. Whether a thing is forbidden and whether it takes effect are two
// propositions; one does not contradict the other. When the sentence and the quote rule in disjoint
// families, the verdict is not applied: the sentence stays, counted as unverified.
const PROPOSITION_FAMILIES = Object.freeze([
  ['effect', /(?:^|\s)[وفب]?(?:ال)?(?:وقوع|يقع|تقع|وقع|وقعت|يصح|تصح|صحه|باطل|باطله|بطلان|يبطل|تبطل|ينفذ|نفاذ|يجزي|تجزي|اجزاء|مجزي|يعتد|فاسد|فاسده|فساد|يفسد|تفسد)(?:\s|$)/u],
  ['permission', /(?:^|\s)[وفب]?(?:ال)?(?:حرام|يحرم|تحرم|تحريم|محرم|محرمه|يجوز|تجوز|جاز|جايز|جايزه|جواز|مباح|اباحه|يباح|يكره|تكره|كراهه|مكروه|حلال|يحل)(?:\s|$)/u],
  ['obligation', /(?:^|\s)[وفب]?(?:ال)?(?:واجب|واجبه|يجب|تجب|وجوب|فرض|فريضه|سنه|مسنون|مستحب|يستحب|استحباب|مندوب|يندب|لازم|يلزم)(?:\s|$)/u],
]);
const familiesOf = (value) => new Set(PROPOSITION_FAMILIES.filter(([, re]) => re.test(' ' + fold(value) + ' ')).map(([k]) => k));
export function sameProposition(sentence, quote) {
  const a = familiesOf(String(sentence || '').replace(CITE_RE, ' '));
  const b = familiesOf(quote);
  if (!a.size || !b.size) return true;
  return [...a].some((k) => b.has(k));
}

// ── THE READER THAT MUST QUOTE: THE MODEL'S HALF ─────────────────────────────────────────
export const RULING_REVIEW_SYSTEM = 'أنتَ فاحصُ أمانةٍ فقهيّة. أمامَك نصوصٌ مرقّمة، وجملٌ مرقّمةٌ من جوابٍ كُتِبَ منها. '
  + 'لكلِّ جملةٍ قرِّرْ واحدًا من ثلاثة:\n'
  + 'supported: نصٌّ منها يقولُ ما تقولُه الجملةُ نفسَه: القائلُ نفسُه (المذهبُ أو الجمهورُ أو الإجماعُ أو المجمعُ أو الكتاب)، والحكمُ نفسُه، في المسألةِ نفسِها.\n'
  + 'ويَسندُ قولَ الجمهور أو المذاهب الأربعة نصٌّ يسمّي ثلاثةً أو أكثر من المذاهب الأربعة قائلين بالحكم نفسه؛ مجرّد ذكر أسمائهم في أقوال متعارضة لا يكفي.\n'
  + 'contradicted: نصٌّ منها يقولُ خلافَها: ينسبُ إلى القائلِ نفسِه ضدَّ ما نسبَتْه الجملة، أو يحكي خلافًا حيثُ تحكي الجملةُ إجماعًا أو اتفاقًا، أو يذكرُ صفةً غيرَ الصفةِ التي ذكرَتْها.\n'
  + 'ولا تناقضَ إلّا في المسألةِ نفسِها: التحريمُ غيرُ الوقوعِ والصحّة، والوجوبُ غيرُ الجواز؛ فنصٌّ في أحدِها لا يناقضُ جملةً في غيرِه.\n'
  + 'not_found: لا نصَّ منها يقولُ ذلك.\n'
  + 'احكمْ من النصوصِ وحدَها لا من علمِك. وفي supported وcontradicted انسخْ من النصِّ الحاسمِ اقتباسًا حرفيًّا متّصلًا '
  + 'من ستِّ كلماتٍ إلى أربعين كما هو بحروفِه، واذكرْ معرّفَ صفّه ROW_n، لا رقمَ فقرةٍ داخلَ النصّ. '
  + 'وأضفْ حقلَ "khilaf": إن كانت النصوصُ نفسُها تذكرُ في المسألةِ قولين مختلفين لقائلين مختلفين فاكتبْ '
  + '{"exists":true,"a":{"row":"ROW_1","quote":"..."},"b":{"row":"ROW_2","quote":"..."}} باقتباسين حرفيَّين، وإلّا {"exists":false}. '
  + 'أخرجْ JSON وحدَه بلا أيِّ كلامٍ قبلَه أو بعدَه: {"claims":[{"id":1,"verdict":"supported","row":"ROW_3","quote":"..."}],"khilaf":{"exists":false}}';
export const RULING_REVIEW_ROW_CHARS = 4000;
export const RULING_REVIEW_MAX_TOKENS = 2000;
// D3B F3a — MEASURED (TOOL DIAG §12, COMPARE-DIAG answer 8): one call for every sentence stops at the
// 2,000-token cap on long answers — 61 of 93 sentences went unreviewed in Q1–Q14 (Q3, Q4, Q5, Q14 cut
// with invalid JSON), and Q30, Q40 likewise. A verdict with its quote runs to about 210 output tokens
// (Q2: 1,472 tokens for seven), so six sentences per call stay under the cap with room for «khilaf».
// The calls run side by side: the review's wall time stays that of one call (plus one retry, below).
export const RULING_REVIEW_BATCH = 6;

export function rulingReviewPrompt(rows, claims) {
  const texts = rows.map((row) => `ROW_${row.ref} ${row.label || ''}\n${row.writerText || String(row.fullText || row.text || '').slice(0, RULING_REVIEW_ROW_CHARS)}`).join('\n\n');
  const sentences = claims.map((claim, i) => `(${i + 1}) ${claim.sentence.replace(CITE_RE, '').trim()}`).join('\n');
  return `النصوص:\n${texts}\n\nالجمل:\n${sentences}`;
}

// D3B F3b — a reply cut at the cap keeps every verdict it FINISHED: each complete {…} object of the
// "claims" array is read on its own, and the one cut in half is not. Nothing is guessed.
function completeClaimObjects(text) {
  const out = [];
  const at = text.indexOf('"claims"');
  let i = at < 0 ? -1 : text.indexOf('[', at);
  if (i < 0) return out;
  for (i += 1; i < text.length; i += 1) {
    if (text[i] === ']') break;
    if (text[i] !== '{') continue;
    let depth = 0, inString = false, escaped = false, j = i;
    for (; j < text.length; j += 1) {
      const ch = text[j];
      if (inString) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') inString = false; continue; }
      if (ch === '"') inString = true;
      else if (ch === '{') depth += 1;
      else if (ch === '}') { depth -= 1; if (depth === 0) break; }
    }
    if (j >= text.length) break;
    try { out.push(JSON.parse(text.slice(i, j + 1))); } catch { /* a malformed object is no verdict */ }
    i = j;
  }
  return out;
}
/** TRUE when the reply is one whole JSON object with its claims array: not cut. */
export function wholeReply(raw) {
  const text = String(raw || '');
  const at = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (at < 0 || end <= at) return false;
  try { const j = JSON.parse(text.slice(at, end + 1)); return !!j && Array.isArray(j.claims); } catch { return false; }
}
/** Parse the reader's JSON; a cut reply keeps its finished verdicts (D3B F3b), the rest have none. */
export function parseVerdicts(raw, count) {
  const text = String(raw || '');
  const at = text.indexOf('{');
  const end = text.lastIndexOf('}');
  let parsed = null;
  if (at >= 0 && end > at) { try { parsed = JSON.parse(text.slice(at, end + 1)); } catch { parsed = null; } }
  const list = parsed && Array.isArray(parsed.claims) ? parsed.claims : completeClaimObjects(text);
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

// ── D3B F2a — A REMOVED SENTENCE TAKES WITH IT WHAT POINTS BACK AT IT ─────────────────────
// MEASURED (COMPARE-DIAG Q32 #33, TOOL DIAG Q2 §5): the door removed the Hanafi sentence and left
// «وقالوا: …» opening the answer; it removed the three-school paragraph and left «إلا أن مالكًا خالف…»
// and «هذه الصفة». Every sentence that refers back to a removed one goes with it, whole (R2), in a
// chain, so no reference is left pointing at nothing. It stops at the first sentence that stands alone.
// A plural pronoun verb with no subject of its own («وقالوا»، «واستدلوا»), a pronoun suffix («وعندهم»),
// a contrast that needs what it contrasts («إلا أن»، «لكن»), or «و/ف» + a demonstrative or pronoun
// («وهذا محرم»، «وهو قول»). A bare «هذه نهاية الجواب» opens nothing that was removed, and «قال النووي»
// names its own speaker.
const DEPENDENT_OPENER_RE = /^(?:[وف]?(?:قالوا|يقولون|استدلوا|احتجوا|عللوا|دليلهم|حجتهم|مستندهم|عندهم|منهم|لهم|يرون|ذهبوا)|[وف]عليه|(?:الا|غير)\s+ان|لكن|لكنه|لكنهم|بل|[وف](?:هذا|هذه|ذلك|تلك|هولاء|هو|هي|هم))(?:\s|$)/u;
const BACKREF_RE = /(?:^|\s)[وفب]?(?:هذه|هذا|تلك|ذلك)\s+(?:ال)?(?:صفه|قول|مذهب|روايه|حكم|شرط|شروط|كيفيه|طريقه|وجه|تفصيل|راي)(?:\s|$)/u;
/** TRUE when this sentence leans on the one before it: a pronoun verb, «إلا أن», «هذه الصفة». */
export function dependsOnPrevious(sentence) {
  const head = fold(String(sentence || '').replace(CITE_RE, ' ').replace(/\*\*/gu, ' ').replace(/^[\s\-*•#]+/u, ''));
  return DEPENDENT_OPENER_RE.test(head) || BACKREF_RE.test(' ' + head + ' ');
}
/** Every sentence unit of the text (the door's own boundaries), card blocks excluded. */
function sentenceUnits(text) {
  const src = String(text || '');
  const masked = src.replace(CARD_BLOCK_RE, (m) => ' '.repeat(m.length));
  const out = [];
  let start = 0;
  let inQuote = 0;
  const flush = (end) => {
    const raw = src.slice(start, end);
    const s0 = start + (raw.length - raw.trimStart().length);
    const sentence = src.slice(s0, end).trimEnd();
    start = end;
    if (sentence && masked.slice(s0, s0 + sentence.length).trim()) out.push({ start: s0, end: s0 + sentence.length, sentence });
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

// ── D3B F2b — A MADHHAB NAMED IN THE QUESTION NEVER DISAPPEARS SILENTLY ─────────────────────
// It is in the answer, or it is named in the one «لم أقف» line. «المذاهب الأربعة» names all four.
// Present in the answer: by its school name or its imam's name, anywhere in the prose.
const QUESTION_FOUR_RE = /(?:^|\s)(?:المذاهب|الايمه|الفقهاء)\s+الاربعه(?:\s|$)/u;
const IMAM_RE = Object.freeze({
  hanafi: /(?:^|\s)[وفلبك]?(?:ابو|ابي|ابا)\s+حنيفه(?:\s|$)/u,
  maliki: /(?:^|\s)[وفلبك]?(?:الامام\s+)?مالك[اه]?(?:\s|$)/u,
  shafii: /(?:^|\s)[وفلبك]?(?:ال)?شافعي(?:\s|$)/u,
  hanbali: /(?:^|\s)[وفلبك]?(?:احمد|ابن\s+حنبل)(?:\s|$)/u,
});
export function questionSchools(question) {
  const q = ' ' + fold(question) + ' ';
  if (QUESTION_FOUR_RE.test(q)) return MADHHABS.map((m) => m.key);
  return namedSchools(question);
}
function presentSchools(value) {
  const f = ' ' + fold(value) + ' ';
  const out = new Set(namedSchools(value));
  for (const [key, re] of Object.entries(IMAM_RE)) if (re.test(f)) out.add(key);
  return out;
}

// ── THE REMEDY: THE CODE'S, AND A WHOLE SENTENCE FOR A WHOLE SENTENCE ────────────────────
const withLam = (label) => (label.startsWith('ال') ? 'لل' + label.slice(2) : 'لـ' + label);
// D3B F4c — the line names exactly what was not found (R1). MEASURED (TOOL DIAG §3, COMPARE-DIAG Q26,
// Q28, Q32): «لم أقف على نصٍّ يحكي الإجماعَ أو الاتفاقَ في هذا» read as a denial of the whole answer,
// beside a kept, source-supported agreement. The door's line now carries the head of the sentence it
// struck, in quotation marks: «… في: «إذا اشتدّ الخوفُ ولم يمكن قسمُ الجماعة»», wherever the old wording
// would read as denying a KEPT claim sentence (options.named, decided by the door). With nothing else
// kept, the old wording is already exact and stays. A school with no text keeps its own form.
// The head: the struck sentence without its list mark, its «الحنفية:» label or an opening connector, up
// to its first comma-class stop; a head under three words takes the sentence on; at most HEAD_WORDS.
const HEAD_WORDS = 24;
function sentenceHead(sentence) {
  let v = String(sentence || '').replace(CITE_RE, ' ').replace(/\*\*/gu, '').replace(/[«»"]/gu, '').replace(/\s+/gu, ' ').trim();
  v = v.replace(/^[\s\-*•#>]+/u, '').replace(/^[0-9٠-٩]+\s*[.)]\s*/u, '');
  const label = /^[^\s:،]{1,20}(?:\s+[^\s:،]{1,20}){0,2}\s*(?:\([^)]{0,30}\))?\s*:\s*/u.exec(v);
  if (label && v.length - label[0].length > 12) v = v.slice(label[0].length);
  v = v.replace(/^(?:[وف]?(?:أمّا|أما|اما)|غير\s+أنّ?|غير\s+ان|لكنّ?|كما)\s+/u, '');
  const all = v.replace(/[.؟!]+\s*$/u, '').split(' ').filter(Boolean);
  let words = v.split(/[،؛.؟!]/u)[0].trim().split(' ').filter(Boolean);
  if (words.length < 3) words = all;
  if (words.length < 2) return '';
  return words.slice(0, HEAD_WORDS).join(' ');
}
export function notFoundSentence(claim, rows = [], { named: useHead = false } = {}) {
  if (claim.kinds.includes('madhhab') && claim.madhhabs.length) {
    const present = new Set(rows.flatMap((row) => namedSchools(row.fullText || row.text)));
    const labels = claim.madhhabs.filter((m) => !present.has(m)).map((m) => MADHHABS.find((x) => x.key === m).label);
    if (labels.length) return `ولم أقفْ على نصٍّ ${labels.map(withLam).join(' ولا ')} في هذه المسألةِ على ما ذُكِر.`;
  }
  if (claim.kinds.includes('book') && claim.book) return `ولم أقفْ على هذا في نصِّ «${claim.book}».`;
  const head = useHead ? sentenceHead(claim.sentence) : '';
  const named = (base, old) => (head ? `${base} في: «${head}».` : old);
  if (claim.kinds.includes('council')) return named('ولم أقفْ على نصِّ قرارٍ لمجمعٍ فقهيٍّ', 'ولم أقفْ على نصِّ قرارٍ لمجمعٍ فقهيٍّ في هذا.');
  if (claim.kinds.includes('consensus')) return named('ولم أقفْ على نصٍّ يحكي الإجماعَ أو الاتفاقَ', 'ولم أقفْ على نصٍّ يحكي الإجماعَ أو الاتفاقَ في هذا.');
  if (claim.kinds.includes('majority')) return named('ولم أقفْ على نصٍّ ينسبُ هذا القولَ إلى الجمهور', 'ولم أقفْ على نصٍّ ينسبُ هذا القولَ إلى الجمهور.');
  if (claim.kinds.includes('madhhab') && claim.madhhabs.length) {
    const labels = claim.madhhabs.map((m) => MADHHABS.find((x) => x.key === m).label).join(' و');
    return named(`ولم أقفْ على نصٍّ يُسنِدُ إلى ${labels} ما نُسِبَ إليهم`, 'ولم أقفْ على نصٍّ يُسنِدُ هذا الحكمَ بعينِه.');
  }
  if (claim.kinds.includes('scholar')) return named('ولم أقفْ على نصٍّ يُسنِدُ هذا القولَ إلى قائلِه', 'ولم أقفْ على نصٍّ يُسنِدُ هذا القولَ إلى قائلِه.');
  return named('ولم أقفْ على نصٍّ يُسنِدُ هذا الحكمَ بعينِه', 'ولم أقفْ على نصٍّ يُسنِدُ هذا الحكمَ بعينِه.');
}

// D-2 E7: presentation only. Decisions remain sentence-level; absence statements
// from the writer and the door become one terminal prose line, before suggestions.
//
// D3B F4 — THE ONE «لم أقف» LINE, BUILT FROM WHOLE SENTENCES (owner rules R1, R2).
// MEASURED (TOOL DIAG §4, COMPARE-DIAG answers 1 and 4): the old span began at «لم أقف» wherever it
// matched, so «فسأعرضُ ما تسندُه، وأقفُ عند ما لم أقفْ عليه» kept «…عند ما», «ثامنًا: ما لم أقف فيه على
// نص» kept «ثامنًا: ما», «كما لم أقف…» kept «كما», «الحنابلة: لم أقف…» left an empty heading; and every
// school named in the sentence became «ولا على نصٍّ للحنفية ولا للمالكية…», dropping «من كتبهم أنفسهم»
// (Q23, Q37). Now:
//  (a) the unit is the whole line: a line whose every sentence OPENS with «لم أقف» (after a list mark,
//      «و»/«ف», «كما» or «لكن») moves whole to the one line; a line that also says something else stays
//      whole where it is — its disclosure is in context and nothing is cut out of it;
//  (b) the writer's words move verbatim: only the door's own form «على نصٍّ للـX في هذه المسألةِ على ما
//      ذُكِر» is merged by school, so a scope like «من كتبهم أنفسهم» is never widened away;
//  (c) the door's lines name what they did not find (notFoundSentence), grouped so no phrase repeats;
//  (d) a school the kept prose names is never listed as having no text: the line does not negate a
//      sentence that stays; a school the question names and the prose does not is named (D3B F2b);
//  (e) no item is said twice in the line, nor one the answer already discloses in place (D3B F5).
const MARKS_RE = /[ً-ٰٟـ]/u;
const ABSENCE_LEAD_RE = /^(?:[-*•#>]+\s*|[0-9٠-٩]+\s*[.)]\s*|\*\*\s*)*(?:[وف]?(?:كما|لكن|لكني|لكنني|كذلك)\s+)?[وف]?لم\s+[أاإ]قف(?=\s|$|[.،:؛])\s*/u;
/** The text after marks are dropped, and a map from its indexes back to the original. */
function plainWithMap(value) {
  const map = [];
  let plain = '';
  for (let i = 0; i < value.length; i += 1) {
    if (MARKS_RE.test(value[i])) continue;
    map.push(i);
    plain += value[i];
  }
  return { plain, map };
}
/** TRUE when the sentence OPENS with «لم أقف» (after a list mark, «و»/«ف», «كما», «لكن»). */
export function isAbsenceSentence(sentence) {
  return ABSENCE_LEAD_RE.test(plainWithMap(String(sentence || '').trim()).plain);
}
/** What follows the sentence's opening «لم أقف», with its own marks; null when it does not open so. */
function afterAbsenceLead(sentence) {
  const value = String(sentence || '').trim();
  const { plain, map } = plainWithMap(value);
  const m = ABSENCE_LEAD_RE.exec(plain);
  if (!m) return null;
  const end = m.index + m[0].length;
  return end >= map.length ? '' : value.slice(map[end]);
}
const ABSENCE_HEADING_RE = /^(?:#{1,6}\s*)?(?:\*\*)?\s*(?:[^\s:：]{1,14}\s*[:：.)\-–—]\s*)?ما\s+لم\s+[أاإ]قف\s+(?:فيه|عليه)(?:\s[^.؟!]*)?$/u;
const isAbsenceHeading = (line) => ABSENCE_HEADING_RE.test(plainWithMap(String(line).replace(/\*\*\s*:?\s*$/u, '').replace(/[:：]\s*$/u, '').trim()).plain);
const ORDINAL_HEADING_RE = /^(?:#{1,6}\s|\*\*[^*]+\*\*\s*:?\s*$|(?:اولا|أولا|ثانيا|ثالثا|رابعا|خامسا|سادسا|سابعا|ثامنا|تاسعا|عاشرا)\s*[:：])/u;
const looksLikeHeading = (line) => {
  const p = plainWithMap(String(line).trim()).plain;
  return ORDINAL_HEADING_RE.test(p) || (/[:：]\s*$/u.test(p) && p.split(/\s+/u).length <= 8);
};
/** A line's sentences (the door's boundaries), each with its masked twin. */
function lineSentences(line, masked) {
  const out = [];
  let start = 0;
  for (let i = 0; i < masked.length; i += 1) {
    if ('.!؟?'.includes(masked[i])) {
      let end = i + 1;
      const t = /^\s*(?:\[\[\s*[0-9\s،,و]+?\s*\]\])+/u.exec(line.slice(end));
      if (t) end += t[0].length;
      out.push({ text: line.slice(start, end).trim(), masked: masked.slice(start, end).trim() });
      start = end;
      i = end - 1;
    }
  }
  out.push({ text: line.slice(start).trim(), masked: masked.slice(start).trim() });
  return out.filter((s) => s.text);
}
const CANON_SCHOOLS_RE = /^علي نص (?:لل\S+|ل\S+)(?: ولا (?:لل\S+|ل\S+))* في هذه المساله علي ما ذكر$/u;
const NAMED_PART_RE = /^(.+?) في: («[\s\S]+»)$/u;
const PART_SPLIT_RE = /،\s+(?:[وف]?لا|[وف]?لم[ً-ٟ]*\s+[أاإ][ً-ٟ]*ق[ً-ٟ]*ف[ً-ٟ]*)\s+(?=[ً-ٟ]*[عفمل])/u;
function coveredBy(part, text) {
  const mine = contentStems(part);
  if (!mine.size) return false;
  const theirs = contentStems(text);
  let n = 0;
  for (const s of mine) if (theirs.has(s)) n += 1;
  return n / mine.size >= 0.8;
}
export function terminalNotFound(text, extraLines = [], options = {}) {
  const original = String(text || '');
  const tail = /\s*<suggestions>[\s\S]*?<\/suggestions>\s*$/u.exec(original);
  const body0 = tail ? original.slice(0, tail.index) : original;
  const mask = body0.replace(CARD_BLOCK_RE, (m) => ' '.repeat(m.length))
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|«[^»]*»|`[^`\n]*`/gu, (m) => ' '.repeat(m.length));
  const moved = [...extraLines];
  const kept = [];
  let at = 0;
  for (const line of body0.split('\n')) {
    const from = at;
    at += line.length + 1;
    const masked = mask.slice(from, from + line.length);
    const sentences = lineSentences(line, masked).filter((s) => s.masked);
    if (sentences.length && sentences.every((s) => isAbsenceSentence(s.masked))) {
      for (const s of sentences) moved.push(s.text);
      kept.push({ line: '', heading: false });
      continue;
    }
    // The prophet-word door put its own whole sentence where the quotation was: it is the door's, it moves.
    let rest = line;
    if (typeof PROPHET_NOT_FOUND === 'string' && rest.includes(PROPHET_NOT_FOUND)) {
      moved.push(PROPHET_NOT_FOUND);
      rest = rest.split(PROPHET_NOT_FOUND).join('').replace(/[ \t]{2,}/gu, ' ').trimEnd();
      if (!rest.trim()) continue;
    }
    kept.push({ line: rest, heading: isAbsenceHeading(masked) });
  }
  // An absence section's heading goes with its section, and only when its section has gone.
  const lines = kept.filter((k, i) => {
    if (!k.heading) return true;
    const next = kept.slice(i + 1).find((x) => x.line.trim());
    return !!next && !next.heading && !looksLikeHeading(next.line);
  }).map((k) => k.line);
  let body = lines.join('\n').replace(/[ \t]+\n/gu, '\n').replace(/\n{3,}/gu, '\n\n').trim();
  // (d) The question's schools the prose does not name, and no absence line names (F2b). A suggestion
  // chip («القول الراجح عند الشافعية») is not the answer naming a school.
  const present = presentSchools(body.replace(/<suggestions>[\s\S]*?<\/suggestions>/gu, ' '));
  const missing = options && options.question
    ? questionSchools(options.question).filter((k) => !present.has(k) && !moved.some((l) => presentSchools(l).has(k))) : [];
  if (!moved.length && !missing.length) return original;
  // The parts: each moved sentence without its opening «لم أقف», split at its own «، ولا …».
  const parts = [];
  const groups = new Map();
  const schools = new Set();
  const seen = new Set();
  for (const line of moved) {
    const after = afterAbsenceLead(line);
    const rawPart = (after === null ? String(line) : after).replace(CITE_RE, '').replace(/[.،؛:\s]+$/u, '').trim();
    for (const piece of rawPart.split(PART_SPLIT_RE)) {
      const part = piece.replace(/[.،؛:\s]+$/u, '').trim();
      if (!part) continue;
      const key = fold(part);
      if (CANON_SCHOOLS_RE.test(key)) { for (const s of namedSchools(part)) schools.add(s); continue; }
      const named = NAMED_PART_RE.exec(part);
      if (named) {
        const base = fold(named[1]);
        if (!groups.has(base)) { groups.set(base, { base: named[1], heads: [] }); parts.push(groups.get(base)); }
        for (const h of named[2].split(/»،\s*و«/u)) {
          const head = '«' + h.replace(/^«|»$/gu, '') + '»';
          if (!groups.get(base).heads.some((x) => fold(x) === fold(head))) groups.get(base).heads.push(head);
        }
        continue;
      }
      if (!seen.has(key)) { seen.add(key); parts.push(part); }
    }
  }
  for (const key of missing) schools.add(key);
  // A school the kept prose names, or a writer's line names, is not listed as a bare absence (d).
  const writerParts = parts.filter((p) => typeof p === 'string');
  for (const s of [...schools]) if (present.has(s) || writerParts.some((p) => presentSchools(p).has(s))) schools.delete(s);
  // No repetition (R1): an item already said in a longer item of the line is dropped; and (D3B F5) an
  // item the answer already discloses in place, in a sentence that stays, is not said a second time.
  const inPlace = sentenceUnits(body).filter((u) => /لم\s+[أاإ][\u064B-\u065F]*ق[\u064B-\u065F]*ف/u.test(u.sentence)).map((u) => u.sentence);
  const rendered = parts.map((p) => (typeof p === 'string' ? p : `${p.base} في: ${p.heads.join('، و')}`));
  const final = rendered.filter((p, i) => !inPlace.some((s) => coveredBy(p, s))
    && !rendered.some((q, j) => j !== i && q.length > p.length && coveredBy(p, q)));
  if (schools.size) final.push('على نصٍّ ' + MADHHABS.filter((m) => schools.has(m.key)).map((m) => withLam(m.label)).join(' ولا ') + ' في هذه المسألةِ على ما ذُكِر');
  if (!final.length) return [body, tail ? tail[0].trim() : ''].filter(Boolean).join('\n\n');
  const summary = 'لم أقفْ ' + final.join('، ولا ') + '.';
  return [body, summary, tail ? tail[0].trim() : ''].filter(Boolean).join('\n\n');
}
export function sourceName(row) {
  if (!row) return 'المصدر';
  if (row.kind === 'fatwa') return row.publisher ? `فتوى ${row.publisher}` : 'الفتوى';
  if (row.kind === 'encyclopedia') return row.part ? `الموسوعة الفقهية الكويتية (ج${row.part})` : 'الموسوعة الفقهية الكويتية';
  if (row.kind === 'lib_book') return [`«${row.bookTitle || row.title}»`, row.locator || ''].filter(Boolean).join(' ');
  return row.publisher || row.title || 'المصدر';
}
// D3B F2b: a contradicted school sentence keeps its school's name before the source's words, so the
// school's paragraph does not become an unlabelled quotation (witness Q28's Shafi'i paragraph).
export function contradictedSentence(row, quote, claim) {
  const keys = claim && Array.isArray(claim.madhhabs) && (claim.madhhabs.length === 1 || claim.madhhabs.length === 2) ? claim.madhhabs : [];
  const label = keys.map((k) => MADHHABS.find((m) => m.key === k).label).join(' و');
  return `${label ? label + ': ' : ''}والذي في ${sourceName(row)}: «${String(quote).trim()}» [[${row.ref}]].`;
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

export async function reviewRulings({ text, rows, ask, question = '', retryUntil = Infinity }) {
  const record = { claims: 0, supported: 0, contradicted: 0, notFound: 0, unverified: 0, downgraded: 0, verifier: 'none', changes: [], khilaf: null };
  const claims = claimSentences(text);
  record.claims = claims.length;
  if (!claims.length) return { text: terminalNotFound(text, [], { question }), record };
  const usable = (rows || []).filter((row) => row && String(row.fullText || row.text || '').trim() !== '');
  const verdicts = new Array(claims.length).fill(null);
  // D3B F3 — batches (a), partial verdicts (b), one retry (c), counted (d).
  record.batches = 0;
  record.retried = 0;
  record.cutoffs = 0;
  if (usable.length) {
    const errors = [];
    const replies = [];
    // `ask` returns the reply's text, or { text, stop } when the caller knows the stop reason.
    const askFor = async (indexes) => {
      const got = await ask(RULING_REVIEW_SYSTEM, rulingReviewPrompt(usable, indexes.map((i) => claims[i])));
      const raw = typeof got === 'string' ? got : String((got && got.text) || '');
      const cut = (got && typeof got === 'object' && got.stop === 'max_tokens') || !wholeReply(raw);
      if (cut) record.cutoffs += 1;
      replies.push(raw);
      return parseVerdicts(raw, indexes.length);
    };
    const groups = [];
    for (let i = 0; i < claims.length; i += RULING_REVIEW_BATCH) {
      groups.push(claims.slice(i, i + RULING_REVIEW_BATCH).map((_, k) => i + k));
    }
    record.batches = groups.length;
    const answered = await Promise.all(groups.map(async (indexes) => {
      let first;
      try { first = await askFor(indexes); } catch (error) { errors.push(error); return false; }
      indexes.forEach((i, k) => { verdicts[i] = first[k]; });
      // (c) One retry, for the sentences of this batch still without a verdict — a cut-off or an
      // omission. Not when the handler's clock has no room left for one more call.
      const missing = indexes.filter((i) => !verdicts[i]);
      if (missing.length && Date.now() < retryUntil) {
        record.retried += 1;
        try {
          const again = await askFor(missing);
          missing.forEach((i, k) => { if (again[k]) verdicts[i] = again[k]; });
        } catch (error) { errors.push(error); }
      }
      return true;
    }));
    if (answered.some(Boolean)) {
      record.verifier = 'ok';
      record.khilaf = replies.some((raw) => khilafFromReading(raw, usable) === true) ? true : null;
    } else {
      const error = errors[0];
      record.verifier = `error:${String(error?.status || '')}:${String(error?.message || error).slice(0, 60)}`;
    }
  } else {
    record.verifier = 'no_rows';
  }
  // (d) Counted per answer: sentences the reader gave a verdict, and those still without one. The
  // latter keep today's behaviour (below: left and counted as unverified, or struck when their
  // consensus/majority/council marker is in no text at all).
  record.reviewed = verdicts.filter(Boolean).length;
  record.unreviewed = claims.length - record.reviewed;
  const replacements = [];
  const saidOnce = new Set();
  // D3B F1b: every quote this reply gave, with its row, for the one re-check below.
  const pool = verdicts.filter((x) => x && x.quote).map((x) => ({ quote: x.quote, row: rulingRow(x, usable) }));
  const rechecks = new Map();
  record.rechecked = 0;
  record.otherProposition = 0;
  record.disclosures = 0;
  const struck = [];
  claims.forEach((claim, i) => {
    // D3B F4: «لم أقف على نصٍّ من كتب الشافعية…» discloses a gap; it attributes nothing to anyone. Struck
    // as a claim, it became a generic denial at the end (COMPARE-DIAG Q27 #33, Q38). It is still asked
    // (the reply's numbering stays that of every claim sentence) but never struck: E7 moves it whole.
    if (isAbsenceSentence(claim.sentence)) { record.disclosures += 1; return; }
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
      const again = recheckSupport(claim, v, row, pool, usable);
      if (again) {
        record.supported += 1;
        record.rechecked += 1;
        rechecks.set(i, again);
        record.changes.push({ kind: claim.kinds.join('+'), outcome: 'supported_on_recheck', via: again.via, ref: again.row.ref });
        return;
      }
      record.downgraded += 1;
      v = { verdict: 'not_found', row: NaN, quote: '' };
    }
    if (v.verdict === 'contradicted' && row && quoteIsVerbatim(v.quote, row.fullText || row.text)
      && !sameProposition(claim.sentence, v.quote)) {
      // D3B F1c: a quote about another proposition does not contradict this sentence.
      record.unverified += 1;
      record.otherProposition += 1;
      record.changes.push({ kind: claim.kinds.join('+'), outcome: 'other_proposition', ref: row.ref });
      return;
    }
    if (v.verdict === 'contradicted') {
      if (row && quoteIsVerbatim(v.quote, row.fullText || row.text)) {
        record.contradicted += 1;
        const line = contradictedSentence(row, v.quote, claim);
        replacements.push({ start: claim.start, end: claim.end, text: line });
        record.changes.push({ kind: claim.kinds.join('+'), outcome: 'contradicted', ref: row.ref });
        return;
      }
      record.downgraded += 1;
    }
    record.notFound += 1;
    struck.push(claim);
    replacements.push({ start: claim.start, end: claim.end, text: '' });
    record.changes.push({ kind: claim.kinds.join('+'), outcome: 'not_found' });
  });
  // D3B F2a: what refers back to a removed sentence goes with it, in a chain.
  record.dependents = 0;
  const units = sentenceUnits(text);
  const gone = new Set(replacements.filter((r) => r.text === '').map((r) => r.start));
  for (const r of replacements.filter((x) => x.text === '').sort((a, b) => a.start - b.start)) {
    const at = units.findIndex((u) => u.start === r.start);
    for (let j = at + 1; at >= 0 && j < units.length; j += 1) {
      const u = units[j];
      if (gone.has(u.start)) continue;
      if (replacements.some((x) => x.start === u.start) || !dependsOnPrevious(u.sentence)) break;
      replacements.push({ start: u.start, end: u.end, text: '', dependent: true });
      gone.add(u.start);
      record.dependents += 1;
      record.changes.push({ kind: 'dependent', outcome: 'removed_with_antecedent' });
    }
  }
  diagTrace('sentence-door', () => ({
    verifier: record.verifier, rows: usable.map((row) => row.ref),
    claims: claims.map((claim, i) => {
      const v = verdicts[i];
      const row = rulingRow(v, usable, claim);
      const rep = replacements.find((r) => r.start === claim.start);
      const again = rechecks.get(i);
      return {
        sentence: String(text).slice(claim.start, claim.end), kinds: claim.kinds,
        verdict: v ? v.verdict : null, quote: v ? v.quote : '', row: v ? v.row : null,
        resolvedRow: row ? row.ref : null,
        rowSource: row ? { kind: row.kind, title: row.bookTitle || row.title, volume: row.locatorSpan && row.locatorSpan.volume, page: row.locatorSpan && row.locatorSpan.pageStart, id: row.recordId || row.id } : null,
        replacedBy: rep ? rep.text : null,
        dependent: rep ? rep.dependent === true : false,
        recheck: again ? { via: again.via, row: again.row.ref, quote: again.quote } : null,
      };
    }),
    record,
  }));
  // D3B F4c: a struck sentence's line names it when the answer keeps another claim sentence.
  const removed = new Set(replacements.filter((r) => r.text === '').map((r) => r.start));
  // Any kept claim sentence, or kept prose that names a school or states a ruling: an unnamed «هذا الحكم
  // بعينه» beside it reads as retracting it too (Q26, Q36). Beside nothing of the kind it is exact.
  let keptText = String(text);
  for (const r of [...replacements].sort((a, b) => b.start - a.start)) keptText = keptText.slice(0, r.start) + ' ' + keptText.slice(r.end);
  const named = claims.some((c) => !removed.has(c.start) && !isAbsenceSentence(c.sentence))
    || presentSchools(keptText).size > 0 || ABSOLUTE_RE.test(' ' + normalizeArabic(keptText.replace(CARD_BLOCK_RE, ' ')) + ' ');
  for (const claim of struck) saidOnce.add(notFoundSentence(claim, usable, { named }));
  if (!replacements.length) return { text: terminalNotFound(text, [], { question }), record };
  let out = String(text);
  for (const r of replacements.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, r.start) + r.text + out.slice(r.end);
  }
  out = out.replace(/[ \t]+\n/gu, '\n').replace(/\n{3,}/gu, '\n\n').replace(/[ \t]{2,}/gu, ' ').trim();
  return { text: terminalNotFound(out, [...saidOnce], { question }), record };
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
