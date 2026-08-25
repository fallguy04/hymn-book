/**
 * Offline support for the hymnal.
 *
 * Three things this has to get right, each of which it previously got wrong:
 *
 * 1. Cache names are versioned by build. The page registers this script as
 *    `/sw.js?v=<buildId>`, so a deploy changes the script URL, the browser
 *    installs a fresh worker, and `activate` drops the previous build's
 *    caches. A fixed name meant stale assets survived every deploy.
 *
 * 2. The precache list is discovered, not hand-written. Listing four files by
 *    hand left most of the app uncached, so anything not touched during an
 *    online session — a lazily-loaded chunk, a route you hadn't opened — was
 *    simply absent offline. The page reports the assets it actually loaded
 *    (see CACHE_ASSETS below) and those get stored.
 *
 * 3. A failed asset request fails as an asset. Returning the HTML shell for a
 *    missing script meant the browser parsed markup as JavaScript, and the
 *    component in that chunk vanished with no error worth reading.
 */

const VERSION = new URL(self.location).searchParams.get("v") || "dev";
const SHELL = `hymnal-shell-${VERSION}`;
const RUNTIME = `hymnal-runtime-${VERSION}`;

/** Navigation always resolves here; Next serves the app from the root route. */
const APP_SHELL = "/";

const PRECACHE = [APP_SHELL, "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  // Deliberately no skipWaiting() here. Taking over the moment it installs
  // beat the page to the "Update available" banner: by the time the button
  // appeared the worker had already activated, so `controllerchange` had
  // fired, and tapping it waited for an event that would never come again.
  // The new worker waits; the banner is what activates it.
  event.waitUntil(
    caches
      .open(SHELL)
      // Individually, so one 404 can't fail the whole install.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url)))),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  // The page sends every same-origin URL it actually loaded. Storing those
  // guarantees a reload offline has the whole app, not just the parts that
  // happened to be requested while a cache-filling fetch was in flight.
  if (data?.type === "CACHE_ASSETS" && Array.isArray(data.urls)) {
    event.waitUntil(
      caches.open(RUNTIME).then(async (cache) => {
        const already = new Set((await cache.keys()).map((r) => r.url));
        const missing = data.urls.filter((url) => !already.has(url));
        await Promise.allSettled(missing.map((url) => cache.add(url)));
      }),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API calls are never cached. /api/version exists to tell the page whether it
  // is running the build that is actually deployed; answering that from cache
  // would have it confirm, forever, that the stale build is current.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: try the network so a deploy is picked up, fall back to the
  // cached shell when there's nothing to reach.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only a successful load of the root is the shell. Storing every
          // navigation meant one visit to /privacy — or a single transient
          // 5xx — became the app you got offline, until the next good load.
          if (response.ok && response.type === "basic" && url.pathname === "/") {
            const copy = response.clone();
            caches.open(SHELL).then((cache) => cache.put(APP_SHELL, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(APP_SHELL)) ?? Response.error()),
    );
    return;
  }

  // Everything else is stale-while-revalidate: instant from cache, refreshed
  // in the background so an online visit quietly picks up a new build.
  event.respondWith(
    caches.open(RUNTIME).then(async (cache) => {
      const hit = await cache.match(request);

      const network = fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic") cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);

      if (hit) return hit;

      const response = await network;
      if (response) return response;

      // Offline and genuinely absent. Fail as what was asked for — handing
      // back HTML here is what made a missing chunk look like a missing
      // feature instead of a network error.
      return new Response("", { status: 504, statusText: "Offline and not cached" });
    }),
  );
});
