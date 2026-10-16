"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Whether this is the installed app. The head script in app/layout.tsx marks
 * <html data-standalone> before first paint; this reads that mark. Server
 * snapshot `true` keeps the curtain in the server HTML — the head script's
 * CSS hides it in a browser tab before anyone sees a frame of it.
 */
const useStandalone = () =>
  useSyncExternalStore(
    () => () => {},
    () => "standalone" in document.documentElement.dataset,
    () => true,
  );

/**
 * The installed app's opening: the mark, held long enough to be read, then
 * the curtain lifts while the page settles in behind it.
 *
 * Its own component, owning its own timing. It used to be state in the page,
 * set from an effect — the lint error that pattern earns, and one more thing
 * a 518-line page had to juggle.
 */
export default function LaunchCurtain() {
  const standalone = useStandalone();
  const [phase, setPhase] = useState<"shown" | "leaving" | "gone">("shown");

  useEffect(() => {
    if (!standalone) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem("hymnal-splash") !== null;
      sessionStorage.setItem("hymnal-splash", "1");
    } catch {
      // Storage can be refused; the curtain just plays its full timing.
    }
    // A first launch this session holds the mark about a second and a half;
    // coming back from the privacy page skips the ceremony.
    const hold = seen ? 0 : 1350;
    const leave = setTimeout(() => {
      document.documentElement.dataset.lifted = "";
      setPhase("leaving");
    }, hold);
    const gone = setTimeout(() => setPhase("gone"), hold + 700);
    return () => {
      clearTimeout(leave);
      clearTimeout(gone);
    };
  }, [standalone]);

  if (!standalone || phase === "gone") return null;

  return (
    <div id="splash" aria-hidden="true" className={phase === "leaving" ? "splash-leaving" : ""}>
      <div className="splash-mark">
        <span className="splash-tile">
          {/* eslint-disable-next-line @next/next/no-img-element -- painted before
              hydration; the image pipeline is exactly what it must not wait for. */}
          <img src="/icons/tile-256.png" alt="" width={256} height={256} />
        </span>
        <p className="splash-title">
          A Collection of Hymns
          <br />
          and Sacred Songs
          <small>Old German Baptist Brethren Church</small>
        </p>
        <span className="splash-rule" />
      </div>
    </div>
  );
}
