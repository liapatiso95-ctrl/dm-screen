const CACHE = 'dm-screen-v1';
const FILES = [
  './dm_screen.html',
  './manifest-dm.json',
  './icon-dm-192.png',
  './icon-dm-512.png'
];
// Install: cache the app shell, activate immediately
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())
  );
});
// Activate: delete old caches, take control of open pages
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
// Network-first for HTML/navigation, cache-first for static assets
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  const isHTML =
    req.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('/');
  if (isHTML) {
    e.respondWith(
      (async () => {
        try {
          const response = await fetch(req);
          if (response && response.status === 200) {
            // AWAIT the cache write so the fresh version is saved
            // before the SW can be terminated.
            const cache = await caches.open(CACHE);
            await cache.put(req, response.clone());
            // Also update the canonical HTML key so the PWA launch
            // (start_url) always reads the same fresh copy.
            await cache.put('./dm_screen.html', response.clone());
          }
          return response;
        } catch (err) {
          // Offline: serve whatever was last saved.
          const cached =
            (await caches.match(req)) ||
            (await caches.match('./dm_screen.html'));
          return cached || Response.error();
        }
      })()
    );
  } else {
    e.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req);
        const fetchPromise = fetch(req)
          .then(response => {
            if (response && response.status === 200) cache.put(req, response.clone());
            return response;
          })
          .catch(() => null);
        return cached || fetchPromise;
      })()
    );
  }
});
