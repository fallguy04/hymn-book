"use client";

import { useState } from "react";
import { X, BookOpen, Users, Star, Music, Settings, ChevronRight, ChevronLeft } from "lucide-react";
import { type Hymnal, getHymn, hymnTitle, listHymnals, authorIndex } from "@/lib/hymnals";
import { useHymnalStore, type TextSize, type Theme } from "@/store/useHymnalStore";
import TableOfContents from "./TableOfContents";
import AuthorIndex from "./AuthorIndex";
import TuneList from "./TuneList";

export type Panel = "contents" | "authors" | "favorites" | "tunes" | "settings";

const PANELS: { id: Panel; label: string; icon: typeof BookOpen }[] = [
  { id: "contents", label: "Contents", icon: BookOpen },
  { id: "authors", label: "Authors", icon: Users },
  { id: "favorites", label: "Favorites", icon: Star },
  { id: "tunes", label: "Tunes", icon: Music },
  { id: "settings", label: "Settings", icon: Settings },
];

/**
 * Everything you can browse — contents, authors, favorites, tunes, settings —
 * as one component, so the phone's drawer and the desktop sidebar are the same
 * thing in two frames rather than two implementations to keep in step.
 *
 * Two levels: a root menu of full-width rows, and one panel at a time with a
 * back button. Each row is a comfortable target on a phone and reads as a
 * normal sidebar on a desktop.
 */
export default function BrowsePanels({
  hymnal,
  currentMeter,
  openPath,
  initialPanel,
  onSelect,
  onClose,
}: {
  hymnal: Hymnal;
  currentMeter: string;
  openPath?: string[];
  initialPanel?: Panel;
  onSelect: (n: number) => void;
  /** Omitted when this is a permanent sidebar — there is nothing to close. */
  onClose?: () => void;
}) {
  const [panel, setPanel] = useState<Panel | null>(initialPanel ?? null);
  const favorites = useHymnalStore((s) => s.favorites);
  const tunes = useHymnalStore((s) => s.tunes);
  const setHymnal = useHymnalStore((s) => s.setHymnal);

  const counts: Record<Panel, number | null> = {
    contents: hymnal.hymns.length,
    authors: authorIndex(hymnal).length,
    favorites: favorites.length,
    tunes: tunes.length,
    settings: null,
  };

  const active = panel ? PANELS.find((p) => p.id === panel)! : null;

  return (
    <>
      <header className="flex shrink-0 items-center gap-1 border-b border-paper-rule px-2 py-3">
        {active ? (
          <>
            <button
              onClick={() => setPanel(null)}
              aria-label="Back to menu"
              className="rounded-full p-2 text-paper-muted transition-colors hover:bg-paper-sunken hover:text-paper-ink"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="flex-1 font-serif text-xl text-paper-ink">{active.label}</h2>
          </>
        ) : (
          <div className="flex-1 px-2">
            <h2 className="font-serif text-lg leading-tight text-paper-ink">{hymnal.title}</h2>
            <p className="mt-0.5 font-sans text-[0.7rem] text-paper-faint">{hymnal.subtitle}</p>
          </div>
        )}

        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-full p-2 text-paper-muted transition-colors hover:bg-paper-sunken"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </header>

      {/* Book switcher only earns its space once there's a second book. */}
      {!active && listHymnals().length > 1 && (
        <div className="shrink-0 border-b border-paper-rule px-4 py-3">
          <label className="text-label mb-1.5 block">Hymnal</label>
          <select
            value={hymnal.id}
            onChange={(e) => setHymnal(e.target.value)}
            className="w-full rounded-xl bg-paper-sunken px-3 py-2.5 font-sans text-sm text-paper-ink"
          >
            {listHymnals().map((h) => (
              <option key={h.id} value={h.id}>
                {h.shortName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {!active && (
          <nav className="flex-1 overflow-y-auto overscroll-contain p-2">
            <ul className="space-y-1">
              {PANELS.map(({ id, label, icon: Icon }) => (
                <li key={id}>
                  <button
                    onClick={() => setPanel(id)}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-paper-sunken"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper-sunken text-paper-muted">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 font-serif text-[1.05rem] text-paper-ink">
                      {label}
                    </span>
                    {counts[id] !== null && (
                      <span className="shrink-0 font-sans text-[0.7rem] tabular-nums text-paper-faint">
                        {counts[id]}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-paper-faint" />
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {panel === "contents" && (
          <div className="flex-1 overflow-y-auto overscroll-contain px-1 py-2">
            <TableOfContents hymnal={hymnal} openPath={openPath} onSelect={onSelect} />
          </div>
        )}

        {panel === "authors" && (
          <div className="flex-1 overflow-y-auto overscroll-contain px-1 py-2">
            <AuthorIndex hymnal={hymnal} onSelect={onSelect} />
          </div>
        )}

        {panel === "favorites" && (
          <div className="flex-1 overflow-y-auto overscroll-contain px-1 py-2">
            <HymnList
              hymnal={hymnal}
              numbers={favorites}
              empty="Star a hymn to keep it here."
              onSelect={onSelect}
            />
          </div>
        )}

        {panel === "tunes" && <TuneList addTo={currentMeter || undefined} />}

        {panel === "settings" && (
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <SettingsPanel />
          </div>
        )}
      </div>
    </>
  );
}

function HymnList({
  hymnal,
  numbers,
  empty,
  onSelect,
}: {
  hymnal: Hymnal;
  numbers: number[];
  empty: string;
  onSelect: (n: number) => void;
}) {
  if (numbers.length === 0) {
    return <p className="px-4 py-10 text-center font-serif italic text-paper-faint">{empty}</p>;
  }
  return (
    <ul>
      {numbers.map((n) => {
        const hymn = getHymn(hymnal, n);
        if (!hymn) return null;
        return (
          <li key={n}>
            <button
              onClick={() => onSelect(n)}
              className="flex w-full items-baseline gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-paper-sunken"
            >
              <span className="w-9 shrink-0 font-sans text-[0.7rem] tabular-nums text-paper-faint">
                {n}
              </span>
              <span className="flex-1 font-serif text-[0.95rem] leading-snug text-paper-ink">
                {hymnTitle(hymn)}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-paper-faint" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SettingsPanel() {
  const { theme, setTheme, textSize, setTextSize } = useHymnalStore();

  const themes: { id: Theme; label: string }[] = [
    { id: "system", label: "System" },
    { id: "light", label: "Light" },
    { id: "dark", label: "Night" },
  ];
  const sizes: { id: TextSize; label: string }[] = [
    { id: "s", label: "S" },
    { id: "m", label: "M" },
    { id: "l", label: "L" },
    { id: "xl", label: "XL" },
  ];

  return (
    <div className="space-y-6 px-4 py-4">
      <section>
        <p className="text-label mb-2">Appearance</p>
        <div className="flex gap-1 rounded-xl bg-paper-sunken p-1">
          {themes.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTheme(id)}
              aria-pressed={theme === id}
              className={`flex-1 rounded-lg py-2.5 font-sans text-xs font-semibold transition-colors ${
                theme === id ? "bg-paper text-paper-ink shadow-sm" : "text-paper-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <p className="text-label mb-2">Text size</p>
        <div className="flex gap-1 rounded-xl bg-paper-sunken p-1">
          {sizes.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTextSize(id)}
              aria-pressed={textSize === id}
              className={`flex-1 rounded-lg py-2.5 font-serif transition-colors ${
                textSize === id ? "bg-paper text-paper-ink shadow-sm" : "text-paper-muted"
              }`}
              style={{ fontSize: `${{ s: 0.85, m: 1, l: 1.15, xl: 1.3 }[id]}rem` }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="border-t border-paper-rule pt-4">
        <p className="font-sans text-[0.7rem] leading-relaxed text-paper-faint">
          The screen is kept awake while a hymn is open. Text is set from the 32nd edition; where
          the printed page drops a line it has been restored from the original hymn, and noted in
          the project&rsquo;s corrections file.
        </p>
      </section>
    </div>
  );
}
