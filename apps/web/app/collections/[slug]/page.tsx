import { notFound } from 'next/navigation';
import {
  CollectionSource,
  Rarity,
  type CollectionDetailDto,
} from '@sobrebox/shared';
import { fetchCollectionDetail } from '@/lib/api';
import { RarityBadge } from '@/components/collections/rarity-badge';

const RARITY_ORDER: Rarity[] = [
  Rarity.COMMON,
  Rarity.UNCOMMON,
  Rarity.RARE,
  Rarity.ULTRA_RARE,
  Rarity.SECRET,
  Rarity.LIMITED,
];

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let detail: CollectionDetailDto;
  try {
    detail = await fetchCollectionDetail(slug);
  } catch {
    notFound();
  }

  const verified = detail.source !== CollectionSource.COMMUNITY;
  const itemsByRarity = RARITY_ORDER.map((rarity) => ({
    rarity,
    items: detail.items.filter((i) => i.rarity === rarity),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="container mx-auto px-6 py-8">
      <header className="mb-8 flex flex-col gap-2">
        <div
          className="aspect-[3/1] w-full rounded-lg bg-muted bg-cover bg-center"
          style={
            detail.coverImageUrl
              ? { backgroundImage: `url(${detail.coverImageUrl})` }
              : undefined
          }
          role="img"
          aria-label={detail.name}
        />
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-3xl font-bold">{detail.name}</h1>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {verified ? 'Verified' : 'Community'}
          </span>
        </div>
        <p className="text-muted-foreground">
          {detail.brand.name} · {detail.category}
          {detail.releaseYear ? ` · ${detail.releaseYear}` : ''}
          {detail.createdBy ? ` · by @${detail.createdBy.username}` : ''}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          {detail.rarityDistribution.map((r) => (
            <span key={r.rarity} className="text-xs text-muted-foreground">
              <RarityBadge rarity={r.rarity} /> ×{r.count}
            </span>
          ))}
        </div>
      </header>

      {detail.packTypes.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-heading text-xl font-semibold">
            Pack types
          </h2>
          <ul className="flex flex-col gap-2">
            {detail.packTypes.map((p) => (
              <li
                key={p.id}
                className="flex justify-between rounded-md border p-3 text-sm"
              >
                <span>
                  {p.name} · {p.summary}
                </span>
                <span className="font-mono">
                  {p.price ? `${p.price} €` : '—'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-6">
        {itemsByRarity.map((group) => (
          <div key={group.rarity}>
            <div className="mb-2">
              <RarityBadge rarity={group.rarity} />
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {group.items.map((i) => (
                <li key={i.id} className="rounded-md border p-3">
                  <div
                    className="mb-2 aspect-[3/4] rounded bg-muted bg-cover bg-center"
                    style={
                      i.imageUrl
                        ? { backgroundImage: `url(${i.imageUrl})` }
                        : undefined
                    }
                    role="img"
                    aria-label={i.name}
                  />
                  <p className="text-sm font-medium leading-tight">{i.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    Official: {i.officialPullRate ?? '—'}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <p className="mt-8 text-sm text-muted-foreground/70">
        Community pull rates, opening counts and collectors: coming soon.
      </p>
    </main>
  );
}
