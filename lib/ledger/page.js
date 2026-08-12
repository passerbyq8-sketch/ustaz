// lib/ledger/page.js
// FROM A URL TO AUTHORIAL CONTENT — or to a refusal, which is far more often the right answer.
//
// AUTHORIAL CONTENT is the text the site's own author wrote on this page. It is not the
// navigation, not the "related posts" rail, not the view counter, not the PDF-viewer chrome,
// and not the transcript that does not exist under an audio player. Every one of those has, on
// a measured page of one of these sites, been long enough to sail past a generic length gate.
//
// THE PER-HOST RULES ARE NOT DUPLICATED HERE. lib/source-page-gates.js already encodes them,
// they are already gated by the shipped path, and a second copy is exactly the drift that file
// exists to prevent. This module calls it, and adds only what the ledger needs and the shipped
// path had no use for: a page KIND, the published date as the site declares it (and never the
// modified date in its place), and the declared canonical.
//
// THERE IS NO GENERIC 50-WORD FLOOR. A short published fatwa is a valid fatwa. The floor is the
// source's own `minAnswerChars`, and the real admission test is whether an answer unit exists
// at all — which lib/ledger/segment.js decides on the extracted text, not on the page's size.

import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import { gateSourcePage, hasPageRules, pathRefusal } from '../source-page-gates.js';
import { safeFetch } from './safe-fetch.js';
import { resolveCitableUrl, hostOf } from './canonical.js';
import { policyFor, ownerOf } from './source-policy.js';
import { segmentPage } from './segment.js';

const collapse = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

// Readability's textContent is deliberately presentation-free, but answer-unit boundaries are
// evidence, not presentation: flattening two <section>s to spaces lets a condition from the first
// answer be cited with a ruling from the second. Preserve generic HTML block boundaries while
// still normalizing whitespace inside each block. No site- or fixture-specific selector lives
// here; the site-specific admission rules remain solely in source-page-gates.js.
const TEXT_BLOCKS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT', 'FIGCAPTION', 'FIGURE',
  'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'LI', 'MAIN', 'NAV', 'OL', 'P',
  'PRE', 'SECTION', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'UL',
]);
const TEXT_OMIT = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

function normalizeStructuredText(value) {
  return String(value == null ? '' : value)
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function structuredText(root) {
  let out = '';
  const boundary = () => {
    if (out.length && !out.endsWith('\n\n')) out += out.endsWith('\n') ? '\n' : '\n\n';
  };
  const walk = (node) => {
    if (!node) return;
    if (node.nodeType === 3) { out += node.nodeValue || ''; return; }
    if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return;
    const tag = String(node.tagName || '').toUpperCase();
    if (TEXT_OMIT.has(tag)) return;
    if (tag === 'BR') { boundary(); return; }
    const block = TEXT_BLOCKS.has(tag);
    if (block) boundary();
    for (const child of Array.from(node.childNodes || [])) walk(child);
    if (block) boundary();
  };
  walk(root);
  return normalizeStructuredText(out);
}

function structuredHtmlText(html) {
  const { document } = parseHTML('<html><body>' + String(html || '') + '</body></html>');
  return structuredText(document.body);
}

// Markers that a page's substance is a recording or a document rather than text. Presence of a
// player is not itself disqualifying — a page can carry both — so this only reports, and
// lib/ledger/rank.js decides using it together with how much authorial text was found.
function mediaSignals(doc) {
  const audio = doc.querySelectorAll('audio, source[type^="audio"]').length;
  const video = doc.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length;
  const pdf = doc.querySelectorAll('iframe[src*=".pdf"], embed[type="application/pdf"], object[type="application/pdf"]').length;
  return { audio, video, pdf, any: audio + video + pdf };
}

/**
 * The site's own published date, and ONLY that.
 *
 * `dateModified` is deliberately read into its own field and never promoted. A page edited
 * yesterday is not a ruling issued yesterday, and treating the two as one is how «آخر فتوى»
 * gets written about a fatwa from 1994.
 */
export function readDates(doc) {
  const out = { published: '', modified: '', source: 'none', confidence: 'none' };
  const pick = (sel, attr) => {
    const el = doc.querySelector(sel);
    if (!el) return '';
    const v = attr === 'text' ? collapse(el.textContent) : el.getAttribute(attr);
    return collapse(v || '');
  };
  const published = pick('meta[property="article:published_time"]', 'content')
    || pick('meta[name="date"]', 'content')
    || pick('time[datetime][itemprop="datePublished"]', 'datetime')
    || pick('[itemprop="datePublished"]', 'content');
  const modified = pick('meta[property="article:modified_time"]', 'content')
    || pick('[itemprop="dateModified"]', 'content');

  // JSON-LD, where the site publishes it. Read defensively: it is site-controlled data.
  if (!published) {
    for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
      let j;
      try { j = JSON.parse(s.textContent || ''); } catch { continue; }
      const nodes = Array.isArray(j) ? j : [j];
      for (const n of nodes) {
        if (n && typeof n.datePublished === 'string') { out.published = collapse(n.datePublished); break; }
      }
      if (out.published) break;
    }
  } else {
    out.published = published;
  }
  out.modified = modified;
  if (out.published) { out.source = 'published'; out.confidence = 'declared'; }
  else if (out.modified) { out.source = 'modified-only'; out.confidence = 'none'; }
  return out;
}

export function declaredCanonical(doc) {
  const el = doc.querySelector('link[rel="canonical"]');
  return el ? collapse(el.getAttribute('href') || '') : '';
}

/** What KIND of page is this? Used as a hard gate by lib/ledger/rank.js. */
export function classifyPageKind(url, doc, text, media) {
  const why = pathRefusal(url, url);
  if (why) return 'index';
  // A page that is mostly links is a list, whatever its path says.
  const links = doc.querySelectorAll('a').length;
  const linkText = Array.from(doc.querySelectorAll('a')).reduce((n, a) => n + collapse(a.textContent).length, 0);
  const density = text.length ? linkText / text.length : 1;
  if (links > 40 && density > 0.5) return 'index';
  if (media.any > 0 && text.length < 400) return 'media-only';
  if (text.length >= 400) return 'article';
  if (text.length > 0) return 'answer';
  return 'unknown';
}

/**
 * FETCH, EXTRACT AND SEGMENT ONE PAGE.
 *
 * @returns {{ok:true, page:object, segmented:object} | {ok:false, reason:string, url:string}}
 * Never throws for an expected failure.
 */
export async function loadPage(url, opts = {}) {
  const row = policyFor(url);
  if (!row || row.health !== 'enabled') return { ok: false, reason: 'host-not-enabled', url };

  const fetched = await safeFetch(url, opts);
  if (!fetched.ok) return { ok: false, reason: fetched.reason, url };

  const { document: doc } = parseHTML(fetched.html);
  const media = mediaSignals(doc);
  const canonical = resolveCitableUrl(fetched.fetchedUrl, declaredCanonical(doc));

  let title = collapse(doc.title);
  let text = '';
  let byline = '';
  let usedReadability = false;
  try {
    const article = new Readability(doc.cloneNode(true)).parse();
    const articleText = article
      ? (article.content ? structuredHtmlText(article.content) : normalizeStructuredText(article.textContent))
      : '';
    if (article && collapse(articleText).length > 200) {
      title = collapse(article.title) || title;
      text = articleText;
      byline = collapse(article.byline || '');
      usedReadability = true;
    } else {
      text = structuredText(doc.body);
    }
  } catch {
    text = structuredText(doc.body);
  }

  // The shipped per-host admission, unchanged and not re-implemented. A host with no rules
  // skips it exactly as it does on the live path.
  let author = '';
  let attributionType = '';
  if (hasPageRules(canonical.url || fetched.fetchedUrl)) {
    const structuredBeforeGate = text;
    const gated = gateSourcePage({
      url, finalUrl: fetched.fetchedUrl, doc, title, text, usedReadability, byline,
    });
    if (!gated.ok) return { ok: false, reason: 'page-gate:' + gated.note, url: fetched.fetchedUrl };
    title = gated.title || title;
    // The gate intentionally compares collapsed prose for admission, but that representation is
    // not evidence segmentation. If it accepted the same words, retain the structured extraction
    // and its block boundaries. A host extractor that materially selected different content still
    // wins, with any boundaries it returned normalized but not flattened.
    text = collapse(gated.text) === collapse(structuredBeforeGate)
      ? structuredBeforeGate
      : normalizeStructuredText(gated.text);
    author = gated.author || '';
    attributionType = gated.attributionType || '';
  }

  const kind = classifyPageKind(canonical.url || fetched.fetchedUrl, doc, text, media);
  const dates = readDates(doc);
  const sourceId = canonical.url || fetched.fetchedUrl;

  const page = {
    sourceId,
    url: fetched.fetchedUrl,
    canonicalUrl: canonical.url,
    canonicalBasis: canonical.basis,
    rejectedCanonical: canonical.rejectedCanonical || '',
    host: hostOf(sourceId),
    ownerId: ownerOf(sourceId),
    title,
    authorialText: text,
    author,
    attributionType,
    kind,
    dates,
    media,
    hasTranscript: !(media.any > 0 && text.length < row.pagePolicy.minAnswerChars),
    adapterVersion: row.adapterId + '@' + row.adapterVersion,
  };
  const segmented = segmentPage(page);
  return { ok: true, page: { ...page, answerUnits: segmented.answerUnits }, segmented };
}

/** Rebuild a page from a cached extraction, without a fetch. Same shape as loadPage(). */
export function pageFromCache(canonicalUrl, cached) {
  const row = policyFor(canonicalUrl);
  if (!row || row.health !== 'enabled') return { ok: false, reason: 'host-not-enabled', url: canonicalUrl };
  const page = {
    sourceId: canonicalUrl,
    url: canonicalUrl,
    canonicalUrl,
    canonicalBasis: 'fetched',
    host: hostOf(canonicalUrl),
    ownerId: ownerOf(canonicalUrl),
    title: cached.title || '',
    authorialText: cached.authorialText || '',
    author: cached.author || '',
    attributionType: cached.attributionType || '',
    kind: cached.kind || 'unknown',
    dates: cached.dates || {},
    media: { audio: 0, video: 0, pdf: 0, any: 0 },
    hasTranscript: true,
    adapterVersion: cached.adapterVersion || (row.adapterId + '@' + row.adapterVersion),
  };
  const segmented = segmentPage(page);
  return { ok: true, page: { ...page, answerUnits: segmented.answerUnits }, segmented };
}
