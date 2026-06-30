'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { deleteWishlistItem, fetchWishlist } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export function WishlistList() {
  const t = useTranslations('Wishlist');
  const tc = useTranslations('Common');
  const status = useAuthStore((s) => s.status);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => fetchWishlist(accessToken as string),
    enabled: status === 'authenticated',
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteWishlistItem(id, accessToken as string),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
  });

  if (status === 'loading') return <p>{tc('loading')}</p>;
  if (status === 'unauthenticated') return <p>{t('loginPrompt')}</p>;
  if (isLoading) return <p>{tc('loading')}</p>;
  if (!data || data.length === 0) {
    return <p className="text-muted-foreground">{t('empty')}</p>;
  }

  return (
    <ul className="space-y-2">
      {data.map((w) => (
        <li
          key={w.id}
          className="flex items-center justify-between gap-2 rounded border p-3"
        >
          <span>
            <span className="font-medium">{w.item.name}</span>{' '}
            <span className="text-xs text-muted-foreground">
              {w.priority}
              {w.maxPrice ? ` · ${t('maxPrice', { price: w.maxPrice })}` : ''}
            </span>
          </span>
          <button
            type="button"
            className="rounded border px-2 py-1 text-xs"
            onClick={() => remove.mutate(w.id)}
          >
            {t('remove')}
          </button>
        </li>
      ))}
    </ul>
  );
}
