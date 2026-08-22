"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Search as SearchIcon, Hash } from "lucide-react";
import { type Hymnal, hymnTitle, searchHymns } from "@/lib/hymnals";
import SuggestSong from "./SuggestSong";

interface TextSearchProps {
  hymnal: Hymnal;
  onSelect: (number: number) => void;
  onSwitchToNumber: () => void;
  onClose: () => void;
}

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
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const results = useMemo(() => searchHymns(hymnal, term), [hymnal, term]);

  return (
    <div className="mx-auto flex h-full w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-paper-rule bg-paper shadow-2xl lg:h-auto lg:max-h-[70vh] lg:max-w-2xl">
      <div className="flex items-center gap-2 border-b border-paper-rule px-3 py-3">
        <SearchIcon className="h-5 w-5 shrink-0 text-paper-faint" />
        <input
          ref={input}
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && results[0] && onSelect(results[0].hymn.number)}
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

      <div className="flex-1 overflow-y-auto overscroll-contain p-1.5">
        {term && results.length === 0 && (
          <div className="mt-12 px-3">
            <p className="text-center font-serif italic text-paper-faint">
              Nothing in this book matches &ldquo;{term}&rdquo;.
            </p>
            <SuggestSong query={term} hymnalId={hymnal.id} />
          </div>
        )}

        {results.map(({ hymn, snippet }) => (
          <button
            key={hymn.number}
            onClick={() => onSelect(hymn.number)}
            className="w-full rounded-2xl px-3 py-3 text-left transition-colors hover:bg-paper-sunken"
          >
            <div className="mb-0.5 flex items-baseline justify-between gap-2">
              <span className="font-sans text-[0.65rem] font-semibold tabular-nums tracking-widest text-paper-faint">
                {hymn.number}
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
        ))}
      </div>
    </div>
  );
}
