/**
 * Offline support for the hymnal.
 *
 * The whole corpus is well under a megabyte, so there is no reason to be clever
 * about what to keep: the app shell and the hymn data are precached outright,
 * and everything the app touches afterwards is cached as it goes. A hymnal that
 * only works with a signal is not a hymnal.
 */

const VERSION = "v3";
const SHELL = `hymnal-shell-${VERSION}`;
const RUNTIME = `hymnal-runtime-${VERSION}`;

/** Navigation always resolves here; Next serves the app from the root route. */
const APP_SHELL = "/";

const PRECACHE = [APP_SHELL, "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // Individually, so one 404 can't fail the whole install.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
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
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: try the network so a deploy is picked up, fall back to the
  // cached shell when there's nothing to reach.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put(APP_SHELL, copy));
          return response;
        })
        .catch(async () => (await caches.match(APP_SHELL)) ?? Response.error()),
    );
    return;
  }

  // Everything else — the JS bundles carrying the hymn data, fonts, icons — is
  // immutable in practice, so serve from cache and fill in on first sight.
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(RUNTIME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(APP_SHELL).then((shell) => shell ?? Response.error()));
    }),
  );
});
