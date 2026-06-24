'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchInventoryProgress } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export function InventoryProgress() {
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', 'progress'],
    queryFn: () => fetchInventoryProgress(accessToken as string),
    enabled: !!accessToken,
  });

  if (!accessToken) return <p>Inicia sesión para ver tu inventario.</p>;
  if (isLoading) return <p>Cargando…</p>;
  if (!data || data.length === 0) {
    return (
      <p className="text-muted-foreground">
        Todavía no tienes ítems. Marca lo que tienes desde una colección.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {data.map((p) => (
        <li
          key={p.collection.slug}
          className="rounded-lg border p-4"
          data-testid="progress-card"
        >
          <Link
            href={`/collections/${p.collection.slug}`}
            className="font-medium hover:underline"
          >
            {p.collection.name}
          </Link>
          <p className="text-sm text-muted-foreground">
            {p.owned} / {p.total} · {p.percent}%
          </p>
          <div className="mt-2 h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${p.percent}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
