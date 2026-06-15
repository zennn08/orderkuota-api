import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

let db: Database | null = null;

/** Open (once) and return the SQLite database. Pass ':memory:' in tests. */
export function getDb(path = './data/orkut.db'): Database {
  if (!db) {
    // bun:sqlite's `create` makes the file but not its parent dir; ensure it exists.
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    db = new Database(path, { create: true });
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA busy_timeout = 5000;');
  }
  return db;
}

/** Test helper: replace the singleton with a specific Database instance. */
export function setDb(instance: Database): void {
  db = instance;
}
