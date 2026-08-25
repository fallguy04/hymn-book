"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { type Hymn, type Hymnal, lineIndent, lineText, sectionPath } from "@/lib/hymnals";

interface HymnViewProps {
  hymnal: Hymnal;
  hymn: Hymn;
  direction: number;
  onNext: () => void;
  onPrev: () => void;
  onOpenTunes: () => void;
  onOpenSection: (path: string[]) => void;
}

const INDENT_CLASS = ["", "stanza-indent-1", "stanza-indent-2", "stanza-indent-3"];

/** Distance × velocity; past this, a flick counts as a page turn. */
const SWIPE_THRESHOLD = 8000;

/**
 * How far a drag alone turns the page, with no flick at all. A slow deliberate
 * swipe ends with almost no velocity, so a velocity test on its own quietly
 * requires everyone to swipe briskly.
 */
const SWIPE_DISTANCE = 80;

/**
 * Hymns open with a word or two set in capitals. Split that run off so it can
 * be set in small caps instead of left shouting in full capitals.
 */
function splitOpening(line: string): [string, string] {
  // The lookahead used to demand whitespace, so any opening run followed by
  // punctuation — "LORD, at thy sacred feet" — kept shouting in full capitals.
  // That was 138 of 577 hymns: a quarter of the book, in the one place this
  // function exists to fix.
  const match = line.match(/^[^a-z]*[A-Z][A-Z’'-]*(?=[\s,.;:!?]|$)/);
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
  onNext,
  onPrev,
  onOpenTunes,
  onOpenSection,
}: HymnViewProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const path = useMemo(() => sectionPath(hymnal, hymn.number), [hymnal, hymn.number]);

  /**
   * Verse numbers count verses, not stanzas. A refrain printed between them is
   * not verse 2 — numbering it as one pushes every real verse after it up by
   * one, which is exactly the thing a song leader calling "verse three" needs
   * the page to get right.
   */
  const verseNumbers = useMemo(() => {
    const refrains = new Set(hymn.refrains ?? []);
    let n = 0;
    return hymn.stanzas.map((_, s) => (refrains.has(s) ? null : ++n));
  }, [hymn.stanzas, hymn.refrains]);

  const verseCount = verseNumbers.filter((n) => n !== null).length;

  // Landing halfway down the next hymn is the single most jarring thing the
  // old build did. One scroll container, reset on every change of hymn.
  // Keyed on the book as well as the number: crossing books to the same number
  // is a different song, but the number alone hadn't changed — so the reset
  // never ran and song 3 of the other book opened halfway down.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [hymnal.id, hymn.number]);

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
    /* Focusable so arrow keys and PageDown reach it. It is the only scroll
       container and `body` is overflow:hidden, so without this a keyboard user
       could not read past the first screen of a long hymn — and on a hymn with
       no section path and no metre there was nothing inside to tab to either. */
    <div
      ref={scroller}
      tabIndex={0}
      role="region"
      aria-label="Hymn text"
      className="h-full w-full overflow-y-auto overscroll-contain no-scrollbar"
    >
      {/*
        The new hymn simply replaces the old one and fades in. An exit
        animation would mean waiting for the outgoing article to finish — and
        because that article is also the drag target, a swipe could leave the
        transition half-done and the screen blank.
      */}
      <motion.article
          key={`${hymnal.id}:${hymn.number}`}
          // direction is 0 on first render — there is no page turn to imply, so
          // it only fades. Sliding on load left the text sitting 20px off the
          // centre line the bars are aligned to.
          initial={
            reduceMotion ? false : { opacity: 0, x: direction === 0 ? 0 : direction > 0 ? 20 : -20 }
          }
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
          /* Reduced motion means less movement on screen, not fewer ways to
             turn the page. A drag that tracks the finger is not a vestibular
             trigger, and removing it left this audience with only the small
             arrows in the bar. The transitions below still go to zero. */
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={(_, { offset, velocity }) => {
            /*
              Magnitude × signed velocity — the abs() is what was missing, and
              it made forward swipes barely work while back swipes always did.
              An honest swipe has offset and velocity pointing the same way, so
              multiplying the *signed* offset by velocity gave a positive number
              in both directions. The back branch tested for positive and so
              always fired; the forward branch tested for negative and could
              only fire if you dragged left and flicked back right at the end.
            */
            const power = Math.abs(offset.x) * velocity.x;
            if (offset.x < -SWIPE_DISTANCE || power < -SWIPE_THRESHOLD) onNext();
            else if (offset.x > SWIPE_DISTANCE || power > SWIPE_THRESHOLD) onPrev();
          }}
          className="mx-auto w-full max-w-[var(--measure)] px-7 pb-10 pt-4 lg:pt-10"
        >
          <header className="mb-10 text-center">
            {path.length > 0 && (
              <button
                onClick={() => onOpenSection(path)}
                className="text-label -mx-2 mb-1 inline-block px-2 py-2 transition-colors hover:text-paper-accent"
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
                  className="-mx-1 inline-block px-1 py-2 underline decoration-paper-rule underline-offset-4 transition-colors hover:text-paper-accent"
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
            {hymn.stanzas.map((stanza, s) => {
              const verse = verseNumbers[s];
              const isRefrain = verse === null;
              return (
                <section key={s} className={`relative ${isRefrain ? "italic" : ""}`}>
                  {isRefrain ? (
                    <span className="text-label mb-1.5 block">Refrain</span>
                  ) : (
                    verseCount > 1 && (
                      <span
                        aria-hidden
                        className="absolute -left-5 top-[0.42em] font-sans text-[0.65rem] tabular-nums text-paper-faint"
                      >
                        {verse}
                      </span>
                    )
                  )}
                  {!isRefrain && <span className="sr-only">Stanza {verse}. </span>}

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
              );
            })}
          </div>

          {/* Navigation lives in the fixed bottom bar; this just closes the text. */}
          <div aria-hidden className="mx-auto mt-12 h-px w-16 bg-paper-rule" />
      </motion.article>
    </div>
  );
}
