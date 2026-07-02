'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { deleteWishlistItem, fetchWishlist } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useMatches } from '@/components/matches/use-matches';

export function WishlistList() {
  const t = useTranslations('Wishlist');
  const tm = useTranslations('Matches');
  const tc = useTranslations('Common');
  const status = useAuthStore((s) => s.status);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => fetchWishlist(accessToken as string),
    enabled: status === 'authenticated',
  });
  const { data: matches } = useMatches();
  const matchByItemId = new Map((matches ?? []).map((m) => [m.item.id, m]));

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
    <>
      {matchByItemId.size > 0 ? (
        <Link
          href="/wishlist/matches"
          className="mb-4 inline-block text-sm underline"
        >
          {t('matchesLink')}
        </Link>
      ) : null}
      <ul className="space-y-2">
        {data.map((w) => {
          const match = matchByItemId.get(w.item.id);
          return (
            <li
              key={w.id}
              className="flex items-center justify-between gap-2 rounded border p-3"
            >
              <span>
                <span className="font-medium">{w.item.name}</span>{' '}
                <span className="text-xs text-muted-foreground">
                  {w.priority}
                  {w.maxPrice
                    ? ` · ${t('maxPrice', { price: w.maxPrice })}`
                    : ''}
                </span>
                {match ? (
                  <Link
                    href="/wishlist/matches"
                    className="ml-2 text-xs text-primary underline"
                  >
                    🛒 {tm('onSale', { count: match.listingCount })}
                    {match.inBudgetCount > 0 ? (
                      <span className="ml-1 text-green-600">
                        {tm('inBudget', { count: match.inBudgetCount })}
                      </span>
                    ) : null}
                  </Link>
                ) : null}
              </span>
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={() => remove.mutate(w.id)}
              >
                {t('remove')}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
