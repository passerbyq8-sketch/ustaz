// lib/identity/wikipedia.js — THE ONE ADAPTER THAT TURNS AN ARTICLE INTO A DESCRIPTION.
//
// ── WHY THIS IS A SEPARATE FILE FROM index.js ────────────────────────────────
// lib/identity/index.js takes every external effect as a PARAMETER, so a guard can drive the
// whole cascade with fixtures and prove nothing reaches the network. That property is worth
// keeping, so the code that actually fetches and parses lives here instead — the cascade stays
// sealed, and this file is the only thing a caller has to hand it.
//
// ── IT GOES THROUGH safeFetch, NOT fetch ─────────────────────────────────────
// قرار ٤ put ar.wikipedia.org on the admissibility list *of the existing safe path*, not beside
// it. So this uses safeFetch and inherits the whole SSRF defence unchanged: the https-only rule,
// the IP-range refusal, the manual redirect handling that re-admits every hop, and the byte cap.
// A plain fetch here would be the decision's one sentence — «دفاعُ SSRF كما هو» — quietly undone.
//
// ── WHAT IT EXTRACTS, AND WHAT IT REFUSES TO GUESS ───────────────────────────
// The LEAD paragraph only. A Wikipedia article's first paragraph defines the subject; everything
// after it is biography, and biography is not what «who is this» asks. Infoboxes, navigation and
// the table of contents are dropped before anything is read, because a page whose description
// came from its own sidebar is a page nobody read.

import { parseHTML } from 'linkedom';
import { safeFetch } from '../ledger/safe-fetch.js';

// Elements that are on the page but are not the article. Removed before the lead is looked for.
const CHROME = [
  'table', 'style', 'script', 'sup', '.infobox', '.navbox', '.toc', '.mw-editsection',
  '.hatnote', '.metadata', '.reference', '.mbox-text', '#toc', '.thumb', '.gallery',
];

const collapse = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

/**
 * The lead paragraph of a parsed article, or ''.
 *
 * A DISAMBIGUATION PAGE HAS NO LEAD IN THIS SENSE — it has a stub line and a list — so the
 * caller is given the stub plus enough of the list for lib/identity/index.js to recognise the
 * shape. That recognition is deliberate: قرار ٣ counts «صفحة توضيح» as a collision to report,
 * not as a page that failed to load.
 */
export function extractLead(html) {
  if (!html) return '';
  let document;
  try { ({ document } = parseHTML(html)); } catch { return ''; }
  const root = document.querySelector('.mw-parser-output') || document.body;
  if (!root) return '';
  for (const sel of CHROME) {
    for (const el of root.querySelectorAll(sel)) { try { el.remove(); } catch { /* linkedom */ } }
  }
  // A disambiguation page announces itself in the body text, so the first paragraphs are taken
  // together rather than just the first — the marker often sits on the second line.
  const paras = Array.from(root.querySelectorAll('p'))
    .map((p) => collapse(p.textContent))
    // Wikipedia emits empty <p> elements as spacing; they are not the lead.
    .filter((t) => t.length > 0);
  if (!paras.length) return '';
  // THE FIRST SUBSTANTIAL PARAGRAPH. A one-line «قد يقصد به» stub is substantial for our purpose
  // (it is the disambiguation signal), so the floor is deliberately low.
  const lead = paras.find((t) => t.length >= 20) || paras[0];
  // Carry a little of what follows, so a disambiguation marker on the next line is still visible.
  const tail = paras.slice(0, 3).join(' ');
  return collapse(tail.length > lead.length ? tail : lead).slice(0, 1200);
}

/**
 * Build the `fetchPage` callback lib/identity/index.js expects.
 *
 * Returns null for every failure — a refusal is a value here too, because the cascade's next
 * stage is the correct response to a page that would not load, not an exception.
 */
export function makeWikipediaFetcher(opts = {}) {
  const fetcher = opts.safeFetch || safeFetch;
  return async function fetchPage(url) {
    let r = null;
    try { r = await fetcher(url, { timeoutMs: opts.timeoutMs || 6000 }); } catch { return null; }
    if (!r || !r.ok || !r.html) {
      console.warn('[identity] wikipedia miss', { reason: (r && r.reason) || 'no-html' });
      return null;
    }
    const text = extractLead(r.html);
    if (!text) return null;
    return { text, finalUrl: r.fetchedUrl || url };
  };
}
