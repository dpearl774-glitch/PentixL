// The worker is served from the app root, which is "/" on a domain deploy and
// "/<repo>/" on GitHub project pages. Deriving the root from the script URL
// keeps every cache key and route correct at either base.
const ROOT = self.location.pathname.replace(/[^/]*$/, '');
const at = (path) => ROOT + path;
// Bumped whenever the shell changes so existing installs repopulate.
const CACHE = 'pentix-shell-v3';
const SHELL = [at(''), at('index.html'), at('manifest.webmanifest'), at('icon.svg')];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

/** Vite emits content-hashed files under <root>assets/, so their bytes never change. */
const isHashedAsset = (url) => url.pathname.startsWith(at('assets/'));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Navigations go to the network first: a deploy changes index.html, and
  // answering that from cache is what made a fresh build look like no change.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(at('index.html'), copy));
          return response;
        })
        .catch(() => caches.match(at('index.html')).then((cached) => cached || caches.match(at(''))))
    );
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  const fontRequest = /fonts\.(googleapis|gstatic)\.com/.test(url.hostname);
  if (!sameOrigin && !fontRequest) return;

  if (sameOrigin && isHashedAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // Manifest, icon and fonts keep their URL across deploys, so they are served
  // from cache but refreshed in the background: fast, and current next load.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
