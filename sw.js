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
const CACHE = 'almurabbi-v1';
const CORE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/quran-uthmani.json',
  '/mushaf-layout.json',
];

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
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // NETWORK-ONLY, never cached: every /api/*. Not calling respondWith lets the request go
  // straight to the network with zero SW involvement, so nothing is ever stored for it.
  if (sameOrigin && url.pathname.startsWith('/api/')) return;

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
      }).catch(() => caches.match(req).then((m) => m || caches.match('/index.html')))
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
      }).catch(() => caches.match(req).then((m) => m || (req.mode === 'navigate' ? caches.match('/index.html') : undefined)));
    })
  );
});
