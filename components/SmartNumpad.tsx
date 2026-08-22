"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Delete, Search, ArrowRight, CornerDownRight } from "lucide-react";
import {
  type Hymn,
  type Hymnal,
  findInOtherHymnals,
  getHymn,
  hymnTitle,
  isNumbered,
  listHymnals,
  reachableDigits,
} from "@/lib/hymnals";

interface SmartNumpadProps {
  hymnal: Hymnal;
  buffer: string;
  recents: number[];
  onKeyPress: (key: string) => void;
  onDelete: () => void;
  onGo: () => void;
  onSelect: (number: number) => void;
  /** Jump straight to a hymn in a different book, switching books on the way. */
  onSelectIn: (number: number, hymnalId: string) => void;
  onSwitchHymnal: (hymnalId: string) => void;
  onSwitchToText: () => void;
  onClose: () => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** A light tick on each press; silently absent where unsupported. */
const tick = () => navigator.vibrate?.(8);

export default function SmartNumpad({
  hymnal,
  buffer,
  recents,
  onKeyPress,
  onDelete,
  onGo,
  onSelect,
  onSelectIn,
  onSwitchHymnal,
  onSwitchToText,
  onClose,
}: SmartNumpadProps) {
  const reduceMotion = useReducedMotion();
  const target: Hymn | undefined = buffer ? getHymn(hymnal, Number(buffer)) : undefined;
  const books = listHymnals();

  // Reachability is measured across every book, not just this one. Dimming the
  // keys that lead nowhere here would dim the exact keys that lead to the other
  // book — the pad would be talking someone out of the number they were told.
  const reachable = new Set(books.flatMap((book) => [...reachableDigits(book, buffer)]));

  // A number this book doesn't have may well be a number another book does.
  // Somebody typing 700 into a book that stops at 558 heard that number called
  // out somewhere — far likelier they are in the wrong book than that they
  // misheard, so offer the way across instead of just refusing.
  const elsewhere = buffer && !target ? findInOtherHymnals(Number(buffer), hymnal.id) : [];

  const press = (key: string) => {
    tick();
    onKeyPress(key);
  };

  const keyClass = (key: string) => {
    const dead = buffer.length >= 3 || !reachable.has(key);
    return `h-14 rounded-2xl font-serif text-2xl transition-all active:scale-95 ${
      dead
        ? "bg-paper-sunken/50 text-paper-faint/40"
        : "bg-paper-sunken text-paper-ink hover:bg-paper-rule"
    }`;
  };

  return (
    <motion.div
      initial={reduceMotion ? false : { y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={reduceMotion ? undefined : { y: 24, opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="rounded-t-3xl border-t border-paper-rule bg-paper px-5 pb-8 pt-3 shadow-[0_-12px_40px_-16px_rgba(0,0,0,0.25)]"
    >
      <button
        onClick={onClose}
        aria-label="Close keypad"
        className="mx-auto mb-3 block h-1 w-10 rounded-full bg-paper-rule"
      />

      {/*
        Book first, then number — the order the request arrives in when someone
        at the front says "Other Songs, twelve". Putting it here means the whole
        lookup is one motion on the surface that is already open, instead of a
        detour through search.
      */}
      {books.length > 1 && (
        <div
          role="tablist"
          aria-label="Book"
          className="mb-3 flex gap-1 rounded-full bg-paper-sunken p-1"
        >
          {books.map((book) => {
            const active = book.id === hymnal.id;
            return (
              <button
                key={book.id}
                role="tab"
                aria-selected={active}
                onClick={() => {
                  if (active) return;
                  tick();
                  onSwitchHymnal(book.id);
                }}
                className={`flex-1 rounded-full py-2 font-sans text-xs font-semibold transition-colors ${
                  active ? "bg-paper text-paper-ink shadow-sm" : "text-paper-muted"
                }`}
              >
                {isNumbered(book) ? "Hymnal" : book.shortName}
              </button>
            );
          })}
        </div>
      )}

      {/* Live preview: you see which hymn you're heading to before committing,
          which is what the old floating "ticket" was reaching for. */}
      <div className="mb-3 flex min-h-14 items-center gap-3 px-1">
        {buffer ? (
          <>
            <span className="font-serif text-3xl tabular-nums text-paper-ink">{buffer}</span>
            {target ? (
              <button
                onClick={onGo}
                className="flex flex-1 items-center justify-between gap-2 rounded-xl bg-paper-sunken px-3 py-2 text-left transition-colors hover:bg-paper-rule"
              >
                <span className="line-clamp-2 font-serif text-[0.95rem] leading-snug text-paper-ink">
                  {hymnTitle(target)}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-paper-muted" />
              </button>
            ) : elsewhere.length > 0 ? (
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-sans text-[0.7rem] text-paper-faint">
                  Not in {isNumbered(hymnal) ? "the hymnal" : hymnal.shortName}
                </span>
                {elsewhere.map(({ hymnal: book, hymn }) => (
                  <button
                    key={book.id}
                    onClick={() => onSelectIn(hymn.number, book.id)}
                    className="flex items-center justify-between gap-2 rounded-xl border border-paper-accent/40 bg-paper-accent/[0.06] px-3 py-2 text-left transition-colors hover:bg-paper-accent/[0.12]"
                  >
                    <span className="min-w-0">
                      <span className="block font-sans text-[0.6rem] font-semibold uppercase tracking-wider text-paper-accent">
                        {book.shortName}
                      </span>
                      <span className="line-clamp-1 font-serif text-[0.95rem] leading-snug text-paper-ink">
                        {hymnTitle(hymn)}
                      </span>
                    </span>
                    <CornerDownRight className="h-4 w-4 shrink-0 text-paper-accent" />
                  </button>
                ))}
              </div>
            ) : (
              <span className="font-serif italic text-paper-faint">No hymn {buffer}</span>
            )}
          </>
        ) : recents.length > 0 ? (
          <div className="flex w-full gap-2 overflow-x-auto no-scrollbar">
            <span className="text-label shrink-0 self-center">Recent</span>
            {recents.map((n) => (
              <button
                key={n}
                onClick={() => onSelect(n)}
                className="shrink-0 rounded-full bg-paper-sunken px-3 py-1.5 font-serif text-sm tabular-nums text-paper-ink transition-colors hover:bg-paper-rule"
              >
                {n}
              </button>
            ))}
          </div>
        ) : (
          <span className="font-serif italic text-paper-faint">Enter a hymn number</span>
        )}
      </div>

      <div className="mx-auto grid max-w-sm grid-cols-3 gap-2.5">
        {KEYS.map((key) => (
          <button key={key} onClick={() => press(key)} className={keyClass(key)}>
            {key}
          </button>
        ))}

        <button
          onClick={onSwitchToText}
          aria-label="Search by words"
          className="flex h-14 items-center justify-center rounded-2xl bg-paper-sunken text-paper-muted transition-colors hover:bg-paper-rule active:scale-95"
        >
          <Search className="h-5 w-5" />
        </button>

        <button onClick={() => press("0")} className={keyClass("0")}>
          0
        </button>

        <button
          onClick={() => {
            tick();
            onDelete();
          }}
          aria-label="Delete"
          disabled={!buffer}
          className="flex h-14 items-center justify-center rounded-2xl bg-paper-sunken text-paper-muted transition-colors hover:bg-paper-rule active:scale-95 disabled:opacity-30"
        >
          <Delete className="h-5 w-5" />
        </button>
      </div>
    </motion.div>
  );
}
