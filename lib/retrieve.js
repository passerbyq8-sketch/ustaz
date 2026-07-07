// lib/retrieve.js
// Server-side live-fetch RAG. Ported from spike/rag-probe.mjs (proven).
// ESM to match api/chat.js's runtime style. Lives OUTSIDE api/ so Vercel does
// not route it as a serverless function; api/ask.js imports retrieve().
//
// Requires env: BRAVE_API_KEY
// Deps: linkedom, @mozilla/readability
//
// linkedom (not jsdom) because jsdom's html-encoding-sniffer transitively
// require()s an ESM-only dep (@exodus/bytes) that Vercel's runtime cannot load
// (FUNCTION_INVOCATION_FAILED). linkedom is pure-JS, serverless-native, and
// Readability parses its document just the same.

import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';

// Approved-domain allow-list — narrowed from the spike's broader set to the four
// vetted Islamic sources. Applied at query time via a Brave `site:` filter.
// Age-scoped source allow-lists (khilaf-policy §6).
// Under-18 is restricted to the two sources vetted clean AND appropriate for minors.
// 18+ gets the full vetted list. Anyone lying about age is out of scope by design
// (self-declared age governs, exactly like every other site/game — no age proof).
const SITES_MINOR = ['islamqa.info', 'binbaz.org.sa'];
const SITES_ADULT = [
  // original four (vetted in RAG spike)
  'islamweb.net', 'binbaz.org.sa', 'alukah.net', 'islamqa.info',
  // added 2026-07-05 (probed: SSR, Readability-clean)
  'sh-albarrak.com', 'shkhudheir.com', 'almosleh.com',
  'islamstory.com', 'al-badr.net', 'othmanalkhamees.com',
];
// Pick the list by band. Default (undefined/unknown band) = adult list, so any
// caller that does NOT pass a band keeps today's exact behavior (no regression).
function siteFilterFor(band) {
  const list = band === 'young' || band === 'teen' ? SITES_MINOR : SITES_ADULT;
  return list.map((s) => 'site:' + s).join(' OR ');
}

// Per retrieve() call, cap how many Brave candidates we actually fetch+clean.
// Brave still returns a few candidates (maxResults) so we have fallbacks, but we
// only fetch the top FETCH_PER_CALL and keep the FIRST that comes back clean —
// the rest are ignored. With 2 tool queries this targets ~1 clean source per
// angle (~2 total) instead of ~6, cutting page fetches and latency. Tune here.
const FETCH_PER_CALL = 2;

function collapse(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function hostname(u) {
  try {
    return new URL(u).hostname;
  } catch {
    return '?';
  }
}

// --- Sheikh Uthman al-Khamis (othmanalkhamees.com) sect-polemic gate ----------
// His site mixes general Islamic teaching with a dedicated sect-polemic/debate
// category. For a child-safe app (this source is 18+ only) we exclude that one
// category by reading the site's OWN badge on each lesson page, so the filter
// auto-tracks lessons they add. No hand-maintained ID list for the main case.
const KHAMEES_HOST = 'othmanalkhamees.com';
// Category text "firaq wa-madhahib wa-munazarat" (sects/schools/debates), kept as
// \u escapes ON PURPOSE: pure-ASCII source can never byte-reverse in an editor.
const KHAMEES_BLOCKED_CATEGORIES = [
  '\u0641\u0631\u0642 \u0648\u0645\u0630\u0627\u0647\u0628 \u0648\u0645\u0646\u0627\u0638\u0631\u0627\u062A',
];
// Supplemental: sect-sensitive lessons filed OUTSIDE that category, matched by
// /lesson/{id}. Starting set; extend if more surface in live testing.
const KHAMEES_BLOCKED_LESSON_IDS = new Set([345, 348]);

function stripMarks(s) {
  return (s || '').replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '');
}
// Read the category from the site's own badge. Primary anchor: the badge <span>
// sits immediately before the favorite button (#favoriteBtn, on every lesson
// page). Fallback: an olive-styled pill whose text has no digit (i.e. the
// category label, not the "N lectures" counter).
function khameesCategory(doc) {
  const fav = doc.querySelector('#favoriteBtn');
  const prev = fav && fav.previousElementSibling;
  if (prev && prev.tagName === 'SPAN') {
    const t = collapse(stripMarks(prev.textContent));
    if (t) return t;
  }
  for (const el of doc.querySelectorAll('span[class*="text-olive-700"]')) {
    const t = collapse(stripMarks(el.textContent));
    if (t && t.length <= 40 && !/[0-9\u0660-\u0669]/.test(t)) return t;
  }
  return '';
}
function isKhameesBlocked(url, finalUrl, doc) {
  if (hostname(finalUrl) !== KHAMEES_HOST && hostname(url) !== KHAMEES_HOST) return false;
  const m = (finalUrl || url || '').match(/\/lesson\/(\d+)/);
  const id = m ? Number(m[1]) : null;
  if (id !== null && KHAMEES_BLOCKED_LESSON_IDS.has(id)) return true;
  const cat = khameesCategory(doc);
  return KHAMEES_BLOCKED_CATEGORIES.some((c) => cat.includes(c));
}

// (1) Brave web search restricted to the approved domains via a site: filter.
async function searchWeb(query, num = 3, band) {
  if (!process.env.BRAVE_API_KEY) {
    throw new Error('BRAVE_API_KEY missing');
  }
  const q = `${query} (${siteFilterFor(band)})`;
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=${num}`;
  const r = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': process.env.BRAVE_API_KEY,
    },
  });
  if (!r.ok) {
    console.warn(`[retrieve] Brave HTTP ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
    return [];
  }
  const data = await r.json();
  const items = (data.web && data.web.results) || [];
  return items.map((x) => ({ title: x.title, link: x.url, snippet: x.description || '' }));
}

// (2) Fetch page + strip boilerplate via Readability. Own AbortController timeout.
async function fetchAndClean(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let html = '';
  let res;
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    // Read text even on non-2xx so we can see what actually came back.
    html = await res.text().catch(() => '');
  } finally {
    clearTimeout(timer);
  }

  const rawLen = html.length;
  const finalUrl = res.url;

  // Non-2xx: report the status; don't bother parsing.
  if (!res.ok) {
    return { title: '', text: '', rawLen, note: `fetch-failed HTTP ${res.status}`, finalUrl };
  }

  // Cloudflare / JS-challenge detector — skip Readability on a challenge page.
  const blocked =
    /Just a moment|Attention Required|cf-browser-verification|_cf_chl_opt|Enable JavaScript and cookies/i.test(
      html
    );
  if (blocked) {
    const { document: doc } = parseHTML(html);
    return {
      title: collapse(doc.title),
      text: '',
      rawLen,
      note: 'BLOCKED (cloudflare/js-challenge)',
      finalUrl,
    };
  }

  const { document: doc } = parseHTML(html);

  // al-Khamis polemic gate: drop the sect-polemic category via the site's badge.
  if (isKhameesBlocked(url, finalUrl, doc)) {
    return { title: collapse(doc.title), text: '', rawLen, note: 'BLOCKED (khamees-polemic)', finalUrl };
  }

  let title = collapse(doc.title);
  let text = '';
  let note = 'clean';

  try {
    const article = new Readability(doc.cloneNode(true)).parse();
    if (article && collapse(article.textContent).length > 200) {
      title = collapse(article.title) || title;
      text = collapse(article.textContent);
    } else {
      note = 'raw-fallback (needs per-site selector)';
      text = collapse(doc.body ? doc.body.textContent : '');
    }
  } catch (e) {
    note = 'raw-fallback (needs per-site selector)';
    text = collapse(doc.body ? doc.body.textContent : '');
  }

  return { title, text, rawLen, note, finalUrl };
}

const NO_SOURCE_TEXT =
  'لم يُعثر على مصدرٍ موثوقٍ في المواقع المعتمدة للإجابة عن هذا السؤال.';

// Public API. Brave-search the query, fetch+clean the top FETCH_PER_CALL hits in
// parallel (each with its own timeout), keep the FIRST clean one and stop, and
// format one tool_result string. Degrades to NO_SOURCE_TEXT (never fabricates)
// when nothing is usable.
export async function retrieve(
  query,
  { maxResults = 3, perFetchTimeoutMs = 8000, maxChars = 2500, band } = {}
) {
  let results = [];
  try {
    results = await searchWeb(query, maxResults, band);
  } catch (e) {
    console.warn(`[retrieve] search failed: ${e.message}`);
    return { text: NO_SOURCE_TEXT, sources: [] };
  }

  if (results.length === 0) {
    console.warn('[retrieve] no Brave results');
    return { text: NO_SOURCE_TEXT, sources: [] };
  }

  // Cap fetch fan-out: fetch only the top FETCH_PER_CALL candidates (Brave may
  // have returned more as fallbacks). Parallel fetch — sequential would blow the
  // time budget. Each fetch owns its timeout.
  const top = results.slice(0, FETCH_PER_CALL);
  const settled = await Promise.allSettled(
    top.map((r) => fetchAndClean(r.link, perFetchTimeoutMs))
  );

  const kept = [];
  for (let i = 0; i < top.length; i++) {
    const r = top[i];
    const host = hostname(r.link);
    const outcome = settled[i];
    if (outcome.status !== 'fulfilled') {
      console.warn(`[retrieve] failed ${host} — ${r.link} (${outcome.reason && outcome.reason.message})`);
      continue;
    }
    const { title, text, note, finalUrl } = outcome.value;
    if (/^BLOCKED/.test(note)) {
      console.warn(`[retrieve] blocked ${host} — ${finalUrl}`);
      continue;
    }
    if (/^fetch-failed/.test(note)) {
      console.warn(`[retrieve] failed ${host} — ${finalUrl} (${note})`);
      continue;
    }
    if (text.length < 200) {
      console.warn(`[retrieve] thin ${host} — ${finalUrl} (${text.length} chars)`);
      continue;
    }
    console.warn(`[retrieve] clean ${host} — ${finalUrl} (${text.length} chars, ${note})`);
    kept.push({ title: title || r.title || finalUrl, url: finalUrl, passage: text.slice(0, maxChars) });
    // Keep the FIRST clean source per angle and stop — target ~1 source/query.
    break;
  }

  if (kept.length === 0) {
    return { text: NO_SOURCE_TEXT, sources: [] };
  }

  const divider = '\n' + '─'.repeat(40) + '\n';
  const text = kept
    .map((k, i) => `「المصدر ${i + 1}: ${k.title} — ${k.url}」\n${k.passage}`)
    .join(divider);

  return { text, sources: kept.map((k) => ({ title: k.title, url: k.url })) };
}
