"use client";

import { useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { CODE_LENGTH, formatCode, isCode, normalizeCode } from "@/lib/sync";
import { countAll, useHymnalStore } from "@/store/useHymnalStore";

/** A request that fails in words a person can act on. */
async function request(url: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    // Offline is the common case for this app, and the browser's own message
    // for it ("Failed to fetch", "Load failed") means nothing to anyone.
    throw new Error("No connection. Try again when you're online.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.error === "string" ? data.error : "";
    if (response.status === 503 || !message) {
      throw new Error("Moving to another device isn't working right now. Try again later.");
    }
    throw new Error(message);
  }
  return data;
}

/** "today at 3:40 PM" or "tomorrow at 3:40 PM", relative to `now`. */
const untilLabel = (ms: number, now: number) => {
  const time = new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const sameDay = new Date(ms).toDateString() === new Date(now).toDateString();
  return `${sameDay ? "today" : "tomorrow"} at ${time}`;
};

/**
 * Carrying your stars and tunes to another device: make a code here, type it
 * there. No account and no sign-in.
 *
 * The code is kept in the store until it expires. It used to live in this
 * panel's state, so closing the menu to go and pick up the other phone threw
 * it away — the one moment you need it.
 */
export default function SyncPanel() {
  const favorites = useHymnalStore((s) => s.favorites);
  const tunes = useHymnalStore((s) => s.tunes);
  const applySync = useHymnalStore((s) => s.applySync);
  const held = useHymnalStore((s) => s.heldCode);
  const holdCode = useHymnalStore((s) => s.holdCode);

  const [copied, setCopied] = useState(false);
  const [entry, setEntry] = useState("");
  const [busy, setBusy] = useState<"give" | "take" | null>(null);
  const [giveError, setGiveError] = useState<string | null>(null);
  const [takeError, setTakeError] = useState<string | null>(null);
  const [restored, setRestored] = useState<string | null>(null);

  // Read at render: an expired code simply stops showing.
  const [now] = useState(() => Date.now());
  const code = held && held.expiresAt > now ? held : null;

  const starred = countAll(favorites);
  const nothingToSend = starred === 0 && tunes.length === 0;

  const create = async () => {
    setBusy("give");
    setGiveError(null);
    try {
      const data = await request("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Stars and tunes only. Display settings belong to each device.
        body: JSON.stringify({ favorites, tunes }),
      });
      holdCode({ code: data.code, expiresAt: Date.now() + (data.expiresInHours ?? 24) * 3600_000 });
      setCopied(false);
    } catch (e) {
      setGiveError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const redeem = async () => {
    if (busy) return;
    const clean = normalizeCode(entry);
    if (clean.length !== CODE_LENGTH) {
      setTakeError(`A code is ${CODE_LENGTH} letters and numbers.`);
      return;
    }
    if (!isCode(clean)) {
      setTakeError("That code has a letter or number codes never use. Check it against the other device.");
      return;
    }
    setBusy("take");
    setTakeError(null);
    setRestored(null);
    try {
      const data = await request(`/api/sync?code=${clean}`);
      applySync({
        favorites: data.payload?.favorites ?? {},
        tunes: data.payload?.tunes ?? [],
      });
      const state = useHymnalStore.getState();
      const stars = countAll(state.favorites);
      setRestored(
        `Added. This device now has ${stars} starred ${stars === 1 ? "hymn" : "hymns"} and ${
          state.tunes.length
        } ${state.tunes.length === 1 ? "tune" : "tunes"}.`,
      );
      setEntry("");
    } catch (e) {
      setTakeError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the code is on screen to read anyway.
    }
  };

  return (
    <div className="space-y-7 px-4 py-5">
      <section className="space-y-3">
        <h3 className="font-serif text-[1.2rem] text-paper-ink">From this device</h3>
        {code ? (
          <div className="rounded-2xl border border-paper-rule bg-paper-sunken p-4 text-center">
            <p className="font-serif text-[2.1rem] tracking-[0.15em] text-paper-ink">{formatCode(code.code)}</p>
            <button
              type="button"
              onClick={copy}
              className="mx-auto mt-1 flex min-h-11 items-center gap-1.5 rounded-full px-4 font-sans text-sm font-semibold text-paper-muted transition-colors hover:bg-paper hover:text-paper-ink"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <p className="mt-2 font-sans text-[0.85rem] leading-relaxed text-paper-muted">
              Type this on the other device before {untilLabel(code.expiresAt, now)}.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={create}
            disabled={busy !== null || nothingToSend}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-paper-ink font-sans text-[0.95rem] font-semibold text-paper transition-opacity disabled:opacity-35"
          >
            {busy === "give" && <Loader2 className="h-4 w-4 animate-spin" />}
            Get a code
          </button>
        )}
        <p className="font-sans text-[0.85rem] leading-relaxed text-paper-muted">
          {nothingToSend
            ? "Nothing to carry yet. Star a hymn first."
            : `Carries your ${starred} starred ${starred === 1 ? "hymn" : "hymns"} and ${tunes.length} ${
                tunes.length === 1 ? "tune" : "tunes"
              }.`}
        </p>
        {giveError && (
          <p role="alert" className="rounded-xl bg-paper-accent/15 px-3 py-2.5 font-sans text-[0.85rem] text-paper-ink">
            {giveError}
          </p>
        )}
      </section>

      <section className="space-y-3 border-t border-paper-rule pt-6">
        <h3 className="font-serif text-[1.2rem] text-paper-ink">Have a code?</h3>
        <label htmlFor="sync-code" className="sr-only">
          Code from the other device
        </label>
        <input
          id="sync-code"
          value={entry}
          onChange={(e) => {
            setEntry(normalizeCode(e.target.value));
            setTakeError(null);
            setRestored(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && redeem()}
          placeholder="6 letters and numbers"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="min-h-12 w-full rounded-2xl border border-paper-rule bg-paper px-4 text-center font-serif text-xl tracking-[0.2em] text-paper-ink outline-none placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:text-paper-faint focus:border-paper-faint"
        />
        <button
          type="button"
          onClick={redeem}
          disabled={busy !== null || entry.length === 0}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-paper-rule font-sans text-[0.95rem] font-semibold text-paper-ink transition-colors hover:bg-paper-sunken disabled:opacity-35"
        >
          {busy === "take" && <Loader2 className="h-4 w-4 animate-spin" />}
          Add from this code
        </button>
        {takeError && (
          <p role="alert" className="rounded-xl bg-paper-accent/15 px-3 py-2.5 font-sans text-[0.85rem] text-paper-ink">
            {takeError}
          </p>
        )}
        {restored && (
          <p role="status" className="rounded-xl bg-paper-sunken px-3 py-2.5 font-sans text-[0.85rem] text-paper-ink">
            {restored}
          </p>
        )}
        <p className="font-sans text-[0.85rem] leading-relaxed text-paper-muted">
          Adds to what&rsquo;s already here; nothing on this device is replaced, and your text size
          and colours stay as they are.
        </p>
      </section>

      <p className="font-sans text-[0.8rem] leading-relaxed text-paper-faint">
        A code holds only hymn numbers and tune names. No name, no email, nothing that says who you
        are. It deletes itself after a day.
      </p>
    </div>
  );
}
