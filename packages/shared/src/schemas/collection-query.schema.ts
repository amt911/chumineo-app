import { z } from 'zod';
import { CollectionCategory } from '../enums/collection-category';

export const collectionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  brand: z.string().optional(),
  category: z.nativeEnum(CollectionCategory).optional(),
  year: z.coerce.number().int().optional(),
  q: z.string().trim().min(1).optional(),
  sort: z.enum(['name', 'newest', 'year']).default('newest'),
});
export type CollectionsQueryDto = z.infer<typeof collectionsQuerySchema>;
