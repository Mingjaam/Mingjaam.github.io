const CACHE_NAME = 'zogakzogak-v2';
const urlsToCache = [
  '/zogakzogak/',
  '/zogakzogak/index.html',
  '/zogakzogak/assets/',
  '/zogakzogak/manifest.json',
  '/zogakzogak/sounds/'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  // 파일 업로드나 POST 요청은 캐시하지 않음
  if (event.request.method === 'POST' || 
      event.request.url.includes('blob:') ||
      event.request.url.includes('data:')) {
    return fetch(event.request);
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
