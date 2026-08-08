// lib/transfer/extract.js — THE PUBLISHED QUESTION AND THE PUBLISHED ANSWER, PER DOMAIN.
//
// ── WHY PER DOMAIN AND NOT ONE GENERIC EXTRACTOR ─────────────────────────────
// A generic «find السؤال, find الإجابة» extractor was written first and MEASURED against real
// pages. It failed on more than half of the eight, each for a different reason, and every failure
// was silent — it returned a plausible string that was not the answer. Those failures are recorded
// beside the host they belong to, because they are the whole reason this file is a table.
//
// ── THE EIGHT, AND WHY THERE ARE SEVEN HERE ──────────────────────────────────
// mostafaaladwy.com is the eighth and is DELIBERATELY ABSENT: قرار ١٠ marked it `answer_format:
// 'video'` because its answer is a YouTube iframe over an empty text div, so it has no published
// answer to transfer. Excluding it here is the same decision, enforced a second time — a domain
// with no answer text must never reach a matcher that would then compare its FOOTER to a question.
//
// ── WHAT AN EXTRACTOR MAY RETURN ─────────────────────────────────────────────
// {question, answer} or null. Never a partial: a page that yields a question and no answer is not
// a transferable page, and returning the question alone would let the matcher score a hit and then
// transfer nothing.

import { parseHTML } from 'linkedom';
import { normalizeArabic } from '../route-classify.js';
import { isVideoAnswerDomain, hostMatches } from '../source-registry.js';

const collapse = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

// Collapses runs of spaces but KEEPS the blank line between blocks. Used for the ANSWER, because
// lib/transfer/trim.js cuts at paragraph boundaries and a fully collapsed answer has none.
const tidy = (s) => String(s == null ? '' : s)
  .replace(/[ \t ]+/g, ' ')
  .replace(/\s*\n\s*\n\s*/g, '\n\n')
  .replace(/[ \t]*\n[ \t]*/g, '\n')
  .trim();

// Folding that PRESERVES LENGTH, so an index found in the folded string is valid in the original.
// Same device as lib/source-page-gates.js, and for the same reason: the labels are matched folded
// and the text is cut from the raw string.
function foldSameLength(s) {
  return String(s == null ? '' : s)
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');
}

// The shortest thing that can be an answer. Below this the page published a stub.
export const MIN_ANSWER_CHARS = 80;
// ...and the longest thing that can be a QUESTION. A «question» of 600 characters is a page whose
// label matching ran away and swallowed the answer.
export const MAX_QUESTION_CHARS = 600;

function strip(doc, selectors) {
  for (const sel of selectors) {
    for (const el of doc.querySelectorAll(sel)) { try { el.remove(); } catch { /* linkedom */ } }
  }
}

const CHROME = ['script', 'style', 'nav', 'footer', 'aside', '.breadcrumb', '.share', '.related'];

/**
 * The generic label reader, used by the hosts whose pages really are «label, text, label, text».
 *
 * THE TATWEEL IS WHY THIS TAKES A REGEX AND NOT A STRING. islamweb.net prints «الإجابــة» with
 * tatweel inside the word, so indexOf('الإجابة') finds nothing on the very host that publishes
 * the most Q&A pages in the registry.
 */
const Q_LABEL = /ال?سـ*ؤ?ؤ?س?ـ*ؤال/;   // never used directly; see LABELS
const LABELS = Object.freeze({
  // Written as character classes with optional tatweel between every letter.
  question: /(?:^|\s)ال?س[ـ]*[ؤو][ـ]*ا[ـ]*ل\s*[:：]?/u,
  answer: /(?:^|\s)ال?[إا][ـ]*ج[ـ]*ا[ـ]*ب[ـ]*[ةه]\s*[:：]?/u,
});

function byLabels(bodyText) {
  const folded = foldSameLength(bodyText);
  const qm = LABELS.question.exec(folded);
  const am = LABELS.answer.exec(folded);
  if (!am) return null;                       // no answer label: not a Q&A page shape
  const aStart = am.index + am[0].length;
  const answer = tidy(bodyText.slice(aStart));
  const question = qm && qm.index < am.index
    ? collapse(bodyText.slice(qm.index + qm[0].length, am.index))
    : '';
  if (!question || answer.length < MIN_ANSWER_CHARS) return null;
  return { question, answer };
}

// BLOCK BOUNDARIES ARE LOAD-BEARING TWICE OVER, and `textContent` destroys them.
//
// MEASURED: `<p>السؤال: …</p><p>الإجابة: …</p>` yields «…العقيقةالإجابة:…» — the two run together
// with no separator, so the answer label has no word boundary in front of it and the label regex
// finds NOTHING. Every page on every label-shaped host failed this way, and the failure looked
// like «this page has no answer».
//
// And the paragraphs are the unit lib/transfer/trim.js trims by. A collapsed page is ONE
// paragraph, so the length rule would have had no boundary to cut at and would have carried every
// answer whole — a second silent failure behind the first.
function blockText(doc) {
  strip(doc, CHROME);
  const blocks = Array.from(doc.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote'))
    .map((el) => collapse(el.textContent))
    .filter(Boolean);
  if (blocks.length) return blocks.join('\n\n');
  return collapse(doc.body ? doc.body.textContent : '');
}

const visible = (doc) => blockText(doc);

// ── the table ────────────────────────────────────────────────────────────────
export const EXTRACTORS = Object.freeze({
  // The five that really are label-shaped. MEASURED: each publishes both labels on the page.
  'islamweb.net': (doc) => byLabels(visible(doc)),
  'islamqa.info': (doc) => byLabels(visible(doc)),
  'binbaz.org.sa': (doc) => byLabels(visible(doc)),
  'ferkous.app': (doc) => byLabels(visible(doc)),

  // alukah.net publishes Q&A ONLY under /fatawa_counsels/. Everything else on the host is an
  // article with no question, and an article transferred as a fatwa is an article wearing a
  // ruling. The path test lives with the extractor because it is part of "can this page be read".
  'alukah.net': (doc, url) => (/\/fatawa_counsels\//.test(String(url || '')) ? byLabels(visible(doc)) : null),

  // sh-albarrak.com is a Next.js app. MEASURED: the rendered body carries the QUESTION ALONE —
  // the answer exists only inside the __NEXT_DATA__ JSON blob. An extractor reading the DOM here
  // returns a question with no answer and looks like a page that simply had none.
  'sh-albarrak.com': (doc) => {
    const el = doc.querySelector('#__NEXT_DATA__');
    if (!el) return null;
    let data = null;
    try { data = JSON.parse(el.textContent || '{}'); } catch { return null; }
    const post = data && data.props && data.props.pageProps && data.props.pageProps.postContent;
    if (!post) return null;
    const question = collapse(post.question || '');
    const answer = tidy(post.content || '');
    if (!question || answer.length < MIN_ANSWER_CHARS) return null;
    return { question, answer };
  },

  // almosleh.com. TWO measured traps on one host:
  //  * «السؤال» appears in a SUBMISSION FORM near the top of every page, so taking the FIRST
  //    marker harvests «حل المعادلة: 1 + 1 = ?» — the form's anti-bot challenge — as the question.
  //  * it sets <base href>, so hrefs resolved against the page URL come out wrong. Not this
  //    function's problem, but it is why nothing here resolves a link.
  // The fix is to read the LAST question label that still precedes an answer label.
  'almosleh.com': (doc) => {
    const body = visible(doc);
    const folded = foldSameLength(body);
    const am = LABELS.answer.exec(folded);
    if (!am) return null;
    const before = folded.slice(0, am.index);
    // The last question label before the answer — never the first.
    let qIdx = -1, qLen = 0;
    const re = new RegExp(LABELS.question.source, 'gu');
    let m;
    while ((m = re.exec(before)) !== null) { qIdx = m.index; qLen = m[0].length; }
    if (qIdx === -1) return null;
    const question = collapse(body.slice(qIdx + qLen, am.index));
    const answer = tidy(body.slice(am.index + am[0].length));
    if (!question || answer.length < MIN_ANSWER_CHARS) return null;
    return { question, answer };
  },
});

/** Which hosts this file can read. Sorted, so the gate can print it. */
export function transferableDomains() { return Object.keys(EXTRACTORS).sort(); }

/**
 * Extract the published pair from a page.
 *
 * @param {string} url   the page's final URL
 * @param {string} html  its HTML
 * @returns {{question:string, answer:string, domain:string}|null}
 */
export function extractPair(url, html) {
  if (!url || !html) return null;
  // قرار ١٠ ENFORCED A SECOND TIME. A video-answer domain has no published answer text at all, so
  // it may not reach an extractor — whatever a generic reader returned for it would be chrome.
  if (isVideoAnswerDomain(url)) return null;
  let host = '';
  try { host = new URL(url).hostname; } catch { return null; }
  const domain = Object.keys(EXTRACTORS).find((d) => hostMatches(host, d));
  if (!domain) return null;
  let document;
  try { ({ document } = parseHTML(html)); } catch { return null; }
  let pair = null;
  try { pair = EXTRACTORS[domain](document, url); } catch { return null; }
  if (!pair) return null;
  const question = collapse(pair.question).slice(0, MAX_QUESTION_CHARS);
  const answer = tidy(pair.answer);
  // A question that ran away and swallowed the answer is not a question. Measured by the fact
  // that it no longer normalises to anything a reader would type.
  if (!normalizeArabic(question) || answer.length < MIN_ANSWER_CHARS) return null;
  return { question, answer, domain };
}
