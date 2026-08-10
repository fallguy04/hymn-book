"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import HymnView from "@/components/HymnView";
import SmartNumpad from "@/components/SmartNumpad";
import TextSearch from "@/components/TextSearch";
import TopBar from "@/components/TopBar";
import NavDrawer from "@/components/NavDrawer";
import ThemeSync from "@/components/ThemeSync";
import { firstHymn, getDefaultHymnal, getHymn, getHymnal } from "@/lib/hymnals";
import { useHymnalStore } from "@/store/useHymnalStore";

type SearchMode = "closed" | "number" | "text";

export default function Home() {
  const hymnalId = useHymnalStore((s) => s.hymnalId);
  const favorites = useHymnalStore((s) => s.favorites);
  const recents = useHymnalStore((s) => s.recents);
  const service = useHymnalStore((s) => s.service);
  const toggleFavorite = useHymnalStore((s) => s.toggleFavorite);
  const toggleService = useHymnalStore((s) => s.toggleService);
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

  const hymn = getHymn(hymnal, number) ?? firstHymn(hymnal);

  useEffect(() => {
    visit(hymn.number);
  }, [hymn.number, visit]);

  /**
   * Paging follows the service queue when there is a real running order and the
   * current hymn belongs to it; otherwise it walks the book. A queue of one is
   * not an order — following it would leave you with nowhere to swipe.
   */
  const neighbours = useMemo(() => {
    const followService = service.length > 1 && service.includes(hymn.number);
    const order = followService ? service : hymnal.hymns.map((h) => h.number);
    const at = order.indexOf(hymn.number);
    return {
      prev: at > 0 ? (getHymn(hymnal, order[at - 1]) ?? null) : null,
      next: at >= 0 && at < order.length - 1 ? (getHymn(hymnal, order[at + 1]) ?? null) : null,
    };
  }, [hymnal, hymn.number, service]);

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

      <div className="flex h-[100dvh] flex-col">
        <TopBar
          hymn={hymn}
          isFavorite={favorites.includes(hymn.number)}
          inService={service.includes(hymn.number)}
          onOpenMenu={() => {
            setMenuPath(undefined);
            setMenuOpen(true);
          }}
          onToggleFavorite={() => toggleFavorite(hymn.number)}
          onToggleService={() => toggleService(hymn.number)}
        />

        <main className="relative min-h-0 flex-1">
          <HymnView
            hymnal={hymnal}
            hymn={hymn}
            direction={direction}
            prev={neighbours.prev}
            next={neighbours.next}
            onNext={() => paginate(1)}
            onPrev={() => paginate(-1)}
            onOpenSearch={() => setSearchMode("number")}
            onOpenTunes={() => {
              setMenuPath(undefined);
              setMenuOpen(true);
            }}
            onOpenSection={openSection}
          />
        </main>
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
