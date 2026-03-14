import { create } from 'zustand';

interface AuthState {
  token: string | null;
  user: { id: string; phone: string; name?: string } | null;
  isLoggedIn: boolean;
  setToken: (token: string, user?: any) => void;
  logout: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isLoggedIn: false,

  setToken: (token: string, user?: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('web_token', token);
      if (user) localStorage.setItem('web_user', JSON.stringify(user));
    }
    set({ token, user, isLoggedIn: true });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('web_token');
      localStorage.removeItem('web_user');
      window.location.href = '/';
    }
    set({ token: null, user: null, isLoggedIn: false });
  },

  initialize: () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('web_token');
      const userStr = localStorage.getItem('web_user');
      const user = userStr ? JSON.parse(userStr) : null;
      set({ token, user, isLoggedIn: !!token });
    }
  },
}));
