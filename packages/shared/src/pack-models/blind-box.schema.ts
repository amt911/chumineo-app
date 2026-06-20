import { z } from 'zod';

export const blindBoxPackModelSchema = z.object({
  caseSize: z.number().int().positive(),
  assortment: z
    .array(z.object({ itemId: z.string().min(1), count: z.number().int().positive() }))
    .min(1),
  // `odds` is the "1 in N" rarity of the chase (e.g. 144 => 1/144), not a 0–1 probability.
  chase: z.object({ itemId: z.string().min(1), odds: z.number().positive() }).optional(),
});
export type BlindBoxPackModel = z.infer<typeof blindBoxPackModelSchema>;
