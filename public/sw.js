/**
 * Offline support for the hymnal.
 *
 * What this has to get right, each piece of which was previously wrong:
 *
 * 1. Cache names are versioned by build. The page registers this script as
 *    `/sw.js?v=<buildId>`, so a deploy changes the script URL, the browser
 *    installs a fresh worker, and `activate` drops the previous build's
 *    caches. A fixed name meant stale assets survived every deploy.
 *
 * 2. A worker is complete before it takes over. Assets used to be cached by
 *    whichever worker happened to be in control when they loaded, which after a
 *    deploy is the OLD worker, into the old worker's cache. When the new worker
 *    activated it deleted that cache, and the next launch with no signal got
 *    the new HTML with every script answering 504: no hydration, and in the
 *    installed app the launch curtain never lifted. So `install` now fetches
 *    the page, reads out every script, stylesheet and font it names, and
 *    stores all of it in this worker's own cache before it may activate.
 *
 * 3. A slow network is treated as no network. At a camp with one bar, "network
 *    first" means a blank screen until the request gives up, which can be a
 *    minute. Navigations race the network against a short timer and fall back
 *    to the cached shell; the late response, if it comes, refreshes the cache.
 *
 * 4. A failed asset request fails as an asset. Returning the HTML shell for a
 *    missing script meant the browser parsed markup as JavaScript, and the
 *    component in that chunk vanished with no error worth reading.
 *
 * 5. Background writes happen inside `event.waitUntil`. Without it the browser
 *    is free to stop the worker the moment the response is sent, abandoning a
 *    half-finished cache write.
 */

const VERSION = new URL(self.location).searchParams.get("v") || "dev";
const SHELL = `hymnal-shell-${VERSION}`;
const RUNTIME = `hymnal-runtime-${VERSION}`;

/** The app. Any navigation we can't answer from the network resolves here. */
const APP_SHELL = "/";
/** A real, separate page, so it gets its own entry rather than the hymnal. */
const PRIVACY_SHELL = "/privacy";

/** How long a navigation waits on the network before settling for the cache. */
const NAVIGATION_TIMEOUT_MS = 3000;

/**
 * Small files the page needs that its markup doesn't name in a way we scrape.
 * The tile is on the launch curtain; the manifest and icons are the install.
 */
const STATIC_FILES = [
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/tile-256.png",
];

/**
 * Vary is about content negotiation, and nothing cached here is negotiated.
 * Pages were stored under a bare "/" with no request headers, so honouring the
 * `Vary: rsc, next-router-state-tree, ...` Next puts on them would risk a
 * lookup missing for a reason that has nothing to do with the content.
 */
const MATCH = { ignoreVary: true };

const TIMED_OUT = Symbol("timed out");

/* ---------------------------------------------------------------------------
   Discovering what a page needs
--------------------------------------------------------------------------- */

/**
 * Anything under /_next/static/ named in a document, including inside the
 * escaped strings of the inline RSC payload (which stop at the backslash). A
 * trailing query is kept: it is part of the URL the browser will later ask for,
 * and the cache matches on it.
 */
const STATIC_URL = /\/_next\/static\/[^"'\\)\s<>?#]+(?:\?[^"'\\)\s<>#]*)?/g;

/** url(...) in CSS, quoted either way or not at all. */
const CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s"']+))\s*\)/g;

function toKey(href) {
  const url = new URL(href, self.location.origin);
  url.hash = "";
  return url.href;
}

/** Every /_next/static/ file a document refers to, as absolute URLs. */
function staticUrlsIn(html) {
  const found = new Set();
  for (const [match] of html.matchAll(STATIC_URL)) {
    const path = match.replaceAll("&amp;", "&");
    // The runtime config also mentions the bare directory; only files count.
    if (!/\.[A-Za-z0-9]+(?:\?|$)/.test(path)) continue;
    found.add(toKey(path));
  }
  return found;
}

/**
 * Every same-origin file a stylesheet loads, resolved against the stylesheet's
 * own URL (Next writes them relative: `url(../media/x.woff2)`). Fonts are the
 * ones that matter: without them text falls back to a system face and the
 * layout shifts under a reader who is mid-verse.
 */
function cssUrlsIn(css, cssUrl) {
  const found = new Set();
  for (const match of css.matchAll(CSS_URL)) {
    const ref = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!ref || ref.startsWith("data:") || ref.startsWith("#")) continue;
    try {
      const url = new URL(ref, cssUrl);
      if (url.origin === self.location.origin) found.add(toKey(url.href));
    } catch {
      // Not a URL we can resolve; the browser wouldn't have either.
    }
  }
  return found;
}

const isCss = (href) => new URL(href).pathname.endsWith(".css");

/* ---------------------------------------------------------------------------
   Install
--------------------------------------------------------------------------- */

/** A page for the shell. Anything but a clean HTML 200 is not a shell. */
async function fetchPage(path) {
  // no-store: the HTML names this deploy's hashed files. A copy out of the HTTP
  // cache could name last deploy's, and we would faithfully precache those.
  const response = await fetch(path, { cache: "no-store" });
  const type = response.headers.get("content-type") || "";
  if (!response.ok || response.redirected || !type.includes("text/html")) {
    throw new Error(`${path} is not a usable page (${response.status}, ${type || "no type"})`);
  }
  return response;
}

/** Fetch one file and store it. Resolves with the response so CSS can be read. */
async function cacheAsset(cache, href) {
  const response = await fetch(href);
  // Only a real file. A 404 or an error page stored under a script's URL is
  // worse than nothing.
  if (!response.ok || response.type !== "basic") {
    throw new Error(`${href} -> ${response.status}`);
  }
  await cache.put(href, response.clone());
  return response;
}

/** One retry, so a single dropped packet on a weak connection isn't a hole. */
async function cacheAssetWithRetry(cache, href) {
  try {
    return await cacheAsset(cache, href);
  } catch (first) {
    try {
      return await cacheAsset(cache, href);
    } catch {
      throw first;
    }
  }
}

/**
 * Store each file. Resolves with the URLs that the stylesheets among them refer
 * to, and with whichever files could not be stored.
 */
async function cacheAll(cache, hrefs) {
  const results = await Promise.allSettled(
    hrefs.map(async (href) => {
      const response = await cacheAssetWithRetry(cache, href);
      return isCss(href) ? cssUrlsIn(await response.text(), href) : [];
    }),
  );

  const named = new Set();
  const failed = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") for (const href of result.value) named.add(href);
    else failed.push(hrefs[i]);
  });
  return { named, failed };
}

async function precache() {
  const [shells, runtime] = await Promise.all([caches.open(SHELL), caches.open(RUNTIME)]);

  const [home, privacy] = await Promise.allSettled([fetchPage(APP_SHELL), fetchPage(PRIVACY_SHELL)]);

  // The shell is the one thing this cannot do without. Throwing here fails the
  // install, which is what we want: the previous worker, and the previous
  // build's caches it still serves from, stay in place until a later attempt
  // gets a whole shell.
  if (home.status === "rejected") throw home.reason;
  const homeHtml = await home.value.clone().text();
  await shells.put(APP_SHELL, home.value);

  // The privacy page is a courtesy. If it fails now, the next online visit to
  // it stores it (see `navigate`), and until then it falls back to the shell.
  let privacyHtml = "";
  if (privacy.status === "fulfilled") {
    privacyHtml = await privacy.value.clone().text();
    await shells.put(PRIVACY_SHELL, privacy.value);
  } else {
    console.warn(`[sw ${VERSION}] /privacy not precached:`, privacy.reason);
  }

  const wanted = new Set([
    ...staticUrlsIn(homeHtml),
    ...staticUrlsIn(privacyHtml),
    ...STATIC_FILES.map(toKey),
  ]);

  // First wave: everything the pages name. Stylesheets are read as they arrive
  // because they name the fonts, which the HTML does not.
  const firstWave = [...wanted];
  const first = await cacheAll(runtime, firstWave);

  // Second wave: what the stylesheets named, that we don't already have. (These
  // are not read in turn; fonts and images name nothing further.)
  const secondWave = [...first.named].filter((href) => !wanted.has(href));
  const second = await cacheAll(runtime, secondWave);

  // An asset that can't be fetched is not worth refusing the whole install
  // for: the fetch handler and the page's CACHE_ASSETS message fill gaps later.
  const failed = [...first.failed, ...second.failed];
  const stored = firstWave.length + secondWave.length - failed.length;
  console.info(
    `[sw ${VERSION}] precached ${privacy.status === "fulfilled" ? 2 : 1} page(s) and ${stored} files` +
      (failed.length ? `; ${failed.length} failed: ${failed.join(", ")}` : ""),
  );
}

self.addEventListener("install", (event) => {
  // Deliberately no skipWaiting() here. Taking over the moment it installs
  // beat the page to the "Update available" banner: by the time the button
  // appeared the worker had already activated, so `controllerchange` had
  // fired, and tapping it waited for an event that would never come again.
  // The new worker waits; the page decides when it takes over.
  event.waitUntil(precache());
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

/* ---------------------------------------------------------------------------
   Messages from the page
--------------------------------------------------------------------------- */

/** Store whatever of these the runtime cache doesn't have. Gaps are filled, never overwritten. */
async function cachePageAssets(urls) {
  const cache = await caches.open(RUNTIME);
  const have = new Set((await cache.keys()).map((r) => r.url));

  const missing = new Set();
  for (const raw of urls) {
    try {
      const url = new URL(raw, self.location.origin);
      if (url.origin !== self.location.origin) continue;
      // Same rules as the fetch handler: the API is never cached, and an RSC
      // payload fetched here without its headers would come back as HTML.
      if (url.pathname.startsWith("/api/") || url.searchParams.has("_rsc")) continue;
      const key = toKey(url.href);
      if (!have.has(key)) missing.add(key);
    } catch {
      // Ignore anything that isn't a URL.
    }
  }

  await Promise.allSettled([...missing].map((href) => cacheAsset(cache, href)));
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  // The page sends every same-origin URL it actually loaded. With a complete
  // precache this is a safety net, not the mechanism: it catches a file the
  // install missed, or a lazily-loaded chunk reached after the worker took over.
  if (data?.type === "CACHE_ASSETS" && Array.isArray(data.urls)) {
    event.waitUntil(cachePageAssets(data.urls));
  }
});

/* ---------------------------------------------------------------------------
   Fetching
--------------------------------------------------------------------------- */

/** Which stored page, if any, answers for this path. */
function shellKey(url) {
  if (url.pathname === "/") return APP_SHELL;
  if (url.pathname === "/privacy" || url.pathname === "/privacy/") return PRIVACY_SHELL;
  return null;
}

/**
 * Whether a navigation response is a whole page worth keeping as the shell.
 * Storing every navigation meant one visit to a 404, or a single transient
 * 5xx, became the app you got offline until the next good load.
 */
function isStorablePage(response) {
  return (
    response.ok &&
    response.type === "basic" &&
    !response.redirected &&
    (response.headers.get("content-type") || "").includes("text/html")
  );
}

/** The stored page for this key, or the hymnal if there is none. */
async function cachedShell(key) {
  const shells = await caches.open(SHELL);
  return (
    (key && (await shells.match(key, MATCH))) || (await shells.match(APP_SHELL, MATCH)) || null
  );
}

function raceTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(resolve, ms, TIMED_OUT);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Network, but not for long. A deploy is picked up whenever the network answers
 * in time; when it doesn't, the shell is shown now and the page is refreshed
 * underneath it once the response lands, so the next launch is current.
 */
async function navigate(event, request, url) {
  const key = shellKey(url);

  const attempt = fetch(request).then(
    (response) => ({
      response,
      // Cloned before anything reads the body, and only if it would be kept.
      copy: key && isStorablePage(response) ? response.clone() : null,
    }),
    () => ({ response: null, copy: null }),
  );

  // Registered up front, outside the race: the worker has to stay alive for a
  // response that arrives after we've already answered from the cache.
  event.waitUntil(
    attempt.then(async ({ copy }) => {
      if (!copy) return;
      try {
        const shells = await caches.open(SHELL);
        await shells.put(key, copy);
      } catch {
        // A failed refresh leaves the previous shell, which is still a shell.
      }
    }),
  );

  const first = await raceTimeout(attempt, NAVIGATION_TIMEOUT_MS);
  const live = first === TIMED_OUT ? null : first.response;

  // A 5xx is the server being down, which is not worth showing over a cached
  // copy of the working app. Anything else — including a 404 page — is an
  // answer, and the one the user asked for.
  if (live && live.status < 500) return live;

  const cached = await cachedShell(key);
  if (cached) return cached;

  // Nothing stored to fall back on (cache evicted, or this is the very first
  // load), so the slow network is the only option left. Keep waiting for it.
  const settled = first === TIMED_OUT ? (await attempt).response : live;
  return settled ?? Response.error();
}

/**
 * Everything that isn't a page. Build output is content-hashed — the name
 * changes when the bytes do — so a cached copy is always right and is served
 * without asking. The rest is stale-while-revalidate: instant from cache,
 * refreshed behind it so an online visit quietly picks up a change.
 */
async function respondWithAsset(event, request, url) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(request, MATCH);

  if (hit && url.pathname.startsWith("/_next/static/")) return hit;

  const update = fetch(request).then(
    (response) => ({
      response,
      write:
        response.ok && response.type === "basic"
          ? cache.put(request, response.clone()).catch(() => {})
          : null,
    }),
    () => ({ response: null, write: null }),
  );

  // The write outlives the response, so it has to be held open explicitly.
  event.waitUntil(update.then(({ write }) => write));

  if (hit) return hit;

  const { response } = await update;
  if (response) return response;

  // Offline and genuinely absent. Fail as what was asked for — handing back
  // HTML here is what made a missing chunk look like a missing feature instead
  // of a network error.
  return new Response("", { status: 504, statusText: "Offline and not cached" });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API calls are never cached. /api/version exists to tell the page whether it
  // is running the build that is actually deployed; answering that from cache
  // would have it confirm, forever, that the stale build is current.
  if (url.pathname.startsWith("/api/")) return;

  // A partial response can't be stored, and an audio or video range is not
  // something this app asks for. Leave it to the network.
  if (request.headers.has("range")) return;

  if (request.mode === "navigate") {
    event.respondWith(navigate(event, request, url));
    return;
  }

  event.respondWith(respondWithAsset(event, request, url));
});
