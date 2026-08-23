"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import HymnView from "@/components/HymnView";
import SmartNumpad from "@/components/SmartNumpad";
import TextSearch from "@/components/TextSearch";
import TopBar from "@/components/TopBar";
import BottomBar from "@/components/BottomBar";
import NavDrawer from "@/components/NavDrawer";
import BookRibbon from "@/components/BookRibbon";
import Sidebar from "@/components/Sidebar";
import TuneSheet from "@/components/TuneSheet";
import ThemeSync from "@/components/ThemeSync";
import { firstHymn, getDefaultHymnal, getHymn, getHymnal } from "@/lib/hymnals";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { forBook, useHymnalStore } from "@/store/useHymnalStore";

type SearchMode = "closed" | "number" | "text";

/**
 * "auto" is the state before anyone has chosen anything — the app has just
 * loaded. It resolves to the keypad on a phone, where opening ready for input
 * is the whole point, and to nothing on a desktop, where a modal in your face
 * on arrival is just something to dismiss. Any interaction replaces it with a
 * real mode.
 */
type SearchState = SearchMode | "auto";

export default function Home() {
  const hymnalId = useHymnalStore((s) => s.hymnalId);
  const favorites = useHymnalStore((s) => s.favorites);
  const recents = useHymnalStore((s) => s.recents);
  const toggleFavorite = useHymnalStore((s) => s.toggleFavorite);
  const setHymnal = useHymnalStore((s) => s.setHymnal);
  const positions = useHymnalStore((s) => s.positions);
  const setPosition = useHymnalStore((s) => s.setPosition);
  const visit = useHymnalStore((s) => s.visit);

  const hymnal = useMemo(() => getHymnal(hymnalId) ?? getDefaultHymnal(), [hymnalId]);

  const [[number, direction], setPage] = useState<[number, number]>([
    firstHymn(getDefaultHymnal()).number,
    0,
  ]);
  const [searchState, setSearchState] = useState<SearchState>("auto");
  const [buffer, setBuffer] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState<string[] | undefined>();
  const [tunesOpen, setTunesOpen] = useState(false);

  const isDesktop = useIsDesktop();
  const hymn = getHymn(hymnal, number) ?? firstHymn(hymnal);

  // Held closed until the viewport is known, so nothing flashes open and shut.
  const searchMode: SearchMode =
    searchState === "auto" ? (isDesktop === false ? "number" : "closed") : searchState;

  useEffect(() => {
    visit(hymnalId, hymn.number);
    setPosition(hymnalId, hymn.number);
  }, [hymn.number, hymnalId, visit, setPosition]);

  const neighbours = useMemo(() => {
    const at = hymnal.hymns.findIndex((h) => h.number === hymn.number);
    return {
      prev: at > 0 ? hymnal.hymns[at - 1] : null,
      next: at >= 0 && at < hymnal.hymns.length - 1 ? hymnal.hymns[at + 1] : null,
    };
  }, [hymnal, hymn.number]);

  const goTo = useCallback(
    // A search that spans books can hand back a hymn from a different one, so
    // switch books before turning to the page.
    (target: number, targetHymnalId?: string) => {
      if (targetHymnalId && targetHymnalId !== hymnalId) setHymnal(targetHymnalId);
      setPage(([current]) => [target, target > current ? 1 : -1]);
      setBuffer("");
      setSearchState("closed");
    },
    [hymnalId, setHymnal],
  );

  /**
   * Cross to another book. The ribbon tab is a bookmark, so it returns you to
   * where you left off there — landing on song one every time would make the
   * tab useless for going back and forth, which is the whole point of it.
   */
  const switchHymnal = useCallback(
    (id: string) => {
      if (id === hymnalId) return;
      const target = getHymnal(id);
      if (!target) return;
      setHymnal(id);
      const remembered = positions[id];
      const landing =
        (remembered !== undefined && getHymn(target, remembered)) || firstHymn(target);
      setPage([landing.number, 0]);
      setBuffer("");
    },
    [hymnalId, positions, setHymnal],
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

      // ⌘K / Ctrl-K opens search from anywhere, including out of a text field —
      // the one shortcut that has to work no matter what has focus.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchState("text");
        return;
      }

      // Escape is checked before the typing guard below: the whole point of it
      // is to back out of the search box, which is exactly when focus is in a
      // text field.
      if (e.key === "Escape") {
        if (menuOpen) setMenuOpen(false);
        else if (tunesOpen) setTunesOpen(false);
        else if (searchMode !== "closed") setSearchState("closed");
        return;
      }

      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (menuOpen) return;

      if (e.key === "ArrowRight") paginate(1);
      else if (e.key === "ArrowLeft") paginate(-1);
      else if (e.key === "/") {
        e.preventDefault();
        setSearchState("text");
      } else if (/^\d$/.test(e.key)) {
        setSearchState("number");
        appendDigit(e.key);
      } else if (e.key === "Enter" && searchMode === "number") {
        submitBuffer();
      } else if (e.key === "Backspace" && searchMode === "number") {
        setBuffer((prev) => prev.slice(0, -1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen, tunesOpen, searchMode, paginate, appendDigit, submitBuffer]);

  // On a phone this opens the drawer at that section; on a desktop the sidebar
  // is already there, so it just re-targets it (Sidebar is keyed on the path).
  const openSection = (path: string[]) => {
    setMenuPath(path);
    if (!isDesktop) setMenuOpen(true);
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
      <div className="fixed inset-0 flex overflow-hidden">
        {/* Permanent on a wide screen; the same panels live in the drawer on a
            phone, so there is one implementation behind both. */}
        <Sidebar
          hymnal={hymnal}
          currentMeter={hymn.meter}
          openPath={menuPath}
          initialPanel={menuPath ? "contents" : undefined}
          onSelect={goTo}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            hymnal={hymnal}
            hymn={hymn}
            isFavorite={forBook(favorites, hymnalId).includes(hymn.number)}
            onOpenMenu={() => {
              setMenuPath(undefined);
              setMenuOpen(true);
            }}
            onToggleFavorite={() => toggleFavorite(hymnalId, hymn.number)}
          />

          <main className="relative min-h-0 flex-1">
            <BookRibbon hymnal={hymnal} onSwitch={switchHymnal} />
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
            isDesktop={isDesktop === true}
            onPrev={() => paginate(-1)}
            onNext={() => paginate(1)}
            onOpenSearch={() => setSearchState(isDesktop ? "text" : "number")}
          />
        </div>
      </div>

      <NavDrawer
        hymnal={hymnal}
        // Never both at once: resizing past the breakpoint with the drawer open
        // would otherwise leave it covering the sidebar it duplicates.
        isOpen={menuOpen && !isDesktop}
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

      {/*
        Search layer, rendered conditionally rather than through
        AnimatePresence. With the React Compiler on, AnimatePresence ran the
        exit animation but never unmounted the child — leaving an invisible
        z-50 overlay sitting on top of the app, swallowing every click. An
        enter animation needs no presence tracking, and an exit animation is
        not worth a dead layer over the page.
      */}
      {searchMode !== "closed" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          onClick={() => setSearchState("closed")}
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        />
      )}

      {searchMode === "number" && (
          <div className="fixed inset-x-0 bottom-0 z-50">
            <SmartNumpad
              hymnal={hymnal}
              buffer={buffer}
              recents={forBook(recents, hymnalId).filter((n) => n !== hymn.number)}
              onKeyPress={appendDigit}
              onDelete={() => setBuffer((prev) => prev.slice(0, -1))}
              onGo={submitBuffer}
              onSelect={goTo}
              onSelectIn={goTo}
              onSwitchHymnal={switchHymnal}
              onSwitchToText={() => setSearchState("text")}
              onClose={() => setSearchState("closed")}
            />
        </div>
      )}

      {searchMode === "text" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex flex-col p-3 pt-6 lg:items-center lg:pt-[12vh]"
          >
            <TextSearch
              hymnal={hymnal}
              onSelect={goTo}
              onSwitchToNumber={() => setSearchState("number")}
              onClose={() => setSearchState("closed")}
            />
        </motion.div>
      )}
    </>
  );
}
