import { test, expect, describe, mock, beforeAll } from 'bun:test';

// One incoming payment of 10.001 exists in the upstream history.
mock.module('../src/services/orderkuota.ts', () => ({
  requestOtp: async () => ({}),
  getToken: async () => ({}),
  generateQrisAjaib: async () => ({}),
  getBalance: async () => ({}),
  getQrisHistory: async () => ({
    qris_history: {
      results: [
        { id: 900001, kredit: '10.001', status: 'IN', tanggal: '01/01/2030 00:00:00' },
      ],
    },
  }),
}));

import { Hono } from 'hono';
import { apiKeyGuard } from '../src/middleware/apiKey.ts';
import { onError } from '../src/middleware/error.ts';
import { makeQrisRoute } from '../src/routes/qris.ts';
import { getDb } from '../src/db/client.ts';
import { initSchema } from '../src/db/schema.ts';
import { createPending } from '../src/db/transactions.ts';

const KEY = 'testkey';
let app: Hono;

beforeAll(() => {
  app = new Hono();
  app.onError(onError);
  const api = new Hono();
  api.use('*', apiKeyGuard(KEY));
  api.route('/qris', makeQrisRoute(':memory:'));
  app.route('/api', api);
  initSchema(getDb(':memory:'));
});

function check(id: string) {
  return app.request('/api/qris/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY },
    body: JSON.stringify({ username: 'CHK1', token: 't:t', transaction_id: id }),
  });
}

describe('check claims one payment per transaction', () => {
  test('a single payment does not mark two same-amount transactions as paid', async () => {
    const db = getDb(':memory:');
    // Two pending transactions with the SAME final amount (e.g. suffix reuse).
    let suffix = 1;
    for (const id of ['chk-a', 'chk-b']) {
      createPending(db, {
        id,
        username: 'CHK1',
        base_amount: 10001 - suffix,
        unique_suffix: suffix,
        final_amount: 10001,
        qris_string: 'QRIS',
        created_at: 1000,
        expires_at: 9_999_999_999,
      });
      suffix++;
    }

    const first = (await (await check('chk-a')).json()) as { data: { status: string } };
    const second = (await (await check('chk-b')).json()) as { data: { status: string } };

    const statuses = [first.data.status, second.data.status].sort();
    expect(statuses).toEqual(['paid', 'pending']);
  });
});
