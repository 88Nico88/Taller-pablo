import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(16).default('dev-secret-change-before-production'),
  ADMIN_EMAIL: z.string().email().default('admin@taller.local'),
  ADMIN_PASSWORD: z.string().min(8).default('admin12345')
});

export const config = schema.parse(process.env);
