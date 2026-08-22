"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Search as SearchIcon, Hash } from "lucide-react";
import {
  type Hymnal,
  hymnTitle,
  listHymnals,
  searchAllHymnals,
  searchHymns,
} from "@/lib/hymnals";
import SuggestSong from "./SuggestSong";

interface TextSearchProps {
  hymnal: Hymnal;
  /** Carries the book, since a result may belong to a different one. */
  onSelect: (number: number, hymnalId: string) => void;
  onSwitchToNumber: () => void;
  onClose: () => void;
}

type Scope = "book" | "all";

/** Wrap each occurrence of the term so matches are visible at a glance. */
function Highlight({ text, term }: { text: string; term: string }) {
  if (!term.trim()) return <>{text}</>;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === term.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-paper-accent/20 px-0.5 text-paper-ink">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

export default function TextSearch({
  hymnal,
  onSelect,
  onSwitchToNumber,
  onClose,
}: TextSearchProps) {
  const [term, setTerm] = useState("");
  // Defaults to the current book. Someone looking up a number mid-service
  // wants their own hymnal's 26, not every 26 in every book — crossing books
  // is a deliberate act, not the default.
  const [scope, setScope] = useState<Scope>("book");
  const input = useRef<HTMLInputElement>(null);

  const multipleBooks = listHymnals().length > 1;

  useEffect(() => {
    input.current?.focus();
  }, []);

  const results = useMemo(
    () => (scope === "all" && multipleBooks ? searchAllHymnals(term) : searchHymns(hymnal, term)),
    [hymnal, term, scope, multipleBooks],
  );

  return (
    <div className="mx-auto flex h-full w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-paper-rule bg-paper shadow-2xl lg:h-auto lg:max-h-[70vh] lg:max-w-2xl">
      <div className="flex items-center gap-2 border-b border-paper-rule px-3 py-3">
        <SearchIcon className="h-5 w-5 shrink-0 text-paper-faint" />
        <input
          ref={input}
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && results[0] && onSelect(results[0].hymn.number, results[0].hymnal.id)
          }
          placeholder="Hymn number, title, first line, author…"
          className="min-w-0 flex-1 bg-transparent font-serif text-paper-ink outline-none placeholder:text-paper-faint"
        />
        <button
          onClick={onSwitchToNumber}
          aria-label="Switch to number pad"
          className="rounded-full p-2 text-paper-muted transition-colors hover:bg-paper-sunken"
        >
          <Hash className="h-5 w-5" />
        </button>
        <button
          onClick={onClose}
          aria-label="Close search"
          className="rounded-full p-2 text-paper-muted transition-colors hover:bg-paper-sunken"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {multipleBooks && (
        <div className="flex shrink-0 gap-1 border-b border-paper-rule px-3 py-2">
          {(
            [
              ["book", hymnal.shortName],
              ["all", "All songs"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setScope(id)}
              aria-pressed={scope === id}
              className={`rounded-full px-3 py-1.5 font-sans text-[0.7rem] font-semibold transition-colors ${
                scope === id ? "bg-paper-ink text-paper" : "text-paper-muted hover:bg-paper-sunken"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto overscroll-contain p-1.5">
        {term && results.length === 0 && (
          <div className="mt-12 px-3">
            <p className="text-center font-serif italic text-paper-faint">
              {scope === "all" && multipleBooks
                ? `Nothing in any book matches “${term}”.`
                : `Nothing in ${hymnal.shortName} matches “${term}”.`}
            </p>
            <SuggestSong query={term} hymnalId={hymnal.id} />
          </div>
        )}

        {results.map(({ hymn, snippet, hymnal: from }) => {
          // The same number means different songs in different books, so when
          // results can span them the book is named on every row — and one
          // from another book is outlined in the accent colour, so it can
          // never be mistaken for your own hymnal at a glance.
          const foreign = from.id !== hymnal.id;
          return (
          <button
            key={`${from.id}:${hymn.number}`}
            onClick={() => onSelect(hymn.number, from.id)}
            className={`w-full rounded-2xl px-3 py-3 text-left transition-colors hover:bg-paper-sunken ${
              foreign ? "border border-paper-accent/40 bg-paper-accent/[0.04]" : ""
            }`}
          >
            <div className="mb-0.5 flex items-baseline justify-between gap-2">
              <span className="flex items-baseline gap-2">
                <span className="font-sans text-[0.65rem] font-semibold tabular-nums tracking-widest text-paper-faint">
                  {hymn.number}
                </span>
                {scope === "all" && multipleBooks && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-sans text-[0.6rem] font-semibold uppercase tracking-wider ${
                      foreign
                        ? "bg-paper-accent/15 text-paper-accent"
                        : "bg-paper-sunken text-paper-faint"
                    }`}
                  >
                    {from.shortName}
                  </span>
                )}
              </span>
              {hymn.meter && (
                <span className="font-sans text-[0.65rem] text-paper-faint">{hymn.meter}</span>
              )}
            </div>

            <h3 className="font-serif text-[1.05rem] leading-snug text-paper-ink">
              <Highlight text={hymnTitle(hymn)} term={term} />
            </h3>

            {hymn.author && (
              <p className="font-sans text-[0.7rem] text-paper-faint">
                <Highlight text={hymn.author} term={term} />
              </p>
            )}

            {snippet && (
              <p className="mt-1 line-clamp-2 font-serif text-sm italic leading-snug text-paper-muted">
                <Highlight text={snippet} term={term} />
              </p>
            )}
          </button>
          );
        })}
      </div>
    </div>
  );
}
