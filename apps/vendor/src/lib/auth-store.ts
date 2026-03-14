import { create } from 'zustand';

interface AuthState {
  token: string | null;
  role: string | null;
  isLoggedIn: boolean;
  setToken: (token: string, role: string) => void;
  logout: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  role: null,
  isLoggedIn: false,

  setToken: (token: string, role: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vendor_token', token);
      localStorage.setItem('vendor_role', role);
    }
    set({ token, role, isLoggedIn: true });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vendor_token');
      localStorage.removeItem('vendor_role');
      window.location.href = '/login';
    }
    set({ token: null, role: null, isLoggedIn: false });
  },

  initialize: () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('vendor_token');
      const role = localStorage.getItem('vendor_role');
      set({ token, role, isLoggedIn: !!token });
    }
  },
}));
