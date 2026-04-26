/* Service Worker universel pour sites Hugo */

const SITE_NAME = self.location.hostname.replace(/\./g, '-');
const CACHE_NAME = `hugo-site-${SITE_NAME}-v2`;

const urlsToCache = [
  '/',
  '/css/style.compiled.css',
  '/js/main.compiled.js',
  '/fonts/Inter-400.woff2',
  '/fonts/Inter-600.woff2'
];

const BYPASS_PATHS = [
  '/ads.txt',
  '/robots.txt',
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/feed.xml',
  '/rss.xml',
  '/sellers.json',
  '/app-ads.txt',
  '/.well-known/',
];

// Installation
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log(`Cache ouvert: ${CACHE_NAME}`);
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activation
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Bypass fichiers SEO/ads
  if (BYPASS_PATHS.some(p => url.pathname === p || url.pathname.startsWith(p))) {
    return;
  }
  
  // Bypass tous les .txt, .xml, .json
  if (url.pathname.match(/\.(txt|xml|json)$/i)) {
    return;
  }
  
  // Bypass cross-origin
  if (url.origin !== self.location.origin) {
    return;
  }
  
  // Skip non-GET
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }
  
  // Cache-first pour assets statiques
  if (request.destination === 'style' || 
      request.destination === 'script' ||
      request.destination === 'font' ||
      request.destination === 'image') {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // Network-first pour HTML
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  
  // API
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }
  
  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    
    if (response.ok && request.method === 'GET') {
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error('Fetch failed:', error);
    throw error;
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    throw error;
  }
}
