// Service worker for المربّي (step 6 / 6b). FIVE policies, in strict order:
//   network-only: EVERY /api/* request -- never cached. A cached AI/fatwa reply is a stale
//                 religious answer to a NEW question; a cached report is a report that never
//                 arrives. Both are worse than no cache at all. (First condition in fetch.)
//   network-first: the app shell -- navigations and the HTML entry points (/ and /index.html).
//                 Always fetched fresh; the cached copy is only an offline fallback. This is why
//                 a forgotten version bump can NO LONGER strand a user on a dead build (6b).
//   stale-while-revalidate: every same-origin data file (*.json) EXCEPT the two sealed mushaf
//                 files -- so adhkar.json, worship-display.json and manifest.json. The stored copy
//                 is served IMMEDIATELY and a background fetch refreshes it for the NEXT read.
//                 Item 80: cache-first with no revalidation froze a changed adhkar.json on every
//                 phone that had ever opened the app until a human remembered to bump the cache
//                 name -- the same 'human discipline is not a deploy mechanism' defect 6b fixed
//                 for the shell. A FAILED background fetch changes NOTHING: the stored copy is
//                 never dropped, so a reader with no network keeps the adhkar they already have.
//   cache-first : the icons and the watermark + the Google Fonts CSS/font files -- immutable or
//                 rarely changing, and none of them carries text that can go stale.
//   ignored     : every other origin (everyayah.com recitation audio, the unpkg/cdnjs script
//                 CDNs) -- left entirely to the network; the SW never intercepts them.
//
// 🩸 OFFLINE BOOT IS NOT POSSIBLE while React/Babel/html2pdf/mammoth load from unpkg + cdnjs
//    (cross-origin <script> tags in index.html). No service worker can make the app boot
//    offline on its own. For true offline boot those libraries must be self-hosted from this
//    origin. NOT done here -- out of scope for this step; flagged in the report.
//
// The cache name carries a VERSION. Bump it on every ship (v1 -> v2 -> ...): the changed SW
// file makes the browser install the new worker, `activate` deletes every non-matching cache,
// and skipWaiting + clients.claim hand control to the new build IMMEDIATELY -- no tester left
// stranded on a dead build. The HTML shell is network-first (6b) so it is always fresh online
// regardless of the version; the bump refreshes the CACHE-FIRST assets (icons/fonts). The JSON
// data files no longer NEED the bump -- they revalidate themselves -- but they still honour it.
const CACHE = 'ezik-v7';
// '/index.html' is NOT here. Vercel serves this document byte-identically for '/' and for
// '/index.html', so precaching both downloaded the whole shell TWICE on every cold visit --
// 298686 transferred bytes for a second copy of what '/' already holds. The network-first
// branch below still cache.put()s the shell on every successful load, so the offline fallback
// keeps working from the '/' entry.
const CORE = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  // The chat's watermark. Precached for the same reason the three icons above it are: it is
  // painted on the first screen the app opens, and an offline reader that had never fetched
  // it would meet an empty box behind the conversation.
  '/icon-watermark.png',
  '/adhkar.json',
];

// ---------------------------------------------------------------------------
// ITEM 91-A. THE STORAGE QUOTA, MANAGED.
//
// MEASURED BEFORE: this worker had ZERO quota management. No estimate before the first write,
// no persistence request, no eviction rule, no retry. Item 93 taught a failed cache.add to be
// COUNTED and NAMED and stopped there deliberately -- it recorded, it did not recover. So on a
// phone with a full disk the whole sequence was: install writes, every entry rejects, the
// counter fills, activate sweeps the OLD store anyway, and the reader is left holding a new
// cache that is empty and an old cache that is gone. Nothing made room and nothing tried again.
//
// FOUR THINGS CHANGE AND NOTHING ELSE DOES. An estimate before the first write; one request for
// persistence whose refusal is not an error; a reason attached to every recorded failure; and an
// eviction rule that deletes OLD stores -- never the current one -- and retries once. The
// revalidation branch (item 80), the sealed-mushaf exclusion (item 90) and the rule that a dead
// network never costs a reader the copy they already have are all untouched.
// ---------------------------------------------------------------------------

// The measured cost of CORE, byte for byte, at the commit that cut this constant:
//   /  (index.html) 1059309 + icon-watermark.png 373806 + adhkar.json 177392
//   + icon-512.png 12893 + icon-maskable-512.png 5938 + icon-192.png 5053 + manifest.json 533
// quest-bank-integrity-guard.cjs B12 re-derives this sum from the files on disk and FAILS when
// the constant has fallen below it, so a shell that grows cannot quietly leave the pre-check
// reading a number that stopped being true.
const CORE_BYTES = 1634924;
// The safe margin: half again as much as CORE measures. The Cache API stores request and
// response headers beside every body, a gzipped transfer is stored decompressed, and a constant
// re-cut by hand always trails the files it describes by some amount.
const CORE_NEED = CORE_BYTES + Math.floor(CORE_BYTES / 2);

// What the app is allowed to ask this worker about its storage. Item 93 opened this channel with
// a count and a list of names; 91-A adds WHY each entry failed and what was done about it.
const storageState = {
  persist: 'not-asked',       // granted | denied | unavailable | not-asked
  estimate: 'not-taken',      // {quota,usage,free,need} | unavailable | not-taken
  precacheSkipped: null,      // null | 'quota'   -- what INSTALL decided
  activateRetry: 'none',      // none | done | still-full
  evicted: 0,                 // old stores deleted to make room (never the current one)
  retried: 0,                 // entries re-attempted after an eviction
};
// A live reference, not a copy, so anything holding it sees the current state.
self.ezikStorage = storageState;

// THREE REASONS, and the order matters. A full disk and a dead tunnel arrive as the same
// cache.add rejection at a caller that does not look, and they ask for opposite responses: one
// is recoverable by making room, the other only by waiting for a network. Matched on both name
// and message, because QuotaExceededError carries its identity in the name while a storage
// bucket failure carries it in the text.
function failureReason(e) {
  const name = (e && e.name) ? String(e.name) : '';
  const msg = (e && e.message) ? String(e.message) : String(e);
  const both = (name + ' ' + msg).toLowerCase();
  if (both.indexOf('quota') !== -1 || both.indexOf('exceeded') !== -1
    || both.indexOf('no space') !== -1 || both.indexOf('disk is full') !== -1) return 'quota';
  if (both.indexOf('network') !== -1 || both.indexOf('fetch') !== -1
    || both.indexOf('offline') !== -1 || both.indexOf('connection') !== -1) return 'network';
  return 'other';
}

// ABSENCE IS NOT A FAILURE. An older browser has no navigator.storage at all; this resolves to
// null and every caller below then behaves EXACTLY as this worker did before item 91-A -- it
// writes. A quota check that turned an old browser into a worker which caches nothing would be a
// far worse regression than the full disk it was added to handle.
function storageEstimate() {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage
      || typeof navigator.storage.estimate !== 'function') return Promise.resolve(null);
    return navigator.storage.estimate().then((e) => (e || null), () => null);
  } catch (e) { return Promise.resolve(null); }
}

// TRUE means "write". An unknown quota is TRUE, deliberately -- see above.
function roomForCore() {
  return storageEstimate().then((est) => {
    if (!est || typeof est.quota !== 'number' || typeof est.usage !== 'number') {
      storageState.estimate = 'unavailable';
      return true;
    }
    const free = est.quota - est.usage;
    storageState.estimate = { quota: est.quota, usage: est.usage, free: free, need: CORE_NEED };
    return free >= CORE_NEED;
  });
}

// ONCE, and a refusal is not an error -- it is recorded and the worker carries on writing. Per
// the Storage spec estimate() is exposed to workers but persist() is [Exposed=Window], so in a
// real service worker this normally records "unavailable" and moves on, and the request that can
// actually be granted has to be made by the page. That call belongs in index.html, which this
// screen does not own; it is named in the report instead.
let persistAsked = false;
function askPersist() {
  if (persistAsked) return Promise.resolve();
  persistAsked = true;
  try {
    if (typeof navigator === 'undefined' || !navigator.storage
      || typeof navigator.storage.persist !== 'function') {
      storageState.persist = 'unavailable';
      return Promise.resolve();
    }
    return navigator.storage.persist().then(
      (granted) => { storageState.persist = granted ? 'granted' : 'denied'; },
      () => { storageState.persist = 'denied'; }
    );
  } catch (e) { storageState.persist = 'unavailable'; return Promise.resolve(); }
}

// THE EVICTION RULE, AND ITS ONE ABSOLUTE: old stores go, the CURRENT store never does.
// Deleting CACHE to make room for CACHE would throw away the entries that already landed in
// exchange for the space to write them again, and would take the offline fallback down with it.
// activate runs this same sweep -- but install runs BEFORE activate, so on a full disk the old
// store is still sitting there occupying exactly the space the write is short of.
function evictOld() {
  return caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then((done) => {
      const n = done.filter(Boolean).length;
      storageState.evicted += n;
      return n;
    })
    .catch(() => 0);
}

// S117 PERF. THESE TWO ARE STILL CACHED -- JUST NOT INSIDE install. quran-uthmani.json
// (338409 transferred) and mushaf-layout.json (151653) are 490062 bytes that no first screen
// reads: the shell renders the conversation, and both files are only reached from the mushaf.
// Precaching them in install put them in flight during the window the first paint was waiting
// on. They now warm AFTER the boot goes idle, and they are never dropped -- offline readiness
// for the mushaf arrives a beat later on the very first visit and is identical on every visit
// after it.
//
// requestIdleCallback is a Window API; ServiceWorkerGlobalScope has no idle callback at all.
// So the real idle signal comes from the page (a postMessage sent from ITS requestIdleCallback,
// the same pattern as the registration in index.html), and the backstop half of that pattern --
// the timeout -- lives here for any client that never posts, such as a page served from an
// older cached build.
const IDLE = [
  '/quran-uthmani.json',
  '/mushaf-layout.json',
];
const IDLE_BACKSTOP_MS = 1500;

// ITEM 93. A FAILED PRECACHE ENTRY IS NO LONGER SWALLOWED WHOLE. `cache.add(u).catch(() => {})`
// discarded the error and the fact of it together: install completed, the worker activated and
// claimed the page, and the store was quietly short an entry. Nothing was counted, nothing was
// logged, and the first person to find out was a reader who opened the app with no network and
// met a blank where adhkar.json should have been.
//
// THIS RECORDS. IT DOES NOT RECOVER. No retry, no quota management, no recovery surface: each is
// a decision with its own costs and none of them is this item. What changes is that the failure
// can be SEEN -- counted, named with its reason, and queryable from the page.
//
// SUCCESS BEHAVIOUR IS UNCHANGED, DELIBERATELY. An entry that stores, stores exactly as before.
// And install is still never REJECTED by a failure: rejecting it would strand a phone with a full
// disk on the previous worker entirely, which is a worse outcome than the gap it would report.
//
// SCOPE, MEASURED AND STATED: this covers the two PRECACHE paths -- install (CORE) and warmIdle
// (IDLE). The three `cache.put(...).catch(() => {})` in the fetch handlers below are deliberately
// left alone: a failed runtime put leaves the previous copy in place and the very next read
// retries it, whereas a failed precache entry is never attempted again. Recording those too would
// also grow this array once per request on a dead network, which is the quota management this
// item explicitly does not want.
const precacheFailures = [];
// ITEM 91-A: reason is now the CATEGORY (quota | network | other) and the raw browser text moved
// to error. Nothing read this channel yet, so the rename costs no reader; what it buys is a page
// able to tell "your disk is full" from "you are offline" without parsing a browser's prose.
function note(u, e, reason) {
  precacheFailures.push({ url: u, reason: reason, error: (e && e.message) || String(e) });
  // DevTools is the only channel a worker has to a human standing in front of the problem.
  if (typeof console !== 'undefined' && console.warn) {
    console.warn('[ezik sw] precache FAILED for ' + u + ' (' + reason + '): '
      + ((e && e.message) || e) + ' (' + precacheFailures.length + ' failed so far)');
  }
}
function addOrNote(cache, u) {
  return cache.add(u).catch((e) => {
    // ONLY a full disk is worth making room for. A dead network is recorded and left alone:
    // deleting a reader's old store cannot conjure the bytes, it only costs them what they had.
    const why = failureReason(e);
    if (why !== 'quota') { note(u, e, why); return undefined; }
    return evictOld().then(() => {
      storageState.retried++;
      // ONCE. A retry loop against a disk that is genuinely full is an install that never
      // settles, which strands the reader on the previous worker -- item 93's worst outcome.
      return cache.add(u).catch((e2) => note(u, e2, failureReason(e2)));
    });
  });
}
// A live reference, not a copy, so anything holding it sees the current list.
self.ezikPrecacheFailures = precacheFailures;

// Cache-match first: the page prefetches quran-uthmani.json on its own idle callback, and the
// cache-first branch of fetch() below stores it. Re-adding it here would download 338KB twice.
let warming = null;
function warmIdle() {
  if (warming) return warming;
  warming = caches.open(CACHE).then((cache) => Promise.all(
    IDLE.map((u) => cache.match(u).then((hit) => (hit ? null : addOrNote(cache, u))))
  )).catch(() => {});
  return warming;
}

// The retry activate owns. Kept beside install because it writes the very same list.
function precacheCore() {
  return caches.open(CACHE).then((cache) => Promise.all(CORE.map((u) => addOrNote(cache, u))));
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // ITEM 91-A: ask for persistence once, estimate, and only then write. Add each entry
  // independently so one missing file cannot abort the whole precache.
  event.waitUntil(
    askPersist().then(roomForCore).then((room) => {
      if (!room) {
        // NOTHING IS WRITTEN. Starting a precache into a store that provably cannot hold it
        // buys one recorded failure per file and leaves the disk exactly as full as it was.
        // The reason is recorded and readable; install still settles, so the worker activates.
        storageState.precacheSkipped = 'quota';
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[ezik sw] precache SKIPPED: needs ' + CORE_NEED + ' bytes, '
            + (storageState.estimate && storageState.estimate.free) + ' free');
        }
        return undefined;
      }
      return precacheCore();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      // ITEM 91-A. The sweep above has just deleted the old stores -- which is precisely the
      // space install was short of. Without this, a quota-skipped install would leave the reader
      // holding nothing at all: the new store empty and the old one swept. Once, and only when
      // install actually skipped; precacheSkipped is left as the record of what install did.
      .then(() => {
        if (storageState.precacheSkipped !== 'quota') return undefined;
        return roomForCore().then((room) => {
          if (!room) { storageState.activateRetry = 'still-full'; return undefined; }
          storageState.activateRetry = 'done';
          return precacheCore();
        });
      })
  );
  // Not inside waitUntil: activation must not wait on half a megabyte. The page normally beats
  // this by posting from its own idle callback; this only covers the clients that never do.
  setTimeout(warmIdle, IDLE_BACKSTOP_MS);
});

// The page's idle signal, and the item 93 precache report. Anything else posted here is ignored.
self.addEventListener('message', (event) => {
  if (event.data && event.data.ezik === 'warm') event.waitUntil(warmIdle());
  // Item 93: how many entries failed and which. Reporting only -- nothing is retried here.
  if (event.data && event.data.ezik === 'precache-status') {
    // ITEM 91-A: the count alone cannot tell a full disk from a dead tunnel, and the two ask
    // opposite things of the reader. The storage record travels on the same channel.
    const reply = {
      ezik: 'precache-status',
      failed: precacheFailures.length,
      entries: precacheFailures.slice(),
      storage: {
        persist: storageState.persist,
        estimate: storageState.estimate,
        precacheSkipped: storageState.precacheSkipped,
        activateRetry: storageState.activateRetry,
        evicted: storageState.evicted,
        retried: storageState.retried,
      },
    };
    const port = event.ports && event.ports[0];
    if (port) port.postMessage(reply);
    else if (event.source && event.source.postMessage) event.source.postMessage(reply);
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // NETWORK-ONLY, never cached: every /api/*. Not calling respondWith lets the request go
  // straight to the network with zero SW involvement, so nothing is ever stored for it.
  if (sameOrigin && url.pathname.startsWith('/api/')) return;

  // NETWORK-ONLY, never cached: the quest test surface. Its bank JSON is replaced on the
  // server between test rounds, so a cache-first copy would freeze testers on an old bank.
  if (sameOrigin && (url.pathname === '/quest.html' || url.pathname.startsWith('/quest-data/'))) return;

  // NETWORK-FIRST for the app shell: navigations and the HTML entry points. Serving index.html
  // cache-first stranded users on a dead build whenever the cache version was not bumped --
  // human discipline is not a deploy mechanism. Fetch fresh; refresh the cached copy on success;
  // fall back to the cached shell only when the network fails (offline).
  if (req.mode === 'navigate' || (sameOrigin && (url.pathname === '/' || url.pathname === '/index.html'))) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req).then((m) => m || caches.match('/')))
    );
    return;
  }

  // STALE-WHILE-REVALIDATE for same-origin DATA files. Selected by what the request IS -- a
  // same-origin '.json' -- not by a list this branch would have to be kept in step with. The
  // stored copy answers the page at once; the network copy lands in the cache for the next read.
  //
  // The three properties this branch is required to have, in the order they are asserted by
  // quest-bank-integrity-guard.cjs B11:
  //   1. a cache HIT is served immediately AND a background fetch is issued;
  //   2. the read AFTER the file changed on the server gets the new bytes;
  //   3. a FAILED fetch leaves the stored copy intact and raises nothing at the page.
  // (3) is an acceptance condition, not a nicety: this app is used with no network.
  //
  // ITEM 90. THE TWO MUSHAF FILES ARE EXCLUDED FROM THIS BRANCH BY NAME, and fall through to the
  // cache-first branch below -- which is where they sat before item 80 moved the whole *.json
  // class to stale-while-revalidate. quran-uthmani.json (1412005 bytes) and mushaf-layout.json
  // (996528) are 2408533 bytes that revalidation can only ever spend to re-download what is
  // already stored: both are sealed by sha256 in quest-bank-integrity-guard.cjs, so neither can
  // change without a deliberate re-cut of that seal. On a phone's data plan that is the whole
  // cost of the policy and none of its benefit.
  //
  // THE PRICE, AND IT IS REAL: a cache-name bump is now the ONLY way these two are ever
  // refreshed. Acceptable because every ship bumps it, and because a file that cannot change
  // without breaking a seal has nothing to refresh to.
  //
  // The other three data files keep revalidating and are NOT touched: adhkar.json (177392) and
  // worship-display.json (18132) change without ceremony, and manifest.json is 533 bytes.
  // quest-bank-integrity-guard.cjs B11 asserts BOTH halves -- one background fetch for these
  // three, zero for the two below -- so the exclusion cannot quietly widen to swallow adhkar.
  const sealedMushaf = url.pathname === '/quran-uthmani.json' || url.pathname === '/mushaf-layout.json';
  if (sameOrigin && url.pathname.endsWith('.json') && !sealedMushaf) {
    event.respondWith(
      caches.open(CACHE).then((cache) => cache.match(req).then((hit) => {
        // Never rejects and never deletes. A dead network resolves it to undefined and the
        // stored copy stays exactly as it was.
        const revalidate = fetch(req).then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
          return res;
        }).catch(() => undefined);
        if (hit) {
          // Keep the worker alive for the write, but do not make the page wait on it.
          event.waitUntil(revalidate);
          return hit;
        }
        // Cold cache: there is nothing stale to serve, so this read is the network read.
        return revalidate;
      }))
    );
    return;
  }

  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  // IGNORE every other origin (everyayah.com, unpkg, cdnjs). Do not intercept or cache.
  if (!sameOrigin && !isFont) return;

  // CACHE-FIRST for same-origin static assets and the Google Fonts CSS/font files.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && (res.status === 200 || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req).then((m) => m || (req.mode === 'navigate' ? caches.match('/') : undefined)));
    })
  );
});
