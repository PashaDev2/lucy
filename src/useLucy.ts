import { create } from "zustand";

interface LucyState {
  scrollPosition: number;
}

const useLucy = create<LucyState>(() => ({
  scrollPosition: 0,
}));

export default useLucy;
