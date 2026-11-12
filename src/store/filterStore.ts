import { create } from 'zustand';

interface FilterState {
  minBuyin: number;
  maxBuyin: number;
  minEv: number;
  setMinBuyin: (val: number) => void;
  setMaxBuyin: (val: number) => void;
  setMinEv: (val: number) => void;
}

export const useStore = create<FilterState>((set: any) => ({
  minBuyin: 0,
  maxBuyin: 1000,
  minEv: -10,
  setMinBuyin: (val: number) => set({ minBuyin: val }),
  setMaxBuyin: (val: number) => set({ maxBuyin: val }),
  setMinEv: (val: number) => set({ minEv: val }),
}));

