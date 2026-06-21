import { create } from 'zustand';
import type { PublicUserDto } from '@sobrebox/shared';

interface AuthState {
  accessToken: string | null;
  user: PublicUserDto | null;
  setSession: (accessToken: string, user: PublicUserDto) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setSession: (accessToken, user) => set({ accessToken, user }),
  clear: () => set({ accessToken: null, user: null }),
}));
