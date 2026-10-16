"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { type Hymn, type Hymnal, isNumbered } from "@/lib/hymnals";
import { primaryName } from "@/lib/books";

interface BottomBarProps {
  hymnal: Hymnal;
  prev: Hymn | null;
  next: Hymn | null;
  /** Shows the keyboard shortcut; a phone has no keyboard to advertise. */
  shortcut: string | null;
  onPrev: () => void;
  onNext: () => void;
  onFind: () => void;
}

/**
 * Fixed to the bottom of the screen, so the next hymn is never several screens
 * of scrolling away.
 *
 * Neighbours show their numbers only where numbers mean something. In the
 * other book they are internal ids, and on "Abide with Me" the bar used to
 * read ‹ 20 and 2 › — screen readers said "Previous hymn, 20".
 */
export default function BottomBar({
  hymnal,
  prev,
  next,
  shortcut,
  onPrev,
  onNext,
  onFind,
}: BottomBarProps) {
  const numbered = isNumbered(hymnal);
  const noun = numbered ? "hymn" : "song";
  const describe = (hymn: Hymn) => (numbered ? String(hymn.number) : primaryName(hymnal, hymn));

  return (
    // Safe-area padding outside the 56px row, so the row keeps its height on
    // a phone with a home indicator.
    <nav
      className="shrink-0 border-t border-paper-rule/60 bg-paper/85 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid h-14 w-full max-w-[var(--measure)] grid-cols-[1fr_auto_1fr] items-center px-1.5">
        <button
          type="button"
          onClick={onPrev}
          disabled={!prev}
          aria-label={prev ? `Previous ${noun}, ${describe(prev)}` : `No previous ${noun}`}
          className="flex min-h-11 items-center gap-1 justify-self-start rounded-full pl-2 pr-3 font-sans text-sm tabular-nums text-paper-muted transition-colors hover:bg-paper-sunken hover:text-paper-ink disabled:invisible"
        >
          <ChevronLeft className="h-4 w-4" />
          {numbered ? prev?.number : "Previous"}
        </button>

        {/* The primary action on a surface is the filled dark pill. */}
        <button
          type="button"
          onClick={onFind}
          className="flex min-h-11 items-center gap-2 justify-self-center rounded-full bg-paper-ink px-5 font-sans text-sm font-medium text-paper shadow-sm transition-all hover:opacity-90 active:scale-95"
        >
          <Search className="h-4 w-4 text-paper/70" />
          Find a hymn
          {shortcut && (
            <kbd className="ml-1 rounded border border-paper/25 px-1.5 py-0.5 font-sans text-[0.65rem] text-paper/70">
              {shortcut}
            </kbd>
          )}
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!next}
          aria-label={next ? `Next ${noun}, ${describe(next)}` : `No next ${noun}`}
          className="flex min-h-11 items-center gap-1 justify-self-end rounded-full pl-3 pr-2 font-sans text-sm tabular-nums text-paper-muted transition-colors hover:bg-paper-sunken hover:text-paper-ink disabled:invisible"
        >
          {numbered ? next?.number : "Next"}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
