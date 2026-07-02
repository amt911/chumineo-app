'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ListingStatus } from '@sobrebox/shared';
import { deleteListing, fetchMyListings, updateListing } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';

export function MyListings() {
  const t = useTranslations('Marketplace');
  const status = useAuthStore((s) => s.status);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['marketplace', 'mine'],
    queryFn: () => fetchMyListings(accessToken as string),
    enabled: status === 'authenticated',
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['marketplace', 'mine'] });

  const togglePause = useMutation({
    mutationFn: (v: { id: string; status: ListingStatus }) =>
      updateListing(
        v.id,
        {
          status:
            v.status === ListingStatus.ACTIVE
              ? ListingStatus.PAUSED
              : ListingStatus.ACTIVE,
        },
        accessToken as string,
      ),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteListing(id, accessToken as string),
    onSuccess: () => {
      invalidate();
      toast.success(t('delete'));
    },
  });

  if (!data || data.items.length === 0) {
    return <p className="text-muted-foreground">{t('mineEmpty')}</p>;
  }

  return (
    <ul className="grid gap-4">
      {data.items.map((listing) => (
        <li
          key={listing.id}
          className="flex items-center justify-between rounded-lg border p-4"
        >
          <span>
            {listing.item.name} — {listing.price} € ({listing.status})
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                togglePause.mutate({ id: listing.id, status: listing.status })
              }
            >
              {t('pause')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => remove.mutate(listing.id)}
            >
              {t('delete')}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
