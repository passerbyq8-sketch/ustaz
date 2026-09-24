// tools/harvest/policy.mjs -- PROGRAM ORDER 2026-09-24, م٦: the owner's harvest rules, in one place, for the
// link checker and the fetch tool. Every number and word here is quoted from the harvest files
// (program-2026-09-24/06-harvest/measure/B-harvest.md §6-§8) or from the repository; none is invented.
//
// NOTHING HERE FETCHES. `fetchPolite` is the one request path of both tools, and it only ever calls the
// fetch it is HANDED; the tools pass one only under --live, which this program never passes.
import dnsPromises from 'node:dns/promises';
import net from 'node:net';
import path from 'node:path';
import { EZIK_USER_AGENT } from '../../lib/user-agent.js';
import { hostMatches } from '../../lib/source-registry.js';
import { robotsDecision, parseRobots } from './robots.mjs';

// ONE NAME FOR EVERY FETCHER (lib/user-agent.js, directive 6أ): no browser identity, no second name, and
// a site that refuses it is taken at its word. The older «normal browser identity» of the khudair
// directive V1.1 :84 is superseded here.
export const HARVEST_UA = EZIK_USER_AGENT;
export const PRODUCT_TOKEN = EZIK_USER_AGENT.split('/')[0];

// PACING (V12 :793; handoff J :104; Badr directive :173-175): 2.5 s between requests per worker; after
// 5 consecutive blocks, rest 45 s, then 5 s spacing. One worker's block does not stop another.
export const MIN_GAP_MS = 2500;
export const BLOCK_STREAK = 5;
export const BLOCK_REST_MS = 45000;
export const AFTER_REST_GAP_MS = 5000;
export const MAX_REDIRECT_HOPS = 4;
export const CALL_TIMEOUT_MS = 20000;

// SITES NOT TO TOUCH. Written prohibition (V12 :16): Dorar, Alukah, IslamQA. Forbids collection itself
// (STATE :124): islamweb. Owner pause (V12 :23): Shamela. Refused before any request, robots included.
export const FORBIDDEN_HOSTS = Object.freeze({
  'dorar.net': 'written_prohibition',
  'alukah.net': 'written_prohibition',
  'islamqa.info': 'written_prohibition',
  'islamweb.net': 'forbids_collection',
  'shamela.ws': 'owner_pause',
});
// The verdict vocabulary (STATE :134): only `harvested` opens a door; `null` is not a verdict, so a host
// with none is refused until the owner rules on it (measure B, V.3-D).
export const OPEN_VERDICTS = Object.freeze(['harvested']);

// EVERYTHING FETCHED IS HELD (V2 :15, V12 :15; the Badr directive :159-162).
export const RIGHTS_HELD = Object.freeze({
  destination: 'held_inventory_pending_permission',
  publish_allowed: false,
  product_use_allowed: false,
  permission_status: 'pending',
});

// C:\EZIK-LIB holds the reserved inventory and the live service's packages: the tools neither read nor
// write there.
export const FORBIDDEN_ROOT = 'C:/EZIK-LIB';
export function refusePath(p) {
  const abs = path.resolve(String(p || '')).replace(/\\/g, '/').toLowerCase();
  return abs === FORBIDDEN_ROOT.toLowerCase() || abs.startsWith(FORBIDDEN_ROOT.toLowerCase() + '/');
}

/** Why a URL may not be requested at all, or '' when it may (scheme, userinfo, forbidden host, verdict). */
export function urlRefusal(url, verdicts = {}) {
  let u;
  try { u = new URL(String(url)); } catch { return 'bad_url'; }
  if (u.protocol !== 'https:') return 'not_https';
  if (u.username || u.password) return 'userinfo';
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  for (const [domain, why] of Object.entries(FORBIDDEN_HOSTS)) if (hostMatches(host, domain)) return 'forbidden_host:' + why;
  const verdict = Object.entries(verdicts || {}).find(([domain]) => hostMatches(host, domain));
  if (!verdict) return 'no_verdict';
  if (!OPEN_VERDICTS.includes(verdict[1])) return 'verdict:' + verdict[1];
  return '';
}

const PRIVATE_V4 = [/^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./];
export function isPublicAddress(address) {
  const a = String(address || '');
  if (net.isIPv4(a)) return !PRIVATE_V4.some((re) => re.test(a));
  if (net.isIPv6(a)) return !/^(::1?$|fc|fd|fe80|::ffff:(10|127|192\.168)\.)/i.test(a);
  return false;
}
export const defaultLookup = (host) => dnsPromises.lookup(host, { all: true }).then((list) => list.map((x) => x.address));

// A block is the site refusing us: 403, 429, 503, or a challenge page (lib/retrieve.js:600-618).
export function isBlock(status, body) {
  if ([403, 429, 503].includes(status)) return true;
  return /cf-chl|challenge-platform|Attention Required|Just a moment/i.test(String(body || '').slice(0, 4000));
}

/**
 * THE PACER: per host, never closer than the gap (2.5 s, or the robots Crawl-delay when larger); five
 * blocks in a row rest the host 45 s and then space it 5 s. The clock and the sleep are injected.
 */
export class Pacer {
  constructor({ now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
    this.now = now; this.sleep = sleep; this.hosts = new Map();
  }
  state(host) {
    if (!this.hosts.has(host)) this.hosts.set(host, { last: -Infinity, blocks: 0, rested: false, floorMs: 0 });
    return this.hosts.get(host);
  }
  setFloor(host, crawlDelaySeconds) {
    if (Number.isFinite(crawlDelaySeconds)) this.state(host).floorMs = Math.max(this.state(host).floorMs, crawlDelaySeconds * 1000);
  }
  async wait(host) {
    const s = this.state(host);
    if (s.blocks >= BLOCK_STREAK) { await this.sleep(BLOCK_REST_MS); s.blocks = 0; s.rested = true; s.last = this.now(); return; }
    const gap = Math.max(s.rested ? AFTER_REST_GAP_MS : MIN_GAP_MS, s.floorMs);
    const due = s.last + gap - this.now();
    if (due > 0) await this.sleep(due);
  }
  done(host, blocked) {
    const s = this.state(host);
    s.last = this.now();
    s.blocks = blocked ? s.blocks + 1 : 0;
  }
}

/**
 * ONE POLITE REQUEST: paced, our one name, redirects followed BY HAND (at most four hops, each re-checked:
 * https, no userinfo, the same site, a public address). → { ok, status, finalUrl, hops, body, bytes,
 * headers, reason }. Never throws.
 */
export async function fetchPolite(url, { fetchImpl, pacer, lookup = defaultLookup, sameSite }) {
  const origin = new URL(url);
  const siteOf = (u) => u.hostname.toLowerCase().replace(/^www\./, '');
  const site = sameSite || siteOf(origin);
  let current = origin;
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
    if (current.protocol !== 'https:' || current.username || current.password) return { ok: false, status: 0, finalUrl: current.href, hops: hop, reason: 'redirect_not_https' };
    if (!hostMatches(siteOf(current), site)) return { ok: false, status: 0, finalUrl: current.href, hops: hop, reason: 'off_host_redirect' };
    let addresses = [];
    try { addresses = await lookup(current.hostname); } catch { return { ok: false, status: 0, finalUrl: current.href, hops: hop, reason: 'dns_failed' }; }
    if (!addresses.length || !addresses.every(isPublicAddress)) return { ok: false, status: 0, finalUrl: current.href, hops: hop, reason: 'private_address' };
    await pacer.wait(site);
    let response;
    try {
      response = await fetchImpl(current.href, {
        method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
        headers: { 'user-agent': HARVEST_UA, accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5' },
      });
    } catch {
      pacer.done(site, false);
      return { ok: false, status: 0, finalUrl: current.href, hops: hop, reason: 'transport_error' };
    }
    const status = Number(response.status) || 0;
    if (status >= 300 && status < 400) {
      pacer.done(site, false);
      const location = response.headers && response.headers.get ? response.headers.get('location') : null;
      if (!location) return { ok: false, status, finalUrl: current.href, hops: hop, reason: 'redirect_without_location' };
      try { current = new URL(location, current); } catch { return { ok: false, status, finalUrl: current.href, hops: hop, reason: 'redirect_unparseable' }; }
      continue;
    }
    let bytes = Buffer.alloc(0);
    try { bytes = Buffer.from(await response.arrayBuffer()); } catch { bytes = Buffer.alloc(0); }
    const body = bytes.toString('utf8');
    pacer.done(site, isBlock(status, body));
    return { ok: status >= 200 && status < 300, status, finalUrl: current.href, hops: hop, body, bytes, headers: response.headers, reason: '' };
  }
  return { ok: false, status: 0, finalUrl: current.href, hops: MAX_REDIRECT_HOPS, reason: 'too_many_redirects' };
}

/** Read a host's robots.txt once (paced, polite) → { parsed, status, body }. A 404 allows all. */
export async function readRobots(host, deps) {
  const got = await fetchPolite(`https://${host}/robots.txt`, deps);
  if (got.ok) return { parsed: parseRobots(got.body), status: got.status, body: got.body, reason: '' };
  if (got.status === 404 || got.status === 410) return { parsed: parseRobots(''), status: got.status, body: '', reason: '' };
  return { parsed: null, status: got.status, body: '', reason: got.reason || 'robots_unreadable' };
}

export function robotsAllowsUrl(robots, url) {
  if (!robots || !robots.parsed) return { allowed: true, rule: '', crawlDelay: null, unread: true };
  const u = new URL(url);
  return robotsDecision(robots.parsed, PRODUCT_TOKEN, u.pathname + u.search);
}

// The page's own title, for the identity check and the soft-404 signals.
export function titleOf(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(String(html || ''));
  return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : '';
}
export function textOf(html) {
  return decodeEntities(String(html || '')
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
function decodeEntities(s) {
  return String(s).replace(/&(amp|lt|gt|quot|#39|#x27|nbsp);/g, (m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#x27': "'", nbsp: ' ' }[e]))
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n)));
}
