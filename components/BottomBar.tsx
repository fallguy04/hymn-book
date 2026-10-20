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
  /** Tucked away while reading down a long hymn. */
  away?: boolean;
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
  away = false,
}: BottomBarProps) {
  const numbered = isNumbered(hymnal);
  const noun = numbered ? "hymn" : "song";
  const describe = (hymn: Hymn) => (numbered ? String(hymn.number) : primaryName(hymnal, hymn));

  return (
    // A capsule floating above the home indicator, the hymn passing beneath
    // it, rather than a bar ruled off across the bottom of the screen.
    <nav
      inert={away || undefined}
      className={`chrome pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 ${
        away ? "chrome-bottom-away" : ""
      }`}
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.625rem)" }}
    >
      <div className="pointer-events-auto grid h-14 w-full max-w-[26rem] grid-cols-[1fr_auto_1fr] items-center rounded-full bg-paper/80 px-1.5 shadow-[0_14px_36px_-14px_rgba(36,31,26,0.4)] ring-1 ring-paper-rule/80 backdrop-blur-xl backdrop-saturate-150">
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

        {/* The one act on the page, in gold. */}
        <button
          type="button"
          onClick={onFind}
          className="press flex min-h-11 items-center gap-2 justify-self-center rounded-full bg-paper-accent px-5 font-sans text-sm font-semibold text-paper"
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
