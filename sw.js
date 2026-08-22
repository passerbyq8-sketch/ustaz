// Service worker for المربّي (step 6 / 6b). SIX policies, in strict order:
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
//   cache-first, capped: the 604 printed mushaf pages, in a store of their OWN whose name
//                 carries no version (item 33). Immutable scans, so a shipment must not
//                 sweep them; bounded and evicted, so paging the book cannot fill a phone.
//   cache-first : the icons and the watermark + the Google Fonts CSS/font files -- immutable or
//                 rarely changing, and none of them carries text that can go stale.
//   ignored     : every other origin (everyayah.com recitation audio, the cdnjs bundles that
//                 html2pdf and mammoth are fetched from on first use) -- left entirely to the
//                 network; the SW never intercepts them. unpkg and jsdelivr are no longer among
//                 them: item 32 took React off unpkg and @babel/standalone off jsdelivr, and
//                 the page reaches neither host at all.
//
// OFFLINE BOOT IS POSSIBLE NOW, and this note is what it replaced. It used to read: "OFFLINE
//    BOOT IS NOT POSSIBLE while React/Babel/html2pdf/mammoth load from unpkg + cdnjs
//    (cross-origin <script> tags in index.html) ... for true offline boot those libraries must
//    be self-hosted from this origin. NOT done here." Item 32 did it: the two React bundles are
//    served from /vendor, @babel/standalone is gone entirely (the JSX is compiled before the
//    commit, into /app.js), and all three are in CORE above. A reader who has visited once
//    boots with no network.
//    TWO CDN SCRIPTS REMAIN AND NEITHER BLOCKS A BOOT: html2pdf and mammoth are fetched from
//    cdnjs the first time a reader exports a PDF or attaches a .docx, and never otherwise. An
//    offline reader loses those two features and nothing else -- the app itself renders.
//
// The cache name carries a VERSION. Bump it on every ship (v1 -> v2 -> ...): the changed SW
// file makes the browser install the new worker, `activate` deletes every non-matching cache,
// and skipWaiting + clients.claim hand control to the new build IMMEDIATELY -- no tester left
// stranded on a dead build. The HTML shell is network-first (6b) so it is always fresh online
// regardless of the version; the bump refreshes the CACHE-FIRST assets (icons/fonts). The JSON
// data files no longer NEED the bump -- they revalidate themselves -- but they still honour it.
const CACHE = 'ezik-v18';
// '/index.html' is NOT here. Vercel serves this document byte-identically for '/' and for
// '/index.html', so precaching both downloaded the whole shell TWICE on every cold visit --
// a second copy of the 120617 bytes '/' already holds. The network-first branch below still
// cache.put()s the shell on every successful load, so the offline fallback keeps working from
// the '/' entry.
//
// ITEM 115-ب. That figure used to be a TRANSFER size (298686 bytes), and a transfer size is a
// number nothing in this repository can check: it depends on the CDN's encoder, its settings
// and its version, none of which are in the tree. It had also stopped being true -- this shell
// compresses to nothing near it today. So the figure is stated on DISK, where B14 below
// re-measures it on every gate run and fails on any drift.
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
  // ITEM 32. The three files the first paint cannot happen without, self-hosted from this origin
  // since the three render-blocking CDN tags left index.html. They are here for the reason the
  // note at the top of this file used to say was impossible: with React and the app bundle on
  // the same origin, and precached, a reader who has visited once can now BOOT offline. Before
  // this commit the shell was cached and the app it needed was not, so an offline reader met a
  // page that loaded and then never rendered.
  '/app.js',
  '/vendor/react.umd.js',
  '/vendor/react-dom.umd.js',
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
//   /  (index.html) 120617 + app.js 960680 + icon-watermark.png 368386
//   + adhkar.json 177392 + vendor/react-dom.umd.js 131835 + icon-512.png 12893
//   + vendor/react.umd.js 10751 + icon-maskable-512.png 5938 + icon-192.png 5053
//   + manifest.json 533
// quest-bank-integrity-guard.cjs B12 re-derives this sum from the files on disk and FAILS when
// the constant has fallen below it, so a shell that grows cannot quietly leave the pre-check
// reading a number that stopped being true.
// ITEM 33 / ITEM 112. The table above is measured and TRUE OF THE DISK. This CONSTANT is not:
// it trails index.html by the bytes item 33 added to the reader. It is re-derived by
// tools/core-bytes.cjs --write, and the MERGE ROUND is the only place that command may run --
// item 112 owns it, and a screen that re-cuts it here would be re-cutting a number two other
// screens are also moving. B12 below states the difference on every gate run, so it is
// carried in the open rather than forgotten. A constant that TRAILS is the safe direction:
// the pre-check then reserves less room than CORE needs and install is merely pessimistic.
// A constant that LEADS would let install start a precache that cannot finish, which is why
// B12 fails downward only.
const CORE_BYTES = 1794078;
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
  // ITEM 93-B: how the end-of-install brief went out. A number is how many clients were handed
  // it (0 is a real, expected answer -- see announceInstall); 'unavailable' means this browser
  // gives a worker no way to reach a page at all.
  announced: 'not-sent',      // 'not-sent' | 'unavailable' | <number of clients posted to>
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
// (1412005 bytes) and mushaf-layout.json (996528) are 2408533 bytes that no first screen
// reads: the shell renders the conversation, and both files are only reached from the mushaf.
// (ITEM 115-ب: these were transfer sizes -- 338409 and 151653 -- which nothing offline can
// verify and which had already gone stale. Stated on disk, and checked by B14.)
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

// ---------------------------------------------------------------------------
// ITEM 93-B. THE CHANNEL IS PUSHED, NOT ONLY PULLED.
//
// MEASURED BEFORE: item 93 counted every failed precache entry and named it, and 91-A added the
// reason and what was done about it -- and then left the whole record sitting behind a REQUEST.
// A page learns that its offline store is short an entry only if it thinks to ask, and the only
// people who think to ask are the ones already standing over a broken install. Every reader who
// does not ask meets the gap for the first time with no network, in front of a blank where
// adhkar.json should have been. A record nobody reads is the same silence item 93 set out to end,
// moved one step later.
//
// SO INSTALL ENDS BY HANDING THE BRIEF OUT. One postMessage per connected client, at the end of
// install, whether or not anybody asked.
//
// THIS OPENS A CHANNEL. IT BUILDS NOTHING ON TOP OF ONE. There is no recovery surface, no retry,
// no banner and no byte of index.html in this item -- the consumer belongs to the screen that
// owns the page, and shipping half of it here would put a message on a channel with a listener
// that does not exist yet. What is asserted is that the message goes out, that it names what
// failed and why, and that a worker with nobody listening installs exactly as it always did.
//
// FOUR THINGS MUST NOT HAPPEN, and each is a state the guard drives:
//   1. install must not reject because the report could not be delivered;
//   2. NO CLIENT AT ALL is the normal case, not an error -- the first install of a new worker
//      routinely runs before any page is controlled, and a worker that treated an empty client
//      list as a failure would report a failure on the healthiest install there is;
//   3. one client whose postMessage throws must not cost the other clients their copy;
//   4. a browser that exposes no clients.matchAll must record that and carry on.
const REPORT_TAG = 'precache-report';
function installSummary() {
  return {
    ezik: REPORT_TAG,
    // The count first, because it is the only field a consumer can branch on without parsing.
    failed: precacheFailures.length,
    // url + reason only. The raw browser text stays behind the pull channel: it is a debugging
    // aid, it is the one field whose shape no spec fixes, and a page that shows a reader
    // "TypeError: Failed to fetch" has told them nothing they can act on.
    entries: precacheFailures.map((f) => ({ url: f.url, reason: f.reason })),
    // What INSTALL decided, so a page can tell "seven entries failed" from "nothing was even
    // attempted because the disk could not hold CORE". They ask opposite things of the reader.
    skipped: storageState.precacheSkipped,
    persist: storageState.persist,
    evicted: storageState.evicted,
    retried: storageState.retried,
  };
}
function announceInstall() {
  const report = installSummary();
  // DevTools stays the channel to a human standing in front of the problem; the page is the
  // channel to the reader. Only a report with something in it is worth a line.
  if (report.failed && typeof console !== 'undefined' && console.warn) {
    console.warn('[ezik sw] install finished with ' + report.failed + ' precache failure(s): '
      + report.entries.map((e) => e.url + ' (' + e.reason + ')').join(', '));
  }
  try {
    if (!self.clients || typeof self.clients.matchAll !== 'function') {
      storageState.announced = 'unavailable';
      return Promise.resolve();
    }
    // includeUncontrolled, because on a FIRST install nothing is controlled yet and the page
    // that just registered this worker is exactly the one that wants the brief.
    return self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((list) => {
      const clients = list || [];
      let sent = 0;
      for (const c of clients) {
        // Per client, so a page that has navigated away mid-install cannot take the others'
        // copy with it. A throw here is that page's problem and nobody else's.
        try {
          if (c && typeof c.postMessage === 'function') { c.postMessage(report); sent++; }
        } catch (e) { /* one dead client, not a failed install */ }
      }
      storageState.announced = sent;
    }, () => { storageState.announced = 'unavailable'; });
  } catch (e) {
    storageState.announced = 'unavailable';
    return Promise.resolve();
  }
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
      // ITEM 93-B. BOTH ARMS ANNOUNCE. The skip path is the one a reader most needs told about
      // -- nothing was written at all -- so a report that only fired after a successful precache
      // would be silent in exactly the state it exists for. And a rejection is re-thrown AFTER
      // the brief goes out rather than swallowed: install has never rejected here by design, and
      // turning the report into a new way to hide one would be its own defect.
      .then(announceInstall, (e) => announceInstall().then(() => { throw e; }))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // ITEM 33. MUSHAF_CACHE IS EXEMPT FROM THE SWEEP, BY NAME. Every other store here is a
      // superseded SHIPMENT and deleting it is the point of this line; the mushaf pages are
      // not a shipment at all. Without this clause a version bump silently threw away every
      // page the reader had downloaded, of files that cannot change -- which is the defect
      // item 33 exists to close, and it lives in this filter and nowhere else.
      //
      // evictOld() above keeps the OPPOSITE rule deliberately: it sweeps everything but CACHE,
      // the mushaf store included. Its whole contract is 'make room for the shell, once, on a
      // disk that is genuinely full', and a reader who must choose between an app that opens
      // offline and pages they can fetch again keeps the app. Two contracts, two filters, and
      // the guard drives both so the asymmetry cannot become an accident.
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== MUSHAF_CACHE).map((k) => caches.delete(k))))
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
        // ITEM 93-B: so a page that asks can also tell whether it should have been TOLD --
        // 'unavailable' here means the push channel does not exist on this browser and the
        // pull channel is the only one there is.
        announced: storageState.announced,
        // ITEM 33: what the capped mushaf-page store did -- written, evicted, declined for
        // want of room, and rejected. Counters, not a list; see mushafState for why.
        mushaf: storageState.mushaf,
        // A-4: the POLICY, beside the counters. A page that offers to download a whole juz
        // has to do two things it cannot do from guesswork: state the eviction rule to the
        // reader, and refuse to start when the disk cannot hold the juz while leaving this
        // worker's own floor intact. Both numbers are READ FROM HERE rather than copied into
        // the client, because a second copy of a ceiling is a ceiling that drifts.
        mushafPolicy: { cap: MUSHAF_PAGE_CAP, minFree: MUSHAF_MIN_FREE },
      },
    };
    const port = event.ports && event.ports[0];
    if (port) port.postMessage(reply);
    else if (event.source && event.source.postMessage) event.source.postMessage(reply);
  }
});

// ---------------------------------------------------------------------------
// ITEM 33. THE PRINTED MUSHAF PAGES GET A STORE OF THEIR OWN, WITH A CEILING.
//
// MEASURED BEFORE: this worker did not name assets/madina-hafs anywhere -- not the directory,
// not the extension, not one path. The 604 page images therefore matched no branch above and
// landed in the LAST one, the generic same-origin cache-first arm, which cache.put()s whatever
// reaches it into CACHE. That single omission is three defects at once:
//
//   1. NO CEILING AND NO EVICTION. A reader who pages through the whole mushaf stores 66012516
//      bytes -- the measured sum of the 604 files on disk, mean 109292 bytes a page -- into a
//      store nothing bounds and nothing trims.
//   2. NO ESTIMATE. The quota machinery item 91-A built is consulted before CORE and before
//      nothing else in this file. These writes never asked whether there was room; they wrote
//      until the browser refused, and the refusal went to a catch that discarded it.
//   3. TIED TO THE SHIPMENT. CACHE carries the version and activate deletes every store whose
//      name is not the current one, so every ship threw away every page the reader had already
//      paid for -- of files that CANNOT change. A printed page of the Qur'an is not a build
//      artefact, and re-downloading tens of megabytes of it once a ship is pure loss.
//
// FOUR THINGS CHANGE AND NOTHING ABOVE THIS LINE MOVES. A store whose name carries no version;
// an explicit exemption in activate's sweep, so a bump cannot take it; a ceiling of
// MUSHAF_PAGE_CAP pages with least-recently-used eviction; and an estimate before every write
// which DECLINES rather than fails when the disk is nearly full.
// ---------------------------------------------------------------------------

// No version in this name, and that is the whole point: these files are immutable, so the one
// reason to bump a store name -- the bytes behind it changed -- can never apply to them.
const MUSHAF_CACHE = 'ezik-mushaf-pages-v1';
// Matched on what the request IS, like every other branch in this worker: 'page-', three
// digits, '.webp', under that one directory. No other asset can drift into this policy.
const MUSHAF_PAGE_RE = /^\/assets\/madina-hafs\/page-\d{3}\.webp$/;
// The ceiling, in PAGES -- about 6.5 MB at the measured mean. A reader's neighbourhood, not the
// whole book. In pages rather than bytes because every page is within a few percent of every
// other, and a byte ceiling would need a running total this worker cannot keep across the
// restarts a service worker suffers constantly.
const MUSHAF_PAGE_CAP = 60;
// Below this much free space nothing is stored at all. Deliberately far above one page: a
// worker that spends the last of a phone's disk caching scripture has cost the reader their
// photographs to save them a download they can repeat.
const MUSHAF_MIN_FREE = 50 * 1024 * 1024;

// ITEM 33 + 93/93-B: this policy reports through the channel those items opened rather than
// opening a second one -- and it reports COUNTERS, not a list. precacheFailures is an unbounded
// array because a precache entry is attempted exactly once; a page store is attempted on every
// read, so an array here would grow once per request on a dead disk, which is the growth item
// 93's own scope note refuses. Nothing is swallowed: every rejection on this path lands in
// mushafNote, and there is no catch(() => {}) anywhere in it.
const mushafState = {
  stored: 0,      // pages written
  evicted: 0,     // pages dropped by the ceiling, least-recently-used first
  skipped: 0,     // writes DECLINED by the estimate -- the reader still got the page
  failed: 0,      // writes or deletes the browser rejected
  reason: null,   // category of the LAST failure: quota | network | other
};
storageState.mushaf = mushafState;

function mushafNote(p, e) {
  mushafState.failed++;
  mushafState.reason = failureReason(e);
  if (typeof console !== 'undefined' && console.warn) {
    console.warn('[ezik sw] mushaf page store FAILED for ' + p + ' (' + mushafState.reason
      + '): ' + ((e && e.message) || e));
  }
}

// LEAST-RECENTLY-USED, AND IT SURVIVES A RESTART. The Cache API keeps no metadata and a service
// worker is killed and restarted constantly, so recency cannot live only in memory. cache.keys()
// answers in INSERTION order, which is the only record the platform keeps; this seeds from it
// once per worker lifetime and refines it in memory from there. Refreshing a hit by delete+put
// would give an exactly persisted order at the cost of rewriting a whole page on every read --
// a worse trade than an order exact within a session and approximate across one.
let mushafOrder = null;   // pathnames, LEAST recently used FIRST

function mushafSeed(cache) {
  if (mushafOrder) return Promise.resolve(mushafOrder);
  if (!cache || typeof cache.keys !== 'function') { mushafOrder = []; return Promise.resolve(mushafOrder); }
  return cache.keys().then((reqs) => {
    mushafOrder = (reqs || []).map((r) => {
      try { return new URL(r.url).pathname; } catch (e) { return String(r && r.url); }
    });
    return mushafOrder;
  }, (e) => { mushafNote('(keys)', e); mushafOrder = []; return mushafOrder; });
}

function mushafTouch(p) {
  if (!mushafOrder) return;
  const i = mushafOrder.indexOf(p);
  if (i !== -1) mushafOrder.splice(i, 1);
  mushafOrder.push(p);
}

// Room is made for ONE more BEFORE it is written, so the store never exceeds the ceiling even
// for an instant -- and the oldest goes first, which is what makes this an eviction rule rather
// than a refusal to store anything once the ceiling is reached.
function mushafEvict(cache) {
  const over = mushafOrder.length - (MUSHAF_PAGE_CAP - 1);
  if (over <= 0) return Promise.resolve(0);
  const doomed = mushafOrder.splice(0, over);
  return Promise.all(doomed.map((p) => cache.delete(p).then(
    (gone) => { if (gone) mushafState.evicted++; },
    (e) => mushafNote(p, e)
  ))).then(() => doomed.length);
}

// TRUE means 'write'. An unknown quota is TRUE for exactly the reason roomForCore gives: a
// browser that reports nothing must behave as this worker did before there was a check at all.
function mushafRoom() {
  return storageEstimate().then((est) => {
    if (!est || typeof est.quota !== 'number' || typeof est.usage !== 'number') return true;
    return (est.quota - est.usage) >= MUSHAF_MIN_FREE;
  });
}

// The reader ALREADY HAS THE PAGE by the time this runs -- it was answered from the network and
// this is the write beside it. Nothing here can reach them, which is why a decline is silent to
// the reader and loud in the record.
function mushafStore(cache, p, req, res) {
  return mushafRoom().then((room) => {
    if (!room) { mushafState.skipped++; return undefined; }
    return mushafSeed(cache)
      .then(() => mushafEvict(cache))
      .then(() => cache.put(req, res).then(
        () => { mushafTouch(p); mushafState.stored++; },
        (e) => mushafNote(p, e)
      ));
  });
}

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

  // ITEM 33. CACHE-FIRST FOR THE PRINTED MUSHAF PAGES, IN THEIR OWN CAPPED STORE. This branch
  // sits ABOVE the generic cache-first arm at the bottom of this handler because that arm is
  // what used to catch these pages, and taking them away from it is the whole item.
  //
  // Cache-first with no revalidation, like the two sealed mushaf JSON files above and for the
  // same reason: a scanned page of the printed mushaf cannot change. What is different is that
  // there are 604 of them, so this arm also carries a ceiling, an eviction rule and an estimate.
  if (sameOrigin && MUSHAF_PAGE_RE.test(url.pathname)) {
    const page = url.pathname;
    event.respondWith(
      caches.open(MUSHAF_CACHE)
        .then((cache) => mushafSeed(cache).then(() => cache.match(req)).then((hit) => {
          if (hit) { mushafTouch(page); return hit; }
          return fetch(req).then((res) => {
            // The write is deliberately NOT on the path the reader waits on: the response is
            // handed back the moment it arrives and the store happens beside it, so an estimate,
            // an eviction and a put cannot add a frame to turning a page.
            if (res && res.status === 200) {
              event.waitUntil(mushafStore(cache, page, req, res.clone()));
            }
            return res;
          },
          // A DEAD NETWORK, not a failed store -- and this arm answers it exactly as the generic
          // cache-first arm below did when it owned these requests: resolve to undefined, which
          // is the network error the page would have met with no worker at all. The image element
          // in the reader latches that as onError and re-renders on its SVG branch. Storage
          // failures do NOT come through here; every one of them lands in mushafNote.
          () => undefined);
        }))
    );
    return;
  }

  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  // IGNORE every other origin (everyayah.com, cdnjs). Do not intercept or cache.
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
