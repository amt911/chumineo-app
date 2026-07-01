'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { Check, Heart, Plus, Trophy, X } from 'lucide-react';
import {
  addInventoryItem,
  addWishlistItem,
  deleteInventoryItem,
  deleteWishlistItem,
  fetchCollectionProgress,
} from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { WishlistPriority } from '@sobrebox/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function CollectionOwnershipPanel({ slug }: { slug: string }) {
  const t = useTranslations('Collections');
  const status = useAuthStore((s) => s.status);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['inventory', 'progress', slug],
    queryFn: () => fetchCollectionProgress(slug, accessToken as string),
    enabled: status === 'authenticated',
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['inventory', 'progress'] });

  const onError = () => toast.error(t('toastError'));

  const addOwned = useMutation({
    mutationFn: (v: { collectionItemId: string; name: string }) =>
      addInventoryItem(
        { collectionItemId: v.collectionItemId, quantity: 1 },
        accessToken as string,
      ),
    onSuccess: (_res, v) => {
      invalidate();
      toast.success(t('toastAdded', { name: v.name }));
    },
    onError,
  });

  const removeOwned = useMutation({
    mutationFn: (v: { id: string; name: string }) =>
      deleteInventoryItem(v.id, accessToken as string),
    onSuccess: (_res, v) => {
      invalidate();
      toast.success(t('toastRemoved', { name: v.name }));
    },
    onError,
  });

  const addWish = useMutation({
    mutationFn: (v: { collectionItemId: string; name: string }) =>
      addWishlistItem(
        {
          collectionItemId: v.collectionItemId,
          priority: WishlistPriority.MEDIUM,
          isPublic: true,
        },
        accessToken as string,
      ),
    onSuccess: (_res, v) => {
      invalidate();
      toast.success(t('toastWishAdded', { name: v.name }));
    },
    onError,
  });

  const removeWish = useMutation({
    mutationFn: (v: { id: string; name: string }) =>
      deleteWishlistItem(v.id, accessToken as string),
    onSuccess: (_res, v) => {
      invalidate();
      toast.success(t('toastWishRemoved', { name: v.name }));
    },
    onError,
  });

  if (status !== 'authenticated') return null;
  if (!data) return null;

  const busy =
    addOwned.isPending ||
    removeOwned.isPending ||
    addWish.isPending ||
    removeWish.isPending;
  const complete = data.total > 0 && data.percent === 100;

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t('progressTitle')}
          <AnimatePresence>
            {complete && (
              <motion.span
                initial={{ scale: 0, rotate: -30, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
              >
                <Trophy className="size-3" />
                {t('complete')}
              </motion.span>
            )}
          </AnimatePresence>
        </CardTitle>
        <p className="text-sm text-muted-foreground tabular-nums">
          {data.owned} / {data.total} · {data.percent}%
        </p>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${data.percent}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {data.items.map((it) => {
              const owned = it.ownedQuantity > 0;
              const wished = it.wishlistId !== null;
              return (
                <motion.li
                  key={it.collectionItemId}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors',
                    owned
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-transparent bg-muted/40 hover:bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'flex items-center gap-2 text-sm',
                      owned ? 'font-medium' : 'text-muted-foreground',
                    )}
                  >
                    <motion.span
                      key={owned ? 'on' : 'off'}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 15,
                      }}
                      className={cn(
                        'inline-flex size-5 items-center justify-center rounded-full',
                        owned
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted-foreground/15 text-muted-foreground',
                      )}
                    >
                      {owned ? (
                        <Check className="size-3" />
                      ) : (
                        <X className="size-3" />
                      )}
                    </motion.span>
                    <span>{it.name}</span>
                    {owned ? (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        ×{it.ownedQuantity}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t('missing')}
                      </span>
                    )}
                  </span>

                  <span className="flex items-center gap-1.5">
                    {owned ? (
                      <>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          disabled={busy}
                          aria-label={t('addOne', { name: it.name })}
                          onClick={() =>
                            addOwned.mutate({
                              collectionItemId: it.collectionItemId,
                              name: it.name,
                            })
                          }
                        >
                          <Plus /> 1
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="destructive"
                          disabled={busy}
                          aria-label={t('removeOwned', { name: it.name })}
                          onClick={() =>
                            removeOwned.mutate({
                              id: it.inventoryId as string,
                              name: it.name,
                            })
                          }
                        >
                          <X /> {t('owned')}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="xs"
                          variant="default"
                          disabled={busy}
                          aria-label={t('have', { name: it.name })}
                          onClick={() =>
                            addOwned.mutate({
                              collectionItemId: it.collectionItemId,
                              name: it.name,
                            })
                          }
                        >
                          <Check /> {t('owned')}
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant={wished ? 'secondary' : 'outline'}
                          disabled={busy}
                          aria-label={
                            wished
                              ? t('removeWishlist', { name: it.name })
                              : t('addWishlist', { name: it.name })
                          }
                          onClick={() =>
                            wished
                              ? removeWish.mutate({
                                  id: it.wishlistId as string,
                                  name: it.name,
                                })
                              : addWish.mutate({
                                  collectionItemId: it.collectionItemId,
                                  name: it.name,
                                })
                          }
                        >
                          <Heart className={cn(wished && 'fill-current')} />{' '}
                          {t('wishlist')}
                        </Button>
                      </>
                    )}
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </CardContent>
    </Card>
  );
}
