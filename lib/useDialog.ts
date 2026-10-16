"use client";

import { useEffect, useRef } from "react";

/**
 * Focus behaviour for a layer that covers the page: focus moves in when it
 * opens and Tab stays inside it.
 *
 * Returning focus to whatever opened the layer is not done here. Recording the
 * opener in an effect is too late — a search box that focuses itself runs its
 * own effect first, so the "opener" became the search box. lib/layers.ts
 * records it at the moment the layer is opened instead.
 */
export function useDialog<T extends HTMLElement>() {
  const panel = useRef<T>(null);

  useEffect(() => {
    const node = panel.current;
    if (!node) return;

    // Anything disabled or hidden is not a stop.
    const focusable = () =>
      [
        ...node.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => el.offsetParent !== null || el === document.activeElement);

    // The panel itself, not its first control. On a phone the keypad opens by
    // itself at launch, and focusing its first button drew a ring around the
    // way out before anyone had touched the app. The panel carries the
    // dialog's label, so a screen reader still announces what opened.
    //
    // Don't steal focus from a field that focused itself.
    if (!node.contains(document.activeElement)) {
      node.focus({ preventScroll: true });
    }

    // Listening on the document, not the panel: when a panel swaps its own
    // content the focused control can unmount, leaving focus on <body> where
    // a panel-level listener never hears the next Tab.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const stops = focusable();
      if (stops.length === 0) {
        event.preventDefault();
        node.focus({ preventScroll: true });
        return;
      }
      const first = stops[0];
      const last = stops[stops.length - 1];
      const inside = node.contains(document.activeElement);
      const onPanel = document.activeElement === node;
      if (!inside) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && (onPanel || document.activeElement === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return panel;
}
