// HoldNote service worker. Hand-written on purpose: no dependency, small enough to audit.
//
// - /_next/static/*, /icons/*: cache-first (file names carry a content hash).
// - Page navigations: network-first, falling back to the last copy, so a page opened while
//   online can be reopened with no signal.
// - Never touched: non-GET, other origins (Supabase), /api/*, /auth/*, RSC data requests.
// - Signing out lands on /login, which wipes the cached pages (shared devices).
//
// Hands saved offline live in IndexedDB (see src/lib/offline), not here.

const VERSION = 'v1';
const STATIC_CACHE = `hn-static-${VERSION}`;
const PAGE_CACHE = `hn-pages-${VERSION}`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGE_CACHE]);
      for (const key of await caches.keys()) {
        if (!keep.has(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    if (url.pathname === '/login') {
      event.waitUntil(caches.delete(PAGE_CACHE));
      return;
    }
    event.respondWith(networkFirst(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    // Redirects (signed out -> /login) and errors are not worth keeping.
    if (response.ok && !response.redirected) await cache.put(request, response.clone());
    return response;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    return new Response('Offline', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
}
