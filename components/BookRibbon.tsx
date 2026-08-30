"use client";

import { type Hymnal, isNumbered, listHymnals } from "@/lib/hymnals";

interface BookRibbonProps {
  hymnal: Hymnal;
  onSwitch: (hymnalId: string) => void;
}

/**
 * Book tabs on the outer edge, the way a bound hymnal has tabbed sections or a
 * ribbon marker for the place you keep returning to.
 *
 * Floated over the gutter rather than laid out beside the text. The stanza
 * block is centred on the page and the whole app is aligned to that centre
 * line, so a tab that took real width would shift the text off it — which is
 * the one thing this design has been told twice not to do. Absolute placement
 * costs the text nothing.
 *
 * Vertically centred, which also keeps it clear of the title.
 */
export default function BookRibbon({ hymnal, onSwitch }: BookRibbonProps) {
  const books = listHymnals();
  if (books.length < 2) return null;

  return (
    <div
      className="pointer-events-none absolute right-0 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1.5"
      style={{ paddingRight: "env(safe-area-inset-right)" }}
    >
      {books.map((book) => {
        const active = book.id === hymnal.id;
        return (
          <button
            key={book.id}
            onClick={() => onSwitch(book.id)}
            aria-current={active ? "true" : undefined}
            aria-label={`Open ${book.title}`}
            title={book.title}
            className={`pointer-events-auto relative h-[5.5rem] w-7 rounded-l-lg font-sans text-[0.65rem] font-semibold uppercase tracking-[0.16em] transition-all ${
              active
                ? "bg-paper-accent text-paper shadow-sm"
                : "bg-paper-sunken text-paper-faint hover:bg-paper-rule hover:text-paper-muted"
            }`}
          >
            {/*
              Vertical text, reading top to bottom, the way a spine does — but
              rotated with a transform rather than written with writing-mode.
              Safari computes an auto-sized box around vertical-rl content
              using horizontal metrics, so on iOS the tab came out too small
              and clipped its own label; Android laid it out correctly, which
              is exactly the split that was reported. A transform happens
              after layout, so there is nothing for Safari to mis-measure —
              the box is fixed at 28×88px and the label just paints inside it.
              The fixed height also keeps the two tabs even, which the
              first-word label was doing by hand before.
            */}
            <span className="absolute inset-0 flex rotate-90 items-center justify-center whitespace-nowrap">
              {tabLabel(book)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * One short word, so it fits the fixed tab. The numbered book is "Hymnal"
 * because that is what people call it out loud.
 */
function tabLabel(book: Hymnal): string {
  if (isNumbered(book)) return "Hymnal";
  return book.shortName.split(/\s+/)[0];
}
