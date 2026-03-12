import { create } from 'zustand';

interface NotificationState {
  message: string | null;
  type: 'success' | 'error' | 'info' | null;
  setNotification: (payload: { message: string; type: 'success' | 'error' | 'info' }) => void;
  clearNotification: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  message: null,
  type: null,
  setNotification: (payload) => set({ message: payload.message, type: payload.type }),
  clearNotification: () => set({ message: null, type: null }),
}));
