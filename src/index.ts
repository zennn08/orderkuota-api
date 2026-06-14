import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';
import { loadConfig } from './config.ts';
import { getDb } from './db/client.ts';
import { initSchema } from './db/schema.ts';
import { cleanupExpired } from './db/transactions.ts';
import { apiKeyGuard } from './middleware/apiKey.ts';
import { onError } from './middleware/error.ts';
import { healthRoute } from './routes/health.ts';
import { authRoute } from './routes/auth.ts';
import { makeQrisRoute } from './routes/qris.ts';
import { accountRoute } from './routes/account.ts';
import { openApiDoc } from '../docs/openapi.ts';

const config = loadConfig();

// Boot: open DB + create schema.
const db = getDb(config.dbPath);
initSchema(db);

// Periodic cleanup of expired rows (every 60s).
setInterval(() => cleanupExpired(db, Math.floor(Date.now() / 1000)), 60_000);

const app = new Hono();
app.use('*', cors());
app.onError(onError);

// Docs. Public by default; when DOCS_PUBLIC=false, guard them with the API key.
if (!config.docsPublic) {
  app.use('/openapi.json', apiKeyGuard(config.apiKey));
  app.use('/docs', apiKeyGuard(config.apiKey));
}
app.get('/openapi.json', (c) => c.json(openApiDoc));
app.get('/docs', swaggerUI({ url: '/openapi.json' }));

// Health is public.
app.route('/api/health', healthRoute);

// Everything else under /api requires the API key.
const api = new Hono();
api.use('*', apiKeyGuard(config.apiKey));
api.route('/auth', authRoute);
api.route('/qris', makeQrisRoute(config.dbPath));
api.route('/account', accountRoute);
app.route('/api', api);

console.log(`OrderKuota Bun API listening on http://localhost:${config.port}`);
console.log(`Swagger UI: http://localhost:${config.port}/docs`);

export default { port: config.port, fetch: app.fetch };
