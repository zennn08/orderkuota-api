import type { Database } from 'bun:sqlite';
import type { PendingTransaction, PaidTransaction } from '../types.ts';

/** Delete pending & paid rows whose expiry has passed. */
export function cleanupExpired(db: Database, now: number): void {
  db.query('DELETE FROM pending_transactions WHERE expires_at < ?').run(now);
  db.query('DELETE FROM paid_transactions WHERE expires_at < ?').run(now);
}

/** Find the lowest unused unique suffix (1..999) for a username. */
export function getAvailableSuffix(db: Database, username: string, now: number): number {
  cleanupExpired(db, now);
  const rows = db
    .query('SELECT unique_suffix FROM pending_transactions WHERE username = ?')
    .all(username) as { unique_suffix: number }[];
  const used = new Set(rows.map((r) => r.unique_suffix));
  for (let i = 1; i <= 999; i++) {
    if (!used.has(i)) return i;
  }
  throw new Error('No suffix available');
}

export function createPending(db: Database, tx: PendingTransaction): void {
  db.query(
    `INSERT INTO pending_transactions
       (id, username, base_amount, unique_suffix, final_amount, qris_string, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    tx.id, tx.username, tx.base_amount, tx.unique_suffix,
    tx.final_amount, tx.qris_string, tx.created_at, tx.expires_at,
  );
}

export function getPending(db: Database, id: string): PendingTransaction | null {
  const row = db
    .query('SELECT * FROM pending_transactions WHERE id = ?')
    .get(id) as PendingTransaction | null;
  return row ?? null;
}

export function deletePending(db: Database, id: string): void {
  db.query('DELETE FROM pending_transactions WHERE id = ?').run(id);
}

export function createPaid(db: Database, tx: PaidTransaction): void {
  db.query(
    `INSERT INTO paid_transactions (id, username, final_amount, paid_at, expires_at, mutation_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(tx.id, tx.username, tx.final_amount, tx.paid_at, tx.expires_at, tx.mutation_id ?? null);
}

/** Mutation ids already claimed by paid transactions for a username. */
export function getClaimedMutationIds(db: Database, username: string): Set<number> {
  const rows = db
    .query('SELECT mutation_id FROM paid_transactions WHERE username = ? AND mutation_id IS NOT NULL')
    .all(username) as { mutation_id: number }[];
  return new Set(rows.map((r) => r.mutation_id));
}

export function getPaid(db: Database, id: string): PaidTransaction | null {
  const row = db
    .query('SELECT * FROM paid_transactions WHERE id = ?')
    .get(id) as PaidTransaction | null;
  return row ?? null;
}
