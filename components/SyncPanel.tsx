"use client";

import { useState } from "react";
import { Check, Copy, Loader2, ArrowRight } from "lucide-react";
import { CODE_LENGTH, formatCode, normalizeCode, isCode } from "@/lib/sync";
import { countAll, useHymnalStore, type Theme, type TextSize } from "@/store/useHymnalStore";

/**
 * Carrying your starred hymns, tunes and settings to another device.
 *
 * Two halves, because there are exactly two things anyone wants to do here:
 * put this device's data somewhere, or pull another device's data down. No
 * account, no sign-in, no background sync that fires while you're mid-verse —
 * you press a button when you mean to, which was the whole point.
 */
export default function SyncPanel() {
  const favorites = useHymnalStore((s) => s.favorites);
  const tunes = useHymnalStore((s) => s.tunes);
  const theme = useHymnalStore((s) => s.theme);
  const textSize = useHymnalStore((s) => s.textSize);
  const applySync = useHymnalStore((s) => s.applySync);

  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [entry, setEntry] = useState("");
  const [busy, setBusy] = useState<"give" | "take" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState<number | null>(null);

  const create = async () => {
    setBusy("give");
    setError(null);
    setRestored(null);
    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorites, tunes, theme, textSize }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not make a code.");
      setCode(data.code);
      setCopied(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not make a code.");
    } finally {
      setBusy(null);
    }
  };

  const redeem = async () => {
    const clean = normalizeCode(entry);
    if (!isCode(clean)) {
      setError(`A code is ${CODE_LENGTH} characters.`);
      return;
    }
    setBusy("take");
    setError(null);
    setRestored(null);
    try {
      const response = await fetch(`/api/sync?code=${clean}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not find that code.");
      applySync({
        favorites: data.payload.favorites,
        tunes: data.payload.tunes,
        theme: data.payload.theme as Theme,
        textSize: data.payload.textSize as TextSize,
      });
      // The total after merging, not the number that arrived. Reporting the
      // incoming count told someone who already had ten stars that they now
      // had one, which reads like the code just wiped them.
      setRestored(countAll(useHymnalStore.getState().favorites));
      setEntry("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not find that code.");
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the code is on screen to read anyway.
    }
  };

  const starred = countAll(favorites);
  const nothingToSend = starred === 0 && tunes.length === 0;

  return (
    <div className="space-y-6 px-4 py-4">
      <section>
        <p className="text-label mb-2">Move to another device</p>

        {code ? (
          <div className="rounded-2xl border border-paper-rule bg-paper-sunken p-4 text-center">
            <p className="font-serif text-[2rem] tracking-[0.15em] text-paper-ink">
              {formatCode(code)}
            </p>
            <button
              onClick={copy}
              className="mx-auto mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[0.7rem] font-semibold text-paper-muted transition-colors hover:bg-paper hover:text-paper-ink"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <p className="mt-3 font-sans text-[0.7rem] leading-relaxed text-paper-faint">
              Type this into the other device within a day. After that it stops working.
            </p>
          </div>
        ) : (
          <button
            onClick={create}
            disabled={busy !== null || nothingToSend}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-paper-rule bg-paper-sunken py-3 font-sans text-sm font-semibold text-paper-ink transition-colors hover:border-paper-faint disabled:opacity-40"
          >
            {busy === "give" && <Loader2 className="h-4 w-4 animate-spin" />}
            Get a code
          </button>
        )}

        <p className="mt-2 font-sans text-[0.7rem] leading-relaxed text-paper-faint">
          {nothingToSend
            ? "Nothing to carry over yet — star a hymn or save a tune first."
            : `Carries ${starred} starred ${
                starred === 1 ? "hymn" : "hymns"
              } and ${tunes.length} saved ${tunes.length === 1 ? "tune" : "tunes"}.`}
        </p>
      </section>

      <section className="border-t border-paper-rule pt-5">
        <p className="text-label mb-2">Have a code?</p>
        <div className="flex gap-2">
          <input
            value={entry}
            onChange={(e) => setEntry(normalizeCode(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && redeem()}
            placeholder="K7P Q4M"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Sync code"
            className="min-w-0 flex-1 rounded-xl border border-paper-rule bg-paper px-3 py-2.5 text-center font-serif text-lg tracking-[0.2em] text-paper-ink outline-none placeholder:tracking-normal placeholder:text-paper-faint focus:border-paper-faint"
          />
          <button
            onClick={redeem}
            disabled={busy !== null || entry.length === 0}
            aria-label="Restore from this code"
            className="flex shrink-0 items-center justify-center rounded-xl bg-paper-ink px-4 text-paper transition-opacity disabled:opacity-30"
          >
            {busy === "take" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-2 font-sans text-[0.7rem] leading-relaxed text-paper-faint">
          Your own stars and tunes are kept — a code adds to what is here rather than replacing it.
        </p>
      </section>

      {error && (
        <p className="rounded-xl bg-paper-accent/10 px-3 py-2.5 font-sans text-[0.75rem] text-paper-accent">
          {error}
        </p>
      )}

      {restored !== null && (
        <p className="rounded-xl bg-paper-sunken px-3 py-2.5 font-sans text-[0.75rem] text-paper-ink">
          Restored. You now have {restored} starred {restored === 1 ? "hymn" : "hymns"}.
        </p>
      )}

      <section className="border-t border-paper-rule pt-4">
        <p className="font-sans text-[0.7rem] leading-relaxed text-paper-faint">
          A code holds only hymn numbers, tune names and your display settings — no name, no email,
          nothing that says who you are. It deletes itself after a day.
        </p>
      </section>
    </div>
  );
}
