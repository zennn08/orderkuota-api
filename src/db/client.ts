import { Database } from 'bun:sqlite';

let db: Database | null = null;

/** Open (once) and return the SQLite database. Pass ':memory:' in tests. */
export function getDb(path = './data/orkut.db'): Database {
  if (!db) {
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
