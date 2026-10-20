"use client";

import { createContext, useCallback, useEffect, useRef, useState } from "react";

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
 * What a layer's panel needs to know to leave properly, handed down by context
 * so none of the six layers needs a prop for it.
 *
 * `leaving`: the layer has been asked to close and should animate out, still
 * mounted. `gone`: it has finished and is off the screen; unmount it now.
 */
export interface LayerMotionValue {
  leaving: boolean;
  gone: () => void;
}

export const LayerMotion = createContext<LayerMotionValue>({ leaving: false, gone: () => {} });

/**
 * The open layer, plus the things every layer needs and none of them should do
 * for itself.
 *
 * Closing is two steps, because a sheet that vanishes is not a sheet that went
 * somewhere. `close()` marks the layer as `leaving` and takes the history
 * entry back off, but leaves the layer mounted; its panel (components/ui/
 * Overlay) animates out from wherever it is and then calls `gone()`, which
 * clears the layer and gives focus back. Opening anything while a layer is
 * leaving replaces it at once, with no exit.
 *
 * (Mounting the layer until it has left is done by hand rather than with
 * AnimatePresence, which under the React Compiler never unmounts it.)
 *
 * Back button. Opening a layer adds a history entry, so Android's Back (and
 * the iOS edge swipe in a browser) closes the menu or a sheet instead of
 * leaving the app. Closing it any other way takes the entry back off.
 *
 * Focus. The control that opened a layer is remembered at the moment it was
 * opened and gets focus back when the layer is gone. It used to be recorded in
 * an effect, after the search box had already taken focus — so the "opener"
 * was the search box itself, gone by the time search closed.
 */
export function useLayers() {
  const [layer, setLayer] = useState<LayerState>("auto");
  const [leaving, setLeaving] = useState(false);
  /** The layer, for event handlers that must not read a stale render. */
  const current = useRef<LayerState>("auto");
  const pushed = useRef(false);
  const skipNextPop = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  /** Whether a layer opened through `open` is showing, for event handlers. */
  const showing = useRef(false);
  /** Whether the layer has been asked to leave: a second ask does nothing. */
  const closing = useRef(false);

  const show = useCallback((next: LayerState) => {
    current.current = next;
    setLayer(next);
  }, []);

  const open = useCallback(
    (next: Layer) => {
      // Switching from one layer straight to another keeps the same history
      // entry and the original opener: Back from search-opened-from-the-keypad
      // returns to the page, not to the keypad. A layer on its way out has
      // kept its opener too; the control with focus now is inside it.
      if (!showing.current && !closing.current) {
        const active = document.activeElement;
        opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
      }
      showing.current = true;
      closing.current = false;
      setLeaving(false);
      if (!pushed.current) {
        try {
          window.history.pushState({ ...(window.history.state ?? {}), hymnalLayer: true }, "");
          pushed.current = true;
        } catch {
          // A browser that refuses history changes still gets a working layer.
        }
      }
      show(next);
    },
    [show],
  );

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

  /** Ask the layer to leave. Does nothing if nothing is open or it already is leaving. */
  const close = useCallback(() => {
    if (closing.current || current.current === null) return;
    closing.current = true;
    showing.current = false;
    setLeaving(true);
    if (pushed.current) {
      pushed.current = false;
      skipNextPop.current = true;
      window.history.back();
    }
  }, []);

  /** The layer's panel has finished leaving: take it away. */
  const gone = useCallback(() => {
    // Only a layer that was asked to leave can be finished. A panel that was
    // replaced (and so unmounted) must not take its successor with it.
    if (!closing.current) return;
    closing.current = false;
    setLeaving(false);
    show(null);
    returnFocus();
  }, [show, returnFocus]);

  useEffect(() => {
    const onPop = () => {
      if (skipNextPop.current) {
        skipNextPop.current = false;
        return;
      }
      if (!pushed.current) return;
      pushed.current = false;
      showing.current = false;
      // Back is a close like any other: the layer leaves, then goes.
      if (closing.current || current.current === null) return;
      closing.current = true;
      setLeaving(true);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return { layer, leaving, open, close, gone };
}
