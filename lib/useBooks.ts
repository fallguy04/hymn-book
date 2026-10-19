"use client";

import { useSyncExternalStore } from "react";
import { getBooksVersion, listHymnals, subscribeBooks } from "./hymnals";

/**
 * The books, re-read when songs added in the app arrive. Components that list
 * books or count songs call this, so they redraw when More Songs grows rather
 * than showing the list they first rendered with.
 */
export function useBooks() {
  useSyncExternalStore(subscribeBooks, getBooksVersion, () => 0);
  return listHymnals();
}
