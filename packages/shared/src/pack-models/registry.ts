import { z, type SafeParseReturnType, type ZodSchema } from 'zod';
import { CollectionCategory } from '../enums/collection-category';
import { tcgPackModelSchema } from './tcg.schema';
import { blindBoxPackModelSchema } from './blind-box.schema';
import { figurePackModelSchema } from './figure.schema';

export const packModelRegistry: Record<CollectionCategory, ZodSchema> = {
  [CollectionCategory.TCG]: tcgPackModelSchema,
  [CollectionCategory.FIGURE]: figurePackModelSchema,
  [CollectionCategory.BLIND_BOX]: blindBoxPackModelSchema,
};

export function validatePackModel(
  category: CollectionCategory,
  data: unknown,
): SafeParseReturnType<unknown, unknown> {
  const schema = packModelRegistry[category];
  // Unknown category → a schema that never matches, so callers always get success:false.
  return (schema ?? z.never()).safeParse(data);
}
