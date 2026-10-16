"use client";

import type { Hymnal } from "@/lib/hymnals";
import Overlay from "./ui/Overlay";
import BrowsePanels from "./BrowsePanels";

interface NavDrawerProps {
  hymnal: Hymnal;
  current: number;
  openPath?: string[];
  onClose: () => void;
  onSelect: (number: number, hymnalId: string) => void;
  onChooseBook: () => void;
}

/**
 * The menu on a phone: the same panels as the desktop sidebar, in a drawer
 * from the left. Swipe it back or tap beside it to close.
 *
 * Mounted only while open, so it always opens on the menu's first screen (or
 * straight onto Contents, from the label above a hymn).
 */
export default function NavDrawer({ hymnal, current, openPath, onClose, onSelect, onChooseBook }: NavDrawerProps) {
  return (
    <Overlay label="Menu" placement="left" onClose={onClose} className="flex flex-col">
      <BrowsePanels
        hymnal={hymnal}
        current={current}
        openPath={openPath}
        onClose={onClose}
        onSelect={onSelect}
        onChooseBook={onChooseBook}
      />
    </Overlay>
  );
}
