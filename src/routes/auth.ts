import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authOtpSchema, authTokenSchema } from '../schemas.ts';
import { requestOtp, getToken } from '../services/orderkuota.ts';

export const authRoute = new Hono();

authRoute.post('/otp', zValidator('json', authOtpSchema), async (c) => {
  const { username, password } = c.req.valid('json');
  const data = await requestOtp(username, password);
  return c.json({ success: true, data });
});

authRoute.post('/token', zValidator('json', authTokenSchema), async (c) => {
  const { username, otp } = c.req.valid('json');
  const data = await getToken(username, otp);
  return c.json({ success: true, data });
});
