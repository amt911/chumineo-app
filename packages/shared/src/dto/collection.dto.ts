import { z } from 'zod';
import { CollectionCategory } from '../enums/collection-category';
import { CollectionStatus } from '../enums/collection-status';
import { CollectionSource } from '../enums/collection-source';

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
