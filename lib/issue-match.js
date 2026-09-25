// lib/issue-match.js — م٢-و (BEFORE_WRITING_V1): the evidence is matched to the reader's ISSUE, not to
// the reader's words, so «the adjacent card» — a fatwa about the neighbouring question — does not come.
//
// THE OWNER'S ITEM (program order 2026-09-24, م٢-و): «المطابقةُ بالمسألةِ في الفتاوى المخزّنةِ بدلَ قربِ
// الألفاظ، حتّى لا تأتي البطاقةُ المجاورة». And §٢-٥: «المطابقةُ بالمسألةِ لا بالألفاظ».
//
// WHAT WAS MEASURED (02-brain/measure/A, D, F):
//   * the fatwa store admits a record when 2 of the first 5 topic tokens sit near each other in its
//     title or question: «من مسح مسافرًا ثم أقام» and «من مسح مقيمًا ثم سافر» score 46 = 46 for the
//     مقيم→سافر question; «عيب في الزوج لم يخبر به» is admitted for «من غشنا فليس منا»;
//   * the encyclopedia search is OR + prefix + fuzzy with no relevance gate: in 7 of 14 fixture groups
//     all three rows were off-topic («تكبّر» → تكبير, «السلام عليكم» → تحية), and nonsense words return
//     six random articles (measured in this program: «زغبلقه القرطمبوس…» → سائق، بتراء، حسم…);
//   * the library's top hit is often the wrong chapter, and its wording decides the result.
// Two readers, both the fast model, both with a deterministic fallback so a failure costs nothing
// but the matching:
//   1. BEFORE the gathering, the RESOLVER names the issue and writes the searches in the books' own
//      words (two short fatwa queries, one library query, up to two encyclopedia headwords);
//   2. AFTER it, the JUDGE keeps only the texts that answer THAT issue.
import { normalizeArabic } from './route-classify.js';
// د-١ (DIAG_TRACE_V1) — records only while a traced turn is open.
import { diagTrace } from './diag-trace.js';

export const RESOLVER_SYSTEM = 'أنتَ تستخرجُ المسألةَ الفقهيّةَ من سؤالِ قارئ، وتكتبُ بحثًا عنها بألفاظِ كتبِ الفقهِ والفتاوى. '
  + 'أخرجْ JSON وحدَه بلا أيِّ كلامٍ قبلَه أو بعدَه: '
  + '{"issue":"المسألةُ في جملةٍ قصيرة","fatwa_queries":["كلمتان أو ثلاث","كلمتان أو ثلاث"],'
  + '"library_query":"عبارةٌ من ثلاثِ كلماتٍ إلى ستّ بألفاظِ الفقهاء","encyclopedia_terms":["مصطلحُ المادّة في الموسوعة الفقهية"]}. '
  + 'لا تضعْ في البحثِ كلماتِ السؤالِ العامّة (حكم، ما، هل، المذاهب، الأربعة، بالتفصيل).';
export const JUDGE_SYSTEM = 'أمامَك مسألةُ قارئٍ ونصوصٌ مرشَّحةٌ مرقّمة. أبقِ النصوصَ التي تتكلّمُ في المسألةِ نفسِها بعينِها، '
  + 'واطرحْ ما يتكلّمُ في مسألةٍ مجاورة (كمَن مسحَ مقيمًا ثمّ سافرَ مقابلَ مَن مسحَ مسافرًا ثمّ أقام) أو في موضوعٍ آخرَ '
  + 'يشتركُ معها في الألفاظ. نصُّ الموسوعةِ أو الكتابِ الذي يبوّبُ المسألةَ نفسَها يبقى ولو تكلّمَ في غيرِها أيضًا. '
  + 'أخرجْ JSON وحدَه: {"keep":[1,4]}';
export const RESOLVER_MAX_TOKENS = 400;
export const JUDGE_MAX_TOKENS = 300;

const firstJson = (raw) => {
  const text = String(raw || '');
  const at = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (at < 0 || end <= at) return null;
  try { return JSON.parse(text.slice(at, end + 1)); } catch { return null; }
};
const MAX_QUERY_CHARS = 180;
const words = (value) => normalizeArabic(String(value || '')).split(' ').filter((w) => w.length >= 2);
const shortQuery = (value, maxWords) => words(value).slice(0, maxWords).join(' ').slice(0, MAX_QUERY_CHARS).trim();

/**
 * The resolver's plan, validated: every query is folded, short and non-empty, or dropped. A plan with
 * no usable query at all is `null`, and the caller falls back to its own deterministic queries.
 */
export function parseIssuePlan(raw) {
  const j = firstJson(raw);
  if (!j || typeof j !== 'object') return null;
  const fatwaQueries = [...new Set((Array.isArray(j.fatwa_queries) ? j.fatwa_queries : []).map((q) => shortQuery(q, 3)).filter(Boolean))].slice(0, 2);
  const libraryQuery = shortQuery(j.library_query, 6);
  const encyclopediaTerms = [...new Set((Array.isArray(j.encyclopedia_terms) ? j.encyclopedia_terms : []).map((q) => shortQuery(q, 3)).filter(Boolean))].slice(0, 2);
  if (!fatwaQueries.length && !libraryQuery && !encyclopediaTerms.length) return null;
  return { issue: String(j.issue || '').replace(/\s+/gu, ' ').trim().slice(0, 200), fatwaQueries, libraryQuery, encyclopediaTerms };
}

export async function resolveIssue(question, ask) {
  try {
    const raw = await ask(RESOLVER_SYSTEM, `سؤالُ القارئ:\n${String(question || '').slice(0, 1200)}`, RESOLVER_MAX_TOKENS);
    const plan = parseIssuePlan(raw);
    diagTrace('planner', () => ({ raw, plan, fallback: plan ? null : 'unparseable_or_no_query' }));
    return plan;
  } catch (error) {
    diagTrace('planner', () => ({ plan: null, fallback: 'threw', error: String(error?.status || '') + ':' + String(error?.message || error) }));
    return null;
  }
}

/** What the judge is shown of a candidate: its source, its title or heading, and its opening. */
export function candidateLine(row, i) {
  const head = row.kind === 'fatwa' ? `فتوى: ${row.title || ''}` : row.kind === 'encyclopedia'
    ? `الموسوعة الفقهية الكويتية: ${String(row.title || '').replace(/^الموسوعة الفقهية الكويتية — /u, '')}`
    : `كتاب ${row.bookTitle || row.title || ''}${Array.isArray(row.headingPath) && row.headingPath.length ? ' — ' + row.headingPath.join(' › ') : ''}`;
  const body = String(row.fullText || row.text || '').replace(/\s+/gu, ' ').slice(0, 360);
  return `[${i + 1}] ${head}\n${body}`;
}

export function parseKeep(raw, count) {
  const j = firstJson(raw);
  if (!j || !Array.isArray(j.keep)) return null;
  const keep = [...new Set(j.keep.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= count))];
  // An explicit empty list is a verdict: nothing answers the issue. A list naming ONLY candidates that
  // do not exist is not a verdict about these candidates at all, and is read as no answer.
  if (j.keep.length && !keep.length) return null;
  return keep;
}

/**
 * The judge: which candidates answer the issue. Never throws. A failed or unreadable judge keeps
 * every candidate (the fallback is the state before this item, not an empty answer).
 */
export async function judgeCandidates({ question, issue, candidates, ask }) {
  if (!candidates.length) return { kept: [], judged: false };
  try {
    const listing = candidates.map((row, i) => candidateLine(row, i)).join('\n\n');
    const raw = await ask(JUDGE_SYSTEM, `سؤالُ القارئ:\n${String(question || '').slice(0, 800)}\n\nالمسألة: ${issue || '—'}\n\nالنصوص:\n${listing}`, JUDGE_MAX_TOKENS);
    const keep = parseKeep(raw, candidates.length);
    diagTrace('judge', () => ({
      shown: candidates.map((row, i) => ({ n: i + 1, kind: row.kind, id: row.recordId || row.id || row.url, madhhab: row.madhhab, line: candidateLine(row, i) })),
      issue, raw, keep, fallback: keep ? null : 'unparseable',
      kept: keep ? keep : candidates.map((_, i) => i + 1), dropped: keep ? candidates.map((_, i) => i + 1).filter((n) => !keep.includes(n)) : [],
    }));
    if (!keep) return { kept: candidates, judged: false };
    return { kept: candidates.filter((_, i) => keep.includes(i + 1)), judged: true };
  } catch (error) {
    diagTrace('judge', () => ({ shown: candidates.length, fallback: 'threw', error: String(error?.status || '') + ':' + String(error?.message || error) }));
    return { kept: candidates, judged: false };
  }
}
