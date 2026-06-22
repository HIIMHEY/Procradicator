import { z } from 'zod';

export const loginSchema = z.object({
  username: z
    .string()
    .trim() //removes whitespace before validation
    .min(1, 'Username is required.')
    .max(100, 'Username must be at most 100 characters.'),
  password: z
    .string()
    .min(1, 'Password is required.')
    .max(128, 'Password must be at most 128 characters.'),
});

export const registerSchema = z.object({
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email.'),
  username: z
    .string()
    .trim()
    .min(1, 'Username is required.')
    .max(100, 'Username must be at most 100 characters.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password must be at most 128 characters.'),
});

export const userReadSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  is_active: z.boolean(),
  is_superuser: z.boolean(),
  is_verified: z.boolean(),
  created_at: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UserRead = z.infer<typeof userReadSchema>;
