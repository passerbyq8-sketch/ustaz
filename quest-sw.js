/* Kunuz-only offline shell. Registered at /quest and /hanna-laha/, never at /.
   Ezik's existing worker sweeps other CacheStorage stores. A separate asset-only
   IndexedDB database keeps Kunuz offline without changing that worker or its data. */
'use strict';
const VERSION = '20261023-sweep5';
const DATABASE_PREFIX = 'kunuz-treasure-assets-';
const DATABASE = DATABASE_PREFIX + VERSION;
const CRITICAL_ASSETS = {
  '/quest-theme/assets/regular.ttf': '02609c5ef845ef511676c8badb24d1fc8b4aed3dc3b9d8bbdab22c14431b7c16',
  '/quest-theme/assets/bold.ttf': '05616a64c5dca137a327b30b1fe7f4fcd1e16892a332e1665b49d52038858044',
  '/quest-theme/assets/ocean-clean.webp': '015aa29cf529d899ac8ecf478288247ef5f8257c480c53b4a0f8570dc4a17eb5',
  '/quest-theme/assets/islands.webp': '6785069f0c9107df16bac923b9195185789497abfb300fd7400fbb8b3dfe4171'
};
const SHELL = [
  '/quest.html', '/quest-board.html', '/quest-test.html', '/quest-ghaws.html', '/quest-harb.html',
  '/hanna-laha/index.html', '/hanna-laha/', '/hanna-laha/favicon.svg', '/icon.svg',
  '/quest-data/kunuz-bank-3147.js', '/quest-data/kunuz-levels-3147.js', '/quest-data/kunuz-geo-index.js',
  '/quest-data/kunuz-geo.js', '/quest-data/kunuz-packs-manifest.js',
  '/quest-visual.js', '/quest-visual.css', '/quest-levels.js', '/quest-i18n.js',
  '/quest-theme/theme.css', '/quest-theme/model.js', '/quest-theme/icons.js',
  '/quest-theme/history.js', '/quest-theme/journey.js', '/quest-theme/motion-kit.js',
  '/quest-theme/board-rooms.js', '/quest-theme/room-categories.js',
  '/iap-pending.js', '/hanna-laha/assets/iap-bridge-v1.js', '/hanna-laha/assets/iap-bridge-v1.css',
  '/quest-theme/assets/regular.ttf', '/quest-theme/assets/bold.ttf',
  '/quest-theme/assets/ocean-clean.webp', '/quest-theme/assets/islands.webp', '/quest-theme/assets/hero.png',
  '/quest-theme/audio/tap.wav', '/quest-theme/audio/success.wav', '/quest-theme/audio/swoosh.wav',
  '/quest-theme/audio/water-transition.wav', '/quest-theme/audio/bubble.wav'
];
// This is the existing, locally hosted declarative manifest. Pack code is still
// parsed and validated by KZV in the page; it is never evaluated here.
importScripts('/quest-data/kunuz-packs-manifest.js?v=' + VERSION);
for (const entry of self.KUNUZ_PACKS || []) {
  if (/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(entry.slug) && entry.src === 'quest-data/kunuz-pack-' + entry.slug + '.js') SHELL.push('/' + entry.src);
}
const shellPaths = new Set(SHELL);
const htmlPaths = new Set(SHELL.filter(path => path.endsWith('.html') || path.endsWith('/')));
const assetPath = path => path + '?v=' + VERSION;
const assetKey = url => url.pathname + '?v=' + (url.searchParams.get('v') || VERSION);
let databasePromise;
function database() {
  if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('assets')) request.result.createObjectStore('assets'); };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); databasePromise = null; };
      resolve(request.result);
    };
    request.onerror = () => { databasePromise = null; reject(request.error); };
  });
  return databasePromise;
}
async function readAsset(path) {
  const db = await database();
  const stored = await new Promise((resolve, reject) => {
    const request = db.transaction('assets', 'readonly').objectStore('assets').get(path);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  if (!stored || !await validAsset(path, stored.body)) return null;
  const headers = new Headers(stored.headers);
  if (CRITICAL_ASSETS[path.split('?')[0]]) headers.set('Content-Type', path.split('?')[0].endsWith('.ttf') ? 'font/ttf' : 'image/webp');
  return new Response(stored.body, { status: stored.status, headers });
}
async function validAsset(path, body) {
  if (!body?.byteLength) return false;
  const expected = CRITICAL_ASSETS[path.split('?')[0]];
  if (!expected) return true;
  const digest = await crypto.subtle.digest('SHA-256', body);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('') === expected;
}
async function writeAsset(path, response) {
  if (response.status !== 200) return;
  const body = await response.arrayBuffer();
  // A truncated font/image or an HTML error document must never become the
  // persistent copy used on a later hub return. Keep ordinary same-origin URLs;
  // there are no object URLs with a lifetime tied to the departing page.
  if (!await validAsset(path, body)) return;
  // Fetch exposes decoded bytes. Do not restore transfer-encoding lengths or any
  // authentication headers when constructing the offline response.
  const headers = [...response.headers].filter(([name]) => !['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'keep-alive', 'set-cookie', 'authorization', 'x-vercel-protection-bypass'].includes(name.toLowerCase()));
  const db = await database();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction('assets', 'readwrite');
    transaction.objectStore('assets').put({ body, status: response.status, headers }, path);
    transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
  });
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    await Promise.all(SHELL.map(async path => {
      const key = htmlPaths.has(path) ? path : assetPath(path);
      // Each release has its own database. HTML is always refreshed, including
      // when this version is reinstalled in the second Kunuz scope.
      if (!htmlPaths.has(path) && await readAsset(key)) return;
      const response = await fetch(new Request(key, { credentials: 'same-origin', cache: 'no-store' }));
      if (!response.ok) throw new Error('Kunuz offline asset unavailable: ' + path);
      await writeAsset(key, response);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('kunuz-treasure-')) await caches.delete(key);
    // Only asset databases owned by Kunuz are retired; account/history stores
    // and the main Ezik worker remain outside this worker's scope.
    if (indexedDB.databases) for (const entry of await indexedDB.databases()) {
      if (!entry.name?.startsWith(DATABASE_PREFIX) || entry.name === DATABASE) continue;
      await new Promise(resolve => {
        const request = indexedDB.deleteDatabase(entry.name);
        request.onsuccess = resolve; request.onerror = resolve;
        // An older worker can still have a connection while being replaced.
        // Deletion remains queued and finishes when that connection closes.
        request.onblocked = resolve;
      });
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const hannaPage = request.mode === 'navigate' && /^\/hanna-laha(?:\/|$)/.test(url.pathname);
  const allowed = shellPaths.has(url.pathname) || hannaPage || url.pathname.startsWith('/quest-data/') || url.pathname.startsWith('/quest-theme/') || url.pathname.startsWith('/hanna-laha/assets/');
  if (!allowed) return;
  event.respondWith((async () => {
    const html = request.mode === 'navigate' || htmlPaths.has(url.pathname);
    const key = hannaPage ? '/hanna-laha/index.html' : html ? url.pathname : assetKey(url);
    // HTML goes to the network even if a stale navigator.onLine flag says
    // offline. Versioned immutable assets may use this release's local copy.
    const cached = html || request.cache === 'reload' ? null : await readAsset(key).catch(() => null);
    if (cached) return cached;
    try {
      const response = await fetch(html ? new Request(request, { cache: 'no-store' }) : request);
      if (html && response.status >= 500) {
        const offline = await readAsset(key).catch(() => null); if (offline) return offline;
      }
      if (response.status === 200 && new URL(response.url).origin === self.location.origin) await writeAsset(key, response.clone()).catch(() => {});
      return response;
    } catch (_) {
      const cached = await readAsset(key).catch(() => null); if (cached) return cached;
      // Pages can keep a stable asset URL across releases. The current release's
      // validated precache is also usable when that older query is offline.
      if (!html) {
        const current = await readAsset(assetPath(url.pathname)).catch(() => null);
        if (current) return current;
      }
      return Response.error();
    }
  })());
});
