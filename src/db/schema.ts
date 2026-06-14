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
      expires_at INTEGER NOT NULL
    );
  `);

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
}
