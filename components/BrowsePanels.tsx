"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Music,
  Settings,
  Smartphone,
  Star,
  Users,
  X,
} from "lucide-react";
import { type Hymnal, expandableHymnal, getHymn } from "@/lib/hymnals";
import { useBooks } from "@/lib/useBooks";
import { bookName } from "@/lib/books";
import { forBook, useHymnalStore, type TextSize, type Theme } from "@/store/useHymnalStore";
import TableOfContents from "./TableOfContents";
import AuthorIndex from "./AuthorIndex";
import TuneList from "./TuneList";
import SyncPanel from "./SyncPanel";
import SuggestSong from "./SuggestSong";
import { InstallRow } from "./InstallPrompt";
import HymnRow from "./ui/HymnRow";
import Segmented from "./ui/Segmented";

export type Panel = "contents" | "authors" | "favorites" | "settings" | "sync" | "suggest" | "tunes";

/** Where Back goes from each panel. Settings' own pages return to Settings. */
const PARENT: Record<Panel, Panel | null> = {
  contents: null,
  authors: null,
  favorites: null,
  settings: null,
  sync: "settings",
  suggest: "settings",
  tunes: "settings",
};

const TITLE: Record<Panel, string> = {
  contents: "Contents",
  authors: "Authors",
  favorites: "Favorites",
  settings: "Settings",
  sync: "Move to another device",
  suggest: "Add a song",
  tunes: "Your tunes",
};

interface BrowsePanelsProps {
  hymnal: Hymnal;
  /** The hymn on screen, so Contents and Authors can open at it. */
  current: number;
  /** Open on Contents at these sections (from the label above a title). */
  openPath?: string[];
  onSelect: (number: number, hymnalId: string) => void;
  onChooseBook: () => void;
  /** Omitted for the permanent desktop sidebar — there is nothing to close. */
  onClose?: () => void;
}

/**
 * The menu: one component in two frames, the phone's drawer and the desktop
 * sidebar.
 *
 * Regrouped around what an ordinary congregant does. The book you're in is at
 * the top with a sentence saying what it is, and the way to change it. Text
 * size sits right on the first screen, because it is the setting this
 * audience reaches for most and it used to be four taps away. Tunes (a song
 * leader's notebook) and moving to another device (a once-a-phone job) moved
 * under Settings, out of the way of finding a hymn.
 */
export default function BrowsePanels({
  hymnal,
  current,
  openPath,
  onSelect,
  onChooseBook,
  onClose,
}: BrowsePanelsProps) {
  const [panel, setPanel] = useState<Panel | null>(openPath ? "contents" : null);
  const textSize = useHymnalStore((s) => s.textSize);
  const setTextSize = useHymnalStore((s) => s.setTextSize);

  const subtitle = panel === "contents" || panel === "authors" ? bookName(hymnal) : null;

  return (
    <>
      <header className="flex shrink-0 items-center gap-1 border-b border-paper-rule px-2 py-2">
        {panel ? (
          <>
            <button
              type="button"
              onClick={() => setPanel(PARENT[panel])}
              aria-label={PARENT[panel] ? `Back to ${TITLE[PARENT[panel]!]}` : "Back to menu"}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-paper-muted transition-colors hover:bg-paper-sunken hover:text-paper-ink"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="min-w-0 flex-1 truncate font-serif text-[1.3rem] text-paper-ink">
              {TITLE[panel]}
              {subtitle && (
                <span className="ml-2 font-sans text-[0.8rem] font-semibold text-paper-faint">{subtitle}</span>
              )}
            </h2>
          </>
        ) : (
          <h2 className="min-w-0 flex-1 px-2 font-serif text-[1.3rem] text-paper-ink">Menu</h2>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-paper-muted transition-colors hover:bg-paper-sunken"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {!panel && (
          <nav className="flex-1 space-y-5 overflow-y-auto overscroll-contain p-3">
            {/* The book you're in, large in the serif, and the way to change it.
                What each book is, the book chooser says. */}
            <button
              type="button"
              onClick={onChooseBook}
              className="w-full rounded-2xl px-3 pb-3 pt-2 text-left transition-colors hover:bg-paper-sunken"
            >
              <span className="text-label block">Reading</span>
              <span className="mt-1.5 flex items-baseline justify-between gap-2">
                <span className="font-serif text-[1.85rem] leading-none text-paper-ink">{bookName(hymnal)}</span>
                <span className="shrink-0 font-sans text-[0.85rem] font-semibold text-paper-accent">Change</span>
              </span>
            </button>

            <ul className="border-t border-paper-rule/70 pt-2">
              <MenuRow icon={BookOpen} label="Contents" onClick={() => setPanel("contents")} />
              <MenuRow icon={Users} label="Authors" onClick={() => setPanel("authors")} />
              <MenuRow icon={Star} label="Favorites" onClick={() => setPanel("favorites")} />
            </ul>

            <section className="space-y-2 px-1">
              <p className="text-label">Text size</p>
              <Segmented<TextSize>
                label="Text size"
                value={textSize}
                onChange={setTextSize}
                options={[
                  { id: "s", label: "A", ariaLabel: "Small", style: { fontSize: "0.8rem" } },
                  { id: "m", label: "A", ariaLabel: "Medium", style: { fontSize: "0.98rem" } },
                  { id: "l", label: "A", ariaLabel: "Large", style: { fontSize: "1.18rem" } },
                  { id: "xl", label: "A", ariaLabel: "Extra large", style: { fontSize: "1.4rem" } },
                ]}
              />
            </section>

            <ul>
              <MenuRow icon={Settings} label="Settings" onClick={() => setPanel("settings")} />
            </ul>
          </nav>
        )}

        {panel === "contents" && (
          <div className="flex-1 overflow-y-auto overscroll-contain px-1 py-2">
            <TableOfContents
              hymnal={hymnal}
              current={current}
              openPath={openPath}
              onSelect={(n) => onSelect(n, hymnal.id)}
            />
          </div>
        )}

        {panel === "authors" && (
          <div className="flex-1 overflow-y-auto overscroll-contain px-1 py-2">
            <AuthorIndex hymnal={hymnal} current={current} onSelect={(n) => onSelect(n, hymnal.id)} />
          </div>
        )}

        {panel === "favorites" && (
          <div className="flex-1 overflow-y-auto overscroll-contain px-1 py-2">
            <Favorites current={hymnal} onSelect={onSelect} />
          </div>
        )}

        {panel === "settings" && (
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <SettingsPanel onOpen={setPanel} />
          </div>
        )}

        {panel === "sync" && (
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <SyncPanel />
          </div>
        )}

        {panel === "suggest" && (
          <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-5">
            <SuggestSong
              query=""
              hymnalId={(expandableHymnal() ?? hymnal).id}
              compact
              startOpen
              onOpen={onSelect}
            />
          </div>
        )}

        {panel === "tunes" && <TuneList />}
      </div>
    </>
  );
}

function MenuRow({
  icon: Icon,
  label,
  detail,
  onClick,
}: {
  icon: typeof BookOpen;
  label: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-13 w-full items-center gap-3.5 rounded-2xl px-3 text-left transition-colors hover:bg-paper-sunken"
      >
        <Icon className="h-[1.15rem] w-[1.15rem] shrink-0 text-paper-faint" strokeWidth={1.75} />
        <span className="min-w-0 flex-1 truncate font-serif text-[1.18rem] text-paper-ink">{label}</span>
        {detail && <span className="shrink-0 font-sans text-[0.82rem] text-paper-faint">{detail}</span>}
        <ChevronRight className="h-4 w-4 shrink-0 text-paper-faint" />
      </button>
    </li>
  );
}

/**
 * Every starred song, grouped by book, current book first.
 *
 * Each row has its own star. Removing one used to mean opening the hymn
 * (which closed the menu), finding the star at the top, and coming back. A
 * row you unstar stays on screen until the panel closes, so a slip of the
 * thumb is one tap to undo.
 */
function Favorites({
  current,
  onSelect,
}: {
  current: Hymnal;
  onSelect: (n: number, hymnalId: string) => void;
}) {
  const favorites = useHymnalStore((s) => s.favorites);
  const toggleFavorite = useHymnalStore((s) => s.toggleFavorite);
  const [shown] = useState(() => favorites);
  const books = useBooks();

  const groups = books
    .map((book) => ({ book, numbers: forBook(shown, book.id) }))
    .filter((g) => g.numbers.length > 0)
    .sort((a, b) => Number(b.book.id === current.id) - Number(a.book.id === current.id));

  if (groups.length === 0) {
    return (
      <p className="px-6 py-10 text-center font-serif italic leading-relaxed text-paper-faint">
        Tap the star at the top of any hymn to keep it here.
      </p>
    );
  }

  return (
    <>
      {groups.map(({ book, numbers }) => (
        <section key={book.id} className="mb-4 last:mb-0">
          {/* Named whenever it isn't obviously your own book, so a list of the
              other book's songs never passes for this one's. */}
          {(groups.length > 1 || book.id !== current.id) && (
            <p className="text-label mb-1 px-3">{bookName(book)}</p>
          )}
          <ul>
            {numbers.map((n) => {
              const hymn = getHymn(book, n);
              if (!hymn) return null;
              const on = forBook(favorites, book.id).includes(n);
              return (
                <HymnRow
                  key={n}
                  book={book}
                  hymn={hymn}
                  onSelect={() => onSelect(n, book.id)}
                  trailing={
                    <button
                      type="button"
                      onClick={() => toggleFavorite(book.id, n)}
                      aria-pressed={on}
                      aria-label="Favorite"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-paper-sunken"
                    >
                      <Star
                        className={`h-5 w-5 ${on ? "fill-paper-accent text-paper-accent" : "text-paper-faint"}`}
                      />
                    </button>
                  }
                />
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

function SettingsPanel({ onOpen }: { onOpen: (panel: Panel) => void }) {
  const theme = useHymnalStore((s) => s.theme);
  const setTheme = useHymnalStore((s) => s.setTheme);
  const tunes = useHymnalStore((s) => s.tunes);
  const suggestTo = expandableHymnal();

  return (
    <div className="space-y-6 px-3 py-4">
      <section className="space-y-2 px-1">
        <p className="text-label">Appearance</p>
        <Segmented<Theme>
          label="Appearance"
          value={theme}
          onChange={setTheme}
          options={[
            { id: "system", label: "Automatic" },
            { id: "light", label: "Light" },
            { id: "dark", label: "Night" },
          ]}
        />
      </section>

      <ul className="space-y-1">
        <MenuRow icon={Smartphone} label="Move to another device" onClick={() => onOpen("sync")} />
        {suggestTo && <MenuRow icon={Lightbulb} label="Add a song" onClick={() => onOpen("suggest")} />}
        <MenuRow
          icon={Music}
          label="Your tunes"
          detail={tunes.length ? `${tunes.length} saved` : undefined}
          onClick={() => onOpen("tunes")}
        />
      </ul>

      <InstallRow />

      {/* A colophon closes the page, the way a printed book's does. */}
      <section className="border-t border-paper-rule/70 px-1 pt-6 text-center">
        <p className="font-serif text-[1.05rem] italic text-paper-muted">A Collection of Hymns and Sacred Songs</p>
        <p className="text-label mt-1.5">Old German Baptist Brethren Church</p>
        <p className="text-label mt-0.5">32nd edition</p>
        <Link
          href="/privacy"
          className="mt-3 inline-flex min-h-11 items-center font-sans text-[0.85rem] text-paper-muted underline decoration-paper-rule underline-offset-4 transition-colors hover:text-paper-accent"
        >
          Privacy
        </Link>
      </section>
    </div>
  );
}
