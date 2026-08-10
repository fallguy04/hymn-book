"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useHymnalStore } from "@/store/useHymnalStore";

interface TuneListProps {
  /** Show only this meter's tunes. Omit to show every meter, grouped. */
  meter?: string;
  /** Meter a newly added tune belongs to; no add field when absent. */
  addTo?: string;
}

/**
 * The tune repertoire, reading and writing the one store. Both the sheet that
 * opens from a hymn's meter and the drawer's master list render this, so
 * anything added in one shows up in the other with no syncing to do.
 */
export default function TuneList({ meter, addTo }: TuneListProps) {
  const tunes = useHymnalStore((s) => s.tunes);
  const addTune = useHymnalStore((s) => s.addTune);
  const removeTune = useHymnalStore((s) => s.removeTune);
  const [draft, setDraft] = useState("");

  const submit = () => {
    const name = draft.trim();
    if (!name || !addTo) return;
    addTune({ name, meter: addTo });
    setDraft("");
  };

  const shown = meter ? tunes.filter((t) => t.meter === meter) : tunes;

  const groups = new Map<string, typeof tunes>();
  for (const tune of shown) {
    if (!groups.has(tune.meter)) groups.set(tune.meter, []);
    groups.get(tune.meter)!.push(tune);
  }
  const ordered = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {ordered.length === 0 ? (
          <p className="px-4 py-10 text-center font-serif italic leading-relaxed text-paper-faint">
            {meter
              ? `No tunes noted for ${meter} yet.`
              : "Tunes you note against a meter will collect here."}
          </p>
        ) : (
          ordered.map(([groupMeter, list]) => (
            <section key={groupMeter} className="mb-2">
              {/* The heading is redundant when the list is already one meter. */}
              {!meter && <p className="text-label px-4 pb-1 pt-3">{groupMeter}</p>}
              <ul className="space-y-1 px-2">
                {list.map((tune) => (
                  <li
                    key={`${tune.meter}:${tune.name}`}
                    className="flex items-center justify-between gap-2 rounded-xl bg-paper-sunken px-4 py-3"
                  >
                    <span className="min-w-0 truncate font-serif text-[1.05rem] text-paper-ink">
                      {tune.name}
                    </span>
                    <button
                      onClick={() => removeTune(tune.name, tune.meter)}
                      aria-label={`Remove ${tune.name}`}
                      className="shrink-0 rounded-full p-1.5 text-paper-faint transition-colors hover:bg-paper-rule hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      {addTo && (
        <div className="shrink-0 border-t border-paper-rule px-3 py-3">
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={`Add a ${addTo} tune`}
              aria-label={`Add a ${addTo} tune`}
              className="min-w-0 flex-1 rounded-xl border border-paper-rule bg-paper px-3 py-2.5 font-serif text-paper-ink outline-none placeholder:text-paper-faint"
            />
            <button
              onClick={submit}
              disabled={!draft.trim()}
              aria-label="Add tune"
              className="shrink-0 rounded-xl bg-paper-ink px-4 text-paper transition-transform active:scale-95 disabled:opacity-30"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
