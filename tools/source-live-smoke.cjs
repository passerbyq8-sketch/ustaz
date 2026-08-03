// tools/source-live-smoke.cjs — LIVE smoke test for the source registry. NETWORK REQUIRED.
//
// DELIBERATELY NOT IN gates.json. The daily gate (source-registry-guard.cjs) is offline and
// deterministic, because a suite that fails when somebody else's server is slow teaches the
// team to ignore red. This file answers the question that one cannot: are the real pages
// still shaped the way the rules assume?
//
// It fetches a handful of named pages per source — never a crawl, never a search, no key, no
// credential — parses them exactly as lib/retrieve.js does, and reports what the page gate
// decides. A source whose site has been redesigned shows up here as a MISMATCH long before a
// reader meets an empty answer.
//
// Usage:  node tools/source-live-smoke.cjs [--json] [--only <domain>]
'use strict';
const path = require('path');
const REPO = path.join(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));

const JSON_OUT = process.argv.includes('--json');
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i === -1 ? '' : (process.argv[i + 1] || ''); })();

// The production header set, so what we measure is what the server sends the app.
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ar,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
};
const TIMEOUT_MS = 20000;
const GAP_MS = 700;                 // these are other people's servers; go one at a time
const collapse = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Each case: [domain, label, url, expectAdmitted]. Three to five per source, chosen to
// exercise the rule that source actually needs — never a sweep of the site.
const CASES = [
  ['saleh.af.org.sa', 'fatwa index (audio only)', 'https://saleh.af.org.sa/ar/ftawa', false],
  ['saleh.af.org.sa', 'khutbah index (audio only)', 'https://saleh.af.org.sa/ar/khotab', false],
  ['saleh.af.org.sa', 'biography (real text)', 'https://saleh.af.org.sa/ar/node/132', true],

  ['khaledalsabt.com', 'tafsir page', 'https://khaledalsabt.com/interpretations/2166/%D8%B3%D9%88%D8%B1%D8%A9-%D8%A7%D9%84%D9%86%D8%B5%D8%B1-%D9%83%D8%A7%D9%85%D9%84%D8%A9', true],
  ['khaledalsabt.com', 'tafsir taxonomy', 'https://khaledalsabt.com/interpretations/category/146/x', false],
  ['khaledalsabt.com', 'audio shelf', 'https://khaledalsabt.com/specials/532/x', false],

  ['ibn-jebreen.com', 'topic answer', 'https://www.ibn-jebreen.com/topics/%D8%A8%D9%8A%D8%B9-%D8%A7%D9%84%D8%AF%D8%AE%D8%A7%D9%86', true],
  ['ibn-jebreen.com', 'text-library catalogue', 'https://www.ibn-jebreen.com/textlibrary/6', false],
  ['ibn-jebreen.com', 'sound library', 'https://www.ibn-jebreen.com/soundlibrary', false],

  ['mostafaaladwy.com', 'fatwa WITH an answer', 'https://mostafaaladwy.com/fatwa/178087/%d9%87%d9%84-%d9%8a%d8%b9%d9%84%d9%85-%d8%a7%d9%84%d9%85%d9%8a%d8%aa-%d8%a8%d9%85%d8%a7-%d9%8a%d8%ad%d8%af%d8%ab-%d9%84%d8%a3%d9%87%d9%84%d9%87-%d9%85%d9%86-%d8%a8%d8%b9%d8%af%d9%87-%d8%9f/', true],
  ['mostafaaladwy.com', 'fatwa with an EMPTY answer', 'https://mostafaaladwy.com/fatwa/178116/%d8%b3%d8%b1%d9%82-%d9%88%d9%84%d9%85-%d9%8a%d8%b3%d8%aa%d8%b7%d8%b9-%d8%a5%d8%b1%d8%ac%d8%a7%d8%b9-%d8%a7%d9%84%d9%85%d8%a7%d9%84-%d9%88%d9%84%d8%a7-%d8%b7%d9%84%d8%a8-%d8%a7%d9%84%d8%b3%d9%85%d8%a7/', false],
  ['mostafaaladwy.com', 'fatwa category listing', 'https://mostafaaladwy.com/fatwa-category/%d8%a7%d9%84%d8%b7%d9%84%d8%a7%d9%82/', false],

  ['almunajjid.com', 'his own khutbah', 'https://almunajjid.com/speeches/lessons/790', true],
  ['almunajjid.com', 'articles index', 'https://almunajjid.com/articles', false],

  ['eftaa.awqaf.gov.kw', 'committee fatwa', 'https://eftaa.awqaf.gov.kw/ar/%D8%AC%D8%AF%D9%8A%D8%AF%20%D8%A7%D9%84%D9%81%D8%AA%D8%A7%D9%88%D9%89/%D8%A7%D9%84%D8%AA%D8%A8%D8%B1%D8%B9-%D8%A8%D8%A3%D8%B9%D8%B6%D8%A7%D8%A1-%D9%85%D8%B1%D8%B6%D9%89-%D8%A7%D9%84%D9%85%D9%88%D8%AA-%D8%A7%D9%84%D8%AF%D9%85%D8%A7%D8%BA%D9%8A-4822', true],
  ['eftaa.awqaf.gov.kw', 'department article', 'https://eftaa.awqaf.gov.kw/ar/%D9%85%D9%82%D8%A7%D9%84%D8%A7%D8%AA/%D9%88%D8%B5%D8%A7%D9%8A%D8%A7-%D8%A8%D9%8A%D9%86-%D9%8A%D8%AF%D9%8A-%D8%A7%D9%84%D8%AD%D8%AC%D9%91%D9%90-4521', true],

  ['khutabaa.com', 'khutbah with a named khatib', 'https://khutabaa.com/ar/article/%D8%AD%D8%B1-%D8%A7%D9%84%D8%B5%D9%8A%D9%81-%D8%A8%D9%8A%D9%86-%D8%AA%D8%B0%D9%83%D8%B1-%D8%A7%D9%84%D9%86%D8%A7%D8%B1-%D9%88%D9%81%D8%B6%D9%84-%D8%A7%D9%84%D8%B3%D9%82%D9%8A%D8%A7', true],
  ['khutabaa.com', 'discussion forum', 'https://khutabaa.com/ar/forums/134701', false],
  ['khutabaa.com', 'khutbah listing', 'https://khutabaa.com/ar/khutub', false],

  ['salafcenter.org', 'centre research', 'https://salafcenter.org/10872/', true],
  ['salafcenter.org', 'READER submission', 'https://salafcenter.org/10881/', false],
  ['salafcenter.org', 'category listing', 'https://salafcenter.org/category/%d9%85%d9%82%d8%a7%d9%84%d8%a7%d8%aa-%d8%a7%d9%84%d9%85%d8%b4%d8%b1%d9%81/', false],

  ['tafsir.net', 'tafsir article (named author)', 'https://tafsir.net/articles/24811', true],
  ['tafsir.net', 'second article', 'https://tafsir.net/articles/24805', true],
  ['tafsir.net', 'author profile page', 'https://tafsir.net/authors/24813', false],
  ['tafsir.net', 'collection listing', 'https://tafsir.net/collection/656', false],
  ['tafsir.net', 'PDF-stub research page', 'https://tafsir.net/researchs/24780', false],
  ['tafsir.net', 'home page', 'https://tafsir.net/', false],

  ['al-abbaad.com', 'single article', 'https://al-abbaad.com/articles/607420', true],
  ['al-abbaad.com', 'second article', 'https://al-abbaad.com/articles/607419', true],
  ['al-abbaad.com', 'lesson catalogue', 'https://al-abbaad.com/lecture/hadith', false],
  ['al-abbaad.com', 'book shelf', 'https://al-abbaad.com/books/book-titles', false],
  ['al-abbaad.com', 'home page', 'https://al-abbaad.com/', false],

  // The refused row, checked so that the day it comes back is noticed rather than assumed.
  ['shkhudheir.com', 'parked domain (must stay unusable)', 'https://shkhudheir.com/', false],
];

(async function main() {
  const { parseHTML } = await import('linkedom');
  const { Readability } = await import('@mozilla/readability');
  const G = await esm('lib/source-page-gates.js');
  const R = await esm('lib/source-registry.js');

  const rows = [];
  let mismatches = 0, errors = 0;

  for (const [domain, label, url, expectOk] of CASES) {
    if (ONLY && domain !== ONLY) continue;
    await sleep(GAP_MS);
    const row = { domain, label, url, expectOk };

    // The URL gate first — exactly the order lib/retrieve.js uses, so a case refused here
    // costs no request at all.
    const why = G.pathRefusal(url, '');
    if (why) {
      row.admitted = false; row.reason = 'pre-fetch: ' + why;
      row.ok = expectOk === false;
      rows.push(row); if (!row.ok) mismatches++;
      continue;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res, html;
    try {
      const t0 = Date.now();
      res = await fetch(url, { headers: HEADERS, signal: ctrl.signal, redirect: 'follow' });
      html = await res.text();
      row.ms = Date.now() - t0;
      row.status = res.status;
    } catch (e) {
      clearTimeout(timer);
      row.admitted = null; row.reason = 'NETWORK: ' + e.message; row.ok = null;
      rows.push(row); errors++;
      continue;
    }
    clearTimeout(timer);

    // The final host must still be on a list. A redirect that leaves the approved domain is
    // the failure mode rule 8 names, and it is checked here on the REAL redirect chain.
    const finalHost = (() => { try { return new URL(res.url).hostname; } catch { return ''; } })();
    row.finalHost = finalHost;
    const src = R.findSource(finalHost);
    if (!src || src.status !== 'active') {
      row.admitted = false;
      row.reason = 'off-registry final host: ' + finalHost + (src ? ' (status=' + src.status + ')' : '');
      row.ok = expectOk === false;
      rows.push(row); if (!row.ok) mismatches++;
      continue;
    }

    if (!res.ok) {
      row.admitted = false; row.reason = 'HTTP ' + res.status; row.ok = expectOk === false;
      rows.push(row); if (!row.ok) mismatches++;
      continue;
    }
    if (/Just a moment|Attention Required|cf-browser-verification|_cf_chl_opt/i.test(html)) {
      row.admitted = false; row.reason = 'bot challenge'; row.ok = expectOk === false;
      rows.push(row); if (!row.ok) mismatches++;
      continue;
    }

    const { document: doc } = parseHTML(html);
    let title = collapse(doc.title), text = '', usedReadability = false, byline = '';
    try {
      const art = new Readability(doc.cloneNode(true)).parse();
      if (art && collapse(art.textContent).length > 200) {
        title = collapse(art.title) || title;
        text = collapse(art.textContent);
        byline = collapse(art.byline || '');
        usedReadability = true;
      } else text = collapse(doc.body ? doc.body.textContent : '');
    } catch { text = collapse(doc.body ? doc.body.textContent : ''); }

    const g = G.gateSourcePage({ url, finalUrl: res.url, doc, title, text, usedReadability, byline });
    row.admitted = g.ok;
    row.reason = g.ok ? `len=${g.text.length} author="${g.author}" type="${g.attributionType}"` : g.note;
    row.title = g.ok ? String(g.title || '').slice(0, 80) : '';
    row.ok = g.ok === expectOk;
    if (!row.ok) mismatches++;
    rows.push(row);
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({ rows, mismatches, errors }, null, 2));
  } else {
    console.log('=== source-live-smoke (NETWORK) ===\n');
    let current = '';
    for (const r of rows) {
      if (r.domain !== current) { current = r.domain; console.log('-- ' + current); }
      const mark = r.ok === null ? 'SKIP' : r.ok ? 'ok  ' : 'MISMATCH';
      console.log('  ' + mark.padEnd(9) + (r.expectOk ? 'expect-admit ' : 'expect-refuse')
        + '  ' + r.label.padEnd(34) + ' -> ' + r.reason);
    }
    console.log('\n' + rows.length + ' cases, ' + mismatches + ' mismatch(es), ' + errors + ' network error(s).');
    console.log(mismatches === 0
      ? 'OK: every live page still behaves the way the offline gate assumes.'
      : 'REVIEW: a live site no longer matches its rule -- check source-page-gates.js.');
  }
  // A network error is not a failure of the code, so it does not fail the run; a MISMATCH is.
  process.exit(mismatches === 0 ? 0 : 1);
})().catch((e) => {
  console.error('source-live-smoke CRASHED:', (e && e.stack) || e);
  process.exit(1);
});
