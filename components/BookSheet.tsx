"use client";

import Overlay, { SheetGrip } from "@/components/ui/Overlay";
import { type Hymnal, getHymn, isNumbered } from "@/lib/hymnals";
import { useBooks } from "@/lib/useBooks";
import { bookBlurb, bookName, primaryName } from "@/lib/books";
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
      <div className="px-3 pb-6 pt-1">
        <ul className="space-y-1">
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
                  className={`w-full rounded-2xl px-4 py-4 text-left transition-colors ${
                    isCurrent ? "bg-paper-accent-wash" : "hover:bg-paper-sunken"
                  }`}
                >
                  <span className="block font-serif text-[1.55rem] leading-tight text-paper-ink">{bookName(book)}</span>
                  <span className="mt-1 block font-serif text-[0.98rem] italic leading-snug text-paper-muted">
                    {bookBlurb(book)}
                  </span>
                  {where && !isCurrent && (
                    <span className="mt-2 block truncate font-sans text-[0.8rem] font-semibold text-paper-accent">
                      {where}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Overlay>
  );
}
