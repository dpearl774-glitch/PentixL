// The worker is served from the app root, which is "/" on a domain deploy and
// "/<repo>/" on GitHub project pages. Deriving the root from the script URL
// keeps every cache key and route correct at either base.
const ROOT = self.location.pathname.replace(/[^/]*$/, '');
const at = (path) => ROOT + path;

// Stamped at build time (see stampServiceWorker in vite.config.ts). A browser
// only installs a worker whose bytes changed, so this stamp is what turns a
// deploy into an update at all; it is also the cache name, so this build can
// never read a previous build's shell back out of storage.
const BUILD = '__BUILD__';
const CACHE = `pentix-shell-${BUILD}`;

const SHELL = [
  at(''),
  at('index.html'),
  at('manual.html'),
  at('manifest.webmanifest'),
  at('icon.svg'),
];

self.addEventListener('install', (event) => {
  // No skipWaiting here: a new build waits until a page asks for it, so the
  // editor is never reloaded out from under someone mid-drawing.
  // 'reload' bypasses the HTTP cache, so the shell stored here is the build
  // that was just deployed rather than a copy the browser was still holding.
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Each file is attempted on its own. addAll rejects on the first missing
      // page and fails the whole install — and an install that fails leaves no
      // waiting worker, so the update prompt would never appear at all.
      Promise.allSettled(SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' }))))
    )
  );
});

// The page asks for the swap when the user accepts the update.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE && key.startsWith('pentix-shell-'))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** Vite emits content-hashed files under <root>assets/, so their bytes never change. */
const isHashedAsset = (url) => url.pathname.startsWith(at('assets/'));

/**
 * Every read goes through this build's own cache. `caches.match` searches all
 * of them, which is how an offline launch could be answered from a previous
 * build's storage while this one was still installing.
 */
async function cached(request) {
  const cache = await caches.open(CACHE);
  return cache.match(request);
}

async function remember(request, response) {
  const cache = await caches.open(CACHE);
  await cache.put(request, response);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Navigations go to the network first, and are stored under the URL that was
  // actually asked for. Storing every navigation as index.html let a single
  // visit to the manual replace the app shell with the manual page.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) remember(request, response.clone()).catch(() => {});
          return response;
        } catch {
          return (
            (await cached(request)) ||
            (await cached(at('index.html'))) ||
            (await cached(at(''))) ||
            Response.error()
          );
        }
      })()
    );
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  const fontRequest = /fonts\.(googleapis|gstatic)\.com/.test(url.hostname);
  if (!sameOrigin && !fontRequest) return;

  if (sameOrigin && isHashedAsset(url)) {
    event.respondWith(
      (async () => {
        const hit = await cached(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) remember(request, response.clone()).catch(() => {});
        return response;
      })()
    );
    return;
  }

  // The manual is a one-off download, not part of the shell: leaving it out of
  // the cache keeps 2 MB of PDF out of the user's storage for good.
  if (sameOrigin && url.pathname.endsWith('.pdf')) return;

  // Manifest, icon and fonts keep their URL across deploys, so they are served
  // from cache but refreshed in the background: fast, and current next load.
  event.respondWith(
    (async () => {
      const hit = await cached(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) remember(request, response.clone()).catch(() => {});
          return response;
        })
        .catch(() => hit);
      return hit || network;
    })()
  );
});
