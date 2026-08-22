import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "system" | "light" | "dark";
export type TextSize = "s" | "m" | "l" | "xl";

export interface SavedTune {
  name: string;
  meter: string;
}

interface HymnalState {
  hymnalId: string;
  /**
   * Where you last were in each book, keyed by book id. The ribbon tab is a
   * bookmark, so crossing to the other book and back should land you where you
   * left off rather than at song one.
   */
  positions: Record<string, number>;
  favorites: number[];
  recents: number[];
  tunes: SavedTune[];
  theme: Theme;
  textSize: TextSize;
  installDismissed: boolean;

  setHymnal: (id: string) => void;
  setPosition: (hymnalId: string, number: number) => void;
  toggleFavorite: (number: number) => void;
  visit: (number: number) => void;
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
  favorites: number[];
  tunes: SavedTune[];
  theme: Theme;
  textSize: TextSize;
}

const RECENTS_LIMIT = 8;

export const useHymnalStore = create<HymnalState>()(
  persist(
    (set) => ({
      hymnalId: "brethren",
      positions: {},
      favorites: [],
      recents: [],
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

      toggleFavorite: (number) =>
        set((s) => ({
          favorites: s.favorites.includes(number)
            ? s.favorites.filter((n) => n !== number)
            : [...s.favorites, number].sort((a, b) => a - b),
        })),

      visit: (number) =>
        set((s) =>
          s.recents[0] === number
            ? s
            : { recents: [number, ...s.recents.filter((n) => n !== number)].slice(0, RECENTS_LIMIT) },
        ),

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
        set((s) => ({
          favorites: [...new Set([...s.favorites, ...incoming.favorites])].sort((a, b) => a - b),
          tunes: [
            ...s.tunes,
            ...incoming.tunes.filter(
              (t) => !s.tunes.some((own) => own.name === t.name && own.meter === t.meter),
            ),
          ],
          theme: incoming.theme,
          textSize: incoming.textSize,
        })),
    }),
    {
      name: "hymnal",
      version: 2,
      /**
       * Carry over the two pre-store localStorage keys the app used to write
       * directly, so nobody loses their starred hymns or tune list.
       */
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<HymnalState>;
        if (version >= 2 || typeof window === "undefined") return state;

        const read = <T,>(key: string, fallback: T): T => {
          try {
            const raw = window.localStorage.getItem(key);
            return raw ? (JSON.parse(raw) as T) : fallback;
          } catch {
            return fallback;
          }
        };

        return {
          ...state,
          favorites: state.favorites?.length ? state.favorites : read<number[]>("hymn_favorites", []),
          tunes: state.tunes?.length ? state.tunes : read<SavedTune[]>("spark_tunes", []),
        };
      },
    },
  ),
);
