"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import qrcode from "qrcode-generator";
import { type Hymn, type Hymnal, hymnTitle, isNumbered } from "@/lib/hymnals";
import { useDialog } from "@/lib/useDialog";

interface ShareSheetProps {
  hymnal: Hymnal;
  hymn: Hymn;
  onClose: () => void;
}

/**
 * A QR code styled like a bookplate, presented like a gift.
 *
 * The whole sharing system is this one card: you hold your phone up, they
 * point a camera at it, and the app opens on the hymn you are looking at.
 * No accounts, no share sheet, no server — the code is drawn on the device,
 * so it works at a camp with no signal.
 *
 * The card is always paper-coloured, even in dark mode — partly because a QR
 * must be dark-on-light for every scanner to read it, but mostly because what
 * you are handing someone is a page from the book.
 */

/* The styling below is measured, not guessed. This exact rendering was run
   through jsQR — a decoder far stricter than any phone camera — across every
   URL length a deployment can produce: finder rounding of 1.2 modules decodes
   while 2.0 does not, and a 5% dot gap decodes while 8% does not. Change the
   shapes and re-run the round-trip test before trusting the result. */
const GAP = 0.04;
const DOT_RADIUS = 0.3;
const FINDER_RADIUS = 1.2;

/* Hard-coded rather than tokens: the card must not follow the theme. */
const INK = "#241f1a";
const PAPER = "#fdfbf7";
const RULE = "#e0d9cb";
const FAINT = "#726b60";

/** Diagonal r+c distance each animation band covers. ~13 bands on a v5 code. */
const BAND = 6;

export default function ShareSheet({ hymnal, hymn, onClose }: ShareSheetProps) {
  const reduceMotion = useReducedMotion();
  const panel = useDialog<HTMLDivElement>();

  const { count, finders, bands } = useMemo(() => {
    const url =
      `${location.origin}/?h=${hymn.number}` + (hymnal.isDefault ? "" : `&b=${hymnal.id}`);

    const qr = qrcode(0, "Q");
    qr.addData(url);
    qr.make();
    const n = qr.getModuleCount();

    // The three finder squares are drawn as whole shapes below, not module by
    // module — a decoder finds them by scanning for unbroken 1:1:3:1:1 runs,
    // which per-module styling would slice apart.
    const inFinder = (r: number, c: number) =>
      (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

    const byBand = new Map<number, [number, number][]>();
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c) || inFinder(r, c)) continue;
        const band = Math.floor((r + c) / BAND);
        byBand.set(band, [...(byBand.get(band) ?? []), [r, c]]);
      }

    return {
      count: n,
      finders: [
        [0, 0],
        [0, n - 7],
        [n - 7, 0],
      ] as [number, number][],
      bands: [...byBand.entries()].sort(([a], [b]) => a - b).map(([, cells]) => cells),
    };
  }, [hymnal, hymn.number]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]"
      />

      {/* The wrapper ignores the pointer so a tap beside the card reaches the
          backdrop and closes, the way every other layer here closes. */}
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-6">
        <motion.div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label="Share this hymn"
          tabIndex={-1}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reduceMotion ? 0.15 : 0.24, ease: "easeOut" }}
          style={{ backgroundColor: PAPER, backgroundImage: "var(--paper-noise)" }}
          className="pointer-events-auto relative w-full max-w-[19.5rem] rounded-3xl p-6 pb-5 shadow-2xl"
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-2.5 top-2.5 rounded-full p-2 transition-colors hover:bg-black/[0.04]"
            style={{ color: FAINT }}
          >
            <X className="h-4 w-4" />
          </button>

          <p
            className="mb-4 text-center font-sans text-[0.62rem] font-semibold uppercase tracking-[0.18em]"
            style={{ color: FAINT }}
          >
            Share this {isNumbered(hymnal) ? "hymn" : "song"}
          </p>

          {/* A bookplate: two hairline rules around the code, the way a
              printed hymnal frames its presentation page. */}
          <div className="rounded-2xl border p-1.5" style={{ borderColor: RULE }}>
            <div className="rounded-xl border p-3.5" style={{ borderColor: RULE }}>
              <svg
                viewBox={`0 0 ${count} ${count}`}
                role="img"
                aria-label="QR code that opens this hymn"
                className="block h-auto w-full"
              >
                {finders.map(([fr, fc], i) => (
                  <motion.g
                    key={i}
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.55 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 340, damping: 24, delay: 0.1 + i * 0.06 }
                    }
                    style={{ transformBox: "fill-box", transformOrigin: "center" }}
                  >
                    <rect x={fc} y={fr} width={7} height={7} rx={FINDER_RADIUS} fill={INK} />
                    <rect x={fc + 1} y={fr + 1} width={5} height={5} fill={PAPER} />
                    <rect x={fc + 2} y={fr + 2} width={3} height={3} rx={0.9} fill={INK} />
                  </motion.g>
                ))}

                {bands.map((cells, i) => (
                  <motion.g
                    key={i}
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: reduceMotion ? 0 : 0.2, delay: reduceMotion ? 0 : 0.14 + i * 0.026 }}
                  >
                    {cells.map(([r, c]) => (
                      <rect
                        key={`${r}-${c}`}
                        x={c + GAP}
                        y={r + GAP}
                        width={1 - GAP * 2}
                        height={1 - GAP * 2}
                        rx={DOT_RADIUS}
                        fill={INK}
                      />
                    ))}
                  </motion.g>
                ))}
              </svg>
            </div>
          </div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: reduceMotion ? 0 : 0.42 }}
            className="mt-4 text-center"
          >
            {isNumbered(hymnal) ? (
              <>
                <p className="font-serif text-[1.35rem] leading-tight" style={{ color: INK }}>
                  Hymn <span className="tabular-nums">{hymn.number}</span>
                </p>
                <p className="mt-0.5 line-clamp-1 font-serif text-sm" style={{ color: FAINT }}>
                  {hymnTitle(hymn)}
                </p>
              </>
            ) : (
              <p className="line-clamp-2 font-serif text-[1.2rem] leading-tight" style={{ color: INK }}>
                {hymnTitle(hymn)}
              </p>
            )}
            <p className="mt-3 font-sans text-[0.7rem] leading-relaxed" style={{ color: FAINT }}>
              Point a camera at the code — it opens this {isNumbered(hymnal) ? "hymn" : "song"}.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
}
