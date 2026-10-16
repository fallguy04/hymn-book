"use client";

import { useState } from "react";
import { useHymnalStore } from "@/store/useHymnalStore";
import Overlay, { SheetGrip } from "./ui/Overlay";
import { MeterTunes, UndoBar, useTuneRemoval } from "./TuneList";

interface TuneSheetProps {
  meter: string;
  onClose: () => void;
}

/**
 * The tunes you've noted for this hymn's meter, opened from the meter under
 * its title. Same store as Settings → Your tunes, so a tune added in either
 * place shows up in both, and on every hymn that shares the meter.
 */
export default function TuneSheet({ meter, onClose }: TuneSheetProps) {
  const count = useHymnalStore((s) => s.tunes.filter((t) => t.meter === meter).length);
  const [editing, setEditing] = useState(false);
  const { removed, remove, undo } = useTuneRemoval();

  return (
    <Overlay label={`Tunes for ${meter}`} placement="bottom" onClose={onClose} className="max-h-[75dvh]">
      <SheetGrip label="Close tunes" />

      <div className="flex shrink-0 items-end justify-between gap-3 pb-5 pl-6 pr-3">
        <div className="min-w-0">
          <p className="text-label">Tunes</p>
          <h2 className="mt-1.5 truncate font-serif text-[2.1rem] leading-none text-paper-ink">{meter}</h2>
        </div>
        {(count > 0 || editing) && (
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="flex min-h-11 shrink-0 items-center rounded-full px-4 font-sans text-[0.9rem] font-semibold text-paper-accent transition-colors hover:bg-paper-sunken"
          >
            {editing ? "Done" : "Edit"}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8">
        <MeterTunes meter={meter} editing={editing && count > 0} canAdd onRemove={remove} />
      </div>

      {removed && <UndoBar tune={removed} onUndo={undo} />}
    </Overlay>
  );
}
