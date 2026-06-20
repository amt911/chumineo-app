import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/\d/, 'Must contain a number'),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^\S+$/, 'No spaces allowed')
    .optional(),
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().default(false),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const verifySchema = z.object({ token: z.string().min(1) });
export type VerifyDto = z.infer<typeof verifySchema>;

export const resendVerificationSchema = z.object({ email: z.string().email() });
export type ResendVerificationDto = z.infer<typeof resendVerificationSchema>;
