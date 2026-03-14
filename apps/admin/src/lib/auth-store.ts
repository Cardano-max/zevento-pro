import { create } from 'zustand';

interface AuthState {
  token: string | null;
  isLoggedIn: boolean;
  setToken: (token: string) => void;
  logout: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  isLoggedIn: false,

  setToken: (token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_token', token);
    }
    set({ token, isLoggedIn: true });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }
    set({ token: null, isLoggedIn: false });
  },

  initialize: () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('admin_token');
      set({ token, isLoggedIn: !!token });
    }
  },
}));
