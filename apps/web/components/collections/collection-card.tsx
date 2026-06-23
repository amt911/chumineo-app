import Link from 'next/link';
import { CollectionSource, type CollectionListItemDto } from '@sobrebox/shared';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function SourceBadge({ source }: { source: CollectionListItemDto['source'] }) {
  const verified = source !== CollectionSource.COMMUNITY;
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      {verified ? 'Verified' : 'Community'}
    </span>
  );
}

export function CollectionCard({
  collection,
  variant = 'grid',
}: {
  collection: CollectionListItemDto;
  variant?: 'grid' | 'list';
}) {
  const {
    slug,
    name,
    brand,
    category,
    itemCount,
    releaseYear,
    coverImageUrl,
    source,
  } = collection;
  return (
    <Link href={`/collections/${slug}`} className="group block">
      <Card className="overflow-hidden transition-colors hover:border-primary/50">
        <CardContent
          className={cn(
            'p-4',
            variant === 'grid'
              ? 'flex flex-col gap-2'
              : 'flex items-center gap-4',
          )}
        >
          <div
            className="aspect-[4/3] w-full shrink-0 rounded-md bg-muted bg-cover bg-center"
            style={
              coverImageUrl
                ? { backgroundImage: `url(${coverImageUrl})` }
                : undefined
            }
            role="img"
            aria-label={name}
          />
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-heading text-base font-semibold leading-tight">
                {name}
              </h3>
              <SourceBadge source={source} />
            </div>
            <p className="text-sm text-muted-foreground">
              {brand.name} · {category}
              {releaseYear ? ` · ${releaseYear}` : ''}
            </p>
            <p className="text-sm text-muted-foreground">{itemCount} items</p>
            <p className="text-xs text-muted-foreground/70">
              Openings &amp; pull rates: coming soon
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
