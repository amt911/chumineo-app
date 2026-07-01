'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import { Condition } from '@sobrebox/shared';
import { createListing } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function CreateListingForm({
  collectionItemId,
}: {
  collectionItemId: string;
}) {
  const t = useTranslations('Marketplace');
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [quantity, setQuantity] = useState('');
  const [condition, setCondition] = useState<Condition>(Condition.MINT);
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createListing(
        {
          collectionItemId,
          quantity: Number(quantity),
          condition,
          price,
          ...(description ? { description } : {}),
        },
        accessToken as string,
      ),
    onSuccess: (listing) => {
      toast.success(t('toastCreated'));
      router.push(`/marketplace/${listing.id}`);
    },
    onError: () => toast.error(t('toastCreated')),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="grid gap-4 max-w-sm"
    >
      <h1 className="text-xl font-bold">{t('createTitle')}</h1>
      <label className="grid gap-1 text-sm">
        {t('quantity')}
        <Input
          aria-label={t('quantity')}
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm">
        {t('condition')}
        <select
          aria-label={t('condition')}
          value={condition}
          onChange={(e) => setCondition(e.target.value as Condition)}
          className="rounded border px-2 py-1"
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
        <Input
          aria-label={t('price')}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm">
        {t('description')}
        <Input
          aria-label={t('description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <Button type="submit" disabled={mutation.isPending}>
        {t('submit')}
      </Button>
    </form>
  );
}
