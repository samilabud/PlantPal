import Database from 'better-sqlite3';

import type { Bind, SqlDb } from '@/db/types';

/** Real SQLite in Node for Jest, behind the same interface the app uses on the phone. */
export function openTestDb(): SqlDb {
  const raw = new Database(':memory:');
  let inTx = false;

  const db: SqlDb = {
    async execAsync(source) {
      raw.exec(source);
    },
    async runAsync(source, params: Bind[]) {
      const info = raw.prepare(source).run(...params);
      return { changes: info.changes };
    },
    async getAllAsync<T>(source: string, params: Bind[]) {
      const stmt = raw.prepare(source);
      return (stmt.reader ? stmt.all(...params) : (stmt.run(...params), [])) as T[];
    },
    async getFirstAsync<T>(source: string, params: Bind[]) {
      const stmt = raw.prepare(source);
      return ((stmt.reader ? stmt.get(...params) : undefined) ?? null) as T | null;
    },
    async withExclusiveTransactionAsync(task) {
      if (inTx) throw new Error('nested transaction');
      inTx = true;
      raw.exec('BEGIN');
      try {
        await task(db);
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      } finally {
        inTx = false;
      }
    },
  };
  return db;
}
