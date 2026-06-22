import { z } from 'zod';

export const brandSchema = z.object({ slug: z.string(), name: z.string() });
export type BrandDto = z.infer<typeof brandSchema>;

export const brandsResponseSchema = z.array(brandSchema);
