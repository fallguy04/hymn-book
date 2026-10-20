"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Delete, Search } from "lucide-react";
import Overlay, { SheetGrip } from "@/components/ui/Overlay";
import { type Hymn, getDefaultHymnal, getHymn, reachableDigits } from "@/lib/hymnals";
import { MAX_DIGITS, primaryName } from "@/lib/books";

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
  const canGrow = digits.length < MAX_DIGITS && reachable.size > 0;
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
    `press flex h-16 select-none items-center justify-center rounded-[20px] font-serif text-[1.75rem] tabular-nums touch-manipulation ${
      dead ? "bg-paper-sunken/40 text-paper-faint/60" : "bg-paper-sunken text-paper-ink"
    }`;

  const shownRecents = recents.slice(0, 3).flatMap((n) => {
    const hymn = getHymn(book, n);
    return hymn ? [hymn] : [];
  });

  return (
    <Overlay label="Go to a hymn by number" placement="bottom" onClose={onClose}>
      <SheetGrip label="Close keypad" />

      <div className="px-5 pb-5">
        {/* What you're about to open: the number large in gold, the hymn's
            first line under it. Announced as it changes. */}
        <div
          role="status"
          aria-live="polite"
          aria-label={digits ? undefined : "Type a hymn number"}
          className="mb-4 flex h-[6.75rem] flex-col items-center justify-center text-center"
        >
          {digits ? (
            <>
              <span className="font-serif text-[3.1rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-paper-accent">
                {digits}
                {canGrow && <i aria-hidden className="digit-wait" />}
              </span>
              <span className="mt-2.5 line-clamp-1 max-w-full px-2 font-serif text-[1.05rem] italic text-paper-muted">
                {target ? primaryName(book, target) : "\u00a0"}
              </span>
            </>
          ) : shownRecents.length > 0 ? (
            <div className="flex w-full min-w-0 flex-col items-center gap-2">
              <span className="text-label">Recent</span>
              <div className="flex w-full gap-2">
                {shownRecents.map((hymn) => (
                  <button
                    key={hymn.number}
                    type="button"
                    onClick={() => onGo(hymn.number)}
                    className="press flex min-h-12 min-w-0 flex-1 items-baseline gap-1.5 rounded-2xl bg-paper-sunken px-3 py-2.5 text-left"
                  >
                    <span className="shrink-0 font-serif text-[1rem] font-semibold tabular-nums text-paper-accent">
                      {hymn.number}
                    </span>
                    <span className="truncate font-serif text-[0.9rem] italic text-paper-muted">
                      {primaryName(book, hymn)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <span aria-hidden className="font-serif text-[3.1rem] leading-none">
              <i className="digit-wait" />
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
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
            className="press flex h-16 select-none items-center justify-center rounded-[20px] bg-paper-sunken text-paper-muted touch-manipulation disabled:opacity-30"
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
            className="press flex h-16 select-none items-center justify-center rounded-[20px] bg-paper-accent text-paper touch-manipulation disabled:bg-paper-sunken disabled:text-paper-faint/50"
          >
            <ArrowRight className="h-6 w-6" strokeWidth={2.25} />
          </button>
        </div>

        {/* Word search used to be an unlabelled magnifier key inside the grid —
            the only way to reach it on a phone, and nothing said so. */}
        <button
          type="button"
          onClick={onWordSearch}
          className="press mt-2.5 flex min-h-12 w-full items-center justify-center gap-2 rounded-[20px] border border-paper-rule font-sans text-[0.95rem] font-semibold text-paper-ink"
        >
          <Search className="h-4 w-4 text-paper-muted" />
          Word search
        </button>
      </div>
    </Overlay>
  );
}
