"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import HymnView from "@/components/HymnView";
import SmartNumpad from "@/components/SmartNumpad";
import TextSearch from "@/components/TextSearch";
import TopBar from "@/components/TopBar";
import BottomBar from "@/components/BottomBar";
import NavDrawer from "@/components/NavDrawer";
import TuneSheet from "@/components/TuneSheet";
import ThemeSync from "@/components/ThemeSync";
import { firstHymn, getDefaultHymnal, getHymn, getHymnal } from "@/lib/hymnals";
import { useHymnalStore } from "@/store/useHymnalStore";

type SearchMode = "closed" | "number" | "text";

export default function Home() {
  const hymnalId = useHymnalStore((s) => s.hymnalId);
  const favorites = useHymnalStore((s) => s.favorites);
  const recents = useHymnalStore((s) => s.recents);
  const toggleFavorite = useHymnalStore((s) => s.toggleFavorite);
  const visit = useHymnalStore((s) => s.visit);

  const hymnal = useMemo(() => getHymnal(hymnalId) ?? getDefaultHymnal(), [hymnalId]);

  const [[number, direction], setPage] = useState<[number, number]>([
    firstHymn(getDefaultHymnal()).number,
    0,
  ]);
  const [searchMode, setSearchMode] = useState<SearchMode>("number");
  const [buffer, setBuffer] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState<string[] | undefined>();
  const [tunesOpen, setTunesOpen] = useState(false);

  const hymn = getHymn(hymnal, number) ?? firstHymn(hymnal);

  useEffect(() => {
    visit(hymn.number);
  }, [hymn.number, visit]);

  const neighbours = useMemo(() => {
    const at = hymnal.hymns.findIndex((h) => h.number === hymn.number);
    return {
      prev: at > 0 ? hymnal.hymns[at - 1] : null,
      next: at >= 0 && at < hymnal.hymns.length - 1 ? hymnal.hymns[at + 1] : null,
    };
  }, [hymnal, hymn.number]);

  const goTo = useCallback(
    (target: number) => {
      setPage(([current]) => [target, target > current ? 1 : -1]);
      setBuffer("");
      setSearchMode("closed");
    },
    [],
  );

  const paginate = useCallback(
    (delta: number) => {
      const target = delta > 0 ? neighbours.next : neighbours.prev;
      if (target) setPage([target.number, delta]);
    },
    [neighbours],
  );

  const appendDigit = useCallback(
    (key: string) => setBuffer((prev) => (prev.length < 3 ? prev + key : prev)),
    [],
  );

  const submitBuffer = useCallback(() => {
    const target = Number(buffer);
    if (buffer && getHymn(hymnal, target)) goTo(target);
  }, [buffer, hymnal, goTo]);

  // Desktop deserves a keyboard. Arrows page, "/" searches, digits start an
  // entry, Escape backs out of whatever is open.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape") {
        if (menuOpen) setMenuOpen(false);
        else if (searchMode !== "closed") setSearchMode("closed");
        return;
      }
      if (menuOpen) return;

      if (e.key === "ArrowRight") paginate(1);
      else if (e.key === "ArrowLeft") paginate(-1);
      else if (e.key === "/") {
        e.preventDefault();
        setSearchMode("text");
      } else if (/^\d$/.test(e.key)) {
        setSearchMode("number");
        appendDigit(e.key);
      } else if (e.key === "Enter" && searchMode === "number") {
        submitBuffer();
      } else if (e.key === "Backspace" && searchMode === "number") {
        setBuffer((prev) => prev.slice(0, -1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen, searchMode, paginate, appendDigit, submitBuffer]);

  const openSection = (path: string[]) => {
    setMenuPath(path);
    setMenuOpen(true);
  };

  return (
    <>
      <ThemeSync />

      {/*
        `fixed inset-0` rather than `h-[100dvh]`: iOS has a standing WebKit bug
        where `dvh` can be computed against a stale viewport in standalone PWA
        mode, particularly right after a reload — the column ends up taller
        than the screen actually visible, and the last flex child (the bottom
        bar) is pushed off the bottom with nothing to scroll it into view.
        Fixed positioning is pinned to the real viewport on every paint, so
        there's no unit calculation to go stale.
      */}
      <div className="fixed inset-0 flex flex-col overflow-hidden">
        <TopBar
          hymn={hymn}
          isFavorite={favorites.includes(hymn.number)}
          onOpenMenu={() => {
            setMenuPath(undefined);
            setMenuOpen(true);
          }}
          onToggleFavorite={() => toggleFavorite(hymn.number)}
        />

        <main className="relative min-h-0 flex-1">
          <HymnView
            hymnal={hymnal}
            hymn={hymn}
            direction={direction}
            onNext={() => paginate(1)}
            onPrev={() => paginate(-1)}
            onOpenTunes={() => setTunesOpen(true)}
            onOpenSection={openSection}
          />
        </main>

        <BottomBar
          prev={neighbours.prev}
          next={neighbours.next}
          onPrev={() => paginate(-1)}
          onNext={() => paginate(1)}
          onOpenSearch={() => setSearchMode("number")}
        />
      </div>

      <NavDrawer
        hymnal={hymnal}
        isOpen={menuOpen}
        currentMeter={hymn.meter}
        openPath={menuPath}
        initialPanel={menuPath ? "contents" : undefined}
        onClose={() => setMenuOpen(false)}
        onSelect={goTo}
      />

      <TuneSheet
        meter={hymn.meter}
        isOpen={tunesOpen && Boolean(hymn.meter)}
        onClose={() => setTunesOpen(false)}
      />

      {/* Search layer */}
      <AnimatePresence>
        {searchMode !== "closed" && (
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setSearchMode("closed")}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {searchMode === "number" && (
          <div key="numpad" className="fixed inset-x-0 bottom-0 z-50">
            <SmartNumpad
              hymnal={hymnal}
              buffer={buffer}
              recents={recents.filter((n) => n !== hymn.number)}
              onKeyPress={appendDigit}
              onDelete={() => setBuffer((prev) => prev.slice(0, -1))}
              onGo={submitBuffer}
              onSelect={goTo}
              onSwitchToText={() => setSearchMode("text")}
              onClose={() => setSearchMode("closed")}
            />
          </div>
        )}

        {searchMode === "text" && (
          <motion.div
            key="textsearch"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex flex-col p-3 pt-6"
          >
            <TextSearch
              hymnal={hymnal}
              onSelect={goTo}
              onSwitchToNumber={() => setSearchMode("number")}
              onClose={() => setSearchMode("closed")}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
