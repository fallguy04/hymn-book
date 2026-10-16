"use client";

import type { Hymnal } from "@/lib/hymnals";
import BrowsePanels from "./BrowsePanels";

interface SidebarProps {
  hymnal: Hymnal;
  current: number;
  /** Sections to open Contents at, and a count so the same label can ask twice. */
  openAt?: { path: string[]; nonce: number };
  onSelect: (number: number, hymnalId: string) => void;
  onChooseBook: () => void;
}

/**
 * The desktop counterpart to the drawer: the same panels, permanently open.
 *
 * A hamburger is a concession to a small screen. Given 1400px there is no
 * reason to hide the contents behind a tap, and a hymnal is a book you browse
 * as much as one you look things up in.
 *
 * Rendered only on a desktop. It used to be in every phone's page too, hidden
 * with CSS — a second copy of the whole menu, built and kept up to date on
 * every page turn for a screen that would never show it.
 *
 * Keyed so that tapping the label above a title opens Contents at that
 * section, as it does on the phone: `openPath` is read once, on mount.
 */
export default function Sidebar({ hymnal, current, openAt, onSelect, onChooseBook }: SidebarProps) {
  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-paper-rule bg-paper-raised/40 xl:w-96">
      <BrowsePanels
        key={`${hymnal.id}:${openAt?.nonce ?? 0}`}
        hymnal={hymnal}
        current={current}
        openPath={openAt?.path}
        onSelect={onSelect}
        onChooseBook={onChooseBook}
      />
    </aside>
  );
}
