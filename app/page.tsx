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
import {
  firstHymn,
  getDefaultHymnal,
  getHymn,
  getHymnal,
  hymnTitle,
  isNumbered,
} from "@/lib/hymnals";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { useDialog } from "@/lib/useDialog";
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

  /**
   * Whether the persisted store has been read back yet.
   *
   * Nothing may be *written* to the store before this is true. Page state
   * starts at hymn 1, so the visit/position effect firing on mount wrote 1 over
   * whatever place had been saved — and because zustand serves default state
   * during the hydration render, it did so once as the default book before the
   * real one resolved, wiping the saved place in *both* books on every launch.
   */
  const [restored, setRestored] = useState(false);


  // Held closed until the viewport is known, so nothing flashes open and shut.
  const searchMode: SearchMode =
    searchState === "auto" ? (isDesktop === false ? "number" : "closed") : searchState;
  // Focus stays inside whichever layer is over the page, and returns to the
  // control that opened it. Both were previously open to Tab walking straight
  // out into the dimmed page behind — and on a phone the keypad is the default
  // open state, so that was the first thing a keyboard user met.
  const keypadRef = useDialog<HTMLDivElement>(searchMode === "number");
  const searchRef = useDialog<HTMLDivElement>(searchMode === "text");

  // Open where you left off. Read straight from the store rather than through
  // props: this runs once, on rehydration, before the first render that could
  // record anything.
  useEffect(() => {
    const restore = () => {
      const state = useHymnalStore.getState();
      const book = getHymnal(state.hymnalId) ?? getDefaultHymnal();
      const remembered = state.positions[book.id];
      if (remembered !== undefined && getHymn(book, remembered)) setPage([remembered, 0]);
      setRestored(true);
    };

    if (useHymnalStore.persist.hasHydrated()) {
      restore();
      return;
    }
    return useHymnalStore.persist.onFinishHydration(restore);
  }, []);

  useEffect(() => {
    if (!restored) return;
    visit(hymnalId, hymn.number);
    setPosition(hymnalId, hymn.number);
  }, [restored, hymn.number, hymnalId, visit, setPosition]);

  /**
   * What a screen reader is told when the hymn changes, and what the tab says.
   *
   * Paging or pressing Go used to be entirely silent — focus landed on the body
   * with no announcement and a permanently static title, so a blind user had to
   * re-explore the page to find out whether anything had happened.
   */
  const announcement = restored
    ? `${isNumbered(hymnal) ? `Hymn ${hymn.number}` : hymnal.shortName}. ${hymnTitle(hymn)}`
    : "";

  useEffect(() => {
    if (announcement) document.title = `${announcement} · Hymnal`;
  }, [announcement]);

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
        // Close whatever is over the page first, or search mounts underneath it
        // — visible through the backdrop, focused, and unclickable.
        setMenuOpen(false);
        setTunesOpen(false);
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
      // Anything covering the page swallows these keys. Without the tunes
      // guard, a digit mounted the keypad *under* the sheet's backdrop where it
      // silently buffered keystrokes, and arrows paged the hymn behind the
      // modal — recording visits to hymns nobody saw.
      if (menuOpen || tunesOpen) return;

      // Text search owns the alphabet and the digits while it is open; letting
      // a digit through replaced it with the keypad and threw the query away.
      if (searchMode === "text") return;

      if (e.key === "ArrowRight") paginate(1);
      else if (e.key === "ArrowLeft") paginate(-1);
      else if (e.key === "/") {
        e.preventDefault();
        setSearchState("text");
      } else if (/^\d$/.test(e.key)) {
        setSearchState("number");
        appendDigit(e.key);
      } else if (
        e.key === "Enter" &&
        searchMode === "number" &&
        // A focused key handles its own Enter; without this the buffer was
        // submitted *and* the digit appended, on one press.
        !(e.target instanceof HTMLButtonElement)
      ) {
        submitBuffer();
      } else if (e.key === "Backspace" && searchMode === "number") {
        setBuffer((prev) => prev.slice(0, -1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen, tunesOpen, searchMode, paginate, appendDigit, submitBuffer]);

  // Crossing to desktop only *hid* the drawer — `menuOpen` stayed true, so the
  // key handler kept refusing input to an invisible panel and a tablet rotated
  // back to portrait found it open again, unasked.
  useEffect(() => {
    if (isDesktop) setMenuOpen(false);
  }, [isDesktop]);

  // On a phone this opens the drawer at that section; on a desktop the sidebar
  // is already there, so it just re-targets it (Sidebar is keyed on the path).
  const openSection = (path: string[]) => {
    setMenuPath(path);
    if (!isDesktop) setMenuOpen(true);
  };

  return (
    <>
      <ThemeSync />

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

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
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        />
      )}

      {searchMode === "number" && (
          <div
            ref={keypadRef}
            role="dialog"
            aria-modal="true"
            aria-label="Go to a hymn by number"
            /* -1 so the hook can rest focus on the panel rather than on a key,
               and no ring: this is a container that holds focus, not a control
               anyone is being pointed at. */
            tabIndex={-1}
            /* Edge to edge is right on a phone, where the screen is the sheet.
               Across a monitor it became a full-width band with a small pad
               marooned in the middle — the keypad kept its size while the
               furniture around it grew. Past 1024px it becomes what it always
               was: a card, floated over the page. */
            className="fixed inset-x-0 bottom-0 z-50 outline-none lg:inset-x-auto lg:bottom-8 lg:left-1/2 lg:w-[26.5rem] lg:-translate-x-1/2"
          >
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
            ref={searchRef}
            role="dialog"
            aria-modal="true"
            aria-label="Find a hymn"
            tabIndex={-1}
            className="fixed inset-0 z-50 flex flex-col p-3 pt-6 outline-none lg:items-center lg:pt-[12vh]"
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
