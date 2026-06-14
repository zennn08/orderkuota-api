import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { balanceSchema } from '../schemas.ts';
import { getBalance } from '../services/orderkuota.ts';

export const accountRoute = new Hono();

accountRoute.post('/balance', zValidator('json', balanceSchema), async (c) => {
  const { username, token } = c.req.valid('json');
  const data = await getBalance(username, token);
  return c.json({ success: true, data });
});
