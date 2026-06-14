import { test, expect, describe, mock, beforeAll } from 'bun:test';

// Mock the upstream client BEFORE importing routes that use it.
mock.module('../src/services/orderkuota.ts', () => ({
  requestOtp: async () => ({ mocked: 'otp' }),
  getToken: async () => ({ mocked: 'token' }),
  generateQrisAjaib: async () => ({}),
  getQrisHistory: async () => ({ qris_history: { results: [] } }),
  getBalance: async () => ({ balance: 123 }),
}));

import { Hono } from 'hono';
import { apiKeyGuard } from '../src/middleware/apiKey.ts';
import { onError } from '../src/middleware/error.ts';
import { authRoute } from '../src/routes/auth.ts';
import { makeQrisRoute } from '../src/routes/qris.ts';
import { healthRoute } from '../src/routes/health.ts';
import { getDb } from '../src/db/client.ts';
import { initSchema } from '../src/db/schema.ts';

const KEY = 'testkey';
let app: Hono;

beforeAll(() => {
  app = new Hono();
  app.onError(onError);
  app.route('/api/health', healthRoute);
  const api = new Hono();
  api.use('*', apiKeyGuard(KEY));
  api.route('/auth', authRoute);
  const qrisRoute = makeQrisRoute(':memory:');
  // makeQrisRoute opens the shared singleton DB; create its schema for the suite.
  initSchema(getDb(':memory:'));
  api.route('/qris', qrisRoute);
  app.route('/api', api);
});

describe('api-key guard', () => {
  test('401 without key', async () => {
    const res = await app.request('/api/auth/otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'a', password: 'b' }),
    });
    expect(res.status).toBe(401);
  });

  test('health needs no key', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
  });
});

describe('validation', () => {
  test('400 on missing fields with key present', async () => {
    const res = await app.request('/api/auth/otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY },
      body: JSON.stringify({ username: 'a' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('qris generate', () => {
  test('creates a transaction', async () => {
    const staticQris =
      '00020101021126670016COM.NOBUBANK.WWW01189360050300000898240214123456789012340303UMI51440014ID.CO.QRIS.WWW0215ID20232634750570303UMI5204594553033605802ID5910Toko Demo6007Jakarta61051234562070703A0163041B2A';
    const res = await app.request('/api/qris/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY },
      body: JSON.stringify({ username: 'OK1', token: 't:t', amount: 10000, qris_static: staticQris }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { final_amount: number; transaction_id: string } };
    expect(body.success).toBe(true);
    expect(body.data.final_amount).toBe(10001);
    expect(body.data.transaction_id).toBeString();
  });
});
