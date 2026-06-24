import { z } from 'zod';
import { WishlistPriority } from '../enums/wishlist-priority';
import { Rarity } from '../enums/rarity';

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Must be a non-negative decimal string');

export const addWishlistItemSchema = z.object({
  collectionItemId: z.string().min(1),
  priority: z.nativeEnum(WishlistPriority).default(WishlistPriority.MEDIUM),
  maxPrice: decimalString.optional(),
  isPublic: z.boolean().default(true),
});
export type AddWishlistItemDto = z.infer<typeof addWishlistItemSchema>;

export const updateWishlistItemSchema = z
  .object({
    priority: z.nativeEnum(WishlistPriority).optional(),
    maxPrice: decimalString.nullable().optional(),
    isPublic: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.priority !== undefined ||
      v.maxPrice !== undefined ||
      v.isPublic !== undefined,
    { message: 'At least one field is required' },
  );
export type UpdateWishlistItemDto = z.infer<typeof updateWishlistItemSchema>;

export const wishlistItemSchema = z.object({
  id: z.string(),
  priority: z.nativeEnum(WishlistPriority),
  maxPrice: z.string().nullable(),
  isPublic: z.boolean(),
  item: z.object({
    id: z.string(),
    name: z.string(),
    rarity: z.nativeEnum(Rarity),
    imageUrl: z.string().nullable(),
  }),
  collection: z.object({ slug: z.string(), name: z.string() }),
});
export type WishlistItemDto = z.infer<typeof wishlistItemSchema>;
