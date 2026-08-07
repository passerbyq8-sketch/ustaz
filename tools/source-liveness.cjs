// tools/source-liveness.cjs — IS EACH REGISTERED SOURCE ACTUALLY ALIVE? NETWORK REQUIRED.
//
// ── WHY IT EXISTS ────────────────────────────────────────────────────────────
// On 2026-08-05 four domains on production lists could not produce a citation between them.
// dorar.net answered HTTP 403 to every server-side request including its own published API;
// tafsir.app returned 150 KB of client-rendered shell with an empty body; ferkous.com had moved
// domain; mostafaaladwy.com's pages were being thrown away by a floor that overrode the one it
// declared. Every gate in the repo was green throughout, because every gate in the repo is
// offline — they check that the LISTS are consistent, and consistency with a dead domain is
// still consistency.
//
// A list entry that cannot answer is worse than a missing one: it reads as coverage, and it costs
// every question that reaches it a guaranteed-dead fetch.
//
// ── WHAT IT DOES ─────────────────────────────────────────────────────────────
// One real article per registered domain, fetched through lib/retrieve.js's OWN fetchAndClean()
// so that what is measured is what production does — same headers, same Readability path, same
// per-host page gates, same admission floor. Each domain lands in one of three states:
//
//   live-cites        the page came back and cleared every gate: a citation is producible
//   live-no-citation  the host is up and served bytes, but the page does not survive the gates
//   dead              non-2xx, a bot challenge, or a transport failure
//
// The result is written to data/source-liveness.json — COMMITTED TO GIT, with the URL that was
// tried and the date it was tried, so the evidence is reviewable and so the offline gate
// (guards/source-liveness-guard.cjs) can read it without a network of its own.
//
// ── WHAT IT IS NOT ───────────────────────────────────────────────────────────
// Not a crawl and not a search: ONE named URL per domain, one at a time, with a pause between.
// These are other people's servers. It sends no key and no credential, and it is deliberately NOT
// in gates.json — a suite that goes red when somebody else's server is slow teaches a team to
// ignore red. The GATE is offline; this is the thing that feeds it.
//
// Usage:  node tools/source-liveness.cjs [--write] [--only <domain>] [--json]
//         --write   update data/source-liveness.json (otherwise it only reports)
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const OUT = path.join(REPO, 'data', 'source-liveness.json');
const { detectSoftNotFound } = require('./soft-404.cjs');

const WRITE = process.argv.includes('--write');
const JSON_OUT = process.argv.includes('--json');
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i === -1 ? '' : (process.argv[i + 1] || ''); })();

const TIMEOUT_MS = 20000;
const GAP_MS = 800;                 // one at a time, with a pause. Other people's servers.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── ONE REAL ARTICLE PER DOMAIN ──────────────────────────────────────────────
// Chosen to be an ANSWER page, never an index — an index that extracts cleanly would report a
// domain as citable when nothing citable was ever reached. Where a URL was already proven by
// tools/source-live-smoke.cjs it is reused, so the two tools cannot disagree about what a working
// page on that host looks like.
const PROBE = {
  'islamweb.net': 'https://www.islamweb.net/ar/fatwa/2523/',
  'islamqa.info': 'https://islamqa.info/ar/answers/13337',
  'binbaz.org.sa': 'https://binbaz.org.sa/fatwas/21091',
  'alukah.net': 'https://www.alukah.net/sharia/0/1/',
  'sh-albarrak.com': 'https://sh-albarrak.com/article/10029',
  'almosleh.com': 'https://almosleh.com/ar/8285',
  'islamstory.com': 'https://islamstory.com/ar/artical/3408793/',
  // REPLACED 2026-08-07. The old URL (/muqolat/5051) answers HTTP 200 with the site's own «404»
  // document — the soft 404 that made this whole tool untrustworthy. This one is a real lesson
  // page, reached by walking the host's own home page, and its title proves it: «فضل يوم عاشوراء».
  //
  // IT DOES NOT MAKE THE DOMAIN CITABLE, and the replacement is not a fix for that. Measured the
  // same day across six live articles AND the dead URL: all seven extract BYTE-IDENTICAL text,
  // 1085 chars, sha256 5149d37a3b53 — the site-wide hadith band. The article body never survives
  // Readability on this host, so al-badr.net is honestly `live-no-citation`, and it was only ever
  // recorded `live-cites` because that band clears the 200-char generic floor. Fixing the URL
  // fixes the URL; the adapter is a separate piece of work.
  'al-badr.net': 'https://al-badr.net/detail/3Tshr80AJpHG',
  'othmanalkhamees.com': 'https://othmanalkhamees.com/lesson/100',
  'iifa-aifi.org': 'https://iifa-aifi.org/ar/115.html',
  'ferkous.app': 'https://ferkous.app/home/?q=fatwa-660',
  // One of the ~15 posts of the 70 that carry real body text rather than a PDF-embed viewer —
  // picked by walking the site's own post sitemap, so the probe measures the host working rather
  // than the PDF gate firing correctly.
  'dr-mutlaq.com': 'https://www.dr-mutlaq.com/%d9%85%d9%86-%d9%85%d9%82%d8%a7%d8%b5%d8%af-%d8%a7%d9%84%d8%b4%d8%b1%d9%8a%d8%b9%d8%a9-%d9%81%d9%8a-%d8%a3%d9%88%d9%84-%d8%b3%d9%88%d8%b1%d8%a9-%d8%a7%d9%84%d9%86%d9%88%d8%b1/',
  'eftaa.awqaf.gov.kw': 'https://eftaa.awqaf.gov.kw/ar/%D8%AC%D8%AF%D9%8A%D8%AF%20%D8%A7%D9%84%D9%81%D8%AA%D8%A7%D9%88%D9%89/%D8%A7%D9%84%D8%AA%D8%A8%D8%B1%D8%B9-%D8%A8%D8%A3%D8%B9%D8%B6%D8%A7%D8%A1-%D9%85%D8%B1%D8%B6%D9%89-%D8%A7%D9%84%D9%85%D9%88%D8%AA-%D8%A7%D9%84%D8%AF%D9%85%D8%A7%D8%BA%D9%8A-4822',
  'saleh.af.org.sa': 'https://saleh.af.org.sa/ar/node/132',
  'khaledalsabt.com': 'https://khaledalsabt.com/interpretations/2166/%D8%B3%D9%88%D8%B1%D8%A9-%D8%A7%D9%84%D9%86%D8%B5%D8%B1-%D9%83%D8%A7%D9%85%D9%84%D8%A9',
  'ibn-jebreen.com': 'https://www.ibn-jebreen.com/topics/%D8%A8%D9%8A%D8%B9-%D8%A7%D9%84%D8%AF%D8%AE%D8%A7%D9%86',
  'mostafaaladwy.com': 'https://mostafaaladwy.com/fatwa/49995/%D9%83%D9%8A%D9%81-%D9%8A%D8%AA%D8%B9%D9%84%D9%85-%D8%A7%D9%84%D9%85%D8%B3%D9%84%D9%85-%D8%A7%D9%84%D8%B9%D9%84%D9%85-%D8%A7%D9%84%D8%B0%D9%8A-%D9%8A%D9%86%D9%81%D8%B9%D9%87%D8%9F/',
  'almunajjid.com': 'https://almunajjid.com/speeches/lessons/790',
  'khutabaa.com': 'https://khutabaa.com/ar/article/%D8%AD%D8%B1-%D8%A7%D9%84%D8%B5%D9%8A%D9%81-%D8%A8%D9%8A%D9%86-%D8%AA%D8%B0%D9%83%D8%B1-%D8%A7%D9%84%D9%86%D8%A7%D8%B1-%D9%88%D9%81%D8%B6%D9%84-%D8%A7%D9%84%D8%B3%D9%82%D9%8A%D8%A7',
  'salafcenter.org': 'https://salafcenter.org/10872/',
  'tafsir.net': 'https://tafsir.net/articles/24811',
  'al-abbaad.com': 'https://al-abbaad.com/articles/607420',
  // The world list.
  'ar.wikipedia.org': 'https://ar.wikipedia.org/wiki/%D8%A7%D9%84%D9%82%D8%A7%D9%87%D8%B1%D8%A9',
  'aljazeera.net': 'https://www.aljazeera.net/news/2026/8/5/%D8%A7%D9%82%D8%AA%D8%AD%D8%A7%D9%85-%D9%85%D8%AE%D9%8A%D9%85-%D9%82%D9%84%D9%86%D8%AF%D9%8A%D8%A7-%D9%88%D9%85%D9%88%D9%82%D8%B9%D9%87-%D9%81%D9%8A-%D8%B3%D9%8A%D8%A7%D9%82',
  'bbc.com': 'https://www.bbc.com/arabic/articles/c62x34m1nkzo',
  'skynewsarabia.com': 'https://www.skynewsarabia.com/middle-east/1884498',
  // The deferred and the refused, probed too — so the day one of them comes back is NOTICED
  // rather than assumed, and so the file records the evidence for the decision rather than
  // asserting it.
  'dorar.net': 'https://dorar.net/feqhia/1',
  'tafsir.app': 'https://tafsir.app/tabari/94/5',
  'ferkous.com': 'https://ferkous.com/home/?q=fatwa-660',
  'shkhudheir.com': 'https://shkhudheir.com/',
  'alarabiya.net': 'https://www.alarabiya.net/',
};

// ── A SECOND ARTICLE, FOR HOSTS WHERE ONE PAGE CANNOT TELL THE TRUTH ─────────
// MEASURED 2026-08-07 on al-badr.net: six live articles and the dead URL all extract the SAME
// 1085 characters, byte for byte (sha256 5149d37a3b53). It is the site-wide hadith band, and
// the article body never survives Readability on that host. One probe therefore reports
// `live-cites` — 1085 clears the 200-char generic floor — and the report is FALSE: nothing
// citable was reached, on that page or on any other.
//
// So for a listed domain a SECOND, different article is fetched and the two extractions are
// compared. Identical text from two different articles means the extractor is returning page
// furniture rather than content, whatever its length, and the domain is `live-no-citation`.
//
// OPT-IN, one entry at a time, for two reasons. It doubles the requests to that host, and these
// are other people's servers. And a recorded fingerprint would have been cheaper but can go
// stale in silence — the site redesigns its band, the signature stops matching, and the domain
// quietly reverts to a false `live-cites`. Comparing two live pages re-establishes the fact on
// every run and cannot rot.
const PROBE_ALT = {
  'al-badr.net': 'https://al-badr.net/detail/5JWRETfbj8',   // «شرح متن عظيم جامع في الاعتقاد»
};

(async function main() {
  const RT = await esm('lib/retrieve.js');
  const R = await esm('lib/source-registry.js');
  const PG = await esm('lib/source-page-gates.js');

  const registered = R.SOURCES.map((s) => s.domain).filter(Boolean);
  const rows = [];

  for (const domain of registered) {
    if (ONLY && domain !== ONLY) continue;
    const url = PROBE[domain];
    if (!url) {
      rows.push({
        domain, url: '', status: 'unprobed', note: 'no probe URL declared in tools/source-liveness.cjs',
        textLen: 0, registryStatus: (R.findSource(domain) || {}).status || '?',
      });
      continue;
    }
    await sleep(GAP_MS);
    RT.resetBreakers();               // each domain judged on its own, not on a neighbour's failure

    // D7 needs a NUMBER, not an impression: whether a host fits the 8000ms per-fetch budget the
    // live path actually gives it (lib/retrieve.js perFetchTimeoutMs / lib/ledger/budgets.js
    // FETCH_TIMEOUT_MS) is a question about milliseconds, and nobody had ever recorded any. This
    // is wall time for fetch + Readability together, which is what the budget is spent on.
    const t0 = Date.now();
    let res;
    try {
      res = await RT.fetchAndClean(url, TIMEOUT_MS);
    } catch (e) {
      // ONE RETRY, AND ONLY ON A TRANSPORT FAILURE. Measured 2026-08-07: ferkous.app was recorded
      // `dead` on a TypeError that arrived in SIX MILLISECONDS, and the same URL answered HTTP 200
      // on the very next request — the socket never got out. Writing a living source into the
      // evidence file as dead is exactly as untruthful as the reverse, and this file drives a
      // gate. A STATUS is an answer and is never retried; a connection that did not happen is not
      // an answer, and asking twice before condemning a source is the least this can do.
      //
      // Deliberately once, not thrice: a host that is genuinely down should still be recorded
      // down, promptly, and this is not a availability poller.
      await sleep(GAP_MS);
      try {
        res = await RT.fetchAndClean(url, TIMEOUT_MS);
        if (!JSON_OUT) console.log(`(retried after transport failure: ${domain})`);
      } catch (e2) {
        rows.push({
          domain, url, status: 'dead',
          note: 'transport (twice): ' + (e2 && e2.name) + ' ' + String(e2 && e2.message).slice(0, 80),
          textLen: 0, ms: Date.now() - t0, registryStatus: (R.findSource(domain) || {}).status || '?',
        });
        if (!JSON_OUT) console.log(`dead              ${domain.padEnd(22)}      0 chars              transport twice: ${e2 && e2.name}`);
        continue;
      }
    }

    const ms = Date.now() - t0;              // BEFORE the optional second probe, which is not the budget
    const text = String(res.text || '');
    const note = String(res.note || '');
    const declared = PG.declaredMinText(res.finalUrl || url);
    const floor = declared === null ? RT.GENERIC_MIN_TEXT : declared;

    // A 404 OR 410 IS NOT DEATH. The server answered, and it answered correctly: the path is
    // wrong. That is a fact about THIS FILE'S probe URL, not about the host, and conflating the two
    // would let a link that rotted months ago condemn a perfectly healthy source — in a file that
    // drives a gate. It gets its own state so that somebody fixes the URL instead of the domain.
    const m = note.match(/^fetch-failed HTTP (\d+)/);
    const httpStatus = m ? Number(m[1]) : 0;
    // D6أ: AND THE SOFT ONES. A 404 that arrives as an honest 404 is caught by the status; the
    // dangerous kind arrives as HTTP 200 carrying the site's own error document, and reading
    // the status alone recorded al-badr.net as `live-cites` — coverage that does not exist, in
    // a file that drives a gate. The detector is a separate module so this tool and the gate
    // that proves it cannot hold two different ideas of what a soft 404 looks like.
    const soft = httpStatus ? { soft: false } : detectSoftNotFound({
      requestedUrl: url, finalUrl: res.finalUrl || url, title: res.title, text, rawLen: res.rawLen,
    });
    // The second article, for the hosts that need one. Only reached when the first page looked
    // fine — there is nothing to learn from a second fetch after a refusal, and no reason to
    // spend one.
    let boilerplate = null;
    const altUrl = PROBE_ALT[domain];
    if (altUrl && !httpStatus && !soft.soft && text.length > 0) {
      await sleep(GAP_MS);
      RT.resetBreakers();
      try {
        const alt = await RT.fetchAndClean(altUrl, TIMEOUT_MS);
        const altText = String(alt.text || '');
        if (altText.length > 0 && altText === text) {
          boilerplate = { altUrl, chars: altText.length };
        }
      } catch (e) { /* a failed second probe proves nothing; the first verdict stands */ }
    }

    let status;
    if (httpStatus === 404 || httpStatus === 410) {
      status = 'probe-stale';
    } else if (soft.soft) {
      status = 'probe-stale';                // the URL is gone; the DOMAIN said nothing wrong
    } else if (boilerplate) {
      status = 'live-no-citation';           // two different articles, one identical extraction
    } else if (/^fetch-failed/.test(note) || /^BLOCKED \(cloudflare/.test(note)) {
      status = 'dead';                       // the host refused us, or challenged us
    } else if (/^BLOCKED/.test(note) || text.length < floor) {
      status = 'live-no-citation';           // it served bytes; the page cannot be cited
    } else {
      status = 'live-cites';                 // a citation is producible from this page today
    }

    rows.push({
      domain, url, finalUrl: res.finalUrl || url, status,
      note: soft.soft
        ? `SOFT 404 (${soft.signal}): ${soft.detail} — the host answered 2xx and served something that is not the requested document. Fix the URL in tools/source-liveness.cjs, not the domain.`
        : boilerplate
          ? `PAGE-INVARIANT BOILERPLATE: this article and ${boilerplate.altUrl} extract byte-identical text (${boilerplate.chars} chars), so the extractor is returning site furniture and no article body survives on this host. The domain is UP; nothing citable is reachable through the current adapter.`
          : note,
      textLen: text.length, ms, floor, rawLen: res.rawLen || 0,
      title: String(res.title || '').slice(0, 90),
      registryStatus: (R.findSource(domain) || {}).status || '?',
    });
    if (!JSON_OUT) {
      console.log(`${status.padEnd(17)} ${domain.padEnd(22)} ${String(text.length).padStart(6)} chars (floor ${floor})  ${note}`);
    }
  }

  const doc = {
    note: 'Measured liveness of every registered source. Written by tools/source-liveness.cjs '
      + '(network required). Read OFFLINE by guards/source-liveness-guard.cjs, which fails when a '
      + 'domain measured DEAD is still on a production list, or when this measurement is stale.',
    tool: 'tools/source-liveness.cjs',
    measuredAt: new Date().toISOString().slice(0, 10),
    states: {
      'live-cites': 'the page came back and cleared every gate — a citation is producible',
      'live-no-citation': 'the host served bytes, but the page does not survive the gates',
      dead: 'the host refused us (403/429/5xx), challenged us, or could not be reached at all',
      'probe-stale': 'the host answered 404/410 — the probe URL in this tool is wrong, not the domain',
      unprobed: 'no probe URL is declared for this domain',
    },
    domains: rows.sort((a, b) => a.domain.localeCompare(b.domain)),
  };

  if (JSON_OUT) console.log(JSON.stringify(doc, null, 2));

  if (WRITE) {
    if (ONLY) {
      console.error('\nREFUSING to --write a partial run (--only was given). '
        + 'The file is the whole picture or it is misleading.');
      process.exit(2);
    }
    fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n', 'utf8');
    console.log('\nwrote ' + path.relative(REPO, OUT) + ' (' + rows.length + ' domains, measured ' + doc.measuredAt + ')');
  } else if (!JSON_OUT) {
    console.log('\n(dry run — pass --write to update data/source-liveness.json)');
  }
})().catch((e) => { console.error(e); process.exit(1); });
