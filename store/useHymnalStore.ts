import { create } from "zustand";
import { persist } from "zustand/middleware";

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
 * ever one book. Starring Amazing Grace — song 5 of Other Songs — also starred
 * hymn 5 of the collection, "Praise for God's Goodness", and the favorites list
 * resolved every saved number against whatever book you happened to be in. A
 * number on its own does not identify a song.
 */
export type ByBook = Record<string, number[]>;

interface HymnalState {
  hymnalId: string;
  /**
   * Where you last were in each book, keyed by book id. The ribbon tab is a
   * bookmark, so crossing to the other book and back should land you where you
   * left off rather than at song one.
   */
  positions: Record<string, number>;
  favorites: ByBook;
  recents: ByBook;
  tunes: SavedTune[];
  theme: Theme;
  textSize: TextSize;
  installDismissed: boolean;

  setHymnal: (id: string) => void;
  setPosition: (hymnalId: string, number: number) => void;
  toggleFavorite: (hymnalId: string, number: number) => void;
  visit: (hymnalId: string, number: number) => void;
  addTune: (tune: SavedTune) => void;
  removeTune: (name: string, meter: string) => void;
  setTheme: (theme: Theme) => void;
  setTextSize: (size: TextSize) => void;
  dismissInstall: () => void;
  applySync: (incoming: SyncedState) => void;
}

/** The part of the store a sync code carries. Recents are left out — they're
 *  a trail through this device, not a preference worth moving. */
export interface SyncedState {
  favorites: ByBook;
  tunes: SavedTune[];
  theme: Theme;
  textSize: TextSize;
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
      installDismissed: false,

      setHymnal: (hymnalId) => set({ hymnalId }),

      setPosition: (hymnalId, number) =>
        set((s) =>
          s.positions[hymnalId] === number
            ? s
            : { positions: { ...s.positions, [hymnalId]: number } },
        ),

      toggleFavorite: (hymnalId, number) =>
        set((s) => {
          const own = forBook(s.favorites, hymnalId);
          const next = own.includes(number)
            ? own.filter((n) => n !== number)
            : [...own, number].sort((a, b) => a - b);
          return { favorites: { ...s.favorites, [hymnalId]: next } };
        }),

      visit: (hymnalId, number) =>
        set((s) => {
          const own = forBook(s.recents, hymnalId);
          if (own[0] === number) return s;
          const next = [number, ...own.filter((n) => n !== number)].slice(0, RECENTS_LIMIT);
          return { recents: { ...s.recents, [hymnalId]: next } };
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
      dismissInstall: () => set({ installDismissed: true }),

      /**
       * Merge rather than replace. Someone restoring a code onto a device they
       * have already been using should not silently lose the hymns they
       * starred on it — a union can be pruned afterwards, a wipe cannot be
       * undone. Appearance is taken from the incoming side, since that is the
       * setting you were deliberately carrying over.
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
            theme: incoming.theme,
            textSize: incoming.textSize,
          };
        }),
    }),
    {
      name: "hymnal",
      version: 3,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Record<string, unknown>;

        // v1 → v2: two pre-store localStorage keys the app used to write
        // directly, so nobody loses their starred hymns or tune list.
        if (version < 2 && typeof window !== "undefined") {
          const read = <T,>(key: string, fallback: T): T => {
            try {
              const raw = window.localStorage.getItem(key);
              return raw ? (JSON.parse(raw) as T) : fallback;
            } catch {
              return fallback;
            }
          };
          if (!(state.favorites as number[])?.length) {
            state.favorites = read<number[]>("hymn_favorites", []);
          }
          if (!(state.tunes as SavedTune[])?.length) {
            state.tunes = read<SavedTune[]>("spark_tunes", []);
          }
        }

        // v2 → v3: favorites and recents grow a book. Everything saved before
        // now belongs to the collection — Other Songs is new enough that no
        // real star predates it, and guessing wrong here would move somebody's
        // hymns to a book they never opened.
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
