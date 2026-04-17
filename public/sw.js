const CACHE_NAME = 'elveci-v1';
const TILE_CACHE = 'elveci-tiles-v1';
const API_CACHE = 'elveci-api-v1';
const IMG_CACHE = 'elveci-img-v1';
const MAX_TILES = 500;
const MAX_API = 50;
const MAX_IMG = 200;

// App shell to precache
const PRECACHE = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => ![CACHE_NAME, TILE_CACHE, API_CACHE, IMG_CACHE].includes(k)).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Trim cache to max size (LRU by deletion order)
async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > max) {
    await Promise.all(keys.slice(0, keys.length - max).map(k => cache.delete(k)));
  }
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Map tiles — cache first
  if (url.hostname.includes('basemaps.cartocdn.com') || url.hostname.includes('arcgisonline.com')) {
    e.respondWith(
      caches.open(TILE_CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        const res = await fetch(e.request);
        if (res.ok) { cache.put(e.request, res.clone()); trimCache(TILE_CACHE, MAX_TILES); }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Supabase RPC — stale-while-revalidate
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/rpc/')) {
    e.respondWith(
      caches.open(API_CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request).then(res => {
          if (res.ok) { cache.put(e.request, res.clone()); trimCache(API_CACHE, MAX_API); }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Supabase storage images — cache first
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/storage/')) {
    e.respondWith(
      caches.open(IMG_CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        const res = await fetch(e.request);
        if (res.ok) { cache.put(e.request, res.clone()); trimCache(IMG_CACHE, MAX_IMG); }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // App shell — cache first, update in background
  if (url.origin === self.location.origin && (url.pathname === '/' || url.pathname.endsWith('.html') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
    e.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Everything else — network first
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
