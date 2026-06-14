import { Hono } from 'hono';

export const healthRoute = new Hono();

healthRoute.get('/', (c) =>
  c.json({ success: true, data: { status: 'ok', service: 'orderkuota-bun' } }),
);
