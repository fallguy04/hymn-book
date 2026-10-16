"use client";

import { X } from "lucide-react";
import Overlay, { SheetGrip } from "./ui/Overlay";
import TuneList from "./TuneList";

interface TuneSheetProps {
  meter: string;
  onClose: () => void;
}

/**
 * Tapping a hymn's meter should answer one question straight away — what do we
 * sing this to? — so it opens here rather than sending you into the menu to
 * find the right page. Same store as the list under Settings, so a tune added
 * in either place shows up in both.
 */
export default function TuneSheet({ meter, onClose }: TuneSheetProps) {
  return (
    <Overlay label={`Tunes for ${meter}`} placement="bottom" onClose={onClose} className="max-h-[70dvh]">
      <SheetGrip label="Close tunes" />
      <div className="flex shrink-0 items-start justify-between gap-2 px-4 pb-2">
        <div>
          <p className="text-label">Tunes for this meter</p>
          <h2 className="font-serif text-2xl leading-tight text-paper-ink">{meter}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 items-center justify-center rounded-full text-paper-muted transition-colors hover:bg-paper-sunken"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <TuneList meter={meter} addTo={meter} />
    </Overlay>
  );
}
