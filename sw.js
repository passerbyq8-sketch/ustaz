// Service worker for المربّي (step 6 / 6b). FOUR policies, in strict order:
//   network-only: EVERY /api/* request -- never cached. A cached AI/fatwa reply is a stale
//                 religious answer to a NEW question; a cached report is a report that never
//                 arrives. Both are worse than no cache at all. (First condition in fetch.)
//   network-first: the app shell -- navigations and the HTML entry points (/ and /index.html).
//                 Always fetched fresh; the cached copy is only an offline fallback. This is why
//                 a forgotten version bump can NO LONGER strand a user on a dead build (6b).
//   cache-first : the two mushaf JSONs + manifest + the Google Fonts CSS/font files -- immutable
//                 (the mushaf is fingerprint-locked by quran/layout-guard) or rarely changing.
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
// regardless of the version; the bump refreshes the CACHE-FIRST assets (mushaf/manifest/fonts).
const CACHE = 'ezik-v1';
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
];

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

// Cache-match first: the page prefetches quran-uthmani.json on its own idle callback, and the
// cache-first branch of fetch() below stores it. Re-adding it here would download 338KB twice.
let warming = null;
function warmIdle() {
  if (warming) return warming;
  warming = caches.open(CACHE).then((cache) => Promise.all(
    IDLE.map((u) => cache.match(u).then((hit) => (hit ? null : cache.add(u).catch(() => {}))))
  )).catch(() => {});
  return warming;
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // Add each entry independently so one missing file cannot abort the whole precache.
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all(CORE.map((u) => cache.add(u).catch(() => {}))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
  // Not inside waitUntil: activation must not wait on half a megabyte. The page normally beats
  // this by posting from its own idle callback; this only covers the clients that never do.
  setTimeout(warmIdle, IDLE_BACKSTOP_MS);
});

// The page's idle signal. Anything else posted here is ignored.
self.addEventListener('message', (event) => {
  if (event.data && event.data.ezik === 'warm') event.waitUntil(warmIdle());
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
