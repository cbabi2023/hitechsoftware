import { z } from 'zod';

export const subjectNumberSchema = z.string().trim().min(1);
