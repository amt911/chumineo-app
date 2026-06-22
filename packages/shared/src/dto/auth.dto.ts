import { z } from 'zod';
import { publicUserSchema } from './user.dto';

export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: publicUserSchema,
});
export type AuthResponseDto = z.infer<typeof authResponseSchema>;

export const messageResponseSchema = z.object({ message: z.string() });
export type MessageResponseDto = z.infer<typeof messageResponseSchema>;
