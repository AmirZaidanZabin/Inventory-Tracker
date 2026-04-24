const CACHE_NAME = 'inventory-tracker-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/src/main.js',
  '/src/styles/main.css',
  '/logo.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;
  if (event.request.url.includes('chrome-extension')) return;

  // Network First strategy
  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      // Don't cache dev server stuff excessively, but keep simple
      if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          if (event.request.url.startsWith('http')) {
            cache.put(event.request, responseToCache);
          }
        });
      }
      return networkResponse;
    }).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      
      // Fallback for navigation
      if (event.request.destination === 'document') {
        return caches.match('/index.html');
      }
    })
  );
});
