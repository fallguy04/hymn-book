import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CommunitySong, SongStatus } from "@/lib/community";

export type Theme = "system" | "light" | "dark";
export type TextSize = "s" | "m" | "l" | "xl";

export interface SavedTune {
  name: string;
  meter: string;
}

/**
 * Hymn numbers grouped by the book they belong to.
 *
 * They used to be a bare list of numbers, which quietly assumed there was only
 * ever one book. Starring Amazing Grace also starred hymn 2 of the collection.
 * A number on its own does not identify a song.
 */
export type ByBook = Record<string, number[]>;

/** A sync code this device created, kept so closing the menu doesn't lose it. */
export interface HeldCode {
  code: string;
  expiresAt: number;
}

interface HymnalState {
  /** The book on screen. */
  hymnalId: string;
  /**
   * Where you are in each book, keyed by book id. This *is* the current page:
   * the hymn on screen is `positions[hymnalId]`, so there is one place that
   * says where you are rather than a page-local number kept in step with the
   * store by effects — which is how a launch once wiped everyone's place.
   */
  positions: Record<string, number>;
  favorites: ByBook;
  recents: ByBook;
  tunes: SavedTune[];
  theme: Theme;
  textSize: TextSize;
  /** Songs added from this phone, shown here at once, whatever their review. */
  mySongs: CommunitySong[];
  /** Songs added in the app and approved for everyone; kept for offline. */
  approvedSongs: CommunitySong[];
  /** Where this phone's own songs stand, by number. */
  songStatuses: Record<number, SongStatus>;
  /** Word searches that led somewhere, newest first. */
  searches: string[];
  installDismissed: boolean;
  /** How many times the app has been opened here; gates the install invitation. */
  launches: number;
  heldCode: HeldCode | null;

  /**
   * Go somewhere. Book and number change in one write, so nothing can render
   * the new number against the old book. `record` adds it to Recent — only for
   * hymns someone went looking for, never for pages swiped past on the way.
   */
  navigate: (hymnalId: string, number: number, opts?: { record?: boolean }) => void;
  setHymnal: (id: string) => void;
  toggleFavorite: (hymnalId: string, number: number) => void;
  addTune: (tune: SavedTune) => void;
  removeTune: (name: string, meter: string) => void;
  setTheme: (theme: Theme) => void;
  setTextSize: (size: TextSize) => void;
  addMySong: (song: CommunitySong) => void;
  setApprovedSongs: (songs: CommunitySong[], statuses: Record<number, SongStatus>) => void;
  rememberSearch: (query: string) => void;
  forgetSearch: (query: string) => void;
  clearSearches: () => void;
  dismissInstall: () => void;
  countLaunch: () => void;
  holdCode: (code: HeldCode | null) => void;
  applySync: (incoming: SyncedState) => void;
}

/** What a sync code carries: stars and tunes. Recents are a trail through
 *  this device, and display settings are each device's own. */
export interface SyncedState {
  favorites: ByBook;
  tunes: SavedTune[];
}

const RECENTS_LIMIT = 8;

/** Read one book's list without every caller having to guard for undefined. */
export const forBook = (byBook: ByBook, hymnalId: string): number[] => byBook[hymnalId] ?? [];

/** Total across every book, for the counts in the menu. */
export const countAll = (byBook: ByBook): number =>
  Object.values(byBook).reduce((n, list) => n + list.length, 0);

export const useHymnalStore = create<HymnalState>()(
  persist(
    (set) => ({
      hymnalId: "brethren",
      positions: {},
      favorites: {},
      recents: {},
      tunes: [],
      theme: "system",
      textSize: "m",
      mySongs: [],
      approvedSongs: [],
      songStatuses: {},
      searches: [],
      installDismissed: false,
      launches: 0,
      heldCode: null,

      navigate: (hymnalId, number, opts) =>
        set((s) => {
          const own = forBook(s.recents, hymnalId);
          const recents =
            opts?.record && own[0] !== number
              ? {
                  ...s.recents,
                  [hymnalId]: [number, ...own.filter((n) => n !== number)].slice(0, RECENTS_LIMIT),
                }
              : s.recents;
          if (s.hymnalId === hymnalId && s.positions[hymnalId] === number && recents === s.recents) {
            return s;
          }
          return { hymnalId, positions: { ...s.positions, [hymnalId]: number }, recents };
        }),

      setHymnal: (hymnalId) => set((s) => (s.hymnalId === hymnalId ? s : { hymnalId })),

      toggleFavorite: (hymnalId, number) =>
        set((s) => {
          const own = forBook(s.favorites, hymnalId);
          const next = own.includes(number)
            ? own.filter((n) => n !== number)
            : [...own, number].sort((a, b) => a - b);
          return { favorites: { ...s.favorites, [hymnalId]: next } };
        }),

      addTune: (tune) =>
        set((s) =>
          s.tunes.some((t) => t.name === tune.name && t.meter === tune.meter)
            ? s
            : { tunes: [...s.tunes, tune] },
        ),

      removeTune: (name, meter) =>
        set((s) => ({ tunes: s.tunes.filter((t) => !(t.name === name && t.meter === meter)) })),

      setTheme: (theme) => set({ theme }),
      setTextSize: (textSize) => set({ textSize }),
      addMySong: (song) =>
        set((s) => ({
          mySongs: [...s.mySongs.filter((m) => m.number !== song.number), song],
          songStatuses: { ...s.songStatuses, [song.number]: "pending" },
        })),
      setApprovedSongs: (approvedSongs, statuses) =>
        set((s) => ({ approvedSongs, songStatuses: { ...s.songStatuses, ...statuses } })),
      rememberSearch: (query) =>
        set((s) => {
          const q = query.trim();
          if (!q) return s;
          const rest = s.searches.filter((x) => x.toLowerCase() !== q.toLowerCase());
          return { searches: [q, ...rest].slice(0, 8) };
        }),
      forgetSearch: (query) => set((s) => ({ searches: s.searches.filter((x) => x !== query) })),
      clearSearches: () => set({ searches: [] }),
      dismissInstall: () => set({ installDismissed: true }),
      countLaunch: () => set((s) => ({ launches: s.launches + 1 })),
      holdCode: (heldCode) => set({ heldCode }),

      /**
       * Merge rather than replace, and leave this device's display alone.
       *
       * The screen promises a code "adds to what is here". It used to replace
       * text size and theme with the other device's — so someone reading at XL
       * dropped back to medium on redeeming a code, because the device that
       * made it had never had its size changed. Stars and tunes are the point
       * of a code; how this screen looks is this person's own choice.
       */
      applySync: (incoming) =>
        set((s) => {
          const favorites: ByBook = { ...s.favorites };
          for (const [book, list] of Object.entries(incoming.favorites)) {
            favorites[book] = [...new Set([...forBook(s.favorites, book), ...list])].sort(
              (a, b) => a - b,
            );
          }
          return {
            favorites,
            tunes: [
              ...s.tunes,
              ...incoming.tunes.filter(
                (t) => !s.tunes.some((own) => own.name === t.name && own.meter === t.meter),
              ),
            ],
          };
        }),
    }),
    {
      name: "hymnal",
      version: 3,
      // New fields (launches, heldCode, the added songs) need no migration: persist merges the
      // stored state over these defaults, so an older save simply lacks them.
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Record<string, unknown>;

        // v2 → v3: favorites and recents grow a book. Everything saved before
        // then belongs to the collection.
        //
        // (A v1 → v2 import of two older localStorage keys used to sit here.
        // It could never run — this key first shipped at version 2, and
        // migrate is only called for a value that exists — so it is gone.)
        if (version < 3) {
          if (Array.isArray(state.favorites)) {
            state.favorites = state.favorites.length ? { brethren: state.favorites } : {};
          }
          if (Array.isArray(state.recents)) {
            state.recents = state.recents.length ? { brethren: state.recents } : {};
          }
        }

        return state as unknown as HymnalState;
      },
    },
  ),
);
