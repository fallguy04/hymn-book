"use client";

import { forwardRef, type ReactNode } from "react";
import { type Hymn, type Hymnal, isNumbered } from "@/lib/hymnals";
import { primaryName, secondaryName } from "@/lib/books";

interface HymnRowProps {
  book: Hymnal;
  hymn: Hymn;
  onSelect: () => void;
  /** The hymn on screen right now: marked, so you can see where you are. */
  current?: boolean;
  /** Indents a row that sits under an expandable heading. */
  nested?: boolean;
  /** Something beside the row, like a star — a sibling, never nested inside. */
  trailing?: ReactNode;
}

/**
 * One hymn in a list: Contents, Authors, Favorites.
 *
 * Three copies of this used to drift apart in padding and size, and two of
 * them printed numbers for the book whose numbers are only internal ids, so
 * its Contents read 1, 20, 21, 2, 3. Numbers show only where they mean
 * something. The first line leads, because that is how people know a hymn.
 */
const HymnRow = forwardRef<HTMLButtonElement, HymnRowProps>(function HymnRow(
  { book, hymn, onSelect, current = false, nested = false, trailing },
  ref,
) {
  const label = secondaryName(book, hymn);
  return (
    <li className="flex items-center gap-1">
      <button
        ref={ref}
        type="button"
        onClick={onSelect}
        aria-current={current ? "true" : undefined}
        className={`flex min-h-12 min-w-0 flex-1 items-baseline gap-3 rounded-xl py-2.5 pr-3 text-left transition-colors hover:bg-paper-sunken ${
          nested ? "pl-8" : "pl-3"
        } ${current ? "bg-paper-sunken" : ""}`}
      >
        {isNumbered(book) && (
          <span
            className={`w-8 shrink-0 font-sans text-[0.8rem] tabular-nums ${
              current ? "font-semibold text-paper-accent" : "text-paper-faint"
            }`}
          >
            {hymn.number}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-[1.02rem] leading-snug text-paper-ink">
            {primaryName(book, hymn)}
          </span>
          {label && (
            <span className="mt-0.5 block font-sans text-[0.75rem] leading-snug text-paper-faint">
              {label}
            </span>
          )}
        </span>
      </button>
      {trailing}
    </li>
  );
});

export default HymnRow;
