"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Music } from "lucide-react";
import { type Hymn, type Hymnal, isNumbered, lineIndent, lineText, sectionPath } from "@/lib/hymnals";

interface HymnViewProps {
  hymnal: Hymnal;
  hymn: Hymn;
  direction: number;
  /** A line under the title: for a song added on this phone, who can see it. */
  note?: string;
  onNext: () => void;
  onPrev: () => void;
  onOpenTunes: () => void;
  onOpenSection: (path: string[]) => void;
  /** Where the reader has scrolled to, for the floating bars to tuck away. */
  onScroll?: (top: number, end: number) => void;
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

/** "OUR" as the book sets it: a full capital, then the rest as small capitals. */
function Opening({ word }: { word: string }) {
  const [, lead = "", first = word, rest = ""] = word.match(/^([^A-Za-z]*)([A-Za-z])([^]*)$/) ?? [];
  return (
    <>
      {lead}
      {first}
      {rest && <span className="opening-caps">{rest}</span>}
    </>
  );
}

export default function HymnView({
  hymnal,
  hymn,
  direction,
  note,
  onNext,
  onPrev,
  onOpenTunes,
  onOpenSection,
  onScroll,
}: HymnViewProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const block = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const here = `${hymnal.id}:${hymn.number}`;

  /**
   * A verse you've tapped, underlined in dots — a finger on the page, the way
   * you'd keep your place in a printed book. Belongs to one hymn: turning the
   * page clears it.
   */
  const [mark, setMark] = useState<{ at: string; stanza: number } | null>(null);
  const marked = mark?.at === here ? mark.stanza : null;
  const pressed = useRef<{ x: number; y: number } | null>(null);

  const tapVerse = (stanza: number, e: React.MouseEvent) => {
    const from = pressed.current;
    pressed.current = null;
    // A swipe to turn the page, or a long press to select words, is not a tap.
    if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > 8) return;
    if (window.getSelection()?.toString()) return;
    navigator.vibrate?.(6);
    setMark(marked === stanza ? null : { at: here, stanza });
  };

  /**
   * Centre the verses on their typical line, not their longest.
   *
   * The block used to be centred on its widest line, and most lines are
   * shorter than that, so the text sat left of centre: on a phone the usual
   * line had three or four times as much space on its right as on its left.
   * Now the block is placed so the average line is centred, as far as the
   * longest line allows without wrapping. Lines stay flush with each other on
   * the left, so the indents that carry the meter still read.
   */
  useLayoutEffect(() => {
    const el = block.current;
    const frame = el?.parentElement;
    if (!el || !frame) return;

    const balance = () => {
      el.style.marginLeft = "";
      el.style.marginRight = "";
      const pad = getComputedStyle(frame);
      const room = frame.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
      // Each line at its natural, unwrapped width, measured in one pass.
      const lines = [...el.querySelectorAll<HTMLElement>(".stanza-line")];
      for (const line of lines) {
        line.style.whiteSpace = "nowrap";
        line.style.width = "max-content";
      }
      const origin = el.getBoundingClientRect().left;
      const reach = lines.map((line) => line.getBoundingClientRect().right - origin);
      for (const line of lines) {
        line.style.whiteSpace = "";
        line.style.width = "";
      }
      if (reach.length === 0) return;
      const typical = reach.reduce((a, b) => a + b, 0) / reach.length;
      const longest = Math.max(...reach);
      const inset = Math.max(0, Math.min((room - typical) / 2, room - longest));
      el.style.marginLeft = `${inset}px`;
      el.style.marginRight = "0";
    };

    balance();
    // Again once the serif face has loaded, and whenever the column or the
    // text size changes.
    document.fonts?.ready.then(balance).catch(() => {});
    const observer = new ResizeObserver(() => balance());
    observer.observe(frame);
    return () => observer.disconnect();
  }, [here]);
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
      onScroll={(e) => {
        const el = e.currentTarget;
        onScroll?.(el.scrollTop, el.scrollHeight - el.clientHeight);
      }}
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
            // A firm flick the other way is a change of mind: dragging past the
            // distance and then throwing it back used to turn the page anyway.
            const cancelled = offset.x * velocity.x < -SWIPE_THRESHOLD;
            if (!cancelled) {
              if (offset.x < -SWIPE_DISTANCE || power < -SWIPE_THRESHOLD) onNext();
              else if (offset.x > SWIPE_DISTANCE || power > SWIPE_THRESHOLD) onPrev();
            }
          }}
          /* min-h-full so a short hymn can still be swiped anywhere on the
             screen, not only across its eight lines of text. hymn-swipe gives
             back the pinch-zoom and text selection the drag gesture takes
             away (see globals.css). */
          className="hymn-swipe mx-auto min-h-full w-full max-w-[var(--measure)] px-7"
          // The bars float over the text, so it starts below the top one and
          // can scroll clear of the capsule at the foot.
          style={{
            paddingTop: "calc(var(--chrome-top) + 1.25rem)",
            paddingBottom: "calc(var(--chrome-bottom) + 2.5rem)",
          }}
        >
          <header className="mb-10 text-center">
            {/* Opens Contents at this section. It used to look like a caption,
                so almost nobody found it; the chevron says it goes somewhere. */}
            {path.length > 0 && (
              <button
                type="button"
                onClick={() => onOpenSection(path)}
                aria-label={`Open Contents at ${path.join(", ")}`}
                className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 font-serif font-semibold uppercase tracking-[0.14em] text-paper-muted transition-colors hover:bg-paper-sunken hover:text-paper-accent"
                style={{ fontSize: "calc(0.74rem * var(--type-scale))" }}
              >
                {path.join(" · ")}
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              </button>
            )}

            {/* The page's one large moment: the number people call out, in gold,
                with the book's own heading for it beneath. A song in More Songs
                has no number anyone uses, so its name takes the place. */}
            {isNumbered(hymnal) ? (
              <>
                <h1
                  className="mt-1 font-serif font-medium leading-none tabular-nums text-paper-accent"
                  style={{ fontSize: "calc(var(--type-base) * 3.4)" }}
                >
                  <span className="sr-only">Hymn </span>
                  {hymn.number}
                </h1>
                {hymn.title && (
                  <p
                    className="mx-auto mt-3 max-w-[22em] text-balance font-serif italic leading-snug text-paper-muted"
                    style={{ fontSize: "calc(var(--type-base) * 1.02)" }}
                  >
                    {hymn.title}
                  </p>
                )}
              </>
            ) : (
              <h1 className="text-balance font-serif text-[calc(var(--type-base)*1.6)] leading-tight text-paper-ink">
                {hymn.title}
              </h1>
            )}

            {(hymn.meter || hymn.author) && (
              <p
                className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-sans text-paper-muted"
                style={{ fontSize: "calc(0.78rem * var(--type-scale))" }}
              >
                {/* The meter is what a song leader picks a tune by. It opens the
                    tunes noted for it, and now looks like it does something. */}
                {hymn.meter && (
                  <button
                    type="button"
                    onClick={onOpenTunes}
                    aria-label={`Tunes for ${hymn.meter}`}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-paper-rule px-3 transition-colors hover:border-paper-faint hover:text-paper-accent"
                  >
                    <Music className="h-3.5 w-3.5" />
                    {hymn.meter}
                  </button>
                )}
                {hymn.author && <span>{hymn.author}</span>}
              </p>
            )}
            {note && (
              <p
                className="mt-3 font-sans text-paper-faint"
                style={{ fontSize: "calc(0.75rem * var(--type-scale))" }}
              >
                {note}
              </p>
            )}
          </header>

          {/*
            Lines stay left-aligned, but the block as a whole is centred on the
            page — the way a printed hymnal sets it. Centring the lines
            themselves would destroy the indentation that carries the metre,
            and leaving the block flush left reads as off-centre under a
            centred title.
          */}
          <div ref={block} className="mx-auto w-fit max-w-full space-y-7">
            {hymn.stanzas.map((stanza, s) => {
              const verse = verseNumbers[s];
              const isRefrain = verse === null;
              return (
                <section
                  key={s}
                  onPointerDown={(e) => {
                    pressed.current = { x: e.clientX, y: e.clientY };
                  }}
                  onClick={(e) => tapVerse(s, e)}
                  className={`relative ${isRefrain ? "italic" : ""} ${marked === s ? "verse-marked" : ""}`}
                >
                  {isRefrain ? (
                    <span className="text-label mb-1.5 block">Refrain</span>
                  ) : (
                    verseCount > 1 && (
                      <span
                        aria-hidden
                        className="absolute -left-5 top-[0.42em] font-sans tabular-nums text-paper-faint"
                        style={{ fontSize: "calc(0.68rem * var(--type-scale))" }}
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
                        // The underline runs down the verse a line at a time.
                        style={marked === s ? { transitionDelay: `${l * 45}ms` } : undefined}
                      >
                        {opening && <Opening word={opening} />}
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
