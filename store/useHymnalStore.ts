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
  favorites: number[];
  recents: number[];
  tunes: SavedTune[];
  /** Hymn numbers queued for a service, in the order they'll be sung. */
  service: number[];
  theme: Theme;
  textSize: TextSize;
  installDismissed: boolean;

  setHymnal: (id: string) => void;
  toggleFavorite: (number: number) => void;
  visit: (number: number) => void;
  addTune: (tune: SavedTune) => void;
  removeTune: (name: string, meter: string) => void;
  toggleService: (number: number) => void;
  moveService: (from: number, to: number) => void;
  clearService: () => void;
  setTheme: (theme: Theme) => void;
  setTextSize: (size: TextSize) => void;
  dismissInstall: () => void;
}

const RECENTS_LIMIT = 8;

export const useHymnalStore = create<HymnalState>()(
  persist(
    (set) => ({
      hymnalId: "brethren",
      favorites: [],
      recents: [],
      tunes: [],
      service: [],
      theme: "system",
      textSize: "m",
      installDismissed: false,

      setHymnal: (hymnalId) => set({ hymnalId }),

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

      toggleService: (number) =>
        set((s) => ({
          service: s.service.includes(number)
            ? s.service.filter((n) => n !== number)
            : [...s.service, number],
        })),

      moveService: (from, to) =>
        set((s) => {
          const next = [...s.service];
          if (from < 0 || from >= next.length || to < 0 || to >= next.length) return s;
          next.splice(to, 0, ...next.splice(from, 1));
          return { service: next };
        }),

      clearService: () => set({ service: [] }),

      setTheme: (theme) => set({ theme }),
      setTextSize: (textSize) => set({ textSize }),
      dismissInstall: () => set({ installDismissed: true }),
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
