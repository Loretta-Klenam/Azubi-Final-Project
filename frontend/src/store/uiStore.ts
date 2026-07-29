import { create } from 'zustand';

interface Toast {
  message: string;
  type: 'success' | 'error';
}

interface UIState {
  toast: Toast | null;
  showToast: (toast: Toast) => void;
  clearToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  toast: null,
  showToast: (toast) => {
    set({ toast });
    setTimeout(() => set({ toast: null }), 4000);
  },
  clearToast: () => set({ toast: null }),
}));
