import { z } from 'zod';
import { Rarity } from '../enums/rarity';

export const tcgPackModelSchema = z.object({
  slots: z
    .array(
      z.object({
        rarity: z.nativeEnum(Rarity),
        count: z.number().int().positive(),
      }),
    )
    .min(1),
});
export type TcgPackModel = z.infer<typeof tcgPackModelSchema>;
