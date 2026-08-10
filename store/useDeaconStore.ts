import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DeaconState {
  isOpen: boolean;
  activeMeter: string | null;
  savedTunes: Record<string, string[]>;
  openDrawer: (meter: string) => void;
  closeDrawer: () => void;
  addTune: (meter: string, tune: string) => void;
  removeTune: (meter: string, tune: string) => void;
}

export const useDeaconStore = create<DeaconState>()(
  persist(
    (set) => ({
      isOpen: false,
      activeMeter: null,
      savedTunes: {},
      openDrawer: (meter) => set({ isOpen: true, activeMeter: meter }),
      closeDrawer: () => set({ isOpen: false }),
      addTune: (meter, tune) => set((state) => {
        const currentTunes = state.savedTunes[meter] || [];
        if (currentTunes.includes(tune)) return state;
        return {
          savedTunes: { ...state.savedTunes, [meter]: [...currentTunes, tune] }
        };
      }),
      removeTune: (meter, tune) => set((state) => ({
        savedTunes: {
          ...state.savedTunes,
          [meter]: (state.savedTunes[meter] || []).filter((t) => t !== tune)
        }
      })),
    }),
    { name: 'deacon-storage' }
  )
);