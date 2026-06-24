'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addInventoryItem,
  addWishlistItem,
  fetchCollectionProgress,
} from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { WishlistPriority } from '@sobrebox/shared';

export function CollectionOwnershipPanel({ slug }: { slug: string }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['inventory', 'progress', slug],
    queryFn: () => fetchCollectionProgress(slug, accessToken as string),
    enabled: !!accessToken,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ['inventory', 'progress'],
    });

  const markOwned = useMutation({
    mutationFn: (collectionItemId: string) =>
      addInventoryItem(
        { collectionItemId, quantity: 1 },
        accessToken as string,
      ),
    onSuccess: invalidate,
  });

  const wantIt = useMutation({
    mutationFn: (collectionItemId: string) =>
      addWishlistItem(
        {
          collectionItemId,
          priority: WishlistPriority.MEDIUM,
          isPublic: true,
        },
        accessToken as string,
      ),
    onSuccess: invalidate,
  });

  if (!accessToken) return null;
  if (!data) return null;

  return (
    <section className="mt-8 rounded-lg border p-4">
      <h2 className="mb-1 text-lg font-semibold">Tu progreso</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {data.owned} / {data.total} · {data.percent}%
      </p>
      <ul className="space-y-2">
        {data.items.map((it) => (
          <li
            key={it.collectionItemId}
            className="flex items-center justify-between gap-2"
          >
            <span
              className={
                it.ownedQuantity > 0 ? 'font-medium' : 'text-muted-foreground'
              }
            >
              <span>{it.name}</span>
              {it.ownedQuantity > 0 ? ` ×${it.ownedQuantity}` : ' (te falta)'}
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={() => markOwned.mutate(it.collectionItemId)}
              >
                {it.ownedQuantity > 0 ? `+1 ${it.name}` : `Tengo ${it.name}`}
              </button>
              {it.ownedQuantity === 0 && (
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => wantIt.mutate(it.collectionItemId)}
                >
                  Wishlist
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
