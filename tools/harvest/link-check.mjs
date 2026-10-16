// tools/harvest/link-check.mjs -- PROGRAM ORDER 2026-09-24, م٦: is a fatwa's link still its fatwa?
//
// THE OWNER'S ITEM: «أداةُ فحصِ الروابط» -- built, tested offline, never run against a live site in this
// program. DEFAULT IS A DRY RUN: it prints the requests it WOULD make and makes none. A live run needs
// --live AND a verdicts file naming each host as `harvested` (STATE :134: null is not a verdict), and it
// still refuses the forbidden sites before any request.
//
// WHAT ONE LINK IS ASKED (measure B §7, each rule quoted there):
//   1 robots.txt first, once per host; a disallowed path is `robots_disallowed` and never requested;
//   2 status and transport, as the harvest's requests.jsonl records them;
//   3 redirects BY HAND, at most four hops, each re-checked (https, no userinfo, the same site, a public
//     address) -- an off-site hop is `off_host_redirect`;
//   4 the canonical rule of the fatwa service: https, the scholar's sourceDomain (lib/fatwa-service.js);
//   5 soft 404: redirect to the root, a not-found title, an empty body (tools/soft-404.cjs);
//   6 a 200 with zero bytes is dead, not live;
//   7 identity: the page's title must carry the stored title, or `identity_mismatch`;
//   8 the id is the key, not the URL;
//   9 a block (403/429/503/challenge) is judged against a control URL fetched at the same moment:
//     `blocked_site` when the control opens, `blocked_ours` when it does not;
//  10 one name (EzikBot), 2.5 s per host at least, 45 s rest after five blocks.
// The statuses are one closed list (LINK_STATUSES), a proposal of measure B §7 made final here.
//
// Usage: node tools/harvest/link-check.mjs --in <records.jsonl> --verdicts <verdicts.json> --control <url>
//        [--out <results.jsonl>] [--live]
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { FATWA_SCHOLARS } from '../../lib/fatwa-contract.js';
import { hostMatches } from '../../lib/source-registry.js';
import { normalizeForCompare } from '../../lib/full-fatwa.js';
import { Pacer, fetchPolite, readRobots, robotsAllowsUrl, urlRefusal, titleOf, textOf, refusePath, defaultLookup } from './policy.mjs';

const require = createRequire(import.meta.url);
const { detectSoftNotFound } = require('../soft-404.cjs');

export const LINK_STATUSES = Object.freeze(['live', 'redirected_ok', 'dead_404', 'http_error', 'soft_404_home', 'soft_404',
  'empty_body', 'identity_mismatch', 'blocked_site', 'blocked_ours', 'robots_disallowed', 'off_host_redirect',
  'off_domain', 'transport_error', 'refused']);

const hostOf = (url) => new URL(url).hostname.toLowerCase().replace(/^www\./, '');

/** The requests a run would make, in order, with none made. */
export function planLinks(items, { verdicts = {}, control = '' } = {}) {
  const plan = [];
  const hosts = new Set();
  for (const it of items) {
    const refusal = urlRefusal(it.url, verdicts);
    if (refusal) { plan.push({ id: it.id, url: it.url, action: 'refuse', reason: refusal }); continue; }
    const host = hostOf(it.url);
    if (!hosts.has(host)) { hosts.add(host); plan.push({ id: null, url: `https://${host}/robots.txt`, action: 'robots' }); }
    plan.push({ id: it.id, url: it.url, action: 'check' });
  }
  if (control) plan.push({ id: null, url: control, action: 'control_on_block' });
  return plan;
}

/**
 * Check links. items: [{ id, url, title?, scholarId? }]. opts: { live, fetchImpl, now, sleep, lookup,
 * verdicts, control }. A dry run (live !== true) returns { dry:true, plan } and calls nothing.
 */
export async function checkLinks(items, opts = {}) {
  const list = Array.isArray(items) ? items : [];
  if (opts.live !== true || typeof opts.fetchImpl !== 'function') return { dry: true, plan: planLinks(list, opts) };
  const pacer = new Pacer({ now: opts.now, sleep: opts.sleep });
  const deps = { fetchImpl: opts.fetchImpl, pacer, lookup: opts.lookup || defaultLookup };
  const robotsByHost = new Map();
  const results = [];
  const counters = { requests: 0, blocked_site: 0, blocked_ours: 0 };
  for (const it of list) {
    const base = { id: it.id, url: it.url };
    const refusal = urlRefusal(it.url, opts.verdicts);
    if (refusal) { results.push({ ...base, status: 'refused', detail: refusal }); continue; }
    const scholar = it.scholarId ? FATWA_SCHOLARS.find((s) => s.id === it.scholarId) : null;
    if (scholar && !hostMatches(hostOf(it.url), scholar.sourceDomain)) { results.push({ ...base, status: 'off_domain', detail: scholar.sourceDomain }); continue; }
    const host = hostOf(it.url);
    if (!robotsByHost.has(host)) {
      robotsByHost.set(host, await readRobots(host, deps));
      counters.requests += 1;
      const delay = robotsByHost.get(host).parsed ? robotsAllowsUrl(robotsByHost.get(host), it.url).crawlDelay : null;
      pacer.setFloor(host, delay);
    }
    const verdict = robotsAllowsUrl(robotsByHost.get(host), it.url);
    if (!verdict.allowed) { results.push({ ...base, status: 'robots_disallowed', detail: verdict.rule }); continue; }
    const got = await fetchPolite(it.url, deps);
    counters.requests += 1;
    const row = { ...base, http_status: got.status, final_url: got.finalUrl, hops: got.hops };
    if (!got.ok && got.reason) {
      const status = got.reason === 'off_host_redirect' || got.reason === 'redirect_not_https' || got.reason === 'private_address' ? 'off_host_redirect' : 'transport_error';
      results.push({ ...row, status, detail: got.reason });
      continue;
    }
    if ([403, 429, 503].includes(got.status) || (got.ok && /cf-chl|challenge-platform/i.test(got.body.slice(0, 4000)))) {
      let controlOk = false;
      if (opts.control) {
        const c = await fetchPolite(opts.control, { ...deps, sameSite: hostOf(opts.control) });
        counters.requests += 1;
        controlOk = c.ok;
      }
      const status = controlOk ? 'blocked_site' : 'blocked_ours';
      counters[status] += 1;
      results.push({ ...row, status, detail: 'origin_fault_attribution=' + (controlOk ? 'site' : (opts.control ? 'ours' : 'undetermined')) });
      continue;
    }
    if (got.status === 404 || got.status === 410) { results.push({ ...row, status: 'dead_404' }); continue; }
    if (!got.ok) { results.push({ ...row, status: 'http_error' }); continue; }
    if (!got.bytes || got.bytes.length === 0) { results.push({ ...row, status: 'empty_body', detail: 'zero_bytes' }); continue; }
    const title = titleOf(got.body);
    const soft = detectSoftNotFound({ requestedUrl: it.url, finalUrl: got.finalUrl, title, text: textOf(got.body), rawLen: got.bytes.length });
    if (soft.soft) {
      const status = soft.signal === 'redirect-to-root' ? 'soft_404_home' : (soft.signal === 'empty-body' ? 'empty_body' : 'soft_404');
      results.push({ ...row, status, detail: soft.signal });
      continue;
    }
    if (it.title && !normalizeForCompare(title).includes(normalizeForCompare(it.title))) {
      results.push({ ...row, status: 'identity_mismatch', detail: 'title' });
      continue;
    }
    results.push({ ...row, status: got.hops > 0 ? 'redirected_ok' : 'live' });
  }
  return { dry: false, results, counters };
}

async function cli(argv) {
  const arg = (name) => { const i = argv.indexOf(name); return i > -1 ? argv[i + 1] : null; };
  const input = arg('--in');
  if (!input) { console.error('usage: --in <records.jsonl> --verdicts <verdicts.json> --control <url> [--out <results.jsonl>] [--live]'); return 2; }
  if ([input, arg('--verdicts'), arg('--out')].filter(Boolean).some(refusePath)) { console.error('refused: C:/EZIK-LIB'); return 2; }
  const verdicts = arg('--verdicts') ? JSON.parse(fs.readFileSync(arg('--verdicts'), 'utf8')) : {};
  const items = fs.readFileSync(input, 'utf8').split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l))
    .map((r) => ({ id: r.key || r.id, url: r.link ? r.link.url : r.url, title: r.title || '', scholarId: r.mufti ? r.mufti.id : r.scholarId }));
  const live = argv.includes('--live');
  const out = await checkLinks(items, { live, fetchImpl: live ? globalThis.fetch : undefined, verdicts, control: arg('--control') || '' });
  const lines = (out.dry ? out.plan : out.results).map((r) => JSON.stringify(r));
  if (arg('--out')) fs.writeFileSync(arg('--out'), lines.join('\n') + '\n'); else console.log(lines.join('\n'));
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) cli(process.argv.slice(2)).then((code) => { process.exitCode = code; });
