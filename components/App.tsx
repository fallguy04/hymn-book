"use client";

import { useEffect, useRef, useState } from "react";
import HymnView from "@/components/HymnView";
import NumberPad from "@/components/NumberPad";
import TextSearch from "@/components/TextSearch";
import TopBar from "@/components/TopBar";
import BottomBar from "@/components/BottomBar";
import NavDrawer from "@/components/NavDrawer";
import BookSheet from "@/components/BookSheet";
import Sidebar from "@/components/Sidebar";
import TuneSheet from "@/components/TuneSheet";
import ShareSheet from "@/components/ShareSheet";
import ThemeSync from "@/components/ThemeSync";
import LaunchCurtain from "@/components/LaunchCurtain";
import { InstallCard } from "@/components/InstallPrompt";
import { firstHymn, getDefaultHymnal, getHymn, getHymnal, isExpandable, isNumbered, setAddedSongs } from "@/lib/hymnals";
import { isCommunityNumber } from "@/lib/community";
import { useBooks } from "@/lib/useBooks";
import { hymnHeading, parseHymnPath, primaryName } from "@/lib/books";
import { type Layer, useLayers } from "@/lib/layers";
import { useHydrated } from "@/lib/useHydrated";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { forBook, useHymnalStore } from "@/store/useHymnalStore";

export interface HymnAddress {
  hymnalId: string;
  number: number;
}

/** A link to a hymn: /hymn/245, /song/12, or the older ?h=245&b=other-songs. */
function readLink(): HymnAddress | null {
  const fromPath = parseHymnPath(window.location.pathname);
  const params = new URLSearchParams(window.location.search);
  const found = fromPath ??
    (params.has("h")
      ? { hymnalId: getHymnal(params.get("b") ?? "")?.id ?? getDefaultHymnal().id, number: Number(params.get("h")) }
      : null);
  if (!found) return null;
  const book = getHymnal(found.hymnalId);
  if (!book || !Number.isInteger(found.number)) return null;
  // A song added in the app may not have reached this phone yet; it's opened
  // once the list arrives.
  const later = isExpandable(book) && isCommunityNumber(found.number);
  return getHymn(book, found.number) || later ? found : null;
}

type Store = ReturnType<typeof useHymnalStore.getState>;

/** Approved songs plus this phone's own, into More Songs. */
const registerAdded = (state: Store) => {
  const approved = new Set(state.approvedSongs.map((s) => s.number));
  setAddedSongs([...state.approvedSongs, ...state.mySongs.filter((s) => !approved.has(s.number))]);
};

/**
 * Where this page load starts, decided once, when this module first runs.
 *
 * A link outranks the remembered place: the person following it was handed
 * *this* hymn. Otherwise the app opens in the Hymnal at your place in it —
 * the book people reach for by number — whichever book you closed it in.
 *
 * Module scope rather than an effect, because an effect runs twice under
 * StrictMode, and the old restore effect's first pass stripped the link from
 * the URL so its second pass found none and overwrote the invited hymn with
 * the remembered one. The store reads localStorage synchronously, so it is
 * ready here.
 */
const arrival: HymnAddress | null = (() => {
  if (typeof window === "undefined") return null;
  const store = useHymnalStore.getState();
  // Songs added in the app go into the book before anything reads it.
  registerAdded(store);
  useHymnalStore.subscribe((now, before) => {
    if (now.mySongs !== before.mySongs || now.approvedSongs !== before.approvedSongs) registerAdded(now);
  });
  const link = readLink();
  if (link) store.navigate(link.hymnalId, link.number, { record: true });
  else store.setHymnal(getDefaultHymnal().id);
  store.countLaunch();
  return link;
})();

let urlTidied = false;

interface AppProps {
  /** The hymn a /hymn/245 page was built for, so its HTML shows that hymn. */
  initial?: HymnAddress;
}

/**
 * The reader: one hymn on screen, the bars around it, and whatever layer is
 * open over it.
 *
 * The hymn on screen is read from the store (`positions[hymnalId]`) rather
 * than kept here and copied back by effects. That copying is how a launch
 * once wrote hymn 1 over everyone's saved place, in both books.
 */
export default function App({ initial }: AppProps) {
  const hydrated = useHydrated();
  const isDesktop = useIsDesktop();
  // Redraw when songs added in the app arrive in More Songs.
  useBooks();
  const { layer, open, close } = useLayers();

  const storeBook = useHymnalStore((s) => s.hymnalId);
  const positions = useHymnalStore((s) => s.positions);
  const favorites = useHymnalStore((s) => s.favorites);
  const recents = useHymnalStore((s) => s.recents);
  const launches = useHymnalStore((s) => s.launches);
  const songStatuses = useHymnalStore((s) => s.songStatuses);
  const navigate = useHymnalStore((s) => s.navigate);
  const setHymnal = useHymnalStore((s) => s.setHymnal);
  const toggleFavorite = useHymnalStore((s) => s.toggleFavorite);

  // Until hydration the store can only report its defaults, so a page built
  // for one hymn shows that hymn rather than hymn 1.
  const pinned = !hydrated && initial ? initial : null;
  const hymnal = getHymnal(pinned?.hymnalId ?? storeBook) ?? getDefaultHymnal();
  const at = pinned?.number ?? positions[hymnal.id];
  const hymn = (at !== undefined && getHymn(hymnal, at)) || firstHymn(hymnal);

  /**
   * The bars float over the hymn and tuck away while you read down a long
   * one: down hides them, up brings them back, and so does reaching the top,
   * reaching the end (the next hymn is the obvious move) or turning the page.
   * Not on a desktop, which has room to spare.
   */
  const [chromeAway, setChromeAway] = useState(false);
  const lastScroll = useRef(0);
  const scrolled = (top: number, end: number) => {
    const delta = top - lastScroll.current;
    lastScroll.current = top;
    if (isDesktop || top < 48 || top > end - 8) setChromeAway(false);
    else if (delta > 6) setChromeAway(true);
    else if (delta < -6) setChromeAway(false);
  };
  /** Which way the last page turn went, so the new page slides in from that side. */
  const [direction, setDirection] = useState(0);
  const [sidebarAt, setSidebarAt] = useState<{ path: string[]; nonce: number }>();

  /**
   * The layer over the page. "auto" — nothing chosen yet — is the keypad on a
   * phone, where opening ready to type a number is the point of the app, and
   * nothing on a desktop or for someone who arrived from a link (a keypad
   * over the hymn they were sent would hide it). The menu is never a layer on
   * a desktop, where the sidebar already is the menu.
   */
  const resolved: Layer | null =
    layer === "auto" ? (isDesktop === false && !arrival ? { id: "keypad" } : null) : layer;
  const shown = resolved?.id === "menu" && isDesktop ? null : resolved;
  const away = chromeAway && shown === null;

  const index = hymnal.hymns.findIndex((h) => h.number === hymn.number);
  const prev = index > 0 ? hymnal.hymns[index - 1] : null;
  const next = index >= 0 && index < hymnal.hymns.length - 1 ? hymnal.hymns[index + 1] : null;

  /** Paging past hymns isn't looking for them, so it stays out of Recent. */
  const paginate = (delta: 1 | -1) => {
    const target = delta > 0 ? next : prev;
    if (!target) return;
    setDirection(delta);
    navigate(hymnal.id, target.number);
  };

  /** Somewhere someone chose to go: by number, search, a list, or Recent. */
  const goTo = (number: number, hymnalId: string, closeLayer = true) => {
    setDirection(hymnalId === hymnal.id ? Math.sign(number - hymn.number) : 0);
    navigate(hymnalId, number, { record: true });
    if (closeLayer) close();
  };

  /** Each book keeps your place, so crossing over lands where you left it. */
  const chooseBook = (id: string) => {
    setDirection(0);
    setHymnal(id);
    close();
  };

  // Songs added in the app and approved since this phone last looked, and
  // where this phone's own additions stand. Offline, the kept list serves.
  useEffect(() => {
    const mine = useHymnalStore.getState().mySongs.map((s) => s.number);
    fetch(`/api/songs${mine.length ? `?mine=${mine.join(",")}` : ""}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.songs)) useHymnalStore.getState().setApprovedSongs(data.songs, data.statuses ?? {});
      })
      .catch(() => {});
  }, []);

  // A link has done its job once the hymn is open. Left in the address bar, a
  // reload or an install would keep jumping back to it.
  useEffect(() => {
    if (urlTidied || !arrival) return;
    urlTidied = true;
    window.history.replaceState(window.history.state, "", "/");
  }, []);

  // The tab title, and what a screen reader hears, follow the hymn on screen.
  const announcement = hydrated
    ? isNumbered(hymnal)
      ? `${hymnHeading(hymnal, hymn)}. ${primaryName(hymnal, hymn)}`
      : primaryName(hymnal, hymn)
    : "";

  useEffect(() => {
    if (!announcement) return;
    const wanted = `${announcement} · Hymnal`;
    const apply = () => {
      if (document.title !== wanted) document.title = wanted;
    };
    apply();
    // Next streams the page's own metadata in after the app has hydrated, and
    // hydrating it puts the build-time title ("Hymnal") back over this one.
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [announcement]);

  // A desktop deserves a keyboard: arrows page, "/" or ⌘K searches, a digit
  // starts a number, Escape closes whatever is open.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open({ id: "search" });
        return;
      }
      // Before the typing check: Escape is most needed inside the search box.
      if (e.key === "Escape") {
        if (shown) close();
        return;
      }
      const typing =
        e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      // Whatever is over the page owns the keyboard (the keypad reads its own
      // digits), so nothing here pages a hymn nobody can see.
      if (shown) return;

      if (e.key === "ArrowRight") paginate(1);
      else if (e.key === "ArrowLeft") paginate(-1);
      else if (e.key === "/") {
        e.preventDefault();
        open({ id: "search" });
      } else if (/^\d$/.test(e.key)) {
        open({ id: "keypad", seed: e.key });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // A song added on this phone says who can see it until it's approved.
  const own = isExpandable(hymnal) && isCommunityNumber(hymn.number) ? songStatuses[hymn.number] : undefined;
  const note =
    own === "pending"
      ? "Only on your phone until it\u2019s approved"
      : own === "rejected"
        ? "Only on your phone"
        : undefined;

  const shortcut =
    isDesktop === true ? (/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘K" : "Ctrl K") : null;

  const collection = getDefaultHymnal();
  const keypadRecents = forBook(recents, collection.id).filter(
    (n) => !(hymnal.id === collection.id && n === hymn.number),
  );

  return (
    <>
      <ThemeSync />
      <LaunchCurtain />

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

      {/*
        `fixed inset-0` rather than `h-[100dvh]`: in an installed iOS app, `dvh`
        can be measured against a stale viewport right after a reload, pushing
        the bottom bar off the screen. Fixed positioning is pinned to the real
        viewport on every paint.
      */}
      <div id="app-shell" className="fixed inset-0 flex overflow-hidden">
        {isDesktop === true && (
          <Sidebar
            hymnal={hymnal}
            current={hymn.number}
            openAt={sidebarAt}
            onSelect={(n, id) => goTo(n, id, false)}
            onChooseBook={() => open({ id: "book" })}
          />
        )}

        <div className="relative min-w-0 flex-1">
          <div aria-hidden className="status-veil" />
          <TopBar
            away={away}
            hymnal={hymnal}
            hymn={hymn}
            isFavorite={forBook(favorites, hymnal.id).includes(hymn.number)}
            onOpenMenu={() => open({ id: "menu" })}
            onChooseBook={() => open({ id: "book" })}
            onToggleFavorite={() => toggleFavorite(hymnal.id, hymn.number)}
            onOpenShare={() => open({ id: "share" })}
          />

          <main className="absolute inset-0">
            <HymnView
              onScroll={scrolled}
              hymnal={hymnal}
              hymn={hymn}
              direction={direction}
              note={note}
              onNext={() => paginate(1)}
              onPrev={() => paginate(-1)}
              onOpenTunes={() => hymn.meter && open({ id: "tunes" })}
              onOpenSection={(path) =>
                isDesktop
                  ? setSidebarAt((s) => ({ path, nonce: (s?.nonce ?? 0) + 1 }))
                  : open({ id: "menu", menuPath: path })
              }
            />
            <InstallCard eligible={hydrated && shown === null && (launches >= 2 || arrival !== null)} />
          </main>

          <BottomBar
            away={away}
            hymnal={hymnal}
            prev={prev}
            next={next}
            shortcut={shortcut}
            onPrev={() => paginate(-1)}
            onNext={() => paginate(1)}
            onFind={() => open({ id: isDesktop ? "search" : "keypad" })}
          />
        </div>
      </div>

      {/* Mounted only while open, never through AnimatePresence: with the
          React Compiler on it left closed layers invisible over the page,
          swallowing every tap. */}
      {shown?.id === "keypad" && (
        <NumberPad
          seed={shown.seed}
          recents={keypadRecents}
          onGo={(n) => goTo(n, collection.id)}
          onWordSearch={() => open({ id: "search" })}
          onClose={close}
        />
      )}

      {shown?.id === "search" && (
        <TextSearch
          current={hymnal}
          onSelect={(n, id) => goTo(n, id)}
          onNumberPad={() => open({ id: "keypad" })}
          onClose={close}
        />
      )}

      {shown?.id === "menu" && (
        <NavDrawer
          hymnal={hymnal}
          current={hymn.number}
          openPath={shown.menuPath}
          onClose={close}
          onSelect={(n, id) => goTo(n, id)}
          onChooseBook={() => open({ id: "book" })}
        />
      )}

      {shown?.id === "book" && (
        <BookSheet
          current={hymnal}
          onChoose={(id) => (id === hymnal.id ? close() : chooseBook(id))}
          onClose={close}
        />
      )}

      {shown?.id === "tunes" && hymn.meter && <TuneSheet meter={hymn.meter} onClose={close} />}

      {shown?.id === "share" && <ShareSheet hymnal={hymnal} hymn={hymn} onClose={close} />}
    </>
  );
}
