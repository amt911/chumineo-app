import { z } from 'zod';
import { Condition } from '../enums/condition';
import { ListingStatus } from '../enums/listing-status';
import { Rarity } from '../enums/rarity';

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Must be a non-negative decimal string');

export const createListingSchema = z.object({
  collectionItemId: z.string().min(1),
  quantity: z.number().int().positive(),
  condition: z.nativeEnum(Condition),
  price: decimalString,
  description: z.string().max(2000).optional(),
});
export type CreateListingDto = z.infer<typeof createListingSchema>;

export const updateListingSchema = z
  .object({
    quantity: z.number().int().positive().optional(),
    price: decimalString.optional(),
    description: z.string().max(2000).nullable().optional(),
    status: z.nativeEnum(ListingStatus).optional(),
  })
  .refine(
    (v) =>
      v.quantity !== undefined ||
      v.price !== undefined ||
      v.description !== undefined ||
      v.status !== undefined,
    { message: 'At least one field is required' },
  );
export type UpdateListingDto = z.infer<typeof updateListingSchema>;

const listingSortSchema = z.enum([
  'price_asc',
  'price_desc',
  'recent',
  'best_rated', // accepted but a no-op until reputationScore exists (US-25)
]);

export const listingQuerySchema = z.object({
  collectionId: z.string().optional(),
  collectionItemId: z.string().optional(),
  q: z.string().optional(),
  priceMin: decimalString.optional(),
  priceMax: decimalString.optional(),
  condition: z.nativeEnum(Condition).optional(),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  sort: listingSortSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
});
export type ListingQueryDto = z.infer<typeof listingQuerySchema>;

const itemRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  rarity: z.nativeEnum(Rarity),
  imageUrl: z.string().nullable(),
});

const collectionRefSchema = z.object({
  slug: z.string(),
  name: z.string(),
});

const sellerRefSchema = z.object({
  username: z.string(),
  country: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export const listingPhotoSchema = z.object({
  id: z.string(),
  url: z.string(),
});
export type ListingPhotoDto = z.infer<typeof listingPhotoSchema>;

export const listingSchema = z.object({
  id: z.string(),
  quantity: z.number().int(),
  condition: z.nativeEnum(Condition),
  price: z.string(),
  description: z.string().nullable(),
  status: z.nativeEnum(ListingStatus),
  createdAt: z.string(),
  item: itemRefSchema,
  collection: collectionRefSchema,
  seller: sellerRefSchema,
  photos: z.array(listingPhotoSchema),
});
export type ListingDto = z.infer<typeof listingSchema>;

export const listingsPageSchema = z.object({
  items: z.array(listingSchema),
  page: z.number().int(),
  totalPages: z.number().int(),
  total: z.number().int(),
});
export type ListingsPageDto = z.infer<typeof listingsPageSchema>;
