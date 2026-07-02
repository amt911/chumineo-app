'use client';
import { useQuery } from '@tanstack/react-query';
import { fetchMatches } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export function useMatches() {
  const status = useAuthStore((s) => s.status);
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['matches'],
    queryFn: () => fetchMatches(accessToken as string),
    enabled: status === 'authenticated',
  });
}
