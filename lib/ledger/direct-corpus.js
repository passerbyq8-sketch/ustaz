// lib/ledger/direct-corpus.js
// READING A SCHOLAR'S OWN CORPUS DIRECTLY, WHERE ONE EXISTS.
//
// TWO SHAPES OF "HIS OWN SITE", AND THEY ARE NOT THE SAME MECHANISM:
//
//   * A SEARCHABLE DOMAIN — binbaz.org.sa. It is on the allow-list, the provider indexes it,
//     and asking for his position is an ordinary scoped search of one domain. Nothing special
//     is needed and this module returns null for it, which tells the engine to search.
//
//   * AN ADAPTER-ONLY CORPUS — binothaimeen.net. It has never been in the `site:` filter and
//     must not be: lib/binothaimeen.js reads it through the site's own endpoints, ranks
//     candidates against the question, and applies its own acceptance threshold. A Brave search
//     is neither necessary nor permitted here, so the engine calls THIS instead of planning
//     batches, and the request costs no provider call at all.
//
// WHAT IS NOT DELEGATED. The adapter decides WHICH of his pages is about the question. It does
// not decide what he ruled and it does not get to skip a gate: whatever it returns is segmented,
// span-addressed, extracted and verified exactly like a page that came from a search. The only
// thing this module changes is where the bytes came from.

import { primaryOpinionAdapter, policyFor } from './source-policy.js';
import { segmentPage } from './segment.js';

/**
 * Is this authority read through an adapter rather than through a search?
 * @returns {{domain:string, adapterId:string, adapterVersion:string}|null}
 */
export function adapterOnlyCorpusFor(authorityId) {
  const a = primaryOpinionAdapter(authorityId);
  if (!a) return null;
  const row = policyFor(a.domain);
  if (!row || row.searchable) return null;         // searchable => the ordinary scoped search
  return a;
}

/**
 * Read the corpus. Returns page-shaped objects ready for the same segmentation every other
 * page goes through.
 *
 * @param {string} authorityId
 * @param {object} issue
 * @param {object} opts  { reader } — injected so the guard can drive this without a network.
 * @returns {Promise<Array<{page:object, segmented:object}>>}
 */
export async function readDirectCorpus(authorityId, issue, opts = {}) {
  const adapter = adapterOnlyCorpusFor(authorityId);
  if (!adapter) return [];

  const reader = opts.reader || DEFAULT_READERS[authorityId];
  if (!reader) return [];

  const question = [
    ...issue.protectedEntities, ...issue.exactUserPhrases, ...issue.coreTerms, ...issue.contextVars,
  ].join(' ').trim();

  let raw;
  try {
    raw = await reader(question, issue);
  } catch {
    return [];
  }
  const list = Array.isArray(raw) ? raw : [];

  const out = [];
  for (const r of list) {
    const canonicalUrl = String(r.canonicalUrl || r.url || '');
    const text = String(r.exactText || r.authorialText || '');
    if (!canonicalUrl || !text) continue;
    // A page from an adapter is still checked against the policy: an adapter that started
    // returning URLs from somewhere else must not be believed because it is ours.
    const row = policyFor(canonicalUrl);
    if (!row || row.health !== 'enabled' || row.domain !== adapter.domain) continue;
    const page = {
      sourceId: canonicalUrl,
      url: canonicalUrl,
      canonicalUrl,
      canonicalBasis: 'fetched',
      host: adapter.domain,
      ownerId: authorityId,
      title: String(r.title || ''),
      authorialText: text,
      author: String(r.scholar || ''),
      attributionType: 'scholar-primary',
      kind: 'answer',
      dates: r.dates || {},
      media: { audio: 0, video: 0, pdf: 0, any: 0 },
      hasTranscript: true,
      adapterVersion: adapter.adapterId + '@' + adapter.adapterVersion,
    };
    const segmented = segmentPage(page);
    out.push({ page: { ...page, answerUnits: segmented.answerUnits }, segmented });
  }
  return out;
}

// The production readers. Lazily imported so a request that never asks about Ibn Uthaymeen does
// not load his adapter.
const DEFAULT_READERS = {
  'ibn-uthaymeen': async (question) => {
    const { retrieveIbnUthaymeen } = await import('../binothaimeen.js');
    return retrieveIbnUthaymeen(question, {});
  },
};
