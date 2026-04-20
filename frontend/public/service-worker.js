// Bump this version any time you want to force-evict all cached assets.
const CACHE_NAME = 'rahat-one-v3';

const PRECACHE_ASSETS = [
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ─── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())   // activate immediately, don't wait for tabs to close
  );
});

// ─── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())          // take control of all open tabs
      .then(() =>
        // Tell every open tab to reload so they pick up the new assets immediately.
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
          clients.forEach((client) => client.navigate(client.url));
        })
      )
  );
});

// ─── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Always bypass the SW for API calls and n8n.
  if (url.pathname.startsWith('/api/') || url.hostname.includes('n8n') || url.port === '5678') {
    event.respondWith(fetch(request));
    return;
  }

  // Navigation requests (HTML pages): network-first, fall back to cached index.html.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // JS and CSS bundles: always network-first so code changes are visible immediately.
  // Falls back to cache only when offline.
  const isJsOrCss = url.pathname.endsWith('.js') || url.pathname.endsWith('.css');
  if (isJsOrCss) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Everything else (fonts, icons, images): cache-first is fine — these rarely change.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
    )
  );
});
