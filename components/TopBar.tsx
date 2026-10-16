"use client";

import { ChevronDown, Menu, Share, Star } from "lucide-react";
import { type Hymn, type Hymnal, isNumbered } from "@/lib/hymnals";
import { bookName } from "@/lib/books";

interface TopBarProps {
  hymnal: Hymnal;
  hymn: Hymn;
  isFavorite: boolean;
  onOpenMenu: () => void;
  onChooseBook: () => void;
  onToggleFavorite: () => void;
  onOpenShare: () => void;
}

/**
 * Slim and fixed. The title in the middle is also the book switch: it names
 * the book you are in on every page, and a tap offers the other one. That is
 * what the two tabs on the right edge were trying to be.
 */
export default function TopBar({
  hymnal,
  hymn,
  isFavorite,
  onOpenMenu,
  onChooseBook,
  onToggleFavorite,
  onOpenShare,
}: TopBarProps) {
  const numbered = isNumbered(hymnal);
  return (
    // The safe-area inset is added *outside* the 56px row. Inside it, a notched
    // phone's inset was taken out of the row instead, squeezing the controls.
    <header
      className="shrink-0 border-b border-paper-rule/60 bg-paper/85 backdrop-blur-md"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* A three-column grid rather than justify-between, so the title stays on
          the page's centre line however many buttons sit either side. */}
      <div className="mx-auto grid h-14 w-full max-w-[var(--measure)] grid-cols-[1fr_auto_1fr] items-center px-1.5">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open menu"
          className="col-start-1 flex h-11 w-11 items-center justify-center justify-self-start rounded-full text-paper-muted transition-colors hover:bg-paper-sunken hover:text-paper-ink lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={onChooseBook}
          aria-label={`${numbered ? `Hymn ${hymn.number}, ` : ""}${bookName(hymnal)}. Choose a book`}
          className="col-start-2 flex min-h-11 flex-col items-center justify-center rounded-xl px-3 transition-colors hover:bg-paper-sunken"
        >
          {numbered && (
            <span className="font-serif text-[1.08rem] leading-tight text-paper-ink">
              Hymn <span className="tabular-nums">{hymn.number}</span>
            </span>
          )}
          <span
            className={`flex items-center gap-0.5 font-sans font-semibold text-paper-accent ${
              numbered ? "text-[0.72rem]" : "text-[0.95rem]"
            }`}
          >
            {bookName(hymnal)}
            <ChevronDown className={numbered ? "h-3 w-3" : "h-4 w-4"} />
          </span>
        </button>

        <div className="col-start-3 flex items-center justify-self-end">
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label="Favorite"
            aria-pressed={isFavorite}
            className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-paper-sunken active:scale-90"
          >
            <Star
              className={`h-5 w-5 transition-colors ${
                isFavorite ? "fill-paper-accent text-paper-accent" : "text-paper-faint"
              }`}
            />
          </button>
          <button
            type="button"
            onClick={onOpenShare}
            aria-label={`Share this ${numbered ? "hymn" : "song"}`}
            className="flex h-11 w-11 items-center justify-center rounded-full text-paper-faint transition-colors hover:bg-paper-sunken hover:text-paper-ink active:scale-90"
          >
            <Share className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
