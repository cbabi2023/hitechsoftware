import { z } from 'zod';

export const signInSchema = z.object({
  email: z.email('Please enter a valid email address').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});
