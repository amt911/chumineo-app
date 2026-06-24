'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteWishlistItem, fetchWishlist } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export function WishlistList() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => fetchWishlist(accessToken as string),
    enabled: !!accessToken,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteWishlistItem(id, accessToken as string),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
  });

  if (!accessToken) return <p>Inicia sesión para ver tu wishlist.</p>;
  if (isLoading) return <p>Cargando…</p>;
  if (!data || data.length === 0) {
    return <p className="text-muted-foreground">Tu wishlist está vacía.</p>;
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
              {w.maxPrice ? ` · máx ${w.maxPrice}€` : ''}
            </span>
          </span>
          <button
            type="button"
            className="rounded border px-2 py-1 text-xs"
            onClick={() => remove.mutate(w.id)}
          >
            Quitar
          </button>
        </li>
      ))}
    </ul>
  );
}
