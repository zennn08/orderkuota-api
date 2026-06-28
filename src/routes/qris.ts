import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import { generateSchema, checkSchema, imageSchema } from '../schemas.ts';
import { generateDynamicQris } from '../services/qris.ts';
import { getQrisHistory } from '../services/orderkuota.ts';
import { findUnclaimedPayment } from '../services/mutation.ts';
import { getDb } from '../db/client.ts';
import {
  getAvailableSuffix,
  createPending,
  getPending,
  deletePending,
  createPaid,
  getPaid,
  getClaimedMutationIds,
} from '../db/transactions.ts';

const EXPIRY_SECONDS = 600; // 10 minutes
const PAID_EXPIRY_SECONDS = 3600; // 1 hour

export function makeQrisRoute(dbPath: string): Hono {
  const route = new Hono();
  const db = getDb(dbPath);

  route.post('/generate', zValidator('json', generateSchema), (c) => {
    const { username, token: _token, amount, qris_static } = c.req.valid('json');
    const now = Math.floor(Date.now() / 1000);
    const suffix = getAvailableSuffix(db, username, now);
    const finalAmount = amount + suffix;
    const qrisString = generateDynamicQris(qris_static, finalAmount);
    const txId = randomUUID();

    createPending(db, {
      id: txId,
      username,
      base_amount: amount,
      unique_suffix: suffix,
      final_amount: finalAmount,
      qris_string: qrisString,
      created_at: now,
      expires_at: now + EXPIRY_SECONDS,
    });

    return c.json({
      success: true,
      data: {
        transaction_id: txId,
        base_amount: amount,
        unique_suffix: suffix,
        final_amount: finalAmount,
        qris_string: qrisString,
        expires_at: now + EXPIRY_SECONDS,
      },
    });
  });

  route.post('/check', zValidator('json', checkSchema), async (c) => {
    const { username, token, transaction_id } = c.req.valid('json');

    const paid = getPaid(db, transaction_id);
    if (paid) {
      return c.json({
        success: true,
        data: { status: 'paid', final_amount: paid.final_amount, paid_at: paid.paid_at },
      });
    }

    const tx = getPending(db, transaction_id);
    if (!tx) {
      return c.json({ success: true, data: { status: 'not_found' } });
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > tx.expires_at) {
      deletePending(db, transaction_id);
      return c.json({ success: true, data: { status: 'expired' } });
    }

    const historyResult = (await getQrisHistory(username, token)) as Record<string, unknown>;
    const historyData =
      (historyResult?.qris_ajaib_history as Record<string, unknown>)?.results ||
      (historyResult?.qris_history as Record<string, unknown>)?.results ||
      [];
    const history = Array.isArray(historyData) ? historyData : [];

    const pendingResponse = c.json({
      success: true,
      data: { status: 'pending', final_amount: tx.final_amount, expires_in: tx.expires_at - now },
    });

    const match = findUnclaimedPayment(history, {
      finalAmount: tx.final_amount,
      createdAt: tx.created_at,
      claimedIds: getClaimedMutationIds(db, username),
    });
    if (!match) return pendingResponse;

    // Claim the mutation first; the UNIQUE(username, mutation_id) index makes
    // this the atomic gate so one payment can settle only one transaction.
    try {
      createPaid(db, {
        id: transaction_id,
        username,
        final_amount: tx.final_amount,
        paid_at: now,
        expires_at: now + PAID_EXPIRY_SECONDS,
        mutation_id: match.id,
      });
    } catch {
      // Another transaction already claimed this mutation — this one is unpaid.
      return pendingResponse;
    }
    deletePending(db, transaction_id);
    return c.json({
      success: true,
      data: { status: 'paid', final_amount: tx.final_amount, paid_at: now },
    });
  });

  route.post('/image', zValidator('json', imageSchema), async (c) => {
    const { qris_string, size } = c.req.valid('json');
    const dataUrl = await QRCode.toDataURL(qris_string, { width: size, margin: 1 });
    return c.json({ success: true, data: { data_url: dataUrl, size } });
  });

  return route;
}
