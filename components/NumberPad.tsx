"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Delete, Search } from "lucide-react";
import Overlay, { SheetGrip } from "@/components/ui/Overlay";
import { type Hymn, getDefaultHymnal, getHymn, reachableDigits } from "@/lib/hymnals";
import { MAX_DIGITS, primaryName, secondaryName } from "@/lib/books";

interface NumberPadProps {
  /** A digit typed on a keyboard before the pad was open. */
  seed?: string;
  /** Recent hymn numbers in the collection, most recent first. */
  recents: number[];
  onGo: (number: number) => void;
  onWordSearch: () => void;
  onClose: () => void;
}

/** A light tick on each press; silently absent where unsupported. */
const tick = () => navigator.vibrate?.(8);

/**
 * Type a number, go.
 *
 * Numbers are what get called out from the front, and they are the printed
 * collection's numbers — the other book's are internal ids nobody ever says.
 * So the pad dials the collection only. That took away the book toggle, the
 * "not in this book" message and the second way to commit, which is most of
 * what made the old pad crowded: 16 controls, 9 more behind it.
 *
 * The number lives here, not in the page, so every opening starts empty. It
 * used to survive closing: type 24, close, reopen, and the next call became
 * hymn 245.
 */
export default function NumberPad({ seed = "", recents, onGo, onWordSearch, onClose }: NumberPadProps) {
  const book = getDefaultHymnal();
  const [digits, setDigits] = useState(() => (getHymn(book, Number(seed)) ? seed : ""));

  const target: Hymn | undefined = digits ? getHymn(book, Number(digits)) : undefined;
  const reachable = reachableDigits(book, digits);
  const isDead = (key: string) => digits.length >= MAX_DIGITS || !reachable.has(key);

  // Pure updates, so a key and the keyboard can share them. The keyboard used
  // to skip the dead-key rule entirely and could type "024" or "600".
  const press = (key: string) =>
    setDigits((prev) =>
      prev.length < MAX_DIGITS && reachableDigits(book, prev).has(key) ? prev + key : prev,
    );
  const backspace = () => setDigits((prev) => prev.slice(0, -1));
  const go = () => {
    if (target) onGo(target.number);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        press(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        backspace();
      } else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
        // A focused key answers its own Enter; without this guard one press
        // both submitted and typed.
        e.preventDefault();
        go();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const keyClass = (dead: boolean) =>
    `flex h-14 select-none items-center justify-center rounded-2xl font-serif text-[1.65rem] touch-manipulation transition-transform ${
      dead
        ? "bg-paper-sunken/40 text-paper-muted"
        : "bg-paper-sunken text-paper-ink hover:bg-paper-rule active:scale-95"
    }`;

  const shownRecents = recents.slice(0, 3).flatMap((n) => {
    const hymn = getHymn(book, n);
    return hymn ? [hymn] : [];
  });

  return (
    <Overlay label="Go to a hymn by number" placement="bottom" onClose={onClose}>
      <SheetGrip label="Close keypad" />

      <div className="px-5 pb-5">
        {/* What you're about to open, before you open it. Announced as it
            changes, so a screen-reader user hears the number and the hymn. */}
        <div role="status" aria-live="polite" className="mb-3 flex min-h-[4.25rem] items-center gap-3">
          {digits ? (
            <>
              <span className="w-[4.5rem] shrink-0 font-serif text-[2.5rem] leading-none tabular-nums text-paper-ink">
                {digits}
              </span>
              {target ? (
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-serif text-[1.05rem] leading-snug text-paper-ink">
                    {primaryName(book, target)}
                  </span>
                  {secondaryName(book, target) && (
                    <span className="mt-0.5 block truncate font-sans text-[0.75rem] text-paper-faint">
                      {secondaryName(book, target)}
                    </span>
                  )}
                </span>
              ) : (
                <span className="font-serif italic text-paper-faint">No hymn {digits}</span>
              )}
            </>
          ) : shownRecents.length > 0 ? (
            <div className="flex w-full min-w-0 flex-col gap-1.5">
              <span className="text-label">Recent</span>
              <div className="flex gap-2">
                {shownRecents.map((hymn) => (
                  <button
                    key={hymn.number}
                    type="button"
                    onClick={() => onGo(hymn.number)}
                    className="flex min-h-11 min-w-0 flex-1 items-baseline gap-1.5 rounded-xl bg-paper-sunken px-2.5 py-2 text-left transition-colors hover:bg-paper-rule"
                  >
                    <span className="shrink-0 font-sans text-[0.85rem] font-semibold tabular-nums text-paper-ink">
                      {hymn.number}
                    </span>
                    <span className="truncate font-serif text-[0.85rem] text-paper-muted">
                      {primaryName(book, hymn)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <span className="font-serif text-[1.15rem] italic text-paper-faint">Type a hymn number</span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                tick();
                press(key);
              }}
              disabled={isDead(key)}
              className={keyClass(isDead(key))}
            >
              {key}
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              tick();
              backspace();
            }}
            disabled={!digits}
            aria-label="Delete"
            className="flex h-14 select-none items-center justify-center rounded-2xl bg-paper-sunken text-paper-muted touch-manipulation transition-transform hover:bg-paper-rule active:scale-95 disabled:opacity-30"
          >
            <Delete className="h-6 w-6" />
          </button>

          <button
            type="button"
            onClick={() => {
              tick();
              press("0");
            }}
            disabled={isDead("0")}
            className={keyClass(isDead("0"))}
          >
            0
          </button>

          <button
            type="button"
            onClick={() => {
              tick();
              go();
            }}
            disabled={!target}
            aria-label={target ? `Go to hymn ${target.number}` : "Type a hymn number first"}
            className="flex h-14 select-none items-center justify-center gap-1.5 rounded-2xl bg-paper-ink font-sans text-base font-semibold text-paper touch-manipulation transition-transform active:scale-95 disabled:bg-paper-sunken disabled:text-paper-faint/60"
          >
            Go
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Word search used to be an unlabelled magnifier key inside the grid —
            the only way to reach it on a phone, and nothing said so. */}
        <button
          type="button"
          onClick={onWordSearch}
          className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-paper-rule font-sans text-[0.95rem] font-semibold text-paper-ink transition-colors hover:bg-paper-sunken"
        >
          <Search className="h-4 w-4 text-paper-muted" />
          Word search
        </button>
      </div>
    </Overlay>
  );
}
