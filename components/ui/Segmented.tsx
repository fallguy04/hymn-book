"use client";

import type { CSSProperties } from "react";

interface Option<T extends string> {
  id: T;
  label: string;
  /** Spoken label where the visible one is a symbol or a letter. */
  ariaLabel?: string;
  style?: CSSProperties;
}

interface SegmentedProps<T extends string> {
  /** Names the group for a screen reader: "Text size", "Search in". */
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * A row of mutually exclusive choices: theme, text size, author sort, search
 * scope. There were four hand-built copies of this in three styles, and the
 * smallest were 28px tall; every one is now 44px, the minimum a finger can
 * reliably hit.
 *
 * A group of toggles (aria-pressed), not tabs: none of them owns a panel.
 */
export default function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-xl bg-paper-sunken p-1">
      {options.map((option) => {
        const on = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={on}
            aria-label={option.ariaLabel}
            style={option.style}
            className={`min-h-11 min-w-0 flex-1 rounded-lg px-2 font-sans text-[0.85rem] font-semibold transition-colors ${
              on ? "bg-paper text-paper-ink shadow-sm" : "text-paper-muted hover:text-paper-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
