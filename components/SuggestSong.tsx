"use client";

import { useId, useState } from "react";
import { Check, Plus, Send } from "lucide-react";

interface SuggestSongProps {
  /** What they searched for — prefills the title and rides along as context. */
  query: string;
  hymnalId: string;
  /** "Suggest this song" reads wrong with no search behind it. */
  label?: string;
  /** Settings has its own headings and spacing; the search panel needs neither. */
  compact?: boolean;
}

type State = "idle" | "open" | "sending" | "sent" | "error";

/**
 * Offered where a search comes up empty.
 *
 * That is the one moment someone knows exactly what the book is missing, and
 * asking then costs them a tap rather than a trip to find someone to tell. It
 * stays collapsed to a single line until asked for, so a search that simply
 * found nothing doesn't turn into a form.
 */
export default function SuggestSong({
  query,
  hymnalId,
  label = "Suggest this song",
  compact = false,
}: SuggestSongProps) {
  // The sidebar renders these panels permanently on desktop, so opening
  // Settings' form and then ⌘K put two identical forms on the page — every
  // htmlFor then pointed at the first one, and assistive tech read the wrong
  // label for the second.
  const uid = useId();
  const [state, setState] = useState<State>("idle");
  const [requester, setRequester] = useState("");
  const [title, setTitle] = useState(query);
  const [note, setNote] = useState("");

  const submit = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    setState("sending");
    try {
      const response = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requester, title: cleanTitle, note, query, hymnalId }),
      });
      setState(response.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <div
        role="status"
        className={`flex items-center justify-center gap-2 rounded-2xl bg-paper-sunken px-4 py-3 text-center ${compact ? "" : "mx-auto mt-6 max-w-sm"}`}
      >
        <Check className="h-4 w-4 shrink-0 text-paper-accent" />
        <p className="font-serif text-[0.95rem] text-paper-ink">
          Thank you — that&rsquo;s been passed along.
        </p>
      </div>
    );
  }

  if (state === "idle") {
    return (
      <div className={compact ? "" : "mt-6 text-center"}>
        <button
          onClick={() => {
            setTitle(query);
            setState("open");
          }}
          className={`inline-flex items-center gap-2 rounded-full border border-paper-rule bg-paper-sunken px-4 py-2 font-sans text-sm text-paper-ink transition-colors hover:border-paper-faint ${
            compact ? "w-full justify-center" : ""
          }`}
        >
          <Plus className="h-4 w-4 text-paper-muted" />
          {label}
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-2 rounded-2xl border border-paper-rule bg-paper-sunken p-3 text-left ${compact ? "" : "mx-auto mt-6 max-w-sm"}`}>
      <label className="text-label block" htmlFor={`${uid}-name`}>
        Your name
      </label>
      <input
        id={`${uid}-name`}
        value={requester}
        onChange={(e) => setRequester(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Who's asking"
        autoComplete="name"
        className="w-full rounded-xl border border-paper-rule bg-paper px-3 py-2 font-serif text-paper-ink outline-none placeholder:text-paper-faint"
      />

      <label className="text-label block pt-1" htmlFor={`${uid}-title`}>
        Song title
      </label>
      <input
        id={`${uid}-title`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Title of the song"
        className="w-full rounded-xl border border-paper-rule bg-paper px-3 py-2 font-serif text-paper-ink outline-none placeholder:text-paper-faint"
      />

      <label className="text-label block pt-1" htmlFor={`${uid}-note`}>
        Anything else <span className="normal-case tracking-normal">(optional)</span>
      </label>
      <input
        id={`${uid}-note`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Where it's from, who sings it…"
        className="w-full rounded-xl border border-paper-rule bg-paper px-3 py-2 font-serif text-paper-ink outline-none placeholder:text-paper-faint"
      />

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          onClick={() => setState("idle")}
          className="rounded-full px-3 py-2 font-sans text-xs text-paper-muted transition-colors hover:text-paper-ink"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!title.trim() || state === "sending"}
          className="inline-flex items-center gap-2 rounded-full bg-paper-ink px-4 py-2 font-sans text-xs font-semibold text-paper transition-transform active:scale-95 disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
          {state === "sending" ? "Sending…" : "Send suggestion"}
        </button>
      </div>

      {state === "error" && (
        <p role="alert" className="pt-1 font-sans text-[0.7rem] text-red-700 dark:text-red-400">
          That didn&rsquo;t go through. Worth trying again in a moment.
        </p>
      )}
    </div>
  );
}
