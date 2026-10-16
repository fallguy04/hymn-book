"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { startInstallCapture } from "@/lib/install";

/** The build this page was served as. The same fallback the worker URL and /api/version use. */
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

const DISMISS_KEY = "hymnal-update-dismissed";

/** Whether the pill was put away earlier in this session. Storage can be blocked; then it simply isn't remembered. */
function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** The build a worker was registered for, which is the `v` in its script URL. */
function buildOf(worker: ServiceWorker): string | null {
  try {
    return new URL(worker.scriptURL).searchParams.get("v");
  } catch {
    return null;
  }
}

/**
 * Registers the service worker, and tells the reader only when the page they
 * are looking at is genuinely out of date.
 *
 * Most of the time a waiting worker is not news. After a deploy the old worker
 * serves the new HTML (network first), so the page is already the new build by
 * the time the new worker finishes installing; all that is left is for that
 * worker to take over, which it can do silently. The pill is for the page that
 * really is behind: one resumed from the app switcher weeks later, or one a
 * deploy has overtaken. Even then it only offers; reloading under a song
 * leader mid-verse would be worse than showing yesterday's build a while longer.
 */
export default function ServiceWorker() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  /** The server reports a different build than this page is running. */
  const [staleBuild, setStaleBuild] = useState(false);
  /** A worker for some other build is waiting. */
  const [staleWorker, setStaleWorker] = useState(false);
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    // Before the production check: the capture is harmless anywhere, and the
    // earlier it is listening the less likely the one-shot event is missed.
    startInstallCapture();

    if (process.env.NODE_ENV !== "production") return;

    let cancelled = false;

    /**
     * Hand the worker every same-origin asset this page actually loaded. The
     * worker precaches the build itself at install; this is the safety net for
     * a file that install missed, or one reached only after it took over.
     */
    const cacheLoadedAssets = () => {
      const loaded = performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((name) => name.startsWith(location.origin) && !name.includes("/api/"));

      // Some chunks are named in the document but never fetched on this
      // route — a lazily-loaded component, a prefetch the browser skipped.
      // They are exactly the ones that go missing offline, so scrape the
      // markup for them rather than relying on what was requested.
      const referenced = [...document.documentElement.innerHTML.matchAll(/\/_next\/static\/[^"'\\)\s]+?\.(?:js|css)/g)]
        .map((match) => new URL(match[0], location.origin).href);

      const urls = [...new Set([...loaded, ...referenced])];
      navigator.serviceWorker.controller?.postMessage({ type: "CACHE_ASSETS", urls });
    };

    /**
     * A worker has finished installing and is waiting for the old one to let go.
     * If it is for the build this page already is, there is nothing to ask: tell
     * it to take over now, quietly, with no reload. If it is for another build,
     * this page is behind and the reader gets the choice.
     */
    const onWaiting = (worker: ServiceWorker) => {
      if (buildOf(worker) === BUILD_ID) {
        try {
          worker.postMessage({ type: "SKIP_WAITING" });
        } catch {
          // It will take over when the app is next closed, which is fine.
        }
      } else if (!cancelled) {
        setStaleWorker(true);
      }
    };

    const watched = new WeakSet<ServiceWorker>();
    const watch = (worker: ServiceWorker | null) => {
      if (!worker || watched.has(worker)) return;
      watched.add(worker);

      const check = () => {
        // Only a worker queued behind another is "waiting". On a first visit
        // there is no controller: it just activates, and there is nothing to ask.
        if (worker.state === "installed" && navigator.serviceWorker.controller) onWaiting(worker);
      };
      worker.addEventListener("statechange", check);
      check();
    };

    const register = async () => {
      try {
        // The version in the URL is what lets a deploy replace the worker and
        // retire the previous build's caches.
        const registration = await navigator.serviceWorker.register(`/sw.js?v=${BUILD_ID}`);
        registrationRef.current = registration;

        // Listen before awaiting anything else. `updatefound` is queued the
        // moment register() resolves, and a listener added after `ready` could
        // miss it, leaving the new worker waiting with nobody the wiser.
        registration.addEventListener("updatefound", () => watch(registration.installing));
        watch(registration.installing);
        if (registration.waiting) onWaiting(registration.waiting);

        await navigator.serviceWorker.ready;
        cacheLoadedAssets();
        // On a first visit the worker only starts controlling after it claims
        // the page, which is usually after the assets have already loaded.
        navigator.serviceWorker.addEventListener("controllerchange", cacheLoadedAssets);
      } catch {
        // Offline support is a bonus; failing to register is not fatal.
      }
    };

    /**
     * Ask the server which build is live and compare it to the one this page
     * was served as. This is the check that catches the case the worker cannot:
     * an installed PWA resumed from the app switcher never navigates, so it
     * never fetches new HTML, never registers a new worker, and sits happily on
     * a build from weeks ago. Nothing goes wrong — it just quietly stops being
     * the app you deployed.
     */
    const checkForNewBuild = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/version", { cache: "no-store" });
        if (!response.ok) return;
        const { buildId } = await response.json();
        // Compare against the same fallback the route and the register URL
        // use, or an unset build id shows a refresh pill that never clears.
        if (buildId && buildId !== BUILD_ID && !cancelled) setStaleBuild(true);
      } catch {
        // Offline, most likely. The build we have is the one we can run.
      }
    };

    // Every return to the app is a chance to notice a deploy — that is exactly
    // when a resumed PWA has been away long enough for one to have happened.
    document.addEventListener("visibilitychange", checkForNewBuild);
    checkForNewBuild();

    const start = () => {
      if ("serviceWorker" in navigator) register();
    };

    // Hydration usually happens after `load` has already fired, so waiting on
    // the event would mean never registering at all. Only defer if the page is
    // genuinely still loading.
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", checkForNewBuild);
      window.removeEventListener("load", start);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("controllerchange", cacheLoadedAssets);
      }
    };
  }, []);

  const refresh = async () => {
    // Read the registration now, not what it was when the pill appeared: a
    // worker can have arrived (or been replaced) since.
    let waiting: ServiceWorker | null = null;
    try {
      const registration =
        registrationRef.current ?? (await navigator.serviceWorker.getRegistration());
      waiting = registration?.waiting ?? null;
    } catch {
      // No worker support, or none registered: a plain reload it is.
    }

    // A stale page with nothing waiting — the resumed-PWA case — only needs the
    // reload. The reload fetches the new HTML, and registers the new worker.
    if (!waiting) {
      location.reload();
      return;
    }

    // A waiting worker has to be told to take over first, or the reload just
    // serves the same old build again.
    let reloaded = false;
    const reload = () => {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", reload, { once: true });
    try {
      waiting.postMessage({ type: "SKIP_WAITING" });
    } catch {
      reload();
      return;
    }
    // If the hand-over never announces itself, the reader still asked to refresh.
    setTimeout(reload, 4000);
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Dismissed for now, back next launch. Acceptable.
    }
  };

  if (!(staleBuild || staleWorker) || dismissed) return null;

  return (
    <div
      role="status"
      // Below the 56px top bar, clear of the notch, and out of the way of the
      // "Find a hymn" button and the keypad at the bottom.
      style={{ top: "calc(env(safe-area-inset-top) + 64px)" }}
      className="fixed left-1/2 z-[60] flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center rounded-full bg-paper-ink font-sans text-paper shadow-lg"
    >
      <button
        onClick={refresh}
        className="flex min-h-11 items-center gap-2 py-2 pr-2 pl-4 text-xs font-semibold"
      >
        <RefreshCw className="h-3.5 w-3.5 shrink-0" />
        Update available — tap to refresh
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
