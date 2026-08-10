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

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

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

    // Hydration usually happens after `load` has already fired, so waiting on
    // the event would mean never registering at all. Only defer if the page is
    // genuinely still loading.
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  if (!waiting) return null;

  return (
    <button
      onClick={() => {
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
