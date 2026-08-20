/* quest-bank-integrity-guard.cjs -- STRUCTURAL GATE for quest-data/trivia-golden.json.
 *
 * WHY THIS GATE EXISTS
 *   Phase 4 swept the 1785 non-protected questions for structural rot: true/false
 *   statements stored as two-option mcq, stems that only parse while a list of
 *   options is on screen, stems whose text contains their own answer, duplicate
 *   questions, questions whose stem had been overwritten by an ingestion bug,
 *   sources that were category labels or "to be reviewed" markers, and keys that
 *   were twice as long as every distractor (which hands the answer to the player
 *   in mcq mode). This gate freezes that work and, above all, proves that the 394
 *   PROTECTED questions -- quran / juz-amma / juz-tabarak / prayer -- are still
 *   byte-for-byte what they were at commit 17bb52a.
 *
 * OFFLINE. No network. Reads only.
 *
 * DISCIPLINE: this file contains ZERO literal Arabic -- same law as quran-guard.cjs,
 * esc.cjs and quest-reveal-guard.cjs. Every Arabic character is a \uXXXX escape and
 * any Arabic echoed to the terminal is printed as codepoints. A guard that prints raw
 * Arabic to a Windows console LIES about what it found: bidi reorders the line, so the
 * eye reads a different string than the one that failed.
 *
 * WHAT IT PROVES
 *   B1 count        -- the bank still holds exactly `total` questions.
 *   B2 identity     -- the id list is unchanged, in order, with no additions or drops.
 *   B3 categories   -- every question sits in the category it sat in, and the per
 *                      category histogram is unchanged.
 *   B4 schema       -- per type: required fields present, answer in range and of the
 *                      right JS type, mcq has >= 3 choices, no empty or duplicate
 *                      choice, `why` and `src` non-empty.
 *   B5 no duplicate -- no two non-protected questions share a normalised stem, and no
 *                      two in the same category share an answer key with overlapping
 *                      stems (beyond a documented allow-list).
 *   B6 answer valid -- exactly one key, and the key is a non-empty option.
 *   B7 option-free  -- the stem carries an interrogative / imperative / completion
 *                      marker, contains no deictic pointer at an unseen list, and does
 *                      not contain its own answer as a whole phrase.
 *   B8 sources      -- `src` is present, is not a "to be reviewed" or hearsay marker,
 *                      is not a bare hostname, and points INSIDE the work it names:
 *                      a hadith number, an aya, the year of the events, a kitab/bab
 *                      or tarjama after a dash, or a quoted entry title. Naming
 *                      "al-Kamil fi al-Tarikh" (11 volumes) proves nothing on its own.
 *   B9 protected    -- sha256 of each of the 394 protected questions equals the hash
 *                      recorded from commit 17bb52a. This is the load-bearing check.
 *   B10 sealed 13   -- sha256 of the eight quest-data files, the three scripture /
 *                      adhkar / layout files, the manifest and the service worker.
 *                      Unconditional: no git, no branch, no skip.
 *   B11 sw policy   -- sw.js is EXECUTED in a vm with self/caches/fetch stubbed, and
 *                      a synthetic FetchEvent is dispatched at it. Every same-origin
 *                      data file must be served from the cache AND revalidated in the
 *                      background; the read after a change must return the new bytes;
 *                      a failed fetch must leave the stored copy intact and raise
 *                      nothing at the page. B10 proves sw.js has not MOVED; B11 proves
 *                      it still WORKS, which is the half item 80 was lost in.
 *
 * USAGE
 *   node quest-bank-integrity-guard.cjs --emit    > quest-data/bank-integrity-golden.json
 *   node quest-bank-integrity-guard.cjs --compare quest-data/bank-integrity-golden.json
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const BANK = 'quest-data/trivia-golden.json';
const PROTECTED_CATS = ['quran', 'juz-amma', 'juz-tabarak', 'prayer'];

// ---------------------------------------------------------------------------
// THE SEALED THIRTEEN. Every file here carries scripture, adhkar, the mushaf
// layout, the question bank, or the two files that decide what a phone installs
// and caches. None of them may move without the seal being re-cut deliberately.
//
// This list used to live in chat-ux-guard.cjs, inside the ELSE arm of a
// `git diff --name-only HEAD` probe. When git was absent -- a fresh export, a
// container, any CI image without .git -- the probe threw, the guard reported
// one honest failure about the blast radius, and the seal below it NEVER RAN.
// A reader saw a single red line about git and read it as harmless plumbing;
// the thirteen went unchecked. The most valuable guarantee in the repository
// cannot be a passenger on a `git` lookup, and it does not belong inside a
// user-experience guard at all. It runs here, unconditionally, and a mismatch
// prints the file, the expected digest and the actual one.
// ---------------------------------------------------------------------------
const SEALED = {
  'quest-data/trivia-golden.json': '4066160153f7648e7eeb145edae0ed43a2d24048d549ce076b37a6e144a425a9',
  'quest-data/reveal-golden.json': 'b3a89a4997b9b9ab6c91bd26a020e2e85a8d697ffec19bbd29937885d3819743',
  'quest-data/quran-quest-golden.json': 'd657ce9fcad754afd75ab96dbb3a8670d056cb3f103c37b689a4d51f31d9fefc',
  'quest-data/prayer-quest-golden.json': 'fdff7d29711735f0ce72e62c025a7596b9c2d3c6d0f254e9f198854d812b5807',
  'quest-data/bank-integrity-golden.json': '04877fb4faa2f21786a1b65f2be4f879bcccfd7af0f3621b4abefb31afef46ec',
  'quest-data/content-review-manifest.json': 'ae79702252e711f11804e2c0cf36166d085649035b032106fe3e8658c08ced85',
  'quest-data/rewards.json': '536caf3d048ca3e11361135b635a6284916ba286c4139ac5b8f8f176e6e84ba3',
  'quest-data/world.json': '6da5033bef577784238e7ab98d356dc8cf345958215d3232bad221922feb751b',
  'quran-uthmani.json': 'd4fd1a1507f70a4261789eaec8380750cd0f65f4d641f6df2ef6334b18c6877b',
  'adhkar.json': '19ef96b9ecc275376d46a667a86297261ea5991749ffe46dd35448196cb4c9c3',
  'mushaf-layout.json': 'ea9223ef7f18b5d933ce1c87cbebabc5d78f1ec0e8ac9714260f9dee6d571351',
  // D09: these two are sealed on LF BYTES. They were sealed on this machine's CRLF
  // working copy (manifest 549 b / sw 5044 b) while git stored LF (533 b / 4944 b), so
  // the seal held here and broke in every fresh clone and every CI run on Linux. Both
  // now carry `text eol=lf` in .gitattributes, so what is checked out is what is sealed.
  // Re-cut these only from a tree measured at CR = 0.
  'manifest.json': 'b542ce84b30e12d3cc517ee51ba628ac6a669714792063d8d606678305730434',
  // Re-cut history for this one file, newest first. Measured on this tree at CR = 0
  // every time, as the note above requires.
  //   item 93      -- a failed precache entry is counted and named instead of swallowed. B11
  //                    gained the three item 93 checks in the SAME commit as this digest.
  //   item 90      -- the two sealed mushaf files left the stale-while-revalidate class and
  //                    returned to cache-first. B11 gained the ZERO-fetch half in the SAME commit.
  //   items 88 + 80 -- CACHE 'ezik-v1' -> 'ezik-v2' (so a returning reader stops being
  //                    served the old build out of the old store), and the same-origin
  //                    *.json class moved from cache-first to stale-while-revalidate.
  //                    SW_CACHE below and B11 were cut in the SAME commit as this digest.
  //   watermark     -- CORE gained '/icon-watermark.png' in the commit that pointed .ezwm at it.
  'sw.js': 'd9972aa1ea2fc843e47069db53c60832e383b1c608993fbce9bb513bc34cd9a3',
};

// ---------------------------------------------------------------------------
// B11: THE SERVICE WORKER'S DATA-FILE POLICY, EXECUTED.
//
// B10 proves sw.js has not moved. It cannot prove sw.js still BEHAVES. Item 80
// was exactly that gap: the data files were served cache-first with no
// revalidation, so a changed adhkar.json stayed frozen on every phone that had
// ever opened the app until a human remembered to bump the cache name below.
// A seal would have happily blessed that forever.
//
// So B11 runs the worker. sw.js is evaluated in vm.runInContext with `self`,
// `caches` and `fetch` domesticated -- the same technique the vendor-loading
// guards in this repo already use -- and a synthetic FetchEvent is dispatched
// at it. No browser, no network, no server: the assertions below are about what
// the code DOES, and they are written against the worker's own selector rather
// than against a line number, an index into the file, or a quoted source line.
//
// SW_CACHE is re-cut with the seal above, in the same commit, by whoever ships
// a version bump. It is here so that a forgotten bump fails with a sentence
// instead of with "sw.js MOVED".
// ---------------------------------------------------------------------------
const SW_FILE = 'sw.js';
const SW_CACHE = 'ezik-v3';
const SW_ORIGIN = 'https://ezik.app';
// The data-file class item 80 governs, and one member of every class it must NOT
// have touched. Named by request, because the worker selects by request.
// ITEM 90 SPLIT THIS CLASS IN TWO, and each half is asserted for the OPPOSITE thing. The two
// mushaf files are sealed by digest above, so the worker excludes them from revalidation by name
// and serves them cache-first; the other three still revalidate. Asserting only the revalidating
// half would let the exclusion widen until it swallowed adhkar.json, which is precisely the
// freeze item 80 was raised to end. So: these three must issue exactly ONE background fetch, and
// those two must issue ZERO.
const SW_REVALIDATED = ['/adhkar.json', '/worship-display.json', '/manifest.json'];
const SW_SEALED_DATA = ['/quran-uthmani.json', '/mushaf-layout.json'];
const SW_DATA_FILES = SW_REVALIDATED.concat(SW_SEALED_DATA);

function swRes(body, status) {
  return {
    status: status === undefined ? 200 : status,
    type: 'basic',
    _body: body,
    clone() { return swRes(this._body, this.status); },
    text() { return Promise.resolve(this._body); },
  };
}

// Load sw.js into a domesticated global scope and hand back the levers a test needs.
function swLoad(swPath, fetchImpl, failAdd) {
  const store = new Map();
  const listeners = {};
  const opened = [];
  let fetchCalls = 0;
  const keyOf = (r) => (typeof r === 'string' ? SW_ORIGIN + r : r.url);
  const cacheOf = (n) => { if (!store.has(n)) store.set(n, new Map()); return store.get(n); };
  const wrap = (n) => ({
    match: (r) => Promise.resolve(cacheOf(n).get(keyOf(r))),
    put: (r, res) => { cacheOf(n).set(keyOf(r), res); return Promise.resolve(); },
    // Item 93: the harness can make a named precache entry reject, which is the only way to ask
    // the worker what it does with a failure it cannot prevent.
    add: (u) => (failAdd && failAdd(u)
      ? Promise.reject(new Error('QuotaExceededError (synthetic)'))
      : Promise.resolve()),
    delete: (r) => Promise.resolve(cacheOf(n).delete(keyOf(r))),
  });
  const sandbox = {
    URL: URL, Promise: Promise, setTimeout: setTimeout, clearTimeout: clearTimeout, console: console,
    self: {
      addEventListener: (t, f) => { listeners[t] = f; },
      skipWaiting: () => {},
      clients: { claim: () => Promise.resolve() },
      location: { origin: SW_ORIGIN },
    },
    caches: {
      open: (n) => { opened.push(n); return Promise.resolve(wrap(n)); },
      match: (r) => {
        for (const n of store.keys()) {
          const h = cacheOf(n).get(keyOf(r));
          if (h) return Promise.resolve(h);
        }
        return Promise.resolve(undefined);
      },
      keys: () => Promise.resolve(Array.from(store.keys())),
      delete: (n) => Promise.resolve(store.delete(n)),
    },
    fetch: (r) => { fetchCalls++; return fetchImpl(r); },
  };
  vm.runInContext(fs.readFileSync(swPath, 'utf8'), vm.createContext(sandbox), { filename: swPath });
  return {
    hasFetchListener: () => typeof listeners.fetch === 'function',
    opened: opened,
    fetches: () => fetchCalls,
    seed: (name, url, body) => cacheOf(name).set(SW_ORIGIN + url, swRes(body)),
    peek: (name, url) => {
      const h = cacheOf(name).get(SW_ORIGIN + url);
      return h ? h._body : undefined;
    },
    self: sandbox.self,
    install: () => {
      const waits = [];
      if (typeof listeners.install !== 'function') return { waits: waits, missing: true };
      listeners.install({ waitUntil: (p) => { waits.push(p); } });
      return { waits: waits, missing: false };
    },
    dispatch: (url, mode) => {
      let responded = null;
      const waits = [];
      listeners.fetch({
        request: { url: SW_ORIGIN + url, method: 'GET', mode: mode || 'cors' },
        respondWith: (p) => { responded = p; },
        waitUntil: (p) => { waits.push(p); },
      });
      return { responded: responded, waits: waits };
    },
  };
}

const swSettle = (ps) => Promise.all(ps.map((p) => Promise.resolve(p).catch(() => undefined)));
const swBody = async (p) => {
  if (!p) return undefined;
  const r = await Promise.resolve(p).catch(() => undefined);
  return r ? await r.text() : undefined;
};

// ---------------------------------------------------------------------------
// Arabic, as escapes only.
// ---------------------------------------------------------------------------
const AR = {
  // deictic pointers at a list the default reveal mode never renders
  MIMMA_YALI: '\u0645\u0645\u0627 \u064a\u0644\u064a',                  // mimma yali
  ATIYA: '\u0627\u0644\u0627\u062a\u064a\u0647',                        // al-atiya
  TALIYA: '\u0627\u0644\u062a\u0627\u0644\u064a\u0647',                 // al-taliya
  TALI: '\u0627\u0644\u062a\u0627\u0644\u064a',                         // al-tali
  ATI: '\u0627\u0644\u0627\u062a\u064a',                                // al-ati
  MIN_HADHIHI: '\u0645\u0646 \u0647\u0630\u0647',                       // min hadhihi
  MIN_HAULA: '\u0645\u0646 \u0647\u0621\u0644\u0627\u0621',             // min ha'ula'
  KHIYARAT: '\u0627\u0644\u062e\u064a\u0627\u0631\u0627\u062a',         // al-khiyarat
  // source markers that are not sources
  YURAJA: '\u064a\u0631\u0627\u062c\u0639',                             // yuraja' -- "to be reviewed"
  MASHHUR: '\u0645\u0634\u0647\u0648\u0631',                            // mashhur -- "well known"
  // the two literal options a mis-typed true/false question used to carry
  TF_T: '\u0635\u062d', TF_F: '\u062e\u0637\u0623',                     // sahh / khata'
};
const DEICTIC = [AR.MIMMA_YALI, AR.ATIYA, AR.TALIYA, AR.TALI, AR.ATI, AR.MIN_HADHIHI, AR.MIN_HAULA, AR.KHIYARAT];
// interrogatives and imperatives that make a stem stand on its own
const INTERROGATIVES = ['\u0645\u0627', '\u0645\u0646', '\u0643\u0645', '\u0627\u064a\u0646',
  '\u0645\u062a\u064a', '\u0643\u064a\u0641', '\u0644\u0645\u0627\u0630\u0627', '\u0645\u0627\u0630\u0627',
  '\u0627\u064a', '\u0647\u0644', '\u0627\u0630\u0643\u0631', '\u0627\u0643\u0645\u0644',
  '\u0631\u062a\u0628', '\u0637\u0627\u0628\u0642', '\u0635\u0644', '\u0633\u0645'];

// ---------------------------------------------------------------------------
// Normalisation. Diacritics go; alef/ya/ta-marbuta/hamza forms collapse; but
// DIGITS SURVIVE -- Arabic-Indic, subscripts, superscripts and the minus sign all
// fold to ASCII. An earlier sweep that dropped them reported six duplicate choices
// that did not exist ("100" and "0" both normalising to the empty string).
// ---------------------------------------------------------------------------
const TASHKEEL = /[\u064b-\u0652\u0670\u0640\u06d6-\u06ed]/g;
const SUB = '\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089';
const SUP = '\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079';
function norm(s) {
  if (s == null) return '';
  let t = String(s).replace(TASHKEEL, '');
  t = t.replace(/[\u2080-\u2089]/g, c => String(SUB.indexOf(c)));
  t = t.replace(/[\u2070\u00b9\u00b2\u00b3\u2074-\u2079]/g, c => String(SUP.indexOf(c)));
  t = t.replace(/[\u0660-\u0669]/g, c => String(c.charCodeAt(0) - 0x0660));
  t = t.replace(/[\u06f0-\u06f9]/g, c => String(c.charCodeAt(0) - 0x06f0));
  t = t.replace(/[\u2212\u2013\u2014]/g, '-');
  t = t.replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627');
  t = t.replace(/\u0629/g, '\u0647').replace(/\u0649/g, '\u064a');
  t = t.replace(/[\u0624\u0626]/g, '\u0621');
  t = t.replace(/[^\u0621-\u064a0-9a-zA-Z\-%]+/g, ' ');
  return t.trim();
}
const wordsOf = s => norm(s).split(' ').filter(Boolean);
function hasPhrase(stem, phrase) {
  const w = wordsOf(stem), p = phrase.split(' ').filter(Boolean);
  for (let i = 0; i + p.length <= w.length; i++) {
    let ok = true;
    for (let j = 0; j < p.length; j++) if (w[i + j] !== p[j]) { ok = false; break; }
    if (ok) return true;
  }
  return false;
}
// print any string as codepoints -- never raw Arabic
const cp = s => '[' + [...String(s)].map(c => {
  const n = c.charCodeAt(0);
  return n < 128 ? c : 'U+' + n.toString(16).toUpperCase().padStart(4, '0');
}).join(' ') + ']';

const stemOf = q => q.q != null ? q.q : (q.verse != null ? q.verse : '');
const optsOf = q => q.choices || q.bank || null;
const keyOf = q => { const o = optsOf(q); return o && typeof q.answer === 'number' ? norm(o[q.answer]) : null; };
function fingerprint(q) {
  return crypto.createHash('sha256').update(JSON.stringify(q, Object.keys(q).sort())).digest('hex').slice(0, 16);
}
// A citation locates something if it carries a number (hadith no., aya, year),
// or a sub-reference introduced by an em- or en-dash, or a \u00abquoted entry\u00bb.
const LOCATOR = /[0-9\u0660-\u0669]|[\u2014\u2013]\s*\S|\u00ab[^\u00bb]+\u00bb/;

function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  let i = 0; for (const v of A) if (B.has(v)) i++;
  return i / (A.size + B.size - i);
}

// ---------------------------------------------------------------------------
// Documented exceptions. Each one is a judgement call recorded in the source so a
// later reader can overturn it deliberately rather than by accident.
// ---------------------------------------------------------------------------
// Two questions ask for the same dhikr on two DIFFERENT occasions (before food /
// before wudu). Same key, overlapping stem, but genuinely two questions.
const ALLOWED_DUP = new Set(['adhkar|azkar-0001|gemini-adhkar-b2-001']);
// The stem legitimately contains the key.
const ALLOWED_SELF_REVEAL = {
  'phys-0016': 'angle of reflection EQUALS the angle of incidence named in the stem -- that identity IS the question',
  'chatgpt-chemistry-001': 'stem names solvent and solute; asking which is which is the concept being tested',
  'chatgpt4-geography-009': 'stem offers the A-or-B pair explicitly; it is an either/or question, not a list pointer',
  'gemini-hadith-b2-014': 'the hadith itself repeats the word ("da` ma yuribuk ila ma la yuribuk")',
};

function load(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

// ---------------------------------------------------------------------------
function emit() {
  const d = load(BANK);
  const prot = {}, cats = {}, hist = {};
  for (const q of d.questions) {
    cats[q.id] = q.cat;
    hist[q.cat] = (hist[q.cat] || 0) + 1;
    if (PROTECTED_CATS.includes(q.cat)) prot[q.id] = fingerprint(q);
  }
  process.stdout.write(JSON.stringify({
    schema: 'bank-integrity-golden/v1',
    note: 'Phase-4 structural baseline. `protected` pins the 394 questions of the four protected '
      + 'categories to their commit-17bb52a bytes and must NEVER be regenerated to paper over a change '
      + 'to them. `ids` / `cats` / `total` pin identity. Everything else the guard recomputes live.',
    total: d.questions.length,
    protectedCats: PROTECTED_CATS,
    protectedCount: Object.keys(prot).length,
    categoryCounts: hist,
    ids: d.questions.map(q => q.id),
    cats,
    protected: prot,
  }, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
async function compare(goldenPath) {
  const d = load(BANK), g = load(goldenPath);
  let pass = 0, fail = 0;
  const ok = m => { pass++; console.log('  PASS ' + m); };
  const no = (c, m) => { fail++; console.log('  FAIL [' + c + '] ' + m); };

  const isProt = q => PROTECTED_CATS.includes(q.cat);
  const rest = d.questions.filter(q => !isProt(q));

  // -- B1 count ------------------------------------------------------------
  console.log('\n-- B1 count --');
  if (d.questions.length === g.total) ok('question count = ' + g.total);
  else no('B1', 'question count = ' + d.questions.length + ' (golden says ' + g.total + ')');

  // -- B2 identity ---------------------------------------------------------
  console.log('\n-- B2 identity --');
  const live = d.questions.map(q => q.id);
  if (live.length === g.ids.length && live.every((v, i) => v === g.ids[i])) ok('id list unchanged, in order');
  else {
    const L = new Set(live), G = new Set(g.ids);
    const added = live.filter(x => !G.has(x)), gone = g.ids.filter(x => !L.has(x));
    if (added.length) no('B2', 'ids not in the golden: ' + added.slice(0, 8).join(', '));
    if (gone.length) no('B2', 'ids dropped from the bank: ' + gone.slice(0, 8).join(', '));
    if (!added.length && !gone.length) no('B2', 'id ORDER changed');
  }

  // -- B3 categories -------------------------------------------------------
  console.log('\n-- B3 categories --');
  let moved = 0;
  for (const q of d.questions) if (g.cats[q.id] && g.cats[q.id] !== q.cat) { moved++; no('B3', q.id + ' moved ' + g.cats[q.id] + ' -> ' + q.cat); }
  if (!moved) ok('every question is still in its own category');
  const hist = {};
  for (const q of d.questions) hist[q.cat] = (hist[q.cat] || 0) + 1;
  const drift = Object.keys(g.categoryCounts).filter(c => hist[c] !== g.categoryCounts[c]);
  if (!drift.length) ok('category histogram unchanged (' + Object.keys(hist).length + ' categories)');
  else for (const c of drift) no('B3', 'category ' + c + ' = ' + (hist[c] || 0) + ' (golden ' + g.categoryCounts[c] + ')');

  // -- B4 schema + B6 answer validity --------------------------------------
  console.log('\n-- B4 schema / B6 answer validity --');
  let bad = 0;
  for (const q of rest) {
    const o = optsOf(q), t = q.type;
    const stem = stemOf(q);
    if (!stem || !String(stem).trim()) { no('B4', q.id + ' has no stem'); bad++; }
    if (!q.why || !String(q.why).trim()) { no('B4', q.id + ' has no why'); bad++; }
    if (t === 'mcq') {
      if (!Array.isArray(q.choices)) { no('B4', q.id + ' mcq without choices'); bad++; }
      else {
        if (q.choices.length < 3) { no('B4', q.id + ' mcq with only ' + q.choices.length + ' choices (a 2-option mcq is a mis-typed tf)'); bad++; }
        if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.choices.length) { no('B6', q.id + ' answer index ' + q.answer + ' out of range'); bad++; }
        if (q.choices[0] === AR.TF_T && q.choices[1] === AR.TF_F) { no('B4', q.id + ' is a true/false statement stored as mcq'); bad++; }
        const seen = new Set();
        for (const c of q.choices) {
          const n = norm(c);
          if (!n) { no('B4', q.id + ' has an empty choice'); bad++; }
          if (seen.has(n)) { no('B4', q.id + ' has a duplicate choice ' + cp(String(c).slice(0, 24))); bad++; }
          seen.add(n);
        }
      }
    } else if (t === 'tf') {
      if (typeof q.answer !== 'boolean') { no('B6', q.id + ' tf answer is not a boolean'); bad++; }
      if (q.choices) { no('B4', q.id + ' tf carries a dead choices array'); bad++; }
    } else if (t === 'complete') {
      if (!Array.isArray(q.bank)) { no('B4', q.id + ' complete without a bank'); bad++; }
      else if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.bank.length) { no('B6', q.id + ' answer index out of range'); bad++; }
    } else if (t === 'order') {
      if (!Array.isArray(q.items) || !Array.isArray(q.answer) || q.items.length !== q.answer.length) { no('B4', q.id + ' order shape is broken'); bad++; }
    } else if (t === 'match') {
      if (!Array.isArray(q.left) || !Array.isArray(q.right) || !Array.isArray(q.a)
        || q.left.length !== q.right.length || q.left.length !== q.a.length) { no('B4', q.id + ' match shape is broken'); bad++; }
    } else { no('B4', q.id + ' unknown type ' + t); bad++; }
    if (o && typeof q.answer === 'number' && o[q.answer] != null && !norm(o[q.answer])) { no('B6', q.id + ' answer key is empty'); bad++; }
  }
  if (!bad) ok('all ' + rest.length + ' non-protected questions are schema-clean');

  // -- B5 duplicates -------------------------------------------------------
  console.log('\n-- B5 duplicates --');
  const byStem = new Map();
  for (const q of rest) {
    const k = norm(stemOf(q));
    if (!k) continue;
    if (!byStem.has(k)) byStem.set(k, []);
    byStem.get(k).push(q.id);
  }
  let dups = 0;
  for (const [, ids] of byStem) if (ids.length > 1) { dups++; no('B5', 'identical stems: ' + ids.join(' = ')); }
  const byCat = {};
  for (const q of rest) (byCat[q.cat] = byCat[q.cat] || []).push(q);
  for (const c of Object.keys(byCat)) {
    const grp = new Map();
    for (const q of byCat[c]) { const k = keyOf(q); if (!k) continue; if (!grp.has(k)) grp.set(k, []); grp.get(k).push(q); }
    for (const [, qs] of grp) {
      if (qs.length < 2) continue;
      for (let i = 0; i < qs.length; i++) for (let j = i + 1; j < qs.length; j++) {
        if (jaccard(wordsOf(stemOf(qs[i])), wordsOf(stemOf(qs[j]))) < 0.40) continue;
        if (ALLOWED_DUP.has(c + '|' + qs[i].id + '|' + qs[j].id)) continue;
        dups++; no('B5', 'same answer key and overlapping stems in ' + c + ': ' + qs[i].id + ' ~ ' + qs[j].id);
      }
    }
  }
  if (!dups) ok('no duplicate question in the 1785 (1 documented parallel pair allowed)');

  // -- B7 option independence ----------------------------------------------
  console.log('\n-- B7 the stem stands on its own --');
  let dep = 0;
  for (const q of rest) {
    const stem = stemOf(q);
    for (const dpat of DEICTIC) {
      if (hasPhrase(stem, dpat)) { dep++; no('B7', q.id + ' stem points at an unrendered list: ' + cp(dpat)); }
    }
    // a stem must ask something; tf statements and fill-in prompts are exempt
    if (q.type !== 'tf' && q.type !== 'complete') {
      const w = wordsOf(stem);
      const asks = /[\u061f?]/.test(stem) || /[:\uff1a]\s*$/.test(String(stem).trim())
        || /\.\.\.|\u2026|_{2,}/.test(stem) || INTERROGATIVES.some(t => w.includes(norm(t)));
      if (!asks) { dep++; no('B7', q.id + ' stem is not a question and carries no completion marker'); }
    }
    // the stem must not contain its own answer
    const k = keyOf(q);
    if (k && k.length >= 5 && (' ' + norm(stem) + ' ').includes(' ' + k + ' ') && !ALLOWED_SELF_REVEAL[q.id]) {
      dep++; no('B7', q.id + ' stem contains its own answer key');
    }
  }
  if (!dep) ok('every stem is answerable with the choices hidden (' + Object.keys(ALLOWED_SELF_REVEAL).length + ' documented exceptions)');

  // -- B8 sources ----------------------------------------------------------
  console.log('\n-- B8 sources --');
  let src = 0;
  for (const q of rest) {
    const s = String(q.src == null ? '' : q.src).trim();
    if (!s) { src++; no('B8', q.id + ' has no src'); continue; }
    if (hasPhrase(s, AR.YURAJA)) { src++; no('B8', q.id + ' src is a "to be reviewed" marker, not a source'); }
    else if (norm(s) === norm(AR.MASHHUR)) { src++; no('B8', q.id + ' src is a hearsay marker, not a source'); }
    if (/^https?:\/\/[^\/]+\/?$/i.test(s)) { src++; no('B8', q.id + ' src is a bare hostname, not the page that proves the fact'); }
    if (s.length < 4) { src++; no('B8', q.id + ' src is too short to locate anything'); }
    // A source must point INSIDE the work it names. Naming a fourteen-volume
    // chronicle is the same defect as citing a homepage: it proves nothing and
    // nobody can check it. A locator is a number (hadith no. / aya / year), a
    // sub-reference after a dash (kitab, bab, tarjama, entry), or a \u00abquoted
    // entry title\u00bb. All 1785 satisfied this when the rule was added.
    if (!LOCATOR.test(s)) { src++; no('B8', q.id + ' src names a work but no place inside it'); }
  }
  if (!src) ok('all ' + rest.length + ' non-protected sources name a work AND a place inside it');

  // -- B9 the 394 protected questions --------------------------------------
  console.log('\n-- B9 protected questions (the load-bearing check) --');
  const liveProt = d.questions.filter(isProt);
  if (liveProt.length === g.protectedCount) ok('protected question count = ' + g.protectedCount);
  else no('B9', 'protected count = ' + liveProt.length + ' (golden ' + g.protectedCount + ')');
  let touched = 0;
  for (const q of liveProt) {
    const want = g.protected[q.id];
    if (!want) { touched++; no('B9', q.id + ' is protected but absent from the golden'); continue; }
    if (fingerprint(q) !== want) { touched++; no('B9', q.id + ' WAS EDITED -- protected questions are frozen at commit 17bb52a'); }
  }
  for (const id of Object.keys(g.protected)) {
    if (!d.questions.some(q => q.id === id)) { touched++; no('B9', id + ' disappeared from the bank'); }
  }
  if (!touched) ok('all ' + g.protectedCount + ' protected questions are byte-for-byte unchanged');

  // -- B10 the sealed thirteen ---------------------------------------------
  // No `if git`, no `try`. Every file is opened and hashed on every run, and the
  // count of what was actually hashed is printed so a silent skip is impossible
  // to mistake for a pass.
  console.log('\n-- B10 sealed files (unconditional: no git, no skip) --');
  const sealNames = Object.keys(SEALED);
  let sealed = 0, sealBad = 0;
  for (const f of sealNames) {
    const p = path.join(__dirname, f);
    if (!fs.existsSync(p)) {
      sealBad++; no('B10', f + ' is ABSENT -- sealed as ' + SEALED[f]);
      continue;
    }
    const h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    sealed++;
    if (h !== SEALED[f]) {
      sealBad++;
      no('B10', f + ' MOVED');
      console.log('         sealed ' + SEALED[f]);
      console.log('         actual ' + h);
    }
  }
  console.log('  sealed files hashed: ' + sealed + '/' + sealNames.length);
  if (sealed !== sealNames.length) no('B10', 'only ' + sealed + ' of ' + sealNames.length + ' sealed files were readable');
  if (!sealBad) ok('all ' + sealNames.length + ' sealed files are byte-for-byte unchanged');

  // -- B11 the service worker's data-file policy, EXECUTED -----------------
  console.log('\n-- B11 service worker: data files must revalidate (item 80) --');
  const swPath = path.join(__dirname, SW_FILE);
  if (!fs.existsSync(swPath)) {
    no('B11', SW_FILE + ' is ABSENT -- the data-file policy cannot be executed');
  } else {
    // The cache name. Discovered by running the worker, not by reading a line.
    const probe = swLoad(swPath, () => Promise.resolve(swRes('NET')));
    if (!probe.hasFetchListener()) {
      no('B11', SW_FILE + ' registered no fetch listener -- nothing to assert');
    } else {
      probe.dispatch(SW_DATA_FILES[0]);
      await new Promise((r) => setTimeout(r, 0));
      const name = probe.opened[0];
      if (name === SW_CACHE) ok('service worker opens cache "' + SW_CACHE + '"');
      else no('B11', 'service worker opens cache ' + JSON.stringify(name) + ' -- SW_CACHE says "'
        + SW_CACHE + '". Re-cut both together, or the ship is invisible to every returning reader.');

      // Every data file, one at a time. A class assertion that only ever ran on
      // adhkar.json would not have caught worship-display.json.
      let stale = 0, frozen = 0, fragile = 0;
      for (const f of SW_REVALIDATED) {
        // (1) a HIT is served from the cache AND a background fetch is issued.
        const h = swLoad(swPath, () => Promise.resolve(swRes('NEW')));
        h.seed(name, f, 'OLD');
        const before = h.fetches();
        const d1 = h.dispatch(f);
        if (!d1.responded) { stale++; no('B11', f + ' is not handled by the worker at all'); continue; }
        const b1 = await swBody(d1.responded);
        if (b1 !== 'OLD') { stale++; no('B11', f + ' did not serve the STORED copy (got ' + JSON.stringify(b1) + ')'); }
        if (h.fetches() - before !== 1) {
          stale++;
          no('B11', f + ' was served from the cache with NO revalidation fetch (' + (h.fetches() - before)
            + '). This is item 80: a changed file stays frozen on every device until the cache name is bumped.');
        }
        if (!d1.waits.length) {
          stale++;
          no('B11', f + ' handed its revalidation to nothing -- the worker may be killed before the write lands');
        }

        // (2) the read AFTER the file changed returns the new bytes.
        await swSettle(d1.waits);
        if (h.peek(name, f) !== 'NEW') { frozen++; no('B11', f + ' revalidation never wrote the new bytes into the cache'); }
        const b2 = await swBody(h.dispatch(f).responded);
        if (b2 !== 'NEW') { frozen++; no('B11', f + ' still serves the old bytes after revalidation (' + JSON.stringify(b2) + ')'); }

        // (3) a FAILED fetch keeps the stored copy and raises nothing at the page.
        const hx = swLoad(swPath, () => Promise.reject(new Error('offline')));
        hx.seed(name, f, 'OLD');
        const d3 = hx.dispatch(f);
        let raised = null;
        await Promise.resolve(d3.responded).catch((e) => { raised = e; });
        if (raised) { fragile++; no('B11', f + ' let a network failure reach the page: ' + raised.message); }
        if (await swBody(d3.responded) !== 'OLD') { fragile++; no('B11', f + ' did not serve the stored copy while offline'); }
        for (const w of d3.waits) {
          await Promise.resolve(w).catch((e) => { fragile++; no('B11', f + ' revalidation promise rejected: ' + e.message); });
        }
        if (hx.peek(name, f) !== 'OLD') {
          fragile++;
          no('B11', f + ' LOST its stored copy to a failed fetch -- a reader with no network loses the file entirely');
        }
      }
      if (!stale) ok('all ' + SW_REVALIDATED.length + ' revalidating data files are served from cache AND revalidated in the background');
      if (!frozen) ok('all ' + SW_REVALIDATED.length + ' revalidating data files serve the NEW bytes on the read after a change');
      if (!fragile) ok('all ' + SW_REVALIDATED.length + ' revalidating data files survive a dead network with the stored copy intact');

      // ITEM 90: the excluded pair. Served from the store, and NEVER revalidated. A background
      // fetch here is 2.4 MB of a reader's data spent on bytes a sha256 already guarantees.
      let leaked = 0;
      for (const f of SW_SEALED_DATA) {
        const s = swLoad(swPath, () => Promise.resolve(swRes('NEW')));
        s.seed(name, f, 'OLD');
        const before = s.fetches();
        const d = s.dispatch(f);
        if (!d.responded) { leaked++; no('B11', f + ' is not handled by the worker at all'); continue; }
        const b = await swBody(d.responded);
        if (b !== 'OLD') { leaked++; no('B11', f + ' did not serve the STORED copy (got ' + JSON.stringify(b) + ')'); }
        const spent = s.fetches() - before;
        if (spent !== 0) {
          leaked++;
          no('B11', f + ' is sealed and excluded from revalidation, but the worker still issued '
            + spent + ' background fetch(es). Item 90: that is a phone re-downloading bytes that\n'
            + '        cannot have changed without breaking the seal above.');
        }
      }
      if (!leaked) ok('both sealed mushaf files are served from cache with ZERO revalidation fetch (item 90)');

      // ITEM 93: a precache entry that fails is COUNTED and NAMED. One CORE entry is made to
      // reject; install must still settle, and the worker must afterwards be able to say which
      // entry it lost. Silence here is how a reader ends up offline in front of a blank screen.
      const VICTIM = '/adhkar.json';
      const noisy = swLoad(swPath, () => Promise.resolve(swRes('NEW')), (u) => u === VICTIM);
      const inst = noisy.install();
      if (inst.missing) no('B11', SW_FILE + ' registered no install listener -- nothing to precache');
      else {
        let installRejected = null;
        for (const w of inst.waits) { await Promise.resolve(w).catch((e) => { installRejected = e; }); }
        if (installRejected) {
          no('B11', 'a failed precache entry REJECTED install (' + installRejected.message + '). The\n'
            + '        worker never activates, so a phone with a full disk keeps the OLD build forever.');
        } else ok('a failed precache entry does not reject install (item 93)');
        const rec = noisy.self.ezikPrecacheFailures;
        if (!rec || typeof rec.length !== 'number') {
          no('B11', 'a failed precache entry is recorded NOWHERE -- install completes one entry\n'
            + '        short with nothing counted and nothing logged. This is item 93.');
        } else if (rec.length !== 1) {
          no('B11', 'exactly one precache entry was made to fail; the worker counted ' + rec.length);
        } else if (String(rec[0] && rec[0].url) !== VICTIM) {
          no('B11', 'the failed entry was counted but not NAMED (got ' + JSON.stringify(rec[0])
            + ', expected ' + VICTIM + ')');
        } else ok('a failed precache entry raises the counter and records its name (item 93)');

        // The control. Without it, a recorder that reports a failure unconditionally would pass
        // every assertion above while measuring nothing.
        const clean = swLoad(swPath, () => Promise.resolve(swRes('NEW')));
        const ci = clean.install();
        await swSettle(ci.waits);
        const cleanRec = clean.self.ezikPrecacheFailures || [];
        if (cleanRec.length !== 0) {
          no('B11', 'a precache in which every entry stored still recorded ' + cleanRec.length
            + ' failure(s) -- the counter is not measuring what it is named for');
        } else ok('a precache with every entry storing records no failure (item 93 control)');
      }

      // The policies item 80 must NOT have moved. Without these, "revalidate
      // everything" would pass B11 while doubling every asset request and
      // unfreezing the quest bank the testers depend on being fresh.
      let moved = 0;
      const asset = swLoad(swPath, () => Promise.resolve(swRes('NEW')));
      asset.seed(name, '/icon-192.png', 'OLDPNG');
      const da = asset.dispatch('/icon-192.png');
      if (await swBody(da.responded) !== 'OLDPNG' || asset.fetches() !== 0) {
        moved++; no('B11', 'a content-stable asset is no longer cache-first (fetches=' + asset.fetches() + ')');
      }
      if (swLoad(swPath, () => Promise.resolve(swRes('x'))).dispatch('/api/chat').responded) {
        moved++; no('B11', '/api/* is being intercepted -- a cached religious answer is a wrong answer');
      }
      if (swLoad(swPath, () => Promise.resolve(swRes('x'))).dispatch('/quest-data/trivia-golden.json').responded) {
        moved++; no('B11', 'the .json branch swallowed /quest-data/ -- testers would be frozen on an old bank');
      }
      const shell = swLoad(swPath, () => Promise.resolve(swRes('SHELL')));
      shell.seed(name, '/', 'OLDSHELL');
      if (await swBody(shell.dispatch('/', 'navigate').responded) !== 'SHELL') {
        moved++; no('B11', 'the app shell is no longer network-first');
      }
      if (!moved) ok('the four policies item 80 does not govern are untouched (asset / api / quest-data / shell)');
    }
  }

  console.log('\n' + (fail ? 'FAIL' : 'PASS') + '  ' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
}

const mode = process.argv[2];
if (mode === '--emit') emit();
else if (mode === '--compare' && process.argv[3]) {
  // B11 executes the service worker, so compare() is async. A rejection here must
  // be a loud non-zero exit, never a silent unhandled-rejection warning above a 0.
  compare(process.argv[3]).catch((e) => {
    console.log('  FAIL [B11] the guard itself threw: ' + (e && e.stack ? e.stack : e));
    process.exit(1);
  });
}
else {
  console.error('usage: node quest-bank-integrity-guard.cjs --emit    > quest-data/bank-integrity-golden.json');
  console.error('       node quest-bank-integrity-guard.cjs --compare quest-data/bank-integrity-golden.json');
  process.exit(2);
}
