"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { Hymn } from "@/lib/hymnals";

interface BottomBarProps {
  prev: Hymn | null;
  next: Hymn | null;
  /** Desktop advertises the keyboard shortcut; a phone has no ⌘ key. */
  isDesktop?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onOpenSearch: () => void;
}

/**
 * Fixed to the bottom of the viewport rather than sitting at the end of the
 * text: on a long hymn the way out was several screens down, which is no use
 * to someone who needs the next number now.
 *
 * Same three-column grid as the top bar so the label stays on the page's
 * centre line no matter how wide the adjacent numbers get.
 */
export default function BottomBar({
  prev,
  next,
  isDesktop,
  onPrev,
  onNext,
  onOpenSearch,
}: BottomBarProps) {
  return (
    <nav className="shrink-0 border-t border-paper-rule/60 bg-paper/85 backdrop-blur-md">
      <div
        className="mx-auto grid h-14 w-full max-w-[var(--measure)] grid-cols-[1fr_auto_1fr] items-center px-2"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <button
          onClick={onPrev}
          disabled={!prev}
          aria-label={prev ? `Previous hymn, ${prev.number}` : "No previous hymn"}
          className="flex items-center gap-1 justify-self-start rounded-full py-2 pl-2 pr-3 font-sans text-sm tabular-nums text-paper-muted transition-colors hover:bg-paper-sunken hover:text-paper-ink disabled:invisible"
        >
          <ChevronLeft className="h-4 w-4" />
          {prev?.number}
        </button>

        {/*
          Given a pill, a border and an icon: as letterspaced capitals this read
          as a caption rather than something to press.
        */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 justify-self-center rounded-full border border-paper-rule bg-paper-sunken px-5 py-2 font-sans text-sm font-medium text-paper-ink shadow-sm transition-all hover:border-paper-faint active:scale-95"
        >
          <Search className="h-4 w-4 text-paper-muted" />
          Find a hymn
          {isDesktop && (
            <kbd className="ml-1 rounded border border-paper-rule bg-paper px-1.5 py-0.5 font-sans text-[0.65rem] text-paper-faint">
              ⌘K
            </kbd>
          )}
        </button>

        <button
          onClick={onNext}
          disabled={!next}
          aria-label={next ? `Next hymn, ${next.number}` : "No next hymn"}
          className="flex items-center gap-1 justify-self-end rounded-full py-2 pl-3 pr-2 font-sans text-sm tabular-nums text-paper-muted transition-colors hover:bg-paper-sunken hover:text-paper-ink disabled:invisible"
        >
          {next?.number}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
