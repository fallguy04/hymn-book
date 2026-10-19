"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Hash, HelpCircle, Lock, Search as SearchIcon, X } from "lucide-react";
import {
  type Hymnal,
  type SearchResult,
  expandableHymnal,
  highlightRanges,
  isNumbered,
  searchBooks,
} from "@/lib/hymnals";
import { bookName, primaryName, secondaryName } from "@/lib/books";
import { pendingReason, searchPending } from "@/lib/pending";
import Overlay from "./ui/Overlay";
import Segmented from "./ui/Segmented";
import { useBooks } from "@/lib/useBooks";
import SuggestSong from "./SuggestSong";

interface TextSearchProps {
  /** The book on screen, so its results can be told from another book's. */
  current: Hymnal;
  /** Carries the book, since a result may belong to a different one. */
  onSelect: (number: number, hymnalId: string) => void;
  onNumberPad: () => void;
  onClose: () => void;
}

type Scope = "all" | string;

/**
 * What was last searched, kept for this visit. Opening a hymn from the results
 * and coming back to try the next one used to mean typing it all again.
 */
let lastQuery = "";
let lastScope: Scope = "all";

/** Mark the words that matched, wherever they are in the original text. */
function Highlight({ text, query }: { text: string; query: string }) {
  const ranges = highlightRanges(text, query);
  if (ranges.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let at = 0;
  ranges.forEach(([start, end], i) => {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(
      <mark key={i} className="rounded-sm bg-paper-accent/20 px-0.5 text-paper-ink">
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

/**
 * Find a hymn by its words.
 *
 * It searches every book unless told otherwise. It used to default to the
 * book on screen, so someone in the Hymnal looking for "Amazing Grace" was
 * told nothing matched — the song was one chip away, in the other book.
 *
 * Forgiving by design (see lib/search.ts): punctuation, "ev'ry", a misspelled
 * word, a phrase that runs onto the next line. The old search wanted the
 * text exactly as printed, commas and all.
 */
export default function TextSearch({ current, onSelect, onNumberPad, onClose }: TextSearchProps) {
  const [query, setQuery] = useState(lastQuery);
  const [scope, setScope] = useState<Scope>(lastScope);
  const input = useRef<HTMLInputElement>(null);
  const books = useBooks();

  useEffect(() => {
    const field = input.current;
    if (!field) return;
    field.focus();
    // Coming back to a remembered search: selected, so typing replaces it.
    field.select();
  }, []);

  useEffect(() => {
    lastQuery = query;
    lastScope = scope;
  }, [query, scope]);

  const { results, total } = useMemo(
    // `books` changes when songs added in the app arrive, so they're searched too.
    () => searchBooks(query, { bookIds: scope === "all" ? books.map((b) => b.id) : [scope], limit: 40 }),
    [query, scope, books],
  );

  // Songs known to be sung here whose words can't be printed yet. Listed under
  // the real results, never among them.
  const pending = useMemo(() => searchPending(query), [query]);

  const term = query.trim();
  const numeric = /^#?\d+$/.test(term);
  const elsewhere = scope !== "all" && total === 0 && term ? searchBooks(query, { limit: 1 }).total : 0;
  const allFuzzy = results.length > 0 && results.every((r) => r.fuzzy);
  const suggestTo = expandableHymnal();
  const canSuggest = Boolean(term) && !numeric && total === 0 && elsewhere === 0 && Boolean(suggestTo);

  const open = (r: SearchResult) => onSelect(r.hymn.number, r.hymnal.id);

  const onEnter = () => {
    const top = results[0];
    if (!top) return;
    const exactNumber = numeric && top.hymn.number === Number(term.replace("#", ""));
    const precise = window.matchMedia("(pointer: fine)").matches;
    // On a phone, Enter mostly means "put the keyboard away so I can see the
    // list". It opens a hymn only when there is no doubt which.
    if (results.length === 1 || exactNumber || precise) open(top);
    else input.current?.blur();
  };

  return (
    <Overlay
      label="Word search"
      placement="fill"
      onClose={onClose}
      className="mx-auto flex h-full w-full max-w-lg flex-col overflow-hidden lg:h-auto lg:max-h-[70vh] lg:max-w-2xl"
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-paper-rule py-1.5 pl-4 pr-1.5">
        <SearchIcon className="h-5 w-5 shrink-0 text-paper-faint" aria-hidden />
        <label htmlFor="word-search" className="sr-only">
          Words, title, or author
        </label>
        <input
          id="word-search"
          ref={input}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onEnter()}
          placeholder="Words, title, or author"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          className="search-field min-h-12 min-w-0 flex-1 bg-transparent px-2 font-serif text-[1.1rem] text-paper-ink outline-none placeholder:text-paper-faint"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              input.current?.focus();
            }}
            aria-label="Clear"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-paper-faint transition-colors hover:bg-paper-sunken"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onNumberPad}
          aria-label="Number pad"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-paper-muted transition-colors hover:bg-paper-sunken"
        >
          <Hash className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-paper-muted transition-colors hover:bg-paper-sunken"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {books.length > 1 && (
        <div className="shrink-0 border-b border-paper-rule px-3 py-2">
          <Segmented<Scope>
            label="Search in"
            value={scope}
            onChange={setScope}
            options={[{ id: "all", label: "All" }, ...books.map((b) => ({ id: b.id, label: bookName(b) }))]}
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
        {!term && (
          <p className="px-6 py-10 text-center font-serif italic leading-relaxed text-paper-faint">
            Type a few words you remember, from anywhere in the hymn.
          </p>
        )}

        {allFuzzy && (
          <p className="px-3 pb-1 pt-2 font-sans text-[0.8rem] text-paper-muted">
            Nothing matches exactly. These are close.
          </p>
        )}

        {term && total === 0 && (
          <div className="px-3 pt-10">
            <p className="text-center font-serif italic text-paper-faint">
              {scope === "all"
                ? `Nothing in any book matches “${term}”.`
                : `Nothing in ${bookName(books.find((b) => b.id === scope) ?? current)} matches “${term}”.`}
            </p>
            {elsewhere > 0 && (
              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => setScope("all")}
                  className="inline-flex min-h-11 items-center rounded-full border border-paper-rule px-5 font-sans text-[0.9rem] font-semibold text-paper-ink transition-colors hover:bg-paper-sunken"
                >
                  Search all books
                </button>
              </div>
            )}
            {canSuggest && suggestTo && <SuggestSong query={term} hymnalId={suggestTo.id} onOpen={onSelect} />}
          </div>
        )}

        <ul>
          {results.map((r) => {
            const { hymn, hymnal: from } = r;
            const label = secondaryName(from, hymn);
            return (
              <li key={`${from.id}:${hymn.number}`}>
                <button
                  type="button"
                  onClick={() => open(r)}
                  className="flex w-full items-baseline gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-paper-sunken"
                >
                  {/* A number where it means something; otherwise the book's
                      name, so a song from the other book is never taken for
                      a hymn in this one. */}
                  <span className="w-10 shrink-0 font-sans text-[0.8rem] font-semibold tabular-nums text-paper-faint">
                    {isNumbered(from) ? hymn.number : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    {!isNumbered(from) && (
                      <span className="text-label mb-0.5 block text-paper-accent">{bookName(from)}</span>
                    )}
                    <span className="block font-serif text-[1.08rem] leading-snug text-paper-ink">
                      <Highlight text={primaryName(from, hymn)} query={query} />
                    </span>
                    {label && r.matchedOn === "title" && (
                      <span className="mt-0.5 block font-sans text-[0.8rem] text-paper-faint">
                        <Highlight text={label} query={query} />
                      </span>
                    )}
                    {r.matchedOn === "author" && hymn.author && (
                      <span className="mt-0.5 block font-sans text-[0.8rem] text-paper-faint">
                        <Highlight text={hymn.author} query={query} />
                      </span>
                    )}
                    {r.snippet && r.matchedOn === "text" && (
                      <span className="mt-1 line-clamp-2 block font-serif text-[0.92rem] italic leading-snug text-paper-muted">
                        <Highlight text={r.snippet} query={query} />
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {total > results.length && (
          <p className="px-3 py-3 text-center font-sans text-[0.8rem] text-paper-faint">
            Showing {results.length} of {total}. Add a word to narrow it down.
          </p>
        )}

        {/* Songs we know but can't print. Not buttons: there is no page to
            open, and a row that looks tappable and does nothing is worse than
            one that plainly says why. */}
        {pending.length > 0 && (
          <section className="mt-2 border-t border-paper-rule pt-3">
            <p className="text-label mb-1.5 px-3">Known, but not printable yet</p>
            <ul>
              {pending.map((song) => (
                <li key={song.title} className="flex items-baseline gap-2 px-3 py-2.5">
                  {song.status === "unknown" ? (
                    <HelpCircle className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-paper-faint" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-paper-faint" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-[1.05rem] leading-snug text-paper-ink">
                      <Highlight text={song.title} query={query} />
                    </p>
                    {(song.author || song.found) && (
                      <p className="font-sans text-[0.8rem] text-paper-faint">
                        {[song.author, song.found].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <p className="mt-1 font-sans text-[0.8rem] leading-relaxed text-paper-muted">
                      {pendingReason(song)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Overlay>
  );
}
