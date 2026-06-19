import { z } from 'zod';

// Figure items reference CollectionItem rows by id; rarity lives on the item, not here.
export const figurePackModelSchema = z.object({
  items: z.array(z.object({ itemId: z.string().min(1) })).min(1),
});
export type FigurePackModel = z.infer<typeof figurePackModelSchema>;
