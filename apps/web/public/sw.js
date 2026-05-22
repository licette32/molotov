// Molotov service worker — minimal and conservative.
// Cache-first for static assets, network-first for navigations. Never caches
// /api/* or cross-origin requests. Registered only in production.
const CACHE = "molotov-v1";
const ASSET_RE = /\.(?:js|css|woff2?|png|jpe?g|svg|ico|webp|gif|json)$/;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // same-origin only
  if (url.pathname.startsWith("/api/")) return; // never cache APIs

  const isStatic =
    url.pathname.startsWith("/_next/static/") || ASSET_RE.test(url.pathname);

  // Cache-first for immutable static assets.
  if (isStatic) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Network-first for navigations; fall back to cache or the home shell offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("/");
        }),
    );
  }
});
