"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Check, Plus, Send } from "lucide-react";
import type { CommunitySong } from "@/lib/community";
import { parsePastedSong } from "@/lib/song-text";
import { useHymnalStore } from "@/store/useHymnalStore";

interface SuggestSongProps {
  /** What they searched for — prefills the title and rides along as context. */
  query: string;
  hymnalId: string;
  /** "Suggest this song" reads wrong with no search behind it. */
  label?: string;
  /** Settings has its own headings and spacing; the search panel needs neither. */
  compact?: boolean;
  /** Open straight to the form, where the panel exists only for this. */
  startOpen?: boolean;
  /** Open a song once it's added. */
  onOpen?: (number: number, hymnalId: string) => void;
}

type State = "idle" | "open" | "sending" | "error";

/**
 * Add a song, or suggest one.
 *
 * With the words pasted in, it's added: tidied the way `npm run add-song`
 * tidies them, put in More Songs on this phone straight away, and sent to the
 * maintainer, whose approval puts it on everyone's. With only a title it's a
 * suggestion, as it always was.
 *
 * Offered where a search comes up empty (the moment someone knows exactly what
 * the book is missing) and under Settings.
 */
export default function SuggestSong({
  query,
  hymnalId,
  label = "Suggest this song",
  compact = false,
  startOpen = false,
  onOpen,
}: SuggestSongProps) {
  const uid = useId();
  const addMySong = useHymnalStore((s) => s.addMySong);
  const [state, setState] = useState<State>(startOpen ? "open" : "idle");
  const [problem, setProblem] = useState("");
  const [requester, setRequester] = useState("");
  const [title, setTitle] = useState(query);
  const [words, setWords] = useState("");
  const [extra, setExtra] = useState("");
  const [done, setDone] = useState<{ added: CommunitySong | null } | null>(null);
  const titleField = useRef<HTMLInputElement>(null);

  // What the pasted words came out as, before anything is sent.
  const found = useMemo(() => {
    if (!words.trim()) return null;
    const { blocks } = parsePastedSong(words);
    const verses = blocks.filter((b) => !b.refrain).length;
    if (verses === 0) return "Couldn't find any verses yet";
    return `${verses} ${verses === 1 ? "verse" : "verses"}${blocks.some((b) => b.refrain) ? " and a refrain" : ""}`;
  }, [words]);

  const adding = words.trim().length > 0;

  const submit = async () => {
    const cleanTitle = title.trim();
    // Enter calls this directly, skipping the button's disabled state.
    if (!cleanTitle || state === "sending") return;
    setState("sending");
    try {
      const response = adding
        ? await fetch("/api/songs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: cleanTitle, words, author: extra, requester }),
          })
        : await fetch("/api/suggestions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requester, title: cleanTitle, note: extra, query, hymnalId }),
          });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        if (adding && data.song) addMySong(data.song);
        setDone({ added: adding ? (data.song ?? null) : null });
        return;
      }
      setProblem(
        response.status === 429
          ? "Too many from this connection for now. Try again in an hour."
          : typeof data.error === "string" && response.status === 400
            ? data.error
            : "That didn't go through. Try again in a minute.",
      );
      setState("error");
    } catch {
      setProblem("No connection. Try again when you're online.");
      setState("error");
    }
  };

  if (done) {
    return (
      <div
        role="status"
        className={`space-y-3 rounded-2xl bg-paper-sunken px-4 py-4 text-center ${compact ? "" : "mx-auto mt-6 max-w-sm"}`}
      >
        <p className="flex items-center justify-center gap-2 font-serif text-[1rem] text-paper-ink">
          <Check className="h-4 w-4 shrink-0 text-paper-accent" />
          {done.added ? "Added to More Songs" : "Thank you — that’s been passed along."}
        </p>
        {done.added && (
          <>
            <p className="font-sans text-[0.85rem] leading-relaxed text-paper-muted">
              It&rsquo;s on your phone now, and goes to everyone once it&rsquo;s approved.
            </p>
            {onOpen && (
              <button
                type="button"
                onClick={() => onOpen(done.added!.number, hymnalId)}
                className="inline-flex min-h-11 items-center rounded-full bg-paper-accent px-5 font-sans text-sm font-semibold text-paper transition-transform active:scale-95"
              >
                Open it
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  if (state === "idle") {
    return (
      <div className={compact ? "" : "mt-6 text-center"}>
        <button
          type="button"
          onClick={() => {
            setTitle(query);
            setState("open");
          }}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-paper-rule bg-paper-sunken px-4 font-sans text-sm text-paper-ink transition-colors hover:border-paper-faint ${
            compact ? "w-full justify-center" : ""
          }`}
        >
          <Plus className="h-4 w-4 text-paper-muted" />
          {label}
        </button>
      </div>
    );
  }

  const field =
    "w-full rounded-xl border border-paper-rule bg-paper px-3 py-2.5 font-serif text-paper-ink outline-none placeholder:text-paper-faint focus:border-paper-faint";

  return (
    <div
      className={`space-y-2 rounded-2xl border border-paper-rule bg-paper-sunken p-3 text-left ${compact ? "" : "mx-auto mt-6 max-w-sm"}`}
    >
      <label className="text-label block" htmlFor={`${uid}-title`}>
        Song title
      </label>
      <input
        id={`${uid}-title`}
        ref={titleField}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        enterKeyHint="next"
        className={field}
      />

      <label className="text-label block pt-1" htmlFor={`${uid}-words`}>
        Words
      </label>
      <textarea
        id={`${uid}-words`}
        value={words}
        onChange={(e) => setWords(e.target.value)}
        rows={5}
        className={`${field} resize-y leading-snug`}
      />
      {found && <p className="px-1 font-sans text-[0.8rem] text-paper-muted">{found}</p>}

      <label className="text-label block pt-1" htmlFor={`${uid}-extra`}>
        {adding ? "Written by" : "Anything else"}
      </label>
      <input
        id={`${uid}-extra`}
        value={extra}
        onChange={(e) => setExtra(e.target.value)}
        enterKeyHint="next"
        className={field}
      />

      <label className="text-label block pt-1" htmlFor={`${uid}-name`}>
        Your name
      </label>
      <input
        id={`${uid}-name`}
        value={requester}
        onChange={(e) => setRequester(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        enterKeyHint="send"
        autoComplete="name"
        className={field}
      />

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={() => setState("idle")}
          className="min-h-11 rounded-full px-4 font-sans text-sm text-paper-muted transition-colors hover:text-paper-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!title.trim() || state === "sending"}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-paper-accent px-5 font-sans text-sm font-semibold text-paper transition-transform active:scale-95 disabled:opacity-40"
        >
          {adding ? <Plus className="h-4 w-4" /> : <Send className="h-3.5 w-3.5" />}
          {state === "sending" ? "Sending…" : adding ? "Add song" : "Send suggestion"}
        </button>
      </div>

      {state === "error" && (
        <p role="alert" className="rounded-xl bg-paper-accent/15 px-3 py-2 font-sans text-[0.85rem] text-paper-ink">
          {problem}
        </p>
      )}
    </div>
  );
}
