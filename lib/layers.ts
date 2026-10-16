"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Everything that can cover the page. One at a time, by construction.
 *
 * There used to be a boolean per layer — menuOpen, tunesOpen, shareOpen and a
 * search mode — and every keyboard shortcut, Escape and guard had to list all
 * of them, so adding a layer meant six edits and forgetting one meant a digit
 * typed into an invisible keypad under a sheet. Now there is one value.
 */
export type LayerId = "keypad" | "search" | "menu" | "book" | "tunes" | "share";

export interface Layer {
  id: LayerId;
  /** A digit typed before the keypad was open, so it isn't lost. */
  seed?: string;
  /** Open the menu on Contents at this section (from the label above a title). */
  menuPath?: string[];
}

/**
 * "auto" is the moment before anyone has chosen anything: the page has just
 * loaded. The caller resolves it (to the keypad on a phone, to nothing on a
 * desktop or for someone arriving from a shared link).
 */
export type LayerState = Layer | null | "auto";

/**
 * The open layer, plus the two things every layer needs and none of them
 * should do for itself.
 *
 * Back button. Opening a layer adds a history entry, so Android's Back (and
 * the iOS edge swipe in a browser) closes the menu or a sheet instead of
 * leaving the app. Closing it any other way takes the entry back off.
 *
 * Focus. The control that opened a layer is remembered at the moment it was
 * opened and gets focus back when it closes. It used to be recorded in an
 * effect, after the search box had already taken focus — so the "opener" was
 * the search box itself, gone by the time search closed.
 */
export function useLayers() {
  const [layer, setLayer] = useState<LayerState>("auto");
  const pushed = useRef(false);
  const skipNextPop = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  /** Whether a layer opened through `open` is showing, for event handlers. */
  const showing = useRef(false);

  const open = useCallback((next: Layer) => {
    // Switching from one layer straight to another keeps the same history
    // entry and the original opener: Back from search-opened-from-the-keypad
    // returns to the page, not to the keypad.
    if (!showing.current) {
      const active = document.activeElement;
      opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
    }
    showing.current = true;
    if (!pushed.current) {
      try {
        window.history.pushState({ ...(window.history.state ?? {}), hymnalLayer: true }, "");
        pushed.current = true;
      } catch {
        // A browser that refuses history changes still gets a working layer.
      }
    }
    setLayer(next);
  }, []);

  /** Give focus back to whatever opened the layer, once the layer is gone. */
  const returnFocus = useCallback(() => {
    const back = opener.current;
    opener.current = null;
    if (back) {
      requestAnimationFrame(() => {
        if (document.body.contains(back)) back.focus({ preventScroll: true });
      });
    }
  }, []);

  const close = useCallback(() => {
    showing.current = false;
    setLayer(null);
    if (pushed.current) {
      pushed.current = false;
      skipNextPop.current = true;
      window.history.back();
    }
    returnFocus();
  }, [returnFocus]);

  useEffect(() => {
    const onPop = () => {
      if (skipNextPop.current) {
        skipNextPop.current = false;
        return;
      }
      if (!pushed.current) return;
      pushed.current = false;
      showing.current = false;
      setLayer(null);
      returnFocus();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [returnFocus]);

  return { layer, open, close };
}
