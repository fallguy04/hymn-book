"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type Hymn, type Hymnal, lineIndent, lineText, sectionPath } from "@/lib/hymnals";

interface HymnViewProps {
  hymnal: Hymnal;
  hymn: Hymn;
  direction: number;
  prev: Hymn | null;
  next: Hymn | null;
  onNext: () => void;
  onPrev: () => void;
  onOpenSearch: () => void;
  onOpenTunes: () => void;
  onOpenSection: (path: string[]) => void;
}

const INDENT_CLASS = ["", "stanza-indent-1", "stanza-indent-2", "stanza-indent-3"];

/** Distance × velocity; past this, a drag counts as a page turn. */
const SWIPE_THRESHOLD = 8000;

/**
 * Hymns open with a word or two set in capitals. Split that run off so it can
 * be set in small caps instead of left shouting in full capitals.
 */
function splitOpening(line: string): [string, string] {
  const match = line.match(/^[^a-z]*[A-Z][A-Z’'-]*(?=\s|$)/);
  if (!match) return ["", line];
  const opening = match[0];
  // Guard against a line that is entirely capitals (a shout in the original).
  if (opening.length > line.length * 0.6) return ["", line];
  return [opening, line.slice(opening.length)];
}

export default function HymnView({
  hymnal,
  hymn,
  direction,
  prev,
  next,
  onNext,
  onPrev,
  onOpenSearch,
  onOpenTunes,
  onOpenSection,
}: HymnViewProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const path = useMemo(() => sectionPath(hymnal, hymn.number), [hymnal, hymn.number]);

  // Landing halfway down the next hymn is the single most jarring thing the
  // old build did. One scroll container, reset on every change of hymn.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [hymn.number]);

  // Keep the screen awake while a hymn is on it — you cannot tap the phone
  // mid-verse. Feature-detected; Safari support is partial.
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) lock.release().catch(() => {});
      } catch {
        // Denied or unsupported — nothing to do.
      }
    };

    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      lock?.release().catch(() => {});
    };
  }, []);

  return (
    <div ref={scroller} className="h-full w-full overflow-y-auto overscroll-contain no-scrollbar">
      {/*
        The new hymn simply replaces the old one and fades in. An exit
        animation would mean waiting for the outgoing article to finish — and
        because that article is also the drag target, a swipe could leave the
        transition half-done and the screen blank.
      */}
      <motion.article
          key={hymn.number}
          initial={reduceMotion ? false : { opacity: 0, x: direction > 0 ? 20 : -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
          drag={reduceMotion ? false : "x"}
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={(_, { offset, velocity }) => {
            const power = offset.x * velocity.x;
            if (offset.x < 0 && power < -SWIPE_THRESHOLD) onNext();
            else if (offset.x > 0 && power > SWIPE_THRESHOLD) onPrev();
          }}
          className="mx-auto w-full max-w-[34rem] px-7 pb-32 pt-4"
        >
          <header className="mb-10 text-center">
            {path.length > 0 && (
              <button
                onClick={() => onOpenSection(path)}
                className="text-label mb-3 inline-block transition-colors hover:text-paper-accent"
              >
                {path.join(" · ")}
              </button>
            )}

            <h1 className="font-serif text-[calc(var(--type-base)*1.6)] leading-tight text-paper-ink">
              {hymn.title || <span className="italic text-paper-muted">Hymn {hymn.number}</span>}
            </h1>

            <p className="mt-3 font-sans text-xs text-paper-faint">
              {hymn.meter && (
                <button
                  onClick={onOpenTunes}
                  className="underline decoration-paper-rule underline-offset-4 transition-colors hover:text-paper-accent"
                >
                  {hymn.meter}
                </button>
              )}
              {hymn.meter && hymn.author && <span aria-hidden> · </span>}
              {hymn.author && <span>{hymn.author}</span>}
            </p>
          </header>

          {/*
            Lines stay left-aligned, but the block as a whole is centred on the
            page — the way a printed hymnal sets it. Centring the lines
            themselves would destroy the indentation that carries the metre,
            and leaving the block flush left reads as off-centre under a
            centred title.
          */}
          <div className="mx-auto w-fit max-w-full space-y-7">
            {hymn.stanzas.map((stanza, s) => (
              <section key={s} className="relative">
                {hymn.stanzas.length > 1 && (
                  <span
                    aria-hidden
                    className="absolute -left-5 top-[0.42em] font-sans text-[0.65rem] tabular-nums text-paper-faint"
                  >
                    {s + 1}
                  </span>
                )}
                <span className="sr-only">Stanza {s + 1}. </span>

                {stanza.map((line, l) => {
                  const text = lineText(line);
                  const [opening, rest] = s === 0 && l === 0 ? splitOpening(text) : ["", text];
                  return (
                    <p
                      key={l}
                      className={`stanza-line ${INDENT_CLASS[lineIndent(line)]}`}
                    >
                      {opening && <span className="opening-caps">{opening}</span>}
                      {rest}
                    </p>
                  );
                })}
              </section>
            ))}
          </div>

          <nav className="mt-14 flex items-center justify-between border-t border-paper-rule pt-4">
            <button
              onClick={onPrev}
              disabled={!prev}
              className="flex items-center gap-1 font-sans text-xs text-paper-faint transition-colors hover:text-paper-ink disabled:invisible"
            >
              <ChevronLeft className="h-4 w-4" />
              {prev?.number}
            </button>

            <button onClick={onOpenSearch} className="text-label transition-colors hover:text-paper-ink">
              Find a hymn
            </button>

            <button
              onClick={onNext}
              disabled={!next}
              className="flex items-center gap-1 font-sans text-xs text-paper-faint transition-colors hover:text-paper-ink disabled:invisible"
            >
              {next?.number}
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
      </motion.article>
    </div>
  );
}
