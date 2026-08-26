"use client";

import { useEffect, useRef } from "react";

/**
 * Focus behaviour for a layer that covers the page.
 *
 * All four overlays — the keypad, search, the drawer and the tune sheet — used
 * to leave focus wherever it was. Tab then walked out of the open panel and
 * into the dimmed page behind it, which is unreachable by pointer and, for the
 * tune sheet, formally hidden by `aria-modal`. On a phone the keypad is the
 * *default* open state, so this was the first thing a keyboard or screen-reader
 * user met.
 *
 * Returns a ref to put on the panel. While it is mounted, focus moves in, stays
 * in, and returns to whatever opened it on the way out.
 */
export function useDialog<T extends HTMLElement>(active = true) {
  const panel = useRef<T>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!active) return;
    const node = panel.current;
    if (!node) return;

    opener.current = document.activeElement;

    // Anything disabled or hidden is not a stop. Missing that is what let Tab
    // escape the drawer whenever its last control happened to be disabled.
    const focusable = () =>
      [
        ...node.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => el.offsetParent !== null || el === document.activeElement);

    // The panel itself, not its first control. On a phone the keypad is the
    // *default* open state, so focusing the first button drew a focus ring on
    // the close grip before anyone had touched the app — it looked like it had
    // already been used, and the one thing highlighted on arrival was the way
    // out. The container carries the dialog's label, so a screen reader still
    // announces what opened; Tab moves from here into the keys.
    //
    // Don't steal focus from a field that autofocused itself.
    if (!node.contains(document.activeElement)) {
      node.focus({ preventScroll: true });
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const stops = focusable();
      if (stops.length === 0) {
        event.preventDefault();
        return;
      }
      const first = stops[0];
      const last = stops[stops.length - 1];
      // Tab forward off the container falls into the first control by itself.
      // Shift-Tab off it would walk backwards out of the panel, so wrap.
      const onPanel = document.activeElement === node;
      if (event.shiftKey && (onPanel || document.activeElement === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      // Back to the control that opened this, so the next Tab carries on from
      // where the user was rather than restarting at the top of the document.
      const back = opener.current;
      if (back instanceof HTMLElement && document.body.contains(back)) {
        back.focus({ preventScroll: true });
      }
    };
  }, [active]);

  return panel;
}
