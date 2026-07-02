// spike/rag-probe.mjs
// THROWAWAY retrieval spike. Do NOT wire into the app. Standalone Node CLI.
// Proves (1) Google CSE returns the right Islamic page, (2) we can extract a
// clean citable passage. Run: `node spike/rag-probe.mjs`
//
// Requires env: GOOGLE_API_KEY, GOOGLE_CSE_ID
// Deps (spike-only): jsdom, @mozilla/readability

// --- spike-only .env loader (no dependency; Node 18+) ---
import { readFileSync } from "node:fs";
try {
  const raw = readFileSync(new URL(".env", import.meta.url), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* no spike/.env — fall back to real env vars */ }
// --- end loader ---

import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

// Approved-domain allow-list, applied at query time via site: filter.
const SITES = [
  'islamqa.info','islamweb.net','binbaz.org.sa','sunnah.com',
  'quran.com','tafsir.app','al-badr.net','alukah.net','saaid.org'
];
const SITE_FILTER = SITES.map(s => 'site:' + s).join(' OR ');

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function collapse(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

// (1) Brave web search restricted to approved domains via a site: filter.
async function searchWeb(query, num = 3) {
  if (!process.env.BRAVE_API_KEY) {
    throw new Error("BRAVE_API_KEY missing in spike/.env");
  }
  const q = `${query} (${SITE_FILTER})`;
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=${num}`;
  const r = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': process.env.BRAVE_API_KEY
    }
  });
  if (!r.ok) {
    console.log(`  [search error] Brave HTTP ${r.status}: ${await r.text()}`);
    return [];
  }
  const data = await r.json();
  const items = (data.web && data.web.results) || [];
  return items.map(x => ({ title: x.title, link: x.url, snippet: x.description || '' }));
}

// (2) Fetch page + strip boilerplate via Readability. The whole point.
async function fetchAndClean(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let html = "";
  let res;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "ar,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
      },
      signal: ctrl.signal,
      redirect: "follow",
    });
    // Read text even on non-2xx so we can see what actually came back.
    html = await res.text().catch(() => "");
  } finally {
    clearTimeout(timer);
  }

  const rawLen = html.length;
  const finalUrl = res.url;

  // Non-2xx: report the status; don't bother parsing.
  if (!res.ok) {
    return { title: "", text: "", rawLen, note: `fetch-failed HTTP ${res.status}`, finalUrl };
  }

  // Cloudflare / JS-challenge detector — skip Readability on a challenge page.
  const blocked =
    /Just a moment|Attention Required|cf-browser-verification|_cf_chl_opt|Enable JavaScript and cookies/i.test(
      html
    );
  if (blocked) {
    const doc = new JSDOM(html, { url }).window.document;
    return {
      title: collapse(doc.title),
      text: "",
      rawLen,
      note: "BLOCKED (cloudflare/js-challenge)",
      finalUrl,
    };
  }

  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  let title = collapse(doc.title);
  let text = "";
  let note = "clean";

  try {
    const article = new Readability(doc.cloneNode(true)).parse();
    if (article && collapse(article.textContent).length > 200) {
      title = collapse(article.title) || title;
      text = collapse(article.textContent);
    } else {
      note = "raw-fallback (needs per-site selector)";
      text = collapse(doc.body ? doc.body.textContent : "");
    }
  } catch (e) {
    note = "raw-fallback (needs per-site selector)";
    text = collapse(doc.body ? doc.body.textContent : "");
  }

  return { title, text, rawLen, note, finalUrl };
}

function hostname(u) {
  try {
    return new URL(u).hostname;
  } catch {
    return "?";
  }
}

// Per-domain tally across the whole run (the point of this widened probe).
const DOMAIN_STATS = new Map(); // host -> { clean, blocked, "raw-fallback", "fetch-failed" }

function categorize(note) {
  if (note.startsWith("clean")) return "clean";
  if (note.startsWith("BLOCKED")) return "blocked";
  if (note.startsWith("raw-fallback")) return "raw-fallback";
  return "fetch-failed"; // "fetch-failed HTTP <n>" and thrown fetch/clean errors
}

function record(host, category) {
  if (!DOMAIN_STATS.has(host)) DOMAIN_STATS.set(host, {});
  const bucket = DOMAIN_STATS.get(host);
  bucket[category] = (bucket[category] || 0) + 1;
}

async function probe(query) {
  console.log("\n" + "=".repeat(78));
  console.log("Q: " + query);
  console.log("=".repeat(78));

  let results = [];
  try {
    results = await searchWeb(query, 3);
  } catch (e) {
    console.log("  [search error] " + e.message);
    return;
  }

  if (results.length === 0) {
    console.log("  [no results]");
    return;
  }

  const top = results.slice(0, 3);
  for (let i = 0; i < top.length; i++) {
    const r = top[i];
    const n = i + 1;
    const host = hostname(r.link);
    console.log(`\n[${n}] ${collapse(r.title)}`);
    console.log(`    ${r.link}`);
    console.log(`    domain: ${host}`);
    try {
      const { title, text, rawLen, note, finalUrl } = await fetchAndClean(r.link);
      console.log(`    final url: ${finalUrl}`);
      console.log(`    cleaned title: ${title}`);
      console.log(
        `    cleaned length: ${text.length} chars   (raw HTML length: ${rawLen} chars)`
      );
      console.log(`    passage: ${text.slice(0, 600)}`);
      console.log(`    NOTE: ${note}`);
      record(host, categorize(note));
    } catch (e) {
      console.log(`    [fetch/clean error] ${e.message}`);
      record(host, "fetch-failed");
    }
  }
}

const TEST_SET = [
  "ما حكم الجهر بالبسملة في الصلاة الجهرية وأقوال العلماء وأدلتهم",
  "درجة حديث من حسن إسلام المرء تركه ما لا يعنيه",
  "معنى قوله تعالى إياك نعبد وإياك نستعين",
  "هل يجوز للحائض قراءة القرآن",
  "حكم صيام المريض في رمضان",
  "فضل بر الوالدين في الإسلام",
];

async function main() {
  for (const q of TEST_SET) {
    await probe(q); // sequential — don't flood
    await new Promise((r) => setTimeout(r, 1200)); // Brave free tier ~1 req/s
  }
  console.log("\n" + "=".repeat(78));
  console.log("DONE.");

  console.log("\n---- DOMAIN SUMMARY ----");
  for (const [host, bucket] of DOMAIN_STATS) {
    const parts = Object.entries(bucket)
      .map(([cat, count]) => `${cat} ${count}`)
      .join(", ");
    console.log(`${host}: ${parts}`);
  }
}

main().catch((e) => {
  console.error("UNCAUGHT: " + (e && e.stack ? e.stack : e));
  process.exit(1);
});
