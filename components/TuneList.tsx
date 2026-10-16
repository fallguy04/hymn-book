"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { type SavedTune, useHymnalStore } from "@/store/useHymnalStore";

/**
 * Tunes, laid out as a palette rather than a form: every tune noted for a
 * meter at a glance, so you can look across them and think "that one would
 * suit this". The tray under a hymn's meter shows one meter; Settings shows
 * them all. Both are built from the pieces here.
 */

/** Remove a tune, with a moment to take it back. */
export function useTuneRemoval() {
  const addTune = useHymnalStore((s) => s.addTune);
  const removeTune = useHymnalStore((s) => s.removeTune);
  const [removed, setRemoved] = useState<SavedTune | null>(null);

  return {
    removed,
    remove: (tune: SavedTune) => {
      removeTune(tune.name, tune.meter);
      setRemoved(tune);
    },
    undo: () => {
      if (removed) addTune(removed);
      setRemoved(null);
    },
    dismiss: () => setRemoved(null),
  };
}

export function UndoBar({ tune, onUndo }: { tune: SavedTune; onUndo: () => void }) {
  return (
    <div
      role="status"
      className="mx-5 mb-4 flex items-center justify-between gap-2 rounded-full bg-paper-ink py-1 pl-5 pr-1 text-paper"
    >
      <span className="min-w-0 truncate font-sans text-[0.85rem]">Removed {tune.name}</span>
      <button
        type="button"
        onClick={onUndo}
        className="flex min-h-10 shrink-0 items-center rounded-full px-4 font-sans text-[0.85rem] font-semibold transition-opacity hover:opacity-80"
      >
        Undo
      </button>
    </div>
  );
}

const CHIP =
  "inline-flex min-h-11 max-w-full items-center rounded-full border font-serif text-[1.08rem] leading-none";

/**
 * One meter's tunes as chips, and a chip at the end for adding another.
 * In edit mode each chip removes itself.
 */
export function MeterTunes({
  meter,
  editing,
  canAdd = false,
  onRemove,
}: {
  meter: string;
  editing: boolean;
  canAdd?: boolean;
  onRemove: (tune: SavedTune) => void;
}) {
  const tunes = useHymnalStore((s) => s.tunes);
  const addTune = useHymnalStore((s) => s.addTune);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const field = useRef<HTMLInputElement>(null);

  const mine = tunes.filter((t) => t.meter === meter).sort((a, b) => a.name.localeCompare(b.name));

  const commit = () => {
    const name = draft.trim();
    if (name && !mine.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      addTune({ name, meter });
    }
    setDraft("");
  };

  return (
    <ul className="flex flex-wrap gap-2">
      {mine.map((tune) => (
        <li key={tune.name} className="max-w-full">
          {editing ? (
            <button
              type="button"
              onClick={() => onRemove(tune)}
              aria-label={`Remove ${tune.name}`}
              className={`${CHIP} gap-2 border-paper-faint/50 bg-paper py-2 pl-4 pr-3 text-paper-ink transition-colors hover:border-paper-ink`}
            >
              <span className="truncate">{tune.name}</span>
              <X className="h-4 w-4 shrink-0 text-paper-faint" />
            </button>
          ) : (
            <span className={`${CHIP} border-paper-rule bg-paper-raised px-4 py-2 text-paper-ink shadow-[0_1px_0_var(--rule)]`}>
              <span className="truncate">{tune.name}</span>
            </span>
          )}
        </li>
      ))}

      {canAdd && !editing && (
        <li className="max-w-full">
          {adding ? (
            <input
              ref={field}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter keeps the field open, so a few tunes go in at once.
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setDraft("");
                  setAdding(false);
                }
              }}
              onBlur={() => {
                commit();
                setAdding(false);
              }}
              placeholder="Tune name"
              aria-label={`Add a ${meter} tune`}
              enterKeyHint="done"
              autoCapitalize="words"
              autoComplete="off"
              autoCorrect="off"
              className={`${CHIP} w-44 border-paper-ink bg-paper px-4 py-2 text-paper-ink outline-none placeholder:text-paper-faint`}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className={`${CHIP} gap-1.5 border-dashed border-paper-faint/60 px-4 py-2 font-sans text-[0.9rem] font-semibold text-paper-muted transition-colors hover:border-paper-ink hover:text-paper-ink`}
            >
              <Plus className="h-4 w-4" />
              {mine.length ? "Add" : "Add a tune"}
            </button>
          )}
        </li>
      )}
    </ul>
  );
}

/** Settings → Your tunes: every meter you've noted tunes for. */
export default function TuneList() {
  const tunes = useHymnalStore((s) => s.tunes);
  const [editing, setEditing] = useState(false);
  const { removed, remove, undo } = useTuneRemoval();

  const meters = [...new Set(tunes.map((t) => t.meter))].sort((a, b) => a.localeCompare(b));

  if (meters.length === 0 && !removed) {
    return (
      <p className="px-6 py-10 text-center font-serif italic leading-relaxed text-paper-faint">
        Under each hymn&rsquo;s title is its meter, like C.M. Tap it to start a list of tunes that
        fit, and they collect here.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex justify-end px-3 pt-2">
          {meters.length > 0 && (
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              className="flex min-h-11 items-center rounded-full px-4 font-sans text-[0.9rem] font-semibold text-paper-accent transition-colors hover:bg-paper-sunken"
            >
              {editing ? "Done" : "Edit"}
            </button>
          )}
        </div>
        {meters.map((meter) => (
          <section key={meter} className="px-5 pb-6">
            <h3 className="mb-3 font-serif text-[1.35rem] leading-none text-paper-ink">{meter}</h3>
            <MeterTunes meter={meter} editing={editing} onRemove={remove} />
          </section>
        ))}
      </div>
      {removed && <UndoBar tune={removed} onUndo={undo} />}
    </div>
  );
}
