"use client";

import { useSyncExternalStore } from "react";

/** Where the phone layout gives way to the two-column reading layout. */
const DESKTOP = "(min-width: 1024px)";

/**
 * Whether this is a desktop-sized viewport, or `null` before we know.
 *
 * Read through `useSyncExternalStore` rather than an effect so it never
 * triggers a cascading render. The server snapshot is deliberately `null`:
 * prerendered HTML can't know the viewport, and callers use that to hold back
 * anything whose position would otherwise jump once the real answer arrives.
 */
export function useIsDesktop(): boolean | null {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(DESKTOP);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => null,
  );
}
