"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  X, BookOpen, Users, Star, Music, Settings, ListOrdered,
  Trash2, Plus, ChevronUp, ChevronDown, ChevronRight,
} from "lucide-react";
import { type Hymnal, getHymn, hymnTitle, listHymnals } from "@/lib/hymnals";
import { useHymnalStore, type TextSize, type Theme } from "@/store/useHymnalStore";
import TableOfContents from "./TableOfContents";
import AuthorIndex from "./AuthorIndex";
import InstallPrompt from "./InstallPrompt";

type Panel = "contents" | "authors" | "favorites" | "service" | "tunes" | "settings";

interface NavDrawerProps {
  hymnal: Hymnal;
  isOpen: boolean;
  currentMeter: string;
  openPath?: string[];
  initialPanel?: Panel;
  onClose: () => void;
  onSelect: (number: number) => void;
}

const PANELS: { id: Panel; label: string; icon: typeof BookOpen }[] = [
  { id: "contents", label: "Contents", icon: BookOpen },
  { id: "authors", label: "Authors", icon: Users },
  { id: "favorites", label: "Favorites", icon: Star },
  { id: "service", label: "Service", icon: ListOrdered },
  { id: "tunes", label: "Tunes", icon: Music },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function NavDrawer({
  hymnal,
  isOpen,
  currentMeter,
  openPath,
  initialPanel,
  onClose,
  onSelect,
}: NavDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const setHymnal = useHymnalStore((s) => s.setHymnal);

  // Escape closes, and focus is trapped while the drawer owns the screen.
  useEffect(() => {
    if (!isOpen) return;
    const node = panelRef.current;
    node?.querySelector<HTMLElement>("button")?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const focusable = node.querySelectorAll<HTMLElement>(
        'button, [href], input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const go = (number: number) => {
    onSelect(number);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={
              reduceMotion ? { duration: 0 } : { type: "spring", damping: 30, stiffness: 300 }
            }
            className="fixed inset-y-0 left-0 z-50 flex w-[min(22rem,88vw)] flex-col bg-paper shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-paper-rule px-4 py-4">
              <div className="pr-2">
                <h2 className="font-serif text-lg leading-tight text-paper-ink">{hymnal.title}</h2>
                <p className="text-label mt-1 normal-case tracking-normal">{hymnal.subtitle}</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close menu"
                className="rounded-full p-2 text-paper-muted transition-colors hover:bg-paper-sunken"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Book switcher only earns its space once there's a second book. */}
            {listHymnals().length > 1 && (
              <div className="border-b border-paper-rule px-4 py-2">
                <select
                  value={hymnal.id}
                  onChange={(e) => setHymnal(e.target.value)}
                  className="w-full rounded-lg bg-paper-sunken px-3 py-2 font-sans text-sm text-paper-ink"
                >
                  {listHymnals().map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.shortName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/*
              Mounted only while the drawer is open, so the tab it opens on is
              plain initial state rather than something an effect has to keep
              in sync with the prop.
            */}
            <DrawerPanels
              hymnal={hymnal}
              currentMeter={currentMeter}
              openPath={openPath}
              initialPanel={initialPanel ?? "contents"}
              onSelect={go}
            />

            <InstallPrompt />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------- */

function DrawerPanels({
  hymnal,
  currentMeter,
  openPath,
  initialPanel,
  onSelect,
}: {
  hymnal: Hymnal;
  currentMeter: string;
  openPath?: string[];
  initialPanel: Panel;
  onSelect: (n: number) => void;
}) {
  const [panel, setPanel] = useState<Panel>(initialPanel);
  const favorites = useHymnalStore((s) => s.favorites);

  return (
    <>
      <nav className="flex gap-1 overflow-x-auto border-b border-paper-rule px-2 py-2 no-scrollbar">
        {PANELS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setPanel(id)}
            aria-current={panel === id}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[0.7rem] font-semibold transition-colors ${
              panel === id ? "bg-paper-ink text-paper" : "text-paper-muted hover:bg-paper-sunken"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto overscroll-contain px-1 py-2">
        {panel === "contents" && (
          <TableOfContents hymnal={hymnal} openPath={openPath} onSelect={onSelect} />
        )}

        {panel === "authors" && <AuthorIndex hymnal={hymnal} onSelect={onSelect} />}

        {panel === "favorites" && (
          <HymnList
            hymnal={hymnal}
            numbers={favorites}
            empty="Star a hymn to keep it here."
            onSelect={onSelect}
          />
        )}

        {panel === "service" && <ServicePanel hymnal={hymnal} onSelect={onSelect} />}

        {panel === "tunes" && <TunesPanel meter={currentMeter} />}

        {panel === "settings" && <SettingsPanel />}
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

/** The song leader's running order: reorderable, and it drives swipe order. */
function ServicePanel({ hymnal, onSelect }: { hymnal: Hymnal; onSelect: (n: number) => void }) {
  const { service, moveService, toggleService, clearService } = useHymnalStore();

  if (service.length === 0) {
    return (
      <p className="px-4 py-10 text-center font-serif italic leading-relaxed text-paper-faint">
        Queue hymns for a service and swiping will follow the queue instead of the numbering.
      </p>
    );
  }

  return (
    <div>
      <ul>
        {service.map((n, i) => {
          const hymn = getHymn(hymnal, n);
          if (!hymn) return null;
          return (
            <li key={n} className="flex items-center gap-1 px-2 py-1">
              <span className="w-5 shrink-0 text-center font-sans text-[0.7rem] tabular-nums text-paper-faint">
                {i + 1}
              </span>
              <button
                onClick={() => onSelect(n)}
                className="flex flex-1 items-baseline gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-paper-sunken"
              >
                <span className="font-sans text-[0.7rem] tabular-nums text-paper-faint">{n}</span>
                <span className="font-serif text-[0.9rem] leading-snug text-paper-ink">
                  {hymnTitle(hymn)}
                </span>
              </button>
              <button
                onClick={() => moveService(i, i - 1)}
                disabled={i === 0}
                aria-label="Move up"
                className="rounded p-1 text-paper-faint transition-colors hover:text-paper-ink disabled:opacity-25"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => moveService(i, i + 1)}
                disabled={i === service.length - 1}
                aria-label="Move down"
                className="rounded p-1 text-paper-faint transition-colors hover:text-paper-ink disabled:opacity-25"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                onClick={() => toggleService(n)}
                aria-label="Remove from service"
                className="rounded p-1 text-paper-faint transition-colors hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
      <button
        onClick={clearService}
        className="mx-3 mt-3 rounded-lg px-3 py-2 font-sans text-[0.7rem] font-semibold text-paper-faint transition-colors hover:bg-paper-sunken hover:text-paper-ink"
      >
        Clear service
      </button>
    </div>
  );
}

/** Tunes a congregation actually uses for a given meter, kept per meter. */
function TunesPanel({ meter }: { meter: string }) {
  const { tunes, addTune, removeTune } = useHymnalStore();
  const [draft, setDraft] = useState("");
  const forMeter = tunes.filter((t) => t.meter === meter);

  const submit = () => {
    if (!draft.trim() || !meter) return;
    addTune({ name: draft.trim(), meter });
    setDraft("");
  };

  return (
    <div className="px-3">
      <p className="text-label mb-3">{meter ? `Tunes for ${meter}` : "No meter for this hymn"}</p>

      <ul className="mb-4 space-y-1">
        {forMeter.map((tune) => (
          <li
            key={tune.name}
            className="flex items-center justify-between rounded-lg bg-paper-sunken px-3 py-2"
          >
            <span className="font-serif text-[0.95rem] text-paper-ink">{tune.name}</span>
            <button
              onClick={() => removeTune(tune.name, tune.meter)}
              aria-label={`Remove ${tune.name}`}
              className="p-1 text-paper-faint transition-colors hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {forMeter.length === 0 && meter && (
          <li className="py-6 text-center font-serif italic text-paper-faint">
            No {meter} tunes yet.
          </li>
        )}
      </ul>

      {meter && (
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={`Add a ${meter} tune`}
            className="flex-1 rounded-lg border border-paper-rule bg-paper px-3 py-2 font-serif text-paper-ink outline-none placeholder:text-paper-faint"
          />
          <button
            onClick={submit}
            aria-label="Add tune"
            className="rounded-lg bg-paper-ink px-3 text-paper transition-transform active:scale-95"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
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
    <div className="space-y-6 px-4 py-2">
      <section>
        <p className="text-label mb-2">Appearance</p>
        <div className="flex gap-1 rounded-xl bg-paper-sunken p-1">
          {themes.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTheme(id)}
              aria-pressed={theme === id}
              className={`flex-1 rounded-lg py-2 font-sans text-xs font-semibold transition-colors ${
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
              className={`flex-1 rounded-lg py-2 font-serif transition-colors ${
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
          the printed page drops a line, the app leaves the gap rather than inventing one.
        </p>
      </section>
    </div>
  );
}
