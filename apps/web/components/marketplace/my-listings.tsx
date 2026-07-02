'use client';
import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ListingStatus, type ListingDto } from '@sobrebox/shared';
import {
  deleteListing,
  deleteListingPhoto,
  fetchMyListings,
  updateListing,
  uploadListingPhotos,
} from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';

const MAX_PHOTOS = 5;

function ListingPhotos({
  listing,
  accessToken,
}: {
  listing: ListingDto;
  accessToken: string;
}) {
  const t = useTranslations('Marketplace');
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['marketplace', 'mine'] });

  const upload = useMutation({
    mutationFn: (files: File[]) =>
      uploadListingPhotos(listing.id, files, accessToken),
    onSuccess: () => {
      invalidate();
      toast.success(t('photosUploaded'));
    },
    onError: () => toast.error(t('photoUploadError')),
  });

  const remove = useMutation({
    mutationFn: (photoId: string) =>
      deleteListingPhoto(listing.id, photoId, accessToken),
    onSuccess: invalidate,
  });

  const atMax = listing.photos.length >= MAX_PHOTOS;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {listing.photos.map((photo) => (
        <div key={photo.id} className="relative h-16 w-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt=""
            className="h-full w-full rounded object-cover"
          />
          <button
            type="button"
            aria-label={t('deletePhoto')}
            onClick={() => remove.mutate(photo.id)}
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground"
          >
            ×
          </button>
        </div>
      ))}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) upload.mutate(files);
          e.target.value = '';
        }}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={atMax}
        title={atMax ? t('photoLimit') : undefined}
        onClick={() => inputRef.current?.click()}
      >
        {t('uploadPhotos')}
      </Button>
    </div>
  );
}

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
        <li key={listing.id} className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
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
          </div>
          <ListingPhotos
            listing={listing}
            accessToken={accessToken as string}
          />
        </li>
      ))}
    </ul>
  );
}
