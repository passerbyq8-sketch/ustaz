// lib/ledger/rank.js
// HARD GATES FIRST, THEN AN ORDER. Never a score that a good title can talk its way past.
//
// THE DISTINCTION THIS FILE IS BUILT ON. A ranker that expresses everything as points has no
// way to say "never". Give a video page −100 and a strong title match +120 and the video wins;
// that is not a tuning error, it is what a single additive scale MEANS. So the refusals here
// return a REASON and stop, and only what survives every refusal is ordered.
//
// TWO STAGES, because two different sets of facts are available:
//   * PRE-FETCH  — capability eligibility, capability priority, the requested scholar, the URL
//                  shape, and how much of the question the title and URL echo. Cheap, and it
//                  decides what we pay to read.
//   * POST-FETCH — what the page actually says, what KIND of page it turned out to be, who
//                  wrote it, and whether a candidate answer unit exists at all. Expensive, and
//                  it decides what may become evidence.
//
// A SNIPPET IS NEVER EVIDENCE, AT EITHER STAGE. It may raise a candidate's position in a queue;
// it may not fill a slot, support a claim, or appear in an answer.

import { capabilityForIntent } from './capability.js';
import { capabilityEligible, capabilityPriority, policyFor, ownerOf } from './source-policy.js';
import { admissible, hostOf } from './canonical.js';
import { normalizeArabic } from '../route-classify.js';

// ── URL shapes ───────────────────────────────────────────────────────────────
// Generic across every CMS. Matched as whole path segments, so a slug that merely contains one
// of these words is unaffected.
const GENERIC_INDEX_SEGMENTS = new Set([
  'category', 'categories', 'tag', 'tags', 'author', 'archive', 'archives',
  'search', 'results', 'index', 'list', 'feed', 'sitemap', 'page',
]);
const TAXONOMY_SUFFIX = /-(?:category|categories|tag|tags|archive)$/;
const MEDIA_EXT = /\.(?:mp3|mp4|m4a|wav|ogg|avi|mkv|mov|pdf|docx?|pptx?|zip|rar)$/i;

function decodedPath(u) {
  try {
    const url = new URL(u);
    try { return decodeURIComponent(url.pathname).toLowerCase(); } catch { return url.pathname.toLowerCase(); }
  } catch { return ''; }
}

/**
 * Why this URL can be refused WITHOUT fetching it, or null.
 *
 * Everything here is decidable from the string, so it costs nothing — and it is the same rule
 * the post-fetch gate applies, so the two cannot disagree about what a listing is.
 */
export function urlRefusal(u) {
  if (!admissible(u)) return 'not-admissible';
  const path = decodedPath(u);
  if (MEDIA_EXT.test(path)) return 'media-file';
  const segs = path.split('/').filter(Boolean);
  for (const s of segs) {
    if (GENERIC_INDEX_SEGMENTS.has(s)) return 'generic-index:' + s;
    if (TAXONOMY_SUFFIX.test(s)) return 'taxonomy-archive:' + s;
  }
  const row = policyFor(u);
  if (row) {
    for (const p of row.confirmedIndexPatterns) {
      if (path === p || path.startsWith(p.endsWith('/') ? p : p + '/')) return 'confirmed-index:' + p;
    }
  }
  return null;
}

/** A soft index: probably a section root, but the site does publish leaves beneath it. */
export function softIndexPenalty(u) {
  const row = policyFor(u);
  if (!row) return 0;
  const path = decodedPath(u);
  for (const p of row.softIndexPatterns) {
    // The ROOT and its pagination are listings; anything deeper is a page.
    if (path === p || path === p + '/' || /^\/page\/\d+$/.test(path.slice(p.length))) return 30;
  }
  return 0;
}

// ── term echo ────────────────────────────────────────────────────────────────
const norm = (s) => normalizeArabic(String(s == null ? '' : s));

function termHits(terms, hay) {
  const h = ' ' + norm(hay) + ' ';
  let hits = 0;
  for (const t of terms || []) {
    const n = norm(t);
    if (!n) continue;
    if (h.includes(' ' + n + ' ') || (n.split(' ').length > 1 && h.includes(n))) hits++;
  }
  return hits;
}

/**
 * PRE-FETCH RANKING for one issue's candidates.
 *
 * @param {object} issue         a validated IR issue
 * @param {Array} candidates     [{url, title, snippet}]
 * @returns {{ranked:Array, refused:Array}}
 *
 * `refused` carries a reason per dropped candidate so telemetry can report WHY a search came
 * back empty — "no results" and "five results, all catalogues" are different problems.
 */
export function rankPreFetch(issue, candidates) {
  const capability = capabilityForIntent(issue.intent);
  const ranked = [];
  const refused = [];

  for (const c of candidates || []) {
    const url = c && c.url;
    if (!url) { refused.push({ url: String(url), reason: 'no-url' }); continue; }

    // ── hard gates ──
    const why = urlRefusal(url);
    if (why) { refused.push({ url, reason: why }); continue; }
    if (!capabilityEligible(url, capability)) {
      refused.push({ url, reason: 'capability-ineligible:' + capability });
      continue;
    }
    // A question about a NAMED scholar's own position may only look at his own registered
    // corpus. A general article on somebody else's site is not his opinion, whatever it says.
    if (issue.requestedAuthorityId) {
      const owner = ownerOf(url);
      if (owner !== issue.requestedAuthorityId) {
        refused.push({ url, reason: 'not-the-requested-authority:' + String(owner) });
        continue;
      }
    }

    // ── ordering, over what survived ──
    const hay = String(c.title || '') + ' ' + decodedPath(url).replace(/[-_/]/g, ' ');
    let score = capabilityPriority(url, capability);
    score += termHits(issue.protectedEntities, hay) * 25;
    score += termHits(issue.exactUserPhrases, hay) * 20;
    score += termHits(issue.coreTerms, hay) * 8;
    score += termHits(issue.contextVars, hay) * 3;
    score -= softIndexPenalty(url);
    ranked.push({ ...c, url, host: hostOf(url), score });
  }

  ranked.sort((a, b) => b.score - a.score);
  return { ranked, refused };
}

// ── post-fetch ───────────────────────────────────────────────────────────────
export const PAGE_KINDS = Object.freeze([
  'answer', 'article', 'index', 'media-only', 'unknown',
]);

/**
 * POST-FETCH ADMISSION. Everything here is about what the page turned out to BE.
 *
 * @param {object} issue
 * @param {object} page   {url, title, kind, authorialText, answerUnits, author, ownerId, hasTranscript, dates}
 * @returns {{ok:boolean, reason?:string, score:number}}
 *
 * `authorialText` is the field name lib/ledger/page.js produces and the one this reads. It is
 * NOT called `text`: a page object also carries the raw document text at various points, and
 * scoring the wrong one is the difference between reading the article and reading the
 * navigation.
 */
export function admitPostFetch(issue, page) {
  const capability = capabilityForIntent(issue.intent);
  const row = policyFor(page.url);
  if (!row || row.health !== 'enabled') return { ok: false, reason: 'host-not-enabled', score: 0 };
  if (!capabilityEligible(page.url, capability)) {
    return { ok: false, reason: 'capability-ineligible:' + capability, score: 0 };
  }
  if (page.kind === 'index') return { ok: false, reason: 'page-is-an-index', score: 0 };

  // AUDIO AND VIDEO WITHOUT A TRANSCRIPT IS A HARD REJECT. Not a penalty: there is nothing to
  // read, so there is nothing that could be quoted, so no amount of relevance can rescue it.
  if (page.kind === 'media-only') return { ok: false, reason: 'media-without-transcript', score: 0 };
  if (row.pagePolicy.requiresTranscript && page.hasTranscript === false) {
    return { ok: false, reason: 'media-without-transcript', score: 0 };
  }

  // NO CANDIDATE ANSWER UNIT MEANS NO EVIDENCE. A page whose extractor found no authorial
  // block is a page nobody read.
  const units = Array.isArray(page.answerUnits) ? page.answerUnits : [];
  if (!units.length) return { ok: false, reason: 'no-answer-unit', score: 0 };

  const authorial = String(page.authorialText || '');
  if (authorial.length < row.pagePolicy.minAnswerChars) {
    return { ok: false, reason: 'below-min-answer-chars:' + authorial.length, score: 0 };
  }

  if (issue.requestedAuthorityId) {
    const owner = page.ownerId || ownerOf(page.url);
    if (owner !== issue.requestedAuthorityId) {
      return { ok: false, reason: 'not-the-requested-authority', score: 0 };
    }
  }

  // ── ordering ──
  let score = capabilityPriority(page.url, capability);
  score += termHits(issue.protectedEntities, authorial) * 20;
  score += termHits(issue.exactUserPhrases, authorial) * 25;
  score += termHits(issue.coreTerms, authorial) * 10;
  score += termHits(issue.contextVars, authorial) * 4;
  if (page.kind === 'answer') score += 15;
  if (page.author) score += 5;

  // A PAGE DATE EARNS NOTHING IN A QUESTION THAT IS NOT ABOUT TIME. Rewarding recency on a
  // timeless fiqh question is how «آخر فتوى» gets written: the ranker prefers the newest page
  // and the drafter reads the preference as a fact about the ruling.
  if (issue.temporalScope === 'dated_fact' || issue.temporalScope === 'current_context') {
    if (page.dates && page.dates.published) score += 10;
  }

  return { ok: true, score };
}
