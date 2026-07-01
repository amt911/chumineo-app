import { z } from 'zod';

const countryCode = z
  .string()
  .regex(/^[A-Z]{2}$/, 'Must be a 2-letter uppercase ISO-3166 code');

export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  emailVerified: z.boolean(),
  avatarUrl: z.string().nullable(),
  country: countryCode.nullable(),
});
export type PublicUserDto = z.infer<typeof publicUserSchema>;

export const publicProfileSchema = z.object({
  username: z.string(),
  avatarUrl: z.string().nullable(),
  memberSince: z.string(), // ISO date string (Prisma DateTime serializes to string)
  country: countryCode.nullable(),
});
export type PublicProfileDto = z.infer<typeof publicProfileSchema>;

export const updateProfileSchema = z
  .object({
    country: countryCode.nullable().optional(),
  })
  .refine((v) => v.country !== undefined, {
    message: 'At least one field is required',
  });
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
