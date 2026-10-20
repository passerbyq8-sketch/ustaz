/* Kunuz-only offline shell. Registered at /quest and /hanna-laha/, never at /. */
'use strict';
const CACHE = 'kunuz-treasure-20261020-v1';
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
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SHELL.map(async path => {
      if (await cache.match(path)) return;
      const response = await fetch(new Request(path, { credentials: 'same-origin' }));
      if (!response.ok) throw new Error('Kunuz offline asset unavailable: ' + path);
      await cache.put(path, response);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('kunuz-treasure-') && key !== CACHE) await caches.delete(key);
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
    const cache = await caches.open(CACHE), key = hannaPage ? '/hanna-laha/index.html' : url.pathname;
    if (self.navigator.onLine === false) {
      const cached = await cache.match(key); if (cached) return cached;
    }
    try {
      const response = await fetch(request);
      if (response.ok && new URL(response.url).origin === self.location.origin) await cache.put(key, response.clone());
      return response;
    } catch (_) {
      const cached = await cache.match(key); if (cached) return cached;
      return Response.error();
    }
  })());
});
