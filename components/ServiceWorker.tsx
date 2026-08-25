"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Registers the service worker and, when a new one is waiting, offers a
 * refresh rather than taking one. Reloading under a song leader mid-verse
 * would be worse than showing yesterday's build for another minute.
 */
export default function ServiceWorker() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  /** A newer build is deployed than the one this page is running. */
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    /**
     * Hand the worker every same-origin asset this page actually loaded, so
     * the cache holds a complete app rather than whatever happened to be
     * fetched before the user went offline.
     */
    const cacheLoadedAssets = () => {
      const loaded = performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((name) => name.startsWith(location.origin));

      // Some chunks are named in the document but never fetched on this
      // route — a lazily-loaded component, a prefetch the browser skipped.
      // They are exactly the ones that go missing offline, so scrape the
      // markup for them rather than relying on what was requested.
      const referenced = [...document.documentElement.innerHTML.matchAll(/\/_next\/static\/[^"'\\)\s]+?\.(?:js|css)/g)]
        .map((match) => new URL(match[0], location.origin).href);

      const urls = [...new Set([location.href, ...loaded, ...referenced])];
      navigator.serviceWorker.controller?.postMessage({ type: "CACHE_ASSETS", urls });
    };

    const register = async () => {
      try {
        // The version in the URL is what lets a deploy replace the worker and
        // retire the previous build's caches.
        const registration = await navigator.serviceWorker.register(
          `/sw.js?v=${process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}`,
        );

        await navigator.serviceWorker.ready;
        cacheLoadedAssets();
        // On a first visit the worker only starts controlling after it claims
        // the page, which is usually after the assets have already loaded.
        navigator.serviceWorker.addEventListener("controllerchange", cacheLoadedAssets);

        if (registration.waiting) setWaiting(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          installing?.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(installing);
            }
          });
        });
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
        if (buildId && buildId !== (process.env.NEXT_PUBLIC_BUILD_ID ?? "dev")) setStale(true);
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
      document.removeEventListener("visibilitychange", checkForNewBuild);
      window.removeEventListener("load", start);
    };
  }, []);

  if (!waiting && !stale) return null;

  return (
    <button
      onClick={() => {
        // Two ways to be out of date, and they need different handling. A
        // waiting worker has to be told to take over first, or the reload just
        // serves the same old build again. A stale page with no waiting worker
        // — the resumed-PWA case — only needs the reload.
        if (!waiting) {
          location.reload();
          return;
        }
        waiting.postMessage({ type: "SKIP_WAITING" });
        navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), {
          once: true,
        });
      }}
      className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-paper-ink px-4 py-2.5 font-sans text-xs font-semibold text-paper shadow-lg"
    >
      <RefreshCw className="h-3.5 w-3.5" />
      Update available — tap to refresh
    </button>
  );
}
