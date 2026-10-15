import { Directory, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';

import { migrate, wipeAllRows } from './migrations';
import type { SqlDb } from './types';

let opening: Promise<SqlDb> | null = null;

/** The one app database. Opened lazily, migrated once, WAL mode for faster concurrent reads. */
export function getDb(): Promise<SqlDb> {
  opening ??= (async () => {
    const db = await SQLite.openDatabaseAsync('plantpal.db');
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    const adapted = db as unknown as SqlDb;
    await migrate(adapted);
    return adapted;
  })();
  return opening;
}

export const photosDirectory = () => new Directory(Paths.document, 'photos');

/** Wipes all rows and local photo files. Safe to call when nothing exists yet. */
export async function wipeLocalData() {
  await wipeAllRows(await getDb());
  const dir = photosDirectory();
  if (dir.exists) dir.delete();
}
