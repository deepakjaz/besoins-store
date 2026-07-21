// Increment version on every deployment to auto-purge old client caches
const CACHE_NAME = 'besoins-shell-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

// 1. Install Phase - Force Immediate Activation
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Skip waiting phase, replace old SW immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// 2. Activate Phase - Purge All Stale Old Caches Immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting stale cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim()) // Claim all browser clients immediately
  );
});

// 3. Fetch Interceptor - Network-First for HTML/API, Stale-While-Revalidate for Assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-First for API requests & HTML navigation (Ensures live updates & zero stale code)
  if (url.pathname.startsWith('/api/') || event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline Fallback: Serve cached index.html or API fallback
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            if (url.pathname.startsWith('/api/')) {
              return new Response(JSON.stringify({ offline: true }), {
                headers: { 'Content-Type': 'application/json' }
              });
            }
          });
        })
    );
    return;
  }

  // Cache-First for Immutable Static Assets (SVG, Manifest)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      });
    })
  );
});