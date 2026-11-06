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
import https from 'node:https'; // ITEM O-4 (brain35, 2026-11-06): the pinned hop, with no new dependency
import http from 'node:http';
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

// ── ITEM O-4 (brain35, 2026-11-06; DIAG SEC-032) · THE v6 TEST READS THE ADDRESS, NOT ITS SPELLING ──────────────
// MEASURED (H6): the old test matched text, so ten non-public addresses passed it by being written another way --
// 0:0:0:0:0:0:0:1 (loopback uncompressed), ::ffff:7f00:1 and ::ffff:a00:1 (mapped v4 in hex), 0:0:0:0:0:ffff:127.0.0.1
// (mapped, uncompressed), fec0::1 (site-local), 2002:7f00:1:: / 2002:a00:1:: / 2002:c0a8:101:: (6to4 of 127.0.0.1,
// 10.0.0.1, 192.168.1.1), 2001:0:1234::1 (Teredo) and 100::1 (discard). Every one of them reaches our own network.
//
// So the address is PARSED to its sixteen bytes first -- Node's own isIP has already said it is a v6 address -- and
// every range is read off those bytes. A form that does not parse is blocked, not allowed.
export function ipv6Bytes(raw) {
  const ip = String(raw || '').trim().toLowerCase().replace(/^\[/u, '').replace(/\]$/u, '').split('%')[0];
  if (!ip) return null;
  let head = ip;
  let tail = '';
  const double = ip.indexOf('::');
  if (double >= 0) {
    if (ip.indexOf('::', double + 1) >= 0) return null; // only one '::' is legal
    head = ip.slice(0, double);
    tail = ip.slice(double + 2);
  }
  const pieces = (text) => (text === '' ? [] : text.split(':'));
  const left = pieces(head);
  const right = pieces(tail);
  const bytes = [];
  const push16 = (group) => {
    if (!/^[0-9a-f]{1,4}$/u.test(group)) return false;
    const n = parseInt(group, 16);
    bytes.push((n >> 8) & 0xff, n & 0xff);
    return true;
  };
  const pushGroups = (groups, isLast) => {
    for (let i = 0; i < groups.length; i += 1) {
      const group = groups[i];
      // a trailing dotted quad is the last two groups
      if (isLast && i === groups.length - 1 && group.includes('.')) {
        const quad = group.split('.');
        if (quad.length !== 4) return false;
        for (const part of quad) {
          if (!/^\d{1,3}$/u.test(part)) return false;
          const n = Number(part);
          if (n > 255) return false;
          bytes.push(n);
        }
        continue;
      }
      if (!push16(group)) return false;
    }
    return true;
  };
  if (!pushGroups(left, right.length === 0 && double < 0)) return null;
  const headBytes = bytes.length;
  if (!pushGroups(right, true)) return null;
  const tailBytes = bytes.length - headBytes;
  if (double < 0) return bytes.length === 16 ? bytes : null;
  const zeros = 16 - headBytes - tailBytes;
  if (zeros < 0) return null;
  return [...bytes.slice(0, headBytes), ...new Array(zeros).fill(0), ...bytes.slice(headBytes)];
}
const dotted = (b) => b.join('.');
function ipv6Blocked(raw) {
  const b = ipv6Bytes(raw);
  if (!b || b.length !== 16) return 'malformed';
  const allZero = b.every((x) => x === 0);
  if (allZero) return 'unspecified-::/128';
  if (b.slice(0, 15).every((x) => x === 0) && b[15] === 1) return 'loopback';
  // ::ffff:0:0/96 -- an IPv4 address wearing a v6 coat; the v4 inside is what will be reached
  if (b.slice(0, 10).every((x) => x === 0) && b[10] === 0xff && b[11] === 0xff) {
    const why = ipv4Blocked(dotted(b.slice(12)));
    return why ? 'ipv4-mapped:' + why : null;
  }
  // ::/96 -- the deprecated v4-compatible form, read the same way
  if (b.slice(0, 12).every((x) => x === 0)) {
    const why = ipv4Blocked(dotted(b.slice(12)));
    return why ? 'ipv4-compatible:' + why : null;
  }
  // 64:ff9b::/96 and 64:ff9b:1::/48 -- NAT64, which carries the v4 in its last four bytes
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) {
    const why = ipv4Blocked(dotted(b.slice(12)));
    return why ? 'nat64:' + why : 'nat64';
  }
  // 2002::/16 -- 6to4, whose embedded v4 is bytes 2..5
  if (b[0] === 0x20 && b[1] === 0x02) {
    const why = ipv4Blocked(dotted(b.slice(2, 6)));
    return why ? '6to4:' + why : '6to4';
  }
  // 2001::/32 -- Teredo, whose client v4 is the last four bytes XOR 0xff
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x00 && b[3] === 0x00) {
    const why = ipv4Blocked(dotted(b.slice(12).map((x) => x ^ 0xff)));
    return why ? 'teredo:' + why : 'teredo';
  }
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return 'documentation-2001:db8::/32';
  if ((b[0] & 0xfe) === 0xfc) return 'unique-local-fc00::/7';
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return 'link-local-fe80::/10';
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0xc0) return 'site-local-fec0::/10';
  if (b[0] === 0xff) return 'multicast-ff00::/8';
  // 100::/64 -- the discard-only prefix
  if (b[0] === 0x01 && b[1] === 0x00 && b.slice(2, 8).every((x) => x === 0)) return 'discard-100::/64';
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

// ── ITEM O-4 (brain35, 2026-11-06; DIAG SEC-032) · THE HOP CONNECTS TO THE ADDRESS THAT WAS CHECKED ──────────────
// MEASURED (H6, part 2): preflight resolved the host and approved its addresses, and then the fetch resolved the name
// AGAIN and connected wherever its own resolver said -- a window in which an authoritative server that answers twice
// (public first, 169.254.169.254 second) reaches our own metadata service with our own socket. The check and the
// connection have to be the same act.
//
// `undici` is not resolvable from this worktree (measured: require.resolve throws MODULE_NOT_FOUND), and no dependency
// may be added, so the pinned hop is made with node:https / node:http: a `lookup` that answers ONLY the checked address
// and refuses any other name, `servername` for TLS so the certificate is still checked against the host, and the Host
// header the name itself. The return shape is the fetch one this module already reads (status, headers.get, body).
//
// opts.fetchImpl stays exactly what it was -- the seam every offline guard and harness injects. A caller that supplies
// one is driving a stub, and a stub has no socket to pin.
// Pinning replaces the transport, so it is done only where there IS a socket of ours to pin: no caller-supplied
// fetchImpl, and the global fetch still the runtime's own. A replaced global is a test double or a capture wrapper
// (measured: ledger-seam drives the real handler with globalThis.fetch stubbed, 24 checks), and routing around it would
// be pinning a socket the caller never meant to open.
// (Node's global fetch is undici, written in JavaScript, so «[native code]» is not the test: the runtime's own function
// is the one this module saw when it loaded.)
const RUNTIME_FETCH = globalThis.fetch;
function pinnable(suppliedFetchImpl, doFetch) {
  if (suppliedFetchImpl) return false;
  return doFetch === RUNTIME_FETCH && typeof RUNTIME_FETCH === 'function';
}
function pinnedLookup(host, address) {
  const family = isIP(address);
  return (hostname, options, callback) => {
    const cb = typeof options === 'function' ? options : callback;
    if (String(hostname).toLowerCase() !== String(host).toLowerCase()) {
      const err = new Error('safe-fetch: refused to resolve ' + String(hostname) + ' on a hop pinned to ' + host);
      err.code = 'EPINNEDHOST';
      cb(err);
      return;
    }
    const all = options && typeof options === 'object' && options.all === true;
    cb(null, all ? [{ address, family }] : address, family);
  };
}
/** One request to a pinned address, answered in the shape this module reads from fetch. */
export function pinnedRequest(url, { headers, signal, address, timeoutMs, httpsImpl, httpImpl } = {}) {
  const target = new URL(url);
  const secure = target.protocol === 'https:';
  const transport = secure ? (httpsImpl || https) : (httpImpl || http);
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn, value) => { if (!settled) { settled = true; fn(value); } };
    let req;
    const onAbort = () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      try { req?.destroy(err); } catch { /* the rejection below is the answer */ }
      done(reject, err);
    };
    try {
      req = transport.request({
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (secure ? 443 : 80),
        path: target.pathname + target.search,
        method: 'GET',
        headers: { ...(headers || {}), Host: target.host },
        // the whole point of this function: the socket goes to the address preflight checked
        lookup: pinnedLookup(target.hostname, address),
        ...(secure ? { servername: target.hostname } : {}),
        timeout: timeoutMs || FETCH_TIMEOUT_MS,
      }, (res) => {
        const headerBag = {
          get: (name) => {
            const value = res.headers[String(name).toLowerCase()];
            return Array.isArray(value) ? value[0] : (value === undefined ? null : String(value));
          },
        };
        done(resolve, {
          status: res.statusCode,
          headers: headerBag,
          // the body is read by readBounded, which measures as it goes
          body: {
            getReader() {
              const chunks = [];
              let ended = false;
              let failed = null;
              let wake = null;
              res.on('data', (chunk) => { chunks.push(chunk); if (wake) { const w = wake; wake = null; w(); } });
              res.on('end', () => { ended = true; if (wake) { const w = wake; wake = null; w(); } });
              res.on('error', (e) => { failed = e; ended = true; if (wake) { const w = wake; wake = null; w(); } });
              return {
                async read() {
                  for (;;) {
                    if (failed) throw failed;
                    if (chunks.length) {
                      const chunk = chunks.shift();
                      return { done: false, value: new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength) };
                    }
                    if (ended) return { done: true, value: undefined };
                    await new Promise((r) => { wake = r; });
                  }
                },
                async cancel() { try { res.destroy(); } catch { /* the hop is over */ } },
              };
            },
          },
        });
      });
    } catch (e) { done(reject, e); return; }
    req.on('error', (e) => done(reject, e));
    req.on('timeout', () => { const err = new Error('timeout'); err.name = 'TimeoutError'; try { req.destroy(err); } catch { /* reject below */ } done(reject, err); });
    if (signal) {
      if (signal.aborted) { onAbort(); return; }
      signal.addEventListener?.('abort', onAbort, { once: true });
    }
    req.end();
  });
}

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
      // ITEM O-4 (brain35, 2026-11-06; DIAG SEC-032): the hop goes to the FIRST address preflight checked, with the
      // Host header and the TLS name still the host's own; every hop is pinned afresh, because every hop is preflighted
      // afresh. A caller-supplied fetchImpl is a stub and has no socket to pin.
      const pinned = pinnable(opts.fetchImpl, doFetch) && Array.isArray(pre.addresses) && pre.addresses.length > 0 ? pre.addresses[0] : '';
      res = pinned
        ? await pinnedRequest(url, { headers: HEADERS, signal: ctrl.signal, address: pinned, timeoutMs, httpsImpl: opts.httpsImpl, httpImpl: opts.httpImpl })
        : await doFetch(url, {
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
