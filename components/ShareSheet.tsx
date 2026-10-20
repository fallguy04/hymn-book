"use client";

import { useMemo, useState } from "react";
import { Check, Link2, Send, X } from "lucide-react";
import qrcode from "qrcode-generator";
import { type Hymn, type Hymnal, isNumbered } from "@/lib/hymnals";
import { hymnHeading, hymnPath, primaryName } from "@/lib/books";
import Overlay from "./ui/Overlay";

interface ShareSheetProps {
  hymnal: Hymnal;
  hymn: Hymn;
  onClose: () => void;
}

/* Shapes measured, not guessed: this rendering was decoded with jsQR across
   every URL length a deployment can produce. Finder rounding of 1.2 modules
   decodes while 2.0 does not; a 4% dot gap decodes while 8% does not. Change
   them only with a fresh round-trip test. */
const GAP = 0.04;
const DOT_RADIUS = 0.3;
const FINDER_RADIUS = 1.2;
/** The clear margin a scanner needs around the code, in modules. */
const QUIET = 4;

/**
 * Two ways to pass a hymn on: hold up your phone, or send the link.
 *
 * The card is just the code and the hymn's name. It used to be a bookplate —
 * a double frame, a paper plate, a code that drew itself in bands — which was
 * handsome once and a lot to look past every time after.
 *
 * The code is drawn in the theme's own ink, so at night it is pale on dark
 * rather than a white square lighting up a dim room. Phone cameras read an
 * inverted code; the quiet zone is kept at the full four modules either way.
 *
 * "Send link" opens the phone's own share sheet (Messages, WhatsApp, email…),
 * for the person who isn't standing beside you. Where a browser has no share
 * sheet, the link is copied instead.
 */
export default function ShareSheet({ hymnal, hymn, onClose }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);
  const url = `${location.origin}${hymnPath(hymnal, hymn.number)}`;
  const canShare = typeof navigator.share === "function";
  const heading = hymnHeading(hymnal, hymn);
  const name = primaryName(hymnal, hymn);

  const { count, dots } = useMemo(() => {
    const qr = qrcode(0, "Q");
    qr.addData(url);
    qr.make();
    const n = qr.getModuleCount();
    // The three finder squares are drawn whole below: a decoder finds them by
    // scanning for unbroken 1:1:3:1:1 runs, which per-module dots would break.
    const inFinder = (r: number, c: number) =>
      (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
    const cells: [number, number][] = [];
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) if (qr.isDark(r, c) && !inFinder(r, c)) cells.push([r, c]);
    return { count: n, dots: cells };
  }, [url]);

  const finders: [number, number][] = [
    [0, 0],
    [0, count - 7],
    [count - 7, 0],
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Refused clipboard access: the code is still on screen to scan.
    }
  };

  const send = async () => {
    try {
      await navigator.share({
        title: heading,
        text: isNumbered(hymnal) ? `${heading} · ${name}` : name,
        url,
      });
    } catch (e) {
      // Closing the share sheet without choosing anything is not an error.
      if ((e as Error).name !== "AbortError") copy();
    }
  };

  return (
    <Overlay label={`Share ${heading}`} placement="center" onClose={onClose} className="relative w-full max-w-[20rem] p-5">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-paper-faint transition-colors hover:bg-paper-sunken hover:text-paper-muted"
      >
        <X className="h-5 w-5" />
      </button>

      <svg
        viewBox={`${-QUIET} ${-QUIET} ${count + QUIET * 2} ${count + QUIET * 2}`}
        role="img"
        aria-label={`QR code that opens ${heading}`}
        className="mx-auto mt-4 block h-auto w-full max-w-[15rem] text-paper-ink"
      >
        {finders.map(([r, c]) => (
          <g key={`${r}-${c}`}>
            <rect x={c} y={r} width={7} height={7} rx={FINDER_RADIUS} fill="currentColor" />
            <rect x={c + 1} y={r + 1} width={5} height={5} style={{ fill: "var(--surface)" }} />
            <rect x={c + 2} y={r + 2} width={3} height={3} rx={0.9} fill="currentColor" />
          </g>
        ))}
        {dots.map(([r, c]) => (
          <rect
            key={`${r}-${c}`}
            x={c + GAP}
            y={r + GAP}
            width={1 - GAP * 2}
            height={1 - GAP * 2}
            rx={DOT_RADIUS}
            fill="currentColor"
          />
        ))}
      </svg>

      <div className="mt-1 text-center">
        <p className="font-serif text-[1.35rem] leading-tight text-paper-ink">{heading}</p>
        {isNumbered(hymnal) && (
          <p className="mt-0.5 line-clamp-1 font-serif text-[0.95rem] text-paper-muted">{name}</p>
        )}
      </div>

      <div className="mt-5 space-y-2">
        {canShare && (
          <button
            type="button"
            onClick={send}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-paper-accent font-sans text-[0.95rem] font-semibold text-paper transition-transform active:scale-[0.98]"
          >
            <Send className="h-4 w-4" />
            Send link
          </button>
        )}
        <button
          type="button"
          onClick={copy}
          className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl font-sans text-[0.95rem] font-semibold transition-colors ${
            canShare
              ? "text-paper-muted hover:bg-paper-sunken hover:text-paper-ink"
              : "bg-paper-accent text-paper"
          }`}
        >
          {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          {copied ? "Link copied" : "Copy link"}
        </button>
        <p role="status" className="sr-only">
          {copied ? "Link copied" : ""}
        </p>
      </div>
    </Overlay>
  );
}
