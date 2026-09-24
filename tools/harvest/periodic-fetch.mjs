// tools/harvest/periodic-fetch.mjs -- PROGRAM ORDER 2026-09-24, م٦: the fetch tool a periodic harvest would
// run -- built, tested offline, and NEVER SCHEDULED: there is no timer, no cron and no loop in it, and
// the one weekly schedule ever written (V2 :109) stands suspended by the owner's ruling 11 (V12 :25).
//
// DEFAULT IS A DRY RUN: it prints the requests it would make and makes none. A live run needs --live and a
// verdicts file naming the host `harvested`; the forbidden sites are refused before anything is asked.
//
// WHAT A RUN DOES (measure B §8, each rule quoted there):
//   1 one name, EzikBot (lib/user-agent.js), and no fallback identity;
//   2 robots.txt read and SAVED (ROUND.robots.txt) before the first content request; a disallowed path is
//     never fetched; Crawl-delay is a floor above the pacing;
//   3 2.5 s per host, five blocks → 45 s rest → 5 s spacing; a block is attributed only against a control
//     URL fetched at the same moment, and the tunnel's and the site's counters are kept apart;
//   4 fetch is separate from extraction: the RAW BYTES are saved first and never touched; this tool does
//     not extract (text_path is null and the gap says so); an empty file is not content; anything already
//     saved with more than 0 bytes is not fetched again;
//   5 every record is METHOD V1's (directives …METHOD…:40-56) with the rights block of a held inventory:
//     destination=held_inventory_pending_permission, publish_allowed=false, product_use_allowed=false;
//   6 closure arithmetic, never «harvested completely»: index = saved + dead + prohibited + parked + other,
//     difference 0, against the index given.
//
// Usage: node tools/harvest/periodic-fetch.mjs --plan <plan.json> --verdicts <verdicts.json> --out <dir> [--live]
//   plan.json: { "source_id": "...", "host": "...", "control_url": "https://...", "items": [{ "id", "url", "title"? }] }
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pacer, fetchPolite, readRobots, robotsAllowsUrl, urlRefusal, titleOf, RIGHTS_HELD, refusePath, defaultLookup, isBlock } from './policy.mjs';

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const SAFE_ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/;

/** A file store over a directory, for the CLI; the guard hands in a memory one of the same shape. */
export function dirStore(dir) {
  return {
    size: (rel) => { try { return fs.statSync(path.join(dir, rel)).size; } catch { return -1; } },
    write: (rel, bytes) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), bytes); },
  };
}

/** The requests a run would make, none made. */
export function planFetch(plan, { verdicts = {} } = {}) {
  const items = Array.isArray(plan && plan.items) ? plan.items : [];
  const out = [];
  let robotsPlanned = false;
  for (const it of items) {
    const refusal = urlRefusal(it.url, verdicts);
    if (refusal) { out.push({ id: it.id, url: it.url, action: 'refuse', reason: refusal }); continue; }
    if (!robotsPlanned) { robotsPlanned = true; out.push({ id: null, url: `https://${new URL(it.url).hostname}/robots.txt`, action: 'robots_then_save' }); }
    out.push({ id: it.id, url: it.url, action: 'fetch_raw' });
  }
  return out;
}

/**
 * One run. opts: { live, fetchImpl, now, sleep, lookup, verdicts, store }. Dry run → { dry:true, plan }.
 * Live → { dry:false, records, closure, counters, writes } where `writes` is the order of saved paths.
 */
export async function runFetch(plan, opts = {}) {
  const items = Array.isArray(plan && plan.items) ? plan.items : [];
  if (opts.live !== true || typeof opts.fetchImpl !== 'function' || !opts.store) return { dry: true, plan: planFetch(plan, opts) };
  const store = opts.store;
  const writes = [];
  const save = (rel, bytes) => { store.write(rel, bytes); writes.push(rel); };
  const pacer = new Pacer({ now: opts.now, sleep: opts.sleep });
  const deps = { fetchImpl: opts.fetchImpl, pacer, lookup: opts.lookup || defaultLookup };
  const counters = { requests: 0, blocked_site: 0, blocked_ours: 0 };
  const records = [];
  let robots = null;
  const now = () => new Date(typeof opts.now === 'function' ? opts.now() : Date.now()).toISOString();
  for (const it of items) {
    const id = String(it.id || '');
    const base = { id, url: it.url, print_url: null, title: it.title || null, section: it.section || null,
      text_path: null, raw_path: null, chars: null, text_sha256: null, raw_sha256: null, text_origin: null,
      text_inside_raw: null, lang: 'ar', gaps: [], rights: { ...RIGHTS_HELD }, fetched_at: null, status: '' };
    if (!SAFE_ID_RE.test(id)) { records.push({ ...base, status: 'error', gaps: ['bad_id'] }); continue; }
    const refusal = urlRefusal(it.url, opts.verdicts);
    if (refusal) { records.push({ ...base, status: 'prohibited', gaps: [refusal] }); continue; }
    if (!robots) {
      robots = await readRobots(new URL(it.url).hostname, deps);
      counters.requests += 1;
      save('round-evidence/ROUND.robots.txt', Buffer.from(robots.parsed ? robots.body : `# robots.txt not read: status ${robots.status} ${robots.reason}\n`, 'utf8'));
      if (robots.parsed) pacer.setFloor(new URL(it.url).hostname.replace(/^www\./, ''), robotsAllowsUrl(robots, it.url).crawlDelay);
    }
    const decision = robotsAllowsUrl(robots, it.url);
    if (!decision.allowed) { records.push({ ...base, status: 'prohibited', gaps: ['robots_disallowed: ' + decision.rule] }); continue; }
    const rawRel = `raw/${id.replace(/:/g, '_')}.html`;
    if (store.size(rawRel) > 0) { records.push({ ...base, raw_path: rawRel, status: 'saved', gaps: ['already_saved_not_refetched'] }); continue; }
    const got = await fetchPolite(it.url, deps);
    counters.requests += 1;
    const fetchedAt = now();
    if (!got.ok && got.reason) { records.push({ ...base, fetched_at: fetchedAt, status: 'error', gaps: [got.reason] }); continue; }
    if (isBlock(got.status, got.body)) {
      let controlOk = false;
      if (plan.control_url) {
        const c = await fetchPolite(plan.control_url, { ...deps, sameSite: new URL(plan.control_url).hostname.replace(/^www\./, '') });
        counters.requests += 1;
        controlOk = c.ok;
      }
      counters[controlOk ? 'blocked_site' : 'blocked_ours'] += 1;
      records.push({ ...base, fetched_at: fetchedAt, status: 'blocked', gaps: ['origin_fault_attribution=' + (controlOk ? 'site' : (plan.control_url ? 'ours' : 'undetermined'))] });
      continue;
    }
    if (got.status === 404 || got.status === 410) { records.push({ ...base, fetched_at: fetchedAt, status: 'dead', gaps: ['http_' + got.status] }); continue; }
    if (!got.ok) { records.push({ ...base, fetched_at: fetchedAt, status: 'error', gaps: ['http_' + got.status] }); continue; }
    if (!got.bytes || !got.bytes.length) { records.push({ ...base, fetched_at: fetchedAt, status: 'dead', gaps: ['empty_body'] }); continue; }
    if (new URL(got.finalUrl).pathname.replace(/\/+$/, '') === '' && new URL(it.url).pathname.replace(/\/+$/, '') !== '') {
      records.push({ ...base, fetched_at: fetchedAt, status: 'url_dead_returns_home', gaps: ['redirect_to_root'] });
      continue;
    }
    save(rawRel, got.bytes);
    records.push({ ...base, raw_path: rawRel, raw_sha256: sha256(got.bytes), title: it.title || titleOf(got.body) || null,
      fetched_at: fetchedAt, status: 'saved', gaps: ['extraction_not_run'] });
  }
  const tally = (s) => records.filter((r) => r.status === s).length;
  const closure = {
    index: items.length, saved: tally('saved'), dead: tally('dead') + tally('url_dead_returns_home'),
    prohibited: tally('prohibited'), parked: tally('non_arabic_parked'), other: tally('blocked') + tally('error'),
  };
  closure.difference = closure.index - (closure.saved + closure.dead + closure.prohibited + closure.parked + closure.other);
  return { dry: false, records, closure, counters, writes };
}

async function cli(argv) {
  const arg = (name) => { const i = argv.indexOf(name); return i > -1 ? argv[i + 1] : null; };
  const planPath = arg('--plan');
  const outDir = arg('--out');
  if (!planPath || !outDir) { console.error('usage: --plan <plan.json> --verdicts <verdicts.json> --out <dir> [--live]'); return 2; }
  if ([planPath, outDir, arg('--verdicts')].filter(Boolean).some(refusePath)) { console.error('refused: C:/EZIK-LIB'); return 2; }
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const verdicts = arg('--verdicts') ? JSON.parse(fs.readFileSync(arg('--verdicts'), 'utf8')) : {};
  const live = argv.includes('--live');
  const out = await runFetch(plan, { live, fetchImpl: live ? globalThis.fetch : undefined, verdicts, store: live ? dirStore(outDir) : null });
  if (out.dry) { console.log(out.plan.map((p) => JSON.stringify(p)).join('\n')); return 0; }
  fs.writeFileSync(path.join(outDir, 'manifest.jsonl'), out.records.map((r) => JSON.stringify(r)).join('\n') + '\n');
  fs.writeFileSync(path.join(outDir, 'closure.json'), JSON.stringify({ closure: out.closure, counters: out.counters, writes: out.writes }, null, 2) + '\n');
  console.log(JSON.stringify(out.closure));
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) cli(process.argv.slice(2)).then((code) => { process.exitCode = code; });
