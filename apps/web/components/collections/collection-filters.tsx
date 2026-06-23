'use client';
import { useQuery } from '@tanstack/react-query';
import { CollectionCategory } from '@sobrebox/shared';
import { fetchBrands } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type CatalogFilterState = {
  brand?: string;
  category?: CollectionCategory;
  year?: number;
  q?: string;
};

export function CollectionFilters({
  value,
  onChange,
}: {
  value: CatalogFilterState;
  onChange: (next: CatalogFilterState) => void;
}) {
  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: fetchBrands,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="q">Search</Label>
        <Input
          id="q"
          placeholder="Search collections"
          value={value.q ?? ''}
          onChange={(e) =>
            onChange({ ...value, q: e.target.value || undefined })
          }
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brand">Brand</Label>
        <select
          id="brand"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={value.brand ?? ''}
          onChange={(e) =>
            onChange({ ...value, brand: e.target.value || undefined })
          }
        >
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={value.category ?? ''}
          onChange={(e) =>
            onChange({
              ...value,
              category: (e.target.value || undefined) as
                | CollectionCategory
                | undefined,
            })
          }
        >
          <option value="">All categories</option>
          {Object.values(CollectionCategory).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="year">Year</Label>
        <Input
          id="year"
          type="number"
          placeholder="Any year"
          value={value.year ?? ''}
          onChange={(e) =>
            onChange({
              ...value,
              year: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        />
      </div>
    </div>
  );
}
