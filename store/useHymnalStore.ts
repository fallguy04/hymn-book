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
  theme: Theme;
  textSize: TextSize;
  installDismissed: boolean;

  setHymnal: (id: string) => void;
  toggleFavorite: (number: number) => void;
  visit: (number: number) => void;
  addTune: (tune: SavedTune) => void;
  removeTune: (name: string, meter: string) => void;
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
