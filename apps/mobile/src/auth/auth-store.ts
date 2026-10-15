import type { Me } from '@plantpal/shared';
import { create } from 'zustand';

/**
 * Zustand rather than Context: the API client and the refresh logic read and update auth
 * state outside React (`useAuthStore.getState()`), which Context can't do.
 */
type AuthState = {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: Me | null;
  /** In memory only. */
  accessToken: string | null;
  accessTokenExpiresAt: number | null;
  setSignedIn: (user: Me, access?: { token: string; expiresAt: string }) => void;
  setAccess: (access: { token: string; expiresAt: string }) => void;
  setUser: (user: Me) => void;
  setSignedOut: () => void;
};

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'loading',
  user: null,
  accessToken: null,
  accessTokenExpiresAt: null,
  setSignedIn: (user, access) =>
    set({
      status: 'signedIn',
      user,
      accessToken: access?.token ?? null,
      accessTokenExpiresAt: access ? Date.parse(access.expiresAt) : null,
    }),
  setAccess: (access) =>
    set({ accessToken: access.token, accessTokenExpiresAt: Date.parse(access.expiresAt) }),
  setUser: (user) => set({ user }),
  setSignedOut: () =>
    set({ status: 'signedOut', user: null, accessToken: null, accessTokenExpiresAt: null }),
}));
