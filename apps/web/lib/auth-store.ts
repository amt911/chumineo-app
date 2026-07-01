import { create } from 'zustand';
import type { PublicUserDto } from '@sobrebox/shared';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  accessToken: string | null;
  user: PublicUserDto | null;
  status: AuthStatus;
  setSession: (accessToken: string, user: PublicUserDto) => void;
  setAccessToken: (accessToken: string) => void;
  setStatus: (status: AuthStatus) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: 'loading',
  setSession: (accessToken, user) =>
    set({ accessToken, user, status: 'authenticated' }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setStatus: (status) => set({ status }),
  clear: () =>
    set({ accessToken: null, user: null, status: 'unauthenticated' }),
}));
