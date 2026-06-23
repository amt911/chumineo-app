import { z } from 'zod';
import { CollectionCategory } from '../enums/collection-category';
import { CollectionStatus } from '../enums/collection-status';
import { CollectionSource } from '../enums/collection-source';
import { Rarity } from '../enums/rarity';
import { brandSchema } from './brand.dto';

export const collectionResponseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  category: z.nativeEnum(CollectionCategory),
  status: z.nativeEnum(CollectionStatus),
  source: z.nativeEnum(CollectionSource),
});
export type CollectionResponseDto = z.infer<typeof collectionResponseSchema>;

/** Schema for the `GET /collections` list payload — use to validate API responses. */
export const collectionsResponseSchema = z.array(collectionResponseSchema);

export const collectionListItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  category: z.nativeEnum(CollectionCategory),
  source: z.nativeEnum(CollectionSource),
  releaseYear: z.number().int().nullable(),
  coverImageUrl: z.string().nullable(),
  brand: brandSchema,
  itemCount: z.number().int(),
});
export type CollectionListItemDto = z.infer<typeof collectionListItemSchema>;

export const collectionsPageSchema = z.object({
  items: z.array(collectionListItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  hasMore: z.boolean(),
});
export type CollectionsPageDto = z.infer<typeof collectionsPageSchema>;

export const collectionItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  rarity: z.nativeEnum(Rarity),
  imageUrl: z.string().nullable(),
  officialPullRate: z.string().nullable(),
});
export type CollectionItemDto = z.infer<typeof collectionItemSchema>;

export const packTypeSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.string().nullable(),
  summary: z.string(),
});
export type PackTypeSummaryDto = z.infer<typeof packTypeSummarySchema>;

export const rarityCountSchema = z.object({
  rarity: z.nativeEnum(Rarity),
  count: z.number().int(),
});
export type RarityCountDto = z.infer<typeof rarityCountSchema>;

export const collectionDetailSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  category: z.nativeEnum(CollectionCategory),
  source: z.nativeEnum(CollectionSource),
  status: z.nativeEnum(CollectionStatus),
  releaseYear: z.number().int().nullable(),
  coverImageUrl: z.string().nullable(),
  brand: brandSchema,
  createdBy: z.object({ username: z.string() }).nullable(),
  rarityDistribution: z.array(rarityCountSchema),
  items: z.array(collectionItemSchema),
  packTypes: z.array(packTypeSummarySchema),
});
export type CollectionDetailDto = z.infer<typeof collectionDetailSchema>;
