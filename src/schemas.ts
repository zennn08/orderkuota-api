import { z } from 'zod';

export const authOtpSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const authTokenSchema = z.object({
  username: z.string().min(1),
  otp: z.string().min(1),
});

export const generateSchema = z.object({
  username: z.string().min(1),
  token: z.string().min(1),
  amount: z.coerce.number().int().positive(),
  qris_static: z.string().min(1),
});

export const checkSchema = z.object({
  username: z.string().min(1),
  token: z.string().min(1),
  transaction_id: z.string().min(1),
});

export const imageSchema = z.object({
  qris_string: z.string().min(1),
  size: z.coerce.number().int().positive().max(2000).optional().default(300),
});

export const balanceSchema = z.object({
  username: z.string().min(1),
  token: z.string().min(1),
});
