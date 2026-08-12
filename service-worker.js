const CACHE_NAME = 'gradebook-cache-v3';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        CORE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('SW cache skip:', url, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // The app shell (navigations / index.html) always goes to the network FIRST,
  // so any update reaches the user immediately. Cache is only a fallback for
  // when there's no connection at all.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Static assets (icons, manifest): serve from cache instantly, but refresh
  // the cache in the background so they stay current too.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
