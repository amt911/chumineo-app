'use client';
import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { CollectionsQueryDto } from '@sobrebox/shared';
import { fetchCollectionsPage } from '@/lib/api';
import { CollectionCard } from './collection-card';
import {
  CollectionFilters,
  type CatalogFilterState,
} from './collection-filters';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Sort = CollectionsQueryDto['sort'];

export function CollectionBrowser() {
  const [filters, setFilters] = useState<CatalogFilterState>({});
  const [sort, setSort] = useState<Sort>('newest');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const query = useInfiniteQuery({
    queryKey: ['collections', filters, sort],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchCollectionsPage({ ...filters, sort, page: pageParam, limit: 20 }),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (
        entries[0].isIntersecting &&
        query.hasNextPage &&
        !query.isFetchingNextPage
      ) {
        void query.fetchNextPage();
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <aside className="md:w-64 md:shrink-0">
        <CollectionFilters value={filters} onChange={setFilters} />
      </aside>

      <div className="flex-1">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="sort">Sort</Label>
            <select
              id="sort"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
            >
              <option value="newest">Newest</option>
              <option value="name">Name A-Z</option>
              <option value="year">Year</option>
            </select>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              aria-label="Grid view"
              className={cn(
                'rounded-md border px-2 py-1 text-sm',
                view === 'grid' && 'bg-muted',
              )}
              onClick={() => setView('grid')}
            >
              Grid
            </button>
            <button
              type="button"
              aria-label="List view"
              className={cn(
                'rounded-md border px-2 py-1 text-sm',
                view === 'list' && 'bg-muted',
              )}
              onClick={() => setView('list')}
            >
              List
            </button>
          </div>
        </div>

        {query.isError && <p role="alert">Could not load collections.</p>}
        {query.isPending && <p className="text-muted-foreground">Loading…</p>}
        {query.isSuccess && items.length === 0 && (
          <p className="text-muted-foreground">
            No collections match your filters.
          </p>
        )}

        <div
          className={cn(
            view === 'grid'
              ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
              : 'flex flex-col gap-3',
          )}
        >
          {items.map((c) => (
            <CollectionCard key={c.id} collection={c} variant={view} />
          ))}
        </div>

        <div ref={sentinel} className="h-8" />
        {query.isFetchingNextPage && (
          <p className="text-muted-foreground">Loading more…</p>
        )}
      </div>
    </div>
  );
}
