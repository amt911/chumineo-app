import { z } from 'zod';

export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  emailVerified: z.boolean(),
  avatarUrl: z.string().nullable(),
});
export type PublicUserDto = z.infer<typeof publicUserSchema>;

export const publicProfileSchema = z.object({
  username: z.string(),
  avatarUrl: z.string().nullable(),
  memberSince: z.string(), // ISO date string (Prisma DateTime serializes to string)
});
export type PublicProfileDto = z.infer<typeof publicProfileSchema>;
