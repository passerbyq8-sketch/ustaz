// lib/ledger/canonical.js
// WHICH URL IS THIS PAGE, AND HAVE WE ALREADY READ IT?
//
// TWO URLS ARE KEPT SEPARATE FOR THE WHOLE LIFE OF A SOURCE, and conflating them is a real
// misattribution rather than a tidiness issue:
//   * fetchedUrl    — where we actually landed after every redirect. This is the URL whose
//                     host was checked, and the only one whose content we have read.
//   * declaredCanonical — what the PAGE says it is. Page-supplied, therefore untrusted: a
//                     rel=canonical pointing off-host is either a syndication marker or an
//                     attempt to have somebody else's page cited under our allow-list.
//
// The rule: the declared canonical may become the CITED url only when it is on the same
// registrable domain and its own policy row admits it. Otherwise the fetched URL is cited,
// because that is the page we read.
//
// ── WHAT MAY BE STRIPPED FROM A QUERY STRING ────────────────────────────────
// Only parameters declared in lib/ledger/source-policy.js. `ref`, `page`, `id` and anything
// unrecognised stay: on these sites the query string routinely SELECTS the content, and a
// canonicaliser that dropped an unknown parameter would fold two different fatwas into one
// and then cite whichever it happened to read.

import { normalizeDomain } from '../source-registry.js';
import { policyFor, removableParamsFor } from './source-policy.js';

/** Registrable-ish host: lower-cased, www-stripped, port-stripped. */
export function hostOf(u) {
  try {
    return String(new URL(u).hostname || '').toLowerCase().replace(/^www\./, '');
  } catch { return ''; }
}

export function sameSite(a, b) {
  const ha = hostOf(a); const hb = hostOf(b);
  if (!ha || !hb) return false;
  if (ha === hb) return true;
  const ra = policyFor(ha); const rb = policyFor(hb);
  return !!(ra && rb && ra.domain === rb.domain);
}

/**
 * The canonical KEY for "is this the same page?".
 *
 * Folds exactly the differences that are not differences — scheme, userinfo, port, a leading
 * www., a trailing slash, a #fragment, and lower-vs-upper percent escapes (Arabic slugs arrive
 * both ways from different referrers) — and strips ONLY the declared tracking parameters.
 * Remaining query parameters are sorted so `?a=1&b=2` and `?b=2&a=1` are one page.
 *
 * The PATH is never folded. Two different pages on one host are two pages, because they can
 * support two different parts of an answer.
 */
export function canonicalKey(u) {
  let url;
  try { url = new URL(u); } catch { return ''; }
  const host = (url.hostname || '').toLowerCase().replace(/^www\./, '');
  if (!host) return '';
  const path = url.pathname
    .replace(/%[0-9a-fA-F]{2}/g, (m) => m.toUpperCase())
    .replace(/\/+$/, '');
  const removable = new Set(removableParamsFor(host).map((p) => p.toLowerCase()));
  const params = [];
  for (const [k, v] of url.searchParams.entries()) {
    if (removable.has(k.toLowerCase())) continue;
    params.push([k, v]);
  }
  params.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)));
  const qs = params.length ? '?' + params.map(([k, v]) => k + '=' + v).join('&') : '';
  return host + (path || '/') + qs;
}

/** The URL as it should be CITED: normalised scheme/host, tracking params removed, no fragment. */
export function citableUrl(u) {
  let url;
  try { url = new URL(u); } catch { return ''; }
  if (url.protocol !== 'https:') return '';
  url.hash = '';
  url.username = ''; url.password = '';
  const removable = new Set(removableParamsFor(url.hostname).map((p) => p.toLowerCase()));
  for (const k of Array.from(url.searchParams.keys())) {
    if (removable.has(k.toLowerCase())) url.searchParams.delete(k);
  }
  return url.href;
}

/**
 * Decide the citable URL for a fetched page.
 *
 * @returns {{url:string, basis:'fetched'|'declared-canonical', rejectedCanonical?:string}}
 */
export function resolveCitableUrl(fetchedUrl, declaredCanonical) {
  const fetched = citableUrl(fetchedUrl);
  if (!declaredCanonical) return { url: fetched, basis: 'fetched' };

  let abs;
  try { abs = new URL(declaredCanonical, fetchedUrl).href; } catch { return { url: fetched, basis: 'fetched' }; }

  // A canonical that leaves the site, or lands on a host with no policy row, is refused. It is
  // recorded rather than discarded so telemetry can show it happened.
  if (!sameSite(abs, fetchedUrl) || !policyFor(abs)) {
    return { url: fetched, basis: 'fetched', rejectedCanonical: abs };
  }
  const c = citableUrl(abs);
  if (!c) return { url: fetched, basis: 'fetched', rejectedCanonical: abs };
  return { url: c, basis: 'declared-canonical' };
}

/**
 * FETCH DEDUPLICATION across batches AND issues.
 *
 * The same URL comes back under two different site: filters routinely, and paying to fetch it
 * twice is the "dozens of requests" this design is required not to become. Keyed on
 * canonicalKey(), so www./trailing-slash/tracking-param variants of one page are one page.
 */
export class FetchLedger {
  constructor() {
    this.seen = new Map();      // canonicalKey -> { url, firstSeenBy }
  }

  /** Returns true the FIRST time a URL is claimed, false every time after. */
  claim(url, by = '') {
    const k = canonicalKey(url);
    if (!k) return false;
    if (this.seen.has(k)) return false;
    this.seen.set(k, { url, firstSeenBy: by });
    return true;
  }

  has(url) { return this.seen.has(canonicalKey(url)); }
  get size() { return this.seen.size; }
  keys() { return Array.from(this.seen.keys()); }
}

/** Is this a normalisable, https, policy-known URL at all? Cheap pre-filter before any I/O. */
export function admissible(u) {
  let url;
  try { url = new URL(u); } catch { return false; }
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  const d = normalizeDomain(url.hostname);
  if (!d) return false;
  const row = policyFor(d);
  return !!(row && row.health === 'enabled');
}
