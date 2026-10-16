"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { type Hymnal, type Section, getHymn, hasSections, sectionPath } from "@/lib/hymnals";
import HymnRow from "@/components/ui/HymnRow";

interface TableOfContentsProps {
  hymnal: Hymnal;
  /** The hymn on screen: its section opens and the list scrolls to it. */
  current: number;
  /** Sections to open instead, from the label above a hymn's title. */
  openPath?: string[];
  onSelect: (number: number) => void;
}

/**
 * The book's own topical outline.
 *
 * It opens at your place. It used to open at the top with everything shut, so
 * tapping the section label above a hymn landed you seventeen headings from
 * where you had been, with nothing to say which hymn you came from.
 */
export default function TableOfContents({ hymnal, current, openPath, onSelect }: TableOfContentsProps) {
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(openPath ?? sectionPath(hymnal, current)),
  );
  const currentRow = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    currentRow.current?.scrollIntoView({ block: "center" });
  }, []);

  const toggle = (title: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });

  const renderHymns = (numbers: number[], nested: boolean) => (
    <ul>
      {numbers.map((n) => {
        const hymn = getHymn(hymnal, n);
        if (!hymn) return null;
        const isCurrent = n === current;
        return (
          <HymnRow
            key={n}
            ref={isCurrent ? currentRow : undefined}
            book={hymnal}
            hymn={hymn}
            current={isCurrent}
            nested={nested}
            onSelect={() => onSelect(n)}
          />
        );
      })}
    </ul>
  );

  const renderSection = (section: Section, depth: number) => {
    const isOpen = open.has(section.title);
    const count =
      section.hymns.length + (section.subsections?.reduce((n, s) => n + s.hymns.length, 0) ?? 0);

    return (
      <li key={section.title}>
        <button
          type="button"
          onClick={() => toggle(section.title)}
          aria-expanded={isOpen}
          className="flex min-h-12 w-full items-center gap-2 rounded-xl px-3 text-left transition-colors hover:bg-paper-sunken"
          style={{ paddingLeft: `${0.75 + depth * 1}rem` }}
        >
          <ChevronRight
            className={`h-4 w-4 shrink-0 text-paper-faint transition-transform ${isOpen ? "rotate-90" : ""}`}
          />
          <span
            className={
              depth === 0
                ? "flex-1 font-sans text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-paper-ink"
                : "flex-1 font-sans text-[0.75rem] uppercase tracking-[0.12em] text-paper-muted"
            }
          >
            {section.title}
          </span>
          <span className="font-sans text-[0.75rem] tabular-nums text-paper-faint">{count}</span>
        </button>

        {isOpen && (
          <div className="mb-2">
            {section.hymns.length > 0 && renderHymns(section.hymns, true)}
            {section.subsections && section.subsections.length > 0 && (
              <ul>{section.subsections.map((s) => renderSection(s, depth + 1))}</ul>
            )}
          </div>
        )}
      </li>
    );
  };

  // A book with nothing to divide is just a list.
  if (!hasSections(hymnal)) {
    return <div className="pb-4">{renderHymns(hymnal.hymns.map((h) => h.number), false)}</div>;
  }

  return <ul className="pb-4">{hymnal.sections.map((s) => renderSection(s, 0))}</ul>;
}
