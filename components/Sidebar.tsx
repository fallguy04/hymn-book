"use client";

import type { Hymnal } from "@/lib/hymnals";
import BrowsePanels, { type Panel } from "./BrowsePanels";

interface SidebarProps {
  hymnal: Hymnal;
  currentMeter: string;
  openPath?: string[];
  initialPanel?: Panel;
  onSelect: (number: number, hymnalId?: string) => void;
}

/**
 * The desktop counterpart to the drawer: the same panels, permanently open.
 *
 * A hamburger is a concession to a small screen. Given 1400px there is no
 * reason to hide the contents behind a tap, and a hymnal is a book you browse
 * as much as one you look things up in.
 *
 * Keyed on the section path so that clicking the topical eyebrow re-opens the
 * panel at that section, the way it does on the phone — `openPath` is read
 * once, on mount, by the table of contents.
 */
export default function Sidebar({
  hymnal,
  currentMeter,
  openPath,
  initialPanel,
  onSelect,
}: SidebarProps) {
  return (
    <aside className="hidden w-80 shrink-0 flex-col border-r border-paper-rule bg-paper-raised/40 lg:flex xl:w-96">
      <BrowsePanels
        key={openPath?.join("/") ?? "root"}
        hymnal={hymnal}
        currentMeter={currentMeter}
        openPath={openPath}
        initialPanel={initialPanel}
        onSelect={onSelect}
      />
    </aside>
  );
}
