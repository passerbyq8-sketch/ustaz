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
  // ── THE OTHER SPELLING, AND IT IS THE COMMONER ONE ─────────────────────────
  // «الجواب». MEASURED 2026-08-08 on frozen pages: binbaz.org.sa, ferkous.app and alukah.net all
  // print it, and NOT ONE of them prints «الإجابة» anywhere on the page.
  //
  // IT IS DELIBERATELY NOT ADDED TO `answer` ABOVE. That regex is run over a whole page's running
  // text, and «الجواب الشامل» is a NAVIGATION ITEM on islamqa.info — a generic reader that
  // accepted it would begin the answer at the menu. These two are anchored to the FRONT of a
  // string, and are used only where a container has already bounded the text.
  answerLead: /^\s*ال?ج[ـ]*و[ـ]*ا[ـ]*ب\s*[:：]?\s*/u,
  questionLead: /^\s*ال?س[ـ]*[ؤو][ـ]*ا[ـ]*ل\s*[:：]?\s*/u,
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

// Tags that end a block. `blockText` above gets its boundaries from a querySelectorAll list, and
// MEASURED that is not enough inside a container: binbaz puts the whole of one answer in a bare
// text node beside a single <p><b>الجواب:</b></p>, so a p/li/h* sweep collected SEVEN characters
// of a 579-character answer and the page looked like a stub.
const BLOCK_TAGS = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'LI', 'UL', 'OL', 'BLOCKQUOTE',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TABLE', 'TR', 'BR', 'HR', 'FIGURE', 'PRE']);

/**
 * The block-preserving read, BOUNDED TO ONE ELEMENT and taking EVERY text node inside it.
 *
 * Used by extractors that read a named container rather than the page's running text. The
 * paragraph boundaries still matter — lib/transfer/trim.js cuts by them — but the sidebar and the
 * navigation tree are already outside the element, so nothing has to be guessed about where the
 * answer ends.
 */
function blockTextOf(root) {
  if (!root) return '';
  strip(root, CHROME);
  const parts = [];
  let buf = '';
  const flush = () => { const t = collapse(buf); if (t) parts.push(t); buf = ''; };
  const walk = (node) => {
    for (const child of Array.from(node.childNodes || [])) {
      if (child.nodeType === 3) { buf += ' ' + String(child.textContent || ''); continue; }
      if (child.nodeType !== 1) continue;
      if (BLOCK_TAGS.has(String(child.tagName || '').toUpperCase())) { flush(); walk(child); flush(); }
      // An inline element (<b>, <span class="aaya">, <sup>, <a>) is part of the sentence it sits in.
      else buf += ' ' + String(child.textContent || '');
    }
  };
  walk(root);
  flush();
  return parts.join('\n\n');
}

// ── the table ────────────────────────────────────────────────────────────────
// ── EVERY ROW IN THIS TABLE IS A CLAIM, AND EVERY CLAIM IS NOW MEASURED ──────
//
// It was not. This comment used to read «the five that really are label-shaped. MEASURED: each
// publishes both labels on the page» — and on 2026-08-08 that sentence was put to real pages for
// the first time, frozen under data/transfer-fixtures/. FOUR of the five were wrong, and all four
// for the SAME reason:
//
//     THE LABEL IS «الجواب», NOT «الإجابة».
//
// binbaz.org.sa · ferkous.app · alukah.net all print «السؤال:» and «الجواب:», and none of the
// three prints «الإجابة» anywhere on the page. LABELS.answer matches «الإجابة/الاجابه» only, so
// byLabels() returned null on every real page of all three — measured 5/5, 3/3 and 3/3.
//
// AND islamqa.info WAS THE DANGEROUS ONE. It does print «الإجابة» — in the EVALUATION WIDGET under
// the answer, and there only: «هل انتفعت بهذه الإجابة؟». So byLabels found that label, took everything after
// it, and returned a NON-NULL pair whose «answer» was the related-topics sidebar: «موضوعات ذات
// صلة … حفظ قائمة جديدة تنزيل مشاركة», measured at 198, 256 and 468 characters on three pages.
// That is precisely the silent plausible non-answer the header of this file was written about,
// living inside the file that warns about it.
//
// SO WHAT A ROW MAY CLAIM IS WHAT ITS OWN FROZEN PAGES PROVE. A host with no working reader
// DECLARES that by name; it does not inherit a generic reader nobody ever ran against it.

/**
 * A row that DECLARES INCAPACITY.
 *
 * It is a named function rather than an inline `() => null` so that «this host has no reader» can
 * be told apart from «this host's reader returned null for this page» — by readableDomains(), by
 * the gate that prints the table, and by a person reading the file. An absence that was never
 * declared is exactly what let four hosts claim a capability not one of them had.
 */
const NO_READER = () => null;
NO_READER.declaredIncapable = true;

export const EXTRACTORS = Object.freeze({
  // MEASURED WORKING on 2 frozen pages. The label pair really is «السؤال»/«الإجابة» here, and this
  // host is the reason LABELS.answer carries tatweel at all («الإجابــة»).
  //
  // KNOWN, BOUNDED, AND LEFT ALONE: the answer runs past the article into the site footer, because
  // nothing closes it — the measured tails carry «الرئيسية · موسوعات · مقالات … English». The
  // transferred text is capped at 2400 characters by lib/transfer/trim.js and the measured answers
  // are 4565 and 4754, so the footer is cut long before a reader could see it. Closing it at the
  // container is the honest fix and is NOT made here: this is a host that currently works, and a
  // change to it belongs with its own live witness.
  'islamweb.net': (doc) => byLabels(visible(doc)),

  // ── binbaz.org.sa — READ FROM THE CONTAINERS, BECAUSE THE LABELS NEVER WORKED ──
  //
  // MEASURED on 5 frozen pages: «الجواب:» on all five, «الإجابة» on none, byLabels null 5/5.
  //
  // And the labels were never the structure anyway. The page is schema.org/Article markup with
  // two named boxes, and reading the BOXES is what keeps the site out of the answer: the rendered
  // page yields 258 text blocks of which the fatwa is three, and the largest single block on it
  // is the topic tree («العبادات الطهارة المياه الآنية…», 1587 characters) — longer than most of
  // the fatwas. A running-text reader that started at a label would have carried the tree along.
  //
  //     h2.article-title__question   itemprop="alternativeHeadline"   →  «السؤال: …»
  //     div.article-content          itemprop="articleBody"           →  «الجواب: …»
  //
  // THE LEADS ARE STRIPPED BY ANCHORED REGEXES, so the word may only be removed from the FRONT of
  // its own box — a floating match would cut into a question that quotes the word «السؤال».
  'binbaz.org.sa': (doc) => {
    const qEl = doc.querySelector('h2.article-title__question, [itemprop="alternativeHeadline"]');
    const aEl = doc.querySelector('[itemprop="articleBody"], .article-content');
    if (!qEl || !aEl) return null;
    const question = collapse(String(qEl.textContent || '').replace(LABELS.questionLead, ''));
    const answer = tidy(blockTextOf(aEl).replace(LABELS.answerLead, ''));
    if (!question || answer.length < MIN_ANSWER_CHARS) return null;
    return { question, answer };
  },

  // ── ferkous.app — DECLARED INCAPABLE. A claim REMOVED, not a claim added ──────
  //
  // MEASURED on 3 frozen fatwa pages (/home/index.php?q=fatwa-NNNN): «السؤال:» on all three,
  // «الإجابة» on none, the label used is «الجواب:». byLabels returned null 3/3 — so the row
  // claimed a capability the host never had, and the transfer decision reached the right OUTCOME
  // («this page publishes no answer») for entirely the wrong REASON.
  //
  // NOT FIXED HERE, ON PURPOSE: a container reader for this host is a small job now that the
  // measurement exists, but it ADDS a transfer capability, and a new capability may not ship
  // without the live witness the owner has not yet paid for.
  'ferkous.app': NO_READER,

  // ── alukah.net — SAME MEASUREMENT, SAME DECISION ──────────────────────────────
  //
  // MEASURED on 3 frozen /fatawa_counsels/ pages: «الجواب:» on all three, «الإجابة» on none,
  // byLabels null 3/3. The host is READABLE — it carries a clean `div.answer` beside its question
  // box — it is simply not read yet, and saying so is the entire point of this row.
  //
  // And the path rule it always had is restated rather than lost: alukah publishes Q&A ONLY under
  // /fatawa_counsels/, and an article transferred as a fatwa is an article wearing a ruling. When
  // a reader is built for this host, that test comes back with it.
  'alukah.net': NO_READER,

  // ── islamqa.info — DECLARED INCAPABLE, AND THIS ONE REMOVES A LIVE HAZARD ─────
  //
  // MEASURED on 3 frozen pages: byLabels returned a NON-NULL pair on all three, and on all three
  // the «answer» was the related-topics sidebar rather than the fatwa. See the block above for the
  // cause — the only «الإجابة» on the page is the evaluation widget UNDER the answer («هل انتفعت
  // بهذه الإجابة؟»), so the reader began the answer after the answer had ended.
  //
  // A null is strictly safer than that pair. And the pair could never actually have transferred:
  // the «question» it returned had swallowed the real answer text too, so it could not reach the
  // 0.97 similarity a transfer requires. The hazard was that nothing in the app KNEW any of this —
  // the capability table said the host was read, and it was not.
  //
  // The real answer lives in [data-sut="answer-text"], so this host is readable too. Same rule as
  // ferkous: a new capability waits for its live witness.
  'islamqa.info': NO_READER,

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

/**
 * Every host with a ROW in the table, readable or not. Sorted.
 *
 * THIS IS NOT THE CAPABILITY LIST, and printing it as one is the conflation this batch closed.
 * It is the set of hosts this file has an opinion about — which is what a cheap pre-filter wants,
 * so that a page from anywhere else costs one Set lookup and no parse.
 */
export function transferableDomains() { return Object.keys(EXTRACTORS).sort(); }

/**
 * THE CAPABILITY LIST: hosts with a reader that has been run against frozen real pages. A host
 * that declares incapacity is absent from this by its OWN declaration, not by inference.
 */
export function readableDomains() {
  return Object.keys(EXTRACTORS).filter((d) => !EXTRACTORS[d].declaredIncapable).sort();
}

/** ...and its complement, stated rather than implied. Sorted. */
export function declaredIncapableDomains() {
  return Object.keys(EXTRACTORS).filter((d) => !!EXTRACTORS[d].declaredIncapable).sort();
}

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
