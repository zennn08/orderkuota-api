import { test, expect, describe, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { initSchema } from '../src/db/schema.ts';
import {
  getAvailableSuffix,
  createPending,
  getPending,
  deletePending,
  createPaid,
  getPaid,
  cleanupExpired,
  getClaimedMutationIds,
} from '../src/db/transactions.ts';

let db: Database;

beforeEach(() => {
  db = new Database(':memory:');
  initSchema(db);
});

function makePending(id: string, suffix: number, expires: number) {
  return {
    id,
    username: 'OK123',
    base_amount: 10000,
    unique_suffix: suffix,
    final_amount: 10000 + suffix,
    qris_string: 'QRIS',
    created_at: 1000,
    expires_at: expires,
  };
}

describe('getAvailableSuffix', () => {
  test('returns 1 when none used', () => {
    expect(getAvailableSuffix(db, 'OK123', 9_999_999_999)).toBe(1);
  });

  test('skips used suffixes', () => {
    createPending(db, makePending('a', 1, 9_999_999_999));
    createPending(db, makePending('b', 2, 9_999_999_999));
    expect(getAvailableSuffix(db, 'OK123', 9_999_999_999)).toBe(3);
  });
});

describe('pending lifecycle', () => {
  test('create, get, delete', () => {
    createPending(db, makePending('x', 5, 9_999_999_999));
    expect(getPending(db, 'x')?.unique_suffix).toBe(5);
    deletePending(db, 'x');
    expect(getPending(db, 'x')).toBeNull();
  });
});

describe('paid lifecycle', () => {
  test('create and get', () => {
    createPaid(db, { id: 'p', username: 'OK123', final_amount: 10001, paid_at: 50, expires_at: 9_999_999_999 });
    expect(getPaid(db, 'p')?.final_amount).toBe(10001);
  });

  test('stores and reports the claimed mutation id', () => {
    createPaid(db, {
      id: 'p', username: 'OK123', final_amount: 10001,
      paid_at: 50, expires_at: 9_999_999_999, mutation_id: 555,
    });
    expect(getClaimedMutationIds(db, 'OK123')).toEqual(new Set([555]));
  });

  test('claimed ids are scoped per username', () => {
    createPaid(db, {
      id: 'p', username: 'OK123', final_amount: 10001,
      paid_at: 50, expires_at: 9_999_999_999, mutation_id: 555,
    });
    expect(getClaimedMutationIds(db, 'OTHER')).toEqual(new Set());
  });

  test('a mutation id cannot be claimed twice for the same user', () => {
    createPaid(db, {
      id: 'p1', username: 'OK123', final_amount: 10001,
      paid_at: 50, expires_at: 9_999_999_999, mutation_id: 555,
    });
    expect(() =>
      createPaid(db, {
        id: 'p2', username: 'OK123', final_amount: 10001,
        paid_at: 60, expires_at: 9_999_999_999, mutation_id: 555,
      }),
    ).toThrow();
  });
});

describe('cleanupExpired', () => {
  test('removes rows past expiry and frees the suffix', () => {
    createPending(db, makePending('old', 1, 100)); // expired (now=200)
    cleanupExpired(db, 200);
    expect(getPending(db, 'old')).toBeNull();
    expect(getAvailableSuffix(db, 'OK123', 200)).toBe(1);
  });
});
