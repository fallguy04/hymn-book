"use client";

import { Check } from "lucide-react";
import Overlay, { SheetGrip } from "@/components/ui/Overlay";
import { type Hymnal, getHymn, isNumbered } from "@/lib/hymnals";
import { useBooks } from "@/lib/useBooks";
import { bookBlurb, bookName, countLabel, primaryName } from "@/lib/books";
import { useHymnalStore } from "@/store/useHymnalStore";

interface BookSheetProps {
  current: Hymnal;
  onChoose: (hymnalId: string) => void;
  onClose: () => void;
}

/**
 * Choose a book.
 *
 * This replaces the two 28px tabs on the right edge, which said only "HYMNAL"
 * and "OTHER" in tiny rotated type: hard to hit, and nothing ever explained
 * what the second book was. Here each book gets its name, one sentence about
 * what it is, and where you left off in it — each book keeps its own place,
 * so going back and forth costs nothing.
 */
export default function BookSheet({ current, onChoose, onClose }: BookSheetProps) {
  const positions = useHymnalStore((s) => s.positions);
  const books = useBooks();

  return (
    <Overlay label="Choose a book" placement="bottom" onClose={onClose}>
      <SheetGrip />
      <div className="px-5 pb-6">
        <h2 className="mb-4 text-center font-serif text-[1.4rem] text-paper-ink">Choose a book</h2>
        <ul className="space-y-3">
          {books.map((book) => {
            const isCurrent = book.id === current.id;
            const at = positions[book.id];
            const place = at !== undefined ? getHymn(book, at) : undefined;
            const where = place
              ? isNumbered(book)
                ? `You were at Hymn ${place.number}`
                : `Last opened: ${primaryName(book, place)}`
              : null;
            return (
              <li key={book.id}>
                <button
                  type="button"
                  onClick={() => (isCurrent ? onClose() : onChoose(book.id))}
                  aria-current={isCurrent ? "true" : undefined}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                    isCurrent
                      ? "border-paper-accent bg-paper-sunken"
                      : "border-paper-rule hover:bg-paper-sunken"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-serif text-[1.3rem] leading-tight text-paper-ink">
                        {bookName(book)}
                      </span>
                      <span className="shrink-0 font-sans text-[0.78rem] tabular-nums text-paper-faint">
                        {countLabel(book.hymns.length, book)}
                      </span>
                    </span>
                    <span className="mt-1 block font-sans text-[0.88rem] leading-snug text-paper-muted">
                      {bookBlurb(book)}
                    </span>
                    {where && (
                      <span className="mt-2 block truncate font-sans text-[0.8rem] font-semibold text-paper-accent">
                        {isCurrent ? "Reading now" : where}
                      </span>
                    )}
                  </span>
                  {isCurrent && <Check className="mt-1 h-5 w-5 shrink-0 text-paper-accent" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Overlay>
  );
}
