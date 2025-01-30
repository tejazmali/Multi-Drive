const CACHE_NAME = 'offline-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/browse.html', // Your stylesheets
  '/css/browse.css',
'/css/index.css',
  '/js/browse.js',
  '/js/index.js',
  
];

// Install event: Cache assets during service worker installation
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event: Serve cached content when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse; // Return cached response if available
      }
      return fetch(event.request); // Otherwise, fetch from network
    })
  );
});
