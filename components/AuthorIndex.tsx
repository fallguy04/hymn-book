"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { type AuthorSort, type Hymnal, authorIndex, isNumbered, unattributedCount } from "@/lib/hymnals";
import { itemNoun } from "@/lib/books";
import HymnRow from "@/components/ui/HymnRow";
import Segmented from "@/components/ui/Segmented";

interface AuthorIndexProps {
  hymnal: Hymnal;
  current: number;
  onSelect: (number: number) => void;
}

/** Authors of the book you are in, each opening to their hymns. */
export default function AuthorIndex({ hymnal, current, onSelect }: AuthorIndexProps) {
  const [sort, setSort] = useState<AuthorSort>("count");
  const authors = useMemo(() => authorIndex(hymnal, sort), [hymnal, sort]);
  const unattributed = useMemo(() => unattributedCount(hymnal), [hymnal]);
  const [open, setOpen] = useState<string | null>(null);
  const noun = itemNoun(hymnal);

  if (authors.length === 0) {
    return (
      <p className="px-4 py-10 text-center font-serif italic text-paper-faint">No authors noted yet.</p>
    );
  }

  return (
    <div className="pb-4">
      <div className="mb-2 px-2">
        <Segmented
          label="Sort authors"
          value={sort}
          onChange={setSort}
          options={[
            { id: "count", label: `Most ${noun}s` },
            { id: "name", label: "By surname" },
          ]}
        />
      </div>

      <ul>
        {authors.map(({ author, hymns }) => {
          const isOpen = open === author;
          return (
            <li key={author}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : author)}
                aria-expanded={isOpen}
                className="flex min-h-12 w-full items-center gap-2 rounded-xl px-3 text-left transition-colors hover:bg-paper-sunken"
              >
                <ChevronRight
                  className={`h-4 w-4 shrink-0 text-paper-faint transition-transform ${isOpen ? "rotate-90" : ""}`}
                />
                <span className="flex-1 font-serif text-[1.02rem] text-paper-ink">{author}</span>
                <span className="font-sans text-[0.75rem] tabular-nums text-paper-faint">{hymns.length}</span>
              </button>

              {isOpen && (
                <ul className="mb-2">
                  {hymns.map((hymn) => (
                    <HymnRow
                      key={hymn.number}
                      book={hymnal}
                      hymn={hymn}
                      nested
                      current={hymn.number === current}
                      onSelect={() => onSelect(hymn.number)}
                    />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {unattributed > 0 && (
        <p className="px-4 pt-4 font-sans text-[0.8rem] leading-relaxed text-paper-faint">
          {isNumbered(hymnal)
            ? `The printed hymnal names no authors. These come from outside research, and only well-documented ones are listed; ${unattributed} of ${hymnal.hymns.length} hymns are not yet attributed.`
            : `${unattributed} of ${hymnal.hymns.length} ${noun}s have no known author.`}
        </p>
      )}
    </div>
  );
}
