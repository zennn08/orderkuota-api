import type { Database } from 'bun:sqlite';

/** Idempotent schema creation; run once at startup. */
export function initSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_transactions (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      base_amount INTEGER NOT NULL,
      unique_suffix INTEGER NOT NULL,
      final_amount INTEGER NOT NULL,
      qris_string TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS paid_transactions (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      final_amount INTEGER NOT NULL,
      paid_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      mutation_id INTEGER
    );
  `);

  // Migration: add mutation_id to databases created before claim-tracking.
  const hasMutationId = (
    db.query("PRAGMA table_info(paid_transactions)").all() as { name: string }[]
  ).some((c) => c.name === 'mutation_id');
  if (!hasMutationId) {
    db.exec('ALTER TABLE paid_transactions ADD COLUMN mutation_id INTEGER;');
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_suffix
      ON pending_transactions(username, unique_suffix);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pending_expires
      ON pending_transactions(expires_at);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_paid_expires
      ON paid_transactions(expires_at);
  `);
  // One mutation can pay at most one transaction per user. SQLite treats NULLs
  // as distinct, so legacy rows without a mutation_id never collide.
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_paid_mutation
      ON paid_transactions(username, mutation_id);
  `);
}
