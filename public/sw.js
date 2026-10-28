/* Agora service worker — minimal app-shell + runtime cache.
 * Strategy:
 *  - HTML navigations: NetworkFirst; the cached shell is used only when the
 *    network actually fails (offline), never on a slow response. A timeout
 *    fallback served a pre-deploy shell whose asset hashes no longer existed
 *    right after a Publish, which left the page blank once (28 Oct).
 *  - Static assets (js/css/img/font): StaleWhileRevalidate.
 *  - Google Static Maps + concert-weekend pre-saved data: CacheFirst (long-lived).
 * Never use CacheFirst on HTML — that would lock devices on a stale build.
 * Bump VERSION on strategy changes so old caches are dropped on activate.
 */
const VERSION = "agora-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const MAP_CACHE = `${VERSION}-maps`;
const SHELL_URLS = ["/", "/favicon.svg", "/favicon.ico", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL_URLS).catch(() => {});
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => !n.startsWith(VERSION))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function isStaticAsset(url) {
  return /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico|gif)$/i.test(
    url.pathname,
  );
}

function isMapTile(url) {
  return (
    url.hostname === "maps.googleapis.com" &&
    url.pathname.startsWith("/maps/api/staticmap")
  );
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const network = await fetch(request);
    if (network && network.ok) cache.put(request, network.clone()).catch(() => {});
    return network;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const shell = await cache.match("/");
    if (shell) return shell;
    throw new Error("offline");
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Never cache API / server functions / auth / lovable internals.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_server") ||
    url.pathname.startsWith("/_serverFn") ||
    url.pathname.startsWith("/~oauth") ||
    url.pathname.startsWith("/lovable/")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  if (url.origin === self.location.origin && isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
    return;
  }

  if (isMapTile(url)) {
    event.respondWith(cacheFirst(request, MAP_CACHE));
    return;
  }
});
