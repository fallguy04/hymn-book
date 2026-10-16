"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { promptInstall, useInstallState } from "@/lib/install";
import { useHymnalStore } from "@/store/useHymnalStore";

/**
 * Inviting people to keep the hymnal on their phone.
 *
 * Android only offers installation through an event fired once, shortly after
 * the page loads. It used to be listened for inside the menu drawer — which
 * nobody has open at page load — so Android visitors were almost never asked.
 * lib/install.ts now catches it at start-up; these two components only show
 * what it caught.
 */

/** iPhone has no install button to press; it needs the two steps spelled out. */
function IosSteps() {
  return (
    <p className="font-sans text-[0.85rem] leading-relaxed text-paper-muted">
      Tap <Share className="inline h-4 w-4 -translate-y-px" aria-label="Share" /> at the bottom of
      Safari, then <b className="font-semibold text-paper-ink">Add to Home Screen</b>. Open it once
      while you have signal, and it works without any after that.
    </p>
  );
}

/**
 * A quiet card on the reading page, shown once someone has come back (or
 * arrived from a shared link), after they've had a few seconds to read.
 * Dismissed for good with ×; Settings keeps a way in.
 */
export function InstallCard({ eligible }: { eligible: boolean }) {
  const { platform, installed, canPrompt } = useInstallState();
  const dismissed = useHymnalStore((s) => s.installDismissed);
  const dismiss = useHymnalStore((s) => s.dismissInstall);
  const [ready, setReady] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  const offerable = !installed && !dismissed && (canPrompt || platform === "ios");

  useEffect(() => {
    if (!eligible || !offerable) return;
    const timer = setTimeout(() => setReady(true), 6000);
    return () => clearTimeout(timer);
  }, [eligible, offerable]);

  if (!ready || !offerable) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
      <div
        role="region"
        aria-label="Install the hymnal"
        className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-paper-rule bg-paper-raised p-4 shadow-xl"
      >
        <Download className="mt-0.5 h-5 w-5 shrink-0 text-paper-accent" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-serif text-[1.05rem] leading-snug text-paper-ink">Keep the hymnal on your phone</p>
          {showSteps ? (
            <IosSteps />
          ) : (
            <p className="font-sans text-[0.85rem] leading-snug text-paper-muted">
              One tap to open, and it works with no signal.
            </p>
          )}
          {!showSteps && (
            <button
              type="button"
              onClick={async () => {
                if (platform === "ios") {
                  setShowSteps(true);
                  return;
                }
                const outcome = await promptInstall();
                if (outcome !== "unavailable") dismiss();
              }}
              className="min-h-11 rounded-full bg-paper-ink px-5 font-sans text-sm font-semibold text-paper transition-transform active:scale-95"
            >
              {platform === "ios" ? "Show me how" : "Install"}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="No thanks"
          className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-paper-faint transition-colors hover:text-paper-ink"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

/** The permanent way in, in Settings. Hidden once installed or where impossible. */
export function InstallRow() {
  const { platform, installed, canPrompt } = useInstallState();
  const [showSteps, setShowSteps] = useState(false);

  if (installed || (!canPrompt && platform !== "ios")) return null;

  return (
    <div className="space-y-2 rounded-2xl bg-paper-sunken p-4">
      <p className="font-serif text-[1.05rem] text-paper-ink">Install this app</p>
      {showSteps ? (
        <IosSteps />
      ) : (
        <>
          <p className="font-sans text-[0.85rem] leading-snug text-paper-muted">
            Puts the hymnal on your home screen. It works with no signal.
          </p>
          <button
            type="button"
            onClick={() => (platform === "ios" ? setShowSteps(true) : void promptInstall())}
            className="min-h-11 rounded-full bg-paper-ink px-5 font-sans text-sm font-semibold text-paper transition-transform active:scale-95"
          >
            {platform === "ios" ? "Show me how" : "Install"}
          </button>
        </>
      )}
    </div>
  );
}
