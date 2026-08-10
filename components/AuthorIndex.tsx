"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { type Hymnal, authorIndex, hymnTitle, unattributedCount } from "@/lib/hymnals";

interface AuthorIndexProps {
  hymnal: Hymnal;
  onSelect: (number: number) => void;
}

/**
 * Alphabetical by surname, the way a printed author index reads. Attribution is
 * deliberately incomplete: the hymnal itself prints no authors, so these come
 * from external research and only well-attested ones are claimed.
 */
export default function AuthorIndex({ hymnal, onSelect }: AuthorIndexProps) {
  const authors = useMemo(() => authorIndex(hymnal), [hymnal]);
  const unattributed = useMemo(() => unattributedCount(hymnal), [hymnal]);
  const [open, setOpen] = useState<string | null>(null);

  if (authors.length === 0) {
    return (
      <p className="px-4 py-10 text-center font-serif italic text-paper-faint">
        No attributions yet.
      </p>
    );
  }

  return (
    <div className="pb-4">
      <ul>
        {authors.map(({ author, hymns }) => {
          const isOpen = open === author;
          return (
            <li key={author}>
              <button
                onClick={() => setOpen(isOpen ? null : author)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-paper-sunken"
              >
                <ChevronRight
                  className={`h-3.5 w-3.5 shrink-0 text-paper-faint transition-transform ${
                    isOpen ? "rotate-90" : ""
                  }`}
                />
                <span className="flex-1 font-serif text-[0.95rem] text-paper-ink">{author}</span>
                <span className="font-sans text-[0.65rem] tabular-nums text-paper-faint">
                  {hymns.length}
                </span>
              </button>

              {isOpen && (
                <ul className="mb-2">
                  {hymns.map((hymn) => (
                    <li key={hymn.number}>
                      <button
                        onClick={() => onSelect(hymn.number)}
                        className="flex w-full items-baseline gap-3 rounded-lg py-2 pl-8 pr-3 text-left transition-colors hover:bg-paper-sunken"
                      >
                        <span className="w-9 shrink-0 font-sans text-[0.7rem] tabular-nums text-paper-faint">
                          {hymn.number}
                        </span>
                        <span className="font-serif text-[0.9rem] leading-snug text-paper-ink">
                          {hymnTitle(hymn)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {unattributed > 0 && (
        <p className="px-4 pt-4 font-sans text-[0.7rem] leading-relaxed text-paper-faint">
          The hymnal prints no authors. {unattributed} of {hymnal.hymns.length} hymns are not yet
          attributed — only well-documented authorship is claimed here.
        </p>
      )}
    </div>
  );
}
