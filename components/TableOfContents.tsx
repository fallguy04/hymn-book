"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { type Hymnal, type Section, getHymn, hymnTitle } from "@/lib/hymnals";

interface TableOfContentsProps {
  hymnal: Hymnal;
  /** Section titles to open on mount, from the eyebrow on the hymn view. */
  openPath?: string[];
  onSelect: (number: number) => void;
}

/** The book's own topical outline, so it reads the way the printed one does. */
export default function TableOfContents({ hymnal, openPath, onSelect }: TableOfContentsProps) {
  const [open, setOpen] = useState<Set<string>>(new Set(openPath ?? []));

  useEffect(() => {
    if (openPath?.length) setOpen(new Set(openPath));
  }, [openPath]);

  const toggle = (title: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });

  const renderHymns = (numbers: number[]) => (
    <ul>
      {numbers.map((n) => {
        const hymn = getHymn(hymnal, n);
        if (!hymn) return null;
        return (
          <li key={n}>
            <button
              onClick={() => onSelect(n)}
              className="flex w-full items-baseline gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-paper-sunken"
            >
              <span className="w-9 shrink-0 font-sans text-[0.7rem] tabular-nums text-paper-faint">
                {n}
              </span>
              <span className="font-serif text-[0.95rem] leading-snug text-paper-ink">
                {hymnTitle(hymn)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  const renderSection = (section: Section, depth: number) => {
    const isOpen = open.has(section.title);
    const count =
      section.hymns.length +
      (section.subsections?.reduce((n, s) => n + s.hymns.length, 0) ?? 0);

    return (
      <li key={section.title}>
        <button
          onClick={() => toggle(section.title)}
          aria-expanded={isOpen}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-paper-sunken"
          style={{ paddingLeft: `${0.75 + depth * 0.75}rem` }}
        >
          <ChevronRight
            className={`h-3.5 w-3.5 shrink-0 text-paper-faint transition-transform ${
              isOpen ? "rotate-90" : ""
            }`}
          />
          <span
            className={
              depth === 0
                ? "flex-1 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-paper-ink"
                : "flex-1 font-sans text-[0.68rem] uppercase tracking-[0.14em] text-paper-muted"
            }
          >
            {section.title}
          </span>
          <span className="font-sans text-[0.65rem] tabular-nums text-paper-faint">{count}</span>
        </button>

        {isOpen && (
          <div className="mb-2">
            {section.hymns.length > 0 && renderHymns(section.hymns)}
            {section.subsections && section.subsections.length > 0 && (
              <ul>{section.subsections.map((s) => renderSection(s, depth + 1))}</ul>
            )}
          </div>
        )}
      </li>
    );
  };

  return <ul className="pb-4">{hymnal.sections.map((s) => renderSection(s, 0))}</ul>;
}
