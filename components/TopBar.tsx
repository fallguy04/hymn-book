"use client";

import { Menu, Star, ListPlus } from "lucide-react";
import type { Hymn } from "@/lib/hymnals";

interface TopBarProps {
  hymn: Hymn;
  isFavorite: boolean;
  inService: boolean;
  onOpenMenu: () => void;
  onToggleFavorite: () => void;
  onToggleService: () => void;
}

/**
 * Slim and sticky. The number and the two actions used to float in the content
 * flow, which meant scrolling back up to reach them and a hamburger that only
 * existed at the top of the page.
 */
export default function TopBar({
  hymn,
  isFavorite,
  inService,
  onOpenMenu,
  onToggleFavorite,
  onToggleService,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-paper-rule/60 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-12 w-full max-w-[34rem] items-center justify-between px-2">
        <button
          onClick={onOpenMenu}
          aria-label="Open menu"
          className="rounded-full p-2.5 text-paper-muted transition-colors hover:bg-paper-sunken hover:text-paper-ink"
        >
          <Menu className="h-5 w-5" />
        </button>

        <span className="font-serif text-sm tabular-nums tracking-[0.2em] text-paper-muted">
          {hymn.number}
        </span>

        <div className="flex items-center">
          <button
            onClick={onToggleService}
            aria-label={inService ? "Remove from service" : "Add to service"}
            aria-pressed={inService}
            className="rounded-full p-2.5 transition-colors hover:bg-paper-sunken"
          >
            <ListPlus
              className={`h-5 w-5 transition-colors ${
                inService ? "text-paper-accent" : "text-paper-faint"
              }`}
            />
          </button>

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
