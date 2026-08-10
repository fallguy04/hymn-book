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

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");

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
