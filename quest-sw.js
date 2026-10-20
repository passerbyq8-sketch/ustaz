/* Kunuz-only offline shell. Registered at /quest and /hanna-laha/, never at /.
   Ezik's existing worker sweeps other CacheStorage stores. A separate asset-only
   IndexedDB database keeps Kunuz offline without changing that worker or its data. */
'use strict';
const DATABASE = 'kunuz-treasure-assets-20261020-v1';
const SHELL = [
  '/quest.html', '/quest-board.html', '/quest-test.html', '/quest-ghaws.html', '/quest-harb.html',
  '/hanna-laha/index.html', '/hanna-laha/', '/hanna-laha/favicon.svg', '/icon.svg',
  '/quest-data/kunuz-bank-3147.js', '/quest-data/kunuz-levels-3147.js', '/quest-data/kunuz-geo-index.js',
  '/quest-data/kunuz-geo.js', '/quest-data/kunuz-packs-manifest.js',
  '/quest-visual.js', '/quest-visual.css', '/quest-levels.js', '/quest-i18n.js',
  '/quest-theme/theme.css', '/quest-theme/model.js', '/quest-theme/icons.js',
  '/quest-theme/history.js', '/quest-theme/journey.js', '/quest-theme/motion-kit.js',
  '/quest-theme/assets/regular.ttf', '/quest-theme/assets/bold.ttf',
  '/quest-theme/assets/ocean-clean.png', '/quest-theme/assets/islands.png', '/quest-theme/assets/hero.png',
  '/quest-theme/audio/tap.wav', '/quest-theme/audio/success.wav', '/quest-theme/audio/swoosh.wav',
  '/quest-theme/audio/water-transition.wav', '/quest-theme/audio/bubble.wav'
];
// This is the existing, locally hosted declarative manifest. Pack code is still
// parsed and validated by KZV in the page; it is never evaluated here.
importScripts('/quest-data/kunuz-packs-manifest.js');
for (const entry of self.KUNUZ_PACKS || []) {
  if (/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(entry.slug) && entry.src === 'quest-data/kunuz-pack-' + entry.slug + '.js') SHELL.push('/' + entry.src);
}
const shellPaths = new Set(SHELL);
let databasePromise;
function database() {
  if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('assets')) request.result.createObjectStore('assets'); };
    request.onsuccess = () => resolve(request.result);
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
  return stored ? new Response(stored.body, { status: stored.status, headers: stored.headers }) : null;
}
async function writeAsset(path, response) {
  if (response.status !== 200) return;
  const body = await response.arrayBuffer();
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
      if (await readAsset(path)) return;
      const response = await fetch(new Request(path, { credentials: 'same-origin' }));
      if (!response.ok) throw new Error('Kunuz offline asset unavailable: ' + path);
      await writeAsset(path, response);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('kunuz-treasure-')) await caches.delete(key);
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
    const key = hannaPage ? '/hanna-laha/index.html' : url.pathname;
    if (self.navigator.onLine === false) {
      const cached = await readAsset(key).catch(() => null); if (cached) return cached;
    }
    try {
      const response = await fetch(request);
      if (response.status === 200 && new URL(response.url).origin === self.location.origin) await writeAsset(key, response.clone()).catch(() => {});
      return response;
    } catch (_) {
      const cached = await readAsset(key).catch(() => null); if (cached) return cached;
      return Response.error();
    }
  })());
});
