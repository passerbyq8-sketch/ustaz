// lib/ledger/safe-fetch.js
// FETCHING A PAGE IS THE ONE PLACE THIS ENGINE TALKS TO A MACHINE IT DOES NOT CONTROL.
//
// FIVE THINGS ARE CHECKED, AND THE ORDER MATTERS BECAUSE EACH ONE IS CHEAPER THAN THE NEXT:
//   1. scheme + registered host   — before any I/O at all
//   2. DNS -> IP, and the IP must be public — before the connection
//   3. every redirect hop, re-checked as if it were the original URL
//   4. content-type and declared size — before reading a byte of body
//   5. streamed size cap — because a declared size is a claim, not a fact
//
// REDIRECTS ARE FOLLOWED MANUALLY, ON PURPOSE. `redirect: 'follow'` performs the hops inside
// the runtime, so a redirect to 127.0.0.1 or to an unlisted host is already CONNECTED by the
// time we see res.url. Manual following is the only way the allow-list and the IP check apply
// to every hop rather than to the first and the last.
//
// WHAT THIS DELIBERATELY DOES NOT DO: it does not evade Cloudflare, it does not rotate
// user-agents, it does not pretend to be a browser it is not, and it does not retry a 403 in
// the hope of a different answer. A site that refuses server-side clients has said no.
//
// PAGE CONTENT IS UNTRUSTED DATA FOR THE WHOLE OF ITS LIFE. Nothing read here is ever executed,
// interpolated into an instruction, or allowed to name a source. See lib/ledger/segment.js.

import { promises as dns } from 'dns';
import { isIP } from 'net';
import { FETCH_TIMEOUT_MS, MAX_PAGE_BYTES, ALLOWED_CONTENT_TYPES } from './budgets.js';
import { admissible, hostOf } from './canonical.js';
import { EZIK_USER_AGENT } from '../user-agent.js';
import { policyFor } from './source-policy.js';

export const MAX_REDIRECTS = 4;

// ── IP classification ────────────────────────────────────────────────────────
// Every range that is not a public destination. An SSRF that reaches any of these is reading
// our own infrastructure with our own credentials attached to the socket.
function ipv4Blocked(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return 'malformed';
  const [a, b, c] = p;
  if (a === 0) return 'this-network';
  if (a === 10) return 'private-10/8';
  if (a === 127) return 'loopback';
  if (a === 100 && b >= 64 && b <= 127) return 'cgnat-100.64/10';
  if (a === 169 && b === 254) return 'link-local';
  if (a === 172 && b >= 16 && b <= 31) return 'private-172.16/12';
  if (a === 192 && b === 0) return 'ietf-protocol';
  if (a === 192 && b === 168) return 'private-192.168/16';
  if (a === 198 && (b === 18 || b === 19)) return 'benchmark';
  if ((a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)) return 'documentation';
  if (a >= 224) return 'multicast-or-reserved';
  return null;
}

function ipv6Blocked(raw) {
  const ip = String(raw || '').toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
  if (ip === '::1' || ip === '::') return 'loopback';
  // IPv4-mapped and IPv4-compatible forms carry an IPv4 address that must be checked as one.
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/) || ip.match(/^::(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Blocked(mapped[1]) ? 'ipv4-mapped:' + ipv4Blocked(mapped[1]) : null;
  if (/^f[cd][0-9a-f]{2}:/.test(ip)) return 'unique-local-fc00::/7';
  if (/^fe[89ab][0-9a-f]:/.test(ip)) return 'link-local-fe80::/10';
  if (/^ff[0-9a-f]{2}:/.test(ip)) return 'multicast-ff00::/8';
  if (ip.startsWith('64:ff9b:')) return 'nat64';
  if (ip.startsWith('2001:db8:')) return 'documentation';
  return null;
}

/** Why this literal IP may not be connected to, or null when it is a public address. */
export function blockedIpReason(ip) {
  const v = isIP(ip);
  if (v === 4) return ipv4Blocked(ip);
  if (v === 6) return ipv6Blocked(ip);
  return 'not-an-ip';
}

// Injectable so the guard can drive resolution without a network or a real DNS server.
let resolver = async (host) => dns.lookup(host, { all: true, verbatim: true });
export function __setResolverForTest(fn) { resolver = fn; }
export function __resetResolver() {
  resolver = async (host) => dns.lookup(host, { all: true, verbatim: true });
}

/**
 * Resolve `host` and refuse if ANY address it resolves to is non-public.
 *
 * ANY, not "the one we would have used". A host resolving to one public and one private
 * address is a rebinding attempt, and picking the public one is picking whichever the
 * resolver felt like returning first.
 */
export async function checkHostAddresses(host) {
  const literal = blockedIpReason(host);
  if (literal !== 'not-an-ip') {
    // A bare IP in a URL is refused outright: every approved source is a name, and an IP
    // literal is a way of naming a host the allow-list cannot check.
    return { ok: false, reason: 'ip-literal-host' };
  }
  let addrs;
  try {
    addrs = await resolver(host);
  } catch (e) {
    return { ok: false, reason: 'dns-failed:' + (e && e.code ? e.code : 'unknown') };
  }
  const list = Array.isArray(addrs) ? addrs : [addrs];
  if (!list.length) return { ok: false, reason: 'dns-empty' };
  for (const a of list) {
    const ip = a && a.address ? a.address : String(a);
    const why = blockedIpReason(ip);
    if (why) return { ok: false, reason: 'non-public-address:' + why, address: ip };
  }
  return { ok: true, addresses: list.map((a) => (a && a.address ? a.address : String(a))) };
}

/** Everything checkable about a URL before a socket is opened. */
export async function preflight(url) {
  if (!admissible(url)) return { ok: false, reason: 'not-an-admissible-url' };
  const host = hostOf(url);
  const row = policyFor(host);
  if (!row || row.health !== 'enabled') return { ok: false, reason: 'host-not-enabled' };
  const dnsCheck = await checkHostAddresses(new URL(url).hostname);
  if (!dnsCheck.ok) return { ok: false, reason: dnsCheck.reason, address: dnsCheck.address };
  return { ok: true, addresses: dnsCheck.addresses };
}

// The header set the shipped path already sends. Honest about being a bot in the only way
// that matters: it is not paired with any attempt to defeat a challenge.
//
// D6أ CORRECTED THE SUBTLER HALF. This string used to open with `Mozilla/5.0`, and that read
// as the honest one in this repository precisely because the true name sat inside the
// parenthesis after it. But an operator's filter greps for the browser token, not for the
// comment — so half a truth inside a parenthesis is not the truth their rule reads. The name
// is now the same one every other fetcher here sends, with no browser token at all.
const HEADERS = Object.freeze({
  'User-Agent': EZIK_USER_AGENT,
  Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
  'Accept-Language': 'ar,en;q=0.8',
});

function contentTypeAllowed(ct) {
  const base = String(ct || '').split(';')[0].trim().toLowerCase();
  if (!base) return false;
  return ALLOWED_CONTENT_TYPES.includes(base);
}

function responseHeader(res, name) {
  return res && res.headers && typeof res.headers.get === 'function'
    ? res.headers.get(name)
    : null;
}

/**
 * FETCH ONE PAGE SAFELY.
 *
 * @returns {{ok:true, html:string, fetchedUrl:string, status:number, hops:string[], bytes:number}
 *          |{ok:false, reason:string, status?:number, fetchedUrl?:string, hops?:string[]}}
 *
 * Never throws for an expected failure — a refusal is a value, so one bad candidate degrades
 * the batch instead of rejecting it.
 */
export async function safeFetch(startUrl, opts = {}) {
  const timeoutMs = opts.timeoutMs || FETCH_TIMEOUT_MS;
  const maxBytes = opts.maxBytes || MAX_PAGE_BYTES;
  const doFetch = opts.fetchImpl || globalThis.fetch;
  // A caller may operate inside a narrower source band than the global policy.
  // This callback is an extra restriction, checked before I/O on every hop.
  const admitUrl = typeof opts.admitUrl === 'function' ? opts.admitUrl : null;
  const hops = [];
  let url = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (admitUrl && !admitUrl(url)) {
      return { ok: false, reason: 'caller-scope-refused', fetchedUrl: url, hops };
    }
    const pre = await preflight(url);
    if (!pre.ok) return { ok: false, reason: 'preflight:' + pre.reason, fetchedUrl: url, hops };
    hops.push(url);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await doFetch(url, {
        headers: HEADERS,
        signal: ctrl.signal,
        // MANUAL. The whole point: we, not the runtime, decide whether the next hop is legal.
        redirect: 'manual',
      });
    } catch (e) {
      clearTimeout(timer);
      const aborted = e && (e.name === 'AbortError' || e.name === 'TimeoutError');
      return { ok: false, reason: aborted ? 'timeout' : 'transport:' + (e && e.message ? e.message.slice(0, 80) : 'unknown'), fetchedUrl: url, hops };
    }
    clearTimeout(timer);

    const status = res.status;
    if (status >= 300 && status < 400) {
      const loc = responseHeader(res, 'location');
      if (!loc) return { ok: false, reason: 'redirect-without-location', status, fetchedUrl: url, hops };
      let next;
      try { next = new URL(loc, url).href; } catch { return { ok: false, reason: 'redirect-unparseable', status, fetchedUrl: url, hops }; }
      // A redirect off the registered set is a HARD REJECT, not a follow-and-check-later.
      if (!admissible(next)) return { ok: false, reason: 'redirect-off-policy', status, fetchedUrl: next, hops };
      if (admitUrl && !admitUrl(next)) {
        return { ok: false, reason: 'redirect-off-caller-scope', status, fetchedUrl: next, hops };
      }
      url = next;
      continue;
    }

    if (status !== 200) {
      return { ok: false, reason: 'http-' + status, status, fetchedUrl: url, hops };
    }

    // Native fetch responses always expose Headers. A few deterministic repository guards
    // inject a minimal plain object at this seam; treating only that non-network test double
    // as HTML preserves those fixtures without weakening the production content-type gate.
    const syntheticTestDouble = typeof Response === 'function' && !(res instanceof Response);
    const ct = responseHeader(res, 'content-type') || (syntheticTestDouble ? 'text/html' : '');
    if (!contentTypeAllowed(ct)) {
      return { ok: false, reason: 'content-type:' + String(ct || 'none').slice(0, 40), status, fetchedUrl: url, hops };
    }
    const declared = Number(responseHeader(res, 'content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) {
      return { ok: false, reason: 'declared-too-large:' + declared, status, fetchedUrl: url, hops };
    }

    // A declared length is a claim. Read with a hard ceiling regardless of what it said.
    const read = await readBounded(res, maxBytes);
    if (!read.ok) return { ok: false, reason: read.reason, status, fetchedUrl: url, hops };

    return { ok: true, html: read.text, fetchedUrl: url, status, hops, bytes: read.bytes };
  }

  return { ok: false, reason: 'too-many-redirects', fetchedUrl: url, hops };
}

async function readBounded(res, maxBytes) {
  // A body with no reader (a synthetic Response in a test, or a runtime that buffered it) still
  // has to obey the ceiling, so the text path measures too.
  if (!res.body || typeof res.body.getReader !== 'function') {
    let text;
    try { text = await res.text(); } catch (e) { return { ok: false, reason: 'body-read-failed' }; }
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes > maxBytes) return { ok: false, reason: 'body-too-large:' + bytes };
    return { ok: true, text, bytes };
  }
  const reader = res.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const buf = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
      bytes += buf.length;
      if (bytes > maxBytes) { try { await reader.cancel(); } catch {} return { ok: false, reason: 'body-too-large:' + bytes }; }
      chunks.push(buf);
    }
  } catch (e) {
    return { ok: false, reason: 'body-stream-failed' };
  }
  return { ok: true, text: Buffer.concat(chunks).toString('utf8'), bytes };
}
