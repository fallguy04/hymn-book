"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useHymnalStore } from "@/store/useHymnalStore";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Android fires `beforeinstallprompt`, which we capture so the invitation can
 * live in the menu instead of as a browser infobar. iOS has no such event, so
 * it gets the Share-sheet instructions instead.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(true);

  const dismissed = useHymnalStore((s) => s.installDismissed);
  const dismiss = useHymnalStore((s) => s.dismissInstall);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari reports standalone on navigator, not via the media query.
      (window.navigator as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    setIsIOS(
      /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent),
    );

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || dismissed) return null;
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
                if (outcome === "accepted") setInstalled(true);
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
