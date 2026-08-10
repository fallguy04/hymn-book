"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, X } from "lucide-react";
import { useHymnalStore } from "@/store/useHymnalStore";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Whether the app is already running as an installed PWA. Read through
 * useSyncExternalStore rather than an effect: it is browser state we subscribe
 * to, and the server snapshot keeps the card hidden until we actually know.
 */
function useIsInstalled(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia("(display-mode: standalone)");
      media.addEventListener("change", onChange);
      window.addEventListener("appinstalled", onChange);
      return () => {
        media.removeEventListener("change", onChange);
        window.removeEventListener("appinstalled", onChange);
      };
    },
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari reports standalone on navigator, not via the media query.
      (window.navigator as { standalone?: boolean }).standalone === true,
    () => true,
  );
}

/** iOS has no beforeinstallprompt, so it needs the Share-sheet instructions. */
function useIsIOS(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () =>
      /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent),
    () => false,
  );
}

/**
 * Android fires `beforeinstallprompt`, which we capture so the invitation can
 * live in the menu instead of as a browser infobar. iOS has no such event, so
 * it gets the Share-sheet instructions instead.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [accepted, setAccepted] = useState(false);

  const installed = useIsInstalled();
  const isIOS = useIsIOS();

  const dismissed = useHymnalStore((s) => s.installDismissed);
  const dismiss = useHymnalStore((s) => s.dismissInstall);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (installed || accepted || dismissed) return null;
  if (!deferred && !isIOS) return null;

  return (
    <div className="flex items-start gap-3 border-t border-paper-rule bg-paper-sunken px-4 py-3">
      <Download className="mt-0.5 h-4 w-4 shrink-0 text-paper-accent" />

      <div className="min-w-0 flex-1">
        <p className="font-sans text-xs font-semibold text-paper-ink">Install the hymnal</p>
        {isIOS ? (
          <p className="mt-0.5 flex flex-wrap items-center gap-1 font-sans text-[0.7rem] leading-relaxed text-paper-muted">
            Tap <Share className="inline h-3 w-3" /> then “Add to Home Screen” to use it offline.
          </p>
        ) : (
          <>
            <p className="mt-0.5 font-sans text-[0.7rem] leading-relaxed text-paper-muted">
              Keeps every hymn on your phone, with no connection needed.
            </p>
            <button
              onClick={async () => {
                await deferred!.prompt();
                const { outcome } = await deferred!.userChoice;
                if (outcome === "accepted") setAccepted(true);
                setDeferred(null);
              }}
              className="mt-2 rounded-lg bg-paper-ink px-3 py-1.5 font-sans text-[0.7rem] font-semibold text-paper transition-transform active:scale-95"
            >
              Install
            </button>
          </>
        )}
      </div>

      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="rounded p-1 text-paper-faint transition-colors hover:text-paper-ink"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
