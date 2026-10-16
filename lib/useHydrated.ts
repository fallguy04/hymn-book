"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False for the server render and the hydration render that must match it;
 * true from then on.
 *
 * The persisted store answers with its defaults until hydration finishes, so
 * anything that writes to the document from store values (the theme, the
 * title) waits for this rather than writing the defaults over what the head
 * script already set.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
