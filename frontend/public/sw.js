/* RescueRank offline support: cache the app shell and last successful read data. */
const CACHE_NAME = "rescuerank-shell-v1";
const DATA_CACHE = "rescuerank-data-v1";
const SHELL_ROUTES = ["/", "/field", "/priorities", "/resources", "/reports", "/offline.html", "/manifest.json"];

function normalizedRoute(requestUrl) {
  const url = new URL(requestUrl);
  return new Request(`${url.origin}${url.pathname}`);
}

function offlineDataKey(pathname) {
  const name = pathname.endsWith("/priorities") ? "priorities" : "resources";
  return new Request(`${self.location.origin}/__offline__/${name}`);
}

async function cacheShellRoute(cache, path) {
  try {
    const response = await fetch(path, { cache: "reload" });
    if (!response.ok) return;
    const html = await response.clone().text();
    await cache.put(path, response);
    const assets = [...html.matchAll(/(?:src|href)="([^"]*_next\/static\/[^"]+)"/g)]
      .map((match) => new URL(match[1], self.location.origin).href);
    await Promise.all(assets.map(async (asset) => {
      try {
        const assetResponse = await fetch(asset);
        if (assetResponse.ok) await cache.put(asset, assetResponse);
      } catch { /* Optional route chunks may be loaded on demand later. */ }
    }));
  } catch { /* A route can fail to pre-cache without blocking service-worker install. */ }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(SHELL_ROUTES.map((route) => cacheShellRoute(cache, route)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("rescuerank-") && ![CACHE_NAME, DATA_CACHE].includes(name))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname === "/api/v1/priorities" || url.pathname === "/api/v1/resources") {
    event.respondWith((async () => {
      const cache = await caches.open(DATA_CACHE);
      const canonical = offlineDataKey(url.pathname);
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
          await cache.put(canonical, response.clone());
          return response;
        }
        return (await cache.match(canonical)) || response;
      } catch {
        const cached = await cache.match(request) || await cache.match(canonical);
        return cached || Response.json({ detail: "Offline and no cached data is available yet." }, { status: 503 });
      }
    })());
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const routeKey = normalizedRoute(request.url);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(routeKey, response.clone());
        return response;
      } catch {
        return (await cache.match(routeKey)) || (await cache.match("/offline.html")) || Response.error();
      }
    })());
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || Response.error();
      }
    })());
  }
});
