'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import {
  Condition,
  createListingFormSchema,
  type CreateListingFormValues,
} from '@sobrebox/shared';
import { createListing, fetchListingAvailability } from '@/lib/api';
import { errorMessageKey } from '@/lib/error-messages';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function CreateListingForm({
  collectionItemId,
}: {
  collectionItemId: string;
}) {
  const t = useTranslations('Marketplace');
  const tRoot = useTranslations();
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data: availability } = useQuery({
    queryKey: ['marketplace', 'availability', collectionItemId],
    queryFn: () =>
      fetchListingAvailability(collectionItemId, accessToken as string),
    enabled: !!accessToken,
  });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CreateListingFormValues>({
    resolver: zodResolver(createListingFormSchema),
    defaultValues: { condition: Condition.MINT, price: '', description: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: CreateListingFormValues) =>
      createListing(
        {
          collectionItemId,
          quantity: values.quantity,
          condition: values.condition,
          price: values.price,
          ...(values.description ? { description: values.description } : {}),
        },
        accessToken as string,
      ),
    onSuccess: (listing) => {
      toast.success(t('toastCreated'));
      router.push(`/marketplace/${listing.id}`);
    },
    onError: (err) =>
      toast.error(
        tRoot(errorMessageKey(err instanceof Error ? err.message : '')),
      ),
  });

  // Cross-record rule the DTO can't know: quantity must not exceed the units
  // available to list. Enforced here for instant UX; the backend re-checks and
  // is the source of truth (INSUFFICIENT_STOCK).
  const onSubmit = handleSubmit((values) => {
    if (availability && values.quantity > availability.available) {
      setError('quantity', {
        message: t('maxAvailable', { available: availability.available }),
      });
      return;
    }
    mutation.mutate(values);
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4 max-w-sm" noValidate>
      <h1 className="text-xl font-bold">{t('createTitle')}</h1>
      {availability && (
        <p className="text-sm text-muted-foreground tabular-nums">
          {t('stock', {
            owned: availability.owned,
            available: availability.available,
          })}
        </p>
      )}
      <label className="grid gap-1 text-sm">
        {t('quantity')}
        <Input
          aria-label={t('quantity')}
          type="number"
          min={1}
          max={availability?.available}
          {...register('quantity', { valueAsNumber: true })}
        />
        {errors.quantity && (
          <p role="alert" className="text-sm text-destructive">
            {errors.quantity.message}
          </p>
        )}
      </label>
      <label className="grid gap-1 text-sm">
        {t('condition')}
        <select
          aria-label={t('condition')}
          className="rounded border px-2 py-1"
          {...register('condition')}
        >
          {Object.values(Condition).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        {t('price')}
        <Input aria-label={t('price')} {...register('price')} />
        {errors.price && (
          <p role="alert" className="text-sm text-destructive">
            {errors.price.message}
          </p>
        )}
      </label>
      <label className="grid gap-1 text-sm">
        {t('description')}
        <Input aria-label={t('description')} {...register('description')} />
        {errors.description && (
          <p role="alert" className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </label>
      <Button type="submit" disabled={mutation.isPending}>
        {t('submit')}
      </Button>
    </form>
  );
}
