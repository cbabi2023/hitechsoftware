import { create } from 'zustand';

interface UiStoreState {
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
}

export const useUiStore = create<UiStoreState>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (value) => set({ sidebarOpen: value }),
}));
