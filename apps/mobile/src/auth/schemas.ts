import { z } from 'zod/v3';

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

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
