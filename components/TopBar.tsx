"use client";

import { Menu, Star } from "lucide-react";
import type { Hymn } from "@/lib/hymnals";

interface TopBarProps {
  hymn: Hymn;
  isFavorite: boolean;
  onOpenMenu: () => void;
  onToggleFavorite: () => void;
}

/**
 * Slim and sticky. The number and the two actions used to float in the content
 * flow, which meant scrolling back up to reach them and a hamburger that only
 * existed at the top of the page.
 */
export default function TopBar({ hymn, isFavorite, onOpenMenu, onToggleFavorite }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-paper-rule/60 bg-paper/85 backdrop-blur-md">
      {/*
        A three-column grid rather than justify-between: there is one control on
        the left and two on the right, so space-between would push the label off
        the page's centre line and out of alignment with the title below it.
      */}
      <div
        className="mx-auto grid h-14 w-full max-w-[var(--measure)] grid-cols-[1fr_auto_1fr] items-center px-2"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {/*
          Each child is placed in its column explicitly. Left to auto-flow, the
          hamburger going `display: none` on desktop removed it from the grid
          entirely — so the label fell into column 1 and the actions into
          column 2, leaving column 3 empty and the whole bar shunted left of
          the centre line the text and footer share.
        */}
        <button
          onClick={onOpenMenu}
          aria-label="Open menu"
          className="col-start-1 justify-self-start rounded-full p-2.5 text-paper-muted transition-colors hover:bg-paper-sunken hover:text-paper-ink lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <span className="col-start-2 justify-self-center font-serif text-[1.05rem] text-paper-ink">
          Hymn <span className="tabular-nums">{hymn.number}</span>
        </span>

        <div className="col-start-3 flex items-center justify-self-end">
          <button
            onClick={onToggleFavorite}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={isFavorite}
            className="rounded-full p-2.5 transition-colors hover:bg-paper-sunken active:scale-90"
          >
            <Star
              className={`h-5 w-5 transition-colors ${
                isFavorite ? "fill-paper-accent text-paper-accent" : "text-paper-faint"
              }`}
            />
          </button>
        </div>
      </div>
    </header>
  );
}
